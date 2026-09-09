#!/usr/bin/env node
'use strict';
/* v34.38.17 — ORPHAN-WON-ARCHIVED (گزارش کارفرما): پس از مختومه/بایگانی پروندهٔ فروش،
   رکورد پرونده از ptf_crm_deals به ptf_crm_projects می‌رود (state='archived',
   origin='salesfile') و پیشنهاد برنده همان st='won' سالم می‌ماند. جاروی یکپارچگی که
   فقط ptf_crm_dealsِ فعال را می‌دید، چنین پیشنذاهدی را «orphan_won» بحرانی گزارش می‌کرد
   و دکمهٔ «بازگرداندن برد/حذف پیشنهاد» نشان می‌داد. این تست ثابت می‌کند که:
   ① client+server، پیوندِ پیشنهاد به یک پروندهٔ بایگانیِ salesfile را (از شمارهٔ پیشنهاد
      و سازگاری هویت) به‌جای orphan_won بحرانی، یک یافتهٔ اطلاعی orphan_won_archived
      صادر می‌کنند که فقط «بازکردن پروندهٔ بایگانی» دارد — هرگز revoke/حذف برد؛
   ② orphan_wonِ بحرانی فقط وقتی باقی می‌ماند که هیچ بایگانیِ قابل اثباتی نباشد؛
   ③ تطبیق، هویت را نیز کنترل می‌کند تا پروندهٔ واقعیِ سالمِ بسته پنهان نشود و یک
      orphanِ واقعی (بایگانیِ نامرتبط/متفاوت) کماکان بحرانی بماند. */
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function section(src, from, to) { var a = src.indexOf(from), b = src.indexOf(to, a + from.length); return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b); }
var api = read('api/sales-domain.php');
var core = read('crm/sales-domain-v2.js');
var migration = section(api, 'function sd_migration_report()', 'function sd_repair_row_summary');
var scan = section(core, 'window.ptfSalesIntegrityScan=', '/* راهنمای گام‌به‌گام یافته‌ها');

/* ── server: helper آرشیو + گزارش مهاجرت ── */
assert.ok(api.indexOf('function sd_archived_case_for_offer(array $offer,array $projects): ?array') > -1,
  'server: helper sd_archived_case_for_offer تعریف شده است');
assert.ok(api.indexOf("(string)($p['origin']??'')!=='salesfile'") > -1
  && api.indexOf("strtolower(trim((string)($p['state']??'')))!=='archived'") > -1
  && api.indexOf("$p['wonOffer']??$p['offerNo']??''") > -1,
  'server: helper فقط پروندهٔ بایگانیِ salesfile را با شمارهٔ پیشنهاد پیوند می‌دهد');
assert.ok(migration.indexOf("$projects=sd_read('ptf_crm_projects')") > -1
  && migration.indexOf('$archived=sd_archived_case_for_offer($o,$projects)') > -1,
  'server: گزارش مهاجرت به رکوردهای بایگانی (ptf_crm_projects) نگاه می‌کند');
assert.ok(migration.indexOf("'type'=>'orphan_won_archived','severity'=>'info'") > -1
  && migration.indexOf("'orphan_won','severity'=>'critical'") > -1
  && migration.indexOf("$archived!==null") > -1 && migration.indexOf('$archived==null') === -1
  && migration.indexOf('else $issues[]') > -1,
  'server: orphan_won_archived اطلاعی وقتی بایگانی اثبات می‌شود؛ orphan_won بحرانی فقط در نبود بایگانی');

/* ── client: helperها + صدور یافته + تفکیک UI + فقدان revoke برای بایگانی ── */
assert.ok(core.indexOf('function archivedSalesFile(p)') > -1
  && core.indexOf('function archivedCaseForOffer(o)') > -1
  && core.indexOf('window.ptfOpenArchivedWonFile = function (projectNo)') > -1,
  'client: helperهای archivedSalesFile/archivedCaseForOffer/ptfOpenArchivedWonFile تعریف شده‌اند');
assert.ok(core.indexOf("p.origin === 'salesfile'") > -1
  && core.indexOf("String(p.state || '').toLowerCase() === 'archived'") > -1,
  'client: helper آرشیو فقط salesfile/archived را می‌پذیرد');
assert.ok(scan.indexOf("var arch=archivedCaseForOffer(o)") > -1
  && scan.indexOf("severity:'info',type:'orphan_won_archived'") > -1
  && scan.indexOf("severity:'critical',type:'orphan_won'") > -1,
  'client: جارو نخست بایگانی را می‌جوید و فقط در نبود آن orphan_won بحرانی صادر می‌کند');
assert.ok(core.indexOf("x.type==='orphan_won'&&canRepairOfferWin()") > -1
  && core.indexOf("x.type==='orphan_won'&&role()==='admin'") > -1,
  'client: دکمه‌های revoke/remove همچنان فقط برای orphan_won (نه orphan_won_archived) رندر می‌شوند');
assert.ok(core.indexOf('پیشنهاد برنده به پروندهٔ بایگانی/مختومه متصل است') > -1
  && core.indexOf('داده سالم — قابل باز کردن') > -1,
  'client: یافتهٔ بایگانی در یک کادر اطلاعی/سالم جدا از کادر هشدار نشان داده می‌شود');
assert.ok(core.indexOf("x.type==='orphan_won_archived'") > -1 && core.indexOf('orphan_won_archived:[') > -1
  && core.indexOf("f.type==='orphan_won_archived'") > -1
  && core.indexOf("ptfOpenArchivedWonFile(\\''+arg(f.projectNo||f.offerNo)+'\\')") > -1,
  'client: راهنمای یافتهٔ بایگانی فقط اقدام بازکردن پرونده دارد');
assert.ok(core.indexOf("x.type==='orphan_won'||x.type==='orphan_won_archived'") > -1,
  'client: کادر بالای پیشنهادها orphan_won_archived را نیز نمایش می‌دهد');

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
  var info = f.filter(function (x) { return x.type === 'orphan_won_archived'; });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  assert.strictEqual(info.length, 1, 'پروندهٔ بایگانیِ مرتبط ⇒ یک یافتهٔ orphan_won_archived (نه بحرانی)');
  assert.strictEqual(info[0].severity, 'info', 'severity یافتهٔ بایگانی info است');
  assert.strictEqual(info[0].projectNo, 'PRJ-ARCH', 'projectNo پروندهٔ بایگانی در یافته ثبت می‌شود');
  assert.strictEqual(crit.length, 0, 'با وجود بایگانیِ مرتبط هیچ orphan_won بحرانی نباید صادر شود');
})();

(function () {
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [] });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  assert.strictEqual(crit.length, 1, 'بدون بایگانی، orphan_won بحرانی همچنان صادر می‌شود');
})();

(function () {
  /* هویت ناسازگار (inqNo متفاوت) نباید به‌عنوان پروندهٔ سالم بسته پذیرفته شود → orphan_won باقی. */
  var unrelated = { no: 'PRJ-X', cd: 'PRJ-X', origin: 'salesfile', state: 'archived', wonOffer: 'CO-ARCH', inqNo: 'RFQ-OTHER' };
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [unrelated] });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  var info = f.filter(function (x) { return x.type === 'orphan_won_archived'; });
  assert.strictEqual(crit.length, 1, 'بایگانیِ دارای هویت متفاوت پروندهٔ سالم به‌شمار نمی‌رود و orphan بحرانی می‌ماند');
  assert.strictEqual(info.length, 0, 'هیچ orphan_won_archived برای بایگانیِ ناسازگار صادر نمی‌شود');
})();

/* پشتیبانی از offerNos (متمم) — چند پیشنهاد در یک پروندهٔ بایگانی */
(function () {
  var multi = { no: 'PRJ-M', cd: 'PRJ-M', origin: 'salesfile', state: 'archived', offerNos: ['CO-ARCH', 'CO-M2'], inqNo: 'RFQ-1' };
  var f = runScan({ ptf_crm_offers: [baseOffer], ptf_crm_deals: [], ptf_crm_projects: [multi] });
  var crit = f.filter(function (x) { return x.type === 'orphan_won'; });
  var info = f.filter(function (x) { return x.type === 'orphan_won_archived'; });
  assert.strictEqual(crit.length, 0 && info.length === 1, 'پیوند از طریق offerNos پروندهٔ بایگانی نیز پذیرفته می‌شود');
})();

console.log('PASS tester625-v34.38.17-orphan-won-archived');
