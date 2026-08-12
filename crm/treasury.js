/* PTF CRM — v34.4.81 خزانه نقدی کامل
   ورودی = وصولی واقعی (نه صدور فاکتور). خروجی = هزینه/خرید/شارژ تنخواه/چک سررسید/برداشت.
   تطبیق صورتحساب کنار گذاشته شد. */
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
  function looksBankHow(how) {
    var s = txt(how);
    return /حواله|بانک|bank|transfer|کارت|pos|شتاب/.test(s);
  }
  function looksNonBankHow(how) {
    var s = txt(how);
    return /نقد|cash|سایر|other|تهاتر|اعتبار|credit|چک|cheque|چک\s/.test(s) && !looksBankHow(how);
  }

  /* فقط حرکت وجه در حساب شرکت باید با صورتحساب تطبیق شود. */
  window.ptfTreasuryBankExpected = function (move) {
    return !!(move && move.bankExpected);
  };

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

  function loadRecon() {
    var raw;
    try {
      raw = (typeof window.getData === 'function') ? window.getData(KEY) : JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) { raw = []; }
    if (raw && !Array.isArray(raw) && raw.lines) return arr(raw.lines);
    return arr(raw);
  }
  function saveRecon(lines) {
    if (typeof window.setData === 'function') window.setData(KEY, lines);
    else localStorage.setItem(KEY, JSON.stringify(lines));
  }
  window.ptfTreasuryReconLines = loadRecon;

  function takenKeys(exceptCd) {
    var used = {};
    loadRecon().forEach(function (l) {
      if (!l || !l.matchKey) return;
      if (exceptCd && l.cd === exceptCd) return;
      used[l.matchKey] = true;
    });
    return used;
  }

  window.ptfTreasurySuggestMatch = function (line) {
    var amt = num(line.amount);
    var d = String(line.dateISO || '').slice(0, 10);
    var used = takenKeys(line && line.cd);
    return window.ptfTreasuryCrmMoves().filter(function (m) {
      if (!m.bankExpected) return false;
      if (used[m.key]) return false;
      if (m.dir !== line.dir) return false;
      if (Math.abs(m.amount - amt) > 1) return false;
      if (d && m.dateISO && Math.abs(Date.parse(d) - Date.parse(m.dateISO)) > 4 * 86400000) return false;
      return true;
    });
  };

  window.ptfTreasuryUnmatched = function () {
    return { lines: [], moves: [] };
  };

  function digitFa(s) {
    return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  function parseAmt(v) {
    var s = digitFa(v).replace(/[,،\s]/g, '').replace(/[^\d.-]/g, '');
    return num(s);
  }
  function parseDir(v, amtSigned) {
    var s = String(v || '').toLowerCase();
    if (/out|debit|برداشت|بدهکار|خروج|پرداخت/.test(s)) return 'out';
    if (/in|credit|واریز|بستانکار|ورود|وصول/.test(s)) return 'in';
    if (amtSigned < 0) return 'out';
    if (amtSigned > 0) return 'in';
    return '';
  }
  function parseDateCell(v) {
    var s = digitFa(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y >= 1300 && y <= 1599 && typeof window.ptfJToISO === 'function') {
      try { return String(window.ptfJToISO(y + '/' + mo + '/' + d) || '').slice(0, 10); } catch (e) { return ''; }
    }
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function headerIdx(head) {
    var map = {};
    (head || []).forEach(function (h, i) {
      var t = digitFa(h).toLowerCase();
      if (/تاریخ|date/.test(t)) map.date = i;
      else if (/برداشت|بدهکار|debit|خروج/.test(t)) map.debit = i;
      else if (/واریز|بستانکار|credit|ورود/.test(t)) map.credit = i;
      else if (/مبلغ|amount/.test(t)) map.amount = i;
      else if (/جهت|dir|نوع/.test(t)) map.dir = i;
      else if (/شرح|توضیح|note|desc/.test(t)) map.note = i;
    });
    return map;
  }
  window.ptfTreasuryParseStatementRows = function (rows) {
    rows = arr(rows);
    if (!rows.length) return [];
    var start = 0, idx = headerIdx(rows[0]);
    if (idx.date != null || idx.amount != null || idx.debit != null || idx.credit != null) start = 1;
    else idx = { date: 0, amount: 1, dir: 2, note: 3 };
    var out = [];
    for (var r = start; r < rows.length; r++) {
      var row = arr(rows[r]);
      if (!row.length) continue;
      var debit = idx.debit != null ? parseAmt(row[idx.debit]) : 0;
      var credit = idx.credit != null ? parseAmt(row[idx.credit]) : 0;
      var amount = 0, dir = '';
      if (debit && !credit) { amount = Math.abs(debit); dir = 'out'; }
      else if (credit && !debit) { amount = Math.abs(credit); dir = 'in'; }
      else {
        var raw = idx.amount != null ? row[idx.amount] : row[1];
        var signed = parseAmt(raw);
        amount = Math.abs(signed);
        dir = parseDir(idx.dir != null ? row[idx.dir] : row[2], signed);
      }
      if (!amount || !dir) continue;
      var dateISO = parseDateCell(idx.date != null ? row[idx.date] : row[0]);
      var note = String((idx.note != null ? row[idx.note] : row[3]) || '').trim();
      out.push({
        amount: amount, dir: dir, note: note,
        dateISO: dateISO || new Date().toISOString().slice(0, 10),
        dateFa: dateISO || '',
        fp: [dateISO || '', dir, amount, note].join('|')
      });
    }
    return out;
  };

  window.ptfTreasuryImportParsed = function (parsed) {
    parsed = arr(parsed);
    if (!parsed.length) return { added: 0, skipped: 0 };
    var lines = loadRecon();
    var have = {};
    lines.forEach(function (l) {
      have[[l.dateISO || '', l.dir || '', num(l.amount), l.note || ''].join('|')] = true;
    });
    var added = 0, skipped = 0;
    parsed.forEach(function (p, i) {
      var fp = p.fp || [p.dateISO || '', p.dir || '', num(p.amount), p.note || ''].join('|');
      if (have[fp]) { skipped++; return; }
      have[fp] = true;
      var cd = (typeof window.ptfUnifiedCode === 'function') ? window.ptfUnifiedCode('BRC') : ('BRC-' + Date.now() + '-' + i);
      lines.unshift({
        cd: cd, amount: p.amount, dir: p.dir, note: p.note || '',
        dateISO: p.dateISO, dateFa: p.dateFa || p.dateISO,
        matchKey: '', matchCd: '', files: [], src: 'statement-import',
        t: new Date().toISOString()
      });
      added++;
    });
    saveRecon(lines);
    return { added: added, skipped: skipped };
  };

  window.ptfTreasuryImportFile = function (inp) {
    var f = inp && inp.files && inp.files[0];
    if (!f) return;
    function done(rows) {
      var parsed = window.ptfTreasuryParseStatementRows(rows);
      var r = window.ptfTreasuryImportParsed(parsed);
      if (typeof ptfToast === 'function') ptfToast(r.added + ' ردیف وارد شد' + (r.skipped ? ' / ' + r.skipped + ' تکراری رد شد' : '') + ' — مانده بانک ساخته نشد', r.added ? 'ok' : 'info');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      try { inp.value = ''; } catch (e) {}
    }
    var isX = /\.xlsx?$/i.test(f.name);
    var rd = new FileReader();
    if (isX) {
      if (typeof XLSX === 'undefined') { alert('کتابخانه اکسل بارگذاری نشده'); return; }
      rd.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
          done(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }));
        } catch (e) { alert('خواندن اکسل ناموفق: ' + e.message); }
      };
      rd.readAsArrayBuffer(f);
    } else {
      rd.onload = function () {
        var text = String(rd.result || '').replace(/^\uFEFF/, '');
        var rows = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) {
          return l.split(/[,;\t]/).map(function (c) { return c.replace(/^"|"$/g, '').trim(); });
        });
        done(rows);
      };
      rd.readAsText(f, 'utf-8');
    }
  };

  window.ptfTreasuryNormalizeAiRows = function (rows) {
    return arr(rows).map(function (r) {
      var dir = parseDir(r.dir || r.kind || '', parseAmt(r.amount || r.amt));
      var amount = Math.abs(parseAmt(r.amount || r.amt || r.debit || r.credit));
      if (!dir && parseAmt(r.debit)) { dir = 'out'; amount = Math.abs(parseAmt(r.debit)); }
      if (!dir && parseAmt(r.credit)) { dir = 'in'; amount = Math.abs(parseAmt(r.credit)); }
      var dateISO = parseDateCell(r.dateISO || r.dateFa || r.date || r.dt || '');
      var note = String(r.note || r.desc || r.description || '').trim();
      return {
        amount: amount, dir: dir, note: note,
        dateISO: dateISO || new Date().toISOString().slice(0, 10),
        dateFa: r.dateFa || dateISO || '',
        fp: [dateISO || '', dir, amount, note].join('|')
      };
    }).filter(function (p) { return p.amount && (p.dir === 'in' || p.dir === 'out'); });
  };

  window.ptfTreasuryImportPdf = function (inp) {
    var f = inp && inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 6 * 1048576) { alert('فایل بزرگتر از ۶MB'); return; }
    if (typeof ptfToast === 'function') ptfToast('⏳ در حال استخراج ردیف‌های صورتحساب…', 'info');
    var rd = new FileReader();
    rd.onload = function () {
      var b64 = String(rd.result || '').split(',')[1] || '';
      var headers = (typeof ptfApiAuthHeaders === 'function') ? ptfApiAuthHeaders(true) : { 'Content-Type': 'application/json' };
      fetch('../api/llm.php?action=bank_statement', { method: 'POST', headers: headers, body: JSON.stringify({ mime: f.type || 'application/pdf', b64: b64 }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) {
            if (typeof ptfToast === 'function') ptfToast((d && d.error) || 'استخراج ناموفق', 'warn');
            else alert((d && d.error) || 'استخراج ناموفق');
            return;
          }
          var parsed = window.ptfTreasuryNormalizeAiRows((d.data && d.data.rows) || []);
          window._ptfTreasuryPdfPreview = { parsed: parsed, name: f.name, bank: (d.data && d.data.bank) || '', account: (d.data && d.data.account) || '' };
          window.ptfTreasuryShowPdfPreview();
        })
        .catch(function () {
          if (typeof ptfToast === 'function') ptfToast('عدم دسترسی به سرویس استخراج', 'warn');
        });
    };
    rd.readAsDataURL(f);
    try { inp.value = ''; } catch (e) {}
  };

  window.ptfTreasuryShowPdfPreview = function () {
    var prev = window._ptfTreasuryPdfPreview || { parsed: [] };
    var host = document.getElementById('panels') || document.body;
    var old = document.getElementById('ptfTreasuryPdfDlg');
    if (old) old.remove();
    var rows = arr(prev.parsed).map(function (p, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.dateFa || p.dateISO) + '</td><td>' + (p.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + money(p.amount) + '</td><td>' + esc(p.note) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">ردیفی استخراج نشد</td></tr>';
    host.insertAdjacentHTML('beforeend',
      '<div class="md-b" id="ptfTreasuryPdfDlg" style="display:grid;z-index:1800" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:720px;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
      '<h3>بازبینی استخراج صورتحساب</h3>' +
      '<small style="color:#0369a1;display:block;margin-bottom:8px;line-height:1.8">این ردیف‌ها فقط یادداشت مغایرت می‌شوند. مانده بانک ساخته نمی‌شود. ' +
      esc(prev.name || '') + (prev.bank ? ' — ' + esc(prev.bank) : '') + '</small>' +
      '<div class="tb2"><table><thead><tr><th>#</th><th>تاریخ</th><th>جهت</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">' +
      '<button type="button" class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button type="button" class="bt" onclick="ptfTreasuryCommitPdfPreview()">ثبت به‌عنوان یادداشت مغایرت</button></div></div></div>');
  };

  window.ptfTreasuryCommitPdfPreview = function () {
    var prev = window._ptfTreasuryPdfPreview || { parsed: [] };
    var r = window.ptfTreasuryImportParsed(prev.parsed);
    var dlg = document.getElementById('ptfTreasuryPdfDlg');
    if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast(r.added + ' ردیف از PDF وارد شد' + (r.skipped ? ' / ' + r.skipped + ' تکراری' : '') + ' — مانده بانک ساخته نشد', r.added ? 'ok' : 'info');
    if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
  };

  window.ptfTreasuryTemplateCsv = function () {
    var csv = '\uFEFFتاریخ,مبلغ,جهت,شرح\n1404/05/21,1500000,ورود,نمونه واریز\n1404/05/22,200000,خروج,نمونه برداشت\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ptf-bank-statement-template.csv';
    a.click();
  };

  window.ptfTreasuryAddLine = function () {
    var todayJ = '';
    try { todayJ = (typeof faDate === 'function') ? faDate() : ''; } catch (eD) {}
    if (!todayJ) todayJ = new Date().toLocaleDateString('fa-IR');
    function go(v) {
      var amt = parseAmt(v.amt);
      if (!amt) {
        alert('مبلغ ردیف صورتحساب را وارد کنید (ارقام فارسی هم قبول است).');
        return;
      }
      var dir = (v.dir === 'out') ? 'out' : 'in';
      var dateISO = parseDateCell(v.date) || new Date().toISOString().slice(0, 10);
      var lines = loadRecon();
      var cd = (typeof window.ptfUnifiedCode === 'function') ? window.ptfUnifiedCode('BRC') : ('BRC-' + Date.now());
      lines.unshift({
        cd: cd, amount: amt, dir: dir, note: String(v.note || '').trim(),
        dateISO: dateISO, dateFa: v.date || dateISO,
        matchKey: '', matchCd: '', files: [], src: 'manual', t: new Date().toISOString()
      });
      saveRecon(lines);
      if (typeof ptfConfirmCloudSave === 'function') ptfConfirmCloudSave('ردیف صورتحساب روی این دستگاه ثبت شد'); else if (typeof ptfToast === 'function') ptfToast('ردیف صورتحساب ثبت شد — مانده بانک عوض نشد', 'ok');
      if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
      if (typeof window.finHubSet === 'function') window.finHubSet('treasury');
    }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: 'ردیف صورتحساب بانک',
        body: 'این ردیف فقط یادداشت است و موجودی خزانه را عوض نمی‌کند. تطبیق با اسناد CRM انجام نمی‌شود.',
        fields: [
          { id: 'amt', label: 'مبلغ (ریال) *', required: true, dir: 'ltr' },
          { id: 'dir', label: 'جهت حرکت وجه در بانک', type: 'select', options: [{ v: 'in', lb: 'ورود / واریز به حساب' }, { v: 'out', lb: 'خروج / برداشت از حساب' }] },
          { id: 'date', label: 'تاریخ ردیف (شمسی)', value: todayJ, dir: 'ltr', datePicker: true },
          { id: 'note', label: 'شرح روی صورتحساب', type: 'textarea', rows: 2 }
        ],
        okText: 'ثبت یادداشت',
        onOk: go
      });
      return;
    }
    var amt = prompt('مبلغ ردیف صورتحساب (ریال)');
    if (amt == null) return;
    go({ amt: amt, dir: confirm('ورود وجه؟ OK=ورود / انصراف=خروج') ? 'in' : 'out', date: todayJ, note: prompt('شرح ردیف بانک') || '' });
  };

  window.ptfTreasuryLink = function () { return false; };

  window.ptfTreasuryMatchMove = function () { if (typeof ptfToast === 'function') ptfToast('تطبیق صورتحساب کنار گذاشته شد', 'info'); };

  window.ptfTreasuryOpenFromQuality = function () { if (typeof window.finHubSet === 'function') window.finHubSet('treasury'); };

  window.ptfTreasuryMatch = function () { if (typeof ptfToast === 'function') ptfToast('تطبیق صورتحساب کنار گذاشته شد', 'info'); };

  window.ptfTreasuryAutoMatch = function () { if (typeof ptfToast === 'function') ptfToast('تطبیق صورتحساب کنار گذاشته شد', 'info'); };

  window.ptfTreasuryAttach = function (cd) {
    var host = document.getElementById('panels') || document.body;
    var old = document.getElementById('ptfTreasuryAttachDlg');
    if (old) old.remove();
    host.insertAdjacentHTML('beforeend',
      '<div class="md-b" id="ptfTreasuryAttachDlg" style="display:grid;z-index:1800" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:520px" onclick="event.stopPropagation()"><h3>پیوست صورتحساب — ' + esc(cd) + '</h3>' +
      '<small style="color:#64748b;display:block;margin-bottom:8px">این فایل مانده بانک نمی‌سازد؛ فقط سند تطبیق است.</small>' +
      '<div id="ptfTrUp"></div><div id="ptfTrFiles"></div>' +
      '<div style="text-align:left;margin-top:12px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>');
    function paint() {
      var line = loadRecon().filter(function (x) { return x.cd === cd; })[0];
      var box = document.getElementById('ptfTrFiles');
      if (!box || !line) return;
      box.innerHTML = arr(line.files).map(function (f) {
        var key = String(f.key || '').replace(/[\\']/g, '');
        return '<div style="display:flex;gap:8px;padding:4px 0"><a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\',\'' + esc(f.name || '') + '\')" style="color:#0e7490">📎 ' + esc(f.name || 'فایل') + '</a>' +
          '<button type="button" class="ba" style="color:#dc2626" onclick="ptfTreasuryRemoveFile(\'' + esc(cd) + '\',\'' + key + '\')">✕</button></div>';
      }).join('') || '<small style="color:#94a3b8">فایلی نیست</small>';
    }
    paint();
    if (typeof attachUploadWidget === 'function') {
      attachUploadWidget('ptfTrUp', 'treasury', function (rec) {
        var lines = loadRecon();
        var line = lines.filter(function (x) { return x.cd === cd; })[0];
        if (!line) return;
        line.files = arr(line.files);
        line.files.push(rec);
        line.t = new Date().toISOString();
        saveRecon(lines);
        paint();
        window.ptfTreasuryRender();
      });
    }
  };

  window.ptfTreasuryRemoveFile = function (cd, key) {
    if (!confirm('این پیوست از یادداشت مغایرت حذف شود؟')) return;
    function drop() {
      var lines = loadRecon();
      var line = lines.filter(function (x) { return x.cd === cd; })[0];
      if (!line) return;
      line.files = arr(line.files).filter(function (f) { return f.key !== key; });
      line.t = new Date().toISOString();
      saveRecon(lines);
      var dlg = document.getElementById('ptfTreasuryAttachDlg');
      if (dlg) window.ptfTreasuryAttach(cd);
      window.ptfTreasuryRender();
    }
    if (typeof window.ptfDeleteStoredFile === 'function') {
      window.ptfDeleteStoredFile(key, function (res) {
        if (!res.ok && typeof ptfToast === 'function') ptfToast(res.error || 'حذف ابری ناموفق', 'warn');
        drop();
      });
    } else drop();
  };

  window.ptfTreasuryHtml = function () {
    return '<div id="treasuryBox" class="pn" style="display:none;margin-top:12px;padding:14px;border:1px solid #bae6fd;border-radius:16px;background:#f0f9ff">' +
      '<div class="treasury-head"><h4 style="margin:0 0 6px">خزانه نقدی شرکت</h4>' +
      '<small style="color:#0369a1;display:block;margin-bottom:10px;line-height:1.8">این تب موجودی مستقل بانک نمی‌سازد. مانده = افتتاحیه سال + تمام وصولی‌های واقعی − هزینه/خرید/شارژ تنخواه/چک سررسید/برداشت. صدور فاکتور و تهاتر وارد صندوق نمی‌شوند.</small>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="bt" onclick="ptfTreasuryAddLine()">+ ردیف صورتحساب</button>' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'ptfTrStmtInp\').click()">ورود اکسل/CSV</button>' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'ptfTrPdfInp\').click()">استخراج PDF/عکس</button>' +
      '<button type="button" class="bt bt-o" onclick="ptfTreasuryTemplateCsv()">الگوی CSV</button>' +
      '<input type="file" id="ptfTrStmtInp" accept=".csv,.xlsx,.xls" style="display:none" onchange="ptfTreasuryImportFile(this)">' +
      '<input type="file" id="ptfTrPdfInp" accept="application/pdf,image/*" style="display:none" onchange="ptfTreasuryImportPdf(this)"></div></div>' +
      '<div id="treasuryKpi"></div><div id="treasuryFocus"></div><div id="treasuryMoves"></div><div id="treasuryRecon"></div></div>';
  };

  window.ptfTreasuryRender = function () {
    var box = document.getElementById('treasuryBox');
    if (!box) return;
    var c = window.ptfTreasuryDerivedCash();
    var u = window.ptfTreasuryUnmatched();
    var focus = window._ptfTreasuryFocus || null;
    var kpi = document.getElementById('treasuryKpi');
    if (kpi) {
      kpi.innerHTML = '<div class="sr" style="margin:10px 0">' +
        '<div class="sc"><b>' + money(c.opening) + '</b><span>افتتاحیه نقد/بانک</span></div>' +
        '<div class="sc"><b>' + money(c.inflow) + '</b><span>ورود مشتق</span></div>' +
        '<div class="sc"><b>' + money(c.outflow) + '</b><span>خروج مشتق</span></div>' +
        '<div class="sc"><b>' + money(c.derived) + '</b><span>مانده مشتق (نه دفتر بانک)</span></div>' +
        '</div>';
    }
    var used = takenKeys();
    var moves = window.ptfTreasuryCrmMoves();
    var focusEl = document.getElementById('treasuryFocus');
    if (focusEl) {
      var focusMove = focus && focus.id ? moves.filter(function (m) { return m.key === focus.id; })[0] : null;
      var focusLine = focus && focus.id ? loadRecon().filter(function (l) { return l.cd === focus.id; })[0] : null;
      focusEl.innerHTML = '';
    }
    var mv = document.getElementById('treasuryMoves');
    if (mv) {
      mv.innerHTML = '<h5>گردش نقدی (وصولی ≠ فاکتور)</h5><div class="tb2"><table><thead><tr><th>تاریخ</th><th>منبع</th><th>شرح</th><th>جهت</th><th>مبلغ</th></tr></thead><tbody>' +
        (moves.map(function (m) {
          var rid = 'trMove-' + String(m.key || '').replace(/[^a-zA-Z0-9_-]/g, '_');
          return '<tr id="' + rid + '"><td>' + esc(m.dateFa || m.dateISO) + '</td><td>' + esc(m.src || '') + '</td><td>' + esc(m.label) + '</td><td>' + (m.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + money(m.amount) + '</td></tr>';
        }).join('') || '<tr><td colspan="5">گردش نقدی ثبت نشده</td></tr>') +
        '</tbody></table></div>';
    }
    var lines = loadRecon();
    var rec = document.getElementById('treasuryRecon');
    if (rec) {
      rec.innerHTML = '<h5>یادداشت صورتحساب (بدون تطبیق)</h5><div class="tb2"><table><thead><tr><th>کد</th><th>مبلغ</th><th>جهت</th><th>شرح</th><th></th></tr></thead><tbody>' +
        (lines.map(function (l) {
          var on = focus && focus.kind === 'bank' && focus.id === l.cd;
          return '<tr id="trBank-' + esc(l.cd) + '"' + (on ? ' style="outline:2px solid #f59e0b;background:#fffbeb"' : '') + '><td>' + esc(l.cd) + '</td><td>' + money(l.amount) + '</td><td>' + (l.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + esc(l.note || '') + '</td><td dir="ltr">' + esc(l.matchKey || '—') + '</td>' +
            '<td><button type="button" class="ba" onclick="ptfTreasuryMatch(\'' + esc(l.cd) + '\')">تطبیق</button> <button type="button" class="ba" onclick="ptfTreasuryAttach(\'' + esc(l.cd) + '\')">📎</button></td></tr>';
        }).join('') || '<tr><td colspan="5">ردیفی نیست</td></tr>') +
        '</tbody></table></div>';
    }
  };
})();
