#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام B2 سئو — پاس ۱: متادیتای تراکنشی (2026-08-20) — idempotent.
یافتهٔ ممیزی: واژهٔ «قیمت» (پرحجم‌ترین modifier تراکنشی فارسی B2B) فقط در ۱ صفحه از
۵۶۶ صفحهٔ پول‌ساز/دانشی در title/description بود؛ «استعلام» در products/suppliers/brands صفر.
مشروعیت: «قیمت» در بدنهٔ ۴۴۹/۴۴۹ صفحهٔ KC و اکثر products واقعاً بحث شده است.
این پاس فقط metadata را غنی می‌کند؛ محتوا و JSON-LD دست نمی‌خورد."""
import re, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TODAY = '2026-08-20'
changed = []

KC_TAIL_OLD = 'نکات انتخاب فنی و خرید برای پروژه\u200cهای صنعتی و EPC.'
KC_TAIL_NEW = 'نکات انتخاب فنی، قیمت و مسیر استعلام برای پروژه\u200cهای صنعتی و EPC.'

APPEND = {
    'kc': '؛ همراه نکات قیمت و مسیر استعلام.',
    'products': '؛ استعلام قیمت آنلاین و پیش\u200cفاکتور.',
    'suppliers': '؛ اعلام قیمت رقابتی با ثبت استعلام.',
    'brands': '؛ بررسی قیمت و تامین از شبکه جهانی.',
}

def get_desc(s):
    m = re.search(r'(<meta name="description" content=")([^"]*)(")', s)
    return m

def patch_desc(path, cluster):
    s = open(path, encoding='utf-8', errors='ignore').read()
    m = get_desc(s)
    if not m: return False
    d = m.group(2)
    add = APPEND[cluster]
    if add in d or (cluster == 'kc' and d.endswith(KC_TAIL_NEW)):
        return False  # قبلاً همین پاس اعمال شده (idempotent)
    if 'قیمت' in d and 'استعلام' in d:
        return False  # از قبل غنی است
    if cluster == 'kc' and 'قیمت' in d:
        return False
    if cluster == 'kc' and d.endswith(KC_TAIL_OLD):
        nd = d[:-len(KC_TAIL_OLD)] + KC_TAIL_NEW
    else:
        nd = (d[:-1] if d.endswith('.') else d) + add
    if nd == d: return False
    ns = s[:m.start(2)] + nd + s[m.end(2):]
    open(path, 'w', encoding='utf-8').write(ns)
    changed.append(path)
    return True

def patch_kc_title(path):
    """«راهنمای کامل X | برند» → «راهنمای کامل X؛ مشخصات و قیمت | برند» (با گارد طول)"""
    s = open(path, encoding='utf-8', errors='ignore').read()
    m = re.search(r'<title>(راهنمای کامل [^|<]{3,60}?)(\s*\|\s*پیشرو تجهیز فرتاک</title>)', s)
    if not m: return False
    core = m.group(1).rstrip()
    if 'قیمت' in core or len(core) > 52: return False
    ns = s[:m.start(1)] + core + '؛ مشخصات و قیمت' + s[m.end(1):]
    # H1 هماهنگ نمی‌شود — تایتل سرچ و H1 صفحه لازم نیست یکسان باشند
    open(path, 'w', encoding='utf-8').write(ns)
    if path not in changed: changed.append(path)
    return True

def main():
    stats = {}
    for cluster, pat in [('kc', 'knowledge-center/*.html'), ('products', 'services/products/*.html'),
                         ('suppliers', 'suppliers/*.html'), ('brands', 'brands/*.html')]:
        n = 0
        for p in sorted(glob.glob(pat)):
            if os.path.basename(p) == 'index.html': continue
            if patch_desc(p, cluster): n += 1
            if cluster == 'kc': patch_kc_title(p)
        stats[cluster] = n
    # lastmod سایت‌مپ برای صفحات تغییرکرده
    urls = set()
    for p in changed:
        u = 'https://pishtaj.ir/' + (p[:-len('index.html')] if p.endswith('/index.html') else p)
        urls.add(u)
    for sm in glob.glob('sitemap-*.xml'):
        s = open(sm, encoding='utf-8').read(); orig = s
        def rep(mm):
            return mm.group(1) + TODAY + mm.group(3) if mm.group(0) else mm.group(0)
        s = re.sub(r'(<loc>(' + '|'.join(re.escape(u) for u in sorted(urls)) + r')</loc><lastmod>)([^<]+)(</lastmod>)',
                   lambda mm: mm.group(1) + TODAY + mm.group(4), s) if urls else s
        if s != orig:
            open(sm, 'w', encoding='utf-8').write(s)
            print('sitemap touched:', os.path.basename(sm))
    print('descriptions غنی‌شده:', stats)
    print('کل فایل‌های تغییرکرده:', len(changed))

if __name__ == '__main__':
    main()
