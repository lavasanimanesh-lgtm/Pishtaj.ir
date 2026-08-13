/* tester377 — matching UI gone; cache version aligned */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var tr = fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8');
ok(tr.indexOf('ptfTreasuryMatch') === -1, 'no match fn');
ok(tr.indexOf('ptfTreasuryAddLine') === -1, 'no statement line');
ok(tr.indexOf('ورود اکسل') === -1, 'no excel import btn');
ok(tr.indexOf('تطبیق') === -1 || tr.indexOf('تطبیق صورتحساب وجود ندارد') > -1, 'no live match ui');
ok(tr.indexOf('ptfTreasuryCrmMoves') > -1, 'cash moves remain');
ok(tr.indexOf('treasuryFocus') > -1, 'call hook host remains');

var idx = fs.readFileSync(path.join(root, 'crm/index.html'), 'utf8');
ok(/PTF_CRM_RELEASE = 'v34\.(?:[4-9]|\d{2,})\.\d+'/.test(idx), 'index release');
ok(idx.indexOf('?v=34.4.73') === -1, 'no stale 73 query');
ok(/treasury\.js\?v=34\.(?:[4-9]|\d{2,})\.\d+/.test(idx), 'treasury query');
ok(/treasury-call\.js\?v=34\.(?:[4-9]|\d{2,})\.\d+/.test(idx), 'call query');

var sw = fs.readFileSync(path.join(root, 'crm/sw.js'), 'utf8');
ok(/RELEASE = 'v34\.(?:[4-9]|\d{2,})\.\d+'/.test(sw), 'sw release');
ok(/ASSET_VERSION = '34\.(?:[4-9]|\d{2,})\.\d+'/.test(sw), 'sw asset');
ok(sw.indexOf('./treasury.js') > -1, 'sw caches treasury');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(/^v34\.(?:[4-9]|\d{2,})\.\d+$/.test(ver.crm_version), 'VERSION.json');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester377 treasury-clean-cache');
