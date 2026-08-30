#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PTF — طبقه‌بندیِ سه‌گانهٔ صفحات مرکز دانش (نگهداری / ادغام / خروج از ایندکس)
=============================================================================
این اسکریپت **هیچ صفحه‌ای را تغییر نمی‌دهد**؛ فقط پیشنهاد می‌سازد تا با تأیید
مالک اجرا شود.

معیارها (همه کمّی و قابل‌سنجش):
  • یکتایی محتوا: تعداد قطعات ۵-واژه‌ایِ منحصربه‌فردِ صفحه (پس از حذف قالب مشترک)
  • سیگنال تقاضا: آیا کوئری‌ای از GSC به این صفحه می‌خورد؟
  • ارزش تجاری: آیا موضوعِ صفحه با حوزه‌های فروش/تامینِ واقعی شرکت هم‌راستاست؟
  • لینک داخلی ورودی

خروجی:
  _audit/KC-TRIAGE-<date>.csv      جدول کاملِ هر صفحه + پیشنهاد + دلیل
  _audit/KC-TRIAGE-PLAN-<date>.md  خلاصهٔ اجرایی و گام‌های پیشنهادی

اجرا:
  python3 _tools/kc_triage.py
"""
from __future__ import annotations

import csv
import json
import os
import re
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_audit')

# واژگانِ «ارزش تجاری» — موضوعاتی که مستقیماً به فروش/تامین وصل‌اند
COMMERCIAL = [
    'rosemount', 'yokogawa', 'siemens', 'schneider', 'abb', 'eaton', 'omron',
    'endress', 'krohne', 'wika', 'grunfos', 'atlas', 'kitz', 'flexitallic',
    'supplier', 'procurement', 'price', 'cost', 'buy', ' purchasing',
    'تامین', 'قیمت', 'خرید', 'واردات', 'تامین‌کننده',
    'flange', 'gasket', 'valve', 'pipe', 'fitting', 'pump', 'compressor',
    'boiler', 'transmitter', 'cable', 'switchgear', 'motor', 'analyzer',
    'فلنج', 'گسکت', 'شیر', 'لوله', 'پمپ', 'کمپرسور', 'بویلر', 'ترانسمیتر',
    'کابل', 'الکتروموتور', 'اتصالات',
]
# موضوعاتی که برای پروژه‌های هدفِ شرکت حیاتی‌اند (حتی اگر مستقیماً فروشی نباشند)
STRATEGIC = [
    'nace', 'sour', 'h2s', 'api-5l', 'api-6d', 'api-610', 'api-617', 'asme',
    'astm', 'iso', 'iec', 'atex', 'iecex', 'sil', 'tpi', 'mtc', 'ndt', 'nde',
    'hydrotest', 'welding', 'جوش', 'بازرسی', 'استاندارد', 'گواهی',
]

UNIQ_KEEP = 1000      # آستانهٔ «محتوای واقعاً اختصاصی»
UNIQ_MERGE = 250      # زیر این = شکّی؛ زیر آن و بدون سیگنال → خروج


def newest(prefix: str) -> str:
    c = sorted([f for f in os.listdir(OUT) if f.startswith(prefix) and f.endswith('.csv')], reverse=True)
    return os.path.join(OUT, c[0]) if c else ''


def load_unique() -> list:
    p = newest('SEO-UNIQUE-CONTENT-')
    if not p:
        raise SystemExit('خروجیِ seo_linkgraph.py را اول اجرا کنید')
    with open(p, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def load_gsc_queries() -> list:
    """کوئری‌های GSC (از تازه‌ترین اسنپ‌شات یا فایل baseline)."""
    rows = []
    p = newest('GSC-SNAPSHOT-')
    if p:
        with open(p, encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                if r.get('نوع') == 'query':
                    rows.append({'query': r['مقدار'], 'impressions': float(r['نمایش'] or 0),
                                 'page': r.get('صفحهٔ حدسی', '')})
    if not rows:
        p = os.path.join(OUT, 'GSC-QUERIES-BASELINE-2026-08-21.csv')
        if os.path.exists(p):
            with open(p, encoding='utf-8-sig') as f:
                for r in csv.DictReader(f):
                    q = (r.get('Top queries') or '').strip('"')
                    if q:
                        rows.append({'query': q, 'impressions': float(r.get('Impressions') or 0), 'page': ''})
    return rows


def tokens(s: str) -> set:
    return {t for t in re.split(r'[\s\-_/().،]+', s.lower()) if len(t) > 2}


def main():
    pages = [r for r in load_unique() if r['folder'] == 'knowledge-center']
    queries = load_gsc_queries()
    for q in queries:
        q['tok'] = tokens(q['query'])

    by_file = {r['file']: r for r in pages}
    files = sorted(by_file)

    # نگاشت کوئری → صفحه (بر اساس هم‌پوشانی واژگان با عنوان/نام فایل)
    page_query_imp = defaultdict(float)
    for q in queries:
        if q.get('page') and q['page'] in by_file:
            page_query_imp[q['page']] += q['impressions']
            continue
        best, best_s = '', 0
        for fn in files:
            hay = (by_file[fn]['title'] + ' ' + fn).lower()
            s = sum(1 for t in q['tok'] if t in hay)
            if s > best_s:
                best, best_s = fn, s
        if best and best_s >= max(2, len(q['tok']) // 2):
            page_query_imp[best] += q['impressions']

    rows = []
    for fn in files:
        r = by_file[fn]
        uniq = int(r['unique_shingles'])
        words = int(r['words'])
        inbound = int(r['inbound'])
        hay = (r['title'] + ' ' + fn).lower()
        commercial = any(t in hay for t in COMMERCIAL)
        strategic = any(t in hay for t in STRATEGIC)
        imp = page_query_imp.get(fn, 0.0)

        reasons = []
        if imp > 0:
            reasons.append('تقاضای واقعی از گوگل (%d نمایش)' % int(imp))
        if uniq >= UNIQ_KEEP:
            reasons.append('محتوای اختصاصیِ قوی (%d قطعهٔ یکتا)' % uniq)
        if commercial:
            reasons.append('هم‌راستا با حوزهٔ فروش/تامین')
        if strategic:
            reasons.append('موضوعِ استانداردی/حیاتی برای پروژه')

        # --- تصمیم ---
        if imp > 0 or (uniq >= UNIQ_KEEP and (commercial or strategic or inbound >= 3)):
            action = 'نگهداری و ارتقا'
        elif uniq >= UNIQ_MERGE:
            action = 'ادغام'
            reasons.append('محتوای متوسط (%d) — ادغام در صفحهٔ قوی‌ترِ هم‌موضوع' % uniq)
        elif commercial or strategic:
            action = 'بازنویسی فوری'
            reasons.append('موضوع مهم ولی محتوای قالبی (%d یکتا) — باید واقعاً نوشته شود' % uniq)
        else:
            action = 'خروج از ایندکس'
            reasons.append('بدون تقاضا، بدون ارزش تجاریِ مستقیم، محتوای یکتا فقط %d' % uniq)

        rows.append({
            'file': fn,
            'url': 'https://pishtaj.ir/' + fn,
            'title': r['title'],
            'words': words,
            'unique_shingles': uniq,
            'unique_share': r['unique_share'],
            'inbound_links': inbound,
            'gsc_impressions': int(imp),
            'commercial': 'بله' if commercial else 'خیر',
            'strategic': 'بله' if strategic else 'خیر',
            'action': action,
            'reason': ' · '.join(reasons) or '—',
        })

    order = {'نگهداری و ارتقا': 0, 'بازنویسی فوری': 1, 'ادغام': 2, 'خروج از ایندکس': 3}
    rows.sort(key=lambda r: (order[r['action']], -r['gsc_impressions'], -r['unique_shingles']))

    out_csv = os.path.join(OUT, 'KC-TRIAGE-%s.csv' % date.today().isoformat())
    with open(out_csv, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # ---------- خلاصه ----------
    cnt = defaultdict(int)
    for r in rows:
        cnt[r['action']] += 1
    total = len(rows)
    md = os.path.join(OUT, 'KC-TRIAGE-PLAN-%s.md' % date.today().isoformat())
    L = []
    A = L.append
    A('# پیشنهادِ طبقه‌بندیِ مرکز دانش — %s' % date.today().isoformat())
    A('')
    A('> این سند فقط **پیشنهاد** است؛ هیچ صفحه‌ای تغییر نکرده است.')
    A('> اجرای هر مورد نیازمند تأیید شماست.')
    A('')
    A('## خلاصه')
    A('')
    A('| تصمیم | تعداد | سهم |')
    A('|---|---|---|')
    for k in ['نگهداری و ارتقا', 'بازنویسی فوری', 'ادغام', 'خروج از ایندکس']:
        A('| %s | %d | %.0f%% |' % (k, cnt[k], cnt[k] * 100 / total))
    A('| **جمع** | **%d** | ۱۰۰٪ |' % total)
    A('')
    A('## معیارهای تصمیم')
    A('')
    A('| پارامتر | مقدار |')
    A('|---|---|')
    A('| آستانهٔ «محتوای اختصاصیِ قوی» | ≥ %d قطعهٔ ۵-واژه‌ایِ یکتا |' % UNIQ_KEEP)
    A('| آستانهٔ «مشکوک/قابل‌ادغام» | %d تا %d |' % (UNIQ_MERGE, UNIQ_KEEP))
    A('| آستانهٔ «بدون محتوای اختصاصی» | < %d |' % UNIQ_MERGE)
    A('| سیگنال تقاضا | کوئریِ ثبت‌شده در GSC که به صفحه بخورد |')
    A('')
    A('## ۱) صفحاتی که باید نگه داشته و ارتقا یابند (نمونهٔ ۳۰ تای اول)')
    A('')
    A('| صفحه | نمایشِ GSC | یکتا | واژه | دلیل |')
    A('|---|---|---|---|---|')
    for r in [x for x in rows if x['action'] == 'نگهداری و ارتقا'][:30]:
        A('| %s | %d | %d | %d | %s |' % (r['file'][:52], r['gsc_impressions'],
                                          r['unique_shingles'], r['words'], r['reason'][:70]))
    A('')
    A('## ۲) بازنویسی فوری (موضوع مهم، محتوای فعلی قالبی)')
    A('')
    A('| صفحه | یکتا | واژه | دلیل |')
    A('|---|---|---|---|')
    for r in [x for x in rows if x['action'] == 'بازنویسی فوری'][:25]:
        A('| %s | %d | %d | %s |' % (r['file'][:52], r['unique_shingles'], r['words'], r['reason'][:70]))
    A('')
    A('## ۳) خروج از ایندکس / حذف (بدون تقاضا و بدون ارزش مستقیم)')
    A('')
    A('| صفحه | یکتا | واژه | لینک ورودی |')
    A('|---|---|---|---|')
    for r in [x for x in rows if x['action'] == 'خروج از ایندکس'][:30]:
        A('| %s | %d | %d | %d |' % (r['file'][:52], r['unique_shingles'], r['words'], r['inbound_links']))
    A('')
    A('> فهرست کامل در `KC-TRIAGE-%s.csv`' % date.today().isoformat())
    A('')
    A('## گام‌های اجرایی پیشنهادی (پس از تأیید)')
    A('')
    A('1. **بازنویسی** گروه ۲ (موضوعاتِ مهم) — این‌ها بیشترین بازده را دارند.')
    A('2. **ادغام** گروه ۳: انتقال محتوای یکتا به صفحهٔ مقصد + ریدایرکت ۳۰۱.')
    A('3. **خروج از ایندکس** گروه ۴: افزودن `noindex` + حذف از نقشهٔ سایت '
      '(یا حذف فیزیکی با ۴۱۰ اگر بک‌لینک ندارند).')
    A('4. بعد از هر مرحله، در GSC تعدادِ «ایندکس‌شده» را دوباره بخوانید تا اثر را ببینید.')
    A('')
    open(md, 'w', encoding='utf-8').write('\n'.join(L))

    print('=' * 66)
    print('طبقه‌بندی مرکز دانش — %d صفحه' % total)
    print('=' * 66)
    for k in ['نگهداری و ارتقا', 'بازنویسی فوری', 'ادغام', 'خروج از ایندکس']:
        print('  %-22s %4d  (%.0f%%)' % (k, cnt[k], cnt[k] * 100 / total))
    print()
    print('خروجی: %s' % os.path.relpath(out_csv, ROOT))
    print('       %s' % os.path.relpath(md, ROOT))
    print('=' * 66)


if __name__ == '__main__':
    main()
