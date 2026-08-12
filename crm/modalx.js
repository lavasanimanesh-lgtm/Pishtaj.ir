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

  /* =================================================================
     MOB-007 — قرارداد سراسری دسترس‌پذیری مودال
     بیش از 50 فایل، overlayهای .md-b تولید می‌کنند؛ مهاجرت تک‌به‌تک آنها
     هم پرریسک و هم ناقص است. این لایه روی هر overlay تازه semantics، focus
     اولیه/بازگشت focus، Tab trap و Escape برای «فقط بالاترین پنجره» اعمال می‌کند.
     dialogx از قبل trap/Escape مخصوص Promise خود دارد؛ فقط focus بازگشتی آن
     زیر نظر این لایه است تا resolve آن دست‌نخورده بماند.
     ================================================================= */
  var _modalA11ySeq = 0;
  var _modalKeyBound = false;

  function modalVisible(overlay) {
    if (!overlay || !overlay.isConnected) return false;
    var cs = window.getComputedStyle ? window.getComputedStyle(overlay) : null;
    return (!cs || (cs.display !== 'none' && cs.visibility !== 'hidden')) && overlay.getClientRects().length > 0;
  }
  function modalDialog(overlay) {
    return overlay ? (overlay.querySelector('.md') || overlay.querySelector('.ptfdlg')) : null;
  }
  function isDialogxOverlay(overlay) {
    return !!(overlay && overlay.querySelector('.dx-h, .dx-bts'));
  }
  function topModalOverlay() {
    var all = document.querySelectorAll('.md-b, .ptfdlg-b');
    var top = null, topZ = -Infinity;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!modalVisible(el)) continue;
      var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      var z = parseInt((cs && cs.zIndex) || (el.style && el.style.zIndex) || '0', 10);
      if (isNaN(z)) z = 0;
      /* در z برابر، modal بعدی در DOM روی قبلی قرار گرفته است. */
      if (!top || z >= topZ) { top = el; topZ = z; }
    }
    return top;
  }
  function isFocusable(el) {
    if (!el || el.disabled || el.getAttribute('tabindex') === '-1') return false;
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !cs || (cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0);
  }
  function modalFocusables(dialog) {
    if (!dialog) return [];
    var nodes = dialog.querySelectorAll('a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < nodes.length; i++) if (isFocusable(nodes[i])) out.push(nodes[i]);
    return out;
  }
  function focusElement(el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
  }
  function focusModal(overlay, force) {
    if (!overlay || !modalVisible(overlay) || isDialogxOverlay(overlay)) return;
    var dialog = modalDialog(overlay);
    if (!dialog) return;
    if (!force && dialog.contains(document.activeElement)) return;
    var fields = dialog.querySelectorAll('[autofocus],input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"]');
    for (var i = 0; i < fields.length; i++) {
      if (isFocusable(fields[i])) { focusElement(fields[i]); return; }
    }
    var items = modalFocusables(dialog);
    focusElement(items[0] || dialog);
  }
  function restoreModalFocus(overlay) {
    if (!overlay || overlay._ptfFocusReturned) return;
    overlay._ptfFocusReturned = true;
    var previous = overlay._ptfReturnFocus;
    setTimeout(function () {
      var top = topModalOverlay();
      if (top) { focusModal(top, true); return; }
      if (previous && previous.isConnected && !previous.disabled) focusElement(previous);
    }, 0);
  }
  function closeModalOverlay(overlay, force) {
    if (!overlay || (!force && !modalVisible(overlay))) return false;
    var dialog = modalDialog(overlay);
    /* dialogx Promise خود را باید resolve کند: برای confirm/prompt = cancel،
       و برای alert = دکمهٔ تایید. */
    if (isDialogxOverlay(overlay)) {
      var dxButton = dialog && (dialog.querySelector('.dx-cl') || dialog.querySelector('.dx-ok'));
      if (dxButton) { dxButton.click(); return true; }
    }
    /* ptfDialog برای Cancel callback دارد؛ Escape و نقطهٔ قرمز همان مسیر را می‌روند. */
    if (overlay.classList.contains('ptfdlg-b')) {
      var cancel = dialog && dialog.querySelector('.cancel');
      if (cancel) { cancel.click(); return true; }
    }
    overlay.remove();
    return true;
  }
  function applyModalA11y(overlay, dialog) {
    if (!overlay || !dialog) return;
    if (!overlay._ptfA11yReady) {
      overlay._ptfA11yReady = true;
      var active = document.activeElement;
      overlay._ptfReturnFocus = active && active !== document.body ? active : null;
      /* dialogx trap/Promise اختصاصی خود را نگه می‌دارد، اما title semantics
         باید برای آن هم کامل باشد. */
      if (!dialog.getAttribute('role')) dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
      var title = dialog.querySelector('h1,h2,h3,h4,.dx-t');
      if (title) {
        if (!title.id) title.id = 'ptfModalTitle' + (++_modalA11ySeq);
        dialog.setAttribute('aria-labelledby', title.id);
      } else if (!dialog.getAttribute('aria-label')) dialog.setAttribute('aria-label', 'پنجرهٔ گفت‌وگو');
    }
    if (!isDialogxOverlay(overlay)) {
      window.requestAnimationFrame(function () {
        setTimeout(function () { if (topModalOverlay() === overlay) focusModal(overlay, false); }, 20);
      });
    }
  }
  window.ptfFocusModalOverlay = function (overlay) { focusModal(overlay, true); };
  window.ptfCloseModalOverlay = closeModalOverlay;

  function onModalKeydown(ev) {
    var overlay = topModalOverlay();
    if (!overlay || isDialogxOverlay(overlay)) return; /* dialogx Promise خودش handler دارد */
    var dialog = modalDialog(overlay);
    if (!dialog) return;
    if (ev.key === 'Escape') {
      if (overlay.getAttribute('data-ptf-escape') === 'off') return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      closeModalOverlay(overlay);
      return;
    }
    if (ev.key !== 'Tab') return;
    var items = modalFocusables(dialog);
    ev.preventDefault();
    if (!items.length) { focusElement(dialog); return; }
    var current = items.indexOf(document.activeElement);
    var next = current < 0 ? (ev.shiftKey ? items.length - 1 : 0) : (current + (ev.shiftKey ? -1 : 1) + items.length) % items.length;
    focusElement(items[next]);
  }

  /* ---------- استایل (کلاسیک مک — بالا چپ، دایره ۱۳px) ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.mx-dots{position:absolute;top:12px;left:14px;display:flex;gap:7px;z-index:20;direction:ltr;align-items:center;margin:0;padding:0;background:transparent;border:0;box-shadow:none;transform:none;inset:auto;right:auto;bottom:auto}' +
    '.mx-dot{width:13px;height:13px;min-width:13px;min-height:13px;max-width:13px;max-height:13px;border-radius:50%;border:0;cursor:pointer;padding:0;margin:0;transition:filter .15s;flex:none;line-height:0;box-shadow:none}' +
    '.mx-dot:hover{filter:brightness(.85)}' +
    '.mx-dot:focus-visible{outline:3px solid #2563eb;outline-offset:2px;filter:none}' +
    '.md[role="dialog"],.ptfdlg[role="dialog"]{outline:none}' +
    '.mx-dot.r{background:#e5655c}.mx-dot.y{background:#f0b429}.mx-dot.g{background:#61c454}' +
    '.mx-dot{position:relative}' +
    '.mx-dot span{display:none;position:absolute;inset:0;font-size:9.5px;line-height:13px;text-align:center;font-weight:900;color:rgba(0,0,0,.7);pointer-events:none}' +
    '.mx-dots:hover .mx-dot span{display:block}' +
    'body.ptf-dark .mx-dot span{display:block;color:#0f172a}' +
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
    applyModalA11y(mdb, md);
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
    r.onclick = function (e) { e.stopPropagation(); closeModalOverlay(mdb); };

    function mxMinimize() {
      var title = (md.querySelector('h3') ? md.querySelector('h3').textContent : 'پنجره').trim().slice(0, 34);
      if (mdb.parentNode !== document.body) document.body.appendChild(mdb);
      mdb.style.display = 'none';
      var disk = document.createElement('div');
      disk.className = 'mx-disk';
      disk.tabIndex = 0;
      disk.setAttribute('role', 'button');
      disk.setAttribute('aria-label', 'بازگردانی پنجره ' + title);
      disk.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;background:#f0b429;flex:none"></span><span style="overflow:hidden;text-overflow:ellipsis">' + title.replace(/</g, '&lt;') + '</span><span class="x" title="بستن کامل">✕</span>';
      function restoreFromDock() {
        mdb.style.display = 'grid';
        disk.remove();
        setTimeout(function () { focusModal(mdb, true); }, 0);
      }
      disk.onclick = function (ev) {
        if (ev.target.classList.contains('x')) { closeModalOverlay(mdb, true); disk.remove(); return; }
        restoreFromDock();
      };
      disk.onkeydown = function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); restoreFromDock(); }
        if (ev.key === 'Escape') { ev.preventDefault(); closeModalOverlay(mdb, true); disk.remove(); }
      };
      dock.appendChild(disk);
      focusElement(disk);
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
  function restoreRemovedModal(node) {
    if (!node || node.nodeType !== 1) return;
    /* minimize یک overlay را از #panels به body منتقل می‌کند؛ آن close نیست.
       یک tick صبر می‌کنیم تا move از remove واقعی تفکیک شود. */
    setTimeout(function () {
      if (node.isConnected) return;
      if (node.classList && (node.classList.contains('md-b') || node.classList.contains('ptfdlg-b'))) restoreModalFocus(node);
      if (node.querySelectorAll) node.querySelectorAll('.md-b, .ptfdlg-b').forEach(restoreModalFocus);
    }, 0);
  }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      for (var r = 0; r < muts[i].removedNodes.length; r++) restoreRemovedModal(muts[i].removedNodes[r]);
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
    if (!_modalKeyBound) {
      _modalKeyBound = true;
      document.addEventListener('keydown', onModalKeydown, true);
    }
    scan(document);
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

})();
