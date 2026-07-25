/* =====================================================================
   PTF CRM — tour.js — v16.4 — US-343 + US-361 + US-375
   معرفی اجمالی گرافیکی ماژول‌ها (Onboarding Tour):
   - US-361: هماهنگ کامل با منوی آکاردئونی shell.js —
     پیش از هر گام، گروه والد باز و بقیه بسته می‌شوند (منبع واحد PTF_NAV_GROUPS)؛
     اسپات‌لایت دقیقا هم‌اندازه کادر آیتم؛ ترتیب گام‌ها گروه‌به‌گروه؛
     پایان/رد تور = همه گروه‌ها بسته (کلید ptf_nav_open دست نمی‌خورد تا
     ترجیح کاربر برای نشست‌های بعد سالم بماند).
   - US-375: تور اختصاصی ۵ گامی نوار پایین موبایل (ptfTourMnvStart) —
     مستقل از تور دسکتاپ؛ در موبایل تور دسکتاپ اجرا نمی‌شود و بالعکس.
   - فقط ماژول‌های مجاز کاربر (RBAC) نمایش داده می‌شوند.
   - اجرای خودکار یک‌باره برای هر کاربر + اجرای دستی از تنظیمات.
   ===================================================================== */
(function () {
  'use strict';

  var MOB_BP = 768; /* هم‌راستا با mobilenav.js */
  function isMob() { return window.innerWidth <= MOB_BP && !!document.getElementById('mnvBar'); }

  /* توضیح هر ماژول (id مطابق goPanel) — ترتیب نمایش از PTF_NAV_GROUPS ساخته می‌شود (US-361 AC3) */
  var DESC = {
    dash: { t: 'داشبورد', d: 'فضای دسترسی سریع: کاشی ماژول‌ها را با درگ اولویت‌بندی کنید و با یک کلیک وارد شوید.' },
    cart: { t: 'کارتابل من', d: 'اعلان‌ها، ارجاعات و پیام‌های شما اینجاست — عدد قرمز یعنی موردی منتظر اقدام شماست.' },
    ai: { t: 'دستیار', d: 'فایل استعلام (PDF/عکس/اکسل) را بدهید تا اقلام و کارفرما را شناسایی و درخواست/پیشنهاد بسازد.' },
    leads: { t: 'سرنخ‌ها', d: 'مشتریان بالقوه را اینجا ثبت و پیگیری کنید تا به مشتری تبدیل شوند.' },
    cust: { t: 'مشتریان', d: 'بانک اطلاعات کارفرمایان: رابط‌ها، شماره‌ها، وضعیت وندور و دکمه 💬 ارسال پیام.' },
    rfq: { t: 'درخواست‌ها', d: 'درخواست‌های کارفرما را ثبت کنید؛ اقلام را دستی/اکسل/دستیار وارد کنید تا پیشنهاد یک‌کلیکی شود. نمای کانبان برای رهگیری آسان‌تر در دسترس است.' },
    off: { t: 'پیشنهاد', d: 'از این قسمت می‌توانید پیشنهادهای فنی، مالی و فنی-مالی خود را ثبت و چاپ کنید.' },
    deals: { t: 'پرونده‌های فروش', d: 'با ثبت هر پیشنهاد، پرونده همان درخواست خودکار ساخته می‌شود — همه اسناد یکجا.' },
    sup: { t: 'تامین‌کنندگان', d: 'وندورهای داخلی و خارجی با تب جدا؛ متن آماده و پیام‌رسان برای ارتباط سریع.' },
    rfqs: { t: 'درخواست تامین', d: 'استعلام قیمت از تامین‌کنندگان؛ قیمت‌ها همین‌جا ثبت و قیمت مرجع کالا خودکار به‌روز می‌شود.' },
    prod: { t: 'کالاها', d: 'کاتالوگ کالاها با کد یکتا و قیمت مرجع تاریخ‌دار.' },
    prj: { t: 'بایگانی', d: 'مقصد پرونده‌های مختومه برای آمار و تحلیل مدیریتی.' },
    let: { t: 'مکاتبات', d: 'نامه‌های رسمی با سربرگ دوزبانه، سریال خودکار و گردش امضا.' },
    cnt: { t: 'قراردادها', d: 'تنظیم قرارداد خرید/فروش از CO یا درخواست تامین + پیشنهاد متن با هوش مصنوعی.' },
    inv: { t: 'فاکتورها', d: 'ثبت فاکتورهای صادره حسابداری روی پیش‌فاکتورهای ارجاع‌شده.' },
    recv: { t: 'مطالبات', d: 'پیگیری وصولی‌ها با درصد پیشرفت و تسعیر ارز.' },
    petty: { t: 'هاب مالی', d: 'ثبت هزینه‌های جاری و تنخواه با گزارش دوره‌ای.' },
    anl: { t: 'تحلیلگر هوشمند', d: 'تحلیل آماری فروش، مشتریان و روند درخواست‌ها.' },
    rem: { t: 'یادآورها', d: 'یادآورهای کاری و چک‌های صادره — اعلان خودکار از ۷ روز قبل از سررسید.' },
    sms: { t: 'پیامک', d: 'ارسال پیامک اطلاع‌رسانی به مشتریان و کاربران از طریق پنل متصل.' },
    cms: { t: 'مدیریت سایت', d: 'مدیریت محتوای وب‌سایت pishtaj.ir بدون نیاز به برنامه‌نویس.' },
    rep: { t: 'گزارش‌ها', d: 'گزارش‌های مدیریتی دوره‌ای با خروجی چاپی.' },
    users: { t: 'کاربران', d: 'تعریف کاربران و نقش‌ها — سطح دسترسی هر ماژول از همین‌جا.' },
    set: { t: 'تنظیمات', d: 'بک‌آپ، حالت شب، امنیت حساب، بات اعلان و راهنمای مجدد همین تور.' }
  };

  /* ---------- US-361: ساخت گام‌ها گروه‌به‌گروه از منبع واحد آکاردئون ---------- */
  function navGroups() {
    /* fallback امن اگر shell.js لود نشده باشد: همه بدون گروه */
    return window.PTF_NAV_GROUPS || [{ id: '', single: true, items: Object.keys(DESC) }];
  }
  function btnOf(id) {
    return document.querySelector('.sb-i[onclick*="\'' + id + '\'"]');
  }
  /* گام‌های قابل نمایش: RBAC با display:none چک می‌شود (نه offsetParent —
     چون آیتم داخل گروه بسته هم offsetParent=null است ولی باید در تور بیاید) */
  function visSteps() {
    var out = [];
    navGroups().forEach(function (g) {
      (g.items || []).forEach(function (id) {
        var b = btnOf(id);
        if (!b || b.style.display === 'none') return; /* RBAC */
        var d = DESC[id] || { t: id, d: '' };
        out.push({ id: id, gid: g.single ? '' : g.id, t: d.t, d: d.d });
      });
    });
    return out;
  }

  /* باز کردن فقط یک گروه (و بستن بقیه) — همان کلاس‌های open/act آکاردئون shell.js
     بدون دست زدن به localStorage(ptf_nav_open) تا ترجیح کاربر سالم بماند (AC5) */
  function openOnlyGroup(gid) {
    var nav = document.querySelector('.sb-n');
    if (!nav) return;
    nav.querySelectorAll('.sb-gw').forEach(function (w) { w.classList.remove('open'); });
    nav.querySelectorAll('.sb-g').forEach(function (h) { h.classList.remove('act'); });
    if (!gid) return;
    var w = document.getElementById('gw-' + gid);
    var h = nav.querySelector('.sb-g[data-g="' + gid + '"]');
    if (w) w.classList.add('open');
    if (h) h.classList.add('act');
  }

  var idx = 0, box = null, dim = null, preOpenG = '';

  window.ptfTourStart = function () {
    /* US-375 AC5: در موبایل تور دسکتاپ اجرا نشود — تور نوار پایین جایگزین است */
    if (isMob()) { if (typeof window.ptfTourMnvStart === 'function') { window.ptfTourMnvStart(); } return; }
    idx = 0;
    var steps = visSteps();
    if (!steps.length) { alert('موردی برای معرفی یافت نشد'); return; }
    /* وضعیت پیش از تور برای بازگردانی */
    var openW = document.querySelector('.sb-gw.open');
    preOpenG = openW ? openW.id.replace('gw-', '') : '';
    ensureUI();
    show(steps);
  };

  function ensureUI() {
    if (dim) return;
    dim = document.createElement('div');
    dim.id = 'ptfTourDim';
    dim.style.cssText = 'position:fixed;inset:0;z-index:4000;pointer-events:auto';
    document.body.appendChild(dim);
    box = document.createElement('div');
    box.id = 'ptfTourBox';
    box.style.cssText = 'position:fixed;z-index:4002;background:var(--crd,#fff);border-radius:16px;padding:16px 18px;max-width:300px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-size:13px';
    document.body.appendChild(box);
  }

  function spotlight(r, pad) {
    dim.innerHTML = '<div style="position:fixed;top:' + (r.top - pad) + 'px;right:' + (window.innerWidth - r.right - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px;border-radius:12px;box-shadow:0 0 0 9999px rgba(15,23,42,.78);pointer-events:none;transition:all .25s ease"></div>';
  }

  function show(steps) {
    if (idx >= steps.length) { ptfTourEnd(); return; }
    if (idx < 0) idx = 0;
    var st = steps[idx];
    /* US-361 AC1/AC4: گروه والد باز، سایر گروه‌ها بسته — فقط یک گروه روشن */
    openOnlyGroup(st.gid);
    /* صبر برای پایان انیمیشن آکاردئون (max-height .3s) و سپس اندازه‌گیری دقیق */
    setTimeout(function () {
      var el = btnOf(st.id);
      if (!el) { idx++; show(steps); return; }
      try { el.scrollIntoView({ block: 'center' }); } catch (e) { el.scrollIntoView(); }
      var r = el.getBoundingClientRect();
      /* AC2: اسپات‌لایت هم‌اندازه کادر آیتم (حاشیه حداقلی ۳px فقط برای دید بهتر گوشه‌ها) */
      spotlight(r, 3);
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<b style="font-size:14px;color:var(--pri,#ef4b1a)">' + st.t + '</b>' +
        '<small style="color:#94a3b8">' + (idx + 1) + ' از ' + steps.length + '</small></div>' +
        '<div style="line-height:1.9;color:var(--tx,#334155)">' + st.d + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px">' +
        '<button class="bt bt-o" style="font-size:12px" onclick="ptfTourEnd()">رد کردن</button>' +
        '<div style="display:flex;gap:6px">' +
        (idx > 0 ? '<button class="bt bt-o" style="font-size:12px" onclick="ptfTourNav(-1)">قبلی</button>' : '') +
        '<button class="bt" style="font-size:12px" onclick="ptfTourNav(1)">' + (idx === steps.length - 1 ? 'پایان ✅' : 'بعدی ←') + '</button>' +
        '</div></div>';
      var bx = r.left - 320;
      if (bx < 8) bx = 8;
      var by = Math.min(Math.max(r.top - 10, 8), window.innerHeight - 220);
      box.style.left = bx + 'px';
      box.style.top = by + 'px';
    }, 330);
  }

  window.ptfTourNav = function (dir) {
    idx += dir;
    show(visSteps());
  };
  window.ptfTourEnd = function () {
    if (dim) { dim.remove(); dim = null; }
    if (box) { box.remove(); box = null; }
    /* US-361 AC5 (دستور کارفرما): پس از پایان/رد، تمام منوهای کشویی بسته باشند.
       کلید ptf_nav_open تغییری نکرده — رفرش/ورود بعدی همان ترجیح قبلی کاربر را باز می‌کند. */
    openOnlyGroup('');
    try { localStorage.setItem('ptf_tour_done_' + curSession().user, '1'); } catch (e) {}
  };

  /* =====================================================================
     US-375: تور اختصاصی کوچک نوار پایین موبایل — ۵ گام
     داشبورد | کارتابل | FAB پیشنهاد | دستیار | سایر (با باز شدن کشو)
     ===================================================================== */
  var mIdx = 0, mDim = null, mBox = null;
  var MNV_STEPS = [
    { tab: 'dash', t: 'داشبورد', d: 'شروع کار از اینجا: کاشی همه ماژول‌ها + «روز من».' },
    { tab: 'cart', t: 'کارتابل', d: 'اعلان‌ها و ارجاعات شما — عدد قرمز یعنی منتظر اقدام شماست.' },
    { tab: 'off', t: 'پیشنهاد (دکمه برجسته)', d: 'میان‌بر اصلی: ثبت پیشنهاد فنی/مالی با یک لمس.' },
    { tab: 'ai', t: 'دستیار', d: 'فایل استعلام را بدهید تا اقلام و کارفرما را خودش شناسایی کند.' },
    { tab: '_more', t: 'سایر', d: 'همه ماژول‌های دیگر با آیکون‌های رنگی اینجا هستند + جستجوی سریع سرتاسری.' }
  ];

  function mnvBtn(tab) { return document.querySelector('#mnvBar .mnv-tab[data-tab="' + tab + '"]'); }

  window.ptfTourMnvStart = function () {
    if (!document.getElementById('mnvBar')) { alert('این تور مخصوص نوار پایین موبایل است.'); return; }
    mIdx = 0;
    if (!mDim) {
      mDim = document.createElement('div');
      mDim.id = 'ptfTourMnvDim';
      mDim.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto';
      document.body.appendChild(mDim);
      mBox = document.createElement('div');
      mBox.id = 'ptfTourMnvBox';
      mBox.style.cssText = 'position:fixed;z-index:5002;background:var(--crd,#fff);border-radius:16px;padding:14px 16px;left:12px;right:12px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-size:13px';
      document.body.appendChild(mBox);
    }
    mnvShow();
  };

  function mnvShow() {
    if (mIdx >= MNV_STEPS.length) { ptfTourMnvEnd(); return; }
    if (mIdx < 0) mIdx = 0;
    var st = MNV_STEPS[mIdx];
    var isMore = st.tab === '_more';
    /* AC4: گام «سایر» = باز شدن کشو و اشاره به گروه‌های رنگی */
    if (isMore && typeof window.ptfMnvMore === 'function') window.ptfMnvMore(true);
    else if (!isMore && typeof window.ptfMnvMore === 'function') window.ptfMnvMore(false);
    setTimeout(function () {
      var el = isMore ? (document.querySelector('#mnvMore .mnv-grid') || mnvBtn(st.tab)) : mnvBtn(st.tab);
      if (!el) { mIdx++; mnvShow(); return; }
      var r = el.getBoundingClientRect();
      var pad = 4;
      /* AC3: اسپات‌لایت هم‌اندازه دکمه */
      mDim.innerHTML = '<div style="position:fixed;top:' + (r.top - pad) + 'px;right:' + (window.innerWidth - r.right - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px;border-radius:14px;box-shadow:0 0 0 9999px rgba(15,23,42,.78);pointer-events:none;transition:all .25s ease"></div>';
      mBox.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<b style="font-size:14px;color:var(--pri,#ef4b1a)">' + st.t + '</b>' +
        '<small style="color:#94a3b8">' + (mIdx + 1) + ' از ' + MNV_STEPS.length + '</small></div>' +
        '<div style="line-height:1.9;color:var(--tx,#334155)">' + st.d + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:10px">' +
        '<button class="bt bt-o" style="font-size:12px" onclick="ptfTourMnvEnd()">رد کردن</button>' +
        '<div style="display:flex;gap:6px">' +
        (mIdx > 0 ? '<button class="bt bt-o" style="font-size:12px" onclick="ptfTourMnvNav(-1)">قبلی</button>' : '') +
        '<button class="bt" style="font-size:12px" onclick="ptfTourMnvNav(1)">' + (mIdx === MNV_STEPS.length - 1 ? 'پایان ✅' : 'بعدی ←') + '</button>' +
        '</div></div>';
      /* AC3: کادر توضیح بالای هدف — نوار پایین را نمی‌پوشاند */
      var boxH = mBox.getBoundingClientRect().height || 130;
      var top = r.top - boxH - 14;
      if (top < 8) top = Math.min(r.bottom + 14, window.innerHeight - boxH - 8);
      mBox.style.top = top + 'px';
    }, isMore ? 320 : 60);
  }

  window.ptfTourMnvNav = function (dir) { mIdx += dir; mnvShow(); };
  window.ptfTourMnvEnd = function () {
    if (mDim) { mDim.remove(); mDim = null; }
    if (mBox) { mBox.remove(); mBox = null; }
    if (typeof window.ptfMnvMore === 'function') window.ptfMnvMore(false); /* کشو بسته شود */
    try { localStorage.setItem('ptf_tour_mnv_done_' + curSession().user, '1'); } catch (e) {}
  };

  /* اجرای خودکار یک‌باره برای هر کاربر (بعد از لود کامل) — دسکتاپ و موبایل مستقل (US-375 AC2/AC5) */
  function autoOnce() {
    try {
      var s = curSession();
      if (!s.user) return;
      setTimeout(function () {
        if (isMob()) {
          if (localStorage.getItem('ptf_tour_mnv_done_' + s.user) === '1') return;
          if (document.getElementById('mnvBar')) ptfTourMnvStart();
        } else {
          if (localStorage.getItem('ptf_tour_done_' + s.user) === '1') return;
          if (document.querySelector('.sb-n .sb-i')) ptfTourStart();
        }
      }, 2500);
    } catch (e) {}
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { clearInterval(t); autoOnce(); }
    if (tries > 60) clearInterval(t);
  }, 500);

  /* دکمه در تنظیمات: اجرای مجدد تور (دسکتاپ + نوار پایین موبایل) */
  function hookSettings() {
    if (window._tourSetHooked || typeof window.buildSettings !== 'function') return false;
    window._tourSetHooked = true;
    var _bs = window.buildSettings;
    window.buildSettings = function () {
      return _bs() + '<div style="max-width:560px"><hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
        '<h4 style="margin:0 0 8px">🎓 راهنما (US-343/361/375)</h4>' +
        '<button class="bt bt-o" onclick="ptfTourStart()">🎓 اجرای مجدد معرفی ماژول‌ها</button> ' +
        '<button class="bt bt-o" onclick="ptfTourMnvStart()">📱 تور نوار پایین موبایل</button></div>';
    };
    return true;
  }
  var st2 = 0;
  var si = setInterval(function () { st2++; if (hookSettings() || st2 > 50) clearInterval(si); }, 400);
})();
