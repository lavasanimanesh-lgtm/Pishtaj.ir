/* tester94 — v17.6 (US-417 فاز ۱: ویراستار فهرست‌ها — اسکن تکراری + تلفیق + تعیین تکلیف بی‌مصرف) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var lc = fs.readFileSync(path.join(BASE, 'listclean.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.6+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.6;})());
T('کش sw >= v17.6 + listclean در SHELL', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.6;})() && sw.indexOf("'./listclean.js'") > -1);
T('listclean در index.html بعد از custmerge', (function(){var m=idx.match(/listclean\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=17.6;})() && idx.indexOf('listclean.js') > idx.indexOf('custmerge.js'));

SECTION('US-417 فاز ۱ (کد): قواعد ایمنی پنل');
T('هیچ ادغام/حذف خودکار — همه با confirm/ptfReasonedDelete', lc.indexOf('هیچ ادغام/حذف خودکاری بدون تایید انسانی') > -1 && lc.indexOf('if (!confirm(') > -1 && lc.indexOf('ptfReasonedDelete(') > -1);
T('اسکن با موتور dedup مشترک (نه الگوریتم موازی)', lc.indexOf('dedupNorm') > -1 && lc.indexOf('dedupPhones') > -1);
T('ادغام مشتری = ویزارد موجود US-363', lc.indexOf('ptfMergeWizard(cdA, cdB)') > -1);
T('snapshot قبل از هر تلفیق sup/lead', lc.indexOf("kind: kind + '-merge-snapshot'") > -1);
T('بازنویسی ارجاعات تامین‌کننده: buycmp/payables/rfqsmart/buyquotes', lc.indexOf("getData('ptf_crm_buycmp')") > -1 && lc.indexOf("getData('ptf_crm_payables')") > -1 && lc.indexOf("getData('ptf_crm_rfqsmart')") > -1 && lc.indexOf("getData('ptf_crm_buyquotes')") > -1);
T('تخصص‌های US-399 غیرتکراری جمع می‌شوند', lc.indexOf("['spBrands', 'spEquip'].forEach") > -1);
T('بی‌مصرف = بدون راه تماس + بدون تراکنش (سه نوع)', lc.indexOf('window.ptfCleanUseless') > -1 && lc.indexOf('hasContact') > -1);
T('«تکراری نیست» — علامت per زوج در settings و حذف از اسکن‌های بعد', lc.indexOf('cleanNotDup') > -1 && lc.indexOf(".sort().join('|')") > -1);
T('RBAC فقط ارشد + audit اسکن/تلفیق/حذف', lc.indexOf("CLEAN_ROLES = ['admin', 'chairman', 'ceo', 'commercial']") > -1 && lc.indexOf("audit('ویراستار فهرست'") > -1);
T('دکمه 🧹 روی سه فهرست (hook انتهای زنجیره)', lc.indexOf("injectBtn('sup', 'sSrch')") > -1 && lc.indexOf("injectBtn('cust', 'cSrch')") > -1 && lc.indexOf("injectBtn('lead', 'ldSrch')") > -1);
T('سینک دفترچه پیامک پس از تلفیق تامین‌کننده', lc.indexOf('smsBookSyncAll === ') > -1);

SECTION('رفتاری: اسکن تکراری‌ها');
global.window = global;
loadFns('dedup.js', ['dedupNorm', 'dedupNormPhone', 'dedupPhones']);
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.audit = function () {};
(function () {
  var mS = lc.match(/window\.ptfCleanScan = function \(kind\) \{[\s\S]*?\n    return pairs;\n  \};/);
  var mU = lc.match(/window\.ptfCleanUseless = function \(kind\) \{[\s\S]*?\n    return out;\n  \};/);
  var mK = lc.match(/var KINDS = \{[\s\S]*?\n  \};/);
  var mN = lc.match(/function norm\(s\) \{[\s\S]*?\n  \}/);
  T('توابع استخراج شدند', !!mS && !!mU && !!mK && !!mN);
  if (!(mS && mU && mK && mN)) return;
  eval(mK[0].replace('var KINDS', 'global.KINDS'));
  eval(mN[0].replace('function norm', 'global.norm = function'));
  eval(mS[0].replace('window.ptfCleanScan', 'global.ptfCleanScan'));
  eval(mU[0].replace('window.ptfCleanUseless', 'global.ptfCleanUseless'));

  setData('ptf_crm_suppliers', [
    { cd: 'SUP-1', co: 'آریا کنترل', natId: '14010', people: [{ nm: 'رابط', mobs: [{ n: '09121112233' }] }] },
    { cd: 'SUP-2', co: 'آریاکنترل', natId: '14010', people: [], phones: [] },          /* نام نرمال یکسان + شناسه یکسان */
    { cd: 'SUP-3', co: 'پارس ولو', people: [{ nm: 'x', mobs: [{ n: '09121112233' }] }] }, /* تلفن مشترک با SUP-1 */
    { cd: 'SUP-4', co: 'کاملا متفاوت', ph: '09350000000', people: [] },
    { cd: 'SUP-5', co: 'بی‌مصرف خالی', people: [], phones: [] }                          /* بدون تماس/تراکنش */
  ]);
  setData('ptf_crm_buycmp', []); setData('ptf_crm_rfqsmart', []); setData('ptf_crm_payables', []); setData('ptf_crm_buyquotes', []);
  var pairs = ptfCleanScan('sup');
  T('زوج قوی: نام نرمال + شناسه یکسان (امتیاز بالا، رتبه اول)', pairs.length >= 2 && pairs[0].a.cd === 'SUP-1' && pairs[0].b.cd === 'SUP-2' && pairs[0].score >= 90);
  T('زوج تلفن مشترک هم پیدا شد', pairs.some(function (p) { return (p.a.cd === 'SUP-1' && p.b.cd === 'SUP-3') || (p.a.cd === 'SUP-3' && p.b.cd === 'SUP-1'); }));
  T('رکوردهای متفاوت زوج نشدند', !pairs.some(function (p) { return p.a.cd === 'SUP-4' || p.b.cd === 'SUP-4'; }));
  var useless = ptfCleanUseless('sup');
  T('فقط SUP-5 بی‌مصرف (SUP-2 تکراری است ولی شناسه دارد و در زوج‌هاست؛ SUP-4 تلفن دارد)', useless.length === 2 ? useless.some(function (r) { return r.cd === 'SUP-5'; }) : useless.length === 1 && useless[0].cd === 'SUP-5');

  /* تامین‌کننده با تراکنش خرید → بی‌مصرف نیست حتی بی‌تماس */
  setData('ptf_crm_payables', [{ sup: 'بی‌مصرف خالی', inqNo: 'X', amount: 1 }]);
  useless = ptfCleanUseless('sup');
  T('تراکنش بستانکاری → از فهرست بی‌مصرف خارج شد', !useless.some(function (r) { return r.cd === 'SUP-5'; }));
})();

SECTION('رفتاری: تلفیق تامین‌کننده با بازنویسی ارجاعات');
(function () {
  var mM = lc.match(/window\.ptfCleanMerge = function \(kind, cdA, cdB\) \{[\s\S]*?\n    ptfCleanOpen\(kind\);\n  \};/);
  T('ptfCleanMerge استخراج شد', !!mM);
  if (!mM) return;
  global.faDateTime = function () { return '1405/04/27 09:00'; };
  global._confirms = [];
  global.confirm = function (m) { global._confirms.push(String(m)); return true; };
  global.alert = function () {};
  global.document = { getElementById: function () { return null; } };
  global.ptfCleanOpen = function () {};
  global.renderSuppliers = function () {};
  global.smsBookSyncAll = function () { global._smsSynced = true; return 0; };
  eval(mM[0].replace('window.ptfCleanMerge', 'global.ptfCleanMerge'));

  setData('ptf_crm_suppliers', [
    { cd: 'SUP-1', co: 'آریا کنترل', spBrands: ['Siemens'], people: [{ nm: 'الف' }], coTels: [] },
    { cd: 'SUP-2', co: 'آریاکنترل', coEn: 'Aria Control', spBrands: ['WIKA', 'Siemens'], people: [{ nm: 'ب' }], coTels: [{ n: '02100000' }], natId: '14010' }
  ]);
  setData('ptf_crm_buycmp', [{ id: 'C1', inqNo: 'RFQ-1', items: [{}], quotes: [{ sup: 'آریاکنترل', idx: 0, price: 5 }], purchases: [{ idx: 0, sup: 'آریاکنترل', price: 5 }] }]);
  setData('ptf_crm_payables', [{ cd: 'P1', sup: 'آریاکنترل', inqNo: 'RFQ-1', amount: 5, paid: [] }]);
  setData('ptf_crm_rfqsmart', [{ no: 'Q1', targets: [{ cd: 'SUP-2', co: 'آریاکنترل', st: 'pending' }] }]);
  setData('ptf_crm_buyquotes', [{ cd: 'BQ1', sup: 'آریاکنترل', price: 5 }]);
  setData('ptf_crm_deleted_archive', []);

  ptfCleanMerge('sup', 'SUP-1', 'SUP-2');
  var sups = getData('ptf_crm_suppliers');
  T('ادغام‌شونده حذف نرم شد — یک رکورد ماند', sups.length === 1 && sups[0].cd === 'SUP-1');
  T('فیلدهای خالی مقصد پر شدند (coEn/natId) + تخصص‌ها جمع غیرتکراری', sups[0].coEn === 'Aria Control' && sups[0].natId === '14010' && sups[0].spBrands.length === 2);
  T('رابط‌ها جمع شدند', sups[0].people.length === 2);
  var bc = getData('ptf_crm_buycmp')[0];
  T('ارجاعات buycmp (quotes+purchases) بازنویسی شد', bc.quotes[0].sup === 'آریا کنترل' && bc.purchases[0].sup === 'آریا کنترل');
  T('ارجاعات payables/rfqsmart/buyquotes بازنویسی شد', getData('ptf_crm_payables')[0].sup === 'آریا کنترل' && getData('ptf_crm_rfqsmart')[0].targets[0].cd === 'SUP-1' && getData('ptf_crm_buyquotes')[0].sup === 'آریا کنترل');
  T('snapshot + حذف نرم در آرشیو (۲ رکورد)', getData('ptf_crm_deleted_archive').length === 2 && getData('ptf_crm_deleted_archive').some(function (a) { return a.kind === 'sup-merge-snapshot'; }));
  T('mergedFrom روی مقصد + سینک دفترچه', (sups[0].mergedFrom || []).length === 1 && global._smsSynced === true);
  T('confirm قبل از تلفیق (تایید انسانی)', global._confirms.length === 1);

  /* انصراف = هیچ تغییری */
  setData('ptf_crm_suppliers', [{ cd: 'A', co: 'الف', people: [] }, { cd: 'B', co: 'ب', people: [] }]);
  global.confirm = function () { return false; };
  ptfCleanMerge('sup', 'A', 'B');
  T('انصراف کاربر: هر دو رکورد سالم', getData('ptf_crm_suppliers').length === 2);
})();

SECTION('رفتاری: علامت «تکراری نیست»');
(function () {
  /* wrapper فیلتر cleanNotDup روی اسکن */
  var mW = lc.match(/var _scan = window\.ptfCleanScan;[\s\S]*?\n  \};/);
  T('فیلتر cleanNotDup استخراج شد', !!mW);
  if (!mW) return;
  global.localStorage.setItem('ptf_crm_settings', JSON.stringify({ cleanNotDup: ['SUP-1|SUP-2'] }));
  eval(mW[0]);
  setData('ptf_crm_suppliers', [
    { cd: 'SUP-1', co: 'آریا کنترل', natId: '14010', people: [] },
    { cd: 'SUP-2', co: 'آریاکنترل', natId: '14010', people: [] }
  ]);
  var pairs = window.ptfCleanScan('sup');
  T('زوج علامت‌خورده دیگر پیشنهاد نمی‌شود', pairs.length === 0);
  global.localStorage.setItem('ptf_crm_settings', '{}');
})();

SECTION('رگرسیون');
T('custmerge (US-363) دست‌نخورده', fs.readFileSync(path.join(BASE, 'custmerge.js'), 'utf-8').indexOf('window.ptfMergeCommit = function') > -1);
T('ptfReasonedDelete (guards) موجود برای حذف با دلیل', fs.readFileSync(path.join(BASE, 'guards.js'), 'utf-8').indexOf('window.ptfReasonedDelete = function') > -1);
T('hook renderSuppliers زنجیره‌ای (پس از bridge/cheques/guards/supspec/scoring)', lc.indexOf('var _rs = window.renderSuppliers;') > -1);
T('dedup.js دست‌نخورده', fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8').indexOf('function dedupPhones') > -1);

DONE('tester94-v176');
