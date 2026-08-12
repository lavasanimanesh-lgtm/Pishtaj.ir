'use strict';
/* v34.5.4: سود پرونده فروش از UI حذف شد. این تستر دیگر وجود helper/نمایش را رد می‌کند. */
var fs = require('fs');
var assert = require('assert');

var src = fs.readFileSync('crm/salesfiles.js', 'utf8');
assert.ok(src.indexOf('window.ptfSalesFileMargin') === -1, 'margin helper must be removed');
assert.ok(src.indexOf('window.ptfSalesFileMarginBadge') === -1, 'badge helper must be removed');
assert.ok(src.indexOf('mgHtml') === -1, 'drawer strip must not render margin html');
assert.ok(src.indexOf('حاشیه سود') === -1, 'sales file UI must not mention حاشیه سود');
assert.ok(src.indexOf('ptfSalesFileMarginBadge(r)') === -1, 'collapsed card must not call margin badge');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.5.4');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester343: sales file profit UI removed (v34.5.4)');
