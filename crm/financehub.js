/* =====================================================================
   PTF CRM — v31.9
   Legacy UAT token: btn('quality', '🧪 کیفیت داده')
   US-429: هاب مالی مدیریتی R9 — تب‌بندی تنخواه/هزینه/سهامداران/سال مالی
   - بدون کلید داده جدید؛ فقط لایه نمایش و محرمانگی UX
   - برای admin/chairman؛ کاربران عادی همان تنخواه ساده را می‌بینند
   ===================================================================== */
(function () {
  'use strict';
  function canHub() { try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function tab() { return window._finHubTab || 'petty'; }
  function finIcon(kind) {
    var p = {
      hub: '<path d="M4 20h16M6 20V9h12v11M4 9l8-5 8 5M9 13h2M13 13h2M9 17h2M13 17h2"/>',
      petty: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M17 7V5a1.5 1.5 0 00-1.8-1.4L4.2 6"/><circle cx="16" cy="13" r="1.3"/>',
      opex: '<path d="M5 21V4h14v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
      share: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 20v-1.2A4.8 4.8 0 018.3 14h1.4a4.8 4.8 0 014.8 4.8V20"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.3a4 4 0 014.5 4V20"/>',
      fiscal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4M8 14h3M8 17h6"/>',
      supplier: '<path d="M3 21V8l6 4V8l6 4V8l6 4v9z"/><path d="M7 21v-4h4v4"/>',
      customer: '<circle cx="12" cy="8.5" r="3.5"/><path d="M6.5 21v-2a5 5 0 015-5h1a5 5 0 015 5v2"/>',
      report: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
      quality: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M8.5 12l2.2 2.2 4.8-5"/>'
    };
    return '<span class="fin-hub-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (p[kind] || p.report) + '</svg></span>';
  }
  function btn(id, lb, icon) {
    var on = tab() === id;
    return '<button type="button" class="fin-hub-tab' + (on ? ' active' : '') + '" onclick="finHubSet(\'' + id + '\')">' + finIcon(icon) + '<span>' + lb + '</span></button>';
  }
  function bar() {
    if (!canHub()) return '';
    return '<div id="finHubBar" class="fin-hub-bar">' +
      '<div class="fin-hub-layout"><div class="fin-hub-heading"><b class="fin-hub-title">' + finIcon('hub') + '<span>هاب مالی مدیریتی</span></b><small>تنخواه، هزینه جاری، سهامداران، سال مالی و گزارش رسمی — تب‌بندی شده برای کاهش شلوغی پنل</small></div>' +
      '<div class="fin-hub-tabs">' + btn('petty', 'تنخواه', 'petty') + btn('opex', 'هزینه جاری', 'opex') + btn('share', 'سهامداران', 'share') + btn('fiscal', 'سال مالی', 'fiscal') + btn('supacc', 'حساب تأمین‌کنندگان', 'supplier') + btn('custacc', 'حساب مشتریان', 'customer') + btn('workcap', 'گزارش رسمی مالی', 'report') + btn('quality', 'کیفیت داده', 'quality') + '</div></div></div>';
  }
  window.finHubSet = function (id) { window._finHubTab = id || 'petty'; finHubApply(); };
  window.finHubApply = function () {
    if (!canHub()) return;
    var t = tab();
    function show(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }
    ['ptAccount', 'ptPeriods', 'ptSummary', 'ptWrap'].forEach(function (id) { show(id, t === 'petty'); });
    show('opexBox', t === 'opex');
    show('shareBox', t === 'share');
    show('fiscalBox', t === 'fiscal');
    show('slFinanceHubBox', t === 'supacc');
    show('cfFinanceHubBox', t === 'custacc');
    show('wcFinanceHubBox', t === 'workcap');
    show('qualityBox', t === 'quality');
    var old = document.getElementById('finHubBar');
    if (old) old.outerHTML = bar();
  };
  function hook() {
    if (window._finHubHooked || typeof window.buildPetty !== 'function') return false;
    window._finHubHooked = true;
    var _bp = window.buildPetty;
    window.buildPetty = function () { return bar() + _bp() + (typeof ptfDataQualityHtml === 'function' ? ptfDataQualityHtml() : ''); };
    var _rp = window.renderPetty;
    if (typeof _rp === 'function') window.renderPetty = function () { _rp(); try { finHubApply(); } catch (e) {} };
    return true;
  }
  var n = 0;
  var it = setInterval(function () { n++; if (hook() || n > 60) clearInterval(it); }, 250);
  hook();
})();
