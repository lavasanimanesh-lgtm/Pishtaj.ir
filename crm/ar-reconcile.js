/* =====================================================================
   PTF CRM — v34.8.0 — AR Reconcile Core (مطالبات: منبع واحد مانده و تسویه)
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

  /* ---------- شناسهٔ متعارف پرونده (ممیزی v34.7.26) ----------
     رکوردهای قدیمی گاهی caseId را با `cd` پرونده ذخیره کرده‌اند در حالی که همان پرونده
     `_id` سروری هم دارد؛ چون همه‌جا کلید گروه‌بندی `_id||cd` است، رسید و فاکتورِ یک پرونده
     در دو سطل جدا می‌افتادند و تخصیص هرگز انجام نمی‌شد («پول دیده نمی‌شود»).
     این نگاشت فقط نام‌های مستعارِ اثبات‌شدهٔ یک رکورد را به شناسهٔ متعارف همان رکورد
     ترجمه می‌کند؛ هیچ حدسی زده نمی‌شود و چیزی نوشته نمی‌شود. */
  function caseAliasMap(cases) {
    var map = {};
    (cases || []).forEach(function (c) {
      if (!c) return;
      var canon = idOf(c); if (!canon) return;
      [c._id, c.cd].forEach(function (a) { var k = String(a || ''); if (k) map[k] = canon; });
    });
    return map;
  }

  /* ---------- مالک leak-safe پرونده/وصول ----------
     پرونده‌های قدیمی الزاماً buyerCd ندارند. مالکیت را فقط از شواهدی می‌پذیریم که
     به خود همان پرونده وصل‌اند: شناسهٔ صریح، پیشنهاد ریشه/برنده، فاکتور و Receipt.
     اگر دو شناسهٔ متفاوت دیده شود هیچ‌کدام برنده نمی‌شود؛ این رفتار عمداً محافظه‌کار
     است تا اعتبار یک مشتری به‌دلیل دادهٔ متعارض به مشتری دیگری نشت نکند. نام شرکت
     فقط آخرین fallback است و فقط وقتی به دقیقاً یک customer یکتا برسد. */
  function normalizePartyName(v) {
    return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase();
  }
  function customerRecordId(c) { return String((c && (c._id || c.cd)) || '').trim(); }
  /* cd قدیمی و _id سروریِ یک Customer دو مشتری نیستند. evidence ابتدا روی رکورد
     Customer یکتا canonical می‌شود؛ در نتیجه Sync تدریجی باعث conflict کاذب یا
     ناپدیدشدن اعتبار نمی‌شود. اگر یک alias واقعاً به چند رکورد بخورد، همهٔ مالک‌ها
     candidate می‌مانند و resolver طبق قاعدهٔ leak-safe آن را ambiguous می‌کند. */
  function customerCandidatesForId(value, customers) {
    var raw = String(value || '').trim(); if (!raw) return [];
    var found = {};
    (customers || []).forEach(function (c) {
      if (!c) return;
      if (String(c._id || '').trim() !== raw && String(c.cd || '').trim() !== raw) return;
      var canonical = customerRecordId(c); if (canonical) found[canonical] = true;
    });
    var ids = Object.keys(found);
    return ids.length ? ids : [raw];
  }
  function sameCustomerId(left, right, customers) {
    var a = customerCandidatesForId(left, customers), b = customerCandidatesForId(right, customers);
    /* alias مشترک بین چند Customer خودش مبهم است و حتی با مقایسهٔ ظاهراً برابر
       نباید حساب‌های آن رکوردها را با هم جمع کند. */
    return a.length === 1 && b.length === 1 && a[0] === b[0];
  }
  function caseOfferRefs(c) {
    var ids = {}, nos = {};
    [c && c.rootOfferId].forEach(function (v) { v = String(v || '').trim(); if (v) ids[v] = true; });
    [c && c.wonOffer, c && c.offerNo].forEach(function (v) { v = String(v || '').trim(); if (v) nos[v] = true; });
    ((c && c.linkedOffers) || []).forEach(function (l) {
      if (!l) return;
      var id = String(l.offerId || l._id || '').trim(), no = String(l.offerNo || l.no || '').trim();
      if (id) ids[id] = true; if (no) nos[no] = true;
    });
    return { ids: ids, nos: nos };
  }
  function offerLinkedToCase(o, refs) {
    if (!o) return false;
    var oid = String(o._id || o.cd || '').trim(), no = String(o.no || '').trim();
    return !!((oid && refs.ids[oid]) || (no && refs.nos[no]));
  }
  function resolveCaseCustomer(caseOrId, scope) {
    scope = scope || {};
    var cases = Array.isArray(scope.cases) ? scope.cases : list('ptf_crm_deals');
    var offers = Array.isArray(scope.offers) ? scope.offers : list('ptf_crm_offers');
    var invoices = Array.isArray(scope.invoices) ? scope.invoices : list('ptf_crm_invoices');
    var receipts = Array.isArray(scope.receipts) ? scope.receipts : list('ptf_crm_case_receipts');
    var customers = Array.isArray(scope.customers) ? scope.customers : list('ptf_crm_customers');
    var c = caseOrId;
    if (!c || typeof c !== 'object') {
      var wanted = String(caseOrId || '');
      c = cases.filter(function (x) { return x && wanted && (String(x._id || '') === wanted || String(x.cd || '') === wanted); })[0] || null;
    }
    if (!c) return { status: 'unresolved', customerId: '', bound: 'case-not-found', candidates: [], evidence: {} };

    var aliases = {}, candidates = {}, evidence = {}, names = {};
    [c._id, c.cd].forEach(function (v) { v = String(v || '').trim(); if (v) aliases[v] = true; });
    function addId(v, source) {
      customerCandidatesForId(v, customers).forEach(function (id) {
        candidates[id] = true; (evidence[id] = evidence[id] || []).push(source);
      });
    }
    function addName(v, source) {
      var k = normalizePartyName(v); if (!k) return;
      (names[k] = names[k] || []).push(source);
    }

    addId(c.buyerCd, 'case'); addId(c.customerId, 'case'); addName(c.buyerCo || c.customerName, 'case');
    var refs = caseOfferRefs(c), linkedOffers = offers.filter(function (o) { return activeRec(o) && offerLinkedToCase(o, refs); });
    linkedOffers.forEach(function (o) { addId(o.buyerCd, 'offer'); addId(o.customerId, 'offer'); addName(o.buyerCo || o.customerName, 'offer'); });
    invoices.forEach(function (i) {
      if (!activeInvoice(i)) return;
      var storedCase = aliases[String(i.caseId || '')];
      var offerNo = String(i.offerNo || '').trim(), uniqueOfferBind = false;
      if (!storedCase && !String(i.caseId || '').trim() && offerNo && refs.nos[offerNo]) {
        var matchingCases = cases.filter(function (candidate) { return activeRec(candidate) && caseOfferRefs(candidate).nos[offerNo]; });
        uniqueOfferBind = matchingCases.length === 1 && !!aliases[idOf(matchingCases[0])];
      }
      if (!storedCase && !uniqueOfferBind) return;
      addId(i.customerId, 'invoice'); addId(i.buyerCd, 'invoice'); addName(i.buyerCo || i.customerName, 'invoice');
    });
    receipts.forEach(function (r) {
      if (!activeReceipt(r) || !aliases[String(r.caseId || '')]) return;
      addId(r.customerId, 'receipt'); addId(r.buyerCd, 'receipt'); addName(r.buyerCo || r.customerName, 'receipt');
    });

    var ids = Object.keys(candidates);
    if (ids.length > 1) return { status: 'ambiguous', customerId: '', bound: 'conflicting-identifiers', candidates: ids.sort(), evidence: evidence };
    if (ids.length === 1) {
      var sources = evidence[ids[0]] || [], bound = sources.indexOf('case') > -1 ? 'case' : (sources.indexOf('offer') > -1 ? 'offer' : 'case-document');
      return { status: 'resolved', customerId: ids[0], bound: bound, candidates: ids, evidence: evidence };
    }

    var nameKeys = Object.keys(names);
    if (!nameKeys.length) return { status: 'unresolved', customerId: '', bound: 'no-evidence', candidates: [], evidence: evidence };
    var owners = {};
    customers.forEach(function (customer) {
      var id = customerRecordId(customer); if (!id) return;
      [customer.co || customer.name, customer.coEn].forEach(function (v) {
        var k = normalizePartyName(v); if (k && names[k]) owners[id] = true;
      });
    });
    var ownerIds = Object.keys(owners);
    /* چند نام متفاوت در اسناد همان پرونده فقط وقتی قابل قبول است که هر کدام واقعاً
       alias همان customer یکتا باشد؛ نام ناشناخته کنار نام شناخته‌شده نادیده گرفته نمی‌شود. */
    var allNamesMappedToOnlyOwner = ownerIds.length === 1 && nameKeys.every(function (nameKey) {
      return customers.some(function (customer) {
        if (customerRecordId(customer) !== ownerIds[0]) return false;
        return [customer.co || customer.name, customer.coEn].some(function (v) { return normalizePartyName(v) === nameKey; });
      });
    });
    if (allNamesMappedToOnlyOwner) return { status: 'resolved', customerId: ownerIds[0], bound: 'unique-name', candidates: ownerIds, evidence: evidence };
    if (ownerIds.length || nameKeys.length > 1) return { status: 'ambiguous', customerId: '', bound: 'ambiguous-name', candidates: ownerIds.sort(), evidence: evidence };
    return { status: 'unresolved', customerId: '', bound: 'name-not-found', candidates: [], evidence: evidence };
  }

  /* ---------- بازسازی محلی تخصیص FIFO (آینهٔ sd_rebuild_allocations) ----------
     فقط محاسبه در حافظه؛ خروجی نقشهٔ invoiceKey → {base, vat} و بستانکاری هر رسید. */
  /* بعضی Receiptهای بسیار قدیمی هیچ‌کدام از cd/_id را ندارند. کلید '' برای همهٔ
     آن‌ها مشترک بود و اعتبار آخرین رسید روی بقیه می‌افتاد. fingerprint فقط fallback
     است؛ اگر دو ردیف واقعاً یکسان باشند، پایین‌تر جمع/تعداد نگه می‌داریم تا مجموع
     اعتبارشان دقیق بماند و هیچ مبلغی به‌علت collision حذف یا دوباره‌شماری نشود. */
  function anonymousReceiptKey(r) {
    return JSON.stringify([
      String((r && r.caseId) || ''), String((r && r.customerId) || ''), Math.round(n(r && (r.amountIRR || r.amt))),
      String((r && (r.receivedAt || r.dateISO || r.t || r.dateFa)) || ''),
      String((r && (r.referenceNo || r.refNo || r.trackingNo)) || ''),
      String((r && (r.method || r.how || r.bankAccount || r.createdAt || r.by)) || '')
    ]);
  }
  function computeAllocations(scope) {
    var cases = (scope && scope.cases) || list('ptf_crm_deals');
    var offers = (scope && scope.offers) || list('ptf_crm_offers');
    var customers = (scope && scope.customers) || list('ptf_crm_customers');
    var invoices = (scope && scope.invoices) || list('ptf_crm_invoices');
    var receipts = (scope && scope.receipts) || list('ptf_crm_case_receipts');
    var byCaseInv = {}, byCaseRcp = {}, invAlloc = {}, rcpCredit = {}, rcpCreditAnon = {}, binding = {}, caseOwners = {}, caseOwnerAliases = {};
    var alias = caseAliasMap(cases);
    function canon(id) { var k = String(id || ''); return alias[k] || k; }

    var ownerScope = { cases: cases, offers: offers, invoices: invoices, receipts: receipts, customers: customers };
    cases.forEach(function (c) {
      var cid = idOf(c); if (!cid) return;
      var owner = resolveCaseCustomer(c, ownerScope);
      caseOwners[cid] = owner;
      [c._id, c.cd].forEach(function (v) { var k = String(v || ''); if (k) caseOwnerAliases[k] = owner; });
    });

    invoices.forEach(function (i) {
      if (!activeInvoice(i)) return;
      var r = resolveCaseIdOfInvoice(i, cases);
      r = { caseId: canon(r.caseId), bound: r.bound };
      binding[idOf(i)] = r;
      if (!r.caseId) return;
      (byCaseInv[r.caseId] = byCaseInv[r.caseId] || []).push(i);
    });
    receipts.forEach(function (r) {
      if (!activeReceipt(r)) return;
      var cid = canon(r.caseId);
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
        var receiptId = idOf(r);
        if (receiptId) rcpCredit[receiptId] = available;
        else {
          var anonKey = anonymousReceiptKey(r);
          var bucket = rcpCreditAnon[anonKey] || (rcpCreditAnon[anonKey] = { total: 0, count: 0 });
          bucket.total += available; bucket.count++;
        }
      });
    });
    return { invAlloc: invAlloc, rcpCredit: rcpCredit, rcpCreditAnon: rcpCreditAnon, binding: binding, caseOwners: caseOwners, caseOwnerAliases: caseOwnerAliases };
  }

  var _cache = null, _cacheSignature = '';
  /* TTL به‌تنهایی باعث می‌شد Sync/ویرایش همان لحظه تا ۱٫۵ ثانیه مالک قبلی را نشان دهد.
     signature باید Offers و Customers را هم ببیند، چون هر دو در resolve مالک legacy
     دخیل‌اند. JSON کامل عمداً انتخاب شده تا حذف رکورد یا تغییر فیلدهای nested نیز cache
     را بی‌درنگ باطل کند؛ محاسبهٔ FIFO فقط وقتی signature واقعاً عوض شود تکرار می‌شود. */
  function allocationSignature() {
    try {
      return JSON.stringify([
        list('ptf_crm_deals'), list('ptf_crm_offers'), list('ptf_crm_customers'),
        list('ptf_crm_invoices'), list('ptf_crm_case_receipts')
      ]);
    } catch (e) { return String(Date.now()) + ':' + Math.random(); }
  }
  function snapshot(force) {
    var sig = allocationSignature();
    if (!force && _cache && sig === _cacheSignature) return _cache;
    _cache = computeAllocations(); _cacheSignature = sig;
    return _cache;
  }
  function invalidate() { _cache = null; _cacheSignature = ''; }
  function receiptFreeCreditIRR(r, snap) {
    snap = snap || snapshot();
    var key = idOf(r);
    if (key && Object.prototype.hasOwnProperty.call(snap.rcpCredit, key)) return Math.max(0, n(snap.rcpCredit[key]));
    if (!key && r && String(r.caseId || '')) {
      var anon = snap.rcpCreditAnon && snap.rcpCreditAnon[anonymousReceiptKey(r)];
      /* ردیف‌های کاملاً همسان و بی‌شناسه از هم قابل تفکیک نیستند؛ سهم میانگین باعث
         می‌شود reduce همان scope، جمع واقعی bucket را دقیقاً یک‌بار بازسازی کند. */
      if (anon && anon.count) return Math.max(0, n(anon.total) / anon.count);
    }
    /* رسید customer-level/legacy که caseId ندارد اصلاً قابل تخصیص FIFO نیست؛ پس کل
       مبلغ آن آزاد است، حتی اگر projection مشتق‌شدهٔ قدیمی صفر/ناقص مانده باشد. */
    if (!r || !String(r.caseId || '')) return Math.max(0, n(r && (r.amountIRR || r.amt)));
    if (r.creditRemainIRR != null && r.creditRemainIRR !== '') return Math.max(0, n(r.creditRemainIRR));
    return Math.max(0, n(r.amountIRR || r.amt));
  }

  /* ---------- مرجوعی فروش (LC-02) — منبع واحد ----------
     همان قاعدهٔ مقاوم customer-finance.js (نسخهٔ v33.12.0) این‌جا متمرکز شده تا سود،
     پورسانت، سرمایه در گردش و سال مالی هم بتوانند بدون تکرار منطق از آن استفاده کنند.
     قواعد (بدون دوباره‌شماری):
       ۱) اگر مرجوعی invoiceCd دارد → فقط با همان فاکتور تطبیق می‌خورد.
       ۲) اگر ندارد: ابتدا invoiceNo، سپس offerNo — و offerNo فقط وقتی معتبر است که
          همان پیشنهاد دقیقاً یک فاکتور فعال داشته باشد (یکتایی). */
  function invoiceOfOfferUnique(offerNo) {
    if (!offerNo) return null;
    var hits = list('ptf_crm_invoices').filter(function (i) { return activeInvoice(i) && String(i.offerNo || '') === String(offerNo); });
    return hits.length === 1 ? hits[0] : null;
  }
  function salesReturnsForInvoice(inv) {
    if (!inv) return [];
    var aliases = {}; [inv._id, inv.cd].forEach(function (v) { var k = String(v || ''); if (k) aliases[k] = true; });
    var no = inv.no, offerNo = inv.offerNo;
    return list('ptf_crm_sales_returns').filter(function (r) {
      if (!r || statusOf(r) === 'void') return false;
      if (r.invoiceCd && aliases[String(r.invoiceCd)]) return true;
      if (r.invoiceCd) return false;
      if (no && r.invoiceNo && String(r.invoiceNo) === String(no)) return true;
      if (offerNo && r.offerNo && String(r.offerNo) === String(offerNo)) {
        var single = invoiceOfOfferUnique(offerNo);
        return !!single && !!aliases[idOf(single)];
      }
      return false;
    });
  }
  function returnedAmountIRR(inv) {
    return salesReturnsForInvoice(inv).reduce(function (s, r) { return s + n(r.totalAmount); }, 0);
  }
  /** خالص فاکتور پس از مرجوعی — مبنای واحد سود/پورسانت/سرمایه در گردش/سال مالی */
  function invoiceNetAfterReturnsIRR(inv) {
    var caps = invoiceCaps(inv);
    return Math.max(0, caps.amount - returnedAmountIRR(inv));
  }

  /* ---------- وضعیت یک فاکتور — تنها مرجع «مانده» ---------- */
  function invoiceState(inv, snap) {
    snap = snap || snapshot();
    var caps = invoiceCaps(inv);
    var returnedRaw = Math.max(0, returnedAmountIRR(inv));
    /* مرجوعی هیچ‌گاه مبلغ خالص سند را منفی نمی‌کند. مقدار خام جدا نگه داشته می‌شود
       تا دادهٔ ناسالم (مرجوعی بیش از فاکتور) در ممیزی قابل تشخیص بماند. */
    var returned = Math.min(caps.amount, returnedRaw);
    var netBilled = Math.max(0, caps.amount - returned);
    var stored = { base: n(inv && inv.allocatedBase), vat: n(inv && inv.allocatedVat) };
    var local = snap.invAlloc[idOf(inv)] || { base: 0, vat: 0 };
    /* اگر پروجکشن سرور نرسیده باشد (R6)، مقدار محلی بیشتر است و همان ملاک نمایش می‌شود
       تا پول ناپدید نشود؛ رکورد دست‌نخورده می‌ماند و فقط stale علامت می‌خورد. */
    var allocated = Math.max(stored.base + stored.vat, local.base + local.vat);
    var stale = Math.abs((stored.base + stored.vat) - (local.base + local.vat)) > 1;
    var legacy = legacyPaidIRR(inv);
    /* paid مبلغ خام تخصیص‌یافته/میراثی است و سقف‌گذاری نمی‌شود؛ applied بخشی است که
       واقعاً سند خالص را تسویه کرده و مازاد دقیقاً یک‌بار در overPaid می‌آید. */
    var paid = legacy + allocated;
    var applied = Math.min(netBilled, paid);
    return {
      id: idOf(inv), no: (inv && (inv.no || inv.cd)) || '', caseId: (snap.binding[idOf(inv)] || {}).caseId || String((inv && inv.caseId) || ''),
      caseBinding: (snap.binding[idOf(inv)] || {}).bound || 'stored',
      active: activeInvoice(inv), grossBilled: caps.amount, returned: returned, returnedRaw: returnedRaw,
      billed: netBilled, base: caps.base, vat: caps.vat,
      legacyPaid: legacy, allocatedStored: stored.base + stored.vat, allocatedLocal: local.base + local.vat,
      allocated: allocated, paid: paid, applied: applied, open: Math.max(0, netBilled - paid),
      overPaid: Math.max(0, paid - netBilled), stale: stale
    };
  }
  function invoicePaidIRR(inv) { return invoiceState(inv).paid; }
  function invoiceOpenIRR(inv) { return invoiceState(inv).open; }

  /* ---------- وضعیت پرونده ---------- */
  function caseState(caseRec) {
    var snap = snapshot(), cid = idOf(caseRec);
    /* ممیزی v34.7.26: رسیدی که با نام مستعار دیگرِ همین پرونده ذخیره شده هم دیده می‌شود. */
    var aliases = {}; [caseRec && caseRec._id, caseRec && caseRec.cd].forEach(function (a) { var k = String(a || ''); if (k) aliases[k] = true; });
    var receipts = list('ptf_crm_case_receipts').filter(function (r) { return activeReceipt(r) && aliases[String(r.caseId || '')]; });
    var invoices = list('ptf_crm_invoices').filter(function (i) { return activeInvoice(i) && (snap.binding[idOf(i)] || {}).caseId === cid; });
    var received = receipts.reduce(function (s, r) { return s + n(r.amountIRR || r.amt); }, 0);
    var freeReceiptCredit = receipts.reduce(function (s, r) {
      return s + receiptFreeCreditIRR(r, snap);
    }, 0);
    var totals = { grossBilled: 0, returned: 0, billed: 0, paid: 0, applied: 0, open: 0, overPaid: 0 };
    invoices.forEach(function (i) {
      var st = invoiceState(i, snap);
      Object.keys(totals).forEach(function (k) { totals[k] += n(st[k]); });
    });
    var credit = freeReceiptCredit + totals.overPaid;
    return {
      caseId: cid, grossBilled: totals.grossBilled, returned: totals.returned, billed: totals.billed,
      paid: totals.paid, applied: totals.applied, open: totals.open, overPaid: totals.overPaid,
      received: received, allocated: Math.max(0, received - freeReceiptCredit),
      freeReceiptCredit: freeReceiptCredit, credit: credit,
      net: Math.max(0, totals.open - credit), netCredit: Math.max(0, credit - totals.open),
      receipts: receipts, invoices: invoices
    };
  }

  /* ---------- وضعیت مشتری ---------- */
  function resolveOrphanInvoiceCustomer(i, offers, customers) {
    var candidates = {}, names = {}, direct = String(i.customerId || i.buyerCd || '').trim();
    function addId(v) { customerCandidatesForId(v, customers).forEach(function (id) { candidates[id] = true; }); }
    [i.customerId, i.buyerCd].forEach(addId);
    function addName(v) { var k = normalizePartyName(v); if (k) names[k] = true; }
    addName(i.buyerCo || i.customerName);
    var ino = String(i.offerNo || '').trim();
    if (ino) (offers || []).forEach(function (o) {
      if (!o || !activeRec(o) || String(o.no || '') !== ino) return;
      addId(o.buyerCd); addId(o.customerId);
      addName(o.buyerCo || o.customerName);
    });
    var ids = Object.keys(candidates);
    if (ids.length === 1) return { status: 'resolved', customerId: ids[0], bound: direct ? 'invoice' : 'offer' };
    if (ids.length > 1) return { status: 'ambiguous', customerId: '', bound: 'conflicting-identifiers' };
    var nameKeys = Object.keys(names), owners = {};
    (customers || []).forEach(function (c) {
      var cid = customerRecordId(c); if (!cid) return;
      if ([c.co || c.name, c.coEn].some(function (v) { return !!names[normalizePartyName(v)]; })) owners[cid] = true;
    });
    var ownerIds = Object.keys(owners);
    var safeName = ownerIds.length === 1 && nameKeys.length && nameKeys.every(function (nameKey) {
      return (customers || []).some(function (c) {
        return customerRecordId(c) === ownerIds[0] && [c.co || c.name, c.coEn].some(function (v) { return normalizePartyName(v) === nameKey; });
      });
    });
    return safeName ? { status: 'resolved', customerId: ownerIds[0], bound: 'unique-name' }
      : { status: ownerIds.length || nameKeys.length > 1 ? 'ambiguous' : 'unresolved', customerId: '', bound: 'name' };
  }
  function invoiceOwner(i, snap, offers, customers) {
    var b = (snap.binding[idOf(i)] || {}).caseId;
    if (b) return snap.caseOwners[b] || snap.caseOwnerAliases[b] || { status: 'unresolved', customerId: '' };
    return resolveOrphanInvoiceCustomer(i, offers, customers);
  }
  function customerInvoices(cd) {
    var snap = snapshot(), wanted = String(cd || '');
    var offers = list('ptf_crm_offers'), customers = list('ptf_crm_customers');
    return list('ptf_crm_invoices').filter(function (i) {
      if (!activeInvoice(i)) return false;
      /* resolver پرونده خود customerId فاکتور را هم جزو evidence می‌بیند؛ در نتیجه
         تعارض فاکتور با پیشنهاد/پرونده block می‌شود و هیچ مشتری برندهٔ حدسی نیست. */
      var owner = invoiceOwner(i, snap, offers, customers);
      return owner.status === 'resolved' && sameCustomerId(owner.customerId, wanted, customers);
    });
  }
  /**
   * وضعیت مشتری. opts.invoices یک scope از قبل احرازشده می‌پذیرد تا UI بتواند قواعد
   * visibility و fallback نام یکتای legacy را حفظ کند، بدون آن‌که فرمول مالی را تکرار کند.
   */
  function customerPosition(cd, opts) {
    opts = opts || {};
    var snap = snapshot(), wanted = String(cd || '');
    var offers = list('ptf_crm_offers'), customers = list('ptf_crm_customers');
    var invoices = Array.isArray(opts.invoices) ? opts.invoices.filter(function (i) {
      if (!activeInvoice(i)) return false;
      var owner = invoiceOwner(i, snap, offers, customers);
      return owner.status === 'resolved' && sameCustomerId(owner.customerId, wanted, customers);
    }) : customerInvoices(cd);
    var totals = { grossBilled: 0, returned: 0, billed: 0, paid: 0, applied: 0, open: 0, overPaid: 0 };
    invoices.forEach(function (i) {
      var st = invoiceState(i, snap);
      Object.keys(totals).forEach(function (k) { totals[k] += n(st[k]); });
    });
    var received = 0, freeReceiptCredit = 0, receiptCount = 0;
    list('ptf_crm_case_receipts').forEach(function (r) {
      if (!activeReceipt(r)) return;
      var rk = String(r.caseId || ''), owner = null;
      if (rk) owner = snap.caseOwnerAliases[rk] || snap.caseOwners[rk] || null;
      else owner = resolveOrphanInvoiceCustomer(r, offers, customers);
      if (!owner || owner.status !== 'resolved' || !sameCustomerId(owner.customerId, wanted, customers)) return;
      var amount = n(r.amountIRR || r.amt);
      received += amount;
      freeReceiptCredit += receiptFreeCreditIRR(r, snap);
      receiptCount++;
    });
    /* اعتبار آزاد Receipt و اضافه‌پرداخت فاکتور دو جزء مستقل‌اند. مبلغ تخصیص‌یافته
       Receipt اعتبار آزاد نیست و مرجوعی/اضافه‌پرداخت نیز دوباره در Receipt شمرده نمی‌شود. */
    var credit = freeReceiptCredit + totals.overPaid;
    return {
      customerCd: cd,
      grossBilled: totals.grossBilled, returned: totals.returned, billed: totals.billed,
      paid: totals.paid, applied: totals.applied, open: totals.open, overPaid: totals.overPaid,
      received: received, allocated: Math.max(0, received - freeReceiptCredit),
      freeReceiptCredit: freeReceiptCredit, credit: credit,
      net: Math.max(0, totals.open - credit), netCredit: Math.max(0, credit - totals.open),
      invoices: invoices.length, receipts: receiptCount
    };
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
    possible_double_money: 'احتمال ثبت دوبارهٔ یک پول (وصولی میراثی + رسید هم‌مبلغ)',
    /* LC-03 (v34.7.21) */
    superseded_in_reports: 'سند جایگزین‌شده که هنوز در گزارش‌های مالی وزن دارد',
    return_not_applied: 'مرجوعی فروش ثبت‌شده که در مبلغ خالص سند اثر نکرده است'
  };
  function reconcile() {
    invalidate();
    var snap = snapshot(true);
    var invoices = list('ptf_crm_invoices');
    var receipts = list('ptf_crm_case_receipts');
    var offers = list('ptf_crm_offers'), customers = list('ptf_crm_customers');
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
    /* LC-03: سند جایگزین‌شده و مرجوعی‌های اثرنکرده */
    invoices.forEach(function (inv) {
      if (!inv) return;
      var key = idOf(inv), st = statusOf(inv);
      if ((st === 'superseded' || st === 'replaced') && legacyPaidIRR(inv) > 0)
        push('superseded_in_reports', 'medium', key, 'سند جایگزین‌شدهٔ ' + (inv.no || key) + ' وصولی ثبت‌شده دارد؛ باید در پورسانت/سرمایه در گردش/سال مالی کنار گذاشته شود', legacyPaidIRR(inv));
      if (!activeInvoice(inv)) return;
      var ret = returnedAmountIRR(inv);
      if (ret > 0) {
        var net = invoiceNetAfterReturnsIRR(inv);
        if (net + ret - invoiceCaps(inv).amount !== 0)
          push('return_not_applied', 'medium', key, 'محاسبهٔ خالص فاکتور ' + (inv.no || key) + ' با مرجوعی ثبت‌شده هم‌خوان نیست', ret);
        else if (ret > invoiceState(inv, snap).paid && invoiceState(inv, snap).open === 0)
          push('return_not_applied', 'low', key, 'فاکتور ' + (inv.no || key) + ' مرجوعی دارد و مانده‌اش صفر است؛ اضافه‌پرداخت باید به‌عنوان اعتبار مشتری تعیین‌تکلیف شود', ret);
      }
    });

    /* بستانکاری بلااستفاده در کنار مطالبهٔ باز همان مشتری */
    var byCustomer = {};
    receipts.forEach(function (r) {
      if (!activeReceipt(r)) return;
      var credit = receiptFreeCreditIRR(r, snap);
      if (credit <= 0) return;
      var rk = String(r.caseId || ''), owner = rk ? (snap.caseOwnerAliases[rk] || snap.caseOwners[rk]) : resolveOrphanInvoiceCustomer(r, offers, customers);
      var cd = owner && owner.status === 'resolved' ? String(owner.customerId || '') : '';
      if (cd) byCustomer[cd] = (byCustomer[cd] || 0) + credit;
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
    version: 'v34.8.0',
    activeInvoice: activeInvoice, activeReceipt: activeReceipt,
    invoiceCaps: invoiceCaps, legacyPaidIRR: legacyPaidIRR,
    computeAllocations: computeAllocations, snapshot: snapshot, invalidate: invalidate,
    receiptFreeCreditIRR: receiptFreeCreditIRR,
    invoiceState: invoiceState, invoicePaidIRR: invoicePaidIRR, invoiceOpenIRR: invoiceOpenIRR,
    salesReturnsForInvoice: salesReturnsForInvoice, returnedAmountIRR: returnedAmountIRR,
    invoiceNetAfterReturnsIRR: invoiceNetAfterReturnsIRR,
    caseState: caseState, customerInvoices: customerInvoices, customerPosition: customerPosition,
    resolveCaseCustomer: resolveCaseCustomer, resolveCaseIdOfInvoice: resolveCaseIdOfInvoice,
    reconcile: reconcile, CATEGORIES: CATEGORIES
  };
})();

/* =====================================================================
   PTF CRM — v34.8.0 — رابط کاربری گزارش تسویهٔ مطالبات (فاز ۰)
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
