#!/usr/bin/env node
'use strict';
/* v34.8.1 — منطق فاکتور صوری/پوششی + چیدمان مودال ثبت فاکتور (SUP-VAT-002 / SUP-UX-002).
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

T('VERSION.json = v34.8.1', ver.crm_version === 'v34.8.1', ver.crm_version);
T('supplier-finance.js cache-bust 34.8.1', /supplier-finance\.js\?v=34\.8\.1/.test(idx));

/* ---------- منطق پوششی: صادرکننده مطالبه ندارد ---------- */
T('isCover در مانده تأمین‌کننده نادیده گرفته می‌شود', /if \(i\.isCover === true\) return;/.test(sf));
T('مانده فاکتور پوششی صفر است', /if \(inv && inv.isCover === true\) return 0;/.test(sf));
T('کارمزد پوششی به opex می‌رود', sf.indexOf('ptfOpexUpsertFromCoverInvoice') > -1);
T('margin/credit روی by[c] موجود است', /credit: 0/.test(sf));

/* ---------- SUP-UX-002: چیدمان ---------- */
T('فوتر دکمه‌های یکدست sl-inv-footer', /class="sl-inv-footer"/.test(sf));
T('دکمه ثبت min-width دارد', /min-width:130px/.test(sf) && /min-width:110px/.test(sf));
T('CSS اختصاصی مودال در index.html', idx.indexOf('.md .sl-inv-footer .bt{') > -1);
T('فیلد مبلغ برچسب «بدون ارزش افزوده» دارد', sf.indexOf('مبلغ فاکتور (بدون ارزش افزوده)') > -1);
T('پیام پوششی کوتاه‌تر شد', sf.indexOf('تایید می‌کنم این یک فاکتور پوششی/صوری داخلی است.') > -1);
T('décor/cover box هنوز فیلد کارمزد دارد', /id="slInvCommissionPct"/.test(sf));

T('tester491 در گیت CI', gate.indexOf('tester491-v34.7.91-supplier-cover-ux.js') > -1);

console.log('\n— tester491 (v34.8.1: منفعت پوششی + چیدمان مودال — SUP-VAT-002/SUP-UX-002) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
