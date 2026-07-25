/* =====================================================================
   PTF CRM — tables.js — Sprint 87 — US-199
   بهبود جداول پنل‌ها (فهرست مشتریان/تامین‌کنندگان/کالاها/...):
   - وسط‌چین یکدست: سرستون و مقادیر هر ستون هم‌مرکز
   - تغییر عرض ستون با درگ لبه سرستون
   - فریز (سنجاق 📌) هر ستون هنگام اسکرول افقی
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- استایل سراسری ---------- */
  var css = document.createElement('style');
  css.textContent =
    /* US-199 AC1: وسط‌چین یکدست سرستون + سلول (به جز ستون‌های عملیات) */
    '.tb2 th,.tb2 td{text-align:center!important;vertical-align:middle}' +
    '.pn table th,.pn table td{text-align:center;vertical-align:middle}' +
    /* ریسایز */
    '.tb2 th{position:relative}' +
    '.th-rz{position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:col-resize;z-index:5}' +
    '.th-rz:hover{background:rgba(239,75,26,.25)}' +
    /* فریز */
    '.tb2{overflow-x:auto}' +
    'th.col-frozen,td.col-frozen{position:sticky;right:0;background:#fff;z-index:3;box-shadow:-4px 0 6px -4px rgba(15,23,42,.15)}' +
    'thead th.col-frozen{z-index:4;background:#f1f5f9}' +
    'body.ptf-dark th.col-frozen,body.ptf-dark td.col-frozen{background:#1e293b}' +
    '.th-pin{cursor:pointer;font-size:10px;opacity:.35;margin-right:3px}' +
    '.th-pin:hover{opacity:1}.th-pin.on{opacity:1;color:#ef4b1a}';
  document.head.appendChild(css);

  /* ---------- تجهیز جدول‌ها ---------- */
  function enhance(tbl) {
    if (tbl.getAttribute('data-enh')) return;
    var thead = tbl.querySelector('thead');
    if (!thead) return;
    var ths = thead.querySelectorAll('th');
    if (ths.length < 3) return;
    tbl.setAttribute('data-enh', '1');
    tbl.style.tableLayout = 'auto';
    ths.forEach(function (th, ci) {
      // AC2: دستگیره تغییر عرض
      if (!th.querySelector('.th-rz')) {
        var rz = document.createElement('span');
        rz.className = 'th-rz';
                function startRz(e) {
          if (e && e.preventDefault) e.preventDefault();
          if (e && e.stopPropagation) e.stopPropagation();
          var target = e.target || e.srcElement;
          var startX = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0) || e.clientX || 0;
          var startW = th.offsetWidth;
          if (target && target.setPointerCapture && e.pointerId !== undefined) {
            try { target.setPointerCapture(e.pointerId); } catch(err){}
          }
          function mv(e2) {
            if (e2 && e2.buttons !== undefined && e2.buttons === 0) { up(e2); return; }
            var curX = e2.pageX || (e2.touches && e2.touches[0] ? e2.touches[0].pageX : 0) || e2.clientX || 0;
            if (!curX && curX !== 0) return;
            th.style.minWidth = th.style.width = Math.max(50, startW + (startX - curX)) + 'px';
          }
          function up(e3) {
            if (target && target.releasePointerCapture && e.pointerId !== undefined) {
              try { target.releasePointerCapture(e.pointerId); } catch(err){}
            }
            document.removeEventListener('mousemove', mv);
            document.removeEventListener('mouseup', up);
            document.removeEventListener('mouseleave', up);
            document.removeEventListener('visibilitychange', up);
            document.removeEventListener('dragend', up);
            document.removeEventListener('mouseout', viewportOut);
            window.removeEventListener('blur', up);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            window.removeEventListener('dragend', up);
            window.removeEventListener('mouseout', viewportOut);
            document.removeEventListener('pointermove', mv);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
          }
          function viewportOut(e4) {
            e4 = e4 || window.event;
            var to = e4.relatedTarget || e4.toElement;
            if (!to) up(e4);
          }
          document.addEventListener('mousemove', mv);
          document.addEventListener('mouseup', up);
          document.addEventListener('mouseleave', up);
          document.addEventListener('visibilitychange', up);
          document.addEventListener('dragend', up);
          document.addEventListener('mouseout', viewportOut);
          window.addEventListener('blur', up);
          window.addEventListener('mouseup', up);
          window.addEventListener('pointerup', up);
          window.addEventListener('pointercancel', up);
          window.addEventListener('dragend', up);
          window.addEventListener('mouseout', viewportOut);
          document.addEventListener('pointermove', mv);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
        }
        rz.addEventListener('pointerdown', startRz);
        rz.addEventListener('mousedown', function(e) { if(e.pointerId === undefined) startRz(e); });
        rz.addEventListener('dragstart', function(e) { if(e&&e.preventDefault)e.preventDefault(); return false; });
        th.appendChild(rz);
      }
      // AC3: سنجاق فریز
      if (!th.querySelector('.th-pin')) {
        var pin = document.createElement('span');
        pin.className = 'th-pin';
        pin.textContent = '📌';
        pin.title = 'فریز/آزادسازی این ستون هنگام اسکرول افقی';
        pin.onclick = function (e) {
          e.stopPropagation();
          var on = !pin.classList.contains('on');
          // آزادسازی فریز قبلی همین جدول
          tbl.querySelectorAll('.col-frozen').forEach(function (c) { c.classList.remove('col-frozen'); });
          tbl.querySelectorAll('.th-pin.on').forEach(function (p) { p.classList.remove('on'); });
          if (on) {
            pin.classList.add('on');
            th.classList.add('col-frozen');
            tbl.querySelectorAll('tbody tr').forEach(function (tr) {
              var td = tr.children[ci];
              if (td) td.classList.add('col-frozen');
            });
          }
        };
        th.insertBefore(pin, th.firstChild);
      }
    });
  }

  function scan() {
    try {
      document.querySelectorAll('#panels table').forEach(function (t) {
        // فقط جدول‌های فهرست (داخل tb2 یا با tbody پر)
        if (t.closest('.md-b')) return; // نه داخل مودال‌ها
        enhance(t);
      });
      // بعد از رندر مجدد (innerHTML جدید) دوباره تجهیز شود
    } catch (e) {}
  }
  setInterval(scan, 1200);
})();
