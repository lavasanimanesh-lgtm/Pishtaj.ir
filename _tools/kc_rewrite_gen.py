#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""مولد صفحات مرکز دانش (بازنویسی صفحات قالبی) — قالب استاندارد موج ۱۴۰۴/۰۶
خروجی هر مقاله: صفحهٔ کامل با هیرو، بدنهٔ مقاله، جدول/نکته/فرمول، تصویر،
سوالات متداول (details)، مطالب مرتبط، لینک‌باکس محصول، CTA تامین و فوتر.
الگو: control-valve-cv-calculation-guide.html (جدیدترین قالب استاندارد)."""
import json, re, sys, os, importlib.util, html

BASE = 'https://pishtaj.ir/knowledge-center/'
DATE_PUB = '2026-07-01'
DATE_MOD = '2026-09-11'
DATE_PUB_FA = '۱۰ تیر ۱۴۰۵'
DATE_MOD_FA = '۲۰ شهریور ۱۴۰۵'
BYLINE_ORG = 'تیم مهندسی و تامین پیشرو تجهیز فرتاک'

CSS = """
.article-hero{background:radial-gradient(circle at 18% 20%,rgba(247,148,0,.22),transparent 30%),linear-gradient(135deg,#111827,#17233a 62%,#263858);color:#fff;padding:135px 0 55px}.article-hero h1{font-size:clamp(27px,4vw,45px);line-height:1.35;margin:8px 0 12px;color:#fff}.article-hero p{color:#dbeafe;line-height:2;max-width:900px}.article-wrap{max-width:980px;margin:34px auto;padding:0 20px}.article{background:#fff;border:1px solid #e2e8f0;border-radius:28px;padding:34px;line-height:2.15;color:#334155;box-shadow:0 16px 42px rgba(15,23,42,.06)}.article h2{font-size:24px;color:#0f172a;margin:26px 0 10px}.article h3{font-size:18px;color:#ef4b1a;margin:20px 0 8px}.article p,.article li{font-size:15px;color:#475569}.article a{color:#ef4b1a;font-weight:900}.article table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}.article th,.article td{border:1px solid #dbe3ef;padding:9px 10px;vertical-align:top}.article th{background:#f1f5f9;color:#334155}.article figure{margin:20px 0}.article figure img{width:100%;height:auto;border-radius:16px;border:1px solid #e2e8f0}.article figcaption{font-size:12.5px;color:#64748b;margin-top:8px;text-align:center}.note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:16px;padding:13px 15px;margin:16px 0}.formula{direction:ltr;text-align:left;background:#0f172a;color:#e5e7eb;border-radius:16px;padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow:auto}.cta{background:linear-gradient(135deg,#0f172a,#17233a);color:#fff;border-radius:22px;padding:22px;margin:28px 0}.cta h2{color:#fff;margin-top:0}.cta p{color:#dbeafe}.cta-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.cta-row a,.cta-row button{border:0;border-radius:12px;padding:10px 15px;font-weight:900;text-decoration:none;cursor:pointer}.primary{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff}.light{background:#fff;color:#334155}.toc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:14px 18px;margin:16px 0}.toc a{display:block;margin:4px 0;color:#334155;text-decoration:none}.faq details{border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;margin:8px 0;background:#fff}.faq summary{cursor:pointer;color:#0f172a;font-weight:900}@media(max-width:760px){.article{padding:22px}.article table{font-size:12px}.article-hero{padding-top:100px}}
"""

HEAD_TOP = """<!doctype html><html lang="fa" dir="rtl"><head>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="icon" type="image/png" sizes="96x96" href="../assets/images/favicon/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="../assets/images/favicon/favicon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico">
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
"""

HEADER_NAV = """<a class="ptf-skip" href="#main-content" data-ptf-skip="yes">رفتن به محتوا</a>
<header class="site-header scrolled"><div class="container nav-wrap"><a class="brand" href="../" aria-label="پیشرو تجهیز فرتاک"><img width="54" height="54" loading="lazy" src="../assets/images/ptf-logo.png" alt="لوگو شرکت پیشرو تجهیز فرتاک" style="object-fit:contain"><span><b>پیشرو تجهیز فرتاک</b><small>Pishro Tajhiz Fartak</small></span></a><nav class="main-nav" id="mainNav" aria-label="منوی اصلی"><a href="../">خانه</a><a href="../services/">خدمات</a><a href="../services/products/">محصولات</a><a href="../knowledge-center/" class="active">مرکز دانش</a><a href="../tools/">ابزارها</a><a href="../rfq/">استعلام</a><a href="../#contact">تماس</a></nav><a class="header-call" href="tel:02146087679">021-46087679</a></div></header>
"""

FOOTER = """<footer class="footer" style="background:#111113;color:#cbd5e1;padding:3rem 0 1.5rem;border-top:4px solid var(--red)"><div class="container" style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><span>© 2026 Pishro Tajhiz Fartak</span><a href="../rfq/" style="color:#e2e8f0;font-weight:800;text-decoration:none">ثبت استعلام</a></div></footer>
<script src="../assets/js/ptf-metrics.js" defer></script>
<script src="../assets/js/ptf-discover.js" defer></script>
<script defer src="../assets/js/ptf-analytics.js"></script>
</body></html>
"""

def blocks_html(blocks):
    out = []
    for b in blocks:
        k = b[0]
        if k == 'h2':
            _, i, txt = b
            out.append(f'<h2 id="{i}">{txt}</h2>')
        elif k == 'h3':
            out.append(f'<h3>{b[1]}</h3>')
        elif k == 'p':
            out.append(f'<p>{b[1]}</p>')
        elif k == 'ul':
            lis = ''.join(f'<li>{x}</li>' for x in b[1])
            out.append(f'<ul>{lis}</ul>')
        elif k == 'ol':
            lis = ''.join(f'<li>{x}</li>' for x in b[1])
            out.append(f'<ol>{lis}</ol>')
        elif k == 'tbl':
            _, th, rows, cap = b
            thead = ''.join(f'<th>{x}</th>' for x in th)
            trs = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
            out.append(f'<table><thead><tr>{thead}</tr></thead><tbody>{trs}</tbody></table>')
            if cap: out.append(f'<p style="font-size:12.5px;color:#64748b;margin-top:-8px">{cap}</p>')
        elif k == 'note':
            out.append(f'<div class="note">{b[1]}</div>')
        elif k == 'fig':
            _, src, alt, cap = b
            out.append(f'<figure><img src="{src}" alt="{alt}" loading="lazy" width="960" height="540"><figcaption>{cap}</figcaption></figure>')
        elif k == 'formula':
            out.append(f'<div class="formula">{html.escape(b[1])}</div>')
    return '\n'.join(out)

def build(a):
    url = BASE + a['slug'] + '.html'
    img_abs = 'https://pishtaj.ir/knowledge-center/images/' + a['img'][0]
    ld = {"@context": "https://schema.org", "@graph": [
      {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "خانه", "item": "https://pishtaj.ir/"},
        {"@type": "ListItem", "position": 2, "name": "مرکز دانش", "item": "https://pishtaj.ir/knowledge-center/"},
        {"@type": "ListItem", "position": 3, "name": a['h1'], "item": url}]},
      {"@type": "Article", "headline": a['title'], "description": a['desc'],
       "image": img_abs, "inLanguage": "fa-IR", "isAccessibleForFree": True,
       "datePublished": DATE_PUB, "dateModified": DATE_MOD,
       "articleSection": a['section'], "about": a['keywords'],
       "author": {"@type": "Organization", "name": "تیم مهندسی و تامین پیشرو تجهیز فرتاک", "url": "https://pishtaj.ir/about/why-ptf/"},
       "publisher": {"@type": "Organization", "name": "Pishro Tajhiz Fartak",
          "logo": {"@type": "ImageObject", "url": "https://pishtaj.ir/assets/images/ptf-logo.png"}}},
      {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}}
        for q, ans in a['faq']]}
    ]}
    ldjson = json.dumps(ld, ensure_ascii=False)
    head = HEAD_TOP
    head += f'<title>{a["title"]}</title>\n'
    head += f'<meta name="description" content="{a["desc"]}">\n'
    head += '<meta name="robots" content="index, follow">\n'
    head += f'<link rel="canonical" href="{url}">\n'
    head += f'<link rel="alternate" hreflang="fa-IR" href="{url}" />\n'
    head += f'<link rel="alternate" hreflang="x-default" href="{url}" />\n'
    head += f'<meta property="og:title" content="{a["title"]}">\n'
    head += f'<meta property="og:description" content="{a["desc"]}">\n'
    head += f'<meta property="og:image" content="{img_abs}">\n'
    head += '<meta property="og:type" content="article">\n'
    head += f'<meta property="og:url" content="{url}">\n'
    head += f'<meta name="twitter:title" content="{a["title"]}">\n'
    head += f'<meta name="twitter:description" content="{a["desc"]}">\n'
    head += f'<meta name="twitter:image" content="{img_abs}">\n'
    head += '<link rel="stylesheet" href="../assets/css/style.css">\n'
    head += f'<style>{CSS}</style>\n'
    head += f'<script type="application/ld+json">{ldjson}</script>\n</head>\n'

    body = '<body>\n' + HEADER_NAV
    body += f'<nav class="ptf-bc" aria-label="مسیر صفحه" data-ptf-bc="yes"><div class="container"><ol><li><a href="/">خانه</a></li><li><a href="/knowledge-center/">مرکز دانش</a></li><li><span aria-current="page">{a["title"]}</span></li></ol></div></nav>\n'
    body += f'<section class="article-hero"><div class="container"><div class="breadcrumb"><a href="../" style="color:#bfdbfe">خانه</a> / <a href="../knowledge-center/" style="color:#bfdbfe">مرکز دانش</a> / {a["h1"]}</div><h1>{a["h1"]}</h1><p>{a["lede"]}</p></div></section>\n'
    body += '<main id="main-content"><div class="article-wrap"><article class="article">\n'
    # بایلاین مرئی + فهرست مطالب (ساختار فاز ۱ — قفل tester608)
    toc = [(b[1], b[2]) for b in a['blocks'] if b[0] == 'h2']
    toc.append(('faq', 'سوالات رایج'))
    toc.append(('kc-related', 'مطالب مرتبط'))
    toc.append(('kc-sec-1', 'تامین این تجهیزات را به پیشرو تجهیز فرتاک بسپارید'))
    plain = re.sub(r'<[^>]+>', ' ', blocks_html(a['blocks']))
    read_min = max(2, round(len(plain.split()) / 200))
    body += (f'<div class="kc-byline" style="display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:13px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:10px 16px;margin:0 0 18px">'
             f'<span>نویسنده: <b style="color:#334155">{BYLINE_ORG}</b></span>'
             f'<span>منتشرشده: <time datetime="{DATE_PUB}">{DATE_PUB_FA}</time></span>'
             f'<span>به‌روزرسانی: <time datetime="{DATE_MOD}">{DATE_MOD_FA}</time></span>'
             f'<span>زمان مطالعه: {read_min} دقیقه</span></div>\n')
    toc_html = ''.join(f'<li><a href="#{i}" style="color:#0e7490;text-decoration:none">{t}</a></li>' for i, t in toc)
    body += f'<nav class="kc-toc" aria-label="فهرست مطالب" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 18px;margin:0 0 20px;font-size:14px"><b style="display:block;margin-bottom:6px;color:#0f172a">فهرست مطالب</b><ul style="margin:0;padding-right:18px;display:grid;gap:4px;color:#334155">{toc_html}</ul></nav>\n'
    body += blocks_html(a['blocks']) + '\n'
    # FAQ
    body += '<h2 id="faq">سوالات رایج</h2><div class="faq">\n'
    for i, (q, ans) in enumerate(a['faq']):
        op = ' open' if i == 0 else ''
        body += f'<details{op}><summary>{q}</summary><p>{ans}</p></details>\n'
    body += '</div>\n'
    # related
    body += '<h2 id="kc-related">مطالب مرتبط</h2><ul>' + ''.join(f'<li><a href="{h}">{t}</a></li>' for t, h in a['related']) + '</ul>\n'
    # product linkbox
    p = a['prod']
    body += f'''<div class="ptf-product-linkbox" data-ptf-product-link="{p['key']}">
  <b>مسیر خرید و استعلام: {p['t']}</b>
  <p>{p['d']}</p>
  <a href="{p['href']}">مشاهده صفحه محصول ←</a>
  <a class="secondary" href="../rfq/?product={p['rfq']}">ثبت RFQ همین محصول</a>
</div>\n'''
    # supply CTA
    items = ''.join(f'<li style="margin:0"><a href="{h}" style="color:#0f2744;font-weight:800;text-decoration:none">{t}</a><span style="display:block;font-size:13px;color:#64748b;font-weight:400;margin-top:2px">{s}</span></li>' for t, s, h in a['supply'])
    body += f'''<section class="kc-supply-cta" style="margin:38px 0 6px;padding:26px 28px;border:1px solid #e2e8f0;border-left:4px solid #ef4b1a;border-radius:18px;background:linear-gradient(135deg,#f8fafc,#fff)">
<h2 id="kc-sec-1" style="margin:0 0 8px;font-size:19px;color:#0f2744">تامین این تجهیزات را به پیشرو تجهیز فرتاک بسپارید</h2>
<p style="margin:0 0 16px;font-size:14.5px;color:#475569;line-height:1.9">شرکت پیشرو تجهیز فرتاک <strong>تامین‌کننده تخصصی تجهیزات صنعتی</strong> برای پروژه‌های نفت، گاز، پتروشیمی، فولاد و نیروگاهی است. برای دریافت پیشنهاد فنی و قیمت، استعلام (RFQ) خود را ثبت کنید تا کارشناسان مهندسی فروش در کوتاه‌ترین زمان پاسخ دهند.</p>
<ul style="list-style:none;padding:0;margin:0 0 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
{items}
</ul>
<div style="display:flex;gap:10px;flex-wrap:wrap">
<a href="../rfq/" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#ef4b1a;color:#fff;font-weight:800;font-size:14px;text-decoration:none">ثبت استعلام آنلاین (RFQ)</a>
<a href="tel:02146087679" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#0f2744;color:#fff;font-weight:800;font-size:14px;text-decoration:none">تماس: ۰۲۱-۴۶۰۸۷۶۷۹</a>
</div>
</section>
</article></div></main>
'''
    body += FOOTER
    return head + body

def lint(path, text_only):
    problems = []
    t = text_only
    title = re.search(r'<title>(.*?)</title>', t).group(1)
    desc = re.search(r'name="description" content="(.*?)"', t).group(1)
    if len(title) > 68: problems.append(f'عنوان بلند: {len(title)}')
    if not (120 <= len(desc) <= 175): problems.append(f'طول توضیح: {len(desc)}')
    words = len(re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S))
    body_words = len(re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S).split())
    if body_words < 1000: problems.append(f'کلمات بدنه کم: {body_words}')
    if '"FAQPage"' not in t or 'BreadcrumbList' not in t or '"Article"' not in t:
        problems.append('JSON-LD ناقص')
    if '<img src="images/' not in t: problems.append('بدون تصویر')
    links = re.findall(r'href="([^"#][^"]*?\.html)"', t)
    return problems, body_words, links

if __name__ == '__main__':
    spec_file = sys.argv[1] if len(sys.argv) > 1 else '_tools/kc_batch1_data.py'
    spec = importlib.util.spec_from_file_location('data', spec_file)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    os.makedirs('knowledge-center/images', exist_ok=True)
    for a in mod.ARTICLES:
        out = build(a)
        path = f'knowledge-center/{a["slug"]}.html'
        open(path, 'w', encoding='utf-8').write(out)
        probs, wc, links = lint(path, out)
        # اعتبارسنجی لینک‌های داخلی
        bad = []
        for h in links:
            if h.startswith('http') or h.startswith('/'): continue
            tgt = os.path.normpath(os.path.join('knowledge-center', h))
            if not os.path.exists(tgt) and not os.path.exists(tgt.rstrip('/')): bad.append(h)
        print(f'{"✅" if not probs and not bad else "❌"} {path} — {wc} کلمه — مشکلات: {probs} لینک خراب: {bad}')
