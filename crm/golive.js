/* =====================================================================
   PTF CRM — golive.js — v14.5 — US-377 (دستور کارفرما)
   🔴 پاک‌سازی داده‌های آزمایشی و شروع بهره‌برداری واقعی (Go-Live Reset)
   - فقط ادمین | تایید سه‌مرحله‌ای | بک‌آپ اجباری pre-golive (دانلود + سرور)
   - پاک می‌شود: داده‌های تراکنشی ورودی آزمایشی (فهرست WIPE_KEYS)
   - پاک نمی‌شود: کاربران/نقش‌ها/مجوزها/تنظیمات/امضاها/متن‌های آماده/ترجیحات UI
   - کالاها و تامین‌کنندگان: انتخابی (چک‌باکس ادمین)
   - سرور هم پاک می‌شود (سینک کلیدهای خالی) تا داده آزمایشی برنگردد
   ===================================================================== */
(function () {
  'use strict';
  function ptfGoLiveAuthHeaders(json) { var h = json ? { 'Content-Type': 'application/json' } : {}; try { h['X-CRM-Role'] = curRole(); var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; }

  /* داده‌های تراکنشی آزمایشی — همیشه پاک می‌شوند */
  var WIPE_KEYS = [
    'ptf_crm_rfqs', 'ptf_crm_customers', 'ptf_crm_leads', 'ptf_crm_inqitems',
    'ptf_crm_offers', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_packinglists',
    'ptf_crm_rfqsmart', 'ptf_crm_buyquotes', 'ptf_crm_buycmp', 'ptf_crm_inqreads',
    'ptf_crm_invoices', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots','ptf_crm_management_actions','ptf_crm_management_reports', 'ptf_crm_opex', 'ptf_crm_supplier_finance', 'ptf_crm_cheques',
    'ptf_crm_letters', 'ptf_crm_contracts', 'ptf_crm_reminders', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs',
    'ptf_crm_notifs', 'ptf_crm_sendqueue', 'ptf_crm_trash', 'ptf_crm_deleted_archive',
    'ptf_crm_finance', 'ptf_crm_order_prices', 'ptf_crm_payables', 'ptf_crm_surplus', 'ptf_crm_smsbook'
  ];
  /* انتخابی‌ها */
  var OPT_KEYS = { prods: 'ptf_crm_products', sups: 'ptf_crm_suppliers', audit: 'ptf_crm_audit' };
  /* هرگز پاک نمی‌شوند (سند US-377):
     ptf_crm_users, ptf_crm_perms, ptf_crm_settings, ptf_crm_sigprofiles,
     ptf_crm_msgtpls, ptf_crm_notifprefs, ptf_crm_avatars, ترجیحات UI (ptf_theme و…) */

  function wipeCount(k) {
    try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.length : 1; } catch (e) { return 0; }
  }

  window.ptfGoLiveOpen = function () {
    /* v34.4.48: دادهٔ واقعی ثبت شده — مسیر پاک‌سازی آزمایشی بازنشسته است. */
    alert('این سامانه در حال بهره‌برداری واقعی است.\nپاک‌سازی یکجای داده‌های آزمایشی غیرفعال شد تا اطلاعات جاری از بین نرود.');
    return;
    if (curRole() !== 'admin') { alert('⛔ پاک‌سازی داده‌های آزمایشی فقط توسط ادمین ممکن است'); return; }
    var rows = WIPE_KEYS.map(function (k) {
      var n = wipeCount(k);
      return '<tr><td style="direction:ltr;font-size:11px">' + escP(k.replace('ptf_crm_', '')) + '</td><td>' + n + '</td></tr>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:620px;max-height:92vh;overflow:auto">' +
      '<h3>🔴 پاک‌سازی داده‌های آزمایشی — شروع بهره‌برداری واقعی (US-377)</h3>' +
      '<div style="background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:12px 16px;font-size:13px;color:#b91c1c;line-height:2;margin-bottom:12px">' +
      '⚠️ <b>این عملیات غیرقابل بازگشت است.</b> همه داده‌های ورودی دوره آزمایشی حذف می‌شوند تا سامانه با داده واقعی شروع به کار کند.<br>' +
      '✅ <b>حفظ می‌شود:</b> کاربران و نقش‌ها، مجوزها، تنظیمات (بات/تم/بک‌آپ)، امضاها، متن‌های آماده، ترجیحات ظاهری.<br>' +
      '🛡 پیش از اجرا، <b>بک‌آپ کامل اجباری</b> (فایل دانلودی + نسخه سروری pre-golive) گرفته می‌شود.</div>' +
      '<div class="tb2" style="max-height:200px;overflow:auto;margin-bottom:10px"><table><thead><tr><th>بخش (پاک می‌شود)</th><th>تعداد رکورد</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:10px 14px;font-size:12.5px;margin-bottom:12px">' +
      '<b>موارد انتخابی:</b><br>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer"><input type="checkbox" id="glWipeProds"> 📦 کاتالوگ کالاها هم پاک شود (' + wipeCount(OPT_KEYS.prods) + ' کالا) — اگر کالاهای آزمایشی‌اند</label>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer"><input type="checkbox" id="glWipeSups"> 🏭 تامین‌کنندگان هم پاک شوند (' + wipeCount(OPT_KEYS.sups) + ' رکورد)</label>' +
      '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer"><input type="checkbox" id="glWipeAudit" checked> 🧾 رد پای (audit) دوره آزمایشی هم پاک شود</label></div>' +
      '<div class="fld"><label>برای تایید، کلمه «پاکسازی» را تایپ کنید:</label><input type="text" id="glConfirmWord" style="direction:rtl" placeholder="پاکسازی"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#dc2626" onclick="ptfGoLiveRun(this)">🔴 بک‌آپ اجباری + پاک‌سازی نهایی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfGoLiveRun = function (btn) {
    /* v34.4.48: حتی با فراخوانی دستی/قدیمی، wipe اجرا نمی‌شود. */
    alert('پاک‌سازی آزمایشی بازنشسته است؛ هیچ رکوردی حذف نشد.');
    return;
    if (curRole() !== 'admin') return;
    var word = (document.getElementById('glConfirmWord') || {}).value || '';
    if (word.trim() !== 'پاکسازی') { alert('برای تایید باید دقیقا کلمه «پاکسازی» تایپ شود'); return; }
    if (!confirm('🔴 تایید نهایی (مرحله ۳ از ۳)\n\nهمه داده‌های آزمایشی حذف و سامانه برای بهره‌برداری واقعی آماده می‌شود.\nبک‌آپ pre-golive همین حالا گرفته و دانلود می‌شود.\n\nاجرا شود؟')) return;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال بک‌آپ و پاک‌سازی…'; }

    /* ۱) بک‌آپ اجباری: فایل دانلودی محلی */
    var backupOk = false;
    try { if (typeof ptfBackupDownload === 'function') { ptfBackupDownload(); backupOk = true; } } catch (e) {}
    if (!backupOk) {
      alert('⛔ بک‌آپ محلی گرفته نشد — عملیات متوقف شد (بدون بک‌آپ موفق اجرا نمی‌شود)');
      if (btn) { btn.disabled = false; btn.textContent = '🔴 بک‌آپ اجباری + پاک‌سازی نهایی'; }
      return;
    }
    /* ۲) نسخه سروری pre-golive (best-effort — اگر سرور بود) */
    var doWipe = function () {
      var wipeProds = !!(document.getElementById('glWipeProds') || {}).checked;
      var wipeSups = !!(document.getElementById('glWipeSups') || {}).checked;
      var wipeAudit = (document.getElementById('glWipeAudit') || { checked: true }).checked;
      var keys = WIPE_KEYS.slice();
      if (wipeProds) keys.push(OPT_KEYS.prods);
      if (wipeSups) keys.push(OPT_KEYS.sups);
      if (wipeAudit) keys.push(OPT_KEYS.audit);
      /* v14.7 (US-382): عبور رسمی از سپر داده‌صفر — فقط این مسیر مجاز به ارسال خالی است */
      window._ptfGoLiveWipe = true;
      /* پاک‌سازی محلی + سرور (setData خالی → sync.js push می‌کند و از crm.php برنمی‌گردد) */
      keys.forEach(function (k) {
        try { setData(k, []); } catch (e) { try { localStorage.setItem(k, '[]'); } catch (e2) {} }
      });
      /* push مستقیم با فلگ allow_wipe به سرور (سپر سروری US-382) */
      try {
        var wipeData = {};
        keys.forEach(function (k) { wipeData[k] = '[]'; });
        fetch('../api/crm.php?action=data_push', {
          method: 'POST', headers: ptfGoLiveAuthHeaders(true),
          body: JSON.stringify({ by: curSession().name + ' (GO-LIVE)', allow_wipe: true, data: wipeData })
        });
        localStorage.removeItem('ptf_guard_counts'); /* baseline نو */
        localStorage.removeItem('ptf_sync_krevs'); /* v15.0 US-384: شمارنده‌های per-key هم نو شوند */
      } catch (eW2) {}
      /* شمارنده‌های نشست کدساز از نو (US-377 AC7) */
      try { window._ptfCodeSeq = {}; } catch (e) {}
      /* کلیدهای جانبی آزمایشی */
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (/^ptf_ai_hist_|^ptf_autodraft_offer_|^ptf_backup_local$|^ptf_backup_prerestore$/.test(k)) localStorage.removeItem(k);
        });
      } catch (e) {}
      /* v34.8.40 (R2/T5-2c): همین پاک‌سازی در Dev-KV (IndexedDB) + پیشوندهای تازه —
         پیش‌نویس‌ها دیگر در localStorage نیستند. */
      try {
        if (window.ptfDevKv) {
          ['ptf_autodraft_offer_', 'ptf_autodraft_award_revision_'].forEach(function (pre) {
            try {
              window.ptfDevKv.keys(pre, function (ks) {
                (ks || []).forEach(function (k) { try { window.ptfDevKv.remove(k); } catch (eR) {} });
              });
            } catch (eK) {}
          });
        }
      } catch (eKv) {}
      /* رویداد آغاز بهره‌برداری در audit جدید */
      try { audit('سیستم', '🚀 شروع بهره‌برداری واقعی — پاک‌سازی داده‌های آزمایشی توسط ' + curSession().name + (wipeProds ? ' (شامل کالاها)' : '') + (wipeSups ? ' (شامل تامین‌کنندگان)' : ''), 'GO-LIVE'); } catch (e) {}
      alert('✅ پاک‌سازی انجام شد — سامانه آماده بهره‌برداری واقعی است.\n\n🗂 بک‌آپ pre-golive دانلود شد؛ آن را خارج از سامانه نگه دارید.\nسیستم مجددا بارگذاری می‌شود.');
      setTimeout(function () { location.reload(); }, 800);
    };
    if (typeof ptfBackupNow === 'function') {
      /* pushBackup سروری — اجرای wipe پس از پاسخ (موفق یا ناموفق؛ فایل محلی بیمه اصلی است) */
      try {
        fetch('../api/crm.php?action=save_backup', {
          method: 'POST', headers: ptfGoLiveAuthHeaders(true),
          body: JSON.stringify({ app: 'PTF-CRM', ver: 145, t: new Date().toISOString(), tFa: faDateTime(), by: curSession().name + ' (pre-golive)', counts: {}, data: (function () { var d = {}; WIPE_KEYS.concat([OPT_KEYS.prods, OPT_KEYS.sups, OPT_KEYS.audit, 'ptf_crm_users', 'ptf_crm_settings']).forEach(function (k) { /* v34.38.9 (BACKUP-BLIND-SPOT): آینهٔ فاز B — کلیدهای offloadشده در localStorage نیستند */ var v = (typeof window.ptfBackupReadKey === 'function') ? window.ptfBackupReadKey(k) : localStorage.getItem(k); if (v !== null && v !== undefined) d[k] = v; }); return d; })() })
        }).then(function () { doWipe(); }).catch(function () { doWipe(); });
      } catch (e) { doWipe(); }
    } else doWipe();
  };

  /* باکس در تنظیمات — انتهای زنجیره hook (فقط ادمین می‌بیند) */
  function goliveBoxHtml() {
    if (curRole() !== 'admin') return '';
    return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
      '<h4 style="margin:0 0 8px;color:#065f46">بهره‌برداری واقعی (پاک‌سازی آزمایشی بازنشسته)</h4>' +
      '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px;font-size:12.5px;margin-bottom:10px;color:#065f46">داده‌های جاری رسمی‌اند. پاک‌سازی یکجای آزمایشی غیرفعال است تا مشتریان، پرونده‌ها و اسناد مالی حفظ شوند.</div>';
  }
  function hookSettings() {
    if (window._goliveHooked || typeof window.buildSettings !== 'function') return false;
    window._goliveHooked = true;
    var _bs = window.buildSettings;
    window.buildSettings = function () { return _bs() + '<div style="max-width:560px">' + goliveBoxHtml() + '</div>'; };
    return true;
  }
  var gt = 0;
  var gi = setInterval(function () { gt++; if (hookSettings() || gt > 50) clearInterval(gi); }, 450);
})();
