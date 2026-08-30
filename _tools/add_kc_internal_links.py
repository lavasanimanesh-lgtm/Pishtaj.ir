#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — ایجاد لینک‌سازی داخلیِ استاتیک در مرکز دانش
=================================================
مشکل (کشف‌شده در ممیزی ۲۰۲۶-۰۸-۳۰):
  • هابِ knowledge-center/index.html لینک مقالات را فقط با JavaScript می‌سازد
    (آرایه‌ای ~۳۰۳تایی → '<a href="'+a[1]+'">'). خزنده‌های غیررندرکننده و
    خزنده‌هایی با بودجهٔ کم (دامنهٔ کم‌اعتبار) این لینک‌ها را نمی‌بینند.
  • از ۴۵۳ مقاله، ۱۵۰ تا اصلاً در آن آرایه نیستند؛ ۱۴۵ صفحه از کل سایت
    «یتیم»اند (هیچ لینک ورودیِ استاتیکی از هیچ صفحه‌ای ندارند).

راهکار این اسکریپت (افزایشی و بدون دست‌زدن به محتوای موجود):
  ۱) هاب: یک فهرست استاتیکِ واقعی (<a href>) از همهٔ مقالات، قبل از فوتر.
  ۲) هر مقالهٔ یتیم: یک بلوک «مطالب مرتبط» با ۶ لینکِ هم‌موضوع (بر اساس
     هم‌پوشانی واژگانِ نامک/عنوان) — قبل از فوتر.

اجرا:
  python3 _tools/add_kc_internal_links.py            # پیش‌نمایش (تغییری نمی‌دهد)
  python3 _tools/add_kc_internal_links.py --apply    # اعمال
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KC = os.path.join(ROOT, 'knowledge-center')
HUB = os.path.join(KC, 'index.html')
MARKER = 'data-ptf-related="1"'
RELATED_N = 6

RE_TITLE = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
RE_H1 = re.compile(r'<h1[^>]*>(.*?)</h1>', re.I | re.S)
STOP = {
    'guide', 'html', 'kc', 'industrial', 'equipment', 'and', 'the', 'در', 'برای',
    'با', 'از', 'به', 'و', 'راهنمای', 'کامل', 'صنعتی', 'تجهیزات',
}


def clean(s: str) -> str:
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\s*\|\s*پیشرو تجهیز فرتاک\s*$', '', s)
    return s


def slug_tokens(name: str) -> set:
    toks = re.split(r'[-_.]', name.replace('.html', ''))
    return {t for t in toks if len(t) > 2 and t not in STOP}


_BY_NAME = {}


def by_name(fn: str) -> dict:
    return _BY_NAME.get(fn, {'file': fn, 'title': fn.replace('.html', ''), 'tokens': set()})


def load_articles() -> list:
    out = []
    for fn in sorted(os.listdir(KC)):
        if not fn.endswith('.html') or fn == 'index.html':
            continue
        with open(os.path.join(KC, fn), encoding='utf-8', errors='ignore') as f:
            s = f.read()
        m = RE_H1.search(s) or RE_TITLE.search(s)
        title = clean(m.group(1)) if m else fn.replace('.html', '')
        out.append({'file': fn, 'title': title, 'tokens': slug_tokens(fn)})
    return out


def related(target: dict, articles: list, n: int = RELATED_N) -> list:
    scored = []
    for a in articles:
        if a['file'] == target['file']:
            continue
        inter = len(target['tokens'] & a['tokens'])
        if inter == 0:
            continue
        union = len(target['tokens'] | a['tokens']) or 1
        scored.append((inter / union, inter, a['file'], a))
    scored.sort(key=lambda x: (-x[0], -x[1], x[2]))
    picked = [x[3] for x in scored[:n]]
    if len(picked) < n:
        # راهکار جایگزین برای نامک‌های کوتاه/بی‌هم‌موضوع: همسایه‌های الفبایی
        names = [a['file'] for a in articles]
        try:
            i = names.index(target['file'])
        except ValueError:
            i = 0
        ring = [names[(i + k) % len(names)] for k in range(1, len(names))]
        have = {a['file'] for a in picked} | {target['file']}
        for nm in ring:
            if len(picked) >= n:
                break
            if nm in have:
                continue
            picked.append(by_name(nm))
            have.add(nm)
    return picked


def block_for(target: dict, articles: list, hub_list: bool = False) -> str:
    if hub_list:
        items = articles
        head = 'فهرست کامل مقالات مرکز دانش'
    else:
        items = related(target, articles)
        head = 'مطالب مرتبط در مرکز دانش'
    if not items:
        return ''
    lis = '\n'.join(
        '        <li style="margin:0"><a href="%s" style="color:#334155;text-decoration:none;'
        'border-bottom:1px solid #e2e8f0;padding:5px 0;display:block;line-height:1.7">%s</a></li>'
        % (a['file'], a['title'][:120]) for a in items)
    return (
        '\n<section %s class="ptf-related" style="max-width:1100px;margin:0 auto;padding:34px 20px 6px">\n'
        '  <h2 style="font-size:17px;color:#0f172a;margin:0 0 14px;padding-bottom:8px;'
        'border-bottom:2px solid #ef4b1a;display:inline-block">%s</h2>\n'
        '  <ul style="list-style:none;padding:0;margin:0;display:grid;gap:0;'
        'grid-template-columns:repeat(auto-fill,minmax(260px,1fr));'
        'column-gap:26px;font-size:13.5px">\n%s\n  </ul>\n</section>\n'
        % (MARKER, head, lis)
    )


def insert_before_footer(html: str, block: str) -> str:
    idx = html.rfind('<footer')
    if idx == -1:
        return ''
    return html[:idx] + block + html[idx:]


def apply(do_write: bool) -> int:
    articles = load_articles()
    by_file = {a['file']: a for a in articles}
    _BY_NAME.update(by_file)
    print('تعداد مقالات: %d' % len(articles))

    changed = 0

    # ۱) هاب
    with open(HUB, encoding='utf-8') as f:
        hub = f.read()
    if MARKER in hub:
        print('  هاب: قبلاً اصلاح شده — رد شد')
    else:
        blk = block_for({'file': 'index.html', 'title': 'هاب', 'tokens': set()},
                        articles, hub_list=True)
        new = insert_before_footer(hub, blk)
        if not new:
            print('  هاب: anchor <footer> پیدا نشد — رد شد')
        else:
            if do_write:
                with open(HUB, 'w', encoding='utf-8') as f:
                    f.write(new)
            print('  هاب: فهرست استاتیک %d مقاله اضافه شد' % len(articles))
            changed += 1

    # ۲) مقالات یتیم (بدون لینک ورودی استاتیک)
    orphans = []
    try:
        import csv
        g = os.path.join(ROOT, '_audit')
        cands = sorted([f for f in os.listdir(g) if f.startswith('SEO-LINKGRAPH-') and f.endswith('.csv')], reverse=True)
        if cands:
            with open(os.path.join(g, cands[0]), encoding='utf-8-sig') as f:
                for r in csv.DictReader(f):
                    if r['folder'] == 'knowledge-center' and int(r['inbound'] or 0) == 0:
                        orphans.append(os.path.basename(r['file']))
    except Exception as e:
        print('  خطا در خواندن گراف لینک:', e)
    orphans = [o for o in orphans if o in by_file and o != 'index.html']
    print('مقالات یتیم (۰ لینک ورودی): %d' % len(orphans))
    for fn in orphans:
        p = os.path.join(KC, fn)
        with open(p, encoding='utf-8') as f:
            s = f.read()
        if MARKER in s:
            continue
        blk = block_for(by_file[fn], articles)
        if not blk:
            print('  %s: مرتبطی پیدا نشد — رد شد' % fn)
            continue
        new = insert_before_footer(s, blk)
        if not new:
            print('  %s: anchor پیدا نشد — رد شد' % fn)
            continue
        if do_write:
            with open(p, 'w', encoding='utf-8') as f:
                f.write(new)
        changed += 1
    print('تعداد فایل‌های تغییریافته: %d' % changed)
    if not do_write:
        print('\n⚠️ این یک پیش‌نمایش بود. برای اعمال: --apply')
    return changed


if __name__ == '__main__':
    sys.exit(0 if apply('--apply' in sys.argv) >= 0 else 1)
