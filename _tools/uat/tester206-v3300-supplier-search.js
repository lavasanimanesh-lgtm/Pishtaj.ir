/* S3 — UR-2026-08-01-06: جستجوی تامین‌کننده با نام/برند در پنجره‌های استعلام/ثبت خرید */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sup = fs.readFileSync(path.join(BASE, 'supspec.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');

/* ---------- محیط supspec ---------- */
global.dedupNorm = function (s) { return String(s || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()/\\]/g, '').toLowerCase(); };
global.curSession = function () { return { user: 'tester', name: 'تستر' }; };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {}, getAttribute: function () { return ''; },
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {}; global._domQSA = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function (sel) { return global._domQSA[sel] || []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};
global.window.entityMatches = function () { return false; }; /* بدون offers.js */
eval.call(global, sup);

/* ---------- دادهٔ تامین‌کنندگان ---------- */
setData('ptf_crm_suppliers', [
  { cd: 'S1', co: 'تجهیزکار پارس', spBrands: ['Siemens', 'WIKA'], spEquip: ['ترانسمیتر فشار', 'تابلو برق'] },
  { cd: 'S2', co: 'WIKA ایران', spBrands: ['WIKA'], spEquip: ['گیج فشار'] },
  { cd: 'S3', co: 'کیش تجهیز', spBrands: ['Rosemount'], spEquip: ['فلومتر'] },
  { cd: 'S4', co: 'تهران پایپ', brands: 'Fisher, Masoneilan' }
]);

SECTION('جستجو با نام');
var byName = ptfSupSearch('کیش تجهیز');
T('نام کامل → دقیقاً همان تامین‌کننده (امتیاز بالا)', byName.length >= 1 && byName[0].co === 'کیش تجهیز');
var byPart = ptfSupSearch('پارس');
T('بخشی از نام پیدا می‌شود', byPart.some(function (s) { return s.co === 'تجهیزکار پارس'; }));

SECTION('جستجوی برند-آگاه دوزبانه');
var siemensFa = ptfSupSearch('زیمنس');
T('«زیمنس» تامین‌کننده با spBrands=Siemens را پیدا می‌کند', siemensFa.some(function (s) { return s.co === 'تجهیزکار پارس'; }));
var siemensEn = ptfSupSearch('Siemens');
T('«Siemens» هم همان را پیدا می‌کند', siemensEn.some(function (s) { return s.co === 'تجهیزکار پارس'; }));
var wika = ptfSupSearch('ویکا');
T('«ویکا» هر دو تامین‌کنندهٔ مرتبط را پیدا می‌کند', wika.some(function (s) { return s.co === 'تجهیزکار پارس'; }) && wika.some(function (s) { return s.co === 'WIKA ایران'; }));
var fisher = ptfSupSearch('Fisher');
T('جستجو در فیلد brands (تامین‌کنندهٔ قدیمی) کار می‌کند', fisher.some(function (s) { return s.co === 'تهران پایپ'; }));

SECTION('جستجوی تجهیزات');
var equip = ptfSupSearch('گیج فشار');
T('جستجوی تجهیز تخصصی (گیج فشار) نتیجه می‌دهد', equip.some(function (s) { return s.co === 'WIKA ایران'; }));

SECTION('جستجوی خالی');
var empty = ptfSupSearch('');
T('جستجوی خالی → حداکثر ۱۲ تامین‌کننده', empty.length <= 12);

SECTION('پیکر (picker)');
var html = ptfSupPickerHtml('supX', 'کیش تجهیز', "onPickX(name)");
T('پیکر شامل input و لیست و data-onpick است', html.indexOf('id="supX"') > -1 && html.indexOf('supXList') > -1 && html.indexOf('data-onpick="onPickX(name)"') > -1);

SECTION('اتصال در buycompare.js');
T('پنجرهٔ ثبت قیمت (استعلام) از پیکر استفاده می‌کند', bc.indexOf("ptfSupPickerHtml('cmpSup'") > -1);
T('تقسیم خرید هر ردیف از پیکر با cmpSplitField استفاده می‌کند', bc.indexOf("ptfSupPickerHtml('cmpSplitSup'") > -1 && bc.indexOf("cmpSplitField(\" + ri + \",'sup',name)") > -1);
T('ثبت خرید واقعی فیلد جستجو + cmpBuySupPick دارد', bc.indexOf('cmpBuySupPick') > -1 && bc.indexOf("ptfSupPickerHtml('cmpBuySupPick'") > -1);
T('cmpBuySupPick مقدار دستی را در فیلد «ورود دستی» می‌نویسد', bc.indexOf('manualInput.value = name') > -1);

DONE('tester206-v3300-supplier-search');
