#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep upgrade instrumentation product pages with richer unique content and low-size realistic product images."""
from pathlib import Path
import re

DATA = {
 'services/products/differential-pressure-transmitter.html': {
  'old':'../../assets/images/real/instrumentation-equipment.jpeg',
  'new':'../../assets/images/products/generated/dp-transmitter-manifold-realistic.jpg',
  'alt':'ترانسمیتر اختلاف فشار DP با منیفولد پنج شیر برای دبی، سطح و فیلتر',
  'mark':'dp-transmitter-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="dp-transmitter-deep-2026">
<h2>راهنمای عمیق انتخاب DP Transmitter برای دبی، سطح و فیلتر</h2>
<p>ترانسمیتر اختلاف فشار در ظاهر یک تجهیز ابزار دقیق ساده است، اما در عمل سه نقش کاملاً متفاوت می‌تواند داشته باشد: اندازه‌گیری دبی با Orifice یا Venturi، اندازه‌گیری سطح مخزن تحت فشار، یا پایش گرفتگی فیلتر و Strainer. هر کدام از این کاربردها Range، نصب، Manifold و حتی روش کالیبراسیون متفاوتی می‌خواهد. اگر فقط عبارت DP Transmitter در RFQ نوشته شود، فروشندگان ممکن است تجهیزی پیشنهاد دهند که از نظر رنج یا Static Pressure برای کاربرد واقعی مناسب نیست.</p>
<p>برای دبی، مهم‌ترین داده‌ها DP در دبی حداقل، نرمال و حداکثر، فشار خط، دما، چگالی و نوع Primary Element است. در سطح مخزن، ارتفاع مایع، چگالی، فشار بخار، محل نازل‌ها و نیاز به Wet Leg یا Remote Seal مهم می‌شود. برای فیلتر، Range معمولاً پایین‌تر است و پایداری در DP کم اهمیت دارد. بنابراین کاربر نهایی باید کاربرد DP را دقیق مشخص کند، نه فقط رنج کلی را.</p>
<p>Manifold برای DP Transmitter یک قطعه جانبی ساده نیست؛ ابزار اصلی نگهداری و کالیبراسیون ایمن است. Three-valve Manifold در کاربردهای رایج امکان ایزوله و Equalize کردن را فراهم می‌کند، اما در سرویس‌های حساس یا نیاز به Vent/Drain بهتر، Five-valve Manifold کاربردی‌تر است. اگر Manifold از ابتدا در محدوده خرید نباشد، تیم نصب ممکن است قطعه‌ای ناسازگار از نظر متریال یا اتصال تهیه کند.</p>
<p>در مقایسه برندهایی مثل Rosemount، Yokogawa، Endress+Hauser، Honeywell یا WIKA باید علاوه بر Accuracy، به Static Pressure Limit، Long-term Stability، Turndown، جنس Diaphragm، مدل Manifold، گواهی Ex و قابلیت Diagnostics توجه شود. در نقاطی که DP به سیستم ایمنی یا کنترل بحرانی وصل است، انتخاب مدل ارزان‌تر بدون بررسی پایداری و مدارک می‌تواند باعث Drift، Alarm کاذب یا خطای محاسبه دبی شود.</p>
</section>'''
 },
 'services/products/magnetic-flowmeter.html': {
  'old':'../../assets/images/real/closeup-instrumentation.jpg',
  'new':'../../assets/images/products/generated/magnetic-flowmeter-flanged-realistic.jpg',
  'alt':'فلومتر مغناطیسی فلنجی با ترانسمیتر بالاسری برای آب و سیالات رسانا',
  'mark':'magnetic-flowmeter-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="magnetic-flowmeter-deep-2026">
<h2>راهنمای عمیق انتخاب Magnetic Flowmeter؛ رسانایی، Liner و Grounding</h2>
<p>فلومتر مغناطیسی فقط زمانی درست کار می‌کند که سیال رسانایی کافی داشته باشد و لوله در محل اندازه‌گیری کاملاً پر باشد. این نکته برای کاربران بهره‌برداری بسیار مهم است، چون نصب Magmeter روی خطی که گاهی نیمه‌پر می‌شود یا حباب هوای زیاد دارد، باعث نوسان و خطای اندازه‌گیری می‌شود. برای روغن، سوخت‌های سبک، گاز یا بخار، Magmeter اصولاً انتخاب مناسبی نیست و باید سراغ تکنولوژی دیگری رفت.</p>
<p>انتخاب Liner و Electrode مستقیماً به شیمی و سایش سیال وابسته است. برای آب و فاضلاب، Rubber یا Polyurethane در بسیاری از کاربردها مناسب است، اما برای اسیدها و مواد شیمیایی خورنده، PTFE، PFA یا الکترودهای Hastelloy، Titanium یا Tantalum ممکن است لازم شود. در دوغاب یا پساب ساینده، فقط مقاومت شیمیایی کافی نیست؛ مقاومت سایشی Liner هم باید بررسی شود.</p>
<p>Grounding در Magmeter یک جزئیات نصب نیست؛ بخشی از سیستم اندازه‌گیری است. در لوله‌های غیرفلزی یا lined pipe، نبود Grounding Ring مناسب می‌تواند نویز و خطای سیگنال ایجاد کند. همچنین طول مستقیم بالادست و پایین‌دست، فاصله از پمپ، زانویی، شیر کنترلی و تزریق مواد شیمیایی باید در نصب بررسی شود. برای اندازه‌گیری پایدار، بهتر است Magmeter در جایی نصب شود که خط همیشه پر و پروفایل جریان نسبتاً پایدار باشد.</p>
<p>در مقایسه برندهایی مانند Endress+Hauser، KROHNE، Yokogawa، Siemens یا ABB، باید حداقل رسانایی قابل قبول، گزینه‌های Liner/Electrode، دقت در رنج‌های پایین، Diagnosticهای خالی بودن لوله، IP/Ex و خروجی‌های HART/Modbus/Profibus مقایسه شود. برای پروژه‌های آب و پساب، سرویس‌پذیری و دسترسی به Converter جایگزین نیز اهمیت دارد.</p>
</section>'''
 },
 'services/products/coriolis-flowmeter.html': {
  'old':'../../assets/images/real/instrumentation-equipment.jpeg',
  'new':'../../assets/images/products/generated/coriolis-flowmeter-realistic.jpg',
  'alt':'فلومتر کوریولیس جرمی با تیوب اندازه‌گیری و ترانسمیتر برای دقت بالا',
  'mark':'coriolis-flowmeter-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="coriolis-flowmeter-deep-2026">
<h2>راهنمای عمیق انتخاب Coriolis برای Mass Flow، Density و Batch</h2>
<p>فلومتر کوریولیس برای کاربری انتخاب می‌شود که اندازه‌گیری جرم، چگالی یا دقت بالا اهمیت دارد. برخلاف فلومترهای حجمی، خروجی اصلی آن وابستگی کمتری به تغییرات دما و فشار دارد، اما این به معنی بی‌نیازی از سایزینگ نیست. اگر سایز بیش از حد بزرگ انتخاب شود، سرعت و سیگنال اندازه‌گیری در دبی‌های کم ضعیف می‌شود؛ اگر خیلی کوچک باشد، افت فشار زیاد و محدودیت ظرفیت ایجاد می‌کند.</p>
<p>در سیالات ویسکوز، افت فشار و امکان تمیزکاری اهمیت دارد. برخی سیالات شیمیایی، پلیمرها یا روغن‌های سنگین ممکن است در تیوب‌های کوریولیس افت فشار قابل توجه ایجاد کنند. همچنین وجود حباب گاز یا جریان دو فازی می‌تواند اندازه‌گیری را ناپایدار کند. بنابراین برای خرید، فقط دبی جرمی کافی نیست؛ چگالی، ویسکوزیته، دما، فشار، درصد گاز احتمالی و رفتار سیال در Start-up باید مشخص شود.</p>
<p>برای کاربردهای Batch یا تزریق دقیق، Repeatability و Response Time به اندازه Accuracy مهم است. اگر فلومتر قرار است با PLC یا DCS برای کنترل Batch کار کند، پروتکل ارتباطی، زمان پاسخ، Totalizer، Pulse Output و قابلیت Zero Verification باید بررسی شود. در کاربردهای Custody یا اندازه‌گیری مالی، نوع کالیبراسیون و Traceability مدارک نقش تعیین‌کننده دارد.</p>
<p>در مقایسه برندهایی مثل Endress+Hauser، KROHNE، Emerson یا Yokogawa، به Tube Material، Pressure Rating، Rangeability، Diagnostics، قابلیت اندازه‌گیری Density، گواهی Ex و نوع Calibration توجه کنید. دو Coriolis با دقت اسمی مشابه ممکن است در ویسکوزیته بالا، دبی کم یا شرایط دو فازی رفتار متفاوتی داشته باشند.</p>
</section>'''
 },
 'services/products/vortex-flowmeter.html': {
  'old':'../../assets/images/real/closeup-instrumentation.jpg',
  'new':'../../assets/images/products/generated/vortex-flowmeter-realistic.jpg',
  'alt':'فلومتر ورتکس فلنجی برای بخار و گاز با ترانسمیتر بالاسری',
  'mark':'vortex-flowmeter-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="vortex-flowmeter-deep-2026">
<h2>راهنمای عمیق انتخاب Vortex Flowmeter برای بخار، گاز و Utility</h2>
<p>فلومتر ورتکس زمانی عملکرد خوبی دارد که عدد رینولدز و سرعت جریان در محدوده مناسب باشد. در دبی‌های خیلی کم، گردابه‌ها به‌خوبی شکل نمی‌گیرند و خروجی ناپایدار می‌شود. بنابراین برای بخار یا گاز، دبی حداقل به اندازه دبی نرمال اهمیت دارد. اگر هدف اندازه‌گیری مصرف بخار در بارهای کم شبانه یا زمستانی است، باید مطمئن شد Vortex در آن محدوده هنوز قابل اعتماد است.</p>
<p>در بخار و گاز، جبران فشار و دما می‌تواند تفاوت زیادی در دقت جرم یا انرژی ایجاد کند. یک Vortex ساده ممکن است دبی حجمی یا حجمی تصحیح‌نشده بدهد، اما برای محاسبه مصرف واقعی بخار، Multivariable Vortex یا استفاده از سنسور فشار/دما در سیستم کنترل لازم می‌شود. برای بخار اشباع، اندازه‌گیری فشار می‌تواند مبنای محاسبه چگالی باشد؛ برای بخار سوپرهیت، دما هم مهم است.</p>
<p>نصب Vortex به پروفایل جریان حساس است. زانویی، شیر کنترلی، Reducer، Expander یا پمپ نزدیک می‌تواند گردابه‌های نامنظم و خطا ایجاد کند. طول مستقیم بالادست و پایین‌دست باید طبق راهنمای سازنده رعایت شود. همچنین در خطوط بخار، Drain مناسب و جلوگیری از ضربه کندانس اهمیت دارد؛ چون ورود کندانس به سنسور می‌تواند سیگنال را ناپایدار کند یا به تجهیز آسیب بزند.</p>
<p>در مقایسه برندهایی مانند Yokogawa، Endress+Hauser، KROHNE یا Emerson، باید K-Factor، حداقل Reynolds، گزینه Multivariable، Pressure/Temperature Compensation، جنس بدنه، محدوده دما و گواهی کالیبراسیون بررسی شود. برای Utility، قابلیت Diagnostics و پایداری در بارهای متغیر از دقت اسمی کاتالوگ مهم‌تر است.</p>
</section>'''
 },
 'services/products/radar-level-transmitter.html': {
  'old':'../../assets/images/real/instrumentation-equipment.jpeg',
  'new':'../../assets/images/products/generated/radar-level-transmitter-realistic.jpg',
  'alt':'رادار لول ترانسمیتر با آنتن هورن و اتصال فلنجی برای مخازن صنعتی',
  'mark':'radar-level-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="radar-level-deep-2026">
<h2>راهنمای عمیق انتخاب Radar Level Transmitter برای مخزن واقعی</h2>
<p>رادار لول ترانسمیتر زمانی انتخاب خوبی است که نصب بدون تماس، نگهداری کم و اندازه‌گیری پایدار در مخازن مهم باشد. اما موفقیت آن به جزئیات مخزن وابسته است: ارتفاع، قطر، نوع سقف، نازل، Agitator، Foam، بخار، گردوغبار، Dielectric Constant و موانع داخلی. اگر این اطلاعات در RFQ نیاید، فروشنده ممکن است آنتن یا فرکانسی پیشنهاد دهد که روی سایت به Echo کاذب یا Dead Zone دچار شود.</p>
<p>Non-contact Radar و Guided Wave Radar کاربردهای متفاوتی دارند. Non-contact برای بسیاری از مخازن ذخیره و فرایندی مناسب است، اما در فوم شدید، Dielectric پایین یا Interface Measurement ممکن است GWR بهتر باشد. فرکانس‌های بالاتر مثل 80GHz Beam باریک‌تری دارند و در نازل‌های کوچک یا مخازن دارای مانع کمک می‌کنند، اما انتخاب فرکانس باید با شرایط واقعی مخزن و توصیه سازنده انجام شود.</p>
<p>نازل نصب یکی از منابع اصلی خطاست. نازل بلند، قطر کم، جوشکاری نامناسب یا وجود لبه داخلی می‌تواند سیگنال را مختل کند. آنتن باید از نازل بیرون‌زدگی مناسب یا طراحی سازگار داشته باشد. در مخازن دارای بخار یا کندانس، جنس آنتن، Seal، دما و فشار باید بررسی شود. برای مواد خورنده، PTFE، PEEK یا آلیاژهای خاص ممکن است لازم شود.</p>
<p>در مقایسه برندهایی مانند VEGA، Endress+Hauser، Emerson، KROHNE یا Yokogawa باید فراتر از Range اسمی نگاه کرد. Beam Angle، False Echo Mapping، Diagnostics، Overfill Protection، SIL، Ex Certificate، جنس آنتن و تجربه سازنده در سیال مشابه معیارهای کلیدی هستند. برای مخازن ذخیره، قابلیت اطمینان بلندمدت از قیمت اولیه مهم‌تر است.</p>
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
