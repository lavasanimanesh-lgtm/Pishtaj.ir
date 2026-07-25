# 📊 گزارش رگرسیون v31.7.35

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.35`  
**موضوع:** WEB-SEO-003 Light — Content Authority Schema Pass

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **190** | — |
| فایل‌های PASS | **190** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4269** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Content Authority | `tester212-content-authority-schema.js` | ✅ 60/60 |
| تستر محافظ SEO قبلی | `tester211-seo-meta-foundation.js` | ✅ 25/25 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T00:06:14.360Z",
  "version": "v31.7.35",
  "testers_total": 190,
  "files_pass": 190,
  "files_fail": 0,
  "checks_pass": 4269,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester212-content-authority-schema.js`

پوشش:

1. JSON-LD همه 10 صفحه منتخب معتبر است.
2. همه صفحات منتخب `dateModified = 2026-07-21` دارند.
3. همه صفحات منتخب `inLanguage = fa-IR` دارند.
4. همه صفحات منتخب `author` سازمانی و `reviewedBy` سازمانی دارند.
5. همه صفحات منتخب `publisher.logo` و `mainEntityOfPage` دارند.
6. همه صفحات منتخب `articleSection` و `about` برای topical authority دارند.
7. صفحات `knowledge-center/` به `TechArticle + Article` ارتقا یافته‌اند.
8. صفحه blog به صورت `Article` باقی مانده ولی review metadata دارد.

نتیجه مستقیم:

```text
tester212-content-authority-schema: 60 PASS / 0 FAIL
```

---

## 🔁 تست‌های محافظ قبلی

برای جلوگیری از برگشت بدهی SEO قبلی، تستر `tester211-seo-meta-foundation.js` نیز در همین گیت سبز است:

```text
tester211-seo-meta-foundation: 25 PASS / 0 FAIL
```

این یعنی اصلاح v31.7.34 همچنان حفظ شده است:

```text
Short descriptions < 70: 0
Generic descriptions: 0
Duplicate descriptions: 0
```

---

## 📁 فایل‌های تغییر یافته

```text
knowledge-center/kc-api-610.html
knowledge-center/a106-api-5l.html
knowledge-center/control-valve-complete-guide.html
knowledge-center/api-5l-pipe-guide.html
knowledge-center/kc-api-5l-psl1-psl2.html
knowledge-center/kc-304-316.html
knowledge-center/kc-psv.html
knowledge-center/kc-actuator.html
knowledge-center/flowmeter-types-guide.html
blog/ball-valve-selection-guide.html
services/piping-equipment/index.html
services/instrumentation-equipment/index.html
industries/oil-gas/index.html
blog/boiler-steam-equipment/index.html
blog/flanges-fittings-gaskets/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester211-seo-meta-foundation.js
_tools/uat/tester212-content-authority-schema.js
RELEASE-NOTES-v31.7.35.md
REGRESSION-REPORT-v31.7.35.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Content Authority: ✅ PASS
- تستر محافظ SEO Meta قبلی: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ بررسی Rich Results / Search Console پس از deploy

---

## اقدام پیشنهادی کارفرما پس از deploy

برای این Sprint سبک، Request Indexing گسترده لازم نیست. اگر خواستید سریع‌تر اثر structured data دیده شود، برای 10 صفحه منتخب Release Notes درخواست Indexing اختیاری است.
