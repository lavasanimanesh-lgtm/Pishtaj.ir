# Release Notes — v31.7.43

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.43`  
**نوع:** 🔴 Hotfix / Public Interactions Operational Audit

---

## 🎯 هدف ریلیز

بررسی و تثبیت عملیاتی همه مسیرهای تعاملی عمومی وب‌سایت:

```text
Home quick RFQ
Smart RFQ
Tool activation RFQ
Supplier registration
Tracking
Tools paywall/license
```

---

## 🔍 یافته مهم

دو مسیر public هنوز رفتار fallback موقت/غیرقطعی داشتند:

1. `rfq/index.html` در صورت خطای سرور کد موقت `PTF-RFQ-TMP-...` می‌ساخت و کاربر را به مرحله موفقیت می‌برد.
2. `supplier/index.html` در صورت خطای سرور کد موقت `PTF-VEN-TMP-...` می‌ساخت، داده را local ذخیره می‌کرد و فرم را مثل موفقیت مخفی می‌کرد.

این با اصل عملیاتی جدید سازگار نبود:

```text
هیچ تعامل public نباید fake-success یا کد رهگیری موقت/تصادفی بدهد.
```

---

## ✅ اصلاح انجام‌شده

### 1) RFQ هوشمند fail-closed شد

در `rfq/index.html` fallback موقت حذف شد.

اکنون اگر ثبت سروری انجام نشود:

- هیچ کد رهگیری صادر نمی‌شود.
- کاربر به صفحه موفقیت نمی‌رود.
- پیام واضح می‌بیند:

```text
ثبت آنلاین انجام نشد؛ هیچ کد رهگیری صادر نشده است.
```

### 2) Supplier registration fail-closed شد

در `supplier/index.html` fallback موقت حذف شد.

اکنون اگر سرور کد واقعی ندهد:

- هیچ `PTF-VEN-TMP` ساخته نمی‌شود.
- فرم مخفی نمی‌شود.
- صفحه موفقیت نمایش داده نمی‌شود.
- کاربر پیام واضح می‌بیند:

```text
ثبت در سرور انجام نشد؛ هیچ کد رهگیری تامین‌کننده صادر نشده است.
```

### 3) تست عملیاتی تعاملات عمومی اضافه شد

تستر جدید:

```text
_tools/uat/tester220-public-interactions-operational.js
```

این تست مسیرهای زیر را کنترل می‌کند:

- Home quick RFQ
- Smart RFQ
- Tool activation RFQ
- Supplier registration
- Tracking
- Tools paywall/license

---

## 📁 فایل‌های تغییر یافته

```text
rfq/index.html
supplier/index.html
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester220-public-interactions-operational.js
RELEASE-NOTES-v31.7.43.md
REGRESSION-REPORT-v31.7.43.md
```

---

## 🧪 تست جدید

### `_tools/uat/tester220-public-interactions-operational.js`

پوشش:

1. Home RFQ به `add_rfq_site` وصل است و کد تصادفی نمی‌سازد.
2. Smart RFQ به `add_rfq_site` وصل است و `PTF-RFQ-TMP` نمی‌سازد.
3. درخواست فعال‌سازی ابزار در RFQ قابل مشاهده است.
4. لینک‌های Tools دارای `activation=tools` هستند.
5. Supplier form به `add_supplier` وصل است و `PTF-VEN-TMP` نمی‌سازد.
6. Supplier OTP degraded fallback وجود دارد.
7. Tracking از API عمومی `track` استفاده می‌کند.

نتیجه مستقیم:

```text
tester220-public-interactions-operational: 15 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| RFQ smart | حذف کد موقت؛ فقط کد واقعی سرور | کم/متوسط، صحیح از نظر اعتماد |
| Supplier registration | حذف کد موقت؛ فقط کد واقعی سرور | کم/متوسط، صحیح از نظر اعتماد |
| Home RFQ | بدون تغییر؛ قبلاً fail-closed بود | صفر |
| Tools activation | بدون تغییر؛ تست شد | صفر |
| Tracking | بدون تغییر؛ تست شد | صفر |
| CRM/Auth/Finance/Sync | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی کارفرما

### RFQ هوشمند

1. `/rfq/` را باز کنید.
2. یک درخواست ثبت کنید.
3. در حالت اتصال سالم، باید کد واقعی `PTF-RFQ-...` بگیرید.
4. اگر سرور قطع باشد، نباید کد موقت یا صفحه موفقیت ببینید.

### تامین‌کننده

1. `/supplier/` را باز کنید.
2. فرم را کامل کنید.
3. در حالت اتصال سالم، باید کد واقعی `PTF-VEN-...` بگیرید.
4. اگر سرور قطع باشد، نباید کد موقت یا صفحه موفقیت ببینید.

---

## 🚦 نتیجه

مسیرهای تعاملی عمومی سایت اکنون با اصل عملیاتی زیر هم‌راستا هستند:

```text
فقط موفقیت واقعی سرور = کد رهگیری واقعی
هیچ کد موقت/تصادفی/فیک در تعاملات public صادر نمی‌شود
```
