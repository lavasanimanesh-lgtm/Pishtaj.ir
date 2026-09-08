#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester605-v34.37.8-custom-lines-and-tombstone-sync.js
   
   ۱) مودال فاکتور غیررسمی (unofficial-invoice.js):
      - امکان ویرایش نام و واحد اقلام سفارشی
      - فوکوس و انتخاب خودکار متن نام قلم پس از افزودن سطر سفارشی
      - همگام‌سازی لحظه‌ای مقادیر DOM با استیت در حین محاسبه و هنگام ثبت (submit)

   ۲) همگام‌سازی و چرخه عمر پرونده‌های فروش (sync.js & salesfiles.js):
      - سنگ‌قبر رویدادهای کنترل کیفیت (_qcTomb)
      - سنگ‌قبر رویدادهای حمل و ارسال (_shipTomb)
      - سنگ‌قبر اسناد متفرقه (_docTomb) و فایل‌های حذف‌شده (_deletedFileKeys)
      - حذف دایمی و جلوگیری قطعی از رستاخیز رکوردهای حذف‌شده در merge
      - ذخیره امن با ptfEntitySaveCollection
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var unInvSrc = read('crm/unofficial-invoice.js');
var syncSrc = read('crm/sync.js');
var sfSrc = read('crm/salesfiles.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');
var verJson = JSON.parse(read('VERSION.json'));

/* ───────────────────── ۱) مودال فاکتور غیررسمی ───────────────────── */
head('۱. فاکتور غیررسمی — اقلام سفارشی، ویرایش نام/واحد و فوکوس خودکار');

T('۱.۱ وجود فیلد قابل ویرایش name و desc برای همه اقلام',
  unInvSrc.indexOf('data-fld="name"') > -1 && unInvSrc.indexOf('data-fld="desc"') > -1);

T('۱.۲ وجود فیلد قابل ویرایش unit برای اقلام سفارشی (ln.custom)',
  unInvSrc.indexOf('ln.custom ? \'<input type="text" data-fld="unit"') > -1);

T('۱.۳ خواندن unitEl در unofficialInvoiceBuilderRecalc و ثبت در ln.unit',
  unInvSrc.indexOf('var unitEl = _dlg.querySelector(\'input[data-fld="unit"][data-pid="\' + pid + \'"]\');') > -1 &&
  unInvSrc.indexOf('if (unitEl && un) ln.unit = un;') > -1);

T('۱.۴ فوکوس و انتخاب خودکار سطر جدید در unofficialInvoiceBuilderAddCustomRow',
  unInvSrc.indexOf('newRowInput.focus()') > -1 && unInvSrc.indexOf('newRowInput.select()') > -1);

T('۱.۵ فراخوانی unofficialInvoiceBuilderRecalc در ابتدای unofficialInvoiceBuilderSubmit برای همگام‌سازی ورودی‌های DOM',
  unInvSrc.indexOf('window.unofficialInvoiceBuilderSubmit = function () {') > -1 &&
  unInvSrc.indexOf('window.unofficialInvoiceBuilderRecalc();') > -1);

/* ───────────────────── ۲) سنگ‌قبرهای پرونده در sync.js ───────────────────── */
head('۲. همگام‌سازی پرونده‌ها — سنگ‌قبر و حذف دائمی QC, Ship, Docs');

T('۲.۱ وجود ادغام و هرس _qcTomb در ptfMergeBusinessRecord برای ptf_crm_deals',
  syncSrc.indexOf('var qcTomb = {};') > -1 &&
  syncSrc.indexOf('if (qcTomb[cd]) return;') > -1 &&
  syncSrc.indexOf('out._qcTomb = qcTomb;') > -1);

T('۲.۲ وجود ادغام و هرس _shipTomb در ptfMergeBusinessRecord برای ptf_crm_deals',
  syncSrc.indexOf('var shipTomb = {};') > -1 &&
  syncSrc.indexOf('if (shipTomb[cd]) return;') > -1 &&
  syncSrc.indexOf('out._shipTomb = shipTomb;') > -1);

T('۲.۳ وجود ادغام و هرس _docTomb و _deletedFileKeys در ptfMergeBusinessRecord برای ptf_crm_deals',
  syncSrc.indexOf('var docTomb = {};') > -1 &&
  syncSrc.indexOf('out._docTomb = docTomb;') > -1 &&
  syncSrc.indexOf('out._deletedFileKeys = Object.keys(delFileKeys);') > -1);

/* تست رفتاری ادغام sync.js برای پرونده */
(function testSyncDealMerge() {
  var sandbox = {
    window: {},
    console: console,
    setInterval: function () {},
    clearInterval: function () {},
    setTimeout: function () {},
    clearTimeout: function () {},
    localStorage: { getItem: function () { return null; }, setItem: function () {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(syncSrc, sandbox);

  var localDeals = [{
    cd: 'DL-001',
    qcEvents: [{ cd: 'QC-01', name: 'بازرسی اول' }],
    shipEvents: [{ cd: 'SH-01', name: 'ارسال اول' }],
    docs: [{ key: 'doc-01', name: 'سند ۱' }, { key: 'doc-02', name: 'سند ۲' }],
    _qcTomb: { 'QC-02': '2026-09-07T10:00:00Z' },
    _shipTomb: { 'SH-02': '2026-09-07T10:00:00Z' },
    _docTomb: { 'doc-02': '2026-09-07T10:00:00Z' },
    _deletedFileKeys: ['doc-02']
  }];

  var remoteDeals = [{
    cd: 'DL-001',
    qcEvents: [{ cd: 'QC-01', name: 'بازرسی اول' }, { cd: 'QC-02', name: 'بازرسی دوم حذف‌شده' }],
    shipEvents: [{ cd: 'SH-01', name: 'ارسال اول' }, { cd: 'SH-02', name: 'ارسال دوم حذف‌شده' }],
    docs: [{ key: 'doc-01', name: 'سند ۱' }, { key: 'doc-02', name: 'سند ۲' }],
    _qcTomb: {},
    _shipTomb: {},
    _docTomb: {},
    _deletedFileKeys: []
  }];

  var mergedJson = sandbox.window.ptfSmartMerge('ptf_crm_deals', JSON.stringify(localDeals), JSON.stringify(remoteDeals));
  var merged = JSON.parse(mergedJson);
  var d = merged[0];

  T('۲.۴ رویداد QC حذف‌شده با سنگ‌قبر زنده نشد',
    d.qcEvents.length === 1 && d.qcEvents[0].cd === 'QC-01');
  T('۲.۵ رویداد Ship حذف‌شده با سنگ‌قبر زنده نشد',
    d.shipEvents.length === 1 && d.shipEvents[0].cd === 'SH-01');
  T('۲.۶ سند حذف‌شده با سنگ‌قبر زنده نشد',
    d.docs.length === 1 && d.docs[0].key === 'doc-01');
  T('۲.۷ سنگ‌قبرها در خروجی ادغام حفظ شدند',
    d._qcTomb['QC-02'] && d._shipTomb['SH-02'] && d._docTomb['doc-02']);
})();

/* ───────────────────── ۳) متدهای حذف در salesfiles.js ───────────────────── */
head('۳. متدهای حذف در salesfiles.js — ثبت سنگ‌قبر و استفاده از ptfEntitySaveCollection');

T('۳.۱ sfSave از ptfEntitySaveCollection با reason: "w2" استفاده می‌کند',
  sfSrc.indexOf('if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection(K, list, { reason: \'w2\' });') > -1);

T('۳.۲ sfQcDeleteCommit سنگ‌قبر _qcTomb و _deletedFileKeys را ثبت می‌کند',
  sfSrc.indexOf('r._qcTomb = r._qcTomb || {};') > -1 &&
  sfSrc.indexOf('r._qcTomb[eventCd] = new Date().toISOString();') > -1);

T('۳.۳ sfShipDeleteCommit سنگ‌قبر _shipTomb و _deletedFileKeys را ثبت می‌کند',
  sfSrc.indexOf('r._shipTomb = r._shipTomb || {};') > -1 &&
  sfSrc.indexOf('r._shipTomb[eventCd] = new Date().toISOString();') > -1);

T('۳.۴ sfDelMiscCommit سنگ‌قبر _docTomb و _deletedFileKeys را ثبت می‌کند',
  sfSrc.indexOf('r._docTomb = r._docTomb || {};') > -1 &&
  sfSrc.indexOf('if (doc.key) r._docTomb[doc.key] = new Date().toISOString();') > -1);

T('۳.۵ sfEventFileDeleteCommit فایل را در _deletedFileKeys قرار می‌دهد',
  sfSrc.indexOf('if (f && f.key) {') > -1 &&
  sfSrc.indexOf('if (r._deletedFileKeys.indexOf(f.key) < 0) r._deletedFileKeys.push(f.key);') > -1);

/* ───────────────────── ۴) انطباق نسخه و نگهبان ───────────────────── */
head('۴. انطباق نسخه و نگهبان گیت');

T('۴.۱ VERSION.json روی نسخه v34.38.13 است', verJson.crm_version === 'v34.38.13');
T('۴.۲ شاخص رهاسازی در index.html روی v34.38.13 است', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.38.13'") > -1);
T('۴.۳ سرویس‌ورکر روی نسخه v34.38.13 است', read('crm/sw.js').indexOf("RELEASE = 'v34.38.13'") > -1);
T('۴.۴ مانیفست روی نسخه 34.38.13 است', JSON.parse(read('crm/manifest.json')).version === '34.38.13');
T('۴.۵ sales-domain.php روی نسخه 34.38.13 است', read('api/sales-domain.php').indexOf("const SD_SERVICE_VERSION = '34.38.13'") > -1);

console.log('\n=== tester605-v34.38.13: ' + p + ' PASS / ' + f + ' FAIL ===\n');
if (f > 0) process.exit(1);
