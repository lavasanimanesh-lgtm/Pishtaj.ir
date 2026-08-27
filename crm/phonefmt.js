/* =====================================================================
   PTF CRM — phonefmt.js — v13.7 — US-338 (مصوبه تیم چابکی: پیاده‌سازی کامل، گره‌ای ایجاد نمی‌کند)
   یکسان‌سازی شماره تماس‌ها در کل نرم‌افزار:
   - تامین‌کننده داخلی + مشتریان + دفترچه تلفن → ارقام فارسی، قالب 0912… / 021…
   - تامین‌کننده خارجی → همه‌چیز انگلیسی/لاتین، قالب بین‌المللی +…
   - در فرم ثبت: بر اساس داخلی/خارجی فقط یک قالب پذیرفته و در صورت مغایرت
     «خودکار» تبدیل می‌شود (فارسی‌سازی/انگلیسی‌سازی خودکار — خواسته کارفرما)
   ===================================================================== */
(function () {
  'use strict';

  var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';

  function toEnDigits(s) {
    return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
  }
  function toFaDigits(s) {
    return String(s == null ? '' : s).replace(/\d/g, function (d) { return FA[+d]; });
  }
  window.ptfToEnDigits = toEnDigits;
  window.ptfToFaDigits = toFaDigits;

  /* نرمال‌سازی شماره:
     mode='fa' (داخلی): +98/0098 → 0 اول؛ خروجی ارقام فارسی
     mode='en' (خارجی): خروجی لاتین بین‌المللی +XX… */
  window.ptfPhoneNorm = function (raw, mode) {
    var s = toEnDigits(raw).trim();
    if (!s) return '';
    var keep = s.replace(/[^\d+]/g, '');
    if (!keep) return '';
    if (mode === 'en' || mode === 'print') {
      /* بین‌المللی لاتین — برای چاپ رسمی: +98 913 443 9333 */
      if (/^00/.test(keep)) keep = '+' + keep.slice(2);
      if (/^09\d{9}$/.test(keep)) keep = '+98' + keep.slice(1);
      else if (/^0\d+/.test(keep) && keep.length >= 10) keep = '+98' + keep.slice(1);
      else if (/^9\d{9}$/.test(keep)) keep = '+98' + keep;
      else if (/^98\d{10}$/.test(keep)) keep = '+' + keep;
      if (keep.charAt(0) !== '+' && /^\d{10,15}$/.test(keep)) keep = '+' + keep;
      /* فاصله‌گذاری خوانا برای موبایل ایران +98 9xx xxx xxxx */
      var mIR = keep.match(/^\+98(\d{10})$/);
      if (mIR) {
        var d = mIR[1];
        if (/^9\d{9}$/.test(d)) return '+98 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
        if (/^21\d{8}$/.test(d)) return '+98 (21) ' + d.slice(2, 6) + ' ' + d.slice(6);
        return '+98 ' + d;
      }
      /* عمومی: +CC rest با فاصله هر ۳ رقم از راستِ بخش ملی */
      var mG = keep.match(/^(\+\d{1,3})(\d+)$/);
      if (mG) {
        var rest = mG[2];
        var parts = [];
        while (rest.length > 3) { parts.unshift(rest.slice(-3)); rest = rest.slice(0, -3); }
        if (rest) parts.unshift(rest);
        return mG[1] + ' ' + parts.join(' ');
      }
      return keep;
    }
    /* داخلی: قالب ملی با ارقام فارسی */
    if (/^\+98/.test(keep)) keep = '0' + keep.slice(3);
    else if (/^0098/.test(keep)) keep = '0' + keep.slice(4);
    else if (/^98\d{10}$/.test(keep)) keep = '0' + keep.slice(2);
    else if (/^9\d{9}$/.test(keep)) keep = '0' + keep; /* 912… بدون صفر */
    return toFaDigits(keep);
  };

  /* متن عمومی: فارسی‌سازی یا لاتین‌سازی ارقام (برای فیلدهای غیرشماره مثل نام خارجی) */
  window.ptfLatinize = function (s) { return toEnDigits(s); };

  /* ---------- نرمال‌سازی رکورد کامل (تلفن‌های شرکت + اشخاص + شخصی) ---------- */
  function normPhoneObj(o, mode) {
    if (!o) return;
    if (o.n != null) o.n = ptfPhoneNorm(o.n, mode);
    if (o.ext != null && o.ext !== '') o.ext = mode === 'en' ? toEnDigits(o.ext) : toFaDigits(toEnDigits(o.ext));
  }
  window.ptfNormalizeEntityPhones = function (rec, mode) {
    if (!rec) return rec;
    (rec.coTels || []).forEach(function (t) { normPhoneObj(t, mode); });
    (rec.phones || []).forEach(function (t) { normPhoneObj(t, mode); });
    (rec.people || []).forEach(function (p) {
      (p.tels || []).forEach(function (t) { normPhoneObj(t, mode); });
      (p.mobs || []).forEach(function (t) { normPhoneObj(t, mode); });
    });
    ['ph', 'mob', 'tel', 'phone'].forEach(function (k) { if (rec[k]) rec[k] = ptfPhoneNorm(rec[k], mode); });
    return rec;
  };

  /* ---------- هوک ذخیره مشتری: همیشه فارسی ---------- */
  function hookCust() {
    if (window._pfCustHooked || typeof window.saveCust2 !== 'function') return false;
    window._pfCustHooked = true;
    var _s = window.saveCust2;
    window.saveCust2 = function (cd) {
      _s(cd);
      try {
        var items = getData('ptf_crm_customers');
        var rec = cd ? items.filter(function (x) { return x.cd === cd; })[0] : items[0];
        if (rec) { ptfNormalizeEntityPhones(rec, 'fa'); /* v34.8.23 (W1-iterate) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', items, { reason: 'phonefmt' }); else setData('ptf_crm_customers', items); }
      } catch (e) {}
    };
    return true;
  }

  /* ---------- هوک ذخیره تامین‌کننده: داخلی=فارسی، خارجی=انگلیسی کامل ---------- */
  function hookSup() {
    if (window._pfSupHooked || typeof window.saveSup2 !== 'function') return false;
    window._pfSupHooked = true;
    var _s = window.saveSup2;
    window.saveSup2 = function (cd) {
      _s(cd);
      try {
        var items = getData('ptf_crm_suppliers');
        var rec = cd ? items.filter(function (x) { return x.cd === cd; })[0] : items[0];
        if (!rec) return;
        var mode = (rec.origin === 'خارجی') ? 'en' : 'fa';
        ptfNormalizeEntityPhones(rec, mode);
        if (mode === 'en') {
          /* خارجی: کل مشخصات لاتین — ارقام فارسی متن‌ها هم لاتین شود */
          ['co', 'nm', 'ca', 'coWeb', 'coAddr'].forEach(function (k) { if (rec[k]) rec[k] = ptfLatinize(rec[k]); });
          (rec.people || []).forEach(function (p) { if (p.nm) p.nm = ptfLatinize(p.nm); if (p.dept) p.dept = ptfLatinize(p.dept); });
        }
        /* v34.8.23 (W1-iterate) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_suppliers', items, { reason: 'phonefmt' }); else setData('ptf_crm_suppliers', items);
        if (typeof renderSuppliers === 'function') try { renderSuppliers(); } catch (e2) {}
      } catch (e) {}
    };
    return true;
  }

  /* ---------- دفترچه تلفن پیامکی: ذخیرهٔ canonical لاتین، نمایش فارسی در UI ----------
     API پیامک فقط 09xxxxxxxxx لاتین می‌پذیرد. تبدیل قبلی به ارقام فارسی باعث می‌شد
     سرور PHP با preg_replace شماره را خالی ببیند؛ سپس صف به‌اشتباه «sent» می‌شد. */
  function smsCanonicalMobile(raw) {
    var s = toEnDigits(raw).replace(/[^\d+]/g, '');
    if (/^\+98/.test(s)) s = '0' + s.slice(3);
    else if (/^0098/.test(s)) s = '0' + s.slice(4);
    else if (/^98\d{10}$/.test(s)) s = '0' + s.slice(2);
    else if (/^9\d{9}$/.test(s)) s = '0' + s;
    return /^09\d{9}$/.test(s) ? s : '';
  }
  function hookSmsBook() {
    if (window._pfBookHooked) return false;
    window._pfBookHooked = true;
    /* نرمال‌سازی یک‌بارهٔ رکوردهای قدیمی؛ داده داخلی لاتین است و renderer SMS
       در صورت نیاز با CSS/فونت نمایش می‌دهد، نه با تغییر خود شماره. */
    try {
      var b = getData('ptf_crm_smsbook');
      var ch = false;
      b.forEach(function (r) {
        if (r.mob) { var n = smsCanonicalMobile(r.mob); if (n && n !== r.mob) { r.mob = n; ch = true; } }
      });
      if (ch) setData('ptf_crm_smsbook', b);
    } catch (e) {}
    return true;
  }

  /* ---------- مهاجرت یک‌باره داده‌های موجود (نسخه‌دار — فقط یک بار اجرا) ---------- */
  function migrateOnce() {
    try {
      if (localStorage.getItem('ptf_phonefmt_mig') === '1') return;
      var custs = getData('ptf_crm_customers');
      custs.forEach(function (c) { ptfNormalizeEntityPhones(c, 'fa'); });
      /* v34.8.23 (W1-iterate) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'phonefmt-mig' }); else setData('ptf_crm_customers', custs);
      var sups = getData('ptf_crm_suppliers');
      sups.forEach(function (c) { ptfNormalizeEntityPhones(c, (c.origin === 'خارجی') ? 'en' : 'fa'); });
      /* v34.8.23 (W1-iterate) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_suppliers', sups, { reason: 'phonefmt-mig' }); else setData('ptf_crm_suppliers', sups);
      localStorage.setItem('ptf_phonefmt_mig', '1');
      try { audit('سیستم', 'یکسان‌سازی یک‌باره قالب شماره تماس‌ها (US-338)', ''); } catch (e) {}
    } catch (e) {}
  }

  var tries = 0;
  var t = setInterval(function () {
    tries++;
    hookCust(); hookSup(); hookSmsBook();
    if ((window._pfCustHooked && window._pfSupHooked) || tries > 60) {
      clearInterval(t);
      migrateOnce();
    }
  }, 400);
})();
