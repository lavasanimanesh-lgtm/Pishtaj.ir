/* =====================================================================
   PTF CRM — settings-accordion.js — v31.9 (MINIMAL-LINE-ICONS-DARK-FISCAL-001)
   Converts the long Settings page into minimal accordion rows after all modules
   have appended their settings sections.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfSettingsAccordionLoaded) return;
  window.__ptfSettingsAccordionLoaded = true;

  function cleanText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function cleanTitle(s) { return cleanText(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function findTitle(el) {
    if (!el) return 'بخش تنظیمات';
    var q = el.querySelector && el.querySelector('h3,h4,b,legend');
    var t = q ? cleanText(q.textContent) : '';
    if (!t && el.id) {
      var map = {
        ptfToolFeedback: 'کارتابل feedback ابزارها',
        ptfToolFunnelKpi: 'داشبورد KPI ابزارها',
        ptfToolReportDrafts: 'کارتابل draft گزارش ابزارها',
        ptfToolLicenses: 'مدیریت لایسنس ابزارها'
      };
      t = map[el.id] || el.id;
    }
    if (!t) t = cleanText(el.textContent).slice(0, 44);
    return cleanTitle(t) || 'بخش تنظیمات';
  }
  function lineIcon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  /* v31.9: explicit semantic families; fallback is deterministic and never
     repeats a family inside the same Settings accordion. */
  var ICONS = {
    cloud:'<path d="M6 18h11a4 4 0 00.5-7.97A6 6 0 006.2 9.2 4.4 4.4 0 006 18z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
    bot:'<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4M9 4h6M9.5 13h.01M14.5 13h.01M9 16h6"/>',
    shield:'<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-5"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5.5 21v-2a6.5 6.5 0 0113 0v2"/>',
    bell:'<path d="M18 9a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 4l3 3M14 6l2 2"/>',
    sync:'<path d="M4 12a8 8 0 0114-5M18 3v4h-4M20 12a8 8 0 01-14 5M6 21v-4h4"/>',
    palette:'<path d="M12 3a9 9 0 100 18h1a2 2 0 000-4h-1a2 2 0 010-4h2a7 7 0 000-10z"/><circle cx="7.5" cy="11" r=".7"/><circle cx="10" cy="7.5" r=".7"/><circle cx="14" cy="7" r=".7"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    building:'<path d="M4 21h16M6 21V5h12v16M9 9h1M14 9h1M9 13h1M14 13h1"/>',
    archive:'<path d="M4 7h16v13H4zM3 4h18v3H3z"/><path d="M10 12h4M12 9v6"/>',
    sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/>'
  };
  function iconFamily(title) {
    var t=String(title||'').toLowerCase();
    if (/آروان|ابری|فضای.*فایل/.test(t)) return 'cloud';
    if (/پشتیبان|بک.?آپ|بازیابی/.test(t)) return 'archive';
    if (/هوش|ai|ocr|دستیار/.test(t)) return 'bot';
    if (/رمز|امنیت|دسترسی|نقش/.test(t)) return 'shield';
    if (/کاربر|پروفایل|آواتار|امضا/.test(t)) return 'user';
    if (/پیامک|بات|تلگرام|اعلان/.test(t)) return 'bell';
    if (/لایسنس|فعال.?سازی|کلید/.test(t)) return 'key';
    if (/همگام|sync|داده|سلامت|کیفیت/.test(t)) return 'sync';
    if (/ظاهر|تم|رنگ/.test(t)) return 'palette';
    if (/گزارش|kpi|feedback|ابزار/.test(t)) return 'chart';
    if (/شرکت|سازمان/.test(t)) return 'building';
    return 'sliders';
  }
  function iconFor(title, used) {
    var family=iconFamily(title), all=Object.keys(ICONS);
    if (used && used[family]) family=all.filter(function(k){return !used[k];})[0] || family;
    if (used) used[family]=true;
    return lineIcon(ICONS[family]);
  }
  function apply() {
    var root = document.getElementById('ptfSettingsAccordionRoot');
    if (!root || root.getAttribute('data-ptf-acc') === '1') return;
    root.setAttribute('data-ptf-acc', '1');
    var children = Array.prototype.slice.call(root.children || []);
    if (!children.length) return;
    var header = children.shift();
    var wrap = document.createElement('div');
    wrap.className = 'ptf-set-acc-wrap';
    var style = document.createElement('style');
    style.textContent = '.ptf-settings-title-icon{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,rgba(239,75,26,.14),rgba(247,148,0,.14));color:#c2410c}.ptf-settings-title-icon svg{width:19px;height:19px;display:block}.ptf-set-acc-wrap{display:grid;gap:10px;max-width:1120px}.ptf-set-row{background:var(--crd,#fff);color:var(--tx,#0f172a);border:1px solid var(--brd,#e2e8f0);border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.10)}.ptf-set-row[open]{box-shadow:0 14px 34px rgba(15,23,42,.16)}.ptf-set-row>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:13px 15px;font-weight:900;color:var(--tx,#0f172a);background:linear-gradient(180deg,var(--crd,#fff),rgba(148,163,184,.10));border-bottom:1px solid transparent}.ptf-set-row[open]>summary{border-bottom-color:var(--brd,#e2e8f0)}.ptf-set-row>summary::-webkit-details-marker{display:none}.ptf-set-ico{display:inline-grid;place-items:center;min-width:32px;width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,rgba(239,75,26,.14),rgba(247,148,0,.14));color:#c2410c}.ptf-set-ico svg{width:19px;height:19px;display:block}.ptf-set-chev{margin-right:auto;color:var(--tx,#64748b);opacity:.72;font-size:13px}.ptf-set-body{padding:14px 15px;color:var(--tx,#0f172a)}.ptf-set-body .fld label,.ptf-set-body h3,.ptf-set-body h4,.ptf-set-body b{color:var(--tx,#0f172a)!important}.ptf-set-body small,.ptf-set-body p,.ptf-set-body span{color:var(--tx,#475569)}.ptf-set-body input,.ptf-set-body select,.ptf-set-body textarea{background:var(--crd,#fff)!important;color:var(--tx,#0f172a)!important;border-color:var(--brd,#cbd5e1)!important}.ptf-set-body [style*="background:#fff"],.ptf-set-body [style*="background:#f8fafc"]{background:var(--crd,#fff)!important}body.ptf-dark .ptf-set-ico,body.ptf-dark .ptf-settings-title-icon{background:#2b1d19;color:#fdba74}.ptf-set-acc-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;color:var(--tx,#64748b);font-size:12px}.ptf-set-acc-head b{color:var(--tx,#0f172a)}';
    root.insertBefore(style, root.firstChild);
    root.innerHTML = '';
    root.appendChild(style);
    if (header) root.appendChild(header);
    var head = document.createElement('div');
    head.className = 'ptf-set-acc-head';
    head.innerHTML = '<b>نمای فشرده تنظیمات:</b> هر ردیف را باز کنید تا امکانات همان بخش نمایش داده شود.';
    root.appendChild(head);
    root.appendChild(wrap);
    var idx = 0, usedIcons = {};
    children.forEach(function (ch) {
      if (!ch || (ch.nodeType === 1 && ch.matches && ch.matches('script,style'))) return;
      if (ch.nodeType === 1 && cleanText(ch.textContent).length < 2 && !(ch.children && ch.children.length)) return;
      var det = document.createElement('details');
      det.className = 'ptf-set-row';
      if (idx === 0) det.open = true;
      var title = findTitle(ch);
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="ptf-set-ico">' + iconFor(title, usedIcons) + '</span><span>' + esc(title) + '</span><span class="ptf-set-chev">باز/بستن</span>';
      var body = document.createElement('div');
      body.className = 'ptf-set-body';
      body.appendChild(ch);
      det.appendChild(sum);
      det.appendChild(body);
      wrap.appendChild(det);
      idx++;
    });
  }

  var old = window.buildSettings;
  if (typeof old === 'function') {
    window.buildSettings = function () {
      var html = old();
      setTimeout(apply, 80);
      return '<div id="ptfSettingsAccordionRoot">' + html + '</div>';
    };
  }
  window.ptfSettingsAccordionApply = apply;
})();
