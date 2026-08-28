#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# discover-ftp-docroot.py — پیدا کردن مسیر FTP که واقعاً docroot دامنه است
#
# چرا: بعد از مهاجرت ریپو، سکرت FTP_SERVER_DIR به پوشه‌ای اشاره می‌کند که
# وب‌سرور از آن سرو نمی‌کند (آپلود «موفق» ولی سایت زنده کهنه می‌ماند).
#
# روش: به هر مسیر نامزد یک فایل قناری یکتا STOR می‌شود؛ اگر همان محتوا از
# LIVE_URL برگشت و از PROD_URL برگشت، آن مسیر docroot استیجینگ است.
# مسیرهایی که قناری‌شان روی پروداکشن ظاهر شود فوراً پاک و رد می‌شوند.
#
# خروجی: dir=... در GITHUB_OUTPUT (همیشه با / پایانی — سازگار با
# SamKirkland/FTP-Deploy-Action). شکست = کد خروج ۱.
#
# env: FTP_SERVER FTP_USERNAME FTP_PASSWORD FTP_SERVER_DIR
#      LIVE_URL PROD_URL OVERRIDE_DIR (اختیاری)
# ═══════════════════════════════════════════════════════════════════════════
from __future__ import annotations

import ftplib
import io
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

CANARY_NAME = f"__ptf_canary_{os.environ.get('GITHUB_RUN_ID', 'local')}.html"
TOKEN = f"PTF_CANARY_{os.environ.get('GITHUB_RUN_ID', 'local')}_{int(time.time())}"
CANARY_BODY = (
    "<!doctype html><title>ptf-canary</title>"
    f"<p>{TOKEN}</p>\n"
).encode("ascii")

LIVE_URL = os.environ.get("LIVE_URL", "https://staging.pishtaj.ir").rstrip("/")
PROD_URL = os.environ.get("PROD_URL", "https://pishtaj.ir").rstrip("/")
OVERRIDE = (os.environ.get("OVERRIDE_DIR") or "").strip()
SECRET_DIR = (os.environ.get("FTP_SERVER_DIR") or "").strip()
HOST_RAW = (os.environ.get("FTP_SERVER") or "").strip()
USER = os.environ.get("FTP_USERNAME") or ""
PASS = os.environ.get("FTP_PASSWORD") or ""

GITHUB_OUTPUT = os.environ.get("GITHUB_OUTPUT")
GITHUB_STEP_SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
IN_GHA = os.environ.get("GITHUB_ACTIONS") == "true"


def log(msg: str) -> None:
    print(msg, flush=True)


def note(msg: str) -> None:
    if IN_GHA:
        one = msg.replace("\r", " ").replace("\n", " | ")
        print(f"::notice title=[docroot]::{one}", flush=True)
    else:
        log(msg)


def err(msg: str) -> None:
    if IN_GHA:
        one = msg.replace("\r", " ").replace("\n", " | ")
        print(f"::error::{one}", flush=True)
    else:
        log("⛔ " + msg)


def host_of(raw: str) -> str:
    h = raw.strip()
    for p in ("ftps://", "ftp://", "https://", "http://"):
        if h.lower().startswith(p):
            h = h[len(p) :]
    h = h.split("/")[0]
    if ":" in h:
        h = h.split(":")[0]
    return h


def normalize_dir(path: str) -> str:
    p = (path or "").strip().replace("\\", "/")
    if p in ("", ".", "./"):
        return "/"
    if not p.startswith("/"):
        p = "/" + p
    if not p.endswith("/"):
        p += "/"
    while "//" in p:
        p = p.replace("//", "/")
    return p


def http_has_token(url: str) -> bool:
    bust = f"{url}?cb={int(time.time() * 1000)}"
    ctx = ssl._create_unverified_context()
    try:
        req = urllib.request.Request(bust, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
        with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
            body = resp.read(8000)
        return TOKEN.encode("ascii") in body
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return False


def connect(host: str, tls: bool):
    if tls:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ftp = ftplib.FTP_TLS(context=ctx)
        ftp.connect(host, 21, timeout=25)
        ftp.login(USER, PASS)
        try:
            ftp.prot_p()
        except ftplib.all_errors:
            pass
        ftp.set_pasv(True)
        return ftp
    ftp = ftplib.FTP()
    ftp.connect(host, 21, timeout=25)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    return ftp


def try_connect(host: str):
    last = None
    for tls in (True, False):
        try:
            ftp = connect(host, tls)
            log(f"   اتصال FTP {'TLS' if tls else 'plain'} برقرار شد")
            return ftp, tls
        except ftplib.all_errors as e:
            last = e
            log(f"   اتصال {'TLS' if tls else 'plain'} شکست: {type(e).__name__}")
        except OSError as e:
            last = e
            log(f"   اتصال {'TLS' if tls else 'plain'} شبکه: {type(e).__name__}")
    raise RuntimeError(f"ورود FTP ممکن نشد ({type(last).__name__ if last else 'unknown'})")


def safe_pwd(ftp) -> str:
    try:
        return ftp.pwd() or ""
    except ftplib.all_errors:
        return ""


def safe_nlst(ftp) -> list[str]:
    try:
        names = ftp.nlst()
        return [n.split("/")[-1] for n in names if n and n not in (".", "..")]
    except ftplib.all_errors:
        try:
            lines: list[str] = []
            ftp.retrlines("LIST", lines.append)
            out = []
            for ln in lines:
                parts = ln.split()
                if parts:
                    out.append(parts[-1])
            return [n for n in out if n not in (".", "..")]
        except ftplib.all_errors:
            return []


def cwd_to(ftp, dest: str, origin: str) -> bool:
    dest = dest.strip()
    if dest in ("", ".", "./", "/"):
        try:
            if dest == "/":
                ftp.cwd("/")
            else:
                ftp.cwd(origin or ".")
            return True
        except ftplib.all_errors:
            if dest in ("", ".", "./"):
                return True
            try:
                ftp.cwd(origin or ".")
                return True
            except ftplib.all_errors:
                return False
    # absolute
    if dest.startswith("/"):
        try:
            ftp.cwd(dest)
            return True
        except ftplib.all_errors:
            pass
        try:
            ftp.cwd("/")
        except ftplib.all_errors:
            try:
                ftp.cwd(origin or ".")
            except ftplib.all_errors:
                return False
        for part in dest.strip("/").split("/"):
            if not part:
                continue
            try:
                ftp.cwd(part)
            except ftplib.all_errors:
                return False
        return True
    # relative from origin
    try:
        ftp.cwd(origin or ".")
    except ftplib.all_errors:
        pass
    try:
        ftp.cwd(dest)
        return True
    except ftplib.all_errors:
        cur = origin or "."
        for part in dest.strip("/").split("/"):
            try:
                ftp.cwd(part)
                cur = part
            except ftplib.all_errors:
                return False
        return True


def stor(ftp, name: str, data: bytes) -> bool:
    try:
        ftp.storbinary("STOR " + name, io.BytesIO(data))
        return True
    except ftplib.all_errors as e:
        log(f"      STOR شکست: {type(e).__name__}")
        return False


def delete_here(ftp, name: str) -> None:
    try:
        ftp.delete(name)
    except ftplib.all_errors:
        pass


def write_output(directory: str) -> None:
    directory = normalize_dir(directory)
    log(f"✅ docroot زنده پیدا شد: {directory}")
    log(f"DISCOVERED_DIR={directory}")
    note(f"docroot زنده = {directory}")
    with open("discovered-ftp-dir.txt", "w", encoding="utf-8") as fh:
        fh.write(directory + "\n")
    if GITHUB_OUTPUT:
        with open(GITHUB_OUTPUT, "a", encoding="utf-8") as fh:
            fh.write(f"dir={directory}\n")
    if GITHUB_STEP_SUMMARY:
        with open(GITHUB_STEP_SUMMARY, "a", encoding="utf-8") as fh:
            fh.write(f"### کشف docroot استیجینگ\n\n`{directory}`\n")


def emit_override(directory: str) -> int:
    write_output(directory)
    return 0


def unique_candidates(pwd: str, listing: list[str]) -> list[str]:
    staging_like = []
    others = []
    for n in listing:
        low = n.lower()
        if any(k in low for k in ("stag", "stage", "test", "pishtaj-stage")):
            staging_like.append(n)
        elif low in ("public_html", "www", "htdocs", "httpdocs", "web", "html"):
            others.append(n)

    ordered: list[str] = []

    def add(p: str) -> None:
        p = (p or "").strip()
        if not p:
            ordered.append(".")  # login dir
            return
        if p not in ordered:
            ordered.append(p)

    # ۱) مسیرهایی که اسم استیجینگ دارند (کم‌خطر برای پروداکشن)
    for n in staging_like:
        add(n)
        add(n + "/public_html")
        if pwd and pwd not in ("/", "."):
            add(pwd.rstrip("/") + "/" + n)

    add("staging.pishtaj.ir")
    add("staging.pishtaj.ir/public_html")
    add("/staging.pishtaj.ir/")
    add("/staging.pishtaj.ir/public_html/")
    add("domains/staging.pishtaj.ir/public_html")
    add("/domains/staging.pishtaj.ir/public_html/")
    add("pishtaj-stage")
    add("/pishtaj-stage/")
    add("staging")
    add("/staging/")
    add("public_html/staging")
    add("/public_html/staging/")

    add("/home/cp46861/staging.pishtaj.ir/")
    add("/home/cp46861/staging.pishtaj.ir/public_html/")
    add("/home/cp46861/domains/staging.pishtaj.ir/public_html/")
    add("/home/cp46861/public_html/staging/")
    add("/home/cp46861/pishtaj-stage/")

    # ۲) خودِ سکرت (می‌دانیم زنده نیست، ولی برای تأیید نگه می‌داریم)
    if SECRET_DIR:
        add(SECRET_DIR)
        tail = SECRET_DIR.strip("/").split("/")[-1]
        if tail:
            add(tail)

    # ۳) پوشهٔ ورود — اگر اکانت اختصاصی استیجینگ باشد، همین docroot است
    add(".")
    add("/")
    if pwd:
        add(pwd)

    # ۴) public_html و مشابه — ممکن است پروداکشن باشد؛ قناری روی PROD_URL رد می‌شود
    for n in others:
        add(n)
    add("public_html")
    add("/public_html/")
    add("/home/cp46861/public_html/")
    add("/home/cp46861/domains/pishtaj.ir/public_html/")

    # یکتا با نرمال‌سازی سبک
    seen = set()
    out = []
    for c in ordered:
        key = c if c in (".", "/") else normalize_dir(c)
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def probe(ftp, origin: str, dest: str) -> str | None:
    """قناری را در dest می‌گذارد. برمی‌گرداند: 'staging' | 'prod' | None."""
    if not cwd_to(ftp, dest, origin):
        return None
    if not stor(ftp, CANARY_NAME, CANARY_BODY):
        try:
            ftp.cwd(origin or ".")
        except ftplib.all_errors:
            pass
        return None
    time.sleep(1.5)
    on_live = http_has_token(f"{LIVE_URL}/{CANARY_NAME}")
    on_prod = http_has_token(f"{PROD_URL}/{CANARY_NAME}")
    delete_here(ftp, CANARY_NAME)
    try:
        ftp.cwd(origin or ".")
    except ftplib.all_errors:
        pass
    if on_prod and not on_live:
        log(f"   ✗ {dest} → پروداکشن (رد شد)")
        return "prod"
    if on_live and on_prod:
        log(f"   ✗ {dest} → هر دو دامنه (docroot مشترک؟ رد شد تا پرود دست نخورد)")
        return "prod"
    if on_live:
        log(f"   ✓ {dest} → استیجینگ زنده")
        return "staging"
    log(f"   · {dest} → قناری روی HTTP ظاهر نشد")
    return None


def main() -> int:
    if OVERRIDE:
        log(f"مسیر دستی داده شد — کشف رد شد: {OVERRIDE}")
        return emit_override(OVERRIDE)

    if not HOST_RAW or not USER or not PASS:
        err("سکرت‌های FTP ناقص‌اند (FTP_SERVER / FTP_USERNAME / FTP_PASSWORD)")
        return 1

    host = host_of(HOST_RAW)
    log(f"کشف docroot برای {LIVE_URL}  (هاست FTP={host})")
    log(f"سکرت فعلی FTP_SERVER_DIR={SECRET_DIR or '<خالی>'}")
    note(f"expect live={LIVE_URL} secret={SECRET_DIR or '<empty>'} canary={CANARY_NAME}")

    try:
        ftp, _tls = try_connect(host)
    except RuntimeError as e:
        err(str(e))
        return 1

    try:
        origin = safe_pwd(ftp) or "."
        listing = safe_nlst(ftp)
        log(f"   PWD={origin}")
        log("   LIST=" + (" ".join(listing[:30]) if listing else "<خوانده نشد>"))
        note(f"PWD={origin} LIST={', '.join(listing[:20]) or '<none>'}")

        candidates = unique_candidates(origin if origin != "." else "", listing)
        log(f"   {len(candidates)} مسیر نامزد")

        for dest in candidates:
            log(f"→ آزمایش {dest!r}")
            try:
                result = probe(ftp, origin, dest)
            except ftplib.all_errors as e:
                log(f"   استثنا: {type(e).__name__}")
                try:
                    ftp.cwd(origin or ".")
                except ftplib.all_errors:
                    pass
                continue
            if result == "staging":
                # مسیر را به شکلی که SamKirkland می‌فهمد برگردان
                if dest in (".", ""):
                    found = origin if origin not in ("", ".") else "/"
                else:
                    found = dest
                write_output(found)
                return 0
    finally:
        try:
            ftp.quit()
        except Exception:
            try:
                ftp.close()
            except Exception:
                pass

    err(
        "هیچ مسیر FTP به docroot زندهٔ استیجینگ نرسید. "
        "سکرت FTP_SERVER_DIR را در Settings → Secrets روی مسیر واقعی "
        "vhostِ staging.pishtaj.ir بگذارید (مثلاً /staging.pishtaj.ir/ "
        "یا /public_html/ برای اکانت چرت‌شدهٔ اختصاصی) و دوباره اجرا کنید."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
