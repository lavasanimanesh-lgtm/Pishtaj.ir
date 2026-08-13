/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / خزانه)
   دلیل: فازهای P5–P8 ورک‌فلو مالی (گارد «منبع چهارم»، ورود اکسل/CSV/PDF
   صورتحساب بانک، تطبیق یکتا، پیش‌نمایش commit) با بازنویسی «خزانهٔ نقدی»
   (v34.4.83+) عمداً بازنشسته شدند — قرارداد بازنشستگی توسط tester377
   (treasury-clean-cache — سبز) پاس می‌شود و خزانهٔ فعلی توسط tester379-384
   (سبز) پوشش دارد.
   ===================================================================== */
/* tester352 — v34.4.58 finance workflow P6 treasury match/attach/quality */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var tr = read('crm/treasury.js');
  var dq = read('crm/data-quality.js');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.(?:4\.((5[8-9]|[6-9]\d))|[5-9]\.\d+|\d{2,}\.\d+\.\d+)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(tr.indexOf('window.ptfTreasuryAutoMatch') > -1, 'auto match');
  ok(tr.indexOf('window.ptfTreasuryAttach') > -1, 'attach');
  ok(tr.indexOf('window.ptfTreasuryUnmatched') > -1, 'unmatched');
  ok(tr.indexOf('takenKeys') > -1, 'unique keys');
  ok(dq.indexOf('treasury-unmatched-bank') > -1, 'quality bank');
  ok(dq.indexOf("finHubSet(") > -1 && dq.indexOf('treasury') > -1, 'quality jump');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester352 finance-workflow-p6');
})();
