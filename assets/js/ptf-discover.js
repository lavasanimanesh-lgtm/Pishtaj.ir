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
    var a = document.createElement("a");
    a.className = "nav-search";
    a.href = prefix() + "search/";
    a.textContent = "جستجو";
    nav.appendChild(a);
  }
  function ensureCareersLink() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    if ((document.documentElement.lang || "").toLowerCase().indexOf("en") === 0) return;
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
    if ((document.documentElement.lang || "").toLowerCase().indexOf("en") === 0) return;
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
