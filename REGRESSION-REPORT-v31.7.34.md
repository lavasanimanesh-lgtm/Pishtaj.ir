# 📊 گزارش رگرسیون v31.7.34

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.34`  
**موضوع:** WEB-SEO-002 — Meta & SERP Foundation

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **189** | — |
| فایل‌های PASS | **189** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4209** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید SEO Meta | `tester211-seo-meta-foundation.js` | ✅ 25/25 |

خروجی کامل runner:

```json
{
  "date": "2026-07-20T23:00:48.788Z",
  "version": "v31.7.34",
  "testers_total": 189,
  "files_pass": 189,
  "files_fail": 0,
  "checks_pass": 4209,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester211-seo-meta-foundation.js`

پوشش:

1. هیچ صفحه public دارای meta description کوتاه‌تر از 70 کاراکتر نیست.
2. descriptionهای generic دسته‌ای حذف شده‌اند.
3. هیچ description تکراری بین صفحات public وجود ندارد.
4. صفحات استراتژیک title و description کنترل‌شده دارند.
5. نمونه صفحات مرکز دانش که قبلاً generic بودند، description اختصاصی و مرتبط دارند.

نتیجه مستقیم:

```text
tester211-seo-meta-foundation: 25 PASS / 0 FAIL
```

---

## 📊 وضعیت SEO metadata پس از اصلاح

```text
Short descriptions < 70: 0
Generic category descriptions: 0
Duplicate description groups: 0
Strategic page title/description tests: PASS
```

نکته: بهینه‌سازی titleهای طولانی همه صفحات غیر اولویت‌دار در backlog گام‌های بعدی باقی می‌ماند. این ریلیز عمداً روی descriptionهای short/generic/duplicate و صفحات استراتژیک تمرکز دارد.

---

## 📁 فایل‌های تغییر یافته

```text
index.html
rfq/index.html
tracking/index.html
supplier/index.html
knowledge-center/index.html
tools/index.html
services/pumps/index.html
services/piping-equipment/index.html
services/instrumentation-equipment/index.html
services/electrical-equipment/index.html
industries/oil-gas/index.html
knowledge-center/*.html  (صفحات دارای description کوتاه/generic)
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester211-seo-meta-foundation.js
RELEASE-NOTES-v31.7.34.md
REGRESSION-REPORT-v31.7.34.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی SEO Meta: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ نیازمند بررسی SERP/Search Console پس از deploy

---

## اقدام پیشنهادی کارفرما پس از deploy

1. در Google Search Console، sitemap را دوباره submit کنید:

```text
https://pishtaj.ir/sitemap.xml
```

2. برای URLهای کلیدی زیر Request Indexing بزنید:

```text
https://pishtaj.ir/
https://pishtaj.ir/rfq/
https://pishtaj.ir/tracking/
https://pishtaj.ir/supplier/
https://pishtaj.ir/knowledge-center/
https://pishtaj.ir/tools/
https://pishtaj.ir/services/piping-equipment/
https://pishtaj.ir/services/instrumentation-equipment/
https://pishtaj.ir/services/electrical-equipment/
https://pishtaj.ir/services/pumps/
https://pishtaj.ir/industries/oil-gas/
```
