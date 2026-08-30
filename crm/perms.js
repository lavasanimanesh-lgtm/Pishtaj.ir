/* =====================================================================
   PTF CRM — Sprint 80 (perms.js)
   US-166: دسترسی شخصی‌سازی‌شده per کاربر (override روی نقش)
   US-167: حالت شب/روز
   ===================================================================== */
(function () {
  'use strict';

  /* ============ US-166: Override دسترسی per کاربر ============ */
  // ساختار: ptf_crm_perms = { username: { panelId: 'allow'|'deny' } } — نبود کلید = پیش‌فرض نقش
  var ALL_PANELS = [
    { id: 'rfq', lb: 'درخواست‌ها' }, { id: 'cust', lb: 'مشتریان' }, { id: 'leads', lb: 'لیدها' },
    { id: 'off', lb: 'پیشنهادها (TO/CO)' }, { id: 'deals', lb: 'پرونده‌های فروش' }, { id: 'inqs', lb: 'اقلام درخواست‌ها' },
    { id: 'sup', lb: 'تامین‌کنندگان' }, { id: 'rfqs', lb: 'درخواست تامین' }, { id: 'buyq', lb: 'قیمت‌های خرید' },
    { id: 'prod', lb: 'کالاها' }, { id: 'surplus', lb: 'موجودی انبار' }, { id: 'chqprint', lb: 'چاپ چک فیزیکی' }, { id: 'prj', lb: 'بایگانی' }, { id: 'let', lb: 'مکاتبات' }, { id: 'cnt', lb: 'قراردادها' }, { id: 'taxret', lb: 'اظهارنامه‌ها' },
    { id: 'inv', lb: 'فاکتورها' }, { id: 'recv', lb: 'مطالبات' }, { id: 'orders', lb: 'سفارشات و سود' }, { id: 'petty', lb: 'هاب مالی' }, { id: 'anl', lb: 'تحلیلگر' },
    { id: 'rem', lb: 'یادآورها' }, { id: 'sms', lb: 'سامانه پیامکی' }, { id: 'cms', lb: 'مدیریت سایت' }, { id: 'rep', lb: 'گزارشات' },
    { id: 'ai', lb: 'دستیار (AI)' } /* v14.9 US-383: قابل کنترل per کاربر */
  ];

  function permsAll() { try { return JSON.parse(localStorage.getItem('ptf_crm_perms') || '{}'); } catch (e) { return {}; } }
  function permsSave(p) { if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_perms', p, { reason: 'w4' }); else setData('ptf_crm_perms', p); }
  window.permOverride = function (username, panelId) {
    var p = permsAll()[username];
    return p ? (p[panelId] || null) : null; // 'allow' | 'deny' | null
  };

  // گارد مرکزی: canPanel اصلی + override — استفاده در goPanel سراسری
  window.ptfCanAccess = function (panelId) {
    var s = curSession();
    var ov = permOverride(s.user, panelId);
    if (ov === 'allow') return true;
    if (ov === 'deny') return false;
    // پیش‌فرض نقش (منطق موجود)
    var r = roleDef();
    if (panelId === 'orders' || panelId === 'fin') return !!r.finance;
    if (panelId === 'users') return !!r.users;
    /* v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح رییس هیات مدیره */
    /* v34.9.1: پنل سرچ کنسول هم‌سطح مدیریت سایت */
    if (panelId === 'rep' || panelId === 'cms' || panelId === 'gsc') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1;
    if (panelId === 'sms') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1;
    if (panelId === 'petty') return true; // تنخواه: همه ثبت می‌کنند (دید داخلش کنترل می‌شود)
    if (r.panels === '*') return true;
    return r.panels.indexOf(panelId) > -1;
  };

  // hook سراسری روی goPanel: اول از همه override چک شود
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    var s = curSession();
    var ov = permOverride(s.user, id);
    if (ov === 'deny') { alert('⛔ دسترسی شما به این بخش توسط مدیر مسدود شده است'); return; }
    if (ov === 'allow') {
      // مسیر ویژه: پنل‌هایی که گارد نقشی داخلی دارند را مستقیم بساز
      var builders = window._ptfPanelBuilders || {};
      if (builders[id]) { builders[id](btn); return; }
    }
    _go(id, btn);
  };
  // ثبت builder مستقیم برای پنل‌های گارد‌دار (تا allow-override واقعا کار کند)
  window._ptfPanelBuilders = window._ptfPanelBuilders || {};
  function reg(id, title, build, render) {
    window._ptfPanelBuilders[id] = function (btn) {
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = title;
      document.getElementById('panels').innerHTML = build();
      if (render) render();
    };
  }
  // ثبت پنل‌های دارای گارد داخلی (در لود بعدی ماژول‌ها موجودند)
  setTimeout(function () {
    if (typeof buildCartable === 'function') {
      reg('let', '✉️ مکاتبات', window.buildLetters || function(){return '';}, window.renderLetters);
      reg('cms', '🎛 مدیریت سایت', window.buildCms || function(){return '';}, window.renderCms);
      reg('sms', '💬 سامانه پیامکی', window.buildSmsPanel || function(){return '';}, window.renderSmsPanel);
      reg('rep', '📈 گزارشات', window.buildReports || function(){return '';}, window.renderReports);
      reg('inv', '🧾 فاکتورها', window.buildInvoices || function(){return '';}, window.renderInvoices);
      reg('recv', '💰 مطالبات', window.buildReceivables || function(){return '';}, window.renderReceivables);
      reg('buyq', '🛒 قیمت‌های خرید', window.buildBuyQuotes || function(){return '';}, window.renderBuyQuotes);
      reg('taxret', '📁 اظهارنامه‌ها', window.buildTaxReturns || function(){return '';}, window.renderTaxReturns);
    }
  }, 1200);

  /* ---- US-181: پیش‌فرض نقش برای هر کاربر دلخواه (نه فقط کاربر جاری) ---- */
  function roleDefaultFor(role, panelId) {
    var r = (typeof ROLES !== 'undefined' && ROLES[role]) || null;
    if (!r) return false;
    if (panelId === 'orders' || panelId === 'fin') return !!r.finance;
    if (panelId === 'users') return !!r.users;
    /* v14.9 (US-383): rep/cms برای مدیران ارشد */
    if (panelId === 'rep' || panelId === 'cms') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1;
    if (panelId === 'sms') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1;
    if (panelId === 'petty') return true;
    if (r.panels === '*') return true;
    return r.panels.indexOf(panelId) > -1;
  }
  window.ptfRoleDefaultFor = roleDefaultFor;

  // دسترسی موثر کاربر (override یا پیش‌فرض نقش) — برای نمایش شفاف به مدیر
  window.ptfEffectiveAccess = function (username, role, panelId) {
    var ov = permOverride(username, panelId);
    if (ov === 'allow') return true;
    if (ov === 'deny') return false;
    return roleDefaultFor(role, panelId);
  };

  /* ---- UI: مودال «🎛 دسترسی» — US-181: فقط دو ستون مجاز/غیرمجاز ----
     ستون «پیش‌فرض نقش» حذف شد؛ مدیر وضعیت *واقعی* هر ماژول را می‌بیند و با یک
     کلیک عوض می‌کند. ذخیره: فقط مواردی که با پیش‌فرض نقش فرق دارند به‌عنوان
     override ثبت می‌شوند (ساختار داده و سینک قبلی دست نمی‌خورد). ---- */
  window.showPermModal = function (username) {
    /* v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح رییس هیات مدیره */
    if (['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0) { alert('⛔ فقط مدیران ارشد'); return; }
    var u = getData('ptf_crm_users').filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    var rows = ALL_PANELS.map(function (p) {
      var eff = ptfEffectiveAccess(username, u.roleId || u.role, p.id); // v85.2: roleId نه برچسب فارسی
      var isOv = !!permOverride(username, p.id);
      return '<tr><td style="text-align:right;font-size:12.5px">' + p.lb +
        (isOv ? ' <span title="متفاوت با پیش‌فرض نقش" style="font-size:10px;background:#fef3c7;color:#b45309;border-radius:7px;padding:1px 6px">شخصی</span>' : '') + '</td>' +
        '<td><label style="cursor:pointer;font-size:11.5px;white-space:nowrap"><input type="radio" name="pm_' + p.id + '" value="allow"' + (eff ? ' checked' : '') + '> ✅ مجاز</label></td>' +
        '<td><label style="cursor:pointer;font-size:11.5px;white-space:nowrap"><input type="radio" name="pm_' + p.id + '" value="deny"' + (!eff ? ' checked' : '') + '> ⛔ غیرمجاز</label></td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
      '<h3>🎛 دسترسی‌های ' + escP(u.name) + ' <small style="color:#94a3b8">(' + escP(u.role) + ')</small></h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">وضعیت فعلی هر ماژول برای این کاربر نمایش داده شده — کافی است مجاز/غیرمجاز را عوض کنید. تغییرات آنی اعمال و بین دستگاه‌ها سینک می‌شود. برچسب «شخصی» یعنی قبلاً برای این کاربر خارج از نقشش تنظیم شده.</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
      '<button class="bt bt-o" style="font-size:11.5px" onclick="permsSetAll(true)">✅ همه مجاز</button>' +
      '<button class="bt bt-o" style="font-size:11.5px" onclick="permsSetAll(false)">⛔ همه غیرمجاز</button>' +
      '<button class="bt bt-o" style="font-size:11.5px;color:#7c3aed" onclick="permsResetRole(\'' + ptfOnClickArg(username) + '\')">↩️ بازگشت به پیش‌فرض نقش</button></div>' +
      '<div class="tb2"><table><thead><tr><th>ماژول</th><th>مجاز</th><th>غیرمجاز</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
      '<button class="bt" onclick="savePerms(\'' + ptfOnClickArg(username) + '\')">💾 ذخیره دسترسی‌ها</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.permsSetAll = function (allow) {
    ALL_PANELS.forEach(function (p) {
      var el = document.querySelector('input[name="pm_' + p.id + '"][value="' + (allow ? 'allow' : 'deny') + '"]');
      if (el) el.checked = true;
    });
  };

  window.permsResetRole = function (username) {
    var u = getData('ptf_crm_users').filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    ALL_PANELS.forEach(function (p) {
      var def = roleDefaultFor(u.roleId || u.role, p.id);
      var el = document.querySelector('input[name="pm_' + p.id + '"][value="' + (def ? 'allow' : 'deny') + '"]');
      if (el) el.checked = true;
    });
    if (typeof ptfToast === 'function') ptfToast('به پیش‌فرض نقش برگشت — «ذخیره» را بزنید', 'ok');
  };

  window.savePerms = function (username) {
    var u = getData('ptf_crm_users').filter(function (x) { return x.username === username; })[0];
    if (!u) return;
    var all = permsAll();
    var mine = {};
    // US-181: فقط تفاوت با پیش‌فرض نقش به‌عنوان override ذخیره می‌شود
    ALL_PANELS.forEach(function (p) {
      var sel = document.querySelector('input[name="pm_' + p.id + '"]:checked');
      if (!sel) return;
      var want = sel.value === 'allow';
      var def = roleDefaultFor(u.roleId || u.role, p.id);
      if (want !== def) mine[p.id] = want ? 'allow' : 'deny';
    });
    if (Object.keys(mine).length) all[username] = mine; else delete all[username];
    permsSave(all);
    audit('کاربران', 'به‌روزرسانی دسترسی‌های شخصی‌سازی‌شده', username);
    hideModal();
    if (typeof ptfToast === 'function') ptfToast('دسترسی‌ها ذخیره شد و بین دستگاه‌ها سینک می‌شود', 'ok');
    if (typeof renderUsers === 'function') renderUsers();
  };

  // دکمه 🎛 کنار هر کاربر در جدول کاربران
  var _renderUsers2 = window.renderUsers2;
  if (typeof _renderUsers2 === 'function') {
    window.renderUsers2 = function () {
      _renderUsers2();
      if (['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0) return; /* v14.9 US-383 */
      var tb = document.getElementById('uTb');
      if (!tb) return;
      tb.querySelectorAll('tr').forEach(function (tr) {
        var strong = tr.querySelector('td strong');
        if (!strong) return;
        var un = strong.textContent.trim();
        if (un === 'admin' || tr.querySelector('.pm-btn')) return;
        var last = tr.querySelectorAll('td');
        last[last.length - 1].insertAdjacentHTML('beforeend',
          ' <button class="bt bt-o pm-btn" style="padding:3px 9px;font-size:12px;color:#7c3aed" title="شخصی‌سازی دسترسی ماژول‌ها" onclick="showPermModal(\'' + ptfOnClickArg(un) + '\')">🎛 دسترسی</button>');
      });
    };
    window.renderUsers = window.renderUsers2;
  }

  /* ============ US-167: حالت شب/روز ============ */
  var darkCss = document.createElement('style');
  darkCss.id = 'ptfDarkCss';
  darkCss.textContent =
    'body.ptf-dark{--bg:#0f172a;--crd:#1e293b;--tx:#e2e8f0;--brd:#334155}' +
    'body.ptf-dark{background:var(--bg);color:var(--tx)}' +
    'body.ptf-dark .ca{background:var(--bg)}' +
    'body.ptf-dark .tb{background:#1e293b;border-color:#334155}' +
    'body.ptf-dark .tb h2{color:#e2e8f0}' +
    'body.ptf-dark .md,body.ptf-dark .ptfdlg{background:#1e293b;color:#e2e8f0}' +
    'body.ptf-dark .md h3,body.ptf-dark .ptfdlg h3{color:#f1f5f9}' +
    'body.ptf-dark input,body.ptf-dark select,body.ptf-dark textarea{background:#0f172a;color:#e2e8f0;border-color:#334155}' +
    'body.ptf-dark .tb2 table{color:#e2e8f0}' +
    'body.ptf-dark .tb2 th{background:#0f172a;color:#94a3b8}' +
    'body.ptf-dark .tb2 td{border-color:#334155}' +
    'body.ptf-dark .sc{background:#1e293b;color:#e2e8f0;border-color:#334155}' +
    'body.ptf-dark .sc b{color:#ffb033}' +
    'body.ptf-dark [style*="background:#fff"],body.ptf-dark [style*="background:#f8fafc"],body.ptf-dark [style*="background:#fafbfc"]{background:#1e293b!important;color:#e2e8f0}' +
    'body.ptf-dark [style*="color:#1e293b"],body.ptf-dark [style*="color:#334155"],body.ptf-dark [style*="color:#475569"]{color:#cbd5e1!important}' +
    'body.ptf-dark .bt.bt-o{background:#0f172a;color:#cbd5e1;border-color:#334155}';
  document.head.appendChild(darkCss);

  /* v14.1 (US-354): حالت «خودکار» — دنبال کردن تنظیم سیستم (موبایل و دسکتاپ) */
  window.ptfThemeEffective = function () {
    var m = localStorage.getItem('ptf_theme') || 'light';
    if (m !== 'auto') return m;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  };
  window.ptfApplyTheme = function () {
    var eff = ptfThemeEffective();
    document.body.classList.toggle('ptf-dark', eff === 'dark');
    /* متغیرهای ریشه هم سینک شوند (هماهنگ با بلوک ضد FOUC هد) */
    var r = document.documentElement;
    if (eff === 'dark') {
      r.style.setProperty('--bg', '#0f172a'); r.style.setProperty('--crd', '#1e293b');
      r.style.setProperty('--tx', '#f8fafc'); r.style.setProperty('--brd', '#334155'); r.style.setProperty('--sb', '#0f172a');
    } else {
      ['--bg', '--crd', '--tx', '--brd', '--sb'].forEach(function (v) { r.style.removeProperty(v); });
    }
    /* آیکون ماه/خورشید نوار بالا */
    try {
      var b = document.getElementById('tbThemeBtn');
      if (b && window._ptfThemeIcons) b.innerHTML = eff === 'dark' ? _ptfThemeIcons.sun : _ptfThemeIcons.moon;
    } catch (e) {}
  };
  window.ptfSetTheme = function (mode) {
    localStorage.setItem('ptf_theme', mode);
    ptfApplyTheme();
    if (typeof ptfToast === 'function') ptfToast(mode === 'auto' ? '🌓 حالت خودکار (هماهنگ با سیستم) فعال شد' : mode === 'dark' ? '🌙 حالت شب فعال شد' : '☀️ حالت روز فعال شد', 'ok');
  };
  /* گوش دادن زنده به تغییر تم سیستم (غروب/طلوع یا سوییچ دستی OS) */
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if ((localStorage.getItem('ptf_theme') || '') === 'auto') ptfApplyTheme();
    });
  } catch (e) {}
  /* اعمال اولیه (پوشش حالت auto که بلوک هد نمی‌شناخت) */
  setTimeout(function () { try { ptfApplyTheme(); } catch (e) {} }, 100);
  window.ptfThemeBoxHtml = function () {
    var cur = localStorage.getItem('ptf_theme') || 'light';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px">🌗 حالت نمایش (US-167/354)</h4>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="bt' + (cur === 'light' ? '' : ' bt-o') + '" onclick="ptfSetTheme(\'light\')">☀️ روز</button>' +
      '<button class="bt' + (cur === 'dark' ? '' : ' bt-o') + '" onclick="ptfSetTheme(\'dark\')">🌙 شب</button>' +
      '<button class="bt' + (cur === 'auto' ? '' : ' bt-o') + '" onclick="ptfSetTheme(\'auto\')">🌓 خودکار (هماهنگ با سیستم)</button></div>' +
      '<small style="color:#94a3b8;font-size:11.5px">خودکار: روز/شب را از تنظیم گوشی یا کامپیوتر شما دنبال می‌کند</small>';
  };
  // اعمال ترجیح ذخیره‌شده در لود
  if ((localStorage.getItem('ptf_theme') || '') === 'dark') {
    document.addEventListener('DOMContentLoaded', function () { document.body.classList.add('ptf-dark'); });
    if (document.body) document.body.classList.add('ptf-dark');
  }
  // تزریق به تنظیمات
  var _bs = window.buildSettings;
  if (_bs) {
    window.buildSettings = function () { return _bs() + '<div style="max-width:560px">' + ptfThemeBoxHtml() + '</div>'; };
  }
})();
