/* =====================================================================
   PTF CRM — v34.7.50 فرصت شغلی
   دسترسی: فقط admin / chairman / ceo
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/careers.php';
  var JOB_ROLES = ['admin', 'chairman', 'ceo'];
  function canJobs() { return JOB_ROLES.indexOf(curRole()) > -1; }
  function jobsAuthHeaders() {
    var h = {};
    try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    return h;
  }
  function api(action, data, cb) {
    var opt = { method: 'POST', headers: jobsAuthHeaders() };
    if (data) {
      var fd = new FormData();
      Object.keys(data).forEach(function (k) { if (data[k] != null) fd.append(k, data[k]); });
      opt.body = fd;
    }
    fetch(API + '?action=' + action, opt).then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور' }); });
  }

  var EDU = [
    { v: 'diploma', lb: 'دیپلم' }, { v: 'associate', lb: 'کاردانی' },
    { v: 'bachelor', lb: 'کارشناسی' }, { v: 'master', lb: 'کارشناسی ارشد' }, { v: 'phd', lb: 'دکتری' }
  ];
  var EXP = [
    { v: 'lt1', lb: 'کمتر از ۱ سال' }, { v: 'y1_3', lb: '۱ تا ۳ سال' }, { v: 'y3_5', lb: '۳ تا ۵ سال' },
    { v: 'y5_10', lb: '۵ تا ۱۰ سال' }, { v: 'gt10', lb: 'بیش از ۱۰ سال' }
  ];
  var SAL = [
    { v: '15_20', lb: '۱۵ تا ۲۰ میلیون' }, { v: '20_25', lb: '۲۰ تا ۲۵ میلیون' },
    { v: '25_30', lb: '۲۵ تا ۳۰ میلیون' }, { v: 'gt30', lb: 'مثبت ۳۰ میلیون' }, { v: 'other', lb: 'سایر' }
  ];
  function lbOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i].lb;
    return v || '-';
  }

  var _tab = 'jobs';
  var _jobs = [];
  var _apps = [];

  window.buildJobs = function () {
    function tb(id, lb) {
      var on = _tab === id;
      return '<button type="button" onclick="jobsTab(\'' + id + '\')" style="border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;' +
        (on ? 'background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff' : 'background:#f1f5f9;color:#475569') + '">' + lb + '</button>';
    }
    return '<div class="ph"><h3>💼 فرصت شغلی</h3></div>' +
      '<div id="jobsStatus" style="margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">' + tb('jobs', 'آگهی‌ها') + tb('apps', 'درخواست‌ها') + '</div>' +
      '<div id="jobsWrap"></div>';
  };
  window.jobsTab = function (t) { _tab = t; goPanelByName('jobs'); };

  window.renderJobs = function () {
    var el = document.getElementById('jobsWrap');
    if (!el) return;
    if (_tab === 'apps') renderApps(el);
    else renderJobList(el);
  };

  function renderJobList(el) {
    el.innerHTML = '<div class="sb2" style="margin-bottom:10px"><button class="bt" onclick="jobsAdd()">+ آگهی جدید</button></div>' +
      '<div id="jobsList"><div style="color:#94a3b8;text-align:center;padding:14px">در حال بارگذاری...</div></div>';
    api('list_jobs', null, function (d) {
      var box = document.getElementById('jobsList');
      if (!box) return;
      if (!d.ok) { box.innerHTML = '<div style="color:#dc2626;padding:10px">' + escP(d.error || '') + '</div>'; return; }
      _jobs = d.jobs || [];
      box.innerHTML = _jobs.map(function (j, i) {
        var open = !!j.published;
        return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<span style="font-size:13px;flex:1"><b>' + escP(j.titleFa) + '</b> <small style="color:#64748b;direction:ltr">' + escP(j.titleEn) + '</small><br>' +
          '<small style="color:#94a3b8;direction:ltr">' + escP(j.slug) + '</small> ' +
          (open ? '<span class="bd" style="background:#ecfdf5;color:#047857">منتشر</span>' : '<span class="bd" style="background:#f1f5f9;color:#94a3b8">بسته</span>') +
          '</span><span style="display:flex;gap:4px;flex-wrap:wrap">' +
          '<a class="bt bt-o" style="padding:4px 9px;font-size:12px;text-decoration:none" target="_blank" href="../careers/' + escP(j.slug) + '/">👁️</a>' +
          '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="jobsEdit(' + i + ')">✏️</button>' +
          (open
            ? '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#b45309" onclick="jobsClose(\'' + ptfOnClickArg(j.slug) + '\')">برداشتن</button>'
            : '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#047857" onclick="jobsReopen(\'' + ptfOnClickArg(j.slug) + '\')">انتشار مجدد</button>') +
          '</span></div>';
      }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px">آگهی‌ای نیست — با انتشار اولین آگهی دکمه «فرصت شغلی» در منوی سایت ظاهر می‌شود.</div>';
    });
  }

  window.jobsAdd = function () { jobsForm(null); };
  window.jobsEdit = function (i) { jobsForm(_jobs[i] || null); };

  function jobsForm(j) {
    j = j || { slug: '', titleFa: '', titleEn: '', bodyFa: '', bodyEn: '', dept: '', location: '', published: true };
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:720px;max-height:94vh;overflow:auto">' +
      '<h3>' + (j.slug ? '✏️ ویرایش آگهی' : '💼 آگهی جدید') + '</h3>' +
      '<div class="fr"><div class="fld"><label>عنوان فارسی *</label><input type="text" id="cjTitleFa" value="' + escP(j.titleFa) + '"></div>' +
      '<div class="fld"><label>عنوان انگلیسی *</label><input type="text" id="cjTitleEn" value="' + escP(j.titleEn) + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>نامک انگلیسی (slug) *</label><input type="text" id="cjSlug" value="' + escP(j.slug) + '" ' + (j.slug ? 'readonly style="background:#f1f5f9;direction:ltr"' : 'placeholder="sales-expert" style="direction:ltr"') + '></div>' +
      '<div class="fld"><label>واحد / محل (اختیاری)</label><input type="text" id="cjDept" value="' + escP(j.dept || '') + '" placeholder="واحد بازرگانی"><input type="text" id="cjLoc" value="' + escP(j.location || '') + '" placeholder="تهران" style="margin-top:6px"></div></div>' +
      '<div class="fld"><label>شرح فارسی *</label><textarea id="cjBodyFa" rows="6">' + escP(j.bodyFa || '') + '</textarea></div>' +
      '<div class="fld"><label>شرح انگلیسی *</label><textarea id="cjBodyEn" rows="6" style="direction:ltr">' + escP(j.bodyEn || '') + '</textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="jobsSave()">🚀 انتشار / ذخیره</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">برداشتن آگهی فقط انتشار را می‌بندد؛ تاریخچه رزومه‌ها حفظ می‌شود و بعد از ۶ ماه پاک می‌شود.</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  }

  window.jobsSave = function () {
    var rec = {
      titleFa: document.getElementById('cjTitleFa').value.trim(),
      titleEn: document.getElementById('cjTitleEn').value.trim(),
      slug: document.getElementById('cjSlug').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      bodyFa: document.getElementById('cjBodyFa').value.trim(),
      bodyEn: document.getElementById('cjBodyEn').value.trim(),
      dept: document.getElementById('cjDept').value.trim(),
      location: document.getElementById('cjLoc').value.trim(),
      published: '1'
    };
    if (!rec.titleFa || !rec.titleEn || !rec.slug || !rec.bodyFa || !rec.bodyEn) { alert('عنوان، نامک و متن فارسی و انگلیسی الزامی است'); return; }
    api('save_job', rec, function (d) {
      if (d.ok) {
        alert('✅ آگهی روی سایت منتشر شد:\npishtaj.ir/' + d.url);
        if (typeof audit === 'function') audit('فرصت شغلی', 'انتشار آگهی ' + rec.titleFa, rec.slug);
        hideModal();
        renderJobs();
      } else alert('⚠️ ' + (d.error || 'خطا'));
    });
  };

  window.jobsClose = function (slug) {
    if (!confirm('آگهی برداشته شود؟ صفحه بسته می‌شود ولی رزومه‌ها حذف نمی‌شوند و دکمه منوی سایت در صورت نبود آگهی دیگر ناپدید می‌شود.')) return;
    api('close_job', { slug: slug }, function (d) {
      if (d.ok) { if (typeof audit === 'function') audit('فرصت شغلی', 'بستن آگهی', slug); renderJobs(); }
      else alert('⚠️ ' + (d.error || ''));
    });
  };
  window.jobsReopen = function (slug) {
    api('reopen_job', { slug: slug }, function (d) {
      if (d.ok) { if (typeof audit === 'function') audit('فرصت شغلی', 'انتشار مجدد', slug); renderJobs(); }
      else alert('⚠️ ' + (d.error || ''));
    });
  };

  function renderApps(el) {
    el.innerHTML = '<div style="font-size:12px;color:#64748b;margin-bottom:8px">رزومه‌های قدیمی‌تر از ۶ ماه هنگام مشاهده پاک می‌شوند.</div><div id="jobsApps"><div style="color:#94a3b8;text-align:center;padding:14px">در حال بارگذاری...</div></div>';
    api('list_apps', null, function (d) {
      var box = document.getElementById('jobsApps');
      if (!box) return;
      if (!d.ok) { box.innerHTML = '<div style="color:#dc2626;padding:10px">' + escP(d.error || '') + '</div>'; return; }
      _apps = d.apps || [];
      box.innerHTML = _apps.map(function (a) {
        var key = (a.resume && a.resume.key) ? a.resume.key : '';
        var name = (a.resume && a.resume.name) ? a.resume.name : 'resume.pdf';
        return '<div style="background:#fff;border:1px solid var(--brd);border-radius:11px;padding:10px 12px;margin-bottom:6px;font-size:13px">' +
          '<b>' + escP(a.name) + '</b> — <span style="direction:ltr;display:inline-block">' + escP(a.mobile) + '</span> · ' + escP(a.email) + '<br>' +
          '<small style="color:#64748b">آگهی: ' + escP(a.jobSlug) + ' | مدرک: ' + escP(lbOf(EDU, a.education)) +
          ' | سابقه: ' + escP(lbOf(EXP, a.experience)) + ' | حقوق: ' + escP(lbOf(SAL, a.salary)) +
          ' | ' + escP((a.createdAt || '').slice(0, 10)) + '</small>' +
          (key ? '<div style="margin-top:6px"><button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="openStoredFile(\'' + ptfOnClickArg(key) + '\',\'' + ptfOnClickArg(name) + '\')">⬇️ دانلود رزومه</button></div>' : '') +
          '</div>';
      }).join('') || '<div style="color:#94a3b8;text-align:center;padding:14px">درخواستی ثبت نشده</div>';
    });
  }

  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'jobs') {
      if (!canJobs()) { alert('⛔ فرصت شغلی فقط برای ادمین، رییس هیات مدیره و مدیرعامل است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '💼 فرصت شغلی';
      document.getElementById('panels').innerHTML = buildJobs();
      renderJobs();
      return;
    }
    _go(id, btn);
  };

  function hideJobsBtn() {
    document.querySelectorAll('.sb-i').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'jobs'") > -1) b.style.display = canJobs() ? '' : 'none';
    });
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { hideJobsBtn(); clearInterval(t); }
    if (tries > 40) clearInterval(t);
  }, 300);
  var _showCrm = window.showCrm;
  if (_showCrm) { window.showCrm = function () { _showCrm(); setTimeout(hideJobsBtn, 400); }; }
})();
