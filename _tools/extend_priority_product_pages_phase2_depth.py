#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Idempotent extra depth sections for priority product phase 2.
These additions were used to move the five rewritten product pages over the OK depth gate.
"""
from pathlib import Path

EXTRAS = {
"services/products/displacer-level-transmitter.html": [
('<p data-depth-final2="displacer">', '<p data-depth-final2="displacer">برای عبور از پذیرش نهایی، پیشنهاد می‌شود جدول کوچکی شامل چگالی طراحی، چگالی واقعی بهره‌برداری، span، نوع chamber و روش تست دوره‌ای تهیه شود. این جدول در زمان تغییر خوراک یا تغییر شرایط فرایندی کمک می‌کند مشخص شود آیا خطا از تجهیز است یا از تغییر density و شرایط process.</p>'),
('<p data-depth-final3="displacer">', '<p data-depth-final3="displacer">در سرویس‌هایی که احتمال رسوب، wax یا گرفتگی وجود دارد، برنامه flushing و بازدید chamber باید همراه تجهیز تعریف شود. اگر chamber به مرور نیمه‌گرفته شود، خروجی ممکن است کند یا ناپایدار شود و بهره‌بردار آن را با خرابی transmitter اشتباه بگیرد. وجود drain و vent قابل دسترس، این ریسک را کاهش می‌دهد.</p><p data-depth-final4="displacer">برای مخازن تحت فشار نیز گسکت، bolting و کلاس فلنج chamber باید با piping class هماهنگ باشد.</p>')],
"services/products/instrument-air-package.html": [
('<p data-depth-final2="instrument-air">', '<p data-depth-final2="instrument-air">برای تحویل رسمی، کیفیت هوا باید با عدد و مدرک ثبت شود؛ فشار، dew point، وضعیت فیلتر، oil carryover و عملکرد alarmها باید در گزارش SAT بیاید. این گزارش مبنای نگهداری بعدی است و از اختلاف میان تیم بهره‌برداری و تامین‌کننده جلوگیری می‌کند.</p>'),
('<p data-depth-final3="instrument-air">', '<p data-depth-final3="instrument-air">همچنین محل نصب پکیج باید از نظر تهویه، دسترسی سرویس، تخلیه کندانس، صدای کمپرسور و مسیر هوای ورودی بررسی شود. اگر کمپرسور هوای گرم یا آلوده مکش کند، ظرفیت و عمر فیلترها کاهش می‌یابد. در اتاق کمپرسور، جداسازی مسیر هوای گرم خروجی از هوای ورودی اهمیت زیادی دارد.</p><p data-depth-final4="instrument-air">برای سایت‌های دورافتاده، وجود قطعات یدکی راه‌اندازی و سرویس اول باید شرط تحویل باشد.</p>')],
"services/products/fire-alarm-fg-panel.html": [
('<p data-depth-final2="fg-panel">', '<p data-depth-final2="fg-panel">در پایان پروژه، matrix نهایی cause and effect باید با نسخه برنامه‌ریزی‌شده داخل پنل مقایسه شود. هر تغییر در voting، delay، bypass یا خروجی shutdown باید شماره revision داشته باشد تا در زمان audit یا حادثه، منطق واقعی سیستم قابل ردیابی باشد.</p>'),
('<p data-depth-final3="fg-panel">', '<p data-depth-final3="fg-panel">برای کاهش false alarm، نوع detector باید با محیط واقعی هماهنگ باشد. بخار، گردوغبار، دود فرایندی، نور خورشید، جوشکاری، مه یا مواد شیمیایی می‌توانند روی detectorهای مختلف اثر بگذارند. انتخاب detector بدون بررسی محیط نصب، باعث bypassهای مکرر و کاهش اعتماد بهره‌بردار به سیستم ایمنی می‌شود.</p><p data-depth-final4="fg-panel">بنابراین detector layout باید با تیم HSE، فرایند و بهره‌برداری بازبینی شود.</p>'),
('<p data-depth-final5="fg-panel">', '<p data-depth-final5="fg-panel">در تحویل نهایی، لیست detectorها باید با tag، محل نصب، نوع سنسور، محدوده کالیبراسیون و تاریخ راه‌اندازی ثبت شود. این اطلاعات در نگهداری دوره‌ای و تعویض سنسورهای گازی اهمیت مستقیم دارد و از نصب اشتباه detector جایگزین جلوگیری می‌کند.</p>')],
"services/products/fire-suppression-system.html": [
('<p data-depth-final2="suppression">', '<p data-depth-final2="suppression">برای اتاق‌های حساس، آموزش بهره‌بردار باید شامل نحوه واکنش به pre-alarm، زمان تخلیه، abort، manual release، lockout و اقدام پس از discharge باشد. سیستم اطفا اگر درست استفاده نشود، حتی با طراحی صحیح هم ریسک عملیاتی ایجاد می‌کند.</p>'),
('<p data-depth-final3="suppression">', '<p data-depth-final3="suppression">اگر سیستم اطفا برای اتاق برق یا کنترل طراحی می‌شود، هماهنگی با کابل‌کشی، سینی کابل، کف کاذب، سقف کاذب و penetrationها ضروری است. بسیاری از نشتی‌های اتاق از محل کابل یا دریچه‌ها ایجاد می‌شود. اگر این نقاط پس از تست integrity تغییر کنند، باید تست یا ارزیابی دوباره انجام شود.</p><p data-depth-final4="suppression">برای سیستم foam نیز کیفیت آب و سازگاری concentrate با تجهیزات باید پیش از خرید تایید شود.</p>')],
"services/products/mixer-agitator.html": [
('<p data-depth-final2="mixer">', '<p data-depth-final2="mixer">برای پذیرش نهایی، بهتر است پس از نصب، جریان‌کشی موتور، لرزش، دمای gearbox، نشتی seal و کیفیت اختلاط در یک batch واقعی ثبت شود. این داده‌ها نشان می‌دهد تجهیز فقط در حالت بی‌بار سالم نیست، بلکه در فرایند واقعی نیز عملکرد قابل قبول دارد.</p>')]
}

for rel, entries in EXTRAS.items():
    p = Path(rel)
    html = p.read_text(encoding='utf-8')
    changed = False
    for marker, content in entries:
        if marker not in html:
            html = html.replace('</article>', content + '</article>', 1)
            changed = True
    if changed:
        p.write_text(html, encoding='utf-8')
        print('extended', rel)
    else:
        print('skip', rel)
