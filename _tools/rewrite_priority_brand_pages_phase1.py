#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pathlib import Path
from html import escape
import re

GENERIC = re.compile(r'<p>برای خرید برندمحور، بهتر است فروشنده تصویر پلاک، دیتاشیت رسمی، شرایط گارانتی و مسیر تأمین را قبل از صدور سفارش ارائه کند\. در صورت وجود محدودیت تحریم، توقف تولید یا تغییر نسل محصول، جایگزین باید به صورت رسمی و فنی بررسی شود\. این کنترل‌ها از خرید کالای ناسازگار، Refurbished نامشخص یا فاقد مدارک جلوگیری می‌کند و ریسک تحویل پروژه را کاهش می‌دهد\.</p>')

DEEP = {
'galperti-flanges.html': ('بازنویسی عمیق: فلنج و فورج Galperti در خرید پروژه‌ای', [
'در خرید فلنج Galperti، باید تفاوت بین فلنج استاندارد و قطعه فورج سفارشی روشن شود. فلنج استاندارد طبق ASME B16.5 یا B16.47 با ابعاد مشخص قابل کنترل است، اما قطعات خاص مانند Spade/Spacer، Bleed Ring، Orifice Flange یا Compact Flange نیازمند Drawing، تلرانس، متریال و روش ماشین‌کاری اختصاصی هستند. اگر RFQ برای قطعه خاص فقط با نام عمومی ارسال شود، پیشنهادهای فروشندگان از نظر فنی قابل مقایسه نخواهد بود.',
'برای Orifice Flange، محل Tap، نوع اتصال Tap، ضخامت، Bore و تطبیق با Orifice Plate اهمیت دارد. Orifice Flange بخشی از زنجیره اندازه‌گیری دبی است و خطای ابعادی آن روی نصب و دقت Metering اثر می‌گذارد. در چنین خریدی، Drawing و Dimensional Report از مدارک اصلی هستند، نه مدارک تشریفاتی.',
'در متریال‌هایی مثل Duplex، Super Duplex، Inconel، Monel یا Hastelloy، PMI و MTC به‌تنهایی کافی نیستند؛ باید Heat Treatment، Solution Annealing، تست خوردگی در صورت الزام و محدودیت سختی بررسی شود. در سرویس ترش، NACE و Hardness باید از ابتدا در PO ذکر شود؛ بعد از ساخت نمی‌توان این الزام را ساده اضافه کرد.',
'برای پروژه‌هایی که Galperti در Vendor List کارفرماست، باید مشخص شود آیا هر سایت تولیدی گروه Galperti قابل قبول است یا فقط یک کارخانه/کشور مشخص. گاهی کارفرما کشور ساخت یا Mill خاصی را الزام می‌کند. این موضوع باید قبل از صدور سفارش روشن شود تا کالا در مرحله Final Documentation رد نشود.',
'اگر هدف خرید، جایگزینی فلنج موجود در سایت است، عکس Marking، اندازه‌برداری واقعی، استاندارد سوراخ‌کاری و ضخامت قبل از سفارش ضروری است. در سایت‌های قدیمی، ممکن است فلنج بر اساس ANSI قدیمی، DIN یا استاندارد خاص ساخته شده باشد و خرید صرفاً بر اساس سایز اسمی باعث عدم تطابق شود.'
]),
'siemens-industrial.html': ('بازنویسی عمیق: Siemens در اتوماسیون، درایو و برق صنعتی', [
'در تجهیزات Siemens، مهم‌ترین خطر خرید اشتباه معمولاً در رقم‌های پایانی MLFB یا Option Code پنهان است. CPU، کارت I/O، HMI یا Drive ممکن است از نظر خانواده درست باشد، اما از نظر Firmware، Memory، Interface، Safety Capability یا License با پروژه موجود سازگار نباشد. برای Retrofit، RFQ باید از روی Backup پروژه، عکس پلاک و نسخه نرم‌افزار تهیه شود.',
'در پروژه‌های مبتنی بر TIA Portal، نسخه نرم‌افزار مهندسی تعیین‌کننده است. اگر تجهیز جدید با نسخه قدیمی پشتیبانی نشود، تیم سایت مجبور به ارتقای نرم‌افزار، تغییر پروژه یا تعویض چند قطعه دیگر می‌شود. این هزینه پنهان باید قبل از خرید دیده شود، مخصوصاً برای Spare اضطراری.',
'در SINAMICS، تفاوت G120، S120، V20 یا درایوهای فرآیندی فقط در توان نیست. نوع کنترل موتور، Safety Integrated، Encoder Feedback، Communication Module، Brake Chopper و Filterها روی کاربرد واقعی اثر دارند. برای پمپ و فن، PID و صرفه‌جویی انرژی مهم است؛ برای کانوایر یا میکسر، گشتاور و Overload تعیین‌کننده‌تر می‌شود.',
'در تجهیزات حفاظتی و LV زیمنس، Breaking Capacity، Trip Unit، Accessory و استاندارد نصب باید با تابلو موجود سازگار باشد. یک MCCB با آمپر مشابه ولی ابعاد، ترمینال یا Accessory متفاوت ممکن است در تابلو جا نشود یا Interlock موجود را پشتیبانی نکند.',
'در خرید HMI یا Panel، فقط سایز نمایشگر مهم نیست. Runtime، پروتکل، تعداد Tag، Recipe، Alarm، حافظه، Mounting Cut-out و مقاومت محیطی باید بررسی شود. اگر HMI قدیمی جایگزین می‌شود، Migration پروژه و Backup نرم‌افزار باید در Scope دیده شود.'
]),
'flexitallic-gaskets.html': ('بازنویسی عمیق: Flexitallic و آب‌بندی فلنجی', [
'در گسکت‌های Flexitallic، Style اهمیت زیادی دارد. Style CGI، CG، RIR، Flexpro/Kammprofile یا RTJ هرکدام برای نوع فلنج و شرایط متفاوت طراحی شده‌اند. اگر کاربر فقط بنویسد Spiral Wound، ممکن است Inner Ring، Outer Ring یا Filler اشتباه انتخاب شود و اتصال در تست یا بهره‌برداری نشتی بدهد.',
'در Spiral Wound، نوار فلزی و Filler با هم آب‌بندی را شکل می‌دهند. Graphite برای دمای بالا رایج است، PTFE برای مقاومت شیمیایی مناسب است ولی محدودیت دمایی و خزش دارد. در سرویس‌های اکسیدکننده داغ، مواد دمای بالا مانند Thermiculite می‌تواند گزینه بهتری باشد.',
'Kammprofile یا Flexpro در برخی اتصالات حساس، به دلیل هسته شیارخورده فلزی و لایه نرم روی سطح، Recovery مناسبی ایجاد می‌کند و می‌تواند با Bolt Load کنترل‌شده آب‌بندی پایدار بدهد. اما سطح فلنج، Torque، متریال facing و روش نصب باید با آن هماهنگ باشد.',
'RTJ Gasket برای شیار RTJ طراحی شده و با RF قابل جایگزینی نیست. Ring Number، سختی، متریال و ابعاد باید با شیار فلنج تطبیق داشته باشد. کوچک‌ترین آسیب به Ring یا Groove می‌تواند در سرویس گاز یا فشار بالا نشتی ایجاد کند.',
'Batch Traceability در گسکت حیاتی است. Material Certificate، Marking، ابعاد، وضعیت فیزیکی و بسته‌بندی باید کنترل شود. در Shutdownها، تفکیک سایز و کلاس و Tag مهم است؛ نصب اشتباه یک گسکت می‌تواند راه‌اندازی واحد را عقب بیندازد.'
]),
'tenaris-pipes.html': ('بازنویسی عمیق: Tenaris و خرید لوله پروژه‌ای', [
'در خرید Tenaris باید اول مشخص شود محصول از کدام خانواده است: OCTG، Line Pipe، Seamless Pipe، Welded Pipe، Mechanical Tube یا Tube نیروگاهی. هر خانواده استاندارد، تست، اتصال و مدارک متفاوت دارد. اشتباه گرفتن OCTG با Line Pipe یا Mechanical Tube با Pipe فرایندی می‌تواند باعث رد فنی کالا شود.',
'در API 5L، Grade و PSL تعیین‌کننده‌اند. PSL2 نسبت به PSL1 الزام‌های سخت‌گیرانه‌تری در شیمی، Toughness و تست‌ها دارد. اگر پروژه Sour Service است، HIC/SSC، NACE، Hardness، Charpy و CE/Pcm باید از ابتدا در RFQ بیاید.',
'TenarisHydril و Premium Connections بیشتر در OCTG مطرح هستند و نباید بدون دلیل برای Line Pipe معمولی وارد شوند. در OCTG، Connection، Thread Compound، Drift، Coupling و Running Procedure اهمیت دارد. برای پروژه‌های غیرچاهی، این اصطلاحات ممکن است اصلاً کاربرد نداشته باشند.',
'در لوله‌های Seamless مثل ASTM A106 یا A335، سرویس دما و فشار تعیین‌کننده است. برای A335 P11/P22/P91، Heat Treatment، Hardness، PWHT و جوشکاری اهمیت دارد. اگر لوله برای سرویس دمای پایین یا خورنده است، استاندارد و تست‌های دیگری لازم می‌شود.',
'Heat Number، Bundle Number، Marking، MTC، طول شاخه، OD/WT و Test Report باید با خود لوله تطبیق داده شود. در خریدهای بزرگ، Inspection Release و عکس Marking پیش از حمل ریسک اختلاف را کاهش می‌دهد. لوله بدون Traceability برای پروژه‌های جدی قابل دفاع نیست.'
])
}

for fname, (heading, paras) in DEEP.items():
    p = Path('brands') / fname
    s = p.read_text(encoding='utf-8', errors='ignore')
    s = GENERIC.sub('', s)
    # Remove old phase marker if re-run is needed
    s = re.sub(r'<section class="box" data-brand-quality-rewrite="1">[\s\S]*?</section>', '', s)
    block = '<section class="box" data-brand-quality-rewrite="1"><h2>' + escape(heading) + '</h2>' + ''.join('<p>'+escape(x)+'</p>' for x in paras) + '</section>'
    s = s.replace('<h2>محصولات مرتبط', block + '<h2>محصولات مرتبط', 1)
    p.write_text(s, encoding='utf-8')
    text = re.sub(r'<(script|style)[\s\S]*?</\1>', ' ', s, flags=re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    print(fname, len(re.findall(r'[\wآ-ی]+', text)))
