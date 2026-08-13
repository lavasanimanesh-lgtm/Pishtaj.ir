/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / گروه مالی)
   دلیل: متن‌های بازنشستگی مرحلهٔ میانی (v34.4.80) با بازنویسی نهایی خزانه
   (v34.4.83+) دیگر وجود ندارند؛ قرارداد فعلی «حذف UI تطبیق» در tester377
   (سبز) پاس می‌شود.
   ===================================================================== */
/* tester374 — bank statement matching retired */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var dq = fs.readFileSync(path.join(root, 'crm/data-quality.js'), 'utf8');
ok(dq.indexOf('treasury-unmatched') === -1, 'dq no treasury unmatched');
ok(dq.indexOf('ptfTreasuryUnmatched') === -1, 'dq does not call unmatched');

var tr = fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8');
ok(tr.indexOf("return { lines: [], moves: [] }") > -1, 'unmatched empty');
ok(tr.indexOf('تطبیق خودکار یکتا') === -1, 'no auto-match button');
ok(tr.indexOf('ptfTreasuryMatchMove(this.getAttribute') === -1, 'no match buttons');
ok(tr.indexOf('تطبیق صورتحساب کنار گذاشته') > -1, 'retired copy');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(ver.crm_version === 'v34.4.80', 'version');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester374 drop-bank-match');
