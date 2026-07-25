# ریلیزنوت `v28.8` — رفع بحرانی باگ سیستم کدینگ (BUG-CODE-FIX)

## خلاصه

رفع **۶ نقص بحرانی** در سیستم تولید کد یکپارچه (`ptfUnifiedCode`) که باعث ایجاد کدهای تکراری، قدیمی، و ادغام ناخواسته رکوردها می‌شد.

## مشکل

کاربران گزارش دادند که:
1. درخواست جدید، کد قدیمی یک درخواست دیگر را دریافت می‌کرد
2. کد کالا تکراری تخصیص داده می‌شد
3. رکوردهای مختلف در هم ادغام می‌شدند

## تحلیل ریشه‌ای

| نقص | توضیح | شدت |
|-----|-------|-----|
| ۱. regex + Device Tag | کدهای دارای تگ دستگاه (مثل `RFQ-1001-D10`) توسط regex `/^RFQ-(\d+)$/i` دیده نمی‌شدند | 🔴 |
| ۲. ۳۸ prefix تصادفی | فقط ۵ از ۴۳ prefix sequential بودند؛ بقیه `Math.random()` | 🔴 |
| ۳. شمارنده حافظه‌ای | `window._ptfCodeSeq` با رفرش صفحه reset می‌شد | 🟠 |
| ۴. دو سیستم موازی | `offerSerial` و `ptfUnifiedCode` یکدیگر را نمی‌دیدند | 🟠 |
| ۵. Race Condition | `genCode()` در حلقه batch قبل از `setData` فراخوانی می‌شد | 🟠 |
| ۶. عدم یکتایی‌سنجی | پس از تولید کد، بررسی وجود نداشت | 🟡 |

## اصلاح انجام‌شده

### فایل‌های تغییر یافته:
- `crm/index.html` — تابع `ptfUnifiedCode` بازنویسی کامل
- `crm/ai-workbench.js` — تابع `genCode` به `ptfUnifiedCode` متصل شد

### تغییرات کلیدی:

1. **رفع regex + Device Tag:** تابع `extractNum` هر دو فرمت `PREFIX-NNN` و `PREFIX-NNN-DXX` را parse می‌کند

2. **تمام ۴۵ prefix sequential شدند:** رجیستری کامل `REG` شامل تمام prefixها (CUST, SUP, IQI, CHQ, INV, PAY, ...) با mapping به storage key صحیح

3. **اسکن عمیق (deepScan):** ساختارهای تودرتو (مثل `lossEvents` در deals، `docs` در projects) و ساختارهای object (مثل `supplier_finance`) به درستی اسکن می‌شوند

4. **سازگاری با offerSerial:** `extractNum` هم فرمت `CO-1001` و هم `PTF-CO-1404-001` را تشخیص می‌دهد. TO/CO/TC از `offerSerial` استفاده می‌کنند

5. **اعتبارسنجی یکتایی (uniqueness check):** پس از تولید کد، تا ۵۰ بار بررسی می‌شود که کد تکراری نباشد

6. **Fallback امن:** هر prefix ناشناخته هم sequential (از اسکن سراسری تمام کلیدها) تولید می‌شود — دیگر هیچ `Math.random()` وجود ندارد

## رفتار کدهای جدید

| Prefix | فرمت قبل | فرمت بعد |
|--------|----------|----------|
| RFQ | `RFQ-NNNN` (sequential) | `RFQ-NNNN` (sequential + Device Tag compatible) |
| PROD | `P-NNNN` (sequential) | `P-NNNN` (sequential + Device Tag compatible) |
| CUST | `CUST-NNNN-YY` (random) | `CUST-NNNN` (sequential) |
| SUP | `SUP-NNNN-YY` (random) | `SUP-NNNN` (sequential) |
| IQI | `IQI-NNNN-YY` (random) | `IQI-NNNN` (sequential) |
| CHQ | `CHQ-NNNN-YY` (random) | `CHQ-NNNN` (sequential) |
| INV | `INV-NNNN-YY` (random) | `INV-NNNN` (sequential) |
| TO/CO/TC | `PTF-TO-YYYY-NNN` | بدون تغییر (offerSerial) |

**توجه:** کدهای قدیمی (تولیدشده با فرمت تصادفی) تغییر نمی‌کنند. فقط کدهای جدید از این به بعد sequential خواهند بود.

## نتایج تست

```
✅ TEST 1: Device Tag سازگاری — RFQ-1004 تولید شد (RFQ-1001-D10 دیده شد)
✅ TEST 2: Page Refresh — RFQ-1005 تولید شد (counter reset مشکلی ایجاد نکرد)
✅ TEST 3: Batch loop — ۱۰۰ کد IQI / ۱۰۰ یکتا (بدون تکرار)
✅ TEST 4: Sequential — CUST-1003, CUST-1004 (قبلاً random بود)
✅ TEST 5: offerSerial — PTF-CO-1404-003 (سازگار با فرمت موجود)
✅ TEST 6: Products — P-2004 (P-2003-D15 درست خوانده شد)
✅ TEST 7: Nested — LOS-4 (از lossEvents تودرتو)
✅ TEST 8: Object — SFINV-3, SFPAY-2, SFADJ-2 (ساختار supplier_finance)
```

## فایل‌های تغییر یافته

| فایل | تغییر |
|------|-------|
| `crm/index.html` | تابع `ptfUnifiedCode` — بازنویسی کامل (از ~35 خط به ~190 خط) |
| `crm/ai-workbench.js` | خط ۱۷: `genCode` اکنون از `ptfUnifiedCode` استفاده می‌کند |

## فایل‌های بدون تغییر (تضمین شده)

تمام سایر فایل‌ها بدون تغییر هستند. به ویژه:
- `crm/sync.js` — بدون تغییر
- `crm/offers.js` — بدون تغییر (offerSerial دست‌نخورده)
- `crm/storage.js` — بدون تغییر
- `api/crm.php` — بدون تغییر
- `api/storage.php` — بدون تغییر

## دستورالعمل Deploy

```bash
# 1. Backup قبل از deploy
cp crm/index.html crm/index.html.bak-pre-v28.8
cp crm/ai-workbench.js crm/ai-workbench.js.bak-pre-v28.8

# 2. جایگزینی دو فایل
# crm/index.html
# crm/ai-workbench.js

# 3. بررسی
# در کنسول مرورگر:
# typeof ptfUnifiedCode  →  'function'
# ptfUnifiedCode('CUST')  →  'CUST-NNNN'  (sequential)

# 4. پاک‌سازی cache کاربران
# کاربران باید یک‌بار Ctrl+Shift+R بزنند یا از clear-cache.html استفاده کنند
```

## Rollback

در صورت مشکل، دو فایل backup را بازگردانید:
```bash
cp crm/index.html.bak-pre-v28.8 crm/index.html
cp crm/ai-workbench.js.bak-pre-v28.8 crm/ai-workbench.js
```

## ریسک‌ها

| ریسک | احتمال | تاثیر | کاهش |
|------|--------|-------|------|
| تداخل با کدهای قدیمی random | پایین | کم | کدهای قدیمی تغییر نمی‌کنند؛ فقط کدهای جدید sequential |
| تداخل با Sync | پایین | متوسط | ساختار داده تغییر نکرده؛ فقط منطق تولید کد اصلاح شده |
| فرمت جدید CUST/SUP/IQI | متوسط | کم | کاربران ممکن است تفاوت فرمت را ببینند (حذف بخش تصادفی) |
| پاک‌سازی cache | بالا | متوسط | بدون cache clear، نسخه قدیمی اجرا می‌شود |

## اقدام لازم کاربران

پس از Deploy، تمام کاربران باید:
1. یک‌بار `Ctrl+Shift+R` بزنند (hard refresh)
2. یا به صفحه `crm/clear-cache.html` مراجعه کنند
3. Service Worker جدید خودکار آپدیت می‌شود (نسخه `sw.js` تغییر نکرده — ممکن است لازم باشد `sw.js` را هم به‌روز کنید)
