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
      '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">' + tb('news', '📰 اخبار') + tb('blog', '📝 وبلاگ') + tb('seo', '🔍 سئوی صفحات') + '</div>' +
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
    el.innerHTML = '<div class="sb2" style="margin-bottom:10px"><button class="bt" onclick="cmsBlogNew()">+ مقاله جدید</button></div><div id="cmsBlogList" style="max-height:420px;overflow:auto"><div style="color:#94a3b8;text-align:center;padding:14px">در حال بارگذاری...</div></div>';
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

  window.cmsBlogNew = function () {
    var catOpts = BLOG_CATS.map(function (c) { return '<option value="' + c.v + '">' + c.lb + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن بدون ذخیره؟\'))hideModal()"><div class="md" style="max-width:760px;max-height:94vh;overflow:auto">' +
      '<h3>📝 مقاله جدید وبلاگ</h3>' +
      '<div class="fld"><label>عنوان مقاله *</label><input type="text" id="cbTitle" placeholder="مثال: راهنمای انتخاب گسکت اسپیرال وند"></div>' +
      '<div class="fr"><div class="fld"><label>نامک انگلیسی (slug — آدرس صفحه) *</label><input type="text" id="cbSlug" placeholder="spiral-wound-gasket-guide" style="direction:ltr"></div>' +
      '<div class="fld"><label>دسته</label><select id="cbCat">' + catOpts + '</select></div></div>' +
      '<div class="fld"><label>خلاصه (متا — برای گوگل، حداکثر ۳۰۰ حرف) *</label><textarea id="cbDesc" rows="2"></textarea></div>' +
      '<div class="fld"><label>متن کامل مقاله * <small style="color:#94a3b8">(می‌توانید تیتر را با ## در ابتدای خط بنویسید — خودکار H2 می‌شود)</small></label>' +
      '<textarea id="cbBody" rows="14" style="line-height:1.9"></textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsBlogPublish()">🚀 انتشار مقاله روی سایت</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">صفحه با قالب استاندارد سایت (هدر/فوتر/سئو/Schema) ساخته و به فهرست وبلاگ و sitemap اضافه می‌شود.</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
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

  window.cmsBlogPublish = function () {
    var title = document.getElementById('cbTitle').value.trim();
    var slug = document.getElementById('cbSlug').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var desc = document.getElementById('cbDesc').value.trim();
    var catV = document.getElementById('cbCat').value;
    var catLb = BLOG_CATS.filter(function (c) { return c.v === catV; })[0].lb;
    var bodyRaw = document.getElementById('cbBody').value;
    if (!title || !slug || !desc || bodyRaw.trim().length < 100) { alert('همه فیلدها الزامی است (متن حداقل ۱۰۰ حرف)'); return; }
    var body = cmsMdToHtml(bodyRaw);
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
      } else if (d.error === 'exists') {
        if (confirm('صفحه‌ای با این نامک وجود دارد — بازنویسی شود؟')) {
          api('blog_create', { title: title, slug: slug, desc: desc, cat: catV, catLb: catLb, body: body, dateFa: new Date().toLocaleDateString('fa-IR'), overwrite: 1 }, function (d2) {
            if (d2.ok) { alert('✅ بازنویسی شد'); hideModal(); renderCms(); }
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
    'no-schema': ['بدون schema', 'warn']
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
        '</div></div>' +
        (badges ? '<div style="margin-top:5px">' + badges + '</div>' : '<div style="margin-top:5px"><span style="font-size:10.5px;color:#059669">✅ بدون ایراد</span></div>') +
        '</div>';
    }).join('');
  }

  function renderCmsSeo(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال اسکن صفحات سایت…</div>';
    seoLoad(function () {
      var list = window._cmsPages || [];
      el.innerHTML = seoStatsBar() + seoToolbar() +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">نمایش ' + list.length + ' از ' + _seoMeta.matched + ' صفحهٔ منطبق (مرتب‌شده: پر‌ایرادترین اول)</div>' +
        '<div id="seoList" style="max-height:520px;overflow:auto">' + seoRows() + '</div>' +
        (list.length < _seoMeta.matched ? '<div style="text-align:center;margin-top:8px"><button class="bt bt-o" onclick="cmsSeoMore()">نمایش بیشتر (۶۰ تای بعدی)</button></div>' : '') +
        '<div style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.9">' +
        'طول مناسب: عنوان ۳۰–۶۵ کاراکتر · توضیح ۷۰–۱۶۵ کاراکتر. تغییرات مستقیماً روی فایل سایت اعمال می‌شود؛ ' +
        'برای ثبت سریع‌تر در گوگل، صفحه را در سرچ کنسول «Request Indexing» بزنید.' +
        '</div>';
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
  };

  window.cmsSeoEdit = function (i) {
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
      '<div class="fld"><label>canonical — آدرس رسمی صفحه (خالی = تغییر نمی‌کند)</label>' +
      '<input type="text" id="csCan" value="' + escP(p.canonical) + '" style="direction:ltr" placeholder="https://pishtaj.ir/..."></div>' +
      '<div class="fld"><label>robots — وضعیت ایندکس</label><select id="csRob">' + sel + '</select></div>' +
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
    if (!p) return;
    var title = document.getElementById('csTitle').value.trim();
    var desc = document.getElementById('csDesc').value.trim();
    var can = document.getElementById('csCan').value.trim();
    var rob = document.getElementById('csRob').value;
    if (!title) { alert('عنوان نمی‌تواند خالی باشد'); return; }
    if (!confirm('تغییرات سئو روی «' + p.path + '» اعمال شود؟')) return;
    api('page_meta_save', { file: p.path, title: title, desc: desc, canonical: can, robots: rob }, function (d) {
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

  function hideCmsBtn() {
    document.querySelectorAll('.sb-i').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'cms'") > -1) b.style.display = canCms() ? '' : 'none';
    });
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
