/* Static/fixture UAT tester — Sprint 281 / v28.1
   Runs the financial-position derivation in a Node VM with deterministic data.
   It does NOT replace browser/UAT verification. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var db = {
  ptf_crm_fiscal_snapshots: [
    { cd: 'CFG1', type: 'fiscal_config_v281', active: true, fiscalYear: '1405', startISO: '2026-03-21', endISO: '2027-03-20', startFa: '1405/01/01', endFa: '1405/12/29', updatedAtISO: '2026-07-14T00:00:00.000Z' },
    { cd: 'OP1', type: 'opening_balance_v281', fiscalYear: '1405', category: 'receivable', amountIrr: 100, note: 'outside CRM', status: 'posted' },
    { cd: 'OP2', type: 'opening_balance_v281', fiscalYear: '1405', category: 'supplier_liability', amountIrr: 50, note: 'outside CRM', status: 'posted' },
    { cd: 'OPVOID', type: 'opening_balance_v281', fiscalYear: '1405', category: 'cash_bank', amountIrr: 5000, status: 'void' }
  ],
  ptf_crm_invoices: [
    { cd: 'CI1', no: 'INV-1', amount: 1000, invDate: '2026-04-21', payments: [{ amt: 200, t: '2026-05-01' }] },
    { cd: 'CI2', no: 'INV-VOID', amount: 999, invDate: '2026-04-21', status: 'void' }
  ],
  ptf_crm_payables: [
    { cd: 'LP1', pay: 'credit', amount: 400, cur: 'IRR', t: '2026-04-21', paid: [{ amt: 100 }] },
    { cd: 'LP2', pay: 'credit', amount: 1234, cur: 'IRR', t: '2026-04-21', sfInvoiceCd: 'SI1' }
  ],
  ptf_crm_cheques: [
    { cd: 'CH1', ownership: 'company', kind: 'finance', st: 'open', amt: 250, t: '2026-05-15' },
    { cd: 'CH2', ownership: 'personal', kind: 'finance', st: 'open', amt: 999, t: '2026-05-15' },
    { cd: 'CH3', ownership: 'company', kind: 'finance', st: 'void', amt: 333, t: '2026-05-15' },
    { cd: 'CH4', kind: 'finance', st: 'open', amt: 77, t: '2026-05-15' }
  ]
};
var sf = {
  schema: 1,
  invoices: [{ cd: 'SI1', no: 'SI-1', amount: 700, amountIrr: 700, cur: 'IRR', dateISO: '2026-04-11', status: 'open' }],
  payments: [{ cd: 'SP1', supplierCd: 'S1', amount: 500, amountIrr: 500, cur: 'IRR', dateISO: '2026-05-01', status: 'posted', allocations: [{ invoiceCd: 'SI1', amount: 300 }] }, { cd: 'SPVOID', amount: 999, amountIrr: 999, cur: 'IRR', dateISO: '2026-05-01', status: 'void', allocations: [] }],
  adjustments: [{ cd: 'ADJ1', amount: -50, amountIrr: -50, cur: 'IRR', dateISO: '2026-04-22', status: 'posted' }]
};
var context = {
  window: {}, console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object,
  getData: function (k) { return db[k] || []; }, setData: function (k, v) { db[k] = v; },
  localStorage: { getItem: function (k) { return k === 'ptf_crm_supplier_finance' ? JSON.stringify(sf) : null; }, setItem: function () {} },
  ptfTodayISO: function () { return '2026-07-14'; }, ptfTodayJ: function () { return '1405/04/23'; },
  ptfISOToJ: function (x) { return x; }, ptfJToISO: function () { return ''; },
  ptfNum: function (x) { return +String(x).replace(/[^\d.-]/g, '') || 0; }, ptfPayableRemain: function (p) { return (+p.amount || 0) - (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0); },
  curRole: function () { return 'admin'; }, curSession: function () { return { name: 'tester' }; }, faDateTime: function () { return '1405/04/23 10:00'; },
  genCode: function (p) { return p + '-T'; }, audit: function () {}, escP: function (x) { return String(x); },
  confirm: function () { return true; }, alert: function () {}, document: { createElement: function () { return {}; } }, Blob: function () {}, URL: { createObjectURL: function () { return ''; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('crm/working-capital.js', 'utf8'), context, { filename: 'working-capital.js' });
var d = context.window.ptfFinanceOfficialData();
assert.strictEqual(d.source.receivable, 800, 'Customer remaining balance must be invoice − receipts.');
assert.strictEqual(d.source.supplierLiability, 700, 'Supplier invoice remainder + unlinked legacy payable must be counted once.');
assert.strictEqual(d.source.supplierCredit, 250, 'Unallocated supplier payment + negative adjustment must be supplier credit.');
assert.strictEqual(d.source.companyCheque, 250, 'Only active company cheque is an exposure.');
assert.strictEqual(d.total.receivable, 900, 'Opening receivable must be added once.');
assert.strictEqual(d.total.supplierLiability, 750, 'Opening supplier liability must be added once.');
assert.strictEqual(d.total.netWorkingCapital, 150, 'Net position must apply receivable − liability + credit − company cheque.');
assert.strictEqual(d.issues.unclassifiedCheque.count, 1, 'Open cheque with no ownership must be flagged, not inferred as company.');
assert.strictEqual(d.moves.customerInvoices, 1000, 'Dated current-year customer invoice must be in movement.');
assert.strictEqual(d.moves.supplierPayments, 500, 'Void supplier payment must not be in movement.');
var hubHtml = context.window.wcFinanceHtml();
assert.ok(hubHtml.indexOf('fcConfigOpen()') > -1 && hubHtml.indexOf('fcOpeningOpen()') > -1, 'Finance hub must expose controlled fiscal settings and auditable opening-balance actions.');
assert.ok(hubHtml.indexOf('مالکیت نامشخص') > -1, 'Finance hub must disclose its ownership/data-quality guard.');
/* Integration guard: fiscal snapshots receive position only for the matching fiscal year. */
vm.runInContext(fs.readFileSync('crm/fiscal.js', 'utf8'), context, { filename: 'fiscal.js' });
var currentFiscal = context.window.ptfFiscalData('1405');
var oldFiscal = context.window.ptfFiscalData('1404');
assert.ok(currentFiscal.financialPosition && currentFiscal.financialPosition.total, 'Matching fiscal year must attach the derived financial position.');
assert.strictEqual(oldFiscal.financialPosition, null, 'A selected historical fiscal year must never receive the current financial position.');
assert.ok(context.window.ptfFiscalReportHtml(Object.assign({ shareholders: [], distributable: 0, reserve: 0, distPct: 0 }, currentFiscal)).indexOf('وضعیت مالی و سرمایه در گردش ثبت‌شده') > -1, 'Matching fiscal print must include the frozen financial-position section.');
console.log('PASS tester154-v281-finance-foundation: 15 deterministic financial-position checks');
