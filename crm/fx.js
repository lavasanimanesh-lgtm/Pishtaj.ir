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
     v17.4 (US-414 — کیس R8): نوع نرخ (آزاد/سنا/توافقی) با نرخ زنده + ورود درصدی از مبلغ سند.
     مثال کارفرما: سند 1500$ و مشتری ۳۰٪ می‌پردازد → ۴۵۰$ × نرخ انتخابی = مبلغ ریالی؛ ۷۰٪ باقی در مطالبات. */
  window.ptfFxPayDialog = function (kind, refNo, cur, cb) {
    /* مبلغ ارزی کل سند (برای ورود درصدی) */
    var totalFx = 0;
    try {
      var oRef = getData('ptf_crm_offers').filter(function (x) { return x.no === refNo; })[0];
      if (oRef) totalFx = (oRef.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0);
    } catch (eT) {}
    /* نرخ‌های زنده آزاد/سنا از ویجت fx (اطلاعی — تصمیم با کاربر) */
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var freeRate = cur === 'USD' ? (+L.usd_free || 0) : cur === 'EUR' ? (+L.eur_free || 0) : 0;
    var sanaRate = cur === 'USD' ? (+L.usd_sana_sell || +L.usd_sana_buy || 0) : cur === 'EUR' ? (+L.eur_sana_sell || +L.eur_sana_buy || 0) : 0;
    var rateOpts =
      '<option value="free">🇺🇳 نرخ آزاد' + (freeRate ? ' — زنده: ' + freeRate.toLocaleString('fa-IR') + ' ریال' : '') + '</option>' +
      '<option value="sana">🏦 نرخ سنا' + (sanaRate ? ' — زنده: ' + sanaRate.toLocaleString('fa-IR') + ' ریال' : '') + '</option>' +
      '<option value="agreed">🤝 توافقی / سایر</option>';
    ptfDialog({
      title: '💱 ثبت ' + (kind === 'in' ? 'دریافت' : 'پرداخت') + ' ریالی — سند ارزی (' + cur + ')',
      body: 'یا «درصد از مبلغ سند» را بدهید (مبلغ ارزی سهم × نرخ = ریالی خودکار) یا مستقیم مبلغ ریالی را. نرخ قطعی = نرخی که شما تایید می‌کنید.' + (totalFx ? '<br>مبلغ کل سند: <b dir="ltr">' + totalFx.toLocaleString('en-US') + ' ' + cur + '</b>' : ''),
      fields: [
        { id: 'pct', label: '٪ درصد از مبلغ سند (اختیاری — مثلا 30)', type: 'number', dir: 'ltr' },
        { id: 'rtype', label: 'مبنای نرخ تسعیر', type: 'select', optionsHtml: rateOpts },
        { id: 'rate', label: 'نرخ تسعیر (ریال per ' + cur + ') * — با انتخاب آزاد/سنا نرخ زنده پیشنهاد می‌شود، قابل اصلاح', type: 'number', value: freeRate || '', dir: 'ltr', required: true },
        { id: 'amt', label: 'مبلغ ریالی (ریال) — خالی بگذارید تا از درصد×نرخ محاسبه شود', type: 'number', dir: 'ltr' },
        { id: 'note', label: 'یادداشت (شماره فیش/تاریخ ارزش)' }
      ],
      okText: 'ثبت تراکنش',
      onOk: function (v) {
        var rate = +v.rate || 0;
        if (!rate) { alert('⛔ نرخ تسعیر الزامی است'); return; }
        var rtype = v.rtype || 'agreed';
        /* اگر آزاد/سنا انتخاب شده و کاربر نرخ را دست نزده، نرخ زنده همان انتخاب مبنا شود */
        if (rtype === 'sana' && sanaRate && rate === freeRate) rate = sanaRate;
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
        if (typeof ptfToast === 'function') ptfToast('✅ ' + (pct ? pct + '٪ سند = ' : 'معادل ارزی: ') + fxAmt.toLocaleString('en-US') + ' ' + cur + ' × ' + rate.toLocaleString('fa-IR') + ' (' + (rtype === 'free' ? 'آزاد' : rtype === 'sana' ? 'سنا' : 'توافقی') + ') = ' + amt.toLocaleString('fa-IR') + ' ریال', 'ok');
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
    ((inv.pays || []).concat(inv.payments || [])).forEach(function (p) {
      paidIrr += +p.amt || 0;
      if (p.fx && p.fx.fxAmt) paidFx += +p.fx.fxAmt;
      else if (p.fx && p.fx.rate) paidFx += (+p.amt || 0) / (+p.fx.rate || 1);
    });
    return {
      cur: cur, totalFx: totalFx, paidIrr: paidIrr,
      paidFx: +paidFx.toFixed(2),
      remainFx: +(totalFx - paidFx).toFixed(2),
      avgRate: paidFx > 0 ? Math.round(paidIrr / paidFx) : 0
    };
  };

  /* hook روی ثبت پرداخت فاکتور: اگر سند ارزی است، نرخ تسعیر بگیر */
  function patchInvPay() {
    var fns = ['invAddPay', 'addInvoicePay', 'invPay'];
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
      profit: null, pct: null
    };
    if (!prj) { res.ok = false; return res; }
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === prj.offerNo; })[0];
    var invs = getData('ptf_crm_invoices').filter(function (v) { return v.offerNo === prj.offerNo; });
    var cur = (offer && offer.currency && offer.currency !== 'IRR') ? offer.currency : null;
    res.sellCur = cur || 'IRR';

    /* ---------- سمت فروش (به ریال واقعی) ---------- */
    if (cur) {
      /* حالت ②: سند ارزی — فروش ریالی = جمع دریافت‌های تسعیرشده (نرخ سنا روز تسویه) */
      var totalFx = offer ? (offer.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0) : 0;
      var paidIrr = 0, paidFx = 0, unratedPays = 0;
      invs.forEach(function (inv) {
        var pays = (inv.pays || []).concat(inv.payments || []); /* هر دو ساختار تاریخی */
        pays.forEach(function (pp) {
          var amt = +pp.amt || 0;
          if (!amt) return;
          paidIrr += amt;
          if (pp.fx && (+pp.fx.fxAmt || +pp.fx.rate)) paidFx += (+pp.fx.fxAmt) || (amt / (+pp.fx.rate));
          else unratedPays++;
        });
      });
      res.sellIrr = paidIrr;
      res.sellFxTotal = totalFx;
      res.sellFxPaid = +paidFx.toFixed(2);
      res.sellFxRemain = +(totalFx - paidFx).toFixed(2);
      res.sellAvgRate = paidFx > 0 ? Math.round(paidIrr / paidFx) : 0;
      res.sellSrc = 'دریافت‌های ریالی تسعیرشده (سنا — روز تسویه)';
      if (unratedPays) { res.complete = false; res.warnings.push('⚠️ ' + unratedPays + ' دریافت ریالی این سند ارزی «بدون نرخ تسعیر» ثبت شده — معادل ارزی آن‌ها نامشخص است (مانده ارزی دقیق نیست؛ در فروش ریالی لحاظ شده).'); }
      if (res.sellFxRemain > 0.01) { res.warnings.push('ℹ️ ' + res.sellFxRemain.toLocaleString('en-US') + ' ' + cur + ' هنوز وصول نشده — سود فعلی فقط بر مبنای وصولی‌های واقعی است و با وصول‌های بعدی بالا می‌رود.'); }
      if (!paidIrr) { res.ok = false; res.warnings.push('⛔ هنوز هیچ دریافت ریالی برای این سند ارزی ثبت نشده — سود ریالی قابل محاسبه نیست.'); }
    } else {
      /* حالت ①: سند ریالی — اولویت: فاکتور؛ نبود → جمع CO */
      var invSum = invs.reduce(function (s2, v) { return s2 + (+v.amount || 0); }, 0);
      if (invSum > 0) { res.sellIrr = invSum; res.sellSrc = 'فاکتور(های) ثبت‌شده'; }
      else {
        res.sellIrr = offer ? (offer.items || []).reduce(function (s2, it) { return s2 + (+it.qty || 0) * (+it.price || 0); }, 0) : (+prj.val || 0);
        res.sellSrc = res.sellIrr ? 'جمع پیشنهاد مالی (فاکتور هنوز ثبت نشده)' : '';
      }
      if (!res.sellIrr) { res.ok = false; res.warnings.push('⛔ مبلغ فروش ثبت نشده (CO/فاکتور).'); }
    }

    /* ---------- سمت خرید (به ریال واقعی) ---------- */
    getData('ptf_crm_buycmp').forEach(function (c2) {
      if (c2.inqNo !== prj.inqNo && c2.inqNo !== prj.offerNo) return;
      (c2.purchases || []).forEach(function (pu) {
        var link = (typeof window.ptfResolveItemForPurchase === 'function') ? window.ptfResolveItemForPurchase(c2, pu) : { ok: false, reason: 'resolver' };
        if (!link.ok) {
          res.complete = false;
          res.buyUnmatched.push({ nm: pu.item || pu.nm || '', price: +pu.price || 0, cur: pu.cur || 'IRR', reason: link.reason });
          return;
        }
        var it = link.item || {};
        var qty = +it.qty || 1;
        var unit = +pu.price || 0;
        var pCur = pu.cur || 'IRR';
        if (pCur === 'IRR') { res.buyIrr += unit * qty; res.buyItems++; }
        else if (+pu.rate > 0) { res.buyIrr += unit * (+pu.rate) * qty; res.buyItems++; } /* حالت ③: ارز آزاد × نرخ پرداخت */
        else {
          res.complete = false;
          res.buyPendingFx.push({ nm: it.nm || it.name || '', fx: unit * qty, cur: pCur });
        }
      });
    });
    /* مسیر قدیمی buyquotes فقط اگر هیچ خریدی از جدول مقایسه و بدون تطبیق نبود */
    if (!res.buyItems && !res.buyPendingFx.length && !res.buyUnmatched.length) {
      getData('ptf_crm_buyquotes').forEach(function (b) {
        if (b.ref === prj.inqNo && b.note && b.note.indexOf('خرید نهایی') > -1) { res.buyIrr += +b.price || 0; res.buyItems++; }
      });
    }
    if (res.buyPendingFx.length) {
      var pf = res.buyPendingFx.map(function (x) { return x.nm + ' (' + x.fx.toLocaleString('en-US') + ' ' + x.cur + ')'; }).join('، ');
      res.warnings.push('⛔ ' + res.buyPendingFx.length + ' خرید ارزی «بدون نرخ پرداخت ریالی» است: ' + pf + ' — تا ثبت نرخ، این اقلام در هزینه لحاظ نمی‌شوند و سود نمایشی بیش‌برآورد است. (قیمت‌های خرید → ثبت مجدد خرید با نرخ)');
    }
    if (res.buyUnmatched.length) {
      res.warnings.push('⛔ ' + res.buyUnmatched.length + ' خرید واقعی به قلم CO تطبیق قطعی ندارد و عمداً در هزینه/سود وارد نشد — provenance یا کد کالای خرید را تکمیل کنید.');
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
     v16.1 (US-391): ویجت نرخ لحظه‌ای ارز روی داشبورد (دلار/یورو — آزاد + سنا)
     - منبع: پروکسی سروری خودی api/fx-rates.php (کش ۱۰دقیقه‌ای + stale-if-error)
     - فقط اطلاع‌رسانی؛ مبنای اسناد همچنان نرخی است که کاربر در تراکنش تایید می‌کند
     - آفلاین/قطعی منبع → آخرین نرخ با برچسب «قدیمی»؛ ویجت هرگز داشبورد را نمی‌شکند
     =================================================================== */
  window._ptfFxLive = null; /* آخرین نرخ‌ها برای پیشنهاد در دیالوگ تسعیر */
  function fxTickerHtml() {
    return '<div id="fxTicker" data-noix style="background:var(--crd,#fff);border:1px solid var(--brd);border-radius:16px;padding:10px 16px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px">' +
      '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#94a3b8;font-size:11.5px">در حال دریافت…</span></div>';
  }
  function fxCell(lb, v, cl) {
    if (!v) return '';
    return '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">' + lb + '</small><b style="color:' + (cl || 'var(--tx,#1e293b)') + ';direction:ltr">' + (+v).toLocaleString('fa-IR') + ' <small>ریال</small></b></span>';
  }
  window.ptfFxTickerLoad = function () {
    var el = document.getElementById('fxTicker');
    if (!el) return;
    fetch('../api/fx-rates.php?action=rates')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var el2 = document.getElementById('fxTicker');
        if (!el2) return;
        if (!d.ok || !d.rates) {
          el2.innerHTML = '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#d97706;font-size:11.5px">⚠️ منبع نرخ فعلا در دسترس نیست — بعدا خودکار تلاش می‌شود</span>';
          return;
        }
        window._ptfFxLive = d;
        var R = d.rates;
        var stale = d.cache === 'stale' ? '<span class="bd" style="background:#fef3c7;color:#b45309" title="منبع فعلا قطع است — آخرین نرخ دریافتی">⏳ قدیمی (' + (d.staleMin || '?') + ' دقیقه پیش)</span>' : '';
        /* v16.7 (ابلاغ کارفرما): سنا قابل مشاهده + یوان آزاد + حواله یوان + تبدیل دلار→یوآن و طلا→یوآن.
           سلول‌های بدون داده (مثلا حواله یوان اگر منبع نداد) خودکار حذف می‌شوند — نوار نمی‌شکند. */
        /* v16.9 (پیگیری کارفرما): تشخیص شفاف — اگر آزاد آمد ولی سنا صفر بود، حذف بی‌صدا نه؛ برچسب + تست منبع ادمین */
        var sanaMissing = (R.usd_free > 0) && !R.usd_sana_buy && !R.usd_sana_sell && !R.eur_sana_buy && !R.eur_sana_sell;
        var sanaDiag = sanaMissing
          ? '<span class="bd" style="background:#fef3c7;color:#b45309" title="سلسله‌مراتب: sanarate → ice.ir → کلیدهای سنا/ICE در TGJU. اگر خالی است، هاست احتمالاً outbound به این دامنه‌ها ندارد یا IP خارج ایران برای ice بلاک است.">سنا: منبع پاسخ نداد' +
            ((typeof curRole === 'function' && ['admin', 'chairman'].indexOf(curRole()) > -1) ? ' <a href="javascript:void(0)" onclick="ptfFxDiag()" style="color:#b45309;text-decoration:underline">🔬 تست منبع</a>' : '') + '</span>'
          : '';
        var sanaUsd = (R.usd_sana_buy || R.usd_sana_sell)
          ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">دلار سنا 🏦</small><b style="direction:ltr;color:#7c3aed">' +
            (R.usd_sana_buy ? (+R.usd_sana_buy).toLocaleString('fa-IR') : '—') + ' / ' + (R.usd_sana_sell ? (+R.usd_sana_sell).toLocaleString('fa-IR') : '—') + ' <small>ریال</small></b><small style="color:#94a3b8;font-size:9.5px">خرید / فروش</small></span>' : '';
        var sanaEur = (R.eur_sana_buy || R.eur_sana_sell)
          ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">یورو سنا 🏦</small><b style="direction:ltr;color:#7c3aed">' +
            (R.eur_sana_buy ? (+R.eur_sana_buy).toLocaleString('fa-IR') : '—') + ' / ' + (R.eur_sana_sell ? (+R.eur_sana_sell).toLocaleString('fa-IR') : '—') + ' <small>ریال</small></b><small style="color:#94a3b8;font-size:9.5px">خرید / فروش</small></span>' : '';
        var usdCny = R.usd_cny
          ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">دلار→یوآن 🔁</small><b style="direction:ltr;color:#b45309">' + (+R.usd_cny).toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + ' <small>¥</small></b></span>' : '';
        var goldRial = R.gold18_rial
          ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">طلا ۱۸ عیار (گرم) 🥇</small><b style="direction:ltr;color:#b45309">' + (+R.gold18_rial).toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' <small>ریال</small></b></span>' : '';
        var eurUsd = R.eur_usd
          ? '<span style="display:inline-flex;flex-direction:column;line-height:1.6"><small style="color:#64748b">یورو→دلار 🔁</small><b style="direction:ltr;color:#0e7490">' + (+R.eur_usd).toLocaleString('fa-IR', { maximumFractionDigits: 4 }) + ' <small>$</small></b></span>' : '';
        el2.innerHTML =
          '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b>' +
          fxCell('دلار آزاد 🇺🇸', R.usd_free, '#059669') +
          fxCell('یورو آزاد 🇪🇺', R.eur_free, '#0e7490') +
          sanaUsd + sanaEur + sanaDiag +
          fxCell('یوان آزاد 🇨🇳', R.cny_free, '#dc2626') +
          fxCell('حواله یوان 🧾', R.cny_hav, '#dc2626') +
          usdCny + goldRial + eurUsd +
          stale +
          '<span style="margin-right:auto;color:#94a3b8;font-size:10.5px">' + (d.t || '') +
          (d.src_sana ? ' | سنا: ' + d.src_sana : '') +
          (d.src_market ? ' | بازار: ' + d.src_market : '') +
          ' | صرفا اطلاع‌رسانی؛ مبنای اسناد: نرخ تاییدی شما</span>';
      })
      .catch(function () {
        var el2 = document.getElementById('fxTicker');
        if (el2) el2.innerHTML = '<b style="font-size:13px">💱 نرخ لحظه‌ای ارز</b><span style="color:#94a3b8;font-size:11.5px">🔴 آفلاین</span>';
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
          '<div style="font-size:12px;color:#64748b;margin-bottom:8px">پاسخ خام سرور (force=1 — بدون کش). سلسله‌مراتب v24.9: sanarate/cbi → ice.ir (چند مسیر) → TGJU (آزاد + sana/ice) → isat. اگر usd_sana_* صفر است: ۱) هاست outbound به ice.ir/tgju.org/sanarate.ir داشته باشد ۲) ice گاهی فقط از IP ایران جواب می‌دهد ۳) دکمه force=1 را بزنید و JSON را بفرستید.</div>' +
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
        var hint = cur === 'USD'
          ? 'سنا خرید ' + (R.usd_sana_buy || 0).toLocaleString('fa-IR') + ' | سنا فروش ' + (R.usd_sana_sell || 0).toLocaleString('fa-IR') + ' | آزاد ' + (R.usd_free || 0).toLocaleString('fa-IR')
          : 'سنا خرید ' + (R.eur_sana_buy || 0).toLocaleString('fa-IR') + ' | سنا فروش ' + (R.eur_sana_sell || 0).toLocaleString('fa-IR') + ' | آزاد ' + (R.eur_free || 0).toLocaleString('fa-IR');
        if (typeof ptfToast === 'function') ptfToast('💱 نرخ‌های لحظه‌ای ' + cur + ' (ریال): ' + hint + (d.cache === 'stale' ? ' (قدیمی)' : ''), 'info');
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
