#!/usr/bin/env node
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var src = read('crm/docsx.js');
var php = read('api/sales-domain.php');
T('ptfDocxVoid تعریف شده', /window\.ptfDocxVoid = function/.test(src));
T('پوشش اقلام سند باطل را نمی‌شمارد', /x\.status === 'void' \|\| x\.voided/.test(src));
T('UI دکمه ابطال دارد', /ptfDocxVoidAsk/.test(src) && /dxRowAction\('void'/.test(src));
T('PL رویداد packing هم‌شماره را حذف می‌کند', /sfShipDeleteCommit/.test(src) && /type === 'packing'/.test(src));
T('رویژن نسخه ریالی را stale می‌کند', /staleAwardRev/.test(php));

var db = {
  ptf_crm_deals: [{ cd: 'D1', wonOffer: 'CO-1', docsx: [
    { cd: 'DX-1', no: 'PTF-PL-1405-001', type: 'PL', refs: [0], status: 'active' }
  ], shipEvents: [{ cd: 'SHP-1', type: 'packing', no: 'PTF-PL-1405-001' }], timeline: [] }],
  ptf_crm_offers: [{ no: 'CO-1', kind: 'CO', items: [{ name: 'a' }, { name: 'b' }] }]
};
var deleted = [];
var sb = {
  window: null, getData: function (k) { return db[k] || []; },
  setData: function (k, v) { db[k] = v; return true; },
  faDateTime: function () { return 't'; }, faYear: function () { return '1405'; },
  curSession: function () { return { name: 'آزمون', user: 't' }; },
  genCode: function (x) { return x + '-N'; }, escP: function (v) { return String(v || ''); },
  ptfOnClickArg: function (v) { return String(v || ''); },
  audit: function () {},
  sfShipDeleteCommit: function (cd, evCd, reason) { deleted.push({ cd: cd, evCd: evCd, reason: reason }); return { event: { cd: evCd } }; },
  console: console, JSON: JSON, Array: Array, Object: Object, String: String, Math: Math, Date: Date
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(src.replace(/var t = 0;[\s\S]*setInterval[\s\S]*?\}, 400\);/, ''), sb);
var cov = sb.ptfDocxCoverage('D1', 'PL');
T('پوشش قبل از ابطال ۱ از ۲', cov.used === 1 && cov.total === 2, JSON.stringify(cov));
var res = sb.ptfDocxVoid('D1', 'DX-1', 'تست ابطال');
T('ابطال موفق', res && res.ok && db.ptf_crm_deals[0].docsx[0].status === 'void');
T('رویداد packing هم‌شماره حذف شد', deleted.length === 1 && deleted[0].evCd === 'SHP-1', JSON.stringify(deleted));
var cov2 = sb.ptfDocxCoverage('D1', 'PL');
T('پس از ابطال پوشش صفر است', cov2.used === 0, JSON.stringify(cov2));
var again = sb.ptfDocxVoid('D1', 'DX-1', 'دوباره');
T('ابطال دوباره رد می‌شود', again && again.ok === false && again.why === 'already_void');
T('بدون دلیل رد می‌شود', sb.ptfDocxVoid('D1', 'DX-1', '').why === 'reason_required');

console.log('\n— tester438 (ابطال docsx + پوشش + packing) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
