#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep upgrade next valve/control-valve product pages with richer unique content and realistic product images."""
from pathlib import Path
import re

DATA = {
 'services/products/gate-valve.html': {
  'old':'../../assets/images/real/valves.jpg',
  'new':'../../assets/images/products/generated/gate-valve-api600-realistic.jpg',
  'alt':'گیت ولو فلنجی API 600 با Bonnet پیچ‌دار و Handwheel برای ایزولاسیون خطوط صنعتی',
  'mark':'gate-valve-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="gate-valve-deep-2026">
<h2>راهنمای عمیق انتخاب Gate Valve برای کاربر خط و تیم تعمیرات</h2>
<p>در گیت ولو، مهم‌ترین نکته این است که تجهیز برای <strong>ایزولاسیون کامل</strong> طراحی شده است، نه کنترل دبی. اگر بهره‌بردار عادت داشته باشد شیر را نیمه‌باز نگه دارد، جریان از زیر Wedge با سرعت بالا عبور می‌کند و باعث فرسایش Seat، لرزش Wedge و نشتی تدریجی می‌شود. بنابراین در دستورالعمل بهره‌برداری باید مشخص شود Gate Valve یا کاملاً باز است یا کاملاً بسته. اگر پروژه به کنترل جریان نیاز دارد، Globe Valve یا Control Valve باید بررسی شود.</p>
<p>نوع Wedge در سرویس‌های دمایی اهمیت ویژه دارد. Solid Wedge برای سرویس‌های عمومی ساده‌تر است، اما در بخار یا خطوطی که سیکل حرارتی دارند، Flexible Wedge می‌تواند خطر گیرکردن ناشی از انبساط حرارتی را کاهش دهد. در کلاس‌های بالا، Pressure Seal Bonnet به‌جای Bolted Bonnet رایج می‌شود، چون فشار داخلی به آب‌بندی Bonnet کمک می‌کند. این انتخاب‌ها مستقیماً روی قیمت، وزن، تعمیرپذیری و زمان تحویل اثر دارند.</p>
<p>در بازرسی گیت ولو، فقط تست Seat کافی نیست. Backseat Test، کنترل Stem، وضعیت Thread، یکنواختی حرکت Handwheel، Marking کلاس و متریال، Face-to-Face و کیفیت سطح فلنج باید بررسی شود. اگر ولو قرار است Gearbox داشته باشد، نسبت گیربکس و تعداد دور تا بازشدن کامل باید برای بهره‌بردار قابل قبول باشد. در خطوط بزرگ، نداشتن Gearbox مناسب می‌تواند عملاً بهره‌برداری را سخت یا ناایمن کند.</p>
<p>برای برندهایی مانند Velan، Crane، Neway، KITZ، OMB یا Bonney Forge باید دقیقاً سری محصول، استاندارد ساخت، کشور سازنده، متریال Trim و مدارک تست مقایسه شود. یک Gate Valve API 600 از دو برند متفاوت ممکن است از نظر ضخامت بدنه، کیفیت Trim، طراحی Wedge و جزئیات Bonnet تفاوت داشته باشد. در TBE پروژه، بهتر است جدول مقایسه فنی شامل Wedge Type، Bonnet، Trim No، Seat Leakage و مدارک قابل ارائه باشد.</p>
</section>'''
 },
 'services/products/globe-valve.html': {
  'old':'../../assets/images/real/valve-inspection-qc.jpg',
  'new':'../../assets/images/products/generated/globe-valve-api623-realistic.jpg',
  'alt':'گلوب ولو فلنجی صنعتی API 623 با بدنه کروی و Handwheel برای بخار و فرایند',
  'mark':'globe-valve-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="globe-valve-deep-2026">
<h2>راهنمای عمیق انتخاب Globe Valve برای افت فشار، جهت جریان و سرویس بخار</h2>
<p>گلوب ولو برخلاف گیت ولو، مسیر جریان مستقیم ندارد و همین موضوع باعث افت فشار بیشتر اما کنترل‌پذیری بهتر می‌شود. کاربر بهره‌بردار باید بداند که Globe Valve برای نقاطی مناسب است که نشتی کمتر، امکان تنظیم دستی محدود یا تعمیرپذیری Seat اهمیت دارد. در خطوطی که افت فشار مجاز بسیار کم است، انتخاب Globe Valve بدون محاسبه می‌تواند باعث کاهش ظرفیت خط یا افزایش مصرف انرژی پمپ شود.</p>
<p>انتخاب T Pattern، Y Pattern یا Angle Pattern باید بر اساس سرویس انجام شود. T Pattern در کاربردهای عمومی رایج است، اما در بخار فشار بالا یا جایی که افت فشار باید کمتر شود، Y Pattern می‌تواند گزینه بهتری باشد. Angle Pattern علاوه بر عملکرد شیر، مسیر خط را هم تغییر می‌دهد و در Drain، Blowdown یا نقاط خاص نصب کاربرد دارد. اگر جهت جریان با فلش بدنه هماهنگ نباشد، نیروی وارد بر Disc و Stem، نشتی و عمر Packing تغییر می‌کند.</p>
<p>در سرویس بخار، Packing و Trim اهمیت زیادی دارند. Graphite Packing معمولاً برای دمای بالا مناسب‌تر از PTFE است. Trim استلایت یا Hardfaced در سرویس‌های ساینده یا دمایی می‌تواند عمر Seat و Disc را افزایش دهد. اگر Globe Valve به‌صورت مکرر برای تنظیم استفاده می‌شود، نوع Disc و جنس Seat باید با این سیکل کاری هماهنگ باشد، وگرنه شیر بعد از مدت کوتاهی دچار Wire Drawing و نشتی می‌شود.</p>
<p>در ارزیابی برندهایی مانند Velan، Crane، Neway، KITZ یا OMB باید علاوه بر استاندارد API 623 یا BS 1873، به جزئیاتی مثل نوع Disc، کیفیت Stem Thread، امکان تعویض Seat، جنس Packing و تست نشتی توجه شود. دو Globe Valve با یک سایز و کلاس ممکن است در سرویس بخار رفتار کاملاً متفاوتی داشته باشند، چون طراحی داخلی و متریال Trim آنها متفاوت است.</p>
</section>'''
 },
 'services/products/check-valve.html': {
  'old':'../../assets/images/real/valves.jpg',
  'new':'../../assets/images/products/generated/check-valve-dual-plate-realistic.jpg',
  'alt':'چک ولو Dual Plate صنعتی با دیسک دو صفحه‌ای برای جلوگیری از برگشت جریان',
  'mark':'check-valve-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="check-valve-deep-2026">
<h2>راهنمای عمیق انتخاب Check Valve با تمرکز بر Slam، حداقل سرعت و حفاظت پمپ</h2>
<p>چک ولو برخلاف شیرهای دستی، با رفتار دینامیکی جریان کار می‌کند. اگر سرعت جریان برای باز نگه داشتن دیسک کافی نباشد، دیسک مدام نوسان می‌کند و صدای ضربه، سایش Seat و خرابی زودرس ایجاد می‌شود. به همین دلیل انتخاب Check Valve فقط بر اساس سایز خط اشتباه است؛ باید حداقل سرعت، دبی نرمال، چگالی سیال، جهت نصب و فشار برگشتی بررسی شود.</p>
<p>Swing Check در خطوط افقی و جریان پایدار افت فشار کمی دارد، اما در خروجی پمپ‌هایی که جریان ناگهان قطع می‌شود ممکن است دیسک با تأخیر بسته شود و Slam ایجاد کند. Dual Plate Check Valve معمولاً سبک‌تر و سریع‌تر است و در بسیاری از خطوط صنعتی به‌دلیل ابعاد کمتر و پاسخ بهتر استفاده می‌شود. Nozzle Check برای سرویس‌های حساس‌تر به ضربه قوچ انتخاب می‌شود، چون طراحی آن برای بسته‌شدن سریع‌تر و کنترل‌شده‌تر است.</p>
<p>برای کاربر نگهداری، دسترسی به Seat، Spring و Hinge Pin مهم است. در سیالات کثیف یا دارای ذرات، گیرکردن دیسک یکی از ریسک‌های جدی است. اگر Check Valve در خروجی پمپ نصب می‌شود، فاصله از پمپ، وجود زانویی، Reducer و شیر کنترلی نزدیک می‌تواند روی پروفایل جریان و عملکرد دیسک اثر بگذارد. این نکات باید پیش از خرید و در Layout بررسی شوند.</p>
<p>در مقایسه برندهایی مانند Neway، Velan، Crane، KITZ یا OMB، فقط نوع Check Valve کافی نیست. باید Cracking Pressure، Material Spring، Seat Type، امکان نصب عمودی/افقی، استاندارد تست و فشار کاری بررسی شود. برای خطوط حساس، درخواست Curve افت فشار و حداقل Flow برای بازماندن دیسک می‌تواند از انتخاب اشتباه جلوگیری کند.</p>
</section>'''
 },
 'services/products/butterfly-valve.html': {
  'old':'../../assets/images/real/valves.jpg',
  'new':'../../assets/images/products/generated/butterfly-valve-triple-offset-realistic.jpg',
  'alt':'باترفلای ولو Triple Offset با دیسک فلزی و گیربکس برای سرویس صنعتی',
  'mark':'butterfly-valve-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="butterfly-valve-deep-2026">
<h2>راهنمای عمیق انتخاب Butterfly Valve؛ از Rubber Lined تا Triple Offset</h2>
<p>باترفلای ولو در ظاهر ساده است، اما انتخاب اشتباه آن بسیار رایج است. Concentric Rubber Lined برای آب، Utility و سرویس‌های تمیز با دمای محدود مناسب است؛ اما همین طراحی برای بخار داغ، هیدروکربن حساس یا سیال ساینده می‌تواند انتخاب پرریسکی باشد. در سرویس‌هایی که دما، فشار یا نشتی اهمیت بیشتری دارد، Double Offset یا Triple Offset باید بررسی شود.</p>
<p>Triple Offset Butterfly Valve با طراحی خارج‌مرکز سه‌گانه، تماس سایشی بین Seat و Disc را کاهش می‌دهد و برای Metal Seat، دمای بالاتر و نشتی کمتر مناسب‌تر است. اما این مزیت با قیمت بالاتر، حساسیت بیشتر به کیفیت ساخت و نیاز به نصب دقیق همراه است. اگر فلنج‌ها هم‌محور نباشند یا Torque بیش از حد اعمال شود، آب‌بندی و عمر Seat تحت تأثیر قرار می‌گیرد.</p>
<p>در بهره‌برداری، گشتاور باز و بسته شدن تابع فشار، Seat، سایز و نوع سیال است. انتخاب Gearbox یا Actuator بدون Torque Data واقعی خطرناک است. برای شیرهای بزرگ، حتی تغییر کوچک در فشار تفاضلی می‌تواند گشتاور مورد نیاز را بالا ببرد. بنابراین در RFQ باید فشار کاری، فشار تفاضلی در زمان باز و بسته شدن و نوع عملگر مشخص شود.</p>
<p>در بررسی برندهایی مثل KITZ، Neway، Crane، Velan یا سازندگان تخصصی Butterfly Valve، باید نوع Seat، استاندارد API 609، کلاس نشتی، Face-to-Face، نوع اتصال Wafer/Lug/Flanged و مدارک تست مقایسه شود. در خطوط آب، کیفیت Rubber Lining و Coating اهمیت دارد؛ در خطوط فرایندی، متریال Disc و Shaft و گواهی Fire Safe یا NACE ممکن است تعیین‌کننده باشد.</p>
</section>'''
 },
 'services/products/control-valve.html': {
  'old':'../../assets/images/real/closeup-instrumentation.jpg',
  'new':'../../assets/images/products/generated/control-valve-pneumatic-positioner-realistic.jpg',
  'alt':'کنترل ولو Globe با اکچویتور پنوماتیک و پوزیشنر هوشمند برای کنترل فرایند',
  'mark':'control-valve-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="control-valve-deep-2026">
<h2>راهنمای عمیق انتخاب Control Valve برای پایداری حلقه کنترل</h2>
<p>کنترل ولو نقطه‌ای است که تصمیم مهندسی فرایند، ابزار دقیق و مکانیک به هم می‌رسد. اگر Cv درست انتخاب نشود، ولو یا در درصد بازشدگی بسیار کم کار می‌کند و کنترل ناپایدار می‌شود، یا در بار حداکثر به انتهای Travel می‌رسد و ظرفیت کافی نمی‌دهد. بنابراین برای کاربر نهایی، مهم‌ترین خروجی خرید Control Valve فقط خود ولو نیست؛ <strong>Vendor Sizing Sheet</strong> معتبر است که نشان دهد ولو در Min/Normal/Max Flow در محدوده قابل کنترل کار می‌کند.</p>
<p>در سرویس مایع با افت فشار بالا، Cavitation و Flashing باید جداگانه بررسی شود. اگر کاویتاسیون شدید باشد، Trim معمولی به‌سرعت آسیب می‌بیند و نویز و لرزش ایجاد می‌شود. Anti-cavitation Cage یا Multi-stage Trim هزینه اولیه را بالا می‌برد، اما در سرویس‌های سخت می‌تواند از خرابی زودرس و توقف تولید جلوگیری کند. در سرویس گاز و بخار، Noise Calculation و Choked Flow اهمیت مشابهی دارند.</p>
<p>Actuator و Positioner باید با بدنه و Trim هماهنگ انتخاب شوند. Fail Close یا Fail Open فقط یک گزینه فروشگاهی نیست؛ این تصمیم به فلسفه ایمنی واحد وابسته است. Actuator باید Thrust یا Torque کافی با Safety Factor داشته باشد و Positioner باید با پروتکل کنترلی پروژه، مثل HART، Foundation Fieldbus یا Profibus سازگار باشد. کیفیت Tubing، Air Filter Regulator و Solenoid نیز روی عملکرد واقعی سایت اثر دارد.</p>
<p>برای برندهایی مانند Fisher، Samson، Emerson، Flowserve، Spirax Sarco یا Yokogawa باید مدل دقیق، Trim Code، Leakage Class، Actuator Size، Positioner Model و گواهی‌های Ex/SIL مقایسه شود. یک Control Valve ارزان با Trim نامناسب می‌تواند در چند ماه اول بهره‌برداری هزینه‌ای بسیار بیشتر از اختلاف قیمت اولیه ایجاد کند.</p>
</section>'''
 }
}

for fp,d in DATA.items():
    p=Path(fp)
    s=p.read_text(encoding='utf-8',errors='ignore')
    if d['mark'] in s:
        continue
    old_abs='https://pishtaj.ir/'+d['old'].replace('../../','')
    new_abs='https://pishtaj.ir/'+d['new'].replace('../../','')
    s=s.replace(d['old'],d['new']).replace(old_abs,new_abs)
    s=re.sub(r'(<div class="ptf-hero-card"><img src="'+re.escape(d['new'])+r'" alt=")[^"]*(" width=")',r'\1'+d['alt']+r'\2',s,count=1)
    idx=s.find('<div class="ptf-cta">')
    if idx!=-1:
        s=s[:idx]+d['section']+s[idx:]
    p.write_text(s,encoding='utf-8')
print('upgraded',len(DATA))
