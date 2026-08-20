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
  function boot() { ensureSearchLink(); ensureCareersLink(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
