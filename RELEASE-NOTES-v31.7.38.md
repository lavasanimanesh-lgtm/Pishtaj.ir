# Release Notes — v31.7.38

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.38`  
**نوع:** 🔴 Hotfix داده/UX — BUG-DUP-GROW-001 + BUG-MYDAY-DISMISS-001

---

## 🎯 مسئله گزارش‌شده

در «روز من» رکوردهای قدیمی RFQ و پیشنهادها مدام با شمارنده‌های چندتایی دیده می‌شدند؛ سیستم هشدار کد تکراری می‌داد ولی عملاً اقدام موثری برای کاربر وجود نداشت. همچنین آیتم‌های «روز من» قابل حذف/پنهان‌سازی نبودند.

نمونه گزارش‌شده:

```text
RFQ-1242 ×10
RFQ-1241 ×8
RFQ-1361 ×8
پیشنهادهای منقضی / رو به پایان با رکورد هم‌کد
```

---

## 🔍 RCA — ریشه فنی

ریشه اصلی در تعامل دو بخش بود:

1. در `sync.js` برای `ptf_crm_rfqs` و `ptf_crm_offers` از `ptfMergeNoCollapse` استفاده می‌شد. این منطق در زمان incidentهای قدیمی codegen عمداً رکوردهای هم‌کد اما با payload متفاوت را نگه می‌داشت تا داده بی‌صدا حذف نشود.
2. پس از رفع codegen، همان رفتار باعث می‌شد رکوردهای legacy هم‌کد از دستگاه‌های مختلف دوباره در sync union شوند و رشد/بازگشت پیدا کنند.
3. `ptfAutoRepairSafeDuplicates` فقط plan هشدار می‌ساخت و در بسیاری موارد action موثری برای پاکسازی واقعی اجرا نمی‌کرد.
4. «روز من» فقط dedup نمایشی داشت و داده منبع را پاک نمی‌کرد؛ همچنین dismiss/snooze برای کاربر نداشت.

---

## ✅ اصلاح انجام‌شده

### 1) Canonical merge برای RFQ/Offer

در `crm/sync.js` منطق merge برای این دو کلید تغییر کرد:

```text
ptf_crm_rfqs
ptf_crm_offers
```

از این پس کد سند (`cd` برای RFQ و `no` برای Offer) هویت کسب‌وکاری محسوب می‌شود و رکوردهای هم‌کد در sync به یک رکورد canonical ادغام می‌شوند.

ویژگی‌ها:

- انتخاب نماینده با توجه به status، کامل‌تر بودن داده و timestamp.
- حفظ بخشی از history در `_dupMerged`.
- جلوگیری از بازگشت/رشد رکوردهای هم‌کد از دستگاه‌های دیگر.

### 2) Cleanup عملیاتی duplicateها

تابع جدید:

```js
ptfCollapseDuplicateBusinessRecords({ confirm: 'PTF-COLLAPSE-DUP' })
```

این تابع duplicateهای هم‌کد RFQ/Offer را در داده اصلی collapse می‌کند و با `setData` به sync می‌فرستد.

### 3) اتصال codegen هشدار به cleanup واقعی

در `crm/codegen.js` قبل از نمایش هشدار duplicate، cleanup canonical اجرا می‌شود. بنابراین هشدارهای بی‌اقدام برای duplicateهای قابل ادغام کاهش پیدا می‌کند.

### 4) قابلیت حذف از «روز من»

در `crm/myday.js` اضافه شد:

- دکمه `×` کنار هر آیتم روز من.
- پنهان‌سازی آیتم بر اساس fingerprint در `ptf_crm_settings.mydayDismissed`.
- دکمه «نمایش حذف‌شده‌ها» برای بازگرداندن موارد پنهان.
- دکمه «🧹 پاکسازی تکراری‌ها» وقتی آیتم چندرکوردی وجود دارد.

نکته: حذف از روز من، سند اصلی را حذف نمی‌کند؛ فقط آن اعلان/action را پنهان می‌کند. پاکسازی duplicateها از دکمه جداگانه انجام می‌شود.

---

## 📁 فایل‌های تغییر یافته

```text
crm/sync.js
crm/codegen.js
crm/myday.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester215-duplicate-growth-myday-dismiss.js
RELEASE-NOTES-v31.7.38.md
REGRESSION-REPORT-v31.7.38.md
```

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester215-duplicate-growth-myday-dismiss.js`

پوشش:

- `ptfSmartMerge` برای RFQ/Offer از canonical merge استفاده می‌کند.
- تابع cleanup عمومی duplicateها وجود دارد.
- codegen قبل از هشدار duplicate cleanup را اجرا می‌کند.
- My Day دارای dismiss map است.
- آیتم‌های dismissed از خروجی My Day حذف می‌شوند.
- هر ردیف My Day دکمه حذف دارد.
- دکمه پاکسازی تکراری‌ها وجود دارد.
- رفتار canonical merge ساده‌شده شبیه‌سازی شد.

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Sync RFQ/Offer | ادغام هم‌کدها به canonical record | متوسط، لازم برای توقف رشد duplicates |
| My Day | امکان dismiss و cleanup | کم |
| Codegen warnings | هشدارها action-orientedتر شدند | کم |
| Finance/Auth/Tools/API | دست‌نخورده | صفر |
| داده‌های اصلی | duplicateهای هم‌کد collapse می‌شوند؛ history سبک در `_dupMerged` باقی می‌ماند | متوسط کنترل‌شده |

---

## 📋 راستی‌آزمایی توسط کارفرما

1. وارد CRM شوید.
2. داشبورد / روز من را باز کنید.
3. اگر آیتم‌هایی مثل `×10 رکورد هم‌کد` دیده شد، روی «🧹 پاکسازی تکراری‌ها» کلیک کنید.
4. انتظار صحیح:
   - رکوردهای هم‌کد RFQ/Offer collapse شوند.
   - بعد از refresh/sync دوباره افزایش پیدا نکنند.
5. روی `×` کنار یک آیتم روز من کلیک کنید.
6. انتظار صحیح:
   - همان آیتم از روز من حذف/پنهان شود.
   - سند اصلی حذف نشود.
7. اگر خواستید موارد حذف‌شده برگردند، روی «نمایش حذف‌شده‌ها» کلیک کنید.

---

## 🚦 نتیجه

ریشه رشد duplicateها در لایه sync برای RFQ/Offer اصلاح شد و «روز من» اکنون هم قابلیت پاکسازی duplicate و هم dismiss آیتم‌ها را دارد.
