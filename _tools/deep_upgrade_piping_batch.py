#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep upgrade piping product pages with low-size realistic single-product images and richer content."""
from pathlib import Path
import re

DATA = {
 'services/products/seamless-pipe.html': {
  'old':'../../assets/images/products/seamless-pipe-a106.jpg',
  'new':'../../assets/images/products/generated/seamless-pipe-a106-realistic.jpg',
  'alt':'لوله مانیسمان ASTM A106 با انتهای Beveled و ضخامت دیواره قابل مشاهده',
  'mark':'seamless-pipe-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="seamless-pipe-deep-2026">
<h2>راهنمای عمیق خرید لوله مانیسمان برای انبار، QC و نصب سایت</h2>
<p>در لوله مانیسمان، عبارت «بدون درز» به‌تنهایی برای خرید کافی نیست. کاربر پروژه باید بداند لوله برای چه سرویس و چه کد طراحی استفاده می‌شود. ASTM A106 Gr.B در بسیاری از خطوط فرایندی و دمای بالا رایج است، اما برای دمای پایین، سرویس ترش یا خطوط انتقال ممکن است ASTM A333، API 5L یا متریال دیگری لازم شود. بنابراین قبل از قیمت‌گیری باید استاندارد، Grade، Schedule، دمای طراحی و الزامات Impact/NACE روشن باشد.</p>
<p>برای تیم QC، مهم‌ترین نقطه کنترل، تطبیق Heat Number روی لوله با MTC است. اگر Heat Number روی بدنه یا بسته‌بندی قابل ردیابی نباشد، حتی MTC معتبر هم در تحویل پروژه مشکل ایجاد می‌کند. در بازرسی ورودی باید OD، ضخامت واقعی، Ovality، Straightness، وضعیت Bevel، آسیب انتهای لوله، خوردگی سطحی و یکنواختی Marking کنترل شود. این موارد مستقیماً روی Fit-up، جوشکاری و پذیرش کارفرما اثر دارند.</p>
<p>در نصب سایت، تفاوت Scheduleها اهمیت عملی دارد. Schedule 40 در سایزهای مختلف ضخامت یکسان ندارد و نباید به‌عنوان فشار مجاز مستقیم تفسیر شود. فشار مجاز به متریال، دما، ضخامت واقعی، Corrosion Allowance و کد طراحی وابسته است. اگر لوله برای بخار، کندانس یا سیال داغ استفاده می‌شود، Expansion، ساپورت‌گذاری و تنش حرارتی هم باید در طراحی لحاظ شده باشد.</p>
<p>در مقایسه سازندگان یا منابع تأمین مانند Tenaris، Vallourec، Sumitomo، Nippon Steel، JFE یا Sandvik، باید فقط نام برند دیده نشود. کشور ساخت، امکان ارائه MTC 3.1/3.2، سابقه پروژه مشابه، تلرانس ابعادی، Lead Time، بسته‌بندی، End Cap و محافظت Bevel در حمل اهمیت دارند. برای سفارش‌های بزرگ، Inspection Release Note و عکس بسته‌بندی قبل از حمل می‌تواند از اختلافات تحویل جلوگیری کند.</p>
</section>'''
 },
 'services/products/welding-flanges.html': {
  'old':'../../assets/images/products/welding-neck-flanges.jpg',
  'new':'../../assets/images/products/generated/welding-neck-flanges-realistic.jpg',
  'alt':'فلنج گلودار جوشی ASME B16.5 با Raised Face و سوراخ‌کاری استاندارد',
  'mark':'flanges-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="flanges-deep-2026">
<h2>راهنمای عمیق انتخاب فلنج؛ Facing، Bore، Bolting و نشتی اتصال</h2>
<p>فلنج صنعتی نقطه‌ای است که طراحی پایپینگ، نصب مکانیکی و آب‌بندی به هم می‌رسند. انتخاب نوع فلنج فقط بر اساس سایز و کلاس کافی نیست. Welding Neck برای سرویس‌های حساس، دمای بالا، فشار بالا یا بار مکانیکی بیشتر مناسب‌تر است، چون تنش را از محل جوش به شکل یکنواخت‌تری منتقل می‌کند. Slip-On اقتصادی‌تر است، اما در سرویس‌های سخت یا سیکل حرارتی معمولاً محدودیت بیشتری دارد.</p>
<p>Facing یکی از رایج‌ترین منابع خطای خرید است. Raised Face، Flat Face و RTJ با گسکت‌های متفاوتی کار می‌کنند و ترکیب اشتباه آن‌ها می‌تواند در تست هیدرواستاتیک یا راه‌اندازی باعث نشتی شود. برای RTJ باید نوع Ring، سختی متریال و شیار فلنج دقیق باشد. برای RF، کیفیت سطح Serration، کلاس فلنج و نوع گسکت Spiral Wound یا Kammprofile باید هماهنگ شود.</p>
<p>در Welding Neck، Bore و Schedule گردن فلنج باید با لوله تطبیق داشته باشد. اگر Bore اشتباه باشد، Fit-up و جوشکاری مشکل می‌شود و ممکن است ناپیوستگی داخلی یا تمرکز تنش ایجاد شود. در بازرسی، قطر سوراخ‌ها، PCD، ضخامت، ارتفاع Raised Face، Marking، متریال و Heat Number باید با ASME B16.5 یا B16.47 کنترل شود.</p>
<p>در مقایسه برندهایی مثل Galperti، Melesi، Bonney Forge یا سازندگان فورج تأییدشده، باید به کیفیت فورج، عملیات حرارتی، نرمالایز بودن A105N در صورت الزام، PMI برای استنلس/آلیاژی، MTC و تلرانس ابعادی توجه شود. فلنج ارزان اما خارج از تلرانس می‌تواند هزینه نصب و نشتی بسیار بیشتری از اختلاف قیمت اولیه ایجاد کند.</p>
</section>'''
 },
 'services/products/butt-weld-fittings.html': {
  'old':'../../assets/images/real/closeup-piping-flanges.jpg',
  'new':'../../assets/images/products/generated/butt-weld-fittings-realistic.jpg',
  'alt':'مجموعه فیتینگ جوشی ASME B16.9 شامل زانویی، سه‌راهی و ردیوسر با Bevel',
  'mark':'bw-fittings-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="bw-fittings-deep-2026">
<h2>راهنمای عمیق انتخاب فیتینگ جوشی؛ Bevel، Schedule و نصب بدون تنش</h2>
<p>فیتینگ جوشی در ظاهر یک قطعه ساده برای تغییر مسیر یا قطر خط است، اما کیفیت آن مستقیماً روی کیفیت جوش، افت فشار، تنش موضعی و قابلیت بازرسی اثر می‌گذارد. Elbow، Tee، Reducer و Cap باید از نظر استاندارد ASME B16.9، متریال، ضخامت و Bevel با Pipe Spec هماهنگ باشند. اگر Schedule فیتینگ با لوله هم‌خوان نباشد، آماده‌سازی جوش و Fit-up مشکل می‌شود.</p>
<p>در انتخاب Reducer، تفاوت Concentric و Eccentric فقط شکل ظاهری نیست. در Suction پمپ، Eccentric Reducer با جهت صحیح نصب می‌شود تا تجمع هوا یا ایجاد NPSH مشکل‌ساز کاهش یابد. در خطوط عمودی یا نقاطی که تقارن جریان مهم است، Concentric رایج‌تر است. اشتباه در همین انتخاب می‌تواند به کاویتاسیون پمپ، لرزش یا مشکل Drain/Vent منجر شود.</p>
<p>برای QC، Bevel و Ovality اهمیت زیادی دارد. اگر Bevel مطابق ASME B16.25 نباشد یا انتهای فیتینگ در حمل آسیب ببیند، تیم نصب باید قبل از جوشکاری اصلاح انجام دهد. در فیتینگ‌های استنلس یا آلیاژی، PMI می‌تواند از اختلاط متریال جلوگیری کند. برای سرویس‌های ترش یا دمای پایین، NACE یا Impact Test باید از ابتدا در سفارش بیاید.</p>
<p>در مقایسه سازندگان مانند Galperti، Melesi، Bonney Forge یا منابع تأییدشده، باید Seamless/Welded بودن، روش ساخت، Heat Treatment، MTC، Marking و Dimensional Report کنترل شود. فیتینگ‌های ارزان و بدون Traceability در پروژه‌های EPC معمولاً در مرحله بازرسی ورودی یا پیش از نصب مشکل ایجاد می‌کنند.</p>
</section>'''
 },
 'services/products/industrial-gaskets.html': {
  'old':'../../assets/images/real/real-flange-closeup.jpg',
  'new':'../../assets/images/products/generated/industrial-gaskets-realistic.jpg',
  'alt':'گسکت صنعتی شامل Spiral Wound، RTJ و Kammprofile برای اتصالات فلنجی',
  'mark':'gaskets-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="gaskets-deep-2026">
<h2>راهنمای عمیق انتخاب گسکت؛ آب‌بندی واقعی از متریال تا Torque</h2>
<p>گسکت از نظر قیمت شاید کوچک‌ترین جزء اتصال فلنجی باشد، اما از نظر ریسک نشتی یکی از مهم‌ترین اجزاست. انتخاب گسکت باید با Facing فلنج، کلاس فشار، دما، سیال، کیفیت سطح فلنج، Bolt Load و روش Torque هماهنگ باشد. اگر اتصال در سرویس بخار، هیدروکربن یا ماده شیمیایی خورنده است، انتخاب گسکت عمومی می‌تواند باعث نشتی در راه‌اندازی یا پس از چند سیکل حرارتی شود.</p>
<p>Spiral Wound Gasket برای بسیاری از فلنج‌های RF در سرویس‌های صنعتی رایج است، اما Filler و Ring Material باید درست انتخاب شود. Graphite برای دمای بالا مناسب‌تر است؛ PTFE مقاومت شیمیایی خوبی دارد ولی محدودیت دمایی و خزش دارد. Kammprofile در برخی اتصالات حساس با تنش نشیمن کمتر عملکرد خوبی می‌دهد. RTJ فقط برای فلنج RTJ و شیار مناسب طراحی شده و نباید با RF اشتباه شود.</p>
<p>برای تیم نصب، گسکت بدون دستور Torque کافی نیست. الگوی بستن پیچ‌ها، روانکاری Stud Bolt، وضعیت سطح فلنج، هم‌محوری، ضخامت گسکت و استفاده نکردن مجدد از گسکت‌های مصرف‌شده همگی روی آب‌بندی اثر دارند. حتی بهترین گسکت اگر با Torque نامناسب یا سطح فلنج آسیب‌دیده نصب شود، ممکن است نشتی بدهد.</p>
<p>در مقایسه برندهایی مثل Flexitallic، Klinger، Garlock، Teadit یا Spetech باید Batch Traceability، متریال رینگ و Filler، استاندارد ASME B16.20/B16.21، ابعاد و بسته‌بندی کنترل شود. در پروژه‌های Shutdown، موجودی سریع مهم است، اما نباید باعث جایگزینی متریال نامناسب شود؛ چون نشتی بعد از راه‌اندازی هزینه بسیار بیشتری دارد.</p>
</section>'''
 }
}

for fp,d in DATA.items():
    p=Path(fp); s=p.read_text(encoding='utf-8', errors='ignore')
    if d['mark'] in s: continue
    old_abs='https://pishtaj.ir/'+d['old'].replace('../../',''); new_abs='https://pishtaj.ir/'+d['new'].replace('../../','')
    s=s.replace(d['old'],d['new']).replace(old_abs,new_abs)
    s=re.sub(r'(<div class="ptf-hero-card"><img src="'+re.escape(d['new'])+r'" alt=")[^"]*(" width=")',r'\1'+d['alt']+r'\2',s,count=1)
    idx=s.find('<div class="ptf-cta">')
    if idx!=-1: s=s[:idx]+d['section']+s[idx:]
    p.write_text(s,encoding='utf-8')
print('upgraded',len(DATA))
