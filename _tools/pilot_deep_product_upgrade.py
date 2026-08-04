#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pilot deep upgrade for three priority product pages with generated realistic single-product images and richer unique sections."""
from pathlib import Path
import re

UPGRADES = {
    'services/products/ball-valve.html': {
        'old_img': '../../assets/images/real/valve-inspection-qc.jpg',
        'new_img': '../../assets/images/products/generated/ball-valve-api6d-trunnion-realistic.jpg',
        'abs_img': 'https://pishtaj.ir/assets/images/products/generated/ball-valve-api6d-trunnion-realistic.jpg',
        'alt': 'بال ولو ترانیون فلنجی API 6D با گیربکس برای خطوط نفت و گاز',
        'section': '''<section class="ptf-box" data-deep-upgrade="ball-valve-api6d">
<h2>راهنمای انتخاب عمیق بال ولو بر اساس سرویس واقعی</h2>
<p>در بال ولوهای پروژه‌ای، اولین تصمیم مهم این نیست که برند چه باشد؛ ابتدا باید مشخص شود ولو برای <strong>ایزولاسیون اضطراری</strong>، قطع و وصل معمولی، خط Pigging، سرویس گاز خشک، مایع هیدروکربنی، آب صنعتی یا سیال دارای ذرات استفاده می‌شود. برای خط Pigging، Full Bore بودن معمولاً الزام عملیاتی است؛ اما در خط Utility که افت فشار بحرانی نیست، Reduced Bore می‌تواند اقتصادی‌تر باشد. در کلاس‌های پایین و سایزهای کوچک، Floating Ball اغلب پاسخ‌گوست؛ ولی با افزایش سایز و فشار، Trunnion Mounted به‌دلیل کاهش گشتاور و کنترل بهتر بار Seat انتخاب قابل اتکاتری می‌شود.</p>
<p>در سرویس‌های هیدروکربنی، Fire Safe بودن فقط یک عبارت تبلیغاتی نیست. باید مشخص شود گواهی Fire Safe مربوط به همان طراحی یا همان سری محصول است و با استاندارد مورد قبول پروژه مثل API 607 یا ISO 10497 هم‌خوانی دارد. همچنین Anti-static و Blow-out Proof Stem برای کاهش ریسک الکتریسیته ساکن و ایمنی Stem اهمیت دارند. اگر این موارد در RFQ ذکر نشوند، ممکن است پیشنهاد ارزان‌تر فاقد همین الزامات باشد و در مرحله TBE یا بازرسی رد شود.</p>
<p>برای Seat، انتخاب PTFE، RPTFE، PEEK یا Metal Seat باید با دما، فشار تفاضلی، تعداد سیکل، ذرات جامد و نشتی مجاز هماهنگ شود. PTFE در بسیاری از سرویس‌های تمیز و دمای متوسط مناسب است؛ اما برای دمای بالاتر، فشار بیشتر یا ذرات ساینده ممکن است PEEK یا Metal Seat منطقی‌تر باشد. در سرویس گاز، کلاس نشتی و سازگاری Seat با فشار پایین نیز باید بررسی شود، چون بعضی Seatها در فشار کم رفتار آب‌بندی متفاوتی دارند.</p>
<p>در ارزیابی برند، برای Ball Valveهایی مثل KITZ، Neway، OMB، Velan، Crane یا Bonney Forge نباید فقط نام برند دیده شود. مدل دقیق، کشور ساخت، طراحی بدنه، نوع Seat، استاندارد تست، Lead Time، امکان تأمین Gearbox یا Actuator و مدارک قابل ارائه تعیین می‌کند که پیشنهاد واقعاً با پروژه منطبق است یا نه. برای خریدهای حساس، درخواست Drawing، Torque Data و Test Report قبل از صدور PO ریسک زیادی را کم می‌کند.</p>
</section>'''
    },
    'services/products/pressure-transmitter.html': {
        'old_img': '../../assets/images/real/warehouse-instrumentation-engineer.jpg',
        'new_img': '../../assets/images/products/generated/pressure-transmitter-industrial-realistic.jpg',
        'abs_img': 'https://pishtaj.ir/assets/images/products/generated/pressure-transmitter-industrial-realistic.jpg',
        'alt': 'ترانسمیتر فشار صنعتی هوشمند با منیفولد و نمایشگر برای ابزار دقیق فرایندی',
        'section': '''<section class="ptf-box" data-deep-upgrade="pressure-transmitter">
<h2>راهنمای انتخاب ترانسمیتر فشار برای بهره‌بردار و تیم ابزار دقیق</h2>
<p>برای کاربر نهایی، ترانسمیتر فشار فقط یک سیگنال 4-20mA نیست؛ این تجهیز معمولاً مبنای Interlock، Alarm، Trend، کنترل فرایند یا گزارش بهره‌برداری است. بنابراین انتخاب Range باید بر اساس Span واقعی انجام شود، نه صرفاً حداکثر فشار طراحی خط. اگر Range بیش از حد بزرگ انتخاب شود، خطای عملی در محدوده کاری بالا می‌رود؛ اگر بیش از حد کوچک باشد، Overpressure و خرابی سنسور محتمل می‌شود. بهتر است فشار نرمال، حداقل، حداکثر، فشار طراحی و فشارهای گذرای Start-up جداگانه در دیتاشیت نوشته شوند.</p>
<p>در انتخاب Wetted Parts، نام کلی Stainless Steel کافی نیست. دیافراگم SS316L برای بسیاری از سرویس‌ها مناسب است، اما در حضور کلراید بالا، اسیدها، H2S یا سیالات خورنده ممکن است Hastelloy، Monel یا Tantalum نیاز شود. در سیالات داغ، ویسکوز، کریستال‌شونده یا دارای ذرات، نصب مستقیم ممکن است باعث Drift یا گرفتگی شود و Remote Seal یا Impulse Line مناسب باید بررسی گردد. Fill Fluid در Remote Seal نیز باید با دما و خلأ احتمالی سازگار باشد.</p>
<p>برای تیم نگهداری، Manifold و دسترسی کالیبراسیون به اندازه خود ترانسمیتر مهم است. در Pressure Transmitter معمولی، Two-Valve Manifold یا Block & Bleed می‌تواند ایزولاسیون و تخلیه را آسان کند. در DP Transmitter، Three-Valve یا Five-Valve Manifold برای Equalize و کالیبراسیون ایمن ضروری است. اگر این اقلام در محدوده تأمین نیاید، نصب سایت ناچار به خرید جداگانه و گاهی ناسازگار می‌شود.</p>
<p>در مقایسه برندهایی مثل Rosemount/Emerson، Yokogawa، Endress+Hauser، WIKA، Honeywell یا VEGA، باید Model Code کامل، Accuracy، Stability، Turndown، Ex Certificate، پروتکل ارتباطی و مدارک کالیبراسیون مقایسه شود. دو ترانسمیتر با ظاهر مشابه ممکن است از نظر دقت، پایداری بلندمدت، گواهی Hazardous Area و قابلیت Diagnostics تفاوت جدی داشته باشند.</p>
</section>'''
    },
    'services/products/api-5l-pipe.html': {
        'old_img': '../../assets/images/real/pipe-yard-team.jpg',
        'new_img': '../../assets/images/products/generated/api-5l-line-pipe-realistic.jpg',
        'abs_img': 'https://pishtaj.ir/assets/images/products/generated/api-5l-line-pipe-realistic.jpg',
        'alt': 'لوله API 5L کربن استیل با انتهای Beveled برای خطوط انتقال نفت و گاز',
        'section': '''<section class="ptf-box" data-deep-upgrade="api-5l-pipe">
<h2>راهنمای خرید API 5L برای کاربر خط لوله، بازرسی و انبار پروژه</h2>
<p>در لوله API 5L، تفاوت PSL1 و PSL2 فقط یک عبارت روی کاغذ نیست. PSL2 معمولاً کنترل سخت‌گیرانه‌تری روی ترکیب شیمیایی، خواص مکانیکی، Toughness، تست‌ها و ردیابی دارد و برای خطوط انتقال حساس‌تر ترجیح داده می‌شود. اما انتخاب PSL2 بدون نیاز واقعی می‌تواند هزینه را بالا ببرد. بنابراین باید Design Code، فشار، دمای محیط، ریسک شکست ترد، Sour Service و الزام کارفرما هم‌زمان بررسی شود.</p>
<p>روش ساخت لوله نیز در عملکرد و بازرسی اثر دارد. Seamless برای برخی سایزها و سرویس‌ها انتخاب رایجی است، اما در قطرهای بزرگ، ERW/HFW، LSAW یا SSAW گزینه‌های عملی‌تر و اقتصادی‌تر هستند. انتخاب روش ساخت باید با قطر، ضخامت، فشار، نوع سیال، استاندارد پروژه و الزامات NDT هماهنگ باشد. در خطوط انتقال، کنترل Weld Seam و NDT برای لوله‌های درزدار اهمیت ویژه دارد.</p>
<p>برای بازرسی، MTC باید با Marking روی خود لوله تطبیق داده شود. Heat Number، Grade، PSL، OD، WT، طول، نوع انتها، تست Hydro، نتایج مکانیکی و شیمیایی باید روی مدارک قابل پیگیری باشد. اگر لوله Coating مثل 3LPE یا FBE دارد، گزارش آماده‌سازی سطح، ضخامت پوشش، Holiday Test و Adhesion نیز باید در مدارک دیده شود. فقدان این مدارک در زمان تحویل، پذیرش کارفرما یا ترخیص را با مشکل روبه‌رو می‌کند.</p>
<p>در مقایسه سازندگانی مثل Tenaris، Vallourec، Sumitomo، Nippon Steel، JFE یا تولیدکنندگان تأییدشده دیگر، باید به Vendor List، کشور ساخت، قابلیت ارائه MTC معتبر، امکان تأمین طول و ضخامت دقیق، Lead Time و سابقه پروژه مشابه توجه شود. برای پروژه‌های خط لوله، بسته‌بندی و محافظت Bevel نیز مهم است؛ آسیب انتهای لوله در حمل می‌تواند هزینه Fit-up و جوشکاری را افزایش دهد.</p>
</section>'''
    }
}

for fp, data in UPGRADES.items():
    p = Path(fp)
    s = p.read_text(encoding='utf-8', errors='ignore')
    s = s.replace(data['old_img'], data['new_img'])
    # Replace absolute og/schema image if present.
    old_abs = 'https://pishtaj.ir/' + data['old_img'].replace('../../', '')
    s = s.replace(old_abs, data['abs_img'])
    # Set the first hero img alt more specific (only if old title-like alt remains near the image).
    s = re.sub(r'(<div class="ptf-hero-card"><img src="' + re.escape(data['new_img']) + r'" alt=")[^"]*(" width=")', r'\1' + data['alt'] + r'\2', s, count=1)
    if data['section'] not in s and f'data-deep-upgrade="{fp}"' not in s:
        idx = s.find('<div class="ptf-cta">')
        if idx != -1:
            s = s[:idx] + data['section'] + s[idx:]
    p.write_text(s, encoding='utf-8')

print('upgraded', len(UPGRADES))
