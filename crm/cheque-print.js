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
      /* مبلغ به عدد — بالای چک (قرمز) */
      amtTop: 18, amtLeft: 8, amtW: 62, amtSize: 13, amtFam: '', amtColor: '#b91c1c',
      /* مبلغ به حروف — نوار وسط */
      wordsTop: 36, wordsRight: 14, wordsLeft: 52, wordsSize: 10.5, wordsFam: '', wordsColor: '#111827',
      /* بابت (اختیاری) */
      memoTop: 56, memoRight: 14, memoSize: 9, memoFam: '', memoColor: '#111827',
      showGuide: false
    };
  }
  function chqLoadLayout() {
    try {
      var o = JSON.parse(localStorage.getItem(LK) || 'null');
      if (!o || typeof o !== 'object') return chqDefaultLayout();
      var d = chqDefaultLayout();
      Object.keys(d).forEach(function (k) {
        if (o[k] == null || o[k] === '') return;
        if (typeof d[k] === 'boolean') d[k] = !!o[k];
        else if (typeof d[k] === 'string') d[k] = String(o[k]);
        else d[k] = (+o[k] === +o[k]) ? +o[k] : o[k];
      });
      return d;
    } catch (e) { return chqDefaultLayout(); }
  }
  function chqSaveLayout(L) {
    try { localStorage.setItem(LK, JSON.stringify(L || chqLoadLayout())); } catch (e) {}
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
      '<div class="sb2" style="flex-wrap:wrap">' +
      '<button class="bt" id="chqpTabS" onclick="chqPrintTab(\'single\')">🔹 چاپ تکی</button>' +
      '<button class="bt bt-o" id="chqpTabM" onclick="chqPrintTab(\'multi\')">🔸 چاپ چندتایی</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="chqPrintLayoutOpen()">📐 تنظیمات چاپ (فونت/اندازه/مختصات)</button>' +
      '<button class="bt bt-o" style="color:#7c3aed" onclick="chqPrintHelp()">❓ راهنما</button>' +
      '</div>' +
      '<div id="chqpSingle">' + singleFormHtml() + '</div>' +
      '<div id="chqpMulti" style="display:none">' + multiFormHtml() + '</div></div>';
  };
  window.renderChequePrint = function () { /* پنل استاتیک — نیازی به رندر مجدد نیست */ };

  window.chqPrintTab = function (t) {
    var s = document.getElementById('chqpSingle'), m = document.getElementById('chqpMulti');
    var bS = document.getElementById('chqpTabS'), bM = document.getElementById('chqpTabM');
    var isS = t !== 'multi';
    if (s) s.style.display = isS ? '' : 'none';
    if (m) m.style.display = isS ? 'none' : '';
    if (bS) bS.className = isS ? 'bt' : 'bt bt-o';
    if (bM) bM.className = isS ? 'bt bt-o' : 'bt';
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
  window.chqPrintGo = function (mode) {
    var c = mode === 'multi' ? chqCollectMulti() : chqCollectSingle();
    if (c.errs.length) { alert(c.errs.join('\n')); return; }
    if (!c.list.length) { alert('حداقل یک ردیف کامل وارد کنید'); return; }
    chqOpenPrint(c.list, 'paper');
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
      var topAmt = 'مبلغ: ' + money(c.amt) + ' ریال';
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
        /* مبلغ به عدد — بالای چک (قرمز) */
        box('f-amt', L.amtTop, null, L.amtLeft, 'width:' + (L.amtW || 62) + 'mm;font-size:' + L.amtSize + 'pt;font-family:' + fam('amt') + ';color:' + (L.amtColor || '#b91c1c') + ';font-weight:900;') + escP(topAmt) + '</div>' +
        /* مبلغ به حروف */
        box('f-words', L.wordsTop, L.wordsRight, L.wordsLeft, 'font-size:' + L.wordsSize + 'pt;font-family:' + fam('words') + ';color:' + (L.wordsColor || '#111827') + ';') + escP(window.ptfNumToFaWords(c.amt)) + '</div>' +
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
      '.f-date,.f-dw,.f-pay,.f-nid,.f-amt,.f-memo{white-space:nowrap;overflow:hidden;text-overflow:clip;font-weight:700}' +
      '.f-words{white-space:normal;line-height:1.5;max-height:14mm}' +
      '@media screen{body{background:#e2e8f0;padding:12px}.pg{margin:0 auto 12px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.12)}}' +
      '@media print{body{background:#fff;padding:0}.pg{box-shadow:none;margin:0}}' +
      '</style></head><body onload="setTimeout(function(){try{window.focus();window.print()}catch(e){}},300)">' + body +
      '<div class="noprint" style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:8px 14px;border-radius:999px;font-size:12px;z-index:9;white-space:nowrap">' +
      'پرینتر: برگهٔ چک را در سینی بگذارید · حاشیه = None · Scale = 100% · ' + list.length + ' برگه' +
      '</div></body></html>';
  }
  function chqOpenPrint(list, mode) {
    list = list || [];
    if (!list.length) { alert('چکی برای چاپ نیست'); return; }
    var html = chqPrintHtml(list, mode || 'paper');
    if (typeof window.ptfPreviewPrintableDoc === 'function') {
      window.ptfPreviewPrintableDoc('پیش‌نمایش چاپ چک فیزیکی', html, 'cheque-print');
      return;
    }
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 300);
  }

  /* ---------- تنظیمات چاپ (کالیبره) ---------- */
  function fieldInputs(L) {
    var groups = [
      ['date', 'تاریخ (عدد)'], ['dw', 'تاریخ (به حروف)'], ['pay', 'در وجه'], ['nid', 'کد/شناسه ملی'],
      ['amt', 'مبلغ (عدد — بالای چک)'], ['words', 'مبلغ (به حروف)'], ['memo', 'بابت']
    ];
    return groups.map(function (g) {
      var k = g[0];
      return '<div style="border:1px dashed var(--brd);border-radius:12px;padding:10px;background:#f8fafc">' +
        '<b style="font-size:12px;display:block;margin-bottom:8px">' + g[1] + '</b>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">top (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Top" value="' + L[k + 'Top'] + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' +
        (k === 'amt' || k === 'words'
          ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">left (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Left" value="' + (L[k + 'Left'] != null ? L[k + 'Left'] : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>'
          : '<div class="fld" style="min-width:0"><label style="font-size:10.5px">right (mm)</label><input type="number" step="0.5" id="chqpL_' + k + 'Right" value="' + (L[k + 'Right'] != null ? L[k + 'Right'] : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>') +
        (k === 'words' ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">right (mm)</label><input type="number" step="0.5" id="chqpL_wordsRight" value="' + (L.wordsRight != null ? L.wordsRight : '') + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' : '') +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">اندازه حروف (pt)</label><input type="number" step="0.5" id="chqpL_' + k + 'Size" value="' + L[k + 'Size'] + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">فونت</label><select id="chqpL_' + k + 'Fam" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px;font-size:11px"><option value="">— پیش‌فرض صفحه —</option>' + fontOpts(L[k + 'Fam']) + '</select></div>' +
        '<div class="fld" style="min-width:0"><label style="font-size:10.5px">رنگ</label><input type="color" id="chqpL_' + k + 'Color" value="' + (L[k + 'Color'] || '#111827') + '" style="width:100%;height:32px;border:1px solid var(--brd);border-radius:8px;padding:2px"></div>' +
        (k === 'amt' ? '<div class="fld" style="min-width:0"><label style="font-size:10.5px">عرض (mm)</label><input type="number" step="0.5" id="chqpL_amtW" value="' + (L.amtW || 62) + '" style="direction:ltr;width:100%;padding:5px;border:1px solid var(--brd);border-radius:8px"></div>' : '') +
        '</div></div>';
    }).join('');
  }
  window.chqPrintLayoutOpen = function () {
    var L = chqLoadLayout();
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2500) : 2500;
    var html = '<div class="md-b" id="chqpLayoutDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:92vh;overflow:auto">' +
      '<h3>📐 تنظیمات چاپ چک فیزیکی</h3>' +
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#1e40af;line-height:2;margin-bottom:10px">' +
      'برای هم‌راستایی نوشته‌ها با برگهٔ چک بانکی خودتان: ابتدا «🖨 چاپ آزمایشی (با راهنما)» را روی یک برگهٔ معمولی بزنید، سپس مختصات (top/right/left) و اندازهٔ حروف هر بخش را تنظیم و ذخیره کنید.<br>' +
      '<b>مبلغ بالای چک طبق مصوبه قرمز چاپ می‌شود</b> (رنگ آن از همین‌جا قابل تغییر است). ابعاد پیش‌فرض برگه: 169×78mm — اگر بانک شما فرق دارد pageW/pageH را عوض کنید.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px">' +
      '<div class="fld"><label style="font-size:11px">عرض برگه pageW (mm)</label><input type="number" step="0.5" id="chqpL_pageW" value="' + L.pageW + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">ارتفاع برگه pageH (mm)</label><input type="number" step="0.5" id="chqpL_pageH" value="' + L.pageH + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">آفست افقی ox (mm)</label><input type="number" step="0.5" id="chqpL_ox" value="' + (L.ox || 0) + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">آفست عمودی oy (mm)</label><input type="number" step="0.5" id="chqpL_oy" value="' + (L.oy || 0) + '" style="direction:ltr;width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px"></div>' +
      '<div class="fld"><label style="font-size:11px">فونت پیش‌فرض صفحه</label><select id="chqpL_fontFam" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:11px"><option value="">— تاهوما —</option>' + fontOpts(L.fontFam || '') + '</select></div>' +
      '<div class="fld" style="display:flex;align-items:flex-end"><label style="font-size:11px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="chqpL_guide"' + (L.showGuide ? ' checked' : '') + '> نمایش خطوط راهنما</label></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">' + fieldInputs(L) + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'chqpLayoutDlg\').remove()">بستن</button>' +
      '<button type="button" class="bt bt-o" onclick="chqPrintLayoutSave(true)">💾 ذخیره چیدمان</button>' +
      '<button type="button" class="bt" style="background:#0e7490" onclick="chqPrintLayoutSave(false);chqPrintLayoutTest()">🖨 چاپ آزمایشی (با راهنما)</button>' +
      '</div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.chqPrintLayoutSave = function (toast) {
    var L = chqLoadLayout();
    ['pageW', 'pageH', 'ox', 'oy', 'amtW', 'fontFam',
      'dateTop', 'dateRight', 'dateSize', 'dwTop', 'dwRight', 'dwSize',
      'payTop', 'payRight', 'paySize', 'nidTop', 'nidRight', 'nidSize',
      'amtTop', 'amtLeft', 'amtSize', 'wordsTop', 'wordsRight', 'wordsLeft', 'wordsSize',
      'memoTop', 'memoRight', 'memoSize'].forEach(function (k) {
        var el = document.getElementById('chqpL_' + k);
        if (el && el.value !== '') L[k] = (k === 'fontFam') ? el.value : +el.value;
      });
    ['dateFam', 'dwFam', 'payFam', 'nidFam', 'amtFam', 'wordsFam', 'memoFam'].forEach(function (k) {
      var el = document.getElementById('chqpL_' + k);
      if (el) L[k] = el.value;
    });
    ['dateColor', 'dwColor', 'payColor', 'nidColor', 'amtColor', 'wordsColor', 'memoColor'].forEach(function (k) {
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
      '۴) برگهٔ چک را در پرینتر بگذارید و «🖨 چاپ روی برگه چک» را بزنید (در دیالوگ پرینت: <b>Margins = None</b> و <b>Scale = 100%</b>).<br>' +
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
