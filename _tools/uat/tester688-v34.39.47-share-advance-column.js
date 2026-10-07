/* tester688 — v34.39.54 (SH-ADV-COLUMN):
   گزارش کارفرما: «در بخش سهامداران اگر به سهامدار مبلغ علی‌الحسابی داده شود، در بخش سال مالی
   از حساب سهامدار کسر می‌شود ولی ستونی برای نمایش این موضوع وجود ندارد — بررسی کن».

   یافتهٔ بررسی (با اجرای کد واقعی): دو نوع برداشت از ماندهٔ سهامدار کسر می‌شد و فقط یکی ستون داشت.
     ① علی‌الحسابِ سود (draw/advance/debit بدون نشان حقوق)
        → ستون «علی‌الحساب/بدهی سال» (advYear) + کسر از «مانده قابل تسویهٔ امسال»؛
     ② علی‌الحسابِ حقوق (draw با paymentFor:'salary' / salaryMonth) — خروجیِ دیالوگ
        «برداشت/علی‌الحساب» و دکمهٔ «پرداخت حقوق»
        → از «مانده جاری» و «نتیجه پس از تقسیم» همان سهامدار کسر می‌شد (درست) اما هیچ ستونی
          نداشت و فقط در کارت تجمیعی «حقوق پرداخت‌شده با draw» می‌آمد ⇒ کسرِ بی‌ردپا در کاربرگ
          سال مالی (دقیقاً همان نبودِ ستون که کارفرما گزارش کرد).

   رفع: ستون «علی‌الحساب حقوق سال» (salaryAdvYear) به کاربرگِ سال مالی + گزارش رسمی + CSV +
   تأییدیهٔ ثبت تقسیم، و نمایش تفکیکیِ همان دو عدد در کارت سهامدار (بخش سهامداران) و در
   دیالوگ ثبت برداشت. قراردادهای tester628 (B1: حقوق در advYear نیست) و tester654 (علی‌الحساب
   حقوق از حقوق تعهدی کم می‌شود) دست‌نخورده‌اند: settleYear همچنان فقط از advYear کم می‌شود. */
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var ROOT = path.resolve(__dirname, '..', '..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

var fails = 0, passes = 0;
function check(cond, msg) {
  if (cond) { passes++; console.log('  PASS  ' + msg); }
  else { fails++; console.log('  FAIL  ' + msg); }
}

var fiscal = read('crm/fiscal.js');
var sh = read('crm/shareholders.js');

console.log('\n== ۱) قرارداد ایستا — ستونِ جدید در دادهٔ توزیع سال مالی ==');
check(/salaryAdvYear: Math\.round\(salaryAdv\)/.test(fiscal), 'هر سهامدار مقدار salaryAdvYear دارد');
check(/salaryAdvYearTotal: Math\.round\(salaryAdvRows\.reduce/.test(fiscal), 'جمع ستون (salaryAdvYearTotal) در خروجی توزیع است');
check(/x\.type === 'draw' && \(x\.paymentFor === 'salary' \|\| !!x\.salaryMonth\)/.test(fiscal), 'فیلتر ستون فقط drawِ نشان‌دارِ حقوق است');
check(/fiscalYearOf\(x\.t \|\| x\.month \|\| ''\) === String\(year\)/.test(fiscal), 'سالِ سند با قاعدهٔ salaryPaid یکی است');
/* قرارداد B1 دست‌نخورده: ستونِ قدیم همچنان علی‌الحسابِ حقوق را بیرون می‌گذارد */
check(/!\(x\.type === 'draw' && \(x\.paymentFor === 'salary' \|\| !!x\.salaryMonth\)\) &&/.test(fiscal), 'ستونِ قدیم advYear همچنان حقوق را حذف می‌کند (قرارداد tester628 B1)');
check(/settleYear: Math\.round\(gross - adv\)/.test(fiscal), '«مانده قابل تسویهٔ امسال» فقط از علی‌الحسابِ سود کم می‌شود (بدون کسر دوباره)');

console.log('\n== ۲) قرارداد ایستا — نمایش در داشبورد، گزارش و CSV ==');
check(fiscal.indexOf('علی‌الحساب/بدهی سال') > -1, 'ستونِ علی‌الحساب/بدهی سال حفظ شده (قرارداد tester301)');
check(fiscal.indexOf('<th>علی‌الحساب حقوق سال</th>') > -1, 'ستونِ «علی‌الحساب حقوق سال» در داشبورد آمده');
check(/money\(s\.salaryAdvYear \|\| 0\)/.test(fiscal), 'سلول ستون از salaryAdvYear پر می‌شود');
check(fiscal.indexOf('<tr><td colspan="10">سهامداری ثبت نشده</td></tr>') > -1, 'colspanِ ردیف خالی به ۱۰ ارتقا یافته');
check(/<th title="[^"]*">علی‌الحساب حقوق سال<\/th>/.test(fiscal), 'ستون در داشبورد راهنمایِ ستون (title) دارد');
check((fiscal.match(/<th>علی‌الحساب حقوق سال<\/th>/g) || []).length === 2, 'ستون در هر دو گزارش رسمی (تعهدی و نقدی) هم آمده');
check(fiscal.indexOf("'علی‌الحساب حقوق سال'") > -1, 'ستون در سرستون CSV حسابدار آمده');
check(/sh\.salaryAdvYear \|\| 0/.test(fiscal), 'مقدار ستون در ردیف‌های CSV نوشته می‌شود');
check(/علی‌الحساب\/پرداخت حقوق این سال/.test(fiscal), 'تأییدیهٔ ثبت تقسیم سود جمعِ علی‌الحساب حقوق را هم نشان می‌دهد');
check(/جمع علی‌الحساب\/پرداخت حقوقِ سال/.test(fiscal), 'یادداشتِ توضیحیِ زیر جدول (این ستون از سهم سود کسر نمی‌شود)');

console.log('\n== ۳) قرارداد ایستا — تفکیک در بخش سهامداران ==');
check(/window\.ptfShareAdvanceSplit = shareAdvanceSplit;/.test(sh), 'تفکیک‌کنندهٔ علی‌الحساب‌ها در دسترس است');
check(/window\.ptfShareAdvanceSplitByYear = shareAdvanceSplitByYear;/.test(sh), 'نگاشتِ یک‌بارهٔ سال (بدون پیمایش به‌ازای هر سهامدار)');
check(/علی‌الحساب سودِ ' \+ escP\(shareYear\)/.test(sh), 'کارت سهامدار جمعِ علی‌الحسابِ سودِ سال را نشان می‌دهد');
check(/علی‌الحساب حقوقِ ' \+ escP\(shareYear\)/.test(sh), 'کارت سهامدار جمعِ علی‌الحسابِ حقوقِ سال را نشان می‌دهد');
check(/ثبت‌شدهٔ سال ' \+ drawYear \+ ' تاکنون/.test(sh), 'دیالوگِ ثبت برداشت جمعِ همان سال را پیش از ثبت نشان می‌دهد');

/* ═══ ۴) رفتار با اجرای کد واقعی (crm/fiscal.js + crm/shareholders.js) ═══ */
console.log('\n== ۴) رفتاری با اجرای کد واقعی ==');
global.window = global;
var STORE = {};
global.localStorage = { getItem: function (k) { return STORE['ls:' + k] == null ? null : STORE['ls:' + k]; }, setItem: function () {}, removeItem: function () {} };
global.getData = function (k) { var v = STORE[k]; return Array.isArray(v) ? v : (v == null ? [] : v); };
global.setData = function (k, v) { STORE[k] = v; };
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { name: 'uat', user: 'uat' }; };
global.genCode = function (p) { return (p || 'X') + '-' + Math.random().toString(36).slice(2, 8); };
global.faDateTime = function () { return '1405/07/12 10:00'; };
global.audit = function () {};
global.escP = function (s) { return String(s == null ? '' : s); };
global.ptfOnClickArg = function (s) { return String(s); };
global.ptfToast = function () {};
global.ptfJToISO = function () { return ''; }; /* بدون تبدیل تاریخ → شاخهٔ fallback سالِ جلالی سنجیده می‌شود */
global.document = { addEventListener: function () {}, getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} }, createElement: function () { return { style: {} }; }, head: { appendChild: function () {} } };

(function () { var code = fs.readFileSync(path.join(ROOT, 'crm/shareholders.js'), 'utf8'); (new Function(code))(); })();
(function () { var code = fs.readFileSync(path.join(ROOT, 'crm/fiscal.js'), 'utf8'); (new Function(code))(); })();

STORE['ptf_crm_shareholders'] = [
  { cd: 'SHR-A', name: 'سهامدار الف', pct: 50, duty: true, salary: 200000000, active: true },
  { cd: 'SHR-B', name: 'سهامدار ب', pct: 50, duty: false, salary: 0, active: true }
];
STORE['ptf_crm_sharetx'] = [
  { cd: 'S-1', shCd: 'SHR-A', type: 'salary', amt: 200000000, month: '1405/01', t: '1405/01/01', status: 'active' },
  { cd: 'S-2', shCd: 'SHR-A', type: 'salary', amt: 200000000, month: '1405/02', t: '1405/02/01', status: 'active' }
];
['ptf_crm_opex', 'ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_petty',
  'ptf_crm_cheques', 'ptf_crm_cheques_received', 'ptf_crm_cheques_issued', 'ptf_crm_case_receipts']
  .forEach(function (k) { STORE[k] = []; });
STORE['ptf_crm_fiscal_snapshots'] = [];
window.ptfFinanceOfficialData = function () { return { cfg: { fiscalYear: '1405' }, opening: { cash_bank: 1000000000 } }; };

function byCd(list, cd) { return (list || []).filter(function (s) { return s.cd === cd; })[0] || {}; }
function dist() { return window.ptfFiscalCashDistribution('1405', 60); }

var base = dist();
check(base.salaryAdvYearTotal === 0 && byCd(base.shareholders, 'SHR-A').salaryAdvYear === 0, 'بدون برداشت، ستون صفر است');

/* ① علی‌الحسابِ عادی — فقط ستونِ قدیم (قرارداد tester628) */
STORE['ptf_crm_sharetx'].push({ cd: 'D-ADV', shCd: 'SHR-A', type: 'draw', amt: 50000000, month: '1405/05', t: '1405/05/01', status: 'active' });
var afterAdv = dist();
check(byCd(afterAdv.shareholders, 'SHR-A').advYear === 50000000, 'علی‌الحسابِ عادی در ستون «علی‌الحساب/بدهی سال» است');
check(byCd(afterAdv.shareholders, 'SHR-A').salaryAdvYear === 0, 'علی‌الحسابِ عادی وارد ستون حقوق نمی‌شود');
check(afterAdv.salaryAdvYearTotal === 0, 'جمع ستون حقوق هنوز صفر است');

/* ② علی‌الحسابِ حقوق — ستونِ جدید (گزارش کارفرما) */
STORE['ptf_crm_sharetx'].push({ cd: 'D-SAL', shCd: 'SHR-A', type: 'draw', amt: 70000000, month: '1405/06', t: '1405/06/01', status: 'active', paymentFor: 'salary', salaryMonth: '1405/06' });
var afterSal = dist();
var a2 = byCd(afterSal.shareholders, 'SHR-A');
check(a2.salaryAdvYear === 70000000, 'علی‌الحسابِ حقوق در ستون «علی‌الحساب حقوق سال» همان سهامدار دیده می‌شود');
check(afterSal.salaryAdvYearTotal === 70000000, 'جمع ستون درست است');
check(afterSal.salaryAdvYearTotal === afterSal.salaryPaid, 'جمع ستون با کارت «حقوق پرداخت‌شده با draw» یکی است');
check(a2.advYear === 50000000, 'علی‌الحسابِ حقوق وارد advYear نمی‌شود (کسر دوباره نمی‌شود)');
check(a2.settleYear === a2.gross - 50000000, '«مانده قابل تسویهٔ امسال» فقط از علی‌الحسابِ سود کم می‌شود');
check(a2.currentBalance === base.shareholders[0].currentBalance - 50000000 - 70000000, 'هر دو برداشت از ماندهٔ جاری سهامدار کسر شده‌اند');
check(byCd(afterSal.shareholders, 'SHR-B').salaryAdvYear === 0, 'سهامدارِ دیگر در ستون حقوق صفر است');

/* ③ محدودهٔ سال و ابطال */
STORE['ptf_crm_sharetx'].push({ cd: 'D-OLD', shCd: 'SHR-A', type: 'draw', amt: 10000000, month: '1404/06', t: '1404/06/01', status: 'active', paymentFor: 'salary', salaryMonth: '1404/06' });
STORE['ptf_crm_sharetx'].push({ cd: 'D-VOID', shCd: 'SHR-A', type: 'draw', amt: 30000000, month: '1405/07', t: '1405/07/01', status: 'void', paymentFor: 'salary', salaryMonth: '1405/07' });
var scoped = dist();
check(byCd(scoped.shareholders, 'SHR-A').salaryAdvYear === 70000000, 'علی‌الحسابِ حقوقِ سالِ دیگر و ردیفِ باطل‌شده در ستون نمی‌آیند');
check(window.ptfFiscalCashDistribution('1404', 60).salaryAdvYearTotal === 10000000, 'همان مبلغ در سال خودش (۱۴۰۴) دیده می‌شود');

/* ④ تفکیک در کارت سهامدار (بخش سهامداران) با همان داده */
var card = window.ptfShareAdvanceSplit('SHR-A', '1405');
check(card.profit === 50000000 && card.salary === 70000000, 'کارت سهامدار: علی‌الحساب سود ۵۰م / علی‌الحساب حقوق ۷۰م');
check(window.ptfShareAdvanceSplit('SHR-A', '1404').salary === 10000000, 'کارت سهامدار: فقط مبالغ همان سال');
check(window.ptfShareAdvanceSplit('SHR-B', '1405').profit === 0, 'کارت سهامدارِ بدون برداشت صفر است');
check(card.salary === byCd(scoped.shareholders, 'SHR-A').salaryAdvYear, 'عددِ کارت سهامدار با ستونِ سال مالی یکی است (یک منبع)');

/* ⑤ خروجی HTMLِ داشبورد */
var box = { outerHTML: '' };
global.document.getElementById = function (id) { return id === 'fiscalBox' ? box : null; };
window._fiscalYear = '1405'; window._fiscalDistPct = 60;
window.ptfFiscalRender();
var html = box.outerHTML;
var headers = (html.match(/<thead><tr><th>سهامدار<\/th>[\s\S]*?<\/tr><\/thead>/) || [''])[0];
var headerCount = (headers.match(/<th[ >]/g) || []).length;
check(headerCount === 10, 'جدول کاربرگ ۱۰ ستون دارد (' + headerCount + ')');
check(headers.indexOf('علی‌الحساب حقوق سال') > -1, 'سرستونِ جدید در خروجی HTML هست');
check(/<td style="color:#7c3aed;font-weight:700">۷۰٬۰۰۰٬۰۰۰ ریال<\/td>/.test(html), 'سلولِ ستون با مبلغِ درست رندر شد');
check(html.indexOf('جمع علی‌الحساب/پرداخت حقوقِ سال 1405') > -1, 'یادداشتِ توضیحی ستون در خروجی هست');

console.log('\n' + passes + ' PASS / ' + fails + ' FAIL');
if (fails) { console.log('FAIL tester688 v34.39.54 shareholder advance column'); process.exit(1); }
console.log('PASS tester688 v34.39.54 — ستون علی‌الحساب حقوق در کاربرگ سال مالی + تفکیک در کارت سهامدار');
