#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# ftp-upload-tree.py — آپلود درخت workspace به یک مسیر FTP (جبران docroot)
#
# همان excludeهای ورک‌فلو استیجینگ. چند اتصال موازی برای سرعت.
# env: FTP_SERVER FTP_USERNAME FTP_PASSWORD
# args: --dir /path/on/server/  [--src .]  [--workers 4]
# ═══════════════════════════════════════════════════════════════════════════
from __future__ import annotations

import argparse
import ftplib
import os
import ssl
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "_audit",
    "_human_test",
    "_personas",
    "_tools",
    "ptf-all-photos",
    "service-photos",
    "ptf-snapshots",
    "docs-deploy",
}


def host_of(raw: str) -> str:
    h = (raw or "").strip()
    for p in ("ftps://", "ftp://", "https://", "http://"):
        if h.lower().startswith(p):
            h = h[len(p) :]
    h = h.split("/")[0]
    if ":" in h:
        h = h.split(":")[0]
    return h


def skip_rel(rel: str) -> bool:
    parts = rel.replace("\\", "/").split("/")
    if any(p in EXCLUDE_DIRS or p.startswith(".git") for p in parts):
        return True
    base = parts[-1] if parts else ""
    if base.endswith(".md") or base.endswith(".zip"):
        return True
    if base.startswith("tester") and base.endswith(".js"):
        return True
    if base.startswith("FILES-CHANGED-"):
        return True
    if base.startswith(".ftp-state"):
        return True
    if base in (".gitattributes", ".gitignore"):
        return True
    return False


def collect(src: str) -> list[str]:
    out = []
    src = os.path.abspath(src)
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".git")]
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, src).replace("\\", "/")
            if skip_rel(rel):
                continue
            out.append(rel)
    out.sort()
    return out


def connect(host: str, user: str, password: str, tls: bool):
    if tls:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ftp = ftplib.FTP_TLS(context=ctx)
        ftp.connect(host, 21, timeout=40)
        ftp.login(user, password)
        try:
            ftp.prot_p()
        except ftplib.all_errors:
            pass
        ftp.set_pasv(True)
        ftp.encoding = "utf-8"
        return ftp
    ftp = ftplib.FTP()
    ftp.connect(host, 21, timeout=40)
    ftp.login(user, password)
    ftp.set_pasv(True)
    ftp.encoding = "utf-8"
    return ftp


def ensure_cwd(ftp, dest: str) -> None:
    dest = dest.replace("\\", "/").strip()
    if dest in ("", ".", "/"):
        try:
            if dest == "/":
                ftp.cwd("/")
        except ftplib.all_errors:
            pass
        return
    try:
        ftp.cwd(dest)
        return
    except ftplib.all_errors:
        pass
    if dest.startswith("/"):
        try:
            ftp.cwd("/")
        except ftplib.all_errors:
            pass
        parts = dest.strip("/").split("/")
    else:
        parts = dest.strip("/").split("/")
    for part in parts:
        if not part:
            continue
        try:
            ftp.cwd(part)
        except ftplib.all_errors:
            try:
                ftp.mkd(part)
            except ftplib.all_errors:
                pass
            ftp.cwd(part)


def chdir_rel(ftp, origin: str, rel_dir: str, cache: set[str]) -> None:
    ftp.cwd(origin)
    if not rel_dir or rel_dir in (".", "/"):
        return
    acc: list[str] = []
    for part in rel_dir.replace("\\", "/").split("/"):
        if not part:
            continue
        acc.append(part)
        key = "/".join(acc)
        try:
            ftp.cwd(part)
            cache.add(key)
            continue
        except ftplib.all_errors:
            pass
        try:
            ftp.mkd(part)
        except ftplib.all_errors:
            pass
        ftp.cwd(part)
        cache.add(key)


def upload_batch(
    host: str,
    user: str,
    password: str,
    tls: bool,
    dest_root: str,
    src: str,
    rels: list[str],
    worker_id: int,
) -> tuple[int, int]:
    ftp = connect(host, user, password, tls)
    ok = fail = 0
    cache: set[str] = set()
    try:
        ensure_cwd(ftp, dest_root)
        origin = ftp.pwd()
        for i, rel in enumerate(rels, 1):
            local = os.path.join(src, rel)
            remote_dir = os.path.dirname(rel).replace("\\", "/")
            name = os.path.basename(rel)
            try:
                chdir_rel(ftp, origin, remote_dir, cache)
                with open(local, "rb") as fh:
                    ftp.storbinary("STOR " + name, fh)
                ok += 1
            except Exception as e:
                fail += 1
                print(f"   ⛔ [{worker_id}] {rel}: {type(e).__name__}: {e}", flush=True)
            if i % 50 == 0:
                print(f"   … worker {worker_id}: {i}/{len(rels)} (ok={ok} fail={fail})", flush=True)
    finally:
        try:
            ftp.quit()
        except Exception:
            try:
                ftp.close()
            except Exception:
                pass
    return ok, fail


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="مسیر مقصد روی FTP")
    ap.add_argument("--src", default=".", help="ریشهٔ محلی")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    host = host_of(os.environ.get("FTP_SERVER") or "")
    user = os.environ.get("FTP_USERNAME") or ""
    password = os.environ.get("FTP_PASSWORD") or ""
    if not host or not user or not password:
        print("⛔ سکرت‌های FTP ناقص‌اند", flush=True)
        return 1

    src = os.path.abspath(args.src)
    files = collect(src)
    print(f"آپلود {len(files)} فایل از {src} → {args.dir}  (workers={args.workers})", flush=True)
    if not files:
        print("⛔ فایلی برای آپلود نیست", flush=True)
        return 1

    # یک اتصال آزمایشی: TLS سپس plain
    tls = True
    try:
        t = connect(host, user, password, True)
        t.quit()
    except Exception:
        tls = False
        t = connect(host, user, password, False)
        t.quit()
    print(f"   پروتکل: {'TLS' if tls else 'plain'}", flush=True)

    workers = max(1, min(args.workers, 6))
    chunks: list[list[str]] = [[] for _ in range(workers)]
    for i, rel in enumerate(files):
        chunks[i % workers].append(rel)

    t0 = time.time()
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [
            pool.submit(upload_batch, host, user, password, tls, args.dir, src, chunk, idx)
            for idx, chunk in enumerate(chunks)
            if chunk
        ]
        for fut in as_completed(futs):
            o, f = fut.result()
            ok += o
            fail += f

    dt = time.time() - t0
    print(f"پایان آپلود: ok={ok} fail={fail}  در {dt:.0f}s", flush=True)
    return 0 if fail == 0 and ok > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
