/* ================================== */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  var RM = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE = !!(win.matchMedia && win.matchMedia('(hover:hover) and (pointer:fine)').matches);
  function ready(fn) { if (doc.readyState !== 'loading') fn(); else doc.addEventListener('DOMContentLoaded', fn); }

  /* ① هدر جمع‌شونده + داک هوشمند (مخفی */
  function scrollUI() {
    var header = doc.querySelector('.site-header'), dock = doc.getElementById('ptfDock'), nav = doc.getElementById('mainNav');
    if (!header && !dock) return;
    var lastY = win.scrollY || 0, ticking = false;
    function upd() {
      var y = win.scrollY || root.scrollTop || 0;
      if (header) header.classList.toggle('is-compact', y > 90);
      if (dock && win.matchMedia('(max-width:790px)').matches) {
        var sheetOpen = nav && nav.classList.contains('open');
        if (sheetOpen || y <= 380 || y < lastY - 8) dock.classList.remove('is-hidden');
        else if (y > 380 && y > lastY + 8) dock.classList.add('is-hidden');
      } else if (dock) dock.classList.remove('is-hidden');
      lastY = y; ticking = false;
    }
    win.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ② شکافت کلمات H1 (کاهش‌حرکت = بدون */
  function splitWords() {
    if (RM) return;
    var h1 = doc.querySelector('.hero h1');
    if (!h1 || h1.getAttribute('data-ptf-split')) return;
    h1.setAttribute('data-ptf-split', '1');
    var i = 0;
    function wordSpan(word, strong) {
      var outer = doc.createElement('span'); outer.className = 'ptf-w';
      var inner = doc.createElement('span'); inner.className = 'ptf-wi' + (strong ? ' w-strong' : '');
      inner.textContent = word;
      inner.style.animationDelay = Math.min(1500, 160 + (i++) * 42) + 'ms';
      outer.appendChild(inner); return outer;
    }
    Array.prototype.slice.call(h1.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var words = n.textContent.split(/\s+/).filter(Boolean);
        if (!words.length) return;
        var frag = doc.createDocumentFragment();
        words.forEach(function (w) { frag.appendChild(wordSpan(w, false)); frag.appendChild(doc.createTextNode(' ')); });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName === 'STRONG') {
        var ws = n.textContent.split(/\s+/).filter(Boolean);
        n.textContent = '';
        ws.forEach(function (w) { n.appendChild(wordSpan(w, true)); n.appendChild(doc.createTextNode(' ')); });
      }
    });
  }

  /* ③ شمارنده‌های آماری (فقط متن‌های ع */
  function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function counters() {
    if (RM || !('IntersectionObserver' in win)) return;
    var els = Array.prototype.filter.call(doc.querySelectorAll('[data-counter]'), function (el) {
      return /^(\D{0,2})[\u06F0-\u06F9\d]+.{0,3}$/.test(el.textContent.trim());
    });
    if (!els.length) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); run(e.target); });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
    function run(el) {
      var text = el.textContent.trim(), m = /^(\D{0,2})([\u06F0-\u06F9\d]+)(.*)$/.exec(text);
      if (!m) return;
      var target = parseInt(m[2].replace(/[\u06F0-\u06F9]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }).replace(/[^\d]/g, ''), 10);
      if (!target || target > 100000) return;
      var t0 = 0, DUR = 1100;
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / DUR), e = 1 - Math.pow(1 - p, 3);
        el.textContent = m[1] + fa(Math.round(target * e)) + m[3];
        if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
      }
      requestAnimationFrame(tick);
    }
  }

  /* ④ اسپات‌لایت نشانگر روی کارت‌ها (ف */
  function spotlight() {
    if (!FINE || RM) return;
    var sel = '.service-card,.trust-item,#journey a.reveal,#why-ptf .reveal,.ptf-record-card';
    var raf = false, ev = null;
    function mv(e) {
      ev = e;
      if (raf) return; raf = true;
      requestAnimationFrame(function () {
        raf = false;
        var el = ev.currentTarget, x = ev.clientX, y = ev.clientY;
        if (!el || !el.getBoundingClientRect) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((x - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((y - r.top) / r.height * 100).toFixed(1) + '%');
        if (el.classList.contains('service-card')) {
          var rx = -( (y - r.top) / r.height - .5) * 5, ry = ((x - r.left) / r.width - .5) * 6;
          el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        }
      });
    }
    Array.prototype.forEach.call(doc.querySelectorAll(sel), function (el) {
      el.addEventListener('pointermove', mv, { passive: true });
    });
  }

  /* ⑤ کشوی موبایل: هماهام‌سازی با togg */
  function drawer() {
    var nav = doc.getElementById('mainNav'), tog = doc.getElementById('menuToggle'), bd = doc.getElementById('ptfNavBackdrop');
    if (!nav || !tog) return;
    tog.setAttribute('aria-expanded', 'false');
    function sync() {
      var open = nav.classList.contains('open');
      if (!open) Array.prototype.forEach.call(nav.querySelectorAll('.nav-drop.open'), function (d) { d.classList.remove('open'); });
      tog.classList.toggle('is-x', open);
      tog.setAttribute('aria-expanded', open ? 'true' : 'false');
      var dm = doc.getElementById('ptfDockMenu');
      if (dm) { dm.classList.toggle('is-x', open); dm.setAttribute('aria-expanded', open ? 'true' : 'false'); }
      if (bd) bd.classList.toggle('show', open);
      root.classList.toggle('ptf-lock', open);
    }
    if ('MutationObserver' in win) new MutationObserver(sync).observe(nav, { attributes: true, attributeFilter: ['class'] });
    else tog.addEventListener('click', function () { setTimeout(sync, 0); });
    if (bd) bd.addEventListener('click', function () { nav.classList.remove('open'); });
    var dm = doc.getElementById('ptfDockMenu');
    if (dm) dm.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); nav.classList.toggle('open'); });
    /* آکاردئون «درباره ما» در شیت: کلیک  */
    nav.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('#mainNav .nav-drop>a[aria-haspopup]') : null;
      if (!a || !(win.matchMedia && win.matchMedia('(max-width:790px)').matches)) return;
      var d = a.parentNode;
      if (d.classList.contains('open')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      Array.prototype.forEach.call(nav.querySelectorAll('.nav-drop.open'), function (o) { o.classList.remove('open'); });
      d.classList.add('open');
    }, true);
    /* v34.39.3 — شیت در موبایل به body م */
    var mqN = win.matchMedia ? win.matchMedia('(max-width:790px)') : null;
    var bd2 = doc.getElementById('ptfNavBackdrop'), wrap = doc.querySelector('.nav-wrap');
    function placeNav() {
      if (!mqN || !bd2 || !wrap) return;
      var inHeader = nav.parentNode === wrap;
      if (mqN.matches && inHeader) doc.body.insertBefore(nav, bd2);
      else if (!mqN.matches && !inHeader) wrap.appendChild(nav);
    }
    placeNav();
    if (mqN) { if (mqN.addEventListener) mqN.addEventListener('change', placeNav); else if (mqN.addListener) mqN.addListener(placeNav); }
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); tog.focus(); } });
  }

  /* ⑥ دکمهٔ چت داک */
  function dock() {
    var chat = doc.getElementById('ptfDockChat');
    if (chat) chat.addEventListener('click', function () {
      var fab = doc.getElementById('ptfChatBtn');
      if (fab) { fab.click(); }
      else { var c = doc.getElementById('contact'); if (c) c.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); }
    });
  }

  /* ⑦ لیفت هاور کارت‌ها (دسکتاپ) */
  function tilt() {
    if (!FINE || RM) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.service-card'), function (el) {
      el.addEventListener('pointerenter', function () { el.classList.add('ptf-lift'); });
      el.addEventListener('pointerleave', function () { el.classList.remove('ptf-lift'); });
    });
  }

  /* ⑧ شب خودکار از غروب (فرمول NOAA/مع */
  function sunNight(jd) {
    try {
      var R = Math.PI / 180, lat = 35.7 * R, lng = 51.44;
      var n = Math.floor(jd - 0.5) - 2451544, Js = n - lng / 360;
      var M = (357.5291 + 0.98560028 * Js) % 360, mr = M * R;
      var C = 1.9148 * Math.sin(mr) + 0.02 * Math.sin(2 * mr) + 0.0003 * Math.sin(3 * mr);
      var L = (M + C + 282.9372) % 360, lr = L * R;
      var t = 2451545 + Js + 0.0053 * Math.sin(mr) - 0.0069 * Math.sin(2 * lr);
      var d = Math.asin(Math.sin(lr) * 0.397746);
      var c = (Math.sin(-0.0145444) - Math.sin(lat) * Math.sin(d)) / (Math.cos(lat) * Math.cos(d));
      var w = Math.acos(Math.max(-1, Math.min(1, c))) / R;
      return jd < (t - w / 360) || jd > (t + w / 360);
    } catch (e) { return root.classList.contains('ptf-dark'); }
  }
  var memManual = '';
  function manualTheme() { if (memManual) return memManual; var m = /(?:^|; )ptf_theme=(dark|light)/.exec(doc.cookie || ''); return m ? m[1] : ''; }
  function theme() {
    var btn = doc.getElementById('ptfThemeToggle'); if (!btn) return;
    var txt = btn.querySelector('.tt-txt');
    function syncBtn(dark) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      if (txt) txt.textContent = dark ? 'نمای روز' : 'نمای شب';
      var mc = doc.querySelector('meta[name="theme-color"]:not([media])'); if (mc) mc.setAttribute('content', dark ? '#0a1120' : '#ffffff');
    }
    function set(dark, persist) {
      root.classList.toggle('ptf-dark', dark); syncBtn(dark);
      root.classList.add('ptf-theme-anim');
      setTimeout(function () { root.classList.remove('ptf-theme-anim'); }, 480);
      if (persist) { memManual = dark ? 'dark' : 'light'; try { doc.cookie = 'ptf_theme=' + (dark ? 'dark' : 'light') + ';max-age=31536000;path=/;SameSite=Lax'; } catch (e) {} }
    }
    syncBtn(root.classList.contains('ptf-dark'));
    btn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); set(!root.classList.contains('ptf-dark'), true); });
    /* خودکار هر دقیقه؛ اوررایدِ دستی در حافظه (کوکی اگر مسدودِ iframe) */
    win.setInterval(function () {
      if (manualTheme() || doc.hidden) return;
      var want = sunNight(Date.now() / 864e5 + 2440587.5);
      if (want !== root.classList.contains('ptf-dark')) set(want, false);
    }, 6e4);
  }

  /* ⑨ فلش‌های مینیمال زنده: پیچیدن آخر */
  function arrows() {
    Array.prototype.forEach.call(doc.querySelectorAll('.text-link, a.btn, #journey em'), function (el) {
      if (el.querySelector('.arw')) return;
      var html = el.innerHTML;
      if (/<\/(svg|span|b|strong)>/.test(html)) { /* keep markup, only suffix */ }
      var m = html.match(/(←|→)\s*$/);
      if (m) el.innerHTML = html.replace(/(←|→)\s*$/, '<i class="arw" aria-hidden="true">$1</i>');
    });
  }

  ready(function () { scrollUI(); splitWords(); counters(); spotlight(); drawer(); dock(); tilt(); theme(); arrows(); });
})();
