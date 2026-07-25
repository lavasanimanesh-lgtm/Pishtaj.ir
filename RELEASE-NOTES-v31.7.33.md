# Release Notes — v31.7.33

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.33`  
**نوع:** 🟢 WEB-SPRINT-01 ادامه — Measurement & CRO Foundation

---

## 🎯 هدف ریلیز

پس از واقعی‌سازی فرم RFQ صفحه اصلی و پاکسازی sitemap در v31.7.32، این ریلیز پایه اندازه‌گیری تجاری و مسیرهای نقش‌محور Home را اضافه می‌کند.

اهداف:

1. اضافه کردن لایه privacy-first برای اندازه‌گیری conversion در صفحات عمومی.
2. ثبت رویدادهای پایه بدون ارسال شبکه‌ای و بدون جمع‌آوری PII.
3. آماده‌سازی سایت برای اتصال آینده به GA4 / Matomo / endpoint داخلی پس از تصمیم کارفرما.
4. اضافه کردن سکشن Home Journey برای چهار نقش کلیدی B2B.

---

## 1) WEB-MEAS-002 — Privacy-first Web Metrics

فایل جدید اضافه شد:

```text
assets/js/ptf-metrics.js
```

### ویژگی‌ها

- idempotent و safe-load با `window.__ptfMetricsLoaded`.
- بدون ارسال شبکه‌ای پیش‌فرض؛ نه `fetch`، نه `sendBeacon`، نه `XMLHttpRequest`.
- ذخیره رویدادهای سبک در:

```text
localStorage.ptf_web_events_v2
```

- push به:

```js
window.dataLayer
```

برای اتصال آینده به ابزارهای analytics.

### رویدادهای پوشش‌داده‌شده

```text
page_view
cta_rfq_click
tracking_cta_click
supplier_cta_click
assistant_cta_click
tools_cta_click
phone_click
email_click
whatsapp_click
content_click
form_submit_attempt
home_rfq_submit_success / fail / start
```

### QA Panel

با افزودن query زیر به هر صفحه، پنل محلی QA برای مرور eventها باز می‌شود:

```text
?ptf_metrics=1
```

این پنل فقط local browser را نشان می‌دهد و داده‌ای به سرور ارسال نمی‌کند.

---

## 2) بارگذاری site-wide بدون ویرایش صدها صفحه

از آنجا که 397 از 398 صفحه public سایت ویجت چت را load می‌کنند، `assets/js/ptf-chat.js` اکنون به‌صورت مرکزی `ptf-metrics.js` را load می‌کند.

تنها صفحه public بدون chat یعنی `tools/index.html` به‌صورت مستقیم metrics را load می‌کند.

نتیجه:

```text
همه صفحات public یا chat loader دارند یا metrics مستقیم.
```

---

## 3) WEB-CRO-001 — Home Role-based Journey

در صفحه اصلی یک سکشن جدید اضافه شد:

```text
مسیر سریع بر اساس نقش شما
```

چهار مسیر:

| نقش | مسیر |
|---|---|
| خریدار / EPC | `rfq/` |
| مهندس پروژه | `tools/` |
| مشتری در حال پیگیری | `tracking/` |
| تامین‌کننده | `supplier/` |

هر کارت دارای `data-ptf-event` اختصاصی است:

```text
journey_buyer_rfq
journey_engineer_tools
journey_customer_tracking
journey_supplier_signup
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
_tools/uat/tester209-web-metrics-foundation.js
_tools/uat/tester210-home-journey-cro.js
RELEASE-NOTES-v31.7.33.md
REGRESSION-REPORT-v31.7.33.md
```

---

## 🧪 تست‌های اضافه‌شده

### `tester209-web-metrics-foundation.js`

- وجود metrics script.
- عدم ارسال شبکه‌ای پیش‌فرض.
- وجود dataLayer و local queue.
- پوشش page_view/click/form submit.
- classification CTAهای اصلی B2B.
- site-wide loading از طریق chat/tools.

### `tester210-home-journey-cro.js`

- وجود سکشن journey.
- وجود چهار مسیر role-based.
- وجود event IDs اختصاصی.
- اشاره به privacy-first measurement.

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| صفحات عمومی | metrics سبک و local اضافه شد | کم |
| Home | سکشن journey اضافه شد | کم |
| Chat widget | فقط loader کوچک metrics اضافه شد | کم |
| Tools page | script metrics مستقیم اضافه شد | کم |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |
| RFQ backend | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی توسط کارفرما

1. صفحه اصلی را با این آدرس باز کنید:

```text
https://pishtaj.ir/?ptf_metrics=1
```

2. باید پنل کوچک `PTF Web Metrics` پایین صفحه دیده شود.
3. روی کارت‌های مسیر سریع، RFQ، Tracking، تماس و واتساپ کلیک کنید.
4. باید eventها در پنل local افزایش پیدا کنند.
5. بدون query، پنل نمایش داده نمی‌شود و سایت عادی کار می‌کند.

---

## 🚦 نتیجه

این ریلیز foundation اندازه‌گیری conversion و مسیرهای role-based را بدون وابستگی خارجی و بدون ریسک privacy ایجاد کرد. اتصال به analytics واقعی یا endpoint داخلی باید بعد از تصمیم کارفرما انجام شود.
