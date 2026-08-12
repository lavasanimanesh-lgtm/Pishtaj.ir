/* =====================================================================
   PTF CRM — nav-focus.js — v34.4.77
   هایلایت چندثانیه‌ای رکورد مقصد بعد از هدایت بین ماژول‌ها.
   ===================================================================== */
(function () {
  'use strict';

  var DURATION = 3800;

  function injectCss() {
    if (document.getElementById('ptfNavFocusCss')) return;
    var s = document.createElement('style');
    s.id = 'ptfNavFocusCss';
    s.textContent =
      '@keyframes ptfNavPulse{0%{box-shadow:0 0 0 0 rgba(239,75,26,.55);background:rgba(254,243,199,.95)}40%{box-shadow:0 0 0 8px rgba(239,75,26,.12);background:rgba(254,243,199,.7)}100%{box-shadow:0 0 0 0 rgba(239,75,26,0);background:transparent}}' +
      '.ptf-nav-flash{animation:ptfNavPulse 1.2s ease-out 3;outline:2px solid #ef4b1a !important;outline-offset:2px;border-radius:12px;z-index:2;position:relative}';
    (document.head || document.documentElement).appendChild(s);
  }

  function escAttr(v) {
    return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  window.ptfNavMark = function (kind, id) {
    return ' data-ptf-nav="' + String(kind || '') + ':' + String(id || '').replace(/"/g, '') + '"';
  };

  window.ptfNavFlash = function (el) {
    if (!el) return false;
    injectCss();
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {
      try { el.scrollIntoView(true); } catch (e2) {}
    }
    el.classList.remove('ptf-nav-flash');
    void el.offsetWidth;
    el.classList.add('ptf-nav-flash');
    setTimeout(function () { try { el.classList.remove('ptf-nav-flash'); } catch (e3) {} }, DURATION);
    return true;
  };

  function findTarget(kind, id) {
    if (!id) return null;
    var sel = '[data-ptf-nav="' + escAttr(kind) + ':' + escAttr(id) + '"]';
    var el = document.querySelector(sel);
    if (el) return el;
    if (kind === 'deal') {
      el = document.getElementById('sfDeal-' + id);
      if (el) return el;
    }
    if (kind === 'petty' || !kind) {
      el = document.getElementById('pty-' + id);
      if (el) return el;
    }
    if (kind === 'cheque') {
      el = document.querySelector('[data-cheque-cd="' + escAttr(id) + '"]');
      if (el) return el;
    }
    return document.getElementById('ptfNav-' + String(kind || 'x') + '-' + String(id).replace(/[^A-Za-z0-9_-]/g, '_'));
  }

  window.ptfNavApplyPending = function () {
    var p = window._ptfNavPending;
    if (!p || !p.id) return false;
    if (p.kind === 'deal' && typeof window.sfToggle === 'function' && p.open) {
      try {
        window._sfTab = 'files';
        if (window._sfOpen !== p.id) {
          window._sfOpen = p.id;
          if (typeof window.renderDeals === 'function') window.renderDeals();
        }
      } catch (eO) {}
    }
    var el = findTarget(p.kind, p.id);
    if (el) {
      window.ptfNavFlash(el);
      window._ptfNavPending = null;
      return true;
    }
    p.tries = (p.tries || 0) + 1;
    if (p.tries > 12) { window._ptfNavPending = null; return false; }
    return false;
  };

  window.ptfNavGoto = function (panel, opts) {
    opts = opts || {};
    window._ptfNavPending = {
      panel: panel,
      kind: opts.kind || '',
      id: opts.id || opts.cd || '',
      open: opts.open !== false,
      tries: 0
    };
    injectCss();
    try {
      if (panel && typeof window.goPanel === 'function') window.goPanel(panel);
      else if (panel && typeof window.goPanelByName === 'function') window.goPanelByName(panel);
    } catch (e) {}
    setTimeout(window.ptfNavApplyPending, 80);
    setTimeout(window.ptfNavApplyPending, 280);
    setTimeout(window.ptfNavApplyPending, 700);
  };

  window.ptfGoSalesFile = function (dealCd) {
    if (!dealCd) {
      try { if (typeof goPanel === 'function') goPanel('deals'); } catch (e) {}
      return;
    }
    try { window._sfTab = 'files'; window._sfOpen = dealCd; } catch (e2) {}
    window.ptfNavGoto('deals', { kind: 'deal', id: dealCd, open: true });
  };

  function hookGoPanel() {
    if (window._ptfNavGoHooked || typeof window.goPanel !== 'function') return false;
    window._ptfNavGoHooked = true;
    var orig = window.goPanel;
    window.goPanel = function (id, btn) {
      var r = orig.apply(this, arguments);
      setTimeout(window.ptfNavApplyPending, 90);
      setTimeout(window.ptfNavApplyPending, 420);
      return r;
    };
    return true;
  }
  var n = 0;
  var iv = setInterval(function () { n++; if (hookGoPanel() || n > 40) clearInterval(iv); }, 200);

  if (typeof window.renderDeals === 'function') {
    var _rd = window.renderDeals;
    window.renderDeals = function () {
      var out = _rd.apply(this, arguments);
      setTimeout(window.ptfNavApplyPending, 30);
      return out;
    };
  }
})();
