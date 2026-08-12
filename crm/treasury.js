/* PTF CRM — v34.4.83 خزانه نقدی
   ورودی = وصولی واقعی. خروجی = هزینه/خرید/شارژ تنخواه/چک سررسید/برداشت/فراخوان. */
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

    get('ptf_crm_offers').forEach(function (o) {
      if (!o || !o.advance) return;
      arr(o.advance.payments).forEach(function (p, i) {
        if (!active(p) || p.voided || p.status === 'reversal') return;
        var amt = num(p.amt || p.amount);
        if (!amt) return;
        if (payIsCheque(p)) return;
        pushMove(out, {
          key: 'advpay:' + (o.no || o.cd || '') + ':' + (p.cd || i),
          cd: p.cd || o.no || '',
          dir: 'in',
          amount: amt,
          dateISO: isoOf(p) || isoOf(o),
          dateFa: faOf(p) || faOf(o),
          src: 'وصولی پیش‌پرداخت',
          label: 'وصولی پیش‌پرداخت ' + (o.no || '') + (o.buyerCo ? ' — ' + o.buyerCo : '')
        });
      });
    });

    get('ptf_crm_invoices').filter(active).forEach(function (inv) {
      arr(inv.payments).concat(arr(inv.pays)).forEach(function (p, i) {
        if (!active(p) || p.voided || p.status === 'reversal') return;
        var amt = num(p.amt || p.amount || p.amountIrr);
        if (!amt) return;
        if (p.fromAdvance) return;
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

    get('ptf_crm_petty_tx').filter(active).forEach(function (tx) {
      var kind = txt(tx.kind || tx.type || '');
      if (kind !== 'charge' && kind !== 'direct' && kind.indexOf('شارژ') < 0) return;
      if (kind.indexOf('settle') > -1 || kind.indexOf('تسویه') > -1) return;
      var amt = num(tx.amt || tx.amount);
      if (!amt) return;
      var isCharge = kind === 'charge' || kind.indexOf('شارژ') > -1;
      pushMove(out, {
        key: 'petty:' + (tx.cd || tx.id || ''),
        cd: tx.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(tx),
        dateFa: faOf(tx),
        src: isCharge ? 'شارژ تنخواه' : 'پرداخت مستقیم تنخواه',
        label: (isCharge ? 'شارژ تنخواه ' : 'پرداخت مستقیم تنخواه ') + (tx.cd || '')
      });
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


  window.ptfTreasuryHtml = function () {
    return '<div id="treasuryBox" class="pn" style="display:none;margin-top:12px;padding:14px;border:1px solid #bae6fd;border-radius:16px;background:#f0f9ff">' +
      '<div class="treasury-head"><h4 style="margin:0 0 6px">خزانه نقدی شرکت</h4>' +
      '<small style="color:#0369a1;display:block;margin-bottom:10px;line-height:1.8">مانده = افتتاحیه سال + وصولی واقعی − هزینه/خرید/شارژ تنخواه/چک سررسید/برداشت. فاکتور و تهاتر وارد صندوق نمی‌شوند. تطبیق صورتحساب وجود ندارد.</small></div>' +
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
        '<div class="sc"><b>' + money(c.derived) + '</b><span>مانده صندوق</span></div></div>';
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
