/* tester372 — RFQ won button opens sales file, not archive */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var ir = fs.readFileSync(path.join(root, 'crm/inqreader.js'), 'utf8');
ok(ir.indexOf("if (typeof goPanel === 'function') goPanel('prj')") === -1, 'inqreader click no longer goPanel(prj)');
ok(ir.indexOf('ptfGoSalesFileForRfq') > -1, 'button calls ptfGoSalesFileForRfq');
ok(ir.indexOf('مشاهده پرونده') > -1, 'label مشاهده پرونده');
ok(ir.indexOf('مشاهده پروژه') === -1, 'old label removed');

var nav = fs.readFileSync(path.join(root, 'crm/nav-focus.js'), 'utf8');
ok(nav.indexOf('window.ptfGoSalesFileForRfq') > -1, 'helper defined');
ok(nav.indexOf('ptfGoSalesFile(dealCd)') > -1, 'helper uses ptfGoSalesFile');
ok(nav.indexOf("goPanel('deals')") > -1, 'fallback deals not archive');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(ver.crm_version === 'v34.4.78', 'version 34.4.78');

var idx = fs.readFileSync(path.join(root, 'crm/index.html'), 'utf8');
ok(idx.indexOf("PTF_CRM_RELEASE = 'v34.4.78'") > -1, 'index release');

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester372 rfq-view-salesfile');
