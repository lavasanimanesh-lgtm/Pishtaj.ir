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
  function cmsAuthHeaders() { var h = { 'X-CRM-Role': curRole() }; try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; }
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

  /* ============ AC3: سئوی صفحات ============ */
  function renderCmsSeo(el) {
    el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:14px">در حال بارگذاری صفحات...</div>';
    api('page_list', null, function (d) {
      if (!d.ok) { el.innerHTML = '<div style="color:#dc2626;padding:10px">' + escP(d.error || '') + '</div>'; return; }
      window._cmsPages = d.pages || [];
      el.innerHTML = '<div style="font-size:12px;color:#64748b;margin-bottom:8px">ویرایش عنوان (title) و توضیح (description) صفحات اصلی — مستقیم روی سایت اعمال می‌شود.</div>' +
        _cmsPages.map(function (p, i) {
          return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:9px 12px;margin-bottom:5px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<span style="font-size:12.5px;flex:1"><b>' + escP(p.path) + '</b><br><small style="color:#64748b">' + escP((p.title || '').slice(0, 80)) + '</small></span>' +
            '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="cmsSeoEdit(' + i + ')">✏️ ویرایش</button></div>';
        }).join('');
    });
  }

  window.cmsSeoEdit = function (i) {
    var p = window._cmsPages[i];
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:600px">' +
      '<h3>🔍 سئوی صفحه: ' + escP(p.path) + '</h3>' +
      '<div class="fld"><label>عنوان (title) — در تب مرورگر و نتایج گوگل</label><input type="text" id="csTitle" value="' + escP(p.title) + '"></div>' +
      '<div class="fld"><label>توضیح (description) — زیر عنوان در گوگل</label><textarea id="csDesc" rows="3">' + escP(p.desc) + '</textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="cmsSeoSave(' + i + ')">🚀 اعمال روی سایت</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.cmsSeoSave = function (i) {
    var p = window._cmsPages[i];
    api('page_meta_save', {
      file: p.file,
      title: document.getElementById('csTitle').value.trim(),
      desc: document.getElementById('csDesc').value.trim()
    }, function (d) {
      if (d.ok) { alert('✅ اعمال شد'); audit('CMS', 'ویرایش سئوی ' + p.file, ''); hideModal(); renderCms(); }
      else alert('⚠️ ' + (d.error || ''));
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
