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
