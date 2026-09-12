#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام B1 سئو — ساخت «نقشهٔ کلیدواژه→صفحه» v1 برای کل سایت (2026-08-20).
منبع حقیقت: تایتل واقعی هر صفحه + قواعد نیت جستجوی B2B فارسی به تفکیک بخش.
خروجی: SEO-KEYWORD-MAP-v1.csv (url,cluster,intent,primary,variants,words)
این نسخهٔ v1 «پیش‌نویس نگاشت» است؛ در گام B2 تایتل/H2/اسکیمای صفحات بر اساس همین
نقشه بهینه می‌شود و پس از رسیدن دادهٔ GSC با کوئری‌های واقعی کالیبره می‌گردد."""
import re, glob, os, html as H, csv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PREFIXES = ['راهنمای کامل ', 'راهنمای انتخاب ', 'راهنمای خرید ', 'راهنمای ',
            'خرید و تامین ', 'تامین و سورسینگ ', 'تامین\u200cکننده ', 'تامین کننده ',
            'تامین تجهیزات ', 'تامین ', 'مرجع ']

def read(p):
    return open(p, encoding='utf-8', errors='ignore').read()

def title_of(s):
    m = re.search(r'<title>(.*?)</title>', s, re.S)
    if not m: return ''
    t = H.unescape(m.group(1).strip())
    t = re.split(r'\s*\|\s*', t)[0].strip()          # حذف «| پیشرو تجهیز فرتاک» و دنباله‌ها
    t = re.sub(r'\s*[—–-]\s*(پیشرو|Pishro).*$', '', t)
    return re.sub(r'\s+', ' ', t)

def words_of(s):
    b = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->', ' ', s)
    return len(H.unescape(re.sub(r'<[^>]+>', ' ', b)).split())

def core(topic):
    t = topic
    for pre in PREFIXES:
        if t.startswith(pre):
            t = t[len(pre):]
            break
    return t.strip()

def is_hub(p):
    base = os.path.basename(p)
    return base == 'index.html' and p.count('/') <= 1

rows = []
def add(p, cluster, intent, primary, variants, wc):
    url = 'https://pishtaj.ir/' + (p[:-len('index.html')] if p.endswith('/index.html') or p == 'index.html' else p)
    if p == 'index.html': url = 'https://pishtaj.ir/'
    primary = re.sub(r'\s+', ' ', primary).strip()
    vs = []
    for v in variants:
        v = re.sub(r'\s+', ' ', v).strip()
        if v and v != primary and v not in vs: vs.append(v)
    rows.append({'url': url, 'cluster': cluster, 'intent': intent,
                 'primary': primary, 'variants': ' ؛ '.join(vs), 'kw_count': 1 + len(vs), 'words': wc})

SKIP = {'404.html', 'sitemap.html'}

# ---------- knowledge-center (450) ----------
for p in sorted(glob.glob('knowledge-center/*.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if os.path.basename(p) == 'index.html':
        add(p, 'kc-hub', 'info', 'مرکز دانش تجهیزات صنعتی', ['مرجع فنی تجهیزات نفت و گاز'], wc); continue
    c = core(t)
    if t.startswith('مقایسه'):
        add(p, 'kc-compare', 'info', t, [t.replace('مقایسه', 'تفاوت', 1)], wc)
    else:
        add(p, 'kc', 'info', t, ['قیمت ' + c, 'خرید ' + c], wc)

# ---------- services/products (77) ----------
for p in sorted(glob.glob('services/products/*.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if os.path.basename(p) == 'index.html':
        add(p, 'products-hub', 'commercial', 'محصولات و تجهیزات صنعتی قابل تامین', [], wc); continue
    c = core(t)
    add(p, 'products', 'transactional', 'خرید ' + c, ['تامین ' + c, 'قیمت ' + c], wc)

# ---------- services (سایر) ----------
for p in sorted(glob.glob('services/*.html')) + sorted(glob.glob('services/*/index.html')):
    if '/products/' in p: continue
    s = read(p); t = title_of(s); wc = words_of(s)
    c = core(t)
    add(p, 'services', 'commercial', t, ['شرکت ' + c] if not t.startswith('خدمات') else [t.replace('خدمات', 'شرکت خدمات', 1)], wc)

# ---------- suppliers (21) ----------
for p in sorted(glob.glob('suppliers/*.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if os.path.basename(p) == 'index.html':
        add(p, 'suppliers-hub', 'commercial', 'تامین‌کننده تجهیزات صنعتی', ['شرکت تامین تجهیزات صنعتی'], wc); continue
    c = core(t)
    add(p, 'suppliers', 'commercial', t, ['شرکت تامین ' + c, 'لیست تامین‌کنندگان ' + c], wc)

# ---------- brands (21) ----------
for p in sorted(glob.glob('brands/*.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if os.path.basename(p) == 'index.html':
        add(p, 'brands-hub', 'commercial', 'برندهای تجهیزات صنعتی', [], wc); continue
    c = core(t)
    add(p, 'brands', 'commercial', t, ['قیمت محصولات ' + c, 'خرید ' + c + ' در ایران'], wc)

# ---------- comparisons (10) ----------
for p in sorted(glob.glob('comparisons/*.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if os.path.basename(p) == 'index.html':
        add(p, 'compare-hub', 'info', 'مقایسه تجهیزات صنعتی', [], wc); continue
    add(p, 'compare', 'info', t, [t.replace('مقایسه', 'تفاوت', 1), t.split(' و ')[0].replace('مقایسه ', '') + ' بهتر است یا ' + (t.split(' و ')[1].split(' |')[0] if ' و ' in t else '')], wc)

# ---------- industries / blog / core ----------
for p in sorted(glob.glob('industries/*/index.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    c = core(t)
    add(p, 'industries', 'info', t, ['تامین تجهیزات ' + c.replace('تجهیزات ', '')], wc)
for p in sorted(glob.glob('blog/*.html')) + sorted(glob.glob('blog/*/index.html')):
    s = read(p); t = title_of(s); wc = words_of(s)
    if p == 'blog/index.html':
        add(p, 'blog-hub', 'info', 'وبلاگ تجهیزات صنعتی', [], wc); continue
    add(p, 'blog', 'info', t, [], wc)
for p in ['index.html', 'rfq/index.html', 'about/index.html', 'catalog/index.html',
          'quality/index.html', 'logistics/index.html', 'tracking/index.html']:
    if not os.path.exists(p): continue
    s = read(p); t = title_of(s); wc = words_of(s)
    add(p, 'core', 'commercial', t, [], wc)

# ---------- خروجی ----------
with open('SEO-KEYWORD-MAP-v1.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['url', 'cluster', 'intent', 'primary', 'variants', 'kw_count', 'words'])
    w.writeheader()
    for r in rows: w.writerow(r)

total = sum(r['kw_count'] for r in rows)
from collections import Counter
cl = Counter()
for r in rows: cl[r['cluster']] += r['kw_count']
print('صفحات نگاشت‌شده:', len(rows))
print('کل کلیدواژه‌ها (اصلی+فرعی):', total)
for k, v in cl.most_common(): print(f'  {k}: {v}')
