/* =====================================================================
   PTF CRM — kanban.js — v16.4 — US-369 (نسخه نهایی کارفرما)
   کانبان وضعیت برای «درخواست‌ها» و «پیشنهاد» — نه مشتریان.
   اصول (شرط کارفرما: بدون وصله‌پینه):
   - فقط «نمای دوم» روی داده موجود — هیچ منطق وضعیت جدیدی ساخته نشده:
     درگ کارت درخواست  → همان هسته ptfRfqSetStatus (bridge.js — همان مسیر saveRfqStatus
                          با تمام اثرات جانبی: waiting/notify/audit/سینک سایت)
     درگ کارت پیشنهاد → همان offerSetSt (offers.js — با تمام گاردها:
                          confirm برنده + قفل، confirm عدم‌تایید TO، مهاجرت ۶وضعیتی US-367)
   - بج‌های موجود روی کارت‌ها: مهلت US-348 (ptfRfqDueState)، ضمایم US-388،
     «منتظر صدور» (ptfRfqWaitBadge)، اعتبار CO (offerValidState)، →CO قفل/بسته.
   - نمای انتخابی per-user در ptf_crm_settings.kanbanView (الگوی dashOrder — سینک بین دستگاه‌ها).
   - موبایل: اسکرول افقی ستون‌ها + درگ لمسی با نگه‌داشتن ۳۰۰ms (الگوی موتور درگ لانچر v12.9).
   - کارت CO «برنده» قفل است و درگ نمی‌شود (همان قاعده جدول).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- نمای per-user (الگوی dashOrder در launcher.js) ---------- */
  function myUser() { try { return curSession().user || '_'; } catch (e) { return '_'; } }
  function getView(mod) {
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      return ((st.kanbanView || {})[myUser()] || {})[mod] || 'table';
    } catch (e) { return 'table'; }
  }
  function saveView(mod, v) {
    try {
      var st = {};
      try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
      st.kanbanView = st.kanbanView || {};
      st.kanbanView[myUser()] = st.kanbanView[myUser()] || {};
      st.kanbanView[myUser()][mod] = v;
      setData('ptf_crm_settings', st);
    } catch (e) {}
  }

  /* ---------- استایل ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.kb-wrap{display:flex;gap:10px;overflow-x:auto;padding:6px 2px 16px;align-items:flex-start;-webkit-overflow-scrolling:touch}' +
    '.kb-col{min-width:225px;flex:0 0 225px;background:#f8fafc;border:1px solid var(--brd,#e2e8f0);border-radius:14px;padding:8px;transition:box-shadow .15s,border-color .15s}' +
    '.kb-col.kb-over{border-color:var(--org,#f79400);box-shadow:0 0 0 2px rgba(247,148,0,.25)}' +
    '.kb-ch{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:800;padding:4px 6px 8px;color:var(--tx,#334155)}' +
    '.kb-cnt{background:#e2e8f0;color:#475569;border-radius:999px;font-size:10.5px;padding:1px 8px}' +
    '.kb-card{background:var(--crd,#fff);border:1px solid var(--brd,#e2e8f0);border-radius:12px;padding:8px 10px;margin-bottom:8px;cursor:grab;font-size:12.5px;line-height:1.9;box-shadow:0 1px 3px rgba(15,23,42,.05);user-select:none}' +
    '.kb-card:active{cursor:grabbing}' +
    '.kb-card.kb-lock{cursor:default;background:#f0fdf4;border-color:#a7f3d0}' +
    '.kb-card .kb-t{font-weight:800;font-size:12.5px}' +
    '.kb-card small{color:#94a3b8}' +
    '.kb-card .bd{font-size:10px;padding:1px 7px}' +
    '.kb-ph{opacity:.35;border-style:dashed}' +
    '.kb-ghost{position:fixed;z-index:6000;pointer-events:none;transform:rotate(2deg) scale(1.04);opacity:.95;box-shadow:0 18px 44px rgba(15,23,42,.3);width:210px}' +
    '.kb-empty{color:#94a3b8;font-size:11.5px;text-align:center;padding:14px 4px;border:1.5px dashed var(--brd,#e2e8f0);border-radius:10px}' +
    '@media(max-width:768px){.kb-col{min-width:200px;flex-basis:200px}}';
  document.head.appendChild(css);

  /* ---------- دکمه تعویض نما (تزریق در نوار ابزار پنل) ---------- */
  function ensureToggle(mod, holderSel) {
    var bar = document.querySelector(holderSel);
    if (!bar || document.getElementById('kbTgl-' + mod)) return;
    var v = getView(mod);
    bar.insertAdjacentHTML('beforeend',
      '<span id="kbTgl-' + mod + '" style="display:inline-flex;gap:0;border:1.5px solid var(--brd);border-radius:10px;overflow:hidden">' +
      '<button type="button" id="kbTglT-' + mod + '" onclick="ptfKbSetView(\'' + mod + '\',\'table\')" style="border:0;padding:8px 12px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:' + (v === 'table' ? 'var(--org,#f79400)' : 'transparent') + ';color:' + (v === 'table' ? '#fff' : '#475569') + '" title="نمای جدول">📋 جدول</button>' +
      '<button type="button" id="kbTglK-' + mod + '" onclick="ptfKbSetView(\'' + mod + '\',\'kanban\')" style="border:0;padding:8px 12px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;background:' + (v === 'kanban' ? 'var(--org,#f79400)' : 'transparent') + ';color:' + (v === 'kanban' ? '#fff' : '#475569') + '" title="نمای کانبان — درگ کارت = تغییر وضعیت">🗂 کانبان</button></span>');
  }

  window.ptfKbSetView = function (mod, v) {
    saveView(mod, v);
    ['T', 'K'].forEach(function (k) {
      var b = document.getElementById('kbTgl' + k + '-' + mod);
      if (!b) return;
      var on = (k === 'T' && v === 'table') || (k === 'K' && v === 'kanban');
      b.style.background = on ? 'var(--org,#f79400)' : 'transparent';
      b.style.color = on ? '#fff' : '#475569';
    });
    apply(mod);
  };

  /* ---------- سوییچ نما: جدول موجود مخفی/نمایان + رندر کانبان ---------- */
  function apply(mod) {
    var tbId = mod === 'rfq' ? 'rTb' : 'oTb';
    var tb = document.getElementById(tbId);
    if (!tb) return;
    var tb2 = tb.closest('.tb2');
    if (!tb2) return;
    var kb = document.getElementById('kbWrap-' + mod);
    if (!kb) {
      tb2.insertAdjacentHTML('afterend', '<div id="kbWrap-' + mod + '" style="display:none"></div>');
      kb = document.getElementById('kbWrap-' + mod);
    }
    var v = getView(mod);
    if (v === 'kanban') {
      tb2.style.display = 'none';
      kb.style.display = '';
      kb.innerHTML = mod === 'rfq' ? rfqKanbanHtml() : offKanbanHtml();
    } else {
      tb2.style.display = '';
      kb.style.display = 'none';
    }
  }

  function esc(s) { return (typeof escP === 'function') ? escP(s) : String(s == null ? '' : s); }

  /* ---------- کانبان درخواست‌ها (AC1) — ستون‌ها = PTF_RFQ_STATUSES موجود ---------- */
  function rfqKanbanHtml() {
    var STS = window.PTF_RFQ_STATUSES || [];
    if (!STS.length) return '<div class="kb-empty">وضعیت‌ها هنوز بارگذاری نشده — یک بار دیگر وارد ماژول شوید</div>';
    var rfqs = getData('ptf_crm_rfqs');
    var offers = getData('ptf_crm_offers');
    var q = ((document.getElementById('rSrch') || {}).value || '').trim().toLowerCase();
    var cols = STS.map(function (s) {
      var cards = rfqs.filter(function (r) {
        if ((r.st || 'st1') !== s.v) return false;
        return !q || ((r.cd || '') + ' ' + (r.co || '') + ' ' + (r.subj || '')).toLowerCase().indexOf(q) > -1;
      });
      var ch = cards.map(function (r) {
        /* بج‌های موجود (AC3): مهلت US-348 + ضمایم US-388 + منتظر صدور + منبع سایت */
        var due = (typeof ptfRfqDueState === 'function') ? ptfRfqDueState(r) : null;
        var dueB = due ? '<span class="bd" style="background:' + (due.bg || '#f1f5f9') + ';color:' + due.cl + '">' + due.lb + '</span> ' : '';
        var nAtt = 0;
        try { Object.keys(r.files || {}).forEach(function (k2) { nAtt += (r.files[k2] || []).length; }); } catch (e) {}
        var attB = nAtt ? '<span class="bd" style="background:#ede9fe;color:#6d28d9">📎 ' + nAtt + '</span> ' : '';
        var waitB = (typeof ptfRfqWaitBadge === 'function') ? ptfRfqWaitBadge(r, offers) : '';
        var srcB = r.src === 'site' ? '<span class="bd" style="background:#e0f2fe;color:#0369a1">🌐</span> ' : '';
        return '<div class="kb-card" data-id="' + esc(r.cd) + '" data-st="' + s.v + '" onpointerdown="ptfKbDown(event,this,\'rfq\')">' +
          '<div class="kb-t">' + esc(r.cd) + '</div>' +
          '<div>' + esc(r.co || '-') + (r.con ? ' <small>(' + esc(r.con) + ')</small>' : '') + '</div>' +
          '<div><small>' + esc(r.dt || '') + '</small></div>' +
          '<div>' + srcB + dueB + attB + waitB + '</div></div>';
      }).join('');
      return '<div class="kb-col" data-st="' + s.v + '" data-lb="' + esc(s.t) + '">' +
        '<div class="kb-ch"><span>' + esc(s.t) + '</span><span class="kb-cnt">' + cards.length + '</span></div>' +
        (ch || '<div class="kb-empty">—</div>') + '</div>';
    }).join('');
    return '<div style="font-size:11.5px;color:#64748b;margin:2px 0 4px">💡 کارت را بکشید و در ستون وضعیت جدید رها کنید — همان گردش کار جدول (اعلان/سینک سایت) اجرا می‌شود. کلیک/تپ = باز کردن پرونده.</div>' +
      '<div class="kb-wrap">' + cols + '</div>';
  }

  /* ---------- کانبان پیشنهادها (AC2) — ستون‌ها = وضعیت‌های موجود TO/CO ---------- */
  function offKanbanHtml() {
    var tab = window._offKindTab || 'TO';
    if (tab === 'ALL') return '<div class="kb-empty" style="padding:22px">🗂 کانبان روی تب «همه» فعال نیست — تب «پیشنهادهای فنی» یا «مالی» را انتخاب کنید (هر نوع، چرخه وضعیت خودش را دارد).</div>';
    var isTO = tab === 'TO';
    /* همان دیکشنری‌های وضعیت موجود — TO شش‌گانه US-367 / CO پنج‌گانه */
    var STS = isTO
      ? [{ v: 'draft', t: '📝 پیش‌نویس' }, { v: 'registered', t: '📋 ثبت‌شده' }, { v: 'sent', t: '📤 ارسال‌شده' }, { v: 'approved', t: '✅ تاییدشده' }, { v: 'revise', t: '✏️ درخواست اصلاح' }, { v: 'rejected', t: '⛔ عدم تایید' }]
      : [{ v: 'draft', t: '📝 پیش‌نویس' }, { v: 'sent', t: '📤 ارسال‌شده' }, { v: 'revise', t: '✏️ در حال اصلاح' }, { v: 'won', t: '🏆 برنده' }, { v: 'lost', t: '❌ بازنده' }];
    var all = getData('ptf_crm_offers');
    var q = ((document.getElementById('oFsrch') || {}).value || '').trim().toLowerCase();
    var custF = window._offCustFilter || ((document.getElementById('oFcust') || {}).value) || '';
    var offers = all.filter(function (o) {
      if (o.kind !== tab && !(tab === 'CO' && o.kind === 'TC')) return false; /* TC کنار CO — همان چرخه CO را دارد */
      if (custF && typeof ptfOfferMatchCust === 'function' && !ptfOfferMatchCust(o, custF)) return false; /* v21.3 US-450 */
      return !q || ((o.no || '') + ' ' + (o.buyerCo || '') + ' ' + (o.inqNo || '')).toLowerCase().indexOf(q) > -1;
    });
    function stOf(o) {
      if (o.kind !== 'TO') return o.st || 'draft';
      if (o.st === 'won') return 'approved'; /* همان مهاجرت نرم toStMigrate (US-367) */
      if (o.st === 'lost') return 'rejected';
      return o.st || 'draft';
    }
    var cols = STS.map(function (s) {
      var cards = offers.filter(function (o) { return stOf(o) === s.v; });
      var ch = cards.map(function (o) {
        var isWon = o.kind !== 'TO' && o.st === 'won';
        var total = ((o.kind === 'CO' || o.kind === 'TC') && o.items) ? o.items.reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0) : 0;
        var totalLb = total ? ((typeof ptfMoney === 'function') ? ptfMoney(total, o.currency) : total.toLocaleString('fa-IR') + ' ریال') : '';
        var vst = (typeof offerValidState === 'function') ? offerValidState(o) : null;
        var vB = vst ? '<span class="bd" style="background:' + vst.cl + '">' + vst.lb + '</span> ' : '';
        var toCoB = '';
        if (o.kind === 'TO') {
          if (stOf(o) === 'rejected') toCoB = '<span class="bd" style="background:#fef2f2;color:#b91c1c" title="عدم تایید — مسیر CO بسته (US-367)">→CO ⛔</span> ';
          else if (o.coNo && all.some(function (x) { return x.no === o.coNo; })) toCoB = '<span class="bd" style="background:#f1f5f9;color:#94a3b8">→CO 🔒</span> ';
        }
        var lockB = isWon ? '<span class="bd" style="background:#d1fae5;color:#065f46">🏆 قفل 🔒</span> ' : '';
        return '<div class="kb-card' + (isWon ? ' kb-lock' : '') + '" data-id="' + esc(o.no) + '" data-st="' + s.v + '"' + (isWon ? ' data-lock="1"' : '') + ' onpointerdown="ptfKbDown(event,this,\'off\')">' +
          '<div class="kb-t">' + esc(o.no) + (o.rev ? ' <small>Rev.' + o.rev + '</small>' : '') + ' <small>' + (o.kind === 'TO' ? '🔧' : o.kind === 'TC' ? '🤝' : '💰') + '</small></div>' +
          '<div>' + esc(o.buyerCo || '-') + '</div>' +
          '<div><small>' + esc(o.inqNo || '') + (o.dateFa ? ' — ' + esc(o.dateFa) : '') + '</small></div>' +
          '<div>' + (totalLb ? '<b style="font-size:11.5px">' + totalLb + '</b> ' : '') + lockB + vB + toCoB + '</div>' +
          '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap" onclick="event.stopPropagation()">' +
          '<button class="bt bt-o" style="padding:2px 7px;font-size:10.5px" onpointerdown="event.stopPropagation()" onclick="offerQuickPreview(\'' + esc(o.no) + '\')">👁 نمایش</button>' +
          '<button class="bt bt-o" style="padding:2px 7px;font-size:10.5px" onpointerdown="event.stopPropagation()" onclick="offerPickTemplate(\'' + esc(o.no) + '\')">🖨 قالب/دانلود</button>' +
          '</div></div>';
      }).join('');
      return '<div class="kb-col" data-st="' + s.v + '" data-lb="' + esc(s.t) + '">' +
        '<div class="kb-ch"><span>' + esc(s.t) + '</span><span class="kb-cnt">' + cards.length + '</span></div>' +
        (ch || '<div class="kb-empty">—</div>') + '</div>';
    }).join('');
    return '<div style="font-size:11.5px;color:#64748b;margin:2px 0 4px">💡 درگ کارت = همان تغییر وضعیت جدول با تمام گاردها (تایید برنده/قفل، عدم تایید TO). کارت 🏆 برنده قفل است. کلیک/تپ = ویرایش.</div>' +
      '<div class="kb-wrap">' + cols + '</div>';
  }

  /* ---------- موتور درگ (الگوی pointer لانچر v12.9 — ماوس فوری، لمس با نگه‌داشتن) ---------- */
  window.ptfKbDown = function (e, card, mod) {
    if (e.button !== undefined && e.button !== 0) return;
    if (card.getAttribute('data-lock') === '1') {
      /* کارت قفل (CO برنده): درگ ممنوع — کلیک = پیام همان قاعده جدول */
      var upL = function (ev) {
        document.removeEventListener('pointerup', upL);
        if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 8 && typeof ptfToast === 'function') ptfToast('🏆 وضعیت برنده قفل است و قابل بازگشت نیست', 'warn');
      };
      document.addEventListener('pointerup', upL);
      return;
    }
    var isTouch = e.pointerType === 'touch';
    var sx = e.clientX, sy = e.clientY;
    var started = false, ghost = null, pressT = null, overCol = null;
    var allowDrag = !isTouch; /* لمس: بعد از نگه‌داشتن ۳۰۰ms (AC5) */
    if (isTouch) {
      pressT = setTimeout(function () {
        allowDrag = true;
        startDrag(sx, sy);
        try { if (navigator.vibrate) navigator.vibrate(35); } catch (err) {}
      }, 300);
    }
    function startDrag(x, y) {
      if (started) return;
      started = true;
      var r = card.getBoundingClientRect();
      ghost = card.cloneNode(true);
      ghost.removeAttribute('onpointerdown');
      ghost.className = 'kb-card kb-ghost';
      ghost.style.left = r.left + 'px';
      ghost.style.top = r.top + 'px';
      ghost._dx = x - r.left;
      ghost._dy = y - r.top;
      document.body.appendChild(ghost);
      card.classList.add('kb-ph');
      document.body.style.userSelect = 'none';
    }
    function mv(ev) {
      if (ev.pointerId !== e.pointerId) return;
      if (!started) {
        var moved = Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy);
        if (!allowDrag) { if (moved > 12) cleanup(); return; } /* لمس: حرکت زودهنگام = اسکرول */
        if (moved < 6) return;
        startDrag(ev.clientX, ev.clientY);
      }
      if (ev.cancelable) ev.preventDefault();
      ghost.style.left = (ev.clientX - ghost._dx) + 'px';
      ghost.style.top = (ev.clientY - ghost._dy) + 'px';
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var col = el && el.closest ? el.closest('.kb-col') : null;
      if (overCol && overCol !== col) overCol.classList.remove('kb-over');
      overCol = col;
      if (col) col.classList.add('kb-over');
    }
    function up(ev) {
      if (ev.pointerId !== e.pointerId) return;
      var wasStarted = started;
      var dropCol = overCol;
      cleanup();
      if (wasStarted) {
        if (dropCol && dropCol.getAttribute('data-st') !== card.getAttribute('data-st')) {
          kbDrop(mod, card.getAttribute('data-id'), dropCol.getAttribute('data-st'), dropCol.getAttribute('data-lb'));
        }
      } else {
        /* کلیک/تپ ساده = باز کردن (همان دکمه‌های جدول) */
        var id = card.getAttribute('data-id');
        if (mod === 'rfq') { if (typeof editRfq === 'function') editRfq(id); }
        else { if (typeof offerEdit === 'function') offerEdit(id); }
      }
    }
    function cleanup() {
      if (pressT) { clearTimeout(pressT); pressT = null; }
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      if (ghost && ghost.parentNode) ghost.remove();
      ghost = null;
      if (overCol) overCol.classList.remove('kb-over');
      overCol = null;
      card.classList.remove('kb-ph');
      document.body.style.userSelect = '';
      started = false;
    }
    function cancel(ev) { if (ev.pointerId === e.pointerId) cleanup(); }
    document.addEventListener('pointermove', mv, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
  };

  /* ---------- رها کردن = همان توابع وضعیت موجود (هیچ منطق موازی) ---------- */
  function kbDrop(mod, id, st, lb) {
    if (mod === 'rfq') {
      if (typeof ptfRfqSetStatus === 'function') {
        ptfRfqSetStatus(id, st, lb); /* همان هسته saveRfqStatus — waiting/notify/سینک سایت */
        if (typeof renderRfq === 'function') renderRfq();
      }
    } else {
      if (typeof offerSetSt === 'function') {
        offerSetSt(id, st, null); /* همان گاردها: confirm برنده/قفل، confirm عدم تایید TO */
        if (typeof renderOffers === 'function') renderOffers(); /* وضعیت‌های ساده CO رندر ندارند — تازه‌سازی کانبان */
      }
    }
  }

  /* ---------- hookهای رندر: بعد از هر رندر جدول، نما اعمال شود ---------- */
  function hook() {
    if (window._kbHooked) return true;
    if (typeof window.renderRfq !== 'function' || typeof window.renderOffers !== 'function') return false;
    window._kbHooked = true;
    var _rr = window.renderRfq;
    window.renderRfq = function () {
      _rr();
      /* گارد پنل: فقط وقتی جدول درخواست‌ها واقعا در DOM است (رندرهای پس‌زمینه بی‌اثر) */
      if (!document.getElementById('rTb')) return;
      try { ensureToggle('rfq', '#panels .ph .sb2'); apply('rfq'); } catch (e) {}
    };
    var _ro = window.renderOffers;
    window.renderOffers = function () {
      _ro();
      if (!document.getElementById('oTb')) return;
      try { ensureToggle('off', '#panels .ph .sb2'); apply('off'); } catch (e) {}
    };
    /* جستجوی درخواست‌ها (filterRfq فقط ردیف‌های جدول را فیلتر می‌کند) — در نمای کانبان، کارت‌ها هم فیلتر شوند */
    if (typeof window.filterRfq === 'function') {
      var _fr = window.filterRfq;
      window.filterRfq = function () {
        _fr();
        try { if (getView('rfq') === 'kanban' && document.getElementById('kbWrap-rfq')) apply('rfq'); } catch (e) {}
      };
    }
    return true;
  }
  var tries = 0;
  var t = setInterval(function () { tries++; if (hook() || tries > 50) clearInterval(t); }, 300);
})();
