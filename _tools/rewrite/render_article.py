#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_tools/rewrite/render_article.py
سازندهٔ صفحهٔ استاندارد مقالهٔ مرکز دانش (knowledge-center) — منطبق با تمپلیت
موجود سایت (هدر/فوتر کامل، Schema Article+FAQPage+BreadcrumbList، OG کامل).
هر مقاله با فراخوانی render_article(...) با محتوای واقعی (نه placeholder) تولید می‌شود.
"""
import json
import re

SITE = "https://pishtaj.ir"

FOOTER = """<footer class="footer" style="background:#111113; color:#cbd5e1; padding:4.5rem 0 2rem; border-top:4px solid var(--red);">
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
          <a href="../rfq/" style="color:#cbd5e1; transition:.2s;">• سامانه استعلام هوشمند (RFQ)</a>
          <a href="../tracking/" style="color:#cbd5e1; transition:.2s;">• رهگیری آنلاین وضعیت پرونده</a>
          <a href="../supplier/" style="color:#cbd5e1; transition:.2s;">• ثبت‌نام تامین‌کنندگان و انبارداران</a>
          <a href="../catalog/" style="color:#cbd5e1; transition:.2s;">• مرکز دانلود کاتالوگ و دیتاشیت</a>
          <a href="../assistant/" style="color:#ffb033; transition:.2s;">• مشاور هوشمند انتخاب تجهیزات</a>
        </div>
      </div>
      <div>
        <b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">حوزه‌های تخصصی تامین</b>
        <div style="display:grid; gap:10px; font-size:14px;">
          <a href="../services/products/seamless-pipe.html" style="color:#cbd5e1; transition:.2s;">• لوله مانیسمان ASTM A106</a>
          <a href="../services/products/welding-flanges.html" style="color:#cbd5e1; transition:.2s;">• فلنج‌های جوشی ASME B16.5</a>
          <a href="../services/products/ball-valve.html" style="color:#cbd5e1; transition:.2s;">• شیر توپی Ball Valve API 6D</a>
          <a href="../services/products/rosemount-3051.html" style="color:#cbd5e1; transition:.2s;">• ترانسمیتر فشار روزمونت Rosemount</a>
        </div>
      </div>
      <div>
        <b style="color:#fff; font-size:16px; display:block; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,.1); padding-bottom:8px;">استانداردها و تضمین کیفیت</b>
        <p style="font-size:13px; color:#94a3b8; line-height:1.7;">تضمین ۱۰۰٪ انطباق با Approved Vendor List وزارت نفت (NIOC/NPC) همراه با گواهی MTC 3.1 و بازرسی TPI.</p>
        <a href="../quality/" style="display:inline-block; margin-top:10px; background:rgba(239,75,26,.15); color:#ffb033; border:1px solid rgba(239,75,26,.3); padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:bold;">مشاهده نظام تضمین کیفیت ←</a>
      </div>
    </div>
    <div class="container" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; padding-top:1.5rem; border-top:1px solid rgba(255,255,255,.08); font-size:13px; color:#64748b;">
      <span>© 2026 Pishro Tajhiz Fartak. All rights reserved. | تامین تخصصی پروژه‌ای</span>
      <a href="https://www.instagram.com/pishrotajheezfartak/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:#94a3b8;font-size:12.5px;text-decoration:none" aria-label="اینستاگرام پیشرو تجهیز فرتاک"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>pishrotajheezfartak</a>
      <a href="../crm/" style="display:inline-flex;align-items:center;gap:6px;color:#e2e8f0;font-size:12.5px;font-weight:800;text-decoration:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 14px;">🔐 ورود همکاران (CRM)</a>
    </div>
  </footer>
<script>(function(){var t=document.getElementById('menuToggle'),n=document.getElementById('mainNav');if(t&&n){t.addEventListener('click',function(){n.classList.toggle('open')});n.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){n.classList.remove('open')})})}var h=document.querySelector('.site-header');if(h){window.addEventListener('scroll',function(){h.classList.toggle('scrolled',window.scrollY>28)})}})();</script>
<script src="../assets/js/ptf-chat.js" defer></script>
</body>
</html>"""

HEADER = """<header class="site-header scrolled"><div class="container nav-wrap">
<a class="brand" href="../" aria-label="پیشرو تجهیز فرتاک"><img width="54" height="54" loading="lazy" src="../assets/images/ptf-logo.png" alt="لوگو شرکت پیشرو تجهیز فرتاک" style="object-fit:contain"><span><b>پیشرو تجهیز فرتاک</b><small>Pishro Tajhiz Fartak</small></span></a>
<button class="menu-toggle" id="menuToggle" aria-label="باز کردن منو"><span></span><span></span><span></span></button>
<nav class="main-nav" id="mainNav" aria-label="منوی اصلی">
<a href="../">خانه</a><a href="../#about">درباره ما</a><a href="../services/">خدمات</a><a href="../industries/">صنایع</a><a href="../projects/">پروژه‌ها</a><a href="../knowledge-center/" class="active">مرکز دانش</a><a href="../tools/">ابزارها</a><a href="../blog/">وبلاگ</a><a href="../news/">اخبار</a><a href="../rfq/">استعلام</a><a href="../#contact">تماس</a><a href="../en/" class="lang-switch-mobile">🇬🇧 English</a>
</nav>
<a class="header-call" href="tel:02146087679">021-46087679</a>
<a href="../en/" class="lang-switch-desktop" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:900;font-size:12px;text-decoration:none;transition:.2s" onmouseover="this.style.background='var(--red)';this.style.color='#fff'" onmouseout="this.style.background='#e2e8f0';this.style.color='#334155'">🇬🇧 EN</a>
</div></header>"""

STYLE = """<style>
.article-hero{background:linear-gradient(135deg,#151517,#2d2d31);min-height:220px;display:flex;align-items:center;padding:130px 0 50px;color:#fff;position:relative}
.article-hero .container{position:relative;z-index:1}
.article-hero h1{font-size:clamp(24px,3.2vw,38px);margin:0 0 10px;line-height:1.3}
.article-wrap{max-width:900px;margin:40px auto;padding:0 20px}
.article-content{background:#fff;border:1px solid var(--line);border-radius:28px;padding:40px;line-height:2.1;font-size:16px;color:#334155;box-shadow:0 16px 42px rgba(0,0,0,.07)}
.article-content h2{font-size:clamp(22px,2.8vw,32px);margin:40px 0 16px;color:#1e293b;font-weight:900;padding-bottom:8px;border-bottom:2px solid #f1f5f9}
.article-content h3{font-size:19px;margin:30px 0 12px;color:#1e293b}
.article-content p{margin:0 0 18px}
.article-content ul,.article-content ol{margin:0 0 18px;padding-right:22px}
.article-content li{margin-bottom:8px}
.article-content a{color:var(--red);font-weight:900}
.article-content table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
.article-content th,.article-content td{border:1px solid #dbe3ef;padding:9px 10px;vertical-align:top;text-align:right}
.article-content th{background:#f1f5f9;color:#334155}
.article-cta{background:linear-gradient(135deg,#f8fafc,#fff);border:2px solid var(--line);border-radius:24px;padding:30px;text-align:center;margin:40px 0 0}
.related-articles{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:30px 0}
.rel-item{padding:16px;border:1px solid var(--line);border-radius:16px;background:#f8fafc;text-decoration:none;transition:.2s}
.rel-item:hover{border-color:var(--red)}
.rel-item b{display:block;color:#1e293b;font-size:14px}
.rel-item span{font-size:12px;color:#64748b}
@media(max-width:700px){.article-content{padding:24px}.related-articles{grid-template-columns:1fr}}
.faq-list{display:grid;gap:10px;margin:10px 0}.faq-list details{border:1px solid #e8e8ec;border-radius:14px;background:#fafafa;padding:13px}.faq-list summary{cursor:pointer;font-weight:800;color:#30333a}.faq-list p{margin:10px 0 0}
.note-box{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:16px;padding:14px 16px;margin:16px 0}
.ok-box{background:#ecfdf5;border:1px solid #bbf7d0;color:#047857;border-radius:16px;padding:14px 16px;margin:16px 0}
</style>"""


def render_faq_schema(faqs):
    items = []
    for q, a in faqs:
        items.append({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a},
        })
    return {"@type": "FAQPage", "mainEntity": items}


def render_breadcrumb_schema(slug, title_short):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "مرکز دانش", "item": f"{SITE}/knowledge-center/"},
            {"@type": "ListItem", "position": 3, "name": title_short, "item": f"{SITE}/knowledge-center/{slug}"},
        ],
    }


def render_article_schema(slug, title, description, date_modified="2026-07-28", date_published="2026-07-01", article_section="مرکز دانش فنی"):
    return {
        "@type": ["TechArticle", "Article"],
        "headline": title,
        "description": description,
        "author": {"@type": "Organization", "name": "تیم مهندسی و تامین پیشرو تجهیز فرتاک", "url": f"{SITE}/about/why-ptf/"},
        "publisher": {"@type": "Organization", "name": "Pishro Tajhiz Fartak", "logo": {"@type": "ImageObject", "url": f"{SITE}/assets/images/ptf-logo.png"}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": f"{SITE}/knowledge-center/{slug}"},
        "inLanguage": "fa-IR",
        "isAccessibleForFree": True,
        "dateModified": date_modified,
        "datePublished": date_published,
        "articleSection": article_section,
    }


def render_article(
    slug,
    title,
    meta_description,
    h1,
    hero_label,
    breadcrumb_short,
    body_html,
    faqs,
    rfq_item_query,
    related_links,
    article_section="سیستم‌های فرآیندی",
):
    """
    slug: مثل kc-air-cooled-fin-fan-selection-guide.html
    title: عنوان <title> کامل (با | پیشرو تجهیز فرتاک در انتها)
    meta_description: توضیح ۱۵۰-۱۶۰ کاراکتری
    h1: متن H1 صفحه (می‌تواند با title کمی متفاوت باشد)
    hero_label: برچسب کوچک بالای H1 (مثلاً «سیستم‌های فرآیندی»)
    breadcrumb_short: نام کوتاه برای breadcrumb schema
    body_html: HTML کامل بدنهٔ مقاله (h2/h3/p/ul/table و...)
    faqs: لیست (سوال, جواب) حداقل ۴ مورد
    rfq_item_query: نام آیتم برای querystring دکمهٔ RFQ (بدون انکود)
    related_links: لیست (عنوان, href) برای بخش مطالب مرتبط
    """
    import urllib.parse

    canonical = f"{SITE}/knowledge-center/{slug}"
    og_title = title.split(" | ")[0]

    ld = {
        "@context": "https://schema.org",
        "@graph": [
            render_breadcrumb_schema(slug, breadcrumb_short),
            render_article_schema(slug, og_title, meta_description, article_section=article_section),
            render_faq_schema(faqs),
        ],
    }
    ld_json = json.dumps(ld, ensure_ascii=False)

    related_html = "".join(
        f'<a class="rel-item" href="{href}"><b>{txt}</b><span>مرکز دانش فنی</span></a>'
        for txt, href in related_links
    )

    faq_html = "".join(
        f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in faqs
    )

    rfq_q = urllib.parse.quote(rfq_item_query)

    page = f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="icon" type="image/png" sizes="96x96" href="../assets/images/favicon/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="../assets/images/favicon/favicon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{meta_description}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="{canonical}" />
<link rel="alternate" hreflang="fa-IR" href="{canonical}" />
<link rel="alternate" hreflang="x-default" href="{canonical}" />
<meta property="og:locale" content="fa_IR" />
<meta property="og:site_name" content="پیشرو تجهیز فرتاک" />
<meta property="og:title" content="{og_title}" />
<meta property="og:description" content="{meta_description}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="{canonical}" />
<meta property="og:image" content="{SITE}/assets/images/ptf-logo.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="../assets/css/style.css" />
<script type="application/ld+json">{ld_json}</script>
{STYLE}
</head>
<body>
{HEADER}
<section class="article-hero">
<div class="container">
<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">{hero_label}</span>
<h1>{h1}</h1>
<p style="color:rgba(255,255,255,.75);font-size:14px">مرکز دانش فنی پیشرو تجهیز فرتاک — راهنمای مهندسی خرید</p>
</div>
</section>
<div class="article-wrap">
<div class="article-content">
{body_html}
<h2>سوالات پرتکرار</h2>
<div class="faq-list">
{faq_html}
</div>
<h2>مطالب مرتبط</h2>
<div class="related-articles">
{related_html}
</div>
</div>
<div class="article-cro-cta" style="background:linear-gradient(135deg, #fffcf9, #fff5eb);border:2px dashed #ff7a30;border-radius:20px;padding:24px;margin-top:35px;box-shadow:0 8px 30px rgba(255,122,48,0.08);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px">
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:32px">📋</span>
    <div>
      <b style="font-size:16px;color:#1e293b;display:block;margin-bottom:4px">درخواست استعلام فنی و استعلام قیمت تخصصی: {og_title}</b>
      <span style="font-size:13px;color:#475569">کارشناسان فنی پیشرو تجهیز فرتاک آماده بررسی MTO و مشخصات فنی پروژه شما هستند.</span>
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center">
    <a href="../rfq/?item={rfq_q}" class="cro-btn" style="background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;box-shadow:0 6px 20px rgba(239,75,26,0.25);transition:.2s">ثبت استعلام هوشمند قیمت ←</a>
    <span style="font-size:13.5px;color:#475569">یا تماس: <b dir="ltr" style="color:#0f172a">021-46087679</b></span>
  </div>
</div>
</div>
{FOOTER}
"""
    return page
