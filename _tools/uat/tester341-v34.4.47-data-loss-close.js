'use strict';
/* v34.4.47 — close attachment/data-loss paths without extra host/cloud copies. */
var fs = require('fs');
var assert = require('assert');

var storagePhp = fs.readFileSync('api/storage.php', 'utf8');
var storageJs = fs.readFileSync('crm/storage.js', 'utf8');
var syncJs = fs.readFileSync('crm/sync.js', 'utf8');

assert.ok(storagePhp.indexOf('$deleteSkipped = count($missed) > 0') > -1, 'archive_zip must skip original deletes when any key missed the zip');
assert.ok(storagePhp.indexOf('foreach ($addedKeys as $k)') > -1, 'archive_zip may delete only keys that were added to the zip');
assert.ok(storagePhp.indexOf("while ($token && $pages < 30)") > -1 && storagePhp.indexOf("case 'list':") > -1, 'list must paginate like usage');
assert.ok(storageJs.indexOf("sk.indexOf('ptf_crm_') === 0") > -1, 'orphan harvest must scan all ptf_crm_* keys');
assert.ok(storageJs.indexOf('ptf_crm_cheques_issued') > -1 && storageJs.indexOf('ptf_crm_opex') > -1, 'orphan harvest must include cheques and opex');
assert.ok(storageJs.indexOf('if (d.truncated)') > -1, 'orphan purge must abort on truncated S3 list');
assert.ok(syncJs.indexOf("'ptf_crm_sales_returns'") > -1, 'sales_returns must be in SYNC_KEYS');
assert.ok(syncJs.indexOf("ptf_crm_sales_returns']") > -1 || /GUARD_KEYS[\s\S]*ptf_crm_sales_returns/.test(syncJs), 'sales_returns must be under zero-push guard');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
var vm5 = String(version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
assert.ok(vm5 && (+vm5[1] > 34 || (+vm5[1] === 34 && +vm5[2] > 4) || (+vm5[1] === 34 && +vm5[2] === 4 && +vm5[3] >= 47)), 'release must retain or advance the v34.4.47 baseline');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});

console.log('PASS tester341-v34.4.47: archive_zip incomplete-safe, full harvest, paged list, sales_returns sync');
