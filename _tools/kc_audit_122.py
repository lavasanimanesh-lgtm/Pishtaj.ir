# -*- coding: utf-8 -*-
"""ممیزی ۱۲۲ مقاله بازنویسی‌شده مرکز دانش مطابق اصول گوگل سرچ کنسول."""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KC = os.path.join(ROOT, 'knowledge-center')

# ── لیست ۱۲۲ اسلاگ ──
rows = list(csv.reader(open('_audit/KC-REWRITE-PLAN-2026-09-02.csv', encoding='utf-8-sig')))
slugs = []
for r in rows[1:]:
    if len(r) > 5 and r[0].isdigit() and int(r[0]) <= 122:
        slugs.append(r[1].replace('.html', ''))
assert len(slugs) == 122, len(slugs)

AR_KAF, AR_YEH = '\u0643', '\u064A'

def strip_tags(h):
    return re.sub(r'<[^>]+>', ' ', h)

def resolve(base_dir, href):
    href = href.split('#')[0].split('?')[0]
    if href.startswith('/'):
        p = os.path.normpath(ROOT + href)
    else:
        p = os.path.normpath(os.path.join(base_dir, href))
    return p

def audit(slug):
    path = os.path.join(KC, slug + '.html')
    res = {'slug': slug, 'issues': []}
    if not os.path.isfile(path):
        res['issues'].append('FILE MISSING')
        return res
    s = open(path, encoding='utf-8').read()
    res['bytes'] = len(s.encode('utf-8'))

    # ۱) تایتل
    m = re.search(r'<title>(.*?)</title>', s, re.S)
    title = strip_tags(m.group(1)).strip() if m else ''
    res['title_len'] = len(title)
    if not title: res['issues'].append('no title')
    elif len(title) < 30: res['issues'].append(f'title short {len(title)}')
    elif len(title) > 70: res['issues'].append(f'title long {len(title)}')

    # ۲) متا توضیحات
    m = re.search(r'<meta\s+name="description"\s+content="(.*?)"', s, re.S)
    desc = strip_tags(m.group(1)).strip() if m else ''
    res['desc_len'] = len(desc)
    if not desc: res['issues'].append('no meta description')
    elif len(desc) < 120: res['issues'].append(f'desc short {len(desc)}')
    elif len(desc) > 175: res['issues'].append(f'desc long {len(desc)}')

    # ۳) کنونیکال
    m = re.search(r'<link\s+rel="canonical"\s+href="(.*?)"', s)
    canon = m.group(1) if m else ''
    expected = f'https://pishtaj.ir/knowledge-center/{slug}.html'
    res['canonical_ok'] = canon == expected
    if not res['canonical_ok']: res['issues'].append(f'canonical mismatch: {canon}')

    # ۴) رباتز
    if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', s):
        res['issues'].append('noindex!')

    # ۵) H1
    h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    res['h1_count'] = len(h1s)
    h1 = strip_tags(h1s[0]).strip() if h1s else ''
    res['h1_len'] = len(h1)
    if len(h1s) != 1: res['issues'].append(f'h1 count {len(h1s)}')
    elif not h1: res['issues'].append('h1 empty')

    # ۶) اسکیمای JSON-LD
    ld_ok = False
    ld_fields = []
    for mld in re.findall(r'<script\s+type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            data = json.loads(mld)
        except Exception:
            res['issues'].append('JSON-LD parse error'); continue
        graphs = data.get('@graph', [data]) if isinstance(data, dict) else data
        art = None
        for g in graphs:
            t = g.get('@type')
            tl = t if isinstance(t, list) else [t]
            if any(x in ('Article', 'TechArticle', 'BlogPosting') for x in tl):
                art = g; break
        if art:
            ld_ok = True
            for f in ('headline', 'description', 'image', 'datePublished', 'dateModified', 'author', 'mainEntityOfPage'):
                if f not in art: ld_fields.append(f)
            if 'publisher' not in art: ld_fields.append('publisher')
            hm = art.get('headline', '')
            if hm and hm != title and hm not in title and title not in hm:
                pass  # تفاوت هدلاین اسکیمایی و تایتل مشکلی نیست
    res['schema_ok'] = ld_ok and not ld_fields
    if not ld_ok: res['issues'].append('no Article schema')
    elif ld_fields: res['issues'].append('schema missing: ' + ','.join(ld_fields))

    # ۷) Open Graph / Twitter
    for tag in ('og:title', 'og:description', 'og:image', 'og:url'):
        if f'property="{tag}"' not in s: res['issues'].append(f'missing {tag}')
    res['twitter_card'] = 'twitter:card' in s

    # ۸) طول متن (بدنه)
    body = re.sub(r'<script.*?</script>', ' ', s, flags=re.S)
    body = re.sub(r'<style.*?</style>', ' ', body, flags=re.S)
    mm = re.search(r'<main.*?</main>', body, re.S) or re.search(r'<article.*?</article>', body, re.S)
    seg = mm.group(0) if mm else body
    seg = re.sub(r'<(header|nav|footer).*?</\1>', ' ', seg, flags=re.S)
    txt = strip_tags(seg)
    words = txt.split()
    res['words'] = len(words)
    # سنجه اصلی = معیار مولد: ریشه‌های فارسی در کل صفحه منهای اسکریپت/استایل
    full = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    full = strip_tags(full)
    if len(words) < 1000: res['issues'].append(f'words {len(words)}')

    # ۹) تصاویر
    imgs = re.findall(r'<img\s+([^>]*)>', s)
    miss_img = 0
    for attrs in imgs:
        sm = re.search(r'src="([^"]+)"', attrs)
        if not sm: continue
        src = sm.group(1)
        if src.startswith('data:'): continue
        p = resolve(KC, src)
        if not os.path.isfile(p):
            miss_img += 1; continue
        if os.path.getsize(p) > 204800:
            res['issues'].append(f'image >200KB: {src}')
        am = re.search(r'alt="([^"]*)"', attrs)
        if not am or not am.group(1).strip():
            res['issues'].append(f'img no alt: {src}')
    if miss_img: res['issues'].append(f'{miss_img} img src missing')
    res['img_count'] = len(imgs)

    # ۱۰) لینک‌های خروجی داخلی
    hrefs = re.findall(r'href="([^"]+)"', s)
    internal, broken = 0, []
    for h in hrefs:
        if h.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')): continue
        p = resolve(KC, h)
        if h.endswith('/') and os.path.isdir(p): continue
        if os.path.isfile(p) or os.path.isdir(p):
            internal += 1
        else:
            broken.append(h)
    res['internal_links'] = internal
    res['broken_links'] = broken
    if broken: res['issues'].append('broken: ' + ' , '.join(broken[:5]))

    # ۱۲) حروف عربی در فیلدهای کلیدی
    blob = title + ' ' + desc + ' ' + h1
    if AR_KAF in blob or AR_YEH in blob:
        res['issues'].append('arabic kaf/yeh in title/desc/h1')

    # ذخیره برای بررسی تکرار
    res['_title'] = title; res['_desc'] = desc
    return res

def main():
    # لینک‌های ورودی: شمای ساده از کل ریپو برای شمارش
    inbound = {sl: 0 for sl in slugs}
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '_audit', '_tools', 'crm', 'api')]
        for f in files:
            if not f.endswith('.html'): continue
            fp = os.path.join(root, f)
            try: txt = open(fp, encoding='utf-8', errors='ignore').read()
            except Exception: continue
            for sl in slugs:
                if sl + '.html' in txt and os.path.basename(fp) != sl + '.html':
                    inbound[sl] += txt.count(sl + '.html')

    results = [audit(sl) for sl in slugs]

    # تکرار تایتل/توضیح
    from collections import Counter
    tc = Counter(r['_title'] for r in results)
    dc = Counter(r['_desc'] for r in results)
    for r in results:
        if tc[r['_title']] > 1: r['issues'].append('dup title')
        if dc[r['_desc']] > 1: r['issues'].append('dup desc')

    # سایت‌مپ
    sm = open('sitemap-knowledge-center.xml', encoding='utf-8').read()
    for r in results:
        if f'/{r["slug"]}.html</loc>' not in sm:
            r['issues'].append('not in sitemap')

    bad = [r for r in results if r['issues']]
    print(f'=== ممیزی {len(results)} مقاله ===')
    print(f'بدون مشکل: {len(results)-len(bad)} | دارای مشکل: {len(bad)}')
    print()
    wl = [r['words'] for r in results]
    tl = [r['title_len'] for r in results]
    dl = [r['desc_len'] for r in results]
    il = [r['internal_links'] for r in results]
    ib = [inbound[r['slug']] for r in results]
    print(f'کلمات بدنه (واقعی): کمینه {min(wl)} / میانگین {sum(wl)//len(wl)} / بیشینه {max(wl)}')
    under = sum(1 for r in results if r['words'] < 1000)
    print(f'زیر ۱۰۰۰ کلمه واقعی: {under} صفحه')
    print(f'تایتل: کمینه {min(tl)} / بیشینه {max(tl)}')
    print(f'توضیح: کمینه {min(dl)} / بیشینه {max(dl)}')
    print(f'لینک داخلی خروجی: کمینه {min(il)} / بیشینه {max(il)}')
    print(f'ارجاع ورودی در ریپو: کمینه {min(ib)} / بیشینه {max(ib)}')
    zero_ib = [r['slug'] for r in results if inbound[r['slug']] == 0]
    low_ib = [(r['slug'], inbound[r['slug']]) for r in results if 0 < inbound[r['slug']] <= 1]
    if zero_ib: print('بدون هیچ لینک ورودی:', zero_ib)
    if low_ib: print('ورودی کم (۱):', low_ib[:20])
    print()
    for r in bad:
        print(f"❌ {r['slug']}: {'; '.join(r['issues'])}")
    if not bad: print('✅ هیچ مشکلی پیدا نشد.')

if __name__ == '__main__':
    main()
