# RELEASE NOTES — v34.7.55 (۱۴۰۵/۰۵/۲۹ — 2026-08-20)

## اسکیمای کامل JobPosting — رفع خطای «Missing field datePosted» در GSC

### مشکل

Google Search Console صفحهٔ آگهی فرصت شغلی را ایندکس نمی‌کرد:

- 🔴 **خطا:** `Missing field "datePosted"` — فیلد الزامی JobPosting در JSON-LD نبود.
- 🟡 **اخطارها:** نبود فیلدهای توصیه‌شدهٔ `validThrough`، `employmentType`، `identifier`،
  `directApply` و `baseSalary`.

### اصلاح — `api/careers.php` (تولیدکنندهٔ واحد صفحهٔ آگهی: استاتیک + `view.php`)

| فیلد | مقدار |
|---|---|
| `datePosted` ✅ الزامی | از **`publishedAt`** رکورد آگهی (fallback: `createdAt` → `updatedAt`) |
| `validThrough` | ۹۰ روز پس از تاریخ انتشار (ISO 8601) |
| `employmentType` | از فیلد جدید فرم CRM؛ whitelist (`FULL_TIME` پیش‌فرض، `PART_TIME`، `CONTRACTOR`، `TEMPORARY`، `INTERN`، `OTHER`) |
| `identifier` | `PropertyValue` با نام سازمان + slug آگهی |
| `directApply` | `true` (فرم ارسال رزومه روی همان صفحه است) |
| `hiringOrganization.logo` | لوگوی سایت |
| `description` | متن کامل شرح فارسی (سقف ۵۰۰۰ کاراکتر — قبلاً به ۴۰۰ بریده می‌شد) |
| `baseSalary` | **اختیاری** — فقط اگر مدیر بازهٔ حقوق پیشنهادی را وارد کند (تومان/ماه → ریال ×۱۰، `MonetaryAmount/IRR/MONTH`) |

### نگه‌داری تاریخ انتشار (`publishedAt`)

- `save_job`: آگهی منتشرشدهٔ بدون `publishedAt` → اکنون؛ ویرایش‌های بعدی آن را عوض
  نمی‌کنند (datePosted پایدار می‌ماند).
- `reopen_job`: انتشار مجدد = `publishedAt` تازه (آگهی جدید از نظر گوگل).
- آگهی بسته: طبق قبل `noindex` و **بدون** اسکیما — خطای «آگهی منقضی» گوگل رخ نمی‌دهد.

### فرم CRM (`crm/careers.js`)

- کشویی جدید **«نوع همکاری»** (پیش‌فرض تمام‌وقت).
- دو فیلد اختیاری **«بازه حقوق پیشنهادی — تومان در ماه»** (با پذیرش ارقام فارسی)؛ اگر
  خالی بماند baseSalary درج نمی‌شود.

### تست

- تستر جدید `tester458-v34.7.55-jobposting-schema.js` (در گیت CI) — ۲۶ قرارداد.
- **گیت CI: ۷۴ PASS / ۰ FAIL** · نگهبان معماری: PASS.

### ⚠️ اقدام لازم پس از دیپلوی (کاربر)

1. صفحهٔ آگهی **استاتیک** است؛ آگهی فعلی را در CRM باز کنید و «🚀 انتشار / ذخیره»
   بزنید تا صفحه با اسکیمای جدید بازتولید شود (نوع همکاری را هم انتخاب کنید).
2. در GSC، آدرس `https://pishtaj.ir/careers/<slug>/` را **Test Live URL** کنید — خطای
   قرمز datePosted باید رفع شده باشد — سپس **Request Indexing** بزنید.
3. اخطار زرد `baseSalary` فقط در صورت وارد نکردن بازهٔ حقوق می‌ماند و مانع ایندکس نیست.
