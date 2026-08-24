#!/usr/bin/env node
'use strict';
/* v34.8.5 — فیلد ارزش افزوده فاکتور رسمی تامین‌کننده (SUP-VAT-001).
   ریشه: بلوک slInvVatWrap/slInvVatPct در HTML فرم ساخته نمی‌شد؛ در نتیجه فیلد
   درصد/ارزش افزوده قابل مشاهده نبود و مشخص نبود مبلغ را با یا بدون ارزش افزوده
   وارد کنیم. حالا:
   - مبلغ به‌عنوان «پایه/بدون ارزش افزوده» وارد می‌شود.
   - درصد پیش‌فرض ۱۰٪؛ سیستم ارزش افزوده و جمع را نمایش/ذخیره می‌کند.
   - بلوک فقط برای فاکتور رسمی (و پوششی/رسمی) نمایش داده می‌شود. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sf = read('crm/supplier-finance.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.5', ver.crm_version === 'v34.8.5', ver.crm_version);
T('supplier-finance.js cache-bust 34.8.5', /supplier-finance\.js\?v=34\.8\.5/.test(idx));

/* ---------- بلوک VAT در HTML فرم ---------- */
T('slInvVatWrap در HTML ساخته می‌شود', /id="slInvVatWrap"/.test(sf));
T('slInvVatPct وجود دارد', /id="slInvVatPct"/.test(sf));
T('درصد پیش‌فرض از ptfVatRateOf (که پیش‌فرض آن ۱۰ است)', sf.indexOf('window.ptfVatRateOf') > -1 && /return 10;/.test(read('crm/vat-shared.js')));
T('توضیح «مبلغ بدون ارزش افزوده» وجود دارد', sf.indexOf('بدون ارزش افزوده') > -1);
T('slInvVatSum وجود دارد', /id="slInvVatSum"/.test(sf));
T('رشته‌ی خراب یادداشت حذف شد', sf.indexOf('</radius:8px;direction:ltr" oninput="slInvCalcLive()">') < 0);
T('input یادداشت درست بسته می‌شود', /<input id="slInvNote" style="direction:ltr" oninput="slInvCalcLive\(\)">/.test(sf));

/* ---------- منطق نمایش ---------- */
T('slInvTypeChanged wrapper را پیدا و نمایش می‌دهد', /window\.slInvTypeChanged = function/.test(sf) && /slInvVatWrap/.test(sf));
T('slInvCoverToggle wrapper رسمی را باز می‌کند', /window\.slInvCoverToggle = function/.test(sf) && sf.indexOf("vatWrap.style.display = ''") > -1);
T('محاسبه‌ی زنده از vatPct استفاده می‌کند', /vatAmountIrr = Math\.round\(amountIrr \* vatPct \/ 100\)/.test(sf));
T('ذخیره: vatPct/vatAmount روی رکورد رسمی', /if \(isOfficial && vatPct\) \{ inv\.vatPct = vatPct; inv\.vatAmount = vatAmountIrr; \}/.test(sf));
T('پاسخ متن نشان می‌دهد «ارزش افزوده: … جمع با ارزش افزوده»', sf.indexOf('جمع با ارزش‌افزوده') > -1);

T('tester490 در گیت CI', gate.indexOf('tester490-v34.7.91-supplier-vat.js') > -1);

console.log('\n— tester490 (v34.8.5: فیلد ارزش افزوده فاکتور رسمی تامین‌کننده — SUP-VAT-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
