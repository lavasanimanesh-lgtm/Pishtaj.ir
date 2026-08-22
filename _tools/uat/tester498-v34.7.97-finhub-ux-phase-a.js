#!/usr/bin/env node
'use strict';
/* tester498 — v34.7.100 (FINHUB-UX-A فاز A)
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

T('VERSION.json = v34.7.100', ver.crm_version === 'v34.7.100', ver.crm_version);

/* ==== ۱) تابع ptfMoneyCompact ==== */
T('ptfMoneyCompact در moneyx.js تعریف شده', /window\.ptfMoneyCompact\s*=/.test(moneyx));
T('ptfMoneyCompactHtml در moneyx.js تعریف شده', /window\.ptfMoneyCompactHtml\s*=/.test(moneyx));

var sb = { window: {}, document: { querySelectorAll: () => [], addEventListener: () => {}, body: { appendChild: () => {} } }, setTimeout: () => {}, clearTimeout: () => {} };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(moneyx, sb);

/* v34.7.100 (بازخورد کارفرما): نمایش کماکان به ریال — نه فشرده. اعداد کامل با
   کاما فارسی. ellipsis در CSS اگر جا نشد. */
T('کمتر از میلیون → کامل با کاما', sb.ptfMoneyCompact(999500) === '۹۹۹٬۵۰۰ ریال', sb.ptfMoneyCompact(999500));
T('میلیون کامل (بدون فشرده‌سازی)', sb.ptfMoneyCompact(1500000) === '۱٬۵۰۰٬۰۰۰ ریال', sb.ptfMoneyCompact(1500000));
T('میلیارد کامل (بدون فشرده‌سازی)', sb.ptfMoneyCompact(1500000000) === '۱٬۵۰۰٬۰۰۰٬۰۰۰ ریال', sb.ptfMoneyCompact(1500000000));
T('عدد خیلی بزرگ کامل', sb.ptfMoneyCompact(999999999999) === '۹۹۹٬۹۹۹٬۹۹۹٬۹۹۹ ریال', sb.ptfMoneyCompact(999999999999));

T('عدد منفی شامل ۵۰۰ و ریال', sb.ptfMoneyCompact(-500000000).indexOf('۵۰۰') > -1 && sb.ptfMoneyCompact(-500000000).indexOf('ریال') > -1, sb.ptfMoneyCompact(-500000000));
T('صفر امن', sb.ptfMoneyCompact(0) === '۰ ریال', sb.ptfMoneyCompact(0));
T('null امن', sb.ptfMoneyCompact(null) === '۰ ریال', sb.ptfMoneyCompact(null));
T('NaN امن', sb.ptfMoneyCompact(NaN) === '۰ ریال', sb.ptfMoneyCompact(NaN));

T('واحد سفارشی (دلار)', sb.ptfMoneyCompact(1500000, 'دلار') === '۱٬۵۰۰٬۰۰۰ دلار', sb.ptfMoneyCompact(1500000, 'دلار'));
T('واحد خالی → بدون پسوند', sb.ptfMoneyCompact(1500000, '') === '۱٬۵۰۰٬۰۰۰', sb.ptfMoneyCompact(1500000, ''));

/* ==== ۲) ptfMoneyCompactHtml — با title، <span dir="ltr"> و <small class="unit"> ==== */
var html = sb.ptfMoneyCompactHtml(2300000000);
T('HTML شامل title tooltip', html.indexOf('title="') > -1, html);
T('HTML شامل small.unit', html.indexOf('class="unit"') > -1, html);
T('HTML شامل عدد کامل با کاما فارسی', html.indexOf('۲٬۳۰۰٬۰۰۰٬۰۰۰') > -1, html);
T('HTML شامل dir=ltr روی عدد', html.indexOf('dir="ltr"') > -1, html);
T('HTML شامل واحد ریال', html.indexOf('>ریال<') > -1, html);

/* ==== ۳) CSS کارت KPI در index.html ==== */
T('CSS .sc b با white-space:nowrap', /\.sc\s+b\{[^}]*white-space:nowrap/.test(idx));
T('CSS .sc b با text-overflow:ellipsis', /\.sc\s+b\{[^}]*text-overflow:ellipsis/.test(idx));
T('CSS .sc b با direction:ltr (اعداد)', /\.sc\s+b\{[^}]*direction:ltr/.test(idx));
T('CSS .sc b سقف فونت 28px (v34.7.100: درشت‌تر و خواناتر در دسکتاپ)', /\.sc\s+b\{[^}]*clamp\(20px,1\.9vw,28px\)/.test(idx));
T('CSS .sc b font-weight 900', /\.sc\s+b\{[^}]*font-weight:900/.test(idx));
T('CSS .sc b letter-spacing منفی برای فشردگی اعداد فارسی', /\.sc\s+b\{[^}]*letter-spacing:-0\.01em/.test(idx));
T('CSS .sr minmax 200px (فضای کافی برای فونت 28px)', /\.sr\{[^}]*minmax\(200px,1fr\)/.test(idx));
T('CSS .sc padding 18px 15px (تنفس بیشتر)', /\.sc\{[^}]*padding:18px 15px/.test(idx));
T('CSS .sc .unit تعریف شده', /\.sc\s+b\s+\.unit\{/.test(idx));
T('CSS .sc .unit با 55% (متناسب با عدد بسیار درشت‌تر)', /\.sc\s+b\s+\.unit\{[^}]*font-size:55%/.test(idx));

/* ==== ۴) CSS موبایل (v34.7.100: درشت‌تر) ==== */
T('CSS موبایل: .sr minmax(160px)', idx.indexOf('minmax(160px, 1fr)') > -1);
T('CSS موبایل: .sc b font-size 16px (v34.7.100: از 13.5 → 16px)', /#panels\s+\.sc\s+b\s*\{[^}]*font-size:\s*16px/.test(idx));
T('CSS موبایل: .sc padding 12px 10px', /#panels\s+\.sc\s+\{[^}]*padding:\s*12px 10px/.test(idx));

/* ==== ۵) CSS دسکتاپ نوار تب @media(min-width:900px) — v34.7.100: chip افقی ==== */
T('CSS دسکتاپ: @media(min-width:900px) برای finHubBar',
  /@media\(min-width:900px\)\{[^}]*#panels\s+#finHubBar/.test(idx.replace(/\s+/g, ' ')));
T('CSS دسکتاپ v34.7.100: fin-hub-tab افقی (flex-direction:row)',
  /\.fin-hub-tab\{[^}]*flex-direction:row/.test(idx.replace(/\s+/g, ' ')));
T('CSS دسکتاپ v34.7.100: fin-hub-tab کوتاه (min-height:36px)',
  /\.fin-hub-tab\{[^}]*min-height:36px/.test(idx.replace(/\s+/g, ' ')));
T('CSS دسکتاپ: fin-hub-tab.active با گرادیانت',
  idx.indexOf('.fin-hub-tab.active{background:linear-gradient') > -1);
T('CSS دسکتاپ: fin-hub-tabs با flex-wrap (نه grid)',
  /\.fin-hub-tabs\{[^}]*display:flex[^}]*flex-wrap:wrap/.test(idx.replace(/\s+/g, ' ')));

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

console.log('\n— tester498 (v34.7.100: هاب مالی UX فاز A) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
