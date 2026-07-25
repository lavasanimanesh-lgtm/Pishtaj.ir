# 📊 گزارش رگرسیون v31.7.33

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.33`  
**موضوع:** WEB-MEAS-002 / WEB-CRO-001 — Privacy-first metrics + Home role journey

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **188** | — |
| فایل‌های PASS | **188** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4184** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید Metrics | `tester209-web-metrics-foundation.js` | ✅ 9/9 |
| تستر جدید Home Journey | `tester210-home-journey-cro.js` | ✅ 7/7 |
| `node --check assets/js/ptf-metrics.js` | PASS | ✅ |
| `node --check assets/js/ptf-chat.js` | PASS | ✅ |

خروجی کامل runner:

```json
{
  "date": "2026-07-20T22:46:25.893Z",
  "version": "v31.7.33",
  "testers_total": 188,
  "files_pass": 188,
  "files_fail": 0,
  "checks_pass": 4184,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 تسترهای جدید

### 1) `_tools/uat/tester209-web-metrics-foundation.js`

پوشش:

- فایل `ptf-metrics.js` وجود دارد و idempotent است.
- هیچ ارسال شبکه‌ای پیش‌فرض ندارد.
- `dataLayer` و local queue دارد.
- `page_view`, `click`, `form_submit_attempt` را پوشش می‌دهد.
- CTAهای اصلی B2B را classify می‌کند.
- پنل QA با `?ptf_metrics=1` وجود دارد.
- از طریق `ptf-chat.js` روی 397 صفحه public load می‌شود.
- صفحه `tools/` که chat ندارد، metrics را مستقیم load می‌کند.
- هیچ صفحه public بدون metrics/chat loader نمانده است.

نتیجه مستقیم:

```text
tester209-web-metrics-foundation: 9 PASS / 0 FAIL
```

### 2) `_tools/uat/tester210-home-journey-cro.js`

پوشش:

- سکشن `journey` در Home اضافه شده است.
- مسیر خریدار/EPC به `rfq/` می‌رود.
- مسیر مهندس پروژه به `tools/` می‌رود.
- مسیر مشتری در حال پیگیری به `tracking/` می‌رود.
- مسیر تامین‌کننده به `supplier/` می‌رود.
- هر مسیر event اختصاصی دارد.
- متن سکشن به privacy-first بودن measurement اشاره می‌کند.

نتیجه مستقیم:

```text
tester210-home-journey-cro: 7 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
assets/js/ptf-metrics.js
assets/js/ptf-chat.js
tools/index.html
index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/last-regression.json
_tools/uat/tester209-web-metrics-foundation.js
_tools/uat/tester210-home-journey-cro.js
RELEASE-NOTES-v31.7.33.md
REGRESSION-REPORT-v31.7.33.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی Metrics: ✅ PASS
- تستر اختصاصی Home Journey: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ نیازمند بررسی مرورگر واقعی با `?ptf_metrics=1`

---

## مراحل راستی‌آزمایی پیشنهادی کارفرما

1. صفحه اصلی را با query زیر باز کنید:

```text
/?ptf_metrics=1
```

2. پنل `PTF Web Metrics` باید در پایین صفحه دیده شود.
3. روی کارت‌های مسیر سریع، RFQ، تماس، واتساپ و Tracking کلیک کنید.
4. شمارنده eventها باید در پنل local افزایش پیدا کند.
5. صفحه را بدون query باز کنید؛ پنل نباید نمایش داده شود و سایت باید عادی کار کند.
