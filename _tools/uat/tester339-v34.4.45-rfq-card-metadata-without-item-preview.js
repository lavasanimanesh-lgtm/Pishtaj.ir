'use strict';
/* Regression: remove only item-name preview; retain all request/customer metadata and item search. */
var fs = require('fs');
var assert = require('assert');

var src = fs.readFileSync('crm/rfqsmart.js', 'utf8');
var renderStart = src.indexOf('window.renderRfqSmart = function');
var renderEnd = src.indexOf('window.rfqsSetListSearch', renderStart);
assert.ok(renderStart > -1 && renderEnd > renderStart, 'supplier-request renderer boundary missing');
var render = src.slice(renderStart, renderEnd);

/* The v34.4.43 metadata line must stay exactly in scope. */
assert.ok(render.indexOf('var parent = rfqsSourceRecord(r.srcRfq)') > -1, 'internal request source resolver must remain');
assert.ok(render.indexOf('درخواست داخلی:') > -1, 'internal request number must remain visible');
assert.ok(render.indexOf('شماره درخواست کارفرما:') > -1, 'customer request number must remain visible');
assert.ok(render.indexOf('| کارفرما:') > -1, 'customer name must remain visible');
assert.ok(render.indexOf("🔗 ' + escP(sourceMeta)") > -1, 'source metadata line must remain rendered');
assert.ok(render.indexOf('duplicateOf') > -1, 'intentional-duplicate badge must remain');
assert.ok(render.indexOf("(r.items || []).length + ' قلم") > -1, 'item count must remain');
assert.ok(render.indexOf("(r.targets || []).length + ' تامین‌کننده") > -1, 'supplier count must remain');
assert.ok(render.indexOf("' | ' + (STL[r.st] || '')") > -1, 'request status/date summary must remain');

/* Only item names/previews are removed from the card. */
assert.strictEqual(render.indexOf('itemPreview'), -1, 'item preview variable must not return');
assert.strictEqual(render.indexOf("slice(0, 3).map(function (it)"), -1, 'card must not derive visible item names');
assert.strictEqual(render.indexOf('📦'), -1, 'item-name preview icon must not render on cards');

/* Names/spec/model/brand remain indexed by the list search. */
var filterStart = src.indexOf('window.ptfRfqsFilterRecords = function');
var filterEnd = src.indexOf('  function rfqsDuplicateApprovalKey', filterStart);
var filter = src.slice(filterStart, filterEnd);
assert.ok(filter.indexOf('it.name || it.nm') > -1, 'item name must remain searchable');
assert.ok(filter.indexOf('it.spec || it.st || it.desc') > -1, 'item specification must remain searchable');
assert.ok(filter.indexOf('it.model || it.md') > -1, 'item model must remain searchable');
assert.ok(filter.indexOf('it.brand || it.br') > -1, 'item brand must remain searchable');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.ok(/^v34\.4\.\d+$/.test(version) && Number(version.split('.')[2]) >= 45, 'CRM version must remain v34.4.45 or later');
var current = version.slice(1);
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester339-v34.4.45: only item names are hidden; source/customer metadata and item search remain');
