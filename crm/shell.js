/* =====================================================================
   PTF CRM — Sprint 67
   US-112/115: PWA (نصب iOS/اندروید + دکمه نصب صفحه ورود + آفلاین)
   US-129: منوی دسته‌بندی آکاردئونی
   ===================================================================== */

/* ============ PWA: ثبت SW + پرامپت نصب ============ */
(function () {
  if ('serviceWorker' in navigator) {
    /* MOB-009: URL version باعث می‌شود مرورگر حتی زیر cache header طولانی،
       worker تازهٔ همان release را بررسی و نصب کند. */
    var release = window.PTF_CRM_RELEASE || window.VER || 'v34.8.41';
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(release), { scope: './' }).catch(function () {});
  }

  var deferredPrompt = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  function installBox() {
    var box = document.getElementById('pwaInstallBox');
    if (!box) return null;
    return box;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var box = installBox();
    if (box && !isStandalone) box.style.display = 'block';
  });

  window.ptfInstallApp = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (r) {
        if (r.outcome === 'accepted') {
          var box = installBox();
          if (box) box.style.display = 'none';
        }
        deferredPrompt = null;
      });
    } else if (isIOS) {
      ptfShowIosGuide();
    } else {
      alert('برای نصب: منوی مرورگر (⋮) → «افزودن به صفحه اصلی» یا «Install App»');
    }
  };

  window.ptfShowIosGuide = function () {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:grid;place-items:center;padding:20px';
    d.innerHTML = '<div style="background:#fff;border-radius:20px;padding:24px;max-width:340px;text-align:center;font-family:inherit">' +
      '<div style="font-size:38px;margin-bottom:8px">📲</div>' +
      '<h3 style="margin:0 0 10px;font-size:16px">نصب روی آیفون</h3>' +
      '<div style="text-align:right;font-size:13.5px;line-height:2.2;color:#334155">' +
      '۱. در نوار پایین Safari دکمه <b>Share</b> <span style="display:inline-block;border:1.5px solid #64748b;border-radius:5px;width:18px;height:18px;text-align:center;line-height:15px;font-size:11px">⬆</span> را بزنید<br>' +
      '۲. گزینه <b>Add to Home Screen</b> را انتخاب کنید<br>' +
      '۳. روی <b>Add</b> بزنید — تمام! آیکون CRM روی صفحه اصلی می‌آید</div>' +
      '<button onclick="this.closest(\'div\').parentElement.remove()" style="margin-top:14px;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;border:0;border-radius:12px;padding:10px 26px;font-family:inherit;font-weight:800;cursor:pointer">متوجه شدم</button></div>';
    document.body.appendChild(d);
  };

  // نمایش خودکار باکس نصب (AC1 US-115)
  document.addEventListener('DOMContentLoaded', function () {
    var box = installBox();
    if (!box) return;
    if (isStandalone) { box.style.display = 'none'; return; }  // AC4: نصب‌شده → مخفی
    if (isIOS) box.style.display = 'block';                     // iOS: همیشه با راهنما
    // اندروید/کروم: با beforeinstallprompt نمایان می‌شود
  });

  // نشانگر آنلاین/آفلاین
  function netBadge() {
    var b = document.getElementById('netBadge');
    if (!b) return;
    var on = navigator.onLine;
    b.textContent = on ? '' : '⚠️ آفلاین — تغییرات محلی ذخیره می‌شود';
    b.style.display = on ? 'none' : 'block';
  }
  window.addEventListener('online', netBadge);
  window.addEventListener('offline', netBadge);
  document.addEventListener('DOMContentLoaded', netBadge);
})();

/* ============ US-129: منوی دسته‌بندی آکاردئونی ============ */
(function () {
  var GROUPS = [
    // US-138 AC4: «کارتابل من» زیر داشبورد + شمارنده قرمز
    { id: 'g-dash', lb: '📊 داشبورد', items: ['dash', 'cart', 'ai'], single: true }, // US-298: «دستیار» زیر کارتابل
    // US-137 AC2: «مشتریان» (cust) از سیستم به فروش منتقل شد
    { id: 'g-sales', lb: '💼 فروش', items: ['leads', 'cust', 'rfq', 'off', 'deals'] },
    { id: 'g-supply', lb: '🛒 تامین', items: ['sup', 'rfqs'] }, // v13.7 US-336: buyq حذف — ادغام در درخواست تامین
    { id: 'g-goods', lb: '📦 کالا و اسناد', items: ['prod', 'surplus', 'chqprint', 'prj', 'let', 'cnt', 'taxret'] }, /* v33.6.0 CHQ-PRINT: «چاپ چک فیزیکی» به گروه کالا و اسناد اضافه شد | v34.7.80: «اظهارنامه‌ها» به گروه کالا و اسناد */
    { id: 'g-fin', lb: '💰 مالی', items: ['inv', 'recv', 'petty', 'anl'] }, // v14.0 BUG-014: fin قدیمی هم حذف (v13.9: orders)
    { id: 'g-me', lb: '👤 شخصی', items: ['rem'] },
    { id: 'g-sys', lb: '⚙️ سیستم', items: ['sms', 'cms', 'jobs', 'rep', 'users', 'set'] }
  ];
  window.PTF_NAV_GROUPS = GROUPS; /* v16.4 (US-361): منبع واحد گروه‌بندی برای تور آموزشی هماهنگ با آکاردئون */

  function applyAccordion() {
    var nav = document.querySelector('.sb-n');
    if (!nav || nav.getAttribute('data-acc')) return;
    var btns = {};
    nav.querySelectorAll('.sb-i').forEach(function (b) {
      var m = (b.getAttribute('onclick') || '').match(/goPanel\('([a-z]+)'/);
      if (m) btns[m[1]] = b;
    });
    if (!Object.keys(btns).length) return;

    var openG = localStorage.getItem('ptf_nav_open') || 'g-sales';
    var frag = document.createDocumentFragment();

    GROUPS.forEach(function (g) {
      var visible = g.items.filter(function (id) { return btns[id] && btns[id].style.display !== 'none'; });
      if (!visible.length) return; // AC4: دسته خالی (RBAC) مخفی
      if (g.single) { visible.forEach(function (id) { frag.appendChild(btns[id]); }); return; }

      var head = document.createElement('button');
      head.className = 'sb-g';
      head.setAttribute('data-g', g.id);
      /* US-285: تفکیک آیکون/متن سرگروه برای موبایل (gi/gt) — دسکتاپ همان نمایش قبلی */
      var gParts = g.lb.split(' ');
      var gIcon = gParts.shift();
      head.innerHTML = '<span class="gi">' + gIcon + '</span><span class="gt">' + gParts.join(' ') + '</span><span class="gb" id="gb-' + g.id + '"></span><span class="ar">▾</span>';
      var wrap = document.createElement('div');
      wrap.className = 'sb-gw' + (openG === g.id ? ' open' : '');
      wrap.id = 'gw-' + g.id;
      visible.forEach(function (id) { wrap.appendChild(btns[id]); });
      head.onclick = function () {
        var was = wrap.classList.contains('open');
        nav.querySelectorAll('.sb-gw').forEach(function (w) { w.classList.remove('open'); });
        nav.querySelectorAll('.sb-g').forEach(function (h) { h.classList.remove('act'); });
        if (!was) {
          wrap.classList.add('open');
          head.classList.add('act');
          localStorage.setItem('ptf_nav_open', g.id);
        }
      };
      if (openG === g.id) head.classList.add('act');
      frag.appendChild(head);
      frag.appendChild(wrap);
    });

    /* v31.7.18 BUG-NAV-ORPHAN-001: پنل‌هایی که در GROUPS تعریف نشده‌اند دیگر بی‌صدا حذف نمی‌شوند —
       به انتهای منو اضافه می‌شوند تا ماژول جدیدِ فراموش‌شده همیشه قابل دسترس بماند. */
    var grouped = {};
    GROUPS.forEach(function (g) { g.items.forEach(function (id) { grouped[id] = 1; }); });
    Object.keys(btns).forEach(function (id) {
      if (!grouped[id] && btns[id].style.display !== 'none') frag.appendChild(btns[id]);
    });
    // پاکسازی: برچسب‌های nl قدیمی و آیتم‌های جامانده حذف؛ ساختار جدید درج
    nav.querySelectorAll('.nl').forEach(function (n) { n.remove(); });
    nav.innerHTML = '';
    nav.appendChild(frag);
    nav.setAttribute('data-acc', '1');
    updateGroupBadges();
  }

  // AC3: جمع بج‌ها روی سر دسته
  window.updateGroupBadges = function () {
    var map = { 'g-sales': ['ldBadge'], 'g-me': ['rmBadge'] };
    Object.keys(map).forEach(function (gid) {
      var sum = 0;
      map[gid].forEach(function (bid) {
        var b = document.getElementById(bid);
        if (b && b.style.display !== 'none') sum += +b.textContent || 0;
      });
      var gb = document.getElementById('gb-' + gid);
      if (gb) { gb.textContent = sum || ''; gb.style.display = sum ? 'inline-grid' : 'none'; }
    });
  };

  // استایل
  var css = document.createElement('style');
  css.textContent =
    '.sb-g{display:flex;align-items:center;gap:6px;width:100%;text-align:right;background:none;border:0;color:#cbd5e1;font-family:inherit;font-size:13.5px;font-weight:800;padding:11px 14px;cursor:pointer;border-radius:12px;transition:.2s}' +
    '.sb-g .gi,.sb-g .gt{display:inline-block}' +
    '.sb-g:hover{background:rgba(255,255,255,.06)}' +
    '.sb-g.act{color:#ffb033}' +
    '.sb-g .ar{margin-right:auto;transition:.25s;font-size:11px}' +
    '.sb-g.act .ar{transform:rotate(180deg)}' +
    '.sb-g .gb{display:none;background:#ef4b1a;color:#fff;font-size:10px;min-width:17px;height:17px;border-radius:9px;place-items:center;padding:0 4px}' +
    '.sb-gw{max-height:0;overflow:hidden;transition:max-height .3s ease}' +
    '.sb-gw.open{max-height:400px}' +
    '.sb-gw .sb-i{padding-right:26px;font-size:13px}' +
    '@media(max-width:900px){' +
'.sb{width:56px!important;min-width:56px!important;max-width:56px!important;overflow-x:hidden!important}' +
'.sb-g{width:50px!important;height:46px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;padding:2px 0!important;margin:6px auto 2px auto!important;background:var(--crd,#f1f5f9)!important;border:1px solid var(--brd)!important;line-height:1.1!important}' +
'.sb-g .gi{display:grid!important;place-items:center!important;margin:0 auto!important;font-size:17px!important}' +
'.sb-g .gt{display:block!important;font-size:9px!important;font-weight:900!important;color:var(--tx,#334155)!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:46px!important}' +
'.sb-g .ar,.sb-g .gb{display:none!important}' +
'.sb-gw{display:block!important;max-height:none!important;overflow:visible!important}' +
'.sb-gw .sb-i{width:100%!important;height:38px!important;display:flex!important;justify-content:center!important;align-items:center!important;padding:0!important;margin:3px 0!important}' +
/* US-285: فقط فرزند مستقیم مخفی شود — SVGهای iconx داخل .ic زنده بمانند (رفع «آیکون‌های زیرشاخه دیده نمی‌شوند») */
'.sb-i .lb,.sb-i > span:not(.ic),.nl{display:none!important}' +
'.sb-i .ic{font-size:22px!important;width:28px!important;height:28px!important;margin:0 auto!important}' +
'.sb-i .ic span[data-ix]{display:inline-flex!important}' +
'};'
  document.head.appendChild(css);

  // اجرا بعد از applyRbac (که display آیتم‌ها را ست می‌کند)
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var crmVisible = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (crmVisible) { applyAccordion(); clearInterval(t); }
    if (tries > 40) clearInterval(t);
  }, 250);
  // پس از هر لاگین
  var _showCrm = window.showCrm;
  if (_showCrm) {
    window.showCrm = function () {
      _showCrm();
      setTimeout(applyAccordion, 500);
    };
  }
})();

// Sprint 119 / US-121: تزریق خودکار دکمه کنترل شناور و پین‌شده در تمام پنجره‌های مودال
window.ptfCloseActiveModal = function(btn) {
  var mb = btn.closest('.md-b') || btn.closest('.ptfdlg-b') || btn.closest('.md');
  if (mb) {
    var p = mb.closest('.md-b') || mb.closest('.ptfdlg-b') || mb;
    p.remove();
  }
  if (typeof hideModal === 'function') hideModal();
};

/* v122.2 (US-280): دکمه بستن قدیمی شناور حذف شد — دکمه‌های مک‌استایل modalx.js جایگزین کامل هستند.
   تابع به پاک‌کننده تبدیل شد تا اگر جایی .md-ctrls قدیمی مانده بود حذفش کند (setInterval قبلی هم حذف شد). */
window.ptfEnsureStickyModalControls = function() {
  document.querySelectorAll('.md .md-ctrls').forEach(function(el) { el.remove(); });
};
