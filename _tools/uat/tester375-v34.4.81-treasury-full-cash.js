/* tester375 — treasury cash includes receipts/opex/petty/cheques, not invoices */
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '../..');
var fails = [];
function ok(c, m) { if (!c) fails.push(m); }

var tr = fs.readFileSync(path.join(root, 'crm/treasury.js'), 'utf8');
ok(tr.indexOf("src: 'وصولی مشتری'") > -1, 'legacy invoice customer receipts');
ok(tr.indexOf("get('ptf_crm_case_receipts')") > -1 && tr.indexOf("src: 'دریافت قطعی پرونده'") > -1, 'v35 case receipt source');
ok(tr.indexOf("advfull:") < 0 && tr.indexOf("o.advance.cashFull") < 0, 'offer paid/cashFull never infers cash');
ok(tr.indexOf("p.fromAdvance || p.migratedToReceiptId") > -1, 'skip legacy/migrated invoice receipt duplicate');
ok(tr.indexOf("if (payIsCheque(p)) return") > -1, 'cheque receipt waits for collection');
ok(tr.indexOf("src: 'هزینه جاری'") > -1, 'opex out');
ok(tr.indexOf('shareholderSalary') > -1, 'skip salary accrual opex');
ok(tr.indexOf('شارژ تنخواه') > -1, 'petty charge');
ok(tr.indexOf("src: 'چک سررسیدشده'") > -1, 'matured issued cheque');
ok(tr.indexOf("src: 'پرداخت خرید'") > -1, 'supplier pay not invoice');
ok(tr.indexOf("get('ptf_crm_invoices').filter(active).forEach(function (inv) {\n      arr(inv.payments)") > -1
  || tr.indexOf('arr(inv.payments).concat(arr(inv.pays))') > -1, 'invoices only via payments');
ok(tr.indexOf('ptfTreasuryOpeningCash') > -1, 'opening helper');

var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
ok(/^v(?:34\.(?:[6-9]|\d{2,})|(?:3[5-9]|[4-9]\d)\.\d+)\.\d+$/.test(ver.crm_version), 'version'); /* v34.6 architecture baseline */

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('PASS tester375 treasury-full-cash');
