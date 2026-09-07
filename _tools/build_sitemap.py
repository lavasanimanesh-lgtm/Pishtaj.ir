#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🗺️  PTF Sitemap Builder — _tools/build_sitemap.py
=====================================================================
هدف: تولید نقشهٔ سایتِ تکه‌تکه (sitemap-index.xml + ۷ زیرنقشه) هم‌گام با
صفحات HTML عمومی سایت، با lastmod واقعی.

چرا نسخهٔ قبلی عوض شد (۲۰۲۶-۰۸-۳۱):
  ۱) ساختارِ اشتباه. نسخهٔ قبلی یک sitemap.xml تک‌فایل می‌خواند و می‌نوشت،
     در حالی که سایت sitemap-index.xml + sitemap-{blog,core,en,industries,
     knowledge-center,misc,services}.xml دارد. اجرای آن یک فایلِ یتیم می‌ساخت
     که هیچ‌جا ارجاع نشده بود و ۷ نقشهٔ واقعی دست‌نخورده می‌ماندند.
  ۲) lastmod یا کهنگی داشت یا جهش می‌کرد. منطقِ قبلی
     `prev_lastmods.get(url, TODAY)` بود؛ چون sitemap.xml وجود نداشت،
     prev_lastmods همیشه خالی بود و اجرای ابزار به هر ۶۰۹ URL تاریخِ امروز
     می‌زد — سیگنالی که گوگل یاد می‌گیرد نادیده بگیرد.
  ۳) صفحاتِ ۳۰۱‌شده استثنا نبودند. ۴۶ صفحه هنوز فایل‌اند ولی در .htaccess
     به مقصدِ ادغام ۳۰۱ می‌شوند؛ افزودنشان به نقشه یعنی فرستادنِ گوگل به
     صفحه‌ای که redirect می‌دهد.

راه‌حلِ lastmod:
  دیپلوی `**/.git*` را exclude می‌کند، پس سرور تاریخچهٔ git ندارد و نمی‌توان
  lastmod را در زمانِ اجرا از git گرفت. بنابراین git فقط اینجا (در مخزن)
  خوانده می‌شود و نتیجه در `_tools/sitemap-lastmod.json` کامیت می‌شود؛ هر
  مصرف‌کنندهٔ سمتِ سرور از همان manifest + mtime می‌خواند.

قوانین:
  - فایل‌های با نام خراب (mojibake — شامل کاراکتر literal '#') در sitemap
    قرار نمی‌گیرند چون URL معتبر و قابل‌کرال نیستند.
  - crm/, api/, _tools/, _audit/, _human_test/, _personas/, ptf-snapshots/,
    docs/, docs-deploy/, service-photos/, ptf-all-photos/ از دامنهٔ سایت
    عمومی خارج‌اند و در sitemap نمی‌آیند.
  - صفحاتی که در .htaccess قاعدهٔ R=301 دارند در sitemap نمی‌آیند.
  - priority بر اساس الگوی موجود پروژه حفظ می‌شود.

اجرا:
  python3 _tools/build_sitemap.py [--dry-run]     # بازسازیِ نقشه‌ها + manifest
  python3 _tools/build_sitemap.py --manifest-only # فقط به‌روزرسانیِ manifest
"""
import os
import re
import sys
import json
import datetime
import subprocess
import urllib.parse
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

DOMAIN = "https://pishtaj.ir"
SITEMAP_INDEX = "sitemap-index.xml"
MANIFEST_PATH = os.path.join("_tools", "sitemap-lastmod.json")

EXCLUDE_DIRS = {
    ".git", "crm", "api", "_tools", "_audit", "_human_test", "_personas",
    "ptf-snapshots", "docs", "docs-deploy", "service-photos", "ptf-all-photos",
    "node_modules",
}

TODAY = datetime.date.today().isoformat()

# نگاشتِ بخشِ نخستِ مسیر → زیرنقشه. باید با sitemap_file_for() در api/cms.php
# یکی بماند، وگرنه صفحه‌ای که از CRM ساخته می‌شود در نقشهٔ دیگری می‌نشیند.
SUBMAP_BY_SEGMENT = {
    "blog": "sitemap-blog.xml",
    "knowledge-center": "sitemap-knowledge-center.xml",
    "industries": "sitemap-industries.xml",
    "services": "sitemap-services.xml",
    "en": "sitemap-en.xml",
    "about": "sitemap-core.xml",
    "products": "sitemap-products.xml",
}
ROOT_SUBMAP = "sitemap-core.xml"      # صفحهٔ اصلی و فایل‌های ریشه
DEFAULT_SUBMAP = "sitemap-misc.xml"   # suppliers، brands، comparisons، tools، careers، news و…

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
    "products": "0.9",
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


# فایل‌هایی که هرگز در نقشه نمی‌آیند. sitemap.html نمایِ HTML خودِ نقشه است
# (همان استثنایی که api/cms.php هم دارد) و 404.html صفحهٔ خطاست.
NEVER_IN_SITEMAP = {"sitemap.html", "404.html"}


def is_noindex(path: str) -> bool:
    """صفحه‌ای که robots: noindex دارد خودش به گوگل گفته ایندکسم نکن؛
    گذاشتنش در نقشه پیامِ متناقض می‌فرستد و در گزارشِ پوشش خطا می‌سازد."""
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            head = fh.read(40000)
    except OSError:
        return False
    m = re.search(r'(?is)<meta\s+name=["\']robots["\']\s+content=["\']([^"\']*)["\']', head)
    return bool(m) and "noindex" in m.group(1).lower()


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


def redirected_pages():
    """مسیرهای نسبیِ صفحاتی که در .htaccess قاعدهٔ R=301 دارند.

    این صفحات هنوز فایل‌اند (سیاستِ پروژه: هیچ صفحه‌ای حذف نمی‌شود) ولی به
    مقصدِ ادغام redirect می‌شوند؛ پس نباید در نقشه باشند.
    """
    out = set()
    if not os.path.isfile(".htaccess"):
        return out
    txt = open(".htaccess", encoding="utf-8", errors="ignore").read()
    pat = re.compile(r"(?m)^RewriteRule\s+\^([^\s]+)\$\s+(\S+)\s+\[([^\]]*)\]")
    for m in pat.finditer(txt):
        src, _tgt, flags = m.group(1), m.group(2), m.group(3)
        if "R=301" not in flags:
            continue
        # قواعدِ htaccess خطِ تیره و نقطه را escape می‌کنند: a106\-gr\-b
        p = src.replace("\\-", "-").replace("\\.", ".")
        if p.endswith(".html"):
            out.add(p)
    return out


def to_url_path(rel_path: str) -> str:
    """تبدیل مسیر فایل به مسیر URL (پوشه‌ای برای index.html، انکود صحیح یونیکد)."""
    rel_path = rel_path[2:] if rel_path.startswith("./") else rel_path
    if rel_path == "index.html":
        return ""
    if rel_path.endswith("/index.html"):
        rel_path = rel_path[: -len("index.html")]
    parts = rel_path.split("/")
    encoded = "/".join(urllib.parse.quote(p) for p in parts)
    return encoded


def submap_for(url_path: str) -> str:
    """همان منطقِ sitemap_file_for() در api/cms.php — یکی نگاهشان دارید."""
    if url_path == "":
        return ROOT_SUBMAP
    seg = url_path.split("/")[0]
    return SUBMAP_BY_SEGMENT.get(seg, DEFAULT_SUBMAP)


def priority_for(url_path: str) -> str:
    if url_path in LOW_PRIORITY_PATHS:
        return "0.7"
    seg = url_path.split("/")[0] if url_path else ""
    return PRIORITY_BY_SEGMENT.get(seg, DEFAULT_PRIORITY)


def git_is_shallow():
    """کلونِ shallow تاریخچهٔ واقعی ندارد؛ lastmod یکسان و بی‌معنی می‌شود."""
    try:
        r = subprocess.run(["git", "rev-parse", "--is-shallow-repository"],
                           capture_output=True, text=True, timeout=30, cwd=ROOT)
        return r.returncode == 0 and r.stdout.strip() == "true"
    except Exception:
        return False


def git_lastmod_map():
    """{مسیر_نسبی: تاریخِ آخرین کامیت} از یک فراخوانیِ git.

    git log از تازه‌ترین به قدیمی‌ترین پیمایش می‌شود؛ نخستین باری که یک فایل
    دیده می‌شود همان آخرین تغییرش است. اگر git نبود (کلونِ shallowِ خراب یا
    اجرای سمتِ سرور) دیکشنریِ خالی برمی‌گردد و فراخوان به mtime می‌افتد.
    """
    if git_is_shallow():
        # بدونِ این هشدار، manifest بی‌صدا یکسان نوشته می‌شود و lastmod
        # سیگنالِ تازگی را از بین می‌برد (دقیقاً همان باگی که رفع کردیم).
        raise RuntimeError(
            "کلون shallow است — تاریخچهٔ واقعی در دسترس نیست. "
            "پیش از اجرا: git fetch --unshallow origin"
        )
    try:
        out = subprocess.run(
            ["git", "log", "--name-only", "--pretty=format:@%as"],
            capture_output=True, text=True, timeout=300, cwd=ROOT,
        )
    except Exception as e:
        print("هشدار: git در دسترس نبود (%s) — lastmod از mtime گرفته می‌شود" % e)
        return {}
    if out.returncode != 0:
        print("هشدار: git log شکست خورد — lastmod از mtime گرفته می‌شود")
        return {}
    res, cur = {}, None
    for line in out.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("@"):
            cur = line[1:]
            continue
        if cur and line not in res:
            res[line] = cur
    return res


def mtime_date(rel_path: str) -> str:
    try:
        return datetime.date.fromtimestamp(os.path.getmtime(rel_path)).isoformat()
    except OSError:
        return TODAY


def build_manifest():
    g = git_lastmod_map()
    manifest = {}
    for rel in collect_html_files():
        key = rel[2:] if rel.startswith("./") else rel
        manifest[key] = g.get(key) or mtime_date(rel)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=0, sort_keys=True)
        fh.write("\n")
    return manifest


def load_manifest():
    if not os.path.isfile(MANIFEST_PATH):
        return {}
    try:
        return json.load(open(MANIFEST_PATH, encoding="utf-8"))
    except Exception:
        return {}


def render_urlset(entries):
    """entries: list of (loc, lastmod, priority)"""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod, priority in entries:
        lines.append("  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>"
                     % (escape(loc), lastmod, priority))
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def render_index(sub_lastmods):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for name in sorted(sub_lastmods):
        lines.append("  <sitemap><loc>%s/%s</loc><lastmod>%s</lastmod></sitemap>"
                     % (DOMAIN, name, sub_lastmods[name]))
    lines.append("</sitemapindex>")
    return "\n".join(lines) + "\n"


def build(dry_run: bool = False, manifest_only: bool = False):
    manifest = build_manifest()
    if manifest_only:
        print("✅ manifest نوشته شد: %s (%d ورودی)" % (MANIFEST_PATH, len(manifest)))
        return

    redir = redirected_pages()
    groups = {}
    seen = set()
    skipped_redirect = 0
    skipped_noindex = []
    for f in collect_html_files():
        rel = f[2:] if f.startswith("./") else f
        if rel in redir:
            skipped_redirect += 1
            continue
        if rel in NEVER_IN_SITEMAP or is_noindex(rel):
            skipped_noindex.append(rel)
            continue
        url_path = to_url_path(rel)
        if url_path in seen:
            continue
        seen.add(url_path)
        lastmod = manifest.get(rel) or mtime_date(rel)
        loc = "%s/%s" % (DOMAIN, url_path) if url_path else DOMAIN + "/"
        groups.setdefault(submap_for(url_path), []).append(
            (loc, lastmod, priority_for(url_path))
        )

    sub_lastmods = {}
    total = 0
    for name, entries in sorted(groups.items()):
        # صفحهٔ اصلی اول (False < True)، بعد بقیه بر اساسِ آدرس
        entries.sort(key=lambda e: (e[0] != DOMAIN + "/", e[0]))
        sub_lastmods[name] = max(e[1] for e in entries)
        total += len(entries)
        if dry_run:
            print("  [dry-run] %-32s %4d URL  lastmod=%s" % (name, len(entries), sub_lastmods[name]))
        else:
            with open(name, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(render_urlset(entries))

    if dry_run:
        print("  [dry-run] %-32s %4d زیرنقشه" % (SITEMAP_INDEX, len(sub_lastmods)))
    else:
        with open(SITEMAP_INDEX, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(render_index(sub_lastmods))

    print("✅ نقشهٔ سایت بازسازی شد")
    print("   زیرنقشه‌ها: %d | کلِ URLها: %d" % (len(sub_lastmods), total))
    print("   صفحاتِ ۳۰۱‌شده که کنار گذاشته شدند: %d" % skipped_redirect)
    print("   صفحاتِ noindex/مستثنا که کنار گذاشته شدند: %d %s"
          % (len(skipped_noindex), skipped_noindex[:6]))
    print("   تازه‌ترین lastmod: %s" % (max(sub_lastmods.values()) if sub_lastmods else "—"))


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    if "--manifest-only" in sys.argv:
        build(manifest_only=True)
    else:
        build(dry_run=dry)
