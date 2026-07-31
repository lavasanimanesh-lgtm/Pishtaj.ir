#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🗺️  PTF Sitemap Builder — _tools/build_sitemap.py
=====================================================================
هدف: تولید sitemap.xml معتبر و استاندارد (بدون پیشوند ns0:) که با تمام
صفحات HTML عمومی سایت (به‌جز crm/, api/, ابزارهای داخلی) هم‌گام باشد.

چرا این اسکریپت لازم بود:
  نسخهٔ قبلی sitemap.xml با xml.etree.ElementTree بدون register_namespace
  ساخته/به‌روزرسانی می‌شد (در _tools/generate_2000_articles.py و
  _tools/kc-upgrade.py) که باعث تولید <ns0:urlset>/<ns0:loc> می‌شد —
  فرمتی که برخی کرالرها/اعتبارسنج‌ها به‌درستی پردازش نمی‌کنند.
  این اسکریپت با ساخت مستقیم XML (بدون ElementTree) این مشکل را کاملاً
  کنار می‌گذارد و یک‌بار برای همیشه namespace پیش‌فرض تضمین می‌شود.

قوانین:
  - فایل‌های با نام خراب (mojibake — شامل کاراکتر literal '#') در sitemap
    قرار نمی‌گیرند چون URL معتبر و قابل‌کرال نیستند (خودِ '#' در URL برای
    مرورگر/گوگل یعنی fragment، نه بخشی از مسیر).
  - crm/, api/, _tools/, _audit/, _human_test/, _personas/, ptf-snapshots/,
    docs/, docs-deploy/, service-photos/, ptf-all-photos/ از دامنهٔ سایت
    عمومی خارج‌اند و در sitemap نمی‌آیند.
  - lastmod برای URLهایی که از قبل در sitemap موجودند حفظ می‌شود (تا سیگنال
    «تازگی» بی‌جهت صفر نشود)؛ برای URLهای تازه، تاریخ امروز درج می‌شود.
  - priority بر اساس الگوی موجود پروژه (بخش‌بندی بر اساس مسیر) حفظ می‌شود.

اجرا:  python3 _tools/build_sitemap.py [--dry-run]
"""
import os
import re
import sys
import json
import datetime
import urllib.parse
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

DOMAIN = "https://pishtaj.ir"
SITEMAP_PATH = "sitemap.xml"

EXCLUDE_DIRS = {
    ".git", "crm", "api", "_tools", "_audit", "_human_test", "_personas",
    "ptf-snapshots", "docs", "docs-deploy", "service-photos", "ptf-all-photos",
    "node_modules",
}

TODAY = datetime.date.today().isoformat()

# اولویت پیش‌فرض بر اساس اولین بخش مسیر (همان الگوی قبلی پروژه، حفظ شده)
PRIORITY_BY_SEGMENT = {
    "": "1.0",
    "rfq": "0.9",
    "supplier": "0.9",
    "tracking": "0.9",
    "industries": "0.9",
    "services": "0.9",
    "knowledge-center": "0.9",
    "tools": "0.9",
}
DEFAULT_PRIORITY = "0.8"
# صفحات کمکی با اولویت پایین‌تر (فهرست صریح مسیرهای نسبی)
LOW_PRIORITY_PATHS = {
    "assistant/", "catalog/", "logistics/", "news/", "projects/", "quality/",
    "en/", "en/about.html", "en/projects.html", "en/services.html",
    "about/why-ptf/", "about/logo-philosophy/", "about/management-message/",
    "about/organizational-chart/",
}


def is_mojibake(name: str) -> bool:
    return "#" in name


def collect_html_files():
    files = []
    for dirpath, dirnames, filenames in os.walk("."):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        # exclude crm/api even if nested deeper (defense in depth)
        rel_dir = os.path.normpath(dirpath)
        parts = rel_dir.split(os.sep)
        if any(p in EXCLUDE_DIRS for p in parts):
            continue
        for f in filenames:
            if not f.endswith(".html"):
                continue
            if is_mojibake(f):
                continue
            full = os.path.normpath(os.path.join(dirpath, f))
            files.append(full)
    return sorted(files)


def to_url_path(rel_path: str) -> str:
    """تبدیل مسیر فایل به مسیر URL (پوشه‌ای برای index.html، انکود صحیح یونیکد)."""
    rel_path = rel_path[2:] if rel_path.startswith("./") else rel_path
    if rel_path == "index.html":
        return ""
    if rel_path.endswith("/index.html"):
        rel_path = rel_path[: -len("index.html")]
    # انکود هر بخش مسیر (برای اسلاگ‌های فارسی/غیرلاتین که واقعی و معتبرند،
    # نه mojibake). از urllib.parse.quote با تنظیمات پیش‌فرض استفاده می‌شود
    # (همان چیزی که _tools/audit.py برای بررسی هم‌گامی sitemap به کار می‌برد)
    # تا هیچ‌گاه بین این دو ابزار در نحوهٔ انکود کاراکترهای خاص (مثل ',') تفاوت نیفتد.
    parts = rel_path.split("/")
    encoded = "/".join(urllib.parse.quote(p) for p in parts)
    return encoded


def priority_for(url_path: str) -> str:
    if url_path in LOW_PRIORITY_PATHS:
        return "0.7"
    seg = url_path.split("/")[0] if url_path else ""
    return PRIORITY_BY_SEGMENT.get(seg, DEFAULT_PRIORITY)


def load_previous_lastmods():
    """می‌خواند sitemap.xml فعلی (حتی با پیشوند ns0:) را و lastmod موجود هر URL را استخراج می‌کند."""
    lookup = {}
    if not os.path.exists(SITEMAP_PATH):
        return lookup
    content = open(SITEMAP_PATH, encoding="utf-8", errors="ignore").read()
    # هم فرمت با ns0: و هم بدون آن را پشتیبانی کن
    pattern = re.compile(
        r"<(?:ns0:)?url>\s*<(?:ns0:)?loc>(.*?)</(?:ns0:)?loc>"
        r"(?:\s*<(?:ns0:)?lastmod>(.*?)</(?:ns0:)?lastmod>)?"
        r"(?:\s*<(?:ns0:)?priority>(.*?)</(?:ns0:)?priority>)?"
        r"\s*</(?:ns0:)?url>",
        re.S,
    )
    for m in pattern.finditer(content):
        loc, lastmod, _priority = m.groups()
        rel = loc.replace(DOMAIN + "/", "").replace(DOMAIN, "")
        rel_decoded = urllib.parse.unquote(rel)
        if lastmod:
            lookup[rel_decoded] = lastmod
    return lookup


def build_sitemap(dry_run: bool = False):
    files = collect_html_files()
    prev_lastmods = load_previous_lastmods()

    entries = []
    seen_urls = set()
    for f in files:
        url_path = to_url_path(f)
        url_path_decoded = urllib.parse.unquote(url_path)
        if url_path_decoded in seen_urls:
            continue  # احتیاط در برابر تکرار (نباید رخ دهد، ولی ایمنی اضافه)
        seen_urls.add(url_path_decoded)

        lastmod = prev_lastmods.get(url_path_decoded, TODAY)
        priority = priority_for(url_path_decoded)
        full_url = f"{DOMAIN}/{url_path}" if url_path else f"{DOMAIN}/"
        entries.append((full_url, lastmod, priority, url_path_decoded))

    # ترتیب پایدار: صفحهٔ اصلی اول، بعد بر اساس مسیر
    entries.sort(key=lambda e: (e[3] != "", e[3]))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for full_url, lastmod, priority, _ in entries:
        lines.append(
            f"  <url><loc>{escape(full_url)}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<priority>{priority}</priority></url>"
        )
    lines.append("</urlset>")
    output = "\n".join(lines) + "\n"

    if dry_run:
        print(output[:2000])
        print(f"... ({len(entries)} URL در مجموع)")
        return entries

    with open(SITEMAP_PATH, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(output)

    print(f"✅ sitemap.xml بازسازی شد — {len(entries)} URL (namespace پیش‌فرض، بدون ns0:)")
    return entries


if __name__ == "__main__":
    build_sitemap(dry_run="--dry-run" in sys.argv)
