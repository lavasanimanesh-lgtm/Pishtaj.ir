# ریلیزنوت `v28.9` — موتور کدگذاری واحد سمت سرور (Permanent Fix BUG-CODE-FIX)

## خلاصه
رفع **دائمی** باگ بحرانی سیستم کدینگ با مهاجرت از موتور کلاینتی `deepScan` به **موتور سروری اتمیک** با Pool محلی. این ریلیز تضمین می‌کند کدی که یکبار تخصیص داده شد، حتی پس از حذف رکورد، هرگز به رکورد جدید دیگری تخصیص نیابد.

## چرا این مهم است؟ (پاسخ به سوال شما)
**بله، کاملاً قبول دارم.** کدهای P-1001, RFQ-1001, CUST-1001, PTF-CO-1404-003 شناسه حسابداری و حقوقی هستند. 
- اگر `RFQ-1001` حذف شود و دوباره `RFQ-1001` به درخواست جدید داده شود، تمام ارجاعات فاکتور، پرونده فروش، بایگانی، و گزارش سود دچار ابهام می‌شوند.
- در سیستم مالی، شماره فاکتور/پیشنهاد نباید بازیافت شود (اصل حسابرسی).
- موتور جدید **فقط افزایشی (monotonic)** است: `counters.json` فقط `++` می‌شود، `flock()` اتمیک، حتی `deleted_archive` هم کد را آزاد نمی‌کند.

## مشکل قبلی
- موتور قدیم `v28.7` برای 38 prefix رندوم `CUST-4821-42` می‌داد → برخورد
- فیکس کلاینتی `v28.8` با `deepScan` sequential کرد ولی همچنان دو دستگاه آفلاین می‌توانستند `CUST-1005` یکسان بسازند چون `D-Tag` فقط در حالت sync روشن اضافه می‌شد.
- `deepScan` هر بار 6MB JSON را parse → فریز UI در batch 100 تایی IQI

## راه‌حل v28.9 - موتور سروری

### معماری
1. **سرور:** `api/codegen.php` - فایل `crm/data/counters.json` با `flock(LOCK_EX)` اتمیک
   - `seq`: {CUST:1042, SUP:891, P:2150, ...}
   - `yearSeq`: {TO:{1404:12}, CO:{1404:5}} برای فرمت `PTF-TO-1404-003`
   - Seed اولیه از max موجود (اسکن تمام `ptf_crm_*.json`) تا کدهای لگاسی نادیده گرفته نشود
   - Audit: `code_audit.log`

2. **کلاینت:** `crm/codegen.js` - Pool 20 تایی
   - Boot: `reserve {CUST:20, SUP:20, P:20, RFQ:10, IQI:50}`
   - `ptfUnifiedCode(prefix)` سینک از pool می‌خواند، اگر pool خالی بود `TMP-PREFIX-timestamp-rand` برمی‌گرداند تا برخورد صفر شود
   - Background refill وقتی pool <5
   - `ptfUnifiedCodeAsync` برای کدهای آینده

3. **ویژگی‌های خاص حفظ شد:**
   - سال شمسی TO/CO/TC: `PTF-TO-1404-003` با `faYear()` - مثل قبل
   - فرمت `P-1001`, `RFQ-1001`, `CUST-1001` بدون تغییر ظاهری (فقط دیگر رندوم نیست)
   - دو فرمت قدیم `TO-1001` و `PTF-TO-YYYY-NNN` هر دو خوانده می‌شود (برای seed)
   - `sourcePcode/sourceItemKey` در `buycompare.js` دست نخورده - provenance حفظ
   - Nested scan برای LOS/SHP/QC/PAC دیگر لازم نیست چون سرور مرکزی است

### فایل‌های تغییر یافته
| فایل | تغییر |
|---|---|
| `api/codegen.php` | **جدید** - موتور اتمیک |
| `crm/codegen.js` | **جدید** - Pool + TMP + invariant check |
| `crm/index.html` | VER `v28.9`, `?v=28.9`, افزودن `<script src="codegen.js?v=28.9">` بعد از `dedup.js` |
| `crm/sw.js` | CACHE `ptf-crm-v28.9`, اضافه `codegen.js` به SHELL |
| `crm/sync.js` | بدون تغییر در این ریلیز (reconciliation TMP در v29.0) - ریسک کم |

### تضمین عدم استفاده مجدد پس از حذف
- `counters.json` فقط `++` می‌شود - هیچ `delete` یا `decrement` وجود ندارد
- حتی وقتی رکورد از `ptf_crm_customers` حذف و به `deleted_archive` می‌رود، شماره آن در counters باقی می‌ماند
- تست: حذف `CUST-1043` → رزرو بعدی `CUST-1044` می‌دهد، هرگز `1043` برنمی‌گردد

## تست سریع پیشنهادی (برای شما)

**تست 1 - یکتایی و عدم بازیافت:**
1. مرورگر را باز کن `crm/index.html` -> Console:
```js
localStorage.clear(); // فقط در محیط تست
ptfCodegenBoot(); // pool پر شود
ptfUnifiedCode('CUST') // باید CUST-1001 بدهد
ptfUnifiedCode('CUST') // CUST-1002
```
2. در سرور `crm/data/counters.json` را باز کن - باید `CUST:1002` باشد
3. رکورد `CUST-1002` را حذف کن (از panel مشتریان)
4. دوباره `ptfUnifiedCode('CUST')` → باید `CUST-1003` بدهد، نه `1002`

**تست 2 - Batch IQI (100 قلم):**
```js
// شبیه سازی ایمپورت اکسل 100 قلم
for(i=0;i<100;i++) console.log(ptfUnifiedCode('IQI'))
```
باید 100 کد یکتا `IQI-1001..1100` بدون تکرار.

**تست 3 - آفلاین:**
1. DevTools -> Network -> Offline
2. `ptfUnifiedCode('SUP')` → `TMP-SUP-172...` برمی‌گرداند (برخورد صفر)
3. Online شو → `ptfReserveCodes({SUP:1})` → TMP بعدا با واقعی جایگزین (در v29.0 کامل)

**تست 4 - سرور اتمیک:**
```bash
curl -X POST https://yourhost/api/codegen.php?action=reserve -H "Content-Type: application/json" -d '{"blocks":{"CUST":5}}'
curl -X POST https://yourhost/api/codegen.php?action=reserve -H "Content-Type: application/json" -d '{"blocks":{"CUST":5}}'
```
دو پاسخ باید 10 کد پشت سر هم بدون همپوشانی باشند: `1043-1047` و `1048-1052`

**تست 5 - رگرسیون سریع:**
```bash
python3 _tools/audit.py
```
باید PASS (فقط هشدار قدیمی 5 تصویر)

## دستور Deploy (کم‌ریسک)
```bash
# 1. بک‌آپ
cp -r crm/data crm/data.bak-$(date +%F)
# 2. آپلود flat
unzip -o pishtaj-release-v28.9.zip -d public_html
# 3. چک counters
cat crm/data/counters.json # باید ساخته شده باشد یا روی اولین reserve ساخته می‌شود
# 4. Hard refresh کاربران: Ctrl+Shift+R یکبار - Service Worker جدید v28.9 نصب می‌شود
```

## Rollback
اگر مشکلی بود:
```bash
unzip -o pishtaj-release-v28.8-fixed-client.zip -d public_html
# یا
rm api/codegen.php crm/codegen.js
# سیستم به فیکس کلاینتی v28.8 برمی‌گردد (deepScan) - رندوم برنمی‌گردد
```

## ریسک‌ها
| ریسک | احتمال | کاهش |
|---|---|---|
| Pool خالی آفلاین → TMP | متوسط | TMP با timestamp یکتا، در v29.0 reconcile |
| counters.json قفل بماند | کم | flock با timeout، در صورت خطا fallback به TMP |
| فرمت جدید TO سال | کم | faYear() مثل قبل |

## تغییر کوچک v28.9.1 - درخواست کارفرما (امسال از 0100)
طبق دستور جدید:
- امسال (1405 / سال جاری) پیشنهادها از `0100` شروع شود: `PTF-TO-1405-0100`, `PTF-CO-1405-0100`
- دلیل: مشابه کدهای تولید شده فعلی است
- از سال بعد (1406) از `0001`: `PTF-TO-1406-0001`
- پیاده‌سازی: `api/codegen.php` - اگر `year == fa_year()` و شمارنده <99 بود به 99 می‌رسد، سپس ++ → اولین کد 0100. برای سال‌های آینده کف 0 → اولین کد 0001
- فرمت: 4 رقمی شد `%04d` به جای `%03d` → `0100` و `0001` هر دو 4 رقمی
- `crm/codegen.js` و `crm/offers.js offerSerial()` هم به 4 رقمی `padStart(4)` تغییر کرد

نمونه:
```
امسال: PTF-TO-1405-0100, PTF-TO-1405-0101, ... PTF-CO-1405-0100
سال بعد: PTF-TO-1406-0001, PTF-CO-1406-0001
```

## نسخه‌گذاری
- VER: `v28.9` (تغییر کوچک شماره‌گذاری داخل همین v28.9)
- CACHE: `ptf-crm-v28.9`
- تمام `?v=28.9`
- ZIP: `pishtaj-release-v28.9.zip` - Flat Root, ~25M, تنها 1 فایل

---
**تایید اصل:** کد تخصیص‌یافته هرگز بازیافت نمی‌شود - حتی با حذف. این invariant در `codegen.php: flock + only increment` تضمین شده است.
