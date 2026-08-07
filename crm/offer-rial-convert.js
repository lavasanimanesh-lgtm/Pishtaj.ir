/* =====================================================================
   PTF CRM — offer-rial-convert.js — v34.2.4 — US-FX2RIAL (فاز ۲)
   «تبدیل پیشنهاد ارزی به پیشنهاد ریالی» — دستور کارفرما ۱۴۰۵/۰۵/۱۵

   سناریو: کارفرما (خریدار) تقاضا دارد نسخه ریالیِ یک پیشنهاد مالی «ارزی»
   هم به او داده شود. طبق منطق موجود، پیشنهاد برنده قفل است و تغییر
   نمی‌یابد؛ بنابراین این ماژول یک «نسخه همراه» (Companion) ریالی می‌سازد:

   • پیشنهاد اصلی ارزی هیچ فیلدی‌اش تغییر نمی‌کند (حتی قفل برد هم دست نمی‌خورد)
   • نسخه ریالی شماره مستقل CO می‌گیرد و به همان درخواست (inqNo) منضم می‌شود
     → خودکار در کشوی «پرونده فروش» و فهرست پیشنهادها دیده می‌شود
   • قیمت هر ردیف = قیمت ارزی × نرخ تسعیر ورودی (گرد به ریال صحیح)
   • تاریخ نسخه ریالی به‌صورت پیش‌فرض = تاریخ پیشنهاد اولیه؛ قابل تغییر توسط کاربر
   • نسخه ریالی هرگز وضعیت «برنده/بازنده» نمی‌گیرد (جلوگیری از دوشمار شدن
     آمار برد/باخت و جلوگیری از تشکیل پرونده دوم — هوک offerSetSt)
   • آثار مالی: فاکتور رسمی همچنان از پیشنهاد ارزی برنده صادر می‌شود
     (روال موجود rbac.js — فاکتور همیشه ریالی است)؛ این تبدیل سند جدیدی
     به چرخه مالی وارد نمی‌کند و فقط سند ارائه‌شده به کارفرما را ریالی می‌کند.

   فاز ۲ (این نسخه) — دکمه «شرایط» بازبینی شد:
   • روی دکمه «🔧 شرایط» (پرونده فروش + فهرست پیشنهادها) حالا یک دیالوگِ
     پیش‌نمایش + ویرایش بندهای شرایط باز می‌شود؛ اصلاح کاربر دریافت و با
     «ذخیره» به نسخه ریالی منضم می‌شود (ptfOfferRialTermsOpen).
   • تبدیل ارزی → ریالی برای «تمام» پیشنهادهای ارزی — حتی برنده‌نشده — از
     داخل ماژول پیشنهادها در دسترس است (دکمه 💱 در ردیف پیشنهاد).
   • هم برای برنده و هم برنده‌نشده، «دیدن پیشنهاد ارزی قبلی» فراهم است
     (دکمه 👁 ارزی و دکمه داخل دیالوگ شرایط).
   • «اصلاح نرخ تسعیر» در برنده‌نشده (و هر نسخه ریالی) از داخل همان
     دیالوگ شرایط در دسترس است — اقلام/مجموع نسخه ریالی هم با نرخ جدید
     به‌روز می‌شوند. توابع هسته مستقل از پرونده فروش هستند.
   ===================================================================== */
(function () {
  'use strict';

  var OFFERS_KEY = 'ptf_crm_offers';
  var DEALS_KEY = 'ptf_crm_deals';

  /* ---------- کمکی ---------- */
  function offersAll() { try { return getData(OFFERS_KEY) || []; } catch (e) { return []; } }
  function offerByNo(no) { return offersAll().filter(function (o) { return o && o.no === no; })[0] || null; }
  function curName() { try { return curSession().name || ''; } catch (e) { return ''; } }
  function curUser() { try { return curSession().user || ''; } catch (e) { return ''; } }
  function toast(msg, kind) { try { if (typeof ptfToast === 'function') ptfToast(msg, kind || 'ok'); } catch (e) {} }
  function isFxOffer(o) { return !!(o && (o.kind === 'CO' || o.kind === 'TC') && o.currency && o.currency !== 'IRR'); }
  function fxTotal(o) {
    return ((o && o.items) || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  }
  function money(v, cur) {
    if (typeof ptfMoney === 'function') return ptfMoney(v, cur || 'IRR');
    return cur && cur !== 'IRR' ? (+v || 0).toLocaleString('en-US') + ' ' + cur : (+v || 0).toLocaleString('fa-IR') + ' ریال';
  }
  function curFa(cur) { return cur === 'EUR' ? 'یورو' : cur === 'USD' ? 'دلار' : 'ریال'; }

  window.ptfOfferIsFx = isFxOffer;

  /* ---------- نسخه همراه ریالی یک پیشنهاد (اگر قبلاً ساخته شده) ---------- */
  window.ptfRialCompanionOf = function (no) {
    if (!no) return null;
    return offersAll().filter(function (o) { return o && o.rialOf === no; })[0] || null;
  };

  /* ---------- اعتبارسنجی امکان تبدیل — خروجی {ok, why, offer} ----------
     هسته مستقل از پرونده فروش → فاز ۲ برای همه پیشنهادهای ارزی قابل استفاده است */
  window.ptfOfferRialConvertCheck = function (noOrOffer) {
    var o = (typeof noOrOffer === 'object') ? noOrOffer : offerByNo(noOrOffer);
    if (!o) return { ok: false, why: 'notfound' };
    if (!isFxOffer(o)) return { ok: false, why: 'notfx' };
    if (!(((o.items || []).length))) return { ok: false, why: 'noitems' };
    if (!(fxTotal(o) > 0)) return { ok: false, why: 'nototal' };
    if (window.ptfRialCompanionOf(o.no)) return { ok: false, why: 'exists' };
    return { ok: true, offer: o };
  };

  /* ---------- اصلاح خودکار شرایط و ضوابط: متن ارزی → ریالی ----------
     اعداد مجاور نماد/کلمه ارز مبدأ × نرخ تسعیر می‌شوند؛ کلمات ارز هم به ریال
     بدل می‌شوند. سایر عبارتها (درصد، روز تحویل و...) دست‌نخورده می‌مانند. */
  function faDigitsToEn(s) {
    return String(s)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  function parseAmt(s) {
    return +(faDigitsToEn(s).replace(/[٬،,\s]/g, '').replace(/٫/g, '.')) || 0;
  }
  function fmtIrr(v) { return Math.round(v).toLocaleString('en-US'); }
  function isFaTok(t) { return /[ء-ی]/.test(t); } /* توکن فارسی (یورو/دلار) → خروجی «ریال» */

  /* الگوی عدد: لاتین با جداکننده/اعشار + فارسی با ٬ و ٫ */
  var NUM_RE = '(?:\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|[۰-۹]{1,3}(?:[٬،][۰-۹]{3})*(?:[٫.][۰-۹]+)?|[۰-۹]+(?:[٫.][۰-۹]+)?)';

  var CUR_TOKENS = {
    EUR: { re: '(?:Euros|Euro|EURO|EUR|€|یورو)', faTok: 'یورو', code: 'IRR', word: 'Iranian Rial', wordPl: 'Iranian Rials' },
    USD: { re: '(?:US Dollars|US Dollar|USD|\\$|دلار آمریکا|دلار)', faTok: 'دلار', code: 'IRR', word: 'Iranian Rial', wordPl: 'Iranian Rials' }
  };

  window.ptfRialConvertTermText = function (txt, cur, rate) {
    if (!txt || !rate) return String(txt || '');
    var tok = CUR_TOKENS[cur];
    if (!tok) return String(txt);
    var s = String(txt);
    /* ۱) عدد + نماد/کلمه ارز → معادل ریالی (مثلا «12,500 EUR» یا «۱۲٬۵۰۰ یورو») */
    s = s.replace(new RegExp('(' + NUM_RE + ')[ \\t]*(' + tok.re + ')(?![A-Za-z])', 'g'), function (m, n, t) {
      return fmtIrr(parseAmt(n) * rate) + ' ' + (isFaTok(t) ? 'ریال' : tok.code);
    });
    /* ۲) نماد/کلمه ارز + عدد (مثلا «EUR 12,500») */
    s = s.replace(new RegExp('(' + tok.re + ')[ \\t]*(' + NUM_RE + ')', 'g'), function (m, t, n) {
      return (isFaTok(t) ? 'ریال ' : tok.code + ' ') + fmtIrr(parseAmt(n) * rate);
    });
    /* ۳) باقیمانده الفاظ ارز بدون عدد */
    if (cur === 'EUR') {
      s = s.replace(/\bEuros\b/g, tok.wordPl).replace(/\bEuro\b/g, tok.word).replace(/\bEUR\b/g, tok.code).replace(/€/g, tok.code).replace(/یورو/g, 'ریال');
    } else {
      s = s.replace(/\bUS Dollars\b/g, tok.wordPl).replace(/\bUS Dollar\b/g, tok.word).replace(/\bUSD\b/g, tok.code).replace(/\$/g, tok.code).replace(/دلار آمریکا/g, 'ریال').replace(/دلار/g, 'ریال');
    }
    return s;
  };

  function convertTermsArr(terms, cur, rate) {
    var changed = 0;
    var out = (terms || []).map(function (t) {
      var c = window.ptfRialConvertTermText(t, cur, rate);
      if (c !== String(t || '')) changed++;
      return c;
    });
    return { terms: out, changed: changed };
  }

  /* جمع‌بندی بندهای شرایط نسخه ریالی: تبدیل خودکار عبارت‌های ارزی + بند شرایط پرداخت (اگر باشد) */
  function buildConvertedTerms(o, rate) {
    var conv = convertTermsArr((o && o.terms) || [], (o && o.currency), rate);
    var advTerm = buildAdvanceTerm(o);
    if (advTerm) { conv.terms.unshift(advTerm); conv.changed++; }
    return conv;
  }

  /* ---------- بلوک «مبنای ارزی» برای نسخه ریالی (US-FX2RIAL) ----------
     پیش‌پرداخت/فاکتور واقعی روی پیشنهاد ارزی مبدأ می‌ماند؛ این بلوک صرفاً
     «مبنای ارزی» (نرخ مبدأ، مبلغ ارزی، درصد و مبلغ وصول‌شدهٔ پیش‌پرداخت) را
     روی نسخه ریالی نگه می‌دارد تا در صورت تغییر نرخ، مبلغ واقعی وصول‌شده
     (که با نرخ قدیم دریافت شده) گم نشود. */
  function fxBasisOf(o) {
    var adv = (o && o.advance) || null;
    var a = null;
    try { a = (typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null; } catch (e) { a = null; }
    return {
      originalRate: (+(o && o.fxRateRef) > 0) ? +o.fxRateRef : ((adv && +adv.rate) || 0),
      originalFxTotal: fxTotal(o),
      currency: (o && o.currency) || 'IRR',
      advancePct: (a && a.pct != null) ? Math.round(+a.pct) : ((adv && +adv.pct) || 0),
      advanceDocAmt: (a && +a.docAmt) || ((adv && +adv.docAmt) || 0),
      advanceReceivedIrr: (a && +a.receivedAmt) || 0,
      advanceReceivedDoc: (a && +a.receivedDocAmt) || 0
    };
  }

  /* بند شرایط پرداخت نسخه ریالی: از دادهٔ پیش‌پرداختِ پیشنهاد ارزی مبدأ ساخته می‌شود
     (بدون کپی خود advance — کپی آن در مطالبات مطالبه تکراری می‌سازد). مبلغ ریالی با
     «نرخِ ثبت‌شدهٔ پیش‌پرداخت» و مبلغِ واقعیِ وصول‌شده، و «مبنای ارزی» را صریح نشان می‌دهد
     تا تغییر نرخِ تبدیل، درصد/مبلغ واقعی پرداخت‌شده را تحریف نکند. */
  function buildAdvanceTerm(o) {
    try {
      var adv = (o && o.advance) || null;
      if (!adv || adv.mode === 'none' || adv.mode === 'no') return null;
      var a = null;
      try { a = (typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null; } catch (e) { a = null; }
      var cur = (o && o.currency) || 'IRR';
      var totalFx = fxTotal(o);
      var pct = (a && a.pct != null) ? Math.round(+a.pct) : Math.max(0, Math.min(100, +adv.pct || 0));
      var advRate = (+adv.rate > 0) ? +adv.rate : ((a && +a.rate) || 0); /* نرخِ ثبت پیش‌پرداخت، نه نرخ تبدیل */
      var docAmt = (a && +a.docAmt) || (+adv.docAmt) || 0;
      var irrAmt = (a && +a.amt) || (docAmt && advRate ? Math.round(docAmt * advRate) : (totalFx * pct / 100 * (advRate || 1)));
      var receivedIrr = (a && +a.receivedAmt) || 0;
      var receivedDoc = (a && +a.receivedDocAmt) || 0;
      var full = adv.mode === 'full' || adv.cashFull || pct >= 100 || (a && a.cashFull);
      var s = 'Payment Terms: ';
      if (full) s += '100% full payment — total ' + fmtIrr(irrAmt || (totalFx * advRate)) + ' IRR';
      else s += (pct > 0 ? pct + '% ' : '') + 'advance payment' + (irrAmt ? ' (= ' + fmtIrr(irrAmt) + ' IRR)' : '') + ', balance before delivery';
      /* مبنای ارزی (نرخِ مبدأ) — فقط اگر ارزی و دادهٔ ارزی موجود باشد */
      if (cur !== 'IRR') {
        s += ' — FX basis: ' + fmtIrr(docAmt || (totalFx * pct / 100)) + ' ' + cur + (advRate ? ' @ ' + fmtIrr(advRate) + ' IRR' : '');
      }
      /* مبلغ واقعیِ وصول‌شده — با نرخ قدیم دریافت شده؛ باید صریح بماند */
      if (receivedIrr > 0) {
        s += ' — ' + fmtIrr(receivedIrr) + ' IRR already received' + (receivedDoc ? ' (' + fmtIrr(receivedDoc) + ' ' + cur + ')' : '');
      }
      return s + '.';
    } catch (e) { return null; }
  }

  /* بازساخت شرایط و ضوابط نسخه ریالی از پیشنهاد مبدأ (برای تعمیر نسخه‌های قدیمی/ویرایش‌شده) */
  window.ptfOfferRialTermsRepair = function (compNo, confirmFirst) {
    var offers = offersAll();
    var comp = offers.filter(function (o) { return o && o.no === compNo; })[0];
    if (!comp || !comp.rialOf) { alert('⛔ نسخه ریالی یافت نشد.'); return; }
    var src = offers.filter(function (o) { return o && o.no === comp.rialOf; })[0];
    var rate = (comp.fxConvert && +comp.fxConvert.rate) || 0;
    if (!src || !(rate > 0)) { alert('⛔ پیشنهاد مبدأ یا نرخ تسعیر ثبت‌شده یافت نشد.'); return; }
    if (confirmFirst && !confirm('⚠️ شرایط و ضوابط فعلی نسخه ریالی با نسخه تبدیل‌شده از پیشنهاد اصلی ' + src.no + ' جایگزین می‌شود.\nادامه می‌دهید؟')) return;
    var conv = convertTermsArr(src.terms || [], src.currency, rate);
    var advTerm = buildAdvanceTerm(src);
    if (advTerm) conv.terms.unshift(advTerm);
    comp.terms = conv.terms;
    comp.fxConvert.termsRewritten = conv.terms.length;
    comp.updatedAtISO = new Date().toISOString();
    setData(OFFERS_KEY, offers);
    try { audit('پیشنهادها', 'بازسازی شرایط و ضوابط ریالی ' + comp.no + ' از ' + src.no + ' (نرخ ' + rate + ')', comp.no); } catch (e) {}
    toast('🔧 شرایط و ضوابط نسخه ریالی به‌صورت ریالی بازسازی شد (' + conv.terms.length + ' بند)', 'ok');
    try { if (typeof renderDeals === 'function') renderDeals(); } catch (e2) {}
  };

  /* ---------- دیالوگ پیش‌نمایش/ویرایش شرایط نسخه ریالی (فاز ۲) ----------
     روی دکمه «شرایط» در پرونده فروش (و فهرست پیشنهادها) صدا زده می‌شود:
     ۱) پیش‌نمایش بندهای تبدیل‌شده به کاربر نمایش داده می‌شود
     ۲) اصلاح کاربر دریافت می‌شود (هر بند قابل ویرایش / افزودن)
     ۳) با «ذخیره»، شرایط (و در صورت تغییر نرخ، اقلام/مجموع) به نسخه ریالی منضم می‌شود
     همچنین امکان دیدن «پیشنهاد ارزی قبلی» و «اصلاح نرخ تسعیر» نیز دارد. */
  var _termDlg = null;

  window.ptfOfferRialTermsOpen = function (compNo) {
    var comp = offerByNo(compNo);
    if (!comp || !comp.rialOf) { alert('⛔ نسخه ریالی یافت نشد.'); return; }
    var src = offerByNo(comp.rialOf);
    if (!src) { alert('⛔ پیشنهاد ارزی مبدأ یافت نشد.'); return; }
    var rate = (comp.fxConvert && +comp.fxConvert.rate) || 0;
    if (!(rate > 0)) rate = +src.fxRateRef || 0;
    _termDlg = {
      comp: comp, src: src, rate: rate,
      /* پیش‌فرض: شرایط فعلی نسخه ریالی؛ اگر خالی بود → تبدیل خودکار از مبدأ */
      terms: ((comp.terms && comp.terms.length) ? comp.terms.slice() : buildConvertedTerms(src, rate).terms)
    };
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var liveRate = src.currency === 'USD' ? (+L.usd_free || 0) : src.currency === 'EUR' ? (+L.eur_free || 0) : 0;
    var totalFx = fxTotal(src);
    var _b = fxBasisOf(src);
    var fxNote = (_b.advanceReceivedIrr > 0 || _b.advancePct > 0)
      ? '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:5px 9px;font-size:11px;color:#166534;margin-top:4px">💰 مبنای ارزی محفوظ: نرخ مبدأ <b>' + (+_b.originalRate).toLocaleString('fa-IR') + '</b> ریال — ' + (_b.advancePct ? 'پیش‌پرداخت ' + _b.advancePct + '٪' : '') + (_b.advanceReceivedIrr > 0 ? ' — وصول‌شدهٔ واقعی: <b>' + (+_b.advanceReceivedIrr).toLocaleString('fa-IR') + ' ریال</b>' + (_b.advanceReceivedDoc ? ' (' + (+_b.advanceReceivedDoc).toLocaleString('en-US') + ' ' + escP(src.currency) + ')' : '') : '') + ' (تغییر نرخِ تبدیل، مبلغ واقعی وصول‌شده را عوض نمی‌کند)</div>'
      : '';
    var html = '<div class="md-b" id="sfRcTermsDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:800px">' +
      '<h3>🔧 شرایط و ضوابط نسخه ریالی — <span dir="ltr">' + escP(comp.no) + '</span></h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">' +
        'این نسخه ریالی از پیشنهاد ارزی <b dir="ltr">' + escP(src.no) + '</b> (' + curFa(src.currency) + ') با نرخ <b>' + rate.toLocaleString('fa-IR') + ' ریال</b> ساخته شده است. ' +
        'عبارت‌ها/مبالغ ارزی خودکار به ریال تبدیل شدند — در صورت نیاز بندها را ویرایش کنید و با «ذخیره» به نسخه ریالی منضم کنید. پیشنهاد ارزی اصلی هیچ تغییری نمی‌کند.' +
      '</div>' +
      '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر ' + escP(src.currency) + ') — تغییر با «بازسازی خودکار» و ذخیره، اقلام/مجموع نسخه ریالی را هم به‌روز می‌کند</label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="sfRcTermsRate" value="' + rate.toLocaleString('en-US') + '" style="direction:ltr;flex:1;min-width:160px" oninput="sfRcTermsRateChanged()">' +
          '<button class="bt bt-o" style="font-size:12px" onclick="sfRcTermsRebuild()" title="بازسازی خودکار بندها از پیشنهاد ارزی با نرخ فعلی">↻ بازسازی خودکار</button>' +
          '<button class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="sfRcTermsViewSrc()" title="دیدن پیشنهاد ارزی قبلی">👁 دیدن پیشنهاد ارزی قبلی</button>' +
        '</div>' +
        '<small style="color:#64748b">نرخ آزاد لحظه‌ای: ' + (liveRate ? liveRate.toLocaleString('fa-IR') + ' ریال' : 'در دسترس نیست') + '</small></div>' +
      '<div style="font-size:12px;background:#f8fafc;border:1px solid var(--brd,#e2e8f0);border-radius:10px;padding:8px 12px;margin-bottom:8px">' +
        'مبلغ پیشنهاد ارزی: <b dir="ltr">' + money(totalFx, src.currency) + '</b> — معادل ریالی (با نرخ فعلی): <b id="sfRcTermsTotal">' + money(Math.round(totalFx * rate), 'IRR') + '</b>' + fxNote + '</div>' +
      '<div id="sfRcTermsList"></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap">' +
        '<button class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#a5f3fc" onclick="offerQuickPreview(\'' + ptfOnClickArg(comp.no) + '\')" title="پیش‌نمایش سند نسخه ریالی">👁 پیش‌نمایش سند</button>' +
        '<span style="display:flex;gap:8px">' +
          '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
          '<button class="bt" style="background:#0e7490" onclick="sfRcTermsSave(\'' + ptfOnClickArg(comp.no) + '\')">💾 ذخیره و منضم به پیشنهاد</button>' +
        '</span></div>' +
      '</div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    sfRcTermsRenderList();
  };

  window.sfRcTermsRenderList = function () {
    if (!_termDlg) return;
    var el = document.getElementById('sfRcTermsList');
    if (!el) return;
    var terms = _termDlg.terms || [];
    el.innerHTML = '<div style="font-size:12px;color:#334155;font-weight:800;margin-bottom:6px">بندهای شرایط و ضوابط (' + terms.length + ')</div>' +
      terms.map(function (t, i) {
        return '<div style="margin-bottom:6px"><div style="font-size:10.5px;color:#64748b;margin-bottom:2px">بند ' + (i + 1) + '</div>' +
          '<textarea data-ti="' + i + '" oninput="sfRcTermsEdit(this)" style="width:100%;height:52px;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px;direction:ltr;text-align:left;resize:vertical">' + escP(t) + '</textarea></div>';
      }).join('') +
      '<button class="bt bt-o" style="font-size:12px;margin-top:4px" onclick="sfRcTermsAdd()">+ بند دلخواه</button>';
  };
  window.sfRcTermsEdit = function (el) {
    if (!_termDlg) return;
    var i = +(el.getAttribute('data-ti') || 0);
    if (_termDlg.terms[i] !== undefined) _termDlg.terms[i] = el.value;
  };
  window.sfRcTermsAdd = function () {
    if (!_termDlg) return;
    _termDlg.terms.push('');
    sfRcTermsRenderList();
    var ta = document.querySelector('#sfRcTermsList textarea:last-of-type');
    if (ta) { ta.focus(); }
  };
  window.sfRcTermsRateChanged = function () {
    if (!_termDlg) return;
    _termDlg.rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfRcTermsRate') || {}).value || '')) : 0;
    var totalEl = document.getElementById('sfRcTermsTotal');
    if (totalEl) totalEl.textContent = money(Math.round(fxTotal(_termDlg.src) * _termDlg.rate), 'IRR');
  };
  window.sfRcTermsRebuild = function () {
    if (!_termDlg) return;
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfRcTermsRate') || {}).value || '')) : 0;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    _termDlg.rate = rate;
    _termDlg.terms = buildConvertedTerms(_termDlg.src, rate).terms;
    sfRcTermsRenderList();
    toast('↻ بندهای شرایط از پیشنهاد ارزی با نرخ جدید بازسازی شد', 'ok');
  };
  window.sfRcTermsViewSrc = function () {
    if (!_termDlg || !_termDlg.src) return;
    try { if (typeof offerQuickPreview === 'function') offerQuickPreview(_termDlg.src.no); } catch (e) {}
  };
  window.sfRcTermsSave = function (compNo) {
    if (!_termDlg) return;
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfRcTermsRate') || {}).value || '')) : 0;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    var offers = offersAll();
    var comp = offers.filter(function (o) { return o && o.no === compNo; })[0];
    if (!comp) { alert('⛔ نسخه ریالی یافت نشد.'); return; }
    var src = _termDlg.src;
    /* اگر نرخ تغییر کرده باشد، اقلام نسخه ریالی هم با همان نرخ به‌روز می‌شود (گرد ریال صحیح) */
    var items = (src.items || []).map(function (it) {
      var c = JSON.parse(JSON.stringify(it || {}));
      delete c.lineId;
      c.price = Math.round((+it.price || 0) * rate);
      return c;
    });
    var totalIrr = items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
    comp.items = items;
    try { if (typeof offEnsureOfferLineIds === 'function') offEnsureOfferLineIds(comp.items, comp.no); } catch (eL) {} /* lineId بازتولید — تطبیق خرید سالم بماند */
    comp.terms = (_termDlg.terms || []).filter(function (t) { return String(t || '').trim() !== ''; });
    comp.fxConvert = comp.fxConvert || {};
    comp.fxConvert.rate = rate;
    comp.fxConvert.totalIrr = totalIrr;
    comp.fxConvert.termsRewritten = comp.terms.length;
    /* مبنای ارزی دست‌نخورده بماند (نرخ مبدأ/مبلغ ارزی/مبلغ وصول‌شده‌ٔ واقعی — US-FX2RIAL)؛
       فقط در صورت نبود، یک‌بار از مبدأ پر شود. */
    if (!comp.fxConvert.originalRate) { var _fb = fxBasisOf(src); comp.fxConvert.originalRate = _fb.originalRate; comp.fxConvert.originalFxTotal = _fb.originalFxTotal; comp.fxConvert.srcCurrency = _fb.currency; comp.fxConvert.advancePct = _fb.advancePct; comp.fxConvert.advanceDocAmt = _fb.advanceDocAmt; comp.fxConvert.advanceReceivedIrr = _fb.advanceReceivedIrr; comp.fxConvert.advanceReceivedDoc = _fb.advanceReceivedDoc; }
    /* درصد وصول‌شده با مبلغ واقعی (دریافت‌شده با نرخ قدیم) بر کل جدید — تحریف نشود */
    if (comp.fxConvert.advanceReceivedIrr > 0 && totalIrr > 0) {
      comp.fxConvert.advanceReceivedPctOfNew = Math.round(comp.fxConvert.advanceReceivedIrr * 10000 / totalIrr) / 100;
    } else { comp.fxConvert.advanceReceivedPctOfNew = 0; }
    comp.currency = 'IRR';
    comp.updatedAtISO = new Date().toISOString();
    setData(OFFERS_KEY, offers);
    try { audit('پیشنهادها', 'اصلاح شرایط/نرخ نسخه ریالی ' + comp.no + ' از ' + src.no + ' (نرخ ' + rate + ')', comp.no); } catch (eA) {}
    toast('🔧 شرایط و ضوابط نسخه ریالی ' + comp.no + ' ذخیره و منضم شد', 'ok');
    var dlg = document.getElementById('sfRcTermsDlg');
    if (dlg) dlg.remove();
    _termDlg = null;
    try { if (typeof renderDeals === 'function') renderDeals(); } catch (eR) {}
    try { if (typeof renderOffers === 'function') renderOffers(); } catch (eR2) {}
  };

  var WHY_FA = {
    notfound: '⛔ پیشنهاد یافت نشد.',
    notfx: '⛔ فقط «پیشنهاد ارزی» (EUR/USD) قابل تبدیل به ریالی است — این پیشنهاد ریالی یا غیرمالی است.',
    noitems: '⛔ این پیشنهاد ردیف کالایی ندارد.',
    nototal: '⛔ مبلغ این پیشنهاد صفر است — قابل تبدیل نیست.',
    exists: 'ℹ️ نسخه ریالی این پیشنهاد قبلاً ساخته شده است (هر پیشنهاد ارزی یک نسخه ریالی می‌گیرد).',
    rate: '⛔ نرخ تسعیر (ریال به‌ازای هر واحد ارز) باید عددی بزرگ‌تر از صفر باشد.',
    serial: '⛔ شماره رسمی پیشنهاد از سرور دریافت نشد — اتصال را بررسی و دوباره تلاش کنید.',
    role: '⛔ ساخت نسخه ریالی فقط برای نقش‌های ارشد (مدیریت/بازرگانی) مجاز است.'
  };
  window.ptfOfferRialWhyFa = function (why) { return WHY_FA[why] || ('⛔ خطا: ' + (why || 'نامشخص')); };

  function seniorOk() {
    try { if (typeof isSenior === 'function') return isSenior(); } catch (e) {}
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e2) { return true; }
  }

  /* ---------- ساخت نسخه همراه (هسته برنامه‌ای قابل تست) ----------
     no: شماره پیشنهاد ارزی مبدأ
     rate: نرخ تسعیر (ریال به‌ازای هر واحد ارز)
     dateISO: تاریخ نسخه ریالی (YYYY-MM-DD) — پیش‌فرض با تاریخ پیشنهاد اولیه
     cb: تابع بازخورد {ok, why?, no?} */
  window.ptfOfferRialConvertCommit = function (no, rate, dateISO, cb) {
    function done(res) { if (typeof cb === 'function') cb(res); return res; }
    var chk = window.ptfOfferRialConvertCheck(no);
    if (!chk.ok) return done({ ok: false, why: chk.why });
    if (!seniorOk()) return done({ ok: false, why: 'role' });
    var o = chk.offer;
    rate = +rate || 0;
    if (!(rate > 0)) { alert(WHY_FA.rate); return done({ ok: false, why: 'rate' }); }
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) dateISO = o.dateEn || new Date().toISOString().slice(0, 10);

    /* شماره رسمی CO — فقط از سرور (هم‌سیاست offerSave: TMP هرگز سند رسمی نمی‌شود) */
    function finish(newNo) {
      if (!newNo || /^TMP-/.test(String(newNo))) { alert(WHY_FA.serial); return done({ ok: false, why: 'serial' }); }
      if (offersAll().some(function (x) { return x.no === newNo; })) { alert(WHY_FA.serial); return done({ ok: false, why: 'serial' }); }
      var items = (o.items || []).map(function (it) {
        var c = JSON.parse(JSON.stringify(it || {}));
        delete c.lineId; /* شناسه خط با شماره جدید بازتولید می‌شود — خطای تطبیق خرید پیش نیاید */
        c.price = Math.round((+it.price || 0) * rate);
        return c;
      });
      var totalFx = fxTotal(o);
      var totalIrr = items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
      /* شرایط و ضوابط: تبدیل خودکار عبارات/مبالغ ارزی به ریالی + بند شرایط پرداخت */
      var termsConv = convertTermsArr(o.terms || [], o.currency, rate);
      var advTerm = buildAdvanceTerm(o);
      if (advTerm) { termsConv.terms.unshift(advTerm); termsConv.changed++; }
      var _fxBasis = fxBasisOf(o); /* مبنای ارزی/پیش‌پرداخت واقعی سند مبدأ — برای محفوظ ماندن پس از ریالی‌شدن */
      var comp = {
        no: newNo, kind: 'CO', rev: 0, editMode: 'new',
        /* وضعیت: ارسال‌شده — نسخه ریالی هرگز برنده/بازنده نمی‌شود (هوک offerSetSt) */
        st: 'sent',
        rialOf: o.no,
        fxConvert: { from: o.no, cur: o.currency, rate: rate, totalFx: totalFx, totalIrr: totalIrr, dateISO: dateISO, termsRewritten: termsConv.changed || 0, at: (typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString()), by: curName(),
          /* مبنای ارزی (نرخ مبدأ، مبلغ ارزی، درصد و مبلغ وصول‌شدهٔ پیش‌پرداخت) — US-FX2RIAL */
          originalRate: _fxBasis.originalRate, originalFxTotal: _fxBasis.originalFxTotal, srcCurrency: _fxBasis.currency,
          advancePct: _fxBasis.advancePct, advanceDocAmt: _fxBasis.advanceDocAmt,
          advanceReceivedIrr: _fxBasis.advanceReceivedIrr, advanceReceivedDoc: _fxBasis.advanceReceivedDoc },
        currency: 'IRR', fxBasis: '', fxRateRef: 0,
        dateEn: dateISO,
        dateFa: (typeof ptfISOToJ === 'function' ? ptfISOToJ(dateISO) : dateISO),
        t: (typeof faDateTime === 'function' ? faDateTime() : ''),
        buyerCd: o.buyerCd || '', buyerCo: o.buyerCo || '', buyerContact: o.buyerContact || '', buyerTel: o.buyerTel || '',
        inqNo: o.inqNo || '',
        items: items,
        terms: termsConv.terms,
        advanceAsked: true, /* پیش‌پرداخت واقعی متعلق به پیشنهاد اصلی است — پرسش ثبت پیش‌پرداخت هنگام ویرایش نیاید و مطالبه تکراری نسازد */
        extraCols: JSON.parse(JSON.stringify(o.extraCols || [])),
        colOrder: o.colOrder ? JSON.parse(JSON.stringify(o.colOrder)) : [],
        hiddenCols: JSON.parse(JSON.stringify(o.hiddenCols || [])),
        vatNote: o.vatNote !== false,
        printAs: 'CO',
        issuedBy: o.issuedBy || curUser(),
        sellerContact: o.sellerContact || '',
        useSig: !!o.useSig, signAs: o.signAs || '',
        updatedAtISO: new Date().toISOString()
        /* عامدانه کپی نمی‌شود: invRef / wonAt / wonBy / marginAtClose / altOf / srcToNo / coNo / validUntil
           → ارجاع فاکتور، آمار برد، زنجیره گزینه‌ها و یادآور انقضا به پیشنهاد اصلی ارزی متصل می‌مانند */
      };
      try { if (typeof offEnsureOfferLineIds === 'function') offEnsureOfferLineIds(comp.items, comp.no); } catch (eL) {}
      var offers = offersAll();
      offers.unshift(comp);
      setData(OFFERS_KEY, offers);

      /* اثر روی پرونده فروش (اگر دارد — فاز ۱ همیشه دارد، فاز ۲ ممکن است نداشته باشد) */
      try {
        var deals = getData(DEALS_KEY) || [];
        var rec = deals.filter(function (d) { return d && (d.wonOffer === o.no || (o.inqNo && d.inqNo === o.inqNo)); })[0];
        if (rec) {
          rec.timeline = rec.timeline || [];
          rec.timeline.push({ t: (typeof faDateTime === 'function' ? faDateTime() : ''), by: curName(), tx: '💱 نسخه ریالی ' + newNo + ' از پیشنهاد ارزی ' + o.no + ' ساخته شد (نرخ ' + rate.toLocaleString('fa-IR') + ' ریال — US-FX2RIAL)' });
          setData(DEALS_KEY, deals);
          try { audit('پرونده‌های فروش', 'تبدیل پیشنهاد ارزی برنده ' + o.no + ' به نسخه ریالی ' + newNo + ' — نرخ ' + rate + ' ریال/' + o.currency + ' — تاریخ ' + dateISO, rec.cd); } catch (eA1) {}
        }
      } catch (eD) {}
      try { audit('پیشنهادها', 'ساخت نسخه ریالی ' + newNo + ' از پیشنهاد ارزی ' + o.no + ' (نرخ تسعیر ' + rate + ' — تاریخ ' + dateISO + ')', newNo); } catch (eA2) {}
      try { if (typeof addLog === 'function') addLog('💱 پیشنهاد ریالی ' + newNo + ' از ' + o.no + ' ساخته شد (نرخ ' + rate + ')'); } catch (eL2) {}
      try {
        if (typeof notify === 'function') {
          notify({ toRoles: (typeof SENIOR_ROLES !== 'undefined' ? SENIOR_ROLES : ['admin', 'chairman', 'ceo', 'commercial']), title: '💱 نسخه ریالی ' + newNo + ' از پیشنهاد ارزی ' + o.no + ' ساخته شد', body: 'نرخ تسعیر: ' + rate.toLocaleString('fa-IR') + ' ریال — مبلغ: ' + money(totalIrr, 'IRR') + ' — پیشنهاد اصلی تغییر نکرده است', kind: 'info', channels: ['cart'], link: { panel: 'deals' } });
        }
      } catch (eN) {}
      return done({ ok: true, no: newNo, totalIrr: totalIrr, totalFx: totalFx, rate: rate, dateISO: dateISO, termsChanged: termsConv.changed || 0 });
    }

    if (typeof ptfUnifiedCodeAsync === 'function') {
      try {
        ptfUnifiedCodeAsync('CO', 1).then(finish, function () { alert(WHY_FA.serial); done({ ok: false, why: 'serial' }); });
        return { ok: true, pending: true };
      } catch (eP) { /* fallback below */ }
    }
    return finish(typeof offerSerial === 'function' ? offerSerial('CO') : '');
  };

  /* ---------- هوک: نسخه ریالی هرگز برنده/بازنده نمی‌شود ----------
     محافظ آماری: با برنده شدن نسخه ریالی، پرونده فروش دوم ساخته می‌شد و
     wonOffer از سند ارزی اصلی جدا می‌شد؛ با بازنده شدن هم آزار Win/Loss
     دوشمار می‌شد. سایر وضعیت‌ها (ارسال/تایید و...) آزاد است. */
  function hookOfferSetSt() {
    if (window._ptfRialStHooked || typeof window.offerSetSt !== 'function') return false;
    window._ptfRialStHooked = true;
    var _setSt = window.offerSetSt;
    window.offerSetSt = function (no, st, selEl) {
      try {
        var o = offerByNo(no);
        if (o && o.rialOf && (st === 'won' || st === 'lost')) {
          alert('🔒 این سند «نسخه ریالی» پیشنهاد ' + o.rialOf + ' است.\n\n' +
            '• وضعیت «برنده» فقط متعلق به پیشنهاد اصلی ارزی است و پرونده فروش/فاکتور به آن متصل است.\n' +
            '• ثبت برد/باخت روی نسخه ریالی آمار تحلیلگر را دوشمار می‌کند.\n\n' +
            'ادامه فرایند معامله: پرونده فروش ← ' + (o.inqNo || o.rialOf));
          if (selEl) selEl.value = o.st || 'sent';
          return;
        }
      } catch (e) {}
      return _setSt.apply(this, arguments);
    };
    return true;
  }
  var _hTry = 0;
  var _hTimer = setInterval(function () { _hTry++; if (hookOfferSetSt() || _hTry > 50) clearInterval(_hTimer); }, 400);

  /* ---------- دیالوگ تبدیل ---------- */
  window.ptfOfferRialConvertOpenByNo = function (no, dealCd) {
    var chk = window.ptfOfferRialConvertCheck(no);
    if (!chk.ok) { alert(window.ptfOfferRialWhyFa(chk.why)); return; }
    var o = chk.offer;
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var liveRate = o.currency === 'USD' ? (+L.usd_free || 0) : o.currency === 'EUR' ? (+L.eur_free || 0) : 0;
    var defRate = (+o.fxRateRef > 0) ? +o.fxRateRef : liveRate;
    var defDate = o.dateEn || new Date().toISOString().slice(0, 10);
    var totalFx = fxTotal(o);
    var dateInp = (typeof ptfDateInput === 'function')
      ? ptfDateInput('sfRcDateJ', defDate)
      : '<input type="text" id="sfRcDateJ" value="' + escP(defDate) + '" style="direction:ltr;color:#0e7490">';
    var html = '<div class="md-b" id="sfRcDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
      '<h3>💱 تبدیل به پیشنهاد ریالی</h3>' +
      '<input type="hidden" id="sfRcNo" value="' + escP(o.no) + '">' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">' +
        'پیشنهاد اصلی <b dir="ltr">' + escP(o.no) + '</b> (' + curFa(o.currency) + ') <b>هیچ تغییری نمی‌کند</b> — یک پیشنهاد ریالی جدید با شماره مستقل ساخته و به همین پرونده منضم می‌شود تا به کارفرما ارائه شود.' +
      '</div>' +
      '<div style="font-size:12.5px;background:#f8fafc;border:1px solid var(--brd,#e2e8f0);border-radius:10px;padding:8px 12px;margin-bottom:10px">' +
        'مبلغ پیشنهاد ارزی: <b dir="ltr">' + money(totalFx, o.currency) + '</b>' +
        (o.fxBasis || o.fxRateRef ? '<div style="color:#64748b;font-size:11px;margin-top:2px">مرجع ثبت‌شده سند: ' + (o.fxBasis === 'free' ? 'نرخ آزاد' : o.fxBasis === 'agreed' ? 'توافقی' : o.fxBasis === 'sana' ? 'سنا (تاریخی)' : '-') + (o.fxRateRef ? ' — ' + (+o.fxRateRef).toLocaleString('fa-IR') + ' ریال' : '') + '</div>' : '') +
      '</div>' +
      '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر ' + escP(o.currency) + ') *</label>' +
        '<input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="sfRcRate" value="' + (defRate ? defRate.toLocaleString('en-US') : '') + '" style="direction:ltr" oninput="sfRcPreview()">' +
        '<small style="color:#64748b">نرخ آزاد لحظه‌ای: ' + (liveRate ? liveRate.toLocaleString('fa-IR') + ' ریال' : 'در دسترس نیست') + '</small></div>' +
      '<div class="fld"><label>تاریخ پیشنهاد ریالی (شمسی) — پیش‌فرض: تاریخ پیشنهاد اولیه</label>' + dateInp + '</div>' +
      '<div id="sfRcPreview" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#065f46;margin-bottom:10px"></div>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#92400e;margin-bottom:10px">' +
        '<b>آثار مالی این تبدیل:</b> پیشنهاد برنده ارزی و سند قطعی برد دست‌نخورده می‌ماند • فاکتور رسمی همچنان از پیشنهاد ارزی برنده صادر می‌شود (روال جاری — فاکتور همیشه ریالی است) • نسخه ریالی وضعیت برد/باخت نمی‌گیرد و در آمار تحلیلگر دوشمار نمی‌شود • هزینه‌ها/خرید واقعی/پیش‌پرداخت به قوت خود باقی است • <b>شرایط و ضوابط (Terms &amp; Conditions)</b> و شرایط پرداخت به‌صورت خودکار با همین نرخ به ریال تبدیل می‌شوند (بعداً در فرم پیشنهاد هم قابل ویرایش است).' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="bt bt-o" onclick="document.getElementById(\'sfRcDlg\').remove()">انصراف</button>' +
        '<button class="bt" style="background:#0e7490" onclick="sfRcDoConvert(\'' + ptfOnClickArg(o.no) + '\',\'' + ptfOnClickArg(dealCd || '') + '\')">💱 ساخت پیشنهاد ریالی</button>' +
      '</div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window.sfRcPreview();
  };

  window.sfRcPreview = function () {
    var el = document.getElementById('sfRcPreview');
    if (!el || !document.getElementById('sfRcDlg')) return;
    var no = ((document.getElementById('sfRcNo') || {}).value || '');
    var o = offerByNo(no);
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfRcRate') || {}).value || '')) : 0;
    if (!o || !isFxOffer(o)) { el.innerHTML = ''; return; }
    if (!(rate > 0)) { el.innerHTML = 'نرخ تسعیر را وارد کنید تا معادل ریالی محاسبه شود.'; return; }
    /* دقیقاً هم‌فرمول هسته تبدیل: گرد ریال صحیح روی قیمت هر ردیف */
    var totalIrr = (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * Math.round((+it.price || 0) * rate); }, 0);
    el.innerHTML = 'معادل ریالی پیشنهاد: <b>' + money(totalIrr, 'IRR') + '</b>' +
      '<div style="font-size:11px;color:#047857;margin-top:2px">قیمت هر ردیف = قیمت ' + escP(o.currency) + ' × ' + rate.toLocaleString('fa-IR') + ' (گردشده به ریال صحیح)</div>';
  };

  window.sfRcDoConvert = function (no, dealCd) {
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfRcRate') || {}).value || '')) : (+(((document.getElementById('sfRcRate') || {}).value || '').replace(/[^\d.]/g, '')) || 0);
    var jRaw = ((document.getElementById('sfRcDateJ') || {}).value || '').trim();
    var dateISO = (typeof ptfJToISO === 'function') ? ptfJToISO(jRaw) : jRaw;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) { alert('⛔ تاریخ پیشنهاد ریالی را به‌صورت شمسی (مثل 1405/04/19) وارد کنید.'); return; }
    window.ptfOfferRialConvertCommit(no, rate, dateISO, function (res) {
      if (!res || !res.ok) { if (res && res.why && res.why !== 'rate' && res.why !== 'serial') alert(window.ptfOfferRialWhyFa(res.why)); return; }
      var dlg = document.getElementById('sfRcDlg');
      if (dlg) dlg.remove();
      toast('💱 پیشنهاد ریالی ' + res.no + ' ساخته شد', 'ok');
      try { if (typeof renderDeals === 'function') renderDeals(); } catch (eR) {}
      try { if (typeof renderOffers === 'function') renderOffers(); } catch (eR2) {}
      setTimeout(function () {
        var termsMsg = res.termsChanged ? '\n🔧 ' + res.termsChanged + ' بند شرایط و ضوابط/شرایط پرداخت هم خودکار به ریال تبدیل شد.' : '';
        if (confirm('✅ پیشنهاد ریالی ' + res.no + ' ساخته و به پرونده منضم شد.\nمبلغ: ' + money(res.totalIrr, 'IRR') + termsMsg + '\n(شرایط و ضوابط در فرم پیشنهاد قابل ویرایش است)\n\nالآن چاپ/PDF شود؟')) {
          try { if (typeof offerPrint === 'function') offerPrint(res.no); } catch (eP) {}
        }
      }, 150);
    });
  };

  /* ---------- دکمه پرونده فروش (فاز ۱) ----------
     ورودی: رکورد پرونده فروش r — خروجی: HTML دکمه/بج برای نوار عملیات پرونده */
  window.ptfOfferRialToolbarHtml = function (r) {
    try {
      if (!r || !r.wonOffer) return '';
      var wo = offerByNo(r.wonOffer);
      if (!wo) return '';
      var comp = window.ptfRialCompanionOf(wo.no);
      if (comp) {
        return '<span class="bd" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;align-self:center" title="نسخه ریالی پیشنهاد برنده — ساخته‌شده با نرخ ' + ((comp.fxConvert && comp.fxConvert.rate) ? (+comp.fxConvert.rate).toLocaleString('fa-IR') : '') + ' ریال">' +
          '💱 ریالی: <b dir="ltr">' + escP(comp.no) + '</b></span>' +
          '<button class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#a5f3fc" onclick="offerQuickPreview(\'' + ptfOnClickArg(comp.no) + '\')" title="نمایش نسخه ریالی">👁</button>' +
          '<button class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#a5f3fc" onclick="offerPrint(\'' + ptfOnClickArg(comp.no) + '\')" title="چاپ/PDF نسخه ریالی">🖨</button>' +
          '<button class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="offerQuickPreview(\'' + ptfOnClickArg(wo.no) + '\')" title="دیدن پیشنهاد ارزی قبلی (برنده)">👁 ارزی</button>' +
          '<button class="bt bt-o" style="font-size:12px;color:#b45309;border-color:#fcd34d" onclick="ptfOfferRialTermsOpen(\'' + ptfOnClickArg(comp.no) + '\')" title="پیش‌نمایش و ویرایش شرایط و ضوابط ریالی + اصلاح نرخ تسعیر + دیدن پیشنهاد ارزی قبلی">🔧 شرایط</button>';
      }
      if (!isFxOffer(wo)) return '';
      var chk = window.ptfOfferRialConvertCheck(wo.no);
      if (!chk.ok) return '';
      return '<button class="bt" style="font-size:12px;background:#0e7490" title="ساخت نسخه ریالی از پیشنهاد ارزی برنده — پیشنهاد اصلی تغییر نمی‌کند" onclick="ptfOfferRialConvertOpenByNo(\'' + ptfOnClickArg(wo.no) + '\',\'' + ptfOnClickArg(r.cd || '') + '\')">💱 تبدیل به پیشنهاد ریالی</button>';
    } catch (e) { return ''; }
  };

  /* برچسب نسخه ریالی در فهرست پیشنهادها/کشوی پرونده (برای نمایش کنار شماره) */
  window.ptfRialCompanionBadge = function (o) {
    if (!o || !o.rialOf) return '';
    return '<span class="bd" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10px" title="نسخه ریالی پیشنهاد ' + escP(o.rialOf) + ' — نرخ ' + ((o.fxConvert && o.fxConvert.rate) ? (+o.fxConvert.rate).toLocaleString('fa-IR') : '') + ' ریال">💱 ریالی از ' + escP(o.rialOf) + '</span>';
  };
})();

/* =====================================================================
   MOB-025 — تراکم‌زدایی actionهای ردیف پیشنهاد در موبایل
   - فقط چند action اصلی روی کارت می‌مانند؛ بقیه داخل sheet «بیشتر» هستند.
   - نسخه‌های ریالی همراه، دکمه‌های ریز داخل کارت را به action sheet منتقل می‌کنند.
   - هر action metadata (نام، آیکون، رنگ، سطح اهمیت) دارد.
   ===================================================================== */
(function () {
  'use strict';

  var BP = 768;
  var META = {
    edit:        { label: 'ویرایش پیشنهاد',             icon: '✏️', tone: 'amber',  primary: true  },
    salesFile:   { label: 'پرونده فروش',                icon: '📁', tone: 'violet', primary: true  },
    preview:     { label: 'پیش‌نمایش اقلام',            icon: '👁', tone: 'sky',    primary: true  },
    print:       { label: 'چاپ یا PDF',                 icon: '🖨', tone: 'indigo', primary: true  },
    toCo:        { label: 'ساخت پیشنهاد مالی',          icon: '💸', tone: 'teal',   primary: true  },
    rialConvert: { label: 'تبدیل به پیشنهاد ریالی',     icon: '💱', tone: 'teal',   primary: true  },
    rialMenu:    { label: 'عملیات نسخه ریالی',          icon: '💱', tone: 'teal',   primary: true  },
    more:        { label: 'عملیات بیشتر پیشنهاد',       icon: '⋯',  tone: 'slate',  primary: true  },
    unwin:       { label: 'بازگردانی از برنده',         icon: '⏪', tone: 'red',    primary: true  },
    revise:      { label: 'ایجاد نگارش جدید',           icon: '📑', tone: 'blue',   primary: false },
    csv:         { label: 'دانلود اکسل اقلام',          icon: '⬇️', tone: 'slate',  primary: false },
    optimizer:   { label: 'بهینه‌سازی سود',             icon: '📊', tone: 'green',  primary: false },
    integrity:   { label: 'سلامت و کنترل اقلام',        icon: '🔎', tone: 'cyan',   primary: false },
    invoice:     { label: 'صورتحساب پرداخت',            icon: '🧾', tone: 'orange', primary: false },
    del:         { label: 'حذف پیشنهاد',                icon: '🗑️', tone: 'red',    primary: false },
    workflow:    { label: 'پاسخ یا اصلاح پیشنهاد',      icon: '✏️', tone: 'pink',   primary: false },
    rialPreview: { label: 'نمایش نسخه ریالی',           icon: '👁', tone: 'sky',    primary: false },
    rialPrint:   { label: 'چاپ یا PDF نسخه ریالی',      icon: '🖨', tone: 'indigo', primary: false },
    rialTerms:   { label: 'شرایط و نرخ تسعیر ریالی',    icon: '🔧', tone: 'orange', primary: false },
    unknown:     { label: 'عملیات تکمیلی پیشنهاد',      icon: '⚙️', tone: 'slate',  primary: false }
  };

  var TONES = {
    sky:    { color: '#0284c7', background: '#eff6ff', border: '#bfdbfe' },
    blue:   { color: '#2563eb', background: '#eff6ff', border: '#bfdbfe' },
    indigo: { color: '#4f46e5', background: '#eef2ff', border: '#c7d2fe' },
    violet: { color: '#7c3aed', background: '#f5f3ff', border: '#ddd6fe' },
    amber:  { color: '#d97706', background: '#fffbeb', border: '#fde68a' },
    orange: { color: '#ea580c', background: '#fff7ed', border: '#fed7aa' },
    teal:   { color: '#0f766e', background: '#f0fdfa', border: '#99f6e4' },
    cyan:   { color: '#0891b2', background: '#ecfeff', border: '#a5f3fc' },
    green:  { color: '#059669', background: '#ecfdf5', border: '#a7f3d0' },
    pink:   { color: '#db2777', background: '#fdf2f8', border: '#fbcfe8' },
    red:    { color: '#dc2626', background: '#fef2f2', border: '#fecaca' },
    slate:  { color: '#475569', background: '#f8fafc', border: '#cbd5e1' }
  };

  function isMob() { return window.innerWidth <= BP; }

  function applyTone(btn, tone) {
    var c = TONES[tone] || TONES.slate;
    /* بعضی theme helperها رنگ button را با !important بازنویسی می‌کنند؛
       inline-important برای حفظ رنگ معنایی action لازم است. */
    btn.style.setProperty('color', c.color, 'important');
    btn.style.setProperty('background', c.background, 'important');
    btn.style.setProperty('border-color', c.border, 'important');
  }

  function detect(btn) {
    var known = btn.getAttribute('data-offer-action') || '';
    if (META[known]) return known;
    var on = btn.getAttribute('onclick') || '';
    var title = btn.getAttribute('title') || '';
    if (/adminUnwin\s*\(/.test(on)) return 'unwin';
    if (/adminDelOffer\s*\(|offerDel\s*\(/.test(on)) return 'del';
    if (/offerEdit\s*\(/.test(on)) return 'edit';
    if (/ptfGoSalesFileForOffer\s*\(/.test(on)) return 'salesFile';
    if (/offerReviseClone\s*\(/.test(on)) return 'revise';
    if (/offerQuickPreview\s*\(/.test(on)) return (btn.getAttribute('data-offer-group') === 'rial' || /نسخه ریالی|ارزی قبلی/i.test(title)) ? 'rialPreview' : 'preview';
    if (/offerPrint\s*\(/.test(on)) return (btn.getAttribute('data-offer-group') === 'rial' || /نسخه ریالی/i.test(title)) ? 'rialPrint' : 'print';
    if (/offerCsv\s*\(/.test(on)) return 'csv';
    if (/offOpenProfitOptimizer\s*\(/.test(on)) return 'optimizer';
    if (/ptfOfferIntegrityDialog\s*\(/.test(on)) return 'integrity';
    if (/unofficialInvoicePrint\s*\(/.test(on)) return 'invoice';
    if (/offerToCo\s*\(/.test(on)) return 'toCo';
    if (/ptfOfferRialConvertOpenByNo\s*\(/.test(on)) return 'rialConvert';
    if (/ptfOfferRialTermsOpen\s*\(/.test(on)) return 'rialTerms';
    if (/wfToResponse\s*\(|wfCoRevise\s*\(/.test(on)) return 'workflow';
    return 'unknown';
  }

  function labelFor(btn, key) {
    if (key === 'unknown') return btn.getAttribute('aria-label') || btn.getAttribute('title') || String(btn.textContent || '').trim() || META.unknown.label;
    return META[key].label;
  }

  function applyFace(btn, key, label) {
    var meta = META[key] || META.unknown;
    btn.classList.add('offer-row-action');
    btn.setAttribute('data-offer-action', key);
    btn.setAttribute('data-offer-tone', meta.tone);
    btn.setAttribute('data-offer-label', label);
    var primary = !!meta.primary && btn.getAttribute('data-offer-group') !== 'rial';
    btn.setAttribute('data-offer-primary', primary ? '1' : '0');
    btn.setAttribute('data-offer-secondary', primary ? '0' : '1');
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
    applyTone(btn, meta.tone);

    /* در دسکتاپ متن/استایل فعلی حفظ می‌شود؛ نمای compact فقط برای موبایل است. */
    if (!isMob()) return;
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    var icon = document.createElement('span');
    icon.className = 'offer-action-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = meta.icon;
    var text = document.createElement('span');
    text.className = 'offer-action-label';
    text.textContent = label;
    btn.appendChild(icon);
    btn.appendChild(text);
    try { if (typeof window.ptfIconxSweep === 'function') window.ptfIconxSweep(btn); } catch (e) {}
  }

  function rowFor(no) {
    var rows = document.querySelectorAll('#oTb tr');
    for (var i = 0; i < rows.length; i++) {
      var strong = rows[i].querySelector('td strong');
      if (strong && strong.textContent.trim() === no) return rows[i];
    }
    return null;
  }

  function createSheetButton(key, label, click) {
    var meta = META[key] || META.unknown;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'offer-sheet-action offer-tone-' + meta.tone;
    b.setAttribute('aria-label', label);
    var i = document.createElement('span');
    i.className = 'offer-sheet-icon';
    i.setAttribute('aria-hidden', 'true');
    i.textContent = meta.icon;
    var t = document.createElement('span');
    t.className = 'offer-sheet-label';
    t.textContent = label;
    b.appendChild(i); b.appendChild(t);
    b.addEventListener('click', click);
    return b;
  }

  function openSheet(no, group) {
    var row = rowFor(no);
    if (!row) return;
    var last = row.querySelectorAll('td');
    last = last[last.length - 1];
    if (!last) return;
    var list = Array.prototype.slice.call(last.querySelectorAll('button.offer-row-action')).filter(function (b) {
      if (b.getAttribute('data-offer-action') === 'more' || b.getAttribute('data-offer-action') === 'rialMenu') return false;
      if (group === 'rial') return b.getAttribute('data-offer-group') === 'rial';
      return b.getAttribute('data-offer-secondary') === '1' && b.getAttribute('data-offer-group') !== 'rial';
    });
    if (!list.length) {
      try { if (typeof ptfToast === 'function') ptfToast('عملیات بیشتری برای این پیشنهاد نیست', 'info'); } catch (e) {}
      return;
    }

    var old = document.getElementById('ptfOfferActionSheet');
    if (old) old.remove();
    var previousFocus = document.activeElement;
    var overlay = document.createElement('div');
    overlay.id = 'ptfOfferActionSheet';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var panel = document.createElement('div');
    panel.className = 'offer-action-sheet';
    var head = document.createElement('div');
    head.className = 'offer-sheet-head';
    var title = document.createElement('b');
    title.textContent = group === 'rial' ? '💱 عملیات نسخه ریالی' : '⋯ عملیات بیشتر پیشنهاد';
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'offer-sheet-close'; close.setAttribute('aria-label', 'بستن'); close.textContent = '✕';
    head.appendChild(title); head.appendChild(close);
    var sub = document.createElement('small');
    sub.className = 'offer-sheet-sub'; sub.textContent = no;
    var listEl = document.createElement('div');
    listEl.className = 'offer-sheet-list';
    function dismiss() {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      try { if (previousFocus && previousFocus.focus) previousFocus.focus(); } catch (e) {}
    }
    function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); dismiss(); } }
    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKey, true);
    list.forEach(function (source) {
      var key = source.getAttribute('data-offer-action') || 'unknown';
      var label = source.getAttribute('data-offer-label') || labelFor(source, key);
      listEl.appendChild(createSheetButton(key, label, function () { dismiss(); source.click(); }));
    });
    panel.appendChild(head); panel.appendChild(sub); panel.appendChild(listEl); overlay.appendChild(panel);
    document.body.appendChild(overlay);
    try { if (typeof window.ptfIconxSweep === 'function') window.ptfIconxSweep(overlay); } catch (e2) {}
    setTimeout(function () { var first = listEl.querySelector('button'); if (first) first.focus(); }, 20);
  }
  window.ptfOfferOpenActionSheet = openSheet;

  function addMenuButton(last, no, action, group) {
    if (last.querySelector('[data-offer-action="' + action + '"]')) return;
    var key = action === 'rialMenu' ? 'rialMenu' : 'more';
    var label = key === 'rialMenu' ? META.rialMenu.label : 'عملیات بیشتر پیشنهاد';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'offer-row-action ' + (key === 'rialMenu' ? 'offer-row-rial-menu' : 'offer-row-more');
    btn.style.display = 'none'; /* desktop: دکمه‌های اصلی بدون تغییر می‌مانند */
    btn.setAttribute('data-offer-action', key);
    btn.setAttribute('data-offer-tone', META[key].tone);
    btn.setAttribute('data-offer-label', label);
    btn.setAttribute('data-offer-primary', '1');
    btn.setAttribute('data-offer-secondary', '0');
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
    applyTone(btn, META[key].tone);
    var icon = document.createElement('span');
    icon.className = 'offer-action-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.textContent = META[key].icon;
    var text = document.createElement('span');
    text.className = 'offer-action-label'; text.textContent = label;
    btn.appendChild(icon); btn.appendChild(text);
    btn.addEventListener('click', function () { openSheet(no, group || ''); });
    last.appendChild(btn);
    try { if (typeof window.ptfIconxSweep === 'function') window.ptfIconxSweep(btn); } catch (e) {}
  }

  function moveRialButtons(row, last, no) {
    var inline = row.querySelector('td:first-child [title*="نسخه ریالی"]');
    if (!inline) return;
    var buttons = Array.prototype.slice.call(inline.querySelectorAll('button'));
    if (!buttons.length) return;
    var parents = [];
    buttons.forEach(function (btn) {
      if (btn.parentNode && parents.indexOf(btn.parentNode) < 0) parents.push(btn.parentNode);
      btn.setAttribute('data-offer-group', 'rial');
      last.appendChild(btn); /* handlerهای قبلی بدون تغییر منتقل می‌شوند */
    });
    parents.forEach(function (p) { if (!p.querySelector('button') && !String(p.textContent || '').trim()) p.remove(); });
    addMenuButton(last, no, 'rialMenu', 'rial');
  }

  function polish() {
    if (!isMob()) return;
    var tb = document.getElementById('oTb');
    if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (row) {
      var strong = row.querySelector('td strong');
      if (!strong) return;
      var no = strong.textContent.trim();
      var cells = row.querySelectorAll('td');
      var last = cells[cells.length - 1];
      if (!last) return;
      moveRialButtons(row, last, no);
      Array.prototype.forEach.call(last.querySelectorAll('button:not(.offer-row-more):not(.offer-row-rial-menu)'), function (btn) {
        var key = detect(btn);
        applyFace(btn, key, labelFor(btn, key));
      });
      var secondary = last.querySelectorAll('button.offer-row-action[data-offer-secondary="1"]:not([data-offer-group="rial"])');
      if (secondary.length) addMenuButton(last, no, 'more', '');
    });
  }

  function polishSoon() {
    /* backup.js و workflow.js هر کدام renderOffers را hook می‌کنند. اجرای async
       تضمین می‌کند actionهایی که wrapperهای بیرونی پس از render اضافه می‌کنند هم دیده شوند. */
    setTimeout(function () { try { polish(); } catch (e) {} }, 0);
  }

  function hookLatest() {
    var current = window.renderOffers;
    if (typeof current !== 'function') return false;
    if (current._ptfOfferMobileActionsOuter) return true;
    var original = current;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      polishSoon();
      return result;
    };
    wrapped._ptfOfferMobileActionsOuter = true;
    window.renderOffers = wrapped;
    return true;
  }

  window.ptfOfferMobilePolish = polish;
  /* تا پایان hookهای تاخیردار سایر ماژول‌ها، outer wrapper را دوباره بررسی کن. */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    hookLatest();
    if (tries > 40) { clearInterval(timer); polishSoon(); }
  }, 200);
  var lastMob = isMob();
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var now = isMob();
      if (now !== lastMob && typeof window.renderOffers === 'function') window.renderOffers();
      else if (now) polish();
      lastMob = now;
    }, 120);
  });
})();
