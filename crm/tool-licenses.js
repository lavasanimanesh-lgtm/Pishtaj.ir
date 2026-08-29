/* =====================================================================
   PTF CRM — tool-licenses.js — v31.7.54 (TOOLS-LICENSE-ADMIN-001)
   Admin panel for issuing/revoking Advanced Engineering Tools licenses.
   - Raw license code is generated server-side and shown once.
   - Server stores only HMAC tokenHash in crm/data/tool_licenses.json.
   - Payment gateway is not implemented here; this is manual invoice/admin issue.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfToolLicensesAdminLoaded) return;
  window.__ptfToolLicensesAdminLoaded = true;

  var API = '../api/tools.php';
  var lastIssuedCode = '';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function roleOk() { try { return ['admin', 'chairman'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function token() { try { return (typeof ptfAuthToken === 'function' ? ptfAuthToken() : '') || ''; } catch (e) { return ''; } }
  function todayPlus(days) { var d = new Date(Date.now() + (days || 90) * 86400000); return d.toISOString().slice(0, 10); }
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
  function pill(st) {
    var c = st === 'active' ? '#047857' : (st === 'suspended' ? '#b45309' : '#b91c1c');
    var bg = st === 'active' ? '#ecfdf5' : (st === 'suspended' ? '#fffbeb' : '#fef2f2');
    return '<span style="display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:900;background:' + bg + ';color:' + c + ';border:1px solid ' + c + '22">' + esc(st || '-') + '</span>';
  }
  function toolLabel(t) {
    return ({ all: 'همه ابزارها', control_valve_advanced: 'Control Valve Advanced', piping_advanced: 'Piping Advanced', pump_selection: 'Pump Selection', flowmeter_orifice: 'Flowmeter / Orifice', electrical_engineering: 'Electrical', instrumentation: 'Instrumentation' })[t] || t || '-';
  }
  function typeLabel(t) {
    return ({ single_report: 'تک‌گزارش', subscription: 'اشتراک', enterprise: 'سازمانی', staff_internal: 'پرسنل داخلی' })[t] || t || '-';
  }

  window.ptfToolLicensesAdminHtml = function () {
    if (!roleOk()) return '';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<section id="ptfToolLicAdmin" style="background:#f8fafc;border:1px solid var(--brd);border-radius:16px;padding:14px;line-height:1.9">' +
      '<h4 style="margin:0 0 8px;color:#0f172a">مدیریت لایسنس ابزارهای مهندسی</h4>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:10px">فاز فعلی: صدور دستی بعد از فاکتور/پرداخت دستی. کد خام فقط یک‌بار نمایش داده می‌شود و در سرور ذخیره نمی‌شود.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end">' +
      '<div><label>شرکت</label><input id="tlCompany" placeholder="نام شرکت"></div>' +
      '<div><label>شخص/واحد</label><input id="tlContact" placeholder="نام مخاطب"></div>' +
      '<div><label>نوع لایسنس</label><select id="tlType"><option value="single_report">تک‌گزارش</option><option value="subscription">اشتراک</option><option value="enterprise">سازمانی</option><option value="staff_internal">پرسنل داخلی</option></select></div>' +
      '<div><label>ابزار</label><select id="tlTool"><option value="control_valve_advanced">Control Valve Advanced</option><option value="all">همه ابزارها</option><option value="piping_advanced">Piping Advanced</option><option value="pump_selection">Pump Selection</option><option value="flowmeter_orifice">Flowmeter / Orifice</option><option value="electrical_engineering">Electrical</option><option value="instrumentation">Instrumentation</option></select></div>' +
      '<div><label>سقف گزارش</label><input id="tlMax" type="number" min="1" max="9999" value="1"></div>' +
      '<div><label>انقضا (شمسی)</label>' + (typeof ptfDatePicker === 'function' ? ptfDatePicker('tlExp', todayPlus(90)) : '<input id="tlExp" value="' + todayPlus(90) + '">') + '</div>' +
      '<div style="grid-column:1/-1"><label>یادداشت داخلی</label><input id="tlNote" placeholder="مثلاً RFQ فعال‌سازی / شماره فاکتور"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="bt" onclick="ptfToolLicIssue()">صدور لایسنس</button><button class="bt bt-o" onclick="ptfToolLicIssueStaff()">صدور کد پرسنل داخلی</button><button class="bt bt-o" onclick="ptfToolLicLoad()">بازخوانی لیست</button></div>' +
      '<div id="tlIssueBox" style="display:none;margin-top:10px;background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:10px;color:#065f46;font-size:12px"></div>' +
      '<div id="tlStatus" style="font-size:12px;color:#64748b;margin-top:8px">برای مشاهده لایسنس‌ها، بازخوانی انجام می‌شود...</div>' +
      '<div id="tlList" style="margin-top:10px"></div>' +
      '</section>';
  };

  window.ptfToolLicLoad = function () {
    if (!roleOk()) return;
    var st = document.getElementById('tlStatus'), box = document.getElementById('tlList');
    if (st) st.textContent = 'در حال دریافت فهرست لایسنس‌ها...';
    api('admin_list', {}, function (d) {
      if (!d || !d.ok) { if (st) st.textContent = 'خطا در دریافت لایسنس‌ها: ' + esc((d && d.error) || ''); return; }
      if (st) st.textContent = 'تعداد لایسنس‌ها: ' + (d.count || 0);
      var rows = (d.licenses || []).map(function (l) {
        var to = l.issuedTo || {};
        return '<tr><td style="direction:ltr;text-align:left"><b>' + esc(l.licenseId) + '</b><br><small class="ptf-date-gregorian" data-calendar="gregorian">' + esc(l.issuedAt || '') + '</small></td>' +
          '<td>' + esc(to.company || '-') + '<br><small>' + esc(to.contact || '') + '</small></td>' +
          '<td>' + toolLabel(l.tool) + '<br><small>' + typeLabel(l.type) + '</small></td>' +
          '<td>' + (l.usedReports || 0) + ' / ' + (l.maxReports || 0) + '<br><small class="ptf-date-gregorian" data-calendar="gregorian">' + esc(l.expiresAt || '-') + '</small></td>' +
          '<td>' + pill(l.status) + '</td>' +
          '<td><button class="bt bt-o" style="font-size:11px;padding:4px 8px" onclick="ptfToolLicSetStatus(\'' + esc(l.licenseId) + '\',\'active\')">فعال</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#b45309" onclick="ptfToolLicSetStatus(\'' + esc(l.licenseId) + '\',\'suspended\')">تعلیق</button> ' +
          '<button class="bt bt-o" style="font-size:11px;padding:4px 8px;color:#b91c1c" onclick="ptfToolLicSetStatus(\'' + esc(l.licenseId) + '\',\'revoked\')">ابطال</button></td></tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:10px">هنوز لایسنسی صادر نشده است.</td></tr>';
      if (box) box.innerHTML = '<div style="overflow:auto"><table class="tbl"><thead><tr><th>License ID</th><th>صادرشده برای</th><th>ابزار/نوع</th><th>مصرف/انقضا</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  };

  function issueBody(staff) {
    return {
      company: staff ? 'Pishro Tajhiz Fartak' : ((document.getElementById('tlCompany') || {}).value || ''),
      contact: staff ? 'internal-staff' : ((document.getElementById('tlContact') || {}).value || ''),
      type: staff ? 'staff_internal' : ((document.getElementById('tlType') || {}).value || 'single_report'),
      tool: staff ? 'all' : ((document.getElementById('tlTool') || {}).value || 'control_valve_advanced'),
      maxReports: staff ? 9999 : +(((document.getElementById('tlMax') || {}).value) || 1),
      expiresAt: staff ? '2099-12-31T23:59:59+03:30' : ((typeof ptfJToISO === 'function' ? ptfJToISO(((document.getElementById('tlExp') || {}).value) || '') : '') || ((document.getElementById('tlExp') || {}).value) || todayPlus(90)) + 'T23:59:59+03:30',
      note: ((document.getElementById('tlNote') || {}).value || '')
    };
  }
  function showIssued(d) {
    lastIssuedCode = d.license_code || '';
    var box = document.getElementById('tlIssueBox');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<b>لایسنس صادر شد. کد خام فقط همین یک‌بار قابل مشاهده است:</b>' +
      '<div style="direction:ltr;text-align:left;background:#fff;border:1px solid #86efac;border-radius:10px;padding:8px;margin-top:6px;font-weight:900;letter-spacing:.5px">' + esc(lastIssuedCode) + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap"><button class="bt bt-o" onclick="ptfToolLicCopyLast()">کپی کد</button><span style="color:#047857">در سرور فقط HMAC ذخیره شد، نه کد خام.</span></div>';
  }
  window.ptfToolLicIssue = function () {
    if (!roleOk()) return;
    var st = document.getElementById('tlStatus');
    if (st) st.textContent = 'در حال صدور لایسنس...';
    api('admin_issue', issueBody(false), function (d) {
      if (!d || !d.ok) { if (st) st.textContent = 'خطا در صدور: ' + ((d && d.error) || ''); return; }
      if (st) st.textContent = 'لایسنس صادر شد: ' + ((d.license || {}).licenseId || '');
      showIssued(d); ptfToolLicLoad();
    });
  };
  window.ptfToolLicIssueStaff = function () {
    if (!confirm('کد پرسنل داخلی با دسترسی همه ابزارها و سقف ۹۹۹۹ گزارش صادر شود؟')) return;
    api('admin_issue', issueBody(true), function (d) {
      if (!d || !d.ok) { alert('خطا در صدور کد پرسنل: ' + ((d && d.error) || '')); return; }
      showIssued(d); ptfToolLicLoad();
    });
  };
  window.ptfToolLicCopyLast = function () {
    if (!lastIssuedCode) return;
    try { navigator.clipboard.writeText(lastIssuedCode); if (typeof ptfToast === 'function') ptfToast('کد لایسنس کپی شد', 'ok'); else alert('کپی شد'); } catch (e) { prompt('کد لایسنس:', lastIssuedCode); }
  };
  window.ptfToolLicSetStatus = function (licenseId, status) {
    if (!roleOk()) return;
    api('admin_update', { licenseId: licenseId, status: status }, function (d) {
      if (!d || !d.ok) { alert('خطا در تغییر وضعیت: ' + ((d && d.error) || '')); return; }
      ptfToolLicLoad();
    });
  };

  var _buildSettings = window.buildSettings;
  if (_buildSettings) {
    window.buildSettings = function () {
      var html = _buildSettings();
      setTimeout(function () { try { if (roleOk()) ptfToolLicLoad(); } catch (e) {} }, 250);
      return html + '<div style="max-width:760px">' + window.ptfToolLicensesAdminHtml() + '</div>';
    };
  }
})();
