/* =====================================================================
   PTF CRM — official-ledger.js — v1.0 (Phase 2 / Step 1)
   ماژول مشترک طبقه‌بندی رسمی/غیررسمی — گام ۱ طرح جداسازی حساب‌های
   رسمی/غیررسمی (ر.ک: crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md)

   اصول این فایل (فاز ۲ / گام ۱):
   - فقط توابع خالص (pure) — هیچ localStorage نمی‌خواند/نمی‌نویسد،
     هیچ DOM را تغییر نمی‌دهد، هیچ رویدادی صادر نمی‌کند.
   - جایگزین شرط‌های پراکنده‌ی isOfficial/isUnofficial در فایل‌های دیگر
     می‌شود؛ اما در این گام هنوز هیچ فایل دیگری این توابع را صدا نمی‌زند
     — یعنی افزودن این فایل به‌تنهایی هیچ اثر قابل‌مشاهده‌ای در UI ندارد.
   - منبع طبقه‌بندی و قرارداد فیلدها دقیقاً طبق تحلیل فاز ۱:
       • فاکتور فروش (ptf_crm_invoices): isUnofficial === true → 'unofficial'
         در غیر این صورت → 'official' (نبود فیلد = رسمی؛ سازگار با گذشته)
       • هزینه جاری (ptf_crm_opex) و فاکتور خرید تامین‌کننده
         (ptf_crm_supplier_finance.invoices): isOfficial === true → 'official'
         isOfficial === false → 'unofficial'
         در غیر این صورت (فیلد اصلاً ست نشده) → 'unclassified'
         (این حالت سوم عمداً حدس زده نمی‌شود — طبق تصمیم فاز ۱).
       • فاکتور خرید پوششی/صوری (isCover === true): طبقه‌بندی 'official-cover'
         (سند رسمی برای ممیزی محسوب می‌شود، اما خرید واقعی کالا نیست).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- طبقه‌بندی فاکتور فروش ---------- */
  window.ptfLedgerOfInvoice = function (inv) {
    if (!inv) return 'official';
    return inv.isUnofficial === true ? 'unofficial' : 'official';
  };

  /* ---------- طبقه‌بندی هزینه جاری (OPEX) ---------- */
  window.ptfLedgerOfOpex = function (o) {
    if (!o) return 'unclassified';
    if (o.isOfficial === true) return 'official';
    if (o.isOfficial === false) return 'unofficial';
    return 'unclassified';
  };

  /* ---------- طبقه‌بندی فاکتور خرید تامین‌کننده ---------- */
  window.ptfLedgerOfSupplierInvoice = function (inv) {
    if (!inv) return 'unclassified';
    /* فاکتور پوششی/صوری همیشه در دفتر رسمی به‌عنوان خرید رسمی دیده می‌شود
       (طبق توضیح فرآیند واقعی کارفرما — فاز ۲ / گام ۵) */
    if (inv.isCover === true) return 'official-cover';
    if (inv.isOfficial === true) return 'official';
    if (inv.isOfficial === false) return 'unofficial';
    return 'unclassified';
  };

  /* ---------- خرید واقعی برای «دفتر واقعی» (فاز ۲ / گام ۵) ----------
     فاکتور پوششی/صوری خرید واقعی کالا نیست؛ مبلغ اسمی آن نباید در
     هزینه‌ی دفتر واقعی وارد شود. سود/زیان خالص آن جدا محاسبه می‌شود
     (ر.ک: ptfLedgerCoverNetBenefit). برای فاکتورهای رسمی/غیررسمی معمولی
     (خرید واقعی)، مبلغ ریالی بدون تغییر برگردانده می‌شود. */
  window.ptfLedgerRealPurchaseAmount = function (inv) {
    if (!inv) return 0;
    if (inv.isCover === true) return 0;
    return +inv.amountIrr || +inv.amount || 0;
  };

  /* ---------- سود/زیان خالص یک فاکتور پوششی/صوری (فاز ۲ / گام ۵) ----------
     = اعتبار ارزش‌افزوده‌ی فاکتور − کارمزد نقدی فاکتورساز.
     هر دو نرخ به‌صورت دستی روی خود رکورد ذخیره می‌شوند (coverVatPct،
     coverCommissionPct)؛ این تابع فقط محاسبه‌ی خالص را انجام می‌دهد و
     هیچ نرخ پیش‌فرضی را خودش انتخاب نمی‌کند. */
  window.ptfLedgerCoverNetBenefit = function (inv) {
    if (!inv || inv.isCover !== true) return 0;
    var base = +inv.amountIrr || +inv.amount || 0;
    if (inv.coverVatAmount != null || inv.coverCommissionAmount != null) {
      return (+inv.coverVatAmount || 0) - (+inv.coverCommissionAmount || 0);
    }
    var vatPct = +inv.coverVatPct || 0;
    var commissionPct = +inv.coverCommissionPct || 0;
    return Math.round(base * vatPct / 100) - Math.round(base * commissionPct / 100);
  };

  /* ---------- تجمیع عمومی سه‌سطلی (official / unofficial / unclassified) ----------
     list: آرایه‌ی رکوردها
     classifierFn: تابعی که برای هر رکورد یکی از خروجی‌های بالا را برمی‌گرداند
     amountFn: تابعی که مبلغ ریالی هر رکورد را برمی‌گرداند (پیش‌فرض: amountIrr||amount)
     نکته‌ی مهم برای صحت: officialTotal (شامل official-cover) + unofficialTotal +
     unclassifiedTotal همیشه دقیقاً برابر جمع ساده‌ی amountFn روی کل آرایه است —
     یعنی هیچ گزارش موجودی که «جمع کل بدون فیلتر» را نشان می‌دهد با معرفی این
     تابع مغایرتی پیدا نمی‌کند. */
  window.ptfLedgerSplit = function (list, classifierFn, amountFn) {
    var out = {
      official: 0, unofficial: 0, unclassified: 0,
      officialCount: 0, unofficialCount: 0, unclassifiedCount: 0,
      total: 0, totalCount: 0
    };
    if (!Array.isArray(list) || typeof classifierFn !== 'function') return out;
    var getAmt = typeof amountFn === 'function' ? amountFn : function (x) { return (+x.amountIrr || +x.amount || 0); };
    list.forEach(function (rec) {
      var amt = +getAmt(rec) || 0;
      var cls = classifierFn(rec);
      out.total += amt;
      out.totalCount++;
      /* official-cover (فاکتور پوششی) در تجمیع «رسمی» شمرده می‌شود — طبق
         تعریف فاز ۲: در دفتر رسمی، فاکتور پوششی دقیقاً مثل خرید رسمی است. */
      if (cls === 'official' || cls === 'official-cover') {
        out.official += amt;
        out.officialCount++;
      } else if (cls === 'unofficial') {
        out.unofficial += amt;
        out.unofficialCount++;
      } else {
        out.unclassified += amt;
        out.unclassifiedCount++;
      }
    });
    return out;
  };
})();
