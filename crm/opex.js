/* =====================================================================
   PTF CRM — opex.js — US-418 + v34.8.0 monthly reconcile
   هزینه‌های جاری شرکت: اجاره، حقوق/دستمزد، بیمه، مالیات، پذیرایی/اداری،
   پورسانت بیرونی، ایاب‌ذهاب/ماموریت، سایر — ماهانه (شمسی) + تکرارشونده.
   اصول:
   - جای نمایش: داخل پنل «تنخواه گردان» (تنخواه = زیرمجموعه هزینه‌ها — مصوبه R9)
     با hook — بدون شکستن petty؛ فقط نقش‌های دارای finance می‌بینند.
   - کلید ptf_crm_opex سینک و بک‌آپ می‌شود و سپر داده‌صفر v16.7 را دارد.
   - هزینه تکرارشونده در settings.opexTpl تعریف می‌شود و فقط سرور، پس از snapshot
     قطعی Sync، آن را idempotent materialize می‌کند؛ کلاینت صرفاً delta را merge می‌کند.
   - مصرف‌کننده آینده: US-420 (داشبورد سال مالی) — جمع per ماه/دسته/سال از همین کلید.
   ===================================================================== */
(function () {
  'use strict';

  var K = 'ptf_crm_opex';
  var OPEX_ROW_ID = '_opexRowId';
  var opexRowSeq = 0;
  window.PTF_OPEX_CATS = ['اجاره‌بها', 'حقوق و دستمزد', 'بیمه', 'مالیات', 'پذیرایی و اداری', 'پورسانت بیرونی', 'ایاب‌ذهاب و ماموریت', 'کارمزد فاکتورساز', 'سایر'];
  var COVER_OPEX_CAT = 'کارمزد فاکتورساز';

  function oAll() { return getData(K) || []; }
  function canFin() { try { return !!(roleDef() || {}).finance; } catch (e) { return false; } }
  function fmtT(v) { return (+v || 0).toLocaleString('fa-IR'); }
  /* همهٔ مصرف‌کنندگان OPEX باید دقیقاً یک قرارداد active داشته باشند. بعضی داده‌های
     legacy فقط status/st دارند و بعضی حذف/ابطال را با فلگ boolean ثبت کرده‌اند؛ اگر
     هرکدام terminal باشد ردیف نباید در جمع، قالب، چک یا رندر دوباره ظاهر شود. */
  function opexRowActive(x) {
    if (!x || x.voided || x.deleted) return false;
    var terminal = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
    var status = String(x.status || '').toLowerCase(), st = String(x.st || '').toLowerCase();
    return terminal.indexOf(status) < 0 && terminal.indexOf(st) < 0;
  }

  /* v34.4.46: cd در داده‌های قدیمی می‌تواند تکراری باشد و برای هویت UI کافی نیست.
     هر رکورد یک شناسهٔ فنی پایدار می‌گیرد؛ duplicate شدن خود row id هم هنگام backfill
     اصلاح می‌شود تا همهٔ actionها دقیقاً به object همان ردیف متصل بمانند. */
  function opexNewRowId() {
    opexRowSeq++;
    return 'OPXR-' + Date.now().toString(36) + '-' + opexRowSeq.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function opexEnsureRowIds(list) {
    var seen = {}, changed = false;
    (list || []).forEach(function (rec) {
      if (!rec) return;
      var rowId = String(rec[OPEX_ROW_ID] || '');
      if (!rowId || seen[rowId]) {
        do { rowId = opexNewRowId(); } while (seen[rowId]);
        rec[OPEX_ROW_ID] = rowId;
        changed = true;
      }
      seen[rowId] = true;
    });
    return changed;
  }
  function oSave(list) {
    opexEnsureRowIds(list);
    setData(K, list);
  }
  function oRows() {
    var list = oAll();
    if (opexEnsureRowIds(list)) setData(K, list); /* مهاجرت یک‌بارهٔ رکوردهای legacy */
    return list;
  }
  function opexWarnDuplicate(cd) {
    var msg = 'کد ' + String(cd || '') + ' تکراری است؛ عملیات را فقط از دکمه‌های همان ردیف انجام دهید.';
    if (typeof ptfToast === 'function') ptfToast(msg, 'warn');
    else alert(msg);
  }
  function opexFindRow(list, cd, rowId, notify) {
    var rec = null;
    if (rowId) {
      /* handler ردیف‌محور هرگز نباید بعد از حذف/تغییر آن ردیف روی هم‌کدِ دیگری
         fallback کند؛ نبودن شناسه یعنی همان action دیگر معتبر نیست. */
      return (list || []).filter(function (x) { return x && x[OPEX_ROW_ID] === rowId; })[0] || null;
    }
    var sameCode = (list || []).filter(function (x) { return x && x.cd === cd; });
    if (sameCode.length === 1) return sameCode[0]; /* سازگاری callerهای قدیمی مثل data-quality */
    if (sameCode.length > 1 && notify !== false) opexWarnDuplicate(cd);
    return null; /* روی کد مبهم هرگز ردیف اول را حدس نزن */
  }
  function opexNextCode(list) {
    if (!list) list = oRows();
    var used = {};
    list.forEach(function (x) { if (x && x.cd) used[x.cd] = true; });
    var cd = typeof genCode === 'function' ? genCode('OPX') : '';
    var tries = 0;
    while ((!cd || used[cd]) && tries++ < 20) cd = typeof genCode === 'function' ? genCode('OPX') : '';
    if (!cd || used[cd]) {
      var max = 1000;
      Object.keys(used).forEach(function (code) {
        var mt = String(code).match(/^OPX-(\d+)$/i);
        if (mt && +mt[1] > max) max = +mt[1];
      });
      do { max++; cd = 'OPX-' + max; } while (used[cd]);
    }
    return cd;
  }
  function opexDealEvent(deal, rec, claimLegacy) {
    if (!deal || !rec) return null;
    deal.costEvents = deal.costEvents || [];
    var exact = deal.costEvents.filter(function (x) { return x && x.opexRowId === rec[OPEX_ROW_ID]; });
    if (exact.length === 1) return exact[0];
    var legacy = deal.costEvents.filter(function (x) { return x && !x.opexRowId && x.cd === rec.cd; });
    var ev = legacy.length === 1 ? legacy[0] : null;
    if (!ev && legacy.length > 1) {
      var amountMatch = legacy.filter(function (x) { return (+x.amt || 0) === (+rec.amt || 0); });
      if (amountMatch.length === 1) ev = amountMatch[0];
    }
    if (ev && claimLegacy) ev.opexRowId = rec[OPEX_ROW_ID];
    return ev;
  }

  /* ماه شمسی جاری «1405/04» — ورودی دستی هم پذیرفته می‌شود */
  window.ptfFaMonthNow = function () {
    try {
      var p = new Date().toLocaleDateString('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran' }).split('/');
      return p[0] + '/' + ('0' + p[1]).slice(-2);
    } catch (e) {
      try { return faDate().split('/').slice(0, 2).join('/'); } catch (e2) { return ''; }
    }
  };
  function normMonth(m) {
    m = String(m || '').trim().replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    var mt = m.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (!mt) return '';
    return mt[1] + '/' + ('0' + mt[2]).slice(-2);
  }
  var OPEX_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  function opexMonthYears() {
    var years = {}, now = String(ptfFaMonthNow() || '').split('/')[0];
    if (/^14\d{2}$/.test(now) || /^13\d{2}$/.test(now)) {
      var y0 = +now;
      for (var y = y0 - 3; y <= y0 + 2; y++) years[y] = true;
    }
    oAll().forEach(function (x) {
      var ym = String((x && x.month) || '').split('/')[0];
      if (/^(13|14)\d{2}$/.test(ym)) years[ym] = true;
    });
    return Object.keys(years).sort();
  }
  function opexMonthOptions(selected, allowAll) {
    selected = normMonth(selected) || '';
    var html = allowAll ? '<option value=\"\">همه ماه‌ها</option>' : '';
    var seen = {};
    opexMonthYears().forEach(function (year) {
      for (var i = 1; i <= 12; i++) {
        var val = year + '/' + ('0' + i).slice(-2);
        seen[val] = true;
        html += '<option value=\"' + val + '\"' + (selected === val ? ' selected' : '') + '>' + OPEX_MONTH_NAMES[i - 1] + ' ' + year + ' — ' + val + '</option>';
      }
    });
    if (selected && !seen[selected]) html += '<option value=\"' + selected + '\" selected>' + selected + '</option>';
    return html;
  }

  /* ---------- جمع‌ها (مصرف: پنل + US-420 آینده) ---------- */
  window.ptfOpexSum = function (monthOrYear) {
    var pre = String(monthOrYear || '');
    var out = { total: 0, byCat: {}, totalLinked:0, totalUnlinked:0 };
    oAll().forEach(function (x) {
      if (!opexRowActive(x)) return;
      if (pre && String(x.month || '').indexOf(pre) !== 0) return;
      var amt=(+x.amt||0);
      out.total += amt;
      out.byCat[x.cat] = (out.byCat[x.cat] || 0) + amt;
      if(x.dealRef){
        out.totalLinked+=amt;
      }else{
        out.totalUnlinked+=amt;
      }
    });
    return out;
  };
  function isCoverOpex(x) { return !!(x && (x.fromCoverInvoice || x.coverInvoiceCd)); }
  /* v34.8.7/F3: حقوق سهامدار تعهدی است؛ تا ثبت draw، OPEX آن خروج نقدی نیست.
     shareTx/recurringKey are the durable markers. A generic manual OPEX with only
     category «حقوق و دستمزد» is intentionally not classified as a shareholder claim. */
  function isShareholderSalaryOpex(x) {
    return !!(x && (x.shareholderSalary === true || x.shareTx || String(x.recurringKey || '').indexOf('salary:') === 0));
  }
  window.ptfIsShareholderSalaryOpex = isShareholderSalaryOpex;
  // v30.2 FIN-WF-008: برای جلوگیری از دوباره‌شماری، fiscal فقط unlinked را می‌خواهد.
  // کارمزد فاکتور پوششی در پنل هزینه جاری دیده می‌شود ولی در سود سال از روی خود فاکتور
  // (coverCommission / coverNetBenefit) لحاظ می‌شود تا دوباره‌شماری نشود.
  window.ptfOpexSumFiscal = function(monthOrYear){
    var pre = String(monthOrYear || '');
    var out = { total: 0, byCat: {}, totalLinked: 0, totalUnlinked: 0, totalSalary: 0, totalCash: 0 };
    oAll().forEach(function (x) {
      if (!opexRowActive(x) || isCoverOpex(x)) return;
      if (pre && String(x.month || '').indexOf(pre) !== 0) return;
      var amt = (+x.amt || 0), salary = isShareholderSalaryOpex(x);
      out.byCat[x.cat] = (out.byCat[x.cat] || 0) + amt;
      if (salary) out.totalSalary += amt;
      if (x.dealRef) out.totalLinked += amt;
      else {
        out.totalUnlinked += amt;
        if (!salary) out.totalCash += amt;
      }
    });
    out.total = out.totalUnlinked;
    return out;
  };
  function coverOpexMonthOf(inv) {
    var fa = String((inv && (inv.dateFa || '')) || '');
    var mt = fa.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).match(/(\d{4})[\/\-](\d{1,2})/);
    if (mt) return mt[1] + '/' + ('0' + mt[2]).slice(-2);
    if (inv && inv.dateISO && typeof ptfISOToJ === 'function') {
      var j = ptfISOToJ(inv.dateISO) || '';
      var mt2 = String(j).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).match(/(\d{4})[\/\-](\d{1,2})/);
      if (mt2) return mt2[1] + '/' + ('0' + mt2[2]).slice(-2);
    }
    if (typeof ptfFaMonthNow === 'function') return ptfFaMonthNow() || '';
    return '';
  }
  function coverCommissionOf(inv) {
    if (!inv) return 0;
    if (inv.coverCommissionAmount != null && +inv.coverCommissionAmount > 0) return Math.round(+inv.coverCommissionAmount || 0);
    var base = (inv.cur && inv.cur !== 'IRR') ? (+inv.amount || 0) * (+inv.rate || 0) : (+inv.amountIrr || +inv.amount || 0);
    return Math.round(base * (+inv.coverCommissionPct || 0) / 100);
  }
  /* فاکتور خرید رسمی پوششی: صادرکننده مطالبه ندارد؛ فقط کارمزد فاکتورساز هزینه جاری غیررسمی است. */
  window.ptfOpexUpsertFromCoverInvoice = function (inv) {
    if (!inv || !inv.cd) return { ok: false, why: 'input' };
    if (inv.isCover !== true || !opexRowActive(inv)) {
      return window.ptfOpexRemoveFromCoverInvoice(inv.cd);
    }
    var comm = coverCommissionOf(inv);
    if (!(comm > 0)) return { ok: false, why: 'commission' };
    var month = coverOpexMonthOf(inv);
    if (!month) return { ok: false, why: 'month' };
    var desc = 'کارمزد فاکتورساز فاکتور پوششی ' + (inv.no || inv.cd) + (inv.supName ? ' — ' + inv.supName : '');
    var all = oRows();
    var rec = all.filter(function (x) { return opexRowActive(x) && x.coverInvoiceCd === inv.cd; })[0];
    var who = '';
    try { who = (curSession() || {}).name || ''; } catch (eW) {}
    if (rec) {
      rec.amt = comm;
      rec.month = month;
      rec.desc = desc;
      rec.cat = COVER_OPEX_CAT;
      rec.isOfficial = false;
      rec.fromCoverInvoice = true;
      rec.coverSupplierCd = inv.supplierCd || rec.coverSupplierCd || '';
      rec.updatedAtISO = new Date().toISOString();
      rec.updatedBy = who;
      oSave(all);
      return { ok: true, rec: rec, updated: true };
    }
    rec = {
      cd: opexNextCode(all), cat: COVER_OPEX_CAT, amt: comm, month: month, desc: desc,
      isOfficial: false, fromCoverInvoice: true, coverInvoiceCd: inv.cd,
      coverSupplierCd: inv.supplierCd || '', st: 'open',
      t: (typeof faDate === 'function' ? faDate() : ''), by: who || 'سیستم'
    };
    rec[OPEX_ROW_ID] = opexNewRowId();
    all.unshift(rec);
    oSave(all);
    try { audit('هزینه جاری', 'ثبت خودکار کارمزد فاکتورساز پوششی ' + (inv.no || inv.cd) + ' — ' + fmtT(comm) + ' ریال (' + month + ')', rec.cd); } catch (eA) {}
    return { ok: true, rec: rec, created: true };
  };
  function opexSettlementRequired(x) {
    return !!(x && (isCoverOpex(x) || x.tplId));
  }
  function opexSettled(x) {
    return !!(x && (x.st === 'settled' || x.chequeCd));
  }
  /* نام legacy برای سازگاری tester/callerهای کارمزد پوششی نگه داشته شده است. */
  function coverOpexSettled(x) { return opexSettled(x); }
  window.ptfOpexCoverIsSettled = coverOpexSettled;
  window.ptfOpexIsSettled = opexSettled;
  window.ptfOpexSettlementRequired = opexSettlementRequired;
  window.ptfOpexSettleCommit = function (rec, v) {
    if (!rec || !opexSettlementRequired(rec)) return { ok: false, why: 'not-settlement-required' };
    if (!opexRowActive(rec)) return { ok: false, why: 'void' };
    if (opexSettled(rec)) return { ok: false, why: 'already' };
    var doc = String((v && v.doc) || '').trim();
    if (!doc) return { ok: false, why: 'doc' };
    var all = oRows();
    var target = opexFindRow(all, rec.cd, rec[OPEX_ROW_ID], false) || rec;
    target.st = 'settled';
    target.settleDoc = doc;
    target.settledBy = (v && v.by) || '';
    try { if (!target.settledBy) target.settledBy = (curSession() || {}).name || ''; } catch (eB) {}
    target.settledT = (typeof faDateTime === 'function' ? faDateTime() : '');
    target.settleISO = (typeof ptfTodayISO === 'function' ? ptfTodayISO() : new Date().toISOString().slice(0, 10));
    target.payHow = target.payHow || 'bank';
    if (v && v.files && v.files.length) target.files = (target.files || []).concat(v.files);
    oSave(all);
    var kindLabel = isCoverOpex(target) ? 'کارمزد فاکتورساز پوششی' : 'هزینه تکرارشونده ' + (target.cat || '');
    try { audit('هزینه جاری', 'تسویه ' + kindLabel + ' با سند ' + doc + ' — ' + fmtT(target.amt) + ' ریال', target.cd); } catch (eA) {}
    return { ok: true, rec: target };
  };
  window.ptfOpexSettleCoverCommit = function (rec, v) {
    if (!rec || !isCoverOpex(rec)) return { ok: false, why: 'not-cover' };
    return window.ptfOpexSettleCommit(rec, v);
  };
  window.ptfOpexSettle = function (cd, rowId) {
    if (!canFin()) return;
    var rec = opexFindRow(oRows(), cd, rowId, true);
    if (!rec) return;
    if (!opexSettlementRequired(rec)) { alert('این ردیف هزینه نیازمند تسویهٔ جداگانه نیست.'); return; }
    if (opexSettled(rec)) { alert('این هزینه قبلاً تسویه شده است (سند: ' + (rec.settleDoc || rec.chequeCd || '-') + ').'); return; }
    var isCover = isCoverOpex(rec);
    var settleTitle = isCover ? 'کارمزد فاکتورساز' : 'هزینه تکرارشونده ' + (rec.cat || '');
    if (typeof window.ptfFinanceAssertWritable === 'function' && !window.ptfFinanceAssertWritable(rec.month, { action: 'تسویه ' + settleTitle }).ok) return;
    if (typeof ptfDialog !== 'function') {
      var raw = prompt('شماره/شرح سند پرداخت ' + settleTitle, '');
      if (raw == null) return;
      var r0 = window.ptfOpexSettleCommit(rec, { doc: raw });
      if (!r0.ok) { alert('⛔ تسویه ثبت نشد'); return; }
      ptfOpexRender();
      return;
    }
    ptfDialog({
      title: '✔ تسویه ' + settleTitle + ' — ' + rec.cd,
      body: 'مبلغ: <b>' + fmtT(rec.amt) + ' ریال</b><br><small>پس از ثبت تسویه، دقیقاً یک خروج نقد از خزانه/بانک ثبت می‌شود. مدرک پرداخت را همین‌جا پیوست کنید.</small>',
      fields: [
        { id: 'doc', label: 'شماره/شرح سند پرداخت *', required: true, placeholder: 'مثال: حواله بانکی ۱۲۳۴۵' },
        { id: 'files', label: 'مدرک پرداخت (رسید بانکی، فیش، تصویر چک)', type: 'upload', uploadFolder: 'opex/' + rec.cd }
      ],
      okText: 'ثبت تسویه',
      onOk: function (v) {
        var r = window.ptfOpexSettleCommit(rec, v);
        if (!r.ok) {
          alert(r.why === 'doc' ? '⛔ شماره/شرح سند پرداخت الزامی است' : '⛔ تسویه ثبت نشد');
          return;
        }
        if (typeof ptfToast === 'function') ptfToast('✅ هزینه تسویه شد و خروج خزانه/بانک ثبت شد', 'ok');
        ptfOpexRender();
        try { if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender(); } catch (eT) {}
      }
    });
  };
  window.ptfOpexSettleCover = function (cd, rowId) {
    var rec = opexFindRow(oRows(), cd, rowId, true);
    if (rec && !isCoverOpex(rec)) { alert('تسویهٔ این مسیر فقط برای کارمزد فاکتور پوششی است.'); return; }
    window.ptfOpexSettle(cd, rowId);
  };

  window.ptfOpexRemoveFromCoverInvoice = function (invoiceCd) {
    if (!invoiceCd) return { ok: true, removed: 0 };
    var all = oRows();
    var next = all.filter(function (x) { return !(x && x.coverInvoiceCd === invoiceCd); });
    var n = all.length - next.length;
    if (n) {
      oSave(next);
      try { audit('هزینه جاری', 'حذف کارمزد فاکتورساز پوششی متصل به ' + invoiceCd, invoiceCd); } catch (eA) {}
    }
    return { ok: true, removed: n };
  };


  /* ---------- قالب‌های تکرارشونده (settings.opexTpl — سینک‌شونده) ---------- */
  function tpls() {
    try {
      var st = typeof getData === 'function' ? getData('ptf_crm_settings') : null;
      if (!st || Array.isArray(st) || typeof st !== 'object') st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      return Array.isArray(st.opexTpl) ? st.opexTpl : [];
    } catch (e) { return []; }
  }
  function saveTpls(list) {
    var st = {};
    try { st = typeof getData === 'function' ? getData('ptf_crm_settings') : {}; } catch (e) {}
    if (!st || Array.isArray(st) || typeof st !== 'object') st = {};
    st.opexTpl = list;
    setData('ptf_crm_settings', st);
  }
  function recurringKeyForTpl(t, month) { return 'opex-template:' + String((t && t.id) || '') + ':' + String(month || ''); }
  function recurringRowActive(x) { return opexRowActive(x); }
  /* قالب‌هایی که برای ماه جاری هنوز ثبت نشده‌اند */
  window.ptfOpexPendingTpls = function (month) {
    var m = month || ptfFaMonthNow();
    if (!m) return [];
    var list = oAll();
    return tpls().filter(function (t) {
      var key = recurringKeyForTpl(t, m);
      return !list.some(function (x) { return recurringRowActive(x) && (x.recurringKey === key || (x.tplId === t.id && x.month === m)); });
    });
  };

  /* ---------- ثبت هزینه ---------- */
  /* v34.0.2-alpha (F4-7 تکمیلی): اجرای مهاجرت «حقوق سهامدار فاقد opex» از داخل اپ.
     داده از طریق setData ذخیره و خودکار سینک می‌شود؛ بعد از اجرا، پنل هزینه‌های
     جاری و پنل سهامداران بلافاصله تازه می‌شوند. فقط نقش‌های مالی. */
  window.ptfOpexMigrateShareholders = function () {
    if (!canFin()) { alert('⛔ هزینه‌های جاری فقط برای نقش‌های مالی (US-418)'); return; }
    if (typeof window.ptfMigrateShareholderOpex !== 'function') { alert('⚠️ ماژول سهامداران بارگذاری نشده؛ صفحه را تازه کنید.'); return; }
    if (!confirm('حقوق ماه جاری از snapshot قطعی سرور بازسازی/تطبیق شود؟\nاجرای خودکار هیچ tombstone صریحی را restore یا void نمی‌کند.')) return;
    var promise;
    try { promise = window.ptfMigrateShareholderOpex(); }
    catch (e) { if (typeof ptfToast === 'function') ptfToast('⚠️ خطا در فرمان بازسازی: ' + String(e && e.message || e), 'warn'); return; }
    if (!promise || typeof promise.then !== 'function') { if (typeof ptfToast === 'function') ptfToast('⚠️ پاسخ فرمان سروری نامعتبر بود', 'warn'); return; }
    promise.then(function (state) {
      if (state && state.state === 'acked') {
        if (typeof ptfToast === 'function') ptfToast('✅ حقوق و هزینهٔ متناظر از snapshot سرور تطبیق شد', 'ok');
        try { ptfOpexRender(); } catch (eRender) {}
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') ptfToast('⚠️ بازسازی سروری انجام نشد', 'warn');
    });
    return promise;
  };

  /* پیوست‌های هزینه جاری: قبض مالیات، رسید پرداخت، تصویر چک و … روی خود
     رکورد OPEX نگه‌داری می‌شوند و در صورت لینک‌شدن، در پرونده فروش هم دیده می‌شوند. */
  function opexSyncDealFiles(rec) {
    if (!rec || !rec.dealRef) return;
    try {
      var ds = getData('ptf_crm_deals');
      var d = ds.filter(function (x) { return x.cd === rec.dealRef; })[0];
      if (!d) return;
      var ev = opexDealEvent(d, rec, true);
      if (ev) ev.files = (rec.files || []).slice();
      setData('ptf_crm_deals', ds);
    } catch (e) {}
  }
  function opexAttachmentRows(rec) {
    var files = (rec && rec.files) || [];
    if (!files.length) return '<div style="padding:10px;border:1px dashed var(--brd);border-radius:10px;text-align:center;color:#94a3b8">هنوز سندی برای این هزینه ثبت نشده است.</div>';
    return files.map(function (f, index) {
      var key = ptfOnClickArg(f.key || '');
      var name = escP(f.name || ('سند ' + (index + 1)));
      return '<div style="display:flex;align-items:center;gap:7px;min-width:0;padding:7px 9px;margin-bottom:6px;border:1px solid var(--brd);border-radius:10px;background:var(--bg)">' +
        '<span aria-hidden="true">📄</span><span title="' + name + '" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</span>' +
        (f.key ? '<button type="button" class="bt bt-o" style="padding:4px 8px;font-size:11px;flex:none" onclick="openStoredFile(\'' + key + '\')">مشاهده</button>' : '<small style="color:#94a3b8;flex:none">صف محلی</small>') +
        '<button type="button" class="bt bt-o" style="padding:4px 8px;font-size:11px;color:#dc2626;flex:none" title="حذف پیوست" onclick="ptfOpexRemoveFile(\'' + ptfOnClickArg(rec.cd) + '\',\'' + ptfOnClickArg(rec[OPEX_ROW_ID]) + '\',\'' + key + '\')">✕</button></div>';
    }).join('');
  }
  function opexRefreshAttachmentRows(rowId) {
    var dlg = document.getElementById('opexAttachDlg');
    if (!dlg || dlg.getAttribute('data-opex-row-id') !== rowId) return;
    var rec = opexFindRow(oRows(), '', rowId, false);
    var box = document.getElementById('opexAttachFiles');
    if (box) box.innerHTML = rec ? opexAttachmentRows(rec) : '<div style="color:#dc2626">این ردیف دیگر وجود ندارد.</div>';
  }
  window.ptfOpexAttachOpen = function (cd, rowId) {
    if (!canFin()) return;
    var rec = opexFindRow(oRows(), cd, rowId, true);
    if (!rec) return;
    rowId = rec[OPEX_ROW_ID];
    var old = document.getElementById('opexAttachDlg');
    if (old) old.remove();
    var html = '<div class="md-b" id="opexAttachDlg" data-opex-row-id="' + escP(rowId) + '" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:500px"><h3>📎 اسناد هزینه جاری — ' + escP(rec.cd) + '</h3><div style="font-size:12px;color:#475569;line-height:1.8;margin-bottom:10px">قبض، رسید پرداخت، تصویر چک، فاکتور یا هر مدرک مرتبط را بارگذاری کنید. فایل‌ها به همین ردیف هزینه متصل می‌مانند.</div><div id="opexAttachFiles" style="max-height:240px;overflow:auto;margin-bottom:12px;padding-left:2px">' + opexAttachmentRows(rec) + '</div><div id="opexAttachUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="document.getElementById(\'opexAttachDlg\').remove();ptfOpexRender()">تمام</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget !== 'function') { alert('ماژول بارگذاری فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    attachUploadWidget('opexAttachUp', 'opex/' + rec.cd, function (f) {
      var all = oRows(), target = opexFindRow(all, cd, rowId, false);
      if (!target || !f || !f.key) return;
      target.files = target.files || [];
      if (!target.files.some(function (x) { return x.key === f.key; })) target.files.push(f);
      oSave(all); opexSyncDealFiles(target); opexRefreshAttachmentRows(rowId);
      try { audit('هزینه جاری', 'پیوست سند «' + (f.name || '') + '» به هزینه ' + target.cd, target.cd); } catch (eA) {}
      if (typeof ptfToast === 'function') ptfToast('✅ سند به هزینه جاری پیوست شد', 'ok');
    });
  };
  window.ptfOpexRemoveFile = function (cd, rowId, key) {
    /* سازگاری با handler نسخهٔ قبلی که فقط cd,key می‌فرستاد. */
    if (arguments.length < 3) { key = rowId; rowId = ''; }
    if (!canFin() || !key) return;
    var all = oRows(), rec = opexFindRow(all, cd, rowId, true);
    if (!rec) return;
    var file = (rec.files || []).filter(function (x) { return x.key === key; })[0] || {};
    if (!confirm('پیوست «' + (file.name || 'فایل') + '» حذف شود؟')) return;
    rec.files = (rec.files || []).filter(function (x) { return x.key !== key; });
    oSave(all); opexSyncDealFiles(rec); opexRefreshAttachmentRows(rec[OPEX_ROW_ID]);
    try { audit('هزینه جاری', 'حذف پیوست «' + (file.name || '') + '» از هزینه ' + rec.cd, rec.cd); } catch (eA) {}
    try { if (typeof ptfRemoveJustUploaded === 'function') { /* فقط حذف UI نمی‌خواهیم؛ API را مستقیم صدا می‌زنیم */
      fetch(STORAGE_API + '?action=delete', { method: 'POST', headers: ptfStorageAuthHeaders(true), body: JSON.stringify({ key: key }) }).catch(function () {});
    } } catch (eD) {}
    ptfOpexRender();
  };

  window.ptfOpexAdd = function (pre) {
    if (!canFin()) { alert('⛔ هزینه‌های جاری فقط برای نقش‌های مالی (US-418)'); return; }
    pre = pre || {};
    var draftCd = opexNextCode();
    var catOpts = PTF_OPEX_CATS.map(function (c) { return '<option' + (pre.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var dealOpts = '<option value="">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value="' + escP(d.cd) + '">' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '🏢 ثبت هزینه جاری شرکت',
      body: 'همه مبالغ به ریال — مبنای محاسبه سود خالص سال مالی (کیس R9). در صورت انتخاب پرونده فروش، هزینه به همان پرونده هم متصل می‌شود.',
      fields: [
        { id: 'cat', label: 'دسته هزینه', type: 'select', optionsHtml: catOpts },
        { id: 'isOfficial', label: 'نوع سند هزینه', type: 'select', optionsHtml: '<option value="no" selected>غیررسمی (بدون فاکتور ممیزپسند)</option><option value="yes">رسمی (فاکتور رسمی/قابل قبول ممیز)</option>' },
        { id: 'amt', label: 'مبلغ (ریال) *', type: 'number', value: pre.amt || '', dir: 'ltr', required: true },
        { id: 'month', label: 'دوره ماهانه شمسی *', type: 'month', value: pre.month || ptfFaMonthNow(), required: true },
        { id: 'desc', label: 'شرح', type: 'text', value: pre.desc || '' },
        { id: 'dealRef', label: 'مربوط به کدام درخواست/پرونده فروش؟', type: 'select', optionsHtml: dealOpts },
        { id: 'files', label: 'پیوست اسناد (قبض، رسید پرداخت، تصویر چک، فاکتور)', type: 'upload', uploadFolder: 'opex/' + draftCd },
        { id: 'rec', label: 'تکرارشونده ماهانه؟ (اجاره/حقوق — هر ماه پیشنهاد ثبت می‌آید)', type: 'select', optionsHtml: '<option value="no" selected>خیر — یک‌باره</option><option value="yes">بله — هر ماه پیشنهاد شود</option>' }
      ],
      okText: 'ثبت هزینه',
      onOk: function (v) {
        var amt = +v.amt || 0;
        var month = normMonth(v.month);
        if (amt <= 0) { alert('⛔ مبلغ نامعتبر'); return; }
        if (!month) { alert('⛔ ماه شمسی مثل 1405/04 وارد کنید'); return; }
        if (typeof window.ptfFinanceAssertWritable === 'function' && !window.ptfFinanceAssertWritable(month, { action: 'ثبت هزینه جاری', requireCode: draftCd }).ok) return;
        var isOfficial = v.isOfficial === 'yes';
        var all = oRows();
        var finalCd = all.some(function (x) { return x && x.cd === draftCd; }) ? opexNextCode(all) : draftCd;
        var rec = { cd: finalCd, cat: v.cat, amt: amt, month: month, desc: v.desc || '', dealRef: v.dealRef || '', files: (v.files || []).slice(), t: faDate(), by: curSession().name, isOfficial: isOfficial };
        rec[OPEX_ROW_ID] = opexNewRowId();
        if (v.rec === 'yes' || pre.tplId) {
          var list = tpls();
          var tid = pre.tplId || ('TPL-' + Date.now());
          var tpl = list.filter(function (x) { return x && x.id === tid; })[0];
          if (!tpl) {
            tpl = { id: tid, cat: v.cat, amt: amt, desc: v.desc || '', by: curSession().name, t: faDate(), isOfficial: isOfficial };
            list.push(tpl); saveTpls(list);
          }
          /* No local OPEX row is inserted. After ACK, optional document/deal metadata is
             attached to the exact server identity and remains a client-side annotation. */
          materializeTemplateOnServer(tpl, month, { restore: true, reason: 'ثبت صریح قالب جدید ' + tid }).then(function (state) {
            if (!state || state.state !== 'acked') {
              alert('قالب ذخیره شد اما ردیف هزینه روی سرور ثبت نشد: ' + String((state && state.error && state.error.message) || 'نتیجه نامشخص') + '\nپس از سبز شدن همگام‌سازی، از دکمهٔ ثبت قالب دوباره تلاش کنید.');
              ptfOpexRender(); return;
            }
            var rows = oRows(), key = recurringKeyForTpl(tpl, month), target = rows.filter(function (x) { return x && x.recurringKey === key && recurringRowActive(x); })[0];
            if (target) {
              if ((v.files || []).length) target.files = (target.files || []).concat(v.files);
              if (v.dealRef) target.dealRef = v.dealRef;
              oSave(rows);
              if (target.dealRef && typeof window.ptfDealCostSync === 'function') window.ptfDealCostSync({ rec: target, source: 'opex', dealCd: target.dealRef, prevDealCd: '', by: curSession().name, addTx: '➕ لینک هزینه جاری تکرارشونده به پرونده: ' + fmtT(amt) + ' ریال — ' + (v.desc || v.cat) });
            }
            try { audit('هزینه جاری', 'ثبت سروری ' + v.cat + ' — ' + fmtT(amt) + ' ریال (' + month + ') [تکرارشونده]' + (v.dealRef ? ' [linked-deal]' : ''), target ? target.cd : tid); } catch (eA) {}
            if (typeof ptfToast === 'function') ptfToast('✅ قالب و هزینهٔ تکرارشونده روی سرور ثبت شد', 'ok');
            if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR) {} }
            ptfOpexRender();
          });
          return;
        }
        all.unshift(rec);
        oSave(all);
        if (rec.dealRef && typeof window.ptfDealCostSync === 'function') window.ptfDealCostSync({ rec: rec, source: 'opex', dealCd: rec.dealRef, prevDealCd: '', by: curSession().name, addTx: '➕ لینک هزینه جاری به پرونده: ' + fmtT(amt) + ' ریال — ' + (v.desc || v.cat) });
        try { audit('هزینه جاری', 'ثبت ' + v.cat + ' — ' + fmtT(amt) + ' ریال (' + month + ')' + (rec.dealRef ? ' [linked-deal]' : ''), rec.cd); } catch (eA2) {}
        if (typeof ptfToast === 'function') ptfToast('✅ هزینه ثبت شد' + (rec.dealRef ? ' و به پرونده فروش متصل شد' : ''), 'ok');
        if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR2) {} }
        ptfOpexRender();
      }
    });
  };

  window.ptfOpexDel = function (cd, rowId) {
    if (!canFin()) return;
    var all = oRows();
    var rec = opexFindRow(all, cd, rowId, true);
    if (!rec || !opexRowActive(rec)) return;
    if (rec.fromCoverInvoice || rec.coverInvoiceCd) {
      alert('این ردیف از فاکتور خرید پوششی ساخته شده است. برای حذف، همان فاکتور را در حساب تأمین‌کننده ابطال کنید.');
      return;
    }
    if (typeof window.ptfFinanceAssertWritable === 'function' && !window.ptfFinanceAssertWritable(rec.month, { action: 'حذف هزینه جاری' }).ok) return;
    var recurring = !!(rec.recurringKey || rec.serverMaterialized || rec.shareholderSalary || rec.autoApplied || rec.tplId);
    if (recurring) {
      if (typeof window.ptfSalesDomainCommand !== 'function') { alert('⚠️ سرویس ابطال حسابرسی‌پذیر آماده نیست؛ برای جلوگیری از حذف ناامن، عملیات انجام نشد.'); return; }
      var reason = prompt('دلیل ابطال هزینهٔ تکرارشونده را وارد کنید:', 'ابطال صریح توسط کاربر');
      if (reason == null) return;
      reason = String(reason || '').trim();
      if (!reason) { alert('ثبت دلیل ابطال الزامی است.'); return; }
      if (!confirm('این ردیف حذف فیزیکی نمی‌شود؛ به‌صورت سند ابطال پایدار و حسابرسی‌پذیر ثبت شود؟')) return;
      var payload = { _opexRowId: rec[OPEX_ROW_ID] || '', recurringKey: rec.recurringKey || '', cd: rec.cd || '', reason: reason,
        idempotencyKey: 'VOID-REC-OPEX|' + String(rec[OPEX_ROW_ID] || rec.recurringKey || rec.cd) + '|' + Date.now() };
      var voidCommand;
      try {
        voidCommand = window.ptfSalesDomainCommand('void_recurring_opex', payload, { apiOptions: { autoReplay: true } });
        if (!voidCommand || typeof voidCommand.then !== 'function') throw new Error('void_command_promise_required');
      } catch (eCommand) {
        alert('ابطال در سرور ثبت نشد: ' + String((eCommand && eCommand.message) || 'خطای نامشخص'));
        return;
      }
      Promise.resolve(voidCommand).then(function (state) {
        if (state && state.state === 'acked') {
          if (typeof ptfToast === 'function') ptfToast('✅ هزینهٔ تکرارشونده با سند ابطال پایدار ثبت شد', 'ok');
          try { ptfOpexRender(); } catch (eRender) {}
        } else {
          alert('ابطال در سرور ثبت نشد: ' + String((state && state.error && state.error.message) || 'خطای نامشخص'));
        }
      }, function (error) {
        alert('ابطال در سرور ثبت نشد: ' + String((error && error.message) || 'خطای ارتباط با سرور'));
      });
      return;
    }
    // v29.3 FIN-WF-004: قفل سال مالی برای ردیف‌های غیرتکرارشونده
    try {
      var y = String((rec.month||'').split('/')[0]||'').trim();
      if(y){
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        if(snaps.some(function(snap){ return String(snap.year)===String(y) && snap.locked; })){
          alert('🔒 سال مالی '+y+' قفل است - حذف هزینه جاری در سال قفل‌شده مجاز نیست. سند اصلاحی ثبت کنید.');
          return;
        }
      }
    } catch(e){}
    var deleteReason = prompt('دلیل حذف هزینه را وارد کنید:', 'حذف صریح توسط کاربر');
    if (deleteReason == null) return;
    deleteReason = String(deleteReason || '').trim();
    if (!deleteReason) { alert('ثبت دلیل حذف الزامی است.'); return; }
    if (!confirm('🗑 هزینه «' + rec.cat + ' — ' + fmtT(rec.amt) + ' ریال» (' + rec.month + ') با tombstone حسابرسی‌پذیر حذف شود؟')) return;
    /* Full OPEX pulls are merge-only. A physical splice could neither propagate an
       intentional deletion nor distinguish it from an incomplete snapshot. */
    rec.status = 'void'; rec.st = 'void'; rec.voided = true; rec.deleted = true;
    rec.explicitDeletion = true; rec.manualVoid = true; rec.voidIntent = 'explicit';
    rec.voidReason = deleteReason; rec.deletedAt = faDateTime(); rec.deletedBy = curSession().name;
    rec.voidedAt = rec.deletedAt; rec.voidedBy = rec.deletedBy;
    oSave(all);
    if (rec.dealRef && typeof window.ptfDealCostSync === 'function') {
      window.ptfDealCostSync({ rec: rec, source: 'opex', dealCd: '', prevDealCd: rec.dealRef, by: curSession().name, removeTx: '🗑 حذف هزینه جاری لینک‌شده از پرونده: ' + fmtT(rec.amt) + ' ریال — ' + (rec.desc || rec.cat) });
    }
    try { audit('هزینه جاری', 'حذف صریح هزینه ' + rec.cat + ' ' + fmtT(rec.amt) + ' ریال (' + rec.month + ') — دلیل: ' + deleteReason, rec.cd); } catch (eA) {}
    if (typeof renderDeals === 'function') { try { renderDeals(); } catch (eR) {} }
    ptfOpexRender();
  };

  window.ptfOpexEdit = function (cd, rowId) {
    if (!canFin()) return;
    var rec = opexFindRow(oRows(), cd, rowId, true);
    if (!rec || !opexRowActive(rec)) return;
    if (rec.fromCoverInvoice || rec.coverInvoiceCd) {
      alert('این ردیف از فاکتور خرید پوششی ساخته شده است. مبلغ کارمزد را از همان فاکتور ویرایش کنید.');
      return;
    }
    if (rec.shareholderSalary || String(rec.recurringKey || '').indexOf('salary:') === 0) {
      alert('این ردیف projection حقوق است؛ مبلغ/وضعیت را از پروندهٔ همان سهامدار اصلاح کنید تا سرور آن را تطبیق دهد.');
      return;
    }
    if (rec.recurringKey || rec.serverMaterialized || rec.autoApplied || rec.tplId) {
      if (rec.tplId && typeof window.ptfOpexEditTemplate === 'function') window.ptfOpexEditTemplate(rec.tplId, rec.month);
      else alert('منبع قالب این ردیف پیدا نشد؛ برای جلوگیری از دو منبع حقیقت، ردیف projection به‌صورت محلی ویرایش نشد.');
      return;
    }
    rowId = rec[OPEX_ROW_ID];
    if (typeof window.ptfFinanceAssertWritable === 'function' && !window.ptfFinanceAssertWritable(rec.month, { action: 'ویرایش هزینه جاری' }).ok) return;
    // چک قفل سال
    try {
      var y = String((rec.month||'').split('/')[0]||'').trim();
      if(y){
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        if(snaps.some(function(s){ return String(s.year)===String(y) && s.locked; })){
          alert('🔒 سال مالی '+y+' قفل است - ویرایش هزینه جاری در سال قفل‌شده مجاز نیست. سند اصلاحی ثبت کنید.');
          return;
        }
      }
    } catch(e){}
    var catOpts = PTF_OPEX_CATS.map(function (c) { return '<option' + (rec.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var dealOpts = '<option value=\"\">— مستقل از پرونده فروش —</option>' + (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).map(function (d) { return '<option value=\"' + escP(d.cd) + '\"' + (rec.dealRef===d.cd?' selected':'') + '>' + escP(d.inqNo || d.cd) + ' — ' + escP(d.buyerCo || '') + '</option>'; }).join('');
    ptfDialog({
      title: '✏️ ویرایش هزینه جاری - ' + rec.cd,
      body: 'مبلغ به ریال است - در صورت اصلاح واحد مبلغ قدیمی، دلیل را در شرح بنویسید. ویرایش audit می‌شود.',
      fields: [
        { id: 'cat', label: 'دسته هزینه', type: 'select', optionsHtml: catOpts },
        { id: 'isOfficial', label: 'نوع سند هزینه', type: 'select', optionsHtml: '<option value=""' + (!Object.prototype.hasOwnProperty.call(rec, 'isOfficial') ? ' selected' : '') + '>تعیین نشده</option><option value="yes"' + (rec.isOfficial === true ? ' selected' : '') + '>رسمی / قابل قبول ممیز</option><option value="no"' + (rec.isOfficial === false ? ' selected' : '') + '>غیررسمی</option>' },
        { id: 'amt', label: 'مبلغ (ریال) *', type: 'number', value: rec.amt, dir: 'ltr', required: true },
        { id: 'month', label: 'دوره ماهانه شمسی *', type: 'month', value: rec.month, required: true },
        { id: 'desc', label: 'شرح', type: 'text', value: rec.desc || '' },
        { id: 'dealRef', label: 'پرونده فروش', type: 'select', optionsHtml: dealOpts },
        { id: 'files', label: 'افزودن پیوست جدید (اختیاری)', type: 'upload', uploadFolder: 'opex/' + rec.cd }
      ],
      okText: 'ذخیره ویرایش',
      onOk: function(v){
        var oldAmt = rec.amt;
        var eventProbe = { cd: rec.cd, amt: oldAmt };
        eventProbe[OPEX_ROW_ID] = rec[OPEX_ROW_ID];
        var oldOfficial = Object.prototype.hasOwnProperty.call(rec, 'isOfficial') ? rec.isOfficial : null;
        var newAmt = +v.amt || 0;
        var newMonth = (function(m){ m=String(m||'').trim(); var mt=m.match(/^(\d{4})[\/\-](\d{1,2})$/); if(!mt) return ''; return mt[1]+'/'+('0'+mt[2]).slice(-2); })(v.month);
        if(newAmt<=0){ alert('⛔ مبلغ نامعتبر'); return; }
        if(!newMonth){ alert('⛔ ماه مثل 1405/04'); return; }
        // چک قفل سال جدید هم
        try {
          var ny = newMonth.split('/')[0];
          var snaps2=getData('ptf_crm_fiscal_snapshots')||[];
          if(snaps2.some(function(s){ return String(s.year)===String(ny) && s.locked; })){
            alert('🔒 سال مالی جدید '+ny+' قفل است');
            return;
          }
        } catch(e){}
        var newOfficial = v.isOfficial === 'yes' ? true : v.isOfficial === 'no' ? false : null;
        var officialChanged = oldOfficial !== newOfficial;
        var applyToTemplate = false;
        if (officialChanged && rec.tplId) {
          applyToTemplate = confirm('رکوردهای دیگری از همین قالب وجود دارد.\n\nOK = اعمال نوع سند روی همه ماه‌های همین قالب\nCancel = فقط همین رکورد');
        }
        rec.cat = v.cat; rec.amt = newAmt; rec.month = newMonth; rec.desc = v.desc||'';
        if ((v.files || []).length) rec.files = (rec.files || []).concat(v.files);
        if (newOfficial === true) rec.isOfficial = true;
        else if (newOfficial === false) rec.isOfficial = false;
        else delete rec.isOfficial;
        var oldDeal = rec.dealRef; rec.dealRef = v.dealRef||'';
        rec.editedAt = faDateTime(); rec.editedBy = (typeof curSession==='function'?curSession().name:'');
        if (typeof window.ptfDealCostSync === 'function') {
          window.ptfDealCostSync({ rec: rec, source: 'opex', dealCd: rec.dealRef, prevDealCd: oldDeal, by: rec.editedBy, addTx: '✏️ ویرایش هزینه جاری لینک‌شده: ' + oldAmt.toLocaleString('fa-IR') + ' → ' + newAmt.toLocaleString('fa-IR') + ' ریال', removeTx: '🗑 حذف لینک هزینه جاری از پرونده' });
        }
        // ذخیره opex — انتخاب گروهی فقط با تایید صریح کاربر
        var all=oRows();
        var groupedCount = 0;
        for(var i=0;i<all.length;i++){
          if(all[i][OPEX_ROW_ID]===rowId){ all[i]=rec; continue; }
          if(applyToTemplate && rec.tplId && all[i].tplId === rec.tplId){
            if (newOfficial === true) all[i].isOfficial = true;
            else if (newOfficial === false) all[i].isOfficial = false;
            else delete all[i].isOfficial;
            groupedCount++;
          }
        }
        oSave(all);
        try { audit('هزینه جاری', 'ویرایش هزینه '+rec.cat+' '+oldAmt+' → '+newAmt+' ریال ('+newMonth+')' + (officialChanged ? ' — تغییر نوع سند به ' + (rec.isOfficial === true ? 'رسمی' : rec.isOfficial === false ? 'غیررسمی' : 'نامشخص') : '') + (groupedCount ? ' — اعمال روی ' + groupedCount + ' رکورد دیگر از همین قالب' : ''), rec.cd); } catch(e){}
        if(typeof ptfToast==='function') ptfToast('✅ هزینه ویرایش شد', 'ok');
        if(typeof renderDeals==='function'){ try{ renderDeals(); }catch(e){} }
        ptfOpexRender();
      }
    });
  };

  function materializeTemplateOnServer(t, month, options) {
    options = options || {};
    var key = recurringKeyForTpl(t, month);
    if (typeof window.ptfSalesDomainCommand !== 'function') return Promise.resolve({ state: 'rejected', error: new Error('recurring_server_command_unavailable') });
    function send(resolve) {
      try {
        var command = window.ptfSalesDomainCommand('reconcile_recurring_opex', {
          month: month, includeSalaries: false, explicitTemplate: true, scopeTemplate: String(t.id),
          restoreKeys: options.restore === false ? [] : [key],
          reason: options.reason || ('ثبت/بازسازی صریح قالب ' + String(t.id)),
          idempotencyKey: options.idempotencyKey || ('APPLY-REC-TPL|' + String(t.id) + '|' + String(month) + '|' + Date.now())
        }, { apiOptions: { autoReplay: true } });
        if (!command || typeof command.then !== 'function') { resolve({ state: 'rejected', error: new Error('recurring_server_promise_required') }); return; }
        command.then(resolve, function (error) { resolve({ state: 'rejected', error: error }); });
      } catch (error) { resolve({ state: 'rejected', error: error }); }
    }
    return new Promise(function (resolve) {
      /* Server must observe the committed template/settings snapshot; local settings
         are never copied into a materialized OPEX row by this browser. */
      if (typeof window.ptfSyncFlushKeysNow !== 'function') { resolve({ state: 'rejected', error: new Error('keyed_sync_barrier_unavailable') }); return; }
      try {
        window.ptfSyncFlushKeysNow(['ptf_crm_settings'], function (ok) {
          if (!ok) { resolve({ state: 'rejected', error: new Error('template_snapshot_not_committed') }); return; }
          send(resolve);
        });
      } catch (error) { resolve({ state: 'rejected', error: error }); }
    });
  }

  window.ptfOpexEditTemplate = function (tid, materializeMonth) {
    if (!canFin()) return;
    var list = tpls(), tpl = list.filter(function (x) { return x && x.id === tid; })[0];
    if (!tpl) { alert('قالب تکرارشونده در تنظیمات پیدا نشد.'); return; }
    var catOpts = PTF_OPEX_CATS.map(function (c) { return '<option' + (tpl.cat === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    ptfDialog({
      title: '✏️ ویرایش منبع هزینهٔ تکرارشونده',
      body: 'این تغییر ابتدا در تنظیمات سرور ثبت می‌شود و سپس projection ماه انتخابی بدون ساخت محلی تطبیق می‌یابد. ردیف ابطال‌شده خودکار بازیابی نمی‌شود.',
      fields: [
        { id: 'cat', label: 'دسته هزینه', type: 'select', optionsHtml: catOpts },
        { id: 'isOfficial', label: 'نوع سند هزینه', type: 'select', optionsHtml: '<option value="yes"' + (tpl.isOfficial === true ? ' selected' : '') + '>رسمی</option><option value="no"' + (tpl.isOfficial !== true ? ' selected' : '') + '>غیررسمی</option>' },
        { id: 'amt', label: 'مبلغ ماهانه (ریال) *', type: 'number', value: tpl.amt, dir: 'ltr', required: true },
        { id: 'desc', label: 'شرح', type: 'text', value: tpl.desc || '' }
      ],
      okText: 'ذخیره و تطبیق سروری',
      onOk: function (v) {
        var amount = +v.amt || 0;
        if (amount <= 0) { alert('⛔ مبلغ نامعتبر'); return; }
        var before = { cat: tpl.cat, amt: tpl.amt, desc: tpl.desc, isOfficial: tpl.isOfficial };
        tpl.cat = v.cat; tpl.amt = amount; tpl.desc = v.desc || ''; tpl.isOfficial = v.isOfficial === 'yes'; tpl.updatedAt = typeof faDateTime === 'function' ? faDateTime() : ''; tpl.updatedBy = (curSession() || {}).name || '';
        saveTpls(list);
        var month = normMonth(materializeMonth) || ptfFaMonthNow();
        materializeTemplateOnServer(tpl, month, { restore: false, reason: 'ویرایش صریح منبع قالب ' + tid }).then(function (state) {
          if (!state || state.state !== 'acked') {
            alert('قالب محلی در صف همگام‌سازی ماند، اما تطبیق سروری انجام نشد: ' + String((state && state.error && state.error.message) || 'نتیجه نامشخص'));
            return;
          }
          try { audit('هزینه جاری', 'ویرایش قالب تکرارشونده ' + tid + ' — ' + String(before.amt || 0) + ' → ' + String(amount) + ' ریال', tid); } catch (eAudit) {}
          if (typeof ptfToast === 'function') ptfToast('✅ قالب و projection ماه ' + month + ' روی سرور تطبیق شد', 'ok');
          ptfOpexRender();
        });
      }
    });
  };

  /* ثبت یک‌کلیکی قالب برای ماه جاری (با confirm — قاعده ایمنی) */
  window.ptfOpexApplyTpl = function (tid) {
    var t = tpls().filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    var m = ptfFaMonthNow();
    if (!confirm('🔁 ثبت سروری هزینه تکرارشونده «' + t.cat + '» ماه ' + m + '؟\n\nمبلغ: ' + fmtT(t.amt) + ' ریال' + (t.desc ? '\nشرح: ' + t.desc : ''))) return;
    materializeTemplateOnServer(t, m, { restore: true }).then(function (state) {
      if (state && state.state === 'acked') {
        if (typeof ptfToast === 'function') ptfToast('✅ قالب از snapshot سرور ثبت و تطبیق شد', 'ok');
        try { ptfOpexRender(); } catch (eRender) {}
      } else if (state && state.state === 'rejected') alert('ثبت سروری انجام نشد: ' + String((state.error && state.error.message) || 'خطای نامشخص'));
    });
  };
  window.ptfOpexDelTpl = function (tid) {
    var t = tpls().filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    if (!confirm('حذف قالب تکرارشونده «' + t.cat + ' — ' + fmtT(t.amt) + ' ریال»؟ (هزینه‌های ثبت‌شده قبلی دست نمی‌خورند)')) return;
    saveTpls(tpls().filter(function (x) { return x.id !== tid; }));
    try { audit('هزینه جاری', 'حذف قالب تکرارشونده ' + t.cat, tid); } catch (eA) {}
    ptfOpexRender();
  };

  /* v34.8.5: verifier نتیجهٔ reconcile سروری؛ عمداً read-only است. */
  window.ptfAutoApplyRecurring = function () {
    var m = ptfFaMonthNow();
    if (!m) return { ok: false, complete: false, why: 'no_month' };
    var out = { ok: true, complete: true, month: m, salaries: 0, tpls: 0, repaired: 0, skipped: 0,
      expected: { salaries: [], tpls: [] }, present: { salaries: [], tpls: [] }, missing: [], blocked: [], errors: [] };
    var rows = oAll();
    /* فقط نتیجهٔ materialization سرور بررسی می‌شود؛ این تابع هیچ OPEX/حقوقی نمی‌سازد،
       repair نمی‌کند و tombstone را زنده نمی‌کند. */
    tpls().forEach(function (tpl) {
      if (!tpl || !tpl.id) { out.errors.push('tpl:missing_id'); return; }
      var key = recurringKeyForTpl(tpl, m);
      out.expected.tpls.push(key);
      if (rows.some(function (row) { return recurringRowActive(row) && row.recurringKey === key && row.serverMaterialized; })) out.present.tpls.push(key);
      else out.missing.push({ kind: 'tpl', key: key });
    });
    rows.forEach(function (row) {
      if (!recurringRowActive(row) || String(row.month || '') !== m || !row.serverMaterialized) return;
      if (String(row.recurringKey || '').indexOf('salary:') === 0) out.present.salaries.push(row.recurringKey);
    });
    out.salaries = out.present.salaries.length;
    out.tpls = out.present.tpls.length;
    out.complete = out.errors.length === 0 && out.missing.length === 0;
    out.ok = out.complete;
    return out;
  };

  /* اتوماسیون startup: حقوق و قالب‌ها فقط در یک command سروری materialize می‌شوند.
     کلاینت پس از ACK صرفاً envelope هویتی merge-v1 را اعمال و نتیجه را بررسی می‌کند. */
  var recurringRetryTimer = null, recurringServerInFlight = false, recurringServerDoneKey = '', recurringServerBlockedKey = '';
  function salaryServerRole() {
    try { return ['admin', 'chairman', 'ceo', 'commercial', 'accountant'].indexOf(String(curRole() || '').toLowerCase()) > -1; } catch (e) { return false; }
  }
  function tehranDayKey() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/\//g, '-'); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function recurringUserKey() {
    try { var s = curSession() || {}; return String(s.user || s.username || s.name || 'unknown').replace(/[^A-Za-z0-9_.@-]/g, '_').slice(0, 60); } catch (e) { return 'unknown'; }
  }
  function refreshRecurringFinancialViews() {
    /* Reconcile حقوق یک commit مشترک OPEX/sharetx است. فقط نمای active را refresh
       می‌کنیم؛ رندر hidden tab در پس‌زمینه هم فرم/فیلتر کاربر را reset می‌کرد و هم
       بعد از outerHTML ریشهٔ fiscal، visibility را از بین می‌برد. */
    try {
      if (document.querySelector('.md-b') || document.querySelector('.ptfdlg-b')) return;
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    } catch (eEditing) {}
    var activeTab = String(window._finHubTab || 'petty');
    if (activeTab === 'opex') { try { if (typeof ptfOpexRender === 'function') ptfOpexRender(); } catch (eOpex) {} }
    else if (activeTab === 'share') { try { if (typeof ptfShareRender === 'function') ptfShareRender(); } catch (eShare) {} }
    else if (activeTab === 'fiscal') { try { if (typeof ptfFiscalRender === 'function') ptfFiscalRender(); } catch (eFiscal) {} }
  }
  function finishLocalRecurring(serverState) {
    var local = null, allowedLocal = false, freshChanges = 0;
    try { allowedLocal = !!canFin(); } catch (eFin) {}
    if (allowedLocal) {
      try { local = window.ptfAutoApplyRecurring(); } catch (eRun) { local = { complete: false, errors: [String(eRun)] }; }
    } else local = { complete: true, month: ptfFaMonthNow(), salaries: 0, tpls: 0, repaired: 0 };
    refreshRecurringFinancialViews();
    if (local && serverState && serverState.response && serverState.response.result && serverState.response.idempotent !== true) {
      /* Presence counters are verification data, not evidence of a new mutation. Only a
         non-replayed command with an actual server change may emit the success toast. */
      freshChanges = +(serverState.response.result.created || 0) + +(serverState.response.result.updated || 0) + +(serverState.response.result.voided || 0);
    }
    if (local && local.complete && freshChanges > 0) {
      if (typeof ptfToast === 'function') ptfToast('🔁 هزینه‌های تکرارشوندهٔ ماه ' + local.month + ' تطبیق شد (تغییرات سروری: ' + freshChanges + ' — حقوق فعال: ' + local.salaries + ' — قالب‌های فعال: ' + local.tpls + ')', 'ok');
    }
    return local;
  }
  function scheduleRecurringRetry(attempt) {
    attempt = +attempt || 0;
    if (attempt >= 4 || typeof setTimeout !== 'function') return;
    if (recurringRetryTimer) clearTimeout(recurringRetryTimer);
    recurringRetryTimer = setTimeout(function () { recurringRetryTimer = null; runRecurringAfterSync(attempt + 1); }, 1500 * (attempt + 1));
  }
  function runRecurringAfterSync(attempt) {
    if (!window._ptfSyncSnapshotReady || recurringServerInFlight || !salaryServerRole()) return;
    var month = ptfFaMonthNow();
    if (!month) { scheduleRecurringRetry(attempt); return; }
    var runKey = month + '|' + recurringUserKey() + '|' + tehranDayKey();
    if (recurringServerDoneKey === runKey || recurringServerBlockedKey === runKey) return;
    if (typeof window.ptfSalesDomainCommand !== 'function') { scheduleRecurringRetry(attempt); return; }
    recurringServerInFlight = true;
    var commandPromise;
    try {
      /* این فرمان پس از دو تلاش و command_status نتیجهٔ نامشخص را خودش ثبت می‌کند.
         در پس‌زمینه نباید alert تکراری یا retry زنجیره‌ای ایجاد شود؛ status همان
         operationId باید از مسیر تشخیصی/دستی بررسی شود. */
      commandPromise = window.ptfSalesDomainCommand('reconcile_recurring_opex', {
        month: month, idempotencyKey: 'OPEX-REC|' + runKey
      }, { apiOptions: { autoReplay: true }, silentUncertain: true });
      if (!commandPromise || typeof commandPromise.then !== 'function') throw new Error('salary_command_promise_required');
    } catch (eCommand) {
      /* خطای هم‌زمان هنگام ساخت Promise با «نتیجهٔ نامشخصِ فرمان» فرق دارد؛
         در این حالت فرمان هنوز ارسال نشده و همان retry محدود قبلی مجاز است. */
      recurringServerInFlight = false;
      scheduleRecurringRetry(attempt);
      return;
    }
    commandPromise.then(function (state) {
      recurringServerInFlight = false;
      if (state && state.state === 'acked') {
        recurringServerDoneKey = runKey;
        if (recurringRetryTimer) { clearTimeout(recurringRetryTimer); recurringRetryTimer = null; }
        finishLocalRecurring(state);
      } else if (!state || state.state === 'uncertain') {
        /* نتیجهٔ نامشخص را فقط یک بار برای همین روز نگه می‌داریم. تکرار خودکار
           فقط alert/ERR_CONNECTION_CLOSED را زیاد می‌کرد و به کاربر امکان UAT نمی‌داد. */
        recurringServerBlockedKey = runKey;
        if (recurringRetryTimer) { clearTimeout(recurringRetryTimer); recurringRetryTimer = null; }
      }
      /* rejected قطعی (قفل سال/مجوز/ماه) با retry خودکار تکرار نمی‌شود. */
    }, function () {
      recurringServerInFlight = false;
      recurringServerBlockedKey = runKey;
      if (recurringRetryTimer) { clearTimeout(recurringRetryTimer); recurringRetryTimer = null; }
    });
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('ptf:sync-ready', function (ev) {
      if (!ev || !ev.detail || ev.detail.ok !== false) runRecurringAfterSync(0);
    });
  }
  if (window._ptfSyncSnapshotReady && typeof setTimeout === 'function') setTimeout(function () { runRecurringAfterSync(0); }, 0);

  window.ptfOpexTemplates = function () { return tpls(); };
  window.ptfOpexUnlinkedForCheque = function () {
    return oRows().filter(function (x) {
      return opexRowActive(x) && !x.chequeCd;
    }).sort(function (a, b) { return String(b.month || '').localeCompare(String(a.month || '')); }).slice(0, 24);
  };
  /* از ماه جاری تا ۱۲ ماه بعد (مثلاً خرداد امسال تا اردیبهشت سال بعد). ماه‌هایی که ردیف دارند نمی‌آیند. */
  window.ptfOpexFutureMonthsForTpl = function (tplId, throughYear) {
    var t = tpls().filter(function (x) { return x && x.id === tplId; })[0];
    if (!t) return [];
    var now = normMonth(ptfFaMonthNow()) || '';
    if (!now) return [];
    var y = +now.split('/')[0];
    var m0 = +now.split('/')[1] || 1;
    var have = {};
    oRows().forEach(function (x) {
      if (!opexRowActive(x)) return;
      if (tplId && x.tplId === tplId && x.month) have[x.month] = true;
    });
    var out = [];
    var nMonths = 12;
    if (throughYear && String(throughYear) === String(y)) nMonths = 13 - m0;
    for (var k = 0; k < nMonths; k++) {
      var mm = m0 + k;
      var yy = y + Math.floor((mm - 1) / 12);
      var mo = ((mm - 1) % 12) + 1;
      var month = yy + '/' + ('0' + mo).slice(-2);
      if (have[month]) continue;
      out.push({ tplId: t.id, month: month, amt: +t.amt || 0, cat: t.cat || '', desc: t.desc || '', name: (OPEX_MONTH_NAMES[mo - 1] || '') + ' ' + yy });
    }
    return out;
  };
  window.ptfOpexCreateMonthsForCheque = function (chequeCd, items) {
    items = (Array.isArray(items) ? items : []).filter(function (it) { return it && it.tplId && normMonth(it.month); }).map(function (it) { return { tplId: String(it.tplId), month: normMonth(it.month) }; });
    if (!chequeCd || !items.length) return Promise.resolve({ ok: false, ids: [], state: 'rejected', error: new Error('schedule_items_required') });
    if (typeof window.ptfSalesDomainCommand !== 'function') return Promise.resolve({ ok: false, ids: [], state: 'rejected', error: new Error('recurring_server_command_unavailable') });
    function scheduleIntentHash(rows) {
      var text = rows.slice().sort(function (a, b) { return (a.tplId + '|' + a.month).localeCompare(b.tplId + '|' + b.month); }).map(function (x) { return x.tplId + '@' + x.month; }).join(';');
      var hash = 2166136261;
      for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return (hash >>> 0).toString(16);
    }
    function send(resolve) {
      try {
        var command = window.ptfSalesDomainCommand('schedule_recurring_opex_cheque', {
          chequeCd: chequeCd, items: items, reason: 'برنامه‌ریزی صریح هزینه‌های تکرارشونده برای چک ' + chequeCd,
          idempotencyKey: 'SCHED-REC-OPEX-CHEQUE|' + String(chequeCd) + '|' + scheduleIntentHash(items)
        }, { apiOptions: { autoReplay: true } });
        if (!command || typeof command.then !== 'function') { resolve({ ok: false, ids: [], state: 'rejected', error: new Error('recurring_server_promise_required') }); return; }
        command.then(function (state) {
          var ids = state && state.response && state.response.result && Array.isArray(state.response.result.rowIds) ? state.response.result.rowIds.slice() : [];
          resolve({ ok: !!(state && state.state === 'acked'), ids: ids, state: state && state.state, commandState: state, error: state && state.error });
        }, function (error) { resolve({ ok: false, ids: [], state: 'rejected', error: error }); });
      } catch (error) { resolve({ ok: false, ids: [], state: 'rejected', error: error }); }
    }
    return new Promise(function (resolve) {
      /* The cheque and any template changes must be committed before the atomic command. */
      if (typeof window.ptfSyncFlushKeysNow !== 'function') { resolve({ ok: false, ids: [], state: 'rejected', error: new Error('keyed_sync_barrier_unavailable') }); return; }
      try {
        window.ptfSyncFlushKeysNow(['ptf_crm_cheques_issued', 'ptf_crm_settings'], function (ok) {
          if (!ok) { resolve({ ok: false, ids: [], state: 'rejected', error: new Error('cheque_snapshot_not_committed') }); return; }
          send(resolve);
        });
      } catch (error) { resolve({ ok: false, ids: [], state: 'rejected', error: error }); }
    });
  };
  window.ptfOpexLinkCheque = function (chequeCd, rowIds) {
    rowIds = Array.isArray(rowIds) ? rowIds : [];
    if (!chequeCd || !rowIds.length) return { ok: false, n: 0 };
    var all = oRows(), n = 0;
    all.forEach(function (x) {
      if (!x || rowIds.indexOf(x[OPEX_ROW_ID]) < 0) return;
      x.chequeCd = chequeCd;
      x.payHow = 'cheque';
      n++;
    });
    if (n) oSave(all);
    return { ok: true, n: n };
  };
  window.ptfOpexUnlinkCheque = function (chequeCd) {
    if (!chequeCd) return 0;
    var all = oRows(), n = 0;
    all.forEach(function (x) {
      if (!x || x.chequeCd !== chequeCd) return;
      delete x.chequeCd;
      if (x.payHow === 'cheque') delete x.payHow;
      n++;
    });
    if (n) oSave(all);
    return n;
  };

  /* ---------- رندر باکس داخل پنل تنخواه ---------- */
  window.ptfOpexRender = function () {
    var el = document.getElementById('opexBox');
    if (!el) return;
    /* MOB-041: actionهای هزینه جاری contract صریح دارند تا icon fallback/چرخ‌دنده
       و دکمه‌های ناهم‌اندازه در موبایل تولید نشود. */
    function opexAction(kind, icon, label, title, onClick, primary) {
      return '<button type="button" class="bt' + (primary ? '' : ' bt-o') + ' opex-fin-action opex-fin-' + kind + '" data-opex-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
        '<span class="opex-fin-icon" aria-hidden="true">' + icon + '</span><span class="opex-fin-label">' + label + '</span></button>';
    }
    var m = typeof window._opexMonth === 'string' ? window._opexMonth : ptfFaMonthNow();
    var year = m ? m.split('/')[0] : '';
    var sm = ptfOpexSum(m);
    var sy = ptfOpexSum(year);
    var pend = ptfOpexPendingTpls(ptfFaMonthNow());
    var pendHtml = pend.length
      ? '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px">' +
        '🔁 <b>هزینه‌های تکرارشونده ماه جاری که هنوز ثبت نشده‌اند:</b> ' +
        pend.map(function (t) { return '<button class="bt bt-o" style="padding:3px 10px;font-size:11.5px;margin:2px" onclick="ptfOpexApplyTpl(\'' + ptfOnClickArg(t.id) + '\')">' + escP(t.cat) + ' — ' + fmtT(t.amt) + ' ریال ➕</button>'; }).join(' ') + '</div>'
      : '';
    var chips = Object.keys(sm.byCat).map(function (c) {
      return '<span style="background:#f1f5f9;border-radius:999px;padding:4px 11px;font-size:11.5px">' + escP(c) + ': <b>' + fmtT(sm.byCat[c]) + '</b> ریال</span>';
    }).join(' ');
    var rows = oRows().filter(function (x) { return recurringRowActive(x) && (!m || x.month === m); }).map(function (x) {
      var cdArg = ptfOnClickArg(x.cd);
      var rowArg = ptfOnClickArg(x[OPEX_ROW_ID]);
      var fileCount = (x.files || []).length;
      return '<div class="opex-row" data-opex-row-id="' + escP(x[OPEX_ROW_ID]) + '">' +
        '<span class="opex-row-copy"><b>' + fmtT(x.amt) + ' ریال</b> — ' + escP(x.cat) + (x.tplId ? ' <span class="bd" style="background:#ede9fe;color:#6d28d9;font-size:10px">🔁</span>' : '') +
        (x.dealRef ? ' <span class="bd" style="background:#ecfdf5;color:#166534;font-size:10px">📁 پرونده فروش</span>' : '') +
        (x.autoApplied ? ' <span class="bd" style="background:#e0f2fe;color:#0369a1;font-size:10px">🤖 خودکار</span>' : '') +
        (isCoverOpex(x) ? ' <span class="bd" style="background:#fff7ed;color:#c2410c;font-size:10px">از فاکتور پوششی</span>' : '') +
        (opexSettled(x) ? ' <span class="bd" style="background:#ecfdf5;color:#166534;font-size:10px">تسویه شد</span>' : (opexSettlementRequired(x) ? ' <span class="bd" style="background:#fef3c7;color:#b45309;font-size:10px">در انتظار تسویه</span>' : '')) +
        (x.chequeCd ? ' <span class="bd" style="background:#fff7ed;color:#c2410c;font-size:10px">چک ' + escP(x.chequeCd) + '</span>' : '') +
        (x.desc ? ' <small style="color:#64748b">' + escP(x.desc) + '</small>' : '') +
        (x.editedAt ? ' <small style="color:#0e7490">✏️ ویرایش: ' + escP(x.editedAt) + '</small>' : '') +
        (opexSettled(x) && (x.settleDoc || x.chequeCd) ? '<br><small style="color:#059669">✔ تسویه: ' + escP(x.settledT || x.month || '') + ' — سند: ' + escP(x.settleDoc || x.chequeCd) + ' (' + escP(x.settledBy || '') + ')</small>' : '') +
        '<br><small style="color:#94a3b8">' + escP(x.month) + ' | ثبت: ' + escP(x.t) + ' — ' + escP(x.by) + (x.dealRef ? ' | لینک: ' + escP(x.dealRef) : '') + '</small></span>' +
        '<span class="opex-row-actions" role="group" aria-label="عملیات هزینه ' + escP(x.cat || '') + '">' +
        opexAction('attach', '📎', fileCount ? fileCount + ' سند' : 'سند', 'مدیریت قبض، رسید پرداخت، چک یا فاکتورهای این ردیف', 'ptfOpexAttachOpen(\'' + cdArg + '\',\'' + rowArg + '\')', false) +
        (opexSettlementRequired(x) && !opexSettled(x) ? opexAction('settle', '✔', 'تسویه', isCoverOpex(x) ? 'تسویه کارمزد فاکتورساز و ثبت مدرک پرداخت' : 'تسویه هزینه تکرارشونده، ثبت مدرک پرداخت و خروج از خزانه', 'ptfOpexSettle(\'' + cdArg + '\',\'' + rowArg + '\')', true) : '') +
        (isCoverOpex(x) ? '' : opexAction('edit', '✏️', 'اصلاح', 'اصلاح همین ردیف هزینهٔ جاری', 'ptfOpexEdit(\'' + cdArg + '\',\'' + rowArg + '\')', false)) +
        (isCoverOpex(x) ? '' : opexAction('delete', '🗑', 'حذف', 'حذف همین ردیف هزینهٔ جاری', 'ptfOpexDel(\'' + cdArg + '\',\'' + rowArg + '\')', false)) +
        '</span></div>';
    }).join('');
    var tplRows = tpls().map(function (t) {
      return '<span style="background:#ede9fe;border-radius:999px;padding:4px 11px;font-size:11.5px">🔁 ' + escP(t.cat) + ' — ' + fmtT(t.amt) + ' ریال <a href="javascript:void(0)" onclick="ptfOpexEditTemplate(\'' + ptfOnClickArg(t.id) + '\',window._opexMonth||ptfFaMonthNow())" title="ویرایش منبع قالب" style="color:#0e7490;text-decoration:none">✏️</a> <a href="javascript:void(0)" onclick="ptfOpexDelTpl(\'' + ptfOnClickArg(t.id) + '\')" style="color:#dc2626;text-decoration:none">✕</a></span>';
    }).join(' ');
    el.innerHTML =
      '<div class="opex-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
      '<h4 style="margin:0;font-size:13.5px">🏢 هزینه‌های جاری شرکت (US-418)</h4>' +
      '<span class="opex-tools">' +
      '<span class="opex-month" style="display:inline-block;min-width:190px">' + (window.DateKit && DateKit.monthPicker ? DateKit.monthPicker('opexMonthFilter', m, { allowEmpty: true }) : '<select id="opexMonthFilter" title="ماه شمسی — همه یا یک ماه"><option value="">همه ماه‌ها</option>' + opexMonthOptions(m, false) + '</select>') + '</span>' +
      '<span class="opex-head-actions" role="group" aria-label="عملیات هزینه جاری">' +
      opexAction('add', '➕', 'ثبت هزینه', 'ثبت هزینهٔ جاری جدید', 'ptfOpexAdd()', true) +
      (canFin() ? opexAction('rebuild', '🛠', 'بازسازی حقوق', 'برای تراکنش‌های قدیمیِ حقوق سهامدار که رکورد هزینه ندارند، ردیف حقوق و دستمزد می‌سازد', 'ptfOpexMigrateShareholders()', false) : '') +
      '</span></span></div>' +
      pendHtml +
      '<div style="font-size:12.5px;margin-bottom:6px">جمع ماه <b dir="ltr">' + escP(m || '—') + '</b>: <b style="color:#b45309">' + fmtT(sm.total) + ' ریال</b> | جمع سال ' + escP(year) + ': <b>' + fmtT(sy.total) + ' ریال</b></div>' +
      (chips ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">' + chips + '</div>' : '') +
      (rows || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">هزینه‌ای برای این ماه ثبت نشده</div>') +
      (tplRows ? '<div style="margin-top:8px;font-size:11.5px;color:#64748b">قالب‌های تکرارشونده: ' + tplRows + '</div>' : '');
    var monthFilter = document.getElementById('opexMonthFilter');
    if (monthFilter) monthFilter.addEventListener('change', function () { window._opexMonth = this.value; ptfOpexRender(); });
  };

  /* ---------- hook پنل تنخواه (تنخواه = زیرمجموعه هزینه‌ها — R9) ---------- */
  function hookPetty() {
    if (window._opexHooked || typeof window.buildPetty !== 'function') return false;
    window._opexHooked = true;
    var _bp = window.buildPetty;
    window.buildPetty = function () {
      var box = canFin()
        ? '<div id="opexBox" style="background:var(--crd,#fff);border:1px solid #fcd34d;border-radius:14px;padding:12px 14px;margin-bottom:14px"></div>'
        : '';
      return box + _bp();
    };
    var _rp = window.renderPetty;
    if (typeof _rp === 'function') {
      window.renderPetty = function () {
        _rp();
        try { if (canFin()) ptfOpexRender(); } catch (e) {}
      };
    }
    return true;
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var done = hookPetty();
    if (done || tries > 50) {
      /* فقط UI را hook کن؛ reconcile مالی منتظر snapshot موفق Sync است. */
      clearInterval(t);
    }
  }, 350);
  /* اگر تب در عبور از مرز ماه باز بماند، پس از readiness ماه تازه نیز reconcile می‌شود. */
  setInterval(function () { if (window._ptfSyncSnapshotReady) runRecurringAfterSync(0); }, 30 * 60 * 1000);
})();
