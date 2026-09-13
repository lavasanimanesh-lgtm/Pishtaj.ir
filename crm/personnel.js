/* =====================================================================
   PTF CRM — personnel.js
   پرسنل: حقوق ماهانه (هزینهٔ جاری + مطالبه) و پورسانت در حساب مطالبات هر شخص
   - پرسنل در تب مستقل خود (هاب مالی) ثبت/ویرایش می‌شوند؛ سهامداران در تب خودشان.
   - انحصار متقابل: سهامدار نمی‌تواند نقش پرسنل بگیرد؛ ثبت سهامدار به‌عنوان پرسنل خطا می‌دهد.
   - حقوق ثبت‌شده = هزینهٔ جاری (OPEX با فلگ personnelSalary برای جلوگیری از دوباره‌شماری)
     + مطالبهٔ پرسنل (ptf_crm_personnel_tx نوع salary).
   - پرداخت حقوق = فقط تسویهٔ مطالبه + خروج بانک (هزینهٔ جدید نمی‌سازد).
   - پورسانتِ همان شخص (از ptf_crm_commission_records) به مجموع مطالباتش اضافه می‌شود؛
     پرداخت پورسانت همچنان از تب «پورسانت فروش» انجام می‌شود و این‌جا فقط مانده دیده می‌شود.
   ===================================================================== */
(function () {
  'use strict';
  var P_KEY = 'ptf_crm_personnel';
  var TX_KEY = 'ptf_crm_personnel_tx';
  var OPEX_KEY = 'ptf_crm_opex';

  function esc(v) {
    if (typeof escP === 'function') return escP(v == null ? '' : v);
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) {
    if (typeof ptfNum === 'function') return +ptfNum(v) || 0;
    return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0;
  }
  function money(v) { return Math.round(num(v)).toLocaleString('fa-IR') + ' ریال'; }
  function data(k) { try { var v = typeof getData === 'function' ? getData(k) : null; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function nmNorm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function canPrs() { try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(String(curRole() || '').toLowerCase()) > -1; } catch (e) { return false; } }
  function me() { try { return (curSession() || {}).name || (curSession() || {}).user || ''; } catch (e) { return ''; } }
  function faMonthNow() {
    try { if (typeof ptfFaMonthNow === 'function' && ptfFaMonthNow()) return String(ptfFaMonthNow()); } catch (e) {}
    try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\s/g, '').replace('-', '/'); } catch (e2) { return ''; }
  }
  function normMonth(m) {
    m = String(m || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/-/g, '/').replace(/\s/g, '');
    return m.replace(/^(\d{4})\/(\d)$/, '$1/0$2');
  }
  function monthValid(m) { return /^(13|14)\d{2}\/(0[1-9]|1[0-2])$/.test(m); }
  function toIso(v) {
    var s = String(v || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var iso = s.match(/(19|20)\d{2}-\d{2}-\d{2}/); if (iso) return iso[0];
    var j = s.match(/(1[34]\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (j && typeof ptfJToISO === 'function') { try { return ptfJToISO(j[1] + '/' + j[2] + '/' + j[3]) || ''; } catch (e) {} }
    return '';
  }
  function personnelAll() { return data(P_KEY); }
  function personnelSave(a) { return setData(P_KEY, a || []); }
  function txAll() { return data(TX_KEY); }
  function txSave(a) { return setData(TX_KEY, a || []); }
  function txActive(t) {
    if (!t) return false;
    var st = String(t.status || t.st || '').toLowerCase();
    return ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'].indexOf(st) < 0 && !t.voided && !t.deleted;
  }
  function personnelOf(userId) { return personnelAll().filter(function (p) { return p && p.userId === userId; })[0] || null; }
  function userRecord(id) { return data('ptf_crm_users').filter(function (u) { return u && (u.username || u.user) === id; })[0] || null; }
  function userNameOf(id) { var u = userRecord(id); return u ? (u.name || u.nm || id) : id; }
  function yearLocked(month) {
    var y = String(month || '').split('/')[0];
    if (!y) return false;
    if (typeof ptfFiscalYearLocked === 'function') return !!ptfFiscalYearLocked(y);
    return (data('ptf_crm_fiscal_snapshots') || []).some(function (s) { return s && s.locked && String(s.year) === y; });
  }
  function activeShareholderNames() {
    var set = {};
    data('ptf_crm_shareholders').forEach(function (s) { if (s && s.active !== false) set[nmNorm(s.name)] = true; });
    return set;
  }
  function isShareholderName(name) { return activeShareholderNames()[nmNorm(name)] === true; }

  /* پورسانتِ شخص: رکوردهای approval/payment با user همان username یا (legacy) نام شخص. */
  function commissionMatches(r, userId, name) {
    var u = String(r && r.user || '');
    if (u === String(userId)) return true;
    var nm = nmNorm(name || '');
    if (nm && (nmNorm(r && r.userLabel) === nm || nmNorm(u) === nm)) return true;
    return false;
  }
  function commissionRemainFor(userId, name) {
    var recs = data('ptf_crm_commission_records');
    var paidBy = {};
    recs.forEach(function (r) {
      if (r && r.kind === 'payment' && r.status === 'posted' && commissionMatches(r, userId, name)) paidBy[r.approvalCd] = (paidBy[r.approvalCd] || 0) + num(r.amount);
    });
    var total = 0;
    recs.forEach(function (r) {
      if (r && r.kind === 'approval' && r.status === 'approved' && commissionMatches(r, userId, name)) total += Math.max(0, num(r.amount) - (paidBy[r.cd] || 0));
    });
    return total;
  }

  window.ptfPersonnelBalance = function (userId) {
    var p = personnelOf(userId);
    var name = p ? p.name : userNameOf(userId);
    var claims = 0, payments = 0;
    txAll().forEach(function (t) {
      if (!t || t.userId !== userId || !txActive(t)) return;
      if (t.type === 'salary') claims += num(t.amt);
      else if (t.type === 'payment' || t.type === 'pay' || t.type === 'advance' || t.type === 'debit') payments += num(t.amt);
    });
    var commission = commissionRemainFor(userId, name);
    return { salaryClaims: claims, commissionClaims: commission, payments: payments, net: claims + commission - payments };
  };
  window.ptfPersonnelSalaryRemain = function (userId) {
    var b = window.ptfPersonnelBalance(userId);
    return Math.max(0, b.salaryClaims - b.payments);
  };

  function userOptions(selected) {
    var users = data('ptf_crm_users').filter(function (u) { return u && (u.username || u.user); });
    return '<option value="">— انتخاب کاربر —</option>' + users.map(function (u) {
      var id = u.username || u.user;
      var nm = u.name || u.nm || id;
      var rl = u.roleId || u.role || '';
      return '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(nm) + (rl ? ' (' + esc(rl) + ')' : '') + '</option>';
    }).join('');
  }

  window.ptfPersonnelEdit = function (userId) {
    if (!canPrs()) { alert('⛔ پرسنل فقط برای مدیران ارشد است.'); return; }
    var old = userId ? personnelOf(userId) : null;
    ptfDialog({
      title: old ? '✏️ ویرایش پرسنل' : '➕ ثبت پرسنل',
      body: 'پرسنل از میان کاربران CRM انتخاب می‌شوند. <b>سهامدار نمی‌تواند نقش پرسنل بگیرد</b> — در صورت انتخاب سهامدار، ثبت خطا می‌دهد.',
      fields: [
        { id: 'user', label: 'کاربر *', type: 'select', optionsHtml: userOptions(old ? old.userId : ''), required: true },
        { id: 'duty', label: 'موظف (حقوق ماهانه دارد؟)', type: 'select', value: old && old.duty ? 'yes' : 'no', options: [{ v: 'no', lb: 'خیر' }, { v: 'yes', lb: 'بله' }] },
        { id: 'salary', label: 'حقوق ماهانه (ریال)', type: 'number', value: old && old.salary ? (+old.salary).toLocaleString('en-US') : '', dir: 'ltr', nohint: true },
        { id: 'eligibilitySince', label: 'ماه شروع احراز حقوق (YYYY/MM — خالی = ماه جاری هنگام فعال‌شدن موظفی)', type: 'text', value: old && old.eligibilitySince ? old.eligibilitySince : '', dir: 'ltr', placeholder: '1405/06' },
        { id: 'salaryOfficial', label: 'نوع سند حقوق', type: 'select', value: old && old.salaryOfficial === true ? 'yes' : (old && old.salaryOfficial === false ? 'no' : ''), options: [{ v: '', lb: 'تعیین نشده' }, { v: 'yes', lb: 'رسمی / قابل قبول ممیز' }, { v: 'no', lb: 'غیررسمی' }] },
        { id: 'active', label: 'وضعیت', type: 'select', value: old && old.active === false ? 'no' : 'yes', options: [{ v: 'yes', lb: 'فعال' }, { v: 'no', lb: 'غیرفعال' }] }
      ],
      okText: 'ذخیره',
      onOk: function (v) {
        var uid = String(v.user || '').trim();
        if (!uid) { alert('کاربر را انتخاب کنید'); return; }
        var u = userRecord(uid);
        if (!u) { alert('کاربر انتخاب‌شده در CRM یافت نشد.'); return; }
        var nm = u.name || u.nm || uid;
        if (isShareholderName(nm)) {
          alert('⛔ «' + nm + '» سهامدار است و نمی‌تواند نقش پرسنل بگیرد.\nسهامداران فقط در تب «سهامداران» مدیریت می‌شوند و ثبت آن‌ها به‌عنوان پرسنل مجاز نیست.');
          return;
        }
        var month = normMonth(window._personnelMonth || faMonthNow()) || faMonthNow();
        if (yearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت/ویرایش پرسنل در آن سال مجاز نیست.'); return; }
        var duty = v.duty === 'yes';
        var salary = duty ? num(v.salary) : 0;
        if (duty && !(salary > 0)) { alert('برای پرسنل موظف، حقوق ماهانهٔ مثبت الزامی است.'); return; }
        var elig = normMonth(v.eligibilitySince);
        if (v.eligibilitySince && !monthValid(elig)) { alert('ماه شروع احراز نامعتبر است؛ نمونه: 1405/06'); return; }
        var official = v.salaryOfficial === 'yes' ? true : (v.salaryOfficial === 'no' ? false : undefined);
        var all = personnelAll();
        var rec = old ? old : all.filter(function (x) { return x && x.userId === uid; })[0];
        if (!rec) { rec = { cd: genCode('PRS'), userId: uid, createdBy: me(), createdT: faDateTime() }; all.unshift(rec); }
        var wasDuty = !!rec.duty;
        rec.userId = uid; rec.name = nm; rec.roleId = u.roleId || u.role || ''; rec.duty = duty; rec.salary = duty ? salary : 0; rec.active = v.active !== 'no';
        if (duty && elig) rec.eligibilitySince = elig;
        else if (duty && !wasDuty && !rec.eligibilitySince) rec.eligibilitySince = month;
        else if (!duty) delete rec.eligibilitySince;
        if (official === undefined) delete rec.salaryOfficial; else rec.salaryOfficial = official;
        rec.updatedBy = me(); rec.updatedT = faDateTime();
        personnelSave(all);
        try { audit('پرسنل', (old ? 'ویرایش ' : 'ثبت ') + nm + (duty ? ' — حقوق: ' + money(salary) : ''), rec.cd); } catch (e) {}
        window.ptfPersonnelRefresh();
      }
    });
  };

  window.ptfPersonnelRegisterSalary = function (userId) {
    if (!canPrs()) { alert('⛔ فقط مدیران ارشد'); return; }
    var p = personnelOf(userId); if (!p) { alert('پرسنل یافت نشد'); return; }
    if (p.active === false || !p.duty || !(num(p.salary) > 0)) { alert('این پرسنل موظف نیست یا حقوقی برایش تعریف نشده است.'); return; }
    var defMonth = normMonth(window._personnelMonth || faMonthNow()) || faMonthNow();
    ptfDialog({
      title: '📅 ثبت حقوق ماهانه — ' + p.name,
      body: 'مبلغ از پروفایل پرسنل خوانده می‌شود: <b>' + money(p.salary) + '</b> ریال.<br><small>این ثبت فقط هزینهٔ جاری و مطالبهٔ پرسنل ایجاد می‌کند و خروج خزانه ندارد؛ پرداخت واقعی بعداً با «پرداخت حقوق» ثبت می‌شود.</small>',
      fields: [{ id: 'month', label: 'ماه حقوق (YYYY/MM) *', type: 'text', value: defMonth, required: true, dir: 'ltr', placeholder: '1405/06' }],
      okText: 'ثبت حقوق',
      onOk: function (v) {
        var month = normMonth(v.month);
        if (!monthValid(month)) { alert('ماه نامعتبر است؛ نمونه: 1405/06'); return; }
        if (yearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ثبت حقوق در آن سال مجاز نیست.'); return; }
        var fresh = personnelOf(userId) || p;
        if (fresh.active === false || !fresh.duty || !(num(fresh.salary) > 0)) { alert('وضعیت پرسنل تغییر کرده است؛ دوباره بررسی کنید.'); return; }
        var key = 'psalary:' + userId + ':' + month;
        var dupOpex = data(OPEX_KEY).some(function (o) { return o && o.recurringKey === key && String(o.status || '').toLowerCase() !== 'void' && String(o.st || '').toLowerCase() !== 'void' && !o.voided && !o.deleted; });
        var dupTx = txAll().some(function (t) { return t && txActive(t) && t.userId === userId && t.type === 'salary' && t.month === month; });
        if (dupOpex || dupTx) { alert('حقوق ' + p.name + ' برای ماه ' + month + ' قبلاً ثبت شده است.'); return; }
        var amt = Math.round(num(fresh.salary));
        var opx = data(OPEX_KEY);
        var o = { cd: genCode('OPX'), cat: 'حقوق و دستمزد', amt: amt, month: month, t: faDateTime(), by: me(), desc: 'حقوق پرسنل — ' + fresh.name + ' / ' + month, isOfficial: fresh.salaryOfficial, personnelSalary: true, personnelUserId: userId, recurringKey: key, status: 'approved' };
        opx.unshift(o); setData(OPEX_KEY, opx);
        var txs = txAll();
        txs.unshift({ cd: genCode('PRT'), userId: userId, name: fresh.name, type: 'salary', amt: amt, month: month, desc: 'حقوق ماهانه ' + fresh.name + ' — ' + month, t: faDateTime(), by: me(), opexCd: o.cd });
        if (txSave(txs) === false) { alert('⛔ ثبت حقوق روی حافظهٔ پایدار ذخیره نشد.'); return; }
        try { audit('پرسنل', 'ثبت حقوق ' + fresh.name + ' — ' + money(amt) + ' (' + month + ')', o.cd); } catch (e) {}
        if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: TX_KEY, id: key, label: 'ثبت حقوق پرسنل' });
        if (typeof ptfToast === 'function') ptfToast('✅ حقوق ثبت شد (هزینه + مطالبه؛ بدون خروج خزانه)', 'ok');
        window.ptfPersonnelRefresh();
      }
    });
  };

  window.ptfPersonnelPaySalary = function (userId) {
    if (!canPrs()) { alert('⛔ فقط مدیران ارشد'); return; }
    var p = personnelOf(userId); if (!p) { alert('پرسنل یافت نشد'); return; }
    var remain = window.ptfPersonnelSalaryRemain(userId);
    if (!(remain > 0)) { alert('حقوقی برای پرداخت باقی نمانده است.'); return; }
    var month = normMonth(window._personnelMonth || faMonthNow()) || faMonthNow();
    if (yearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ پرداخت حقوق مجاز نیست.'); return; }
    ptfDialog({
      title: '💳 پرداخت حقوق از بانک — ' + p.name,
      body: 'بدهی حقوق باقی‌مانده: <b>' + money(remain) + '</b><br><small>این پرداخت هزینهٔ جدید نمی‌سازد؛ فقط مطالبهٔ حقوق را تسویه و خروج بانک را ثبت می‌کند.</small>',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی (ریال)', type: 'number', value: String(remain), dir: 'ltr', required: true },
        { id: 'doc', label: 'شماره حواله / سند بانکی', required: true },
        { id: 'date', label: 'تاریخ پرداخت (شمسی)', datePicker: true, value: (typeof faDate === 'function' ? faDate() : ''), required: true },
        { id: 'files', label: 'رسید / سند تسویه (اختیاری)', type: 'upload', uploadFolder: 'personnel-tx/' + p.userId }
      ],
      okText: 'ثبت پرداخت بانکی',
      onOk: function (v) {
        var amt = num(v.amt);
        if (!(amt > 0)) { alert('مبلغ نامعتبر است'); return; }
        var freshRemain = window.ptfPersonnelSalaryRemain(userId);
        if (amt > freshRemain) { alert('مبلغ از ماندهٔ حقوق (' + money(freshRemain) + ') بیشتر است.'); return; }
        var doc = String(v.doc || '').trim();
        if (!doc) { alert('شماره سند بانکی الزامی است.'); return; }
        var txs = txAll();
        var tx = { cd: genCode('PRT'), userId: userId, name: p.name, type: 'payment', amt: Math.round(amt), month: month, dateFa: v.date, dateISO: toIso(v.date), doc: doc, files: (v.files || []).slice(), method: 'bank', status: 'posted', t: faDateTime(), by: me() };
        txs.unshift(tx);
        if (txSave(txs) === false) { alert('⛔ پرداخت روی حافظهٔ پایدار ذخیره نشد.'); return; }
        try { audit('پرسنل', 'پرداخت بانکی حقوق ' + p.name + ' — ' + money(amt) + ' / ' + doc, tx.cd); } catch (e) {}
        if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: TX_KEY, id: tx.cd, label: 'پرداخت حقوق پرسنل' });
        window.ptfPersonnelRefresh();
      }
    });
  };

  /* ابطال حسابرسی‌پذیر یک ردیف گردش پرسنل (حذف فیزیکی نیست؛ tombstone + دلیل صریح). */
  window.ptfPersonnelTxVoid = function (cd) {
    if (!canPrs()) { alert('⛔ فقط مدیران ارشد'); return; }
    var txs = txAll();
    var tx = txs.filter(function (x) { return x && x.cd === cd; })[0];
    if (!tx) { alert('ردیف گردش یافت نشد'); return; }
    if (!txActive(tx)) { alert('این ردیف قبلاً باطل شده است.'); return; }
    var reason = '';
    try { reason = (prompt('دلیل ابطال این ردیف گردش را وارد کنید (برای ردپای حسابرسی الزامی است):', '') || '').trim(); } catch (eP) {}
    if (!reason) { alert('ثبت دلیل ابطال الزامی است.'); return; }
    if (!confirm('این ردیف حذف فیزیکی نمی‌شود؛ به‌صورت سند ابطال پایدار ثبت می‌شود.' + (tx.type === 'salary' ? '\nهزینهٔ حقوقِ پیوندخورده با همین ردیف نیز باطل می‌شود.' : '') + '\nادامه می‌دهید؟')) return;
    var month = normMonth(tx.month || tx.dateFa || '') || faMonthNow();
    if (yearLocked(month)) { alert('🔒 سال مالی ' + String(month).split('/')[0] + ' قفل است؛ ابطال در سال قفل‌شده مجاز نیست.'); return; }
    tx.status = 'void'; tx.st = 'void'; tx.voided = true; tx.deleted = true; tx.voidReason = reason; tx.voidedAt = faDateTime(); tx.voidedBy = me();
    txSave(txs);
    if (tx.type === 'salary' && tx.opexCd) {
      var opx = data(OPEX_KEY);
      var o = opx.filter(function (x) { return x && x.cd === tx.opexCd; })[0];
      if (o) { o.status = 'void'; o.st = 'void'; o.voided = true; o.deleted = true; o.voidReason = reason; setData(OPEX_KEY, opx); }
    }
    try { audit('پرسنل', 'ابطال ردیف گردش ' + tx.cd + ' — دلیل: ' + reason, tx.cd); } catch (e) {}
    if (typeof ptfToast === 'function') ptfToast('✅ ردیف گردش باطل شد', 'ok');
    window.ptfPersonnelRefresh();
    window.ptfPersonnelLedger(tx.userId);
  };

  window.ptfPersonnelLedger = function (userId) {
    if (!canPrs()) return;
    var p = personnelOf(userId);
    var name = p ? p.name : userNameOf(userId);
    var rows = txAll().filter(function (x) { return x && x.userId === userId; }).map(function (x) {
      var active = txActive(x);
      var sign = !active ? '' : ((x.type === 'payment' || x.type === 'pay' || x.type === 'advance' || x.type === 'debit') ? '-' : '+');
      var typeLb = { salary: 'حقوق (مطالبه)', payment: 'پرداخت حقوق', pay: 'پرداخت حقوق', advance: 'علی‌الحساب', debit: 'بدهی' }[x.type] || x.type;
      if (!active) typeLb += ' (باطل‌شده)';
      var voidBtn = active ? '<button type="button" class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" title="ابطال این ردیف گردش (حسابرسی‌پذیر)" onclick="event.stopPropagation();ptfPersonnelTxVoid(\'' + ptfOnClickArg(x.cd) + '\')">ابطال</button>' : '';
      return '<tr' + (!active ? ' style="opacity:.65"' : '') + '><td>' + esc(x.t || '') + '</td><td>' + esc(typeLb) + '</td><td style="direction:ltr;' + (!active ? 'text-decoration:line-through' : '') + '">' + sign + money(x.amt) + '</td><td>' + esc(x.desc || x.doc || '') + '</td><td>' + voidBtn + '</td></tr>';
    }).join('');
    var b = window.ptfPersonnelBalance(userId);
    var oldLed = document.getElementById('personnelLedgerDlg');
    if (oldLed) oldLed.remove();
    var html = '<div class="md-b" id="personnelLedgerDlg" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px"><h3>گردش پرسنل — ' + esc(name) + '</h3>' +
      '<p style="font-size:13px;color:#475569">حقوق (مطالبه): ' + money(b.salaryClaims) + ' | پورسانت مانده: ' + money(b.commissionClaims) + ' | پرداخت‌ها: ' + money(b.payments) + ' | <b>ماندهٔ کل مطالبات: ' + money(Math.abs(b.net)) + ' ' + (b.net >= 0 ? 'بستانکار' : 'بدهکار') + '</b></p>' +
      '<div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>مبلغ</th><th>شرح</th><th>عملیات</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">گردشی ثبت نشده</td></tr>') + '</tbody></table></div>' +
      '<div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };

  /* کاربرانی که پورسانت دارند ولی هنوز به‌عنوان پرسنل ثبت نشده‌اند (فقط اطلاع‌رسانی). */
  function unregisteredCommissionOwners() {
    var out = {};
    data('ptf_crm_commission_records').forEach(function (r) {
      if (!r || r.kind !== 'approval' || r.status !== 'approved') return;
      var uid = String(r.user || '');
      if (!uid) return;
      var nm = r.userLabel || uid;
      if (!personnelOf(uid) && !isShareholderName(nm)) out[uid] = nm;
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  }

  function personnelCard(p) {
    var b = window.ptfPersonnelBalance(p.userId);
    var cls = b.net >= 0 ? '#059669' : '#dc2626';
    var st = b.net >= 0 ? 'بستانکار از شرکت' : 'بدهکار به شرکت';
    var inactive = p.active === false ? ' <span class="bd" style="background:#fee2e2;color:#b91c1c">غیرفعال</span>' : '';
    var duty = p.duty ? '<span class="bd b-st3">موظف</span>' : '';
    return '<div class="personnel-card">' +
      '<div class="personnel-card-head"><div class="personnel-copy"><b>' + esc(p.name) + '</b> ' + duty + inactive +
      (p.roleId ? ' <span class="bd" style="background:#eef2ff;color:#3730a3">' + esc(p.roleId) + '</span>' : '') +
      '<br><small style="color:#64748b">حقوق موظف: ' + money(p.salary || 0) + (p.eligibilitySince ? ' | از ' + esc(p.eligibilitySince) : '') + '</small>' +
      '<br><small style="color:#64748b">حقوق (مطالبه): ' + money(b.salaryClaims) + ' | پورسانت مانده: ' + money(b.commissionClaims) + ' | پرداخت‌ها: ' + money(b.payments) + '</small>' +
      '<br><b style="color:' + cls + '">مجموع مطالبات: ' + money(Math.abs(b.net)) + ' — ' + st + '</b></div>' +
      '<div class="personnel-actions" role="group" aria-label="عملیات پرسنل ' + esc(p.name) + '">' +
      '<button type="button" class="bt bt-o" onclick="ptfPersonnelEdit(\'' + ptfOnClickArg(p.userId) + '\')">✏️ ویرایش</button>' +
      (p.duty && num(p.salary) > 0 ? '<button type="button" class="bt" onclick="ptfPersonnelRegisterSalary(\'' + ptfOnClickArg(p.userId) + '\')">📅 ثبت حقوق</button>' : '') +
      (p.duty && num(p.salary) > 0 ? '<button type="button" class="bt bt-o" onclick="ptfPersonnelPaySalary(\'' + ptfOnClickArg(p.userId) + '\')">💳 پرداخت حقوق</button>' : '') +
      '<button type="button" class="bt bt-o" onclick="ptfPersonnelLedger(\'' + ptfOnClickArg(p.userId) + '\')">📖 گردش</button>' +
      '</div></div></div>';
  }

  window.ptfPersonnelHtml = function () {
    if (!canPrs()) return '';
    var month = normMonth(window._personnelMonth || faMonthNow()) || faMonthNow();
    var list = personnelAll();
    var active = list.filter(function (p) { return p && p.active !== false; });
    var totals = { claims: 0, commission: 0, payments: 0 };
    active.forEach(function (p) { var b = window.ptfPersonnelBalance(p.userId); totals.claims += b.salaryClaims; totals.commission += b.commissionClaims; totals.payments += b.payments; });
    var cards = list.map(personnelCard).join('') || '<div style="text-align:center;color:#94a3b8;padding:18px">پرسنلی ثبت نشده است.</div>';
    var orphans = unregisteredCommissionOwners();
    var orphanHtml = orphans.length
      ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px;font-size:12px;color:#92400e;margin-top:10px">⚠️ این کاربران پورسانت دارند اما هنوز به‌عنوان پرسنل ثبت نشده‌اند: <b>' + orphans.map(esc).join('، ') + '</b> — در صورت نیاز از «ثبت پرسنل» اضافه کنید.</div>'
      : '';
    return '<section id="personnelBox" style="display:none;background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:14px;margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;align-items:flex-start"><div><h4 style="margin:0">👥 پرسنل — حقوق و مطالبات (حقوق + پورسانت)</h4><small style="color:#64748b">حقوق ثبت‌شده = هزینهٔ جاری + مطالبهٔ پرسنل؛ پرداخت فقط تسویهٔ مطالبه و خروج بانک است. پورسانتِ همان شخص به مجموع مطالباتش اضافه می‌شود (پرداخت پورسانت از تب «پورسانت فروش»). سهامداران در تب خودشان هستند و نمی‌توانند نقش پرسنل بگیرند.</small></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><div style="min-width:190px">' + (window.DateKit && DateKit.monthPicker ? DateKit.monthPicker('personnelMonth', month) : '<input id="personnelMonth" value="' + esc(month) + '" placeholder="۱۴۰۵/۰۶" inputmode="numeric">') + '</div><button class="bt" onclick="ptfPersonnelEdit()">➕ ثبت پرسنل</button></div></div>' +
      '<div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-top:10px">' +
      '<div class="sc"><b style="color:#7c3aed">' + money(totals.claims) + '</b><span>حقوق تعهدی (مطالبهٔ پرسنل)</span></div>' +
      '<div class="sc"><b style="color:#b45309">' + money(totals.commission) + '</b><span>پورسانت ماندهٔ پرسنل</span></div>' +
      '<div class="sc"><b style="color:#0369a1">' + money(totals.payments) + '</b><span>پرداخت‌های ثبت‌شده</span></div>' +
      '</div>' +
      '<div style="margin-top:10px;display:grid;gap:8px">' + cards + '</div>' + orphanHtml + '</section>';
  };

  window.ptfPersonnelRefresh = function () {
    window._personnelMonth = normMonth((document.getElementById('personnelMonth') || {}).value || window._personnelMonth || faMonthNow());
    var old = document.getElementById('personnelBox');
    if (old) old.outerHTML = window.ptfPersonnelHtml();
    if (typeof window.finHubOrder === 'function') window.finHubOrder();
  };

  if (!window._ptfPersonnelMonthHooked && typeof document !== 'undefined' && document.addEventListener) {
    window._ptfPersonnelMonthHooked = true;
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'personnelMonth') window._personnelMonth = normMonth(e.target.value) || faMonthNow();
    });
  }
})();
