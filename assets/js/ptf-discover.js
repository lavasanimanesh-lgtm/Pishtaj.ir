(function () {
  function prefix() {
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (/\.html$/.test(parts[parts.length - 1])) parts.pop();
    return parts.map(function () { return ".."; }).join("/") + (parts.length ? "/" : "");
  }
  function insertBeforeContact(nav, node) {
    var before = nav.querySelector('a[href*="#contact"]') || nav.querySelector(".nav-search") || nav.querySelector(".lang-switch-mobile");
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

  function ensureMegaCss() {
    if (document.getElementById("ptf-mega-css")) return;
    var s = document.createElement("style");
    s.id = "ptf-mega-css";
    s.textContent =
      ".site-header .main-nav>a,.site-header .main-nav>.nav-drop>a,.site-header .main-nav>.nav-products>a{display:inline-flex!important;align-items:center;justify-content:center;height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 11px!important;line-height:1!important;box-sizing:border-box;border-radius:999px;white-space:nowrap}" +
      "@media(min-width:851px){" +
      ".nav-drop.nav-products{position:relative}" +
      ".nav-products .nav-mega{position:fixed;top:84px;right:16px;left:16px;z-index:95;width:auto;max-width:1180px;margin:0 auto;display:none;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px 12px;padding:16px 18px 12px;border-radius:18px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 18px 48px rgba(15,23,42,.16);max-height:min(72vh,560px);overflow:auto}" +
      ".nav-products:hover>.nav-mega,.nav-products:focus-within>.nav-mega,.nav-products.is-open>.nav-mega{display:grid}" +
      "}" +
      ".nav-mega-col{min-width:0;display:flex;flex-direction:column;gap:1px}" +
      ".nav-mega-head{display:block;font-size:12px!important;font-weight:900!important;color:#ef4b1a!important;padding:4px 8px!important;margin:0 0 4px;white-space:nowrap!important}" +
      ".main-nav .nav-mega a{white-space:normal!important;font-size:12.5px!important;font-weight:700!important;padding:4px 8px!important;line-height:1.45!important;border-radius:8px!important;color:#334155!important;display:block;text-align:right}" +
      ".main-nav .nav-mega a:hover{background:rgba(239,75,26,.1)!important;color:#ef4b1a!important}" +
      ".main-nav .nav-mega-all{grid-column:1/-1;text-align:center;font-weight:900!important;color:#0e7490!important;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:10px!important}" +
      "@media(max-width:850px){.nav-drop.nav-products{position:relative;display:grid;justify-items:stretch}.nav-products .nav-mega{position:static;display:grid;grid-template-columns:1fr 1fr;max-height:none;box-shadow:none;border:0;padding:6px 8px 10px;overflow:visible;left:auto;right:auto;width:auto;margin:0}}";
    document.head.appendChild(s);
  }

  function buildMega(p) {
    var mega = document.createElement("span");
    mega.className = "nav-mega";
    mega.setAttribute("role", "menu");
    PRODUCT_MENU.forEach(function (cat) {
      var col = document.createElement("span");
      col.className = "nav-mega-col";
      var head = document.createElement("b");
      head.className = "nav-mega-head";
      head.textContent = cat.t;
      col.appendChild(head);
      cat.items.forEach(function (it) {
        var a = document.createElement("a");
        a.href = p + "services/products/" + it[0];
        a.textContent = it[1];
        col.appendChild(a);
      });
      mega.appendChild(col);
    });
    var all = document.createElement("a");
    all.className = "nav-mega-all";
    all.href = p + "services/products/";
    all.textContent = "همه محصولات قابل تامین";
    mega.appendChild(all);
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
        }
        function closeSoon() {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(function () {
            wrap.classList.remove("is-open");
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

  function ensureProductsMenu() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    if ((document.documentElement.lang || "").toLowerCase().indexOf("en") === 0) return;
    ensureMegaCss();
    if (!nav.querySelector(".nav-products")) {
      var a = findProductsAnchor(nav);
      if (a) {
        var wrap = document.createElement("span");
        wrap.className = "nav-drop nav-products";
        a.setAttribute("aria-haspopup", "true");
        nav.insertBefore(wrap, a);
        wrap.appendChild(a);
        wrap.appendChild(buildMega(prefix()));
      }
    }
    bindProductsHover();
  }

  function markActiveNav() {
    var nav = document.getElementById("mainNav");
    if (!nav) return;
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var tops = [];
    nav.querySelectorAll("a").forEach(function (a) {
      if (a.closest(".nav-mega") || a.closest(".nav-drop-menu")) return;
      if (a.classList.contains("nav-search") || a.classList.contains("lang-switch-mobile")) return;
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
