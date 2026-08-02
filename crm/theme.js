/* =====================================================================
   PTF CRM — theme.js — Sprint 82 — US-176
   پوسته روشن حرفه‌ای (الهام از پنل کاوه‌نگار):
   - سایدبار سفید، صفحه روشن، فونت وزیرمتن
   - بدون هیچ تغییر اندازه/جابجایی با hover (فقط تغییر رنگ ملایم)
   - آیکون‌های دسترسی سریع در نوار بالا
   - سازگار کامل با حالت شب (perms.js)
   ===================================================================== */
(function () {
  var css =
    /* فونت وزیرمتن — لوکال، بدون CDN */
    "@font-face{font-family:'Vazirmatn';src:url('../assets/fonts/Vazirmatn-Regular.woff2') format('woff2');font-weight:100 500;font-display:swap}" +
    "@font-face{font-family:'Vazirmatn';src:url('../assets/fonts/Vazirmatn-Bold.woff2') format('woff2');font-weight:600 900;font-display:swap}" +
    "*{font-family:'Vazirmatn','B Nazanin','BNazanin',Vazirmatn,Tahoma,sans-serif}" +
    /* پس‌زمینه روشن و ملایم برای خستگی کمتر چشم */
    ":root{--bg:#f7f8fa;--brd:#e8ebf0}" +
    "body{background:var(--bg)}" +
    /* US-176 AC2: حذف هر گونه تغییر اندازه با hover */
    ".btn-l:hover,.bt:hover,.ba:hover{transform:none}" +
    ".btn-l:hover{filter:brightness(1.06)}" +
    /* سایدبار سفید مینیمال */
    ".sb{background:#fff;border-left:1px solid var(--brd);box-shadow:0 0 20px rgba(15,23,42,.05)}" +
    ".sb-l{border-bottom:1px solid #eef1f5}" +
    ".sb-l h3{color:#0f172a}.sb-l span{color:#94a3b8}" +
    ".sb-u{border-bottom:1px solid #eef1f5;color:#475569}" +
    ".sb-n .sb-i{color:#475569;transition:background .15s,color .15s}" +
    ".sb-i:hover{background:#f4f6f9;color:#0f172a}" +
    ".sb-i.act{background:linear-gradient(90deg,rgba(239,75,26,.10),rgba(247,148,0,.05));color:#c2410c;box-shadow:inset -3px 0 0 var(--pri)}" +
    ".sb-g{color:#334155}" +
    ".sb-g:hover{background:#f4f6f9}" +
    ".sb-g.act{color:#c2410c}" +
    ".sb-f{border-top:1px solid #eef1f5}" +
    ".sb-f button{border:1px solid var(--brd);color:#64748b;background:#fff}" +
    ".sb-f button:hover{background:#fef2f2;color:#b91c1c}" +
    ".sb-n::-webkit-scrollbar{width:5px}.sb-n::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}" +
    /* نوار بالا و کارت‌ها */
    ".tb{border-bottom:1px solid var(--brd)}" +
    ".pn{border:1px solid var(--brd);box-shadow:0 1px 3px rgba(15,23,42,.04)}" +
    ".sc{box-shadow:0 1px 2px rgba(15,23,42,.03)}" +
    ".tbic{background:#f4f6f9;border:0;border-radius:11px;width:38px;height:38px;font-size:17px;cursor:pointer;display:grid;place-items:center;color:#475569;transition:background .15s}" +
    ".tbic:hover{background:#e8ebf0;transform:none}" +
    ".tbic svg,.tbic span{display:block;margin:auto;line-height:1}" + /* v31.7.18 BUG-HDR-MOBILE-001: وسط‌چین دقیق آیکون داخل مربع */
    /* US-180: فضای کاری با عرض ثابت — بدون پرش بین ماژول‌ها */
    "html{overflow-y:scroll;scrollbar-gutter:stable}" + /* اسکرول‌بار همیشه رزرو → عرض صفحه هرگز تغییر نمی‌کند */
    /* v83.1 ریشه اصلی پرش (اسکرین‌شات کارفرما): crm-l فلکس است ولی .mn بدون flex:1
       بود و عرضش به اندازه محتوای هر ماژول جمع می‌شد → حالا همیشه کل عرض باقیمانده */
    ".crm-l{width:100%}" +
    ".mn{flex:1 1 auto;width:calc(100% - var(--sw));max-width:calc(100% - var(--sw));min-width:0}" +
    "@media(max-width:900px){.mn{width:calc(100% - 56px);max-width:calc(100% - 56px)}}" +
    ".mn{margin-left:0}" +
    ".ca{max-width:none;width:auto}" +
    ".pn{width:100%;max-width:none}" + /* پنل تا منتها الیه چپ */
    ".tb2{overflow-x:auto}" + /* جدول عریض → اسکرول داخلی، نه گشاد شدن پنل */
    ".sb-u .av{overflow:hidden}" +
    /* سازگاری حالت شب */
    "body.ptf-dark .sb{background:#0f172a;border-left-color:#1e293b;box-shadow:none}" +
    "body.ptf-dark .sb-l h3{color:#e2e8f0}" +
    "body.ptf-dark .sb-n .sb-i{color:#94a3b8}" +
    "body.ptf-dark .sb-i:hover{background:#1e293b;color:#e2e8f0}" +
    "body.ptf-dark .sb-g{color:#cbd5e1}" +
    "body.ptf-dark .sb-g:hover{background:#1e293b}" +
    "body.ptf-dark .sb-u,body.ptf-dark .sb-l,body.ptf-dark .sb-f{border-color:#1e293b}" +
    "body.ptf-dark .sb-f button{background:transparent;color:#94a3b8;border-color:#1e293b}" +
    "body.ptf-dark .tbic{background:#1e293b;color:#94a3b8}" +
    "body.ptf-dark #cloudUsage{background:#0f172a!important;border-color:#1e293b!important;color:#94a3b8!important}";

  function inject() {
    if (document.getElementById('ptfProTheme')) return;
    var st = document.createElement('style');
    st.id = 'ptfProTheme';
    st.textContent = css;
    document.head.appendChild(st);
  }
  try { inject(); } catch (e) {}

  /* ---------- آیکون‌های دسترسی سریع نوار بالا ---------- */
  function themeIcon() {
    return (localStorage.getItem('ptf_theme') || '') === 'dark' ? '☼' : '☾';
  }
  /* v14.1 (US-354): چرخه سه‌حالته نوار بالا: روز → شب → خودکار → روز */
  window.ptfTopThemeToggle = function () {
    if (typeof ptfSetTheme !== 'function') return;
    var cur = localStorage.getItem('ptf_theme') || 'light';
    var next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
    ptfSetTheme(next);
    var b = document.getElementById('tbThemeBtn');
    if (b) b.title = next === 'auto' ? 'حالت خودکار (هماهنگ با سیستم) — کلیک: روز' : next === 'dark' ? 'حالت شب — کلیک: خودکار' : 'حالت روز — کلیک: شب';
  };
  function injectTopIcons() {
    var tb = document.querySelector('.tb');
    if (!tb || document.getElementById('tbIcons')) return;
    var w = document.createElement('div');
    w.id = 'tbIcons';
    w.style.cssText = 'display:flex;gap:6px;align-items:center';
    /* v122.1: آیکون‌های خطی مینیمال نوار بالا (طبق تصویر مرجع کارفرما) */
    function tsvg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px">' + p + '</svg>'; }
    var IC_MOON = tsvg('<path d="M20 13.5A8 8 0 1110.5 4a6.5 6.5 0 009.5 9.5z"/>');
    var IC_SUN = tsvg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/>');
    var IC_CLOUD = tsvg('<path d="M6.5 18.5a4 4 0 01-.6-7.96A6 6 0 0117.6 9.1a4.5 4.5 0 01-.6 8.9z"/>');
    var IC_FOLDER = tsvg('<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/>');
    var IC_BELL = tsvg('<path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2.2 2.2 0 004 0"/>');
    var IC_SEARCH = tsvg('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5L16 16"/>');
    window._ptfThemeIcons = { moon: IC_MOON, sun: IC_SUN };
    w.innerHTML =
      '<button id="tbThemeBtn" class="tbic" title="حالت شب/روز" onclick="ptfTopThemeToggle()">' + ((localStorage.getItem('ptf_theme') || '') === 'dark' ? IC_SUN : IC_MOON) + '</button>' +
      '<button class="tbic" title="فضای ابری" onclick="if(typeof ptfCloudDialog===\'function\')ptfCloudDialog()">' + IC_CLOUD + '</button>' +
      '<button class="tbic" title="بایگانی" onclick="if(typeof goPanel===\'function\')goPanel(\'prj\')">' + IC_FOLDER + '</button>' +
      /* v122.2: US-280 — زنگوله مینیمال = صندوق پیام (ادغام زنگوله ایموجی bridge.js)؛ اگر صندوق آماده نبود → کارتابل */
      '<button id="tbBellBtn" class="tbic" title="صندوق پیام و کارتابل" style="position:relative" onclick="if(typeof toggleInbox===\'function\'&&document.getElementById(\'inboxPanel\')){toggleInbox()}else if(typeof goPanel===\'function\'){goPanel(\'cart\')}">' + IC_BELL + '</button>' +
      '<button class="tbic" title="جستجو (به‌زودی Ctrl+K)" onclick="var s=document.querySelector(\'#panels input[type=text]\');if(s)s.focus()">' + IC_SEARCH + '</button>';
    tb.appendChild(w);
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    try {
      var crmVisible = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
      if (crmVisible) { injectTopIcons(); ptfApplyAvatar(); clearInterval(t); }
    } catch (e) {}
    if (tries > 60) clearInterval(t);
  }, 300);

  // بعد از هر لاگین هم آواتار و آیکون‌ها اعمال شوند
  var _showCrmT = window.showCrm;
  if (typeof _showCrmT === 'function') {
    window.showCrm = function () {
      _showCrmT();
      setTimeout(function () { injectTopIcons(); ptfApplyAvatar(); }, 600);
    };
  }

  /* ============ US-179: عکس پروفایل ============ */
  function avatarsAll() {
    /* v33.20.0 (آینهٔ خالدار): در فاز B آواتارها در حافظه/IndexedDB نگهداری می‌شوند — via getData بخوان */
    try {
      if (typeof window.ptfBMirrorActive === 'function' && window.ptfBMirrorActive()) {
        var v = (typeof getData === 'function') ? getData('ptf_crm_avatars') : null;
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      }
    } catch (eG) {}
    try { return JSON.parse(localStorage.getItem('ptf_crm_avatars') || '{}'); } catch (e) { return {}; }
  }
  /* v31.7.11 BUG-AVATAR-001: مقدار هر کاربر یا رشته legacy است یا {v,ts} نسخه‌دار.
     حذف = tombstone {v:null,ts} — نه delete — تا هنگام merge با سرور، «حذف جدیدتر»
     بر «عکس قدیمی‌تر سرور» برنده شود و عکس حذف‌شده با رفرش برنگردد. */
  function avatarVal(e) { if (e == null) return null; if (typeof e === 'string') return e || null; return e.v || null; }
  window.ptfAvatarOf = function (username) { return avatarVal(avatarsAll()[username]); };

  // اعمال روی دایره کاربر در سایدبار (و هر جای دیگر با کلاس av-USERNAME)
  window.ptfApplyAvatar = function () {
    try {
      var s = curSession();
      var el = document.getElementById('navAv');
      if (!el || !s.user) return;
      var d = avatarVal(avatarsAll()[s.user]);
      if (d) el.innerHTML = '<img src="' + d + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      else el.textContent = (s.name || 'K')[0];
      el.style.cursor = 'pointer';
      el.title = 'تغییر عکس پروفایل';
      el.onclick = function () { ptfAvatarDialog(); };
    } catch (e) {}
  };

  // فشرده‌سازی به ۱۲۸px مربعی → dataURL کوچک (حداکثر ~۲۰KB)
  window.ptfAvatarUpload = function (inp) {
    var f = inp.files && inp.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { alert('فقط فایل تصویری انتخاب کنید'); return; }
    var img = new Image();
    var url = URL.createObjectURL(f);
    img.onload = function () {
      var S = 128;
      var cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      var k = Math.max(S / img.width, S / img.height);
      var w = img.width * k, h = img.height * k;
      cv.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      URL.revokeObjectURL(url);
      var data = cv.toDataURL('image/jpeg', 0.82);
      if (data.length > 120000) { alert('تصویر خیلی پیچیده است — عکس ساده‌تری انتخاب کنید'); return; }
      var all = avatarsAll();
      all[curSession().user] = { v: data, ts: new Date().toISOString() }; /* v31.7.11: نسخه‌دار برای merge درست */
      setData('ptf_crm_avatars', all); // setData → سینک بین دستگاه‌ها
      ptfApplyAvatar();
      var pv = document.getElementById('avPrev');
      if (pv) pv.innerHTML = '<img src="' + data + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--brd)">';
      if (typeof ptfToast === 'function') ptfToast('✅ عکس پروفایل ذخیره شد', 'ok');
      if (typeof audit === 'function') audit('تنظیمات', 'تغییر عکس پروفایل', curSession().user);
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert('خطا در خواندن تصویر'); };
    img.src = url;
  };

  window.ptfAvatarRemove = function () {
    var all = avatarsAll();
    /* v31.7.11 BUG-AVATAR-001: به‌جای delete، tombstone نسخه‌دار — وگرنه merge با
       سرور (که هنوز عکس را دارد) عکس حذف‌شده را با هر رفرش برمی‌گرداند. */
    all[curSession().user] = { v: null, ts: new Date().toISOString() };
    setData('ptf_crm_avatars', all);
    ptfApplyAvatar();
    var pv = document.getElementById('avPrev');
    if (pv) pv.innerHTML = avatarPlaceholder();
    if (typeof ptfToast === 'function') ptfToast('عکس پروفایل حذف شد', 'ok');
  };

  function avatarPlaceholder() {
    var s = curSession();
    return '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--pri),var(--org));display:grid;place-items:center;font-size:28px;font-weight:900;color:#fff">' + escP((s.name || 'K')[0]) + '</div>';
  }

  // دیالوگ سریع (کلیک روی آواتار سایدبار — برای کاربرانی که پنل تنظیمات ندارند)
  window.ptfAvatarDialog = function () {
    var d = avatarVal(avatarsAll()[curSession().user]);
    var html = '<div class="md-b" style="display:grid;z-index:80" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:360px;text-align:center">' +
      '<h3>🖼 عکس پروفایل</h3>' +
      '<div id="avPrev" style="display:grid;place-items:center;margin:10px 0">' +
      (d ? '<img src="' + d + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--brd)">' : avatarPlaceholder()) + '</div>' +
      '<input type="file" id="avFile" accept="image/*" style="display:none" onchange="ptfAvatarUpload(this)">' +
      '<div style="display:flex;gap:8px;justify-content:center">' +
      '<button class="bt" onclick="document.getElementById(\'avFile\').click()">📤 انتخاب عکس</button>' +
      (d ? '<button class="bt bt-o" style="color:#dc2626" onclick="ptfAvatarRemove()">🗑 حذف</button>' : '') +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
      '<small style="color:#94a3b8;font-size:11px;display:block;margin-top:10px">عکس خودکار به ۱۲۸×۱۲۸ فشرده و بین دستگاه‌های شما سینک می‌شود</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  // بخش عکس پروفایل داخل پنل تنظیمات (اگر باز شد)
  window.ptfAvatarSection = function () {
    var d = avatarVal(avatarsAll()[curSession().user]);
    return '<h4 style="margin:0 0 8px">🖼 عکس پروفایل (US-179)</h4>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">' +
      '<div id="avPrev">' + (d ? '<img src="' + d + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--brd)">' : avatarPlaceholder()) + '</div>' +
      '<div><input type="file" id="avFileSet" accept="image/*" style="display:none" onchange="ptfAvatarUpload(this)">' +
      '<button class="bt" onclick="document.getElementById(\'avFileSet\').click()">📤 انتخاب عکس</button> ' +
      '<button class="bt bt-o" style="color:#dc2626" onclick="ptfAvatarRemove()">🗑 حذف</button>' +
      '<div style="font-size:11px;color:#94a3b8;margin-top:6px">فشرده‌سازی خودکار ۱۲۸×۱۲۸ — سینک بین دستگاه‌ها — سایر کاربران هم می‌توانند با کلیک روی دایره نام‌شان در منو عکس بگذارند</div></div></div>' +
      '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">';
  };
})();
