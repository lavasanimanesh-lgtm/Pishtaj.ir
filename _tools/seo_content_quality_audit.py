#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Produce a non-destructive SEO content quality audit for product and brand pages.
This tool does not edit content. It identifies risks that must be handled before more mass production.
"""
from pathlib import Path
import re, collections, csv, json

OUT_MD = Path('_audit/SEO-CONTENT-QUALITY-AUDIT-CURRENT.md')
OUT_CSV = Path('_audit/SEO-CONTENT-QUALITY-AUDIT-CURRENT.csv')
LONG_MIN = 160

def visible_text(s: str) -> str:
    s = re.sub(r'<(script|style)[\s\S]*?</\1>', ' ', s, flags=re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def word_count(s: str) -> int:
    return len(re.findall(r'[\wآ-ی]+', visible_text(s)))

def title_of(path: Path, s: str) -> str:
    m = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.I|re.S)
    if m:
        return visible_text(m.group(1))
    m = re.search(r'<title[^>]*>(.*?)</title>', s, re.I|re.S)
    return visible_text(m.group(1)).split('|')[0].strip() if m else path.stem

def long_paragraphs(s: str):
    for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', s, re.I|re.S):
        t = visible_text(m.group(1))
        if len(t) >= LONG_MIN:
            yield t

def first_img_size(page: Path, s: str):
    m = re.search(r'<img\b[^>]*src=["\']([^"\']+)["\']', s, re.I|re.S)
    if not m:
        return '', ''
    src = m.group(1)
    if src.startswith(('http:', 'https:', 'data:', '//')):
        return src, ''
    p = (page.parent / src).resolve()
    try:
        rel = p.relative_to(Path('.').resolve())
    except Exception:
        return src, ''
    if rel.exists():
        return str(rel), rel.stat().st_size // 1024
    return str(rel), 'missing'

def analyze_group(label, paths):
    rows=[]
    para_map=collections.defaultdict(list)
    per_page_paras={}
    for p in paths:
        s=p.read_text(encoding='utf-8', errors='ignore')
        paras=list(long_paragraphs(s))
        per_page_paras[str(p)] = paras
        for para in set(paras):
            para_map[para].append(str(p))
    dup_pages_by_file=collections.defaultdict(int)
    for para, files in para_map.items():
        if len(files) > 1:
            for f in files:
                dup_pages_by_file[f] += 1
    for p in paths:
        s=p.read_text(encoding='utf-8', errors='ignore')
        paras=per_page_paras[str(p)]
        repeated_inside=sum(1 for _,c in collections.Counter(paras).items() if c>1)
        img, kb = first_img_size(p,s)
        wc=word_count(s)
        risk=[]
        if wc < 1500: risk.append('UNDER_1500_CRITICAL')
        elif wc < 1800: risk.append('LOW_DEPTH_REVIEW')
        if repeated_inside: risk.append('REPEATED_PARAGRAPH_INSIDE')
        if dup_pages_by_file[str(p)]: risk.append('DUPLICATE_PARAGRAPH_ACROSS_PAGES')
        if kb == 'missing': risk.append('IMAGE_MISSING')
        elif isinstance(kb,int) and kb > 250: risk.append('IMAGE_HEAVY')
        rows.append({
            'type': label,
            'path': str(p),
            'title': title_of(p,s),
            'words': wc,
            'long_paragraphs': len(paras),
            'repeated_inside_count': repeated_inside,
            'duplicate_across_count': dup_pages_by_file[str(p)],
            'hero_image': img,
            'hero_image_kb': kb,
            'risk': '|'.join(risk) if risk else 'OK'
        })
    return rows

products=sorted(p for p in Path('services/products').glob('*.html') if p.name!='index.html')
brands=sorted(p for p in Path('brands').glob('*.html') if p.name!='index.html')
rows=analyze_group('product', products)+analyze_group('brand', brands)
OUT_CSV.parent.mkdir(exist_ok=True)
with OUT_CSV.open('w', encoding='utf-8', newline='') as f:
    w=csv.DictWriter(f, fieldnames=['type','path','title','words','long_paragraphs','repeated_inside_count','duplicate_across_count','hero_image','hero_image_kb','risk'])
    w.writeheader(); w.writerows(rows)
summary=collections.Counter()
for r in rows:
    for item in r['risk'].split('|'):
        summary[item]+=1
priority=[r for r in rows if r['risk']!='OK']
priority.sort(key=lambda r: (0 if 'UNDER_1500_CRITICAL' in r['risk'] else 1 if 'REPEATED_PARAGRAPH_INSIDE' in r['risk'] else 2 if 'DUPLICATE_PARAGRAPH_ACROSS_PAGES' in r['risk'] else 3, int(r['words'])))
md=[]
md.append('# ممیزی کیفیت محتوای صفحات محصول و برند\n')
md.append('**ماهیت:** گزارش غیرتخریبی؛ هیچ محتوایی را تغییر نمی‌دهد.  \\n**هدف:** جلوگیری از ادامه تولید انبوه بدون کنترل کیفیت و شناسایی صفحات نیازمند بازنویسی عمیق.\n')
md.append('## خلاصه عددی\n')
md.append(f'- صفحات محصول بررسی‌شده: {len(products)}')
md.append(f'- صفحات برند بررسی‌شده: {len(brands)}')
for k,v in summary.most_common():
    md.append(f'- {k}: {v}')
md.append('\n## اولویت‌های اصلاح\n')
md.append('| اولویت | نوع | صفحه | کلمات | ریسک |')
md.append('|---:|---|---|---:|---|')
for i,r in enumerate(priority[:80],1):
    md.append(f"| {i} | {r['type']} | `{r['path']}` | {r['words']} | {r['risk']} |")
md.append('\n## قواعد اجرایی پیشنهادی\n')
md.append('1. قبل از تولید صفحه جدید، صفحات دارای `UNDER_1500_CRITICAL` باید اصلاح شوند.')
md.append('2. صفحات دارای پاراگراف تکراری باید بازنویسی دستی/نیمه‌دستی شوند؛ جایگزینی مکانیکی کافی نیست.')
md.append('3. برای هر فاز بعدی، این گزارش باید دوباره تولید شود و تعداد ریسک‌ها نباید افزایش یابد.')
md.append('4. تولید انبوه صفحه بدون تحقیق واقعی برند/استاندارد/تصویر متوقف شود مگر کیفیت هر صفحه با این چک عبور کند.')
OUT_MD.write_text('\n'.join(md)+'\n', encoding='utf-8')
print(f'wrote {OUT_MD} and {OUT_CSV}')
print(f'products={len(products)} brands={len(brands)} risky={len(priority)}')
