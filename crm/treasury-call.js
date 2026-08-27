/* PTF CRM — v34.4.82 فراخوان نقدینگی سهامداران
   سند دستی با سهم فریزشده. بدهی = سهم پرداخت‌نشده همان فراخوان.
   مازاد واریز = طلب از صندوق. ماندهٔ منفی به‌تنهایی بدهی نمی‌سازد. */
(function () {
  'use strict';
  var KEY = 'ptf_crm_treasury_calls';

  function arr(x) { return Array.isArray(x) ? x : []; }
  function num(x) { var n = +x; return isFinite(n) ? n : 0; }
  function money(v) { return Math.round(num(v)).toLocaleString('fa-IR') + ' ریال'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }
  function can() {
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; }
  }
  function load() {
    try {
      var v = (typeof getData === 'function') ? getData(KEY) : JSON.parse(localStorage.getItem(KEY) || '[]');
      return arr(v);
    } catch (e) { return []; }
  }
  function save(list) {
    if (typeof setData === 'function') setData(KEY, list);
    else localStorage.setItem(KEY, JSON.stringify(list));
  }
  function shActive() {
    return arr(typeof getData === 'function' ? getData('ptf_crm_shareholders') : []).filter(function (s) { return s && s.active !== false; });
  }
  function yearLocked() {
    var y = '';
    try {
      if (typeof faDate === 'function') y = String(faDate()).split('/')[0];
      if (typeof ptfFiscalYearOf === 'function') y = ptfFiscalYearOf(y) || y;
      if (typeof ptfFiscalYearLocked === 'function' && y) return ptfFiscalYearLocked(y);
    } catch (e) {}
    return false;
  }
  function fiscalYear() {
    try {
      if (typeof window.ptfFinanceOfficialData === 'function') {
        var d = window.ptfFinanceOfficialData();
        if (d && d.cfg && d.cfg.fiscalYear) return String(d.cfg.fiscalYear);
      }
    } catch (e) {}
    try { return String(faDate()).split('/')[0]; } catch (e2) { return ''; }
  }
  function nm() {
    try { return (curSession() || {}).name || ''; } catch (e) { return ''; }
  }

  window.ptfTreasuryCallAllocate = function (gap, list) {
    gap = Math.round(num(gap));
    list = arr(list).filter(function (s) { return s && (+s.pct || 0) > 0; });
    if (gap <= 0 || !list.length) return [];
    var rows = list.map(function (s) {
      return { shCd: s.cd, shName: s.name, pct: +s.pct || 0, due: Math.floor(gap * (+s.pct || 0) / 100), paid: 0 };
    });
    var sum = rows.reduce(function (a, r) { return a + r.due; }, 0);
    var rem = gap - sum;
    rows.sort(function (a, b) { return b.pct - a.pct || String(a.shCd).localeCompare(String(b.shCd)); });
    if (rows[0]) rows[0].due += rem;
    return rows;
  };

  window.ptfTreasuryCallPaidOf = function (call, shCd) {
    return arr(call && call.pays).filter(function (p) { return p && p.shCd === shCd && p.status !== 'void'; })
      .reduce(function (s, p) { return s + num(p.apply != null ? p.apply : p.amt); }, 0);
  };

  window.ptfTreasuryCallRemainOf = function (call, shCd) {
    var row = arr(call && call.shares).filter(function (s) { return s.shCd === shCd; })[0];
    if (!row) return 0;
    return Math.max(0, num(row.due) - window.ptfTreasuryCallPaidOf(call, shCd));
  };

  function refreshCallStatus(call) {
    if (!call || call.status === 'void') return;
    var done = arr(call.shares).every(function (s) { return window.ptfTreasuryCallRemainOf(call, s.shCd) <= 0; });
    call.status = done ? 'closed' : 'open';
  }

  function voidShareTxForPay(payCd, callCd, shCd) {
    if (typeof getData !== 'function' || typeof setData !== 'function') return;
    var txs = arr(getData('ptf_crm_sharetx'));
    var n = 0;
    txs.forEach(function (x) {
      if (!x || x.status === 'void' || x.voided) return;
      var hit = (payCd && (x.payCd === payCd || x.cd === payCd)) ||
        (callCd && shCd && x.callCd === callCd && x.shCd === shCd && (x.type === 'call_pay' || x.type === 'call_over' || x.type === 'call_credit_use') && x.payCd === payCd);
      if (!hit && payCd && x.callCd === callCd && x.shCd === shCd && x.fromCredit && (x.type === 'call_pay' || x.type === 'call_credit_use')) {
        hit = String(x.payCd || x.cd || '').indexOf(payCd) === 0 || x.payCd === payCd;
      }
      if (!hit) return;
      x.status = 'void';
      x.voided = true;
      x.voidAt = (typeof faDateTime === 'function' ? faDateTime() : '');
      x.voidBy = nm();
      n++;
    });
    if (n) { /* v34.8.27 (W4) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_sharetx', txs, { reason: 'w4' }); else setData('ptf_crm_sharetx', txs); }
    return n;
  }

  window.ptfTreasuryCallVoidPay = function (callCd, payCd, silent) {
    if (!can()) return false;
    if (yearLocked()) { alert('🔒 سال مالی قفل است.'); return false; }
    var list = load();
    var call = list.filter(function (x) { return x.cd === callCd; })[0];
    if (!call || call.status === 'void') { if (!silent) alert('فراخوان پیدا نشد.'); return false; }
    var pay = arr(call.pays).filter(function (p) { return p && p.cd === payCd; })[0];
    if (!pay || pay.status === 'void') { if (!silent) alert('واریز پیدا نشد.'); return false; }
    if (!silent && !confirm('این واریز باطل شود؟ سهم و طلب همان فراخوان از نو حساب می‌شود.' + (pay.fromCredit ? ' طلب تهاترشده برمی‌گردد.' : ''))) return false;
    pay.status = 'void';
    pay.voidAt = (typeof faDateTime === 'function' ? faDateTime() : '');
    pay.voidBy = nm();
    voidShareTxForPay(pay.cd, call.cd, pay.shCd);
    refreshCallStatus(call);
    save(list);
    try { if (typeof audit === 'function') audit('خزانه', 'ابطال واریز فراخوان ' + callCd + ' / ' + payCd, payCd); } catch (eA) {}
    if (!silent && typeof ptfToast === 'function') ptfToast('واریز باطل شد — سهم و طلب به‌روز شد', 'ok');
    if (!silent && typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
    if (!silent && typeof window.ptfShareRender === 'function') window.ptfShareRender();
    return true;
  };

  window.ptfTreasuryCallEditPay = function (callCd, payCd) {
    if (!can()) return;
    if (yearLocked()) { alert('🔒 سال مالی قفل است.'); return; }
    var list = load();
    var call = list.filter(function (x) { return x.cd === callCd; })[0];
    if (!call || call.status === 'void') { alert('فراخوان پیدا نشد.'); return; }
    var pay = arr(call.pays).filter(function (p) { return p && p.cd === payCd && p.status !== 'void'; })[0];
    if (!pay) { alert('واریز پیدا نشد.'); return; }
    if (pay.fromCredit) {
      alert('این ردیف تهاتر طلب است، نه واریز نقد. برای برگرداندن طلب، ابطال کنید.');
      return;
    }
    var others = window.ptfTreasuryCallPaidOf(call, pay.shCd) - num(pay.apply != null ? pay.apply : pay.amt);
    var row = arr(call.shares).filter(function (s) { return s.shCd === pay.shCd; })[0];
    var cap = Math.max(0, num(row && row.due) - Math.max(0, others));
    function go(v) {
      var amt = Math.round(num(v.amt));
      if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      if (!window.ptfTreasuryCallVoidPay(callCd, payCd, true)) return;
      var fresh = load();
      var c2 = fresh.filter(function (x) { return x.cd === callCd; })[0];
      if (!c2) return;
      var remain = window.ptfTreasuryCallRemainOf(c2, pay.shCd);
      var apply = Math.min(amt, remain);
      var over = amt - apply;
      var draftCd = (typeof genCode === 'function') ? genCode('SHT') : ('SHT-' + Date.now());
      c2.pays = arr(c2.pays);
      c2.pays.push({
        cd: draftCd, shCd: pay.shCd, shName: pay.shName, amt: amt, apply: apply, over: over,
        t: (typeof faDateTime === 'function' ? faDateTime() : ''), by: nm(), status: 'posted', editOf: payCd
      });
      refreshCallStatus(c2);
      save(fresh);
      var sh = { cd: pay.shCd, name: pay.shName };
      if (apply && typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('call_pay', sh, apply, 'اصلاح تأمین سهم فراخوان ' + callCd, { cd: draftCd, callCd: callCd, payCd: draftCd, files: (v.files || []).slice() });
      }
      if (over && typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('call_over', sh, over, 'مازاد تأمین فراخوان ' + callCd + ' — طلب از صندوق', { callCd: callCd, payCd: draftCd });
      }
      try { if (typeof audit === 'function') audit('خزانه', 'اصلاح واریز فراخوان ' + callCd + ' → ' + money(amt), draftCd); } catch (eA) {}
      if (typeof ptfToast === 'function') ptfToast('واریز اصلاح شد', 'ok');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
    }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'اصلاح واریز — ' + (pay.shName || ''),
        body: 'سهم فریز: <b>' + money(row && row.due) + '</b> — سقف قابل تخصیص به سهم (بدون این واریز): <b>' + money(cap) + '</b><br><small>مبلغ بیشتر از سهم، طلب از صندوق می‌شود.</small>',
        fields: [
          { id: 'amt', label: 'مبلغ واریز جدید (ریال) *', type: 'number', required: true, dir: 'ltr', value: String(pay.amt || pay.apply || '') },
          { id: 'files', label: 'فیش جدید (اختیاری)', type: 'upload', uploadFolder: 'sharetx/' + ((typeof genCode === 'function') ? genCode('SHT') : 'SHT-edit') }
        ],
        okText: 'ثبت اصلاح',
        onOk: go
      });
      return;
    }
    var raw = prompt('مبلغ واریز جدید (ریال)', String(pay.amt || ''));
    if (raw == null) return;
    go({ amt: raw, files: [] });
  };

  window.ptfTreasuryCallCreate = function () {
    if (!can()) { alert('⛔ فقط مدیران ارشد می‌توانند فراخوان نقدینگی ثبت کنند.'); return; }
    if (yearLocked()) { alert('🔒 سال مالی قفل است؛ فراخوان جدید مجاز نیست.'); return; }
    var cash = (typeof window.ptfTreasuryDerivedCash === 'function') ? window.ptfTreasuryDerivedCash() : { derived: 0 };
    var gap = Math.max(0, Math.round(-num(cash.derived)));
    if (!gap) { alert('مانده صندوق منفی نیست؛ فراخوان لازم نیست.'); return; }
    var shs = shActive();
    var pct = shs.reduce(function (s, x) { return s + (+x.pct || 0); }, 0);
    if (load().some(function (c) { return c && c.status === 'open'; })) {
      if (!confirm('یک فراخوان باز وجود دارد. فراخوان جدید فقط کسری همین لحظه را فریز می‌کند و با قبلی قاطی نمی‌شود. ادامه؟')) return;
    }
    if (Math.round(pct * 100) / 100 !== 100) {
      alert('جمع سهام فعال ' + pct + '٪ است. فراخوان فقط وقتی سهام فعال دقیقاً ۱۰۰٪ باشد ثبت می‌شود.');
      return;
    }
    var shares = window.ptfTreasuryCallAllocate(gap, shs);
    var check = shares.reduce(function (s, r) { return s + r.due; }, 0);
    if (check !== gap) { alert('خطای گرد کردن سهم‌ها. فراخوان ثبت نشد.'); return; }
    var body = 'کسری صندوق همین لحظه: <b>' + money(gap) + '</b><br>سهم هر سهامدار روی این سند فریز می‌شود و با تغییر بعدی درصد عوض نمی‌شود.<br><div class="tb2" style="margin-top:8px"><table><thead><tr><th>سهامدار</th><th>درصد</th><th>سهم</th></tr></thead><tbody>' +
      shares.map(function (r) { return '<tr><td>' + esc(r.shName) + '</td><td>' + r.pct + '٪</td><td>' + money(r.due) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'ثبت فراخوان نقدینگی',
        body: body,
        fields: [{ id: 'note', label: 'شرح (اختیاری)', type: 'textarea', rows: 2 }],
        okText: 'ثبت فراخوان',
        onOk: function (v) { commitCall(gap, cash.derived, shares, v.note || ''); }
      });
      return;
    }
    if (!confirm('فراخوان ' + money(gap) + ' ثبت شود؟')) return;
    commitCall(gap, cash.derived, shares, '');
  };

  function commitCall(gap, cashBefore, shares, note) {
    var cd = (typeof genCode === 'function') ? genCode('CALL') : ('CALL-' + Date.now());
    var rec = {
      cd: cd, fiscalYear: fiscalYear(), gap: gap, cashBefore: cashBefore,
      note: String(note || '').trim(), shares: shares, pays: [],
      status: 'open', t: (typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString()), by: nm()
    };
    var list = load();
    list.unshift(rec);
    save(list);
    var appliedCredit = 0;
    shares.forEach(function (r) {
      var sh = { cd: r.shCd, name: r.shName };
      if (typeof window.ptfShareAddTx === 'function' && r.due > 0) {
        window.ptfShareAddTx('call_due', sh, r.due, 'سهم فراخوان ' + cd, { callCd: cd });
      }
      var cred = 0;
      try { cred = (typeof window.ptfShareholderBalance === 'function') ? (+window.ptfShareholderBalance(r.shCd).callCredit || 0) : 0; } catch (eB) {}
      var use = Math.min(r.due, Math.round(cred));
      if (use > 0 && typeof window.ptfShareAddTx === 'function') {
        var crCd = 'CR-' + cd + '-' + r.shCd;
        rec.pays.push({ cd: crCd, shCd: r.shCd, shName: r.shName, amt: use, apply: use, over: 0, fromCredit: true, t: rec.t, by: nm(), status: 'posted' });
        window.ptfShareAddTx('call_pay', sh, use, 'تهاتر طلب قبلی با فراخوان ' + cd, { callCd: cd, payCd: crCd, fromCredit: true, noCash: true });
        window.ptfShareAddTx('call_credit_use', sh, use, 'مصرف طلب از صندوق روی فراخوان ' + cd, { callCd: cd, payCd: crCd });
        appliedCredit += use;
      }
    });
    if (rec.shares.every(function (s) { return window.ptfTreasuryCallRemainOf(rec, s.shCd) <= 0; })) rec.status = 'closed';
    save(list);
    try { if (typeof audit === 'function') audit('خزانه', 'ثبت فراخوان نقدینگی ' + money(gap) + (appliedCredit ? ' — تهاتر طلب ' + money(appliedCredit) : ''), cd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast(appliedCredit ? ('فراخوان ثبت شد؛ ' + money(appliedCredit) + ' از طلب قبلی تهاتر شد و دوباره نقد نشد') : 'فراخوان ثبت شد — بدهی فقط به اندازهٔ سهم فریزشده است', 'ok');
    if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
    if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
  }

  window.ptfTreasuryCallPay = function (callCd, shCd) {
    if (!can()) return;
    if (yearLocked()) { alert('🔒 سال مالی قفل است.'); return; }
    var list = load();
    var call = list.filter(function (x) { return x.cd === callCd; })[0];
    if (!call || call.status === 'void') { alert('فراخوان پیدا نشد.'); return; }
    var remain = window.ptfTreasuryCallRemainOf(call, shCd);
    var row = arr(call.shares).filter(function (s) { return s.shCd === shCd; })[0];
    if (!row) return;
    var draftCd = (typeof genCode === 'function') ? genCode('SHT') : ('SHT-' + Date.now());
    function go(v) {
      var amt = Math.round(num(v.amt));
      if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      var apply = Math.min(amt, remain);
      var over = amt - apply;
      call.pays = arr(call.pays);
      call.pays.push({ cd: draftCd, shCd: shCd, shName: row.shName, amt: amt, apply: apply, over: over, t: (typeof faDateTime === 'function' ? faDateTime() : ''), by: nm(), status: 'posted' });
      var allPaid = call.shares.every(function (s) { return window.ptfTreasuryCallRemainOf(call, s.shCd) <= 0; });
      if (allPaid) call.status = 'closed';
      save(list);
      var sh = { cd: shCd, name: row.shName };
      if (apply && typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('call_pay', sh, apply, 'تأمین سهم فراخوان ' + callCd, { cd: draftCd, callCd: callCd, payCd: draftCd, files: (v.files || []).slice() });
      }
      if (over && typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('call_over', sh, over, 'مازاد تأمین فراخوان ' + callCd + ' — طلب از صندوق', { callCd: callCd, payCd: draftCd, files: apply ? [] : (v.files || []).slice() });
      }
      try { if (typeof audit === 'function') audit('خزانه', 'واریز ' + money(amt) + ' برای فراخوان ' + callCd + ' توسط ' + row.shName, draftCd); } catch (eA) {}
      if (typeof ptfToast === 'function') ptfToast(over ? ('سهم پوشش داده شد؛ مازاد ' + money(over) + ' طلب از صندوق شد') : 'سهم فراخوان تأمین شد', 'ok');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
    }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'تأمین نقدینگی — ' + row.shName,
        body: 'سهم فریزشده: <b>' + money(row.due) + '</b> — مانده همین فراخوان: <b>' + money(remain) + '</b><br><small>مبلغ بیشتر از مانده، طلب از صندوق می‌شود نه سهم اضافه.</small>',
        fields: [
          { id: 'amt', label: 'مبلغ واریز (ریال) *', type: 'number', required: true, dir: 'ltr', value: String(remain) },
          { id: 'files', label: 'فیش واریز', type: 'upload', uploadFolder: 'sharetx/' + draftCd }
        ],
        okText: 'ثبت واریز',
        onOk: go
      });
      return;
    }
    var raw = prompt('مبلغ واریز (ریال)', String(remain));
    if (raw == null) return;
    go({ amt: raw, files: [] });
  };

  window.ptfTreasuryCallVoid = function (callCd) {
    if (!can()) return;
    var list = load();
    var call = list.filter(function (x) { return x.cd === callCd; })[0];
    if (!call || call.status === 'void') return;
    if (arr(call.pays).some(function (p) { return p && p.status !== 'void'; })) {
      alert('این فراخوان واریز فعال دارد. اول واریزها را باطل کنید.');
      return;
    }
    if (!confirm('فراخوان «' + call.cd + '» باطل شود؟ بدهی سهم‌ها هم برداشته می‌شود.')) return;
    call.status = 'void';
    save(list);
    try {
      var txs = (typeof getData === 'function' ? getData('ptf_crm_sharetx') : []) || [];
      txs.forEach(function (x) {
        if (x && x.callCd === callCd && x.type === 'call_due') { x.status = 'void'; x.voided = true; }
      });
      /* v34.8.27 (W4) */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_sharetx', txs, { reason: 'w4' });
      else if (typeof setData === 'function') setData('ptf_crm_sharetx', txs); /* fallback */
    } catch (e) {}
    if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
    if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
  };

  function callsHtml() {
    var cash = (typeof window.ptfTreasuryDerivedCash === 'function') ? window.ptfTreasuryDerivedCash() : { derived: 0 };
    var gap = Math.max(0, Math.round(-num(cash.derived)));
    var calls = load();
    var banner = gap
      ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:12.5px;line-height:1.9;color:#991b1b"><b>مانده صندوق منفی است:</b> ' + money(gap) + '<br>بدهی سهامدار خودکار ساخته نمی‌شود. با «ثبت فراخوان» سهم‌ها فریز می‌شوند.' +
        (can() ? '<div style="margin-top:8px"><button type="button" class="bt" onclick="ptfTreasuryCallCreate()">ثبت فراخوان نقدینگی</button></div>' : '') + '</div>'
      : (can() ? '<div style="margin:8px 0"><button type="button" class="bt bt-o" onclick="ptfTreasuryCallCreate()">ثبت فراخوان نقدینگی</button></div>' : '');
    var body = calls.map(function (c) {
      var rows = arr(c.shares).map(function (s) {
        var remain = window.ptfTreasuryCallRemainOf(c, s.shCd);
        var paid = window.ptfTreasuryCallPaidOf(c, s.shCd);
        var act = (c.status !== 'void' && remain > 0 && can())
          ? '<button type="button" class="ba" data-call="' + esc(c.cd) + '" data-sh="' + esc(s.shCd) + '" onclick="ptfTreasuryCallPay(this.getAttribute(\'data-call\'),this.getAttribute(\'data-sh\'))">واریز</button>'
          : '';
        return '<tr><td>' + esc(s.shName) + '</td><td>' + s.pct + '٪</td><td>' + money(s.due) + '</td><td>' + money(paid) + '</td><td>' + money(remain) + '</td><td>' + act + '</td></tr>';
      }).join('');
      var hasActivePay = arr(c.pays).some(function (p) { return p && p.status !== 'void'; });
      var payRows = arr(c.pays).map(function (p) {
        if (!p) return '';
        var voided = p.status === 'void';
        var kind = p.fromCredit ? 'تهاتر طلب' : (num(p.over) > 0 ? 'نقد + مازاد' : 'نقد');
        var acts = '';
        if (!voided && c.status !== 'void' && can()) {
          if (!p.fromCredit) {
            acts += '<button type="button" class="ba" data-call="' + esc(c.cd) + '" data-pay="' + esc(p.cd) + '" onclick="ptfTreasuryCallEditPay(this.getAttribute(\'data-call\'),this.getAttribute(\'data-pay\'))">اصلاح</button> ';
          }
          acts += '<button type="button" class="ba" style="color:#dc2626" data-call="' + esc(c.cd) + '" data-pay="' + esc(p.cd) + '" onclick="ptfTreasuryCallVoidPay(this.getAttribute(\'data-call\'),this.getAttribute(\'data-pay\'))">ابطال</button>';
        }
        return '<tr' + (voided ? ' style="opacity:.55"' : '') + '><td>' + esc(p.t || '') + '</td><td>' + esc(p.shName || '') + '</td><td>' + kind + (voided ? ' — باطل' : '') + '</td><td>' + money(p.amt) + '</td><td>' + money(p.apply) + '</td><td>' + money(p.over) + '</td><td>' + acts + '</td></tr>';
      }).join('');
      var voidBtn = (c.status !== 'void' && !hasActivePay && can())
        ? ' <button type="button" class="ba" style="color:#dc2626" data-call="' + esc(c.cd) + '" onclick="ptfTreasuryCallVoid(this.getAttribute(\'data-call\'))">ابطال فراخوان</button>'
        : '';
      return '<div style="background:#fff;border:1px solid #bae6fd;border-radius:12px;padding:10px;margin:8px 0"><b>' + esc(c.cd) + '</b> — ' + money(c.gap) + ' — ' + esc(c.status === 'open' ? 'باز' : (c.status === 'closed' ? 'تسویه' : 'باطل')) + voidBtn +
        (c.note ? '<br><small>' + esc(c.note) + '</small>' : '') +
        '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>سهامدار</th><th>درصد فریز</th><th>سهم</th><th>واریز</th><th>مانده</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (payRows ? '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>تاریخ</th><th>سهامدار</th><th>نوع</th><th>مبلغ</th><th>به سهم</th><th>مازاد/طلب</th><th></th></tr></thead><tbody>' + payRows + '</tbody></table></div>' : '') +
        '</div>';
    }).join('');
    return banner + (body || '<small style="color:#64748b">فراخوانی ثبت نشده است.</small>');
  }

  var _old = window.ptfTreasuryRender;
  window.ptfTreasuryRender = function () {
    if (typeof _old === 'function') _old();
    var host = document.getElementById('treasuryFocus');
    if (host) host.innerHTML = callsHtml();
  };
})();
