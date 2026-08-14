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
    /* v34.5.35 (ابلاغ کارفرما): مبنای «CO برنده» حذف شد — فقط «وصولی واقعی» پس از
       تسویه کامل پرونده. فیلد legacy c.basis بی‌اثر نگه داشته می‌شود. */
    return { defaultPct: Math.max(0, Math.min(50, num(c.defaultPct == null ? 1 : c.defaultPct))), byUser: c.byUser || {} };
  }
  function userPct(u) { var c = cfg(); return c.byUser[u] != null && c.byUser[u] !== '' ? Math.max(0, Math.min(50, num(c.byUser[u]))) : c.defaultPct; }
  function users() { return data('ptf_crm_users').filter(function (u) { return u && (u.username || u.user); }); }
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
  function ownerOf(o) {
    if (!o) return '';
    var c = data('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd || (o.buyerCo && (x.co === o.buyerCo || x.coEn === o.buyerCo)); })[0];
    return (c && (c.owner || c.crBy)) || o.owner || o.issuedBy || o.crBy || '';
  }
  function activePayment(p) { return !!p && p.status !== 'void' && p.status !== 'reversal' && !p.voided; }
  function payAmt(p) { return num(p.amountIrr || p.amt || p.amount); }
  function payWhen(p, inv) { return p.dateISO || p.iso || p.date || p.t || inv.issueDate || inv.date || inv.t || ''; }

  window.ptfCommissionCalc = function (opts) {
    opts = opts || {};
    var c = cfg();
    var b = bounds(opts.month || opts.period || faMonth());
    var only = opts.user || '';
    var map = {};
    function row(u) { u = u || '_unassigned'; if (!map[u]) map[u] = { user: u, label: userLabel(u === '_unassigned' ? '' : u), pct: userPct(u === '_unassigned' ? '' : u), base: 0, lines: [] }; return map[u]; }

    /* v34.5.35 (ابلاغ کارفرما): پورسانت فقط پس از تسویه کامل «کل پرونده» آزاد می‌شود.
       - مبنا = مبلغ کل فاکتورهای پرونده، نه وصولی‌های پراکنده.
       - ماه انتساب = ماه ثبت آخرین وصولی تکمیل‌کننده (ماه تسویه کامل).
       - فاکتور یتیم (بدون پرونده) از محاسبه حذف می‌شود (تصمیم کارفرما).
       - مبنای «CO برنده» حذف شده است. */
    var offersByNo = {};
    data('ptf_crm_offers').forEach(function (o) { if (o && o.no) offersByNo[o.no] = o; });
    var deals = data('ptf_crm_deals');

    function dealOf(inv) {
      var o = offersByNo[inv.offerNo] || {};
      var d = deals.filter(function (x) {
        return x && ((o.no && (x.wonOffer === o.no || x.offerNo === o.no)) || (o.inqNo && x.inqNo === o.inqNo));
      })[0];
      if (d) return d;
      d = deals.filter(function (x) { return x && x.cd && (inv.dealCd === x.cd || inv.dealRef === x.cd || inv.projectCd === x.cd); })[0];
      if (d) return d;
      if (inv.inqNo) d = deals.filter(function (x) { return x && x.inqNo === inv.inqNo; })[0];
      return d || null;
    }

    var groups = {};
    data('ptf_crm_invoices').forEach(function (inv) {
      if (!inv || inv.status === 'void') return;
      var d = dealOf(inv);
      if (!d) return; /* فاکتور بدون پرونده = از محاسبه حذف */
      var o = offersByNo[inv.offerNo] || {};
      var g = groups[d.cd] || (groups[d.cd] = { deal: d, owner: ownerOf(o), invoices: [] });
      g.invoices.push(inv);
    });

    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      if (!g.invoices.length) return;
      var allPaid = true, lastWhen = '', base = 0;
      g.invoices.forEach(function (inv) {
        var pays = (inv.payments || []).concat(inv.pays || []).filter(activePayment);
        var paid = pays.reduce(function (s, p) { return s + payAmt(p); }, 0);
        if (inv.amount - paid > 0.5) { allPaid = false; return; }
        base += inv.amount;
        pays.forEach(function (p) { var iso = toIso(payWhen(p, inv)); if (iso > lastWhen) lastWhen = iso; });
      });
      if (!allPaid || base <= 0) return;
      if (!inBounds(lastWhen, b)) return;
      var r = row(g.owner);
      r.base += base;
      r.lines.push({ type: 'settled', ref: g.deal.inqNo || g.deal.cd || '', offer: g.deal.wonOffer || '', buyer: g.deal.buyerCo || '', amount: base, date: lastWhen });
    });

    var rows = Object.keys(map).map(function (k) { var r = map[k]; r.commission = Math.round(r.base * r.pct / 100); return r; }).filter(function (r) { return r.base > 0 || r.user === '_unassigned'; }).sort(function (a, b2) { return b2.commission - a.commission; });
    return { basis: 'collected', period: b, rows: rows, totalBase: rows.reduce(function (s, r) { return s + r.base; }, 0), totalCommission: rows.reduce(function (s, r) { return s + r.commission; }, 0), cfg: c };
  };

  /* ---------- چرخه مالی پورسانت ----------
     approval = هزینه غیررسمی + بدهی شرکت به کارشناس؛ payment = فقط تسویه بدهی
     و خروج بانک. این جداسازی مانع از دوباره‌شماری هزینه هنگام پرداخت می‌شود. */
  var REC_KEY = 'ptf_crm_commission_records';
  function records() { var r = data(REC_KEY); return Array.isArray(r) ? r : []; }
  function saveRecords(r) { return setData(REC_KEY, r || []); }
  function activeApproval(r) { return r && r.kind === 'approval' && r.status === 'approved'; }
  function commissionPaymentActive(r) { return r && r.kind === 'payment' && r.status === 'posted'; }
  function approvalPaid(cd) { return records().filter(function (r) { return commissionPaymentActive(r) && r.approvalCd === cd; }).reduce(function (s, r) { return s + num(r.amount); }, 0); }
  function approvalRemain(r) { return Math.max(0, num(r && r.amount) - approvalPaid(r && r.cd)); }
  window.ptfCommissionLiability = function () { return records().filter(activeApproval).reduce(function (s, r) { return s + approvalRemain(r); }, 0); };
  /* v34.5.37: رسید تسویه پورسانت — ضمیمهٔ فایل روی رکورد پرداخت (kind=payment).
     پرداخت‌ها در ptf_crm_commission_records هستند؛ فایل روی خود رکورد payment می‌نشیند. */
  function commissionPayRecord(cd) { return records().filter(function (r) { return r && r.cd === cd; })[0] || null; }
  window.ptfCommissionPayAddFile = function (payCd) {
    var pay = commissionPayRecord(payCd);
    if (!pay || pay.kind !== 'payment') { alert('رکورد پرداخت یافت نشد'); return; }
    document.querySelectorAll('#cmPayAttachDlg').forEach(function (el) { el.remove(); });
    var html = '<div class="md-b" id="cmPayAttachDlg" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 رسید تسویه پورسانت</h3><div style="font-size:11.5px;color:#047857;margin-bottom:7px">پس از تکمیل آپلود، سند همان لحظه روی پرداخت ذخیره می‌شود.</div><div id="cmPayAttachWrap"></div><div style="text-align:left;margin-top:9px"><button class="bt" onclick="this.closest(\'.md-b\').remove();if(typeof ptfCommissionRefresh===\'function\')ptfCommissionRefresh()">تمام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('cmPayAttachWrap', 'commission-pay/' + payCd, function (f) {
      var list = records(); var p = list.filter(function (x) { return x.cd === payCd; })[0];
      if (!p) return;
      p.files = p.files || [];
      if (!p.files.some(function (x) { return x && x.key === f.key; })) p.files.push(f);
      saveRecords(list);
      try { audit('پورسانت', 'افزودن رسید تسویه به پرداخت ' + payCd, payCd); } catch (e) {}
      if (typeof ptfToast === 'function') ptfToast('✅ رسید تسویه ذخیره شد', 'ok');
    }, function (key) {
      var list = records(); var p = list.filter(function (x) { return x.cd === payCd; })[0];
      if (!p) return;
      p.files = (p.files || []).filter(function (x) { return x.key !== key; });
      saveRecords(list);
    });
  };
  window.ptfCommissionPayRemoveFile = function (payCd, key) {
    if (!confirm('این رسید از پرداخت و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var list = records(); var p = list.filter(function (x) { return x.cd === payCd; })[0];
      if (p) { p.files = (p.files || []).filter(function (x) { return x.key !== key; }); saveRecords(list); }
      if (typeof ptfToast === 'function') ptfToast('رسید از رکورد و فضای ابری حذف شد', 'warn');
      if (typeof ptfCommissionRefresh === 'function') ptfCommissionRefresh();
    });
  };
  function commissionOpex(rec) {
    var all = data('ptf_crm_opex');
    var o = { cd: genCode('OPX'), cat: 'پورسانت فروش کارکنان', amt: rec.amount, month: rec.month, t: faDateTime(), by: me(), desc: 'پورسانت فروش تصویب‌شده — ' + rec.userLabel + ' / دوره ' + rec.month, isOfficial: false, commissionApprovalCd: rec.cd, commissionCycle: rec.cycle, status: 'approved' };
    all.unshift(o);
    if (setData('ptf_crm_opex', all) === false) return null;
    return o;
  }
  window.ptfCommissionApproveCycle = function () {
    if (!isSenior()) { alert('⛔ فقط مدیران ارشد می‌توانند دوره پورسانت را تصویب کنند.'); return; }
    var month = normMonth((document.getElementById('cmMonth') || {}).value || window._cmMonth || faMonth());
    var basis = 'collected';
    var cycle = month + '|' + basis;
    var old = records().filter(function (r) { return activeApproval(r) && r.cycle === cycle; });
    if (old.length) { alert('این دوره قبلاً تصویب شده است. برای اصلاح از ابطال/سند اصلاحی استفاده کنید.'); return; }
    var res = window.ptfCommissionCalc({ month: month, basis: basis });
    var rows = res.rows.filter(function (r) { return r.user !== '_unassigned' && r.commission > 0; });
    if (!rows.length) { alert('برای این دوره پورسانت قابل تصویبی وجود ندارد. ابتدا مالک مشتری/وصولی را بررسی کنید.'); return; }
    if (!confirm('تصویب دوره پورسانت ' + month + '؟\n\n' + rows.length + ' کارشناس | هزینه و بدهی غیررسمی: ' + money(res.totalCommission) + '\n\nپس از تصویب، هزینه در سود و بدهی به کارکنان ثبت می‌شود؛ پرداخت بعدی فقط تسویه بدهی است.')) return;
    var list = records(), made = [], opx = [];
    rows.forEach(function (r) {
      var rec = { cd: genCode('COM'), kind: 'approval', cycle: cycle, month: month, basis: basis, user: r.user, userLabel: r.label, base: r.base, pct: r.pct, amount: r.commission, status: 'approved', ledger: 'unofficial', t: faDateTime(), by: me(), lines: r.lines.slice() };
      var o = commissionOpex(rec);
      if (!o) return;
      rec.opexCd = o.cd; list.unshift(rec); made.push(rec); opx.push(o);
    });
    if (!made.length || saveRecords(list) === false) { alert('⛔ تصویب دوره روی حافظهٔ پایدار ذخیره نشد؛ هیچ موفقیتی اعلام نمی‌شود.'); return; }
    try { audit('پورسانت', 'تصویب دوره ' + month + ' — ' + made.length + ' کارشناس / ' + money(made.reduce(function (s, r) { return s + r.amount; }, 0)), cycle); } catch (e) {}
    if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: REC_KEY, id: cycle, label: 'تصویب دوره پورسانت' });
    window._cmMonth = month; ptfCommissionRefresh();
  };
  window.ptfCommissionPay = function (cd) {
    if (!isSenior()) { alert('⛔ فقط مدیران ارشد می‌توانند پرداخت پورسانت ثبت کنند.'); return; }
    var ap = records().filter(function (r) { return activeApproval(r) && r.cd === cd; })[0];
    if (!ap) { alert('سند تصویب فعال یافت نشد.'); return; }
    var remain = approvalRemain(ap); if (!remain) { alert('این پورسانت قبلاً کامل تسویه شده است.'); return; }
    if (typeof ptfFinanceAssertWritable === 'function') { var g = ptfFinanceAssertWritable(ap.month, { action: 'پرداخت پورسانت' }); if (!g.ok) return; }
    ptfDialog({
      title: '💳 پرداخت پورسانت از بانک — ' + ap.userLabel,
      body: 'بدهی باقی‌مانده: <b>' + money(remain) + '</b><br><small>این پرداخت هزینه جدید نمی‌سازد؛ فقط بدهی پورسانت را تسویه و خروج بانک را ثبت می‌کند.</small>',
      fields: [
        { id: 'amt', label: 'مبلغ پرداختی (ریال)', type: 'number', value: String(remain), dir: 'ltr', required: true },
        { id: 'doc', label: 'شماره حواله / سند بانکی', required: true },
        { id: 'date', label: 'تاریخ پرداخت (شمسی)', value: (typeof faDate === 'function' ? faDate() : ''), required: true },
        { id: 'files', label: 'رسید / سند تسویه (اختیاری)', type: 'upload', uploadFolder: 'commission-pay/' + ap.cd }
      ],
      okText: 'ثبت پرداخت بانکی',
      onOk: function (v) {
        var amt = num(v.amt);
        if (!amt || amt > remain) { alert('مبلغ باید بیشتر از صفر و حداکثر برابر مانده پورسانت باشد.'); return; }
        var list = records();
        var pay = { cd: genCode('COMPAY'), kind: 'payment', approvalCd: ap.cd, cycle: ap.cycle, month: ap.month, user: ap.user, userLabel: ap.userLabel, amount: amt, method: 'bank', doc: String(v.doc || '').trim(), dateFa: v.date, dateISO: toIso(v.date), files: (v.files || []).slice(), status: 'posted', t: faDateTime(), by: me() };
        if (!pay.doc) { alert('شماره سند بانکی الزامی است.'); return; }
        list.unshift(pay);
        if (saveRecords(list) === false) { alert('⛔ پرداخت روی حافظهٔ پایدار ذخیره نشد.'); return; }
        try { audit('پورسانت', 'پرداخت بانکی پورسانت ' + ap.userLabel + ' — ' + money(amt) + ' / ' + pay.doc + (pay.files.length ? ' + ' + pay.files.length + ' رسید' : ''), pay.cd); } catch (e) {}
        if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: REC_KEY, id: pay.cd, label: 'پرداخت پورسانت' });
        ptfCommissionRefresh();
      }
    });
  };
  function configRows(c) { return users().map(function (u) { var id = u.username || u.user || ''; if (!id) return ''; var pct = c.byUser[id] == null ? '' : c.byUser[id]; return '<tr><td>' + esc(u.name || u.nm || id) + '<small style="color:#64748b"> ' + esc(id) + '</small></td><td><input id="cmPct_' + esc(id) + '" value="' + esc(pct) + '" inputmode="decimal" placeholder="' + c.defaultPct + '" style="width:74px;direction:ltr"></td></tr>'; }).join(''); }
  function reportRows(res) { return res.rows.map(function (r) { var lines = r.lines.slice(0, 5).map(function (x) { return '<div class="cm-line">' + esc(x.date) + ' · ' + esc(x.ref) + (x.buyer ? ' · ' + esc(x.buyer) : '') + ' · ' + money(x.amount) + '</div>'; }).join('') || '<div class="cm-line">رکورد قابل محاسبه‌ای نیست</div>'; return '<details class="cm-row"><summary><span><b>' + esc(r.label) + '</b><small>' + esc(r.user === '_unassigned' ? 'مالک مشخص نشده' : r.user) + ' · ' + r.pct + '٪</small></span><span><small>مبنا: ' + money(r.base) + '</small><b>' + money(r.commission) + '</b></span></summary><div class="cm-lines">' + lines + (r.lines.length > 5 ? '<div class="cm-line">… ' + (r.lines.length - 5) + ' ردیف دیگر</div>' : '') + '</div></details>'; }).join('') || '<div class="cm-empty">در این دوره، وصولی/برد قابل محاسبه‌ای پیدا نشد.</div>'; }
  function styleOnce() {
    if (document.getElementById('cmHubCss')) return;
    var s = document.createElement('style'); s.id = 'cmHubCss'; s.textContent = '#commissionBox{background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:14px;margin-top:12px}.cm-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.cm-kpis{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px;margin:12px 0}.cm-kpi{padding:10px;border:1px solid var(--brd);border-radius:12px;background:var(--bg,#f8fafc)}.cm-kpi small,.cm-row small,.cm-line{display:block;color:#64748b;font-size:11px;margin-top:3px}.cm-row{border:1px solid var(--brd);border-radius:12px;padding:9px 11px;margin:7px 0;background:var(--crd,#fff)}.cm-row summary{display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none}.cm-row summary::-webkit-details-marker{display:none}.cm-row summary>span:last-child{text-align:left}.cm-row summary b:last-child{display:block;color:#0e7490;margin-top:3px}.cm-lines{border-top:1px dashed var(--brd);margin-top:8px;padding-top:5px}.cm-empty{padding:20px;text-align:center;color:#64748b;border:1px dashed var(--brd);border-radius:12px}.cm-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:end}.cm-controls input,.cm-controls select,#cmConfig input{border:1px solid var(--brd);border-radius:9px;padding:7px;background:var(--crd,#fff);color:var(--tx,#111)}@media(max-width:600px){.cm-kpis{grid-template-columns:1fr}.cm-row summary{align-items:flex-start}.cm-controls{width:100%}.cm-controls .fld{flex:1 1 130px}}'; document.head.appendChild(s);
  }
  function obligationsHtml() {
    var a = records().filter(activeApproval).map(function (r) { return { r: r, remain: approvalRemain(r) }; }).filter(function (x) { return x.remain > 0; });
    var total = a.reduce(function (s, x) { return s + x.remain; }, 0);
    var rows = a.map(function (x) { var r = x.r; return '<tr><td>' + esc(r.month) + '</td><td>' + esc(r.userLabel) + '</td><td>' + money(r.amount) + '</td><td>' + money(approvalPaid(r.cd)) + '</td><td><b style="color:#b45309">' + money(x.remain) + '</b></td><td><button class="bt bt-o" style="font-size:11px" onclick="ptfCommissionPay(\'' + esc(r.cd) + '\')">پرداخت بانکی</button></td></tr>'; }).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b">بدهی باز پورسانت وجود ندارد.</td></tr>';
    /* v34.5.37: تاریخچهٔ پرداخت‌ها با رسید تسویه (مشاهده/افزودن/حذف سند) */
    var pays = records().filter(commissionPaymentActive);
    var payRows = pays.map(function (p) {
      var filesHtml = (p.files || []).map(function (f) {
        var key = String((f && f.key) || '');
        if (!key) return '';
        return '<span style="display:inline-flex;align-items:center;gap:2px;margin-left:4px"><button type="button" class="ba" style="color:#0e7490;padding:2px 5px" onclick="openStoredFile(\'' + ptfOnClickArg(key) + '\',\'' + ptfOnClickArg(f.name || 'رسید') + '\')">👁 ' + esc(f.name || 'رسید') + '</button><button type="button" class="ba" style="color:#dc2626;padding:1px 4px" onclick="ptfCommissionPayRemoveFile(\'' + ptfOnClickArg(p.cd) + '\',\'' + ptfOnClickArg(key) + '\')">✕</button></span>';
      }).join('');
      return '<tr><td>' + esc(p.dateFa || '') + '</td><td>' + esc(p.userLabel) + '</td><td>' + money(p.amount) + '</td><td>' + esc(p.doc || '—') + '</td><td>' + (filesHtml || '<span style="color:#94a3b8">—</span>') + '</td><td><button class="ba" onclick="ptfCommissionPayAddFile(\'' + ptfOnClickArg(p.cd) + '\')">📎 رسید</button></td></tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b">پرداختی ثبت نشده است.</td></tr>';
    return '<div style="margin-top:14px;border-top:1px solid var(--brd);padding-top:12px"><div class="cm-head"><div><b>📌 بدهی و پرداخت پورسانت</b><br><small style="color:#64748b">تصویب = هزینه غیررسمی + بدهی؛ پرداخت = فقط تسویه بدهی و خروج بانک</small></div><b style="color:#b45309">مانده قابل پرداخت: ' + money(total) + '</b></div><div class="tb2" style="margin-top:8px"><table><thead><tr><th>دوره</th><th>کارشناس</th><th>مصوب</th><th>پرداخت‌شده</th><th>مانده</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="cm-head" style="margin-top:14px"><div><b>💳 پرداخت‌های ثبت‌شده (تسویه)</b></div></div><div class="tb2" style="margin-top:8px"><table><thead><tr><th>تاریخ</th><th>کارشناس</th><th>مبلغ</th><th>سند بانکی</th><th>رسید</th><th></th></tr></thead><tbody>' + payRows + '</tbody></table></div></div>';
  }
  window.ptfCommissionHtml = function () {
    if (!isSenior()) return '';
    styleOnce(); var c = cfg(), month = normMonth(window._cmMonth || faMonth()), res = window.ptfCommissionCalc({ month: month });
    var unassigned = res.rows.filter(function (r) { return r.user === '_unassigned' && r.base > 0; })[0];
    return '<section id="commissionBox"><div class="cm-head"><div><h4 style="margin:0">💸 پورسانت فروش</h4><small style="color:#64748b">مبنای شفاف: وصولی واقعی — فقط پس از تسویه کامل پرونده</small></div><div class="cm-controls"><div class="fld"><label>دوره شمسی</label><input id="cmMonth" value="' + esc(month) + '" placeholder="1405/05" inputmode="numeric"></div><button class="bt bt-o" onclick="ptfCommissionRefresh()">🔄 محاسبه</button><button class="bt" onclick="ptfCommissionApproveCycle()">✅ تصویب دوره</button><button class="bt bt-o" onclick="ptfCommissionPrint()">🖨 چاپ</button></div></div>' +
      '<div class="cm-kpis"><div class="cm-kpi"><small>مبنای محاسبه</small><b>' + money(res.totalBase) + '</b></div><div class="cm-kpi"><small>جمع پورسانت پیشنهادی</small><b style="color:#0e7490">' + money(res.totalCommission) + '</b></div><div class="cm-kpi"><small>کارشناسان دارای رکورد</small><b>' + res.rows.filter(function (r) { return r.user !== '_unassigned'; }).length.toLocaleString('fa-IR') + '</b></div></div>' +
      (unassigned ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px;font-size:12px;color:#92400e">⚠️ ' + money(unassigned.base) + ' مبنای پورسانت مالک مشخص ندارد؛ مالک مشتری یا صادرکننده پیشنهاد را اصلاح کنید.</div>' : '') +
      '<div id="cmRows">' + reportRows(res) + '</div>' + obligationsHtml() + '</section>';
  };
  window.ptfCommissionRefresh = function () { window._cmMonth = normMonth((document.getElementById('cmMonth') || {}).value); var old = document.getElementById('commissionBox'); if (old) old.outerHTML = window.ptfCommissionHtml(); if (typeof window.finHubOrder === 'function') window.finHubOrder(); };
  window.ptfCommissionSaveCfg = function () {
    if (!isSenior()) { alert('⛔ فقط مدیران ارشد'); return; }
    var s = settings(), by = {};
    users().forEach(function (u) { var id = u.username || u.user || '', el = document.getElementById('cmSetPct_' + id) || document.getElementById('cmPct_' + id); if (id && el && String(el.value).trim() !== '') by[id] = Math.max(0, Math.min(50, num(el.value))); });
    var defEl = document.getElementById('cmSetDefPct') || document.getElementById('cmDefPct');
    s.commission = { defaultPct: Math.max(0, Math.min(50, num((defEl || {}).value || 1))), byUser: by };
    if (saveSettings(s) === false) { alert('⛔ تنظیمات پورسانت ذخیره نشد.'); return; }
    try { audit('پورسانت', 'ذخیره قواعد پورسانت فروش برای همه کاربران', 'commission'); } catch (e) {}
    if (typeof ptfSyncTrackRecordSave === 'function') ptfSyncTrackRecordSave({ key: KEY, id: 'commission', label: 'قواعد پورسانت' });
    ptfCommissionRefresh();
  };
  function commissionSettingsHtml() {
    if (!isSenior()) return '';
    var c = cfg();
    return '<section id="cmSettingsBox" style="margin-top:14px;padding:14px;border:1px solid var(--brd);border-radius:14px;background:var(--crd,#fff)"><h4 style="margin:0 0 5px">💸 قواعد پورسانت فروش</h4><small style="color:#64748b">تنظیم درصد تمام کاربران فقط در این بخش انجام می‌شود. پورسانت فقط از وصولی واقعی و پس از تسویه کامل پرونده محاسبه می‌شود.</small><div class="fr" style="margin-top:10px"><div class="fld"><label>درصد پیش‌فرض</label><input id="cmSetDefPct" value="' + c.defaultPct + '" inputmode="decimal" style="direction:ltr"></div></div><div class="tb2" style="margin-top:10px"><table><thead><tr><th>کاربر</th><th>نقش</th><th>درصد اختصاصی</th></tr></thead><tbody>' + users().map(function (u) { var id = u.username || u.user, pct = c.byUser[id] == null ? '' : c.byUser[id]; return '<tr><td>' + esc(u.name || u.nm || id) + '<small style="color:#64748b"> ' + esc(id) + '</small></td><td>' + esc(u.roleId || u.role || '—') + '</td><td><input id="cmSetPct_' + esc(id) + '" value="' + esc(pct) + '" placeholder="' + c.defaultPct + '" inputmode="decimal" style="width:80px;direction:ltr"></td></tr>'; }).join('') + '</tbody></table></div><button class="bt" style="margin-top:10px" onclick="ptfCommissionSaveCfg()">💾 ذخیره قواعد پورسانت</button></section>';
  }
  function hookSettings() {
    if (window._cmSettingsHooked || typeof window.buildSettings !== 'function') return false;
    window._cmSettingsHooked = true;
    var old = window.buildSettings;
    window.buildSettings = function () { return old() + commissionSettingsHtml(); };
    return true;
  }
  var cmTry = 0, cmTimer = setInterval(function () { cmTry++; if (hookSettings() || cmTry > 60) clearInterval(cmTimer); }, 300);
  hookSettings();

  window.ptfCommissionPrint = function () { var box = document.getElementById('commissionBox'); if (!box) return; if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش پورسانت فروش', '<div dir="rtl" style="font-family:Tahoma;padding:20px"><h2>گزارش پورسانت فروش</h2>' + box.innerHTML + '</div>', 'commission-' + normMonth(window._cmMonth || faMonth()).replace('/','-')); return; } window.print(); };
  /* API قدیمی ptfCommissionReport و hook buildSettings بازنشسته‌اند؛ گزارش اکنون
     فقط داخل هاب مالی یکپارچه نمایش داده می‌شود، نه مودال جدا با تقویم میلادی. */
  window.ptfCommissionReport = function (period) { window._cmMonth = period || window._cmMonth || faMonth(); if (typeof window.finHubSet === 'function') window.finHubSet('commission'); else ptfCommissionRefresh(); };
})();
