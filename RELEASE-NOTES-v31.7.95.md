# Release Notes — v31.7.95

## عنوان ریلیز
**BUG-FINANCE-SUPPLIER-CONSISTENCY-UI-001**

## RCA / دلیل دقیق
کارفرما گزارش داد در هاب مالی، عدد «بدهی باز تأمین‌کنندگان» در گزارش رسمی با عدد «بدهی باز تأمین‌کنندگان» در بخش حساب تأمین‌کنندگان همخوان نیست، در حالی‌که عدد حساب تأمین‌کنندگان درست است. همچنین در حالت شب بخش تنظیمات خوانایی کافی نداشت و اعداد بزرگ در کارت‌های هاب مالی داخل مربع‌ها کامل/خوانا دیده نمی‌شدند.

ریشه مغایرت مالی:
- در گزارش رسمی، legacy payables فقط با `sfInvoiceCd` فیلتر می‌شدند.
- اما در زیر‌دفتر تأمین‌کنندگان، legacyهای لینک‌شده از مسیر `legacyPayableCds` داخل فاکتور رسمی نیز از محاسبه جدا می‌شوند.
- بنابراین گزارش رسمی می‌توانست legacy payable لینک‌شده به فاکتور خرید را دوباره بشمارد و بدهی را بیشتر از حساب تأمین‌کنندگان نشان دهد.

## اصلاحات مالی

### 1) منبع واحد برای بدهی/اعتبار تأمین‌کنندگان
در `crm/supplier-finance.js` تابع زیر اضافه شد:

```js
slSupplierOpenTotalsIRR()
```

این تابع همان منطق بخش حساب تأمین‌کنندگان را برای بدهی/اعتبار IRR تجمیع می‌کند.

### 2) حذف دوباره‌شماری legacyهای لینک‌شده
در `crm/working-capital.js`، legacyهایی که در `legacyPayableCds` فاکتور خرید لینک شده‌اند دیگر دوباره در گزارش رسمی شمرده نمی‌شوند.

### 3) همسان‌سازی گزارش رسمی با حساب تأمین‌کنندگان
وقتی گزارش برای وضعیت جاری محاسبه می‌شود، `source.supplierLiability` و `source.supplierCredit` از `slSupplierOpenTotalsIRR()` خوانده می‌شود تا با بخش حساب تأمین‌کنندگان یکسان باشد.

## اصلاحات UI

### 1) اعداد کارت‌های هاب مالی
CSS کارت‌های `.sc` اصلاح شد:

- `min-width:0`
- `overflow:hidden`
- `font-size:clamp(...)`
- `overflow-wrap:anywhere`
- `word-break:break-word`

تا اعداد بزرگ داخل کارت‌ها کامل‌تر و خواناتر نمایش داده شوند.

### 2) خوانایی Settings در حالت شب
`crm/settings-accordion.js` اصلاح شد تا از متغیرهای تم استفاده کند:

```text
var(--crd)
var(--tx)
var(--brd)
```

و label/input/textarea/select داخل تنظیمات در dark mode خواناتر باشند.

## فایل‌های تغییرکرده

```text
crm/supplier-finance.js
crm/working-capital.js
crm/index.html
crm/settings-accordion.js
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester273-finance-supplier-consistency-ui.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester273-finance-supplier-consistency-ui.js` اضافه شد.
- این تست runtime بررسی می‌کند که legacy payable لینک‌شده دوباره‌شماری نشود و گزارش رسمی با حساب تأمین‌کنندگان همخوان شود.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
