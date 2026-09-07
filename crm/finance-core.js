/* =====================================================================
   PTF CRM — v34.0.0-alpha — finance-core.js
   لایهٔ واحد محاسبات مالی (Strangler Fig Pattern)
   =====================================================================
   هدف: تمام منطق محاسباتی پرخطر مالی (پرداخت‌ها، مانده‌ها، تطبیق تأمین‌کننده،
   هزینه‌های پروژه، تاریخ و تقویم شمسی) در این فایل متمرکز شود. ماژول‌های
   دیگر (petty, supplier-finance, fiscal, working-capital, cheque, fx, offers)
   فقط UI/ذخیره‌سازی دارند و از FinanceCore.* استفاده می‌کنند.

   سازگاری با گذشته: PTF.* (از finance-helpers.js) همچنان فعال است تا
   کد قدیمی خراب نشود، ولی به‌تدریج refactor می‌شود.

   API: window.FinanceCore
     ─ محاسبات پایه پرداخت
       invPaid(inv, opts)         ← جمع پرداخت‌های فعال (useAmountIrr)
       invRemain(inv, opts)        ← مانده (می‌تواند منفی باشد)
       isInvPaid(inv, opts)        ← آیا تسویه شده؟
       paymentAmtIrr(p)            ← مبلغ یک رکورد (amountIrr > amt > amount)
       isPaymentActive(p)          ← آیا فعال است (نه void/reversal)
       isPaymentVoided(p)          ← آیا ابطال/برگشت شده؟
       isPaymentOverpaid(inv)      ← آیا overpay (پرداخت بیش از مانده) دارد؟
     ─ تطبیق تأمین‌کننده
       matchBySupplierCd(sup, p)   ← P0-2: اولویت cd، سپس نام
     ─ هزینه‌های پروژه
       dealTotalCosts(p)            ← P0-3: sum نه max
     ─ تاریخ و تقویم
       toFaEnNum(v)                ← تبدیل ارقام فارسی/عربی به لاتین
       normalizeDate(s)            ← تبدیل `1405-04-15` یا `1405/04/15` به استاندارد
       dateInRange(iso, start, end)
       dateBefore(iso, ref)        ← آیا iso < ref (شمسی یا میلادی)
   ===================================================================== */
(function () {
  'use strict';

  /* ===================== ثابت‌های سراسری ===================== */
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /* ===================== توابع کمکی (Private) ===================== */
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

  function _arr(v) { return Array.isArray(v) ? v : []; }

  /* ===================== API: محاسبات پایه پرداخت ===================== */
  function paymentAmtIrr(p) {
    if (!p) return 0;
    return +p.amountIrr || +p.amt || +p.amount || 0;
  }

  function isPaymentVoided(p) {
    if (!p) return true;
    if (p.status === 'void' || p.status === 'reversal') return true;
    if (p.voided === true || p.voided === 1) return true;
    if (p.reversalCd) return true;
    return false;
  }

  function isPaymentActive(p) {
    if (!p) return false;
    return !isPaymentVoided(p);
  }

  /**
   * جمع پرداخت‌های فعال یک فاکتور (هر دو ساختار payments و pays)
   * @param {Object} inv - فاکتور
   * @param {Object} [opts] - گزینه‌ها
   * @param {boolean} [opts.activeOnly=true] - فقط پرداخت‌های فعال
   * @param {boolean} [opts.useAmountIrr=false] - مبلغ از amountIrr (فاکتورهای ارزی)
   * @returns {number}
   */
  function invPaid(inv, opts) {
    if (!inv) return 0;
    opts = opts || {};
    var activeOnly = opts.activeOnly !== false;
    var useAmountIrr = !!opts.useAmountIrr;
    var rows = _arr(inv.payments).concat(_arr(inv.pays));
    if (activeOnly) rows = rows.filter(isPaymentActive);
    return rows.reduce(function (s, p) {
      return s + (useAmountIrr ? paymentAmtIrr(p) : (+p.amt || 0));
    }, 0);
  }

  /**
   * مانده فاکتور (می‌تواند منفی باشد اگر overpay شده)
   */
  function invRemain(inv, opts) {
    if (!inv) return 0;
    var total = +inv.amount || 0;
    return total - invPaid(inv, opts);
  }

  function isInvPaid(inv, opts) {
    if (!inv) return false;
    return invRemain(inv, opts) <= 0.5;
  }

  function isPaymentOverpaid(inv, opts) {
    if (!inv) return false;
    return invRemain(inv, opts) < -0.5;
  }

  /* ===================== API: تطبیق تأمین‌کننده ===================== */
  function matchBySupplierCd(sup, p) {
    if (!sup || !p) return false;
    if (p.supplierCd && sup.cd) return p.supplierCd === sup.cd;
    var supName = (sup.co || sup.name || '').toString().trim().toLowerCase();
    var pName = (p.sup || '').toString().trim().toLowerCase();
    return !!(supName && pName && supName === pName);
  }

  /* ===================== API: هزینه‌های پروژه ===================== */
  function dealTotalCosts(p) {
    if (!p) return 0;
    /* v34.29.8: ددوب بر اساس cd بین هر سه منبع — هم‌سنخ finance-helpers (ابلاغ
       «هیچ وجهی دو بار»). */
    /* v34.38.2 (COST-SUM): هم‌قاعده با منبع واحد نوار مالی/سود پرونده —
       هزینهٔ حذف‌شده (tombstone _costTomb) و advance/پیش‌پرداخت شمرده نمی‌شوند. */
    var tomb = (p && p._costTomb) || {};
    var seenCd = {};
    function isAdv(c) {
      return !!(c && (c.fromAdvance || c.cat === 'advance' || /پیش.?پرداخت|prepay|advance/.test(String(c.desc || c.cat || ''))));
    }
    function sum(list) {
      return _arr(list).reduce(function (s, c) {
        if (!c) return s;
        if (isAdv(c)) return s;
        if (c.cd && tomb[String(c.cd)]) return s; /* v34.38.2: حذف ماندگار */
        var k = String((c && (c.cd || c.pettyCd)) || (String(c.t || '') + '|' + String(c.desc || '') + '|' + (+c.amt || 0)));
        if (seenCd[k]) return s;
        seenCd[k] = 1;
        return s + (+c.amt || 0);
      }, 0);
    }
    var fromEvents = sum(p.costEvents);
    var fromProject = sum(p.projectCosts);
    var fromPostArchive = sum(p.postArchiveCosts);
    if (p.origin === 'salesfile' || p.state === 'archived') {
      return fromEvents + fromProject + fromPostArchive;
    }
    return fromEvents + fromProject;
  }

  /* ===================== API: تاریخ و تقویم ===================== */
  function toFaEnNum(v) {
    if (v == null) return 0;
    var s = String(v);
    var out = _faArToLatin(s);
    return +out.replace(/[^\d.-]/g, '') || 0;
  }

  /**
   * نرمال‌سازی تاریخ شمسی: پذیرش `1405/04/15`، `1405-04-15`، `۱۴۰۵/۰۴/۱۵` و تبدیل به استاندارد
   * فرمت خروجی: `1405/04/15` (شمسی با صفر پیش‌فرض)
   * @param {string} s - تاریخ ورودی
   * @returns {string} - تاریخ نرمال‌شده یا خود ورودی اگر نامعتبر
   */
  function normalizeDate(s) {
    var v = String(s == null ? '' : s).trim();
    if (!v) return '';
    v = _faArToLatin(v).replace(/\s/g, '').replace(/-/g, '/');
    var m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return v;
    var y = m[1], mo = String(+m[2]).padStart(2, '0'), d = String(+m[3]).padStart(2, '0');
    var jm = +mo, jd = +d;
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return v;
    return y + '/' + mo + '/' + d;
  }

  /**
   * بررسی بازهٔ تاریخ (شمسی یا میلادی — هردو YYYY/MM/DD یا YYYY-MM-DD)
   * @param {string} iso - تاریخ بررسی
   * @param {string} start - شروع بازه (اختیاری)
   * @param {string} end - پایان بازه (اختیاری)
   * @returns {boolean}
   */
  function dateInRange(iso, start, end) {
    if (!iso) return false;
    if (start && iso < start) return false;
    if (end && iso > end) return false;
    return true;
  }

  /**
   * آیا تاریخ قبل از تاریخ مرجع است؟ (شمسی یا میلادی — هردو فرمت YYYY/MM/DD قابل مقایسه‌اند)
   * @param {string} iso - تاریخ بررسی
   * @param {string} ref - تاریخ مرجع
   * @returns {boolean} - true اگر iso < ref
   */
  function dateBefore(iso, ref) {
    if (!iso || !ref) return false;
    var nIso = normalizeDate(iso) || iso;
    var nRef = normalizeDate(ref) || ref;
    return nIso < nRef;
  }

  /* ===================== expose ===================== */
  window.FinanceCore = {
    paymentAmtIrr: paymentAmtIrr,
    isPaymentVoided: isPaymentVoided,
    isPaymentActive: isPaymentActive,
    invPaid: invPaid,
    invRemain: invRemain,
    isInvPaid: isInvPaid,
    isPaymentOverpaid: isPaymentOverpaid,
    matchBySupplierCd: matchBySupplierCd,
    dealTotalCosts: dealTotalCosts,
    toFaEnNum: toFaEnNum,
    normalizeDate: normalizeDate,
    dateInRange: dateInRange,
    dateBefore: dateBefore
  };
})();
