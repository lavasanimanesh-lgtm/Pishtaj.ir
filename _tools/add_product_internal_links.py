#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add targeted internal links from educational/service pages to product pages.
Public SEO only; excludes crm/api.
"""
from pathlib import Path
from html import escape

PRODUCTS = {
    "ball-valve": ("بال ولو صنعتی", "Ball Valve", "services/products/ball-valve.html", "برای استعلام بال ولو، نوع Floating/Trunnion، کلاس، متریال، Bore و الزام Fire Safe را هم‌زمان مشخص کنید."),
    "gate-valve": ("گیت ولو صنعتی", "Gate Valve", "services/products/gate-valve.html", "برای خرید گیت ولو، استاندارد API 600 یا API 602، نوع Wedge، Bonnet، کلاس و تست API 598 را دقیق اعلام کنید."),
    "globe-valve": ("گلوب ولو صنعتی", "Globe Valve", "services/products/globe-valve.html", "برای انتخاب گلوب ولو، Pattern، جهت جریان، نوع Disc، افت فشار و متریال Trim نقش تعیین‌کننده دارند."),
    "check-valve": ("چک ولو صنعتی", "Check Valve", "services/products/check-valve.html", "برای جلوگیری از برگشت جریان، نوع Check Valve باید با سرعت خط، ریسک Slam و شرایط نصب هماهنگ شود."),
    "control-valve": ("کنترل ولو صنعتی", "Control Valve", "services/products/control-valve.html", "برای RFQ کنترل ولو، Cv/Kv، افت فشار، Noise، Cavitation، Fail Action، Actuator و Positioner را از ابتدا روشن کنید."),
    "flowmeter": ("فلومتر صنعتی", "Flowmeter", "services/products/flowmeter.html", "برای انتخاب فلومتر، نوع سیال، رسانایی، ویسکوزیته، دبی حداقل/نرمال/حداکثر، دقت و شرایط نصب مهم است."),
    "pressure-transmitter": ("ترانسمیتر فشار صنعتی", "Pressure Transmitter", "services/products/pressure-transmitter.html", "برای ترانسمیتر فشار، نوع Gauge/Absolute/DP، رنج، متریال Wetted Parts، HART، Ex و کالیبراسیون را مشخص کنید."),
    "rosemount-3051": ("ترانسمیتر Rosemount 3051", "Rosemount 3051", "services/products/rosemount-3051.html", "در خرید Rosemount 3051، Model Code، رنج، متریال دیافراگم، گواهی Ex و اصالت مدارک باید کنترل شود."),
    "api-5l-pipe": ("لوله API 5L", "API 5L Pipe", "services/products/api-5l-pipe.html", "برای خرید API 5L، Grade، PSL، روش ساخت، تست‌ها، NACE و Heat Number در MTC باید شفاف باشد."),
    "seamless-pipe": ("لوله مانیسمان", "Seamless Pipe", "services/products/seamless-pipe.html", "برای لوله مانیسمان، ASTM A106، Schedule، ابعاد ASME B36.10، MTC و تست Hydro را هم‌زمان بررسی کنید."),
    "butt-weld-fittings": ("فیتینگ جوشی BW", "Butt Weld Fittings", "services/products/butt-weld-fittings.html", "برای فیتینگ جوشی، ASME B16.9، متریال، Schedule، Bevel و تطابق با Pipe Spec ضروری است."),
    "welding-flanges": ("فلنج صنعتی", "Industrial Flanges", "services/products/welding-flanges.html", "برای فلنج صنعتی، نوع WN/SO/BL، کلاس، Facing، متریال و Bore/Schedule را دقیق اعلام کنید."),
    "industrial-gaskets": ("گسکت صنعتی", "Industrial Gaskets", "services/products/industrial-gaskets.html", "برای آب‌بندی فلنجی، نوع گسکت، Facing، کلاس، متریال Filler/Ring و روش Torque باید هماهنگ باشد."),
    "lv-mv-switchgear": ("تابلو برق LV/MV", "LV/MV Switchgear", "services/products/lv-mv-switchgear.html", "برای Switchgear، جریان، سطح اتصال کوتاه، IP، فرم جداسازی، حفاظت و تست‌های IEC را در RFQ بیاورید."),
    "api-610-centrifugal-pump": ("پمپ سانتریفیوژ API 610", "API 610 Pump", "services/products/api-610-centrifugal-pump.html", "برای پمپ API 610، دبی، هد، NPSH، متریال، Seal Plan و محدوده کارکرد نسبت به BEP را کنترل کنید."),
    "shell-tube-heat-exchanger": ("مبدل حرارتی Shell & Tube", "Shell & Tube Heat Exchanger", "services/products/shell-tube-heat-exchanger.html", "برای مبدل Shell & Tube، Thermal Datasheet، TEMA Type، ASME Design، Fouling و ITP پایه تصمیم هستند."),
}

KC_MAP = {
    "ball-valve": ["knowledge-center/ball-valve-api-6d.html", "knowledge-center/ball-valve-complete-guide.html", "knowledge-center/ball-vs-gate-valve-comparison.html", "knowledge-center/api-6d-ball-valve-standard.html"],
    "gate-valve": ["knowledge-center/gate-valve-complete-guide.html", "knowledge-center/api-600-gate-valve-standard.html", "knowledge-center/api-602-small-gate-valve.html", "knowledge-center/kc-gate-valve-api-600-flexible-wedge-design.html", "knowledge-center/kc-gate-valve-wedge-sticking-troubleshooting.html"],
    "globe-valve": ["knowledge-center/globe-valve-complete-guide.html", "knowledge-center/globe-gate-valve.html", "knowledge-center/globe-angle-valve.html", "knowledge-center/kc-globe-valve-flow-direction-guide.html"],
    "check-valve": ["knowledge-center/check-valve-complete-guide.html", "knowledge-center/check-valve-swing-lift-dual-plate.html", "knowledge-center/dual-plate-check-valve.html", "knowledge-center/nozzle-check-valve.html", "knowledge-center/tilting-disc-check-valve.html"],
    "control-valve": ["knowledge-center/control-valve-complete-guide.html", "knowledge-center/control-valve-cv-calculation-guide.html", "knowledge-center/control-valve-cavitation-guide.html", "knowledge-center/control-valve-actuator-selection-guide.html", "knowledge-center/control-valve-cv-kv-difference.html", "knowledge-center/gas-control-valve-sizing-guide.html", "knowledge-center/steam-control-valve-sizing-guide.html"],
    "flowmeter": ["knowledge-center/flowmeter-types-guide.html", "knowledge-center/kc-flowmeters-10-methods.html", "knowledge-center/kc-flowmeter-selection-by-fluid-application.html", "knowledge-center/magmeter.html", "knowledge-center/vortex-flowmeter.html", "knowledge-center/thermal-mass-flowmeter.html"],
    "pressure-transmitter": ["knowledge-center/differential-pressure-transmitter-guide.html", "knowledge-center/pressure-transmitter-calibration-guide.html", "knowledge-center/kc-pressure-transmitter-range-selection.html", "blog/pressure-transmitter-guide.html"],
    "rosemount-3051": ["knowledge-center/rosemount-3051.html", "knowledge-center/rosemount-vs-yokogawa-comparison.html"],
    "api-5l-pipe": ["knowledge-center/api-5l-pipe-guide.html", "knowledge-center/api-5l-psl2-psl1.html", "knowledge-center/api-5l-x52.html", "knowledge-center/api-5l-x65.html", "knowledge-center/a106-api-5l.html"],
    "seamless-pipe": ["knowledge-center/seamless-pipe-complete-guide.html", "knowledge-center/seamless-vs-erw-pipe-difference.html", "knowledge-center/a106-gr-b.html", "knowledge-center/asme-b36-10-pipe-dimensions.html", "blog/seamless-pipe-guide.html"],
    "butt-weld-fittings": ["knowledge-center/pipe-fittings-guide.html", "knowledge-center/asme-b16-9.html", "knowledge-center/kc-welded-fittings-elbow-tee-reducer.html"],
    "welding-flanges": ["knowledge-center/flange-types-complete-guide.html", "knowledge-center/asme-b16-5.html", "knowledge-center/flange-material-selection-guide.html", "knowledge-center/wn-vs-so-flange-comparison.html", "blog/flange-types-guide.html"],
    "industrial-gaskets": ["knowledge-center/gasket-types-guide.html", "knowledge-center/kc-gasket-selection-by-fluid-temperature.html", "knowledge-center/flange-bolting-guide.html"],
    "lv-mv-switchgear": ["knowledge-center/lv-iec-61439.html", "knowledge-center/mv-iec-62271.html", "knowledge-center/kc-mv-switchgear.html", "blog/electrical-switchgear-guide.html"],
    "api-610-centrifugal-pump": ["knowledge-center/api-610.html", "knowledge-center/kc-api-610.html", "knowledge-center/kc-api-610-pump-curve-reading-guide.html"],
    "shell-tube-heat-exchanger": ["knowledge-center/kc-heat-exchanger-tema-class-selection.html", "knowledge-center/kc-shell-tube-heat-exchanger-tema-guide.html"],
}

SERVICE_MAP = {
    "services/valves-guide/index.html": ["ball-valve", "gate-valve", "globe-valve", "check-valve", "control-valve"],
    "services/piping-equipment/index.html": ["seamless-pipe", "api-5l-pipe", "welding-flanges", "butt-weld-fittings", "industrial-gaskets"],
    "services/instrumentation-equipment/index.html": ["pressure-transmitter", "rosemount-3051", "flowmeter", "control-valve"],
    "services/electrical-equipment/index.html": ["lv-mv-switchgear"],
    "services/pumps/index.html": ["api-610-centrifugal-pump"],
    "services/industrial-equipment/index.html": ["shell-tube-heat-exchanger"],
    "services/index.html": ["ball-valve", "api-5l-pipe", "flowmeter", "lv-mv-switchgear", "api-610-centrifugal-pump", "shell-tube-heat-exchanger"],
}

STYLE = """<style id="ptf-product-link-style">
.ptf-product-linkbox{margin:34px 0;padding:22px;border-radius:24px;background:linear-gradient(135deg,#fff7ed,#f8fafc);border:1px solid #fed7aa;box-shadow:0 14px 34px rgba(15,23,42,.06)}
.ptf-product-linkbox b{display:block;color:#0f2744;font-size:18px;margin-bottom:8px}.ptf-product-linkbox p{margin:0 0 14px;color:#475569;line-height:2}.ptf-product-linkbox a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:#ef4b1a;color:#fff;border-radius:999px;padding:10px 18px;font-weight:900}.ptf-product-linkbox a.secondary{background:#0f2744;margin-right:8px}
.ptf-service-products{margin:34px 0;padding:26px;border:1px solid #e2e8f0;border-radius:28px;background:#fff;box-shadow:0 16px 42px rgba(15,23,42,.06)}.ptf-service-products h2{margin:0 0 10px;color:#0f2744}.ptf-service-products p{color:#64748b;line-height:2}.ptf-service-products-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.ptf-service-products-grid a{display:block;text-decoration:none;color:#0f2744;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:14px;font-weight:900}.ptf-service-products-grid a:hover{border-color:#ef4b1a;color:#ef4b1a;background:#fff7ed}
</style>
"""


def rel_href(from_file: str, target: str) -> str:
    # target is root-relative without leading slash. Compute relative URL from current HTML file directory.
    from_dir = Path(from_file).parent
    return Path("/").joinpath(target) if False else __import__('posixpath').relpath(target, str(from_dir)).replace('\\', '/')


def product_box(file_path: str, slug: str) -> str:
    fa, en, target, note = PRODUCTS[slug]
    href = rel_href(file_path, target)
    rfq = rel_href(file_path, "rfq/index.html").replace("index.html", "") + f"?product={slug}"
    return f"""
<div class="ptf-product-linkbox" data-ptf-product-link="{slug}">
  <b>مسیر خرید و استعلام: {escape(fa)} ({escape(en)})</b>
  <p>{escape(note)} این لینک به صفحه محصولی می‌رود که مشخصات، استانداردها، مدارک RFQ و خطاهای رایج خرید را به‌صورت تجاری و قابل اقدام جمع‌بندی کرده است.</p>
  <a href="{href}">مشاهده صفحه محصول {escape(fa)} ←</a>
  <a class="secondary" href="{rfq}">ثبت RFQ همین محصول</a>
</div>
"""


def service_block(file_path: str, slugs: list[str]) -> str:
    cards = []
    for slug in slugs:
        fa, en, target, _ = PRODUCTS[slug]
        cards.append(f'<a href="{rel_href(file_path, target)}">{escape(fa)}<small style="display:block;color:#64748b;font-weight:700;margin-top:5px">{escape(en)}</small></a>')
    hub = rel_href(file_path, "services/products/index.html").replace("index.html", "")
    return f"""
<section class="ptf-service-products" data-ptf-service-products="1">
  <h2>صفحات محصول مرتبط برای استعلام دقیق‌تر</h2>
  <p>برای تبدیل مطالعه فنی به خرید قابل کنترل، صفحات محصول زیر شامل استانداردها، داده‌های RFQ، مدارک کیفی و خطاهای رایج خرید هستند. اگر هنوز دیتاشیت کامل ندارید، از همین صفحات برای آماده‌سازی استعلام استفاده کنید.</p>
  <div class="ptf-service-products-grid">{''.join(cards)}<a href="{hub}">مشاهده همه محصولات صنعتی<small style="display:block;color:#64748b;font-weight:700;margin-top:5px">Product Hub</small></a></div>
</section>
"""


def ensure_style(tx: str) -> str:
    if 'id="ptf-product-link-style"' in tx:
        return tx
    return tx.replace('</head>', STYLE + '</head>', 1) if '</head>' in tx else STYLE + tx


def insert_before_article_end(tx: str, block: str) -> str:
    if '</article>' in tx:
        return tx.replace('</article>', block + '\n</article>', 1)
    if '<footer' in tx:
        return tx.replace('<footer', block + '\n<footer', 1)
    return tx.replace('</body>', block + '\n</body>', 1)


def insert_before_footer(tx: str, block: str) -> str:
    if '<footer' in tx:
        return tx.replace('<footer', block + '\n<footer', 1)
    return tx.replace('</main>', block + '\n</main>', 1) if '</main>' in tx else tx.replace('</body>', block + '\n</body>', 1)

changed = []
# Knowledge/blog contextual links
for slug, paths in KC_MAP.items():
    for file_path in paths:
        p = Path(file_path)
        if not p.exists():
            continue
        tx = p.read_text(encoding='utf-8', errors='ignore')
        if f'data-ptf-product-link="{slug}"' in tx:
            continue
        tx = ensure_style(tx)
        tx = insert_before_article_end(tx, product_box(file_path, slug))
        p.write_text(tx, encoding='utf-8')
        changed.append(file_path)

# Service/category product grids
for file_path, slugs in SERVICE_MAP.items():
    p = Path(file_path)
    if not p.exists():
        continue
    tx = p.read_text(encoding='utf-8', errors='ignore')
    if 'data-ptf-service-products="1"' in tx:
        continue
    tx = ensure_style(tx)
    tx = insert_before_footer(tx, service_block(file_path, slugs))
    p.write_text(tx, encoding='utf-8')
    changed.append(file_path)

print('\n'.join(changed))
print(f"changed={len(changed)}")
