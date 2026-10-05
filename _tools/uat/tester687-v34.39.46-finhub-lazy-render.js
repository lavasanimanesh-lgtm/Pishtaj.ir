/* tester687 — v34.39.50 (FINHUB-PERF): رندر تنبل هاب مالی + صفحه‌بندی تنخواه.
   ① مکانیزم تنبل (دروازه + پرکننده) به‌صورت رانتایم با DOM مصنوعی تست می‌شود؛
   ② اتصال سازنده‌ها/رندرها و صفحه‌بندی تنخواه به‌صورت ایستا راستی‌آزمایی می‌شود. */
'use strict';
var fs = require('fs');
var path = require('path');
function read(p) { return fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8'); }

var fails = 0, passes = 0;
function check(cond, msg) {
  if (cond) { passes++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
}

/* ═══ ۱) رانتایم: مکانیزم دروازه + پرکنندهٔ تنبل از دل financehub.js ═══ */
console.log('\n== ۱) مکانیزم رندر تنبل (رانتایم با DOM مصنوعی) ==');
global.window = global;
global.curRole = function () { return 'admin'; };
var elements = {};
global.document = {
  createElement: function () { return { textContent: '', style: {} }; },
  head: { appendChild: function () {} },
  getElementById: function (id) { return elements[id] || null; },
  querySelectorAll: function () { return []; }
};
/* هوک فوری تا ستاپ‌اینترفالِ هوک‌یابی زود جمع شود */
window.buildPetty = function () { return ''; };
window.renderPetty = function () {};
require(path.join(__dirname, '..', '..', 'crm', 'financehub.js'));

window._ptfFinHubOn = true; window._finHubTab = 'petty';
check(window.ptfFinHubLazyGate('ledger') === true, 'دروازه: تب غیرفعال → پوستهٔ تنبل');
check(window.ptfFinHubLazyGate('petty') === false, 'دروازه: تب فعال خود تنخواه → بدون تنبل‌سازی');
window._finHubTab = 'ledger';
check(window.ptfFinHubLazyGate('ledger') === false, 'دروازه: فعال شدن تب → محاسبهٔ کامل');
window._ptfFinHubOn = false;
check(window.ptfFinHubLazyGate('ledger') === false, 'دروازه: بدون نوار هاب → رفتار قدیمی (بدون تنبل‌سازی)');
window._ptfFinHubOn = true; window._finHubTab = 'petty';

var calls = [];
window.__spyLedger = function () { calls.push('ledger'); };
window.__spySup1 = function () { calls.push('sup1'); };
window.__spySup2 = function () { calls.push('sup2'); };
elements.ledgerReportBox = { getAttribute: function () { return '1'; } };
elements.slLiquidity = { getAttribute: function () { return '1'; } };
elements.slFinanceHubBox = { getAttribute: function () { return null; } }; /* قبلاً پر شده */
/* نگاشت‌های داخلی را با رندرهای جاسوس جایگزین نمی‌کنیم؛ پس جاسوس‌ها را همنام می‌کنیم: */
window.ptfLedgerReportRender = window.__spyLedger;
window.slLiquidityRender = window.__spySup1;
window.slFinanceHubRender = window.__spySup2;
window.ptfFinHubLazyFill('ledger');
check(calls.join(',') === 'ledger', 'پرکننده: باکس پوسته → رندر صدا زده شد');
calls = [];
window.ptfFinHubLazyFill('quality'); /* باکس وجود ندارد */
check(calls.length === 0, 'پرکننده: باکس غایب → هیچ کاری نمی‌کند');
calls = [];
window.ptfFinHubLazyFill('supacc');
check(calls.join(',') === 'sup1', 'پرکننده: تب تأمین — پوسته پر شد و باکسِ ازقبل‌پررفته دست نخورد');

/* ═══ ۲) ایستا: اتصال دروازه در سازنده‌های سنگین ═══ */
console.log('\n== ۲) اتصال دروازه در سازنده‌های سنگین ==');
var gates = [
  ['crm/ledger-report.js', "ptfFinHubLazyGate('ledger')", 'id="ledgerReportBox" data-finlazy="1"'],
  ['crm/commission.js', "ptfFinHubLazyGate('commission')", 'id="commissionBox" data-finlazy="1"'],
  ['crm/data-quality.js', "ptfFinHubLazyGate('quality')", 'id="qualityBox" data-finlazy="1"'],
  ['crm/cheque-panel.js', "ptfFinHubLazyGate('cheque')", 'id="chequeBox" data-finlazy="1"'],
  ['crm/customer-finance.js', "ptfFinHubLazyGate('custacc')", 'id="cfFinanceHubBox" data-finlazy="1"'],
  ['crm/supplier-finance.js', "ptfFinHubLazyGate('supacc')", 'id="slLiquidity" data-finlazy="1"'],
  ['crm/working-capital.js', "ptfFinHubLazyGate('workcap')", 'id="wcFinanceHubBox" data-finlazy="1"'],
  ['crm/fiscal.js', "ptfFinHubLazyGate('fiscal')", 'id="fiscalBox" class="ptf-fiscal-shell" data-finlazy="1"']
];
gates.forEach(function (g) {
  var src = read(g[0]);
  var shellOk = src.indexOf(g[2]) > -1 || src.indexOf('data-finlazy="1"') > -1;
  check(src.indexOf(g[1]) > -1 && shellOk, g[0] + ': دروازه + پوستهٔ تنبل دارد');
});
/* پوستهٔ دوم تأمین‌کننده */
var sf = read('crm/supplier-finance.js');
check(sf.indexOf('id="slFinanceHubBox" data-finlazy="1"') > -1, 'supplier-finance: پوستهٔ تنبل جدول حساب تأمین‌کنندگان');

/* ═══ ۳) ایستا: رندرهای نقطهٔ ورود وجود دارند و در هاب ثبت شده‌اند ═══ */
console.log('\n== ۳) رندرهای نقطهٔ ورود ==');
check(read('crm/customer-finance.js').indexOf('window.cfFinanceRender') > -1, 'cfFinanceRender تعریف شده');
check(sf.indexOf('window.slLiquidityRender') > -1, 'slLiquidityRender تعریف شده');
check(sf.indexOf('window.slFinanceHubRender') > -1, 'slFinanceHubRender تعریف شده');
var hub = read('crm/financehub.js');
['ptfLedgerReportRender', 'ptfCommissionRefresh', 'ptfDataQualityRender', 'ptfChequePanelRender',
 'cfFinanceRender', 'slLiquidityRender', 'slFinanceHubRender', 'wcRender', 'ptfFiscalRender'].forEach(function (fn) {
  check(hub.indexOf("'" + fn + "'") > -1, 'نگاشت تنبل هاب → ' + fn);
});
check(hub.indexOf('ptfFinHubLazyFill(t)') > -1, 'finHubApply پرکنندهٔ تنبل را صدا می‌زند');

/* ═══ ۴) ایستا: صفحه‌بندی تنخواه + حذف دوباره‌کاری‌ها ═══ */
console.log('\n== ۴) تنخواه: صفحه‌بندی و دوباره‌کاری‌ها ==');
var petty = read('crm/petty.js');
check(petty.indexOf('var per = 50;') > -1 && petty.indexOf('list.slice(0, (page + 1) * per)') > -1, 'فهرست تنخواه ۵۰ رکورد در گام');
check(petty.indexOf('window.ptfPettyMore') > -1, 'دکمهٔ «نمایش بیشتر» (ptfPettyMore) تعریف شده');
check(/var perMap = window\.ptfPettyPendingByUser\(\);/.test(petty), 'ptfPettyPendingByUser فقط یک بار در کادر موجودی');
check(petty.indexOf('Object.keys(window.ptfPettyPendingByUser()).reduce(function (s, k) { return s + window.ptfPettyPendingByUser()[k]; }, 0)') < 0, 'الگوی قدیمیِ پرتکرار حذف شده');
var cf = read('crm/customer-finance.js');
check(cf.indexOf('var rows = q ? window.cfAccountRows(q) : all;') > -1, 'حساب مشتریان: بدون جستجو، محاسبهٔ دوم حذف شد');

console.log('\n=== tester687: ' + passes + ' PASS / ' + fails + ' FAIL ===');
console.log(fails === 0 ? 'ALL CHECKS PASSED ✔' : fails + ' CHECK(S) FAILED ✘');
process.exit(fails === 0 ? 0 : 1);
