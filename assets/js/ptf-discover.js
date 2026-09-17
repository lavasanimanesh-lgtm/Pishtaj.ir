(function () {
  function prefix() {
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (/\.html$/.test(parts[parts.length - 1])) parts.pop();
    return parts.map(function () { return ".."; }).join("/") + (parts.length ? "/" : "");
  }
  function insertBeforeContact(nav, node) {
    var before = nav.querySelector('a[href*="#contact"]') || nav.querySelector(".nav-search");
    if (before) nav.insertBefore(node, before);
    else nav.appendChild(node);
  }
  function ensureSearchLink() {
    var nav = document.getElementById("mainNav");
    if (!nav || nav.querySelector(".nav-search")) return;
    if (document.querySelector(".site-header .hdr-search")) return; /* header already has magnifier icon — text pill is redundant */
    var a = document.createElement("a");
    a.className = "nav-search";
    a.href = prefix() + "search/";
    a.textContent = "جستجو";
    nav.appendChild(a);
  }

  /* Keep the theme control in the mobile sheet, but visually group it with
     search + language in the desktop header. Moving the same node preserves
     its id, event listener and ARIA state; no duplicate control is created. */
  var mqHeaderActions = window.matchMedia ? window.matchMedia("(min-width:791px)") : { matches: true };
  function syncHeaderActions() {
    var nav = document.getElementById("mainNav");
    var actions = document.querySelector(".site-header .hdr-actions");
    var theme = document.getElementById("ptfThemeToggle");
    if (!nav || !actions || !theme) return;
    if (mqHeaderActions.matches) {
      if (theme.parentNode !== actions) actions.insertBefore(theme, actions.firstChild);
    } else if (theme.parentNode !== nav) {
      nav.appendChild(theme);
    }
  }
  function bindHeaderActions() {
    syncHeaderActions();
    if (mqHeaderActions.addEventListener) mqHeaderActions.addEventListener("change", syncHeaderActions);
    else if (mqHeaderActions.addListener) mqHeaderActions.addListener(syncHeaderActions);
  }

  function pageLang() {
    var html = (document.documentElement.lang || "").toLowerCase();
    var known = ["ar", "en", "tr", "de", "fr", "zh", "ru"];
    for (var i = 0; i < known.length; i++) {
      if (html.indexOf(known[i]) === 0) return known[i];
    }
    var path = location.pathname || "";
    for (i = 0; i < known.length; i++) {
      if (new RegExp("\\/" + known[i] + "(\\/|$)").test(path)) return known[i];
    }
    return "fa";
  }
  function isNonFa() {
    return pageLang() !== "fa";
  }

  var FLAG_IR = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="15" fill="#239f40"/><rect y="15" width="60" height="15" fill="#fff"/><rect y="30" width="60" height="15" fill="#da0000"/></svg>';
  var FLAG_UK = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="45" fill="#012169"/><path d="M0 0L60 45M60 0L0 45" stroke="#fff" stroke-width="10"/><path d="M0 0L60 45M60 0L0 45" stroke="#C8102E" stroke-width="4"/><path d="M30 0V45M0 22.5H60" stroke="#fff" stroke-width="12"/><path d="M30 0V45M0 22.5H60" stroke="#C8102E" stroke-width="8"/></svg>';
  var FLAG_SA = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="45" rx="2" fill="#006C35"/><g fill="#fff"><path d="M11 13.5c2.2-3.4 8.2-5.2 14.2-2.4 3.2 1.4 7.4 1.1 10.6-1.2 2.4 2.6 7.4 4.6 14.2 2.6-1.6 2.8-7.4 4.6-13.6 2.2-3.8-1.4-7.8-.8-10.8 1.2-3.8 2.4-8.2 1.6-14.6-2.4z"/><path d="M13 20c3.2-2 8.4-2.4 12.6.2 4 2.2 9.2 1.6 14.4-1.2-1.2 2.8-6.2 4.8-12 2.8-3.8-1.2-7.8-.8-10.8 1.2-2.6.4-5.4-.4-4.2-3z"/><rect x="13" y="27.2" width="28" height="2.3" rx="1.1"/><path d="M41 25.4l8 2.9-8 2.9z"/><path d="M15.2 26.2c-2.4 1.2-2.4 3.2 0 4.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></g></svg>';
  var FLAG_TR = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="45" rx="2" fill="#E30A17"/><circle cx="23" cy="22.5" r="10" fill="#fff"/><circle cx="26.5" cy="22.5" r="8" fill="#E30A17"/><polygon fill="#fff" points="36.2,22.5 32.6,24.7 33.8,20.6 31,18.2 35.2,18.6 36.2,14.6 37.2,18.6 41.4,18.2 38.6,20.6 39.8,24.7"/></svg>';
  var FLAG_DE = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="15" fill="#000"/><rect y="15" width="60" height="15" fill="#D00"/><rect y="30" width="60" height="15" fill="#FFCE00"/></svg>';
  var FLAG_FR = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="20" height="45" fill="#002395"/><rect x="20" width="20" height="45" fill="#fff"/><rect x="40" width="20" height="45" fill="#ED2939"/></svg>';
  var FLAG_CN = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="45" rx="2" fill="#DE2910"/><polygon fill="#FFDE00" points="12,9 13.8,14.4 19.5,14.4 14.9,17.7 16.6,23.1 12,19.8 7.4,23.1 9.1,17.7 4.5,14.4 10.2,14.4"/><polygon fill="#FFDE00" points="22,8 23.1,11.2 26.5,11.2 23.8,13.2 24.8,16.4 22,14.4 19.2,16.4 20.2,13.2 17.5,11.2 20.9,11.2"/><polygon fill="#FFDE00" points="26,14 27.1,17.2 30.5,17.2 27.8,19.2 28.8,22.4 26,20.4 23.2,22.4 24.2,19.2 21.5,17.2 24.9,17.2"/><polygon fill="#FFDE00" points="26,22 27.1,25.2 30.5,25.2 27.8,27.2 28.8,30.4 26,28.4 23.2,30.4 24.2,27.2 21.5,25.2 24.9,25.2"/><polygon fill="#FFDE00" points="22,28 23.1,31.2 26.5,31.2 23.8,33.2 24.8,36.4 22,34.4 19.2,36.4 20.2,33.2 17.5,31.2 20.9,31.2"/></svg>';
  var FLAG_RU = '<svg viewBox="0 0 60 45" width="22" height="16" aria-hidden="true" focusable="false"><rect width="60" height="15" fill="#fff"/><rect y="15" width="60" height="15" fill="#0039A6"/><rect y="30" width="60" height="15" fill="#D52B1E"/></svg>';

  var LANG_CSS =
    ".site-header,.nav-wrap,.hdr-actions{overflow:visible!important}" +
    ".ptf-lang{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;z-index:10080}" +
    ".ptf-lang-panel{position:absolute;top:calc(100% + 8px);inset-inline-start:0;min-width:188px;max-height:min(70vh,420px);overflow:auto;padding:8px;border-radius:16px;background:#fff;border:1px solid rgba(15,23,42,.10);box-shadow:0 18px 40px rgba(15,23,42,.16);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(8px);transition:opacity .22s ease,transform .22s cubic-bezier(.16,1,.3,1),visibility .22s;display:grid;gap:4px;z-index:10080}" +
    ".ptf-lang.open .ptf-lang-panel{opacity:1;visibility:visible;pointer-events:auto;transform:none}" +
    ".ptf-lang-panel a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;text-decoration:none;color:#1e293b;font-weight:800;font-size:13.5px;white-space:nowrap;min-height:44px}" +
    ".ptf-lang-panel a:hover,.ptf-lang-panel a:focus-visible{background:rgba(239,75,26,.08);color:#c73616}" +
    ".ptf-lang-panel svg{border-radius:3px;box-shadow:0 0 0 1px rgba(15,23,42,.08);flex:0 0 auto;display:block}" +
    "html.ptf-dark .ptf-lang-panel{background:#101b30;border-color:rgba(255,255,255,.1);box-shadow:0 18px 40px rgba(0,0,0,.45)}" +
    "html.ptf-dark .ptf-lang-panel a{color:#e8eef8}" +
    "html.ptf-dark .ptf-lang-panel a:hover{background:rgba(247,148,0,.14);color:#ffb033}" +
    "@media(max-width:790px){.ptf-lang-panel{position:fixed;top:72px;left:10px;right:auto;inset-inline-start:auto;min-width:200px;transform:none}.ptf-lang.open .ptf-lang-panel{transform:none}}" +
    "@media(prefers-reduced-motion:reduce){.ptf-lang-panel{transition:none}}";

  function ensureLangCss() {
    if (document.getElementById("ptf-lang-css")) return;
    var s = document.createElement("style");
    s.id = "ptf-lang-css";
    s.textContent = LANG_CSS;
    document.head.appendChild(s);
  }

  function bindLangMenu(wrap) {
    if (!wrap || wrap.getAttribute("data-lang-bound")) return;
    wrap.setAttribute("data-lang-bound", "1");
    var btn = wrap.querySelector(".lang-switch");
    function setOpen(on) {
      wrap.classList.toggle("open", !!on);
      if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
    }
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(!wrap.classList.contains("open"));
      }, true);
    }
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function langItems() {
    var p = prefix();
    return [
      { id: "fa", href: p || "./", label: "فارسی", flag: FLAG_IR },
      { id: "en", href: p + "en/", label: "English", flag: FLAG_UK },
      { id: "ar", href: p + "ar/", label: "العربية", flag: FLAG_SA },
      { id: "tr", href: p + "tr/", label: "Türkçe", flag: FLAG_TR },
      { id: "de", href: p + "de/", label: "Deutsch", flag: FLAG_DE },
      { id: "fr", href: p + "fr/", label: "Français", flag: FLAG_FR },
      { id: "zh", href: p + "zh/", label: "中文", flag: FLAG_CN },
      { id: "ru", href: p + "ru/", label: "Русский", flag: FLAG_RU }
    ];
  }
  function fillLangPanel(panel) {
    var cur = pageLang();
    panel.innerHTML = "";
    langItems().forEach(function (it) {
      if (it.id === cur) return;
      var a = document.createElement("a");
      a.href = it.href;
      a.setAttribute("role", "menuitem");
      a.innerHTML = it.flag + "<span>" + it.label + "</span>";
      panel.appendChild(a);
    });
  }
  function ensureLangMenu() {
    ensureLangCss();
    var existing = document.querySelector(".site-header .ptf-lang");
    if (existing) {
      var panelEx = existing.querySelector(".ptf-lang-panel");
      if (panelEx) fillLangPanel(panelEx);
      bindLangMenu(existing);
      return;
    }
    var link = document.querySelector(".site-header a.lang-switch, .site-header button.lang-switch");
    if (!link) return;
    var wrap = document.createElement("div");
    wrap.className = "ptf-lang";
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);
    link.setAttribute("aria-haspopup", "true");
    link.setAttribute("aria-expanded", "false");
    var panel = document.createElement("div");
    panel.className = "ptf-lang-panel";
    panel.setAttribute("role", "menu");
    fillLangPanel(panel);
    wrap.appendChild(panel);
    bindLangMenu(wrap);
  }

  function ensureCareersLink() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    if (isNonFa()) return;
    function apply(d) {
      var existing = nav.querySelector(".nav-careers");
      var count = d && d.count ? +d.count : 0;
      if (count < 1) {
        if (existing) existing.remove();
        return;
      }
      if (existing) {
        existing.href = prefix() + "careers/";
        return;
      }
      var a = document.createElement("a");
      a.className = "nav-careers";
      a.href = prefix() + "careers/";
      a.textContent = "فرصت شغلی";
      insertBeforeContact(nav, a);
    }
    fetch(prefix() + "api/careers.php?action=published", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(apply)
      .catch(function () {
        fetch(prefix() + "careers/status.json", { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : { count: 0 }; })
          .then(apply)
          .catch(function () {});
      });
  }

  var PRODUCT_MENU = [
    {
      t: "پایپینگ",
      items: [
        ["seamless-pipe.html", "لوله مانیسمان"],
        ["api-5l-pipe.html", "لوله API 5L"],
        ["stainless-steel-pipe.html", "لوله استنلس"],
        ["alloy-steel-pipe-a335.html", "لوله A335"],
        ["a333-low-temperature-pipe.html", "لوله A333"],
        ["welding-flanges.html", "فلنج جوشی"],
        ["butt-weld-fittings.html", "فیتینگ جوشی"],
        ["forged-fittings.html", "فیتینگ فورج"],
        ["industrial-gaskets.html", "گسکت صنعتی"],
        ["stud-bolts-nuts.html", "استادبولت"],
        ["industrial-strainer-filter.html", "استرینر"],
        ["pipe-supports-spring-hangers.html", "ساپورت لوله"]
      ]
    },
    {
      t: "شیرآلات",
      items: [
        ["gate-valve.html", "گیت ولو"],
        ["globe-valve.html", "گلوب ولو"],
        ["ball-valve.html", "بال ولو"],
        ["butterfly-valve.html", "باترفلای ولو"],
        ["check-valve.html", "چک ولو"],
        ["control-valve.html", "کنترل ولو"],
        ["psv-prv-safety-valve.html", "شیر اطمینان PSV"],
        ["valve-actuator.html", "اکچویتور ولو"]
      ]
    },
    {
      t: "ابزار دقیق",
      items: [
        ["rosemount-3051.html", "Rosemount 3051"],
        ["pressure-transmitter.html", "ترانسمیتر فشار"],
        ["differential-pressure-transmitter.html", "ترانسمیتر DP"],
        ["temperature-transmitter.html", "ترانسمیتر دما"],
        ["pressure-gauge.html", "گیج فشار"],
        ["flowmeter.html", "فلومتر"],
        ["coriolis-flowmeter.html", "فلومتر کوریولیس"],
        ["magnetic-flowmeter.html", "فلومتر مغناطیسی"],
        ["vortex-flowmeter.html", "فلومتر ورتکس"],
        ["radar-level-transmitter.html", "رادار سطح"],
        ["thermowell.html", "ترموول"],
        ["fixed-gas-detector.html", "دتکتور گاز"]
      ]
    },
    {
      t: "برق صنعتی",
      items: [
        ["lv-mv-switchgear.html", "تابلو LV/MV"],
        ["industrial-circuit-breakers.html", "کلید ACB/MCCB"],
        ["power-transformer.html", "ترانسفورماتور"],
        ["vfd-soft-starter.html", "VFD و سافت‌استارتر"],
        ["industrial-power-instrument-cable.html", "کابل صنعتی"],
        ["cable-accessories.html", "متعلقات کابل"],
        ["industrial-ups-battery-charger.html", "UPS صنعتی"],
        ["plc-control-panel.html", "تابلو PLC"],
        ["motor-control-center-mcc.html", "تابلو MCC"]
      ]
    },
    {
      t: "پمپ و کمپرسور",
      items: [
        ["api-610-centrifugal-pump.html", "پمپ API 610"],
        ["ansi-process-pump.html", "پمپ ANSI"],
        ["dosing-metering-pump.html", "دوزینگ پمپ"],
        ["vertical-multistage-pump.html", "پمپ طبقاتی"],
        ["slurry-pump.html", "پمپ اسلاری"],
        ["mechanical-seal.html", "مکانیکال سیل"],
        ["screw-compressor.html", "کمپرسور اسکرو"],
        ["reciprocating-compressor.html", "کمپرسور رفت‌وبرگشتی"],
        ["instrument-air-package.html", "هوای ابزار دقیق"]
      ]
    },
    {
      t: "بویلر و ثابت",
      items: [
        ["fire-tube-boiler.html", "بویلر فایرتیوب"],
        ["water-tube-boiler.html", "بویلر واترتیوب"],
        ["industrial-burner.html", "مشعل صنعتی"],
        ["steam-trap.html", "تله بخار"],
        ["shell-tube-heat-exchanger.html", "مبدل Shell & Tube"],
        ["plate-heat-exchanger.html", "مبدل صفحه‌ای"],
        ["pressure-vessel.html", "مخزن تحت فشار"],
        ["air-cooler-fin-fan.html", "ایرکولر"]
      ]
    }
  ];

  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  var FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  function faNum(n) { return String(n).replace(/\d/g, function (d) { return FA_DIGITS[d]; }); }

  /* ------------------------------------------------------------------ *
   *  Products mega-menu styles (mobile = accordion, desktop = dropdown) *
   * ------------------------------------------------------------------ */
  var MEGA_CSS =
    /* top-level nav pills (all widths) */
    ".site-header .main-nav>a,.site-header .main-nav>.nav-drop>a,.site-header .main-nav>.nav-products>a{display:inline-flex!important;align-items:center;justify-content:center;height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 11px!important;line-height:1!important;box-sizing:border-box;border-radius:999px;white-space:nowrap}" +
    /* desktop: hover / focus dropdown panel */
    "@media(min-width:851px){" +
    ".nav-drop.nav-products{position:relative}" +
    ".nav-products .nav-mega{position:fixed;top:84px;right:16px;left:16px;z-index:95;width:auto;max-width:1180px;margin:0 auto;display:none}" +
    ".nav-products:hover>.nav-mega,.nav-products:focus-within>.nav-mega,.nav-products.is-open>.nav-mega{display:block}" +
    ".nav-products .nav-mega .nav-mega-inner{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px 12px;padding:16px 18px 12px;border-radius:18px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 18px 48px rgba(15,23,42,.16);max-height:min(72vh,560px);overflow:auto}" +
    ".nav-mega-col{min-width:0;display:flex;flex-direction:column;gap:1px}" +
    ".nav-mega-head{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;font-family:inherit;font-size:12px!important;font-weight:900!important;color:#ef4b1a!important;padding:4px 8px!important;margin:0 0 4px;white-space:nowrap!important;text-align:right;cursor:default}" +
    ".nav-mega-head svg,.nav-mega-count{display:none}" +
    ".nav-mega-items{display:flex;flex-direction:column;gap:1px}" +
    ".nav-mega-items-in{display:flex;flex-direction:column;gap:1px;min-width:0}" +
    ".main-nav .nav-mega a{white-space:normal!important;font-size:12.5px!important;font-weight:700!important;padding:4px 8px!important;line-height:1.45!important;border-radius:8px!important;color:#334155!important;display:block;text-align:right}" +
    ".main-nav .nav-mega a:hover{background:rgba(239,75,26,.1)!important;color:#ef4b1a!important}" +
    ".main-nav .nav-mega-all{grid-column:1/-1;text-align:center;font-weight:900!important;color:#0e7490!important;margin-top:6px;border-top:1px solid #e2e8f0;padding:10px 8px 0!important}" +
    ".nav-mega-trigger{display:none!important}" +
    "}" +
    /* mobile: accordion inside the burger panel */
    "@media(max-width:850px){" +
    ".main-nav{row-gap:6px!important;max-height:calc(100vh - 108px)!important;max-height:calc(100dvh - 108px)!important;overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}" +
    ".site-header .main-nav>a,.site-header .main-nav>.nav-drop>a,.site-header .main-nav>.nav-products>a{height:auto!important;min-height:44px!important;max-height:none!important;font-size:15px!important;padding:10px 14px!important;justify-content:flex-start!important;border-radius:14px!important}" +
    ".nav-drop.nav-products{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;justify-items:stretch;align-items:center}" +
    ".nav-products>a{width:100%}" +
    ".nav-mega-trigger{appearance:none;-webkit-appearance:none;display:inline-grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid #e2e8f0;border-radius:14px;background:#fff;color:#ef4b1a;cursor:pointer}" +
    ".nav-mega-trigger svg{width:18px;height:18px;transition:transform .28s ease}" +
    ".nav-products.is-open>.nav-mega-trigger{background:rgba(239,75,26,.08);border-color:rgba(239,75,26,.35)}" +
    ".nav-products.is-open>.nav-mega-trigger svg{transform:rotate(180deg)}" +
    ".nav-products .nav-mega{grid-column:1/-1;position:static;display:grid;grid-template-rows:0fr;transition:grid-template-rows .34s cubic-bezier(.65,.05,.36,1);width:100%;margin:0}" +
    ".nav-products.is-open>.nav-mega{grid-template-rows:1fr}" +
    ".nav-products .nav-mega .nav-mega-inner{overflow:hidden;min-height:0;visibility:hidden;transition:visibility 0s .35s;display:flex;flex-direction:column;gap:6px;padding-top:8px}" +
    ".nav-products.is-open .nav-mega-inner{visibility:visible;transition:none}" +
    ".nav-mega-col{border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;overflow:hidden;transition:border-color .25s ease,background .25s ease}" +
    ".nav-mega-col.open{background:#fff;border-color:rgba(239,75,26,.3)}" +
    ".nav-mega-head{display:flex;align-items:center;gap:8px;width:100%;min-height:48px;padding:6px 12px;border:0;background:transparent;font-family:inherit;font-size:14.5px;font-weight:900;color:#0f2744!important;text-align:right;cursor:pointer}" +
    ".nav-mega-head .nav-mega-name{flex:1 1 auto;min-width:0}" +
    ".nav-mega-count{flex:0 0 auto;font-style:normal;font-size:11px;font-weight:900;line-height:1.8;color:#ef4b1a;background:rgba(239,75,26,.1);border-radius:999px;padding:0 9px}" +
    ".nav-mega-head svg{flex:0 0 auto;width:16px;height:16px;color:#94a3b8;transition:transform .28s ease}" +
    ".nav-mega-col.open .nav-mega-head{color:#ef4b1a!important}" +
    ".nav-mega-col.open .nav-mega-head svg{transform:rotate(180deg);color:#ef4b1a}" +
    ".nav-mega-items{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}" +
    ".nav-mega-col.open .nav-mega-items{grid-template-rows:1fr}" +
    ".nav-mega-items-in{overflow:hidden;min-height:0;visibility:hidden;transition:visibility 0s .3s;display:flex;flex-direction:column;padding:0 8px 8px}" +
    ".nav-mega-col.open .nav-mega-items-in{visibility:visible;transition:none}" +
    ".main-nav .nav-mega .nav-mega-items-in a{display:flex;align-items:center;min-height:42px;padding:6px 10px!important;font-size:14px!important;font-weight:700!important;line-height:1.5!important;white-space:normal!important;text-align:right;color:#334155!important;border-radius:10px}" +
    ".main-nav .nav-mega .nav-mega-items-in a:hover,.main-nav .nav-mega .nav-mega-items-in a:active,.main-nav .nav-mega .nav-mega-items-in a:focus-visible{background:rgba(239,75,26,.08)!important;color:#ef4b1a!important}" +
    ".main-nav .nav-mega-all{display:flex!important;align-items:center;justify-content:center;min-height:48px;border-radius:16px;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff!important;font-weight:900!important;font-size:14.5px!important;padding:8px 12px!important;margin:2px 0 0;border:0!important;box-shadow:0 10px 22px rgba(239,75,26,.22)}" +
    "}" +
    "@media(prefers-reduced-motion:reduce){" +
    ".nav-products .nav-mega,.nav-mega-items,.nav-mega-items-in,.nav-mega .nav-mega-inner,.nav-mega-trigger svg,.nav-mega-head svg{transition:none!important}" +
    "}";

  function ensureMegaCss() {
    if (document.getElementById("ptf-mega-css")) return;
    var s = document.createElement("style");
    s.id = "ptf-mega-css";
    s.textContent = MEGA_CSS;
    document.head.appendChild(s);
  }

  function buildMega(p) {
    var mega = document.createElement("span");
    mega.className = "nav-mega";
    mega.setAttribute("role", "group");
    mega.setAttribute("aria-label", "منوی محصولات");
    var inner = document.createElement("span");
    inner.className = "nav-mega-inner";
    PRODUCT_MENU.forEach(function (cat) {
      var col = document.createElement("span");
      col.className = "nav-mega-col";
      var head = document.createElement("button");
      head.type = "button";
      head.className = "nav-mega-head";
      head.setAttribute("aria-expanded", "false");
      head.innerHTML =
        '<span class="nav-mega-name"></span>' +
        '<i class="nav-mega-count"></i>' + CHEVRON;
      head.querySelector(".nav-mega-name").textContent = cat.t;
      head.querySelector(".nav-mega-count").textContent = faNum(cat.items.length);
      var items = document.createElement("span");
      items.className = "nav-mega-items";
      var itemsIn = document.createElement("span");
      itemsIn.className = "nav-mega-items-in";
      cat.items.forEach(function (it) {
        var a = document.createElement("a");
        a.href = p + "services/products/" + it[0];
        a.textContent = it[1];
        itemsIn.appendChild(a);
      });
      items.appendChild(itemsIn);
      col.appendChild(head);
      col.appendChild(items);
      inner.appendChild(col);
    });
    var all = document.createElement("a");
    all.className = "nav-mega-all";
    all.href = p + "services/products/";
    all.textContent = "مشاهده همه محصولات قابل تامین ←";
    inner.appendChild(all);
    mega.appendChild(inner);
    return mega;
  }

  function findProductsAnchor(nav) {
    var nodes = nav.children;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.tagName === "A" && /services\/products\/?$/.test((n.getAttribute("href") || "").replace(/index\.html$/, ""))) {
        return n;
      }
    }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.tagName === "A" && /services\/products/.test(n.getAttribute("href") || "")) return n;
    }
    return null;
  }

  function bindProductsHover() {
    var wraps = document.querySelectorAll(".nav-products");
    for (var i = 0; i < wraps.length; i++) {
      (function (wrap) {
        if (wrap.getAttribute("data-mega-bound")) return;
        wrap.setAttribute("data-mega-bound", "1");
        var hideTimer = null;
        function open() {
          clearTimeout(hideTimer);
          wrap.classList.add("is-open");
          wrap.setAttribute("data-hover-open", "1");
        }
        function closeSoon() {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(function () {
            wrap.classList.remove("is-open");
            wrap.removeAttribute("data-hover-open");
          }, 320);
        }
        wrap.addEventListener("mouseenter", open);
        wrap.addEventListener("mouseleave", closeSoon);
        wrap.addEventListener("focusin", open);
        wrap.addEventListener("focusout", function (e) {
          if (!wrap.contains(e.relatedTarget)) closeSoon();
        });
      })(wraps[i]);
    }
  }

  /* ------------------------------------------------------------------ *
   *  Mobile accordion behaviour (≤850px)                                *
   * ------------------------------------------------------------------ */
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width:850px)") : { matches: false };
  function isMobileNav() {
    return !!mqMobile.matches;
  }

  function bindProductsAccordion(wrap) {
    if (wrap.getAttribute("data-acc-bound")) return;
    wrap.setAttribute("data-acc-bound", "1");

    var trigger = wrap.querySelector(".nav-mega-trigger");
    var mega = wrap.querySelector(".nav-mega");
    var anchor = null;
    for (var i = 0; i < wrap.children.length; i++) {
      if (wrap.children[i].tagName === "A") { anchor = wrap.children[i]; break; }
    }

    function setCol(col, on) {
      if (!col) return;
      col.classList.toggle("open", !!on);
      var h = col.querySelector(".nav-mega-head");
      if (h) h.setAttribute("aria-expanded", on ? "true" : "false");
    }
    function toggleCol(col, force) {
      if (!col) return;
      var want = (force !== undefined) ? force : !col.classList.contains("open");
      if (want) {
        // single-open accordion: close the other categories
        var cols = wrap.querySelectorAll(".nav-mega-col.open");
        for (var i = 0; i < cols.length; i++) if (cols[i] !== col) setCol(cols[i], false);
      }
      setCol(col, want);
    }
    function setOpen(force) {
      var want = (force !== undefined) ? force : !wrap.classList.contains("is-open");
      wrap.classList.toggle("is-open", !!want);
      if (trigger) trigger.setAttribute("aria-expanded", want ? "true" : "false");
      if (want) {
        // hint the pattern by opening the first category if none is open
        if (!wrap.querySelector(".nav-mega-col.open")) {
          toggleCol(wrap.querySelector(".nav-mega-col"), true);
        }
      }
    }

    if (trigger) {
      trigger.addEventListener("click", function (e) {
        if (!isMobileNav()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen();
      });
    }
    if (anchor) {
      // capture phase: intercept before other handlers (e.g. burger auto-close)
      anchor.addEventListener("click", function (e) {
        if (!isMobileNav()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen();
      }, true);
    }
    if (mega) {
      mega.addEventListener("click", function (e) {
        if (!isMobileNav()) return;
        var head = e.target && e.target.closest ? e.target.closest(".nav-mega-head") : null;
        if (head && mega.contains(head)) {
          e.preventDefault();
          toggleCol(head.parentNode);
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isMobileNav()) setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (!isMobileNav() || !wrap.classList.contains("is-open")) return;
      if (!wrap.contains(e.target)) setOpen(false);
    }, true);

    function leaveMobile() {
      if (!mqMobile.matches && wrap.classList.contains("is-open") && !wrap.hasAttribute("data-hover-open")) {
        setOpen(false);
        var cols = wrap.querySelectorAll(".nav-mega-col.open");
        for (var i = 0; i < cols.length; i++) setCol(cols[i], false);
      }
    }
    if (mqMobile.addEventListener) mqMobile.addEventListener("change", leaveMobile);
    else if (mqMobile.addListener) mqMobile.addListener(leaveMobile);

    // closing the burger panel also closes the accordion
    var nav = document.getElementById("mainNav");
    if (nav && window.MutationObserver) {
      new MutationObserver(function () {
        if (!nav.classList.contains("open")) setOpen(false);
      }).observe(nav, { attributes: true, attributeFilter: ["class"] });
    }

    // mark the current product page inside the menu
    if (mega) {
      var here = location.pathname.replace(/\/index\.html$/, "/");
      var links = mega.querySelectorAll("a");
      for (var j = 0; j < links.length; j++) {
        try {
          var pp = new URL(links[j].getAttribute("href"), location.href).pathname.replace(/\/index\.html$/, "/");
          if (pp === here) {
            links[j].classList.add("active");
            if (isMobileNav()) toggleCol(links[j].closest(".nav-mega-col"), true);
            break;
          }
        } catch (e) {}
      }
    }
  }

  function ensureProductsMenu() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    if (isNonFa()) return;
    ensureMegaCss();
    var wrap = nav.querySelector(".nav-products");
    var p = prefix();
    if (!wrap) {
      var a = findProductsAnchor(nav);
      if (!a) return;
      wrap = document.createElement("span");
      wrap.className = "nav-drop nav-products";
      a.setAttribute("aria-haspopup", "true");
      nav.insertBefore(wrap, a);
      wrap.appendChild(a);
      wrap.appendChild(buildMega(p));
    } else {
      // normalize any hardcoded mega (e.g. homepage) to the new structure
      var oldMega = wrap.querySelector(".nav-mega");
      if (oldMega && !oldMega.querySelector(".nav-mega-inner")) {
        oldMega.parentNode.replaceChild(buildMega(p), oldMega);
      }
      wrap.setAttribute("role", "group");
    }
    if (!wrap.querySelector(".nav-mega-trigger")) {
      var trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "nav-mega-trigger";
      trigger.setAttribute("aria-label", "باز و بسته کردن فهرست محصولات");
      trigger.setAttribute("aria-expanded", "false");
      trigger.innerHTML = CHEVRON;
      var mega = wrap.querySelector(".nav-mega");
      wrap.insertBefore(trigger, mega || null);
      if (mega) trigger.setAttribute("aria-controls", "ptfProductsMega");
      if (mega && !mega.id) mega.id = "ptfProductsMega";
    }
    bindProductsAccordion(wrap);
    bindProductsHover();
  }

  function markActiveNav() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var tops = [];
    nav.querySelectorAll("a").forEach(function (a) {
      if (a.closest(".nav-mega") || a.closest(".nav-drop-menu")) return;
      if (a.classList.contains("nav-search")) return;
      a.classList.remove("active");
      tops.push(a);
    });
    var best = null, bestLen = 0;
    tops.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /\/en\/?$/.test(href)) return;
      var p;
      try { p = new URL(href, location.href).pathname.replace(/\/index\.html$/, "/"); }
      catch (e) { return; }
      if (p === "/" || p === "") return;
      var prefixPath = p.replace(/\/?$/, "/");
      if (path === p || path.indexOf(prefixPath) === 0) {
        if (p.length > bestLen) { bestLen = p.length; best = a; }
      }
    });
    if (best) best.classList.add("active");
  }

  function boot() {
    bindHeaderActions();
    ensureLangMenu();
    ensureSearchLink();
    ensureCareersLink();
    ensureProductsMenu();
    markActiveNav();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
