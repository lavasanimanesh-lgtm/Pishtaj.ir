/* =====================================================================
   PTF CRM — Sprint 69 (bridge.js)
   US-133: اتصال واقعی سایت ↔ CRM (تامین‌کننده + استعلام از سایت)
   US-136: بازطراحی ثبت RFQ + رفع باگ تغییر وضعیت + انتقال به پیشنهادها
   US-137: مشتریان (حقیقی/حقوقی)
   US-138: صندوق پیام لحظه‌ای + کارتابل زیر داشبورد + دینگ
   US-139: جریان ارجاع درخواست
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/crm.php';
  var SALES_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales'];
  var RFQ_CATS = ['پایپینگ', 'شیرآلات', 'برق', 'ابزار دقیق', 'پمپ و کمپرسور', 'گسکت و آب‌بندی', 'سایر'];
  var RFQ_STATUSES = [
    { v: 'st1', t: '🔴 دریافت اولیه' },
    { v: 'st2', t: '🔵 بررسی فنی' },
    { v: 'stTO', t: '🔧 صدور پیشنهاد فنی (TO)' },
    { v: 'stCO', t: '💰 صدور پیشنهاد مالی (CO)' },
    { v: 'st3', t: '🟡 تایید' },
    { v: 'st4', t: '🟢 پیش‌فاکتور' },
    { v: 'st5', t: '🔵 ابلاغ سفارش' },
    { v: 'st8', t: '🏭 در حال تامین توسط تامین‌کننده' }, /* v17.3 US-413 (کیس R8) */
    { v: 'st9', t: '📦 تحویل تامین‌کننده' },             /* v17.3 US-413 */
    { v: 'st6', t: '🟠 آماده‌سازی' },
    { v: 'st7', t: '✅ تحویل شده' },
    { v: 'stX', t: '⛔ لغو / مختومه' }
  ];
  var REF_ACTS = ['صدور پیشنهاد فنی (TO)', 'صدور پیشنهاد مالی (CO)', 'استعلام قیمت از تامین‌کننده', 'بررسی و اظهارنظر']; /* v12.6 US-312 */
  window.PTF_RFQ_STATUSES = RFQ_STATUSES; /* v16.4 (US-369): منبع واحد ستون‌های کانبان درخواست‌ها */

  function api(action, data, cb) {
    var opt = { method: 'POST', headers: { 'X-CRM-Role': (typeof curRole === 'function' ? curRole() : 'sales') } };
    // v31.7.7 HOTFIX-AUTH: Include JWT token in all API requests.
    // Previously this function only sent X-CRM-Role header without token,
    // causing 401 on all authenticated endpoints (push_event, set_status, etc).
    try {
      var _tok = localStorage.getItem('ptf_crm_token');
      if (_tok) opt.headers['X-CRM-Token'] = _tok;
    } catch(e) {}
    if (data) {
      var fd = new FormData();
      Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
      opt.body = fd;
    }
    fetch(API + '?action=' + action, opt)
      .then(function (r) { return r.json(); })
      .then(function (d) { cb && cb(d); })
      .catch(function () { cb && cb({ ok: false, offline: true }); });
  }

  /* Cloud attachment metadata from public site forms. Legacy string values are
     intentionally retained as legacy-host references; they are never deleted or
     silently treated as cloud objects. */
  function siteAttachmentMeta(v) {
    if (!v) return null;
    if (typeof v === 'object' && v.key) return { key: String(v.key), name: String(v.name || v.key), size: +v.size || 0, cloud: true };
    return { key: '', name: String(v), size: 0, cloud: false };
  }
  function siteJsArg(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  function siteAttachmentHtml(v) {
    var a = siteAttachmentMeta(v);
    if (!a) return '<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">📎 پیوستی همراه این درخواست ارسال نشده است.</div>';
    if (!a.cloud) return '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 14px;font-size:12.5px;margin-bottom:10px;color:#9a3412">📎 <b>پیوست قدیمیِ هاست:</b> <span dir="ltr">' + escP(a.name) + '</span><br><small>این رکورد پیش از سیاست «فقط فضای ابری» ثبت شده است. برای جلوگیری از حذف ناخواسته، خودکار پاک یا جابه‌جا نشده؛ انتقال آن باید پس از گزارش و تایید مدیر انجام شود.</small></div>';
    return '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;font-size:12.5px;margin-bottom:10px;color:#065f46">☁️ <b>پیوست در فضای ابری:</b> <span dir="ltr">' + escP(a.name) + '</span>' + (a.size ? ' <small>(' + a.size.toLocaleString('fa-IR') + ' بایت)</small>' : '') + '<br><button class="bt bt-o" style="margin-top:7px;font-size:11.5px" onclick="openStoredFile(\'' + siteJsArg(a.key) + '\',\'' + siteJsArg(a.name) + '\')">👁 مشاهده / دانلود از فضای ابری</button></div>';
  }

  /* ============ صدای دینگ (US-138 AC5) ============ */
  var _actx = null;
  function ding() {
    try {
      _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = _actx.currentTime;
      [880, 1318.5].forEach(function (f, i) {
        var o = _actx.createOscillator(), g = _actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.45);
        o.connect(g); g.connect(_actx.destination);
        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.5);
      });
    } catch (e) { /* بدون صدا ادامه بده */ }
  }

  /* ============ US-138: صندوق پیام ============ */
  function addMsg(opt) {
    // پیام محلی بدون عبور از notify (برای رویدادهای سروری تا audit دوباره ثبت نشود)
    opt = opt || {};
    if (typeof ntfNeedsAction === 'function') {
      if (typeof NTF_ACTION_KINDS !== 'undefined' && NTF_ACTION_KINDS.indexOf(opt.kind || '') > -1) opt.actionable = true;
      if (!ntfNeedsAction(opt)) return null;
    } else if (!opt.actionable) {
      return null;
    }
    var notifs = getData('ptf_crm_notifs');
    var rec = {
      cd: genCode('NTF'), t: faDateTime(), iso: new Date().toISOString(),
      from: opt.from || 'سیستم', fromRole: opt.fromRole || '',
      toRoles: opt.toRoles || [], toUsers: opt.toUsers || [],
      title: opt.title, body: opt.body || '', kind: opt.kind || 'info',
      channels: ['cart'], link: opt.link || null,
      readBy: [], actionable: true, done: false,
      remCd: opt.remCd || null, refCd: opt.refCd || null, taskType: opt.taskType || null,
      dkey: opt.dkey || null
    };
    notifs.unshift(rec);
    if (notifs.length > 1000) notifs = notifs.slice(0, 1000);
    setData('ptf_crm_notifs', notifs);
    return rec;
  }

  function isMine(n) {
    var me = curSession();
    return (n.toUsers || []).indexOf(me.user) > -1;
  }
  function isHighlighted(n) { return n.actionable && isMine(n); }

  window.updateInboxBadge = function () {
    var me = curSession().user;
    var unread = myNotifs().filter(function (n) {
      if ((n.readBy || []).indexOf(me) > -1 || n.done) return false;
      return typeof ntfNeedsAction === 'function' ? ntfNeedsAction(n) : !!n.actionable;
    }).length;
    var b = document.getElementById('ibBadge');
    if (b) { b.textContent = unread > 99 ? '99+' : unread; b.style.display = unread ? 'grid' : 'none'; }
    if (typeof updateCartBadge === 'function') updateCartBadge();
    if (typeof updateGroupBadges === 'function') updateGroupBadges();
  };

  window.toggleInbox = function () {
    var p = document.getElementById('inboxPanel');
    if (!p) return;
    var open = p.style.display !== 'none';
    p.style.display = open ? 'none' : 'block';
    if (!open) renderInbox();
  };

  window.renderInbox = function () {
    var p = document.getElementById('inboxList');
    if (!p) return;
    var me = curSession().user;
    var list = myNotifs().filter(function (n) {
      return typeof ntfNeedsAction === 'function' ? ntfNeedsAction(n) : !!n.actionable;
    }).slice(0, 40);
    if (!list.length) { p.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:22px;font-size:13px">اقدام بازی ندارید</div>'; return; }
    var h = '';
    list.forEach(function (n) {
      var unread = (n.readBy || []).indexOf(me) < 0;
      var hl = isHighlighted(n);
      h += '<div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;' +
        (hl ? 'background:#fff7ed;border-right:4px solid #f79400;' : unread ? 'background:#f8fafc;' : '') + '">' +
        '<div style="font-size:12.5px;font-weight:' + (unread ? '800' : '500') + ';color:#1e293b">' +
        (hl ? '⭐ ' : '') + escP(n.title) + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' + escP(n.t) + (n.from && n.from !== 'سیستم' ? ' — ' + escP(n.from) : '') + '</div>' +
        '<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">' +
        (unread ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="ntfReadIB(\'' + n.cd + '\')">✓ خواندم</button>' : '') +
        (n.link && n.link.panel ? '<button class="bt" style="padding:3px 9px;font-size:11px" onclick="ntfGoIB(\'' + n.cd + '\')">↗ برو</button>' : '') +
        (n.remCd ? '<button class="bt" style="padding:3px 9px;font-size:11px;background:#059669" onclick="remDoneIB(\'' + n.remCd + '\',\'' + n.cd + '\')">✅ انجام شد</button>' +
          '<button class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="remPostponeIB(\'' + n.remCd + '\',\'' + n.cd + '\')">🕓 موکول</button>' : '') +
        '</div></div>';
    });
    p.innerHTML = h;
  };

  window.ntfReadIB = function (cd) { ntfRead(cd); renderInbox(); updateInboxBadge(); };
  window.ntfGoIB = function (cd) { toggleInbox(); ntfGo(cd); updateInboxBadge(); };
  window.remDoneIB = function (remCd, ntfCd) {
    remDone(remCd); ntfRead(ntfCd); renderInbox(); updateInboxBadge();
    addLog('یادآور انجام شد');
  };
  window.remPostponeIB = function (remCd, ntfCd) {
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '🕓 موکول کردن یادآور',
        fields: [
          { id: 'days', label: 'چند روز موکول شود؟', type: 'select', options: [{v:'1',lb:'۱ روز'},{v:'3',lb:'۳ روز'},{v:'7',lb:'۱ هفته'},{v:'14',lb:'۲ هفته'}] },
          { id: 'reason', label: 'دلیل موکول کردن (اختیاری)', type: 'textarea', rows: 2 }
        ],
        onOk: function (v) { remPostponeCommit(remCd, ntfCd, parseInt(v.days, 10), v.reason); }
      });
      return;
    }
    var d = prompt('چند روز موکول شود؟ (عدد)', '3');
    var n = parseInt(d, 10);
    if (!n || n < 1) return;
    remPostponeCommit(remCd, ntfCd, n, prompt('دلیل (اختیاری):', '') || '');
  };
  window.remPostponeCommit = function (remCd, ntfCd, n, reason) {
    if (!n || n < 1) return;
    var rems = getData('ptf_crm_reminders');
    rems.forEach(function (r) {
      if (r.cd === remCd) {
        var nd = new Date(r.dueISO < todayISO() ? todayISO() : r.dueISO);
        nd.setDate(nd.getDate() + n);
        r.dueISO = nd.toISOString().slice(0, 10);
        r.dueFa = gDateToFa(r.dueISO);
        r.msgSent = false;
        r.notifiedUsers = {};
        if (reason) r.note = (r.note ? r.note + ' | ' : '') + 'موکول: ' + reason;
      }
    });
    setData('ptf_crm_reminders', rems);
    ntfRead(ntfCd); renderInbox(); updateInboxBadge();
    if (typeof audit === 'function') audit('یادآورها', 'موکول کردن یادآور' + (reason ? ' — دلیل: ' + reason : ''), remCd);
  };

  // US-157 AC2: پیام خودکار CO های در حال انقضا — فقط در لحظه‌ی گذار (ورود به بازه‌ی
  // هشدار / گذشتن سررسید)، نه هر روز — طبق بازنگری استاندارد اعلانات (دستور کارفرما v33.4.1):
  // اعلانات اطلاعی نباید هر روز تکرار شوند؛ یک‌بار در هر گذار کافی است و بعداً به‌صورت
  // خودکار از کارتابل محو می‌شود (ptfPruneStaleNotifs در rbac.js).
  function checkOfferExpiry() {
    var s = curSession();
    if (!s.user) return false;
    var offers = getData('ptf_crm_offers');
    var today = new Date().toISOString().slice(0, 10);
    var warn = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    var changed = false, added = false;
    offers.forEach(function (o) {
      if (o.kind !== 'CO' || !o.validUntil || o.st === 'won' || o.st === 'lost') return;
      var due = o.validUntil <= warn;
      if (!due) return;
      var expired = o.validUntil < today;
      /* پیشنهاد منقضی یا رو به انقضا کارتابل/روز من نیست؛ تصمیم آن در خود ماژول پیشنهادها ثبت می‌شود. */
      if (expired) { if (o.expiryNotifyStage !== 'expired') { o.expiryNotifyStage = 'expired'; changed = true; } return; }
      if (o.expiryNotifyStage === 'warn') return;
      o.expiryNotifyStage = 'warn'; changed = true;
      /* صرفاً ثبت stage برای منطق داخلی؛ هیچ اعلان مزاحمی تولید نمی‌شود. */
    });
    if (changed) setData('ptf_crm_offers', offers);
    return added;
  }


  /* v14.6 (US-348) → v33.4.1 (بازنگری استاندارد اعلانات): یادآور خودکار مهلت پاسخ
     درخواست — فقط یک‌بار در لحظه‌ی گذار به بازه‌ی هشدار/گذشتن مهلت، نه هر روز.
     پیگیری مستمر (تا رفع) به «☀️ روز من» سپرده می‌شود؛ خودِ اعلان بعد از مدتی
     خودکار از کارتابل محو می‌شود (ptfPruneStaleNotifs). */
  function checkRfqDue() {
    var s = curSession();
    if (!s.user) return false;
    var rfqs = getData('ptf_crm_rfqs');
    var changed = false, added = false;
    rfqs.forEach(function (r) {
      if (!r.dueISO) return;
      var due = (typeof ptfRfqDueState === 'function') ? ptfRfqDueState(r) : null;
      if (!due || !due.bg) { if (r.dueNotified) { r.dueNotified = ''; changed = true; } return; } /* فقط پنجره هشدار (۲ روز مانده تا گذشته) */
      var stage = due.over ? 'over' : 'warn';
      if (r.dueNotified === stage) return; /* v33.4.1: فقط در لحظه‌ی گذار، نه هر روز */
      r.dueNotified = stage;
      changed = true; added = true;
      var assignee = r.assignee && r.assignee.user ? [r.assignee.user] : [];
      addMsg({
        title: (due.over ? '🔴 مهلت پاسخ درخواست ' + r.cd + ' گذشته است!' : '⏳ مهلت پاسخ درخواست ' + r.cd + ' نزدیک است (' + r.dueISO + ')') + (r.co ? ' — ' + r.co : ''),
        toUsers: assignee,
        toRoles: assignee.length ? [] : SALES_ROLES,
        kind: 'reminder',
        actionable: true,
        refCd: r.cd,
        dkey: 'rfq-due-' + r.cd,
        link: { panel: 'rfq' }
      });
    });
    if (changed) setData('ptf_crm_rfqs', rfqs);
    return added;
  }

  /* v14.8 (US-351) → v33.4.1: یادآور/هشدار تاریخ تحویل تعهدی پرونده فروش — فقط
     یک‌بار در لحظه‌ی گذار به بازه‌ی هشدار/گذشتن سررسید، نه هر روز (همان اصل بالا). */
  function checkDealDue() {
    var s = curSession();
    if (!s.user) return false;
    var deals = getData('ptf_crm_deals');
    var today = new Date().toISOString().slice(0, 10);
    var changed = false, added = false;
    deals.forEach(function (r) {
      if (!r.dueISO || r.st === 'archived') return;
      var st = (typeof ptfSfDueState === 'function') ? ptfSfDueState(r) : null;
      if (!st) { if (r.dueNotified) { r.dueNotified = ''; changed = true; } return; } /* فقط پنجره هشدار: ≤۳ روز مانده یا گذشته */
      var over = st === 'red' && r.dueISO < today;
      var stage = over ? 'over' : st === 'red' ? 'today' : 'warn';
      if (r.dueNotified === stage) return; /* v33.4.1: فقط در لحظه‌ی گذار، نه هر روز */
      r.dueNotified = stage;
      changed = true; added = true;
      addMsg({
        title: (over ? '🚨 تاخیر در تحویل تعهدی پرونده ' + (r.inqNo || r.cd) + '! (تعهد: ' + r.dueISO + ')'
          : st === 'red' ? '🚚⏰ امروز سررسید تحویل تعهدی پرونده ' + (r.inqNo || r.cd) + ' است'
          : '🚚⏳ تحویل تعهدی پرونده ' + (r.inqNo || r.cd) + ' نزدیک است (' + r.dueISO + ')') +
          (r.buyerCo ? ' — ' + r.buyerCo : '') + (r.dueNote ? ' | ' + r.dueNote : ''),
        toRoles: over ? ['admin', 'chairman', 'ceo', 'commercial'] : SALES_ROLES,
        kind: 'reminder',
        actionable: true,
        refCd: r.cd,
        dkey: 'deal-due-' + r.cd,
        link: { panel: 'deals' }
      });
    });
    if (changed) setData('ptf_crm_deals', deals);
    return added;
  }


  // یادآورهای سررسیدشده → پیام صندوق (US-138 AC6)
  function checkDueReminders() {
    var s = curSession();
    if (!s.user) return false;
    var rems = getData('ptf_crm_reminders');
    var changed = false, added = false;
    rems.forEach(function (r) {
      if (!(r.st === 'open' && r.dueISO <= todayISO())) return;
      var targets = [];
      if (r.ownerUser) targets.push(r.ownerUser);
      (r.shareUsers || []).forEach(function (u) { if (u && targets.indexOf(u) < 0) targets.push(u); });
      // سازگاری با داده‌های قدیمی: اگر ownerUser نداریم فقط سازنده فعلی را هدف بگیر
      if (!targets.length && r.by === s.name) targets.push(s.user);
      if (!targets.length) return;
      r.notifiedUsers = r.notifiedUsers || {};
      targets.forEach(function (u) {
        if (r.notifiedUsers[u]) return;
        addMsg({
          title: '⏰ یک یادآوری داری: ' + r.title,
          body: 'سررسید: ' + (r.dueFa || r.dueISO) + (r.note ? ' — ' + r.note : ''),
          toUsers: [u], kind: 'reminder', actionable: true, remCd: r.cd,
          link: { panel: 'rem' }
        });
        r.notifiedUsers[u] = todayISO();
        added = true; changed = true;
      });
      r.msgSent = Object.keys(r.notifiedUsers || {}).length >= targets.length;
    });
    if (changed) setData('ptf_crm_reminders', rems);
    return added;
  }

  /* ============ US-138 AC5: رویدادهای لحظه‌ای سرور ============ */
  function lastEvt() { return parseInt(localStorage.getItem('ptf_evt_last') || '0', 10); }
  function setLastEvt(v) { localStorage.setItem('ptf_evt_last', String(v)); }

  function processEvent(ev) {
    var me = curSession();
    var d = ev.data || {};
    if (d.byUser && d.byUser === me.user) return false; // خود فرستنده پیام تکراری نگیرد
    if (ev.kind === 'supplier_site') {
      /* ثبت‌نام سایت در پنل «در انتظار تایید» دیده می‌شود؛ کارتابل را شلوغ نمی‌کند. */
      if (isSenior()) { syncServerInbox(); return true; }
      return false;
    }
    if (ev.kind === 'rfq_site') {
      if (isSenior()) { syncServerInbox(); return true; }
      return false;
    }
    if (ev.kind === 'referral') {
      var mine = d.to === me.user;
      if (!mine) return false;
      addMsg({
        title: '📨 ' + ev.title,
        from: d.byName || 'سیستم',
        toRoles: [],
        toUsers: [me.user],
        kind: 'referral', actionable: true,
        refCd: d.code || '', taskType: d.taskType || '',
        dkey: 'referral|' + (d.code || ev.id || '') + '|' + (d.to || '') + '|' + (d.taskType || d.act || ''),
        link: { panel: 'rfq' }
      });
      return SALES_ROLES.indexOf(curRole()) > -1 || mine;
    }
    if (ev.kind === 'status') {
      return false;
    }
    return false;
  }

  function pollEvents() {
    var s = curSession();
    if (!s.user) return;
    // v31.7.7 HOTFIX-AUTH: Include JWT token in event polling.
    var _evtH = {};
    try { var _t = localStorage.getItem('ptf_crm_token'); if (_t) _evtH['X-CRM-Token'] = _t; } catch(e) {}
    fetch(API + '?action=get_events&since=' + lastEvt(), { headers: _evtH })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        var newMsg = false;
        (d.events || []).forEach(function (ev) { if (processEvent(ev)) newMsg = true; });
        if (d.last) setLastEvt(d.last);
        if (checkDueReminders()) newMsg = true;
        if (checkOfferExpiry()) newMsg = true;
        if (checkRfqDue()) newMsg = true; /* v14.6 US-348 */
        if (checkDealDue()) newMsg = true; /* v14.8 US-351 */
        if (newMsg) {
          ding();
          updateInboxBadge();
          var p = document.getElementById('inboxPanel');
          if (p && p.style.display !== 'none') renderInbox();
          if (document.getElementById('ctWrap')) renderCartable();
        }
      })
      .catch(function () { if (checkDueReminders()) { ding(); updateInboxBadge(); } });
  }

  function pushEvent(kind, title, data) {
    var me = curSession();
    data = data || {};
    data.byUser = me.user; data.byName = me.name;
    api('push_event', { kind: kind, title: title, data: JSON.stringify(data) }, null);
  }

  /* ============ US-133: سینک صندوق سروری (تامین‌کننده + RFQ سایت) ============ */
  window.syncServerInbox = function (cb) {
    // v31.7.7 HOTFIX-AUTH: Include JWT token in inbox sync.
    var _syncH = {};
    try { var _t = localStorage.getItem('ptf_crm_token'); if (_t) _syncH['X-CRM-Token'] = _t; } catch(e) {}
    fetch(API + '?action=get_inbox', { headers: _syncH })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { cb && cb(false); return; }
        localStorage.setItem('ptf_site_suppliers', JSON.stringify(d.suppliers || []));
        localStorage.setItem('ptf_site_rfqs', JSON.stringify(d.rfqs || []));
        if (document.getElementById('supPendWrap')) renderSupPending();
        if (document.getElementById('rfqPendWrap')) renderRfqPending();
        cb && cb(true);
      })
      .catch(function () { cb && cb(false); });
  };
  function siteSuppliers() { try { return JSON.parse(localStorage.getItem('ptf_site_suppliers') || '[]'); } catch (e) { return []; } }
  function siteRfqs() { try { return JSON.parse(localStorage.getItem('ptf_site_rfqs') || '[]'); } catch (e) { return []; } }

  /* ---- تامین‌کنندگان: بخش «ثبت‌نام‌شده از سایت» ---- */
  var _buildSup = window.buildSuppliers;
  window.buildSuppliers = function () {
    return '<div id="supPendWrap"></div>' +
      '<h4 style="margin:4px 0 10px;font-size:14px">✅ فهرست تامین‌کنندگان تاییدشده</h4>' + _buildSup();
  };
  var _renderSup = window.renderSuppliers;
  window.renderSuppliers = function () {
    if (typeof _renderSup === 'function') _renderSup();
    else if (typeof renderSuppliers2 === 'function') renderSuppliers2();
    renderSupPending();
  };

  window.renderSupPending = function () {
    var el = document.getElementById('supPendWrap');
    if (!el) return;
    var pend = siteSuppliers().filter(function (s) { return s.status === 'pending'; });
    var rejected = siteSuppliers().filter(function (s) { return s.status === 'rejected'; }).length;
    if (!pend.length) {
      el.innerHTML = '<div style="background:#f8fafc;border:1px dashed var(--brd);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#64748b">🌐 ثبت‌نام جدیدی از سایت در انتظار بررسی نیست' + (rejected ? ' <small>(' + rejected + ' مورد رد شده)</small>' : '') + ' — <a href="javascript:void(0)" onclick="syncServerInbox()" style="color:#0e7490">بروزرسانی</a></div>';
      return;
    }
    var h = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:14px;margin-bottom:16px">' +
      '<h4 style="margin:0 0 10px;font-size:13.5px;color:#c2410c">🌐 ثبت‌نام‌شده از سایت — در انتظار تایید (' + pend.length + ')</h4>' +
      '<div class="tb2"><table><thead><tr><th>شماره یکتا</th><th>شرکت</th><th>مسئول</th><th>تماس</th><th>حوزه</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>';
    pend.forEach(function (s) {
      h += '<tr><td><b>' + escP(s.code) + '</b></td><td>' + escP(s.company) + '</td><td>' + escP(s.name || '-') + '</td>' +
        '<td style="direction:ltr">' + escP(s.phone || '-') + '</td><td style="font-size:11px">' + escP(s.category || '-') + '</td><td style="font-size:11px">' + escP(s.date || '-') + '</td><td>' +
        (isSenior()
          ? '<button class="bt" style="padding:4px 10px;font-size:12px;background:#059669" onclick="supApprove(\'' + ptfOnClickArg(s.code) + '\')">✅ تایید</button> ' +
            '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626" onclick="supReject(\'' + ptfOnClickArg(s.code) + '\')">✖ رد</button>'
          : '<span style="font-size:11px;color:#94a3b8">فقط مدیران ارشد</span>') +
        '</td></tr>';
    });
    el.innerHTML = h + '</tbody></table></div></div>';
  };

  window.supApprove = function (code) {
    var s = siteSuppliers().filter(function (x) { return x.code === code; })[0];
    if (!s) return;
    if (!confirm('تامین‌کننده «' + s.company + '» تایید و به فهرست تاییدشده اضافه شود؟')) return;
    var items = getData('ptf_crm_suppliers');
    if (!items.some(function (x) { return x.cd === code; })) {
      var recSup = { cd: code, co: s.company, nm: s.name, ph: s.phone, ca: s.category, brands: s.brands || '', email: s.email || '', src: 'site', approvedBy: curSession().name, approvedAt: faDateTime() };
      // US-174: هشدار تکراری بودن با فهرست تاییدشده (تصمیم نهایی با مدیر ارشد)
      if (typeof ptfCheckDup === 'function') {
        var dups = ptfCheckDup('supplier', recSup, null);
        if (dups.length && !confirm(dedupMsg(dups) + '\n\n⚠️ با این حال، این ثبت‌نام سایت تایید و به‌عنوان رکورد جدید اضافه شود؟')) return;
      }
      if (typeof dedupStamp === 'function') dedupStamp(recSup);
      items.unshift(recSup);
      setData('ptf_crm_suppliers', items);
    }
    api('set_status', { type: 'supplier', code: code, status: 'approved', statusText: 'تایید شد — به فهرست تامین‌کنندگان تاییدشده اضافه شدید', by: curSession().name }, function () { syncServerInbox(); });
    if (typeof audit === 'function') audit('تامین‌کنندگان', 'تایید تامین‌کننده سایت: ' + s.company, code);
    notify({ toRoles: SENIOR_ROLES, title: '✅ تامین‌کننده «' + s.company + '» (' + code + ') توسط ' + curSession().name + ' تایید شد', kind: 'supplier_ok', channels: ['cart'], link: { panel: 'sup' } });
    renderSuppliers();
    updateInboxBadge();
  };

  window.supReject = function (code) {
    var s = siteSuppliers().filter(function (x) { return x.code === code; })[0];
    if (!s) return;
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '✖ رد تامین‌کننده ' + s.company,
        fields: [{ id: 'reason', label: 'دلیل رد (در رهگیری به تامین‌کننده نمایش داده می‌شود)', type: 'textarea', rows: 2, value: 'عدم تطابق با نیازمندی‌های فعلی' }],
        danger: true, okText: 'رد ثبت‌نام',
        onOk: function (v) { supRejectCommit(code, v.reason); }
      });
      return;
    }
    var reason = prompt('دلیل رد:', 'عدم تطابق با نیازمندی‌های فعلی');
    if (reason === null) return;
    supRejectCommit(code, reason);
  };
  window.supRejectCommit = function (code, reason) {
    var s = siteSuppliers().filter(function (x) { return x.code === code; })[0];
    if (!s) return;
    api('set_status', { type: 'supplier', code: code, status: 'rejected', statusText: 'رد شد' + (reason ? ' — ' + reason : ''), by: curSession().name }, function () { syncServerInbox(); });
    if (typeof audit === 'function') audit('تامین‌کنندگان', 'رد تامین‌کننده سایت: ' + s.company, code);
    renderSuppliers();
  };

  /* ============ US-136: استعلامات — بازطراحی و رفع باگ ============ */

  window.editRfq = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var wf = r.wf || (typeof wfCompute === 'function' ? wfCompute(r) : 'inq');
    var WF_MAP = (typeof WF !== 'undefined' ? WF : {});
    var wfInfo = WF_MAP[wf] || { lb: 'دریافت اولیه', cl: '#e2e8f0' };
    var log = (r.wfLog || []).slice().reverse().map(function (e) {
      var eInfo = WF_MAP[e.wf] || {};
      return '<div style="border-right:2px solid var(--brd);padding:3px 10px 3px 0;margin-bottom:4px;font-size:12px"><span style="color:#94a3b8">' + escP(e.t || '') + ' — ' + escP(e.by || '') + '</span> ' + escP(eInfo.lb || e.wf || '') + (e.ev ? ' <small style="color:#64748b">(' + escP(e.ev) + ')</small>' : '') + '</div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px">رویدادی ثبت نشده</div>';
    /* v17.3 (US-413): منبع واحد وضعیت‌ها — st8/st9 خودکار در ویرایش هم می‌آیند */
    var sts = (window.PTF_RFQ_STATUSES || []).filter(function (x) { return x.v !== 'stX'; }).map(function (x) { return { id: x.v, lb: x.t }; });
    var stOpts = sts.map(function(s){ return '<option value="' + s.id + '"' + ((r.st||'st1')===s.id ? ' selected':'') + '>' + s.lb + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:600px;max-height:92vh;overflow:auto">' +
      '<h3>✏️ ویرایش و گردش کار درخواست — ' + escP(cd) + '</h3>' +
      (function(){
        var cr = r.crBy || '';
        var crAt = r.crAt || '';
        if (!cr && !crAt) return '<div style="font-size:12px;color:#94a3b8;margin:-4px 0 10px">📝 ثبت‌کننده: نامشخص (قدیمی)</div>';
        var nm = cr;
        try { var u2 = (getData('ptf_crm_users')||[]).filter(function(x){return x.username===cr||x.user===cr;})[0]; if(u2) nm=u2.name||u2.nm||cr; } catch(e){}
        return '<div style="font-size:12px;color:#475569;margin:-4px 0 10px">📝 ثبت: <b>' + escP(nm||'—') + '</b>' + (crAt ? ' — ' + escP(crAt) : '') + '</div>';
      })() +
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:12px;color:#166534;margin-bottom:10px">قفل ویرایش برداشته شده است؛ شما می‌توانید مشخصات استعلام یا وضعیت آن را آزادانه ویرایش و ذخیره کنید.</div>' +
      '<div style="text-align:center;margin-bottom:12px"><span class="bd" style="background:' + wfInfo.cl + ';font-size:13px;padding:7px 16px">' + escP(wfInfo.lb) + '</span></div>' +
      '<div class="fld"><label>نام شرکت / مشتری</label><input type="text" id="er_co" value="' + escP(r.co||'') + '"></div>' +
      '<div class="fr"><div class="fld"><label>مسئول / رابط</label><input type="text" id="er_con" value="' + escP(r.con||'') + '"></div>' +
      '<div class="fld"><label>حوزه کاری</label><input type="text" id="er_ca" value="' + escP(r.ca||'') + '"></div></div>' +
      '<div class="fld"><label>موضوع / شرح</label><input type="text" id="er_subj" value="' + escP(r.subj||'') + '"></div>' +
      /* v14.6 (US-348): مهلت پاسخ در ویرایش هم قابل ثبت/اصلاح */
      '<div class="fld"><label>⏳ مهلت پاسخ به کارفرما (شمسی)</label>' + (typeof ptfDateInput==="function" ? ptfDateInput("er_due_j", r.dueISO||"") : '<input type="text" id="er_due_j" value="' + escP(r.dueISO||'') + '" style="direction:ltr;color:#b45309">') + '</div>' +
      /* v12.7 (US-314): اقلام استعلام — نمایش در همین مودال + دکمه ورود/ویرایش کامل */
      (function () {
        var its = getData('ptf_crm_inqitems').filter(function (x) { return x.inqNo === cd || x.cd === cd; });
        if (!its.length && r.items && r.items.length) its = r.items;
        var itRows = its.slice(0, 8).map(function (it, ii) {
          return '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed var(--brd);font-size:12px"><span>' + (ii + 1) + '. ' + escP(it.nm || it.name || '-') + '</span><span style="color:#64748b;white-space:nowrap">' + escP(String(it.qty || 1)) + ' ' + escP(it.un || it.unit || 'عدد') + '</span></div>';
        }).join('');
        return '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 14px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<b style="font-size:13px">📋 اقلام استعلام (' + its.length + ' قلم)</b>' +
          '<button type="button" class="bt bt-o" style="padding:4px 11px;font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="this.closest(\'.md-b\').remove();if(typeof ptfOpenFullInqEditor===\'function\')ptfOpenFullInqEditor(\'' + ptfOnClickArg(cd) + '\')">' + (its.length ? '✏️ ویرایش اقلام' : '+ ورود اقلام (دستی / اکسل / دستیار)') + '</button></div>' +
          (itRows || '<div style="color:#94a3b8;font-size:12px">قلمی ثبت نشده — با دکمه بالا وارد کنید تا «از درخواست» در پیشنهادها فعال شود</div>') +
          (its.length > 8 ? '<div style="color:#94a3b8;font-size:11px;margin-top:4px">… و ' + (its.length - 8) + ' قلم دیگر (در ویرایش اقلام)</div>' : '') +
          '</div>';
      })() +
      '<div class="fld"><label>وضعیت دستی</label><select id="er_st">' + stOpts + '</select></div>' +
      /* v15.7 (US-388 ②): ضمایم درخواست — مشاهده/دانلود مستقیم داخل مودال ویرایش */
      (function () {
        var cats = { inq: '📥 فایل استعلام', ds: '📊 دیتاشیت', img: '🖼 عکس کالا', dwg: '📐 نقشه', oth: '📎 سایر', cat: '📚 کاتالوگ' };
        var fh = '';
        var tot = 0;
        Object.keys(cats).forEach(function (k2) {
          ((r.files || {})[k2] || []).forEach(function (f2) {
            tot++;
            fh += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed var(--brd);font-size:12px">' +
              '<span>' + cats[k2] + ' — ' + escP(f2.name || '-') + '</span>' +
              (f2.key ? '<span style="white-space:nowrap"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f2.key) + '\')" style="color:#0e7490">👁 مشاهده</a> <a href="javascript:void(0)" onclick="ptfDownloadStoredFile(\'' + ptfOnClickArg(f2.key) + '\',\'' + ptfOnClickArg(f2.name || 'file') + '\')" style="color:#059669">⬇️ دانلود</a></span>' : '<small style="color:#94a3b8">صف محلی</small>') + '</div>';
          });
        });
        return '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 14px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:13px">📎 ضمایم درخواست (' + tot + ')</b>' +
          '<button type="button" class="bt bt-o" style="padding:4px 11px;font-size:12px;color:#6d28d9;border-color:#ddd6fe" onclick="ptfManageInqAttachments(\'' + ptfOnClickArg(cd) + '\')">＋ افزودن / مدیریت</button></div>' +
          (fh || '<div style="color:#94a3b8;font-size:12px">ضمیمه‌ای ثبت نشده — با دکمه بالا اضافه کنید</div>') + '</div>';
      })() +
      '<h4 style="margin:10px 0 6px;font-size:13px">🕓 تاریخچه گردش کار</h4>' + log +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;border-top:1px solid var(--brd);padding-top:10px">' +
      '<button class="bt bt-o" style="color:#dc2626;border-color:#fecaca" onclick="delRfq(\'' + ptfOnClickArg(cd) + '\')">🗑 حذف درخواست</button>' +
      '<div style="display:flex;gap:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>' +
      '<button class="bt" onclick="saveRfqEdit(\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره تغییرات</button></div></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.saveRfqEdit = function (cd) {
    var rfqs = getData('ptf_crm_rfqs');
    for (var i = 0; i < rfqs.length; i++) {
      if (rfqs[i].cd === cd) {
        rfqs[i].co = document.getElementById('er_co').value.trim();
        rfqs[i].con = document.getElementById('er_con').value.trim();
        rfqs[i].ca = document.getElementById('er_ca').value.trim();
        rfqs[i].subj = document.getElementById('er_subj').value.trim();
        var _erDue = document.getElementById('er_due'); /* v14.6 US-348 */
        if (_erDue || document.getElementById('er_due_j')) { var _newDue = (typeof ptfJToISO === 'function') ? ptfJToISO((document.getElementById('er_due_j')||{}).value||'') : (_erDue ? _erDue.value : ''); if (rfqs[i].dueISO !== _newDue) rfqs[i].dueNotified = ''; rfqs[i].dueISO = _newDue; }
        var sel = document.getElementById('er_st');
        if (sel) {
          rfqs[i].st = sel.value;
          rfqs[i].stxt = sel.options[sel.selectedIndex].text;
        }
        break;
      }
    }
    setData('ptf_crm_rfqs', rfqs);
    if (typeof audit === 'function') audit('استعلامات', 'ویرایش دستی درخواست ' + cd, cd);
    var md = document.querySelector('#panels .md-b:last-child');
    if (md) md.remove();
    if (typeof renderRfq === 'function') renderRfq();
    if (typeof ptfToast === 'function') ptfToast('تغییرات درخواست ذخیره شد ✅', 'ok');
  };

  /* ===== v19.7 (BUG-031 — ابلاغ کارفرما): حذف درخواست = حذف آبشاری همه وابسته‌ها.
     ریشه باگ: delRfq اسپرینت ۱۰۲ فقط رکورد rfqs را پاک می‌کرد — پیشنهاد/استعلام/خرید/پرونده
     یتیم می‌ماند و پرونده برنده به درخواست ناموجود اشاره می‌کرد (نقض توالی رویدادها).
     طرح مصوب: اسکن کامل + مودال شفاف + سدهای ایمنی (برنده/فاکتور=فقط ارشد | بایگانی=مسدود). ===== */
  window.ptfRfqCascadeScan = function (cd) {
    var rfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0] || {};
    var als = [cd];
    if (rfq.inqNo && als.indexOf(rfq.inqNo) < 0) als.push(rfq.inqNo); /* دو-شناسه‌ای US-386 */
    function inAls(v) { return v && als.indexOf(v) > -1; }
    var out = { aliases: als, offers: [], invoices: [], rfqsmart: [], buycmp: [], payables: [], deals: [], inqitems: 0, archived: [], hasWon: false, hasInvoice: false };
    getData('ptf_crm_offers').forEach(function (o) { if (inAls(o.inqNo)) { out.offers.push(o.no); if (o.st === 'won' && o.kind !== 'TO') out.hasWon = true; } });
    var offNos = {};
    getData('ptf_crm_offers').forEach(function (o) { if (inAls(o.inqNo)) offNos[o.no] = 1; });
    getData('ptf_crm_invoices').forEach(function (v) { if (offNos[v.offerNo]) { out.invoices.push(v.no || v.cd); out.hasInvoice = true; } });
    getData('ptf_crm_rfqsmart').forEach(function (q) { if (inAls(q.srcRfq)) out.rfqsmart.push(q.no); });
    getData('ptf_crm_buycmp').forEach(function (c) { if (inAls(c.inqNo)) out.buycmp.push(c.id); });
    getData('ptf_crm_payables').forEach(function (p) { if (inAls(p.inqNo)) out.payables.push(p.cd); });
    getData('ptf_crm_deals').forEach(function (d) { if (inAls(d.inqNo)) out.deals.push(d.cd); });
    getData('ptf_crm_inqitems').forEach(function (r) { if (inAls(r.inqNo)) out.inqitems++; });
    getData('ptf_crm_projects').forEach(function (p2) { if (inAls(p2.inqNo) && p2.state === 'archived') out.archived.push(p2.no); });
    return out;
  };
  /* هسته حذف آبشاری (قابل تست) — خروجی {ok, why} ؛ سد برنامه‌ای نه فقط UI (درس US-371) */
  window.ptfRfqCascadeDelete = function (cd) {
    var sc = ptfRfqCascadeScan(cd);
    if (sc.archived.length) return { ok: false, why: 'archived' }; /* بایگانی مختومه = سند نهایی — حذف مسدود */
    var senior = (typeof isSenior === 'function') ? isSenior() : false;
    if ((sc.hasWon || sc.hasInvoice) && !senior) return { ok: false, why: 'senior' };
    var als = sc.aliases;
    function inAls(v) { return v && als.indexOf(v) > -1; }
    var offNos = {};
    getData('ptf_crm_offers').forEach(function (o) { if (inAls(o.inqNo)) offNos[o.no] = 1; });
    setData('ptf_crm_offers', getData('ptf_crm_offers').filter(function (o) { return !inAls(o.inqNo); }));
    setData('ptf_crm_invoices', getData('ptf_crm_invoices').filter(function (v) { return !offNos[v.offerNo]; }));
    setData('ptf_crm_rfqsmart', getData('ptf_crm_rfqsmart').filter(function (q) { return !inAls(q.srcRfq); }));
    setData('ptf_crm_buycmp', getData('ptf_crm_buycmp').filter(function (c) { return !inAls(c.inqNo); }));
    setData('ptf_crm_payables', getData('ptf_crm_payables').filter(function (p) { return !inAls(p.inqNo); }));
    setData('ptf_crm_deals', getData('ptf_crm_deals').filter(function (d) { return !inAls(d.inqNo); }));
    setData('ptf_crm_inqitems', getData('ptf_crm_inqitems').filter(function (r) { return !inAls(r.inqNo); }));
    setData('ptf_crm_rfqs', getData('ptf_crm_rfqs').filter(function (x) { return x.cd !== cd; }));
    if (typeof audit === 'function') audit('استعلامات', 'حذف آبشاری درخواست ' + cd + ' (BUG-031): ' + sc.offers.length + ' پیشنهاد، ' + sc.invoices.length + ' فاکتور، ' + sc.rfqsmart.length + ' استعلام تامین، ' + sc.buycmp.length + ' جدول خرید، ' + sc.payables.length + ' بستانکاری، ' + sc.deals.length + ' پرونده فروش، ' + sc.inqitems + ' قلم', cd);
    return { ok: true, scan: sc };
  };
  /* ===== v19.8 (US-444 — ابلاغ کارفرما): پاکسازی یک‌باره زنجیره‌های یتیم موجود.
     یتیم = رکوردی که به درخواستی اشاره می‌کند که دیگر وجود ندارد (حذف‌های قبل از BUG-031).
     قاعده: «کل زنجیره پاک شود که چیزی یتیم نماند» — استثنا: زنجیره دارای بایگانی مختومه
     (سند نهایی) پاک نمی‌شود، فقط گزارش می‌شود (هم‌راستا با سد BUG-031). ===== */
  window.ptfOrphanScan = function () {
    var rfqKeys = {};
    getData('ptf_crm_rfqs').forEach(function (r) { rfqKeys[r.cd] = 1; if (r.inqNo) rfqKeys[r.inqNo] = 1; });
    var archivedKeys = {};
    getData('ptf_crm_projects').forEach(function (p) { if (p.state === 'archived' && p.inqNo) archivedKeys[p.inqNo] = 1; });
    var chains = {}; /* key = شماره درخواست ناموجود */
    function mark(key, fam) {
      if (!key || rfqKeys[key]) return null;
      if (!chains[key]) chains[key] = { key: key, offers: 0, invoices: 0, rfqsmart: 0, buycmp: 0, payables: 0, deals: 0, inqitems: 0, archived: !!archivedKeys[key] };
      chains[key][fam]++;
      return chains[key];
    }
    var orphanOfferNos = {};
    getData('ptf_crm_offers').forEach(function (o) { if (o.inqNo && !rfqKeys[o.inqNo]) { mark(o.inqNo, 'offers'); orphanOfferNos[o.no] = o.inqNo; } });
    getData('ptf_crm_invoices').forEach(function (v) { if (!v.orphaned && orphanOfferNos[v.offerNo]) mark(orphanOfferNos[v.offerNo], 'invoices'); });
    getData('ptf_crm_rfqsmart').forEach(function (q) { if (q.srcRfq) mark(q.srcRfq, 'rfqsmart'); });
    getData('ptf_crm_buycmp').forEach(function (c) { if (c.inqNo) mark(c.inqNo, 'buycmp'); });
    getData('ptf_crm_payables').forEach(function (p) { if (!p.orphaned && p.inqNo) mark(p.inqNo, 'payables'); });
    getData('ptf_crm_deals').forEach(function (d) { if (d.inqNo) mark(d.inqNo, 'deals'); });
    getData('ptf_crm_inqitems').forEach(function (r) { if (r.inqNo) mark(r.inqNo, 'inqitems'); });
    var all = Object.keys(chains).map(function (k) { return chains[k]; });
    return {
      purgeable: all.filter(function (c) { return !c.archived; }),
      protectedChains: all.filter(function (c) { return c.archived; })
    };
  };
  function orphanFingerprint(sc) {
    return JSON.stringify((sc.purgeable || []).map(function (c) { return [c.key, c.offers, c.invoices, c.rfqsmart, c.buycmp, c.payables, c.deals, c.inqitems]; }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); }));
  }
  window.ptfOrphanPreview = function () {
    var sc = ptfOrphanScan();
    var preview = { fingerprint: orphanFingerprint(sc), createdAt: faDateTime(), scan: sc };
    window._ptfOrphanPreview = preview;
    return preview;
  };
  window.ptfOrphanPurge = function (preview) {
    if (typeof isSenior === 'function' && !isSenior()) return { ok: false, why: 'senior' };
    var current = ptfOrphanPreview();
    if (!current.scan.purgeable.length) return { ok: true, purged: 0, quarantined: 0, chains: 0 };
    if (!preview || preview.fingerprint !== current.fingerprint) return { ok: false, why: 'preview-required' };
    var sc = current.scan;
    if (!sc.purgeable.length) return { ok: true, purged: 0, quarantined: 0, chains: 0 };
    // v30.3 FIN-WF-010: ایمن‌سازی حذف مالی زنجیره‌ای - چک قفل سال مالی
    function isLockedYear(y){
      try{
        var snaps=getData('ptf_crm_fiscal_snapshots')||[];
        return snaps.some(function(s){ return String(s.year)===String(y) && s.locked; });
      }catch(e){return false;}
    }
    function yearOfDate(d){
      if(!d) return '';
      if (typeof ptfFiscalYearOf === 'function') return ptfFiscalYearOf(d);
      var m=String(d).match(/(13|14)\d{2}/);
      return m?m[0]:'';
    }
    var keys = {};
    sc.purgeable.forEach(function (c) { keys[c.key] = 1; });
    var orphanOfferNos = {};
    getData('ptf_crm_offers').forEach(function (o) { if (o.inqNo && keys[o.inqNo]) orphanOfferNos[o.no] = 1; });
    var n = 0;
    var quarantined = 0;
    var skippedLocked = 0;
    function purge(storeKey, pred) {
      var a = getData(storeKey), b = a.filter(function (x) {
        if(!pred(x)) return true;
        // برای اسناد مالی، اگر سال قفل بود، پاک نکن
        if(storeKey==='ptf_crm_invoices' || storeKey==='ptf_crm_payables'){
          var y = yearOfDate(x.invDate||x.t||x.date||x.iso||'');
          if(y && isLockedYear(y)){ skippedLocked++; return true; }
          x.orphaned = true; x.orphanedAt = faDateTime(); x.orphanedBy = curSession().name; x.orphanReason = 'orphan-chain';
          quarantined++;
          return true;
        }
        return false;
      });
      n += a.length - b.length;
      setData(storeKey, b);
    }
    purge('ptf_crm_offers', function (o) { return o.inqNo && keys[o.inqNo]; });
    purge('ptf_crm_invoices', function (v) { return orphanOfferNos[v.offerNo]; });
    purge('ptf_crm_rfqsmart', function (q) { return q.srcRfq && keys[q.srcRfq]; });
    purge('ptf_crm_buycmp', function (c) { return c.inqNo && keys[c.inqNo]; });
    purge('ptf_crm_payables', function (p) { return p.inqNo && keys[p.inqNo]; });
    purge('ptf_crm_deals', function (d) { return d.inqNo && keys[d.inqNo]; });
    purge('ptf_crm_inqitems', function (r) { return r.inqNo && keys[r.inqNo]; });
    if (typeof audit === 'function') audit('استعلامات', 'پاکسازی یتیم‌ها: ' + sc.purgeable.length + ' زنجیره / ' + n + ' رکورد عملیاتی پاک شد / ' + quarantined + ' سند مالی قرنطینه شد — کلیدها: ' + sc.purgeable.map(function (c) { return c.key; }).join('، '), '');
    return { ok: true, purged: n, quarantined: quarantined, skippedLocked: skippedLocked, chains: sc.purgeable.length, keys: sc.purgeable.map(function (c) { return c.key; }) };
  };
  window.ptfOrphanReview = function () {
    if (typeof isSenior === 'function' && !isSenior()) { alert('⛔ فقط مدیران ارشد'); return; }
    var sc = ptfOrphanScan();
    function row(c) {
      var parts = [];
      if (c.offers) parts.push(c.offers + ' پیشنهاد');
      if (c.invoices) parts.push(c.invoices + ' فاکتور');
      if (c.rfqsmart) parts.push(c.rfqsmart + ' استعلام تامین');
      if (c.buycmp) parts.push(c.buycmp + ' جدول خرید');
      if (c.payables) parts.push(c.payables + ' بستانکاری');
      if (c.deals) parts.push(c.deals + ' پرونده فروش');
      if (c.inqitems) parts.push(c.inqitems + ' قلم');
      return '<div style="padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12.5px"><b dir="ltr">' + escP(c.key) + '</b> — ' + parts.join('، ') + '</div>';
    }
    var html = '<div class="md-b" id="orphDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:88vh;overflow:auto">' +
      '<h3>🧹 پاکسازی زنجیره‌های یتیم</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">رکوردهایی که به درخواست حذف‌شده اشاره می‌کنند (یادگار قبل از BUG-031). پس از پیش‌نمایش، رکوردهای عملیاتی پاک و اسناد مالی قرنطینه می‌شوند تا سابقهٔ مالی از بین نرود.</div>' +
      (sc.purgeable.length ? '<b style="font-size:13px">قابل پاکسازی (' + sc.purgeable.length + ' زنجیره):</b>' + sc.purgeable.map(row).join('') : '<div style="color:#059669;font-size:13px;padding:8px 0">✅ هیچ زنجیره یتیمی یافت نشد.</div>') +
      (sc.protectedChains.length ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:12px;color:#92400e;margin-top:10px"><b>🔒 محفوظ (بایگانی مختومه دارد — پاک نمی‌شود):</b>' + sc.protectedChains.map(row).join('') + '</div>' : '') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>' +
      (sc.purgeable.length ? '<button class="bt" style="background:#dc2626" onclick="var pv=ptfOrphanPreview();if(confirm(\'⚠️ پیش‌نمایش تایید شد؛ رکوردهای عملیاتی حذف و اسناد مالی فقط قرنطینه می‌شوند. ادامه؟\')){var r=ptfOrphanPurge(pv);document.getElementById(\'orphDlg\').remove();if(typeof ptfToast===\'function\')ptfToast(\'🧹 \'+r.purged+\' رکورد پاک شد / \'+(r.quarantined||0)+\' سند مالی قرنطینه شد\',\'ok\');if(typeof renderRfq===\'function\')renderRfq();}">🧹 پاکسازی</button>' : '') +
      '</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.delRfq = function (cd) {
    var sc = ptfRfqCascadeScan(cd);
    if (sc.archived.length) { alert('⛔ این درخواست بایگانی مختومه دارد (' + sc.archived.join('، ') + ') — سند نهایی شرکت است و حذف آن نقض توالی رویدادهاست (BUG-031).'); return; }
    var senior = (typeof isSenior === 'function') ? isSenior() : false;
    if ((sc.hasWon || sc.hasInvoice) && !senior) { alert('⛔ این درخواست پیشنهاد برنده/فاکتور دارد — حذف فقط توسط مدیران ارشد ممکن است (BUG-031).'); return; }
    var lines = [];
    if (sc.offers.length) lines.push('• ' + sc.offers.length + ' پیشنهاد (' + sc.offers.slice(0, 4).join('، ') + (sc.offers.length > 4 ? '…' : '') + ')');
    if (sc.invoices.length) lines.push('• ' + sc.invoices.length + ' فاکتور ⚠️');
    if (sc.rfqsmart.length) lines.push('• ' + sc.rfqsmart.length + ' استعلام تامین');
    if (sc.buycmp.length) lines.push('• ' + sc.buycmp.length + ' جدول قیمت/خرید واقعی');
    if (sc.payables.length) lines.push('• ' + sc.payables.length + ' بستانکاری تامین‌کننده ⚠️');
    if (sc.deals.length) lines.push('• ' + sc.deals.length + ' پرونده فروش ⚠️');
    if (sc.inqitems) lines.push('• ' + sc.inqitems + ' قلم درخواست');
    var msg = '🗑 حذف درخواست «' + cd + '» — حذف آبشاری (BUG-031):\n\n' + (lines.length ? 'همه موارد وابسته زیر هم برای همیشه پاک می‌شوند:\n' + lines.join('\n') : 'وابسته‌ای ندارد.') + '\n\nادامه می‌دهید؟';
    if (!confirm(msg)) return;
    if ((sc.hasWon || sc.hasInvoice) && !confirm('⚠️ تایید دوم مدیر ارشد: این درخواست «برنده/فاکتوردار» است — حذف کامل زنجیره فروش. مطمئنید؟')) return;
    var res = ptfRfqCascadeDelete(cd);
    if (!res.ok) { alert('⛔ حذف انجام نشد (' + res.why + ')'); return; }
    var md = document.querySelector('#panels .md-b:last-child');
    if (md) md.remove();
    if (typeof renderRfq === 'function') renderRfq();
    if (typeof ptfToast === 'function') ptfToast('درخواست و همه وابسته‌هایش حذف شد 🗑', 'ok');
  };

  var _buildRfq = window.buildRfq;
  window.buildRfq = function () {
    if (!document.getElementById('ptfRfqUiCss')) {
      var st = document.createElement('style');
      st.id = 'ptfRfqUiCss';
      st.textContent = '.rfq-offer-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}' +
        '.rfq-offer-chip{min-height:38px;padding:6px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#334155;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}' +
        '.rfq-offer-chip.is-on{background:#0e7490;color:#fff;border-color:#0e7490}' +
        '#rTb tr.rfq-row-hide,#rTb tr.rfq-row-hide[style]{display:none!important}' +
        '#rTb td:last-child button{width:34px!important;height:34px!important;min-width:34px!important;padding:0!important;display:inline-grid!important;place-items:center;font-size:15px!important;line-height:1;border-radius:10px}' +
        '#rTb td:last-child .bd{display:none}' +
        '@media(max-width:768px){.rfq-offer-bar{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rfq-offer-chip{width:100%;min-width:0;padding:8px 4px;font-size:11px;text-align:center}#rTb tr.rfq-row-hide{display:none!important}}';
      document.head.appendChild(st);
    }
    return '<div id="rfqPendWrap"></div>' +
      '<div class="ph"><h3>📋 درخواست‌ها</h3>' +
      '<div class="sb2"><input type="text" id="rSrch" placeholder="جستجو..." oninput="filterRfq()">' +
      '<select id="rOfferFlt" onchange="filterRfq()" title="فیلتر پیشنهاد" style="padding:8px 10px;border:2px solid var(--brd);border-radius:10px;font-family:inherit;font-size:12.5px;background:#f8fafc;max-width:220px">' +
      '<option value="">همه درخواست‌ها</option>' +
      '<option value="none">بدون پیشنهاد</option>' +
      '<option value="has">دارای پیشنهاد</option>' +
      '</select>' +
      ((typeof isSenior === 'function' && isSenior()) ? '<button class="bt bt-o" style="color:#dc2626;border-color:#fecaca" onclick="ptfOrphanReview()" title="رکوردهای اشاره‌کننده به درخواست حذف‌شده">🧹 یتیم‌ها</button>' : '') +
      '<button class="bt" onclick="showModal(\'rMd\')">+ جدید</button></div></div>' +
      '<div class="rfq-offer-bar" id="rOfferBar" role="tablist" aria-label="فیلتر پیشنهاد">' +
      '<button type="button" class="rfq-offer-chip" data-v="" onclick="ptfRfqOfferFlt(\'\')">همه</button>' +
      '<button type="button" class="rfq-offer-chip" data-v="none" onclick="ptfRfqOfferFlt(\'none\')">بدون پیشنهاد</button>' +
      '<button type="button" class="rfq-offer-chip" data-v="has" onclick="ptfRfqOfferFlt(\'has\')">دارای پیشنهاد</button>' +
      '</div>' +
      '<div class="tb2"><table><thead><tr>' +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('rfq', 'cd', 'کد') : '<th>کد</th>') +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('rfq', 'co', 'مشتری') : '<th>مشتری</th>') + '<th>حوزه</th>' +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('rfq', 'dt', 'تاریخ') : '<th>تاریخ</th>') +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('rfq', 'st', 'وضعیت') : '<th>وضعیت</th>') +
      '<th>مسئول رسیدگی</th><th>عملیات</th></tr></thead>' +
      '<tbody id="rTb"></tbody></table></div>';
  };

  window.ptfRfqOfferInqSet = function (offers) {
    var set = {};
    (offers || getData('ptf_crm_offers') || []).forEach(function (o) {
      if (o && o.inqNo) set[o.inqNo] = 1;
    });
    return set;
  };
  window.ptfRfqLinkedOffers = function (r, offers) {
    if (!r) return [];
    var list = offers || getData('ptf_crm_offers') || [];
    return list.filter(function (o) {
      return o && o.inqNo && (o.inqNo === r.cd || (r.inqNo && o.inqNo === r.inqNo));
    });
  };
  window.ptfRfqHasOffer = function (r, offers, inqSet) {
    if (!r) return false;
    if (inqSet) return !!(inqSet[r.cd] || (r.inqNo && inqSet[r.inqNo]));
    return window.ptfRfqLinkedOffers(r, offers).length > 0;
  };

  function rfqPaintOfferChips(ofFlt, noneN, hasN) {
    var bar = document.getElementById('rOfferBar');
    if (!bar) return;
    bar.querySelectorAll('.rfq-offer-chip').forEach(function (ch) {
      var v = ch.getAttribute('data-v') || '';
      ch.classList.toggle('is-on', v === ofFlt);
      if (v === 'none') ch.textContent = 'بدون پیشنهاد' + (noneN != null ? ' (' + noneN + ')' : '');
      if (v === 'has') ch.textContent = 'دارای پیشنهاد' + (hasN != null ? ' (' + hasN + ')' : '');
      if (v === '') ch.textContent = 'همه';
    });
  }
  /* فیلتر سریع: ردیف‌های از قبل رندرشده را نشان/پنهان می‌کند — بدون ساخت دوباره جدول. */
  window.ptfRfqApplyListFilter = function () {
    var css = document.getElementById('ptfRfqUiCss');
    if (css && css.textContent.indexOf('rfq-row-hide') < 0) css.textContent += '#rTb tr.rfq-row-hide{display:none!important}';
    var tb = document.getElementById('rTb');
    if (!tb || !tb.querySelector('tr[data-has-offer]')) return false;
    var qEl = document.getElementById('rSrch');
    var q = qEl ? String(qEl.value || '').trim().toLowerCase() : '';
    var ofEl = document.getElementById('rOfferFlt');
    var ofFlt = ofEl ? String(ofEl.value || '') : (window._rOfferFlt || '');
    if (ofEl && window._rOfferFlt != null && ofEl.value !== window._rOfferFlt) ofEl.value = window._rOfferFlt;
    ofFlt = ofEl ? String(ofEl.value || '') : ofFlt;
    window._rOfferFlt = ofFlt;
    var noneN = 0, hasN = 0, vis = 0;
    var empty = tb.querySelector('tr[data-rfq-empty]');
    tb.querySelectorAll('tr[data-has-offer]').forEach(function (tr) {
      var has = tr.getAttribute('data-has-offer') === '1';
      if (has) hasN++; else noneN++;
      var ok = true;
      if (ofFlt === 'none' && has) ok = false;
      if (ofFlt === 'has' && !has) ok = false;
      if (q && (tr.getAttribute('data-search') || '').indexOf(q) < 0) ok = false;
      tr.style.display = ok ? '' : 'none';
      if (ok) vis++;
    });
    rfqPaintOfferChips(ofFlt, noneN, hasN);
    if (!vis) {
      if (!empty) {
        empty = document.createElement('tr');
        empty.setAttribute('data-rfq-empty', '1');
        empty.innerHTML = '<td colspan="7" style="text-align:center;color:#94a3b8;padding:22px"></td>';
        tb.appendChild(empty);
      }
      empty.style.display = '';
      empty.querySelector('td').textContent = ofFlt === 'none' ? 'درخواستی بدون پیشنهاد نیست' : (q || ofFlt ? 'موردی با این فیلتر نیست' : 'استعلامی ثبت نشده');
    } else if (empty) empty.style.display = 'none';
    return true;
  };
  window.ptfRfqOfferFlt = function (v) {
    window._rOfferFlt = String(v || '');
    var ofEl = document.getElementById('rOfferFlt');
    if (ofEl) ofEl.value = window._rOfferFlt;
    rfqPaintOfferChips(window._rOfferFlt);
    if (!window.ptfRfqApplyListFilter() && typeof window.renderRfq === 'function') window.renderRfq();
  };
  window.filterRfq = function () {
    if (!window.ptfRfqApplyListFilter() && typeof window.renderRfq === 'function') window.renderRfq();
  };

  window.ptfRfqWaitBadge = rfqWaitBadge; /* v16.4 (US-369): بج «منتظر صدور» روی کارت کانبان */
  function rfqWaitBadge(r, offers) {
    if (!r.waiting) return '';
    /* v15.4 (US-386): TO ممکن است با شماره کارفرما (r.inqNo) ثبت شده باشد نه کد سیستمی */
    var done = offers.some(function (o) { return (o.inqNo === r.cd || (r.inqNo && o.inqNo === r.inqNo)) && o.kind === r.waiting; });
    if (done) return ' <span class="bd" style="background:#d1fae5;color:#065f46">✅ ' + r.waiting + ' صادر شد</span>';
    return ' <span class="bd" style="background:#fef3c7;color:#b45309">⏳ منتظر صدور پیشنهاد ' + (r.waiting === 'TO' ? 'فنی' : 'مالی') + '</span>';
  }

  /* v14.6 (US-348): وضعیت مهلت پاسخ — قرمز=گذشته/امروز، نارنجی=۲ روز مانده */
  window.ptfRfqDueState = function (r) {
    if (!r || !r.dueISO) return null;
    var isDone = ['st4', 'st5', 'st8', 'st9', 'st6', 'st7', 'stX'].indexOf(r.st || '') > -1; /* پاسخ داده/بسته شده — v17.3: + st8/st9 */
    if (isDone) return null;
    var today = todayISO();
    var warn = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    var _dueFa = (typeof ptfISOToJ === 'function' ? ptfISOToJ(r.dueISO) : r.dueISO);
    if (r.dueISO < today) return { cl: '#dc2626', bg: '#fef2f2', lb: '⏰ مهلت گذشته: ' + _dueFa, over: true };
    if (r.dueISO === today) return { cl: '#dc2626', bg: '#fef2f2', lb: '⏰ مهلت امروز است!', over: false };
    if (r.dueISO <= warn) return { cl: '#d97706', bg: '#fffbeb', lb: '⏳ مهلت: ' + _dueFa, over: false };
    return { cl: '#64748b', bg: '', lb: '⏳ مهلت: ' + _dueFa, over: false };
  };
  window.renderRfq = function () {
    var rfqs = getData('ptf_crm_rfqs');
    var offers = getData('ptf_crm_offers');
    var offerInq = window.ptfRfqOfferInqSet(offers);
    var tb = document.getElementById('rTb');
    if (!tb) return;
    if (!window._ptfRfqSortReg && window.ptfRegisterSortable) {
      window._ptfRfqSortReg = true;
      window.ptfRegisterSortable('rfq', {
        getters: {
          cd: function (r) { return r.cd || ''; },
          co: function (r) { return r.co || ''; },
          dt: function (r) { return r.dt || ''; },
          st: function (r) { return r.st || ''; }
        },
        render: window.renderRfq
      });
    }
    rfqs = (typeof window.ptfSorted === 'function') ? window.ptfSorted('rfq', rfqs) : rfqs;
    var ofEl = document.getElementById('rOfferFlt');
    var ofFlt = ofEl ? String(ofEl.value || '') : (window._rOfferFlt || '');
    if (ofEl && window._rOfferFlt != null && ofEl.value !== window._rOfferFlt) ofEl.value = window._rOfferFlt;
    ofFlt = ofEl ? String(ofEl.value || '') : ofFlt;
    window._rOfferFlt = ofFlt;
    var noneN = 0, hasN = 0;
    rfqs.forEach(function (r0) {
      if (ptfRfqHasOffer(r0, offers, offerInq)) hasN++; else noneN++;
    });
    rfqPaintOfferChips(ofFlt, noneN, hasN);
    var userNm = {};
    try {
      (getData('ptf_crm_users') || []).forEach(function (u) {
        if (u && (u.username || u.user)) userNm[u.username || u.user] = u.name || u.nm || u.username || u.user;
      });
    } catch (eUsers) {}
    var h = '';
    /* v17.3 (US-413 — کیس R8): رنگ ردیف برد/باخت — سبز=CO برنده، قرمز=بازنده (بایگانی lost) — اولویت بر رنگ مهلت */
    var _wonInqs = {}, _lostInqs = {};
    try {
      offers.forEach(function (o2) { if ((o2.kind === 'CO' || o2.kind === 'TC') && o2.st === 'won' && o2.inqNo) _wonInqs[o2.inqNo] = 1; });
      getData('ptf_crm_projects').forEach(function (p2) { if (p2.state === 'archived' && p2.closeKind === 'lost' && p2.inqNo) _lostInqs[p2.inqNo] = 1; });
    } catch (eWL) {}
    function _wl(r2) {
      var keys = [r2.cd, r2.inqNo].filter(Boolean);
      if (keys.some(function (k2) { return _wonInqs[k2]; })) return 'won';
      if (keys.some(function (k2) { return _lostInqs[k2]; })) return 'lost';
      return '';
    }
    rfqs.forEach(function (r) {
      var srcBadge = r.src === 'site' ? ' <span class="bd" style="background:#e0f2fe;color:#0369a1">🌐 از سایت</span>' : '';
      /* v14.6 (US-348): بج مهلت + پس‌زمینه قرمز ردیف نزدیک/گذشته از مهلت */
      var due = (typeof ptfRfqDueState === 'function') ? ptfRfqDueState(r) : null;
      var dueBadge = due ? ' <span class="bd" style="background:' + (due.bg || '#f1f5f9') + ';color:' + due.cl + '">' + due.lb + '</span>' : '';
      var wl = _wl(r);
      var wlBadge = wl === 'won' ? ' <span class="bd" style="background:#d1fae5;color:#065f46">🏆 برنده</span>' : wl === 'lost' ? ' <span class="bd" style="background:#fee2e2;color:#b91c1c">❌ بازنده</span>' : '';
      /* v15.7 (US-388 ②): بج شمار ضمایم — کلیک = مشاهده/دانلود (رفرنس کاربران) */
      var nAtt = 0;
      try { Object.keys(r.files || {}).forEach(function (k2) { nAtt += (r.files[k2] || []).length; }); } catch (eAt) {}
      var attBadge = nAtt ? ' <span class="bd" style="background:#ede9fe;color:#6d28d9;cursor:pointer" title="مشاهده و دانلود ضمایم" onclick="event.stopPropagation();ptfManageInqAttachments(\'' + ptfOnClickArg(r.cd) + '\')">📎 ' + nAtt + ' ضمیمه</span>' : '';
      var rowBg = wl === 'won' ? '#ecfdf5' : wl === 'lost' ? '#fef2f2' : (due && due.bg ? due.bg : '');
      /* v21.5 US-411ف1: نمایش ثبت‌کننده زیر کد درخواست */
      var crLine = '';
      try {
        if (r.crBy || r.crAt) {
          var crName = userNm[r.crBy] || r.crBy || '';
          crLine = '<div style="font-size:10.5px;color:#64748b;margin-top:2px">📝 ثبت: ' + escP(crName || 'نامشخص') + (r.crAt ? ' — ' + escP(r.crAt) : '') + '</div>';
        } else {
          crLine = '<div style="font-size:10.5px;color:#94a3b8;margin-top:2px">📝 ثبت: نامشخص (قدیمی)</div>';
        }
      } catch (eCr) {}
      /* شماره درخواست کارفرما از RFQ داخلی جداست؛ فقط در صورت ورود و تفاوت نمایش داده می‌شود. */
      var customerInqLine = '';
      if (r.inqNo && String(r.inqNo).trim() && String(r.inqNo).trim() !== String(r.cd || '').trim()) {
        customerInqLine = '<div style="font-size:10.5px;color:#0e7490;margin-top:2px">↳ درخواست کارفرما: <span dir="ltr">' + escP(String(r.inqNo).trim()) + '</span></div>';
      }
      var hasOff = ptfRfqHasOffer(r, offers, offerInq);
      var searchBlob = ((r.cd || '') + ' ' + (r.inqNo || '') + ' ' + (r.co || '') + ' ' + (r.con || '') + ' ' + (r.ca || '') + ' ' + (r.subj || '') + ' ' + (r.stxt || '')).toLowerCase().replace(/"/g, '');
      h += '<tr data-has-offer="' + (hasOff ? '1' : '0') + '" data-search="' + escP(searchBlob) + '"' + (rowBg ? ' style="background:' + rowBg + '"' : '') + '><td><strong>' + escP(r.cd) + '</strong>' + wlBadge + srcBadge + dueBadge + attBadge + customerInqLine + crLine + '</td><td>' + escP(r.co) +
        (r.con ? ' <small style="color:#94a3b8">(' + escP(r.con) + ')</small>' : '') + '</td>' +
        '<td>' + escP(r.ca || '-') + '</td><td>' + escP(r.dt || '—') + '</td>' +
        '<td><span class="bd b-' + (r.st || 'st1') + '">' + escP(r.stxt || 'دریافت اولیه') + '</span>' + rfqWaitBadge(r, offers) + '</td>' +
        '<td style="font-size:12px">' + (r.assignee ? '👤 ' + escP(r.assignee.name) + ' <small style="color:#94a3b8">(' + escP(r.assignee.act) + ')</small>' : '<span style="color:#cbd5e1">—</span>') + '</td>' +
        '<td><button class="bt bt-o" data-rfq-action="ptfViewRfq" style="width:32px;height:32px;padding:0;font-size:13px" onclick="ptfViewRfq(\'' + ptfOnClickArg(r.cd) + '\')" title="مشاهده درخواست" aria-label="مشاهده درخواست">👁️</button> ' +
        '<button class="bt bt-o" data-rfq-action="editRfq" style="width:32px;height:32px;padding:0;font-size:13px" onclick="editRfq(\'' + ptfOnClickArg(r.cd) + '\')" title="ویرایش / حذف" aria-label="ویرایش یا حذف درخواست">✏️</button> ' +
        '<button class="bt bt-o" data-rfq-action="showRefModal" style="width:32px;height:32px;padding:0;font-size:13px;color:#0e7490;border-color:#bae6fd" onclick="showRefModal(\'' + ptfOnClickArg(r.cd) + '\')" title="ارجاع" aria-label="ارجاع درخواست">📨</button>' +
        '</td></tr>';
    });
    tb.innerHTML = h || '<tr data-rfq-empty="1"><td colspan="7" style="text-align:center;color:#94a3b8;padding:22px">استعلامی ثبت نشده</td></tr>';
    window.ptfRfqApplyListFilter();
    updateStats();
    renderRfqPending();
  };

  /* ---- استعلام‌های سایت در انتظار تایید ۳ نقش (US-133 AC4) ---- */
  window.renderRfqPending = function () {
    var el = document.getElementById('rfqPendWrap');
    if (!el) return;
    var pend = siteRfqs().filter(function (r) { return r.status === 'pending'; });
    if (!pend.length) { el.innerHTML = ''; return; }
    var h = '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:14px;padding:14px;margin-bottom:16px">' +
      '<h4 style="margin:0 0 10px;font-size:13.5px;color:#1d4ed8">🌐 استعلام‌های ثبت‌شده از سایت — در انتظار تایید مدیران (' + pend.length + ')</h4>' +
      '<div class="tb2"><table><thead><tr><th>شماره یکتا</th><th>شرکت</th><th>تماس</th><th>حوزه</th><th>شرح</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>';
    pend.forEach(function (r) {
      h += '<tr><td><b>' + escP(r.code) + '</b>' + (r.attachment ? ' <span class="bd" style="background:#f0f9ff;color:#0369a1">📎 پیوست</span>' : '') + '</td><td>' + escP(r.company) + '<br><small style="color:#94a3b8">' + escP(r.contact || '') + '</small></td>' +
        '<td style="direction:ltr;font-size:12px">' + escP(r.phone || '-') + '</td><td style="font-size:11px">' + escP(r.category || '-') + '</td>' +
        '<td style="font-size:11px;max-width:220px">' + escP((r.message || '').slice(0, 120)) + '</td><td style="font-size:11px">' + escP(r.date || '-') + '</td><td>' +
        /* v14.7 (US-380 AC1): جزئیات کامل — همه فیلدهای فرم سایت + پیوست */
        '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#0e7490" onclick="rfqSiteDetail(\'' + ptfOnClickArg(r.code) + '\')">👁 جزئیات کامل</button> ' +
        (isSenior()
          ? '<button class="bt" style="padding:4px 10px;font-size:12px;background:#059669" onclick="rfqApprove(\'' + ptfOnClickArg(r.code) + '\')">✅ تایید و ورود</button> ' +
            '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626" onclick="rfqReject(\'' + ptfOnClickArg(r.code) + '\')">✖ رد</button>'
          : '<span style="font-size:11px;color:#94a3b8">فقط مدیران ارشد</span>') +
        '</td></tr>';
    });
    el.innerHTML = h + '</tbody></table></div></div>';
  };

  /* ===== v14.7 (US-380 AC1): مودال جزئیات کامل درخواست سایت — همه فیلدهای ثبت‌شده + پیوست ===== */
  window.rfqSiteDetail = function (code) {
    var r = siteRfqs().filter(function (x) { return x.code === code; })[0];
    if (!r) return;
    var row = function (lb, v, ltr) {
      return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--brd);font-size:13px"><b style="min-width:130px;color:#475569">' + lb + '</b><span style="flex:1' + (ltr ? ';direction:ltr;text-align:left' : '') + '">' + (v ? escP(v) : '<span style="color:#cbd5e1">—</span>') + '</span></div>';
    };
    var html = '<div class="md-b" style="display:grid;z-index:1600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
      '<h3>👁 جزئیات کامل درخواست سایت — ' + escP(code) + '</h3>' +
      row('🏢 نام شرکت', r.company) +
      row('👤 نام ارسال‌کننده', r.contact) +
      row('📞 شماره تماس', r.phone, true) +
      row('📧 ایمیل', r.email, true) +
      row('🗂 حوزه درخواست', r.category) +
      row('📌 موضوع', r.subject) +
      row('📐 استاندارد فنی', r.standard) +
      row('🏷 برندهای مورد نظر', r.vendors) +
      row('🗓 تاریخ ثبت', r.date) +
      '<div style="margin:10px 0"><b style="font-size:13px;color:#475569">📝 شرح کامل درخواست:</b>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:13px;line-height:2;white-space:pre-wrap;max-height:220px;overflow:auto;margin-top:6px">' + (r.message ? escP(r.message) : '<span style="color:#cbd5e1">—</span>') + '</div></div>' +
      siteAttachmentHtml(r.attachment) +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap">' +
      (isSenior() && r.status === 'pending'
        ? '<button class="bt" style="background:#059669" onclick="this.closest(\'.md-b\').remove();rfqApprove(\'' + ptfOnClickArg(code) + '\')">✅ تایید و ورود</button>'
        : '') +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  /* v14.7 (US-380 AC2): تایید درخواست سایت → ساخت/اتصال خودکار مشتری + رکورد کامل */
  function rfqSiteEnsureCustomer(r) {
    var custs = getData('ptf_crm_customers');
    var normP = function (s) { return String(s || '').replace(/\D/g, '').replace(/^0098/, '0').replace(/^98/, '0'); };
    var coN = (typeof dedupNorm === 'function') ? dedupNorm(r.company) : String(r.company || '').trim();
    var phN = normP(r.phone);
    /* اتصال به مشتری موجود: نام یکسان یا شماره تماس یکسان */
    var found = custs.filter(function (c) {
      if (coN && (typeof dedupNorm === 'function' ? dedupNorm(c.co) === coN : c.co === r.company)) return true;
      if (phN && phN.length >= 7) {
        var xp = (typeof dedupPhones === 'function') ? dedupPhones(c) : [];
        if (xp.indexOf(phN) > -1) return true;
      }
      return false;
    })[0];
    if (found) {
      /* تکمیل اطلاعات غیرتکراری: رابط جدید با تایید کاربر (هم‌راستا US-363) */
      if (r.contact && !(found.people || []).some(function (p) { return (p.nm || '').trim() === r.contact.trim(); })) {
        if (confirm('🏢 این درخواست به مشتری موجود «' + found.co + '» (' + found.cd + ') متصل شد.\n\n👤 رابط جدید «' + r.contact + '» در فرم سایت آمده که در رکورد مشتری نیست — به اشخاص رابط اضافه شود؟')) {
          found.people = found.people || [];
          found.people.push({ nm: r.contact, nmEn: '', role: 'رابط (فرم سایت)', dept: '', tels: [], mobs: r.phone ? [{ n: r.phone, lb: 'فرم سایت' }] : [], mails: r.email ? [{ n: r.email, lb: '' }] : [], src: 'site' });
          setData('ptf_crm_customers', custs);
          try { audit('مشتریان', 'افزودن رابط از فرم سایت به ' + found.co + ': ' + r.contact, found.cd); } catch (eA) {}
        }
      }
      return found;
    }
    /* ساخت مشتری جدید خودکار (US-380 AC2) */
    var indMap = { 'پایپینگ': 'نفت و گاز', 'شیرآلات': 'نفت و گاز', 'برق': 'نفت و گاز', 'ابزار دقیق': 'نفت و گاز' };
    var newC = {
      cd: genCode('CUST'), co: r.company, kind: 'حقوقی',
      ind: indMap[r.category] || 'سایر', venSt: 'unreg',
      coWeb: r.email || '', coTels: [], coAddr: '',
      people: r.contact ? [{ nm: r.contact, nmEn: '', role: 'رابط (فرم سایت)', dept: '', tels: [], mobs: r.phone ? [{ n: r.phone, lb: 'فرم سایت' }] : [], mails: r.email ? [{ n: r.email, lb: '' }] : [], primary: true, src: 'site' }] : [],
      phones: [], con: r.contact || '', ph: r.phone || '',
      ds: 'ثبت خودکار از درخواست سایت ' + (r.code || '') + '', srcSite: r.code || ''
    };
    if (typeof dedupStamp === 'function') dedupStamp(newC);
    custs.unshift(newC);
    setData('ptf_crm_customers', custs);
    try { audit('مشتریان', 'ساخت خودکار مشتری از درخواست سایت: ' + r.company, newC.cd); } catch (eA2) {}
    return newC;
  }

  window.rfqApprove = function (code) {
    var r = siteRfqs().filter(function (x) { return x.code === code; })[0];
    if (!r) return;
    /* v14.7 (US-380 AC2): مشتری خودکار ساخته/متصل می‌شود */
    var cust = null;
    try { cust = rfqSiteEnsureCustomer(r); } catch (eC) {}
    var rfqs = getData('ptf_crm_rfqs');
    if (!rfqs.some(function (x) { return x.cd === code; })) {
      var siteAtt = siteAttachmentMeta(r.attachment);
      var importedFiles = {};
      if (siteAtt && siteAtt.cloud) importedFiles.oth = [{ key: siteAtt.key, name: siteAtt.name, size: siteAtt.size, mode: 'arvan', t: faDateTime(), source: 'site' }];
      rfqs.unshift({
        cd: code, co: r.company, custCd: cust ? cust.cd : '', con: r.contact || '', ph: r.phone || '', ca: r.category || 'سایر',
        st: 'st1', stxt: 'مرحله ۱: دریافت اولیه', dt: new Date().toLocaleDateString('fa-IR'),
        src: 'site',
        /* v14.7 + Sprint 283: metadata is preserved and a cloud object is added to normal CRM attachments. */
        subj: r.subject || '', inqText: r.message || '', email: r.email || '',
        msg: r.message || '', std: r.standard || '', vnd: r.vendors || '',
        siteAttachment: r.attachment || '', files: importedFiles
      });
      setData('ptf_crm_rfqs', rfqs);
    }
    api('set_status', { type: 'rfq', code: code, status: 'approved', statusText: 'تایید شد — در حال بررسی فنی و تامین', by: curSession().name }, function () { syncServerInbox(); });
    if (typeof audit === 'function') audit('استعلامات', 'تایید استعلام سایت: ' + r.company + (cust ? ' → مشتری ' + cust.cd : ''), code);
    /* v14.7 (US-380 AC5): اعلان با لینک درخواست + اشاره به مشتری ساخته‌شده */
    notify({ toRoles: SALES_ROLES, title: '📋 استعلام سایت «' + code + '» (' + r.company + ') تایید و وارد چرخه شد' + (cust ? ' — مشتری: ' + cust.cd : ''), kind: 'rfq_ok', channels: ['cart'], link: { panel: 'rfq' } });
    renderRfq();
    updateInboxBadge();
    /* v34.0.20-alpha (فاز ۱۷): اطلاع‌رسانی پیامکی «ثبت درخواست» به مشتری — با ذکر شمارهٔ درخواست */
    try {
      var _rfqMob = (typeof normMob === 'function') ? normMob(r.phone || '') : String(r.phone || '').replace(/\D/g, '');
      if (_rfqMob && typeof smsSendSingle === 'function') {
        smsSendSingle(_rfqMob, 'پیشرو تجهیز فرتاک\nدرخواست شما با شمارهٔ ' + (code || '') + ' ثبت و در حال بررسی فنی و تامین است.\n021-46087679', null);
        if (typeof addLog === 'function') try { addLog('📱 پیامک ثبت درخواست به ' + (r.company || '') + ' (' + _rfqMob + ') ارسال شد'); } catch (eS2) {}
      }
    } catch (eSms) {}
    if (cust) alert('✅ درخواست تایید شد.\n\n🏢 مشتری «' + cust.co + '» (' + cust.cd + ')' + (cust.srcSite === code ? ' به‌صورت خودکار ساخته' : ' متصل') + ' شد — همه اطلاعات فرم سایت (رابط/تلفن/ایمیل/شرح/استاندارد/برندها' + (r.attachment ? '/پیوست' : '') + ') روی رکوردها نشست.');
  };

  window.rfqReject = function (code) {
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '✖ رد / مختومه کردن استعلام',
        fields: [{ id: 'reason', label: 'دلیل رد / مختومه شدن', type: 'textarea', rows: 2 }],
        danger: true, okText: 'مختومه شود',
        onOk: function (v) { rfqRejectCommit(code, v.reason); }
      });
      return;
    }
    var reason = prompt('دلیل رد / مختومه شدن:', '');
    if (reason === null) return;
    rfqRejectCommit(code, reason);
  };
  window.rfqRejectCommit = function (code, reason) {
    api('set_status', { type: 'rfq', code: code, status: 'rejected', statusText: 'مختومه' + (reason ? ' — ' + reason : ''), by: curSession().name }, function () { syncServerInbox(); });
    if (typeof audit === 'function') audit('استعلامات', 'رد استعلام سایت', code);
    renderRfqPending();
  };

  /* ---- مودال جدید ثبت RFQ (US-136 AC2..AC5) ---- */
  var _rfqFiles = null;
  function custOptions(sel) {
    var custs = getData('ptf_crm_customers');
    var h = '<option value="">— انتخاب مشتری —</option>';
    custs.forEach(function (c) {
      h += '<option value="' + escP(c.cd) + '"' + (sel === c.cd ? ' selected' : '') + '>' + escP(c.co) + (c.kind ? ' (' + escP(c.kind) + ')' : '') + '</option>';
    });
    return h;
  }
  window.rfqCustChanged = function () {
    var cd = document.getElementById('nR2Cust').value;
    var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === cd; })[0];
    var sel = document.getElementById('nR2Con');
    var h = '<option value="">— انتخاب مخاطب —</option>';
    ((c && c.people) || []).forEach(function (p, i) {
      h += '<option value="' + i + '">' + escP(p.nm) + (p.role ? ' — ' + escP(p.role) : '') + '</option>';
    });
    sel.innerHTML = h;
  };
  window.rfqTab = function (t) {
    ['inq', 'ds', 'img', 'dwg', 'oth'].forEach(function (k) {
      var tb = document.getElementById('rTab_' + k);
      var pn = document.getElementById('rTabP_' + k);
      if (tb) { tb.style.background = k === t ? 'linear-gradient(135deg,#ef4b1a,#f79400)' : '#f1f5f9'; tb.style.color = k === t ? '#fff' : '#475569'; }
      if (pn) pn.style.display = k === t ? 'block' : 'none';
    });
  };

  function rfqModalHtml() {
    var catOpts = RFQ_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    var tabs = [
      { k: 'inq', lb: '📄 فایل استعلام' }, { k: 'ds', lb: '📑 دیتاشیت' },
      { k: 'img', lb: '🖼 عکس کالا' }, { k: 'dwg', lb: '📐 نقشه' }, { k: 'oth', lb: '📎 سایر مدارک' }
    ];
    var tabBtns = tabs.map(function (t) {
      return '<button type="button" id="rTab_' + t.k + '" onclick="rfqTab(\'' + t.k + '\')" style="border:0;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;background:#f1f5f9;color:#475569">' + t.lb + '</button>';
    }).join('');
    var tabPanels = tabs.map(function (t) {
      return '<div id="rTabP_' + t.k + '" style="display:none"><div id="rUp_' + t.k + '"></div>' +
        '<small style="color:#94a3b8;font-size:11px">فرمت‌های مجاز: Word، PDF، Excel، عکس (حتی عکسِ pdf شده) و zip</small></div>';
    }).join('');
    return '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:680px;max-height:92vh;overflow:auto">' +
      '<h3>➕ ثبت درخواست جدید</h3>' +
      '<div class="fr"><div class="fld"><label>مشتری (کارفرما) *</label>' +
      '<div style="display:flex;gap:6px"><select id="nR2Cust" style="flex:1" onchange="rfqCustChanged()">' + custOptions() + '</select>' +
      '<button type="button" class="bt bt-o" style="padding:6px 10px;font-size:12px;white-space:nowrap" onclick="showCustModal()">+ ثبت مشتری جدید</button></div></div></div>' +
      '<div class="fr"><div class="fld"><label>مخاطب (شخص رابط)</label><select id="nR2Con"><option value="">— ابتدا مشتری را انتخاب کنید —</option></select></div>' +
      '<div class="fld"><label>حوزه</label><select id="nR2Cat">' + catOpts + '</select></div></div>' +
      '<div class="fr"><div class="fld"><label>شماره درخواست کارفرما (Inquiry No) — برای صدور TO/CO لازم است</label><input type="text" id="nR2Inq" placeholder="شماره‌ای که کارفرما روی درخواستش نوشته" style="direction:ltr"></div>' +
      '<div class="fld"><label>موضوع / شرح درخواست</label><input type="text" id="nR2Subj" placeholder="مثال: استعلام ۲۰۰ شاخه لوله A106 Gr.B"></div></div>' +
      /* v14.6 (US-348 — نقشه راه مصوب): مهلت پاسخ به کارفرما + یادآور خودکار ۲ روز قبل */
      '<div class="fr"><div class="fld"><label>⏳ مهلت پاسخ به کارفرما (شمسی — اختیاری ولی مهم)</label>' + (typeof ptfDateInput==="function" ? ptfDateInput("nR2DueJ", "") : '<input type="text" id="nR2DueJ" placeholder="1405/04/19" style="direction:ltr;color:#b45309">') + '</div>' +
      '<div class="fld"><small style="color:#94a3b8;font-size:11px;display:block;padding-top:26px">۲ روز قبل از مهلت، یادآور خودکار برای مسئول رسیدگی ارسال و ردیف در فهرست قرمز می‌شود.</small></div></div>' +
      /* US-206: استعلام متنی — وقتی استعلام در قالب متن (ایمیل/واتساپ/پیامک) رسیده */
      '<div class="fld"><label>📝 متن استعلام (اختیاری — اگر استعلام به صورت متن رسیده، همینجا بچسبانید)</label><textarea id="nR2Text" rows="5" placeholder="متن کامل استعلام دریافتی از کارفرما (ایمیل/واتساپ/...) را اینجا paste کنید — با درخواست ذخیره و بعداً قابل مشاهده است"></textarea></div>' +
      /* v15.7 (US-388 ① — گزارش کارفرما): ورود اقلام داخل خود پنجره ثبت — بدون نیاز به مرحله دوم */
      '<div class="fld"><label>📋 اقلام درخواست (اختیاری — همینجا وارد کنید یا بعدا با «ویرایش استعلام و اقلام»)</label>' +
      '<div id="nR2ItemsWrap" style="border:1px solid var(--brd);border-radius:12px;padding:8px;background:#fafbfc"></div>' +
      '<button type="button" class="bt bt-o" style="margin-top:6px;font-size:12px;color:#059669;border-color:#a7f3d0" onclick="rfqNewItemRow()">＋ افزودن قلم</button></div>' +
      '<div class="fld"><label>مدارک پیوست</label>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + tabBtns + '</div>' + tabPanels + '</div>' +
      '<div id="rFileSum" style="font-size:12px;color:#0e7490;margin-bottom:6px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button><button class="bt" onclick="saveRfq2()">ثبت استعلام</button></div></div></div>';
  }

  /* v15.7 (US-388 ①): ردیف‌های اقلام داخل مودال ثبت درخواست */
  window.rfqNewItemRow = function (v) {
    v = v || {};
    var wrap = document.getElementById('nR2ItemsWrap');
    if (!wrap) return;
    var row = document.createElement('div');
    row.className = 'nR2ItRow';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:5px;flex-wrap:wrap';
    row.innerHTML = '<input type="text" data-f="nm" placeholder="شرح کالا *" value="' + escP(v.nm || '') + '" style="flex:2;min-width:150px;padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12.5px">' +
      '<input type="number" data-f="qty" placeholder="تعداد" value="' + escP(v.qty || 1) + '" min="0" step="any" style="width:76px;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12.5px">' +
      '<select data-f="un" style="width:86px;padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px"><option>عدد</option><option>شاخه</option><option>متر</option><option>کیلوگرم</option><option>ست</option><option>بسته</option></select>' +
      '<input type="text" data-f="st" placeholder="استاندارد/مشخصه (اختیاری)" value="' + escP(v.st || '') + '" style="flex:1;min-width:110px;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12px">' +
      '<button type="button" onclick="this.parentElement.remove()" style="border:0;background:none;color:#dc2626;cursor:pointer;font-size:15px" title="حذف ردیف">✕</button>';
    wrap.appendChild(row);
  };
  function rfqCollectModalItems(cd) {
    var wrap = document.getElementById('nR2ItemsWrap');
    if (!wrap) return [];
    var out = [];
    var iq = getData('ptf_crm_inqitems');
    wrap.querySelectorAll('.nR2ItRow').forEach(function (row) {
      var g = function (f) { var el = row.querySelector('[data-f="' + f + '"]'); return el ? String(el.value || '').trim() : ''; };
      var nm = g('nm');
      if (!nm) return;
      var rec = { inqNo: cd, cd: genCode('IQI'), nm: nm, en: '', qty: +g('qty') || 1, un: g('un') || 'عدد', st: g('st'), t: new Date().toLocaleDateString('fa-IR') };
      iq.push(rec);
      out.push(rec);
    });
    if (out.length) setData('ptf_crm_inqitems', iq);
    return out;
  }

  function initRfqModal() {
    _rfqFiles = { inq: [], ds: [], img: [], dwg: [], oth: [] };
    ['inq', 'ds', 'img', 'dwg', 'oth'].forEach(function (k) {
      if (typeof attachUploadWidget === 'function') {
        attachUploadWidget('rUp_' + k, 'rfq/' + k, function (rec) {
          _rfqFiles[k].push(rec);
          var total = Object.keys(_rfqFiles).reduce(function (a, x) { return a + _rfqFiles[x].length; }, 0);
          var el = document.getElementById('rFileSum');
          if (el) el.textContent = '📎 ' + total + ' فایل پیوست شد';
        });
      }
    });
    rfqTab('inq');
  }

  window.saveRfq2 = function () {
    var custCd = document.getElementById('nR2Cust').value;
    if (!custCd) { alert('مشتری را از منوی کشویی انتخاب کنید (یا با «ثبت مشتری جدید» بسازید)'); return; }
    var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === custCd; })[0];
    var conIdx = document.getElementById('nR2Con').value;
    var con = (conIdx !== '' && c && c.people && c.people[+conIdx]) ? c.people[+conIdx].nm : '';
    var cd = genCode('RFQ');
    if (/^TMP-RFQ-/.test(String(cd || ''))) { alert('⛔ شماره رسمی درخواست از سرور دریافت نشده است. اتصال/ورود را برقرار کنید و دوباره تلاش کنید.'); return; }
    var rfqs = getData('ptf_crm_rfqs');
    var recR = {
      cd: cd, co: c ? c.co : '', custCd: custCd, con: con,
      ca: document.getElementById('nR2Cat').value,
      inqNo: ((document.getElementById('nR2Inq') || {}).value || '').trim(), // US-175 AC3
      subj: document.getElementById('nR2Subj').value.trim(),
      inqText: ((document.getElementById('nR2Text') || {}).value || '').trim(), // US-206: استعلام متنی
      dueISO: (typeof ptfJToISO === 'function' ? ptfJToISO(((document.getElementById('nR2DueJ') || {}).value || '').trim()) : ((document.getElementById('nR2Due') || {}).value || '').trim()), /* v20.5 US-446: مهلت پاسخ با ورودی شمسی */
      st: 'st1', stxt: 'مرحله ۱: دریافت اولیه',
      dt: new Date().toLocaleDateString('fa-IR'),
      files: _rfqFiles || {}
    };
    // US-174: استعلام تکراری (موضوع تکراری برای همان مشتری / شماره درخواست کارفرمای تکراری)
    if (typeof ptfDupBlock === 'function' && ptfDupBlock('rfq', recR, null)) return;
    if (typeof dedupStamp === 'function') dedupStamp(recR);
    rfqs.unshift(recR);
    setData('ptf_crm_rfqs', rfqs);
    if (typeof audit === 'function') audit('استعلامات', 'ثبت درخواست جدید برای ' + (c ? c.co : ''), cd);
    /* v15.7 (US-388 ①): اقلام واردشده در خود مودال ذخیره شود */
    var modalItems = [];
    try { modalItems = rfqCollectModalItems(cd) || []; } catch (eIt) {}
    var nItems = modalItems.length;
    hideModal();
    renderRfq();
    addLog('استعلام ' + cd + ' ثبت شد' + (nItems ? ' (' + nItems + ' قلم)' : ''));
    if (nItems) {
      /* v15.8 (US-388 AC تکمیلی — سوال کارفرما): کالاهای واردشده با تایید کاربر به ماژول کالا هم می‌روند
         (کد یکتا + مارک srcInq؛ تکراری‌ها ثبت نمی‌شوند — همان قاعده US-326) */
      var addedProds = 0;
      if (typeof window.ptfAutoRegisterSummaryProducts === 'function' &&
          confirm('📦 ' + nItems + ' قلم ثبت شد.\n\nآیا این کالاها به «ماژول کالا» هم اضافه شوند؟\n(هر کالا کد یکتا و مارک شماره درخواست می‌گیرد؛ کالاهای قبلا ثبت‌شده تکرار نمی‌شوند)')) {
        try { addedProds = window.ptfAutoRegisterSummaryProducts(cd, modalItems) || 0; } catch (eAP) {}
      }
      if (typeof ptfToast === 'function') ptfToast('✅ درخواست ' + cd + ' با ' + nItems + ' قلم ثبت شد' + (addedProds ? ' + ' + addedProds + ' کالای جدید در ماژول کالا 📦' : ''), 'ok');
      return; /* اقلام وارد شده — سوال دوباره لازم نیست */
    }
    /* v13.3 (US-326): پیشنهاد ورود اقلام — الزامی نیست؛ بعدا هم از دکمه «ویرایش استعلام و اقلام» ممکن است */
    setTimeout(function () {
      if (typeof ptfOpenFullInqEditor !== 'function') return;
      if (confirm('✅ استعلام ' + cd + ' ثبت شد.\n\nآیا مایلید همین حالا اقلام درخواست را وارد کنید؟ (دستی / اکسل / دستیار)\n\nالزامی نیست — بعدا هم از دکمه «✏️ ویرایش استعلام و اقلام» روی ردیف درخواست ممکن است.')) {
        ptfOpenFullInqEditor(cd);
      }
    }, 300);
  };

  // بعد از ثبت مشتری جدید داخل مودال RFQ، دراپ‌داون تازه شود و مشتری جدید انتخاب گردد
  var _saveCust2 = window.saveCust2;
  window.saveCust2 = function (cd) {
    _saveCust2(cd);
    var sel = document.getElementById('nR2Cust');
    if (sel) {
      var items = getData('ptf_crm_customers');
      var newest = cd || (items[0] && items[0].cd);
      sel.innerHTML = custOptions(newest);
      rfqCustChanged();
    }
  };

  /* ---- تغییر وضعیت با وضعیت‌های جدید + انتقال به پیشنهادها (US-136 AC6) ---- */
  var _showModal = window.showModal;
  window.showModal = function (id) {
    if (id === 'rMd') {
      document.getElementById('panels').insertAdjacentHTML('beforeend', rfqModalHtml());
      initRfqModal();
      return;
    }
    if (id === 'eMd') {
      var opts = RFQ_STATUSES.map(function (s) { return '<option value="' + s.v + '">' + s.t + '</option>'; }).join('');
      var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md">' +
        '<h3>📄 تغییر وضعیت: <span id="eCd" style="color:var(--pri)"></span></h3>' +
        '<div class="fld"><label>وضعیت جدید</label><select id="eSt">' + opts + '</select></div>' +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">با انتخاب «صدور پیشنهاد فنی/مالی»، درخواست به ماژول پیشنهادها (TO/CO) منتقل و برچسب «منتظر صدور» کنار آن ظاهر می‌شود.</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button><button class="bt" onclick="saveRfqStatus()">ذخیره</button></div></div></div>';
      document.getElementById('panels').insertAdjacentHTML('beforeend', html);
      return;
    }
    _showModal(id);
  };

  /* v16.4 (US-369): هسته تغییر وضعیت درخواست — مشترک بین مودال (saveRfqStatus) و کانبان (درگ).
     همان منطق قبلی saveRfqStatus بدون وابستگی DOM؛ همه اثرات جانبی (waiting/notify/audit/سینک سایت) حفظ شده. */
  window.ptfRfqSetStatus = function (cd, stVal, stText) {
    var rfqs = getData('ptf_crm_rfqs');
    var target = null;
    rfqs.forEach(function (r) {
      if (r.cd === cd) {
        target = r;
        r.st = stVal;
        r.stxt = stText;
        if (stVal === 'stTO') r.waiting = 'TO';
        else if (stVal === 'stCO') r.waiting = 'CO';
        else r.waiting = null;
      }
    });
    if (!target) return false;
    setData('ptf_crm_rfqs', rfqs);
    addLog('وضعیت ' + cd + ' تغییر کرد');
    if (typeof audit === 'function') audit('استعلامات', 'تغییر وضعیت به ' + stText, cd);
    if (target && target.waiting) {
      var kindLb = target.waiting === 'TO' ? 'فنی' : 'مالی';
      notify({
        toRoles: SALES_ROLES,
        title: '⏳ درخواست ' + cd + ' (' + target.co + ') منتظر صدور پیشنهاد ' + kindLb + ' است',
        kind: 'offer_wait', channels: ['cart'], link: { panel: 'off' }
      });
      pushEvent('status', 'درخواست ' + cd + ' (' + target.co + ') منتظر صدور پیشنهاد ' + kindLb + ' است');
      updateInboxBadge();
    }
    // سینک وضعیت استعلام‌های سایت با سرور → رهگیری
    if (target && target.src === 'site') {
      api('set_status', { type: 'rfq', code: cd, status: target.st, statusText: target.stxt, by: curSession().name }, null);
    }
    return true;
  };

  window.saveRfqStatus = function () {
    var cd = document.getElementById('eCd').textContent;
    var sel = document.getElementById('eSt');
    ptfRfqSetStatus(cd, sel.value, sel.options[sel.selectedIndex].text);
    hideModal();
    renderRfq();
  };

  /* ---- صف «منتظر پیشنهاد» بالای ماژول پیشنهادها ---- */
  var _buildOffers = window.buildOffers;
  window.buildOffers = function () {
    var rfqs = getData('ptf_crm_rfqs');
    var offers = getData('ptf_crm_offers');
    var waitList = rfqs.filter(function (r) {
      /* v15.4 (US-386): شناسایی با هر دو شناسه درخواست */
      return r.waiting && !offers.some(function (o) { return (o.inqNo === r.cd || (r.inqNo && o.inqNo === r.inqNo)) && o.kind === r.waiting; });
    });
    var h = '';
    if (waitList.length) {
      h = '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:12px 14px;margin-bottom:14px">' +
        '<h4 style="margin:0 0 8px;font-size:13px;color:#c2410c">⏳ درخواست‌های منتظر صدور پیشنهاد (' + waitList.length + ')</h4>';
      waitList.forEach(function (r) {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #fed7aa;flex-wrap:wrap">' +
          '<span style="font-size:12.5px"><b>' + escP(r.cd) + '</b> — ' + escP(r.co) + ' <span class="bd" style="background:#fef3c7;color:#b45309">منتظر ' + (r.waiting === 'TO' ? 'پیشنهاد فنی' : 'پیشنهاد مالی') + '</span></span>' +
          '<button class="bt" style="padding:5px 12px;font-size:12px" onclick="offerFromRfq(\'' + ptfOnClickArg(r.cd) + '\')">صدور ' + r.waiting + ' ←</button></div>';
      });
      h += '</div>';
    }
    return h + _buildOffers();
  };

  window.offerFromRfq = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    offerNew(r.waiting || 'TO');
    _offState.inqNo = r.cd;
    _offState.buyerCo = r.co;
    if (r.custCd) _offState.buyerCd = r.custCd;
    /* v15.4 (US-386): درخواست‌های دستی قدیمی custCd ندارند → تطبیق نام مشتری تا کارفرما خودکار بنشیند */
    if (!_offState.buyerCd && r.co) {
      try {
        var _mc = getData('ptf_crm_customers').filter(function (c2) {
          return c2.co === r.co || (c2.coEn && c2.coEn === r.co) || (typeof dedupNorm === 'function' && dedupNorm(c2.co) === dedupNorm(r.co));
        })[0];
        if (_mc) _offState.buyerCd = _mc.cd;
      } catch (eM) {}
    }
    if (typeof offerForm === 'function') offerForm();
  };

  /* ============ US-139: ارجاع درخواست ============ */
  /* v14.0 (US-353 — دستور کارفرما): ادمین محل ارجاع فرآیندهای شرکت نیست */
  function salesUsers() {
    return getData('ptf_crm_users').filter(function (u) {
      return SALES_ROLES.indexOf(u.roleId || '') > -1 && u.roleId !== 'admin' && u.username !== 'admin';
    });
  }

  window.showRefModal = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    // v85: کاربر جاری از فهرست گیرندگان حذف — ارجاع به خود بی‌معناست
    var me = curSession().user;
    var allU = getData('ptf_crm_users');
    /* v14.0 (US-353): ادمین از فهرست گیرندگان ارجاع فرآیندی حذف — فقط برای «پشتیبانی فنی سیستم» با تیک جدا */
    var candidates = allU.filter(function (u) { return u.username !== me && u.username !== 'admin' && (u.roleId || '') !== 'admin'; });
    if (!candidates.length) { alert('کاربر دیگری جهت ارجاع وجود ندارد (ارجاع به خود و ادمین ممنوع است)'); return; }
    var uOpts = candidates.map(function (u) {
      return '<option value="' + escP(u.username) + '">' + escP(u.name) + ' — ' + escP(u.role || u.roleId) + '</option>';
    }).join('');
    window._refUOpts = uOpts; /* v14.0 US-353: برای برگشت از حالت ارجاع فنی */
    var aOpts = REF_ACTS.map(function (a) { return '<option>' + a + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md">' +
      '<h3>📨 ارجاع درخواست <span style="color:var(--pri)">' + escP(cd) + '</span></h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:8px">' + escP(r.co) + (r.subj ? ' — ' + escP(r.subj) : '') + '</div>' +
      '<div class="fld"><label>ارجاع به (اعضای تیم)</label><select id="refTo">' + uOpts + '</select></div>' +
      /* v14.0 (US-353): ادمین فقط برای مسائل خاص فنی/پشتیبانی سیستم */
      '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;margin-bottom:8px;cursor:pointer"><input type="checkbox" id="refToAdmin" onchange="var s2=document.getElementById(\'refTo\');if(this.checked){s2.setAttribute(\'data-prev\',s2.value);s2.innerHTML=\'<option value=&quot;admin&quot;>ادمین سیستم — فقط پشتیبانی فنی</option>\';}else{s2.innerHTML=window._refUOpts;if(s2.getAttribute(\'data-prev\'))s2.value=s2.getAttribute(\'data-prev\');}"> 🔧 مسئله خاص فنی/پشتیبانی سیستم است (ارجاع به ادمین)</label>' +
      '<div class="fld"><label>موضوع اقدام</label><select id="refAct">' + aOpts + '</select></div>' +
      '<div class="fld"><label>یادداشت (اختیاری)</label><input type="text" id="refNote"></div>' +
      // v85: تیک پیامک پیش‌فرض غیرفعال — فقط با صلاحدید کاربر
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px;cursor:pointer"><input type="checkbox" id="refSms"> 📱 ارسال پیامک اطلاع‌رسانی به گیرنده ارجاع</label>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">فقط گیرنده در کارتابل خودش این اقدام را می‌بیند تا کار در انبوه اعلان‌ها گم نشود.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button><button class="bt" onclick="saveReferral(\'' + ptfOnClickArg(cd) + '\')">📨 ارسال ارجاع</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.saveReferral = function (cd) {
    var toU = document.getElementById('refTo').value;
    var act = document.getElementById('refAct').value;
    var note = document.getElementById('refNote').value.trim();
    var toUser = salesUsers().filter(function (u) { return u.username === toU; })[0];
    if (!toUser) { alert('گیرنده را انتخاب کنید'); return; }
    var me = curSession();
    // v85: گارد ارجاع به خود (حتی اگر UI دستکاری شود)
    if (toU === me.user) { alert('⛔ ارجاع به خودتان ممکن نیست — گیرنده دیگری انتخاب کنید'); return; }
    var rfqs = getData('ptf_crm_rfqs');
    var target = null;
    rfqs.forEach(function (r) { if (r.cd === cd) { target = r; r.assignee = { user: toU, name: toUser.name, act: act, by: me.name, t: faDateTime() }; } });
    setData('ptf_crm_rfqs', rfqs);
    var title = 'درخواست ' + cd + (target ? ' (' + target.co + ')' : '') + ' جهت «' + act + '» به ' + toUser.name + ' ارجاع شد' + (note ? ' — ' + note : '');
    // v34.5.5: اعلان عمومی به همه فروش حذف شد — فقط گیرنده کارتابل می‌گیرد.
    var taskType = act === 'صدور پیشنهاد مالی (CO)' ? 'create_offer' : act === 'صدور پیشنهاد فنی (TO)' ? 'create_technical_offer' : act === 'استعلام قیمت از تامین‌کننده' ? 'create_supplier_rfq' : 'rfq_review';
    notify({ toUsers: [toU], title: '⭐ اقدام شما لازم است: ' + title, kind: 'referral', channels: ['cart'], link: { panel: 'rfq' }, actionable: true,
      refCd: cd, taskType: taskType, dkey: 'referral|' + cd + '|' + toU + '|' + taskType });
    // رویداد سروری برای رسیدن لحظه‌ای به مرورگر گیرنده (دینگ)
    pushEvent('referral', title, { to: toU, toName: toUser.name, act: act, code: cd, taskType: taskType });
    // US-150 AC6: پیامک به گیرنده ارجاع (در صورت تیک)
    if ((document.getElementById('refSms') || {}).checked && typeof smsSendSingle === 'function') {
      var mob = typeof smsUserMobile === 'function' ? smsUserMobile(toU) : '';
      if (mob) {
        var roleLb = toUser.role || toUser.roleId || '';
        smsSendSingle(mob,
          roleLb + ' محترم شرکت پیشرو تجهیز فرتاک،\n' +
          'درخواست ' + cd + (target ? ' (' + target.co + ')' : '') + ' جهت «' + act + '» به کارتابل شما ارجاع شد. لطفاً از طریق سامانه مدیریت یکپارچه رسیدگی فرمایید.\n' + 'crm.pishtaj.ir'.replace('crm.pishtaj.ir', 'https://pishtaj.ir/crm/'),
          function (d) { addLog(d.ok && d.sent ? 'پیامک ارجاع به ' + toUser.name + ' ارسال شد' : 'پیامک ارجاع در صف ارسال قرار گرفت'); });
      } else addLog('⚠️ موبایل گیرنده ثبت نشده — پیامک ارسال نشد');
    }
    if (typeof audit === 'function') audit('استعلامات', 'ارجاع به ' + toUser.name + ' — ' + act, cd);
    hideModal();
    renderRfq();
    updateInboxBadge();
    alert('✅ ارجاع ثبت و اعلان ارسال شد');
  };

  /* ============ US-136 AC7: شفاف‌سازی پنل اقلام درخواست‌ها ============ */
  window.buildInquiries = function () {
    return '<div class="ph"><h3>🧾 اقلام درخواست‌ها (Inquiry Items)</h3>' +
      '<div class="sb2"><button class="bt" onclick="showInqItemModal()">+ افزودن قلم</button></div></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12.5px;color:#0c4a6e">' +
      'ℹ️ این بخش <b>ریز اقلام</b> هر شماره درخواست را نگه می‌دارد (از ایمپورت اکسل در ماژول کالاها یا افزودن دستی) تا هنگام صدور TO/CO با دکمه «بارگذاری اقلام درخواست» به‌طور خودکار وارد پیشنهاد شوند. فهرست خود استعلام‌ها در بخش «استعلامات» است.</div>' +
      '<div id="inqWrap"></div>';
  };

  window.showInqItemModal = function () {
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md">' +
      '<h3>➕ افزودن قلم به درخواست</h3>' +
      '<div class="fr"><div class="fld"><label>شماره درخواست *</label><input type="text" id="nIqNo" placeholder="مثال: RFQ-12345 یا شماره کارفرما" style="direction:ltr"></div>' +
      '<div class="fld"><label>نام کالا *</label><input type="text" id="nIqNm"></div></div>' +
      '<div class="fr"><div class="fld"><label>نام انگلیسی (روی TO/CO)</label><input type="text" id="nIqEn" style="direction:ltr"></div>' +
      '<div class="fld"><label>تعداد</label><input type="number" id="nIqQty" value="1"></div></div>' +
      '<div class="fr"><div class="fld"><label>واحد</label><select id="nIqUn"><option>عدد</option><option>شاخه</option><option>متر</option><option>کیلوگرم</option><option>ست</option><option>بسته</option></select></div>' +
      '<div class="fld"><label>استاندارد / مشخصه</label><input type="text" id="nIqSt" style="direction:ltr"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button><button class="bt" onclick="saveInqItem()">ثبت قلم</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.saveInqItem = function () {
    var no = document.getElementById('nIqNo').value.trim();
    var nm = document.getElementById('nIqNm').value.trim();
    if (!no || !nm) { alert('شماره درخواست و نام کالا الزامی است'); return; }
    var iq = getData('ptf_crm_inqitems');
    // US-174: قلم تکراری در همان شماره درخواست
    if (typeof ptfDupBlock === 'function' && ptfDupBlock('inqitem', { inqNo: no, nm: nm }, null)) return;
    iq.push({
      inqNo: no, cd: genCode('IQI'), nm: nm,
      en: document.getElementById('nIqEn').value.trim(),
      qty: +document.getElementById('nIqQty').value || 1,
      un: document.getElementById('nIqUn').value,
      st: document.getElementById('nIqSt').value.trim(),
      t: new Date().toLocaleDateString('fa-IR')
    });
    setData('ptf_crm_inqitems', iq);
    hideModal();
    if (typeof renderInquiries === 'function') renderInquiries();
    addLog('قلم «' + nm + '» به درخواست ' + no + ' افزوده شد');
  };

  /* ============ UI صندوق پیام + شروع پایش ============ */
  /* v122.2 (US-280): زنگوله ایموجی وسط نوار حذف شد — بج و پنل صندوق پیام روی زنگوله خطی مینیمال (tbBellBtn در theme.js) سوار می‌شود */
  function injectInboxUI() {
    if (document.getElementById('inboxPanel')) return;
    var bell = document.getElementById('tbBellBtn');
    if (!bell) { // theme.js هنوز آیکون‌ها را نساخته — تلاش مجدد کوتاه
      var n = (injectInboxUI._n = (injectInboxUI._n || 0) + 1);
      if (n < 40) setTimeout(injectInboxUI, 400);
      return;
    }
    bell.insertAdjacentHTML('beforeend',
      '<span id="ibBadge" style="display:none;position:absolute;top:-5px;left:-5px;background:#dc2626;color:#fff;font-size:10px;font-weight:900;min-width:18px;height:18px;border-radius:9px;place-items:center;padding:0 4px;border:2px solid #fff">0</span>');
    var wrap = bell.parentElement; // #tbIcons
    if (wrap && !wrap.style.position) wrap.style.position = 'relative';
    wrap.insertAdjacentHTML('beforeend',
      '<div id="inboxPanel" style="display:none;position:absolute;top:48px;right:0;width:min(360px,86vw);max-height:70vh;overflow:auto;background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.18);z-index:90">' +
      /* v13.1 (BUG-011): در موبایل پنل absolute نسبت به tbIcons بریده می‌شد (راست صفحه + عرض بیشتر از فضای باقیمانده)
         → در موبایل fixed تمام‌عرض زیر هدر */
      '<style>@media(max-width:768px){#inboxPanel{position:fixed!important;top:60px!important;left:8px!important;right:8px!important;width:auto!important;max-height:calc(100vh - 150px)!important;z-index:1550!important}}</style>' +
      '<div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center"><b style="font-size:13px">📬 صندوق پیام</b>' +
      '<button class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="goPanelByName(\'cart\');toggleInbox()">کارتابل ↗</button></div>' +
      '<div id="inboxList"></div></div>');
    document.addEventListener('click', function (e) {
      var p = document.getElementById('inboxPanel');
      if (p && p.style.display !== 'none' && !wrap.contains(e.target)) p.style.display = 'none';
    });
    if (typeof updateInboxBadge === 'function') updateInboxBadge();
  }

  function boot() {
    var s = curSession();
    if (!s.user) return;
    var token = '';
    try { token = localStorage.getItem('ptf_crm_token') || ''; } catch (e) {}
    if (!token) {
      try { if (typeof ptfToast === 'function') ptfToast('توکن سرور وجود ندارد؛ صندوق پیام سرور تا ورود مجدد غیرفعال است.', 'warn'); } catch (eT) {}
      return;
    }
    injectInboxUI();
    updateInboxBadge();
    syncServerInbox();
    checkDueReminders();
    updateInboxBadge();
    if (!window._ptfPollT) {
      // v33.0.1: no unauthenticated 401 polling loops.
      window._ptfPolling = false;
      window._ptfPollT = setInterval(function() {
        try { if (!localStorage.getItem('ptf_crm_token')) return; } catch (eTk) { return; }
        if (window._ptfPolling) return;
        window._ptfPolling = true;
        try { pollEvents(); } finally { window._ptfPolling = false; }
      }, 8000);
      window._ptfSyncing = false;
      window._ptfSyncT = setInterval(function () {
        try { if (!localStorage.getItem('ptf_crm_token')) return; } catch (eTk2) { return; }
        if (window._ptfSyncing) return;
        window._ptfSyncing = true;
        try { syncServerInbox(); } finally { window._ptfSyncing = false; }
      }, 45000);
    }
  }

  var tries = 0;
  var bt = setInterval(function () {
    tries++;
    var crmVisible = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (crmVisible) { boot(); clearInterval(bt); }
    if (tries > 60) clearInterval(bt);
  }, 300);
  var _showCrm2 = window.showCrm;
  if (_showCrm2) {
    window.showCrm = function () {
      _showCrm2();
      setTimeout(boot, 700);
    };
  }
})();
