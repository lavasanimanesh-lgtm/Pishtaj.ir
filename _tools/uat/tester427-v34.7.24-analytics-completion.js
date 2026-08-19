#!/usr/bin/env node
'use strict';
/* v34.7.24 — فاز F نقشهٔ فازبندی: تکمیل تصمیم‌یار و تحلیلگر
     AN-01 بازهٔ زمانی واقعی برای گزارش‌های دوره‌ای
     AN-02 هم‌ترازی تعریف نرخ برد در insights.js
     AN-03 سنجه در سطح «فرصت»
     AN-04 کالیبراسیون امتیاز سلامت (مصوب کارفرما v34.7.33)
     AN-05 بازتعریف «پروندهٔ نیازمند بررسی» به سه دستهٔ معنادار
     AN-06 «خرید واقعی» از منبع ساختاریافته به‌جای Regex
     AN-07 گیت دفتر رسمی/غیررسمی روی snapshot ارسالی به AI
     AN-08 تقویم شمسی برای دوره و زمان‌بندی
   مرجع: ARENA-DECISION-SUPPORT-ANALYZER-DEEP-REVIEW-2026-08-15.md، PLAN-REMAINING-FIXES-PHASED-2026-08-17.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox ---------- */
function client(db, opts) {
  opts = opts || {};
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: { insertAdjacentHTML: function () {} } },
    fetch: function () { return Promise.reject(new Error('offline')); },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/26'; }, faDateTime: function () { return '1405/05/26 10:00'; },
    curSession: function () { return { user: 'u', name: 'کاربر' }; }, curRole: function () { return 'admin'; },
    roleDef: function () { return { finance: true }; }, isSenior: function () { return true; },
    ptfCanSeeLedger: function () { return opts.seeUnofficial !== false; },
    ptfJToISO: function (v) { var m = String(v || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/); if (!m) return ''; var jy = +m[1], jm = +m[2], jd = +m[3];
      /* تبدیل تقریبی جلالی→میلادی فقط برای آزمون (کافی برای بررسی «فیلتر شدن» است) */
      var gy = jy + 621; var doy = (jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + jd;
      var d0 = new Date(Date.UTC(gy, 2, 21)); d0.setUTCDate(d0.getUTCDate() + doy - 1); return d0.toISOString().slice(0, 10); },
    ptfISOToJ: function (v) { return '1405/05/24'; }, ptfTodayJ: function () { return '1405/05/26'; },
    audit: function () {}, alert: function () {}, ptfToast: function () {}, genCode: function (x) { return x + '-T'; },
    PTF_SALES_DOMAIN_V2: true, PTF: {}
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  ['crm/finance-helpers.js', 'crm/metrics-shared.js', 'crm/ar-reconcile.js', 'crm/management-intelligence.js'].forEach(function (r) {
    vm.runInContext(read(r), sb, { filename: r });
  });
  return sb;
}

function baseDb() {
  var iso = function (d) { return d; };
  return {
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
    ptf_crm_deals: [
      { cd: 'D-1', inqNo: 'RFQ-1', buyerCo: 'شرکت الف', wonOffer: 'CO-1', dueISO: '2020-01-01', st: 'open', timeline: [{ t: '2026-08-01' }] }, /* تأخیر */
      { cd: 'D-2', inqNo: 'RFQ-2', buyerCo: 'شرکت الف', wonOffer: 'CO-3', st: 'open', qcEvents: [{ conf: 'nonconform' }], timeline: [{ t: '2026-08-10' }] }, /* QC */
      { cd: 'D-3', inqNo: 'RFQ-3', buyerCo: 'شرکت الف', wonOffer: 'CO-4', st: 'open', timeline: [{ t: '2026-01-01' }] }, /* رکود */
      { cd: 'D-4', inqNo: 'RFQ-4', buyerCo: 'شرکت الف', st: 'open', timeline: [{ t: '2026-08-16' }] }  /* سالم: بدون برد ولی فعال */
    ],
    ptf_crm_offers: [
      /* دو پیشنهاد موازی برای یک استعلام: یکی برنده */
      { no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', buyerCd: 'CU-1', st: 'won', currency: 'IRR', dateEn: '2026-08-10', wonAt: '2026-08-12', items: [{ qty: 1, price: 1000000000 }] },
      { no: 'CO-2', kind: 'CO', inqNo: 'RFQ-1', buyerCd: 'CU-1', st: 'lost', currency: 'IRR', dateEn: '2026-08-10', items: [{ qty: 1, price: 900000000 }] },
      /* استعلام دوم: باخت کامل */
      { no: 'CO-3', kind: 'CO', inqNo: 'RFQ-2', buyerCd: 'CU-1', st: 'lost', currency: 'IRR', dateEn: '2026-08-11', items: [{ qty: 1, price: 500000000 }] },
      /* استعلام سوم: باز */
      { no: 'CO-4', kind: 'CO', inqNo: 'RFQ-3', buyerCd: 'CU-1', st: 'sent', currency: 'IRR', dateEn: '2026-08-12', items: [{ qty: 1, price: 300000000 }] },
      /* سند قدیمی خارج از دورهٔ جاری */
      { no: 'CO-OLD', kind: 'CO', inqNo: 'RFQ-OLD', buyerCd: 'CU-1', st: 'won', currency: 'IRR', dateEn: '2025-01-05', wonAt: '2025-01-20', items: [{ qty: 1, price: 700000000 }] }
    ],
    ptf_crm_rfqs: [{ cd: 'RFQ-1', custCd: 'CU-1', co: 'شرکت الف', dt: '2026-08-09' }],
    ptf_crm_invoices: [
      { cd: 'INV-1', buyerCd: 'CU-1', amount: 1000000000, invDate: '2026-08-13', status: 'active', payments: [{ cd: 'P1', amt: 400000000 }] },
      { cd: 'INV-U', buyerCd: 'CU-1', amount: 200000000, invDate: '2026-08-14', status: 'active', isUnofficial: true, payments: [] }
    ],
    ptf_crm_buyquotes: [
      { sup: 'تامین الف', price: 100, note: 'خرید واقعی طبق فاکتور' },   /* legacy note */
      { sup: 'تامین ب', price: 200, note: '' }
    ],
    ptf_crm_buycmp: [{ id: 'CMP-1', purchases: [{ sup: 'تامین ب', price: 200 }, { sup: 'تامین ب', price: 150 }] }],
    ptf_crm_rfqsmart: [], ptf_crm_sales_returns: [], ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [],
    ptf_crm_settings: {}, ptf_crm_users: [], ptf_crm_management_actions: [], ptf_crm_management_reports: []
  };
}

/* ---------- AN-01/AN-08: بازه و تقویم ---------- */
(function periodEngine() {
  var db = baseDb(), s = client(db);
  var all = s.ptfManagementIntelligence();
  T('AN-01 بدون آرگومان، رفتار قبلی (کل تاریخچه) حفظ شده', all.period.active === false && all.portfolio.issued === 5, all.portfolio.issued);

  var scoped = s.ptfManagementIntelligence({ fromISO: '2026-08-01', toISO: '2026-08-31', basis: 'issue' });
  T('AN-01 فیلتر بازه واقعاً اعمال می‌شود', scoped.portfolio.issued === 4, scoped.portfolio.issued);
  T('AN-01 سند خارج از بازه شمرده نمی‌شود', scoped.portfolio.won === 1 && all.portfolio.won === 2, scoped.portfolio.won + '/' + all.portfolio.won);
  T('AN-01 بازه در خروجی گزارش می‌شود', scoped.period.active === true && scoped.period.fromISO === '2026-08-01' && scoped.period.basis === 'issue');

  var byClose = s.ptfManagementIntelligence({ fromISO: '2026-08-11', toISO: '2026-08-31', basis: 'close' });
  T('AN-01 مبنای «بسته‌شدن» جدا از «صدور» کار می‌کند', byClose.period.basis === 'close' && byClose.portfolio.won === 1);

  var src = read('crm/management-intelligence.js');
  T('AN-08 دوره با تقویم شمسی ساخته می‌شود', src.indexOf('function jalaliRange') > -1 && src.indexOf("return jalaliRange(kind === 'monthly' ? 'monthly' : 'weekly').label;") > -1);
  T('AN-08 هفتهٔ شمسی از شنبه شروع می‌شود', src.indexOf('(new Date().getDay() + 1) % 7') > -1);
  T('AN-01 گزارش دوره‌ای snapshot را با همان بازه می‌سازد',
    src.indexOf('snapshot:window.ptfManagementAiSnapshot({fromISO:rng.fromISO,toISO:rng.toISO') > -1);
  T('AN-01 بازهٔ دوره در رکورد گزارش ذخیره می‌شود', src.indexOf('periodFromISO:rng.fromISO,periodToISO:rng.toISO') > -1);
})();

/* ---------- AN-03: سطح فرصت ---------- */
(function opportunityLevel() {
  var db = baseDb(), s = client(db);
  var d = s.ptfManagementIntelligence();
  var op = d.portfolio.opportunities;
  T('AN-03 تعداد فرصت‌ها بر مبنای استعلام شمرده می‌شود', op.total === 4, op.total);
  T('AN-03 دو پیشنهاد موازی یک فرصت‌اند', op.won === 2 && d.portfolio.won === 2, op.won);
  T('AN-03 نرخ برد فرصت با نرخ برد سند متفاوت است', op.winRateAll === 50 && d.portfolio.winRateAll === 40, op.winRateAll + ' / ' + d.portfolio.winRateAll);
  T('AN-03 فرصت باز درست شمرده می‌شود', op.open === 1, op.open);
  var m = s.PTF.metrics;
  T('AN-03 همان سنجه در لایهٔ مشترک هم هست', typeof m.opportunityStats === 'function' && m.opportunityStats(db.ptf_crm_offers).total === 4);
  T('AN-03 کارت سطح فرصت در تحلیلگر نمایش داده می‌شود', read('crm/analyzer.js').indexOf('نرخ برد در سطح «فرصت»') > -1);
})();

/* ---------- AN-05: بازتعریف ریسک ---------- */
(function riskCategories() {
  var db = baseDb(), s = client(db);
  var d = s.ptfManagementIntelligence();
  T('AN-05 پروندهٔ فعالِ بدون برد دیگر ریسک شمرده نمی‌شود', d.risks.filter(function (x) { return x.cd === 'D-4'; }).length === 0);
  T('AN-05 تأخیر تحویل شناسایی می‌شود', d.riskCounts.overdue === 1, JSON.stringify(d.riskCounts));
  T('AN-05 عدم انطباق QC شناسایی می‌شود', d.riskCounts.qc === 1);
  T('AN-05 پروندهٔ راکد (بیش از ۳۰ روز بی‌رویداد) شناسایی می‌شود', d.riskCounts.stalled === 1);
  T('AN-05 هر ریسک نوع مشخص دارد', d.risks.every(function (x) { return ['overdue', 'qc', 'stalled'].indexOf(x.kind) > -1; }));
})();

/* ---------- AN-06: منبع خرید واقعی ---------- */
(function realPurchases() {
  var db = baseDb(), s = client(db);
  var d = s.ptfManagementIntelligence();
  var byName = {}; d.suppliers.forEach(function (x) { byName[x.name] = x; });
  T('AN-06 خرید واقعی از ptf_crm_buycmp خوانده می‌شود', byName['تامین ب'] && byName['تامین ب'].purchases === 2, byName['تامین ب'] && byName['تامین ب'].purchases);
  T('AN-06 منبع شمارش گزارش می‌شود', byName['تامین ب'] && byName['تامین ب'].purchaseSource === 'buycmp');
  T('AN-06 یادداشت متنی فقط fallback رکوردهای قدیمی است',
    byName['تامین الف'] && byName['تامین الف'].purchases === 1 && byName['تامین الف'].purchaseSource === 'legacy-note');
  T('AN-06 Regex دیگر مبنای اصلی نیست', read('crm/management-intelligence.js').indexOf('if (/خرید واقعی/.test(String(b.note || \'\'))) s.purchases++;') === -1);
})();

/* ---------- AN-07: گیت دفتر ---------- */
(function ledgerGate() {
  var dbAll = baseDb(), sAll = client(dbAll, { seeUnofficial: true });
  var dAll = sAll.ptfManagementIntelligence();
  var dbOff = baseDb(), sOff = client(dbOff, { seeUnofficial: false });
  var dOff = sOff.ptfManagementIntelligence();
  var billedAll = dAll.customers.reduce(function (a, c) { return a + c.billed; }, 0);
  var billedOff = dOff.customers.reduce(function (a, c) { return a + c.billed; }, 0);
  T('AN-07 نقش بدون دسترسی دفتر غیررسمی، ارقام غیررسمی را نمی‌بیند', billedOff === 1000000000 && billedAll === 1200000000, billedOff + ' / ' + billedAll);
  T('AN-07 دامنهٔ دفتر در snapshot ارسالی به AI ثبت می‌شود',
    sOff.ptfManagementAiSnapshot().ledgerScope === 'official' && sAll.ptfManagementAiSnapshot().ledgerScope === 'all');
  T('AN-07 دامنهٔ دفتر و دوره در audit تفسیر AI ثبت می‌شود',
    read('crm/management-intelligence.js').indexOf("'تولید تفسیر AI مدیریت — دفتر: '") > -1);
})();

/* ---------- AN-02: هم‌ترازی تعریف در insights.js ---------- */
(function insightsAlignment() {
  var ins = read('crm/insights.js');
  T('AN-02 نام سنجه صریح شد', ins.indexOf("winRateLabel: 'نرخ برد پرونده‌های مختومه'") > -1);
  T('AN-02 قاعدهٔ حداقل نمونه اعمال شد', ins.indexOf('MIN_SAMPLE') > -1 && ins.indexOf('winRateDecided:') > -1);
  T('AN-02 مبنای سنجه در خروجی اعلام می‌شود', ins.indexOf("winRateBasis: 'decided-archived-cases'") > -1);
  T('AN-02 سنجهٔ سازمانی از لایهٔ مشترک کنارش نمایش داده می‌شود', ins.indexOf('orgWinRateAll') > -1 && ins.indexOf('_mx.winStats') > -1);
  T('AN-02 سازگاری عقب‌رو حفظ شده (فیلد winRate باقی است)', ins.indexOf('winRate: total ? Math.round(wins.length * 100 / total) : 0,') > -1);
})();

/* ---------- AN-04: شفافیت فرمول سلامت ---------- */
(function healthTransparency() {
  var db = baseDb(), s = client(db);
  var d = s.ptfManagementIntelligence();
  T('AN-04 فرمول امتیاز سلامت در خروجی مستند شده', !!d.healthModel && d.healthModel.base === 45 && d.healthModel.calibrated === true && !!d.healthModel.note);
  T('AN-04 وزن‌های مصوب اعمال شده',
    read('crm/management-intelligence.js').indexOf('hs += Math.min(25, c.winRate*0.25)') > -1);
  T('AN-04 مدل سلامت در snapshot ارسالی به AI هم می‌آید', !!s.ptfManagementAiSnapshot().healthModel);
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json'), php = read('api/sales-domain.php');
  var v = (idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/) || [])[1] || '';
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf('ptf-crm-' + v) > -1);
  T('نسخهٔ سرویس سرور هم‌راستاست', php.indexOf("const SD_SERVICE_VERSION = '" + v.slice(1) + "';") > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester427-v34.7.24-analytics-completion: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
