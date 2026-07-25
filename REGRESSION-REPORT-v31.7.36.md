# 📊 گزارش رگرسیون v31.7.36

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.36`  
**موضوع:** ADV-TOOLS-FREE-GATE-001 — قفل PDF رایگان + آماده‌سازی ابزار پیشرفته پولی

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **191** | — |
| فایل‌های PASS | **191** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4281** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Tools Paywall | `tester213-tools-free-pdf-paywall.js` | ✅ 12/12 |

خروجی کامل runner:

```json
{
  "date": "2026-07-21T00:24:32.770Z",
  "version": "v31.7.36",
  "testers_total": 191,
  "files_pass": 191,
  "files_fail": 0,
  "checks_pass": 4281,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تستر جدید

### `_tools/uat/tester213-tools-free-pdf-paywall.js`

پوشش:

1. صفحه ابزارها دیگر ادعای PDF رایگان ندارد.
2. دکمه PDF به «گزارش PDF کامل 🔒» تغییر کرده است.
3. تابع `ptfToolsPaywall` وجود دارد.
4. `exportPdf` دیگر `window.open`, `window.print`, `document.write` اجرا نمی‌کند.
5. paywall مسیر درخواست فعال‌سازی از RFQ و واتساپ دارد.
6. event باز شدن paywall ثبت می‌شود.
7. کارت Advanced Control Valve وجود دارد.
8. ابزارهای رایگان فعلی همچنان حفظ شده‌اند.
9. محاسبه Cv همچنان از `PTF_TOOLS.sizeCv` استفاده می‌کند.

نتیجه مستقیم:

```text
tester213-tools-free-pdf-paywall: 12 PASS / 0 FAIL
```

---

## 🔁 تست‌های محافظ قبلی

تست‌های SEO و structured data قبلی نیز در گیت کامل باقی ماندند:

```text
tester211-seo-meta-foundation.js
tester212-content-authority-schema.js
```

---

## 📁 فایل‌های تغییر یافته

```text
ADVANCED-CONTROL-VALVE-TOOLS-SPEC-v1.md
PTF-MASTER-HANDOVER.md
tools/index.html
tools/tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
_tools/last-regression.json
_tools/uat/tester213-tools-free-pdf-paywall.js
RELEASE-NOTES-v31.7.36.md
REGRESSION-REPORT-v31.7.36.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Tools Paywall: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ بررسی مرورگر واقعی `/tools/`

---

## مراحل راستی‌آزمایی پیشنهادی کارفرما

1. صفحه `/tools/` را باز کنید.
2. یکی از ابزارهای رایگان مثل Cv را محاسبه کنید.
3. دکمه «گزارش PDF کامل 🔒» را بزنید.
4. انتظار صحیح:
   - PDF رایگان باز/چاپ نشود.
   - پنجره فعال‌سازی نمایش داده شود.
   - مسیر RFQ و واتساپ برای فعال‌سازی وجود داشته باشد.
5. کارت Advanced Control Valve Sizing در بالای ابزارها دیده شود.
