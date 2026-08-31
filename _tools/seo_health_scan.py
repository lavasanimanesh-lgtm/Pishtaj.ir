#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seo_health_scan.py — ممیزیِ سلامتِ سئوی تک‌تکِ صفحاتِ عمومی سایت

هدف
---
پیش از این، وضعیتِ h1/عنوان/توضیح/canonical/اسکما تنها به‌صورتِ موردی و دستی چک
می‌شد. این ابزار همان بررسی‌ها را روی **همهٔ صفحاتِ عمومی** اجرا می‌کند و یک CSV
قابلِ فیلتر می‌سازد تا کارِ اصلاح، داده‌محور باشد نه حدسی.

بررسی‌ها
--------
 1. h1: تعداد (باید دقیقاً ۱) و طولِ متن
 2. <title>: طول در بازهٔ ۳۰–۶۵ کاراکتر
 3. meta description: وجود + طول در بازهٔ ۷۰–۱۶۵
 4. canonical: وجود، خودارجاعی (با نشانیِ واقعیِ فایل)، و تکراری نبودن در کل سایت
 5. hreflang / OG / Twitter
 6. JSON-LD: انواعِ @type موجود
 7. لینکِ ورودیِ داخلی (صفحهٔ یتیم = هیچ صفحهٔ دیگری به آن لینک نداده)
 8. متنِ یکتا برای صفحاتِ مرکز دانش (معیارِ kc_consolidate: حذفِ قالبِ مشترک)
 9. عنوانِ تکراری بین صفحات (نشانهٔ هم‌نوع‌خواری/کنیبالیزیشن)

اجرا:
    python3 _tools/seo_health_scan.py            # فقط گزارش
    python3 _tools/seo_health_scan.py --csv      # نوشتنِ _audit/SEO-HEALTH-SCAN-<date>.csv

هیچ فایلی از سایت تغییر نمی‌کند؛ این ابزار فقط می‌خواند.
"""
import os
import re
import csv
import sys
import glob
import collections
from html.parser import HTMLParser
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://pishtaj.ir"

EXCLUDE_DIRS = (
    "crm/", "api/", "_tools/", "_audit/", "node_modules/", "ptf-all-photos/",
    "ptf-snapshots/", "tools/", "docs/", "docs-deploy/", "service-photos/",
    "_human_test/", "_personas/", "en/",
)

TITLE_MIN, TITLE_MAX = 30, 65
DESC_MIN, DESC_MAX = 70, 165


def public_pages():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)):
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        if rel.startswith("."):
            continue
        parts = rel.split("/")
        if any((p + "/") in EXCLUDE_DIRS for p in parts[:-1]):
            continue
        out.append((rel, path))
    return out


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


class _TagBalance(HTMLParser):
    """توازنِ تگ‌های باز/بسته — markup نامعتبر را پیدا می‌کند.

    مرورگرها `<p>` باز را پیش از عنصرِ بلوکی خودکار می‌بندند، پس این ایرادها
    نمایش را خراب نمی‌کنند؛ اما پارسرهای سخت‌گیر (استخراجِ متن برای RAG، برخی
    خزنده‌ها) مرزِ پاراگراف را اشتباه می‌گیرند. در ممیزیِ ۲۰۲۶-۰۸-۳۱، ۱۱۴ صفحه
    این ایراد را داشتند و با `_tools/fix_unclosed_p.py` بسته شدند.
    """

    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
            "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = 0

    def handle_starttag(self, tag, attrs):
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif self.stack:
            self.errors += 1
            while self.stack and self.stack.pop() != tag:
                pass


def markup_problems(html):
    """شمارِ ناهنجاری‌های markup: جفتِ نابجا + تگِ بازِ مانده."""
    chk = _TagBalance()
    chk.feed(html)
    return chk.errors + len(chk.stack)


def head_of(html):
    return html.split("</head>")[0] if "</head>" in html else html[:8000]


def expected_url(rel):
    u = rel
    if u.endswith("index.html"):
        u = u[: -len("index.html")]
    return SITE + "/" + u


def scan():
    pages = public_pages()
    page_set = {rel for rel, _ in pages}
    inbound = collections.Counter()
    rows = []

    # گذرِ اول: خواندنِ همهٔ صفحات + شمارشِ لینک‌های ورودی
    cache = {}
    for rel, path in pages:
        html = open(path, encoding="utf-8", errors="replace").read()
        cache[rel] = html
        base_dir = os.path.dirname(rel)
        for href in re.findall(r'(?i)href="([^"]+)"', html):
            if href.startswith(("http://", "https://", "mailto:", "tel:", "#", "javascript:")):
                if href.startswith(SITE):
                    href = href[len(SITE):].lstrip("/")
                else:
                    continue
            href = href.split("#")[0].split("?")[0]
            if not href:
                continue
            # href ریشه‌مطلق («/logistics/») نسبت به ریشهٔ سایت است نه پوشهٔ جاری.
            # os.path.join در آن حالت مسیرِ جاری را دور می‌ریزد و normpath اسلشِ
            # نخست را نگه می‌دارد («/logistics»)، پس نگاشتِ زیر کار نمی‌کرد.
            if href.startswith("/"):
                base = href.lstrip("/")
            else:
                base = os.path.join(base_dir, href)
            target = os.path.normpath(base).replace(os.sep, "/") if base else ""
            # normpath اسلشِ پایانی را برمی‌دارد («about/» → «about») و ریشه «/» می‌ماند؛
            # بدونِ این نگاشت، لینکِ پوشه‌ها و صفحهٔ اصلی همیشه صفر شمرده می‌شد.
            if target in ("", "/"):
                target = "index.html"
            elif target + "/index.html" in page_set:
                target = target + "/index.html"
            inbound[target] += 1

    uniq = {}
    if any(r.startswith("knowledge-center/") for r, _ in pages):
        try:
            sys.path.insert(0, os.path.join(ROOT, "_tools"))
            import kc_consolidate  # noqa
            uniq = kc_consolidate.unique_chars()
        except Exception as e:  # اندازه‌گیریِ متنِ یکتا اختیاری است
            print("هشدار: اندازه‌گیریِ متنِ یکتا ممکن نشد: %s" % e)

    # فهرستِ صفحاتی که در .htaccess ریدایرکت ۳۰۱ دارند (canonicalِ آن‌ها به مقصد اشاره می‌کند
    # و این رفتارِ درستِ ادغام است، نه ایراد)
    redirected = set()
    ht = os.path.join(ROOT, ".htaccess")
    if os.path.exists(ht):
        for m in re.finditer(r'(?m)^\s*RewriteRule\s+"?\^?([^\s"]+?)\\?\.html\$"?\s',
                             open(ht, encoding="utf-8", errors="replace").read()):
            redirected.add(os.path.basename(
                m.group(1).replace("\\-", "-").replace("\\.", ".").lstrip("^")))

    canon_seen = collections.Counter()
    for rel, _ in pages:
        canon = re.search(r'rel="canonical"\s+href="([^"]+)"', cache[rel])
        if canon:
            canon_seen[canon.group(1)] += 1

    title_seen = collections.Counter()
    for rel, _ in pages:
        t = re.search(r"(?is)<title>(.*?)</title>", cache[rel])
        if t:
            title_seen[strip_tags(t.group(1))] += 1

    # گذرِ دوم: بررسیِ تک‌تکِ صفحات
    for rel, _ in pages:
        html = cache[rel]
        head = head_of(html)
        flags = []

        h1s = re.findall(r"(?is)<h1[^>]*>(.*?)</h1>", html)
        h1_txt = strip_tags(h1s[0]) if h1s else ""
        if len(h1s) == 0:
            flags.append("بدون h1")
        elif len(h1s) > 1:
            flags.append("%d h1" % len(h1s))
        if h1s and len(h1_txt) < 12:
            flags.append("h1 خیلی کوتاه")

        t = re.search(r"(?is)<title>(.*?)</title>", html)
        title = strip_tags(t.group(1)) if t else ""
        if not t:
            flags.append("بدون title")
        elif not (TITLE_MIN <= len(title) <= TITLE_MAX):
            flags.append("طولِ عنوان %d" % len(title))
        if title and title_seen[title] > 1:
            flags.append("عنوانِ تکراری با %d صفحه" % title_seen[title])

        d = re.search(r'name="description"\s+content="([^"]*)"', head)
        desc = d.group(1) if d else ""
        if not d:
            flags.append("بدون description")
        elif not (DESC_MIN <= len(desc) <= DESC_MAX):
            flags.append("طولِ توضیح %d" % len(desc))

        slug = os.path.basename(rel)[:-5]
        canon = re.search(r'rel="canonical"\s+href="([^"]+)"', head)
        canon_val = canon.group(1) if canon else ""
        # صفحهٔ ۴۰۴ عمداً canonical و لینکِ ورودی ندارد؛ این دو برای آن پرچمِ کاذب‌اند
        is_404 = rel == "404.html"
        if not canon:
            if not is_404:
                flags.append("بدون canonical")
        else:
            if canon_val != expected_url(rel):
                if slug in redirected:
                    flags.append("canonical به مقصدِ ادغام (انتظار می‌رود)")
                else:
                    flags.append("canonical غیرِخودارجاع (ایراد)")
            if canon_seen[canon_val] > 1:
                flags.append("canonical مشترک با %d صفحه" % canon_seen[canon_val])

        hreflang = len(re.findall(r'rel="alternate"', head))
        og = len(re.findall(r'property="og:', head))
        tw = len(re.findall(r'name="twitter:', head))
        if og < 3:
            flags.append("OG ناقص (%d)" % og)
        if tw == 0:
            flags.append("بدون Twitter card")
        # بودنِ کارت بدونِ تصویر، پیش‌نمایشِ لینک را در تلگرام/لینکدین/ابزارهای AI
        # بی‌تصویر می‌کند؛ این دو پرچم پیش‌تر وجود نداشتند و ۱۲۷ صفحه از قلم افتاده بود.
        if og >= 3 and 'property="og:image"' not in head:
            flags.append("OG بدون تصویر")
        if tw > 0 and 'name="twitter:image"' not in head:
            flags.append("Twitter card بدون تصویر")
        mp = markup_problems(html)
        if mp:
            flags.append("markup نامعتبر (%d)" % mp)

        types = sorted(set(re.findall(
            r'"@type"\s*:\s*"?([A-Za-z]+)',
            " ".join(re.findall(r'application/ld\+json"[^>]*>(.*?)</script>', html, re.S)))))
        if not types:
            flags.append("بدون JSON-LD")

        ins = inbound.get(rel, 0)
        if rel.endswith("index.html"):
            ins += inbound.get(rel[: -len("index.html")], 0) + inbound.get(rel[:-1], 0)
        if ins == 0 and not rel.endswith(("index.html",)) and not is_404:
            flags.append("یتیم (۰ لینک ورودی)")

        utext = uniq.get(slug, "") if rel.startswith("knowledge-center/") else ""
        if utext != "" and utext < 400:
            flags.append("متنِ یکتا %d" % utext)

        rows.append({
            "فایل": rel,
            "h1": len(h1s),
            "طول_h1": len(h1_txt),
            "عنوان": title,
            "طول_عنوان": len(title),
            "طول_توضیح": len(desc),
            "canonical": canon_val,
            "canonical_خودارجاع": "بله" if canon_val == expected_url(rel) else "خیر",
            "hreflang": hreflang,
            "og": og,
            "twitter": tw,
            "json_ld": "|".join(types),
            "لینک_ورودی": ins,
            "متن_یکتا": utext,
            "پرچم‌ها": " · ".join(flags),
        })
    return rows


def main():
    rows = scan()
    flags = collections.Counter()
    for r in rows:
        for f in [re.sub(r"\s*\(?[0-9۰-۹]+\)?$", "", x) for x in r["پرچم‌ها"].split(" · ") if x]:
            flags[f] += 1

    print("صفحاتِ عمومیِ بررسی‌شده: %d" % len(rows))
    clean = sum(1 for r in rows if not r["پرچم‌ها"])
    print("بدونِ هیچ پرچمی: %d (%.1f%%)" % (clean, 100.0 * clean / max(1, len(rows))))
    print("\nپرچم‌ها (تعداد صفحات):")
    for k, v in flags.most_common():
        print("  %-24s %d" % (k, v))

    print("\nنمونه صفحاتِ دارای پرچم:")
    shown = 0
    for r in rows:
        if r["پرچم‌ها"]:
            print("  %-58s %s" % (r["فایل"][:58], r["پرچم‌ها"][:90]))
            shown += 1
            if shown >= 20:
                break

    if "--csv" in sys.argv:
        # تاریخِ تهران (UTC+3:30) — هم‌راستا با نام‌گذاریِ سندهای _audit در این مخزن
        tehran = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3, minutes=30)))
        out = os.path.join(ROOT, "_audit", "SEO-HEALTH-SCAN-%s.csv" % tehran.date().isoformat())
        with open(out, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print("\nCSV نوشته شد: %s" % os.path.relpath(out, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
