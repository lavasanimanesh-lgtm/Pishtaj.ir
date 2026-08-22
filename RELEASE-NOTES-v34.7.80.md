# RELEASE NOTES — v34.7.80 (۱۴۰۵/۰۵/۳۱ — 2026-08-22)

## جداسازی اظهارنامه‌ها از فاکتورها + پنل مستقل «📁 اظهارنامه‌ها»

### مشکل

۱. بخش «فاکتورها» در قسمت مالی گاهی بهم می‌ریخت.
۲. «➕ بارگذاری اظهارنامه جدید» هم داخل بخش فاکتورها نمایش داده می‌شد.

### ریشهٔ علت

پنل «فاکتورها» دو تعریف رقیب داشت: نسخهٔ قدیمی در `crm/rbac.js` (که کادر بایگانی
اظهارنامه‌ها را هم به فاکتورها می‌چسباند) و رجیستری رسمی v35 در `crm/official-invoice-v2.js`.
هر دو به `div#invWrap` می‌نوشتند و منطق اظهارنامه در `crm/unofficial-invoice.js` فقط به
نسخهٔ قدیمی سیم‌کشی شده بود — یعنی اظهارنامه «مهمانِ» فاکتورها بود و خانهٔ مستقل نداشت.
(مستند کامل: `ASSESSMENT-INVOICES-TAXRETURNS-SEPARATION-2026-08-22.md`)

### تغییرات

#### ۱. حذف اظهارنامه از مسیر فاکتورها

- `crm/rbac.js` → حذف `taxHtml` از `buildInvoices` و حذف فراخوانی `ptfTaxReturnsRender` از `renderInvoices`.
- `crm/unofficial-invoice.js` → حذف بلوک بایگانی اظهارنامه (توابع `ptfTaxReturns*`).
- `ptfTaxPlannerHtml` (داشبورد برنامه‌ریزی فصلی مالیات — ویژهٔ مدیران) دست‌نخورده حفظ شد.

#### ۲. پنل مستقل «📁 اظهارنامه‌ها» در گروه «📦 کالا و اسناد»

- ماژول جدید `crm/tax-returns.js`:
  - `buildTaxReturns` / `renderTaxReturns` / `ptfTaxReturnsTab` / `ptfTaxReturnsYear` /
    `ptfTaxReturnsAdd` / `ptfTaxReturnsDel`.
  - دو تب: **«💼 عملکرد سالانه»** و **«🧾 ارزش افزوده فصلی»**.
  - عملکرد سالانه → گروه‌بندی به تفکیک هر **سال مالی** (با دکمهٔ ثبت همان سال).
  - ارزش افزوده فصلی → **انتخاب سال** + چهار کارت فصل (بهار/تابستان/پاییز/زمستان)،
    هر فصل با اسناد خودش و دکمهٔ افزودن.
- دکمهٔ سایدبار `taxret` (📁 اظهارنامه‌ها) + ثبت در گروه `g-goods` (`crm/shell.js`) +
  ثبت در `ALL_PANELS` و `reg` (`crm/perms.js`).
- دسترسی: مدیران ارشد + حسابدار (افزوده‌شدن `taxret` به پنل‌های نقش حسابدار در `rbac.js`).

#### ۳. مدل داده (بدون مهاجرت فایل)

- همان کلید سینک‌شوندهٔ `ptf_crm_tax_returns` با فیلد جدید `kind` (`performance` | `vat`).
- سازگاری با رکوردهای قدیمی: `kind` از رشتهٔ قدیمی `type` استنتاج می‌شود
  (هر نوعِ دارای «عملکرد» → عملکرد؛ بقیهٔ فصلی‌ها → ارزش افزوده).
- حذف بر اساس `cd` (پایدار) به‌جای ایندکس.

### فایل‌ها

- `crm/tax-returns.js` — ماژول جدید پنل اظهارنامه‌ها.
- `crm/rbac.js` — حذف اظهارنامه از فاکتورها + دسترسی نقش حسابدار.
- `crm/unofficial-invoice.js` — حذف بلوک بایگانی اظهارنامه.
- `crm/index.html` — دکمهٔ سایدبار + بارگذاری `tax-returns.js`.
- `crm/shell.js` — افزودن `taxret` به گروه «کالا و اسناد».
- `crm/perms.js` — ثبت پنل در ALL_PANELS و reg.
- `ASSESSMENT-INVOICES-TAXRETURNS-SEPARATION-2026-08-22.md` — ارزیابی.
- `_tools/uat/tester482-v34.7.80-tax-returns-separation.js` — تستر جدید (ثبت در گیت CI).

### اعتبارسنجی

- `node _tools/arch/arch-guard.js` → `=== ARCH GUARD: PASS ===`
- `node _tools/uat/run-ci-gate.js` → `98 PASS / 0 FAIL`
