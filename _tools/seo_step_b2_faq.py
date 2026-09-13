#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گام B2 سئو — پاس ۲: FAQPage schema برای مقالات مرکز دانش بدون FAQ (2026-08-21) — idempotent.

زمینه: از ۴۵۰ مقالهٔ knowledge-center فقط ۱۰۵ مقاله FAQPage داشتند. این پاس برای ۳۴۵
مقالهٔ باقی‌مانده یک بلوک مستقل JSON-LD از نوع FAQPage اضافه می‌کند (بدون دست‌زدن به
بلوک‌های موجود Article/BreadcrumbList — کم‌ریسک و قابل بازگشت).

منبع پاسخ‌ها (بدون هیچ ادعای فنی ساختگی):
  Q1 — تعریف/معرفی موضوع → پاسخ = meta description خود صفحه (یکتا، تألیف‌شده).
  Q2 — نکات فنی → پاسخ = پاراگراف اول بخش «مبانی و نکات پایه»/«مقدمه» (یکتا) یا نخستین
       H2 غیرقالبی صفحه (۲۸۵ صفحه متن یکتا دارند).
  Q3 — مسیر استعلام → پاسخ قالب‌شدهٔ واقعی دربارهٔ فرایند RFQ/تماس شرکت (بدون ادعای فنی).

idempotent: صفحاتی که قبلاً FAQPage دارند دست‌نخورده می‌مانند. اجرای دوباره تغییری نمی‌دهد.
اجرا:
  python3 tools/seo_step_b2_faq.py            # dry-run (فقط گزارش + نمونه)
  python3 tools/seo_step_b2_faq.py --apply    # اعمال واقعی
"""
import re, os, glob, json, sys, html as _html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TODAY = '2026-08-21'
MARKER = 'SEO-B2-FAQ-PASS2-v1'
APPLY = '--apply' in sys.argv

# H2های قالبی (متن یکسان بین ده‌ها صفحه) — برای پاسخ Q2 استفاده نمی‌شوند.
BAD_H2 = {
    'اهمیت موضوع در صنایع نفت گاز و پتروشیمی',
    'راهنمای انتخاب تامین‌کننده معتبر در صنایع نفت و گاز',
    'اهمیت مستندات فنی در تامین تجهیزات صنعتی',
    'تامین این تجهیزات را به پیشرو تجهیز فرتاک بسپارید',
    'نتیجه‌گیری و توصیه‌های نهایی',
    'جمع‌بندی',
    'نتیجه‌گیری',
    'استانداردهای بین‌المللی مرتبط',
    'نکات فنی و استانداردها',
    'انواع و دسته‌بندی',
    'راهنمای خرید و نکات فنی برای مهندسان و کارشناسان خرید صنعتی',
}

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def write(path, s):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)

def clean(s):
    s = _html.unescape(s or '')
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def norm(x):
    return re.sub(r'\s+', ' ', (x or '').replace('\u200c', '')).strip()

def get_meta_desc(s):
    m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']', s, re.I)
    return m.group(1).strip() if m else ''

def get_h1(s):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    return clean(m.group(1)) if m else ''

def topic_of(h1):
    t = h1
    for sep in (' — ', ' | ', '—', '|'):
        if sep in t:
            t = t.split(sep, 1)[0].strip()
            break
    for pre in ('راهنمای کامل ', 'راهنمای جامع ', 'راهنمای '):
        if t.startswith(pre):
            t = t[len(pre):].strip()
            break
    return t or h1

def h2_sections(s):
    """لیست (متن H2، پاراگراف اول بعد از آن) به ترتیب سند."""
    out = []
    cur = None
    for part in re.split(r'(<h2[^>]*>.*?</h2>)', s, flags=re.S):
        m = re.fullmatch(r'<h2[^>]*>(.*?)</h2>', part, re.S)
        if m:
            out.append([clean(m.group(1)), None])
            continue
        if not out:
            continue
        if out[-1][1] is None:
            pm = re.search(r'<p[^>]*>(.*?)</p>', part, re.S)
            if pm:
                out[-1][1] = clean(pm.group(1))
    return [(a, b) for a, b in out if b]

def trim(text, maxlen=240):
    text = clean(text)
    if len(text) <= maxlen:
        return text
    # ترجیح برش در پایان جمله (؟ / . / ؛) و نه وسط فهرست با کاما
    for ch in ('؟', '.', '!', '؛'):
        i = text.rfind(ch, 0, maxlen)
        if i > int(maxlen * 0.55):
            return text[:i + 1].rstrip()
    i = text.rfind('،', 0, maxlen)
    if i > int(maxlen * 0.55):
        return text[:i + 1].rstrip() + '…'
    return text[:maxlen].rstrip(' ،.؛؟') + '…'

def disp_topic(topic):
    """برای پرسش‌ها: «مقایسه X و Y» → «تفاوت X و Y» (خوانایی پرسش)."""
    return topic.replace('مقایسه', 'تفاوت', 1) if topic.startswith('مقایسه') else topic

def q1_text(topic):
    if topic.startswith('مقایسه'):
        return topic.replace('مقایسه', 'تفاوت', 1) + ' چیست؟'
    if topic.startswith('انتخاب'):
        return 'نکات مهم در ' + topic + ' چیست؟'
    return topic + ' چیست؟'

def q2_from_sections(topic, sections):
    disp = disp_topic(topic)
    # بخش‌های تعریفی یکتای صفحه
    for key in ('مبانی و نکات پایه', 'مقدمه'):
        for h2, p in sections:
            if norm(h2) == norm(key):
                return ('مهم‌ترین مبانی و نکات پایهٔ {t} چیست؟'.format(t=disp), trim(p))
    # نخستین بخش غیرقالبی (معمولاً نام انگلیسی/موضوع با متن یکتا)
    for h2, p in sections:
        if norm(h2) not in BAD_H2:
            return ('مهم‌ترین نکات فنی {t} چیست؟'.format(t=disp), trim(p))
    return None

def q3(topic):
    # برای صفحات «مقایسه/تفاوت»، درج موضوع در پرسش استعلام نامفهوم می‌شود → پرسش عمومی.
    if topic.startswith('مقایسه'):
        q = 'چگونه می‌توان از پیشرو تجهیز فرتاک استعلام قیمت و پیش‌فاکتور گرفت؟'
        a = ('برای دریافت استعلام قیمت و پیش‌فاکتور کافی است فرم استعلام (RFQ) را در سایت '
             'پیشرو تجهیز فرتاک ثبت کنید یا با شماره ۰۲۱-۴۶۰۸۷۶۷۹ تماس بگیرید؛ کارشناسان فنی پس از '
             'بررسی مشخصات پروژه، قیمت، زمان تحویل و مستندات فنی را اعلام می‌کنند.')
        return (q, a)
    q = 'چگونه می‌توان از پیشرو تجهیز فرتاک برای {t} استعلام قیمت و پیش‌فاکتور گرفت؟'.format(t=topic)
    a = ('برای دریافت استعلام قیمت و پیش‌فاکتور {t} کافی است فرم استعلام (RFQ) را در سایت '
         'پیشرو تجهیز فرتاک ثبت کنید یا با شماره ۰۲۱-۴۶۰۸۷۶۷۹ تماس بگیرید؛ کارشناسان فنی پس از '
         'بررسی مشخصات پروژه، قیمت، زمان تحویل و مستندات فنی را اعلام می‌کنند.').format(t=topic)
    return (q, a)

def build_block(topic, desc, sections):
    faq = []
    if topic and desc:
        faq.append((q1_text(topic), trim(desc)))
    q2 = q2_from_sections(topic, sections)
    if q2:
        faq.append(q2)
    if topic:
        faq.append(q3(topic))
    if len(faq) < 2:
        return None
    node = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'inLanguage': 'fa-IR',
        'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}}
            for q, a in faq
        ],
        '_ptf': MARKER,
    }
    payload = json.dumps(node, ensure_ascii=False, indent=1)
    return '<script type="application/ld+json">\n' + payload + '\n</script>'

def inject(path):
    s = read(path)
    if 'FAQPage' in s:
        return 'skip-has-faq'
    desc = get_meta_desc(s)
    h1 = get_h1(s)
    topic = topic_of(h1)
    sections = h2_sections(s)
    block = build_block(topic, desc, sections)
    if not block:
        return 'skip-no-content'
    matches = list(re.finditer(r'<script type=["\']application/ld\+json["\']>.*?</script>', s, re.S))
    if matches:
        at = matches[-1].end()
        ns = s[:at] + '\n' + block + s[at:]
    else:
        i = s.find('</head>')
        ns = s[:i] + block + '\n' + s[i:]
    if APPLY:
        write(path, ns)
    return 'ok'

def main():
    stats = {'ok': 0, 'skip-has-faq': 0, 'skip-no-content': 0}
    changed = []
    samples = []
    for p in sorted(glob.glob('knowledge-center/*.html')):
        if os.path.basename(p) == 'index.html':
            continue
        r = inject(p)
        stats[r] = stats.get(r, 0) + 1
        if r == 'ok':
            changed.append(p)
            if len(samples) < 2:
                samples.append(p)
    print('نتیجه:', stats)
    print('صفحات تغییرکرده:', len(changed))
    for p in samples:
        s = read(p)
        last = re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)[-1]
        print('\n===== نمونه: ' + p + ' =====')
        print(last[:1200])
    # به‌روزرسانی lastmod سایت‌مپ برای صفحات تغییرکرده
    if changed:
        urls = ['https://pishtaj.ir/' + p for p in changed]
        for sm in glob.glob('sitemap-knowledge-center.xml'):
            s = read(sm)
            orig = s
            for u in urls:
                s = re.sub(
                    r'(<loc>' + re.escape(u) + r'</loc><lastmod>)([^<]+)(</lastmod>)',
                    lambda mm: mm.group(1) + TODAY + mm.group(3), s)
            if s != orig:
                if APPLY:
                    write(sm, s)
                print('sitemap touched:', os.path.basename(sm), '(', sum(1 for u in urls if '<loc>%s</loc><lastmod>%s</lastmod>' % (u, TODAY) in s), 'URL)')

if __name__ == '__main__':
    main()
