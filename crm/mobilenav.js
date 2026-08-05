/* =====================================================================
   PTF CRM — mobilenav.js — v123.0 — بسته ناوبری موبایل (مصوب کارفرما)
   US-286: نوار ناوبری پایین (Bottom Tab Bar) به‌جای سایدبار در موبایل
           داشبورد | کارتابل (بج) | فروش | تامین | بیشتر (کشوی تمام‌صفحه)
   US-287: هدر موبایل تک‌ردیفه (مخفی‌سازی ساعت/سلامت، فشرده‌سازی)
   US-290: جستجو در کشوی «بیشتر» + مخفی‌سازی برچسب Ctrl+K در موبایل
   الگو: فقط CSS + DOM injection — سایدبار دسکتاپ دست نمی‌خورد؛
   در موبایل سایدبار مخفی و عرض کامل صفحه آزاد می‌شود.
   بدون setInterval (رویداد resize + هوک goPanel/showCrm).
   ===================================================================== */
(function () {
  'use strict';

  var BP = 768; // نقطه شکست موبایل

  function isMob() { return window.innerWidth <= BP; }

  /* ---------- ساختار تب‌ها (id پنل‌ها مطابق goPanel) ---------- */
  function svgi(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;display:block;margin:0 auto">' + p + '</svg>'; }

  /* v13.0 (US-319 — دستور کارفرما): ترتیب جدید — داشبورد | کارتابل | پیشنهاد (برجسته FAB) | دستیار | سایر */
  var TABS = [
    { id: 'dash', lb: 'داشبورد', ic: svgi('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>') },
    { id: 'cart', lb: 'کارتابل', ic: svgi('<path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2.2 2.2 0 004 0"/>'), badge: 'mnvBadge' },
    { id: 'off', lb: 'پیشنهاد', ic: svgi('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>'), fab: true },
    { id: 'ai', lb: 'دستیار', ic: svgi('<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4M9 4h6"/><path d="M9.5 13h.01M14.5 13h.01"/><path d="M9.5 16.5h5"/>') },
    { id: '_more', lb: 'سایر', ic: svgi('<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>') }
  ];

  /* پنل‌هایی که عضو هر تب گروهی هستند (برای هایلایت تب هنگام ناوبری) */
  var TAB_OF = {
    dash: 'dash', cart: 'cart', off: 'off', ai: 'ai'
  };

  /* ---------- کشوی «بیشتر»: همه ماژول‌ها از روی سایدبار واقعی (RBAC اعمال‌شده) ---------- */
  function buildMoreSheet() {
    var old = document.getElementById('mnvMore');
    if (old) old.remove();
    var items = [];
    document.querySelectorAll('.sb-n .sb-i').forEach(function (b) {
      if (b.style.display === 'none') return; // RBAC
      var m = (b.getAttribute('onclick') || '').match(/goPanel\('([a-z]+)'/);
      if (!m) return;
      var ic = b.querySelector('.ic');
      var lb = b.querySelector('.lb');
      items.push({ id: m[1], ic: ic ? ic.innerHTML : '•', lb: lb ? lb.textContent : m[1] });
    });
    /* v13.0: آیکون‌های رنگی — پالت چرخشی هماهنگ لانچر */
    var PAL = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#d946ef'];
    var grid = items.map(function (it, i) {
      return '<button type="button" class="mnv-mi" onclick="ptfMnvGo(\'' + it.id + '\')">' +
        '<span class="mnv-mic" style="color:' + PAL[i % PAL.length] + '">' + it.ic + '</span><span class="mnv-mlb">' + it.lb + '</span></button>';
    }).join('');
    var html =
      '<div id="mnvMore" class="mnv-more" onclick="if(event.target===this)ptfMnvMore(false)">' +
      '<div class="mnv-sheet">' +
      '<div class="mnv-grip"></div>' +
      /* US-290: جستجوی سرتاسری در دسترس شست */
      '<button type="button" class="mnv-srch" onclick="ptfMnvMore(false);if(typeof ptfOpenCommandPalette===\'function\')ptfOpenCommandPalette()">' +
      svgi('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5L16 16"/>') + '<span>جستجوی سریع سرتاسری</span></button>' +
      '<div class="mnv-grid">' + grid + '</div>' +
      '<button type="button" class="mnv-out" onclick="if(typeof doLogout===\'function\')doLogout()">خروج از حساب</button>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  window.ptfMnvMore = function (open) {
    var el = document.getElementById('mnvMore');
    if (open) {
      buildMoreSheet();
      el = document.getElementById('mnvMore');
      requestAnimationFrame(function () { el.classList.add('on'); });
    } else if (el) {
      el.classList.remove('on');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }
  };

  window.ptfMnvGo = function (id) {
    ptfMnvMore(false);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (eV) {} /* v31.7.17: بازخورد هپتیک ظریف */
    if (typeof goPanel === 'function') goPanel(id);
    highlight(id);
  };

  function highlight(panelId) {
    var tab = TAB_OF[panelId] || '_more';
    document.querySelectorAll('.mnv-tab').forEach(function (t) {
      t.classList.toggle('act', t.getAttribute('data-tab') === tab);
    });
  }

  /* ---------- ساخت نوار پایین ---------- */
  function buildBar() {
    if (document.getElementById('mnvBar')) return;
    var html = TABS.map(function (t) {
      var act = t.id === 'dash' ? ' act' : '';
      var badge = t.badge ? '<span class="mnv-bdg" id="' + t.badge + '" style="display:none">0</span>' : '';
      var click = t.id === '_more' ? 'ptfMnvMore(true)' : 'ptfMnvGo(\'' + t.id + '\')';
      /* v13.0: تب FAB (پیشنهاد) — دایره برجسته نیم‌بیرون‌زده از نوار به داخل فضای پنل */
      if (t.fab) {
        return '<button type="button" class="mnv-tab mnv-fabwrap" data-tab="' + t.id + '" onclick="' + click + '">' +
          '<span class="mnv-fab">' + t.ic + '</span><span class="mnv-lb mnv-fablb">' + t.lb + '</span></button>';
      }
      return '<button type="button" class="mnv-tab' + act + '" data-tab="' + t.id + '" onclick="' + click + '">' +
        '<span class="mnv-ic">' + t.ic + badge + '</span><span class="mnv-lb">' + t.lb + '</span></button>';
    }).join('');
    var bar = document.createElement('nav');
    bar.id = 'mnvBar';
    bar.innerHTML = html;
    document.body.appendChild(bar);
  }

  /* ---------- بج کارتابل: بازتاب ctBadge سایدبار ---------- */
  function syncBadge() {
    var src = document.getElementById('ctBadge');
    var dst = document.getElementById('mnvBadge');
    if (!src || !dst) return;
    dst.textContent = src.textContent;
    dst.style.display = src.style.display === 'none' ? 'none' : '';
  }
  var badgeMo = null;
  function watchBadge() {
    var src = document.getElementById('ctBadge');
    if (!src || badgeMo) return;
    badgeMo = new MutationObserver(syncBadge);
    badgeMo.observe(src, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    syncBadge();
  }

  /* ---------- استایل ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#mnvBar{display:none}' +
    '@media(max-width:' + BP + 'px){' +
    /* US-286: سایدبار مخفی — عرض کامل آزاد */
    '.sb{display:none!important}' +
    '.mn{margin-right:0!important;width:100%!important;max-width:100%!important}' +
    /* جا برای نوار پایین + ناحیه امن iPhone */
    '.ca{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}' +
    /* نوار پایین */
    '#mnvBar{position:fixed;bottom:0;left:0;right:0;z-index:1500;display:flex;justify-content:space-around;align-items:stretch;' +
      'background:var(--crd,#fff);border-top:1px solid var(--brd,#e8ebf0);box-shadow:0 -6px 24px rgba(15,23,42,.08);' +
      'padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px))}' +
    /* v31.7.17 US-MNV-DELIGHT: انیمیشن تب فعال به سبک اپ‌های مالی مدرن (مرجع بصری کارفرما)
       — آیکون تب فعال کمی بالا می‌آید و داخل pill رنگی می‌نشیند؛ لیبل bold و رنگی می‌شود.
       فقط transform/opacity (GPU-safe، بدون reflow) + احترام به prefers-reduced-motion. */
    '.mnv-tab{flex:1;background:none;border:0;cursor:pointer;color:#94a3b8;font-family:inherit;padding:4px 2px;border-radius:12px;position:relative;min-height:52px!important;-webkit-tap-highlight-color:transparent}' +
    '.mnv-tab .mnv-ic{position:relative;display:block;width:44px;margin:0 auto;padding:5px 0;border-radius:14px;transition:transform .28s cubic-bezier(.34,1.56,.64,1),background .22s,color .22s}' +
    '.mnv-tab .mnv-lb{display:block;font-size:10px;font-weight:700;margin-top:3px;text-align:center;transition:color .22s,font-weight .22s,transform .28s cubic-bezier(.34,1.56,.64,1)}' +
    '.mnv-tab.act{color:var(--pri,#ef4b1a)}' +
    '.mnv-tab.act .mnv-ic{transform:translateY(-4px);background:linear-gradient(135deg,rgba(239,75,26,.14),rgba(247,148,0,.10))}' +
    '.mnv-tab.act .mnv-lb{font-weight:900;transform:translateY(-2px)}' +
    '.mnv-tab:active .mnv-ic{transform:scale(.88)}' +
    /* نقطه نشانگر زیر تب فعال */
    '.mnv-tab.act::after{content:"";position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--pri,#ef4b1a)}' +
    '.mnv-fabwrap.act::after{display:none}' +
    '@media(prefers-reduced-motion:reduce){.mnv-tab .mnv-ic,.mnv-tab .mnv-lb,.mnv-fab{transition:none!important;animation:none!important}}' +
    '.mnv-bdg{position:absolute;top:-4px;left:-8px;background:#dc2626;color:#fff;font-size:9px;font-weight:900;min-width:16px;height:16px;border-radius:8px;display:grid;place-items:center;padding:0 4px;border:2px solid var(--crd,#fff)}' +
    /* v13.0: FAB پیشنهاد — دایره نیم‌بیرون‌زده به فضای پنل */
    '#mnvBar{overflow:visible}' +
    '.mnv-fabwrap{overflow:visible;position:relative}' +
    '.mnv-fab{position:absolute;top:-26px;left:50%;transform:translateX(-50%);width:54px;height:54px;border-radius:50%;' +
      'background:linear-gradient(135deg,var(--pri,#ef4b1a),var(--org,#f79400));color:#fff;display:grid;place-items:center;' +
      'box-shadow:0 8px 22px rgba(239,75,26,.42),0 0 0 5px var(--crd,#fff);}' +
    '.mnv-fab svg{width:25px!important;height:25px!important;stroke-width:2!important}' +
    '.mnv-fablb{margin-top:26px!important;color:var(--pri,#ef4b1a)!important;font-weight:900!important}' +
    '.mnv-fabwrap.act .mnv-fab{filter:brightness(1.12)}' +
    /* v31.7.17: نفس‌کشیدن ملایم FAB + فشردن لمسی */
    '@keyframes mnvFabPulse{0%,100%{box-shadow:0 8px 22px rgba(239,75,26,.42),0 0 0 5px var(--crd,#fff)}50%{box-shadow:0 10px 28px rgba(239,75,26,.55),0 0 0 5px var(--crd,#fff)}}' +
    '.mnv-fab{transition:transform .22s cubic-bezier(.34,1.56,.64,1);animation:mnvFabPulse 3.2s ease-in-out infinite}' +
    '.mnv-fabwrap:active .mnv-fab{transform:translateX(-50%) scale(.9)}' +
    /* v31.7.17 A5: ورود نرم پنل هنگام تعویض ماژول — فقط transform/opacity */
    '@keyframes mnvPanelIn{from{opacity:.35;transform:translateY(10px)}to{opacity:1;transform:none}}' +
    '.pn{animation:mnvPanelIn .18s ease-out}' +
    '@media(prefers-reduced-motion:reduce){.pn{animation:none!important}}' +
    /* US-287: هدر تک‌ردیفه فشرده */
    '#clockD,#liveHealthPill{display:none!important}' +
    '.tb{padding:8px 12px!important;flex-wrap:nowrap!important}' + /* v31.7.19: overflow:hidden حذف شد — بج‌ها را می‌برید؛ مهار سرریز با min-width/ellipsis بچه‌هاست */
    '.tb h2{font-size:15px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}' +
    /* v31.7.18 BUG-HDR-MOBILE-001 + v31.7.19 BUG-HDR-MOBILE-002 (اسکرین‌شات دوم کارفرما):
       overflow:hidden سراسری، بج نسخه و بج زنگ را می‌برید («.7.18» و بج 67 بریده).
       راه‌حل نهایی: مینیمال‌سازی هدر موبایل — فقط جستجو/زنگ/تم؛ بج نسخه ellipsis؛ بدون clip بج‌ها. */
    '.tb>div{min-width:0;flex-shrink:1}' +
    '#topVerPill{white-space:nowrap!important;font-size:10px!important;padding:3px 8px!important;max-width:96px;overflow:hidden;text-overflow:ellipsis;direction:ltr}' +
    '.tb .tbic{width:36px!important;height:36px!important;flex:none;overflow:visible}' +
    '.tb .tbic svg{display:block!important;margin:auto!important;width:17px!important;height:17px!important}' +
    /* بایگانی/ابر در موبایل از کشوی «سایر» در دسترس‌اند — هدر خلوت و منظم */
    '.tb .tbic[title="بایگانی"],.tb .tbic[title="فضای ابری"]{display:none!important}' +
    '#trialBarWrap,#trialBarWrap *{max-width:100%;overflow-wrap:break-word}' +
    /* US-290: دکمه جستجوی هدر در موبایل فقط آیکون (SVG مینیمال iconx زنده می‌ماند) + مخفی‌سازی متن و Ctrl+K */
    '.tb button[onclick*="ptfOpenCommandPalette"]{padding:8px 10px!important;font-size:0!important;gap:0!important;min-height:40px!important}' +
    '.tb button[onclick*="ptfOpenCommandPalette"] span{display:none!important}' +
    '.tb button[onclick*="ptfOpenCommandPalette"] span[data-ix]{display:inline-flex!important}' +
    '.tb button[onclick*="ptfOpenCommandPalette"] span[data-ix] svg{width:17px!important;height:17px!important}' +
    /* کشوی بیشتر */
    '.mnv-more{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:1600;opacity:0;transition:opacity .2s;backdrop-filter:blur(3px)}' +
    '.mnv-more.on{opacity:1}' +
    '.mnv-sheet{position:absolute;bottom:0;left:0;right:0;background:var(--crd,#fff);border-radius:22px 22px 0 0;padding:10px 14px calc(16px + env(safe-area-inset-bottom,0px));max-height:78vh;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;transform:translateY(100%);transition:transform .22s ease}' + /* v13.0: قفل اسکرول افقی */
    '.mnv-more.on .mnv-sheet{transform:translateY(0)}' +
    '.mnv-grip{width:44px;height:5px;border-radius:3px;background:var(--brd,#e2e8f0);margin:2px auto 12px}' +
    '.mnv-srch{display:flex;align-items:center;gap:10px;width:100%;background:var(--bg,#f1f5f9);border:1px solid var(--brd,#e8ebf0);border-radius:14px;padding:12px 14px;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--tx,#334155);cursor:pointer;margin-bottom:12px}' +
    '.mnv-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;max-width:100%;overflow-x:hidden}' + /* v13.0 */
    '.mnv-mi{min-width:0}' + /* گرید آیتم‌ها هرگز از عرض بیرون نمی‌زنند */
    '.mnv-mi{background:var(--bg,#f8fafc);border:1px solid var(--brd,#e8ebf0);border-radius:14px;padding:10px 4px;cursor:pointer;font-family:inherit;color:var(--tx,#334155);min-height:64px!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}' +
    '.mnv-mic{font-size:20px;display:grid;place-items:center;height:24px}' +
    '.mnv-mic svg{width:22px;height:22px}' +
    '.mnv-mic span[data-ix]{display:inline-flex!important}' +
    '.mnv-mlb{font-size:10px;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.mnv-out{width:100%;margin-top:12px;background:none;border:1px solid #fecaca;color:#dc2626;border-radius:14px;padding:12px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}' +
    /* حالت شب */
    'body.ptf-dark #mnvBar{background:#0f172a;border-top-color:#1e293b;box-shadow:0 -6px 24px rgba(0,0,0,.4)}' +
    'body.ptf-dark .mnv-tab{color:#64748b}' +
    'body.ptf-dark .mnv-tab.act{color:#ffb033}' +
    'body.ptf-dark .mnv-sheet{background:#0f172a}' +
    'body.ptf-dark .mnv-mi,body.ptf-dark .mnv-srch{background:#1e293b;border-color:#334155;color:#e2e8f0}' +
    'body.ptf-dark .mnv-fab{box-shadow:0 8px 22px rgba(239,75,26,.5),0 0 0 5px #0f172a}' +
    '}';
  document.head.appendChild(css);

  /* ---------- هوک هایلایت روی goPanel ---------- */
  function hookGoPanel() {
    if (window._mnvHooked) return;
    var _go = window.goPanel;
    if (typeof _go !== 'function') return;
    window._mnvHooked = true;
    window.goPanel = function (id, btn) {
      _go(id, btn);
      highlight(id);
    };
  }

  /* ---------- بوت ---------- */
  function boot() {
    var crmVisible = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (!crmVisible) return false;
    buildBar();
    hookGoPanel();
    watchBadge();
    return true;
  }
  // بدون polling دائمی: تلاش محدود اولیه (سازگار با الگوی بقیه ماژول‌ها) + هوک لاگین
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (boot() || tries > 60) clearInterval(t);
  }, 300);
  var _showCrm = window.showCrm;
  if (typeof _showCrm === 'function') {
    window.showCrm = function () {
      _showCrm();
      setTimeout(boot, 700);
    };
  }
})();
