/* PTF CRM — v34.4.58 P6 خزانه: تطبیق یکتا + پیوست صورتحساب + کیفیت داده
   موجودی بانک منبع چهارم نیست: گردش از اسناد CRM خوانده می‌شود.
   ptf_crm_bank_recon فقط یادداشت تطبیق صورتحساب است. */
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

  window.ptfTreasuryCrmMoves = function () {
    var out = [];
    get('ptf_crm_invoices').filter(active).forEach(function (inv) {
      arr(inv.payments).concat(arr(inv.pays)).filter(active).forEach(function (p, i) {
        var amt = num(p.amt || p.amount);
        if (!amt) return;
        out.push({
          key: 'invpay:' + (inv.cd || inv.id || '') + ':' + (p.cd || p.id || i),
          cd: inv.cd || '',
          dir: 'in',
          amount: amt,
          dateISO: isoOf(p) || isoOf(inv),
          dateFa: faOf(p) || faOf(inv),
          label: 'وصولی مشتری ' + (inv.cd || '')
        });
      });
    });
    get('ptf_crm_supplier_finance').filter(active).forEach(function (row) {
      var kind = String(row.kind || row.type || '').toLowerCase();
      if (kind.indexOf('pay') < 0 && kind !== 'sfp' && kind !== 'payment') return;
      var amt = num(row.amt || row.amount || row.amountIrr);
      if (!amt) return;
      out.push({
        key: 'suppay:' + (row.cd || row.id || ''),
        cd: row.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(row),
        dateFa: faOf(row),
        label: 'پرداخت تأمین ' + (row.cd || '')
      });
    });
    get('ptf_crm_petty_tx').filter(active).forEach(function (tx) {
      var kind = String(tx.kind || tx.type || '').toLowerCase();
      if (kind.indexOf('charge') < 0 && kind.indexOf('شارژ') < 0) return;
      var amt = num(tx.amt || tx.amount);
      if (!amt) return;
      out.push({
        key: 'petty:' + (tx.cd || tx.id || ''),
        cd: tx.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(tx),
        dateFa: faOf(tx),
        label: 'شارژ تنخواه ' + (tx.cd || '')
      });
    });
    get('ptf_crm_cheques_received').filter(active).forEach(function (ch) {
      var st = String(ch.st || ch.status || '').toLowerCase();
      if (st.indexOf('collect') < 0 && st.indexOf('وصول') < 0 && !ch.collected) return;
      var amt = num(ch.amt || ch.amount);
      if (!amt) return;
      out.push({
        key: 'chqin:' + (ch.cd || ch.id || ''),
        cd: ch.cd || '',
        dir: 'in',
        amount: amt,
        dateISO: isoOf(ch),
        dateFa: faOf(ch),
        label: 'وصول چک وارده ' + (ch.cd || '')
      });
    });
    get('ptf_crm_cheques_issued').filter(active).forEach(function (ch) {
      var st = String(ch.st || ch.status || '').toLowerCase();
      if (st.indexOf('pass') < 0 && st.indexOf('وصول') < 0 && st.indexOf('clear') < 0 && !ch.cleared) return;
      var amt = num(ch.amt || ch.amount);
      if (!amt) return;
      out.push({
        key: 'chqout:' + (ch.cd || ch.id || ''),
        cd: ch.cd || '',
        dir: 'out',
        amount: amt,
        dateISO: isoOf(ch),
        dateFa: faOf(ch),
        label: 'وصول چک صادره ' + (ch.cd || '')
      });
    });
    return out.sort(function (a, b) { return String(b.dateISO).localeCompare(String(a.dateISO)); });
  };

  window.ptfTreasuryDerivedCash = function () {
    var opening = 0;
    try {
      get('ptf_crm_finance').forEach(function (r) {
        if (String(r.category || r.kind || '') === 'cash_bank') opening += num(r.amountIrr || r.amt || r.amount);
      });
    } catch (e) {}
    var inn = 0, out = 0;
    window.ptfTreasuryCrmMoves().forEach(function (m) {
      if (m.dir === 'in') inn += m.amount; else out += m.amount;
    });
    return { opening: opening, inflow: inn, outflow: out, derived: opening + inn - out };
  };

  function loadRecon() {
    var raw = get(KEY);
    if (raw && raw.lines) return arr(raw.lines);
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
      if (used[m.key]) return false;
      if (m.dir !== line.dir) return false;
      if (Math.abs(m.amount - amt) > 1) return false;
      if (d && m.dateISO && Math.abs(Date.parse(d) - Date.parse(m.dateISO)) > 4 * 86400000) return false;
      return true;
    });
  };

  window.ptfTreasuryUnmatched = function () {
    var lines = loadRecon();
    var used = takenKeys();
    var unmatchedLines = lines.filter(function (l) { return l && !l.matchKey; });
    var unmatchedMoves = window.ptfTreasuryCrmMoves().filter(function (m) { return !used[m.key]; });
    return { lines: unmatchedLines, moves: unmatchedMoves };
  };

  window.ptfTreasuryAddLine = function () {
    var amt = prompt('مبلغ ردیف صورتحساب (ریال)');
    if (amt == null) return;
    amt = num(String(amt).replace(/[^\d.-]/g, ''));
    if (!amt) return;
    var dir = confirm('ورود وجه (OK) یا خروج (Cancel)؟') ? 'in' : 'out';
    var note = prompt('شرح ردیف بانک') || '';
    var lines = loadRecon();
    var cd = (typeof window.ptfUnifiedCode === 'function') ? window.ptfUnifiedCode('BRC') : ('BRC-' + Date.now());
    lines.unshift({
      cd: cd, amount: amt, dir: dir, note: note,
      dateISO: new Date().toISOString().slice(0, 10),
      dateFa: new Date().toLocaleDateString('fa-IR'),
      matchKey: '', matchCd: '', files: [], t: new Date().toISOString()
    });
    saveRecon(lines);
    if (typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
  };

  window.ptfTreasuryMatch = function (cd) {
    var lines = loadRecon();
    var line = lines.filter(function (x) { return x.cd === cd; })[0];
    if (!line) return;
    var sug = window.ptfTreasurySuggestMatch(line);
    var msg = sug.length
      ? ('پیشنهاد: ' + sug.slice(0, 5).map(function (s) { return s.key + ' ' + s.label; }).join(' | '))
      : 'پیشنهاد خودکار نبود. کلید رویداد CRM را وارد کنید.';
    var key = prompt(msg + '\nکلید رویداد CRM (خالی = لغو تطبیق)', line.matchKey || (sug[0] && sug[0].key) || '');
    if (key == null) return;
    line.matchKey = String(key || '').trim();
    var hit = window.ptfTreasuryCrmMoves().filter(function (m) { return m.key === line.matchKey; })[0];
    line.matchCd = hit ? hit.cd : '';
    line.t = new Date().toISOString();
    saveRecon(lines);
    window.ptfTreasuryRender();
  };

  window.ptfTreasuryAutoMatch = function () {
    var lines = loadRecon();
    var n = 0;
    lines.forEach(function (line) {
      if (!line || line.matchKey) return;
      var sug = window.ptfTreasurySuggestMatch(line);
      if (sug.length !== 1) return;
      line.matchKey = sug[0].key;
      line.matchCd = sug[0].cd || '';
      line.t = new Date().toISOString();
      n++;
    });
    saveRecon(lines);
    if (typeof ptfToast === 'function') ptfToast(n ? (n + ' ردیف یکتا تطبیق شد') : 'تطبیق یکتای جدیدی نبود', n ? 'ok' : 'info');
    window.ptfTreasuryRender();
  };

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
      '<div class="treasury-head"><h4 style="margin:0 0 6px">خزانه و مغایرت بانکی (مشتق)</h4>' +
      '<small style="color:#0369a1;display:block;margin-bottom:10px;line-height:1.8">این تب موجودی مستقل بانک نمی‌سازد. ماندهٔ نمایشی = افتتاحیه نقد/بانک + وصولی‌های ثبت‌شده − پرداخت‌های ثبت‌شده. ردیف صورتحساب فقط یادداشت تطبیق است.</small>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="bt" onclick="ptfTreasuryAddLine()">+ ردیف صورتحساب</button>' +
      '<button type="button" class="bt bt-o" onclick="ptfTreasuryAutoMatch()">تطبیق خودکار یکتا</button></div></div>' +
      '<div id="treasuryKpi"></div><div id="treasuryMoves"></div><div id="treasuryRecon"></div></div>';
  };

  window.ptfTreasuryRender = function () {
    var box = document.getElementById('treasuryBox');
    if (!box) return;
    var c = window.ptfTreasuryDerivedCash();
    var u = window.ptfTreasuryUnmatched();
    var kpi = document.getElementById('treasuryKpi');
    if (kpi) {
      kpi.innerHTML = '<div class="sr" style="margin:10px 0">' +
        '<div class="sc"><b>' + money(c.opening) + '</b><span>افتتاحیه نقد/بانک</span></div>' +
        '<div class="sc"><b>' + money(c.inflow) + '</b><span>ورود مشتق</span></div>' +
        '<div class="sc"><b>' + money(c.outflow) + '</b><span>خروج مشتق</span></div>' +
        '<div class="sc"><b>' + money(c.derived) + '</b><span>مانده مشتق (نه دفتر بانک)</span></div>' +
        '<div class="sc"><b>' + u.lines.length + '</b><span>ردیف بانک بدون تطبیق</span></div>' +
        '<div class="sc"><b>' + u.moves.length + '</b><span>گردش CRM بدون تطبیق</span></div></div>';
    }
    var moves = window.ptfTreasuryCrmMoves();
    var mv = document.getElementById('treasuryMoves');
    if (mv) {
      mv.innerHTML = '<h5>گردش مشتق از اسناد CRM</h5><div class="tb2"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>جهت</th><th>مبلغ</th><th>کلید</th></tr></thead><tbody>' +
        (moves.slice(0, 80).map(function (m) {
          return '<tr><td>' + esc(m.dateFa || m.dateISO) + '</td><td>' + esc(m.label) + '</td><td>' + (m.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + money(m.amount) + '</td><td dir="ltr">' + esc(m.key) + '</td></tr>';
        }).join('') || '<tr><td colspan="5">گردش مشتق ثبت نشده</td></tr>') +
        '</tbody></table></div>';
    }
    var lines = loadRecon();
    var rec = document.getElementById('treasuryRecon');
    if (rec) {
      rec.innerHTML = '<h5>یادداشت مغایرت صورتحساب</h5><div class="tb2"><table><thead><tr><th>کد</th><th>مبلغ</th><th>جهت</th><th>شرح</th><th>تطبیق</th><th></th></tr></thead><tbody>' +
        (lines.map(function (l) {
          return '<tr><td>' + esc(l.cd) + '</td><td>' + money(l.amount) + '</td><td>' + (l.dir === 'in' ? 'ورود' : 'خروج') + '</td><td>' + esc(l.note || '') + '</td><td dir="ltr">' + esc(l.matchKey || '—') + '</td>' +
            '<td><button type="button" class="ba" onclick="ptfTreasuryMatch(\'' + esc(l.cd) + '\')">تطبیق</button></td></tr>';
        }).join('') || '<tr><td colspan="6">ردیفی نیست</td></tr>') +
        '</tbody></table></div>';
    }
  };
})();
