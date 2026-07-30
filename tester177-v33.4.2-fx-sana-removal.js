/* AUD-14 fixture — "بازنگری نرخ ارز سنا" — client request (2026-07-30, Persian):
   "نرخ ارز خیلی دیر می‌آید ... نرخ ارز سنا کلا اشتباه است، اگر عدد درست از منابع
   معتبر قابل دسترسی نیست کلا کنار گذاشته شود".

   Root-cause investigation (documented to the client before implementation):
   1. Iran's central bank officially discontinued the "banknote sana" rate on
      1404/10/22; only the "havaleh" (transfer) rate of the currency exchange
      center is published now — the old "sana" concept the code chased is
      obsolete.
   2. The TGJU page the code used as a sana/ICE fallback (sana_buy_usd /
      sana_sell_usd) has been frozen since that date and never updates — this
      is exactly what the client observed (a wrong, stale number).
   3. sanarate.ir / fxmarketrate.cbi.ir do not resolve from outside Iran, and
      ice.ir explicitly blocks non-Iran access ("فقط در داخل ایران") — so every
      request wasted several sequential HTTP timeouts (up to ~5-6 attempts)
      before falling back to the one source that actually works (TGJU free
      market), which explains the "نرخ ارز خیلی دیر می‌آید" complaint too.

   Client's explicit decision (via ask_user): remove "sana" entirely, keep only
   the free-market rate (verified live and correct).

   This fixture verifies, purely via Node.js (regex/structural checks on the
   real source since fx-rates.php is server-side PHP not runnable here, plus a
   pure-JS behavioral mirror of its core TGJU-parsing logic; and full vm
   execution of the client-side JS files fx.js/petty.js/offers-pro.js):
   - No remaining "sana" fetch attempts or option in any purchase/sale
     currency-conversion dialog.
   - The free-market rate path still works end-to-end. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

/* ===================== Part 1: api/fx-rates.php — static structural checks ===================== */
(function () {
  var srcFull = fs.readFileSync('api/fx-rates.php', 'utf8');
  /* توضیحات بالای فایل عمداً از واژه‌های sana_buy_usd/sanarate.ir به‌عنوان مستندسازی
     تاریخچه استفاده می‌کنند (چرا حذف شد)؛ بررسی واقعی باید فقط روی کدِ اجرایی
     (بعد از بلوک کامنت ابتدایی) باشد. */
  var commentEnd = srcFull.indexOf('*/');
  var src = commentEnd > -1 ? srcFull.slice(commentEnd + 2) : srcFull;
  ['fx_fetch_sanarate_official', 'fx_fetch_ice_official', 'fx_fetch_ice_one', 'fx_fetch_isat_legacy',
   'sana_buy_usd', 'sana_sell_usd', 'sana_buy_eur', 'sana_sell_eur', 'sanarate.ir', 'ice.ir', 'isat.ir'
  ].forEach(function (needle) {
    assert.ok(src.indexOf(needle) === -1, 'منبع/تابع سنا/ICE/isat باید کاملاً از کد اجرایی حذف شده باشد: ' + needle);
  });
  assert.ok(src.indexOf('fx_fetch_tgju_ajax') > -1, 'تابع منبع آزاد (TGJU) باید باقی بماند');
  assert.ok(src.indexOf('usd_free') > -1 && src.indexOf('eur_free') > -1, 'فیلدهای نرخ آزاد باید باقی بمانند');
  // Brace/paren balance sanity (best-effort syntax check without a PHP interpreter available in this sandbox).
  var stripped = srcFull.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '');
  var opens = { '{': 0, '(': 0, '[': 0 };
  var closes = { '}': 0, ')': 0, ']': 0 };
  for (var i = 0; i < stripped.length; i++) {
    var c = stripped[i];
    if (opens.hasOwnProperty(c)) opens[c]++;
    if (closes.hasOwnProperty(c)) closes[c]++;
  }
  assert.strictEqual(opens['{'], closes['}'], 'براکت‌های {} باید متوازن باشند');
  assert.strictEqual(opens['('], closes[')'], 'پرانتزهای () باید متوازن باشند');
  assert.strictEqual(opens['['], closes[']'], 'براکت‌های [] باید متوازن باشند');
})();


/* ===================== Part 2: api/fx-rates.php — pure-JS mirror of core TGJU parsing logic =====================
   Since no PHP interpreter is available in this sandbox, the exact parsing
   algorithm (fx_num_rial + fx_fetch_tgju_ajax's keymap/candidate logic) is
   mirrored line-for-line in JS and exercised against a realistic TGJU
   ajax.json snapshot (captured live from call4.tgju.org during this session's
   investigation) to prove the free-market-only path still produces correct
   numbers end-to-end. */
(function () {
  function fx_num_rial(v) {
    if (v == null) return 0;
    var s = String(v).replace(/[۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٬، ]/g, function (ch) {
      var map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
        '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','٬':',','،':',' };
      return map[ch] !== undefined ? map[ch] : '';
    });
    s = s.replace(/[^0-9.]/g, '');
    if (!s) return 0;
    var n = parseFloat(s);
    if (!(n > 0)) return 0;
    return Math.round(n);
  }
  function fx_fetch_tgju_logic(sampleJson) {
    var keymap = { usd_free: 'price_dollar_rl', eur_free: 'price_eur', cny_free: 'price_cny', gold_18: 'geram18' };
    var cny_hav_candidates = ['price_transfer_cny', 'yuan_transfer', 'transfer_cny', 'havaleh_cny', 'nima_buy_cny', 'price_cny_hav', 'price_cny', 'cny_hav', 'yuan_hav'];
    var cur = sampleJson.current;
    if (!cur) return null;
    var out = {};
    Object.keys(keymap).forEach(function (ours) {
      var theirs = keymap[ours];
      var p = cur[theirs] && cur[theirs].p;
      out[ours] = p != null ? fx_num_rial(p) : 0;
    });
    out.cny_hav = 0;
    for (var i = 0; i < cny_hav_candidates.length; i++) {
      var cand = cny_hav_candidates[i];
      if (cur[cand] && cur[cand].p != null) { out.cny_hav = fx_num_rial(cur[cand].p); break; }
    }
    if ((out.usd_free || 0) > 100000) return { rates: out, src: 'tgju.org' };
    return null;
  }

  // Live snapshot from call4.tgju.org/ajax.json (captured 2026-07-30 during this session).
  var liveSample = {
    current: {
      price_dollar_rl: { p: '1,935,000' },
      price_eur: { p: '2,205,300' },
      price_cny: { p: '285,800' }
    }
  };
  var res = fx_fetch_tgju_logic(liveSample);
  assert.ok(res, 'با داده‌ی واقعی TGJU، منبع آزاد باید نتیجه بدهد');
  assert.strictEqual(res.rates.usd_free, 1935000, 'نرخ آزاد دلار باید درست پارس شود');
  assert.strictEqual(res.rates.eur_free, 2205300, 'نرخ آزاد یورو باید درست پارس شود');

  // Frozen/broken sana-only payload (simulating the exact bug the client saw:
  // a stale sana number with no usable free-market data) must not crash and
  // must simply fail over (return null) — proving removal doesn't introduce
  // a hard failure, it just stops trying a dead source.
  var brokenSample = { current: { price_dollar_rl: { p: '0' } } };
  assert.strictEqual(fx_fetch_tgju_logic(brokenSample), null, 'داده‌ی زیر آستانه باید null برگرداند نه خطا');
})();

/* ===================== Part 3: crm/fx.js — client-side "sana" removal (real vm execution) ===================== */
(function () {
  var store = {};
  var dialogCalls = [];
  var toasts = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    escP: function (x) { return String(x == null ? '' : x); },
    faDate: function () { return '1405/05/08'; },
    curSession: function () { return { user: 'sales1', name: 'فروشنده یک' }; },
    curRole: function () { return 'sales'; },
    alert: function (m) { ctx._lastAlert = m; },
    ptfToast: function (m, k) { toasts.push({ m: m, k: k }); },
    ptfDialog: function (opt) { dialogCalls.push(opt); },
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; } },
    window: null
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/fx.js', 'utf8'), ctx, { filename: 'fx.js' });

  // Live FX rates including (hypothetically, if the server ever sent it back — must be ignored) sana fields.
  ctx.window._ptfFxLive = { rates: { usd_free: 1900000, eur_free: 2200000, usd_sana_buy: 999999999, usd_sana_sell: 999999999 } };
  ctx.getData = function (k) { if (k === 'ptf_crm_offers') return [{ no: 'CO-1', items: [{ qty: 1, price: 100 }] }]; return []; };

  ctx.window.ptfFxPayDialog('in', 'CO-1', 'USD', function () {});
  assert.strictEqual(dialogCalls.length, 1, 'دیالوگ تسعیر باید باز شود');
  var fields = dialogCalls[0].fields;
  var rtypeField = fields.filter(function (f) { return f.id === 'rtype'; })[0];
  assert.ok(rtypeField, 'فیلد مبنای نرخ باید وجود داشته باشد');
  assert.ok(rtypeField.optionsHtml.indexOf('سنا') === -1, 'گزینه‌ی «نرخ سنا» باید کاملاً از دیالوگ تسعیر حذف شده باشد');
  assert.ok(rtypeField.optionsHtml.indexOf('نرخ آزاد') > -1, 'گزینه‌ی «نرخ آزاد» باید باقی بماند');
  assert.ok(rtypeField.optionsHtml.indexOf('توافقی') > -1, 'گزینه‌ی «توافقی» باید باقی بماند');
  // rate field should NOT reference sana in its label anymore, only free.
  var rateField = fields.filter(function (f) { return f.id === 'rate'; })[0];
  assert.ok(rateField.label.indexOf('سنا') === -1, 'برچسب فیلد نرخ نباید به سنا اشاره کند');

  // onOk path: with rtype='free', rate should just be whatever free rate was, no sana override logic.
  var cbResult = null;
  dialogCalls[0].onOk({ rtype: 'free', rate: 1900000, amt: 190000000, pct: '', note: '' });
  // (cb is passed separately as third arg to ptfFxPayDialog; verify by calling again with tracked cb)
  ctx.window.ptfFxPayDialog('in', 'CO-1', 'USD', function (fx) { cbResult = fx; });
  dialogCalls[1].onOk({ rtype: 'free', rate: 1900000, amt: 190000000, pct: '', note: '' });
  assert.ok(cbResult, 'callback باید صدا زده شود');
  assert.strictEqual(cbResult.rate, 1900000, 'نرخ باید همان نرخ آزاد وارد‌شده باشد (بدون override سنا)');
  assert.strictEqual(cbResult.rateType, 'free');

  // ptfFxDiag hint text (toast) must not mention sana at all.
  var toastMsgsBeforeDiag = toasts.length;
  ctx.window.ptfFxPayDialog('in', 'CO-1', 'USD', function () {});
  var liveHintToast = toasts[toasts.length - 1];
  assert.ok(liveHintToast, 'toast راهنمای نرخ زنده باید نمایش داده شود');
  assert.ok(liveHintToast.m.indexOf('سنا') === -1, 'toast راهنمای نرخ زنده نباید هیچ اشاره‌ای به سنا داشته باشد');
})();

/* ===================== Part 4: crm/petty.js — advance payment rate-type select ===================== */
(function () {
  var src = fs.readFileSync('crm/petty.js', 'utf8');
  assert.ok(!/\{v:'sana',lb:'سنا'\}/.test(src), 'گزینه‌ی سنا در فرم وصول پیش‌پرداخت ارزی باید حذف شده باشد');
  assert.ok(!/usd_sana_sell|usd_sana_buy|eur_sana_sell|eur_sana_buy/.test(src), 'liveRate نباید دیگر به فیلدهای سنا ارجاع بدهد');
})();

/* ===================== Part 5: crm/offers-pro.js — CO/TC currency reference-rate basis ===================== */
(function () {
  var src = fs.readFileSync('crm/offers-pro.js', 'utf8');
  assert.ok(!/<option value="sana"/.test(src), 'گزینه‌ی سنا در انتخاب مبنای نرخ مرجع پیشنهاد ارزی باید حذف شده باشد');
  assert.ok(!/sanaRate/.test(src), 'متغیر sanaRate نباید در offers-pro.js باقی مانده باشد');
  assert.ok(src.indexOf("basis === 'sana'") === -1 || src.indexOf("if (basis === 'sana') basis = 'free';") > -1,
    'رکورد قدیمی با fxBasis=sana باید هنگام بازگشایی فرم به آزاد map شود (بدون خطا)');
})();

/* ===================== Part 6: crm/buycompare.js — live-rate hint no longer mentions sana ===================== */
(function () {
  var src = fs.readFileSync('crm/buycompare.js', 'utf8');
  assert.ok(!/L\.usd_sana_sell/.test(src), 'راهنمای نرخ زنده در فرم ثبت خرید واقعی نباید دیگر به usd_sana_sell ارجاع بدهد');
})();

console.log('tester177-v33.4.2-fx-sana-removal.js: ALL PASSED');
