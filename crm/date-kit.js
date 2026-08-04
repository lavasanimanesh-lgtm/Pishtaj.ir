/* =====================================================================
   PTF CRM — date-kit.js — v34.0.0-alpha
   لایهٔ واحد تاریخ، تقویم شمسی و بازه
   =====================================================================
   هدف: ادغام و رفع مشکلات crm/datex.js + ptfDatePicker + ptfPettyRange
   - حذف duplicate event handler (inline onclick + delegated)
   - استایل بهتر دکمه‌های ناوبری تقویم (border, hover)
   - افزودن quick-pick برای بازه (۷/۱۰/۱۵/۳۰ روز، ماه جاری/قبل، فصل، سال)
   - range nav: جابجایی بازه با حفظ طول
   - normalizeDate: یکپارچه فرمت `1405-04-15` و `1405/04/15`

   سازگاری با گذشته: window.ptfDatePicker و window.ptfCalShow همچنان کار می‌کنند.

   API: window.DateKit
     تبدیل تاریخ:
       jToIso(j), isoToJ(iso), jNormalize(s), todayJ(), todayISO()
     ویجت:
       picker(id, iso, opts)   ← ویجت کامل تقویم (با بازه)
       range(from, to, opts)   ← دو فیلد تاریخ + quick-pick + nav
       set(inputId, j)
     ناوبری بازه:
       rangeNav(from, to, delta, unit)  ← جابجایی بازه با حفظ طول
       quickRanges(from, to)            ← لیست بازه‌های پیشنهادی
   ===================================================================== */
(function () {
  'use strict';

  /* ===================== polyfill: Element.closest (برای مرورگرهای قدیمی) ===================== */
  /* FIX: در برخی محیط‌ها (مرورگرهای قدیمی، webview خاص، یا اگر CSS selector
     دچار مشکل شود)، Element.closest ممکن است null برگرداند حتی وقتی
     المان در سلسله‌مراتب وجود دارد. این polyfill به سمت بالا می‌رود و
     المان مطابق را پیدا می‌کند. سپس همهٔ resolve functions از این استفاده می‌کنند. */
  if (typeof Element !== 'undefined' && !Element.prototype.__ptfClosestFixed) {
    Element.prototype.__ptfClosestFixed = true;
    var _nativeClosest = Element.prototype.closest;
    Element.prototype.closest = function(selector) {
      // اگر native کار می‌کند، همان را برگردان
      try {
        if (_nativeClosest && _nativeClosest.call(this, selector)) return _nativeClosest.call(this, selector);
      } catch (e) {}
      // fallback: پیمایش دستی در سلسله‌مراتب
      var sel = String(selector || '');
      if (!sel) return null;
      var el = this;
      while (el && el !== document) {
        if (el.nodeType === 1 && el.matches && el.matches(sel)) return el;
        el = el.parentNode || el.parentElement;
      }
      return null;
    };
  }

  /* ===================== ثابت‌ها و الگوریتم‌های تاریخ ===================== */
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function div(a, b) { return ~~(a / b); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function faArToLatin(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      var fi = FA_DIGITS.indexOf(c);
      if (fi > -1) { out += fi; continue; }
      var ai = AR_DIGITS.indexOf(c);
      if (ai > -1) { out += ai; continue; }
      out += c;
    }
    return out;
  }
  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div((j % 1461), 4) * 5 + 308;
    var gd = div((i % 153), 5) + 1;
    var gm = (div(i, 153) % 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }
  var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
    for (i = 1; i < bl; i++) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div((jump % 33), 4); jp = jm; }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(((n % 33) + 3), 4);
    if ((jump % 33) === 4 && jump - n === 4) leapJ += 1;
    var leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    var march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div((jump + 4), 33) * 33;
    leap = (((n + 1) % 33) - 1) % 4;
    if (leap === -1) leap = 4;
    return { leap: leap, gy: gy, march: march };
  }
  function j2d(jy, jm, jd) { var r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) {
    var gy = d2g(jdn).gy;
    var jy = gy - 621;
    var r = jalCal(jy);
    var jdn1f = g2d(gy, 3, r.march);
    var k = jdn - jdn1f;
    var jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = (k % 31) + 1; return { jy: jy, jm: jm, jd: jd }; }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30); jd = (k % 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }
  function jNormalize(j) {
    j = faArToLatin(String(j || '')).replace(/-/g, '/').replace(/\s/g, '');
    var m = j.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return '';
    var jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return '';
    return jy + '/' + pad(jm) + '/' + pad(jd);
  }
  function jToIso(j) {
    var n = jNormalize(j); if (!n) return '';
    var a = n.split('/').map(Number);
    try { var g = d2g(j2d(a[0], a[1], a[2])); return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd); } catch (e) { return ''; }
  }
  function isoToJ(iso) {
    iso = String(iso || '').slice(0, 10);
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return '';
    try { var j = d2j(g2d(+m[1], +m[2], +m[3])); return j.jy + '/' + pad(j.jm) + '/' + pad(j.jd); } catch (e) { return ''; }
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function todayJ() { return isoToJ(todayISO()); }
  function digitsEn(s) { return faArToLatin(String(s || '')); }

  /* ===================== ناوبری بازه ===================== */
  /**
   * جابجایی بازه با حفظ طول
   * @param {string} from - تاریخ شروع (شمسی YYYY/MM/DD)
   * @param {string} to - تاریخ پایان
   * @param {number} delta - تعداد واحد جابجایی (مثبت=جلو، منفی=عقب)
   * @param {string} unit - 'day' | 'week' | 'month'
   * @returns {{from: string, to: string}}
   */
  function rangeNav(from, to, delta, unit) {
    if (!from || !to) return { from: from, to: to };
    unit = unit || 'day';
    delta = +delta || 0;
    var parts = from.split('/').map(Number);
    var fromY = parts[0], fromM = parts[1], fromD = parts[2];
    var toParts = to.split('/').map(Number);
    var toY = toParts[0], toM = toParts[1], toD = toParts[2];
    if (unit === 'day') {
      return {
        from: _shiftDate(fromY, fromM, fromD, delta),
        to: _shiftDate(toY, toM, toD, delta)
      };
    }
    if (unit === 'week') {
      return {
        from: _shiftDate(fromY, fromM, fromD, delta * 7),
        to: _shiftDate(toY, toM, toD, delta * 7)
      };
    }
    if (unit === 'month') {
      var newFromM = fromM + delta, newToM = toM + delta;
      var newFromY = fromY, newToY = toY;
      while (newFromM < 1) { newFromM += 12; newFromY--; }
      while (newFromM > 12) { newFromM -= 12; newFromY++; }
      while (newToM < 1) { newToM += 12; newToY--; }
      while (newToM > 12) { newToM -= 12; newToY++; }
      // اطمینان از روز معتبر — مثلاً ۱۴۰۵/۰۶/۳۱ → ۱۴۰۵/۰۶/۳۱ (شهریور ۳۱ روز)
      // اما برای ماه ۱۲ نیز اسفند ۲۹ یا ۳۰ روز — clamp می‌کنیم
      var newFromD = Math.min(fromD, _daysInMonth(newFromY, newFromM));
      var newToD = Math.min(toD, _daysInMonth(newToY, newToM));
      return {
        from: newFromY + '/' + pad(newFromM) + '/' + pad(newFromD),
        to: newToY + '/' + pad(newToM) + '/' + pad(newToD)
      };
    }
    return { from: from, to: to };
  }
  function _daysInMonth(y, m) {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    return jalCal(y).leap ? 30 : 29;
  }
  function _shiftDate(y, m, d, deltaDays) {
    // تبدیل به میلادی، جابجایی، برگشت — ایمن در گذر از ماه‌های ۲۹/۳۰ روزه
    var iso = jToIso(y + '/' + pad(m) + '/' + pad(d));
    if (!iso) return y + '/' + pad(m) + '/' + pad(d);
    var dt = new Date(iso + 'T12:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return isoToJ(dt.toISOString().slice(0, 10));
  }

  /**
   * لیست بازه‌های پیشنهادی برای quick-pick
   * @param {string} from - تاریخ شروع فعلی (شمسی)
   * @param {string} to - تاریخ پایان فعلی
   * @returns {Array<{label: string, from: string, to: string}>}
   */
  function quickRanges(from, to) {
    var t = todayJ();
    var curMonth = t.slice(0, 7) + '/01';
    var prevMonthDate = new Date(todayISO());
    prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
    var prevMonth = isoToJ(prevMonthDate.toISOString().slice(0, 10));
    var prevMonthStart = prevMonth.slice(0, 7) + '/01';
    var curYear = +t.slice(0, 4);
    var seasonStart = curYear + '/01/01';
    return [
      { label: 'امروز', from: t, to: t },
      { label: '۷ روز اخیر', from: rangeNav(t, t, -6, 'day').from, to: t },
      { label: '۱۰ روز اخیر', from: rangeNav(t, t, -9, 'day').from, to: t },
      { label: '۱۵ روز اخیر', from: rangeNav(t, t, -14, 'day').from, to: t },
      { label: '۳۰ روز اخیر', from: rangeNav(t, t, -29, 'day').from, to: t },
      { label: 'این ماه', from: curMonth, to: t },
      { label: 'ماه قبل', from: prevMonthStart, to: _shiftDate(+prevMonth.slice(0, 4), +prevMonth.slice(5, 7), 1, -1) },
      { label: 'امسال', from: seasonStart, to: t }
    ];
  }

  /* ===================== ویجت تقویم (با رفع باگ ناوبری) ===================== */
  function picker(id, iso, ph) {
    ph = ph || '۱۴۰۵/۰۴/۱۹';
    return '<div style="position:relative;display:block;width:100%" data-datekit-picker="' + id + '">' +
      '<input type="text" id="' + id + '" value="' + (isoToJ(iso) || '') + '" placeholder="' + ph + '" style="direction:ltr;color:#0e7490;width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:13.5px;box-sizing:border-box">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">' +
        '<button type="button" data-datekit-action="show" style="background:#f8fafc;border:1px solid var(--brd);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;color:#0e7490">📅 انتخاب از تقویم</button>' +
        '<button type="button" data-datekit-action="today" style="background:#fff;border:1px dashed var(--brd);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:11.5px;color:#64748b">امروز</button>' +
      '</div>' +
      '<div id="' + id + '_cal" data-datekit-cal="' + id + '" style="display:none;position:relative;margin-top:6px;z-index:200;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px;box-shadow:0 12px 34px rgba(0,0,0,.10);width:100%;max-width:280px"></div></div>';
  }
  function _set(inputId, j) {
    var el = document.getElementById(inputId);
    if (el) el.value = jNormalize(j) || j || '';
  }
  function _show(inputId) {
    var box = document.getElementById(inputId + '_cal');
    if (!box) return;
    var visible = box.style.display === 'block';
    document.querySelectorAll('[data-datekit-cal]').forEach(function (c) { c.style.display = 'none'; });
    if (visible) { box.style.display = 'none'; return; }
    var rawVal = (document.getElementById(inputId) || {}).value || '';
    var val = jNormalize(rawVal) || todayJ();
    var parts = val.split('/');
    var jy = +parts[0] || +todayJ().split('/')[0];
    var jm = +parts[1] || +todayJ().split('/')[1];
    _render(box, inputId, jy, jm);
    box.style.display = 'block';
  }
  function _pick(inputId, jy, jm, jd) {
    var jStr = jy + '/' + pad(jm) + '/' + pad(jd);
    var el = document.getElementById(inputId);
    if (el) el.value = jStr;
    var box = document.getElementById(inputId + '_cal');
    if (box) box.style.display = 'none';
    var faEl = document.getElementById(inputId + 'Fa');
    if (faEl) faEl.textContent = '✓ ' + jStr;
    var iso = jToIso(jStr);
    if (iso) {
      var isoEl = document.getElementById(inputId + 'ISO');
      if (isoEl) isoEl.value = iso;
    }
  }
  function _render(box, inputId, jy, jm) {
    var val = (document.getElementById(inputId) || {}).value || '';
    var valNorm = jNormalize(val);
    var firstISO = (function () { try { return jToIso(jy + '/' + pad(jm) + '/01'); } catch (e) { return ''; } })();
    var firstDay = firstISO ? (new Date(firstISO + 'T12:00:00').getDay() + 1) % 7 : 0;
    var daysInMonth = _daysInMonth(jy, jm);
    var prevY = jy - (jm === 1 ? 1 : 0), prevM = jm === 1 ? 12 : jm - 1;
    var nextY = jy + (jm === 12 ? 1 : 0), nextM = jm === 12 ? 1 : jm + 1;
    /* FIX F4-12: نمایش سال/ماه در هدر با ارقام فارسی (درخواست کاربر — UX بهتر برای کاربران ایرانی).
       data-datekit-year/month در دکمه‌های nav و روز نیز به فارسی ذخیره می‌شود ولی listener
       برای pick از `+btn.getAttribute('data-datekit-year')` (تبدیل خودکار string→number با +) استفاده می‌کند
       که با ارقام فارسی کار نمی‌کند؛ راه‌حل: ذخیره به‌صورت data-datekit-year-num (انگلیسی) و data-datekit-year-fa (فارسی برای نمایش).
       اما برای سادگی، فقط نمایش را فارسی می‌کنیم و data-datekit-year را انگلیسی نگه می‌داریم. */
    function faNum(n) {
      var s = String(n);
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c >= '0' && c <= '9') out += FA_DIGITS[+c];
        else out += c;
      }
      return out;
    }
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;background:#f0f9ff;border-radius:8px;padding:4px">' +
      '<button type="button" data-datekit-action="nav" data-datekit-year="' + prevY + '" data-datekit-month="' + prevM + '" style="background:#fff;border:1px solid #bae6fd;border-radius:6px;cursor:pointer;font-size:14px;padding:4px 10px;color:#0e7490;font-family:inherit">◀ ماه قبل</button>' +
      '<b style="font-size:13px;color:#0c4a6e;font-family:Tahoma,inherit">' + faNum(jy) + ' / ' + faNum(jm) + '</b>' +
      '<button type="button" data-datekit-action="nav" data-datekit-year="' + nextY + '" data-datekit-month="' + nextM + '" style="background:#fff;border:1px solid #bae6fd;border-radius:6px;cursor:pointer;font-size:14px;padding:4px 10px;color:#0e7490;font-family:inherit">ماه بعد ▶</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:10.5px;color:#64748b;margin-bottom:4px"><div>ش</div><div>ی</div><div>د</div><div>س</div><div>چ</div><div>پ</div><div>ج</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
    for (var i = 0; i < firstDay; i++) html += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var jStr = jy + '/' + pad(jm) + '/' + pad(d);
      var isToday = jStr === todayJ();
      var isSelected = valNorm === jStr;
      var bg = isSelected ? '#0e7490;color:#fff' : (isToday ? '#f0f9ff;color:#0e7490;font-weight:bold' : 'transparent;color:#1e293b');
      /* FIX F4-12: data-datekit-year و data-datekit-month اضافه شد تا listener pick بتواند تاریخ صحیح بسازد
         (قبلاً فقط day داشت و از todayJ() استفاده می‌کرد → ماه عوض نمی‌شد وقتی کاربر ماه قبل/بعد رفته بود).
         همچنین نمایش روز با ارقام فارسی (درخواست کاربر). */
      html += '<button type="button" data-datekit-action="pick" data-datekit-day="' + d + '" data-datekit-year="' + jy + '" data-datekit-month="' + jm + '" style="background:' + bg + ';border:1px solid transparent;border-radius:8px;padding:6px 0;cursor:pointer;font-size:12px;font-family:inherit">' + faNum(d) + '</button>';
    }
    html += '</div>' +
      '<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b">' +
        '<span>' + faNum(daysInMonth) + ' روز — ماه ' + faNum(jm) + ' سال ' + faNum(jy) + '</span>' +
        '<button type="button" data-datekit-action="today-pick" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;cursor:pointer;font-size:11px;padding:3px 8px;color:#047857;font-family:inherit">انتخاب امروز</button></div>';
    box.innerHTML = html;
  }
  function _nav(inputId, jy, jm) {
    var box = document.getElementById(inputId + '_cal');
    if (!box) return;
    _render(box, inputId, jy, jm);
  }
  function _pickToday(inputId) {
    var j = todayJ();
    var a = j.split('/').map(Number);
    if (a.length === 3) _pick(inputId, a[0], a[1], a[2]);
  }
  // FIX شدید: پشتیبانی از هر دو حالت e.target = المان یا text node
  // چون در برخی مرورگرها وقتی روی متن داخل button کلیک می‌شود، e.target متن است نه button.
  // راه‌حل: استفاده از e.target (اگر المان) یا e.target.parentElement (اگر text node)
  function _resolveActionEl(e) {
    var t = e.target;
    if (!t) return null;
    // المان معمولی با closest
    if (t.closest) {
      var hit = t.closest('[data-datekit-action]');
      if (hit) return hit;
    }
    // text node یا المان بدون closest — والد را بررسی کن
    var p = t.parentElement || t.parentNode;
    if (p && p.closest) {
      var hit2 = p.closest('[data-datekit-action]');
      if (hit2) return hit2;
    }
    return null;
  }
  function _resolvePickerEl(e) {
    var t = e.target;
    if (!t) return null;
    if (t.closest) {
      var hit = t.closest('[data-datekit-picker]');
      if (hit) return hit;
    }
    var p = t.parentElement || t.parentNode;
    if (p && p.closest) {
      var hit2 = p.closest('[data-datekit-picker]');
      if (hit2) return hit2;
    }
    return null;
  }
  function _resolveCalEl(e) {
    var t = e.target;
    if (!t) return null;
    if (t.closest) {
      var hit = t.closest('[data-datekit-cal]');
      if (hit) return hit;
    }
    var p = t.parentElement || t.parentNode;
    if (p && p.closest) {
      var hit2 = p.closest('[data-datekit-cal]');
      if (hit2) return hit2;
    }
    return null;
  }
  function _resolveQpEl(e) {
    var t = e.target;
    if (!t) return null;
    if (t.closest) {
      var hit = t.closest('[data-datekit-qp]');
      if (hit) return hit;
    }
    var p = t.parentElement || t.parentNode;
    if (p && p.closest) {
      var hit2 = p.closest('[data-datekit-qp]');
      if (hit2) return hit2;
    }
    return null;
  }
  function _resolveRnEl(e) {
    var t = e.target;
    if (!t) return null;
    if (t.closest) {
      var hit = t.closest('[data-datekit-rn]');
      if (hit) return hit;
    }
    var p = t.parentElement || t.parentNode;
    if (p && p.closest) {
      var hit2 = p.closest('[data-datekit-rn]');
      if (hit2) return hit2;
    }
    return null;
  }
  // FIX F4-2 (v34.0.0-alpha): flag سراسری برای جلوگیری از بسته شدن cal توسط listener دوم
  // ریشه: listener اول (nav/pick) المان cal را re-render می‌کند (box.innerHTML = html).
  //   المان قدیمی از DOM جدا می‌شود (disconnected). listener دوم (_resolveCalEl) سعی
  //   می‌کند از والدین e.target به بالا برود و cal را پیدا کند، اما المان disconnected
  //   والد معتبری ندارد → null برمی‌گردد → listener دوم guard را رد می‌کند و cal را می‌بندد.
  //   نتیجه: کاربر روی «ماه قبل» کلیک می‌کند، ماه عوض می‌شود ولی cal بسته می‌شود
  //   → کاربر فکر می‌کند دکمه کار نمی‌کند.
  // راه‌حل: listener اول flag سراسری ست می‌کند. listener دوم اگر flag ست بود، فقط آن را
  //   reset می‌کند و return می‌کند (cal بسته نمی‌شود چون action معتبری اجرا شده).
  //   این الگو atomic است چون event loop در همین tick هر دو listener را اجرا می‌کند
  //   و هیچ کد دیگری بین آن‌ها اجرا نمی‌شود.
  var _ptfDatekitActionHandled = false;
  // Delegation: فقط یک listener برای همه picker ها
  // FIX v2: پشتیبانی از text node (parentElement fallback)
  // FIX F4-2: flag برای listener دوم
  document.addEventListener('click', function (e) {
    var btn = _resolveActionEl(e);
    if (!btn) return;
    var action = btn.getAttribute('data-datekit-action');
    if (!action) return;
    var root = btn.closest('[data-datekit-picker]');
    if (!root) return;
    var id = root.getAttribute('data-datekit-picker');
    // FIX F4-2: قبل از عمل، flag را ست کن تا listener دوم cal را نبندد
    //   - nav: re-render می‌کند و المان cal عوض می‌شود
    //   - pick: cal را می‌بندد (اما listener دوم اگر flag را نبیند، دوباره سعی می‌کند ببندد)
    //   - show: cal را باز می‌کند (ممکن است listener دوم فکر کند بیرون کلیک شده)
    //   - today/today-pick: ممکن است cal را ببندد (_pickToday از _pick استفاده می‌کند)
    _ptfDatekitActionHandled = true;
    if (action === 'show') _show(id);
    else if (action === 'today') _pickToday(id);
    else if (action === 'today-pick') _pickToday(id);
    else if (action === 'nav') _nav(id, +digitsEn(btn.getAttribute('data-datekit-year')), +digitsEn(btn.getAttribute('data-datekit-month')));
    else if (action === 'pick') {
      /* FIX F4-12: قبلاً از todayJ() (سال/ماه امروز) استفاده می‌کرد و روز را با آن جمع می‌زد
         → وقتی کاربر به ماه دیگری رفته و روزی انتخاب می‌کرد، ماه به ماه امروز برمی‌گشت.
         حالا سال/ماه از data-datekit-year/month خود button روز خوانده می‌شود (که در _render
         با سال/ماه فعلی cal تنظیم شده). digitsEn برای امنیت در برابر ارقام فارسی/عربی. */
      _pick(id, +digitsEn(btn.getAttribute('data-datekit-year')), +digitsEn(btn.getAttribute('data-datekit-month')), +digitsEn(btn.getAttribute('data-datekit-day')));
    }
  });
  // بستن cal های باز هنگام کلیک بیرون از همهٔ picker ها
  // FIX F4-2: اگر listener اول action معتبری اجرا کرده (flag=true)، cal بسته نشود
  // FIX v2: پشتیبانی از text node
  document.addEventListener('click', function (e) {
    if (_ptfDatekitActionHandled) { _ptfDatekitActionHandled = false; return; }
    if (_resolveCalEl(e)) return;  // کلیک داخل cal → کاری نکن
    var pickerEl = _resolvePickerEl(e);
    document.querySelectorAll('[data-datekit-cal]').forEach(function (c) {
      if (pickerEl && pickerEl === c.parentElement) return;  // کلیک در picker هم‌جنس → cal فعلی باز بماند
      c.style.display = 'none';
    });
  });

  /* ===================== ویجت بازه (دو تاریخ + quick-pick + nav) ===================== */
  /**
   * ویجت کامل بازه: دو فیلد تاریخ + quick-pick + دکمه ناوبری
   * @param {string} fromId - id فیلد "از تاریخ"
   * @param {string} toId - id فیلد "تا تاریخ"
   * @param {string} fromVal - مقدار اولیه (شمسی)
   * @param {string} toVal - مقدار اولیه
   * @param {Object} [opts] - {onChange, hideNav, hideQuick}
   * @returns {string} HTML
   */
  function range(fromId, toId, fromVal, toVal, opts) {
    opts = opts || {};
    var fromN = jNormalize(fromVal) || '';
    var toN = jNormalize(toVal) || '';
    var quick = quickRanges(fromN, toN);
    var quickHtml = (opts.hideQuick ? '' : '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">' +
      quick.map(function (q) {
        return '<button type="button" data-datekit-qp from="' + fromId + '" to="' + toId + '" from-v="' + q.from + '" to-v="' + q.to + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer;color:#475569;font-family:inherit">' + q.label + '</button>';
      }).join('') + '</div>');
    var navHtml = (opts.hideNav ? '' : '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:6px">' +
      '<div style="display:flex;gap:3px"><span style="font-size:11px;color:#64748b">بازه قبلی:</span>' +
        '<button type="button" data-datekit-rn d="-1" u="day" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">−۱ روز</button>' +
        '<button type="button" data-datekit-rn d="-7" u="day" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">−۷ روز</button>' +
        '<button type="button" data-datekit-rn d="-1" u="month" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">−۱ ماه</button>' +
      '</div>' +
      '<div style="display:flex;gap:3px"><span style="font-size:11px;color:#64748b">بازه بعدی:</span>' +
        '<button type="button" data-datekit-rn d="1" u="day" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">+۱ روز</button>' +
        '<button type="button" data-datekit-rn d="7" u="day" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">+۷ روز</button>' +
        '<button type="button" data-datekit-rn d="1" u="month" from="' + fromId + '" to="' + toId + '" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:11px;cursor:pointer;color:#475569">+۱ ماه</button>' +
      '</div></div>');
    var fromHtml = picker(fromId, jToIso(fromN), '۱۴۰۵/۰۴/۰۱');
    var toHtml = picker(toId, jToIso(toN), '۱۴۰۵/۰۴/۰۱');
    var navId = 'rk' + Math.random().toString(36).slice(2, 8);
    return '<div id="' + navId + '" data-datekit-range>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<div><label style="font-size:12px;color:#475569;display:block;margin-bottom:4px">از تاریخ</label>' + fromHtml + '</div>' +
        '<div><label style="font-size:12px;color:#475569;display:block;margin-bottom:4px">تا تاریخ</label>' + toHtml + '</div>' +
      '</div>' + quickHtml + navHtml + '</div>';
  }
  // Delegation برای quick-pick و range-nav
  // FIX v2: پشتیبانی از text node
  document.addEventListener('click', function (e) {
    var qp = _resolveQpEl(e);
    if (qp) {
      var fEl = document.getElementById(qp.getAttribute('from'));
      var tEl = document.getElementById(qp.getAttribute('to'));
      if (fEl) fEl.value = qp.getAttribute('from-v');
      if (tEl) tEl.value = qp.getAttribute('to-v');
      return;
    }
    var rn = _resolveRnEl(e);
    if (rn) {
      var d = +rn.getAttribute('d'), u = rn.getAttribute('u');
      var fEl = document.getElementById(rn.getAttribute('from'));
      var tEl = document.getElementById(rn.getAttribute('to'));
      if (fEl && tEl) {
        var r = rangeNav(fEl.value, tEl.value, d, u);
        fEl.value = r.from;
        tEl.value = r.to;
      }
    }
  });

  /* ===================== expose ===================== */
  window.DateKit = {
    /* تبدیل تاریخ */
    jToIso: jToIso, isoToJ: isoToJ, jNormalize: jNormalize,
    todayJ: todayJ, todayISO: todayISO, digitsEn: digitsEn,
    /* ناوبری بازه */
    rangeNav: rangeNav, quickRanges: quickRanges,
    /* ویجت */
    picker: picker, range: range, set: _set, show: _show, pick: _pick, nav: _nav, pickToday: _pickToday
  };

  /* ===================== سازگاری با گذشته (datex.js) ===================== */
  // نگهداری نام‌های قدیمی برای جلوگیری از شکستن ماژول‌های موجود
  window.ptfDigitsEn = digitsEn;
  window.ptfJNormalize = jNormalize;
  window.ptfJToISO = jToIso;
  window.ptfISOToJ = isoToJ;
  window.ptfTodayISO = todayISO;
  window.ptfTodayJ = todayJ;
  window.ptfDatePicker = picker;
  window.ptfDateInput = picker;
  window.ptfCalShow = _show;
  window.ptfCalRender = _render;
  window.ptfCalNav = _nav;
  window.ptfCalPick = _pick;
  window.ptfCalPickToday = _pickToday;
})();
