#!/usr/bin/env node
'use strict';
/* v34.7.30 — بستهٔ P1–P3 (تأیید کارفرما ۱۴۰۵/۰۵/۲۶)
   P1 (FB-1..FB-4): بارگذاری اقلام درخواست در فرم پیشنهاد
   P2 (FC-1..FC-5): نرخ مرجع روی قلم درخواست و نمایش آن در پیشنهاد
   P3 (FC-6/FC-7): نوشتن بازگشتی نرخ مرجع از پیشنهاد به قلم درخواست (+ بانک کالا با تیک)
   مرجع: ASSESSMENT-AWARD-REVISION-AND-REF-PRICE-2026-08-17.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox: procurement-link + بخش‌های مستقل offers.js ---------- */
function engine(db, opts) {
  opts = opts || {};
  var log = { alerts: [], toasts: [], audits: [] };
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object,
    setTimeout: function () { return 0; },
    document: {
      getElementById: function (id) { return opts.dom && opts.dom[id] ? opts.dom[id] : null; },
      querySelectorAll: function () { return []; },
      body: { insertAdjacentHTML: function () {} }
    },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/26'; },
    curSession: function () { return { name: 'کاربر آزمون' }; },
    alert: function (m) { log.alerts.push(String(m)); },
    ptfToast: function (m, k) { log.toasts.push(String(m)); },
    audit: function (a, b2) { log.audits.push(a + '|' + b2); },
    dedupNorm: null, window: null
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/procurement-link.js'), sb, { filename: 'procurement-link.js' });
  /* توابع مستقل مورد آزمون از offers.js (ناحیهٔ پیوسته، بدون وابستگی به DOM فرم) */
  var src = read('crm/offers.js');
  function cut(startMark, endMark) {
    var i = src.indexOf(startMark), j = src.indexOf(endMark, i);
    if (i < 0 || j < 0) throw new Error('ناحیه پیدا نشد: ' + startMark);
    return src.slice(i, j);
  }
  vm.runInContext(cut('window.ptfResolveInqRequest = function', 'function offLoadInqItems'), sb, { filename: 'offers.js#resolve' });
  vm.runInContext(cut('window.ptfSyncRefPriceBack = function', '\nfunction offerSave()'), sb, { filename: 'offers.js#writeback' });
  sb._log = log;
  return sb;
}

function baseDb() {
  return {
    ptf_crm_rfqs: [{ cd: 'RFQ-1405-021', inqNo: 'INQ-CLIENT-77', co: 'شرکت الف', items: [] }],
    ptf_crm_inqitems: [
      { inqNo: 'INQ-CLIENT-77', cd: 'IQI-1', nm: 'شیر توپی', st: 'API 6D', un: 'عدد', qty: 2, refPrice: 5000000, refCur: 'IRR', refSrc: 'manual', refAt: '1405/05/20' },
      { inqNo: 'INQ-CLIENT-77', cd: 'IQI-2', nm: 'فلنج', st: 'ASME B16.5', un: 'عدد', qty: 4 }
    ],
    ptf_crm_inqreads: [],
    ptf_crm_products: [{ cd: 'P-1001', nm: 'شیر توپی', st: 'API 6D', un: 'عدد', pr: 4800000, prCur: 'IRR' }],
    ptf_crm_rfqsmart: [],
    ptf_crm_offers: []
  };
}

/* ---------- FB-2: حل درخواست با هر دو نام مستعار ---------- */
(function resolveRequest() {
  var db = baseDb(), s = engine(db);
  var byClient = s.ptfResolveInqRequest('INQ-CLIENT-77');
  var bySys = s.ptfResolveInqRequest('RFQ-1405-021');
  T('FB-2 با شمارهٔ کارفرما اقلام پیدا می‌شوند', byClient.rows.length === 2 && byClient.source === 'inqitems', JSON.stringify({ n: byClient.rows.length, s: byClient.source }));
  T('FB-2 با کد سیستمی RFQ هم همان اقلام پیدا می‌شوند (باگ اصلی)', bySys.rows.length === 2 && bySys.source === 'inqitems', JSON.stringify({ n: bySys.rows.length, s: bySys.source }));
  T('FB-2 نام‌های مستعار هر دو برگردانده می‌شوند',
    bySys.aliases.indexOf('RFQ-1405-021') > -1 && bySys.aliases.indexOf('INQ-CLIENT-77') > -1, JSON.stringify(bySys.aliases));
  T('FB-2 کلید تهی هیچ‌وقت رکورد نمی‌دهد', s.ptfResolveInqRequest('').rows.length === 0 && s.ptfResolveInqRequest(null).rfq === null);
  T('FB-2 درخواست ناموجود، رکورد بی‌ربط برنمی‌گرداند', s.ptfResolveInqRequest('NO-SUCH').rows.length === 0);

  /* fallback ها */
  var db2 = baseDb(); db2.ptf_crm_inqitems = [];
  db2.ptf_crm_rfqs[0].items = [{ nm: 'پمپ', un: 'عدد', qty: 1 }];
  T('FB-2 در نبود inqitems، اقلام خود RFQ خوانده می‌شود',
    engine(db2).ptfResolveInqRequest('RFQ-1405-021').source === 'rfq.items');
})();

/* ---------- FC-3: هم‌ارزی واحدها ---------- */
(function unitAlias() {
  var s = engine(baseDb());
  var offerItem = { name: 'شیر توپی', desc: 'API 6D', unit: 'NO' };
  var reqItem = { nm: 'شیر توپی', st: 'API 6D', un: 'عدد' };
  var m = s.ptfResolveProcurementLine(offerItem, [reqItem]);
  T('FC-3 «NO» و «عدد» دیگر تطبیق را صفر نمی‌کنند', m.ok === true, JSON.stringify(m));
  T('FC-3 نگاشت واحد در دسترس است', typeof s.ptfNormUnit === 'function' && s.ptfNormUnit({ unit: 'PCS' }) === s.ptfNormUnit({ un: 'عدد' }));
  var diff = s.ptfResolveProcurementLine({ name: 'شیر توپی', unit: 'متر' }, [reqItem]);
  T('عدم رگرسیون: واحد واقعاً متفاوت همچنان تطبیق نمی‌خورد', diff.ok === false, JSON.stringify(diff));
})();

/* ---------- FC-2: زنجیرهٔ نرخ مرجع ---------- */
(function refChain() {
  var db = baseDb(), s = engine(db);
  var it = { name: 'شیر توپی', desc: 'API 6D', unit: 'NO' };
  var r1 = s.ptfItemRefPrice ? s.ptfItemRefPrice(it, { inqNo: 'RFQ-1405-021' }) : null;
  T('FC-2 تابع زنجیرهٔ نرخ مرجع در offers.js تعریف شده', /window\.ptfItemRefPrice = function/.test(read('crm/offers.js')));
  /* چون ptfItemRefPrice در همان ناحیهٔ resolve بارگذاری شده، رفتارش را مستقیم می‌سنجیم */
  if (r1) {
    T('FC-2 نرخ مرجع از قلم درخواست خوانده می‌شود', r1.price === 5000000 && r1.src === 'request', JSON.stringify(r1));
  }
  var it2 = { name: 'فلنج', desc: 'ASME B16.5', unit: 'عدد' };
  var r2 = s.ptfItemRefPrice(it2, { inqNo: 'RFQ-1405-021' });
  T('FC-2 قلم بدون نرخ در درخواست، به بانک کالا/صفر می‌افتد (بدون خطا)', r2.price === 0, JSON.stringify(r2));
  var it3 = { name: 'شیر توپی', desc: 'API 6D', unit: 'عدد', refPrice: 9000000, refPriceEdited: true };
  T('FC-2 نرخ دستی کاربر بر همهٔ منابع مقدم است', s.ptfItemRefPrice(it3, { inqNo: 'RFQ-1405-021' }).price === 9000000);
  /* بانک کالا وقتی درخواست نرخ ندارد */
  var db3 = baseDb(); delete db3.ptf_crm_inqitems[0].refPrice;
  var s3 = engine(db3);
  var r3 = s3.ptfItemRefPrice({ name: 'شیر توپی', desc: 'API 6D', unit: 'NO' }, { inqNo: 'RFQ-1405-021' });
  T('FC-2 در نبود نرخ درخواست، نرخ بانک کالا استفاده می‌شود', r3.price === 4800000 && r3.src === 'catalog', JSON.stringify(r3));
})();

/* ---------- FC-6: نوشتن بازگشتی به قلم درخواست ---------- */
(function writeBackRequest() {
  var db = baseDb(), s = engine(db);
  var offer = { no: 'PTF-CO-1405-090', inqNo: 'RFQ-1405-021', currency: 'IRR', items: [
    { name: 'شیر توپی', desc: 'API 6D', unit: 'NO', refPrice: 6200000, refPriceEdited: true },
    { name: 'فلنج', desc: 'ASME B16.5', unit: 'NO', refPrice: 310000, refPriceEdited: true }
  ] };
  var res = s.ptfSyncRefPriceBack(offer, {});
  var rows = db.ptf_crm_inqitems;
  T('FC-6 نرخ مرجع قلم درخواست با مقدار جدید پیشنهاد به‌روز می‌شود',
    rows[0].refPrice === 6200000 && rows[1].refPrice === 310000, JSON.stringify(rows.map(function (r) { return r.refPrice; })));
  T('FC-6 مقدار قبلی در تاریخچه نگه داشته می‌شود (بدون حذف)',
    (rows[0].refHistory || []).length === 1 && rows[0].refHistory[0].price === 5000000, JSON.stringify(rows[0].refHistory));
  T('FC-6 منبع/زمان/کاربر/شمارهٔ پیشنهاد ثبت می‌شود',
    rows[0].refSrc === 'offer' && rows[0].refBy === 'کاربر آزمون' && rows[0].refOfferNo === 'PTF-CO-1405-090');
  T('FC-6 شمارش تغییرات درست برگردانده می‌شود', res.request === 2 && res.catalog === 0, JSON.stringify(res));
  T('FC-6 رویداد حسابرسی ثبت می‌شود', s._log.audits.some(function (x) { return x.indexOf('نرخ مرجع') === 0; }), JSON.stringify(s._log.audits));

  /* بدون تیک، بانک کالا دست‌نخورده می‌ماند (تصمیم کارفرما) */
  T('FC-7 بدون تیک صریح، بانک کالا تغییر نمی‌کند', db.ptf_crm_products[0].pr === 4800000, db.ptf_crm_products[0].pr);
})();

/* ---------- FC-7: به‌روزرسانی بانک کالا فقط با تیک ---------- */
(function writeBackCatalog() {
  var db = baseDb(), s = engine(db);
  var offer = { no: 'PTF-CO-1405-091', inqNo: 'RFQ-1405-021', currency: 'IRR', items: [
    { name: 'شیر توپی', desc: 'API 6D', unit: 'عدد', refPrice: 7000000, refPriceEdited: true }
  ] };
  var res = s.ptfSyncRefPriceBack(offer, { toCatalog: true });
  T('FC-7 با تیک، نرخ مرجع بانک کالا هم به‌روز می‌شود', db.ptf_crm_products[0].pr === 7000000 && res.catalog === 1, JSON.stringify(res));
  T('FC-7 تاریخچهٔ نرخ کالا حفظ می‌شود',
    (db.ptf_crm_products[0].prHistory || []).length === 1 && db.ptf_crm_products[0].prHistory[0].pr === 4800000);
  T('FC-7 منبع نرخ کالا شفاف ثبت می‌شود', String(db.ptf_crm_products[0].refPriceSrc || '').indexOf('PTF-CO-1405-091') > -1);
})();

/* ---------- عدم رگرسیون ---------- */
(function noRegression() {
  var db = baseDb(), s = engine(db);
  var before = JSON.stringify(db.ptf_crm_inqitems);
  s.ptfSyncRefPriceBack({ no: 'X', inqNo: 'RFQ-1405-021', items: [{ name: 'شیر توپی', desc: 'API 6D', unit: 'NO', refPrice: 5000000 }] }, {});
  T('عدم رگرسیون: قلم بدون refPriceEdited هیچ نوشتنی ایجاد نمی‌کند', JSON.stringify(db.ptf_crm_inqitems) === before);

  var db2 = baseDb(), s2 = engine(db2);
  var r2 = s2.ptfSyncRefPriceBack({ no: 'Y', inqNo: 'RFQ-1405-021', items: [{ name: 'کالای ناشناخته', unit: 'NO', refPrice: 100, refPriceEdited: true }] }, {});
  T('عدم رگرسیون: قلم بدون تطبیق یکتا نوشته نمی‌شود (skipped)', r2.request === 0 && r2.skipped === 1, JSON.stringify(r2));

  var db3 = baseDb(), s3 = engine(db3);
  var same = s3.ptfSyncRefPriceBack({ no: 'Z', inqNo: 'RFQ-1405-021', currency: 'IRR', items: [{ name: 'شیر توپی', desc: 'API 6D', unit: 'NO', refPrice: 5000000, refPriceEdited: true }] }, {});
  T('عدم رگرسیون: نرخ بدون تغییر، تاریخچهٔ الکی نمی‌سازد',
    same.request === 0 && !(db3.ptf_crm_inqitems[0].refHistory || []).length, JSON.stringify(same));
})();

/* ---------- بررسی ایستا: اتصال‌ها ---------- */
(function statics() {
  var off = read('crm/offers.js'), inq = read('crm/inqreader.js'), br = read('crm/bridge.js'), st = read('crm/storage.js');
  T('FB-1 وصلهٔ inqreader آرگومان‌ها را عبور می‌دهد',
    /window\.offLoadInqItems = function \(pickedInq\)/.test(inq) && /_offLoadOld\.apply\(this, arguments\)/.test(inq));
  T('FB-2 لودر از حل‌کنندهٔ واحد استفاده می‌کند و تطبیق قدیمی حذف شده',
    /ptfResolveInqRequest\(inq\)/.test(off) && off.indexOf("filter(function (r) { return r.inqNo === inq || r.cd === inq; })") < 0);
  T('FB-3 انتخاب درخواست، اقلام را خودکار بارگذاری می‌کند',
    /offerPickInq[\s\S]{0,1800}offLoadInqItems\(inqNo\)/.test(off));
  T('FB-4 پیام «قلمی ثبت نشده» راهنمای مسیر می‌دهد', off.indexOf('هیچ قلمی ثبت نشده است') > -1);
  T('FC-1 فیلد نرخ مرجع در فرم قلم درخواست و در ردیف‌های مودال استعلام هست',
    br.indexOf('nIqRef') > -1 && br.indexOf('data-f="ref"') > -1);
  T('FC-1 نرخ مرجع با ارز/منبع/تاریخ/تاریخچه ذخیره می‌شود', /refHistory = \[\{ price: _ref/.test(br));
  T('FC-2 لودر واحد و کد کالا و نرخ مرجع را منتقل می‌کند',
    /unit: r\.un \|\| r\.unit \|\| 'عدد'/.test(off) && /pcode: r\.pcode/.test(off) && /ptfItemRefPrice\(item/.test(off));
  T('FC-4 کالای خودکار نرخ مرجع قلم درخواست را می‌گیرد', /pr: \+r\.refPrice \|\| 0/.test(st));
  T('FC-5 پل استعلام تامین با نام‌های مستعار درخواست کار می‌کند', /_als\[String\(r\.srcRfq/.test(off));
  T('FC-7 تیک «ثبت در بانک کالا» در فرم پیشنهاد هست', off.indexOf('id="ofRefToCatalog"') > -1);
  T('FC-6 فراخوان نوشتن بازگشتی پس از ذخیرهٔ موفق انجام می‌شود', /ptfSyncRefPriceBack\(o, \{ toCatalog: _toCat \}\)/.test(off));
})();

console.log('\n— tester433 (P1–P3: بارگذاری اقلام درخواست + زنجیرهٔ نرخ مرجع) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
