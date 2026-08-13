/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / خزانه)
   دلیل: فازهای P5–P8 ورک‌فلو مالی (گارد «منبع چهارم»، ورود اکسل/CSV/PDF
   صورتحساب بانک، تطبیق یکتا، پیش‌نمایش commit) با بازنویسی «خزانهٔ نقدی»
   (v34.4.83+) عمداً بازنشسته شدند — قرارداد بازنشستگی توسط tester377
   (treasury-clean-cache — سبز) پاس می‌شود و خزانهٔ فعلی توسط tester379-384
   (سبز) پوشش دارد.
   ===================================================================== */
/* tester353 — v34.4.59 finance workflow P7 statement import */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var tr = read('crm/treasury.js');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.(?:4\.((59|[6-9]\d))|[5-9]\.\d+|\d{2,}\.\d+\.\d+)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(tr.indexOf('window.ptfTreasuryParseStatementRows') > -1, 'parse rows');
  ok(tr.indexOf('window.ptfTreasuryImportParsed') > -1, 'import parsed');
  ok(tr.indexOf('window.ptfTreasuryImportFile') > -1, 'import file');
  ok(tr.indexOf('statement-import') > -1, 'src tag');
  ok(tr.indexOf('مانده بانک ساخته نشد') > -1, 'no ledger toast');
  ok(tr.indexOf('ptfTreasuryTemplateCsv') > -1, 'template');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester353 finance-workflow-p7');
})();
