/* tester345 — cheque-ownerless quality check vs owner name */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  var dq = fs.readFileSync(path.join(root, 'crm/data-quality.js'), 'utf8');
  var mod = fs.readFileSync(path.join(root, 'crm/cheque-module.js'), 'utf8');
  var pan = fs.readFileSync(path.join(root, 'crm/cheque-panel.js'), 'utf8');
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  ok(mod.indexOf('window.ptfChequeOwnershipOf') > -1, 'ownership helper');
  ok(mod.indexOf('if (!rec.ownership)') > -1, 'create default ownership');
  ok(dq.indexOf('ptfChequeOwnershipOf') > -1, 'quality uses helper');
  ok(dq.indexOf("c.st === 'open' && !c.ownership") < 0, 'raw !c.ownership gone');
  ok(pan.indexOf('id=\\"chE_Own\\"') > -1 || pan.indexOf("id=\\\"chE_Own\\\"") > -1 || pan.indexOf("id=\"chE_Own\"") > -1, 'edit ownership select');
  ok(pan.indexOf('ownership: String(val(\'chE_Own\')') > -1 || pan.indexOf('ownership: String(val(\'chE_Own\'') > -1, 'save ownership');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester345 cheque-ownerless');
})();
