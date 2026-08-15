/* =====================================================================
   PTF CRM — v34.7.18 — AR Reconcile Core (مطالبات: منبع واحد مانده و تسویه)
   مرجع: ARENA-AR-RECEIPT-INTEGRATION-RCA-2026-08-16.md

   چرا این فایل وجود دارد:
     سه پنل «مطالبات»، «حساب مشتریان» و «پرونده» هرکدام فرمول خصوصی خودشان را
     داشتند و گردش حساب با مدل نقدی و بقیه با مدل تخصیصی حساب می‌کردند؛ هر شکاف
     در تخصیص باعث می‌شد پولِ دریافت‌شده در یک نما دیده شود و در نمای دیگر نه.

   قواعد این لایه (کاملاً وفادار به معماری فعلی):
     • چیزی نمی‌نویسد. فقط می‌خواند و محاسبه می‌کند (به‌جز ابزار ترمیمِ صریحِ کاربر).
     • منبع پول = رسیدهای پرونده (ptf_crm_case_receipts) + پرداخت‌های میراثیِ
       مهاجرت‌نشدهٔ روی خود فاکتور (invoice.payments/pays) — دقیقاً همان تعریف
       PTF.invPaidSum، بدون تغییر معنا.
     • اگر تخصیصِ ذخیره‌شدهٔ سرور روی این دستگاه کهنه/نرسیده باشد، همان الگوریتم
       FIFO سرور به‌صورت محلی بازسازی می‌شود تا پول «ناپدید» نشود؛ رکوردی تغییر
       نمی‌کند و وضعیت با پرچم stale گزارش می‌شود.
   ===================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  W.PTF = W.PTF || {};
  if (W.PTF.ar) return;

  function n(v) { return +v || 0; }
  function list(k) { try { var v = W.getData ? W.getData(k) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function idOf(x) { return String((x && (x._id || x.cd)) || ''); }
  function statusOf(x) { return String((x && (x.status || x.st)) || '').toLowerCase(); }

  /* ---------- تعریف واحد «رکورد فعال» (R8) ----------
     پیش از این، پنل مطالبات فاکتور superseded را کنار می‌گذاشت ولی حساب مشتری آن را
     بدهی می‌شمرد؛ نتیجه دوباره‌شماری صورتحساب غیررسمیِ جایگزین‌شده بود. */
  var DEAD = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
  function activeRec(x) {
    if (!x) return false;
    if (DEAD.indexOf(statusOf(x)) > -1) return false;
    return !x.voided && !x.deleted;
  }
  function activeInvoice(i) { return activeRec(i); }
  function activeReceipt(r) { return !!r && activeRec(r) && String(r.status || '') === 'posted'; }

  /* ---------- سقف تخصیص فاکتور (R3) — آینهٔ sd_invoice_caps در api/sales-domain.php ---------- */
  function invoiceCaps(inv) {
    var base = Math.round(n(inv && (inv.base != null ? inv.base : inv.baseAmountIRR)));
    var vat = Math.round(n(inv && (inv.vat != null ? inv.vat : inv.vatAmountIRR)));
    var amount = Math.round(n(inv && (inv.amount != null ? inv.amount : inv.totalAmountIRR)));
    if (amount <= 0) amount = base + vat;
    var vatCap = Math.max(0, Math.min(vat, amount));
    return { amount: amount, base: Math.max(0, amount - vatCap), vat: vatCap };
  }

  /* ---------- پرداخت‌های میراثی روی فاکتور ---------- */
  function legacyRows(inv) { return ((inv && inv.payments) || []).concat((inv && inv.pays) || []); }
  function legacyActive(p) {
    if (!p) return false;
    if (W.PTF && typeof W.PTF.isPaymentActive === 'function') { if (!W.PTF.isPaymentActive(p)) return false; }
    else if (statusOf(p) === 'void' || statusOf(p) === 'reversal' || p.voided) return false;
    /* fromAdvance/migrated فقط Projection میراثی‌اند؛ پول واقعی‌شان از رسید می‌آید (v35). */
    if (W.PTF_SALES_DOMAIN_V2 && (p.fromAdvance || p.migratedToReceiptId || p.financialProjectionDisabled)) return false;
    return true;
  }
  function legacyPaidIRR(inv) {
    return legacyRows(inv).filter(legacyActive).reduce(function (s, p) {
      return s + (W.PTF && typeof W.PTF.paymentAmtIrr === 'function' ? n(W.PTF.paymentAmtIrr(p)) : (n(p.amountIrr) || n(p.amt) || n(p.amount)));
    }, 0);
  }

  /* ---------- اتصال فاکتور به پرونده (R2) ----------
     آینهٔ sd_bind_orphan_invoices: فقط تطبیق یکتای شمارهٔ پیشنهاد؛ هیچ حدسی زده نمی‌شود
     و هیچ رکوردی هم نوشته نمی‌شود (فقط برای محاسبهٔ نمایش). */
  function caseOfferNos(c) {
    var out = {};
    [c && c.wonOffer, c && c.offerNo].forEach(function (x) { var v = String(x || '').trim(); if (v) out[v] = true; });
    ((c && c.linkedOffers) || []).forEach(function (l) { var v = String((l && l.offerNo) || '').trim(); if (v) out[v] = true; });
    return out;
  }
  function resolveCaseIdOfInvoice(inv, cases) {
    var direct = String((inv && inv.caseId) || '').trim();
    if (direct) return { caseId: direct, bound: 'stored' };
    var ono = String((inv && inv.offerNo) || '').trim();
    if (!ono) return { caseId: '', bound: 'none' };
    var hits = (cases || []).filter(function (c) { return c && activeRec(c) && caseOfferNos(c)[ono]; });
    if (hits.length === 1) return { caseId: idOf(hits[0]), bound: 'auto-unique-offer' };
    return { caseId: '', bound: hits.length ? 'ambiguous' : 'none' };
  }

  /* ---------- بازسازی محلی تخصیص FIFO (آینهٔ sd_rebuild_allocations) ----------
     فقط محاسبه در حافظه؛ خروجی نقشهٔ invoiceKey → {base, vat} و بستانکاری هر رسید. */
  function computeAllocations(scope) {
    var cases = (scope && scope.cases) || list('ptf_crm_deals');
    var invoices = (scope && scope.invoices) || list('ptf_crm_invoices');
    var receipts = (scope && scope.receipts) || list('ptf_crm_case_receipts');
    var byCaseInv = {}, byCaseRcp = {}, invAlloc = {}, rcpCredit = {}, binding = {};

    invoices.forEach(function (i) {
      if (!activeInvoice(i)) return;
      var r = resolveCaseIdOfInvoice(i, cases);
      binding[idOf(i)] = r;
      if (!r.caseId) return;
      (byCaseInv[r.caseId] = byCaseInv[r.caseId] || []).push(i);
    });
    receipts.forEach(function (r) {
      if (!activeReceipt(r)) return;
      var cid = String(r.caseId || '');
      if (!cid) return;
      (byCaseRcp[cid] = byCaseRcp[cid] || []).push(r);
    });

    Object.keys(byCaseRcp).forEach(function (cid) {
      var invs = (byCaseInv[cid] || []).slice().sort(function (a, b) {
        return String(a.invDate || a.issueDate || a.t || '').localeCompare(String(b.invDate || b.issueDate || b.t || ''));
      });
      var rcps = byCaseRcp[cid].slice().sort(function (a, b) {
        return String(a.receivedAt || a.dateISO || a.t || '').localeCompare(String(b.receivedAt || b.dateISO || b.t || ''));
      });
      rcps.forEach(function (r) {
        var available = Math.round(n(r.amountIRR || r.amt));
        invs.forEach(function (inv) {
          if (available <= 0) return;
          var key = idOf(inv), caps = invoiceCaps(inv);
          var cur = invAlloc[key] || (invAlloc[key] = { base: 0, vat: 0 });
          var baseRoom = Math.max(0, caps.base - cur.base);
          if (baseRoom > 0) { var t1 = Math.min(available, baseRoom); cur.base += t1; available -= t1; }
          if (available > 0) {
            var vatRoom = Math.max(0, caps.vat - cur.vat);
            if (vatRoom > 0) { var t2 = Math.min(available, vatRoom); cur.vat += t2; available -= t2; }
          }
        });
        rcpCredit[idOf(r)] = available;
      });
    });
    return { invAlloc: invAlloc, rcpCredit: rcpCredit, binding: binding };
  }

  var _cache = null, _cacheAt = 0;
  function snapshot(force) {
    var now = Date.now();
    if (!force && _cache && now - _cacheAt < 1500) return _cache;
    _cache = computeAllocations(); _cacheAt = now;
    return _cache;
  }
  function invalidate() { _cache = null; _cacheAt = 0; }

  /* ---------- وضعیت یک فاکتور — تنها مرجع «مانده» ---------- */
  function invoiceState(inv, snap) {
    snap = snap || snapshot();
    var caps = invoiceCaps(inv);
    var stored = { base: n(inv && inv.allocatedBase), vat: n(inv && inv.allocatedVat) };
    var local = snap.invAlloc[idOf(inv)] || { base: 0, vat: 0 };
    /* اگر پروجکشن سرور نرسیده باشد (R6)، مقدار محلی بیشتر است و همان ملاک نمایش می‌شود
       تا پول ناپدید نشود؛ رکورد دست‌نخورده می‌ماند و فقط stale علامت می‌خورد. */
    var allocated = Math.max(stored.base + stored.vat, local.base + local.vat);
    var stale = Math.abs((stored.base + stored.vat) - (local.base + local.vat)) > 1;
    var legacy = legacyPaidIRR(inv);
    /* paid سقف‌گذاری نمی‌شود تا «اضافه‌پرداخت» مثل قبل به‌عنوان اعتبار مشتری دیده شود؛
       فقط open کف صفر دارد (رفتار قبلی customer-finance/rbac دقیقاً همین بود). */
    var paid = legacy + allocated;
    return {
      id: idOf(inv), no: (inv && (inv.no || inv.cd)) || '', caseId: (snap.binding[idOf(inv)] || {}).caseId || String((inv && inv.caseId) || ''),
      caseBinding: (snap.binding[idOf(inv)] || {}).bound || 'stored',
      active: activeInvoice(inv), billed: caps.amount, base: caps.base, vat: caps.vat,
      legacyPaid: legacy, allocatedStored: stored.base + stored.vat, allocatedLocal: local.base + local.vat,
      allocated: allocated, paid: paid, open: Math.max(0, caps.amount - paid),
      overPaid: Math.max(0, paid - caps.amount), stale: stale
    };
  }
  function invoicePaidIRR(inv) { return invoiceState(inv).paid; }
  function invoiceOpenIRR(inv) { return invoiceState(inv).open; }

  /* ---------- وضعیت پرونده ---------- */
  function caseState(caseRec) {
    var snap = snapshot(), cid = idOf(caseRec);
    var receipts = list('ptf_crm_case_receipts').filter(function (r) { return activeReceipt(r) && String(r.caseId || '') === cid; });
    var invoices = list('ptf_crm_invoices').filter(function (i) { return activeInvoice(i) && (snap.binding[idOf(i)] || {}).caseId === cid; });
    var received = receipts.reduce(function (s, r) { return s + n(r.amountIRR || r.amt); }, 0);
    var credit = receipts.reduce(function (s, r) {
      var localCredit = snap.rcpCredit[idOf(r)];
      return s + (localCredit == null ? n(r.creditRemainIRR) : localCredit);
    }, 0);
    var open = invoices.reduce(function (s, i) { return s + invoiceState(i, snap).open; }, 0);
    return { caseId: cid, received: received, allocated: Math.max(0, received - credit), credit: credit, open: open, receipts: receipts, invoices: invoices };
  }

  /* ---------- وضعیت مشتری ---------- */
  function customerInvoices(cd) {
    var snap = snapshot();
    var offers = list('ptf_crm_offers');
    var cases = list('ptf_crm_deals');
    var myCases = {};
    cases.forEach(function (c) { if (c && String(c.buyerCd || '') === String(cd)) myCases[idOf(c)] = true; });
    return list('ptf_crm_invoices').filter(function (i) {
      if (!activeInvoice(i)) return false;
      if (String(i.customerId || i.buyerCd || '') === String(cd)) return true;
      var b = (snap.binding[idOf(i)] || {}).caseId;
      if (b && myCases[b]) return true;
      var o = offers.filter(function (x) { return x && x.no === i.offerNo; })[0];
      return !!(o && String(o.buyerCd || '') === String(cd));
    });
  }
  function customerPosition(cd) {
    var snap = snapshot();
    var invoices = customerInvoices(cd);
    var billed = 0, paid = 0, open = 0;
    invoices.forEach(function (i) { var st = invoiceState(i, snap); billed += st.billed; paid += st.paid; open += st.open; });
    var myCases = {};
    list('ptf_crm_deals').forEach(function (c) { if (c && String(c.buyerCd || '') === String(cd)) myCases[idOf(c)] = true; });
    var credit = list('ptf_crm_case_receipts').reduce(function (s, r) {
      if (!activeReceipt(r)) return s;
      if (String(r.customerId || '') !== String(cd) && !myCases[String(r.caseId || '')]) return s;
      var localCredit = snap.rcpCredit[idOf(r)];
      return s + (localCredit == null ? n(r.creditRemainIRR) : localCredit);
    }, 0);
    return { customerCd: cd, billed: billed, paid: paid, open: open, credit: credit,
      net: Math.max(0, open - credit), netCredit: Math.max(0, credit - open), invoices: invoices.length };
  }

  /* ---------- گزارش تسویه (فاز ۰) — فقط‌خواندنی ---------- */
  var CATEGORIES = {
    vat_unallocated: 'ارزش‌افزودهٔ تخصیص‌نیافته (پیش‌پرداخت پیش از فاکتور)',
    invoice_without_case: 'فاکتور بدون پرونده — دریافت پرونده از آن کسر نمی‌شود',
    amount_split_mismatch: 'ناسازگاری مبلغ فاکتور با پایه + ارزش‌افزوده',
    legacy_payment_no_receipt: 'وصولی میراثی بدون رسید پرونده (مسیر مطالبات/چک)',
    stale_allocation: 'تخصیص کهنه/نرسیده روی این دستگاه',
    superseded_counted: 'صورتحساب جایگزین‌شده که هنوز در حساب مشتری بدهی می‌سازد',
    unapplied_credit: 'بستانکاری تخصیص‌نیافته در کنار مطالبهٔ باز همان مشتری',
    possible_double_money: 'احتمال ثبت دوبارهٔ یک پول (وصولی میراثی + رسید هم‌مبلغ)'
  };
  function reconcile() {
    invalidate();
    var snap = snapshot(true);
    var invoices = list('ptf_crm_invoices');
    var receipts = list('ptf_crm_case_receipts');
    var findings = [];
    function push(cat, sev, ref, label, amount, extra) {
      findings.push(Object.assign({ category: cat, categoryLabel: CATEGORIES[cat] || cat, severity: sev, ref: ref, label: label, amount: n(amount) }, extra || {}));
    }
    invoices.forEach(function (inv) {
      var key = idOf(inv), st = invoiceState(inv, snap), caps = invoiceCaps(inv);
      if (!activeInvoice(inv)) {
        if (statusOf(inv) === 'superseded' && legacyPaidIRR(inv) === 0)
          push('superseded_counted', 'medium', key, 'فاکتور ' + (inv.no || key) + ' جایگزین شده است و نباید بدهی بسازد', caps.amount);
        return;
      }
      var basePlusVat = Math.round(n(inv.base)) + Math.round(n(inv.vat));
      if (caps.amount > 0 && Math.round(n(inv.amount)) > 0 && basePlusVat !== Math.round(n(inv.amount)))
        push('amount_split_mismatch', 'high', key, 'فاکتور ' + (inv.no || key) + ': مبلغ ' + caps.amount.toLocaleString('fa-IR') + ' با پایه+ارزش‌افزوده (' + basePlusVat.toLocaleString('fa-IR') + ') نمی‌خواند', Math.abs(caps.amount - basePlusVat));
      if (!String(inv.caseId || '').trim())
        push('invoice_without_case', st.caseId ? 'medium' : 'high', key,
          'فاکتور ' + (inv.no || key) + ' پرونده ندارد' + (st.caseId ? ' (تطبیق یکتا پیشنهاد شد)' : ''), st.open,
          { suggestedCaseId: st.caseId, binding: st.caseBinding });
      if (st.stale)
        push('stale_allocation', 'high', key, 'تخصیص فاکتور ' + (inv.no || key) + ' با محاسبهٔ محلی هم‌خوان نیست (پروجکشن سرور نرسیده)', Math.abs(st.allocatedLocal - st.allocatedStored),
          { stored: st.allocatedStored, local: st.allocatedLocal });
      /* VAT تخصیص‌نیافته در حالی که پول کافی در پرونده هست */
      var localAlloc = snap.invAlloc[key] || { base: 0, vat: 0 };
      if (caps.vat > 0 && n(inv.allocatedVat) === 0 && localAlloc.vat > 0)
        push('vat_unallocated', 'high', key, 'ارزش‌افزودهٔ فاکتور ' + (inv.no || key) + ' با وجود دریافت کافی، تخصیص نگرفته است', localAlloc.vat);
      legacyRows(inv).filter(legacyActive).forEach(function (p) {
        var amt = n(p.amountIrr) || n(p.amt) || n(p.amount);
        if (amt <= 0) return;
        push('legacy_payment_no_receipt', 'low', key, 'وصولی ' + (p.cd || '') + ' فاکتور ' + (inv.no || key) + ' فقط روی فاکتور ثبت شده و رسید پرونده ندارد', amt, { paymentCd: p.cd || '', how: p.how || '' });
        var twin = receipts.filter(function (r) { return activeReceipt(r) && String(r.caseId || '') === st.caseId && Math.abs(n(r.amountIRR || r.amt) - amt) < 1; })[0];
        if (twin) push('possible_double_money', 'high', key, 'مبلغ ' + amt.toLocaleString('fa-IR') + ' هم به‌صورت وصولی فاکتور و هم رسید پرونده ثبت شده است', amt, { receiptId: idOf(twin) });
      });
    });
    /* بستانکاری بلااستفاده در کنار مطالبهٔ باز همان مشتری */
    var byCustomer = {};
    receipts.forEach(function (r) {
      if (!activeReceipt(r)) return;
      var credit = snap.rcpCredit[idOf(r)] == null ? n(r.creditRemainIRR) : snap.rcpCredit[idOf(r)];
      if (credit <= 0) return;
      var cd = String(r.customerId || '');
      byCustomer[cd] = (byCustomer[cd] || 0) + credit;
    });
    Object.keys(byCustomer).forEach(function (cd) {
      if (!cd) return;
      var pos = customerPosition(cd);
      if (pos.open > 0 && byCustomer[cd] > 0)
        push('unapplied_credit', 'medium', cd, 'مشتری ' + cd + ' هم‌زمان ' + pos.open.toLocaleString('fa-IR') + ' مطالبهٔ باز و ' + byCustomer[cd].toLocaleString('fa-IR') + ' بستانکاری دارد', Math.min(pos.open, byCustomer[cd]));
    });
    var summary = {};
    findings.forEach(function (f) { summary[f.category] = (summary[f.category] || 0) + 1; });
    return { at: new Date().toISOString(), findings: findings, summary: summary, categories: CATEGORIES, total: findings.length };
  }

  W.PTF.ar = {
    version: 'v34.7.18',
    activeInvoice: activeInvoice, activeReceipt: activeReceipt,
    invoiceCaps: invoiceCaps, legacyPaidIRR: legacyPaidIRR,
    computeAllocations: computeAllocations, snapshot: snapshot, invalidate: invalidate,
    invoiceState: invoiceState, invoicePaidIRR: invoicePaidIRR, invoiceOpenIRR: invoiceOpenIRR,
    caseState: caseState, customerInvoices: customerInvoices, customerPosition: customerPosition,
    resolveCaseIdOfInvoice: resolveCaseIdOfInvoice, reconcile: reconcile, CATEGORIES: CATEGORIES
  };
})();

/* =====================================================================
   PTF CRM — v34.7.18 — رابط کاربری گزارش تسویهٔ مطالبات (فاز ۰)
   فقط‌خواندنی: هیچ رکوردی از این پنجره تغییر نمی‌کند مگر ابزار «اتصال به پرونده»
   که صریحاً توسط کاربر و فقط برای تطبیق یکتا اجرا می‌شود.
   ===================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  function esc(v) { return typeof W.escP === 'function' ? W.escP(v == null ? '' : v) : String(v == null ? '' : v); }
  function arg(v) { return typeof W.ptfOnClickArg === 'function' ? W.ptfOnClickArg(v) : String(v == null ? '' : v).replace(/'/g, "\\'"); }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function canSee() {
    try { return typeof curRole !== 'function' || ['admin', 'chairman', 'ceo', 'commercial', 'accountant'].indexOf(curRole()) > -1; } catch (e) { return false; }
  }
  var SEV = { high: '#dc2626', medium: '#b45309', low: '#0369a1' };

  W.ptfArReconcileOpen = function () {
    if (!canSee()) { alert('⛔ گزارش تسویهٔ مطالبات فقط برای نقش‌های مالی/ارشد است.'); return; }
    var rep = W.PTF.ar.reconcile();
    var groups = {};
    rep.findings.forEach(function (f) { (groups[f.category] = groups[f.category] || []).push(f); });
    var body = Object.keys(groups).map(function (cat) {
      var rows = groups[cat];
      var sum = rows.reduce(function (s, r) { return s + (+r.amount || 0); }, 0);
      var items = rows.slice(0, 40).map(function (r) {
        var fix = '';
        if (r.category === 'invoice_without_case' && r.suggestedCaseId)
          fix = ' <button class="bt bt-o" style="font-size:10.5px;padding:2px 7px" onclick="ptfArBindInvoiceCase(\'' + arg(r.ref) + '\')">🔗 اتصال به پروندهٔ پیشنهادی</button>';
        if (r.category === 'stale_allocation')
          fix = ' <button class="bt bt-o" style="font-size:10.5px;padding:2px 7px" onclick="ptfArPullAndRefresh()">🔄 همگام‌سازی مجدد</button>';
        return '<div style="padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:12px">• ' + esc(r.label) +
          (r.amount ? ' <b style="color:' + (SEV[r.severity] || '#334155') + '">(' + money(r.amount) + ')</b>' : '') + fix + '</div>';
      }).join('');
      return '<details style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin-bottom:7px">' +
        '<summary style="cursor:pointer;font-weight:800;color:' + (SEV[rows[0].severity] || '#334155') + '">' + esc(rows[0].categoryLabel) + ' — ' + rows.length + ' مورد' + (sum ? ' — ' + money(sum) : '') + '</summary>' +
        '<div style="padding-top:6px">' + items + (rows.length > 40 ? '<small style="color:#94a3b8">۴۰ مورد اول نمایش داده شد.</small>' : '') + '</div></details>';
    }).join('');
    document.querySelectorAll('#ptfArReconcileDlg').forEach(function (x) { x.remove(); });
    var html = '<div class="md-b" id="ptfArReconcileDlg" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>🧮 تسویهٔ مطالبات — مطالبات / حساب مشتری / پرونده</h3>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">این گزارش فقط‌خواندنی است و اختلاف بین سه نما را نشان می‌دهد. هیچ مبلغی از اینجا تغییر نمی‌کند.</div>' +
      '<div style="margin:10px 0;border-radius:10px;padding:8px 11px;font-size:12.5px;background:' + (rep.total ? '#fff7ed;border:1px solid #fed7aa;color:#9a3412' : '#ecfdf5;border:1px solid #bbf7d0;color:#065f46') + '">' +
      (rep.total ? '⚠️ ' + rep.total + ' مورد اختلاف/ریسک شناسایی شد' : '✅ هیچ اختلافی بین سه نما یافت نشد') + '</div>' +
      (body || '') +
      '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="ptfArReconcileOpen()">🔄 بازخوانی</button> ' +
      '<button class="bt bt-o" onclick="navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(PTF.ar.reconcile()))">📋 کپی گزارش</button> ' +
      '<button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    try { if (typeof audit === 'function') audit('مطالبات', 'مشاهدهٔ گزارش تسویهٔ مطالبات (' + rep.total + ' مورد)', ''); } catch (e) {}
  };

  /* ابزار ترمیم صریح: اتصال فاکتور بی‌پرونده به پروندهٔ پیشنهادی (فقط تطبیق یکتا) */
  W.ptfArBindInvoiceCase = function (invoiceKey) {
    try { if (typeof isSenior === 'function' && !isSenior() && (typeof curRole !== 'function' || ['accountant'].indexOf(curRole()) < 0)) { alert('⛔ دسترسی ندارید'); return; } } catch (e) {}
    var invs = getData('ptf_crm_invoices') || [];
    var inv = invs.filter(function (i) { return String(i._id || i.cd || '') === String(invoiceKey); })[0];
    if (!inv) { alert('فاکتور یافت نشد'); return; }
    if (String(inv.caseId || '').trim()) { alert('این فاکتور از قبل به پرونده متصل است.'); return; }
    var r = W.PTF.ar.resolveCaseIdOfInvoice(inv, getData('ptf_crm_deals') || []);
    if (!r.caseId) { alert('⛔ پروندهٔ یکتا برای این فاکتور پیدا نشد؛ اتصال خودکار انجام نمی‌شود.'); return; }
    var c = (getData('ptf_crm_deals') || []).filter(function (x) { return String(x._id || x.cd || '') === r.caseId; })[0] || {};
    if (!confirm('اتصال فاکتور ' + (inv.no || inv.cd) + ' به پروندهٔ ' + (c.inqNo || c.wonOffer || r.caseId) + '؟\n\nفقط شناسهٔ پرونده روی فاکتور ثبت می‌شود؛ هیچ مبلغی تغییر نمی‌کند و تخصیص با قواعد موجود بازسازی خواهد شد.')) return;
    inv.caseId = r.caseId;
    if (!inv.customerId) inv.customerId = c.buyerCd || '';
    inv.caseBoundBy = 'manual-reconcile'; inv.caseBoundAt = new Date().toISOString();
    if (setData('ptf_crm_invoices', invs) === false) { alert('⛔ ذخیره نشد؛ دوباره تلاش کنید.'); return; }
    try { if (typeof audit === 'function') audit('مطالبات', 'اتصال فاکتور ' + (inv.no || inv.cd) + ' به پروندهٔ ' + r.caseId + ' از گزارش تسویه', inv.cd || ''); } catch (e) {}
    W.PTF.ar.invalidate();
    if (typeof ptfToast === 'function') ptfToast('✅ فاکتور به پرونده متصل شد', 'ok');
    if (typeof renderReceivables === 'function') renderReceivables();
    W.ptfArReconcileOpen();
  };

  W.ptfArPullAndRefresh = function () {
    W.PTF.ar.invalidate();
    if (typeof W.ptfSyncPullNow === 'function') W.ptfSyncPullNow(function () { W.PTF.ar.invalidate(); W.ptfArReconcileOpen(); });
    else W.ptfArReconcileOpen();
  };
})();
