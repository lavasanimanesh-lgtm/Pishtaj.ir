/* =====================================================================
   PTF CRM — Sprint 129 / v20.9
   US-411 Phase 1A: فیلتر «مشتریان من» (My Customers Filter)

   معماری (طبق اصل 11 — Hook-based modules):
   — بدون تغییر index.html / offers.js
   — منطق فیلتر در این ماژول، state در localStorage
   — UI toggle بالای لیست مشتریان
   — منطق نقش‌محور (طبق تأیید کارفرما — ۱۴۰۵/۰۴/۱۴):
     • رییس هیات مدیره (chairman) / مدیرعامل (ceo) / مدیر بازرگانی (commercial) / ادمین (admin) → همه مشتریان
     • سایر نقش‌ها (sales, buyer, accountant, collector) → فقط crBy=me (رکوردهای بدون مالک فقط برای ارشد)
   — UI toggle:
     • نقش‌های ارشد: هر دو دکمه «من» و «همه» با شمارنده پویا
     • سایر نقش‌ها: فقط نوار اطلاعاتی (بدون دکمه) — «X مشتری (مال شما)»

   سازگاری:
   — i18n: متن‌ها hard-coded فارسی (سازگار با سایر ماژول‌ها)
   — RTL/LTR: استایل inline با direction:rtl
   — موبایل: انعطاف‌پذیر (flex-wrap در عرض کم)
   ===================================================================== */

(function () {
  'use strict';

  /* ============ State ============ */
  var STORAGE_KEY = 'ptf_my_cust_filter';
  var VALID_STATES = ['mine', 'all'];

  function getState() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return (VALID_STATES.indexOf(s) > -1) ? s : 'mine';
    } catch (e) { return 'mine'; }
  }
  function saveStateSafely(s) {
    try {
      var saved;
      if (typeof ptfStorageSafeSetItem === 'function') saved = ptfStorageSafeSetItem(STORAGE_KEY, s);
      else { localStorage.setItem(STORAGE_KEY, s); saved = true; }
      if (saved === false) throw new Error('localStorage write rejected');
      return true;
    } catch (e) {
      var msg = '⚠️ ذخیره فیلتر مشتریان انجام نشد؛ ظرفیت حافظه محلی را بررسی کنید.';
      console.error('ptf_my_customers_filter_storage_error:', e);
      try {
        if (typeof ptfToast === 'function') ptfToast(msg, 'warn');
        else alert(msg);
      } catch (e2) {}
      return false;
    }
  }

  function setState(s) {
    if (VALID_STATES.indexOf(s) > -1) saveStateSafely(s);
  }

  /* ============ نقش‌های ارشد (طبق تأیید کارفرما) ============ */
  var SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];

  /* ============ RBAC: چه کسی می‌تواند چه چیزی ببیند ============ */
  /**
   * بازگشت: 'all' (همیشه همه) | 'own' (فقط خودم)
   * طبق تأیید ۱۴۰۵/۰۴/۱۴:
   * - admin/chairman/ceo/commercial → 'all'
   * - sales/buyer/accountant/collector → 'own'
   */
  function getScope() {
    try {
      if (typeof curRole !== 'function') return 'own';
      var r = curRole();
      if (SENIOR_ROLES.indexOf(r) > -1) return 'all';
      return 'own';
    } catch (e) { return 'own'; }
  }

  function isSenior() {
    try {
      if (typeof curRole !== 'function') return false;
      return SENIOR_ROLES.indexOf(curRole()) > -1;
    } catch (e) { return false; }
  }

  /* ============ منطق فیلتر ============ */
  /**
   * فیلتر آرایه مشتریان بر اساس state و scope نقش.
   * - scope='all' (ارشد/ادمین): state بی‌اثر → همه
   *   (طبق تأیید: ادمین همیشه همه را می‌بیند)
   * - scope='own' (سایر نقش‌ها): فقط crBy=me — رکوردهای بدون crBy مخفی (v21.0 US-413-ownerless)
   *   (طبق تأیید: state بی‌اثر — فقط «من» معنی دارد)
   */
  function ownerOf(c) {
    return (c && (c.owner || c.crBy) || '').trim();
  }

  function currentUser() {
    try {
      var me = (typeof curSession === 'function') ? curSession() : {};
      return me.user || '';
    } catch (e) { return ''; }
  }

  function applyFilter(items, forcedState) {
    if (!Array.isArray(items)) return items;
    var scope = getScope();
    var state = forcedState || getState();
    var myUser = currentUser();

    // نقش‌های غیرارشد همیشه فقط مشتریان خودشان را می‌بینند
    if (scope !== 'all') {
      return items.filter(function (c) {
        if (!c) return false;
        var own = ownerOf(c);
        return !!own && own === myUser;
      });
    }

    // نقش‌های ارشد: طبق مصوبه — حتی state=mine هم همه را می‌بینند (admin/chairman/ceo/commercial)
    if (state === 'all' || isSenior()) return items;
    return items.filter(function (c) {
      if (!c) return false;
      var own = ownerOf(c);
      return !!own && own === myUser;
    });
  }

  /* ============ UI Toggle ============ */
  function countLegacy(items) {
    return (items || []).filter(function (c) { return c && !ownerOf(c); }).length;
  }

  function buildBarHtml(totalCount, filteredCount, legacyCount) {
    var state = getState();
    var senior = isSenior();

    if (senior) {
      // نقش‌های ارشد: دو دکمه «من» و «همه» با شمارنده پویا
      var mineLabel = '👤 من (' + filteredCount + ')';
      var allLabel = '🌍 همه (' + totalCount + ')';
      var mineBtnCls = (state === 'mine') ? 'bt' : 'bt bt-o';
      var allBtnCls = (state === 'all') ? 'bt' : 'bt bt-o';

      var info = '<span style="font-size:11px;color:#94a3b8;margin-right:auto">نمایش ' + totalCount + ' مشتری' + (legacyCount ? ' | ⚠️ ' + legacyCount + ' رکورد قدیمی بدون مالک' : '') + '</span>';

      return '<div id="ptfMyCustBar" data-scope="all" data-senior="1" style="display:flex;gap:6px;align-items:center;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="font-size:12px;font-weight:800;color:#334155">🔍 فیلتر نمایش:</span>' +
        '<button type="button" id="ptfMyCustMine" class="' + mineBtnCls + '" style="padding:5px 12px;font-size:12px" onclick="ptfSetMyCustFilter(\'mine\')">' + mineLabel + '</button>' +
        '<button type="button" id="ptfMyCustAll" class="' + allBtnCls + '" style="padding:5px 12px;font-size:12px" onclick="ptfSetMyCustFilter(\'all\')">' + allLabel + '</button>' +
        info +
        '</div>';
    } else {
      // سایر نقش‌ها: فقط نوار اطلاعاتی (بدون دکمه)
      return '<div id="ptfMyCustBar" data-scope="own" data-senior="0" style="display:flex;gap:6px;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 12px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="font-size:12px">🔒</span>' +
        '<span style="font-size:12.5px;font-weight:800;color:#1e40af">فیلتر «مشتریان من» فعال</span>' +
        '<span style="font-size:11px;color:#475569;margin-right:auto" title="به دلیل محرمانگی، فقط مشتریانی که خودتان ثبت کرده‌اید نمایش داده می‌شوند. رکوردهای بدون مالک فقط برای مدیران ارشد قابل مشاهده‌اند.">نمایش ' + filteredCount + ' مشتری مال شما</span>' +
        '</div>';
    }
  }


  function applyDomFilter() {
    var tb = document.getElementById('cTb');
    if (!tb) return;
    var all = [];
    try { all = (typeof getData === 'function') ? getData('ptf_crm_customers') : []; } catch (e) { all = []; }
    var allowed = {};
    applyFilter(all).forEach(function (c) { if (c && c.cd) allowed[c.cd] = true; });
    var rows = tb.querySelectorAll('tr');
    var visible = 0;
    rows.forEach(function (tr) {
      var first = tr.querySelector('td');
      if (!first) return;
      var cd = (first.textContent || '').trim().split(/\s+/)[0];
      if (!cd || !/^CUST|^C-/.test(cd)) return;
      var show = !!allowed[cd];
      tr.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var d = document.getElementById('dCust');
    if (d) d.textContent = visible;
  }

  function injectToggle() {
    // فقط در پنل cust
    var searchInput = document.getElementById('cSrch');
    if (!searchInput) return;
    var ph = searchInput.closest('.ph');
    if (!ph) return;

    // حذف نمونه قبلی اگر هست
    var old = document.getElementById('ptfMyCustBar');
    if (old) old.remove();

    // محاسبه تعداد
    var all = [];
    try { all = (typeof getData === 'function') ? getData('ptf_crm_customers') : []; } catch (e) { all = []; }
    var mine = applyFilter(all, 'mine');

    var html = buildBarHtml(all.length, mine.length, countLegacy(all));
    ph.insertAdjacentHTML('afterend', html);
  }

  /* ============ API عمومی ============ */
  window.ptfSetMyCustFilter = function (state) {
    if (VALID_STATES.indexOf(state) < 0) return;
    // فقط نقش‌های ارشد حق تغییر state به 'all' را دارند
    if (state === 'all' && !isSenior()) return;
    setState(state);
    // رندر مجدد
    if (typeof window.renderCustomers === 'function') {
      try { window.renderCustomers(); } catch (e) { console.error('PTF my-customers-filter: render failed', e); }
    }
    if (typeof ptfToast === 'function') {
      var label = (state === 'mine') ? 'فقط مشتریان من' : 'همه مشتریان';
      ptfToast('🔍 فیلتر: ' + label, 'info');
    }
  };

  /* ============ Override renderCustomers (اصل 11 — Hook-based) ============ */
  // چون چند ماژول دیگر (offers.js, guards.js, scoring.js, listclean.js, custmerge.js) نیز override می‌کنند،
  // ما آخرین hook هستیم تا toggle حتماً بعد از همه رندرها inject شود.
  var _hookRetries = 0;
  function hookRender(fnName) {
    if (typeof window[fnName] !== 'function') return false;
    var flag = '_ptfMyCustFilterHooked_' + fnName;
    if (window[flag]) return true;
    var _old = window[fnName];
    window[fnName] = function () {
      try { _old.apply(this, arguments); } catch (e) { console.error(e); }
      try { applyDomFilter(); injectToggle(); } catch (e2) { console.error('PTF my-customers-filter: inject/filter failed', e2); }
    };
    window[flag] = true;
    return true;
  }

  /* window.renderCustomers = function (hooked override) */
  function setupHook() {
    var h1 = hookRender('renderCustomers');
    var h2 = hookRender('renderCustomers2');
    var hooked = h1 || h2;
    if (!hooked) {
      _hookRetries++;
      if (_hookRetries < 60) { setTimeout(setupHook, 100); }
      return;
    }
    try { injectToggle(); applyDomFilter(); } catch (e) {}
  }

  /* ============ راه‌اندازی ============ */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupHook);
    } else {
      setupHook();
    }
  }

  /* ============ Export برای تست (تستر 125) ============ */
  window.ptfMyCustFilter = {
    getState: getState,
    setState: setState,
    getScope: getScope,
    isSenior: isSenior,
    applyFilter: applyFilter,
    SENIOR_ROLES: SENIOR_ROLES,
    STORAGE_KEY: STORAGE_KEY,
    VALID_STATES: VALID_STATES
  };

  init();
})();
