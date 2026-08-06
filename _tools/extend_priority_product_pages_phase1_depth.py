#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add final product-specific depth sections after the initial priority product rewrite."""
from pathlib import Path

SECTIONS = {
"services/products/cable-accessories.html": '''<section class="ptf-box" data-quality-depth-phase1="cable-accessories"><h2>جزئیات اجرایی که باید قبل از خرید روشن شوند</h2><p>برای متعلقات کابل، هماهنگی میان نقشه کابل‌کشی و لیست خرید بسیار مهم است. اگر تعداد ورودی‌های تابلو، اندازه gland plate، محل cable ladder و روش tagگذاری همزمان بررسی نشود، ممکن است کالای خریداری‌شده از نظر استاندارد درست باشد اما در سایت نصب‌پذیر نباشد. به طور نمونه، گلند زاویه‌دار یا adaptor بلند در تابلوهای کوچک می‌تواند با درب، ترمینال یا مسیر خمش کابل تداخل ایجاد کند. در مسیرهای outdoor نیز فاصله سینی از سطح زمین، احتمال ضربه لیفتراک، نیاز cover و زهکشی آب باید در همان مرحله RFQ مشخص شود.</p><ul><li>برای کابل‌های VFD، مسیر شیلد و EMC gland باید با دستور سازنده درایو هماهنگ شود.</li><li>برای کابل‌های instrument pair، جداسازی از کابل قدرت و bonding شیلد باید با فلسفه نویز پروژه کنترل شود.</li><li>برای کابل fire resistant، نگهدارنده و متعلقات مسیر باید با فلسفه بقای عملکرد در آتش سازگار باشد.</li><li>برای انبار سایت، بسته‌بندی هر سایز گلند و lug باید جداگانه و قابل شمارش باشد.</li></ul></section>''',
"services/products/industrial-strainer-filter.html": '''<section class="ptf-box" data-quality-depth-phase1="industrial-strainer-filter"><h2>نکات عملی بهره‌برداری و کاهش توقف خط</h2><p>در بهره‌برداری، بهترین استرینر تجهیزی است که اپراتور بتواند آن را بدون ریسک و بدون اتلاف زمان سرویس کند. وزن cover، جهت باز شدن، نوع دستگیره basket، محل تخلیه سیال و امکان نصب blind یا drip tray روی زمان تعمیر اثر می‌گذارد. اگر سبد سنگین یا پر از ذرات تیز باشد، باید روش بلندکردن و ایمنی نفرات پیش‌بینی شود. در خطوطی که سیال داغ، قابل اشتعال یا سمی است، بازکردن cover بدون vent و drain ایمن می‌تواند حادثه‌ساز شود.</p><ul><li>برای راه‌اندازی اولیه، برنامه خروج temporary strainer باید در punch list ثبت شود.</li><li>برای خطوط پمپ، افت فشار dirty condition باید قبل از رسیدن به کاویتاسیون هشدار بدهد.</li><li>برای سیالات حاوی ذرات ساینده، ضخامت basket و محافظت موضعی در مسیر برخورد اهمیت دارد.</li><li>برای سرویس غذایی یا دارویی، قابلیت شست‌وشو و جنس سطح داخلی معیار متفاوتی از سرویس نفت و گاز دارد.</li></ul></section>''',
"services/products/earthing-lightning-protection.html": '''<section class="ptf-box" data-quality-depth-phase1="earthing-lightning-protection"><h2>هماهنگی ارتینگ با ابزار دقیق، مخابرات و سازه</h2><p>در سایت‌های صنعتی، شبکه ارت مشترک باید به گونه‌ای طراحی شود که هم ایمنی قدرت و هم عملکرد ابزار دقیق را پشتیبانی کند. جداسازی غیرمهندسی earthها ممکن است اختلاف پتانسیل ایجاد کند و اتصال بی‌برنامه همه نقاط نیز می‌تواند نویز را به loopهای حساس منتقل کند. برای اتاق کنترل، رک‌های PLC، سیستم DCS، باس‌های ارتباطی، CCTV و تجهیزات مخابرات، مسیر bonding، شیلد کابل، surge protector و reference earth باید به صورت هماهنگ در نقشه‌ها دیده شود.</p><ul><li>برای pipe rack فلزی، پیوستگی سازه و اتصال‌های دوره‌ای به grid باید قابل بازرسی باشد.</li><li>برای مخازن، bonding نازل‌ها، stairway، handrail و خطوط متصل باید با فلسفه صاعقه کنترل شود.</li><li>برای محوطه دارای خاک خورنده، انتخاب هادی و connector باید با خوردگی بلندمدت سنجیده شود.</li><li>برای توسعه‌های آینده سایت، spare earth bar و مسیرهای رزرو از دوباره‌کاری جلوگیری می‌کند.</li></ul></section>''',
"services/products/stud-bolts-nuts.html": '''<section class="ptf-box" data-quality-depth-phase1="stud-bolts-nuts"><h2>هماهنگی استادبولت با گسکت و کلاس پایپینگ</h2><p>انتخاب استادبولت باید همزمان با نوع گسکت و کلاس پایپینگ انجام شود. گسکت RTJ، اسپیرال وند، گرافیت تقویت‌شده یا PTFE نیروی فشاری متفاوتی نیاز دارد و اگر bolt load کافی نباشد، اتصال در تست هیدرواستاتیک یا در سیکل حرارتی نشتی می‌دهد. در مقابل، اعمال torque بیش از حد می‌تواند گسکت را خرد کند، فلنج را دچار rotation کند یا رزوه را به مرز تسلیم نزدیک کند. به همین دلیل اطلاعات bolting باید در کنار gasket datasheet و flange rating بررسی شود، نه به صورت یک سفارش عمومی.</p><ul><li>برای فلنج‌های کلاس بالا، استفاده از hydraulic tensioner ممکن است طول stud متفاوتی لازم داشته باشد.</li><li>برای محیط دریایی، نگهداری بسته‌های بازشده و محافظت رزوه از خوردگی اهمیت عملی دارد.</li><li>برای استنلس، انتخاب روانکار ضد galling می‌تواند از قفل شدن مهره روی رزوه جلوگیری کند.</li><li>برای shutdown، تفکیک کیت‌های bolting بر اساس line number سرعت نصب و کنترل QC را بالا می‌برد.</li></ul></section>'''
}

for rel, section in SECTIONS.items():
    p = Path(rel)
    html = p.read_text(encoding="utf-8")
    marker = section.split('data-quality-depth-phase1="',1)[1].split('"',1)[0]
    if f'data-quality-depth-phase1="{marker}"' in html:
        print(f"skip existing {rel}")
        continue
    needle = '<h2>پرسش‌های متداول</h2>'
    if needle not in html:
        raise SystemExit(f"FAQ heading not found in {rel}")
    html = html.replace(needle, section + needle, 1)
    p.write_text(html, encoding="utf-8")
    print(f"extended {rel}")
