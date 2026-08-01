/* =====================================================================
   PTF CRM — cheque-module.js — CHQ-MOD-001 (مصوب ۱۴۰۵/۰۸/۱۰)
   ماژول مستقل چک: دو زیرماژول صادره (issued) و وارده (received).

   - کلیدها: ptf_crm_cheques_issued / ptf_crm_cheques_received
   - کلید قدیمی ptf_crm_cheques فقط به‌عنوان legacy/مهاجرت (مهاجرت نرم،
     بدون حذف؛ پس از مهاجرت خالی می‌شود و کدهای قدیمی از ptfChequeAll می‌خوانند).
   - چک ضمانت/سپرده → صادره (تصویب کارفرما).
   - وضعیت وارده: open/held → endorsed | cleared | bounced | voided_transfer
   - وضعیت صادره: open → cleared | void (ضمانت: retrieved)
   ===================================================================== */
(function () {
  'use strict';
  var K_ISSUED = 'ptf_crm_cheques_issued';
  var K_RECEIVED = 'ptf_crm_cheques_received';
  var K_LEGACY = 'ptf_crm_cheques';

  function read(key) { var v = getData(key); return Array.isArray(v) ? v : []; }
  function write(key, l) { setData(key, l); }
  function me() { try { return curSession() || {}; } catch (e) { return {}; } }

  /* ---------- خواندن ---------- */
  window.ptfChequeIssued = function () { return read(K_ISSUED); };
  window.ptfChequeReceived = function () { return read(K_RECEIVED); };

  /* نمای یکپارچه (سازگاری با کدهای قدیمی): issued + received + legacy‌های مهاجرت‌نشده */
  window.ptfChequeAll = function () {
    var out = [], seen = {};
    read(K_ISSUED).forEach(function (c) { if (c && c.cd) { seen[c.cd] = 1; out.push(c); } });
    read(K_RECEIVED).forEach(function (c) { if (c && c.cd && !seen[c.cd]) { seen[c.cd] = 1; out.push(c); } });
    (getData(K_LEGACY) || []).forEach(function (c) { if (c && c.cd && !seen[c.cd]) out.push(c); });
    return out;
  };
  window.ptfChequeFind = function (cd) {
    return window.ptfChequeAll().filter(function (x) { return x.cd === cd; })[0];
  };

  /* ---------- ایجاد ---------- */
  window.ptfChequeCreate = function (dir, rec) {
    rec = rec || {};
    rec.direction = dir === 'received' ? 'received' : 'issued';
    rec.cd = rec.cd || genCode('CHQ');
    rec.t = rec.t || faDateTime();
    rec.by = rec.by || me().user;
    rec.byNm = rec.byNm || me().name;
    rec.st = rec.st || 'open';
    if (rec.kind === 'guarantee') rec.direction = 'issued'; /* تصویب: ضمانت → صادره */
    var key = rec.direction === 'received' ? K_RECEIVED : K_ISSUED;
    var l = read(key); l.unshift(rec); write(key, l);
    /* CHQ-V2: اثر مالی به محض ثبت — اگر طرف/فاکتور مشخص باشد (ضمانت هرگز اثر مالی ندارد) */
    var applied = window.ptfChequeApplyFinancial(rec);
    rec.financial = applied;
    if (applied && applied.ok) rec.financialApplied = { at: faDateTimeL(), result: applied };
    write(key, l);
    return rec;
  };

  /* ---------- عملیات چک وارده ---------- */
  /* انتقال (Endorse) به تامین‌کننده — v33.8.0 (مصوب کارفرما): «چک ثالث هم خرج و ثبت شود».
     خرج کردن چک وارده نزد تامین‌کننده = پرداخت بدهی ما به آن تامین‌کننده:
     اگر تامین‌کننده از فهرست انتخاب شود (supCd) و چک مالی باشد، همان لحظه payment
     در supplier-finance ساخته می‌شود (کسر بدهی) و چک endorsed می‌شود. */
  window.ptfChequeEndorse = function (cd, supName, note, supCd) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st !== 'open' && c.st !== 'held') return { ok: false, why: 'state' };
    c.st = 'endorsed'; c.endorsedAt = faDateTime(); c.endorsedBy = me().name;
    c.endorseTo = supName || ''; c.transferNote = note || '';
    var applied = null;
    if (supCd && c.kind !== 'guarantee') {
      c.endorseSupplierCd = supCd;
      c.supplierCd = supCd;
      c.supplierName = supName || '';
      /* اثر مالی خرج: payment در حساب تامین‌کننده (مثل چک صادره مالی) */
      var r = ptfChequeApplyIssued(c);
      if (r.ok) { c.financialApplied = { at: faDateTimeL(), result: r, via: 'endorse' }; applied = r; }
    }
    write(K_RECEIVED, l);
    return { ok: true, cheque: c, financial: applied };
  };
  /* ثبت وصول (Cleared) — v33.7.0: چک مالی وارده‌ای که هنگام ثبت فاکتور نداشت،
     با وصول اثر مالی می‌گیرد (روی اولین فاکتور باز همان مشتری). */
  window.ptfChequeCollect = function (cd, note) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'bounced') return { ok: false, why: 'state' };
    c.st = 'cleared'; c.clearedAt = faDateTime(); c.clearedBy = me().name; c.clearNote = note || '';
    write(K_RECEIVED, l);
    /* اثر مالی هنگام وصول (اگر قبلاً اثر نرفته باشد) */
    var applied = null;
    if (c.kind !== 'guarantee' && !c.financialApplied) {
      var r = window.ptfChequeApplyFinancial(c);
      if (r.ok) { c.financialApplied = { at: faDateTimeL(), result: r }; applied = r; }
      else if (r.why === 'no_invoice' && (c.custCd || c.sourceCustomerCd)) {
        /* چک وارده بدون فاکتور مشخص: روی اولین فاکتور باز همان مشتری */
        var invs = window.ptfChequeOpenInvoicesOf(c.custCd || c.sourceCustomerCd);
        if (invs.length) {
          c.sourceInvoiceCd = invs[0].cd;
          var r2 = window.ptfChequeApplyFinancial(c);
          if (r2.ok) { c.financialApplied = { at: faDateTimeL(), result: r2 }; applied = r2; }
        }
      }
      if (applied) write(K_RECEIVED, l);
    }
    return { ok: true, cheque: c, financial: applied };
  };
  /* برگشتی (Bounced) — جدید (از open/held/endorsed مجاز است؛ از وصول‌شده نه) */
  window.ptfChequeBounce = function (cd, reason) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'bounced' || c.st === 'void' || c.st === 'voided_transfer') return { ok: false, why: 'state' };
    c.st = 'bounced'; c.bounceAt = faDateTime(); c.bounceBy = me().name; c.bounceReason = reason || '';
    write(K_RECEIVED, l);
    /* CHQ-V2: برگشتی → معکوس اثر مالی (مطالبات مشتری برمی‌گردد) */
    window.ptfChequeReverseReceived(cd, reason);
    return { ok: true, cheque: c };
  };
  /* ابطال انتقال وارده (بازگشت به open) */
  window.ptfChequeVoidTransfer = function (cd, reason) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st !== 'endorsed') return { ok: false, why: 'state' };
    c.st = 'open'; c.voidedTransferAt = faDateTime(); c.voidedTransferBy = me().name; c.voidTransferNote = reason || '';
    delete c.endorseTo; delete c.transferNote;
    write(K_RECEIVED, l);
    return { ok: true, cheque: c };
  };

  /* ---------- عملیات چک صادره ---------- */
  window.ptfChequeClearIssued = function (cd, note) {
    var l = read(K_ISSUED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'void') return { ok: false, why: 'state' };
    if (c.kind === 'guarantee') { c.st = 'retrieved'; c.retrievedAt = faDateTime(); c.retrievedBy = me().name; }
    else { c.st = 'cleared'; c.clearedAt = faDateTime(); c.clearedBy = me().name; c.clearNote = note || ''; }
    write(K_ISSUED, l);
    /* v33.7.0: چک صادره قدیمی بدون اثر مالی → هنگام وصول اثر می‌گیرد */
    var applied = null;
    if (c.kind !== 'guarantee' && !c.financialApplied && c.supplierCd) {
      var r = window.ptfChequeApplyFinancial(c);
      if (r.ok) { c.financialApplied = { at: faDateTimeL(), result: r }; applied = r; write(K_ISSUED, l); }
    }
    return { ok: true, cheque: c, financial: applied };
  };
  window.ptfChequeVoidIssued = function (cd, reason) {
    var l = read(K_ISSUED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'void') return { ok: false, why: 'state' };
    c.st = 'void'; c.voidAt = faDateTime(); c.voidBy = me().name; c.voidReason = reason || '';
    c.reminderDisabled = true;
    write(K_ISSUED, l);
    /* CHQ-V2: ابطال → معکوس اثر مالی (بدهی تامین‌کننده برمی‌گردد) */
    window.ptfChequeReverseIssued(cd, reason);
    return { ok: true, cheque: c };
  };

  /* ---------- مهاجرت نرم (یک‌باره، بدون حذف) ---------- */
  window.ptfChequeSplitMigrate = function () {
    var legacy = getData(K_LEGACY) || [];
    var issued = read(K_ISSUED), received = read(K_RECEIVED);
    var seen = {};
    issued.concat(received).forEach(function (c) { if (c && c.cd) seen[c.cd] = 1; });
    var moved = 0;
    legacy.forEach(function (c) {
      if (!c || !c.cd || seen[c.cd]) return;
      var dir = c.direction;
      if (!dir) {
        if (c.ownership === 'third_party' || c.sourceCustomerCd || c.kind === 'received') dir = 'received';
        else if (c.kind === 'guarantee' || c.ownership === 'company') dir = 'issued';
        else dir = 'issued'; /* پیش‌فرض امن: چک‌های قدیمی (US-327) صادره */
      }
      c.direction = dir;
      if (dir === 'received') received.unshift(c); else issued.unshift(c);
      seen[c.cd] = 1; moved++;
    });
    if (moved) {
      write(K_RECEIVED, received); write(K_ISSUED, issued);
      /* موارد منتقل‌شده از کلید legacy حذف می‌شوند (مهاجرت نرم — چیزی دور ریخته نمی‌شود چون به کلید جدید رفته) */
      var remain = legacy.filter(function (c) { return !c || !c.cd || !seen[c.cd]; });
      setData(K_LEGACY, remain);
    }
    return moved;
  };

  /* پرچم برای UI (در دسترس بودن ماژول) */
  window.ptfChequeModuleReady = true;
})();

  /* CHQ-V2: این بخش خارج از IIFE اضافه شد — توابع کمکی محلی
     v33.7.0 BUG-FIX: نسخهٔ قبلی faDateL/faDateTimeL خودشان را بازگشتی صدا می‌زدند
     (استک‌اورفلو → تاریخ/زمان payment چک‌ها خالی می‌ماند). */
  var me = function () { try { return curSession() || {}; } catch (e) { return {}; } };
  var faDateL = function () { try { return typeof faDate === 'function' ? faDate() : ''; } catch (e) { return ''; } };
  var faDateTimeL = function () { try { return typeof faDateTime === 'function' ? faDateTime() : ''; } catch (e) { return ''; } };

  /* ============ CHQ-V2: اثر مالی چک بر حساب (به محض ثبت؛ برگشتی/ابطال → معکوس) ============ */
  /* چک وارده → payment روی فاکتور مشتری (اگر sourceInvoiceCd و مانده کافی باشد) */
  function ptfChequeApplyReceived(c) {
    if (!c || !c.sourceInvoiceCd) return { ok: false, why: 'no_invoice' };
    var invs = getData('ptf_crm_invoices') || [];
    var inv = invs.filter(function (x) { return x.cd === c.sourceInvoiceCd; })[0];
    if (!inv) return { ok: false, why: 'invoice_not_found' };
    var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    var remain = (+inv.amount || 0) - paid;
    if (c.amt > remain + 0.5) return { ok: false, why: 'over_remain' };
    inv.payments = inv.payments || [];
    var payRec = { cd: genCode('RPAY'), amt: +c.amt || 0, how: 'چک وارده ' + (c.sayad || c.no || c.cd || ''), t: faDateL(), by: me().name, chequeCd: c.cd, status: 'posted' };
    inv.payments.push(payRec);
    setData('ptf_crm_invoices', invs);
    return { ok: true, applied: 'invoice', invoiceCd: c.sourceInvoiceCd, paymentCd: payRec.cd };
  }
  /* چک صادره → payment در supplier-finance (اگر supplierCd) */
  function ptfChequeApplyIssued(c) {
    if (!c || !c.supplierCd) return { ok: false, why: 'no_supplier' };
    var d = getData('ptf_crm_supplier_finance');
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = { schema: 1, invoices: [], payments: [], adjustments: [] };
    var supName = c.supplierName || '';
    try { var sup = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === c.supplierCd; })[0]; if (sup) supName = sup.co || supName; } catch (eS) {}
    var todayIso = '';
    try { if (typeof ptfJToISO === 'function' && c.dueFa) todayIso = ptfJToISO(c.dueFa) || ''; } catch (eI) {}
    var payRec = { cd: genCode('SFPAY'), supplierCd: c.supplierCd, supName: supName, dateISO: todayIso, dateFa: c.dueFa || '', cur: 'IRR', rate: 1, amount: +c.amt || 0, amountIrr: +c.amt || 0, method: 'cheque', note: 'چک صادره ' + (c.sayad || c.no || c.cd || '') + (c.bank ? ' — ' + c.bank : ''), allocations: [], unallocated: +c.amt || 0, status: 'posted', chequeCd: c.cd, t: faDateTimeL(), by: me().name };
    d.payments = d.payments || []; d.payments.unshift(payRec);
    setData('ptf_crm_supplier_finance', d);
    return { ok: true, applied: 'supplier', paymentCd: payRec.cd };
  }
  window.ptfChequeApplyFinancial = function (c) {
    if (!c || !c.cd) return { ok: false, why: 'no_rec' };
    /* v33.7.0 (مصوب کارفرما): چک‌های ضمانت (پیش‌پرداخت/حسن انجام/مناقصه/سایر) اثر مالی ندارند —
       فقط در پرونده فروش می‌نشینند و با پایان پروژه استرداد می‌شوند. */
    if (c.kind === 'guarantee' || (c.guarType && c.guarType !== 'finance')) return { ok: false, why: 'guarantee_no_finance' };
    if (c.direction === 'received') return ptfChequeApplyReceived(c);
    return ptfChequeApplyIssued(c);
  };

  /* ============ v33.8.0: ذینفع = مشتری/تامین‌کننده/سایر/ثالث + فهرست‌های شرطی ============ */
  function dealNormName(s) {
    return String(s || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase();
  }
  /* مشتریان دارای پرونده فروش باز (wonOffer و بایگانی‌نشده).
     v33.8.0 BUG-FIX: رکوردهای deal فقط buyerCo (نام) دارند و buyerCd ندارند
     (salesfiles.js: r={cd,inqNo,buyerCo,...}) → تطبیق قبلی با d.buyerCd همیشه خالی بود.
     حالا: buyerCd (اگر هست) یا تطبیق نام buyerCo با نام مشتری (الگوی ptfOfferMatchCust). */
  window.ptfChequeCustOptions = function () {
    var out = [];
    try {
      var deals = getData('ptf_crm_deals') || [];
      var openDeals = deals.filter(function (d) { return d && d.wonOffer && d.st !== 'archived'; });
      var openCd = {}, openNm = {};
      openDeals.forEach(function (d) {
        if (d.buyerCd) openCd[d.buyerCd] = 1;
        if (d.buyerCo) openNm[dealNormName(d.buyerCo)] = 1;
      });
      var custs = getData('ptf_crm_customers') || [];
      var seen = {};
      custs.forEach(function (c) {
        if (!c || !c.cd || seen[c.cd]) return;
        var matched = openCd[c.cd] ? true : false;
        if (!matched && (c.co || c.nm)) matched = !!openNm[dealNormName(c.co || c.nm)];
        if (!matched) return;
        seen[c.cd] = 1;
        var n = openDeals.filter(function (d) {
          return (d.buyerCd && d.buyerCd === c.cd) || ((!d.buyerCd || !c.co) && d.buyerCo && dealNormName(d.buyerCo) === dealNormName(c.co || c.nm));
        }).length;
        out.push({ cd: c.cd, lb: (c.co || c.nm || c.cd) + ' — 📁 ' + n + ' پرونده باز' });
      });
    } catch (e) {}
    return out;
  };
  /* تامین‌کنندگانی که از ما مطالبه دارند (بدهی باز شرکت = مجموع فاکتورهای خرید باز − پرداخت‌ها > 0) */
  window.ptfChequeSupOptions = function () {
    var out = [];
    try {
      var d = getData('ptf_crm_supplier_finance');
      var invs = (d && d.invoices) || [];
      var pays = (d && d.payments) || [];
      var adj = (d && d.adjustments) || [];
      var debt = {};
      invs.forEach(function (i) {
        if (!i || i.status === 'void' || !i.supplierCd) return;
        debt[i.supplierCd] = (debt[i.supplierCd] || 0) + (+i.amount || 0);
      });
      pays.forEach(function (p) {
        if (!p || p.status === 'void' || !p.supplierCd) return;
        debt[p.supplierCd] = (debt[p.supplierCd] || 0) - (+p.amount || 0);
      });
      adj.forEach(function (a) {
        if (!a || a.status === 'void' || !a.supplierCd) return;
        debt[a.supplierCd] = (debt[a.supplierCd] || 0) + (+a.amount || 0);
      });
      var sups = getData('ptf_crm_suppliers') || [];
      var seen = {};
      sups.forEach(function (s) {
        if (!s || !s.cd || seen[s.cd]) return;
        seen[s.cd] = 1;
        var b = Math.round((debt[s.cd] || 0));
        if (b <= 0) return;
        out.push({ cd: s.cd, lb: (s.co || s.cd) + ' — بدهی ' + b.toLocaleString('fa-IR') + ' ریال' });
      });
      out.sort(function (a, b2) { return a.lb < b2.lb ? -1 : 1; });
    } catch (e) {}
    return out;
  };
  /* برچسب دسته ذینفع برای نمایش در جدول‌ها — v33.8.0: ثالث (چک شخص/شرکت دیگر) */
  window.ptfChequePartyKind = function (rec) {
    rec = rec || {};
    if (rec.supplierCd) return 'sup';
    if (rec.custCd || rec.sourceCustomerCd) return 'cust';
    if (rec.thirdParty) return 'third';
    return 'other';
  };
  window.ptfChequePartyKindLabel = function (rec) {
    var k = window.ptfChequePartyKind(rec);
    return k === 'sup' ? 'تامین‌کننده' : k === 'cust' ? 'مشتری' : k === 'third' ? 'ثالث' : 'سایر';
  };
  /* فاکتورهای باز یک مشتری (دارای مانده) — برای چک وارده */
  window.ptfChequeOpenInvoicesOf = function (custCd) {
    var out = [];
    try {
      var invs = getData('ptf_crm_invoices') || [];
      var offers = getData('ptf_crm_offers') || [];
      invs.forEach(function (inv) {
        if (!inv || inv.status === 'void') return;
        var o = offers.filter(function (x) { return x.no === inv.offerNo; })[0] || {};
        if (o.buyerCd !== custCd && inv.buyerCd !== custCd && inv.custCd !== custCd) return;
        var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
        var rem = Math.round((+inv.amount || 0) - paid);
        if (rem > 0) out.push({ cd: inv.cd, lb: (inv.no || inv.cd) + ' — مانده ' + rem.toLocaleString('fa-IR') + ' ریال', remain: rem });
      });
    } catch (e) {}
    return out;
  };
  /* معکوس: وارده برگشتی → حذف payment چک از فاکتور */
  window.ptfChequeReverseReceived = function (cd, reason) {
    var invs = getData('ptf_crm_invoices') || [], changed = false;
    invs.forEach(function (inv) {
      var before = (inv.payments || []).length;
      inv.payments = (inv.payments || []).filter(function (p) { return p.chequeCd !== cd; });
      if ((inv.payments || []).length !== before) changed = true;
    });
    if (changed) setData('ptf_crm_invoices', invs);
    return changed;
  };
  /* معکوس: صادره ابطال → void payment چک در supplier-finance */
  window.ptfChequeReverseIssued = function (cd, reason) {
    var d = getData('ptf_crm_supplier_finance');
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    var changed = false;
    (d.payments || []).forEach(function (p) {
      if (p.chequeCd === cd && p.status !== 'void') { p.status = 'void'; p.voidAt = faDateTimeL(); p.voidBy = me().name; p.voidNote = reason || 'ابطال چک'; changed = true; }
    });
    if (changed) setData('ptf_crm_supplier_finance', d);
    return changed;
  };
