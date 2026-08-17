#!/usr/bin/env node
'use strict';
/* v34.7.32 — P7 تخصیص FIFO عودت به فاکتور خرید + S4 ابزار پاکسازی + ARCH-03 awardDocs در win_offer */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function client(db) {
  var store = {};
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object,
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: {} },
    localStorage: { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = String(v); } },
    getData: function (k) { if (k === 'ptf_crm_supplier_finance') { try { return JSON.parse(store[k] || '{}'); } catch (e) { return {}; } } return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { if (k === 'ptf_crm_supplier_finance') { store[k] = JSON.stringify(v); return true; } db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    faDateTime: function () { return '1405/05/26 12:00'; }, faDate: function () { return '1405/05/26'; },
    ptfJToISO: function () { return '2026-08-17'; },
    genCode: function (x) { return x + '-T' + (++gen._n); },
    curSession: function () { return { name: 'مدیر آزمون' }; },
    curRole: function () { return 'commercial'; }, isSenior: function () { return true; },
    alert: function () {}, confirm: function () { return true; },
    ptfToast: function () {}, audit: function () {},
    ptfSurplusAdd: function () { return {}; },
    ptfSalesDomainApi: function () { return Promise.resolve({ ok: true }); },
    renderDeals: function () {}, renderOffers: function () {},
    window: null
  };
  function gen() {} gen._n = 0;
  sb.genCode = function (x) { return x + '-T' + (++gen._n); };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/finance-helpers.js'), sb, { filename: 'finance-helpers.js' });
  vm.runInContext(read('crm/procurement-link.js'), sb, { filename: 'procurement-link.js' });
  vm.runInContext(read('crm/case-revision.js'), sb, { filename: 'case-revision.js' });
  sb._store = store;
  return sb;
}

(function p7() {
  var db = {
    ptf_crm_deals: [{ _id: 'CASE-1', cd: 'D-1', inqNo: 'RFQ-1', wonOffer: 'CO-1' }],
    ptf_crm_offers: [{ no: 'CO-1', items: [{ name: 'a', qty: 2, price: 100 }] }],
    ptf_crm_suppliers: [{ cd: 'SUP-1', co: 'س' }],
    ptf_crm_purchase_returns: [], ptf_crm_invoices: [], ptf_crm_surplus: []
  };
  var s = client(db);
  s.localStorage.setItem('ptf_crm_supplier_finance', JSON.stringify({
    schema: 1,
    invoices: [
      { cd: 'SFINV-OLD', supplierCd: 'SUP-1', no: 'F-1404', amount: 400000, cur: 'IRR', status: 'open', dateISO: '2026-01-01' },
      { cd: 'SFINV-NEW', supplierCd: 'SUP-1', no: 'F-1405', amount: 800000, cur: 'IRR', status: 'open', dateISO: '2026-06-01' },
      { cd: 'SFINV-OTH', supplierCd: 'SUP-2', no: 'X', amount: 999999, cur: 'IRR', status: 'open', dateISO: '2026-01-01' }
    ],
    payments: []
  }));
  var rec = {
    cd: 'INSP-P7', supplierCd: 'SUP-1',
    lines: [{ name: 'a', disposition: 'supplier_return', dispositionQty: 2, unitCost: 500000 }]
  };
  s.ptfInspectionApplyDispositions(rec, db.ptf_crm_deals[0]);
  var sf = JSON.parse(s._store.ptf_crm_supplier_finance);
  var pay = (sf.payments || [])[0];
  T('P7 پرداخت تهاتری ساخته می‌شود', pay && pay.method === 'purchase_return' && pay.amount === 1000000, JSON.stringify(pay));
  T('P7 FIFO: اول فاکتور قدیمی‌تر پر می‌شود', pay && pay.allocations && pay.allocations[0] && pay.allocations[0].invoiceCd === 'SFINV-OLD' && pay.allocations[0].amount === 400000, JSON.stringify(pay && pay.allocations));
  T('P7 FIFO: باقی به فاکتور بعدی می‌رود', pay && pay.allocations[1] && pay.allocations[1].invoiceCd === 'SFINV-NEW' && pay.allocations[1].amount === 600000);
  T('P7 فاکتور تأمین‌کنندهٔ دیگر لمس نمی‌شود', !(pay.allocations || []).some(function (a) { return a.invoiceCd === 'SFINV-OTH'; }));
  T('P7 اعتبار تخصیص‌نیافته صفر است (کل مبلغ روی فاکتور نشست)', pay && pay.unallocated === 0, pay && pay.unallocated);
  T('P7 سند مرجوعی به پرداخت لینک شده', db.ptf_crm_purchase_returns[0] && db.ptf_crm_purchase_returns[0].financePaymentCd === pay.cd);

  /* بدون فاکتور باز — رگرسیون P4 */
  var db2 = { ptf_crm_deals: db.ptf_crm_deals, ptf_crm_offers: db.ptf_crm_offers, ptf_crm_suppliers: db.ptf_crm_suppliers, ptf_crm_purchase_returns: [] };
  var s2 = client(db2);
  s2.localStorage.setItem('ptf_crm_supplier_finance', JSON.stringify({ schema: 1, invoices: [], payments: [] }));
  s2.ptfInspectionApplyDispositions(rec, db2.ptf_crm_deals[0]);
  var pay2 = (JSON.parse(s2._store.ptf_crm_supplier_finance).payments || [])[0];
  T('عدم رگرسیون: بدون فاکتور خرید، کل مبلغ اعتبار می‌ماند', pay2 && pay2.unallocated === 1000000 && (pay2.allocations || []).length === 0);

  var fifo = s.ptfSupplierReturnAllocateFifo(0, [{ inv: { cd: 'X' }, remain: 10 }]);
  T('عدم رگرسیون: مبلغ صفر تخصیص نمی‌سازد', fifo.allocations.length === 0 && fifo.unallocated === 0);
})();

(function s4() {
  var src = read('_tools/apply-advance-leak-cleanup.js');
  T('S4 ابزار پاکسازی وجود دارد', src.indexOf('S4 (v34.7.32)') > -1);
  T('S4 پیش‌فرض dry-run است', src.indexOf('if (!APPLY)') > -1 && src.indexOf('--apply') > -1 && src.indexOf('--yes') > -1);
  T('S4 فقط caseId/customerId را برای مسیر A پاک می‌کند نه مبلغ', /rec\.amount/.test(src) === false && src.indexOf('rec.customerId = \'\'') > -1);
  T('S4 قبل از نوشتن پشتیبان می‌گیرد', src.indexOf('_s4-backup-') > -1);
  T('S4 تشخیص نشت هنوز فقط‌خواندنی است', /هیچ داده‌ای را تغییر نمی‌دهد/.test(read('_tools/diagnose-advance-leak.js')));
})();

(function arch03() {
  var php = read('api/sales-domain.php');
  T('ARCH-03: پروندهٔ تازه در win_offer دارای awardDocs است', /'awardDocs'=>\[/.test(php) && /won_snapshot/.test(php));
  T('ARCH-03: منبع صریح win_offer ثبت می‌شود', /'source'=>'win_offer'/.test(php));
  var ui = read('crm/unofficial-invoice.js');
  T('TODO گمراه‌کنندهٔ void سروری از مسیر legacy حذف شد', ui.indexOf('TODO: در آینده اگر endpoint سروری void_unofficial_invoice') < 0);
  T('مسیر V2 همچنان سرور را صدا می‌زند', ui.indexOf('ptfUnofficialInvoiceVoidServer') > -1);
})();

console.log('\n— tester435 (P7 / S4 / ARCH-03) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
