/* =====================================================================
   PTF CRM — Sprint 283
   Customer accounts: derived read-only balances, searchable and ordered.
   No account balance is persisted here; invoices remain the source of truth.
   ===================================================================== */
(function () {
  'use strict';
  function m(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function active(v) { return v && v.status !== 'void' && v.st !== 'void' && v.void !== true; }
  function cust(cd) { return getData('ptf_crm_customers').filter(function (c) { return c.cd === cd; })[0]; }
  function nameOf(c) { return (c && (c.co || c.name || c.cd)) || ''; }
  function invs(cd) {
    var offers = getData('ptf_crm_offers');
    return getData('ptf_crm_invoices').filter(function (i) {
      if (!active(i)) return false;
      var o = offers.filter(function (x) { return x.no === i.offerNo; })[0] || {};
      return o.buyerCd === cd;
    });
  }
  function paid(i) {
    return (i.payments || []).concat(i.pays || []).filter(active).reduce(function (s, p) { return s + (+p.amt || +p.amount || 0); }, 0);
  }
  function bal(cd) { return invs(cd).reduce(function (s, i) { return s + Math.max(0, (+i.amount || 0) - paid(i)); }, 0); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }

  /* Useful to UI and deterministic tests; it never writes to localStorage. */
  window.cfAccountRows = function (query) {
    var q = norm(query == null ? window._cfSearch : query);
    return getData('ptf_crm_customers').map(function (c) {
      return { cd: c.cd, co: nameOf(c), balance: bal(c.cd) };
    }).filter(function (r) {
      return !q || norm(r.co).indexOf(q) > -1 || norm(r.cd).indexOf(q) > -1;
    }).sort(function (a, b) {
      var aOpen = Math.abs(a.balance) > 0.000001, bOpen = Math.abs(b.balance) > 0.000001;
      if (aOpen !== bOpen) return aOpen ? -1 : 1; /* non-zero accounts always first */
      if (aOpen && Math.abs(a.balance) !== Math.abs(b.balance)) return Math.abs(b.balance) - Math.abs(a.balance);
      return String(a.co).localeCompare(String(b.co), 'fa');
    });
  };

  window.cfOpen = function (cd) {
    var c = cust(cd); if (!c) return;
    var rows = invs(cd).map(function (i) {
      var ps = (i.payments || []).concat(i.pays || []).filter(active), r = Math.max(0, (+i.amount || 0) - paid(i));
      return '<tr><td>' + escP(i.invDate || i.t || '') + '</td><td>' + escP(i.no || i.cd) + '</td><td>' + m(i.amount) + ' ریال</td><td>' + m(paid(i)) + ' ریال</td><td>' + m(r) + ' ریال</td></tr>' +
        ps.map(function (p) { return '<tr style="background:#f0fdf4"><td>' + escP(p.t || p.date || '') + '</td><td>وصولی</td><td>—</td><td>' + m(p.amt || p.amount) + ' ریال</td><td>—</td></tr>'; }).join('');
    }).join('');
    var h = '<div class="md-b" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>📘 حساب مشتری — ' + escP(nameOf(c)) + '</h3><div style="background:#fefce8;padding:10px;border-radius:10px">مطالبات باز: <b>' + m(bal(cd)) + ' ریال</b></div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>سند</th><th>فاکتور</th><th>وصولی</th><th>مانده</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">گردشی نیست</td></tr>') + '</tbody></table></div><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', h);
  };

  window.cfFinanceHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(function (r) { return Math.abs(r.balance) > 0.000001; }).length;
    var table = rows.map(function (r) {
      var open = Math.abs(r.balance) > 0.000001;
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td><button class="ba" onclick="cfOpen(\'' + escP(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return '<div id="cfFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">📘 حساب مشتریان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب با مانده غیرصفر، ابتدا نمایش داده می‌شود.</small></div><input id="cfSearch" value="' + escP(q) + '" oninput="cfFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد مشتری" style="min-width:230px;direction:rtl"></div><div class="tb2" style="margin-top:10px"><table><thead><tr><th>مشتری</th><th>مطالبات باز</th><th></th></tr></thead><tbody>' + (table || '<tr><td colspan="3">موردی مطابق جست‌وجو نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.cfFinanceSearch = function (v) {
    window._cfSearch = String(v || '');
    var el = document.getElementById('cfFinanceHubBox');
    if (el) el.outerHTML = window.cfFinanceHtml();
  };

  var old = window.buildPetty;
  if (typeof old === 'function') window.buildPetty = function () { return old() + window.cfFinanceHtml(); };
})();
