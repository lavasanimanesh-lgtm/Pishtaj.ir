/* =====================================================================
   PTF CRM — moneyx.js — v19.7 (BUG-030 + US-438 — ابلاغ کارفرما / تیم سهولت و چابکی)
   ① واحد پایه سراسری = ریال (IRR — مطابق سند رسمی CO) — مصوبه: داده قدیمی بدون ×۱۰، فقط برچسب.
   ② ورودی مبلغ مشترک: جداکننده هزارگان زنده + «مبلغ به حروف با واحد اصلی» زیر فیلد
      (تصمیم کارفرما: فقط حروف با واحد اصلی — بدون نمایش واحد دوم).
   الگو: هر input با data-money="1" خودکار کاما می‌گیرد؛ خواندن مقدار همیشه با ptfNum.
   delegation سراسری (capture) → فرم‌های داینامیک هم بدون اتصال دستی پوشش داده می‌شوند.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- تبدیل امن رشته (کاما/ارقام فارسی/عربی) به عدد ---------- */
  window.ptfNum = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[^\d.-]/g, '');
    return +s || 0;
  };

  /* ---------- عدد به حروف فارسی (تا هزار میلیارد میلیارد) ---------- */
  var W1 = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  var W10 = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  var W20 = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  var W100 = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  var SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد', 'میلیون میلیارد'];
  function w3(n) {
    var out = [];
    if (n >= 100) { out.push(W100[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { out.push(W20[Math.floor(n / 10)]); n %= 10; }
    if (n >= 10) { out.push(W10[n - 10]); n = 0; }
    if (n > 0) out.push(W1[n]);
    return out.join(' و ');
  }
  window.ptfNumWordsFa = function (n) {
    n = Math.floor(Math.abs(+n || 0));
    if (!n) return 'صفر';
    var parts = [], i = 0;
    while (n > 0 && i < SCALES.length) {
      var g = n % 1000;
      if (g) parts.unshift(w3(g) + (SCALES[i] ? ' ' + SCALES[i] : ''));
      n = Math.floor(n / 1000);
      i++;
    }
    return parts.join(' و ');
  };

  /* ---------- فرمت با کاما (فقط عدد صحیح — مبالغ) ---------- */
  window.ptfMoneyFmt = function (v) {
    var n = ptfNum(v);
    return n ? n.toLocaleString('en-US') : '';
  };

  /* ---------- راهنمای «به حروف» زیر فیلد ---------- */
  function hintFor(el) {
    var h = el._ptfHint;
    if (!h || !h.parentNode) {
      h = document.createElement('div');
      h.className = 'ptf-money-hint';
      h.style.cssText = 'font-size:10.5px;color:#0e7490;font-weight:800;margin-top:3px;direction:rtl;text-align:right;line-height:1.6';
      if (el.parentNode) el.parentNode.insertBefore(h, el.nextSibling);
      el._ptfHint = h;
    }
    return h;
  }
  function updateHint(el) {
    if (el.getAttribute('data-nohint') != null) return;
    var n = ptfNum(el.value);
    var h = hintFor(el);
    if (n >= 1000) {
      var unit = el.getAttribute('data-unit') || 'ریال';
      h.textContent = '✍️ ' + ptfNumWordsFa(n) + ' ' + unit;
      h.style.display = '';
    } else { h.textContent = ''; h.style.display = 'none'; }
  }

  /* ---------- تبدیل ارقام دوجهته (v33.9.0 — مصوب کارفرما):
     «فیلدهای مبلغ باید اعداد فارسی و انگلیسی را بپذیرند و در نهایت اگر جایی لازم است
     آن را انگلیسی کنند — مثلا در یک قالب انگلیسی عدد فارسی را انگلیسی و بالعکس.» ---------- */
  window.ptfEnDigits = function (s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  };
  window.ptfFaDigits = function (s) {
    return String(s == null ? '' : s).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d] || d; });
  };

  /* ---------- v33.9.0: فرمت خودکار فیلدهای «مبلغ‌مانند» بدون data-money ----------
     تشخیص: id/placeholder شامل (مبلغ|قیمت|هزینه|حقوق|اعتبار|پرداخت|دریافت|مانده|پیش‌پرداخت)
     یا id شامل (amt|price|amount|salary|pay|docAmt) — با خروج امن (نرخ/درصد/تعداد/روز/تاریخ/نرخ مرجع)
     و opt-out با data-nomoney="1". در blur: جداکننده + مبلغ به حروف زیر فیلد. */
  function moneyLike(el) {
    try {
      if (!el || !el.getAttribute) return false;
      if (el.getAttribute('data-money') != null || el.getAttribute('data-nomoney') != null) return false;
      var id = String(el.id || '').toLowerCase();
      var ph = String(el.getAttribute('placeholder') || '').toLowerCase();
      var type = String(el.type || '').toLowerCase();
      var inputmode = String(el.getAttribute('inputmode') || '').toLowerCase();
      var cls = String(el.className || '').toLowerCase();
      var num = (type === 'number' || inputmode === 'numeric');
      if (!num) return false;
      /* خروج امن: نرخ/درصد/تعداد/روز/تاریخ/ماه/سال/تلفن/سهم/مرجع نرخ */
      if (/(rate|pct|percent|qty|count|days|delivery|date|month|year|tel|phone|share|margin|refprice|duration|hours?)/.test(id)) return false;
      if (/(نرخ|درصد|تعداد|روز|تحویل|تاریخ|ماه|سال|سهم|حاشیه)/.test(ph)) return false;
      var moneyTxt = /(مبلغ|قیمت|هزینه|حقوق|اعتبار|پرداخت|دریافت|مانده|پیش‌پرداخت|پورسانت|بستانکاری|بدهی)/.test(ph) || /(amt|price|amount|salary|docamt|pay)/.test(id) || /(money|price|amount|salary)/.test(cls);
      return moneyTxt;
    } catch (e) { return false; }
  }
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!moneyLike(el)) return;
    try {
      var raw = String(el.value || '');
      var norm = ptfEnDigits(raw);
      var n = ptfNum(norm);
      if (n) {
        var out = n.toLocaleString('en-US');
        if (out !== raw) el.value = out;
        var h = hintFor(el);
        h.textContent = '✍️ ' + ptfNumWordsFa(n) + ' ریال';
        h.style.display = '';
      }
    } catch (eB) {}
  }, true);

  /* ---------- فرمت زنده با حفظ موقعیت مکان‌نما ---------- */
  function reformat(el) {
    var raw = String(el.value || '');
    if (raw.indexOf('.') > -1) return; /* ورود اعشاری (نرخ/درصد) — فرمت کاما فقط برای عدد صحیح */
    var caret = el.selectionStart == null ? raw.length : el.selectionStart;
    
    // یکسان‌سازی ارقام فارسی و عربی به انگلیسی قبل از محاسبه تعداد ارقام
    var normRaw = raw.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
                     .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    
    var digitsBefore = normRaw.slice(0, caret).replace(/[^\d]/g, '').length;
    var n = ptfNum(normRaw);
    var out = n ? n.toLocaleString('en-US') : (normRaw.replace(/[^\d]/g, '') ? '0' : '');
    
    if (out !== raw) {
      el.value = out;
      /* مکان‌نما: بعد از همان تعداد رقم قبلی */
      var pos = 0, seen = 0;
      while (pos < out.length && seen < digitsBefore) { if (/\d/.test(out[pos])) seen++; pos++; }
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    }
  }

  /* delegation سراسری — capture تا قبل از هندلرهای inline اجرا شود (آن‌ها مقدار کامادار را با ptfNum می‌خوانند) */
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    
    // تبدیل کیبورد فارسی به انگلیسی برای تمام ورودی‌های عددی/تاریخی/پولی سیستم
    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();
    var type = String(el.type || '').toLowerCase();
    var inputmode = String(el.getAttribute('inputmode') || '').toLowerCase();
    var datamoney = el.getAttribute('data-money');
    
    var isNumericField = (
      type === 'number' ||
      inputmode === 'numeric' ||
      datamoney != null ||
      id.indexOf('amt') > -1 || id.indexOf('price') > -1 || id.indexOf('qty') > -1 ||
      id.indexOf('amount') > -1 || id.indexOf('rate') > -1 || id.indexOf('pct') > -1 ||
      id.indexOf('date') > -1 || id.indexOf('month') > -1 ||
      cls.indexOf('numeric') > -1 || cls.indexOf('money') > -1
    );
    
    if (isNumericField && el.value) {
      var raw = el.value;
      var converted = raw.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
                         .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
      if (converted !== raw) {
        el.value = converted;
      }
    }

    if (datamoney != null) {
      reformat(el);
      updateHint(el);
    }
  }, true);

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute || el.getAttribute('data-money') == null) return;
    reformat(el);
    updateHint(el);
  }, true);
})();