#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pathlib import Path
from html import escape
import re,json,html
BASE='https://pishtaj.ir/'
OUT=Path('brands')
def clean(x): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',x or '')).strip()
def title(s):
 m=re.search(r'<h1[^>]*>(.*?)</h1>',s,re.I|re.S); 
 if m: return clean(m.group(1))
 m=re.search(r'<title[^>]*>(.*?)</title>',s,re.I|re.S); return clean(m.group(1)) if m else ''
def desc(s):
 m=re.search(r'<meta\s+[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)',s,re.I|re.S)
 return html.unescape(m.group(1)).strip() if m else ''
def cat(s):
 # Try title suffix, otherwise generic
 if 'شیر' in s[:3000] or 'Valve' in s[:3000]: return 'شیرآلات'
 if 'فلومتر' in s[:3000] or 'Transmitter' in s[:3000] or 'WIKA' in s[:3000] or 'KROHNE' in s[:3000] or 'Yokogawa' in s[:3000] or 'Endress' in s[:3000] or 'Emerson' in s[:3000]: return 'ابزار دقیق'
 if 'Siemens' in s[:3000] or 'ABB' in s[:3000] or 'Schneider' in s[:3000]: return 'برق و اتوماسیون'
 if 'Tenaris' in s[:3000] or 'Vallourec' in s[:3000] or 'Galperti' in s[:3000]: return 'پایپینگ'
 if 'Flexitallic' in s[:3000]: return 'گسکت'
 return 'برند صنعتی'
pages=[]
for f in sorted(OUT.glob('*.html')):
 if f.name=='index.html': continue
 s=f.read_text(errors='ignore')
 pages.append({'file':f.name,'title':title(s).replace('تامین و سورسینگ ','') or f.stem,'desc':desc(s),'cat':cat(s),'kw':(title(s)+' '+desc(s)+' '+f.stem).lower()})
cards=''.join(f'''<article class="brand-card" data-category="{escape(p['cat'])}" data-keywords="{escape(p['kw'])}"><a href="{p['file']}"><b>{escape(p['title'])}</b><span>{escape(p['cat'])}</span><small>{escape(p['desc'][:170])}</small></a></article>''' for p in pages)
cats=[]
for p in pages:
 if p['cat'] not in cats: cats.append(p['cat'])
buttons=''.join(f'<button type="button" data-filter="{escape(c)}">{escape(c)}</button>' for c in cats)
schema={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','name':'برندهای قابل سورسینگ تجهیزات صنعتی','url':BASE+'brands/','inLanguage':'fa-IR'},{'@type':'ItemList','name':'فهرست برندهای قابل سورسینگ','itemListElement':[{'@type':'ListItem','position':i+1,'name':p['title'],'url':BASE+'brands/'+p['file']} for i,p in enumerate(pages)]}]}
html_doc=f'''<!doctype html><html lang="fa" dir="rtl"><head><link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>جستجوی برندهای قابل سورسینگ تجهیزات صنعتی | پیشرو تجهیز</title><meta name="description" content="هاب قابل جستجو برای برندهای قابل سورسینگ تجهیزات صنعتی؛ بدون ادعای نمایندگی رسمی و با تمرکز بر Part Number، وندورلیست و مدارک قابل ردیابی."><meta name="robots" content="index, follow"><link rel="canonical" href="{BASE}brands/"><link rel="alternate" hreflang="fa-IR" href="{BASE}brands/"><link rel="alternate" hreflang="x-default" href="{BASE}brands/"><meta property="og:locale" content="fa_IR"><meta property="og:site_name" content="پیشرو تجهیز فرتاک"><meta property="og:title" content="هاب برندهای قابل سورسینگ"><meta property="og:description" content="برندهای صنعتی را بر اساس نام یا دسته پیدا کنید؛ بدون ادعای نمایندگی رسمی."><meta property="og:type" content="website"><meta property="og:url" content="{BASE}brands/"><meta property="og:image" content="{BASE}assets/images/ptf-logo.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="هاب برندهای قابل سورسینگ"><meta name="twitter:description" content="برندهای صنعتی را بر اساس نام یا دسته پیدا کنید."><meta name="twitter:image" content="{BASE}assets/images/ptf-logo.png"><link rel="stylesheet" href="../assets/css/style.css"><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False,separators=(',',':'))}</script><style>body{{background:#f8fafc}}.hero{{padding:130px 0 50px;background:#0f2744;color:#fff}}.hero h1{{color:#fff}}.panel{{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:18px;margin:20px auto}}.panel input{{width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:16px;padding:12px;font:inherit}}.filters{{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}}.filters button{{border:1px solid #e2e8f0;border-radius:999px;background:#fff;padding:8px 12px;font-weight:900}}.filters button.active{{background:#ef4b1a;color:#fff}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px auto 70px}}.brand-card a{{display:grid;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:20px;text-decoration:none;color:#0f2744;height:100%}}.brand-card span{{color:#ef4b1a;font-weight:900}}.brand-card small{{color:#64748b;line-height:1.8}}</style></head><body><header class="site-header scrolled"><div class="container nav-wrap"><a class="brand" href="../"><img width="54" height="54" loading="lazy" src="../assets/images/ptf-logo.png" alt="لوگو"><span><b>پیشرو تجهیز فرتاک</b></span></a><nav class="main-nav"><a href="../">خانه</a><a href="../services/products/">محصولات</a><a href="../about/company-profile/">پروفایل شرکت</a><a href="../rfq/">RFQ</a></nav></div></header><section class="hero"><div class="container"><h1>برندهای قابل سورسینگ تجهیزات صنعتی</h1><p>این بخش برای تقویت سئوی برندمحور و شفاف‌سازی معیارهای خرید برندها ایجاد شده است. هیچ صفحه‌ای ادعای نمایندگی رسمی ندارد؛ هر سفارش باید با وندورلیست و مدارک پروژه کنترل شود.</p></div></section><section class="container panel"><input id="brandSearch" type="search" placeholder="جستجو: Rosemount، Siemens، WIKA، Galperti، KROHNE ..."><div class="filters"><button class="active" data-filter="all">همه</button>{buttons}</div></section><main class="container grid" id="brandGrid">{cards}</main><script src="../assets/js/ptf-metrics.js" defer></script><script>(function(){{var q=document.getElementById('brandSearch'),cards=[].slice.call(document.querySelectorAll('.brand-card')),btns=[].slice.call(document.querySelectorAll('.filters button')),active='all';function norm(s){{return String(s||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک')}}function apply(){{var x=norm(q&&q.value);cards.forEach(function(c){{var ok=(active==='all'||c.dataset.category===active)&&(!x||norm(c.dataset.keywords+c.textContent).indexOf(x)>-1);c.style.display=ok?'block':'none'}})}}btns.forEach(function(b){{b.onclick=function(){{btns.forEach(function(z){{z.classList.remove('active')}});b.classList.add('active');active=b.dataset.filter||'all';apply()}}}});if(q)q.oninput=apply;apply()}})();</script></body></html>'''
(OUT/'index.html').write_text(html_doc,encoding='utf-8')
print('brand_hub_pages',len(pages),'categories',len(cats))
