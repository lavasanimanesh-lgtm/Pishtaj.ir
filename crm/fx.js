/* =====================================================================
   PTF CRM — fx.js — Sprint 122 — US-266v2 (طرح مصوب تیم متخصص)
   تسعیر ارز سبک و کاربردی:
   واقعیت کسب‌وکار PTF (شرح کارفرما):
   - فروش: سند ارزی (EUR/USD) ولی دریافت ریالی با «نرخ تسعیر روز تسویه»
   - خرید: گاهی ارزی، پرداخت ریالی با نرخ روز پرداخت
   طرح تیم (ورک‌فلو سبک — بدون دفترداری دوبل):
   1) هر پرداخت/دریافت ریالیِ مرتبط با سند ارزی، کنار مبلغ ریال، «نرخ تسعیر
      همان روز» را می‌گیرد → معادل ارزی همان تراکنش محاسبه و ذخیره می‌شود.
   2) مانده ارزی سند = مبلغ ارزی سند − جمع معادل‌های ارزی تراکنش‌ها.
   3) سود خالص پروژه به «ریال واقعی»: جمع دریافت‌های ریالی − جمع پرداخت‌های
      ریالی (هر دو واقعی، بدون فرض نرخ) + نمایش سود/زیان تسعیر جداگانه.
   ذخیره: تراکنش‌ها روی خود رکورد فاکتور/خرید (pays[].fx) — کلید جدید ندارد.
   ===================================================================== */
(function () {
  'use strict';

  /* v17.4 (US-416 — ابلاغ کارفرما): نمایش واحد «مبلغ + ارز» در سراسر نرم‌افزار —
     سند ریالی: «۱٬۲۳۴ ت» | سند ارزی: «1,234.00 EUR» — دیگر هیچ مبلغ ارزی با «ت» نمایش داده نمی‌شود */
  window.ptfMoney = function (v, cur) {
    v = +v || 0;
    var c = (cur && cur !== 'IRR') ? String(cur) : '';
    if (!c) return v.toLocaleString('fa-IR') + ' ریال';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + c;
  };

  window.ptfFxCurOf = function (offerNo) {
    var o = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    return (o && o.currency && o.currency !== 'IRR') ? o.currency : null;
  };

  /* دیالوگ ثبت تراکنش ریالی با نرخ تسعیر (برای فاکتور ارزی)
     v17.4 (US-414 — کیس R8): نوع نرخ (آزاد/توافقی) با نرخ زنده + ورود درصدی از مبلغ سند.
     v33.4.2 (دستور کارفرما): گزینه‌ی «نرخ سنا» کاملاً حذف شد — منبع سنا/ICE از ۲۲ دی ۱۴۰۴
     دیگر به‌روزرسانی نمی‌شود (نرخ منسوخ/منجمد) و نمی‌توانست به‌عنوان مرجع معتبر استفاده شود؛
     طبق تصمیم صریح کارفرما فقط نرخ آزاد (زنده و پایدار) نگه داشته شد.
     مثال کارفرما: سند 1500$ و مشتری ۳۰٪ می‌پردازد → ۴۵۰$ × نرخ انتخابی = مبلغ ریالی؛ ۷۰٪ باقی در مطالبات. */
  window.ptfFxPayDialog = function (kind, refNo, cur, cb) {
    /* مبلغ ارزی کل سند (برای ورود درصدی) */
    var totalFx = 0;
    try {
      var oRef = getData('ptf_crm_offers').filter(function (x) { return x.no === refNo; })[0];
      if (oRef) totalFx = (oRef.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0);
    } catch (eT) {}
    /* نرخ زنده‌ی آزاد از ویجت fx (اطلاعی — تصمیم با کاربر) */
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var freeRate = cur === 'USD' ? (+L.usd_free || 0) : cur === 'EUR' ? (+L.eur_free || 0) : 0;
    var rateOpts =
      '<option value="free">🇺🇳 نرخ آزاد' + (freeRate ? ' — زنده: ' + freeRate.toLocaleString('fa-IR') + ' ریال' : '') + '</option>' +
      '<option value="agreed">🤝 توافقی / سایر</option>';
    ptfDialog({
      title: '💱 ثبت ' + (kind === 'in' ? 'دریافت' : 'پرداخت') + ' ریالی — سند ارزی (' + cur + ')',
      body: 'یا «درصد از مبلغ سند» را بدهید (مبلغ ارزی سهم × نرخ = ریالی خودکار) یا مستقیم مبلغ ریالی را. نرخ قطعی = نرخی که شما تایید می‌کنید.' + (totalFx ? '<br>مبلغ کل سند: <b dir="ltr">' + totalFx.toLocaleString('en-US') + ' ' + cur + '</b>' : ''),
      fields: [
        { id: 'pct', label: '٪ درصد از مبلغ سند (اختیاری — مثلا 30)', type: 'number', dir: 'ltr' },
        { id: 'rtype', label: 'مبنای نرخ تسعیر', type: 'select', optionsHtml: rateOpts },
        { id: 'rate', label: 'نرخ تسعیر (ریال per ' + cur + ') * — با انتخاب آزاد نرخ زنده پیشنهاد می‌شود، قابل اصلاح', type: 'number', value: freeRate || '', dir: 'ltr', required: true },
        { id: 'amt', label: 'مبلغ ریالی (ریال) — خالی بگذارید تا از درصد×نرخ محاسبه شود', type: 'number', dir: 'ltr' },
        { id: 'note', label: 'یادداشت (شماره فیش/تاریخ ارزش)' }
      ],
      okText: 'ثبت تراکنش',
      onOk: function (v) {
        var rate = +v.rate || 0;
        if (!rate) { alert('⛔ نرخ تسعیر الزامی است'); return; }
        var rtype = v.rtype || 'agreed';
        var amt = +v.amt || 0;
        var pct = +v.pct || 0;
        var fxShare = 0;
        if (!amt && pct > 0 && totalFx > 0) {
          /* مسیر درصدی (مثال کارفرما): سهم ارزی = ٪ × کل سند؛ ریالی = سهم × نرخ */
          fxShare = +(totalFx * pct / 100).toFixed(2);
          amt = Math.round(fxShare * rate);
        }
        if (!amt) { alert('⛔ یا مبلغ ریالی بدهید یا درصد از مبلغ سند (سند باید مبلغ ارزی داشته باشد)'); return; }
        var fxAmt = fxShare || +(amt / rate).toFixed(2);
        cb({ amt: amt, rate: rate, rateType: rtype, pct: pct || 0, fxAmt: fxAmt, cur: cur, note: v.note || '', t: faDate(), by: curSession().name });
        if (typeof ptfToast === 'function') ptfToast('✅ ' + (pct ? pct + '٪ سند = ' : 'معادل ارزی: ') + fxAmt.toLocaleString('en-US') + ' ' + cur + ' × ' + rate.toLocaleString('fa-IR') + ' (' + (rtype === 'free' ? 'آزاد' : 'توافقی') + ') = ' + amt.toLocaleString('fa-IR') + ' ریال', 'ok');
      }
    });

  };

  /* جمع‌بندی تسویه ارزی یک فاکتور: {paidIrr, paidFx, remainFx, avgRate} */
  window.ptfFxInvoiceSummary = function (inv, offerNo) {
    var cur = ptfFxCurOf(offerNo || inv.offerNo);
    if (!cur) return null;
    var o = getData('ptf_crm_offers').filter(function (x) { return x.no === (offerNo || inv.offerNo); })[0];
    var totalFx = o ? (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : 0;
    var paidIrr = 0, paidFx = 0;
    ((inv.pays || []).concat(inv.payments || []).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : function(){return true})).forEach(function (p) {
      if (window.PTF_SALES_DOMAIN_V2 && (p.fromAdvance || p.migratedToReceiptId || p.financialProjectionDisabled)) return;
      paidIrr += +p.amt || 0;
      if (p.fx && p.fx.fxAmt) paidFx += +p.fx.fxAmt;
      else if (p.fx && p.fx.rate) paidFx += (+p.amt || 0) / (+p.fx.rate || 1);
    });
    /* v35: معادل ارزی هر Receipt Snapshot است؛ سهم تخصیص‌یافته به این فاکتور
       با همان نرخ تاریخی نمایش داده می‌شود، اما مطالبات نهایی فقط ریالی است. */
    try {
      var invId = String(inv._id || inv.cd || ''), receipts = {};
      (getData('ptf_crm_case_receipts') || []).forEach(function (r) { if (r && r.status === 'posted' && !r.voided) receipts[String(r._id || r.cd || '')] = r; });
      (getData('ptf_crm_receipt_allocations') || []).forEach(function (a) {
        if (!a || a.invoiceId !== invId || a.status === 'void' || a.status === 'replaced' || a.status === 'deleted') return;
        var r = receipts[String(a.receiptId || '')] || {}, amt = +a.amountIRR || 0, rate = +r.fxRate || 0;
        paidIrr += amt; if (rate > 0) paidFx += amt / rate;
      });
    } catch (eV2) {}
    return {
      cur: cur, totalFx: totalFx, paidIrr: paidIrr,
      paidFx: +paidFx.toFixed(2),
      remainFx: +(totalFx - paidFx).toFixed(2),
      avgRate: paidFx > 0 ? Math.round(paidIrr / paidFx) : 0
    };
  };

  /* hook روی ثبت پرداخت فاکتور: اگر سند ارزی است، نرخ تسعیر بگیر */
  function patchInvPay() {
    var fns = ['invAddPay', 'addInvoicePay', 'invPay', 'savePay'];
    for (var i = 0; i < fns.length; i++) {
      var nm = fns[i];
      if (typeof window[nm] === 'function' && !window['_fx_' + nm]) {
        (function (nm, orig) {
          window['_fx_' + nm] = true;
          window[nm] = function (a, b, c) {
            try {
              var invs = getData('ptf_crm_invoices');
              var inv = invs.filter(function (x) { return x.cd === a || x.no === a || x.offerNo === a; })[0];
              var cur = inv ? ptfFxCurOf(inv.offerNo) : null;
              if (cur) {
                // مسیر ارزی: دیالوگ تسعیر به جای جریان عادی
                ptfFxPayDialog('in', inv.offerNo, cur, function (fx) {
                  var invs2 = getData('ptf_crm_invoices');
                  var inv2 = invs2.filter(function (x) { return x.cd === inv.cd; })[0];
                  inv2.pays = inv2.pays || [];
                  inv2.pays.push({ amt: fx.amt, t: fx.t, by: fx.by, note: fx.note, fx: fx });
                  setData('ptf_crm_invoices', invs2);
                  audit('مطالبات', 'دریافت ریالی با تسعیر ' + fx.rate + ' (معادل ' + fx.fxAmt + ' ' + cur + ')', inv.cd || '');
                  if (typeof renderReceivables === 'function') renderReceivables();
                  if (typeof renderInvoices === 'function') renderInvoices();
                });
                return; // جریان عادی اجرا نشود
              }
            } catch (e) {}
            return orig(a, b, c);
          };
        })(nm, window[nm]);
        return true;
      }
    }
    return false;
  }
  var pt = 0;
  var pi = setInterval(function () { pt++; if (patchInvPay() || pt > 40) clearInterval(pi); }, 500);

  /* ===================================================================
     v16.0 (US-390 — طرح مصوب تیم متخصص): موتور واحد سود ریالی پروژه
     اصل طلایی: سود همیشه به «ریال واقعی» و فقط از اجزای قطعی محاسبه می‌شود؛
     هر جزء نامشخص (دریافت تسعیرنشده/خرید ارزی بدون نرخ) وارد عدد نمی‌شود
     بلکه صریحا به‌عنوان «آیتم ناقص» گزارش می‌شود → خروجی همیشه قابل اعتماد،
     هرگز عدد غلط. حالات پوشش‌داده:
     ① فروش ریالی + خرید ریالی (ساده)
     ② فروش ارزی (دریافت ریالی با نرخ سنا در روز تسویه — از pays[].fx موجود US-266v2)
     ③ خرید ریالی یا خرید ارز آزاد (purchases[].cur/rate جدید)
     ④ ترکیب هر سه + چند فاکتور/چند خرید + رکوردهای قدیمی بدون فیلدهای جدید
     =================================================================== */
  window.ptfProjectProfitIRR = function (prj) {
    var res = {
      ok: true, complete: true, warnings: [],
      sellIrr: 0, sellSrc: '', sellCur: 'IRR',
      sellFxTotal: 0, sellFxPaid: 0, sellFxRemain: 0, sellAvgRate: 0,
      buyIrr: 0, buyItems: 0, buyPendingFx: [], buyUnmatched: [], /* خریدهای ارزی بدون نرخ / بدون provenance */
      /* v34.5.38 ضد دوباره‌شماری: شناسه‌های فاکتور خریدِ شمارش‌شده را برای لایهٔ سود
         برمی‌گردانیم تا هزینه‌ی دستی/پسابایگانیِ لینک‌شده به همان فاکتور، دوباره کسر نشود. */
      buyInvoiceCds: [], buySourcePurchaseCds: [], buyLegacyPayableCds: [],
      profit: null, pct: null
    };
    if (!prj) { res.ok = false; return res; }
    /* v34.4.65: پرونده با فاکتور متمم چند offer/فاکتور دارد. نسخهٔ قبلی فقط
       prj.offerNo (= wonOffer = معمولاً متمم) را می‌دید و فروش را ناقص حساب می‌کرد. */
    var offerNos = {};
    function addOffNo(n) { if (n) offerNos[String(n)] = true; }
    addOffNo(prj.offerNo); addOffNo(prj.wonOffer);
    try {
      var dealLike = prj;
      if (!dealLike.inqNo || !dealLike.wonOffer) {
        var deals = getData('ptf_crm_deals') || [];
        var hit = deals.filter(function (d) {
          return (prj.cd && (d.cd === prj.cd || d.cd === prj.no)) || (prj.inqNo && d.inqNo === prj.inqNo);
        })[0];
        if (hit) dealLike = hit;
      }
      addOffNo(dealLike.wonOffer); addOffNo(dealLike.offerNo);
      if (typeof window.ptfSalesFileOffers === 'function') {
        window.ptfSalesFileOffers(dealLike).forEach(function (o) { if (o) addOffNo(o.no); });
      }
    } catch (eOff) {}
    var offerNoList = Object.keys(offerNos);
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === prj.offerNo; })[0]
      || getData('ptf_crm_offers').filter(function (x) { return offerNoList.indexOf(x.no) > -1; })[0];
    var invsRaw = getData('ptf_crm_invoices').filter(function (v) {
      if (!v || v.status === 'void' || v.st === 'void' || v.void === true) return false;
      if (v.offerNo && offerNoList.indexOf(String(v.offerNo)) > -1) return true;
      if (prj.inqNo && (v.inqNo === prj.inqNo || v.dealInq === prj.inqNo)) return true;
      if (prj.cd && (v.dealCd === prj.cd || v.dealRef === prj.cd || v.projectCd === prj.cd)) return true;
      return false;
    });
    var officialByOffer = {};
    invsRaw.forEach(function (v) { if (!v.isUnofficial && v.offerNo) officialByOffer[v.offerNo] = true; });
    var invs = invsRaw.filter(function (v) {
      return !(v.isUnofficial && v.offerNo && officialByOffer[v.offerNo]);
    });
    var cur = (offer && offer.currency && offer.currency !== 'IRR') ? offer.currency : null;
    res.sellCur = cur || 'IRR';

    /* ---------- سمت فروش: فقط مبلغ خالص فاکتور صادره ----------
       تا صدور فاکتور فروش سود اعلام نمی‌شود. وصولی/پیش‌پرداخت فروش نیست. */
    function invoiceNetIrr(inv) {
      if (!inv) return 0;
      /* LC-01 (v34.7.21): سند غیرفعال (void/superseded/replaced) فروش نمی‌سازد. */
      if (window.PTF && window.PTF.ar && typeof window.PTF.ar.activeInvoice === 'function' && !window.PTF.ar.activeInvoice(inv)) return 0;
      var amt = +inv.amount || 0;
      if (!amt) amt = (+inv.base || 0) + (+inv.vat || 0);
      var disc = +inv.discount || 0;
      /* اگر تخفیف جداست و هنوز از مبلغ کم نشده */
      if (disc > 0 && amt >= disc && Math.abs(amt - ((+inv.base || 0) + (+inv.vat || 0))) < 1) amt = amt - disc;
      /* LC-02 (v34.7.21): مرجوعی فروش از فروشِ شناسایی‌شده کسر می‌شود (تصویب کارفرما ۱۴۰۵/۰۵/۲۶)؛
         پیش از این سود پروژه با کالای برگشت‌خورده متورم می‌ماند. */
      var returned = (window.PTF && window.PTF.ar && typeof window.PTF.ar.returnedAmountIRR === 'function') ? window.PTF.ar.returnedAmountIRR(inv) : 0;
      amt = amt - returned;
      return amt > 0 ? amt : 0;
    }
    var invSum = invs.reduce(function (s2, v) { return s2 + invoiceNetIrr(v); }, 0);
    if (invSum > 0) {
      res.sellIrr = invSum;
      res.sellSrc = 'مبلغ خالص فاکتور فروش (' + invs.length + ' سند)';
      if (cur) {
        var totalFx = offer ? (offer.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0) : 0;
        var paidIrr = 0, paidFx = 0;
        invs.forEach(function (inv) {
          var pays = (inv.pays || []).concat(inv.payments || []).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : function () { return true; }).filter(function (p) { return !(window.PTF_SALES_DOMAIN_V2 && (p.fromAdvance || p.migratedToReceiptId || p.financialProjectionDisabled)); });
          pays.forEach(function (pp) {
            var amt = +pp.amt || 0;
            if (!amt) return;
            paidIrr += amt;
            if (pp.fx && (+pp.fx.fxAmt || +pp.fx.rate)) paidFx += (+pp.fx.fxAmt) || (amt / (+pp.fx.rate));
          });
        });
        try {
          var invIds = {}, receiptMap = {};
          invs.forEach(function (iv) { invIds[String(iv._id || iv.cd || '')] = true; });
          (getData('ptf_crm_case_receipts') || []).forEach(function (r) { if (r && r.status === 'posted' && !r.voided) receiptMap[String(r._id || r.cd || '')] = r; });
          (getData('ptf_crm_receipt_allocations') || []).forEach(function (a) {
            if (!a || !invIds[String(a.invoiceId || '')] || a.status === 'void' || a.status === 'replaced' || a.status === 'deleted') return;
            var r = receiptMap[String(a.receiptId || '')] || {}, amt = +a.amountIRR || 0, rate = +r.fxRate || 0;
            paidIrr += amt; if (rate > 0) paidFx += amt / rate;
          });
        } catch (eAlloc) {}
        res.sellFxTotal = totalFx;
        res.sellFxPaid = +paidFx.toFixed(2);
        res.sellFxRemain = +(totalFx - paidFx).toFixed(2);
        res.sellAvgRate = paidFx > 0 ? Math.round(paidIrr / paidFx) : 0;
        if (res.sellFxRemain > 0.01) res.warnings.push('ℹ️ مانده ارزی وصول‌نشده اطلاعاتی است؛ سود از مبلغ خالص فاکتور است نه از وصولی/پیش‌پرداخت.');
      }
    } else {
      res.sellIrr = 0;
      res.sellSrc = '';
      res.ok = false;
      res.complete = false;
      res.warnings.push('⛔ تا صدور فاکتور فروش، سود این پرونده قابل محاسبه نیست.');
    }

    /* ---------- سمت خرید (فاز ۵ — مورد A تأییدشده) ----------
       تعریف کارفرما: «ورود قیمت خرید در پرونده اختیاری و فقط برای بررسی صحت فاکتور خرید است؛
       مبنای تعهد و هزینه، فاکتور خرید ثبت‌شده است؛ خریدِ تعهدی معنا ندارد.»
       لذا مبنای هزینهٔ پروژه از فاکتورهای خریدِ لینک‌شده (legacyPayableCds→payable.inqNo،
       itemLinks.offerNo، یا inqNo/offerNo مستقیم) خوانده می‌شود. قیمت دستی (buycmp.purchases)
       فقط به‌عنوان «کنترل مغایرت» است و نبودِ آن سود را ناقص نمی‌کند. */
    var invCost = 0, invCount = 0, invMatched = 0, invCoverCount = 0, invCoverBenefit = 0;
    var sfA = {};
    try { sfA = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance') || '{}'); if (!sfA || Array.isArray(sfA)) sfA = {}; } catch (eSfA) {}
    var payablesA = getData('ptf_crm_payables') || [];
    var projKeys = [prj.inqNo, prj.offerNo, prj.wonOffer, prj.no, prj.cd].concat(offerNoList).filter(Boolean);
    (sfA.invoices || []).forEach(function (i) {
      if (!i || i.status === 'void') return;
      var viaLegacy = (i.legacyPayableCds || []).some(function (cd) { var p = payablesA.filter(function (x) { return x.cd === cd; })[0]; return p && projKeys.indexOf(p.inqNo) > -1; });
      var viaItems = (i.itemLinks || []).some(function (l) { return projKeys.indexOf(l.offerNo) > -1 || projKeys.indexOf(l.inqNo) > -1; });
      var viaDirect = projKeys.indexOf(i.inqNo) > -1 || projKeys.indexOf(i.offerNo) > -1;
      if (!(viaLegacy || viaItems || viaDirect)) return;
      var amt = (i.cur && i.cur !== 'IRR') ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0);
      /* provenance ضد دوباره‌شماری — حتی فاکتور پوششی هم ثبت می‌شود تا لینک دستی به آن رد شود */
      if (i.cd != null) res.buyInvoiceCds.push(i.cd);
      if (i.sourcePurchaseCd != null) res.buySourcePurchaseCds.push(i.sourcePurchaseCd);
      (i.legacyPayableCds || []).forEach(function (lc) { if (lc != null) res.buyLegacyPayableCds.push(lc); });
      if (i.isCover === true) {
        var comm = (+i.coverCommissionAmount != null && +i.coverCommissionAmount > 0) ? (+i.coverCommissionAmount || 0) : Math.round(amt * (+i.coverCommissionPct || 0) / 100);
        var vat = (+i.coverVatAmount != null && +i.coverVatAmount > 0) ? (+i.coverVatAmount || 0) : Math.round(amt * (+i.coverVatPct || 0) / 100);
        invCost += comm; invCount++; invMatched++; invCoverCount++; invCoverBenefit += (vat - comm);
        res.warnings.push('ℹ️ فاکتور پوششی ' + (i.no || '') + ' لینک‌شده به پرونده: کارمزد ' + comm.toLocaleString('fa-IR') + ' هزینه و اعتبار ارزش‌افزوده ' + vat.toLocaleString('fa-IR') + ' منفعت (اثر خالص در سطح سال مالی).');
        return;
      }
      invCost += amt; invCount++; invMatched++;
    });
    /* قیمت دستی = فقط کنترل (مغایرت‌سنجی با فاکتور) — نه مبنای هزینهٔ قطعی */
    var priceCost = 0, priceCount = 0, priceUnmatched = 0;
    getData('ptf_crm_buycmp').forEach(function (c2) {
      if (c2.inqNo !== prj.inqNo && c2.inqNo !== prj.offerNo) return;
      (c2.purchases || []).forEach(function (pu) {
        var link = (typeof window.ptfResolveItemForPurchase === 'function') ? window.ptfResolveItemForPurchase(c2, pu) : { ok: false, reason: 'resolver' };
        var qty = link && link.item ? (+link.item.qty || 1) : (+pu.qty || 1);
        var unit = +pu.price || 0;
        var lineCost = unit * qty;
        if (pu.cur && pu.cur !== 'IRR' && +pu.rate > 0) lineCost = unit * (+pu.rate) * qty;
        if (lineCost > 0) { priceCost += lineCost; priceCount++; if (!link.ok) priceUnmatched++; }
      });
    });
    if (invMatched > 0) {
      /* مبنای هزینه = فاکتور خرید (قطعی) */
      res.buyIrr = invCost; res.buyItems = invCount; res.buySrc = 'فاکتور خرید تأمین‌کننده (' + invCount + ' فاکتور)';
      if (priceCount > 0 && Math.abs(priceCost - invCost) > 1) {
        res.warnings.push('⚠️ [کنترل صحت] مجموع قیمت‌های خریدِ دستی پرونده (' + priceCost.toLocaleString('fa-IR') + ') با مجموع فاکتورهای خرید (' + invCost.toLocaleString('fa-IR') + ') مغایرت دارد — مبنای هزینه فاکتور خرید است و قیمت دستی فقط برای بررسی است (مغایرت مانع محاسبه نیست).');
      }
    } else {
      /* مبنای هزینه باید فاکتور خرید باشد؛ بدون آن، هزینه قطعی نیست و سود اعلام نمی‌شود.
         قیمت دستی (حتی با provenance) فقط کنترل است و جایگزین فاکتور خرید نیست. */
      res.complete = false;
      res.warnings.push('ℹ️ برای این پرونده فاکتور خریدِ لینک‌شده ثبت نشده — مبنای هزینه و تعهد، فاکتور خرید است؛ تا ثبت/لینک فاکتور خرید، سود این پرونده قطعی نیست.' + (priceCount ? ' (قیمت دستی ' + priceCost.toLocaleString('fa-IR') + ' ریال فقط برای کنترل است و مبنای هزینه نیست.)' : ''));
    }

    /* ---------- سود ---------- */
    if (res.ok && res.complete && res.sellIrr > 0) {
      res.profit = res.sellIrr - res.buyIrr; /* هزینه جانبی جدا اضافه می‌شود */
      res.pct = Math.round(res.profit * 100 / res.sellIrr);
    }
    return res;
  };

  /* خرید ارزی: در ثبت خرید نهایی (cmpBuy) اگر کاربر بخواهد، نرخ تسعیر پرداخت */
  window.ptfFxBuyNote = function (price, cur, rate) {
    if (!cur || !rate) return '';
    return ' (' + (+price).toLocaleString('en-US') + ' ' + cur + ' × ' + (+rate).toLocaleString('fa-IR') + ')';
  };

  /* ===================================================================
     v16.1 (US-391): ویجت نرخ لحظه‌ای ارز روی داشبورد (دلار/یورو آزاد)
     - منبع: پروکسی سروری خودی api/fx-rates.php (کش ۱۰دقیقه‌ای + stale-if-error)
     - فقط اطلاع‌رسانی؛ مبنای اسناد همچنان نرخی است که کاربر در تراکنش تایید می‌کند
     - آفلاین/قطعی منبع → آخرین نرخ با برچسب «قدیمی»؛ ویجت هرگز داشبورد را نمی‌شکند
     v33.4.2 (دستور صریح کارفرما): «نرخ سنا کلا اشتباه است — اگر عدد درست از منابع
     معتبر قابل دسترسی نیست کلا کنار گذاشته شود». بررسی زنده‌ی منابع نشان داد از
     ۲۲ دی ۱۴۰۴ نرخ «اسکناس سنا» توسط بانک مرکزی رسماً حذف شده و صفحه‌ی TGJU که
     fx-rates.php به‌عنوان fallback به آن متکی بود، از همان تاریخ منجمد مانده (هرگز
     به‌روزرسانی نمی‌شود) — دقیقاً همان چیزی که کارفرما مشاهده کرده بود. بنابراین
     نمایش/تلاش برای دریافت سنا کاملاً حذف شد؛ فقط نرخ آزاد (که زنده و صحیح است)
     نمایش داده می‌شود.
     =================================================================== */
  window._ptfFxLive = null; /* آخرین نرخ‌ها برای پیشنهاد در دیالوگ تسعیر */
  var _fxLoading = false;
  var _fxLastLoadTs = 0;
  function fxTickerContentHtml(d) {
    if (!d || !d.ok || !d.rates) {
      return '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#d97706;font-size:11.5px">⚠️ منبع نرخ فعلا در دسترس نیست — بعدا خودکار تلاش می‌شود</span>';
    }
    var R = d.rates;
    var stale = d.cache === 'stale' ? '<span class="bd" style="background:#fef3c7;color:#b45309" title="منبع فعلا قطع است — آخرین نرخ دریافتی">⏳ قدیمی (' + (d.staleMin || '?') + ' دقیقه پیش)</span>' : '';
    var usdCny = R.usd_cny
      ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">دلار→یوآن 🔁</small><b style="direction:ltr;color:#b45309">' + (+R.usd_cny).toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + ' <small>¥</small></b></span>' : '';
    var goldRial = R.gold18_rial
      ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">طلا ۱۸ عیار (گرم) 🥇</small><b style="direction:ltr;color:#b45309">' + (+R.gold18_rial).toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' <small>ریال</small></b></span>' : '';
    var eurUsd = R.eur_usd
      ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">یورو→دلار 🔁</small><b style="direction:ltr;color:#0e7490">' + (+R.eur_usd).toLocaleString('fa-IR', { maximumFractionDigits: 4 }) + ' <small>$</small></b></span>' : '';
    return '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b>' +
      fxCell('دلار آزاد 🇺🇸', R.usd_free, '#059669') +
      fxCell('یورو آزاد 🇪🇺', R.eur_free, '#0e7490') +
      fxCell('یوان آزاد 🇨🇳', R.cny_free, '#dc2626') +
      fxCell('حواله یوان 🧾', R.cny_hav, '#dc2626') +
      usdCny + goldRial + eurUsd +
      stale +
      '<span style="margin-right:auto;color:#94a3b8;font-size:10.5px">' + (d.t || '') +
      (d.src_market ? ' | بازار: ' + d.src_market : '') +
      ' | صرفا اطلاع‌رسانی؛ مبنای اسناد: نرخ تاییدی شما</span>';
  }
  function fxTickerHtml() {
    var cached = window._ptfFxLive;
    if (!cached) {
      try {
        var str = sessionStorage.getItem('ptf_fx_live_cache') || localStorage.getItem('ptf_fx_live_cache');
        if (str) cached = JSON.parse(str);
      } catch (e) {}
    }
    if (cached && cached.ok && cached.rates) {
      window._ptfFxLive = cached;
      return '<div id="fxTicker" data-noix style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:10px 16px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px">' +
        fxTickerContentHtml(cached) + '</div>';
    }
    return '<div id="fxTicker" data-noix style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:10px 16px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px">' +
      '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#94a3b8;font-size:11.5px">در حال دریافت…</span></div>';
  }
  function fxCell(lb, v, cl) {
    if (!v) return '';
    return '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">' + lb + '</small><b style="color:' + (cl || 'var(--tx,#1e293b)') + ';direction:ltr">' + (+v).toLocaleString('fa-IR') + ' <small>ریال</small></b></span>';
  }
  window.ptfFxTickerLoad = function (force) {
    var el = document.getElementById('fxTicker');
    if (!el) return;
    var now = Date.now();
    if (!force && window._ptfFxLive && (now - _fxLastLoadTs) < 60000) {
      el.innerHTML = fxTickerContentHtml(window._ptfFxLive);
      return;
    }
    if (_fxLoading && !force) return;
    _fxLoading = true;
    fetch('../api/fx-rates.php?action=rates' + (force ? '&force=1' : ''))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _fxLoading = false;
        _fxLastLoadTs = Date.now();
        var el2 = document.getElementById('fxTicker');
        if (!el2) return;
        if (!d.ok || !d.rates) {
          el2.innerHTML = fxTickerContentHtml(d);
          return;
        }
        window._ptfFxLive = d;
        try {
          var str = JSON.stringify(d);
          sessionStorage.setItem('ptf_fx_live_cache', str);
          localStorage.setItem('ptf_fx_live_cache', str);
        } catch (eC) {}
        el2.innerHTML = fxTickerContentHtml(d);
      })
      .catch(function () {
        _fxLoading = false;
        var el2 = document.getElementById('fxTicker');
        if (el2 && !window._ptfFxLive) el2.innerHTML = '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#94a3b8;font-size:11.5px">🔴 آفلاین</span>';
      });
  };
  /* v16.9: تست منبع نرخ برای ادمین — پاسخ خام fx-rates.php را نشان می‌دهد تا «مشکل کد» از «مشکل منبع/هاست» فوری تفکیک شود */
  window.ptfFxDiag = function () {
    fetch('../api/fx-rates.php?action=rates&force=1')
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var pretty = t;
        try { pretty = JSON.stringify(JSON.parse(t), null, 2); } catch (e) {}
        var esc2 = function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
        var _dz = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(4000) : 4000;
        var html = '<div class="md-b" id="ptfFxDiagDlg" style="display:grid;z-index:' + _dz + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:640px;max-height:90vh;overflow:auto">' +
          '<h3>🔬 تست منبع نرخ ارز (fx-rates.php)</h3>' +
          '<div style="font-size:12px;color:#64748b;margin-bottom:8px">پاسخ خام سرور (force=1 — بدون کش). v33.4.2: فقط منبع نرخ آزاد (TGJU) — نرخ سنا/ICE به دستور کارفرما کاملاً حذف شد (منبع منسوخ/منجمد از ۲۲ دی ۱۴۰۴).</div>' +
          '<pre style="direction:ltr;text-align:left;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:10px;font-size:11px;max-height:50vh;overflow:auto">' + esc2(pretty) + '</pre>' +
          '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
        (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
        try { var _fd = document.getElementById('ptfFxDiagDlg'); if (_fd && window.ptfElevateModal) window.ptfElevateModal(_fd); } catch (eD) {}
      })
      .catch(function (e) { alert('خطا در تماس با fx-rates.php: ' + e.message); });
  };

  /* hook داشبورد: ویجت بالای آمار قدیم (بعد از قیف US-350 — زنجیره hook سالم می‌ماند) */
  function hookFxDash() {
    if (window._fxDashHooked) return true;
    if (typeof window.buildDashboard !== 'function') return false;
    window._fxDashHooked = true;
    var _bd = window.buildDashboard;
    window.buildDashboard = function () {
      var h = _bd();
      var w = fxTickerHtml();
      setTimeout(function () { try { ptfFxTickerLoad(); } catch (e) {} }, 200);
      if (!window._fxTickerT) window._fxTickerT = setInterval(function () { try { ptfFxTickerLoad(); } catch (e) {} }, 600000); /* هر ۱۰ دقیقه اگر داشبورد باز است */
      return w + h; /* v16.3 (ابلاغ کارفرما): نوار ارز در بالاترین نقطه داشبورد */
    };
    return true;
  }
  var fxdT = 0;
  var fxdI = setInterval(function () { fxdT++; if (hookFxDash() || fxdT > 50) clearInterval(fxdI); }, 350);
  hookFxDash();

  /* دیالوگ تسعیر: نمایش نرخ‌های زنده به‌عنوان راهنما (پیشنهاد — تصمیم با کاربر) */
  var _fxDlgOrig = window.ptfFxPayDialog;
  window.ptfFxPayDialog = function (kind, refNo, cur, cb) {
    try {
      var d = window._ptfFxLive;
      if (d && d.rates) {
        var R = d.rates;
        var hint = 'آزاد ' + ((cur === 'USD' ? R.usd_free : R.eur_free) || 0).toLocaleString('fa-IR');
        if (typeof ptfToast === 'function') ptfToast('💱 نرخ زنده ' + cur + ' (ریال): ' + hint + (d.cache === 'stale' ? ' (قدیمی)' : ''), 'info');
      }
    } catch (e) {}
    return _fxDlgOrig(kind, refNo, cur, cb);
  };


  /* نمایش خلاصه ارزی در کارت مطالبات (تزریق پس از رندر — hook) */
  function patchRecvRender() {
    if (typeof window.renderReceivables !== 'function' || window._fxRecvPatched) return false;
    window._fxRecvPatched = true;
    var orig = window.renderReceivables;
    window.renderReceivables = function () {
      orig();
      try {
        var invs = getData('ptf_crm_invoices');
        document.querySelectorAll('#rcWrap [data-inv], #rcWrap .rc-card').forEach(function () {});
        // خلاصه کلی بالای پنل
        var wrap = document.getElementById('rcWrap');
        if (!wrap || document.getElementById('fxSummary')) return;
        var rows = [];
        invs.forEach(function (inv) {
          var s = ptfFxInvoiceSummary(inv);
          if (s && s.totalFx) rows.push({ inv: inv, s: s });
        });
        if (!rows.length) return;
        var h = '<div id="fxSummary" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:12.5px">' +
          '<b>💱 اسناد ارزی (تسویه ریالی با نرخ روز):</b><div class="tb2" style="margin-top:6px"><table><thead><tr><th>فاکتور</th><th>مبلغ سند</th><th>دریافتی ریالی</th><th>معادل ارزی دریافتی</th><th>مانده ارزی</th><th>میانگین نرخ</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td>' + escP(r.inv.cd || r.inv.offerNo || '') + '</td><td>' + r.s.totalFx.toLocaleString('en-US') + ' ' + r.s.cur + '</td>' +
              '<td>' + r.s.paidIrr.toLocaleString('fa-IR') + ' ریال</td><td>' + r.s.paidFx.toLocaleString('en-US') + ' ' + r.s.cur + '</td>' +
              '<td style="' + (r.s.remainFx > 0 ? 'color:#dc2626;font-weight:800' : 'color:#059669') + '">' + r.s.remainFx.toLocaleString('en-US') + ' ' + r.s.cur + '</td>' +
              '<td>' + (r.s.avgRate ? r.s.avgRate.toLocaleString('fa-IR') + ' ریال' : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
        wrap.insertAdjacentHTML('afterbegin', h);
      } catch (e) {}
    };
    return true;
  }
  var rt = 0;
  var ri = setInterval(function () { rt++; if (patchRecvRender() || rt > 40) clearInterval(ri); }, 500);
})();
