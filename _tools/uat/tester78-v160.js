/* tester78 — v16.0 (US-390: نظام سود چندارزی — موتور واحد سود ریالی قابل اعتماد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var pl = fs.readFileSync(path.join(BASE, 'procurement-link.js'), 'utf-8');

SECTION('کد: موتور واحد سود ریالی');
T('ptfProjectProfitIRR در fx.js', fx.indexOf('window.ptfProjectProfitIRR = function (prj)') > -1);
T('اصل طلایی: جزء نامشخص وارد عدد نمی‌شود — گزارش صریح', fx.indexOf('هرگز عدد غلط') > -1 && fx.indexOf('buyPendingFx') > -1);
T('فروش ارزی از دریافت‌های تسعیرشده (pays[].fx — سنا روز تسویه)', fx.indexOf("pays.forEach(function (pp)") > -1 && fx.indexOf('pp.fx && (+pp.fx.fxAmt || +pp.fx.rate)') > -1);
T('هر دو ساختار تاریخی pays/payments پوشش داده شد', fx.indexOf("(inv.pays || []).concat(inv.payments || [])") > -1);
T('دریافت بدون نرخ تسعیر → هشدار (نه حذف از فروش ریالی)', fx.indexOf('بدون نرخ تسعیر» ثبت شده') > -1);
T('مانده ارزی وصول‌نشده → اطلاع شفاف', fx.indexOf('هنوز وصول نشده — سود فعلی فقط بر مبنای وصولی‌های واقعی') > -1);
T('خرید ریالی مستقیم + خرید ارزی × نرخ پرداخت', fx.indexOf("if (pCur === 'IRR') { res.buyIrr += unit * qty;") > -1 && fx.indexOf('res.buyIrr += unit * (+pu.rate) * qty;') > -1);
T('تطبیق خرید دیگر به pu.idx متکی نیست', fx.indexOf('ptfResolveItemForPurchase') > -1 && fx.indexOf('(c2.items || [])[pu.idx]') === -1 && fx.indexOf('buyUnmatched') > -1);
T('خرید ارزی بدون نرخ → pendingFx + هشدار بیش‌برآورد', fx.indexOf('در هزینه لحاظ نمی‌شوند و سود نمایشی بیش‌برآورد است') > -1);
T('مسیر قدیمی buyquotes فقط در نبود جدول مقایسه و بدون تطبیق مبهم', fx.indexOf('if (!res.buyItems && !res.buyPendingFx.length && !res.buyUnmatched.length) {') > -1);

SECTION('کد: ثبت خرید با ارز');
T('cmpBuy: انتخاب ارز خرید (IRR/EUR/USD)', bc.indexOf("{ id: 'cur', label: 'ارز خرید'") > -1);
T('نرخ تسعیر ارزی (v17.2/US-412 — v19.6 BUG-030: واحد=ریال)', bc.indexOf('نرخ تسعیر (ریال per واحد ارز)') > -1);
T('خرید ارزی بدون نرخ → رد قطعی (v17.2/US-412 مصوب: جایگزین confirm v16.0)', bc.indexOf('بدون «نرخ تسعیر» ثبت نمی‌شود (US-412)') > -1);
T('رهگیری ارز روی رکورد (v17.2: srcCur/priceFx/rate — price همیشه IRR قطعی)', bc.indexOf("srcCur: buyCur !== 'IRR' ? buyCur : ''") > -1 && bc.indexOf('priceFx: priceFx') > -1);
T('خرید ریالی: rate=0 (بدون تاثیر)', bc.indexOf("buyCur !== 'IRR' ? buyRate : 0") > -1);

SECTION('کد: محاسبه‌گر سود از موتور واحد');
T('ptfCalculateNetProfit به موتور واحد وصل شد', idx.indexOf('var r = ptfProjectProfitIRR(p);') > -1);
T('برچسب قابل‌اتکا/ناقص روی خروجی', idx.indexOf('✅ همه اجزا قطعی — قابل اتکا') > -1 && idx.indexOf('⚠️ ناقص — اجزای نامشخص در هشدارها') > -1);
T('هشدارها در مودال نمایش داده می‌شوند', idx.indexOf('r.warnings.map(function(w){return escP(w);})') > -1);
T('هزینه جانبی با ارقام فارسی هم', idx.indexOf("replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);})") > -1);
T('سود منفی قرمز نمایش داده می‌شود', idx.indexOf("(netProfit >= 0 ? '#15803d' : '#dc2626')") > -1);

SECTION('رفتار اجرایی: هر ۴ حالت کسب‌وکار + حالات مرزی');
(function () {
  global.window = global;
  var m = fx.match(/window\.ptfProjectProfitIRR = function \(prj\) \{[\s\S]*?\n  \};/);
  T('موتور استخراج شد', !!m);
  if (!m) return;
  eval(pl);
  eval(m[0]);
  function reset() {
    setData('ptf_crm_offers', []); setData('ptf_crm_invoices', []);
    setData('ptf_crm_buycmp', []); setData('ptf_crm_buyquotes', []);
  }
  /* حالت ①: فروش ریالی + خرید ریالی */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-1', currency: 'IRR', items: [{ qty: 10, price: 1000 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-1', amount: 10000 }]);
  setData('ptf_crm_buycmp', [{ inqNo: 'INQ-1', items: [{ nm: 'لوله', pcode: 'P-LULE', qty: 10 }], purchases: [{ idx: 0, sourcePcode: 'P-LULE', price: 700, cur: 'IRR' }] }]);
  var r1 = ptfProjectProfitIRR({ offerNo: 'CO-1', inqNo: 'INQ-1' });
  T('① ریالی/ریالی: فروش 10000، خرید 7000، سود 3000 (30٪)', r1.ok && r1.complete && r1.sellIrr === 10000 && r1.buyIrr === 7000 && r1.profit === 3000 && r1.pct === 30);
  /* حالت ②: فروش ارزی با تسعیر سنا + خرید ریالی */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-2', currency: 'EUR', items: [{ qty: 1, price: 100 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-2', pays: [
    { amt: 5000000, fx: { fxAmt: 50, rate: 100000 } },  /* ۵۰ یورو با نرخ سنا 100هزار */
    { amt: 4800000, fx: { fxAmt: 50, rate: 96000 } }    /* ۵۰ یورو با نرخ سنا 96هزار */
  ] }]);
  setData('ptf_crm_buycmp', [{ inqNo: 'INQ-2', items: [{ nm: 'کالا', pcode: 'P-KALA', qty: 1 }], purchases: [{ idx: 0, sourcePcode: 'P-KALA', price: 6000000, cur: 'IRR' }] }]);
  var r2 = ptfProjectProfitIRR({ offerNo: 'CO-2', inqNo: 'INQ-2' });
  T('② ارزی/ریالی: فروش = دریافت‌های واقعی 9.8M', r2.ok && r2.sellIrr === 9800000 && r2.sellCur === 'EUR');
  T('② تسویه کامل ارزی (100/100 EUR) — قابل اتکا', r2.complete && Math.abs(r2.sellFxRemain) < 0.01 && r2.profit === 3800000);
  T('② میانگین نرخ درست (98000)', r2.sellAvgRate === 98000);
  /* حالت ③: فروش ارزی + خرید با ارز آزاد */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-3', currency: 'USD', items: [{ qty: 1, price: 200 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-3', pays: [{ amt: 20000000, fx: { fxAmt: 200, rate: 100000 } }] }]);
  setData('ptf_crm_buycmp', [{ inqNo: 'INQ-3', items: [{ nm: 'کالا', pcode: 'P-KALA3', qty: 2 }], purchases: [{ idx: 0, sourcePcode: 'P-KALA3', price: 50, cur: 'USD', rate: 110000 }] }]); /* 2×50$×110هزار آزاد */
  var r3 = ptfProjectProfitIRR({ offerNo: 'CO-3', inqNo: 'INQ-3' });
  T('③ خرید ارز آزاد ریالی‌شده: 11M — سود 9M', r3.ok && r3.complete && r3.buyIrr === 11000000 && r3.profit === 9000000);
  /* حالت ④: خرید ارزی بدون نرخ → هشدار، نه عدد غلط */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-4', currency: 'IRR', items: [{ qty: 1, price: 5000000 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-4', amount: 5000000 }]);
  setData('ptf_crm_buycmp', [{ inqNo: 'INQ-4', items: [{ nm: 'ولو', pcode: 'P-VALVE', qty: 1 }], purchases: [{ idx: 0, sourcePcode: 'P-VALVE', price: 30, cur: 'EUR', rate: 0 }] }]);
  var r4 = ptfProjectProfitIRR({ offerNo: 'CO-4', inqNo: 'INQ-4' });
  T('④ خرید ارزی بی‌نرخ: complete=false + pendingFx + هشدار بیش‌برآورد', !r4.complete && r4.buyPendingFx.length === 1 && r4.warnings.some(function (w) { return w.indexOf('بیش‌برآورد') > -1; }));
  /* مرزی: سند ارزی بدون هیچ دریافت → ok=false (هرگز عدد جعلی) */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-5', currency: 'EUR', items: [{ qty: 1, price: 100 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-5', pays: [] }]);
  var r5 = ptfProjectProfitIRR({ offerNo: 'CO-5', inqNo: 'INQ-5' });
  T('مرزی: ارزی بدون دریافت → ok=false (محاسبه رد می‌شود)', !r5.ok && r5.profit === null);
  /* مرزی: وصول ناقص ارزی → سود فقط از وصولی + هشدار مانده */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-6', currency: 'EUR', items: [{ qty: 1, price: 100 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-6', pays: [{ amt: 3000000, fx: { fxAmt: 30, rate: 100000 } }] }]);
  var r6 = ptfProjectProfitIRR({ offerNo: 'CO-6', inqNo: 'INQ-6' });
  T('مرزی: وصول ۳۰ از ۱۰۰ یورو → فروش 3M + هشدار مانده ۷۰', r6.ok && r6.sellIrr === 3000000 && r6.sellFxRemain === 70 && r6.warnings.some(function (w) { return w.indexOf('وصول نشده') > -1; }));
  /* مرزی: رکورد خرید قدیمی بدون cur (پیش از v16.0) → IRR فرض شود */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-7', currency: 'IRR', items: [{ qty: 1, price: 2000 }] }]);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_buycmp', [{ inqNo: 'INQ-7', items: [{ nm: 'قدیمی', pcode: 'P-OLD', qty: 1 }], purchases: [{ idx: 0, sourcePcode: 'P-OLD', price: 1500 }] }]); /* بدون cur */
  var r7 = ptfProjectProfitIRR({ offerNo: 'CO-7', inqNo: 'INQ-7' });
  T('سازگاری عقب‌رو: خرید قدیمی بدون cur = ریالی', r7.ok && r7.buyIrr === 1500 && r7.complete);
  /* مرزی: دریافت ریالی بدون fx روی سند ارزی → در فروش هست + complete=false */
  reset();
  setData('ptf_crm_offers', [{ no: 'CO-8', currency: 'EUR', items: [{ qty: 1, price: 100 }] }]);
  setData('ptf_crm_invoices', [{ offerNo: 'CO-8', pays: [{ amt: 1000000 }] }]);
  var r8 = ptfProjectProfitIRR({ offerNo: 'CO-8', inqNo: 'INQ-8' });
  T('دریافت بی‌نرخ روی سند ارزی: فروش لحاظ + علامت ناقص', r8.ok && r8.sellIrr === 1000000 && !r8.complete);
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust fx/buycompare (>=16.0)', ['fx.js', 'buycompare.js'].every(function (f) {
  var m2 = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m2 && +m2[1] >= 16;
}));

DONE('tester78-v160');
