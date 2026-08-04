#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep upgrade pump/compressor/steam/fixed-equipment pages with low-size realistic product images."""
from pathlib import Path
import re

DATA = {
 'services/products/api-610-centrifugal-pump.html': {
  'old':'../../assets/images/real/pumps-industrial.jpeg',
  'new':'../../assets/images/products/generated/api-610-centrifugal-pump-realistic.jpg',
  'alt':'پمپ سانتریفیوژ افقی API 610 با بیس‌پلیت، کوپلینگ و موتور برای سرویس فرایندی',
  'mark':'api610-pump-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="api610-pump-deep-2026"><h2>راهنمای عمیق انتخاب پمپ API 610 برای قابلیت اطمینان فرایند</h2><p>پمپ API 610 برای سرویس‌هایی انتخاب می‌شود که توقف آنها روی تولید، ایمنی یا کیفیت فرایند اثر مستقیم دارد. بنابراین خرید آن نباید فقط با دبی و هد انجام شود. نقطه کاری باید روی منحنی پمپ، فاصله از BEP، NPSHa/NPSHr، ویسکوزیته، فشار مکش، دمای سیال و سناریوهای Start-up و Turndown بررسی شود. اگر پمپ در محدوده دور از BEP کار کند، لرزش، بار شعاعی، خرابی Seal و مصرف انرژی افزایش می‌یابد.</p><p>نوع پمپ در API 610 باید با سرویس هماهنگ باشد. OH2 برای بسیاری از سرویس‌های فرایندی افقی رایج است؛ BB2 یا BB3 در فشار/توان بالاتر کاربرد دارد؛ و BB5 یا VS در شرایط خاص مثل فشار بالا یا نصب عمودی بررسی می‌شود. انتخاب نوع پمپ روی Baseplate، Coupling، Bearing، Seal Plan، ابعاد فونداسیون و تعمیرات اثر دارد و باید قبل از خرید با Layout و فلسفه نگهداری سایت هماهنگ شود.</p><p>Seal Plan بخش حیاتی پکیج پمپ است. در سرویس‌های داغ، خورنده، سمی یا دارای ذرات، Mechanical Seal معمولی بدون Plan مناسب به‌سرعت آسیب می‌بیند. API 682 و انتخاب Plan 11، 21، 23، 52 یا 53 باید بر اساس سیال، فشار، دما و خطر انجام شود. همچنین Flush، Cooler، Reservoir، Instrumentation و Alarmها باید در محدوده تأمین روشن باشد.</p><p>در مقایسه سازندگان API 610 مانند Flowserve، KSB، Sulzer، Ebara یا سایر وندورهای تأییدشده، فقط قیمت پمپ کافی نیست. Performance Test، NPSH Test، Vibration، Material Class، Seal Vendor، Bearing Design، Baseplate Stiffness و مدارک ITP باید مقایسه شوند. برای کاربر بهره‌بردار، دسترسی به قطعات یدکی و کیفیت مستندات نگهداری به اندازه قیمت اولیه مهم است.</p></section>'''
 },
 'services/products/dosing-metering-pump.html': {
  'old':'../../assets/images/real/closeup-pump.jpg',
  'new':'../../assets/images/products/generated/dosing-metering-pump-realistic.jpg',
  'alt':'دوزینگ پمپ دیافراگمی صنعتی با هد تزریق و متعلقات پکیج شیمیایی',
  'mark':'dosing-pump-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="dosing-pump-deep-2026"><h2>راهنمای عمیق انتخاب دوزینگ پمپ برای تزریق دقیق و ایمن مواد شیمیایی</h2><p>دوزینگ پمپ زمانی درست انتخاب می‌شود که ماده شیمیایی، فشار خط و دقت تزریق هم‌زمان بررسی شوند. انتخاب صرفاً بر اساس لیتر بر ساعت کافی نیست؛ ویسکوزیته، خورندگی، فشار Back Pressure، دمای ماده، غلظت و خطرات MSDS باید مشخص باشد. ماده‌ای مثل اسید، سود، پلیمر یا Corrosion Inhibitor هرکدام متریال Head، Diaphragm، Valve و Seal متفاوتی می‌خواهند.</p><p>در پمپ‌های API 675 یا Metering Pumpهای صنعتی، Accuracy، Repeatability و Turndown اهمیت عملیاتی دارند. اگر تزریق برای کنترل خوردگی یا کیفیت آب استفاده می‌شود، خطای دوزینگ می‌تواند باعث مصرف اضافی ماده یا آسیب به تجهیز شود. در دبی‌های کم، Stroke Length، Stroke Frequency و کنترل 4-20mA باید با نیاز فرایندی هماهنگ باشد.</p><p>پکیج تزریق فقط خود پمپ نیست. Pulsation Dampener، Calibration Pot، Back Pressure Valve، Pressure Relief Valve، Injection Quill، Strainer، مخزن و Mixer ممکن است برای عملکرد پایدار لازم باشند. حذف این اقلام برای کاهش قیمت اولیه معمولاً در راه‌اندازی مشکل ایجاد می‌کند. در خطوط حساس، نوسان فشار پمپ‌های جابجایی مثبت باید با Dampener کنترل شود تا ابزار دقیق و خط تزریق آسیب نبینند.</p><p>در مقایسه برندهایی مانند Milton Roy، ProMinent، LEWA، Grundfos یا Seko باید به متریال Head، محدوده فشار، دقت، امکان تأمین Diaphragm و Valve Kit، مدارک تست و تجربه سازنده در ماده مشابه توجه شود. برای بهره‌بردار، سهولت هواگیری، کالیبراسیون و دسترسی به قطعه یدکی در طول عمر تجهیز بسیار مهم است.</p></section>'''
 },
 'services/products/screw-compressor.html': {
  'old':'../../assets/images/real/compressors-industrial.jpeg',
  'new':'../../assets/images/products/generated/screw-compressor-realistic.jpg',
  'alt':'کمپرسور اسکرو صنعتی پکیج‌شده برای هوای فشرده Plant Air و Instrument Air',
  'mark':'screw-compressor-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="screw-compressor-deep-2026"><h2>راهنمای عمیق انتخاب کمپرسور اسکرو بر اساس کیفیت هوا و هزینه انرژی</h2><p>کمپرسور اسکرو یکی از تجهیزاتی است که هزینه انرژی آن در طول عمر معمولاً از قیمت خرید اولیه بیشتر می‌شود. بنابراین انتخاب ظرفیت، فشار کاری، نوع کنترل و VSD باید با پروفایل مصرف واقعی سایت انجام شود. اگر کمپرسور بیش از حد بزرگ انتخاب شود، کارکرد Unload/Load زیاد و مصرف انرژی بالا می‌رود؛ اگر کوچک باشد، فشار شبکه افت می‌کند و تجهیزات پنوماتیک یا ابزار دقیق دچار مشکل می‌شوند.</p><p>کیفیت هوا برای Plant Air و Instrument Air یکسان نیست. برای Instrument Air، Dew Point، Oil Content و ذرات باید مطابق ISO 8573-1 و Spec پروژه کنترل شود. در بسیاری از سایت‌ها مشکل اصلی خود کمپرسور نیست، بلکه Dryer، فیلتر، Receiver، Drain و لوله‌کشی نامناسب است. بنابراین کمپرسور باید به‌عنوان یک سیستم هوای فشرده دیده شود، نه فقط یک ماشین.</p><p>Oil-injected Screw Compressor برای کاربردهای عمومی اقتصادی و رایج است، اما اگر آلودگی روغن قابل قبول نباشد، Oil-free باید بررسی شود. Air-cooled یا Water-cooled بودن نیز به ظرفیت، دمای محیط، تهویه اتاق و دسترسی به آب خنک‌کن بستگی دارد. تهویه ضعیف اتاق کمپرسور می‌تواند دمای کاری را بالا ببرد و عمر روغن، فیلتر و Air-end را کم کند.</p><p>در مقایسه برندهایی مانند Atlas Copco، Ingersoll Rand، Kaeser، Sullair یا CompAir، باید FAD واقعی، Specific Power، کلاس کیفیت هوا، سطح صدا، Service Interval، موجودی فیلتر و قطعات مصرفی و نرم‌افزار کنترل بررسی شود. برای بهره‌بردار، قرارداد سرویس، دسترسی قطعات و مانیتورینگ مصرف انرژی می‌تواند از اختلاف قیمت اولیه مهم‌تر باشد.</p></section>'''
 },
 'services/products/steam-trap.html': {
  'old':'../../assets/images/real/boilers-steam.jpeg',
  'new':'../../assets/images/products/generated/steam-trap-realistic.jpg',
  'alt':'تله بخار صنعتی ترمودینامیکی و فلوت برای تخلیه کندانس خطوط بخار',
  'mark':'steam-trap-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="steam-trap-deep-2026"><h2>راهنمای عمیق انتخاب Steam Trap برای کاهش اتلاف انرژی و Water Hammer</h2><p>تله بخار وظیفه دارد کندانس را تخلیه کند و در عین حال بخار زنده را نگه دارد. اگر Trap نشتی داشته باشد، انرژی مستقیماً تلف می‌شود؛ اگر کندانس را تخلیه نکند، Water Hammer، کاهش انتقال حرارت و خوردگی ایجاد می‌شود. بنابراین انتخاب Steam Trap باید با بار کندانس، فشار بخار، Back Pressure، نوع تجهیز و رفتار بار حرارتی انجام شود.</p><p>Thermodynamic Disc Trap برای بسیاری از خطوط بخار ساده و مقاوم است، اما در بارهای کندانس خیلی متغیر یا فشار برگشتی بالا همیشه بهترین گزینه نیست. Float & Thermostatic Trap برای تخلیه پیوسته کندانس و هواگیری بهتر در مبدل‌ها و کویل‌ها مناسب است. Inverted Bucket در برخی سرویس‌های صنعتی دوام خوبی دارد، ولی نصب و وجود آب‌بندی داخلی آن باید درست باشد.</p><p>برای تیم نگهداری، تست دوره‌ای تله بخار حیاتی است. Trap خراب می‌تواند باز بماند و بخار تلف کند یا بسته بماند و کندانس را نگه دارد. استفاده از Strainer، Check Valve، Bypass مناسب و نصب صحیح جهت جریان، عمر تجهیز را افزایش می‌دهد. در Steam Tracing، انتخاب Trap نامناسب می‌تواند باعث سرد شدن خط یا اتلاف انرژی دائمی شود.</p><p>در مقایسه برندهایی مثل Spirax Sarco، Armstrong، TLV یا Gestra باید ظرفیت تخلیه در فشار واقعی، مقاومت در برابر هواگیری، متریال Seat/Disc، روش تست و موجودی کیت تعمیراتی بررسی شود. در Shutdown، خرید سریع مهم است، اما انتخاب اشتباه Trap می‌تواند پس از راه‌اندازی هزینه انرژی و خرابی بیشتری ایجاد کند.</p></section>'''
 },
 'services/products/shell-tube-heat-exchanger.html': {
  'old':'../../assets/images/real/real-industrial-tank.jpg',
  'new':'../../assets/images/products/generated/shell-tube-heat-exchanger-realistic.jpg',
  'alt':'مبدل حرارتی Shell and Tube افقی با نازل‌ها و درپوش‌های پیچ‌دار مطابق TEMA',
  'mark':'heat-exchanger-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="heat-exchanger-deep-2026"><h2>راهنمای عمیق خرید مبدل Shell & Tube؛ از Thermal Design تا MDR</h2><p>مبدل Shell & Tube فقط یک ظرف فلزی نیست؛ عملکرد آن به Thermal Design، Fouling، افت فشار، متریال، ارتعاش Tube و قابلیت تمیزکاری وابسته است. اگر خواص سیال، Duty، دمای ورودی/خروجی و Fouling Factor دقیق نباشد، مبدل ممکن است در روز اول ظرفیت داشته باشد اما پس از مدتی با رسوب‌گیری یا افت فشار زیاد از محدوده عملکرد خارج شود.</p><p>انتخاب TEMA Type باید با تعمیرات و انبساط حرارتی هماهنگ باشد. Fixed Tubesheet اقتصادی‌تر است، اما تمیزکاری و انبساط را محدودتر می‌کند. U-Tube انبساط را بهتر تحمل می‌کند اما تمیزکاری مکانیکی داخل Tube محدود می‌شود. Floating Head برای سرویس‌های سخت‌تر و نیاز به تمیزکاری بهتر مناسب است، اما هزینه و پیچیدگی بیشتری دارد.</p><p>در طراحی مکانیکی، ASME VIII، ضخامت Shell، Tubesheet، Nozzle Loads، Gasket، Bolting، PWHT، NDT و Hydrotest باید کنترل شود. ارتعاش Tube در سرعت‌های بالا یا با Baffle نامناسب می‌تواند خرابی جدی ایجاد کند. برای سرویس خورنده، انتخاب متریال Tube و Shell و احتمال Cladding یا Lining باید از ابتدا مشخص شود.</p><p>در مقایسه سازندگان، فقط قیمت هر کیلوگرم یا سطح حرارتی کافی نیست. تجربه در TEMA/API 660، کیفیت جوش، WPS/PQR، برنامه NDT، توانایی تهیه MDR کامل، کنترل Dimensional و سابقه FAT/Hydrotest موفق مهم است. برای کارفرما، MDR کامل به اندازه خود مبدل ارزش دارد، چون بدون آن تحویل نهایی و بهره‌برداری رسمی با مشکل مواجه می‌شود.</p></section>'''
 },
 'services/products/pressure-vessel.html': {
  'old':'../../assets/images/real/real-industrial-tank.jpg',
  'new':'../../assets/images/products/generated/pressure-vessel-realistic.jpg',
  'alt':'مخزن تحت فشار عمودی با نازل، منهول و ساپورت مطابق ASME Section VIII',
  'mark':'pressure-vessel-deep-2026',
  'section': '''<section class="ptf-box" data-deep-upgrade="pressure-vessel-deep-2026"><h2>راهنمای عمیق خرید Pressure Vessel؛ طراحی، ساخت، تست و مدارک</h2><p>مخزن تحت فشار تجهیزی است که ریسک ایمنی آن بالاست و خرید آن باید با Data Sheet مکانیکی کامل انجام شود. Design Pressure، Design Temperature، حجم، نوع سیال، Corrosion Allowance، Joint Efficiency، نوع Head، نازل‌ها، ساپورت و کد طراحی باید روشن باشد. اگر فقط ابعاد کلی اعلام شود، سازنده نمی‌تواند طراحی قابل دفاع و مدارک معتبر ارائه کند.</p><p>متریال در Pressure Vessel باید با فشار، دما، خوردگی و الزامات جوشکاری هماهنگ شود. SA-516 Gr.70 برای بسیاری از Vesselهای کربن‌استیل رایج است، اما برای دمای پایین، سرویس ترش یا خوردگی خاص ممکن است متریال دیگری لازم شود. در سرویس‌های خورنده، Lining، Cladding یا افزایش Corrosion Allowance باید در مرحله طراحی بررسی شود، نه بعد از ساخت.</p><p>کیفیت ساخت به WPS/PQR، صلاحیت جوشکار، NDT، PWHT، Hydrotest و کنترل ابعادی وابسته است. برای نازل‌ها، Reinforcement، Orientation، Projection و کلاس فلنج باید دقیق کنترل شود. اگر Vessel در سایت محدودیت حمل یا نصب دارد، ابعاد حمل، وزن، Lifting Lug و ساپورت باید قبل از ساخت نهایی بررسی شود.</p><p>در مقایسه سازندگان، داشتن تجربه ASME Section VIII، توانایی تهیه MDR کامل، کنترل جوش و NDT، سابقه ساخت Vessel مشابه و انطباق با ITP پروژه مهم‌تر از قیمت خام است. MDR باید شامل Calculation، Drawing، MTC، WPS/PQR، Welder Qualification، NDT، Hydrotest و Release Note باشد. بدون این مدارک، پذیرش نهایی تجهیز در پروژه‌های صنعتی با ریسک جدی روبه‌رو می‌شود.</p></section>'''
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
