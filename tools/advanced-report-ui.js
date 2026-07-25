/* =====================================================================
   PTF Advanced Tools Report Draft UI — v31.7.97 (ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001)
   Server-side scaffold for storing locked Advanced Control Valve report payload drafts before CRM final report issue.
   - Requires an existing license grant.
   - Sends only locked draft payload. Final report issue is performed later in CRM after review, gate and quota handling.
   - Server validates grant and checksum before storing runtime draft in crm/data.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfAdvancedReportUiLoaded) return;
  window.__ptfAdvancedReportUiLoaded = true;

  var API = '../api/tools.php';
  var GRANT_KEY = 'ptf_tools_license_grant';
  var GRANT_PERSIST_KEY = GRANT_KEY + '_persist';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function grantRecord() {
    try {
      if (typeof window.ptfToolsGrant === 'function') return window.ptfToolsGrant();
      var g = JSON.parse(sessionStorage.getItem(GRANT_KEY) || 'null');
      if (g && g.grantPayload && (+g.grantPayload.exp || 0) * 1000 > Date.now()) return g;
      var pg = JSON.parse(localStorage.getItem(GRANT_PERSIST_KEY) || 'null');
      if (pg && pg.grantPayload && (+pg.grantPayload.exp || 0) * 1000 > Date.now()) {
        try { sessionStorage.setItem(GRANT_KEY, JSON.stringify(pg)); } catch (e2) {}
        return pg;
      }
    } catch (e) {}
    return null;
  }
  function box(html, color) {
    var el = document.getElementById('advCvReportData') || document.getElementById('advCvPrelimResult');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px;padding:12px;line-height:1.8;color:' + (color || '#334155') + '">' + html + '</div>';
  }
  function ensurePayload() {
    if (typeof window.ptfAdvCvCollectDraft !== 'function' || typeof window.ptfAdvCvCalculateAdvancedCases !== 'function' || typeof window.ptfAdvCvBuildLockedReportPayload !== 'function') {
      return { ok: false, error: 'Advanced CV report payload functions are not loaded.' };
    }
    var d = window.ptfAdvCvCollectDraft();
    var r = window.ptfAdvCvCalculateAdvancedCases(d);
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Preliminary calculation is not valid.' };
    var payload = window.ptfAdvCvBuildLockedReportPayload(d, r);
    return { ok: true, draft: d, result: r, payload: payload };
  }

  window.ptfAdvCvSubmitReportDraft = function () {
    try {
      if (!(typeof window.ptfToolsHasGrant === 'function' && window.ptfToolsHasGrant('control_valve_advanced'))) {
        if (typeof window.ptfToolsPaywall === 'function') window.ptfToolsPaywall('سایزینگ پیشرفته کنترل ولو');
        return;
      }
      var g = grantRecord();
      if (!g || !g.grant) { box('<b>خطا:</b> grant معتبر در نشست مرورگر پیدا نشد. لطفاً کد لایسنس را دوباره فعال کنید.', '#b91c1c'); return; }
      var prepared = ensurePayload();
      if (!prepared.ok) { box('<b>ثبت انجام نشد:</b> ' + esc(prepared.error), '#b91c1c'); return; }
      if (!prepared.payload || prepared.payload.schema !== 'ADV-CV-REPORT-PAYLOAD-v1') { box('<b>ثبت انجام نشد:</b> payload گزارش معتبر نیست.', '#b91c1c'); return; }
      box('در حال ثبت draft قفل‌شده گزارش در سرور...<br><span style="direction:ltr;display:inline-block">checksum: ' + esc((prepared.payload.reportMeta || {}).checksum || '') + '</span>', '#475569');
      fetch(API + '?action=report_draft_create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant: g.grant, tool: 'control_valve_advanced', payload: prepared.payload }),
        cache: 'no-store'
      }).then(function (r) { return r.json().then(function (d) { d._http = r.status; return d; }); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error((d && d.error) || 'server_error');
          var dr = d.draft || {};
          window.ptfAdvCvLastServerDraft = dr;
          box('<b style="color:#047857">Draft قفل‌شده گزارش در سرور ثبت شد.</b>' +
            '<div style="direction:ltr;text-align:left;background:#fff;border:1px solid #bbf7d0;border-radius:10px;padding:8px;margin-top:8px;font-family:monospace">draftId: ' + esc(dr.draftId || '') + '<br>checksum: ' + esc(dr.checksum || '') + '<br>status: ' + esc(dr.status || '') + '<br>draft final: false | CRM final workflow: enabled</div>' +
            '<div style="font-size:12px;color:#64748b;margin-top:8px">این draft برای review در CRM ثبت شد. ادمین/Chairman می‌تواند پس از approval، final gate و quota، گزارش نهایی انگلیسی HTML چاپ‌پذیر را صادر کند.</div>', '#334155');
          try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_report_draft_created', { draftId: dr.draftId || '', checksum: dr.checksum || '' }); } catch (eT) {}
        })
        .catch(function (err) {
          box('<b>ثبت draft گزارش در سرور انجام نشد:</b> ' + esc(err && err.message ? err.message : err), '#b91c1c');
          try { if (typeof window.ptfTrack === 'function') window.ptfTrack('advanced_cv_report_draft_failed', { error: String(err && err.message || err || '') }); } catch (eF) {}
        });
    } catch (e) { box('<b>خطای ثبت draft:</b> ' + esc(e && e.message ? e.message : e), '#b91c1c'); }
  };
})();
