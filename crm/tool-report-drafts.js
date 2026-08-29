/* =====================================================================
   PTF CRM — tool-report-drafts.js — v31.7.97 (TOOLS-FEEDBACK-CRM-INBOX-001)
   CRM review inbox for Advanced Engineering Tools report drafts with engineering and vendor data validation matrix.
   - Admin/chairman only.
   - Lists locked report draft metadata from api/tools.php.
   - Supports internal review statuses: reviewed / needs_data / approved_for_final_phase / rejected / duplicate.
   - Checks final readiness gate.
   - Renders locked internal HTML preview for review.
   - Runs quota dry-run without decrementing quota.
   - Issues immutable final English HTML report after approval/gate/quota handling.
   - Final HTML is browser Print / Save as PDF ready; server-side binary PDF remains disabled.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfToolReportDraftsLoaded) return;
  window.__ptfToolReportDraftsLoaded = true;

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

  function pill(text, fg, bg) {
    return '<span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:900;background:' + bg + ';color:' + fg + ';border:1px solid ' + fg + '33">' + esc(text) + '</span>';
  }
  function statusBadge(st) {
    var map = {
      draft_locked: ['Draft locked', '#64748b', '#f8fafc'],
      reviewed: ['Reviewed', '#047857', '#ecfdf5'],
      needs_data: ['Needs data', '#b45309', '#fffbeb'],
      approved_for_final_phase: ['Approved for final phase', '#0e7490', '#ecfeff'],
      rejected: ['Rejected', '#b91c1c', '#fef2f2'],
      duplicate: ['Duplicate', '#6b21a8', '#faf5ff']
    };
    var x = map[st || 'draft_locked'] || map.draft_locked;
    return pill(x[0], x[1], x[2]);
  }
  function gateBadge(g) {
    var ok = !!(g && g.readyForFinalPhase);
    var blockers = g && g.blockersCount != null ? g.blockersCount : (g && g.blockers ? g.blockers.length : 0);
    return pill(ok ? 'Gate ready' : 'Gate blocked' + (blockers ? ' (' + blockers + ')' : ''), ok ? '#047857' : '#b91c1c', ok ? '#ecfdf5' : '#fef2f2');
  }
  function quotaBadge(q) {
    var ok = !!(q && (q.allowedToIssue || q.wouldConsume));
    var rem = q && q.remainingReports != null ? q.remainingReports : '—';
    var text = ok ? (q.quotaExempt ? 'Quota exempt' : 'Quota OK') : 'Quota pending';
    return pill(text + ' | rem: ' + rem, ok ? '#047857' : '#b45309', ok ? '#ecfdf5' : '#fff7ed');
  }
  function finalBadge(f) {
    var ok = !!(f && f.final);
    return pill(ok ? 'Final issued' : 'Not issued', ok ? '#047857' : '#64748b', ok ? '#ecfdf5' : '#f8fafc');
  }
  function readyBadge(r) {
    var ok = !!(r && r.inputCompleteForFutureReport);
    return pill(ok ? 'Ready' : 'Incomplete', ok ? '#047857' : '#b45309', ok ? '#ecfdf5' : '#fffbeb');
  }
  function fmtNum(x) { return x == null || x === '' || !isFinite(+x) ? '—' : String(Math.round(+x * 1000) / 1000); }
  function detailRows(obj) { return Object.keys(obj || {}).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(obj[k]) + '</td></tr>'; }).join(''); }
  function listHtml(items, fallback) { return (items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') || '<li>' + esc(fallback || 'None') + '</li>'; }

  window.ptfToolReportDraftsHtml = function () {
    if (!roleOk()) return '';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<section id="ptfToolReportDrafts" style="background:#f8fafc;border:1px solid var(--brd);border-radius:16px;padding:14px;line-height:1.9">' +
      '<h4 style="margin:0 0 8px;color:#0f172a">کارتابل گزارش ابزارهای مهندسی</h4>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px">اینجا draftهای قفل‌شده کنترل می‌شود؛ پس از approval، final gate و کنترل quota، گزارش نهایی انگلیسی HTML صادر و قابل چاپ/Save as PDF است. PDF باینری سمت سرور هنوز فعال نیست.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfToolReportDraftsLoad()">بازخوانی draftها</button></div>' +
      '<div id="trdStatus" style="font-size:12px;color:#64748b;margin-top:8px">برای مشاهده draftها بازخوانی انجام می‌شود...</div>' +
      '<div id="trdList" style="margin-top:10px"></div>' +
      '</section>';
  };

  window.ptfToolReportDraftsLoad = function () {
    if (!roleOk()) return;
    var st = document.getElementById('trdStatus'), box = document.getElementById('trdList');
    if (st) st.textContent = 'در حال دریافت draftهای گزارش...';
    api('admin_report_drafts', {}, function (d) {
      if (!d || !d.ok) { if (st) st.textContent = 'خطا در دریافت draftها: ' + esc((d && d.error) || ''); return; }
      if (st) st.textContent = 'تعداد draftهای گزارش: ' + (d.count || 0);
      var rows = (d.drafts || []).map(function (x) {
        var p = x.project || {}, s = x.summary || {}, r = x.readiness || {}, f = x.finalReport || {};
        var actions = '<button class="bt bt-o" style="font-size:11px;padding:4px 8px" onclick="ptfToolReportDraftOpen(\'' + esc(x.draftId) + '\')">مشاهده</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#047857" onclick="ptfToolReportDraftSetStatus(\'' + esc(x.draftId) + '\',\'reviewed\')">Reviewed</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#b45309" onclick="ptfToolReportDraftSetStatus(\'' + esc(x.draftId) + '\',\'needs_data\')">Needs data</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#0e7490" onclick="ptfToolReportDraftSetStatus(\'' + esc(x.draftId) + '\',\'approved_for_final_phase\')">Approve</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#0f766e" onclick="ptfToolReportDraftFinalGate(\'' + esc(x.draftId) + '\')">Final gate</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#1e40af" onclick="ptfToolReportDraftRenderLocked(\'' + esc(x.draftId) + '\')">Locked HTML</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#7c2d12" onclick="ptfToolReportDraftQuotaDryRun(\'' + esc(x.draftId) + '\')">Quota dry-run</button> ' +
          (f.final ? '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#047857" onclick="ptfToolReportDraftFinalGet(\'' + esc(x.draftId) + '\')">Final report</button>' : '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#b45309" onclick="ptfToolReportDraftFinalIssue(\'' + esc(x.draftId) + '\')">Issue final</button>');
        return '<tr><td style="direction:ltr;text-align:left"><b>' + esc(x.draftId) + '</b><br><small>' + esc(x.createdAt || '') + '</small></td>' +
          '<td>' + esc(p.project || '-') + '<br><small>Tag: ' + esc(p.tag || '-') + ' | RFQ: ' + esc(p.rfq || '-') + '</small></td>' +
          '<td style="direction:ltr;text-align:left">' + esc(x.licenseId || '-') + '<br><small>checksum: ' + esc(x.checksum || '-') + '</small></td>' +
          '<td>' + esc(s.governingCase || '-') + '<br><small>Cv: ' + fmtNum(s.governingCv) + ' | Sel: ' + fmtNum(s.recommendedCv) + '</small></td>' +
          '<td>' + esc(s.cavitationRisk || '-') + '<br><small>Noise: ' + esc(s.noiseRisk || '-') + '</small></td>' +
          '<td>' + statusBadge((x.review || {}).status || x.status) + '<br><small>' + esc(((x.review || {}).reviewedBy || '')) + '</small></td>' +
          '<td>' + readyBadge(r) + '<br><small>missing: ' + (r.missingCount || 0) + ' | pipe: ' + (r.pipeIssuesCount || 0) + '</small></td>' +
          '<td>' + gateBadge(x.finalGate || {}) + '<br><small>' + esc(((x.finalGate || {}).engineeringStatus || (x.finalGate || {}).checkedBy || '')) + '</small></td>' +
          '<td>' + quotaBadge(x.quotaDryRun || {}) + '<br><small>' + esc(((x.quotaDryRun || {}).checkedBy || '')) + '</small></td>' +
          '<td>' + finalBadge(f) + '<br><small dir="ltr">' + esc(f.reportNo || '') + '</small></td>' +
          '<td>' + actions + '</td></tr>';
      }).join('') || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:10px">هنوز draft گزارشی ثبت نشده است.</td></tr>';
      if (box) box.innerHTML = '<div style="overflow:auto"><table class="tbl"><thead><tr><th>Draft ID</th><th>Project/Tag</th><th>License/Checksum</th><th>Governing</th><th>Risk</th><th>Review</th><th>Readiness</th><th>Final Gate</th><th>Quota</th><th>Final Report</th><th>عملیات</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  };

  window.ptfToolReportDraftOpen = function (draftId) {
    api('admin_report_draft_get', { draftId: draftId }, function (d) {
      if (!d || !d.ok) { alert('خطا در دریافت draft: ' + ((d && d.error) || '')); return; }
      var dr = d.draft || {}, payload = d.payload || {}, project = payload.project || {}, calc = payload.calculations || {}, read = payload.readiness || {}, f = dr.finalReport || {};
      var cases = (calc.cases || []).map(function (c) { return '<tr><td>' + esc(c.label || c.caseId) + '</td><td>' + fmtNum(c.Cv) + '</td><td>' + esc((c.cavitationRisk || {}).tag || '-') + '</td><td>' + esc((c.noiseRisk || {}).tag || '-') + '</td><td>' + fmtNum((c.pipe || {}).vIn) + '</td><td>' + fmtNum((c.pipe || {}).vOut) + '</td></tr>'; }).join('') || '<tr><td colspan="6">No cases</td></tr>';
      var missing = (read.missing || []).concat(read.pipeIssues || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') || '<li>Input appears ready for report workflow.</li>';
      var blocked = (read.blockedReasons || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') || '<li>No draft blocker returned.</li>';
      var finalActions = f.final ? '<button class="bt bt-o" style="color:#047857" onclick="ptfToolReportDraftFinalGet(\'' + esc(dr.draftId) + '\')">مشاهده گزارش نهایی</button>' : '<button class="bt bt-o" style="color:#b45309" onclick="ptfToolReportDraftFinalIssue(\'' + esc(dr.draftId) + '\')">صدور گزارش نهایی</button>';
      var html = '<div class="md-b" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:920px;max-height:88vh;overflow:auto">' +
        '<h3>مشاهده draft گزارش ابزار</h3>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:8px">Locked draft review. Final report is issued only by CRM approval/gate/quota.</div>' +
        '<table class="tbl"><tbody>' + detailRows({ draftId: dr.draftId, licenseId: dr.licenseId, checksum: dr.checksum, status: dr.status, reviewStatus: ((dr.review||{}).status || ''), reviewNote: ((dr.review||{}).note || ''), reviewedBy: ((dr.review||{}).reviewedBy || ''), reviewedAt: ((dr.review||{}).reviewedAt || ''), finalGate: ((dr.finalGate||{}).readyForFinalPhase ? 'ready' : 'blocked'), gateCheckedAt: ((dr.finalGate||{}).checkedAt || ''), gateBlockers: ((dr.finalGate||{}).blockersCount || 0), engineeringStatus: ((dr.finalGate||{}).engineeringStatus || (dr.finalReport||{}).engineeringStatus || ''), engineeringCriticalCount: ((dr.finalGate||{}).engineeringCriticalCount || (dr.finalReport||{}).engineeringCriticalCount || 0), vendorStatus: ((dr.finalGate||{}).vendorStatus || (dr.finalReport||{}).vendorStatus || ''), vendorMissingCount: ((dr.finalGate||{}).vendorMissingCount || (dr.finalReport||{}).vendorMissingCount || 0), quotaAllowedToIssue: ((dr.quotaDryRun||{}).allowedToIssue ? 'true' : 'false'), quotaWouldConsume: ((dr.quotaDryRun||{}).wouldConsume ? 'true' : 'false'), quotaRemaining: ((dr.quotaDryRun||{}).remainingReports == null ? '' : (dr.quotaDryRun||{}).remainingReports), finalReportNo: f.reportNo || '', finalIssuedAt: f.issuedAt || '', htmlChecksum: f.htmlChecksum || '', final: f.final ? 'true' : 'false', pdfReady: f.browserPrintPdf ? 'true' : 'false', serverPdf: 'false', download: f.final ? 'true' : 'false' }) + '</tbody></table>' +
        '<h4>Project</h4><table class="tbl"><tbody>' + detailRows(project) + '</tbody></table>' +
        '<h4>Cases</h4><table class="tbl"><thead><tr><th>Case</th><th>Cv</th><th>Cavitation</th><th>Noise</th><th>Vin</th><th>Vout</th></tr></thead><tbody>' + cases + '</tbody></table>' +
        '<h4>Readiness / Missing</h4><ul>' + missing + '</ul>' +
        '<h4>Workflow notes</h4><ul>' + blocked + '</ul>' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px"><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfToolReportDraftSetStatus(\'' + esc(dr.draftId) + '\',\'reviewed\')">Reviewed</button><button class="bt bt-o" style="color:#b45309" onclick="ptfToolReportDraftSetStatus(\'' + esc(dr.draftId) + '\',\'needs_data\')">Needs data</button><button class="bt bt-o" style="color:#0e7490" onclick="ptfToolReportDraftSetStatus(\'' + esc(dr.draftId) + '\',\'approved_for_final_phase\')">Approved</button><button class="bt bt-o" style="color:#0f766e" onclick="ptfToolReportDraftFinalGate(\'' + esc(dr.draftId) + '\')">Final gate</button><button class="bt bt-o" style="color:#1e40af" onclick="ptfToolReportDraftRenderLocked(\'' + esc(dr.draftId) + '\')">Locked HTML</button><button class="bt bt-o" style="color:#7c2d12" onclick="ptfToolReportDraftQuotaDryRun(\'' + esc(dr.draftId) + '\')">Quota dry-run</button>' + finalActions + '<button class="bt bt-o" style="color:#b91c1c" onclick="ptfToolReportDraftSetStatus(\'' + esc(dr.draftId) + '\',\'rejected\')">Rejected</button><button class="bt bt-o" style="color:#6b21a8" onclick="ptfToolReportDraftSetStatus(\'' + esc(dr.draftId) + '\',\'duplicate\')">Duplicate</button></span><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  };

  window.ptfToolReportDraftFinalGate = function (draftId) {
    if (!roleOk()) return;
    api('admin_report_final_gate', { draftId: draftId }, function (d) {
      if (!d || !d.ok) { alert('خطا در بررسی gate نهایی: ' + ((d && d.error) || '')); return; }
      var g = d.gate || {}, blockers = g.blockers || [], warnings = g.warnings || [];
      var html = '<div class="md-b" style="display:grid;z-index:3100" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:700px;max-height:86vh;overflow:auto">' +
        '<h3>Final readiness gate</h3>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:8px">اگر gate آماده باشد، دکمه Issue final می‌تواند گزارش نهایی HTML را صادر کند. PDF باینری سمت سرور فعال نیست.</div>' +
        '<table class="tbl"><tbody>' + detailRows({ readyForFinalPhase: g.readyForFinalPhase ? 'true' : 'false', finalReportGenerationEnabled: g.finalReportGenerationEnabled ? 'true' : 'false', pdfReady: g.pdfReady ? 'true' : 'false', serverPdfEnabled: 'false', downloadEnabled: g.downloadEnabled ? 'true' : 'false', engineeringStatus: (g.engineeringValidation || {}).overallStatus || '', engineeringCriticalCount: (g.engineeringValidation || {}).criticalCount || 0, engineeringReviewCount: (g.engineeringValidation || {}).reviewCount || 0, vendorStatus: (g.vendorValidation || {}).overallStatus || '', vendorMissingCount: (g.vendorValidation || {}).missingCount || 0, vendorCertificationRequired: (g.vendorValidation || {}).certificationRequired ? 'true' : 'false', quotaConsumed: 'false', checkedAt: g.checkedAt || '', checkedBy: g.checkedBy || '', serverChecksum: g.serverChecksum || '', nextAllowedAction: g.nextAllowedAction || '' }) + '</tbody></table>' +
        '<h4>Engineering validation</h4><ul>' + listHtml(((g.engineeringValidation || {}).items || []).map(function(it){ return (it.severity || '') + ' — ' + (it.area || '') + ': ' + (it.note || ''); }), 'No engineering validation item.') + '</ul>' +
        '<h4>Vendor data validation</h4><ul>' + listHtml(((g.vendorValidation || {}).items || []).map(function(it){ return (it.status || '') + ' — ' + (it.field || '') + ': ' + (it.note || ''); }), 'No vendor validation item.') + '</ul>' +
        '<h4>Blockers</h4><ul>' + listHtml(blockers, 'No blocker for final phase readiness.') + '</ul>' +
        '<h4>Warnings</h4><ul>' + listHtml(warnings, 'No warning.') + '</ul>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      ptfToolReportDraftsLoad();
    });
  };

  window.ptfToolReportDraftRenderLocked = function (draftId) {
    if (!roleOk()) return;
    api('admin_report_render_locked', { draftId: draftId }, function (d) {
      if (!d || !d.ok) {
        var g = d && d.gate ? d.gate : null, blockers = g && g.blockers ? g.blockers : [];
        var msg = 'رندر HTML قفل‌شده انجام نشد: ' + ((d && d.error) || 'خطا');
        if (blockers.length) msg += '\n\nBlockers:\n- ' + blockers.join('\n- ');
        alert(msg);
        try { ptfToolReportDraftsLoad(); } catch (eL) {}
        return;
      }
      var html = d.html || '<div>No locked HTML returned.</div>', meta = d.render || {};
      var modal = '<div class="md-b" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:980px;max-height:90vh;overflow:auto">' +
        '<h3>Locked internal HTML report preview</h3>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:8px">Review preview only — htmlChecksum: <span dir="ltr">' + esc(meta.htmlChecksum || '') + '</span></div>' +
        '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;direction:ltr;text-align:left">' + html + '</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', modal);
      ptfToolReportDraftsLoad();
    });
  };

  window.ptfToolReportDraftQuotaDryRun = function (draftId) {
    if (!roleOk()) return;
    api('admin_report_quota_dry_run', { draftId: draftId }, function (d) {
      if (!d || !d.ok) { alert('خطا در dry-run مصرف quota: ' + ((d && d.error) || '')); return; }
      var q = d.quotaDryRun || {}, before = q.quotaBefore || {}, after = q.quotaAfter || {}, blockers = q.blockers || [], warnings = q.warnings || [];
      var html = '<div class="md-b" style="display:grid;z-index:3300" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:680px;max-height:86vh;overflow:auto">' +
        '<h3>Report quota dry-run</h3>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:8px">این بررسی فقط dry-run است؛ quota کم نمی‌شود. مصرف واقعی فقط در Issue final انجام می‌شود.</div>' +
        '<table class="tbl"><tbody>' + detailRows({ dryRun: 'true', allowedToIssue: q.allowedToIssue ? 'true' : 'false', wouldConsume: q.wouldConsume ? 'true' : 'false', quotaExempt: q.quotaExempt ? 'true' : 'false', quotaConsumed: 'false', licenseId: q.licenseId || '', usedBefore: before.usedReports, remainingBefore: before.remainingReports, usedAfter: after.usedReports, remainingAfter: after.remainingReports, reportCost: q.reportCost == null ? '' : q.reportCost, checkedAt: q.checkedAt || '', checkedBy: q.checkedBy || '', nextAllowedAction: q.nextAllowedAction || '' }) + '</tbody></table>' +
        '<h4>Blockers</h4><ul>' + listHtml(blockers, 'No quota dry-run blocker.') + '</ul>' +
        '<h4>Warnings</h4><ul>' + listHtml(warnings, 'No warning.') + '</ul>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      ptfToolReportDraftsLoad();
    });
  };

  function openFinalModal(d) {
    var f = d.finalReport || {}, html = d.html || '<div>No final report HTML returned.</div>';
    window.ptfToolReportDraftLastFinalHtml = html;
    var modal = '<div class="md-b" style="display:grid;z-index:3400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1060px;max-height:92vh;overflow:auto">' +
      '<h3>Final HTML report</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:8px">Report No: <span dir="ltr">' + esc(f.reportNo || '') + '</span> | htmlChecksum: <span dir="ltr">' + esc(f.htmlChecksum || '') + '</span> | Engineering: ' + esc(f.engineeringStatus || '') + ' | Vendor: ' + esc(f.vendorStatus || '') + ' | Server PDF: No | Browser PDF: Print / Save as PDF</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="bt bt-o" onclick="ptfToolReportDraftOpenFinalWindow()">باز کردن/چاپ گزارش</button><button class="bt bt-o" onclick="ptfToolReportDraftDownloadFinalHtml(\'' + esc(f.reportNo || 'PTF-CV-REPORT') + '\')">دانلود HTML گزارش</button></div>' +
      '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;direction:ltr;text-align:left;max-height:62vh;overflow:auto">' + html + '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  window.ptfToolReportDraftFinalIssue = function (draftId) {
    if (!roleOk()) return;
    if (!confirm('گزارش نهایی صادر شود؟ در لایسنس‌های غیرکارمندی، quota گزارش مصرف می‌شود.')) return;
    api('admin_report_final_issue', { draftId: draftId }, function (d) {
      if (!d || !d.ok) {
        var blockers = d && d.gate && d.gate.blockers ? d.gate.blockers : [];
        var msg = 'صدور گزارش نهایی انجام نشد: ' + ((d && d.error) || 'خطا');
        if (blockers.length) msg += '\n\nBlockers:\n- ' + blockers.join('\n- ');
        alert(msg);
        try { ptfToolReportDraftsLoad(); } catch (eL) {}
        return;
      }
      openFinalModal(d);
      ptfToolReportDraftsLoad();
    });
  };

  window.ptfToolReportDraftFinalGet = function (draftId) {
    if (!roleOk()) return;
    api('admin_report_final_get', { draftId: draftId }, function (d) {
      if (!d || !d.ok) { alert('گزارش نهایی موجود نیست: ' + ((d && d.error) || '')); return; }
      openFinalModal(d);
    });
  };

  window.ptfToolReportDraftOpenFinalWindow = function () {
    var html = window.ptfToolReportDraftLastFinalHtml || '';
    if (!html) { alert('HTML گزارش نهایی در این نشست موجود نیست. ابتدا Final report را باز کنید.'); return; }
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank', 'noopener');
    if (!w) alert('مرورگر پنجره گزارش را باز نکرد. لطفاً popup را مجاز کنید.');
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
  };

  window.ptfToolReportDraftDownloadFinalHtml = function (reportNo) {
    var html = window.ptfToolReportDraftLastFinalHtml || '';
    if (!html) { alert('HTML گزارش نهایی در این نشست موجود نیست.'); return; }
    var filename = String(reportNo || 'PTF-CV-FINAL-REPORT').replace(/[^A-Za-z0-9_.-]/g, '_') + '.html';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1500);
  };

  window.ptfToolReportDraftSetStatus = function (draftId, status) {
    if (!roleOk()) return;
    var note = '';
    try { note = prompt('یادداشت review برای وضعیت ' + status + ' (اختیاری):') || ''; } catch (e) {}
    api('admin_report_draft_update', { draftId: draftId, status: status, note: note }, function (d) {
      if (!d || !d.ok) { alert('خطا در تغییر وضعیت draft: ' + ((d && d.error) || '')); return; }
      try { if (typeof ptfToast === 'function') ptfToast('وضعیت draft گزارش به‌روزرسانی شد', 'ok'); } catch (eT) {}
      ptfToolReportDraftsLoad();
    });
  };

  var _buildSettings = window.buildSettings;
  if (_buildSettings) {
    window.buildSettings = function () {
      var html = _buildSettings();
      setTimeout(function () { try { if (roleOk()) ptfToolReportDraftsLoad(); } catch (e) {} }, 450);
      return html + '<div style="max-width:1100px">' + window.ptfToolReportDraftsHtml() + '</div>';
    };
  }
})();
