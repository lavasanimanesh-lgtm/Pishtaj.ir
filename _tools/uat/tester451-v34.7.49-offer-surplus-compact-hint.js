#!/usr/bin/env node
'use strict';
/* v34.7.49 — کادر سبز مودال پیشنهاد موجودی انبار را خلاصه می‌کند؛ فهرست کامل در نوار نمی‌آید. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var su = read('crm/surplus.js');
var ver = JSON.parse(read('VERSION.json'));

T('VERSION.json = v34.17.0', ver.crm_version === 'v34.17.0', ver.crm_version);
T('hookOfferNew برای tester171 مانده', su.indexOf('function hookOfferNew') > -1);
T('polling جدید اضافه نشده', su.indexOf('setInterval') === -1);
T('لیست پشت‌سرهم نام کالاها از کادر پیش‌فرض حذف شده', su.indexOf('مازاد موجود:') === -1 && su.indexOf('avail.slice(0,5)') === -1);
T('بنر فشرده فقط تعداد قلم/واحد را نشان می‌دهد', /موجودی انبار: <b>' \+ lots/.test(su) && su.indexOf('قلم قابل استفاده') > -1);
T('فهرست پیش‌فرض بسته است', su.indexOf('offSurplusHintList') > -1 && /display:none;margin-top:8px/.test(su));
T('فهرست بازشده سقف ارتفاع و اسکرول دارد', su.indexOf('max-height:180px') > -1 && su.indexOf('overflow:auto') > -1);
T('جستجو روی فهرست بازشده هست', su.indexOf('ptfOfferSurplusHintFilter') > -1);
T('بنر به offerForm وصل است نه dump داخل offerNew', /window\.offerForm=function\(\)\{ _of\.apply\(this,arguments\)/.test(su));

function engine() {
  var inserted = [];
  var itemsWrap = { id: 'offItemsWrap' };
  var hint = null;
  var db = { ptf_crm_surplus: [
    { cd: 'S1', prodCd: 'P-1', prodName: 'شیر کنترل', qty: 10, reservedQty: 0, soldQty: 0, location: 'کارگاه' },
    { cd: 'S2', prodCd: 'P-2', prodName: 'فلنج', qty: 4, reservedQty: 1, soldQty: 0, location: 'انبار' },
    { cd: 'S3', prodCd: 'P-3', prodName: 'گیج', qty: 2, reservedQty: 0, soldQty: 2, location: 'کارگاه' }
  ], ptf_crm_products: [] };
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object,
    getData: function (k) { return db[k] || []; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDateTime: function () { return '1405/05/29'; },
    curSession: function () { return { name: 'آزمون' }; },
    audit: function () {},
    ptfUnifiedCode: function () { return 'SURP-T'; },
    offerForm: function () {},
    offerNew: function () {},
    offerSetSt: function () {},
    document: {
      getElementById: function (id) {
        if (id === 'offItemsWrap') return itemsWrap;
        if (id === 'offSurplusHint') return hint;
        return null;
      },
      querySelectorAll: function () { return []; }
    },
    window: null
  };
  itemsWrap.insertAdjacentHTML = function (pos, html) { inserted.push({ pos: pos, html: html }); hint = { id: 'offSurplusHint' }; };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/surplus.js'), sb, { filename: 'surplus.js' });
  sb._inserted = inserted;
  return sb;
}

(function runtime() {
  var s;
  try { s = engine(); } catch (e) { T('sandbox', false, String(e && e.message || e)); return; }
  T('sandbox', typeof s.ptfOfferSurplusBanner === 'function');
  s.ptfOfferSurplusBanner();
  var html = (s._inserted[0] && s._inserted[0].html) || '';
  T('کادر پیش‌فرض نام کالا را لیست نمی‌کند', html.indexOf('شیر کنترل') < 0 && html.indexOf('فلنج') < 0 && html.indexOf('گیج') < 0, html.slice(0, 180));
  T('خلاصه تعداد قلم‌های قابل استفاده را می‌گوید', html.indexOf('2') > -1 && html.indexOf('قلم قابل استفاده') > -1, html.slice(0, 220));
  T('قلم فروخته‌شده در شمارش نمی‌آید', html.indexOf('گیج') < 0);
})();

console.log('\n— tester451 (v34.7.49: کادر فشرده موجودی انبار) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
