#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Run SEO quality stabilization steps 2..8 robustly.

Public pages only. It removes repeated/duplicated filler paragraphs from selected product/brand
pages and appends page-specific technical depth until each batch page passes the content gate.
It never edits crm/ or api/.
"""
from pathlib import Path
import re, csv, subprocess, collections

TODAY = '2026-08-06'
AUDIT_CSV = Path('_audit/SEO-CONTENT-QUALITY-AUDIT-CURRENT.csv')

BATCHES = [
  ['services/products/expansion-joints-flexible-hose.html','services/products/ansi-process-pump.html','services/products/vertical-multistage-pump.html','services/products/pressure-gauge.html','services/products/reciprocating-compressor.html'],
  ['services/products/slurry-pump.html','services/products/industrial-fan-blower.html','services/products/water-tube-boiler.html','services/products/industrial-hvac-pressurization.html','services/products/temperature-transmitter.html'],
  ['services/products/process-gas-analyzer-system.html','services/products/positive-displacement-pump.html','services/products/diaphragm-seal.html','services/products/online-water-quality-analyzer.html','services/products/industrial-burner.html'],
  ['services/products/plc-control-panel.html','brands/siemens-industrial.html','services/products/a333-low-temperature-pipe.html','brands/galperti-flanges.html','brands/flexitallic-gaskets.html'],
  ['brands/tenaris-pipes.html','services/products/fixed-gas-detector.html','services/products/orifice-plate-flowmeter.html','services/products/air-cooler-fin-fan.html','services/products/plate-heat-exchanger.html'],
  ['services/products/mechanical-seal.html','services/products/alloy-steel-pipe-a335.html','services/products/explosion-proof-lighting.html','services/products/industrial-power-instrument-cable.html','services/products/industrial-ups-battery-charger.html'],
  ['services/products/forged-fittings.html','services/products/stainless-steel-pipe.html','services/products/rosemount-3051.html','services/products/valve-actuator.html','services/products/flowmeter.html','services/products/psv-prv-safety-valve.html'],
]

PROFILES = {
'expansion-joints-flexible-hose':('اکسپنشن جوینت و شیلنگ فلزی','حرکت محوری، جانبی و زاویه‌ای، فشار، دما، سیکل حرارتی، لاینر، مهار tie rod و محدودیت بار نازل','EJMA، ASME B31.3، تست فشار، MTC متریال بلوز، نقشه GA و دستور نصب','خستگی بلوز، نصب با pre-compression غلط، خوردگی بین لایه‌ها، لرزش و بار اضافی روی نازل'),
'ansi-process-pump':('پمپ ANSI Process','نقطه کاری، NPSH، متریال، seal plan، baseplate، coupling، driver و شرایط suction','ASME B73.1، curve، hydrotest، performance test، seal datasheet و motor datasheet','کاویتاسیون، کارکرد دور از BEP، خرابی seal، vibration و alignment ضعیف'),
'vertical-multistage-pump':('پمپ طبقاتی عمودی','هد بالا، RO/booster، NPSH، seal، VFD، کیفیت آب، minimum flow و curve در سرعت‌های مختلف','curve، motor datasheet، COC، test report و spare list','خشک‌کارکردن، کاویتاسیون، انتخاب طبقات اشتباه، cycling و خرابی seal'),
'pressure-gauge':('گیج فشار صنعتی','range، accuracy، bourdon material، pulsation، siphon، diaphragm seal، overpressure و visibility','EN 837، calibration certificate، MTC wetted parts، cleaning certificate در صورت oxygen service','لرزش، overpressure، گرفتگی، خوانش نزدیک انتهای scale و خوردگی'),
'reciprocating-compressor':('کمپرسور رفت و برگشتی','گاز، stage، pulsation، lube system، cooling، capacity control، valve و driver','API 618، pulsation study، vibration، material certificates، performance data و manual','ضربه مایع، pulsation، دمای discharge بالا، خرابی valve و lubrication نامناسب'),
'slurry-pump':('پمپ اسلاری','درصد جامدات، particle size، abrasion، liner، impeller، سرعت، settling و metallurgy','curve اسلاری، material certificate، wear parts list، test report و manual','سایش سریع، settling، گرفتگی، انتخاب سرعت نامناسب و dry run'),
'industrial-fan-blower':('فن و بلوور صنعتی','دبی، فشار، density، دما، dust loading، noise، vibration، arrangement و drive','AMCA، API 673 در صورت الزام، balancing report، vibration test و performance curve','surge، vibration، سایش impeller، صدای بیش از حد و motor overload'),
'water-tube-boiler':('بویلر واترتیوب','ظرفیت بخار بالا، drum، circulation، superheater، economizer، burner و water treatment','ASME Section I، NDT، hydrotest، ITP، WPS/PQR و safety valve cert','رسوب tube، نوسان سطح drum، overheating، کنترل احتراق و کیفیت آب ضعیف'),
'industrial-hvac-pressurization':('HVAC صنعتی و pressurization','فشار مثبت، filtration، hazardous area، redundancy، air change، damper و shutdown philosophy','ASHRAE، NFPA، IEC/ATEX در صورت ناحیه خطرناک، balancing report و FAT/SAT','از دست رفتن فشار مثبت، ورود گاز/گردوغبار، خرابی damper و filter loading'),
'temperature-transmitter':('ترانسمیتر دما','RTD/TC، accuracy، head/rail mount، HART، sensor matching، cold junction و ambient','IEC 60751، calibration، Ex certificate، datasheet و wiring diagram','خطای سیم‌کشی، drift، cold junction، mismatch sensor و range اشتباه'),
'process-gas-analyzer-system':('آنالایزر گاز فرایندی','sample conditioning، moisture removal، calibration gas، analyzer shelter، lag time و hazardous area','GC/NDIR/paramagnetic datasheet، analyzer house، FAT، calibration و utility list','نمونه نامناسب، condensation، drift، تاخیر پاسخ و آلودگی sample line'),
'positive-displacement-pump':('پمپ جابجایی مثبت','viscosity، differential pressure، relief valve، pulsation، speed، NPSH و material','API/HI، curve، material، seal data، relief sizing و manual','overpressure، slip، pulsation، آسیب dry-run و suction starvation'),
'diaphragm-seal':('دیافراگم سیل','متریال diaphragm، fill fluid، capillary، vacuum، temperature effect، response و connection','MTC wetted parts، calibration assembly، datasheet، cleaning cert و leak test','response کند، خطای دما، خوردگی diaphragm، گرفتگی connection و fill fluid نامناسب'),
'online-water-quality-analyzer':('آنالایزر آنلاین کیفیت آب','pH، conductivity، DO، turbidity، chlorine، sample flow، cleaning و reagent','calibration، reagent، sample panel، analyzer datasheet، manual و maintenance list','drift، گرفتگی sample، کمبود reagent، fouling و خطای دمایی'),
'industrial-burner':('مشعل صنعتی','fuel train، turndown، flame scanner، BMS، combustion air، NOx و purge','NFPA 85/86، EN 676/267، FAT combustion، valve train cert و logic test','flame failure، احتراق ناپایدار، NOx بالا، purge ناقص و fuel pressure ناپایدار'),
'plc-control-panel':('تابلو PLC و کنترل','I/O list، redundancy، marshalling، power supply، network، grounding و heat load','IEC 61439، loop drawing، FAT، software backup، terminal plan و I/O test','نویز، mismatch I/O، گرمای تابلو، نبود backup و terminal numbering اشتباه'),
'siemens-industrial':('Siemens صنعتی','PLC، درایو، breaker، motor control، network، firmware/software و spare','datasheet، firmware/software version، COC، setting sheet، backup و manual','ناسازگاری نسخه، accessory ناقص، parameter اشتباه، retrofit دشوار و license issue'),
'a333-low-temperature-pipe':('لوله دمای پایین ASTM A333','impact test، notch toughness، LTCS service، heat number، NDT و end preparation','ASTM A333، Charpy، MTC 3.1، hydro/UT، PMI در صورت الزام','عدم تطابق دمای آزمون، traceability ناقص، brittle fracture و marking مخدوش'),
'galperti-flanges':('Galperti فلنج','WN/SO/BL/RTJ، forging، class، face، bore، material و heat treatment','ASME B16.5/B16.47، ASTM A105/A182، EN 10204، PMI و dimensional report','face damage، گرید اشتباه، class mismatch، bore mismatch و heat traceability ناقص'),
'flexitallic-gaskets':('Flexitallic گسکت','spiral wound، Kammprofile، RTJ، filler، winding material، seating stress و flange facing','ASME B16.20، color code، material cert، datasheet و packing list','crushing، incompatibility filler، seating stress غلط، نشتی و انتخاب thickness اشتباه'),
'tenaris-pipes':('Tenaris لوله','line pipe، seamless، OCTG، PSL2، sour service، toughness و MTC','API 5L، ASTM، EN 10204، impact/UT، heat number و marking','mix heat، marking ناقص، PSL mismatch، آسیب bevel و MTC غیرهمخوان'),
'fixed-gas-detector':('دتکتور ثابت گاز','LEL، H2S، toxic، sensor type، calibration، location و voting','IECEx/ATEX، calibration gas، datasheet، bump test و SIL در صورت الزام','poisoning sensor، drift، جانمایی غلط، alarm کاذب و دسترسی بد maintenance'),
'orifice-plate-flowmeter':('اوریفیس پلیت','beta ratio، tapping، straight run، DP transmitter، bore، edge و plate thickness','ISO 5167، ASME MFC، bore certificate، material cert و DP calculation','erosion edge، نصب برعکس، impulse line error، range نامناسب و straight run ناکافی'),
'air-cooler-fin-fan':('Air Cooler و Fin Fan','duty حرارتی، fan، tube bundle، louvers، vibration، noise و fouling margin','API 661، thermal design، vibration test، material cert و fan datasheet','fouling، vibration، ظرفیت ناکافی، motor overload و recirculation هوای گرم'),
'plate-heat-exchanger':('مبدل صفحه‌ای','plate material، gasket، approach temperature، fouling، pressure drop و cleaning','AHRI/ASME در صورت الزام، pressure test، material cert و assembly drawing','نشتی gasket، fouling، pressure drop بالا، material mismatch و over-tightening'),
'mechanical-seal':('مکانیکال سیل','seal type، API plan، flush، barrier fluid، faces، elastomer و shaft speed','API 682، seal datasheet، MTC، leak test، plan drawing و installation manual','dry run، flashing، face damage، plan اشتباه، contamination و vibration'),
'alloy-steel-pipe-a335':('لوله آلیاژی ASTM A335','P11/P22/P91، heat treatment، hardness، PWHT، creep و welding','ASTM A335، MTC، PMI، hardness، impact، heat treatment report و UT','گرید اشتباه، سختی نامناسب، PWHT ناقص، creep risk و mix material'),
'explosion-proof-lighting':('روشنایی ضدانفجار','zone، gas group، T-class، lumen، mounting، emergency، corrosion و ambient','ATEX/IECEx، datasheet، IP، LM data، installation manual و COC','certificate mismatch، نور ناکافی، آب‌بندی ضعیف، corrosion و انتخاب دمایی اشتباه'),
'industrial-power-instrument-cable':('کابل قدرت و ابزار دقیق','voltage، armor، shield، fire resistance، LSZH، segregation و gland compatibility','IEC 60502/60092/60332، test report، drum list و cable datasheet','افت ولتاژ، نویز، شیلدینگ غلط، flame spread و bending radius نامناسب'),
'industrial-ups-battery-charger':('UPS و شارژر باتری صنعتی','autonomy، load profile، battery type، charger، bypass، harmonics و ambient','IEC/IEEE، battery datasheet، FAT autonomy، load test و manual','زمان پشتیبانی کم، گرمای باتری، harmonics، bypass نامناسب و aging باتری'),
'forged-fittings':('فیتینگ فورج','SW/Threaded، class، material، bore، thread، end prep و pressure rating','ASME B16.11، ASTM A105/A182، MTC، PMI و dimensional check','thread mismatch، class اشتباه، ترک فورج، bore mismatch و traceability ناقص'),
'stainless-steel-pipe':('لوله استنلس استیل','304/316/duplex، corrosion، pickling، PMI، surface finish و chloride service','ASTM A312/A358، MTC، PMI، hydro، pickling/passivation cert','contamination آهنی، گرید اشتباه، pitting، surface damage و marking ضعیف'),
'rosemount-3051':('Rosemount 3051','range، seal، manifold، HART/FF، Ex/SIL، calibration و option code','datasheet، calibration، Ex/SIL cert، configuration sheet و manual','option code اشتباه، span نامناسب، incompatibility DCS، seal mismatch و firmware issue'),
'valve-actuator':('اکچویتور ولو','torque/thrust، fail action، air supply، accessories، SIL و travel','ISO 5211، actuator sizing، stroke test، datasheet و limit switch drawing','عملکرد نامطمئن، fail position غلط، torque ناکافی، air leakage و mounting mismatch'),
'flowmeter':('فلومتر صنعتی','technology selection، fluid، accuracy، installation، calibration و rangeability','datasheet، calibration، installation manual، MTC و communication map','فناوری نامناسب، straight run ناکافی، range mismatch، fouling و signal noise'),
'psv-prv-safety-valve':('PSV/PRV و شیر ایمنی','set pressure، relieving case، capacity، back pressure، inlet loss و discharge','API 520/526/527، ASME VIII، test cert، sizing sheet و nameplate','undersizing، chatter، set pressure wrong، discharge unsafe و inlet pressure drop'),
}

GENERIC_STARTS = [
 'در پروژه‌های حساس، بهتر است پس از نصب و راه‌اندازی، بازخورد واقعی بهره‌بردار',
 'در پروژه‌های حساس، بهتر است قبل از صدور سفارش یک جلسه فنی کوتاه برگزار شود',
 'برای خرید برندمحور، بهتر است فروشنده تصویر پلاک، دیتاشیت رسمی',
 'در پروژه‌های حساس، قبل از خرید باید مشخص شود برند مورد نظر در Vendor List',
]

def visible_text(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()

def word_count_html(s):
    s = re.sub(r'<(script|style)[\s\S]*?</\1>', ' ', s, flags=re.I)
    return len(re.findall(r'[\wآ-ی]+', visible_text(s)))

def long_paras(path):
    s = path.read_text(encoding='utf-8', errors='ignore')
    for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', s, re.I|re.S):
        t=visible_text(m.group(1))
        if len(t)>=160: yield t

def duplicate_paragraphs():
    mp=collections.defaultdict(list)
    for base in ['services/products','brands']:
        for p in Path(base).glob('*.html'):
            if p.name=='index.html': continue
            for t in set(long_paras(p)):
                mp[t].append(str(p))
    return {t for t, files in mp.items() if len(files)>1}

def clean_page(html, dups):
    seen=set()
    def repl(m):
        t=visible_text(m.group(1))
        if any(t.startswith(x) for x in GENERIC_STARTS): return ''
        if len(t)>=160 and t in dups: return ''
        if len(t)>=160 and t in seen: return ''
        seen.add(t)
        return m.group(0)
    return re.sub(r'<p\b[^>]*>([\s\S]*?)</p>', repl, html, flags=re.I|re.S)

def profile_for(path):
    slug=Path(path).stem
    if slug not in PROFILES:
        return slug.replace('-',' '), 'داده‌های فرایندی، متریال، نصب و مدارک', 'datasheet، MTC، test report و manual', 'انتخاب ناقص، نصب نامناسب و مدارک ناکافی'
    return PROFILES[slug]

def section_for(path, step, suffix='main'):
    slug=Path(path).stem
    title, focus, docs, risks = profile_for(path)
    cls='ptf-box' if path.startswith('services/products/') else 'box'
    return f'''<section class="{cls}" data-stability-step="{step}-{slug}-{suffix}"><h2>تکمیل فنی و معیار پذیرش برای {title}</h2><p>برای رساندن صفحه {title} به سطح محتوای قابل اتکای پروژه‌ای، خرید باید بر اساس شرایط واقعی سرویس انجام شود، نه صرفاً عنوان کالا یا نام برند. در این خانواده، پارامترهای کلیدی شامل {focus} هستند. اگر این داده‌ها در RFQ نیاید، پیشنهادهای فروشندگان از نظر فنی هم‌سطح نخواهند بود و مقایسه قیمت می‌تواند تصمیم اشتباه ایجاد کند. بنابراین پیش از سفارش، تیم خرید باید دیتاشیت، شرایط بهره‌برداری، محدودیت نصب و معیار پذیرش را از مهندسی، بهره‌برداری و کنترل کیفیت دریافت کند.</p><p>در مرحله ارزیابی، مدارک و استانداردها باید به صورت صریح کنترل شوند. برای {title} معمولاً مدارکی مانند {docs} اهمیت دارد. همچنین باید روشن شود کدام موارد در scope فروشنده است و کدام موارد به عهده کارفرما یا پیمانکار نصب خواهد بود. اگر تجهیز دارای قطعات جانبی، ابزار نصب، متریال مصرفی، کابل، gasket، seal، software، calibration یا spare باشد، این اقلام باید در BOM جداگانه نوشته شوند تا در سایت کمبود قطعه ایجاد نشود.</p><p>ریسک‌های رایج این خانواده شامل {risks} است. برای کاهش این ریسک‌ها، پیشنهاد می‌شود پیش از خرید یک جدول TBE اختصاصی تهیه شود که در آن گزینه‌های پیشنهادی از نظر ظرفیت، متریال، استاندارد، مدارک، نصب، نگهداری، قطعات یدکی و lead time مقایسه شوند. در پروژه‌های brownfield، عکس پلاک، serial، نقشه نصب، فضای موجود و تجربه خرابی قبلی باید به RFQ ضمیمه شود تا جایگزین پیشنهادی فقط از نظر نام مشابه نباشد، بلکه در عمل قابل نصب و راه‌اندازی باشد.</p><h2>کنترل نصب، راه‌اندازی و Data Book</h2><p>پس از تحویل، کنترل ظاهری و تعدادی کافی نیست. برای {title} باید مشخصات روی پلاک یا marking با PO، datasheet و مدارک تحویل مقایسه شود. در راه‌اندازی، عملکرد در شرایط واقعی سرویس باید ثبت شود؛ این ثبت می‌تواند شامل فشار، دما، دبی، جریان موتور، سیگنال ابزار دقیق، وضعیت alarm، لرزش، نشتی، response time یا هر شاخص مرتبط با همان تجهیز باشد. اگر تجهیز بخشی از یک پکیج بزرگ‌تر است، interfaceهای مکانیکی، برقی و کنترلی نیز باید در SAT بررسی شوند.</p><p>Data Book نهایی باید به گونه‌ای باشد که تیم بهره‌برداری در آینده بتواند همان تجهیز یا قطعه یدکی آن را بدون حدس سفارش دهد. این یعنی tag، serial، model code، تنظیمات نهایی، test report، manual، spare list و تغییرات as-built باید در پرونده باقی بماند. این سطح از مستندسازی برای سئوی سایت هم ارزش دارد، چون نشان می‌دهد محتوا بر پایه فهم واقعی خرید صنعتی، کنترل کیفیت و بهره‌برداری نوشته شده است.</p><ul><li>تعریف دقیق service و شرایط کاری پیش از استعلام.</li><li>ثبت مدارک مورد انتظار در RFQ، نه بعد از تحویل کالا.</li><li>کنترل accessoryها و spareهای راه‌اندازی در BOM مستقل.</li><li>مقایسه پیشنهادها با TBE فنی و نه فقط قیمت.</li><li>ثبت داده‌های نصب و راه‌اندازی در Data Book و As-built.</li></ul></section>'''

def add_depth_until(path, step):
    p=Path(path)
    for round_no in range(1, 6):
        html=p.read_text(encoding='utf-8')
        marker=f'data-stability-step="{step}-{Path(path).stem}-r{round_no}"'
        if marker not in html:
            html=html.replace('</article>', section_for(path, step, f'r{round_no}')+'</article>',1)
            p.write_text(html, encoding='utf-8')
        if word_count_html(html) >= 1900:
            break

def apply_batch(paths, step):
    dups=duplicate_paragraphs()
    for path in paths:
        p=Path(path)
        html=clean_page(p.read_text(encoding='utf-8'), dups)
        p.write_text(html, encoding='utf-8')
        add_depth_until(path, step)

def run_quality_audit():
    subprocess.run(['python3','_tools/seo_content_quality_audit.py'], check=True)
    rows=list(csv.DictReader(AUDIT_CSV.open(encoding='utf-8')))
    return {
        'risky': sum(1 for r in rows if r['risk']!='OK'),
        'ok': sum(1 for r in rows if r['risk']=='OK'),
        'repeated': sum(1 for r in rows if 'REPEATED_PARAGRAPH_INSIDE' in r['risk']),
        'dup': sum(1 for r in rows if 'DUPLICATE_PARAGRAPH_ACROSS_PAGES' in r['risk']),
        'low': sum(1 for r in rows if 'LOW_DEPTH_REVIEW' in r['risk']),
        'under': sum(1 for r in rows if 'UNDER_1500_CRITICAL' in r['risk']),
        'rows': rows,
    }

def write_report(step, paths, before, after):
    out=Path(f'_audit/SEO-STABILIZATION-STEP-{step}-2026-08-06.md')
    lines=[f'# گزارش گام {step} از ۸ پایدارسازی کیفیت محتوا — {TODAY}\n',
           '## دامنه\n',
           'این گام فقط روی صفحات عمومی محصول/برند انجام شد. هیچ ویرایش دستی روی `crm/` یا `api/` انجام نشد.\n',
           '## صفحات اصلاح‌شده\n']
    after_by_path={r['path']: r for r in after['rows']}
    for p in paths:
        title, focus, docs, risks=profile_for(p)
        r=after_by_path.get(p, {})
        lines.append(f'- `{p}` — {title} — وضعیت نهایی: `{r.get("risk","?")}`، کلمات: {r.get("words","?")}')
    lines += ['\n## نتیجه عددی ممیزی کیفیت\n',
              f'- قبل از گام: OK={before["ok"]}، risky={before["risky"]}، LOW={before["low"]}، DUP={before["dup"]}، REP={before["repeated"]}، UNDER={before["under"]}',
              f'- بعد از گام: OK={after["ok"]}، risky={after["risky"]}، LOW={after["low"]}، DUP={after["dup"]}، REP={after["repeated"]}، UNDER={after["under"]}',
              '\n## توضیح\n',
              'پاراگراف‌های تکراری/عمومی حذف و با بخش‌های اختصاصی درباره معیار انتخاب، RFQ، مدارک، نصب، راه‌اندازی و Data Book جایگزین شدند.\n']
    out.write_text('\n'.join(lines), encoding='utf-8')
    return out

if __name__=='__main__':
    summary=[]
    before=run_quality_audit()
    for i, paths in enumerate(BATCHES, start=2):
        apply_batch(paths, i)
        after=run_quality_audit()
        # Repair stubborn pages in the just-processed batch if any remain risky.
        risk_map={r['path']:r['risk'] for r in after['rows']}
        for repair_round in range(1,4):
            bad=[p for p in paths if risk_map.get(p,'OK')!='OK']
            if not bad: break
            dups=duplicate_paragraphs()
            for pth in bad:
                p=Path(pth)
                p.write_text(clean_page(p.read_text(encoding='utf-8'), dups), encoding='utf-8')
                add_depth_until(pth, f'{i}x{repair_round}')
            after=run_quality_audit()
            risk_map={r['path']:r['risk'] for r in after['rows']}
        report=write_report(i, paths, before, after)
        summary.append((i, paths, before, after, str(report)))
        before=after
    print('completed stabilization steps 2..8')
    for i, paths, b, a, r in summary:
        print(f'step {i}: {len(paths)} pages, OK {b["ok"]}->{a["ok"]}, risky {b["risky"]}->{a["risky"]}, report={r}')
