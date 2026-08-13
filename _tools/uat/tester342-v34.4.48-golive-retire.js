'use strict';
var fs = require('fs');
var assert = require('assert');
var storage = fs.readFileSync('crm/storage.js', 'utf8');
var golive = fs.readFileSync('crm/golive.js', 'utf8');

assert.ok(storage.indexOf('window.ptfMarkLiveProduction') > -1, 'live mode helper exists');
assert.ok(storage.indexOf("localStorage.setItem(k, '[]')") < 0 || storage.indexOf('ptfConvertToProduction') < storage.lastIndexOf('هیچ داده‌ای پاک نشد'), 'convert-to-production must not wipe keys');
assert.ok(storage.indexOf('پاکسازی اطلاعات آزمایشی') < 0 || storage.indexOf('onclick="ptfConvertToProduction()"') < 0, 'trial wipe button removed from bar');
assert.ok(golive.indexOf('پاک‌سازی آزمایشی بازنشسته است') > -1, 'GoLive run is retired');
assert.ok(golive.indexOf('return;\n    if (curRole() !== \'admin\') return;') > -1 || golive.indexOf('هیچ رکوردی حذف نشد') > -1, 'GoLive run returns before wipe');
assert.ok(golive.indexOf('پاک‌سازی آزمایشی بازنشسته') > -1, 'settings box is live-mode notice');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
var vm5 = String(version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
assert.ok(vm5 && (+vm5[1] > 34 || (+vm5[1] === 34 && +vm5[2] > 4) || (+vm5[1] === 34 && +vm5[2] === 4 && +vm5[3] >= 48)), 'release must retain or advance the v34.4.48 baseline');
var current = version.slice(1);
['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
});
console.log('PASS tester342-v34.4.48: experimental wipe retired; live data kept');
