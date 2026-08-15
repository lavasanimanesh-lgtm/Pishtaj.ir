/* =====================================================================
   PTF CRM — mobile-table-labels.js — MOB-002
   عنوان ستون‌های جدول را در کارت موبایل به data-mobile-label تبدیل می‌کند.
   این کار generic است، اما فرم‌های داخل modal و جدول‌های چاپی عمداً مستثنا هستند.
   ===================================================================== */
(function () {
  'use strict';
  var BP = 768;
  var css = document.createElement('style');
  css.textContent = '@media(max-width:768px){.ptf-mobile-sort{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff;border:1px solid var(--brd,#e2e8f0);border-radius:12px;padding:8px 10px;margin:0 0 10px;font-size:11.5px;font-weight:800;color:#475569}.ptf-mobile-sort select{flex:1;min-width:0;max-width:68%;min-height:40px!important;padding:6px 8px!important;font-size:13px!important}}@media(min-width:769px){.ptf-mobile-sort{display:none!important}}';
  document.head.appendChild(css);
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
  function ensureMobileSort(table) {
    var ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var options = [];
    ths.forEach(function (th) {
      var on = th.getAttribute('onclick') || '';
      var m = on.match(/ptfSortClick\(['"]([^'"]+)['"],['"]([^'"]+)['"]\)/);
      var label = clean(th.innerText || th.textContent);
      if (m && label) options.push({ list: m[1], key: m[2], label: label });
    });
    var wrap = table.parentElement;
    if (!wrap || !options.length) return;
    var id = 'ptfMobileSort_' + options[0].list;
    var bar = wrap.querySelector('#' + id);
    if (!bar) {
      bar = document.createElement('label'); bar.id = id; bar.className = 'ptf-mobile-sort';
      bar.innerHTML = '<span>مرتب‌سازی کارت‌ها</span><select aria-label="مرتب‌سازی کارت‌ها"><option value="' + options[0].list + '|">پیش‌فرض</option>' + options.map(function (o) { return '<option value="' + o.list + '|' + o.key + '|asc">' + o.label + ' — صعودی</option><option value="' + o.list + '|' + o.key + '|desc">' + o.label + ' — نزولی</option>'; }).join('') + '</select>';
      bar.querySelector('select').addEventListener('change', function () {
        var p = String(this.value || '').split('|'); if (!p[0]) return;
        if (!p[1]) {
          delete (window.ptfSortState || {})[p[0]];
          var reg = (window._ptfSortableRegistry || {})[p[0]]; if (reg && typeof reg.render === 'function') reg.render();
          return;
        }
        if (typeof window.ptfSortSelectChange === 'function') window.ptfSortSelectChange(p[0], p[1] + ':' + (p[2] || 'asc'));
      });
      wrap.insertBefore(bar, table);
    }
    try {
      var st = (window.ptfSortState || {})[options[0].list] || {};
      bar.querySelector('select').value = st.key ? (options[0].list + '|' + st.key + '|' + (st.dir || 'asc')) : (options[0].list + '|');
    } catch (e) {}
  }
  function applyTable(table) {
    if (!eligible(table)) return;
    ensureMobileSort(table);
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
