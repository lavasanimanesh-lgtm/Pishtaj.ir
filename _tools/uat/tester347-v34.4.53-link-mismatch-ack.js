/* tester347 — user can dismiss supplier link-mismatch warning */
(function () {
  var fs = require('fs');
  var path = require('path');
  var src = fs.readFileSync(path.resolve(__dirname, '../../crm/supplier-finance.js'), 'utf8');
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  ok(src.indexOf('function invoiceLinkMismatchActive') > -1, 'active helper');
  ok(src.indexOf('window.slAckLinkMismatch') > -1, 'ack fn');
  ok(src.indexOf('linkMismatchAckSig') > -1, 'ack signature');
  ok(src.indexOf('if (invoiceLinkMismatchActive(i)) by[c].warn++') > -1, 'balance uses ack');
  ok(src.indexOf('برداشتن اخطار') > -1, 'dismiss button');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester347 link-mismatch-ack');
})();
