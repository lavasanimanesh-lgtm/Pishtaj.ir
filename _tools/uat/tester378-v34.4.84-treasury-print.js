/* tester378 — treasury printable report */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var tr = fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8');
ok(tr.indexOf('window.ptfTreasuryReportHtml') > -1, 'report html');
ok(tr.indexOf('window.ptfTreasuryPrint') > -1, 'print fn');
ok(tr.indexOf('ptfTreasuryPrint()') > -1, 'print button');
ok(tr.indexOf('بدهی فراخوان باز') > -1, 'shareholder call debt col');
ok(tr.indexOf('طلب از صندوق') > -1, 'credit col');
ok(tr.indexOf('فراخوان ') > -1 && tr.indexOf('درصد فریز') > -1, 'call freeze table');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(ver.crm_version === 'v34.4.84', 'version');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester378 treasury-print');
