/* =====================================================================
   PTF Engineering Tools — Sprint 66 (US-126)
   موتور محاسبات مهندسی — کاملاً سمت کلاینت
   مرجع‌ها: IEC 60534 (ساده‌شده)، API 520/526، ASME B36.10/B16.5، B31.3
   ===================================================================== */
(function (global) {
  'use strict';

  /* ============ جداول مرجع ============ */
  // ASME B36.10 — وزن لوله کربن استیل kg/m {NPS: {SCH: [OD_mm, WT_mm, kg/m]}}
  var PIPE = {
    '1/2': { OD: 21.3, S40: [2.77, 1.27], S80: [3.73, 1.62], S160: [4.78, 1.95] },
    '3/4': { OD: 26.7, S40: [2.87, 1.69], S80: [3.91, 2.20], S160: [5.56, 2.90] },
    '1':   { OD: 33.4, S40: [3.38, 2.50], S80: [4.55, 3.24], S160: [6.35, 4.24] },
    '1-1/2': { OD: 48.3, S40: [3.68, 4.05], S80: [5.08, 5.41], S160: [7.14, 7.25] },
    '2':   { OD: 60.3, S40: [3.91, 5.44], S80: [5.54, 7.48], S160: [8.74, 11.11] },
    '3':   { OD: 88.9, S40: [5.49, 11.29], S80: [7.62, 15.27], S160: [11.13, 21.35] },
    '4':   { OD: 114.3, S40: [6.02, 16.07], S80: [8.56, 22.32], S160: [13.49, 33.54] },
    '6':   { OD: 168.3, S40: [7.11, 28.26], S80: [10.97, 42.56], S160: [18.26, 67.56] },
    '8':   { OD: 219.1, S40: [8.18, 42.55], S80: [12.70, 64.64], S160: [23.01, 111.27] },
    '10':  { OD: 273.0, S40: [9.27, 60.31], S80: [15.09, 96.01], S160: [28.58, 172.33] },
    '12':  { OD: 323.8, S40: [10.31, 79.73], S80: [17.48, 132.08], S160: [33.32, 238.76] },
    '14':  { OD: 355.6, S40: [11.13, 94.55], S80: [19.05, 158.10], S160: [35.71, 281.70] },
    '16':  { OD: 406.4, S40: [12.70, 123.30], S80: [21.44, 203.53], S160: [40.49, 365.35] },
    '18':  { OD: 457.0, S40: [14.27, 155.80], S80: [23.83, 254.55], S160: [45.24, 459.37] },
    '20':  { OD: 508.0, S40: [15.09, 183.42], S80: [26.19, 311.17], S160: [50.01, 564.81] },
    '24':  { OD: 610.0, S40: [17.48, 255.41], S80: [30.96, 442.08], S160: [59.54, 808.22] }
  };
  var MAT_DENSITY = { cs: 1.0, ss304: 1.013, ss316: 1.013, alloy: 1.0 }; // ضریب نسبت به کربن استیل
  var MAT_LB = { cs: 'کربن استیل (A106/A53)', ss304: 'استنلس 304', ss316: 'استنلس 316', alloy: 'آلیاژی (P11/P22)' };

  // وزن تقریبی فلنج WN کلاس‌ها (kg) — B16.5
  var FLANGE_W = {
    '150': { '1/2': 0.9, '1': 1.3, '2': 2.7, '3': 4.5, '4': 6.5, '6': 10.5, '8': 16, '10': 24, '12': 34, '16': 55, '20': 88, '24': 130 },
    '300': { '1/2': 1.1, '1': 1.8, '2': 3.6, '3': 7, '4': 10.5, '6': 17.5, '8': 27, '10': 40, '12': 57, '16': 95, '20': 150, '24': 230 },
    '600': { '1/2': 1.4, '1': 2.7, '2': 5.5, '3': 10.5, '4': 16.5, '6': 30, '8': 48, '10': 75, '12': 105, '16': 180, '20': 290, '24': 435 },
    '900': { '1/2': 2.7, '1': 4.5, '2': 9, '3': 16, '4': 25, '6': 50, '8': 82, '10': 125, '12': 185, '16': 305, '20': 495, '24': 750 },
    '1500': { '1/2': 2.7, '1': 4.5, '2': 11, '3': 22, '4': 36, '6': 75, '8': 130, '10': 210, '12': 320, '16': 545, '20': 900, '24': 1400 }
  };
  // وزن الو 90 LR جوشی ~ ضریب × وزن متر لوله
  var ELBOW_K = 1.5 / 1000; // × OD(mm) × kg/m تقریب: W ≈ 1.5×D(m)×(kg/m)

  // SMYS متریال‌ها (MPa) + کاهش دما (B31.3 ساده‌شده — تنش مجاز S = min(SMYS/3, ...) تقریب: S=138MPa برای A106 تا 200C)
  var ALLOW_S = { // MPa تنش مجاز در دماها
    cs:   { 38: 138, 200: 132, 300: 117, 400: 90 },
    ss316:{ 38: 138, 200: 118, 300: 107, 400: 100 },
    alloy:{ 38: 138, 200: 136, 300: 132, 400: 122 }
  };

  // اریفیس‌های API 526 (in²)
  var API526 = [['D', 0.110], ['E', 0.196], ['F', 0.307], ['G', 0.503], ['H', 0.785], ['J', 1.287], ['K', 1.838], ['L', 2.853], ['M', 3.60], ['N', 4.34], ['P', 6.38], ['Q', 11.05], ['R', 16.0], ['T', 26.0]];

  // Cv معمول ولوهای کنترلی گلوب (full trim)
  var VALVE_CV = [['1"', 12], ['1-1/2"', 25], ['2"', 45], ['3"', 100], ['4"', 175], ['6"', 400], ['8"', 700], ['10"', 1100], ['12"', 1600]];

  /* ============ ۱. سایزینگ ولو کنترلی (Cv) ============ */
  function sizeCv(inp) {
    // inp: {fluid:'liquid|gas|steam', Q, P1, P2, T, SG, visc}
    var dP = inp.P1 - inp.P2;
    if (dP <= 0) return { err: 'فشار خروجی باید کمتر از ورودی باشد' };
    var Cv, warn = [];
    if (inp.fluid === 'liquid') {
      // Cv = Q[m3/h] * sqrt(SG/dP[bar]) / 0.865
      Cv = inp.Q * Math.sqrt((inp.SG || 1) / dP) / 0.865;
      // کاویتاسیون: اگر dP > 0.5×(P1 - Pv~0.02bar آب)
      if (dP > 0.5 * (inp.P1 - 0.02)) warn.push('⚠️ ریسک کاویتاسیون/فلشینگ — تریم ضدکاویتاسیون یا کاهش dP بررسی شود');
      if ((inp.visc || 1) > 100) warn.push('⚠️ ویسکوزیته بالا — ضریب تصحیح Fv لازم است (با سازنده چک شود)');
    } else if (inp.fluid === 'gas') {
      var T = (inp.T || 20) + 273;
      if (dP < inp.P1 / 2) {
        Cv = (inp.Q / 417) * Math.sqrt((inp.SG || 1) * T / (dP * (inp.P1 + inp.P2)));
      } else {
        Cv = (inp.Q / (0.471 * 417 * inp.P1)) * Math.sqrt((inp.SG || 1) * T);
        warn.push('⚠️ جریان چوک (خفه) — dP > P1/2؛ نویز و سایش بررسی شود');
      }
    } else { // steam kg/h
      if (dP < inp.P1 / 2) Cv = inp.Q / (13.67 * Math.sqrt(dP * (inp.P1 + inp.P2)));
      else { Cv = inp.Q / (11.7 * inp.P1); warn.push('⚠️ جریان چوک بخار'); }
    }
    Cv = Math.round(Cv * 10) / 10;
    // انتخاب سایز: Cv ولو ≥ 1.25×Cv محاسبه‌شده و باز بودن ۶۰-۸۰٪
    var pick = null;
    for (var i = 0; i < VALVE_CV.length; i++) {
      if (VALVE_CV[i][1] >= Cv * 1.25) { pick = VALVE_CV[i]; break; }
    }
    var openPct = pick ? Math.round(Cv * 100 / pick[1]) : null;
    if (pick && openPct < 20) warn.push('⚠️ ولو در باز بودن خیلی کم کار می‌کند — سایز کوچکتر یا reduced trim بررسی شود');
    return { Cv: Cv, Kv: Math.round(Cv * 0.865 * 10) / 10, size: pick ? pick[0] : 'بزرگتر از 12" — محاسبه سازنده', open: openPct, warns: warn, ref: 'IEC 60534-2-1 (ساده‌شده)' };
  }

  /* ============ ۲. سایزینگ ولو آن/آف ============ */
  function sizeOnOff(inp) {
    // inp: {fluid:'liquid|gas', Q m3/h, size_line_mm}
    var vMax = inp.fluid === 'liquid' ? 4 : 20; // m/s راهنما
    // سرعت در لوله انتخابی: v = Q/3600 / A
    var A = Math.PI * Math.pow((inp.lineID || 52.5) / 2000, 2);
    var v = (inp.Q / 3600) / A;
    var ok = v <= vMax;
    return { v: Math.round(v * 100) / 100, vMax: vMax, ok: ok,
      advice: ok ? '✅ سایز هم‌خط (line size) مناسب است — ولو توپی/دروازه‌ای فول‌بور همان سایز خط'
                 : '⚠️ سرعت بالاست — سایز بزرگتر یا بررسی افت فشار لازم است',
      ref: 'راهنمای سرعت مجاز: مایع ≤4m/s، گاز ≤20m/s' };
  }

  /* ============ ۳. سایزینگ PRV (API 520 ساده‌شده — گاز/بخار بحرانی) ============ */
  function sizePRV(inp) {
    // inp: {W kg/h, P1_set barg, over % (10/16/21), T C, M molw, scenario}
    var P1 = (inp.Pset * (1 + (inp.over || 10) / 100)) + 1.013; // bara
    var T = (inp.T || 25) + 273;
    var M = inp.M || 29;
    var C = 2.7; // ضریب گاز ایده‌آل k~1.3 تقریبی (C=520 imperial→متریک ساده)
    // A[cm2] = W / (C·Kd·P1·Kb) × sqrt(T·Z/M)  — فرم متریک ساده‌شده API 520:
    // A(cm²) ≈ 13160·W(kg/h) / (C'·Kd·P1(kPa)) · sqrt(T·Z/M) با C'≈2600 برای k=1.3
    var Kd = 0.975;
    var A_cm2 = (13160 * inp.W / (2600 * Kd * (P1 * 100))) * Math.sqrt(T * 1 / M);
    var A_in2 = A_cm2 / 6.4516;
    var pick = null;
    for (var i = 0; i < API526.length; i++) if (API526[i][1] >= A_in2) { pick = API526[i]; break; }
    return { A_cm2: Math.round(A_cm2 * 100) / 100, A_in2: Math.round(A_in2 * 1000) / 1000,
      orifice: pick ? pick[0] : 'بزرگتر از T — چند ولو موازی', orifArea: pick ? pick[1] : null,
      warns: [inp.scenario === 'fire' ? '⚠️ سناریوی آتش: دبی ریلیف طبق API 521 محاسبه شود' : '',
              '📌 محاسبه نهایی و انتخاب مدل الزاماً توسط سازنده PRV تایید شود (Kb، لزجت، بک‌پرشر)'].filter(Boolean),
      ref: 'API 520 Part I (گاز/بخار، جریان بحرانی، ساده‌شده) + اریفیس API 526' };
  }

  /* ============ ۴. وزن متریال ============ */
  function pipeWeight(nps, sch, mat, lenM) {
    var p = PIPE[nps];
    if (!p || !p[sch]) return null;
    var kgm = p[sch][1] * (MAT_DENSITY[mat] || 1);
    return { kgm: Math.round(kgm * 100) / 100, total: Math.round(kgm * (lenM || 1) * 10) / 10, OD: p.OD, WT: p[sch][0] };
  }
  function flangeWeight(cls, nps, qty) {
    var w = (FLANGE_W[cls] || {})[nps];
    if (w == null) return null;
    return { each: w, total: Math.round(w * (qty || 1) * 10) / 10 };
  }
  function elbowWeight(nps, sch, mat, qty) {
    var p = PIPE[nps];
    if (!p || !p[sch]) return null;
    var kgm = p[sch][1] * (MAT_DENSITY[mat] || 1);
    var w = 1.5 * (p.OD / 1000) * kgm * Math.PI / 2; // طول قوس LR ≈ 1.5D×π/2
    return { each: Math.round(w * 100) / 100, total: Math.round(w * (qty || 1) * 10) / 10 };
  }

  /* ============ ۵. تحمل فشار لوله (Barlow / B31.3) ============ */
  function pipePressure(inp) {
    // inp: {nps, sch, mat, T, E (1/0.85), CA mm}
    var p = PIPE[inp.nps];
    if (!p || !p[inp.sch]) return null;
    var OD = p.OD, t = p[inp.sch][0];
    var tEff = Math.max(0, t * 0.875 - (inp.CA || 0)); // تلرانس ضخامت 12.5%
    var S = ALLOW_S[inp.mat] || ALLOW_S.cs;
    var temps = Object.keys(S).map(Number).sort(function (a, b) { return a - b; });
    var Tq = inp.T || 38;
    var Sv = S[temps[0]];
    for (var i = 0; i < temps.length; i++) if (Tq >= temps[i]) Sv = S[temps[i]];
    var E = inp.E || 1;
    // P = 2·S·E·t / (D - 2·t·Y) با Y=0.4
    var P_MPa = (2 * Sv * E * tEff) / (OD - 2 * tEff * 0.4);
    return { P_bar: Math.round(P_MPa * 10 * 10) / 10, tEff: Math.round(tEff * 100) / 100, S: Sv, E: E,
      note: 'فرمول B31.3 با Y=0.4، تلرانس ضخامت ۱۲.۵٪' + (inp.CA ? '، خوردگی ' + inp.CA + 'mm' : ''),
      ref: 'ASME B31.3 — 304.1.2 (ساده‌شده؛ طراحی نهایی با مهندس تایید شود)' };
  }

  /* ============ ۶. ترک‌تیبل ولو کنترلی ============ */
  function trackTable(cvMax, charType, Q100) {
    // charType: linear | eqp | qo — خروجی: [{open, cvPct, cv, q}]
    var R = 50; // rangeability EQ%
    var rows = [];
    for (var o = 0; o <= 100; o += 10) {
      var f;
      if (charType === 'linear') f = o / 100;
      else if (charType === 'eqp') f = o === 0 ? 0 : Math.pow(R, o / 100 - 1);
      else f = o === 0 ? 0 : Math.sqrt(o / 100); // quick opening تقریب
      rows.push({ open: o, cvPct: Math.round(f * 1000) / 10, cv: Math.round(cvMax * f * 10) / 10, q: Q100 ? Math.round(Q100 * f * 10) / 10 : null });
    }
    return rows;
  }

  global.PTF_TOOLS = {
    PIPE: PIPE, MAT_LB: MAT_LB, FLANGE_W: FLANGE_W, API526: API526, VALVE_CV: VALVE_CV,
    sizeCv: sizeCv, sizeOnOff: sizeOnOff, sizePRV: sizePRV,
    pipeWeight: pipeWeight, flangeWeight: flangeWeight, elbowWeight: elbowWeight,
    pipePressure: pipePressure, trackTable: trackTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
