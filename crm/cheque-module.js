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
    /* CHQ-V2: اثر مالی به محض ثبت — اگر طرف/فاکتور مشخص باشد */
    var applied = window.ptfChequeApplyFinancial(rec);
    rec.financial = applied;
    return rec;
  };

  /* ---------- عملیات چک وارده ---------- */
  /* انتقال (Endorse) به تامین‌کننده */
  window.ptfChequeEndorse = function (cd, supName, note) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st !== 'open' && c.st !== 'held') return { ok: false, why: 'state' };
    c.st = 'endorsed'; c.endorsedAt = faDateTime(); c.endorsedBy = me().name;
    c.endorseTo = supName || ''; c.transferNote = note || '';
    write(K_RECEIVED, l);
    return { ok: true, cheque: c };
  };
  /* ثبت وصول (Cleared) */
  window.ptfChequeCollect = function (cd, note) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'bounced') return { ok: false, why: 'state' };
    c.st = 'cleared'; c.clearedAt = faDateTime(); c.clearedBy = me().name; c.clearNote = note || '';
    write(K_RECEIVED, l);
    return { ok: true, cheque: c };
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
    return { ok: true, cheque: c };
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

  /* CHQ-V2: این بخش خارج از IIFE اضافه شد — توابع کمکی محلی */
  var me = function () { try { return curSession() || {}; } catch (e) { return {}; } };
  var faDateL = function () { try { return typeof faDate === 'function' ? faDateL() : ''; } catch (e) { return ''; } };
  var faDateTimeL = function () { try { return typeof faDateTime === 'function' ? faDateTimeL() : ''; } catch (e) { return ''; } };

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
    if (c.direction === 'received') return ptfChequeApplyReceived(c);
    return ptfChequeApplyIssued(c);
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
