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
  ok(ver.crm_version === 'v34.4.60', 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = 'v34.4.60'") > -1, 'index release');
  ok(llm.indexOf("case 'bank_statement'") > -1, 'llm action');
  ok(llm.indexOf('Do NOT compute a bank ledger') > -1, 'no ledger prompt');
  ok(tr.indexOf('window.ptfTreasuryImportPdf') > -1, 'import pdf');
  ok(tr.indexOf('window.ptfTreasuryNormalizeAiRows') > -1, 'normalize ai');
  ok(tr.indexOf('ptfTreasuryCommitPdfPreview') > -1, 'preview commit');
  ok(tr.indexOf('مانده بانک ساخته نمی‌شود') > -1, 'preview disclaimer');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester354 finance-workflow-p8');
})();
