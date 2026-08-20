#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام A1 سئو (2026-08-20) — idempotent:
1) تفکیک نیت دو صفحهٔ پتروشیمی (تایتل/H1/توضیح صفحهٔ صنعت + لینک متقابل)
2) متن معرفی برای سه هاب لاغر (comparisons/blog/knowledge-center)
3) لینک زمینه‌ای از پست‌های بلاگ به مقایسه‌های مرتبط (بدون بلوک قالبی تکراری)
4) به‌روزرسانی lastmod سایت‌مپ برای URLهای تغییرکرده
"""
import re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = '2026-08-20'
changed = []

def rd(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

def wr(p, s):
    with open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f:
        f.write(s)
    changed.append(p)

# ---------- ۱) تفکیک پتروشیمی ----------
def fix_petro():
    p = 'industries/petrochemical/index.html'
    s = rd(p)
    if 'data-a1-petro="yes"' in s:
        print('skip (done):', p); return
    s = s.replace(
        '<title>تامین‌کننده تجهیزات پتروشیمی | پیشرو تجهیز فرتاک</title>',
        '<title>تجهیزات صنعت پتروشیمی؛ راهنمای تامین واحدهای الفین و آروماتیک | پیشرو تجهیز فرتاک</title>')
    s = re.sub(
        r'(name="description" content=")[^"]*(")',
        r'\1راهنمای تجهیزات صنایع پتروشیمی: پایپینگ، ابزار دقیق، برق و تجهیزات دوار واحدهای الفین، آروماتیک و یوتیلیتی؛ الزامات متریال، استانداردها و مسیر تامین.\2',
        s, count=1)
    s = s.replace(
        'تامین تجهیزات پتروشیمی — تامین\u200cکننده تجهیزات صنایع پتروشیمی (Petrochemical)',
        'تجهیزات صنعت پتروشیمی — نقشهٔ تامین واحدهای الفین، آروماتیک و یوتیلیتی')
    # لینک متقابل نیت تجاری، بعد از H1
    h1_end = s.find('</h1>')
    if h1_end > -1 and 'petrochemical-equipment-supplier' not in s[:h1_end + 2000]:
        inject = ('</h1><p data-a1-petro="yes" style="margin-top:10px;font-size:14px">این صفحه راهنمای فنی '
                  'تجهیزات واحدهای پتروشیمی است؛ اگر برای پروژه به دنبال استعلام و انتخاب تامین‌کننده هستید، '
                  'مستقیم به صفحهٔ <a href="../../suppliers/petrochemical-equipment-supplier.html">تامین‌کننده '
                  'تجهیزات پتروشیمی</a> بروید.</p>')
        s = s[:h1_end] + inject + s[h1_end + len('</h1>'):]
    else:
        s = s.replace('</h1>', '</h1><span data-a1-petro="yes" style="display:none"></span>', 1)
    wr(p, s)

# ---------- ۲) متن معرفی هاب‌ها ----------
HUB_INTROS = {
 'comparisons/index.html': ('cmp-hero', '''<section data-a1-intro="yes" style="max-width:1100px;margin:34px auto 0;padding:0 20px;font-size:14.5px;line-height:2;color:#475569">
<h2 style="color:#1e293b;font-size:19px">چرا مقایسهٔ A در برابر B، قبل از خرید تجهیزات صنعتی؟</h2>
<p>در پروژه‌های نفت، گاز و پتروشیمی بخش بزرگی از دوباره‌کاری‌ها و هزینه‌های پنهان، نتیجهٔ انتخاب اشتباه بین دو گزینهٔ به‌ظاهر هم‌ارز است: لولهٔ <a href="seamless-vs-erw-pipe.html">مانیسمان یا درزدار ERW</a>، متریال <a href="a106-vs-a333-pipe.html">A106 یا A333</a> در دمای پایین، شیر <a href="gate-vs-globe-valve.html">دروازه‌ای یا سوزنی</a> برای کنترل جریان، فلنج <a href="wn-vs-so-flange.html">گلودار یا اسلیپون</a> در کلاس‌های فشاری، یا ترانسمیتر <a href="rosemount-vs-yokogawa-transmitter.html">روزمونت یا یوکوگاوا</a> برای واحد فرآیندی. هر مقالهٔ این بخش دقیقاً برای همین لحظهٔ تصمیم نوشته شده است.</p>
<p>ساختار همهٔ مقایسه‌ها یکسان است تا سریع به جواب برسید: جدول مشخصات فنی رو‌در‌رو، سناریوهای کاربرد («کدام را کِی انتخاب کنیم»)، ملاحظات استاندارد (ASME، API، ASTM، NACE) و نکات تامین و بازرسی که از تجربهٔ واقعی سفارش‌های صنعتی می‌آید. اگر بعد از مقایسه به شناخت عمیق‌تر نیاز داشتید، مرجع کامل هر موضوع در <a href="../knowledge-center/">مرکز دانش فنی</a> با بیش از ۴۰۰ مقالهٔ تخصصی در دسترس است و راهنماهای خرید گام‌به‌گام را در <a href="../blog/">وبلاگ</a> می‌خوانید.</p>
<p>و وقتی تصمیم فنی نهایی شد، مسیر تامین همین‌جاست: مشخصات را از طریق <a href="../rfq/">ثبت استعلام (RFQ)</a> بفرستید یا مستقیم با <a href="../suppliers/">تامین‌کنندگی پیشرو تجهیز فرتاک</a> در حوزهٔ پایپینگ، شیرآلات، ابزار دقیق و برق صنعتی وارد گفتگو شوید — با مدارک MTC، امکان بازرسی شخص ثالث و انطباق Vendor List کارفرمایان بزرگ.</p>
</section>'''),
 'blog/index.html': ('blog-hero', '''<section data-a1-intro="yes" style="max-width:1050px;margin:30px auto 0;padding:0 20px;font-size:14.5px;line-height:2;color:#475569">
<h2 style="color:#1e293b;font-size:19px">راهنمای استفاده از وبلاگ تخصصی تجهیزات صنعتی</h2>
<p>این وبلاگ برای مهندس خرید، کارشناس فنی و مدیر پروژه‌ای نوشته می‌شود که باید برای تجهیزات حیاتی تصمیم بگیرد: از <a href="seamless-pipe-guide.html">لولهٔ مانیسمان</a> و <a href="flange-types-guide.html">انواع فلنج</a> تا <a href="pressure-transmitter-guide.html">ترانسمیتر فشار</a>، <a href="electrical-switchgear-guide.html">تابلو و سوییچگیر</a> و <a href="mtc-tpi-inspection-guide.html">بازرسی MTC و شخص ثالث</a>. مقاله‌ها بر اساس پرسش‌های واقعی پروژه‌های نفت، گاز و پتروشیمی ایران تنظیم شده‌اند، نه ترجمهٔ خام کاتالوگ.</p>
<p>سه نوع محتوا این‌جا پیدا می‌کنید: <b>راهنمای انتخاب و خرید</b> (معیارها، اشتباه‌های رایج، چک‌لیست استعلام)، <b>مبانی استاندارد</b> (ASME، API، ASTM، IEC به زبان کاربردی) و <b>فرآیند تامین</b> از ثبت RFQ تا بازرسی و تحویل. برای مقایسهٔ مستقیم دو گزینهٔ فنی، بخش <a href="../comparisons/">مقایسه‌های A در برابر B</a> را ببینید و برای مرجع عمیق هر کالا، <a href="../knowledge-center/">مرکز دانش ۴۵۰ مقاله‌ای</a> در کنار شماست.</p>
<p>اگر همین حالا فهرست کالا یا دیتاشیت در دست دارید، لازم نیست از مقاله شروع کنید — <a href="../rfq/">استعلام آنلاین</a> را ثبت کنید تا کارشناسان <a href="../suppliers/">تامین پیشرو تجهیز فرتاک</a> بررسی اولیه را انجام دهند.</p>
</section>'''),
 'knowledge-center/index.html': ('kc-hero-new', '''<section data-a1-intro="yes" style="max-width:1100px;margin:30px auto 0;padding:0 20px;font-size:14.5px;line-height:2;color:#475569">
<h2 style="color:#1e293b;font-size:19px">مرکز دانش چیست و چطور از آن استفاده کنید؟</h2>
<p>مرکز دانش پیشرو تجهیز فرتاک با بیش از <b>۴۵۰ مقالهٔ فنی</b>، بزرگ‌ترین مرجع فارسی حوزهٔ تجهیزات ثابت و دوار، پایپینگ، شیرآلات، ابزار دقیق و برق صنعتی است. هر مدخل حول یک پرسش مهندسی مشخص نوشته شده: مشخصات یک متریال (مثل A106 Gr.B یا استنلس 316)، الزامات یک استاندارد (ASME B16.5، API 600، NACE MR0175)، یا معیار انتخاب یک تجهیز در سرویس مشخص.</p>
<p>مسیر پیشنهادی استفاده: اگر بین دو گزینه مردد هستید از <a href="../comparisons/">مقایسه‌های فنی</a> شروع کنید؛ اگر می‌خواهید فرآیند خرید را درست طی کنید، <a href="../blog/">راهنماهای وبلاگ</a> را بخوانید؛ و برای جزئیات فنی هر قلم، همین‌جا جستجو کنید — <a href="../search/">جستجوی سراسری سایت</a> همهٔ مدخل‌ها را پوشش می‌دهد. دسته‌بندی‌های پربازدید: متریال و لولهٔ آلیاژی، فلنج و اتصالات، گسکت و آب‌بندی، شیرآلات صنعتی، ترانسمیتر و ادوات ابزار دقیق، موتور و درایو و سوییچگیر.</p>
<p>این دانش مستقیماً به تامین وصل است: هر مقاله به صفحهٔ <a href="../suppliers/">تامین‌کنندهٔ مرتبط</a> لینک دارد و اگر مشخصات نهایی است، <a href="../rfq/">ثبت استعلام</a> کمتر از پنج دقیقه وقت می‌گیرد. برای کالاهای برنددار، صفحات <a href="../brands/">برندهای جهانی</a> (روزمونت، فیشر، زیمنس، ویکا و…) اطلاعات سری‌های اصلی را جمع کرده‌اند.</p>
</section>'''),
}

def add_hub_intros():
    for p, (hero_cls, block) in HUB_INTROS.items():
        s = rd(p)
        if 'data-a1-intro="yes"' in s:
            print('skip (done):', p); continue
        i = s.find(hero_cls)
        if i < 0:
            print('!! hero not found:', p); continue
        j = s.find('</section>', i)
        if j < 0:
            print('!! hero close not found:', p); continue
        j += len('</section>')
        wr(p, s[:j] + '\n' + block + '\n' + s[j:])

# ---------- ۳) لینک زمینه‌ای بلاگ → مقایسه‌ها ----------
BLOG_LINKS = {
 'blog/a106-vs-a333-pipes.html':
   '<p data-a1-link="yes">اگر فقط جمع‌بندی می‌خواهید، <a href="../comparisons/a106-vs-a333-pipe.html">جدول تصمیم A106 در برابر A333</a> همین مقایسه را در یک نگاه با سناریوهای دمایی خلاصه کرده است.</p>',
 'blog/seamless-pipe-guide.html':
   '<p data-a1-link="yes">پیش از نهایی‌کردن متریال، مقایسهٔ <a href="../comparisons/seamless-vs-erw-pipe.html">لوله مانیسمان در برابر درزدار ERW</a> را ببینید تا محدودیت‌های هر روش ساخت در سرویس شما روشن شود.</p>',
 'blog/ball-valve-selection-guide.html':
   '<p data-a1-link="yes">اگر بین شیر توپی و پروانه‌ای برای قطع‌ووصل خط مردد هستید، <a href="../comparisons/ball-vs-butterfly-valve.html">مقایسهٔ Ball در برابر Butterfly</a> معیارهای سایز، افت فشار و هزینه را کنار هم گذاشته است.</p>',
 'blog/industrial-valves-complete-guide.html':
   '<p data-a1-link="yes">برای دو تصمیم پرتکرار این حوزه، مقایسه‌های اختصاصی داریم: <a href="../comparisons/gate-vs-globe-valve.html">شیر دروازه‌ای در برابر سوزنی</a> برای قطع/کنترل جریان و <a href="../comparisons/ball-vs-butterfly-valve.html">توپی در برابر پروانه‌ای</a> برای خطوط سایز بالا.</p>',
 'blog/flange-types-guide.html':
   '<p data-a1-link="yes">پرتکرارترین ابهام خریداران، انتخاب بین گلودار و اسلیپون است — <a href="../comparisons/wn-vs-so-flange.html">مقایسهٔ فلنج WN در برابر SO</a> این تصمیم را با جدول فشار-دما ساده می‌کند.</p>',
 'blog/pressure-transmitter-guide.html':
   '<p data-a1-link="yes">در مرحلهٔ انتخاب برند، <a href="../comparisons/rosemount-vs-yokogawa-transmitter.html">مقایسهٔ ترانسمیتر روزمونت در برابر یوکوگاوا</a> دقت، پایداری و ملاحظات تامین هر دو را رو‌در‌رو بررسی کرده است.</p>',
 'blog/electrical-switchgear-guide.html':
   '<p data-a1-link="yes">برای انتخاب بریکر فشار متوسط، <a href="../comparisons/vcb-vs-acb-switchgear.html">مقایسهٔ VCB در برابر ACB</a> تفاوت مکانیزم قطع، عمر سرویس و کاربرد هرکدام را مشخص می‌کند.</p>',
 'blog/piping-equipment-procurement/index.html':
   '<p data-a1-link="yes">دو تصمیم متریالی پرتکرار این حوزه را جداگانه باز کرده‌ایم: <a href="../../comparisons/seamless-vs-erw-pipe.html">مانیسمان یا درزدار ERW</a> و <a href="../../comparisons/a106-vs-a333-pipe.html">A106 یا A333 برای سرویس دما پایین</a>.</p>',
 'blog/instrumentation-checklist/index.html':
   '<p data-a1-link="yes">هنگام بستن مشخصات فلومتر و ترانسمیتر، این دو مقایسه تصمیم را کوتاه می‌کند: <a href="../../comparisons/magmeter-vs-coriolis-flowmeter.html">مگ‌میتر در برابر کوریولیس</a> و <a href="../../comparisons/rosemount-vs-yokogawa-transmitter.html">روزمونت در برابر یوکوگاوا</a>.</p>',
 'blog/electrical-equipment-epc/index.html':
   '<p data-a1-link="yes">در بستهٔ برق پروژه، دو انتخاب همیشه بحث‌برانگیزند: <a href="../../comparisons/vfd-vs-soft-starter.html">درایو VFD در برابر سافت‌استارتر</a> برای راه‌اندازی موتور و <a href="../../comparisons/vcb-vs-acb-switchgear.html">VCB در برابر ACB</a> در سوییچگیر.</p>',
 'blog/industrial-valves-selection/index.html':
   '<p data-a1-link="yes">اگر نقطهٔ ابهام شما قطع جریان در برابر تنظیم آن است، <a href="../../comparisons/gate-vs-globe-valve.html">مقایسهٔ شیر دروازه‌ای و سوزنی</a> با جدول کاربرد به این پرسش جواب می‌دهد.</p>',
 'blog/petrochemical-supply-chain/index.html':
   '<p data-a1-link="yes">برای سرویس ترش و الزامات متریال، تفاوت دو استاندارد کلیدی را در <a href="../../comparisons/nace-mr0175-vs-mr0103.html">مقایسهٔ NACE MR0175 در برابر MR0103</a> ببینید — انتخاب اشتباه این دو، مستقیم به Reject بازرسی می‌رسد.</p>',
 'blog/flanges-fittings-gaskets/index.html':
   '<p data-a1-link="yes">پیش از قطعی‌کردن MTO فلنج، <a href="../../comparisons/wn-vs-so-flange.html">مقایسهٔ فلنج گلودار (WN) و اسلیپون (SO)</a> را مرور کنید تا کلاس فشاری و هزینهٔ جوش را درست ببندید.</p>',
}

def add_blog_links():
    for p, block in BLOG_LINKS.items():
        s = rd(p)
        if 'data-a1-link="yes"' in s:
            print('skip (done):', p); continue
        i = s.find('</article>')
        if i < 0:
            print('!! </article> not found:', p); continue
        wr(p, s[:i] + block + '\n' + s[i:])

# ---------- ۴) lastmod سایت‌مپ ----------
URL_OF = {
 'industries/petrochemical/index.html': 'https://pishtaj.ir/industries/petrochemical/',
 'comparisons/index.html': 'https://pishtaj.ir/comparisons/',
 'blog/index.html': 'https://pishtaj.ir/blog/',
 'knowledge-center/index.html': 'https://pishtaj.ir/knowledge-center/',
}
def url_of(p):
    if p in URL_OF: return URL_OF[p]
    if p.endswith('/index.html'): return 'https://pishtaj.ir/' + p[:-len('index.html')]
    return 'https://pishtaj.ir/' + p

def touch_sitemaps():
    import glob
    urls = {url_of(p) for p in changed}
    for sm in glob.glob(os.path.join(ROOT, 'sitemap-*.xml')):
        s = open(sm, encoding='utf-8').read()
        orig = s
        for u in urls:
            s = re.sub(r'(<loc>' + re.escape(u) + r'</loc><lastmod>)[^<]+(</lastmod>)',
                       r'\g<1>' + TODAY + r'\g<2>', s)
        if s != orig:
            open(sm, 'w', encoding='utf-8').write(s)
            print('sitemap touched:', os.path.basename(sm))

if __name__ == '__main__':
    fix_petro()
    add_hub_intros()
    add_blog_links()
    touch_sitemaps()
    print('\nتغییر کرد (%d):' % len(changed))
    for c in changed: print(' -', c)
