/* tester371 — nav-focus: mark + flash + go-sales-file wiring */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var nav = fs.readFileSync(path.join(root, 'crm/nav-focus.js'), 'utf8');
ok(nav.indexOf('window.ptfNavGoto') > -1, 'ptfNavGoto');
ok(nav.indexOf('window.ptfGoSalesFile') > -1, 'ptfGoSalesFile');
ok(nav.indexOf('ptf-nav-flash') > -1, 'flash class');
ok(nav.indexOf('data-ptf-nav') > -1, 'mark helper');

var sf = fs.readFileSync(path.join(root, 'crm/salesfiles.js'), 'utf8');
ok(sf.indexOf('data-ptf-nav="deal:') > -1, 'deal cards marked');
ok(sf.indexOf('id="sfDeal-') > -1, 'sfDeal id');
ok(sf.indexOf('ptfNavGoto(\'petty\'') > -1 || sf.indexOf('ptfNavGoto("petty"') > -1 || sf.indexOf("ptfNavGoto('petty'") > -1, 'petty via nav');

var off = fs.readFileSync(path.join(root, 'crm/offers.js'), 'utf8');
ok(off.indexOf('ptfGoSalesFile(dealCd)') > -1, 'offer→deal uses ptfGoSalesFile');

var ch = fs.readFileSync(path.join(root, 'crm/cheque-panel.js'), 'utf8');
ok(ch.indexOf('data-ptf-nav="cheque:') > -1, 'cheque rows marked');

var idx = fs.readFileSync(path.join(root, 'crm/index.html'), 'utf8');
ok(idx.indexOf('nav-focus.js') > -1, 'index loads nav-focus');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(/^v34\.(?:4\.(?:77|[89]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(ver.crm_version), 'version baseline'); /* 2026-08-13: پین لفظی → حفظ/پیشروی خط مبنا */

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester371 nav-focus');
