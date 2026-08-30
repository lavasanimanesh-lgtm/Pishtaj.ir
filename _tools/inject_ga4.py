#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — تزریقِ بارگذارِ GA4 به همهٔ صفحات عمومی
=============================================
یک خطِ <script defer src=".../assets/js/ptf-analytics.js"> را پیش از </body>
در همهٔ صفحات عمومی می‌گذارد.

نکته‌ها:
  • مسیرِ اسکریپت برای هر صفحه به‌صورت نسبی ساخته می‌شود (سازگار با استقرار
    در زیرپوشه، درست مثل الگوی '../assets/' که در کل سایت استفاده شده).
  • تکرارپذیر است: اگر تگ قبلاً در صفحه باشد، دوباره درج نمی‌شود.
  • خودِ شناسه در assets/js/ptf-analytics.js است؛ برای تغییرِ شناسه نیازی
    به اجرای دوبارهٔ این اسکریپت نیست.

اجرا:
  python3 _tools/inject_ga4.py            # پیش‌نمایش
  python3 _tools/inject_ga4.py --apply    # اعمال
  python3 _tools/inject_ga4.py --remove   # حذف (اگر لازم شد)
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNIPPET_REL = 'assets/js/ptf-analytics.js'
MARK = SNIPPET_REL

SKIP_DIRS = {
    '.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
    '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots',
    'ptf-all-photos', 'service-photos', '.github', '.well-known',
}
SKIP_FILES = {'sitemap.html'}


def public_pages():
    out = []
    stack = ['']
    while stack:
        d = stack.pop()
        absd = ROOT if d == '' else os.path.join(ROOT, d)
        try:
            entries = sorted(os.listdir(absd))
        except OSError:
            continue
        for e in entries:
            rel = e if d == '' else d + '/' + e
            if os.path.isdir(os.path.join(absd, e)):
                if e not in SKIP_DIRS and not e.startswith('.'):
                    stack.append(rel)
                continue
            if not e.endswith('.html') or e in SKIP_FILES:
                continue
            out.append(rel)
    return sorted(out)


def snippet_for(rel: str) -> str:
    depth = rel.count('/')
    prefix = '../' * depth
    return '<script defer src="%s%s"></script>\n' % (prefix, SNIPPET_REL)


def main():
    do_apply = '--apply' in sys.argv
    do_remove = '--remove' in sys.argv
    pages = public_pages()
    changed = removed = already = 0

    for rel in pages:
        p = os.path.join(ROOT, rel)
        with open(p, encoding='utf-8') as f:
            s = f.read()
        if do_remove:
            if MARK not in s:
                continue
            lines = s.split('\n')
            lines = [l for l in lines if MARK not in l]
            with open(p, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            removed += 1
            continue

        if MARK in s:
            already += 1
            continue
        idx = s.rfind('</body>')
        if idx == -1:
            print('  ⚠️ </body> ندارد — رد شد:', rel)
            continue
        snip = snippet_for(rel)
        s = s[:idx] + snip + s[idx:]
        if do_apply:
            with open(p, 'w', encoding='utf-8') as f:
                f.write(s)
        changed += 1

    print('تعداد صفحات بررسی‌شده: %d' % len(pages))
    if do_remove:
        print('حذف‌شده: %d' % removed)
    else:
        print('درج‌شده: %d | از قبل داشت: %d' % (changed, already))
        if not do_apply:
            print('\n⚠️ پیش‌نمایش — برای اعمال: python3 _tools/inject_ga4.py --apply')
    return 0


if __name__ == '__main__':
    sys.exit(main())
