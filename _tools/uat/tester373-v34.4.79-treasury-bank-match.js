/* tester373 — unofficial/cash CRM moves are not unmatched-for-bank */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var tr = fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8');
ok(tr.indexOf('bankExpected') > -1, 'bankExpected flag');
ok(tr.indexOf('m.bankExpected && !used[m.key]') > -1, 'unmatched only bank-expected');
ok(tr.indexOf('if (!m.bankExpected) return false') > -1, 'suggest skips non-bank');
ok(tr.indexOf('خارج از حساب شرکت') > -1, 'ui skip label');

var dq = fs.readFileSync(path.join(root, 'crm/data-quality.js'), 'utf8');
ok(dq.indexOf('گردش حساب شرکت بدون تطبیق صورتحساب') > -1, 'dq label bank-only');
ok(dq.indexOf('نقد، غیررسمی و تهاتر تطبیق نمی‌خواهند') > -1, 'dq copy');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(ver.crm_version === 'v34.4.79', 'version');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester373 treasury-bank-match');
