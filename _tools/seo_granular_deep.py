#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep-content upgrade for granular supplier pages (phase 6 batch)."""
import re

TABLE_CSS = """
.deep-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13.5px;line-height:1.7}
.deep-table th,.deep-table td{border:1px solid #e2e8f0;padding:10px 12px;text-align:right;vertical-align:top}
.deep-table th{background:#f1f5f9;color:#0f2744;font-weight:900}
.deep-table tr:nth-child(even) td{background:#fafcff}
.deep-note{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 16px;color:#7c2d12;font-size:13.5px;line-height:1.9;margin:14px 0}
@media(max-width:700px){.deep-table{display:block;overflow-x:auto}}
"""

PAGES = {
"flange-supplier.html": """
<h2>مقایسه انواع فلنج — جدول انتخاب</h2>
<p>انتخاب نوع فلنج به فشار، دما و نوع اتصال بستگی دارد. جدول زیر راهنمای کاربردی انتخاب است:</p>
<table class="deep-table">
<thead><tr><th>نوع فلنج</th><th>کاربرد</th><th>مزیت</th><th>محدودیت</th></tr></thead>
<tbody>
<tr><td>گلودار (WN)</td><td>سرویس‌های حساس، فشار/دمای بالا</td><td>انتقال یکنواخت تنش، جوش رادیوگرافی‌پذیر</td><td>گران‌تر، نیازمند Bore دقیق</td></tr>
<tr><td>اسلیپ‌آن (SO)</td><td>کاربردهای عمومی</td><td>اقتصادی، نصب آسان</td><td>برای سیکل حرارتی محدود</td></tr>
<tr><td>کور (Blind)</td><td>بستن انتهای خطوط</td><td>دسترسی برای تست/تعمیر</td><td>—</td></tr>
<tr><td>Socket Weld</td><td>سایزهای کوچک، فشار بالا</td><td>جوش قوی در سایز کم</td><td>مناسب زیر ۲ اینچ</td></tr>
<tr><td>RTJ</td><td>فشار قوی</td><td>آب‌بندی فلزی مطمئن</td><td>نیازمند گسکت RTJ دقیق</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> رایج‌ترین خطا، ناسازگاری Facing فلنج با نوع گسکت است. فلنج RF با گسکت RTJ کار نمی‌کند و در تست هیدرواستاتیک نشتی می‌دهد. همیشه Facing و گسکت را هماهنگ انتخاب کنید.</p>

<h2>کنترل ابعادی و بازرسی فلنج</h2>
<ul>
<li><b>قطر و ضخامت:</b> مطابق ASME B16.5/B16.47 با تلرانس مشخص.</li>
<li><b>PCD و قطر سوراخ‌ها:</b> تطبیق با الگوی پیچ و مهره استاندارد.</li>
<li><b>Serration روی RF:</b> برای گسکت اسپیرال واند و کمرپروفایل.</li>
<li><b>PMI (تست جنس):</b> برای فلنج‌های استینلس و آلیاژی جهت تایید متریال.</li>
</ul>
""",

"pipe-supplier.html": """
<h2>مقایسه انواع لوله — جدول انتخاب</h2>
<table class="deep-table">
<thead><tr><th>نوع لوله</th><th>روش ساخت</th><th>کاربرد</th><th>مزیت اصلی</th></tr></thead>
<tbody>
<tr><td>مانیسمان (Seamless)</td><td>بدون درز (نورد گرم)</td><td>فشار/دمای بالا، سرویس حساس</td><td>یکنواختی، بدون جوش</td></tr>
<tr><td>ERW (درزدار جوش مقاومتی)</td><td>جوش مقاومتی</td><td>کاربرد عمومی، سایز کوچک</td><td>اقتصادی</td></tr>
<tr><td>SAW (قوس زیرپودری)</td><td>جوش قوس زیرپودری</td><td>سایز بزرگ، خطوط انتقال</td><td>ضخامت بالا</td></tr>
<tr><td>استینلس (A312)</td><td>درزدار/مانیسمان</td><td>سیالات خورنده</td><td>مقاومت خوردگی</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> Heat Number روی بدنه لوله باید دقیقاً با گواهی MTC مطابقت داشته باشد. اگر این تطبیق برقرار نباشد، کالا در بازرسی TPI رد می‌شود — حتی اگر کیفیت ظاهری خوب باشد.</p>

<h2>تست‌های لوله قبل از تحویل</h2>
<ul>
<li><b>تست هیدرواستاتیک:</b> مطابق الزام استاندارد (معمولاً ۱.۵ برابر فشار طراحی).</li>
<li><b>تست ضربه شارپی:</b> برای سرویس‌های دمای پایین (A333).</li>
<li><b>تست NDT (UT/ET):</b> برای لوله‌های مانیسمان و درزدار جهت تشخیص عیوب.</li>
<li><b>بررسی ابعادی:</b> قطر خارجی، ضخامت دیواره، طول و تلرانس Schedule.</li>
</ul>
""",

"fittings-supplier.html": """
<h2>مقایسه اتصالات جوشی و فورج — جدول انتخاب</h2>
<table class="deep-table">
<thead><tr><th>ویژگی</th><th>جوشی (Butt Weld)</th><th>فورج (Socket Weld/Threaded)</th></tr></thead>
<tbody>
<tr><td>سایز</td><td>۲ اینچ به بالا</td><td>زیر ۲ اینچ</td></tr>
<tr><td>فشار</td><td>بالا</td><td>بالا (کلاس ۳۰۰۰/۶۰۰۰)</td></tr>
<tr><td>اتصال</td><td>جوش لب‌به‌لب</td><td>جوش سوکتی یا رزوه</td></tr>
<tr><td>استاندارد</td><td>ASME B16.9</td><td>ASME B16.11</td></tr>
<tr><td>کاربرد</td><td>خطوط اصلی فرایندی</td><td>خطوط ابزار دقیق و فرعی</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> در اتصالات جوشی، Schedule اتصال باید با Schedule لوله مطابقت داشته باشد تا جوش لب‌به‌لب صحیح و بدون ناپیوستگی داخلی انجام شود.</p>

<h2>کنترل ابعادی اتصالات</h2>
<ul>
<li><b>زاویه زانو:</b> ۴۵ و ۹۰ درجه با تلرانس استاندارد.</li>
<li><b>شعاع زانو:</b> بلند (LR) یا کوتاه (SR) مطابق مشخصات.</li>
<li><b>ضخامت دیواره:</b> مطابق Schedule لوله متصل.</li>
<li><b>متریال:</b> کربن استیل A234 WPB، استینلس A403، آلیاژی A420.</li>
</ul>
""",

"gasket-supplier.html": """
<h2>مقایسه انواع گسکت — جدول انتخاب بر اساس شرایط سرویس</h2>
<table class="deep-table">
<thead><tr><th>نوع گسکت</th><th>دما/فشار</th><th>سیال مناسب</th><th>Facing فلنج</th></tr></thead>
<tbody>
<tr><td>اسپیرال واند (گرافیت)</td><td>تا ۴۵۰°C</td><td>بخار، هیدروکربن</td><td>RF</td></tr>
<tr><td>اسپیرال واند (PTFE)</td><td>تا ۲۵۰°C</td><td>سیالات خورنده</td><td>RF</td></tr>
<tr><td>رینگ جوینت (RTJ)</td><td>فشار قوی</td><td>نفت و گاز</td><td>RTJ</td></tr>
<tr><td>کمرپروفایل</td><td>تا ۵۰۰°C</td><td>مبدل‌های حرارتی</td><td>RF</td></tr>
<tr><td>ورق غیرآزبستی</td><td>تا ۲۰۰°C</td><td>آب، عمومی</td><td>FF/RF</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> گسکت باید با نوع Facing فلنج (RF/FF/RTJ) و کلاس فشار هماهنگ باشد. گسکت RTJ روی فلنج RF قابل استفاده نیست و بالعکس.</p>

<h2>عوامل انتخاب گسکت</h2>
<ul>
<li><b>سیال:</b> گرافیت برای هیدروکربن، PTFE برای اسید و سیالات خورنده.</li>
<li><b>دما و فشار:</b> تعیین‌کننده متریال پرکننده و بدنه گسکت.</li>
<li><b>کلاس فلنج:</b> گسکت باید برای کلاس فشار فلنج طراحی شده باشد.</li>
<li><b>استاندارد:</b> ASME B16.20 برای گسکت‌های فلنجی.</li>
</ul>
""",

"petrochemical-valve-supplier.html": """
<h2>الزامات شیرآلات در سرویس‌های خاص پتروشیمی — جدول</h2>
<table class="deep-table">
<thead><tr><th>سرویس</th><th>الزام متریال</th><th>تست خاص</th></tr></thead>
<tbody>
<tr><td>سرویس ترش (Wet H2S)</td><td>کنترل سختی NACE MR0103</td><td>تست سختی، PMI</td></tr>
<tr><td>کرایوژنیک (دمای پایین)</td><td>چقرمگی ضربه در دمای پایین</td><td>Cryogenic Test</td></tr>
<tr><td>فشار بالا (کلاس ۱۵۰۰/۲۵۰۰)</td><td>متریال فورج با استحکام بالا</td><td>تست نشتی API 598</td></tr>
<tr><td>سیالات خورنده</td><td>استینلس/Duplex، Trim مناسب</td><td>PMI</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> تفاوت NACE MR0175 (بالادستی/Wellhead) با MR0103 (پایین‌دستی/پالایش و پتروشیمی) در حد سختی مجاز است. استفاده از استاندارد اشتباه، رایج‌ترین دلیل رد شدن شیر در پروژه‌های پتروشیمی است.</p>

<h2>فرایند تایید Vendor در پتروشیمی</h2>
<ul>
<li><b>Vendor List NPC:</b> شیرآلات باید از برندهای تاییدشدهٔ لیست تامین‌کنندگان شرکت‌های ملی پتروشیمی باشد.</li>
<li><b>VAR (Vendor Approval Request):</b> برای برند جایگزین، تایید کتبی کارفرما الزامی است.</li>
<li><b>Spec Sheet:</b> شیرآلات بر اساس Spec Sheet و Tag Number پروژه تامین می‌شوند.</li>
<li><b>Data Book:</b> مستندات کامل شامل MTC، گزارش تست و گواهی‌ها تحویل داده می‌شود.</li>
</ul>
""",

"vcb-supplier.html": """
<h2>مقایسه وکیوم سیرکت بریکر با نسل‌های قبلی — جدول</h2>
<table class="deep-table">
<thead><tr><th>ویژگی</th><th>VCB (وکیوم)</th><th>روغنی (OCB)</th><th>گازی (SF6)</th></tr></thead>
<tbody>
<tr><td>محیط قطع</td><td>وکیوم</td><td>روغن</td><td>گاز SF6</td></tr>
<tr><td>نگهداری</td><td>بسیار کم</td><td>زیاد</td><td>متوسط</td></tr>
<tr><td>عمر مکانیکی</td><td>بالا (تا ۳۰ هزار عمل)</td><td>پایین</td><td>متوسط</td></tr>
<tr><td>زیست‌محیطی</td><td>پاک</td><td>آلودگی روغن</td><td>گاز گلخانه‌ای SF6</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> وکیوم سیرکت بریکر با عایق وکیوم، جایگزین مدرن کلیدهای روغنی و گازی در فشار متوسط است. مزیت اصلی آن نگهداری بسیار کم و عمر مکانیکی بالا است که آن را برای پست‌های صنعتی ایده‌آل می‌کند.</p>

<h2>مشخصات فنی کلیدی برای انتخاب VCB</h2>
<ul>
<li><b>ولتاژ نامی (Ur):</b> ۱۲، ۲۴ یا ۳۶ کیلوولت.</li>
<li><b>جریان نامی (Ir):</b> ۶۳۰ تا ۴۰۰۰ آمپر.</li>
<li><b>جریان قطع اتصال کوتاه (Isc):</b> تا ۵۰ کیلوآمپر.</li>
<li><b>مطابق IEC 62271-100:</b> استاندارد اصلی کلیدهای فشار متوسط.</li>
</ul>
""",

"industrial-projects-supplier.html": """
<h2>ماتریس پکیج‌های تامین پروژه — جدول</h2>
<table class="deep-table">
<thead><tr><th>پکیج</th><th>اقلام اصلی</th><th>مستندات</th><th>ریسک در صورت تاخیر</th></tr></thead>
<tbody>
<tr><td>پایپینگ</td><td>لوله، فلنج، فیتینگ، گسکت</td><td>MTC، تست هیدرواستاتیک</td><td>توقف نصب خطوط</td></tr>
<tr><td>برق</td><td>تابلو، کلید، کابل، اتوماسیون</td><td>FAT، Routine Test</td><td>تاخیر برق‌رسانی</td></tr>
<tr><td>ابزار دقیق</td><td>ترانسمیتر، فلومتر، کنترل ولو</td><td>کالیبراسیون، دیتاشیت</td><td>تاخیر راه‌اندازی</td></tr>
<tr><td>مکانیکال</td><td>پمپ، کمپرسور، شیرآلات</td><td>Performance Curve، تست</td><td>توقف فرایند</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> در پروژه‌های EPC، Lead Time واقعی فقط زمان ساخت نیست؛ شامل صدور مدارک، تایید کارفرما، تست، بسته‌بندی، حمل و ترخیص هم می‌شود. برنامه‌ریزی تامین باید کل زنجیره را ببیند.</p>

<h2>رویکرد مدیریت MTO و زمان‌بندی</h2>
<ul>
<li><b>بررسی MTO و Spec:</b> قبل از سفارش، مغایرت‌های لیست اقلام و مشخصات فنی رفع می‌شود.</li>
<li><b>تامین مرحله‌ای:</b> اقلام بحرانی (Long Lead Items) زودتر سفارش داده می‌شوند.</li>
<li><b>گزارش‌دهی:</b> وضعیت تامین هر پکیج به‌صورت منظم گزارش می‌شود.</li>
<li><b>مدیریت انحراف:</b> Technical/Commercial Deviation List شفاف قبل از سفارش.</li>
</ul>
""",
}

def upgrade(path, deep_html):
    h = open(path, encoding='utf-8').read()
    if '.deep-table' not in h:
        h = h.replace('</style>', TABLE_CSS + '</style>', 1)
    m = re.search(r'<h2>[^<]*راهنماهای مرتبط[^<]*</h2>', h)
    if not m:
        print(f"  !! no marker: {path}")
        return False
    h = h.replace(m.group(0), deep_html + '\n' + m.group(0), 1)
    open(path, 'w', encoding='utf-8').write(h)
    return True

if __name__ == '__main__':
    for fn, html in PAGES.items():
        ok = upgrade('suppliers/' + fn, html)
        print(f"{fn}: {'OK' if ok else 'FAIL'}")
    print("done")
