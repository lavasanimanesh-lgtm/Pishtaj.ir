/* tester376 — capital call freeze + remainder + cash types */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var vm = require('vm');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var src = fs.readFileSync(path.join(root, 'crm/treasury-call.js'), 'utf8');
ok(src.indexOf('ptfTreasuryCallAllocate') > -1, 'allocate');
ok(src.indexOf('مانده صندوق منفی است') > -1, 'no auto debt copy');
ok(src.indexOf("addTx('call_due'") > -1 || src.indexOf("'call_due'") > -1, 'call_due');
ok(src.indexOf("'call_over'") > -1, 'call_over');

var ctx = { window: {}, console: console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
var shs = [
  { cd: 'A', name: 'A', pct: 40 },
  { cd: 'B', name: 'B', pct: 60 }
];
var rows = ctx.window.ptfTreasuryCallAllocate(1000000001, shs);
var sum = rows.reduce(function (s, r) { return s + r.due; }, 0);
ok(sum === 1000000001, 'remainder absorbed, sum=' + sum);
ok(rows.length === 2, 'two shareholders');

var sh = fs.readFileSync(path.join(root, 'crm/shareholders.js'), 'utf8');
ok(sh.indexOf('call_due') > -1 && sh.indexOf('callRemain') > -1, 'balance splits call');
ok(sh.indexOf('window.ptfShareAddTx') > -1, 'addTx exported');

var idx = fs.readFileSync(path.join(root, 'crm/index.html'), 'utf8');
ok(idx.indexOf('treasury-call.js') > -1, 'index loads module');
ok(/PTF_CRM_RELEASE = 'v34\.(?:[4-9]|\d{2,})\.\d+'/.test(idx), 'release set'); /* 2026-08-13: پذیرش v34.5+ */

var sync = fs.readFileSync(path.join(root, 'crm/sync.js'), 'utf8');
ok(sync.indexOf('ptf_crm_treasury_calls') > -1, 'sync key');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(/^v34\.(?:[4-9]|\d{2,})\.\d+$/.test(ver.crm_version), 'version'); /* 2026-08-13: پذیرش v34.5+ */

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester376 treasury-call');
