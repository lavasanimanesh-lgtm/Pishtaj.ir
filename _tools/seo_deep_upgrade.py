#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep-content upgrade for the 5 core supplier pages (E-E-A-T + differentiation).

Each page gets: table CSS + 3 genuinely unique deep sections (comparison tables,
process/QC, buyer's guide) with real technical substance — not template filler.
"""
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
"piping-supplier.html": """
<h2>راهنمای انتخاب متریال لوله — جدول مقایسه فنی</h2>
<p>انتخاب متریال لوله مستقیماً بر هزینه، عمر مفید و ایمنی خطوط اثر می‌گذارد. جدول زیر مقایسهٔ کاربردی گریدهای اصلی لوله است که در پروژه‌های فرایندی ایران استفاده می‌شوند:</p>
<table class="deep-table">
<thead><tr><th>متریال / استاندارد</th><th>محدوده دما</th><th>کاربرد اصلی</th><th>نوع (بدون درز / درزدار)</th></tr></thead>
<tbody>
<tr><td>ASTM A106 Gr.B</td><td>تا ۴۲۵°C</td><td>خطوط فرایندی عمومی، بخار، آب</td><td>بدون درز (Seamless)</td></tr>
<tr><td>ASTM A333 Gr.6</td><td>تا ۴۵-°C</td><td>سرویس دمای پایین (Cryogenic)</td><td>بدون درز</td></tr>
<tr><td>API 5L Gr.B تا X70</td><td>متغیر</td><td>خطوط انتقال نفت و گاز (PSL1/PSL2)</td><td>درزدار و بدون درز</td></tr>
<tr><td>ASTM A312 TP304/316</td><td>تا ۸۰۰°C (محدود به خوردگی)</td><td>سیالات خورنده، صنایع شیمیایی</td><td>درزدار و بدون درز</td></tr>
<tr><td>ASTM A335 P11/P22/P91</td><td>تا ۶۵۰°C</td><td>دما و فشار بالا (سوپرهیتر)</td><td>بدون درز</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> برای سرویس ترش (Wet H2S) علاوه بر گرید، الزامات NACE MR0175/MR0103 (کنترل سختی و عملیات حرارتی) باید در MTC صریح قید شود. این مورد رایج‌ترین دلیل رد شدن کالا در بازرسی است.</p>

<h2>فرایند تامین و کنترل کیفیت پایپینگ</h2>
<p>تفاوت یک تامین‌کنندهٔ حرفه‌ای با یک فروشنده در «کنترل مدارک و انطباق» است. فرایند ما سه مرحله دارد:</p>
<ul>
<li><b>کنترل کیفیت ورودی (Incoming QC):</b> بررسی انطباق گواهی MTC با سفارش — تطبیق Heat Number روی کالا با گواهی، ترکیب شیمیایی و خواص مکانیکی.</li>
<li><b>کنترل کیفیت حین فرایند (In-Process QC):</b> بازرسی ابعادی (قطر، ضخامت، Schedule)، چشمی سطح، و در صورت الزام تست‌های NDT (UT/PMI).</li>
<li><b>کنترل کیفیت خروجی (Outgoing QC):</b> صدور گواهی انطباق نهایی، بسته‌بندی استاندارد صادراتی و تحویل Packing List دقیق.</li>
</ul>
<p><b>قابلیت ردیابی (Traceability):</b> هر لوله و فلنج باید از طریق Heat Number و Marking به MTC متصل باشد. اگر این زنجیره بشکند، کالا در بازرسی TPI پذیرفته نمی‌شود.</p>

<h2>نکات فنی برای ثبت استعلام دقیق پایپینگ</h2>
<p>برای دریافت پیشنهاد فنی-مالی دقیق و بدون رفت‌وبرگشت، این اطلاعات را در RFQ ذکر کنید:</p>
<ul>
<li><b>استاندارد و گرید:</b> مثلاً ASTM A106 Gr.B (نه صرفاً «لوله مانیسمان»).</li>
<li><b>سایز و Schedule:</b> مثلاً 6&quot; SCH 40 یا SCH 160.</li>
<li><b>تناژ یا تعداد (متر طول):</b> برای برآورد قیمت و زمان تحویل.</li>
<li><b>نوع گواهی:</b> MTC 3.1 یا 3.2 (تفاوت در سطح بازرسی مستقل).</li>
<li><b>الزامات خاص:</b> NACE، تست ضربه شارپی، PMI، یا بازرسی TPI.</li>
</ul>
""",

"valve-supplier.html": """
<h2>راهنمای انتخاب نوع شیر — جدول مقایسه</h2>
<p>انتخاب نوع شیر به عملکرد (قطع، تنظیم، یکطرفه) و شرایط سرویس بستگی دارد. جدول زیر راهنمای کاربردی انتخاب است:</p>
<table class="deep-table">
<thead><tr><th>نوع شیر</th><th>عملکرد اصلی</th><th>افت فشار</th><th>کاربرد مناسب</th></tr></thead>
<tbody>
<tr><td>Gate Valve (دروازه‌ای)</td><td>قطع/وصل کامل (On/Off)</td><td>کم</td><td>سرویس‌هایی که شیر کاملاً باز یا بسته است</td></tr>
<tr><td>Globe Valve (کروی)</td><td>تنظیم جریان (Throttling)</td><td>زیاد</td><td>کنترل جریان، سرویس بخار</td></tr>
<tr><td>Ball Valve (توپی)</td><td>قطع سریع ۹۰ درجه</td><td>بسیار کم</td><td>قطع سریع، خطوط انتقال</td></tr>
<tr><td>Check Valve (یکطرفه)</td><td>جلوگیری از برگشت جریان</td><td>متغیر</td><td>حفاظت پمپ و تجهیزات</td></tr>
<tr><td>Butterfly Valve (پروانه‌ای)</td><td>قطع/تنظیم</td><td>کم</td><td>سایزهای بزرگ، فشار کم تا متوسط</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> در خطوط بخار فشار بالا، Globe Valve برای Throttling مناسب است اما افت فشار بالایی دارد؛ در مقابل Gate Valve فقط برای حالت کاملاً باز/بسته طراحی شده و برای تنظیم جریان نباید استفاده شود.</p>

<h2>استانداردها و تست‌های شیرآلات صنعتی</h2>
<p>پذیرش شیرآلات در پروژه‌های نفت و گاز مستلزم گذر از تست‌ها و استانداردهای مشخص است:</p>
<ul>
<li><b>تست نشتی بدنه و نشیمنگاه:</b> مطابق API 598 یا ISO 5208 (کلاس نشتی مجاز).</li>
<li><b>تست حریق (Fire-Safe):</b> API 607 برای شیرهایی که در مناطق آتش‌خیز نصب می‌شوند.</li>
<li><b>سرویس ترش:</b> NACE MR0175/MR0103 برای سرویس‌های Wet H2S (کنترل سختی متریال).</li>
<li><b>طراحی و ساخت:</b> API 600 (Gate)، API 602 (Gate کوچک)، API 6D (Ball خطوط لوله)، API 609 (Butterfly).</li>
</ul>
<p><b>متریال بدنه و قطعات داخلی (Trim):</b> جنس Trim باید متناسب با سیال و دما انتخاب شود؛ مثلاً Trim از جنس 316 یا Stellite برای سرویس‌های خورنده و فرسایشی. در سرویس ترش، سختی بدنه و Trim باید زیر حد مجاز NACE کنترل شود.</p>

<h2>نکات ثبت استعلام شیرآلات</h2>
<ul>
<li><b>نوع شیر + استاندارد:</b> مثلاً Gate Valve API 600.</li>
<li><b>کلاس فشار:</b> 150، 300، 600، 900، 1500 یا 2500.</li>
<li><b>متریال بدنه/Trim:</b> A216 WCB، CF8M، Duplex و…</li>
<li><b>اتصال:</b> فلنجی (RF/RTJ)، جوشی، یا رزوه‌ای.</li>
<li><b>الزامات خاص:</b> NACE، Fire-Safe، یا اکچویتور.</li>
</ul>
""",

"instrumentation-supplier.html": """
<h2>مقایسه برندهای ترانسمیتر فشار — جدول راهنما</h2>
<p>انتخاب برند ترانسمیتر بر اساس دقت، پروتکل و انطباق Vendor List انجام می‌شود. جدول زیر مقایسهٔ کاربردی برندهای اصلی است:</p>
<table class="deep-table">
<thead><tr><th>برند / سری</th><th>دقت پایه</th><th>پروتکل</th><th>کاربرد متمایز</th></tr></thead>
<tbody>
<tr><td>Rosemount 3051</td><td>۰.۰۴٪</td><td>HART / FOUNDATION</td><td>پرکاربردترین ترانسمیتر صنعتی، پشتیبانی گسترده</td></tr>
<tr><td>Yokogawa EJX</td><td>۰.۰۲۵٪</td><td>HART / BRAIN</td><td>دقت فوق‌العاده برای کاربردهای حساس</td></tr>
<tr><td>Endress+Hauser Cerabar</td><td>۰.۰۵٪</td><td>HART / Profibus</td><td>طراحی مدولار برای صنایع شیمیایی</td></tr>
<tr><td>WIKA</td><td>۰.۰۵٪</td><td>HART</td><td>اقتصادی و قابل اعتماد برای کاربردهای عمومی</td></tr>
</tbody>
</table>

<h2>راهنمای انتخاب فلومتر — جدول مقایسه</h2>
<p>انتخاب فلومتر به نوع سیال (مایع/گاز/بخار)، رسانایی و دقت مورد نیاز بستگی دارد:</p>
<table class="deep-table">
<thead><tr><th>نوع فلومتر</th><th>دقت</th><th>سیال مناسب</th><th>نکته انتخاب</th></tr></thead>
<tbody>
<tr><td>مغناطیسی (Magmeter)</td><td>۰.۲٪</td><td>مایعات رسانا</td><td>برای آب، اسید و دوغاب؛ بدون افت فشار</td></tr>
<tr><td>کوریولیس (Coriolis)</td><td>۰.۱٪</td><td>مایعات و گازها</td><td>اندازه‌گیری مستقیم جرم؛ دقیق‌ترین</td></tr>
<tr><td>ورتکس (Vortex)</td><td>۰.۷٪</td><td>بخار و گاز</td><td>نیازمند طول مستقیم کافی</td></tr>
<tr><td>التراسونیک</td><td>۰.۵٪</td><td>مایعات تمیز</td><td>نصب Clamp-On غیرمخرب</td></tr>
<tr><td>اوریفیس</td><td>۱-۲٪</td><td>مایعات و گازها</td><td>اقتصادی اما با افت فشار</td></tr>
</tbody>
</table>

<h2>تاییدیه‌های ایمنی (SIL/ATEX) و گواهی کالیبراسیون</h2>
<p>برای کاربردهای ایمنی و مناطق خطرناک، این موارد الزامی است:</p>
<ul>
<li><b>SIL (Safety Integrity Level):</b> برای تجهیزات در حلقه‌های ایمنی (SIF) — گواهی SIL 2/3 سازنده لازم است.</li>
<li><b>ATEX / IECEx:</b> برای نصب در مناطق خطرناک (Zone 0/1/2) — تجهیز باید دارای تاییدیهٔ ضد انفجار باشد.</li>
<li><b>گواهی کالیبراسیون:</b> هر ترانسمیتر باید همراه گواهی کالیبراسیون قابل رهگیری (Traceable به استاندارد ملی/بین‌المللی) تحویل شود.</li>
<li><b>گواهی متریال قطعات خیس (Wetted Parts):</b> برای انطباق با سیال فرایند.</li>
</ul>
<p class="deep-note"><b>نکته فنی:</b> رایج‌ترین خطا در استعلام ابزار دقیق، مشخص نکردن Tag Number و Range است. بدون این دو مورد، پیشنهاد فنی قابل مقایسه نخواهد بود.</p>
""",

"electrical-supplier.html": """
<h2>مقایسه کلیدهای قدرت — جدول راهنما</h2>
<p>انتخاب کلید قدرت به سطح ولتاژ و ظرفیت قطع اتصال کوتاه بستگی دارد:</p>
<table class="deep-table">
<thead><tr><th>نوع کلید</th><th>سطح ولتاژ</th><th>ظرفیت قطع</th><th>کاربرد اصلی</th></tr></thead>
<tbody>
<tr><td>MCB</td><td>تا ۴۴۰V</td><td>تا ۱۰kA</td><td>مدارهای روشنایی و پریز</td></tr>
<tr><td>MCCB</td><td>تا ۶۹۰V</td><td>تا ۱۰۰kA</td><td>فیدرهای اصلی فشار ضعیف</td></tr>
<tr><td>ACB</td><td>تا ۱۰۰۰V</td><td>تا ۱۵۰kA</td><td>اینکامینگ تابلوهای LV</td></tr>
<tr><td>VCB (وکیوم)</td><td>تا ۳۶kV</td><td>تا ۵۰kA</td><td>فشار متوسط — پست و صنعت</td></tr>
</tbody>
</table>
<p class="deep-note"><b>نکته فنی:</b> وکیوم سیرکت بریکر (VCB) با عایق وکیوم، جایگزین مدرن کلیدهای روغنی و گازی SF6 در فشار متوسط است — نگهداری کمتر و عمر بیشتر. برای جزئیات به صفحهٔ تخصصی <a href="vcb-supplier.html">تامین‌کننده وکیوم سیرکت بریکر</a> مراجعه کنید.</p>

<h2>تفاوت VFD و سافت‌استارتر + راهنمای انتخاب</h2>
<p>این دو تجهیز هر دو برای راه‌اندازی موتور استفاده می‌شوند اما عملکرد متفاوتی دارند:</p>
<table class="deep-table">
<thead><tr><th>ویژگی</th><th>VFD (درایو)</th><th>سافت‌استارتر</th></tr></thead>
<tbody>
<tr><td>کنترل دور</td><td>بله (پیوسته)</td><td>خیر (فقط راه‌اندازی نرم)</td></tr>
<tr><td>کاهش جریان راه‌اندازی</td><td>بله</td><td>بله</td></tr>
<tr><td>صرفه‌جویی انرژی</td><td>بله (در بار جزئی)</td><td>خیر</td></tr>
<tr><td>کاربرد</td><td>کنترل دور پمپ/فن</td><td>راه‌اندازی نرم موتورهای ثابت</td></tr>
</tbody>
</table>

<h2>استانداردهای IEC در تجهیزات برق صنعتی</h2>
<ul>
<li><b>IEC 61439:</b> استاندارد ساخت و تست تابلوهای فشار ضعیف.</li>
<li><b>IEC 62271:</b> استاندارد تابلوها و کلیدهای فشار متوسط (شامل VCB).</li>
<li><b>IEC 60947:</b> استاندارد کلیدهای فشار ضعیف (ACB/MCCB/MCB).</li>
<li><b>IEC 61850:</b> استاندارد ارتباطات در پست‌های هوشمند (رله حفاظتی).</li>
</ul>
<p><b>نکته ثبت استعلام:</b> برای تابلو و کلید، مشخص کردن جریان اتصال کوتاه (Icc) در نقطه نصب، ولتاژ نامی و استاندارد IEC مربوطه الزامی است — بدون این اطلاعات، پیشنهاد فنی قابل مقایسه نخواهد بود.</p>
""",

"petrochemical-equipment-supplier.html": """
<h2>نقشه تجهیزات به تفکیک واحد پتروشیمی — جدول راهنما</h2>
<p>هر واحد پتروشیمی نیازمند ترکیب خاصی از تجهیزات است. جدول زیر نگاشت تجهیزات به واحدهای اصلی است:</p>
<table class="deep-table">
<thead><tr><th>واحد</th><th>تجهیزات مشخصه</th><th>الزامات خاص متریال</th></tr></thead>
<tbody>
<tr><td>الفین (Olefin)</td><td>Cold Box، کمپرسور چندمرحله‌ای، کوره کراکینگ، برج جداسازی C2-C4</td><td>Cryogenic (دمای پایین)، Refractory</td></tr>
<tr><td>آروماتیک (Aromatic)</td><td>راکتور، مبدل، برج تقطیر، پمپ فرایندی</td><td>متریال مقاوم به خوردگی</td></tr>
<tr><td>پلیمر (Polymer)</td><td>راکتور پلیمریزاسیون، اکسترودر، کمپرسور</td><td>SS ویژه، سطح بدون آلودگی</td></tr>
<tr><td>آمونیاک/اوره</td><td>Reformer، مبدل سنتز، کمپرسور سنتز</td><td>Urea-grade SS، فشار بالا</td></tr>
</tbody>
</table>

<h2>الزامات متریال در سرویس‌های خاص پتروشیمی</h2>
<p>دو چالش متریال در پتروشیمی اهمیت ویژه دارند:</p>
<ul>
<li><b>سرویس کرایوژنیک (Cryogenic):</b> واحدهای الفین در دمای بسیار پایین کار می‌کنند؛ متریال باید چقرمگی ضربه (Impact Test) در دمای پایین داشته باشد — معمولاً ASTM A333 یا استینلس آستنیتی.</li>
<li><b>سرویس ترش (Sour Service):</b> در حضور H2S، الزامات NACE MR0103 (پایین‌دستی/پالایش و پتروشیمی) با کنترل سختی و عملیات حرارتی اعمال می‌شود.</li>
<li><b>متریال اوره (Urea-grade):</b> واحدهای اوره نیازمند استینلس با محتوای مولیبدن و کنترل Ferrite خاص هستند تا در برابر Carbamate مقاوم باشند.</li>
</ul>

<h2>مدیریت Vendor List و فرایند VAR</h2>
<p>در پروژه‌های پتروشیمی (NPC، هلدینگ‌های پتروشیمی)، Vendor List بسیار سختگیرانه است — معمولاً ۳ تا ۵ برند مجاز برای هر تجهیز:</p>
<ul>
<li><b>انطباق با Vendor List:</b> تامین صرفاً از برندهای تاییدشده؛ پیشنهاد برند خارج از لیست بدون VAR پذیرفته نمی‌شود.</li>
<li><b>Vendor Approval Request (VAR):</b> در صورت نیاز به برند جایگزین، فرایند تایید کتبی کارفرما را مدیریت می‌کنیم.</li>
<li><b>Spec Break و MTO:</b> تامین بر اساس Spec Sheet و Bill of Material پروژه، با کنترل هر Tag Number.</li>
</ul>
<p class="deep-note"><b>نکته فنی:</b> در پروژه‌های پتروشیمی، «کوتاه‌ترین Lead Time» معمولاً از «کمترین قیمت» مهم‌تر است — توقف در مسیر بحرانی پروژه بسیار هزینه‌ساز است. زمان‌بندی تامین باید با Schedule واحد هماهنگ شود.</p>
""",
}

def upgrade(path, deep_html):
    h = open(path, encoding='utf-8').read()
    # 1) inject table CSS before </style>
    if '.deep-table' not in h:
        h = h.replace('</style>', TABLE_CSS + '</style>', 1)
    # 2) inject deep sections before the first "راهنماهای مرتبط" H2
    m = re.search(r'<h2>[^<]*راهنماهای مرتبط[^<]*</h2>', h)
    if not m:
        print(f"  !! no marker found in {path}")
        return False
    h = h.replace(m.group(0), deep_html + '\n' + m.group(0), 1)
    open(path, 'w', encoding='utf-8').write(h)
    return True

if __name__ == '__main__':
    for fn, html in PAGES.items():
        ok = upgrade('suppliers/' + fn, html)
        print(f"{fn}: {'OK' if ok else 'FAIL'}")
    print("done")
