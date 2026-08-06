#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add wave-2 product internal links to public knowledge/blog/service pages."""
from pathlib import Path
from html import escape
import posixpath

PRODUCTS={
 'butterfly-valve':('باترفلای ولو صنعتی','Butterfly Valve','services/products/butterfly-valve.html','برای استعلام باترفلای ولو، نوع Concentric/Double Offset/Triple Offset، Seat، کلاس، متریال، گشتاور و عملگر را مشخص کنید.'),
 'psv-prv-safety-valve':('شیر اطمینان PSV / PRV','PSV / PRV / Safety Valve','services/products/psv-prv-safety-valve.html','برای PSV، Set Pressure، Orifice، Back Pressure، سیال، دما، ظرفیت Relief و گواهی تست از داده‌های حیاتی RFQ هستند.'),
 'valve-actuator':('اکچویتور ولو','Valve Actuator','services/products/valve-actuator.html','برای اکچویتور، Torque/Thrust، Fail Action، زمان عملکرد، منبع هوا/برق، Mounting Kit و Ex را از ابتدا روشن کنید.'),
 'differential-pressure-transmitter':('ترانسمیتر اختلاف فشار DP','DP Transmitter','services/products/differential-pressure-transmitter.html','برای DP Transmitter، Range، Static Pressure، Manifold، Remote Seal و روش نصب Impulse Line را مشخص کنید.'),
 'magnetic-flowmeter':('فلومتر مغناطیسی','Magnetic Flowmeter','services/products/magnetic-flowmeter.html','برای Magmeter، رسانایی سیال، Liner، Electrode، Grounding و پر بودن کامل لوله معیارهای کلیدی هستند.'),
 'coriolis-flowmeter':('فلومتر کوریولیس','Coriolis Flowmeter','services/products/coriolis-flowmeter.html','برای Coriolis، دبی جرمی، چگالی، ویسکوزیته، افت فشار، متریال Tube و کالیبراسیون محدوده واقعی مهم است.'),
 'vortex-flowmeter':('فلومتر ورتکس','Vortex Flowmeter','services/products/vortex-flowmeter.html','برای Vortex، Reynolds، طول مستقیم، نوع سیال، جبران دما/فشار و دبی حداقل باید بررسی شود.'),
 'radar-level-transmitter':('رادار لول ترانسمیتر','Radar Level Transmitter','services/products/radar-level-transmitter.html','برای رادار لول، Dielectric، نازل، فوم/بخار، آنتن، فرکانس، Ex و نیاز Overfill Protection را مشخص کنید.'),
 'vfd-soft-starter':('VFD و سافت‌استارتر','VFD & Soft Starter','services/products/vfd-soft-starter.html','برای VFD، توان، ولتاژ، Overload، هارمونیک، طول کابل، Filter و تهویه تابلو روی انتخاب اثر دارد.'),
 'industrial-circuit-breakers':('کلید صنعتی ACB / MCCB / VCB','Industrial Circuit Breakers','services/products/industrial-circuit-breakers.html','برای کلید صنعتی، Icu/Ics، Icw، Trip Unit، سطح اتصال کوتاه و Coordination Study را در RFQ بیاورید.'),
 'power-transformer':('ترانسفورماتور توزیع و قدرت','Power Transformer','services/products/power-transformer.html','برای ترانسفورماتور، توان، ولتاژ، Vector Group، امپدانس، تلفات، Tap و تست‌های Routine/Type مهم هستند.'),
 'dosing-metering-pump':('دوزینگ پمپ صنعتی','Dosing / Metering Pump','services/products/dosing-metering-pump.html','برای دوزینگ پمپ، دبی، فشار، Accuracy، ماده شیمیایی، متریال Head و تجهیزات پکیج تزریق باید مشخص شود.'),
 'screw-compressor':('کمپرسور اسکرو صنعتی','Screw Compressor','services/products/screw-compressor.html','برای کمپرسور اسکرو، ظرفیت واقعی، فشار، کیفیت هوا، Dew Point، Dryer/Filter و پروفایل مصرف مهم است.'),
 'steam-trap':('تله بخار صنعتی','Steam Trap','services/products/steam-trap.html','برای Steam Trap، بار کندانس، فشار ورودی، Back Pressure، نوع کاربرد و Strainer باید مشخص شود.'),
 'pressure-vessel':('مخزن تحت فشار','Pressure Vessel','services/products/pressure-vessel.html','برای مخزن تحت فشار، Design Code، فشار/دما، Corrosion Allowance، NDT، PWHT، Hydrotest و MDR حیاتی است.'),
}
MAP={
 'butterfly-valve':['knowledge-center/butterfly-valve-complete-guide.html','knowledge-center/butterfly-valve-api-609-concentric-offset.html','knowledge-center/kc-butterfly-valve-offset.html','knowledge-center/kc-butterfly-valve-torque-actuator-sizing.html'],
 'psv-prv-safety-valve':['knowledge-center/psv-prv-api-520-api-526.html','knowledge-center/kc-psv.html','knowledge-center/kc-psv-set-pressure-blowdown-adjustment.html','knowledge-center/safety-relief-valve-guide.html'],
 'valve-actuator':['knowledge-center/valve-actuator-types-guide.html','knowledge-center/electric-actuator.html','knowledge-center/pneumatic-actuator-rack-pinion.html','knowledge-center/kc-actuator-fail-safe-position-guide.html','knowledge-center/kc-actuator.html','knowledge-center/kc-cv-actuator.html'],
 'differential-pressure-transmitter':['knowledge-center/differential-pressure-transmitter-guide.html','knowledge-center/dpt.html'],
 'magnetic-flowmeter':['knowledge-center/magmeter.html','knowledge-center/kc-flowmeter-selection-by-fluid-application.html'],
 'coriolis-flowmeter':['knowledge-center/flowmeter-types-guide.html','knowledge-center/kc-flowmeters-10-methods.html'],
 'vortex-flowmeter':['knowledge-center/vortex-flowmeter.html'],
 'radar-level-transmitter':['knowledge-center/radar-level-transmitter-guide.html','knowledge-center/kc-radar-level-transmitter-tank-installation.html','knowledge-center/level-measurement-guide.html'],
 'vfd-soft-starter':['knowledge-center/vfd-variable-frequency-drive-guide.html','knowledge-center/vfd.html','knowledge-center/kc-vfd.html','knowledge-center/kc-vfd-harmonic-distortion-mitigation.html'],
 'industrial-circuit-breakers':['knowledge-center/acb-circuit-breaker-guide.html','knowledge-center/mccb-circuit-breaker-guide.html','knowledge-center/vcb.html'],
 'power-transformer':['knowledge-center/distribution-transformer.html','knowledge-center/power-distribution-transformer-guide.html'],
 'dosing-metering-pump':['knowledge-center/kc-chemical-injection-pump-metering-accuracy.html','knowledge-center/kc-chemical-injection.html'],
 'screw-compressor':['knowledge-center/kc-compressor-selection-screw-vs-reciprocating.html','knowledge-center/kc-compressed-air-system.html','blog/compressors-air-systems/index.html'],
 'steam-trap':['knowledge-center/steam-system-equipment-guide.html','services/boilers/index.html'],
 'pressure-vessel':['blog/pressure-vessels-asme.html']
}
SERVICE={
 'services/valves-guide/index.html':['butterfly-valve','psv-prv-safety-valve','valve-actuator'],
 'services/instrumentation-equipment/index.html':['differential-pressure-transmitter','magnetic-flowmeter','coriolis-flowmeter','vortex-flowmeter','radar-level-transmitter'],
 'services/electrical-equipment/index.html':['vfd-soft-starter','industrial-circuit-breakers','power-transformer'],
 'services/pumps/index.html':['dosing-metering-pump'],
 'services/compressors/index.html':['screw-compressor'],
 'services/boilers/index.html':['steam-trap'],
 'services/industrial-equipment/index.html':['pressure-vessel'],
 'services/index.html':['butterfly-valve','differential-pressure-transmitter','vfd-soft-starter','dosing-metering-pump','screw-compressor','pressure-vessel']
}
STYLE='''<style id="ptf-product-link-style">
.ptf-product-linkbox{margin:34px 0;padding:22px;border-radius:24px;background:linear-gradient(135deg,#fff7ed,#f8fafc);border:1px solid #fed7aa;box-shadow:0 14px 34px rgba(15,23,42,.06)}
.ptf-product-linkbox b{display:block;color:#0f2744;font-size:18px;margin-bottom:8px}.ptf-product-linkbox p{margin:0 0 14px;color:#475569;line-height:2}.ptf-product-linkbox a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:#ef4b1a;color:#fff;border-radius:999px;padding:10px 18px;font-weight:900}.ptf-product-linkbox a.secondary{background:#0f2744;margin-right:8px}
.ptf-service-products{margin:34px 0;padding:26px;border:1px solid #e2e8f0;border-radius:28px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.06)}.ptf-service-products h2{margin:0 0 10px;color:#0f2744}.ptf-service-products p{color:#64748b;line-height:2}.ptf-service-products-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.ptf-service-products-grid a{display:block;text-decoration:none;color:#0f2744;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:14px;font-weight:900}.ptf-service-products-grid a:hover{border-color:#ef4b1a;color:#ef4b1a;background:#fff7ed}
</style>
'''

def rel(file_path,target): return posixpath.relpath(target, str(Path(file_path).parent)).replace('\\','/')
def ensure_style(tx): return tx if 'id="ptf-product-link-style"' in tx else tx.replace('</head>',STYLE+'</head>',1)
def product_box(file_path,slug):
    fa,en,target,note=PRODUCTS[slug]
    return f'''<div class="ptf-product-linkbox" data-ptf-product-link="{slug}"><b>مسیر خرید و استعلام: {escape(fa)} ({escape(en)})</b><p>{escape(note)} این صفحه محصول، مشخصات فنی، مدارک RFQ، خطاهای رایج و مسیر ثبت استعلام را جمع‌بندی می‌کند.</p><a href="{rel(file_path,target)}">مشاهده صفحه محصول {escape(fa)} ←</a><a class="secondary" href="{rel(file_path,'rfq/index.html').replace('index.html','')}?product={slug}">ثبت RFQ همین محصول</a></div>'''
def service_block(file_path,slugs):
    cards=''.join(f'<a href="{rel(file_path,PRODUCTS[s][2])}">{escape(PRODUCTS[s][0])}<small style="display:block;color:#64748b;font-weight:700;margin-top:5px">{escape(PRODUCTS[s][1])}</small></a>' for s in slugs)
    return f'''<section class="ptf-service-products" data-ptf-service-products-wave2="1"><h2>محصولات تکمیلی مرتبط با این خدمت</h2><p>این صفحات محصول برای آماده‌سازی RFQ دقیق‌تر، کنترل استانداردها و کاهش ریسک خرید پروژه‌ای تهیه شده‌اند.</p><div class="ptf-service-products-grid">{cards}<a href="{rel(file_path,'services/products/index.html').replace('index.html','')}">هاب کامل محصولات صنعتی<small style="display:block;color:#64748b;font-weight:700;margin-top:5px">Product Hub</small></a></div></section>'''
def insert_article(tx,block):
    if '</article>' in tx: return tx.replace('</article>',block+'\n</article>',1)
    if '<footer' in tx: return tx.replace('<footer',block+'\n<footer',1)
    return tx.replace('</body>',block+'\n</body>',1)
def insert_footer(tx,block):
    if '<footer' in tx: return tx.replace('<footer',block+'\n<footer',1)
    return tx.replace('</body>',block+'\n</body>',1)
changed=[]
for slug,paths in MAP.items():
    for fp in paths:
        p=Path(fp)
        if not p.exists(): continue
        tx=p.read_text(encoding='utf-8',errors='ignore')
        if f'data-ptf-product-link="{slug}"' in tx: continue
        tx=ensure_style(tx)
        tx=insert_article(tx,product_box(fp,slug))
        p.write_text(tx,encoding='utf-8'); changed.append(fp)
for fp,slugs in SERVICE.items():
    p=Path(fp)
    if not p.exists(): continue
    tx=p.read_text(encoding='utf-8',errors='ignore')
    if 'data-ptf-service-products-wave2="1"' in tx: continue
    tx=ensure_style(tx)
    tx=insert_footer(tx,service_block(fp,slugs))
    p.write_text(tx,encoding='utf-8'); changed.append(fp)
print('\n'.join(changed)); print('changed=',len(changed))
