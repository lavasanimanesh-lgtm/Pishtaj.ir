#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — تحلیل‌گر لینک داخلی + تشخیص محتوای نزدیک‌به‌تکراری
======================================================
خروجی:
  _audit/SEO-LINKGRAPH-<date>.csv   inbound/outbound هر صفحه
  _audit/SEO-DUP-PAIRS-<date>.csv   جفت‌های مشکوک به تکرار
  stdout                            خلاصه

استفاده:
  python3 _tools/seo_linkgraph.py
"""
from __future__ import annotations

import csv
import os
import re
import sys
from collections import defaultdict
from datetime import date
from itertools import combinations

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seo_audit_local import (  # noqa: E402
    ROOT, collect_pages, word_count, strip_tags, RE_SCRIPT, page_url_variants,
)

RE_A = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\']', re.I)
RE_TITLE = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
STOP = re.compile(r'^(و|در|به|از|با|برای|که|این|آن|را|است|های|هایی|یک|هم|یا|تا|بر|پس|پیش|روی|زیر|بالا|همه|هر|چه|چیست|چی|نیز|شود|می|خواهد|دارد|دارند|باشد|کند|استفاده|باشند|شامل|باشد|گردد|صورت|مورد|بیشتر|کمتر|بسیار|جلوگیری|انجام)\b')


def norm_url(href: str, base_dir: str) -> str:
    """تبدیل href به مسیر فایل مقصد (یا '' اگر داخلی نیست)."""
    h = href.split('#')[0].strip()
    if not h or h.startswith(('mailto:', 'tel:', 'javascript:', 'data:', 'sms:')):
        return ''
    if h.startswith('http'):
        if 'pishtaj.ir' not in h:
            return ''
        h = re.sub(r'^https?://(www\.)?pishtaj\.ir/?', '', h)
        if not h:
            return 'index.html'
        return h.lstrip('/')
    if h.startswith('/'):
        return h.lstrip('/') or 'index.html'
    # نسبی
    p = os.path.normpath(os.path.join(base_dir, h)).replace(os.sep, '/').lstrip('./')
    return p or 'index.html'


def resolve(target: str, pages: set) -> str:
    """رساندن مسیر به یک فایل موجود (index.html پوشه / پسوند .html)."""
    cands = [target, target + '/index.html',
             target.rstrip('/') + '/index.html',
             (target + '.html') if not target.endswith('.html') else target]
    for c in cands:
        if c in pages:
            return c
    return ''


def text_shingles(path: str, k: int = 5) -> set:
    with open(path, encoding='utf-8', errors='ignore') as f:
        html = f.read()
    body = html
    m = re.search(r'<body[^>]*>(.*)</body>', html, re.I | re.S)
    if m:
        body = m.group(1)
    body = RE_SCRIPT.sub(' ', body)
    txt = strip_tags(body)
    txt = re.sub(r'[^\w\u0600-\u06FF\s]', ' ', txt)
    words = [w for w in txt.split() if len(w) > 1 and not STOP.match(w)]
    return {tuple(words[i:i + k]) for i in range(max(0, len(words) - k + 1))}


def main():
    pages_list = collect_pages()
    pages = set(pages_list)
    base = {p: os.path.dirname(p) for p in pages_list}
    titles = {}
    words = {}
    for p in pages_list:
        with open(os.path.join(ROOT, p), encoding='utf-8', errors='ignore') as f:
            s = f.read()
        m = RE_TITLE.search(s)
        titles[p] = re.sub(r'\s+', ' ', strip_tags(m.group(1))).strip() if m else ''
        words[p] = word_count(s)

    inbound = defaultdict(set)
    outbound = defaultdict(set)
    for p in pages_list:
        with open(os.path.join(ROOT, p), encoding='utf-8', errors='ignore') as f:
            html = f.read()
        for m in RE_A.finditer(html):
            t = resolve(norm_url(m.group(1), base[p]), pages)
            if not t or t == p:
                continue
            outbound[p].add(t)
            inbound[t].add(p)

    rows = []
    for p in pages_list:
        rows.append({
            'file': p,
            'url': 'https://pishtaj.ir/' + p,
            'folder': p.split('/')[0] if '/' in p else '(ریشه)',
            'title': titles[p],
            'words': words[p],
            'inbound': len(inbound[p]),
            'outbound': len(outbound[p]),
        })
    rows.sort(key=lambda r: (r['inbound'], -r['words']))

    out = os.path.join(ROOT, '_audit', 'SEO-LINKGRAPH-%s.csv' % date.today().isoformat())
    with open(out, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    orphans = [r for r in rows if r['inbound'] == 0]
    weak = [r for r in rows if 0 < r['inbound'] <= 2]

    print('=' * 78)
    print('تحلیل لینک داخلی — %s' % date.today().isoformat())
    print('=' * 78)
    print('تعداد صفحات: %d' % len(rows))
    print('میانگین لینک ورودی: %.1f' % (sum(r['inbound'] for r in rows) / len(rows)))
    print('میانگین لینک خروجی: %.1f' % (sum(r['outbound'] for r in rows) / len(rows)))
    print('صفحات یتیم (۰ لینک ورودی): %d  (%.0f%%)' % (len(orphans), len(orphans) * 100 / len(rows)))
    print('صفحات ضعیف (۱–۲ لینک ورودی): %d' % len(weak))
    print()
    print('--- یتیم‌ها (نمونهٔ ۲۵ تای اول بر اساس حجم محتوا) ---')
    for r in sorted(orphans, key=lambda x: -x['words'])[:25]:
        print('  %-58s %5d واژه | %s' % (r['file'][:58], r['words'], r['title'][:42]))
    print()
    print('--- پربازدیدترین مقاصد لینک (Hubها) ---')
    for r in sorted(rows, key=lambda x: -x['inbound'])[:15]:
        print('  %-58s %4d لینک ورودی' % (r['file'][:58], r['inbound']))
    print()
    from collections import Counter
    c = Counter(r['folder'] for r in orphans)
    print('--- یتیم‌ها بر اساس پوشه ---')
    for k, v in c.most_common():
        tot = sum(1 for r in rows if r['folder'] == k)
        print('  %-24s %4d از %4d  (%.0f%%)' % (k, v, tot, v * 100 / max(tot, 1)))

    # ---------- تشخیص محتوای نزدیک‌به‌تکراری (با حذف بویلرپلیت) ----------
    print()
    print('=' * 78)
    print('تحلیل محتوای منحصربه‌فرد (حذف قالب مشترک) + تشخیص تکرار')
    print('=' * 78)
    sh = {}
    for p in pages_list:
        try:
            sh[p] = text_shingles(os.path.join(ROOT, p))
        except Exception:
            sh[p] = set()

    # بسامد سند (DF) هر ۵-واژه در کل سایت
    df = defaultdict(int)
    for p, S_ in sh.items():
        for g in S_:
            df[g] += 1
    n_docs = max(len(sh), 1)
    boiler = {g for g, c in df.items() if c / n_docs > 0.25}
    print('قالب مشترک (بویلرپلیت): %d قطعهٔ ۵-واژه که در >۲۵٪ صفحات آمده' % len(boiler))

    uniq = {p: (S_ - boiler) for p, S_ in sh.items()}
    rows_u = []
    for p in pages_list:
        allg = len(sh[p]) or 1
        rows_u.append({
            'file': p,
            'url': 'https://pishtaj.ir/' + p,
            'folder': p.split('/')[0] if '/' in p else '(ریشه)',
            'title': titles[p],
            'words': words[p],
            'unique_shingles': len(uniq[p]),
            'unique_share': round(len(uniq[p]) / allg, 3),
            'inbound': len(inbound[p]),
        })
    rows_u.sort(key=lambda r: r['unique_shingles'])

    out_u = os.path.join(ROOT, '_audit', 'SEO-UNIQUE-CONTENT-%s.csv' % date.today().isoformat())
    with open(out_u, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(rows_u[0].keys()))
        w.writeheader()
        w.writerows(rows_u)

    thin_u = [r for r in rows_u if r['unique_shingles'] < 250]
    print()
    print('--- محتوای واقعاً کم (کمتر از ~۲۵۰ قطعهٔ منحصربه‌فرد ≈ زیر ۳۰۰ واژهٔ خاص صفحه) ---')
    print('تعداد: %d  (%.0f%% از کل)' % (len(thin_u), len(thin_u) * 100 / len(rows_u)))
    for r in thin_u[:25]:
        print('  %-56s %5d یکتا (%d%% از صفحه) | %5d واژه کل'
              % (r['file'][:56], r['unique_shingles'], round(r['unique_share'] * 100), r['words']))
    from collections import Counter
    c2 = Counter(r['folder'] for r in thin_u)
    print('  توزیع بر اساس پوشه:', dict(c2.most_common(6)))

    # جفت‌های مشکوک روی محتوای یکتا
    pairs = []
    by_folder = defaultdict(list)
    for p in pages_list:
        if uniq[p]:
            by_folder[p.split('/')[0] if '/' in p else '(ریشه)'].append(p)
    for folder, items in by_folder.items():
        if len(items) > 300:
            items = items[:300]
        for a, b in combinations(items, 2):
            A, B = uniq[a], uniq[b]
            if not A or not B:
                continue
            inter = len(A & B)
            if inter < 15:
                continue
            j = inter / len(A | B)
            if j >= 0.20:
                pairs.append((j, a, b, inter))
    pairs.sort(reverse=True)
    dup_out = os.path.join(ROOT, '_audit', 'SEO-DUP-PAIRS-%s.csv' % date.today().isoformat())
    with open(dup_out, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['شباهت_محتوای_یکتا', 'فایل الف', 'فایل ب', 'عنوان الف', 'عنوان ب',
                    'یکتای الف', 'یکتای ب', 'لینک_ورودی_الف', 'لینک_ورودی_ب'])
        for j, a, b, inter in pairs:
            w.writerow([round(j, 3), a, b, titles[a], titles[b],
                        len(uniq[a]), len(uniq[b]), len(inbound[a]), len(inbound[b])])
    print()
    print('--- جفت‌های مشکوک به تکرار/تداخل (روی محتوای یکتا، ≥۲۰٪) ---')
    print('تعداد: %d' % len(pairs))
    for j, a, b, inter in pairs[:25]:
        print('  %.0f%%  %-42s ↔ %s' % (j * 100, a[:42], b[:42]))

    print()
    print('خروجی‌ها:')
    print('  %s' % os.path.relpath(out, ROOT))
    print('  %s' % os.path.relpath(out_u, ROOT))
    print('  %s' % os.path.relpath(dup_out, ROOT))
    print('=' * 78)
    return 0


if __name__ == '__main__':
    sys.exit(main())
