#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام B4 سئو — لینک زمینه‌ای KC → مقایسه‌ها (2026-08-20، idempotent).
حفره: از ۴۵۰ صفحهٔ مرکز دانش فقط ۷ صفحه به /comparisons/ لینک داشتند.
قاعده: هر صفحهٔ KC حداکثر «یک» لینک مقایسهٔ مرتبط می‌گیرد (اولین قاعدهٔ منطبق بر slug)؛
جمله برای هر مقایسه اختصاصی است، نه بلوک قالبی واحد."""
import re, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TODAY = '2026-08-20'

RULES = [
 ('a106-vs-a333-pipe.html', ['a106', 'a333', 'a53'],
  'اگر تصمیم بین گریدهای دما پایین و سرویس عمومی هنوز باز است، <a href="../comparisons/a106-vs-a333-pipe.html">مقایسهٔ لوله A106 در برابر A333</a> با جدول تست ضربه و محدودهٔ دما این انتخاب را می‌بندد.'),
 ('seamless-vs-erw-pipe.html', ['erw', 'seamless', 'saw-pipe', 'welded-pipe'],
  'برای انتخاب روش ساخت لوله در سرویس شما، <a href="../comparisons/seamless-vs-erw-pipe.html">مقایسهٔ مانیسمان در برابر درزدار ERW</a> محدودیت‌های فشار، خوردگی و بازرسی هر دو را رو‌در‌رو گذاشته است.'),
 ('ball-vs-butterfly-valve.html', ['ball-valve', 'butterfly'],
  'اگر بین شیر توپی و پروانه‌ای مردد هستید، <a href="../comparisons/ball-vs-butterfly-valve.html">مقایسهٔ Ball در برابر Butterfly</a> از نظر سایز، وزن، افت فشار و هزینه جمع‌بندی روشنی دارد.'),
 ('gate-vs-globe-valve.html', ['gate-valve', 'globe-valve'],
  'برای مرز «قطع جریان» و «تنظیم جریان»، <a href="../comparisons/gate-vs-globe-valve.html">مقایسهٔ شیر دروازه‌ای در برابر سوزنی</a> با جدول کاربرد پاسخ سریع می‌دهد.'),
 ('magmeter-vs-coriolis-flowmeter.html', ['magnetic-flowmeter', 'coriolis', 'magmeter'],
  'در انتخاب تکنولوژی اندازه‌گیری جریان، <a href="../comparisons/magmeter-vs-coriolis-flowmeter.html">مقایسهٔ مگ‌میتر در برابر کوریولیس</a> دقت، هزینه و محدودیت سیال هر دو را کنار هم می‌گذارد.'),
 ('nace-mr0175-vs-mr0103.html', ['nace', 'sour', 'h2s', 'mr0175', 'mr0103'],
  'برای الزامات سرویس ترش، <a href="../comparisons/nace-mr0175-vs-mr0103.html">مقایسهٔ NACE MR0175 در برابر MR0103</a> مرز دقیق کاربرد هر استاندارد را روشن می‌کند — انتخاب اشتباه مستقیم به Reject بازرسی می‌رسد.'),
 ('rosemount-vs-yokogawa-transmitter.html', ['rosemount', 'yokogawa', 'pressure-transmitter'],
  'در مرحلهٔ انتخاب برند ترانسمیتر، <a href="../comparisons/rosemount-vs-yokogawa-transmitter.html">مقایسهٔ روزمونت در برابر یوکوگاوا</a> دقت، پایداری بلندمدت و ملاحظات تامین را رو‌در‌رو بررسی کرده است.'),
 ('vcb-vs-acb-switchgear.html', ['vcb', 'acb', 'switchgear', 'circuit-breaker'],
  'برای انتخاب بریکر تابلو، <a href="../comparisons/vcb-vs-acb-switchgear.html">مقایسهٔ VCB در برابر ACB</a> مکانیزم قطع، عمر سرویس و محدودهٔ ولتاژ هر دو را مشخص می‌کند.'),
 ('vfd-vs-soft-starter.html', ['vfd', 'soft-starter', 'variable-frequency', 'motor-starting'],
  'اگر هدف فقط راه‌اندازی نرم است یا کنترل دور هم می‌خواهید، <a href="../comparisons/vfd-vs-soft-starter.html">مقایسهٔ درایو VFD در برابر سافت‌استارتر</a> این تصمیم اقتصادی را شفاف می‌کند.'),
 ('wn-vs-so-flange.html', ['weld-neck', 'slip-on', 'flange'],
  'پرتکرارترین ابهام MTO فلنج، انتخاب گلودار یا اسلیپون است — <a href="../comparisons/wn-vs-so-flange.html">مقایسهٔ فلنج WN در برابر SO</a> با جدول فشار-دما تصمیم را ساده می‌کند.'),
]

WRAP = ('<p data-b4-link="yes" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;'
        'padding:12px 16px;font-size:13.5px;line-height:1.9;color:#0c4a6e;margin:18px 0">🔀 %s</p>')

added = 0
skipped = 0
changed_urls = set()
for p in sorted(glob.glob('knowledge-center/*.html')):
    slug = os.path.basename(p).lower()
    if slug == 'index.html': continue
    s = open(p, encoding='utf-8', errors='ignore').read()
    if 'data-b4-link="yes"' in s: skipped += 1; continue
    hit = None
    for cmp_page, keys, sent in RULES:
        if any(k in slug for k in keys):
            hit = (cmp_page, sent); break
    if not hit: continue
    cmp_page, sent = hit
    if 'comparisons/' + cmp_page in s: continue  # از قبل لینک دارد
    block = WRAP % sent
    for anchor in ['</article>', '</section>\n<footer', '<footer']:
        i = s.rfind(anchor) if anchor != '</section>\n<footer' else s.rfind(anchor)
        if anchor == '</section>\n<footer' and i > -1: i = i + len('</section>\n')
        if i > -1:
            if anchor == '<footer' or anchor == '</section>\n<footer':
                s = s[:i] + block + '\n' + s[i:]
            else:
                s = s[:i] + block + '\n' + s[i:]
            break
    else:
        continue
    open(p, 'w', encoding='utf-8').write(s)
    added += 1
    changed_urls.add('https://pishtaj.ir/' + p)

# lastmod
if changed_urls:
    for sm in glob.glob('sitemap-*.xml'):
        t = open(sm, encoding='utf-8').read(); o = t
        t = re.sub(r'(<loc>(' + '|'.join(re.escape(u) for u in sorted(changed_urls)) + r')</loc><lastmod>)([^<]+)(</lastmod>)',
                   lambda m: m.group(1) + TODAY + m.group(4), t)
        if t != o: open(sm, 'w', encoding='utf-8').write(t)

print('لینک مقایسه اضافه شد به', added, 'صفحهٔ KC | قبلاً داشت/رد شد:', skipped)
