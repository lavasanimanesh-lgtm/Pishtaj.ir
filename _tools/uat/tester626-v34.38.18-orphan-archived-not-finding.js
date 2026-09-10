#!/usr/bin/env node
'use strict';
/* v34.38.18 — ORPHAN-ARCHIVED-DISPLAY (گزارش کارفرما): «در قسمت پیشنهادات، در کادر بالای
   رکوردهای پیشنهاد، پیشنهادهایی که به پروندهٔ بایگانی‌شده متصل هستند به‌صورت یافته نمایش
   داده می‌شوند، درحالی‌که نباید نمایش داده شوند و یافته محسوب نمی‌شوند.»
   این تست قرارداد جدید را پین می‌کند (جانشین قرارداد v34.38.17 که همان نمایشِ اطلاعی را
   الزامی کرده بود — تستر قدیمی به LEGACY تبدیل شد):
   ① جاروی یکپارچگی کلاینت برای پیشنهاد برندهٔ متصل به پروندهٔ بایگانیِ salesfile هیچ یافته‌ای
      صادر نمی‌کند — نه بحرانی و نه اطلاعی (دادهٔ سالم، یافته نیست)؛
   ② کادر بالای فهرست پیشنهادها و باکس «فروش تا وصول» دیگر هیچ ردیف/باکسِ orphan_won_archived
      (متن، لیبل، راهنما، دکمهٔ بازکردن) ندارند؛
   ③ orphan_wonِ بحرانی فقط وقتی باقی است که نه پروندهٔ فعال هست و نه بایگانیِ قابل‌اثبات؛
      بایگانیِ با هویت متفاوت همچنان orphan بحرانی می‌سازد (تشخیصِ یتیم واقعی زنده است)؛
   ④ گزارش مهاجرت سرور هم orphan_won_archived نمی‌سازد و orphan بحرانی را فقط با شِرط
      sd_archived_case_for_offer(...)===null صادر می‌کند (قانون A11). */
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function section(src, from, to) { var a = src.indexOf(from), b = src.indexOf(to, a + from.length); return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b); }
var api = read('api/sales-domain.php');
var core = read('crm/sales-domain-v2.js');
var migration = section(api, 'function sd_migration_report()', 'function sd_repair_row_summary');
var scan = section(core, 'window.ptfSalesIntegrityScan=', '/* راهنمای گام‌به‌گام یافته‌ها');

/* ── server: suppression باقی است؛ صدور یافته/ثبت حذف شده ── */
assert.ok(api.indexOf('function sd_archived_case_for_offer(array $offer,array $projects): ?array') > -1,
  'server: helper sd_archived_case_for_offer هنوز تعریف است (تشخیص یتیم کاذب)');
assert.ok(migration.indexOf("$projects=sd_read('ptf_crm_projects')") > -1,
  'server: گزارش مهاجرت همچنان رکوردهای بایگانی را برای سرکوب orphan می‌خواند');
assert.ok(migration.indexOf("orphan_won_archived") === -1,
  'server: گزارش مهاجرت دیگر هیچ مورد orphan_won_archived نمی‌سازد (یافته محسوب نمی‌شود)');
assert.ok(migration.indexOf('sd_archived_case_for_offer($o,$projects)===null') > -1
  && migration.indexOf("$issues[]=['type'=>'orphan_won','severity'=>'critical'") > -1,
  'server: orphan_won بحرانی فقط در نبودِ بایگانیِ قابل‌اثبات صادر می‌شود');

/* ── client: scan دیگر نوع اطلاعی ندارد + UI کاملاً پاک شده ── */
assert.ok(core.indexOf('function archivedSalesFile(p)') > -1
  && core.indexOf('function archivedCaseForOffer(o)') > -1,
  'client: helperهای تشخیص بایگانی برای سرکوب orphan_wonِ کاذب حفظ شده‌اند');
assert.ok(scan.indexOf('orphan_won_archived') === -1
  && scan.indexOf('orphan-won-archived:') === -1,
  'client: جارو هیچ یافته‌ای (نه بحرانی/نه اطلاعی) برای پیوند بایگانی صادر نمی‌کند');
assert.ok(scan.indexOf("!archivedCaseForOffer(o)") > -1
  && scan.indexOf("severity:'critical',type:'orphan_won'") > -1,
  'client: orphan_won بحرانی فقط وقتی صادر می‌شود که بایگانیِ قابل‌اثباتی نباشد');
assert.ok(core.indexOf('پیشنهاد برنده به پروندهٔ بایگانی/مختومه متصل است') === -1
  && core.indexOf('داده سالم — قابل باز کردن') === -1
  && core.indexOf('orphan_won_archived:[') === -1,
  'client: دیگر ردیف/باکس/راهنمای «متصل به پروندهٔ بایگانی» در رابط پیشنهادها/کیفیت داده نیست');
assert.ok(core.indexOf("x.type==='orphan_won'||x.type==='duplicate_offer'") > -1
  && core.indexOf("orphan_won_archived'||x.type==='duplicate_offer'") === -1,
  'client: کادر بالای رکوردهای پیشنهاد orphan_won_archived را از فیلتر خود برداشته است');
assert.ok(core.indexOf("x.type==='orphan_won'&&canRepairOfferWin()") > -1
  && core.indexOf("x.type==='orphan_won'&&role()==='admin'") > -1,
  'client: دکمه‌های revoke/remove همچنان فقط برای orphan_won بحرانی رندر می‌شوند');

/* ── runtime: رفتار قطعیِ اسکن (vm روی sales-domain-v2.js) ── */
function runScan(store, role) {
  var c = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise,
    window: null, isFinite: isFinite, TextEncoder: TextEncoder,
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; },
    curRole: function () { return role || 'admin'; }, curSession: function () { return { user: 'u1' }; },
    ptfAuthToken: function () { return 'tok'; }, ptfToast: function () {}, audit: function () {},
    setInterval: function () { return 1; }, clearInterval: function () {},
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } }
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(core, c);
  return c.ptfSalesIntegrityScan();
}

var baseOffer = { no: 'CO-ARCH', st: 'won', inqNo: 'RFQ-1', buyerCd: 'CUST-1', currency: 'IRR' };
var archivedFile = { no: 'PRJ-ARCH', cd: 'PRJ-ARCH', origin: 'salesfile', state: 'archived', closeKind: 'settled', wonOffer: 'CO-ARCH', offerNo: 'CO-ARCH', inqNo: 'RFQ-1', buyerCd: 'CUST-1' };

(function () {
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [archivedFile] });
  assert.strictEqual(f.length, 0, 'پروندهٔ بایگانیِ مرتبط ⇒ هیچ یافته‌ای صادر نمی‌شود (نه بحرانی، نه اطلاعی؛ نمایش‌نیافتن در کادر بالای فهرست)');
})();

(function () {
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [] });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  assert.strictEqual(crit.length, 1, 'بدون پروندهٔ فعال و بدون بایگانی، orphan_won بحرانی همچنان صادر می‌شود');
  assert.strictEqual(crit[0].severity, 'critical', 'orphan_wonِ واقعی بحرانی می‌ماند');
})();

(function () {
  /* هویت ناسازگار (inqNo متفاوت) پروندهٔ سالم به‌شمار نمی‌رود → orphan_won باقی. */
  var unrelated = { no: 'PRJ-X', cd: 'PRJ-X', origin: 'salesfile', state: 'archived', wonOffer: 'CO-ARCH', inqNo: 'RFQ-OTHER' };
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [unrelated] });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  assert.strictEqual(crit.length, 1, 'بایگانیِ دارای هویت متفاوت سرکوب نمی‌کند و orphan بحرانی صادر می‌شود');
})();

(function () {
  /* پیوند از طریق offerNos (متمم) هم پروندهٔ بایگانی است → یافته‌ای نیست. */
  var multi = { no: 'PRJ-M', cd: 'PRJ-M', origin: 'salesfile', state: 'archived', offerNos: ['CO-ARCH', 'CO-M2'], inqNo: 'RFQ-1' };
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [multi] });
  assert.strictEqual(f.length, 0, 'پیوند از طریق offerNos هم یافته نمی‌سازد');
})();

(function () {
  /* سنتیمنل سلامت: پروندهٔ فعالِ مرتبط رفتار قبلی را می‌شناسد (هیچ یافته‌ای نیست). */
  var live = { cd: 'DL-1', wonOffer: 'CO-ARCH', inqNo: 'RFQ-1', buyerCd: 'CUST-1', currency: 'IRR' };
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [live], ptf_crm_projects: [] });
  assert.strictEqual(f.length, 0, 'با پروندهٔ فعال، همان‌طور که انتظار می‌رود یافته‌ای نیست');
})();

console.log('PASS tester626-v34.38.18-orphan-archived-not-finding');
