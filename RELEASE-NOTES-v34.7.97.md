# RELEASE NOTES — v34.7.97 (۱۴۰۵/۰۶/۰۱ — 2026-08-23)

## یکپارچگی دریافت قطعی و تطبیق مطمئن هزینه‌های تکرارشونده

این نسخه دو خطای مالی را با تغییرات سازگار با داده‌های قدیمی رفع می‌کند: اختلاف اثر Receipt بین خزانه/مطالبات/حساب مشتری، و race تغییر ماه در ساخت حقوق سهامداران موظف و قالب‌های OPEX.

### ۱) قرارداد واحد دریافت، مطالبات و اعتبار مشتری

- `crm/ar-reconcile.js` منبع متعارف محاسبات invoice/case/customer است.
- مبلغ فاکتور به تفکیک `grossBilled`، مرجوعی، `billed` خالص، `allocated`، `applied`، `open` و `overPaid` محاسبه می‌شود.
- هر Receipt فعال و `posted` دقیقاً یک‌بار در خزانه به‌عنوان ورودی وجه شمرده می‌شود.
- اعتبار مشتری برابر **اعتبار آزاد Receipt + اضافه‌پرداخت فاکتور** است؛ allocation دوباره شمرده نمی‌شود.
- Receipt سطح مشتری که `caseId` ندارد، تمام مبلغش اعتبار آزاد است؛ projection قدیمی یا staleِ `creditRemainIRR=0` پول واقعی را ناپدید نمی‌کند.
- Receiptهای بسیار قدیمیِ فاقد هر دو شناسهٔ `cd/_id` دیگر روی کلید تهی collide نمی‌کنند؛ حتی ردیف‌های کاملاً همسان، جمع تخصیص و اعتبار آزاد را دقیق نگه می‌دارند.
- aliasهای legacy و سروری (`cd`/`_id`) برای پرونده، فاکتور و مشتری حفظ شده‌اند.
- `crm/customer-finance.js` summary اصلی خود را به `PTF.ar.customerPosition` واگذار می‌کند.

### ۲) reconcile نتیجه‌محور OPEX پس از Sync

- ایجاد خودکار ماهانه دیگر با timer ترتیب بارگذاری یا فلگ باینری `ptf_auto_recurring_last` تصمیم نمی‌گیرد.
- `crm/sync.js` فقط پس از pull موفق، readiness مالی را با `_ptfSyncSnapshotReady` و `ptf:sync-ready` اعلام می‌کند.
- حقوق تمام سهامداران فعال و موظف و همهٔ قالب‌های تکرارشونده، پس از snapshot موفق به‌صورت entity-level reconcile می‌شوند.
- کلیدهای دامنه پایدارند:
  - `salary:<shareholderId>:<month>`
  - `opex-template:<templateId>:<month>`
- شناسهٔ قطعی باعث idempotency بین اجراها/دستگاه‌ها می‌شود.
- اجرای بعدی نیمهٔ حذف‌شدهٔ transaction/OPEX را repair می‌کند، بدون ساخت رکورد دوم.
- رکورد legacy صحیح حذف یا جایگزین نمی‌شود؛ همان `cd` حفظ و فقط recurring key و لینک‌های لازم تکمیل می‌شوند.
- فلگ ماهانهٔ legacy صرفاً دادهٔ قدیمی است و دیگر اجرای ناقص را برای کل ماه قفل نمی‌کند.

### ۳) نسخه و cache contract

- `VERSION.json` و نقاط رسمی release به `v34.7.97` ارتقا یافتند: `crm/index.html`، `crm/sw.js`، `crm/manifest.json`، `crm/clear-cache.html`، `crm/shell.js` و `api/sales-domain.php`.
- cache-bust تمام assetهای CRM و assertionهای نسخه در UATها به `34.7.97` ارتقا یافت.
- تست اختصاصی `tester498-v34.7.97-ar-opex-reconcile.js` به CI gate افزوده شد.

### پوشش رفتاری

- قرارداد عددی خزانه/AR/customer و جلوگیری از دوباره‌شماری
- مرجوعی و اضافه‌پرداخت
- Receipt آزاد customer-level با projection قدیمی صفر
- aliasهای `_id`/`cd`
- cold-start پیش از Sync
- readiness فقط پس از pull موفق
- idempotency اجرای مجدد و برابری شناسه‌ها در cold-start دو دستگاه
- repair اجرای ناقص، transaction/OPEX نیمه‌حذف‌شده و relink خودکار
- ترمیم قالب تکرارشوندهٔ حذف‌شده با همان هویت
- ارتقای دادهٔ legacy بدون حذف یا duplicate
- collision دو Receipt کاملاً همسان و بی‌شناسه
