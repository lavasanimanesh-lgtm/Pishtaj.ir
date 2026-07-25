#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔍 PTF Code Auditor — دستیار ممیز خودکار کد pishtaj.ir
اجرا:  python3 _tools/audit.py   (از ریشه پروژه)
بعد از هر اسپرینت باید اجرا شود و همه بخش‌ها PASS باشند.
"""
import os, re, sys, json, subprocess
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SKIP_DIRS = {'_drafts', '_tools', '.git'}
ERRORS, WARNINGS = [], []

def pages():
    for dp, ds, fs in os.walk('.'):
        ds[:] = [d for d in ds if d not in SKIP_DIRS]
        for f in fs:
            if f.endswith('.html'):
                yield os.path.join(dp, f)

def read(p):
    return open(p, encoding='utf-8', errors='ignore').read()

# ---------- 1. لینک‌ها و ارجاعات شکسته ----------
def check_links():
    broken = []
    for p in pages():
        html = re.sub(r'<script.*?</script>', '', read(p), flags=re.S)
        for m in re.findall(r'(?:href|src)="([^"#?]+)"', html):
            if m.startswith(('http', 'mailto:', 'tel:', 'javascript:', 'data:', '//')):
                continue
            t = os.path.join('.', m.lstrip('/')) if m.startswith('/') else \
                os.path.normpath(os.path.join(os.path.dirname(p), m))
            if t.endswith('/'): t += 'index.html'
            if os.path.isdir(t): t = os.path.join(t, 'index.html')
            if not os.path.exists(t):
                broken.append((m, p))
    if broken:
        ERRORS.append(f"لینک شکسته: {len(broken)} مورد — نمونه: {broken[:5]}")
    return len(broken)

# ---------- 2. سینتکس جاوااسکریپت (node --check) ----------
def check_js():
    bad = []
    tmp = '/tmp/_audit_js'
    os.makedirs(tmp, exist_ok=True)
    n = 0
    for p in pages():
        for i, s in enumerate(re.findall(r'<script>(.*?)</script>', read(p), flags=re.S)):
            if not s.strip(): continue
            n += 1
            fp = f'{tmp}/chunk.js'
            open(fp, 'w').write(s)
            r = subprocess.run(['node', '--check', fp], capture_output=True, text=True)
            if r.returncode != 0:
                bad.append((p, i, r.stderr.strip().splitlines()[-1][:120]))
    for f in [f for f in os.listdir('assets/js') if f.endswith('.js')] if os.path.isdir('assets/js') else []:
        r = subprocess.run(['node', '--check', f'assets/js/{f}'], capture_output=True, text=True)
        if r.returncode != 0:
            bad.append((f'assets/js/{f}', '-', r.stderr.strip().splitlines()[-1][:120]))
    if bad:
        ERRORS.append(f"خطای سینتکس JS: {len(bad)} — {bad[:3]}")
    return n

# ---------- 3. اعتبار XML (sitemap) و JSON ----------
def check_xml_json():
    import xml.dom.minidom
    try:
        xml.dom.minidom.parse('sitemap.xml')
    except Exception as e:
        ERRORS.append(f"sitemap.xml نامعتبر: {e}")
    for jf in ['site.webmanifest']:
        if os.path.exists(jf):
            try: json.load(open(jf))
            except Exception as e: ERRORS.append(f"{jf} نامعتبر: {e}")
    # JSON-LD در صفحات اصلی
    for p in ['index.html', 'en/index.html']:
        if not os.path.exists(p): continue
        for s in re.findall(r'<script type="application/ld\+json">(.*?)</script>', read(p), flags=re.S):
            try: json.loads(s)
            except Exception as e: ERRORS.append(f"JSON-LD خراب در {p}: {str(e)[:80]}")

# ---------- 4. sitemap هم‌گام با دیسک ----------
def check_sitemap_sync():
    sm = read('sitemap.xml')
    sm_urls = set(re.findall(r'<loc>https://pishtaj\.ir/([^<]*)</loc>', sm))
    import urllib.parse
    missing = []
    for p in pages():
        rel = p[2:].replace(os.sep, '/')
        if rel.split('/')[0] in ('crm', 'api'): continue
        url = rel[:-10] if rel.endswith('index.html') else rel
        enc = '/'.join(urllib.parse.quote(s) for s in url.split('/'))
        if url not in sm_urls and enc not in sm_urls:
            missing.append(url)
    if missing:
        WARNINGS.append(f"صفحات خارج از sitemap: {len(missing)} — {missing[:5]}")

# ---------- 5. سئوی پایه هر صفحه ----------
def check_seo():
    no_title, no_desc, no_favicon, dup_titles = [], [], [], Counter()
    for p in pages():
        h = read(p)
        rel = p[2:]
        if rel.startswith(('crm/', 'api/')): continue
        t = re.search(r'<title>([^<]*)</title>', h)
        if not t or not t.group(1).strip(): no_title.append(rel)
        else: dup_titles[t.group(1).strip()] += 1
        if not re.search(r'<meta name="description"', h): no_desc.append(rel)
        if 'rel="icon"' not in h: no_favicon.append(rel)
    if no_title: ERRORS.append(f"بدون <title>: {len(no_title)} — {no_title[:3]}")
    if no_desc: WARNINGS.append(f"بدون meta description: {len(no_desc)} — {no_desc[:5]}")
    if no_favicon: WARNINGS.append(f"بدون favicon: {len(no_favicon)} — {no_favicon[:5]}")
    dups = {k: v for k, v in dup_titles.items() if v > 1}
    if dups: WARNINGS.append(f"عنوان تکراری: {len(dups)} گروه — {list(dups.items())[:3]}")

# ---------- 6. امنیت ----------
def check_security():
    pat = re.compile(r"(?:PASS|PASSWORD|SECRET|API_KEY)\s*=\s*['\"][^'\"]{4,}['\"]", re.I)
    hits = []
    for p in pages():
        for m in pat.findall(read(p)):
            if 'HASH' not in m.upper():
                hits.append((p, m[:60]))
    if hits: ERRORS.append(f"احتمال رمز/کلید متن ساده در سورس: {hits[:3]}")
    if os.path.exists('api/crm.php'):
        php = read('api/crm.php')
        if re.search(r"\$_(GET|POST)\[[^\]]+\]\s*\.", php) and 'hash_hmac' not in php:
            WARNINGS.append("api/crm.php: بررسی دستی تزریق/احراز هویت لازم است")

# ---------- 7. محتوای ناقص (thin content) ----------
def check_thin():
    thin = []
    for d in ('knowledge-center', 'blog'):
        if not os.path.isdir(d): continue
        for f in os.listdir(d):
            if not f.endswith('.html') or f == 'index.html': continue
            body = re.sub(r'<script.*?</script>|<style.*?</style>', '', read(f'{d}/{f}'), flags=re.S)
            w = len(re.sub(r'<[^>]+>', ' ', body).split())
            if w < 800: thin.append((f'{d}/{f}', w))
    if thin: WARNINGS.append(f"مقاله زیر ۸۰۰ کلمه در بخش منتشر شده: {len(thin)} — {thin[:5]}")

# ---------- 8. موتور کدگذاری واحد - منع کدگذار موازی ----------
def check_codegen():
    # فقط codegen.js مجاز به داشتن Math.random برای TMP است
    forbidden_patterns = [
        r"function genCode\(p\)\s*\{\s*return p\s*\+.*Math\.random\(\)\s*\*\s*90000",
        r"function genCode\(p\)\s*\{\s*return p\s*\+.*Math\.floor\(10000",
    ]
    hits=[]
    for root, dirs, files in os.walk('crm'):
        for f in files:
            if not f.endswith('.js'): continue
            if f in ('codegen.js','xlsx.min.js'): continue  # خود موتور و کتابخانه مجاز
            path=os.path.join(root,f)
            try:
                content=open(path, encoding='utf-8', errors='ignore').read()
            except:
                continue
            for pat in forbidden_patterns:
                if re.search(pat, content):
                    hits.append((path, pat))
    if hits:
        ERRORS.append(f"کدگذار موازی ممنوع - باید از ptfUnifiedCode استفاده شود: {hits[:5]} - راهنما: docs/CODEGEN.md")
    # چک وجود فایل‌های موتور
    if not os.path.exists('api/codegen.php'):
        ERRORS.append("موتور سروری codegen.php یافت نشد - api/codegen.php الزامی است")
    if not os.path.exists('crm/codegen.js'):
        ERRORS.append("موتور کلاینتی codegen.js یافت نشد - crm/codegen.js الزامی است")

# ---------- 9. تصاویر ----------
def check_release_docs():
    """INC-2026-001: نسخه‌های v31.7.3 تا v31.7.7 بدون RELEASE-NOTES منتشر شدند و
    زنجیره مستندات قطع شد. این گیت وجود مستندات انتشار منطبق با window.VER را الزامی می‌کند."""
    idx = read(os.path.join(ROOT, 'crm', 'index.html'))
    m = re.search(r"window\.VER = 'v([0-9.]+)'", idx)
    if not m:
        ERRORS.append('release-docs: window.VER در crm/index.html پیدا نشد')
        return
    ver = m.group(1)
    sw = read(os.path.join(ROOT, 'crm', 'sw.js'))
    if ('ptf-crm-v' + ver) not in sw:
        ERRORS.append(f'release-docs: کش sw.js با window.VER (v{ver}) همگام نیست')
    for doc in (f'RELEASE-NOTES-v{ver}.md', f'REGRESSION-REPORT-v{ver}.md'):
        if not os.path.exists(os.path.join(ROOT, doc)):
            ERRORS.append(f'release-docs: سند الزامی انتشار موجود نیست: {doc}')

def check_images():
    heavy, missing_alt = [], 0
    for dp, ds, fs in os.walk('assets/images'):
        for f in fs:
            p = os.path.join(dp, f)
            kb = os.path.getsize(p) // 1024
            if kb > 350: heavy.append((p, f'{kb}KB'))
    for p in pages():
        missing_alt += len(re.findall(r'<img(?![^>]*alt=)[^>]*>', read(p)))
    if heavy: WARNINGS.append(f"تصویر سنگین‌تر از 350KB: {heavy[:5]}")
    if missing_alt: WARNINGS.append(f"تگ img بدون alt: {missing_alt} مورد")

# ---------- اجرا ----------
if __name__ == '__main__':
    n_pages = len(list(pages()))
    print(f"🔍 PTF Auditor — بررسی {n_pages} صفحه...")
    print("  [1/8] لینک‌ها...");        check_links()
    print("  [2/8] سینتکس JS...");      check_js()
    print("  [3/8] XML/JSON...");       check_xml_json()
    print("  [4/8] sitemap sync...");   check_sitemap_sync()
    print("  [5/8] سئو پایه...");       check_seo()
    print("  [6/8] امنیت...");          check_security()
    print("  [7/8] محتوای ناقص...");    check_thin()
    print("  [8/8] موتور کدگذاری...");  check_codegen()
    print("  [9/9] تصاویر...");         check_images()
    print("  [10/10] مستندات انتشار..."); check_release_docs()
    print()
    if ERRORS:
        print(f"❌ {len(ERRORS)} خطا:")
        for e in ERRORS: print("   •", e)
    if WARNINGS:
        print(f"⚠️  {len(WARNINGS)} هشدار:")
        for w in WARNINGS: print("   •", w)
    if not ERRORS and not WARNINGS:
        print("✅ همه بررسی‌ها PASS شدند.")
    sys.exit(1 if ERRORS else 0)
