#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Product UX polish and QA for public SEO pages.
- Adds a lightweight mobile sticky RFQ bar to product pages.
- Validates product hub search/filter data, RFQ links, ItemList schema, and core product SEO fields.
No CRM/API changes.
"""
from pathlib import Path
import re, json, html, sys

PRODUCT_DIR = Path('services/products')
HUB = PRODUCT_DIR / 'index.html'

MOBILE_CTA_STYLE = '''<style id="ptf-mobile-product-cta-style">
.ptf-mobile-product-cta{display:none}
@media(max-width:760px){
  body{padding-bottom:78px}
  .ptf-mobile-product-cta{position:fixed;left:10px;right:10px;bottom:10px;z-index:9998;display:flex;gap:8px;align-items:center;justify-content:space-between;background:rgba(15,39,68,.96);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 46px rgba(15,23,42,.28);border-radius:18px;padding:10px 12px;color:#fff;direction:rtl}
  .ptf-mobile-product-cta span{font-size:12.5px;font-weight:900;line-height:1.7;color:#e2e8f0;max-width:52%}
  .ptf-mobile-product-cta a{white-space:nowrap;text-decoration:none;border-radius:999px;padding:10px 14px;font-size:12.5px;font-weight:950;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;box-shadow:0 8px 20px rgba(239,75,26,.25)}
}
</style>
'''

def text_clean(x):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x or '')).strip()

def product_pages():
    return sorted(p for p in PRODUCT_DIR.glob('*.html') if p.name != 'index.html')

def extract_h1(s):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.I|re.S)
    return text_clean(m.group(1)) if m else ''

def ensure_mobile_cta(p: Path):
    s = p.read_text(encoding='utf-8', errors='ignore')
    changed = False
    if 'ptf-mobile-product-cta-style' not in s:
        s = s.replace('</head>', MOBILE_CTA_STYLE + '</head>', 1)
        changed = True
    if 'class="ptf-mobile-product-cta"' not in s:
        title = extract_h1(s) or p.stem.replace('-', ' ')
        short = title
        if len(short) > 54:
            short = short[:54].rstrip() + '…'
        slug = p.stem
        bar = f'<div class="ptf-mobile-product-cta" aria-label="ثبت استعلام سریع محصول"><span>{html.escape(short)}</span><a href="../../rfq/?product={slug}">ثبت RFQ سریع</a></div>\n'
        s = s.replace('</body>', bar + '</body>', 1)
        changed = True
    if changed:
        p.write_text(s, encoding='utf-8')
    return changed

def schema_blocks(s):
    out=[]
    for m in re.findall(r'<script\s+[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', s, re.I|re.S):
        out.append(json.loads(html.unescape(m.strip())))
    return out

def validate():
    errors=[]
    pages=product_pages()
    # Hub checks
    hs = HUB.read_text(encoding='utf-8', errors='ignore')
    cards = re.findall(r'<article\s+class="ptf-card"[^>]*data-category="([^"]+)"[^>]*data-keywords="([^"]+)"', hs, re.I|re.S)
    if len(cards) != len(pages):
        errors.append(f'hub cards count {len(cards)} != product pages {len(pages)}')
    if 'id="productSearch"' not in hs:
        errors.append('hub search input missing')
    if 'data-filter="all"' not in hs:
        errors.append('hub all filter missing')
    for p in pages:
        if f'href="{p.name}"' not in hs:
            errors.append(f'hub missing link to {p.name}')
        if f'../../rfq/?product={p.stem}' not in hs:
            errors.append(f'hub missing RFQ for {p.stem}')
    try:
        schemas=schema_blocks(hs)
        flat=json.dumps(schemas, ensure_ascii=False)
        if 'ItemList' not in flat:
            errors.append('hub ItemList schema missing')
        if flat.count('ListItem') < len(pages):
            errors.append('hub ItemList appears shorter than products')
    except Exception as e:
        errors.append(f'hub schema parse error: {e}')
    # Product page checks
    for p in pages:
        s=p.read_text(encoding='utf-8', errors='ignore')
        if 'class="ptf-mobile-product-cta"' not in s:
            errors.append(f'mobile CTA missing: {p}')
        if 'ptf-metrics.js' not in s:
            errors.append(f'metrics missing: {p}')
        for must in ['rel="canonical"', 'hreflang="fa-IR"', 'property="og:title"', 'name="twitter:title"']:
            if must not in s:
                errors.append(f'{must} missing: {p}')
        try:
            schemas=schema_blocks(s)
            flat=json.dumps(schemas, ensure_ascii=False)
            if 'Product' not in flat or 'FAQPage' not in flat or 'BreadcrumbList' not in flat:
                errors.append(f'product/faq/breadcrumb schema incomplete: {p}')
        except Exception as e:
            errors.append(f'json-ld parse error {p}: {e}')
        # Approx word count for content products.
        body=re.sub(r'<(script|style)[\s\S]*?</\1>', ' ', s, flags=re.I)
        txt=text_clean(body)
        wc=len(re.findall(r'[\wآ-ی]+', txt))
        if wc < 1500:
            errors.append(f'word count under 1500: {p} = {wc}')
    return errors

changed=[]
for p in product_pages():
    if ensure_mobile_cta(p):
        changed.append(str(p))
errs=validate()
print(f'polished_pages={len(changed)}')
print(f'product_pages={len(product_pages())}')
print(f'qa_errors={len(errs)}')
for e in errs[:80]:
    print('ERROR:', e)
if errs:
    sys.exit(1)
