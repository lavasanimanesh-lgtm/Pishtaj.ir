/* =====================================================================
   PTF CRM — Sprint 70 (reports.js)
   US-144: ماژول گزارشات — فقط ادمین و رییس هیات مدیره
   گزارش‌گیری بر اساس کاربر / ماژول / بازه زمانی + رصد کلیه تحرکات
   ===================================================================== */
(function () {
  'use strict';

  var REPORT_ROLES = ['admin', 'chairman', 'ceo', 'commercial']; // US-144 AC4 + v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح
  function canReports() { return REPORT_ROLES.indexOf(curRole()) > -1; }

  var PERIODS = [
    { id: 'today', lb: 'امروز', days: 0 },
    { id: 'w1', lb: '۷ روز اخیر', days: 7 },
    { id: 'm1', lb: '۳۰ روز اخیر', days: 30 },
    { id: 'q1', lb: '۹۰ روز اخیر', days: 90 },
    { id: 'all', lb: 'همه', days: -1 }
  ];

  /* ---- تبدیل تاریخ شمسی سیستم (fa-IR) به عدد قابل مقایسه ---- */
  function faToNum(faStr) {
    // '۱۴۰۵/۴/۱۴' یا '1405/4/14' → 14050414
    if (!faStr) return 0;
    var s = String(faStr).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    var m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!m) return 0;
    return (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]);
  }
  function todayFaNum() { return faToNum(new Date().toLocaleDateString('fa-IR')); }
  function faNumDaysAgo(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    return faToNum(d.toLocaleDateString('fa-IR'));
  }
  function inPeriod(faStr, periodId) {
    if (periodId === 'all') return true;
    var n = faToNum(faStr);
    if (!n) return periodId === 'all';
    var p = PERIODS.filter(function (x) { return x.id === periodId; })[0];
    if (!p) return true;
    if (p.days === 0) return n === todayFaNum();
    return n >= faNumDaysAgo(p.days);
  }

  /* ---- محاسبه شاخص‌های هر کاربر ---- */
  function allUserNames() {
    var users = getData('ptf_crm_users').map(function (u) { return { user: u.username, name: u.name, role: u.role }; });
    users.unshift({ user: 'admin', name: 'ادمین سیستم', role: 'ادمین' });
    return users;
  }

  function userStats(period) {
    var users = allUserNames();
    var offers = getData('ptf_crm_offers');
    var sups = getData('ptf_crm_suppliers');
    var custs = getData('ptf_crm_customers');
    var leads = getData('ptf_crm_leads');
    var invs = getData('ptf_crm_invoices');
    var lets = getData('ptf_crm_letters');
    var auditLog = getData('ptf_crm_audit');
    return users.map(function (u) {
      function co(list, byField, tField, extra) {
        return list.filter(function (x) {
          if ((x[byField] || '') !== u.name && (x[byField] || '') !== u.user) return false;
          if (!inPeriod(x[tField], period)) return false;
          return !extra || extra(x);
        }).length;
      }
      // پیشنهادها: issuedBy = username / audit fallback
      var myOffers = offers.filter(function (o) {
        var owner = o.issuedBy === u.user || o.wonBy === u.name;
        return owner && inPeriod(o.dateFa, period);
      });
      var to = myOffers.filter(function (o) { return o.kind === 'TO'; }).length;
      var coN = myOffers.filter(function (o) { return o.kind === 'CO'; }).length;
      var won = offers.filter(function (o) { return o.kind === 'CO' && o.st === 'won' && (o.issuedBy === u.user || o.wonBy === u.name) && inPeriod(o.dateFa, period); }).length;
      var acts = auditLog.filter(function (a) { return a.user === u.name && inPeriod(a.t, period); }).length;
      return {
        user: u.user, name: u.name, role: u.role,
        to: to, co: coN, won: won,
        sup: co(sups, 'approvedBy', 'approvedAt') + sups.filter(function (s) { return !s.approvedBy && (s.by === u.name) && inPeriod(s.t, period); }).length,
        cust: custs.filter(function (c) { return (c.by === u.name || c.createdBy === u.name) && inPeriod(c.t || c.createdFa, period); }).length,
        lead: leads.filter(function (l) { return (l.by === u.name || l.createdBy === u.name) && inPeriod(l.createdFa, period); }).length,
        inv: invs.filter(function (i) { return i.by === u.name && inPeriod(i.t, period); }).length,
        let: lets.filter(function (l) { return (l.authorNm === u.name || l.by === u.name) && inPeriod(l.t || l.dateFa, period); }).length,
        acts: acts
      };
    });
  }

  /* ---- UI ---- */
  window.buildReports = function () {
    var pOpts = PERIODS.map(function (p) { return '<option value="' + p.id + '"' + (p.id === 'm1' ? ' selected' : '') + '>' + p.lb + '</option>'; }).join('');
    var uOpts = '<option value="">همه کاربران</option>' + allUserNames().map(function (u) { return '<option value="' + escP(u.name) + '">' + escP(u.name) + ' (' + escP(u.role) + ')</option>'; }).join('');
    var mods = ['پیشنهادها', 'استعلامات', 'تامین‌کنندگان', 'مشتریان', 'فاکتور', 'مکاتبات', 'کاربران', 'پرونده پروژه', 'پرونده فروش', 'اعلانات', 'یادآورها'];
    var mOpts = '<option value="">همه ماژول‌ها</option>' + mods.map(function (m) { return '<option>' + m + '</option>'; }).join('');
    return '<div class="ph"><h3>📈 گزارشات مدیریتی</h3>' +
      '<div class="sb2">' +
      '<select id="repPeriod" onchange="renderReports()" style="padding:8px;border:1px solid var(--brd);border-radius:10px;font-size:13px">' + pOpts + '</select>' +
      '<select id="repUser" onchange="renderReports()" style="padding:8px;border:1px solid var(--brd);border-radius:10px;font-size:13px">' + uOpts + '</select>' +
      '</div></div>' +
      '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#854d0e">🔐 این ماژول فقط برای مدیران ارشد (ادمین، رییس هیات مدیره، مدیرعامل، مدیر بازرگانی) قابل مشاهده است.</div>' +
      '<h4 style="margin:4px 0 8px;font-size:14px">📊 عملکرد کاربران</h4>' +
      '<div class="tb2"><table><thead><tr><th>کاربر</th><th>نقش</th><th>TO فنی</th><th>CO مالی</th><th>CO برنده</th><th>تامین‌کننده</th><th>مشتری</th><th>لید</th><th>فاکتور</th><th>نامه</th><th>کل اقدامات</th></tr></thead>' +
      '<tbody id="repTb"></tbody></table></div>' +
      '<h4 style="margin:18px 0 8px;font-size:14px;color:#b91c1c">🗑 بایگانی حذفیات و بررسی‌های آماری دلایل</h4>' +
      '<div id="repDeletedArcWrap" style="margin-bottom:24px"></div>' +
      '<h4 style="margin:18px 0 8px;font-size:14px">🕵️ رصد کلیه تحرکات (Audit Trail)</h4>' +
      '<div class="sb2" style="margin-bottom:8px"><select id="repMod" onchange="renderReports()" style="padding:8px;border:1px solid var(--brd);border-radius:10px;font-size:13px">' + mOpts + '</select></div>' +
      '<div id="repAudit"></div>';
  };

  window.renderReports = function () {
    if (typeof renderDeletedArchive === 'function') setTimeout(renderDeletedArchive, 50);
    var tb = document.getElementById('repTb');
    if (!tb) return;
    var period = (document.getElementById('repPeriod') || { value: 'm1' }).value;
    var fUser = (document.getElementById('repUser') || { value: '' }).value;
    var stats = userStats(period).filter(function (s) { return !fUser || s.name === fUser; });
    var h = '';
    stats.forEach(function (s) {
      h += '<tr><td><b>' + escP(s.name) + '</b></td><td style="font-size:11.5px">' + escP(s.role) + '</td>' +
        '<td>' + s.to + '</td><td>' + s.co + '</td>' +
        '<td>' + (s.won ? '<b style="color:#059669">' + s.won + '</b>' : '0') + '</td>' +
        '<td>' + s.sup + '</td><td>' + s.cust + '</td><td>' + s.lead + '</td>' +
        '<td>' + s.inv + '</td><td>' + s.let + '</td>' +
        '<td><b>' + s.acts + '</b></td></tr>';
    });
    tb.innerHTML = h || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:20px">داده‌ای در این بازه نیست</td></tr>';

    // Audit trail
    var el = document.getElementById('repAudit');
    if (!el) return;
    var fMod = (document.getElementById('repMod') || { value: '' }).value;
    var logs = getData('ptf_crm_audit').filter(function (a) {
      if (fUser && a.user !== fUser) return false;
      if (fMod && a.m !== fMod) return false;
      return inPeriod(a.t, period);
    }).slice(0, 150);
    el.innerHTML = logs.map(function (a) {
      return '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:6px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:4px;font-size:12px">' +
        '<span style="color:#94a3b8;min-width:120px">' + escP(a.t) + '</span>' +
        '<b>' + escP(a.user) + '</b> <span style="color:#64748b">(' + escP(a.role || '') + ')</span>' +
        '<span class="bd" style="background:#f1f5f9;color:#475569">' + escP(a.m) + '</span>' +
        '<span>' + escP(a.a) + '</span>' +
        (a.ref ? '<span style="color:#0e7490;direction:ltr">' + escP(a.ref) + '</span>' : '') + '</div>';
    }).join('') || '<div style="text-align:center;color:#94a3b8;padding:16px;font-size:12.5px">تحرکی در این بازه/فیلتر ثبت نشده</div>';
  };

  /* ---- روتینگ + گارد دسترسی ---- */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'rep') {
      if (!canReports()) { alert('⛔ ماژول گزارشات فقط برای مدیران ارشد (ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی) قابل دسترسی است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '📈 گزارشات';
      document.getElementById('panels').innerHTML = buildReports();
      renderReports();
      return;
    }
    _go(id, btn);
  };

  /* ---- مخفی‌سازی دکمه برای نقش‌های غیرمجاز (AC4) ---- */
  function hideRepBtn() {
    document.querySelectorAll('.sb-i').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'rep'") > -1) {
        b.style.display = canReports() ? '' : 'none';
      }
    });
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { hideRepBtn(); clearInterval(t); }
    if (tries > 40) clearInterval(t);
  }, 300);
  var _showCrm = window.showCrm;
  if (_showCrm) {
    window.showCrm = function () { _showCrm(); setTimeout(hideRepBtn, 400); };
  }
})();

  /* ============ Sprint 105: بایگانی حذفیات و تحلیل آماری دلایل ============ */
  window.renderDeletedArchive = function () {
    var arc = getData('ptf_crm_deleted_archive');
    var el = document.getElementById('repDeletedArcWrap');
    if (!el) return;
    if (!arc.length) {
      el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;background:#f8fafc;border-radius:14px;border:1px dashed var(--brd)">هیچ رکورد حذف‌شده‌ای در بایگانی آماری ثبت نشده است.</div>';
      return;
    }
    var h = '<div class="tb2"><table><thead><tr><th>#</th><th>نوع</th><th>کد / عنوان</th><th>دلیل حذف</th><th>توضیح تکمیلی</th><th>حذف‌کننده</th><th>تاریخ زمان</th><th>عملیات</th></tr></thead><tbody>';
    arc.forEach(function (x, i) {
      h += '<tr><td>' + (i+1) + '</td><td><span class="bd" style="background:#f1f5f9;color:#475569">' + escP(x.kind||'-') + '</span></td>' +
        '<td><b>' + escP(x.label||x.id||'-') + '</b></td>' +
        '<td><span class="bd" style="background:#fee2e2;color:#b91c1c">' + escP(x.reason||'-') + '</span></td>' +
        '<td style="font-size:11.5px;color:#64748b">' + escP(x.note||'—') + '</td>' +
        '<td>👤 ' + escP(x.by||'-') + '</td>' +
        '<td style="font-size:11px;direction:ltr">' + escP(x.t||x.iso||'-') + '</td>' +
        '<td>' + (x.kind === 'archive_purge' ? '<span class="bd" style="background:#f1f5f9;color:#475569" title="این tombstone حداقلی مانع بازگشت داده حذف‌شده از دستگاه قدیمی است و اطلاعات مالی ندارد">🔒 نگهبان عدم بازگشت</span>' : '<button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" title="حذف دائم از بایگانی" onclick="ptfPurgeArchiveItem(' + i + ')">✕</button>') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    el.innerHTML = h;
  };

  window.ptfPurgeArchiveItem = function (idx) {
    var arc = getData('ptf_crm_deleted_archive');
    if (arc[idx] && arc[idx].kind === 'archive_purge') { alert('این tombstone حداقلی قابل حذف نیست؛ برای جلوگیری از بازگشت پرونده پاک‌شده از کش دستگاه‌های قدیمی لازم است و در گزارش مالی اثری ندارد.'); return; }
    if (!confirm('آیا این رکورد از بایگانی آماری مدیریت نیز حذف شود؟')) return;
    arc.splice(idx, 1);
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deleted_archive', arc, { reason: 'w4' }); else setData('ptf_crm_deleted_archive', arc);
    renderDeletedArchive();
  };


/* ===== v34.0.4-alpha (BUG-UNIHUB-EMPTY-001): بازگردانی بدنهٔ «گزارش جامع مدیریتی» =====
   ptfBuildReportHtml حذف شده بود و مرکز فرماندهی همیشه «گزارشی ثبت نشده» نشان می‌داد.
   نسخهٔ ایستای آمار عملکرد کاربران (کل دوره) — بدون کنترل زنده/idهای rep* تا با پنل گزارشات تداخل نکند. */
window.ptfBuildReportHtml = function () {
  /* خارج از IIFE ماژول گزارشات است → هیچ تابع محلی‌ای در دسترس نیست؛ گارد نقش و محاسبه self-contained */
  var _role = (typeof curRole === 'function') ? curRole() : '';
  if (['admin', 'chairman', 'ceo', 'commercial'].indexOf(_role) === -1) return '<div style="text-align:center;padding:16px;color:#94a3b8">⛔ این گزارش فقط برای مدیران ارشد است.</div>';
  var stats = [];
  try {
    var users = (getData('ptf_crm_users') || []).map(function (u) { return { user: u.username, name: u.name, role: u.role }; });
    users.unshift({ user: 'admin', name: 'ادمین سیستم', role: 'ادمین' });
    var offers = getData('ptf_crm_offers') || [], custs = getData('ptf_crm_customers') || [],
        leads = getData('ptf_crm_leads') || [], invs = getData('ptf_crm_invoices') || [],
        auditLog = getData('ptf_crm_audit') || [];
    stats = users.map(function (u) {
      var myOffers = offers.filter(function (o) { return o.issuedBy === u.user || o.wonBy === u.name; });
      return {
        name: u.name, role: u.role,
        to: myOffers.filter(function (o) { return o.kind === 'TO'; }).length,
        co: myOffers.filter(function (o) { return o.kind === 'CO'; }).length,
        won: offers.filter(function (o) { return o.kind === 'CO' && o.st === 'won' && (o.issuedBy === u.user || o.wonBy === u.name); }).length,
        cust: custs.filter(function (c) { return c.by === u.name || c.createdBy === u.name; }).length,
        lead: leads.filter(function (l) { return l.by === u.name || l.createdBy === u.name; }).length,
        inv: invs.filter(function (i) { return i.by === u.name; }).length,
        acts: auditLog.filter(function (a) { return a.user === u.name; }).length
      };
    });
  } catch (e) {}
  var rows = stats.map(function (u) {
    return '<tr><td>' + escP(u.name) + '</td><td>' + escP(u.role) + '</td><td>' + u.to + '</td><td>' + u.co + '</td><td>' + u.won + '</td><td>' + u.cust + '</td><td>' + u.lead + '</td><td>' + u.inv + '</td><td>' + u.acts + '</td></tr>';
  }).join('');
  return '<h4 style="margin:6px 0 8px;font-size:13.5px">📊 گزارش جامع عملکرد کاربران (از ابتدا تاکنون)</h4>' +
    '<div class="tb2"><table><thead><tr><th>کاربر</th><th>نقش</th><th>TO فنی</th><th>CO مالی</th><th>CO برنده</th><th>مشتری</th><th>لید</th><th>فاکتور</th><th>کل اقدامات</th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:14px">داده‌ای ثبت نشده</td></tr>') + '</tbody></table></div>' +
    '<div style="text-align:left;margin-top:8px"><button class="bt bt-o" style="font-size:12px" onclick="this.closest(\'.md-b\').remove();if(typeof goPanel===\'function\')goPanel(\'reports\')">📈 نسخهٔ کامل با فیلتر بازه/کاربر/ماژول در «گزارشات» ↗</button></div>';
};

window.ptfOpenUnifiedAnalyticsHub = function () {
  if (typeof isSenior === 'function' && !isSenior()) { alert('⛔ دسترسی به مرکز فرماندهی تحلیل و گزارشات فقط برای مدیران ارشد مجاز است'); return; }
  var deals = getData('ptf_crm_deals');
  var invs = getData('ptf_crm_invoices');
  var payables = getData('ptf_crm_payables');
  
  // Quick executive metrics
  var totalWonIRR = deals.reduce(function(s,d){ return s + (d.wonOffer && typeof offerTotal === 'function' ? offerTotal(getData('ptf_crm_offers').filter(function(o){return o.no===d.wonOffer;})[0]||{}) : 0); }, 0);
  var totalOpenRecv = invs.reduce(function(s,i){ var p = ((i.payments||[]).concat(i.pays||[])).reduce(function(z,x){return z+(+x.amt||0);},0); return s + Math.max(0, i.amount - p); }, 0);
  var totalPayables = payables.reduce(function(s,p){ return s + (+p.amount||0)*(p.cur==='IRR'?1:(+p.rate||110000)); }, 0);
  
  var html = '<div class="md-b" id="uniHubDlg" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:92vh;overflow:auto">' +
    '<h3>📊 مرکز فرماندهی تحلیل و گزارشات جامع مدیریتی</h3>' +
    '<div style="font-size:12px;color:#64748b;margin-bottom:12px">یکپارچه‌سازی ابزارهای تحلیلی (`analyzer.js`) و گزارشات عملکرد (`reports.js`) در یک مرکز فرماندهی واحد.</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px">' +
      '<div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:12px;padding:12px;text-align:center"><b>🏆 حجم کل پرونده‌های برنده</b><br><span style="font-size:16px;font-weight:bold;color:#059669">' + Math.round(totalWonIRR/1e6).toLocaleString('fa-IR') + ' میلیون ریال</span></div>' +
      '<div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:12px;text-align:center"><b>💰 مطالبات باز (وصول‌نشده)</b><br><span style="font-size:16px;font-weight:bold;color:#b45309">' + Math.round(totalOpenRecv/1e6).toLocaleString('fa-IR') + ' میلیون ریال</span></div>' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;text-align:center"><b>💳 بدهی به تامین‌کنندگان</b><br><span style="font-size:16px;font-weight:bold;color:#dc2626">' + Math.round(totalPayables/1e6).toLocaleString('fa-IR') + ' میلیون ریال</span></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:16px">' +
      '<button class="bt" style="background:#7c3aed" onclick="document.getElementById(\'uniHubDlg\').remove();if(typeof openAnalyzer===\'function\')openAnalyzer();">🧠 اجرای تحلیل هوشمند 360 درجه پروژه (`analyzer.js`)</button>' +
      '<button class="bt bt-o" style="color:#0e7490;border-color:#bae6fd" onclick="document.getElementById(\'uniHubDlg\').remove();if(typeof ptfScoreReport===\'function\')ptfScoreReport();">📋 گزارش امتیازها و بدهی‌های تامین‌کنندگان</button>' +
      '<button class="bt bt-o" style="color:#059669;border-color:#a7f3d0" onclick="document.getElementById(\'uniHubDlg\').remove();if(typeof ptfFiscalSnapshotOpen===\'function\')ptfFiscalSnapshotOpen();">🔒 اسنپ‌شات و ترازنامه سال مالی</button>' +
    '</div>' +
    '<div id="repFullContent">' + (typeof ptfBuildReportHtml === 'function' ? ptfBuildReportHtml() : '<div style="text-align:center;padding:16px">گزارشی ثبت نشده</div>') + '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="bt bt-o" onclick="document.getElementById(\'uniHubDlg\').remove()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
};
