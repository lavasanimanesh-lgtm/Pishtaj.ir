/* tester129 — v21.3 (US-450 فیلتر پیشنهاد بر مشتری + BUG-038 دفترچه پیامکی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sms = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var kb = fs.readFileSync(path.join(BASE, 'kanban.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.3');
T('VER v21.3+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=3);})(m[1]);})());
T('SW v21.3+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=3);})(m[1]);})());
T('cache sms/offers/kanban', /sms\.js\?v=/.test(idx) && /offers\.js\?v=/.test(idx) && /kanban\.js\?v=/.test(idx));

SECTION('BUG-038 ساختاری — ریشه ارقام فارسی + پوشش فیلدها');
T('toEnDigitsLocal / ptfToEnDigits', sms.indexOf('ptfToEnDigits') > -1 || sms.indexOf('۰۱۲۳۴۵۶۷۸۹') > -1);
T('normMob قبل از \\D ارقام فارسی را لاتین می‌کند', sms.indexOf('ptfToEnDigits') > -1 || sms.indexOf('۰۱۲۳۴۵۶۷۸۹') > -1);
T('pushMob helper', sms.indexOf('function pushMob') > -1);
T('جمع people.mobs', sms.indexOf('p.mobs') > -1);
T('جمع people.tels موبایل‌مانند', sms.indexOf('p.tels') > -1);
T('جمع coTels', sms.indexOf('coTels') > -1);
T('جمع phones بدون الزام k=mob سخت', sms.indexOf("p.k !== 'mob'") > -1 || sms.indexOf("p.k !== 'mobile'") > -1);
T('فیلدهای تخت ph/mob', sms.indexOf("['ph', 'mob', 'tel', 'phone']") > -1);
T('hook ذخیره مشتری/تامین', sms.indexOf('saveCust2') > -1 && sms.indexOf('smsBookSyncAll') > -1);

SECTION('BUG-038 رفتاری — normMob با ارقام فارسی');
// extract normMob + toEnDigitsLocal by evaluating minimal IIFE pieces
var mNm = sms.match(/function normMob\(m\) \{[\s\S]*?\n  \}/);
T('extract helpers', !!mNm);
if (mNm) {
  eval(mNm[0]);
  T('لاتین 09121234567', normMob('09121234567') === '09121234567');
  T('فارسی ۰۹۱۲۱۲۳۴۵۶۷', normMob('۰۹۱۲۱۲۳۴۵۶۷') === '09121234567');
  T('+98', normMob('+989121234567') === '09121234567');
  T('بدون صفر 9121234567', normMob('9121234567') === '09121234567');
  T('تلفن ثابت رد', normMob('02188000000') === '');
  T('فارسی ثابت رد', normMob('۰۲۱۸۸۰۰۰۰۰۰') === '');
  T('خالی', normMob('') === '');
}

SECTION('BUG-038 رفتاری — smsBookSyncAll روی داده واقعی');
// eval full sms IIFE needs many globals - simulate collect logic via running function after eval file carefully
store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};
global.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
global.setData = function (k, d) { store[k] = JSON.stringify(d); };
global.window = global;
global.document = { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {}, textContent: '' }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {} };
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { name: 'A', user: 'a' }; };
global.faDate = function () { return '1405/04/20'; };
global.faDateTime = function () { return '1405/04/20 12:00'; };
global.escP = function (s) { return String(s == null ? '' : s); };
global.genCode = function (p) { return p + '-' + Math.floor(Math.random() * 100000); };
global.audit = function () {};
global.notify = function () {};
global.alert = function () {};
global.confirm = function () { return true; };
global.ptfToEnDigits = function (s) {
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); });
};
global._ptfSyncBootstrapped = true;
global.XLSX = null;
global.fetch = function () { return Promise.reject(new Error('no')); };
global.API = '../api/crm.php';
// seed customers with FA digits (exactly the bug case)
setData('ptf_crm_customers', [
  { cd: 'C1', co: 'فولاد نمونه', people: [{ nm: 'علی', mobs: [{ n: '۰۹۱۲۱۱۱۱۱۱۱' }], tels: [{ n: '۰۲۱۸۸۰۰۰۰۰۰' }] }], coTels: [{ n: '۰۹۳۵۲۲۲۲۲۲۲' }], ph: '' },
  { cd: 'C2', co: 'پتروشیمی', people: [], phones: [{ k: 'mob', n: '09123333333' }], ph: '09124444444' },
  { cd: 'C3', co: 'فقط ثابت', people: [{ nm: 'رضا', tels: [{ n: '021 cro' }], mobs: [] }], coTels: [{ n: '02199999999' }] }
]);
setData('ptf_crm_suppliers', []);
setData('ptf_crm_smsbook', []);
// Load sms module
eval(sms);
T('smsBookSyncAll defined', typeof smsBookSyncAll === 'function');
var n = smsBookSyncAll();
var book = getData('ptf_crm_smsbook');
var custBook = book.filter(function (r) { return r.cat === 'cust'; });
T('حداقل ۲ موبایل از C1 (person+coTel)', custBook.filter(function (r) { return r.ent === 'فولاد نمونه'; }).length >= 2);
T('موبایل فارسی شخص → 09121111111', custBook.some(function (r) { return r.mob === '09121111111'; }));
T('coTel موبایل فارسی → 09352222222', custBook.some(function (r) { return r.mob === '09352222222'; }));
T('phones k=mob لاتین', custBook.some(function (r) { return r.mob === '09123333333'; }));
T('ph تخت', custBook.some(function (r) { return r.mob === '09124444444'; }));
T('تلفن ثابت وارد دفترچه نشد', !custBook.some(function (r) { return r.mob.indexOf('021') === 0; }));
T('همه cat=cust برای مشتریان', custBook.every(function (r) { return r.cat === 'cust' && r.src === 'auto'; }));
T('n>0', n > 0 && book.length > 0);

SECTION('US-450 ساختاری — فیلتر مشتری پیشنهاد');
T('oFcust select', off.indexOf('id="oFcust"') > -1 || off.indexOf("id=\\\"oFcust\\\"") > -1 || off.indexOf("id=\"oFcust\"") > -1 || off.indexOf('oFcust') > -1);
T('offSetCustFilter', off.indexOf('window.offSetCustFilter') > -1);
T('ptfOfferMatchCust', off.indexOf('window.ptfOfferMatchCust') > -1);
T('renderOffers از فیلتر مشتری', off.indexOf('ptfOfferMatchCust(o, custF)') > -1 || off.indexOf('_offCustFilter') > -1);
T('kanban همان فیلتر', kb.indexOf('ptfOfferMatchCust') > -1 && kb.indexOf('_offCustFilter') > -1);
T('hint فیلتر', off.indexOf('oFcustHint') > -1);

SECTION('US-450 رفتاری — match');
var mMatch = off.match(/window\.ptfOfferMatchCust = function \(o, custCd\) \{[\s\S]*?\n\};/);
T('extract ptfOfferMatchCust', !!mMatch);
if (mMatch) {
  global.dedupNorm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
  eval(mMatch[0].replace('window.ptfOfferMatchCust', 'global.ptfOfferMatchCust'));
  setData('ptf_crm_customers', [
    { cd: 'CU1', co: 'فولاد مبارکه', coEn: 'Mobarakeh Steel' }
  ]);
  T('بدون فیلتر همه', ptfOfferMatchCust({ buyerCd: 'X' }, '') === true);
  T('match buyerCd', ptfOfferMatchCust({ buyerCd: 'CU1', buyerCo: 'x' }, 'CU1') === true);
  T('mismatch buyerCd', ptfOfferMatchCust({ buyerCd: 'OTHER', buyerCo: 'فولاد مبارکه' }, 'CU1') === false);
  T('fallback نام بدون buyerCd', ptfOfferMatchCust({ buyerCd: '', buyerCo: 'فولاد مبارکه' }, 'CU1') === true);
  T('fallback coEn', ptfOfferMatchCust({ buyerCd: '', buyerCo: 'Mobarakeh Steel' }, 'CU1') === true);
  T('نام نامرتبط', ptfOfferMatchCust({ buyerCd: '', buyerCo: 'شرکت دیگر' }, 'CU1') === false);
}

DONE('tester129-v213');
if (RESULTS.fail) process.exit(1);
