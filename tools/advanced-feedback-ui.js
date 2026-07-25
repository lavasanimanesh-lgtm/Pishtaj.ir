/* =====================================================================
   PTF Advanced Tools Feedback UI — v31.7.97 (TOOLS-FEEDBACK-CRM-INBOX-001)
   Public/secured feedback capture for Advanced Control Valve without payment activation.
   - Stores feedback via api/tools.php?action=feedback_create.
   - No report quota consumption, no final report issue, no online payment.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfAdvancedFeedbackUiLoaded) return;
  window.__ptfAdvancedFeedbackUiLoaded = true;

  var API = '../api/tools.php';
  var GRANT_KEY = 'ptf_tools_license_grant';
  var GRANT_PERSIST_KEY = GRANT_KEY + '_persist';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }
  function byId(id) { try { return document.getElementById(id); } catch (e) { return null; } }
  function val(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function checked(id) { var el = byId(id); return !!(el && el.checked); }
  function readGrant() {
    try { if (typeof window.ptfToolsGrant === 'function') return window.ptfToolsGrant(); } catch (e0) {}
    try {
      var g = JSON.parse(sessionStorage.getItem(GRANT_KEY) || 'null');
      if (g && g.grantPayload && (+g.grantPayload.exp || 0) * 1000 > Date.now()) return g;
      var pg = JSON.parse(localStorage.getItem(GRANT_PERSIST_KEY) || 'null');
      if (pg && pg.grantPayload && (+pg.grantPayload.exp || 0) * 1000 > Date.now()) return pg;
    } catch (e) {}
    return null;
  }
  function draftContext() {
    var d = {};
    try { if (typeof window.ptfAdvCvCollectDraft === 'function') d = window.ptfAdvCvCollectDraft() || {}; } catch (e) {}
    return { tag: d.adv_tag || '', service: d.adv_service || '', phase: d.adv_phase || '', reportPreviewOpened: !!window.ptfAdvCvLastReportPayload };
  }
  function status(html, color) {
    var el = byId('ptfAdvFeedbackStatus');
    if (!el) return;
    el.style.color = color || '#475569';
    el.innerHTML = html;
  }

  window.ptfAdvCvOpenFeedbackForm = function (source) {
    source = source || 'tools';
    try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_feedback_open', { source: source }); } catch (eT) {}
    var old = byId('ptfAdvFeedbackModal');
    if (old) old.remove();
    var ctx = draftContext();
    var html = '<div id="ptfAdvFeedbackModal" style="position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:99999;display:grid;place-items:center;padding:18px;direction:rtl" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;border-radius:22px;border:1px solid #e2e8f0;box-shadow:0 25px 70px rgba(15,23,42,.28);max-width:720px;width:min(720px,96vw);max-height:90vh;overflow:auto;padding:22px;line-height:1.9;color:#334155;font-family:Tahoma,Arial,sans-serif">' +
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h3 style="margin:0;color:#ef4b1a">ثبت feedback ابزار سایزینگ کنترل ولو</h3><p style="margin:6px 0 12px;color:#64748b;font-size:13px">نظر شما برای تکمیل ابزار و قیمت‌گذاری منصفانه استفاده می‌شود. این فرم گزارش/لایسنس/پرداخت ایجاد نمی‌کند.</p></div><button type="button" onclick="document.getElementById(\'ptfAdvFeedbackModal\').remove()" style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:7px 10px;cursor:pointer">بستن</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">' +
      '<div><label style="font-size:12px;font-weight:900;color:#475569">نقش شما</label><select id="ptfAdvFeedbackRole" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:10px"><option>Instrumentation Engineer</option><option>Process Engineer</option><option>Piping Engineer</option><option>Procurement / Commercial</option><option>Manager</option><option>Other</option></select></div>' +
      '<div><label style="font-size:12px;font-weight:900;color:#475569">امتیاز اولیه</label><select id="ptfAdvFeedbackRating" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:10px"><option value="5">5 - بسیار مفید</option><option value="4">4 - مفید</option><option value="3">3 - متوسط</option><option value="2">2 - نیازمند اصلاح</option><option value="1">1 - مناسب نیست</option></select></div>' +
      '<div><label style="font-size:12px;font-weight:900;color:#475569">شرکت / نام</label><input id="ptfAdvFeedbackCompany" value="" placeholder="اختیاری" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:10px"></div>' +
      '<div><label style="font-size:12px;font-weight:900;color:#475569">تماس</label><input id="ptfAdvFeedbackContact" placeholder="موبایل/ایمیل اختیاری" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:10px;direction:ltr;text-align:left"></div>' +
      '</div>' +
      '<label style="display:block;font-size:12px;font-weight:900;color:#475569;margin-top:10px">نظر، ایراد، پیشنهاد قیمت یا نیاز واقعی شما</label><textarea id="ptfAdvFeedbackMessage" style="width:100%;box-sizing:border-box;min-height:120px;padding:10px;border:1px solid #cbd5e1;border-radius:12px;resize:vertical" placeholder="مثلاً: اگر PDF نهایی/ورودی دیتاشیت/محاسبات Gas دقیق‌تر شود، برای هر گزارش چه مبلغی منصفانه است؟"></textarea>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#64748b"><label><input type="checkbox" id="ptfAdvFeedbackSample" ' + (source === 'sample_report' ? 'checked' : '') + '> نمونه گزارش را دیده‌ام</label><label><input type="checkbox" id="ptfAdvFeedbackConsent" checked> اجازه تماس برای پیگیری feedback را می‌دهم</label></div>' +
      '<div style="direction:ltr;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px;margin-top:10px;font-size:12px;color:#64748b">Context: tag=' + esc(ctx.tag || '-') + ' | service=' + esc(ctx.service || '-') + ' | phase=' + esc(ctx.phase || '-') + '</div>' +
      '<div id="ptfAdvFeedbackStatus" style="font-size:12px;color:#64748b;margin-top:8px"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" onclick="ptfAdvCvSubmitFeedback(\'' + esc(source) + '\')" style="border:0;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;border-radius:12px;padding:9px 15px;font-weight:900;cursor:pointer">ارسال feedback</button></div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.ptfAdvCvSubmitFeedback = function (source) {
    var msg = val('ptfAdvFeedbackMessage');
    if (msg.length < 8) { status('لطفاً نظر خود را کمی کامل‌تر بنویسید.', '#dc2626'); return; }
    var g = readGrant();
    var body = {
      tool: 'control_valve_advanced',
      source: source || 'tools',
      role: val('ptfAdvFeedbackRole'),
      rating: val('ptfAdvFeedbackRating'),
      company: val('ptfAdvFeedbackCompany'),
      contact: val('ptfAdvFeedbackContact'),
      message: msg,
      consent: checked('ptfAdvFeedbackConsent'),
      sampleReportViewed: checked('ptfAdvFeedbackSample'),
      pageUrl: String(location && location.href || ''),
      context: draftContext(),
      grant: g && g.grant ? g.grant : ''
    };
    status('در حال ارسال feedback...', '#475569');
    fetch(API + '?action=feedback_create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    }).then(function (r) { return r.json().then(function (d) { d._http = r.status; return d; }); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d && d.error) || 'server_error');
        status('<b style="color:#047857">feedback ثبت شد. ممنون.</b><br><span dir="ltr">feedbackId: ' + esc((d.feedback || {}).feedbackId || '') + '</span>', '#047857');
        try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_feedback_submitted', { source: body.source, rating: body.rating }); } catch (eT) {}
      })
      .catch(function (err) { status('ارسال feedback انجام نشد: ' + esc(err && err.message ? err.message : err), '#dc2626'); });
  };
})();
