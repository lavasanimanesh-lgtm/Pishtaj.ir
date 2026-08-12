'use strict';
var fs = require('fs');
var assert = require('assert');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var api = fs.readFileSync('api/crm.php', 'utf8');

assert.ok(sync.indexOf('kmOut[k] = +kmSend[k]') > -1, 'startup pull sends krevs');
assert.ok(sync.indexOf("fetch(API + '?action=data_rev')") < 0, 'no extra data_rev hop');
assert.ok(api.indexOf('function ptf_echo_json') > -1, 'gzip json helper');
assert.ok(api.indexOf("SKIP_API_LOG") > -1, 'skip log on pull/rev');
assert.ok(api.indexOf('FILE_APPEND') > -1, 'append-only api log');

console.log('PASS tester390 sync-fast-pull');
