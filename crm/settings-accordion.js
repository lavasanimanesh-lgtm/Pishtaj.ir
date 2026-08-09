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
  /* MOB-042: شناسه‌های داخلی User Story نباید در UI مشتری دیده شوند. */
  function stripUs(s) {
    return String(s || '')
      .replace(/\s*[\(\[（]?\s*US\s*[-–—]?\s*\d+(?:\s*[\/.]\s*\d+)*(?:\s*فاز\s*\d+)?\s*[\)\]）]?/gi, '')
      .replace(/\s{2,}/g, ' ').replace(/\s+([،؛,:.!])/g, '$1').trim();
  }
  function cleanTitle(s) { return stripUs(cleanText(s)).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function findTitle(el) {
    if (!el) return 'بخش تنظیمات';
    var declared = el.getAttribute && el.getAttribute('data-settings-title');
    if (declared) return cleanTitle(declared) || 'بخش تنظیمات';
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
  function describeTitle(title) {
    var t = String(title || '');
    if (/پروفایل|آواتار|هویت/.test(t)) return 'عکس، هویت و اطلاعات شخصی';
    if (/آروان|ابری|فضا|فایل/.test(t)) return 'اتصال، فایل‌ها و ظرفیت ذخیره‌سازی';
    if (/هوش|AI|OCR|دستیار/.test(t)) return 'مدل، اتصال و ابزارهای هوش مصنوعی';
    if (/پشتیبان|بک.?آپ|بازیابی/.test(t)) return 'خروجی امن، بازگردانی و سلامت داده';
    if (/امنیت|رمز|دسترسی/.test(t)) return 'دسترسی، رمز و کنترل امنیتی';
    if (/تم|حالت نمایش|ظاهر/.test(t)) return 'رنگ، کنتراست و حالت نمایش';
    if (/پیامک|بات|تلگرام|اعلان/.test(t)) return 'کانال‌های اطلاع‌رسانی سازمان';
    if (/لایسنس|گزارش|KPI|ابزار/.test(t)) return 'مدیریت ابزارها و گزارش‌های تخصصی';
    if (/پورسانت/.test(t)) return 'قواعد محاسبه و گزارش فروش';
    if (/ارتباط|نگهداری|ایمیل/.test(t)) return 'اطلاعات تماس و نسخهٔ پشتیبان';
    return 'تنظیمات و کنترل‌های این بخش';
  }
  function actionMeta(btn) {
    var raw = cleanTitle(btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || 'عملیات');
    if (!raw) raw = 'عملیات';
    var icon = /حذف|پاک/.test(raw) ? '🗑' : /پشتیبان|بک.?آپ/.test(raw) ? '📤' : /بازیابی|بازگرد/.test(raw) ? '↩' : /ذخیره/.test(raw) ? '✓' : /تور|راهنما/.test(raw) ? '🎓' : /امنیت|رمز/.test(raw) ? '🛡' : /تست|بررسی/.test(raw) ? '✓' : '⚙';
    return { label: raw, icon: icon };
  }
  function normalizeSettingsActions(root) {
    if (!root) return;
    root.querySelectorAll('.ptf-set-body button').forEach(function (btn) {
      if (btn.getAttribute('data-ptf-set-action') || btn.closest('.md,.ptfdlg')) return;
      var meta = actionMeta(btn);
      var hasVisual = !!btn.querySelector('svg,[data-ix]') || /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(btn.textContent || '');
      btn.setAttribute('data-ptf-set-action', '1');
      btn.classList.add('ptf-set-action');
      btn.setAttribute('title', btn.getAttribute('title') || meta.label);
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') || meta.label);
      /* text اصلی را به label محافظت‌شده منتقل می‌کنیم تا iconx/mobile CSS آن را
         به icon-only مبهم تبدیل نکند. */
      Array.prototype.slice.call(btn.childNodes || []).forEach(function (node) { if (node.nodeType === 3 && String(node.nodeValue || '').trim()) node.remove(); });
      if (!hasVisual) {
        var ic = document.createElement('span');
        ic.className = 'ptf-set-action-icon'; ic.setAttribute('aria-hidden', 'true'); ic.setAttribute('data-noix', '1'); ic.textContent = meta.icon;
        btn.insertBefore(ic, btn.firstChild);
      }
      if (!btn.querySelector('.ptf-set-action-label')) {
        var label = document.createElement('span');
        label.className = 'ptf-set-action-label'; label.setAttribute('data-noix', '1'); label.textContent = meta.label;
        btn.appendChild(label);
      }
    });
    root.querySelectorAll('.ptf-set-body div').forEach(function (box) {
      if (box.getAttribute('data-ptf-set-action-row')) return;
      var kids = Array.prototype.slice.call(box.children || []);
      var buttons = kids.filter(function (x) { return x.tagName === 'BUTTON' && x.classList.contains('ptf-set-action'); });
      if (buttons.length >= 2 && buttons.length === kids.length) box.setAttribute('data-ptf-set-action-row', '1');
    });
  }
  function scrubUsText(root) {
    if (!root || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var p = node.parentElement;
      if (!p || p.closest('script,style,textarea,option,[data-ptf-us-keep]')) return;
      var before = node.nodeValue, after = stripUs(before);
      if (after !== before) node.nodeValue = after;
    });
  }
  function apply() {
    var root = document.getElementById('ptfSettingsAccordionRoot');
    if (!root || root.getAttribute('data-ptf-acc') === '1') return;
    root.setAttribute('data-ptf-acc', '1');
    var raw = Array.prototype.slice.call(root.children || []);
    if (!raw.length) return;
    var header = raw.filter(function (n) { return n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-settings-header'); })[0] || raw.shift();
    var sections = [];
    raw.forEach(function (ch) {
      if (!ch || ch === header || (ch.nodeType === 1 && ch.matches && ch.matches('script,style'))) return;
      if (ch.nodeType === 1 && ch.classList && ch.classList.contains('ptf-settings-base')) {
        Array.prototype.slice.call(ch.children || []).forEach(function (part) { if (part && part.nodeType === 1) sections.push(part); });
        return;
      }
      if (ch.nodeType === 1 && cleanText(ch.textContent).length < 2 && !(ch.children && ch.children.length)) return;
      sections.push(ch);
    });
    if (!sections.length) return;

    var style = document.createElement('style');
    style.textContent =
      '#ptfSettingsAccordionRoot{width:100%;min-width:0;max-width:1120px}' +
      '.ptf-settings-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 12px;padding:16px 18px;border:1px solid #fed7aa;border-radius:20px;background:linear-gradient(135deg,#fff7ed,#fff 52%,#eff6ff);box-sizing:border-box}' +
      '.ptf-settings-head-copy{min-width:0;display:flex;align-items:flex-start;gap:11px}.ptf-settings-title-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:14px;background:#ea580c;color:#fff;box-shadow:0 7px 16px rgba(234,88,12,.2)}.ptf-settings-title-icon svg{width:22px;height:22px}.ptf-settings-head h3{margin:0;color:var(--tx,#0f172a);font-size:18px}.ptf-settings-head p{margin:3px 0 0;color:#64748b;font-size:12px;line-height:1.7}.ptf-settings-version{flex:0 0 auto;display:inline-flex;align-items:center;min-height:32px;padding:4px 10px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:900;box-sizing:border-box}' +
      '.ptf-set-acc-head{margin:0 0 9px;color:#64748b;font-size:12px;line-height:1.7}.ptf-set-acc-head b{color:var(--tx,#0f172a)}.ptf-set-quicknav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}.ptf-set-quicknav button{min-width:0;min-height:54px;padding:7px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff;color:#1e40af;font:inherit;font-size:10.5px;font-weight:900;line-height:1.3;cursor:pointer;text-align:center}.ptf-set-quicknav button:hover{background:#eff6ff}.ptf-set-quicknav span{display:block;font-size:17px;line-height:1;margin-bottom:3px}' +
      '.ptf-set-acc-wrap{display:grid;gap:10px;max-width:100%}.ptf-set-row{background:var(--crd,#fff);color:var(--tx,#0f172a);border:1px solid var(--brd,#e2e8f0);border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.06)}.ptf-set-row[open]{border-color:#bfdbfe;box-shadow:0 12px 28px rgba(15,23,42,.10)}.ptf-set-row>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(180deg,var(--crd,#fff),#f8fafc);color:var(--tx,#0f172a)}.ptf-set-row>summary::-webkit-details-marker{display:none}.ptf-set-ico{display:grid;place-items:center;min-width:36px;width:36px;height:36px;border-radius:12px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}.ptf-set-ico svg{width:20px;height:20px}.ptf-set-summary-copy{min-width:0;flex:1}.ptf-set-summary-copy b{display:block;font-size:13px;line-height:1.4}.ptf-set-summary-copy small{display:block;margin-top:2px;color:#64748b;font-size:10.5px;font-weight:700;line-height:1.45}.ptf-set-chev{flex:0 0 auto;color:#64748b;font-size:11px;font-weight:800}.ptf-set-row[open] .ptf-set-chev{color:#2563eb}.ptf-set-body{padding:14px;color:var(--tx,#0f172a);box-sizing:border-box}.ptf-set-body>.ptf-settings-section>h4{display:none}.ptf-set-body .ptf-settings-section{width:100%;min-width:0}.ptf-set-body .ptf-settings-section-note{margin:0 0 10px;color:#64748b;font-size:11px;line-height:1.7}.ptf-set-body .fld{margin-bottom:12px}.ptf-set-body .fld label{color:var(--tx,#0f172a);font-size:11px;font-weight:900}.ptf-set-body h3,.ptf-set-body h4,.ptf-set-body b{color:var(--tx,#0f172a)!important}.ptf-set-body p,.ptf-set-body small,.ptf-set-body span{max-width:100%;overflow-wrap:anywhere}.ptf-set-body input,.ptf-set-body select,.ptf-set-body textarea{background:var(--crd,#fff)!important;color:var(--tx,#0f172a)!important;border-color:var(--brd,#cbd5e1)!important}.ptf-set-body>div[style*="max-width"]{max-width:none!important;width:100%!important}.ptf-settings-contact-actions{display:flex;gap:8px;flex-wrap:wrap}.ptf-settings-contact-actions .bt{min-height:42px}.ptf-settings-save-action{background:#2563eb!important;border-color:#2563eb!important}.ptf-settings-backup-action{background:#059669!important;border-color:#059669!important}.ptf-set-body .ptf-set-action{min-height:42px;margin:0;padding:6px 9px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font:inherit;font-size:11px;font-weight:900;line-height:1.35;cursor:pointer}.ptf-set-action-icon{font-size:16px;line-height:1}.ptf-set-action-label{display:inline-block;min-width:0;white-space:normal;overflow-wrap:anywhere}.ptf-set-body [data-ptf-set-action-row="1"]{display:flex;align-items:stretch;gap:7px;flex-wrap:wrap}.ptf-set-body [data-ptf-set-action-row="1"] .ptf-set-action{flex:1 1 150px}.ptf-set-body .ptf-set-action:hover{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}' +
      'body.ptf-dark .ptf-settings-head{background:linear-gradient(135deg,#312018,#1f2937);border-color:#7c2d12}body.ptf-dark .ptf-settings-title-icon{background:#fb923c;color:#431407}body.ptf-dark .ptf-set-ico{background:#2b1d19;color:#fdba74;border-color:#7c2d12}body.ptf-dark .ptf-set-row>summary{background:linear-gradient(180deg,var(--crd,#111827),rgba(148,163,184,.08))}' +
      '@media(max-width:768px){.ptf-settings-head{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:13px;border-radius:18px}.ptf-settings-head-copy{gap:9px}.ptf-settings-title-icon{width:38px;height:38px;flex-basis:38px;border-radius:13px}.ptf-settings-head h3{font-size:16px}.ptf-settings-head p{font-size:10.5px;line-height:1.65}.ptf-settings-version{width:100%;justify-content:center;font-size:10px;text-align:center}.ptf-set-quicknav{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ptf-set-quicknav button{min-height:56px;font-size:10px}.ptf-set-row{border-radius:15px}.ptf-set-row>summary{padding:10px}.ptf-set-ico{min-width:34px;width:34px;height:34px;border-radius:11px}.ptf-set-summary-copy b{font-size:11.5px}.ptf-set-summary-copy small{font-size:9.5px}.ptf-set-chev{font-size:10px}.ptf-set-body{padding:11px}.ptf-set-body .fld input,.ptf-set-body .fld select,.ptf-set-body .fld textarea{width:100%;box-sizing:border-box}.ptf-settings-contact-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ptf-settings-contact-actions .bt{width:100%;min-width:0;margin:0;padding:7px 5px;font-size:10px;white-space:normal}.ptf-set-body [style*="display:flex"]{max-width:100%}.ptf-set-body [style*="min-width:160px"],.ptf-set-body [style*="min-width:180px"]{min-width:0!important;max-width:100%!important}.ptf-set-body .ptf-set-action{width:100%;min-width:0;min-height:50px;margin:0;padding:7px 6px;box-sizing:border-box;font-size:10px;white-space:normal;text-align:center}.ptf-set-body .ptf-set-action-label{display:inline-block!important;max-width:100%;white-space:normal!important;overflow-wrap:anywhere}.ptf-set-body [data-ptf-set-action-row="1"]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ptf-set-body [data-ptf-set-action-row="1"] .ptf-set-action{width:100%;min-width:0;max-width:none;flex:auto}}';

    root.innerHTML = '';
    root.appendChild(style);
    if (header) root.appendChild(header);
    var intro = document.createElement('div');
    intro.className = 'ptf-set-acc-head';
    intro.innerHTML = '<b>مدیریت مرحله‌ای تنظیمات:</b> بخش موردنظر را باز کنید؛ وضعیت و عملیات همان بخش در همان‌جا باقی می‌ماند.';
    root.appendChild(intro);

    var quick = document.createElement('div');
    quick.className = 'ptf-set-quicknav';
    var quickDefs = [
      { key:'پروفایل', icon:'👤', label:'پروفایل' },
      { key:'فضای ابری', icon:'☁️', label:'فایل‌ها' },
      { key:'هوش مصنوعی', icon:'🤖', label:'هوش مصنوعی' },
      { key:'ارتباطات', icon:'📨', label:'ارتباطات' }
    ];
    root.appendChild(quick);

    var wrap = document.createElement('div');
    wrap.className = 'ptf-set-acc-wrap';
    root.appendChild(wrap);
    var usedIcons = {}, detailsByTitle = [], idx = 0;
    sections.forEach(function (ch) {
      var title = findTitle(ch), desc = describeTitle(title);
      var det = document.createElement('details');
      det.className = 'ptf-set-row';
      det.id = 'ptfSetSection_' + idx;
      det.setAttribute('data-set-title', title);
      if (idx === 0) det.open = true;
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="ptf-set-ico">' + iconFor(title, usedIcons) + '</span><span class="ptf-set-summary-copy"><b>' + esc(title) + '</b><small>' + esc(desc) + '</small></span><span class="ptf-set-chev">باز کنید</span>';
      det.addEventListener('toggle', function () {
        var c = this.querySelector('.ptf-set-chev'); if (c) c.textContent = this.open ? 'بستن' : 'باز کنید';
        /* در موبایل، بازشدن هم‌زمان چند بخش بلند باعث گم‌شدن مقصد می‌شد؛ این یک accordion واقعی است. */
        if (this.open) detailsByTitle.forEach(function (item) { if (item.detail !== det) item.detail.open = false; });
      });
      var body = document.createElement('div');
      body.className = 'ptf-set-body';
      body.appendChild(ch);
      det.appendChild(sum);
      det.appendChild(body);
      wrap.appendChild(det);
      detailsByTitle.push({ title:title, detail:det });
      idx++;
    });
    quickDefs.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button'; b.innerHTML = '<span aria-hidden="true">' + q.icon + '</span>' + q.label;
      b.addEventListener('click', function () {
        var found = detailsByTitle.filter(function (x) { return x.title.indexOf(q.key) > -1; })[0];
        if (!found) return;
        found.detail.open = true;
        found.detail.scrollIntoView({ behavior:'smooth', block:'start' });
      });
      quick.appendChild(b);
    });
    normalizeSettingsActions(root);
    scrubUsText(root);
    /* محتوای بعضی hookها (وضعیت ابری/AI/backup) پس از رندر اولیه تزریق می‌شود. */
    var scrubScheduled = false;
    new MutationObserver(function () {
      if (scrubScheduled) return;
      scrubScheduled = true;
      (window.requestAnimationFrame || setTimeout)(function () {
        scrubScheduled = false;
        normalizeSettingsActions(root);
        scrubUsText(root);
      });
    }).observe(root, { childList: true, subtree: true });
  }

  var old = window.buildSettings;
  if (typeof old === 'function') {
    window.buildSettings = function () {
      var html = old();
      setTimeout(apply, 0);
      /* باگ ۳: جلوگیری از پرش و نمایش کادر خام؛ در همان فریم و بدون تأخیر ۸۰ میلی‌ثانیه تبدیل به آکاردئون شود */
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function () { apply(); });
      }
      return '<div id="ptfSettingsAccordionRoot">' + html + '</div>';
    };
  }
  window.ptfSettingsAccordionApply = apply;
})();
