#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — SEO Technical Auditor (local / offline)
=============================================
ممیزی فنی سئو روی فایل‌های HTML مخزن (بدون نیاز به اینترنت).

خروجی:
  _audit/SEO-AUDIT-DATA-<date>.csv   ← جدول کامل هر صفحه
  stdout                             ← خلاصهٔ آماری + فهرست مشکلات اولویت‌دار

استفاده:
  python3 _tools/seo_audit_local.py
  python3 _tools/seo_audit_local.py --json _audit/seo-audit-data.json
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# پوشه‌هایی که نباید ایندکس شوند / جزو سایت عمومی نیستند
EXCLUDE_DIRS = {
    '.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
    '_personas', 'docs-deploy', 'ptf-snapshots', 'ptf-all-photos', 'service-photos',
    'docs', 'assets', '.github', '.well-known', 'snapshots',
}
EXCLUDE_FILES = {'404.html', 'sitemap.html'}

TITLE_MIN, TITLE_MAX = 30, 65          # طول مناسب عنوان (کاراکتر)
DESC_MIN, DESC_MAX = 70, 165           # طول مناسب توضیح متا
THIN_WORDS = 350                       # آستانهٔ محتوای کم‌حجم

RE_TITLE = re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S)
RE_DESC = re.compile(
    r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>', re.I | re.S)
RE_DESC_ALT = re.compile(
    r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']\s*/?>', re.I | re.S)
RE_ROBOTS = re.compile(
    r'<meta\s+name=["\']robots["\']\s+content=["\'](.*?)["\']\s*/?>', re.I | re.S)
RE_CANON = re.compile(r'<link\s+[^>]*rel=["\']canonical["\'][^>]*>', re.I | re.S)
RE_HREF = re.compile(r'href=["\']([^"\']+)["\']')
RE_H1 = re.compile(r'<h1[^>]*>(.*?)</h1>', re.I | re.S)
RE_HN = re.compile(r'<h([1-6])[^>]*>(.*?)</h\1>', re.I | re.S)
RE_IMG = re.compile(r'<img\b[^>]*>', re.I | re.S)
RE_ALT = re.compile(r'\balt=["\']([^"\']*)["\']', re.I | re.S)
RE_SCRIPT = re.compile(r'<(script|style|noscript|template)\b[^>]*>.*?</\1>', re.I | re.S)
RE_TAG = re.compile(r'<[^>]+>')
RE_LDJSON = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)
RE_HREFLANG = re.compile(r'hreflang=["\']([^"\']+)["\']', re.I)
RE_VIEWPORT = re.compile(r'<meta\s+name=["\']viewport["\']', re.I)
RE_LANG = re.compile(r'<html[^>]*\blang=["\']([^"\']+)["\']', re.I)
RE_SITEMAP_LOC = re.compile(r'<loc>\s*(.*?)\s*</loc>', re.I | re.S)


def strip_tags(html: str) -> str:
    return RE_TAG.sub(' ', html)


def word_count(html: str) -> int:
    """شمارش واژگان متن قابل‌مشاهده (فارسی/انگلیسی)."""
    body = html
    m = re.search(r'<body[^>]*>(.*)</body>', body, re.I | re.S)
    if m:
        body = m.group(1)
    body = RE_SCRIPT.sub(' ', body)
    text = strip_tags(body)
    text = re.sub(r'&[a-z#0-9]+;', ' ', text, flags=re.I)
    words = re.findall(r'[\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u06A9\u06BE\u200c]+|[A-Za-z][A-Za-z\-]{1,}', text)
    return len(words)


def meta_desc(html: str) -> str:
    head = html.split('</head>')[0] if '</head>' in html else html[:20000]
    m = RE_DESC.search(head) or RE_DESC_ALT.search(head)
    return (m.group(1).strip() if m else '')


def canonical(html: str) -> str:
    head = html.split('</head>')[0] if '</head>' in html else html[:20000]
    m = RE_CANON.search(head)
    if not m:
        return ''
    h = RE_HREF.search(m.group(0))
    return (h.group(1) if h else '')


def robots_meta(html: str) -> str:
    head = html.split('</head>')[0] if '</head>' in html else html[:20000]
    m = RE_ROBOTS.search(head)
    return (m.group(1).strip().lower() if m else '')


def schema_types(html: str) -> list:
    out = []
    for m in RE_LDJSON.finditer(html):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        if isinstance(data, dict) and '@graph' in data:
            items = data['@graph']
        for it in items:
            if isinstance(it, dict) and it.get('@type'):
                t = it['@type']
                out.extend(t if isinstance(t, list) else [t])
    seen, uniq = set(), []
    for t in out:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq


def internal_links(html: str) -> tuple:
    """تعداد لینک‌های داخلیِ نسبی/سایت (شامل لنگرها و فایل‌ها نیست)."""
    n = 0
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\']', html, re.I):
        h = m.group(1)
        if h.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'http')):
            if h.startswith('https://pishtaj.ir'):
                n += 1
            continue
        if h.startswith('/') or h.endswith('.html') or ('.' not in h.rstrip('/').split('/')[-1]):
            n += 1
    return n


def collect_pages() -> list:
    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith('.')]
        rel_dir = os.path.relpath(dirpath, ROOT)
        if rel_dir == '.':
            rel_dir = ''
        for fn in filenames:
            if not fn.endswith('.html') or fn in EXCLUDE_FILES:
                continue
            rel = os.path.join(rel_dir, fn).replace(os.sep, '/')
            pages.append(rel)
    return sorted(pages)


def page_url_variants(rel: str) -> list:
    """URLهای محتمل یک فایل HTML (آدرس فایل + آدرس پوشه برای index.html)."""
    urls = ['https://pishtaj.ir/' + rel]
    if rel.endswith('/index.html'):
        urls.append('https://pishtaj.ir/' + rel[:-len('index.html')])
    if rel == 'index.html':
        urls.append('https://pishtaj.ir/')
    return urls


def url_to_rel(url: str) -> list:
    """تبدیل URL سایت به مسیر(های) محتمل فایل در مخزن."""
    rel = re.sub(r'^https?://(www\.)?pishtaj\.ir/', '', url.strip())
    cands = [rel.lstrip('/')]
    if rel.endswith('/'):
        cands.append((rel + 'index.html').lstrip('/'))
    else:
        cands.append((rel + '/index.html').lstrip('/'))
    return [c for c in cands if c]


def sitemap_urls() -> dict:
    """نگاشت URL → نام sitemap، از sitemap-index.xml (و sitemap.xml اگر بود)."""
    out = {}
    idx = os.path.join(ROOT, 'sitemap-index.xml')
    files = []
    if os.path.exists(idx):
        with open(idx, encoding='utf-8') as f:
            files = [u for u in RE_SITEMAP_LOC.findall(f.read()) if u.endswith('.xml')]
    for u in files:
        local = u.replace('https://pishtaj.ir/', '').replace('http://pishtaj.ir/', '')
        p = os.path.join(ROOT, local)
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8', errors='ignore') as f:
            for loc in RE_SITEMAP_LOC.findall(f.read()):
                out[loc.strip()] = local
    # sitemap.xml قدیمی (که cms.php به آن اضافه می‌کند)
    legacy = os.path.join(ROOT, 'sitemap.xml')
    if os.path.exists(legacy):
        with open(legacy, encoding='utf-8', errors='ignore') as f:
            for loc in RE_SITEMAP_LOC.findall(f.read()):
                out.setdefault(loc.strip(), 'sitemap.xml (قدیمی)')
    return out


def audit_page(rel: str, smap: dict) -> dict:
    path = os.path.join(ROOT, rel)
    with open(path, encoding='utf-8', errors='ignore') as f:
        html = f.read()
    url = 'https://pishtaj.ir/' + rel
    title_m = RE_TITLE.search(html)
    title = re.sub(r'\s+', ' ', strip_tags(title_m.group(1))).strip() if title_m else ''
    desc = re.sub(r'\s+', ' ', meta_desc(html)).strip()
    can = canonical(html)
    rob = robots_meta(html)
    h1s = [re.sub(r'\s+', ' ', strip_tags(x)).strip() for x in RE_H1.findall(html)]
    heads = RE_HN.findall(html)
    h2 = sum(1 for lvl, _ in heads if lvl == '2')
    imgs = RE_IMG.findall(html)
    no_alt = 0
    for im in imgs:
        a = RE_ALT.search(im)
        if not a or not a.group(1).strip():
            no_alt += 1
    words = word_count(html)
    sch = schema_types(html)
    smaps = ''
    for u in page_url_variants(rel):
        if u in smap:
            smaps = smap[u]
            break
    issues = []
    if not title:
        issues.append('no-title')
    else:
        if len(title) < TITLE_MIN:
            issues.append('title-short')
        if len(title) > TITLE_MAX:
            issues.append('title-long')
    if not desc:
        issues.append('no-desc')
    else:
        if len(desc) < DESC_MIN:
            issues.append('desc-short')
        if len(desc) > DESC_MAX:
            issues.append('desc-long')
    if not can:
        issues.append('no-canonical')
    elif can.rstrip('/') != url.rstrip('/') and can.rstrip('/') != url.replace('/index.html', '').rstrip('/'):
        issues.append('canonical-mismatch')
    if not h1s:
        issues.append('no-h1')
    elif len(h1s) > 1:
        issues.append('multi-h1')
    if 'noindex' in rob:
        issues.append('noindex')
    if words < THIN_WORDS:
        issues.append('thin-content')
    if no_alt:
        issues.append('img-no-alt')
    if not smaps:
        issues.append('not-in-sitemap')
    if not sch:
        issues.append('no-schema')
    if not RE_VIEWPORT.search(html):
        issues.append('no-viewport')
    return {
        'file': rel,
        'url': url,
        'folder': rel.split('/')[0] if '/' in rel else '(ریشه)',
        'title': title,
        'title_len': len(title),
        'desc': desc,
        'desc_len': len(desc),
        'canonical': can,
        'robots': rob,
        'h1': (h1s[0] if h1s else ''),
        'h1_count': len(h1s),
        'h2_count': h2,
        'words': words,
        'images': len(imgs),
        'img_no_alt': no_alt,
        'internal_links': internal_links(html),
        'schema': '|'.join(sch),
        'hreflang': '|'.join(sorted(set(RE_HREFLANG.findall(html)))),
        'lang': (RE_LANG.search(html).group(1) if RE_LANG.search(html) else ''),
        'sitemap': smaps,
        'size_kb': round(os.path.getsize(path) / 1024, 1),
        'issues': '|'.join(issues),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', default='')
    ap.add_argument('--csv', default='')
    args = ap.parse_args()

    smap = sitemap_urls()
    pages = collect_pages()
    rows = [audit_page(p, smap) for p in pages]

    out_csv = args.csv or os.path.join(
        ROOT, '_audit', 'SEO-AUDIT-DATA-%s.csv' % date.today().isoformat())
    os.makedirs(os.path.dirname(out_csv), exist_ok=True)
    cols = list(rows[0].keys())
    with open(out_csv, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=1)

    # ---------- خلاصه ----------
    n = len(rows)
    def cnt(cond):
        return sum(1 for r in rows if cond(r))

    from collections import Counter, defaultdict
    iss = Counter()
    for r in rows:
        for i in r['issues'].split('|'):
            if i:
                iss[i] += 1
    per_folder = defaultdict(lambda: {'n': 0, 'words': 0, 'sitemap': 0, 'thin': 0})
    for r in rows:
        d = per_folder[r['folder']]
        d['n'] += 1
        d['words'] += r['words']
        d['sitemap'] += 1 if r['sitemap'] else 0
        d['thin'] += 1 if 'thin-content' in r['issues'] else 0

    dup_title = defaultdict(list)
    dup_desc = defaultdict(list)
    for r in rows:
        if r['title']:
            dup_title[r['title']].append(r['file'])
        if r['desc']:
            dup_desc[r['desc']].append(r['file'])
    dup_t = {k: v for k, v in dup_title.items() if len(v) > 1}
    dup_d = {k: v for k, v in dup_desc.items() if len(v) > 1}

    file_set = {r['file'] for r in rows}
    smap_only = []
    for u in sorted(smap.keys()):
        cands = url_to_rel(u)
        if not any(c in file_set for c in cands):
            smap_only.append(u)

    print('=' * 78)
    print('گزارش ممیزی فنی سئو — pishtaj.ir — %s' % date.today().isoformat())
    print('=' * 78)
    print('تعداد صفحات عمومی بررسی‌شده: %d' % n)
    print('تعداد URL در sitemapها: %d' % len(smap))
    print('میانگین واژگان هر صفحه: %.0f' % (sum(r['words'] for r in rows) / max(n, 1)))
    print()
    print('--- فراوانی مشکلات (تعداد صفحه) ---')
    labels = {
        'no-title': 'بدون عنوان',
        'title-short': 'عنوان کوتاه (<%d)' % TITLE_MIN,
        'title-long': 'عنوان بلند (>%d)' % TITLE_MAX,
        'no-desc': 'بدون توضیح متا',
        'desc-short': 'توضیح کوتاه (<%d)' % DESC_MIN,
        'desc-long': 'توضیح بلند (>%d)' % DESC_MAX,
        'no-canonical': 'بدون canonical',
        'canonical-mismatch': 'canonical ناهماهنگ',
        'no-h1': 'بدون H1',
        'multi-h1': 'بیش از یک H1',
        'noindex': 'noindex دارد',
        'thin-content': 'محتوای کم‌حجم (<%d واژه)' % THIN_WORDS,
        'img-no-alt': 'تصویر بدون alt',
        'not-in-sitemap': 'در sitemap نیست',
        'no-schema': 'بدون دادهٔ ساختاریافته',
        'no-viewport': 'بدون viewport',
    }
    for k, v in iss.most_common():
        print('  %-42s %4d  (%d%%)' % (labels.get(k, k), v, round(v * 100 / n)))
    print()
    print('--- وضعیت هر پوشه ---')
    print('  %-28s %5s %8s %8s %7s' % ('پوشه', 'تعداد', 'در نقشه', 'کم‌حجم', 'میانگین واژه'))
    for folder, d in sorted(per_folder.items(), key=lambda x: -x[1]['n']):
        print('  %-28s %5d %8d %8d %7.0f' % (
            folder, d['n'], d['sitemap'], d['thin'], d['words'] / d['n']))
    print()
    print('--- تکراری‌ها ---')
    print('  عنوان تکراری: %d گروه (%d صفحه درگیر)' % (len(dup_t), sum(len(v) for v in dup_t.values())))
    for k, v in sorted(dup_t.items(), key=lambda x: -len(x[1]))[:10]:
        print('     ×%d  %s' % (len(v), k[:70]))
    print('  توضیح متای تکراری: %d گروه (%d صفحه درگیر)' % (len(dup_d), sum(len(v) for v in dup_d.values())))
    for k, v in sorted(dup_d.items(), key=lambda x: -len(x[1]))[:10]:
        print('     ×%d  %s' % (len(v), k[:70]))
    print()
    if smap_only:
        print('--- URL در sitemap بدون فایل متناظر (احتمال ۴۰۴) — %d مورد ---' % len(smap_only))
        for u in smap_only[:20]:
            print('     %s' % u)
    print()
    print('خروجی کامل: %s' % os.path.relpath(out_csv, ROOT))
    print('=' * 78)
    return 0


if __name__ == '__main__':
    sys.exit(main())
