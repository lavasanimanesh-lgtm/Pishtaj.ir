#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""فاز گسترش خوشهٔ برنده سئو (2026-08-21) — تولید صفحات هدفمند از روی کوئری‌های واقعی GSC.

سه شکاف واقعی که در دادهٔ GSC دیده شد و صفحهٔ هدفمند ندارند:
  1. «فلنج اراک» (۶ نمایش) — خوشهٔ پایپینگ
  2. «ترانسمیتر فشار روزمونت» (۳۷ نمایش، جایگاه ۷۲) — خوشهٔ ابزار دقیق
  3. «استاندارد شیرآلات صنعتی» (جایگاه ۲۶) — هاب موضوعی شیرآلات

هر صفحه از روی «قالب طلایی» (kc-api-5l-psl2-sour-service-nace-requirements.html) ساخته
می‌شود: هد کامل + BreadcrumbList + TechArticle/Article با E-E-A-T + FAQPage + محتوای
فنی اختصاصی (نه قالب عمومی). idempotent: اجرای دوباره همان خروجی را بازنویسی می‌کند.
اجرا: python3 tools/seo_winning_cluster_pages.py
"""
import io, re, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

TEMPLATE = 'knowledge-center/kc-api-5l-psl2-sour-service-nace-requirements.html'
BASE_URL = 'https://pishtaj.ir'
AUTHOR = {"@type": "Organization", "name": "تیم مهندسی و تامین پیشرو تجهیز فرتاک",
          "url": BASE_URL + "/about/why-ptf/"}
REVIEWEDBY = {"@type": "Organization", "name": "واحد مهندسی، تضمین کیفیت و تامین پیشرو تجهیز فرتاک",
              "url": BASE_URL + "/about/why-ptf/"}
PUBLISHER = {"@type": "Organization", "name": "Pishro Tajhiz Fartak",
             "logo": {"@type": "ImageObject", "url": BASE_URL + "/assets/images/ptf-logo.png"}}
DATE_PUB = "2026-07-01"
DATE_MOD = "2026-08-21"


def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def build_ld(breadcrumb_name, headline, desc, section, about, faq, url):
    """یک بلوک JSON-LD با @graph: BreadcrumbList + TechArticle/Article + FAQPage."""
    graph = [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "خانه", "item": BASE_URL + "/"},
            {"@type": "ListItem", "position": 2, "name": "مرکز دانش", "item": BASE_URL + "/knowledge-center/"},
            {"@type": "ListItem", "position": 3, "name": breadcrumb_name, "item": url},
        ]},
        {"@type": ["TechArticle", "Article"], "headline": headline, "description": desc,
         "author": AUTHOR, "publisher": PUBLISHER,
         "mainEntityOfPage": {"@type": "WebPage", "@id": url},
         "inLanguage": "fa-IR", "isAccessibleForFree": True,
         "dateModified": DATE_MOD, "datePublished": DATE_PUB,
         "articleSection": section, "reviewedBy": REVIEWEDBY, "about": about},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faq]},
    ]
    d = {"@context": "https://schema.org", "@graph": graph}
    return '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False, indent=1) + '</script>'


def build_content(category, h1, lead, sections, cta_link, cta_link_text, cta_label):
    """ناحیهٔ محتوا: hero + article-content + CTA."""
    sec_html = ''
    for h2, body in sections:
        sec_html += '<h2>%s</h2>\n%s\n' % (h2, body)
    return (
        '<section class="article-hero">\n'
        '<div class="container">\n'
        '<span style="background:rgba(239,75,26,.2);color:#ffb033;padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:800">%s</span>\n'
        '<h1>%s</h1>\n'
        '<p style="color:rgba(255,255,255,.75);font-size:14px">مرکز دانش فنی پیشرو تجهیز فرتاک — راهنمای مهندسی خرید</p>\n'
        '</div>\n</section>\n'
        '<div class="article-wrap">\n<div class="article-content">\n\n'
        '%s\n\n%s\n'
        '<div class="ply-cta" style="max-width:900px;margin:0 auto;padding:0 20px 28px"><div style="background:linear-gradient(135deg,#fffcf9,#fff5eb);border:1px solid rgba(239,75,26,.22);border-radius:16px;padding:16px 22px;font-size:14px;color:#475569;line-height:1.9"><b style="color:#1e293b">%s</b> <a href="%s" style="color:#ef4b1a;font-weight:900">%s</a> <a href="../rfq/" style="color:#0e7490;font-weight:900">ثبت استعلام ←</a></div></div>\n'
        '</div>\n</div>\n'
    ) % (category, h1, lead, sec_html, cta_label, cta_link, cta_link_text)


def build_page(slug, title, meta_desc, og_title, og_desc, breadcrumb_name,
               category, h1, lead, sections, faq, about, cta_link, cta_link_text, cta_label):
    t = read(TEMPLATE)
    url = BASE_URL + '/knowledge-center/' + slug
    # --- هد: تایتل/توضیح/canonical/hreflang ---
    t = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, t, count=1)
    t = re.sub(r'<meta name="description" content="[^"]*" />',
               '<meta name="description" content="%s" />' % meta_desc, t, count=1)
    t = t.replace('<link rel="canonical" href="https://pishtaj.ir/knowledge-center/kc-api-5l-psl2-sour-service-nace-requirements.html" />',
                  '<link rel="canonical" href="%s" />' % url, 1)
    t = t.replace('href="https://pishtaj.ir/knowledge-center/kc-api-5l-psl2-sour-service-nace-requirements.html"',
                  'href="%s"' % url)
    t = t.replace('content="https://pishtaj.ir/knowledge-center/kc-api-5l-psl2-sour-service-nace-requirements.html"',
                  'content="%s"' % url)
    t = re.sub(r'<meta property="og:title" content="[^"]*" />',
               '<meta property="og:title" content="%s" />' % og_title, t, count=1)
    t = re.sub(r'<meta property="og:description" content="[^"]*" />',
               '<meta property="og:description" content="%s" />' % og_desc, t, count=1)
    t = re.sub(r'<meta name="twitter:title" content="[^"]*" />',
               '<meta name="twitter:title" content="%s" />' % og_title, t, count=1)
    t = re.sub(r'<meta name="twitter:description" content="[^"]*" />',
               '<meta name="twitter:description" content="%s" />' % og_desc, t, count=1)
    # --- JSON-LD ---
    ld = build_ld(breadcrumb_name, og_title, meta_desc, category, about, faq, url)
    t = re.sub(r'<script type="application/ld\+json">.*?</script>', ld, t, count=1, flags=re.S)
    # --- breadcrumb صفحه ---
    t = re.sub(r'<span aria-current="page">[^<]*</span>',
               '<span aria-current="page">%s</span>' % breadcrumb_name, t, count=1)
    # --- ناحیهٔ محتوا ---
    sec_start = t.find('<section class="article-hero">')
    footer_start = t.find('<footer')
    assert sec_start > 0 and footer_start > sec_start
    content = build_content(category, h1, lead, sections, cta_link, cta_link_text, cta_label)
    t = t[:sec_start] + content + t[footer_start:]
    write('knowledge-center/' + slug, t)
    return 'knowledge-center/' + slug


# =====================================================================================
# ۱) فلنج اراک
# =====================================================================================
flange_faq = [
    ("فلنج اراک یعنی چه؟",
     "فلنج اراک به فلنج‌های فولادی فورجی گفته می‌شود که عمدتاً در کارگاه‌های فورجینگ شهرستان اراک — یکی از قطب‌های ساخت فلنج ایران — تولید می‌شوند و در بازار پایپینگ به همین نام شناخته می‌شوند."),
    ("تفاوت فلنج فورجی و ریخته‌گری چیست؟",
     "فلنج فورجی از شمش فولاد با عملیات آهنگری ساخته می‌شود و ساختار دانه‌ای یکنواخت و بدون تخلخل دارد؛ فلنج ریخته‌گری مانند A216 WCB از مذاب ریخته می‌شود و برای کلاس‌های بالا و سرویس‌های حساس معمولاً فلنج فورجی (A105، A182 و…) الزامی است."),
    ("برای خرید فلنج اراک چه استانداردی را ذکر کنم؟",
     "برای سایزهای ۱/۲ تا ۲۴ اینچ استاندارد ASME B16.5 و برای قطرهای بزرگ‌تر (۲۶ تا ۶۰ اینچ) استاندارد ASME B16.47 (سری A یا B) ذکر شود؛ در پروژه‌های اروپایی EN 1092-1 نیز رایج است."),
    ("چطور از اصالت گواهی MTC فلنج اراک مطمئن شوم؟",
     "با تطبیق شمارهٔ هیت درج‌شده روی بدنه با گواهی MTC، کنترل آنالیز شیمیایی و خواص مکانیکی طبق EN 10204 (نوع 3.1 یا 3.2)، انجام PMI و در صورت نیاز بازرسی شخص ثالث (TPI)."),
]
flange_sections = [
    ("فلنج اراک چیست و چرا اراک قطب تولید فلنج است؟",
     '<p>اراک به‌واسطهٔ استقرار خط‌های فورجینگ و صنایع فولادی، به یکی از مراکز اصلی ساخت <b>فلنج فولادی فورجی</b> در ایران تبدیل شده است. در ادبیات خرید تجهیزات پایپینگ، «فلنج اراک» به فلنج‌های تولیدشده در این منطقه گفته می‌شود و مزیت اصلی آن دسترسی مستقیم به خط تولید، قیمت رقابتی و تحویل سریع‌تر برای سایزهای رایج است. با این حال، کیفیت بین کارگاه‌ها یکسان نیست؛ بنابراین انتخاب باید بر پایهٔ استاندارد، گواهی و راستی‌آزمایی باشد، نه صرفاً قیمت.</p>'),
    ("استانداردهای ساخت فلنج اراک",
     '<p>فلنج باید صراحتاً بر اساس یک استاندارد ابعادی و فشاری ساخته و مارک شود:</p>\n<ul>\n<li><b>ASME B16.5</b> — فلنج لوله از NPS 1/2 تا NPS 24، کلاس‌های 150 تا 2500.</li>\n<li><b>ASME B16.47</b> — فلنج قطر بزرگ NPS 26 تا NPS 60 (سری A = MSS SP-44، سری B = API 605).</li>\n<li><b>MSS SP-44</b> — فلنج فولادی قطر بزرگ صنایع نفت.</li>\n<li><b>EN 1092-1 / DIN 2632-2635</b> — استاندارد اروپایی (PN).</li>\n</ul>\n<p>ذکر نکردن استاندارد و کلاس فشار در استعلام، بزرگ‌ترین خطای خرید فلنج است؛ ابعاد drilling فلنج بین استانداردها یکسان نیست.</p>'),
    ("متریال رایج فلنج اراک",
     '<p>متریال بدنه باید با متریال لوله و شرایط سرویس هم‌خوان باشد:</p>\n<ul>\n<li><b>ASTM A105</b> — کربن‌استیل فورجی برای سرویس عمومی (پرکاربردترین).</li>\n<li><b>ASTM A350 LF2</b> — کربن‌استیل فورجی برای دمای پایین (تا -46°C).</li>\n<li><b>ASTM A182 F304 / F316</b> — فورجی استینلس‌استیل برای سرویس خورنده.</li>\n<li><b>ASTM A694 F52 / F65</b> — فورجی پرفشار برای خطوط انتقال گاز.</li>\n</ul>'),
    ("فلنج فورجی در برابر ریخته‌گری — چرا فورج مهم است؟",
     '<p>فرایند فورجینگ با تغییر شکل مکانیکی شمش، ساختار دانه‌ای فلز را متراکم و یکنواخت می‌کند و تخلخل‌های داخلی را حذف می‌نماید؛ در نتیجه فلنج فورجی استحکام و مقاومت به ضربهٔ بهتری نسبت به ریخته‌گری دارد. برای کلاس‌های فشار بالا، دماهای بالا و سرویس ترش (NACE)، فلنج فورجی عملاً الزامی است. فلنج ریخته‌گری (مثلاً A216 WCB) فقط در برخی کاربردهای کم‌فشار مجاز است و نباید به‌جای A105 فورجی عرضه شود.</p>'),
    ("راستی‌آزمایی کیفیت و گواهی فلنج اراک",
     '<p>برای اطمینان از کیفیت، این اقلام را کنترل کنید:</p>\n<ul>\n<li><b>گواهی MTC</b> طبق EN 10204 نوع 3.1 (تأیید سازنده) یا 3.2 (تأیید بازرس مستقل).</li>\n<li><b>آنالیز شیمیایی و خواص مکانیکی</b> — تطبیق با استاندارد متریال (A105 و…).</li>\n<li><b>سختی</b> — به‌ویژه در سرویس ترش (محدودیت NACE).</li>\n<li><b>PMI</b> — شناسایی مثبت متریال برای جلوگیری از اختلاط گرید.</li>\n<li><b>مارکینگ</b> — استاندارد، متریال، کلاس، سایز، Face و شمارهٔ هیت باید روی بدنه خوانا باشد.</li>\n<li><b>بازرسی TPI</b> — برای محموله‌های پروژه‌ای، بازرسی شخص ثالث در محل کارگاه توصیه می‌شود.</li>\n</ul>'),
    ("نکات خرید و چک‌لیست استعلام فلنج اراک",
     '<p>در RFQ این موارد را صریح قید کنید تا پیشنهادها قابل مقایسه باشند:</p>\n<ul>\n<li>استاندارد (ASME B16.5 / B16.47 / EN 1092-1) و کلاس فشار.</li>\n<li>سایز (NPS) و Schedule / ضخامت مچ‌شونده با لوله.</li>\n<li>متریال بدنه و الزامات مکمل (دمای پایین / سرویس ترش / HIC).</li>\n<li>نوع Face (RF / RTJ / FF) و نوع اتصال (WN / SO / Blind / SW / LJ / Threaded).</li>\n<li>نوع گواهی (EN 10204 3.1 یا 3.2) و الزام بازرسی TPI.</li>\n<li>استاندارد ابعادی Bolting و نوع گسکت هم‌خانواده.</li>\n</ul>'),
    ("جمع‌بندی",
     '<p>خرید فلنج اراک اگر بر پایهٔ استاندارد دقیق، گواهی قابل راستی‌آزمایی و کنترل متریال انجام شود، گزینه‌ای اقتصادی و قابل اتکا برای پروژه‌های نفت، گاز و پتروشیمی است؛ اما بدون این کنترل‌ها، صرفه‌جویی اولیه می‌تواند به هزینهٔ بسیار بزرگ‌تری در مرحلهٔ بازرسی یا بهره‌برداری تبدیل شود.</p>'),
]
flange_cta = ("نیاز به تامین فلنج و اتصالات پایپینگ دارید؟", "پیشرو تجهیز فرتاک به‌عنوان",
              "../suppliers/flange-supplier.html", "تامین‌کننده فلنج صنعتی")

build_page(
    slug='flange-arak-guide.html',
    title='فلنج اراک؛ راهنمای خرید، استانداردها و راستی‌آزمایی کیفیت | پیشرو تجهیز فرتاک',
    meta_desc='راهنمای کامل فلنج اراک — چرا اراک قطب فورجینگ فلنج ایران است، استانداردهای ASME B16.5 و B16.47، تفاوت فلنج فورجی و ریخته‌گری، راستی‌آزمایی گواهی MTC و چک‌لیست استعلام برای پروژه‌های نفت، گاز و پتروشیمی.',
    og_title='فلنج اراک؛ راهنمای خرید، استانداردها و راستی‌آزمایی کیفیت',
    og_desc='فلنج اراک — قطب فورجینگ فلنج ایران؛ استانداردهای ASME B16.5/B16.47، تفاوت فورج و ریخته‌گری، راستی‌آزمایی MTC و چک‌لیست استعلام.',
    breadcrumb_name='فلنج اراک',
    category='لوله و پایپینگ',
    h1='فلنج اراک — راهنمای خرید، استانداردها و راستی‌آزمایی کیفیت',
    lead='<p style="font-size:17px"><b>فلنج اراک</b> — در بازار تجهیزات پایپینگ ایران، این نام به فلنج‌های فولادی فورجی اشاره دارد که در کارگاه‌های فورجینگ اراک تولید می‌شوند. این مقاله به استانداردهای ساخت، تفاوت فورج و ریخته‌گری، روش راستی‌آزمایی گواهی و چک‌لیست استعلام می‌پردازد تا خرید بر پایهٔ مشخصات فنی انجام شود، نه صرفاً قیمت. برای آشنایی با انواع فلنج، <a href="flange-types-complete-guide.html">راهنمای انواع فلنج صنعتی</a> را ببینید.</p>',
    sections=flange_sections,
    faq=flange_faq,
    about=['لوله و پایپینگ', 'فلنج', 'اراک', 'فورجینگ', 'ASME', 'استعلام'],
    cta_link='../suppliers/flange-supplier.html',
    cta_link_text='تامین‌کننده فلنج صنعتی',
    cta_label='نیاز به تامین فلنج و اتصالات پایپینگ دارید؟',
)

# =====================================================================================
# ۲) ترانسمیتر فشار روزمونت (خانواده)
# =====================================================================================
rosemount_faq = [
    ("تفاوت Rosemount 3051 و 2088 چیست؟",
     "3051 ترانسمیتر Coplanar با قابلیت DP/GP/AP برای کاربردهای گسترده‌تر است؛ 2088 ترانسمیتر Inline جمع‌وجور برای اندازه‌گیری فشار گیج و مطلق در کاربردهای ساده‌تر است."),
    ("3051C و 3051T چه تفاوتی دارند؟",
     "3051C از نوع Coplanar است (دیافراگم هم‌صفحه برای DP و GP) و 3051T از نوع Inline است (سنسور مستقیم برای GP و AP)؛ انتخاب به نوع اندازه‌گیری و محل نصب بستگی دارد."),
    ("آیا برای خرید روزمونت حتماً نمایندگی رسمی لازم است؟",
     "خیر. مسیر سورسینگ با کنترل اصالت (Model Code، شماره سریال، مدارک و بسته‌بندی) نیز معتبر است، مشروط بر اینکه تأمین‌کننده شفاف باشد و ادعای نمایندگی رسمی نکند."),
    ("Model Code ترانسمیتر روزمونت را چطور بخوانم؟",
     "Model Code رشته‌ای است که نوع سنسور، رنج، متریال wetted parts، خروجی، کانکشن فرایندی و گواهی را مشخص می‌کند؛ هر بخش آن باید با دیتاشیت پروژه تطبیق داده شود."),
]
rosemount_sections = [
    ("خانوادهٔ ترانسمیتر فشار روزمونت",
     '<p>روزمونت (Emerson) گسترده‌ترین خانوادهٔ ترانسمیتر فشار صنعتی را ارائه می‌دهد. شناخت سری‌ها و تفاوت آن‌ها اولین قدم برای انتخاب درست است:</p>\n<ul>\n<li><b>3051</b> — خانوادهٔ اصلی و پرکاربردترین (Coplanar و Inline).</li>\n<li><b>2088</b> — ترانسمیتر Inline جمع‌وجور برای فشار گیج/مطلق.</li>\n<li><b>3095</b> — ترانسمیتر چندمتغیره (Multivariable) برای اندازه‌گیری دبی جرمی.</li>\n<li><b>3051S</b> — نسل Scalable با دقت بالا (SuperModule).</li>\n<li><b>Wireless</b> — نسخه‌های WirelessHART برای نصب بدون کابل.</li>\n</ul>'),
    ("مدل‌های اصلی و جایگاه هرکدام",
     '<p><b>Rosemount 3051</b> در سه پیکربندی اصلی عرضه می‌شود: <b>3051C</b> (Coplanar — برای فشار اختلافی و گیج با دیافراگم هم‌صفحه)، <b>3051T</b> (Inline — فشار گیج/مطلق با اتصال مستقیم) و <b>3051L</b> (سطح مایع با فلنج و Remote Seal). <b>Rosemount 2088</b> برای اندازه‌گیری سادهٔ فشار گیج و مطلق با بدنهٔ جمع‌وجور و قیمت پایین‌تر طراحی شده است. <b>3095</b> با اندازه‌گیری هم‌زمان DP، فشار استاتیک و دما، دبی جرمی را بدون نیاز به تجهیز جدا محاسبه می‌کند.</p>'),
    ("تفاوت 3051 و 2088 — کدام را انتخاب کنم؟",
     '<p>اگر به اندازه‌گیری <b>فشار اختلافی (DP)</b> برای فلو، سطح یا فشار با دقت بالا و رنج‌پذیری زیاد نیاز دارید، 3051 Coplanar انتخاب درست است. اگر فقط <b>فشار گیج یا مطلق</b> در یک نقطه با بودجهٔ محدودتر نیاز دارید، 2088 کفایت می‌کند. انتخاب اشتباه (مثلاً 2088 برای DP) از نظر فنی ممکن نیست؛ بنابراین اول نوع اندازه‌گیری را مشخص کنید.</p>'),
    ("رمزگشایی Model Code روزمونت",
     '<p>هر ترانسمیتر روزمونت با یک Model Code یکتا مشخص می‌شود که همهٔ مشخصات را در خود دارد. برای مثال <b>3051CD2A22A1AB4M5</b> به‌تفکیک بخش‌ها بیانگر نوع سنسور (CD = Coplanar DP)، رنج، متریال دیافراگم، خروجی (A = 4-20mA HART)، کانکشن فرایندی و گواهی است. هنگام خرید، Model Code پیشنهادی باید حرف‌به‌حرف با دیتاشیت پروژه تطبیق داده شود؛ تغییر یک حرف ممکن است متریال یا گواهی را عوض کند.</p>'),
    ("پارامترهای کلیدی انتخاب ترانسمیتر فشار روزمونت",
     '<ul>\n<li><b>رنج و رنج‌پذیری (Turndown)</b> — پوشش حداقل تا حداکثر فشار فرایند.</li>\n<li><b>متریال wetted parts</b> — دیافراگم (316L، Hastelloy، Tantalum و…) بر اساس خورندگی سیال.</li>\n<li><b>خروجی و پروتکل</b> — HART، FOUNDATION Fieldbus یا WirelessHART.</li>\n<li><b>گواهی Ex</b> — ATEX / IECEx برای محیط‌های قابل اشتعال.</li>\n<li><b>Remote Seal</b> — برای سیالات خورنده، دما بالا یا نصب با فلنج.</li>\n</ul>'),
    ("نمایندگی و کنترل اصالت روزمونت",
     '<p>بین «نمایندگی رسمی» و «سورسینگ» تفاوت مهمی وجود دارد. نمایندگی رسمی قرارداد مستقیم با سازنده دارد؛ سورسینگ یعنی تامین از شبکهٔ توزیع مجاز با کنترل اصالت. برای کالای stock باید وضعیت new/unused، شماره سریال، سال ساخت، firmware، گواهی و سازگاری Model Code بررسی شود. برای جزئیات بیشتر، <a href="../brands/emerson-rosemount.html">راهنمای سورسینگ و نمایندگی روزمونت/امرسون</a> را ببینید.</p>'),
    ("نکات استعلام ترانسمیتر فشار روزمونت",
     '<p>در RFQ این موارد را قید کنید: Model Code کامل یا مشخصات معادل (نوع، رنج، متریال، خروجی، گواهی)، نوع اتصال فرایندی، نیاز به Remote Seal، گواهی کالیبراسیون و انطباق با Vendor List پروژه. برای مدل 3051، <a href="../services/products/rosemount-3051.html">صفحهٔ تامین ترانسمیتر فشار Rosemount 3051</a> را نیز ببینید.</p>'),
    ("جمع‌بندی",
     '<p>انتخاب ترانسمیتر فشار روزمونت باید از نوع اندازه‌گیری (DP/GP/AP)، شرایط فرایند و Model Code دقیق شروع شود. با شفاف‌کردن این مشخصات در استعلام، پیشنهادهای فنی قابل مقایسه می‌شوند و ریسک دریافت کالای ناسازگار به حداقل می‌رسد.</p>'),
]
rosemount_cta = ("نیاز به تامین ابزار دقیق دارید؟", "پیشرو تجهیز فرتاک به‌عنوان",
                 "../suppliers/instrumentation-supplier.html", "تامین‌کننده تجهیزات ابزار دقیق")

build_page(
    slug='rosemount-pressure-transmitter-family.html',
    title='ترانسمیتر فشار روزمونت؛ خانواده‌ی 3051 و 2088 و راهنمای انتخاب | پیشرو تجهیز فرتاک',
    meta_desc='راهنمای کامل ترانسمیتر فشار روزمونت — خانواده‌ی Rosemount 3051 (Coplanar)، 2088 (Inline)، 3095 و 3051S، رمزگشایی Model Code، پارامترهای انتخاب، کنترل اصالت و مسیر استعلام.',
    og_title='ترانسمیتر فشار روزمونت؛ خانواده‌ی 3051 و 2088 و راهنمای انتخاب',
    og_desc='خانوادهٔ ترانسمیتر فشار روزمونت — 3051 Coplanar، 2088 Inline، 3095 و 3051S؛ رمزگشایی Model Code و راهنمای انتخاب.',
    breadcrumb_name='ترانسمیتر فشار روزمونت',
    category='ابزار دقیق و اندازه‌گیری',
    h1='ترانسمیتر فشار روزمونت — خانواده‌ی 3051 و 2088 و راهنمای انتخاب',
    lead='<p style="font-size:17px"><b>ترانسمیتر فشار روزمونت</b> — این مقاله خانوادهٔ ترانسمیتر فشار Rosemount را معرفی می‌کند: تفاوت سری‌های 3051، 2088، 3095 و 3051S، رمزگشایی Model Code و پارامترهای کلیدی انتخاب، تا پیش از استعلام بدانید دقیقاً چه مشخصاتی را باید قید کنید. برای مقایسه با برند دیگر، <a href="rosemount-vs-yokogawa-comparison.html">مقایسه ترانسمیتر Rosemount و Yokogawa</a> را ببینید.</p>',
    sections=rosemount_sections,
    faq=rosemount_faq,
    about=['ابزار دقیق و اندازه‌گیری', 'ترانسمیتر', 'فشار', 'روزمونت', '3051', 'استعلام'],
    cta_link='../suppliers/instrumentation-supplier.html',
    cta_link_text='تامین‌کننده تجهیزات ابزار دقیق',
    cta_label='نیاز به تامین ابزار دقیق دارید؟',
)

# =====================================================================================
# ۳) استانداردهای شیرآلات صنعتی (هاب موضوعی)
# =====================================================================================
valve_faq = [
    ("کدام استاندارد برای گیت ولو است؟",
     "گیت ولو فلنجی و بات‌ولد طبق API 600، و گیت ولو سایز کوچک (تا NPS 4) طبق API 602 طراحی و ساخت می‌شود؛ برای شیرهای مقاوم به خوردگی API 603 کاربرد دارد."),
    ("تست نشتی شیرآلات با چه استانداردی انجام می‌شود؟",
     "تست نشتی نشیمنگاه و پوستهٔ شیرآلات معمولاً طبق API 598 یا ISO 5208 انجام می‌شود؛ برای کنترل ولو از FCI 70-2 استفاده می‌شود."),
    ("تفاوت API 6D و API 600 چیست؟",
     "API 6D استاندارد شیرهای خطوط لولهٔ انتقال (بال ولو، گیت ولو و چک ولو) است؛ API 600 استاندارد گیت ولوهای فلنجی پالایشگاهی است و الزامات متفاوتی دارند."),
    ("استاندارد تست آتش شیر چیست؟",
     "تست آتش (Fire Safe) شیرهای چرخ‌ربع‌گرد طبق API 607 یا ISO 10497 انجام می‌شود؛ برای شیرهای دیگر API 6FA نیز کاربرد دارد."),
]
valve_sections = [
    ("چرا استاندارد شیرآلات صنعتی تعیین‌کننده است؟",
     '<p>استاندارد، مرجع طراحی، متریال، ابعاد وجه به وجه، ریتینگ فشار-دما، روش تست و مارکینگ شیر را مشخص می‌کند. ذکر نکردن استاندارد دقیق در استعلام یعنی باز گذاشتن مهم‌ترین متغیر فنی؛ نتیجهٔ معمول آن، پیشنهادهای غیرقابل مقایسه و ریسک کالای ناسازگار با پروژه است.</p>'),
    ("استانداردهای طراحی و ساخت",
     '<ul>\n<li><b>ASME B16.34</b> — طراحی و ریتینگ فشار-دمای شیرهای فلنجی، رزوه‌ای و جوشی.</li>\n<li><b>API 600</b> — گیت ولو فولادی فلنجی و بات‌ولد.</li>\n<li><b>API 602</b> — گیت ولو فشرده سایز کوچک (تا NPS 4).</li>\n<li><b>API 603</b> — گیت ولو مقاوم به خوردگی با درپوش پیچ‌شده.</li>\n<li><b>API 6D</b> — شیرهای خطوط لوله (بال، گیت، چک، سماوری).</li>\n<li><b>API 623</b> — گلوب ولو فولادی.</li>\n</ul>'),
    ("استانداردهای تست و نشتی",
     '<p>کیفیت آب‌بندی شیر با تست فشار پوسته (Shell) و نشتی نشیمنگاه (Seat/Closure) ارزیابی می‌شود:</p>\n<ul>\n<li><b>API 598</b> — بازرسی و تست شیرآلات صنعتی (پرکاربردترین مرجع تست).</li>\n<li><b>ISO 5208</b> — تست فشار شیرآلات صنعتی.</li>\n<li><b>FCI 70-2</b> — نشتی نشیمنگاه کنترل ولو (کلاس‌های I تا VI).</li>\n</ul>'),
    ("استانداردهای تست آتش (Fire Safe)",
     '<p>برای شیرهایی که در صورت آتش‌سوزی نباید نشتی فاجعه‌بار داشته باشند، طراحی و تست ضد حریق الزامی است:</p>\n<ul>\n<li><b>API 607</b> — تست آتش شیرهای چرخ‌ربع‌گرد (بال ولو و باترفلای).</li>\n<li><b>API 6FA</b> — تست آتش شیرها (نسخهٔ قدیمی‌تر).</li>\n<li><b>ISO 10497</b> — تست آتش شیرها (معادل بین‌المللی API 607).</li>\n</ul>'),
    ("استانداردهای شیر پروانه‌ای و یک‌طرفه",
     '<ul>\n<li><b>API 609</b> — شیر پروانه‌ای (Butterfly Valve).</li>\n<li><b>API 594</b> — شیر یک‌طرفه (Check Valve).</li>\n<li><b>API 608</b> — بال ولو فلنجی با فلنج انتگرال.</li>\n</ul>'),
    ("جدول انتخاب استاندارد بر اساس نوع شیر",
     '<p>خلاصهٔ پرکاربردترین نگاشت نوع شیر به استاندارد:</p>\n<ul>\n<li><b>گیت ولو (Gate)</b> → API 600 / 602 / 603</li>\n<li><b>بال ولو (Ball)</b> → API 6D / 608</li>\n<li><b>باترفلای (Butterfly)</b> → API 609</li>\n<li><b>گلوب ولو (Globe)</b> → API 623 / 602</li>\n<li><b>چک ولو (Check)</b> → API 594</li>\n<li><b>تست نشتی</b> → API 598 / ISO 5208</li>\n<li><b>تست آتش</b> → API 607 / ISO 10497</li>\n</ul>'),
    ("نکات استعلام شیرآلات با استاندارد دقیق",
     '<p>در RFQ صراحتاً قید کنید: نوع شیر و استاندارد ساخت، متریال بدنه و تریم، کلاس فشار و ریتینگ دما، نوع اتصال، استاندارد تست و کلاس نشتی، الزام تست آتش (در صورت نیاز) و نوع گواهی. برای مقالات تفصیلی، <a href="api-600-gate-valve-standard.html">استاندارد API 600</a> و <a href="api-6d-ball-valve-standard.html">استاندارد API 6D</a> را ببینید.</p>'),
    ("جمع‌بندی",
     '<p>استاندارد شیرآلات، زبان مشترک بین کارفرما، مهندس مشاور و تامین‌کننده است. ذکر دقیق استاندارد در استعلام، هم کیفیت را تضمین می‌کند و هم از اختلاف‌نظر در مرحلهٔ بازرسی و تحویل جلوگیری می‌نماید.</p>'),
]
valve_cta = ("نیاز به تامین شیرآلات صنعتی دارید؟", "پیشرو تجهیز فرتاک به‌عنوان",
             "../suppliers/valve-supplier.html", "تامین‌کننده شیرآلات صنعتی")

build_page(
    slug='industrial-valve-standards-guide.html',
    title='استانداردهای شیرآلات صنعتی؛ API 600، ASME B16.34 و ISO 5208 | پیشرو تجهیز فرتاک',
    meta_desc='راهنمای جامع استانداردهای شیرآلات صنعتی — API 600/602/603/6D برای طراحی و ساخت، API 598 و ISO 5208 برای تست نشتی، API 607 برای تست آتش، ASME B16.34 و جدول انتخاب استاندارد بر اساس نوع شیر.',
    og_title='استانداردهای شیرآلات صنعتی؛ API 600، ASME B16.34 و ISO 5208',
    og_desc='راهنمای استانداردهای شیرآلات صنعتی — طراحی و ساخت (API 600/6D)، تست نشتی (API 598/ISO 5208)، تست آتش (API 607) و جدول انتخاب.',
    breadcrumb_name='استانداردهای شیرآلات صنعتی',
    category='شیرآلات صنعتی',
    h1='استانداردهای شیرآلات صنعتی — API، ASME و ISO',
    lead='<p style="font-size:17px"><b>استانداردهای شیرآلات صنعتی</b> — این راهنما مهم‌ترین استانداردهای طراحی، ساخت، تست نشتی و تست آتش شیرآلات را یک‌جا جمع کرده است تا هنگام استعلام بدانید برای هر نوع شیر دقیقاً کدام استاندارد را ذکر کنید. این صفحه به‌عنوان هاب، به مقاله‌های تفصیلی استانداردها لینک می‌دهد.</p>',
    sections=valve_sections,
    faq=valve_faq,
    about=['شیرآلات صنعتی', 'استاندارد', 'API', 'ASME', 'ISO', 'تست'],
    cta_link='../suppliers/valve-supplier.html',
    cta_link_text='تامین‌کننده شیرآلات صنعتی',
    cta_label='نیاز به تامین شیرآلات صنعتی دارید؟',
)

print('ساخته شد:')
for f in ['knowledge-center/flange-arak-guide.html',
          'knowledge-center/rosemount-pressure-transmitter-family.html',
          'knowledge-center/industrial-valve-standards-guide.html']:
    t = read(f)
    n = len(re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S))
    json.loads(re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)[0])
    words = len(re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>', '', t, flags=re.S)).split())
    print('  %s | ld-blocks=%d | words≈%d' % (f, n, words))
