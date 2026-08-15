/* PTF CRM — خزانه/بانک
   ورودی = وصولی واقعی. خروجی بانک = خرید/شارژ تنخواه/چک سررسید/برداشت/فراخوان.
   هزینه و پرداخت مستقیمِ انجام‌شده از مانده تنخواه انتقال بانکی تازه نیستند. */
(function () {
  'use strict';
  var KEY = 'ptf_crm_bank_recon';

  function arr(x) { return Array.isArray(x) ? x : []; }
  function num(x) { var n = +x; return isFinite(n) ? n : 0; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    try { return (num(n)).toLocaleString('fa-IR'); } catch (e) { return String(num(n)); }
  }
  function get(k) {
    try {
      if (typeof window.getData === 'function') return arr(window.getData(k));
      return JSON.parse(localStorage.getItem(k) || '[]');
    } catch (e) { return []; }
  }
  function active(x) {
    if (!x) return false;
    var st = String(x.st || x.status || '').toLowerCase();
    if (st === 'void' || st === 'cancelled' || x.voided || x.deleted) return false;
    return true;
  }
  function isoOf(x) {
    return String(x.dateISO || x.ts || x.t || x.dtISO || '').slice(0, 10);
  }
  function faOf(x) {
    return x.dateFa || x.dt || x.tFa || isoOf(x);
  }

  function txt(x) { return String(x == null ? '' : x).toLowerCase(); }
  function todayISO() {
    try { return (typeof ptfTodayISO === 'function' ? ptfTodayISO() : new Date().toISOString().slice(0, 10)); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function chequeList(k) {
    var a = get(k);
    if (a.length) return a;
    if (k !== 'ptf_crm_cheques' && typeof window.ptfChequeAll === 'function') {
      try {
        var all = window.ptfChequeAll() || [];
        if (k.indexOf('received') > -1) return all.filter(function (c) { return c && (c.kind === 'received' || c.dir === 'in' || c.ownership === 'received'); });
        if (k.indexOf('issued') > -1) return all.filter(function (c) { return c && (c.kind === 'issued' || c.dir === 'out' || c.ownership === 'company' || c.ownership === 'personal'); });
      } catch (eC) {}
    }
    return get('ptf_crm_cheques');
  }
  function chequeMatured(ch) {
    if (!ch) return false;
    var st = txt(ch.st || ch.status);
    if (st.indexOf('void') > -1 || st.indexOf('cancel') > -1) return false;
    if (ch.cleared || /pass|clear|وصول|پاس|نقد/.test(st)) return true;
    var due = String(ch.dueISO || '').slice(0, 10);
    return !!(due && due <= todayISO());
  }
  function chequeCollected(ch) {
    if (!ch) return false;
    var st = txt(ch.st || ch.status);
    if (st.indexOf('void') > -1) return false;
    return !!(ch.collected || /collect|وصول/.test(st));
  }
  function payIsCheque(p) {
    if (!p) return false;
    if (p.chequeCd) return true;
    return /چک|cheque/.test(txt(p.how || p.method || ''));
  }
  function payIsBarter(p) {
    return /credit|تهاتر|اعتبار/.test(txt((p && (p.method || p.how)) || ''));
  }
  function pushMove(out, rec) {
    if (!rec || !num(rec.amount)) return;
    out.push(rec);
  }

  /* دفتر نقدی کامل: فاکتور/تعهد وارد نمی‌شود؛ فقط حرکت وجه. ضد دوباره‌شماری چک و پیش‌پرداخت. */
  window.ptfTreasuryCrmMoves = function () {
    var out = [];

    /* v35 — منبع واحد وجه ورودی پرونده: Receipt قطعی.
       شرایط پیشنهاد، paid/cashFull و درصد پیش‌پرداخت هرگز رویداد پول نیستند.
       این تغییر هم اتصال اشتباه رکوردهای هم‌شماره را می‌بندد و هم داده آزمایشی
       قدیمی را از مانده جاری خارج می‌کند. */
    get('ptf_crm_case_receipts').forEach(function (r) {
      if (!r || !active(r) || String(r.status || '') !== 'posted') return;
      if (payIsCheque(r)) return; /* چک فقط پس از collect به Receipt بانکی تبدیل می‌شود */
      var amt = num(r.amountIRR || r.amt || r.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'casereceipt:' + (r._id || r.cd || ''),
        cd: r._id || r.cd || '',
        dir: 'in',
        amount: amt,
        dateISO: String(r.receivedAt || r.dateISO || r.t || '').slice(0, 10),
        dateFa: r.dateFa || r.receivedAt || r.t || '',
        src: 'دریافت قطعی پرونده',
        label: 'دریافت پرونده ' + (r.caseId || '') + (r.buyerCo ? ' — ' + r.buyerCo : '') + (r.referenceNo ? ' — پیگیری ' + r.referenceNo : '')
      });
    });

    get('ptf_crm_invoices').filter(active).forEach(function (inv) {
      arr(inv.payments).concat(arr(inv.pays)).forEach(function (p, i) {
        if (!active(p) || p.voided || p.status === 'reversal') return;
        var amt = num(p.amt || p.amount || p.amountIrr);
        if (!amt) return;
        if (p.fromAdvance || p.migratedToReceiptId || p.financialProjectionDisabled) return;
        if (payIsCheque(p)) return;
        pushMove(out, {
          key: 'invpay:' + (inv.cd || inv.id || '') + ':' + (p.cd || p.id || i),
          cd: inv.cd || '',
          dir: 'in',
          amount: amt,
          dateISO: isoOf(p) || isoOf(inv),
          dateFa: faOf(p) || faOf(inv),
          src: 'وصولی مشتری',
          label: 'وصولی فاکتور ' + (inv.no || inv.cd || '') + (inv.buyerCo ? ' — ' + inv.buyerCo : '')
        });
      });
    });

    function pushSupPay(row) {
      if (!active(row) || String(row.status || '').toLowerCase() === 'void') return;
      var amt = num(row.amountIrr || row.amt || row.amount);
      if (!amt) return;
      var method = txt(row.method || row.how || '');
      if (payIsBarter(row)) return;
      if (method === 'company_cheque' || method === 'company-cheque' || row.chequeCd) return;
      pushMove(out, {
        key: 'suppay:' + (row.cd || row.id || ''),
        cd: row.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(row),
        dateFa: faOf(row),
        src: 'پرداخت خرید',
        label: 'پرداخت تأمین ' + (row.supName || row.cd || '')
      });
    }
    try {
      var sfRaw = (typeof window.getData === 'function') ? window.getData('ptf_crm_supplier_finance') : null;
      if (sfRaw && !Array.isArray(sfRaw) && sfRaw.payments) arr(sfRaw.payments).forEach(pushSupPay);
      else get('ptf_crm_supplier_finance').forEach(pushSupPay);
    } catch (eSf) {}

    get('ptf_crm_opex').forEach(function (o) {
      if (!active(o) || o.st === 'void') return;
      if (o.shareholderSalary || o.shareTx) return;
      if (o.chequeCd || o.payHow === 'cheque') return;
      var amt = num(o.amt || o.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'opex:' + (o._opexRowId || o.cd || ''),
        cd: o.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(o) || String(o.month || '').replace(/\//g, '-') ,
        dateFa: o.month || faOf(o),
        src: 'هزینه جاری',
        label: 'هزینه ' + (o.cat || '') + (o.desc ? ' — ' + o.desc : '')
      });
    });

    /* خزانهٔ این تب = گردش بانک/صندوق مرکزی، نه گردش داخلی تنخواه.
       charge تنها انتقال بانک → تنخواه است. settle و direct هر دو از ماندهٔ
       همان تنخواه خرج می‌شوند (direct هم با ensureBalance مجاز می‌شود)، پس اگر
       اینجا بیایند شارژ یک‌بار و مصرف همان شارژ بار دوم جمع می‌شود. */
    get('ptf_crm_petty_tx').filter(active).forEach(function (tx) {
      var kind = txt(tx.kind || tx.type || '');
      if (kind !== 'charge' && kind.indexOf('شارژ') < 0) return;
      var amt = num(tx.amt || tx.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'petty-charge:' + (tx.cd || tx.id || ''),
        cd: tx.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(tx),
        dateFa: faOf(tx),
        src: 'شارژ تنخواه',
        label: 'شارژ تنخواه ' + (tx.cd || '')
      });
    });

    /* پرداخت پورسانت بانک: هزینه قبلاً در زمان تصویب داخل OPEX ثبت شده است؛
       اینجا فقط حرکت نقدیِ تسویه بدهی را ثبت می‌کنیم. */
    get('ptf_crm_commission_records').forEach(function (r) {
      if (!r || r.kind !== 'payment' || r.status !== 'posted' || txt(r.method) !== 'bank') return;
      var amt = num(r.amount); if (!amt) return;
      pushMove(out, { key: 'commission-pay:' + (r.cd || ''), cd: r.cd || '', dir: 'out', amount: amt, dateISO: r.dateISO || isoOf(r), dateFa: r.dateFa || faOf(r), src: 'پرداخت پورسانت فروش', label: 'پرداخت پورسانت ' + (r.userLabel || r.user || '') + (r.doc ? ' — ' + r.doc : '') });
    });

    chequeList('ptf_crm_cheques_received').filter(active).forEach(function (ch) {
      if (!chequeCollected(ch)) return;
      var amt = num(ch.amt || ch.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'chqin:' + (ch.cd || ch.id || ''),
        cd: ch.cd || '',
        dir: 'in',
        amount: amt,
        dateISO: isoOf(ch) || String(ch.dueISO || '').slice(0, 10),
        dateFa: faOf(ch),
        src: 'وصول چک وارده',
        label: 'وصول چک وارده ' + (ch.sayad || ch.no || ch.cd || '')
      });
    });

    chequeList('ptf_crm_cheques_issued').filter(active).forEach(function (ch) {
      if (txt(ch.ownership) === 'personal' || txt(ch.kind) === 'guarantee') return;
      if (!chequeMatured(ch)) return;
      var amt = num(ch.amt || ch.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'chqout:' + (ch.cd || ch.id || ''),
        cd: ch.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: String(ch.dueISO || isoOf(ch) || '').slice(0, 10),
        dateFa: ch.dueFa || faOf(ch),
        src: 'چک سررسیدشده',
        label: 'چک صادره سررسید ' + (ch.sayad || ch.no || ch.cd || '') + (ch.toWhom ? ' — ' + ch.toWhom : '')
      });
    });

    get('ptf_crm_sharetx').forEach(function (x) {
      if (!active(x)) return;
      var t = txt(x.type);
      if (t === 'chair_in') {
        var cin = num(x.amt || x.amount);
        if (!cin) return;
        pushMove(out, {
          key: 'chairin:' + (x.cd || ''),
          cd: x.cd || '',
          dir: 'in',
          amount: cin,
          dateISO: isoOf(x),
          dateFa: faOf(x),
          src: 'تزریق شخصی رییس',
          label: 'تزریق از حساب شخصی ' + (x.shName || 'رییس')
        });
        return;
      }
      if (t === 'chair_out') {
        var cout = num(x.amt || x.amount);
        if (!cout) return;
        pushMove(out, {
          key: 'chairo:' + (x.cd || ''),
          cd: x.cd || '',
          dir: 'out',
          amount: cout,
          dateISO: isoOf(x),
          dateFa: faOf(x),
          src: 'تسویه طلب رییس',
          label: 'برگشت نقد به حساب شخصی ' + (x.shName || 'رییس')
        });
        return;
      }
      if (t === 'call_pay' || t === 'call_over') {
        if (x.fromCredit || x.noCash) return;
        var inAmt = num(x.amt || x.amount);
        if (!inAmt) return;
        pushMove(out, {
          key: 'sharein:' + (x.cd || ''),
          cd: x.cd || '',
          dir: 'in',
          amount: inAmt,
          dateISO: isoOf(x),
          dateFa: faOf(x),
          src: t === 'call_over' ? 'مازاد تأمین سهامدار' : 'تأمین نقدینگی سهامدار',
          label: (t === 'call_over' ? 'مازاد تأمین ' : 'تأمین فراخوان ') + (x.shName || '')
        });
        return;
      }
      if (t !== 'draw' && t !== 'advance' && t !== 'salary_payment') return;
      var amt = num(x.amt || x.amount);
      if (!amt) return;
      pushMove(out, {
        key: 'share:' + (x.cd || ''),
        cd: x.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(x),
        dateFa: faOf(x),
        src: t === 'salary_payment' ? 'پرداخت حقوق سهامدار' : 'برداشت سهامدار',
        label: (t === 'salary_payment' ? 'پرداخت حقوق ' : 'برداشت ') + (x.shName || '')
      });
    });

    /* v35: مانده افتتاحیه دوره فقط با حرکات همان بازه جمع می‌شود؛ حرکات قبل از
       افتتاحیه (از جمله داده آزمایشی/سال قبل) دوباره وارد مانده جاری نمی‌شوند. */
    try {
      var fp = (typeof window.ptfFinanceOfficialData === 'function') ? window.ptfFinanceOfficialData() : null;
      var start = fp && fp.cfg && fp.cfg.startISO, end = fp && fp.cfg && fp.cfg.endISO;
      if (start || end) out = out.filter(function (m) {
        var ds = String(m.dateISO || m.dateFa || '').trim(), iso = '';
        if (/^20\d{2}-\d{2}-\d{2}/.test(ds)) iso = ds.slice(0, 10);
        else if (/^1[34]\d{2}[\/-]\d{1,2}[\/-]\d{1,2}/.test(ds) && typeof ptfJToISO === 'function') iso = ptfJToISO(ds) || '';
        if (!iso) return true; /* رکورد بی‌تاریخ حذف پنهان نمی‌شود؛ کیفیت داده آن را گزارش می‌کند */
        return (!start || iso >= start) && (!end || iso <= end);
      });
    } catch (eScope) {}
    return out.sort(function (a, b) { return String(b.dateISO || '').localeCompare(String(a.dateISO || '')); });
  };

  window.ptfTreasuryOpeningCash = function () {
    var year = '';
    try {
      if (typeof window.ptfFinanceOfficialData === 'function') {
        var d = window.ptfFinanceOfficialData();
        if (d && d.opening && num(d.opening.cash_bank)) return num(d.opening.cash_bank);
        year = d && d.cfg && d.cfg.fiscalYear;
      }
    } catch (e1) {}
    try {
      var snaps = get('ptf_crm_fiscal_snapshots');
      var sum = 0, any = false;
      snaps.forEach(function (r) {
        if (!r || r.type !== 'opening_balance_v281' || r.status === 'void') return;
        if (r.category !== 'cash_bank') return;
        if (year && String(r.fiscalYear) !== String(year)) return;
        sum += num(r.amountIrr || r.amt || r.amount);
        any = true;
      });
      if (any) return sum;
    } catch (e2) {}
    var opening = 0;
    try {
      get('ptf_crm_finance').forEach(function (r) {
        if (String(r.category || r.kind || '') === 'cash_bank') opening += num(r.amountIrr || r.amt || r.amount);
      });
    } catch (e3) {}
    return opening;
  };

  window.ptfTreasuryDerivedCash = function () {
    var opening = window.ptfTreasuryOpeningCash();
    var inn = 0, out = 0;
    window.ptfTreasuryCrmMoves().forEach(function (m) {
      if (m.dir === 'in') inn += m.amount; else out += m.amount;
    });
    return { opening: opening, inflow: inn, outflow: out, derived: opening + inn - out };
  };


  function nmNorm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }
  window.ptfTreasuryCustodianSh = function () {
    var shs = get('ptf_crm_shareholders').filter(function (s) { return s && s.active !== false; });
    var marked = shs.filter(function (s) { return s.custodian === true; })[0];
    if (marked) return marked;
    var chairUser = null;
    try {
      var users = (typeof window.getData === 'function') ? window.getData('ptf_crm_users') : [];
      chairUser = (Array.isArray(users) ? users : []).filter(function (u) {
        return u && (u.roleId === 'chairman' || u.role === 'رییس هیات مدیره');
      })[0];
    } catch (eU) {}
    if (chairUser) {
      var n1 = nmNorm(chairUser.name);
      var hit = shs.filter(function (s) { return nmNorm(s.name) === n1; })[0];
      if (hit) return hit;
    }
    return null;
  };
  window.ptfTreasurySetCustodian = function (shCd) {
    var list = get('ptf_crm_shareholders');
    var found = false;
    list.forEach(function (s) {
      if (!s) return;
      if (s.cd === shCd) { s.custodian = true; found = true; }
      else if (s.custodian) s.custodian = false;
    });
    if (!found) return false;
    if (typeof window.setData === 'function') window.setData('ptf_crm_shareholders', list);
    else localStorage.setItem('ptf_crm_shareholders', JSON.stringify(list));
    if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
    return true;
  };
  /* v34.5.37: تغییر خزانه‌دار — قبلاً فقط در حالت «خزانه‌دار تعیین‌نشده» انتخابگر بود؛
     حالا مدیران ارشد می‌توانند خزانه‌دار فعلی را هم عوض کنند (custodian را روی سهامدار
     دیگری می‌گذارد و قبلی را برمی‌دارد). */
  window.ptfTreasuryCustodianPicker = function () {
    if (!chairCan()) { alert('⛔ فقط مدیران ارشد'); return; }
    var shs = get('ptf_crm_shareholders').filter(function (s) { return s && s.active !== false; });
    if (!shs.length) { alert('سهامدار فعالی ثبت نشده است.'); return; }
    var cur = window.ptfTreasuryCustodianSh();
    var opts = shs.map(function (s) { return '<option value="' + esc(s.cd) + '"' + (cur && s.cd === cur.cd ? ' selected' : '') + '>' + esc(s.name) + (cur && s.cd === cur.cd ? ' (خزانه‌دار فعلی)' : '') + '</option>'; }).join('');
    ptfDialog({
      title: '🧑‍💼 انتخاب / تغییر خزانه‌دار شرکت',
      body: 'خزانه‌دار تنها کسی است که به حساب شرکت دسترسی دارد (معمولاً رییس هیات مدیره). تزریق از حساب شخصی او «طلب او از شرکت» است نه سود.' + (cur ? '<br>خزانه‌دار فعلی: <b>' + esc(cur.name) + '</b>' : ''),
      fields: [{ id: 'sh', label: 'سهامدار خزانه‌دار *', type: 'select', optionsHtml: opts, required: true }],
      okText: 'ثبت خزانه‌دار',
      onOk: function (v) {
        if (!v.sh) { alert('سهامدار را انتخاب کنید'); return; }
        if (!window.ptfTreasurySetCustodian(v.sh)) { alert('ثبت خزانه‌دار ناموفق بود'); return; }
        try { audit('خزانه', 'تغییر/تعیین خزانه‌دار شرکت به ' + (get('ptf_crm_shareholders').filter(function (s) { return s.cd === v.sh; })[0] || {}).name, v.sh); } catch (eA) {}
        if (typeof ptfToast === 'function') ptfToast('خزانه‌دار ثبت شد', 'ok');
        if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      }
    });
  };
  window.ptfTreasuryChairPosition = function () {
    var cash = window.ptfTreasuryDerivedCash();
    var sh = window.ptfTreasuryCustodianSh();
    var bal = (sh && typeof window.ptfShareholderBalance === 'function') ? window.ptfShareholderBalance(sh.cd) : {};
    var claim = Math.round(num(bal.callCredit));
    var companyCash = Math.round(num(cash.derived));
    return {
      sh: sh,
      name: sh ? sh.name : '',
      companyCash: companyCash,
      claim: claim,
      hint: companyCash < 0 ? 'مانده صندوق منفی است؛ اگر رییس از حساب شخصی هزینه کرده، با «تزریق شخصی» ثبت شود.' : ''
    };
  };
  function chairCan() {
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; }
  }
  function chairLocked() {
    try {
      var y = (typeof faDate === 'function') ? String(faDate()).split('/')[0] : '';
      if (typeof ptfFiscalYearOf === 'function') y = ptfFiscalYearOf(y) || y;
      return typeof ptfFiscalYearLocked === 'function' && y && ptfFiscalYearLocked(y);
    } catch (e) { return false; }
  }
  window.ptfTreasuryChairIn = function () {
    if (!chairCan()) { alert('⛔ فقط مدیران ارشد'); return; }
    if (chairLocked()) { alert('🔒 سال مالی قفل است.'); return; }
    var sh = window.ptfTreasuryCustodianSh();
    if (!sh) { alert('اول مشخص کنید رییس کدام سهامدار است.'); return; }
    function go(v) {
      var amt = Math.round(num(v && v.amt));
      if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      if (typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('chair_in', sh, amt, String((v && v.note) || 'تزریق از حساب شخصی رییس به صندوق شرکت'), {});
      }
      try { if (typeof audit === 'function') audit('خزانه', 'تزریق شخصی رییس ' + money(amt), sh.cd); } catch (eA) {}
      if (typeof ptfToast === 'function') ptfToast('تزریق ثبت شد — نقد شرکت و طلب رییس هر دو بالا رفت', 'ok');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
    }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'تزریق از حساب شخصی — ' + sh.name,
        body: 'وقتی رییس از جیب خودش به حساب شرکت (یا مستقیم بابت هزینه شرکت) پول می‌گذارد. نقد شرکت زیاد می‌شود و همان مبلغ طلب رییس از شرکت می‌شود.',
        fields: [
          { id: 'amt', label: 'مبلغ تزریق (ریال) *', type: 'number', required: true, dir: 'ltr' },
          { id: 'note', label: 'شرح', type: 'textarea', rows: 2, value: 'تزریق از حساب شخصی به صندوق شرکت' }
        ],
        okText: 'ثبت تزریق',
        onOk: go
      });
      return;
    }
    var raw = prompt('مبلغ تزریق شخصی (ریال)', '');
    if (raw == null) return;
    go({ amt: raw, note: '' });
  };
  window.ptfTreasuryChairOut = function () {
    if (!chairCan()) { alert('⛔ فقط مدیران ارشد'); return; }
    if (chairLocked()) { alert('🔒 سال مالی قفل است.'); return; }
    var pos = window.ptfTreasuryChairPosition();
    if (!pos.sh) { alert('اول مشخص کنید رییس کدام سهامدار است.'); return; }
    if (pos.claim <= 0) { alert('طلب بازی برای رییس ثبت نشده.'); return; }
    function go(v) {
      var amt = Math.round(num(v && v.amt));
      if (amt <= 0) { alert('مبلغ نامعتبر است'); return; }
      if (amt > pos.claim) { alert('بیش از طلب ثبت‌شده (' + money(pos.claim) + ') نمی‌شود تسویه کرد.'); return; }
      if (typeof window.ptfShareAddTx === 'function') {
        window.ptfShareAddTx('chair_out', pos.sh, amt, String((v && v.note) || 'تسویه طلب رییس از نقد شرکت'), {});
      }
      try { if (typeof audit === 'function') audit('خزانه', 'تسویه طلب رییس ' + money(amt), pos.sh.cd); } catch (eA) {}
      if (typeof ptfToast === 'function') ptfToast('تسویه ثبت شد — نقد شرکت و طلب رییس هر دو کم شد', 'ok');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      if (typeof window.ptfShareRender === 'function') window.ptfShareRender();
    }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'تسویه طلب رییس — ' + pos.name,
        body: 'طلب فعلی: <b>' + money(pos.claim) + '</b> — نقد شرکت نزد رییس: <b>' + money(pos.companyCash) + '</b><br><small>وقتی از حساب شرکت به حساب شخصی رییس برمی‌گردد تا طلبش کم شود.</small>',
        fields: [
          { id: 'amt', label: 'مبلغ تسویه (ریال) *', type: 'number', required: true, dir: 'ltr', value: String(pos.claim) },
          { id: 'note', label: 'شرح', type: 'textarea', rows: 2, value: 'برگشت نقد به حساب شخصی رییس' }
        ],
        okText: 'ثبت تسویه',
        onOk: go
      });
      return;
    }
    var raw = prompt('مبلغ تسویه طلب (ریال)', String(pos.claim));
    if (raw == null) return;
    go({ amt: raw, note: '' });
  };
  function chairPanelHtml() {
    var pos = window.ptfTreasuryChairPosition();
    var shs = get('ptf_crm_shareholders').filter(function (s) { return s && s.active !== false; });
    if (!pos.sh) {
      var picks = shs.map(function (s) {
        return '<button type="button" class="bt bt-o" style="font-size:12px" data-sh="' + esc(s.cd) + '" onclick="ptfTreasurySetCustodian(this.getAttribute(\'data-sh\'))">' + esc(s.name) + '</button>';
      }).join(' ');
      return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:12.5px;line-height:1.9;color:#92400e"><b>خزانه‌دار شرکت کیست؟</b><br>رییس هیات مدیره تنها کسی است که به حساب شرکت دسترسی دارد. سهامدار متناظر را یک‌بار مشخص کنید.' + (picks ? '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' + picks + '</div>' : '') + '</div>';
    }
    var cashCol = pos.companyCash < 0 ? '#b91c1c' : '#0369a1';
    return '<div style="background:#fff;border:1px solid #93c5fd;border-radius:12px;padding:10px 12px;margin:8px 0">' +
      '<b style="color:#1e3a8a">حساب رییس و صندوق شرکت</b> — خزانه‌دار: ' + esc(pos.name) +
      '<div style="font-size:12px;color:#475569;line-height:1.8;margin-top:4px">پول شرکت در حسابی است که فقط رییس به آن دسترسی دارد. تزریق از جیب شخصی، طلب رییس است نه سود.</div>' +
      '<div class="sr" style="margin-top:8px">' +
      '<div class="sc"><b style="color:' + cashCol + '">' + money(pos.companyCash) + '</b><span>نقد شرکت نزد رییس</span></div>' +
      '<div class="sc"><b style="color:#b45309">' + money(pos.claim) + '</b><span>طلب رییس از شرکت</span></div></div>' +
      (pos.hint ? '<div style="margin-top:6px;font-size:12px;color:#991b1b">' + esc(pos.hint) + '</div>' : '') +
      (chairCan() ? '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button type="button" class="bt" onclick="ptfTreasuryChairIn()">تزریق از حساب شخصی</button>' +
        '<button type="button" class="bt bt-o" onclick="ptfTreasuryChairOut()">تسویه طلب رییس</button>' +
        '<button type="button" class="bt bt-o" onclick="ptfTreasuryCustodianPicker()">🧑‍💼 تغییر خزانه‌دار</button></div>' : '') +
      '</div>';
  }

  function faNow() {
    try { return typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString(); } catch (e) { return ''; }
  }
  function fiscalLabel() {
    try {
      if (typeof window.ptfFinanceOfficialData === 'function') {
        var d = window.ptfFinanceOfficialData();
        if (d && d.cfg) return (d.cfg.fiscalYear || '') + (d.cfg.startFa ? ' | ' + d.cfg.startFa + ' تا ' + (d.cfg.endFa || '') : '');
      }
    } catch (e) {}
    return '';
  }
  function loadCalls() { return get('ptf_crm_treasury_calls'); }
  function callPaid(call, shCd) {
    if (typeof window.ptfTreasuryCallPaidOf === 'function') return num(window.ptfTreasuryCallPaidOf(call, shCd));
    return arr(call && call.pays).filter(function (p) { return p && p.shCd === shCd && p.status !== 'void'; })
      .reduce(function (s, p) { return s + num(p.apply != null ? p.apply : p.amt); }, 0);
  }
  function stLabel(st) {
    return st === 'open' ? 'باز' : st === 'closed' ? 'تسویه' : st === 'void' ? 'باطل' : (st || '—');
  }

  window.ptfTreasuryReportHtml = function () {
    var c = window.ptfTreasuryDerivedCash();
    var moves = window.ptfTreasuryCrmMoves();
    var gap = Math.max(0, Math.round(-num(c.derived)));
    var shs = get('ptf_crm_shareholders').filter(function (s) { return s && s.active !== false; });
    var shRows = shs.map(function (s) {
      var b = (typeof window.ptfShareholderBalance === 'function') ? window.ptfShareholderBalance(s.cd) : {};
      return '<tr><td>' + esc(s.name) + '</td><td>' + (+s.pct || 0) + '٪</td><td>' + money(b.callRemain || 0) + '</td><td>' + money(b.callCredit || 0) + '</td><td>' + money(Math.abs(b.net || 0)) + ' ' + ((b.net || 0) >= 0 ? 'بستانکار' : 'بدهکار') + '</td></tr>';
    }).join('');
    var calls = loadCalls().filter(function (x) { return x && x.status !== 'void'; });
    var callBlocks = calls.map(function (call) {
      var rows = arr(call.shares).map(function (s) {
        var paid = callPaid(call, s.shCd);
        var remain = Math.max(0, num(s.due) - paid);
        return '<tr><td>' + esc(s.shName) + '</td><td>' + (s.pct || 0) + '٪</td><td>' + money(s.due) + '</td><td>' + money(paid) + '</td><td>' + money(remain) + '</td></tr>';
      }).join('');
      var pays = arr(call.pays).map(function (p) {
        if (!p) return '';
        var kind = p.fromCredit ? 'تهاتر طلب' : (num(p.over) > 0 ? 'نقد + مازاد' : 'نقد');
        if (p.status === 'void') kind += ' — باطل';
        return '<tr><td>' + esc(p.t || '') + '</td><td>' + esc(p.shName || '') + '</td><td>' + kind + '</td><td>' + money(p.amt) + '</td><td>' + money(p.apply) + '</td><td>' + money(p.over) + '</td></tr>';
      }).join('');
      return '<h2>فراخوان ' + esc(call.cd) + ' — ' + stLabel(call.status) + ' — کسری ' + money(call.gap) + '</h2>' +
        (call.note ? '<p>' + esc(call.note) + '</p>' : '') +
        '<table><thead><tr><th>سهامدار</th><th>درصد فریز</th><th>سهم</th><th>واریز/تهاتر</th><th>مانده بدهی</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5">سهمی نیست</td></tr>') + '</tbody></table>' +
        (pays ? '<table><thead><tr><th>تاریخ</th><th>سهامدار</th><th>نوع واریز</th><th>مبلغ</th><th>به سهم</th><th>مازاد/طلب</th></tr></thead><tbody>' + pays + '</tbody></table>' : '');
    }).join('');
    var moveRows = moves.map(function (m) {
      return '<tr><td>' + esc(m.dateFa || m.dateISO || '') + '</td><td>' + esc(m.src || '') + '</td><td>' + esc(m.label || '') + '</td><td>' + (m.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + money(m.amount) + '</td></tr>';
    }).join('');
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش خزانه نقدی</title><style>' +
      'body{font-family:Tahoma,Vazirmatn,sans-serif;color:#111;padding:22px;direction:rtl}h1{font-size:19px;margin:0 0 6px}h2{font-size:15px;margin:20px 0 8px}p,small{font-size:12px;line-height:1.8}' +
      'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}td,th{border:1px solid #94a3b8;padding:7px;text-align:right}th{background:#e2e8f0}' +
      '.kpi{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.kpi div{border:1px solid #94a3b8;border-radius:8px;padding:8px 12px;min-width:140px}.neg{color:#b91c1c;font-weight:bold}' +
      '</style></head><body>' +
      '<h1>گزارش خزانه نقدی و فراخوان سهامداران</h1>' +
      '<p>سال مالی: <b>' + esc(fiscalLabel() || '—') + '</b> | تهیه: ' + esc(faNow()) + '</p>' +
      '<p>فقط حرکت وجه واقعی. صدور فاکتور و تهاتر در صندوق نیستند. بدهی سهامدار فقط از فراخوان فریزشده است.</p>' +
      '<div class="kpi"><div>افتتاحیه<br><b>' + money(c.opening) + '</b></div><div>ورود نقد<br><b>' + money(c.inflow) + '</b></div><div>خروج نقد<br><b>' + money(c.outflow) + '</b></div><div>مانده صندوق / نقد شرکت نزد رییس<br><b class="' + (c.derived < 0 ? 'neg' : '') + '">' + money(c.derived) + '</b></div><div>کسری فعلی<br><b class="' + (gap ? 'neg' : '') + '">' + money(gap) + '</b></div>' +
      (function () { var p = window.ptfTreasuryChairPosition(); return p.sh ? '<div>طلب رییس (' + esc(p.name) + ')<br><b>' + money(p.claim) + '</b></div>' : ''; }()) +
      '</div>' +
      '<h2>وضعیت سهامداران نسبت به صندوق</h2><table><thead><tr><th>سهامدار</th><th>درصد</th><th>بدهی فراخوان باز</th><th>طلب از صندوق</th><th>مانده حساب</th></tr></thead><tbody>' +
      (shRows || '<tr><td colspan="5">سهامدار فعالی نیست</td></tr>') + '</tbody></table>' +
      (callBlocks || '<h2>فراخوان</h2><p>فراخوان بازی ثبت نشده است.</p>') +
      '<h2>گردش نقدی</h2><table><thead><tr><th>تاریخ</th><th>منبع</th><th>شرح</th><th>جهت</th><th>مبلغ</th></tr></thead><tbody>' +
      (moveRows || '<tr><td colspan="5">گردشی نیست</td></tr>') + '</tbody></table></body></html>';
  };

  window.ptfTreasuryPrint = function () {
    var html = window.ptfTreasuryReportHtml();
    var year = (fiscalLabel() || '').split('|')[0].trim() || 'fund';
    if (typeof ptfPreviewPrintableDoc === 'function') {
      ptfPreviewPrintableDoc('گزارش خزانه نقدی — ' + year, html, 'treasury-cash-' + year.replace(/[^0-9]/g, ''));
      return;
    }
    alert('پیش‌نمایش چاپ در این نسخه بارگذاری نشده است.');
  };

  window.ptfTreasuryHtml = function () {
    return '<div id="treasuryBox" class="pn" style="display:none;margin-top:12px;padding:14px;border:1px solid #bae6fd;border-radius:16px;background:#f0f9ff">' +
      '<div class="treasury-head"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start"><div><h4 style="margin:0 0 6px">خزانه نقدی شرکت</h4>' +
      '<small style="color:#0369a1;display:block;margin-bottom:10px;line-height:1.8">مانده صندوق = نقد شرکت نزد رییس. تزریق شخصی رییس طلب اوست، نه سود. فاکتور و تهاتر وارد صندوق نمی‌شوند.</small></div>' +
      '<button type="button" class="bt bt-o" onclick="ptfTreasuryPrint()">🖨 پیش‌نمایش/چاپ</button></div></div>' +
      '<div id="treasuryKpi"></div><div id="treasuryFocus"></div><div id="treasuryMoves"></div></div>';
  };

  window.ptfTreasuryRender = function () {
    var box = document.getElementById('treasuryBox');
    if (!box) return;
    var c = window.ptfTreasuryDerivedCash();
    var kpi = document.getElementById('treasuryKpi');
    if (kpi) {
      kpi.innerHTML = '<div class="sr" style="margin:10px 0">' +
        '<div class="sc"><b>' + money(c.opening) + '</b><span>افتتاحیه</span></div>' +
        '<div class="sc"><b>' + money(c.inflow) + '</b><span>ورود نقد</span></div>' +
        '<div class="sc"><b>' + money(c.outflow) + '</b><span>خروج نقد</span></div>' +
        '<div class="sc"><b>' + money(c.derived) + '</b><span>مانده صندوق</span></div></div>' +
        chairPanelHtml();
    }
    var mv = document.getElementById('treasuryMoves');
    if (mv) {
      var moves = window.ptfTreasuryCrmMoves();
      mv.innerHTML = '<h5>گردش نقدی (وصولی ≠ فاکتور)</h5><div class="tb2"><table><thead><tr><th>تاریخ</th><th>منبع</th><th>شرح</th><th>جهت</th><th>مبلغ</th></tr></thead><tbody>' +
        (moves.map(function (m) {
          return '<tr><td>' + esc(m.dateFa || m.dateISO) + '</td><td>' + esc(m.src || '') + '</td><td>' + esc(m.label) + '</td><td>' + (m.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + money(m.amount) + '</td></tr>';
        }).join('') || '<tr><td colspan="5">گردش نقدی ثبت نشده</td></tr>') +
        '</tbody></table></div>';
    }
  };
})();
