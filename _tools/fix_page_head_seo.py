#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_page_head_seo.py — رفعِ نقص‌های فنیِ head در صفحاتِ مشخص (OG/Twitter/h1/title)

خروجیِ `_tools/seo_health_scan.py` روی ۶۵۰ صفحهٔ عمومی نشان داد تنها ۱۱ صفحه نقصِ
فنی دارند (بقیهٔ پرچم‌ها محتوایی است). این ابزار همان ۱۱ مورد را رفع می‌کند.

اصل‌های ایمنی
------------
1. **فقط افزودن:** تگی که وجود دارد هرگز بازنویسی یا حذف نمی‌شود؛ ابزار فقط تگِ
   مفقود را اضافه می‌کند (به‌همین دلیل اجرای دوباره بی‌اثر است).
2. **نگهبانِ موجودیِ head:** پیش و پس از تغییر، تعدادِ عناصرِ حساس شمرده می‌شود
   (canonical/hreflang/og/twitter/ldjson/title/desc/h1). اگر هرکدام *کم* شود،
   آن فایل نوشته نمی‌شود و خطا گزارش می‌گردد.
3. **الگوی محدودشده:** جایگزینی‌ها با الگوهایی انجام می‌شود که از مرزِ تگ فراتر
   نمی‌روند (`[^<]*` برای title/h1) — همان درسی که از باگِ `.*?(">)` گرفته شد.
4. **هیچ حدسی زده نمی‌شود:** متنِ جایگزینِ هر صفحه صریحاً در جدولِ زیر آمده و
   ابزار پیش از جایگزینی بررسی می‌کند که مقدارِ فعلی دقیقاً همان چیزی است که انتظار
   دارد؛ در غیر این صورت آن مورد را رد می‌کند.

اجرا:  python3 _tools/fix_page_head_seo.py [--apply]
"""
import os
import re
import sys
import html as H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://pishtaj.ir"
OG_IMAGE = SITE + "/assets/images/ptf-logo.png"
SITE_NAME = "پیشرو تجهیز فرتاک"

# ---------------------------------------------------------------------------
# مشخصاتِ هر صفحه: h1/titleِ جایگزین (فقط اگر مقدارِ فعلی همان «انتظار» باشد)
# ---------------------------------------------------------------------------
SPEC = {
    "careers/index.html": dict(
        og_type="website",
        h1_expect="فرصت شغلی",
        h1_new="فرصت‌های شغلی پیشرو تجهیز فرتاک",
    ),
    "search/index.html": dict(
        og_type="website",
        h1_expect="جستجوی سایت",
        h1_new="جستجو در مرکز دانش، محصولات و مقایسه‌های فنی پیشرو تجهیز فرتاک",
    ),
    "sitemap.html": dict(
        og_type="website",
        h1_expect="نقشه سایت",
        h1_new="نقشهٔ کامل صفحات سایت پیشرو تجهیز فرتاک",
        title_expect="نقشه سایت | پیشرو تجهیز فرتاک",
        title_new="نقشهٔ سایت پیشرو تجهیز فرتاک | دسترسی به همهٔ صفحات",
        ldjson=True,
    ),
    "comparisons/index.html": dict(og_type="website"),
    "404.html": dict(
        og_type="website",
        desc_new="صفحهٔ درخواستی یافت نشد. از نقشهٔ سایت یا جستجو به بخشِ تامین تجهیزات، "
                 "مرکز دانش فنی یا مقایسه‌های تخصصی پیشرو تجهیز فرتاک بروید.",
        # عمداً canonical ندارد: صفحهٔ ۴۰۴ نباید خودش را نشانهٔ معتبر معرفی کند.
    ),
    # شش صفحهٔ کنترل‌ولو: فقط OG ناقص است (og:title و og:description را دارند)
    "knowledge-center/control-valve-actuator-selection-guide.html": dict(og_type="article"),
    "knowledge-center/control-valve-cavitation-guide.html": dict(og_type="article"),
    "knowledge-center/control-valve-cv-calculation-guide.html": dict(og_type="article"),
    "knowledge-center/control-valve-cv-kv-difference.html": dict(og_type="article"),
    "knowledge-center/gas-control-valve-sizing-guide.html": dict(og_type="article"),
    "knowledge-center/steam-control-valve-sizing-guide.html": dict(og_type="article"),
}

LDJSON_WEBPAGE = (
    '<script type="application/ld+json">{"@context":"https://schema.org",'
    '"@type":"WebPage","name":"%s","url":"%s","inLanguage":"fa-IR",'
    '"isPartOf":{"@type":"WebSite","name":"%s","url":"%s"}}</script>'
)


def head_inventory(t):
    head = t.split("</head>")[0] if "</head>" in t else t[:8000]
    return {
        "canonical": len(re.findall(r'rel="canonical"', head)),
        "hreflang": len(re.findall(r'rel="alternate"', head)),
        "og": len(re.findall(r'property="og:', head)),
        "og_image": len(re.findall(r'property="og:image"', head)),
        "og_url": len(re.findall(r'property="og:url"', head)),
        "og_type": len(re.findall(r'property="og:type"', head)),
        "og_title": len(re.findall(r'property="og:title"', head)),
        "og_desc": len(re.findall(r'property="og:description"', head)),
        "twitter": len(re.findall(r'name="twitter:', head)),
        "ldjson": len(re.findall(r'<script\s+type="application/ld\+json"', head)),
        "title": len(re.findall(r"<title>", head)),
        "desc": len(re.findall(r'name="description"', head)),
        "h1": len(re.findall(r"(?i)<h1[\s>]", t)),
    }


def esc(s, quote=True):
    return H.escape(s, quote=quote)


def main():
    apply = "--apply" in sys.argv
    report = []
    problems = []

    for rel, spec in SPEC.items():
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            problems.append("فایل پیدا نشد: %s" % rel)
            continue
        t = open(path, encoding="utf-8").read()
        orig = t
        before = head_inventory(t)
        added = []

        url = spec.get("url")
        if not url:
            c = re.search(r'rel="canonical"\s+href="([^"]+)"', t)
            url = c.group(1) if c else SITE + "/" + rel.replace("index.html", "")

        m_title = re.search(r"(?is)<title>(.*?)</title>", t)
        title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m_title.group(1))).strip() if m_title else rel
        m_desc = re.search(r'name="description"\s+content="([^"]*)"', t)
        desc = m_desc.group(1) if m_desc else spec.get("desc_new", "")

        # --- 1) توضیح (فقط اگر ندارد و مقدارِ جایگزین تعریف شده) -----------------
        if before["desc"] == 0 and spec.get("desc_new"):
            t = re.sub(r"(</title>)",
                       lambda m: m.group(1) + '\n<meta name="description" content="%s" />'
                       % esc(spec["desc_new"]), t, count=1)
            added.append("description")
            desc = spec["desc_new"]

        # --- 2) عنوان (فقط با تطبیقِ مقدارِ فعلی) -------------------------------
        if spec.get("title_expect"):
            if title == spec["title_expect"]:
                t = re.sub(r"(<title>)[^<]*(</title>)",
                           lambda m: m.group(1) + esc(spec["title_new"], quote=False) + m.group(2),
                           t, count=1)
                added.append("title")
                title = spec["title_new"]
            else:
                problems.append("%s: عنوانِ فعلی با انتظار مطابقت نکرد (%s)" % (rel, title[:40]))

        # --- 3) h1 (فقط با تطبیقِ متنِ فعلی) -----------------------------------
        if spec.get("h1_expect"):
            m = re.search(r"(?is)(<h1[^>]*>)([^<]*)(</h1>)", t)
            if m and re.sub(r"\s+", " ", m.group(2)).strip() == spec["h1_expect"]:
                t = t[:m.start()] + m.group(1) + esc(spec["h1_new"], quote=False) + m.group(3) + t[m.end():]
                added.append("h1")
            else:
                problems.append("%s: h1 فعلی با انتظار مطابقت نکرد" % rel)

        # --- 4) OG -------------------------------------------------------------
        og_adds = []
        if before["og_title"] == 0:
            og_adds.append(('og:title', title))
        if before["og_desc"] == 0:
            og_adds.append(('og:description', desc))
        if before["og_type"] == 0:
            og_adds.append(('og:type', spec.get("og_type", "website")))
        if before["og_url"] == 0:
            og_adds.append(('og:url', url))
        if before["og_image"] == 0:
            og_adds.append(('og:image', OG_IMAGE))
        head_part = t.split("</head>")[0]
        if 'property="og:locale"' not in head_part:
            og_adds.insert(0, ('og:locale', 'fa_IR'))
        if 'property="og:site_name"' not in head_part:
            og_adds.insert(1, ('og:site_name', SITE_NAME))
        if og_adds:
            block = "\n".join('<meta property="%s" content="%s" />' % (k, esc(v)) for k, v in og_adds)
            t = t.replace("</head>", block + "\n</head>", 1)
            added.append("og(%d)" % len(og_adds))

        # --- 5) Twitter card ---------------------------------------------------
        if before["twitter"] == 0:
            block = "\n".join([
                '<meta name="twitter:card" content="summary" />',
                '<meta name="twitter:title" content="%s" />' % esc(title),
                '<meta name="twitter:description" content="%s" />' % esc(desc),
                '<meta name="twitter:image" content="%s" />' % esc(OG_IMAGE),
            ])
            t = t.replace("</head>", block + "\n</head>", 1)
            added.append("twitter(4)")

        # --- 6) JSON-LD --------------------------------------------------------
        if spec.get("ldjson") and before["ldjson"] == 0:
            t = t.replace("</head>",
                          LDJSON_WEBPAGE % (esc(title), esc(url), esc(SITE_NAME), esc(SITE))
                          + "\n</head>", 1)
            added.append("ldjson")

        # --- نگهبان: هیچ عنصری نباید کم شود -----------------------------------
        after = head_inventory(t)
        lost = {k: (before[k], after[k]) for k in before if after[k] < before[k]}
        if lost:
            problems.append("%s: افتِ عنصر در head → %s (نوشته نشد)" % (rel, lost))
            continue

        report.append((rel, added, {k: (before[k], after[k]) for k in ("og", "twitter", "ldjson", "h1", "desc")
                                    if before[k] != after[k]}))
        if t != orig and apply:
            open(path, "w", encoding="utf-8").write(t)

    print("%-58s %s" % ("فایل", "افزوده شد"))
    for rel, added, delta in report:
        print("%-58s %s" % (rel, ", ".join(added) or "—"))
    print("-" * 78)
    print("صفحاتِ پردازش‌شده: %d | تغییر: %d" % (len(report), sum(1 for _, a, _ in report if a)))
    if problems:
        print("\n⚠️ مواردِ رد شده:")
        for p in problems:
            print("   •", p)
    if not apply:
        print("\n(پیش‌نمایش — برای اعمال، --apply بزنید)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
