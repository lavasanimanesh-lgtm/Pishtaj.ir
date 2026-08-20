#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سئو — تولید اسکیمای BreadcrumbList از breadcrumb نمایان (idempotent).
یافته: ۶۵۲ صفحه breadcrumb نمایان (ptf-bc) دارند ولی فقط ۲۷۸ صفحه BreadcrumbList؛
این اسکریپت برای بقیه، JSON-LD را دقیقاً از همان مسیر نمایان می‌سازد (بدون محتوای ساختگی)."""
import re, os, glob, json, html as H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SKIP_DIRS = ('crm/', '_tools/', '_human_test/', '_personas/', '_audit/', 'api/', 'docs-deploy/')
changed = 0

LI_RE = re.compile(r'<li>\s*(?:<a href="([^"]+)">([^<]+)</a>|<span[^>]*>([^<]+)</span>)\s*</li>')

def canonical_of(s, path):
    m = re.search(r'rel="canonical" href="([^"]+)"', s)
    if m: return m.group(1)
    u = path[:-len('index.html')] if path.endswith('index.html') else path
    return 'https://pishtaj.ir/' + u

for p in sorted(glob.glob('**/*.html', recursive=True)):
    if p.startswith(SKIP_DIRS) or p == '404.html': continue
    s = open(p, encoding='utf-8', errors='ignore').read()
    if 'BreadcrumbList' in s: continue
    nav = re.search(r'<nav class="ptf-bc"[\s\S]*?</nav>', s)
    if not nav: continue
    items = LI_RE.findall(nav.group(0))
    if len(items) < 2: continue
    lis = []
    for i, (href, name_a, name_s) in enumerate(items):
        name = H.unescape((name_a or name_s).strip())
        li = {'@type': 'ListItem', 'position': i + 1, 'name': name}
        if href:
            li['item'] = 'https://pishtaj.ir' + href if href.startswith('/') else href
        elif i == len(items) - 1:
            li['item'] = canonical_of(s, p)
        lis.append(li)
    ld = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': lis}
    block = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False, separators=(',', ':')) + '</script>\n'
    i = s.find('</head>')
    if i < 0: continue
    open(p, 'w', encoding='utf-8').write(s[:i] + block + s[i:])
    changed += 1

print('BreadcrumbList اضافه شد به', changed, 'صفحه')
