/* =====================================================================
   PTF CRM — mobile-nav-state.js — MOB-003
   لایهٔ بیرونی state ناوبری بعد از همهٔ hookهای goPanel.
   چند ماژول goPanel را wrap می‌کنند؛ این فایل آخر بار می‌شود و تا پایان
   hookهای تاخیردار، wrapper نهایی را دوباره بررسی می‌کند.
   ===================================================================== */
(function () {
  'use strict';

  function resolve(id) {
    return (typeof window.ptfFindPanelButton === 'function') ? window.ptfFindPanelButton(id) : null;
  }
  function hookLatest() {
    var current = window.goPanel;
    if (typeof current !== 'function' || current._ptfMobileStateOuter) return false;
    var wrapped = function (id, btn) {
      var resolved = btn || resolve(id);
      var result = current.call(this, id, resolved);
      /* فقط بعد از عبور از guard احتمالی ماژول، state فعلی ثبت می‌شود. */
      window.ptfActivePanel = id;
      return result;
    };
    wrapped._ptfMobileStateOuter = true;
    window.goPanel = wrapped;
    return true;
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    hookLatest();
    if (tries > 40) clearInterval(timer);
  }, 200);
})();
