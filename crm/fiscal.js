/* =====================================================================
   PTF CRM — v31.9
   US-420 + BUG-024 + BUG-025 + US-426 فاز ۱
   داشبورد سال مالی + تقسیم سود + سخت‌سازی محرمانگی + گزارش رسمی/ردیابی اعداد
   ===================================================================== */
(function () {
  'use strict';
  var SNAP_KEY = 'ptf_crm_fiscal_snapshots';
  function canFiscal() { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; }
  /* AUD-11 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md، تصمیم صریح کارفرما):
     قبلاً فقط admin/chairman بود، در حالی که هاب مالی (financehub.js#canHub)
     تب «سال مالی» را برای ceo/commercial هم قابل‌کلیک نشان می‌داد — یعنی
     این دو نقش با کلیک روی تب، به یک تب همیشه-خالی می‌رسیدند (بدون هیچ
     پیام دسترسی). کارفرما تصریح کرد ceo/commercial باید دسترسی کامل به
     سال مالی/سهامداران داشته باشند، هم‌راستا با تعریف ROLES.finance در
     rbac.js که همین چهار نقش را finance:true می‌داند. */
  /* قفل‌گشایی عمداً محدود به رییس هیات مدیره است؛ admin/سایر مدیران فقط گزارش را می‌بینند. */
  function canFiscalUnlock() { try { return curRole() === 'chairman'; } catch (e) { return false; } }
  function snaps() { var a = getData(SNAP_KEY); return Array.isArray(a) ? a : []; }
  function saveSnaps(a) { setData(SNAP_KEY, a || []); }
  function fiscalNowIso() { return new Date().toISOString(); }
  function findLocked(year) { return snaps().filter(function (s) { return s && String(s.year) === String(year) && s.locked === true; })[0]; }
  window.ptfFiscalYearLocked = function (year) { return !!findLocked(normFiscalYear(year)); }; /* v34.0.5-alpha */
  function lastUnlocked(year) {
    var a = snaps().filter(function (s) { return s && String(s.year) === String(year) && s.unlockedAt; });
    a.sort(function (x, y) { return String(y.unlockedAtISO || y.unlockedAt || '').localeCompare(String(x.unlockedAtISO || x.unlockedAt || '')); });
    return a[0];
  }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function fiscalIcon(kind) {
    var p = kind === 'lock'
      ? '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
      : '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4M8 14h3M8 17h6"/>';
    return '<span class="ptf-fiscal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg></span>';
  }
  function n(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function yearNow() { try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric' }).format(new Date()).replace(/\D/g, ''); } catch (e) { return (typeof faYear === 'function' ? faYear() : '1405'); } }
  function fiscalYearOf(s) {
    var t = String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var m = t.match(/(13|14)\d{2}/);
    return m ? m[0] : '';
  }
  window.ptfFiscalYearOf = fiscalYearOf;
  function yearOf(s) { return fiscalYearOf(s); }
  /* ===== v34.0.5-alpha (BUG-FISCAL-YEAR-001 — گزارش کارفرما: «۱۴۰۴ همان اعداد ۱۴۰۵ را نشان داد») =====
     ریشه: ورودی سال فارسی/عربی («۱۴۰۴») → fiscalYearBoundsISO بازهٔ خالی ('') برمی‌گرداند و
     cashInRange با start/end خالی فیلتر سال را بی‌اثر می‌کرد → مجموع همهٔ سال‌ها نمایش داده می‌شد.
     رفع: نرمال‌سازی ارقام فارسی/عربی به لاتین در همهٔ نقاط ورود سال. */
  function normFiscalYear(y) {
    var t = fiscalYearOf(y);
    if (t) return t;
    var d = String(y == null ? '' : y).replace(/[۰-۹]/g, function (x) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(x); }).replace(/[٠-٩]/g, function (x) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(x); }).replace(/[^\d]/g, '');
    if (/^\d{4}$/.test(d)) return d;
    return yearNow();
  }

  /* v34.0.5-alpha: نرمال‌سازی ورودی درصد تقسیم (ارقام فارسی/عربی → عدد ۰ تا ۱۰۰) + رندر */
  window.ptfFiscalPctChange = function (el) {
    var v = String(el && el.value != null ? el.value : '').replace(/[۰-۹]/g, function (dd) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(dd); }).replace(/[٠-٩]/g, function (dd) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(dd); });
    window._fiscalDistPct = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    ptfFiscalRender();
  };

  /* v34.0.5-alpha: فهرست سال‌های قابل انتخاب (از داده‌های واقعی + سال جاری ±۱) — ارقام لاتین */
  function fiscalYearOptions(curYear) {
    var set = {}, yn = yearNow();
    set[yn] = 1; set[String(+yn - 1)] = 1; set[String(+yn + 1)] = 1;
    if (curYear) set[String(curYear)] = 1;
    function add(v) { var y = fiscalYearOf(v); if (y) set[y] = 1; }
    try {
      (getData('ptf_crm_projects') || []).forEach(function (x) { add(srcDate(x)); });
      (getData('ptf_crm_deals') || []).forEach(function (x) { add(srcDate(x)); });
      (getData('ptf_crm_invoices') || []).forEach(function (x) { add(invDate(x)); });
      (getData('ptf_crm_sharetx') || []).forEach(function (x) { add(x.t || x.month); });
      (getData('ptf_crm_cheques_issued') || []).forEach(function (x) { add(x.issueISO || x.createdISO || x.t); });
      (getData('ptf_crm_petty') || []).forEach(function (x) { add(x.month || x.iso || x.t); });
      snaps().forEach(function (x) { add(x.year || x.refYear); });
    } catch (e) {}
    return Object.keys(set).sort(function (a, b) { return +b - +a; });
  }
  function lossTotal(o) { return (typeof ptfProjectLossTotal === 'function') ? ptfProjectLossTotal(o) : ((o && o.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0)) }
  function hasHardWarning(r) { return (r.warnings || []).some(function (w) { return /^[⛔⚠️]/.test(String(w)); }); }
  function srcDate(o) { return o.closedAt || o.t || o.wonAt || o.createdAt || o.iso || o.date || ''; }
  function invDate(inv) { return inv.t || inv.date || inv.createdAt || inv.iso || inv.issueDate || ''; }

  function collectCandidates(year) {
    var out = { items: [], undated: [] };
    getData('ptf_crm_projects').forEach(function (p) {
      if (!(p.closeKind === 'settled' || p.offerNo || lossTotal(p))) return;
      var ds = srcDate(p), y = yearOf(ds);
      if (!y) { out.undated.push({ no: p.no || p.cd || p.inqNo, buyerCo: p.buyerCo || '', kind: 'project', reason: 'پرونده/بایگانی بدون تاریخ شناسایی سال مالی', date: ds || '' }); return; }
      if (String(y) !== String(year)) return;
      out.items.push(Object.assign({ _kind: 'project', _date: y, _dateSrc: ds }, p));
    });
    getData('ptf_crm_deals').forEach(function (d) {
      if (!d.wonOffer || d.st === 'archived') return;
      var ds = srcDate(d), y = yearOf(ds);
      if (!y) { out.undated.push({ no: d.no || d.cd || d.inqNo, buyerCo: d.buyerCo || '', kind: 'deal', reason: 'پرونده فروش برنده بدون تاریخ شناسایی سال مالی', date: ds || '' }); return; }
      if (String(y) !== String(year)) return;
      out.items.push({ _kind: 'deal', no: d.cd, offerNo: d.wonOffer || d.offerNo, inqNo: d.inqNo, buyerCo: d.buyerCo, lossEvents: d.lossEvents || [], _date: y, _dateSrc: ds });
    });
    return out;
  }

  function costSum(list) { return (Array.isArray(list) ? list : []).reduce(function (s, x) { return s + (+x.amt || +x.amount || 0); }, 0); }
  function findDealForFiscal(p) {
    var keys = [p && p.cd, p && p.no, p && p.inqNo, p && p.offerNo].filter(Boolean);
    return (getData('ptf_crm_deals') || []).filter(function (d) {
      return keys.indexOf(d.cd) > -1 || keys.indexOf(d.inqNo) > -1 || keys.indexOf(d.wonOffer) > -1 || keys.indexOf(d.offerNo) > -1;
    })[0] || null;
  }
  function fiscalDirectProjectCosts(p) {
    var d = findDealForFiscal(p);
    var dealCosts = costSum(d && d.costEvents);
    var projectCosts = costSum(p && p.costEvents) + costSum(p && p.postArchiveCosts);
    /* P0-3 FIX: قبلاً Math.max بود که هزینه‌های کوچک‌تر را نادیده می‌گرفت.
       هزینه‌های پرونده و پروژه باید جمع شوند (هر دو منبع هزینه هستند، نه جایگزین). */
    return (dealCosts || 0) + (projectCosts || 0);
  }
  function fiscalPettyStandalone(year) {
    var out = { total: 0, count: 0, pending: 0, pendingCount: 0, rows: [] };
    (getData('ptf_crm_petty') || []).forEach(function (p) {
      if (!p || p.st === 'void' || p.dealRef) return;
      var y = yearOf(p.month || p.iso || p.t || '');
      if (String(y) !== String(year)) return;
      var amt = +p.amt || 0;
      out.total += amt;
      out.count++;
      if (p.st !== 'settled') { out.pending += amt; out.pendingCount++; }
      if (out.rows.length < 12) out.rows.push({ cd: p.cd || '', cat: p.cat || '', by: p.by || '', amt: amt, st: p.st || '', t: p.t || p.iso || '' });
    });
    return out;
  }
  /* ===== v34.0.8-alpha (فاز ۱ — فاکتور صوری/پوششی) =====
     تعریف کارفرما: فاکتور صوری پوششی «خرید واقعی کالا نیست»؛ پس مبلغ اسمی آن نباید
     هزینهٔ کامل شود. فقط «درصد کارمزد فاکتورساز» (مثلاً ۱.۵/۲/۳٪) هزینه است و در عوض
     «اعتبار ارزش‌افزوده» (VAT) منفعت ایجاد می‌کند. یعنی اثر بر سود = اعتبار ارزش‌افزوده − کارمزد.
     مثال: فاکتور ۱۰۰م با ۱۰م ارزش‌افزوده و کارمزد ۱.۵٪ → کارمزد ۱.۵م هزینه، اعتبار ۱۰م،
     خالص منفعت ۸.۵م. این تابع فقط فاکتورهای پوششیِ همان سال را جمع می‌کند. */
  function fiscalCoverTotals(year) {
    var out = { count: 0, commission: 0, vat: 0, netBenefit: 0, rows: [] };
    try {
      var sf = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}');
      if (!sf || Array.isArray(sf)) sf = {};
      var b = fiscalYearBoundsISO(year);
      (sf.invoices || []).forEach(function (i) {
        if (!i || i.status === 'void' || i.isCover !== true) return;
        var iso = cashIsoOf(i.dateISO || i.date || i.t);
        if (!cashInRange(iso, b.startISO, b.endISO)) return;
        var base = (i.cur && i.cur !== 'IRR') ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0);
        var comm = (+i.coverCommissionAmount != null && +i.coverCommissionAmount > 0) ? (+i.coverCommissionAmount || 0) : Math.round(base * (+i.coverCommissionPct || 0) / 100);
        var vat = (+i.coverVatAmount != null && +i.coverVatAmount > 0) ? (+i.coverVatAmount || 0) : Math.round(base * (+i.coverVatPct || 0) / 100);
        out.count++; out.commission += comm; out.vat += vat; out.netBenefit += (vat - comm);
        if (out.rows.length < 12) out.rows.push({ no: i.no || '', supplierCd: i.supplierCd || '', base: base, commission: comm, vat: vat, netBenefit: vat - comm });
      });
    } catch (e) {}
    return out;
  }

  window.ptfFiscalData = function (year) {
    year = normFiscalYear(year);
    var rows = [], incomplete = [], projectProfit = 0, projectLossOnly = 0;
    var cand = collectCandidates(year);
    cand.items.forEach(function (p) {
      var loss = lossTotal(p);
      var r = (typeof ptfProjectProfitIRR === 'function') ? ptfProjectProfitIRR(p) : { ok: false, warnings: ['موتور سود بارگذاری نشده'] };
      var directCosts = fiscalDirectProjectCosts(p);
      if (r && r.profit != null && directCosts > (+r.projectCostIrr || 0)) {
        var missingCost = directCosts - (+r.projectCostIrr || 0);
        r.projectCostIrr = directCosts;
        r.profit -= missingCost;
        if (r.sellIrr > 0) r.pct = Math.round(r.profit * 100 / r.sellIrr);
        r.warnings = r.warnings || [];
        r.warnings.push('➕ هزینه‌های مستقیم پرونده در سود سال مالی کسر شد: ' + missingCost.toLocaleString('fa-IR') + ' ریال');
      }
      var hard = !r.ok || !r.complete || (r.buyPendingFx || []).length || hasHardWarning(r) || (r.sellIrr > 0 && !r.buyIrr && !loss);
      if (!hard && r.profit != null) {
        projectProfit += (+r.profit || 0);
        rows.push({ no: p.no || p.cd || p.inqNo, buyerCo: p.buyerCo || '', profit: +r.profit || 0, loss: loss, kind: p._kind, date: p._dateSrc || '', sellIrr: r.sellIrr || 0, buyIrr: r.buyIrr || 0, projectCostIrr: +r.projectCostIrr || 0, complete: true, warnings: r.warnings || [] });
      } else if (loss && (!r.sellIrr || r.profit == null)) {
        projectProfit -= loss;
        projectLossOnly += loss;
        rows.push({ no: p.no || p.cd || p.inqNo, buyerCo: p.buyerCo || '', profit: -loss, loss: loss, kind: p._kind, date: p._dateSrc || '', complete: true, lossOnly: true, warnings: ['زیان قطعی بدون فروش/دریافت قابل اتکا'] });
      } else {
        incomplete.push({ no: p.no || p.cd || p.inqNo, buyerCo: p.buyerCo || '', kind: p._kind, date: p._dateSrc || '', warnings: (r.warnings || []).concat((r.sellIrr > 0 && !r.buyIrr && !loss) ? ['فروش/CO دارد اما خرید واقعی یا زیان تعیین‌تکلیف‌شده ندارد'] : []) });
      }
    });
    var ox = (typeof ptfOpexSumFiscal === 'function') ? ptfOpexSumFiscal(year) : (typeof ptfOpexSum === 'function' ? (function(){ var s=ptfOpexSum(year); return {total: s.totalUnlinked!=null ? s.totalUnlinked : s.total, byCat: s.byCat}; })() : { total: 0, byCat: {} });
    var openTotal = 0, openYear = 0, invUndated = [];
    getData('ptf_crm_invoices').forEach(function (inv) {
      if (inv.status === 'void' || inv.st === 'void' || inv.void === true) return;
      var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : ((inv.payments || []).concat(inv.pays || [])).reduce(function (z, p) { return z + (window.PTF && PTF.paymentAmtIrr ? PTF.paymentAmtIrr(p) : (+p.amt || 0)); }, 0);
      var rem = Math.max(0, (+inv.amount || 0) - paid);
      if (!rem) return;
      openTotal += rem;
      var ds = invDate(inv), y = yearOf(ds);
      if (!y) { invUndated.push({ no: inv.no || inv.cd, offerNo: inv.offerNo || '', amount: +inv.amount || 0, remain: rem, reason: 'فاکتور باز بدون تاریخ شناسایی سال مالی' }); return; }
      if (String(y) === String(year)) openYear += rem;
    });
    /* v19.5 (US-427): سندهای اصلاحی موثر بر این سال — snapshot قفل‌شده گذشته هرگز ویرایش نمی‌شود؛
       اصلاح حسابرسی به‌صورت سند اصلاحی در سال جاری اثر می‌گذارد. ذخیره در همان کلید snapshots
       (type:'amendment') تا کلید داده جدید ساخته نشود (سینک/GUARD/whitelist موجود). */
    var amendments = snaps().filter(function (x) { return x.type === 'amendment' && String(x.effectYear) === String(year); });
    var amendTotal = amendments.reduce(function (z, x) { return z + (+x.amt || 0); }, 0);
    var pettyStandalone = fiscalPettyStandalone(year);
    /* v34.0.8-alpha (فاز ۱): منفعت خالص فاکتورهای صوری/پوششی (اعتبار ارزش‌افزوده − کارمزد) به سود اضافه می‌شود.
       مبلغ اسمی فاکتور پوششی در projectProfit نیامده (خودش خرید نیست)؛ بنابراین افزودن اینجا دوباره‌شماری نمی‌سازد. */
    var cover = fiscalCoverTotals(year);
    var net = projectProfit - (+ox.total || 0) - (+pettyStandalone.total || 0) + amendTotal + (+cover.netBenefit || 0); /* legacy UAT netProfit += amendTotal: var net = projectProfit - (+ox.total || 0) + amendTotal; */
    /* Sprint 281: the official financial position is a read-only derived attachment.
       It is included only when its configured fiscal year matches this report, so
       an old selected year can never silently receive today's position. */
    var financialPosition = null;
    try {
      if (typeof window.ptfFinanceOfficialData === 'function') {
        var fp = window.ptfFinanceOfficialData();
        if (fp && fp.cfg && String(fp.cfg.fiscalYear) === String(year)) financialPosition = fp;
      }
    } catch (eFP) {}
    return { year: year, projects: rows, incomplete: incomplete, undated: cand.undated, invoiceUndated: invUndated, projectProfit: projectProfit, projectLossOnly: projectLossOnly, opexTotal: +ox.total || 0, opexByCat: ox.byCat || {}, pettyStandaloneTotal: +pettyStandalone.total || 0, pettyStandaloneCount: pettyStandalone.count || 0, pettyStandalonePending: +pettyStandalone.pending || 0, pettyStandalonePendingCount: pettyStandalone.pendingCount || 0, pettyStandaloneRows: pettyStandalone.rows || [], coverCount: cover.count || 0, coverCommission: cover.commission || 0, coverVat: cover.vat || 0, coverNetBenefit: cover.netBenefit || 0, openReceivables: openTotal, openReceivablesTotal: openTotal, openReceivablesYear: openYear, amendments: amendments, amendTotal: amendTotal, netProfit: net, financialPosition: financialPosition };
  };

  window.ptfFiscalDistribution = function (year, distPct) {
    var d = ptfFiscalData(year);
    distPct = Math.max(0, Math.min(100, n(distPct == null ? 60 : distPct)));
    var distributable = Math.max(0, d.netProfit) * distPct / 100;
    var reserve = Math.max(0, d.netProfit) - distributable;
    var shareholders = getData('ptf_crm_shareholders').filter(function (s) { return s.active !== false; }).map(function (s) {
      var bal = (typeof ptfShareholderBalance === 'function') ? ptfShareholderBalance(s.cd) : { net: 0 };
      var gross = distributable * (+s.pct || 0) / 100;
      return { cd: s.cd, name: s.name, pct: +s.pct || 0, gross: Math.round(gross), currentBalance: Math.round(bal.net || 0), final: Math.round(gross + (bal.net || 0)) };
    });
    return Object.assign(d, { distPct: distPct, reservePct: 100 - distPct, distributable: Math.round(distributable), reserve: Math.round(reserve), shareholders: shareholders });
  };

  /* =====================================================================
     v33.10.0 — منطق نقدی سود و تقسیم (مصوب کارفرما ۱۴۰۵/۰۸/۱۱):
     «فروش‌ها منبع درآمدند نه مبنای واقعی؛ درآمد واقعی = وصول مطالبات.
      هزینه‌ها از درآمد کسر می‌شوند؛ خریدها نقدی و غیرنقدی (شامل چک‌های صادره
      حتی بابت مسائل دیگر) از درآمد کسر می‌شوند. کف نقدینگی در گردش باید باشد؛
      بیش از آن با درصد توافقی تقسیم می‌شود و باقی (مثلا ۴۰٪) به کف اضافه می‌شود.»
     تصمیمات تکمیلی کارفرما: مبنای مازاد = موجودی نقد پایان دوره − کف؛
     چک وارده درآمد در لحظه وصول؛ بدون دوباره‌شماری؛ کف = عدد دستی.
     ===================================================================== */
  function fiscalYearBoundsISO(year) {
    year = normFiscalYear(year); /* v34.0.5-alpha */
    var startISO = (typeof ptfJToISO === 'function') ? ptfJToISO(String(year) + '/01/01') : '';
    var nextISO = (typeof ptfJToISO === 'function') ? ptfJToISO((+year + 1) + '/01/01') : '';
    var endISO = '';
    if (nextISO) { var d = new Date(nextISO + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); endISO = d.toISOString().slice(0, 10); }
    return { startISO: startISO, endISO: endISO };
  }
  function cashIsoOf(v) {
    var s = String(v || '').trim(); if (!s) return '';
    var m = s.match(/(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
    var j = s.match(/([۰-۹٠-٩0-9]{4}\s*[\/-]\s*[۰-۹٠-٩0-9]{1,2}\s*[\/-]\s*[۰-۹٠-٩0-9]{1,2})/);
    if (j && typeof ptfJToISO === 'function') return ptfJToISO(j[1]) || '';
    return '';
  }
  function cashInRange(iso, start, end) { return !!iso && (!start || iso >= start) && (!end || iso <= end); }
  /* کف نقدینگی در گردش (عدد دستی — ذخیره در snapshots) */
  window.ptfFiscalCashFloor = function (year) {
    year = normFiscalYear(year);
    var all = snaps().filter(function (s) { return s && s.type === 'cash_floor' && String(s.year) === year; });
    all.sort(function (a, b) { return String(b.updatedAt || b.t || '').localeCompare(String(a.updatedAt || a.t || '')); });
    return all[0] ? Math.max(0, +all[0].floor || 0) : 0;
  };
  window.ptfFiscalCashFloorSet = function (year, floor) {
    if (!canFiscal()) { alert('⛔ فقط مدیران ارشد'); return false; }
    year = normFiscalYear(year);
    floor = Math.max(0, n(floor));
    var rec = { cd: genCode('FLR'), type: 'cash_floor', year: year, floor: floor, updatedAt: faDateTime(), updatedBy: (curSession() || {}).name };
    var a = snaps(); a.unshift(rec); saveSnaps(a);
    try { audit('سال مالی', 'تنظیم کف نقدینگی در گردش سال ' + year + ' — ' + money(floor), rec.cd); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('کف نقدینگی سال ' + year + ' ذخیره شد', 'ok');
    return true;
  };
  /* دادهٔ سود نقدی سال (بدون دوباره‌شماری) */
  window.ptfFiscalCashData = function (year) {
    year = normFiscalYear(year);
    var d = ptfFiscalData(year);
    var b = fiscalYearBoundsISO(year), start = b.startISO, end = b.endISO;
    var openingCash = 0;
    try {
      if (typeof window.ptfFinanceOfficialData === 'function') {
        var fp = window.ptfFinanceOfficialData();
        if (fp && fp.opening) openingCash = +fp.opening.cash_bank || 0;
      }
    } catch (e) {}
    /* درآمد نقدی = وصولی‌های دوره (نقد + چک وصول‌شده) */
    var receipts = 0, chqPending = 0;
    var receivedSt = {};
    try {
      (getData('ptf_crm_cheques_received') || []).forEach(function (c) { if (c && c.cd) receivedSt[c.cd] = c.st || 'open'; });
      (getData('ptf_crm_cheques') || []).forEach(function (c) { if (c && c.cd && !receivedSt[c.cd]) receivedSt[c.cd] = c.st || 'open'; });
    } catch (eR) {}
    (getData('ptf_crm_invoices') || []).forEach(function (inv) {
      if (!inv || inv.status === 'void' || inv.st === 'void' || inv.void === true) return;
      (inv.payments || []).concat(inv.pays || []).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : function(){return true}).forEach(function (p) {
        if (!p || p.status === 'void') return;
        var amt = +p.amt || +p.amount || 0; if (!amt) return;
        var iso = cashIsoOf(p.dateISO || p.date || p.t || p.paidAt || inv.t);
        if (!cashInRange(iso, start, end)) return;
        if (p.chequeCd) { if (receivedSt[p.chequeCd] === 'cleared') receipts += amt; else chqPending += amt; }
        else receipts += amt;
      });
    });
    /* خروجی‌های دوره (بدون دوباره‌شماری) */
    var out = { supplierInvoices: 0, unallocatedPayments: 0, independentCheques: 0, opex: +d.opexTotal || 0, petty: +d.pettyStandaloneTotal || 0, coverCommission: 0, coverVat: 0, coverNetBenefit: 0, coverCount: 0 };
    try {
      var sf = {};
      try { sf = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); if (!sf || Array.isArray(sf)) sf = {}; } catch (eS) {}
      (sf.invoices || []).forEach(function (i) {
        if (!i || i.status === 'void') return;
        var iso = cashIsoOf(i.dateISO || i.date || i.t);
        if (!cashInRange(iso, start, end)) return;
        /* v34.0.8-alpha (فاز ۱): فاکتور صوری/پوششی خرید واقعی نیست — مبلغ اسمی در خروجیِ نقدی
           نمی‌آید؛ فقط «کارمزد» (هزینهٔ واقعیِ نقدی) خروجی است و اعتبار ارزش‌افزوده منفعتِ جدا. */
        if (i.isCover === true) {
          var cbase = (i.cur && i.cur !== 'IRR') ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0);
          var ccomm = (+i.coverCommissionAmount != null && +i.coverCommissionAmount > 0) ? (+i.coverCommissionAmount || 0) : Math.round(cbase * (+i.coverCommissionPct || 0) / 100);
          var cvat = (+i.coverVatAmount != null && +i.coverVatAmount > 0) ? (+i.coverVatAmount || 0) : Math.round(cbase * (+i.coverVatPct || 0) / 100);
          out.coverCount++; out.coverCommission += ccomm; out.coverVat += cvat; out.coverNetBenefit += (cvat - ccomm);
          return;
        }
        out.supplierInvoices += (i.cur && i.cur !== 'IRR') ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0);
      });
      (getData('ptf_crm_payables') || []).forEach(function (p) {
        /* v34.0.12-alpha (فاز ۹ — هماهنگ با فاز ۳/۶): «تعهد لگاسی» دیگر به‌عنوان هزینه/خروجی نقدیِ
           سود شمرده نمی‌شود. تعهدِ legacy (pay:'credit') فقط دادهٔ تاریخیِ پیش از زیر‌دفتر است و
           مبنای تعهد، فاکتور خرید ثبت‌شده است (خریدِ تعهدی بی‌معناست). این‌جا عمداً صرف‌نظر می‌شود
           تا با balance()/working-capital (که legacy را از مبلغ حذف کرده‌اند) یک‌دست شود و
           دوباره‌شماری (تعهد + فاکتورِ هم‌مبلغ) در سود نقدی رخ ندهد. */
        if (!p || p.pay !== 'credit' || p.status === 'void' || p.sfInvoiceCd) return;
        /* legacy دیگر در خروجی نقدی سود نمی‌آید (فقط اطلاع‌رسانی/گزارش جدا) */
      });
      (sf.adjustments || []).forEach(function (a) {
        if (!a || a.status === 'void') return;
        var iso = cashIsoOf(a.dateISO || a.date || a.t);
        if (!cashInRange(iso, start, end)) return;
        var v = (a.cur && a.cur !== 'IRR') ? (+a.amount || 0) * (+a.rate || 0) : (+a.amount || 0);
        if (v >= 0) out.supplierInvoices += v; else out.unallocatedPayments += -v;
      });
      (sf.payments || []).forEach(function (p) {
        if (!p || p.status === 'void') return;
        var iso = cashIsoOf(p.dateISO || p.date || p.t);
        if (!cashInRange(iso, start, end)) return;
        var alloc = (p.allocations || []).reduce(function (s, a) { return s + (+a.amount || 0); }, 0);
        var unalloc = Math.max(0, (+p.amount || 0) - alloc);
        if (unalloc > 0 && p.method !== 'cheque' && !p.chequeCd) out.unallocatedPayments += unalloc;
      });
      /* چک‌های صادرهٔ مالی مستقل (بدون payment تامین‌کننده → بدون دوباره‌شماری با فاکتور) */
      var issued = (getData('ptf_crm_cheques_issued') || []).slice();
      (getData('ptf_crm_cheques') || []).forEach(function (c) {
        if (c && c.cd && c.kind !== 'guarantee' && c.ownership === 'company' && !issued.some(function (x) { return x.cd === c.cd; })) issued.push(c);
      });
      issued.forEach(function (c) {
        if (!c || c.kind === 'guarantee' || c.st === 'void') return; /* ضمانت: تعهد مستردشدنی — خروج نقدی نیست */
        var iso = cashIsoOf(c.issueISO || c.createdISO || c.dateISO || c.t);
        if (!cashInRange(iso, start, end)) return;
        if (c.supplierPaymentCd) return; /* payment دارد → فاکتور قبلاً کسر شده */
        out.independentCheques += +c.amt || 0;
      });
    } catch (eC) {}
    /* کارمزد فاکتور پوششی خروجیِ نقدی واقعی است (نقد پرداخت می‌شود)؛ اعتبار ارزش‌افزوده نقد نیست
       و به موجودی/قابل تقسیم اضافه نمی‌شود — فقط در «منفعت» گزارش می‌شود. */
    /* تأمین نقدی سهامدار (واریز فراخوان / مازاد) نقد واقعی است؛ تهاتر طلب (fromCredit/noCash) نقد نیست. */
    var shareholderInject = 0;
    try {
      (getData('ptf_crm_sharetx') || []).forEach(function (x) {
        if (!x || x.status === 'void' || x.voided) return;
        if (x.type !== 'call_pay' && x.type !== 'call_over') return;
        if (x.fromCredit || x.noCash) return;
        var iso = cashIsoOf(x.t || x.month || '');
        if (!iso && fiscalYearOf(x.t || x.month || '') === String(year)) shareholderInject += (+x.amt || 0);
        else if (cashInRange(iso, start, end)) shareholderInject += (+x.amt || 0);
      });
    } catch (eInj) {}
    var outflowsTotal = out.supplierInvoices + out.unallocatedPayments + out.independentCheques + out.opex + out.petty + out.coverCommission;
    var netCash = receipts + shareholderInject - outflowsTotal;
    var cashEnd = openingCash + netCash;
    return { year: year, openingCash: openingCash, receipts: receipts, shareholderInject: shareholderInject, pendingCheques: chqPending, outflows: out, outflowsTotal: outflowsTotal, netCash: netCash, cashEnd: cashEnd, floor: window.ptfFiscalCashFloor(year), coverCount: out.coverCount, coverCommission: out.coverCommission, coverVat: out.coverVat, coverNetBenefit: out.coverNetBenefit };
  };
  /* توزیع نقدی: مازاد بر کف → تقسیم (٪ توافقی) + بازگشت به کف */
  window.ptfFiscalCashDistribution = function (year, distPct) {
    year = normFiscalYear(year); /* v34.0.5-alpha */
    var c = window.ptfFiscalCashData(year);
    /* v34.0.5-alpha (BUG-FISCAL-ADV-004 — درخواست کارفرما): برداشت‌های علی‌الحساب/بدهیِ همان سال
       (sharetx نوع draw/advance/debit با سال مالی جاری) باید از سهم سود هر سهامدار کسر شوند.
       توجه: ثبت سود همچنان «ناخالص» است تا دفتر درست بماند؛ کسر در «ماندهٔ قابل تسویهٔ امسال» دیده می‌شود.
       v34.0.8-alpha (فاز ۲): نوع salary_payment عمداً اینجا نیست — حقوق «مطالبهٔ سهامدار» است نه
       علی‌الحسابِ سود؛ پس پرداخت حقوق از سهم سود کسر نمی‌شود و ستون «ماندهٔ قابل تسویهٔ امسال» گمراه‌کننده نیست. */
    var advRows = [];
    try {
      advRows = (getData('ptf_crm_sharetx') || []).filter(function (x) {
        return x && !x.voided && x.status !== 'void' && (x.type === 'draw' || x.type === 'advance' || x.type === 'debit') && fiscalYearOf(x.t || x.month || '') === String(year);
      });
    } catch (eAdv) {}
    distPct = Math.max(0, Math.min(100, n(distPct == null ? 60 : distPct)));
    /* طلب باز از صندوق بدهی شرکت به سهامدار است، نه سود. از مازاد قابل‌تقسیم کنار گذاشته می‌شود تا دوباره تقسیم نشود. */
    var fundCreditTotal = 0;
    var fundDebtTotal = 0;
    getData('ptf_crm_shareholders').filter(function (s) { return s && s.active !== false; }).forEach(function (s) {
      var bal0 = (typeof ptfShareholderBalance === 'function') ? ptfShareholderBalance(s.cd) : {};
      fundCreditTotal += +bal0.callCredit || 0;
      fundDebtTotal += +bal0.callRemain || 0;
    });
    var over = Math.max(0, c.cashEnd - c.floor - fundCreditTotal);
    var distributable = Math.round(over * distPct / 100);
    var backToFloor = over - distributable;
    var shareholders = getData('ptf_crm_shareholders').filter(function (s) { return s.active !== false; }).map(function (s) {
      var bal = (typeof ptfShareholderBalance === 'function') ? ptfShareholderBalance(s.cd) : { net: 0 };
      var gross = distributable * (+s.pct || 0) / 100;
      var adv = advRows.reduce(function (z, x) { return z + (x.shCd === s.cd ? (+x.amt || 0) : 0); }, 0);
      return {
        cd: s.cd, name: s.name, pct: +s.pct || 0,
        gross: Math.round(gross), advYear: Math.round(adv), settleYear: Math.round(gross - adv),
        fundCredit: Math.round(+bal.callCredit || 0), fundDebt: Math.round(+bal.callRemain || 0),
        currentBalance: Math.round(bal.net || 0), final: Math.round(gross + (bal.net || 0))
      };
    });
    return Object.assign(c, {
      distPct: distPct, overFloor: over, distributable: distributable, backToFloor: backToFloor,
      shareholders: shareholders,
      advYearTotal: Math.round(advRows.reduce(function (z, x) { return z + (+x.amt || 0); }, 0)),
      fundCreditTotal: Math.round(fundCreditTotal), fundDebtTotal: Math.round(fundDebtTotal)
    });
  };
  /* ثبت واقعی تقسیم در دفاتر سهامداران (نوع profit در ptf_crm_sharetx) */
  window.ptfFiscalDividendApply = function (year, distPct) {
    if (!canFiscal()) { alert('⛔ فقط مدیران ارشد'); return { ok: false }; }
    year = normFiscalYear(year); /* v34.0.5-alpha */
    if (!findLocked(year)) { alert('🔒 ابتدا سال مالی را قفل کنید (دکمه «قفل سال» بالای داشبورد).'); return { ok: false }; }
    var d = window.ptfFiscalCashDistribution(year, distPct);
    if (d.distributable <= 0) { alert('مبلغ قابل تقسیم صفر است — موجودی نقد پایان (' + money(d.cashEnd) + ') از کف نقدینگی (' + money(d.floor) + ') بیشتر نیست.'); return { ok: false }; }
    var prev = snaps().filter(function (s) { return s && s.type === 'dividend' && String(s.year) === year; });
    if (prev.length) { alert('⚠️ تقسیم سود سال ' + year + ' قبلاً ثبت شده — برای ثبت مجدد ابتدا سند قبلی برگردانده شود.'); return { ok: false }; }
    var advTot = d.shareholders.reduce(function (z, s) { return z + (+s.advYear || 0); }, 0);
    if (!confirm('💰 ثبت تقسیم سود سال ' + year + '؟\n\nقابل تقسیم: ' + money(d.distributable) + '\nبازگشت به کف (' + (100 - d.distPct) + '٪): ' + money(d.backToFloor) + (advTot ? '\nعلی‌الحساب‌های ثبت‌شدهٔ این سال: ' + money(advTot) + ' ← در ماندهٔ هر سهامدار از سهم ناخالص او کسر می‌شود (بخش «مانده قابل تسویهٔ امسال» جدول)' : '') + '\n\nبرای ' + d.shareholders.length + ' سهامدار فعال در دفاتر ثبت می‌شود (سهم ناخالص؛ برداشت‌های قبلی خودکار خالص می‌شوند).')) return { ok: false };
    var made = 0;
    d.shareholders.forEach(function (s) {
      if (s.gross <= 0) return;
      var txs = getData('ptf_crm_sharetx') || [];
      txs.unshift({ cd: genCode('SHT'), shCd: s.cd, shName: s.name, type: 'profit', amt: s.gross, desc: 'تقسیم سود سال ' + year + ' (مازاد بر کف نقدینگی)', t: faDateTime(), month: String(year) + '/01', by: (curSession() || {}).name, dividendYear: year });
      setData('ptf_crm_sharetx', txs);
      made++;
    });
    var a = snaps(); a.unshift({ cd: genCode('DIV'), type: 'dividend', year: year, amount: d.distributable, backToFloor: d.backToFloor, floor: d.floor, distPct: d.distPct, advYearTotal: advTot, t: faDateTime(), by: (curSession() || {}).name });
    saveSnaps(a);
    try { audit('سال مالی', 'ثبت تقسیم سود سال ' + year + ' — ' + money(d.distributable) + ' بین ' + made + ' سهامدار؛ بازگشت به کف: ' + money(d.backToFloor), year); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('✅ تقسیم سود سال ' + year + ' در دفاتر سهامداران ثبت شد', 'ok');
    return { ok: true, made: made, distributable: d.distributable, backToFloor: d.backToFloor };
  };

  window.ptfFiscalCashFloorOpen = function () {
    if (!canFiscal()) { alert('⛔ فقط مدیران ارشد'); return; }
    var year = window._fiscalYear || yearNow();
    var cur = window.ptfFiscalCashFloor(year);
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '⚙️ کف نقدینگی در گردش — سال ' + year,
        body: 'حداقل موجودی نقد/بانکی که شرکت باید همیشه در گردش نگه دارد. تقسیم سود فقط از مازاد موجودی نقد پایان سال بر این کف انجام می‌شود (با درصد توافقی) و باقی به کف بازمی‌گردد.',
        fields: [{ id: 'floor', label: 'کف نقدینگی (ریال) *', type: 'number', value: cur ? cur.toLocaleString('en-US') : '', dir: 'ltr', required: true }],
        okText: 'ذخیره',
        onOk: function (v) {
          var f = (typeof ptfNum === 'function') ? ptfNum(v.floor) : (+String(v.floor || '').replace(/[^\d.-]/g, '') || 0);
          window.ptfFiscalCashFloorSet(year, f);
          ptfFiscalRender();
        }
      });
    } else {
      var f = prompt('کف نقدینگی (ریال) سال ' + year + ':', cur || '0');
      if (f == null) return;
      window.ptfFiscalCashFloorSet(year, f);
      ptfFiscalRender();
    }
  };

  function fiscalHtml() {
    if (!canFiscal()) return '';
    var year = normFiscalYear(window._fiscalYear); /* v34.0.5-alpha */
    var distPct = Math.max(0, Math.min(100, n(window._fiscalDistPct == null ? 60 : window._fiscalDistPct))); /* v34.0.5-alpha: رقم فارسی/رشته → عدد ۰ تا ۱۰۰ */
    var d = ptfFiscalDistribution(year, distPct);
    /* v33.10.0: منطق نقدی (مصوب کارفرما) — سود نقدی + کف نقدینگی + تقسیم */
    var c = window.ptfFiscalCashDistribution(year, distPct);
    var locked = findLocked(year);
    var incN = d.incomplete.length + d.undated.length + d.invoiceUndated.length;
    var incHtml = incN ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-danger" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;margin:10px 0;color:#991b1b;font-size:12.5px"><b>⚠️ ' + incN + ' مورد نیازمند تعیین تکلیف حسابرسی:</b><br>' + d.incomplete.slice(0, 6).map(function (x) { return '• ناقص سود: ' + escP(x.no || '-') + ' — ' + escP(x.buyerCo || '') + ': ' + escP((x.warnings || []).join(' | ')); }).join('<br>') + (d.undated.length ? '<br>' + d.undated.slice(0, 4).map(function (x) { return '• بدون تاریخ سال مالی: ' + escP(x.no || '-') + ' — ' + escP(x.reason); }).join('<br>') : '') + (d.invoiceUndated.length ? '<br>' + d.invoiceUndated.slice(0, 4).map(function (x) { return '• فاکتور باز بدون تاریخ: ' + escP(x.no || '-') + ' — مانده ' + money(x.remain); }).join('<br>') : '') + '</div>' : '<div class="ptf-fiscal-alert ptf-fiscal-alert-success" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:8px 12px;margin:10px 0;color:#065f46;font-size:12px">✅ مورد ناقص اثرگذار برای سود سال شناسایی نشد.</div>';
    var shRows = (d.shareholders || []).map(function (s) { var cl = s.final >= 0 ? '#059669' : '#dc2626'; return '<tr><td>' + escP(s.name) + '</td><td>' + s.pct + '٪</td><td>' + money(s.gross) + '</td><td>' + money(s.currentBalance) + '</td><td style="color:' + cl + ';font-weight:900">' + money(Math.abs(s.final)) + (s.final >= 0 ? ' بستانکار' : ' بدهکار') + '</td></tr>'; }).join('');
    /* v33.10.0: بلوک سود نقدی — کارت‌ها + جدول سهامداران نقدی + دکمه ثبت تقسیم */
    var cashShRows = (c.shareholders || []).map(function (s) { var cl = s.final >= 0 ? '#059669' : '#dc2626'; var cls = (s.settleYear || 0) >= 0 ? '#059669' : '#dc2626'; return '<tr><td>' + escP(s.name) + '</td><td>' + s.pct + '٪</td><td>' + money(s.gross) + '</td><td>' + money(s.advYear || 0) + '</td><td style="color:' + cls + ';font-weight:700">' + money(s.settleYear != null ? s.settleYear : s.gross) + '</td><td>' + money(s.fundCredit || 0) + '</td><td>' + money(s.fundDebt || 0) + '</td><td>' + money(s.currentBalance) + '</td><td style="color:' + cl + ';font-weight:900">' + money(Math.abs(s.final)) + (s.final >= 0 ? ' بستانکار' : ' بدهکار') + '</td></tr>'; }).join('');
    var lowCash = c.cashEnd < c.floor;
    var cashBlock =
      '<div class="ptf-fiscal-cash-block" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:12px 14px;margin-top:12px">' +
      '<div class="ptf-fiscal-cash-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">' +
      '<div class="ptf-fiscal-cash-copy"><b style="font-size:13.5px;color:#065f46">💵 سود نقدی و تقسیم (منطق نقدی — مصوب کارفرما)</b><br>' +
      '<small style="color:#64748b">درآمد واقعی = وصولی‌ها (نقد + چک وصول‌شده)؛ خروجی = فاکتورهای خرید + پرداخت‌های بدون تخصیص + چک‌های صادرهٔ مستقل + هزینه‌های جاری + تنخواه (بدون دوباره‌شماری). تقسیم فقط از مازاد موجودی نقد بر «کف نقدینگی در گردش».</small></div>' +
      '<span class="ptf-fiscal-cash-actions" style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="bt bt-o" type="button" title="تنظیم کف نقدینگی" aria-label="تنظیم کف نقدینگی" style="font-size:12px" onclick="ptfFiscalCashFloorOpen()">⚙️ کف نقدینگی (' + money(c.floor) + ')</button>' +
      '<button class="bt" type="button" title="ثبت تقسیم سود در دفاتر سهامداران" aria-label="ثبت تقسیم سود در دفاتر سهامداران" style="font-size:12px;background:#059669" onclick="ptfFiscalDividendApply(\'' + ptfOnClickArg(String(year)) + '\',' + distPct + ')">💰 ثبت تقسیم سود در دفاتر سهامداران</button>' +
      '</span></div>' +
      (lowCash ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#991b1b"><b>⚠️ نقدینگی زیر کف است</b> — موجودی نقد پایان (' + money(c.cashEnd) + ') کمتر از کف نقدینگی (' + money(c.floor) + ') است؛ تا پر شدن کف، تقسیم سود مجاز نیست.</div>' : '') +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:#047857">' + money(c.receipts) + '</b><span>درآمد نقدی (وصولی‌های سال)</span></div>' +
      ((c.shareholderInject) ? '<div class="sc ptf-fiscal-kpi"><b style="color:#0f766e">' + money(c.shareholderInject) + '</b><span>تأمین نقد سهامدار (فراخوان)</span></div>' : '') +
      ((c.fundCreditTotal) ? '<div class="sc ptf-fiscal-kpi"><b style="color:#b45309">' + money(c.fundCreditTotal) + '</b><span>طلب سهامداران از صندوق (کنار گذاشته از تقسیم)</span></div>' : '') +
      '<div class="sc ptf-fiscal-kpi"><b>' + money(c.pendingCheques) + '</b><span>چک وارده وصول‌نشده (درآمد نیست)</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:#b45309">' + money(c.outflowsTotal) + '</b><span>خروجی‌های سال (هزینه)</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b>' + money(c.netCash) + '</b><span>سود نقدی دوره</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b>' + money(c.openingCash) + '</b><span>نقد/بانک ابتدای سال (افتتاحیه)</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:' + (lowCash ? '#dc2626' : '#0369a1') + '">' + money(c.cashEnd) + '</b><span>موجودی نقد پایان سال</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b>' + money(c.floor) + '</b><span>کف نقدینگی در گردش</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:#065f46">' + money(c.overFloor) + '</b><span>مازاد بر کف (قابل برنامه‌ریزی)</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:#059669">' + money(c.distributable) + '</b><span>قابل تقسیم (' + c.distPct + '٪)</span></div>' +
      '<div class="sc ptf-fiscal-kpi"><b style="color:#7c3aed">' + money(c.backToFloor) + '</b><span>بازگشت به کف (' + (100 - c.distPct) + '٪)</span></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:11.5px;color:#64748b;line-height:1.8">تفکیک خروجی‌ها: فاکتورهای خرید ' + money(c.outflows.supplierInvoices) + ' | کارمزد پوششی ' + money(c.outflows.coverCommission || 0) + ' | پرداخت بدون تخصیص ' + money(c.outflows.unallocatedPayments) + ' | چک صادرهٔ مستقل ' + money(c.outflows.independentCheques) + ' | هزینه‌های جاری ' + money(c.outflows.opex) + ' | تنخواه مستقل ' + money(c.outflows.petty) + (c.outflows.coverVat ? ' | اعتبار ارزش‌افزودهٔ پوششی (منفعت): ' + money(c.outflows.coverVat) : '') + '</div>' +
      '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم ناخالص</th><th>علی‌الحساب/بدهی سال</th><th>مانده قابل تسویهٔ امسال</th><th>طلب صندوق</th><th>بدهی فراخوان</th><th>مانده جاری</th><th>نتیجه پس از تقسیم</th></tr></thead><tbody>' + (cashShRows || '<tr><td colspan="9">سهامداری ثبت نشده</td></tr>') + '</tbody></table></div>' +
      (c.advYearTotal ? '<div style="margin-top:6px;font-size:11.5px;color:#7c3aed">ℹ️ جمع برداشت‌های علی‌الحساب/بدهیِ سال ' + escP(String(year)) + ': ' + money(c.advYearTotal) + ' — هنگام تسویه از سهم ناخالص هر سهامدار کسر می‌شود (ستون «مانده قابل تسویهٔ امسال»).</div>' : '') +
      (c.fundCreditTotal ? '<div style="margin-top:6px;font-size:11.5px;color:#b45309">ℹ️ طلب باز از صندوق (' + money(c.fundCreditTotal) + ') بدهی شرکت به سهامدار است؛ نقدش در موجودی هست ولی از مازاد قابل‌تقسیم کنار گذاشته می‌شود تا دوباره به‌عنوان سود تقسیم نشود.</div>' : '') +
      '</div>';

    // v31.3 FIN-EX-05: 3 سرفصل مدیریتی جدید برای گزارش سال
    var extraCards = '';
    try {
      // چک‌های باز شرکت
      var cheques = getData('ptf_crm_cheques')||[];
      var openCheques = cheques.filter(function(c){ return c.ownership==='company' && c.st==='open'; });
      var openChequeSum = openCheques.reduce(function(s,c){ return s+(+c.amt||0); },0);
      var openChequeCnt = openCheques.length;
      // اعتبار نزد تأمین‌کننده (مانده منفی)
      var supCredit = 0;
      try {
        /* AUD-08 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
           balance() تابعی private داخل IIFE فایل supplier-finance.js است و
           هرگز روی window قرار نمی‌گیرد؛ بنابراین typeof balance==='function'
           همیشه false بود و شاخه‌ی else (کد مرده، بدون هیچ محاسبه‌ای) همیشه
           اجرا می‌شد — این کارت همیشه صفر نمایش می‌داد صرف‌نظر از داده‌ی
           واقعی. راه‌حل: از تابع عمومی از پیش‌موجود slSupplierOpenTotalsIRR
           (که دقیقاً همین محاسبه را با balance() واقعی انجام می‌دهد و در
           supplier-finance.js پیش از fiscal.js لود می‌شود) استفاده می‌شود. */
        if (typeof window.slSupplierOpenTotalsIRR === 'function') {
          supCredit = window.slSupplierOpenTotalsIRR().credit || 0;
        }
      } catch(e2){ supCredit=0; }
      // مانده تنخواه تسویه‌نشده
      var pettyPending=0, pettyPendingCnt=0;
      try {
        var petty=getData('ptf_crm_petty')||[];
        petty.forEach(function(p){ if(p.st!=='settled' && p.st!=='void'){ pettyPending+=(+p.amt||0); pettyPendingCnt++; } });
      } catch(e3){}
      extraCards = '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:10px">'
        + '<div class="sc ptf-fiscal-kpi"><b>'+money(openChequeSum)+'</b><span>چک‌های باز شرکت ('+openChequeCnt+' فقره)</span></div>'
        + '<div class="sc ptf-fiscal-kpi"><b>'+money(supCredit)+'</b><span>اعتبار نزد تأمین‌کنندگان</span></div>'
        + '<div class="sc ptf-fiscal-kpi"><b>'+money(pettyPending)+'</b><span>مطالبات تنخواه تسویه‌نشده ('+pettyPendingCnt+' مورد)</span></div>'
        + '</div>';
    } catch(eExtra){ extraCards=''; }

    var unlockBtn = (locked && canFiscalUnlock()) ? '<button class="bt bt-o" style="font-size:12px;color:#b45309;border-color:#fed7aa" onclick="ptfFiscalUnlockOpen(\'' + ptfOnClickArg(String(year)) + '\')">🔓 بازکردن قفل</button>' : '';
    var lockBox = locked ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-lock" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:9px 12px;margin:10px 0;color:#5b21b6;font-size:12.5px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>🔒 سال ' + escP(year) + ' قفل است — snapshot: ' + escP(locked.cd) + ' توسط ' + escP(locked.by || '') + ' در ' + escP(locked.lockedAt || locked.t || '') + (canFiscalUnlock() ? '<br><small>رییس هیات مدیره می‌تواند بدون بازگردانی بک‌آپ و با ثبت دلیل، فقط قفل را باز کند.</small>' : '') + '</span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" style="font-size:11.5px;color:#5b21b6;border-color:#ddd6fe" onclick="ptfFiscalSnapPrint(\'' + ptfOnClickArg(locked.cd) + '\')">🖨 چاپ snapshot</button>' + unlockBtn + '</span></div>' : '';
    var unlocked = lastUnlocked(year);
    var unlockHistoryBox = (!locked && unlocked) ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-warning" style="background:#fffbeb;border:1px solid #fed7aa;border-radius:12px;padding:9px 12px;margin:10px 0;color:#9a3412;font-size:12px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span>🔓 آخرین بازگشایی سال ' + escP(year) + ': ' + escP(unlocked.unlockedAt || '') + ' توسط ' + escP(unlocked.unlockedBy || '') + '<br><small>دلیل: ' + escP(unlocked.unlockReason || 'ثبت نشده') + ' — snapshot اصلی حفظ شده است.</small></span><button class="bt bt-o" style="font-size:11px" onclick="ptfFiscalSnapPrint(\'' + ptfOnClickArg(unlocked.cd) + '\')">🖨 چاپ snapshot محفوظ</button></div>' : '';
    /* v33.11.0 (بازخورد کارفرما): جدول/کارت‌های سود تعهدی قبلی (که اعداد را ناسازگار با
       منطق نقدی نشان می‌دادند) به‌طور کامل حذف شدند — فقط «سود نقدی و تقسیم» نمایش داده می‌شود. */
    return '<div id="fiscalBox" class="ptf-fiscal-shell" style="background:#f8fafc;border:1px solid var(--brd);border-radius:16px;padding:12px 14px;margin:12px 0">' +
      '<div class="ptf-fiscal-head" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div class="ptf-fiscal-copy"><b class="ptf-fiscal-title" style="font-size:14px;color:#0f172a">' + fiscalIcon('calendar') + ' داشبورد سال مالی و تقسیم سود</b><br><small style="color:#64748b">محرمانه — فقط مدیران ارشد (ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی). مبنای محاسبه: منطق نقدی (وصولی‌ها − خروجی‌ها) و کف نقدینگی در گردش. قاعده سال: تاریخ مختومه/برد/ثبت سند.</small></div>' +
      '<div class="ptf-fiscal-toolbar" style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<label class="ptf-fiscal-control" style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#475569;background:#fff;border:1px solid var(--brd);border-radius:9px;padding:2px 8px">📅 سال مالی: <select aria-label="انتخاب سال مالی" onchange="window._fiscalYear=this.value;ptfFiscalRender()" style="padding:5px 4px;border:none;outline:none;font-weight:700;color:#0f172a;direction:ltr">' + fiscalYearOptions(year).map(function (y) { return '<option value="' + y + '"' + (String(y) === String(year) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></label>' /* v34.0.5-alpha (BUG-FISCAL-YEAR-UI-002): انتخاب سال فقط از منوی کشویی — ورود دستی فارسی فیلتر را می‌شکست */ +
      '<label class="ptf-fiscal-control" style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#475569;background:#fff;border:1px solid var(--brd);border-radius:9px;padding:2px 8px">٪ سهم تقسیم سود: <input aria-label="درصد سهم تقسیم سود" value="' + escP(String(distPct)) + '" inputmode="numeric" onchange="ptfFiscalPctChange(this)" style="width:50px;padding:5px;border:none;outline:none;direction:ltr;text-align:center;font-weight:700;color:#0f172a"> ٪</label>' /* v34.0.5-alpha (BUG-FISCAL-PCT-003): برچسب صریح + نرمال ارقام فارسی (ptfFiscalPctChange) */ +
      '<button class="bt ptf-fiscal-action" type="button" title="قفل کردن سال مالی" aria-label="قفل کردن سال مالی" style="font-size:12px" onclick="ptfFiscalLock()">🔒 قفل سال</button>' +
      '<button class="bt bt-o ptf-fiscal-action" type="button" title="گزارش رسمی سال مالی" aria-label="گزارش رسمی سال مالی" style="font-size:12px" onclick="ptfFiscalPrint()">گزارش رسمی</button>' +
      '<button class="bt bt-o ptf-fiscal-action" type="button" title="خروجی PDF سال مالی" aria-label="خروجی PDF سال مالی" style="font-size:12px;color:#991b1b;border-color:#fecaca" onclick="ptfFiscalPdf()">📄 خروجی PDF</button>' + /* v34.0.5-alpha */
      '<button class="bt bt-o ptf-fiscal-action" type="button" title="خروجی CSV حسابدار" aria-label="خروجی CSV حسابدار" style="font-size:12px;color:#059669;border-color:#a7f3d0" onclick="ptfFiscalCsv()">📥 CSV حسابدار</button>' +
      '<button class="bt bt-o ptf-fiscal-action ptf-fiscal-amend-action" type="button" title="ثبت سند اصلاحی" aria-label="ثبت سند اصلاحی" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfFiscalAmendOpen()">🧾 سند اصلاحی</button>' +
      '</div></div>' + lockBox + unlockHistoryBox + cashBlock + incHtml +
      ((d.amendments || []).length ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-lock" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:9px 12px;margin:10px 0;font-size:12px;color:#5b21b6"><b>سندهای اصلاحی موثر بر سال ' + escP(String(d.year)) + ':</b><br>' + d.amendments.map(function (a) { return '• <b>' + escP(a.cd) + '</b> (مرجع: سال قفل‌شده ' + escP(a.refYear) + ') — ' + (a.amt >= 0 ? '➕' : '➖') + ' ' + money(Math.abs(a.amt)) + ' — ' + escP(a.desc) + ' <small style="color:#94a3b8">(' + escP(a.t || '') + ' — ' + escP(a.by || '') + ')</small>'; }).join('<br>') + '</div>' : '') +
      '</div>';
  };

  /* ===== v34.0.4-alpha (BUG-FISCAL-LOST-UI-001/002/004) بازگردانی توابع حذف‌شدهٔ داشبورد سال مالی =====
     ریشه: در refactor v33.10/33.11 (حذف جدول سود تعهدی)، بدنهٔ ptfFiscalRender/ptfFiscalLock/ptfFiscalSnapshotOpen
     حذف شد (کد قفل به‌صورت مرده بعد از return در fiscalHtml مانده بود) ولی دکمه‌های UI هنوز همان‌ها را
     صدا می‌زدند → ReferenceError: قفل سال غیرممکن، تغییر سال/درصد رفرش نمی‌شد، و دکمهٔ «اسنپ‌شات و ترازنامه»
     گزارش جامع بی‌صدا کاری نمی‌کرد. tester101 این رگرسیون را ثبت کرده بود. */
  window.ptfFiscalRender = function () { if (!canFiscal()) return; var box = document.getElementById('fiscalBox'); if (box) box.outerHTML = fiscalHtml(); };

  /* قفل سال مالی: snapshot منجمد (تعهدی + نقدی — الگوی ptfFiscalCsv) + حفاظ دوباره‌قفل + تأیید موارد ناقص */
  window.ptfFiscalLock = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var year = normFiscalYear(window._fiscalYear) /* v34.0.5-alpha */;
    if (findLocked(year)) { alert('سال ' + year + ' قبلاً قفل شده است («بازکردن قفل» فقط برای رییس هیات مدیره و با ثبت دلیل ممکن است).'); return; }
    var distPct = window._fiscalDistPct == null ? 60 : window._fiscalDistPct;
    var d = ptfFiscalDistribution(year, distPct);
    var c = window.ptfFiscalCashDistribution(year, distPct);
    var incN = d.incomplete.length + d.undated.length + d.invoiceUndated.length;
    if (incN && !confirm('⚠️ ' + incN + ' مورد ناقص/بی‌تاریخ وجود دارد و در سود لحاظ نشده است. با این وجود snapshot سال قفل شود؟')) return;
    var nowLock = faDateTime(), nowLockIso = fiscalNowIso();
    var frozen = Object.assign({}, d, c, { distPct: (c && c.distPct != null) ? c.distPct : distPct });
    var rec = { cd: genCode('FSY'), year: year, locked: true, t: nowLock, lockedAt: nowLock, lockStateAtISO: nowLockIso, ts: nowLockIso, by: (curSession() || {}).name || '', data: frozen };
    var a = snaps(); a.unshift(rec); saveSnaps(a);
    audit('سال مالی', 'قفل snapshot سال ' + year + ' — سود خالص ' + money(d.netProfit), rec.cd);
    if (typeof ptfToast === 'function') ptfToast('سال مالی قفل شد', 'ok');
    ptfFiscalRender();
  };

  /* فهرست snapshotها و اسناد سال مالی (فقط‌خواندنی) + چاپ از دادهٔ منجمد */
  window.ptfFiscalSnapshotOpen = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var list = snaps();
    var rows = list.map(function (s) {
      var kindLb = s.type === 'dividend' ? '💰 تقسیم سود' : s.type === 'amendment' ? '🧾 سند اصلاحی' : (s.locked === true ? '🔒 قفل سال' : '📄 snapshot');
      var prnt = (s.data && typeof window.ptfFiscalSnapPrint === 'function') ? '<button class="bt bt-o" style="font-size:11px;color:#5b21b6;border-color:#ddd6fe" onclick="ptfFiscalSnapPrint(\'' + ptfOnClickArg(s.cd) + '\')">🖨 چاپ</button>' : '<span style="color:#94a3b8;font-size:11px">—</span>';
      return '<tr><td><b>' + escP(s.cd) + '</b></td><td>' + escP(kindLb) + '</td><td>' + escP(s.year || s.refYear || '—') + '</td><td>' + escP(s.lockedAt || s.t || '—') + '</td><td>' + escP(s.by || '—') + '</td><td>' + prnt + '</td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:90vh;overflow:auto">' +
      '<h3>🔒 اسنپ‌شات‌ها و اسناد سال مالی</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px;line-height:1.8">snapshot قفل‌شده هرگز ویرایش/حذف نمی‌شود؛ اصلاحات بعدی فقط با «سند اصلاحی» اثر می‌گذارند و چاپ هر snapshot از <b>دادهٔ منجمد همان لحظه</b> انجام می‌شود.</div>' +
      '<div class="tb2"><table><thead><tr><th>شناسه</th><th>نوع</th><th>سال</th><th>تاریخ</th><th>توسط</th><th>چاپ</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px">هنوز snapshot یا سندی ثبت نشده — ابتدا از «داشبورد سال مالی» (هاب مالی) سال را قفل کنید.</td></tr>') + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };
  /* Sprint 283: audited fiscal unlock — does not delete or rewrite the snapshot.
     It only changes the active lock flag and is intentionally chairman-only. */
  window.ptfFiscalUnlockCommit = function (year, reason) {
    if (!canFiscalUnlock()) return { ok: false, why: 'role' };
    year = String(year || '').trim(); reason = String(reason || '').trim();
    if (!year) return { ok: false, why: 'year' };
    if (!reason) return { ok: false, why: 'reason' };
    /* رکورد باید از همان آرایه‌ای تغییر کند که ذخیره می‌شود؛ getData هر بار یک
       snapshot تازه می‌دهد و ذخیرهٔ آرایهٔ دوم، تغییر بازگشایی را از دست می‌داد. */
    var all = snaps();
    var rec = all.filter(function (s) { return s && String(s.year) === year && s.locked === true; })[0];
    if (!rec) return { ok: false, why: 'notlocked' };
    var now = faDateTime(), nowIso = fiscalNowIso();
    rec.locked = false;
    rec.unlockedAt = now; rec.unlockedAtISO = nowIso; rec.unlockedBy = (curSession() || {}).name || '';
    rec.unlockReason = reason; rec.lockStateAtISO = nowIso; rec.ts = nowIso;
    saveSnaps(all);
    try { audit('سال مالی', 'بازگشایی کنترل‌شده قفل سال ' + year + ' — snapshot ' + rec.cd + ' — دلیل: ' + reason, rec.cd); } catch (e) {}
    return { ok: true, rec: rec };
  };
  window.ptfFiscalUnlockOpen = function (year) {
    if (!canFiscalUnlock()) { alert('⛔ بازکردن قفل سال مالی فقط برای رییس هیات مدیره مجاز است.'); return; }
    year = normFiscalYear(year || window._fiscalYear); /* v34.0.5-alpha */
    var rec = findLocked(year);
    if (!rec) { alert('سال انتخابی قفل فعالی ندارد.'); return; }
    ptfDialog({ title: '🔓 بازکردن کنترل‌شده قفل سال مالی ' + escP(year), body: '<b>هشدار:</b> snapshot ' + escP(rec.cd) + ' حذف یا بازنویسی نمی‌شود. این عملیات فقط امکان ثبت/اصلاح اسناد همان سال را برمی‌گرداند و دلیل آن در audit ثبت می‌شود. این کار جای بازگردانی بک‌آپ نیست.', fields: [{ id: 'reason', label: 'دلیل بازگشایی *', type: 'textarea', rows: 3, required: true, placeholder: 'مثال: قفل پیش از تکمیل اسناد ثبت شده بود' }], okText: 'بازکردن قفل با ثبت ردپا', danger: true, onOk: function (v) {
      var r = window.ptfFiscalUnlockCommit(year, v.reason);
      if (!r.ok) { alert({ role: '⛔ فقط رییس هیات مدیره', year: '⛔ سال نامعتبر است', reason: '⛔ دلیل الزامی است', notlocked: 'ℹ️ سال دیگر قفل نیست' }[r.why] || '⛔ بازگشایی انجام نشد'); return; }
      if (typeof ptfToast === 'function') ptfToast('قفل سال ' + year + ' باز شد؛ snapshot و ردپای حسابرسی حفظ شده‌اند.', 'ok');
      ptfFiscalRender();
    } });
  };

  window.ptfFiscalReportHtml = function (d) {
    function tr(cells) { return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }
    var pr = (d.projects || []).map(function (p) { return tr([escP(p.no || ''), escP(p.buyerCo || ''), escP(p.date || ''), money(p.sellIrr || 0), money(p.buyIrr || 0), money(p.projectCostIrr || 0), money(p.loss || 0), '<b>' + money(p.profit || 0) + '</b>']); }).join('');
    var ox = Object.keys(d.opexByCat || {}).map(function (k) { return tr([escP(k), money(d.opexByCat[k])]); }).join('');
    var inc = (d.incomplete || []).map(function (x) { return tr([escP(x.no || ''), escP(x.buyerCo || ''), escP((x.warnings || []).join(' | '))]); }).join('') + (d.undated || []).map(function (x) { return tr([escP(x.no || ''), escP(x.buyerCo || ''), escP(x.reason || '')]); }).join('');
    var sh = (d.shareholders || []).map(function (s) { return tr([escP(s.name), s.pct + '٪', money(s.gross), money(s.advYear || 0), money(s.settleYear != null ? s.settleYear : s.gross), money(s.fundCredit || 0), money(s.fundDebt || 0), money(s.currentBalance), money(s.final)]); }).join(''); /* v34.4.87 */
    return '<div style="direction:rtl;font-family:Tahoma,Vazirmatn,sans-serif;color:#0f172a"><h2>گزارش رسمی سال مالی ' + escP(d.year) + '</h2><p>سود خالص مدیریتی: <b>' + money(d.netProfit) + '</b>' + ((d.amendments || []).length ? ' (شامل ' + (d.amendments || []).length + ' سند اصلاحی: ' + money(d.amendTotal || 0) + ')' : '') + ' | قابل تقسیم: <b>' + money(d.distributable) + '</b> | اندوخته: <b>' + money(d.reserve) + '</b> | مطالبات باز کل: <b>' + money(d.openReceivablesTotal) + '</b></p><h3>منبع سود پروژه‌ها</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>پرونده</th><th>کارفرما</th><th>تاریخ</th><th>فروش</th><th>خرید</th><th>هزینه مستقیم</th><th>زیان</th><th>سود</th></tr></thead><tbody>' + (pr || '<tr><td colspan="8">موردی نیست</td></tr>') + '</tbody></table><h3>هزینه‌های جاری</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + (ox || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>هزینه‌های تنخواه مستقل سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + ((d.pettyStandaloneRows || []).map(function (p) { return tr([escP(p.cd || ''), escP(p.cat || ''), escP(p.by || ''), escP(p.st || ''), money(p.amt || 0)]); }).join('') || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>سندهای اصلاحی موثر بر سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سند</th><th>سال مرجع</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>' + ((d.amendments || []).map(function (a) { return tr([escP(a.cd), escP(a.refYear), (a.amt >= 0 ? '+' : '−') + money(Math.abs(a.amt)), escP(a.desc || '')]); }).join('') || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table><h3>موارد ناقص/بی‌تاریخ</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + (inc || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>کاربرگ تقسیم سود</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم ناخالص</th><th>علی‌الحساب سال</th><th>مانده قابل تسویهٔ امسال</th><th>طلب صندوق</th><th>بدهی فراخوان</th><th>مانده جاری</th><th>نتیجه</th></tr></thead><tbody>' + (sh || '<tr><td colspan="9">سهامداری ثبت نشده</td></tr>') + '</tbody></table></div>';
  };
  /* v33.11.0: گزارش نقدی (مصوب کارفرما) — اگر دادهٔ نقدی موجود باشد */
  window.ptfFiscalCashReportHtml = function (d) {
    function tr(cells) { return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }
    var sh = (d.shareholders || []).map(function (s) { return tr([escP(s.name), s.pct + '٪', money(s.gross), money(s.advYear || 0), money(s.settleYear != null ? s.settleYear : s.gross), money(s.fundCredit || 0), money(s.fundDebt || 0), money(s.currentBalance), money(s.final)]); }).join(''); /* v34.4.87 */
    var inc = (d.incomplete || []).map(function (x) { return tr([escP(x.no || ''), escP(x.buyerCo || ''), escP((x.warnings || []).join(' | '))]); }).join('') + (d.undated || []).map(function (x) { return tr([escP(x.no || ''), escP(x.buyerCo || ''), escP(x.reason || '')]); }).join('');
    var amendRows = (d.amendments || []).map(function (a) { return tr([escP(a.cd), escP(a.refYear), (a.amt >= 0 ? '+' : '−') + money(Math.abs(a.amt)), escP(a.desc || '')]); }).join('');
    return '<div style="direction:rtl;font-family:Tahoma,Vazirmatn,sans-serif;color:#0f172a"><h2>گزارش رسمی سال مالی ' + escP(d.year) + ' (منطق نقدی)</h2>' +
      '<p>درآمد نقدی (وصولی‌ها): <b>' + money(d.receipts) + '</b> | تأمین نقد سهامدار: <b>' + money(d.shareholderInject || 0) + '</b> | خروجی (هزینه): <b>' + money(d.outflowsTotal) + '</b> | سود نقدی دوره: <b>' + money(d.netCash) + '</b> | موجودی نقد پایان: <b>' + money(d.cashEnd) + '</b><br>' +
      'کف نقدینگی: <b>' + money(d.floor) + '</b> | طلب صندوق (کنار از تقسیم): <b>' + money(d.fundCreditTotal || 0) + '</b> | مازاد بر کف: <b>' + money(d.overFloor) + '</b> | قابل تقسیم (' + d.distPct + '٪): <b>' + money(d.distributable) + '</b> | بازگشت به کف (' + (100 - d.distPct) + '٪): <b>' + money(d.backToFloor) + '</b></p>' +
      '<h3>درآمد و خروجی نقدی سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>بخش</th><th>مبلغ (ریال)</th></tr></thead><tbody>' +
      tr(['درآمد نقدی (وصولی‌ها — نقد + چک وصول‌شده)', d.receipts]) +
      tr(['تأمین نقد سهامدار (واریز فراخوان / مازاد — بدون تهاتر)', d.shareholderInject || 0]) +
      tr(['طلب سهامداران از صندوق (از مازاد قابل‌تقسیم کنار گذاشته)', d.fundCreditTotal || 0]) +
      tr(['چک وارده وصول‌نشده (درآمد نیست)', d.pendingCheques]) +
      tr(['فاکتورهای خرید تأمین‌کننده (واقعی)', d.outflows.supplierInvoices]) +
      tr(['کارمزد فاکتورهای صوری/پوششی (هزینهٔ نقدی)', d.outflows.coverCommission || 0]) +
      tr(['اعتبار ارزش‌افزودهٔ فاکتورهای پوششی (منفعت — نقد نیست)', d.outflows.coverVat || 0]) +
      tr(['پرداخت بدون تخصیص (مسائل دیگر)', d.outflows.unallocatedPayments]) +
      tr(['چک صادرهٔ مستقل (بابت مسائل دیگر)', d.outflows.independentCheques]) +
      tr(['هزینه‌های جاری سال', d.outflows.opex]) +
      tr(['تنخواه مستقل سال', d.outflows.petty]) +
      '</tbody></table>' +
      '<h3>سندهای اصلاحی موثر بر سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سند</th><th>سال مرجع</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>' + (amendRows || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table>' +
      '<h3>موارد ناقص/بی‌تاریخ</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + (inc || '<tr><td>موردی نیست</td></tr>') + '</tbody></table>' +
      '<h3>کاربرگ تقسیم سود (نقدی — مازاد بر کف)</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم ناخالص</th><th>علی‌الحساب سال</th><th>مانده قابل تسویهٔ امسال</th><th>طلب صندوق</th><th>بدهی فراخوان</th><th>مانده جاری</th><th>نتیجه</th></tr></thead><tbody>' + (sh || '<tr><td colspan="9">سهامداری ثبت نشده</td></tr>') + '</tbody></table></div>';
  };
  /* Sprint 281: print/snapshot report receives an immutable summary of the
     matching official financial position. No live data is injected into an old
     frozen snapshot that predates this field. */
  var _ptfFiscalReportHtml281 = window.ptfFiscalReportHtml;
  window.ptfFiscalReportHtml = function (d) {
    if (d && d.receipts != null) return window.ptfFiscalCashReportHtml(d); /* v33.11.0: دادهٔ نقدی → گزارش نقدی */
    var h = _ptfFiscalReportHtml281(d), fp = d && d.financialPosition;
    if (!fp || !fp.total) return h;
    var x = fp.total;
    var box = '<h3>وضعیت مالی و سرمایه در گردش ثبت‌شده</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سرفصل</th><th>مبلغ (ریال)</th></tr></thead><tbody><tr><td>مطالبات باز مشتریان</td><td>' + money(x.receivable) + '</td></tr><tr><td>بدهی باز تأمین‌کنندگان</td><td>' + money(x.supplierLiability) + '</td></tr><tr><td>اعتبار نزد تأمین‌کنندگان</td><td>' + money(x.supplierCredit) + '</td></tr><tr><td>چک‌های شرکتی باز</td><td>' + money(x.companyCheque) + '</td></tr><tr><td><b>خالص سرمایه در گردش ثبتی</b></td><td><b>' + money(x.netWorkingCapital) + '</b></td></tr></tbody></table><p style="font-size:11px;color:#64748b">منبع: محاسبه فقط‌خواندنی گزارش تجمیعی مالی (رسمی+غیررسمی) در زمان تهیهٔ این گزارش؛ چک شخصی، چک انتقالی و چک ابطال‌شده وارد نشده‌اند.</p>';
    return h.replace(/<\/div>\s*$/, box + '</div>');
  };

  window.ptfFiscalPrint = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var year = normFiscalYear(window._fiscalYear); /* v34.0.5-alpha */
    /* v33.11.0: گزارش رسمی بر مبنای منطق نقدی (مصوب کارفرما) */
    var d = Object.assign(ptfFiscalData(year), ptfFiscalCashDistribution(year, window._fiscalDistPct == null ? 60 : window._fiscalDistPct));
    var html = '<div class="md-b" style="display:grid"><div class="md" style="max-width:980px;max-height:92vh;overflow:auto"><div id="fisReportPrintable">' + ptfFiscalReportHtml(d) + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="ptfPrintWithTitle(\'FIS-\'+(window._fiscalYear||\'\'))">چاپ مرورگر</button><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };

  /* ===== v34.0.5-alpha (BUG-FISCAL-PDF-005 — درخواست کارفرما: «گزارش در قالب مناسب PDF») =====
     سند A4 مستقل (RTL) با سربرگ شرکت، وضعیت قفل/snapshot و پاصفحه — در پنجرهٔ چاپ «Save as PDF». */
  window.ptfFiscalPdf = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var year = normFiscalYear(window._fiscalYear);
    var distPct = Math.max(0, Math.min(100, n(window._fiscalDistPct == null ? 60 : window._fiscalDistPct)));
    var d = Object.assign(ptfFiscalDistribution(year, distPct), ptfFiscalCashDistribution(year, distPct));
    var locked = findLocked(year);
    var bodyHtml = ptfFiscalReportHtml(d);
    var today = ''; try { today = faDateTime(); } catch (eT) {}
    var head = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #5b21b6;padding-bottom:8px;margin-bottom:14px">'
      + '<div><b style="font-size:16px">پیشرو تجهیز فرتاک</b><br><small style="color:#475569">گزارش رسمی سال مالی و تقسیم سود — محرمانه مدیریتی</small></div>'
      + '<div style="text-align:left;font-size:11px;color:#475569;line-height:1.9">' + (locked ? '🔒 snapshot: <b>' + escP(locked.cd) + '</b><br>قفل: ' + escP(locked.lockedAt || locked.t || '') + ' — ' + escP(locked.by || '') + '<br>' : '⚠️ سال هنوز قفل نشده — گزارش لحظه‌ای از دادهٔ زنده<br>') + 'صدور: ' + escP(today) + '</div></div>';
    var foot = '<div style="margin-top:20px;border-top:1px solid #cbd5e1;padding-top:7px;font-size:10.5px;color:#64748b;display:flex;justify-content:space-between"><span>سامانهٔ CRM پیشرو تجهیز فرتاک — سند FIS-' + escP(year) + '</span><span>منبع اعداد: ' + (locked ? 'دادهٔ منجمد snapshot ' + escP(locked.cd) : 'دادهٔ زندهٔ سیستم') + '</span></div>';
    var doc = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>FIS-' + escP(year) + '</title><style>'
      + '@page{size:A4;margin:14mm 12mm}html,body{margin:0;padding:0}body{font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;font-size:12.5px;line-height:1.75;direction:rtl}'
      + 'h2{font-size:17px;margin:10px 0 6px}h3{font-size:13.5px;margin:16px 0 6px;border-right:3.5px solid #5b21b6;padding-right:8px;page-break-after:avoid}'
      + 'table{border-collapse:collapse;width:100%;page-break-inside:auto}tr{page-break-inside:avoid}thead{display:table-header-group}td,th{vertical-align:top}.pb{page-break-before:always}'
      + '</style></head><body>' + head + bodyHtml + foot + '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { alert('پاپ‌آپ توسط مرورگر مسدود شد — برای خروجی PDF اجازهٔ باز شدن پنجره را بدهید.'); return; }
    w.document.write(doc); w.document.close();
    try { w.document.title = 'گزارش-سال-مالی-' + year; } catch (eT2) {}
    setTimeout(function () { try { w.focus(); w.print(); } catch (eP) {} }, 450);
    try { audit('سال مالی', 'خروجی PDF گزارش سال ' + year + (locked ? ' (snapshot ' + locked.cd + ')' : ' (لحظه‌ای)'), locked ? locked.cd : ''); } catch (eA) {}
  };

  /* ===== v19.5 (US-427): سند اصلاحی پس از قفل سال — snapshot گذشته immutable ===== */
  window.ptfFiscalAmendCommit = function (refYear, amt, desc, positive) {
    if (!canFiscal()) return { ok: false, why: 'role' };
    refYear = String(refYear || '').trim();
    var lockedSnap = snaps().filter(function (x) { return x.locked && String(x.year) === refYear; })[0];
    if (!lockedSnap) return { ok: false, why: 'notlocked' }; /* سند اصلاحی فقط برای سال قفل‌شده معنا دارد */
    var val = Math.abs(+amt || 0);
    if (!val) return { ok: false, why: 'amt' };
    if (!String(desc || '').trim()) return { ok: false, why: 'desc' };
    var effectYear = yearNow(); /* AC3: اثر همیشه در سال جاری */
    var rec = { cd: genCode('FAM'), type: 'amendment', refYear: refYear, refSnap: lockedSnap.cd, effectYear: String(effectYear), amt: positive ? val : -val, desc: String(desc).trim(), t: faDateTime(), by: (curSession() || {}).name || '' };
    var a = snaps(); a.unshift(rec); saveSnaps(a);
    try { audit('سال مالی', 'سند اصلاحی ' + rec.cd + ' برای سال قفل‌شده ' + refYear + ' — اثر ' + (positive ? '+' : '−') + money(val) + ' در سال ' + effectYear + ': ' + rec.desc, rec.cd); } catch (e) {}
    return { ok: true, rec: rec };
  };
  window.ptfFiscalAmendOpen = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var lockedYears = snaps().filter(function (x) { return x.locked; }).map(function (x) { return String(x.year); }).filter(function (y, i, arr) { return arr.indexOf(y) === i; });
    if (!lockedYears.length) { alert('ℹ️ هنوز هیچ سالی قفل نشده — سند اصلاحی فقط برای سال قفل‌شده است (US-427). اصلاحات سال جاری را مستقیم در همان ماژول مربوط ثبت کنید.'); return; }
    ptfDialog({
      title: '🧾 سند اصلاحی سال مالی قفل‌شده (US-427)',
      body: 'snapshot سال قفل‌شده هرگز تغییر نمی‌کند؛ اصلاح حسابرسی به‌صورت این سند در <b>سال جاری (' + escP(yearNow()) + ')</b> اثر می‌گذارد و در گزارش‌ها با برچسب «اصلاحی» دیده می‌شود.',
      fields: [
        { id: 'refYear', label: 'سال قفل‌شده مرجع', type: 'select', options: lockedYears.map(function (y) { return { v: y, lb: y }; }) },
        { id: 'dir', label: 'اثر بر سود سال جاری', type: 'select', options: [{ v: 'neg', lb: '➖ کاهنده سود (مثلا هزینه/زیان کشف‌شده)' }, { v: 'pos', lb: '➕ افزاینده سود (مثلا درآمد شناسایی‌نشده)' }] },
        { id: 'amt', label: 'مبلغ (ریال)', type: 'number', required: true, dir: 'ltr' },
        { id: 'desc', label: 'شرح سند اصلاحی', type: 'textarea', rows: 3, required: true, placeholder: 'مثلا: هزینه گمرک پرونده INQ-... در سال قبل ثبت نشده بود' }
      ],
      okText: 'ثبت سند اصلاحی',
      onOk: function (v) {
        var res = ptfFiscalAmendCommit(v.refYear, v.amt, v.desc, v.dir === 'pos');
        if (!res.ok) { alert({ role: '⛔ دسترسی ندارید', notlocked: '⛔ سال انتخابی قفل نیست', amt: '⛔ مبلغ الزامی است', desc: '⛔ شرح الزامی است' }[res.why] || '⛔ ثبت نشد'); return; }
        if (typeof ptfToast === 'function') ptfToast('سند اصلاحی ثبت شد — اثر در سال ' + res.rec.effectYear, 'ok');
        ptfFiscalRender();
      }
    });
  };

  /* ===== v19.5 (US-426 فاز ۲): خروجی CSV حسابدار + چاپ snapshot قفل‌شده ===== */
  window.ptfFiscalCsv = function (year) {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return null; }
    year = normFiscalYear(year || window._fiscalYear); /* v34.0.5-alpha */
    /* v33.11.0: CSV بر مبنای منطق نقدی (مصوب کارفرما) */
    var d = Object.assign(ptfFiscalData(year), ptfFiscalCashDistribution(year, window._fiscalDistPct == null ? 60 : window._fiscalDistPct));
    var rows = [['گزارش سال مالی (منطق نقدی)', d.year], []];
    rows.push(['بخش', 'مبلغ (ریال)']);
    rows.push(['درآمد نقدی (وصولی‌های سال — نقد + چک وصول‌شده)', d.receipts]);
    rows.push(['چک وارده وصول‌نشده (درآمد نیست)', d.pendingCheques]);
    rows.push(['فاکتورهای خرید تأمین‌کننده (واقعی)', d.outflows.supplierInvoices]);
    rows.push(['کارمزد فاکتورهای صوری/پوششی (هزینهٔ نقدی)', d.outflows.coverCommission || 0]);
    rows.push(['اعتبار ارزش‌افزودهٔ فاکتورهای پوششی (منفعت)', d.outflows.coverVat || 0]);
    rows.push(['پرداخت بدون تخصیص (مسائل دیگر)', d.outflows.unallocatedPayments]);
    rows.push(['چک صادرهٔ مستقل (بابت مسائل دیگر)', d.outflows.independentCheques]);
    rows.push(['هزینه‌های جاری سال', d.outflows.opex]);
    rows.push(['تنخواه مستقل سال', d.outflows.petty]);
    rows.push(['خروجی کل (هزینه)', d.outflowsTotal]);
    rows.push(['سود نقدی دوره', d.netCash]);
    rows.push(['نقد/بانک ابتدای سال (افتتاحیه)', d.openingCash]);
    rows.push(['موجودی نقد پایان سال', d.cashEnd]);
    rows.push(['کف نقدینگی در گردش', d.floor]);
    rows.push(['مازاد بر کف', d.overFloor]);
    rows.push(['قابل تقسیم (' + d.distPct + '٪)', d.distributable]);
    rows.push(['بازگشت به کف (' + (100 - d.distPct) + '٪)', d.backToFloor]);
    (d.amendments || []).forEach(function (a) { rows.push(['سند اصلاحی ' + a.cd + ' (مرجع: ' + a.refYear + ')', +a.amt || 0]); });
    rows.push([]);
    rows.push(['سهامدار', 'درصد', 'سهم از تقسیم نقدی', 'علی‌الحساب سال', 'طلب صندوق', 'بدهی فراخوان', 'مانده جاری', 'نتیجه پس از تقسیم']);
    (d.shareholders || []).forEach(function (sh) { rows.push([sh.name, sh.pct, sh.gross, sh.advYear || 0, sh.fundCredit || 0, sh.fundDebt || 0, sh.currentBalance, sh.final]); });
    var csv = '\uFEFF' + rows.map(function (r2) { return r2.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    try {
      var aEl = document.createElement('a');
      aEl.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      aEl.download = 'fiscal-' + d.year + '.csv';
      aEl.click();
      audit('سال مالی', 'خروجی CSV حسابدار سال ' + d.year, '');
    } catch (e) {}
    return csv; /* برای تست */
  };
  window.ptfFiscalSnapPrint = function (cd) {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var rec = snaps().filter(function (x) { return x.cd === cd && x.data; })[0];
    if (!rec || !rec.data) { alert('snapshot یافت نشد'); return; }
    /* AC4: چاپ از دادهٔ منجمد snapshot — نه محاسبه مجدد؛ کپی برای مصونیت از mutate */
    var frozen = JSON.parse(JSON.stringify(rec.data));
    var html = '<div class="md-b" style="display:grid"><div class="md" style="max-width:980px;max-height:92vh;overflow:auto"><div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:8px 12px;font-size:12px;color:#5b21b6;margin-bottom:10px">' + (rec.locked ? '🔒 snapshot قفل‌شده' : '🔓 snapshot محفوظ پس از بازگشایی') + ' ' + escP(rec.cd) + ' — سال ' + escP(rec.year) + ' — قفل توسط ' + escP(rec.by || '') + ' در ' + escP(rec.lockedAt || rec.t || '') + (rec.unlockedAt ? ' — بازگشایی توسط ' + escP(rec.unlockedBy || '') + ' در ' + escP(rec.unlockedAt) + '؛ دلیل: ' + escP(rec.unlockReason || '') : '') + ' (اعداد منجمد لحظه قفل — US-426ف۲)</div>' + ptfFiscalReportHtml(frozen) + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="ptfPrintWithTitle(\'FIS-\'+(window._fiscalYear||\'\'))">چاپ مرورگر</button><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    try { audit('سال مالی', 'چاپ snapshot قفل‌شده ' + rec.cd + ' (سال ' + rec.year + ')', cd); } catch (e) {}
  };

  if (!window._fiscalHooked) {
    window._fiscalHooked = true;
    var _bp = window.buildPetty;
    if (typeof _bp === 'function') window.buildPetty = function () { return _bp() + fiscalHtml(); };
  }
})();
