/* =====================================================================
   PTF Material Advisor — Sprint 61 (US-108)
   مشاور انتخاب متریال: پایپ، فیتینگ، فلنج، ولو، برق، ابزار دقیق، پمپ، گسکت
   موتور درخت تصمیم data-driven — بدون وابستگی خارجی
   ===================================================================== */
(function (global) {
  'use strict';

  /* ================= جداول مرجع (AC4) ================= */
  var REF = {
    // کلاس فشاری فلنج ASME B16.5 — حداکثر فشار کاری (barg) در دما (°C) برای گروه متریال 1.1 (A105)
    flangePT: {
      title: 'PT Rating فلنج ASME B16.5 — متریال A105 (Group 1.1)',
      cols: ['کلاس', '38°C', '200°C', '300°C', '400°C'],
      rows: [
        ['150#', '19.6', '13.8', '10.2', '6.5'],
        ['300#', '51.1', '43.8', '39.8', '34.7'],
        ['600#', '102.1', '87.6', '79.6', '69.4'],
        ['900#', '153.2', '131.4', '119.5', '104.2'],
        ['1500#', '255.3', '219.0', '199.1', '173.6'],
        ['2500#', '425.5', '365.0', '331.8', '289.3']
      ]
    },
    // معادل استانداردهای متریال
    matEquiv: {
      title: 'معادل استانداردهای متریال (لوله ↔ فیتینگ ↔ فلنج)',
      cols: ['کاربرد', 'لوله', 'فیتینگ جوشی', 'فلنج', 'ولو (بدنه)'],
      rows: [
        ['دمای نرمال (کربن استیل)', 'A106 Gr.B', 'A234 WPB', 'A105', 'A216 WCB'],
        ['دمای پایین تا −46°C', 'A333 Gr.6', 'A420 WPL6', 'A350 LF2', 'A352 LCB/LCC'],
        ['استنلس 304', 'A312 TP304', 'A403 WP304', 'A182 F304', 'A351 CF8'],
        ['استنلس 316', 'A312 TP316', 'A403 WP316', 'A182 F316', 'A351 CF8M'],
        ['دمای بالا (آلیاژی)', 'A335 P11/P22', 'A234 WP11/WP22', 'A182 F11/F22', 'A217 WC6/WC9']
      ]
    },
    valveClass: {
      title: 'انتخاب تیپ ولو بر اساس کارکرد',
      cols: ['کارکرد', 'تیپ پیشنهادی', 'استاندارد ساخت', 'نکته'],
      rows: [
        ['قطع/وصل کامل', 'Gate / Ball', 'API 600 / API 6D', 'افت فشار کم'],
        ['تنظیم دبی', 'Globe / Control', 'BS 1873 / IEC 60534', 'هرگز با Gate تنظیم نکنید'],
        ['جلوگیری از برگشت', 'Check (Swing/Dual)', 'API 594 / BS 1868', 'جهت نصب مهم'],
        ['فضای محدود/قطر بالا', 'Butterfly', 'API 609', 'وزن و قیمت کمتر'],
        ['سرویس لجنی/ساینده', 'Knife Gate / Pinch', 'MSS SP-81', 'صنایع معدنی']
      ]
    },
    ipGuide: {
      title: 'انتخاب درجه حفاظت IP تجهیزات برق و ابزار دقیق',
      cols: ['محیط نصب', 'حداقل IP', 'توضیح'],
      rows: [
        ['داخل تابلو/اتاق کنترل', 'IP42', 'حفاظت پایه'],
        ['سالن صنعتی سرپوشیده', 'IP54', 'گرد و غبار + پاشش'],
        ['فضای باز (Outdoor)', 'IP65', 'استاندارد رایج سایت'],
        ['شست‌وشوی مستقیم/باران شدید', 'IP66', 'واترجت'],
        ['غوطه‌وری موقت', 'IP67', 'ترانسمیترهای چاهک']
      ]
    }
  };

  /* ================= درخت‌های تصمیم (AC1, AC2) ================= */
  // ساختار: هر خانواده → سوالات → قواعد → نتیجه {grade, std, note, kc}
  var TREES = {
    pipe: {
      lb: 'لوله (Pipe)',
      qs: [
        { id: 'fluid', q: 'سیال چیست؟', opts: ['هیدروکربن/آب/بخار', 'گاز ترش (H2S)', 'اسید/خورنده', 'آب دریا'] },
        { id: 'temp', q: 'دمای کاری؟', opts: ['نرمال (−29 تا 400°C)', 'پایین (تا −46°C)', 'بالا (400 تا 600°C)'] },
        { id: 'press', q: 'فشار طراحی؟', opts: ['تا 20 بار', '20 تا 100 بار', 'بالای 100 بار'] }
      ],
      decide: function (a) {
        if (a.fluid === 'اسید/خورنده' || a.fluid === 'آب دریا')
          return { grade: 'A312 TP316L (استنلس)', std: 'ASME B36.19', note: 'برای خوردگی بالا؛ در آب دریا Duplex (A790) هم بررسی شود. Low-Carbon (L) برای جوشکاری.', kc: { lb: 'مقاله لوله استنلس', url: 'knowledge-center/a312-tp316l.html' } };
        if (a.fluid === 'گاز ترش (H2S)')
          return { grade: 'A106 Gr.B + الزامات NACE MR0175', std: 'ASME B36.10 + NACE', note: 'سختی حداکثر 22 HRC، تست HIC برای ورق. گواهی NACE از سازنده الزامی.', kc: { lb: 'راهنمای سرویس ترش', url: 'knowledge-center/nace-mr0175.html' } };
        if (a.temp === 'پایین (تا −46°C)')
          return { grade: 'A333 Gr.6', std: 'ASME B36.10', note: 'تست ضربه شارپی در −46°C الزامی. فیتینگ A420 WPL6 و فلنج A350 LF2 ست شود.', kc: { lb: 'A106 vs A333', url: 'blog/a106-vs-a333-pipes.html' } };
        if (a.temp === 'بالا (400 تا 600°C)')
          return { grade: 'A335 P11 (تا 550°C) / P22 (تا 600°C)', std: 'ASME B36.10', note: 'آلیاژ کروم-مولیبدن؛ عملیات حرارتی پس از جوش (PWHT) الزامی.', kc: null };
        var sch = a.press === 'بالای 100 بار' ? 'SCH 160/XXS' : (a.press === '20 تا 100 بار' ? 'SCH 80' : 'SCH 40');
        return { grade: 'A106 Gr.B مانیسمان', std: 'ASME B36.10 — ' + sch, note: 'انتخاب استاندارد صنعت نفت و گاز. ضخامت دقیق با محاسبه B31.3 تایید شود.', kc: { lb: 'راهنمای کامل A106', url: 'knowledge-center/a106-gr-b.html' } };
      }
    },
    fitting: {
      lb: 'فیتینگ و اتصالات',
      qs: [
        { id: 'pipeMat', q: 'متریال لوله خط؟', opts: ['A106 Gr.B', 'A333 Gr.6', 'استنلس 304/316', 'آلیاژی P11/P22'] },
        { id: 'size', q: 'سایز اتصال؟', opts: ['تا 2 اینچ', 'بالای 2 اینچ'] }
      ],
      decide: function (a) {
        var map = { 'A106 Gr.B': ['A234 WPB', 'A105'], 'A333 Gr.6': ['A420 WPL6', 'A350 LF2'], 'استنلس 304/316': ['A403 WP304/316', 'A182 F304/316'], 'آلیاژی P11/P22': ['A234 WP11/WP22', 'A182 F11/F22'] };
        var m = map[a.pipeMat] || map['A106 Gr.B'];
        if (a.size === 'تا 2 اینچ')
          return { grade: m[1] + ' (فورج)', std: 'ASME B16.11 — Socket Weld یا Threaded، کلاس 3000/6000', note: 'سایز کوچک: اتصالات فورجی. کلاس بر اساس فشار خط.', kc: { lb: 'راهنمای فیتینگ فورج', url: 'knowledge-center/asme-b16-11.html' } };
        return { grade: m[0] + ' (جوشی)', std: 'ASME B16.9 — Butt Weld', note: 'ضخامت فیتینگ با SCH لوله یکسان باشد. متریال هم‌خانواده لوله (جدول معادل‌ها).', kc: { lb: 'جدول معادل متریال', url: '#ref-matEquiv' } };
      }
    },
    flange: {
      lb: 'فلنج',
      qs: [
        { id: 'press', q: 'فشار طراحی خط؟', opts: ['تا 19 بار', 'تا 50 بار', 'تا 100 بار', 'بالای 100 بار'] },
        { id: 'temp', q: 'دمای کاری؟', opts: ['تا 200°C', '200 تا 400°C'] },
        { id: 'crit', q: 'سرویس؟', opts: ['عمومی', 'ترش/سمی (بدون نشتی)'] }
      ],
      decide: function (a) {
        var cls = a.press === 'تا 19 بار' ? '150#' : a.press === 'تا 50 بار' ? '300#' : a.press === 'تا 100 بار' ? '600#' : '900# یا بالاتر';
        if (a.temp === '200 تا 400°C' && cls === '150#') cls = '300# (به دلیل افت ریتینگ در دما)';
        var face = a.crit === 'ترش/سمی (بدون نشتی)' ? 'RTJ (Ring Type Joint)' : 'RF (Raised Face)';
        return { grade: 'A105 — کلاس ' + cls, std: 'ASME B16.5، نوع Weld Neck، سطح ' + face, note: 'کلاس نهایی حتماً با جدول PT Rating در دمای واقعی کنترل شود (جدول مرجع پایین). برای دمای پایین A350 LF2.', kc: { lb: 'راهنمای انواع فلنج', url: 'blog/flange-types-guide.html' } };
      }
    },
    valve: {
      lb: 'شیرآلات (Valve)',
      qs: [
        { id: 'func', q: 'کارکرد اصلی؟', opts: ['قطع/وصل', 'تنظیم دبی', 'جلوگیری از برگشت', 'قطر بالا/فضای کم'] },
        { id: 'fluid', q: 'سیال؟', opts: ['عمومی', 'ترش H2S', 'خورنده'] },
        { id: 'act', q: 'راهبری؟', opts: ['دستی', 'اکچویتور (کنترلی)'] }
      ],
      decide: function (a) {
        var t = a.func === 'قطع/وصل' ? 'Ball Valve (تا 8") یا Gate Valve' : a.func === 'تنظیم دبی' ? 'Globe Valve (دستی) یا Control Valve' : a.func === 'جلوگیری از برگشت' ? 'Swing Check / Dual Plate Check' : 'Butterfly (Double/Triple Offset)';
        var body = a.fluid === 'خورنده' ? 'A351 CF8M (SS316)' : 'A216 WCB';
        var trim = a.fluid === 'ترش H2S' ? 'تریم SS316 + NACE MR0175' : a.fluid === 'خورنده' ? 'تریم کامل SS316' : 'تریم 13%Cr (API Trim 1)';
        var std = a.func === 'قطر بالا/فضای کم' ? 'API 609' : a.func === 'جلوگیری از برگشت' ? 'API 594 / BS 1868' : 'API 600 / API 6D + تست API 598';
        var note = 'بدنه: ' + body + ' | ' + trim + (a.act === 'اکچویتور (کنترلی)' ? ' | همراه اکچویتور: مشخصات هوا/برق سایت اعلام شود.' : '');
        return { grade: t, std: std, note: note, kc: { lb: 'راهنمای جامع شیرآلات', url: 'blog/industrial-valves-complete-guide.html' } };
      }
    },
    instrument: {
      lb: 'ابزار دقیق',
      qs: [
        { id: 'meas', q: 'چه کمیتی؟', opts: ['فشار', 'دما', 'دبی (فلو)', 'سطح (Level)'] },
        { id: 'out', q: 'خروجی؟', opts: ['نمایش محلی (گیج)', 'سیگنال 4-20mA', 'دیجیتال/HART'] },
        { id: 'zone', q: 'منطقه نصب؟', opts: ['عادی', 'مستعد انفجار (Ex)'] }
      ],
      decide: function (a) {
        var dev = { 'فشار': ['گیج فشار WIKA 232.50 (EN 837-1)', 'ترانسمیتر فشار Rosemount 3051 / WIKA'], 'دما': ['ترمومتر بی‌متال + ترموول', 'ترانسمیتر دما + RTD Pt100 (IEC 60751)'], 'دبی (فلو)': ['روتامتر', 'فلومتر مغناطیسی/ورتکس/کوریولیس E+H'], 'سطح (Level)': ['گیج شیشه‌ای/مگنتیک', 'ترانسمیتر سطح راداری/DP E+H'] };
        var idx = a.out === 'نمایش محلی (گیج)' ? 0 : 1;
        var d = dev[a.meas][idx];
        var note = 'حداقل IP65 برای نصب سایت' + (a.zone === 'مستعد انفجار (Ex)' ? ' + گواهی ATEX/IECEx (Ex d یا Ex ia) الزامی' : '') + (a.out === 'دیجیتال/HART' ? ' + پروتکل HART 7' : '') + '. اتصال فرآیندی 1/2" NPT رایج.';
        return { grade: d, std: a.meas === 'فشار' ? 'EN 837-1 / IEC 60770' : 'IEC 60751 / API RP 551', note: note, kc: { lb: 'راهنمای ترانسمیتر فشار', url: 'blog/pressure-transmitter-guide.html' } };
      }
    },
    electrical: {
      lb: 'برق صنعتی',
      qs: [
        { id: 'item', q: 'چه تجهیزی؟', opts: ['کابل قدرت', 'تابلو/سوییچگیر', 'الکتروموتور'] },
        { id: 'env', q: 'محیط نصب؟', opts: ['داخل ساختمان', 'فضای باز', 'مستعد انفجار (Ex)'] }
      ],
      decide: function (a) {
        if (a.item === 'کابل قدرت')
          return { grade: 'کابل XLPE مسلح (SWA) — NYRY/N2XRY', std: 'IEC 60502-1', note: (a.env === 'مستعد انفجار (Ex)' ? 'ورودی کابل به تجهیز Ex با گلند Ex d برنجی. ' : '') + 'سایز با محاسبه افت ولتاژ و جریان مجاز تعیین شود؛ دفن مستقیم → مسلح.', kc: { lb: 'راهنمای تابلو و سوییچگیر', url: 'blog/electrical-switchgear-guide.html' } };
        if (a.item === 'تابلو/سوییچگیر')
          return { grade: a.env === 'فضای باز' ? 'تابلو Outdoor IP65' : 'تابلو IP42/54', std: 'IEC 61439 (LV) / IEC 62271 (MV)', note: 'Form of Separation (2b/3b/4b) بر اساس نیاز نگهداری. تاییدیه Type Test.', kc: { lb: 'راهنمای سوییچگیر', url: 'blog/electrical-switchgear-guide.html' } };
        return { grade: a.env === 'مستعد انفجار (Ex)' ? 'الکتروموتور Ex d (ATEX)' : 'الکتروموتور IE3 استاندارد', std: 'IEC 60034 / IEC 60079 (Ex)', note: 'IP55 حداقل برای سایت؛ کلاس عایقی F با رایز B. برای درایو (VFD) موتور Inverter Duty.', kc: null };
      }
    },
    pump: {
      lb: 'پمپ',
      qs: [
        { id: 'srv', q: 'سرویس؟', opts: ['آب/یوتیلیتی', 'هیدروکربن (نفت و گاز)', 'مواد خورنده/شیمیایی', 'لجن/دوغاب'] },
        { id: 'head', q: 'هد و دبی؟', opts: ['معمولی', 'هد بالا/دبی کم', 'دبی بالا'] }
      ],
      decide: function (a) {
        if (a.srv === 'هیدروکربن (نفت و گاز)')
          return { grade: 'پمپ سانتریفیوژ API 610 (OH2/BB2)', std: 'API 610 / ISO 13709', note: 'مکانیکال سیل طبق API 682 (Plan 11/52/53). متریال طبق جدول H-1 استاندارد.', kc: null };
        if (a.srv === 'مواد خورنده/شیمیایی')
          return { grade: 'پمپ ANSI B73.1 با متریال SS316/Alloy20 یا Magnetic Drive', std: 'ASME B73.1', note: 'برای سیال سمی: پمپ مگنتی بدون سیل (Sealless).', kc: null };
        if (a.srv === 'لجن/دوغاب')
          return { grade: 'پمپ اسلاری با لاینر لاستیکی/High-Chrome', std: 'ISO 21940 بالانس', note: 'A532 برای سایش بالا؛ سرعت پایین‌تر = عمر بیشتر.', kc: null };
        if (a.head === 'هد بالا/دبی کم')
          return { grade: 'پمپ چندطبقه (Multistage)', std: 'ISO 5199 / EN 733', note: 'بررسی NPSH available در مکش الزامی.', kc: null };
        return { grade: 'پمپ سانتریفیوژ End-Suction چدنی', std: 'EN 733 (DIN 24255)', note: 'اقتصادی‌ترین انتخاب یوتیلیتی. پروانه برنزی برای آب.', kc: null };
      }
    },
    gasket: {
      lb: 'گسکت و پیچ‌ومهره',
      qs: [
        { id: 'cls', q: 'کلاس فلنج؟', opts: ['150#/300#', '600# و بالاتر'] },
        { id: 'srv', q: 'سرویس؟', opts: ['عمومی', 'ترش/دمای بالا'] }
      ],
      decide: function (a) {
        var g = a.cls === '150#/300#' && a.srv === 'عمومی' ? 'اسپیرال وند SS316/گرافیت (ASME B16.20)' : 'اسپیرال وند با رینگ داخلی یا RTJ استیل نرم';
        return { grade: g + ' + استاد بولت A193 B7 / مهره A194 2H', std: 'ASME B16.20 / A193-A194', note: a.srv === 'ترش/دمای بالا' ? 'سرویس ترش: بولت B7M (سختی کنترل‌شده NACE).' : 'گسکت مصرفی است — همیشه ۱۰٪ اضافه سفارش دهید.', kc: { lb: 'مقاله فلنج و گسکت', url: 'blog/flange-types-guide.html' } };
      }
    }
  };

  /* ================= API عمومی ================= */
  global.PTF_ADVISOR = {
    trees: TREES,
    refs: REF,
    families: Object.keys(TREES).map(function (k) { return { id: k, lb: TREES[k].lb }; }),
    decide: function (family, answers) {
      var t = TREES[family];
      if (!t) return null;
      var r = t.decide(answers);
      r.family = t.lb;
      return r;
    },
    // لینک استعلام پیش‌پرشده (AC3)
    rfqLink: function (result) {
      var txt = result.family + ' — ' + result.grade + ' (' + result.std + ')';
      return 'rfq/?item=' + encodeURIComponent(txt);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
