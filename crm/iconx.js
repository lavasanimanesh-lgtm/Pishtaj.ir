/* =====================================================================
   PTF CRM — iconx.js — v122.4 — US-284
   موتور سراسری جایگزینی ایموجی‌ها با آیکون‌های خطی مینیمال (SVG)
   - استروک یکنواخت 1.7 و رنگ از currentColor → هماهنگ کامل با حالت شب
   - جایگزینی فقط در زمان اجرا روی گره‌های متنی (TextNode) — سورس ماژول‌ها
     دست نمی‌خورد و هندلرهای رویداد (onclick/property) سالم می‌مانند
   - داخل <option> ایموجی فقط حذف می‌شود (SVG در option رندر نمی‌شود)
   - الگو: MutationObserver + rAF debounce — بدون polling (TECHDEBT-004)
   ===================================================================== */
(function () {
  'use strict';

  function svg(paths, opt) {
    opt = opt || {};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (opt.c || 'currentColor') +
      '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' +
      'style="width:1.06em;height:1.06em;display:inline-block;vertical-align:-0.16em">' + paths + '</svg>';
  }
  function dot(color) {
    return '<svg viewBox="0 0 24 24" style="width:0.9em;height:0.9em;display:inline-block;vertical-align:-0.1em"><circle cx="12" cy="12" r="6.5" fill="' + color + '"/></svg>';
  }

  /* ---------- نگاشت ایموجی → آیکون خطی ---------- */
  var P = {
    trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
    pencil: '<path d="M4.5 19.5l1-4L16.6 4.4a2 2 0 013 3L8.5 18.5l-4 1z"/><path d="M13.8 6.2l3 3"/>',
    eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    up: '<path d="M4 17v3h16v-3M12 14V4M8 8l4-4 4 4"/>',
    down: '<path d="M4 17v3h16v-3M12 4v10M8 10l4 4 4-4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    trendup: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    briefcase: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
    folder: '<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9 3.5 5.5 6M15 3.5 18.5 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5L16 16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 012-2h2a2 2 0 012 2M9 10h6M9 14h6"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
    paperclip: '<path d="M8.5 12.5l7-7a3 3 0 114.2 4.2l-8.5 8.5a5 5 0 11-7-7l7.5-7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.7-1.5"/>',
    receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9.5 8h5M9.5 12h5"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    printer: '<path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M7 14h10v6H7z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 5H5a3 3 0 003 4M16 5h3a3 3 0 01-3 4M12 13v3M8 20h8M10 16h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.15-1.4l2.05-1.6-2-3.45-2.4 1a7 7 0 00-2.4-1.4L13.7 2.6h-3.4l-.4 2.55a7 7 0 00-2.4 1.4l-2.4-1-2 3.45 2.05 1.6A7 7 0 005 12c0 .5.05.95.15 1.4L3.1 15l2 3.45 2.4-1a7 7 0 002.4 1.4l.4 2.55h3.4l.4-2.55a7 7 0 002.4-1.4l2.4 1 2-3.45-2.05-1.6c.1-.45.15-.9.15-1.4z"/>',
    sliders: '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1.9" fill="var(--crd,#fff)"/><circle cx="15" cy="12" r="1.9" fill="var(--crd,#fff)"/><circle cx="8" cy="18" r="1.9" fill="var(--crd,#fff)"/>',
    wrench: '<path d="M20.3 6.3a5 5 0 01-6.6 6.6L7 19.6a2 2 0 01-2.8-2.8l6.7-6.7a5 5 0 016.6-6.6l-3.2 3.2 2.8 2.8z"/>',
    factory: '<path d="M3 21V8l6 4V8l6 4V8l6 4v9z"/><path d="M7 21v-4h4v4M15 21v-3h3v3"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20v-1.3A4.7 4.7 0 018.2 14h1.6a4.7 4.7 0 014.7 4.7V20"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16 14.2a4.2 4.2 0 014.5 4.2V20"/>',
    user: '<path d="M7 21v-2a4 4 0 014-4h2a4 4 0 014 4v2"/><circle cx="12" cy="8.5" r="3.5"/>',
    send: '<path d="M21 3L3 10.5l6 2.5L12 21l3-6.5z"/><path d="M9 13l12-10"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.5l2.5 12h9.5l2.5-8H7"/>',
    cloud: '<path d="M6.5 18.5a4 4 0 01-.6-7.96A6 6 0 0117.6 9.1a4.5 4.5 0 01-.6 8.9z"/>',
    mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17.5h2"/>',
    refresh: '<path d="M4 12a8 8 0 0114-5.2M20 12a8 8 0 01-14 5.2"/><path d="M18 2.8v4h-4M6 21.2v-4h4"/>',
    disk: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17-2.5-2.5-2.5-14.5 0-17z"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0012 3z"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H4l2.2-3A8 8 0 1121 12z"/>',
    book: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/>',
    phone: '<path d="M5 4h4l1.5 4.5L8 10a12 12 0 006 6l1.5-2.5L20 15v4a1.5 1.5 0 01-1.7 1.5C10 19.5 4.5 14 3.5 5.7A1.5 1.5 0 015 4z"/>',
    bolt: '<path d="M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12z"/>',
    flask: '<path d="M9.5 3h5M10.5 3v6L5 19a1.8 1.8 0 001.6 2.7h10.8A1.8 1.8 0 0019 19L13.5 9V3"/><path d="M8 15h8"/>',
    pin: '<path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 0113 0c0 4.8-6.5 10-6.5 10z"/><circle cx="12" cy="11" r="2.3"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 3 3 4-4 4 4"/>',
    broom: '<path d="M14 3l-4 8.5M4 21c4.5 0 7.5-1.2 9-4.8L9.5 13C6 14.5 4.5 17.5 4 21z"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8.5 15.5l1.5 1.5M11.5 12.5l1.5 1.5M14.5 9.5l1.5 1.5"/>',
    link: '<path d="M10 14a5 5 0 007.1 0l2-2A5 5 0 0012 5l-1 1"/><path d="M14 10a5 5 0 00-7.1 0l-2 2A5 5 0 0012 19l1-1"/>',
    exchange: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    building: '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10.5 21v-3h3v3"/>',
    truck: '<path d="M2 7h11v9H2z"/><path d="M13 10h4l3 3v3h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="16.5" cy="18" r="1.8"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    bell: '<path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2.2 2.2 0 004 0"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4M9 4h6"/><path d="M9.5 13h.01M14.5 13h.01"/><path d="M9.5 16.5h5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
    inbox: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    rewind: '<path d="M11 6l-7 6 7 6zM20 6l-7 6 7 6z"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 4l3 3M14 6l2 2"/>',
    gem: '<path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9.5 8L12 21 14.5 8"/>',
    sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h6M9 15h6M12 11v8"/>',
    megaphone: '<path d="M18 4v16l-9-4H4a1 1 0 01-1-1V9a1 1 0 011-1h5z"/><path d="M21 10v4"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    handshake: '<path d="M8 12l3.5 3.5a1.7 1.7 0 002.4-2.4L10.5 9.7a3 3 0 00-4.2 0L3 13"/><path d="M16 12l5-5M12.5 8.5L16 5l5 5-3.5 3.5"/><path d="M3 13l5 5 2 2"/>',
    store: '<path d="M4 10v10h16V10"/><path d="M3 6h18l-1.5 4a2.2 2.2 0 01-4.2 0 2.2 2.2 0 01-4.6 0 2.2 2.2 0 01-4.6 0A2.2 2.2 0 012 10z"/><path d="M9 20v-6h6v6"/>' /* v31.7.19: موجودی انبار */
  };

  var MAP = {
    '🗑': svg(P.trash), '✏': svg(P.pencil), '✎': svg(P.pencil), '🖊': svg(P.pencil), '🖋': svg(P.pencil), '✍': svg(P.pencil),
    '👁': svg(P.eye), '📤': svg(P.up), '⬆': svg(P.up), '📥': svg(P.down), '⬇': svg(P.down),
    '📊': svg(P.chart), '📈': svg(P.trendup), '💼': svg(P.briefcase), '🧰': svg(P.briefcase),
    '📁': svg(P.folder), '📂': svg(P.folder), '🗂': svg(P.folder),
    '🕓': svg(P.clock), '⏱': svg(P.clock), '⏰': svg(P.alarm), '🔍': svg(P.search), '🔎': svg(P.search), '➕': svg(P.plus),
    '📦': svg(P.box), '📋': svg(P.clipboard), '📄': svg(P.doc), '📃': svg(P.doc), '📑': svg(P.doc), '📜': svg(P.doc), '📝': svg(P.doc),
    '📎': svg(P.paperclip), '🔒': svg(P.lock), '🔐': svg(P.lock), '🔓': svg(P.unlock), '🔑': svg(P.key),
    '🧾': svg(P.receipt), '💰': svg(P.money), '💵': svg(P.money), '💸': svg(P.money), '💳': svg(P.card),
    '🖨': svg(P.printer), '🎯': svg(P.target), '🏆': svg(P.trophy),
    '⚙': svg(P.gear), '🎛': svg(P.sliders), '🔧': svg(P.wrench), '🛠': svg(P.wrench),
    '🏭': svg(P.factory), '🤝': svg(P.handshake), '👥': svg(P.users), '👤': svg(P.user),
    '🚀': svg(P.send), '🛒': svg(P.cart), '☁': svg(P.cloud), '📱': svg(P.mobile), '🔄': svg(P.refresh), '💾': svg(P.disk),
    '📨': svg(P.mail), '✉': svg(P.mail), '📧': svg(P.mail), '📬': svg(P.inbox), '🌐': svg(P.globe), '💡': svg(P.bulb),
    '💬': svg(P.chat), '📖': svg(P.book), '📚': svg(P.book), '☎': svg(P.phone), '📞': svg(P.phone), '⚡': svg(P.bolt),
    '🧪': svg(P.flask), '📌': svg(P.pin), '🖼': svg(P.image), '🧹': svg(P.broom), '📐': svg(P.ruler), '🔗': svg(P.link),
    '💱': svg(P.exchange), '🏢': svg(P.building), '🏦': svg(P.building), '🏬': svg(P.store), '🧱': svg(P.store), '🚚': svg(P.truck), '⭐': svg(P.star), '🌟': svg(P.star),
    '🔔': svg(P.bell), '🤖': svg(P.robot), '🗄': svg(P.archive), '⏪': svg(P.rewind), '📅': svg(P.calendar), '🗓': svg(P.calendar),
    '💎': svg(P.gem), '📗': svg(P.sheet), '📣': svg(P.megaphone), '📢': svg(P.megaphone), 'ℹ': svg(P.info),
    /* وضعیت‌ها — رنگ ثابت معنادار (در حالت شب هم خوانا) */
    '✅': svg('<path d="M4 12.5l5 5L20 6.5"/>', { c: '#22c55e' }),
    '✔': svg('<path d="M4 12.5l5 5L20 6.5"/>', { c: '#22c55e' }),
    '❌': svg('<path d="M6 6l12 12M18 6L6 18"/>', { c: '#ef4444' }),
    '⚠': svg('<path d="M12 3.5L2.5 20h19z"/><path d="M12 9.5v5M12 17.5h.01"/>', { c: '#f59e0b' }),
    '⛔': svg('<circle cx="12" cy="12" r="8.5"/><path d="M6.5 12h11"/>', { c: '#ef4444' }),
    '🚫': svg('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>', { c: '#ef4444' }),
    '🟢': dot('#22c55e'), '🟡': dot('#eab308'), '🔴': dot('#ef4444'), '🔵': dot('#3b82f6'), '🟠': dot('#f97316'), '🟣': dot('#a855f7'), '⚪': dot('#cbd5e1'), '⚫': dot('#475569')
  };

  /* ---------- regex واحد از همه کلیدها (+ Variation Selector اختیاری) ---------- */
  var KEYS = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('(' + KEYS.map(function (k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|') + ')\\uFE0F?', 'g');

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, PRE: 1, CODE: 1, NOSCRIPT: 1 };

  function processTextNode(tn) {
    var t = tn.nodeValue;
    if (!t || !RX.test(t)) { RX.lastIndex = 0; return; }
    RX.lastIndex = 0;
    var parent = tn.parentNode;
    if (!parent) return;
    /* داخل option/select: فقط حذف ایموجی (SVG رندر نمی‌شود) */
    var el = parent.nodeType === 1 ? parent : null;
    if (el && (el.tagName === 'OPTION' || el.tagName === 'SELECT')) {
      tn.nodeValue = t.replace(RX, '').replace(/^\s+/, '');
      RX.lastIndex = 0;
      return;
    }
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = RX.exec(t)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      var span = document.createElement('span');
      span.setAttribute('data-ix', '1');
      span.style.cssText = 'display:inline-flex;align-items:center';
      span.innerHTML = MAP[m[1]];
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    parent.replaceChild(frag, tn);
    RX.lastIndex = 0;
  }

  function sweep(root) {
    if (!root) return;
    if (root.nodeType === 3) { processTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) {
      if (SKIP[root.tagName]) return;
      if (root.closest && root.closest('[data-noix]')) return;
    }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
        if (p.nodeType === 1 && p.getAttribute && p.getAttribute('data-ix')) return NodeFilter.FILTER_REJECT;
        if (p.closest && (p.closest('svg') || p.closest('[data-noix]'))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(processTextNode);
  }

  /* ---------- پایش: MutationObserver + debounce با rAF ---------- */
  var pending = [];
  var scheduled = false;
  function flush() {
    scheduled = false;
    var batch = pending;
    pending = [];
    mo.disconnect(); // جلوگیری از حلقه بازخورد حین جایگزینی
    try {
      batch.forEach(function (n) { sweep(n); });
    } finally {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var mu = muts[i];
      if (mu.type === 'characterData') { pending.push(mu.target); continue; }
      for (var j = 0; j < mu.addedNodes.length; j++) pending.push(mu.addedNodes[j]);
    }
    if (pending.length && !scheduled) {
      scheduled = true;
      (window.requestAnimationFrame || setTimeout)(flush);
    }
  });

  window.ptfIconxSweep = function (root) { sweep(root || document.body); };

  function boot() {
    if (window._ptfIconxBooted || !document.body) return;
    window._ptfIconxBooted = true;
    sweep(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  /* بیمه دولایه: برخی محیط‌ها DOMContentLoaded را قبل از eval این فایل زده‌اند ولی readyState هنوز loading گزارش می‌شود */
  window.addEventListener('load', boot);
})();
