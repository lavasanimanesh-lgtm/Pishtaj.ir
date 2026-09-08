/* =====================================================================
   PTF CRM — Sprint 75 (cms.js)
   US-130: مدیریت محتوای سایت (Mini-CMS)
   - اخبار: افزودن/ویرایش/حذف → درج مستقیم در news/index.html
   - وبلاگ: مقاله جدید با قالب استاندارد + sitemap + آرشیو با ریدایرکت
   - سئوی صفحات: ویرایش title/description
   دسترسی: فقط ادمین + رییس هیات مدیره
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/cms.php';
  var CMS_ROLES = ['admin', 'chairman', 'ceo', 'commercial']; /* v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح */
  window.PTF_CMS_JS_VER = 'v34.38.12'; /* v34.29.6: همسان‌سازی نشانگر با VER پوسته (سپر بنر کهنگی) — بدون تغییر رفتاری cms در این نسخه */ /* v34.29.5: ریشه‌کنی برخورد شناسهٔ pgTitle + شمارنده‌های زنده + v34.29.4: پارسر مقاوم خروجی هوش خارجی + v34.29.3: رفع نامرئی‌بودن تب‌های صفحهٔ جدید/کیفیت (کلاس pn/tb) + راهنمای سئو برای همه + آزمون اتصال GSC + جستجوی محصولات + عکس هوشمند — ریشه‌کنی تب خالی — با VER پوسته مقایسه می‌شود */
  function canCms() { return CMS_ROLES.indexOf(curRole()) > -1; }
  function cmsAuthHeaders() { var h = { 'X-CRM-Role': curRole() }; try { var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; }
  function api(action, data, cb) {
    var opt = { method: 'POST', headers: cmsAuthHeaders() };
    if (data) { var fd = new FormData(); Object.keys(data).forEach(function (k) { fd.append(k, data[k]); }); opt.body = fd; }
    fetch(API + '?action=' + action, opt).then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور' }); });
  }

  var NEWS_CATS = [
    { v: 'contract', lb: 'قرارداد جدید' }, { v: 'event', lb: 'رویداد' },
    { v: 'award', lb: 'دستاورد' }, { v: 'product', lb: 'محصول جدید' }
  ];
  var BLOG_CATS = [
    { v: 'piping', lb: 'لوله و پایپینگ' }, { v: 'valve', lb: 'شیرآلات صنعتی' },
    { v: 'inst', lb: 'ابزار دقیق' }, { v: 'electrical', lb: 'برق صنعتی' },
    { v: 'procurement', lb: 'تامین و کیفیت' }, { v: 'industry', lb: 'کاربردهای صنعتی' }
  ];

  var _news = null; // کش اخبار جاری (از سرور یا فایل)
  var _tab = 'news';

  window.buildCms = function () {
    function tb(id, lb) {
      var on = _tab === id;
      return '<button type="button" onclick="cmsTab(\'' + id + '\')" style="border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;' +
        (on ? 'background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff' : 'background:#f1f5f9;color:#475569') + '">' + lb + '</button>';
    }
    return '<div class="ph"><h3>🎛 مدیریت سایت (CMS)</h3></div>' +
      '<div id="cmsStatus" style="margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">' + tb('news', '📰 اخبار') + tb('blog', '📝 وبلاگ') + tb('prod', '🛒 محصولات') + tb('page', '📄 صفحهٔ جدید') + tb('seo', '🔍 سئوی صفحات') + tb('q', '🛠 کیفیت') + '</div>' +
      '<div id="cmsWrap"></div>';
  };
  /* v34.28.0 (TAB-DIRECT — ریشه‌کنی تب‌های خالی): رندر مستقیم بدون وابستگی به دکمهٔ
     سایدبار. ریشهٔ باگ: goPanelByName دکمهٔ cms سایدبار را با تطبیق رشته‌ای onclick
     می‌جست و کلیک می‌کرد؛ اگر RBAC/بازساز منو دکمه را حذف/مخفی کرده یا فرمت onclick را
     عوض کرده باشد، یافتن ناموفق و «بی‌صدا» بود — تب عوض می‌شد ولی پنل هرگز رندر نه. */
  window.cmsTab = function (t) {
    _tab = t;
    var el = document.getElementById('cmsWrap');
    if (el) { renderCms(el); return; }          /* داخل مدیریت سایت هستیم — رندر مستقیم */
    if (typeof goPanelByName === 'function') goPanelByName('cms'); /* ورود اولیه از بیرون */
  };

  window.renderCms = function () {
    var el = document.getElementById('cmsWrap');
    if (!el) return;
    api('status', null, function (d) {
      var st = document.getElementById('cmsStatus');
      if (st) {
        st.innerHTML = d.ok
          ? (d.writable
            ? '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#065f46">✅ اتصال CMS برقرار — مجوز نوشتن فایل‌ها تایید شد. تغییرات مستقیم روی سایت اعمال می‌شود.</div>'
            : '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#b91c1c">⚠️ سرور مجوز نوشتن روی فایل‌های سایت را ندارد — از هاستینگ بخواهید write permission بدهد (پوشه news و blog).</div>')
          : '<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#92400e">⚠️ ' + escP(d.error || 'اتصال CMS برقرار نشد') + '</div>';
      }
    });
    /* v34.26.1 (TAB-GUARD): خطای رندر هر تب دیگر تب را خالی نمی‌گذارد — پیام مرئی */
    try {
      if (_tab === 'news') renderCmsNews(el);
      else if (_tab === 'blog') renderCmsBlog(el);
      else if (_tab === 'prod') renderCmsProducts(el); /* v34.11.0 (S2) */
      else if (_tab === 'page') renderCmsPageNew(el); /* v34.13.0 (S2-id) */
      else if (_tab === 'q') renderCmsQuality(el); /* v34.14.0 (S4) */
      else renderCmsSeo(el);
    } catch (eTab) {
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;font-size:13px;color:#b91c1c;line-height:2">⚠️ <b>خطای رندر بخش «' + escP(_tab) + '»</b><br>' + escP(eTab && eTab.message) + '<br><small>این متن را برای رفع نهایی گزارش کنید (F12 ← Console جزئیات بیشتری دارد).</small></div>';
    }
  };

  /* ============ AC1: اخبار ============ */
  function loadNewsFromSite(cb) {
    if (_news) { cb(_news); return; }
    fetch('../news/index.html').then(function (r) { return r.text(); }).then(function (s) {
      var m = s.match(/const news = \[([\s\S]*?)\n\];/);
      if (!m) { _news = []; cb(_news); return; }
      try {
        /* آرایه JS با کلیدهای بدون کوتیشن → تبدیل امن */
        var arr = (new Function('return [' + m[1] + ']'))();
        _news = arr.map(function (n) { return { date: n.date, title: n.title, tag: n.tag, cat: n.cat, desc: n.desc }; });
      } catch (e) { _news = []; }
      cb(_news);
    }).catch(function () { _news = []; cb(_news); });
  }

  function renderCmsNews(el) {
    el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:14px">در حال خواندن اخبار سایت...</div>';
    loadNewsFromSite(function (list) {
      var h = '<div class="sb2" style="margin-bottom:10px"><button class="bt" onclick="cmsNewsAdd()">+ خبر جدید</button>' +
        '<button class="bt bt-s" onclick="cmsNewsPublish()">🚀 انتشار تغییرات روی سایت</button></div>';
      h += list.map(function (n, i) {
        return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<span style="font-size:13px;flex:1"><b>' + escP(n.title) + '</b><br><small style="color:#64748b">' + escP(n.date) + ' | ' + escP(n.tag) + '</small></span>' +
          '<span style="display:flex;gap:4px">' +
          '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="cmsNewsEdit(' + i + ')">✏️</button>' +
          (i > 0 ? '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="cmsNewsMove(' + i + ',-1)">↑</button>' : '') +
          '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="cmsNewsDel(' + i + ')">🗑️</button></span></div>';
      }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px">خبری یافت نشد</div>';
      el.innerHTML = h;
    });
  }

  window.cmsNewsAdd = function () { cmsNewsForm(-1); };
  window.cmsNewsEdit = function (i) { cmsNewsForm(i); };
  window.cmsNewsMove = function (i, dir) {
    var x = _news.splice(i, 1)[0];
    _news.splice(i + dir, 0, x);
    renderCms();
  };
  window.cmsNewsDel = function (i) {
    if (!confirm('خبر «' + _news[i].title + '» حذف شود؟ (پس از «انتشار» از سایت هم حذف می‌شود)')) return;
    _news.splice(i, 1);
    renderCms();
  };

  function cmsNewsForm(i) {
    var n = i > -1 ? _news[i] : { date: new Date().toLocaleDateString('fa-IR'), title: '', tag: 'قرارداد جدید', cat: 'contract', desc: '' };
    var catOpts = NEWS_CATS.map(function (c) { return '<option value="' + c.v + '"' + (n.cat === c.v ? ' selected' : '') + '>' + c.lb + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px">' +
      '<h3>' + (i > -1 ? '✏️ ویرایش خبر' : '📰 خبر جدید') + '</h3>' +
      '<div class="fld"><label>عنوان *</label><input type="text" id="cnTitle" value="' + escP(n.title) + '"></div>' +
      '<div class="fr"><div class="fld"><label>تاریخ شمسی</label>' + (typeof ptfDatePicker === 'function' ? ptfDatePicker('cnDate', n.date) : '<input type="text" id="cnDate" value="' + escP(n.date) + '" style="direction:ltr">') + '</div>' +
      '<div class="fld"><label>دسته</label><select id="cnCat" onchange="document.getElementById(\'cnTag\').value=this.options[this.selectedIndex].text">' + catOpts + '</select></div></div>' +
      '<input type="hidden" id="cnTag" value="' + escP(n.tag) + '">' +
      '<div class="fld"><label>متن خبر *</label><textarea id="cnDesc" rows="5">' + escP(n.desc) + '</textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsNewsSave(' + i + ')">ذخیره (پیش‌نویس)</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">پس از ذخیره، دکمه «🚀 انتشار» را بزنید تا روی سایت برود.</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  }

  window.cmsNewsSave = function (i) {
    var rec = {
      title: document.getElementById('cnTitle').value.trim(),
      date: document.getElementById('cnDate').value.trim(),
      tag: document.getElementById('cnTag').value.trim() || NEWS_CATS.filter(function (c) { return c.v === document.getElementById('cnCat').value; })[0].lb,
      cat: document.getElementById('cnCat').value,
      desc: document.getElementById('cnDesc').value.trim()
    };
    if (!rec.title || !rec.desc) { alert('عنوان و متن الزامی است'); return; }
    if (i > -1) _news[i] = rec; else _news.unshift(rec);
    hideModal();
    renderCms();
  };

  window.cmsNewsPublish = function () {
    if (!_news) { alert('ابتدا اخبار بارگذاری شود'); return; }
    if (!confirm('🚀 ' + _news.length + ' خبر روی سایت (news/index.html) منتشر شود؟')) return;
    api('news_save', { items: JSON.stringify(_news) }, function (d) {
      if (d.ok) {
        alert('✅ اخبار روی سایت منتشر شد (' + d.count + ' خبر)');
        audit('CMS', 'انتشار اخبار سایت — ' + d.count + ' خبر', '');
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ============ AC2: وبلاگ ============ */
  function renderCmsBlog(el) {
    el.innerHTML = '<div class="sb2" style="margin-bottom:10px"><button class="bt" onclick="cmsBlogNew()">+ مقالهٔ وبلاگ</button>' +
      '<button class="bt bt-o" onclick="cmsKcNew()">+ مقالهٔ مرکز دانش</button></div><div id="cmsBlogList" style="max-height:420px;overflow:auto"><div style="color:#94a3b8;text-align:center;padding:14px">در حال بارگذاری...</div></div>';
    api('blog_list', null, function (d) {
      var lel = document.getElementById('cmsBlogList');
      if (!lel) return;
      if (!d.ok) { lel.innerHTML = '<div style="color:#dc2626;padding:10px">' + escP(d.error || '') + '</div>'; return; }
      lel.innerHTML = (d.articles || []).map(function (a) {
        return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:9px 12px;margin-bottom:5px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<span style="font-size:12.5px;flex:1"><b>' + escP(a.title) + '</b>' + (a.archived ? ' <span class="bd" style="background:#f1f5f9;color:#94a3b8">آرشیو</span>' : '') + '<br><small style="color:#94a3b8;direction:ltr;display:inline-block">' + escP(a.file) + ' (' + Math.round(a.size / 1024) + 'KB)</small></span>' +
          '<span style="display:flex;gap:4px">' +
          '<a class="bt bt-o" style="padding:4px 9px;font-size:12px;text-decoration:none" target="_blank" href="../blog/' + escP(a.file) + '">👁️</a>' +
          (!a.archived ? '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="cmsBlogArchive(\'' + ptfOnClickArg(a.file.replace('.html', '')) + '\')">🗄 آرشیو</button>' : '') +
          '</span></div>';
      }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px">مقاله‌ای نیست</div>';
    });
  }

  /* دسته‌های مرکز دانش — همان کلیدهای icon در const cats داخلِ
     knowledge-center/index.html. اگر دسته‌ای اضافه شد، اینجا هم اضافه شود. */
  var KC_CATS = [
    ['pipe', 'لوله و اتصالات پایپینگ'], ['valve', 'شیرآلات صنعتی'],
    ['instrument', 'ابزار دقیق و اندازه‌گیری'], ['electrical', 'برق صنعتی و اتوماسیون'],
    ['quality', 'تامین، بازرسی و کیفیت'], ['industry', 'کاربردهای صنعتی'],
    ['electrical_power', 'برق صنعتی — تکمیلی'], ['rotating', 'پمپ و کمپرسور'],
    ['procurement', 'مدیریت تامین و بازرگانی'], ['pipe_special', 'راهنماهای تخصصی لوله'],
    ['flange', 'فلنج و اتصالات — تکمیلی'], ['instrument_precision', 'ابزار دقیق — تکمیلی'],
    ['valve_special', 'راهنماهای تخصصی شیرآلات'], ['seal', 'گسکت و آب‌بندی'],
    ['process', 'سیستم‌های فرآیندی و جانبی'], ['mechanical', 'تجهیزات مکانیکال و تاسیسات']
  ];

  window.cmsKcNew = function () {
    window._kcBodyIsHtml = false;
    var opts = KC_CATS.map(function (c) {
      return '<option value="' + escP(c[0]) + '">' + escP(c[1]) + '</option>';
    }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:760px;max-height:94vh;overflow:auto">' +
      '<h3>📚 مقالهٔ جدیدِ مرکز دانش</h3>' +
      '<div class="fld"><label>عنوان * <span id="kcTitleLen" style="font-size:11px"></span></label>' +
      '<input type="text" id="kcTitle" oninput="cmsKcCount()"></div>' +
      '<div class="fld"><label>نامک انگلیسی (slug) * <small style="color:#94a3b8">فقط a-z 0-9 و خط تیره — بخشی از آدرس می‌شود</small></label>' +
      '<input type="text" id="kcSlug" style="direction:ltr" placeholder="astm-a105-vs-a182"></div>' +
      '<div class="fld"><label>H1 — تیتر داخل صفحه <span id="kcH1Len" style="font-size:11px"></span></label>' +
      '<input type="text" id="kcH1" oninput="cmsKcCount()"></div>' +
      '<div class="fld"><label>توضیح (description) <span id="kcDescLen" style="font-size:11px"></span></label>' +
      '<textarea id="kcDesc" rows="2" oninput="cmsKcCount()"></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>دسته</label><select id="kcCat">' + opts + '</select></div>' +
      '<div class="fld"><label>تصویر <small style="color:#94a3b8">مسیر یا آدرس</small></label>' +
      '<input type="text" id="kcImg" style="direction:ltr" value="../assets/images/ptf-logo.png"></div></div>' +
      '<div class="fld"><label>متن کامل * <small style="color:#94a3b8">## = تیتر ۲ · ### = تیتر ۳ · خط با «-» = فهرست</small></label>' +
      '<textarea id="kcBody" rows="16" style="line-height:1.9"></textarea></div>' +
      '<div class="fld"><label>لینک‌های مرتبط <small style="color:#94a3b8">هر خط: عنوان | نام‌فایل.html</small></label>' +
      '<textarea id="kcRelated" rows="3" style="direction:ltr" placeholder="راهنمای فلنج ASME B16.5 | flange-types-complete-guide.html"></textarea></div>' +
      '<div id="kcAiSt" style="font-size:12px;margin-bottom:6px;line-height:1.8"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
      '<button class="bt bt-o" onclick="cmsKcAiWrite()">🤖 نوشتن با هوش مصنوعی</button>' +
      '<button class="bt bt-o" onclick="cmsKcAiExpand()">📈 بسط متن فعلی</button>' +
      '<button class="bt bt-o" onclick="cmsKcReview()">🔍 بازبینیِ نهاییِ سئو با AI</button></div>' +
      '<div id="kcReview"></div>' +
      '<div style="margin-top:8px;padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;cursor:pointer;margin:0">' +
      '<input type="checkbox" id="kcReviewed" style="width:16px;height:16px;flex:0 0 auto">' +
      '<span>متن و اعداد فنی را خواندم و تأیید می‌کنم — تا این تیک زده نشود انتشار ممکن نیست</span></label></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsKcPublish()">🚀 انتشار در مرکز دانش</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">با قالبِ استانداردِ مرکز دانش (هدر/فوتر/H1/Schema/Breadcrumb) ساخته می‌شود، به فهرستِ مرکز دانش و نقشهٔ سایت اضافه می‌شود.</small>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    cmsDraftRestore(KC_FIELDS, 'kcAiSt'); cmsDraftBind(KC_FIELDS); /* v34.10.0 (S1/DRAFTS) */
  };

  window.cmsKcCount = function () {
    [['kcTitle', 'kcTitleLen', 30, 65], ['kcH1', 'kcH1Len', 20, 70], ['kcDesc', 'kcDescLen', 70, 165]].forEach(function (x) {
      var e = document.getElementById(x[0]), o = document.getElementById(x[1]);
      if (!e || !o) return;
      var l = e.value.trim().length;
      o.textContent = l + ' کاراکتر';
      o.style.color = (l >= x[2] && l <= x[3]) ? '#059669' : '#dc2626';
    });
  };

  /* «عنوان | فایل.html» → آرایهٔ {t,f} */
  function kcParseRelated() {
    var t = ((document.getElementById('kcRelated') || {}).value || '');
    var out = [];
    t.split('\n').forEach(function (ln) {
      var p = ln.split('|');
      if (p.length < 2) return;
      var f = p[1].trim().toLowerCase().replace(/[^a-z0-9\-_.]/g, '');
      if (p[0].trim() && f) out.push({ t: p[0].trim(), f: f });
    });
    return out;
  }

  window.cmsKcAiWrite = function () {
    var topic = ((document.getElementById('kcTitle') || {}).value || '').trim();
    if (!topic) { alert('ابتدا عنوان را بنویسید تا هوش مصنوعی بر همان مبنا بنویسد.'); return; }
    var st = document.getElementById('kcAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ در حال نگارش مقاله… (۳۰ تا ۶۰ ثانیه)</span>';
    cmsLLM('seo_article', { topic: topic, kw: topic, audience: 'کارشناس خرید و مهندس پایپینگ' }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      var g = d.data, cur = ((document.getElementById('kcBody') || {}).value || '').trim();
      if (cur && !confirm('متن فعلی با مقالهٔ پیشنهادی جایگزین شود؟')) { if (st) st.textContent = 'متن فعلی حفظ شد.'; return; }
      cmsSetLen('kcTitle', g.title); cmsSetLen('kcH1', g.h1); cmsSetLen('kcDesc', g.desc);
      cmsSetLen('kcSlug', (g.slug || '').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
      cmsSetLen('kcBody', g.body || '');
      window._kcBodyIsHtml = true;
      var rv = document.getElementById('kcReviewed'); if (rv) rv.checked = false;
      cmsKcCount();
      if (st) st.innerHTML = '<span style="color:#059669">✅ تولید شد. حتماً «بازبینیِ نهاییِ سئو» را بزنید و اعداد فنی را چک کنید.</span>';
    });
  };

  window.cmsKcAiExpand = function () {
    var cur = ((document.getElementById('kcBody') || {}).value || '').trim();
    if (cur.length < 40) { alert('ابتدا متن فعلی را در کادر متن بگذارید.'); return; }
    var st = document.getElementById('kcAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ در حال بسط مقاله…</span>';
    var send = (cur.indexOf('<') > -1) ? cur : cmsMdToHtml(cur);
    cmsLLM('seo_expand', { topic: ((document.getElementById('kcTitle') || {}).value || '').trim(), text: send }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      if (!confirm('متن با نسخهٔ بسط‌یافته جایگزین شود؟')) { if (st) st.textContent = 'متن فعلی حفظ شد.'; return; }
      var g = d.data;
      if (g.title) cmsSetLen('kcTitle', g.title);
      if (g.desc) cmsSetLen('kcDesc', g.desc);
      if (g.h1) cmsSetLen('kcH1', g.h1);
      cmsSetLen('kcBody', g.body || '');
      window._kcBodyIsHtml = true;
      var rv = document.getElementById('kcReviewed'); if (rv) rv.checked = false;
      cmsKcCount();
      if (st) st.innerHTML = '<span style="color:#059669">✅ بسط انجام شد.</span>';
    });
  };

  window.cmsKcReview = function () {
    var raw = ((document.getElementById('kcBody') || {}).value || '').trim();
    if (raw.length < 100) { alert('ابتدا متن مقاله را بنویسید.'); return; }
    var st = document.getElementById('kcAiSt'), box = document.getElementById('kcReview');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ بازبینیِ نهاییِ سئو…</span>';
    var body = window._kcBodyIsHtml ? raw : cmsMdToHtml(raw);
    cmsLLM('seo_review', {
      title: ((document.getElementById('kcTitle') || {}).value || '').trim(),
      h1: ((document.getElementById('kcH1') || {}).value || '').trim(),
      desc: ((document.getElementById('kcDesc') || {}).value || '').trim(),
      body: body
    }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      if (st) st.innerHTML = '';
      var g = d.data, col = g.verdict === 'publish' ? '#059669' : '#d97706';
      var h = '<div style="border:1px solid var(--brd);border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.9;max-height:260px;overflow:auto">' +
        '<div style="margin-bottom:6px"><b style="color:' + col + '">امتیاز: ' + escP(String(g.score == null ? '—' : g.score)) + '/۱۰۰</b>' +
        ' · وضعیت: <b>' + escP(g.verdict || '—') + '</b></div>';
      (g.issues || []).forEach(function (i) {
        var c = i.severity === 'high' ? '#dc2626' : (i.severity === 'medium' ? '#d97706' : '#64748b');
        h += '<div style="margin:5px 0;padding:6px 8px;background:#f8fafc;border-right:3px solid ' + c + ';border-radius:6px">' +
          '<b>' + escP(i.severity || '') + '</b> — ' + escP(i.issue || '') + '<br><span style="color:#475569">راهکار: ' + escP(i.fix || '') + '</span></div>';
      });
      if (g.missing_keywords && g.missing_keywords.length) h += '<div style="margin-top:6px"><b>واژگانِ جاافتاده:</b> ' + escP([].concat(g.missing_keywords).join('، ')) + '</div>';
      if (g.internal_links && g.internal_links.length) {
        h += '<div style="margin-top:6px"><b>لینکِ داخلیِ پیشنهادی:</b><ul style="margin:4px 0 0 18px">';
        [].concat(g.internal_links).forEach(function (l) { h += '<li>' + escP(l.anchor || '') + ' → <span style="direction:ltr">' + escP(l.target || '') + '</span></li>'; });
        h += '</ul></div>';
      }
      if (g.summary) h += '<div style="margin-top:6px;color:#475569">' + escP(g.summary) + '</div>';
      h += '</div>';
      if (box) box.innerHTML = h;
    });
  };

  window.cmsKcPublish = function () {
    var title = document.getElementById('kcTitle').value.trim();
    var slug = document.getElementById('kcSlug').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var h1 = document.getElementById('kcH1').value.trim() || title;
    var desc = document.getElementById('kcDesc').value.trim();
    var cat = document.getElementById('kcCat').value;
    var img = document.getElementById('kcImg').value.trim();
    var raw = document.getElementById('kcBody').value;
    if (!title || !slug || !desc || raw.trim().length < 200) { alert('عنوان، نامک، توضیح و متن (حداقل ۲۰۰ حرف) الزامی است'); return; }
    var rv = document.getElementById('kcReviewed');
    if (!rv || !rv.checked) { alert('⛔ پیش از انتشار باید تیکِ تأییدِ انسانی زده شود.\nمتن و اعداد فنی را بازبینی کنید.'); return; }
    var body = window._kcBodyIsHtml ? raw : cmsMdToHtml(raw);
    if (!confirm('🚀 مقالهٔ «' + title + '» با آدرس knowledge-center/' + slug + '.html منتشر شود؟')) return;
    var payload = { title: title, slug: slug, h1: h1, desc: desc, cat: cat, img: img, body: body, related: JSON.stringify(kcParseRelated()) };
    api('kc_create', payload, function (d) {
      if (d.ok) {
        audit('CMS', 'انتشار مقالهٔ مرکز دانش: ' + title, slug);
        hideModal();
        renderCms();
        cmsDraftClear(KC_FIELDS); /* v34.10.0: انتشار شد — پیش‌نویس دیگر لازم نیست */
        alert('✅ مقاله منتشر شد:\npishtaj.ir/' + d.url + (d.listed ? '\n(به فهرستِ مرکز دانش هم اضافه شد)' : '\n⚠️ به فهرستِ مرکز دانش اضافه نشد — دستی اضافه کنید') + (window.cmsSitemapNote ? window.cmsSitemapNote(d) : ''));
        if (!cmsSitemapAfterPublish() && typeof gscSubmitSitemap === 'function') gscSubmitSitemap(); /* v34.10.0: خودکار در صورت روشن‌بودن سوییچ */
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک وجود دارد — بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('kc_create', payload, function (d2) {
            if (d2.ok) { audit('CMS', 'بازنویسی مقالهٔ مرکز دانش: ' + title, slug); hideModal(); renderCms(); cmsDraftClear(KC_FIELDS); cmsSitemapAfterPublish(); }
            else alert('⚠️ ' + (d2.error || 'خطا'));
          });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  window.cmsBlogNew = function () {
    window._cmsBodyIsHtml = false;   /* خروجیِ AI هنوز تأییدِ انسانی نشده */
    var catOpts = BLOG_CATS.map(function (c) { return '<option value="' + c.v + '">' + c.lb + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن بدون ذخیره؟\'))hideModal()"><div class="md" style="max-width:760px;max-height:94vh;overflow:auto">' +
      '<h3>📝 مقاله جدید وبلاگ</h3>' +
      '<div class="fld"><label>عنوان مقاله *</label><input type="text" id="cbTitle" placeholder="مثال: راهنمای انتخاب گسکت اسپیرال وند"></div>' +
      '<div class="fr"><div class="fld"><label>نامک انگلیسی (slug — آدرس صفحه) *</label><input type="text" id="cbSlug" placeholder="spiral-wound-gasket-guide" style="direction:ltr"></div>' +
      '<div class="fld"><label>دسته</label><select id="cbCat">' + catOpts + '</select></div></div>' +
      '<div class="fld"><label>خلاصه (متا — برای گوگل، حداکثر ۳۰۰ حرف) *</label><textarea id="cbDesc" rows="2"></textarea></div>' +
      '<div class="fld"><label>متن کامل مقاله * <small style="color:#94a3b8">(می‌توانید تیتر را با ## در ابتدای خط بنویسید — خودکار H2 می‌شود)</small></label>' +
      '<textarea id="cbBody" rows="14" style="line-height:1.9"></textarea></div>' +
      '<div id="cbAiSt" style="font-size:12px;margin-bottom:6px;line-height:1.8"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
      '<button class="bt bt-o" onclick="cmsAiArticle()">🤖 نوشتن مقاله با هوش مصنوعی</button>' +
      '<button class="bt bt-o" onclick="cmsAiExpand()">📈 بسط و بهبود متن فعلی</button></div>' +
      '<div style="margin-top:8px;padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;cursor:pointer;margin:0">' +
      '<input type="checkbox" id="cbReviewed" style="width:16px;height:16px;flex:0 0 auto">' +
      '<span>متن را خواندم و تأیید می‌کنم — تا این تیک زده نشود، انتشارِ خروجیِ هوش مصنوعی ممکن نیست</span></label></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsBlogPublish()">🚀 انتشار مقاله روی سایت</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">صفحه با قالب استاندارد سایت (هدر/فوتر/سئو/Schema) ساخته و به فهرست وبلاگ و sitemap اضافه می‌شود.</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    cmsDraftRestore(CB_FIELDS, 'cbAiSt'); cmsDraftBind(CB_FIELDS); /* v34.10.0 (S1/DRAFTS) */
  };

  // مارک‌داون سبک: ## → h2 | ### → h3 | خط با - → لیست
  window.cmsMdToHtml = function (txt) {
    var lines = String(txt).split('\n');
    var out = [], inList = false, para = [];
    function flushPara() {
      if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; }
    }
    function flushList() { if (inList) { out.push('</ul>'); inList = false; } }
    lines.forEach(function (l) {
      var t = l.trim();
      if (!t) { flushPara(); flushList(); return; }
      if (t.indexOf('###') === 0) { flushPara(); flushList(); out.push('<h3>' + t.slice(3).trim() + '</h3>'); }
      else if (t.indexOf('##') === 0) { flushPara(); flushList(); out.push('<h2>' + t.slice(2).trim() + '</h2>'); }
      else if (t.indexOf('- ') === 0 || t.indexOf('• ') === 0) {
        flushPara();
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + t.slice(2).trim() + '</li>');
      }
      else para.push(t);
    });
    flushPara(); flushList();
    return out.join('\n');
  };

  /* نوشتنِ مقالهٔ کامل از روی موضوع — خروجی HTML امن (بدونِ مارک‌داون) */
  window.cmsAiArticle = function () {
    var topic = (document.getElementById('cbTitle') || {}).value.trim();
    if (!topic) { alert('ابتدا عنوان/موضوع مقاله را بنویسید تا هوش مصنوعی بر همان مبنا بنویسد.'); return; }
    var st = document.getElementById('cbAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ هوش مصنوعی در حال نگارش مقالهٔ کامل… (۳۰ تا ۶۰ ثانیه)</span>';
    cmsLLM('seo_article', { topic: topic, kw: topic, audience: 'کارشناس خرید و مهندس پایپینگ' }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      var g = d.data;
      var cur = (document.getElementById('cbBody') || {}).value.trim();
      if (cur && !confirm('متن فعلی با مقالهٔ پیشنهادی جایگزین شود؟')) { if (st) st.textContent = 'متن فعلی حفظ شد.'; return; }
      cmsSetLen('cbTitle', g.title); cmsSetLen('cbDesc', g.desc);
      cmsSetLen('cbSlug', (g.slug || '').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
      /* خروجی HTML است؛ در textarea به‌صورت متن گذاشته می‌شود و در انتشار مستقیم مصرف می‌شود */
      cmsSetLen('cbBody', g.body || '');
      window._cmsBodyIsHtml = true;
      var rvw = document.getElementById('cbReviewed'); if (rvw) rvw.checked = false;
      if (st) st.innerHTML = '<span style="color:#059669">✅ مقاله تولید شد. پیش از انتشار حتماً متن و اعداد فنی را بازبینی کنید.</span>';
    });
  };

  /* بسط و تکمیلِ مقالهٔ کوتاهِ موجود — داده‌های متنِ قبلی حذف نمی‌شود */
  window.cmsAiExpand = function () {
    var cur = ((document.getElementById('cbBody') || {}).value || '').trim();
    if (cur.length < 40) { alert('ابتدا متن فعلی مقاله را در کادر متن قرار دهید.'); return; }
    var topic = ((document.getElementById('cbTitle') || {}).value || '').trim();
    var st = document.getElementById('cbAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ هوش مصنوعی در حال بسط و تکمیل مقاله…</span>';
    /* اگر متن HTML است همان را می‌فرستیم، وگرنه از مارک‌داونِ سبک HTML می‌سازیم */
    var send = (cur.indexOf('<') === 0 || cur.indexOf('<h2') > -1 || cur.indexOf('<p>') > -1) ? cur : cmsMdToHtml(cur);
    cmsLLM('seo_expand', { topic: topic, text: send }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      var g = d.data;
      if (!confirm('متن با نسخهٔ بسط‌یافته جایگزین شود؟')) { if (st) st.textContent = 'متن فعلی حفظ شد.'; return; }
      if (g.title) cmsSetLen('cbTitle', g.title);
      if (g.desc) cmsSetLen('cbDesc', g.desc);
      cmsSetLen('cbBody', g.body || '');
      window._cmsBodyIsHtml = true;
      var rve = document.getElementById('cbReviewed'); if (rve) rve.checked = false;
      var ad = (g.added || []);
      if (st) st.innerHTML = '<span style="color:#059669">✅ بسط انجام شد.</span>' +
        (ad.length ? '<br><b>چه چیزی اضافه شد:</b> ' + escP([].concat(ad).join(' · ')) : '');
    });
  };

  window.cmsBlogPublish = function () {
    var title = document.getElementById('cbTitle').value.trim();
    var slug = document.getElementById('cbSlug').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var desc = document.getElementById('cbDesc').value.trim();
    var catV = document.getElementById('cbCat').value;
    var catLb = BLOG_CATS.filter(function (c) { return c.v === catV; })[0].lb;
    var bodyRaw = document.getElementById('cbBody').value;
    if (!title || !slug || !desc || bodyRaw.trim().length < 100) { alert('همه فیلدها الزامی است (متن حداقل ۱۰۰ حرف)'); return; }
    /* دروازهٔ بازبینیِ انسانی: خروجیِ AI بدونِ تیکِ تأیید منتشر نمی‌شود */
    if (window._cmsBodyIsHtml) {
      var rvB = document.getElementById('cbReviewed');
      if (!rvB || !rvB.checked) {
        alert('⛔ این متن را هوش مصنوعی نوشته است.\nپیش از انتشار باید یک انسان آن را بخواند و تیکِ تأیید را بزند.');
        return;
      }
    }
    var body = window._cmsBodyIsHtml ? bodyRaw : cmsMdToHtml(bodyRaw);
    if (!confirm('🚀 مقاله «' + title + '» با آدرس blog/' + slug + '.html روی سایت منتشر شود؟')) return;
    api('blog_create', {
      title: title, slug: slug, desc: desc, cat: catV, catLb: catLb, body: body,
      dateFa: new Date().toLocaleDateString('fa-IR')
    }, function (d) {
      if (d.ok) {
        alert('✅ مقاله منتشر شد:\npishtaj.ir/' + d.url + '\n\n' + (d.sitemap === 'failed' ? 'به فهرست وبلاگ اضافه شد — اما ثبت نقشه ناموفق بود ⚠️' : '(به فهرست وبلاگ و sitemap هم اضافه شد)') + (window.cmsSitemapNote ? window.cmsSitemapNote(d) : ''));
        audit('CMS', 'انتشار مقاله: ' + title, slug);
        hideModal();
        renderCms();
        cmsDraftClear(CB_FIELDS); cmsSitemapAfterPublish(); /* v34.10.0 (S1): پیش‌نویس پاک + نقشه خودکار */
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک وجود دارد — بازنویسی شود؟')) {
          api('blog_create', { title: title, slug: slug, desc: desc, cat: catV, catLb: catLb, body: body, dateFa: new Date().toLocaleDateString('fa-IR'), overwrite: 1 }, function (d2) {
            if (d2.ok) { alert('✅ بازنویسی شد' + (window.cmsSitemapNote ? window.cmsSitemapNote(d2) : '')); hideModal(); renderCms(); cmsDraftClear(CB_FIELDS); cmsSitemapAfterPublish(); }
            else alert('⚠️ ' + (d2.error || ''));
          });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  window.cmsBlogArchive = function (slug) {
    if (!confirm('🗄 مقاله آرشیو شود؟\n• نسخه اصلی در پوشه امن سرور نگهداری می‌شود\n• آدرس قدیمی به فهرست وبلاگ ریدایرکت می‌شود (حفظ سئو)\n• از فهرست و sitemap حذف می‌شود')) return;
    api('blog_archive', { slug: slug }, function (d) {
      if (d.ok) { alert('✅ آرشیو شد'); audit('CMS', 'آرشیو مقاله', slug); renderCms(); }
      else alert('⚠️ ' + (d.error || ''));
    });
  };

  /* ============ AC3 (v34.9.1): سئوی صفحات — اسکن سراسری + ویرایش ============ */
  /* برچسب فارسی + شدتِ هر مشکل (bad = باید اصلاح شود / warn = بهتر است اصلاح شود) */
  var SEO_ISSUES = {
    'no-title': ['بدون عنوان', 'bad'],
    'no-desc': ['بدون توضیح', 'bad'],
    'noindex': ['noindex دارد', 'bad'],
    'no-canonical': ['بدون canonical', 'bad'],
    'no-h1': ['بدون H1', 'bad'],
    'title-short': ['عنوان کوتاه', 'warn'],
    'title-long': ['عنوان بلند', 'warn'],
    'desc-short': ['توضیح کوتاه', 'warn'],
    'desc-long': ['توضیح بلند', 'warn'],
    'canonical-mismatch': ['canonical ناهماهنگ', 'warn'],
    'thin-content': ['محتوای کم', 'warn'],
    'img-no-alt': ['تصویر بدون alt', 'warn'],
    'not-in-sitemap': ['خارج از نقشه', 'warn'],
    'no-schema': ['بدون schema', 'warn'],
    'orphan': ['یتیم (بدون لینک ورودی)', 'warn'] /* v34.10.0 (S1) */
  };
  var _seo = { q: '', folder: '', issue: '', offset: 0, limit: 60, done: false };
  var _seoMeta = { stats: null, folders: null, matched: 0, scanned: '', writable: false, sitemap: 0 };

  function seoBadge(code) {
    var d = SEO_ISSUES[code] || [code, 'warn'];
    var col = d[1] === 'bad' ? '#b91c1c' : '#92400e';
    var bg = d[1] === 'bad' ? '#fef2f2' : '#fffbeb';
    return '<span title="' + escP(code) + '" style="display:inline-block;font-size:10.5px;padding:1px 6px;border-radius:8px;margin:2px 3px 0 0;background:' + bg + ';color:' + col + ';border:1px solid ' + (d[1] === 'bad' ? '#fecaca' : '#fde68a') + '">' + d[0] + '</span>';
  }

  function seoLoad(cb) {
    _seo.offset = 0;
    api('page_list', {
      q: _seo.q, folder: _seo.folder, issue: _seo.issue,
      limit: _seo.limit, offset: 0
    }, function (d) {
      if (!d.ok) {
        var el = document.getElementById('cmsWrap');
        if (el) el.innerHTML = '<div style="color:#dc2626;padding:10px">⚠️ ' + escP(d.error || 'خطا در دریافت فهرست صفحات') +
          '<br><small style="color:#64748b">اگر «permission_denied» می‌بینید: نقش شما اجازهٔ CMS ندارد.</small></div>';
        return;
      }
      window._cmsPages = d.pages || [];
      _seoMeta.stats = d.stats || {};
      _seoMeta.folders = d.folders || {};
      _seoMeta.matched = d.matched || 0;
      _seoMeta.scanned = d.scanned_at || '';
      _seoMeta.writable = !!d.writable;
      _seoMeta.sitemap = d.sitemap_urls || 0;
      if (cb) cb();
    });
  }

  function seoStatsBar() {
    var st = _seoMeta.stats || {};
    function chip(label, val, code, color) {
      if (!val) return '';
      var on = _seo.issue === code;
      return '<button type="button" onclick="cmsSeoIssue(\'' + code + '\')" style="border:1px solid ' +
        (on ? color : '#e2e8f0') + ';background:' + (on ? color : '#fff') + ';color:' + (on ? '#fff' : '#475569') +
        ';border-radius:10px;padding:4px 9px;font-size:11.5px;font-family:inherit;cursor:pointer;margin:0 4px 4px 0">' +
        label + ' <b>' + val + '</b></button>';
    }
    var h = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px">';
    h += '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">کل صفحات عمومی: <b>' + (st.total || 0) +
      '</b> · در نقشهٔ سایت: <b>' + (_seoMeta.sitemap || 0) + '</b> · بدون ایراد: <b>' + (st.ok || 0) + '</b>' +
      (_seoMeta.scanned ? ' · <span style="color:#94a3b8">اسکن: ' + escP(_seoMeta.scanned) + '</span>' : '') + '</div>';
    h += chip('بدون توضیح', st['no-desc'], 'no-desc', '#dc2626');
    h += chip('توضیح بلند', st['desc-long'], 'desc-long', '#d97706');
    h += chip('توضیح کوتاه', st['desc-short'], 'desc-short', '#d97706');
    h += chip('بدون عنوان', st['no-title'], 'no-title', '#dc2626');
    h += chip('عنوان بلند', st['title-long'], 'title-long', '#d97706');
    h += chip('عنوان کوتاه', st['title-short'], 'title-short', '#d97706');
    h += chip('بدون H1', st['no-h1'], 'no-h1', '#dc2626');
    h += chip('بدون canonical', st['no-canonical'], 'no-canonical', '#dc2626');
    h += chip('canonical ناهماهنگ', st['canonical-mismatch'], 'canonical-mismatch', '#d97706');
    h += chip('noindex', st['noindex'], 'noindex', '#dc2626');
    h += chip('محتوای کم', st['thin-content'], 'thin-content', '#d97706');
    h += chip('خارج از نقشه', st['not-in-sitemap'], 'not-in-sitemap', '#d97706');
    h += chip('بدون schema', st['no-schema'], 'no-schema', '#0ea5e9');
    h += chip('یتیم (بدون لینک)', st['orphan'], 'orphan', '#7c3aed'); /* v34.10.0 (S1) */
    h += '</div>';
    return h;
  }

  function seoToolbar() {
    var f = _seoMeta.folders || {};
    var opts = '<option value="">همهٔ پوشه‌ها</option>';
    Object.keys(f).forEach(function (k) {
      opts += '<option value="' + escP(k) + '"' + (_seo.folder === k ? ' selected' : '') + '>' + escP(k) + ' (' + f[k] + ')</option>';
    });
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
      '<input type="text" id="seoQ" value="' + escP(_seo.q) + '" placeholder="جستجو در مسیر/عنوان…" ' +
      'onkeydown="if(event.key===\'Enter\')cmsSeoSearch()" style="flex:1;min-width:170px;padding:6px 10px;border:1px solid var(--brd);border-radius:9px;font-family:inherit;font-size:12.5px">' +
      '<select id="seoFolder" onchange="cmsSeoFolder(this.value)" style="padding:6px 8px;border:1px solid var(--brd);border-radius:9px;font-family:inherit;font-size:12.5px">' + opts + '</select>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px" onclick="cmsSeoSearch()">🔍 فیلتر</button>' +
      (_seo.issue ? '<button class="bt bt-o" style="padding:6px 10px;font-size:12px" onclick="cmsSeoIssue(\'\')">✖ حذف فیلتر مشکل</button>' : '') +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px" onclick="cmsSeoRefresh()">⟳ اسکن دوباره</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#d97706" onclick="cmsCanonBulk()" title="صفحات با canonical ناهماهنگ/جاافتاده به آدرس خودشان برمی‌گردند (stubهای ریدایرکت دست نمی‌خورند)">🔧 canonical گروهی</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#7c3aed" onclick="cmsSeoAiBatch()" title="هوش مصنوعی همهٔ صفحاتِ دارای ایراد عنوان/توضیح/H1 را طبق قوانین سئو و سرچ کنسول گوگل آنالیز و اصلاح می‌کند">🤖 اصلاح هوشمند گروهی</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#0e7490" onclick="cmsSeoSitemapPush()" title="نقشهٔ سایت (شامل آخرین صفحات منتشرشده) در سرچ کنسول ثبت/به‌روزرسانی می‌شود">📤 سایت‌مپ + سرچ کنسول</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#7c3aed" onclick="cmsGscSelfTest()" title="اتصال به سرچ کنسول، ایمیل سرویس‌اکانت و فهرست پراپرتی‌های قابل‌دسترسی را زنده بررسی می‌کند و علت خطای ثبت را دقیق می‌گوید">🧪 آزمون اتصال GSC</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#059669" onclick="cmsIndexWizard()" title="بررسی وضعیت ایندکس صفحات + درخواست ایندکس آن‌هایی که ایندکس نشده‌اند">🚀 ایندکس‌یاب</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px" onclick="cmsSeoExport()">⬇️ CSV</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px" onclick="cmsSitemapDrift()">🧭 انحراف نقشه</button>' +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px' + (cmsSitemapAutoOn() ? ';color:#059669' : '') + '" onclick="cmsSitemapAutoToggle(this)">' + (cmsSitemapAutoOn() ? '🔄 ثبت خودکار نقشه: روشن' : '🔄 ثبت خودکار نقشه: خاموش') + '</button>' +
      '</div>' +
      (_seoMeta.writable ? '' : '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:7px 11px;font-size:12px;color:#b91c1c;margin-bottom:8px">⚠️ فایل‌های سایت روی هاست قابل‌نوشتن نیست — ویرایش‌ها ذخیره نمی‌شوند. از هاستینگ بخواهید مجوز write بدهد.</div>');
  }

  function seoRows() {
    var list = window._cmsPages || [];
    if (!list.length) return '<div style="color:#94a3b8;text-align:center;padding:16px">صفحه‌ای با این فیلتر پیدا نشد</div>';
    return list.map(function (p, i) {
      var badges = (p.issues || []).map(seoBadge).join('');
      var tl = p.title_len || 0, dl = p.desc_len || 0;
      function lenColor(v, lo, hi) { return (!v || v < lo || v > hi) ? '#dc2626' : '#059669'; }
      return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:9px 12px;margin-bottom:5px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:220px">' +
        '<div style="font-size:12.5px;font-weight:700;direction:ltr;text-align:left;color:#0f172a">' + escP(p.path) + '</div>' +
        '<div style="font-size:12px;color:#334155;margin-top:2px">' + escP((p.title || '').slice(0, 90)) + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' +
        'عنوان <b style="color:' + lenColor(tl, 30, 65) + '">' + tl + '</b> · ' +
        'توضیح <b style="color:' + lenColor(dl, 70, 165) + '">' + dl + '</b> · ' +
        (p.words || 0) + ' واژه · ' + (p.sitemap ? 'در نقشه' : '<span style="color:#dc2626">خارج از نقشه</span>') +
        '</div></div>' +
        '<div style="display:flex;gap:4px;align-items:center">' +
        '<a class="bt bt-o" style="padding:4px 8px;font-size:11.5px;text-decoration:none" target="_blank" href="/' + escP(p.path) + '">👁️</a>' +
        '<button class="bt" style="padding:4px 10px;font-size:12px" onclick="cmsSeoEdit(' + i + ')">✏️ ویرایش</button>' +
        ((p.issues || []).indexOf('orphan') > -1 ? '<button class="bt bt-o" style="padding:4px 8px;font-size:11.5px;color:#7c3aed" onclick="cmsSeoLinkSuggest(' + i + ',event)" title="پیشنهاد هوش مصنوعی: از کدام صفحات به این صفحه لینک شود">💡 لینک‌سازی</button>' : '') +
        '</div></div>' +
        (badges ? '<div style="margin-top:5px">' + badges + '</div>' : '<div style="margin-top:5px"><span style="font-size:10.5px;color:#059669">✅ بدون ایراد</span></div>') +
        '</div>';
    }).join('');
  }

  /* ═══ v34.29.2 (SEO-GUIDE): راهنمای سئو برای کاربرانِ ناآشنا — چک‌لیست زنده + ۶ گام
     با دکمهٔ اجرای مستقیم همان ابزار. دانش فنی لازم نیست؛ زبان ساده. ═══ */
  /* v34.35.0 (UX-R4 — گزارش کارفرما): راهنما پیش‌فرض «بسته» است و حالت باز/بسته
     از لایهٔ داده (اصل A10 — بدون دسترسی مستقیم به storage) ماندگار می‌شود؛
     اگر ذخیره ممکن نبود متغیر حافظه‌ای جایگزین است تا دکمه در هر شرایطی کار کند. */
  var _seoGuideMem = null;
  function cmsSeoGuideOpen() {
    var v = _seoGuideMem;
    if (v === null) { try { v = getData('ptf_seo_guide_pref'); } catch (eG) {} }
    return v === '1'; /* پیش‌فرض: بسته */
  }
  window.cmsSeoGuideToggle = function () {
    var to = cmsSeoGuideOpen() ? '0' : '1';
    _seoGuideMem = to;
    try { setData('ptf_seo_guide_pref', to); } catch (eG) {}
    renderCms();
  };
  window.cmsSeoGuideGscProbe = function () {
    var el = document.getElementById('seoGuideGsc'); if (!el) return;
    if (typeof cmsGsc !== 'function') { el.innerHTML = '<span style="color:#94a3b8">نامشخص</span>'; return; }
    cmsGsc('selftest', null, function (d) {
      var el2 = document.getElementById('seoGuideGsc'); if (!el2) return;
      var v = d && d.verdict;
      if (v === 'ok') el2.innerHTML = '<b style="color:#059669">✅ وصل است</b> — آمادهٔ ثبت نقشه';
      else if (v === 'no_match') el2.innerHTML = '<b style="color:#b91c1c">⛔ سرویس‌اکانت هنوز به پراپرتی دسترسی ندارد</b> — با «آزمون اتصال» علت را ببینید';
      else if (v === 'low_perm') el2.innerHTML = '<b style="color:#b45309">⚠️ سطح دسترسی فقط خواندنی است</b>';
      else if (v === 'no_config') el2.innerHTML = '<b style="color:#b45309">⚠️ روی سرور تنظیم نشده (gsc-config.php)</b>';
      else el2.innerHTML = '<b style="color:#b45309">⚠️ نامشخص — با آزمون اتصال بررسی کنید</b>';
    });
  };
  function cmsSeoGuideBox() {
    var st = _seoMeta.stats || {};
    var reds = (st['no-desc'] || 0) + (st['no-title'] || 0) + (st['no-h1'] || 0);
    var ambs = (st['desc-short'] || 0) + (st['desc-long'] || 0) + (st['title-short'] || 0) + (st['title-long'] || 0);
    var total = st.total || 0, inMap = _seoMeta.sitemap || 0;
    var outMap = Math.max(0, total - inMap);
    var open = cmsSeoGuideOpen();
    function step(n, title, body, btns) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed #e2e8f0">' +
        '<span style="flex:none;width:26px;height:26px;border-radius:50%;background:#7c3aed;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:800">' + n + '</span>' +
        '<div style="flex:1"><div style="font-size:12.5px;font-weight:800;color:#0f172a">' + title + '</div><div style="font-size:12px;color:#475569;line-height:2;margin-top:2px">' + body + '</div>' +
        (btns ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + btns + '</div>' : '') + '</div></div>';
    }
    function btn(label, onclick, color) {
      return '<button type="button" class="bt bt-o" style="padding:4px 12px;font-size:11.5px;color:' + (color || '#0e7490') + '" onclick="' + onclick + '">' + label + '</button>';
    }
    var head = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 6px">' +
      '<b style="font-size:13.5px;color:#0f172a">📘 راهنمای سئو برای همه — بدون نیاز به دانش فنی</b>' +
      '<button type="button" class="bt bt-o" style="padding:3px 12px;font-size:11px;margin-right:auto" onclick="cmsSeoGuideToggle()">' + (open ? 'پنهان کردن راهنما ▲' : 'نمایش راهنما ▼') + '</button></div>';
    if (!open) return '<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:8px 14px;margin-bottom:10px">' + head + '</div>';
    var h = '<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 14px;margin-bottom:10px">' + head +
      '<div style="font-size:12px;color:#475569;line-height:2;padding:2px 2px 8px">سئو یعنی کاری کنیم <b>گوگل صفحات ما را برای جستجوهای مرتبط پیدا کند و نمایش دهد</b>. سه چیز به گوگل نشان می‌دهد صفحهٔ شما ارزشمند است: <b>محتوای یگانه و کامل</b>، <b>عنوان و توضیح دقیق</b>، و <b>سیگنال‌های فنی سالم</b>. با ابزارهای همین بخش می‌توانید هر سه را تقویت کنید — هر ابزار را همین‌جا با یک کلیک اجرا کنید.</div>';
    /* چک‌لیست زنده */
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin:4px 0 10px">' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.9"><b>۱) اتصال سرچ کنسول</b><br><span id="seoGuideGsc">⏳ در حال بررسی…</span><br>' + btn('🧪 آزمون اتصال', 'cmsGscSelfTest()', '#7c3aed') + '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.9"><b>۲) صفحات با ایراد عنوان/توضیح</b><br>' +
      (reds + ambs ? '<span style="color:#b91c1c;font-weight:700">' + reds + ' صفحهٔ ایراد جدی</span>' + (ambs ? ' + <span style="color:#b45309">' + ambs + ' ایراد جزئی</span>' : '') : '<span style="color:#059669;font-weight:700">✅ همهٔ صفحات سالم‌اند</span>') +
      '<br>' + btn('مشاهدهٔ فهرست ایرادها', "cmsSeoIssue('no-desc')", '#dc2626') + '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.9"><b>۳) صفحات خارج از نقشهٔ سایت</b><br>' +
      (outMap > 0 ? '<span style="color:#b45309;font-weight:700">' + outMap + ' صفحه هنوز در نقشه نیست</span>' : '<span style="color:#059669;font-weight:700">✅ نقشه کامل است</span>') +
      '<br>' + btn('📤 ثبت نقشه', 'cmsSeoSitemapPush()') + '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.9"><b>۴) صفحات ایندکس‌نشده</b><br><span style="color:#475569">وضعیت را فقط سرچ کنسول می‌داند — با ایندکس‌یاب بررسی کنید</span><br>' + btn('🚀 ایندکس‌یاب', 'cmsIndexWizard()') + '</div></div>';
    /* ۶ گام */
    h += step(1, 'هر هفته نقشهٔ سایت را در سرچ کنسول ثبت کنید', 'نقشهٔ سایت، فهرست رسمی صفحات شماست؛ ثبت هفتگی به گوگل یادآوری می‌کند تازه‌ها را بخواند.',
      btn('📤 سایت‌مپ + سرچ کنسول', 'cmsSeoSitemapPush()'));
    h += step(2, 'صفحات ایندکس‌نشده را پیدا و درخواست ایندکس بدهید', 'اگر صفحه‌ای ایندکس نشده باشد، در گوگل دیده نمی‌شود. ایندکس‌یاب تا ۲۵ صفحه را با API رسمی گوگل بررسی می‌کند و برای ایندکس‌نشده‌ها پیوند «درخواست ایندکس» می‌دهد.',
      btn('🚀 باز کردن ایندکس‌یاب', 'cmsIndexWizard()'));
    h += step(3, 'عنوان و توضیح ناقص‌ها را کامل کنید', 'عنوان ۳۰ تا ۶۵ حرف و توضیح ۷۰ تا ۱۶۵ حرف — همین دو خط، متن آبیِ زیر عنوان شما در نتایج گوگل است. در فهرست پایین همین تب، دکمهٔ ✏️ هر صفحه را بزنید؛ «اصلاح هوشمند» پیش‌نویس می‌سازد ولی بازبینی شما الزامی است.',
      btn('فیلتر «بدون توضیح»', "cmsSeoIssue('no-desc')", '#dc2626') + btn('🤖 اصلاح هوشمند گروهی', 'cmsSeoAiBatch()', '#7c3aed'));
    h += step(4, 'صفحهٔ جدید با متن یگانه بسازید', 'متنِ تکراری به گوگل ارزشی اضافه نمی‌کند. در تب «📄 صفحهٔ جدید» موضوع را بدهید تا هوش مصنوعی پیش‌نویس یگانه بسازد؛ خوانده، اصلاح و تأیید کنید و بعد منتشر کنید (تیک بازبینی انسانی الزامی است).',
      btn('رفتن به تب صفحهٔ جدید', "cmsTab('page')"));
    h += step(5, 'به عکس‌ها متن جایگزین (alt) بدهید', 'گوگل عکس را از متن کنارش می‌فهمد؛ alt مناسب، صفحه را در جستجوی تصاویر هم می‌آورد. در تب کیفیت، «اسکن تصاویر» عکس‌های بدون alt را پیدا و با بینایی AI پیشنهاد می‌دهد.',
      btn('اسکن عکس‌ها در تب کیفیت', "cmsTab('q');setTimeout(cmsAltScan,600)", '#7c3aed'));
    h += step(6, 'از صفحات دیگر به صفحهٔ جدید لینک بدهید', 'لینک داخلی، مسیر رسیدن گوگل و کاربر به صفحهٔ جدید است. در فهرست پایین همین تب، دکمهٔ 💡 هر صفحه پیشنهاد لینک‌سازی هوشمند می‌دهد.', '');
    /* نکن‌ها + برنامهٔ هفتگی + واژه‌نامه */
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#7f1d1d;line-height:2"><b>⛔ این کارها را نکنید</b><br>• کپی متن از سایت‌های دیگر — گوگل صفحهٔ تکراری را نمایش نمی‌دهد<br>• تکرار مصنوعیِ یک کلمه در متن (keyword stuffing)<br>• عنوانِ بی‌ربط یا اغراق‌آمیز برای جذب کلیک<br>• تغییر آدرس صفحهٔ ایندکس‌شده بدون مشورت با مدیر (نیاز به ریدایرکت دارد)</div>' +
      '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#064e3b;line-height:2"><b>📅 برنامهٔ ۱۵ دقیقه‌ای هفتگی</b><br>۱) «📤 ثبت نقشه» — ۱ دقیقه<br>۲) «🚀 ایندکس‌یاب» روی ۱۰ صفحه — ۵ دقیقه<br>۳) فیلتر «بدون توضیح» و اصلاح ۲ صفحه — ۷ دقیقه<br>۴) «🤖 اصلاح هوشمند» + بازبینی نتیجه — ۲ دقیقه</div></div>';
    h += '<details style="margin-top:8px"><summary style="font-size:12px;font-weight:700;color:#0f172a;cursor:pointer">📖 واژه‌نامهٔ کوچک (ایندکس؟ کرال؟ نامک؟)</summary>' +
      '<div style="font-size:11.5px;color:#475569;line-height:2.1;padding:6px 4px">' +
      '<b>ایندکس (Index):</b> وقتی گوگل صفحه‌ای را خوانده و در نتایج جستجو نگه داشته است. <b>کرال (Crawl):</b> بازدید ربات گوگل از صفحه. ' +
      '<b>نقشهٔ سایت (Sitemap):</b> فایلی که فهرست همهٔ صفحات را به گوگل معرفی می‌کند. <b>سرچ کنسول:</b> ابزار رسمی گوگل برای دیدن وضعیت ایندکس و خطاها. ' +
      '<b>CTR:</b> درصد کسانی که از بین نتایج، روی شما کلیک می‌کنند — عنوان و توضیح بهتر یعنی CTR بیشتر. <b>نامک (slug):</b> بخش انگلیسیِ آدرس صفحه مثل valve-maintenance.</div></details>';
    h += '</div>';
    return h;
  }

  function renderCmsSeo(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال اسکن صفحات سایت…</div>';
    seoLoad(function () {
      var list = window._cmsPages || [];
      el.innerHTML = cmsSeoGuideBox() + seoStatsBar() + seoToolbar() + seoQueueBox() + cmsRedirectBox() +
        '<div id="seoDrift"></div>' +
        (typeof ptfGscOptimizeBannerHtml === 'function' ? ptfGscOptimizeBannerHtml() : '') + /* v34.35.0: راهنمای بهینه‌سازی از سرچ کنسول */
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">نمایش ' + list.length + ' از ' + _seoMeta.matched + ' صفحهٔ منطبق (مرتب‌شده: پر‌ایرادترین اول)</div>' +
        '<div id="seoList" style="max-height:520px;overflow:auto">' + seoRows() + '</div>' +
        (list.length < _seoMeta.matched ? '<div style="text-align:center;margin-top:8px"><button class="bt bt-o" onclick="cmsSeoMore()">نمایش بیشتر (۶۰ تای بعدی)</button></div>' : '') +
        '<div style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.9">' +
        'طول مناسب: عنوان ۳۰–۶۵ کاراکتر · توضیح ۷۰–۱۶۵ کاراکتر. تغییرات مستقیماً روی فایل سایت اعمال می‌شود؛ ' +
        'برای ثبت سریع‌تر در گوگل، صفحه را در سرچ کنسول «Request Indexing» بزنید.' +
        '</div>';
      if (typeof cmsRedirectLoad === 'function') cmsRedirectLoad(); /* v34.11.0 (S2) */
      cmsSeoGuideGscProbe(); /* v34.29.2: چیپ زندهٔ اتصال سرچ کنسول در راهنما */
    });
  }

  /* ═══ v34.13.0 (S2-id/GENERIC-PAGE): مولد صفحهٔ عمومی — خدمات/صنایع/مقایسه‌ها ═══ */
  var PAGE_FOLDERS = [
    { v: 'services', lb: 'خدمات (Service schema)' },
    { v: 'industries', lb: 'صنایع' },
    { v: 'comparisons', lb: 'مقایسهٔ محصولات' }
  ];
  var PAGE_FIELDS = ['cmsPgTitle', 'pgSlug', 'pgH1', 'pgDesc', 'pgBody', 'pgImg'];
  window.PAGE_FIELDS = PAGE_FIELDS; /* v34.25.0: برای onclick ذخیرهٔ موقت */

  function renderCmsPageNew(el) { /* v34.26.1: پوستهٔ مقاوم — در خطا، فرم سادهٔ جایگزین بار می‌شود */
    var _pgErr = null;
    try { renderCmsPageNewFull(el); return; } catch (ePg) { _pgErr = ePg; }
    try {
      var _folds = (typeof PAGE_FOLDERS !== 'undefined' && PAGE_FOLDERS && PAGE_FOLDERS.length)
        ? PAGE_FOLDERS.map(function (f) { return '<option value="' + f.v + '">' + f.lb + '</option>'; }).join('')
        : '<option value="services">خدمات</option><option value="industries">صنایع</option><option value="comparisons">مقایسهٔ محصولات</option>';
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 14px;font-size:12.5px;color:#b91c1c;line-height:2;margin-bottom:10px">⚠️ <b>خطای رندر فرم کامل:</b> ' + escP(_pgErr && _pgErr.message) + '<br><small>نسخهٔ سادهٔ فرم زیر بارگذاری شد — همهٔ امکانات (تولید AI / خارجی / پیش‌نمایش / ذخیرهٔ موقت / انتشار) فعال است. متن خطا را برای رفع نهایی گزارش کنید.</small></div>' +
        '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px">' +
        '<div id="pgAiSt" style="font-size:11.5px;color:#6b21a8;margin-bottom:8px"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div class="fld"><label>بخش مقصد *</label><select id="pgFolder">' + _folds + '</select></div>' +
        '<div class="fld"><label>نامک (slug) * <small>a-z و خط تیره</small> <span id="pgSlugLen" style="font-size:11px"></span></label><input type="text" id="pgSlug" dir="ltr" placeholder="valve-maintenance-services" oninput="cmsSlugFb(\'pgSlug\',\'pgSlugLen\')"></div>' +
        '<div class="fld"><label>عنوان یا موضوع برای AI *</label><input type="text" id="pgTopic" placeholder="مثلاً: خدمات تعمیر و کالیبراسیون شیرآلات صنعتی"></div>' +
        '<div class="fld"><label>عنوان سئو (title) <span id="cmsPgTitleLen" style="font-size:11px"></span></label><input type="text" id="cmsPgTitle" oninput="cmsPgCount()"></div>' +
        '<div class="fld"><label>H1</label><input type="text" id="pgH1"></div>' +
        '<div class="fld"><label>تصویر</label><input type="text" id="pgImg" dir="ltr" value="assets/images/ptf-logo.png"></div>' +
        '</div>' +
        '<div class="fld"><label>توضیح (description) <span id="pgDescLen" style="font-size:11px"></span></label><textarea id="pgDesc" rows="2" oninput="cmsPgCount()"></textarea></div>' +
        '<div class="fld"><label>متن صفحه (HTML سبک — کف ۲۰۰ حرف، فقط همین فیلد) <span id="pgBodyLen" style="font-size:11px"></span></label><textarea id="pgBody" rows="10" placeholder="<h2>معرفی ...</h2><p>...</p>" oninput="cmsPgCount()"></textarea></div>' +
        '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">' +
        '<button class="bt" style="background:#7c3aed" onclick="cmsPageAi()">🤖 تولید با هوش مصنوعی</button>' +
        '<button class="bt bt-o" style="color:#0e7490" onclick="cmsPgExtPrompt()">🌐 هوش مصنوعی خارجی</button>' +
        '<button class="bt bt-o" onclick="cmsPgPreview()">👁 پیش‌نمایش</button>' +
        '<button class="bt bt-o" style="color:#059669" onclick="cmsDraftBtn(PAGE_FIELDS,\'pgAiSt\')">💾 ذخیرهٔ موقت</button>' +
        '<button class="bt" onclick="cmsPagePublish()">🚀 انتشار صفحه</button></div>' +
        '</div>';
      cmsDraftRestore(PAGE_FIELDS, 'pgAiSt'); cmsDraftBind(PAGE_FIELDS);
      if (typeof cmsPgCount === 'function') { try { cmsPgCount(); } catch (eC2) {} }
    } catch (e2) {
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px;font-size:13px;color:#b91c1c">خطای بحرانی رندر فرم صفحه: ' + escP(e2 && e2.message) + '</div>';
    }
  }
  function renderCmsPageNewFull(el) {
    var opts = PAGE_FOLDERS.map(function (f) { return '<option value="' + f.v + '">' + f.lb + '</option>'; }).join('');
    el.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:14px;font-size:12px;color:#475569;line-height:2;margin-bottom:10px">' +
      'مولد صفحهٔ عمومی سایت برای بخش‌های <b>خدمات / صنایع / مقایسه‌ها</b>: متن یگانه با هوش مصنوعی (مثل مرکز دانش) + اسکیمای مناسبِ هر بخش + افزودن خودکار به نقشهٔ سایت و ثبت در سرچ کنسول.</div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px">' +
      '<div id="pgAiSt" style="font-size:11.5px;color:#6b21a8;margin-bottom:8px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>بخش مقصد *</label><select id="pgFolder">' + opts + '</select></div>' +
      '<div class="fld"><label>نامک (slug) * <small style="color:#94a3b8">a-z و خط تیره</small> <span id="pgSlugLen" style="font-size:11px"></span></label><input type="text" id="pgSlug" dir="ltr" placeholder="valve-maintenance-services" oninput="cmsSlugFb(\'pgSlug\',\'pgSlugLen\')"></div>' +
      '<div class="fld"><label>عنوان یا موضوع برای AI *</label><input type="text" id="pgTopic" placeholder="مثلاً: خدمات تعمیر و کالیبراسیون شیرآلات صنعتی"></div>' +
      '<div class="fld"><label>مخاطب</label><input type="text" id="pgAud" value="کارشناس خرید و مهندس نگهداری و تعمیر"></div>' +
      '</div>' +
      '<div style="display:flex;gap:7px;margin:10px 0;flex-wrap:wrap;align-items:center"><button class="bt" style="background:#7c3aed" onclick="cmsPageAi()">🤖 تولید با هوش مصنوعی</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="cmsPgExtPrompt()">🌐 هوش مصنوعی خارجی</button>' +
      '<small style="color:#94a3b8">برای مطالب بلند: پرامپت آماده بساز، در ChatGPT/Claude/Gemini ببر و خروجی را همین‌جا بچسبان</small>' +
      '<button class="bt bt-o" style="color:#059669" onclick="cmsDraftBtn(PAGE_FIELDS,\'pgAiSt\')">💾 ذخیرهٔ موقت</button></div>' +
      '<div class="fld"><label>عنوان سئو (title) <span id="cmsPgTitleLen" style="font-size:11px"></span></label><input type="text" id="cmsPgTitle" oninput="cmsPgCount()"></div>' +
      '<div class="fld"><label>H1</label><input type="text" id="pgH1"></div>' +
      '<div class="fld"><label>توضیح (description) <span id="pgDescLen" style="font-size:11px"></span></label><textarea id="pgDesc" rows="2" oninput="cmsPgCount()"></textarea></div>' +
      '<div class="fld"><label>متن صفحه (HTML سبک — کف ۲۰۰ حرف، فقط همین فیلد) <span id="pgBodyLen" style="font-size:11px"></span></label>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">' + /* v34.20.0: نوار ابزار ویرایش */
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgWrap(\'<h2>\',\'</h2>\')" title="تیتر بخش">H2</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgWrap(\'<h3>\',\'</h3>\')" title="تیتر فرعی">H3</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgWrap(\'<p>\',\'</p>\')" title="پاراگراف">¶</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgWrap(\'<b>\',\'</b>\')" title="بولد">B</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgList(\'ul\')" title="لیست نقطه‌ای">• لیست</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgList(\'ol\')" title="فهرست شماره‌دار">۱. فهرست</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgTable()" title="درج جدول ۳×۳">📊 جدول</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgLink()" title="درج لینک">🔗 لینک</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgImg()" title="درج تصویر">🖼 تصویر</button>' +
        '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11px" onclick="cmsPgWrap(\'<blockquote>\',\'</blockquote>\')" title="نقل‌قول">❝</button>' +
      '</div>' +
      '<textarea id="pgBody" rows="12" oninput="cmsPgCount()" style="font-family:inherit"></textarea></div>' +
      '<div class="fld"><label>تصویر (مسیر از ریشهٔ سایت) <button type="button" class="bt bt-o" style="padding:2px 10px;font-size:11px;color:#0e7490" onclick="cmsImgPick(\'pgImg\',\'pgBody\',\'pgSlug\')">📂 انتخاب عکس از سیستم (آپلود)</button></label><input type="text" id="pgImg" dir="ltr" value="assets/images/ptf-logo.png" oninput="cmsImgThumb(\'pgImg\')"><img id="pgImgPrev" alt="" style="display:none;max-width:130px;max-height:80px;object-fit:contain;border:1px solid var(--brd);border-radius:8px;margin-top:6px;background:#f8fafc"></div>' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;color:#374151;margin:8px 0"><input type="checkbox" id="pgReviewed"> ⛔ بازبینی انسانی انجام شد (الزامی)</label>' +
      '<div style="display:flex;gap:7px;align-items:center;margin:8px 0;flex-wrap:wrap"><input type="datetime-local" id="pgWhen" dir="ltr" style="padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px"><button class="bt bt-o" style="color:#7c3aed" onclick="cmsPageSchedule()">🕘 زمان‌بندی انتشار</button><small style="color:#94a3b8">صف در تب «🛠 کیفیت»</small></div>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button class="bt bt-o" style="color:#0e7490" onclick="cmsPgPreview()">👁 پیش‌نمایش</button>' +
        '<button class="bt bt-o" style="color:#7c3aed" onclick="cmsPgExpand()">✍️ گسترش متن با AI</button>' +
        '<button class="bt" onclick="cmsPagePublish()">🚀 انتشار صفحه</button></div>' +
      '</div>';
    cmsDraftRestore(PAGE_FIELDS, 'pgAiSt'); cmsDraftBind(PAGE_FIELDS);
    cmsPgCount(); /* v34.20.0: شمارنده‌ها بلافاصله پس از رندر/بازیابی پیش‌نویس */
    cmsImgThumb('pgImg'); /* v34.25.0: بندانگشتی تصویر پس از بازیابی پیش‌نویس */
  }

  /* ═══ v34.20.0 (PAGE-TOOLS): ابزارهای ویرایش فرم صفحه — شمارنده/نوار ابزار/پیش‌نمایش/گسترش ═══ */
  window.cmsSlugFb = function (inpId, spanId) { /* v34.29.5: بازخورد زندهٔ نامک — طول + اعتبار a-z/عدد/خط تیره + پیشنهاد تمیز */
    var e = document.getElementById(inpId), sp = document.getElementById(spanId);
    if (!e || !sp) return;
    var v = String(e.value || '').trim();
    if (!v) { sp.textContent = ''; return; }
    var lv = v.toLowerCase();
    var badN = (lv.match(/[^a-z0-9\-]/g) || []).length;
    var clean = lv.replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (badN === 0 && v === lv && v.length >= 3) { sp.textContent = v.length + ' کاراکتر ✓'; sp.style.color = '#059669'; }
    else {
      sp.textContent = v.length + ' کاراکتر' + (badN ? ' · ⛔ ' + badN + ' نویسهٔ نامعتبر (فقط a-z، عدد و خط تیره)' : '') + (clean && clean !== v ? ' · پیشنهاد: ' + clean : '');
      sp.style.color = badN ? '#b91c1c' : '#b45309';
    }
  };

  window.cmsPgCount = function () {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var set = function (id, txt, ok) { var el = document.getElementById(id); if (el) { el.textContent = txt; el.style.color = ok ? '#059669' : '#b45309'; } };
    var t = g('cmsPgTitle'), d = g('pgDesc'), b = g('pgBody');
    set('cmsPgTitleLen', t.length + '/۶۰', t.length >= 30 && t.length <= 65);
    set('pgDescLen', d.length + '/۱۶۰', d.length >= 70 && d.length <= 165);
    var words = b.trim() ? b.trim().split(/\s+/).length : 0;
    set('pgBodyLen', words + ' کلمه / ' + b.length + ' حرف' + (b.length >= 200 ? ' ✓' : ' (حداقل ۲۰۰)'), b.length >= 200);
    cmsSlugFb('pgSlug', 'pgSlugLen'); /* v34.29.5: بازخورد نامک همزمان با شمارنده‌ها */
  };
  window.cmsPgWrap = function (a, z) {
    var ta = document.getElementById('pgBody'); if (!ta) return;
    var v = ta.value, s0 = ta.selectionStart || 0, s1 = ta.selectionEnd || 0;
    var sel = v.slice(s0, s1) || 'متن';
    ta.value = v.slice(0, s0) + a + sel + z + v.slice(s1);
    ta.focus(); try { ta.setSelectionRange(s0 + a.length, s0 + a.length + sel.length); } catch (eS) {}
    cmsDraftBind(PAGE_FIELDS); cmsPgCount();
  };
  window.cmsPgList = function (kind) {
    var ta = document.getElementById('pgBody'); if (!ta) return;
    var v = ta.value, s0 = ta.selectionStart || 0, s1 = ta.selectionEnd || 0;
    var sel = v.slice(s0, s1);
    var items = sel.trim() ? sel.trim().split('\n') : ['مورد اول', 'مورد دوم', 'مورد سوم'];
    var html = '<' + kind + '>' + items.map(function (x) { return '<li>' + x.replace(/^[-•*]\s*/, '') + '</li>'; }).join('') + '</' + kind + '>';
    ta.value = v.slice(0, s0) + html + v.slice(s1);
    ta.focus(); cmsDraftBind(PAGE_FIELDS); cmsPgCount();
  };
  window.cmsPgTable = function () {
    var ta = document.getElementById('pgBody'); if (!ta) return;
    var html = '<table><thead><tr><th>مشخصه</th><th>مقدار</th><th>واحد</th></tr></thead><tbody>' +
      '<tr><td>—</td><td>—</td><td>—</td></tr><tr><td>—</td><td>—</td><td>—</td></tr></tbody></table>';
    cmsPgWrapAt(ta, html);
  };
  window.cmsPgLink = function () {
    var url = prompt('آدرس لینک (نسبی یا کامل):', '/knowledge-center/'); if (!url) return;
    var txt = prompt('متن لینک:', 'راهنمای فنی'); if (!txt) return;
    cmsPgWrapAt(document.getElementById('pgBody'), '<a href="' + url.replace(/"/g, '&quot;') + '">' + txt.replace(/</g, '&lt;') + '</a>');
  };
  window.cmsPgImg = function () {
    var src = prompt('مسیر تصویر (از ریشهٔ سایت):', 'assets/images/ptf-logo.png'); if (!src) return;
    var alt = prompt('متن جایگزین (alt):', 'تصویر محصول') || '';
    cmsPgWrapAt(document.getElementById('pgBody'), '<img src="' + src.replace(/"/g, '&quot;') + '" alt="' + alt.replace(/"/g, '&quot;') + '" style="max-width:100%">');
  };
  window.cmsPgWrapAt = function (ta, html) {
    if (!ta) return;
    var v = ta.value, s0 = ta.selectionStart || v.length;
    ta.value = v.slice(0, s0) + html + v.slice(s0);
    ta.focus(); try { ta.setSelectionRange(s0 + html.length, s0 + html.length); } catch (eS2) {}
    cmsDraftBind(PAGE_FIELDS); cmsPgCount();
  };
  /* ═══ v34.25.0 (IMG/PRODUCT-STUDIO): تصویر از بیرون + پیش‌نمایش محصول + ذخیرهٔ موقت صریح ═══ */
  window.cmsImgThumb = function (fieldId) {
    var e = document.getElementById(fieldId), t = document.getElementById(fieldId + 'Prev');
    if (!t) return;
    var v = ((e || {}).value || '').trim();
    if (v) { t.src = v.indexOf('/') === 0 ? v : '/' + v.replace(/^\.\//, ''); t.style.display = ''; t.onerror = function () { t.style.display = 'none'; }; }
    else t.style.display = 'none';
  };
  window.cmsImgPick = function (fieldId, bodyId, nameFromId) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp,image/gif';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 8 * 1048576) { alert('حجم تصویر بیشتر از ۸MB است'); return; }
      var host = document.getElementById(fieldId);
      var st = document.getElementById('prAiSt') || document.getElementById('pgAiSt');
      if (st) st.innerHTML = '⏳ در حال آپلود تصویر (' + Math.round(f.size / 1024) + 'KB)…';
      var nm = ((document.getElementById(nameFromId) || {}).value || '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-');
      api('image_upload', { file: f, name: nm || f.name.replace(/\.[^.]+$/, '') }, function (d) {
        if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'آپلود ناموفق') + '</span>'; return; }
        if (host) { host.value = d.path; host.dispatchEvent(new Event('input')); }
        cmsImgThumb(fieldId);
        if (st) st.innerHTML = '✅ تصویر آپلود شد: <span dir="ltr">' + escP(d.path) + '</span>' + (d.w ? ' (' + d.w + '×' + d.h + ')' : '');
        var ta = document.getElementById(bodyId);
        if (ta && confirm('تصویر در متن صفحه هم درج شود؟ (در محل نشانگر)')) {
          var alt = ((document.getElementById('prH1') || document.getElementById('pgH1') || {}).value || '').replace(/"/g, '');
          var cur = ta.value, pos = ta.selectionStart || cur.length;
          var tag = '<img src="' + d.url + '" alt="' + alt + '" style="max-width:100%">';
          ta.value = cur.slice(0, pos) + (pos > 0 && cur.slice(0, pos).match(/\n$/) === null && pos < cur.length ? '\n' : '') + tag + '\n' + cur.slice(pos);
          ta.dispatchEvent(new Event('input'));
        }
      });
    };
    inp.click();
  };
  window.cmsDraftBtn = function (fields, stId) {
    cmsDraftSave(fields);
    var st = document.getElementById(stId);
    if (st) st.innerHTML = '💾 ذخیرهٔ موقت انجام شد — تا پیش از انتشار محفوظ است؛ با باز شدن دوبارهٔ فرم بازیابی می‌شود.';
  };
  window.cmsPrPreview = function () { /* v34.26.0: پیش‌نمایش از سرور — دقیقاً همان رندرِ صفحهٔ نهایی (قالب/استایل/تصویر) */
    var g = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
    var title = g('prTitle'), slug = g('prSlug').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var body = g('prBody');
    if (!title || !slug || body.trim().length < 200) { alert('عنوان، نامک و متن (حداقل ۲۰۰ حرف) برای پیش‌نمایش لازم است'); return; }
    var specs = g('prSpecs').split('\n').map(function (ln) { var i = ln.indexOf('='); return i > -1 ? [ln.slice(0, i).trim(), ln.slice(i + 1).trim()] : null; }).filter(Boolean);
    var faq = g('prFaq').split('\n').map(function (ln) { var i = ln.indexOf('|'); return i > -1 ? { q: ln.slice(0, i).trim(), a: ln.slice(i + 1).trim() } : null; }).filter(function (x) { return x && x.q && x.a; });
    var payload = {
      title: title, slug: slug, h1: g('prH1') || title, desc: g('prDesc'), brand: g('prBrand'),
      catLb: 'محصولات', body: body, specs: JSON.stringify(specs), faq: JSON.stringify(faq),
      img: g('prImg'), price: g('prPrice').replace(/[^0-9.]/g, ''), priceCur: g('prCur'), inStock: g('prStock') ? '1' : ''
    };
    var st = document.getElementById('prAiSt');
    if (st) st.innerHTML = '⏳ ساخت پیش‌نمایش واقعی روی سرور…';
    api('product_preview', payload, function (d) {
      if (st) st.innerHTML = '';
      if (!d.ok || !d.html) { cmsPrPreviewLocal(); return; } /* جایگزین محلی */
      var html = String(d.html).replace('</head>', '<base href="/"></head>');
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px';
      ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
      ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:1080px;width:100%;max-height:92vh;overflow:auto;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
        '<div style="display:flex;gap:8px;align-items:center;margin:12px 14px;flex-wrap:wrap"><b style="font-size:13.5px">👁 پیش‌نمایش واقعی صفحه</b>' +
        '<span style="font-size:11px;color:#64748b;direction:ltr">' + escP(d.url || ('products/' + slug + '.html')) + ' — همان قالب و استایل سایت</span>' +
        '<span style="margin-right:auto;display:flex;gap:5px">' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px" onclick="var f=this.closest(\'div\').parentNode.querySelector(\'iframe\');f.style.width=\'390px\'">📱 موبایل</button>' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px" onclick="var f=this.closest(\'div\').parentNode.querySelector(\'iframe\');f.style.width=\'100%\'">🖥 دسکتاپ</button>' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px" onclick="this.closest(\'div[style*=fixed]\').parentNode.removeChild(this.closest(\'div[style*=fixed]\'))">بستن</button></span></div>' +
        '<iframe style="width:100%;height:74vh;border:1px solid #e2e8f0;border-radius:12px;background:#fff" srcdoc="' + escP(html).replace(/"/g, '&quot;') + '"></iframe>' +
        '</div>';
      document.body.appendChild(ov);
    });
  };

  window.cmsPrPreviewLocal = function () { /* جایگزین آفلاین — نسخهٔ اصلی اکنون از سرور می‌آید (v34.26.0) */
    var g = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
    var title = g('prTitle') || 'بدون عنوان', h1 = g('prH1') || title, desc = g('prDesc'), body = g('prBody') || '<p>—</p>';
    var slug = g('prSlug') || 'slug', img = g('prImg'), brand = g('prBrand'), price = g('prPrice'), cur = g('prCur') || 'IRR';
    var specs = g('prSpecs').split('\n').map(function (ln) { var i = ln.indexOf('='); return i > -1 ? [ln.slice(0, i).trim(), ln.slice(i + 1).trim()] : null; }).filter(Boolean);
    var faq = g('prFaq').split('\n').map(function (ln) { var i = ln.indexOf('|'); return i > -1 ? { q: ln.slice(0, i).trim(), a: ln.slice(i + 1).trim() } : null; }).filter(function (x) { return x && x.q && x.a; });
    var specH = specs.length ? '<h2 style="margin:22px 0 8px">مشخصات فنی</h2><table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0">' +
      specs.map(function (sp) { return '<tr><th style="text-align:right;padding:7px 11px;background:#f8fafc;border:1px solid #e2e8f0">' + escP(sp[0]) + '</th><td style="padding:7px 11px;border:1px solid #e2e8f0">' + escP(sp[1]) + '</td></tr>'; }).join('') + '</table>' : '';
    var faqH = faq.length ? '<h2 style="margin:22px 0 8px">سوالات متداول</h2>' + faq.map(function (fq) {
      return '<details style="border:1px solid #e2e8f0;border-radius:10px;padding:9px 13px;margin:7px 0"><summary style="font-weight:700;cursor:pointer">' + escP(fq.q) + '</summary><p style="color:#334155;margin:7px 0 0">' + escP(fq.a) + '</p></details>'; }).join('') : '';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:780px;width:100%;max-height:90vh;overflow:auto;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
      '<div style="display:flex;gap:8px;align-items:center;margin:16px 16px 0;flex-wrap:wrap"><b style="font-size:13.5px">👁 پیش‌نمایش صفحهٔ محصول</b><span style="font-size:11px;color:#64748b;direction:ltr">products/' + escP(slug) + '.html</span><button class="bt bt-o" style="padding:4px 12px;font-size:12px;margin-right:auto" onclick="this.closest(\'div[style*=fixed]\').parentNode.removeChild(this.closest(\'div[style*=fixed]\'))">بستن</button></div>' +
      '<div style="margin:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#475569">title: <b>' + escP(title.slice(0, 70)) + '</b> (' + title.length + ')<br>description: ' + escP(desc.slice(0, 170) || '—') + ' (' + desc.length + ')' + (img ? '<br>og:image: <span dir="ltr">' + escP(img) + '</span>' : '') + '</div>' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:26px 22px"><span style="background:rgba(239,75,26,.25);color:#ffb033;padding:5px 13px;border-radius:999px;font-size:12px;font-weight:800">محصولات</span>' +
      '<h1 style="font-size:21px;margin:12px 0 6px">' + escP(h1) + '</h1>' +
      '<p style="color:rgba(255,255,255,.72);font-size:13px;margin:0">' + (brand ? escP(brand) + ' · ' : '') + 'واحد تامین پیشرو تجهیز فرتاک' + '</p></div>' +
      '<div style="padding:16px">' +
      (img ? '<img src="' + escP(img.indexOf('/') === 0 ? img : '/' + img) + '" alt="' + escP(h1) + '" style="display:block;max-width:420px;max-height:260px;width:100%;object-fit:contain;border:1px solid #e2e8f0;border-radius:12px;margin:0 auto 14px;background:#f8fafc" onerror="this.style.display=\'none\'">' : '') +
      '<div style="font-size:13px;line-height:2.1;color:#1e293b">' + body + '</div>' + specH + faqH +
      (price ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 13px;margin-top:14px;font-size:13px">💰 قیمت اعلامی: <b>' + escP(price) + ' ' + escP(cur) + '</b>' + (g('prStock') ? ' · موجود' : ' · استعلامی') + '</div>' : '') +
      '<div style="background:#fff8f0;border:1px solid #f6c17c;border-radius:12px;padding:13px 16px;margin-top:16px;font-size:12.5px"><b>استعلام قیمت این محصول؟</b> قیمت و زمان تامین را همان روز دریافت کنید: <span style="color:#ef4b1a;font-weight:800">ثبت استعلام هوشمند ←</span></div>' +
      '</div></div>';
    document.body.appendChild(ov);
  };

  window.cmsPgPreview = function () {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var title = g('cmsPgTitle') || 'بدون عنوان', h1 = g('pgH1') || title, desc = g('pgDesc'), body = g('pgBody') || '<p>—</p>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;max-height:88vh;overflow:auto;padding:18px;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><b style="font-size:13.5px">👁 پیش‌نمایش صفحه</b><span style="font-size:11px;color:#64748b">' + escP(g('pgSlug') || 'slug') + '.html</span><button class="bt bt-o" style="padding:4px 12px;font-size:12px;margin-right:auto" onclick="this.closest(\'div[style*=fixed]\').parentNode.removeChild(this.closest(\'div[style*=fixed]\'))">بستن</button></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#475569;margin-bottom:10px">title: <b>' + escP(title.slice(0, 70)) + '</b> (' + title.length + ')<br>description: ' + escP(desc.slice(0, 170) || '—') + ' (' + desc.length + ')</div>' +
      '<h1 style="font-size:20px;margin:0 0 12px">' + escP(h1) + '</h1>' +
      '<div style="font-size:13px;line-height:2.1;color:#1e293b">' + body + '</div></div>';
    document.body.appendChild(ov);
  };
  window.cmsPgExpand = function () {
    var ta = document.getElementById('pgBody'); if (!ta) return;
    var body = ta.value || '';
    if (body.trim().length < 100) { alert('برای گسترش، ابتدا متن اولیه (حداقل ۱۰۰ حرف) را داشته باشید — با 🤖 تولید یا تایپ دستی.'); return; }
    var topic = (document.getElementById('pgTopic') || {}).value || ((document.getElementById('cmsPgTitle') || {}).value || '');
    if (!confirm('✍️ متن فعلی با نسخهٔ کامل‌تر (استانداردها/معیارهای انتخاب/چک‌لیست خرید) بازنویسی می‌شود. ادامه؟')) return;
    var st = document.getElementById('pgAiSt'); if (st) st.innerHTML = '⏳ هوش مصنوعی در حال گسترش متن…';
    cmsLLM('seo_expand', { text: body, topic: topic }, function (d) {
      if (st) st.innerHTML = '';
      if (!d.ok || !d.data) { alert('⚠️ ' + (d.error || 'خطا')); return; }
      var v = d.data;
      if (v.body) ta.value = v.body;
      if (v.title && !(document.getElementById('cmsPgTitle') || {}).value) document.getElementById('cmsPgTitle').value = v.title;
      if (v.desc && !(document.getElementById('pgDesc') || {}).value) document.getElementById('pgDesc').value = v.desc;
      if (v.h1 && !(document.getElementById('pgH1') || {}).value) document.getElementById('pgH1').value = v.h1;
      cmsDraftBind(PAGE_FIELDS); cmsPgCount();
      alert('✅ متن گسترش یافت' + (v.added && v.added.length ? ':\n• ' + v.added.join('\n• ') : '') + '\nبازبینی انسانی الزامی است.');
    });
  };

  /* ═══ v34.21.0 (EXT-AI): دستیار هوش مصنوعی خارجی — پرامپت آماده + تجزیهٔ خروجی ═══
     برای مطالب بلند (۱۲۰۰+ کلمه) که مدل سروری در سقف توکن می‌برد: پرامپت کامل با
     داده‌های همین فرم ساخته می‌شود؛ کاربر در ChatGPT/Claude/Gemini می‌برد و خروجی
     را با نشانگرهای استاندارد برمی‌گرداند؛ تجزیه‌گر آن را خودکار در فیلدها می‌ریزد. */
  function cmsExtRules() {
    return 'قواعد مهم:\n' +
      '۱. متن یگانه و تخصصی بنویس؛ نه مقدمهٔ کلی‌گوی، نه تکرار الگویی.\n' +
      '۲. فقط از داده‌های داده‌شده استفاده کن؛ هیچ قیمت، موجودی، بُعد، فشار کاری یا گواهی‌ای که داده نشده از خودت نساز.\n' +
      '۳. فارسی روان؛ اصطلاحات فنی/استاندارد/برند لاتین بمانند.\n' +
      '۴. بدنه فقط HTML با این تگ‌ها: h2 h3 h4 p ul ol li b strong i em table thead tbody tr th td br blockquote a — بدون style و بدون markdown.\n';
  }
  function cmsExtModal(title, prompt, applyFn) {
    var old = document.getElementById('ptExtModal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ptExtModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:16px;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:13.5px">🌐 ' + title + '</b>' +
      '<button class="bt bt-o" style="padding:5px 12px;font-size:12px;margin-right:auto" onclick="document.getElementById(\'ptExtModal\').remove()">بستن</button></div>' +
      '<div style="font-size:11.5px;color:#475569;margin-bottom:6px">① پرامپت را کپی کن ② در یکی از سرویس‌های زیر ببر ③ خروجی را در کادر پایین بچسبان و «اعمال» بزن:</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
      '<a href="https://chatgpt.com" target="_blank" rel="noopener" class="bt bt-o" style="padding:4px 12px;font-size:11.5px;text-decoration:none;color:#0e7490">ChatGPT ↗</a>' +
      '<a href="https://claude.ai" target="_blank" rel="noopener" class="bt bt-o" style="padding:4px 12px;font-size:11.5px;text-decoration:none;color:#7c3aed">Claude ↗</a>' +
      '<a href="https://gemini.google.com" target="_blank" rel="noopener" class="bt bt-o" style="padding:4px 12px;font-size:11.5px;text-decoration:none;color:#b45309">Gemini ↗</a></div>' +
      '<textarea id="ptExtPrompt" readonly rows="9" style="width:100%;font:12px/1.8 inherit;border:1px solid #cbd5e1;border-radius:10px;padding:10px;box-sizing:border-box;background:#f8fafc"></textarea>' +
      '<button class="bt" style="background:#0e7490;margin-top:6px" onclick="cmsExtCopy()">📋 کپی پرامپت</button>' +
      '<div style="font-size:11.5px;color:#475569;margin:10px 0 6px">⬇️ خروجی هوش مصنوعی را اینجا بچسبان (همان قالب نشانگردار):</div>' +
      '<textarea id="ptExtPaste" rows="7" style="width:100%;font:12px/1.8 inherit;border:1px solid #a5b4fc;border-radius:10px;padding:10px;box-sizing:border-box" placeholder="TITLE: ...&#10;H1: ...&#10;DESCRIPTION: ...&#10;SLUG: ...&#10;BODY:&#10;<h2>...</h2>"></textarea>' +
      '<div id="ptExtErr" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-size:12px;color:#b91c1c;line-height:2;margin-top:6px"></div>' + /* v34.29.4: خطای قابل‌دیدن در خود مودال */
      '<button class="bt" style="background:#059669;margin-top:6px" onclick="' + applyFn + '">✅ اعمال در فرم</button></div>';
    document.body.appendChild(ov);
    document.getElementById('ptExtPrompt').value = prompt;
  }
  window.cmsExtCopy = function () {
    var ta = document.getElementById('ptExtPrompt'); if (!ta) return;
    function ok() { var b = (document.activeElement || {}); if (b && b.textContent) { var t = b.textContent; b.textContent = '✅ کپی شد'; setTimeout(function () { b.textContent = t; }, 1600); } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(ok, function () { fallback(); }); return; }
    } catch (eC) {}
    function fallback() { ta.removeAttribute('readonly'); ta.select(); try { document.execCommand('copy'); ok(); } catch (eX) { alert('کپی خودکار نشد — دستی انتخاب و کپی کنید'); } ta.setAttribute('readonly', 'readonly'); }
    fallback();
  };
  window.cmsExtErr = function (msg) { /* v34.29.4: به‌جای alertِ تنها — پیام داخل مودال + فوکوس روی کادر چسبان */
    var el = document.getElementById('ptExtErr');
    if (!el) { alert(msg); return; }
    el.style.display = 'block';
    el.innerHTML = msg;
    var ta = document.getElementById('ptExtPaste');
    if (ta) { try { ta.focus(); ta.select(); } catch (eF) {} }
  };

  window.cmsExtParse = function (text) { /* تجزیهٔ نشانگرها — TITLE/H1/DESCRIPTION/SLUG تک‌خطی، BODY/SPECS/FAQ بلوکی
    v34.29.4 (EXT-PARSE-HARDEN): خروجی واقعی ChatGPT/Claude/Gemini اغلب نشانگرها را «بولد» می‌کند
    (**TITLE:** x)، داخل جعبهٔ کد (```…```) می‌پیچد، بولت/سرفصل می‌گذارد یا دونقطهٔ کامل (：) می‌نویسد —
    همهٔ این‌ها پیش از تطبیق نرمال می‌شوند؛ خطوط محتوای BODY همیشه به‌صورت دست‌نخورده بافر می‌شوند. */
    var out = { title: '', h1: '', desc: '', slug: '', body: '', specs: '', faq: '' };
    function clean(v) { return String(v || '').replace(/^\*+|\*+$/g, '').replace(/^`+|`+$/g, '').trim(); }
    function norm(t) { /* فقط برای «تشخیص نشانگر» — نه بافر محتوا */
      return String(t || '').trim()
        .replace(/^[#>\s`]+/, '')                /* سرفصل/نقل‌قول/بک‌تیک */
        .replace(/^[-*•‣·+]\s+/, '')             /* بولت با فاصله */
        .replace(/^\*{1,2}/, '')                 /* بولدِ باز */
        .replace(/\*{1,2}\s*[:：]\s*/, ':')     /* بولدِ بستهٔ قبل از دونقطه */
        .replace(/[:：]\s*\*{1,2}\s*/, ' : ')  /* بولدِ بعد از دونقطه */
        .replace(/：/g, ':');                     /* دونقطهٔ کامل CJK */
    }
    var lines = String(text || '').split(/\r?\n/);
    var mode = '';
    var buf = [];
    function flush() { if (mode === 'BODY') out.body = buf.join('\n').trim(); else if (mode === 'SPECS') out.specs = buf.join('\n').trim(); else if (mode === 'FAQ') out.faq = buf.join('\n').trim(); buf = []; }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^\s*(```|~~~)/.test(ln)) continue; /* جعبهٔ کد — وارد محتوا نمی‌شود */
      var lnN = norm(ln);
      var m1 = lnN.match(/^(TITLE|H1|DESCRIPTION|SLUG)\s*:\s*(.*)$/i);
      if (m1) { var k = m1[1].toUpperCase(); var v = clean(m1[2]); if (k === 'TITLE') out.title = v; else if (k === 'H1') out.h1 = v; else if (k === 'DESCRIPTION') out.desc = v; else out.slug = v; continue; }
      var m2 = lnN.match(/^(BODY|SPECS|FAQ)\s*:\s*(.*)$/i);
      if (m2) { flush(); mode = m2[1].toUpperCase(); var rest = clean(m2[2]); if (rest) buf.push(rest); continue; }
      if (mode) buf.push(ln);
    }
    flush();
    return out;
  };
  function cmsExtFill(fields, v, statusId, okMsg) { /* فقط فیلد خالی؛ در صورت پر بودن، یک‌بار تأیید بازنویسی */
    var pairs = fields; /* [{id,val}] */
    var hasFilled = pairs.some(function (p) { var e = document.getElementById(p.id); return e && p.val && e.value.trim(); });
    var overwrite = hasFilled ? confirm('بعضی فیلدها پر هستند — با خروجی جدید بازنویسی شوند؟\n(«انصراف» = فقط فیلدهای خالی پر شوند)') : true;
    var n = 0;
    pairs.forEach(function (p) {
      var e = document.getElementById(p.id); if (!e || !p.val) return;
      if (e.value.trim() && !overwrite) return;
      if (e.value.trim() === p.val) return;
      e.value = p.val; n++;
    });
    var st = document.getElementById(statusId);
    if (st) st.innerHTML = n ? ('✅ ' + n + ' فیلد از خروجی هوش مصنوعی خارجی پر شد — ' + okMsg) : 'تغییری لازم نبود (فیلدها از قبل پر بودند).';
    return n;
  }
  window.cmsPgExtPrompt = function () {
    var g = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
    var folderLb = 'خدمات';
    (PAGE_FOLDERS || []).forEach(function (f) { if (f.v === g('pgFolder')) folderLb = f.lb; });
    var topic = g('pgTopic') || g('cmsPgTitle') || '';
    if (!topic) { alert('ابتدا «موضوع برای AI» یا عنوان را بنویسید تا پرامپت همان موضوع ساخته شود.'); return; }
    var p = 'تو متخصص محتوای فنی شرکت «پیشرو تجهیز فرتاک» — تامین‌کننده تجهیزات صنعتی (شیرآلات، اتصالات، فلنج، ابزار دقیق، برق صنعتی) برای صنایع نفت، گاز و پتروشیمی ایران — هستی.\n\n' +
      'وظیفه: نوشتن متن کامل و یگانهٔ یک صفحهٔ وب.\n' +
      'بخش سایت: ' + folderLb + '\n' +
      'موضوع صفحه: ' + topic + '\n' +
      'مخاطب: ' + (g('pgAud') || 'کارشناس خرید و مهندس نگهداری و تعمیر') + '\n\n' +
      cmsExtRules() +
      '۵. حداقل ۱۲۰۰ کلمه؛ ساختار پیشنهادی: معرفی → مشخصات/جدول → معیارهای انتخاب → اشتباهات رایج خرید → چک‌لیست خریدار → جمع‌بندی.\n' +
      '۶. در صورت وجود معیار انتخاب، حداقل یک جدول یا لیست مقایسه‌ای بده.\n\n' +
      'قالب خروجی — دقیقاً با همین نشانگرها و بدون هیچ متن اضافی قبل/بعد:\n' +
      'TITLE: (عنوان سئو؛ ۳۰ تا ۶۵ کاراکتر)\n' +
      'H1: (تیتر اصلی)\n' +
      'DESCRIPTION: (توضیح متا؛ ۷۰ تا ۱۶۰ کاراکتر)\n' +
      'SLUG: (نامک انگلیسی؛ فقط حروف a-z و خط تیره)\n' +
      'BODY:\n(HTML کامل متن از اینجا به بعد)';
    cmsExtModal('پرامپت صفحهٔ جدید', p, 'cmsPgExtApply()');
  };
  window.cmsPgExtApply = function () {
    var v = cmsExtParse((document.getElementById('ptExtPaste') || {}).value || '');
    if (!v.body && !v.title) { cmsExtErr('⛔ نشانگرها پیدا نشد — خروجی باید خط‌هایی مثل <b dir="ltr">TITLE: …</b> و <b dir="ltr">BODY:</b> داشته باشد.<br>قالب بولد (<b dir="ltr">**TITLE:**</b>)، جعبهٔ کد، بولت و دونقطهٔ کامل هم پذیرفته می‌شود؛ کل خروجی را از اول تا آخر کپی و دوباره بچسبانید.'); return; }
    v.slug = (v.slug || '').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var n = cmsExtFill([
      { id: 'cmsPgTitle', val: v.title }, { id: 'pgH1', val: v.h1 }, { id: 'pgDesc', val: v.desc },
      { id: 'pgSlug', val: v.slug }, { id: 'pgBody', val: v.body }
    ], v, 'pgAiSt', '<b>بازبینی انسانی الزامی است.</b>');
    cmsDraftBind(PAGE_FIELDS); cmsPgCount();
    if (n) { var m = document.getElementById('ptExtModal'); if (m) m.remove(); }
  };
  window.cmsProdExtPrompt = function (cd) {
    var prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || [];
    var r = prds.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* v34.26.0: پاکسازی دادهٔ خام — ارجاع‌های داخلی خرید (RFQ/کد پیگیری/شماره سفارش) و متن‌های بسیار بلند پیش از ساخت پرامپت حذف/کوتاه می‌شوند */
    function cmsProdClean(v, max) {
      return String(v || '').replace(/(?:RFQ|ION|PTRN|PTF)[-A-Z0-9\/]{3,}/ig, '').replace(/\s{2,}/g, ' ').trim().slice(0, max || 200);
    }
    var det = '';
    [['نام', r.nm], ['نام انگلیسی', r.en], ['برند', r.br], ['مدل', r.md], ['دسته', r.ca], ['استاندارد', cmsProdClean(r.st, 160)], ['واحد', r.un], ['توضیحات', cmsProdClean(r.ds, 400)]].forEach(function (x) { if (x[1]) det += x[0] + ': ' + x[1] + '\n'; });
    var specsPre = [['نام', r.nm || ''], ['نام انگلیسی', r.en || ''], ['برند', r.br || ''], ['مدل', r.md || ''], ['استاندارد', r.st || ''], ['واحد', r.un || '']].filter(function (x) { return x[1]; }).map(function (x) { return x[0] + ' = ' + x[1]; }).join('\n');
    var p = 'تو متخصص محتوای فنی شرکت «پیشرو تجهیز فرتاک» — تامین‌کننده تجهیزات صنعتی برای صنایع نفت، گاز و پتروشیمی ایران — هستی.\n\n' +
      'وظیفه: نوشتن متن صفحهٔ محصول زیر.\n' +
      'داده‌های کالا (تنها منبع مجاز):\n' + det + '\n' +
      cmsExtRules() +
      '۵. این یک «راهنمای فنی محصول» است نه معرفی یک قلم کالای داخلی: معرفی و کاربرد → جدول مشخصات فنی (پارامترهای مهندسی همان خانوادهٔ کالا) → معیارهای انتخاب → نکات نصب و نگهداری → اشتباهات رایج خرید → چک‌لیست مدارک قابل درخواست. حداقل ۸۰۰ کلمه.\n' +
      '۶. کاربردها عمومی و صنعت‌محور باشند؛ ادعای خاصِ همین کالا ممنوع مگر در داده‌ها باشد.\n' +
      '۷. شماره‌های RFQ، کد پیگیری، شماره استعلام/سفارش و هر ارجاع داخلی سیستم خرید که در داده‌ها دیده شد متعلق به محتوا نیست — کاملاً نادیده بگیر و هرگز در متن نیاور.\n\n' +
      'قالب خروجی — دقیقاً با همین نشانگرها و بدون هیچ متن اضافی قبل/بعد:\n' +
      'TITLE: (عنوان سئو؛ ۳۰ تا ۶۵ کاراکتر)\n' +
      'H1: (تیتر اصلی)\n' +
      'DESCRIPTION: (توضیح متا؛ ۷۰ تا ۱۶۰ کاراکتر)\n' +
      'SLUG: (نامک انگلیسی؛ فقط a-z و خط تیره)\n' +
      'SPECS:\n(مشخصات؛ هر خط دقیقاً به شکل «کلید = مقدار» — از داده‌های کالا)\n' +
      'FAQ:\n(۳ تا ۵ سؤال عملی خرید؛ هر خط دقیقاً به شکل «سؤال | پاسخ»)\n' +
      'BODY:\n(HTML کامل متن از اینجا تا پایان)';
    cmsExtModal('پرامپت صفحهٔ محصول — ' + (r.nm || r.cd), p, "cmsProdExtApply('" + ptfOnClickArg(cd) + "')");
  };
  window.cmsProdExtApply = function (cd) {
    var v = cmsExtParse((document.getElementById('ptExtPaste') || {}).value || '');
    if (!v.body && !v.title) { cmsExtErr('⛔ نشانگرها پیدا نشد — خروجی باید خط‌هایی مثل <b dir="ltr">TITLE: …</b> و <b dir="ltr">BODY:</b> داشته باشد.<br>قالب بولد (<b dir="ltr">**TITLE:**</b>)، جعبهٔ کد، بولت و دونقطهٔ کامل هم پذیرفته می‌شود؛ کل خروجی را از اول تا آخر کپی و دوباره بچسبانید.'); return; }
    v.slug = (v.slug || '').toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var n = cmsExtFill([
      { id: 'prTitle', val: v.title }, { id: 'prH1', val: v.h1 }, { id: 'prDesc', val: v.desc },
      { id: 'prSlug', val: v.slug }, { id: 'prBody', val: v.body }, { id: 'prSpecs', val: v.specs }, { id: 'prFaq', val: v.faq }
    ], v, 'prAiSt', '<b>بازبینی انسانی الزامی است.</b>');
    cmsDraftBind(PROD_FIELDS); cmsPrCount(); /* v34.29.5 */
    if (n) { var m = document.getElementById('ptExtModal'); if (m) m.remove(); }
  };

  window.cmsPageAi = function () {
    var topic = (document.getElementById('pgTopic').value || '').trim();
    if (!topic) { alert('موضوع را بنویسید'); return; }
    var st = document.getElementById('pgAiSt');
    if (st) st.innerHTML = '⏳ هوش مصنوعی در حال تولید محتوا… (متن بلند — چند لحظه)';
    cmsLLM('seo_article', { topic: topic, aud: (document.getElementById('pgAud').value || '').trim() }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'خطا') + '</span>'; return; }
      var v = d.data;
      var g = function (id) { return document.getElementById(id); };
      if (v.title && !g('cmsPgTitle').value) g('cmsPgTitle').value = v.title;
      if (v.slug && !g('pgSlug').value) g('pgSlug').value = v.slug;
      if (v.h1 && !g('pgH1').value) g('pgH1').value = v.h1;
      if (v.desc && !g('pgDesc').value) g('pgDesc').value = v.desc;
      if (v.body && !g('pgBody').value.trim()) g('pgBody').value = v.body;
      if (st) st.innerHTML = '✅ پیش‌نویس تولید شد — <b>بازبینی انسانی الزامی است.</b>';
    });
  };

  window.cmsPagePublish = function () {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var folder = g('pgFolder'), title = g('cmsPgTitle').trim(), slug = g('pgSlug').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var body = g('pgBody');
    if (!folder || !title || !slug || body.trim().length < 200) { alert('بخش، عنوان، نامک و متن (حداقل ۲۰۰ حرف) الزامی است'); return; }
    var rv = document.getElementById('pgReviewed');
    if (!rv || !rv.checked) { alert('⛔ پیش از انتشار باید تیکِ بازبینیِ انسانی زده شود.'); return; }
    var payload = { folder: folder, title: title, slug: slug, h1: g('pgH1').trim() || title, desc: g('pgDesc').trim(), body: body, img: g('pgImg').trim() };
    if (!confirm('🚀 صفحه در ' + folder + '/' + slug + '.html منتشر شود؟')) return;
    api('page_create', payload, function (d) {
      if (d.ok) {
        cmsDraftClear(PAGE_FIELDS);
        audit('CMS', 'انتشار صفحهٔ عمومی: ' + title, folder + '/' + slug);
        alert('✅ صفحه منتشر شد:\npishtaj.ir/' + d.url + (window.cmsSitemapNote ? window.cmsSitemapNote(d) : ''));
        if (typeof renderCms === 'function') renderCms(document.getElementById('cmsWrap'));
        cmsSitemapAfterPublish();
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک هست — بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('page_create', payload, function (d2) {
            if (d2.ok) { cmsDraftClear(PAGE_FIELDS); alert('✅ بازنویسی شد' + (window.cmsSitemapNote ? window.cmsSitemapNote(d2) : '')); cmsSitemapAfterPublish(); }
            else alert('⚠️ ' + (d2.error || ''));
          });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ═══ v34.14.0 (S4/SCHED): زمان‌بندی انتشار همان فرم صفحه — رندر اکنون، انتشار در موعد ═══ */
  window.cmsPageSchedule = function () {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var folder = g('pgFolder'), title = g('cmsPgTitle').trim(), slug = g('pgSlug').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var body = g('pgBody');
    if (!folder || !title || !slug || body.trim().length < 200) { alert('بخش، عنوان، نامک و متن (حداقل ۲۰۰ حرف) الزامی است'); return; }
    var rv = document.getElementById('pgReviewed');
    if (!rv || !rv.checked) { alert('⛔ پیش از زمان‌بندی هم باید تیکِ بازبینیِ انسانی زده شود.'); return; }
    var w = g('pgWhen');
    var ts = w ? Math.floor(new Date(w).getTime() / 1000) : 0;
    if (!ts || isNaN(ts) || ts * 1000 < Date.now() + 300000) { alert('زمان انتشار معتبر وارد کنید (حداقل ۵ دقیقهٔ دیگر)'); return; }
    var payload = { folder: folder, title: title, slug: slug, h1: g('pgH1').trim() || title, desc: g('pgDesc').trim(), body: body, img: g('pgImg').trim(), when_ts: ts };
    if (!confirm('🕘 انتشار «' + title + '» در ' + new Date(ts * 1000).toLocaleString('fa-IR') + ' زمان‌بندی شود؟')) return;
    api('sched_add', payload, function (d) {
      if (d.ok) {
        cmsDraftClear(PAGE_FIELDS);
        audit('CMS', 'زمان‌بندی انتشار صفحه: ' + title, folder + '/' + slug);
        alert('✅ در صف زمان‌بندی ثبت شد' + (d.pending_approval ? '\n(نقش شما منتظر تأیید مدیر ارشد است — تب 🛠 کیفیت)' : ''));
        window.cmsTab('q');
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک هست — در موعد انتشار بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('sched_add', payload, function (d2) { if (d2.ok) { cmsDraftClear(PAGE_FIELDS); alert('✅ زمان‌بندی (بازنویسی) ثبت شد'); window.cmsTab('q'); } else alert('⚠️ ' + (d2.error || '')); });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ═══ v34.14.0 (S4): تب «🛠 کیفیت» — زمان‌بندی / تاریخچه و بازگشت / هزینهٔ AI / PageSpeed ═══ */
  function cmsSenior() { return ['admin', 'chairman', 'ceo'].indexOf(curRole()) > -1; }

  function renderCmsQuality(el) {
    el.innerHTML =
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:12px;color:#475569;line-height:1.9;margin-bottom:10px"><b>کیفیت و مقیاس (S4):</b> انتشار زمان‌بندی‌شده با تأیید دومرحله‌ای · تاریخچه/بازگشت روی بک‌آپ‌های موجود · شمارندهٔ هزینهٔ هوش مصنوعی · PageSpeed صفحات پول‌ساز.</div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px;margin-bottom:10px"><b style="font-size:13px">🕘 انتشار زمان‌بندی‌شده</b><div id="qSched" style="margin-top:8px;font-size:12px;color:#64748b">در حال خواندن صف…</div></div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px;margin-bottom:10px"><b style="font-size:13px">🕰 تاریخچه و بازگشت (۳ نسخهٔ آخر هر فایل)</b><div id="qBk" style="margin-top:8px;font-size:12px;color:#64748b">در حال خواندن بک‌آپ‌ها…</div></div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px;margin-bottom:10px"><b style="font-size:13px">💸 هزینهٔ هوش مصنوعی</b><div id="qCost" style="margin-top:8px;font-size:12px;color:#64748b">در حال محاسبه…</div></div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px;margin-bottom:10px"><b style="font-size:13px">🌐 hreflang دوطرفه (fa ↔ en)</b> <button class="bt bt-o" style="padding:4px 12px;font-size:11.5px;color:#0e7490" onclick="cmsHlSync()">🌐 همگام‌سازی</button><div id="qHl" style="margin-top:8px;font-size:12px;color:#64748b">جفت‌های فارسی/انگلیسی هم‌مسیر را می‌یابد و سه‌گانهٔ hreflang را در هر دو طرف (در صورت نبود/تکرار) یکسان می‌کند. stubهای ریدایرکت دست نمی‌خورند.</div></div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px;margin-bottom:10px"><b style="font-size:13px">🖼 متن جایگزین تصاویر (alt) با بینایی AI</b> <button class="bt bt-o" style="padding:4px 12px;font-size:11.5px;color:#7c3aed" onclick="cmsAltScan()">🔍 اسکن تصاویر</button><div id="qAlt" style="margin-top:8px;font-size:12px;color:#64748b">اسکن تصاویرِ بدون alt → تولید متن فارسی با مدل بینایی → بازبینی → اعمال گروهی.</div></div>' +
      '<div class="cms-card" style="background:var(--crd);padding:14px;border:1px solid var(--brd);border-radius:12px"><b style="font-size:13px">⚡ PageSpeed (موبایل)</b><div id="qPsi" style="margin-top:8px;font-size:12px;color:#64748b">در حال خواندن تنظیمات…</div></div>';
    cmsQSched(); cmsQBk(); cmsQCost(); cmsQPsi();
  }

  /* ── ۱) صف زمان‌بندی ── */
  function cmsQFaTs(ts) { try { return new Date(ts * 1000).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return String(ts); } }
  function cmsQSched() {
    api('sched_list', {}, function (d) {
      var el = document.getElementById('qSched'); if (!el) return;
      if (!d || !d.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      var items = d.items || [];
      if (!items.length) { el.innerHTML = '<span style="color:#94a3b8">صف خالی است — از فرم «📄 صفحهٔ جدید» با دکمهٔ «🕘 زمان‌بندی انتشار» اضافه کنید.</span>'; return; }
      var sen = cmsSenior();
      var h = '<table class="cms-tbl"><thead><tr><th>عنوان</th><th>مسیر</th><th>موعد</th><th>وضعیت</th><th>سازنده</th><th></th></tr></thead><tbody>';
      items.forEach(function (it) {
        var st = it.done ? (it.err ? '<span style="color:#b91c1c">خطا: ' + escP(it.err) + '</span>' : '<span style="color:#059669">✅ منتشر شد ' + (it.done_at ? '(' + cmsQFaTs(it.done_at) + ')' : '') + '</span>')
          : (it.st === 'approved' ? '<span style="color:#2563eb">⏳ تأییدشده — در انتظار موعد</span>' : '<span style="color:#b45309">🟡 منتظر تأیید مدیر ارشد</span>');
        var act = '';
        if (!it.done) {
          if (it.st !== 'approved' && sen) act += '<button class="bt" style="padding:3px 9px;font-size:11px;background:#059669" onclick="cmsSchedAct(\'approve\',\'' + ptfOnClickArg(it.id) + '\')">✅ تأیید</button> ';
          if (sen) act += '<button class="bt" style="padding:3px 9px;font-size:11px" onclick="cmsSchedAct(\'now\',\'' + ptfOnClickArg(it.id) + '\')">🚀 هم‌اکنون</button> ';
          act += '<button class="bt bt-o" style="padding:3px 9px;font-size:11px;color:#b91c1c" onclick="cmsSchedAct(\'cancel\',\'' + ptfOnClickArg(it.id) + '\')">✖ لغو</button>';
        }
        h += '<tr><td><b>' + escP((it.title || '').slice(0, 50)) + '</b></td><td dir="ltr" style="font-size:11px">' + escP(it.rel || '') + '</td><td>' + cmsQFaTs(it.at || 0) + '</td><td>' + st + '</td><td>' + escP(it.author || '') + (it.approved_by && !it.done ? '<br><small style="color:#94a3b8">تأیید: ' + escP(it.approved_by) + '</small>' : '') + '</td><td style="white-space:nowrap">' + act + '</td></tr>';
      });
      h += '</tbody></table><div style="font-size:11px;color:#94a3b8;margin-top:6px">انتشارِ موعدرسیده با اولین فراخوانی CMS انجام می‌شود (موتور lazy — بدون cron هاست).</div>';
      el.innerHTML = h;
    });
  }
  window.cmsSchedAct = function (op, id) {
    if (op === 'cancel' && !confirm('این آیتم زمان‌بندی لغو شود؟')) return;
    api('sched_' + (op === 'approve' ? 'approve' : op === 'now' ? 'publish_now' : 'cancel'), { id: id }, function (d) {
      if (d && d.ok) { audit('CMS', 'زمان‌بندی: ' + op, id); cmsQSched(); }
      else alert('⚠️ ' + ((d && d.error) || 'خطا'));
    });
  };

  /* ── ۲) تاریخچه/بازگشت ── */
  var _bkFiles = null;
  function cmsQBk() {
    api('backup_list', {}, function (d) {
      var el = document.getElementById('qBk'); if (!el) return;
      if (!d || !d.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      _bkFiles = d.files || [];
      if (!_bkFiles.length) { el.innerHTML = '<span style="color:#94a3b8">هنوز بک‌آپی ثبت نشده — با اولین بازنویسی/انتشار فایل، نسخه‌های قبلی اینجا ظاهر می‌شوند.</span>'; return; }
      var opts = _bkFiles.map(function (f, i) { return '<option value="' + i + '">' + escP(f.rel) + ' (' + f.vers.length + ')</option>'; }).join('');
      el.innerHTML =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<select id="bkFile" onchange="cmsBkVers()">' + opts + '</select>' +
        '<select id="bkVer"></select>' +
        '<button class="bt bt-o" style="padding:5px 12px;font-size:11.5px;color:#0e7490" onclick="cmsBkCompare()">🔍 مقایسه</button>' +
        '<button class="bt bt-o" style="padding:5px 12px;font-size:11.5px;color:#b45309" onclick="cmsBkRestore()">↩️ بازگردانی این نسخه</button>' +
        '</div><div id="bkDiff" style="margin-top:10px"></div>';
      cmsBkVers();
    });
  }
  window.cmsBkVers = function () {
    var fi = document.getElementById('bkFile'), vs = document.getElementById('bkVer'); if (!fi || !vs || !_bkFiles) return;
    var f = _bkFiles[fi.value]; if (!f) return;
    vs.innerHTML = f.vers.map(function (v, i) { return '<option value="' + v.stamp + '">' + v.stamp.slice(0, 4) + '/' + v.stamp.slice(4, 6) + '/' + v.stamp.slice(6, 8) + ' ' + v.stamp.slice(9, 11) + ':' + v.stamp.slice(11, 13) + ':' + v.stamp.slice(13) + '</option>'; }).join('');
  };
  function cmsBkLineDiff(a, b) { /* diff خطی سبک: پیشوند/پسوند مشترک + بلوک میانی (اگر بزرگ بود فقط شمارش) */
    var A = a.split('\n'), B = b.split('\n'), out = [], i = 0, j = 0;
    while (i < A.length && j < B.length && A[i] === B[j]) { i++; j++; }
    var i2 = A.length - 1, j2 = B.length - 1;
    while (i2 >= i && j2 >= j && A[i2] === B[j2]) { i2--; j2--; }
    var del = A.slice(i, i2 + 1), add = B.slice(j, j2 + 1);
    if (del.length + add.length > 400) return { n: del.length + add.length, lines: [] };
    return { n: del.length + add.length, lines: del.slice(0, 60).map(function (l) { return ['-', l]; }).concat(add.slice(0, 60).map(function (l) { return ['+', l]; })) };
  }
  window.cmsBkCompare = function () {
    var fi = document.getElementById('bkFile'), vs = document.getElementById('bkVer'); if (!fi || !vs || !_bkFiles) return;
    var f = _bkFiles[fi.value]; if (!f) return;
    var rel = f.rel, stamp = vs.value;
    var box = document.getElementById('bkDiff'); if (box) box.innerHTML = '⏳ در حال دریافت نسخه‌ها…';
    api('backup_fetch', { rel: rel, stamp: stamp }, function (d) {
      if (!box) return;
      if (!d || !d.ok) { box.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      var pick = function (t, re) { var m = (t || '').match(re); return m ? m[1].trim().slice(0, 120) : '—'; };
      var meta = [['عنوان (title)', /<title>([\s\S]*?)<\/title>/i], ['توضیح (description)', /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i], ['H1', /<h1[^>]*>([\s\S]*?)<\/h1>/i]];
      var h = '<div style="font-size:11.5px;margin-bottom:6px">حجم: بک‌آپ <b>' + (d.bak_size / 1024).toFixed(1) + 'KB</b> · نسخهٔ زنده <b>' + (d.live_size / 1024).toFixed(1) + 'KB</b></div>' +
        '<table class="cms-tbl"><thead><tr><th>فیلد</th><th>بک‌آپ (' + escP(stamp) + ')</th><th>نسخهٔ زنده</th></tr></thead><tbody>';
      meta.forEach(function (m) {
        var b = pick(d.bak, m[1]), l = pick(d.live, m[1]);
        h += '<tr><td>' + m[0] + '</td><td style="' + (b !== l ? 'background:#fef2f2' : '') + '">' + escP(b) + '</td><td style="' + (b !== l ? 'background:#ecfdf5' : '') + '">' + escP(l) + '</td></tr>';
      });
      h += '</tbody></table>';
      var df = cmsBkLineDiff(d.bak || '', d.live || '');
      h += '<div style="font-size:11.5px;margin:8px 0 4px">' + (df.n ? ('تغییرات خطی: <b>' + df.n + '</b> خط' + (df.lines.length ? '' : ' (بلوک بزرگ — فقط شمارش)')) : '✅ بدنهٔ دو نسخه یکسان است') + '</div>';
      if (df.lines.length) {
        h += '<div dir="ltr" style="max-height:260px;overflow:auto;background:#0f172a;border-radius:8px;padding:8px;font:11px/1.7 monospace;color:#cbd5e1;text-align:left">';
        df.lines.forEach(function (L) {
          h += '<div style="color:' + (L[0] === '-' ? '#f87171' : '#4ade80') + ';white-space:pre-wrap">' + (L[0] === '-' ? '− ' : '+ ') + escP(L[1].trim().slice(0, 200)) + '</div>';
        });
        h += '</div>';
      }
      box.innerHTML = h;
    });
  };
  window.cmsBkRestore = function () {
    var fi = document.getElementById('bkFile'), vs = document.getElementById('bkVer'); if (!fi || !vs || !_bkFiles) return;
    var f = _bkFiles[fi.value]; if (!f) return;
    var rel = f.rel, stamp = vs.value;
    if (!confirm('↩️ نسخهٔ ' + stamp + ' روی «' + rel + '» بازگردانی شود؟\n(از نسخهٔ فعلی هم بک‌آپ گرفته می‌شود — بازگشت قابلِ تکرار است)')) return;
    api('backup_restore', { rel: rel, stamp: stamp }, function (d) {
      if (d && d.ok) { audit('CMS', 'بازگردانی بک‌آپ: ' + rel, stamp); alert('✅ بازگردانی شد — کش سئو هم نو شد.'); }
      else alert('⚠️ ' + ((d && d.error) || 'خطا'));
    });
  };

  /* ── ۳) هزینهٔ AI ── */
  function cmsQCost() {
    var el = document.getElementById('qCost'); if (!el) return;
    if (!cmsSenior()) { el.innerHTML = '<span style="color:#94a3b8">مشاهدهٔ هزینه فقط برای نقش‌های ارشد (مدیر سیستم/رییس هیات مدیره/مدیرعامل) مجاز است.</span>'; return; }
    cmsLLM('usage_stats', {}, function (d) {
      if (!el) return;
      if (!d || !d.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      var t = d.tot || {};
      var h = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 12px"><small style="color:#64748b">درخواست‌ها (۳۰ روز)</small><br><b>' + (t.n || 0) + '</b></div>' +
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 12px"><small style="color:#64748b">توکن ورودی</small><br><b>' + ((t.pt || 0)).toLocaleString('fa-IR') + '</b></div>' +
        '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 12px"><small style="color:#64748b">توکن خروجی</small><br><b>' + ((t.ct || 0)).toLocaleString('fa-IR') + '</b></div>' +
        '<div style="background:#faf5ff;border:1px solid #a855f7;border-radius:10px;padding:8px 12px"><small style="color:#6b21a8">هزینهٔ تخمینی</small><br><b style="color:#7c3aed">$' + (t.cost || 0).toFixed(3) + '</b></div>' +
        '</div>';
      var acts = Object.keys(d.acts || {}).slice(0, 6);
      if (acts.length) {
        h += '<div style="font-size:11.5px;color:#64748b;margin-bottom:3px">پرکاربردترین اکشن‌ها:</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
        acts.forEach(function (a) { h += '<span style="background:#f1f5f9;border-radius:999px;padding:2px 10px;font-size:11px">' + escP(a) + ' × ' + (d.acts[a].n || 0) + '</span>'; });
        h += '</div>';
      }
      var bd = (d.byDay || []).slice(-14).reverse();
      if (bd.length) {
        h += '<details><summary style="font-size:11.5px;color:#0e7490;cursor:pointer">روزبه‌روز (۱۴ روز آخر)</summary><table class="cms-tbl"><thead><tr><th>روز</th><th>درخواست</th><th>ورودی</th><th>خروجی</th><th>هزینه</th></tr></thead><tbody>';
        bd.forEach(function (r) { h += '<tr><td dir="ltr">' + escP(r.d) + '</td><td>' + (r.n || 0) + '</td><td>' + (r.pt || 0) + '</td><td>' + (r.ct || 0) + '</td><td>$' + (r.cost || 0).toFixed(3) + '</td></tr>'; });
        h += '</tbody></table></details>';
      }
      h += '<div style="font-size:10.5px;color:#94a3b8;margin-top:6px">💡 ' + escP(d.note || 'هزینه تخمینی است') + ' — پاسخ‌های کش‌شده هزینه ندارند و شمرده نمی‌شوند.</div>';
      el.innerHTML = h;
    });
  }

  /* ── ۴) PageSpeed ── */
  function cmsPsiScoreColor(s) { return s >= 90 ? '#059669' : s >= 50 ? '#b45309' : '#b91c1c'; }
  function cmsQPsi() {
    api('psi_config_get', {}, function (dc) {
      api('psi_history', {}, function (dh) {
        var el = document.getElementById('qPsi'); if (!el) return;
        if (!dc || !dc.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((dc && dc.error) || 'خطا') + '</span>'; return; }
        var urls = dc.urls || [];
        var hist = (dh && dh.ok && dh.history) || {};
        var h = '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
          '<button class="bt" style="background:#0e7490" onclick="cmsPsiRunAll()">⚡ اندازه‌گیری همه</button>' +
          '<span id="psiProg" style="font-size:11.5px;color:#64748b"></span></div>' +
          '<table class="cms-tbl"><thead><tr><th>مسیر</th><th>امتیاز</th><th>LCP</th><th>CLS</th><th>TBT</th><th>سئو</th><th>روند</th><th></th></tr></thead><tbody>';
        urls.forEach(function (u) {
          var runs = hist[u] || [];
          var last = runs.length ? runs[runs.length - 1] : null;
          var trend = runs.slice(-10).map(function (r) { return '<span style="color:' + cmsPsiScoreColor(r.score) + '">' + r.score + '</span>'; }).join(' → ') || '—';
          h += '<tr><td dir="ltr" style="font-size:11.5px">' + escP(u) + '</td>' +
            '<td>' + (last ? '<b style="color:' + cmsPsiScoreColor(last.score) + ';font-size:15px">' + last.score + '</b>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
            '<td>' + (last ? escP(last.lcp) + 's' : '—') + '</td><td>' + (last ? escP(last.cls) : '—') + '</td><td>' + (last ? escP(last.tbt) + 'ms' : '—') + '</td>' +
            '<td>' + (last ? '<b style="color:' + cmsPsiScoreColor(last.seo) + '">' + last.seo + '</b>' : '—') + '</td>' +
            '<td style="font-size:11px">' + trend + '</td>' +
            '<td><button class="bt bt-o" style="padding:3px 9px;font-size:11px;color:#0e7490" onclick="cmsPsiRunOne(\'' + ptfOnClickArg(u) + '\')">⚡</button></td></tr>';
        });
        h += '</tbody></table>' +
          '<details style="margin-top:8px"><summary style="font-size:11.5px;color:#0e7490;cursor:pointer">⚙️ ویرایش فهرست مسیرها (حداکثر ۱۰ صفحهٔ پول‌ساز)</summary>' +
          '<textarea id="psiUrls" rows="5" dir="ltr" style="width:100%;margin-top:6px;font:12px monospace">' + escP(urls.join('\n')) + '</textarea>' +
          '<button class="bt bt-o" style="padding:4px 12px;font-size:11.5px;margin-top:5px" onclick="cmsPsiSave()">💾 ذخیرهٔ فهرست</button></details>' +
          '<div style="font-size:10.5px;color:#94a3b8;margin-top:6px">هر مسیر حداکثر یک‌بار در ۶ ساعت سنجیده می‌شود (سهمیهٔ رایگان PSI). کلید اختیاری در gsc-config.php (psi_key).</div>';
        el.innerHTML = h;
      });
    });
  }
  window.cmsPsiSave = function () {
    var ta = document.getElementById('psiUrls'); if (!ta) return;
    var urls = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    api('psi_config_set', { urls: JSON.stringify(urls) }, function (d) {
      if (d && d.ok) { alert('✅ ذخیره شد (' + d.urls.length + ' مسیر)'); cmsQPsi(); }
      else alert('⚠️ ' + ((d && d.error) || 'خطا — مسیرها باید موجود باشند'));
    });
  };
  window.cmsPsiRunOne = function (u, cb) {
    api('psi_run', { url: u }, function (d) {
      if (d && d.ok) { if (typeof cb === 'function') cb(true); else cmsQPsi(); }
      else if (d && d.error === 'throttled') { alert('⏳ این مسیر در ۶ ساعت گذشته سنجیده شده — بعداً تلاش کنید.'); if (typeof cb === 'function') cb(true); }
      else { alert('⚠️ ' + ((d && d.error) || 'خطا')); if (typeof cb === 'function') cb(false); }
    });
  };
  window.cmsPsiRunAll = function () {
    var el = document.getElementById('qPsi'); if (!el) return;
    var urls = [];
    /* مسیرها را از سرور می‌خوانیم — نه از DOM */
    api('psi_config_get', {}, function (dc) {
      if (!dc || !dc.ok) { alert('⚠️ ' + ((dc && dc.error) || 'خطا')); return; }
      urls = dc.urls || [];
      if (!urls.length) { alert('فهرست مسیرها خالی است'); return; }
      var i = 0;
      var prog = document.getElementById('psiProg');
      var step = function () {
        if (i >= urls.length) { if (prog) prog.textContent = '✅ پایان'; cmsQPsi(); return; }
        if (prog) prog.textContent = '⏳ ' + (i + 1) + ' از ' + urls.length + ' — ' + urls[i] + ' (هر سنجش تا ~۳۰ ثانیه)';
        cmsPsiRunOne(urls[i], function () { i++; setTimeout(step, 400); });
      };
      step();
    });
  };

  /* ═══ v34.15.0 (S5/HREFLANG + S5/CANONICAL + S5/ALT) ═══ */
  window.cmsHlSync = function () {
    var el = document.getElementById('qHl'); if (!el) return;
    el.innerHTML = '⏳ در حال همگام‌سازی…';
    api('hreflang_sync', {}, function (d) {
      if (!el) return;
      if (!d || !d.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      el.innerHTML = '<div style="color:#065f46">✅ <b>' + d.pairs + '</b> جفت fa/en بررسی شد — <b>' + d.changed + '</b> فایل به‌روزرسانی (بک‌آپ گرفته شد)' +
        (d.en_only ? ' · <span style="color:#b45309">' + d.en_only + ' صفحهٔ انگلیسیِ بدون همتای فارسی</span>' : '') +
        (d.files && d.files.length ? '<div dir="ltr" style="font:10.5px monospace;color:#64748b;margin-top:4px">' + d.files.map(escP).join('<br>') + '</div>' : '') + '</div>' +
        (d.changed ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px">کش اسکن سئو نو شد — در تب «🔍 سئوی صفحات» نتیجه را ببینید.</div>' : '');
    });
  };

  window.cmsCanonBulk = function () {
    if (!confirm('🔧 همهٔ صفحات با «canonical ناهماهنگ» یا «بدون canonical» به آدرس خودِشان برگردند؟\n(از هر صفحه بک‌آپ گرفته می‌شود؛ stubهای ریدایرکت با canonical عمدی دست نمی‌خورند)')) return;
    api('canonical_bulk', {}, function (d) {
      if (!d || !d.ok) { alert('⚠️ ' + ((d && d.error) || 'خطا')); return; }
      audit('CMS', 'canonical گروهی: ' + d.fixed + ' فایل', 'skipped:' + d.skipped);
      alert('✅ ' + d.fixed + ' صفحه خود-کانونیکال شد' + (d.skipped ? ' · ' + d.skipped + ' رد شد' : '') + (d.files && d.files.length ? '\n' + d.files.join('\n') : ''));
      if (typeof renderCms === 'function') renderCms(document.getElementById('cmsWrap')); /* اسکن نو */
    });
  };

  var _altRows = [];
  window.cmsAltScan = function () {
    var el = document.getElementById('qAlt'); if (!el) return;
    el.innerHTML = '⏳ در حال اسکن تصاویر…';
    api('alt_scan', {}, function (d) {
      if (!el) return;
      if (!d || !d.ok) { el.innerHTML = '<span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا') + '</span>'; return; }
      _altRows = (d.rows || []).slice(0, 30);
      if (!_altRows.length) { el.innerHTML = '<div style="color:#065f46">✅ هیچ تصویرِ بدونِ alt در صفحات عمومی پیدا نشد.</div>'; return; }
      var h = '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">' + (d.total || _altRows.length) + ' تصویر بدون alt (نمایش ۳۰ مورد) — تولید گروهی فقط برای موارد دارای فایل تصویر روی سرور ممکن است:</div>' +
        '<div style="max-height:300px;overflow:auto"><table class="cms-tbl"><thead><tr><th></th><th>تصویر</th><th>صفحه</th><th>alt پیشنهادی (قابل ویرایش)</th></tr></thead><tbody>';
      _altRows.forEach(function (r, i) {
        h += '<tr><td><input type="checkbox" id="altCk' + i + '" checked' + (r.disk ? '' : ' disabled') + '></td>' +
          '<td dir="ltr" style="font-size:10.5px;max-width:180px;overflow:hidden;text-overflow:ellipsis">' + escP(r.src) + (r.disk ? '' : '<br><small style="color:#b45309">فایل نیست/سنگین</small>') + '</td>' +
          '<td dir="ltr" style="font-size:10.5px">' + escP(r.page) + '</td>' +
          '<td><input type="text" id="altV' + i + '" style="width:100%;font-size:11.5px;padding:4px 8px;border:1px solid var(--brd);border-radius:7px" placeholder="' + (r.disk ? 'پس از 🤖 تولید می‌شود' : '—') + '"></td></tr>';
      });
      h += '</tbody></table></div>' +
        '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px">' +
        '<button class="bt" style="background:#7c3aed" onclick="cmsAltAi()">🤖 تولید alt با بینایی AI</button>' +
        '<span id="altSt" style="font-size:11.5px;color:#6b21a8"></span></div>' +
        '<label style="display:flex;gap:7px;align-items:center;font-size:12px;color:#374151;margin:8px 0"><input type="checkbox" id="altRv"> ⛔ بازبینی انسانی انجام شد (الزامی برای اعمال)</label>' +
        '<button class="bt" style="background:#059669" onclick="cmsAltApply()">✅ اعمال گروهی</button>';
      el.innerHTML = h;
    });
  };
  window.cmsAltAi = function () {
    var pick = [];
    _altRows.forEach(function (r, i) {
      var ck = document.getElementById('altCk' + i);
      if (ck && ck.checked && r.disk) pick.push({ i: i, src: r.src, disk: r.disk });
    });
    if (!pick.length) { alert('تصویر قابل‌پردازشی انتخاب نشده (فقط موارد دارای فایل روی سرور)'); return; }
    var batches = [];
    for (var i = 0; i < pick.length; i += 8) batches.push(pick.slice(i, i + 8)); /* حداکثر ۸ تصویر در هر فراخوانی */
    var st = document.getElementById('altSt');
    var bi = 0;
    var run = function () {
      if (bi >= batches.length) { if (st) st.innerHTML = '✅ پایان — متن‌ها را بازبینی/ویرایش کنید'; return; }
      if (st) st.innerHTML = '⏳ دستهٔ ' + (bi + 1) + ' از ' + batches.length + '…';
      cmsLLM('seo_alt', { imgs: batches[bi] }, function (d) {
        if (d && d.ok && d.data && d.data.alts) {
          (d.data.alts || []).forEach(function (a) {
            batches[bi].forEach(function (p) {
              if (p.src === a.src) { var inp = document.getElementById('altV' + p.i); if (inp && !inp.value) inp.value = a.alt || ''; }
            });
          });
        } else if (st) { st.innerHTML += ' <span style="color:#b91c1c">⚠️ ' + escP((d && d.error) || 'خطا در یک دسته') + '</span>'; }
        bi++; setTimeout(run, 200);
      });
    };
    run();
  };
  window.cmsAltApply = function () {
    var rv = document.getElementById('altRv');
    if (!rv || !rv.checked) { alert('⛔ پیش از اعمال باید تیکِ بازبینیِ انسانی زده شود.'); return; }
    var items = [];
    _altRows.forEach(function (r, i) {
      var inp = document.getElementById('altV' + i), ck = document.getElementById('altCk' + i);
      var v = inp ? inp.value.trim() : '';
      if (v.length >= 4 && (!ck || ck.checked)) items.push({ page: r.page, src: r.src, alt: v });
    });
    if (!items.length) { alert('متن alt معتبری وارد نشده است'); return; }
    if (!confirm('✅ ' + items.length + ' متن alt روی صفحات اعمال شود؟ (از هر صفحه بک‌آپ گرفته می‌شود)')) return;
    api('alt_apply', { items: JSON.stringify(items) }, function (d) {
      if (!d || !d.ok) { alert('⚠️ ' + ((d && d.error) || 'خطا')); return; }
      audit('CMS', 'alt گروهی: ' + d.applied + ' تصویر', d.pages + ' صفحه');
      alert('✅ ' + d.applied + ' تصویر alt گرفت (' + d.pages + ' صفحه) — کش اسکن نو شد.');
      cmsAltScan();
    });
  };

  /* ═══ v34.11.0 (S2/PRODUCT): تب محصولات — مولد صفحهٔ محصول از دیتای CRM ═══ */
  var _prodSite = null; /* نقشهٔ cd → {slug,title,mtime} از سرور */
  var PROD_FIELDS = ['prTitle', 'prSlug', 'prH1', 'prDesc', 'prBrand', 'prImg', 'prBody', 'prSpecs', 'prFaq'];
  window.PROD_FIELDS = PROD_FIELDS; /* v34.25.0: برای onclick ذخیرهٔ موقت */

  /* ═══ v34.29.0 (PROD-SEARCH + SMART-IMG): جستجوی زنده در فهرست محصولات CMS و عکس پیش‌فرض هوشمند ═══ */
  var CMS_PROD_IMG_RULES = [
    ['gate', 'gate-valve-api600-realistic.jpg'], ['ball', 'ball-valve-api6d-trunnion-realistic.jpg'],
    ['butterfly', 'butterfly-valve-triple-offset-realistic.jpg'], ['check', 'check-valve-dual-plate-realistic.jpg'],
    ['control', 'control-valve-pneumatic-positioner-realistic.jpg'], ['globe', 'globe-valve-api623-realistic.jpg'],
    ['elbow', 'butt-weld-fittings-realistic.jpg'], ['tee', 'butt-weld-fittings-realistic.jpg'],
    ['fitting', 'butt-weld-fittings-realistic.jpg'], ['reducer', 'butt-weld-fittings-realistic.jpg'],
    ['forged', 'forged-fittings-realistic.jpg'], ['flange', 'welding-neck-flanges-realistic.jpg'],
    ['gasket', 'industrial-gaskets-realistic.jpg'], ['bolt', 'stud-bolts-nuts-realistic.jpg'], ['stud', 'stud-bolts-nuts-realistic.jpg'],
    ['a333', 'a333-low-temperature-pipe-realistic.jpg'], ['a335', 'alloy-steel-pipe-a335-realistic.jpg'],
    ['api 5l', 'api-5l-line-pipe-realistic.jpg'], ['api5l', 'api-5l-line-pipe-realistic.jpg'],
    ['a106', 'seamless-pipe-a106-realistic.jpg'], ['seamless', 'seamless-pipe-a106-realistic.jpg'],
    ['stainless', 'stainless-steel-pipe-long-bundle-realistic.jpg'], ['a312', 'stainless-steel-pipe-long-bundle-realistic.jpg'],
    ['pipe', 'seamless-pipe-a106-realistic.jpg'], ['tube', 'seamless-pipe-a106-realistic.jpg'],
    ['strainer', 'industrial-strainer-filter-realistic.jpg'], ['filter', 'industrial-strainer-filter-realistic.jpg'],
    ['pump', 'api-610-centrifugal-pump-realistic.jpg'], ['compressor', 'screw-compressor-realistic.jpg'],
    ['flowmeter', 'magnetic-flowmeter-flanged-realistic.jpg'], ['flow meter', 'magnetic-flowmeter-flanged-realistic.jpg'],
    ['transmitter', 'pressure-transmitter-industrial-realistic.jpg'], ['gauge', 'pressure-gauge-safety-realistic.jpg'],
    ['thermowell', 'thermowell-flanged-realistic.jpg'], ['level', 'radar-level-transmitter-realistic.jpg'],
    ['boiler', 'fire-tube-boiler-realistic.jpg'], ['heat exchanger', 'shell-tube-heat-exchanger-realistic.jpg'],
    ['exchanger', 'shell-tube-heat-exchanger-realistic.jpg'], ['transformer', 'power-transformer-realistic.jpg'],
    ['switchgear', 'lv-mv-switchgear-realistic.jpg'], ['cable', 'industrial-cables-realistic.jpg'],
    ['valve', 'gate-valve-api600-realistic.jpg']
  ];
  function cmsProdImgGuess(r) {
    var hay = '';
    try { hay = ((r && r.nm) || '') + ' ' + ((r && r.en) || '') + ' ' + ((r && r.br) || '') + ' ' + ((r && r.md) || '') + ' ' + ((r && r.cd) || ''); } catch (eI) {}
    hay = hay.toLowerCase();
    if (!hay.trim()) return '';
    for (var i = 0; i < CMS_PROD_IMG_RULES.length; i++) if (hay.indexOf(CMS_PROD_IMG_RULES[i][0]) > -1) return 'assets/images/products/generated/' + CMS_PROD_IMG_RULES[i][1];
    return '';
  }
  window.cmsProdImgGuess = cmsProdImgGuess;

  var _prodQ = '';
  var _prodAll = null;
  window.cmsProdSearch = function (q) {
    _prodQ = String(q || '').trim().toLowerCase();
    _prodDraw();
  };
  function _prodDraw() {
    var box = document.getElementById('prodTbl'); if (!box) return;
    var prds = _prodAll || [];
    var q = _prodQ;
    var list = prds;
    if (q) list = prds.filter(function (r) {
      return (((r.nm || '') + ' ' + (r.en || '') + ' ' + (r.br || '') + ' ' + (r.md || '') + ' ' + (r.cd || '')).toLowerCase().indexOf(q) > -1);
    });
    var cap = q ? 400 : 200; /* بدون جستجو ۲۰۰ نخست (کارایی)؛ با جستجو تا ۴۰۰ نتیجه */
    var cnt = document.getElementById('prodCnt');
    if (cnt) cnt.textContent = q ? (list.length + ' نتیجه برای «' + q + '»' + (list.length > cap ? ' — ' + cap + ' مورد نخست نمایش داده می‌شود' : '')) : (prds.length + ' کالا در CRM');
    var h = '<table class="cms-tbl"><thead><tr><th>کالا</th><th>برند/مدل</th><th>کد</th><th>صفحهٔ سایت</th><th></th></tr></thead><tbody>';
    list.slice(0, cap).forEach(function (r) {
      var site = (_prodSite || {})[r.cd] || null;
      h += '<tr><td><b>' + escP((r.nm || '').slice(0, 60)) + '</b>' + (r.en ? '<br><small dir="ltr" style="color:#64748b">' + escP(r.en.slice(0, 50)) + '</small>' : '') + '</td>' +
        '<td>' + escP(r.br || '—') + (r.md ? '<br><small dir="ltr">' + escP(r.md) + '</small>' : '') + '</td>' +
        '<td dir="ltr" style="font-size:11px">' + escP(r.cd || '') + '</td>' +
        '<td>' + (site ? '<a href="/products/' + escP(site.slug) + '.html" target="_blank" rel="noopener" style="color:#059669;text-decoration:none">products/' + escP(site.slug) + '.html ↗</a><br><small style="color:#94a3b8">' + escP(site.mtime || '') + '</small>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
        '<td><button class="bt" style="padding:4px 10px;font-size:11.5px;' + (site ? '' : 'background:#059669') + '" onclick="cmsProdForm(\'' + ptfOnClickArg(r.cd) + '\')">' + (site ? '🔁 بازنویسی' : '🌍 ساخت صفحه') + '</button></td></tr>';
    });
    h += '</tbody></table>';
    if (!list.length) h = '<div style="padding:14px;text-align:center;color:#94a3b8">کالایی مطابق جستجو یافت نشد.</div>';
    box.innerHTML = h;
  }

  function renderCmsProducts(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال دریافت وضعیت صفحات محصول…</div>';
    api('product_list', {}, function (d) {
      _prodSite = {};
      (d && d.ok && d.products || []).forEach(function (w) { if (w.cd) _prodSite[w.cd] = w; });
      var prds = [];
      try { prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || []; } catch (eP) {}
      if (!prds.length) { el.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:14px;font-size:12.5px;color:#475569">هنوز کالایی در CRM ثبت نشده است — از پنل «کالاها» کالا ثبت کنید تا صفحهٔ سایتش را بسازید.</div>'; return; }
      _prodAll = prds;
      var h = '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">کل کالاها: <b>' + prds.length + '</b> · دارای صفحهٔ سایت: <b style="color:#059669">' + Object.keys(_prodSite).length + '</b> — برای هر کالا یک صفحهٔ سئوشده با اسکیمای Product/FAQ ساخته می‌شود (متن یگانه با AI + بازبینی انسانی).</div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
        '<input type="text" id="prodQ" placeholder="🔍 جستجو در نام / نام انگلیسی / برند / مدل / کد کالا…" oninput="cmsProdSearch(this.value)" style="flex:1;min-width:220px;padding:8px 12px;border:1px solid var(--brd);border-radius:10px;font-family:inherit;font-size:12.5px" value="' + escP(_prodQ) + '">' +
        '<span id="prodCnt" style="font-size:11.5px;color:#64748b"></span></div>' +
        '<div id="prodTbl" style="max-height:520px;overflow:auto"></div>';
      el.innerHTML = h;
      _prodDraw();
      var inp = document.getElementById('prodQ');
      if (inp && _prodQ) { try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (eF) {} }
    });
  }

  window.cmsPrCount = function () { /* v34.29.5: شمارنده‌های فرم محصول — قبلاً spanها بود ولی هیچ‌وقت به‌روز نمی‌شدند */
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var set = function (id, txt, ok) { var el = document.getElementById(id); if (el) { el.textContent = txt; el.style.color = ok ? '#059669' : '#b45309'; } };
    var t = g('prTitle'), d = g('prDesc'), b = g('prBody');
    set('prTitleLen', t.length + '/۶۰', t.length >= 30 && t.length <= 65);
    set('prDescLen', d.length + '/۱۶۰', d.length >= 70 && d.length <= 165);
    var words = b.trim() ? b.trim().split(/\s+/).length : 0;
    set('prBodyLen', words + ' کلمه / ' + b.length + ' حرف' + (b.length >= 200 ? ' ✓' : ' — کفِ متن ۲۰۰ حرف'), b.length >= 200);
    cmsSlugFb('prSlug', 'prSlugLen');
  };

  window.cmsProdForm = function (cd) {
    var prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || [];
    var r = prds.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    /* v34.26.0: سطر استانداردِ طولانی (سطرِ کامل استعلام/RFQ در فیلد استاندارد CRM) به‌عنوان مشخصه خام دمپ نمی‌شود */
    var specsPre = [['نام', r.nm || ''], ['نام انگلیسی', r.en || ''], ['برند', r.br || ''], ['مدل', r.md || ''], ['استاندارد', r.st || ''], ['واحد', r.un || '']]
      .filter(function (x) { return x[1] && !(x[0] === 'استاندارد' && String(x[1]).length > 120); })
      .map(function (x) { return x[0] + ' = ' + (String(x[1]).length > 160 ? String(x[1]).slice(0, 160) : x[1]); }).join('\n');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:780px;max-height:94vh;overflow:auto">' +
      '<h3>🛒 صفحهٔ محصول — ' + escP((r.nm || '').slice(0, 50)) + ' <small dir="ltr" style="color:#94a3b8">' + escP(r.cd) + '</small></h3>' +
      '<div id="prAiSt" style="font-size:11.5px;color:#6b21a8;margin-bottom:8px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>عنوان سئو (title) <span id="prTitleLen" style="font-size:11px"></span></label><input type="text" id="prTitle" oninput="cmsPrCount()"></div>' +
      '<div class="fld"><label>نامک (slug) <small style="color:#94a3b8">a-z و خط تیره</small> <span id="prSlugLen" style="font-size:11px"></span></label><input type="text" id="prSlug" dir="ltr" placeholder="ball-valve-astm-a105" oninput="cmsSlugFb(\'prSlug\',\'prSlugLen\')"></div>' +
      '<div class="fld"><label>H1</label><input type="text" id="prH1"></div>' +
      '<div class="fld"><label>برند (برای اسکیما)</label><input type="text" id="prBrand" value="' + escP(r.br || '') + '"></div>' +
      '</div>' +
      '<div class="fld"><label>توضیح (description) <span id="prDescLen" style="font-size:11px"></span></label><textarea id="prDesc" rows="2" oninput="cmsPrCount()"></textarea></div>' +
      '<div class="fld"><label>متن صفحه (HTML سبک: h2/h3/p/ul/li — کف ۲۰۰ حرف، فقط همین فیلد) <span id="prBodyLen" style="font-size:11px"></span></label><textarea id="prBody" rows="9" placeholder="<h2>معرفی ...</h2><p>...</p>" oninput="cmsPrCount()"></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>مشخصات (هر خط: کلید = مقدار)</label><textarea id="prSpecs" rows="6">' + escP(specsPre) + '</textarea></div>' +
      '<div class="fld"><label>سوالات متداول (هر خط: سؤال | پاسخ)</label><textarea id="prFaq" rows="6"></textarea></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
      '<div class="fld"><label>قیمت (اختیاری — برای اسکیمای Offer)</label><input type="text" id="prPrice" dir="ltr" value="' + (r.pr || '') + '"></div>' +
      '<div class="fld"><label>ارز</label><select id="prCur"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option></select></div>' +
      '<div class="fld"><label>موجود</label><select id="prStock"><option value="1">بله</option><option value="">خیر/استعلامی</option></select></div>' +
      '</div>' +
      '<div class="fld"><label>تصویر (مسیر از ریشهٔ سایت) <button type="button" class="bt bt-o" style="padding:2px 10px;font-size:11px;color:#0e7490" onclick="cmsImgPick(\'prImg\',\'prBody\',\'prSlug\')">📂 انتخاب عکس از سیستم (آپلود)</button></label><input type="text" id="prImg" dir="ltr" value="' + escP(cmsProdImgGuess(r) || 'assets/images/ptf-logo.png') + '" oninput="cmsImgThumb(\'prImg\')"><img id="prImgPrev" alt="" style="display:none;max-width:130px;max-height:80px;object-fit:contain;border:1px solid var(--brd);border-radius:8px;margin-top:6px;background:#f8fafc"></div>' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;color:#374151;margin:8px 0"><input type="checkbox" id="prReviewed"> ⛔ بازبینی انسانی انجام شد — متن و اعداد فنی را خوانده‌ام (الزامی)</label>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" style="color:#6b21a8" onclick="cmsProdAi(\'' + ptfOnClickArg(cd) + '\')">🤖 تولید با هوش مصنوعی</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="cmsProdExtPrompt(\'' + ptfOnClickArg(cd) + '\')">🌐 خارجی</button>' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))hideModal()">انصراف</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="cmsPrPreview()">👁 پیش‌نمایش صفحه</button>' +
      '<button class="bt bt-o" style="color:#059669" onclick="cmsDraftBtn(PROD_FIELDS,\'prAiSt\')">💾 ذخیرهٔ موقت</button>' +
      '<button class="bt" onclick="cmsProdPublish(\'' + ptfOnClickArg(cd) + '\')">🚀 انتشار صفحهٔ محصول</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">صفحه در products/&lt;slug&gt;.html با اسکیمای Product/Offer/Breadcrumb/FAQ ساخته می‌شود؛ به نقشهٔ سایت (sitemap-products.xml) اضافه و در سرچ کنسول ثبت می‌گردد.</small>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    cmsDraftRestore(PROD_FIELDS, 'prAiSt'); cmsDraftBind(PROD_FIELDS); /* v34.11.0: پیش‌نویس ماندگار */
    cmsPrCount(); /* v34.29.5: شمارنده‌ها بلافاصله پس از بازیابی پیش‌نویس */
    cmsImgThumb('prImg'); /* v34.25.0: بندانگشتی تصویر پس از بازیابی پیش‌نویس */
  };

  window.cmsProdAi = function (cd) {
    var prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || [];
    var r = prds.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var st = document.getElementById('prAiSt');
    if (st) st.innerHTML = '⏳ هوش مصنوعی در حال تولید محتوای محصول…';
    cmsLLM('seo_product', { product: r }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
      var v = d.data;
      function set(id, val) { var e = document.getElementById(id); if (e && !e.value) e.value = val || ''; }
      set('prTitle', v.title); set('prSlug', v.slug); set('prH1', v.h1); set('prDesc', v.desc);
      var body = '';
      if (v.intro) body += '<h2>معرفی ' + escP((r.nm || '').slice(0, 40)) + '</h2>\n<p>' + v.intro + '</p>\n';
      if (v.features && v.features.length) body += '<h2>ویژگی‌ها</h2>\n<ul>\n' + v.features.map(function (x) { return '<li>' + x + '</li>'; }).join('\n') + '\n</ul>\n';
      if (v.applications && v.applications.length) body += '<h2>کاربردها</h2>\n<ul>\n' + v.applications.map(function (x) { return '<li>' + x + '</li>'; }).join('\n') + '\n</ul>';
      var be = document.getElementById('prBody'); if (be && !be.value.trim()) be.value = body;
      var fe = document.getElementById('prFaq');
      if (fe && !fe.value.trim() && v.faq) fe.value = v.faq.map(function (q) { return q.q + ' | ' + q.a; }).join('\n');
      if (st) st.innerHTML = '✅ پیش‌نویس تولید شد — <b>بازبینی انسانی الزامی است پیش از انتشار.</b>';
    });
  };

  window.cmsProdPublish = function (cd) {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var title = g('prTitle').trim(), slug = g('prSlug').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var body = g('prBody');
    if (!title || !slug || body.trim().length < 200) { alert('عنوان، نامک و متن (حداقل ۲۰۰ حرف) الزامی است'); return; }
    var rv = document.getElementById('prReviewed');
    if (!rv || !rv.checked) { alert('⛔ پیش از انتشار باید تیکِ بازبینیِ انسانی زده شود.\nمتن و اعداد فنی را بخوانید.'); return; }
    var specs = g('prSpecs').split('\n').map(function (ln) { var i = ln.indexOf('='); return i > -1 ? [ln.slice(0, i).trim(), ln.slice(i + 1).trim()] : null; }).filter(Boolean);
    var faq = g('prFaq').split('\n').map(function (ln) { var i = ln.indexOf('|'); return i > -1 ? { q: ln.slice(0, i).trim(), a: ln.slice(i + 1).trim() } : null; }).filter(function (x) { return x && x.q && x.a; });
    var payload = {
      title: title, slug: slug, h1: g('prH1').trim() || title, desc: g('prDesc').trim(), brand: g('prBrand').trim(),
      catLb: 'محصولات', body: body, specs: JSON.stringify(specs), faq: JSON.stringify(faq),
      img: g('prImg').trim(), price: g('prPrice').replace(/[^0-9.]/g, ''), priceCur: g('prCur'), inStock: g('prStock') ? '1' : '',
      productCd: cd
    };
    if (!confirm('🚀 صفحهٔ محصول در products/' + slug + '.html منتشر شود؟')) return;
    api('product_create', payload, function (d) {
      if (d.ok) {
        cmsDraftClear(PROD_FIELDS);
        audit('CMS', 'انتشار صفحهٔ محصول: ' + title, slug);
        hideModal(); renderCms();
        /* نشانهٔ انتشار روی رکورد CRM (رفت/برگشت) */
        try {
          var items = getData('ptf_crm_products');
          var it = items.filter(function (x) { return x.cd === cd; })[0];
          if (it) { it.siteSlug = slug; it.siteAt = new Date().toISOString(); if (window.ptfEntitySaveCollection) ptfEntitySaveCollection('ptf_crm_products', items, { reason: 'cms-product-publish' }); else setData('ptf_crm_products', items); }
        } catch (eM) {}
        alert('✅ صفحه منتشر شد:\npishtaj.ir/' + d.url + (window.cmsSitemapNote ? window.cmsSitemapNote(d) : ''));
        cmsSitemapAfterPublish(); /* v34.11.0: ثبت خودکار نقشه */
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک هست — بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('product_create', payload, function (d2) {
            if (d2.ok) { cmsDraftClear(PROD_FIELDS); hideModal(); renderCms(); alert('✅ بازنویسی شد' + (window.cmsSitemapNote ? window.cmsSitemapNote(d2) : '')); cmsSitemapAfterPublish(); }
            else alert('⚠️ ' + (d2.error || ''));
          });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ═══ v34.11.0 (S2/REDIRECT): ادیتور ریدایرکت در تب سئو ═══ */
  window.cmsRedirectBox = function () {
    return '<div id="seoRedirects" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;margin-bottom:10px"></div>';
  };
  window.cmsRedirectLoad = function () {
    var box = document.getElementById('seoRedirects'); if (!box) return;
    box.innerHTML = '<div style="font-size:12px;color:#64748b">⏳ …</div>';
    api('redirect_list', {}, function (d) {
      if (!d.ok) { box.innerHTML = '<div style="font-size:12px;color:#b91c1c">⚠️ ' + escP(d.error || '') + '</div>'; return; }
      var rs = d.redirects || [];
      var h = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:12.5px;color:#166534">🔗 ریدایرکت‌های فعال (' + rs.length + ')</b></div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
        '<input type="text" id="rdFrom" dir="ltr" placeholder="مسیر مبدأ مثلاً knowledge-center/old.html" style="flex:1;min-width:200px;padding:5px 9px;border:1px solid var(--brd);border-radius:8px;font-size:11.5px">' +
        '<input type="text" id="rdTo" dir="ltr" placeholder="مقصد مثلاً /knowledge-center/new.html" style="flex:1;min-width:200px;padding:5px 9px;border:1px solid var(--brd);border-radius:8px;font-size:11.5px">' +
        '<button class="bt" style="padding:5px 11px;font-size:11.5px" onclick="cmsRedirectAdd()">➕ ریدایرکت 301-سبک</button></div>';
      if (rs.length) {
        h += '<div style="max-height:160px;overflow:auto;margin-top:8px"><table class="cms-tbl" style="font-size:11.5px"><thead><tr><th>مبدأ</th><th>مقصد</th><th>تاریخ</th><th></th></tr></thead><tbody>';
        rs.forEach(function (r) {
          h += '<tr><td dir="ltr" style="font-size:10.5px">' + escP(r.from) + '</td><td dir="ltr" style="font-size:10.5px;color:#059669">' + escP(r.to) + '</td><td style="font-size:10.5px">' + escP(String(r.ts || '').slice(0, 10)) + '</td>' +
            '<td><button class="bt bt-o" style="padding:2px 8px;font-size:11px;color:#dc2626" onclick="cmsRedirectRemove(\'' + ptfOnClickArg(r.from) + '\')">↩️ بازگردانی</button></td></tr>';
        });
        h += '</tbody></table></div>';
      }
      h += '<small style="color:#94a3b8;font-size:10.5px;display:block;margin-top:6px">الگو: صفحهٔ مبدأ به stub امن (refresh+canonical به مقصد+noindex) تبدیل و از نقشه حذف می‌شود؛ نسخهٔ اصلی در بک‌آپ — «بازگردانی» آن را برمی‌گرداند.</small>';
      box.innerHTML = h;
    });
  };
  window.cmsRedirectAdd = function () {
    var from = (document.getElementById('rdFrom').value || '').trim(), to = (document.getElementById('rdTo').value || '').trim();
    if (!from || !to) { alert('مبدأ و مقصد را وارد کنید'); return; }
    if (!confirm('صفحهٔ ' + from + ' به ' + to + ' ریدایرکت شود؟ (از نقشهٔ سایت حذف و نسخه‌اش بک‌آپ می‌شود)')) return;
    api('page_redirect', { from: from, to: to }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || '')); return; }
      if (typeof ptfToast === 'function') ptfToast('ریدایرکت فعال شد', 'ok');
      cmsRedirectLoad();
    });
  };
  window.cmsRedirectRemove = function (from) {
    if (!confirm('ریدایرکتِ ' + from + ' برداشته شود و صفحهٔ اصلی از بک‌آپ بازگردد؟')) return;
    api('redirect_remove', { from: from }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || '')); return; }
      ptfToast ? ptfToast('صفحه بازگردانی شد', 'ok') : 0;
      cmsRedirectLoad();
    });
  };

  /* ═══ v34.10.0 (S1/AI-QUEUE): صف متای AI — تولید گروهی + diff + تأیید انسانی + اعمال ═══ */
  var _q = { items: [], counts: {}, running: false, stop: false };

  function seoQueueBodyHtml() {
    var c = _q.counts || {};
    return '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">' +
      '<b style="font-size:12.5px;color:#6b21a8">🤖 صف متای هوش مصنوعی</b>' +
      '<span style="font-size:11.5px;color:#64748b">در انتظار: <b>' + (c.pending || 0) + '</b> · پیشنهاد آماده: <b style="color:#059669">' + (c.proposed || 0) + '</b> · انجام‌شده: <b>' + (c.done || 0) + '</b>' + (c.error ? ' · خطا: <b style="color:#dc2626">' + c.error + '</b>' : '') + '</span></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="bt" style="padding:5px 11px;font-size:12px" onclick="cmsSeoQueueAdd()">➕ افزودن نتایج فیلتر فعلی (تا ۶۰)</button>' +
      '<button class="bt bt-o" style="padding:5px 11px;font-size:12px;color:#6b21a8" onclick="cmsSeoQueueRun()">▶️ تولید متا با AI</button>' +
      '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="cmsSeoQueueRefresh()">⟳</button>' +
      ((c.done || c.error) ? '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="cmsSeoQueueClear(\'done\')">🧹 پاک‌کردن انجام‌شده‌ها</button>' : '') +
      '</div>';
  }
  function seoQueueBox() {
    return '<div id="seoQueue" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
      '<div id="seoQBody">' + seoQueueBodyHtml() + '</div>' +
      '<div id="seoQRun" style="font-size:11.5px;color:#6b21a8;margin-top:6px"></div>' +
      '<div id="seoQList" style="margin-top:6px"></div></div>';
  }

  function seoQueueRenderList() {
    var el = document.getElementById('seoQList'); if (!el) return;
    var items = (_q.items || []).filter(function (it) { return it.st === 'proposed' || it.st === 'error'; }).slice(0, 60);
    if (!items.length) { el.innerHTML = ''; return; }
    var h = '<div style="font-size:11.5px;color:#475569;margin:4px 0">پیشنهادهای آمادهٔ اعمال — بازبینی کن، تیک تأیید بزن:</div>' +
      '<div style="max-height:300px;overflow:auto;border:1px solid #e9d5ff;border-radius:10px;background:#fff">' +
      '<table class="cms-tbl" style="font-size:11.5px"><thead><tr><th></th><th>صفحه</th><th>عنوان (قدیم → جدید)</th><th>توضیح جدید</th></tr></thead><tbody>';
    items.forEach(function (it) {
      var tOld = (it.title_cur || '').slice(0, 40), tNew = it.title_new || '';
      var changed = it.title_new !== it.title_cur || it.desc_new !== it.desc_cur;
      h += '<tr' + (it.st === 'error' ? ' style="color:#dc2626"' : '') + '>' +
        '<td><input type="checkbox" class="seoQChk" data-id="' + escP(it.id) + '"' + (it.st === 'proposed' ? ' checked' : ' disabled') + '></td>' +
        '<td style="direction:ltr;font-size:10.5px;max-width:170px;word-break:break-all">' + escP(it.path) + (it.err ? '<br><small>' + escP(it.err) + '</small>' : '') + '</td>' +
        '<td style="max-width:260px">' + (changed ? '<span style="color:#94a3b8;text-decoration:line-through">' + escP(tOld) + '</span><br>→ <b style="color:#065f46">' + escP(tNew.slice(0, 70)) + '</b> <small>(' + tNew.length + ')</small>' : '<span style="color:#94a3b8">بدون تغییر پیشنهادی</span>') + '</td>' +
        '<td style="max-width:260px;color:#475569">' + escP((it.desc_new || '').slice(0, 110)) + '… <small>(' + (it.desc_new || '').length + ')</small></td></tr>';
    });
    h += '</tbody></table></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button class="bt" style="padding:5px 11px;font-size:12px;background:#059669" onclick="cmsSeoQueueApply()">✅ اعمال تیک‌خورده‌ها روی سایت</button>' +
      '<label style="font-size:11px;color:#64748b;align-self:center"><input type="checkbox" id="seoQResubmit" checked> بعد از اعمال، نقشه در سرچ کنسول ثبت شود</label></div>';
    el.innerHTML = h;
  }

  window.cmsSeoQueueRefresh = function (cb) {
    api('seo_queue_list', {}, function (d) {
      if (d && d.ok) { _q.items = d.items || []; _q.counts = d.counts || {}; }
      var body = document.getElementById('seoQBody');
      if (body) body.innerHTML = seoQueueBodyHtml();
      seoQueueRenderList();
      if (cb) cb();
    });
  };

  window.cmsSeoQueueAdd = function () {
    var pages = (window._cmsPages || []).slice(0, 60).map(function (p) { return p.path; });
    if (!pages.length) { alert('فهرست فعلی خالی است — اول فیلتر بزنید'); return; }
    api('seo_queue_add', { paths: JSON.stringify(pages) }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || '')); return; }
      if (typeof ptfToast === 'function') ptfToast('افزوده شد: ' + d.added + ' · رد‌شده (تکراری/نامعتبر): ' + d.skipped, 'ok');
      cmsSeoQueueRefresh();
    });
  };

  window.cmsSeoQueueRun = function () {
    if (_q.running) { _q.stop = true; return; }
    var pend = (_q.items || []).filter(function (it) { return it.st === 'pending'; });
    if (!pend.length) { cmsSeoQueueRefresh(function () { }); pend = (_q.items || []).filter(function (it) { return it.st === 'pending'; }); }
    if (!pend.length) { alert('صف در انتظار خالی است — اول «افزودن نتایج فیلتر» را بزنید.'); return; }
    _q.running = true; _q.stop = false;
    var i = 0;
    var st = document.getElementById('seoQRun');
    function done() {
      _q.running = false;
      if (st) st.innerHTML = _q.stop ? '⏹ متوقف شد.' : '✅ پایان.';
      cmsSeoQueueRefresh();
    }
    function step() {
      if (_q.stop || i >= pend.length) { done(); return; }
      var it = pend[i];
      if (st) st.innerHTML = '⏳ ' + (i + 1) + ' از ' + pend.length + ': <span dir="ltr">' + escP(it.path) + '</span> … <button class="bt bt-o" style="padding:2px 8px;font-size:11px" onclick="cmsSeoQueueRun()">توقف</button>';
      cmsPageText(it.path, function (txt) {
        cmsLLM('seo_meta', { topic: it.title_cur || it.path, content: txt }, function (d) {
          function next() { i++; setTimeout(step, 1200); }
          if (d && d.ok && d.data && d.data.title && d.data.desc) {
            api('seo_queue_propose', { path: it.path, title: d.data.title, desc: d.data.desc }, function (r) {
              if (!r.ok && st) st.innerHTML += ' <span style="color:#dc2626">(' + escP(r.error || 'خطا') + ')</span>';
              next();
            });
          } else {
            api('seo_queue_propose', { path: it.path, fail: 1 }, function () { next(); });
            if (st) st.innerHTML += ' <span style="color:#d97706">(AI پاسخ نداد — رد شد)</span>';
          }
        });
      });
    }
    step();
  };

  window.cmsSeoQueueApply = function () {
    var ids = Array.prototype.slice.call(document.querySelectorAll('.seoQChk')).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-id'); });
    if (!ids.length) { alert('چیزی تیک نخورده است'); return; }
    if (!confirm('متای تیک‌خورده‌ها (' + ids.length + ' صفحه) روی فایل‌های سایت اعمال شود؟\nاز هر فایل قبل از نوشتن بک‌آپ گرفته می‌شود (crm/data/cms-backups).')) return;
    api('seo_queue_apply', { ids: JSON.stringify(ids) }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || '')); return; }
      var ok = (d.results || []).filter(function (r) { return r.ok; }).length;
      var bad = (d.results || []).length - ok;
      var resub = document.getElementById('seoQResubmit');
      if (resub && resub.checked && ok > 0 && cmsSitemapAutoOn()) { if (typeof gscSubmitSitemapQuiet === 'function') gscSubmitSitemapQuiet(); }
      alert('✅ اعمال شد: ' + ok + ' صفحه' + (bad ? '\n⚠️ ناموفق: ' + bad : ''));
      cmsSeoQueueRefresh();
    });
  };

  window.cmsSeoQueueClear = function (mode) { api('seo_queue_clear', { mode: mode || 'done' }, function () { cmsSeoQueueRefresh(); }); };

  /* ── پیشنهاد لینک داخلی برای صفحهٔ یتیم ── */
  window.cmsSeoLinkSuggest = function (i, ev) { /* v34.13.0 (BUGFIX): event صریح — نه global ضمنی */
    var p = (window._cmsPages || [])[i]; if (!p) return;
    var folder = p.folder || '';
    var cands = (window._cmsPages || []).filter(function (x) { return x.path !== p.path && (x.folder === folder || (x.inlinks || 0) > 3); }).slice(0, 25)
      .map(function (x) { return { path: x.path, title: x.title }; });
    if (!cands.length) { alert('کاندیدایی در نمای فعلی نیست — «نمایش بیشتر» یا حذف فیلتر را امتحان کنید.'); return; }
    var btn = (ev && ev.target) || (typeof window.event === 'object' && window.event && window.event.target);
    if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
    cmsLLM('seo_intlinks', { target: p.path, title: p.title || '', candidates: cands }, function (d) {
      if (btn) { btn.disabled = false; btn.textContent = '💡 لینک‌سازی'; }
      if (!d.ok || !d.data || !d.data.links) { alert('⚠️ ' + (d.error || 'هوش مصنوعی در دسترس نیست')); return; }
      var h = '<div style="background:#fff;border:1px solid #e9d5ff;border-radius:10px;padding:10px;margin-top:6px;font-size:12px"><b>💡 پیشنهاد لینک داخلی برای ' + escP(p.path) + ':</b><ol style="margin:6px 0 0 16px;line-height:2">';
      d.data.links.forEach(function (L) {
        h += '<li>از <span dir="ltr" style="color:#6b21a8">' + escP(L.from || '') + '</span> با انکر «<b>' + escP(L.anchor || '') + '</b>»' + (L.how ? '<br><small style="color:#64748b">' + escP(L.how) + '</small>' : '') + '</li>';
      });
      h += '</ol><small style="color:#94a3b8">درج نهایی لینک با ویرایش دستی صفحهٔ مبدأ انجام می‌شود (ویرایشگر در S2 به فرم مقاله اضافه می‌شود).</small></div>';
      var host = document.getElementById('seoDrift');
      if (host) { host.innerHTML = h; host.scrollIntoView({ behavior: 'smooth' }); }
    });
  };

  /* ── گزارش انحراف نقشه ── */
  window.cmsSitemapDrift = function () {
    var host = document.getElementById('seoDrift');
    if (host) host.innerHTML = '<div style="font-size:12px;color:#64748b">⏳ در حال مقایسهٔ نقشه با فایل‌های سایت…</div>';
    api('sitemap_drift', {}, function (d) {
      if (!d.ok) { if (host) host.innerHTML = '⚠️ ' + escP(d.error || ''); return; }
      var h = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;margin-top:8px;font-size:12px">';
      h += '<b>🧭 انحراف نقشهٔ سایت:</b> کل نقشه: ' + d.sitemap_total + ' · کل فایل‌ها: ' + d.files_total +
        ' · <span style="color:#dc2626">روح (در نقشه، فایل ندارد): ' + d.ghost_total + '</span> · <span style="color:#d97706">بدون نقشه: ' + d.missing_total + '</span>';
      if (d.ghost_total) { h += '<details style="margin-top:6px"><summary style="cursor:pointer">URLهای روح</summary><div dir="ltr" style="color:#b91c1c;font-size:11px;line-height:1.8">' + d.ghost.map(escP).join('<br>') + '</div></details>'; }
      if (d.missing_total) { h += '<details style="margin-top:4px"><summary style="cursor:pointer">فایل‌های خارج از نقشه</summary><div dir="ltr" style="color:#92400e;font-size:11px;line-height:1.8">' + d.missing.map(escP).join('<br>') + '</div></details>'; }
      h += '</div>';
      if (host) host.innerHTML = h;
    });
  };

  /* ── ثبت خودکار نقشه پس از انتشار — تنظیم دستگاه-local از طریق لایهٔ داده (ptfDevKv، اصل A10) ── */
  var _smAuto = true; /* پیش‌فرض روشن؛ هیدرِ async از devkv */
  try { if (window.ptfDevKv) window.ptfDevKv.get('cms.sitemap.auto', function (v) { if (v != null) _smAuto = String(v) !== '0'; }); } catch (eH) {}
  function cmsSitemapAutoOn() { return _smAuto; }
  window.cmsSitemapAutoToggle = function (el) {
    _smAuto = !_smAuto;
    try { if (window.ptfDevKv) window.ptfDevKv.set('cms.sitemap.auto', _smAuto ? '1' : '0'); } catch (eS) {}
    if (el) el.textContent = _smAuto ? '🔄 ثبت خودکار نقشه: روشن' : '🔄 ثبت خودکار نقشه: خاموش';
    if (typeof ptfToast === 'function') ptfToast(_smAuto ? 'ثبت خودکار نقشه روشن شد' : 'ثبت خودکار نقشه خاموش شد', 'ok');
  };
  function cmsSitemapAfterPublish() {
    if (cmsSitemapAutoOn()) { if (typeof gscSubmitSitemapQuiet === 'function') { gscSubmitSitemapQuiet(); return true; } }
    return false;
  }
  /* ═══ v34.37.5 (SITEMAP-HONEST): «✅ به sitemap اضافه شد» فقط وقتی سرور نوشتن را تأیید کرده باشد
     — اگر sitemap-*.xml روی هاست قابل‌نوشت نباشد، اکنون هشدار دقیق با علت و راه‌حل داده می‌شود
     (به‌جای OK کاذب)؛ خودِ صفحه منتشر شده و فقط ثبتِ نقشه باید دستی تکرار شود. */
  window.cmsSitemapNote = function (d) {
    if (!d || d.sitemap !== 'failed') return '';
    return '\n\n⚠️ نقشهٔ سایت به‌روز نشد: ' + (d.sitemap_error || 'خطای نوشتن فایل') +
      ' — فایل‌های sitemap-*.xml در ریشۀ هاست باید برای PHP قابل‌نوشت باشند (chmod 664 یا هم‌مالک‌سازی با فایل‌های blog). ' +
      'پس از رفع مجوز، یک‌بار «📤 سایت‌مپ + سرچ کنسول» را بزنید؛ خودِ صفحه منتشر شده و چیزی از دست نمی‌رود.';
  };

  /* ═══ v34.10.0 (S1/DRAFTS): پیش‌نویس ماندگار — بستن مودال متن AI را نمی‌پراند ═══ */
  var KC_FIELDS = ['kcTitle', 'kcSlug', 'kcH1', 'kcDesc', 'kcCat', 'kcImg', 'kcBody'];
  var CB_FIELDS = ['cbTitle', 'cbSlug', 'cbDesc', 'cbCat', 'cbBody'];
  var _draftTimers = {};
  function cmsDraftKey(f) { return 'cms.draft.' + String(f || '').slice(0, 2); } /* cms.draft.kc / cms.draft.cb */
  function cmsDraftSave(fields) {
    var d = {};
    fields.forEach(function (id) { var e = document.getElementById(id); if (e) d[id] = e.value; });
    try { if (window.ptfDevKv) window.ptfDevKv.set(cmsDraftKey(fields[0]), JSON.stringify({ ts: Date.now(), f: d })); } catch (e) {} /* A10: devkv نه LS */
  }
  function cmsDraftClear(fields) { try { if (window.ptfDevKv) window.ptfDevKv.remove(cmsDraftKey(fields[0])); } catch (e) {} }
  function cmsDraftWipe(w) {
    var f = (w.getAttribute('data-fields') || '').split(',').filter(Boolean);
    cmsDraftClear(f);
    f.forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
    alert('پیش‌نویس پاک شد.');
  }
  window.cmsDraftWipe = cmsDraftWipe;
  function cmsDraftRestore(fields, statusId) {
    if (!window.ptfDevKv) return; /* لایهٔ داده در دسترس نیست — بدون پیش‌نویس ماندگار */
    window.ptfDevKv.get(cmsDraftKey(fields[0]), function (raw) {
      if (!raw) return;
      var j = null; try { j = JSON.parse(String(raw)); } catch (e2) {}
      if (!j || !j.f) return;
      fields.forEach(function (id) { var e = document.getElementById(id); if (e && j.f[id] && !e.value) e.value = j.f[id]; });
      var st2 = document.getElementById(statusId);
      if (st2) st2.innerHTML = '🔁 پیش‌نویسِ ذخیره‌شده (' + new Date(j.ts).toLocaleDateString('fa-IR') + ') بازیابی شد — <button class="bt bt-o" style="padding:1px 8px;font-size:11px;color:#dc2626" data-fields="' + fields.join(',') + '" onclick="cmsDraftWipe(this)">پاک‌کردن پیش‌نویس</button>';
      if (typeof cmsKcCount === 'function') { try { cmsKcCount(); } catch (e3) {} }
    });
  }
  function cmsDraftBind(fields) {
    fields.forEach(function (id) {
      var e = document.getElementById(id);
      if (!e || e._ptfDraft) return;
      e._ptfDraft = 1;
      e.addEventListener('input', function () {
        clearTimeout(_draftTimers[fields[0]]);
        _draftTimers[fields[0]] = setTimeout(function () { cmsDraftSave(fields); }, 700);
      });
    });
  }

  /* ═══ v34.27.0 (GSC-BRIDGE): پل CMS → api/gsc.php — ثبت نقشه + ایندکس‌یاب ═══ */
  function cmsGsc(action, data, cb) {
    var opt = { method: 'POST', headers: cmsAuthHeaders() };
    if (data) { var fd = new FormData(); Object.keys(data).forEach(function (k) { fd.append(k, data[k]); }); opt.body = fd; }
    fetch('../api/gsc.php?action=' + action, opt).then(function (r) { return r.json(); }).then(cb)
      /* v34.31.0 (GSC-DIAG): پاسخ غیرJSON یعنی سرور 500 داده — تقریباً همیشه خطای نحوی در
         api/gsc-config.php؛ پیام عمومی قبلی کاربر را در حلقهٔ راهنماهای گوگلی نگه می‌داشت */
      .catch(function () { cb({ ok: false, error: 'پاسخ سرور خطا بود (احتمالاً HTTP 500). رایج‌ترین علت: خطای نحوی در فایل تنظیمات — روی هاست اجرا کنید: php -l api/gsc-config.php و در صورت خطا، فایل را از نو بسازید (نسخهٔ خراب به‌صورت gsc-config.php.broken-* قرنطینه می‌شود).' }); });
  }
  window.cmsSeoSitemapPush = function () {
    var st = document.getElementById('cmsStatus');
    if (st) st.innerHTML = '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#1e40af">⏳ ثبت نقشهٔ سایت در سرچ کنسول…</div>';
    cmsGsc('sitemap_submit', { feed: 'https://pishtaj.ir/sitemap-index.xml' }, function (d) {
      if (!d.ok) { if (st) st.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#b91c1c">⚠️ ثبت نقشه ناموفق: ' + escP(d.error || '') + '</div><button class="bt bt-o" style="margin-top:6px;padding:5px 14px;font-size:12px;color:#7c3aed" onclick="cmsGscSelfTest()">🧪 آزمون اتصال GSC — علت دقیق + راهنمای رفع</button>'; return; }
      if (st) st.innerHTML = '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#065f46">✅ نقشهٔ سایت (sitemap-index + همهٔ زیرنقشه‌ها از جمله محصولات و صفحات جدید) در سرچ کنسول ثبت/به‌روزرسانی شد — وضعیت: ' + escP(d.state || '') + ' · خطا: ' + escP(String(d.errors || 0)) + (d.lastDownload ? ' · آخرین دانلود گوگل: ' + escP(d.lastDownload) : '') + '</div>';
      try { audit('CMS', 'ثبت نقشهٔ سایت در سرچ کنسول از CMS', 'sitemap-index.xml'); } catch (eA) {}
    });
  };
  /* ═══ v34.29.1 (GSC-SELF-TEST): آزمون اتصال سرچ کنسول — علتِ دقیقِ «ثبت ناموفق» ═══ */
  window.cmsGscSelfTestHtml = function (d) {
    d = d || {};
    var email = d.email || '';
    var sites = d.sites || [];
    var v = d.verdict || '';
    var head = '';
    function box(color, bg, icon, title, bodyHtml) {
      return '<div style="background:' + bg + ';border:1px solid ' + color + ';border-radius:12px;padding:10px 14px;font-size:12.5px;line-height:2;margin:8px 0"><b style="color:' + color + '">' + icon + ' ' + title + '</b>' + (bodyHtml || '') + '</div>';
    }
    head += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0">' +
      '<span style="font-size:12px;color:#475569">ایمیل سرویس‌اکانت:</span>' +
      '<b dir="ltr" id="gscStEmail" style="font-size:12.5px;color:#0f172a">' + escP(email || '—') + '</b>' +
      (email ? '<button class="bt bt-o" style="padding:3px 10px;font-size:11px;color:#0e7490" onclick="cmsGscCopyEmail()">📋 کپی ایمیل</button>' : '') +
      '</div>';
    var sitesHtml = '<div style="margin-top:4px"><b style="font-size:12.5px;color:#0f172a">پراپرتی‌های قابل‌دسترسی در سرچ کنسول (' + sites.length + '):</b>';
    if (!sites.length) sitesHtml += '<div style="color:#b91c1c;font-size:12.5px;line-height:2;padding:4px 0">— خالی — گوگل می‌گوید این سرویس‌اکانت به هیچ پراپرتی‌ای دسترسی ندارد؛ یعنی افزودنِ «Full» در جای درست اعمال نشده است (مراحل پایین).</div>';
    else sitesHtml += '<ul style="margin:6px 0;padding-right:18px;font-size:12px">' + sites.map(function (x) {
      var full = (x.permissionLevel || '').indexOf('Full') > -1 || (x.permissionLevel || '').indexOf('Owner') > -1;
      return '<li style="margin:3px 0"><span dir="ltr">' + escP(x.siteUrl || '') + '</span> — <span style="color:' + (full ? '#059669' : '#b45309') + ';font-weight:700">' + escP(x.permissionLevel || '?') + '</span></li>';
    }).join('') + '</ul>';
    sitesHtml += '</div>';
    var steps = (d.steps || []).map(function (t, i) { return '<li style="margin:4px 0">' + (i + 1) + '. ' + escP(t) + '</li>'; }).join('');
    if (steps) steps = '<ol style="margin:8px 0 2px;padding-right:18px;font-size:12.5px;line-height:2;color:#334155">' + steps + '</ol>';
    var verdict = '';
    if (v === 'ok') verdict = box('#10b981', '#ecfdf5', '✅', 'اتصال سالم است', '<div style="color:#065f46">پراپرتی منتخب: <b dir="ltr">' + escP(d.site || '') + '</b> — دکمهٔ «📤 سایت‌مپ + سرچ کنسول» باید بدون خطا کار کند.</div>');
    else if (v === 'no_match') verdict = box('#b91c1c', '#fef2f2', '⛔', 'سرویس‌اکانت هنوز به پراپرتی pishtaj.ir دسترسی ندارد', steps);
    else if (v === 'low_perm') verdict = box('#b45309', '#fffbeb', '⚠️', 'سطح دسترسی کافی نیست (فقط خواندنی)', steps);
    else if (v === 'token_error') verdict = box('#b91c1c', '#fef2f2', '⛔', 'توکن گوگل گرفته نشد — کلید/ایمیل در gsc-config.php نادرست است', steps);
    else if (v === 'no_config') verdict = box('#b45309', '#fffbeb', '⚠️', 'تنظیمات GSC روی سرور کامل نیست (api/gsc-config.php)', steps);
    else if (v === 'api_error') verdict = box('#b91c1c', '#fef2f2', '⛔', 'خطای فراخوانی گوگل', '<div dir="ltr" style="text-align:left;font-size:11.5px;color:#b91c1c">' + escP(d.error || '') + '</div>' + steps);
    /* v34.31.0 (GSC-DIAG): خرابی/نقص فایل تنظیمات + پاسخ‌های خطای عمومی */
    else if (v === 'config_broken') verdict = box('#b91c1c', '#fef2f2', '⛔', 'فایل تنظیمات (api/gsc-config.php) خطای نحوی دارد', steps);
    else if (v === 'config_incomplete') verdict = box('#b45309', '#fffbeb', '⚠️', 'فایل تنظیمات ناقص است (client_email یا private_key خالی)', steps);
    else if (d.ok === false) verdict = box('#b91c1c', '#fef2f2', '⛔', 'پاسخ سرور خطا بود', '<div style="color:#7f1d1d;line-height:2">' + escP(d.error || '') + '</div>' + steps);
    else verdict = box('#b45309', '#fffbeb', '⚠️', 'وضعیت نامشخص', steps || '<div>دوباره امتحان کنید.</div>');
    return head + verdict + sitesHtml;
  };
  window.cmsGscCopyEmail = function () {
    var el = document.getElementById('gscStEmail');
    var txt = el ? el.textContent : '';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
      else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      var b = el && el.parentNode && el.parentNode.querySelector('button'); if (b) { b.textContent = '✅ کپی شد'; setTimeout(function () { b.textContent = '📋 کپی ایمیل'; }, 1600); }
    } catch (eC) { prompt('این ایمیل را کپی کنید:', txt); }
  };
  window.cmsGscSelfTest = function () {
    var old = document.getElementById('ptGscSt'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ptGscSt';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100001;display:flex;align-items:center;justify-content:center;padding:14px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow:auto;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
      '<div style="display:flex;gap:8px;align-items:center;margin:14px 16px 4px"><b style="font-size:14px">🧪 آزمون اتصال سرچ کنسول</b>' +
      '<button class="bt bt-o" style="padding:4px 12px;font-size:12px;margin-right:auto" onclick="this.closest(\'div[style*=fixed]\').parentNode.removeChild(this.closest(\'div[style*=fixed]\'))">بستن</button></div>' +
      '<div id="gscStBody" style="margin:4px 16px 16px;font-size:12.5px;color:#334155">⏳ در حال پرس‌وجو از گوگل…</div></div>';
    document.body.appendChild(ov);
    cmsGsc('selftest', null, function (d) {
      var el = document.getElementById('gscStBody');
      if (!el) return;
      try { el.innerHTML = window.cmsGscSelfTestHtml(d); }
      catch (eR) { el.innerHTML = '<span style="color:#b91c1c">خطای نمایش: ' + escP(eR.message) + '</span>'; }
    });
  };

  window.cmsIndexWizard = function () {
    var old = document.getElementById('ptIdxWiz'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'ptIdxWiz';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;max-height:90vh;overflow:auto;direction:rtl;font-family:inherit" onclick="event.stopPropagation()">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 16px 6px"><b style="font-size:14px">🚀 ایندکس‌یاب</b>' +
      '<button class="bt bt-o" style="padding:4px 12px;font-size:12px;color:#0e7490;margin-right:auto" onclick="cmsSeoSitemapPush()">📤 بازارسال سایت‌مپ</button>' +
      '<button class="bt bt-o" style="padding:4px 12px;font-size:12px" onclick="this.closest(\'div[style*=fixed]\').parentNode.removeChild(this.closest(\'div[style*=fixed]\'))">بستن</button></div>' +
      '<div style="font-size:11.5px;color:#475569;margin:0 16px 8px;line-height:1.9">وضعیت ایندکس صفحات از API رسمی سرچ کنسول خوانده می‌شود؛ برای ایندکس‌نشده‌ها پیوند «درخواست ایندکس» همان صفحهٔ رسمی گوگل را باز می‌کند (گوگل برای Request Indexing API عمومی ندارد — سهمیهٔ روزانه محدود است). هر اجرا حداکثر ۲۵ صفحه بررسی می‌کند.</div>' +
      '<div style="display:flex;gap:7px;align-items:center;margin:0 16px 8px"><button class="bt" style="background:#059669" onclick="cmsIndexRun()">🔍 بررسی انتخاب‌شده‌ها</button><span id="ptIdxSt" style="font-size:12px;color:#475569"></span></div>' +
      '<div id="ptIdxBody" style="margin:0 16px 16px;max-height:56vh;overflow:auto;font-size:12px">⏳ در حال خواندن فهرست صفحات…</div></div>';
    document.body.appendChild(ov);
    function fill() {
      var list = (window._cmsPages || []).slice(0, 60);
      var el = document.getElementById('ptIdxBody'); if (!el) return;
      if (!list.length) { el.innerHTML = '<span style="color:#94a3b8">صفحه‌ای یافت نشد</span>'; return; }
      el.innerHTML = list.map(function (p, i) {
        return '<div style="display:flex;gap:7px;align-items:center;padding:5px 0;border-bottom:1px dashed #e2e8f0">' +
          '<input type="checkbox" class="ptIdxCb" value="' + escP(p.path) + '"' + (i < 10 ? ' checked' : '') + '>' +
          '<span dir="ltr" style="flex:1;text-align:left;font-size:11.5px">' + escP(p.path) + '</span>' +
          '<span class="ptIdxR" id="ptIdxR' + i + '" style="font-size:11px;color:#94a3b8">—</span></div>';
      }).join('');
    }
    if ((window._cmsPages || []).length) fill();
    else seoLoad(fill);
  };
  window.cmsIndexRun = function () {
    var paths = Array.prototype.slice.call(document.querySelectorAll('#ptIdxWiz .ptIdxCb:checked')).map(function (c) { return c.value; });
    if (!paths.length) { alert('حداقل یک صفحه انتخاب کنید'); return; }
    if (paths.length > 25) paths = paths.slice(0, 25);
    var rows = Array.prototype.slice.call(document.querySelectorAll('#ptIdxWiz .ptIdxR'));
    var boxes = Array.prototype.slice.call(document.querySelectorAll('#ptIdxWiz .ptIdxCb'));
    var st = document.getElementById('ptIdxSt');
    var k = 0, idxN = 0, notN = 0;
    function next() {
      if (k >= paths.length) { if (st) st.innerHTML = '✅ ' + idxN + ' ایندکس‌شده · <b style="color:#dc2626">' + notN + ' ایندکس‌نشده</b> — برای آن‌ها «درخواست ایندکس» را باز کنید'; return; }
      var p = paths[k];
      var bi = boxes.findIndex(function (b) { return b.value === p; });
      var ri = bi > -1 ? document.getElementById('ptIdxR' + bi) : null;
      if (st) st.innerHTML = '⏳ ' + (k + 1) + ' از ' + paths.length + '…';
      if (ri) ri.innerHTML = '⏳';
      cmsGsc('inspect', { url: 'https://pishtaj.ir/' + p, log: '1' }, function (d) {
        if (d.ok) {
          var isIdx = d.verdict === 'INDEXED';
          if (isIdx) idxN++; else notN++;
          if (ri) ri.innerHTML = isIdx
            ? '<span style="color:#059669;font-weight:700">✅ ایندکس شده</span>'
            : '<span style="color:#dc2626;font-weight:700">⛔ ' + escP(d.verdict || '') + (d.coverage ? ' — ' + escP(String(d.coverage).slice(0, 60)) : '') + '</span> <a class="bt bt-o" style="padding:2px 9px;font-size:11px;text-decoration:none;color:#b45309" target="_blank" rel="noopener" href="' + escP(d.inspectLink || '') + '">درخواست ایندکس ↗</a>';
        } else if (ri) ri.innerHTML = '<span style="color:#b45309">⚠️ ' + escP(d.error || 'خطا') + '</span>';
        k++;
        setTimeout(next, 250);
      });
    }
    next();
  };

  window.cmsSeoIssue = function (code) { _seo.issue = code; renderCms(document.getElementById('cmsWrap')); };
  window.cmsSeoFolder = function (v) { _seo.folder = v; _seo.offset = 0; renderCms(document.getElementById('cmsWrap')); };
  window.cmsSeoSearch = function () {
    var q = document.getElementById('seoQ');
    _seo.q = q ? q.value.trim() : '';
    _seo.offset = 0;
    renderCms(document.getElementById('cmsWrap'));
  };
  window.cmsSeoRefresh = function () {
    api('page_list', { refresh: 1, limit: 1 }, function () {
      _seo.offset = 0;
      renderCms(document.getElementById('cmsWrap'));
    });
  };
  window.cmsSeoMore = function () {
    _seo.offset += _seo.limit;
    api('page_list', { q: _seo.q, folder: _seo.folder, issue: _seo.issue, limit: _seo.limit, offset: _seo.offset }, function (d) {
      if (!d.ok) return;
      window._cmsPages = (window._cmsPages || []).concat(d.pages || []);
      var el = document.getElementById('seoList');
      if (el) el.innerHTML = seoRows();
    });
  };
  window.cmsSeoExport = function () {
    api('page_list', { q: _seo.q, folder: _seo.folder, issue: _seo.issue, limit: 500, offset: 0 }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || '')); return; }
      var rows = [['مسیر', 'عنوان', 'طول عنوان', 'توضیح', 'طول توضیح', 'canonical', 'robots', 'واژگان', 'در نقشه', 'مشکلات']];
      (d.pages || []).forEach(function (p) {
        rows.push([p.path, p.title, p.title_len, p.desc, p.desc_len, p.canonical, p.robots, p.words, p.sitemap ? 'بله' : 'خیر', (p.issues || []).join(' | ')]);
      });
      var csv = '\ufeff' + rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'seo-pages-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
    });
  };

  window.cmsSeoCount = function () {
    var t = document.getElementById('csTitle'), d = document.getElementById('csDesc');
    var te = document.getElementById('csTitleLen'), de = document.getElementById('csDescLen');
    if (t && te) {
      var tl = t.value.trim().length;
      te.textContent = tl + ' کاراکتر';
      te.style.color = (tl >= 30 && tl <= 65) ? '#059669' : '#dc2626';
    }
    if (d && de) {
      var dl = d.value.trim().length;
      de.textContent = dl + ' کاراکتر';
      de.style.color = (dl >= 70 && dl <= 165) ? '#059669' : '#dc2626';
    }
    var h = document.getElementById('csH1'), he = document.getElementById('csH1Len');
    if (h && he) {
      var hl = h.value.trim().length;
      he.textContent = hl + ' کاراکتر';
      he.style.color = (hl >= 20 && hl <= 70) ? '#059669' : '#dc2626';
    }
  };

  /* ---------- لایهٔ هوش مصنوعیِ سئو (api/llm.php) ---------- */
  /* v34.36.2 (AI-JSON-REPAIR): پیش‌تر خطای «خروجی AI ساختار JSON معتبر ندارد» بن‌بست
     مطلق بود — نه علت می‌گفت، نه نمونهٔ خام را نشان می‌داد، نه راهِ بعدی. اکنون هر
     پاسخ ناموفق: ۱) در window.__ptfAiLast نگه داشته می‌شود (برای پشتیبانی/تشخیص)
     ۲) با console.error و نمونهٔ خام ثبت می‌شود ۳) پیام عملیاتی (علت + کار بعدی)
     می‌گیرد که همهٔ فراخوان‌ها (cmsAiFix/cmsAiMeta/ویزارد گروهی/…) همان را نشان می‌دهند. */
  window.__ptfAiLast = null;
  function cmsAiDiag(d, action) {
    d = d && typeof d === 'object' ? d : { ok: false, error: 'پاسخ نامعتبر از سرویس AI' };
    if (d.ok) return d;
    try {
      window.__ptfAiLast = {
        action: action, at: new Date().toISOString(), error: d.error || '',
        truncated: !!d.truncated, finish: d.finish || '', model: d.model || '',
        http: (d.http == null ? '' : d.http), raw: d.raw || ''
      };
      if (window.console && console.error) console.error('[PTF AI] ' + action + ':', d.error || '', d.raw ? ('\nنمونهٔ خام خروجی مدل:\n' + d.raw) : '');
    } catch (eDiag) {}
    var hint = '';
    if (d.truncated) hint = ' 🔁 دوباره بزنید؛ اگر تکرار شد متن ورودی را کوتاه‌تر کنید.';
    else if (/JSON/i.test(String(d.error || ''))) hint = ' 🔁 یک بار دیگر بزنید (خروجی مدل تصادفی است)؛ نمونهٔ خام در کنسول مرورگر (F12) و window.__ptfAiLast است.';
    if (hint && String(d.error || '').indexOf(hint) === -1) d.error = String(d.error || 'خطای نامشخص در سرویس AI') + hint;
    return d;
  }
  function cmsLLM(action, body, cb) {
    var h = cmsAuthHeaders();
    h['Content-Type'] = 'application/json';
    fetch('../api/llm.php?action=' + action, { method: 'POST', headers: h, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(cmsAiDiag(d, action)); })
      .catch(function (eNet) { cb(cmsAiDiag({ ok: false, error: 'عدم دسترسی به هوش مصنوعی' }, action)); });
  }

  /* متنِ قابلِ‌خواندنِ یک صفحهٔ سایت (همان‌اصل = منشأ یکسان) */
  function cmsPageText(path, cb) {
    fetch('/' + path, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      if (!t) { cb(''); return; }
      t = t.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ');
      var i = t.toLowerCase().indexOf('</head>');
      if (i > -1) t = t.slice(i + 7);
      t = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      cb(t.slice(0, 8000));
    }).catch(function () { cb(''); });
  }

  function cmsSetLen(id, v) { var e = document.getElementById(id); if (e) e.value = v || ''; }

  /* ═══ v34.24.0 (SEO-BATCH-FIX): اصلاح هوشمند گروهی سئو — یک کلیک ═══
     اسکن موجود ایرادهای هر صفحه را زیرش نشان می‌دهد؛ این ویزارد صفحاتِ دارای ایرادِ
     قابل اصلاح خودکار (عنوان/توضیح/H1) را یک‌جا برمی‌دارد، برای هر صفحه متن واقعی
     خوانده می‌شود، seo_fix در چهارچوب قوانین سئو و Google Search Central پیشنهاد
     می‌سازد، اعتبارسنجی طول انجام می‌شود و پس از یک تأیید انسانی، همهٔ انتخاب‌شده‌ها
     با page_meta_save روی سایت اعمال می‌شوند. canonical/robots هر صفحه دست‌نخورده
     می‌ماند (ابزار گروهی خودشان را دارند). */
  var SEO_FIXABLE = ['no-desc', 'desc-long', 'desc-short', 'no-title', 'title-long', 'title-short', 'no-h1', 'h1-long', 'h1-short'];
  function cmsSeoFixablePages() {
    return (window._cmsPages || []).map(function (p, i) {
      var is = (p.issues || []).filter(function (k) { return SEO_FIXABLE.indexOf(k) > -1; });
      return is.length ? { i: i, p: p, is: is } : null;
    }).filter(Boolean);
  }
  function seoBatchRows() { return (window._seoBatch || {}).rows || []; }
  window.cmsSeoAiBatch = function () {
    var targets = cmsSeoFixablePages();
    if (!targets.length) { alert('در نمای فعلی صفحه‌ای با ایراد قابل اصلاح خودکار (عنوان/توضیح/H1) نیست ✅\n\nایرادهایی مثل canonical و نقشهٔ سایت و noindex ابزار گروهی خودشان را دارند و متنِ کم/یتیم به محتوا نیاز دارد.'); return; }
    var capped = targets.length > 30;
    if (capped) targets = targets.slice(0, 30);
    window._seoBatch = { rows: targets.map(function (t) { return { i: t.i, p: t.p, is: t.is, on: true, st: 'pending', prop: null, note: '' }; }), phase: 'idle', cancel: false };
    var html = '<div class="md-b" id="ptSeoBatch" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 اصلاح هوشمند گروهی سئو</h3>' +
      '<div style="font-size:12px;color:#475569;line-height:1.9;margin-bottom:8px">هوش مصنوعی متنِ واقعی هر صفحهٔ انتخاب‌شده را می‌خواند و عنوان/توضیح/H1 را در چهارچوب قوانین سئو (طول استاندارد، یکتایی، تطابق با محتوا — طبق راهنمای Google Search Central) بازنویسی می‌کند. پس از آنالیز، پیشنهادها را یک‌جا می‌بینید و با یک تأیید اعمال می‌شوند.' +
      (capped ? '<br><b style="color:#b45309">⚠️ هر اجرا حداکثر ۳۰ صفحه — پس از پایان، دوباره بزنید تا بقیه اصلاح شوند.</b>' : '') + '</div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
      '<button class="bt" style="background:#7c3aed" id="seoBatchGo" onclick="cmsSeoAiBatchRun()">▶️ آنالیز و ساخت پیشنهادها</button>' +
      '<button class="bt bt-o" id="seoBatchApply" style="display:none;background:#059669;color:#fff" onclick="cmsSeoAiBatchApply()">✅ تأیید و اعمال انتخاب‌شده‌ها</button>' +
      '<button class="bt bt-o" id="seoBatchCancel" style="display:none;color:#dc2626" onclick="if(window._seoBatch)window._seoBatch.cancel=true">✖ توقف</button>' +
      '<span id="seoBatchSt" style="font-size:12px;color:#475569"></span></div>' +
      '<div id="seoBatchBody" style="max-height:56vh;overflow:auto;font-size:12px"></div>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    cmsSeoAiBatchRender();
  };
  window.cmsSeoAiBatchRender = function () {
    var el = document.getElementById('seoBatchBody'); if (!el) return;
    var rows = seoBatchRows();
    var LB = { 'no-desc': 'بدون توضیح', 'desc-long': 'توضیح بلند', 'desc-short': 'توضیح کوتاه', 'no-title': 'بدون عنوان', 'title-long': 'عنوان بلند', 'title-short': 'عنوان کوتاه', 'no-h1': 'بدون H1', 'h1-long': 'H1 بلند', 'h1-short': 'H1 کوتاه' };
    function cell(lb, cur, pro, lo, hi) {
      var pl = (pro || '').length;
      var col = pro ? (pl >= lo && pl <= hi ? '#059669' : '#dc2626') : '#94a3b8';
      return '<div style="padding:4px 0;border-bottom:1px dashed #e2e8f0"><b style="color:#64748b;font-size:11px">' + lb + '</b><br>' +
        '<span style="color:#94a3b8">اکنون (' + (cur || '').length + '):</span> ' + escP(cur || '—') + '<br>' +
        (pro != null ? '<span style="color:' + col + '">پیشنهاد (' + pl + '):</span> <b>' + escP(pro || '—') + '</b>' : '<span style="color:#cbd5e1">پیشنهاد: —</span>') + '</div>';
    }
    el.innerHTML = rows.map(function (r, idx) {
      var stMap = { pending: ['⏳ در انتظار', '#94a3b8'], reading: ['📖 خواندن صفحه…', '#0e7490'], llm: ['🤖 تحلیل با AI…', '#7c3aed'], done: ['✅ پیشنهاد آماده', '#059669'], bad: ['⚠️ ' + (r.note || 'ناموفق'), '#dc2626'], applied: ['🚀 اعمال شد', '#059669'], fail: ['❌ ' + (r.note || 'خطا در اعمال'), '#dc2626'], off: ['—', '#94a3b8'] };
      var sm = stMap[r.st] || stMap.pending;
      return '<div style="border:1px solid var(--brd);border-radius:10px;padding:8px 10px;margin-bottom:6px' + (r.on ? '' : ';opacity:.55') + '">' +
        '<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">' +
        '<label style="display:flex;gap:6px;align-items:center;flex:1;min-width:230px;cursor:pointer;font-weight:700;direction:ltr;text-align:left;font-size:12px">' +
        '<input type="checkbox" onchange="cmsSeoAiBatchRow(' + idx + ',this.checked)" ' + (r.on ? 'checked' : '') + '> ' + escP(r.p.path) + '</label>' +
        '<span style="font-size:11px">' + r.is.map(function (k) { return '<span class="bd" style="background:#fef3c7;color:#b45309">' + (LB[k] || k) + '</span>'; }).join(' ') + '</span>' +
        '<span style="font-size:11.5px;font-weight:800;color:' + sm[1] + '">' + sm[0] + '</span></div>' +
        (r.prop ? '<div style="margin-top:6px">' + cell('عنوان', r.p.title, r.prop.title, 30, 65) + cell('توضیح', r.p.desc, r.prop.desc, 70, 165) + cell('H1', r.p.h1, r.prop.h1, 5, 70) + '</div>' : '') +
        '</div>';
    }).join('');
  };
  window.cmsSeoAiBatchRow = function (idx, on) {
    var r = seoBatchRows()[idx]; if (!r) return;
    r.on = !!on; if (!on) r.st = r.st === 'applied' ? r.st : 'off';
    cmsSeoAiBatchRender();
  };
  function seoBatchMsg(t) { var e = document.getElementById('seoBatchSt'); if (e) e.innerHTML = t; }
  window.cmsSeoAiBatchRun = function () {
    var B = window._seoBatch; if (!B || B.phase === 'run') return;
    B.phase = 'run'; B.cancel = false;
    var go = document.getElementById('seoBatchGo'); if (go) go.disabled = true;
    var cx = document.getElementById('seoBatchCancel'); if (cx) cx.style.display = '';
    var rows = seoBatchRows().filter(function (r) { return r.on; });
    if (!rows.length) { seoBatchMsg('صفحه‌ای انتخاب نشده است'); B.phase = 'idle'; if (go) go.disabled = false; if (cx) cx.style.display = 'none'; return; }
    var k = 0;
    function next() {
      if (B.cancel) { seoBatchMsg('⏹ توقف شد — پیشنهادهای آماده قابل اعمال‌اند'); return fin(); }
      while (k < rows.length && !rows[k].on) k++;
      if (k >= rows.length) { seoBatchMsg('✅ آنالیز کامل شد — بازبینی کنید و تأیید بزنید'); return fin(); }
      var r = rows[k];
      seoBatchMsg('⏳ صفحهٔ ' + (k + 1) + ' از ' + rows.length + '…');
      r.st = 'reading'; cmsSeoAiBatchRender();
      cmsPageText(r.p.path, function (txt) {
        if (B.cancel) { seoBatchMsg('⏹ توقف شد'); return fin(); }
        r.st = 'llm'; cmsSeoAiBatchRender();
        cmsLLM('seo_fix', { issues: r.is.join('، '), content: txt }, function (d) {
          if (d.ok && d.data) {
            var g = d.data, notes = [];
            var tl = (g.title || '').length, dl = (g.desc || '').length, hl = (g.h1 || '').length;
            if (!tl || tl < 30 || tl > 65) notes.push('عنوان خارج از بازهٔ ۳۰–۶۵');
            if (!dl || dl < 70 || dl > 165) notes.push('توضیح خارج از بازهٔ ۷۰–۱۶۵');
            if (!hl) notes.push('H1 خالی');
            if (notes.length) { r.st = 'bad'; r.note = notes.join(' + ') + ' — پیشنهاد در چهارچوب نیافت؛ دستی ویرایش کنید'; r.prop = null; }
            else { r.st = 'done'; r.prop = { title: g.title, desc: g.desc, h1: g.h1 }; }
          } else { r.st = 'bad'; r.note = escP(d.error || 'هوش مصنوعی در دسترس نیست'); r.prop = null; }
          k++;
          cmsSeoAiBatchRender();
          setTimeout(next, 120); /* فاصلهٔ کوتاه بین فراخوانی‌ها */
        });
      });
    }
    function fin() {
      B.phase = 'review';
      var gox = document.getElementById('seoBatchGo'); if (gox) gox.disabled = false;
      var cxx = document.getElementById('seoBatchCancel'); if (cxx) cxx.style.display = 'none';
      var ap = document.getElementById('seoBatchApply');
      if (ap && seoBatchRows().some(function (r) { return r.on && r.st === 'done'; })) ap.style.display = '';
      cmsSeoAiBatchRender();
    }
    next();
  };
  window.cmsSeoAiBatchApply = function () {
    var B = window._seoBatch; if (!B || B.phase === 'run') return;
    var rows = seoBatchRows().filter(function (r) { return r.on && r.st === 'done' && r.prop; });
    if (!rows.length) { alert('پیشنهاد آماده‌ای برای اعمال نیست'); return; }
    if (!confirm('پیشنهادهای هوش مصنوعی برای ' + rows.length + ' صفحه روی فایل‌های سایت اعمال شود؟\n(از هر فایل نسخهٔ پشتیبان در crm/data/cms-backups نگهداری می‌شود)')) return;
    B.phase = 'run';
    var ap = document.getElementById('seoBatchApply'); if (ap) ap.disabled = true;
    var k = 0, okN = 0;
    function next() {
      if (k >= rows.length) {
        B.phase = 'done';
        if (ap) ap.disabled = false;
        seoBatchMsg('🚀 ' + okN + ' صفحه از ' + rows.length + ' اصلاح و اعمال شد — برای ثبت سریع‌تر در گوگل، در سرچ کنسول Request Indexing بزنید.');
        try { audit('CMS', 'اصلاح هوشمند گروهی سئو روی ' + okN + ' صفحه با AI', rows.map(function (r) { return r.p.path; }).join(',')); } catch (eA) {}
        if (okN) cmsSeoRefresh();
        return;
      }
      var r = rows[k];
      seoBatchMsg('⏳ اعمال ' + (k + 1) + ' از ' + rows.length + '…');
      api('page_meta_save', { file: r.p.path, title: r.prop.title, desc: r.prop.desc, canonical: r.p.canonical || '', robots: r.p.robots || '', h1: r.prop.h1 }, function (d) {
        if (d && d.ok) { r.st = 'applied'; okN++; } else { r.st = 'fail'; r.note = escP((d && d.error) || 'خطای سرور'); }
        k++;
        cmsSeoAiBatchRender();
        next();
      });
    }
    next();
  };

  window.cmsAiMeta = function (i) {
    var p = (window._cmsPages || [])[i];
    if (!p) return;
    var st = document.getElementById('csAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ هوش مصنوعی در حال بررسی صفحه…</span>';
    cmsPageText(p.path, function (txt) {
      cmsLLM('seo_meta', { topic: (p.title || '') + ' — ' + (p.h1 || ''), content: txt }, function (d) {
        if (st) st.innerHTML = '';
        if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
        var g = d.data;
        if (document.getElementById('csTitle').value.trim() && !confirm('عنوان و توضیح پیشنهادی جایگزین مقادیر فعلی شود؟')) return;
        cmsSetLen('csTitle', g.title); cmsSetLen('csDesc', g.desc); cmsSetLen('csH1', g.h1);
        cmsSeoCount();
        window._cmsAiTouched = true;
        var rvc = document.getElementById('csReviewed'); if (rvc) rvc.checked = false;
        if (st) st.innerHTML = '<span style="color:#059669">✅ پیشنهادها جای‌گذاری شد — پیش از ذخیره بازبینی کنید.' +
          (g.keywords ? ' واژگان: ' + escP([].concat(g.keywords).join('، ')) : '') + '</span>';
      });
    });
  };

  window.cmsAiFix = function (i) {
    var p = (window._cmsPages || [])[i];
    if (!p) return;
    var iss = (p.issues || []).join('، ');
    if (!iss) { alert('این صفحه ایراد گزارش‌شده‌ای ندارد ✅'); return; }
    var st = document.getElementById('csAiSt');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ هوش مصنوعی در حال تحلیل ' + escP(iss) + '…</span>';
    cmsPageText(p.path, function (txt) {
      cmsLLM('seo_fix', { issues: iss, content: txt }, function (d) {
        if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>'; return; }
        var g = d.data, h = '';
        (g.fixes || []).forEach(function (f) {
          h += '<div style="margin:6px 0;padding:7px 9px;background:#f8fafc;border-right:3px solid #f97316;border-radius:6px">' +
            '<b>' + escP(f.issue || '') + '</b><br>' + escP(f.action || '') + '</div>';
        });
        if (g.sections && g.sections.length) h += '<div style="margin-top:8px"><b>تیترهای پیشنهادی:</b><br>' + escP([].concat(g.sections).join(' · ')) + '</div>';
        if (g.links && g.links.length) {
          h += '<div style="margin-top:8px"><b>لینک داخلی پیشنهادی:</b><ul style="margin:4px 0 0 18px">';
          [].concat(g.links).forEach(function (l) { h += '<li>' + escP(l.anchor || '') + ' → <span style="direction:ltr">' + escP(l.target || '') + '</span></li>'; });
          h += '</ul></div>';
        }
        if (st) st.innerHTML = '<div style="margin-top:8px;max-height:220px;overflow:auto;font-size:12px;line-height:1.8">' + h + '</div>' +
          '<button class="bt bt-o" style="margin-top:6px" onclick="cmsAiApplyFix(' + i + ')">⬇️ جای‌گذاری عنوان/توضیح/H1 پیشنهادی</button>';
        window._cmsAiFix = g;
      });
    });
  };

  window.cmsAiApplyFix = function (i) {
    var g = window._cmsAiFix;
    if (!g) return;
    cmsSetLen('csTitle', g.title); cmsSetLen('csDesc', g.desc); cmsSetLen('csH1', g.h1);
    cmsSeoCount();
    window._cmsAiTouched = true;
    var rva = document.getElementById('csReviewed'); if (rva) rva.checked = false;
  };

  window.cmsSeoEdit = function (i) {
    window._cmsAiTouched = false;   /* خروجیِ AI هنوز تأییدِ انسانی نشده */
    var p = (window._cmsPages || [])[i];
    if (!p) return;
    var rob = p.robots || '';
    var robOpts = [['', 'پیش‌فرض (بدون تگ)'], ['index, follow', 'index, follow — ایندکس شود'],
      ['noindex, follow', 'noindex, follow — از ایندکس خارج شود'],
      ['noindex, nofollow', 'noindex, nofollow — کامل خارج شود']];
    var sel = robOpts.map(function (o) {
      return '<option value="' + escP(o[0]) + '"' + (rob === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    var info = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 10px;font-size:11.5px;color:#475569;margin-bottom:10px;line-height:1.9">' +
      'مسیر: <b style="direction:ltr">' + escP(p.path) + '</b><br>' +
      'واژگان: ' + (p.words || 0) + ' · حجم: ' + (p.size_kb || 0) + 'KB · ' + (p.sitemap ? 'در نقشهٔ سایت' : '<span style="color:#dc2626">خارج از نقشهٔ سایت</span>') + '<br>' +
      'schema: ' + escP(p.schema || 'ندارد') + '<br>' +
      (p.h1 ? 'H1 فعلی: ' + escP(p.h1.slice(0, 80)) : '<span style="color:#dc2626">H1 ندارد</span>') +
      '</div>';
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:640px;max-height:94vh;overflow:auto">' +
      '<h3>🔍 سئوی صفحه</h3>' + info +
      '<div class="fld"><label>عنوان (title) — در تب مرورگر و نتایج گوگل <span id="csTitleLen" style="font-size:11px"></span></label>' +
      '<input type="text" id="csTitle" value="' + escP(p.title) + '" oninput="cmsSeoCount()"></div>' +
      '<div class="fld"><label>توضیح (description) — زیر عنوان در گوگل <span id="csDescLen" style="font-size:11px"></span></label>' +
      '<textarea id="csDesc" rows="3" oninput="cmsSeoCount()">' + escP(p.desc) + '</textarea></div>' +
      '<div class="fld"><label>عنوان H1 — تیتر اصلی داخل صفحه <span id="csH1Len" style="font-size:11px"></span></label>' +
      '<input type="text" id="csH1" value="' + escP(p.h1 || '') + '" oninput="cmsSeoCount()"></div>' +
      '<div class="fld"><label>canonical — آدرس رسمی صفحه (خالی = تغییر نمی‌کند)</label>' +
      '<input type="text" id="csCan" value="' + escP(p.canonical) + '" style="direction:ltr" placeholder="https://pishtaj.ir/..."></div>' +
      '<div class="fld"><label>robots — وضعیت ایندکس</label><select id="csRob">' + sel + '</select></div>' +
      '<div id="csAiSt" style="font-size:12px;margin-top:6px;line-height:1.8"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
      '<button class="bt bt-o" onclick="cmsAiMeta(' + i + ')">✨ پیشنهاد عنوان/توضیح/H1 با AI</button>' +
      '<button class="bt bt-o" onclick="cmsAiFix(' + i + ')">🛠 رفع ایرادها با AI</button></div>' +
      '<div style="margin-top:8px;padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;cursor:pointer;margin:0">' +
      '<input type="checkbox" id="csReviewed" style="width:16px;height:16px;flex:0 0 auto">' +
      '<span>پیشنهادِ هوش مصنوعی را خواندم و تأیید می‌کنم — تا این تیک زده نشود ذخیره نمی‌شود</span></label></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">' +
      '<a class="bt bt-o" style="text-decoration:none" target="_blank" href="/' + escP(p.path) + '">مشاهده صفحه</a>' +
      '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsSeoSave(' + i + ')">🚀 اعمال روی سایت</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">پیش از ذخیره از فایل یک نسخهٔ پشتیبان در crm/data/cms-backups نگهداری می‌شود (۳ نسخهٔ آخر).</small>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    setTimeout(cmsSeoCount, 30);
  };

  window.cmsSeoSave = function (i) {
    var p = (window._cmsPages || [])[i];
    if (!p) { alert('صفحهٔ انتخاب‌شده در فهرست پیدا نشد — لطفاً فهرست را دوباره بارگذاری کنید'); return; }
    var title = document.getElementById('csTitle').value.trim();
    var desc = document.getElementById('csDesc').value.trim();
    var can = document.getElementById('csCan').value.trim();
    var rob = document.getElementById('csRob').value;
    if (!title) { alert('عنوان نمی‌تواند خالی باشد'); return; }
    if (!confirm('تغییرات سئو روی «' + p.path + '» اعمال شود؟')) return;
    /* دروازهٔ بازبینیِ انسانی: پیشنهادِ AI بدونِ تیکِ تأیید ذخیره نمی‌شود */
    if (window._cmsAiTouched) {
      var rv = document.getElementById('csReviewed');
      if (!rv || !rv.checked) {
        alert('⛔ این مقادیر را هوش مصنوعی پیشنهاد داده است.\nپیش از اعمال باید یک انسان آن‌ها را بخواند و تیکِ تأیید را بزند.');
        return;
      }
    }
    var h1v = (document.getElementById('csH1') || {}).value;
    h1v = h1v ? h1v.trim() : '';
    if (!h1v) { alert('عنوان H1 نمی‌تواند خالی باشد'); return; }
    api('page_meta_save', { file: p.path, title: title, desc: desc, canonical: can, robots: rob, h1: h1v }, function (d) {
      if (d.ok) {
        alert(d.changed ? '✅ اعمال شد — در سرچ کنسول می‌توانید Request Indexing بزنید.' : 'تغییری اعمال نشد (مقادیر یکسان بود)');
        audit('CMS', 'ویرایش سئوی ' + p.path, (p.issues || []).join(','));
        hideModal();
        cmsSeoRefresh();
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ============ روتینگ ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'cms') {
      if (!canCms()) { alert('⛔ مدیریت سایت فقط برای ادمین و رییس هیات مدیره است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '🎛 مدیریت سایت';
      _news = null;
      try {
        document.getElementById('panels').innerHTML = buildCms();
        renderCms();
      } catch (eCmsBuild) { /* v34.27.0: خطای ساخت پنل CMS دیگر پنل را خالی نمی‌گذارد */
        document.getElementById('panels').innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;font-size:13px;color:#b91c1c;line-height:2">⚠️ <b>خطای ساخت پنل مدیریت سایت:</b> ' + escP(eCmsBuild && eCmsBuild.message) + '<br><small>F12 ← Console جزئیات کامل را نشان می‌دهد؛ اگر بنر «کش قدیمی» بالا می‌بینید ابتدا کش را پاک کنید.</small></div>';
      }
      return;
    }
    _go(id, btn);
  };

  /* برچسبِ ماژولِ «مدیریت سایت» وقتی هر سه زیربخش پنهان باشند پنهان می‌شود.
     عمداً مجوزها را دوباره ارزیابی نمی‌کند بلکه نتیجهٔ display را می‌خواند،
     تا با canCms/canGsc/canJobs (که هرکدام در ماژولِ خودشان است) واگرا نشود. */
  function syncSiteModLabel() {
    var lab = document.getElementById('smLabel');
    if (!lab) return;
    var any = false;
    ['cms', 'gsc', 'jobs'].forEach(function (k) {
      document.querySelectorAll('.sb-i').forEach(function (b) {
        if ((b.getAttribute('onclick') || '').indexOf("'" + k + "'") > -1
            && b.style.display !== 'none') any = true;
      });
    });
    lab.style.display = any ? '' : 'none';
    var body = document.getElementById('smBody');
    if (body && !any) body.style.display = 'none';
  }
  window.syncSiteModLabel = syncSiteModLabel;

  /* v34.13.0 (BUGFIX/SITE-MOD): وضعیت باز/بستهٔ زیرمنوی «مدیریت سایت» از طریق لایهٔ
     داده (ptfDevKv — سازگار با A10) ماندگار می‌شود؛ قبلاً با هر بارگذاری صفحه
     می‌بست. همچنین والد وقتی فرزندی فعال است هایلایت و گروه یک‌بار خودکار باز
     می‌شود تا کاربر گم نشود. */
  var siteModOpen = false, siteModHydrated = false;
  try {
    if (window.ptfDevKv) window.ptfDevKv.get('cms.sitemod.open', function (v) {
      siteModHydrated = true;
      if (v === '1') toggleSiteMod(true);
    });
  } catch (eH2) {}
  window.toggleSiteMod = function (force) {
    var b = document.getElementById('smBody'), a = document.getElementById('smArrow');
    if (!b) return;
    var mobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches; /* موبایل: CSS همیشه باز نگه می‌دارد */
    siteModOpen = (typeof force === 'boolean') ? force : !siteModOpen;
    if (!mobile) b.style.display = siteModOpen ? '' : 'none';
    if (a) a.textContent = siteModOpen ? '\u25b4' : '\u25be';
    try { if (window.ptfDevKv && siteModHydrated) window.ptfDevKv.set('cms.sitemod.open', siteModOpen ? '1' : '0'); } catch (eS2) {}
  };
  /* هایلایت والد + بازشدن یک‌باره وقتی فرزند فعال است (delegation — بدون interval) */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#smBody .sb-i')) setTimeout(syncSiteModLabel, 0);
  }, false);
  window.syncSiteModActive = function () {
    var lab = document.getElementById('smLabel');
    if (!lab) return;
    var act = false;
    document.querySelectorAll('#smBody .sb-i').forEach(function (b) { if (b.classList.contains('act')) act = true; });
    if (act) { lab.classList.add('act'); if (!siteModOpen) toggleSiteMod(true); }
    else lab.classList.remove('act');
  };
  var _syncSm = syncSiteModLabel;
  syncSiteModLabel = function () { _syncSm(); window.syncSiteModActive(); };
  window.syncSiteModLabel = syncSiteModLabel;

  function hideCmsBtn() {
    document.querySelectorAll('.sb-i').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'cms'") > -1) b.style.display = canCms() ? '' : 'none';
    });
    /* gsc.js و careers.js هم‌زمان و مستقل آیتمِ خودشان را پنهان می‌کنند؛
     با کمی تأخیر اجرا می‌شود تا نتیجهٔ نهاییِ هر سه خوانده شود */
    setTimeout(syncSiteModLabel, 250);
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { hideCmsBtn(); clearInterval(t); }
    if (tries > 40) clearInterval(t);
  }, 300);
  var _showCrm = window.showCrm;
  if (_showCrm) { window.showCrm = function () { _showCrm(); setTimeout(hideCmsBtn, 400); }; }

  /* ═══ v34.27.0 (STALE-CACHE): تشخیص cms.js کش‌شدهٔ قدیمی — علت «تب‌های خالی» ═══
     سرویس‌ورکرِ CRM دارایی‌ها را SWR نگه می‌دارد؛ اگر مرورگر cms.js قدیمی داشته باشد
     ولی پوسته جدید باشد، تب‌ها بدون هیچ پیامی خالی می‌مانند. اینجا ناهماهنگی آشکار
     و دکمهٔ پاک‌سازی کش داده می‌شود. */
  window.cmsCachePurge = function () {
    try {
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }).then(function () { setTimeout(function () { location.reload(true); }, 600); });
      else setTimeout(function () { location.reload(true); }, 600);
    } catch (eP) { location.reload(true); }
  };
  setTimeout(function () {
    try {
      if (window.VER && window.PTF_CMS_JS_VER && window.VER !== window.PTF_CMS_JS_VER) {
        var b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#7f1d1d;color:#fff;font:13px/1.9 inherit;padding:10px 16px;text-align:center';
        b.innerHTML = '⚠️ فایل برنامهٔ مدیریت سایت در مرورگر شما قدیمی است (کش: ' + escP(window.PTF_CMS_JS_VER) + ' · سرور: ' + escP(window.VER) + ') — علت احتمالی تب‌های خالی. ' +
          '<button class="bt" style="padding:4px 14px;font-size:12px;margin-right:8px" onclick="cmsCachePurge()">🧹 پاک‌سازی کش و بارگذاری مجدد</button>';
        document.body.appendChild(b);
      }
    } catch (eV) {}
  }, 1500);
})();
