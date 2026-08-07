/* =====================================================================
   PTF CRM — mobile-table-labels.js — MOB-002
   عنوان ستون‌های جدول را در کارت موبایل به data-mobile-label تبدیل می‌کند.
   این کار generic است، اما فرم‌های داخل modal و جدول‌های چاپی عمداً مستثنا هستند.
   ===================================================================== */
(function () {
  'use strict';
  var BP = 768;
  function isMob() { return window.innerWidth <= BP; }
  function clean(s) {
    return String(s || '')
      .replace(/[⇅↕▲▼]/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '')
      .replace(/\s+/g, ' ').trim();
  }
  function actionHeader(s) { return /^(عملیات|اقدام|action|مدیریت|گزینه‌ها?|ویرایش|حذف)$/i.test(clean(s)); }
  function eligible(table) {
    if (!table || !table.closest('#panels')) return false;
    if (table.closest('.md,.ptfdlg,#chqpMulti,#chqpGv,[data-mobile-labels="off"]')) return false;
    return !!table.querySelector('thead th') && !!table.querySelector('tbody');
  }
  function applyTable(table) {
    if (!eligible(table)) return;
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th) { return clean(th.innerText || th.textContent); });
    if (!headers.length) return;
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      var col = 0;
      Array.prototype.forEach.call(tr.children, function (td) {
        if (!td || td.tagName !== 'TD') return;
        var span = Math.max(1, parseInt(td.getAttribute('colspan') || '1', 10) || 1);
        var label = headers[col] || '';
        var hasControls = !!td.querySelector('button,input,select,textarea');
        if (span > 1 || (actionHeader(label) && hasControls) || (!label && hasControls)) label = '';
        td.setAttribute('data-mobile-label', label);
        col += span;
      });
    });
    table.setAttribute('data-mobile-labels-ready', '1');
  }
  function apply() {
    if (!isMob()) return;
    var root = document.getElementById('panels');
    if (!root) return;
    root.querySelectorAll('.tb2 table').forEach(applyTable);
  }
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || setTimeout)(function () { scheduled = false; apply(); });
  }
  function boot() {
    var root = document.getElementById('panels');
    if (!root || window._ptfMobileTableLabelsBooted) return false;
    window._ptfMobileTableLabelsBooted = true;
    new MutationObserver(schedule).observe(root, {childList:true, subtree:true});
    apply();
    return true;
  }
  var tries = 0;
  var timer = setInterval(function () { tries++; if (boot() || tries > 50) clearInterval(timer); }, 200);
  window.addEventListener('resize', schedule);
  window.ptfMobileTableLabelsApply = apply;
})();
