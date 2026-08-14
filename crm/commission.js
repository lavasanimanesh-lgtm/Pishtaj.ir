/* =====================================================================
   PTF CRM — Commission workspace
   پورسانت فروش: گزارش مالیِ هم‌سبک هاب، با دوره شمسی و مبنای قابل حسابرسی.
   داده پیکربندی در ptf_crm_settings.commission می‌ماند؛ هیچ دفتر مستقل یا
   ثبت پرداخت خودکاری ساخته نمی‌شود.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'ptf_crm_settings';
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function num(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function money(v) { return Math.round(num(v)).toLocaleString('fa-IR') + ' ریال'; }
  function role() { try { return String(curRole() || ''); } catch (e) { return ''; } }
  function isSenior() { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role()) > -1; }
  function me() { try { return (curSession() || {}).user || ''; } catch (e) { return ''; } }
  function data(k) { try { return getData(k) || []; } catch (e) { return []; } }
  function settings() { var s = data(KEY); return s && !Array.isArray(s) ? s : {}; }
  function saveSettings(s) { return setData(KEY, s); }
  function cfg() {
    var st = settings(); var c = st.commission || {};
    return { basis: c.basis === 'won' ? 'won' : 'collected', defaultPct: Math.max(0, Math.min(50, num(c.defaultPct == null ? 1 : c.defaultPct))), byUser: c.byUser || {} };
  }
  function userPct(u) { var c = cfg(); return c.byUser[u] != null && c.byUser[u] !== '' ? Math.max(0, Math.min(50, num(c.byUser[u]))) : c.defaultPct; }
  function users() { return data('ptf_crm_users').filter(function (u) { var r = u.roleId || u.role || ''; return u && (['sales', 'commercial', 'ceo', 'chairman', 'admin'].indexOf(r) > -1 || !r); }); }
  function userLabel(u) { var hit = users().filter(function (x) { return (x.username || x.user) === u; })[0]; return hit ? (hit.name || hit.nm || u) : (u || 'بدون مالک'); }
  function faMonth() {
    try { if (typeof faMonthNow === 'function') return String(faMonthNow()); } catch (e) {}
    try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit' }).format(new Date()).replace('-', '/'); } catch (e2) { return ''; }
  }
  function normMonth(v) {
    var s = String(v || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/-/g, '/').replace(/\s/g, '');
    var m = s.match(/^(1[34]\d{2})\/(\d{1,2})$/); if (!m || +m[2] < 1 || +m[2] > 12) return faMonth();
    return m[1] + '/' + String(+m[2]).padStart(2, '0');
  }
  function jalaliNextMonth(m) { var p = normMonth(m).split('/'), y = +p[0], mo = +p[1] + 1; if (mo > 12) { y++; mo = 1; } return y + '/' + String(mo).padStart(2, '0'); }
  function toIso(v) {
    var s = String(v || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var iso = s.match(/(19|20)\d{2}-\d{2}-\d{2}/); if (iso) return iso[0];
    var j = s.match(/(1[34]\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (j && typeof ptfJToISO === 'function') { try { return ptfJToISO(j[1] + '/' + j[2] + '/' + j[3]) || ''; } catch (e) {} }
    return '';
  }
  function bounds(month) {
    /* سازگاری با لینک/تستر قدیمی YYYY-MM؛ UI جدید فقط ماه شمسی می‌سازد. */
    var raw = String(month || '').trim();
    if (/^(19|20)\d{2}-\d{2}$/.test(raw)) {
      var y = +raw.slice(0, 4), m = +raw.slice(5, 7), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
      return { month: raw, start: raw + '-01', end: ny + '-' + String(nm).padStart(2, '0') + '-01' };
    }
    month = normMonth(raw);
    var start = typeof ptfJToISO === 'function' ? (ptfJToISO(month + '/01') || '') : '';
    var end = typeof ptfJToISO === 'function' ? (ptfJToISO(jalaliNextMonth(month) + '/01') || '') : '';
    return { month: month, start: start, end: end };
  }
  function inBounds(v, b) { var iso = toIso(v); return !!(iso && b.start && b.end && iso >= b.start && iso < b.end); }
  function offerTotal(o) { return (o && o.items || []).reduce(function (s, it) { return s + num(it.qty) * num(it.price); }, 0); }
  function ownerOf(o) {
    if (!o) return '';
    var c = data('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd || (o.buyerCo && (x.co === o.buyerCo || x.coEn === o.buyerCo)); })[0];
    return (c && (c.owner || c.crBy)) || o.owner || o.issuedBy || o.crBy || '';
  }
  function activePayment(p) { return !!p && p.status !== 'void' && p.status !== 'reversal' && !p.voided; }

  window.ptfCommissionCalc = function (opts) {
    opts = opts || {}; var c = cfg(), basis = opts.basis || c.basis, b = bounds(opts.month || opts.period || faMonth()), only = opts.user || '', map = {};
    function row(u) { u = u || '_unassigned'; if (!map[u]) map[u] = { user: u, label: userLabel(u === '_unassigned' ? '' : u), pct: userPct(u === '_unassigned' ? '' : u), base: 0, lines: [] }; return map[u]; }
    if (basis === 'won') {
      data('ptf_crm_offers').forEach(function (o) {
        if (!o || o.kind === 'TO' || o.st !== 'won') return;
        var when = o.wonAt || o.dateEn || o.t || ''; if (!inBounds(when, b)) return;
        var u = ownerOf(o); if (only && u !== only) return;
        var amount = offerTotal(o); if (!amount) return;
        var r = row(u); r.base += amount; r.lines.push({ type: 'won', ref: o.no || '', buyer: o.buyerCo || '', amount: amount, date: when });
      });
    } else {
      var offers = {}; data('ptf_crm_offers').forEach(function (o) { if (o && o.no) offers[o.no] = o; });
      data('ptf_crm_invoices').forEach(function (inv) {
        if (!inv || inv.status === 'void') return;
        var o = offers[inv.offerNo] || {}, u = ownerOf(o); if (only && u !== only) return;
        (inv.payments || []).concat(inv.pays || []).filter(activePayment).forEach(function (p, i) {
          var when = p.dateISO || p.iso || p.date || p.t || inv.issueDate || inv.date || inv.t || '';
          if (!inBounds(when, b)) return;
          var amount = num(p.amountIrr || p.amt || p.amount); if (!amount) return;
          var r = row(u); r.base += amount; r.lines.push({ type: 'receipt', ref: inv.no || inv.cd || '', offer: inv.offerNo || '', buyer: o.buyerCo || '', amount: amount, date: when, paymentId: p.cd || i });
        });
      });
    }
    var rows = Object.keys(map).map(function (k) { var r = map[k]; r.commission = Math.round(r.base * r.pct / 100); return r; }).filter(function (r) { return r.base > 0 || r.user === '_unassigned'; }).sort(function (a, b2) { return b2.commission - a.commission; });
    return { basis: basis, period: b, rows: rows, totalBase: rows.reduce(function (s, r) { return s + r.base; }, 0), totalCommission: rows.reduce(function (s, r) { return s + r.commission; }, 0), cfg: c };
  };

  function configRows(c) { return users().map(function (u) { var id = u.username || u.user || ''; if (!id) return ''; var pct = c.byUser[id] == null ? '' : c.byUser[id]; return '<tr><td>' + esc(u.name || u.nm || id) + '<small style="color:#64748b"> ' + esc(id) + '</small></td><td><input id="cmPct_' + esc(id) + '" value="' + esc(pct) + '" inputmode="decimal" placeholder="' + c.defaultPct + '" style="width:74px;direction:ltr"></td></tr>'; }).join(''); }
  function reportRows(res) { return res.rows.map(function (r) { var lines = r.lines.slice(0, 5).map(function (x) { return '<div class="cm-line">' + esc(x.date) + ' · ' + esc(x.ref) + (x.buyer ? ' · ' + esc(x.buyer) : '') + ' · ' + money(x.amount) + '</div>'; }).join('') || '<div class="cm-line">رکورد قابل محاسبه‌ای نیست</div>'; return '<details class="cm-row"><summary><span><b>' + esc(r.label) + '</b><small>' + esc(r.user === '_unassigned' ? 'مالک مشخص نشده' : r.user) + ' · ' + r.pct + '٪</small></span><span><small>مبنا: ' + money(r.base) + '</small><b>' + money(r.commission) + '</b></span></summary><div class="cm-lines">' + lines + (r.lines.length > 5 ? '<div class="cm-line">… ' + (r.lines.length - 5) + ' ردیف دیگر</div>' : '') + '</div></details>'; }).join('') || '<div class="cm-empty">در این دوره، وصولی/برد قابل محاسبه‌ای پیدا نشد.</div>'; }
  function styleOnce() {
    if (document.getElementById('cmHubCss')) return;
    var s = document.createElement('style'); s.id = 'cmHubCss'; s.textContent = '#commissionBox{background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:14px;margin-top:12px}.cm-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.cm-kpis{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;margin:12px 0}.cm-kpi{padding:10px;border:1px solid var(--brd);border-radius:12px;background:var(--bg,#f8fafc)}.cm-kpi small,.cm-row small,.cm-line{display:block;color:#64748b;font-size:11px;margin-top:3px}.cm-row{border:1px solid var(--brd);border-radius:12px;padding:9px 11px;margin:7px 0;background:var(--crd,#fff)}.cm-row summary{display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none}.cm-row summary::-webkit-details-marker{display:none}.cm-row summary>span:last-child{text-align:left}.cm-row summary b:last-child{display:block;color:#0e7490;margin-top:3px}.cm-lines{border-top:1px dashed var(--brd);margin-top:8px;padding-top:5px}.cm-empty{padding:20px;text-align:center;color:#64748b;border:1px dashed var(--brd);border-radius:12px}.cm-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:end}.cm-controls input,.cm-controls select,#cmConfig input{border:1px solid var(--brd);border-radius:9px;padding:7px;background:var(--crd,#fff);color:var(--tx,#111)}@media(max-width:600px){.cm-kpis{grid-template-columns:1fr}.cm-row summary{align-items:flex-start}.cm-controls{width:100%}.cm-controls .fld{flex:1 1 130px}}'; document.head.appendChild(s);
  }
  window.ptfCommissionHtml = function () {
    if (!isSenior()) return '';
    styleOnce(); var c = cfg(), month = normMonth(window._cmMonth || faMonth()), basis = window._cmBasis || c.basis, res = window.ptfCommissionCalc({ month: month, basis: basis });
    var unassigned = res.rows.filter(function (r) { return r.user === '_unassigned' && r.base > 0; })[0];
    return '<section id="commissionBox"><div class="cm-head"><div><h4 style="margin:0">💸 پورسانت فروش</h4><small style="color:#64748b">مبنای شفاف، دوره شمسی و محاسبه از وصولی واقعی یا CO برنده</small></div><div class="cm-controls"><div class="fld"><label>دوره شمسی</label><input id="cmMonth" value="' + esc(month) + '" placeholder="1405/05" inputmode="numeric"></div><div class="fld"><label>مبنا</label><select id="cmBasis"><option value="collected"' + (basis === 'collected' ? ' selected' : '') + '>وصولی واقعی</option><option value="won"' + (basis === 'won' ? ' selected' : '') + '>CO برنده</option></select></div><button class="bt bt-o" onclick="ptfCommissionRefresh()">🔄 محاسبه</button><button class="bt bt-o" onclick="ptfCommissionPrint()">🖨 چاپ</button></div></div>' +
      '<div class="cm-kpis"><div class="cm-kpi"><small>مبنای محاسبه</small><b>' + money(res.totalBase) + '</b></div><div class="cm-kpi"><small>جمع پورسانت پیشنهادی</small><b style="color:#0e7490">' + money(res.totalCommission) + '</b></div><div class="cm-kpi"><small>کارشناسان دارای رکورد</small><b>' + res.rows.filter(function (r) { return r.user !== '_unassigned'; }).length.toLocaleString('fa-IR') + '</b></div></div>' +
      (unassigned ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px;font-size:12px;color:#92400e">⚠️ ' + money(unassigned.base) + ' مبنای پورسانت مالک مشخص ندارد؛ مالک مشتری یا صادرکننده پیشنهاد را اصلاح کنید.</div>' : '') +
      '<div id="cmRows">' + reportRows(res) + '</div><details id="cmConfig" style="margin-top:12px"><summary style="cursor:pointer;font-weight:800">⚙️ قواعد و درصدهای پورسانت</summary><div style="margin-top:10px"><div class="cm-controls"><div class="fld"><label>درصد پیش‌فرض</label><input id="cmDefPct" value="' + c.defaultPct + '" inputmode="decimal"></div><button class="bt" onclick="ptfCommissionSaveCfg()">ذخیره قواعد</button></div><div class="tb2" style="margin-top:8px"><table><thead><tr><th>کارشناس</th><th>درصد اختصاصی</th></tr></thead><tbody>' + (configRows(c) || '<tr><td colspan="2">کاربر فروش یافت نشد</td></tr>') + '</tbody></table></div></div></details></section>';
  };
  window.ptfCommissionRefresh = function () { window._cmMonth = normMonth((document.getElementById('cmMonth') || {}).value); window._cmBasis = (document.getElementById('cmBasis') || {}).value === 'won' ? 'won' : 'collected'; var old = document.getElementById('commissionBox'); if (old) old.outerHTML = window.ptfCommissionHtml(); if (typeof window.finHubOrder === 'function') window.finHubOrder(); };
  window.ptfCommissionSaveCfg = function () { if (!isSenior()) { alert('⛔ فقط مدیران ارشد'); return; } var s = settings(), by = {}; users().forEach(function (u) { var id = u.username || u.user || '', el = document.getElementById('cmPct_' + id); if (id && el && String(el.value).trim() !== '') by[id] = Math.max(0, Math.min(50, num(el.value))); }); s.commission = { basis: (document.getElementById('cmBasis') || {}).value === 'won' ? 'won' : 'collected', defaultPct: Math.max(0, Math.min(50, num((document.getElementById('cmDefPct') || {}).value || 1))), byUser: by }; if (saveSettings(s) === false) { alert('⛔ تنظیمات پورسانت ذخیره نشد.'); return; } try { audit('پورسانت', 'ذخیره قواعد پورسانت فروش', 'commission'); } catch (e) {} if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: KEY, id: 'commission', label: 'قواعد پورسانت' }); window._cmBasis = s.commission.basis; ptfCommissionRefresh(); };
  window.ptfCommissionPrint = function () { var box = document.getElementById('commissionBox'); if (!box) return; if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش پورسانت فروش', '<div dir="rtl" style="font-family:Tahoma;padding:20px"><h2>گزارش پورسانت فروش</h2>' + box.innerHTML + '</div>', 'commission-' + normMonth(window._cmMonth || faMonth()).replace('/','-')); return; } window.print(); };
  /* API قدیمی ptfCommissionReport و hook buildSettings بازنشسته‌اند؛ گزارش اکنون
     فقط داخل هاب مالی یکپارچه نمایش داده می‌شود، نه مودال جدا با تقویم میلادی. */
  window.ptfCommissionReport = function (period) { window._cmMonth = period || window._cmMonth || faMonth(); if (typeof window.finHubSet === 'function') window.finHubSet('commission'); else ptfCommissionRefresh(); };
})();
