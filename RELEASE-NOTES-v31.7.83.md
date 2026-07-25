# Release Notes — v31.7.83

## عنوان ریلیز
**TOOLS-STAFF-LICENSE-PERSISTENCE-001 + ADV-CV-SEO-FOUNDATION-001**

## RCA / دلیل دقیق
گزارش شد که برای پرسنل داخلی، بعد از یک بار ورود/فعال‌سازی، ابزار در نشست‌های بعدی لایسنس را نمی‌شناسد. علت فنی این بود که grant لایسنس فقط در `sessionStorage` نگهداری می‌شد و برای staff/internal persistence کافی نبود. همچنین grant همه لایسنس‌ها فقط ۲ ساعت اعتبار داشت. علاوه بر این، بررسی quota در `license_check` برای staff_internal به‌صورت صریح exempt نشده بود.

از طرف دیگر، پس از محصولی شدن ابزار کنترل ولو، لازم بود پایه SEO صفحه ابزارها برای کلیدواژه‌های مرتبط با سایزینگ کنترل ولو تقویت شود.

## اصلاحات لایسنس

### Backend
- اضافه شد:

```php
tools_grant_ttl_seconds($lic)
```

- مدت grant:
  - `staff_internal`: سی روز
  - `enterprise` و `subscription`: هفت روز
  - `single_report`: دو ساعت
- خروجی grant شامل `ttl` و `persistent` شد.
- `license_check` برای `staff_internal` از quota exhaustion معاف شد.
- `tools_safe_license()` اکنون `quotaExempt` و `grantTtlSeconds` برمی‌گرداند.

### Frontend
- کلید persistent جدید:

```js
ptf_tools_license_grant_persist
```

- `ptfToolsGrant()` اکنون ابتدا `sessionStorage` و سپس `localStorage` را بررسی می‌کند.
- برای staff/internal، enterprise و subscription، grant در localStorage ذخیره می‌شود.
- `grant_verify` برای پاک‌سازی grantهای revoked/invalid اضافه شد.
- `advanced-report-ui.js` نیز fallback persistent grant دارد.

## اصلاحات SEO کنترل ولو
- اضافه شدن بخش محتوایی SEO در `/tools/` با anchor:

```text
#control-valve-sizing-seo
```

- پوشش کلیدواژه‌ها:
  - سایزینگ کنترل ولو
  - محاسبه Cv کنترل ولو
  - انتخاب کنترل ولو
  - control valve sizing
  - Cv calculation
  - کنترل ولو بخار
  - کنترل ولو گاز
  - کاویتاسیون کنترل ولو
- اضافه شدن JSON-LD برای:
  - `SoftwareApplication`
  - `FAQPage`
  - `TechArticle`

## پاسخ وضعیت ابزار کنترل ولو
ابزار کنترل ولو اکنون از نظر مسیر محصولی قابل گزارش‌دهی تکمیل شده است: draft، final gate، گزارش نهایی HTML انگلیسی، quota، staff/internal license، engineering validation و vendor validation دارد. اما vendor-certified final sizing و PDF باینری سمت سرور هنوز فاز بعدی هستند.

## فایل‌های تغییرکرده

```text
api/tools.php
tools/tools-ui.js
tools/advanced-report-ui.js
tools/advanced-tools-ui.js
tools/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
_tools/uat/tester257-tools-staff-license-persistence.js
_tools/uat/tester258-control-valve-seo-foundation.js
PTF-MASTER-HANDOVER.md
RELEASE-NOTES-v31.7.83.md
REGRESSION-REPORT-v31.7.83.md
```

## تست
- تست staff license persistence اضافه شد.
- تست SEO foundation اضافه شد.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
