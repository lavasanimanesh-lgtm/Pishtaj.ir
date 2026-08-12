/* tester348 — v34.4.54 finance workflow P0–P2 */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  var fail = [];
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  function ok(c, m) { if (!c) fail.push(m); }
  var guard = read('crm/finance-write-guard.js');
  var idx = read('crm/index.html');
  var sf = read('crm/supplier-finance.js');
  var dq = read('crm/data-quality.js');
  var ox = read('crm/opex.js');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.4\.(5[4-9]|[6-9]\d)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(idx.indexOf('finance-write-guard.js?v=') > -1, 'guard pinned');
  ok(guard.indexOf('window.ptfFinanceAssertWritable') > -1, 'write gateway');
  ok(guard.indexOf('window.ptfInvoiceLinkStatus') > -1, 'link status');
  ok(sf.indexOf('مغایرت مبلغ لینک') > -1, 'relabel mismatch');
  ok(sf.indexOf('ptfInvoiceLinkStatusHtml') > -1, 'reconcile uses status');
  ok(sf.indexOf('slAckLinkFromQuality') > -1, 'quality ack helper');
  ok(dq.indexOf('supplier-amount') > -1, 'quality amount type');
  ok(dq.indexOf('تطبیق قلم‌به‌قلم پیش‌فاکتور') > -1, 'procurement explanation');
  ok(ox.indexOf('ptfFinanceAssertWritable') > -1, 'opex uses gateway');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester348 finance-workflow-p0p2');
})();
