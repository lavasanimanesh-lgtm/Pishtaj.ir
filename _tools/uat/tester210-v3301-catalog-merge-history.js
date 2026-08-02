/* S3 — تاریخچهٔ ادغام کاتالوگ + بازگشت امن (undo) */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'data-quality.js'), 'utf-8');

global.curSession = function () { return { user: 'tester', name: 'تستر کاتالوگ' }; };
global.faDateTime = function () { return '1405/05/10 12:00'; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._toasts = [];
global.ptfToast = function (m) { global._toasts.push(String(m)); };
global._inserted = [];
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function (_, h) { global._inserted.push(h); }, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};

eval.call(global, code);

/* ---------- دادهٔ پایه: یک ادغام انجام‌شده (approved) + کالاها ---------- */
setData('ptf_crm_products', [
  { cd: 'P1', nm: 'لوله بدون درز 6 اینچ A106', aliases: ['لوله بدون درز B', 'لوله بدون درز C'] },
  { cd: 'P2', nm: 'لوله بدون درز B', hidden: true, status: 'merged', mergedInto: 'P1', mergedAt: '1405/05/01' },
  { cd: 'P4', nm: 'لوله بدون درز C', hidden: true, status: 'merged', mergedInto: 'P1', mergedAt: '1405/05/01' }
]);
setData('ptf_crm_offers', [{ no: 'O1', items: [{ name: 'x', pcode: 'P1' }] }]); /* ارجاع بازنویسی‌شدهٔ قبلی */
setData('ptf_crm_catalog_merges', [{
  cd: 'CATMERGE-1', canonicalCd: 'P1', mergedCds: ['P2', 'P4'], finalName: 'لوله بدون درز 6 اینچ A106',
  status: 'approved', t: '1405/05/01 10:00', by: 'تستر', referenceKeys: ['ptf_crm_offers']
}]);

SECTION('ساختار');
T('توابع تاریخچه/بازگشت موجودند', code.indexOf('window.ptfCatalogMergeHistory') > -1 && code.indexOf('window.ptfCatalogMergeUndo') > -1);
T('دکمهٔ «تاریخچهٔ ادغام» در تب کیفیت داده هست', code.indexOf('🧩 تاریخچهٔ ادغام') > -1);

SECTION('نمایش تاریخچه');
ptfCatalogMergeHistory();
var h = global._inserted[global._inserted.length - 1] || '';
T('مودال تاریخچه با جدول (کالای اصلی/فرعی/توسط/وضعیت) ساخته شد', h.indexOf('تاریخچهٔ ادغام کالاها') > -1 && h.indexOf('CATMERGE-1') > -1 && h.indexOf('P2، P4') > -1 && h.indexOf('فعال') > -1 && h.indexOf('بازگشت') > -1);

SECTION('بازگشت (undo)');
ptfCatalogMergeUndo('CATMERGE-1');
var products = getData('ptf_crm_products');
T('کالاهای فرعی دوباره فعال شدند (hidden=false، status=active، mergedInto حذف)', products.filter(function (p) { return p.cd === 'P2'; })[0].hidden === false && products.filter(function (p) { return p.cd === 'P2'; })[0].status === 'active' && products.filter(function (p) { return p.cd === 'P2'; })[0].mergedInto == null && products.filter(function (p) { return p.cd === 'P4'; })[0].status === 'active');
T('aliasهای افزوده از کالای اصلی حذف شدند', products.filter(function (p) { return p.cd === 'P1'; })[0].aliases.length === 0);
T('رکورد ادغام reverted شد + متادیتا', getData('ptf_crm_catalog_merges')[0].status === 'reverted' && getData('ptf_crm_catalog_merges')[0].revertedBy === 'تستر کاتالوگ');
T('ارجاع‌های بازنویسی‌شدهٔ قبلی دست‌نخورده ماندند (pcode همچنان P1)', getData('ptf_crm_offers')[0].items[0].pcode === 'P1');
T('بازگشت دوباره مسدود شد', (function () {
  global._alerts.length = 0;
  var before = JSON.stringify(getData('ptf_crm_products'));
  ptfCatalogMergeUndo('CATMERGE-1');
  return global._alerts.length === 1 && JSON.stringify(getData('ptf_crm_products')) === before;
})());
T('بازگشت رکورد ناموجود → هشدار', (function () {
  global._alerts.length = 0;
  ptfCatalogMergeUndo('NOPE');
  return global._alerts.length === 1;
})());

DONE('tester210-v3301-catalog-merge-history');
