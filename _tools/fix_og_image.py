#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""افزودنِ og:image / twitter:image به صفحاتی که کارتِ اجتماعی دارند ولی تصویر ندارند.

چرا این ابزار لازم است
----------------------
ممیزیِ سلامتِ سئو (`_tools/seo_health_scan.py`) تعدادِ تگ‌های og: را می‌شمارد و تنها
وقتی کمتر از ۳ باشد پرچم می‌زند؛ به همین دلیل «OG ناقص» صفر گزارش می‌شد در حالی که
۱۲۷ صفحهٔ عمومی og:image نداشتند. بدونِ og:image، پیش‌نمایشِ لینک در تلگرام، واتس‌اپ،
لینکدین و ابزارهای مبتنی بر هوش مصنوعی بدونِ تصویر نشان داده می‌شود.

قاعدهٔ ایمنی (همان قاعدهٔ `_tools/fix_page_head_seo.py`)
--------------------------------------------------------
۱) فقط افزودنی: هیچ تگِ موجودی بازنویسی یا حذف نمی‌شود.
۲) بت‌وان (idempotent): اجرای دوم هیچ تغییری ایجاد نمی‌کند.
۳) نگهبانِ موجودیِ head: اگر شمارِ هر یک از canonical/hreflang/og/twitter/ldjson/
   title/description حتی یکی کم شود، نوشتن انجام نمی‌شود.
۴) تصویر، همان فایلی است که ۳۸۹ صفحهٔ دیگرِ سایت هم‌اکنون استفاده می‌کنند و روی
   دیسک موجود است (assets/images/ptf-logo.png).

اجرا:  python3 _tools/fix_og_image.py            (پیش‌نمایش)
       python3 _tools/fix_og_image.py --apply    (نوشتن)
"""
from __future__ import annotations

import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

IMAGE = "https://pishtaj.ir/assets/images/ptf-logo.png"

EXCLUDED_PREFIXES = (
    "crm/", "api/", "_tools/", "_audit/", "node_modules/", "ptf-all-photos/",
    "ptf-snapshots/", "tools/", "docs/", "docs-deploy/", "service-photos/",
    "_human_test/", "_personas/", "en/",
)

OG_TAG = '<meta property="og:image" content="%s" />' % IMAGE
TW_TAG = '<meta name="twitter:image" content="%s" />' % IMAGE


def head_inventory(text: str) -> dict:
    """شمارش عناصر حساسِ head — نگهبانِ «چیزی حذف نشود»."""
    head = text.split("</head>")[0] if "</head>" in text else text[:6000]
    return {
        "canonical": len(re.findall(r'rel="canonical"', head)),
        "hreflang": len(re.findall(r'rel="alternate"', head)),
        "og": len(re.findall(r'property="og:', head)),
        "twitter": len(re.findall(r'name="twitter:', head)),
        "ldjson": len(re.findall(r'<script\s+type="application/ld\+json"', head)),
        "title": len(re.findall(r"<title>", head)),
        "desc": len(re.findall(r'name="description"', head)),
        "h1": len(re.findall(r"(?i)<h1[\s>]", text)),
    }


def insert_after_last(text: str, pattern: str, tag: str, indent: str = "") -> str | None:
    """تگ را پس از آخرین تطابقِ `pattern` در head درج می‌کند.

    تورفتگیِ خطِ همان تگ فقط در صورتی استفاده می‌شود که پیش از آن، تنها فاصلهٔ سفید
    باشد؛ در head های فشرده (بدونِ شکستِ خط) تورفتگی خالی می‌ماند. اگر این شرط
    رعایت نشود، کلِ متنِ پیش از تگ به‌عنوانِ «تورفتگی» تکرار می‌شود.
    """
    head_end = text.find("</head>")
    scope = text[:head_end] if head_end != -1 else text
    matches = list(re.finditer(pattern, scope))
    if not matches:
        return None
    last = matches[-1]
    line_end = scope.find("\n", last.end())
    if line_end == -1:
        line_end = len(scope)
    line_start = scope.rfind("\n", 0, last.start()) + 1
    lead = scope[line_start:last.start()]
    ind = lead if lead.strip() == "" else indent
    return text[:line_end] + "\n" + ind + tag + text[line_end:]


def fix_file(path: str) -> tuple[str, list[str]]:
    """فایل را اصلاح می‌کند؛ متنِ جدید و فهرستِ تغییرات را برمی‌گرداند."""
    src = open(path, encoding="utf-8").read()
    before = head_inventory(src)
    head = src.split("</head>")[0] if "</head>" in src else src[:6000]
    changes: list[str] = []
    text = src

    if 'property="og:' in head and 'property="og:image"' not in head:
        new = insert_after_last(text, r'property="og:[a-z_]+"', OG_TAG, "")
        if new is None:
            new = insert_after_last(text, r'name="description"', OG_TAG, "")
        if new is not None:
            text = new
            changes.append("og:image")

    if 'name="twitter:' in head and 'name="twitter:image"' not in head:
        new = insert_after_last(text, r'name="twitter:[a-z_]+"', TW_TAG, "")
        if new is not None:
            text = new
            changes.append("twitter:image")

    if text == src:
        return src, []

    after = head_inventory(text)
    lost = {k: (before[k], after[k]) for k in before if after[k] < before[k]}
    if lost:
        raise SystemExit("نگهبان: افتِ عنصر در headِ %s → %s" % (path, lost))
    # افزوده‌شده باید دقیقاً همان تعدادِ تغییرات باشد
    if after["og"] - before["og"] != changes.count("og:image"):
        raise SystemExit("نگهبان: شمارِ og هم‌خوان نیست در %s" % path)
    if after["twitter"] - before["twitter"] != changes.count("twitter:image"):
        raise SystemExit("نگهبان: شمارِ twitter هم‌خوان نیست در %s" % path)
    return text, changes


def main() -> int:
    apply = "--apply" in sys.argv
    touched = 0
    og_added = 0
    tw_added = 0
    for path in sorted(glob.glob("**/*.html", recursive=True)):
        if any(path.startswith(p) for p in EXCLUDED_PREFIXES):
            continue
        text, changes = fix_file(path)
        if not changes:
            continue
        touched += 1
        og_added += changes.count("og:image")
        tw_added += changes.count("twitter:image")
        if apply:
            open(path, "w", encoding="utf-8").write(text)
        print("%-58s + %s" % (path, "، ".join(changes)))

    print("-" * 72)
    print("صفحات: %d | og:image افزوده: %d | twitter:image افزوده: %d  (%s)"
          % (touched, og_added, tw_added, "نوشته شد" if apply else "پیش‌نمایش"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
