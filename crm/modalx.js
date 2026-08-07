/* =====================================================================
   PTF CRM — modalx.js — Sprint 122.1 — US-279
   دکمه‌های مک‌استایل روی همه پنجره‌های مودال (طبق تصویر مرجع کارفرما):
   🔴 قرمز = بستن | 🟡 زرد = مینیمایز به داک پایین صفحه (با حفظ اطلاعات فرم)
   🟢 سبز = تمام‌صفحه/برگشت
   الگو: Event-Hooking + MutationObserver سبک (بدون polling سنگین)
   v24.2: بازگشت جای کنترل‌ها به بالا-چپ + دایره کوچک (نه بیضی بزرگ پایین)
   ===================================================================== */
(function () {
  'use strict';

  /* v24.7: لایه سراسری — هر مودال جدید بالاتر از همه مودال‌های باز */
  window.ptfTopZIndex = function (base) {
    var z = (base != null ? +base : 1200);
    if (!(z > 0)) z = 1200;
    try {
      var nodes = document.querySelectorAll('.md-b, .ptfdlg-b, #ptfPrintPreview, #ptfDocViewer, #ptfAttModal, .ptfdlg');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el || (el.style && el.style.display === 'none')) continue;
        var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        var raw = (el.style && el.style.zIndex) || (cs && cs.zIndex) || '0';
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n >= z) z = n + 20;
      }
    } catch (e) {}
    return z;
  };
  window.ptfElevateModal = function (el) {
    if (!el || !el.style) return 0;
    var z = window.ptfTopZIndex(1200);
    el.style.zIndex = String(z);
    el.style.position = el.style.position || 'fixed';
    return z;
  };

  /* ---------- استایل (کلاسیک مک — بالا چپ، دایره ۱۳px) ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.mx-dots{position:absolute;top:12px;left:14px;display:flex;gap:7px;z-index:20;direction:ltr;align-items:center;margin:0;padding:0;background:transparent;border:0;box-shadow:none;transform:none;inset:auto;right:auto;bottom:auto}' +
    '.mx-dot{width:13px;height:13px;min-width:13px;min-height:13px;max-width:13px;max-height:13px;border-radius:50%;border:0;cursor:pointer;padding:0;margin:0;transition:filter .15s;flex:none;line-height:0;box-shadow:none}' +
    '.mx-dot:hover{filter:brightness(.85)}' +
    '.mx-dot.r{background:#e5655c}.mx-dot.y{background:#f0b429}.mx-dot.g{background:#61c454}' +
    '.mx-dot{position:relative}' +
    '.mx-dot span{display:none;position:absolute;inset:0;font-size:9.5px;line-height:13px;text-align:center;font-weight:900;color:rgba(0,0,0,.6);pointer-events:none}' +
    '.mx-dots:hover .mx-dot span{display:block}' +
    '.md.mx-full,.ptfdlg.mx-full{width:96vw!important;max-width:96vw!important;height:94vh!important;max-height:94vh!important}' +
    '.mx-dot.a{background:#8b5cf6;width:13px;height:13px;min-width:13px;min-height:13px;max-width:13px;max-height:13px;border-radius:50%}' +
    '#mxDock{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:1600}' +
    '.mx-disk{display:flex;align-items:center;gap:7px;background:#1e293b;color:#e2e8f0;border-radius:999px;padding:7px 16px;font-size:12px;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.35);border:1px solid #334155;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mx-disk:hover{background:#334155}' +
    '.mx-disk .x{color:#f87171;margin-right:2px;font-weight:900}' +
    'body.ptf-dark .mx-disk{background:#334155}' +
    /* فقط فاصله ملایم تیتر تا زیر نقطه‌ها نرود — بدون جابه‌جایی ریل کنترل */
    '.md[data-mx="1"]>h3:first-child,.md[data-mx="1"] h3:first-of-type{padding-left:72px}';
  document.head.appendChild(css);

  var dock = document.createElement('div');
  dock.id = 'mxDock';
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(dock); });
  if (document.body) document.body.appendChild(dock);

  /* ---------- تجهیز یک مودال ---------- */
  function equip(mdb) {
    var md = mdb.querySelector('.md') || mdb.querySelector('.ptfdlg');
    if (!md) return;
    /* همیشه لایه را بالای مودال‌های قبلی ببر — حتی اگر قبلاً mx-dots داشته */
    try {
      if (typeof window.ptfElevateModal === 'function') window.ptfElevateModal(mdb);
      else {
        var _z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex() : 2600;
        mdb.style.zIndex = String(_z);
      }
    } catch (eZ) {}
    if (md.querySelector('.mx-dots')) return;
    if (mdb.id === 'mxDockGhost') return;
    md.querySelectorAll('.ptf-win-ctrls, .md-ctrls, .mx-ai').forEach(function (el) { el.remove(); });
    md.style.position = 'relative';
    try { md.setAttribute('data-mx', '1'); } catch (e0) {}

    var bar = document.createElement('div');
    bar.className = 'mx-dots';
    /* اجبار جای کلاسیک — حتی اگر CSS قدیمی کش شده باشد */
    bar.style.cssText = 'position:absolute;top:12px;left:14px;display:flex;gap:7px;z-index:20;direction:ltr;align-items:center;margin:0;padding:0;background:transparent;border:0;right:auto;bottom:auto;inset:auto';

    var r = document.createElement('button');
    r.type = 'button';
    r.className = 'mx-dot r'; r.title = 'بستن'; r.setAttribute('aria-label', 'بستن پنجره');
    r.style.cssText = 'width:13px;height:13px;min-width:13px;min-height:13px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;background:#e5655c;flex:none';
    r.innerHTML = '<span>✕</span>';
    r.onclick = function (e) { e.stopPropagation(); mdb.remove(); };

    function mxMinimize() {
      var title = (md.querySelector('h3') ? md.querySelector('h3').textContent : 'پنجره').trim().slice(0, 34);
      if (mdb.parentNode !== document.body) document.body.appendChild(mdb);
      mdb.style.display = 'none';
      var disk = document.createElement('div');
      disk.className = 'mx-disk';
      disk.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;background:#f0b429;flex:none"></span><span style="overflow:hidden;text-overflow:ellipsis">' + title.replace(/</g, '&lt;') + '</span><span class="x" title="بستن کامل">✕</span>';
      disk.onclick = function (ev) {
        if (ev.target.classList.contains('x')) { mdb.remove(); disk.remove(); return; }
        mdb.style.display = 'grid';
        disk.remove();
      };
      dock.appendChild(disk);
      if (typeof ptfToast === 'function') ptfToast('پنجره به پایین صفحه رفت — با کلیک برمی‌گردد (اطلاعات حفظ شد)', 'ok');
    }
    mdb._mxMinimize = mxMinimize;

    var y = document.createElement('button');
    y.type = 'button';
    y.className = 'mx-dot y'; y.title = 'ارسال به پایین صفحه (اطلاعات حفظ می‌شود)'; y.setAttribute('aria-label', 'کوچک‌سازی پنجره');
    y.style.cssText = 'width:13px;height:13px;min-width:13px;min-height:13px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;background:#f0b429;flex:none';
    y.innerHTML = '<span>−</span>';
    y.onclick = function (e) { e.stopPropagation(); mxMinimize(); };

    var g = document.createElement('button');
    g.type = 'button';
    g.className = 'mx-dot g'; g.title = 'تمام‌صفحه / برگشت'; g.setAttribute('aria-label', 'تمام‌صفحه یا بازگشت پنجره');
    g.style.cssText = 'width:13px;height:13px;min-width:13px;min-height:13px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;background:#61c454;flex:none';
    g.innerHTML = '<span>⤢</span>';
    g.onclick = function (e) { e.stopPropagation(); md.classList.toggle('mx-full'); };

    bar.appendChild(r); bar.appendChild(y); bar.appendChild(g);

    var _t = (md.querySelector('h3') ? md.querySelector('h3').textContent : '');
    if (/کالا|پیشنهاد|استعلام|نامه|قرارداد|فاکتور|TO|CO|TC|RFQ/i.test(_t) && typeof goPanel === 'function') {
      var a = document.createElement('button');
      a.className = 'mx-dot a';
      a.type = 'button';
      a.title = 'انتقال به دستیار هوشمند (این پنجره با اطلاعاتش به پایین صفحه می‌رود)';
      a.setAttribute('aria-label', 'انتقال پنجره به دستیار هوشمند');
      a.style.cssText = 'width:13px;height:13px;min-width:13px;min-height:13px;border-radius:50%;border:0;padding:0;margin:0;cursor:pointer;background:#8b5cf6;flex:none';
      a.innerHTML = '<span>🤖</span>';
      a.onclick = function (e) { e.stopPropagation(); mxMinimize(); goPanel('ai'); };
      bar.appendChild(a);
    }
    md.appendChild(bar);
  }

  function scan(root) {
    (root || document).querySelectorAll('.md-b, .ptfdlg-b').forEach(equip);
  }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j];
        if (n.nodeType !== 1) continue;
        if (n.classList && (n.classList.contains('md-b') || n.classList.contains('ptfdlg-b'))) equip(n);
        else if (n.querySelectorAll) scan(n);
      }
    }
  });
  function boot() {
    mo.observe(document.body, { childList: true, subtree: true });
    scan(document);
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

})();
