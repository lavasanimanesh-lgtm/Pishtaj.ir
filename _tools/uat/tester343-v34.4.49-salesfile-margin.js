'use strict';
/* v34.5.8: نمایش سود پرونده از پرونده فروش و بایگانی حذف شد.
   موتور سال مالی (ptfProjectProfitIRR / fiscal.js) دست‌نخورده می‌ماند. */
var fs = require('fs');
var assert = require('assert');

var sf = fs.readFileSync('crm/salesfiles.js', 'utf8');
assert.ok(sf.indexOf('window.ptfSalesFileMargin') === -1, 'margin helper must be removed');
assert.ok(sf.indexOf('window.ptfSalesFileMarginBadge') === -1, 'badge helper must be removed');
assert.ok(sf.indexOf('mgHtml') === -1, 'drawer strip must not render margin html');
assert.ok(sf.indexOf('حاشیه سود') === -1, 'sales file UI must not mention حاشیه سود');
assert.ok(sf.indexOf('ptfSalesFileMarginBadge(r)') === -1, 'collapsed card must not call margin badge');
assert.ok(sf.indexOf('ptfCalculateNetProfit') === -1, 'sales file must not open net-profit calculator');
assert.ok(sf.indexOf('سود خالص') === -1, 'sales file UI must not mention سود خالص');

var prj = fs.readFileSync('crm/projects.js', 'utf8');
assert.ok(prj.indexOf('ptfCalculateNetProfit') === -1, 'archive (closed sales file) must not open net-profit calculator');
assert.ok(prj.indexOf('سود خالص (مدیر)') === -1, 'archive must not show manager net-profit button');

var bc = fs.readFileSync('crm/buycompare.js', 'utf8');
assert.ok(bc.indexOf('مبنای سود واقعی') === -1, 'sales-file real-buy strip must not promise profit');

var off = fs.readFileSync('crm/offers.js', 'utf8');
assert.ok(off.indexOf('تا سود واقعی از داده قطعی محاسبه شود') === -1, 'win confirm must not promise sales-file profit');

var fiscal = fs.readFileSync('crm/fiscal.js', 'utf8');
assert.ok(fiscal.indexOf('ptfProjectProfitIRR') > -1, 'fiscal-year profit engine must remain');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.5.8');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester343: sales file profit UI removed (v34.5.8)');
