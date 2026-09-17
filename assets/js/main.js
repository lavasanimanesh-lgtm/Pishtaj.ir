/* v35 — PTF front controller (vanilla, dependency-free, motion-safe) */
(function () {
  'use strict';
  var d = document, w = window;
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* legacy preloader (some pages) — hide asap, never block paint */
  var pre = d.getElementById('preloader');
  if (pre) { w.addEventListener('load', function () { setTimeout(function () { pre.classList.add('hide'); }, 300); }); }

  /* header state */
  var header = d.querySelector('.site-header');
  function onScroll() { if (header) header.classList.toggle('scrolled', scrollY > 28); }
  w.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* drawer nav: toggle, scrim, esc, resize, link click */
  var nav = d.getElementById('mainNav');
  function navOpen() { return !!(nav && nav.classList.contains('open')); }
  function setNav(open) {
    if (!nav) return;
    nav.classList.toggle('open', open);
    d.body.classList.toggle('nav-open', open);
    var t = d.getElementById('menuToggle');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  d.addEventListener('click', function (e) {
    if (e.target.closest('#menuToggle') || e.target.closest('.js-menu')) { setNav(!navOpen()); return; }
    if (e.target.closest('#navScrim')) { setNav(false); return; }
    if (navOpen() && e.target.closest('.main-nav a')) setNav(false);
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  w.addEventListener('resize', function () { if (w.innerWidth > 850) setNav(false); });

  /* hero slider (Ken Burns handled in CSS) */
  var slides = [].slice.call(d.querySelectorAll('.slide'));
  var dotsWrap = d.getElementById('sliderDots');
  if (dotsWrap && slides.length) {
    var current = 0;
    slides.forEach(function (_, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'نمایش اسلاید ' + (i + 1));
      b.addEventListener('click', function () { goSlide(i); });
      dotsWrap.appendChild(b);
    });
    var dots = [].slice.call(dotsWrap.children);
    function goSlide(i) {
      if (slides[current]) slides[current].classList.remove('active');
      if (dots[current]) dots[current].classList.remove('active');
      current = i;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }
    goSlide(0);
    /* preload next slide bg lazily */
    slides.forEach(function (s) {
      var bg = s.getAttribute('data-bg');
      if (bg && !s.style.backgroundImage) {
        var im = new Image();
        im.onload = function () { s.style.backgroundImage = "url('" + bg + "')"; };
        im.src = bg;
      }
    });
    if (!reduce) setInterval(function () { goSlide((current + 1) % slides.length); }, 5400);
  }

  /* scroll reveal with gentle stagger */
  var reveals = [].slice.call(d.querySelectorAll('.reveal'));
  reveals.forEach(function (el) {
    var i = el.parentElement ? [].indexOf.call(el.parentElement.children, el) : 0;
    if (i > 0) el.style.transitionDelay = (Math.min(i, 4) * 0.07) + 's';
  });
  function clearDelay(el) { setTimeout(function () { el.style.transitionDelay = '0s'; }, 900); }
  if ('IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); clearDelay(e.target); io.unobserve(e.target); }
      });
    }, { threshold: .12, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  /* scrollspy */
  var sections = [].slice.call(d.querySelectorAll('section[id]'));
  var navLinks = [].slice.call(d.querySelectorAll('.main-nav a'));
  var spyTick = false;
  function spy() {
    var cur = '';
    sections.forEach(function (s) { if (scrollY >= s.offsetTop - 135) cur = s.id; });
    navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + cur); });
    spyTick = false;
  }
  w.addEventListener('scroll', function () { if (!spyTick) { spyTick = true; requestAnimationFrame(spy); } }, { passive: true });

  /* brand tabs */
  [].slice.call(d.querySelectorAll('.tab')).forEach(function (tab) {
    tab.addEventListener('click', function () {
      d.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      d.querySelectorAll('.brand-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var p = d.getElementById(tab.dataset.tab);
      if (p) p.classList.add('active');
    });
  });

  /* animated counters (Persian digits, suffix-safe) */
  function faNum(n) { return String(n).replace(/\d/g, function (x) { return '۰۱۲۳۴۵۶۷۸۹'[x]; }); }
  var counters = [].slice.call(d.querySelectorAll('[data-counter]'));
  if (counters.length && 'IntersectionObserver' in w && !reduce) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; cio.unobserve(el);
        var target = parseInt(el.getAttribute('data-counter'), 10) || 0;
        var orig = el.textContent;
        if (!/[۰-۹0-9]/.test(orig)) return;
        var t0 = null, dur = 1300;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur);
          p = 1 - Math.pow(1 - p, 3);
          el.textContent = orig.replace(/[۰-۹0-9]+/, faNum(Math.round(target * p)));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: .5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* hero keyword ticker */
  var tick = d.getElementById('heroTicker');
  if (tick && !reduce) {
    var words = ['لوله مانیسمان و API 5L', 'شیرآلات صنعتی API 6D', 'ترانسمیتر Rosemount', 'سوئیچگیر و تابلو LV/MV', 'فلنج ASME B16.5', 'گسکت و آب‌بندی صنعتی', 'پمپ API 610', 'بویلر و تجهیزات بخار'];
    var wi = 0;
    setInterval(function () {
      wi = (wi + 1) % words.length;
      tick.classList.remove('swap'); void tick.offsetWidth;
      tick.textContent = words[wi];
      tick.classList.add('swap');
    }, 2600);
  }

  /* contact form */
  var form = d.getElementById('contactForm'), statusBox = d.getElementById('formStatus');
  function setStatus(msg, type) { if (!statusBox) return; statusBox.textContent = msg; statusBox.className = 'form-status full ' + (type || ''); }
  if (form && statusBox && !form.dataset.ptfCustomSubmit) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); setStatus('');
      if (!form.checkValidity()) { setStatus('لطفاً فیلدهای الزامی را کامل و صحیح وارد کنید.', 'err'); form.reportValidity(); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'در حال ارسال...';
      try {
        var res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } });
        var data = {}; try { data = await res.json(); } catch (_) { }
        if (res.ok && data.ok) { setStatus('درخواست شما با موفقیت ثبت شد. کارشناسان بازرگانی با شما تماس خواهند گرفت.', 'ok'); form.reset(); }
        else throw new Error(data.message || 'ارسال انجام نشد.');
      } catch (err) {
        setStatus('ارسال آنلاین ناموفق بود. لطفاً با شماره ۰۲۱-۴۶۰۸۷۶۷۹ تماس بگیرید یا ایمیل ارسال کنید.', 'err');
      } finally { btn.disabled = false; btn.textContent = 'ارسال درخواست به واحد بازرگانی'; }
    });
  }

  /* home marquees: duplicate tracks once for seamless motion */
  function duplicate(track) {
    if (!track || track.dataset.marqueeReady) return;
    track.dataset.marqueeReady = '1';
    [].slice.call(track.children).forEach(function (n) { track.appendChild(n.cloneNode(true)); });
  }
  duplicate(d.getElementById('clientMarqueeTrack'));
  var brandTrack = d.getElementById('brandMarqueeTrack');
  if (brandTrack) {
    var seen = {};
    [].slice.call(d.querySelectorAll('.brand-panel a')).slice(0, 18).forEach(function (a, index) {
      var img = a.querySelector('img'), key = img && img.getAttribute('src');
      if (!img || !key || seen[key]) return;
      seen[key] = 1;
      var link = a.cloneNode(true);
      link.removeAttribute('loading');
      var copied = link.querySelector('img');
      if (copied) { copied.loading = index < 10 ? 'eager' : 'lazy'; copied.fetchPriority = index < 4 ? 'high' : 'auto'; copied.decoding = 'async'; }
      brandTrack.appendChild(link);
    });
    duplicate(brandTrack);
  }
})();
