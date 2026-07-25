# موتور کدگذاری واحد PTF - راهنمای ایجنت‌ها

**قانون طلایی:** هر موجودیتی که `cd / no / id / code` دارد، **فقط و فقط** از `ptfUnifiedCode('PREFIX')` استفاده می‌کند. ایجاد کدگذار موازی با `Math.random()` ممنوع است.

## فایل‌های موتور
- سرور: `api/codegen.php` - اتمیک با `flock()`, فایل `crm/data/counters.json` فقط `++`
- کلاینت: `crm/codegen.js` - Pool 20تایی, Fallback سینک `legacyMaxNext()`, آخرین راه `TMP-*`

## فرمت‌ها (حفظ شده)
- `P-1001` کالا - `ptfUnifiedCode('P')`
- `RFQ-1051` درخواست - `ptfUnifiedCode('RFQ')`
- `IQI-2101` قلم درخواست
- `CUST-1043` مشتری
- `SUP-892` تامین‌کننده
- `TO/CO/TC`: `PTF-TO-1405-0100` - امسال از 0100 (4 رقمی)، سال بعد از 0001 - `ptfUnifiedCode('TO')`
- بقیه: `CHQ, INV, PAY, CMP, LEAD, ...` همگی `PREFIX-NNNN`

## چطور ماژول جدید اضافه کنم؟

```js
// ✅ درست
var rec = { cd: ptfUnifiedCode('WTY'), co: company, ... } // WTY-1001

// ✅ batch 100 قلم
ptfReserveCodes({WTY:100}, function(d){ console.log(d.codes) })

// ❌ غلط - ممنوع - audit.py Fail می‌دهد
function genCode(p){ return p+'-'+Math.floor(10000+Math.random()*90000) }
var cd = 'WTY-'+Math.floor(Math.random()*9000)
```

## Invariant های غیرقابل تغییر
1. کد تخصیص‌یافته هرگز بازیافت نمی‌شود، حتی با حذف (counters فقط ++)
2. سال جاری TO/CO/TC از 0100، سال بعد از 0001 - 4 رقمی
3. `TMP-*` فقط Fallback آفلاین است، بعداً با `action=reconcile` به واقعی تبدیل می‌شود

## اگر Pool خالی بود و TMP دیدم؟
1. `localStorage.getItem('ptf_code_pool')` باید پر باشد
2. `fetch('../api/codegen.php?action=status')` باید 200 باشد
3. `crm/data` باید writable 755
4. Console: `ptfCodegenBoot()` بزن

## تست
```bash
python3 _tools/audit.py # باید PASS - بخش [8/8] موتور کدگذاری
```

## بک‌لاگ مرتبط
- TECHDEBT-005 سابق - حالا بسته با موتور واحد
- BUG-NEW-001 TMP Pool Empty - فیکس شده با fallback legacyMaxNext
