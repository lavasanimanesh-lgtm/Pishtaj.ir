# Finance Module Audit — Phase 4 / v34.0 (بازنویسی)

**تاریخ:** ۱۴۰۵/۰۵/۱۲ (۲۰۲۶-۰۸-۰۳)
**شاخه:** `arena/019fc8c9-pishtaj-ir` @ `e4b0509`
**آخرین نسخه:** v33.23.2 (فاز ۳ refactor)

---

## ۱. نقش ماژول‌ها (Architecture Map)

| ماژول | فایل | نقش اصلی | کلید داده |
|---|---|---|---|
| **finance-helpers** | `crm/finance-helpers.js` (237 خط) | توابع مشترک محاسباتی (PTF.*) — منبع حقیقت واحد | — (in-memory) |
| **datex** | `crm/datex.js` (181 خط) | تبدیل تاریخ شمسی↔میلادی + ویجت تقویم `ptfDatePicker` | — |
| **ui-kit** | `crm/ui-kit.js` (192 خط) | کامپوننت‌های تعامل (ptfDialog, ptfToast, ptfConfirm) | — |
| **petty** | `crm/petty.js` (1264 خط) | تنخواه گردان — هزینه/شارژ/تسویه/گزارش دوره | ptf_crm_petty, ptf_crm_petty_tx, ptf_crm_petty_periods |
| **cheque-module** | `crm/cheque-module.js` (364 خط) | ماژول چک (صادره/وارده) با اثر مالی | ptf_crm_cheques_issued, ptf_crm_cheques_received |
| **cheque-panel/cheque-print/cheques** | (3 فایل) | UIهای چک | — |
| **supplier-finance** | `crm/supplier-finance.js` (809 خط) | فاکتور خرید، پرداخت، چک شرکتی، اصلاحیه، تطبیق | ptf_crm_supplier_finance |
| **fiscal** | `crm/fiscal.js` (632 خط) | سال مالی، قفل، سند اصلاحی، تقسیم سود | ptf_crm_fiscal_snapshots |
| **working-capital** | `crm/working-capital.js` (305 خط) | گزارش تجمیعی (مطالبات/بدهی/اعتبار/چک/نقد) | (read-only) |
| **fx** | `crm/fx.js` (405 خط) | تسعیر ارز، صورتحساب‌های ارزی، محاسبه سود پروژه | — |
| **offers** | `crm/offers.js` (3067 خط) | پیشنهاد فنی/مالی/فنی‌مالی + پیش‌پرداخت | ptf_crm_offers |

### روابط بین ماژول‌ها

```
              ┌─────────────────┐
              │ finance-helpers │ ← همه چیز از اینجا
              │  (PTF.*)        │
              └─────────────────┘
                    ↑    ↑    ↑
        ┌───────────┘    │    └──────────┐
        │                │               │
   ┌────┴────┐   ┌──────┴────┐   ┌──────┴────┐
   │  petty  │   │  supplier │   │  fiscal   │
   │         │   │  -finance │   │  working  │
   │ (tx +   │   │  (inv+pay)│   │  -capital │
   │  rec)   │   │           │   │  cheque   │
   └─────────┘   └───────────┘   └───────────┘
        ↑                ↑             ↑
        └──── ptfDatePicker (datex) ────┘
```

---

## ۲. مشکلات شناسایی‌شده (از گزارش کارفرما)

### 🔴 P0 — بحرانی

#### 2.1. دکمه‌های ناوبری تقویم شمسی (◀ ▶) در `ptfDatePicker`

**فایل:** `crm/datex.js` خط 124-130 (در `ptfCalRender`)

**مشکل:** در رندر اولیه، دکمه‌های ناوبری ◀ ▶ با `onclick="ptfCalNav(...)"` ساخته می‌شوند ولی:
1. **دکمه‌ها flat هستند** (بدون border/background) — کاربر ممکنه متوجه نشه قابل کلیک هستن
2. **در موبایل**، click handler ممکنه به‌دلیل viewport دچار مشکل شود
3. **دستور `onclick` در حالت delegated listener** تکرار می‌شود (هر دو handler اجرا می‌شوند → تأخیر و احتمال خطا)

**ریشه:** در خط 132-143، یک event delegation اضافه شده که دوباره روی `data-cal-nav` کلیک می‌کند. یعنی **هر کلیک دو بار handle می‌شود** (inline onclick + delegated).

**راه‌حل پیشنهادی v34:**
- حذف `onclick` inline؛ فقط استفاده از data-attribute + delegation
- استایل دهی بهتر (border, hover, active)
- اطمینان از focus در enter key

#### 2.2. تنخواه — بازه دلخواه، فلش‌های «بعدی/قبلی» کار نمی‌کند

**فایل:** `crm/petty.js` خط 485-510 (`ptfPettyPeriodReportDialog`)

**مشکل:** دیالوگ «گزارش دورهٔ تنخواه — انتخاب بازه» فقط **دو فیلد تاریخ** دارد (از/تا) ولی:
- **هیچ دکمه «بعدی/قبلی» برای جابجایی سریع بازه** (مثلاً «بازه بعدی» → +۱۰ روز) وجود ندارد
- **هیچ quick-pick** (مثلاً «۷ روز اخیر»، «این ماه»، «ماه قبل») نیست
- **پیشنهاد خودکار** فقط `ptfPettySuggestedRange` یک‌بار فراخوانی می‌شود (در لحظه باز شدن)

**انتظار کاربر (از گزارش):** فلش‌هایی برای حرکت سریع بین بازه‌ها (مثلاً «بازه ۱۰ روزه بعدی/قبلی»)

**راه‌حل v34:**
- افزودن quick-pick buttons: «۷ روز اخیر»، «این ماه»، «ماه قبل»، «۳۰ روز اخیر»
- افزودن «بازه قبلی/بعدی» که بازه فعلی را ±n روز جابجا می‌کند (با حفظ طول بازه)
- نمایش بازه فعال به‌صورت badge

### 🟡 P1 — ناهماهنگی

#### 2.3. تقویم‌ها در ماژول‌های مختلف یکدست نیستند

**فایل‌ها:**
- `crm/datex.js:83` — `ptfDatePicker` (اصلی)
- `crm/ui-kit.js:66` — فراخوانی `ptfDatePicker` (از طریق ptfDialog)
- `crm/cheque-panel.js:174, 510` — استفاده مستقیم
- `crm/cheque-print.js:148` — استفاده مستقیم
- `crm/buycompare.js:481` — استفاده مستقیم
- `crm/cheques.js:816` — استفاده مستقیم

**ناهماهنگی:** در برخی جاها placeholder تاریخ پیش‌فرض متفاوت است:
- cheque-panel: `'1405/05/11'`
- cheque-print: `'1405/05/11'`
- buycompare: بدون placeholder
- ui-kit (dialog): `f.placeholder || '1405/04/01'`

**راه‌حل v34:**
- یکسان‌سازی placeholder پیش‌فرض = `ptfTodayJ()` یا الگوی `YYYY/MM/01`
- امکان override فقط در صورت نیاز

#### 2.4. فرمت تاریخ در دیالوگ‌ها متفاوت

برخی جاها `value: sg.from` (مقدار شمسی از پیشنهاد) می‌گیرند ولی ptfDialog input را به‌عنوان text ساده نشان می‌دهد — یعنی اگر کاربر تایپ کند `1405-04-15` (با خط تیره) به جای `/`، validation قبول نمی‌کند.

**راه‌حل:** در `ptfDateInput` (و `ptfDatePicker`)، اگر نوع فیلد `date` باشد، event listener برای blur اضافه شود که تاریخ را normalize کند.

### 🟢 P2 — بهبود

#### 2.5. منطق پیشنهاد بازه هوشمند نیست

`ptfPettySuggestedRange` فقط «روز پس از آخرین دوره» را پیشنهاد می‌دهد. اگر کاربر بخواهد بازه سفارشی داشته باشد، باید هر بار تایپ کند.

**راه‌حل:** افزودن preset library (۷/۱۰/۱۵/۳۰ روز، ماه جاری، فصل جاری، سال جاری).

---

## ۳. بازنویسی پیشنهادی v34

### 3.1. ماژول جدید: `crm/finance-core.js`

```js
// هدف: لایهٔ واحد محاسبات مالی — همهٔ ماژول‌ها فقط UI/ذخیره
window.FinanceCore = {
  // محاسبات پایه
  invPaid(inv, opts),      // ← انتقال از PTF.invPaidSum
  invRemain(inv, opts),
  isInvPaid(inv, opts),
  paymentAmtIrr(p, opts),
  isPaymentActive(p),
  
  // محاسبات تأمین‌کننده
  supplierBalance(supCd, opts),
  supplierInvoicePaid(inv, pays),
  supplierInvoiceRemain(inv, pays),
  
  // محاسبات دوره‌ای
  pettyRange(from, to),
  pettyPeriodData(from, to, opts),
  pettyRangeNav(range, delta, unit),  // بازه قبلی/بعدی
  
  // منطق دامنه
  canSettlePetty(rec, user),
  isAdvancePaid(advance),
  ...
};
```

**مزایا:**
- یک‌جا تست‌پذیر (همه helperها در یک‌جا)
- تغییر منطق در یک‌جا → کمتر regression
- type-safe documentation در یک فایل
- حذف `PTF` namespace (نام‌گذاری بهتر با `FinanceCore`)

### 3.2. ماژول جدید: `crm/date-kit.js`

ادغام `datex.js` + `ui-kit.js` (datePicker) + تمام استفاده‌های مستقیم از تقویم در ماژول‌ها.

```js
window.DateKit = {
  ptfDatePicker(id, iso, ph, opts),  // opts: {size, onChange, today}
  ptfCalNav(inputId, delta),          // ← جدید
  ptfCalShow(inputId),
  ptfTodayJ(), ptfISOToJ(iso), ptfJToISO(j),
  faDigits(s),
  normalizeDate(s, format),  // ← جدید — تبدیل `1405-04-15` به `1405/04/15`
  rangeNav(from, to, delta, unit),  // ← جدید — جابجایی بازه
  quickRanges,  // ← جدید — ۷/۱۰/۳۰ روز، ماه، فصل، سال
};
```

### 3.3. جدول زمان‌بندی (تخمین)

| فاز | توضیح | تخمین |
|---|---|---|
| ۴.۱ | ساخت `finance-core.js` + انتقال توابع از `finance-helpers.js` | ۲ روز |
| ۴.۲ | ساخت `date-kit.js` + رفع باگ ناوبری تقویم | ۱.۵ روز |
| ۴.۳ | افزودن quick-pick + range nav به تنخواه | ۱ روز |
| ۴.۴ | یکدست‌سازی استفاده از datePicker در همه ماژول‌ها | ۱ روز |
| ۴.۵ | تست‌های واحد جدید + UAT | ۲ روز |
| ۴.۶ | نسخه v34.0 + commit + push | ۰.۵ روز |

**جمع: ۸ روز کاری**

---

## ۴. فوری‌ترین fix (می‌توان در فاز ۴.۰ جدا کرد)

اگر می‌خواهید **همین الان** فقط مشکل بازه تنخواه و فلش‌ها fix شود (بدون بازنویسی کامل)، می‌توانم:

1. فقط `crm/datex.js` را fix کنم (data-cal-nav duplicate)
2. فقط `crm/petty.js` را extend کنم (افزودن quick-pick + range nav)
3. یک commit v33.23.3 بزنم

این کم‌ریسک‌ترین مسیر است و می‌تواند در ۱-۲ ساعت تمام شود.

---

**منتظر تأیید شما برای شروع فاز ۴ هستم.**
