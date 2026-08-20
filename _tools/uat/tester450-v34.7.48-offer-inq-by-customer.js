#!/usr/bin/env node
'use strict';
/* v34.7.49 — در مودال پیشنهاد، کشویی درخواست و «بارگذاری از درخواست دیگر»
   فقط درخواست‌های کارفرمای انتخاب‌شده را نشان می‌دهند. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var dd = read('crm/dedup.js');
var off = read('crm/offers.js');
var ver = JSON.parse(read('VERSION.json'));

T('VERSION.json = v34.7.55', ver.crm_version === 'v34.7.55', ver.crm_version);
T('امضای ptfKnownInqList() بدون پارامتر مانده (tester202)', /function ptfKnownInqList\(\) \{/.test(dd));
T('ptfInqBelongsToCustomer تعریف شده', /function ptfInqBelongsToCustomer\(inqOrRfq, buyerCd\)/.test(dd));
T('ptfInqNoOptions آرگومان buyerCd دارد', /function ptfInqNoOptions\(cur, buyerCd\)/.test(dd));
T('offerForm کشویی را با buyerCd می‌سازد', /ptfInqNoOptions\(o\.inqNo, o\.buyerCd\)/.test(off));
T('تغییر کارفرما فهرست درخواست را تازه می‌کند', /offRefreshInqOptions\(cd, keep\)/.test(off) && /window\.offRefreshInqOptions = function/.test(off));
T('بارگذاری از درخواست دیگر buyerCd می‌فرستد', /offListLoadableInquiries\(\{ exclude: current \? \[current\] : \[\], buyerCd: buyerCd \}\)/.test(off));
T('بدون کارفرما، دیالوگ درخواست دیگر هشدار می‌دهد', off.indexOf('ابتدا کارفرما را از منوی کشویی انتخاب کنید') > -1);
T('picker خالی هم به همین کارفرما محدود است', off.indexOf('انتخاب درخواست همین کارفرما') > -1);

function engine() {
  var db = {
    ptf_crm_customers: [
      { cd: 'CUST-A', co: 'شرکت الف', coEn: 'Alpha Co' },
      { cd: 'CUST-B', co: 'شرکت ب', coEn: 'Beta Co' }
    ],
    ptf_crm_rfqs: [
      { cd: 'RFQ-A1', inqNo: 'INQ-A1', co: 'شرکت الف', custCd: 'CUST-A', items: [{ nm: 'شیر' }] },
      { cd: 'RFQ-A2', inqNo: 'INQ-A2', co: 'شرکت الف', custCd: 'CUST-A', items: [{ nm: 'فلنج' }] },
      { cd: 'RFQ-B1', inqNo: 'INQ-B1', co: 'شرکت ب', custCd: 'CUST-B', items: [{ nm: 'پمپ' }] },
      { cd: 'RFQ-LEG', inqNo: 'INQ-LEG', co: 'شرکت الف' }
    ],
    ptf_crm_inqitems: [
      { inqNo: 'INQ-A1', nm: 'شیر', un: 'عدد', qty: 1 },
      { inqNo: 'INQ-A2', nm: 'فلنج', un: 'عدد', qty: 2 },
      { inqNo: 'INQ-B1', nm: 'پمپ', un: 'عدد', qty: 1 },
      { inqNo: 'INQ-LEG', nm: 'واشر', un: 'عدد', qty: 3 }
    ],
    ptf_crm_inqreads: []
  };
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object,
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return {}; }, addEventListener: function () {}, body: { insertAdjacentHTML: function () {} } },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    window: null
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/dedup.js'), sb, { filename: 'dedup.js' });
  function cut(a, b) {
    var i = off.indexOf(a), j = off.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('cut missing ' + a);
    return off.slice(i, j);
  }
  vm.runInContext(cut('window.ptfResolveInqRequest = function', 'function offLoadInqItems'), sb, { filename: 'offers.js#list' });
  return sb;
}

(function runtime() {
  var s;
  try { s = engine(); } catch (e) { T('sandbox', false, String(e && e.message || e)); return; }
  T('sandbox', typeof s.ptfInqBelongsToCustomer === 'function' && typeof s.ptfInqNoOptions === 'function' && typeof s.offListLoadableInquiries === 'function');

  T('تطبیق با custCd', s.ptfInqBelongsToCustomer('RFQ-A1', 'CUST-A') === true && s.ptfInqBelongsToCustomer('RFQ-B1', 'CUST-A') === false);
  T('تطبیق نام برای استعلام قدیمی بدون custCd', s.ptfInqBelongsToCustomer('RFQ-LEG', 'CUST-A') === true && s.ptfInqBelongsToCustomer('RFQ-LEG', 'CUST-B') === false);

  var all = s.ptfInqNoOptions('');
  T('بدون آرگومان دوم همهٔ درخواست‌ها در گزینه‌ها هستند (سازگاری)', all.indexOf('RFQ-A1') > -1 && all.indexOf('RFQ-B1') > -1);

  var onlyA = s.ptfInqNoOptions('', 'CUST-A');
  T('با CUST-A فقط درخواست‌های الف در کشویی‌اند', onlyA.indexOf('RFQ-A1') > -1 && onlyA.indexOf('RFQ-A2') > -1 && onlyA.indexOf('RFQ-LEG') > -1 && onlyA.indexOf('RFQ-B1') < 0);
  T('بدون کارفرما کشویی خالی است (جز placeholder)', s.ptfInqNoOptions('', '').indexOf('RFQ-A1') < 0 && s.ptfInqNoOptions('', '').indexOf('ابتدا کارفرما') > -1);
  T('شماره سند فعلی حتی اگر مشتری دیگر باشد حفظ می‌شود', s.ptfInqNoOptions('RFQ-B1', 'CUST-A').indexOf('RFQ-B1') > -1);

  var loadA = s.offListLoadableInquiries({ buyerCd: 'CUST-A' });
  var keysA = loadA.map(function (x) { return x.key; });
  T('فهرست بارگذاری دیگر فقط الف را دارد', keysA.indexOf('RFQ-A1') > -1 && keysA.indexOf('RFQ-B1') < 0, JSON.stringify(keysA));
  var loadB = s.offListLoadableInquiries({ buyerCd: 'CUST-B' });
  T('فهرست CUST-B پمپ ب را دارد نه الف', loadB.some(function (x) { return x.key === 'RFQ-B1'; }) && !loadB.some(function (x) { return x.key === 'RFQ-A1'; }));
  T('بدون buyerCd در opt همه برمی‌گردند (سازگاری)', s.offListLoadableInquiries({}).some(function (x) { return x.key === 'RFQ-B1'; }) && s.offListLoadableInquiries({}).some(function (x) { return x.key === 'RFQ-A1'; }));
})();

console.log('\n— tester450 (v34.7.49: فیلتر درخواست مودال بر حسب کارفرما) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

