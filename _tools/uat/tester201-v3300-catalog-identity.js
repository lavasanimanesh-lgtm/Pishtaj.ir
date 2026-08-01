/* S2 — هویت کاتالوگ: ممیزی، صف بررسی، اتصال دقیق، تشخیص شباهت و ادغام کنترل‌شده */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'data-quality.js'), 'utf-8');

global.curSession = function () { return { user: 'tester', name: 'تستر کاتالوگ' }; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._toasts = [];
global.ptfToast = function (m) { global._toasts.push(String(m)); };

function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
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

/* ---------- دادهٔ پایه ---------- */
setData('ptf_crm_products', [
  { cd: 'P1', nm: 'لوله بدون درز', en: 'seamless pipe 6in sch 40 astm a106 gr.b', st: 'A106 Gr.B', md: 'A106', un: 'شاخه' },
  { cd: 'P2', nm: 'لوله بدون درز', en: 'seamless pipe 6in sch 40 astm a106 gr.b', st: 'A106 Gr.B', md: 'A106', un: 'شاخه' },
  { cd: 'P4', nm: 'لوله بدون درز C', en: 'seamless pipe 6in sch 40 astm a106 gr.b', st: 'A106 Gr.B', md: 'A106', un: 'شاخه' },
  { cd: 'P3', nm: 'ترانسمیتر فشار', en: 'pressure transmitter', st: '4-20mA', un: 'عدد' }
]);
setData('ptf_crm_offers', [{ no: 'O1', items: [
  { name: 'لوله بدون درز', spec: 'A106 Gr.B', md: 'A106', unit: 'شاخه', pcode: 'P1' },   /* متصل */
  { name: 'لوله بدون درز', spec: 'A106 Gr.B', md: 'A106', unit: 'شاخه' },                /* مبهم: P1 و P2 */
  { name: 'گیج فشار', spec: '0-16bar', unit: 'عدد' },                                     /* بدون نامزد */
  { name: 'ترانسمیتر فشار', spec: '4-20mA', unit: 'عدد' }                                 /* یک نامزد دقیق: P3 */
] }]);
setData('ptf_crm_catalog_reviews', []);
setData('ptf_crm_catalog_merges', []);

SECTION('ساختار');
T('توابع هویت کاتالوگ موجودند', code.indexOf('window.ptfCatalogIdentityAudit') > -1 && code.indexOf('window.ptfCatalogSimilarAudit') > -1 && code.indexOf('window.ptfCatalogMergeConfirm') > -1);
T('کلید ادغام در sync/backup/api تعریف شده', (function () {
  var b = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
  var s = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
  var a = fs.readFileSync(path.resolve(BASE, '../api/crm.php'), 'utf-8');
  return b.indexOf('ptf_crm_catalog_merges') > -1 && s.indexOf('ptf_crm_catalog_merges') > -1 && a.indexOf('ptf_crm_catalog_merges') > -1;
})());

SECTION('ممیزی هویت فقط‌خواندنی');
var report = ptfCatalogIdentityAudit();
T('گزارش read-only و شمارش درست', report.readOnly === true && report.counts.linked === 1 && report.counts.ambiguous === 1 && report.counts.missing === 1);
T('هیچ داده‌ای تغییر نکرد', getData('ptf_crm_offers')[0].items[1].pcode == null && getData('ptf_crm_products').length === 4);

SECTION('صف بررسی');
ptfCatalogReviewQueue('O1', 3);
var queue = getData('ptf_crm_catalog_reviews');
T('قلم بدون نامزد در صف ثبت شد', queue.length === 1 && queue[0].offerNo === 'O1' && queue[0].lineNo === 3 && queue[0].status === 'pending_review' && queue[0].item.name === 'گیج فشار');
ptfCatalogReviewQueue('O1', 3);
T('ثبت تکراری جلوگیری شد', getData('ptf_crm_catalog_reviews').length === 1);
T('صف بررسی در sync تعریف شده', fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8').indexOf('ptf_crm_catalog_reviews') > -1);

SECTION('اتصال دقیق (exact link)');
T('اتصال با نامزد غیریکتا رد می‌شود', (function () {
  global._alerts.length = 0;
  ptfCatalogIdentityLink('O1', 2, 'P3'); /* قلم ۲ مبهم است (P1/P2) */
  return global._alerts.length === 1 && getData('ptf_crm_offers')[0].items[1].pcode == null;
})());
ptfCatalogIdentityLink('O1', 4, 'P3'); /* تطبیق یکتا با P3 */
T('اتصال دقیق ثبت شد', getData('ptf_crm_offers')[0].items[3].pcode === 'P3');

SECTION('تشخیص شباهت (fingerprint)');
var sim = ptfCatalogSimilarAudit();
T('سه کالای مشابه یک گروه ساختند', sim.readOnly === true && sim.groupCount === 1 && sim.groups[0].products.length === 3);
T('اطمینان بالا (۴+ توکن)', sim.groups[0].confidence === 'high');
T('کالای نامرتبط خارج از گروه است', sim.groups[0].products.filter(function (p) { return p.cd === 'P3'; }).length === 0);
T('گزارش در _ptfCatalogSimilarReport ذخیره شد', window._ptfCatalogSimilarReport === sim);

SECTION('ادغام کنترل‌شده');
global._domGet['ptfMergeCanonical'] = { value: 'P1' };
global._domGet['ptfMergeName'] = { value: 'لوله بدون درز 6 اینچ A106' };
ptfCatalogMergeConfirm(0);
var products = getData('ptf_crm_products');
var merges = getData('ptf_crm_catalog_merges');
T('کالای اصلی به‌روز شد (شرح + ۲ alias)', products.filter(function (p) { return p.cd === 'P1'; })[0].nm === 'لوله بدون درز 6 اینچ A106' && products.filter(function (p) { return p.cd === 'P1'; })[0].aliases.length === 2);
T('کالاهای فرعی حذف نشدند؛ merged شدند', products.length === 4 && products.filter(function (p) { return p.cd === 'P2'; })[0].hidden === true && products.filter(function (p) { return p.cd === 'P2'; })[0].status === 'merged' && products.filter(function (p) { return p.cd === 'P2'; })[0].mergedInto === 'P1' && products.filter(function (p) { return p.cd === 'P4'; })[0].mergedInto === 'P1');
T('سابقهٔ ادغام ثبت شد', merges.length === 1 && merges[0].canonicalCd === 'P1' && merges[0].mergedCds.length === 2 && merges[0].mergedCds.indexOf('P2') > -1 && merges[0].mergedCds.indexOf('P4') > -1 && merges[0].status === 'approved');
T('ارجاع‌های هویتی در offers بازنویسی شد', (function () {
  var offers = getData('ptf_crm_offers'), rewritten = false, deleted = false;
  offers.forEach(function (o) { (o.items || []).forEach(function (it) { if (it.pcode === 'P2') rewritten = true; }); });
  return !rewritten;
})());
/* قلم ۲ (متصل به P1) دست‌نخورده بماند */
T('ارجاع متصل به P1 دست‌نخورده ماند', getData('ptf_crm_offers')[0].items[0].pcode === 'P1');
T('referenceKeys برای بازبینی ثبت شد', Array.isArray(merges[0].referenceKeys) && merges[0].referenceKeys.length >= 9);

SECTION('گارد ادغام');
global._alerts.length = 0;
global._domGet['ptfMergeName'] = { value: '' };
var beforeMerge = getData('ptf_crm_catalog_merges').length;
ptfCatalogMergeConfirm(0);
T('بدون شرح نهایی → هشدار و عدم ثبت', global._alerts.length === 1 && getData('ptf_crm_catalog_merges').length === beforeMerge);

DONE('tester201-v3300-catalog-identity');
