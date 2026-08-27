/* =====================================================================
   PTF CRM — myday.js — v16.3 — US-393 «☀️ روز من» (تایید کارفرما از بک‌لاگ R4)
   بلوک شروع کاری روی داشبورد: همه چیزهایی که «امروز» نیاز به اقدام دارند:
   - یادآورهای سررسیده/امروز من
   - مهلت‌های پاسخ درخواست (US-348) نزدیک/گذشته
   - تحویل‌های تعهدی (US-351) نزدیک/گذشته
   - چک‌های صادره در پنجره ۷ روز
   - پیشنهادهای CO رو به انقضا / منقضی
   - سرنخ‌های تازه بی‌پیگیری بیش از ۳ روز
   اصل معماری: ۱۰۰٪ خواندنی از داده‌های موجود — هیچ کلید/منطق وضعیت جدیدی ندارد.
   هر آیتم: کلیک = پرش به پنل مربوطه (goPanelByName موجود).
   ===================================================================== */
(function () {
  'use strict';

  function todayISO2() { return new Date().toISOString().slice(0, 10); }
  function plusDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  /* v31.7.38 BUG-MYDAY-DISMISS-001: «روز من» از داده‌های زنده ساخته می‌شود؛
     بنابراین حذف ردیف باید به معنی snooze/dismiss همان fingerprint باشد، نه حذف
     سند اصلی. Dismiss در settings ذخیره و sync می‌شود تا بین دستگاه‌ها هم بماند. */
  function mdSettings() { try { return JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) { return {}; } }
  function mdSaveSettings(st) {
    try {
      /* v34.8.27 (W4): مسیر فرمان؛ در نبود فرمان، setData؛ در نبود setData هم، LS خام */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_settings', st, { reason: 'w4' });
      else setData('ptf_crm_settings', st);
    } catch (e) {}
  }
  function mdDismissMap() {
    var st = mdSettings(); var m = st.mydayDismissed || {};
    var now = Date.now(), changed = false;
    Object.keys(m).forEach(function (k) { try { if (now - new Date(m[k]).getTime() > 30 * 864e5) { delete m[k]; changed = true; } } catch (e) {} });
    if (changed) { st.mydayDismissed = m; mdSaveSettings(st); }
    return m;
  }
  function mdFp(it) { return String((it && (it._fp || (it.panel + '|' + it.tx + '|' + (it.sub || '')))) || ''); }
  function mdIsDismissed(it) { var fp = mdFp(it); return !!(fp && mdDismissMap()[fp]); }
  function mdRefresh() {
    try { var box = document.getElementById('mydayBox'); if (box) { box.outerHTML = ptfMyDayHtml(); return; } } catch (eBox) {}
    if (typeof goPanelByName === 'function') { try { goPanelByName('dash'); } catch (eG) {} }
  }
  window.ptfMyDayDismiss = function (fp) {
    var st = mdSettings(); st.mydayDismissed = st.mydayDismissed || {}; st.mydayDismissed[fp] = new Date().toISOString(); mdSaveSettings(st);
    try { if (typeof audit === 'function') audit('روز من', 'حذف/پنهان‌سازی آیتم روز من', fp); } catch (eA) {}
    mdRefresh();
  };
  window.ptfMyDayDismissClick = function (ev, fp) {
    try { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ev && ev.preventDefault) ev.preventDefault(); if (ev) ev.cancelBubble = true; } catch (eEv) {}
    window.ptfMyDayDismiss(fp);
    return false;
  };
  window.ptfMyDayClearDismissed = function () {
    var st = mdSettings(); delete st.mydayDismissed; mdSaveSettings(st);
    mdRefresh();
  };
  window.ptfMyDayRepairDuplicates = function () {
    if (typeof ptfCollapseDuplicateBusinessRecords !== 'function') { alert('موتور پاکسازی تکراری‌ها هنوز بارگذاری نشده است.'); return; }
    if (!confirm('رکوردهای هم‌کد RFQ/Offer در داده اصلی ادغام می‌شوند و یک نماینده canonical باقی می‌ماند. ادامه می‌دهید؟')) return;
    var r = ptfCollapseDuplicateBusinessRecords({ confirm: 'PTF-COLLAPSE-DUP' });
    if (typeof ptfToast === 'function') ptfToast('پاکسازی تکراری‌ها: ' + (r.fixed || []).map(function (x) { return x.key + ' ' + x.before + '→' + x.after; }).join(' | '), 'ok');
    mdRefresh();
  };

  /* جمع‌آوری آیتم‌های امروز — خالص و تست‌پذیر */
  window.ptfMyDayItems = function () {
    var out = [];
    var today = todayISO2();
    var me = (typeof curSession === 'function' ? curSession() : {}) || {};

    /* ۱) یادآورهای باز سررسیده/امروز (مالک یا کاربران انتخاب‌شده) */
    try {
      getData('ptf_crm_reminders').forEach(function (r) {
        if (r.st !== 'open' || !r.dueISO || r.dueISO > today) return;
        if (typeof remIsMine === 'function') {
          if (!remIsMine(r)) return;
        } else if (r.by && me.name && r.by !== me.name) {
          return;
        }
        out.push({ ic: '⏰', cl: r.dueISO < today ? '#dc2626' : '#d97706', panel: 'rem',
          tx: (r.dueISO < today ? 'گذشته: ' : 'امروز: ') + (r.title || ''), sub: r.dueFa || r.dueISO });
      });
    } catch (e) {}

    /* ۲) همان گیت کارتابل: فقط اقدام لازمِ قابل‌مشاهدهٔ این کاربر (نقش یا شخص). */
    try {
      var myRole = typeof curRole === 'function' ? curRole() : '';
      getData('ptf_crm_notifs').forEach(function (n) {
        if (typeof ntfNeedsAction === 'function' ? !ntfNeedsAction(n) : (!n || n.done || !n.actionable)) return;
        var forMe = (n.toUsers || []).indexOf(me.user) > -1 ||
          (n.toRoles || []).indexOf(myRole) > -1 ||
          (!(n.toUsers || []).length && !(n.toRoles || []).length);
        if (!forMe) return;
        if ((n.readBy || []).indexOf(me.user) > -1) return;
        out.push({ ic: '✅', cl: '#dc2626', panel: (n.link || {}).panel || 'cart',
          tx: n.title || 'اقدام ارجاع‌شده', sub: n.t || '', _fp: 'ntf|' + (n.cd || '') });
      });
    } catch (e) {}

    /* مرتب‌سازی: قرمزها اول */
    /* v31.7.28 BUG-MYDAY-DUP-001 (گزارش کارفرما با اسکرین‌شات): یک RFQ تا ۵ بار در «روز من».
       دو علت: ① رکوردهای تکراری هم‌کد به‌جامانده از دوران BUG-CODE-DUP-002/003
       ② خود فهرست هیچ dedup ای نداشت. رفع: ادغام بر اساس امضای متن+پنل — هر رویداد یک بار،
       با شمارنده ×N اگر واقعاً چند رکورد پشتش باشد (اطلاع بدون شلوغی). */
    var seenTx = {}, deduped = [];
    out.forEach(function (it) {
      var k = it.panel + '|' + it.tx;
      var ex = seenTx[k];
      if (!ex) { seenTx[k] = it; it._n = 1; it._fp = k; deduped.push(it); }
      else { ex._n = (ex._n || 1) + 1; if (String(it.sub || '') < String(ex.sub || '')) ex.sub = it.sub; }
    });
    deduped.forEach(function (it) { if (it._n > 1) it.tx += ' (×' + it._n + ' رکورد هم‌کد)'; });
    var mdHidden = (typeof mdIsDismissed === 'function') ? mdIsDismissed : function () { return false; };
    out = deduped.filter(function (it) { return !mdHidden(it); });
    out.sort(function (a, b) {
      var ra = a.cl === '#dc2626' ? 0 : a.cl === '#d97706' ? 1 : 2;
      var rb = b.cl === '#dc2626' ? 0 : b.cl === '#d97706' ? 1 : 2;
      return ra - rb;
    });
    return out.slice(0, 5); /* فقط پنج اولویت واقعی امروز */
  };

  window.ptfMyDayHtml = function () {
    var items = [];
    try { items = ptfMyDayItems(); } catch (e) {}
    var body;
    if (!items.length) {
      body = '<div style="color:#059669;font-size:13px;padding:6px 0">✅ همه‌چیز مرتب است — امروز مورد اقدام‌داری ندارید.</div>';
    } else {
      body = items.map(function (it) {
        var fp = String(mdFp(it)).split('\\').join('\\\\').replace(/'/g, "\\'");
        return '<div onclick="goPanelByName(\'' + it.panel + '\')" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--brd);border-right:3px solid ' + it.cl + ';border-radius:10px;margin-bottom:5px;cursor:pointer;font-size:12.5px;background:var(--crd,#fff)">' +
          '<span>' + it.ic + ' ' + escP(it.tx) + '</span>' +
          '<span style="display:flex;align-items:center;gap:6px;color:#94a3b8;font-size:11px;white-space:nowrap;direction:ltr">' + escP(it.sub || '') + ' ↗ <button type="button" title="حذف از روز من" onclick="return ptfMyDayDismissClick(event,\'' + fp + '\')" style="border:0;background:#f1f5f9;color:#64748b;border-radius:8px;padding:2px 6px;cursor:pointer">×</button></span></div>';
      }).join('');
    }
    var nRed = items.filter(function (x) { return x.cl === '#dc2626'; }).length;
    return '<div id="mydayBox" style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:14px 16px;margin-bottom:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">' +
      '<h4 style="margin:0;font-size:14px">☀️ روز من — ' + new Date().toLocaleDateString('fa-IR') + '</h4>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      (items.some(function (x) { return (x._n || 1) > 1; }) ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#b45309" onclick="ptfMyDayRepairDuplicates()">پاکسازی تکراری‌ها</button>' : '') +
      (Object.keys(mdDismissMap()).length ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#64748b" onclick="ptfMyDayClearDismissed()">نمایش حذف‌شده‌ها</button>' : '') +
      (items.length ? '<span class="bd" style="background:' + (nRed ? '#fee2e2;color:#b91c1c' : '#fef3c7;color:#b45309') + '">' + items.length + ' مورد نیازمند توجه' + (nRed ? ' (' + nRed + ' فوری)' : '') + '</span>' : '') +
      '</div></div>' + body + '</div>';
  };

  /* hook داشبورد: «روز من» بعد از نوار ارز، قبل از کاشی‌ها — زنجیره: fx → myday → launcher → ... */
  function hookDash() {
    if (window._mydayHooked) return true;
    if (typeof window.buildDashboard !== 'function') return false;
    window._mydayHooked = true;
    var _bd = window.buildDashboard;
    window.buildDashboard = function () {
      var h = _bd();
      var w = '';
      try { w = ptfMyDayHtml(); } catch (e) { w = ''; }
      /* بعد از نوار ارز (اگر هست) درج شود؛ وگرنه ابتدای داشبورد */
      var mk = 'id="fxTicker"';
      var i = h.indexOf(mk);
      if (i > -1) {
        var close = h.indexOf('</div>', i);
        if (close > -1) return h.slice(0, close + 6) + w + h.slice(close + 6);
      }
      return w + h;
    };
    return true;
  }
  var t = 0;
  var iv = setInterval(function () { t++; if (hookDash() || t > 60) clearInterval(iv); }, 400);
  hookDash();
})();
