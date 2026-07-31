#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_tools/rewrite/add_og_tags.py
افزودن تگ‌های og: استاندارد به مقالاتی که <title>/<meta description>/<canonical>
دارند اما فاقد OG tags هستند. مقادیر از همان title/description/canonical موجود
استخراج می‌شود (بدون تغییر محتوای اصلی صفحه).
"""
import re
import os
import json
import html

SITE = "https://pishtaj.ir"
KC = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "knowledge-center")


def process_file(path, dry_run=True):
    c = open(path, encoding="utf-8", errors="ignore").read()

    if "og:title" in c:
        return None  # already has OG tags, skip

    m_canon = re.search(r'<link rel="canonical" href="([^"]+)"\s*/?>', c)
    m_title = re.search(r"<title>([^<]*)</title>", c)
    m_desc = re.search(r'<meta name="description" content="([^"]*)"\s*/?>', c)

    if not (m_canon and m_title and m_desc):
        return "PATTERN_MISMATCH"

    canonical = m_canon.group(1)
    title_full = html.unescape(m_title.group(1)).strip()
    description = html.unescape(m_desc.group(1)).strip()

    # og:title معمولاً بدون بخش «| پیشرو تجهیز فرتاک» انتهایی است (مشابه الگوی مقالات جدید)
    og_title = re.sub(r"\s*\|\s*پیشرو تجهیز فرتاک\s*$", "", title_full).strip()
    if not og_title:
        og_title = title_full

    og_block = (
        f'<meta property="og:locale" content="fa_IR" />'
        f'<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />'
        f'<meta property="og:title" content="{html.escape(og_title, quote=True)}" />'
        f'<meta property="og:description" content="{html.escape(description, quote=True)}" />'
        f'<meta property="og:type" content="article" />'
        f'<meta property="og:url" content="{canonical}" />'
        f'<meta property="og:image" content="{SITE}/assets/images/ptf-logo.png" />'
        f'<meta name="twitter:card" content="summary_large_image" />'
    )

    # درج بلافاصله بعد از تگ canonical (قبل از JSON-LD script یا هر چیز دیگر)
    canon_full_match = re.search(r'<link rel="canonical" href="[^"]+"\s*/?>', c)
    insert_pos = canon_full_match.end()
    new_c = c[:insert_pos] + og_block + c[insert_pos:]

    if not dry_run:
        open(path, "w", encoding="utf-8").write(new_c)

    return "OK"


def main(dry_run=True):
    results = json.load(open("/tmp/kc_quality_audit.json", encoding="utf-8"))
    targets = [r["file"] for r in results if not r["og"] and r["words"] >= 800]

    ok_count = 0
    mismatch = []
    for f in targets:
        path = os.path.join(KC, f)
        status = process_file(path, dry_run=dry_run)
        if status == "OK":
            ok_count += 1
        elif status == "PATTERN_MISMATCH":
            mismatch.append(f)

    print(f"Processed: {len(targets)}  OK: {ok_count}  Mismatch: {len(mismatch)}")
    if mismatch:
        for f in mismatch:
            print("  MISMATCH:", f)
    return ok_count, mismatch


if __name__ == "__main__":
    import sys
    main(dry_run="--apply" not in sys.argv)
