/* Shared shell controller. Owns controls in capture phase so old per-page toggles
   cannot open and immediately close the same menu. Content scripts remain intact.
   Also owns the shared mobile dock (ptfDock): injected on pages without static
   markup so every page has the homepage bottom bar on mobile. */
(function () {
  'use strict';
  var root = document.documentElement;
  var mobile = window.matchMedia('(max-width:790px)');
  var lang = (root.lang || 'fa').split('-')[0];
  var hasMotion = !!document.querySelector('script[src*="ptf-motion.js"]');

  /* ============ shared mobile dock (all pages) ============ */
  var DOCK_LABELS = {
    fa: ['منو', 'تماس', 'استعلام', 'واتس‌اپ', 'چت هوشمند', 'دسترسی سریع موبایل', 'منوی بخش‌های سایت', 'ثبت استعلام قیمت (RFQ)', 'گفتگو با دستیار هوشمند'],
    en: ['Menu', 'Call', 'RFQ', 'WhatsApp', 'Chat', 'Mobile quick access', 'Site menu', 'Request a quote (RFQ)', 'Chat with assistant'],
    ar: ['القائمة', 'اتصال', 'استعلام', 'واتساب', 'محادثة', 'وصول سريع للجوال', 'قائمة الموقع', 'طلب عرض سعر', 'محادثة مع المساعد'],
    de: ['Menü', 'Anruf', 'Anfrage', 'WhatsApp', 'Chat', 'Mobiler Schnellzugriff', 'Menü', 'Anfrage stellen', 'Chat'],
    fr: ['Menu', 'Appel', 'Devis', 'WhatsApp', 'Chat', 'Accès rapide mobile', 'Menu', 'Demander un devis', 'Chat'],
    ru: ['Меню', 'Звонок', 'Запрос', 'WhatsApp', 'Чат', 'Быстрый доступ', 'Меню', 'Запросить цену', 'Чат'],
    tr: ['Menü', 'Ara', 'Teklif', 'WhatsApp', 'Sohbet', 'Mobil hızlı erişim', 'Menü', 'Teklif iste', 'Sohbet'],
    zh: ['菜单', '电话', '询价', 'WhatsApp', '聊天', '移动快捷方式', '菜单', '询价', '聊天']
  };
  var L = DOCK_LABELS[lang] || DOCK_LABELS.en;
  var SVG_CALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg>';
  var SVG_RFQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6v2h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h2V3z"/><path d="M9 12h6M9 16h4"/></svg>';
  var SVG_WA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/></svg>';
  var SVG_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 01-8 8H5l-2 2V12a8 8 0 018-8h2a8 8 0 018 8z"/></svg>';
  var dock = document.getElementById('ptfDock');
  if (!dock) {
    if (!document.getElementById('ptfNavBackdrop')) {
      var bd0 = document.createElement('div');
      bd0.id = 'ptfNavBackdrop';
      bd0.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bd0);
    }
    dock = document.createElement('nav');
    dock.id = 'ptfDock';
    dock.setAttribute('aria-label', L[5]);
    dock.innerHTML = '<button type="button" id="ptfDockMenu" class="dock-menu" aria-label="' + L[6] + '" aria-controls="mainNav" aria-expanded="false"><span class="dm-bars" aria-hidden="true"><i></i><i></i><i></i></span><span>' + L[0] + '</span></button>'
      + '<a href="tel:02146087679" data-ptf-event="dock_call" aria-label="' + L[1] + '">' + SVG_CALL + '<span>' + L[1] + '</span></a>'
      + '<a href="/rfq/" class="dock-cta" data-ptf-event="dock_rfq" aria-label="' + L[7] + '">' + SVG_RFQ + '<span>' + L[2] + '</span></a>'
      + '<a href="https://wa.me/989925868479?text=%D8%B3%D9%84%D8%A7%D9%85%D8%8C%20%D9%85%DB%8C%E2%80%8C%D8%AE%D9%88%D8%A7%D9%87%D9%85%20%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85%20%D8%A8%DA%AF%DB%8C%D8%B1%D9%85" target="_blank" rel="noopener" class="dock-wa" data-ptf-event="dock_whatsapp" aria-label="' + L[3] + '">' + SVG_WA + '<span>' + L[3] + '</span></a>'
      + '<button type="button" id="ptfDockChat" aria-label="' + L[8] + '">' + SVG_CHAT + '<span>' + L[4] + '</span></button>';
    document.body.appendChild(dock);
  }
  root.classList.add('ptf-has-dock');
  var dockMenu = document.getElementById('ptfDockMenu');
  var backdrop = document.getElementById('ptfNavBackdrop');
  var mainNavAny = document.getElementById('mainNav');
  function syncDock(open) {
    open = !!open;
    if (dockMenu) { dockMenu.classList.toggle('is-x', open); dockMenu.setAttribute('aria-expanded', String(open)); }
    if (backdrop) backdrop.classList.toggle('show', open);
    root.classList.toggle('ptf-lock', open);
  }
  /* Dock chat button (marked so ptf-motion never double-binds it). */
  var dockChat = document.getElementById('ptfDockChat');
  if (!hasMotion && dockChat && !dockChat.dataset.ptfDockBound) {
    dockChat.dataset.ptfDockBound = '1';
    dockChat.addEventListener('click', function () {
      var fab = document.getElementById('ptfChatBtn');
      if (fab) { fab.click(); return; }
      var c = document.getElementById('contact');
      if (c && c.scrollIntoView) { c.scrollIntoView({ behavior: 'smooth' }); return; }
      window.location.href = '/#contact';
    });
  }
  /* Hide the dock while scrolling down (mobile only); reveal on scroll up. */
  var lastY = window.scrollY || 0, ticking = false;
  function dockScroll() {
    var y = window.scrollY || root.scrollTop || 0;
    if (mobile.matches) {
      var sheetOpen = mainNavAny && mainNavAny.classList.contains('open');
      if (sheetOpen || y <= 380 || y < lastY - 8) dock.classList.remove('is-hidden');
      else if (y > 380 && y > lastY + 8) dock.classList.add('is-hidden');
    } else dock.classList.remove('is-hidden');
    lastY = y; ticking = false;
  }
  if (!hasMotion) window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(dockScroll); }
  }, { passive: true });
  dockScroll();

  /* ============ header controller ============ */
  var header = document.querySelector('[data-ptf-shell="header"]');
  if (!header) {
    /* Legacy pages: the dock menu delegates to the page's own toggle. */
    var lnav = document.getElementById('mainNav'), ltog = document.getElementById('menuToggle');
    if (!hasMotion && dockMenu && lnav && ltog) {
      dockMenu.addEventListener('click', function (e) { e.preventDefault(); ltog.click(); });
      if ('MutationObserver' in window) {
        new MutationObserver(function () { syncDock(lnav.classList.contains('open')); })
          .observe(lnav, { attributes: true, attributeFilter: ['class'] });
      }
      if (backdrop) backdrop.addEventListener('click', function () { lnav.classList.remove('open'); syncDock(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lnav.classList.contains('open')) { lnav.classList.remove('open'); syncDock(false); }
      });
    }
    /* Theme key on pages without the shell controller (A10: cookie-only persistence). */
    var themeBtn = document.getElementById('ptfThemeToggle');
    if (themeBtn && !hasMotion) {
      themeBtn.addEventListener('click', function (e) {
        e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
        var dark = !root.classList.contains('ptf-dark');
        root.classList.toggle('ptf-dark', dark);
        themeBtn.setAttribute('aria-pressed', String(dark));
        var txt = themeBtn.querySelector('.tt-txt'); if (txt) txt.textContent = dark ? 'نمای روز' : 'نمای شب';
        try { document.cookie = 'ptf_theme=' + (dark ? 'dark' : 'light') + ';max-age=31536000;path=/;SameSite=Lax'; } catch (e2) {}
        try { window.name = 'ptf_theme=' + (dark ? 'dark' : 'light'); } catch (e2) {}
      });
    } else if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        setTimeout(function () {
          try { window.name = 'ptf_theme=' + (root.classList.contains('ptf-dark') ? 'dark' : 'light'); } catch (e) {}
        }, 0);
      });
    }
    return;
  }
  var nav = header.querySelector('#mainNav');
  var toggle = header.querySelector('#menuToggle');
  var theme = header.querySelector('#ptfThemeToggle');
  var labels = {
    fa: ['نمای شب', 'نمای روز'], en: ['Dark', 'Light'], ar: ['الوضع الداكن', 'الوضع الفاتح'],
    de: ['Dunkel', 'Hell'], fr: ['Sombre', 'Clair'], ru: ['Тёмная тема', 'Светлая тема'],
    tr: ['Koyu', 'Açık'], zh: ['深色', '浅色']
  }[lang] || ['Dark', 'Light'];
  function setOpen(open, focus) {
    open = !!open && mobile.matches;
    nav.classList.toggle('open', open);
    toggle.classList.toggle('is-x', open);
    toggle.setAttribute('aria-expanded', String(open));
    nav.inert = mobile.matches && !open;
    syncDock(open);
    if (!open) {
      nav.querySelectorAll('.nav-drop.open').forEach(function (el) { el.classList.remove('open'); });
    }
    if (focus) toggle.focus();
  }
  function setTheme(dark, save) {
    root.classList.toggle('ptf-dark', dark);
    theme.setAttribute('aria-pressed', String(dark));
    theme.setAttribute('aria-label', labels[dark ? 1 : 0]);
    theme.setAttribute('title', labels[dark ? 1 : 0]);
    theme.querySelector('.tt-txt').textContent = labels[dark ? 1 : 0];
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc) {
      if (!mc.hasAttribute('data-ptf-light')) mc.setAttribute('data-ptf-light', mc.getAttribute('content') || '#ffffff');
      mc.setAttribute('content', dark ? '#0a1120' : mc.getAttribute('data-ptf-light'));
    }
    if (save) {
      try { document.cookie = 'ptf_theme=' + (dark ? 'dark' : 'light') + ';max-age=31536000;path=/;SameSite=Lax'; } catch (e) {}
      try { window.name = 'ptf_theme=' + (dark ? 'dark' : 'light'); } catch (e) {}
    }
  }
  var stored = /(?:^|; )ptf_theme=(dark|light)/.exec(document.cookie || '');
  var wnDark = null;
  try { var wn = window.name || ''; if (wn.indexOf('ptf_theme=dark') > -1) wnDark = true; else if (wn.indexOf('ptf_theme=light') > -1) wnDark = false; } catch (e) {}
  if (!stored && wnDark === null && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches) root.classList.add('ptf-dark');
  setTheme(stored ? stored[1] === 'dark' : (wnDark !== null ? wnDark : root.classList.contains('ptf-dark')), false);
  setOpen(false);
  // Separate disclosure for About: its original anchor remains navigable.
  nav.querySelectorAll('.nav-drop:not(.nav-products)').forEach(function (drop, index) {
    var panel = drop.querySelector('.nav-drop-menu');
    if (!panel) return;
    panel.id = 'shell-subnav-' + index;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'shell-subnav-toggle';
    btn.setAttribute('aria-label', drop.querySelector('a').textContent.trim());
    btn.setAttribute('aria-controls', panel.id); btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '⌄';
    drop.insertBefore(btn, panel);
    btn.addEventListener('click', function () {
      var open = drop.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#menuToggle, #ptfDockMenu')) {
      event.preventDefault(); event.stopImmediatePropagation();
      setOpen(!nav.classList.contains('open'));
    } else if (target.closest('#ptfThemeToggle')) {
      event.preventDefault(); event.stopImmediatePropagation();
      setTheme(!root.classList.contains('ptf-dark'), true);
    } else if (!header.contains(target)) {
      setOpen(false);
    }
  }, true);
  if (backdrop) backdrop.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (nav.classList.contains('open')) { event.preventDefault(); setOpen(false, true); }
      header.querySelectorAll('.nav-drop.open').forEach(function (el) { el.classList.remove('open'); });
    }
  });
  header.addEventListener('focusout', function () {
    setTimeout(function () { if (!header.contains(document.activeElement)) setOpen(false); }, 0);
  });
  new MutationObserver(function () {
    var open = nav.classList.contains('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-x', open);
    nav.inert = mobile.matches && !open;
    syncDock(open);
    nav.querySelectorAll('.shell-subnav-toggle').forEach(function (btn) {
      btn.setAttribute('aria-expanded', String(btn.parentNode.classList.contains('open')));
    });
  }).observe(nav, {attributes: true, attributeFilter: ['class'], subtree: true});
  function resize() { setOpen(false); }
  if (mobile.addEventListener) mobile.addEventListener('change', resize);
  else mobile.addListener(resize);
  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 28);
    header.classList.toggle('is-compact', window.scrollY > 28);
  }, {passive: true});
}());
