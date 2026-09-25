/* =====================================================================
   PTF CRM — offer-fx-convert.js — v34.39.28 — US-IRR2FX
   «تبدیل پیشنهاد ریالی به پیشنهاد ارزی» — دستور کارفرما ۱۴۰۵/۰۲

   سناریو: کارفرما تقاضا دارد نسخه ارزیِ یک پیشنهاد مالی «ریالی»
   هم به او داده شود. طبق منطق موجود FX→IRR، پیشنهاد اصلی قفل نیست
   و تغییر نمی‌یابد؛ این ماژول یک «نسخه همراه» (Companion) ارزی می‌سازد:

   • پیشنهاد اصلی ریالی هیچ فیلدی‌اش تغییر نمی‌کند
   • نسخه ارزی شماره مستقل CO می‌گیرد و به همان درخواست (inqNo) منضم می‌شود
     → خودکار در کشوی «پرونده فروش» و فهرست پیشنهادها دیده می‌شود
   • قیمت هر ردیف = قیمت ریالی ÷ نرخ تسعیر ورودی (گرد ۲ اعشار)
   • تاریخ نسخه ارزی پیش‌فرض = تاریخ پیشنهاد اولیه؛ قابل تغییر
   • نسخه ارزی هرگز وضعیت «برنده/بازنده» نمی‌گیرد (جلوگیری از دوشمار شدن)
   • آثار مالی: فاکتور رسمی همچنان از پیشنهاد برنده (ریالی یا ارزی) صادر
     می‌شود؛ این تبدیل سند جدیدی به چرخه مالی وارد نمی‌کند و فقط سند
     ارائه‌شده به کارفرما را ارزی می‌کند.
   • شرایط و ضوابط: مبالغ ریالی خودکار به ارز مقصد تبدیل می‌شوند.

   هم‌ارز ماژول offer-rial-convert.js ولی در جهت معکوس.
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
  function isIrrOffer(o) { return !!(o && (o.kind === 'CO' || o.kind === 'TC') && (!o.currency || o.currency === 'IRR')); }
  function isAnyFx(o) { return !!(o && o.currency && o.currency !== 'IRR'); }
  function irrTotal(o) {
    return ((o && o.items) || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
  }
  function money(v, cur) {
    if (typeof ptfMoney === 'function') return ptfMoney(v, cur || 'IRR');
    return cur && cur !== 'IRR' ? (+v || 0).toLocaleString('en-US') + ' ' + cur : (+v || 0).toLocaleString('fa-IR') + ' ریال';
  }
  function curFa(cur) {
    if (cur === 'EUR') return 'یورو';
    if (cur === 'USD') return 'دلار';
    if (cur === 'CNY') return 'یوان';
    if (cur === 'AED') return 'درهم';
    if (cur === 'GBP') return 'پوند';
    return cur;
  }
  function curEn(cur) {
    if (cur === 'EUR') return 'Euro';
    if (cur === 'USD') return 'US Dollar';
    if (cur === 'CNY') return 'CNY';
    if (cur === 'AED') return 'AED';
    if (cur === 'GBP') return 'GBP';
    return cur;
  }

  /* تبدیل قلم ریالی به ارزی: قیمت و هزینه‌های مرجع تقسیم بر نرخ */
  function convertItemToFx(it, rate, targetCurrency) {
    var c = JSON.parse(JSON.stringify(it || {}));
    var costs = {};
    ['refPrice', 'refBuyPrice', 'bestBuyPrice'].forEach(function (key) {
      var amount = +c[key] || 0;
      if (amount > 0) {
        costs[key] = amount;
        // قیمت مرجع ریالی → ارزی
        var fx = amount / rate;
        // ۲ اعشار برای ارز
        c[key] = Math.round(fx * 100) / 100;
      }
    });
    var priceIrr = +c.price || 0;
    c.price = Math.round((priceIrr / rate) * 100) / 100;
    c.fxConvertedCosts = { fromCurrency: 'IRR', toCurrency: targetCurrency || '', rate: rate, source: costs, sourcePrice: priceIrr };
    return c;
  }

  window.ptfOfferIsIrr = isIrrOffer;

  /* ---------- نسخه همراه ارزی یک پیشنهاد ریالی (اگر قبلاً ساخته شده) ---------- */
  window.ptfFxCompanionOf = function (no, targetCur) {
    if (!no) return null;
    var list = offersAll().filter(function (o) { return o && o.fxOf === no; });
    if (targetCur) {
      return list.filter(function (o) { return (o.currency || '') === targetCur; })[0] || null;
    }
    return list[0] || null;
  };
  window.ptfFxCompanionsOf = function (no) {
    if (!no) return [];
    return offersAll().filter(function (o) { return o && o.fxOf === no; });
  };
  // برای سازگاری با کد قدیمی که فقط یک companion ارزی می‌خواهد
  window.ptfIrrFxCompanionOf = window.ptfFxCompanionOf;

  /* ---------- اعتبارسنجی امکان تبدیل ---------- */
  window.ptfOfferFxConvertCheck = function (noOrOffer, targetCur) {
    var o = (typeof noOrOffer === 'object') ? noOrOffer : offerByNo(noOrOffer);
    if (!o) return { ok: false, why: 'notfound' };
    if (o.rialOf || o.fxOf) return { ok: false, why: 'iscompanion' };
    if (!isIrrOffer(o)) return { ok: false, why: 'notirr' };
    if (!((o.items || []).length)) return { ok: false, why: 'noitems' };
    if (!(irrTotal(o) > 0)) return { ok: false, why: 'nototal' };
    if (targetCur) {
      if (window.ptfFxCompanionOf(o.no, targetCur)) return { ok: false, why: 'exists', cur: targetCur };
    }
    return { ok: true, offer: o };
  };

  /* ---------- تبدیل متن شرایط: ریال → ارز مقصد ---------- */
  function faDigitsToEn(s) {
    return String(s)
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  }
  function parseAmt(s) {
    return +(faDigitsToEn(s).replace(/[٬،,\\s]/g, '').replace(/٫/g, '.')) || 0;
  }
  function fmtFx(v) {
    var n = +v || 0;
    // ۲ اعشار، حذف صفرهای زائد
    if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function isFaTok(t) { return /[ء-ی]/.test(t); }

  var NUM_RE = '(?:\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|[۰-۹]{1,3}(?:[٬،][۰-۹]{3})*(?:[٫.][۰-۹]+)?|[۰-۹]+(?:[٫.][۰-۹]+)?)';

  var IRR_TOKENS_RE = '(?:IRR|Rials?|Iranian Rials?|Iranian Rial|ریال)';

  var TARGET_INFO = {
    USD: { code: 'USD', fa: 'دلار', en: 'Dollar', enPl: 'Dollars', sym: '$' },
    EUR: { code: 'EUR', fa: 'یورو', en: 'Euro', enPl: 'Euros', sym: '€' },
    CNY: { code: 'CNY', fa: 'یوان', en: 'Yuan', enPl: 'Yuan', sym: '¥' },
    AED: { code: 'AED', fa: 'درهم', en: 'Dirham', enPl: 'Dirhams', sym: 'AED' },
    GBP: { code: 'GBP', fa: 'پوند', en: 'Pound', enPl: 'Pounds', sym: '£' }
  };

  window.ptfFxConvertTermText = function (txt, targetCur, rate) {
    if (!txt || !rate) return String(txt || '');
    var info = TARGET_INFO[targetCur] || { code: targetCur, fa: curFa(targetCur), en: curEn(targetCur), enPl: curEn(targetCur) + 's', sym: targetCur };
    var s = String(txt);

    // ۱) عدد + ریال → معادل ارزی
    s = s.replace(new RegExp('(' + NUM_RE + ')[ \t]*(' + IRR_TOKENS_RE + ')(?![A-Za-z])', 'gi'), function (m, n, t) {
      var irr = parseAmt(n);
      if (!(irr > 0)) return m;
      var fx = irr / rate;
      return fmtFx(fx) + ' ' + (isFaTok(t) ? info.fa : info.code);
    });
    // ۲) ریال + عدد
    s = s.replace(new RegExp('(' + IRR_TOKENS_RE + ')[ \t]*(' + NUM_RE + ')', 'gi'), function (m, t, n) {
      var irr = parseAmt(n);
      if (!(irr > 0)) return m;
      var fx = irr / rate;
      return (isFaTok(t) ? info.fa + ' ' : info.code + ' ') + fmtFx(fx);
    });
    // ۳) باقیمانده کلمه ریال بدون عدد
    s = s.replace(/ریال/g, info.fa);
    s = s.replace(/\bIranian Rials?\b/gi, function (mt) {
      return /Rials/i.test(mt) ? info.enPl : info.en;
    });
    s = s.replace(/\bRials?\b/gi, function (mt) {
      return /Rials/i.test(mt) ? info.enPl : info.en;
    });
    // IRR باقی‌مانده (مثلاً در متن انگلیسی)
    s = s.replace(/\bIRR\b/g, info.code);

    return s;
  };

  function convertTermsArr(terms, targetCur, rate) {
    var changed = 0;
    var out = (terms || []).map(function (t) {
      var c = window.ptfFxConvertTermText(t, targetCur, rate);
      if (c !== String(t || '')) changed++;
      return c;
    });
    return { terms: out, changed: changed };
  }

  function fxBasisOfIrr(o) {
    var adv = (o && o.advance) || null;
    var a = null;
    try { a = (typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null; } catch (e) { a = null; }
    return {
      originalIrrTotal: irrTotal(o),
      currency: 'IRR',
      advancePct: (a && a.pct != null) ? Math.round(+a.pct) : ((adv && +adv.pct) || 0),
      advanceDocAmt: (a && +a.docAmt) || ((adv && +adv.docAmt) || 0)
    };
  }

  function buildAdvanceTermFx(o, targetCur, rate) {
    try {
      var adv = (o && o.advance) || null;
      if (!adv || adv.mode === 'none' || adv.mode === 'no') return null;
      var a = null;
      try { a = (typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(o) : null; } catch (e) { a = null; }
      var totalIrr = irrTotal(o);
      var pct = (a && a.pct != null) ? Math.round(+a.pct) : Math.max(0, Math.min(100, +adv.pct || 0));
      var docAmtIrr = (a && +a.docAmt) || (+adv.docAmt) || 0;
      var docAmtFx = docAmtIrr ? (docAmtIrr / rate) : (totalIrr * pct / 100 / rate);
      var full = adv.mode === 'full' || adv.cashFull || pct >= 100 || (a && a.cashFull);
      var info = TARGET_INFO[targetCur] || { code: targetCur, fa: curFa(targetCur) };
      var s = 'Payment Terms: ';
      if (full) s += '100% full payment — total ' + fmtFx(docAmtFx || (totalIrr / rate)) + ' ' + info.code;
      else s += (pct > 0 ? pct + '% ' : '') + 'advance payment' + (docAmtFx ? ' (= ' + fmtFx(docAmtFx) + ' ' + info.code + ')' : '') + ', balance before delivery';
      s += ' — IRR basis: ' + Math.round(docAmtIrr || (totalIrr * pct / 100)).toLocaleString('en-US') + ' IRR @ ' + Math.round(rate).toLocaleString('en-US') + ' IRR/' + info.code;
      return s + '.';
    } catch (e) { return null; }
  }

  function buildConvertedTermsFx(o, targetCur, rate) {
    var conv = convertTermsArr((o && o.terms) || [], targetCur, rate);
    var advTerm = buildAdvanceTermFx(o, targetCur, rate);
    if (advTerm) { conv.terms.unshift(advTerm); conv.changed++; }
    return conv;
  }

  /* بازساخت شرایط ارزی از پیشنهاد ریالی مبدأ */
  window.ptfOfferFxTermsRepair = function (compNo, confirmFirst) {
    var offers = offersAll();
    var comp = offers.filter(function (o) { return o && o.no === compNo; })[0];
    if (!comp || !comp.fxOf) { alert('⛔ نسخه ارزی یافت نشد.'); return; }
    var src = offers.filter(function (o) { return o && o.no === comp.fxOf; })[0];
    var rate = (comp.fxConvert && +comp.fxConvert.rate) || 0;
    var targetCur = comp.currency || 'USD';
    if (!src || !(rate > 0)) { alert('⛔ پیشنهاد مبدأ یا نرخ تسعیر یافت نشد.'); return; }
    if (confirmFirst && !confirm('⚠️ شرایط فعلی نسخه ارزی با نسخه تبدیل‌شده از پیشنهاد اصلی ' + src.no + ' جایگزین می‌شود.\nادامه می‌دهید؟')) return;
    var conv = convertTermsArr(src.terms || [], targetCur, rate);
    var advTerm = buildAdvanceTermFx(src, targetCur, rate);
    if (advTerm) conv.terms.unshift(advTerm);
    comp.terms = conv.terms;
    comp.fxConvert.termsRewritten = conv.terms.length;
    comp.updatedAtISO = new Date().toISOString();
    setData(OFFERS_KEY, offers);
    try { audit('پیشنهادها', 'بازسازی شرایط ارزی ' + comp.no + ' از ' + src.no + ' (نرخ ' + rate + ' — ' + targetCur + ')', comp.no); } catch (e) {}
    toast('🔧 شرایط نسخه ارزی به‌روز شد (' + conv.terms.length + ' بند)', 'ok');
    try { if (typeof renderDeals === 'function') renderDeals(); } catch (e2) {}
  };

  /* ---------- دیالوگ پیش‌نمایش/ویرایش شرایط نسخه ارزی ---------- */
  var _termDlgFx = null;

  window.ptfOfferFxTermsOpen = function (compNo) {
    var comp = offerByNo(compNo);
    if (!comp || !comp.fxOf) { alert('⛔ نسخه ارزی یافت نشد.'); return; }
    var src = offerByNo(comp.fxOf);
    if (!src) { alert('⛔ پیشنهاد ریالی مبدأ یافت نشد.'); return; }
    var rate = (comp.fxConvert && +comp.fxConvert.rate) || 0;
    var targetCur = comp.currency || 'USD';
    if (!(rate > 0)) rate = 100000; // fallback
    _termDlgFx = {
      comp: comp, src: src, rate: rate, targetCur: targetCur,
      terms: ((comp.terms && comp.terms.length) ? comp.terms.slice() : buildConvertedTermsFx(src, targetCur, rate).terms)
    };
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var liveRate = targetCur === 'USD' ? (+L.usd_free || 0) : targetCur === 'EUR' ? (+L.eur_free || 0) : 0;
    var totalIrr = irrTotal(src);
    var _b = fxBasisOfIrr(src);
    var fxNote = _b.advancePct > 0
      ? '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:5px 9px;font-size:11px;color:#166534;margin-top:4px">💰 شرط تجاری پیشنهاد مبدأ: پیش‌پرداخت <b>' + _b.advancePct + '٪</b>' + (_b.advanceDocAmt ? ' — ' + (+_b.advanceDocAmt).toLocaleString('fa-IR') + ' ریال' : '') + '.</div>'
      : '';
    var html = '<div class="md-b" id="sfFxTermsDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:800px">' +
      '<h3>🔧 شرایط و ضوابط نسخه ارزی — <span dir="ltr">' + escP(comp.no) + ' (' + escP(targetCur) + ')</span></h3>' +
      '<div style="background:#fff7ed;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:10px">' +
        'این نسخه ارزی از پیشنهاد ریالی <b dir="ltr">' + escP(src.no) + '</b> با نرخ <b>' + rate.toLocaleString('fa-IR') + ' ریال/' + escP(targetCur) + '</b> ساخته شده است. ' +
        'عبارت‌ها/مبالغ ریالی خودکار به ' + escP(targetCur) + ' تبدیل شدند — در صورت نیاز بندها را ویرایش کنید.' +
      '</div>' +
      '<div class="fr"><div class="fld"><label>ارز مقصد</label><select id="sfFxTermsCur" onchange="sfFxTermsCurChanged()" style="padding:7px;border:1px solid var(--brd);border-radius:8px"><option value="USD"' + (targetCur === 'USD' ? ' selected' : '') + '>دلار (USD)</option><option value="EUR"' + (targetCur === 'EUR' ? ' selected' : '') + '>یورو (EUR)</option><option value="CNY"' + (targetCur === 'CNY' ? ' selected' : '') + '>یوان (CNY)</option><option value="AED"' + (targetCur === 'AED' ? ' selected' : '') + '>درهم (AED)</option><option value="GBP"' + (targetCur === 'GBP' ? ' selected' : '') + '>پوند (GBP)</option></select></div>' +
      '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر ' + escP(targetCur) + ')</label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="sfFxTermsRate" value="' + rate.toLocaleString('en-US') + '" style="direction:ltr;flex:1;min-width:160px" oninput="sfFxTermsRateChanged()">' +
          '<button class="bt bt-o" style="font-size:12px" onclick="sfFxTermsRebuild()" title="بازسازی خودکار بندها">↻ بازسازی خودکار</button>' +
          '<button class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="sfFxTermsViewSrc()">👁 دیدن پیشنهاد ریالی قبلی</button>' +
        '</div>' +
        '<small style="color:#64748b">نرخ آزاد لحظه‌ای: ' + (liveRate ? liveRate.toLocaleString('fa-IR') + ' ریال' : 'در دسترس نیست') + '</small></div></div>' +
      '<div style="font-size:12px;background:#f8fafc;border:1px solid var(--brd,#e2e8f0);border-radius:10px;padding:8px 12px;margin-bottom:8px">' +
        'مبلغ پیشنهاد ریالی: <b dir="ltr">' + money(totalIrr, 'IRR') + '</b> — معادل ارزی (با نرخ فعلی): <b id="sfFxTermsTotal">' + money(totalIrr / rate, targetCur) + '</b>' + fxNote + '</div>' +
      '<div id="sfFxTermsList"></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap">' +
        '<button class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#a5f3fc" onclick="offerQuickPreview(\'' + ptfOnClickArg(comp.no) + '\')">👁 پیش‌نمایش سند</button>' +
        '<span style="display:flex;gap:8px">' +
          '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
          '<button class="bt" style="background:#0e7490" onclick="sfFxTermsSave(\'' + ptfOnClickArg(comp.no) + '\')">💾 ذخیره و منضم به پیشنهاد</button>' +
        '</span></div>' +
      '</div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    sfFxTermsRenderList();
  };

  window.sfFxTermsRenderList = function () {
    if (!_termDlgFx) return;
    var el = document.getElementById('sfFxTermsList');
    if (!el) return;
    var terms = _termDlgFx.terms || [];
    el.innerHTML = '<div style="font-size:12px;color:#334155;font-weight:800;margin-bottom:6px">بندهای شرایط و ضوابط (' + terms.length + ')</div>' +
      terms.map(function (t, i) {
        return '<div style="margin-bottom:6px"><div style="font-size:10.5px;color:#64748b;margin-bottom:2px">بند ' + (i + 1) + '</div>' +
          '<textarea data-ti="' + i + '" oninput="sfFxTermsEdit(this)" style="width:100%;height:52px;padding:6px;border:1px solid var(--brd);border-radius:8px;font-size:12px;direction:ltr;text-align:left;resize:vertical">' + escP(t) + '</textarea></div>';
      }).join('') +
      '<button class="bt bt-o" style="font-size:12px;margin-top:4px" onclick="sfFxTermsAdd()">+ بند دلخواه</button>';
  };
  window.sfFxTermsEdit = function (el) {
    if (!_termDlgFx) return;
    var i = +(el.getAttribute('data-ti') || 0);
    if (_termDlgFx.terms[i] !== undefined) _termDlgFx.terms[i] = el.value;
  };
  window.sfFxTermsAdd = function () {
    if (!_termDlgFx) return;
    _termDlgFx.terms.push('');
    sfFxTermsRenderList();
    var ta = document.querySelector('#sfFxTermsList textarea:last-of-type');
    if (ta) { ta.focus(); }
  };
  window.sfFxTermsCurChanged = function () {
    if (!_termDlgFx) return;
    var curEl = document.getElementById('sfFxTermsCur');
    _termDlgFx.targetCur = curEl ? curEl.value : _termDlgFx.targetCur;
    sfFxTermsRateChanged();
  };
  window.sfFxTermsRateChanged = function () {
    if (!_termDlgFx) return;
    _termDlgFx.rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfFxTermsRate') || {}).value || '')) : 0;
    var curEl = document.getElementById('sfFxTermsCur');
    if (curEl) _termDlgFx.targetCur = curEl.value;
    var totalEl = document.getElementById('sfFxTermsTotal');
    if (totalEl) {
      var srcTotal = irrTotal(_termDlgFx.src);
      totalEl.textContent = money(srcTotal / (_termDlgFx.rate || 1), _termDlgFx.targetCur);
    }
  };
  window.sfFxTermsRebuild = function () {
    if (!_termDlgFx) return;
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfFxTermsRate') || {}).value || '')) : 0;
    var curEl = document.getElementById('sfFxTermsCur');
    var targetCur = curEl ? curEl.value : _termDlgFx.targetCur;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    _termDlgFx.rate = rate;
    _termDlgFx.targetCur = targetCur;
    _termDlgFx.terms = buildConvertedTermsFx(_termDlgFx.src, targetCur, rate).terms;
    sfFxTermsRenderList();
    toast('↻ بندهای شرایط از پیشنهاد ریالی با نرخ جدید بازسازی شد', 'ok');
  };
  window.sfFxTermsViewSrc = function () {
    if (!_termDlgFx || !_termDlgFx.src) return;
    try { if (typeof offerQuickPreview === 'function') offerQuickPreview(_termDlgFx.src.no); } catch (e) {}
  };
  window.sfFxTermsSave = function (compNo) {
    if (!_termDlgFx) { alert('⛔ پنجرهٔ شرایط نسخهٔ ارزی باز نیست.'); return; }
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfFxTermsRate') || {}).value || '')) : 0;
    var curEl = document.getElementById('sfFxTermsCur');
    var targetCur = curEl ? curEl.value : _termDlgFx.targetCur;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    var offers = offersAll();
    var comp = offers.filter(function (o) { return o && o.no === compNo; })[0];
    if (!comp) { alert('⛔ نسخه ارزی یافت نشد.'); return; }
    var src = _termDlgFx.src;
    var items = (src.items || []).map(function (it) {
      var c = convertItemToFx(it, rate, targetCur);
      delete c.lineId;
      return c;
    });
    var totalIrr = irrTotal(src);
    var totalFx = items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
    try { if (typeof offEnsureOfferLineIds === 'function') offEnsureOfferLineIds(items, comp.no); } catch (eL) {}
    comp.items = items;
    comp.terms = (_termDlgFx.terms || []).filter(function (t) { return String(t || '').trim() !== ''; });
    comp.currency = targetCur;
    comp.fxConvert = comp.fxConvert || {};
    comp.fxConvert.rate = rate;
    comp.fxConvert.toCur = targetCur;
    comp.fxConvert.totalIrr = totalIrr;
    comp.fxConvert.totalFx = totalFx;
    comp.fxConvert.termsRewritten = comp.terms.length;
    if (!comp.fxConvert.originalIrrTotal) {
      var _fb = fxBasisOfIrr(src);
      comp.fxConvert.originalIrrTotal = _fb.originalIrrTotal;
      comp.fxConvert.advancePct = _fb.advancePct;
      comp.fxConvert.advanceDocAmt = _fb.advanceDocAmt;
    }
    comp.updatedAtISO = new Date().toISOString();
    setData(OFFERS_KEY, offers);
    try { audit('پیشنهادها', 'اصلاح شرایط/نرخ نسخه ارزی ' + comp.no + ' از ' + src.no + ' (نرخ ' + rate + ' — ' + targetCur + ')', comp.no); } catch (eA) {}
    toast('🔧 شرایط نسخه ارزی ' + comp.no + ' ذخیره شد', 'ok');
    var dlg = document.getElementById('sfFxTermsDlg');
    if (dlg) dlg.remove();
    _termDlgFx = null;
    try { if (typeof renderDeals === 'function') renderDeals(); } catch (eR) {}
    try { if (typeof renderOffers === 'function') renderOffers(); } catch (eR2) {}
  };

  var WHY_FA = {
    notfound: '⛔ پیشنهاد یافت نشد.',
    notirr: '⛔ فقط «پیشنهاد ریالی» (IRR) قابل تبدیل به ارزی است — این پیشنهاد ارزی یا غیرمالی است.',
    iscompanion: '⛔ این پیشنهاد خود یک نسخه همراه (ریالی/ارزی) است و قابل تبدیل مجدد نیست.',
    noitems: '⛔ این پیشنهاد ردیف کالایی ندارد.',
    nototal: '⛔ مبلغ این پیشنهاد صفر است — قابل تبدیل نیست.',
    exists: 'ℹ️ نسخه ارزی این پیشنهاد با همین ارز قبلاً ساخته شده است.',
    rate: '⛔ نرخ تسعیر (ریال به‌ازای هر واحد ارز) باید عددی بزرگ‌تر از صفر باشد.',
    serial: '⛔ شماره رسمی پیشنهاد از سرور دریافت نشد — اتصال را بررسی و دوباره تلاش کنید.',
    role: '⛔ ساخت نسخه ارزی فقط برای نقش‌های ارشد مجاز است.',
    cur: '⛔ ارز مقصد را انتخاب کنید.'
  };
  window.ptfOfferFxWhyFa = function (why) { return WHY_FA[why] || ('⛔ خطا: ' + (why || 'نامشخص')); };

  function seniorOk() {
    try { if (typeof isSenior === 'function') return isSenior(); } catch (e) {}
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1; } catch (e2) { return true; }
  }

  /* ---------- هسته ساخت نسخه همراه ارزی ---------- */
  window.ptfOfferFxConvertCommit = function (no, rate, targetCur, dateISO, cb) {
    function done(res) { if (typeof cb === 'function') cb(res); return res; }
    var chk = window.ptfOfferFxConvertCheck(no, targetCur);
    if (!chk.ok) return done({ ok: false, why: chk.why, cur: chk.cur });
    if (!seniorOk()) return done({ ok: false, why: 'role' });
    var o = chk.offer;
    rate = +rate || 0;
    targetCur = targetCur || 'USD';
    if (!(rate > 0)) { alert(WHY_FA.rate); return done({ ok: false, why: 'rate' }); }
    if (!TARGET_INFO[targetCur]) { alert(WHY_FA.cur); return done({ ok: false, why: 'cur' }); }
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) dateISO = o.dateEn || new Date().toISOString().slice(0, 10);

    function finish(newNo) {
      if (!newNo || /^TMP-/.test(String(newNo))) { alert(WHY_FA.serial); return done({ ok: false, why: 'serial' }); }
      if (offersAll().some(function (x) { return newNo && x.no === newNo; })) { alert(WHY_FA.serial); return done({ ok: false, why: 'serial' }); }
      var items = (o.items || []).map(function (it) {
        var c = convertItemToFx(it, rate, targetCur);
        delete c.lineId;
        return c;
      });
      var totalIrr = irrTotal(o);
      var totalFx = items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
      var termsConv = convertTermsArr(o.terms || [], targetCur, rate);
      var advTerm = buildAdvanceTermFx(o, targetCur, rate);
      if (advTerm) { termsConv.terms.unshift(advTerm); termsConv.changed++; }
      var _fxBasis = fxBasisOfIrr(o);
      var comp = {
        no: newNo, kind: 'CO', rev: 0, editMode: 'new',
        st: 'sent',
        fxOf: o.no,
        fxConvert: {
          from: o.no, toCur: targetCur, cur: targetCur, rate: rate,
          totalIrr: totalIrr, totalFx: totalFx,
          dateISO: dateISO,
          termsRewritten: termsConv.changed || 0,
          at: (typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString()),
          by: curName(),
          originalIrrTotal: _fxBasis.originalIrrTotal,
          advancePct: _fxBasis.advancePct,
          advanceDocAmt: _fxBasis.advanceDocAmt
        },
        currency: targetCur,
        fxBasis: 'converted',
        fxRateRef: rate,
        dateEn: dateISO,
        dateFa: (typeof ptfISOToJ === 'function' ? ptfISOToJ(dateISO) : dateISO),
        t: (typeof faDateTime === 'function' ? faDateTime() : ''),
        buyerCd: o.buyerCd || '', buyerCo: o.buyerCo || '', buyerContact: o.buyerContact || '', buyerTel: o.buyerTel || '',
        inqNo: o.inqNo || '',
        items: items,
        terms: termsConv.terms,
        advanceAsked: true,
        extraCols: JSON.parse(JSON.stringify(o.extraCols || [])),
        colOrder: o.colOrder ? JSON.parse(JSON.stringify(o.colOrder)) : [],
        hiddenCols: JSON.parse(JSON.stringify(o.hiddenCols || [])),
        vatNote: o.vatNote !== false,
        printAs: 'CO',
        issuedBy: o.issuedBy || curUser(),
        sellerContact: o.sellerContact || '',
        useSig: !!o.useSig, signAs: o.signAs || '',
        updatedAtISO: new Date().toISOString()
      };
      try { if (typeof offEnsureOfferLineIds === 'function') offEnsureOfferLineIds(comp.items, comp.no); } catch (eL) {}
      var offers = offersAll();
      offers.unshift(comp);
      setData(OFFERS_KEY, offers);

      try {
        var deals = getData(DEALS_KEY) || [];
        var rec = deals.filter(function (d) { return d && (d.wonOffer === o.no || (o.inqNo && d.inqNo === o.inqNo)); })[0];
        if (rec) {
          rec.timeline = rec.timeline || [];
          rec.timeline.push({ t: (typeof faDateTime === 'function' ? faDateTime() : ''), by: curName(), tx: '💱 نسخه ارزی ' + newNo + ' (' + targetCur + ') از پیشنهاد ریالی ' + o.no + ' ساخته شد (نرخ ' + rate.toLocaleString('fa-IR') + ' ریال — US-IRR2FX)' });
          setData(DEALS_KEY, deals);
          try { audit('پرونده‌های فروش', 'تبدیل پیشنهاد ریالی ' + o.no + ' به نسخه ارزی ' + newNo + ' (' + targetCur + ') — نرخ ' + rate + ' — تاریخ ' + dateISO, rec.cd); } catch (eA1) {}
        }
      } catch (eD) {}
      try { audit('پیشنهادها', 'ساخت نسخه ارزی ' + newNo + ' (' + targetCur + ') از پیشنهاد ریالی ' + o.no + ' (نرخ تسعیر ' + rate + ' — تاریخ ' + dateISO + ')', newNo); } catch (eA2) {}
      try { if (typeof addLog === 'function') addLog('💱 پیشنهاد ارزی ' + newNo + ' (' + targetCur + ') از ' + o.no + ' ساخته شد (نرخ ' + rate + ')'); } catch (eL2) {}
      try {
        if (typeof notify === 'function') {
          notify({ toRoles: (typeof SENIOR_ROLES !== 'undefined' ? SENIOR_ROLES : ['admin', 'chairman', 'ceo', 'commercial']), title: '💱 نسخه ارزی ' + newNo + ' (' + targetCur + ') از پیشنهاد ریالی ' + o.no + ' ساخته شد', body: 'نرخ: ' + rate.toLocaleString('fa-IR') + ' ریال/' + targetCur + ' — مبلغ: ' + money(totalFx, targetCur) + ' — پیشنهاد اصلی تغییر نکرده', kind: 'info', channels: ['cart'], link: { panel: 'deals' } });
        }
      } catch (eN) {}
      return done({ ok: true, no: newNo, totalIrr: totalIrr, totalFx: totalFx, rate: rate, targetCur: targetCur, dateISO: dateISO, termsChanged: termsConv.changed || 0 });
    }

    if (typeof ptfUnifiedCodeAsync === 'function') {
      try {
        ptfUnifiedCodeAsync('CO', 1).then(finish, function () { alert(WHY_FA.serial); done({ ok: false, why: 'serial' }); });
        return { ok: true, pending: true };
      } catch (eP) { /* fallback */ }
    }
    return finish(typeof offerSerial === 'function' ? offerSerial('CO') : '');
  };

  /* ---------- هوک: نسخه ارزی هرگز برنده/بازنده نمی‌شود ---------- */
  function hookOfferSetStFx() {
    if (window._ptfFxStHooked || typeof window.offerSetSt !== 'function') return false;
    // اگر هوک ریالی قبلاً نصب شده، آن را هم پوشش می‌دهیم — زنجیره‌ای
    window._ptfFxStHooked = true;
    var _setSt = window.offerSetSt;
    window.offerSetSt = function (no, st, selEl) {
      try {
        var o = offerByNo(no);
        if (o && (o.fxOf || o.rialOf) && (st === 'won' || st === 'lost')) {
          var origin = o.fxOf || o.rialOf;
          alert('🔒 این سند «نسخه همراه» پیشنهاد ' + origin + ' است.\n\n• وضعیت «برنده» فقط متعلق به پیشنهاد اصلی است.\n• ثبت برد/باخت روی نسخه همراه آمار را دوشمار می‌کند.\n\nادامه فرایند: پرونده فروش ← ' + (o.inqNo || origin));
          if (selEl) selEl.value = o.st || 'sent';
          return;
        }
      } catch (e) {}
      return _setSt.apply(this, arguments);
    };
    return true;
  }
  var _hTryFx = 0;
  var _hTimerFx = setInterval(function () { _hTryFx++; if (hookOfferSetStFx() || _hTryFx > 60) clearInterval(_hTimerFx); }, 400);

  /* ---------- دیالوگ تبدیل ریالی → ارزی ---------- */
  window.ptfOfferFxConvertOpenByNo = function (no, dealCd) {
    var chk = window.ptfOfferFxConvertCheck(no);
    if (!chk.ok) { alert(window.ptfOfferFxWhyFa(chk.why)); return; }
    var o = chk.offer;
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var liveUsd = +L.usd_free || 0;
    var liveEur = +L.eur_free || 0;
    var defRate = liveUsd || liveEur || 100000;
    var defDate = o.dateEn || new Date().toISOString().slice(0, 10);
    var totalIrr = irrTotal(o);
    var dateInp = (typeof ptfDateInput === 'function')
      ? ptfDateInput('sfFxDateJ', defDate)
      : '<input type="text" id="sfFxDateJ" value="' + escP(defDate) + '" style="direction:ltr;color:#0e7490">';
    var existing = window.ptfFxCompanionsOf ? window.ptfFxCompanionsOf(o.no) : [];
    var existingHtml = existing.length ? '<div style="font-size:11px;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:6px 10px;margin-bottom:8px">نسخه‌های ارزی موجود: ' + existing.map(function (e) { return '<b dir="ltr">' + escP(e.no) + ' (' + escP(e.currency) + ')</b>'; }).join('، ') + '</div>' : '';
    var html = '<div class="md-b" id="sfFxDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px">' +
      '<h3>💱 تبدیل به پیشنهاد ارزی</h3>' +
      '<input type="hidden" id="sfFxNo" value="' + escP(o.no) + '">' +
      '<div style="background:#fff7ed;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:10px">' +
        'پیشنهاد اصلی <b dir="ltr">' + escP(o.no) + '</b> (ریالی) <b>هیچ تغییری نمی‌کند</b> — یک پیشنهاد ارزی جدید با شماره مستقل ساخته و به همین پرونده منضم می‌شود.' +
      '</div>' + existingHtml +
      '<div style="font-size:12.5px;background:#f8fafc;border:1px solid var(--brd,#e2e8f0);border-radius:10px;padding:8px 12px;margin-bottom:10px">' +
        'مبلغ پیشنهاد ریالی: <b dir="ltr">' + money(totalIrr, 'IRR') + '</b>' +
      '</div>' +
      '<div class="fr"><div class="fld"><label>ارز مقصد *</label><select id="sfFxCur" onchange="sfFxPreview()" style="padding:7px;border:1px solid var(--brd);border-radius:8px"><option value="USD">دلار (USD)</option><option value="EUR">یورو (EUR)</option><option value="CNY">یوان (CNY)</option><option value="AED">درهم (AED)</option><option value="GBP">پوند (GBP)</option></select></div>' +
      '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر واحد ارز) *</label>' +
        '<input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="sfFxRate" value="' + defRate.toLocaleString('en-US') + '" style="direction:ltr" oninput="sfFxPreview()">' +
        '<small style="color:#64748b">آزاد لحظه‌ای: USD ' + (liveUsd ? liveUsd.toLocaleString('fa-IR') : '—') + ' | EUR ' + (liveEur ? liveEur.toLocaleString('fa-IR') : '—') + '</small></div></div>' +
      '<div class="fld"><label>تاریخ پیشنهاد ارزی (شمسی) — پیش‌فرض: تاریخ پیشنهاد اولیه</label>' + dateInp + '</div>' +
      '<div id="sfFxPreview" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#1e40af;margin-bottom:10px"></div>' +
      '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#92400e;margin-bottom:10px">' +
        '<b>آثار:</b> پیشنهاد اصلی ریالی دست‌نخورده می‌ماند • نسخه ارزی وضعیت برد/باخت نمی‌گیرد • شرایط و ضوابط خودکار به ارز مقصد تبدیل می‌شوند • فاکتور رسمی از پیشنهاد برنده صادر می‌شود.' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="bt bt-o" onclick="document.getElementById(\'sfFxDlg\').remove()">انصراف</button>' +
        '<button class="bt" style="background:#0e7490" onclick="sfFxDoConvert(\'' + ptfOnClickArg(o.no) + '\',\'' + ptfOnClickArg(dealCd || '') + '\')">💱 ساخت پیشنهاد ارزی</button>' +
      '</div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window.sfFxPreview();
  };

  window.sfFxPreview = function () {
    var el = document.getElementById('sfFxPreview');
    if (!el || !document.getElementById('sfFxDlg')) return;
    var no = ((document.getElementById('sfFxNo') || {}).value || '');
    var o = offerByNo(no);
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfFxRate') || {}).value || '')) : 0;
    var curEl = document.getElementById('sfFxCur');
    var targetCur = curEl ? curEl.value : 'USD';
    if (!o || !isIrrOffer(o)) { el.innerHTML = ''; return; }
    if (!(rate > 0)) { el.innerHTML = 'نرخ تسعیر را وارد کنید تا معادل ارزی محاسبه شود.'; return; }
    var totalIrr = irrTotal(o);
    var totalFx = totalIrr / rate;
    el.innerHTML = 'معادل ارزی پیشنهاد: <b>' + money(totalFx, targetCur) + '</b>' +
      '<div style="font-size:11px;color:#1e40af;margin-top:2px">قیمت هر ردیف = قیمت ریالی ÷ ' + rate.toLocaleString('fa-IR') + ' (گرد ۲ اعشار)</div>';
  };

  window.sfFxDoConvert = function (no, dealCd) {
    var rate = (typeof ptfNum === 'function') ? ptfNum(((document.getElementById('sfFxRate') || {}).value || '')) : 0;
    var curEl = document.getElementById('sfFxCur');
    var targetCur = curEl ? curEl.value : 'USD';
    var jRaw = ((document.getElementById('sfFxDateJ') || {}).value || '').trim();
    var dateISO = (typeof ptfJToISO === 'function') ? ptfJToISO(jRaw) : jRaw;
    if (!(rate > 0)) { alert(WHY_FA.rate); return; }
    if (!targetCur) { alert(WHY_FA.cur); return; }
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) { alert('⛔ تاریخ پیشنهاد ارزی را به‌صورت شمسی وارد کنید.'); return; }
    window.ptfOfferFxConvertCommit(no, rate, targetCur, dateISO, function (res) {
      if (!res || !res.ok) { if (res && res.why && res.why !== 'rate' && res.why !== 'serial') alert(window.ptfOfferFxWhyFa(res.why)); return; }
      var dlg = document.getElementById('sfFxDlg');
      if (dlg) dlg.remove();
      toast('💱 پیشنهاد ارزی ' + res.no + ' (' + res.targetCur + ') ساخته شد', 'ok');
      try { if (typeof renderDeals === 'function') renderDeals(); } catch (eR) {}
      try { if (typeof renderOffers === 'function') renderOffers(); } catch (eR2) {}
      setTimeout(function () {
        var termsMsg = res.termsChanged ? '\n🔧 ' + res.termsChanged + ' بند شرایط خودکار به ' + res.targetCur + ' تبدیل شد.' : '';
        if (confirm('✅ پیشنهاد ارزی ' + res.no + ' (' + res.targetCur + ') ساخته شد.\nمبلغ: ' + money(res.totalFx, res.targetCur) + termsMsg + '\n\nالآن چاپ/PDF شود؟')) {
          try { if (typeof offerPrint === 'function') offerPrint(res.no); } catch (eP) {}
        }
      }, 150);
    });
  };

  /* ---------- تولبار پرونده فروش ---------- */
  function fxPostAction(kind, icon, label, title, onClick, meta, primary) {
    return '<button type="button" class="bt bt-o sf-post-award-action sf-post-award-fx-' + kind + (primary ? ' is-primary' : '') + '" data-sf-post-action="fx-' + kind + '"' +
      ' title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="sf-post-award-icon" aria-hidden="true">' + icon + '</span><span class="sf-post-award-copy"><span class="sf-post-award-label">' + label + '</span>' +
      (meta ? '<span class="sf-post-award-meta">' + meta + '</span>' : '') + '</span></button>';
  }
  window.ptfOfferFxToolbarHtml = function (r) {
    try {
      if (!r || !r.wonOffer) return '';
      var wo = offerByNo(r.wonOffer);
      if (!wo) return '';
      if (!isIrrOffer(wo)) return ''; // فقط برای برنده ریالی
      var comps = window.ptfFxCompanionsOf ? window.ptfFxCompanionsOf(wo.no) : [];
      if (comps && comps.length) {
        var badges = comps.map(function (c) {
          var rateTxt = (c.fxConvert && c.fxConvert.rate) ? (+c.fxConvert.rate).toLocaleString('fa-IR') + ' ریال/' + escP(c.currency) : '';
          return '<span class="bd sf-post-award-status sf-post-award-fx-status" title="نسخه ارزی — ' + escP(rateTxt) + '">💱 ارزی: <b dir="ltr">' + escP(c.no) + ' (' + escP(c.currency) + ')</b></span>';
        }).join(' ');
        var btns = comps.map(function (c) {
          return fxPostAction('preview-' + c.no, '👁', 'نمایش ' + c.currency, 'نمایش نسخه ارزی ' + c.currency, 'offerQuickPreview(\'' + ptfOnClickArg(c.no) + '\')', c.currency) +
            fxPostAction('print-' + c.no, '🖨', 'چاپ ' + c.currency, 'چاپ/PDF نسخه ارزی', 'offerPrint(\'' + ptfOnClickArg(c.no) + '\')', 'PDF') +
            fxPostAction('terms-' + c.no, '🔧', 'شرایط ' + c.currency, 'ویرایش شرایط ارزی', 'ptfOfferFxTermsOpen(\'' + ptfOnClickArg(c.no) + '\')', 'ویرایش');
        }).join('');
        return badges + btns + fxPostAction('convert', '💱', 'ارزی دیگر', 'ساخت نسخه ارزی دیگر از پیشنهاد ریالی برنده', 'ptfOfferFxConvertOpenByNo(\'' + ptfOnClickArg(wo.no) + '\',\'' + ptfOnClickArg(r.cd || '') + '\')', 'نسخه همراه');
      }
      var chk = window.ptfOfferFxConvertCheck(wo.no);
      if (!chk.ok) return '';
      return fxPostAction('convert', '💱', 'تبدیل به ارزی', 'ساخت نسخه ارزی از پیشنهاد ریالی برنده — پیشنهاد اصلی تغییر نمی‌کند', 'ptfOfferFxConvertOpenByNo(\'' + ptfOnClickArg(wo.no) + '\',\'' + ptfOnClickArg(r.cd || '') + '\')', 'نسخه همراه', true);
    } catch (e) { return ''; }
  };

  window.ptfFxCompanionBadge = function (o) {
    if (!o || !o.fxOf) return '';
    var rate = (o.fxConvert && o.fxConvert.rate) ? (+o.fxConvert.rate).toLocaleString('fa-IR') : '';
    return '<span class="bd" style="background:#fff7ed;color:#92400e;border:1px solid #fde68a;font-size:10px" title="نسخه ارزی پیشنهاد ' + escP(o.fxOf) + ' — نرخ ' + rate + ' ریال/' + escP(o.currency || '') + '">💱 ارزی از ' + escP(o.fxOf) + ' (' + escP(o.currency || '') + ')</span>';
  };

  window.ptfIrrOfferFxInlineHtml = function (o) {
    try {
      if ((o.kind !== 'CO' && o.kind !== 'TC') || !isIrrOffer(o) || typeof window.ptfFxCompanionsOf !== 'function') return '';
      var comps = window.ptfFxCompanionsOf(o.no);
      if (!comps || !comps.length) return '';
      return '<div style="margin-top:6px;background:#fff7ed;border:1px solid #fde68a;border-radius:8px;padding:5px 8px;font-size:10.5px;color:#92400e;display:flex;flex-wrap:wrap;align-items:center;gap:6px" title="نسخه ارزی همین پیشنهاد">' +
        '<span>💱 نسخه ارزی (همان شماره)</span>' +
        '<span style="display:inline-flex;gap:4px;flex-wrap:wrap">' +
        comps.map(function (_comp) {
          var _rt = (_comp.fxConvert && +_comp.fxConvert.rate) || 0;
          var _cur = _comp.currency || '';
          return '<span style="display:inline-flex;gap:2px;align-items:center;background:#fff;border:1px solid #fde68a;border-radius:999px;padding:2px 6px"><b dir="ltr">' + escP(_comp.no) + ' (' + escP(_cur) + ')</b>' +
            (_rt ? '<small style="opacity:.8">' + _rt.toLocaleString('fa-IR') + '</small>' : '') +
            '<button class="bt bt-o" style="width:20px;height:20px;padding:0;font-size:10px" onclick="offerQuickPreview(\'' + ptfOnClickArg(_comp.no) + '\')" title="نمایش نسخه ارزی ' + escP(_cur) + '">👁</button>' +
            '<button class="bt bt-o" style="width:20px;height:20px;padding:0;font-size:10px" onclick="offerPrint(\'' + ptfOnClickArg(_comp.no) + '\')" title="چاپ/PDF نسخه ارزی">🖨</button>' +
            '<button class="bt bt-o" style="width:20px;height:20px;padding:0;font-size:10px;color:#b45309" onclick="ptfOfferFxTermsOpen(\'' + ptfOnClickArg(_comp.no) + '\')" title="شرایط ارزی">🔧</button>' +
            '</span>';
        }).join(' ') +
        '</span></div>';
    } catch (e) { return ''; }
  };

})();

/* =====================================================================
   MOB-025 — تراکم‌زدایی برای نسخه ارزی همراه — الحاق به همان meta
   ===================================================================== */
(function () {
  'use strict';
  var BP = 768;
  var META = {
    fxConvert: { label: 'تبدیل به پیشنهاد ارزی', icon: '💱', tone: 'amber', primary: true },
    fxMenu:    { label: 'عملیات نسخه ارزی', icon: '💱', tone: 'amber', primary: true },
    fxPreview: { label: 'نمایش نسخه ارزی', icon: '👁', tone: 'sky', primary: false },
    fxPrint:   { label: 'چاپ نسخه ارزی', icon: '🖨', tone: 'indigo', primary: false },
    fxTerms:   { label: 'شرایط و نرخ ارزی', icon: '🔧', tone: 'orange', primary: false }
  };
  var TONES = {
    amber: { color: '#92400e', background: '#fffbeb', border: '#fde68a' },
    sky:   { color: '#0284c7', background: '#eff6ff', border: '#bfdbfe' },
    indigo:{ color: '#4f46e5', background: '#eef2ff', border: '#c7d2fe' },
    orange:{ color: '#ea580c', background: '#fff7ed', border: '#fed7aa' },
    slate: { color: '#475569', background: '#f8fafc', border: '#cbd5e1' }
  };
  function isMob() { return window.innerWidth <= BP; }
  function applyTone(btn, tone) {
    var c = TONES[tone] || TONES.slate;
    btn.style.setProperty('color', c.color, 'important');
    btn.style.setProperty('background', c.background, 'important');
    btn.style.setProperty('border-color', c.border, 'important');
  }
  function detect(btn) {
    var known = btn.getAttribute('data-offer-action') || '';
    if (META[known]) return known;
    var on = btn.getAttribute('onclick') || '';
    if (/ptfOfferFxConvertOpenByNo/.test(on)) return 'fxConvert';
    if (/ptfOfferFxTermsOpen/.test(on)) return 'fxTerms';
    return null;
  }
  // این ماژول فقط meta را اضافه می‌کند؛ polish اصلی در offer-rial-convert.js انجام می‌شود
  window.ptfOfferFxMobileMeta = META;
})();
