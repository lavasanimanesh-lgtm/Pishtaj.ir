#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate supplier landing pages (Phase 2) for pishtaj.ir — SEO.
Each page: keyword-first title, rich meta, full @graph schema (Organization +
Breadcrumb + Service + FAQPage), commercial body, brand strip, RFQ CTA, footer.
"""
import json, os

BRAND_DIR = '../assets/images/brands/'

def brand_img(fn, alt, w=300, h=73):
    return f'<img src="{BRAND_DIR}{fn}" alt="{alt}" loading="lazy" width="{w}" height="{h}">'

def build_schema(service_name, service_type, description, offers, faqs, url, crumb_name):
    org = {
        "@type": ["Organization", "LocalBusiness"],
        "@id": "https://pishtaj.ir/#organization",
        "name": "شرکت پیشرو تجهیز فرتاک",
        "url": "https://pishtaj.ir/",
        "logo": "https://pishtaj.ir/assets/images/ptf-logo.png",
        "telephone": "+982146087679",
        "areaServed": "IR",
    }
    bc = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": "https://pishtaj.ir/"},
            {"@type": "ListItem", "position": 2, "name": "تامین‌کنندگان تجهیزات صنعتی", "item": "https://pishtaj.ir/suppliers/"},
            {"@type": "ListItem", "position": 3, "name": crumb_name, "item": url},
        ],
    }
    svc = {
        "@type": "Service",
        "name": service_name,
        "serviceType": service_type,
        "description": description,
        "provider": {"@type": "Organization", "@id": "https://pishtaj.ir/#organization", "name": "پیشرو تجهیز فرتاک"},
        "areaServed": "IR",
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "اقلام قابل تامین",
            "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Product", "name": o}} for o in offers],
        },
    }
    faq = {
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs],
    }
    return json.dumps({"@context": "https://schema.org", "@graph": [org, bc, svc, faq]}, ensure_ascii=False)

def render(p):
    # brand strip: list of image tuples or text labels
    brand_html = ''.join(p['brands'])
    product_html = ''
    for group in p['products']:
        if isinstance(group, tuple):
            product_html += f'<h3>{group[0]}</h3><ul>' + ''.join(f'<li>{it}</li>' for it in group[1]) + '</ul>\n'
        else:
            product_html += f'<h3>{group}</h3>\n'
    why_html = ''.join(f'<li>{x}</li>' for x in p['why'])
    ind_html = ''.join(f'<div class="svc-card"><h4>{t}</h4><p>{d}</p></div>' for t, d in p['industries'])
    rel_html = ''.join(f'<li><a href="{h}">{t}</a></li>' for h, t in p['related'])
    faq_body = ''.join(f'<div class="faq-item"><h4>{q}</h4><p>{a}</p></div>' for q, a in p['faqs'])
    trust = p.get('trust') or [("+۱۲ سال","سابقه تامین پروژه‌ای"),("Vendor List","انطباق با الزامات کارفرما"),("MTC/COC","مستندات کامل هر محموله"),("TPI","بازرسی شخص ثالث BV/SGS/DNV")]
    trust_html = ''.join(f'<div class="trust-item"><b>{b}</b><span>{s}</span></div>' for b, s in trust)
    schema = build_schema(p['service_name'], p['service_type'], p['description'], p['offers'], p['faqs'], p['url'], p['crumb_name'])

    return f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="icon" type="image/png" sizes="96x96" href="../assets/images/favicon/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="../assets/images/favicon/favicon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{p['title']}</title>
<meta name="description" content="{p['meta_desc']}" />
<meta name="keywords" content="{p['meta_kw']}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta name="theme-color" content="#ef4b1a" />
<link rel="canonical" href="{p['url']}" />
<link rel="alternate" hreflang="fa-IR" href="{p['url']}" />
<link rel="alternate" hreflang="x-default" href="{p['url']}" />
<meta property="og:locale" content="fa_IR" />
<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />
<meta property="og:title" content="{p['og_title']}" />
<meta property="og:description" content="{p['og_desc']}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="{p['url']}" />
<meta property="og:image" content="https://pishtaj.ir/assets/images/real/real-hero-energy-plant.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{p['tw_title']}" />
<meta name="twitter:description" content="{p['og_desc']}" />
<meta name="twitter:image" content="https://pishtaj.ir/assets/images/real/real-hero-energy-plant.jpg" />
<script type="application/ld+json">
{schema}
</script>
<link rel="stylesheet" href="../assets/css/style.css" />
<style>
.svc-hero{{background:linear-gradient(135deg,#151517,#ef4b1a2d);min-height:260px;display:flex;align-items:center;padding:140px 0 50px;color:#fff;position:relative;overflow:hidden}}
.svc-hero:before{{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 40%,rgba(239,75,26,.25),transparent 40%)}}
.svc-hero .container{{position:relative;z-index:1}}
.svc-hero h1{{font-size:clamp(26px,3.8vw,44px);margin:0 0 10px}}
.svc-hero p{{color:rgba(255,255,255,.8);font-size:16px;max-width:720px}}
.svc-wrap{{max-width:1100px;margin:40px auto;padding:0 20px}}
.svc-content{{background:#fff;border:1px solid var(--line);border-radius:28px;padding:40px;box-shadow:0 16px 42px rgba(0,0,0,.07);line-height:2.1;font-size:15px;color:#334155}}
.svc-content h2{{font-size:clamp(20px,2.5vw,30px);margin:40px 0 14px;color:#1e293b;font-weight:900;padding-bottom:8px;border-bottom:2px solid #f1f5f9}}
.svc-content h3{{font-size:18px;margin:28px 0 10px;color:#1e293b}}
.svc-content p{{margin:0 0 16px}}
.svc-content ul,.svc-content ol{{margin:0 0 18px;padding-right:22px}}
.svc-content li{{margin-bottom:7px}}
.svc-content a{{color:var(--red);font-weight:900}}
.svc-cta{{background:linear-gradient(135deg,#f8fafc,#fff);border:2px solid var(--line);border-radius:24px;padding:30px;text-align:center;margin:40px 0 0}}
.svc-grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin:24px 0}}
.svc-card{{border:1px solid var(--line);border-radius:18px;padding:20px;background:#f8fafc}}
.svc-card h4{{margin:0 0 8px;color:#1e293b;font-size:15px}}
.svc-card p{{font-size:13px;color:#64748b;margin:0}}
.brand-strip{{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 30px}}
.brand-strip img{{height:36px;border-radius:8px;border:1px solid var(--line);background:#fff;padding:3px 8px;object-fit:contain}}
.trust-row{{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}}
.trust-item{{background:#fff7f4;border:1px solid rgba(239,75,26,.18);border-radius:16px;padding:18px 14px;text-align:center}}
.trust-item b{{display:block;font-size:22px;color:#ef4b1a;margin-bottom:4px}}
.trust-item span{{font-size:12.5px;color:#64748b;line-height:1.5;display:block}}
.faq-item{{border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:10px 0;background:#fafcff}}
.faq-item h4{{margin:0 0 6px;color:#1e293b;font-size:15px}}
.faq-item p{{margin:0;color:#64748b;font-size:14px}}
@media(max-width:800px){{.svc-grid{{grid-template-columns:1fr}}.svc-content{{padding:24px}}.trust-row{{grid-template-columns:repeat(2,1fr)}}}}
</style>
</head>
<body>
<header class="site-header scrolled"><div class="container nav-wrap">
<a class="brand" href="../" aria-label="پیشرو تجهیز فرتاک"><img width="54" height="54" loading="lazy" src="../assets/images/ptf-logo.png" alt="لوگو شرکت پیشرو تجهیز فرتاک" style="object-fit:contain"><span><b>پیشرو تجهیز فرتاک</b><small>Pishro Tajhiz Fartak</small></span></a>
<button class="menu-toggle" id="menuToggle" aria-label="باز کردن منو"><span></span><span></span><span></span></button>
<nav class="main-nav" id="mainNav" aria-label="منوی اصلی">
<a href="../">خانه</a><a href="../#about">درباره ما</a><a href="../services/" class="active">خدمات</a><a href="../industries/">صنایع</a><a href="../projects/">پروژه‌ها</a><a href="../knowledge-center/">مرکز دانش</a><a href="../tools/">ابزارها</a><a href="../blog/">وبلاگ</a><a href="../news/">اخبار</a><a href="../rfq/">استعلام</a><a href="../#contact">تماس</a><a href="../en/" class="lang-switch-mobile">🇬🇧 English</a>
</nav>
<a class="header-call" href="tel:02146087679">021-46087679</a>
<a href="../en/" class="lang-switch-desktop" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:900;font-size:12px;text-decoration:none;transition:.2s" onmouseover="this.style.background='var(--red)';this.style.color='#fff'" onmouseout="this.style.background='#e2e8f0';this.style.color='#334155'">🇬🇧 EN</a>
</div></header>
<section class="svc-hero">
<div class="container">
<h1>{p['h1']}</h1>
<p>{p['hero_p']}</p>
</div>
</section>
<div class="svc-wrap">
<article class="svc-content">
<h2>{p['intro_h2']}</h2>
<p>{p['intro_p']}</p>

<div class="trust-row">{trust_html}</div>

<h2>{p['products_h2']}</h2>
{product_html}

<h2>برندهای قابل سورسینگ</h2>
<div class="brand-strip">{brand_html}</div>

<h2>چرا پیشرو تجهیز فرتاک؟</h2>
<ul>{why_html}</ul>

<h2>صنایع تحت پوشش</h2>
<div class="svc-grid">{ind_html}</div>

<h2>راهنماهای مرتبط</h2>
<ul>{rel_html}</ul>

<h2>پرسش‌های متداول</h2>
{faq_body}

<div class="svc-cta">
<h3 style="margin:0 0 8px;color:#1e293b">{p['cta_h3']}</h3>
<p style="color:#64748b;font-size:14px">{p['cta_p']}</p>
<a href="../rfq/" class="btn btn-primary" style="padding:14px 32px">ثبت استعلام هوشمند (RFQ) ←</a>
</div>
</article>
</div>
<footer class="footer" style="background:#111113; color:#cbd5e1; padding:4.5rem 0 2rem; border-top:4px solid var(--red);">
    <div class="container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:35px; margin-bottom:3.5rem; text-align:right;">
      <div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
          <img width="54" height="54" loading="lazy" src="../assets/images/ptf-logo.png" alt="لوگو پیشرو تجهیز فرتاک" style="width:54px; height:54px; object-fit:contain">
          <span style="color:#fff; font-weight:900; font-size:18px;">پیشرو تجهیز فرتاک<small style="display:block; font-size:11px; color:var(--red);">Pishro Tajhiz Fartak</small></span>
        </div>
        <p style="font-size:13.5px; color:#94a3b8; line-height:1.8;">تامین‌کننده تخصصی تجهیزات پایپینگ، برق صنعتی و ابزار دقیق برای پروژه‌های ملی نفت، گاز، پتروشیمی، فولاد و نیروگاهی.</p>
      </div>
      <div>
        <b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">دسترسی سریع پروژه‌ای</b>
        <div style="display:grid; gap:10px; font-size:14px;">
          <a href="../rfq/" style="color:#cbd5e1; transition:.2s;">01 سامانه استعلام هوشمند (RFQ)</a>
          <a href="../tracking/" style="color:#cbd5e1; transition:.2s;">02 رهگیری آنلاین وضعیت پرونده</a>
          <a href="../suppliers/" style="color:#cbd5e1; transition:.2s;">03 تامین‌کنندگان تجهیزات صنعتی</a>
          <a href="../catalog/" style="color:#cbd5e1; transition:.2s;">04 مرکز دانلود کاتالوگ و دیتاشیت</a>
        </div>
      </div>
      <div>
        <b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">حوزه‌های تخصصی تامین</b>
        <div style="display:grid; gap:10px; font-size:14px;">
          <a href="piping-supplier.html" style="color:#cbd5e1; transition:.2s;">• تامین‌کننده پایپینگ</a>
          <a href="instrumentation-supplier.html" style="color:#cbd5e1; transition:.2s;">• تامین‌کننده تجهیزات ابزار دقیق</a>
          <a href="petrochemical-equipment-supplier.html" style="color:#cbd5e1; transition:.2s;">• تامین‌کننده تجهیزات پتروشیمی</a>
          <a href="valve-supplier.html" style="color:#cbd5e1; transition:.2s;">• تامین‌کننده شیرآلات صنعتی</a>
        </div>
      </div>
      <div>
        <b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">استانداردها و تضمین کیفیت</b>
        <p style="font-size:13px; color:#94a3b8; line-height:1.7;">کنترل انطباق فنی بر اساس RFQ، وندورلیست کارفرما، MTC/COC، تست‌های لازم و امکان هماهنگی TPI در صورت الزام قرارداد.</p>
        <a href="../quality/" style="display:inline-block; margin-top:10px; background:rgba(239,75,26,.15); color:#ffb033; border:1px solid rgba(239,75,26,.3); padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:bold;">مشاهده نظام تضمین کیفیت ←</a>
      </div>
    </div>
    <div class="container" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; padding-top:1.5rem; border-top:1px solid rgba(255,255,255,.08); font-size:13px; color:#64748b;">
      <span>© 2026 Pishro Tajhiz Fartak. All rights reserved. | تامین تخصصی پروژه‌ای</span>
      <a href="https://www.instagram.com/pishrotajheezfartak/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:#94a3b8;font-size:12.5px;text-decoration:none" aria-label="اینستاگرام پیشرو تجهیز فرتاک">Instagram</a>
      <a href="../crm/" style="display:inline-flex;align-items:center;gap:6px;color:#e2e8f0;font-size:12.5px;font-weight:800;text-decoration:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 14px;">ورود همکاران (CRM)</a>
    </div>
  </footer>
<script>(function(){{var t=document.getElementById('menuToggle'),n=document.getElementById('mainNav');if(t&&n){{t.addEventListener('click',function(){{n.classList.toggle('open')}});n.querySelectorAll('a').forEach(function(a){{a.addEventListener('click',function(){{n.classList.remove('open')}})}})}}var h=document.querySelector('.site-header');if(h){{window.addEventListener('scroll',function(){{h.classList.toggle('scrolled',window.scrollY>28)}})}}}})();</script>
<script src="../assets/js/ptf-chat.js" defer></script>
<script src="../assets/js/ptf-metrics.js" defer></script>
</body>
</html>
"""
