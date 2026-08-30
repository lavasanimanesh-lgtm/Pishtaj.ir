/* =====================================================================
   PTF — بارگذار Google Analytics 4 (GA4)
   =====================================================================
   این تنها فایلی است که شناسهٔ اندازه‌گیری در آن قرار دارد؛ برای تغییرِ
   شناسه همین یک خطِ زیر را ویرایش کنید (نیازی به دست‌زدنِ ۶۵۰ صفحه نیست).

   رفتار:
   • تا زمانی که GA_MEASUREMENT_ID با الگوی G-XXXXXXXXXX پر نشده باشد،
     هیچ درخواستی به گوگل ارسال نمی‌شود (سایت را کند/آلوده نمی‌کند).
   • احترام به انتخاب کاربر: اگر localStorage.ptf_no_analytics = '1' باشد،
     هیچ چیزی بارگذاری نمی‌شود.
   • بدون تبلیغات/ریمارکتینگ: ad_storage و personalization خاموش‌اند
     (سازگار با رویهٔ privacy-first خودِ سایت).
   ===================================================================== */
(function () {
  'use strict';

  /* ============================================================
     👇 شناسهٔ اندازه‌گیری GA4 را اینجا بگذارید (مثال: 'G-AB12CD34EF')
     ============================================================ */
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
  /* ============================================================ */

  if (!/^G-[A-Z0-9]{6,}$/.test(GA_MEASUREMENT_ID)) return;        /* هنوز تنظیم نشده */
  try {
    if (localStorage.getItem('ptf_no_analytics') === '1') return; /* انصراف کاربر */
  } catch (e) {}

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
    anonymize_ip: true,
    cookie_flags: 'SameSite=Lax;Secure'
  });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  /* رویدادهای سفارشیِ سایت (قیف فروش) — فراخوانی از ptf-metrics.js یا مستقیم */
  window.ptfTrack = function (name, params) {
    try { gtag('event', name, params || {}); } catch (e) {}
  };

  /* ثبت خودکارِ رویدادهای کلیدیِ موجود در سایت */
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('/rfq') > -1 || href.indexOf('rfq/') > -1) {
      window.ptfTrack('ptf_rfq_intent', { source: location.pathname });
    } else if (href.indexOf('/supplier') > -1) {
      window.ptfTrack('ptf_supplier_intent', { source: location.pathname });
    } else if (href.indexOf('/tracking') > -1) {
      window.ptfTrack('ptf_tracking_intent', { source: location.pathname });
    } else if (href.indexOf('tel:') === 0) {
      window.ptfTrack('ptf_call_click', { source: location.pathname });
    }
  }, true);
})();
