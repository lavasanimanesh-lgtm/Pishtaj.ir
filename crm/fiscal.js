/* =====================================================================
   PTF CRM — v31.9
   US-420 + BUG-024 + BUG-025 + US-426 فاز ۱
   داشبورد سال مالی + تقسیم سود + سخت‌سازی محرمانگی + گزارش رسمی/ردیابی اعداد
   ===================================================================== */
(function () {
  'use strict';
  var SNAP_KEY = 'ptf_crm_fiscal_snapshots';
  function canFiscal() { return ['admin', 'chairman'].indexOf(curRole()) > -1; }
  /* قفل‌گشایی عمداً محدود به رییس هیات مدیره است؛ admin/سایر مدیران فقط گزارش را می‌بینند. */
  function canFiscalUnlock() { try { return curRole() === 'chairman'; } catch (e) { return false; } }
  function snaps() { var a = getData(SNAP_KEY); return Array.isArray(a) ? a : []; }
  function saveSnaps(a) { setData(SNAP_KEY, a || []); }
  function fiscalNowIso() { return new Date().toISOString(); }
  function findLocked(year) { return snaps().filter(function (s) { return s && String(s.year) === String(year) && s.locked === true; })[0]; }
  window.ptfFiscalYearLocked = function (year) { return !!findLocked(String(year || '')); };
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
  function lossTotal(o) { return (typeof ptfProjectLossTotal === 'function') ? ptfProjectLossTotal(o) : ((o && o.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0)); }
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
    return Math.max(dealCosts, projectCosts);
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

  window.ptfFiscalData = function (year) {
    year = String(year || yearNow());
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
      var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (z, p) { return z + (+p.amt || 0); }, 0);
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
    var net = projectProfit - (+ox.total || 0) - (+pettyStandalone.total || 0) + amendTotal; /* legacy UAT netProfit += amendTotal: var net = projectProfit - (+ox.total || 0) + amendTotal; */
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
    return { year: year, projects: rows, incomplete: incomplete, undated: cand.undated, invoiceUndated: invUndated, projectProfit: projectProfit, projectLossOnly: projectLossOnly, opexTotal: +ox.total || 0, opexByCat: ox.byCat || {}, pettyStandaloneTotal: +pettyStandalone.total || 0, pettyStandaloneCount: pettyStandalone.count || 0, pettyStandalonePending: +pettyStandalone.pending || 0, pettyStandalonePendingCount: pettyStandalone.pendingCount || 0, pettyStandaloneRows: pettyStandalone.rows || [], openReceivables: openTotal, openReceivablesTotal: openTotal, openReceivablesYear: openYear, amendments: amendments, amendTotal: amendTotal, netProfit: net, financialPosition: financialPosition };
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

  function fiscalHtml() {
    if (!canFiscal()) return '';
    var year = window._fiscalYear || yearNow();
    var distPct = window._fiscalDistPct == null ? 60 : window._fiscalDistPct;
    var d = ptfFiscalDistribution(year, distPct);
    var locked = findLocked(year);
    var incN = d.incomplete.length + d.undated.length + d.invoiceUndated.length;
    var incHtml = incN ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-danger" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;margin:10px 0;color:#991b1b;font-size:12.5px"><b>⚠️ ' + incN + ' مورد نیازمند تعیین تکلیف حسابرسی:</b><br>' + d.incomplete.slice(0, 6).map(function (x) { return '• ناقص سود: ' + escP(x.no || '-') + ' — ' + escP(x.buyerCo || '') + ': ' + escP((x.warnings || []).join(' | ')); }).join('<br>') + (d.undated.length ? '<br>' + d.undated.slice(0, 4).map(function (x) { return '• بدون تاریخ سال مالی: ' + escP(x.no || '-') + ' — ' + escP(x.reason); }).join('<br>') : '') + (d.invoiceUndated.length ? '<br>' + d.invoiceUndated.slice(0, 4).map(function (x) { return '• فاکتور باز بدون تاریخ: ' + escP(x.no || '-') + ' — مانده ' + money(x.remain); }).join('<br>') : '') + '</div>' : '<div class="ptf-fiscal-alert ptf-fiscal-alert-success" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:8px 12px;margin:10px 0;color:#065f46;font-size:12px">✅ مورد ناقص اثرگذار برای سود سال شناسایی نشد.</div>';
    var shRows = (d.shareholders || []).map(function (s) { var cl = s.final >= 0 ? '#059669' : '#dc2626'; return '<tr><td>' + escP(s.name) + '</td><td>' + s.pct + '٪</td><td>' + money(s.gross) + '</td><td>' + money(s.currentBalance) + '</td><td style="color:' + cl + ';font-weight:900">' + money(Math.abs(s.final)) + (s.final >= 0 ? ' بستانکار' : ' بدهکار') + '</td></tr>'; }).join('');

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
        var sups = getData('ptf_crm_suppliers')||[];
        var sd = (typeof data==='function' ? data() : (function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}} })());
        // از balance() اگر موجود
        if(typeof balance==='function'){
          sups.forEach(function(s){
            var b=balance(s.cd);
            b.forEach(function(bb){ if(bb.amount<0) supCredit+=Math.abs(bb.amount); });
          });
        } else {
          // fallback ساده: جمع credit از supplier_finance
          var allPay = (sd.payments||[]).concat(sd.adjustments||[]);
          // اعتبار = جمع پرداخت‌های بدون تخصیص با cur IRR و منفی
          // برای سادگی از balanceHtml قدیمی استفاده نمی‌کنیم، فقط جمع بستانکاری
          sups.forEach(function(s){
            // اگر تابع balance نیست، از localStorage مستقیم
            var b = (function(){ try{ return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}'); }catch(e){return {}}; })();
            // ساده: اگر ب نیست، 0
          });
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

    var unlockBtn = (locked && canFiscalUnlock()) ? '<button class="bt bt-o" style="font-size:12px;color:#b45309;border-color:#fed7aa" onclick="ptfFiscalUnlockOpen(\'' + escP(String(year)) + '\')">🔓 بازکردن قفل</button>' : '';
    var lockBox = locked ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-lock" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:9px 12px;margin:10px 0;color:#5b21b6;font-size:12.5px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>🔒 سال ' + escP(year) + ' قفل است — snapshot: ' + escP(locked.cd) + ' توسط ' + escP(locked.by || '') + ' در ' + escP(locked.lockedAt || locked.t || '') + (canFiscalUnlock() ? '<br><small>رییس هیات مدیره می‌تواند بدون بازگردانی بک‌آپ و با ثبت دلیل، فقط قفل را باز کند.</small>' : '') + '</span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" style="font-size:11.5px;color:#5b21b6;border-color:#ddd6fe" onclick="ptfFiscalSnapPrint(\'' + escP(locked.cd) + '\')">🖨 چاپ snapshot</button>' + unlockBtn + '</span></div>' : '';
    var unlocked = lastUnlocked(year);
    var unlockHistoryBox = (!locked && unlocked) ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-warning" style="background:#fffbeb;border:1px solid #fed7aa;border-radius:12px;padding:9px 12px;margin:10px 0;color:#9a3412;font-size:12px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span>🔓 آخرین بازگشایی سال ' + escP(year) + ': ' + escP(unlocked.unlockedAt || '') + ' توسط ' + escP(unlocked.unlockedBy || '') + '<br><small>دلیل: ' + escP(unlocked.unlockReason || 'ثبت نشده') + ' — snapshot اصلی حفظ شده است.</small></span><button class="bt bt-o" style="font-size:11px" onclick="ptfFiscalSnapPrint(\'' + escP(unlocked.cd) + '\')">🖨 چاپ snapshot محفوظ</button></div>' : '';
    return '<div id="fiscalBox" class="ptf-fiscal-shell" style="background:#f8fafc;border:1px solid var(--brd);border-radius:16px;padding:12px 14px;margin:12px 0">' + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div><b class="ptf-fiscal-title" style="font-size:14px;color:#0f172a">' + fiscalIcon('calendar') + ' داشبورد سال مالی و تقسیم سود</b><br><small style="color:#64748b">محرمانه — فقط admin/chairman. قاعده سال: تاریخ مختومه/برد/ثبت سند.</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><input value="' + escP(year) + '" onchange="window._fiscalYear=this.value.trim();ptfFiscalRender()" style="width:76px;padding:7px;border:1px solid var(--brd);border-radius:9px;direction:ltr"><input value="' + escP(distPct) + '" onchange="window._fiscalDistPct=this.value.trim();ptfFiscalRender()" title="درصد تقسیم سود" style="width:62px;padding:7px;border:1px solid var(--brd);border-radius:9px;direction:ltr"><button class="bt" style="font-size:12px" onclick="ptfFiscalLock()">🔒 قفل سال</button><button class="bt bt-o" style="font-size:12px" onclick="ptfFiscalPrint()">گزارش رسمی</button><button class="bt bt-o" style="font-size:12px;color:#059669;border-color:#a7f3d0" onclick="ptfFiscalCsv()">📥 CSV حسابدار</button><button class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfFiscalAmendOpen()">🧾 سند اصلاحی</button></div></div>' + lockBox + unlockHistoryBox + '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:10px"><div class="sc ptf-fiscal-kpi"><b>' + money(d.projectProfit) + '</b><span>سود/زیان پروژه‌های قابل اتکا</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.opexTotal) + '</b><span>هزینه‌های جاری مستقل سال</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.pettyStandaloneTotal || 0) + '</b><span>هزینه‌های تنخواه مستقل سال (' + (d.pettyStandaloneCount || 0) + ' مورد)</span></div><div class="sc ptf-fiscal-kpi"><b style="color:' + ((d.amendTotal || 0) >= 0 ? '#7c3aed' : '#dc2626') + '">' + money(d.amendTotal || 0) + '</b><span>سند اصلاحی موثر بر سال (' + (d.amendments || []).length + ')</span></div><div class="sc ptf-fiscal-kpi"><b style="color:' + (d.netProfit >= 0 ? '#059669' : '#dc2626') + '">' + money(d.netProfit) + '</b><span>سود خالص مدیریتی پس از هزینه‌ها</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.distributable) + '</b><span>قابل تقسیم (' + d.distPct + '٪)</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.reserve) + '</b><span>اندوخته صندوق</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.openReceivablesYear) + '</b><span>مطالبات باز ایجادشده در سال</span></div><div class="sc ptf-fiscal-kpi"><b>' + money(d.openReceivablesTotal) + '</b><span>مطالبات باز کل شرکت</span></div></div>' + extraCards + incHtml + ((d.amendments || []).length ? '<div class="ptf-fiscal-alert ptf-fiscal-alert-lock" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:9px 12px;margin:10px 0;font-size:12px;color:#5b21b6"><b>سندهای اصلاحی موثر بر سال ' + escP(String(d.year)) + ':</b><br>' + d.amendments.map(function (a) { return '• <b>' + escP(a.cd) + '</b> (مرجع: سال قفل‌شده ' + escP(a.refYear) + ') — ' + (a.amt >= 0 ? '➕' : '➖') + ' ' + money(Math.abs(a.amt)) + ' — ' + escP(a.desc) + ' <small style="color:#94a3b8">(' + escP(a.t || '') + ' — ' + escP(a.by || '') + ')</small>'; }).join('<br>') + '</div>' : '') + '<div class="tb2"><table><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم سود</th><th>مانده جاری</th><th>نتیجه پس از تقسیم</th></tr></thead><tbody>' + (shRows || '<tr><td colspan="5">سهامداری ثبت نشده</td></tr>') + '</tbody></table></div></div>';
  }

  window.ptfFiscalRender = function () { if (!canFiscal()) return; var el = document.getElementById('fiscalBox'); if (el) el.outerHTML = fiscalHtml(); };
  window.ptfFiscalLock = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره'); return; }
    var year = window._fiscalYear || yearNow();
    // v29.3: فقط پس از پایان سال مالی - طبق دستور کارفرما
    try {
      var curY = parseInt(yearNow(),10);
      var yInt = parseInt(year,10);
      if(yInt >= curY){
        alert('⛔ امکان قفل سال مالی قبل از پایان سال وجود ندارد.\n\nسال جاری: '+curY+'\nسال انتخابی برای قفل: '+year+'\n\nطبق مصوبه: فقط پس از پایان سال مالی (شروع سال بعد) می‌توان اسناد آن سال را قفل کرد و سپس افتتاحیه سال بعد را زد.\n\nمثال: برای قفل سال 1404 باید در سال 1405 باشید، برای قفل 1405 باید در سال 1406 باشید.');
        return;
      }
    } catch(e){}
    if (snaps().some(function (s) { return s.year === String(year) && s.locked; })) { alert('🔒 این سال قبلاً قفل شده است. اصلاحات باید در سال جاری به‌صورت سند اصلاحی ثبت شوند.'); return; }
    var d = ptfFiscalDistribution(year, window._fiscalDistPct == null ? 60 : window._fiscalDistPct);
    if ((d.incomplete.length || d.undated.length || d.invoiceUndated.length) && !confirm('⚠️ ' + (d.incomplete.length + d.undated.length + d.invoiceUndated.length) + ' مورد ناقص/بی‌تاریخ وجود دارد و در سود لحاظ نشده است. با این وجود snapshot سال قفل شود؟')) return;
    var nowLock = faDateTime(), nowLockIso = fiscalNowIso();
    var rec = { cd: genCode('FSY'), year: String(year), locked: true, t: nowLock, lockedAt: nowLock, lockStateAtISO: nowLockIso, ts: nowLockIso, by: (curSession() || {}).name || '', data: d };
    var a = snaps(); a.unshift(rec); saveSnaps(a); audit('سال مالی', 'قفل snapshot سال ' + year + ' — سود خالص ' + money(d.netProfit), rec.cd); if (typeof ptfToast === 'function') ptfToast('سال مالی قفل شد', 'ok'); ptfFiscalRender();
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
    year = String(year || window._fiscalYear || yearNow());
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
    var sh = (d.shareholders || []).map(function (s) { return tr([escP(s.name), s.pct + '٪', money(s.gross), money(s.currentBalance), money(s.final)]); }).join('');
    return '<div style="direction:rtl;font-family:Tahoma,Vazirmatn,sans-serif;color:#0f172a"><h2>گزارش رسمی سال مالی ' + escP(d.year) + '</h2><p>سود خالص مدیریتی: <b>' + money(d.netProfit) + '</b>' + ((d.amendments || []).length ? ' (شامل ' + (d.amendments || []).length + ' سند اصلاحی: ' + money(d.amendTotal || 0) + ')' : '') + ' | قابل تقسیم: <b>' + money(d.distributable) + '</b> | اندوخته: <b>' + money(d.reserve) + '</b> | مطالبات باز کل: <b>' + money(d.openReceivablesTotal) + '</b></p><h3>منبع سود پروژه‌ها</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>پرونده</th><th>کارفرما</th><th>تاریخ</th><th>فروش</th><th>خرید</th><th>هزینه مستقیم</th><th>زیان</th><th>سود</th></tr></thead><tbody>' + (pr || '<tr><td colspan="8">موردی نیست</td></tr>') + '</tbody></table><h3>هزینه‌های جاری</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + (ox || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>هزینه‌های تنخواه مستقل سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + ((d.pettyStandaloneRows || []).map(function (p) { return tr([escP(p.cd || ''), escP(p.cat || ''), escP(p.by || ''), escP(p.st || ''), money(p.amt || 0)]); }).join('') || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>سندهای اصلاحی موثر بر سال</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سند</th><th>سال مرجع</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>' + ((d.amendments || []).map(function (a) { return tr([escP(a.cd), escP(a.refYear), (a.amt >= 0 ? '+' : '−') + money(Math.abs(a.amt)), escP(a.desc || '')]); }).join('') || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table><h3>موارد ناقص/بی‌تاریخ</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tbody>' + (inc || '<tr><td>موردی نیست</td></tr>') + '</tbody></table><h3>کاربرگ تقسیم سود</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم سود</th><th>مانده جاری</th><th>نتیجه</th></tr></thead><tbody>' + (sh || '<tr><td colspan="5">سهامداری ثبت نشده</td></tr>') + '</tbody></table></div>';
  };
  /* Sprint 281: print/snapshot report receives an immutable summary of the
     matching official financial position. No live data is injected into an old
     frozen snapshot that predates this field. */
  var _ptfFiscalReportHtml281 = window.ptfFiscalReportHtml;
  window.ptfFiscalReportHtml = function (d) {
    var h = _ptfFiscalReportHtml281(d), fp = d && d.financialPosition;
    if (!fp || !fp.total) return h;
    var x = fp.total;
    var box = '<h3>وضعیت مالی و سرمایه در گردش ثبت‌شده</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th>سرفصل</th><th>مبلغ (ریال)</th></tr></thead><tbody><tr><td>مطالبات باز مشتریان</td><td>' + money(x.receivable) + '</td></tr><tr><td>بدهی باز تأمین‌کنندگان</td><td>' + money(x.supplierLiability) + '</td></tr><tr><td>اعتبار نزد تأمین‌کنندگان</td><td>' + money(x.supplierCredit) + '</td></tr><tr><td>چک‌های شرکتی باز</td><td>' + money(x.companyCheque) + '</td></tr><tr><td><b>خالص سرمایه در گردش ثبتی</b></td><td><b>' + money(x.netWorkingCapital) + '</b></td></tr></tbody></table><p style="font-size:11px;color:#64748b">منبع: محاسبه فقط‌خواندنی گزارش تجمیعی مالی (رسمی+غیررسمی) در زمان تهیهٔ این گزارش؛ چک شخصی، چک انتقالی و چک ابطال‌شده وارد نشده‌اند.</p>';
    return h.replace(/<\/div>\s*$/, box + '</div>');
  };

  window.ptfFiscalPrint = function () {
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره'); return; }
    var year = window._fiscalYear || yearNow();
    var d = ptfFiscalDistribution(year, window._fiscalDistPct == null ? 60 : window._fiscalDistPct);
    var html = '<div class="md-b" style="display:grid"><div class="md" style="max-width:980px;max-height:92vh;overflow:auto"><div id="fisReportPrintable">' + ptfFiscalReportHtml(d) + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="ptfPrintWithTitle(\'FIS-\'+(window._fiscalYear||\'\'))">چاپ مرورگر</button><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
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
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره'); return; }
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
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره'); return null; }
    year = String(year || window._fiscalYear || yearNow());
    var d = ptfFiscalDistribution(year, window._fiscalDistPct == null ? 60 : window._fiscalDistPct);
    var rows = [['گزارش سال مالی', d.year], []];
    rows.push(['#', 'بخش', 'شرح', 'کارفرما/دسته', 'تاریخ', 'فروش (ت)', 'خرید (ت)', 'هزینه مستقیم (ت)', 'زیان (ت)', 'مبلغ/سود (ت)']);
    var i = 0;
    (d.projects || []).forEach(function (p) { i++; rows.push([i, 'پروژه', p.no || '', p.buyerCo || '', p.date || '', p.sellIrr || 0, p.buyIrr || 0, p.projectCostIrr || 0, p.loss || 0, p.profit || 0]); });
    Object.keys(d.opexByCat || {}).forEach(function (k) { i++; rows.push([i, 'هزینه جاری', k, '', d.year, '', '', '', '', -(+d.opexByCat[k] || 0)]); });
    (d.pettyStandaloneRows || []).forEach(function (p) { i++; rows.push([i, 'تنخواه مستقل', p.cd || '', p.cat || '', p.t || d.year, '', '', '', '', -(+p.amt || 0)]); });
    (d.amendments || []).forEach(function (a) { i++; rows.push([i, 'سند اصلاحی', a.desc + ' (مرجع: سال ' + a.refYear + ' — ' + a.cd + ')', '', a.t || '', '', '', '', +a.amt || 0]); });
    rows.push([]);
    rows.push(['', 'جمع سود پروژه‌ها', d.projectProfit], ['', 'جمع هزینه جاری', -d.opexTotal], ['', 'جمع تنخواه مستقل', -(d.pettyStandaloneTotal || 0)], ['', 'جمع سند اصلاحی', d.amendTotal || 0], ['', 'سود خالص مدیریتی', d.netProfit], ['', 'قابل تقسیم (' + d.distPct + '٪)', d.distributable], ['', 'اندوخته', d.reserve], ['', 'مطالبات باز سال', d.openReceivablesYear], ['', 'مطالبات باز کل', d.openReceivablesTotal]);
    rows.push([]);
    rows.push(['سهامدار', 'درصد', 'سهم سود', 'مانده جاری', 'نتیجه']);
    (d.shareholders || []).forEach(function (sh) { rows.push([sh.name, sh.pct, sh.gross, sh.currentBalance, sh.final]); });
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
    if (!canFiscal()) { alert('⛔ فقط ادمین/رییس هیات مدیره'); return; }
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
