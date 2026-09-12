#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PTF — راه‌انداز اتصال Google Search Console (GSC-ONBOARD)
==========================================================
زیرساخت GSC (api/gsc.php + پنل CRM + واچ‌لیست هفتگی + ردیاب ایندکس) کامل است؛
تنها قدمِ باقی‌مانده «ساختنِ درستِ api/gsc-config.php» روی هاست است. این ابزار
آن قدم را خطاناپذیر می‌کند:

  حالت‌ها:
    ۱) تولید از فایل JSON کلیدِ سرویس‌اکانت (پیشنهادی — بدون کپی دستی):
         python3 _tools/gsc_onboard.py --from-json ~/Downloads/ptf-gsc-xxxx.json \
             --site sc-domain:pishtaj.ir --out api/gsc-config.php
    ۲) تولید از مقادیر دستی:
         python3 _tools/gsc_onboard.py --email ptf-gsc@PROJECT.iam.gserviceaccount.com \
             --key ~/Downloads/private.pem --site https://pishtaj.ir/ --out api/gsc-config.php
    ۳) اعتبارسنجی یک فایلِ موجود (قبل از آپلود روی هاست — خطاها را همین‌جا می‌گیرد):
         python3 _tools/gsc_onboard.py --check api/gsc-config.php
    ۴) راهنمای گام‌به‌گام:
         python3 _tools/gsc_onboard.py --guide

  چرا این ابزار؟ شایع‌ترین علتِ خطای ۵۰۰ در گیت CI «کپیِ ناقصِ کلید خصوصی» است
  (جفت‌نشدن نقل‌قول/بک‌اسلش/خط جدید). این ابزار کلید را مستقیم از JSON رسمی گوگل
  استخراج و با escape درست می‌نویسد، و با openssl صحتِ کلید را پیش از نوشتن می‌سنجد.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE = os.path.join(ROOT, 'api', 'gsc-config.sample.php')

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
SA_SUFFIX = 'iam.gserviceaccount.com'


def extract_from_json(path: str):
    """خواندن client_email و private_key از فایل JSON کلیدِ سرویس‌اکانت گوگل."""
    with open(path, encoding='utf-8') as fh:
        d = json.load(fh)
    if d.get('type') != 'service_account':
        raise SystemExit(f'❌ فایل JSON از نوع service_account نیست (type={d.get("type")!r}). '
                         'باید همان فایل «Create new key → JSON» از Credentials باشد.')
    email = d.get('client_email')
    key = d.get('private_key')
    if not email or not key:
        raise SystemExit('❌ فایل JSON کلید، client_email یا private_key ندارد.')
    return email, key


def validate_email(email: str) -> list[str]:
    errs = []
    if not EMAIL_RE.match(email):
        errs.append(f'ایمیل «{email}» قالب ایمیل معتبر ندارد.')
    elif not email.lower().endswith(SA_SUFFIX):
        errs.append(f'ایمیل «{email}» به {SA_SUFFIX!r} ختم نمی‌شود؛ '
                    'حتماً ایمیلِ سرویس‌اکانت باشد (نه ایمیل شخصی).')
    return errs


def validate_pem(pem: str) -> list[str]:
    errs = []
    if 'BEGIN PRIVATE KEY' not in pem or 'END PRIVATE KEY' not in pem:
        return ['کلید خصوصی، هدر/فوتر PEM ندارد (BEGIN/END PRIVATE KEY).']
    # راستی‌آزمایی ساختاری با openssl (در صورت وجود)
    try:
        with tempfile.NamedTemporaryFile('w', suffix='.pem', delete=False) as t:
            t.write(pem)
            tmp = t.name
        r = subprocess.run(['openssl', 'pkey', '-in', tmp, '-noout'],
                           capture_output=True, text=True, timeout=10)
        os.unlink(tmp)
        if r.returncode != 0:
            errs.append('openssl نتوانست کلید را تجزیه کند (کلید ناقص/خراب): ' +
                        (r.stderr.strip().split('\n')[0] if r.stderr else 'unknown'))
    except FileNotFoundError:
        pass  # openssl نیست؛ فقط بررسی ساختاری
    except Exception as e:  # noqa: BLE001
        errs.append(f'خطا در راستی‌آزمایی openssl: {e}')
    return errs


def validate_site(site: str) -> list[str]:
    if site.startswith('sc-domain:'):
        return []
    if re.match(r'^https?://[^\s/]+/$', site):
        return []
    return [f'«{site}» نه sc-domain: است نه آدرس https://…/ — نمونه: sc-domain:pishtaj.ir یا https://pishtaj.ir/']


def render_config(client_email: str, private_key: str, site_url: str) -> str:
    key_php = private_key.replace('\r\n', '\n').replace('\r', '\n').rstrip('\n') + '\n'
    key_php = key_php.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    return (
        '<?php\n'
        '/**\n'
        ' * اتصال Google Search Console — ساخته‌شده توسط _tools/gsc_onboard.py\n'
        ' * این فایل هرگز در گیت کامیت نمی‌شود (در .gitignore است).\n'
        ' */\n'
        'return [\n'
        f"    'client_email' => '{client_email}',\n"
        '    /* کلید خصوصی با escape درست (با \\n داخل " دوتایی) */\n'
        f'    \'private_key\'  => "{key_php}",\n'
        f"    'site_url'     => '{site_url}',\n"
        '];\n'
    )


def parse_config(path: str):
    """خواندن و تجزیهٔ یک gsc-config.php موجود (بدون اجرای PHP)."""
    if not os.path.exists(path):
        raise SystemExit('❌ فایل یافت نشد: ' + path + '\n   از روی api/gsc-config.sample.php بسازید (یا --from-json بدهید).')
    s = open(path, encoding='utf-8').read()
    m = re.search(r"'client_email'\s*=>\s*'([^']*)'", s)
    email = m.group(1) if m else None
    key = None
    m = re.search(r"'private_key'\s*=>\s*\"(.*?)\"\s*,", s, re.S)
    if m:
        raw = m.group(1)
        # escapeهای PHP داخل «" دوتایی»: خط جدید/بک‌اسلش/نقل‌قول
        key = (raw.replace('\\n', '\n')
                  .replace('\\r', '\r')
                  .replace('\\"', '"')
                  .replace('\\\\', '\\'))
    m = re.search(r"'site_url'\s*=>\s*'([^']*)'", s)
    site = m.group(1) if m else None
    return email, key, site


def check(path: str) -> int:
    print(f'🔎 اعتبارسنجی {path} …\n')
    email, key, site = parse_config(path)
    errs = []
    if not email:
        errs.append('client_email پیدا نشد.')
    else:
        errs += validate_email(email)
    if not key or 'BEGIN' not in key:
        errs.append('private_key پیدا نشد یا خالی است.')
    else:
        errs += validate_pem(key)
    if not site:
        errs.append('site_url پیدا نشد.')
    else:
        errs += validate_site(site)

    print(f'  client_email : {email or "—"}')
    print(f'  site_url     : {site or "—"}')
    print(f'  private_key  : {"یافت شد (" + str(len(key)) + " کاراکتر)" if key else "—"}')
    print()
    if errs:
        print('❌ مشکلات:')
        for e in errs:
            print('   • ' + e)
        print('\nاصلاح کنید و دوباره --check بزنید. تا وقتی این‌جا سبز نشود، فایل را روی هاست نبرید.')
        return 1
    print('✅ کانفیگ سالم است — آمادهٔ آپلود روی هاست کنار api/.')
    print('   بعد از آپلود: CRM ← مدیریت سایت ← تب سئو ← «🧪 آزمون اتصال GSC»')
    return 0


def guide() -> None:
    print('''🎯 فعال‌سازی اتصال GSC — دو مسیر

━━━ مسیر A: API زنده (پیشنهادی — ۵ دقیقه) ━━━
 ۱) console.cloud.google.com → پروژه → APIs & Services → Library → «Search Console API» → Enable
 ۲) Credentials → Create credentials → Service account  (نام: ptf-gsc)
 ۳) روی سرویس‌اکانت → Keys → Add key → Create new key → JSON  (فایل دانلود می‌شود)
 ۴) تولیدِ کانفیگ (بدون کپی دستی):
      python3 _tools/gsc_onboard.py --from-json ~/Downloads/ptf-gsc-XXXX.json \\
          --site sc-domain:pishtaj.ir --out api/gsc-config.php
    (برای پراپرتی URL معمولی به‌جای Domain:  --site https://pishtaj.ir/ )
 ۵) اعتبارسنجی قبل از آپلود:
      python3 _tools/gsc_onboard.py --check api/gsc-config.php
 ۶) فایل api/gsc-config.php را روی هاست کنار api/ آپلود کنید (کامیت نمی‌شود).
 ۷) Search Console ← Settings ← Users and permissions ← Add user
      ایمیلِ client_email را با سطح «Full» اضافه کنید (نه از Google Cloud/IAM).
 ۸) CRM ← مدیریت سایت ← تب سئو ← «🧪 آزمون اتصال GSC» → باید سبز شود و فهرستِ پراپرتی‌ها بیاید.

━━━ مسیر B: بدون API — خروجی CSV (همین امروز) ━━━
 ۱) در Search Console: Performance → تاریخِ دلخواه (۹۰ روز) → Export → Queries.csv و Pages.csv
 ۲) بدهید به من (یا خودتان در مخزن):
      python3 _tools/gsc_import.py Queries.csv Pages.csv
 ۳) واچ‌لیست هفتگی با همان داده به‌روز می‌شود:
      python3 _tools/seo_weekly_watchlist.py
 این مسیر فوراً کار می‌کند ولی دستی است؛ مسیر A چرخه را خودکار و زنده می‌کند.

چرا Full لازم است؟ چون دکمهٔ «ثبت نقشه» (sitemap_submit) و URL Inspection به سطح Full نیاز دارند.''')


def main() -> int:
    ap = argparse.ArgumentParser(description='راه‌انداز اتصال GSC')
    ap.add_argument('--from-json', help='فایل JSON کلید سرویس‌اکانت گوگل')
    ap.add_argument('--email', help='client_email سرویس‌اکانت')
    ap.add_argument('--key', help='فایل PEM کلید خصوصی')
    ap.add_argument('--site', help='site_url (مثل sc-domain:pishtaj.ir یا https://pishtaj.ir/)')
    ap.add_argument('--out', default='api/gsc-config.php', help='مسیر خروجی (پیش‌فرض: api/gsc-config.php)')
    ap.add_argument('--check', help='اعتبارسنجی فایل موجود')
    ap.add_argument('--guide', action='store_true', help='راهنمای گام‌به‌گام')
    a = ap.parse_args()

    if a.guide:
        guide()
        return 0
    if a.check:
        return check(a.check)

    # تولید
    if a.from_json:
        email, key = extract_from_json(a.from_json)
    else:
        if not a.email or not a.key:
            raise SystemExit('❌ یا --from-json بدهید یا هر دو --email و --key.')
        email = a.email
        with open(a.key, encoding='utf-8') as fh:
            key = fh.read()
    site = a.site or 'sc-domain:pishtaj.ir'

    errs = validate_email(email) + validate_pem(key) + validate_site(site)
    if errs:
        print('❌ قبل از نوشتن، این مشکلات را ببینید:')
        for e in errs:
            print('   • ' + e)
        return 1

    out = os.path.join(ROOT, a.out) if not os.path.isabs(a.out) else a.out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(render_config(email, key, site))
    print(f'✅ کانفیگ نوشته شد: {a.out}')
    print(f'   client_email : {email}')
    print(f'   site_url     : {site}')
    print(f'   private_key  : {len(key)} کاراکتر، escape خودکار شد.')
    print('\nقدم بعد: آن را روی هاست کنار api/ بگذارید و در Search Console با سطح Full اضافه کنید،')
    print('سپس در CRM ← تب سئو ← «🧪 آزمون اتصال GSC» را بزنید.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
