#!/usr/bin/env node
'use strict';
/* v34.7.88 — منطق فاکتور صوری/پوششی + چیدمان مودال ثبت فاکتور (SUP-VAT-002 / SUP-UX-002).
   ۱) منفعت خالص پوششی (اعتبار VAT − کارمزد فاکتورساز) باید در مانده/اعتبار تأمین‌کننده دیده شود،
      نه فقط در گزارش‌های جدا.
   ۲) مودال هم‌راستا/مرتب: دکمه‌های یکدست هم‌عرض + فیلد مبلغ «بدون ارزش افزوده» + پیام کوتاه‌تر. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sf = read('crm/supplier-finance.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.7.88', ver.crm_version === 'v34.7.88', ver.crm_version);
T('supplier-finance.js cache-bust 34.7.88', /supplier-finance\.js\?v=34\.7\.88/.test(idx));

/* ---------- SUP-VAT-002: منطق منفعت پوششی ---------- */
T('isCover: مقدار بدهی = کارمزد − اعتبار VAT', /var comm =/.test(sf) && /var vat =/.test(sf) && /var r = comm - vat;/.test(sf));
T('بدون تکرار invRemain برای پوششی', sf.indexOf('var rr = invRemain(i, d);') > -1);
T('اعتبار VAT به‌جای مبلغ اسمی کسر می‌شود (فقط منفعت خالص)', /منفعت خالص پوششی/.test(sf));
T('margin/credit روی by[c] موجود است', /credit: 0/.test(sf));

/* ---------- SUP-UX-002: چیدمان ---------- */
T('فوتر دکمه‌های یکدست sl-inv-footer', /class="sl-inv-footer"/.test(sf));
T('دکمه ثبت min-width دارد', /min-width:130px/.test(sf) && /min-width:110px/.test(sf));
T('CSS اختصاصی مودال در index.html', idx.indexOf('.md .sl-inv-footer .bt{') > -1);
T('فیلد مبلغ برچسب «بدون ارزش افزوده» دارد', sf.indexOf('مبلغ فاکتور (بدون ارزش افزوده)') > -1);
T('پیام پوششی کوتاه‌تر شد', sf.indexOf('تایید می‌کنم این یک فاکتور پوششی/صوری داخلی است.') > -1);
T('décor/cover box هنوز فیلد کارمزد دارد', /id="slInvCommissionPct"/.test(sf));

T('tester491 در گیت CI', gate.indexOf('tester491-v34.7.88-supplier-cover-ux.js') > -1);

console.log('\n— tester491 (v34.7.88: منفعت پوششی + چیدمان مودال — SUP-VAT-002/SUP-UX-002) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
