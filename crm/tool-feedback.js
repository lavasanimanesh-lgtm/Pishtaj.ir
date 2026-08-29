/* =====================================================================
   PTF CRM — tool-feedback.js — v31.7.97 (PRIVACY-METRICS-SERVER-SYNC-001)
   Admin/chairman inbox and KPI dashboard for public Advanced Engineering Tools feedback.
   Legacy phase: TOOLS-FUNNEL-KPI-DASHBOARD-001.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfToolFeedbackLoaded) return;
  window.__ptfToolFeedbackLoaded = true;

  var API = '../api/tools.php';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }
  function roleOk() { try { return ['admin', 'chairman'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function token() { try { return (typeof ptfAuthToken === 'function' ? ptfAuthToken() : '') || ''; } catch (e) { return ''; } }
  function api(action, body, cb) {
    fetch(API + '?action=' + encodeURIComponent(action), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CRM-Token': token(), 'X-CRM-Role': (typeof curRole === 'function' ? curRole() : '') },
      body: JSON.stringify(body || {}),
      cache: 'no-store'
    }).then(function (r) { return r.json().then(function (d) { d._http = r.status; return d; }); })
      .then(function (d) {
        /* v34.8.30: توکن کهنه/نقش تغییرکرده → پیام واضح + یک‌بار هدایت به ورود مجدد (به‌جای حلقهٔ 403) */
        if (d && d.needLogin && !window._ptfToolsReloginPrompted) {
          window._ptfToolsReloginPrompted = true;
          if (typeof ptfToast === 'function') ptfToast('نشست شما منقضی یا نقشش تغییر کرده — دوباره وارد شوید', 'warn');
          setTimeout(function () { window._ptfToolsReloginPrompted = false; }, 60000);
        }
        cb && cb(d);
      })
      .catch(function (e) { cb && cb({ ok: false, error: e && e.message ? e.message : String(e || 'network') }); });
  }
  function apiP(action, body) {
    return new Promise(function (resolve) { api(action, body || {}, function (d) { resolve(d || { ok: false, error: 'empty_response' }); }); });
  }
  function countBy(list, key) {
    var out = {};
    (list || []).forEach(function (x) { var v = String((typeof key === 'function' ? key(x) : x[key]) || '-'); out[v] = (out[v] || 0) + 1; });
    return out;
  }
  function pct(n, d) { return d ? Math.round((n * 1000 / d)) / 10 + '%' : '0%'; }
  function avgRating(list) {
    var sum = 0, n = 0;
    (list || []).forEach(function (x) { var r = +x.rating; if (isFinite(r) && r > 0) { sum += r; n++; } });
    return n ? Math.round((sum / n) * 10) / 10 : '—';
  }
  function metric(label, value, sub, color) {
    return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px;box-shadow:0 8px 20px rgba(15,23,42,.04)"><div style="font-size:12px;color:#64748b;font-weight:900">' + esc(label) + '</div><div style="font-size:26px;font-weight:950;color:' + (color || '#0f172a') + ';line-height:1.35">' + esc(value) + '</div><div style="font-size:11px;color:#94a3b8;line-height:1.6">' + esc(sub || '') + '</div></div>';
  }
  function breakdownRows(obj) {
    var keys = Object.keys(obj || {}).sort(function (a, b) { return (obj[b] || 0) - (obj[a] || 0); });
    return keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(obj[k]) + '</td></tr>'; }).join('') || '<tr><td colspan="2">No data</td></tr>';
  }
  function badge(st) {
    var map = { new:['New','#1e40af','#eff6ff'], reviewed:['Reviewed','#047857','#ecfdf5'], contacted:['Contacted','#0e7490','#ecfeff'], converted:['Converted','#166534','#dcfce7'], needs_followup:['Follow-up','#b45309','#fffbeb'], spam:['Spam','#b91c1c','#fef2f2'], archived:['Archived','#64748b','#f8fafc'] };
    var x = map[st || 'new'] || map.new;
    return '<span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:900;background:' + x[2] + ';color:' + x[1] + ';border:1px solid ' + x[1] + '33">' + x[0] + '</span>';
  }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  window.ptfToolFunnelKpiHtml = function () {
    if (!roleOk()) return '';
    return '<section id="ptfToolFunnelKpi" style="background:#f8fafc;border:1px solid var(--brd);border-radius:16px;padding:14px;line-height:1.9;margin-top:12px">' +
      '<h4 style="margin:0 0 8px;color:#0f172a">داشبورد KPI قیف ابزار کنترل ولو</h4>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px">ترکیب داده‌های server-side از feedback، draft گزارش، final report و لایسنس‌ها. بازدیدهای خام صفحه هنوز privacy-first/local هستند و در این داشبورد تجمیع سروری ندارند.</div>' +
      '<button class="bt bt-o" onclick="ptfToolFunnelKpiLoad()">بازخوانی KPI</button>' +
      '<div id="tfkStatus" style="font-size:12px;color:#64748b;margin-top:8px">برای مشاهده KPI بازخوانی انجام شود...</div>' +
      '<div id="tfkBox" style="margin-top:10px"></div>' +
      '</section>';
  };

  window.ptfToolFunnelKpiLoad = function () {
    if (!roleOk()) return;
    var st = document.getElementById('tfkStatus'), box = document.getElementById('tfkBox');
    if (st) st.textContent = 'در حال محاسبه KPIها...';
    Promise.all([apiP('admin_feedback_list'), apiP('admin_report_drafts'), apiP('admin_list'), apiP('admin_metrics_summary', { days: 30 })]).then(function (all) {
      var fd = all[0] || {}, rd = all[1] || {}, ld = all[2] || {}, md = all[3] || {};
      var feedback = fd.ok ? (fd.feedback || []) : [];
      var drafts = rd.ok ? (rd.drafts || []) : [];
      var licenses = ld.ok ? (ld.licenses || []) : [];
      var metrics = md.ok ? ((md.summary || {})) : {};
      var mf = metrics.funnel || {};
      var byPath = metrics.byPath || {};
      var byEvent = metrics.byEvent || {};
      var fbStatus = countBy(feedback, 'status');
      var fbSource = countBy(feedback, 'source');
      var ratingAvg = avgRating(feedback);
      var sampleViewed = feedback.filter(function (x) { return !!x.sampleReportViewed; }).length;
      var contacted = (fbStatus.contacted || 0) + (fbStatus.converted || 0);
      var converted = fbStatus.converted || 0;
      var finalIssued = drafts.filter(function (x) { return !!((x.finalReport || {}).final); }).length;
      var gateReady = drafts.filter(function (x) { return !!((x.finalGate || {}).readyForFinalPhase); }).length;
      var readyInputs = drafts.filter(function (x) { return !!((x.readiness || {}).inputCompleteForFutureReport); }).length;
      var activeLic = licenses.filter(function (x) { return (x.status || 'active') === 'active'; }).length;
      var staffLic = licenses.filter(function (x) { return x.type === 'staff_internal'; }).length;
      var cards = '';
      cards += metric('Feedback total', feedback.length, 'new: ' + (fbStatus.new || 0) + ' | follow-up: ' + (fbStatus.needs_followup || 0), '#1e40af');
      cards += metric('Average rating', ratingAvg, 'از feedbackهای دارای امتیاز', '#0e7490');
      cards += metric('Sample viewed', sampleViewed, pct(sampleViewed, feedback.length) + ' از feedbackها نمونه گزارش را دیده‌اند', '#b45309');
      cards += metric('Contacted / Converted', contacted + ' / ' + converted, 'conversion from feedback: ' + pct(converted, feedback.length), '#047857');
      cards += metric('Draft reports', drafts.length, 'ready inputs: ' + readyInputs + ' | gate ready: ' + gateReady, '#7c3aed');
      cards += metric('Final reports', finalIssued, 'issued final HTML reports', '#166534');
      cards += metric('Active licenses', activeLic, 'staff/internal: ' + staffLic, '#334155');
      cards += metric('Feedback → Draft', pct(drafts.length, feedback.length), 'تقریبی؛ چون ممکن است کاربر بدون feedback هم draft بسازد', '#ea580c');
      cards += metric('Landing views', mf.controlValveLandingViews || 0, 'server aggregate / last 30 days', '#0f766e');
      cards += metric('Sample clicks', mf.sampleReportOpens || 0, 'advanced_cv_sample_report_open', '#a16207');
      cards += metric('Feedback opens', mf.feedbackOpens || 0, 'submit: ' + (mf.feedbackSubmits || 0), '#7c2d12');
      var actions = [];
      if ((fbStatus.new || 0) > 0) actions.push('Feedbackهای new را review کنید و موارد با rating بالا را contacted کنید.');
      if (feedback.length && sampleViewed / feedback.length < 0.5) actions.push('CTA مشاهده نمونه گزارش را در landing و مقالات برجسته‌تر کنید.');
      if (drafts.length && finalIssued / drafts.length < 0.25) actions.push('Blockerهای final gate/datasheet را بررسی کنید تا draftها به final report برسند.');
      if (!actions.length) actions.push('قیف فعلی وضعیت قابل قبول دارد؛ تمرکز روی مقالات SEO بعدی و request indexing باشد.');
      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' + cards + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:12px">' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px"><b>Feedback source breakdown</b><table class="tbl" style="margin-top:8px"><tbody>' + breakdownRows(fbSource) + '</tbody></table></div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px"><b>Feedback status breakdown</b><table class="tbl" style="margin-top:8px"><tbody>' + breakdownRows(fbStatus) + '</tbody></table></div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px"><b>Metrics path breakdown</b><table class="tbl" style="margin-top:8px"><tbody>' + breakdownRows(byPath) + '</tbody></table></div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px"><b>Metrics event breakdown</b><table class="tbl" style="margin-top:8px"><tbody>' + breakdownRows(byEvent) + '</tbody></table></div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px"><b>Next actions</b><ul style="margin:8px 18px 0 0">' + actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:8px">Note: metrics are aggregated server-side without sid, label, href or query string; feedback/draft/license data are shown separately.</div>';
      if (box) box.innerHTML = html;
      if (st) st.textContent = 'KPI به‌روزرسانی شد: feedback=' + feedback.length + ' | drafts=' + drafts.length + ' | final=' + finalIssued;
    });
  };

  window.ptfToolFeedbackHtml = function () {
    if (!roleOk()) return '';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<section id="ptfToolFeedback" style="background:#fff;border:1px solid var(--brd);border-radius:16px;padding:14px;line-height:1.9">' +
      '<h4 style="margin:0 0 8px;color:#0f172a">کارتابل feedback ابزارهای مهندسی</h4>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px">feedback کاربران ابزار کنترل ولو برای بهبود محصول، قیمت‌گذاری و پیگیری فروش.</div>' +
      '<button class="bt bt-o" onclick="ptfToolFeedbackLoad()">بازخوانی feedbackها</button>' +
      '<div id="tfbStatus" style="font-size:12px;color:#64748b;margin-top:8px">برای مشاهده feedbackها بازخوانی انجام شود...</div>' +
      '<div id="tfbList" style="margin-top:10px"></div>' +
      '</section>';
  };

  window.ptfToolFeedbackLoad = function () {
    if (!roleOk()) return;
    var st = document.getElementById('tfbStatus'), box = document.getElementById('tfbList');
    if (st) st.textContent = 'در حال دریافت feedbackها...';
    api('admin_feedback_list', {}, function (d) {
      if (!d || !d.ok) { if (st) st.textContent = 'خطا در دریافت feedback: ' + esc((d && d.error) || ''); return; }
      if (st) st.textContent = 'تعداد feedback: ' + (d.count || 0);
      var rows = (d.feedback || []).map(function (f) {
        return '<tr><td dir="ltr" style="text-align:left"><b>' + esc(f.feedbackId) + '</b><br><small>' + esc(f.createdAt || '') + '</small></td>' +
          '<td>' + badge(f.status) + '<br><small>rating: ' + esc(f.rating || '-') + '</small></td>' +
          '<td>' + esc(f.role || '-') + '<br><small>' + esc(f.company || '-') + '</small></td>' +
          '<td dir="ltr" style="text-align:left">' + esc(f.contact || '-') + '<br><small>' + esc(f.licenseId || '') + '</small></td>' +
          '<td>' + esc(short(f.message, 180)) + '<br><small>source: ' + esc(f.source || '-') + ' | sample: ' + (f.sampleReportViewed ? 'yes' : 'no') + '</small></td>' +
          '<td><button class="bt bt-o" style="font-size:11px;padding:4px 8px" onclick="ptfToolFeedbackOpen(\'' + esc(f.feedbackId) + '\')">مشاهده</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#047857" onclick="ptfToolFeedbackSet(\'' + esc(f.feedbackId) + '\',\'reviewed\')">Reviewed</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#0e7490" onclick="ptfToolFeedbackSet(\'' + esc(f.feedbackId) + '\',\'contacted\')">Contacted</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#166534" onclick="ptfToolFeedbackSet(\'' + esc(f.feedbackId) + '\',\'converted\')">Converted</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#b45309" onclick="ptfToolFeedbackSet(\'' + esc(f.feedbackId) + '\',\'needs_followup\')">Follow-up</button></td></tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:10px">هنوز feedback ثبت نشده است.</td></tr>';
      if (box) box.innerHTML = '<div style="overflow:auto"><table class="tbl"><thead><tr><th>ID</th><th>Status</th><th>Role/Company</th><th>Contact/License</th><th>Message</th><th>عملیات</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  };

  window.ptfToolFeedbackOpen = function (feedbackId) {
    api('admin_feedback_list', {}, function (d) {
      var f = null;
      (d.feedback || []).forEach(function (x) { if (x.feedbackId === feedbackId) f = x; });
      if (!f) { alert('feedback پیدا نشد'); return; }
      var html = '<div class="md-b" style="display:grid;z-index:3600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:88vh;overflow:auto">' +
        '<h3>جزئیات feedback ابزار</h3>' +
        '<table class="tbl"><tbody>' + Object.keys(f).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(typeof f[k] === 'object' ? JSON.stringify(f[k]) : f[k]) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  };

  window.ptfToolFeedbackSet = function (feedbackId, status) {
    if (!roleOk()) return;
    var note = '';
    try { note = prompt('یادداشت وضعیت ' + status + ' (اختیاری):') || ''; } catch (e) {}
    api('admin_feedback_update', { feedbackId: feedbackId, status: status, note: note }, function (d) {
      if (!d || !d.ok) { alert('خطا در تغییر وضعیت feedback: ' + ((d && d.error) || '')); return; }
      try { if (typeof ptfToast === 'function') ptfToast('feedback به‌روزرسانی شد', 'ok'); } catch (eT) {}
      ptfToolFeedbackLoad();
    });
  };

  var _buildSettings = window.buildSettings;
  if (_buildSettings) {
    window.buildSettings = function () {
      var html = _buildSettings();
      setTimeout(function () { try { if (roleOk()) { ptfToolFunnelKpiLoad(); ptfToolFeedbackLoad(); } } catch (e) {} }, 700);
      return html + '<div style="max-width:1100px">' + window.ptfToolFunnelKpiHtml() + window.ptfToolFeedbackHtml() + '</div>';
    };
  }
})();
