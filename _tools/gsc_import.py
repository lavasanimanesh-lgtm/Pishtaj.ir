#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — درون‌ریز و تحلیل دادهٔ Google Search Console
==================================================
خروجی‌های CSV سرچ کنسول را می‌خواند و به «فهرست اقدام» تبدیل می‌کند.

ورودیِ قابل‌قبول (هر کدام را بدهید):
  - پوشه‌ای که فایل‌های Queries.csv / Pages.csv در آن است
  - فایل ZIP خروجیِ GSC
  - یک یا چند فایل CSV (کوئری‌ها / صفحات)
  - CSV سادهٔ فرمِ «Top queries,Clicks,Impressions,CTR,Position»
    (همان قالبِ _audit/GSC-QUERIES-BASELINE-2026-08-21.csv)

خروجی:
  _audit/GSC-SNAPSHOT-<date>.csv    دادهٔ نرمال‌شده
  _audit/GSC-ANALYSIS-<date>.md     گزارش تحلیلی + فهرست اقدام
  _audit/GSC-HISTORY.csv            روند (یک سطر به‌ازای هر بار اجرا)

نمونه:
  python3 _tools/gsc_import.py ~/Downloads/Queries.csv ~/Downloads/Pages.csv
  python3 _tools/gsc_import.py ~/Downloads/gsc-export.zip --days 90
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import zipfile
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_audit')

BRAND_TOKENS = [
    'پیشرو تجهیز', 'پیشرو تجهیز فرتاک', 'پیشروصنعت', 'ptf', 'pishtaj',
    'فرتاک', 'پیشتاز', 'پویا تجهیز', 'ویژن پترو', 'پیشرو اندیشان',
    'ستاره تجهیز', 'wizarat', 'sth tajhiz',
]
SPAM_TOKENS = ['casino', 'bingo', 'paysafecard', 'مراهنات', 'قمار', 'شرط بندی']

NUM = re.compile(r'[,\s%]')


def to_num(v) -> float:
    if v is None:
        return 0.0
    s = str(v).strip()
    if not s:
        return 0.0
    neg = s.startswith('-')
    s = NUM.sub('', s)
    s = s.replace('٫', '.').replace('٬', '')
    try:
        n = float(s)
    except ValueError:
        return 0.0
    return -n if neg else n


def read_csv_text(text: str) -> list:
    """خواندن CSV با حدس خودکار جداکننده و رد کردن سرآیندهای چندخطی GSC."""
    lines = [l for l in text.splitlines()]
    # فایل‌های GSC گاهی دو خط سرآیند دارند (نام گروه + ستون‌ها)
    sample = '\n'.join(lines[:6])
    delim = ',' if sample.count(',') >= sample.count('\t') else '\t'
    rdr = csv.reader(io.StringIO('\n'.join(lines)), delimiter=delim)
    rows = [r for r in rdr if any(c.strip() for c in r)]
    # پیدا کردن سطر سرآیند: اولین سطری که شامل clicks یا impressions یا position است
    hi = 0
    for i, r in enumerate(rows[:8]):
        joined = ' '.join(r).lower()
        if 'click' in joined or 'impression' in joined or 'position' in joined:
            hi = i
            break
    header = [c.strip() for c in rows[hi]]
    out = []
    for r in rows[hi + 1:]:
        if len(r) < len(header):
            r = r + [''] * (len(header) - len(r))
        d = {header[i]: r[i] for i in range(len(header))}
        out.append(d)
    return out


def pick(d: dict, *names) -> str:
    low = {k.lower().strip(): v for k, v in d.items()}
    for n in names:
        if n.lower() in low:
            return low[n.lower()]
    for k in low:
        for n in names:
            if n.lower() in k:
                return low[k]
    return ''


def load_rows(paths: list) -> tuple:
    """برمی‌گرداند (queries, pages, countries, devices, dates)."""
    queries, pages, misc = [], [], defaultdict(list)
    files = []
    for p in paths:
        if os.path.isdir(p):
            files += [os.path.join(p, f) for f in sorted(os.listdir(p))
                      if f.lower().endswith('.csv')]
        elif p.lower().endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.lower().endswith('.csv'):
                        files.append(('zip', p, n, z.read(n).decode('utf-8-sig', 'ignore')))
        else:
            files.append(p)

    for f in files:
        if isinstance(f, tuple):
            _, _, name, text = f
        else:
            name = os.path.basename(f)
            with open(f, encoding='utf-8-sig', errors='ignore') as fh:
                text = fh.read()
        rows = read_csv_text(text)
        if not rows:
            continue
        keys = ' '.join(rows[0].keys()).lower()
        has_q = 'query' in keys or 'کوئری' in keys or 'Top queries'.lower() in keys
        has_p = ('page' in keys or 'صفحه' in keys) and not has_q
        lname = name.lower()
        if 'quer' in lname or has_q:
            queries += rows
        elif 'page' in lname or has_p:
            pages += rows
        else:
            misc[lname.replace('.csv', '')] += rows
    return queries, pages, misc


def norm_queries(rows: list) -> list:
    out = []
    for r in rows:
        q = pick(r, 'Top queries', 'Query', 'کوئری', 'جستار').strip().strip('"')
        if not q:
            continue
        imp = to_num(pick(r, 'Impressions', 'نمایش'))
        clk = to_num(pick(r, 'Clicks', 'کلیک'))
        pos = to_num(pick(r, 'Position', 'جایگاه', 'موقعیت'))
        ctr = to_num(pick(r, 'CTR'))
        if ctr > 1:            # «۶۶٫۶۷٪» → ۰٫۶۶۶۷
            ctr = ctr / 100.0
        if imp and not ctr:
            ctr = clk / imp if imp else 0
        out.append({'query': q, 'clicks': clk, 'impressions': imp,
                    'ctr': ctr, 'position': pos})
    return out


def norm_pages(rows: list) -> list:
    out = []
    for r in rows:
        u = pick(r, 'Top pages', 'Page', 'صفحه', 'URL').strip()
        if not u:
            continue
        imp = to_num(pick(r, 'Impressions', 'نمایش'))
        clk = to_num(pick(r, 'Clicks', 'کلیک'))
        pos = to_num(pick(r, 'Position', 'جایگاه', 'موقعیت'))
        ctr = to_num(pick(r, 'CTR'))
        if ctr > 1:
            ctr = ctr / 100.0
        if imp and not ctr:
            ctr = clk / imp if imp else 0
        out.append({'url': u, 'clicks': clk, 'impressions': imp,
                    'ctr': ctr, 'position': pos})
    return out


def is_brand(q: str) -> bool:
    ql = q.lower()
    return any(t in ql for t in BRAND_TOKENS)


def load_site_index() -> list:
    """فهرست صفحات سایت (از تازه‌ترین فایل ممیزی، وگرنه اسکن پوشه‌ها)."""
    cands = sorted([f for f in os.listdir(OUT)
                    if f.startswith('SEO-AUDIT-DATA-') and f.endswith('.csv')],
                   reverse=True)
    idx = []
    if cands:
        with open(os.path.join(OUT, cands[0]), encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                idx.append({'file': r['file'], 'url': r['url'],
                            'title': r.get('title', ''), 'words': int(r.get('words') or 0)})
    if not idx:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames
                           if d not in {'.git', 'crm', 'api', '_tools', '_audit',
                                        'assets', 'docs', 'node_modules'}]
            for fn in filenames:
                if fn.endswith('.html'):
                    rel = os.path.relpath(os.path.join(dirpath, fn), ROOT).replace(os.sep, '/')
                    idx.append({'file': rel, 'url': 'https://pishtaj.ir/' + rel,
                                'title': '', 'words': 0})
    return idx


def match_page(query: str, idx: list) -> str:
    """حدس صفحهٔ هدف یک کوئری بر اساس واژگانِ مشترک با عنوان/نام فایل."""
    toks = [t for t in re.split(r'[\s\-_/()]+', query) if len(t) > 2]
    if not toks:
        return ''
    best, best_score = '', 0
    for p in idx:
        hay = (p.get('title', '') + ' ' + p['file']).lower()
        score = sum(1 for t in toks if t.lower() in hay)
        if score > best_score:
            best, best_score = p['file'], score
    return best if best_score >= max(2, len(toks) // 2) else ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+', help='فایل(های) CSV / ZIP / پوشه')
    ap.add_argument('--days', type=int, default=90, help='بازهٔ داده (روز) — فقط برای گزارش')
    ap.add_argument('--label', default='', help='برچسب دلخواه برای این برداشت')
    args = ap.parse_args()

    qrows, prows, misc = load_rows(args.paths)
    Q = norm_queries(qrows)
    P = norm_pages(prows)
    if not Q and not P:
        print('❌ هیچ داده‌ای پیدا نشد. مسیرها را بررسی کنید:', args.paths)
        return 1

    today = date.today().isoformat()
    os.makedirs(OUT, exist_ok=True)

    # ذخیرهٔ دادهٔ نرمال‌شده
    snap = os.path.join(OUT, 'GSC-SNAPSHOT-%s.csv' % today)
    with open(snap, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['نوع', 'مقدار', 'کلیک', 'نمایش', 'CTR', 'جایگاه', 'برندی؟', 'صفحهٔ حدسی'])
        idx = load_site_index()
        for r in sorted(Q, key=lambda x: -x['impressions']):
            w.writerow(['query', r['query'], r['clicks'], r['impressions'],
                        round(r['ctr'], 4), round(r['position'], 1),
                        'بله' if is_brand(r['query']) else 'خیر',
                        match_page(r['query'], idx)])
        for r in sorted(P, key=lambda x: -x['impressions']):
            w.writerow(['page', r['url'], r['clicks'], r['impressions'],
                        round(r['ctr'], 4), round(r['position'], 1), '', ''])

    # ---------- شاخص‌ها ----------
    tot_clk = sum(r['clicks'] for r in Q)
    tot_imp = sum(r['impressions'] for r in Q)
    brand = [r for r in Q if is_brand(r['query'])]
    nonbrand = [r for r in Q if not is_brand(r['query'])]
    spam = [r for r in Q if any(t in r['query'].lower() for t in SPAM_TOKENS)]
    b_imp = sum(r['impressions'] for r in brand)
    b_clk = sum(r['clicks'] for r in brand)

    def bucket(lo, hi):
        return [r for r in Q if lo <= r['position'] < hi]

    b1 = bucket(0, 11)
    b2 = bucket(11, 21)
    b3 = bucket(21, 31)
    b4 = bucket(31, 1000)

    # فرصت‌ها: نمایش بالا و جایگاه نزدیک به صفحهٔ اول
    quick = sorted([r for r in nonbrand if r['impressions'] >= 5 and 8 <= r['position'] <= 30],
                   key=lambda r: -r['impressions'])
    # نمایش دارد ولی کلیک صفر → تایتل/توضیح جذاب نیست
    zero_ctr = sorted([r for r in Q if r['impressions'] >= 5 and r['clicks'] == 0],
                      key=lambda r: -r['impressions'])
    # جایگاه خوب ولی CTR پایین
    low_ctr = sorted([r for r in Q if r['position'] <= 10 and r['impressions'] >= 5
                      and r['ctr'] < 0.03], key=lambda r: -r['impressions'])

    # ---------- روند ----------
    hist = os.path.join(OUT, 'GSC-HISTORY.csv')
    new = not os.path.exists(hist)
    with open(hist, 'a', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        if new:
            w.writerow(['تاریخ', 'بازه_روز', 'تعداد_کوئری', 'نمایش', 'کلیک',
                        'نمایش_برندی', 'کلیک_برندی', 'کوئری_صفحه۱', 'کوئری_صفحه۲',
                        'کوئری_صفحه۳', 'برچسب'])
        w.writerow([today, args.days, len(Q), int(tot_imp), int(tot_clk),
                    int(b_imp), int(b_clk), len(b1), len(b2), len(b3), args.label])

    # ---------- گزارش ----------
    rep = os.path.join(OUT, 'GSC-ANALYSIS-%s.md' % today)
    L = []
    A = L.append
    A('# تحلیل دادهٔ Google Search Console — %s' % today)
    A('')
    A('**بازهٔ داده:** %d روز | **منبع:** %s | **برچسب:** %s'
      % (args.days, ', '.join(os.path.basename(p) for p in args.paths), args.label or '—'))
    A('')
    A('## ۱) شاخص‌های کلیدی')
    A('')
    A('| شاخص | مقدار |')
    A('|---|---|')
    A('| تعداد کوئری دارای نمایش | %d |' % len(Q))
    A('| مجموع نمایش | %s |' % f'{int(tot_imp):,}')
    A('| مجموع کلیک | %s |' % f'{int(tot_clk):,}')
    A('| CTR کل | %.2f%% |' % (tot_clk / tot_imp * 100 if tot_imp else 0))
    A('| نمایشِ برندی | %s (%.0f%% از کل) |' % (f'{int(b_imp):,}', b_imp / tot_imp * 100 if tot_imp else 0))
    A('| کلیکِ برندی | %s (%.0f%% از کل) |' % (f'{int(b_clk):,}', b_clk / tot_clk * 100 if tot_clk else 0))
    A('| کوئری‌های غیربرندی | %d |' % len(nonbrand))
    if spam:
        A('| ⚠️ کوئری‌های مشکوک به اسپم | %d |' % len(spam))
    A('')
    A('## ۲) توزیع جایگاه')
    A('')
    A('| بازهٔ جایگاه | تعداد کوئری | سهم نمایش |')
    A('|---|---|---|')
    for name, grp in [('صفحهٔ ۱ (۱–۱۰)', b1), ('صفحهٔ ۲ (۱۱–۲۰)', b2),
                      ('صفحهٔ ۳ (۲۱–۳۰)', b3), ('بعد از ۳۰', b4)]:
        gi = sum(r['impressions'] for r in grp)
        A('| %s | %d | %.0f%% |' % (name, len(grp), gi / tot_imp * 100 if tot_imp else 0))
    A('')

    A('## ۳) 🔥 Quick-Win — کوئری‌های نزدیک به صفحهٔ اول (بیشترین نمایش)')
    A('')
    if quick:
        A('| اولویت | کوئری | نمایش | کلیک | جایگاه | صفحهٔ حدسی سایت | اقدام |')
        A('|---|---|---|---|---|---|---|')
        idx = load_site_index()
        for i, r in enumerate(quick[:20], 1):
            pg = match_page(r['query'], idx)
            act = ('بهینه‌سازی عنوان/توضیح صفحه + لینک داخلی' if pg
                   else 'شکاف محتوا — صفحهٔ اختصاصی بسازید')
            A('| %d | %s | %d | %d | %.1f | `%s` | %s |'
              % (i, r['query'], r['impressions'], r['clicks'], r['position'], pg or '—', act))
    else:
        A('موردی با این معیار یافت نشد (نمایش ≥ ۵ و جایگاه ۸–۳۰).')
    A('')

    A('## ۴) نمایش دارد، کلیک ندارد → عنوان/توضیح باید بازنویسی شود')
    A('')
    if zero_ctr:
        A('| کوئری | نمایش | جایگاه |')
        A('|---|---|---|')
        for r in zero_ctr[:20]:
            A('| %s | %d | %.1f |' % (r['query'], r['impressions'], r['position']))
    else:
        A('—')
    A('')

    if low_ctr:
        A('## ۵) جایگاه خوب با CTR غیرعادی کم')
        A('')
        A('| کوئری | نمایش | جایگاه | CTR |')
        A('|---|---|---|---|')
        for r in low_ctr[:15]:
            A('| %s | %d | %.1f | %.1f%% |' % (r['query'], r['impressions'], r['position'], r['ctr'] * 100))
        A('')

    if P:
        A('## ۶) صفحات پربازدید')
        A('')
        A('| صفحه | نمایش | کلیک | جایگاه | CTR |')
        A('|---|---|---|---|---|')
        for r in P[:20]:
            A('| %s | %d | %d | %.1f | %.1f%% |'
              % (r['url'].replace('https://pishtaj.ir', ''), r['impressions'], r['clicks'],
                 r['position'], r['ctr'] * 100))
        A('')

    if spam:
        A('## ⚠️ هشدار: کوئری‌های اسپم')
        A('')
        for r in spam[:20]:
            A('- %s (نمایش %d)' % (r['query'], r['impressions']))
        A('')
        A('این‌ها بازماندهٔ آلودگیِ قدیمیِ هاست هستند؛ در GSC → Removals درخواست حذف بزنید.')
        A('')

    A('## ۷) نکتهٔ تفسیری')
    A('')
    if b_clk / max(tot_clk, 1) > 0.7:
        A('بیش از %.0f%% کلیک‌ها برندی است؛ یعنی سایت هنوز از جستجوی غیربرندی مشتری نمی‌گیرد. '
          'الویت مطلق: «اعتبار» (لینک/برندسازی) + «انتخاب چند کوئریِ محدود و بردن آن‌ها به صفحهٔ اول»، '
          'نه تولید انبوه صفحهٔ جدید.' % (b_clk / max(tot_clk, 1) * 100))
    A('')
    A('---')
    A('')
    A('تولیدشده با `_tools/gsc_import.py` | دادهٔ خام: `%s`' % os.path.basename(snap))

    open(rep, 'w', encoding='utf-8').write('\n'.join(L))

    # خروجی چاپی
    print('=' * 70)
    print('خلاصهٔ GSC — %s' % today)
    print('=' * 70)
    print('کوئری‌ها: %d | نمایش: %s | کلیک: %s | CTR: %.2f%%'
          % (len(Q), f'{int(tot_imp):,}', f'{int(tot_clk):,}',
             tot_clk / tot_imp * 100 if tot_imp else 0))
    if P:
        p_imp = sum(r['impressions'] for r in P)
        p_clk = sum(r['clicks'] for r in P)
        print('صفحات: %d | نمایش: %s | کلیک: %s'
              % (len(P), f'{int(p_imp):,}', f'{int(p_clk):,}'))
    if not Q:
        # خروجیِ «Pages» به‌تنهایی هیچ کوئری/برند/جایگاهِ کوئری ندارد؛ اگر این
        # خطوط چاپ شوند، کاربر صفر می‌بیند و فکر می‌کند درون‌ریزی شکست خورده.
        print('⚠️  این برداشت فقط ستونِ «صفحات» دارد (Queries نبود)؛ آمارِ کوئری، '
              'برندی و جایگاهِ کوئری معنا ندارد.')
    else:
        print('برندی: %.0f%% نمایش / %.0f%% کلیک'
              % (b_imp / tot_imp * 100 if tot_imp else 0,
                 b_clk / tot_clk * 100 if tot_clk else 0))
        print('صفحهٔ ۱: %d | صفحهٔ ۲: %d | صفحهٔ ۳: %d | بعد از ۳۰: %d'
              % (len(b1), len(b2), len(b3), len(b4)))
    print()
    print('🔥 سریع‌ترین فرصت‌ها:')
    idx = load_site_index()
    if not Q and P:
        for i, r in enumerate(sorted(P, key=lambda x: -x['impressions'])[:8], 1):
            print('  %d. %-52s نمایش %4d | جایگاه %5.1f'
                  % (i, r['url'].replace('https://pishtaj.ir', '')[:52],
                     r['impressions'], r['position']))
    for i, r in enumerate(quick[:8], 1):
        print('  %d. %-42s نمایش %4d | جایگاه %5.1f | %s'
              % (i, r['query'][:42], r['impressions'], r['position'],
                 match_page(r['query'], idx) or 'صفحه ندارد'))
    if spam:
        print()
        print('⚠️ %d کوئری اسپم دیده شد — GSC → Removals' % len(spam))
    print()
    print('گزارش: %s' % os.path.relpath(rep, ROOT))
    print('داده:   %s' % os.path.relpath(snap, ROOT))
    print('روند:   %s' % os.path.relpath(hist, ROOT))
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
