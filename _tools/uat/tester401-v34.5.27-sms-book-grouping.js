'use strict';
var fs = require('fs');
var assert = require('assert');
var sms = fs.readFileSync('crm/sms.js', 'utf8');
var m = sms.match(/function smsBookDisplayGroups\(rows\) \{[\s\S]*?\n  \}/);
assert.ok(m, 'grouping helper missing');
var smsBookDisplayGroups;
eval(m[0].replace('function smsBookDisplayGroups', 'smsBookDisplayGroups = function'));
var one = smsBookDisplayGroups([
  { cd: 'PB-1', nm: 'علی رضایی', ent: 'شرکت الف', cat: 'cust', mob: '09121111111' },
  { cd: 'PB-2', nm: 'علی  رضایی', ent: 'شرکت الف', cat: 'cust', mob: '09122222222' },
  { cd: 'PB-3', nm: 'علی رضایی', ent: 'شرکت الف', cat: 'cust', mob: '09121111111' }
]);
assert.strictEqual(one.length, 1, 'same person/company/category must render once');
assert.strictEqual(one[0].rows.length, 2, 'all distinct mobile numbers must remain selectable');
var two = smsBookDisplayGroups([
  { cd: 'PB-1', nm: 'علی رضایی', ent: 'شرکت الف', cat: 'cust', mob: '09121111111' },
  { cd: 'PB-2', nm: 'علی رضایی', ent: 'شرکت ب', cat: 'cust', mob: '09122222222' }
]);
assert.strictEqual(two.length, 2, 'same name in different companies must not be merged');
assert.ok(sms.indexOf('window.smsToggleGroup') > -1 && sms.indexOf('window.smsMoveGroup') > -1, 'group selection and move controls required');
console.log('PASS tester401 sms-book-grouping');
