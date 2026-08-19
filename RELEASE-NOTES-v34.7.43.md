# یادداشت انتشار v34.7.43 — قطعیت عمومی فرمان‌های مالی

**تاریخ:** 2026-08-19

## ریشهٔ مسئلهٔ هم‌خانواده

ممیزی مستقل بعد از اصلاح ثبت پیشنهاد نشان داد همان الگوی خطرناک در چند فرمان مالی دیگر باقی مانده بود:

```text
server ACK → render/toast/cloud cleanup → catch با معنای «فرمان رد شد»
```

در نتیجه exception یک اثر نمایشی پس از ACK می‌توانست پیام شکست کاذب، rollback رکورد قطعی یا حتی حذف فایل تازه‌ای را ایجاد کند که metadata آن قبلاً روی سرور commit شده بود. پاسخ گم‌شده نیز در مسیرهای optimistic صورتحساب می‌توانست رکورد محلی را با وجود commit سرور برگرداند.

در سمت سرور نیز قفل فایل فقط هم‌زمانی را کنترل می‌کرد، نه قطع process بین rename چند projection. بازیابی اختصاصی v34.7.42 فقط `register_offer` را پوشش می‌داد.

## راهکار

### مرز عمومی فرمان در کلاینت

`window.ptfSalesDomainCommand` یک lifecycle مشترک ارائه می‌کند:

- `acked`: ACK سرور قطعی است؛ exception در toast/render/refresh فقط diagnostic و هشدار غیرمسدودکننده است.
- `rejected`: فقط پاسخ قطعی سرور؛ rollback یا حذف فایل موقت فقط در این حالت مجاز است.
- `uncertain`: پس از دو پاسخ مبهم؛ operation ID و intent حفظ و پیام «نتیجه نامشخص» نمایش داده می‌شود.
- transport/5xx با همان payload و operation ID دقیقاً یک بار replay می‌شود.

این مرز روی ثبت برد، متمم، رویژن سند برد، دریافت/ابطال دریافت، فاکتور رسمی، صورتحساب غیررسمی، ضمیمه مالی، ضمیمه RFQ، ادغام پرونده، حذف ادمین، بازگردانی برد و purge بایگانی اعمال شد.

### WAL عمومی در سرور

پیش از اولین انتشار projection، سرور یک write-ahead transaction کامل و hash‌شده در مسیر sync می‌نویسد. WAL شامل projectionهای نهایی و receipt journal همان operation است.

- قطع پیش از انتشار: replay همان فرمان را اجرا می‌کند.
- قطع میان renameها: درخواست بعدی ابتدا WAL دقیق را کامل می‌کند.
- قطع پس از meta و پیش از پاسخ: recovery ممکن است rev را جلو ببرد، اما داده و command receipt را بدون اجرای دوبارهٔ منطق تجاری تثبیت می‌کند.
- `data_push` عمومی تا پایان recovery با `pending_sales_transaction_recovery` متوقف می‌شود و نمی‌تواند snapshot دیگری را روی تراکنش نیمه‌تمام بنویسد.
- operation ID اکنون برای همهٔ فرمان‌های mutating اجباری است و journal همچنان به action، payload hash و owner مقید است.
- تطبیق متمم دیگر `buyerCd` یا شمارهٔ پیشنهاد تهی را برابر تلقی نمی‌کند؛ بدهی A3 از ۱۰۵ به ۱۰۴ کاهش و baseline فقط با حذف یک signature و بدون finding تازه به‌روزرسانی شد.

### ترتیب امن فایل و metadata

- افزودن/جایگزینی فایل: فایل تازه فقط پس از رد قطعی metadata پاک می‌شود؛ در نتیجه نامشخص عمداً نگه داشته می‌شود.
- حذف ضمیمه مالی و RFQ: ابتدا metadata/Tombstone قطعی و بعد حذف object ابری انجام می‌شود. شکست cleanup فقط هشدار orphan cleanup است.
- purge بایگانی به‌دلیل قرارداد receipt سرویس storage همچنان ابتدا receipt حذف batch می‌گیرد؛ اما commit نهایی مرز ACK/rejected/uncertain مستقل دارد و دیگر exception پس از ACK را شکست معرفی نمی‌کند.

## فایل‌های اصلی

- `api/sales-domain.php`
- `api/crm.php`
- `crm/sales-domain-v2.js`
- `crm/case-revision.js`
- `crm/official-invoice-v2.js`
- `crm/unofficial-invoice.js`
- `crm/customer-finance.js`
- `crm/rbac.js`
- `crm/inqreader.js`
- `crm/projects.js`
- `_tools/uat/tester446-v34.7.43-command-commit-certainty.js`

## تست‌های رفتاری v34.7.43

- exception عمدی در onAck به rejection نمی‌رسد و diagnostic ذخیره می‌شود.
- پاسخ گم‌شده با همان operation ID replay و یک بار ACK می‌شود.
- 422 قطعی بدون replay وارد rejected می‌شود.
- دو شکست transport وارد uncertain می‌شوند و rollback اجرا نمی‌شود.
- قرارداد WAL-before-projection، recovery-before-read و block شدن data_push بررسی می‌شود.
- مسیرهای optimistic صورتحساب و پیوست‌ها به lifecycle عمومی مقید شده‌اند.

## استقرار

این نسخه ابتدا فقط از شاخه Arena روی staging منتشر می‌شود. هیچ workflow پروداکشن یا deploy پروداکشن در این release اجرا نمی‌شود.
