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
  var SH_KEY = 'ptf_crm_shareholders', TX_KEY = 'ptf_crm_sharetx', OPEX_KEY = 'ptf_crm_opex';

  function canShare() { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; }
  /* AUD-11 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md، تصمیم صریح کارفرما):
     قبلاً فقط admin/chairman بود؛ هاب مالی تب «سهامداران» را برای
     ceo/commercial هم قابل‌کلیک نشان می‌داد بدون محتوا. کارفرما تصریح
     کرد این دو نقش باید دسترسی کامل داشته باشند، هم‌راستا با
     ROLES.finance در rbac.js. */
  function shAll() { var a = getData(SH_KEY); return Array.isArray(a) ? a : []; }
  function shSave(a) { setData(SH_KEY, a || []); }
  function txAll() { var a = getData(TX_KEY); return Array.isArray(a) ? a : []; }
  function txSave(a) { setData(TX_KEY, a || []); }
  function oAll() { var a = getData(OPEX_KEY); return Array.isArray(a) ? a : []; }
  function oSave(a) { setData(OPEX_KEY, a || []); }
  function nm() { return (curSession() || {}).name || (curSession() || {}).user || ''; }
  function n(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function faMonthNow() { try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\s/g, '').replace('-', '/'); } catch (e) { return (typeof faDate === 'function' ? faDate().slice(0, 7) : ''); } }
  function normMonth(m) { return String(m || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/-/g, '/').replace(/\s/g, '').replace(/^(\d{4})\/(\d)$/, '$1/0$2'); }
  function shareYearLocked(month) {
    var y = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(month) : String(month || '').split('/')[0];
    if (!y) return false;
    if (typeof ptfFiscalYearLocked === 'function') return ptfFiscalYearLocked(y);
    return (getData('ptf_crm_fiscal_snapshots') || []).some(function (s) { return s && s.locked && String(s.year) === y; });
  }
  function activeShares() { return shAll().filter(function (s) { return s.active !== false; }); }
  function pctSum(exceptCd) { return activeShares().reduce(function (sum, s) { return sum + (s.cd === exceptCd ? 0 : (+s.pct || 0)); }, 0); }
  /* v33.7.0 BUG-FIX (حقوق ۱۳۰ → ۹۰): سهامدار موظف جدید در ماه جاری حقوقش ثبت نمی‌شد
     (syncSalaryTxForMonth فقط رکورد موجود را آپدیت می‌کرد و در ptfShareEdit برای
     سهامدار جدید اصلاً صدا زده نمی‌شد). این تابع «اطمینان از وجود» است:
     اگر tx حقوق ماه موجود نبود → ایجاد + هزینه حقوق؛ اگر بود و مبلغ فرق داشت → آپدیت.
     خروجی: {found, changed, created, removed, txCd} */
  function ensureSalaryTxForMonth(sh, month) {
    month = normMonth(month) || faMonthNow();
    var out = { found: false, changed: false, created: false, removed: false, txCd: '', opexCreated: false };
    if (!sh || sh.active === false) return out;
    var txs = txAll();
    var hit = txs.filter(function (x) { return x.type === 'salary' && x.shCd === sh.cd && x.month === month; })[0];
    /* v34.0.0-alpha (F4-7): اطمینان از وجود opex متناظر — اگر hit پیدا شد ولی ox
       پیدا نشد (مثلاً opex قبلاً حذف شده)، opex ایجاد می‌شود. قبلاً فقط
       در صورت تغییر مبلغ، opex آپدیت می‌شد و اگر ox نبود، چیزی ایجاد نمی‌شد
       → حقوق سهامدار در opex ثبت نمی‌شد و در محاسبات سال مالی لحاظ نمی‌شد. */
    function ensureOpex(cd) {
      var opx = oAll();
      var exists = opx.filter(function (o) { return o.shareTx === cd; })[0];
      if (!exists) {
        opx.unshift({ cd: genCode('OPX'), cat: 'حقوق و دستمزد', amt: +sh.salary || 0, month: month, desc: 'حقوق موظف سهامدار: ' + sh.name, t: faDateTime(), by: nm(), shareTx: cd, shareholderSalary: true });
        oSave(opx);
        out.opexCreated = true;
        return true;
      }
      return false;
    }
    if (sh.duty && (+sh.salary || 0) > 0) {
      if (hit) {
        out.found = true; out.txCd = hit.cd;
        if ((+hit.amt || 0) !== (+sh.salary || 0)) {
          hit.amt = +sh.salary || 0;
          hit.desc = 'حقوق موظف ماه ' + month;
          hit.updatedT = faDateTime(); hit.updatedBy = nm();
          txSave(txs);
          /* v34.0.0-alpha (F4-7): آپدیت opex اگر وجود داشت، یا ایجاد اگر نبود */
          var opxChg = oAll();
          var oxChg = opxChg.filter(function (o) { return o.shareTx === hit.cd; })[0];
          if (oxChg) {
            oxChg.amt = +sh.salary || 0; oxChg.month = month;
            oxChg.desc = 'حقوق موظف سهامدار: ' + sh.name;
            oxChg.updatedT = faDateTime(); oxChg.updatedBy = nm();
            oSave(opxChg);
          } else {
            ensureOpex(hit.cd);
          }
          out.changed = true;
        } else {
          /* v34.0.0-alpha (F4-7): مبلغ برابر — فقط مطمئن شو opex هست
             (اگر قبلاً حذف شده، دوباره ایجاد شود) */
          ensureOpex(hit.cd);
        }
        return out;
      }
      var tx = addTx('salary', sh, sh.salary, 'حقوق موظف ماه ' + month, { month: month });
      ensureOpex(tx.cd);
      out.created = true; out.txCd = tx.cd;
      return out;
    }
    /* غیرموظف/صفر شد → حذف حقوق ماه (اگر وجود داشت) */
    if (hit) {
      txs = txs.filter(function (x) { return x.cd !== hit.cd; });
      txSave(txs);
      var opx3 = oAll();
      opx3 = opx3.filter(function (o) { return o.shareTx !== hit.cd; });
      oSave(opx3);
      out.removed = true; out.txCd = hit.cd;
    }
    return out;
  }
  window.ptfShareEnsureSalary = ensureSalaryTxForMonth;

  /* v34.0.2-alpha (F4-7 تکمیلی): مهاجرت یک‌بارهٔ «حقوق سهامدار فاقد opex».
     قبل از فیکس F4-7، اگر هزینهٔ حقوق یک سهامدار از opex حذف می‌شد (یا هرگز
     ساخته نمی‌شد)، فراخوانی بعدی دیگر opex نمی‌ساخت → حقوق در «هزینه‌های جاری»
     و محاسبات سال مالی دیده نمی‌شد. فیکس کدی فقط برای ثبت‌های جدید کار می‌کند؛
     این تابع برای رکوردهای تاریخیِ ازقبل‌خراب‌شده، به‌ازای هر tx حقوق که opex
     متناظرش (shareTx) وجود ندارد یک opex می‌سازد.
     از داخل اپ (دکمهٔ «🛠 بازسازی حقوق سهامدار» در پنل هزینه‌های جاری) یا
     کنسول مرورگر قابل اجراست؛ خروجی: {created, skipped, totalOpex}. */
  window.ptfMigrateShareholderOpex = function () {
    var shs = shAll(), txs = txAll(), opx = oAll();
    var opxByShareTx = {};
    opx.forEach(function (o) { if (o.shareTx) opxByShareTx[o.shareTx] = o; });
    var created = 0, skipped = 0, errors = [];
    shs.filter(function (s) { return s && s.active !== false && s.duty && (+s.salary || 0) > 0; }).forEach(function (s) {
      txs.filter(function (x) { return x.type === 'salary' && x.shCd === s.cd; }).forEach(function (x) {
        if (opxByShareTx[x.cd]) { skipped++; return; }
        var newOpx = {
          cd: 'OPX-MIG-' + x.cd,
          cat: 'حقوق و دستمزد',
          amt: +x.amt || 0,
          month: x.month,
          desc: 'حقوق موظف سهامدار: ' + s.name + ' (مهاجرت F4-7)',
          t: x.t,
          by: x.by || 'migration-F4-7',
          shareTx: x.cd,
          shareholderSalary: true,
          migrated: true
        };
        opx.unshift(newOpx);
        opxByShareTx[x.cd] = newOpx;
        created++;
      });
    });
    if (created > 0) {
      oSave(opx);
      if (typeof ptfOpexRender === 'function') { try { ptfOpexRender(); } catch (e) {} }
      if (typeof ptfShareRender === 'function') { try { ptfShareRender(); } catch (e) {} }
    }
    return { created: created, skipped: skipped, totalOpex: opx.length, errors: errors };
  };

  function syncSalaryTxForMonth(sh, month) {
    month = normMonth(month) || faMonthNow();
    var txs = txAll();
    var hit = txs.filter(function (x) { return x.type === 'salary' && x.shCd === sh.cd && x.month === month; })[0];
    if (!hit) return { found: false, changed: false };
    var newAmt = +sh.salary || 0;
    if ((+hit.amt || 0) === newAmt) return { found: true, changed: false, txCd: hit.cd };
    hit.amt = newAmt;
    hit.desc = 'حقوق موظف ماه ' + month;
    hit.updatedT = faDateTime();
    hit.updatedBy = nm();
    txSave(txs);
    var opx = oAll();
    var ox = opx.filter(function (o) { return o.shareTx === hit.cd; })[0];
    if (ox) {
      ox.amt = newAmt;
      ox.month = month;
      ox.desc = 'حقوق موظف سهامدار: ' + sh.name;
      ox.updatedT = faDateTime();
      ox.updatedBy = nm();
      oSave(opx);
    }
    return { found: true, changed: true, txCd: hit.cd };
  }

  window.ptfShareholderBalance = function (cd) {
    var s = shAll().filter(function (x) { return x.cd === cd; })[0];
    var ledger = txAll().filter(function (x) { return x.shCd === cd; }).reduce(function (a, x) {
      if (x.type === 'salary' || x.type === 'credit' || x.type === 'profit') a.credit += (+x.amt || 0);
      else if (x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment') a.debit += (+x.amt || 0);
      return a;
    }, { credit: 0, debit: 0 });
    var petty = 0;
    try {
      if (s && typeof ptfPettyPendingByUser === 'function') petty = +(ptfPettyPendingByUser()[s.name] || 0);
      else if (s) petty = (getData('ptf_crm_petty') || []).filter(function (p) { return p.by === s.name && p.st !== 'settled'; }).reduce(function (z, p) { return z + (+p.amt || 0); }, 0);
    } catch (e) {}
    ledger.petty = petty;
    ledger.net = ledger.credit + petty - ledger.debit;
    return ledger;
  };

  function addTx(type, sh, amt, desc, extra) {
    var rec = Object.assign({ cd: genCode('SHT'), shCd: sh.cd, shName: sh.name, type: type, amt: +amt || 0, desc: desc || '', t: faDateTime(), month: faMonthNow(), by: nm() }, extra || {});
    var a = txAll(); a.unshift(rec); txSave(a); return rec;
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
      return '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:10px 12px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div style="font-size:13px"><b>' + escP(s.name) + '</b> <span class="bd" style="background:#eef2ff;color:#3730a3">' + (+s.pct || 0) + '٪</span> ' + (s.duty ? '<span class="bd b-st3">موظف</span>' : '') + (s.active === false ? ' <span class="bd" style="background:#fee2e2;color:#b91c1c">غیرفعال</span>' : '') +
        '<br><small style="color:#64748b">حقوق موظف: ' + money(s.salary || 0) + ' | مطالبات تنخواه: ' + money(b.petty) + '</small><br><b style="color:' + cls + '">مانده: ' + money(Math.abs(b.net)) + ' — ' + st + '</b></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" style="padding:5px 10px;font-size:12px" onclick="ptfShareEdit(\'' + s.cd + '\')">ویرایش</button>' + (s.duty && (+s.salary || 0) > 0 ? '<button class="bt" style="padding:5px 10px;font-size:12px;background:#059669" onclick="ptfSharePaySalary(\'' + s.cd + '\')">💳 پرداخت حقوق</button>' : '') + '<button class="bt" style="padding:5px 10px;font-size:12px;background:#7c3aed" onclick="ptfShareDraw(\'' + s.cd + '\')">برداشت/علی‌الحساب</button><button class="bt bt-o" style="padding:5px 10px;font-size:12px" onclick="ptfShareLedger(\'' + s.cd + '\')">گردش</button></div></div></div>';
    }).join('');
    var warn = Math.round(totalPct * 100) / 100 === 100 ? '<span style="color:#059669">جمع سهام فعال: ۱۰۰٪ ✅</span>' : '<span style="color:#dc2626">جمع سهام فعال: ' + totalPct + '٪ — باید به ۱۰۰٪ برسد</span>';
    el.innerHTML = '<div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:16px;padding:12px 14px;margin:12px 0">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div><b style="font-size:14px;color:#6d28d9">👥 سهامداران، حقوق موظف و علی‌الحساب</b><br><small>' + warn + '</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><input value="' + escP(month) + '" onchange="window._shareMonth=this.value.trim();ptfShareRender()" style="width:92px;padding:7px;border:1px solid var(--brd);border-radius:9px;direction:ltr"><button class="bt" style="font-size:12px" onclick="ptfShareEdit()">+ سهامدار</button><button class="bt" style="font-size:12px;background:#059669" onclick="ptfShareApplySalary(document.querySelector(\'#shareBox input\').value)">ثبت حقوق ماه</button></div></div>' +
      '<div style="margin-top:10px">' + (rows || '<div style="text-align:center;color:#94a3b8;padding:18px">سهامداری ثبت نشده</div>') + '</div></div>';
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
        var prevDuty = !!rec.duty;
        rec.name = v.name; rec.pct = pct; rec.duty = v.duty === 'yes'; rec.salary = rec.duty ? n(v.salary) : 0; rec.active = v.active !== 'no'; rec.updatedBy = nm(); rec.updatedT = faDateTime();
        if (old) a = a.map(function (x) { return x.cd === rec.cd ? rec : x; }); else a.unshift(rec);
        shSave(a);
        /* v33.7.0 BUG-FIX (ریشهٔ ۱۳۰→۹۰): برای سهامدار جدید هم حقوق ماه جاری همان‌لحظه
           ایجاد می‌شود؛ برای تغییر حقوق/موظف → آپدیت؛ برای غیرموظف‌شدن → حذف از ماه جاری. */
        var sync = ensureSalaryTxForMonth(rec, month);
        audit('سهامداران', (old ? 'ویرایش ' : 'ثبت ') + rec.name + ' — ' + rec.pct + '٪' + (old && prevSalary !== rec.salary ? ' | حقوق: ' + prevSalary + ' → ' + rec.salary : ''), rec.cd);
        if (sync.changed && typeof audit === 'function') audit('سهامداران', 'به‌روزرسانی خودکار حقوق موظف ماه ' + month + ' برای ' + rec.name + ' — ' + money(rec.salary), sync.txCd || rec.cd);
        if (sync.created && typeof audit === 'function') audit('سهامداران', 'ثبت خودکار حقوق موظف ماه ' + month + ' برای سهامدار جدید ' + rec.name + ' — ' + money(rec.salary), sync.txCd || rec.cd);
        if (sync.removed && typeof audit === 'function') audit('سهامداران', 'حذف حقوق موظف ماه ' + month + ' — ' + rec.name + ' دیگر موظف نیست', sync.txCd || rec.cd);
        if ((sync.changed || sync.created) && typeof ptfToast === 'function') ptfToast('حقوق ماه ' + month + ' برای ' + rec.name + ' همزمان ثبت/به‌روزرسانی شد', 'ok');
        ptfShareRender();
        if (typeof ptfOpexRender === 'function') { try { ptfOpexRender(); } catch (e) {} }
      }
    });
  };

  window.ptfShareApplySalary = function (month) {
    if (!canShare()) return;
    month = normMonth(month) || faMonthNow();
    if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت حقوق در آن سال مجاز نیست.'); return; }
    var done = 0, skipped = 0, updated = 0;
    activeShares().filter(function (s) { return s.duty && (+s.salary || 0) > 0; }).forEach(function (s) {
      var sync = ensureSalaryTxForMonth(s, month);
      if (sync.created) done++;
      else if (sync.changed) updated++;
      else skipped++;
    });
    audit('سهامداران', 'ثبت/به‌روزرسانی حقوق موظف ماه ' + month + ' — جدید: ' + done + (updated ? ' / اصلاح‌شده: ' + updated : '') + (skipped ? ' / بدون تغییر: ' + skipped : ''), month);
    if (typeof ptfToast === 'function') {
      if (done || updated) ptfToast('حقوق ماه ' + month + ' ثبت/به‌روزرسانی شد', 'ok');
      else ptfToast('برای این ماه تغییری لازم نبود', 'warn');
    }
    if (typeof ptfOpexRender === 'function') { try { ptfOpexRender(); } catch (e) {} }
    ptfShareRender();
  };

  window.ptfShareDraw = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x.cd === cd; })[0]; if (!s) return;
    ptfDialog({ title: 'برداشت / علی‌الحساب — ' + s.name, fields: [
      { id: 'amt', label: 'مبلغ برداشت', type: 'number', required: true, dir: 'ltr' },
      { id: 'desc', label: 'شرح/شماره سند', required: true }
    ], okText: 'ثبت برداشت', onOk: function (v) {
      var month = normMonth(window._shareMonth || faMonthNow()) || faMonthNow();
      if (shareYearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت برداشت در آن سال مجاز نیست.'); return; }
      var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      var tx = addTx('draw', s, amt, v.desc, {});
      audit('سهامداران', 'ثبت برداشت/علی‌الحساب ' + money(amt) + ' برای ' + s.name, tx.cd);
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
    ptfDialog({
      title: '💳 پرداخت حقوق — ' + s.name,
      body: 'حقوق ماهانهٔ موظف این سهامدار: <b>' + money(s.salary) + '</b> ریال.<br><small>این مبلغ به‌عنوان «پرداخت مطالبهٔ حقوق» ثبت می‌شود (نه علی‌الحساب سود) و در گردش حساب سهامدار اثر می‌گذارد.</small>',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی (ریال) *', type: 'number', value: String(+s.salary || 0), required: true, dir: 'ltr' },
        { id: 'desc', label: 'شرح/شماره سند', value: 'پرداخت حقوق موظف ' + month, required: true }
      ],
      okText: 'ثبت پرداخت حقوق',
      onOk: function (v) {
        var amt = n(v.amt); if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
        var tx = addTx('salary_payment', s, amt, String(v.desc || '').trim(), { month: month, salaryMonth: month });
        audit('سهامداران', 'پرداخت حقوق ' + money(amt) + ' برای ' + s.name + ' (مطالبهٔ حقوق — نه علی‌الحساب سود)', tx.cd);
        if (typeof ptfToast === 'function') ptfToast('حقوق ' + s.name + ' پرداخت و به‌عنوان تسویهٔ مطالبه ثبت شد', 'ok');
        ptfShareRender();
      }
    });
  };

  window.ptfShareLedger = function (cd) {
    if (!canShare()) return;
    var s = shAll().filter(function (x) { return x.cd === cd; })[0]; if (!s) return;
    var rows = txAll().filter(function (x) { return x.shCd === cd; }).map(function (x) {
      var sign = (x.type === 'draw' || x.type === 'advance' || x.type === 'debit' || x.type === 'salary_payment') ? '-' : '+';
      var typeLb = { salary: 'حقوق (مطالبه)', salary_payment: 'پرداخت حقوق', draw: 'برداشت/علی‌الحساب', advance: 'علی‌الحساب', debit: 'بدهی', credit: 'بستانکاری', profit: 'تقسیم سود' }[x.type] || x.type;
      return '<tr><td>' + escP(x.t || '') + '</td><td>' + escP(typeLb) + '</td><td style="direction:ltr">' + sign + money(x.amt) + '</td><td>' + escP(x.desc || '') + '</td></tr>';
    }).join('');
    var b = ptfShareholderBalance(cd);
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px"><h3>گردش سهامدار — ' + escP(s.name) + '</h3><p style="font-size:13px;color:#475569">مانده لحظه‌ای: <b>' + money(Math.abs(b.net)) + ' ' + (b.net >= 0 ? 'بستانکار' : 'بدهکار') + '</b> | مطالبات تنخواه باز: ' + money(b.petty) + '</p><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">گردشی ثبت نشده</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
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
