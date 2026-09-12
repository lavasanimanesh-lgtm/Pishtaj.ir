/* =====================================================================
   PTF CRM — v17.9
   US-419: سهامداران، حقوق موظف و علی‌الحساب
   - محرمانه: مدیران ارشد (admin/chairman/ceo/commercial — AUD-11، تصمیم کارفرما ۱۴۰۵/۰۵/۰۷)
   - حقوق موظف ماهانه → مطالبه سهامدار + هزینه حقوق US-418 با فلگ جلوگیری از دوباره‌شماری
   - برداشت/علی‌الحساب → کاهش مطالبه / ایجاد بدهی سهامدار
   - کارت مانده لحظه‌ای: بستانکار/بدهکار + مطالبات تنخواه مرتبط با نام شخص
   ===================================================================== */
(function () {
  'use strict';
  var SH_KEY = 'ptf_crm_shareholders', TX_KEY = 'ptf_crm_sharetx';

  function canShare() { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; }
  /* AUD-11 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md، تصمیم صریح کارفرما):
     قبلاً فقط admin/chairman بود؛ هاب مالی تب «سهامداران» را برای
     ceo/commercial هم قابل‌کلیک نشان می‌داد بدون محتوا. کارفرما تصریح
     کرد این دو نقش باید دسترسی کامل داشته باشند، هم‌راستا با
     ROLES.finance در rbac.js. */
  function shAll() { var a = getData(SH_KEY); return Array.isArray(a) ? a : []; }
  function shSave(a) { setData(SH_KEY, a || []); }
  function txAll() { var a = getData(TX_KEY); return Array.isArray(a) ? a : []; }
  function shareTxActive(row) {
    if (!row) return false;
    var terminal = { void: 1, voided: 1, cancelled: 1, deleted: 1, replaced: 1, superseded: 1 };
    return !terminal[String(row.status || '').toLowerCase()] && !terminal[String(row.st || '').toLowerCase()] && !row.voided && !row.deleted;
  }
  function txSave(a) { setData(TX_KEY, a || []); }
  function nm() { return (curSession() || {}).name || (curSession() || {}).user || ''; }
  function n(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function salaryRecurringKey(sh, month) { return 'salary:' + String((sh && sh.cd) || '') + ':' + String(month || ''); }
  function faMonthNow() { try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\s/g, '').replace('-', '/'); } catch (e) { return (typeof faDate === 'function' ? faDate().slice(0, 7) : ''); } }
  function normMonth(m) { return String(m || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/-/g, '/').replace(/\s/g, '').replace(/^(\d{4})\/(\d)$/, '$1/0$2'); }
  function shareYearLocked(month) {
    var y = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(month) : String(month || '').split('/')[0];
    if (!y) return false;
    if (typeof ptfFiscalYearLocked === 'function') return ptfFiscalYearLocked(y);
    return (getData('ptf_crm_fiscal_snapshots') || []).some(function (s) { return s && s.locked && String(s.year) === y; });
  }
  function activeShares() { return shAll().filter(function (s) { return s.active !== false; }); }
  function pctSum(exceptCd) { return activeShares().reduce(function (sum, s) { return sum + (s.cd === exceptCd ? 0 : (+s.pct || 0)); }, 0); }
  /* v34.8.5: salary claim + matching OPEX are one server-owned recurring entity.
     The browser may edit shareholder eligibility, but never creates, repairs, removes,
     or resurrects salary/sharetx/OPEX rows from its potentially incomplete snapshot. */
  function reconcileSalaryOnServer(month, options) {
    options = options || {};
    month = normMonth(month) || faMonthNow();
    var restoreKeys = [];
    if (options.restore === true) activeShares().filter(function (sh) { return sh.duty && (+sh.salary || 0) > 0; }).forEach(function (sh) {
      restoreKeys.push(salaryRecurringKey(sh, month));
    });
    return shareDomainCommand('reconcile_shareholder_salaries', {
      month: month,
      explicitEligibility: options.explicitEligibility === true,
      scopeShareholder: options.scopeShareholder || '',
      restoreKeys: restoreKeys,
      reason: options.reason || 'تطبیق صریح حقوق سهامداران از رابط کاربری',
      idempotencyKey: 'SH-SALARY|' + month + '|' + String(options.scopeShareholder || 'all') + '|' + Date.now()
    }, ['ptf_crm_sharetx', 'ptf_crm_opex']).then(function (state) {
      if (state && state.state === 'acked') {
        try { if (typeof ptfShareRender === 'function') ptfShareRender(); } catch (eShare) {}
        try { if (typeof ptfOpexRender === 'function') ptfOpexRender(); } catch (eOpex) {}
        try { if (typeof ptfFiscalRender === 'function') ptfFiscalRender(); } catch (eFiscal) {}
      }
      return state;
    });
  }
  /* v34.8.6/F2 — all new shareholder financial writes go through the domain command.
     The local array is never used as a write fallback; the command owns idempotency,
     locking and the authoritative projection. */
  function shareDomainCommand(action, payload, holdKeys) {
    holdKeys = Array.isArray(holdKeys) ? holdKeys.slice() : [];
    return new Promise(function (resolve) {
      function rejectState(message) { resolve({ state: 'rejected', error: new Error(message) }); }
      if (typeof window.ptfSalesDomainCommand !== 'function') { rejectState('shareholder_server_command_unavailable'); return; }
      if (typeof window.ptfSyncFlushKeysNow !== 'function') { rejectState('shareholder_sync_barrier_unavailable'); return; }
      window.ptfSyncFlushKeysNow(['ptf_crm_shareholders'], function (ok) {
        if (!ok) { rejectState('shareholder_snapshot_not_committed'); return; }
        try { if (typeof window.ptfSyncHoldCommandKeys === 'function') window.ptfSyncHoldCommandKeys(holdKeys); } catch (eHold) {}
        var command;
        try { command = window.ptfSalesDomainCommand(action, payload, { apiOptions: { autoReplay: true } }); }
        catch (error) {
          try { if (typeof window.ptfSyncReleaseCommandKeys === 'function') window.ptfSyncReleaseCommandKeys(holdKeys); } catch (eRelease) {}
          rejectState(error && error.message || 'shareholder_command_exception');
          return;
        }
        if (!command || typeof command.then !== 'function') {
          try { if (typeof window.ptfSyncReleaseCommandKeys === 'function') window.ptfSyncReleaseCommandKeys(holdKeys); } catch (eRelease2) {}
          rejectState('shareholder_command_promise_required');
          return;
        }
        command.then(function (state) {
          try { if (typeof window.ptfSyncReleaseCommandKeys === 'function') window.ptfSyncReleaseCommandKeys(holdKeys); } catch (eRelease3) {}
          resolve(state || { state: 'rejected', error: new Error('empty_shareholder_command_result') });
        }, function (error) {
          try { if (typeof window.ptfSyncReleaseCommandKeys === 'function') window.ptfSyncReleaseCommandKeys(holdKeys); } catch (eRelease4) {}
          resolve({ state: 'rejected', error: error });
        });
      });
    });
  }
  function shareCommandErrorText(state) {
    return String((state && state.error && (state.error.message || state.error.error)) || 'نتیجه نامشخص');
  }
  function shareCommandRender() {
    try { if (typeof ptfShareRender === 'function') ptfShareRender(); } catch (eShareRender) {}
    try { if (typeof ptfOpexRender === 'function') ptfOpexRender(); } catch (eOpexRender) {}
  }
  function shareDrawOnServer(sh, amount, desc, files, month, salaryMonth, operationId) {
    var payload = {
      shareholderCd: sh.cd,
      amountIRR: Math.round(+amount || 0),
      desc: String(desc || '').trim(),
      month: month,
      files: Array.isArray(files) ? files.slice() : [],
      idempotencyKey: 'SH-DRAW|' + String(operationId || genCode('OP')).replace(/[^A-Za-z0-9_.|:-]/g, '_')
    };
    if (salaryMonth) payload.salaryMonth = salaryMonth;
    return shareDomainCommand('register_shareholder_draw', payload, ['ptf_crm_sharetx']).then(function (state) {
      if (state && state.state === 'acked') {
        var result = state.response && state.response.result || {};
        try { audit('سهامداران', (salaryMonth ? 'پرداخت حقوق با draw ' : 'ثبت برداشت/علی‌الحساب ') + money(amount) + ' برای ' + sh.name, result.transactionCd || ''); } catch (eAudit) {}
        if (typeof ptfToast === 'function') ptfToast(salaryMonth ? 'پرداخت واقعی حقوق با draw روی سرور تأیید شد' : 'برداشت روی سرور تأیید شد', 'ok');
        shareCommandRender();
      } else if (state && state.state === 'uncertain') {
        if (typeof ptfToast === 'function') ptfToast('⚠️ نتیجه ثبت برداشت نامشخص است؛ دوباره از مسیر دیگری ثبت نکنید.', 'warn');
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') {
        ptfToast('⛔ ثبت برداشت انجام نشد: ' + shareCommandErrorText(state), 'warn');
      }
      return state;
    });
  }
  function registerSalaryOnServer(sh, month, operationId) {
    var payload = {
      shareholderCd: sh.cd,
      month: month,
      idempotencyKey: 'SH-SALARY-REG|' + String(sh.cd) + '|' + String(month) + '|' + String(operationId || Date.now()).replace(/[^A-Za-z0-9_.|:-]/g, '_')
    };
    return shareDomainCommand('register_shareholder_salary', payload, ['ptf_crm_sharetx', 'ptf_crm_opex']).then(function (state) {
      if (state && state.state === 'acked') {
        var result = state.response && state.response.result || {};
        if (typeof ptfToast === 'function') {
          ptfToast(result.alreadyRegistered
            ? 'حقوق ' + sh.name + ' برای ماه ' + month + ' قبلاً ثبت شده است'
            : 'حقوق ' + sh.name + ' برای ماه ' + month + ' ثبت شد؛ فقط هزینه و مطالبه ایجاد شد', result.alreadyRegistered ? 'info' : 'ok');
        }
        shareCommandRender();
      } else if (state && state.state === 'uncertain') {
        if (typeof ptfToast === 'function') ptfToast('⚠️ نتیجه ثبت حقوق نامشخص است؛ ثبت را دوباره با کلید جدید تکرار نکنید.', 'warn');
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') {
        ptfToast('⛔ ثبت حقوق انجام نشد: ' + shareCommandErrorText(state), 'warn');
      }
      return state;
    });
  }

  window.ptfShareEnsureSalary = function (sh, month) {
    if (!sh || !sh.cd) return Promise.resolve({ state: 'rejected', error: new Error('shareholder_required') });
    return reconcileSalaryOnServer(month, {
      explicitEligibility: true,
      scopeShareholder: sh.cd,
      reason: 'تغییر صریح وضعیت/حقوق سهامدار ' + String(sh.cd)
    });
  };

  window.ptfMigrateShareholderOpex = function () {
    return reconcileSalaryOnServer(faMonthNow(), {
      explicitEligibility: false,
      reason: 'بازسازی صریح ردیف‌های حقوق جاری بدون حذف eligibility',
      restore: false
    });
  };

  /* v34.38.19 (SH-SALARY-MONTH-GAP / F-4): جبران کنترل‌شدهٔ ماه‌های غایب حقوق از
     eligibilitySince تا ماه جاری. فقط ساخت idempotent؛ هیچ ردیفی void نمی‌شود و ماه‌های
     قفل‌شده رد می‌شوند. نیازمند دلیل صریح و تأیید انسانی است. */
  window.ptfShareBackfillSalaries = function () {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return Promise.resolve({ state: 'rejected', error: new Error('role') }); }
    var reason = '';
    try { reason = (prompt('دلیل جبران ماه‌های غایب حقوق را وارد کنید (برای ردپای حسابرسی الزامی است):', '') || '').trim(); } catch (eP) {}
    if (!reason) { alert('ثبت دلیل جبران الزامی است.'); return Promise.resolve({ state: 'rejected', error: new Error('reason_required') }); }
    if (!confirm('ماه‌های غایب حقوقِ سهامداران موظف (از ابتدای احراز تا ماه جاری) به‌صورت idempotent ساخته شوند؟\nهیچ ردیفی حذف/ابطال نمی‌شود و ماه‌های سال قفل‌شده رد می‌شوند.')) {
      return Promise.resolve({ state: 'rejected', error: new Error('cancelled') });
    }
    return shareDomainCommand('backfill_shareholder_salaries', {
      throughMonth: faMonthNow(),
      reason: reason,
      idempotencyKey: 'SH-BACKFILL|' + String(faMonthNow()) + '|' + Date.now()
    }, ['ptf_crm_sharetx', 'ptf_crm_opex']).then(function (state) {
      if (state && state.state === 'acked') {
        var r = state.response && state.response.result || {};
        if (typeof ptfToast === 'function') ptfToast('جبران حقوق: ' + (+r.created || 0) + ' ماه ساخته شد' + (+r.skippedLocked || 0 ? ' — ' + r.skippedLocked + ' ماه قفل رد شد' : ''), 'ok');
        shareCommandRender();
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') {
        ptfToast('⛔ جبران حقوق انجام نشد: ' + shareCommandErrorText(state), 'warn');
      }
      return state;
    });
  };

  window.ptfShareholderBalance = function (cd) {
    var s = shAll().filter(function (x) { return x.cd === cd; })[0];
    var ledger = txAll().filter(function (x) { return x && x.shCd === cd && shareTxActive(x); }).reduce(function (a, x) {
      if (x.type === 'salary' || x.type === 'credit' || x.type === 'profit') a.credit += (+x.amt || 0);
      else if (x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment') a.debit += (+x.amt || 0);
      else if (x.type === 'call_due') a.callDue += (+x.amt || 0);
      else if (x.type === 'call_pay') a.callPay += (+x.amt || 0);
      else if (x.type === 'call_over' || x.type === 'chair_in') a.callOver += (+x.amt || 0);
      else if (x.type === 'call_credit_use' || x.type === 'chair_out') a.callOverUsed += (+x.amt || 0);
      return a;
    }, { credit: 0, debit: 0, callDue: 0, callPay: 0, callOver: 0, callOverUsed: 0 });
    var petty = 0;
    try {
      if (s && typeof ptfPettyPendingByUser === 'function') petty = +(ptfPettyPendingByUser()[s.name] || 0);
      else if (s) petty = (getData('ptf_crm_petty') || []).filter(function (p) { return p.by === s.name && p.st !== 'settled'; }).reduce(function (z, p) { return z + (+p.amt || 0); }, 0);
    } catch (e) {}
    ledger.petty = petty;
    ledger.callRemain = Math.max(0, (+ledger.callDue || 0) - (+ledger.callPay || 0));
    ledger.callCredit = Math.max(0, (+ledger.callOver || 0) - (+ledger.callOverUsed || 0));
    ledger.opsNet = ledger.credit + petty - ledger.debit;
    ledger.net = ledger.opsNet + ledger.callCredit - ledger.callRemain;
    return ledger;
  };

  /* v34.38.19 (SH-SALARY-MONTH-GAP — read-only): فهرست ماه‌های غایب/تکراری حقوق هر سهامدارِ
     موظف. مبنای شروع = eligibilitySince (اگر موجود باشد) وگرنه اولین ادعای active؛ تا ماه جاری.
     فقط گزارش می‌دهد؛ هیچ داده‌ای نمی‌سازد/void نمی‌کند — تعیین‌تکلیف دستی یا فرمان backfill است
     (ریشهٔ باگ «یکی ۲ ماه، دو تای دیگر ۳ ماه»). */
  window.ptfShareholderSalaryGaps = function (throughMonth) {
    var out = [];
    try {
      var to = normMonth(throughMonth) || faMonthNow();
      if (!to) return out;
      function mIdx(m) { var p = String(m || '').split('/'); var y = +p[0], mo = +p[1]; return (y && mo) ? y * 12 + (mo - 1) : NaN; }
      function mFromIdx(i) { return Math.floor(i / 12) + '/' + ('0' + ((i % 12) + 1)).slice(-2); }
      var txs = txAll().filter(function (x) { return x && shareTxActive(x) && x.type === 'salary'; });
      activeShares().filter(function (s) { return s && s.duty && (+s.salary || 0) > 0; }).forEach(function (s) {
        var mine = txs.filter(function (x) { return x.shCd === s.cd; });
        var anchor = (typeof s.eligibilitySince === 'string' && normMonth(s.eligibilitySince)) || '';
        if (!anchor) {
          anchor = normMonth(mine.map(function (x) { return x.month || ''; }).sort()[0] || '');
        }
        if (!anchor) return; /* بدون مبنای شروع — در گزارش نیاور */
        var start = mIdx(anchor), end = mIdx(to);
        if (isNaN(start) || isNaN(end) || start > end) return;
        var have = {};
        mine.forEach(function (x) { var m = normMonth(x.month); if (m) have[m] = (have[m] || 0) + 1; });
        var missing = [], extra = [];
        for (var i = start; i <= end && (i - start) < 60; i++) {
          var mm = mFromIdx(i);
          if (!have[mm]) missing.push(mm);
          else if (have[mm] > 1) extra.push(mm + '×' + have[mm]);
        }
        if (missing.length || extra.length) {
          out.push({ shCd: s.cd, name: s.name || s.cd, anchor: anchor, missing: missing, extra: extra });
        }
      });
    } catch (e) {}
    return out;
  };

  function addTx(type, sh, amt, desc, extra) {
    var rec = Object.assign({ cd: genCode('SHT'), shCd: sh.cd, shName: sh.name, type: type, amt: +amt || 0, desc: desc || '', t: faDateTime(), month: faMonthNow(), by: nm(), files: [] }, extra || {});
    if (extra && extra.files) rec.files = (extra.files || []).slice();
    var a = txAll(); a.unshift(rec); txSave(a); return rec;
  }
  window.ptfShareAddTx = addTx;

  function shareTxFind(cd) {
    return txAll().filter(function (x) { return x && x.cd === cd; })[0] || null;
  }
  function shareTxFileRows(tx) {
    var files = (tx && tx.files) || [];
    if (!files.length) return '<div style="padding:10px;border:1px dashed var(--brd);border-radius:10px;text-align:center;color:#94a3b8">هنوز سندی برای این پرداخت ثبت نشده.</div>';
    return files.map(function (f, index) {
      var key = ptfOnClickArg(f.key || '');
      var name = escP(f.name || ('سند ' + (index + 1)));
      return '<div style="display:flex;align-items:center;gap:7px;min-width:0;padding:7px 9px;margin-bottom:6px;border:1px solid var(--brd);border-radius:10px;background:var(--bg)">' +
        '<span aria-hidden="true">📄</span><span title="' + name + '" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</span>' +
        (f.key ? '<button type="button" class="bt bt-o" style="padding:4px 8px;font-size:11px;flex:none" onclick="openStoredFile(\'' + key + '\')">مشاهده</button>' : '<small style="color:#94a3b8;flex:none">صف محلی</small>') +
        '<button type="button" class="bt bt-o" style="padding:4px 8px;font-size:11px;color:#dc2626;flex:none" title="حذف پیوست" onclick="ptfShareTxRemoveFile(\'' + ptfOnClickArg(tx.cd) + '\',\'' + key + '\')">✕</button></div>';
    }).join('');
  }
  window.ptfShareTxAttachOpen = function (cd) {
    if (!canShare()) return;
    var tx = shareTxFind(cd);
    if (!tx) { alert('پرداخت یافت نشد'); return; }
    var old = document.getElementById('shareTxAttachDlg');
    if (old) old.remove();
    var html = '<div class="md-b" id="shareTxAttachDlg" data-share-tx="' + escP(cd) + '" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:500px"><h3>📎 اسناد پرداخت — ' + escP(tx.cd) + '</h3><div style="font-size:12px;color:#475569;line-height:1.8;margin-bottom:10px">فیش واریز، تصویر چک، رسید یا هر مدرک این پرداخت را بارگذاری کنید. فایل به همین ردیف گردش می‌چسبد.</div><div id="shareTxAttachFiles" style="max-height:240px;overflow:auto;margin-bottom:12px">' + shareTxFileRows(tx) + '</div><div id="shareTxAttachUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="document.getElementById(\'shareTxAttachDlg\').remove();if(typeof ptfShareLedger===\'function\')ptfShareLedger(\'' + ptfOnClickArg(tx.shCd) + '\')">تمام</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget !== 'function') { alert('ماژول بارگذاری فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    attachUploadWidget('shareTxAttachUp', 'sharetx/' + tx.cd, function (f) {
      var all = txAll(), rec = all.filter(function (x) { return x.cd === cd; })[0];
      if (!rec || !f || !f.key) return;
      rec.files = rec.files || [];
      if (!rec.files.some(function (x) { return x.key === f.key; })) rec.files.push(f);
      txSave(all);
      var box = document.getElementById('shareTxAttachFiles');
      if (box) box.innerHTML = shareTxFileRows(rec);
      try { audit('سهامداران', 'پیوست سند «' + (f.name || '') + '» به پرداخت ' + rec.cd, rec.cd); } catch (eA) {}
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('سند روی این دستگاه به پرداخت پیوست شد');
      else if (typeof ptfToast === 'function') ptfToast('سند به پرداخت پیوست شد', 'ok');
    });
  };
  window.ptfShareTxRemoveFile = function (cd, key) {
    if (!canShare() || !key) return;
    var all = txAll(), rec = all.filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    var file = (rec.files || []).filter(function (x) { return x.key === key; })[0] || {};
    if (!confirm('پیوست «' + (file.name || 'فایل') + '» حذف شود؟')) return;
    rec.files = (rec.files || []).filter(function (x) { return x.key !== key; });
    txSave(all);
    var box = document.getElementById('shareTxAttachFiles');
    if (box) box.innerHTML = shareTxFileRows(rec);
    try { audit('سهامداران', 'حذف پیوست «' + (file.name || '') + '» از پرداخت ' + rec.cd, rec.cd); } catch (eA) {}
    try {
      if (typeof STORAGE_API !== 'undefined' && typeof ptfStorageAuthHeaders === 'function') {
        fetch(STORAGE_API + '?action=delete', { method: 'POST', headers: ptfStorageAuthHeaders(true), body: JSON.stringify({ key: key }) }).catch(function () {});
      }
    } catch (eD) {}
  };

  /* MOB-041: actionهای سهامداران به tileهای دارای نام/معنا تبدیل می‌شوند؛ هیچ
     چرخ‌دنده یا first-letter مبهم در موبایل باقی نمی‌ماند. */
  function shareAction(kind, icon, label, title, onClick, primary) {
    return '<button type="button" class="bt' + (primary ? '' : ' bt-o') + ' shareholder-action shareholder-' + kind + '" data-share-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="shareholder-action-icon" aria-hidden="true">' + icon + '</span><span class="shareholder-action-label">' + label + '</span></button>';
  }
  if (!window._ptfShareMonthPickerHooked && typeof document !== 'undefined' && document.addEventListener) {
    window._ptfShareMonthPickerHooked = true;
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'shareholderMonth') window._shareMonth = normMonth(e.target.value) || faMonthNow();
    });
  }
  window.ptfShareRender = function () {
    var el = document.getElementById('shareBox'); if (!el) return;
    if (!canShare()) { el.innerHTML = ''; return; }
    var list = shAll();
    var totalPct = activeShares().reduce(function (s, x) { return s + (+x.pct || 0); }, 0);
    var month = window._shareMonth || faMonthNow();
    var rows = list.map(function (s) {
      var b = ptfShareholderBalance(s.cd);
      var cls = b.net >= 0 ? '#059669' : '#dc2626';
      var st = b.net >= 0 ? 'بستانکار از شرکت' : 'بدهکار به شرکت';
      return '<div class="shareholder-card">' +
        '<div class="shareholder-card-head"><div class="shareholder-copy"><b>' + escP(s.name) + '</b> <span class="bd" style="background:#eef2ff;color:#3730a3">' + (+s.pct || 0) + '٪</span> ' + (s.duty ? '<span class="bd b-st3">موظف</span>' : '') + (s.active === false ? ' <span class="bd" style="background:#fee2e2;color:#b91c1c">غیرفعال</span>' : '') +
        '<br><small style="color:#64748b">حقوق موظف: ' + money(s.salary || 0) + ' | مطالبات تنخواه: ' + money(b.petty) +
        (b.callRemain ? ' | بدهی فراخوان: ' + money(b.callRemain) : '') +
        (b.callCredit ? ' | طلب از صندوق: ' + money(b.callCredit) : '') +
        '</small><br><b style="color:' + cls + '">مانده: ' + money(Math.abs(b.net)) + ' — ' + st + '</b></div>' +
        '<div class="shareholder-actions" role="group" aria-label="عملیات سهامدار ' + escP(s.name) + '">' +
        shareAction('edit', '✏️', 'ویرایش', 'ویرایش مشخصات سهامدار', 'ptfShareEdit(\'' + s.cd + '\')', false) +
        (s.duty && (+s.salary || 0) > 0 ? shareAction('salary', '📅', 'ثبت حقوق', 'ثبت حقوق ماهانه به‌عنوان هزینه و مطالبه', 'ptfShareRegisterSalary(\'' + s.cd + '\')', true) : '') +
        (s.duty && (+s.salary || 0) > 0 ? shareAction('dedupe', '🧹', 'رفع تکراری', 'ابطال ردیف‌های حقوقِ تکراری این سهامدار (در هر ماه یک ردیف زنده می‌ماند)', 'ptfShareDedupe(\'' + s.cd + '\')', false) : '') +
        shareAction('draw', '💸', 'علی‌الحساب', 'ثبت برداشت یا علی‌الحساب سهامدار', 'ptfShareDraw(\'' + s.cd + '\')', true) +
        shareAction('ledger', '📖', 'گردش', 'مشاهده گردش حساب سهامدار', 'ptfShareLedger(\'' + s.cd + '\')', false) +
        '</div></div></div>';
    }).join('');
    var warn = Math.round(totalPct * 100) / 100 === 100 ? '<span style="color:#059669">جمع سهام فعال: ۱۰۰٪ ✅</span>' : '<span style="color:#dc2626">جمع سهام فعال: ' + totalPct + '٪ — باید به ۱۰۰٪ برسد</span>';
    el.innerHTML = '<div class="shareholder-box">' +
      '<div class="shareholder-box-head"><div><b>👥 سهامداران، حقوق موظف و علی‌الحساب</b><br><small>' + warn + '</small></div><div class="shareholder-head-tools"><div class="shareholder-month" style="min-width:190px">' + (window.DateKit && DateKit.monthPicker ? DateKit.monthPicker('shareholderMonth', month) : '<input id="shareholderMonth" value="' + escP(month) + '">') + '</div><div class="shareholder-head-actions" role="group" aria-label="عملیات سهامداران">' +
      shareAction('backfill', '🔁', 'جبران حقوق', 'جبران ماه‌های غایب حقوق سهامداران موظف (idempotent، بدون ابطال)', 'ptfShareBackfillSalaries()', false) +
      shareAction('add', '➕', 'سهامدار', 'ثبت سهامدار جدید', 'ptfShareEdit()', true) +
      '</div></div></div>' +
      '<div class="shareholder-list">' + (rows || '<div style="text-align:center;color:#94a3b8;padding:18px">سهامداری ثبت نشده</div>') + '</div></div>';
  };

  window.ptfShareEdit = function (cd) {
    if (!canShare()) { alert('⛔ فقط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی'); return; }
    var old = cd ? shAll().filter(function (x) { return x.cd === cd; })[0] : null;
    ptfDialog({
      title: old ? 'ویرایش سهامدار' : 'ثبت سهامدار',
      fields: [
        { id: 'name', label: 'نام سهامدار', value: old ? old.name : '', required: true },
        { id: 'pct', label: 'درصد سهام', type: 'number', value: old ? old.pct : '', required: true, dir: 'ltr', nohint: true },
        { id: 'duty', label: 'سهامدار موظف؟', type: 'select', value: old && old.duty ? 'yes' : 'no', options: [{ v: 'no', lb: 'خیر' }, { v: 'yes', lb: 'بله' }] },
        /* v34.38.19 (SH-SALARY-ANCHOR): ماه شروع احراز حقوق صریح و قابل اصلاح شد. قبلاً
           این مبنا بی‌صدا از ماه انتخابی پنل (یا ماه جاری) پر می‌شد و اگر کاربر هنگام
           فعال‌کردن موظفی روی ماه گذشته‌ای بود، جبران (backfill) یک ماه اضافه می‌ساخت
           (باگ «به‌جای ۳ ماه ۴ ماه»). حالا کاربر خودش مبدأ را می‌بیند و اصلاح می‌کند. */
        { id: 'eligibilitySince', label: 'ماه شروع احراز حقوق (YYYY/MM — خالی = ماه جاری هنگام فعال‌شدن موظفی)', type: 'text', value: old && old.eligibilitySince ? old.eligibilitySince : '', placeholder: 'مثلا 1405/04', dir: 'ltr' },
        { id: 'salary', label: 'حقوق ماهانه موظف (ریال)', type: 'number', value: old && old.salary ? (+old.salary).toLocaleString('en-US') : '', placeholder: 'مثلا 200,000,000', dir: 'ltr', nohint: true } /* v21.10: type:number → data-money + nohint (درصد/حقوق نیازی به حروف ندارند) */,
        /* v34.38.5 (DATA-QUALITY SH-SALARY): گزارش کارفرما — «تب کیفیت داده حقوق سهامدار را
           بدون نوع رسمی/غیررسمی نشان می‌دهد ولی ویرایش سهامدار گزینه‌ای برای تعیین آن ندارد».
           نوع سند حقوق از خود تب سهامداران تعیین و به هزینهٔ حقوق (isOfficial) انتشار می‌یابد. */
        { id: 'salaryOfficial', label: 'نوع سند حقوق', type: 'select', value: old && old.salaryOfficial === true ? 'yes' : (old && old.salaryOfficial === false ? 'no' : ''), options: [{ v: '', lb: 'تعیین نشده' }, { v: 'yes', lb: 'رسمی / قابل قبول ممیز' }, { v: 'no', lb: 'غیررسمی' }] },
        { id: 'active', label: 'وضعیت', type: 'select', value: old && old.active === false ? 'no' : 'yes', options: [{ v: 'yes', lb: 'فعال' }, { v: 'no', lb: 'غیرفعال' }] }
      ],
      okText: 'ذخیره',
      onOk: function (v) {
        var pct = n(v.pct);
        if (pct <= 0 || pct > 100) { alert('درصد سهام نامعتبر است'); return; }
        if (pctSum(cd) + pct > 100.0001 && v.active === 'yes') { alert('جمع سهام فعال از ۱۰۰٪ بیشتر می‌شود'); return; }
        var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
        if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ویرایش سهامدار/حقوق در آن سال مجاز نیست.'); return; }
        var a = shAll();
        var rec = old || { cd: genCode('SHR'), createdBy: nm(), createdT: faDateTime() };
        var prevSalary = +rec.salary || 0;
        var wasDuty = !!(old && old.duty);
        rec.name = v.name; rec.pct = pct; rec.duty = v.duty === 'yes'; rec.salary = rec.duty ? n(v.salary) : 0; rec.active = v.active !== 'no'; rec.updatedBy = nm(); rec.updatedT = faDateTime();
        /* v34.38.19 (SH-SALARY-ANCHOR): مبدأ احراز صریح و قابل اصلاح است. اگر کاربر ماهِ
           معتبری وارد کند همان مبنا می‌شود؛ وگرنه هنگام اولین «فعال‌شدن موظفی» ماه جاری/پنل
           به‌عنوان fallback ثبت می‌شود. اصلاحِ مبدأ توسط کاربر، جبران ماه‌های غایب را از
           ماه درست شروع می‌کند (رفع باگ «به‌جای ۳ ماه ۴ ماه»). */
        var eligSince = normMonth(v.eligibilitySince);
        if (eligSince && !/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/.test(eligSince)) { alert('ماه شروع احراز نامعتبر است؛ نمونه: 1405/04'); return; }
        if (rec.duty && eligSince) rec.eligibilitySince = eligSince;
        else if (rec.duty && !wasDuty && !rec.eligibilitySince) rec.eligibilitySince = month;
        /* v34.38.5 (DATA-QUALITY SH-SALARY): نوع سند حقوق (رسمی/غیررسمی/تعیین‌نشده) — همان
           الگوی ptfOpexEdit؛ «تعیین نشده» یعنی کلید حذف می‌شود تا هزینه حقوق unclassified بماند. */
        var salaryOfficial = v.salaryOfficial === 'yes' ? true : (v.salaryOfficial === 'no' ? false : undefined);
        if (salaryOfficial === undefined) delete rec.salaryOfficial; else rec.salaryOfficial = salaryOfficial;
        if (old) a = a.map(function (x) { return x.cd === rec.cd ? rec : x; }); else a.unshift(rec);
        shSave(a);
        audit('سهامداران', (old ? 'ویرایش ' : 'ثبت ') + rec.name + ' — ' + rec.pct + '٪' + (old && prevSalary !== rec.salary ? ' | حقوق: ' + prevSalary + ' → ' + rec.salary : '') + (salaryOfficial !== undefined ? ' | نوع سند حقوق: ' + (salaryOfficial ? 'رسمی' : 'غیررسمی') : ''), rec.cd);
        ptfShareRender();
        reconcileSalaryOnServer(month, {
          explicitEligibility: true,
          scopeShareholder: rec.cd,
          reason: 'تغییر صریح وضعیت/حقوق سهامدار ' + rec.cd
        }).then(function (state) {
          if (state && state.state === 'acked') {
            if (typeof ptfToast === 'function') ptfToast('حقوق ماه ' + month + ' از snapshot قطعی سرور تطبیق شد', 'ok');
          } else if (typeof ptfToast === 'function') {
            ptfToast('⚠️ تغییر سهامدار ذخیره شد، اما تطبیق حقوق تأیید نشد؛ وضعیت Sync را بررسی و ثبت را دوباره اجرا کنید.', 'warn');
          }
        });
      }
    });
  };

  window.ptfShareRegisterSalary = function (cd) {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return; }
    var s = shAll().filter(function (x) { return x && x.cd === cd; })[0];
    if (!s) { alert('سهامدار یافت نشد'); return; }
    if (s.active === false || !s.duty || !(+s.salary || 0)) { alert('این سهامدار موظف نیست یا حقوقی برایش تعریف نشده است.'); return; }
    var defaultMonth = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
    ptfDialog({
      title: '📅 ثبت حقوق ماهانه — ' + s.name,
      body: 'مبلغ از پروفایل سهامدار خوانده می‌شود: <b>' + money(s.salary) + '</b> ریال.<br><small>این ثبت فقط هزینه جاری و مطالبه سهامدار ایجاد می‌کند و خروج خزانه ندارد. پرداخت واقعی بعداً با «draw» ثبت می‌شود.</small>',
      fields: [
        { id: 'month', label: 'ماه حقوق (YYYY/MM) *', type: 'text', value: defaultMonth, required: true, dir: 'ltr', placeholder: '1405/06' }
      ],
      okText: 'ثبت حقوق',
      onOk: function (v) {
        var month = normMonth(v.month);
        if (!/^(13|14)\d{2}\/(0[1-9]|1[0-2])$/.test(month)) { alert('ماه نامعتبر است؛ نمونه: 1405/06'); return; }
        if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت حقوق در آن سال مجاز نیست.'); return; }
        var fresh = shAll().filter(function (x) { return x && x.cd === cd; })[0] || s;
        if (fresh.active === false || !fresh.duty || !(+fresh.salary || 0)) { alert('وضعیت یا حقوق سهامدار تغییر کرده است؛ دوباره بررسی کنید.'); return; }
        registerSalaryOnServer(fresh, month, 'DIALOG-' + Date.now().toString(36));
      }
    });
  };

  /* Compatibility name: the former global action was a restore/reconcile action.
     It is intentionally no longer destructive or bulk; registration is per card. */
  window.ptfShareApplySalary = function (month) {
    if (!canShare()) return;
    alert('ثبت حقوق از دکمهٔ «ثبت حقوق» کنار هر سهامدار انجام می‌شود؛ عملیات گروهی/بازسازی خودکار اجرا نشد.');
  };

  window.ptfShareDraw = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x && x.cd === cd; })[0]; if (!s) return;
    var draftCd = genCode('SHT');
    ptfDialog({ title: 'برداشت / علی‌الحساب — ' + s.name, fields: [
      { id: 'amt', label: 'مبلغ برداشت', type: 'number', required: true, dir: 'ltr' },
      { id: 'desc', label: 'شرح/شماره سند', required: true },
      { id: 'files', label: 'پیوست سند پرداخت (فیش، چک، رسید)', type: 'upload', uploadFolder: 'sharetx/' + draftCd }
    ], okText: 'ثبت برداشت', onOk: function (v) {
      var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
      if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت برداشت در آن سال مجاز نیست.'); return; }
      var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      shareDrawOnServer(s, amt, v.desc, v.files || [], month, '', draftCd);
    } });
  };

  /* v34.8.6/F2 — پرداخت واقعی حقوق نیز draw است؛ salary_payment فقط برای legacy
     در گزارش‌های قدیمی باقی می‌ماند و از این مسیر رکورد تازه‌ای تولید نمی‌شود. */
  window.ptfSharePaySalary = function (cd) {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return; }
    var s = shAll().filter(function (x) { return x && x.cd === cd; })[0];
    if (!s) { alert('سهامدار یافت نشد'); return; }
    if (!s.duty || !(+s.salary || 0)) { alert('این سهامدار موظف نیست یا حقوقی برایش تعریف نشده.'); return; }
    var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
    if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ پرداخت حقوق در آن سال مجاز نیست.'); return; }
    var draftCd = genCode('SHT');
    ptfDialog({
      title: '💳 پرداخت حقوق با draw — ' + s.name,
      body: 'حقوق ماهانهٔ موظف این سهامدار: <b>' + money(s.salary) + '</b> ریال.<br><small>پرداخت واقعی با نوع «draw» ثبت می‌شود و خروج خزانه دارد؛ ثبت salary قبلی همچنان مطالبهٔ حقوق است.</small>',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی (ریال) *', type: 'number', value: String(+s.salary || 0), required: true, dir: 'ltr' },
        { id: 'desc', label: 'شرح/شماره سند', value: 'پرداخت حقوق موظف ' + month, required: true },
        { id: 'files', label: 'پیوست سند پرداخت (فیش واریز، تصویر چک، رسید)', type: 'upload', uploadFolder: 'sharetx/' + draftCd }
      ],
      okText: 'ثبت پرداخت واقعی',
      onOk: function (v) {
        var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
        shareDrawOnServer(s, amt, String(v.desc || '').trim(), v.files || [], month, month, draftCd);
      }
    });
  };

  window.ptfShareLedger = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x.cd === cd; })[0]; if (!s) return;
    var rows = txAll().filter(function (x) { return x.shCd === cd; }).map(function (x) {
      var active = shareTxActive(x);
      var sign = !active ? '' : ((x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment' || x.type === 'call_due' || x.type === 'call_credit_use') ? '-' : '+');
      var typeLb = { salary: 'حقوق (مطالبه)', salary_payment: 'پرداخت حقوق legacy', draw: 'برداشت/علی‌الحساب', advance: 'علی‌الحساب', debit: 'بدهی', credit: 'بستانکاری', profit: 'تقسیم سود', call_due: 'سهم فراخوان نقدینگی', call_pay: 'تأمین سهم فراخوان', call_over: 'مازاد تأمین (طلب از صندوق)', call_credit_use: 'تهاتر طلب با فراخوان', chair_in: 'تزریق شخصی رییس به صندوق', chair_out: 'تسویه طلب رییس از صندوق' }[x.type] || x.type;
      if (x.type === 'draw' && x.paymentFor === 'salary') typeLb = 'پرداخت حقوق (draw)';
      if (!active) typeLb += ' (باطل‌شده)';
      var nFiles = (x.files || []).length;
      var docs = '<button type="button" class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();ptfShareTxAttachOpen(\'' + ptfOnClickArg(x.cd) + '\')">📎 ' + (nFiles ? (nFiles + ' سند') : 'افزودن سند') + '</button>';
      /* v34.38.20 (SHARE-TX-MANUAL-VOID): ابطال دستیِ یک ردیف گردش — اصلاح دستی که
         کاربر برای «حقوق دوبار ثبت‌شده» نیاز دارد. حذف فیزیکی نیست؛ سند ابطال پایدار
         سروری است (tombstone + corrections + دلیل صریح). */
      var voidBtn = active ? '<button type="button" class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" title="ابطال این ردیف گردش (حسابرسی‌پذیر)" onclick="event.stopPropagation();ptfShareTxVoid(\'' + ptfOnClickArg(x.cd) + '\')">ابطال</button>' : '';
      return '<tr' + (!active ? ' style="opacity:.65"' : '') + '><td>' + escP(x.t || '') + '</td><td>' + escP(typeLb) + '</td><td style="direction:ltr;' + (!active ? 'text-decoration:line-through' : '') + '">' + sign + money(x.amt) + '</td><td>' + escP(x.desc || '') + '</td><td>' + docs + '</td><td>' + voidBtn + '</td></tr>';
    }).join('');
    var b = ptfShareholderBalance(cd);
    var oldLed = document.getElementById('shareLedgerDlg');
    if (oldLed) oldLed.remove();
    var html = '<div class="md-b" id="shareLedgerDlg" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px"><h3>گردش سهامدار — ' + escP(s.name) + '</h3><p style="font-size:13px;color:#475569">مانده لحظه‌ای: <b>' + money(Math.abs(b.net)) + ' ' + (b.net >= 0 ? 'بستانکار' : 'بدهکار') + '</b> | مطالبات تنخواه باز: ' + money(b.petty) + '</p><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>مبلغ</th><th>شرح</th><th>سند</th><th>عملیات</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">گردشی ثبت نشده</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  /* v34.38.20 (SHARE-TX-MANUAL-VOID): ابطال دستیِ یک ردیف گردش سهامدار. کاربر برای
     «حقوقِ دوبار ثبت‌شده در یک ماه» به یک اهرم اصلاح دستی نیاز داشت که پیش از این وجود
     نداشت. ابطال، حذف فیزیکی نیست: فرمان سروری void_shareholder_tx ردیف را با دلیل صریح
     tombstone می‌کند و برای نوع salary هزینهٔ حقوقِ پیوندخورده را هم می‌بندد. */
  window.ptfShareTxVoid = function (cd) {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return; }
    var tx = txAll().filter(function (x) { return x && x.cd === cd; })[0];
    if (!tx) { alert('ردیف گردش یافت نشد'); return; }
    if (!shareTxActive(tx)) { alert('این ردیف قبلاً باطل شده است'); return; }
    var reason = '';
    try { reason = (prompt('دلیل ابطال این ردیف گردش را وارد کنید (برای ردپای حسابرسی الزامی است):', '') || '').trim(); } catch (eP) {}
    if (!reason) { alert('ثبت دلیل ابطال الزامی است.'); return; }
    if (!confirm('این ردیف حذف فیزیکی نمی‌شود؛ به‌صورت سند ابطال پایدار و حسابرسی‌پذیر ثبت می‌شود.' + (tx.type === 'salary' ? '\nهزینهٔ حقوقِ پیوندخورده با همین ردیف نیز باطل می‌شود.' : '') + '\nادامه می‌دهید؟')) return;
    return shareDomainCommand('void_shareholder_tx', {
      txCd: tx.cd,
      reason: reason,
      idempotencyKey: 'SH-VOID-TX|' + String(tx.cd) + '|' + Date.now()
    }, ['ptf_crm_sharetx', 'ptf_crm_opex']).then(function (state) {
      if (state && state.state === 'acked') {
        if (typeof ptfToast === 'function') ptfToast('✅ ردیف گردش باطل شد', 'ok');
        shareCommandRender();
        try { ptfShareLedger(tx.shCd); } catch (eLed) {}
      } else if (state && state.state === 'uncertain') {
        if (typeof ptfToast === 'function') ptfToast('⚠️ نتیجه ابطال نامشخص است؛ از مسیر دیگری دوباره ثبت نکنید.', 'warn');
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') {
        ptfToast('⛔ ابطال انجام نشد: ' + shareCommandErrorText(state), 'warn');
      }
      return state;
    });
  };

  /* v34.38.20 (SHARE-SALARY-DEDUPE): رفع دستیِ «حقوق دوبار ثبت‌شده در یک ماه». ریشهٔ
     «خودکار درست نشد»: reconcile فقط ماهِ پنل/جاری را پاک می‌کرد. این فرمان همهٔ ماه‌های
     سهامدار را می‌پیماید و برای هر ماهِ دارای بیش از یک ردیف active حقوق، اضافه‌ها را (با
     هزینهٔ پیوندخورده) void می‌کند و یک ردیف زنده نگه می‌دارد. */
  window.ptfShareDedupe = function (cd) {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return; }
    var s = shAll().filter(function (x) { return x && x.cd === cd; })[0];
    if (!s) { alert('سهامدار یافت نشد'); return; }
    var reason = '';
    try { reason = (prompt('دلیل رفع تکراری حقوق این سهامدار را وارد کنید (برای ردپای حسابرسی الزامی است):', '') || '').trim(); } catch (eP) {}
    if (!reason) { alert('ثبت دلیل رفع تکراری الزامی است.'); return; }
    if (!confirm('برای «' + s.name + '» ماه‌هایی که حقوقشان بیش از یک ردیف فعال دارد بررسی می‌شود و ردیف‌های اضافه (با هزینهٔ پیوندخورده) باطل می‌شوند؛ در هر ماه یک ردیف زنده می‌ماند.\nماه‌های سال قفل‌شده دست‌نخورده می‌مانند. ادامه می‌دهید؟')) return;
    return shareDomainCommand('dedupe_shareholder_salaries', {
      shareholderCd: s.cd,
      reason: reason,
      idempotencyKey: 'SH-DEDUPE|' + String(s.cd) + '|' + Date.now()
    }, ['ptf_crm_sharetx', 'ptf_crm_opex']).then(function (state) {
      if (state && state.state === 'acked') {
        var r = state.response && state.response.result || {};
        if (typeof ptfToast === 'function') ptfToast('✅ رفع تکراری: ' + (+r.voidedSalaryRows || 0) + ' ردیف حقوق و ' + (+r.voidedOpexRows || 0) + ' ردیف هزینه باطل شد' + (+r.skippedLocked || 0 ? ' — ' + r.skippedLocked + ' ماه قفل رد شد' : ''), 'ok');
        shareCommandRender();
      } else if (state && state.state === 'rejected' && typeof ptfToast === 'function') {
        ptfToast('⛔ رفع تکراری انجام نشد: ' + shareCommandErrorText(state), 'warn');
      }
      return state;
    });
  };

  /* hook روی پنل تنخواه؛ بعد از opex لود می‌شود، پس خروجی opex هم حفظ می‌شود. */
  if (!window._shareHooked) {
    window._shareHooked = true;
    var _bp = window.buildPetty;
    if (typeof _bp === 'function') window.buildPetty = function () { return _bp() + '<div id="shareBox"></div>'; };
    var _rp = window.renderPetty;
    if (typeof _rp === 'function') window.renderPetty = function () { _rp(); try { ptfShareRender(); } catch (e) {} };
  }
})();
