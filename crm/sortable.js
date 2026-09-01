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

  /* تبدیل مقدار به قابل‌مقایسه: تاریخ (شمسی/میلادی، ارقام فارسی/عربی/لاتین) > عدد (رشتهٔ عددی/مبلغ) > رشتهٔ نرمال
     v34.23.0 (RFQ-SORT-FIX): پیش از این تاریخِ ارقام‌فارسیِ بدون صفر پیش‌رو (خروجی
     toLocaleDateString('fa-IR') مثل «۱۴۰۵/۶/۱۰») به رشتهٔ نرمال می‌رفت و مقایسهٔ
     رشته‌ای دروغ می‌گفت — ۱۰ شهریور زیر ۹ شهریور و ماه ۶ زیر/بالاOfMonth ۱۰ بی‌معنا
     می‌نشست. حالا تاریخ به عدد قابل‌مقایسهٔ یکسان تبدیل می‌شود (شمسی +۶۲۱ برای
     هم‌مرتبه‌شدن با میلادی؛ ساعت اختیاری به دقیقه). */
  window.ptfSortVal = function (v) {
    if (v == null || v === '') return '';
    var s0 = String(v);
    var s = s0
      .replace(/[۰-۹]/g, function (d) { return '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]; })
      .replace(/[٠-٩]/g, function (d) { return '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]; });
    var dm = s.match(/(\d{4})([-\/])(\d{1,2})\2(\d{1,2})(?!\d)/);
    if (dm) {
      var yy = +dm[1], mm = +dm[3], dd = +dm[4];
      var jalali = yy > 1200 && yy < 1600;
      if ((jalali || (yy >= 1900 && yy <= 2100)) && mm >= 1 && mm <= (jalali ? 13 : 12) && dd >= 1 && dd <= 32) {
        if (jalali) yy += 621;
        var tm = s.match(/(\d{1,2}):(\d{2})/);
        return yy * 1e8 + mm * 1e6 + dd * 1e4 + (tm ? ((+tm[1]) * 60 + (+tm[2])) : 0);
      }
    }
    var num = s.replace(/[^\d.-]/g, '');
    if (num && num !== '-' && num !== '.') { var n = +num; if (!isNaN(n)) return n; }
    var d = s.match(/(?:13|14)\d{2}\/\d{1,2}\/\d{1,2}/);
    if (d) return d[0];
    return norm(s0);
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
    var arrow = st.key === key ? (st.dir === 'asc' ? ' ↑' : ' ↓') : '';
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
