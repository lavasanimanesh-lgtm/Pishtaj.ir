/* =====================================================================
   PTF CRM — theme-contrast.js — v31.9
   Dark-mode readability guard
   - یک لایهٔ semantic برای رنگ‌های پایهٔ CRM
   - سازگاری امن با styleهای inline ماژول‌های قدیمی/پویا
   - بدون polling: MutationObserver فقط برای DOM تازه‌ساخته‌شده
   ===================================================================== */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.id = 'ptfThemeContrastCss';
  style.textContent =
    ':root{' +
      '--ptf-surface:#ffffff;--ptf-surface-soft:#f8fafc;--ptf-surface-raised:#ffffff;' +
      '--ptf-text:#1e293b;--ptf-text-muted:#64748b;--ptf-text-subtle:#64748b;--ptf-border:#e2e8f0' +
    '}' +
    'body.ptf-dark{' +
      'color-scheme:dark;' +
      '--bg:#0b1220;--crd:#162235;--sb:#0b1220;--brd:#334155;--tx:#f8fafc;' +
      '--ptf-surface:#162235;--ptf-surface-soft:#1d2a3d;--ptf-surface-raised:#223149;' +
      '--ptf-text:#f8fafc;--ptf-text-muted:#d5dfed;--ptf-text-subtle:#b9c7d9;--ptf-border:#40526b' +
    '}' +

    /* پایه: عناصر ثابت index.html و UI kit */
    'body.ptf-dark,body.ptf-dark .ca{background:var(--bg)!important;color:var(--ptf-text)}' +
    'body.ptf-dark .tb,body.ptf-dark .pn,body.ptf-dark .sc,body.ptf-dark .md,body.ptf-dark .ptfdlg,body.ptf-dark .login-c{background:var(--ptf-surface)!important;color:var(--ptf-text)!important;border-color:var(--ptf-border)!important}' +
    'body.ptf-dark .tb h2,body.ptf-dark .ph h3,body.ptf-dark .md h3,body.ptf-dark .ptfdlg h3,body.ptf-dark .login-c h2{color:var(--ptf-text)!important}' +
    'body.ptf-dark .login-c p,body.ptf-dark .sc span,body.ptf-dark small,body.ptf-dark .fld label{color:var(--ptf-text-muted)!important}' +
    'body.ptf-dark input,body.ptf-dark select,body.ptf-dark textarea,body.ptf-dark .fld input,body.ptf-dark .fld select,body.ptf-dark .fld textarea,body.ptf-dark .sb2 input,body.ptf-dark .ptfdlg input,body.ptf-dark .ptfdlg select,body.ptf-dark .ptfdlg textarea{background:var(--ptf-surface-soft)!important;color:var(--ptf-text)!important;border-color:var(--ptf-border)!important;caret-color:var(--ptf-text)}' +
    'body.ptf-dark input::placeholder,body.ptf-dark textarea::placeholder{color:#aebdd0!important;opacity:1}' +
    'body.ptf-dark option{background:var(--ptf-surface);color:var(--ptf-text)}' +
    'body.ptf-dark .bt.bt-o,body.ptf-dark .ba,body.ptf-dark .ptfdlg .cancel{background:var(--ptf-surface-soft)!important;color:var(--ptf-text-muted)!important;border-color:var(--ptf-border)!important}' +
    'body.ptf-dark .bt{background:linear-gradient(135deg,#c2410c,#b45309)!important;color:#fff!important}' +
    'body.ptf-dark .bt-s,body.ptf-dark .ptfdlg .ok:not(.danger){background:#047857!important;color:#fff!important}' +
    'body.ptf-dark .ptfdlg .ok.danger{background:#b91c1c!important;color:#fff!important}' +
    'body.ptf-dark .tb2 table,body.ptf-dark table{color:var(--ptf-text)}' +
    'body.ptf-dark th,body.ptf-dark .tb2 th{background:var(--ptf-surface-soft)!important;color:var(--ptf-text-muted)!important;border-color:var(--ptf-border)!important}' +
    'body.ptf-dark td,body.ptf-dark .tb2 td,body.ptf-dark tr:hover td{background:transparent!important;color:inherit;border-color:var(--ptf-border)!important}' +
    'body.ptf-dark .tb2 tr:hover{background:var(--ptf-surface-soft)!important}' +
    'body.ptf-dark hr,body.ptf-dark .md h3{border-color:var(--ptf-border)!important}' +

    /* badgeهای تعریف‌شده در CSS پایه */
    'body.ptf-dark .b-st1{background:#451a1a!important;color:#fecaca!important}body.ptf-dark .b-st2,body.ptf-dark .b-st5,body.ptf-dark .b-op{background:#172554!important;color:#bfdbfe!important}' +
    'body.ptf-dark .b-st3,body.ptf-dark .b-st6,body.ptf-dark .b-st8{background:#451a03!important;color:#fde68a!important}body.ptf-dark .b-st4,body.ptf-dark .b-st7,body.ptf-dark .b-st9{background:#064e3b!important;color:#bbf7d0!important}' +
    'body.ptf-dark .b-stTO,body.ptf-dark .b-ad{background:#2e1065!important;color:#ddd6fe!important}body.ptf-dark .b-stCO{background:#083344!important;color:#a5f3fc!important}body.ptf-dark .b-stX{background:var(--ptf-surface-soft)!important;color:var(--ptf-text-muted)!important}' +

    /* کلاس‌های سازگاری که بر اساس inline styleهای ماژول‌های قدیمی اعمال می‌شوند */
    'body.ptf-dark .ptf-theme-surface{background:var(--ptf-surface)!important;color:var(--ptf-text)!important}body.ptf-dark .ptf-theme-surface-soft{background:var(--ptf-surface-soft)!important;color:var(--ptf-text)!important}' +
    'body.ptf-dark .ptf-theme-bg-info{background:#082f49!important;color:#dbeafe!important;border-color:#155e75!important}body.ptf-dark .ptf-theme-bg-success{background:#064e3b!important;color:#d1fae5!important;border-color:#047857!important}' +
    'body.ptf-dark .ptf-theme-bg-warning{background:#451a03!important;color:#fde68a!important;border-color:#92400e!important}body.ptf-dark .ptf-theme-bg-danger{background:#451a1a!important;color:#fecaca!important;border-color:#991b1b!important}' +
    'body.ptf-dark .ptf-theme-bg-purple{background:#2e1065!important;color:#e9d5ff!important;border-color:#6d28d9!important}body.ptf-dark .ptf-theme-bg-pink{background:#500724!important;color:#fbcfe8!important;border-color:#9d174d!important}' +
    'body.ptf-dark .ptf-theme-action-info{background:#075985!important;color:#fff!important}body.ptf-dark .ptf-theme-action-success{background:#047857!important;color:#fff!important}body.ptf-dark .ptf-theme-action-warning{background:#92400e!important;color:#fff!important}body.ptf-dark .ptf-theme-action-danger{background:#b91c1c!important;color:#fff!important}body.ptf-dark .ptf-theme-action-purple{background:#5b21b6!important;color:#fff!important}' +
    'body.ptf-dark .ptf-theme-text-primary{color:var(--ptf-text)!important}body.ptf-dark .ptf-theme-text-muted{color:var(--ptf-text-muted)!important}body.ptf-dark .ptf-theme-text-subtle{color:var(--ptf-text-subtle)!important}body.ptf-dark .ptf-theme-text-info{color:#bae6fd!important}body.ptf-dark .ptf-theme-text-success{color:#a7f3d0!important}body.ptf-dark .ptf-theme-text-warning{color:#fde68a!important}body.ptf-dark .ptf-theme-text-danger{color:#fecaca!important}body.ptf-dark .ptf-theme-text-purple{color:#ddd6fe!important}body.ptf-dark .ptf-theme-text-pink{color:#fbcfe8!important}' +
    'body.ptf-dark .ptf-theme-border{border-color:var(--ptf-border)!important}' +
    'body.ptf-dark .ptf-theme-bg-info.ptf-theme-border{border-color:#155e75!important}body.ptf-dark .ptf-theme-bg-success.ptf-theme-border{border-color:#047857!important}body.ptf-dark .ptf-theme-bg-warning.ptf-theme-border{border-color:#92400e!important}body.ptf-dark .ptf-theme-bg-danger.ptf-theme-border{border-color:#991b1b!important}body.ptf-dark .ptf-theme-bg-purple.ptf-theme-border{border-color:#6d28d9!important}body.ptf-dark .ptf-theme-bg-pink.ptf-theme-border{border-color:#9d174d!important}' +
    /* v31.9: هاب مالی با آیکون خطی semantic و بدون badge عددی */
    '.fin-hub-bar{background:var(--crd,#fff);color:var(--tx,#0f172a);border:1px solid var(--brd,#e2e8f0);border-radius:16px;padding:10px 12px;margin-bottom:12px;box-shadow:0 8px 24px rgba(15,23,42,.08)}' +
    '.fin-hub-layout{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.fin-hub-heading small{color:#64748b}.fin-hub-title{display:inline-flex;align-items:center;gap:7px;font-size:14px;color:#0f172a}.fin-hub-tabs{display:flex;gap:6px;flex-wrap:wrap}' +
    '.fin-hub-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;border-radius:999px;padding:8px 12px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;background:#f1f5f9;color:#475569}.fin-hub-tab.active{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;box-shadow:0 8px 18px rgba(239,75,26,.22)}' +
    '.fin-hub-icon{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 20px}.fin-hub-icon svg{width:18px;height:18px;display:block}' +
    'body.ptf-dark .fin-hub-bar{background:#162235!important;color:#f8fafc!important;border-color:#40526b!important}body.ptf-dark .fin-hub-title{color:#f8fafc!important}body.ptf-dark .fin-hub-heading small{color:#d5dfed!important}body.ptf-dark .fin-hub-tab{background:#1d2a3d!important;color:#d5dfed!important;border-color:#40526b!important}body.ptf-dark .fin-hub-tab.active{background:linear-gradient(135deg,#c2410c,#b45309)!important;color:#fff!important;border-color:#d97706!important}' +
    /* v31.9: خوانایی قطعی سال مالی در حالت شب؛ رفع transparent text کارت‌های .sc */
    '.ptf-fiscal-title{display:inline-flex;align-items:center;gap:7px}.ptf-fiscal-icon{display:inline-grid;place-items:center;width:24px;height:24px;flex:0 0 24px;border-radius:8px;background:rgba(239,75,26,.12);color:#c2410c}.ptf-fiscal-icon svg{width:17px;height:17px;display:block}.ptf-fiscal-kpi b{max-width:100%;overflow-wrap:break-word;word-break:normal}' +
    'body.ptf-dark #fiscalBox.ptf-fiscal-shell{background:#101b2b!important;color:#f8fafc!important;border-color:#40526b!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-title{color:#f8fafc!important}body.ptf-dark #fiscalBox .ptf-fiscal-icon{background:#2b1d19!important;color:#fdba74!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-kpi{background:#1d2a3d!important;color:#f8fafc!important;border-color:#40526b!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-kpi b{background:none!important;background-image:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-kpi span{color:#d5dfed!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-alert-danger{background:#451a1a!important;color:#fecaca!important;border-color:#991b1b!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-alert-success{background:#064e3b!important;color:#d1fae5!important;border-color:#047857!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-alert-lock{background:#2e1065!important;color:#e9d5ff!important;border-color:#6d28d9!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-alert-warning{background:#451a03!important;color:#fde68a!important;border-color:#92400e!important}' +
    'body.ptf-dark #fiscalBox .ptf-fiscal-alert span,body.ptf-dark #fiscalBox .ptf-fiscal-alert b{color:inherit!important}body.ptf-dark #fiscalBox .ptf-fiscal-alert small{color:inherit!important;opacity:.88}' +
    'body.ptf-dark #fiscalBox input{background:#1d2a3d!important;color:#f8fafc!important;border-color:#52657e!important}body.ptf-dark #fiscalBox table{background:#162235!important;color:#f8fafc!important}body.ptf-dark #fiscalBox th{background:#1d2a3d!important;color:#d5dfed!important}body.ptf-dark #fiscalBox td{color:#f8fafc!important;border-color:#40526b!important}';
  document.head.appendChild(style);

  var backgroundClass = {
    'fff': 'ptf-theme-surface', 'ffffff': 'ptf-theme-surface',
    'f8fafc': 'ptf-theme-surface-soft', 'f1f5f9': 'ptf-theme-surface-soft',
    'f4f6f9': 'ptf-theme-surface-soft', 'fafbfc': 'ptf-theme-surface-soft', 'eef1f5': 'ptf-theme-surface-soft', 'e2e8f0': 'ptf-theme-surface-soft', 'e8ebf0': 'ptf-theme-surface-soft',
    'fcfcfc': 'ptf-theme-surface-soft', 'f6f7f9': 'ptf-theme-surface-soft', 'fffcfa': 'ptf-theme-surface-soft', 'fcfaff': 'ptf-theme-surface-soft', 'fffef0': 'ptf-theme-surface-soft', 'fffdf9': 'ptf-theme-surface-soft', 'faf8f4': 'ptf-theme-surface-soft',
    'eff6ff': 'ptf-theme-bg-info', 'e0f2fe': 'ptf-theme-bg-info', 'f0f9ff': 'ptf-theme-bg-info', 'dbeafe': 'ptf-theme-bg-info', 'cffafe': 'ptf-theme-bg-info',
    'eef2ff': 'ptf-theme-bg-purple',
    'ecfdf5': 'ptf-theme-bg-success', 'f0fdf4': 'ptf-theme-bg-success', 'f0fdfa': 'ptf-theme-bg-success', 'd1fae5': 'ptf-theme-bg-success', 'bbf7d0': 'ptf-theme-bg-success', 'a7f3d0': 'ptf-theme-bg-success', '86efac': 'ptf-theme-bg-success',
    'fff7ed': 'ptf-theme-bg-warning', 'fff8f5': 'ptf-theme-bg-warning', 'fff8f1': 'ptf-theme-bg-warning', 'fff8f0': 'ptf-theme-bg-warning', 'fffbeb': 'ptf-theme-bg-warning', 'fef3c7': 'ptf-theme-bg-warning', 'fef9c3': 'ptf-theme-bg-warning', 'fefce8': 'ptf-theme-bg-warning', 'fdf1e7': 'ptf-theme-bg-warning', 'fdf3e3': 'ptf-theme-bg-warning', 'fde68a': 'ptf-theme-bg-warning', 'fed7aa': 'ptf-theme-bg-warning',
    'fef2f2': 'ptf-theme-bg-danger', 'fee2e2': 'ptf-theme-bg-danger', 'fff5f5': 'ptf-theme-bg-danger', 'fecaca': 'ptf-theme-bg-danger', 'fca5a5': 'ptf-theme-bg-danger',
    'ede9fe': 'ptf-theme-bg-purple', 'f3e8ff': 'ptf-theme-bg-purple', 'e0e7ff': 'ptf-theme-bg-purple', 'f5f3ff': 'ptf-theme-bg-purple', 'faf5ff': 'ptf-theme-bg-purple', 'fdf4ff': 'ptf-theme-bg-purple',
    'fce7f3': 'ptf-theme-bg-pink', 'fbcfe8': 'ptf-theme-bg-pink',
    '059669': 'ptf-theme-action-success', '10b981': 'ptf-theme-action-success', '047857': 'ptf-theme-action-success',
    'dc2626': 'ptf-theme-action-danger', 'ef4444': 'ptf-theme-action-danger', 'b91c1c': 'ptf-theme-action-danger',
    '0e7490': 'ptf-theme-action-info', '0f766e': 'ptf-theme-action-info', '0369a1': 'ptf-theme-action-info', '1d4ed8': 'ptf-theme-action-info', '2563eb': 'ptf-theme-action-info', '3b82f6': 'ptf-theme-action-info',
    'd97706': 'ptf-theme-action-warning', 'f59e0b': 'ptf-theme-action-warning', 'b45309': 'ptf-theme-action-warning', 'c2410c': 'ptf-theme-action-warning', 'f79400': 'ptf-theme-action-warning', 'ef4b1a': 'ptf-theme-action-warning',
    '7c3aed': 'ptf-theme-action-purple', '8b5cf6': 'ptf-theme-action-purple'
  };
  var textClass = {
    '0f172a': 'ptf-theme-text-primary', '1e293b': 'ptf-theme-text-primary', '334155': 'ptf-theme-text-primary', '17191c': 'ptf-theme-text-primary', '26282c': 'ptf-theme-text-primary', '1f2328': 'ptf-theme-text-primary', '1a1c1f': 'ptf-theme-text-primary', '111111': 'ptf-theme-text-primary', '000000': 'ptf-theme-text-primary', '333333': 'ptf-theme-text-primary', '2c3136': 'ptf-theme-text-primary', '23262b': 'ptf-theme-text-primary', '2b2e33': 'ptf-theme-text-primary',
    '475569': 'ptf-theme-text-muted', '64748b': 'ptf-theme-text-muted', '94a3b8': 'ptf-theme-text-subtle', 'cbd5e1': 'ptf-theme-text-muted', 'e2e8f0': 'ptf-theme-text-muted', '4b5057': 'ptf-theme-text-muted', '555': 'ptf-theme-text-muted', '555555': 'ptf-theme-text-muted', '444444': 'ptf-theme-text-muted', '666666': 'ptf-theme-text-muted', '999': 'ptf-theme-text-subtle', '888888': 'ptf-theme-text-subtle', '9aa0a6': 'ptf-theme-text-subtle', '8a8f96': 'ptf-theme-text-subtle', 'cbd0d6': 'ptf-theme-text-subtle', '4a4e54': 'ptf-theme-text-subtle', '5a5e64': 'ptf-theme-text-subtle', '777777': 'ptf-theme-text-subtle',
    '0e7490': 'ptf-theme-text-info', '0c4a6e': 'ptf-theme-text-info', '0369a1': 'ptf-theme-text-info', '1d4ed8': 'ptf-theme-text-info', '1e40af': 'ptf-theme-text-info', '2563eb': 'ptf-theme-text-info', '3b82f6': 'ptf-theme-text-info', '0f766e': 'ptf-theme-text-info', '0d9488': 'ptf-theme-text-info', '155e75': 'ptf-theme-text-info',
    '059669': 'ptf-theme-text-success', '047857': 'ptf-theme-text-success', '065f46': 'ptf-theme-text-success', '166534': 'ptf-theme-text-success', '10b981': 'ptf-theme-text-success', '4d7c0f': 'ptf-theme-text-success',
    'd97706': 'ptf-theme-text-warning', 'b45309': 'ptf-theme-text-warning', '92400e': 'ptf-theme-text-warning', '9a3412': 'ptf-theme-text-warning', 'c2410c': 'ptf-theme-text-warning', 'ef4b1a': 'ptf-theme-text-warning', 'f79400': 'ptf-theme-text-warning', 'e87200': 'ptf-theme-text-warning', 'a06000': 'ptf-theme-text-warning', 'b8860b': 'ptf-theme-text-warning', '854d0e': 'ptf-theme-text-warning', 'a16207': 'ptf-theme-text-warning',
    'dc2626': 'ptf-theme-text-danger', 'b91c1c': 'ptf-theme-text-danger', 'c0392b': 'ptf-theme-text-danger', 'ef4444': 'ptf-theme-text-danger', 'f87171': 'ptf-theme-text-danger', '991b1b': 'ptf-theme-text-danger', '7f1d1d': 'ptf-theme-text-danger',
    '7c3aed': 'ptf-theme-text-purple', '6d28d9': 'ptf-theme-text-purple', '5b21b6': 'ptf-theme-text-purple', '4338ca': 'ptf-theme-text-purple', '3730a3': 'ptf-theme-text-purple',
    'be185d': 'ptf-theme-text-pink', '9d174d': 'ptf-theme-text-pink', 'a21caf': 'ptf-theme-text-pink'
  };

  function hexFrom(value) {
    var m = String(value || '').match(/#([0-9a-f]{3,8})\b/i);
    if (!m) return '';
    var hex = m[1].toLowerCase();
    if (hex.length === 3) hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    return hex;
  }

  function inlineValue(raw, property) {
    var re = new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+)', 'i');
    var match = String(raw || '').match(re);
    return match ? match[1] : '';
  }

  function add(el, className) {
    if (className && !el.classList.contains(className)) el.classList.add(className);
  }

  function classify(el) {
    if (!el || el.nodeType !== 1 || el.tagName === 'IFRAME') return;
    var raw = el.getAttribute('style') || '';
    if (!raw) return;

    var bg = hexFrom(inlineValue(raw, 'background')) || hexFrom(inlineValue(raw, 'background-color'));
    var fg = hexFrom(inlineValue(raw, 'color'));
    var border = hexFrom(inlineValue(raw, 'border')) || hexFrom(inlineValue(raw, 'border-color')) || hexFrom(inlineValue(raw, 'border-top')) || hexFrom(inlineValue(raw, 'border-bottom'));

    add(el, backgroundClass[bg]);
    add(el, textClass[fg]);
    if (border) add(el, 'ptf-theme-border');
  }

  function classifyTree(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) classify(root);
    var nodes = root.querySelectorAll ? root.querySelectorAll('[style]') : [];
    for (var i = 0; i < nodes.length; i++) classify(nodes[i]);
  }

  function rgb(value) {
    var m = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function luminance(c) {
    var a = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function visible(el) {
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity !== 0;
  }
  function backgroundOf(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var c = rgb(window.getComputedStyle(n).backgroundColor);
      if (c) return c;
      n = n.parentElement;
    }
    return [11, 18, 32];
  }

  /* ابزار تشخیصی بدون side effect برای QA در مرورگر: ptfThemeContrastAudit() */
  window.ptfThemeContrastAudit = function () {
    if (!document.body || !document.body.classList.contains('ptf-dark')) return { ok: true, skipped: true, issues: [] };
    var nodes = document.body.querySelectorAll('p,span,small,label,td,th,li,button,a,h1,h2,h3,h4,h5,h6,div');
    var issues = [];
    for (var i = 0; i < nodes.length && issues.length < 80; i++) {
      var el = nodes[i];
      if (!visible(el) || !String(el.textContent || '').trim() || el.children.length && el.textContent.trim() === Array.prototype.map.call(el.children, function (x) { return x.textContent; }).join('').trim()) continue;
      var fg = rgb(window.getComputedStyle(el).color), bg = backgroundOf(el);
      if (fg && bg) {
        var ratio = contrast(fg, bg);
        if (ratio < 4.5) issues.push({ tag: el.tagName.toLowerCase(), text: String(el.textContent).trim().slice(0, 70), contrast: Math.round(ratio * 100) / 100 });
      }
    }
    return { ok: issues.length === 0, issues: issues };
  };

  function start() {
    classifyTree(document);
    if (!document.body || !window.MutationObserver) return;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'attributes') classify(record.target);
        else for (var i = 0; i < record.addedNodes.length; i++) classifyTree(record.addedNodes[i]);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
