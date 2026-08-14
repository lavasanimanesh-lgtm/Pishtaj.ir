  /* v33.12.0 (بازخورد کارفرما): دارک‌مود برای باکس‌های با پس‌زمینهٔ روشن ثابت
     («تعهدات نقدینگی تأمین و چک‌های شرکت» و «برنامه‌ریزی فصلی مالیات») — در نمای شب
     پس‌زمینهٔ روشن قبلی متن را ناخوانا می‌کرد. */
  (function () {
    var css = document.createElement('style');
    css.textContent =
      'body.ptf-dark #slLiquidity{background:#1e293b !important;border-color:#334155 !important;color:#e2e8f0}' +
      'body.ptf-dark #slLiquidity b{color:#fbbf24}' +
      'body.ptf-dark #slLiquidity small,body.ptf-dark #slLiquidity span{color:#cbd5e1}' +
      'body.ptf-dark #slLiquidity .sc{background:#0f172a;border-color:#334155}' +
      'body.ptf-dark #ptfTaxPlannerBox{background:#0f172a !important;border-color:#334155 !important;color:#e2e8f0}' +
      'body.ptf-dark #ptfTaxPlannerBox h4,body.ptf-dark #ptfTaxPlannerBox label{color:#f1f5f9}' +
      'body.ptf-dark #ptfTaxPlannerBox input,body.ptf-dark #ptfTaxPlannerBox select{background:#1e293b;color:#e2e8f0;border-color:#334155}';
    try { document.head.appendChild(css); } catch (e) {}
  })();

  /* =====================================================================
   PTF CRM — v31.9 + Phase 2 / Step 3 (جداسازی گزارشی رسمی/غیررسمی)
   Legacy UAT token: btn('quality', '🧪 کیفیت داده')
   US-429: هاب مالی مدیریتی R9 — تب‌بندی تنخواه/هزینه/سهامداران/سال مالی
   - بدون کلید داده جدید؛ فقط لایه نمایش و محرمانگی UX
   - برای admin/chairman؛ کاربران عادی همان تنخواه ساده را می‌بینند
   - Phase 2 / Step 3 (ر.ک: crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md):
     ① تب موجود «گزارش رسمی مالی» به «گزارش تجمیعی مالی» تغییر نام داد
        (فقط برچسب — منطق working-capital.js#ptfFinanceOfficialData دست‌نخورده
        است؛ این عدد از قبل هم تجمیعی محاسبه می‌شد، فقط نامش گمراه‌کننده بود).
     ② تب جدید «تراز رسمی/غیررسمی» اضافه شد (ر.ک: crm/ledger-report.js) —
        فقط‌خواندنی، همان ۴ نقش ارشد، هیچ فرمول موجودی را صدا نمی‌زند.
   ===================================================================== */
(function () {
  'use strict';
  function canHub() { try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function tab() { return window._finHubTab || 'petty'; }
  function finIcon(kind) {
    var p = {
      hub: '<path d="M4 20h16M6 20V9h12v11M4 9l8-5 8 5M9 13h2M13 13h2M9 17h2M13 17h2"/>',
      petty: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M17 7V5a1.5 1.5 0 00-1.8-1.4L4.2 6"/><circle cx="16" cy="13" r="1.3"/>',
      opex: '<path d="M5 21V4h14v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
      share: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 20v-1.2A4.8 4.8 0 018.3 14h1.4a4.8 4.8 0 014.8 4.8V20"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.3a4 4 0 014.5 4V20"/>',
      fiscal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4M8 14h3M8 17h6"/>',
      supplier: '<path d="M3 21V8l6 4V8l6 4V8l6 4v9z"/><path d="M7 21v-4h4v4"/>',
      customer: '<circle cx="12" cy="8.5" r="3.5"/><path d="M6.5 21v-2a5 5 0 015-5h1a5 5 0 015 5v2"/>',
      report: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
      ledger: '<path d="M4 4h16v16H4z"/><path d="M9 4v16M4 9h5M4 15h5M14 9h6M14 15h6"/>',
      quality: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M8.5 12l2.2 2.2 4.8-5"/>',
      treasury: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M12 10V6M8 6h8"/>'
    };
    return '<span class="fin-hub-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (p[kind] || p.report) + '</svg></span>';
  }
  function btn(id, lb, icon) {
    var on = tab() === id;
    /* MOB-036: متن tab باید حتی در grid موبایل قابل تشخیص باشد، نه یک chip
       با عرض محتوا که ردیف‌ها را نامتقارن/خارج از صفحه می‌کند. */
    return '<button type="button" class="fin-hub-tab' + (on ? ' active' : '') + '" data-fin-hub-tab="' + id + '" title="' + lb + '" aria-label="' + lb + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="finHubSet(\'' + id + '\')">' + finIcon(icon) + '<span class="fin-hub-tab-label">' + lb + '</span></button>';
  }
  function bar() {
    if (!canHub()) return '';
    return '<div id="finHubBar" class="fin-hub-bar">' +
      '<div class="fin-hub-layout"><div class="fin-hub-heading"><b class="fin-hub-title">' + finIcon('hub') + '<span>هاب مالی مدیریتی</span></b><small>تنخواه، هزینه جاری، سهامداران، سال مالی، گزارش تجمیعی و تراز رسمی/غیررسمی — تب‌بندی شده برای کاهش شلوغی پنل</small></div>' +
      '<div class="fin-hub-tabs">' + btn('petty', 'تنخواه', 'petty') + btn('opex', 'هزینه جاری', 'opex') + btn('share', 'سهامداران', 'share') + btn('fiscal', 'سال مالی', 'fiscal') + btn('supacc', 'حساب تأمین‌کنندگان', 'supplier') + btn('custacc', 'حساب مشتریان', 'customer') + btn('workcap', 'گزارش تجمیعی مالی', 'report') + btn('ledger', 'تراز رسمی/غیررسمی', 'ledger') + btn('treasury', 'خزانه/بانک', 'treasury') + btn('commission', 'پورسانت فروش', 'report') + btn('quality', 'کیفیت داده', 'quality') + btn('cheque', '🧾 چک‌ها', 'cheque') + '</div></div></div>';
  }
  window.finHubSet = function (id) { window._finHubTab = id || 'petty'; finHubApply(); };
  window.finHubApply = function () {
    if (!canHub()) return;
    var t = tab();
    /* این state برای رندرهای داخلی tabها نیز می‌ماند: بعضی renderها outerHTML
       را با style="display:none" بازسازی می‌کنند؛ CSS وابسته به این attribute
       tab فعال را پس از بازسازی قابل‌مشاهده نگه می‌دارد. */
    var panelRoot = document.getElementById('panels');
    if (panelRoot) panelRoot.setAttribute('data-fin-hub-active', t);
    /* .ph و .sb2 در CSS موبایل display:flex!important دارند. style.display='none'
       به‌تنهایی از آن ضعیف‌تر بود، پس toolbar تنخواه زیر همهٔ tabها باقی می‌ماند.
       برای پنهان‌سازی باید inline important بگذاریم؛ برای نمایش آن را کامل برمی‌داریم. */
    function show(id, on) {
      var el = document.getElementById(id);
      if (!el) return;
      if (on) el.style.removeProperty('display');
      else el.style.setProperty('display', 'none', 'important');
    }
    show('ptPettyHead', t === 'petty');
    ['ptToolbar', 'ptAccount', 'ptPeriods', 'ptSummary', 'ptWrap'].forEach(function (id) { show(id, t === 'petty'); });
    show('opexBox', t === 'opex');
    show('shareBox', t === 'share');
    show('fiscalBox', t === 'fiscal');
    /* v33.12.0: «داشبورد برنامه‌ریزی فصلی مالیات» (ptfTaxPlannerBox) قبلاً در هیچ تبی
       مخفی نمی‌شد و در همهٔ تب‌ها دیده می‌شد → حالا فقط در تب «سال مالی». */
    show('ptfTaxPlannerBox', t === 'fiscal');
    /* v33.11.0: باکس «تعهدات نقدینگی تأمین و چک‌های شرکت» (slLiquidity) قبلاً در هیچ
       تبی مخفی نمی‌شد و در همهٔ تب‌ها دیده می‌شد → حالا فقط در تب حساب تأمین‌کنندگان. */
    show('slLiquidity', t === 'supacc');
    show('slFinanceHubBox', t === 'supacc');
    show('cfFinanceHubBox', t === 'custacc');
    show('wcFinanceHubBox', t === 'workcap');
    show('ledgerReportBox', t === 'ledger');
    show('treasuryBox', t === 'treasury');
    if (t === 'treasury' && typeof window.ptfTreasuryRender === 'function') window.ptfTreasuryRender();
    show('commissionBox', t === 'commission');
    show('qualityBox', t === 'quality');
    show('chequeBox', t === 'cheque');
    var old = document.getElementById('finHubBar');
    if (old) old.outerHTML = bar();
    window.finHubOrder();
  };
  /* v33.11.0 (بازخورد کارفرما — «هاب مالی وسط صفحه دیده می‌شود»):
     باکس‌های opexBox/slLiquidity توسط hook های قبلی قبل از نوار هاب چیده می‌شدند.
     این تابع ترتیب همهٔ باکس‌های هاب را بازمی‌چیند: نوار هاب اول، سپس باکس‌های تب‌ها. */
  window.finHubOrder = function () {
    try {
      var panels = document.getElementById('panels');
      var barEl = document.getElementById('finHubBar');
      if (!panels || !barEl) return;
      var ids = ['opexBox', 'slLiquidity', 'ptToolbar', 'ptAccount', 'ptPeriods', 'ptSummary', 'ptWrap',
        'shareBox', 'fiscalBox', 'ptfTaxPlannerBox', 'slFinanceHubBox', 'cfFinanceHubBox', 'wcFinanceHubBox',
        'ledgerReportBox', 'treasuryBox', 'commissionBox', 'qualityBox', 'chequeBox'];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.parentNode === panels) panels.appendChild(el);
      });
      panels.insertBefore(barEl, panels.firstChild);
    } catch (e) {}
  };
  function hook() {
    if (window._finHubHooked || typeof window.buildPetty !== 'function') return false;
    window._finHubHooked = true;
    var _bp = window.buildPetty;
    window.buildPetty = function () { return bar() + _bp() + (typeof window.ptfLedgerReportHtml === 'function' ? window.ptfLedgerReportHtml() : '') + (typeof window.ptfTreasuryHtml === 'function' ? window.ptfTreasuryHtml() : '') + (typeof window.ptfCommissionHtml === 'function' ? window.ptfCommissionHtml() : '') + (typeof ptfDataQualityHtml === 'function' ? ptfDataQualityHtml() : '') + (typeof window.ptfChequePanelHtml === 'function' ? window.ptfChequePanelHtml() : ''); };
    var _rp = window.renderPetty;
    if (typeof _rp === 'function') window.renderPetty = function () { _rp(); try { finHubApply(); window.finHubOrder(); } catch (e) {} };
    return true;
  }
  var n = 0;
  var it = setInterval(function () { n++; if (hook() || n > 60) clearInterval(it); }, 250);
  hook();
})();
