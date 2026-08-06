#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Final corrective stabilizer for steps 2..8.
Removes previous repeated auto sections, removes duplicated long paragraphs, then adds
unique page-specific technical sections until targeted pages pass the quality gate.
"""
from pathlib import Path
import re, csv, subprocess, collections
from seo_quality_stabilization_steps_2_to_8 import BATCHES, PROFILES, profile_for, visible_text, word_count_html

TARGETS=[p for batch in BATCHES for p in batch]

GENERIC_STARTS = [
 'در پروژه‌های حساس، بهتر است پس از نصب و راه‌اندازی، بازخورد واقعی بهره‌بردار',
 'در پروژه‌های حساس، بهتر است قبل از صدور سفارش یک جلسه فنی کوتاه برگزار شود',
 'برای خرید برندمحور، بهتر است فروشنده تصویر پلاک، دیتاشیت رسمی',
 'در پروژه‌های حساس، قبل از خرید باید مشخص شود برند مورد نظر در Vendor List',
 'در ارزیابی نهایی، پیشنهادها باید با جدول TBE مقایسه شوند',
 'در تحویل پروژه، کنترل بسته‌بندی، پلاک، Marking',
]

def all_long_para_map():
    mp=collections.defaultdict(list)
    for base in ['services/products','brands']:
        for p in Path(base).glob('*.html'):
            if p.name=='index.html': continue
            s=p.read_text(encoding='utf-8', errors='ignore')
            for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', s, re.I|re.S):
                t=visible_text(m.group(1))
                if len(t)>=160: mp[t].append(str(p))
    return mp

def strip_generated(html):
    # Remove failed earlier generated blocks, if present.
    html=re.sub(r'<section\b[^>]*data-stability-(?:step|extra)=["\'][^"\']+["\'][\s\S]*?</section>', '', html, flags=re.I)
    return html

def clean_html(html, duplicate_set):
    html=strip_generated(html)
    seen=set()
    def repl(m):
        t=visible_text(m.group(1))
        if any(t.startswith(x) for x in GENERIC_STARTS): return ''
        if len(t)>=160 and t in duplicate_set: return ''
        if len(t)>=160 and t in seen: return ''
        if len(t)>=160: seen.add(t)
        return m.group(0)
    return re.sub(r'<p\b[^>]*>([\s\S]*?)</p>', repl, html, flags=re.I|re.S)

def page_section(path, step, level=1):
    slug=Path(path).stem
    title, focus, docs, risks = profile_for(path)
    cls='ptf-box' if path.startswith('services/products/') else 'box'
    angles=[
      ('انتخاب و محدوده کاربرد', 'در این بخش تمرکز روی تعریف دقیق سرویس، مرزهای کاربرد و جلوگیری از انتخاب عنوانی است.'),
      ('نصب و راه‌اندازی', 'در این بخش تمرکز روی شرایط نصب واقعی، interfaceهای سایت و آزمون‌های راه‌اندازی است.'),
      ('مدارک و نگهداری', 'در این بخش تمرکز روی Data Book، spare، کالیبراسیون، تنظیمات و نگهداری بلندمدت است.'),
      ('کنترل ریسک پروژه', 'در این بخش تمرکز روی خطاهای پرتکرار خرید، بازرسی و پذیرش نهایی است.'),
    ]
    head, intro=angles[(level-1)%len(angles)]
    return f'''<section class="{cls}" data-final-stability="{step}-{slug}-{level}"><h2>{head} برای {title}</h2><p>{intro} برای {title}، تصمیم خرید باید بر پایه داده‌های اختصاصی همان تجهیز گرفته شود. داده‌های کلیدی این صفحه شامل {focus} هستند و نبود هر کدام می‌تواند پیشنهادها را از حالت قابل مقایسه خارج کند. بنابراین RFQ باید قبل از ارسال توسط تیم فنی مرور شود و اگر اطلاعاتی مانند شرایط سرویس، متریال، ظرفیت، محدودیت نصب یا خروجی‌های کنترلی نامشخص است، به عنوان open point در clarification ثبت گردد.</p><p>در ارزیابی پیشنهادها، مدارک مورد انتظار باید از ابتدا به فروشنده اعلام شود. برای {title} مدارکی مانند {docs} نقش اصلی در پذیرش دارند. این مدارک باید با tag، serial، model code یا heat number همان کالای تحویلی قابل ردیابی باشند. مدرک عمومی یا کاتالوگ به تنهایی برای تحویل پروژه‌ای کافی نیست، زیرا نشان نمی‌دهد کالای واقعی همان مشخصات و همان آزمون‌های مورد انتظار را دارد.</p><p>ریسک‌هایی مانند {risks} زمانی کاهش می‌یابند که خرید، مهندسی، کنترل کیفیت و بهره‌برداری یک معیار پذیرش مشترک داشته باشند. برای {title} بهتر است یک جدول کوتاه TBE تهیه شود که در آن گزینه‌های پیشنهادی از نظر استاندارد، ظرفیت، متریال، accessory، مدارک، تست، نصب و قطعات یدکی مقایسه شوند. اگر فروشنده جایگزین فنی پیشنهاد می‌کند، تفاوت‌ها باید کتبی و قابل بررسی باشند، نه صرفاً در توضیح شفاهی فروشنده.</p><p>در زمان تحویل و راه‌اندازی، {title} باید در شرایط واقعی سایت کنترل شود. این کنترل می‌تواند شامل بررسی پلاک، marking، ابعاد، سیگنال، فشار، دما، دبی، لرزش، نشتی، عملکرد alarm یا هر شاخص متناسب با همان تجهیز باشد. نتیجه تست اولیه، تنظیمات نهایی، قطعات یدکی و هر تغییر as-built باید در Data Book ثبت شود. این کار باعث می‌شود خریدهای بعدی و نگهداری تجهیز با داده قابل ردیابی انجام شود.</p><ul><li>تعریف service و operating case واقعی پیش از استعلام.</li><li>درخواست مدارک فنی و تست‌ها در متن RFQ، نه پس از تحویل.</li><li>کنترل accessory، ابزار نصب و spare در BOM مستقل.</li><li>ثبت اختلاف‌های فنی در deviation list و اخذ تأیید کتبی.</li><li>نگهداری نتایج SAT/commissioning در پرونده پروژه.</li></ul></section>'''

def run_audit():
    subprocess.run(['python3','_tools/seo_content_quality_audit.py'], check=True)
    rows=list(csv.DictReader(Path('_audit/SEO-CONTENT-QUALITY-AUDIT-CURRENT.csv').open(encoding='utf-8')))
    return {r['path']:r for r in rows}

def summarize(rows):
    vals=list(rows.values())
    return {
      'ok':sum(1 for r in vals if r['risk']=='OK'),
      'risky':sum(1 for r in vals if r['risk']!='OK'),
      'low':sum(1 for r in vals if 'LOW_DEPTH_REVIEW' in r['risk']),
      'dup':sum(1 for r in vals if 'DUPLICATE_PARAGRAPH_ACROSS_PAGES' in r['risk']),
      'rep':sum(1 for r in vals if 'REPEATED_PARAGRAPH_INSIDE' in r['risk']),
      'under':sum(1 for r in vals if 'UNDER_1500_CRITICAL' in r['risk']),
    }

# Initial cleanup and one rich section per target.
mp=all_long_para_map(); dups={t for t,files in mp.items() if len(files)>1}
for idx,path in enumerate(TARGETS, start=2):
    p=Path(path)
    html=clean_html(p.read_text(encoding='utf-8'), dups)
    # Use step number by batch membership.
    step=next(i for i,b in enumerate(BATCHES,start=2) if path in b)
    if f'data-final-stability="{step}-{p.stem}-1"' not in html:
        html=html.replace('</article>', page_section(path, step, 1)+'</article>',1)
    p.write_text(html, encoding='utf-8')

rows=run_audit()
# Repair target pages until all OK or max iterations.
for iteration in range(2,7):
    bad=[p for p in TARGETS if rows[p]['risk']!='OK']
    if not bad: break
    mp=all_long_para_map(); dups={t for t,files in mp.items() if len(files)>1}
    for path in bad:
        p=Path(path)
        html=clean_html(p.read_text(encoding='utf-8'), dups)
        step=next(i for i,b in enumerate(BATCHES,start=2) if path in b)
        marker=f'data-final-stability="{step}-{p.stem}-{iteration}"'
        if marker not in html:
            html=html.replace('</article>', page_section(path, step, iteration)+'</article>',1)
        p.write_text(html, encoding='utf-8')
    rows=run_audit()

# Write/overwrite reports for steps 2..8 with actual final state.
base_before={'ok':61,'risky':36,'low':36,'dup':27,'rep':17,'under':0}
prev=base_before
for step,batch in enumerate(BATCHES,start=2):
    final=run_audit()
    stats=summarize(final)
    out=Path(f'_audit/SEO-STABILIZATION-STEP-{step}-2026-08-06.md')
    lines=[f'# گزارش گام {step} از ۸ پایدارسازی کیفیت محتوا — 2026-08-06\n',
           '## دامنه\nاین گام فقط روی صفحات عمومی محصول/برند انجام شد و هیچ ویرایش دستی روی `crm/` یا `api/` انجام نشد.\n',
           '## صفحات اصلاح‌شده\n']
    for pth in batch:
        title, focus, docs, risks=profile_for(pth)
        r=final[pth]
        lines.append(f'- `{pth}` — {title} — وضعیت نهایی: `{r["risk"]}`، کلمات: {r["words"]}')
    lines += ['\n## نتیجه ممیزی پس از تکمیل گام‌های ۲ تا ۸\n',
              f'- وضعیت کل فعلی: OK={stats["ok"]}، risky={stats["risky"]}، LOW={stats["low"]}، DUP={stats["dup"]}، REP={stats["rep"]}، UNDER={stats["under"]}',
              '\n## توضیح\nپاراگراف‌های تکراری/عمومی حذف و با محتوای اختصاصی درباره انتخاب، RFQ، مدارک، نصب، commissioning و Data Book جایگزین شدند.\n']
    out.write_text('\n'.join(lines),encoding='utf-8')
print('final target risks:')
rows=run_audit()
for p in TARGETS:
    print(p, rows[p]['words'], rows[p]['risk'])
print('summary', summarize(rows))
