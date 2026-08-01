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
    acts += '<button class="ba" style="color:#7c3aed" onclick="ptfChequePrint(\'' + c.cd + '\')">🖨 چاپ برگه</button>';
    return acts;
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
      '<button class="bt" style="background:#7c3aed;color:#fff" onclick="ptfChequeAiOpenSub()">🤖 دستیار هوشمند</button>' + '<button class="bt bt-o" onclick="ptfChequeNewUi()">+ چک جدید</button>' +
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

/* CHQ-V2: باز کردن دستیار با جهتِ زیرتب فعلی پنل */
window.ptfChequeAiOpenSub = function () {
  window.ptfChequeAiOpen(window.ptfChequePanelSub === 'received' ? 'received' : 'issued');
};

/* ============ CHQ-V2: دستیار هوشمند چک (OCR) در پنل چک — ثبت در ماژول جدید + اثر مالی ============ */
window.ptfChequeAiOpen = function (direction) {
  var dir = direction === 'received' ? 'received' : 'issued';
  var html = '<div class="md-b" id="ptfChAiDlg" style="display:grid;z-index:2300" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:700px;max-height:94vh;overflow:auto">' +
    '<h3>🤖 دستیار هوشمند چک — ' + (dir === 'received' ? 'چک وارده' : 'چک صادره') + '</h3>' +
    '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#5b21b6;margin-bottom:10px">عکس/PDF چک را بدهید؛ سیستم شناسه صیادی، مبلغ، تاریخ و ذینفع را می‌خواند. اگر موردی ناقص بود، از فهرست تامین‌کننده/مشتری انتخاب کنید یا دستی وارد کنید. ثبت نهایی فقط پس از تایید شما.</div>' +
    '<input type="file" id="ptfChAiFile" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="ptfChAiFileGo(this)">' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt" onclick="document.getElementById(\'ptfChAiFile\').click()">📎 عکس/PDF چک</button><button class="bt bt-o" onclick="ptfChAiTextBox()">📝 ورود متن</button></div>' +
    '<div id="ptfChAiStatus" style="margin-top:10px;font-size:12.5px;color:#64748b"></div>' +
    '<div id="ptfChAiOut" style="margin-top:12px"></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  window._ptfChAiDir = dir;
};
window.ptfChAiApi = function (body, cb) {
  fetch('../api/llm.php?action=cheque', { method: 'POST', headers: (typeof ptfApiAuthHeaders === 'function' ? ptfApiAuthHeaders(true) : { 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).then(cb).catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور AI' }); });
};
window.ptfChAiTextBox = function () {
  var out = document.getElementById('ptfChAiOut'); if (!out) return;
  out.innerHTML = '<div class="fld"><label>متن مشخصات چک</label><textarea id="ptfChAiText" rows="4" placeholder="چک صیاد... مبلغ... سررسید 1405/06/15..."></textarea></div><button class="bt" onclick="ptfChAiTextGo()">استخراج از متن</button>';
};
window.ptfChAiTextGo = function () {
  var txt = ((document.getElementById('ptfChAiText') || {}).value || '').trim();
  if (!txt) { alert('متن را وارد کنید'); return; }
  var st = document.getElementById('ptfChAiStatus'); if (st) st.textContent = '⏳ در حال استخراج...';
  ptfChAiApi({ text: txt }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج شد'; ptfChAiRender(d.data || {}); });
};
window.ptfChAiFileGo = function (inp) {
  var f = inp.files[0]; if (!f) return;
  if (f.size > 8 * 1048576) { alert('فایل بزرگتر از ۸MB است'); return; }
  var st = document.getElementById('ptfChAiStatus'); if (st) st.textContent = '⏳ در حال خواندن فایل...';
  var rd = new FileReader();
  rd.onload = function () {
    var b64 = String(rd.result).split(',')[1];
    ptfChAiApi({ mime: f.type, b64: b64 }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج شد'; ptfChAiRender(d.data || {}, f); });
  };
  rd.readAsDataURL(f); inp.value = '';
};
window.ptfChAiRender = function (c, fileObj) {
  window._ptfChAiData = c || {};
  var dir = window._ptfChAiDir === 'received' ? 'received' : 'issued';
  var out = document.getElementById('ptfChAiOut'); if (!out) return;
  var supOpts = '<option value="">— انتخاب تامین‌کننده —</option>';
  var custOpts = '<option value="">— انتخاب مشتری —</option>';
  try {
    (getData('ptf_crm_suppliers') || []).slice(0, 200).forEach(function (x) { supOpts += '<option value="' + escP(x.cd) + '">' + escP(x.co || x.cd) + '</option>'; });
    (getData('ptf_crm_customers') || []).slice(0, 200).forEach(function (x) { custOpts += '<option value="' + escP(x.cd) + '">' + escP(x.co || x.cd) + '</option>'; });
  } catch (eL) {}
  out.innerHTML =
    '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:12px">' +
    '<div class="fr"><div class="fld"><label>شماره چک / صیاد *</label><input id="ptfChAiNo" value="' + escP(c.no || c.sayad || '') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>مبلغ (ریال) *</label><input id="ptfChAiAmt" data-money="1" inputmode="numeric" value="' + escP(c.amt || '') + '" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld"><label>در وجه (ذینفع)</label><input id="ptfChAiTo" value="' + escP(c.toWhom || c.payee || '') + '" placeholder="نام ذینفع (اگر روی چک هست)"></div>' +
    '<div class="fld"><label>بانک / شعبه</label><input id="ptfChAiBank" value="' + escP(c.bank || '') + '"></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ سررسید (شمسی) *</label>' + (typeof ptfDatePicker === 'function' ? ptfDatePicker('ptfChAiDueJ', c.dueISO || '', '1405/06/15') : '<input id="ptfChAiDueJ" value="' + escP(c.dueJ || '') + '" style="direction:ltr">') + '</div>' +
    '<div class="fld"><label>نوع چک</label><select id="ptfChAiKind"><option value="finance">مالی</option><option value="guarantee">ضمانت/سپرده</option></select></div></div>' +
    (dir === 'received'
      ? '<div class="fr"><div class="fld"><label>مشتری (صادرکننده) *</label><select id="ptfChAiCust" onchange="ptfChAiCustInv()">' + custOpts + '</select></div><div class="fld"><label>فاکتور باز (اختیاری — برای کسر از مطالبات)</label><select id="ptfChAiInv"><option value="">— انتخاب فاکتور —</option></select></div></div>'
      : '<div class="fld"><label>تامین‌کننده (ذینفع) *</label><select id="ptfChAiSup">' + supOpts + '</select></div>') +
    '<div class="fld"><label>📎 کپی چک (اختیاری — ضمیمه شود)</label><div id="ptfChAiUp" style="min-height:40px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
    '<div class="fld"><label>یادداشت</label><input id="ptfChAiNote" value="' + escP(c.note || '') + '"></div>' +
    '<button class="bt" style="margin-top:6px" onclick="ptfChAiCommit()">✅ ثبت چک</button></div>';
  /* کپی چک (اختیاری) */
  window._ptfChAiFiles = [];
  try { if (typeof attachUploadWidget === 'function') attachUploadWidget('ptfChAiUp', 'cheques/', function (fr) { if (fr) window._ptfChAiFiles.push(fr); }); } catch (eU) {}
  if (fileObj && fileObj.name) window._ptfChAiFileName = fileObj.name;
};
window.ptfChAiCustInv = function () {
  var custCd = ((document.getElementById('ptfChAiCust') || {}).value || '');
  var sel = document.getElementById('ptfChAiInv'); if (!sel) return;
  var opts = '<option value="">— انتخاب فاکتور —</option>';
  try {
    var offers = getData('ptf_crm_offers') || [];
    (getData('ptf_crm_invoices') || []).forEach(function (inv) {
      var o = offers.filter(function (x) { return x.no === inv.offerNo; })[0] || {};
      if (o.buyerCd !== custCd) return;
      var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s2, p) { return s2 + (+p.amt || 0); }, 0);
      var rem = (+inv.amount || 0) - paid;
      if (rem > 0.5) opts += '<option value="' + escP(inv.cd) + '">' + escP(inv.no || inv.cd) + ' — مانده ' + (+rem).toLocaleString('fa-IR') + '</option>';
    });
  } catch (eI) {}
  sel.innerHTML = opts;
};
window.ptfChAiCommit = function () {
  var dir = window._ptfChAiDir === 'received' ? 'received' : 'issued';
  var no = ((document.getElementById('ptfChAiNo') || {}).value || '').trim();
  var amt = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('ptfChAiAmt') || {}).value) : +((document.getElementById('ptfChAiAmt') || {}).value || 0);
  var dueRaw = ((document.getElementById('ptfChAiDueJ') || {}).value || '').trim();
  var bank = ((document.getElementById('ptfChAiBank') || {}).value || '').trim();
  var note = ((document.getElementById('ptfChAiNote') || {}).value || '').trim();
  var kind = ((document.getElementById('ptfChAiKind') || {}).value === 'guarantee') ? 'guarantee' : 'finance';
  var toWhom = ((document.getElementById('ptfChAiTo') || {}).value || '').trim();
  if (!no || !amt) { alert('شماره چک و مبلغ الزامی است'); return; }
  if (kind !== 'guarantee' && !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(window.ptfPettyNormDate ? window.ptfPettyNormDate(dueRaw) : dueRaw) && !/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) { alert('تاریخ سررسید (شمسی) الزامی است'); return; }
  var dueFa = /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dueRaw) ? dueRaw : (typeof ptfISOToJ === 'function' ? (ptfISOToJ(dueRaw) || '') : '');
  var rec = { no: no, sayad: no, amt: amt, bank: bank, note: note, kind: kind, toWhom: toWhom, files: window._ptfChAiFiles || [] };
  if (dir === 'received') {
    var custCd = ((document.getElementById('ptfChAiCust') || {}).value || '');
    var invCd = ((document.getElementById('ptfChAiInv') || {}).value || '');
    if (!custCd) { alert('مشتری (صادرکننده چک) را انتخاب کنید یا دستی وارد کنید'); return; }
    var cRec = (getData('ptf_crm_customers') || []).filter(function (x) { return x.cd === custCd; })[0] || {};
    rec.sourceCustomerCd = custCd; rec.payerName = cRec.co || cRec.name || custCd; rec.sourceInvoiceCd = invCd || '';
    rec.dueFa = dueFa;
  } else {
    var supCd = ((document.getElementById('ptfChAiSup') || {}).value || '');
    if (!supCd) { alert('تامین‌کننده (ذینفع) را انتخاب کنید'); return; }
    var sRec = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === supCd; })[0] || {};
    rec.supplierCd = supCd; rec.supplierName = sRec.co || sRec.name || supCd; rec.toWhom = rec.toWhom || sRec.co || supCd;
    rec.dueFa = dueFa;
  }
  var ch = window.ptfChequeCreate(dir, rec);
  try { if (typeof chUpsertReminder === 'function') chUpsertReminder(ch); } catch (eR) {}
  var dlg = document.getElementById('ptfChAiDlg'); if (dlg) dlg.remove();
  if (typeof ptfToast === 'function') ptfToast('چک ثبت شد' + ((ch.financial && ch.financial.ok) ? ' و در حساب ' + (dir === 'received' ? 'مشتری' : 'تامین‌کننده') + ' منظور شد' : '') + '.', 'ok');
  window.ptfChequePanelRender();
};

/* ============ CHQ-V2: چاپ برگه چک فیزیکی (صیادی، مبلغ به حروف، تاریخ، ذینفع) ============ */
window.ptfNumToFaWords = function (num) {
  num = Math.round(+num || 0);
  if (num === 0) return 'صفر ریال';
  var ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  var tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var groups = [['', '', ''], ['هزار', '', ''], ['میلیون', '', ''], ['میلیارد', '', '']];
  function three(n) {
    var h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
    var parts = [];
    if (h) parts.push(hundreds[h]);
    if (t === 1) parts.push(ones[t * 10 + o]);
    else { if (t > 1) parts.push(tens[t]); if (o) parts.push(ones[o]); }
    return parts.join(' و ');
  }
  var parts = [], g = 0;
  while (num > 0) { parts.unshift(num % 1000); num = Math.floor(num / 1000); g++; }
  var groupStrs = parts.map(function (p, i) {
    var gi = parts.length - 1 - i;
    if (p === 0) return '';
    return three(p) + (groups[gi][0] ? ' ' + groups[gi][0] : '');
  }).filter(Boolean);
  var words = groupStrs.join(' و ');
  return words + ' ریال';
};
window.ptfChequePrint = function (cd) {
  var c = window.ptfChequeFind(cd);
  if (!c) { alert('چک یافت نشد.'); return; }
  var amtWords = window.ptfNumToFaWords(c.amt);
  var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>' +
    'body{font-family:Tahoma,Arial;padding:30px;color:#111}' +
    '.cheque{width:100%;max-width:800px;margin:0 auto;border:2px solid #1e293b;border-radius:12px;padding:22px;box-sizing:border-box;background:#fff}' +
    '.ch-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:10px;margin-bottom:16px}' +
    '.ch-row{display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #e2e8f0;padding:10px 4px}' +
    '.ch-lbl{color:#475569;font-size:12px}' +
    '.ch-val{font-size:15px;font-weight:bold}' +
    '.amt-words{font-size:14px;line-height:2;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:12px 0;background:#f8fafc}' +
    '.sign{margin-top:26px;display:flex;justify-content:space-between;align-items:flex-end}' +
    '.sign-line{width:200px;border-top:1px solid #64748b;padding-top:6px;font-size:11px;color:#64748b;text-align:center}' +
    '@media print{body{padding:0}.cheque{border-width:1px}}' +
    '</style></head><body><div class="cheque">' +
    '<div class="ch-head"><b style="font-size:17px">چک بانکی — پیشرو تجهیز فرتاک</b><span style="direction:ltr;font-size:13px;color:#0e7490">' + escP(c.sayad || c.no || '') + '</span></div>' +
    '<div class="ch-row"><span class="ch-lbl">تاریخ سررسید</span><span class="ch-val">' + escP(c.dueFa || c.dueISO || '—') + '</span></div>' +
    '<div class="ch-row"><span class="ch-lbl">در وجه</span><span class="ch-val">' + escP(c.toWhom || c.payeeName || '—') + '</span></div>' +
    '<div class="ch-row"><span class="ch-lbl">بانک / شعبه</span><span class="ch-val">' + escP(c.bank || '—') + '</span></div>' +
    '<div class="ch-row"><span class="ch-lbl">مبلغ (عدد)</span><span class="ch-val" dir="ltr">' + (+c.amt || 0).toLocaleString('en-US') + ' ریال</span></div>' +
    '<div class="amt-words"><b>مبلغ به حروف:</b> ' + escP(amtWords) + '</div>' +
    (c.note ? '<div style="font-size:12px;color:#475569;margin:8px 0">یادداشت: ' + escP(c.note) + '</div>' : '') +
    '<div class="sign"><div class="sign-line">مهر و امضا</div><div class="sign-line">امضای مجاز</div></div>' +
    '</div></body></html>';
  if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('برگه چک ' + (c.sayad || c.no || c.cd), html, 'cheque-' + (c.sayad || c.no || c.cd)); return; }
  var w = window.open('', '_blank'); if (!w) return;
  w.document.write(html); w.document.close(); w.print();
};
