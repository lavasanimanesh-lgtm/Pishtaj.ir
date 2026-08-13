/* tester350 — v34.4.56 finance workflow P4 append-only journal */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var guard = read('crm/finance-write-guard.js');
  var sync = read('crm/sync.js');
  var api = read('api/crm.php');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.(?:4\.((5[6-9]|[6-9]\d))|[5-9]\.\d+|\d{2,}\.\d+\.\d+)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(guard.indexOf('window.ptfFinanceEventAppend') > -1, 'journal append');
  ok(guard.indexOf('window.ptfFinanceUnionEvents') > -1, 'union events');
  ok(guard.indexOf('window.ptfFinanceReplayEvents') > -1, 'replay');
  ok(sync.indexOf("'ptf_crm_fin_events'") > -1, 'sync key');
  ok(sync.indexOf("key === 'ptf_crm_fin_events'") > -1, 'merge union');
  ok(sync.indexOf('ptfFinanceVoidWins') > -1, 'void wins');
  ok(api.indexOf('ptf_crm_fin_events') > -1, 'server allowlist');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester350 finance-workflow-p4');
})();
