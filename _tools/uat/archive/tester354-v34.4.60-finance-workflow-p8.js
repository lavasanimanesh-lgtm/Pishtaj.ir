/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / خزانه)
   دلیل: فازهای P5–P8 ورک‌فلو مالی (گارد «منبع چهارم»، ورود اکسل/CSV/PDF
   صورتحساب بانک، تطبیق یکتا، پیش‌نمایش commit) با بازنویسی «خزانهٔ نقدی»
   (v34.4.83+) عمداً بازنشسته شدند — قرارداد بازنشستگی توسط tester377
   (treasury-clean-cache — سبز) پاس می‌شود و خزانهٔ فعلی توسط tester379-384
   (سبز) پوشش دارد.
   ===================================================================== */
/* tester354 — v34.4.60 finance workflow P8 PDF statement OCR */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var tr = read('crm/treasury.js');
  var llm = read('api/llm.php');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.(?:4\.((6[0-9]|[7-9]\d))|[5-9]\.\d+|\d{2,}\.\d+\.\d+)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(llm.indexOf("case 'bank_statement'") > -1, 'llm action');
  ok(llm.indexOf('Do NOT compute a bank ledger') > -1, 'no ledger prompt');
  ok(tr.indexOf('window.ptfTreasuryImportPdf') > -1, 'import pdf');
  ok(tr.indexOf('window.ptfTreasuryNormalizeAiRows') > -1, 'normalize ai');
  ok(tr.indexOf('ptfTreasuryCommitPdfPreview') > -1, 'preview commit');
  ok(tr.indexOf('مانده بانک ساخته نمی‌شود') > -1, 'preview disclaimer');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester354 finance-workflow-p8');
})();
