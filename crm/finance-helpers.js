/* =====================================================================
   PTF CRM — Sprint 2026-08-04 / v33.23.0
   توابع مشترک مالی — Finance Helpers

   هدف: حذف تکرار الگوهای محاسباتی پرخطر در ماژول‌های مالی (P0 بحرانی).
   قبل از این فایل، الگوی `concat(payments, pays).reduce` در ۲۰+ جا تکرار شده بود
   که در هر فایل به‌طور کمی متفاوت نوشته شده و بعضاً باعث:
     • عدم تشخیص فیلد amount (در working-capital.js: +p.amountIrr || +p.amt || +p.amount)
     • بی‌توجهی به reversal/voided (در supplier-finance.js)
     • بی‌توجهی به فیلد active (در working-capital.js)
     • بی‌توجهی به فیلتر void (در بعضی فایل‌ها)

   همه helperها زیر window.PTF (و در حالت قدیمی مستقیماً window.*) قرار می‌گیرند.
   بارگذاری: در crm/index.html قبل از فایل‌های مالی (قبل از petty.js و supplier-finance.js).

   الگوی استفاده:
   // قبل:
   var paid = ((inv.payments || []).concat(inv.pays || []))
     .reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
   // بعد:
   var paid = PTF.invPaidSum(inv);
   ===================================================================== */
(function () {
  'use strict';

  /* ============ ثابت‌های سراسری ============ */
  // ارقام فارسی (۰-۹) و عربی (٠-٩) به صورت string برای استفاده در indexOf
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /* ============ تبدیل اعداد فارسی/عربی به لاتین ============ */
  /**
   * تبدیل ارقام فارسی (۰-۹) و عربی (٠-٩) به لاتین + حذف جداکننده + parseFloat
   * @param {string|number} v - مقدار ورودی
   * @returns {number} - عدد یا 0 اگر نامعتبر
   *
   * نکته: قبلاً ۱۷ فایل این الگو را داشتند ولی ۲ فایل (opex.js:34 و index.html:1204)
   * فقط فارسی را پشتیبانی می‌کردند. حالا همه از این helper استفاده می‌کنند.
   */
  function toFaEnNum(v) {
    if (v == null) return 0;
    var s = String(v);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var fi = FA_DIGITS.indexOf(c);
      if (fi > -1) { out += fi; continue; }
      var ai = AR_DIGITS.indexOf(c);
      if (ai > -1) { out += ai; continue; }
      out += c;
    }
    return +out.replace(/[^\d.-]/g, '') || 0;
  }

  /** سازگاری با کد قدیمی — window.toFaEnNum */
  function _toFaEnNumCompat(v) { return toFaEnNum(v); }

  /**
   * آیا این رکورد پرداخت void/reversal/ابطال‌شده است؟
   * الگوی تشخیص: status==='void'/'reversal' یا voided===true
   */
  function isPaymentVoided(p) {
    if (!p) return true;
    if (p.status === 'void' || p.status === 'reversal') return true;
    if (p.voided === true || p.voided === 1) return true;
    if (p.reversalCd) return true;
    return false;
  }

  /**
   * آیا این رکورد پرداخت فعال است؟
   */
  function isPaymentActive(p) {
    if (!p) return false;
    if (isPaymentVoided(p)) return false;
    if (p.status === 'void' || p.status === 'reversal') return false;
    return true;
  }

  /**
   * مبلغ یک رکورد پرداخت به ریال — همه نام‌های ممکن را پوشش می‌دهد
   * ترتیب اولویت: amountIrr > amt > amount
   * (amountIrr برای فاکتورهای ارزی استفاده می‌شود؛ amt برای ریالی)
   */
  function paymentAmtIrr(p) {
    if (!p) return 0;
    return +p.amountIrr || +p.amt || +p.amount || 0;
  }

  /**
   * جمع پرداخت‌های فعال یک فاکتور (هر دو ساختار payments و pays)
   *
   * @param {Object} inv - فاکتور
   * @param {Object} [opts] - گزینه‌ها
   * @param {boolean} [opts.activeOnly=true] - فقط پرداخت‌های فعال (پیش‌فرض)
   * @param {boolean} [opts.useAmountIrr=false] - مبلغ از amountIrr (فیش‌های ارزی) خوانده شود
   * @returns {number}
   */
  function invPaidSum(inv, opts) {
    if (!inv) return 0;
    opts = opts || {};
    var activeOnly = opts.activeOnly !== false;
    var useAmountIrr = !!opts.useAmountIrr;
    var rows = (inv.payments || []).concat(inv.pays || []);
    if (activeOnly) rows = rows.filter(isPaymentActive);
    return rows.reduce(function (s, p) {
      return s + (useAmountIrr ? paymentAmtIrr(p) : (+p.amt || 0));
    }, 0);
  }

  /**
   * مانده فاکتور (می‌تواند منفی باشد اگر overpay شده)
   * الگوی قدیمی Math.max(0, ...) پرداخت‌های اضافی را پنهان می‌کرد
   *
   * @param {Object} inv - فاکتور
   * @param {Object} [opts] - همان opts های invPaidSum
   * @returns {number} - مانده (مثبت = بدهی باقی، منفی = overpay)
   */
  function invRemain(inv, opts) {
    if (!inv) return 0;
    var total = +inv.amount || 0;
    return total - invPaidSum(inv, opts);
  }

  /**
   * آیا فاکتور تسویه کامل شده؟
   * @param {Object} inv - فاکتور
   * @param {Object} [opts] - همان opts های invPaidSum
   * @returns {boolean}
   */
  function isInvPaid(inv, opts) {
    if (!inv) return false;
    return invRemain(inv, opts) <= 0.5;
  }

  /**
   * جمع هزینه‌های یک پرونده فروش/پروژه
   *
   * ریشه: P0-3 — قبلاً Math.max(deal, project) بود که هزینه‌های کوچک‌تر را نادیده می‌گرفت
   * الگوی صحیح: جمع هر دو منبع هزینه
   *
   * @param {Object} p - پرونده/پروژه (deal یا project)
   * @returns {number}
   */
  function dealTotalCosts(p) {
    if (!p) return 0;
    var fromEvents = (p.costEvents || []).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    var fromProject = (p.projectCosts || []).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    var fromPostArchive = (p.postArchiveCosts || []).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    if (p.origin === 'salesfile' || p.state === 'archived') {
      return fromEvents + fromProject + fromPostArchive;
    }
    return fromEvents + fromProject;
  }

  /**
   * تطبیق تأمین‌کننده بر اساس cd (نه نام)
   *
   * ریشه: P0-2 — legacyOpen از نام تطابق می‌داد که با تغییر نام، ارتباط قطع می‌شد
   * الگوی صحیح: اولویت با supplierCd (یکتا)؛ نام به‌عنوان fallback
   *
   * @param {Object} sup - تأمین‌کننده
   * @param {Object} p - رکورد legacy (ptf_crm_payables)
   * @returns {boolean}
   */
  function matchBySupplierCd(sup, p) {
    if (!sup || !p) return false;
    if (p.supplierCd && sup.cd) return p.supplierCd === sup.cd;
    var supName = (sup.co || sup.name || '').toString().trim().toLowerCase();
    var pName = (p.sup || '').toString().trim().toLowerCase();
    return !!(supName && pName && supName === pName);
  }

  /**
   * تبدیل رشته شامل ارقام فارسی/عربی به معادل لاتین
   * (برای cashIsoOf استفاده می‌شود — اجتناب از regex)
   */
  function _faArToLatin(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var fi = FA_DIGITS.indexOf(c);
      if (fi > -1) { out += fi; continue; }
      var ai = AR_DIGITS.indexOf(c);
      if (ai > -1) { out += ai; continue; }
      out += c;
    }
    return out;
  }

  /**
   * تشخیص تاریخ از فرمت‌های مختلف (فاکتور، پرداخت، چک، یادآور)
   * الگوی تکراری: t/date/timestamp/dateISO/p.t/dateFa
   *
   * @param {Object} o - رکورد
   * @param {string} [srcField='t'] - نام فیلد ترجیحی
   * @returns {string} - تاریخ به فرمت YYYY-MM-DD
   */
  function cashIsoOf(o, srcField) {
    if (!o) return '';
    var s = String(o[srcField || 't'] || o.date || o.t || o.paidAt || o.iso || '').trim();
    if (!s) return '';
    var m = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var sIso = _faArToLatin(s);
    var j = sIso.match(/(\d{4}[\s\/-]\d{1,2}[\s\/-]\d{1,2})/);
    if (j && typeof ptfJToISO === 'function') return ptfJToISO(j[1]) || '';
    return '';
  }

  /**
   * بررسی اینکه تاریخ در بازه [start, end] قرار دارد
   */
  function isInDateRange(iso, start, end) {
    if (!iso) return false;
    if (start && iso < start) return false;
    if (end && iso > end) return false;
    return true;
  }

  /* ============ expose ============ */
  window.PTF = window.PTF || {};
  window.PTF.toFaEnNum = toFaEnNum;
  window.PTF.isPaymentVoided = isPaymentVoided;
  window.PTF.isPaymentActive = isPaymentActive;
  window.PTF.paymentAmtIrr = paymentAmtIrr;
  window.PTF.invPaidSum = invPaidSum;
  window.PTF.invRemain = invRemain;
  window.PTF.isInvPaid = isInvPaid;
  window.PTF.dealTotalCosts = dealTotalCosts;
  window.PTF.matchBySupplierCd = matchBySupplierCd;
  window.PTF.cashIsoOf = cashIsoOf;
  window.PTF.isInDateRange = isInDateRange;

  // backward compatible: window.toFaEnNum
  window.toFaEnNum = toFaEnNum;
})();
