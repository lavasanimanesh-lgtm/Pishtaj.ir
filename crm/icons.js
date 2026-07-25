/* =====================================================================
   PTF CRM — icons.js — Sprint 86 — US-192
   آیکون‌های مینیمال خطی (استروک یکنواخت 1.7) به‌جای ایموجی‌ها —
   سطح کلاس شرکت، هماهنگ با پوسته روشن. جایگزینی خودکار در سایدبار،
   سر دسته‌های منو و دکمه‌های نوار بالا. ایموجی‌های داخل پنل‌ها دست نمی‌خورند.
   ===================================================================== */
(function () {
  'use strict';

  function svg(paths, vb) {
    return '<svg viewBox="' + (vb || '0 0 24 24') + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:block">' + paths + '</svg>';
  }

  /* آیکون هر پنل — طراحی خطی مینیمال یکدست */
  var ICONS = {
    dash: svg('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
    cart: svg('<path d="M4 5h16v14H4z"/><path d="M4 9h16M9 13h6"/>'),
    rfq: svg('<path d="M8 3h8l1 3H7z"/><rect x="5" y="6" width="14" height="15" rx="2"/><path d="M9 11h6M9 15h4"/>'),
    sup: svg('<path d="M3 21V8l6 4V8l6 4V8l6 4v9z"/><path d="M7 21v-4h4v4M15 21v-3h3v3"/>'),
    rfqs: svg('<circle cx="12" cy="8" r="5"/><path d="M12 13v3M8 21h8M12 16c-2 0-4 2-4 5M12 16c2 0 4 2 4 5"/><path d="M10 7.5a2 2 0 012-1.5"/>'),
    cust: svg('<path d="M7 21v-2a4 4 0 014-4h2a4 4 0 014 4v2"/><circle cx="12" cy="8.5" r="3.5"/>'),
    leads: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
    rem: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9 3.5 5.5 6M15 3.5 18.5 6"/>'),
    prod: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
    off: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>'),
    orders: svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>'),
    fin: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
    deals: svg('<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/>'),
    prj: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11M4 14h5"/>'),
    let: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/>'),
    anl: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5L16 16M11 8v6M8 11h6"/>'),
    cnt: svg('<path d="M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M9.5 8h5M9.5 12h5M9.5 16h3"/>'),
    buyq: svg('<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.5l2.5 12h9.5l2.5-8H7"/>'),
    inv: svg('<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9.5 8h5M9.5 12h5"/>'),
    recv: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10a2.5 2 0 012.5-1.5c1.5 0 2.5.8 2.5 2s-1 1.7-2.5 2c-1.5.3-2.5 1-2.5 2s1 2 2.5 2a2.5 2 0 002.5-1.5"/>'),
    petty: svg('<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M17 7V5a1.5 1.5 0 00-1.8-1.4L4.2 6"/><circle cx="16" cy="13" r="1.3"/>'),
    sms: svg('<path d="M21 12a8 8 0 01-8 8H4l2.2-3A8 8 0 1121 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
    cms: svg('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8.5h18M7.5 21h9M12 18v3M6.5 12.5h4M6.5 15h7"/>'),
    rep: svg('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
    users: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 20v-1.3A4.7 4.7 0 018.2 14h1.6a4.7 4.7 0 014.7 4.7V20"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16 14.2a4.2 4.2 0 014.5 4.2V20"/>'),
    set: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.15-1.4l2.05-1.6-2-3.45-2.4 1a7 7 0 00-2.4-1.4L13.7 2.6h-3.4l-.4 2.55a7 7 0 00-2.4 1.4l-2.4-1-2 3.45 2.05 1.6A7 7 0 005 12c0 .5.05.95.15 1.4L3.1 15l2 3.45 2.4-1a7 7 0 002.4 1.4l.4 2.55h3.4l.4-2.55a7 7 0 002.4-1.4l2.4 1 2-3.45-2.05-1.6c.1-.45.15-.9.15-1.4z"/>')
  };

  /* آیکون سر دسته‌های آکاردئون */
  var GROUP_ICONS = {
    'فروش': svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>'),
    'تامین': svg('<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.5l2.5 12h9.5l2.5-8H7"/>'),
    'کالا و اسناد': svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
    'مالی': svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
    'شخصی': svg('<path d="M7 21v-2a4 4 0 014-4h2a4 4 0 014 4v2"/><circle cx="12" cy="8.5" r="3.5"/>'),
    'سیستم': ICONS.set
  };

  function applyIcons() {
    if (window.innerWidth <= 768) return; // Sprint 109: حفظ آیکون‌های بومی در موبایل برای جلوگیری از پرش
    var nav = document.querySelector('.sb-n');
    if (!nav) return;
    // آیتم‌های منو
    nav.querySelectorAll('.sb-i').forEach(function (b) {
      if (b.getAttribute('data-mi')) return;
      var m = (b.getAttribute('onclick') || '').match(/goPanel\('([a-z]+)'/);
      var ic = b.querySelector('.ic');
      if (m && ic && ICONS[m[1]]) {
        ic.innerHTML = ICONS[m[1]];
        ic.style.cssText = 'width:22px;display:grid;place-items:center;opacity:.85';
        b.setAttribute('data-mi', '1');
      }
    });
    // سر دسته‌ها: حذف ایموجی و درج آیکون خطی
    nav.querySelectorAll('.sb-g').forEach(function (h) {
      if (h.getAttribute('data-mi')) return;
      var sp = h.querySelector('span');
      if (!sp) return;
      var txt = sp.textContent.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
      var key = Object.keys(GROUP_ICONS).filter(function (k) { return txt.indexOf(k) > -1; })[0];
      if (key) {
        sp.innerHTML = '<span style="display:inline-grid;place-items:center;width:20px;vertical-align:-4px;margin-left:6px;opacity:.8">' + GROUP_ICONS[key] + '</span>' + txt;
        h.setAttribute('data-mi', '1');
      }
    });
  }

  /* ---------- v87.1: آیکون‌های مینیمال داخل پنل‌ها (سرتیترهای .ph h3) ---------- */
  var EMOJI_MAP = {
    '📊': ICONS.dash, '📋': ICONS.rfq, '🏭': ICONS.sup, '🤖': ICONS.rfqs, '🤝': ICONS.cust,
    '🎯': ICONS.leads, '⏰': ICONS.rem, '📦': ICONS.prod, '📄': ICONS.off, '💰': ICONS.orders,
    '💳': ICONS.fin, '📁': ICONS.deals, '🗄': ICONS.prj, '🗄️': ICONS.prj, '✉️': ICONS.let,
    '📜': ICONS.cnt, '🗂': ICONS.cart, '🛒': ICONS.buyq, '🧾': ICONS.inv, '💵': ICONS.petty,
    '💬': ICONS.sms, '🎛': ICONS.cms, '📈': ICONS.rep, '👥': ICONS.users, '⚙️': ICONS.set,
    '🔍': svg('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5L16 16"/>')
  };
  function applyPanelIcons() {
    document.querySelectorAll('#panels .ph h3').forEach(function (h) {
      if (h.getAttribute('data-mi')) return;
      var txt = h.textContent;
      var em = Object.keys(EMOJI_MAP).filter(function (e) { return txt.indexOf(e) === 0; })[0];
      if (!em) { h.setAttribute('data-mi', '1'); return; }
      var rest = txt.slice(em.length).trim();
      h.innerHTML = '<span style="display:inline-grid;place-items:center;width:26px;height:26px;background:linear-gradient(135deg,rgba(239,75,26,.12),rgba(247,148,0,.12));border-radius:8px;color:#c2410c;vertical-align:-6px;margin-left:8px">' + EMOJI_MAP[em] + '</span>' + escP(rest);
      h.setAttribute('data-mi', '1');
    });
  }

  /* ---------- v88: آیکون مینیمال دکمه‌های داخل پنل (🤖 خلاصه، 📖، 📎، ...) ---------- */
  var BTN_ICONS = {
    '🤖': svg('<rect x="5" y="8" width="14" height="11" rx="2.5"/><circle cx="9.5" cy="13" r="1.2" fill="currentColor"/><circle cx="14.5" cy="13" r="1.2" fill="currentColor"/><path d="M12 8V5M12 5h.01M8 16.5h8" />'),
    '📖': svg('<path d="M12 6c-1.5-1.3-3.5-2-6-2v14c2.5 0 4.5.7 6 2 1.5-1.3 3.5-2 6-2V4c-2.5 0-4.5.7-6 2z"/><path d="M12 6v14"/>'),
    '📎': svg('<path d="M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L10 17a1.7 1.7 0 01-2.4-2.4l7.4-7.4"/>'),
    '📨': svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/>'),
    '📄': svg('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>'),
    '🎯': svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
    '🧰': svg('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>'),
    '🗑': svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>'),
    '🗑️': svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>')
  };
  function applyBtnIcons() {
    document.querySelectorAll('#panels .ba, #panels .bt').forEach(function (b) {
      if (b.getAttribute('data-mi')) return;
      var txt = b.textContent || '';
      var em = Object.keys(BTN_ICONS).filter(function (e) { return txt.trim().indexOf(e) === 0; })[0];
      if (!em) return;
      // ایموجی ابتدای دکمه → SVG خطی هم‌اندازه متن
      b.innerHTML = b.innerHTML.replace(em,
        '<span style="display:inline-grid;place-items:center;width:15px;height:15px;vertical-align:-3px">' +
        BTN_ICONS[em].replace('width:18px;height:18px', 'width:14px;height:14px') + '</span>');
      b.setAttribute('data-mi', '1');
    });
  }

  // اجرا بعد از ساخت آکاردئون + هر لاگین
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    try {
      var nav = document.querySelector('.sb-n');
      if (nav && nav.getAttribute('data-acc')) { applyIcons(); }
      applyPanelIcons(); // v87.1: سرتیتر پنل جاری
      if (tries > 80) clearInterval(t);
    } catch (e) {}
  }, 500);
  // پس از توقف حلقه اولیه، پایش سبک دائمی برای پنل‌ها و دکمه‌های تازه رندر شده
  setInterval(function () { try { applyPanelIcons(); applyBtnIcons(); } catch (e) {} }, 1200);
})();
