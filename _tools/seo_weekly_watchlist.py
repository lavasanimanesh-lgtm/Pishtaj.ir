#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PTF — واچ‌لیست هفتگی سئو و «گیت پیشرفت» (گام E رودمپ ۰۹-۰۲)
=================================================================
کلمات هدف (دو کلمهٔ پول‌ساز + کوئری‌های «صفحهٔ ۱.۵» از دادهٔ GSC) را
از تازه‌ترین اسنپ‌شات می‌خواند، روند جایگاه/نمایش/کلیک هر کلمه را در
_audit/SEO-WATCHLIST.json نگه می‌دارد و یک گزارش هفتگی markdown می‌سازد.

ورودی:
  - تازه‌ترین _audit/GSC-SNAPSHOT-<date>.csv  (پیش‌فرض — خودکار پیدا می‌شود)
  - یا هر CSV دیگری با:  python3 _tools/seo_weekly_watchlist.py --csv مسیر.csv
    (خروجی gsc_import.py یا CSV سادهٔ «Top queries,Clicks,Impressions,CTR,Position»)
  - یا مستقیم از API زندهٔ CRM (از وقتی GSC وصل است، دیگر اکسپورت CSV لازم نیست):
      python3 _tools/seo_weekly_watchlist.py --live
    (توکن نشست CRM را با --token بدهید، یا متغیر PTF_CRM_TOKEN، یا فایل _tools/.ptf-crm-token)

خروجی:
  - _audit/SEO-WATCHLIST.json        وضعیت تجمعی (history هر کلمه)
  - _audit/SEO-WEEKLY-<date>.md      گزارش «گیت پیشرفت» هفته

کلمه‌ای که در اسنپ‌شات نباشد یعنی سایت در ۱۰۰ نتیجهٔ اول نیست → «بدون نمایش».

حالت --live داده را از action=overview در api/gsc.php می‌گیرد (همان داده‌ای که پنل
CRM نشان می‌دهد) و بدون نوشتن CSV جدید فقط state و گزارش هفتگی را به‌روز می‌کند؛
بنابراین اسنپ‌شات‌های آرشیوی _audit و قراردادهای tester647 دست‌نخورده می‌مانند.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT = os.path.join(ROOT, '_audit')
STATE = os.path.join(AUDIT, 'SEO-WATCHLIST.json')

# کلمات هدف: (کوئری, صفحهٔ هدف)
TARGETS = [
    ('تامین تجهیزات پایپینگ', 'services/piping-supply.html'),
    ('تامین تجهیزات ابزار دقیق', 'services/instrumentation-supply.html'),
    ('ترانسمیتر فشار روزمونت 3051', 'knowledge-center/rosemount-pressure-transmitter-family.html'),
    ('لول ترانسمیتر دیسپلیسر', 'services/products/displacer-level-transmitter.html'),
    ('کنترل ولو بخار', 'knowledge-center/steam-control-valve-sizing-guide.html'),
    ('ترانسمیتر فشار روزمونت', 'knowledge-center/rosemount-pressure-transmitter-family.html'),
    ('لوله x42', 'knowledge-center/api-5l-x42.html'),
    ('قیمت لوله a106', 'knowledge-center/kc-astm-a106-gr.html'),
    ('نمایندگی روزمونت', 'brands/emerson-rosemount.html'),
]

NUM = re.compile(r'[,\s%٪]')


def to_num(v):
    if v is None:
        return 0.0
    s = str(v).strip()
    if not s:
        return 0.0
    s = NUM.sub('', s).replace('٫', '.').replace('٬', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def norm_query(q):
    return re.sub(r'\s+', ' ', str(q or '').strip())


def latest_snapshot():
    snaps = sorted(
        (f for f in os.listdir(AUDIT) if re.match(r'GSC-SNAPSHOT-\d{4}-\d{2}-\d{2}\.csv$', f)),
        reverse=True,
    )
    return os.path.join(AUDIT, snaps[0]) if snaps else None


def read_rows(path):
    rows = {}
    with open(path, encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f)
        head = next(reader, None)
        if head is None:
            return rows
        # تشخیص قالب
        if 'مقدار' in head and 'جایگاه' in head:
            # قالب نرمال‌شده: نوع,مقدار,کلیک,نمایش,CTR,جایگاه,برندی؟,صفحهٔ حدسی
            qi = next((i for i, h in enumerate(head) if h == 'مقدار'), 1)
            ci = next((i for i, h in enumerate(head) if 'کلیک' in h), 2)
            ii = next((i for i, h in enumerate(head) if 'نمایش' in h), 3)
            pi = next((i for i, h in enumerate(head) if 'جایگاه' in h), 5)
            for r in reader:
                if not r or r[0] != 'query':
                    continue
                q = norm_query(r[qi]) if qi < len(r) else ''
                rows[q] = {
                    'clicks': to_num(r[ci]) if ci < len(r) else 0.0,
                    'impressions': to_num(r[ii]) if ii < len(r) else 0.0,
                    'position': to_num(r[pi]) if pi < len(r) else 0.0,
                }
        else:
            # قالب گوگل: Top queries,Clicks,Impressions,CTR,Position
            qi = next((i for i, h in enumerate(head) if 'quer' in str(h).lower()), 0)
            ci = next((i for i, h in enumerate(head) if 'click' in str(h).lower()), 1)
            ii = next((i for i, h in enumerate(head) if 'impress' in str(h).lower()), 2)
            pi = next((i for i, h in enumerate(head) if 'position' in str(h).lower()), 4)
            for r in reader:
                if not r:
                    continue
                q = norm_query(r[qi]) if qi < len(r) else ''
                if not q:
                    continue
                rows[q] = {
                    'clicks': to_num(r[ci]) if ci < len(r) else 0.0,
                    'impressions': to_num(r[ii]) if ii < len(r) else 0.0,
                    'position': to_num(r[pi]) if pi < len(r) else 0.0,
                }
    return rows


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding='utf-8') as f:
            return json.load(f)
    return {'updated': None, 'keywords': {}}


# ── حالت زنده (action=overview در api/gsc.php) ────────────────────────────────
TOKEN_FILE = os.path.join(ROOT, '_tools', '.ptf-crm-token')


def resolve_token(cli_token, env=None):
    """ترتیب اولویت توکن نشست CRM: --token > PTF_CRM_TOKEN > _tools/.ptf-crm-token"""
    if cli_token:
        return cli_token.strip()
    if env is None:
        env = os.environ
    v = (env.get('PTF_CRM_TOKEN') or '').strip()
    if v:
        return v
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, encoding='utf-8') as f:
                t = f.read().strip()
                if t:
                    return t.splitlines()[0].strip()
        except OSError:
            pass
    return None


def overview_rows(overview):
    """تبدیل خروجی overview (فهرست queries) به همان قالب rows خوانده‌شده از CSV."""
    rows = {}
    for r in (overview or {}).get('queries') or []:
        if not isinstance(r, dict):
            continue
        q = norm_query(r.get('q'))
        if not q:
            continue
        rows[q] = {
            'clicks': to_num(r.get('clicks')),
            'impressions': to_num(r.get('impressions')),
            'position': to_num(r.get('position')),
        }
    return rows


def fetch_live(base, token, days=90):
    """گرفتن دادهٔ زنده از api/gsc.php (action=overview) با توکن نشست CRM.
    برمی‌گرداند (rows, err) — در موفقیت err=None؛ در خطا rows=None و err متن فارسی."""
    url = base.rstrip('/') + '/api/gsc.php?' + urllib.parse.urlencode(
        {'action': 'overview', 'days': days})
    req = urllib.request.Request(url, headers={
        'X-CRM-Token': token,
        'User-Agent': 'ptf-seo-weekly-watchlist/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = e.read().decode('utf-8', 'replace')
        except Exception:  # noqa: BLE001
            pass
        # اگر بدنه JSON با کلید error باشد، پیام تمیزتر بده
        try:
            j = json.loads(body)
            if isinstance(j, dict) and j.get('error'):
                return None, f'API: {j["error"]} (HTTP {e.code})'
        except json.JSONDecodeError:
            pass
        return None, f'HTTP {e.code}: {body[:300]}'
    except (urllib.error.URLError, OSError) as e:
        return None, f'خطای شبکه: {e}'
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None, 'پاسخ سرور JSON نبود (احتمالاً 500 — فایل تنظیمات GSC روی هاست را چک کنید).'
    if not isinstance(data, dict) or not data.get('ok'):
        err = data.get('error', 'ok=false') if isinstance(data, dict) else 'پاسخ نامعتبر'
        return None, f'API: {err}'
    return overview_rows(data), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', help='مسیر CSV ورودی (پیش‌فرض: تازه‌ترین اسنپ‌شات)')
    ap.add_argument('--live', action='store_true', help='گرفتن مستقیم از API زندهٔ CRM (action=overview)')
    ap.add_argument('--base', default='https://pishtaj.ir', help='آدرس پایهٔ سایت برای --live')
    ap.add_argument('--token', help='توکن نشست CRM (یا PTF_CRM_TOKEN یا _tools/.ptf-crm-token)')
    ap.add_argument('--days', type=int, default=90, help='بازهٔ روز برای --live (سرور در ۷–۱۸۰ می‌گیرد)')
    ap.add_argument('--date', help='برچسب تاریخ (پیش‌فرض: امروز)')
    args = ap.parse_args()

    today = args.date or date.today().isoformat()

    if args.live:
        token = resolve_token(args.token)
        if not token:
            print('❌ برای حالت زنده، توکن نشست CRM لازم است (عمر نشست ۲۴ ساعت).')
            print('   یکی از این‌ها را بدهید:')
            print('     --token <توکن>')
            print('     متغیر محیطی PTF_CRM_TOKEN')
            print('     فایل _tools/.ptf-crm-token (خط اول = توکن)')
            print('   گرفتن توکن: در CRM وارد شوید → DevTools → Network → درخواست api/gsc.php → هدر X-CRM-Token.')
            print('   یا بدون توکن از CSV استفاده کنید:  python3 _tools/seo_weekly_watchlist.py --csv مسیر.csv')
            sys.exit(1)
        rows, err = fetch_live(args.base, token, args.days)
        if err is not None:
            print('❌ گرفتن دادهٔ زنده ناموفق بود: ' + err)
            print('   اگر توکن منقضی شده، دوباره از مرورگر بردارید (عمر ۲۴ ساعت) یا از CSV استفاده کنید.')
            sys.exit(1)
        source_label = f'live overview از {args.base} ({args.days} روز)'
        print(f'📡 دادهٔ زنده از {args.base} دریافت شد ({len(rows)} کوئری).')
    else:
        csv_path = args.csv or latest_snapshot()
        if not csv_path:
            print('❌ هیچ اسنپ‌شات GSC-SNAPSHOT-*.csv در _audit نیست؛ خروجی CSV سرچ کنسول را بدهید یا --live بزنید.')
            sys.exit(1)
        if not os.path.exists(csv_path):
            print(f'❌ فایل یافت نشد: {csv_path}')
            sys.exit(1)
        rows = read_rows(csv_path)
        source_label = '_audit/' + os.path.basename(csv_path)

    state = load_state()
    state['updated'] = today
    state['source'] = source_label

    lines = []
    lines.append('# گیت پیشرفت سئو — ' + today)
    lines.append('')
    lines.append('**منبع داده:** ' + source_label)
    lines.append('')
    lines.append('| کلمهٔ هدف | صفحه | نمایش | کلیک | جایگاه | روند نسبت به قبل |')
    lines.append('|---|---|---|---|---|---|')

    for q, page in TARGETS:
        k = state['keywords'].setdefault(q, {'page': page, 'history': []})
        prev = k['history'][-1] if k['history'] else None
        row = rows.get(q)
        if row is None:
            disp = '—'; clk = '—'; pos = 'خارج از ۱۰۰'
            entry = {'date': today, 'impressions': 0.0, 'clicks': 0.0, 'position': None}
            trend = 'بدون نمایش'
        else:
            disp = '%.0f' % row['impressions']
            clk = '%.0f' % row['clicks']
            pos = '%.1f' % row['position'] if row['position'] else '—'
            entry = {'date': today, 'impressions': row['impressions'],
                     'clicks': row['clicks'], 'position': row['position']}
            if prev and prev['date'] != today and prev['impressions'] > 0 and row['impressions'] > prev['impressions']:
                trend = '↑ نمایش'
            elif prev and prev['date'] != today and row['impressions'] < (prev['impressions'] or 0):
                trend = '↓ نمایش'
            elif prev and prev['date'] != today and prev['position'] and row['position'] and row['position'] < prev['position']:
                trend = '↑ رتبه'
            elif prev and prev['date'] != today and row['position'] and prev['position'] and row['position'] > prev['position']:
                trend = '↓ رتبه'
            else:
                trend = 'تثبیت' if prev and prev['date'] != today else 'شروع'
        # ناپذیر-تکرار: اجرای دوباره در همان روز، همان سطر را به‌روز می‌کند
        if k['history'] and k['history'][-1]['date'] == today:
            k['history'][-1] = entry
        else:
            k['history'].append(entry)
        lines.append(f'| {q} | `{page}` | {disp} | {clk} | {pos} | {trend} |')

    # قضاوت خودکار «گیت پیشرفت» (همان منطق گام E)
    lines.append('')
    lines.append('## فرمان هفته')
    money = [q for q, _ in TARGETS[:2]]
    money_rows = {q: rows.get(q) for q in money}
    if all(money_rows.get(q) for q in money):
        p1, p2 = money_rows[money[0]]['position'], money_rows[money[1]]['position']
        if p1 and p1 <= 10 and p2 and p2 <= 10:
            verdict = '✅ هر دو کلمهٔ هدف وارد صفحهٔ اول شدند — به تثبیت و CTR ادامه دهید.'
        elif p1 and p1 <= 20 and p2 and p2 <= 20:
            verdict = '🟡 هر دو در صفحهٔ ۱–۲ — بازبینی عنوان/لینک داخلی و ادامهٔ لینک‌سازی.'
        else:
            verdict = '🟠 نمایش داریم اما رتبه >۲۰ — بازبینی عنوان/توضیح و لینک داخلی.'
    elif any(money_rows.get(q) for q in money):
        verdict = '🟠 یک کلمه دیده می‌شود و دیگری نه — برای کلمهٔ غایب: بررسی ایندکس/کانونیکال و درخواست ایندکس.'
    else:
        verdict = '🔴 هنوز نمایشی از کلمات هدف نیست — Request Indexing + لینک داخلی + صبر برای خزش.'
    lines.append(verdict)
    lines.append('')

    with open(STATE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    report = os.path.join(AUDIT, f'SEO-WEEKLY-{today}.md')
    with open(report, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print('✅', report)
    print('✅', os.path.relpath(STATE, ROOT))
    print(verdict)


if __name__ == '__main__':
    main()
