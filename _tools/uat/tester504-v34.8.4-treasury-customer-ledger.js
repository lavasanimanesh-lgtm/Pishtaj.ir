#!/usr/bin/env node
'use strict';
/* v34.8.33 — regression: خزانهٔ all-period و دفتر canonical مشتری */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail || ''); }
}
function baseContext(data) {
  var context = {
    console: console, Date: Date, Math: Math, JSON: JSON, Blob: function () {},
    setTimeout: function () {}, clearTimeout: function () {},
    URL: { createObjectURL: function () { return 'blob:test'; }, revokeObjectURL: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    document: {
      getElementById: function () { return null; }, querySelectorAll: function () { return []; },
      createElement: function () { return { click: function () {}, remove: function () {} }; },
      body: { appendChild: function () {} }
    },
    getData: function (key) { return data[key] || []; },
    setData: function (key, value) { data[key] = value; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v || ''); },
    faDate: function () { return '1405/06/02'; }, faDateTime: function () { return '1405/06/02 12:00'; },
    alert: function () {}, confirm: function () { return false; }, prompt: function () { return null; },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'tester', name: 'Tester' }; }
  };
  context.window = context; context.globalThis = context;
  return vm.createContext(context);
}
function run(ctx, rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }

/* --- خزانه: ماندهٔ داشبورد fiscal-scoped می‌ماند اما گزارش دستی all-period است. --- */
var treasuryData = {
  ptf_crm_case_receipts: [
    { _id: 'R-OLD', status: 'posted', amountIRR: 100, receivedAt: '2025-06-15', dateFa: '1404/03/25', caseId: 'CASE-OLD' },
    { _id: 'R-FALLBACK', status: 'posted', amountIRR: 250, receivedAt: 'bad-date', dateFa: '۱۴۰۵/۰۵/۱۰', caseId: 'CASE-NEW' }
  ]
};
var tc = baseContext(treasuryData);
tc.ptfFinanceOfficialData = function () { return { cfg: { startISO: '2025-01-01', endISO: '2025-12-31' }, opening: {} }; };
tc.ptfJToISO = function (value) {
  var s = String(value || '').replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
  var map = { '1405/03/01': '2026-05-22', '1405/03/31': '2026-06-21', '1405/05/01': '2026-07-23', '1405/05/10': '2026-08-01', '1405/05/31': '2026-08-22', '1404/03/25': '2025-06-15' };
  return map[s] || '';
};
run(tc, 'crm/treasury.js');
var fiscalMoves = tc.ptfTreasuryCrmMoves();
var allPeriodMoves = tc.ptfTreasuryAllPeriodMoves();
var period = tc.ptfTreasuryPeriodData({ from: '۱۴۰۵/۰۵/۰۱', to: '۱۴۰۵/۰۵/۳۱', dir: 'all', src: 'all' });
T('ماندهٔ جاری خزانه همچنان فقط سال مالی فعال را می‌خواند', fiscalMoves.length === 1 && fiscalMoves[0].cd === 'R-OLD', JSON.stringify(fiscalMoves));
T('دفتر گزارش دوره‌ای گردش‌های خارج از سال مالی فعال را حذف نمی‌کند', allPeriodMoves.length === 2 && period.count === 1 && period.inflow === 250, JSON.stringify(period));
T('dateISO خراب مستقل از dateFa شمسی fallback می‌شود', period.moves[0] && period.moves[0].cd === 'R-FALLBACK');
T('رقم‌های فارسی فیلتر و تاریخ شمسی پیش از تبدیل نرمال می‌شوند', period.fromISO === '2026-07-23' && period.toISO === '2026-08-22', JSON.stringify(period));

/* --- حساب مشتری: canonical id/owner/amount و running balance پیش از فیلتر. --- */
var data = {
  ptf_crm_customers: [
    { _id: 'C-SERVER', co: 'مشتری بدون cd', active: true },
    { _id: 'C-OTHER', cd: 'LEG-OTHER', co: 'مشتری دیگر', active: true }
  ],
  ptf_crm_offers: [{ _id: 'O-1', no: 'OFF-1', buyerCd: 'C-SERVER', buyerCo: 'مشتری بدون cd' }],
  ptf_crm_deals: [{ _id: 'CASE-1', cd: 'CASE-LEGACY', rootOfferId: 'O-1', wonOffer: 'OFF-1' }],
  ptf_crm_invoices: [{
    _id: 'INV-SERVER', cd: 'INV-LEGACY', no: '1405-001', caseId: 'CASE-1', offerNo: 'OFF-1',
    baseAmountIRR: 900, vatAmountIRR: 100, totalAmountIRR: 1000, invDate: '2026-01-10', status: 'posted'
  }, {
    _id: 'INV-OTHER', cd: 'INV-OTHER-LEGACY', no: '1405-OTHER', buyerCd: 'C-OTHER',
    totalAmountIRR: 500, invDate: '2026-01-11', status: 'posted'
  }],
  ptf_crm_case_receipts: [
    { _id: 'REC-1', caseId: 'CASE-1', status: 'posted', amountIRR: 200, receivedAt: '2026-07-10' },
    { _id: 'REC-CONFLICT', customerId: 'C-SERVER', sourceInvoiceCd: 'INV-OTHER', status: 'posted', amountIRR: 999, receivedAt: '2026-07-15' }
  ],
  ptf_crm_sales_returns: [], ptf_crm_fin_attachments: []
};
var cc = baseContext(data);
cc.ptfJToISO = tc.ptfJToISO;
cc.PTF_SALES_DOMAIN_V2 = true;
cc.ptfCanSeeLedger = function () { return true; };
cc.ptfChequeReceived = function () { return [
  { cd: 'CHK-NO-OWNER', st: 'open', dueISO: '2026-07-11' },
  { cd: 'CHK-BY-INVOICE', st: 'open', dueISO: '2026-07-12', sourceInvoiceCd: 'INV-SERVER' },
  { cd: 'CHK-BY-CUSTOMER', st: 'held', dueISO: '2026-07-13', sourceCustomerCd: 'C-SERVER' },
  { cd: 'CHK-CONFLICT-OWNER', st: 'open', dueISO: '2026-07-14', sourceCustomerCd: 'C-OTHER', sourceInvoiceCd: 'INV-SERVER' },
  { cd: 'CHK-CONFLICT-INVOICE', st: 'open', dueISO: '2026-07-15', sourceCustomerCd: 'C-SERVER', sourceInvoiceCd: 'INV-OTHER' }
]; };
run(cc, 'crm/ar-reconcile.js');
run(cc, 'crm/customer-finance.js');
var accounts = cc.cfAccountRows('');
var allRows = cc.cfLedgerRows('C-SERVER', {});
var juneRows = cc.cfLedgerRows('C-SERVER', { from: '۱۴۰۵/۰۳/۰۱', to: '۱۴۰۵/۰۳/۳۱', status: 'all' });
var julyRows = cc.cfLedgerRows('C-SERVER', { from: '2026-07-01', to: '2026-07-31', status: 'all' });
var paymentOnly = cc.cfLedgerRows('C-SERVER', { from: '2026-07-01', to: '2026-07-31', status: 'payment' });
var invoiceRow = allRows.filter(function (r) { return r.link && r.link.kind === 'invoice'; })[0];
var receiptRow = julyRows.filter(function (r) { return r.link && r.link.kind === 'case-receipt'; })[0];
var chequeIds = allRows.filter(function (r) { return r.link && r.link.kind === 'cheque'; }).map(function (r) { return r.link.cd; }).sort();
T('فهرست حساب شناسهٔ canonical _id را حتی بدون cd استفاده می‌کند', accounts.length === 2 && accounts.some(function (r) { return r.cd === 'C-SERVER' && r.balance === 800; }), JSON.stringify(accounts));
T('مالک پرونده/Receipt از resolver متعارف AR و aliasهای پرونده خوانده می‌شود', !!receiptRow && receiptRow.credit === 200, JSON.stringify(julyRows));
T('Receipt با owner و invoice متعارض fail-closed از دفتر حذف می‌شود', !allRows.some(function (r) { return r.link && r.link.cd === 'REC-CONFLICT'; }), JSON.stringify(allRows));
T('مبلغ و وضعیت فاکتور ledger از invoiceState canonical می‌آید', invoiceRow && invoiceRow.debit === 1000 && invoiceRow.status === 'open', JSON.stringify(invoiceRow));
T('running balance روی کل دفتر ساخته و فیلتر فقط روی نمایش اعمال می‌شود', receiptRow && receiptRow.balance === 800 && julyRows.closingBalance === 800, JSON.stringify(julyRows));
T('بازهٔ بدون ردیف ماندهٔ واقعی در تاریخ گزارش را حفظ می‌کند', juneRows.length === 0 && juneRows.closingBalance === 1000, JSON.stringify(juneRows));
T('فیلتر وضعیت نیز مانده را از صفر دوباره محاسبه نمی‌کند', paymentOnly.length === 1 && paymentOnly[0].balance === 800 && paymentOnly.closingBalance === 800, JSON.stringify(paymentOnly));
T('چک بی‌مالک یا دارای owner/invoice متعارض به حساب همهٔ مشتریان نشت نمی‌کند', JSON.stringify(chequeIds) === JSON.stringify(['CHK-BY-CUSTOMER', 'CHK-BY-INVOICE']), JSON.stringify(chequeIds));

console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
