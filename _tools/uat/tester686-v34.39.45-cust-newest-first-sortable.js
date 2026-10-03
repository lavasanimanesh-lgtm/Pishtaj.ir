/* tester686 — v34.39.45 (CUST-SORT): مشتری تازه در صدر فهرست + سورت کلیک‌خور سرستون‌ها.
   توابع مرتب‌سازی از دل crm/index.html استخراج و در محیط ایزوله اجرا می‌شوند. */
'use strict';
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '../../crm/index.html'), 'utf8');
var offersJs = fs.readFileSync(path.join(__dirname, '../../crm/offers.js'), 'utf8');

/* ---- استخراج بلوک توابع سورت مشتریان از index.html ---- */
var startTok = 'function ptfCustTs(';
var endTok = 'function renderCustomers()';
var s = html.indexOf(startTok);
var e = html.indexOf(endTok);
if (s < 0 || e < 0 || e < s) { console.log('FAIL: sort block not found in crm/index.html'); process.exit(1); }
var sortBlock = html.slice(s, e);

/* ---- محیط ایزوله ---- */
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
global.window = global;
global.document = { getElementById: function () { return { textContent: '', title: '' }; } };
/* لایهٔ دادهٔ مینیمال — هم‌شکل صفحهٔ واقعی (getData/setData روی همان انبار)؛
   از v34.39.47 وضعیت سورت فقط از مسیر لایهٔ داده خوانده/نوشته می‌شود (قرارداد A10) */
global.getData = function (k) {
  try { var raw = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; if (!raw) return []; return JSON.parse(raw); } catch (e) { return []; }
};
global.setData = function (k, d) { try { store[k] = JSON.stringify(d); return true; } catch (e) { return false; } };
function renderCustomers() { global.__rendered = (global.__rendered || 0) + 1; }

/* eval غیرمستقیم → اعلان تابع‌ها به اسکوپ گلوبل می‌آیند (در سخت‌گیرانه محلی می‌ماندند) */
(0, eval)(sortBlock); /* توابع: ptfCustTs, ptfCustSortNewest, ptfCustCdKey, ptfCustSortVal,
                    ptfCustSortBy, ptfCustSortClick, ptfCustSortMarks + وضعیت _ptfCustListSort */

var fails = 0, passes = 0;
function check(cond, msg) {
  if (cond) { passes++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
}

console.log('\n== ۱) جدیدترین اول: مشتری تازه با کد کوچک/بازیافتی باز هم صدر می‌نشیند ==');
var legacy = [
  { cd: 'CUST-1404-0500', co: 'قدیمی سال‌دار' },          /* کد سال‌دار میراثی — کلید نجومی */
  { cd: 'CUST-1100', co: 'قدیمی ساده ۱' },
  { cd: 'CUST-1101', co: 'قدیمی ساده ۲' },
  { cd: 'CUST-1099-' + Date.now().toString(36), co: 'پسونددار' }
];
var fresh = { cd: 'CUST-1050', co: 'مشتری تازه', createdAtISO: new Date().toISOString() }; /* کدش از همه کوچک‌تر! */
var sorted = ptfCustSortNewest(legacy.concat([fresh]));
check(sorted[0].co === 'مشتری تازه', 'مشتری تازه (با مهر ثبت) صدر فهرست است حتی با کد کوچک‌تر');
check(sorted[1].cd === 'CUST-1404-0500', 'بعد از آن: میراثی سال‌دار (کلید بزرگ‌تر)');
check(sorted[2].cd === 'CUST-1101' && sorted[3].cd === 'CUST-1100', 'میراثی‌های بدون مهر: نزولی کد');

console.log('\n== ۲) رکوردهای زمان‌دار بین خودشان بر اساس زمان ثبت ==');
var t2025 = { cd: 'CUST-1200', co: 'پارسال', createdAtISO: '2025-06-01T10:00:00Z' };
var t2026 = { cd: 'CUST-1150', co: 'امسال', crAt: '2026-09-01T10:00:00Z' };
sorted = ptfCustSortNewest([t2025, t2026, { cd: 'CUST-1300', co: 'بی‌مهر' }]);
check(sorted[0].co === 'امسال' && sorted[1].co === 'پارسال' && sorted[2].co === 'بی‌مهر',
  'ترتیب: جدیدترین زمان → قدیمی‌تر → بی‌مهر (همهٔ کلیدها کار می‌کنند)');

console.log('\n== ۳) سورت ستونی: کد / شرکت / صنعت / رابط ==');
var data = [
  { cd: 'CUST-1002', co: 'پتروشیمی آبادان', ind: 'نفت و گاز', con: 'رضا' },
  { cd: 'CUST-1010', co: 'فولاد مبارکه', ind: 'فولاد', con: 'سارا' },
  { cd: 'CUST-1001', co: 'ابر صنعت', ind: 'نفت و گاز', con: 'علی' }
];
var byCdAsc = ptfCustSortBy(data, 'cd', 'asc');
check(byCdAsc[0].cd === 'CUST-1001' && byCdAsc[2].cd === 'CUST-1010', 'سورت کد صعودی');
var byCdDesc = ptfCustSortBy(data, 'cd', 'desc');
check(byCdDesc[0].cd === 'CUST-1010', 'سورت کد نزولی');
var byCo = ptfCustSortBy(data, 'co', 'asc');
check(byCo[0].co === 'ابر صنعت' && byCo[2].co === 'فولاد مبارکه', 'سورت نام شرکت فارسی صعودی');
var byInd = ptfCustSortBy(data, 'ind', 'asc');
check(byInd[0].ind === 'فولاد' && byInd[2].ind === 'نفت و گاز', 'سورت صنعت (در الفبای فارسی «ف» قبل از «ن» است)');
var byCon = ptfCustSortBy(data, 'con', 'asc');
check(byCon[0].con === 'رضا' && byCon[2].con === 'علی', 'سورت رابط اصلی');

console.log('\n== ۴) چرخهٔ کلیک سرستون: صعودی → نزولی → بازگشت به جدیدترین ==');
window._ptfCustListSort = { key: 'newest', dir: 'desc' };
ptfCustSortClick('co');
check(window._ptfCustListSort.key === 'co' && window._ptfCustListSort.dir === 'asc', 'کلیک اول: صعودی');
ptfCustSortClick('co');
check(window._ptfCustListSort.dir === 'desc', 'کلیک دوم: نزولی');
ptfCustSortClick('co');
check(window._ptfCustListSort.key === 'newest', 'کلیک سوم: بازگشت به پیش‌فرض جدیدترین');
ptfCustSortClick('cd');
check(window._ptfCustListSort.key === 'cd' && window._ptfCustListSort.dir === 'desc', 'کد با نزولی شروع می‌شود');
var persisted = JSON.parse(store['ptf_cust_list_sort'] || '{}');
check(persisted.key === 'cd' && persisted.dir === 'desc', 'وضعیت سورت از مسیر لایهٔ داده ماندگار شد (بدون localStorage مستقیم)');
var roundTrip = getData('ptf_cust_list_sort');
check(roundTrip && roundTrip.key === 'cd' && roundTrip.dir === 'desc', 'بازخوانی وضعیت از لایهٔ داده همان مقدار ذخیره‌شده است');

console.log('\n== ۵) مسیرهای ثبت مشتری مهر createdAtISO می‌گیرند ==');
check(offersJs.indexOf('rec.createdAtISO = new Date().toISOString();') > -1, 'saveCust2 (مودال اصلی) مهر ثبت می‌زند');
check(offersJs.indexOf("createdAtISO: new Date().toISOString()") > -1, 'بازسازی مشتری از درخواست (heal) مهر دارد');
check(html.indexOf('recC.createdAtISO = new Date().toISOString();') > -1, 'saveCust قدیمی مهر ثبت می‌زند');
check(/createdAtISO: new Date\(\).toISOString\(\)\s*\};\s*if \(!rec\.crAt\)/.test(html), 'ورود اکسل مشتریان مهر ثبت می‌گیرد');
var bridgeJs = fs.readFileSync(path.join(__dirname, '../../crm/bridge.js'), 'utf8');
check(bridgeJs.indexOf('createdAtISO: new Date().toISOString()') > -1, 'ساخت خودکار از فرم سایت مهر دارد');
var aiJs = fs.readFileSync(path.join(__dirname, '../../crm/ai-workbench.js'), 'utf8');
check(aiJs.indexOf('createdAtISO:new Date().toISOString()') > -1, 'مسیر کارت ویزیت AI مهر دارد');

console.log('\n== ۶) رندر جدید (offers.js) از وضعیت سورت پیروی می‌کند ==');
check(offersJs.indexOf('window._ptfCustListSort') > -1 && offersJs.indexOf('ptfCustSortBy') > -1,
  'renderCustomers2 سورت کاربر را اعمال می‌کند');
check(offersJs.indexOf('ptfCustSortMarks') > -1, 'نشانگر سورت پس از رندر به‌روز می‌شود');

console.log('\n=== tester686: ' + passes + ' PASS / ' + fails + ' FAIL ===');
console.log(fails === 0 ? 'ALL CHECKS PASSED ✔' : fails + ' CHECK(S) FAILED ✘');
process.exit(fails === 0 ? 0 : 1);
