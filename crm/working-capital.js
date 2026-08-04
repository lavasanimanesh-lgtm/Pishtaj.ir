/* =====================================================================
   PTF CRM — introduced Sprint 281 / current release v28.7
   Official financial-position foundation (read-only derivation)

   Principles:
   - There is no second customer/supplier ledger in this file.
   - Operational balances are derived only from their existing source keys.
   - Fiscal configuration and manual opening entries are auditable records in
     ptf_crm_fiscal_snapshots, an already synced/backup-protected key.
   - Manual openings are ONLY for balances not represented by existing source
     documents; they are never created by an automatic migration.
   ===================================================================== */
(function () {
  'use strict';

  var SNAP_KEY = 'ptf_crm_fiscal_snapshots';
  var CONFIG_TYPE = 'fiscal_config_v281';
  var OPENING_TYPE = 'opening_balance_v281';
  var CATEGORY = {
    receivable: 'مطالبات مشتریانِ بدون سند در سامانه',
    supplier_liability: 'بدهی تأمین‌کنندگانِ بدون سند در سامانه',
    supplier_credit: 'اعتبار نزد تأمین‌کنندگانِ بدون سند در سامانه',
    company_cheque: 'تعهد چک شرکتیِ بدون سند در سامانه',
    cash_bank: 'وجه نقد و بانکِ افتتاحیه (گردش بانکی در CRM ثبت نمی‌شود)'
  };

  function arr(v) { return Array.isArray(v) ? v : []; }
  function snaps() { return arr(typeof getData === 'function' ? getData(SNAP_KEY) : []); }
  function saveSnaps(v) { if (typeof setData === 'function') setData(SNAP_KEY, v); }
  function canManage() { try { return ['admin', 'chairman'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function esc(v) { return typeof escP === 'function' ? escP(v == null ? '' : String(v)) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function num(v) {
    if (typeof ptfNum === 'function') return +ptfNum(v) || 0;
    return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0;
  }
  function money(v) { return Math.round(+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function isoToday() { return typeof ptfTodayISO === 'function' ? ptfTodayISO() : new Date().toISOString().slice(0, 10); }
  function jToday() { return typeof ptfTodayJ === 'function' ? ptfTodayJ() : (typeof ptfISOToJ === 'function' ? ptfISOToJ(isoToday()) : '1405/01/01'); }
  function jYear() { return String(jToday()).slice(0, 4) || '1405'; }
  function nowText() { try { return faDateTime(); } catch (e) { return new Date().toISOString(); } }
  function userName() { try { return (curSession() || {}).name || ''; } catch (e) { return ''; } }
  function auditSafe(text, ref) { try { if (typeof audit === 'function') audit('گزارش تجمیعی مالی', text, ref || ''); } catch (e) {} }

  function isoFromUnknown(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var m = s.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var jm = s.match(/([۰-۹٠-٩0-9]{4}\s*[\/-]\s*[۰-۹٠-٩0-9]{1,2}\s*[\/-]\s*[۰-۹٠-٩0-9]{1,2})/);
    if (jm && typeof ptfJToISO === 'function') return ptfJToISO(jm[1]) || '';
    return '';
  }
  function dateOf(o, fields) {
    var out = '';
    (fields || []).some(function (k) { out = isoFromUnknown(o && o[k]); return !!out; });
    return out;
  }
  function active(o) { return !!o && o.status !== 'void' && o.st !== 'void' && o.void !== true && o.deleted !== true; }
  function inAsOf(iso, asOf) { return !iso || iso <= asOf; }
  function inPeriod(iso, start, asOf) { return !!iso && iso >= start && iso <= asOf; }
  function amountIrr(o) {
    if (!o) return 0;
    if (o.amountIrr != null && isFinite(+o.amountIrr)) return +o.amountIrr || 0;
    var a = +o.amount || +o.amt || 0, cur = o.cur || o.currency || 'IRR';
    return cur === 'IRR' ? a : a * (+o.rate || 0);
  }
  function normalYearBounds(year) {
    var startFa = String(year || jYear()) + '/01/01';
    var startISO = typeof ptfJToISO === 'function' ? ptfJToISO(startFa) : '';
    var nextISO = typeof ptfJToISO === 'function' ? ptfJToISO((+year + 1) + '/01/01') : '';
    var endISO = '';
    if (nextISO) { var d = new Date(nextISO + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); endISO = d.toISOString().slice(0, 10); }
    return { fiscalYear: String(year || jYear()), startISO: startISO, endISO: endISO, startFa: startFa, endFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(endISO) : '' };
  }
  function config() {
    var all = snaps().filter(function (r) { return r && r.type === CONFIG_TYPE && r.active !== false; });
    all.sort(function (a, b) { return String(b.updatedAtISO || b.updatedAt || b.t || '').localeCompare(String(a.updatedAtISO || a.updatedAt || a.t || '')); });
    var c = all[0];
    if (!c) return normalYearBounds(jYear());
    var def = normalYearBounds(c.fiscalYear || jYear());
    return {
      cd: c.cd || '', fiscalYear: String(c.fiscalYear || def.fiscalYear),
      startISO: isoFromUnknown(c.startISO) || def.startISO,
      endISO: isoFromUnknown(c.endISO) || def.endISO,
      startFa: c.startFa || (typeof ptfISOToJ === 'function' ? ptfISOToJ(c.startISO || def.startISO) : ''),
      endFa: c.endFa || (typeof ptfISOToJ === 'function' ? ptfISOToJ(c.endISO || def.endISO) : ''),
      t: c.t || '', by: c.by || '', configured: true
    };
  }
  function openingEntries(year) {
    return snaps().filter(function (r) { return r && r.type === OPENING_TYPE && r.status !== 'void' && String(r.fiscalYear) === String(year); });
  }
  function openingTotals(year) {
    var o = { receivable: 0, supplier_liability: 0, supplier_credit: 0, company_cheque: 0, cash_bank: 0 };
    openingEntries(year).forEach(function (r) { if (Object.prototype.hasOwnProperty.call(o, r.category)) o[r.category] += Math.max(0, +r.amountIrr || 0); });
    return o;
  }
  function unpaidCustomer(inv) {
    var total = +inv.amountIrr || +inv.amount || 0;
    var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv, { activeOnly: true, useAmountIrr: true }) : arr(inv.payments).concat(arr(inv.pays)).filter(active).reduce(function (s, p) { return s + (window.PTF && PTF.paymentAmtIrr ? PTF.paymentAmtIrr(p) : (+p.amountIrr || +p.amt || +p.amount || 0)); }, 0);
    return Math.max(0, total - paid);
  }
  function supplierInvoicePaid(inv, pays) {
    return arr(pays).filter(active).reduce(function (s, p) {
      return s + arr(p.allocations).filter(function (a) { return a && a.invoiceCd === inv.cd; }).reduce(function (z, a) { return z + (+a.amount || 0); }, 0);
    }, 0);
  }
  function legacyRemain(p) {
    if (typeof ptfPayableRemain === 'function') { try { return Math.max(0, +ptfPayableRemain(p) || 0); } catch (e) {} }
    return Math.max(0, (+p.amount || 0) - arr(p.paid).reduce(function (s, x) { return s + (+x.amt || +x.amount || 0); }, 0));
  }
  function pushIssue(issues, key, amount, label) { issues[key] = issues[key] || { count: 0, amount: 0, labels: [] }; issues[key].count++; issues[key].amount += +amount || 0; if (label && issues[key].labels.length < 4) issues[key].labels.push(label); }

  /* Public pure-ish calculation: no write, no migration, no reconciliation side-effect. */
  window.ptfFinanceOfficialData = function () {
    var cfg = config(), today = isoToday(), asOf = cfg.endISO && cfg.endISO < today ? cfg.endISO : today;
    var start = cfg.startISO || normalYearBounds(cfg.fiscalYear).startISO;
    var opening = openingTotals(cfg.fiscalYear);
    var src = { receivable: 0, supplierLiability: 0, supplierCredit: 0, companyCheque: 0 };
    /* v34.0.10-alpha: تفکیک سال جاری / سال‌های قبل برای reconciliation بدهی تأمین‌کننده */
    var recSup = { opening: +opening.supplier_liability || 0, invoicesThis: 0, invoicesPrior: 0, paysThis: 0, paysPrior: 0, adjustments: 0 };
    var moves = { customerInvoices: 0, customerReceipts: 0, supplierInvoices: 0, supplierPayments: 0, companyCheques: 0 };
    var counts = { customerInvoices: 0, supplierInvoices: 0, companyCheques: 0 };
    var issues = {};
    var invs = arr(getData('ptf_crm_invoices'));
    var supplier = (function () { try { var x = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); return x && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } })();
    var sfInvs = arr(supplier.invoices), sfPays = arr(supplier.payments), sfAdjustments = arr(supplier.adjustments);
    var legacy = arr(getData('ptf_crm_payables'));
    var cheques = arr(getData('ptf_crm_cheques'));
    var linkedLegacy = {};
    sfInvs.filter(active).forEach(function (i) { arr(i.legacyPayableCds).forEach(function (cd) { if (cd) linkedLegacy[cd] = true; }); });

    invs.filter(active).forEach(function (inv) {
      var amount = unpaidCustomer(inv), iso = dateOf(inv, ['dateISO', 'invDate', 'issueDate', 'date', 't']);
      if (!iso) pushIssue(issues, 'customerInvoiceDate', amount, inv.no || inv.cd);
      else if (inAsOf(iso, asOf)) src.receivable += amount;
      /* A dated invoice after the report date does not exist in this report yet. */
      if (inPeriod(iso, start, asOf)) { moves.customerInvoices += (+inv.amountIrr || +inv.amount || 0); counts.customerInvoices++; }
      arr(inv.payments).concat(arr(inv.pays)).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : active).forEach(function (p) {
        var pi = dateOf(p, ['dateISO', 'date', 't', 'paidAt']);
        var pa = +p.amountIrr || +p.amt || +p.amount || 0;
        if (!pi) pushIssue(issues, 'customerPaymentDate', pa, inv.no || inv.cd);
        else if (inPeriod(pi, start, asOf)) moves.customerReceipts += pa;
      });
    });

    sfInvs.filter(active).forEach(function (inv) {
      var nativeRemain = Math.max(0, (+inv.amount || 0) - supplierInvoicePaid(inv, sfPays));
      var irrRemain = (inv.cur || 'IRR') === 'IRR' ? nativeRemain : nativeRemain * (+inv.rate || 0);
      var iso = dateOf(inv, ['dateISO', 'date', 't']);
      if ((inv.cur || 'IRR') !== 'IRR' && !(+inv.rate || 0)) pushIssue(issues, 'supplierFxRate', 0, inv.no || inv.cd);
      /* v34.0.8-alpha (هماهنگ با موتور سود): فاکتور صوری/پوششی خرید واقعی نیست — مبلغ اسمی و
         اعتبار ارزش‌افزوده بدهیِ واقعی ایجاد نمی‌کنند؛ فقط «کارمزد فاکتورساز» بدهیِ نقدی واقعی است.
         منفعت پوششی (VAT − کارمزد) جدا گزارش می‌شود. */
      if (inv.isCover === true) {
        var cBase = amountIrr(inv);
        var cComm = (+inv.coverCommissionAmount != null && +inv.coverCommissionAmount > 0) ? (+inv.coverCommissionAmount || 0) : Math.round(cBase * (+inv.coverCommissionPct || 0) / 100);
        var cVat = (+inv.coverVatAmount != null && +inv.coverVatAmount > 0) ? (+inv.coverVatAmount || 0) : Math.round(cBase * (+inv.coverVatPct || 0) / 100);
        src.coverCommission = (src.coverCommission || 0) + cComm;
        src.coverVat = (src.coverVat || 0) + cVat;
        src.coverCount = (src.coverCount || 0) + 1;
        if (!iso) pushIssue(issues, 'supplierInvoiceDate', cComm, inv.no || inv.cd);
        else if (inAsOf(iso, asOf)) src.supplierLiability += cComm; /* فقط کارمزد = بدهی واقعی */
        if (inPeriod(iso, start, asOf)) { moves.supplierInvoices += cComm; counts.supplierInvoices++; recSup.invoicesThis += cComm; }
        else if (iso && iso <= asOf) recSup.invoicesPrior += cComm;
        return;
      }
      if (!iso) pushIssue(issues, 'supplierInvoiceDate', irrRemain, inv.no || inv.cd);
      else if (inAsOf(iso, asOf)) src.supplierLiability += irrRemain;
      if (inPeriod(iso, start, asOf)) { moves.supplierInvoices += amountIrr(inv); counts.supplierInvoices++; recSup.invoicesThis += amountIrr(inv); }
      else if (iso && iso <= asOf) recSup.invoicesPrior += amountIrr(inv);
    });
    /* v34.0.8-alpha (هماهنگ با فاز ۳): Legacy payable دیگر در مبلغ بدهیِ تأمین‌کننده نمی‌آید
       (مبنای تعهد فقط فاکتور خرید است؛ خریدِ تعهدی بی‌معناست). فقط به‌عنوان شمارشِ تعهدِ
       بازِ بدون‌فاکتور گزارش می‌شود تا اطلاعات از دست نرود. */
    legacy.filter(function (p) { return active(p) && p.pay === 'credit' && !p.sfInvoiceCd && !linkedLegacy[p.cd]; }).forEach(function (p) {
      var native = legacyRemain(p), irr = (p.cur || 'IRR') === 'IRR' ? native : native * (+p.rate || 0), iso = dateOf(p, ['dateISO', 'date', 't', 'createdAt']);
      if ((p.cur || 'IRR') !== 'IRR' && !(+p.rate || 0)) pushIssue(issues, 'legacyFxRate', 0, p.cd || p.item);
      if (!iso) pushIssue(issues, 'legacyPayableDate', irr, p.cd || p.item);
      src.legacyUnlinked = (src.legacyUnlinked || 0) + irr;
      src.legacyUnlinkedCount = (src.legacyUnlinkedCount || 0) + 1;
    });
    sfAdjustments.filter(active).forEach(function (a) {
      var val = amountIrr(a), iso = dateOf(a, ['dateISO', 'date', 't']);
      if (!iso) { pushIssue(issues, 'supplierAdjustmentDate', Math.abs(val), a.cd); return; }
      if (!inAsOf(iso, asOf)) return;
      if (val >= 0) src.supplierLiability += val; else src.supplierCredit += Math.abs(val);
      recSup.adjustments += val;
    });
    sfPays.filter(active).forEach(function (p) {
      var allocated = arr(p.allocations).reduce(function (s, a) { return s + (+a.amount || 0); }, 0);
      var creditNative = Math.max(0, (+p.amount || 0) - allocated), creditIrr = (p.cur || 'IRR') === 'IRR' ? creditNative : creditNative * (+p.rate || 0);
      var iso = dateOf(p, ['dateISO', 'date', 't']);
      if ((p.cur || 'IRR') !== 'IRR' && !(+p.rate || 0)) pushIssue(issues, 'supplierPaymentFxRate', 0, p.cd);
      if (!iso) pushIssue(issues, 'supplierPaymentDate', amountIrr(p), p.cd);
      else {
        if (inAsOf(iso, asOf)) src.supplierCredit += creditIrr;
        if (inPeriod(iso, start, asOf)) { moves.supplierPayments += amountIrr(p); recSup.paysThis += amountIrr(p); }
        else if (iso && iso <= asOf) recSup.paysPrior += amountIrr(p);
      }
    });
    cheques.filter(function (c) { return c && c.ownership === 'company' && c.kind !== 'guarantee' && c.st === 'open'; }).forEach(function (c) {
      var amount = +c.amt || +c.amount || 0, iso = dateOf(c, ['issueISO', 'createdISO', 'dateISO', 't']);
      /* Legacy checks may not have an issue date. They remain visible as an open obligation, but are marked for data completion. */
      if (!iso) { src.companyCheque += amount; pushIssue(issues, 'companyChequeDate', amount, c.sayad || c.no || c.cd); }
      else if (inAsOf(iso, asOf)) src.companyCheque += amount;
      if (inPeriod(iso, start, asOf)) { moves.companyCheques += amount; counts.companyCheques++; }
    });
    cheques.filter(function (c) { return c && c.kind !== 'guarantee' && c.st === 'open' && !c.ownership; }).forEach(function (c) { pushIssue(issues, 'unclassifiedCheque', +c.amt || 0, c.sayad || c.no || c.cd); });

    /* v34.0.8-alpha (M-B3): بازنویسی از slSupplierOpenTotalsIRR دیگر «وضعیتِ امروز» را متفاوت
       از مسیر داخلی نمی‌کند — balance() (که منبع آن است) حالا هم‌ارزِ مسیر داخلی است:
       فاکتور پوششی فقط کارمزد و legacy از مبلغ بدهی حذف. فقط برای هم‌ارزسازی مقادیر
       supplierLiability/Credit استفاده می‌شود؛ فیلدهای پوششی/legacy از محاسبهٔ داخلی حفظ می‌شوند. */
    if (asOf === today && typeof window.slSupplierOpenTotalsIRR === 'function') {
      try {
        var slt = window.slSupplierOpenTotalsIRR();
        if (slt && isFinite(+slt.debt) && isFinite(+slt.credit)) {
          src.supplierLiability = +slt.debt || 0;
          src.supplierCredit = +slt.credit || 0;
        }
      } catch (eSl) {}
    }

    var total = {
      receivable: src.receivable + opening.receivable,
      supplierLiability: src.supplierLiability + opening.supplier_liability,
      supplierCredit: src.supplierCredit + opening.supplier_credit,
      companyCheque: src.companyCheque + opening.company_cheque,
      cashBank: opening.cash_bank
    };
    total.netWorkingCapital = total.receivable + total.cashBank - total.supplierLiability + total.supplierCredit - total.companyCheque;
    return { schema: 281, cfg: cfg, asOf: asOf, asOfFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(asOf) : asOf, opening: opening, source: src, total: total, moves: moves, counts: counts, issues: issues, openingEntries: openingEntries(cfg.fiscalYear),
      coverCommission: src.coverCommission || 0, coverVat: src.coverVat || 0, coverCount: src.coverCount || 0,
      legacyUnlinked: src.legacyUnlinked || 0, legacyUnlinkedCount: src.legacyUnlinkedCount || 0,
      recSup: recSup };
  };

  function card(value, label, color) { return '<div class="sc"><b style="color:' + (color || '#0f172a') + '">' + money(value) + '</b><span>' + label + '</span></div>'; }
  function issueHtml(d) {
    var rows = Object.keys(d.issues || {}).map(function (k) {
      var x = d.issues[k], title = {
        customerInvoiceDate: 'فاکتور مشتری بدون تاریخ معتبر', customerPaymentDate: 'وصول مشتری بدون تاریخ معتبر',
        supplierInvoiceDate: 'فاکتور تأمین‌کننده بدون تاریخ معتبر', supplierPaymentDate: 'پرداخت تأمین‌کننده بدون تاریخ معتبر',
        legacyPayableDate: 'تعهد خرید قدیمی بدون تاریخ معتبر', supplierAdjustmentDate: 'سند اصلاحی تأمین‌کننده بدون تاریخ معتبر',
        companyChequeDate: 'چک شرکتی بدون تاریخ صدور', unclassifiedCheque: 'چکِ باز با مالکیت نامشخص (عمداً در گزارش وارد نشده)',
        supplierFxRate: 'فاکتور ارزی تأمین‌کننده بدون نرخ تسعیر', supplierPaymentFxRate: 'پرداخت ارزی تأمین‌کننده بدون نرخ تسعیر', legacyFxRate: 'تعهد ارزی قدیمی بدون نرخ تسعیر'
      }[k] || k;
      return '<li><b>' + esc(title) + ':</b> ' + x.count.toLocaleString('fa-IR') + ' مورد' + (x.amount ? ' — ' + money(x.amount) : '') + (x.labels.length ? ' <small>[' + x.labels.map(esc).join('، ') + (x.count > x.labels.length ? '، …' : '') + ']</small>' : '') + '</li>';
    }).join('');
    if (!rows) return '<div style="background:var(--crd,#fff);border:1px solid var(--brd,#bbf7d0);border-radius:10px;padding:9px 11px;color:var(--tx,#065f46);font-size:12px">✅ مانع داده‌ای شناخته‌شده برای محاسبهٔ رسمی این گزارش یافت نشد.</div>';
    return '<div style="background:var(--crd,#fff);border:1px solid var(--brd,#fed7aa);border-radius:10px;padding:9px 11px;color:var(--tx,#9a3412);font-size:12px;line-height:1.9"><b>⚠️ کنترل کیفیت داده</b><br><span>اقلام بی‌تاریخ از گردش سال کنار گذاشته شده‌اند؛ چک شرکتی بی‌تاریخ فقط در تعهدات باز دیده می‌شود. چکِ بی‌مالکیت هرگز خودکار شرکتی فرض نشده است.</span><ul style="margin:5px 0 0;padding-right:18px">' + rows + '</ul></div>';
  }
  function openingRows(d) {
    var rows = arr(d.openingEntries).map(function (r) { return '<tr><td>' + esc(r.dateFa || r.startFa || '') + '</td><td>' + esc(CATEGORY[r.category] || r.category) + '</td><td>' + money(r.amountIrr) + '</td><td>' + esc(r.note || '') + '</td><td>' + esc(r.cd || '') + '</td><td><button class="ba" style="color:#dc2626" onclick="fcOpeningVoid(\'' + esc(r.cd) + '\')">ابطال</button></td></tr>'; }).join('');
    return rows || '<tr><td colspan="6" style="color:#64748b">مانده افتتاحیهٔ دستی ثبت نشده است.</td></tr>';
  }
  function html() {
    var d = window.ptfFinanceOfficialData(), c = d.cfg, t = d.total, s = d.source, o = d.opening, mv = d.moves;
    return '<div id="wcFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:9px;flex-wrap:wrap"><div><h4 style="margin:0">📊 گزارش تجمیعی وضعیت مالی و سرمایه در گردش</h4><small style="color:#64748b">شامل رسمی و غیررسمی با هم — برای تراز جداگانه به تب «تراز رسمی/غیررسمی» مراجعه کنید. سال مالی ' + esc(c.fiscalYear) + ' | از ' + esc(c.startFa) + ' تا ' + esc(c.endFa) + ' | وضعیت تا ' + esc(d.asOfFa) + '</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" onclick="fcConfigOpen()">⚙️ تنظیم سال مالی</button><button class="bt bt-o" onclick="fcOpeningOpen()">🏁 ثبت مانده افتتاحیه</button><button class="bt bt-o" onclick="wcPrint()">🖨 پیش‌نمایش/چاپ</button><button class="bt bt-o" onclick="wcCsv()">📥 CSV</button></div></div>' +
      '<div style="background:var(--crd,#fff);border:1px solid var(--brd,#bfdbfe);border-radius:10px;padding:9px 11px;margin:10px 0;color:var(--tx,#1e3a8a);font-size:12px;line-height:1.8"><b>روش محاسبه:</b> مانده‌ها مستقیماً از فاکتورهای مشتری، زیر‌دفتر تأمین‌کننده (فاکتور خرید) و چک‌های با مالکیت صریح «شرکت» خوانده می‌شوند. <b>فاکتور صوری/پوششی خرید واقعی نیست</b> — فقط کارمزد فاکتورساز در بدهی لحاظ و اعتبار ارزش‌افزوده جدا نشان داده می‌شود. تعهدِ خریدِ legacy (بدون فاکتور) از مبلغ بدهی حذف شده (فقط گزارش). «مانده افتتاحیه» فقط برای اسناد/مانده‌هایی است که در این منابع وجود ندارند؛ ورود تکراری آن باعث دوباره‌شماری می‌شود. این گزارش هیچ سند عملیاتی را تغییر نمی‌دهد و جایگزین دفترکل یا گردش بانکی نیست.</div>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(165px,1fr));margin-top:10px">' +
      card(t.receivable, 'مطالبات باز مشتریان', '#b45309') + card(t.supplierLiability, 'بدهی باز تأمین‌کنندگان', '#dc2626') + card(t.supplierCredit, 'اعتبار نزد تأمین‌کنندگان', '#059669') + card(t.companyCheque, 'چک‌های شرکتی باز', '#7c3aed') + card(t.cashBank, 'وجه نقد/بانکِ افتتاحیه', '#0369a1') + card(t.netWorkingCapital, 'خالص سرمایه در گردش ثبتی', t.netWorkingCapital >= 0 ? '#059669' : '#dc2626') +
      '</div>' +
      '<div class="tb2" style="margin-top:12px"><table><thead><tr><th>سرفصل</th><th>مانده افتتاحیه دستی</th><th>مانده از اسناد فعال</th><th>مانده گزارش</th><th>منبع</th></tr></thead><tbody>' +
      '<tr><td>مطالبات مشتریان</td><td>' + money(o.receivable) + '</td><td>' + money(s.receivable) + '</td><td><b>' + money(t.receivable) + '</b></td><td>فاکتورهای مشتری − وصولی‌ها</td></tr>' +
      '<tr><td>بدهی تأمین‌کنندگان</td><td>' + money(o.supplier_liability) + '</td><td>' + money(s.supplierLiability) + '</td><td><b>' + money(t.supplierLiability) + '</b></td><td>فاکتور خرید (واقعی + کارمزد پوششی) + اصلاحیات</td></tr>' +
      (d.coverCommission ? '<tr><td>کارمزد فاکتورهای صوری/پوششی</td><td>—</td><td>' + money(d.coverCommission) + '</td><td><b>' + money(d.coverCommission) + '</b></td><td>بدهیِ نقدی واقعی فاکتور پوششی (در بدهی تأمین لحاظ شده)</td></tr><tr><td>اعتبار ارزش‌افزودهٔ پوششی (منفعت)</td><td>—</td><td>' + money(d.coverVat) + '</td><td><b>' + money(d.coverVat) + '</b></td><td>منفعت — نقد نیست؛ در بدهی محاسبه نشده</td></tr>' : '') +
      (d.legacyUnlinked ? '<tr><td>تعهد خرید legacy بدون فاکتور</td><td>—</td><td>' + money(d.legacyUnlinked) + '</td><td><b>' + money(d.legacyUnlinked) + '</b></td><td>گزارشی فقط — در بدهی لحاظ نمی‌شود (مبنای تعهد فاکتور خرید است)</td></tr>' : '') +
      '<tr><td>اعتبار تأمین‌کنندگان</td><td>' + money(o.supplier_credit) + '</td><td>' + money(s.supplierCredit) + '</td><td><b>' + money(t.supplierCredit) + '</b></td><td>پرداخت بدون تخصیص + اصلاحیات منفی</td></tr>' +
      '<tr><td>چک شرکتی باز</td><td>' + money(o.company_cheque) + '</td><td>' + money(s.companyCheque) + '</td><td><b>' + money(t.companyCheque) + '</b></td><td>فقط ownership=company و status=open</td></tr>' +
      '<tr><td>وجه نقد/بانک</td><td>' + money(o.cash_bank) + '</td><td>—</td><td><b>' + money(t.cashBank) + '</b></td><td>فقط افتتاحیهٔ دستی؛ گردش بانکی در CRM موجود نیست</td></tr>' +
      '</tbody></table></div>' +
      '<h4 style="margin:14px 0 7px">گردش ثبت‌شده در سال مالی</h4><div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(165px,1fr))">' +
      card(mv.customerInvoices, 'فاکتور مشتری صادرشده در سال') + card(mv.customerReceipts, 'وصولی مشتری در سال', '#059669') + card(mv.supplierInvoices, 'فاکتور تأمین ثبت‌شده در سال', '#dc2626') + card(mv.supplierPayments, 'پرداخت تأمین در سال', '#7c3aed') + card(mv.companyCheques, 'چک شرکتی صادرشده در سال', '#7c3aed') +
      '</div>' +
      '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:9px 12px;margin-top:10px;font-size:12px;color:#4c1d95;line-height:1.9"><b>🧮 بازسازی بدهی باز تأمین‌کنندگان:</b><br>' +
      'افتتاحیه (' + money(d.recSup.opening) + ') + فاکتورهای امسال (' + money(d.recSup.invoicesThis) + ') + فاکتورهای سال‌های قبل (' + money(d.recSup.invoicesPrior) + ')' +
      (d.recSup.adjustments ? ' + اصلاحیات (' + money(d.recSup.adjustments) + ')' : '') +
      ' − پرداخت‌های امسال (' + money(d.recSup.paysThis) + ') − پرداخت‌های سال قبل (' + money(d.recSup.paysPrior) + ')' +
      ' = بدهی باز <b>' + money(t.supplierLiability) + '</b>.<br><small style="color:#7c3aed">پس «بدهی باز» یک ماندهٔ تجمعی است و با «فاکتورهای ثبت‌شدهٔ همین سال» قابل مقایسه مستقیم نیست.</small></div>' +
      issueHtml(d) +
      '<h4 style="margin:14px 0 7px">ردیابی مانده‌های افتتاحیه</h4><div class="tb2"><table><thead><tr><th>تاریخ اثر</th><th>سرفصل</th><th>مبلغ</th><th>شرح/مبنا</th><th>شناسه</th><th></th></tr></thead><tbody>' + openingRows(d) + '</tbody></table></div></div>';
  }

  window.wcFinanceHtml = html;
  window.wcRender = function () { var el = document.getElementById('wcFinanceHubBox'); if (el) el.outerHTML = html(); };
  window.fcConfigOpen = function () {
    if (!canManage()) { alert('⛔ تنظیم سال مالی فقط برای مدیر سیستم یا رییس هیات مدیره مجاز است.'); return; }
    var c = config();
    ptfDialog({ title: '⚙️ تنظیم سال مالی گزارش رسمی', body: 'تاریخ‌ها باید شمسی باشند. تغییر تنظیمات هیچ فاکتور، پرداخت یا چکی را جابه‌جا نمی‌کند؛ فقط بازهٔ گزارش را تعیین می‌کند.', fields: [
      { id: 'year', label: 'نام/کد سال مالی', type: 'text', value: c.fiscalYear, required: true, dir: 'ltr', placeholder: '1405' },
      { id: 'start', label: 'شروع سال مالی (شمسی)', type: 'text', value: c.startFa, required: true, dir: 'ltr', placeholder: '1405/01/01' },
      { id: 'end', label: 'پایان سال مالی (شمسی)', type: 'text', value: c.endFa, required: true, dir: 'ltr', placeholder: '1405/12/29' }
    ], okText: 'ذخیره تنظیمات', onOk: function (v) {
      var year = String(v.year || '').trim(), startFa = String(v.start || '').trim(), endFa = String(v.end || '').trim();
      var startISO = typeof ptfJToISO === 'function' ? ptfJToISO(startFa) : '', endISO = typeof ptfJToISO === 'function' ? ptfJToISO(endFa) : '';
      if (!/^1[34]\d{2}$/.test(year) || !startISO || !endISO || startISO > endISO) { alert('کد سال مالی و تاریخ‌های شمسی معتبر (شروع ≤ پایان) الزامی است.'); return; }
      var all = snaps(); all.forEach(function (r) { if (r && r.type === CONFIG_TYPE && r.active !== false) { r.active = false; r.supersededAt = nowText(); r.supersededBy = userName(); } });
      var rec = { cd: genCode('FSCFG'), type: CONFIG_TYPE, active: true, fiscalYear: year, startFa: startFa, endFa: endFa, startISO: startISO, endISO: endISO, t: nowText(), updatedAt: nowText(), updatedAtISO: new Date().toISOString(), by: userName() };
      all.unshift(rec); saveSnaps(all); window._fiscalYear = year; auditSafe('تنظیم سال مالی ' + year + ' از ' + startFa + ' تا ' + endFa, rec.cd); wcRender(); try { if (typeof ptfFiscalRender === 'function') ptfFiscalRender(); } catch (e) {} if (typeof ptfToast === 'function') ptfToast('تنظیم سال مالی ذخیره شد', 'ok');
    } });
  };
  window.fcOpeningOpen = function () {
    if (!canManage()) { alert('⛔ ثبت مانده افتتاحیه فقط برای مدیر سیستم یا رییس هیات مدیره مجاز است.'); return; }
    var c = config(), options = Object.keys(CATEGORY).map(function (k) { return { v: k, lb: CATEGORY[k] }; });
    ptfDialog({ title: '🏁 ثبت مانده افتتاحیه — سال ' + esc(c.fiscalYear), body: '<b>کنترل مهم:</b> فقط مانده‌ای را ثبت کنید که در فاکتورها، پرداخت‌ها، تعهدهای legacy یا چک‌های فعلی سامانه وجود ندارد. این ثبت دستی هیچ داده‌ای را منتقل یا اصلاح نمی‌کند.', fields: [
      { id: 'category', label: 'سرفصل *', type: 'select', options: options },
      { id: 'amount', label: 'مبلغ مثبت (ریال) *', type: 'number', required: true, money: false, dir: 'ltr' },
      { id: 'note', label: 'شرح و مبنای قابل رسیدگی *', type: 'textarea', required: true, rows: 3, placeholder: 'مثال: مانده تاییدشده صورت‌حساب قبل از شروع استفاده از CRM' }
    ], okText: 'ثبت مانده افتتاحیه', onOk: function (v) {
      var amount = num(v.amount), category = String(v.category || ''), note = String(v.note || '').trim();
      if (!CATEGORY[category] || !(amount > 0) || !note) { alert('سرفصل، مبلغ مثبت و شرح/مبنای قابل رسیدگی الزامی است.'); return; }
      var rec = { cd: genCode('FOB'), type: OPENING_TYPE, fiscalYear: c.fiscalYear, startISO: c.startISO, dateFa: c.startFa, category: category, amountIrr: Math.round(amount), note: note, status: 'posted', t: nowText(), by: userName() };
      var all = snaps(); all.unshift(rec); saveSnaps(all); auditSafe('ثبت مانده افتتاحیه ' + CATEGORY[category] + ' — ' + money(amount), rec.cd); wcRender(); if (typeof ptfToast === 'function') ptfToast('مانده افتتاحیه ثبت شد', 'ok');
    } });
  };
  window.fcOpeningVoid = function (cd) {
    if (!canManage()) { alert('⛔ ابطال مانده افتتاحیه فقط برای مدیر سیستم یا رییس هیات مدیره مجاز است.'); return; }
    var all = snaps(), rec = all.filter(function (r) { return r && r.cd === cd && r.type === OPENING_TYPE; })[0];
    if (!rec || rec.status === 'void') return;
    if (all.some(function (r) { return r && r.locked && String(r.year) === String(rec.fiscalYear); })) { alert('🔒 سال مالی قفل شده است؛ مانده افتتاحیه حذف/ابطال نمی‌شود. از سند اصلاحی سال مالی استفاده کنید.'); return; }
    if (!confirm('مانده افتتاحیه «' + (CATEGORY[rec.category] || rec.category) + '» ابطال شود؟ رکورد برای ردگیری حفظ می‌شود.')) return;
    rec.status = 'void'; rec.voidAt = nowText(); rec.voidBy = userName(); saveSnaps(all); auditSafe('ابطال مانده افتتاحیه ' + rec.cd, rec.cd); wcRender();
  };
  window.wcReportHtml = function (d) {
    d = d || window.ptfFinanceOfficialData(); var c = d.cfg, t = d.total, s = d.source, o = d.opening;
    function row(a, b) { return '<tr><td>' + a + '</td><td>' + b + '</td></tr>'; }
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش تجمیعی وضعیت مالی</title><style>body{font-family:Tahoma,Vazirmatn,sans-serif;color:#111;padding:22px;direction:rtl}h1{font-size:19px;margin:0 0 5px}h2{font-size:15px;margin:22px 0 7px}p{font-size:12px;line-height:1.8}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}td,th{border:1px solid #94a3b8;padding:7px;text-align:right}th{background:#e2e8f0}.total{font-size:15px;font-weight:bold;background:#f0fdf4}.warn{background:#fff7ed;border:1px solid #fed7aa;padding:9px;border-radius:7px;font-size:11.5px}</style></head><body><h1>گزارش تجمیعی وضعیت مالی و سرمایه در گردش</h1><p>سال مالی: <b>' + esc(c.fiscalYear) + '</b> | بازه: ' + esc(c.startFa) + ' تا ' + esc(c.endFa) + ' | وضعیت تا: ' + esc(d.asOfFa) + '</p><p>این گزارش شامل مبالغ رسمی و غیررسمی با هم است (برای تراز جداگانه به گزارش «تراز رسمی/غیررسمی» مراجعه کنید) و فقط از داده‌های ثبت‌شده در CRM تهیه شده؛ دفترکل قانونی یا صورت جریان نقدی بانکی نیست. مانده افتتاحیه فقط برای ارقام فاقد سند عملیاتی در سامانه افزوده شده است.</p><h2>مانده‌های گزارش</h2><table><thead><tr><th>سرفصل</th><th>افتتاحیه دستی</th><th>اسناد فعال</th><th>جمع گزارش</th></tr></thead><tbody>' + row('مطالبات مشتریان', money(o.receivable) + ' + ' + money(s.receivable) + ' = <b>' + money(t.receivable) + '</b>') + row('بدهی تأمین‌کنندگان', money(o.supplier_liability) + ' + ' + money(s.supplierLiability) + ' = <b>' + money(t.supplierLiability) + '</b>') + row('اعتبار نزد تأمین‌کنندگان', money(o.supplier_credit) + ' + ' + money(s.supplierCredit) + ' = <b>' + money(t.supplierCredit) + '</b>') + row('چک‌های شرکتی باز', money(o.company_cheque) + ' + ' + money(s.companyCheque) + ' = <b>' + money(t.companyCheque) + '</b>') + row('وجه نقد/بانک افتتاحیه', money(o.cash_bank) + ' = <b>' + money(t.cashBank) + '</b>') + '<tr class="total"><td>خالص سرمایه در گردش ثبتی</td><td colspan="3">' + money(t.netWorkingCapital) + '</td></tr></tbody></table><h2>گردش ثبت‌شده در سال</h2><table><tbody>' + row('فاکتور مشتری صادرشده', money(d.moves.customerInvoices)) + row('وصولی مشتری', money(d.moves.customerReceipts)) + row('فاکتور تأمین‌کننده', money(d.moves.supplierInvoices)) + row('پرداخت تأمین‌کننده', money(d.moves.supplierPayments)) + row('چک شرکتی صادرشده', money(d.moves.companyCheques)) + '</tbody></table><h2>مانده‌های افتتاحیه قابل ردیابی</h2><table><thead><tr><th>شناسه</th><th>سرفصل</th><th>مبلغ</th><th>شرح/مبنا</th></tr></thead><tbody>' + arr(d.openingEntries).map(function (r) { return '<tr><td>' + esc(r.cd) + '</td><td>' + esc(CATEGORY[r.category] || r.category) + '</td><td>' + money(r.amountIrr) + '</td><td>' + esc(r.note || '') + '</td></tr>'; }).join('') + (d.openingEntries.length ? '' : '<tr><td colspan="4">موردی ثبت نشده است</td></tr>') + '</tbody></table></body></html>';
  };
  window.wcPrint = function () { var d = window.ptfFinanceOfficialData(), h = window.wcReportHtml(d); if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش تجمیعی وضعیت مالی — ' + d.cfg.fiscalYear, h, 'official-financial-position-' + d.cfg.fiscalYear); return; } alert('پیش‌نمایش داخلی در این نسخه بارگذاری نشده است.'); };
  window.wcCsv = function () {
    var d = window.ptfFinanceOfficialData(), t = d.total, o = d.opening, s = d.source;
    var rows = [['گزارش تجمیعی وضعیت مالی', d.cfg.fiscalYear], ['بازه', d.cfg.startFa + ' تا ' + d.cfg.endFa], ['وضعیت تا', d.asOfFa], [], ['سرفصل', 'افتتاحیه دستی', 'اسناد فعال', 'جمع گزارش'], ['مطالبات مشتریان', o.receivable, s.receivable, t.receivable], ['بدهی تأمین‌کنندگان', o.supplier_liability, s.supplierLiability, t.supplierLiability], ['اعتبار نزد تأمین‌کنندگان', o.supplier_credit, s.supplierCredit, t.supplierCredit], ['چک‌های شرکتی باز', o.company_cheque, s.companyCheque, t.companyCheque], ['وجه نقد/بانک افتتاحیه', o.cash_bank, 0, t.cashBank], ['خالص سرمایه در گردش ثبتی', '', '', t.netWorkingCapital], [], ['گردش ثبت‌شده در سال', 'مبلغ'], ['فاکتور مشتری صادرشده', d.moves.customerInvoices], ['وصولی مشتری', d.moves.customerReceipts], ['فاکتور تأمین‌کننده', d.moves.supplierInvoices], ['پرداخت تأمین‌کننده', d.moves.supplierPayments], ['چک شرکتی صادرشده', d.moves.companyCheques]];
    var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'official-financial-position-' + d.cfg.fiscalYear + '.csv'; a.click(); auditSafe('خروجی CSV گزارش تجمیعی مالی سال ' + d.cfg.fiscalYear, ''); } catch (e) {}
    return csv;
  };

  /* buildPetty is already a chain of extension hooks; add exactly one guarded hook. */
  var old = window.buildPetty;
  if (typeof old === 'function' && !window._wc281Hooked) { window._wc281Hooked = true; window.buildPetty = function () { return old() + html(); }; }
})();
