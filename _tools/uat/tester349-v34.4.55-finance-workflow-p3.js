/* tester349 — v34.4.55 finance workflow P3 */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var guard = read('crm/finance-write-guard.js');
  var chm = read('crm/cheque-module.js');
  var ch = read('crm/cheques.js');
  var ox = read('crm/opex.js');
  var py = read('crm/petty.js');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.4\.(5[5-9]|[6-9]\d)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(guard.indexOf('window.ptfDealCostSync') > -1, 'shared deal-cost');
  ok(ox.indexOf("source: 'opex'") > -1, 'opex uses helper');
  ok(py.indexOf('ptfDealCostSync') > -1, 'petty uses helper');
  ok(chm.indexOf('window.ptfChequeReplaceCompany') > -1, 'replace company store');
  ok(ch.indexOf('ptfChequeReplaceCompany') > -1, 'chSave routes to split keys');
  ok(ch.indexOf("ptfChequeCreate('issued'") > -1, 'batch/AI create via module');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester349 finance-workflow-p3');
})();
