/* =====================================================================
   PTF CRM — vat-shared.js — v34.7.89 (VAT-LEDGER-001)
   تابع مشترک «نرخ مصوب ارزش افزوده» برای همه فاکتورهای رسمی کشور.
   منبع: ptf_crm_settings → { vatRates: { '1405': 10, ... }, vatDefaultPct }
   - هاب مالی (دکمهٔ «درصد مصوب» در تب سال مالی) این رکورد را می‌نویسد.
   - فاکتور رسمی فروش و فاکتور رسمی خرید از همین تابع می‌خوانند.
   - پیش‌فرض ۱۰٪ وقتی جایی نباشد (مطابق تصمیم کارفرما).
   ===================================================================== */
(function () {
  'use strict';

  /* سال شمسی از یک تاریخ (ISO یا Jalali) — عدد ۴ رقمی 13xx/14xx */
  function yearOf(date) {
    try {
      var s = String(date || '').trim();
      s = s.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
           .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
      var m = s.match(/(13|14)\d{2}/);
      return m ? m[0] : '';
    } catch (e) { return ''; }
  }

  function settings() {
    try { var s = getData('ptf_crm_settings') || {}; return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {}; } catch (e) { return {}; }
  }

  /* درصد مصوب سال — اگر برای سال ثبت شده باشد همان؛ وگرنه vatDefaultPct؛ وگرنه ۱۰. */
  window.ptfVatRateOf = function (date) {
    var y = yearOf(date);
    var s = settings();
    var map = s.vatRates || s.fiscalVatRates || {};
    if (y && map[y] != null) return +map[y];
    if (s.vatDefaultPct != null) return +s.vatDefaultPct;
    if (s.vatPercent != null) return +s.vatPercent;
    return 10;
  };

  /* ثبت درصد مصوب سال + تاریخچه (با دلیل) — فقط نقش‌های مالی. */
  window.ptfVatRateSet = function (year, pct, reason) {
    year = String(year || '').replace(/[^\d]/g, '');
    pct = +pct || 0;
    if (!/^(13|14)\d{2}$/.test(year)) return { ok: false, error: 'year_invalid' };
    if (pct < 0 || pct > 100) return { ok: false, error: 'pct_invalid' };
    var me = '';
    try { me = (curSession() || {}).name || ''; } catch (e) {}
    var s = settings();
    s.vatRates = s.vatRates || {};
    s.vatRates[year] = pct;
    s.vatRateHistory = s.vatRateHistory || [];
    s.vatRateHistory.push({ year: year, pct: pct, reason: String(reason || 'نرخ مصوب سال مالی').slice(0, 200), at: new Date().toISOString(), by: me });
    try { if (setData('ptf_crm_settings', s) === false) return { ok: false, error: 'save_failed' }; } catch (e) { return { ok: false, error: 'save_failed' }; }
    return { ok: true, year: year, pct: pct };
  };

  /* خواندن درصد مصوب برای نمایش در فرم/هاب مالی */
  window.ptfVatRateGet = function (date) { return window.ptfVatRateOf(date); };
  window.ptfVatRateYearOf = yearOf;
})();
