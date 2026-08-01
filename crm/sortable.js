/* PTF CRM — sortable.js — کامپوننت مشترک سورت فهرست‌ها (UR-2026-08-01-07)
   فقط توابع خالص + رجیستری رندر؛ بدون نوشتن مستقیم در DOM (HTML string).
   هر لیست: ptfRegisterSortable(listId, {getters, render}) سپس در رندر:
   rows = ptfSorted(listId, rows) و هدرها با ptfSortHeader(listId, key, label). */
(function () {
  'use strict';
  window.ptfSortState = window.ptfSortState || {};
  window._ptfSortableRegistry = window._ptfSortableRegistry || {};

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\u200c\u200e\u200f\s\-_.،,؛;()/\\]/g, '').toLowerCase();
  }

  /* تبدیل مقدار به قابل‌مقایسه: عدد (از رشتهٔ عددی/مبلغ) > تاریخ شمسی > رشتهٔ نرمال */
  window.ptfSortVal = function (v) {
    if (v == null || v === '') return '';
    var s = String(v);
    var num = s.replace(/[^\d.-]/g, '');
    if (num && num !== '-' && num !== '.') { var n = +num; if (!isNaN(n)) return n; }
    var d = s.match(/(?:13|14)\d{2}\/\d{1,2}\/\d{1,2}/);
    if (d) return d[0];
    return norm(s);
  };

  window.ptfSortRows = function (rows, key, dir, getters) {
    var g = (getters && getters[key]) || function (r) { return r[key]; };
    var mul = dir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var va = window.ptfSortVal(g(a)), vb = window.ptfSortVal(g(b));
      var ea = va === '' || va == null, eb = vb === '' || vb == null;
      if (ea && eb) return 0;
      if (ea) return 1;  /* مقادیر خالی/نامشخص همیشه در انتها */
      if (eb) return -1;
      if (va < vb) return -1 * mul;
      if (va > vb) return 1 * mul;
      return 0;
    });
  };

  /* اعمال سورت ثبت‌شده روی آرایه (اگر سورتی فعال نبود، آرایه دست‌نخورده) */
  window.ptfSorted = function (listId, rows) {
    var st = window.ptfSortState[listId], reg = window._ptfSortableRegistry[listId];
    if (!st || !st.key || !reg || !reg.getters || !Array.isArray(rows)) return rows;
    return window.ptfSortRows(rows, st.key, st.dir, reg.getters);
  };

  /* هدر قابل کلیک با فلش (برای جدول‌ها) */
  window.ptfSortHeader = function (listId, key, label) {
    var st = window.ptfSortState[listId] || {};
    var arrow = st.key === key ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return '<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="ptfSortClick(\'' + listId + '\',\'' + key + '\')" title="مرتب‌سازی">' + label + arrow + '</th>';
  };

  window.ptfSortClick = function (listId, key) {
    var st = window.ptfSortState[listId] || {};
    if (st.key === key) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
    else { st.key = key; st.dir = 'asc'; }
    window.ptfSortState[listId] = st;
    var reg = window._ptfSortableRegistry[listId];
    if (reg && typeof reg.render === 'function') { try { reg.render(); } catch (e) { console.error('ptfSortClick render', e); } }
  };

  window.ptfRegisterSortable = function (listId, opts) {
    window._ptfSortableRegistry[listId] = opts || {};
  };

  /* Dropdown سورت (برای لیست‌های کارتی مثل تنخواه) */
  window.ptfSortSelectHtml = function (listId, opts) {
    var st = window.ptfSortState[listId] || {};
    var cur = st.key ? st.key + ':' + (st.dir || 'asc') : '';
    var o = (opts || []).map(function (x) {
      var v = x.key + ':' + (x.dir || 'asc');
      return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + x.lb + '</option>';
    }).join('');
    return '<select onchange="ptfSortSelectChange(\'' + listId + '\',this.value)" style="padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px" title="سورت فهرست">' + o + '</select>';
  };

  window.ptfSortSelectChange = function (listId, val) {
    var p = String(val || '').split(':');
    window.ptfSortState[listId] = { key: p[0], dir: p[1] || 'asc' };
    var reg = window._ptfSortableRegistry[listId];
    if (reg && typeof reg.render === 'function') { try { reg.render(); } catch (e) { console.error('ptfSortSelectChange render', e); } }
  };
})();
