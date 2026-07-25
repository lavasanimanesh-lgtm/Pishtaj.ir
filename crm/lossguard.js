/* =====================================================================
   PTF CRM — v18.0
   US-421: زیان پروژه + هشدار فعال داده ناقص سود
   - رویداد زیان روی پرونده فروش و بایگانی
   - زیان به‌عنوان هزینه قطعی در ptfProjectProfitIRR کسر می‌شود
   - پروژه‌های دارای داده ناقص در «روز من» و کارتابل ارشد هشدار می‌گیرند
   ===================================================================== */
(function () {
  'use strict';
  var SENIOR = ['admin', 'chairman', 'ceo', 'commercial'];
  var REASONS = [
    { id: 'mismatch', lb: 'عدم انطباق کالا' },
    { id: 'cancel', lb: 'فسخ/لغو قرارداد' },
    { id: 'penalty', lb: 'جریمه/خسارت' },
    { id: 'fx', lb: 'زیان ناشی از نرخ ارز' },
    { id: 'other', lb: 'سایر' }
  ];
  function isSenior() { return SENIOR.indexOf(curRole()) > -1; }
  function n(v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; }
  function money(v) { return (+v || 0).toLocaleString('fa-IR') + ' ریال'; }
  function lossTotal(o) { return (o && o.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0); }
  window.ptfProjectLossTotal = lossTotal;
  window.ptfProjectLossBadge = function (o) {
    var t = lossTotal(o);
    return t ? '<span class="bd" style="background:#fee2e2;color:#b91c1c">⚠️ پروژه زیان‌ده: ' + money(t) + '</span>' : '';
  };

  function findTarget(kind, id) {
    if (kind === 'deal') {
      var ds = getData('ptf_crm_deals');
      return { key: 'ptf_crm_deals', list: ds, item: ds.filter(function (x) { return x.cd === id; })[0] };
    }
    var ps = getData('ptf_crm_projects');
    return { key: 'ptf_crm_projects', list: ps, item: ps.filter(function (x) { return x.no === id || x.cd === id; })[0] };
  }
  function saveTarget(t) { setData(t.key, t.list); }

  window.ptfLossOpen = function (kind, id) {
    if (!isSenior()) { alert('⛔ ثبت زیان پروژه فقط برای نقش‌های ارشد مجاز است'); return; }
    var t = findTarget(kind, id);
    if (!t.item) { alert('پرونده پیدا نشد'); return; }
    var opts = REASONS.map(function (r) { return { v: r.id, lb: r.lb }; });
    ptfDialog({
      title: '💥 ثبت زیان پروژه — ' + (t.item.inqNo || t.item.no || t.item.cd),
      body: 'زیان ثبت‌شده به‌عنوان هزینه قطعی در سود همین پروژه و در داشبورد سال مالی بعدی لحاظ می‌شود. ثبت فقط با audit انجام می‌شود.',
      fields: [
        { id: 'amt', label: 'مبلغ زیان (ریال)', type: 'number', required: true, dir: 'ltr' },
        { id: 'reason', label: 'دلیل زیان', type: 'select', options: opts },
        { id: 'dt', label: 'تاریخ وقوع/ثبت', value: (typeof faDate === 'function' ? faDate() : ''), required: true, dir: 'ltr' },
        { id: 'desc', label: 'شرح تکمیلی', type: 'textarea', rows: 2, required: true }
      ],
      okText: 'ثبت زیان', danger: true,
      onOk: function (v) {
        var amt = n(v.amt);
        if (amt <= 0) { alert('مبلغ زیان نامعتبر است'); return; }
        var rr = REASONS.filter(function (r) { return r.id === v.reason; })[0] || REASONS[REASONS.length - 1];
        var ev = { cd: genCode('LOS'), amt: amt, reasonId: rr.id, reasonLb: rr.lb, date: v.dt, desc: v.desc, by: (curSession() || {}).name || '', t: faDateTime(), files: [] };
        t.item.lossEvents = t.item.lossEvents || [];
        t.item.lossEvents.unshift(ev);
        t.item.timeline = t.item.timeline || [];
        t.item.timeline.push({ t: faDateTime(), by: (curSession() || {}).name || '', tx: '💥 ثبت زیان پروژه: ' + money(amt) + ' — ' + rr.lb });
        saveTarget(t);
        audit('زیان پروژه', 'ثبت زیان ' + money(amt) + ' — ' + rr.lb, id);
        if (typeof notify === 'function') notify({ toRoles: ['admin', 'chairman', 'ceo', 'commercial'], title: '💥 زیان پروژه ثبت شد: ' + money(amt) + ' — ' + (t.item.buyerCo || t.item.inqNo || id), kind: 'project_loss', channels: ['cart'], link: { panel: kind === 'deal' ? 'deals' : 'prj' } });
        if (typeof ptfToast === 'function') ptfToast('زیان پروژه ثبت شد و در سود لحاظ می‌شود', 'ok');
        openLossUpload(kind, id, ev.cd);
        if (typeof renderDeals === 'function') try { renderDeals(); } catch (e) {}
        if (typeof renderProjects2 === 'function') try { renderProjects2(); } catch (e2) {}
      }
    });
  };

  function openLossUpload(kind, id, lossCd) {
    var p = document.getElementById('panels') || document.body;
    if (!p || typeof attachUploadWidget !== 'function') return;
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 پیوست مستندات زیان</h3><div style="font-size:12px;color:#64748b;margin-bottom:8px">در صورت وجود، مستندات زیان/جریمه/عدم انطباق را پیوست کنید.</div><div id="lossUp"></div><div style="text-align:left;margin-top:10px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">تمام</button></div></div></div>';
    p.insertAdjacentHTML('beforeend', html);
    attachUploadWidget('lossUp', 'project-loss/' + id + '/' + lossCd, function (f) {
      var t = findTarget(kind, id); if (!t.item) return;
      var ev = (t.item.lossEvents || []).filter(function (x) { return x.cd === lossCd; })[0];
      if (ev) { ev.files = ev.files || []; ev.files.push(f); saveTarget(t); }
    });
  }

  function profitTargetObjects() {
    var arr = [];
    getData('ptf_crm_projects').forEach(function (p) { if (p.offerNo || p.inqNo) arr.push(Object.assign({ _kind: 'project' }, p)); });
    getData('ptf_crm_deals').forEach(function (d) {
      if (!d.wonOffer || d.st === 'archived') return;
      arr.push({ _kind: 'deal', no: d.cd, offerNo: d.wonOffer || d.offerNo, inqNo: d.inqNo, buyerCo: d.buyerCo, lossEvents: d.lossEvents || [] });
    });
    return arr;
  }

  window.ptfProfitIncompleteItems = function () {
    var out = [];
    if (typeof ptfProjectProfitIRR !== 'function') return out;
    profitTargetObjects().forEach(function (p) {
      var r = ptfProjectProfitIRR(p);
      var ww = (r.warnings || []).slice();
      if (r.sellIrr > 0 && !r.buyIrr && !(r.buyPendingFx || []).length) ww.push('⛔ فروش/CO دارد اما خرید واقعی ثبت نشده — سود بیش‌برآورد می‌شود.');
      if (!r.ok || !r.complete || (r.buyPendingFx || []).length || ww.some(function (w) { return String(w).indexOf('⛔') > -1; })) {
        out.push({ obj: p, result: r, warnings: ww });
      }
    });
    return out;
  };

  function hookProfit() {
    if (window._lossProfitHooked || typeof window.ptfProjectProfitIRR !== 'function') return false;
    window._lossProfitHooked = true;
    var _orig = window.ptfProjectProfitIRR;
    window.ptfProjectProfitIRR = function (prj) {
      var r = _orig(prj);
      var loss = lossTotal(prj);
      if (loss && r) {
        r.lossIrr = loss;
        if (r.profit != null) r.profit -= loss;
        if (r.sellIrr > 0 && r.profit != null) r.pct = Math.round(r.profit * 100 / r.sellIrr);
        r.warnings = r.warnings || [];
        r.warnings.push('💥 زیان قطعی ثبت‌شده برای پروژه در سود کسر شد: ' + money(loss));
      }
      return r;
    };
    return true;
  }

  function hookMyDay() {
    if (window._lossMydayHooked || typeof window.ptfMyDayItems !== 'function') return false;
    window._lossMydayHooked = true;
    var _it = window.ptfMyDayItems;
    window.ptfMyDayItems = function () {
      var out = _it();
      var inc = [];
      try { inc = ptfProfitIncompleteItems(); } catch (e) {}
      if (inc.length) out.unshift({ ic: '⚠️', cl: '#dc2626', panel: 'deals', tx: inc.length + ' پروژه/پرونده داده ناقص سود دارند — سود سالانه بدون تعیین تکلیف قابل اتکا نیست', sub: 'R9/US-421' });
      return out.slice(0, 30);
    };
    return true;
  }

  window.ptfProfitIncompleteNotify = function () {
    var today = (typeof faDate === 'function' ? faDate() : new Date().toISOString().slice(0,10));
    if (localStorage.getItem('ptf_profit_incomplete_notified') === today) return;
    var inc = [];
    try { inc = ptfProfitIncompleteItems(); } catch (e) {}
    if (!inc.length) return;
    localStorage.setItem('ptf_profit_incomplete_notified', today);
    if (typeof notify === 'function') notify({ toRoles: ['admin', 'chairman', 'ceo', 'commercial'], title: '⚠️ ' + inc.length + ' پروژه داده ناقص سود دارند', body: 'پروژه‌های دارای فروش بدون خرید واقعی، تسعیر معلق یا دریافت ناقص باید قبل از داشبورد سال مالی تعیین تکلیف شوند.', kind: 'profit_incomplete', channels: ['cart'], link: { panel: 'deals' } });
  };

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    var ok1 = hookProfit();
    var ok2 = hookMyDay();
    if (ok1 && ok2) { clearInterval(iv); setTimeout(function () { try { ptfProfitIncompleteNotify(); } catch (e) {} }, 1200); }
    if (tries > 80) clearInterval(iv);
  }, 300);
  hookProfit(); hookMyDay();
})();
