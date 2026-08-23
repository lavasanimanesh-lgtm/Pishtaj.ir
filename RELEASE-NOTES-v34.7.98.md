# RELEASE NOTES — v34.7.98 (۱۴۰۵/۰۶/۰۱ — 2026-08-23)

## مالکیت قطعی دریافت مشتری و حقوق server-authoritative سهامداران موظف

این نسخه اصلاح مالی v34.7.97 را برای سناریوهای واقعی cold-start، دادهٔ legacy و نقش حسابدار تکمیل می‌کند. ثبت موفق Receipt اکنون مالک پرونده را زیر قفل سرور resolve و در صورت ایمن‌بودن ترمیم می‌کند؛ حقوق ماه جاری نیز به‌جای اتکا به snapshot محلی، با یک فرمان اتمیک سرور ساخته و به OPEX برگردانده می‌شود.

### ۱) دریافت ثبت‌شده در اعتبار همان مشتری

- resolver مالکیت واحد و leak-safe برای پرونده، Invoice و Receipt در `crm/ar-reconcile.js` و `api/sales-domain.php` اضافه شد.
- شواهد معتبر شامل شناسهٔ صریح پرونده، Offer متصل، Invoice/Receipt متصل و در آخر نام یکتای Customer است.
- تعارض دو شناسه یا نام غیرمنحصربه‌فرد `ambiguous` است؛ مبلغ به مشتری حدس‌زده‌شده نشت نمی‌کند.
- `post_receipt` پروندهٔ legacy فاقد `buyerCd` را زیر lock resolve می‌کند، اتصال مشتری را روی پرونده heal می‌کند و Case + Receipt + allocation را در یک commit اتمیک می‌نویسد.
- aliasهای legacy مشتری (`cd`) پیش از conflict-check به هویت server (`_id`) canonical می‌شوند؛ alias مشترک چند Customer همچنان مبهم و fail-closed باقی می‌ماند.
- پس از ساخت `_id` برای Case قدیمی، لینک Invoice/Receipt/Allocation از `case.cd` به شناسهٔ متعارف منتقل می‌شود تا تخصیص قبلی از پرونده جدا نشود.
- Receipt جدید همیشه `customerId` حل‌شده دارد؛ پاسخ فرمان نیز همان `customerId`، مبنای resolution و تعداد لینک‌های canonical‌شده را اعلام می‌کند.
- `customer-finance.js` Invoiceهای مشتری را از قرارداد متعارف `PTF.ar.customerInvoices()` می‌گیرد و visibility نقش را مستقل اعمال می‌کند.
- اعتبار Receipt پرونده از مالک resolve‌شده خوانده می‌شود، نه از ORهای legacy یا شناسهٔ ناقص خود Receipt.
- cache محاسبات AR با signature محتوایی Deals، Offers، Customers، Invoices و Receipts باطل می‌شود؛ Sync یا ویرایش درجا بلافاصله در حساب مشتری دیده می‌شود.

### ۲) حقوق سهامداران موظف در هزینه‌های جاری

- action جدید `reconcile_shareholder_salaries` فقط برای ماه جاری جلالی تهران و نقش‌های مالی مجاز اجرا می‌شود.
- ShareTx حقوق و ردیف OPEX در یک commit اتمیک سرور ساخته یا reconcile می‌شوند؛ کلید دامنه `salary:<shareholderCd>:<YYYY/MM>` است.
- شناسه‌های ShareTx، OPEX و row به‌صورت قطعی با پیشوندهای `SHT-SAL`، `OPX-SAL` و `OPXR-SAL` ساخته می‌شوند.
- اجرای مجدد و اجرای چند دستگاه duplicate فعال نمی‌سازد؛ دادهٔ legacy، `cd` خالی و نیمهٔ حذف‌شده repair می‌شوند.
- reactivation تمام markerهای terminal قدیمی (`st`، `voided`، `deleted` و metadataهای آن‌ها) را پاک می‌کند.
- سهامدار غیرفعال، غیرموظف یا با حقوق صفر، رکورد حسابرسی را حذف نمی‌کند؛ ShareTx و OPEX همان ماه `void` می‌شوند.
- کلاینت پس از Sync موفق، فرمان server-authoritative را با idempotency روزانه می‌فرستد و فقط پس از ACK قالب‌های OPEX محلی را reconcile می‌کند.
- خطای transport، پاسخ نامطمئن، exception هم‌زمان یا خروجی non-Promise هیچ mutation محلی نمی‌سازد و با همان کلید retry می‌شود؛ رد قطعی retry خودکار ندارد.
- accountant بدون دریافت snapshot محرمانهٔ Shareholders/ShareTx، projection مجاز OPEX حقوق را دریافت و مشاهده می‌کند.
- پاسخ اولیه و replay فرمان حقوق فقط `ptf_crm_opex` را projection می‌کنند.

### ۳) قرارداد واحد ردیف فعال OPEX

- تمام مسیرهای جمع ماهانه/سال مالی، رندر، فاکتور پوششی، هزینهٔ چک، قالب تکرارشونده، ماه آینده و duplicate check از predicate واحد `opexRowActive()` استفاده می‌کنند.
- هر یک از status/stهای terminal یا فلگ‌های `voided/deleted` ردیف را از جمع و نمایش خارج می‌کند.
- ماه جاری با timezone صریح `Asia/Tehran` محاسبه می‌شود.

### ۴) نسخه، cache و گیت انتشار

- `VERSION.json` و نقاط رسمی release روی `v34.7.98` قرار گرفتند: `crm/index.html`، `crm/sw.js`، `crm/manifest.json`، `crm/clear-cache.html`، `crm/shell.js` و `api/sales-domain.php`.
- cache-bust تمام assetهای CRM روی `34.7.98` است.
- UAT معماری `tester498-v34.7.98-ar-opex-reconcile.js` قرارداد cold-start/ACK/retry/RBAC/OPEX terminal را می‌سنجد.
- UAT جدید `tester499-v34.7.98-server-salary-case-owner.js` قرارداد مالکیت Receipt و حقوق اتمیک/role-safe را می‌سنجد و به CI gate افزوده شده است.

### پوشش رفتاری شاخص

- پروندهٔ legacy فاقد شناسهٔ مشتری با Offer یکتا
- fallback نام فقط در صورت مالک یکتا و block تعارض شناسه
- انعکاس Receipt قطعی در اعتبار مالک واقعی و جلوگیری از نشت بین‌مشتری
- invalidation فوری cache پس از تغییر Offer/Customer
- cold-start پیش از readiness بدون command یا mutation
- ACK و projection قابل مشاهدهٔ حقوق برای admin و accountant
- idempotency اجرا/دستگاه، replay امن و retry پاسخ نامطمئن
- repair رکوردهای void/deleted و حذف duplicate فعال
- void entitlement حقوق سهامدار دیگر فاقد شرایط
- parse کامل PHP و اجرای رفتاری دو endpoint هدف با PHP 8.3.32 WebAssembly
