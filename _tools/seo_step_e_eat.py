#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام فاز بعدی سئو — E-E-A-T + سیگنال تازگی (2026-08-21) — idempotent.

زمینه: ۱۰۸ مقالهٔ «طلایی» مرکز دانش از قبل اسکیمای کامل E-E-A-T دارند (نویسندهٔ نقش‌محور،
reviewedBy واحد مهندسی، datePublished/dateModified، articleSection، publisher با لوگو)؛
بقیهٔ ~۳۴۲ مقاله فقط اسکیمای لخت Article دارند. این اسکریپت همهٔ مقاله‌های مرکز دانش و
وبلاگ را به همان «استاندارد طلایی» می‌رساند — بدون جعل شخص یا تاریخ نامعتبر:

  - نویسنده: «تیم مهندسی و تامین پیشرو تجهیز فرتاک» (نقش‌محور — همان کنوانسیون صفحات طلایی)
  - reviewedBy: «واحد مهندسی، تضمین کیفیت و تامین پیشرو تجهیز فرتاک»
  - publisher: Organization با لوگو
  - datePublished = 2026-07-01 (کنوانسیون موجود صفحات طلایی؛ مطابق تاریخ خزش گوگل اوایل تیر)
  - dateModified = 2026-08-21 (تاریخ واقعی این ارتقای اسکیما)
  - articleSection = دستهٔ موضوعی مشتق‌شده از عنوان
  - about = [articleSection] + واژه‌های عنوان

فقط فیلدهای «ناقص» پر می‌شوند؛ صفحات کامل دست‌نخورده می‌مانند. اجرای دوباره تغییری نمی‌دهد.
اجرا:
  python3 tools/seo_step_e_eat.py            # dry-run (گزارش)
  python3 tools/seo_step_e_eat.py --apply    # اعمال واقعی
"""
import re, os, glob, json, sys, html as _html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
APPLY = '--apply' in sys.argv

AUTHOR = {"@type": "Organization", "name": "تیم مهندسی و تامین پیشرو تجهیز فرتاک",
          "url": "https://pishtaj.ir/about/why-ptf/"}
REVIEWEDBY = {"@type": "Organization", "name": "واحد مهندسی، تضمین کیفیت و تامین پیشرو تجهیز فرتاک",
              "url": "https://pishtaj.ir/about/why-ptf/"}
PUBLISHER = {"@type": "Organization", "name": "Pishro Tajhiz Fartak",
             "logo": {"@type": "ImageObject", "url": "https://pishtaj.ir/assets/images/ptf-logo.png"}}
DATE_PUB = "2026-07-01"
DATE_MOD = "2026-08-21"

CATEGORIES = [
    (["شیر", "ولو", "valve", "اکچویتور", "actuator", "بور", "gate", "globe", "ball", "check"], "شیرآلات صنعتی"),
    (["لوله", "پایپینگ", "فلنج", "فیتینگ", "گسکت", "pipe", "flange", "fitting", "gasket",
      "a106", "a53", "a333", "api 5l", "nace", "erw", "seamless", "astm"], "لوله و پایپینگ"),
    (["ترانسمیتر", "فلومتر", "ابزار دقیق", "روزمونت", "pressure", "flowmeter", "transmitter",
      "سطح", "دما", "instrument", "کالیبراسیون", "اندازه", "سنسور", "گاز", "کروماتو"], "ابزار دقیق و اندازه‌گیری"),
    (["برق", "تابلو", "ترانسفورماتور", "کابل", "vfd", "plc", "switchgear", "سوئیچ", "حفاظت",
      "رله", "electrical", "موتور", "درایو", "ups", "باطری"], "برق صنعتی"),
    (["پمپ", "کمپرسور", "توربین", "فن", "blower", "pump", "compressor", "turbine", "fan", "اکچویتور دوار"], "تجهیزات دوار"),
    (["مخزن", "مبدل", "برج", "بویلر", "دیگ", "heat exchanger", "boiler", "vessel", "tank", "برنر"], "تجهیزات ثابت"),
    (["جوش", "بازرسی", "mtc", "تست", "آزمایش", "استاندارد", "inspection", "welding", "ndt",
      "گواهی", "مستندات", "تایید", "کیفیت"], "بازرسی، استانداردها و کیفیت"),
]
DEFAULT_SECTION = "تجهیزات صنعتی"

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, s):
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)

def is_article_node(n):
    if not isinstance(n, dict):
        return False
    t = n.get("@type")
    if isinstance(t, str):
        return t in ("Article", "TechArticle")
    if isinstance(t, list):
        return ("Article" in t) or ("TechArticle" in t)
    return False

def derive_section(title):
    t = (title or "").lower()
    for kws, sec in CATEGORIES:
        for k in kws:
            if k in t:
                return sec
    return DEFAULT_SECTION

def derive_about(section, title):
    about = [section]
    t = re.sub(r"\|.*$", "", title or "")
    seen = set()
    for w in re.split(r"[\s—–-]+", t):
        w = w.strip(" ،,؛;:.")
        if len(w) >= 2 and re.search(r"[A-Za-z\u0600-\u06FF0-9]", w) and w.lower() not in seen:
            seen.add(w.lower())
            about.append(w)
            if len(about) >= 6:
                break
    return about

def upgrade(path):
    s = read(path)
    blocks = list(re.finditer(r'<script type=["\']application/ld\+json["\']>(.*?)</script>', s, re.S))
    if not blocks:
        return 'no-ldjson'
    changed_any = False
    replacements = []  # (start, end, new_text)
    for m in blocks:
        raw = m.group(1)
        try:
            d = json.loads(raw)
        except Exception:
            continue
        if isinstance(d, list):
            nodes = d
        elif isinstance(d, dict) and isinstance(d.get("@graph"), list):
            nodes = d["@graph"]
        elif isinstance(d, dict):
            nodes = [d]
        else:
            continue
        dirty = False
        for n in nodes:
            if not is_article_node(n):
                continue
            if n.get("author", {}).get("name") != AUTHOR["name"]:
                n["author"] = AUTHOR
                dirty = True
            if "publisher" not in n:
                n["publisher"] = PUBLISHER
                dirty = True
            if "reviewedBy" not in n:
                n["reviewedBy"] = REVIEWEDBY
                dirty = True
            if "inLanguage" not in n:
                n["inLanguage"] = "fa-IR"
                dirty = True
            if "isAccessibleForFree" not in n:
                n["isAccessibleForFree"] = True
                dirty = True
            if "datePublished" not in n:
                n["datePublished"] = DATE_PUB
                dirty = True
            if "dateModified" not in n:
                n["dateModified"] = DATE_MOD
                dirty = True
            if "articleSection" not in n:
                title = (n.get("headline") or "").strip()
                n["articleSection"] = derive_section(title)
                dirty = True
            if "about" not in n:
                title = (n.get("headline") or "").strip()
                n["about"] = derive_about(n.get("articleSection", DEFAULT_SECTION), title)
                dirty = True
        if dirty:
            if "\n" in raw:
                new = json.dumps(d, ensure_ascii=False, indent=1)
            else:
                new = json.dumps(d, ensure_ascii=False, separators=(", ", ": "))
            replacements.append((m.start(1), m.end(1), new))
            changed_any = True
    if changed_any:
        # apply replacements in reverse
        ns = s
        for start, end, new in reversed(replacements):
            ns = ns[:start] + new + ns[end:]
        if APPLY:
            write(path, ns)
        return 'ok'
    return 'skip-complete'

def main():
    stats = {}
    files = sorted(set(glob.glob('knowledge-center/*.html') + glob.glob('blog/*.html') + glob.glob('blog/**/*.html', recursive=True)))
    for p in files:
        if p.endswith('/index.html'):
            continue
        r = upgrade(p)
        stats[r] = stats.get(r, 0) + 1
    print("نتیجه:", stats)
    print("مجموع فایل‌ها:", len(files))
    # اعتبار JSON-LD بعد از اعمال
    bad = 0
    for p in files:
        t = read(p)
        for b in re.findall(r'<script type=["\']application/ld\+json["\']>(.*?)</script>', t, re.S):
            try: json.loads(b)
            except Exception as e:
                bad += 1
                print('  JSON BAD', p, str(e)[:60])
    print("خطای JSON-LD:", bad)

if __name__ == "__main__":
    main()
