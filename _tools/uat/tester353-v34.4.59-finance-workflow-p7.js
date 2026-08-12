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
  ok(/^v34\.4\.(59|[6-9]\d)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
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
