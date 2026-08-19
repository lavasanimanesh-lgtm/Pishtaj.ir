(function () {
  function prefix() {
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    if (/\.html$/.test(parts[parts.length - 1])) parts.pop();
    return parts.map(function () { return ".."; }).join("/") + (parts.length ? "/" : "");
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureSearchLink);
  } else {
    ensureSearchLink();
  }
})();
