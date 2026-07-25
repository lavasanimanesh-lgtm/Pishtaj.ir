# گزارش رگرسیون v31.7.68

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.68`  
**موضوع:** BUG-AUTH-MOBILE-USER-001 — رفع ورود کاربر موجود از موبایل

---

## نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **223** | — |
| فایل‌های PASS | **223** | PASS |
| فایل‌های FAIL | **0** | PASS |
| مجموع چک‌های PASS | **4697** | PASS |
| مجموع چک‌های FAIL | **0** | PASS |
| تستر جدید Mobile Login | `tester245-mobile-login-user-merge.js` | 11/11 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T16:22:05.699Z",
  "version": "v31.7.68",
  "testers_total": 223,
  "files_pass": 223,
  "files_fail": 0,
  "checks_pass": 4697,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## تستر جدید

### `_tools/uat/tester245-mobile-login-user-merge.js`

پوشش:

1. وجود helper سروری `load_all_crm_users_sources()`.
2. merge منابع `users`, `crm_users`, `sync/ptf_crm_users.json`.
3. حفظ passhash در merge با رکورد safe/stale.
4. استفاده `auth_login` از منبع merged.
5. استفاده `users_get` از منبع merged بدون افشای passhash.
6. استفاده `users_sync` از منبع merged برای بازیابی passhash.
7. fallback مستقیم `auth_login` در کلاینت وقتی `users_get` کاربر را نشان نمی‌دهد.
8. ذخیره token/session/local user در موفقیت fallback.
9. حذف پیام خطای قدیمی user-not-found پیش از direct auth.

نتیجه مستقیم:

```text
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester15-sprint78: 17 PASS / 0 FAIL
tester184-auth-contract-e2e: 7 PASS / 0 FAIL
tester189-users-vanish: 10 PASS / 0 FAIL
tester200-sms-auth-token: 12 PASS / 0 FAIL
tester231-tools-license-admin: 17 PASS / 0 FAIL
tester245-mobile-login-user-merge: 11 PASS / 0 FAIL
```

---

## رگرسیون میانی و رفع آن

در اولین اجرای full regression بعد از patch، `tester15-sprint78.js` یک FAIL داد چون تست هنوز متن قدیمی user-not-found را انتظار داشت. تست با رفتار جدید هم‌راستا شد:

```text
پیام جدید: احراز هویت مستقیم سرور + راهنمای همگام‌سازی کاربران
```

پس از اصلاح تست، full regression کامل PASS شد.

---

## فایل‌های تغییر یافته/درگیر در تست

```text
api/crm.php
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester15-sprint78.js
_tools/uat/tester189-users-vanish.js
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester245-mobile-login-user-merge.js
_tools/last-regression.json
REGRESSION-REPORT-v21.3.md  (auto-updated by regression runner)
RELEASE-NOTES-v31.7.68.md
REGRESSION-REPORT-v31.7.68.md
```

---

## دستورهای اجراشده

```bash
node _tools/uat/tester184-auth-contract-e2e.js
node _tools/uat/tester189-users-vanish.js
node _tools/uat/tester200-sms-auth-token.js
node _tools/uat/tester231-tools-license-admin.js
node _tools/uat/tester245-mobile-login-user-merge.js
node _tools/uat/tester227-storage-quota-foundation.js
for f in assets/js/*.js crm/*.js tools/*.js _tools/uat/tester24*.js _tools/uat/tester245-mobile-login-user-merge.js; do node --check "$f"; done
node _tools/run-full-regression.js
```

---

## محدودیت تست PHP

در sandbox فعلی `php` نصب نیست، پس E2E واقعی PHP و syntax check مستقیم اجرا نشد. پس از deploy روی هاست اجرا شود:

```bash
php -l api/crm.php
```

---

## نتیجه نسبت به گیت هنداور

رگرسیون کامل PASS شد:

- 223/223 فایل تستر PASS
- 4697/4697 چک PASS
- 0 FAIL
- 0 prebroken
- 0 hung

`python3 _tools/audit.py` نیز اجرا شد و نتیجه PASS بود:

```text
✅ همه بررسی‌ها PASS شدند.
```
