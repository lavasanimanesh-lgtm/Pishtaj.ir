#!/usr/bin/env node
'use strict';
/* v34.35.0 — ادغام آیکون‌های سرستون جدول‌ها.
   دو آیکون روی سرستون‌ها بود: سنجاق فریز (📌 tables.js) روی هر ستون + مثلث مرتب‌سازی
   (▲/▼ sortable.js) که شبیه سنجاق بود. ادغام: سنجاق فقط هنگام hover یا روی ستونِ
   فریزشده دیده می‌شود (یک سنجاق) و مرتب‌سازی با فلش واضح ↑/↓. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var tables = read('crm/tables.js');
var sortable = read('crm/sortable.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.35.0', ver.crm_version === 'v34.35.0', ver.crm_version);
T('sortable.js cache-bust 34.35.0', /sortable\.js\?v=34\.35.0/.test(idx));
T('tables.js cache-bust 34.35.0', /tables\.js\?v=34\.35.0/.test(idx));

/* مرتب‌سازی: فلش واضح، نه مثلث سنجاق‌مانند */
T('مرتب‌سازی از فلش ↑/↓ استفاده می‌کند', sortable.indexOf("? ' ↑' : ' ↓'") > -1);
T('مثلث ▲/▼ در sortable.js حذف شد', sortable.indexOf('▲') === -1 && sortable.indexOf('▼') === -1);

/* سنجاق فریز: مخفی پیش‌فرض، نمایان هنگام hover، یک سنجاق روی ستون فریزشده */
T('سنجاق پیش‌فرض مخفی است (opacity:0)', tables.indexOf('.th-pin{cursor:pointer;font-size:10px;opacity:0') > -1);
T('سنجاق هنگام hover سرستون نمایان می‌شود', tables.indexOf('th:hover .th-pin{opacity:.55}') > -1);
T('سنجاق فریزشده یکتا و نارنجی می‌ماند', tables.indexOf('.th-pin.on{opacity:1;color:#ef4b1a}') > -1);
T('سنجاق همچنان فقط با کلیک فریز می‌کند (منطق فریز حفظ شد)', tables.indexOf('tbl.querySelectorAll(\'.col-frozen\')') > -1);

T('tester465 در گیت CI', gate.indexOf('tester465-v34.7.63-header-pin-merge.js') > -1);

console.log('\n— tester465 (v34.35.0: ادغام سنجاق سرستون) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
