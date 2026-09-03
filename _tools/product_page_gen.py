# -*- coding: utf-8 -*-
"""مولد صفحات محصول انبار (products/) — قالب را از صفحهٔ موجود استخراج و با محتوای جدید بازتولید می‌کند."""
import importlib.util, json, re, sys, html

TPL = 'products/42-inch-wpb-wphy-elbow.html'
tpl = open(TPL, encoding='utf-8').read()

def between(s, a, b, start=0):
    i = s.find(a, start); assert i >= 0, a
    j = s.find(b, i + len(a)); assert j >= 0, b
    return s[i:j + len(b)]

STYLE_BLOCKS = re.findall(r'<style[^>]*>.*?</style>', tpl, flags=re.S)
assert len(STYLE_BLOCKS) >= 2
CSS = '\n'.join(STYLE_BLOCKS)
HEADER = between(tpl, '<header', '</header>')
FOOTER = between(tpl, '<footer', '</footer>')
HEAD_OPEN = '<!doctype html><html lang="fa" dir="rtl"><head><link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="icon" type="image/png" sizes="96x96" href="../assets/images/favicon/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="../assets/images/favicon/favicon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'

def render(spec):
    slug = spec['slug']; url = f'https://pishtaj.ir/products/{slug}.html'
    img_url = f'https://pishtaj.ir/assets/images/products/generated/{spec["img"][0]}'
    # JSON-LD
    graph = [
      {"@type": ["Organization","LocalBusiness"], "@id": "https://pishtaj.ir/#organization",
       "name": "شرکت پیشرو تجهیز فرتاک", "url": "https://pishtaj.ir/",
       "logo": "https://pishtaj.ir/assets/images/ptf-logo.png", "telephone": "+982146087679", "areaServed": "IR"},
      {"@type": "BreadcrumbList", "itemListElement": [
        {"@type":"ListItem","position":1,"name":"خانه","item":"https://pishtaj.ir/"},
        {"@type":"ListItem","position":2,"name":"محصولات صنعتی","item":"https://pishtaj.ir/services/products/"},
        {"@type":"ListItem","position":3,"name":spec['name'],"item":url}]},
      {"@type": "Product", "name": spec['name'], "category": spec['category'],
       "description": spec['desc'], "image": img_url, "url": url,
       "offers": {"@type":"Offer","priceCurrency":"IRR","availability":"https://schema.org/InStock",
                  "url": url, "seller":{"@type":"Organization","name":"پیشرو تجهیز فرتاک"}}},
      {"@type": "FAQPage", "mainEntity": [
        {"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in spec['faq']]},
    ]
    if spec.get('brand'):
        graph[2]["brand"] = {"@type":"Brand","name":spec['brand']}
    ld = json.dumps({"@context":"https://schema.org","@graph":graph}, ensure_ascii=False)
    # head
    head = HEAD_OPEN + (
      f'<title>{html.escape(spec["title"])}</title>'
      f'<meta name="description" content="{html.escape(spec["desc"])}">'
      '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'
      '<meta name="theme-color" content="#ef4b1a">'
      f'<link rel="canonical" href="{url}">'
      f'<link rel="alternate" hreflang="fa-IR" href="{url}">'
      f'<link rel="alternate" hreflang="x-default" href="{url}">'
      '<meta property="og:locale" content="fa_IR">'
      '<meta property="og:site_name" content="پیشرو تجهیز فرتاک">'
      '<meta property="og:type" content="product">'
      f'<meta property="og:title" content="{html.escape(spec["title"])}">'
      f'<meta property="og:description" content="{html.escape(spec["desc"])}">'
      f'<meta property="og:url" content="{url}">'
      f'<meta property="og:image" content="{img_url}">'
      '<meta name="twitter:card" content="summary_large_image">'
      f'<link rel="stylesheet" href="../assets/css/style.css">'
      f'<script type="application/ld+json">{ld}</script>{CSS}')
    # body blocks
    b = []
    for blk in spec['body']:
        t = blk[0]
        if t == 'h2': b.append(f'<h2>{blk[1]}</h2>')
        elif t == 'h3': b.append(f'<h3>{blk[1]}</h3>')
        elif t == 'p': b.append(f'<p>{blk[1]}</p>')
        elif t == 'ul': b.append('<ul>' + ''.join(f'<li>{x}</li>' for x in blk[1]) + '</ul>')
        elif t == 'tbl':
            rows = ''.join(f'<tr><th>{r[0]}</th><td>{r[1]}</td></tr>' for r in blk[1])
            b.append(f'<table class="ptf-spec">{rows}</table>')
    body_html = '\n'.join(b)
    faq_html = '\n'.join(f'<div class="ptf-faq"><b>{q}</b><p>{a}</p></div>' for q,a in spec['faq'])
    chips = ''.join(f'<span class="ptf-chip">{c}</span>' for c in spec['chips'])
    side = ''.join(f'<a href="{h}">{l}</a>' for l,h in spec['related'])
    # breadcrumb name
    crumb = spec['name']
    doc = f'''{head}</head><body><a class="ptf-skip" href="#main-content" data-ptf-skip="yes">رفتن به محتوا</a>{HEADER}<main id="main-content" class="ptf-product-main"><div class="container"><div class="ptf-breadcrumb"><a href="../">خانه</a> › <a href="../services/products/">محصولات صنعتی</a> › {crumb}</div><section class="ptf-product-hero"><div class="ptf-hero-grid"><div><h1>{spec['h1']}</h1><p>{spec['lede']}</p><div>{chips}</div></div><div class="ptf-hero-card"><img src="../assets/images/products/generated/{spec['img'][0]}" alt="{html.escape(spec['img'][1])}" width="1408" height="768" loading="eager"><p style="font-size:12px;color:rgba(255,255,255,.72);margin:10px 4px 0;line-height:1.8">{spec['img'][2]}</p></div></div></section><div class="ptf-layout"><article class="ptf-article">{body_html}<h2>پرسش‌های متداول</h2>{faq_html}</article><aside class="ptf-side"><h3>دسترسی سریع</h3><a href="../rfq/?product={spec['rfq']}">ثبت RFQ این محصول</a>{side}<h3 style="margin-top:22px">بررسی فوری</h3><p style="font-size:13px;line-height:1.9;color:#64748b">قبل از استعلام، مشخصات فنی، متریال، مدارک اجباری و زمان تحویل موردنیاز پروژه را مشخص کنید.</p></aside></div></div></main><div class="supplier-cta" style="max-width:1100px;margin:0 auto;padding:0 20px 30px"><div style="background:linear-gradient(135deg,#fffcf9,#fff5eb);border:1px solid rgba(239,75,26,.22);border-radius:16px;padding:14px 20px;font-size:13.5px;color:#475569;line-height:1.9;text-align:right"><b style="color:#1e293b">{spec['rfq_title']}</b> {spec['rfq_text']} <a href="../rfq/?product={spec['rfq']}" style="color:#0e7490;font-weight:900">ثبت استعلام ←</a></div></div>{FOOTER}<script src="../assets/js/main.js"></script><script src="../assets/js/ptf-metrics.js" defer></script><script>(function(){{var b=document.getElementById('menuToggle'),n=document.getElementById('mainNav');if(b&&n)b.addEventListener('click',function(){{n.classList.toggle('open');b.classList.toggle('open')}});}})();</script><div class="ptf-mobile-product-cta" aria-label="ثبت استعلام سریع محصول"><span>{spec['mobile_cta']}</span><a href="../rfq/?product={spec['rfq']}">ثبت RFQ سریع</a></div>
<script src="../assets/js/ptf-discover.js" defer></script>
<script defer src="../assets/js/ptf-analytics.js"></script>
</body></html>'''
    return doc

def main(data_path):
    spec = importlib.util.spec_from_file_location('d', data_path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    for p in mod.PRODUCTS:
        doc = render(p)
        out = f'products/{p["slug"]}.html'
        open(out, 'w', encoding='utf-8').write(doc)
        words = len(re.findall(r'[\u0600-\u06FF]+', doc.split('</main>')[0]))
        ok_t = len(p['title']) <= 72
        ok_d = 120 <= len(p['desc']) <= 190
        print(('✅' if (words >= 600 and ok_t and ok_d) else '❌'), out, f'— ~{words} کلمه — عنوان {len(p["title"])} — توضیحات {len(p["desc"])}')

if __name__ == '__main__':
    main(sys.argv[1])
