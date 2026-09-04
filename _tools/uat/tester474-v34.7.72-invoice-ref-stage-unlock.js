#!/usr/bin/env node
'use strict';
/* v34.36.3 — حذف قفل مرحله‌ای ارجاع فاکتور.
   قرارداد: ارجاع فاکتور رسمی در هر مرحله پس از برنده‌شدن ممکن است (نه فقط پس از تحویل
   کارفرما). قفل‌ها: ① نقش ارشد ② پرونده برنده. قفل مرحله (stg < 7) حذف شد؛ دکمهٔ
   «ارجاع فاکتور» در نوار عملیات پرونده همیشه فعال است (وقتی برنده و بدون فاکتور/ارجاع قبلی). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var sf = read('crm/salesfiles.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.36.3', ver.crm_version === 'v34.36.3', ver.crm_version);
T('salesfiles.js cache-bust 34.36.3', /salesfiles\.js\?v=34\.36\.3/.test(idx));

/* قفل مرحله حذف شد */
T('قفل مرحله (stg < 7) حذف شد', sf.indexOf('stg < 7') === -1 && sf.indexOf("why: 'stage'") === -1);
T('قفل دولایه مستند شد (نقش + برنده)', sf.indexOf('قفل دولایه: ① نقش ارشد ② پرونده برنده') > -1);
T('گارد نقش ارشد حفظ شد', sf.indexOf("!isSenior()) return { ok: false, why: 'role' }") > -1);
T('گارد پرونده برنده حفظ شد', sf.indexOf("!r || !r.wonOffer) return { ok: false, why: 'nofile' }") > -1);
T('گارد ارجاع تکراری حفظ شد', sf.indexOf("if (o.invRef) return { ok: false, why: 'already' }") > -1);

/* دکمه همیشه فعال (بدون نسخهٔ قفل‌شده) */
T('دکمهٔ ارجاع همیشه فعال است (بدون is-locked)', sf.indexOf("postAction('invoice-ref', '🧾', 'ارجاع فاکتور'") > -1);
T('نسخهٔ قفل‌شده (🔒 / is-locked) برای ارجاع حذف شد', sf.indexOf("'invoice-ref', '🔒'") === -1);
T('متغیر _stg7 حذف شد', sf.indexOf('_stg7') === -1);

/* متن‌های به‌روزشده */
T('timeline: هر مرحله پس از برنده‌شدن', sf.indexOf('پس از برنده‌شدن — هر مرحله') > -1);
T('پیام خطای stage حذف شد', sf.indexOf('ارجاع فاکتور قفل است — تا قبل از ثبت') === -1);
T('SMS: عبارت «تحویل شده» حذف شد', sf.indexOf('کالای پرونده ارجاعی به کارفرما تحویل شده') === -1);

T('tester474 در گیت CI', gate.indexOf('tester474-v34.7.72-invoice-ref-stage-unlock.js') > -1);

console.log('\n— tester474 (v34.36.3: حذف قفل مرحله‌ای ارجاع فاکتور) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
