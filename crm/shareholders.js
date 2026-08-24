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
    if (typeof window.ptfSalesDomainCommand !== 'function') {
      if (typeof ptfToast === 'function') ptfToast('سرویس ثبت سروری حقوق آماده نیست؛ هیچ رکورد محلی ساخته نشد.', 'warn');
      return Promise.resolve({ state: 'rejected', error: new Error('salary_server_command_unavailable') });
    }
    var restoreKeys = [];
    if (options.restore === true) activeShares().filter(function (sh) { return sh.duty && (+sh.salary || 0) > 0; }).forEach(function (sh) {
      restoreKeys.push(salaryRecurringKey(sh, month));
    });
    function send(resolve) {
      try {
        var command = window.ptfSalesDomainCommand('reconcile_shareholder_salaries', {
          month: month,
          explicitEligibility: options.explicitEligibility === true,
          scopeShareholder: options.scopeShareholder || '',
          restoreKeys: restoreKeys,
          reason: options.reason || 'تطبیق صریح حقوق سهامداران از رابط کاربری',
          idempotencyKey: 'SH-SALARY|' + month + '|' + String(options.scopeShareholder || 'all') + '|' + Date.now()
        }, { apiOptions: { autoReplay: true } });
        if (!command || typeof command.then !== 'function') { resolve({ state: 'rejected', error: new Error('salary_server_promise_required') }); return; }
        command.then(resolve, function (error) { resolve({ state: 'rejected', error: error }); });
      } catch (error) { resolve({ state: 'rejected', error: error }); }
    }
    return new Promise(function (resolve) {
      if (typeof window.ptfSyncFlushKeysNow !== 'function') { resolve({ state: 'rejected', error: new Error('keyed_sync_barrier_unavailable') }); return; }
      try {
        window.ptfSyncFlushKeysNow(['ptf_crm_shareholders'], function (ok) {
          if (!ok) {
            if (typeof ptfToast === 'function') ptfToast('تغییر سهامدار هنوز به سرور نرسیده است؛ حقوق از snapshot محلی ساخته نشد.', 'warn');
            resolve({ state: 'rejected', error: new Error('shareholder_snapshot_not_committed') });
            return;
          }
          send(resolve);
        });
      } catch (error) { resolve({ state: 'rejected', error: error }); }
    }).then(function (state) {
      if (state && state.state === 'acked') {
        try { if (typeof ptfShareRender === 'function') ptfShareRender(); } catch (eShare) {}
        try { if (typeof ptfOpexRender === 'function') ptfOpexRender(); } catch (eOpex) {}
        try { if (typeof ptfFiscalRender === 'function') ptfFiscalRender(); } catch (eFiscal) {}
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
        (s.duty && (+s.salary || 0) > 0 ? shareAction('salary', '💳', 'پرداخت حقوق', 'ثبت پرداخت حقوق سهامدار', 'ptfSharePaySalary(\'' + s.cd + '\')', true) : '') +
        shareAction('draw', '💸', 'علی‌الحساب', 'ثبت برداشت یا علی‌الحساب سهامدار', 'ptfShareDraw(\'' + s.cd + '\')', true) +
        shareAction('ledger', '📖', 'گردش', 'مشاهده گردش حساب سهامدار', 'ptfShareLedger(\'' + s.cd + '\')', false) +
        '</div></div></div>';
    }).join('');
    var warn = Math.round(totalPct * 100) / 100 === 100 ? '<span style="color:#059669">جمع سهام فعال: ۱۰۰٪ ✅</span>' : '<span style="color:#dc2626">جمع سهام فعال: ' + totalPct + '٪ — باید به ۱۰۰٪ برسد</span>';
    el.innerHTML = '<div class="shareholder-box">' +
      '<div class="shareholder-box-head"><div><b>👥 سهامداران، حقوق موظف و علی‌الحساب</b><br><small>' + warn + '</small></div><div class="shareholder-head-tools"><div class="shareholder-month" style="min-width:190px">' + (window.DateKit && DateKit.monthPicker ? DateKit.monthPicker('shareholderMonth', month) : '<input id="shareholderMonth" value="' + escP(month) + '">') + '</div><div class="shareholder-head-actions" role="group" aria-label="عملیات سهامداران">' +
      shareAction('add', '➕', 'سهامدار', 'ثبت سهامدار جدید', 'ptfShareEdit()', true) +
      shareAction('apply-salary', '📅', 'ثبت حقوق ماه', 'ثبت حقوق ماه سهامداران', 'ptfShareApplySalary((document.getElementById(\'shareholderMonth\')||{}).value)', true) +
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
        { id: 'salary', label: 'حقوق ماهانه موظف (ریال)', type: 'number', value: old && old.salary ? (+old.salary).toLocaleString('en-US') : '', placeholder: 'مثلا 200,000,000', dir: 'ltr', nohint: true } /* v21.10: type:number → data-money + nohint (درصد/حقوق نیازی به حروف ندارند) */,
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
        rec.name = v.name; rec.pct = pct; rec.duty = v.duty === 'yes'; rec.salary = rec.duty ? n(v.salary) : 0; rec.active = v.active !== 'no'; rec.updatedBy = nm(); rec.updatedT = faDateTime();
        if (old) a = a.map(function (x) { return x.cd === rec.cd ? rec : x; }); else a.unshift(rec);
        shSave(a);
        audit('سهامداران', (old ? 'ویرایش ' : 'ثبت ') + rec.name + ' — ' + rec.pct + '٪' + (old && prevSalary !== rec.salary ? ' | حقوق: ' + prevSalary + ' → ' + rec.salary : ''), rec.cd);
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

  window.ptfShareApplySalary = function (month) {
    if (!canShare()) return;
    month = normMonth(month) || faMonthNow();
    if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت حقوق در آن سال مجاز نیست.'); return; }
    if (!confirm('حقوق ماه ' + month + ' از snapshot قطعی سرور تطبیق شود؟\nاین اقدام فقط با intent صریح شما می‌تواند tombstone همان حقوق‌های واجد شرایط را بازسازی کند.')) return;
    reconcileSalaryOnServer(month, {
      explicitEligibility: true,
      restore: true,
      reason: 'ثبت/بازسازی صریح حقوق سهامداران برای ماه ' + month
    }).then(function (state) {
      if (state && state.state === 'acked') {
        try { audit('سهامداران', 'تطبیق سروری حقوق موظف ماه ' + month, month); } catch (eAudit) {}
        if (typeof ptfToast === 'function') ptfToast('حقوق ماه ' + month + ' روی سرور ثبت/تطبیق شد', 'ok');
      } else if (state && state.state === 'rejected') alert('تطبیق حقوق روی سرور انجام نشد: ' + String((state.error && state.error.message) || 'خطای نامشخص'));
    });
  };

  window.ptfShareDraw = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x.cd === cd; })[0]; if (!s) return;
    var draftCd = genCode('SHT');
    ptfDialog({ title: 'برداشت / علی‌الحساب — ' + s.name, fields: [
      { id: 'amt', label: 'مبلغ برداشت', type: 'number', required: true, dir: 'ltr' },
      { id: 'desc', label: 'شرح/شماره سند', required: true },
      { id: 'files', label: 'پیوست سند پرداخت (فیش، چک، رسید)', type: 'upload', uploadFolder: 'sharetx/' + draftCd }
    ], okText: 'ثبت برداشت', onOk: function (v) {
      var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
      if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت برداشت در آن سال مجاز نیست.'); return; }
      var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      var tx = addTx('draw', s, amt, v.desc, { cd: draftCd, files: (v.files || []).slice() });
      audit('سهامداران', 'ثبت برداشت/علی‌الحساب ' + money(amt) + ' برای ' + s.name + ((tx.files || []).length ? ' — ' + tx.files.length + ' سند' : ''), tx.cd);
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('برداشت روی این دستگاه ثبت شد');
      ptfShareRender();
    } });
  };

  /* ===== v34.0.8-alpha (فاز ۲ — حقوق به‌عنوان «مطالبه» نه «علی‌الحساب سود») =====
     پرداخت حقوق سهامدار موظف با نوع جداگانهٔ salary_payment ثبت می‌شود تا در توزیع سود
     به‌عنوان «برداشت/علی‌الحساب» شمرده نشود و ستون «ماندهٔ قابل تسویهٔ امسال» برای سهامدار
     موظف گمراه‌کننده نباشد. حقوق = مطالبهٔ سهامدار از شرکت (فارغ از درصد سهم) است. */
  window.ptfSharePaySalary = function (cd) {
    if (!canShare()) { alert('⛔ فقط مدیران ارشد'); return; }
    var s = shAll().filter(function (x) { return x.cd === cd; })[0];
    if (!s) { alert('سهامدار یافت نشد'); return; }
    if (!s.duty || !(+s.salary || 0)) { alert('این سهامدار موظف نیست یا حقوقی برایش تعریف نشده.'); return; }
    var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
    if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ پرداخت حقوق در آن سال مجاز نیست.'); return; }
    var draftCd = genCode('SHT');
    ptfDialog({
      title: '💳 پرداخت حقوق — ' + s.name,
      body: 'حقوق ماهانهٔ موظف این سهامدار: <b>' + money(s.salary) + '</b> ریال.<br><small>این مبلغ به‌عنوان «پرداخت مطالبهٔ حقوق» ثبت می‌شود (نه علی‌الحساب سود) و در گردش حساب سهامدار اثر می‌گذارد. فیش یا تصویر چک را همین‌جا پیوست کنید.</small>',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی (ریال) *', type: 'number', value: String(+s.salary || 0), required: true, dir: 'ltr' },
        { id: 'desc', label: 'شرح/شماره سند', value: 'پرداخت حقوق موظف ' + month, required: true },
        { id: 'files', label: 'پیوست سند پرداخت (فیش واریز، تصویر چک، رسید)', type: 'upload', uploadFolder: 'sharetx/' + draftCd }
      ],
      okText: 'ثبت پرداخت حقوق',
      onOk: function (v) {
        var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
        var tx = addTx('salary_payment', s, amt, String(v.desc || '').trim(), { cd: draftCd, month: month, salaryMonth: month, files: (v.files || []).slice() });
        audit('سهامداران', 'پرداخت حقوق ' + money(amt) + ' برای ' + s.name + ' (مطالبهٔ حقوق — نه علی‌الحساب سود)' + ((tx.files || []).length ? ' — ' + tx.files.length + ' سند' : ''), tx.cd);
        if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('پرداخت حقوق روی این دستگاه ثبت شد');
        else if (typeof ptfToast === 'function') ptfToast('حقوق ' + s.name + ' پرداخت و به‌عنوان تسویهٔ مطالبه ثبت شد', 'ok');
        ptfShareRender();
      }
    });
  };

  window.ptfShareLedger = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x.cd === cd; })[0]; if (!s) return;
    var rows = txAll().filter(function (x) { return x.shCd === cd; }).map(function (x) {
      var active = shareTxActive(x);
      var sign = !active ? '' : ((x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment' || x.type === 'call_due' || x.type === 'call_credit_use') ? '-' : '+');
      var typeLb = { salary: 'حقوق (مطالبه)', salary_payment: 'پرداخت حقوق', draw: 'برداشت/علی‌الحساب', advance: 'علی‌الحساب', debit: 'بدهی', credit: 'بستانکاری', profit: 'تقسیم سود', call_due: 'سهم فراخوان نقدینگی', call_pay: 'تأمین سهم فراخوان', call_over: 'مازاد تأمین (طلب از صندوق)', call_credit_use: 'تهاتر طلب با فراخوان', chair_in: 'تزریق شخصی رییس به صندوق', chair_out: 'تسویه طلب رییس از صندوق' }[x.type] || x.type;
      if (!active) typeLb += ' (باطل‌شده)';
      var nFiles = (x.files || []).length;
      var docs = '<button type="button" class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();ptfShareTxAttachOpen(\'' + ptfOnClickArg(x.cd) + '\')">📎 ' + (nFiles ? (nFiles + ' سند') : 'افزودن سند') + '</button>';
      return '<tr' + (!active ? ' style="opacity:.65"' : '') + '><td>' + escP(x.t || '') + '</td><td>' + escP(typeLb) + '</td><td style="direction:ltr;' + (!active ? 'text-decoration:line-through' : '') + '">' + sign + money(x.amt) + '</td><td>' + escP(x.desc || '') + '</td><td>' + docs + '</td></tr>';
    }).join('');
    var b = ptfShareholderBalance(cd);
    var oldLed = document.getElementById('shareLedgerDlg');
    if (oldLed) oldLed.remove();
    var html = '<div class="md-b" id="shareLedgerDlg" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px"><h3>گردش سهامدار — ' + escP(s.name) + '</h3><p style="font-size:13px;color:#475569">مانده لحظه‌ای: <b>' + money(Math.abs(b.net)) + ' ' + (b.net >= 0 ? 'بستانکار' : 'بدهکار') + '</b> | مطالبات تنخواه باز: ' + money(b.petty) + '</p><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>مبلغ</th><th>شرح</th><th>سند</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">گردشی ثبت نشده</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
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
