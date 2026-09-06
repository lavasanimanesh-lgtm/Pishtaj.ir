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

  /* v34.37.7: مسیر نرمال‌سازی فقط همان رکوردِ ذخیره‌شده را upsert می‌کند.
     هرگز برای رکورد تازه `items[0]` یا snapshotِ دوباره‌خوانده‌شده را به‌عنوان
     کل مجموعه ذخیره نمی‌کنیم؛ همان الگو علت صدور entity_delete برای مشتری تازه
     در یک کلیک بود. */
  function saveNormalizedRecord(collection, rec, reason) {
    if (!rec || rec.cd === undefined || rec.cd === null || String(rec.cd) === '') return false;
    if (typeof window.ptfEntityUpsert === 'function' && window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED[collection]) {
      try {
        window.ptfEntityUpsert(collection, rec, { operationId: reason + '|' + String(rec.cd) + '|' + Date.now() });
        return true;
      } catch (eCmd) {}
    }
    /* fallback legacy فقط وقتی فرمان موجود نیست؛ حتی این مسیر هم با cd دقیق
       کار می‌کند و هرگز اولین سطر فهرست را حدس نمی‌زند. */
    try {
      var items = getData(collection), at = -1;
      items.forEach(function (x, i) { if (x && String(x.cd) === String(rec.cd)) at = i; });
      if (at < 0) return false;
      items[at] = rec;
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection(collection, items, { reason: reason });
      else setData(collection, items);
      return true;
    } catch (eLegacy) { return false; }
  }

  /* ---------- هوک ذخیره مشتری: همیشه فارسی ---------- */
  function hookCust() {
    if (window._pfCustHooked || typeof window.saveCust2 !== 'function') return false;
    window._pfCustHooked = true;
    var _s = window.saveCust2;
    window.saveCust2 = function (cd) {
      var saved = _s(cd);
      try {
        /* saveCust2 از v34.37.7 همان rec را برمی‌گرداند. برای نسخه‌های قدیمی
           فقط cd صریح را می‌پذیریم؛ حدس‌زدن items[0] ممنوع است. */
        var rec = saved && saved.cd ? saved : null;
        if (!rec && cd) {
          var items = getData('ptf_crm_customers');
          rec = items.filter(function (x) { return x && String(x.cd) === String(cd); })[0];
        }
        if (!rec) return saved;
        ptfNormalizeEntityPhones(rec, 'fa');
        /* فرم جاری از v34.37.7 پیش از فرمان اصلی نرمال شده است. اگر wrapper
           روی یک نسخهٔ قدیمی نشست، فقط همان cd را تکمیل کن؛ برای رکورد تازه
           هرگز فرمان رقابتیِ دوم نساز. */
        if (!saved) saveNormalizedRecord('ptf_crm_customers', rec, 'phonefmt');
      } catch (e) {}
      return saved;
    };
    return true;
  }

  /* ---------- هوک ذخیره تامین‌کننده: داخلی=فارسی، خارجی=انگلیسی کامل ---------- */
  function hookSup() {
    if (window._pfSupHooked || typeof window.saveSup2 !== 'function') return false;
    window._pfSupHooked = true;
    var _s = window.saveSup2;
    window.saveSup2 = function (cd) {
      var saved = _s(cd);
      try {
        var rec = saved && saved.cd ? saved : null;
        if (!rec && cd) {
          var items = getData('ptf_crm_suppliers');
          rec = items.filter(function (x) { return x && String(x.cd) === String(cd); })[0];
        }
        if (!rec) return saved;
        var mode = (rec.origin === 'خارجی') ? 'en' : 'fa';
        ptfNormalizeEntityPhones(rec, mode);
        if (mode === 'en') {
          /* خارجی: کل مشخصات لاتین — ارقام فارسی متن‌ها هم لاتین شود */
          ['co', 'nm', 'ca', 'coWeb', 'coAddr'].forEach(function (k) { if (rec[k]) rec[k] = ptfLatinize(rec[k]); });
          (rec.people || []).forEach(function (p) { if (p.nm) p.nm = ptfLatinize(p.nm); if (p.dept) p.dept = ptfLatinize(p.dept); });
        }
        if (!saved) saveNormalizedRecord('ptf_crm_suppliers', rec, 'phonefmt');
        if (typeof renderSuppliers === 'function') try { renderSuppliers(); } catch (e2) {}
      } catch (e) {}
      return saved;
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
      if (ch) if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_smsbook', b, { reason: 'w4' }); else setData('ptf_crm_smsbook', b);
    } catch (e) {}
    return true;
  }

  /* ---------- مهاجرت یک‌باره داده‌های موجود (نسخه‌دار — فقط یک بار اجرا) ---------- */
  function migrationProjection(key, items) {
    if (key !== 'ptf_crm_customers' && key !== 'ptf_crm_suppliers') return items;
    var known = null;
    try { known = window._ptfEntityLastKnown && window._ptfEntityLastKnown[key]; } catch (eKnown) {}
    if (!Array.isArray(known) || !known.length) return items;
    var out = items.slice(), at = {};
    out.forEach(function (r, i) { if (r && r.cd) at[String(r.cd)] = i; });
    known.forEach(function (r) {
      if (!r || !r.cd) return;
      var k = String(r.cd), i = at[k];
      if (i === undefined) { at[k] = out.length; out.push(r); return; }
      /* فیلدهای تازهٔ فرم برنده‌اند؛ فقط فیلدهای غایب از snapshot معتبر پر می‌شوند. */
      var merged = out[i];
      Object.keys(r).forEach(function (field) { if (!(field in merged)) merged[field] = r[field]; });
    });
    return out;
  }
  function migrateCollection(key, modeOf, tag) {
    var items = getData(key), changed = [];
    items.forEach(function (c) {
      if (!c) return;
      var before = '';
      try { before = JSON.stringify(c); } catch (eBefore) {}
      ptfNormalizeEntityPhones(c, modeOf(c));
      var after = '';
      try { after = JSON.stringify(c); } catch (eAfter) {}
      if (before !== after) changed.push(c);
    });
    if (!changed.length) return 0;

    /* v34.37.7: مهاجرت هم مثل هوک ذخیره نباید آرایهٔ کاملِ یک snapshot را
       به‌عنوان ویرایش/حذف تفسیر کند. هر رکوردِ واقعاً تغییرکرده یک upsert مستقل
       می‌گیرد؛ projection محلیِ کامل فقط برای رندر همان نشست نوشته می‌شود و
       missing rowهای آخرین snapshot معتبر را دوباره وارد نمی‌کند. */
    var projection = migrationProjection(key, items);
    try { if (typeof window.ptfSilentWrite === 'function') window.ptfSilentWrite(key, JSON.stringify(projection)); } catch (eLocal) {}
    if (window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED[key] && typeof window.ptfEntityUpsert === 'function') {
      changed.forEach(function (rec) {
        try {
          window.ptfEntityUpsert(key, rec, { operationId: tag + '|' + String(rec.cd || '') + '|' + Date.now() });
        } catch (eUp) {}
      });
    } else if (window.ptfEntitySaveCollection) {
      /* نسخه/محیط قدیمی: روتر جدید برای customers/suppliers حذف استنتاجی را
         مسدود می‌کند و fallback فقط همان رکوردهای موجود را می‌نویسد. */
      window.ptfEntitySaveCollection(key, projection, { reason: tag });
    } else setData(key, projection);
    return changed.length;
  }
  function migrateOnce() {
    try {
      if (localStorage.getItem('ptf_phonefmt_mig') === '1') return;
      migrateCollection('ptf_crm_customers', function () { return 'fa'; }, 'phonefmt-mig');
      migrateCollection('ptf_crm_suppliers', function (c) { return c.origin === 'خارجی' ? 'en' : 'fa'; }, 'phonefmt-mig');
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
