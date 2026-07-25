# 🚨 گزارش رسمی Incident — BUG-AUTH-001 (قطعی کامل احراز هویت Production)

**شناسه:** INC-2026-001 / BUG-AUTH-001
**بازه وقوع:** استقرار v31.7.4 (2026-07-18) تا hotfix v31.7.8 (2026-07-19)
**شدت:** SEV-1 — قطعی ۱۰۰٪ عملکرد احرازشده برای تمام کاربران
**وضعیت:** رفع کد انجام شده (v31.7.8) — **تأیید ریکاوری روی سرور Production هنوز ثبت نشده** (بند ۷)
**نگارش این سند:** مطابق پروتکل ۷مرحله‌ای QA/QC در `PTF-MASTER-HANDOVER.md`

---

## ۱. تحلیل ریشه‌ای علت (RCA)

### زنجیره رویداد

1. در v31.7.4، برای رفع `BUG-AUDIT-003` («غیرفعال بودن verify_request»)، تابع `verify_request()` در `api/crm.php` فعال شد — اما با مکانیزم `hash_hmac('sha256', $_SERVER['REMOTE_ADDR'], secret)` استاتیک.
2. فرانت‌اند (`api/auth.php` → `auth_generate_token()` + `crm/sync.js`) توکن JWT-مانند per-user با انقضای ۷ روزه تولید و در هدر `X-CRM-Token` ارسال می‌کرد.
3. توکن مورد انتظار سرور (HMAC از IP) **هیچ‌جا در فرانت‌اند تولید نمی‌شد** → مقایسه همیشه شکست می‌خورد → **۱۰۰٪ درخواست‌های احرازشده 401**.
4. باگ‌های زنجیره‌ای هم‌جنس (تغییر یک سمت قرارداد بدون سمت دیگر): BUG-AUTH-002 (`users_get` خارج از public_actions درحالی‌که در لحظه لاگین توکنی وجود ندارد)، BUG-AUTH-003 (bridge.js بدون هدر توکن)، BUG-AUTH-004 (overwrite شدن `adminHash` در `saveSet()`)، BUG-AUTH-005 (doLogin منتظر passhash‌ای که users_get دیگر نمی‌فرستاد)، BUG-AUTH-006 (auth_login بی‌خبر از sync directory).

### ریشه‌های فرآیندی (مهم‌تر از ریشه فنی)

| # | ریشه | شرح |
|---|------|-----|
| R1 | **دور زدن گیت staging** | `BASELINE-START-v31.7.md` صریحاً تغییر Production را تا فراهم شدن staging (STAGE0-ENV-001) ممنوع کرده بود؛ چک‌لیست staging تماماً خالی است؛ v31.7.4 مستقیم Production شد |
| R2 | **فقدان تست قرارداد end-to-end** | ۱۶۱ تستر رگرسیون همگی static pattern-matching هستند؛ هیچ تستی مسیر «login → دریافت توکن → مصرف توکن» را واقعاً اجرا نمی‌کرد |
| R3 | **اصلاح امنیتی ایزوله** | BUG-AUDIT-003 فقط server-side دیده شد؛ contract مصرف‌کننده (فرانت) بررسی نشد |
| R4 | **نبود مانیتورینگ پس از deploy** | قطعی ۱۰۰٪ 401 باید در دقیقه اول دیده می‌شد، نه از گزارش کاربران |

## ۲. فایل‌های تغییریافته (در hotfixهای v31.7.7/v31.7.8)

- `api/crm.php` — بازگشت `verify_request()` به JWT سازگار با `auth.php`؛ افزودن `users_get`/`sms_status`/`data_rev` به `public_actions`؛ خواندن کاربران از sync directory در `auth_login` و `users_get`
- `crm/bridge.js` — ارسال هدر `X-CRM-Token` در `api()`, `pollEvents()`, `syncServerInbox()`
- `crm/index.html` — merge (نه overwrite) در `saveSet()`؛ لاگین کاربر عادی از مسیر سروری `auth_login`؛ bump به v31.7.8
- `crm/sw.js` — cache → `ptf-crm-v31.7.8`

## ۳. تحلیل دامنه تأثیر

- **کاربران:** قطعی کامل ورود/داده برای همه نقش‌ها در بازه incident.
- **داده:** طبق ریلیزنوت و بررسی کد، هیچ migration/حذف انجام نشده؛ مکانیزم sync دست‌نخورده. ⚠️ صحت این ادعا روی سرور واقعی هنوز با `data-health-check.php` تأیید نشده.
- **امنیت:** در v31.7.8 سه endpoint عمومی شدند (`users_get`, `sms_status`, `data_rev`). بررسی کد تأیید می‌کند `users_get` فقط فیلدهای امن برمی‌گرداند (راستی‌آزمایی runtime T2 در بند ۵). پنجره incident باید از نظر دسترسی مشکوک در لاگ سرور بررسی شود (اقدام باز A3).

## ۴. نتایج تست رگرسیون (بازاجرای مستقل — 2026-07-19)

| گیت | نتیجه بازاجرا |
|-----|----------------|
| `node _tools/run-full-regression.js` | **161/161 فایل PASS — 3808/3808 چک PASS — 0 FAIL** ✅ (بازتولید مستقل ادعای REGRESSION-REPORT-v31.7.8) |
| `python3 _tools/audit.py` | **همه ۹ بخش PASS** ✅ |

## ۵. مدارک و شواهد قابل استناد (Runtime E2E — اجرای واقعی PHP)

اجرا روی PHP 8.4 built-in server با fixture مصنوعی (کاربر `testuser` نقش sales) — **نه pattern-matching، بلکه فراخوانی واقعی HTTP:**

| # | سناریو | انتظار | نتیجه |
|---|--------|--------|-------|
| T1 | `data_rev` بدون توکن | 200 (public) | ✅ `{"ok":true,"rev":0}` |
| T2 | `users_get` بدون توکن | 200، بدون passhash | ✅ فقط فیلدهای امن — passhash غایب |
| T3 | `data_pull` بدون توکن | 401 + needLogin | ✅ HTTP:401 |
| T4 | `auth_login` با اعتبار درست | توکن JWT | ✅ توکن ۱۴۴ کاراکتری صادر شد |
| T5 | `auth_login` با رمز غلط | رد | ✅ invalid credentials |
| T6 | **`data_pull` با JWT (همان مسیری که در v31.7.4 قطع بود)** | **200** | ✅ **HTTP:200** `{"ok":true,...}` |
| T7 | `data_pull` با توکن جعلی | 401 | ✅ HTTP:401 |
| T8 | role-scoping: نقش sales | عدم دریافت کلید مالی | ✅ صفر کلید مالی |
| T9 | `get_events` با توکن | 200 | ✅ HTTP:200 |
| T10 | push کلید مالی توسط sales | فیلتر سروری | ✅ `"forbidden":["ptf_crm_finance"]` — فایل ساخته نشد |
| T11 | سپر داده‌صفر (push خالی روی ناخالی) | reject | ✅ `"rejected":["ptf_crm_customers"]` — داده سرور دست‌نخورده |

**نتیجه: قرارداد auth در کد v31.7.8 از نظر runtime سالم است.** (محیط: PHP CLI ایزوله؛ جایگزین تأیید سرور واقعی Production نیست.)

## ۶. مراحل راستی‌آزمایی توسط کارفرما

طبق `QUICK-TEST-GUIDE-v31.7.8.md` + `PHASE0-PRODUCTION-RUNBOOK.md` (سند جدید همراه این گزارش).

## ۷. اقدامات باز (این incident هنوز بسته نیست)

| # | اقدام | مسئول | وضعیت |
|---|-------|-------|--------|
| A1 | اجرای QUICK-TEST-GUIDE روی Production برای ۴ نقش و ثبت نتیجه | ادمین سرور | ⏳ باز |
| A2 | اجرای `data-health-check.php` روی سرور + حذف فایل پس از استفاده | ادمین سرور | ⏳ باز |
| A3 | بررسی access log بازه 07-18 تا 07-19 برای دسترسی مشکوک | ادمین سرور | ⏳ باز |
| A4 | بک‌آپ کامل خارج از سرور از `crm/data/` | ادمین سرور | ⏳ باز |
| A5 | تصمیم رسمی کارفرما درباره STAGE0-ENV-001 | کارفرما | ⏳ باز |

## ۸. اقدامات پیشگیرانه اعمال‌شده در همین بسته

1. **تستر قرارداد auth E2E:** `_tools/uat/tester184-auth-contract-e2e.js` — در صورت وجود PHP، سرور واقعی بالا می‌آورد و مسیر login→token→pull→401 را اجرا می‌کند (در نبود PHP، حالت static-contract fallback).
2. **گیت انتشار در audit.py:** بخش ۱۰ جدید — وجود `RELEASE-NOTES-v{VER}.md` و `REGRESSION-REPORT-v{VER}.md` منطبق با `window.VER` را الزامی می‌کند تا تکرار حفره مستندات v31.7.3–v31.7.7 از نظر مکانیکی ناممکن شود.
3. اسناد حاکمیتی (`PTF-MASTER-HANDOVER.md`، `BASELINE-START-v31.7.md`) با وضعیت واقعی v31.7.8 هم‌تراز شدند.

---
*تهیه‌کننده: ایجنت ممیزی/توسعه — 2026-07-19*
