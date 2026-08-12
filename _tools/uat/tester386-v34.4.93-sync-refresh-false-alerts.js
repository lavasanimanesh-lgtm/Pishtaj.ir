'use strict';
/* Hard refresh must not claim "other device" or re-dirty identical-to-server data. */
var fs = require('fs');
var assert = require('assert');
var src = fs.readFileSync('crm/sync.js', 'utf8');

assert.ok(src.indexOf('if (startupMerged !== newStr) state.dirty[k] = true') > -1,
  'startup merge dirties only when local has extra vs server');
assert.ok(src.indexOf('state.bootstrapped && !forceFull') > -1 &&
  src.indexOf('بخش از دستگاه دیگر به‌روز شد') > -1,
  'other-device toast only after live incremental pull');
assert.ok(src.indexOf('if (state.bootstrapped && !forceFull && typeof ptfToast === \'function\')') > -1, 'toast gated on incremental pull');

console.log('PASS tester386 sync-refresh-false-alerts');
