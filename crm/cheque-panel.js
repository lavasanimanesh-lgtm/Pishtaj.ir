/* =====================================================================
   PTF CRM — cheque-panel.js — CHQ-MOD-001
   پنل «🧾 چک‌ها» در هاب مالی: دو زیرتب صادره/وارده + ثبت + عملیات + گزارش.
   ===================================================================== */
(function () {
  'use strict';

  function stLabel(c) {
    if (!c) return '';
    if (c.direction === 'received') {
      return { open: 'دریافت‌شده', held: 'در ید شرکت', endorsed: 'انتقال به تامین‌کننده', cleared: 'وصول‌شده', bounced: 'برگشتی', voided_transfer: 'انتقال ابطال‌شده', void: 'ابطال‌شده' }[c.st] || c.st;
    }
    return { open: 'صادرشده / در گردش', cleared: 'وصول‌شده', retrieved: 'مسترد شد (ضمانت)', void: 'ابطال‌شده', transferred: 'انتقال', voided_transfer: 'انتقال ابطال‌شده' }[c.st] || c.st;
  }
  function stColor(c) {
    var s = (c && c.st) || '';
    if (s === 'cleared' || s === 'retrieved') return '#047857';
    if (s === 'bounced' || s === 'void' || s === 'voided_transfer') return '#dc2626';
    if (s === 'endorsed' || s === 'transferred') return '#0e7490';
    return '#b45309';
  }
  function money(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function faD(d) { return d || '—'; }
  function escP(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  window.ptfChequePanelSub = 'issued'; /* issued | received */
  window.ptfChequeSetSub = function (s) { window.ptfChequePanelSub = s === 'received' ? 'received' : 'issued'; window.ptfChequePanelRender(); };

  function issuedRows() {
    return (typeof window.ptfChequeIssued === 'function' ? window.ptfChequeIssued() : [])
      .slice().sort(function (a, b) { return (a.dueISO || '') < (b.dueISO || '') ? -1 : 1; });
  }
  function receivedRows() {
    return (typeof window.ptfChequeReceived === 'function' ? window.ptfChequeReceived() : [])
      .slice().sort(function (a, b) { return (a.dueISO || '') < (b.dueISO || '') ? -1 : 1; });
  }

  function issuedTable() {
    var rows = issuedRows();
    var body = rows.map(function (c) {
      return '<tr><td><b dir="ltr">' + escP(c.sayad || c.no || '—') + '</b></td><td>' + escP(c.toWhom || c.payeeName || '—') + '</td><td>' + escP(c.bank || '—') + '</td><td>' + faD(c.dueFa || c.dueISO) + '</td><td>' + money(c.amt) + '</td><td style="color:' + stColor(c) + '">' + stLabel(c) + '</td><td>' + issuedActs(c) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">چک صادره‌ای ثبت نشده است</td></tr>';
    var openSum = rows.filter(function (c) { return c.st === 'open'; }).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    return '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>شماره/صیادی</th><th>طرف</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div style="margin-top:8px;font-size:12.5px"><b style="color:#b45309">جمع چک‌های در گردش: ' + money(openSum) + ' ریال</b></div>';
  }

  function receivedTable() {
    var rows = receivedRows();
    var body = rows.map(function (c) {
      return '<tr><td><b dir="ltr">' + escP(c.sayad || c.no || '—') + '</b></td><td>' + escP(c.payerName || c.sourceCustomerCd || '—') + '</td><td>' + escP(c.bank || '—') + '</td><td>' + faD(c.dueFa || c.dueISO) + '</td><td>' + money(c.amt) + '</td><td style="color:' + stColor(c) + '">' + stLabel(c) + '</td><td>' + receivedActs(c) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">چک وارده‌ای ثبت نشده است</td></tr>';
    var openSum = rows.filter(function (c) { return c.st === 'open' || c.st === 'held' || c.st === 'endorsed'; }).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    return '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>شماره/صیادی</th><th>صادرکننده</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div style="margin-top:8px;font-size:12.5px"><b style="color:#0e7490">جمع چک‌های فعال وارده: ' + money(openSum) + ' ریال</b></div>';
  }

  function issuedActs(c) {
    var acts = '';
    if (c.st === 'open' || c.st === 'transferred') {
      acts += '<button class="ba" style="color:#047857" onclick="ptfChequeClearIssuedUi(\'' + c.cd + '\')">✔ وصول</button> ';
      if (c.kind !== 'guarantee') acts += '<button class="ba" style="color:#dc2626" onclick="ptfChequeVoidIssuedUi(\'' + c.cd + '\')">ابطال</button>';
    }
    return acts || '<span style="color:#94a3b8">—</span>';
  }
  function receivedActs(c) {
    var acts = '';
    if (c.st === 'open' || c.st === 'held') {
      acts += '<button class="ba" style="color:#0e7490" onclick="ptfChequeEndorseUi(\'' + c.cd + '\')">↪ انتقال</button> ';
      acts += '<button class="ba" style="color:#047857" onclick="ptfChequeCollectUi(\'' + c.cd + '\')">✔ وصول</button> ';
      acts += '<button class="ba" style="color:#dc2626" onclick="ptfChequeBounceUi(\'' + c.cd + '\')">↩ برگشتی</button>';
    } else if (c.st === 'endorsed') {
      acts += '<button class="ba" style="color:#047857" onclick="ptfChequeCollectUi(\'' + c.cd + '\')">✔ وصول</button> ';
      acts += '<button class="ba" style="color:#b45309" onclick="ptfChequeVoidTransferUi(\'' + c.cd + '\')">↩ بازگشت انتقال</button>';
    } else if (c.st === 'bounced') {
      acts += '<button class="ba" style="color:#0e7490" onclick="ptfChequeEndorseUi(\'' + c.cd + '\')">↪ انتقال مجدد</button> ';
      acts += '<button class="ba" style="color:#dc2626" onclick="ptfChequeVoidIssuedUi(\'' + c.cd + '\')">ابطال</button>';
    }
    return acts || '<span style="color:#94a3b8">—</span>';
  }

  window.ptfChequePanelHtml = function () {
    var sub = window.ptfChequePanelSub === 'received' ? 'received' : 'issued';
    var tbtn = function (id, lb, cl) {
      var on = sub === id;
      return '<button class="bt" style="' + (on ? 'background:' + cl + ';color:#fff' : '') + '" onclick="ptfChequeSetSub(\'' + id + '\')">' + lb + '</button>';
    };
    var body = sub === 'received' ? receivedTable() : issuedTable();
    return '<div id="chequeBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">🧾 چک‌ها</h4><small style="color:#64748b">ماژول مستقل — صادره و وارده</small></div>' +
      '<div style="display:flex;gap:6px">' + tbtn('issued', '🏢 چک‌های صادره', '#b45309') + tbtn('received', '📥 چک‌های وارده', '#0e7490') +
      '<button class="bt bt-o" onclick="ptfChequeNewUi()">+ چک جدید</button>' +
      '<button class="bt bt-o" onclick="ptfChequePanelPdf()">🖨 PDF</button>' +
      '<button class="bt bt-o" onclick="ptfChequePanelCsv()">⬇ اکسل</button></div></div>' + body + '</div>';
  };

  window.ptfChequePanelRender = function () {
    var el = document.getElementById('chequeBox');
    if (el) el.outerHTML = window.ptfChequePanelHtml();
  };

  /* ---------- ثبت چک جدید ---------- */
  window.ptfChequeNewUi = function () {
    var sub = window.ptfChequePanelSub === 'received' ? 'received' : 'issued';
    ptfDialog({
      title: sub === 'received' ? '📥 ثبت چک وارده' : '🏢 ثبت چک صادره',
      body: sub === 'received' ? 'چک دریافتی از مشتری/سایر' : 'چک صادره (پرداخت/ضمانت)',
      fields: [
        { id: 'no', label: 'شماره / شناسه صیادی *', type: 'text', required: true, dir: 'ltr' },
        { id: 'party', label: sub === 'received' ? 'صادرکننده (مشتری/سایر) *' : 'طرف (تامین‌کننده/سایر) *', type: 'text', required: true },
        { id: 'amt', label: 'مبلغ (ریال) *', type: 'number', required: true, dir: 'ltr' },
        { id: 'due', label: 'سررسید (میلادی یا شمسی)', type: 'text', dir: 'ltr', placeholder: '1405/06/30 یا 2026-09-21' },
        { id: 'bank', label: 'بانک / شعبه', type: 'text' },
        { id: 'kind', label: 'نوع', type: 'select', options: sub === 'received' ? [{ v: 'finance', lb: 'مالی' }] : [{ v: 'finance', lb: 'مالی' }, { v: 'guarantee', lb: '🛡 ضمانت / سپرده' }] }
      ],
      okText: 'ثبت',
      onOk: function (v) {
        if (!String(v.no || '').trim() || !String(v.party || '').trim() || !(+v.amt > 0)) { alert('شماره، طرف و مبلغ الزامی است.'); return; }
        var rec = {
          no: String(v.no).trim(), sayad: String(v.no).trim(), amt: +v.amt || 0,
          toWhom: String(v.party).trim(), kind: v.kind || 'finance', bank: String(v.bank || '').trim(),
          dueISO: /^\d{4}-\d{2}-\d{2}$/.test(String(v.due || '')) ? v.due : '',
          dueFa: /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(String(v.due || '')) ? v.due : '',
          ownership: sub === 'received' ? 'received' : 'company'
        };
        if (sub === 'received') rec.payerName = String(v.party).trim();
        else rec.payeeName = String(v.party).trim();
        window.ptfChequeCreate(sub, rec);
        /* CHQ-MOD-001: یادآور سررسید برای چک وارده و صادره (غیر ضمانت/غیر ابطال) */
        try { if (typeof chUpsertReminder === 'function') chUpsertReminder(rec); } catch (eR) {}
        if (typeof ptfToast === 'function') ptfToast('چک ثبت شد.', 'ok');
        window.ptfChequePanelRender();
      }
    });
  };

  /* ---------- عملیات ---------- */
  window.ptfChequeEndorseUi = function (cd) {
    var chk = window.ptfChequeFind(cd);
    var dueFa = (chk && (chk.dueFa || chk.dueISO)) || '';
    var fy = String(dueFa).match(/(13|14)\d{2}/);
    try { if (fy && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(fy[0])) { alert('🔒 سال مالی ' + fy[0] + ' قفل است؛ انتقال چک مجاز نیست.'); return; } } catch (eF) {}
    ptfDialog({ title: '↪ انتقال چک وارده به تامین‌کننده', fields: [{ id: 'sup', label: 'نام تامین‌کننده *', type: 'text', required: true }], okText: 'انتقال', onOk: function (v) {
      var r = window.ptfChequeEndorse(cd, String(v.sup).trim());
      if (!r.ok) { alert(r.why === 'state' ? 'وضعیت چک اجازه انتقال نمی‌دهد.' : 'چک یافت نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('چک منتقل شد.', 'ok');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeCollectUi = function (cd) {
    var chk2 = window.ptfChequeFind(cd);
    var fy2 = String((chk2 && (chk2.dueFa || chk2.dueISO)) || '').match(/(13|14)\d{2}/);
    try { if (fy2 && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(fy2[0])) { alert('🔒 سال مالی ' + fy2[0] + ' قفل است؛ ثبت وصول مجاز نیست.'); return; } } catch (eF2) {}
    ptfDialog({ title: '✔ ثبت وصول چک', fields: [{ id: 'note', label: 'یادداشت', type: 'textarea', rows: 2 }], okText: 'وصول شد', onOk: function (v) {
      var c = window.ptfChequeFind(cd);
      var r = c && c.direction === 'received' ? window.ptfChequeCollect(cd, v.note) : window.ptfChequeClearIssued(cd, v.note);
      if (!r.ok) { alert('ثبت وصول ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('وصول چک ثبت شد.', 'ok');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeBounceUi = function (cd) {
    ptfDialog({ title: '↩ ثبت چک برگشتی', fields: [{ id: 'reason', label: 'دلیل برگشت *', type: 'text', required: true }], okText: 'ثبت برگشتی', onOk: function (v) {
      var r = window.ptfChequeBounce(cd, String(v.reason).trim());
      if (!r.ok) { alert('ثبت برگشتی ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('چک برگشتی ثبت شد.', 'warn');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeVoidTransferUi = function (cd) {
    ptfDialog({ title: '↩ بازگشت انتقال چک', fields: [{ id: 'reason', label: 'دلیل', type: 'text' }], okText: 'بازگشت', onOk: function (v) {
      var r = window.ptfChequeVoidTransfer(cd, String(v.reason || '').trim());
      if (!r.ok) { alert('بازگشت ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('انتقال بازگردانده شد.', 'ok');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeVoidIssuedUi = function (cd) {
    ptfDialog({ title: 'ابطال چک', fields: [{ id: 'reason', label: 'دلیل ابطال *', type: 'text', required: true }], okText: 'ابطال', danger: true, onOk: function (v) {
      var r = window.ptfChequeVoidIssued(cd, String(v.reason).trim());
      if (!r.ok) { alert('ابطال ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('چک ابطال شد.', 'warn');
      window.ptfChequePanelRender();
    } });
  };

  /* ---------- گزارش ---------- */
  window.ptfChequePanelRows = function () {
    var sub = window.ptfChequePanelSub === 'received' ? 'received' : 'issued';
    var rows = (sub === 'received' ? receivedRows() : issuedRows());
    return rows.map(function (c) {
      return { no: c.sayad || c.no || '', party: sub === 'received' ? (c.payerName || c.sourceCustomerCd || '') : (c.toWhom || c.payeeName || ''), bank: c.bank || '', due: c.dueFa || c.dueISO || '', amt: +c.amt || 0, st: stLabel(c), stEn: c.st };
    });
  };
  window.ptfChequePanelCsv = function () {
    var rows = window.ptfChequePanelRows();
    var csv = '\uFEFF' + [['شماره/صیادی', 'طرف', 'بانک', 'سررسید', 'مبلغ', 'وضعیت']]
      .concat(rows.map(function (r) { return [r.no, r.party, r.bank, r.due, r.amt, r.st]; }))
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = (window.ptfChequePanelSub === 'received' ? 'cheques-received' : 'cheques-issued') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };
  window.ptfChequePanelPdf = function () {
    var rows = window.ptfChequePanelRows(), sub = window.ptfChequePanelSub === 'received' ? 'وارده' : 'صادره';
    var body = rows.map(function (r) { return '<tr><td>' + escP(r.no) + '</td><td>' + escP(r.party) + '</td><td>' + escP(r.bank) + '</td><td>' + escP(r.due) + '</td><td>' + money(r.amt) + '</td><td>' + escP(r.st) + '</td></tr>'; }).join('');
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گزارش چک‌های ' + sub + '</h2><table><thead><tr><th>شماره/صیادی</th><th>طرف</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>' + body + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش چک‌های ' + sub, html, 'cheques-' + window.ptfChequePanelSub); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };
})();
