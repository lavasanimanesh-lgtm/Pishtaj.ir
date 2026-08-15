/* =====================================================================
   PTF CRM — v34.7.17 — Metrics Shared Kernel (فاز ۰ اصلاح تصمیم‌یار/تحلیلگر)
   منبع واحد سنجه‌های فروش برای «تحلیلگر هوشمند» و «تصمیم‌یار مدیریت».

   چرا این فایل وجود دارد (مرجع: ARENA-DECISION-SUPPORT-ANALYZER-DEEP-REVIEW-2026-08-15.md):
     F-01 مخرج نرخ برد فقط «بسته‌شده‌ها» بود → ۱ برد از ۱۱ آفر = ۱۰۰٪
     F-02 همان عدد متورم به ضریب پیش‌بینی درآمد تزریق می‌شد
     F-03 هویت مشتری بین offers (کد) و rfqs (نام) چندپاره بود
     F-04 مبالغ ارزی بدون تبدیل با ریال جمع می‌شدند
     F-05 وصول/فاکتور خارج از منبع واحد مالی (PTF.invPaidSum) محاسبه می‌شد

   قواعد این لایه:
     • بدون وابستگی به DOM (قابل اجرا و تست در Node)
     • هیچ سنجه‌ای بدون meta برنمی‌گردد (n، پوشش، موارد کنارگذاشته‌شده)
     • هرچه نرخ ارز مرجع ندارد از جمع ریالی خارج و شمرده می‌شود (نه صفر، نه خام)
   ===================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  W.PTF = W.PTF || {};
  if (W.PTF.metrics) return;

  function n(v) { return +v || 0; }
  function listOf(k) { try { return (typeof W.getData === 'function' ? W.getData(k) : []) || []; } catch (e) { return []; } }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* ---------- F-03: هویت واحد مشتری ---------- */
  function normName(v) {
    return String(v == null ? '' : v)
      .replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '')
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .toLowerCase();
  }
  var _nameIdx = null, _nameIdxAt = 0;
  function nameIndex() {
    /* کش کوتاه‌مدت: در یک بار محاسبهٔ گزارش، لیست مشتریان چندین بار پیمایش نشود */
    var now = Date.now();
    if (_nameIdx && now - _nameIdxAt < 3000) return _nameIdx;
    var idx = {};
    listOf('ptf_crm_customers').forEach(function (c) {
      if (!c || !c.cd) return;
      [c.co, c.name, c.coEn].forEach(function (nm) { var k = normName(nm); if (k) idx[k] = c.cd; });
    });
    _nameIdx = idx; _nameIdxAt = now;
    return idx;
  }
  W.PTF = W.PTF || {};

  /**
   * کلید یکتای مشتری از هر رکوردی (پیشنهاد، درخواست، فاکتور).
   * ترتیب: کد صریح → نگاشت نام نرمال‌شده به کد مشتری → نام نرمال‌شده (حل‌نشده)
   * @returns {{key:string,label:string,resolved:boolean}}
   */
  function resolveCustomer(rec) {
    if (!rec) return { key: 'نامشخص', label: 'نامشخص', resolved: false };
    var cd = String(rec.buyerCd || rec.custCd || rec.customerId || '').trim();
    var label = String(rec.buyerCo || rec.co || rec.company || rec.name || '').trim();
    if (cd) return { key: cd, label: label || cd, resolved: true };
    var k = normName(label);
    if (k) {
      var mapped = nameIndex()[k];
      if (mapped) return { key: mapped, label: label, resolved: true };
      return { key: 'nm:' + k, label: label, resolved: false };
    }
    return { key: 'نامشخص', label: 'نامشخص', resolved: false };
  }

  /* ---------- F-04: نرمال‌سازی ارز ---------- */
  function fxRateOf(o) {
    if (!o) return 0;
    if (!o.currency || o.currency === 'IRR') return 1;
    var r = n(o.fxRateRef);
    if (r > 0) return r;
    if (o.fxConvert && n(o.fxConvert.rate) > 0) return n(o.fxConvert.rate);
    if (o.marginAtClose && n(o.marginAtClose.fxRate) > 0) return n(o.marginAtClose.fxRate);
    return 0; /* نرخ مرجع نداریم → مبلغ قابل تبدیل نیست */
  }
  function offerNominal(o) {
    return ((o && o.items) || []).reduce(function (s, it) { return s + n(it.qty) * n(it.price); }, 0);
  }
  /**
   * مبلغ پیشنهاد به ریال. اگر ارزی است و نرخ مرجع ندارد → ok:false و irr:0
   * (به‌جای جمع خام که قبلاً یورو را ریال حساب می‌کرد)
   */
  function offerTotalIRR(o) {
    var raw = offerNominal(o), rate = fxRateOf(o);
    if (!rate) return { irr: 0, ok: false, raw: raw, currency: (o && o.currency) || 'IRR' };
    return { irr: Math.round(raw * rate), ok: true, raw: raw, currency: (o && o.currency) || 'IRR' };
  }

  /* ---------- وضعیت پیشنهاد ---------- */
  function isCommercial(o) { return !!o && (o.kind === 'CO' || o.kind === 'TC') && !o.rialOf; }
  function isWon(o) { return !!o && o.st === 'won'; }
  function isLost(o) { return !!o && o.st === 'lost'; }
  function isDecided(o) { return isWon(o) || isLost(o); }
  /** F-07/گزارش‌محور: منقضی فقط «برچسب تحلیلی» است و وضعیت رکورد را تغییر نمی‌دهد. */
  function isExpired(o, ref) {
    if (!o || isDecided(o)) return false;
    var v = String(o.validUntil || '').slice(0, 10);
    return !!v && v < (ref || todayISO());
  }

  /* ---------- F-01/F-08: سنجه‌های برد ---------- */
  function pct1(a, b) { return b ? Math.round(a * 1000 / b) / 10 : null; }
  /**
   * @param {Array} offers فهرست پیشنهادهای تجاری (CO/TC، بدون نسخه ریالی همراه)
   * @returns سنجه‌های صریح + meta برای نمایش شفاف
   */
  function winStats(offers, opts) {
    opts = opts || {};
    var ref = opts.todayISO || todayISO();
    var minSample = opts.minSample == null ? 3 : opts.minSample;
    var s = { issued: 0, won: 0, lost: 0, decided: 0, open: 0, expired: 0, draft: 0, sent: 0,
      wonValueIRR: 0, openValueIRR: 0, fxGaps: 0 };
    (offers || []).forEach(function (o) {
      if (!isCommercial(o)) return;
      s.issued++;
      var t = offerTotalIRR(o);
      if (!t.ok) s.fxGaps++;
      if (o.st === 'draft') s.draft++;
      if (o.st === 'sent') s.sent++;
      if (isWon(o)) { s.won++; s.wonValueIRR += t.irr; }
      else if (isLost(o)) { s.lost++; }
      else { s.open++; s.openValueIRR += t.irr; if (isExpired(o, ref)) s.expired++; }
    });
    s.decided = s.won + s.lost;
    /* نرخ اصلی داشبورد (مصوب کارفرما): برد از کل پیشنهادهای صادرشده */
    s.winRateAll = s.issued >= minSample ? pct1(s.won, s.issued) : null;
    /* نرخ کمکی: فقط در بین مواردی که نتیجه‌شان ثبت شده — همان عدد قدیمی، با برچسب صریح */
    s.winRateDecided = s.decided >= minSample ? pct1(s.won, s.decided) : null;
    s.coverage = pct1(s.decided, s.issued);
    s.sample = s.issued;
    s.reliable = s.issued >= minSample && s.coverage != null && s.coverage >= 60;
    return s;
  }

  /* ---------- F-02: احتمال برد برای پایپ‌لاین ---------- */
  /**
   * برآورد هموارشدهٔ بیزی: نمونهٔ کوچک نباید ضریب ۱ یا ۰ بسازد.
   * p = (won + k*prior) / (issued + k) با سقف محافظه‌کارانه.
   */
  function pWin(won, issued, opts) {
    opts = opts || {};
    var k = opts.k == null ? 5 : opts.k;
    var prior = opts.prior == null ? 0.3 : opts.prior;
    var cap = opts.cap == null ? 0.7 : opts.cap;
    var p = (n(won) + k * prior) / (n(issued) + k);
    return Math.max(0, Math.min(cap, p));
  }

  /* ---------- F-05: مالی از منبع واحد ---------- */
  function invoiceActive(i) {
    if (!i) return false;
    if (i.status === 'void' || i.st === 'void' || i.void === true) return false;
    return true;
  }
  function invoiceBilledIRR(i) { return invoiceActive(i) ? n(i.amount) : 0; }
  function invoiceCollectedIRR(i) {
    if (!invoiceActive(i)) return 0;
    if (W.PTF && typeof W.PTF.invPaidSum === 'function') return n(W.PTF.invPaidSum(i, { useAmountIrr: true }));
    /* fallback هم‌رفتار با finance-helpers (پرداخت ابطالی/مهاجرت‌شده شمرده نشود) */
    var rows = (i.payments || []).concat(i.pays || []);
    var legacy = rows.reduce(function (s, p) {
      if (!p) return s;
      if (p.status === 'void' || p.status === 'reversal' || p.void === true) return s;
      if (p.fromAdvance || p.migratedToReceiptId || p.financialProjectionDisabled) return s;
      return s + (n(p.amountIrr) || n(p.amt) || n(p.amount));
    }, 0);
    return legacy + n(i.allocatedBase) + n(i.allocatedVat);
  }

  W.PTF.metrics = {
    version: 'v34.7.17',
    normName: normName,
    resolveCustomer: resolveCustomer,
    fxRateOf: fxRateOf,
    offerNominal: offerNominal,
    offerTotalIRR: offerTotalIRR,
    isCommercial: isCommercial,
    isWon: isWon, isLost: isLost, isDecided: isDecided, isExpired: isExpired,
    winStats: winStats,
    pWin: pWin,
    pct1: pct1,
    invoiceActive: invoiceActive,
    invoiceBilledIRR: invoiceBilledIRR,
    invoiceCollectedIRR: invoiceCollectedIRR
  };
})();
