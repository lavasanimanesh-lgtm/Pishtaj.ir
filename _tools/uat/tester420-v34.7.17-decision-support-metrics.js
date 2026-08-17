#!/usr/bin/env node
'use strict';
/* v34.7.17 — یکپارچگی سنجه‌های «تصمیم‌یار مدیریت» و «تحلیلگر هوشمند».
   مرجع یافته‌ها: ARENA-DECISION-SUPPORT-ANALYZER-DEEP-REVIEW-2026-08-15.md
     F-01 مخرج نرخ برد | F-02 ضریب پیش‌بینی | F-03 هویت مشتری
     F-04 نرمال‌سازی ارز | F-05 منبع واحد مالی | F-08 حجم نمونه
   این تستر رفتار واقعی توابع را در sandbox اجرا می‌کند (نه فقط grep). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ---------- محیط شبیه‌سازی ---------- */
function build(db) {
  var sandbox = {
    console: console, setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: { insertAdjacentHTML: function () {} } },
    fetch: function () { return Promise.reject(new Error('offline')); },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/25'; }, faDateTime: function () { return '1405/05/25 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; },
    roleDef: function () { return { finance: true }; }, isSenior: function () { return true; },
    genCode: function (x) { return x + '-1'; }, audit: function () {}, addLog: function () {},
    notify: function () {}, alert: function () {}, PTF: {}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['crm/metrics-shared.js', 'crm/management-intelligence.js', 'crm/analyzer.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  return sandbox;
}

/* ---------- سناریوی کارفرما: ۱۱ آفر، ۱ برد، هیچ باخت ثبت‌نشده ---------- */
(function reportedCase() {
  var offers = [{ no: 'CO-1', kind: 'CO', inqNo: 'R1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', st: 'won', currency: 'IRR', items: [{ qty: 1, price: 1e9 }] }];
  for (var i = 2; i <= 11; i++) offers.push({ no: 'CO-' + i, kind: 'CO', inqNo: 'R' + i, buyerCd: 'CU-1', buyerCo: 'شرکت الف', st: i % 2 ? 'sent' : 'draft', currency: 'IRR', items: [{ qty: 1, price: 3e8 }] });
  var s = build({
    ptf_crm_offers: offers,
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    /* RFQ بدون custCd (مسیر دستیار/قدیمی) — نباید سطر دوم بسازد */
    ptf_crm_rfqs: [{ cd: 'R1', co: 'شرکت الف', custCd: 'CU-1' }, { cd: 'R2', co: 'شرکت الف' }, { cd: 'R3', co: 'شرکت الف' }]
  });
  var mi = s.ptfManagementIntelligence(), c = mi.customers[0], fn = s.anlOfferFunnel(), fc = s.anlForecast();

  T('F-01 نرخ برد مشتری بر مبنای کل پیشنهادهاست (۹.۱٪ نه ۱۰۰٪)', c.winRate === 9.1, c.winRate);
  T('F-01 نرخ برد کمکی با نمونهٔ کم نمایش داده نمی‌شود', c.winRateDecided === null, c.winRateDecided);
  T('F-01 پوشش تعیین تکلیف گزارش می‌شود', c.coverage === 9.1, c.coverage);
  T('F-01 شمارش پیشنهادهای بی‌تکلیف', c.open === 10, c.open);
  T('F-01 قیف تحلیلگر: winRateAll=9.1 و winRateDecided=null', fn.winRateAll === 9.1 && fn.winRateDecided === null, fn.winRateAll + '/' + fn.winRateDecided);
  T('F-02 احتمال پایپ‌لاین دیگر ۱۰۰٪ نیست و زیر سقف ۷۰٪ است', fc.winP > 0 && fc.winP < 70, fc.winP);
  T('F-02 پیش‌بینی وزنی کمتر از کل پایپ‌لاین است', fc.weighted < fc.pipeline, fc.weighted + '/' + fc.pipeline);
  T('F-03 مشتری فقط یک سطر دارد (کد و نام یکی شدند)', mi.customers.length === 1, mi.customers.length);
  T('F-03 RFQهای بدون کد روی همان سطر نشستند', c.rfqs === 3, c.rfqs);
  T('کیفیت داده: بی‌تکلیف‌ها گزارش می‌شوند', mi.dataQuality.offersUndecided === 10, mi.dataQuality.offersUndecided);
  T('بینش هشدار اتکاپذیری نرخ برد تولید می‌شود', mi.insights.some(function (x) { return /قابل استناد نیست/.test(x.title + x.text); }));
})();

/* ---------- ارز، وضعیت منقضی و مالی ---------- */
(function currencyFinance() {
  var s = build({
    ptf_crm_customers: [{ cd: 'CU-9', co: 'شرکت ب' }],
    ptf_crm_offers: [
      { no: 'CO-A', kind: 'CO', buyerCd: 'CU-9', st: 'won', currency: 'EUR', items: [{ qty: 10, price: 1200 }] },                    /* بدون نرخ مرجع */
      { no: 'CO-B', kind: 'CO', buyerCd: 'CU-9', st: 'won', currency: 'EUR', fxRateRef: 900000, items: [{ qty: 10, price: 1000 }] },  /* با نرخ مرجع */
      { no: 'CO-C', kind: 'CO', buyerCd: 'CU-9', st: 'sent', currency: 'IRR', validUntil: '2020-01-01', items: [{ qty: 1, price: 5e8 }] },
      { no: 'CO-D', kind: 'TC', buyerCd: 'CU-9', st: 'lost', currency: 'IRR', items: [{ qty: 1, price: 1e8 }] },
      { no: 'CO-E', kind: 'CO', rialOf: 'CO-A', buyerCd: 'CU-9', st: 'draft', currency: 'IRR', items: [{ qty: 10, price: 1080000 }] } /* نسخهٔ همراه — نباید شمرده شود */
    ],
    ptf_crm_invoices: [
      { cd: 'I1', buyerCd: 'CU-9', amount: 1e9, status: 'void', payments: [{ amt: 1e9 }] },
      { cd: 'I2', buyerCd: 'CU-9', amount: 11e8, allocatedBase: 4e8, allocatedVat: 0,
        payments: [{ amt: 4e8, migratedToReceiptId: 'RCP-1' }, { amt: 1e8, status: 'void' }] }
    ]
  });
  var mi = s.ptfManagementIntelligence(), c = mi.customers[0], fn = s.anlOfferFunnel(), fc = s.anlForecast();

  T('F-04 مبلغ ارزی با نرخ مرجع به ریال تبدیل شد', c.wonValue === 10 * 1000 * 900000, c.wonValue);
  T('F-04 سند ارزی بدون نرخ مرجع در جمع ریالی نیامد و شمرده شد', c.fxGaps === 1 && mi.dataQuality.offersFxNoRate === 1, c.fxGaps);
  T('F-04 قیف تحلیلگر همان قاعده را دارد', fn.fxGaps === 1 && fn.wonValue === 9e9, fn.fxGaps + '/' + fn.wonValue);
  T('نسخهٔ همراه ریالی (rialOf) پیشنهاد مستقل شمرده نمی‌شود', c.offers === 4, c.offers);
  T('TC در قیف مالی لحاظ می‌شود (رفع ناسازگاری تعریف)', c.lost === 1 && fn.lost === 1);
  T('پیشنهاد گذشته از اعتبار به‌عنوان منقضی گزارش می‌شود (بدون تغییر وضعیت رکورد)',
    c.expired === 1 && mi.dataQuality.offersExpiredUndecided === 1 && s.getData('ptf_crm_offers')[2].st === 'sent', c.expired);
  T('F-05 فاکتور ابطال‌شده در «فاکتورشده» نمی‌نشیند', c.billed === 11e8, c.billed);
  T('F-05 پرداخت ابطالی/مهاجرت‌شده دوباره شمرده نمی‌شود و allocated لحاظ می‌شود', c.paid === 4e8, c.paid);
  T('F-05 نرخ وصول با منبع واحد مالی هم‌خوان است', c.collectionRate === 36.4, c.collectionRate);
  T('F-05 پیش‌بینی مالی تحلیلگر هم از همان منبع می‌خواند', fc.invoiced === 11e8 && fc.paid === 4e8, fc.invoiced + '/' + fc.paid);
})();

/* ---------- قرارداد لایهٔ سنجه ---------- */
(function contract() {
  var s = build({});
  var M = s.PTF.metrics;
  T('لایهٔ سنجهٔ مشترک در دسترس است', !!M && M.version === 'v34.7.17');
  T('pWin با نمونهٔ صفر به prior نزدیک است', Math.abs(M.pWin(0, 0) - 0.3) < 1e-9, M.pWin(0, 0));
  T('pWin سقف محافظه‌کارانه دارد', M.pWin(100, 100) <= 0.7, M.pWin(100, 100));
  T('pWin با ۱ برد از ۱ آفر به ۱۰۰٪ نمی‌رسد', M.pWin(1, 1) < 0.45, M.pWin(1, 1));
  T('نام مشتری با نیم‌فاصله/ي عربی نرمال می‌شود', M.normName('شرکت\u200cپالایش ي') === M.normName('شرکت پالایش ی'));

  var src = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
  T('metrics-shared.js پیش از تحلیلگر و تصمیم‌یار بارگذاری می‌شود',
    src.indexOf('metrics-shared.js') > -1 &&
    src.indexOf('metrics-shared.js') < src.indexOf('analyzer.js?v=') &&
    src.indexOf('metrics-shared.js') < src.indexOf('management-intelligence.js?v='));
  var an = fs.readFileSync(path.join(ROOT, 'crm/analyzer.js'), 'utf8');
  T('کارت داشبورد مخرج را صریح اعلام می‌کند', an.indexOf('نرخ برد (از کل ') > -1);
  T('هشدار پوشش پایین در UI وجود دارد', an.indexOf('هشدار اتکاپذیری') > -1);
  T('ضریب پیش‌بینی دیگر از winRate خام گرفته نمی‌شود', an.indexOf('f.winRate != null ? f.winRate / 100 : 0.3') === -1);
})();

console.log('\n=== tester420-v34.7.17-decision-support-metrics: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
