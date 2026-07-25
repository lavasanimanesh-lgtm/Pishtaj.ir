# 📊 گزارش رگرسیون v31.7.32

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.32`  
**موضوع:** WEB-SPRINT-01 — اصلاح Home RFQ واقعی + پاکسازی sitemap

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **186** | — |
| فایل‌های PASS | **186** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4168** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Home RFQ | `tester207-home-rfq-real-chain.js` | ✅ 12/12 |
| تستر جدید Sitemap | `tester208-sitemap-public-clean.js` | ✅ 7/7 |
| `node --check assets/js/main.js` | PASS | ✅ |
| `node --check crm/offers.js` | PASS | ✅ |

خروجی کامل runner:

```json
{
  "date": "2026-07-20T22:31:39.353Z",
  "version": "v31.7.32",
  "testers_total": 186,
  "files_pass": 186,
  "files_fail": 0,
  "checks_pass": 4168,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تسترهای جدید

### 1) `_tools/uat/tester207-home-rfq-real-chain.js`

پوشش:

- فرم Home handler اختصاصی دارد و `assets/js/main.js` دوباره submit نمی‌بندد.
- فیلد ارسال‌کننده با قرارداد `add_rfq_site` هم‌نام است (`name`).
- Home RFQ به `add_rfq_site` وصل است، نه `add_rfq`.
- هیچ کد `PTF-RFQ` با `Math.random()` در مرورگر ساخته نمی‌شود.
- success فقط با `ok:true + code` سرور نمایش داده می‌شود.
- خطا fail-closed است و می‌گوید هیچ کد رهگیری صادر نشده است.
- کپچا حفظ شده است.
- لینک tracking از کد واقعی سرور ساخته می‌شود.
- event tracking پایه برای شروع/موفقیت/خطا وجود دارد.

نتیجه مستقیم:

```text
tester207-home-rfq-real-chain: 12 PASS / 0 FAIL
```

### 2) `_tools/uat/tester208-sitemap-public-clean.js`

پوشش:

- sitemap XML پایه معتبر دارد.
- هیچ URL مربوط به `crm/` یا `api/` در sitemap نیست.
- تعداد URLهای sitemap برابر HTMLهای public واقعی است.
- همه locها فایل واقعی دارند.
- هیچ صفحه public واقعی از sitemap جا نمانده است.
- URLهای stale/encoded قدیمی حذف شده‌اند.
- صفحات مهم تجاری در sitemap هستند.

نتیجه مستقیم:

```text
tester208-sitemap-public-clean: 7 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
index.html
assets/js/main.js
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester207-home-rfq-real-chain.js
_tools/uat/tester208-sitemap-public-clean.js
RELEASE-NOTES-v31.7.32.md
REGRESSION-REPORT-v31.7.32.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Home RFQ: ✅ PASS
- تستر اختصاصی sitemap: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ نیازمند تست مرورگر واقعی/staging برای submit فرم Home و چند URL sitemap

---

## مراحل راستی‌آزمایی پیشنهادی کارفرما

1. صفحه اصلی را باز کنید.
2. فرم سریع استعلام را کامل کنید.
3. کپچا را تکمیل کنید.
4. ارسال کنید.
5. بررسی کنید کد واقعی سرور مثل `PTF-RFQ-1405-000X` نمایش داده شود.
6. روی لینک رهگیری کلیک کنید.
7. بررسی کنید همان کد در صفحه tracking باز شود.
8. بدون کپچا تست کنید؛ باید ثبت متوقف شود.
9. `sitemap.xml` را باز کنید و چند URL را تصادفی بررسی کنید.
