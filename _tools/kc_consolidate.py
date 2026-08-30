#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kc_consolidate.py — ادغام صفحات تکراری/پوستهٔ مرکز دانش (KC Consolidation)

هدف
---
مرکز دانش برای بسیاری از موضوعات «دو یا چند URL» دارد:
  * یک صفحهٔ عمیقِ جدید (kc-*) با ۳۰۰۰–۸۰۰۰ کاراکتر محتوای یکتا
  * یک یا چند «پوسته»ی قدیمی با ۷۰–۸۰۰ کاراکتر محتوای یکتا (گاه فقط یک جمله)
پوسته‌ها نه رتبه می‌گیرند و نه می‌توانند رتبه بگیرند؛ فقط خزش را هدر می‌دهند و
با صفحهٔ اصلیِ همان موضوع رقابت می‌کنند. این ابزار پوسته را با ۳۰۱ به صفحهٔ
هم‌موضوعِ قوی‌تر می‌فرستد تا اعتبار و سیگنال یک‌جا جمع شود.

روشِ تشخیص (چرا این بار با دفعات قبل فرق دارد)
---------------------------------------------
قالبِ مشترکِ سایت (معرفی شرکت، CTA، «اهمیت موضوع در صنایع …») با بسامدِ
پاراگراف در کلِ مجموعه حذف می‌شود (هر پاراگرافی که در ≥۵ صفحه آمده باشد)،
سپس فقط «متن یکتای» هر صفحه می‌ماند و شباهتِ موضوعی روی آن سنجیده می‌شود.
هر جفتِ زیر با خواندنِ متنِ یکتای هر دو طرف، دستی تأیید شده است.

ایمنی
-----
* هیچ فایلی حذف نمی‌شود (منبع فقط ریدایرکت می‌شود).
* لینک‌های داخلی به صفحهٔ مبدأ به مقصد تغییر می‌کنند تا زنجیرهٔ ۳۰۱ نسازیم.
* URLهای مبدأ از sitemap-knowledge-center.xml خارج می‌شوند.
* اجرای دوباره بی‌اثر است (قانون تکراری اضافه نمی‌شود).

اجرا:  python3 _tools/kc_consolidate.py [--apply]
"""

import os
import re
import sys
import glob
import html
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KC = "knowledge-center"

# ---------------------------------------------------------------------------
# نقشهٔ ادغام — هر سطر با خواندنِ متنِ یکتای هر دو طرف تأیید شده است.
# فرمت: slug_مبدأ : (slug_مقصد, علت)
# ---------------------------------------------------------------------------
CONSOLIDATE = {
    # --- پمپ و کمپرسور ---
    "api-610": ("kc-api-610", "هر دو «پمپ سانتریفیوژ API 610»؛ مقصد ۳۷۳۲ کاراکتر یکتا در برابر ۲۹۸"),
    "api-617": ("kc-api-617", "هر دو «کمپرسور API 617»؛ ۷۹ در برابر ۳۳۷۸"),

    # --- لوله و پایپینگ ---
    "api-5l-psl2-psl1": ("kc-api-5l-psl1-psl2", "هر دو «API 5L PSL1/PSL2»؛ ۳۱۴ در برابر ۳۳۷۳"),
    "a106-gr-b": ("kc-astm-a106-gr", "هر دو «لوله A106 Gr.B»؛ ۴۳۷ در برابر ۳۲۰۶"),
    "a106-pipe-procurement-guide": ("kc-astm-a106-gr", "راهنمای خرید A106 در صفحهٔ جامع A106 ادغام شد"),
    "astm-a53-gr-b": ("a53-pipe-specifications", "هر دو «لوله A53 Gr.B»؛ ۷۷ در برابر ۳۸۷"),
    "a53-gr-b": ("a53-pipe-specifications", "هر دو «لوله A53 Gr.B»؛ ۹۷ در برابر ۳۸۷"),
    "astm-a335-p91": ("kc-a335", "هر دو «لوله آلیاژی A335 P91»؛ ۸۸ در برابر ۳۰۸۳"),
    "astm-a335-p11-p22-p91": ("kc-a335", "هر دو «لوله A335 P11/P22/P91»؛ ۸۷ در برابر ۳۰۸۳"),

    # --- شیرآلات ---
    "ball-valve-api-6d": ("api-6d-ball-valve-standard", "هر دو «استاندارد API 6D برای بال‌ولو»؛ ۳۱۶ در برابر ۷۴۲"),
    "api-600": ("api-600-gate-valve-standard", "هر دو «استاندارد API 600 گیت‌ولو»؛ ۱۰۱ در برابر ۷۶۷"),
    "pinch-valve": ("pinch-valve-guide", "هر دو «شیر پینچ»؛ ۶۸ در برابر ۳۶۵"),
    "electric-actuator": ("kc-actuator", "محرک الکتریکی؛ مبحثِ محرک‌ها در مقصد کامل‌تر است"),
    "pneumatic-actuator-rack-pinion": ("kc-actuator", "محرک پنوماتیک؛ مبحثِ محرک‌ها در مقصد کامل‌تر است"),

    # --- ابزار دقیق ---
    "rosemount-3051": ("rosemount-pressure-transmitter-family", "هر دو «ترانسمیتر فشار روزمونت ۳۰۵۱»؛ ۳۱۱ در برابر ۵۳۵۹"),
    "rosemount-644": ("kc-rtd-thermocouple-thermistor", "۶۴۴ ترانسمیترِ دماست → صفحهٔ دما (نه فشار)"),
    "thermowell": ("thermowell-guide", "هر دو «ترموول»؛ ۷۶ در برابر ۳۷۵"),
    "guided-wave-non-contact": ("kc-level-measurement-6-methods", "روش‌های راداری/موج‌بر؛ در «۶ روش اندازه‌گیری سطح» آمده"),
    "float-vibrating-capacitance": ("kc-level-measurement-6-methods", "شناور/لرزشی/خازنی؛ در «۶ روش اندازه‌گیری سطح» آمده"),
    "profibus-profinet": ("kc-instrumentation-communication-protocols", "پروتکل‌های ارتباطی ابزار دقیق"),
    "modbus-tcp-rtu": ("kc-instrumentation-communication-protocols", "پروتکل‌های ارتباطی ابزار دقیق"),

    # --- برق و اتوماسیون ---
    "vfd": ("kc-vfd", "هر دو «درایو VFD»؛ ۲۷۲ در برابر ۳۰۸۸"),
    "ups-industrial-guide": ("kc-ups", "هر دو «UPS صنعتی»؛ ۳۷۳ در برابر ۲۹۹۱"),
    "ups-online-line-interactive": ("kc-ups", "توپولوژی‌های UPS در صفحهٔ UPS صنعتی"),
    "ups-nicd-li-ion": ("kc-ups", "باتری NiCd/Li-ion در صفحهٔ UPS صنعتی"),
    "plc-siemens-s7-1500": ("kc-plc", "مدل‌های PLC در صفحهٔ تابلوهای PLC و اتوماسیون"),
    "plc-allen-bradley-controllogix": ("kc-plc", "مدل‌های PLC در صفحهٔ تابلوهای PLC و اتوماسیون"),
    "dcs-distributed-control-system": ("kc-dcs", "هر دو «سیستم DCS»؛ ۱۰۳ در برابر ۲۹۸۴"),
    "scada": ("scada-rtu-system-guide", "هر دو «SCADA»؛ ۹۷ در برابر ۳۸۱"),
    "industrial-grounding-guide": ("kc-earthing", "هر دو «اتصال زمین/ارتینگ صنعتی»؛ ۳۷۷ در برابر ۲۹۹۷"),
    "soft-starter": ("soft-starter-guide", "هر دو «سافت‌استارتر»؛ ۷۵ در برابر ۳۸۱"),

    # --- بازرسی و کیفیت ---
    "ndt-ut": ("kc-ndt", "تست UT در «تست‌های غیرمخرب در پایپینگ»؛ ۷۳ در برابر ۲۹۷۱"),
    "ndt-rt": ("kc-ndt", "تست RT در «تست‌های غیرمخرب در پایپینگ»؛ ۷۸ در برابر ۲۹۷۱"),
    "ut": ("kc-ndt", "تست UT لوله در «تست‌های غیرمخرب در پایپینگ»؛ ۸۲ در برابر ۲۹۷۱"),
    "en-10204": ("kc-a106-mill-test-certificate-verification", "انواع گواهی 2.1/2.2/3.1/3.2 در صفحهٔ راستی‌آزمایی MTC"),
    "iso-9001": ("kc-technical-certifications-supplier-qualification", "صفحهٔ مبدأ عملاً خالی بود (۰ کاراکتر یکتا)"),
    "third-party-inspection-guide": ("kc-supplier-qualification-assessment", "بازرسی شخص ثالث در «ارزیابی صلاحیت تامین‌کننده»"),

    # --- تامین و بازرگانی ---
    "incoterms-2024": ("kc-incoterms-2024", "هر دو «اینکوترمز ۲۰۲۴»؛ ۸۱ در برابر ۳۱۱۸"),
    "industrial-customs-clearance-guide": ("kc-customs-clearance", "هر دو «ترخیص گمرکی»؛ ۳۵۹ در برابر ۲۸۹۲"),
    "shutdown": ("shutdown-turnaround-industrial-guide", "هر دو «تجهیزات Shutdown/اورهال»؛ ۷۱ در برابر ۳۷۱"),
}


# ---------------------------------------------------------------------------
# ابزارهای کمکی
# ---------------------------------------------------------------------------
def blocks(path):
    """بلوک‌های متنیِ ناحیهٔ محتوای صفحه."""
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", s)
    m = re.search(r"(?is)<(?:main|article)\b.*?</(?:main|article)>", s)
    body = m.group(0) if m else s
    body = re.sub(r"(?is)<(nav|footer|header)\b.*?</\1>", " ", body)
    out = []
    for t in re.findall(r"(?is)<(p|li|h2|h3|td|th)\b[^>]*>(.*?)</\1>", body):
        txt = html.unescape(re.sub(r"<[^>]+>", " ", t[1]))
        txt = re.sub(r"\s+", " ", txt).strip()
        if len(txt) > 25:
            out.append(txt)
    return out


def unique_chars():
    """طولِ متنِ یکتای هر صفحه (پس از حذفِ پاراگراف‌هایی که در ≥۵ صفحه آمده‌اند)."""
    docs, df = {}, collections.Counter()
    for f in sorted(glob.glob(os.path.join(ROOT, KC, "*.html"))):
        slug = os.path.basename(f)[:-5]
        b = blocks(f)
        docs[slug] = b
        for t in set(b):
            df[t] += 1
    return {sl: len(" ".join(t for t in b if df[t] <= 5)) for sl, b in docs.items()}


def esc(slug):
    return re.escape(slug)


def main():
    apply = "--apply" in sys.argv
    uniq = unique_chars()

    print("=" * 96)
    print("بررسی نقشهٔ ادغام — %d ریدایرکت پیشنهادی" % len(CONSOLIDATE))
    print("=" * 96)

    problems = []
    for src, (dst, why) in CONSOLIDATE.items():
        psrc = os.path.join(ROOT, KC, src + ".html")
        pdst = os.path.join(ROOT, KC, dst + ".html")
        if not os.path.exists(psrc):
            problems.append("مبدأ وجود ندارد: %s" % src)
            continue
        if not os.path.exists(pdst):
            problems.append("مقصد وجود ندارد: %s -> %s" % (src, dst))
            continue
        if uniq.get(dst, 0) < uniq.get(src, 0):
            problems.append("مقصد از مبدأ کم‌محتواتر است: %s(%d) -> %s(%d)"
                            % (src, uniq.get(src, 0), dst, uniq.get(dst, 0)))
    if problems:
        print("\n⚠️  مسدود شد — خطاها:")
        for p in problems:
            print("   •", p)
        return 1

    print("\n%-42s %7s  %-42s %7s" % ("مبدأ (پوسته)", "یکتا", "مقصد", "یکتا"))
    print("-" * 96)
    for src, (dst, why) in sorted(CONSOLIDATE.items(), key=lambda kv: -uniq.get(kv[0], 0)):
        print("%-42s %7d  %-42s %7d" % (src, uniq.get(src, 0), dst, uniq.get(dst, 0)))
    print("-" * 96)
    print("جمع: %d پوسته ← %d مقصد" % (len(CONSOLIDATE), len(set(v[0] for v in CONSOLIDATE.values()))))

    if not apply:
        print("\n(پیش‌نمایش — برای اجرا --apply بزنید)")
        return 0

    # ۱) RewriteRuleها
    ht = os.path.join(ROOT, ".htaccess")
    s = open(ht, encoding="utf-8").read()
    anchor = "RewriteRule ^knowledge-center/nace-mr0175\\.html$ /knowledge-center/nace-mr0175-sour-service-guide.html [R=301,L]\n"
    if anchor not in s:
        print("⚠️  نقطهٔ اتکا در .htaccess پیدا نشد؛ قوانین در انتهای فایل افزوده می‌شوند.")
        anchor = None

    new_rules = []
    for src, (dst, why) in CONSOLIDATE.items():
        rule = "RewriteRule ^%s/%s\\.html$ /%s/%s.html [R=301,L]" % (KC, esc(src), KC, dst)
        if rule in s:
            continue
        new_rules.append(rule)

    if new_rules:
        block = (
            "\n# SEO-2026-08-31 (KC-CONSOLIDATION): %d پوستهٔ مرکز دانش که برای یک موضوع،\n"
            "# چند URL داشتیم. پوسته‌ها فقط خزش را هدر می‌دادند و با صفحهٔ اصلیِ همان\n"
            "# موضوع رقابت می‌کردند. هر جفت با مقایسهٔ «متن یکتا» (پس از حذفِ قالبِ مشترک)\n"
            "# تأیید شده و مقصد همیشه پر محتواتر است. فایلی حذف نشده است.\n"
            "# ------------------------------------------------------------------\n" % len(new_rules)
        ) + "\n".join(new_rules) + "\n"
        if anchor:
            s = s.replace(anchor, anchor + block, 1)
        else:
            s = s.rstrip("\n") + "\n" + block
        open(ht, "w", encoding="utf-8").write(s)
    print("\n✅ %d قانون ۳۰۱ به .htaccess افزوده شد (جمع قوانین: %d)"
          % (len(new_rules), s.count("RewriteRule")))

    # ۲) لینک‌های داخلی
    link_fixes = 0
    link_files = 0
    for f in glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True):
        try:
            t = open(f, encoding="utf-8").read()
        except Exception:
            continue
        orig = t
        for src, (dst, why) in CONSOLIDATE.items():
            # فقط ارجاع‌های داخل/هم‌سطح به knowledge-center
            for pat in (
                r'"(?:|(?:\.\./|/))%s/%s\.html"' % (KC, esc(src)),
                r"'(?:|(?:\.\./|/))%s/%s\.html'" % (KC, esc(src)),
            ):
                rep_pat = re.compile(r'(href=")([^"]*?%s/%s\.html)(")' % (KC, esc(src)))
                t, n = rep_pat.subn(lambda m: m.group(1) + m.group(2).replace(src + ".html", dst + ".html") + m.group(3), t)
                link_fixes += n
        if t != orig:
            open(f, "w", encoding="utf-8").write(t)
            link_files += 1
    print("✅ %d لینک داخلی در %d فایل به مقصدِ جدید تغییر یافت" % (link_fixes, link_files))

    # ۳) نقشهٔ سایت
    sm = os.path.join(ROOT, "sitemap-knowledge-center.xml")
    if os.path.exists(sm):
        x = open(sm, encoding="utf-8").read()
        before = x.count("<loc>")
        for src, (dst, why) in CONSOLIDATE.items():
            x = re.sub(r"\s*<url>\s*<loc>[^<]*?/%s/%s\.html</loc>.*?</url>" % (KC, esc(src)), "", x, flags=re.S)
        open(sm, "w", encoding="utf-8").write(x)
        print("✅ نقشهٔ سایت: %d → %d آدرس (%d حذف شد)" % (before, x.count("<loc>"), before - x.count("<loc>")))

    # ۴) گزارش
    rep = os.path.join(ROOT, "_audit", "KC-CONSOLIDATION-APPLIED-2026-08-31.md")
    os.makedirs(os.path.dirname(rep), exist_ok=True)
    with open(rep, "w", encoding="utf-8") as fh:
        fh.write("# ادغامِ صفحاتِ تکراری مرکز دانش — ۲۰۲۶-۰۸-۳۱\n\n")
        fh.write("روش: حذفِ قالبِ مشترک با بسامدِ پاراگراف (≥۵ صفحه) و سنجشِ «متن یکتا»؛ "
                 "سپس تأییدِ دستیِ تک‌تکِ جفت‌ها با خواندنِ متن.\n\n")
        fh.write("هیچ فایلی حذف نشده؛ مبدأها با ۳۰۱ به مقصدِ پر محتواتر می‌روند.\n\n")
        fh.write("| پوسته (مبدأ) | یکتا | مقصد | یکتا | دلیل |\n|---|---|---|---|---|\n")
        for src, (dst, why) in sorted(CONSOLIDATE.items(), key=lambda kv: -uniq.get(kv[0], 0)):
            fh.write("| `%s` | %d | `%s` | %d | %s |\n"
                     % (src, uniq.get(src, 0), dst, uniq.get(dst, 0), why))
    print("✅ گزارش: %s" % os.path.relpath(rep, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
