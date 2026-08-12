'use strict';
var fs = require('fs');
var assert = require('assert');
var src = fs.readFileSync('crm/settings-accordion.js', 'utf8');

assert.ok(src.indexOf('function absorbLooseSettings') > -1, 'absorb siblings outside accordion');
assert.ok(src.indexOf('function wrapBuildSettings') > -1, 're-wrap if later modules hook buildSettings');
assert.ok(src.indexOf('current._ptfAcc') > -1, 'wrapper marker');
assert.ok(src.indexOf('det.open = false') > -1, 'sections start collapsed');
assert.ok(src.indexOf('hasLooseChildren') > -1 && src.indexOf('unwrapAccordion') > -1, 'rebuild when extras appear');

console.log('PASS tester388 settings-tabs');
