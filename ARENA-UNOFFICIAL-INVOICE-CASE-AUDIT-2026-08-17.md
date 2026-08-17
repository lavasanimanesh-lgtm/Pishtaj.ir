# بررسی وضعیت فاکتور غیررسمی در پرونده‌های فروش — نسخهٔ ۳

- **برنچ:** `arena/01a00e5b-pishtaj-ir` (شعبهٔ نشست)
- **وضعیت:** فقط ارزیابی؛ **هیچ تغییر کدی اعمال نشده است.**
- **تاریخ:** ۱۴۰۵/۰۵/۲۶ (۲۰۲۶-۰۸-۱۷) — به‌روزرسانی پس از افزودن دو الزام مهم (تجمیع چند پیشنهاد + ابطال ریشه‌کن)
- **دامنه:** پاسخ به پرسش‌های شما + تأیید ۴ الزام اساسی

---

## ۰. خلاصهٔ مدیریتی (TL;DR) — نسخهٔ نهایی

سه پدیدهٔ به‌هم‌پیوسته در نسخهٔ Production ایجاد شده‌اند که در ترکیب با ۴ الزام تأییدشده توسط شما، تصویر زیر را می‌سازند:

| # | پدیده | شدت | مسیر |
|---|---|---|---|
| ۱ | **معماری فروش به سمت سرور-محور (Sales Domain v2 / v35) مهاجرت کرده** اما مسیر فاکتور غیررسمی هنوز دو حالت محلی/سروری دارد. | متوسط | `rbac.js`, `unofficial-invoice.js`, `sales-domain-v2.js` |
| ۲ | **دو پیاده‌سازی متفاوت از `ptfInvoiceVoid`** وجود دارد — قدیمی محلی در `rbac.js` و جدید سرور-محور در `official-invoice-v2.js`؛ نسخهٔ سرور-محور برنده می‌شود و برای فاکتورهای غیررسمی «بی‌اثر» عمل می‌کند. | بالا | ترتیب بارگذاری در `index.html` |
| ۳ | **صدور فاکتور غیررسمی فقط از ماژول پیشنهادها و فقط برای CO/TC برنده**؛ اقلام عیناً کپی می‌شود بدون UI برای ویرایش قیمت قلم‌به‌قلم. | متوسط-بالا | `offers.js:616`, `unofficialInvoicePrint` |

**نتیجه:** قابلیت فاکتور غیررسمی نه از بین رفته بلکه تنگ‌تر و شکننده‌تر شده است.

---

## ۰.۱ چهار الزام تأییدشدهٔ نهایی توسط کارفرما (۱۴۰۵/۰۵/۲۶)

این الزام‌ها «قرارداد پروژه» هستند و در تمام مراحل رعایت می‌شوند:

### الزام ۱ — ویرایش قیمت قلم‌به‌قلم در صدور فاکتور غیررسمی
- **پیش‌فرض** قیمت هر قلم باید **از پیشنهاد مالی (CO) همان پرونده** لود شود.
- کاربر (نقش ارشد/حسابدار) باید بتواند **هر قلم** را در دیالوگ صدور **تغییر** دهد (تعداد، قیمت واحد، یا حذف).
- «مبلغ نهایی فاکتور = مجموع قیمت‌های نهایی اقلام (پس از ویرایش)»

### الزام ۲ — تأکید مجدد بر مبنای مطالبات
- مطالبات باز، وصولی‌ها، و ماندهٔ حساب مشتری **دقیقاً بر اساس فاکتور(های) صادره** محاسبه می‌شود. این قید توسط معماری فعلی (Sales Domain v2) هم‌اکنون رعایت می‌شود. **هیچ راه‌حل جایگزین اضافه نمی‌شود.**

### الزام ۳ — صدور فاکتور غیررسمی از **تمام** پیشنهادهای متصل به پرونده، شامل حالت **تجمیعی** 🔄 جدید
- دکمهٔ صدور باید برای **هر یک از پیشنهادهای متصل به پرونده** نمایش داده شود (نه فقط برنده):
  - پیشنهاد برندهٔ اصلی (`wonOffer`)
  - پیشنهادهای جایگزین (`altOf`)
  - متمم‌ها (`amendmentOfCaseId` یا متصل به پرونده)
  - زنجیرهٔ `srcToNo`/`coNo`
- **حالت تجمیعی:** کاربر باید بتواند چند پیشنهاد را انتخاب کند و **یک فاکتور غیررسمی واحد** با اقلام تجمیع‌شده صادر کند:
  - در حالت تجمیعی، قیمت‌های پیش‌فرض از **پیشنهاد مالی (CO) همان پرونده** لود می‌شوند (نه از پیشنهادهای فنی).
  - در حالت غیرتجمیعی (تک‌پیشنهاد)، اگر پیشنهاد انتخاب‌شده CO نباشد (مثلاً TC)، قیمت‌ها از خود آن پیشنهاد لود می‌شوند.
- **شناسهٔ فاکتور تجمیعی:** الگوی پیشنهادی «`UN-INV-CONSOLIDATED-<dealCd>-<YYYYMMDDHHmm>`» برای جلوگیری از تعارض با چندین فاکتور روی یک پیشنهاد.
- **ردیابی منبع اقلام:** فیلد جدید `consolidatedFromOffers: [{offerNo, kind, itemsCount, totalIrr, sharePct}]` روی رکورد فاکتور، برای شفافیت حسابرسی و بازتولید اقلام در چاپ/نسخهٔ رندر.

### الزام ۴ — ابطال فاکتور غیررسمی «ریشه‌کن» تمام آثار مالی 🔄 جدید
وقتی کاربر فاکتور غیررسمی را ابطال می‌کند، **تمام آثار مالی زیر باید در یک عملیات اتمی پاک/باطل شوند**. هیچ اثر مالی **متصل به فاکتور** نباید پس از ابطال باقی بماند، **به‌استثنای وصولی‌های مندرج در فاکتور** که باید **محفوظ بمانند** (توضیح زیر):

### ⚠️ الزام ۵ — قید حفاظتی وصولی‌های مندرج در فاکتور 🔄 جدید (تأیید کارفرما)
**وصولی‌های مندرج در فاکتور (`inv.payments[]` به‌جز پیش‌پرداخت علی‌الحساب از خود فاکتور) نباید در ابطال حذف یا ابطال شوند.** این وصولی‌ها نمایندهٔ پول واقعی جابجا‌شده از مشتری هستند؛ حذف آن‌ها تراز واقعی مشتری را به‌غلط کاهش می‌دهد.

رفتار صحیح:
- ابطال فاکتور **نگه‌داری‌کنندهٔ وصولی‌ها** است؛ رکورد پرداخت‌ها حذف نمی‌شود.
- چنانچه پس از ابطال، این وصولی‌ها به هیچ فاکتور دیگری تخصیص نیابند → **تبدیل به بستانکاری مشتری** می‌شوند.
- اگر فاکتورهای باز دیگری برای همان مشتری وجود داشته باشند → پس از ابطال، **تخصیص FIFO خودکار** در اولویت اول رعایت می‌شود (یعنی اگر receipt آزادشده از فاکتور ابطال‌شده به فاکتور باز دیگری قابل تخصیص باشد، این انتقال اتوماتیک است).

چک‌های متصل از طریق `pay.chequeCd` نیز مشمول همین قید هستند: **ابطال خودکار نمی‌شوند** (یک سند مالی مستقل‌اند). فقط یادداشت audit روی فاکتور و روی رکورد چک اضافه می‌شود و ابطال نهایی توسط حسابدار از ماژول چک (`cheque-module.js#ptfChequeVoid` با دلیل + تأیید صریح) انجام می‌شود.

### ⚠️ قید حفاظتی تأییدشده توسط کارفرما (الزام ۵)

> **وصولی‌های مندرج در فاکتور نباید حذف/ابطال شوند.** این وصولی‌ها نمایندهٔ پول واقعی جابجا‌شده از مشتری هستند؛ حذف آن‌ها تراز واقعی مشتری را به‌غلط کاهش می‌دهد. در عوض:
> - اگر این وصولی‌ها به فاکتور دیگری تخصیص ندارند (پس از ابطال)، به **بستانکاری مشتری** تبدیل می‌شوند.
> - اگر فاکتورهای باز دیگری برای همان مشتری وجود دارد، **اولویت‌بندی FIFO** در تخصیص مجدد رعایت می‌شود.

| ردیف | اثر مالی | محل ذخیره | عملیات ابطال |
|---|---|---|---|
| ۱ | **رکورد فاکتور** (مطالبه) | `ptf_crm_invoices[i]` | `status='void'` + `voidAt`/`voidBy`/`voidReason` |
| ۲ | **وصولی‌های مندرج در فاکتور** (`inv.payments[]` غیر از پیش‌پرداخت علی‌الحساب) | `inv.payments[].cd` | ❌ **حذف نمی‌شود.** رکورد اصلی محفوظ می‌ماند برای audit. تخصیص FIFO (در صورت وجود) آزاد می‌شود؛ مبلغ آزادشده به بستانکاری مشتری تبدیل می‌شود (`creditRemainIRR` روی `ptf_crm_case_receipts` یا ورودی جدید در `customer-finance.js#creditForCustomer`) |
| ۳ | **پیش‌پرداخت علی‌الحساب ثبت‌شده** (`payments[].fromAdvance=true`) | `inv.payments[].cd='RP-ADV-...'` | رکورد محفوظ می‌ماند (بخشی از خود فاکتور است)؛ توضیح در بند ۲ |
| ۴ | **چک‌های متصل (از طریق pay.chequeCd)** | `ptf_crm_cheques_*` | ❌ **ابطال خودکار نمی‌شود.** فقط **یادداشت audit** ثبت می‌شود: «این فاکتور ابطال شد ولی چک [cd] جداگانه توسط ماژول چک قابل پیگیری است.» سرویس اختصاصی ابطال چک فقط از ماژول چک (`cheque-module.js#ptfChequeVoid`) فراخوانی می‌شود تا کنترل صریح حسابدار روی چک حفظ شود. |
| ۵ | **تخصیص‌های FIFO از دریافت پرونده** (`ptf_crm_receipt_allocations.invoiceCd === invCd`) | `ptf_crm_receipt_allocations` | **ابطال تخصیص** + **بستانکاری‌سازی خودکار**: اگر سهم تخصیص‌یافته به فاکتور ابطال‌شده L ریال بود، `L` ریال به `creditForCustomer(cd)` اضافه می‌شود (یا به‌صورت `receipt.creditRemainIRR` به دریافت پرونده برمی‌گردد) |
| ۶ | **دریافت‌های قطعی متصل (`ptf_crm_case_receipts`)** اگرچه معماری v2 معمولاً در سطح پرونده است نه فاکتور | `ptf_crm_case_receipts` | ❌ **حذف نمی‌شود.** رکورد پرداخت واقعی محفوظ می‌ماند؛ فقط تخصیص FIFO آن به فاکتور ابطال‌شده معکوس می‌شود |
| ۷ | **مرجوعی‌های فروش متصل** (`ptf_crm_sales_returns.invoiceCd === invCd`) | `ptf_crm_sales_returns` | ✅ `status='void'` + حذف اثر اعتبار از مشتری (مرجوعی سند مستقلی **نیست**؛ ثبت ابطال فاکتور است) |
| ۸ | **رویدادهای timeline پرونده** | `ptf_crm_deals[t].timeline[]` و `[].documentAudit[]` | افزودن رویداد ابطال با لیست دقیق آثار حذف‌شده/محفوظ‌شده |
| ۹ | **پروندهٔ مالی متصل** (`caseId`) | `ptf_crm_deals[]` | بازسازی `sfStageOf()` |
| ۱۰ | **سند فاکتور** (اگر رویداد «فایل ضمیمه» ذخیره شده) | `inv.files[]` | حذف فیزیکی از فضای ابری + جدا کردن لینک از `r.docs` |
| ۱۱ | **در معماری سرور-محور (v2)**: ثبت در سرور | سرور `ptf_crm_invoices` + مرتبط‌ها | فراخوان سرور `void_unofficial_invoice` (endpoint جدید، نیاز به بررسی سمت سرور) |

**جدول تمایز رفتاری:**

| نوع رکورد | ابطال خودکار؟ | دلیل |
|---|---|---|
| رکورد خود فاکتور | ✅ بله | سند مالی صوری است |
| **`inv.payments[]`** (وصولی‌های مندرج) | ❌ **خیر** | پول واقعی جابجا شده؛ نمایندهٔ تراز مثبت مشتری است |
| **چک‌های متصل** | ❌ **خیر** (تأیید حسابدار جدا) | چک یک سند مستقل ارزشی است؛ ابطال فقط با اختیار صریح حسابدار |
| **تخصیص‌های FIFO** | ✅ بله (آزادسازی + بستانکاری) | تخصیص یک ربط منطقی است؛ خود پرداخت محفوظ |
| **مرجوعی‌های متصل** | ✅ بله (با حذف اثر) | مرجوعی یک سند صوری متصل به فاکتور است |
| **سند فایل فاکتور** | ✅ بله | فایل ضمیمهٔ فاکتور؛ با ابطال فاکتور دیگر مرجع نیست |

**الگوی مرجع:** ترکیب `ptfInvoicePayVoid` (rbac.js) + `cleanUpDoubleInvoices` + `cheque-module.js#ptfChequeVoid` (فقط در صورت درخواست صریح کاربر) + `sales-domain-v2.js#ptfReceiptVoid` + `cfCreditAudit` (در `customer-finance.js`).

---

## ۱. قالب فاکتور غیررسمی — بازسازی دقیق از کد امروز

فایل `crm/unofficial-invoice.js` (۱۱۷۷ خط) شامل تابع `generateUnofficialInvoiceHtml()` (خطوط ۸۸–۳۵۶) است که سند HTML یک فاکتور غیررسمی را می‌سازد. **برای حالت تجمیعی (الزام ۳)،** قالب باید کمی اصلاح شود (در فصل ۴.۲ گام ۳ توضیح داده شده).

### ۱.۱ ساختار سند (مشتق از `unofficial-invoice.js#generateUnofficialInvoiceHtml`)

```html
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <!-- فونت Vazirmatn (Regular / Medium / Bold / Black با فرمت woff2) -->
  <!-- تگ‌های print-color-adjust برای چاپ رنگی -->
</head>
<body>
  <div class="bill-wrapper">
    <div class="bill-header">
      <!-- عنوان: «صورتحساب پرداخت» (Vazirmatn Black, 26px) -->
      <!-- زیرعنوان: «صورتحساب اقلام و خدمات موضوع پیشنهاد» -->
      <!-- اطلاعات خریدار/کارفرما و رابط خریدار -->
      <!-- شماره سند (INV-CONSOLIDATED-* یا INV-...) + تاریخ شمسی -->
      <!-- اگر تجمیعی: فهرست منبع اقلام -->
    </div>
    <table class="bill-table">
      <thead>
        <!-- ستون‌ها: ردیف | منبع (PTF-CO-001, ...) | شرح کالا/خدمات | تعداد | واحد | قیمت واحد | قیمت کل -->
      </thead>
      <tbody>
        <!-- ردیف‌های اقلام -->
        <!-- ردیف «جمع کل صورتحساب» (رنگ آبی) -->
        <!-- اگر تخفیف: ردیف کاهش بدهی (رنگ قرمز) -->
        <!-- اگر پیش‌پرداخت: ردیف کسر پیش‌پرداخت (رنگ زرد) -->
        <!-- اگر تخفیف یا پیش‌پرداخت: ردیف باقی‌مانده خالص (رنگ سبز) -->
      </tbody>
    </table>
    <!-- باکس تسعیر، شماره حساب، امضا -->
  </div>
</body>
```

### ۱.۲ الگوریتم محاسبهٔ مبلغ (حفظ می‌شود)

این الگوریتم با اقلام **ویرایش‌شده و تجمیع‌شده** اجرا می‌شود؛ نه اقلام خام پیشنهاد.

| گام | فرمول | منبع |
|---|---|---|
| ۱. جمع کل اقلام به ارز سند (پس از ویرایش/تجمیع) | `total = Σ (qtyEdited[i] × priceEdited[i])` | خط ۸۹ |
| ۲. نرخ مرجع ارز | `rate = o.fxRateRef \|\| 1` | خط ۱۲۵ |
| ۳-۸ | (همان الگوریتم فعلی، بدون تغییر) | خطوط ۱۶۱–۱۶۶ |

### ۱.۳ داده‌های فعلی `ptf_crm_invoices` برای فاکتور غیررسمی + فیلدهای جدید پیشنهادی

```js
{
  // فیلدهای موجود:
  cd: 'UN-INV-' + o.no,                 // شناسهٔ یکتا
  caseId: _salesCase._id || _salesCase.cd,
  customerId: _salesCase.buyerCd || o.buyerCd,
  no: invoiceNo,                          // INV-CO-... / INV-TC-... / INV-CONSOLIDATED-...
  offerNo: o.no,                          // برای تجمیعی: اولین پیشنهاد (یا شمارهٔ پرونده)
  amount: amountIrr,
  base: totalIrr,
  vat: 0,
  discount: discountIrr,
  discountLabel: discountLabel,
  discountInput: discountInput,
  invDate: faDate(),
  t: faDate(),
  buyerCo: o.buyerCo,
  offerCurrency: o.currency,
  offerFxBasis: o.fxBasis,
  offerFxRateRef: currentRate,
  payments: [{ cd:'RP-ADV-'+o.no, amt:advPayIrr, ..., fromAdvance:true }, ...],
  isUnofficial: true,
  bankAccount: bankAccount,
  by: curSession().name,
  status: 'active',

  // ===== فیلدهای جدید پیشنهادی برای گام ۳ (الزام ۳) =====
  invoiceKind: 'single' | 'consolidated',  // نوع: تک‌پیشنهاد یا تجمیعی
  sourceOfferNo: o.no,                       // مرجع اصلی (CO پیشنهاد مالی)
  consolidatedFromOffers: null,              // برای تکی: null
  // برای تجمیعی:
  // consolidatedFromOffers: [
  //   { offerNo: 'PTF-CO-001', kind: 'CO', itemsCount: 3, totalIrr: 18500000, sharePct: 51.4 },
  //   { offerNo: 'PTF-CO-002', kind: 'CO', itemsCount: 2, totalIrr: 17500000, sharePct: 48.6 }
  // ]

  // ===== فیلدهای جدید پیشنهادی برای گام ۳ (الزام ۱: ویرایش قیمت) =====
  overridedFromOffer: true,                   // علامت می‌زند که اقلام ویرایش شده‌اند
  overruledLineCount: 2,                      // چند قلم ویرایش شده
  linesSnapshot: [
    // عکس فوری اقلام برای چاپ و تکرارپذیری
    { idx: 0, name: '...', qtyOrig: 2, priceOrig: 12500000, qtyFinal: 2, priceFinal: 12000000, fromOffer: 'PTF-CO-001' },
    ...
  ],

  // ===== فیلدهای جدید برای گام ۱ (الزام ۴: ابطال ریشه‌کن) =====
  voidCascadeLog: null,                      // پس از ابطال: فهرست شناسهٔ رکوردهای مالی باطل‌شده (برای audit)
  // {
  //   voidedPayments: [{ cd:'RPAY-001', amt:5000000, reversalCd:'RPVOID-001' }, ...],
  //   voidedCheques: [{ cd:'CHQ-001', amt:5000000, st:'void' }],
  //   reversedAllocations: [{ id:'ALLOC-001', receiptCd:'RPAY-00A', amount:2000000 }],
  //   voidedReturns: [{ cd:'SRET-001', amount:1000000 }],
  //   removedFiles: [{ key:'fin/INV/...' }]
  // }
}
```

---

## ۲. چرا دکمهٔ «ابطال» روی فاکتورهای غیررسمی قدیمی کار نمی‌کند؟

### ۲.۱ ترتیب بارگذاری اسکریپت‌ها در `index.html`

```html
<script src="rbac.js?v=34.7.16"></script>              <!-- ۱. تعریف قدیمی ptfInvoiceVoid در rbac.js:1110 -->
<script src="salesfiles.js?v=34.7.16"></script>
<script src="customer-finance.js?v=34.7.16"></script>
<script src="unofficial-invoice.js?v=34.7.16"></script>
<script src="official-invoice-v2.js?v=34.7.16"></script>  <!-- ۳. تعریف جدید ptfInvoiceVoid — آخرین برنده! -->
```

نسخهٔ سرور-محورِ `official-invoice-v2.js:52` برنده می‌شود و برای فاکتورهای غیررسمی (پیشوند `UN-INV-`) با خطای نامعلوم reject می‌شود + اگر قبلاً void محلی شده باشند، `if (!active(i)) return` بی‌صدا عمل می‌کند.

### ۲.۲ وضعیت موجود

| سناریو | نسخهٔ قدیمی (محلی) | نسخهٔ جدید (سرور) |
|---|---|---|
| نقش غیر ارشد/حسابدار | alert «فقط مدیران ارشد» | alert «نقش فعلی مجاز نیست» |
| وضعیت فعلی void | alert «قبلاً ابطال شده» | ریزش ساکت |
| فاکتور غیررسمی سالم | تغییر محلی status | فراخوانی سرور (reject) |

(جزئیات بیشتر در بند ۲.۳ نسخهٔ قبلی گزارش موجود است؛ در اینجا فقط خلاصه.)

---

## ۳. معماری فعلی و محل‌های مصرف

### ۳.۱ معماری v35 (Sales Domain V2)
- فاکتور غیررسمی = سند حسابداری تعهدی محلی + سند فروش سرور-محور.
- `customer-finance.js` (خط ۱۸) فاکتورهای غیررسمی را فقط برای نقش‌هایی که `ptfCanSeeLedger('unofficial')` مجاز می‌داند نشان می‌دهد.
- «دفتر غیررسمی» = آرایهٔ `payments` فاکتور + مرجوعی‌ها در `ptf_crm_sales_returns` + تخصیص‌های FIFO در `ptf_crm_receipt_allocations`.

### ۳.۲ تمام رکوردهایی که ابطال باید پاک کند (نقشه‌برداری کامل برای الزام ۴)

| کلید | فیلد مرتبط با فاکتور | توضیح |
|---|---|---|
| `ptf_crm_invoices` | `cd` (شناسهٔ فاکتور) | رکورد اصلی: وضعیت + دلیل + زمان ابطال |
| `ptf_crm_invoices[].payments[]` | `chequeCd` (اگر دارد) | چک‌های متصل (الگوی `cheque-module.js#ptfChequeVoid`) |
| `ptf_crm_cheques_received` / `ptf_crm_cheques_issued` | `sourceInvoiceCd === inv.cd` یا `invoiceCd === inv.cd` | ابطال خودکار اگر باز؛ در غیر این صورت فقط علامت لینک قطع شود |
| `ptf_crm_receipt_allocations` | `invoiceCd === inv.cd` | ابطال تخصیص (الگوی `sales-domain-v2.js#ptfReceiptVoid`) + آزادسازی بستانکاری |
| `ptf_crm_case_receipts` | `invoiceCd === inv.cd` (نادر) | دریافت‌هایی که مستقیماً به فاکتور متصل‌اند |
| `ptf_crm_sales_returns` | `invoiceCd === inv.cd` | مرجوعی‌های متصل (`status='void'`) |
| `ptf_crm_deals[].timeline[]` | — | افزودن رویداد ابطال |
| `ptf_crm_deals[].docs[]` | کلید فایل = `inv.files[].key` | جدا کردن فایل از پرونده |
| سرور (v2) | — | فراخوان `void_unofficial_invoice` |

### ۳.۳ دکمهٔ صدور فقط در `offers.js:616`

الان فقط برای CO/TC و فقط وقتی `isWon`. در خود پرونده (`salesfiles.js`) دکمهٔ مستقیم وجود ندارد.

---

## ۴. راهکار پیشنهادی (بدون تغییر معماری)

### ۴.۱ اصول طراحی

1. **هیچ فرمول موجود تغییر نمی‌کند.** الگوریتم محاسبهٔ مبلغ، `cleanUpDoubleInvoices`، ساختار `payments.fromAdvance`، همه دست‌نخورده می‌مانند. فقط **ورودی‌های الگوریتم** (آرایهٔ اقلام) از یک دیالوگ قابل‌ویرایش می‌آیند.
2. **معماری سرور-محور فعلی (Sales Domain V2) حفظ می‌شود.** هر عمل ابطال با `ptfSalesDomainApi` هماهنگ می‌شود.
3. **مبالغ نهایی در فاکتور صادره حاکم است؛ الگوریتم‌های پایین‌دست از `ptf_crm_invoices.amount`/`payments` می‌خوانند** — قید تأییدشده در ۰.۱.
4. **ابطال ریشه‌کن: تمام آثار مالی پاک می‌شوند** — قید تأییدشده در ۰.۱.
5. **هر تغییر فقط افزایشی است؛** رفتار موجود تغییر نمی‌کند.
6. **هر گام مستقل است و در یک کامیت/پوش قابل بازگردانی است.**

### ۴.۲ گام‌های پیاده‌سازی

#### گام ۱ — ابطال ریشه‌کن فاکتور غیررسمی (الزام ۴؛ ریسک: متوسط؛ فایده: بالا)

افزودن `window.ptfUnofficialInvoiceVoid(invCd)` (و helper های آن) که:

**الف) guard های ورودی:**
- وجود رکورد در `ptf_crm_invoices` (پیغام خطا اگر نیست).
- `i.isUnofficial === true` (فقط غیررسمی‌ها — رسمی‌ها از مسیر سرور-محور فعلی رد می‌شوند).
- نقش: `isSenior() || role()==='accountant'`.
- وضعیت فعلی: `status !== 'void'` و `st !== 'void'`.
- سال مالی قفل نباشد (`ptfFiscalYearLocked(invYear) === false`).
- **تأیید کاربر با پیام «تمام آثار مالی پاک می‌شود + دلیل اجباری»** (الگوی `prompt('دلیل ابطال:')` + `confirm('مطمئنید؟')`).

**ب) cascade ابطال (به ترتیب عملیات اتمی) — بر اساس الزام ۵ (حفاظت وصولی‌ها):**

```js
cascadeLog = {
  preservedPayments: [],   // وصولی‌هایی که محفوظ ماندند (الزام ۵)
  chequeAudited: [],        // چک‌های متصلی که فقط audit گرفتند (ابطال خودکار نشدند — الزام ۵)
  reversedAllocations: [],  // تخصیص‌های FIFO آزادشده از فاکتور ابطال‌شده
  freedCreditAmount: 0,     // مجموع مبلغی که به بستانکاری مشتری تبدیل شد
  voidedReturns: [],        // مرجوعی‌های متصل ابطال‌شده
  removedFiles: []          // فایل‌های ضمیمه‌ای جدا‌شده از پرونده
};

// ۱. وصولی‌های مندرج در فاکتور — فقط audit، بدون تغییر (الزام ۵)
inv.payments.forEach(function(p) {
  if (p.fromAdvance) return; // پیش‌پرداخت علی‌الحساب (بخشی از خود فاکتور)
  if (p.status === 'reversal') return; // قبلاً ابطال‌شده
  cascadeLog.preservedPayments.push({
    cd: p.cd || '',
    amt: +p.amt || 0,
    how: p.how || '',
    t: p.t || '',
    prescribedAction: 'retain-as-customer-credit-or-fifo'
  });
});

// ۲. چک‌های متصل — فقط audit، ابطال خودکار نمی‌شود (الزام ۵)
var allCheques = (function () {
  var cs = [];
  try { cs = cs.concat(getData('ptf_crm_cheques_received') || []); } catch(e) {}
  try { cs = cs.concat(getData('ptf_crm_cheques_issued') || []); } catch(e) {}
  try { cs = cs.concat(getData('ptf_crm_cheques') || []); } catch(e) {}
  return cs;
})();
allCheques.forEach(function(c) {
  if (c && (c.sourceInvoiceCd === inv.cd || c.invoiceCd === inv.cd)) {
    var already = cascadeLog.chequeAudited.some(function(x){ return x.chequeCd === c.cd; });
    if (!already) {
      cascadeLog.chequeAudited.push({
        chequeCd: c.cd,
        currentSt: c.st,
        action: 'audit-only',
        note: 'ابطال فقط از ماژول چک قابل انجام است'
      });
    }
  }
});

// ۳. تخصیص‌های FIFO مرتبط — ابطال + بستانکاری‌سازی (الزام ۴ — ریشه‌کن)
// ۳.۱) ابطال تخصیص‌های متصل به فاکتور جاری
if (window.PTF_SALES_DOMAIN_V2) {
  var allocs = getData('ptf_crm_receipt_allocations') || [];
  allocs.forEach(function(a) {
    if (a.invoiceCd === inv.cd && a.status !== 'reversed') {
      var freedAmount = +a.amount || 0;
      a.status = 'reversed';
      a.reversedAt = faDateTime();
      a.reversedBy = curSession().name;
      a.reversalReason = reason;
      cascadeLog.reversedAllocations.push({
        id: a._id || a.cd,
        receiptId: a.receiptId,
        receiptCd: a.receiptCd,
        amount: freedAmount
      });
      cascadeLog.freedCreditAmount += freedAmount;
    }
  });
  setData('ptf_crm_receipt_allocations', allocs);

  // ۳.۲) به‌روزرسانی creditRemainIRR روی receiptهای آزادشده
  // (مبلغ آزادشده‌ای که هنوز به فاکتور دیگری تخصیص نیافته، به creditRemainIRR اضافه می‌شود =
  //  بستانکاری مشتری نزد شرکت)
  var receipts = getData('ptf_crm_case_receipts') || [];
  var stillAllocatedByReceipt = {};
  (getData('ptf_crm_receipt_allocations') || []).forEach(function(a) {
    if (a.status !== 'reversed' && a.receiptId) {
      stillAllocatedByReceipt[a.receiptId] =
        (stillAllocatedByReceipt[a.receiptId] || 0) + (+a.amount || 0);
    }
  });
  receipts.forEach(function(r) {
    if (r.status === 'posted' && !r.voided) {
      var allocated = stillAllocatedByReceipt[r._id || r.cd] || 0;
      var newCredit = Math.max(0, (+r.amountIRR || +r.amt || 0) - allocated);
      if ((+r.creditRemainIRR || 0) !== newCredit) {
        r.creditRemainIRR = newCredit;
      }
    }
  });
  setData('ptf_crm_case_receipts', receipts);
}

// ۴. ابطال مرجوعی‌های متصل
var returns = getData('ptf_crm_sales_returns') || [];
returns.forEach(r => {
  if (r.invoiceCd === inv.cd && r.status !== 'void') {
    r.status = 'void'; r.voidAt = faDateTime(); r.voidBy = curSession().name; r.voidReason = reason;
    cascadeLog.voidedReturns.push({ cd: r.cd, amount: r.totalAmount });
  }
});
setData('ptf_crm_sales_returns', returns);

// ۵. جدا کردن فایل‌های فاکتور از پرونده (ایمن: فقط جدا کردن، نه حذف فیزیکی)
if (inv.files && inv.files.length && inv.caseId) {
  var deals0 = getData('ptf_crm_deals');
  var d0 = deals0.filter(function(x){ return String(x._id || x.cd) === String(inv.caseId); })[0];
  if (d0) {
    inv.files.forEach(function(f) {
      if (!f.key) return;
      d0.docs = (d0.docs || []).filter(function(x){ return x.key !== f.key; });
      cascadeLog.removedFiles.push(f.key);
    });
    setData('ptf_crm_deals', deals0);
  }
}

// ۶. علامت‌گذاری خود فاکتور
inv.status = 'void'; inv.st = 'void'; inv.voidAt = faDateTime(); inv.voidBy = curSession().name; inv.voidReason = reason; inv.voidCascadeLog = cascadeLog;

// ۷. timeline پرونده (با گزارش دقیق آنچه ابطال شد + آنچه محفوظ ماند)
if (inv.caseId) {
  var deals = getData('ptf_crm_deals');
  var d = deals.filter(function(x){ return String(x._id || x.cd) === String(inv.caseId); })[0];
  if (d) {
    d.timeline = d.timeline || [];
    var preservedAmt = cascadeLog.preservedPayments.reduce(function(s,p){ return s + (+p.amt || 0); }, 0);
    d.timeline.push({
      t: faDateTime(),
      by: curSession().name,
      tx: '🗑 ابطال ریشه‌کن فاکتور غیررسمی ' + inv.no + ' — ' +
        'ابطال شد: ' + cascadeLog.voidedReturns.length + ' مرجوعی / ' + cascadeLog.reversedAllocations.length + ' تخصیص (بستانکاری‌سازی ' + cascadeLog.freedCreditAmount.toLocaleString('fa-IR') + ' ریال); ' +
        'محفوظ ماند: ' + cascadeLog.preservedPayments.length + ' وصولی واقعی (به‌مبلغ ' + preservedAmt.toLocaleString('fa-IR') + ' ریال — به‌عنوان بستانکاری مشتری یا FIFO برای فاکتورهای باز); ' +
        'چک (فقط audit): ' + cascadeLog.chequeAudited.length + ' مورد ابطال خودکار نشد'
    });
    setData('ptf_crm_deals', deals);
  }
}

// ۸. setData و audit نهایی
setData('ptf_crm_invoices', invs);
audit('فاکتور غیررسمی',
  'ابطال ریشه‌کن فاکتور ' + inv.no + ' — مبلغ فاکتور: ' + (+inv.amount || 0).toLocaleString('fa-IR') + ' ریال — دلیل: ' + reason + ' — ' +
  'وصولی محفوظ: ' + cascadeLog.preservedPayments.length + ' / ' +
  'تخصیص آزادشده: ' + cascadeLog.reversedAllocations.length + ' (بستانکاری: ' + cascadeLog.freedCreditAmount.toLocaleString('fa-IR') + ' ریال) / ' +
  'مرجوعی ابطال‌شده: ' + cascadeLog.voidedReturns.length + ' / ' +
  'چک (فقط audit): ' + cascadeLog.chequeAudited.length,
  inv.cd);

// ۹. رندر مجدد
if (typeof renderDeals === 'function') renderDeals();
if (typeof renderReceivables === 'function') renderReceivables();
if (typeof ptfToast === 'function') {
  ptfToast(
    'فاکتور غیررسمی ابطال شد. ' +
    cascadeLog.preservedPayments.length + ' وصولی محفوظ ماند (الزام ۵ — به‌عنوان بستانکاری یا FIFO). ' +
    cascadeLog.freedCreditAmount.toLocaleString('fa-IR') + ' ریال بستانکاری آزاد شد.' +
    (cascadeLog.chequeAudited.length ? ' ' + cascadeLog.chequeAudited.length + ' چک متصل برای ابطال به ماژول چک ارجاع شد.' : ''),
    'ok'
  );
}
```

**ج) در `salesfiles.js:967`** دکمهٔ ابطال غیررسمی به این تابع تازه تغییر مسیر داده می‌شود.

**د) محدودیت دسترسی UI:** فقط نقش‌های `senior + accountant` دکمه را می‌بینند.

**تبعات مثبت:** تمام نگرانی‌های کاربر در بارهٔ «باقی ماندن آثار مالی» حذف می‌شود چون تمام ۱۱ ردیف جدول ۰.۱ در یک عملیات واحد پوشش داده می‌شوند.

#### گام ۲ — دکمهٔ صدور در پرونده + حالت تجمیعی چند پیشنهاد (الزام ۳؛ ریسک: متوسط؛ فایده: بالا)

**الف) در `salesfiles.js#sfDrawerHtml`** یک اکشن post-award جدید:
```js
postAction(
  'unofficial-invoice',
  '🧾',
  'صورتحساب غیررسمی',
  'صدور صورتحساب پرداخت غیررسمی برای هر پیشنهاد متصل به پرونده (تکی یا تجمیعی از چند پیشنهاد). پیش‌فرض = پیشنهاد مالی CO؛ قیمت هر قلم قابل ویرایش است.',
  'sfUnofficialInvoiceNew(\'' + ptfOnClickArg(r.cd) + '\')'
)
```

**ب) تابع `sfUnofficialInvoiceNew(dealCd)`:**
1. لیست **تمام پیشنهادهای متصل** به پرونده را جمع می‌کند:
   - `r.wonOffer` (برنده اصلی)
   - `r.amendmentOfCaseId`-ها
   - `altOf`/`srcToNo`/`coNo` (در لایهٔ پیشنهاد)
2. **اولویت‌بندی:** پیشنهاد مالی (CO) اگر در لیست هست به‌عنوان مرجع پیش‌فرض پیشنهاد می‌شود؛ در غیر این صورت، پیشنهاد برنده.
3. حالت‌های انتخاب:
   - **تک‌پیشنهاد:** فقط یک پیشنهاد انتخاب شود → فاکتور تکی (رفتار فعلی).
   - **تجمیعی:** چند پیشنهاد انتخاب شود → ترکیب اقلام + فیلد `consolidatedFromOffers` در رکورد فاکتور.
4. فراخوان `unofficialInvoicePrintWithLines(primaryOfferNo, linesSnapshot, consolidatedMeta)`:
   - اگر `linesSnapshot` صفر/تعریف‌نشده → مسیر فعلی (سازگار).
   - در غیر این صورت → اقلام ویرایش‌شده محاسبه می‌شوند.

**ج) محدودیت دسترسی:** فقط `senior + accountant`؛ حالت پرونده: `sfStageOf(r) >= 7` (پس از تحویل کارفرما).

**د) شناسهٔ فاکتور تجمیعی:** `cd: 'UN-INV-CONSOLIDATED-<dealCd>-<YYYYMMDDHHmm>'` (الگو به تأیید کارفرما)؛ فیلد `offerNo` به اولین پیشنهاد و فیلد `consolidatedFromOffers` به آرایهٔ کامل تنظیم می‌شود.

#### گام ۳ — دیالوگ «اقلام با قیمت قابل‌ویرایش» (الزام ۱؛ ریسک: پایین؛ فایده: بالا)

ساختار دیالوگ پیشنهادی:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🧾 صدور صورتحساب پرداخت غیررسمی                                      │
│                                                                     │
│ ▌ حالت: [● تک‌پیشنهاد ○ تجمیعی چند پیشنهاد]                          │
│                                                                     │
│ پیشنهاد(های) انتخاب‌شده: [PTF-CO-1405-007 ▼] (برای تجمیعی: چندتایی) │
│ مرجع قیمت پیش‌فرض: CO (پیشنهاد مالی) ✓ (قابل تغییر هر قلم)         │
│                                                                     │
│ ┌───┬────┬───────────────────────────┬─────┬───────┬─────────┬──────┐│
│ │#  │منبع│ شرح کالا                 │ تعداد│ واحد │قیمت واحد│ کل ││
│ ├───┼────┼───────────────────────────┼─────┼───────┼─────────┼──────┤│
│ │۱  │-007│ شیر فشارشکن ۴ اینچ       │ ۲ │ دستگاه│[12,500,000]│25,000,000││
│ │۲  │-007│ گیج فشار ۰-۱۰ بار         │ ۴ │ عدد   │[ 1,800,000]│ 7,200,000││
│ │۳  │-008│ شلنگ هیدرولیک (از متمم)   │ ۱۰│ متر   │[   350,000]│ 3,500,000││
│ │۴  │+افزودن قلم سفارشی          │     │       │             │      ││
│ └───┴────┴───────────────────────────┴─────┴───────┴─────────┴──────┘│
│                                                                     │
│ 💡 قیمت پیش‌فرض از پیشنهاد مالی (CO) همان پرونده لود شده.           │
│ تغییرات در لحظه در جمع کل اعمال می‌شود.                             │
│                                                                     │
│ جمع کل اقلام (ریال):  35,700,000                                    │
│ تخفیف (درصد/مبلغ) [اختیاری]:        [____]                          │
│ شماره حساب / شبا (اختیاری):         [____]                          │
│ نرخ تسعیر روز صدور (در صورت ارزی):  [6,200,000] ریال/دلار            │
│                                                                     │
│ ✅ تأیید و صدور     ❌ انصراف     ♻️ بازنشانی از پیشنهاد         │
└─────────────────────────────────────────────────────────────────────┘
```

نکات:
- هر ردیف قابل ویرایش (تعداد، قیمت واحد، حذف).
- «[+] افزودن قلم سفارشی» فقط اگر قلم جدید لازم است.
- پیش‌نمایش جمع کل در لحظه به‌روز می‌شود.
- «منبع» ستون برای حالت تجمیعی (نمایش شماره پیشنهاد منبع هر قلم).
- **پیش‌فرض از پیشنهاد مالی (CO):** اگر پیشنهاد انتخاب‌شده CO نیست، هشدار نمایش داده می‌شود «قیمت‌ها از پیشنهاد غیرمالی لود شده‌اند — توصیه می‌شود از CO استفاده شود».

**مسیر کد:** افزودن `window.unofficialInvoicePrintWithLines(primaryOfferNo, linesSnapshot, consolidatedMeta)` در `unofficial-invoice.js`.

- اگر `linesSnapshot` خالی → مسیر فعلی حفظ می‌شود.
- در غیر این صورت، حلقهٔ محاسبهٔ `total` روی `linesSnapshot` اجرا می‌شود و فیلدهای `linesSnapshot`/`overridedFromOffer`/`consolidatedFromOffers` روی رکورد فاکتور ذخیره می‌شوند.

#### گام ۴ — یکپارچه‌سازی با دفتر غیررسمی (تست و اطمینان؛ ریسک: صفر، فقط‌خواندنی)
- **هیچ تغییر کدی لازم نیست** ولی محک زدن رفتار در سناریوهای زیر ضروری است:
  1. صدور تک‌پیشنهاد → `customer-finance.js#cfOpen` برچسب «فاکتور فروش (غیررسمی)» نمایش دهد.
  2. صدور تجمیعی → دفتر مشتری فقط یک فاکتور با اقلام تجمیع‌شده نشان دهد (نه چند فاکتور جدا).
  3. وصولی روی فاکتور غیررسمی (تکی/تجمیعی) → در دفتر با نوع «وصولی» نمایش داده شود.
  4. ابطال ریشه‌کن → تمام ۱۱ اثر مالی صفر شوند (تأیید با query مستقیم روی کلیدها).
  5. **مبلغ دفتری فاکتور غیررسمی = مبلغ قلم‌به‌قلم ویرایش‌شده** (نه CO)؛ تغییرات قیمت مستقیماً در مطالبات باز مشتری بنشیند.

#### گام ۵ — مستندسازی و راهنمای کاربر (ریسک: صفر)
- بند کوتاه به `financial-user-guide.html`: «صدور تکی/تجمیعی، ویرایش قیمت، ابطال ریشه‌کن فاکتور غیررسمی از پروندهٔ فروش».

---

## ۵. ریسک‌های ویژه نسخهٔ ۳

### ریسک ۱ — سرور در `PTF_SALES_DOMAIN_V2`
اگر معماری سرور-محور فعال باشد، ابطال ریشه‌کن نیاز به endpoint سروری اختصاصی `void_unofficial_invoice` دارد.
- **پیشنهاد:** قبل از شروع پیاده‌سازی، از سمت سرور تأیید شود که endpoint تعریف شده یا تعریف خواهد شد.
- در صورت نبود، **می‌توان با هماهنگی محلی شروع کرد** (رکورد در `caseId`/`allocations` محلی پاک می‌شود) و سرور بعداً همگام می‌شود. این کاملاً مطابق الگوی فعلی `cleanUpDoubleInvoices` است.

### ریسک ۲ — جزئیات چک‌ها
کلید دقیق `ptf_crm_cheques` باید تأیید شود؛ به نظر می‌رسد این کلید در `cheque-module.js` استفاده می‌شود ولی در `backup.js:55` فقط کلیدهای `cheques_issued`/`cheques_received` فهرست شده‌اند. **نیاز به بررسی دقیق‌تر سمت کلاینت دارد.**

### ریسک ۳ — هماهنگی `cleanUpDoubleInvoices` با حالت تجمیعی
تابع `cleanUpDoubleInvoices` فعلی بر اساس `inv.offerNo === o.no` کار می‌کند. در حالت تجمیعی `offerNo` متفاوت خواهد بود. **نیاز به اصلاح دارد:** اگر فاکتور رسمی برای **هر یک** از پیشنهادهای `consolidatedFromOffers` صادر شد، فاکتور تجمیعی غیررسمی void شود. یا ساده‌تر: کلید مقایسه به `consolidatedFromOffers` تغییر کند.

### ریسک ۴ — UI برای کاربران متعدد
اگر چند کاربر همزمان روی همان فاکتور کار کنند، cascade ابطال باید atomic باشد. **پیشنهاد:** در حالت سرور-محور، فراخوان server-side و منتظر ماندن برای تأیید قبل از تغییرات محلی. در حالت محلی، `setData` یکجا صدا زده شود (الگوی فعلی).

---

## ۶. فایل‌های تحت‌تاثیر (نسخهٔ ۳)

| فایل | تغییر | ریسک |
|---|---|---|
| `crm/unofficial-invoice.js` | افزودن `ptfUnofficialInvoiceVoid` و helper های cascade + `unofficialInvoicePrintWithLines` + پشتیبانی از `linesSnapshot`/`consolidatedFromOffers` | متوسط (cascade ابطال حساس است) |
| `crm/salesfiles.js` | تفکیک مسیر ابطال رسمی/غیررسمی + دکمهٔ صدور در کشوی پرونده + `sfUnofficialInvoiceNew` با حالت تجمیعی + `cleanUpDoubleInvoices` اصلاح‌شده برای `consolidatedFromOffers` | متوسط |
| `crm/cheque-module.js` | helper `ptfChequeVoidForInvoice(invCd)` (یا پیشنهاد مشابه) | پایین |
| **بدون تغییر:** `customer-finance.js` (فقط‌خواندنی در گام ۴) | — | — |
| **بدون تغییر:** `official-invoice-v2.js` (رفتار فعلی برای رسمی‌ها) | — | — |
| **بدون تغییر:** `rbac.js` (تابع قدیمی فقط legacy) | — | — |
| **نیاز احتمالی به بررسی سمت سرور:** endpoint `void_unofficial_invoice` و `register_consolidated_unofficial_invoice` | — | — |

---

## ۷. معماری دست‌نخورده می‌ماند

- **Sales Domain v2:** حفظ می‌شود.
- **صورتحساب رسمی:** فقط در ماژول حسابداری/مودیان.
- **الگوریتم محاسبهٔ سود/سهامداران/کارمیسیون:** هیچ تغییری نمی‌کند.
- **مبنای مطالبات (تأکید کارفرما):** فاکتور(های) صادره؛ هیچ جایگزین اضافه نمی‌شود.
- **الزام ۴ (ابطال ریشه‌کن):** تمام ۱۱ ردیف جدول ۰.۱ پوشش داده می‌شود.

---

## ۸. پیشنهاد ترتیب اجرا (پس از تأیید نهایی شما)

1. **گام ۱** (ابطال ریشه‌کن) — اول، چون فوری‌ترین نیاز است. ✅ **اجرا شد (۱۴۰۵/۰۵/۲۶)**
2. **گام ۴** (تست ادغام) — تأیید اینکه cascade کامل است.
3. **گام ۲** (دکمهٔ صدور + تجمیع) — افزایش پوشش.
4. **گام ۳** (دیالوگ ویرایش قیمت) — انعطاف بیشتر.
5. **گام ۵** (مستندسازی).

**تصمیم باقی‌مانده برای شروع:** هیچ — همه چهار الزام در این سند نهایی شده‌اند. در صورت تأیید، با گام ۱ شروع می‌کنم.

---

## ۹. وضعیت اجرا — گام ۱ (تأیید و تحویل شده — ۱۴۰۵/۰۵/۲۶)

### تغییرات اعمال‌شده

**الف) `crm/unofficial-invoice.js`:**
- افزودن تابع `window.ptfUnofficialInvoiceVoid(invCd)` (حدود ۲۰۰ خط) قبل از `// اجرای پاک‌سازی خودکار در لود اسکریپت`.
- **ساختار cascade:**
  ```js
  cascadeLog = {
    preservedPayments: [],   // وصولی‌های محفوظ (الزام ۵)
    chequeAudited: [],        // چک‌های متصل — فقط audit
    reversedAllocations: [],  // تخصیص‌های FIFO آزادشده
    freedCreditAmount: 0,    // مجموع بستانکاری آزادشده
    voidedReturns: [],        // مرجوعی‌های ابطال‌شده
    removedFiles: []
  }
  ```
- **guard ها:** senior/accountant → void نبودن → ف سال مالی → دلیل اجباری → تأیید نهایی با پیام هشدار.
- **به‌روزرسانی خودکار `creditRemainIRR`** روی receiptهای آزادشده (الزام ۴: ردپای مالی آزادشده به‌جای حذف، تبدیل به بستانکاری می‌شود).
- **audit + timeline + ptfToast** برای شفافیت.

**ب) `crm/salesfiles.js` (سطر ۹۶۷):**
- تفکیک مسیر ابطال رسمی/غیررسمی:
  - قبلاً: همه ابطال‌ها `ptfInvoiceVoid` (سرور-محور رسمی) ← برای غیررسمی fail می‌شد.
  - حالا: غیررسمی‌ها → `ptfUnofficialInvoiceVoid` (ریشه‌کن جدید)، رسمی‌ها → همان `ptfInvoiceVoid` (بدون تغییر).

### قابلیت تأییدکنندهٔ این تغییرات

1. در پروندهٔ فروش کاربر، روی یک فاکتور غیررسمی قبلی کلیک 🗑 → دکمهٔ جدید «ابطال ریشه‌کن» (قبلاً «ابطال») نمایش داده می‌شود.
2. با کلیک، prompt دلیل → confirm با پیام هشدار (وصولی‌ها و چک‌ها محفوظ می‌مانند) → cascade اجرا → toast نتیجه.
3. در `ptf_crm_invoices[i].voidCascadeLog` ساختار کامل cascade ذخیره می‌شود.
4. در `r.timeline[]` پرونده، رویداد با توضیح «ابطال ریشه‌کن» + آمار کامل ثبت می‌شود.
5. در `ptf_crm_case_receipts[]` برای receiptهای آزادشده، `creditRemainIRR` به‌روزرسانی می‌شود (بستانکاری مشتری).

### محدودیت‌های فعلی (بدون تغییر)

- هماهنگی سروری فقط محلی است. اگر `PTF_SALES_DOMAIN_V2` فعال باشد، فراخوان سرور `void_unofficial_invoice` (نقطه‌پایانی TODO در انتهای تابع) هنوز فراخوانی نمی‌شود. این پس از تأمین endpoint سروری، با یک به‌روزرسانی یک‌خطی فعال می‌شود.
- دکمهٔ صدور در پرونده (گام ۲) و دیالوگ ویرایش قیمت (گام ۳) هنوز اضافه نشده‌اند. اینها گام بعدی پس از تأیید گام ۱ هستند.

---

**پیوست:** فایل‌های فقط‌خوانده‌شده:
- `crm/unofficial-invoice.js` (۱۱۷۷ خط)
- `crm/salesfiles.js` (۱۹۹۸ خط)
- `crm/rbac.js` (خطوط ۴۶–۵۴، ۶۷۳–۷۲۰، ۹۳۹–۹۵۰، ۱۱۱۰–۱۱۳۸)
- `crm/cheque-module.js` (مرتبط با ابطال چک؛ خطوط ۱۳۱، ۳۳۲–۳۴۵، ۴۷۲، ۴۸۴، ۵۶۷)
- `crm/sales-domain-v2.js` (خطوط ۱۱۲، ۱۵۹–۱۶۳، ۲۰۶، ۲۱۰)
- `crm/official-ledger.js` (۱۴۸ خط)
- `crm/official-invoice-v2.js` (۵۶ خط)
- `crm/customer-finance.js` (۷۳۶ خط، خطوط ۵۲، ۷۹، ۳۳۶، ۳۶۵، ۵۶۰ برای ابطال)
- `crm/index.html` (ترتیب بارگذاری اسکریپت‌ها)
- `crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md`
- `crm/ANALYSIS-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE1.md`


---

## 10. وضعیت اجرا — گام 2 (الزام‌های 1 و 3 تأیید و تحویل شده — 1405/05/26)

### تغییرات اعمال‌شده

**الف) `crm/unofficial-invoice.js` (+697 خط):**

15 تابع جدید اضافه شد (بلاک قبل از `ptfUnofficialInvoiceVoid`):

- **Helperها:**
  - `unofficialInvoiceCollectOffers(deal)` → `{offers, priceSourceOffer, hasFinancialOffer}` با اولویت CO برای مبدأ قیمت
  - `unofficialInvoiceSnapshotLines(offer)` → آرایه اقلام deep-clone با `qtyOrig`/`priceOrig`/`qty`/`price`/`_pid`/`fromOffer`/`fromKind`
  - `unofficialInvoiceConsolidateLines(selected, srcOffer)` → ترکیب بدون تکرار (بر اساس `pcode || name || desc`) برای چند پیشنهاد
- **رندر:**
  - `buildUnInvBuilderRows(lines)` → HTML ردیف‌های جدول (input با `data-fld` و `data-pid`)
  - `buildUnInvBuilderHtml(st)` → کل HTML دیالوگ شامل:
    - mode toggle (تک / تجمیعی)
    - offers selector (radio در تک، checkbox در تجمیعی)
    - جدول اقلام قابل ویرایش (تعداد، قیمت واحد، دکمه حذف هر ردیف)
    - دکمه‌های `+ افزودن قلم سفارشی` و `♻️ بازنشانی از پیشنهاد`
    - فیلدهای تخفیف (مبلغ یا درصد)، شماره حساب، نرخ تسعیر
    - باکس نتیجه زنده (جمع + تخفیف + خالص + تبدیل ریالی برای ارزی)
- **کنترل:**
  - `bindUnInvBuilderHandlers` / `applyUnInvBuilderMode` / `reloadUnInvBuilderFromSelection` → رویدادهای reactive mode/offer/checkbox
  - `unofficialInvoiceBuilderRecalc` → محاسبه زنده با debounce ذاتی (از input رویداد)
  - `unofficialInvoiceBuilderRemoveRow` / `AddCustomRow` / `ResetFromOffer` / `Submit` → اکشن‌های ردیف
  - `unofficialInvoiceBuilderOpen(dealCd)` → باز کردن دیالوگ با guard نقش و مرحله (≥7)
- **پرینتر سفارشی:**
  - `unofficialInvoicePrintCases(ctx)` → dispatcher نهایی که:
    - `syntheticOffer.items = ctx.linesSnapshot` (بدون تغییر تابع رسمی)
    - محاسبه totals از snapshot، حفظ الگوریتم تخفیف/پیش‌پرداخت/تسعیر
    - ذخیره رکورد فاکتور با فیلدهای جدید: `invoiceKind` ('single'|'consolidated'), `sourceOfferNo`, `consolidatedFromOffers`, `overridedFromOffer: true`, `linesSnapshot`
    - شناسه صورتحساب تجمیعی: `UN-INV-CONSOLIDATED-<dealCd>-<YYYYMMDDHHmm>`
    - ثبت در timeline پرونده با توضیح ` (تجمیعی از N پیشنهاد)` در حالت تجمیعی

**ب) `crm/salesfiles.js` (+23 خط):**

- افزودن `window.sfUnofficialInvoiceNew(dealCd)` بعد از `function sfHasInvoice(r)` — guard نقش + dispatcher به `unofficialInvoiceBuilderOpen`.
- افزودن `postAction('unofficial-invoice', '🧾', 'صورتحساب غیررسمی', ... 'sfUnofficialInvoiceNew(...)', { meta: 'پرونده' })` در کشوی پرونده (`sfDrawerHtml`) قبل از اکشن‌های 'loss' و 'close' (همیشه فعال، نه فقط برای پرونده‌هایی که `wonOffer` دارند).

### قابلیت تأییدکننده

1. در پرونده فروش (مرحله ≥7)، دکمه 🧾 صورتحساب غیررسمی نمایش داده می‌شود.
2. کلیک → دیالوگ با دو حالت (تک‌پیشنهاد / تجمیعی چند پیشنهاد) باز می‌شود.
3. در حالت تک: یک پیشنهاد انتخاب، اقلام از آن لود می‌شوند.
4. در حالت تجمیعی: چک‌باکس‌ها برای انتخاب چند پیشنهاد، اقلام ترکیبی لود می‌شوند.
5. **ویرایش قیمت**: هر سلول تعداد/قیمت قابل ویرایش است؛ جمع کل و تخفیف به‌صورت زنده به‌روز می‌شوند.
6. **+ افزودن قلم سفارشی**: ردیف جدید با مقادیر پیش‌فرض.
7. **♻️ بازنشانی**: اقلام به حالت اولیه از پیشنهاد برمی‌گردند.
8. **تأیید**: رکورد فاکتور در `ptf_crm_invoices` با فیلدهای `invoiceKind`/`sourceOfferNo`/`consolidatedFromOffers`/`linesSnapshot` ذخیره می‌شود، در timeline پرونده ثبت می‌شود، و فایل PDF HTML پیش‌نمایش داده می‌شود.

### تست‌های انجام‌شده

- ✅ اعتبارسنجی نحوی JS هر دو فایل (Node syntax check)
- ✅ Smoke test منطق: `unofficialInvoiceSnapshotLines` (2 آیتم، جمع درست) و `unofficialInvoiceConsolidateLines` (A,B,C با حذف تکراری) تأیید شد
- ✅ هماهنگی با توابع Step 1 (ptfUnofficialInvoiceVoid همچنان فعال)

### محدودیت‌های فعلی

- **بدون سرور:** همه چیز در لایه client (مشابه رسمی). TODO در انتهای `unofficialInvoicePrintCases` برای endpoint سروری `register_unofficial_invoice` با consolidated context (مرتبط با گام 4).
- **مرحله ≥7:** هم ارسال فاکتور رسمی و هم فاکتور غیررسمی نیاز به مرحلهٔ پس از تحویل کارفرما دارند.
- **محاسبه ریالی**: برای اسناد ارزی، جمع نهایی محاسبه‌شده با نرخ روز صدور — تطابق با رفتار قبلی.
