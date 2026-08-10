/* =====================================================================
   PTF CRM — cheque-print.js — CHQ-PRINT (مصوب کارفرما ۱۴۰۵/۰۸/۱۱)
   ماژول مستقل «🖨 چاپ چک فیزیکی» — زیر گروه «📦 کالا و اسناد»

   - فقط چاپ است: چاپ تکی و چاپ چندتایی. هیچ رکوردی ذخیره نمی‌شود.
   - بدون کد صیادی (ورود و چاپ آن حذف شد).
   - محتوای هر برگه: تاریخ (عدد + به حروف)، ذی‌نفع + کد/شناسه ملی،
     مبلغ (به عدد — قرمز در بالای برگه — و به حروف)، بابت (اختیاری).
   - تنظیمات قابل کالیبره برای هر بخش: مختصات (mm)، اندازه حروف (pt)،
     فونت چاپی فارسی (نستعلیق / بی‌نازنین / بی‌یاقوت / …) و رنگ.
   - چیدمان هر دستگاه در localStorage (تنها تنظیمات، نه رکورد چک).
   ===================================================================== */
(function () {
  'use strict';

  var LK = 'ptf_chqprint_layout_v1';
  var PK = 'ptf_chqprint_profiles_v1';
  var AK = 'ptf_chqprint_active_profile_v1';

  /* ---------- فونت‌های چاپی فارسی قابل انتخاب ---------- */
  var FONTS = [
    { id: 'IranNastaliq', lb: 'نستعلیق (IranNastaliq)', stack: "'IranNastaliq','IranNastaliq Regular','Nastaliq','Noto Nastaliq Urdu',serif" },
    { id: 'B Nazanin',    lb: 'بی‌نازنین (B Nazanin)',   stack: "'B Nazanin','BNazanin',Tahoma,sans-serif" },
    { id: 'B Yagut',      lb: 'بی‌یاقوت (B Yagut)',      stack: "'B Yagut','BYagut',Tahoma,sans-serif" },
    { id: 'B Lotus',      lb: 'بی‌لوتوس (B Lotus)',      stack: "'B Lotus','BLotus',Tahoma,sans-serif" },
    { id: 'IRANSansX',    lb: 'ایران‌سنس (IRANSansX)',   stack: "'IRANSansX','IRANSans',Tahoma,sans-serif" },
    { id: 'Vazirmatn',    lb: 'وزیرمتن (Vazirmatn)',     stack: "'Vazirmatn',Tahoma,sans-serif" },
    { id: 'Tahoma',       lb: 'تاهوما (Tahoma)',          stack: "Tahoma,'Segoe UI',sans-serif" }
  ];
  function fontStack(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i].stack;
    return "Tahoma,sans-serif";
  }
  function fontOpts(sel) {
    return FONTS.map(function (f) {
      return '<option value="' + f.id + '"' + (f.id === (sel || '') ? ' selected' : '') + '>' + f.lb + '</option>';
    }).join('');
  }

  /* ---------- چیدمان پیش‌فرض (mm / pt) ---------- */
  function chqDefaultLayout() {
    return {
      pageW: 169, pageH: 78, ox: 0, oy: 0, fontFam: '',
      /* تاریخ (عدد) — بالا راست */
      dateTop: 8, dateRight: 14, dateSize: 12, dateFam: '', dateColor: '#111827',
      /* تاریخ به حروف */
      dwTop: 14, dwRight: 14, dwSize: 9, dwFam: '', dwColor: '#111827',
      /* در وجه (ذی‌نفع) */
      payTop: 24, payRight: 14, paySize: 12, payFam: '', payColor: '#111827',
      /* کد ملی / شناسه ملی */
      nidTop: 30, nidRight: 14, nidSize: 9, nidFam: '', nidColor: '#111827',
      /* مبلغ به عدد — بالای چک (قرمز — برای محکم کاری) */
      amtTop: 18, amtLeft: 8, amtW: 62, amtSize: 13, amtFam: '', amtColor: '#b91c1c',
      /* v33.7.0: مبلغ اصلی به عدد — پایین چپ برگه (هر چک دو مبلغ دارد) */
      amt2Top: 48, amt2Left: 8, amt2W: 62, amt2Size: 12, amt2Fam: '', amt2Color: '#111827',
      /* مبلغ به حروف — نوار وسط */
      wordsTop: 36, wordsRight: 14, wordsLeft: 52, wordsSize: 10.5, wordsFam: '', wordsColor: '#111827',
      /* بابت (اختیاری) */
      memoTop: 56, memoRight: 14, memoSize: 9, memoFam: '', memoColor: '#111827',
      showGuide: false
    };
  }
  function chqProfiles() {
    try {
      var raw = JSON.parse(localStorage.getItem(PK) || 'null');
      if (raw && Array.isArray(raw.items) && raw.items.length) return raw;
    } catch (e) {}
    /* مهاجرت بی‌خطر از چیدمان تک‌پروفایلی قبلی */
    var legacy = null; try { legacy = JSON.parse(localStorage.getItem(LK) || 'null'); } catch (e2) {}
    return { version: 1, items: [{ id: 'default', name: 'پروفایل پیش‌فرض', bank: '', printer: '', layout: legacy || chqDefaultLayout(), calibratedAt: '' }] };
  }
  function chqActiveProfile() {
    var p = chqProfiles(), id = ''; try { id = localStorage.getItem(AK) || ''; } catch (e) {}
    return p.items.filter(function (x) { return x.id === id; })[0] || p.items[0];
  }
  function chqSaveProfiles(p) { try { localStorage.setItem(PK, JSON.stringify(p)); } catch (e) {} }
  function chqLoadLayout() {
    var o = (chqActiveProfile() || {}).layout || null;
    if (!o || typeof o !== 'object') return chqDefaultLayout();
    var d = chqDefaultLayout();
    Object.keys(d).forEach(function (k) {
      if (o[k] == null || o[k] === '') return;
      if (typeof d[k] === 'boolean') d[k] = !!o[k];
      else if (typeof d[k] === 'string') d[k] = String(o[k]);
      else d[k] = (+o[k] === +o[k]) ? +o[k] : o[k];
    });
    return d;
  }
  function chqSaveLayout(L) {
    var p = chqProfiles(), active = chqActiveProfile(), found = false;
    p.items.forEach(function (x) { if (x.id === active.id) { x.layout = L || chqDefaultLayout(); found = true; } });
    if (!found) p.items.push({ id: 'default', name: 'پروفایل پیش‌فرض', bank: '', printer: '', layout: L || chqDefaultLayout(), calibratedAt: '' });
    chqSaveProfiles(p);
    /* سازگاری با نسخه‌های قبلی و امکان بازیابی تنظیم آخر */
    try { localStorage.setItem(LK, JSON.stringify(L || chqDefaultLayout())); } catch (e) {}
  }
  function chqProfileTitle() {
    var p = chqActiveProfile();
    return (p.name || 'پروفایل پیش‌فرض') + (p.bank ? ' · ' + p.bank : '') + (p.printer ? ' · ' + p.printer : '');
  }


  /* ---------- ابزارهای تبدیل ---------- */
  function faD(s) { return String(s == null ? '' : s).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d] || d; }); }
  function enD(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  function escP(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function moneyEn(v) { return (+v || 0).toLocaleString('en-US'); }
  function amountWordsNoUnit(v) { return String(window.ptfNumToFaWords(v) || '').replace(/\s*ریال\s*$/, '').trim(); }

  /* ---------- مبلغ به حروف (از چاپ هاب مالی منتقل شد — مرجع واحد چاپ) ---------- */
  window.ptfNumToFaWords = function (num) {
    num = Math.round(+num || 0);
    if (num === 0) return 'صفر ریال';
    var ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    var tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    var hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    /* v33.6.0: گروه‌ها تا «هزار میلیارد» توسعه یافت و حلقه سقف گرفت —
       نسخهٔ قبل برای مبالغ ≥ ۱۰۰۰ میلیارد (تریلیون) کرش می‌کرد. */
    var groups = [['', '', ''], ['هزار', '', ''], ['میلیون', '', ''], ['میلیارد', '', ''], ['هزار میلیارد', '', ''], ['میلیون میلیارد', '', '']];
    function three(n) {
      var h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
      var parts = [];
      if (h) parts.push(hundreds[h]);
      if (t === 1) parts.push(ones[t * 10 + o]);
      else { if (t > 1) parts.push(tens[t]); if (o) parts.push(ones[o]); }
      return parts.join(' و ');
    }
    var parts = [], g = 0;
    while (num > 0 && g < groups.length) { parts.unshift(num % 1000); num = Math.floor(num / 1000); g++; }
    var groupStrs = parts.map(function (p, i) {
      var gi = parts.length - 1 - i;
      if (p === 0) return '';
      return three(p) + (groups[gi][0] ? ' ' + groups[gi][0] : '');
    }).filter(Boolean);
    return groupStrs.join(' و ') + ' ریال';
  };

  /* ---------- تاریخ شمسی به حروف: «بیست و یکم تیر ماه هزار و چهارصد و پنج» ---------- */
  var DAY_ORD = ['یکم', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم',
    'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم', 'شانزدهم', 'هفدهم', 'هجدهم', 'نوزدهم', 'بیستم',
    'بیست و یکم', 'بیست و دوم', 'بیست و سوم', 'بیست و چهارم', 'بیست و پنجم', 'بیست و ششم', 'بیست و هفتم', 'بیست و هشتم', 'بیست و نهم', 'سی‌ام', 'سی و یکم'];
  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  window.ptfJDateWords = function (faDateStr) {
    var s = enD(faDateStr).replace(/\s+/g, '');
    /* قالب CRM: سال/ماه/روز — 1405/04/21 */
    var m = String(s).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1) return '';
    var yearWords;
    if (typeof window.ptfNumWordsFa === 'function') {
      yearWords = (y >= 1000 && y < 2000) ? ('هزار و ' + window.ptfNumWordsFa(y - 1000)) : window.ptfNumWordsFa(y);
    } else {
      yearWords = String(y);
    }
    return (DAY_ORD[d - 1] || String(d)) + ' ' + (MONTHS[mo - 1] || '') + ' ماه ' + yearWords;
  };

  /* ---------- پنل ---------- */
  function fld(id, lb, inner, note) {
    return '<div class="fld"><label>' + lb + '</label>' + inner +
      (note ? '<small style="display:block;color:#94a3b8;font-size:10.5px;margin-top:3px">' + note + '</small>' : '') + '</div>';
  }

  /* MOB-026: toolbar چاپ چک در موبایل با markup ساخت‌یافته رندر می‌شود؛
     CSS دیگر برای حدس زدن آیکون از first-letter استفاده نمی‌کند. */
  function chqAction(id, icon, shortLabel, fullLabel, tone, onClick, active) {
    return '<button type="button" class="bt bt-o chqp-action chqp-tone-' + tone + (active ? ' chqp-active' : '') + '"' +
      (id ? ' id="' + id + '"' : '') +
      ' data-chqp-action="' + (id || shortLabel) + '" title="' + fullLabel + '" aria-label="' + fullLabel + '" onclick="' + onClick + '">' +
      '<span class="chqp-action-icon" aria-hidden="true">' + icon + '</span><span class="chqp-action-label">' + shortLabel + '</span></button>';
  }

  function singleFormHtml() {
    return '<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px">' +
      '<h4 style="margin:0 0 4px;font-size:13.5px">🔹 چاپ تکی</h4>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">مشخصات یک برگه چک را وارد کنید؛ با یک کلیک روی برگهٔ چک بانکی چاپ می‌شود.</div>' +
      '<div class="fr" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px">' +
      fld('chqpD', 'تاریخ چک (شمسی) *', (typeof window.ptfDatePicker === 'function' ? window.ptfDatePicker('chqpD', '', '1405/05/11') : '<input id="chqpD" placeholder="1405/05/11" style="direction:ltr">')) +
      fld('chqpTo', 'در وجه (ذی‌نفع) *', '<input id="chqpTo" placeholder="نام شخص/شرکت گیرنده">') +
      fld('chqpNid', 'کد ملی / شناسه ملی ذی‌نفع', '<input id="chqpNid" placeholder="۱۰ رقم (حقیقی) / ۱۱ رقم (حقوقی)" style="direction:ltr">', 'اختیاری — روی چک چاپ می‌شود') +
      fld('chqpAmt', 'مبلغ (ریال) *', '<input id="chqpAmt" type="text" inputmode="numeric" data-money="1" autocomplete="off" placeholder="مبلغ به ریال" style="direction:ltr">') +
      fld('chqpNote', 'بابت / یادداشت', '<input id="chqpNote" placeholder="اختیاری — مثلاً بابت پیش‌پرداخت">') +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="chqPrintPreview(\'single\')">👁 پیش‌نمایش</button>' +
      '<button class="bt" style="background:#0e7490" onclick="chqPrintGo(\'single\')">🖨 چاپ روی برگه چک</button>' +
      '</div></div>';
  }
  function multiFormHtml() {
    var rows = '';
    for (var i = 0; i < 5; i++) {
      rows += '<tr>' +
        '<td><input class="chqpM_d" placeholder="1405/05/11" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_to" placeholder="نام ذی‌نفع" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_nid" placeholder="کد/شناسه ملی" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_amt" type="text" inputmode="numeric" data-money="1" placeholder="مبلغ ریال" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_note" placeholder="بابت..." style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '</tr>';
    }
    return '<div style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:14px;padding:14px;margin-top:12px">' +
      '<h4 style="margin:0 0 4px;font-size:13.5px">🔹 چاپ چندتایی</h4>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px;line-height:1.9">هر ردیف = یک برگه چک. برگه‌ها را به‌ترتیب در پرینتر بگذارید؛ با یک بار Print همه پشت‌سرهم چاپ می‌شوند. هیچ ردیفی ذخیره نمی‌شود.</div>' +
      '<div class="tb2" style="overflow:auto"><table style="font-size:12.5px;min-width:780px"><thead><tr>' +
      '<th style="width:110px">تاریخ شمسی *</th><th>در وجه (ذی‌نفع) *</th><th style="width:140px">کد/شناسه ملی</th><th style="width:140px">مبلغ (ریال) *</th><th>بابت</th>' +
      '</tr></thead><tbody id="chqpMBody">' + rows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="chqPrintAddRows()">＋ ۵ ردیف بیشتر</button>' +
      '<span style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="chqPrintPreview(\'multi\')">👁 پیش‌نمایش همه</button>' +
      '<button type="button" class="bt" style="background:#0e7490" onclick="chqPrintGo(\'multi\')">🖨 چاپ همه</button>' +
      '</span></div></div>';
  }
  window.buildChequePrint = function () {
    return '<div class="ph"><h3>🖨 چاپ چک فیزیکی</h3>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#78350f;line-height:2;margin-bottom:12px">' +
      'این ماژول <b>فقط چاپ</b> است — هیچ رکوردی ذخیره نمی‌شود و کد صیادی هم ندارد. مشخصات هر برگه را وارد کنید و روی برگهٔ چک بانکی چاپ کنید (تکی یا چندتایی).<br>' +
      'برای هم‌راستایی با برگهٔ چک خودتان: <b>«📐 تنظیمات چاپ»</b> — فونت (نستعلیق/بی‌نازنین/بی‌یاقوت/…) و اندازهٔ حروف و مختصات هر بخش قابل تنظیم است؛ مبلغ بالای چک قرمز چاپ می‌شود.</div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:12px"><span>🖨️ پروفایل فعال: <b>'+escP(chqProfileTitle())+'</b></span><span style="display:flex;gap:6px"><button class="bt bt-o" style="padding:4px 9px;font-size:11px" onclick="chqProfileOpen()">🗂 پروفایل‌ها</button><button class="bt bt-o" style="padding:4px 9px;font-size:11px" onclick="chqProfileMarkCalibrated()">✅ تایید کالیبراسیون</button></span></div>' +
      '<div id="chqpToolbar" class="chqp-toolbar">' +
      chqAction('chqpTabS', '🧾', 'تکی', 'چاپ یک برگه چک', 'teal', "chqPrintTab('single')", true) +
      chqAction('chqpTabM', '📚', 'چندتایی', 'چاپ چند برگه چک', 'indigo', "chqPrintTab('multi')", false) +
      chqAction('', '📐', 'تنظیمات', 'تنظیمات چاپ: فونت، اندازه و مختصات', 'blue', 'chqPrintLayoutOpen()', false) +
      chqAction('', 'ℹ️', 'راهنما', 'راهنمای چاپ چک فیزیکی', 'violet', 'chqPrintHelp()', false) +
      '</div>' +
      /* v33.8.0 (مصوب کارفرما): حالت گرافیکی در همان صفحهٔ ماژول — اندازه واقعی چک + اسکن پس‌زمینه */
      '<div class="chqp-graphic-card" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:12px 14px;margin-top:12px">' +
      '<div class="chqp-graphic-head"><b style="font-size:13.5px">📐 حالت گرافیکی چیدمان (روی برگهٔ واقعی چک)</b></div>' +
      '<div id="chqpGraphicActions" class="chqp-toolbar chqp-graphic-actions">' +
      chqAction('chqpGvToggleBtn', '📐', 'چیدمان', 'فعال‌سازی چیدمان گرافیکی', 'teal', 'chqGvToggle(true)', true) +
      chqAction('', '📎', 'اسکن', 'انتخاب اسکن برگه چک برای پس‌زمینه', 'blue', "document.getElementById('chqpBgFile').click()", false) +
      chqAction('', '🗑️', 'حذف', 'حذف پس‌زمینه اسکن‌شده', 'red', 'chqBgClear()', false) +
      chqAction('', '−', 'کوچک', 'کوچک‌نمایی برگه چک', 'slate', 'chqBgZoom(-0.25)', false) +
      chqAction('', '+', 'بزرگ', 'بزرگ‌نمایی برگه چک', 'slate', 'chqBgZoom(0.25)', false) +
      chqAction('', '💾', 'ذخیره', 'ذخیره چیدمان چاپ چک', 'cyan', 'chqPrintLayoutSave(true)', false) +
      chqAction('', '🖨', 'چاپ تست', 'چاپ آزمایشی با راهنما', 'green', 'chqPrintLayoutSave(false);chqPrintLayoutTest()', false) +
      '<input type="file" id="chqpBgFile" accept="image/*" style="display:none" onchange="chqBgUpload(this)">' +
      '</div>' +
      '<div class="chqp-canvas-hint">↔ برای دیدن تمام برگه چک، افقی بکشید؛ سپس فیلدها را روی برگه جابه‌جا کنید.</div>' +
      '<div id="chqpGvSection" class="chqp-gv-section"><div id="chqpGv" style="overflow:auto;background:#e2e8f0;border:1px solid var(--brd);border-radius:12px;padding:14px;max-height:70vh"></div></div>' +
      '</div>' +
      '<div id="chqpSingle">' + singleFormHtml() + '</div>' +
      '<div id="chqpMulti" style="display:none">' + multiFormHtml() + '</div></div>';
  };
  window.renderChequePrint = function () {
    setTimeout(function () { try { window.chqGvRender(); } catch (e) {} }, 80);
  };

  window.chqProfileOpen = function () {
    var p = chqProfiles(), active = chqActiveProfile();
    var rows = p.items.map(function (x) { return '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:7px 9px;margin:5px 0;font-size:12px"><b>'+escP(x.name)+'</b>'+(x.bank?' · '+escP(x.bank):'')+(x.printer?' · '+escP(x.printer):'')+(x.calibratedAt?' <small style="color:#047857">کالیبره: '+escP(x.calibratedAt)+'</small>':'')+' <span style="float:left"><button class="bt bt-o" style="font-size:10px;padding:2px 6px" onclick="chqProfileSelect(\''+x.id+'\')">'+(x.id===active.id?'فعال':'انتخاب')+'</button>'+(p.items.length>1?' <button class="bt bt-o" style="font-size:10px;padding:2px 6px;color:#dc2626" onclick="chqProfileDelete(\''+x.id+'\')">حذف</button>':'')+'</span></div>'; }).join('');
    var html='<div class="md-b" id="chqpProfilesDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px"><h3>🗂 پروفایل‌های چاپ چک</h3><div style="font-size:11.5px;color:#64748b;margin-bottom:8px">برای هر بانک/دسته چک/چاپگر، یک پروفایل جدا بسازید. چیدمان هر پروفایل فقط روی همین دستگاه نگهداری می‌شود.</div><div id="chqpProfilesList">'+rows+'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="chqProfileNew()">＋ پروفایل جدید</button><button class="bt" onclick="document.getElementById(\'chqpProfilesDlg\').remove()">بستن</button></div></div></div>';
    (document.body||document.getElementById('panels')).insertAdjacentHTML('beforeend',html);
  };
  window.chqProfileSelect = function(id) { try { localStorage.setItem(AK,id); } catch(e) {} var dlg=document.getElementById('chqpProfilesDlg');if(dlg)dlg.remove(); var panels=document.getElementById('panels');if(panels){panels.innerHTML=buildChequePrint();renderChequePrint();} };
  window.chqProfileNew = function() {
    var name=prompt('نام پروفایل (مثلاً بانک ملت / دسته اول):',''); if(!name||!name.trim())return;
    var bank=prompt('نام بانک (اختیاری):','')||'', printer=prompt('نام چاپگر (اختیاری):','')||'';
    var p=chqProfiles(), src=chqLoadLayout(), id='P-'+Date.now().toString(36); p.items.push({id:id,name:name.trim(),bank:bank.trim(),printer:printer.trim(),layout:JSON.parse(JSON.stringify(src)),calibratedAt:''});chqSaveProfiles(p);try{localStorage.setItem(AK,id);}catch(e){} var dlg=document.getElementById('chqpProfilesDlg');if(dlg)dlg.remove();var panels=document.getElementById('panels');if(panels){panels.innerHTML=buildChequePrint();renderChequePrint();}
  };
  window.chqProfileDelete = function(id) { var p=chqProfiles();if(p.items.length<2)return;if(!confirm('پروفایل حذف شود؟'))return;p.items=p.items.filter(function(x){return x.id!==id;});chqSaveProfiles(p);if(chqActiveProfile().id===id)try{localStorage.setItem(AK,p.items[0].id);}catch(e){}chqProfileOpen(); };
  window.chqProfileMarkCalibrated = function() { var p=chqProfiles(), a=chqActiveProfile();p.items.forEach(function(x){if(x.id===a.id)x.calibratedAt=(typeof faDateTime==='function'?faDateTime():new Date().toISOString());});chqSaveProfiles(p);if(typeof ptfToast==='function')ptfToast('✅ کالیبراسیون پروفایل ثبت شد؛ قبل از چاپ نهایی یک برگه آزمایشی بررسی کنید.','ok'); };

  window.chqPrintTab = function (t) {
    var s = document.getElementById('chqpSingle'), m = document.getElementById('chqpMulti');
    var bS = document.getElementById('chqpTabS'), bM = document.getElementById('chqpTabM');
    var isS = t !== 'multi';
    if (s) s.style.display = isS ? '' : 'none';
    if (m) m.style.display = isS ? 'none' : '';
    /* کلاس‌های mobile action ثابت می‌مانند؛ فقط حالت فعال tab جابه‌جا می‌شود. */
    if (bS) bS.classList.toggle('chqp-active', isS);
    if (bM) bM.classList.toggle('chqp-active', !isS);
    if (bS) bS.setAttribute('aria-pressed', isS ? 'true' : 'false');
    if (bM) bM.setAttribute('aria-pressed', !isS ? 'true' : 'false');
  };

  window.chqPrintAddRows = function () {
    var tb = document.getElementById('chqpMBody'); if (!tb) return;
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<tr>' +
        '<td><input class="chqpM_d" placeholder="1405/05/11" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_to" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_nid" placeholder="کد/شناسه ملی" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_amt" type="text" inputmode="numeric" data-money="1" style="width:100%;direction:ltr;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '<td><input class="chqpM_note" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></td>' +
        '</tr>';
    }
    tb.insertAdjacentHTML('beforeend', html);
  };

  /* ---------- جمع‌آوری و اعتبارسنجی (بدون هیچ ذخیره‌سازی) ---------- */
  function normNid(v) {
    var s = enD(String(v == null ? '' : v)).replace(/[^\d]/g, '');
    return s;
  }
  function makeRec(dueRaw, to, nidRaw, amtRaw, note) {
    var dueISO = (typeof window.ptfJToISO === 'function') ? window.ptfJToISO(enD(dueRaw)) : '';
    return {
      dueISO: dueISO,
      dueFa: dueISO && typeof window.ptfISOToJ === 'function' ? window.ptfISOToJ(dueISO) : enD(dueRaw),
      toWhom: String(to || '').trim(),
      beneficiaryId: normNid(nidRaw),
      amt: (typeof window.ptfNum === 'function') ? window.ptfNum(amtRaw) : +String(amtRaw || '').replace(/[^\d.-]/g, ''),
      note: String(note || '').trim()
    };
  }
  function recErr(r, rowLabel) {
    var lb = rowLabel ? ('ردیف ' + rowLabel + ': ') : '';
    if (!r.toWhom) return lb + 'ذی‌نفع الزامی است';
    if (!r.amt || r.amt <= 0) return lb + 'مبلغ معتبر (بزرگ‌تر از صفر) الزامی است';
    if (!r.dueISO) return lb + 'تاریخ شمسی معتبر الزامی است';
    if (r.beneficiaryId && !/^\d{10,11}$/.test(r.beneficiaryId)) return lb + 'کد ملی باید ۱۰ رقم و شناسه ملی ۱۱ رقم باشد';
    return '';
  }
  function chqCollectSingle() {
    var r = makeRec(
      (document.getElementById('chqpD') || {}).value,
      (document.getElementById('chqpTo') || {}).value,
      (document.getElementById('chqpNid') || {}).value,
      (document.getElementById('chqpAmt') || {}).value,
      (document.getElementById('chqpNote') || {}).value
    );
    return { list: [r], errs: [recErr(r, '')].filter(Boolean) };
  }
  function chqCollectMulti() {
    var ds = document.querySelectorAll('#chqpMBody .chqpM_d');
    var tos = document.querySelectorAll('#chqpMBody .chqpM_to');
    var nids = document.querySelectorAll('#chqpMBody .chqpM_nid');
    var amts = document.querySelectorAll('#chqpMBody .chqpM_amt');
    var notes = document.querySelectorAll('#chqpMBody .chqpM_note');
    var out = [], errs = [];
    for (var i = 0; i < ds.length; i++) {
      var r = makeRec(ds[i].value, tos[i].value, nids[i].value, amts[i].value, notes[i].value);
      if (!r.toWhom && !r.amt && !r.dueFa && !r.beneficiaryId && !r.note) continue; /* ردیف خالی */
      var e = recErr(r, String(i + 1));
      if (e) { errs.push(e); continue; }
      out.push(r);
    }
    return { list: out, errs: errs };
  }
  window.chqPrintPreview = function (mode) {
    var c = mode === 'multi' ? chqCollectMulti() : chqCollectSingle();
    if (c.errs.length) { alert(c.errs.join('\n')); return; }
    if (!c.list.length) { alert('حداقل یک ردیف کامل وارد کنید'); return; }
    chqOpenPrint(c.list, 'preview');
  };
  /* ثبت اختیاری همان چک چاپ‌شده در هاب مالی: فقط برای چاپ تکی امن است، چون
     هر چک ممکن است ذی‌نفع/تامین‌کننده و اثر مالی متفاوت داشته باشد. */
  window.chqRegisterPrintedOpen = function (printed) {
    if (!printed) return;
    if (typeof window.ptfChequeCreate !== 'function') { alert('ماژول چک‌های هاب مالی بارگذاری نشده است.'); return; }
    var supOpts = '<option value="">— ذی‌نفع آزاد / بدون اثر مالی —</option>';
    try { supOpts += (typeof window.ptfChequeSupOptions === 'function' ? window.ptfChequeSupOptions() : []).map(function (x) { return '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>'; }).join(''); } catch (e) {}
    ptfDialog({
      title: '🧾 ثبت چک چاپ‌شده در هاب مالی',
      body: 'چک روی برگه چاپ شده است. با ثبت این فرم، رکورد چک صادره در هاب مالی ساخته می‌شود. اگر تأمین‌کننده انتخاب شود، اثر مالی پرداخت چکی در حساب تأمین‌کننده ثبت خواهد شد.',
      fields: [
        { id: 'no', label: 'شماره سریال / شماره چک *', type: 'text', dir: 'ltr', required: true, placeholder: 'شماره روی برگه چک' },
        { id: 'bank', label: 'بانک / شعبه', type: 'text', value: '' },
        { id: 'supplierCd', label: 'تأمین‌کننده ذی‌نفع (برای اثر مالی)', type: 'select', optionsHtml: supOpts },
        { id: 'nid', label: 'کد ملی / شناسه ملی ذی‌نفع', type: 'text', dir: 'ltr', value: printed.beneficiaryId || '' },
        { id: 'note', label: 'بابت / یادداشت', type: 'textarea', rows: 2, value: printed.note || '' }
      ],
      okText: 'ثبت در هاب مالی',
      onOk: function (v) {
        var sup = null;
        try { sup = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === v.supplierCd; })[0] || null; } catch (eS) {}
        if (sup && printed.toWhom && sup.co && String(printed.toWhom).trim() !== String(sup.co).trim()) {
          if (!confirm('نام ذی‌نفع چاپ‌شده («' + printed.toWhom + '») با تامین‌کننده انتخاب‌شده («' + sup.co + '») متفاوت است. با مسئولیت شما ثبت شود؟')) return;
        }
        var rec = {
          no: String(v.no || '').trim(), sayad: String(v.no || '').trim(), bank: String(v.bank || '').trim(),
          toWhom: printed.toWhom, beneficiaryId: normNid(v.nid || printed.beneficiaryId || ''),
          amt: +printed.amt || 0, dueFa: printed.dueFa || '', dueISO: printed.dueISO || '',
          note: String(v.note || printed.note || '').trim(), kind: 'finance', supplierCd: sup ? sup.cd : '', supplierName: sup ? (sup.co || '') : '',
          printedFrom: 'chqprint', printedAt: (typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString())
        };
        if (!rec.no) { alert('شماره سریال / شماره چک الزامی است'); return; }
        var out = window.ptfChequeCreate('issued', rec);
        if (!out || out.ok === false) { alert('ثبت چک ناموفق بود: ' + ((out && (out.error || out.why)) || 'خطای نامشخص')); return; }
        try { if (typeof audit === 'function') audit('چاپ چک', 'ثبت چک چاپ‌شده در هاب مالی' + (sup ? ' با اثر مالی تامین‌کننده' : ' بدون تامین‌کننده'), out.cd); } catch (eA) {}
        if (typeof ptfToast === 'function') ptfToast(sup ? '✅ چک در هاب مالی ثبت و اثر مالی آن لحاظ شد' : '✅ چک در هاب مالی ثبت شد — برای اثر مالی، تامین‌کننده را در ویرایش چک تعیین کنید', sup ? 'ok' : 'warn');
        try { if (typeof window.ptfChequePanelRender === 'function') window.ptfChequePanelRender(); } catch (eR) {}
      }
    });
  };
  window.chqPrintPreflight = function (list, mode) {
    var L = chqLoadLayout();
    var proceed = function () {
      if (mode !== 'multi' && confirm('آیا این چک چاپ‌شده در «چک‌های هاب مالی» هم ثبت شود؟\n\nدر صورت تایید، فرم اطلاعات تکمیلی و اثر مالی باز می‌شود.')) {
        chqRegisterPrintedOpen(list[0]);
      } else if (mode === 'multi' && typeof ptfToast === 'function') {
        /* ثبت گروهی مالی عمداً خودکار نیست؛ هر چک می‌تواند تامین‌کننده و اثر متفاوت داشته باشد. */
        ptfToast('برای ثبت مالی هر چک چاپ چندتایی، از هاب مالی استفاده کنید.', 'info');
      }
      chqOpenPrint(list, 'paper');
    };
    var body = '<div style="font-size:12.5px;line-height:2;color:#334155">' +
      '<b>اندازه برگه فعال:</b> ' + L.pageW + ' × ' + L.pageH + ' میلی‌متر<br>' +
      'پیش از ادامه، در پنجره چاپگر این تنظیمات را انتخاب کنید: <b>Actual Size / 100%</b>، <b>Margins = None</b>، <b>Headers & Footers = Off</b> و <b>Fit to Page = Off</b>.<br>' +
      '<span style="color:#b45309">چاپگر باید برای همین اندازه کاغذ کوچک یا Custom Paper تنظیم شده باشد؛ اگر چاپگر روی A4 باشد، مختصات برگه چک صحیح نخواهد بود.</span><br>' +
      'برای تغییر ابعاد، ابتدا «📐 تنظیمات چاپ» و سپس پروفایل چاپگر را اصلاح کنید.</div>';
    if (typeof ptfDialog === 'function') { ptfDialog({ title:'🖨️ آماده‌سازی چاپ فیزیکی چک', body:body, okText:'باز کردن چاپگر', onOk:proceed }); }
    else if (confirm('اندازه برگه '+L.pageW+'×'+L.pageH+'mm است. چاپ با Actual Size و بدون حاشیه آماده است؟')) proceed();
  };
  window.chqPrintGo = function (mode) {
    var c = mode === 'multi' ? chqCollectMulti() : chqCollectSingle();
    if (c.errs.length) { alert(c.errs.join('\n')); return; }
    if (!c.list.length) { alert('حداقل یک ردیف کامل وارد کنید'); return; }
    chqPrintPreflight(c.list, mode === 'multi' ? 'multi' : 'single');
  };

  /* ---------- تولید HTML چاپ ---------- */
  function chqPrintHtml(list, mode) {
    list = list || [];
    mode = mode || 'paper';
    var L = chqLoadLayout();
    var guide = (mode === 'calib') || L.showGuide;
    var body = list.map(function (c) {
      var ox = (+L.ox || 0), oy = (+L.oy || 0);
      function box(cls, top, right, left, extra) {
        var st = 'position:absolute;top:' + (top + oy) + 'mm;';
        if (right != null) st += 'right:' + (right + ox) + 'mm;';
        if (left != null) st += 'left:' + (left + ox) + 'mm;';
        return '<div class="' + cls + '" style="' + st + (extra || '') + '">';
      }
      function fam(k) { return fontStack(L[k + 'Fam'] || L.fontFam || ''); }
      /* مبلغ قرمز به فرمت قدیمی انگلیسی، با واحد IRR و محافظ دوطرفه. */
      var topAmt = '# ' + moneyEn(c.amt) + ' IRR #';
      return '<section class="pg"><div class="cheque ' + (mode === 'paper' ? 'paper' : 'mock') + (guide ? ' calib' : '') + '">' +
        (guide ? '<div class="guide"></div>' : '') +
        /* تاریخ — عدد */
        box('f-date', L.dateTop, L.dateRight, null, 'font-size:' + L.dateSize + 'pt;font-family:' + fam('date') + ';color:' + (L.dateColor || '#111827') + ';') + escP(faD(c.dueFa || '')) + '</div>' +
        /* تاریخ — به حروف */
        (c.dueFa ? box('f-dw', L.dwTop, L.dwRight, null, 'font-size:' + L.dwSize + 'pt;font-family:' + fam('dw') + ';color:' + (L.dwColor || '#111827') + ';') + escP(window.ptfJDateWords(c.dueFa)) + '</div>' : '') +
        /* در وجه */
        box('f-pay', L.payTop, L.payRight, null, 'font-size:' + L.paySize + 'pt;font-family:' + fam('pay') + ';color:' + (L.payColor || '#111827') + ';') + escP(c.toWhom || '') + '</div>' +
        /* کد/شناسه ملی */
        (c.beneficiaryId ? box('f-nid', L.nidTop, L.nidRight, null, 'font-size:' + L.nidSize + 'pt;font-family:' + fam('nid') + ';color:' + (L.nidColor || '#111827') + ';direction:ltr;') + escP(c.beneficiaryId) + '</div>' : '') +
        /* مبلغ به عدد — بالای چک (قرمز — برای محکم کاری) */
        box('f-amt', L.amtTop, null, L.amtLeft, 'width:' + (L.amtW || 62) + 'mm;font-size:' + L.amtSize + 'pt;font-family:' + fam('amt') + ';color:' + (L.amtColor || '#b91c1c') + ';font-weight:900;direction:ltr;text-align:left;') + escP(topAmt) + '</div>' +
        /* v33.7.0: مبلغ اصلی به عدد — پایین چپ برگه (هر چک دو مبلغ دارد) */
        box('f-amt2', L.amt2Top != null ? L.amt2Top : 48, null, L.amt2Left != null ? L.amt2Left : 8, 'width:' + (L.amt2W || 62) + 'mm;font-size:' + (L.amt2Size || 12) + 'pt;font-family:' + fam('amt2') + ';color:' + (L.amt2Color || '#111827') + ';font-weight:900;') + escP('# ' + money(c.amt) + ' #') + '</div>' +
        /* مبلغ به حروف */
        box('f-words', L.wordsTop, L.wordsRight, L.wordsLeft, 'font-size:' + L.wordsSize + 'pt;font-family:' + fam('words') + ';color:' + (L.wordsColor || '#111827') + ';') + escP('# ' + amountWordsNoUnit(c.amt) + ' #') + '</div>' +
        /* بابت */
        (c.note ? box('f-memo', L.memoTop, L.memoRight, null, 'font-size:' + L.memoSize + 'pt;font-family:' + fam('memo') + ';color:' + (L.memoColor || '#111827') + ';') + escP(c.note) + '</div>' : '') +
        '</div></section>';
    }).join('');
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>چاپ چک فیزیکی</title><style>' +
      '@page{size:' + L.pageW + 'mm ' + L.pageH + 'mm;margin:0}' +
      '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}' +
      'body{font-family:' + fontStack(L.fontFam || 'Tahoma') + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.pg{page-break-after:always;width:' + L.pageW + 'mm;height:' + L.pageH + 'mm;overflow:hidden;position:relative}' +
      '.pg:last-child{page-break-after:auto}' +
      '.cheque{position:relative;width:' + L.pageW + 'mm;height:' + L.pageH + 'mm}' +
      '.cheque.paper{background:transparent;border:0}' +
      '.cheque.mock{background:#fff;border:0.3mm dashed #cbd5e1}' +
      '.cheque.calib .guide{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 9.9mm,rgba(14,165,233,.12) 10mm),repeating-linear-gradient(90deg,transparent,transparent 9.9mm,rgba(14,165,233,.12) 10mm);pointer-events:none}' +
      '.f-date,.f-dw,.f-pay,.f-nid,.f-amt,.f-amt2,.f-memo{white-space:nowrap;overflow:hidden;text-overflow:clip;font-weight:700}' +
      '.f-words{white-space:normal;line-height:1.5;max-height:14mm}' +
      '@media screen{body{background:#e2e8f0;padding:12px}.pg{margin:0 auto 12px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.12)}}' +
      '@media print{body{background:#fff;padding:0}.pg{box-shadow:none;margin:0}.noprint{display:none!important}}' +
      '</style></head><body onload="setTimeout(function(){try{window.focus();window.print()}catch(e){}},300)">' + body +
      '</body></html>';
  }
  /* چاپ فیزیکی چک نباید از preview عمومی A4 عبور کند؛ آن مسیر script چاپ را
     پاک می‌کند و راهنمای A4 می‌دهد. برای کاغذ واقعی، پنجره اختصاصی با page-size
     چک باز می‌شود. Preview/کالیبراسیون همچنان در preview امن CRM نمایش داده می‌شود. */
  function chqOpenDirectPrint(html, count) {
    var w = window.open('', '_blank');
    if (!w) { alert('پنجره چاپ توسط مرورگر مسدود شد. اجازه Pop-up برای CRM را فعال کنید و دوباره چاپ بزنید.'); return false; }
    w.document.open(); w.document.write(html); w.document.close();
    try { w.focus(); } catch (e) {}
    return true;
  }
  function chqOpenPrint(list, mode) {
    list = list || [];
    if (!list.length) { alert('چکی برای چاپ نیست'); return; }
    mode = mode || 'paper';
    var html = chqPrintHtml(list, mode);
    if (mode === 'paper') {
      if (chqOpenDirectPrint(html, list.length)) {
        try { if (typeof audit === 'function') audit('چاپ چک', 'باز کردن چاپ فیزیکی ' + list.length + ' برگه', 'manual-print'); } catch (eA) {}
      }
      return;
    }
    if (typeof window.ptfPreviewPrintableDoc === 'function') {
      window.ptfPreviewPrintableDoc('پیش‌نمایش/کالیبراسیون چک فیزیکی', html, 'cheque-print');
      return;
    }
    chqOpenDirectPrint(html, list.length);
  }

  /* ---------- تنظیمات چاپ (کالیبره) ---------- */
  function fieldInputs(L) {
    var groups = [
      ['date', 'تاریخ (عدد)'], ['dw', 'تاریخ (به حروف)'], ['pay', 'در وجه'], ['nid', 'کد/شناسه ملی'],
      ['amt', 'مبلغ (عدد — بالای چک)'], ['amt2', 'مبلغ اصلی (عدد — پایین چپ)'], ['words', 'مبلغ (به حروف)'], ['memo', 'بابت']
    ];
    return groups.map(function (g) {
      var k = g[0];
      return '<div style="border:1px dashed var(--brd);border-radius:12px;padding:10px;background:#f8fafc">' +
        '<b style="font-size:12px;display:block;margin-bottom:8px">' + g[1] + '</b>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">top (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Top" value="' + L[k + 'Top'] + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' +
        (k === 'amt' || k === 'amt2' || k === 'words'
          ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">left (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Left" value="' + (L[k + 'Left'] != null ? L[k + 'Left'] : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>'
          : '<div class="fld" style="min-width:0"><label style="font-size:10.5px">right (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Right" value="' + (L[k + 'Right'] != null ? L[k + 'Right'] : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>') +
        (k === 'words' ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">right (mm)</label><input type="number" step="0.5" id="chqpL_wordsRight" value="' + (L.wordsRight != null ? L.wordsRight : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' : '') +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">اندازه حروف (pt)</label><input type="number" step="0.5" id="chqpL_' + k + 'Size" value="' + L[k + 'Size'] + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">فونت</label><select id="chqpL_' + k + 'Fam" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px;font-size:11px"><option value="">— پیش‌فرض صفحه —</option>' + fontOpts(L[k + 'Fam']) + '</select></div>' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">رنگ</label><input type="color" id="chqpL_' + k + 'Color" value="' + (L[k + 'Color'] || '#111827') + '" style="width:100%;height:32px;border:1px solid var(--brd);border-radius:8px;padding:2px"></div>' +
        (k === 'amt' || k === 'amt2' ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">عرض (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'W" value="' + (L[k + 'W'] || 62) + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' : '') +
        '</div></div>';
    }).join('');
  }
  window.chqPaperPreset = function (w, h) {
    var wi = document.getElementById('chqpL_pageW'), hi = document.getElementById('chqpL_pageH');
    if (wi) wi.value = +w; if (hi) hi.value = +h;
    if (typeof ptfToast === 'function') ptfToast((+w === 210 ? 'A4 فقط برای چاپ آزمایشی است؛ برای چک واقعی اندازه برگه بانک را انتخاب کنید.' : 'ابعاد چک تنظیم شد؛ پس از کالیبراسیون ذخیره کنید.'), 'info');
  };

  window.chqPrintLayoutOpen = function () {
    var L = chqLoadLayout();
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2500) : 2500;
    var html = '<div class="md-b" id="chqpLayoutDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:92vh;overflow:auto">' +
      '<h3>📐 تنظیمات چاپ چک فیزیکی</h3>' +
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#1e40af;line-height:2;margin-bottom:10px">' +
      'برای هم‌راستایی نوشته‌ها با برگهٔ چک بانکی خودتان: ابتدا «🖨 چاپ آزمایشی (با راهنما)» را روی یک برگهٔ معمولی بزنید، سپس مختصات (top/right/left) و اندازهٔ حروف هر بخش را تنظیم و ذخیره کنید.<br>' +
      '<b>مبلغ بالای چک طبق مصوبه قرمز چاپ می‌شود</b> (رنگ آن از همین‌جا قابل تغییر است). ابعاد پیش‌فرض برگه: 169×78mm — اگر بانک شما فرق دارد pageW/pageH را عوض کنید.<br>' +
      '<span style="display:inline-flex;gap:6px;margin-top:5px"><button type="button" class="bt bt-o" style="font-size:11px;padding:3px 7px" onclick="chqPaperPreset(169,78)">پیش‌فرض چک 169×78</button><button type="button" class="bt bt-o" style="font-size:11px;padding:3px 7px" onclick="chqPaperPreset(210,297)">A4 فقط برای آزمون</button></span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px">' +
      '<div class="fld"><label style="font-size:11px">عرض برگه pageW (mm)</label><input type="number" step="0.5" id="chqpL_pageW" value="' + L.pageW + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">ارتفاع برگه pageH (mm)</label><input type="number" step="0.5" id="chqpL_pageH" value="' + L.pageH + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">آفست افقی ox (mm)</label><input type="number" step="0.5" id="chqpL_ox" value="' + (L.ox || 0) + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">آفست عمودی oy (mm)</label><input type="number" step="0.5" id="chqpL_oy" value="' + (L.oy || 0) + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">فونت پیش‌فرض صفحه</label><select id="chqpL_fontFam" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:11px"><option value="">— تاهوما —</option>' + fontOpts(L.fontFam || '') + '</select></div>' +
      '<div class="fld" style="display:flex;align-items:flex-end"><label style="font-size:11px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="chqpL_guide"' + (L.showGuide ? ' checked' : '') + '> نمایش خطوط راهنما</label></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">' + fieldInputs(L) + '</div>' +
      /* v33.8.0: حالت گرافیکی از مودال به صفحهٔ اصلی ماژول منتقل شد (جلوگیری از تداخل id) */
      '<div style="margin-top:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#1e40af">🖱 حالت گرافیکی (کشیدن فیلدها + اسکن پس‌زمینه) در <b>صفحهٔ اصلی ماژول «چاپ چک فیزیکی»</b> بالای همین پنجره قرار دارد — اینجا فقط مقادیر عددی است.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'chqpLayoutDlg\').remove()">بستن</button>' +
      '<button type="button" class="bt bt-o" onclick="chqPrintLayoutSave(true)">💾 ذخیره چیدمان</button>' +
      '<button type="button" class="bt" style="background:#0e7490" onclick="chqPrintLayoutSave(false);chqPrintLayoutTest()">🖨 چاپ آزمایشی</button>' +
      '</div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
    setTimeout(function () { try { window.chqGvRender(); } catch (e) {} }, 50);
  };
  /* ---------- v33.8.0: حالت گرافیکی — کشیدن فیلدها روی برگه (اندازه واقعی چک صیادی)
     - در همان صفحهٔ ماژول (بدون مودال)؛ ابعاد ≈ چک واقعی (169×78mm → ~۱۰۰۰px با زوم ۱).
     - می‌توان اسکن برگهٔ چک واقعی را به‌عنوان پس‌زمینه قرار داد و فیلدها را روی آن جانمایی کرد.
     - زوم +/− برای صفحه‌های کوچک. ---------- */
  var GV_SCALE = 6; /* px per mm — 169mm ≈ 1014px (اندازهٔ واقعی چک) */
  window._chqGvZoom = 1;
  function gvScale() { return GV_SCALE * (window._chqGvZoom || 1); }
  /* آپلود اسکن برگه چک → پس‌زمینه (کوچک‌سازی با canvas و ذخیره در localStorage) */
  window.chqBgUpload = function (inp) {
    var f = inp && inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 12 * 1048576) { alert('فایل بزرگتر از ۱۲MB است'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var maxW = 1600, w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            var dataUrl = cv.toDataURL('image/jpeg', 0.82);
            if (dataUrl.length > 3.5 * 1048576) { alert('حجم تصویر پس از فشرده‌سازی زیاد است — تصویر با وضوح کمتر انتخاب کنید'); return; }
            try { localStorage.setItem('ptf_chqprint_bg', dataUrl); } catch (eS) { alert('ذخیره تصویر در مرورگر ممکن نشد — تصویر کوچک‌تری انتخاب کنید'); return; }
            window.chqGvRender();
            if (typeof window.ptfToast === 'function') window.ptfToast('✅ اسکن برگه چک در پس‌زمینه قرار گرفت — فیلدها را روی آن بکشید', 'ok');
          } catch (eC) { alert('پردازش تصویر ممکن نشد'); }
        };
        img.onerror = function () { alert('خواندن تصویر ممکن نشد'); };
        img.src = rd.result;
      } catch (eR) { alert('خواندن فایل ممکن نشد'); }
    };
    rd.readAsDataURL(f);
    if (inp) inp.value = '';
  };
  window.chqBgClear = function () {
    try { localStorage.removeItem('ptf_chqprint_bg'); } catch (e) {}
    window.chqGvRender();
    if (typeof window.ptfToast === 'function') window.ptfToast('پس‌زمینه حذف شد', 'info');
  };
  window.chqBgZoom = function (d) {
    window._chqGvZoom = Math.min(2, Math.max(0.5, (window._chqGvZoom || 1) + d));
    window.chqGvRender();
  };
  window.chqGvToggle = function (show) {
    var s = document.getElementById('chqpGvSection'); if (s) s.style.display = show ? '' : 'none';
    var b = document.getElementById('chqpGvToggleBtn');
    if (b) {
      b.classList.toggle('chqp-active', !!show);
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
    }
  };
  function gvFieldHtml(key, lb, sample, color, size) {
    return '<div id="chqpGv_' + key + '" onmousedown="chqGvStart(event,\'' + key + '\')" style="position:absolute;cursor:move;white-space:nowrap;font-weight:800;color:' + (color || '#111827') + ';font-size:' + (size || 12) + 'px;background:rgba(255,255,255,.75);border:1px dashed rgba(100,116,139,.5);border-radius:4px;padding:1px 4px;z-index:3;user-select:none" title="' + lb + ' — بکشید و رها کنید">' + sample + '</div>';
  }
  window.chqGvRender = function () {
    var box = document.getElementById('chqpGv'); if (!box) return;
    var L = chqLoadLayout();
    var scale = gvScale();
    var wPx = Math.round(L.pageW * scale), hPx = Math.round(L.pageH * scale);
    var bg = '';
    try { bg = localStorage.getItem('ptf_chqprint_bg') || ''; } catch (eB) {}
    box.innerHTML =
      '<div style="position:relative;width:' + wPx + 'px;height:' + hPx + 'px;border:2px solid #94a3b8;border-radius:8px;background:#fff;margin:0 auto;overflow:hidden;' + (bg ? 'background-image:url(\'' + bg + '\');background-size:100% 100%;background-repeat:no-repeat;' : '') + '">' +
      (bg ? '' : '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent ' + (10 * scale - 1) + 'px,rgba(14,165,233,.12) ' + (10 * scale) + 'px),repeating-linear-gradient(90deg,transparent,transparent ' + (10 * scale - 1) + 'px,rgba(14,165,233,.12) ' + (10 * scale) + 'px);pointer-events:none"></div>') +
      gvFieldHtml('date', 'تاریخ (عدد)', faD('1405/04/21'), L.dateColor, (L.dateSize || 12) * scale / 3) +
      gvFieldHtml('dw', 'تاریخ به حروف', 'بیست و یکم تیر ماه هزار و چهارصد و پنج', L.dwColor, (L.dwSize || 9) * scale / 3) +
      gvFieldHtml('pay', 'در وجه', 'شرکت نمونه ذی‌نفع', L.payColor, (L.paySize || 12) * scale / 3) +
      gvFieldHtml('nid', 'کد ملی', '14010077558', L.nidColor, (L.nidSize || 9) * scale / 3) +
      gvFieldHtml('amt', 'مبلغ (بالا)', '# 1,250,000 IRR #', L.amtColor, (L.amtSize || 13) * scale / 3) +
      gvFieldHtml('amt2', 'مبلغ اصلی (پایین چپ)', '# ۱٬۲۵۰٬۰۰۰ #', L.amt2Color, (L.amt2Size || 12) * scale / 3) +
      gvFieldHtml('words', 'مبلغ به حروف', '# یک میلیون و دویست و پنجاه هزار #', L.wordsColor, (L.wordsSize || 10.5) * scale / 3) +
      gvFieldHtml('memo', 'بابت', 'بابت پیش‌پرداخت', L.memoColor, (L.memoSize || 9) * scale / 3) +
      (bg ? '<div style="position:absolute;bottom:4px;left:4px;font-size:11px;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:2px 8px;z-index:4">📎 پس‌زمینه: اسکن برگه چک — فیلدها را بکشید</div>' : '') +
      '</div>';
    window.chqGvSync();
  };
  window.chqGvSync = function () {
    var L = chqLoadLayout();
    var scale = gvScale();
    var wPx = L.pageW * scale, hPx = L.pageH * scale;
    var map = {
      date: { top: L.dateTop, right: L.dateRight, size: L.dateSize, fam: L.dateFam, color: L.dateColor },
      dw: { top: L.dwTop, right: L.dwRight, size: L.dwSize, fam: L.dwFam, color: L.dwColor },
      pay: { top: L.payTop, right: L.payRight, size: L.paySize, fam: L.payFam, color: L.payColor },
      nid: { top: L.nidTop, right: L.nidRight, size: L.nidSize, fam: L.nidFam, color: L.nidColor },
      amt: { top: L.amtTop, left: L.amtLeft, size: L.amtSize, fam: L.amtFam, color: L.amtColor },
      amt2: { top: L.amt2Top, left: L.amt2Left, size: L.amt2Size, fam: L.amt2Fam, color: L.amt2Color },
      words: { top: L.wordsTop, right: L.wordsRight, left: L.wordsLeft, size: L.wordsSize, fam: L.wordsFam, color: L.wordsColor },
      memo: { top: L.memoTop, right: L.memoRight, size: L.memoSize, fam: L.memoFam, color: L.memoColor }
    };
    Object.keys(map).forEach(function (k) {
      var el = document.getElementById('chqpGv_' + k); if (!el) return;
      var f = map[k];
      var st = 'position:absolute;top:' + (f.top * scale) + 'px;cursor:move;white-space:nowrap;font-weight:800;';
      if (f.left != null) {
        st += 'left:' + (f.left * scale) + 'px;';
        /* v33.8.1 BUG-FIX جهت درگ/جانمایی: فیلد مبلغ‌به‌حروف بین right و left کشیده می‌شود */
        if (k === 'words') st += 'width:' + (Math.max(0, L.pageW - (f.left || 0) - (f.right || 0)) * scale) + 'px;';
      } else {
        /* v33.8.1 BUG-FIX: قبلاً (pageW - right) بود → فیلدهای راست‌چسب به چپ برگه پرتاب می‌شدند
           و جهت درگ معکوس می‌شد. حالا right = فاصله از لبهٔ راست (مثل چاپ واقعی). */
        st += 'right:' + ((f.right || 0) * scale) + 'px;';
      }
      st += 'color:' + (f.color || '#111827') + ';font-size:' + ((f.size || 10) * scale / 3) + 'px;';
      el.setAttribute('style', st + 'background:rgba(255,255,255,.75);border:1px dashed rgba(100,116,139,.5);border-radius:4px;padding:1px 4px;z-index:3;user-select:none');
    });
  };
  window.chqGvStart = function (ev, key) {
    ev = ev || window.event;
    if (ev.button && ev.button !== 0) return;
    ev.preventDefault();
    var L = chqLoadLayout();
    var rect = document.getElementById('chqpGv').getBoundingClientRect();
    window._chqDrag = { key: key, sx: ev.clientX, sy: ev.clientY, scale: gvScale(), origin: rect.left, topOrigin: rect.top, pageW: L.pageW, start: Object.assign({}, (function () {
      var map = {
        date: { top: L.dateTop, right: L.dateRight }, dw: { top: L.dwTop, right: L.dwRight }, pay: { top: L.payTop, right: L.payRight },
        nid: { top: L.nidTop, right: L.nidRight }, amt: { top: L.amtTop, left: L.amtLeft }, amt2: { top: L.amt2Top, left: L.amt2Left },
        words: { top: L.wordsTop, right: L.wordsRight, left: L.wordsLeft }, memo: { top: L.memoTop, right: L.memoRight }
      };
      return map[key] || {};
    })()) };
    document.addEventListener('mousemove', chqGvMove);
    document.addEventListener('mouseup', chqGvEnd);
  };
  window.chqGvMove = function (ev) {
    var d = window._chqDrag; if (!d) return;
    ev.preventDefault();
    var dx = (ev.clientX - d.sx) / d.scale;
    var dy = (ev.clientY - d.sy) / d.scale;
    var st = d.start;
    var L = chqLoadLayout();
    var el = document.getElementById('chqpGv_' + d.key); if (!el) return;
    var newTop = Math.max(0, Math.round((st.top + dy) * 2) / 2);
    var isLeft = st.left != null;
    /* v33.8.1 BUG-FIX جهت درگ:
       - چپ‌چسب (left): موس به راست → left بیشتر → فیلد راست‌تر (هم‌جهت).
       - راست‌چسب (right): موس به راست → right کمتر → فیلد راست‌تر (هم‌جهت). */
    var newX = isLeft ? Math.max(0, Math.round((st.left + dx) * 2) / 2) : Math.max(0, Math.round((st.right - dx) * 2) / 2);
    /* آپدیت inputهای عددی */
    var tInp = document.getElementById('chqpL_' + d.key + 'Top'); if (tInp) tInp.value = newTop;
    var xInp = document.getElementById('chqpL_' + d.key + (isLeft ? 'Left' : 'Right')); if (xInp) xInp.value = newX;
    if (d.key === 'words') {
      var wl = document.getElementById('chqpL_wordsLeft'); if (wl) wl.value = Math.max(0, Math.round((st.left + dx) * 2) / 2);
      var wr = document.getElementById('chqpL_wordsRight'); if (wr) wr.value = Math.max(0, Math.round((st.right - dx) * 2) / 2);
    }
    /* آپدیت خود چیدمان (برای درگ روان) */
    L[d.key + 'Top'] = newTop;
    if (isLeft) L[d.key + 'Left'] = newX; else L[d.key + 'Right'] = newX;
    if (d.key === 'words') {
      /* جابه‌جایی کل نوار مبلغ‌به‌حروف: هر دو لبه با هم حرکت می‌کنند */
      L.wordsLeft = Math.max(0, Math.round((st.left + dx) * 2) / 2);
      L.wordsRight = Math.max(0, Math.round((st.right - dx) * 2) / 2);
    }
    chqSaveLayout(L);
    window.chqGvSync();
  };
  window.chqGvEnd = function () {
    if (!window._chqDrag) return;
    window._chqDrag = null;
    document.removeEventListener('mousemove', chqGvMove);
    document.removeEventListener('mouseup', chqGvEnd);
  };
  window.chqPrintLayoutSave = function (toast) {
    var L = chqLoadLayout();
    ['pageW', 'pageH', 'ox', 'oy', 'amtW', 'amt2W', 'fontFam',
      'dateTop', 'dateRight', 'dateSize', 'dwTop', 'dwRight', 'dwSize',
      'payTop', 'payRight', 'paySize', 'nidTop', 'nidRight', 'nidSize',
      'amtTop', 'amtLeft', 'amtSize', 'amt2Top', 'amt2Left', 'amt2Size',
      'wordsTop', 'wordsRight', 'wordsLeft', 'wordsSize',
      'memoTop', 'memoRight', 'memoSize'].forEach(function (k) {
        var el = document.getElementById('chqpL_' + k);
        if (el && el.value !== '') L[k] = (k === 'fontFam') ? el.value : +el.value;
      });
    ['dateFam', 'dwFam', 'payFam', 'nidFam', 'amtFam', 'amt2Fam', 'wordsFam', 'memoFam'].forEach(function (k) {
      var el = document.getElementById('chqpL_' + k);
      if (el) L[k] = el.value;
    });
    ['dateColor', 'dwColor', 'payColor', 'nidColor', 'amtColor', 'amt2Color', 'wordsColor', 'memoColor'].forEach(function (k) {
      var el = document.getElementById('chqpL_' + k);
      if (el && el.value) L[k] = el.value;
    });
    var g = document.getElementById('chqpL_guide');
    if (g) L.showGuide = !!g.checked;
    chqSaveLayout(L);
    if (toast && typeof window.ptfToast === 'function') window.ptfToast('چیدمان چاپ چک ذخیره شد', 'ok');
  };
  window.chqPrintLayoutTest = function () {
    var sample = { dueFa: '1405/04/21', dueISO: '2026-07-12', toWhom: 'شرکت نمونه ذی‌نفع', beneficiaryId: '14010077558', amt: 3210200000000, note: 'بابت خرید کالا — نمونه آزمایشی' };
    chqOpenPrint([sample], 'calib');
  };

  window.chqPrintHelp = function () {
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2400) : 2400;
    var html = '<div class="md-b" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:88vh;overflow:auto">' +
      '<h3>❓ راهنمای چاپ چک فیزیکی</h3>' +
      '<div style="font-size:12.5px;color:#334155;line-height:2.1">' +
      '۱) در «چاپ تکی» مشخصات یک برگه یا در «چاپ چندتایی» چند برگه را وارد کنید (هیچ‌چیز ذخیره نمی‌شود).<br>' +
      '۲) «👁 پیش‌نمایش» بزنید و جای نوشته‌ها را روی برگهٔ چک ببینید.<br>' +
      '۳) اگر جای فیلدها جابه‌جاست: «📐 تنظیمات چاپ» → «🖨 چاپ آزمایشی (با راهنما)» → مختصات هر بخش را تنظیم و «💾 ذخیره» کنید.<br>' +
      '۴) برگهٔ چک را در سینی درست پرینتر بگذارید و «🖨 چاپ روی برگه چک» را بزنید. پنجره چاپ اختصاصی چک باز می‌شود؛ در دیالوگ پرینت: <b>Margins = None</b>، <b>Scale = 100% / Actual Size</b>، <b>Headers and Footers = Off</b> و <b>Fit to Page = Off</b> را انتخاب کنید.<br>' +
      '۵) مبلغ بالای چک <b>قرمز</b> چاپ می‌شود؛ فونت هر بخش (نستعلیق/بی‌نازنین/بی‌یاقوت/…) از تنظیمات قابل انتخاب است. کد صیادی در این ماژول وجود ندارد.</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };

  /* ---------- گارد دسترسی (نقش‌های مالی/ارشد + override مدیر) ---------- */
  var _go = window.goPanel;
  if (typeof _go === 'function') {
    window.goPanel = function (id, btn) {
      if (id === 'chqprint' && typeof window.ptfCanAccess === 'function' && !window.ptfCanAccess('chqprint')) {
        alert('⛔ دسترسی شما به «چاپ چک فیزیکی» مجاز نیست');
        return;
      }
      return _go(id, btn);
    };
  }
})();
