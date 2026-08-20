/* =====================================================================
   PTF CRM — v34.7.59 فرصت شغلی
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
  var TITLE_PRESETS = [
    { fa: 'کارشناس فروش', en: 'Sales Expert', slug: 'sales-expert' },
    { fa: 'مدیر فروش', en: 'Sales Manager', slug: 'sales-manager' },
    { fa: 'حسابدار', en: 'Accountant', slug: 'accountant' },
    { fa: 'مدیر مالی', en: 'Finance Manager', slug: 'finance-manager' },
    { fa: 'کارشناس مهندسی', en: 'Engineering Expert', slug: 'engineering-expert' }
  ];
  function lbOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i].lb;
    return v || '-';
  }
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
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

  window.jobsTitlePick = function () {
    var sel = document.getElementById('cjTitlePick');
    var i = sel ? +sel.value : -1;
    var custom = i < 0;
    var box = document.getElementById('cjCustomHint');
    if (box) box.style.display = custom ? '' : 'none';
    if (custom || !TITLE_PRESETS[i]) return;
    var p = TITLE_PRESETS[i];
    var fa = document.getElementById('cjTitleFa');
    var en = document.getElementById('cjTitleEn');
    var slug = document.getElementById('cjSlug');
    if (fa) fa.value = p.fa;
    if (en) en.value = p.en;
    if (slug && !slug.readOnly) slug.value = p.slug;
  };
  window.jobsSlugFromEn = function () {
    var slug = document.getElementById('cjSlug');
    var en = document.getElementById('cjTitleEn');
    if (!slug || slug.readOnly || !en) return;
    if (slug.value && slug.getAttribute('data-touched') === '1') return;
    slug.value = slugify(en.value);
  };

  function jobsForm(j) {
    j = j || { slug: '', titleFa: '', titleEn: '', bodyFa: '', bodyEn: '', dept: '', location: '', published: true };
    var EMPT = [
      { v: 'FULL_TIME', lb: 'تمام‌وقت' }, { v: 'PART_TIME', lb: 'پاره‌وقت' },
      { v: 'CONTRACTOR', lb: 'قراردادی / پروژه‌ای' }, { v: 'TEMPORARY', lb: 'موقت' },
      { v: 'INTERN', lb: 'کارآموز' }, { v: 'OTHER', lb: 'سایر' }
    ];
    var curEmp = j.employmentType || 'FULL_TIME';
    var empOpts = EMPT.map(function (e) {
      return '<option value="' + e.v + '"' + (curEmp === e.v ? ' selected' : '') + '>' + escP(e.lb) + '</option>';
    }).join('');
    var opts = '<option value="-1">سایر — عنوان را خودتان بنویسید</option>' + TITLE_PRESETS.map(function (p, i) {
      var on = j.titleFa === p.fa || j.titleEn === p.en;
      return '<option value="' + i + '"' + (on ? ' selected' : '') + '>' + escP(p.fa) + ' / ' + escP(p.en) + '</option>';
    }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:720px;max-height:94vh;overflow:auto">' +
      '<h3>' + (j.slug ? '✏️ ویرایش آگهی' : '💼 آگهی جدید') + '</h3>' +
      '<div class="fld"><label>عنوان شغل</label><select id="cjTitlePick" onchange="jobsTitlePick()">' + opts + '</select>' +
      '<small id="cjCustomHint" style="color:#64748b;display:block;margin-top:4px">برای عنوان‌های دیگر (مثلاً کارشناس بازرگانی) فیلدهای زیر را پر کنید.</small></div>' +
      '<div class="fr"><div class="fld"><label>عنوان فارسی *</label><input type="text" id="cjTitleFa" value="' + escP(j.titleFa) + '"></div>' +
      '<div class="fld"><label>عنوان انگلیسی *</label><input type="text" id="cjTitleEn" value="' + escP(j.titleEn) + '" style="direction:ltr" oninput="jobsSlugFromEn()"></div></div>' +
      '<div class="fr"><div class="fld"><label>نامک انگلیسی (slug)</label><input type="text" id="cjSlug" value="' + escP(j.slug) + '" ' + (j.slug ? 'readonly style="background:#f1f5f9;direction:ltr"' : 'placeholder="sales-expert" style="direction:ltr" oninput="this.setAttribute(\'data-touched\',\'1\')"') + '><small style="color:#94a3b8">اگر خالی بماند از عنوان انگلیسی ساخته می‌شود.</small></div>' +
      '<div class="fld"><label>واحد / محل (اختیاری)</label><input type="text" id="cjDept" value="' + escP(j.dept || '') + '" placeholder="واحد بازرگانی"><input type="text" id="cjLoc" value="' + escP(j.location || '') + '" placeholder="تهران" style="margin-top:6px"></div></div>' +
      '<div class="fr"><div class="fld"><label>نوع همکاری</label><select id="cjEmpType">' + empOpts + '</select><small style="color:#94a3b8">برای اسکیمای گوگل (JobPosting) استفاده می‌شود.</small></div>' +
      '<div class="fld"><label>بازه حقوق پیشنهادی — تومان در ماه (اختیاری)</label><input type="text" id="cjSalMin" inputmode="numeric" value="' + escP(j.salaryMinToman || '') + '" placeholder="از — مثلاً 20000000"><input type="text" id="cjSalMax" inputmode="numeric" value="' + escP(j.salaryMaxToman || '') + '" placeholder="تا — مثلاً 30000000" style="margin-top:6px"><small style="color:#94a3b8">اگر خالی بماند، حقوق در اسکیمای گوگل درج نمی‌شود (فقط یک اخطار زرد اختیاری می‌ماند).</small></div></div>' +
      '<div class="fld"><label>نکات برای هوش مصنوعی (اختیاری)</label><textarea id="cjAiNotes" rows="2" placeholder="مثلاً: تمام‌وقت، تهران، تسلط به اکسل، سابقه فروش صنعتی"></textarea></div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 10px">' +
      '<button type="button" class="bt" id="cjAiBtn" style="background:#7c3aed" onclick="jobsAiDraft()">🤖 نوشتن شرح فارسی و انگلیسی</button>' +
      '<small style="color:#64748b">متن پیشنهادی را بازبینی کنید و بعد انتشار بزنید.</small></div>' +
      '<div id="cjAiSt" style="font-size:12px;min-height:1.2em;margin-bottom:8px"></div>' +
      '<div class="fld"><label>شرح فارسی *</label><textarea id="cjBodyFa" rows="6">' + escP(j.bodyFa || '') + '</textarea></div>' +
      '<div class="fld"><label>شرح انگلیسی *</label><textarea id="cjBodyEn" rows="6" style="direction:ltr">' + escP(j.bodyEn || '') + '</textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="jobsSave()">🚀 انتشار / ذخیره</button></div>' +
      '<small style="color:#94a3b8;display:block;margin-top:6px">برداشتن آگهی فقط انتشار را می‌بندد؛ تاریخچه رزومه‌ها حفظ می‌شود و بعد از ۶ ماه پاک می‌شود.</small></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (!j.slug) {
      var pick = document.getElementById('cjTitlePick');
      if (pick) pick.value = '-1';
    }
  }

  window.jobsAiDraft = function () {
    var titleFa = (document.getElementById('cjTitleFa') || {}).value.trim();
    var titleEn = (document.getElementById('cjTitleEn') || {}).value.trim();
    if (!titleFa) { alert('ابتدا عنوان شغل را از فهرست انتخاب کنید یا بنویسید'); return; }
    var st = document.getElementById('cjAiSt');
    var btn = document.getElementById('cjAiBtn');
    if (st) st.innerHTML = '<span style="color:#7c3aed">⏳ در حال نوشتن شرح دوزبانه…</span>';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال نوشتن…'; }
    var headers = jobsAuthHeaders();
    headers['Content-Type'] = 'application/json';
    fetch('../api/llm.php?action=jobdesc', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        titleFa: titleFa,
        titleEn: titleEn,
        dept: (document.getElementById('cjDept') || {}).value.trim(),
        location: (document.getElementById('cjLoc') || {}).value.trim(),
        notes: (document.getElementById('cjAiNotes') || {}).value.trim()
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = '🤖 نوشتن شرح فارسی و انگلیسی'; }
      if (!d.ok || !d.data) {
        if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + escP(d.error || 'هوش مصنوعی در دسترس نیست') + '</span>';
        return;
      }
      var fa = d.data.bodyFa || '';
      var en = d.data.bodyEn || '';
      var curFa = (document.getElementById('cjBodyFa') || {}).value.trim();
      if (curFa && !confirm('شرح پیشنهادی جایگزین متن فعلی شود؟')) {
        if (st) st.textContent = 'شرح فعلی حفظ شد.';
        return;
      }
      if (d.data.titleEn && !(document.getElementById('cjTitleEn') || {}).value.trim()) document.getElementById('cjTitleEn').value = d.data.titleEn;
      document.getElementById('cjBodyFa').value = fa;
      document.getElementById('cjBodyEn').value = en;
      var slugEl = document.getElementById('cjSlug');
      if (slugEl && !slugEl.readOnly && !slugEl.value && d.data.slug) slugEl.value = slugify(d.data.slug);
      else if (slugEl && !slugEl.readOnly && !slugEl.value) jobsSlugFromEn();
      if (st) st.innerHTML = '<span style="color:#047857">✅ شرح پیشنهادی آمد — بازبینی کنید و اگر تأیید است انتشار را بزنید.</span>';
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🤖 نوشتن شرح فارسی و انگلیسی'; }
      if (st) st.innerHTML = '<span style="color:#dc2626">❌ خطای اتصال به هوش مصنوعی</span>';
    });
  };

  window.jobsSave = function () {
    var rec = {
      titleFa: document.getElementById('cjTitleFa').value.trim(),
      titleEn: document.getElementById('cjTitleEn').value.trim(),
      slug: document.getElementById('cjSlug').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      bodyFa: document.getElementById('cjBodyFa').value.trim(),
      bodyEn: document.getElementById('cjBodyEn').value.trim(),
      dept: document.getElementById('cjDept').value.trim(),
      location: document.getElementById('cjLoc').value.trim(),
      employmentType: (document.getElementById('cjEmpType') || { value: 'FULL_TIME' }).value,
      salaryMinToman: ((document.getElementById('cjSalMin') || {}).value || '').replace(/[^0-9۰-۹]/g, ''),
      salaryMaxToman: ((document.getElementById('cjSalMax') || {}).value || '').replace(/[^0-9۰-۹]/g, ''),
      published: '1'
    };
    if (!rec.slug) rec.slug = slugify(rec.titleEn);
    if (!rec.titleFa || !rec.titleEn || !rec.bodyFa || !rec.bodyEn) { alert('عنوان و متن فارسی و انگلیسی الزامی است'); return; }
    if (!rec.slug) { alert('نامک انگلیسی ساخته نشد — عنوان انگلیسی را با حروف لاتین بنویسید'); return; }
    api('save_job', rec, function (d) {
      if (d.ok) {
        var extra = (d.warnings && d.warnings.length) ? '\n\nتوجه: ' + d.warnings.join(' — ') : '';
        alert('✅ آگهی روی سایت منتشر شد:\npishtaj.ir/' + d.url + extra);
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
