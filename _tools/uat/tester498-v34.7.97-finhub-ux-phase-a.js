#!/usr/bin/env node
'use strict';
/* tester498 — v34.7.97 (FINHUB-UX-A فاز A)
   ارزیابی UX هاب مالی — بستهٔ Quick Wins:
   (1) تابع سراسری ptfMoneyCompact با پسوندهای فارسی
   (2) تابع HTML همراه (ptfMoneyCompactHtml) با title tooltip
   (3) بازنویسی CSS کارت KPI (.sc/.sr): nowrap + ellipsis + font-size حداکثر 19px
   (4) CSS جدید دسکتاپ برای نوار تب (min-width: 900px)
   (5) نقاط مصرف: fiscal.js, working-capital.js, ledger-report.js, treasury.js, supplier-finance.js
*/

var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : JSON.stringify(d)); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var moneyx = read('crm/moneyx.js');
var idx = read('crm/index.html');
var fiscal = read('crm/fiscal.js');
var workcap = read('crm/working-capital.js');
var ledger = read('crm/ledger-report.js');
var treasury = read('crm/treasury.js');
var supfin = read('crm/supplier-finance.js');

T('VERSION.json = v34.7.97', ver.crm_version === 'v34.7.97', ver.crm_version);

/* ==== ۱) تابع ptfMoneyCompact ==== */
T('ptfMoneyCompact در moneyx.js تعریف شده', /window\.ptfMoneyCompact\s*=/.test(moneyx));
T('ptfMoneyCompactHtml در moneyx.js تعریف شده', /window\.ptfMoneyCompactHtml\s*=/.test(moneyx));

var sb = { window: {}, document: { querySelectorAll: () => [], addEventListener: () => {}, body: { appendChild: () => {} } }, setTimeout: () => {}, clearTimeout: () => {} };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(moneyx, sb);

T('کمتر از میلیون → کاما فارسی + ریال', sb.ptfMoneyCompact(999500) === '۹۹۹,۵۰۰ ریال', sb.ptfMoneyCompact(999500));
T('میلیون با اعشار', sb.ptfMoneyCompact(1500000) === '۱.۵ میلیون ریال', sb.ptfMoneyCompact(1500000));
T('مرز میلیون → میلیارد (999.9M → 1 میلیارد)', sb.ptfMoneyCompact(999900000) === '۱ میلیارد ریال', sb.ptfMoneyCompact(999900000));
T('میلیارد با اعشار', sb.ptfMoneyCompact(1500000000) === '۱.۵ میلیارد ریال', sb.ptfMoneyCompact(1500000000));
T('میلیارد بدون اعشار (3 رقمی)', sb.ptfMoneyCompact(150000000000) === '۱۵۰ میلیارد ریال', sb.ptfMoneyCompact(150000000000));
T('هزار میلیارد با کاما', sb.ptfMoneyCompact(1500000000000) === '۱,۵۰۰ میلیارد ریال', sb.ptfMoneyCompact(1500000000000));
T('عدد خیلی بزرگ', sb.ptfMoneyCompact(12300000000000) === '۱۲,۳۰۰ میلیارد ریال', sb.ptfMoneyCompact(12300000000000));

T('عدد منفی', sb.ptfMoneyCompact(-500000000).indexOf('-۵۰۰') === 0, sb.ptfMoneyCompact(-500000000));
T('صفر امن', sb.ptfMoneyCompact(0) === '۰ ریال', sb.ptfMoneyCompact(0));
T('null امن', sb.ptfMoneyCompact(null) === '۰ ریال', sb.ptfMoneyCompact(null));
T('NaN امن (isFinite false → empty)',
  sb.ptfMoneyCompact(NaN) === '۰ ریال' || sb.ptfMoneyCompact(NaN) === '',
  sb.ptfMoneyCompact(NaN));

T('واحد سفارشی (دلار)', sb.ptfMoneyCompact(1500000, 'دلار') === '۱.۵ میلیون دلار', sb.ptfMoneyCompact(1500000, 'دلار'));
T('واحد خالی → بدون پسوند', sb.ptfMoneyCompact(1500000, '') === '۱.۵ میلیون', sb.ptfMoneyCompact(1500000, ''));

/* ==== ۲) ptfMoneyCompactHtml — با title و <small class="unit"> ==== */
var html = sb.ptfMoneyCompactHtml(2300000000);
T('HTML شامل title tooltip', html.indexOf('title="') > -1, html);
T('HTML شامل small.unit', html.indexOf('class="unit"') > -1, html);
T('HTML شامل مقدار فشرده', html.indexOf('۲.۳ میلیارد') > -1, html);

/* ==== ۳) CSS کارت KPI در index.html ==== */
T('CSS .sc b با white-space:nowrap', /\.sc\s+b\{[^}]*white-space:nowrap/.test(idx));
T('CSS .sc b با text-overflow:ellipsis', /\.sc\s+b\{[^}]*text-overflow:ellipsis/.test(idx));
T('CSS .sc b با direction:ltr (اعداد)', /\.sc\s+b\{[^}]*direction:ltr/.test(idx));
T('CSS .sc b سقف فونت 19px (نه 24)', /\.sc\s+b\{[^}]*clamp\(15px,1\.4vw,19px\)/.test(idx));
T('CSS .sr minmax افزایش‌یافته (170px)', /\.sr\{[^}]*minmax\(170px,1fr\)/.test(idx));
T('CSS .sc .unit تعریف شده', /\.sc\s+b\s+\.unit\{/.test(idx));

/* ==== ۴) CSS موبایل کوچک (min مقادیر برای <480px) ==== */
T('CSS موبایل: .sr minmax(140px)', idx.indexOf('minmax(140px, 1fr)') > -1);
T('CSS موبایل: .sc b font-size 15px', /#panels\s+\.sc\s+b\s*\{[^}]*font-size:\s*15px/.test(idx));

/* ==== ۵) CSS دسکتاپ نوار تب @media(min-width:900px) ==== */
T('CSS دسکتاپ: @media(min-width:900px) برای finHubBar',
  /@media\(min-width:900px\)\{[^}]*#panels\s+#finHubBar/.test(idx.replace(/\s+/g, ' ')));
T('CSS دسکتاپ: fin-hub-tab.active با گرادیانت',
  idx.indexOf('.fin-hub-tab.active{background:linear-gradient') > -1);
T('CSS دسکتاپ: fin-hub-tab:hover با transform',
  /\.fin-hub-tab:hover\{[^}]*transform:translateY\(-1px\)/.test(idx.replace(/\s+/g, ' ')));

/* ==== ۶) نقاط مصرف — فایل‌های اصلی هاب مالی ==== */
T('fiscal.js: تابع moneyCard تعریف شده', /function moneyCard\(v\)/.test(fiscal));
T('fiscal.js: minmax افزایش به 170px (کارت‌های سود نقدی)',
  fiscal.indexOf('minmax(170px,1fr)') > -1);
T('fiscal.js: استفاده از moneyCard در KPIهای cash',
  (fiscal.match(/moneyCard\(/g) || []).length >= 11,
  (fiscal.match(/moneyCard\(/g) || []).length);

T('working-capital.js: card() از ptfMoneyCompactHtml استفاده می‌کند',
  workcap.indexOf('ptfMoneyCompactHtml') > -1);
T('ledger-report.js: block() از ptfMoneyCompactHtml استفاده می‌کند',
  ledger.indexOf('ptfMoneyCompactHtml') > -1);
T('treasury.js: KPI با ptfMoneyCompactHtml',
  (treasury.match(/ptfMoneyCompactHtml/g) || []).length >= 3,
  (treasury.match(/ptfMoneyCompactHtml/g) || []).length);
T('supplier-finance.js: slLiquidity با ptfMoneyCompactHtml',
  supfin.indexOf('ptfMoneyCompactHtml') > -1);
T('supplier-finance.js: minmax 170px برای slLiquidity',
  supfin.indexOf('minmax(170px,1fr)') > -1);

/* ==== ۷) تستر در گیت CI ==== */
T('tester498 در گیت CI ثبت شده',
  read('_tools/uat/run-ci-gate.js').indexOf('tester498-v34.7.97-finhub-ux-phase-a.js') > -1);

console.log('\n— tester498 (v34.7.97: هاب مالی UX فاز A) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
