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
      '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">' + tb('news', '📰 اخبار') + tb('blog', '📝 وبلاگ') + tb('prod', '🛒 محصولات') + tb('page', '📄 صفحهٔ جدید') + tb('seo', '🔍 سئوی صفحات') + '</div>' +
      '<div id="cmsWrap"></div>';
  };
  window.cmsTab = function (t) { _tab = t; goPanelByName('cms'); };

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
    if (_tab === 'news') renderCmsNews(el);
    else if (_tab === 'blog') renderCmsBlog(el);
    else if (_tab === 'prod') renderCmsProducts(el); /* v34.11.0 (S2) */
    else if (_tab === 'page') renderCmsPageNew(el); /* v34.13.0 (S2-id) */
    else renderCmsSeo(el);
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
        alert('✅ مقاله منتشر شد:\npishtaj.ir/' + d.url + (d.listed ? '\n(به فهرستِ مرکز دانش هم اضافه شد)' : '\n⚠️ به فهرستِ مرکز دانش اضافه نشد — دستی اضافه کنید'));
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
        alert('✅ مقاله منتشر شد:\npishtaj.ir/' + d.url + '\n\n(به فهرست وبلاگ و sitemap هم اضافه شد)');
        audit('CMS', 'انتشار مقاله: ' + title, slug);
        hideModal();
        renderCms();
        cmsDraftClear(CB_FIELDS); cmsSitemapAfterPublish(); /* v34.10.0 (S1): پیش‌نویس پاک + نقشه خودکار */
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک وجود دارد — بازنویسی شود؟')) {
          api('blog_create', { title: title, slug: slug, desc: desc, cat: catV, catLb: catLb, body: body, dateFa: new Date().toLocaleDateString('fa-IR'), overwrite: 1 }, function (d2) {
            if (d2.ok) { alert('✅ بازنویسی شد'); hideModal(); renderCms(); cmsDraftClear(CB_FIELDS); cmsSitemapAfterPublish(); }
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

  function renderCmsSeo(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال اسکن صفحات سایت…</div>';
    seoLoad(function () {
      var list = window._cmsPages || [];
      el.innerHTML = seoStatsBar() + seoToolbar() + seoQueueBox() + cmsRedirectBox() +
        '<div id="seoDrift"></div>' +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">نمایش ' + list.length + ' از ' + _seoMeta.matched + ' صفحهٔ منطبق (مرتب‌شده: پر‌ایرادترین اول)</div>' +
        '<div id="seoList" style="max-height:520px;overflow:auto">' + seoRows() + '</div>' +
        (list.length < _seoMeta.matched ? '<div style="text-align:center;margin-top:8px"><button class="bt bt-o" onclick="cmsSeoMore()">نمایش بیشتر (۶۰ تای بعدی)</button></div>' : '') +
        '<div style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.9">' +
        'طول مناسب: عنوان ۳۰–۶۵ کاراکتر · توضیح ۷۰–۱۶۵ کاراکتر. تغییرات مستقیماً روی فایل سایت اعمال می‌شود؛ ' +
        'برای ثبت سریع‌تر در گوگل، صفحه را در سرچ کنسول «Request Indexing» بزنید.' +
        '</div>';
      if (typeof cmsRedirectLoad === 'function') cmsRedirectLoad(); /* v34.11.0 (S2) */
    });
  }

  /* ═══ v34.13.0 (S2-id/GENERIC-PAGE): مولد صفحهٔ عمومی — خدمات/صنایع/مقایسه‌ها ═══ */
  var PAGE_FOLDERS = [
    { v: 'services', lb: 'خدمات (Service schema)' },
    { v: 'industries', lb: 'صنایع' },
    { v: 'comparisons', lb: 'مقایسهٔ محصولات' }
  ];
  var PAGE_FIELDS = ['pgTitle', 'pgSlug', 'pgH1', 'pgDesc', 'pgBody', 'pgImg'];

  function renderCmsPageNew(el) {
    var opts = PAGE_FOLDERS.map(function (f) { return '<option value="' + f.v + '">' + f.lb + '</option>'; }).join('');
    el.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:14px;font-size:12px;color:#475569;line-height:2;margin-bottom:10px">' +
      'مولد صفحهٔ عمومی سایت برای بخش‌های <b>خدمات / صنایع / مقایسه‌ها</b>: متن یگانه با هوش مصنوعی (مثل مرکز دانش) + اسکیمای مناسبِ هر بخش + افزودن خودکار به نقشهٔ سایت و ثبت در سرچ کنسول.</div>' +
      '<div class="pn" style="padding:14px;border:1px solid var(--brd);border-radius:12px">' +
      '<div id="pgAiSt" style="font-size:11.5px;color:#6b21a8;margin-bottom:8px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>بخش مقصد *</label><select id="pgFolder">' + opts + '</select></div>' +
      '<div class="fld"><label>نامک (slug) * <small style="color:#94a3b8">a-z و خط تیره</small></label><input type="text" id="pgSlug" dir="ltr" placeholder="valve-maintenance-services"></div>' +
      '<div class="fld"><label>عنوان یا موضوع برای AI *</label><input type="text" id="pgTopic" placeholder="مثلاً: خدمات تعمیر و کالیبراسیون شیرآلات صنعتی"></div>' +
      '<div class="fld"><label>مخاطب</label><input type="text" id="pgAud" value="کارشناس خرید و مهندس نگهداری و تعمیر"></div>' +
      '</div>' +
      '<div style="display:flex;gap:7px;margin:10px 0"><button class="bt" style="background:#7c3aed" onclick="cmsPageAi()">🤖 تولید با هوش مصنوعی</button></div>' +
      '<div class="fld"><label>عنوان سئو (title) <span id="pgTitleLen" style="font-size:11px"></span></label><input type="text" id="pgTitle"></div>' +
      '<div class="fld"><label>H1</label><input type="text" id="pgH1"></div>' +
      '<div class="fld"><label>توضیح (description) <span id="pgDescLen" style="font-size:11px"></span></label><textarea id="pgDesc" rows="2"></textarea></div>' +
      '<div class="fld"><label>متن صفحه (HTML سبک — حداقل ۲۰۰ حرف)</label><textarea id="pgBody" rows="10"></textarea></div>' +
      '<div class="fld"><label>تصویر (مسیر از ریشهٔ سایت)</label><input type="text" id="pgImg" dir="ltr" value="assets/images/ptf-logo.png"></div>' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;color:#374151;margin:8px 0"><input type="checkbox" id="pgReviewed"> ⛔ بازبینی انسانی انجام شد (الزامی)</label>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end"><button class="bt" onclick="cmsPagePublish()">🚀 انتشار صفحه</button></div>' +
      '</div>';
    cmsDraftRestore(PAGE_FIELDS, 'pgAiSt'); cmsDraftBind(PAGE_FIELDS);
  }

  window.cmsPageAi = function () {
    var topic = (document.getElementById('pgTopic').value || '').trim();
    if (!topic) { alert('موضوع را بنویسید'); return; }
    var st = document.getElementById('pgAiSt');
    if (st) st.innerHTML = '⏳ هوش مصنوعی در حال تولید محتوا… (متن بلند — چند لحظه)';
    cmsLLM('seo_article', { topic: topic, aud: (document.getElementById('pgAud').value || '').trim() }, function (d) {
      if (!d.ok || !d.data) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'خطا') + '</span>'; return; }
      var v = d.data;
      var g = function (id) { return document.getElementById(id); };
      if (v.title && !g('pgTitle').value) g('pgTitle').value = v.title;
      if (v.slug && !g('pgSlug').value) g('pgSlug').value = v.slug;
      if (v.h1 && !g('pgH1').value) g('pgH1').value = v.h1;
      if (v.desc && !g('pgDesc').value) g('pgDesc').value = v.desc;
      if (v.body && !g('pgBody').value.trim()) g('pgBody').value = v.body;
      if (st) st.innerHTML = '✅ پیش‌نویس تولید شد — <b>بازبینی انسانی الزامی است.</b>';
    });
  };

  window.cmsPagePublish = function () {
    var g = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var folder = g('pgFolder'), title = g('pgTitle').trim(), slug = g('pgSlug').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
        alert('✅ صفحه منتشر شد:\npishtaj.ir/' + d.url);
        if (typeof renderCms === 'function') renderCms(document.getElementById('cmsWrap'));
        cmsSitemapAfterPublish();
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک هست — بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('page_create', payload, function (d2) {
            if (d2.ok) { cmsDraftClear(PAGE_FIELDS); alert('✅ بازنویسی شد'); cmsSitemapAfterPublish(); }
            else alert('⚠️ ' + (d2.error || ''));
          });
        }
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  /* ═══ v34.11.0 (S2/PRODUCT): تب محصولات — مولد صفحهٔ محصول از دیتای CRM ═══ */
  var _prodSite = null; /* نقشهٔ cd → {slug,title,mtime} از سرور */
  var PROD_FIELDS = ['prTitle', 'prSlug', 'prH1', 'prDesc', 'prBrand', 'prImg', 'prBody', 'prSpecs', 'prFaq'];

  function renderCmsProducts(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال دریافت وضعیت صفحات محصول…</div>';
    api('product_list', {}, function (d) {
      _prodSite = {};
      (d && d.ok && d.products || []).forEach(function (w) { if (w.cd) _prodSite[w.cd] = w; });
      var prds = [];
      try { prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || []; } catch (eP) {}
      if (!prds.length) { el.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:14px;font-size:12.5px;color:#475569">هنوز کالایی در CRM ثبت نشده است — از پنل «کالاها» کالا ثبت کنید تا صفحهٔ سایتش را بسازید.</div>'; return; }
      var h = '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">کل کالاها: <b>' + prds.length + '</b> · دارای صفحهٔ سایت: <b style="color:#059669">' + Object.keys(_prodSite).length + '</b> — برای هر کالا یک صفحهٔ سئوشده با اسکیمای Product/FAQ ساخته می‌شود (متن یگانه با AI + بازبینی انسانی).</div>';
      h += '<div style="max-height:520px;overflow:auto"><table class="tb"><thead><tr><th>کالا</th><th>برند/مدل</th><th>کد</th><th>صفحهٔ سایت</th><th></th></tr></thead><tbody>';
      prds.slice(0, 200).forEach(function (r) {
        var site = _prodSite[r.cd] || null;
        h += '<tr><td><b>' + escP((r.nm || '').slice(0, 60)) + '</b>' + (r.en ? '<br><small dir="ltr" style="color:#64748b">' + escP(r.en.slice(0, 50)) + '</small>' : '') + '</td>' +
          '<td>' + escP(r.br || '—') + (r.md ? '<br><small dir="ltr">' + escP(r.md) + '</small>' : '') + '</td>' +
          '<td dir="ltr" style="font-size:11px">' + escP(r.cd || '') + '</td>' +
          '<td>' + (site ? '<a href="/products/' + escP(site.slug) + '.html" target="_blank" rel="noopener" style="color:#059669;text-decoration:none">products/' + escP(site.slug) + '.html ↗</a><br><small style="color:#94a3b8">' + escP(site.mtime || '') + '</small>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
          '<td><button class="bt" style="padding:4px 10px;font-size:11.5px;' + (site ? '' : 'background:#059669') + '" onclick="cmsProdForm(\'' + ptfOnClickArg(r.cd) + '\')">' + (site ? '🔁 بازنویسی' : '🌍 ساخت صفحه') + '</button></td></tr>';
      });
      h += '</tbody></table></div>';
      el.innerHTML = h;
    });
  }

  window.cmsProdForm = function (cd) {
    var prds = (typeof getData === 'function' ? getData('ptf_crm_products') : []) || [];
    var r = prds.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var specsPre = [['نام', r.nm || ''], ['نام انگلیسی', r.en || ''], ['برند', r.br || ''], ['مدل', r.md || ''], ['استاندارد', r.st || ''], ['واحد', r.un || '']].filter(function (x) { return x[1]; })
      .map(function (x) { return x[0] + ' = ' + x[1]; }).join('\n');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:780px;max-height:94vh;overflow:auto">' +
      '<h3>🛒 صفحهٔ محصول — ' + escP((r.nm || '').slice(0, 50)) + ' <small dir="ltr" style="color:#94a3b8">' + escP(r.cd) + '</small></h3>' +
      '<div id="prAiSt" style="font-size:11.5px;color:#6b21a8;margin-bottom:8px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>عنوان سئو (title) <span id="prTitleLen" style="font-size:11px"></span></label><input type="text" id="prTitle"></div>' +
      '<div class="fld"><label>نامک (slug) <small style="color:#94a3b8">a-z و خط تیره</small></label><input type="text" id="prSlug" dir="ltr" placeholder="ball-valve-astm-a105"></div>' +
      '<div class="fld"><label>H1</label><input type="text" id="prH1"></div>' +
      '<div class="fld"><label>برند (برای اسکیما)</label><input type="text" id="prBrand" value="' + escP(r.br || '') + '"></div>' +
      '</div>' +
      '<div class="fld"><label>توضیح (description) <span id="prDescLen" style="font-size:11px"></span></label><textarea id="prDesc" rows="2"></textarea></div>' +
      '<div class="fld"><label>متن صفحه (HTML سبک: h2/h3/p/ul/li — حداقل ۲۰۰ حرف)</label><textarea id="prBody" rows="9" placeholder="<h2>معرفی ...</h2><p>...</p>"></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div class="fld"><label>مشخصات (هر خط: کلید = مقدار)</label><textarea id="prSpecs" rows="6">' + escP(specsPre) + '</textarea></div>' +
      '<div class="fld"><label>سوالات متداول (هر خط: سؤال | پاسخ)</label><textarea id="prFaq" rows="6"></textarea></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
      '<div class="fld"><label>قیمت (اختیاری — برای اسکیمای Offer)</label><input type="text" id="prPrice" dir="ltr" value="' + (r.pr || '') + '"></div>' +
      '<div class="fld"><label>ارز</label><select id="prCur"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option></select></div>' +
      '<div class="fld"><label>موجود</label><select id="prStock"><option value="1">بله</option><option value="">خیر/استعلامی</option></select></div>' +
      '</div>' +
      '<div class="fld"><label>تصویر (مسیر از ریشهٔ سایت)</label><input type="text" id="prImg" dir="ltr" value="assets/images/ptf-logo.png"></div>' +
      '<label style="display:flex;gap:7px;align-items:center;font-size:12px;color:#374151;margin:8px 0"><input type="checkbox" id="prReviewed"> ⛔ بازبینی انسانی انجام شد — متن و اعداد فنی را خوانده‌ام (الزامی)</label>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" style="color:#6b21a8" onclick="cmsProdAi(\'' + ptfOnClickArg(cd) + '\')">🤖 تولید با هوش مصنوعی</button>' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsProdPublish(\'' + ptfOnClickArg(cd) + '\')">🚀 انتشار صفحهٔ محصول</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">صفحه در products/&lt;slug&gt;.html با اسکیمای Product/Offer/Breadcrumb/FAQ ساخته می‌شود؛ به نقشهٔ سایت (sitemap-products.xml) اضافه و در سرچ کنسول ثبت می‌گردد.</small>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    cmsDraftRestore(PROD_FIELDS, 'prAiSt'); cmsDraftBind(PROD_FIELDS); /* v34.11.0: پیش‌نویس ماندگار */
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
        alert('✅ صفحه منتشر شد:\npishtaj.ir/' + d.url);
        cmsSitemapAfterPublish(); /* v34.11.0: ثبت خودکار نقشه */
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک هست — بازنویسی شود؟')) {
          payload.overwrite = 1;
          api('product_create', payload, function (d2) {
            if (d2.ok) { cmsDraftClear(PROD_FIELDS); hideModal(); renderCms(); alert('✅ بازنویسی شد'); cmsSitemapAfterPublish(); }
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
        h += '<div style="max-height:160px;overflow:auto;margin-top:8px"><table class="tb" style="font-size:11.5px"><thead><tr><th>مبدأ</th><th>مقصد</th><th>تاریخ</th><th></th></tr></thead><tbody>';
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
      '<table class="tb" style="font-size:11.5px"><thead><tr><th></th><th>صفحه</th><th>عنوان (قدیم → جدید)</th><th>توضیح جدید</th></tr></thead><tbody>';
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
  function cmsLLM(action, body, cb) {
    var h = cmsAuthHeaders();
    h['Content-Type'] = 'application/json';
    fetch('../api/llm.php?action=' + action, { method: 'POST', headers: h, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'عدم دسترسی به هوش مصنوعی' }); });
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
      document.getElementById('panels').innerHTML = buildCms();
      renderCms();
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
})();
