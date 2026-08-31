#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — اصلاحِ طولِ عنوان و توضیحِ متا (بدون دست‌زدن به محتوا)
==========================================================
قوانین:
  عنوانِ بلند (>۶۵): ابتدا پسوندِ برند کوتاه می‌شود
      «| پیشرو تجهیز فرتاک» → «| پیشرو تجهیز» → «| پیشرو»
      (و برای صفحات انگلیسی «| Pishro Tajhiz Fartak (PTF)» → «| Pishro Tajhiz» → «| PTF»)
      اگر باز هم بلند بود، بخش موضوعی در مرزِ واژه کوتاه می‌شود.
  عنوانِ کوتاه (<۳۰): از نگاشتِ دستی (TITLE_FIX) که زیر همین فایل است.
  توضیحِ بلند (>۱۶۵): در مرزِ بند (؛ — . ،) بریده می‌شود و با «…» تمام می‌شود؛
      حداقل ۷۰ کاراکتر و نیمی از متن حفظ می‌شود تا معنا از دست نرود.

 فقط تگ <title> و <meta name="description"> تغییر می‌کنند؛ بقیهٔ فایل بایت‌به‌بایت دست‌نخورده می‌ماند.

اجرا:
  python3 _tools/fix_meta_lengths.py            # پیش‌نمایش
  python3 _tools/fix_meta_lengths.py --apply    # اعمال
"""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TITLE_MAX, TITLE_MIN = 65, 30
DESC_MAX = 165

RE_TITLE = re.compile(r'(<title[^>]*>)(.*?)(</title>)', re.I | re.S)
RE_DESC = re.compile(r'(<meta\s+name=["\']description["\']\s+content=["\'])(.*?)(["\']\s*/?>)', re.I | re.S)

# نگاشتِ دستی برای عنوان‌های بیش از حد کوتاه (با شناختِ موضوعِ هر صفحه)
TITLE_FIX = {
    'careers/index.html': 'استخدام و فرصت‌های شغلی | پیشرو تجهیز فرتاک',
    'knowledge-center/api-610.html': 'استاندارد API 610 پمپ‌های سانتریفیوژ | پیشرو تجهیز فرتاک',
    'knowledge-center/api-617.html': 'استاندارد API 617 کمپرسورهای محوری | پیشرو تجهیز فرتاک',
    'knowledge-center/astm-a105.html': 'ASTM A105 متریال فلنج و اتصالات فورج | پیشرو تجهیز فرتاک',
    'knowledge-center/en-10204.html': 'گواهی EN 10204 و تفاوت نوع 3.1 و 3.2 | پیشرو تجهیز فرتاک',
    'knowledge-center/float-vibrating-capacitance.html': 'سوئیچ سطح صنعتی؛ انواع و انتخاب | پیشرو تجهیز فرتاک',
    'knowledge-center/lv-iec-61439.html': 'تابلو فشار ضعیف LV و استاندارد IEC 61439 | پیشرو تجهیز فرتاک',
    'knowledge-center/mv-iec-62271.html': 'تابلو فشار متوسط MV و استاندارد IEC 62271 | پیشرو تجهیز فرتاک',
    'knowledge-center/sf6.html': 'کلید قدرت SF6 و تجهیزات فشار قوی | پیشرو تجهیز فرتاک',
    'knowledge-center/ups-online-line-interactive.html': 'UPS صنعتی؛ انواع و راهنمای انتخاب | پیشرو تجهیز فرتاک',
}

SUFFIXES_FA = [' | پیشرو تجهیز فرتاک', ' | پیشرو تجهیز', ' | پیشرو']
SUFFIXES_EN = [' | Pishro Tajhiz Fartak (PTF)', ' | Pishro Tajhiz Fartak', ' | Pishro Tajhiz', ' | PTF']


def esc_amp(s: str) -> str:
    return re.sub(r'&(?!(?:[A-Za-z][A-Za-z0-9]*|#\d+|#x[0-9A-Fa-f]+);)', '&amp;', s)


DANGLING = re.compile(r'[\s|،؛]+(?:(?:و|یا|در|با|برای|از|به|تا|بر)\s*)+$')


def clip(s: str, limit: int = TITLE_MAX) -> str:
    """برش در مرز واژه + حذفِ حروف‌اضافه/حروف‌عطفِ ناقصِ انتهایی."""
    cut = s[:limit]
    idx = cut.rfind(' ')
    if idx > TITLE_MIN:
        cut = cut[:idx]
    cut = DANGLING.sub('', cut)
    return cut.rstrip(' |،؛—-').strip()


def shorten_title(t: str) -> str:
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= TITLE_MAX:
        return t
    is_en = not re.search(r'[\u0600-\u06FF]', t)
    suffixes = SUFFIXES_EN if is_en else SUFFIXES_FA

    # ۱) اگر پسوندِ برند دارد: پسوند کوتاه‌تر → حذف پسوند
    for old in suffixes:
        if t.endswith(old):
            base = t[: -len(old)].rstrip(' |،')
            cands = [base + suf for suf in suffixes[1:]] + [base]
            for cand in cands:
                if TITLE_MIN <= len(cand) <= TITLE_MAX:
                    return cand
            c = clip(base)
            if c:
                return c
            break

    # ۲) جداکنندهٔ «|» دارد: بخش دوم را می‌اندازیم (اگر بخش اول کامل و کافی باشد)
    if ' | ' in t:
        p, _q = t.rsplit(' | ', 1)
        p = p.rstrip(' |،')
        if TITLE_MIN <= len(p) <= TITLE_MAX:
            return p
        c = clip(t)
        if TITLE_MIN <= len(c):
            return c
        return p[:TITLE_MAX]

    # ۳) برش ساده در مرز واژه
    return clip(t) or t[:TITLE_MAX]


def trim_desc(d: str) -> str:
    d = re.sub(r'\s+', ' ', d).strip()
    if len(d) <= DESC_MAX:
        return d
    target = DESC_MAX - 1  # جا برای «…»
    for sep in ['؛', ' — ', '.', '،']:
        idx = d.rfind(sep, 0, target)
        if idx <= 0:
            continue
        head = DANGLING.sub('', d[:idx]).rstrip(' ؛،.…-—')
        if len(head) >= 70 and len(head) >= 0.45 * len(d):
            return head + '…'
    cut = d[:target]
    idx = cut.rfind(' ')
    if idx > 70:
        cut = cut[:idx]
    return DANGLING.sub('', cut).rstrip(' ؛،.…-—') + '…'


def process(path: str, apply: bool, stats: dict, samples: list):
    with open(path, encoding='utf-8') as f:
        s = f.read()
    orig = s

    def repl_title(m):
        old = m.group(2)
        new = TITLE_FIX.get(rel) if rel in TITLE_FIX else shorten_title(old)
        if new == old:
            return m.group(0)
        stats['title'] += 1
        if len(samples) < 12:
            samples.append(('title', rel, old, new))
        return m.group(1) + esc_amp(new) + m.group(3)

    def repl_desc(m):
        old = m.group(2)
        new = trim_desc(old)
        if new == old:
            return m.group(0)
        stats['desc'] += 1
        if len(samples) < 24:
            samples.append(('desc', rel, old, new))
        return m.group(1) + esc_amp(new) + m.group(3)

    rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
    s = RE_TITLE.sub(repl_title, s, count=1)
    s = RE_DESC.sub(repl_desc, s, count=1)

    if s != orig:
        if apply:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(s)
        stats['files'] += 1


def main():
    apply = '--apply' in sys.argv
    stats = {'files': 0, 'title': 0, 'desc': 0}
    samples: list = []

    stack = ['']
    skip = {'.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
            '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots',
            'ptf-all-photos', 'service-photos', '.github', '.well-known'}
    pages = []
    while stack:
        d = stack.pop()
        absd = ROOT if d == '' else os.path.join(ROOT, d)
        for e in sorted(os.listdir(absd)):
            rel = e if d == '' else d + '/' + e
            if os.path.isdir(os.path.join(absd, e)):
                if e not in skip and not e.startswith('.'):
                    stack.append(rel)
            elif e.endswith('.html') and e not in {'sitemap.html'}:
                pages.append(rel)
    for rel in sorted(pages):
        process(os.path.join(ROOT, rel), apply, stats, samples)

    print('=' * 70)
    print('اصلاح طول عنوان/توضیح — %s' % ('اعمال شد' if apply else 'پیش‌نمایش'))
    print('=' * 70)
    print('فایل‌های تغییریافته: %d' % stats['files'])
    print('عنوان اصلاح‌شده: %d | توضیح اصلاح‌شده: %d' % (stats['title'], stats['desc']))
    print()
    for kind, rel, old, new in samples:
        print('— [%s] %s' % ('عنوان' if kind == 'title' else 'توضیح', rel))
        print('    قبل (%d): %s' % (len(old), old[:150]))
        print('    بعد (%d): %s' % (len(new), new[:150]))
    if not apply:
        print()
        print('⚠️ پیش‌نمایش — برای اعمال: python3 _tools/fix_meta_lengths.py --apply')


if __name__ == '__main__':
    main()
