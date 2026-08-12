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
  /* کیفیت داده و فرم ویرایش باید همین معنا را ببینند؛ نام روی دسته چک (owner) مالکیت نیست. */
  window.ptfChequeOwnershipOf = function (c) {
    if (!c) return '';
    if (c.ownership) return String(c.ownership);
    if (c.direction === 'received') return c.thirdParty ? 'third_party' : ((c.custCd || c.sourceCustomerCd) ? 'received' : 'third_party');
    if (c.direction === 'issued') return 'company';
    return '';
  };

  /* ---------- ایجاد ---------- */
  window.ptfChequeCreate = function (dir, rec) {
    rec = rec || {};
    if (typeof window.ptfFinanceAssertWritable === 'function') {
      var gate = window.ptfFinanceAssertWritable(rec.dueISO || rec.dueFa || rec.t, {
        action: 'ثبت چک',
        requireCode: rec.cd,
        companyCheque: (dir !== 'received' && rec.ownership !== 'personal' && rec.ownership !== 'third_party')
      });
      if (!gate.ok) return { ok: false, why: gate.why, error: gate.error };
    }
    rec.direction = dir === 'received' ? 'received' : 'issued';
    rec.cd = rec.cd || genCode('CHQ');
    rec.t = rec.t || faDateTime();
    rec.by = rec.by || me().user;
    rec.byNm = rec.byNm || me().name;
    rec.st = rec.st || 'open';
    if (rec.kind === 'guarantee') rec.direction = 'issued'; /* تصویب: ضمانت → صادره */
    /* مالکیت (company/personal/third_party/received) ≠ نام مالک دسته چک (owner).
       بدون این پیش‌فرض، کیفیت داده برای چک بازِ بدون فیلد ownership تا ابد هشدار می‌دهد. */
    if (!rec.ownership) {
      rec.ownership = rec.direction === 'received'
        ? (rec.thirdParty ? 'third_party' : ((rec.custCd || rec.sourceCustomerCd) ? 'received' : 'third_party'))
        : 'company';
    }
    var key = rec.direction === 'received' ? K_RECEIVED : K_ISSUED;
    var l = read(key); l.unshift(rec); write(key, l);
    /* CHQ-V2: اثر مالی به محض ثبت — اگر طرف/فاکتور مشخص باشد (ضمانت هرگز اثر مالی ندارد).
       v33.10.0 (منطق نقدی مصوب کارفرما): چک وارده «درآمد واقعی» نیست تا وقتی وصول نشود —
       اثر مالی (payment روی فاکتور مشتری) فقط هنگام «وصول» (ptfChequeCollect) ساخته می‌شود. */
    if (rec.direction === 'issued') {
      var applied = window.ptfChequeApplyFinancial(rec);
      rec.financial = applied;
      if (applied && applied.ok) rec.financialApplied = { at: faDateTimeL(), result: applied };
    } else {
      rec.financial = { ok: false, why: 'received_pending_collect' };
      rec.pendingFinancial = true;
    }
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
     با وصول اثر مالی می‌گیرد (روی اولین فاکتور باز همان مشتری).
     v33.10.0 (منطق نقدی مصوب کارفرما): وصول = لحظهٔ تحقق درآمد — اثر مالی همیشه اینجا ساخته می‌شود. */
  window.ptfChequeCollect = function (cd, note) {
    var l = read(K_RECEIVED), c = l.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return { ok: false, why: 'notfound' };
    if (c.st === 'cleared' || c.st === 'bounced') return { ok: false, why: 'state' };
    c.st = 'cleared'; c.clearedAt = faDateTime(); c.clearedBy = me().name; c.clearNote = note || '';
    write(K_RECEIVED, l);
    /* اثر مالی هنگام وصول (همیشه — حتی اگر در ثبت قبلاً اثر رفته باشد، جلوگیری از دوباره‌شماری) */
    var applied = null;
    if (c.kind !== 'guarantee') {
      if (!c.financialApplied) {
        var r = window.ptfChequeApplyFinancial(c);
        if (r.ok) { c.financialApplied = { at: faDateTimeL(), result: r }; applied = r; }
        else if (r.why === 'no_invoice' && (c.custCd || c.sourceCustomerCd)) {
          var invs = window.ptfChequeOpenInvoicesOf(c.custCd || c.sourceCustomerCd);
          if (invs.length) {
            c.sourceInvoiceCd = invs[0].cd;
            var r2 = window.ptfChequeApplyFinancial(c);
            if (r2.ok) { c.financialApplied = { at: faDateTimeL(), result: r2 }; applied = r2; }
          }
        }
        if (applied) write(K_RECEIVED, l);
      } else {
        applied = c.financialApplied && c.financialApplied.result;
      }
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

  /* P3: chSave دیگر کل شرکت را در کلید قدیمی نمی‌نویسد — صادره/وارده منبع حقیقت‌اند. */
  window.ptfChequeReplaceCompany = function (list) {
    var issued = [], received = [];
    (list || []).forEach(function (c) {
      if (!c || !c.cd) return;
      var dir = c.direction;
      if (!dir) {
        if (c.ownership === 'third_party' || c.sourceCustomerCd || c.kind === 'received') dir = 'received';
        else dir = 'issued';
      }
      c.direction = dir;
      if (dir === 'received') received.push(c); else issued.push(c);
    });
    write(K_ISSUED, issued);
    write(K_RECEIVED, received);
    setData(K_LEGACY, []);
    return { issued: issued.length, received: received.length };
  };

  /* پرچم برای UI (در دسترس بودن ماژول) */
  window.ptfChequeModuleReady = true;

  /* ================= v34.0.16-alpha (فاز ۱۳): دسته چک (Cheque Book) + قفل شماره صیادی =================
     - دسته چک: ثبت مشخصات کتاب چک شرکت (بانک، شماره حساب، مالک، شعبه، سری، شماره چک از..تا).
       هنگام ثبت چکِ صادره از فهرست دسته‌ها انتخاب می‌شود و مشخصات به چک منتقل می‌شود.
     - قفل شماره صیادی: شماره صیادِ ثبت‌شده (مخصوصاً از دستیار) دیگر قابل ثبت مجدد نیست. */

  /* کلید دادهٔ دسته‌های چک */
  var K_BOOKS = 'ptf_crm_cheque_books';

  /* فهرست دسته‌های چک */
  window.ptfChequeBooks = function () { return read(K_BOOKS); };
  window.ptfChequeBookSave = function (book) {
    if (!book || !book.cd) return { ok: false, why: 'no_cd' };
    book.updatedAt = faDateTimeL(); book.updatedAtISO = new Date().toISOString(); book.updatedBy = me().name;
    var l = read(K_BOOKS);
    var hit = l.filter(function (x) { return x.cd === book.cd; })[0];
    if (hit) { Object.keys(book).forEach(function (k) { hit[k] = book[k]; }); }
    else l.unshift(book);
    write(K_BOOKS, l);
    return { ok: true, book: hit || book };
  };
  window.ptfChequeBookDelete = function (cd) {
    var l = read(K_BOOKS);
    write(K_BOOKS, l.filter(function (x) { return x.cd !== cd; }));
    return { ok: true };
  };
  /* آیا یک شماره صیاد در این دسته/بازه است؟ */
  window.ptfChequeBookCoversNo = function (book, no) {
    if (!book || !no) return false;
    var n = /^\d+$/.test(String(no).replace(/[-\s]/g, '')) ? parseInt(String(no).replace(/[-\s]/g, ''), 10) : NaN;
    var from = parseInt(String(book.fromNo || '').replace(/[-\s]/g, ''), 10);
    var to = parseInt(String(book.toNo || '').replace(/[-\s]/g, ''), 10);
    if (!isFinite(n) || !isFinite(from) || !isFinite(to)) return false;
    return n >= from && n <= to;
  };
  /* شماره صیادی ثبت‌شده‌ها (برای قفل) — از همهٔ کلیدها */
  function usedSayads() {
    var set = {};
    [K_ISSUED, K_RECEIVED, K_LEGACY].forEach(function (key) {
      read(key).forEach(function (c) { if (c && c.sayad) set[String(c.sayad).replace(/[-\s]/g, '').toLowerCase()] = 1; });
    });
    return set;
  }
  /* بررسی قفل: آیا این شماره صیاد قبلاً ثبت شده؟ */
  window.ptfChequeSayadUsed = function (sayad) {
    if (!sayad) return false;
    var k = String(sayad).replace(/[-\s]/g, '').toLowerCase();
    return !!usedSayads()[k];
  };
  /* ثبت شماره صیاد (اضافه به مجموعهٔ استفاده‌شده) — بعد از ثبت چک از دستیار/فرم */
  window.ptfChequeReserveSayad = function (sayad) {
    if (!sayad) return;
    /* ذخیرهٔ جدا برای ردیابی قفل صیاد (حتی اگر چک حذف شود، صیاد رزرو می‌ماند تا ثبت مجدد نشود) */
    var reserved = getData(K_LEGACY + '_sayads');
    if (!Array.isArray(reserved)) reserved = [];
    var k = String(sayad).replace(/[-\s]/g, '').toLowerCase();
    if (reserved.indexOf(k) === -1) { reserved.push(k); setData(K_LEGACY + '_sayads', reserved); }
  };
  /* بررسی قفل رزرو صیاد (رزرو = چک از دستیار ثبت شد و صیاد قفل شد) */
  window.ptfChequeSayadReserved = function (sayad) {
    if (!sayad) return false;
    var k = String(sayad).replace(/[-\s]/g, '').toLowerCase();
    try { var reserved = getData(K_LEGACY + '_sayads'); return Array.isArray(reserved) && reserved.indexOf(k) > -1; } catch (e) { return false; }
  };

  /* در ptfChequeCreate: قفل صیاد — اگر از دستیار ثبت می‌شود (reserveSayad) یا صیاد رزرو شده، ثبت مجدد ممنوع */
  var _origChequeCreate = window.ptfChequeCreate;
  window.ptfChequeCreate = function (dir, rec) {
    rec = rec || {};
    var sayad = String(rec.sayad || rec.no || '').trim();
    /* قفل: اگر این صیاد رزرو شده (از دستیار ثبت شده) و چکِ در حال ثبت، چکِ جدیدی است (بدون cd) →
       ثبت مجدد ممنوع؛ مگر اینکه ویرایشِ همان چک باشد (existingCd). */
    if (sayad && !rec.cd && window.ptfChequeSayadReserved(sayad)) {
      return { ok: false, why: 'sayad_locked', error: '⛔ شماره صیاد ' + sayad + ' قبلاً ثبت/قفل شده است و قابلیت ثبت مجدد ندارد.' };
    }
    var r = _origChequeCreate(dir, rec);
    if (r && r.cd && sayad) window.ptfChequeReserveSayad(sayad);
    return r;
  };
  window.ptfChequeCreate = window.ptfChequeCreate;
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
    var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (window.PTF && PTF.paymentAmtIrr ? PTF.paymentAmtIrr(p) : (+p.amt || 0)); }, 0);
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
        var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (window.PTF && PTF.paymentAmtIrr ? PTF.paymentAmtIrr(p) : (+p.amt || 0)); }, 0);
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

  /* ================= v34.0.14-alpha (فاز ۱۱: ویرایش/حذف چک + اصلاح/حذف آنی اثر مالی) =================
     هستهٔ مدیریت چک برای ویرایش/حذف. به‌دلیل حساسیت مالی:
       - یافتن محل ذخیرهٔ چک (issued/received/legacy)
       - به‌روزرسانی چک (ویرایش)
       - اصلاح مبلغ اثر مالیِ چک مالیِ صادره روی حساب تأمین‌کننده
       - حذف کامل چک + حذف کامل اثر مالی/گردش (نه void) */

  /* محل ذخیرهٔ چک را پیدا کن و شیء چک را در آن آرایه برگردان (همراه نام کلید).
     (بخش خارج از IIFE — کلیدها/read را این‌جا دوباره تعریف می‌کنیم چون به‌صورت
     private داخل IIFE بودند و این توابع بیرون از آن قرار دارند.) */
  var CHK_KEYS = ['ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheques'];
  function chFindStore(cd) {
    for (var i = 0; i < CHK_KEYS.length; i++) {
      var key = CHK_KEYS[i];
      var l = getData(key); if (!Array.isArray(l)) l = [];
      var hit = l.filter(function (x) { return x && x.cd === cd; })[0];
      if (hit) return { key: key, list: l, rec: hit, idx: l.indexOf(hit) };
    }
    return null;
  }
  /* یافتن payment تامین‌کننده مرتبط با یک چک صادرهٔ مالی */
  function sfPayForCheque(cd) {
    var d = getData('ptf_crm_supplier_finance');
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    var hits = (d.payments || []).filter(function (p) { return p.chequeCd === cd && p.status !== 'void'; });
    return hits[0] || null;
  }
  function sfSave(d) { setData('ptf_crm_supplier_finance', d); }

  /* به‌روزرسانی چک (ویرایش). فیلدهای داده‌شده را روی رکورد اعمال و در کلید درست ذخیره می‌کند.
     خروجی: {ok, rec, store} */
  window.ptfChequeUpdate = function (cd, patch) {
    var st = chFindStore(cd);
    if (!st) return { ok: false, why: 'notfound' };
    patch = patch || {};
    Object.keys(patch).forEach(function (k) { if (patch[k] !== undefined) st.rec[k] = patch[k]; });
    if (patch.dueISO) st.rec.dueFa = (typeof ptfISOToJ === 'function') ? ptfISOToJ(patch.dueISO) : patch.dueISO;
    /* برای حل conflict بین دو دستگاه، زمان هر ویرایش (به‌ویژه files) باید عوض شود؛
       `t` فقط زمان ایجاد بود و باعث server-wins کاذب می‌شد. */
    st.rec.updatedAtISO = new Date().toISOString();
    st.rec.updatedBy = me().name;
    setData(st.key, st.list);
    return { ok: true, rec: st.rec, store: st.key };
  };

  /* اصلاح مبلغ اثر مالی چک صادرهٔ مالی روی حساب تأمین‌کننده (پس از ویرایش مبلغ چک).
     payment مرتبط (method:'cheque') با مبلغ جدید به‌روزرسانی می‌شود و گردش حساب آنی اصلاح می‌شود.
     نکته: d و p باید از یک getData گرفته شوند تا ذخیرهٔ d تغییر p را شامل شود. */
  window.ptfChequeApplyFinancialAmount = function (cd, newAmt) {
    newAmt = Math.round(+newAmt || 0);
    var d = getData('ptf_crm_supplier_finance');
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, why: 'no_data' };
    var p = (d.payments || []).filter(function (x) { return x.chequeCd === cd && x.status !== 'void'; })[0];
    if (!p) return { ok: false, why: 'no_financial' };
    var diff = newAmt - (+p.amount || 0);
    if (Math.abs(diff) < 1) return { ok: true, diff: 0, updated: false };
    p.amount = newAmt; p.amountIrr = newAmt;
    p.updatedAt = faDateTimeL(); p.updatedBy = me().name; p.updatedNote = 'اصلاح مبلغ چک ' + cd;
    var allocSum = (p.allocations || []).reduce(function (s, a) { return s + (+a.amount || 0); }, 0);
    p.unallocated = Math.max(0, newAmt - allocSum);
    setData('ptf_crm_supplier_finance', d);
    return { ok: true, diff: diff, updated: true, paymentCd: p.cd };
  };

  /* حذف کامل چک + حذف کامل اثر مالی/گردش حساب (نه void).
     اگر چک صادرهٔ مالی به تأمین‌کننده وصل بود، payment مرتبط به‌طور کامل از
     supplier-finance حذف می‌شود تا گردش حساب هم به‌طور کامل حذف شود. */
  window.ptfChequeDelete = function (cd, opts) {
    opts = opts || {};
    var st = chFindStore(cd);
    if (!st) return { ok: false, why: 'notfound' };
    var c = st.rec;
    /* چک صادرهٔ مالی: payment مرتبط را کامل حذف کن */
    if (c.direction === 'issued' || c.ownership === 'company') {
      var d = getData('ptf_crm_supplier_finance');
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        var before = (d.payments || []).length;
        d.payments = (d.payments || []).filter(function (p) { return !(p.chequeCd === cd); });
        var removedPay = before - (d.payments || []).length;
        /* legacy payables وصل‌شده به این payment (via supplierPaymentCd) را پاک کن */
        if (removedPay) {
          var payCdSet = {};
          var payCd = c.supplierPaymentCd || '';
          if (payCd) payCdSet[payCd] = 1;
          (d.payments || []).forEach(function () {});
          var lp = getData('ptf_crm_payables');
          lp.forEach(function (p) { if (p.supplierPaymentCd && payCdSet[p.supplierPaymentCd]) { p.paid = (p.paid || []).filter(function (x) { return x.supplierPaymentCd !== p.supplierPaymentCd; }); } });
          setData('ptf_crm_payables', lp);
        }
        sfSave(d);
      }
    }
    /* چک را از آرایهٔ خودش حذف کن */
    st.list.splice(st.idx, 1);
    setData(st.key, st.list);
    try {
      if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(cd);
    } catch (eN) {}
    return { ok: true, removed: true, cd: cd };
  };

