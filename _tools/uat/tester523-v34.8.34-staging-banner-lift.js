#!/usr/bin/env node
'use strict';
/* tester523 — v34.8.40 (STAGING-BANNER-LIFT): نوار زرد/بنر sync و toast ها نباید
   زیر بنر نارنجی «محیط تست» پنهان شوند (گزارش کارفرما ۱۴۰۵/۰۶/۰۵). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sync = read('crm/sync.js');
T('helper ارتفاع بنر استیجینگ تعریف شد', /function stagingBannerH\(\)/.test(sync) && /getElementById\('ptf-staging-banner'\)/.test(sync));
T('دسکتاپ: bottom inline بنر = ارتفاع بنر استیجینگ', /banner\.style\.bottom = sbH \? \(sbH \+ 2\) \+ 'px' : ''/.test(sync));
T('موبایل: ارتفاع بنر استیجینگ در مدیا کوئری بنر لحاظ شد', sync.indexOf('var sbAdd = stagingBannerH() ?')>-1 && sync.indexOf("8px' + sbAdd")>-1);
T('آفست toast ها شامل ارتفاع بنر استیجینگ است', /\+ sbH;\n?\s*root\.style\.setProperty\('--ptf-unsaved-banner-offset'/.test(sync) || /var offset = \(visible [\s\S]{0,120}\) \+ sbH;/.test(sync));
var uk = read('crm/ui-kit.js');
T('toast دسکتاپ هم از آفست پیروی می‌کند (var)', /bottom:calc\(20px \+ var\(--ptf-unsaved-banner-offset,0px\)\)/.test(uk));
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.40', ver.crm_version === 'v34.8.40', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.8.40', /window\.PTF_CRM_RELEASE = 'v34\.8.40'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8.40'/.test(read('crm/sw.js')));

console.log('\n— tester523 (v34.8.40: STAGING-BANNER-LIFT) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
