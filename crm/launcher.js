/* =====================================================================
   PTF CRM — launcher.js — v12.4 — US-302 (مصوب کارفرما)
   داشبورد = فضای دسترسی (لانچر): ماژول‌ها به‌صورت کاشی‌های مربع گرافیکی
   با آیکون، و اولویت‌بندی با درگ کردن (Pointer Events — ماوس و لمس).
   - کاشی‌ها از سایدبار واقعی ساخته می‌شوند → RBAC خودکار
   - ترتیب per-user در ptf_crm_settings.dashOrder (سینک بین دستگاه‌ها)
   - آمار و فعالیت‌های داشبورد قدیم در یک details جمع‌شونده حفظ شد
     (شناسه‌های dRfq/dAct/... زنده می‌مانند → updateStats نمی‌شکند)
   ===================================================================== */
(function () {
  'use strict';

  function myUser() { try { return curSession().user || '_'; } catch (e) { return '_'; } }
  function getOrder() {
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      return (st.dashOrder || {})[myUser()] || null;
    } catch (e) { return null; }
  }
  function saveOrder(ids) {
    try {
      var st = {};
      try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
      st.dashOrder = st.dashOrder || {};
      st.dashOrder[myUser()] = ids;
      setData('ptf_crm_settings', st);
    } catch (e) {}
  }

  /* ---------- کاشی‌ها از سایدبار (RBAC اعمال‌شده) ---------- */
  function tiles() {
    var out = [];
    document.querySelectorAll('.sb-n .sb-i').forEach(function (b) {
      if (b.style.display === 'none') return; // RBAC
      var m = (b.getAttribute('onclick') || '').match(/goPanel\('([a-z]+)'/);
      if (!m || m[1] === 'dash') return;
      var ic = b.querySelector('.ic');
      var lb = b.querySelector('.lb');
      out.push({ id: m[1], ic: ic ? ic.innerHTML : '•', lb: lb ? lb.textContent : m[1] });
    });
    var order = getOrder();
    if (order && order.length) {
      out.sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia < 0) ia = 999; if (ib < 0) ib = 999;
        return ia - ib;
      });
    }
    return out;
  }

  function lchHtml() {
    var t = tiles();
    if (!t.length) return '';
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
      '<h4 style="margin:0;font-size:14px">🚀 دسترسی سریع ماژول‌ها</h4>' +
      '<small style="color:#94a3b8;font-size:11.5px">برای اولویت‌بندی، کاشی را بکشید و جابجا کنید — ترتیب شما ذخیره می‌شود</small></div>' +
      '<div id="lchGrid" class="lch-grid">';
    /* v12.8 (US-316): آیکون‌های خطی رنگی — پالت چرخشی برای جذابیت (SVGهای currentColor رنگ والد را می‌گیرند) */
    var PAL = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#d946ef'];
    t.forEach(function (x, i) {
      var col = PAL[i % PAL.length];
      h += '<div class="lch-tile" data-p="' + x.id + '" onpointerdown="ptfLchDown(event,this)">' +
        '<span class="lch-ic" style="color:' + col + '">' + x.ic + '</span><span class="lch-lb">' + x.lb + '</span></div>';
    });
    return h + '</div>';
  }

  /* ---------- v12.9 (US-316v2): موتور درگ بازنویسی کامل — الگوی آیکون‌های موبایل ----------
     ماوس: گرفتن و کشیدن | لمس: نگه‌داشتن انگشت (۳۰۰ms) سپس کشیدن
     شبح (ghost) دنبال اشاره‌گر می‌آید؛ کاشی اصلی جای‌نما (کم‌رنگ) می‌شود؛
     بقیه کاشی‌ها با انیمیشن FLIP فوری جا باز می‌کنند. */
  window.ptfLchDown = function (e, tile) {
    if (e.button && e.button !== 0) return;
    var grid = tile.parentElement;
    if (!grid) return;
    var isTouch = e.pointerType === 'touch';
    var sx = e.clientX, sy = e.clientY;
    var started = false, ghost = null, pressT = null;
    var allowDrag = !isTouch; // ماوس: بلافاصله مجاز؛ لمس: بعد از نگه‌داشتن

    if (isTouch) {
      pressT = setTimeout(function () {
        allowDrag = true;
        startDrag(sx, sy);
        try { if (navigator.vibrate) navigator.vibrate(35); } catch (err) {}
      }, 300);
    }

    /* FLIP: جابجایی DOM بدون پرش — کاشی‌ها روان سُر می‌خورند و جا باز می‌کنند */
    function flip(mutate) {
      var kids = [].slice.call(grid.children);
      var before = kids.map(function (k) { return k.getBoundingClientRect(); });
      mutate();
      kids.forEach(function (k, i) {
        var after = k.getBoundingClientRect();
        var dx = before[i].left - after.left, dy = before[i].top - after.top;
        if (dx || dy) {
          k.style.transition = 'none';
          k.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          void k.offsetWidth; // reflow
          k.style.transition = 'transform .18s ease';
          k.style.transform = '';
        }
      });
    }

    function startDrag(x, y) {
      if (started) return;
      started = true;
      var r = tile.getBoundingClientRect();
      ghost = tile.cloneNode(true);
      ghost.removeAttribute('onpointerdown');
      ghost.className = 'lch-tile lch-ghost';
      ghost.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;z-index:3000;pointer-events:none;margin:0;transform:scale(1.07);opacity:.96;box-shadow:0 20px 48px rgba(15,23,42,.32);aspect-ratio:auto';
      ghost._dx = x - r.left;
      ghost._dy = y - r.top;
      document.body.appendChild(ghost);
      tile.classList.add('lch-ph');
      document.body.style.userSelect = 'none';
    }

    function mv(ev) {
      if (ev.pointerId !== e.pointerId) return;
      if (!started) {
        var moved = Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy);
        if (!allowDrag) { if (moved > 12) cleanup(); return; } // لمس: حرکت قبل از نگه‌داشتن = اسکرول، درگ لغو
        if (moved < 6) return;
        startDrag(ev.clientX, ev.clientY);
      }
      if (ev.cancelable) ev.preventDefault();
      ghost.style.left = (ev.clientX - ghost._dx) + 'px';
      ghost.style.top = (ev.clientY - ghost._dy) + 'px';
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var over = el && el.closest ? el.closest('.lch-tile') : null;
      if (over && over !== tile && !over.classList.contains('lch-ghost') && over.parentElement === grid) {
        var r2 = over.getBoundingClientRect();
        var before = ev.clientX > r2.left + r2.width / 2; // RTL: نیمه راست = قبل
        var target = before ? over : over.nextSibling;
        if (target !== tile && !(target === tile.nextSibling && !before)) {
          flip(function () { grid.insertBefore(tile, target); });
        }
      }
    }

    function up(ev) {
      if (ev.pointerId !== e.pointerId) return;
      var wasStarted = started;
      cleanup();
      if (wasStarted) {
        var ids = [];
        grid.querySelectorAll('.lch-tile').forEach(function (x) { ids.push(x.getAttribute('data-p')); });
        saveOrder(ids);
        if (typeof ptfToast === 'function') ptfToast('ترتیب ماژول‌ها ذخیره شد', 'ok');
      } else {
        // کلیک/تپ ساده = ورود به ماژول
        var id = tile.getAttribute('data-p');
        if (typeof goPanel === 'function') goPanel(id);
      }
    }

    function cleanup() {
      if (pressT) { clearTimeout(pressT); pressT = null; }
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      if (ghost && ghost.parentNode) ghost.remove();
      ghost = null;
      tile.classList.remove('lch-ph');
      document.body.style.userSelect = '';
      started = false;
    }
    function cancel(ev) { if (ev.pointerId === e.pointerId) cleanup(); }

    /* شنونده‌ها روی document — مقاوم در برابر جابجایی DOM کاشی حین درگ */
    document.addEventListener('pointermove', mv, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
  };

  /* ---------- استایل ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.lch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:12px;margin-bottom:18px}' +
    '.lch-tile{aspect-ratio:1/1;background:var(--crd,#fff);border:1px solid var(--brd,#e8ebf0);border-radius:18px;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;cursor:pointer;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;transition:box-shadow .15s,transform .15s;box-shadow:0 1px 3px rgba(15,23,42,.05)}' +
    '.lch-tile:hover{box-shadow:0 8px 24px rgba(15,23,42,.1);transform:translateY(-2px)}' +
    '.lch-tile.lch-ph{opacity:.3;border-style:dashed!important;box-shadow:none!important;transform:none!important}' + /* v12.9: جای‌نمای کاشی حین درگ */
    '.lch-tile{-webkit-touch-callout:none}' + /* iOS: منوی نگه‌داشتن غیرفعال (لازمه long-press درگ) */
    '.lch-ic{font-size:26px;display:grid;place-items:center;height:32px}' +
    '.lch-ic svg{width:27px;height:27px}' +
    '.lch-ic span[data-ix]{display:inline-flex!important}' +
    '.lch-lb{font-size:11.5px;font-weight:800;color:var(--tx,#334155);text-align:center;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.lch-old{margin-top:4px}' +
    '.lch-old summary{cursor:pointer;font-size:12.5px;font-weight:800;color:#64748b;padding:8px 0}' +
    'body.ptf-dark .lch-tile{background:#1e293b;border-color:#334155}' +
    'body.ptf-dark .lch-tile:hover{box-shadow:0 8px 24px rgba(0,0,0,.4)}' +
    '@media(max-width:768px){.lch-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px}.lch-ic{font-size:22px}.lch-lb{font-size:10.5px}}';
  document.head.appendChild(css);

  /* ---------- ترکیب با داشبورد موجود: لانچر بالا، آمار قدیم جمع‌شونده ---------- */
  function hook() {
    var _orig = window.buildDashboard;
    if (typeof _orig !== 'function') { setTimeout(hook, 400); return; }
    if (window._lchHooked) return;
    window._lchHooked = true;
    window.buildDashboard = function () {
      return lchHtml() +
        '<details class="lch-old"><summary>📊 آمار و فعالیت‌های اخیر (داشبورد قدیم)</summary>' + _orig() + '</details>';
    };
  }
  hook();
})();
