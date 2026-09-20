/* Shared shell controller. Owns controls in capture phase so old per-page toggles
   cannot open and immediately close the same menu. Content scripts remain intact. */
(function () {
  'use strict';
  var header = document.querySelector('[data-ptf-shell="header"]');
  if (!header) return;
  var root = document.documentElement;
  var nav = header.querySelector('#mainNav');
  var toggle = header.querySelector('#menuToggle');
  var theme = header.querySelector('#ptfThemeToggle');
  var mobile = window.matchMedia('(max-width:790px)');
  var lang = (root.lang || 'fa').split('-')[0];
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
    var dock = document.getElementById('ptfDockMenu');
    if (dock) dock.setAttribute('aria-expanded', String(open));
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
    if (save) {
      document.cookie = 'ptf_theme=' + (dark ? 'dark' : 'light') + ';max-age=31536000;path=/;SameSite=Lax';
    }
  }
  var stored = /(?:^|; )ptf_theme=(dark|light)/.exec(document.cookie || '');
  setTheme(stored ? stored[1] === 'dark' : root.classList.contains('ptf-dark'), false);
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
