/* tester273 — v31.7.97 (BUG-FINANCE-SUPPLIER-CONSISTENCY-UI-001)
 * Official financial report supplier liability must match Supplier Account source, and dark/settings/cards UI remains readable.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var sf = fs.readFileSync(path.join(ROOT, 'crm/supplier-finance.js'), 'utf-8');
var wc = fs.readFileSync(path.join(ROOT, 'crm/working-capital.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var acc = fs.readFileSync(path.join(ROOT, 'crm/settings-accordion.js'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static finance consistency fix');
T('supplier-finance خروجی رسمی بدهی/اعتبار IRR را expose می‌کند', sf.indexOf('window.slSupplierOpenTotalsIRR') > -1 && sf.indexOf("source: 'supplier_finance_balance'") > -1);
T('working-capital legacyPayableCds لینک‌شده را دوباره نمی‌شمارد', wc.indexOf('var linkedLegacy = {}') > -1 && wc.indexOf('!linkedLegacy[p.cd]') > -1);
T('working-capital برای گزارش جاری از همان مانده حساب تامین‌کنندگان استفاده می‌کند', wc.indexOf('window.slSupplierOpenTotalsIRR') > -1 && wc.indexOf('src.supplierLiability = +slt.debt') > -1 && wc.indexOf('src.supplierCredit = +slt.credit') > -1);

SECTION('Runtime finance consistency');
var store = {
  ptf_crm_suppliers: [{ cd: 'SUP-1', co: 'Alpha Supplier' }],
  ptf_crm_payables: [{ cd: 'PAY-1', pay: 'credit', sup: 'Alpha Supplier', amount: 1000, cur: 'IRR', t: '2026-07-22' }],
  ptf_crm_invoices: [],
  ptf_crm_cheques: [],
  ptf_crm_fiscal_snapshots: []
};
var ls = { s: { ptf_crm_supplier_finance: JSON.stringify({ schema: 1, invoices: [{ cd: 'SFI-1', supplierCd: 'SUP-1', no: 'INV-1', amount: 1000, amountIrr: 1000, cur: 'IRR', dateISO: '2026-07-22', status: 'posted', legacyPayableCds: ['PAY-1'] }], payments: [], adjustments: [] }) }, getItem: function (k) { return this.s[k] || null; }, setItem: function (k, v) { this.s[k] = String(v); } };
var sandbox = {
  console: console,
  window: null,
  localStorage: ls,
  document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
  getData: function (k) { return store[k] || []; },
  setData: function (k, v) { store[k] = v; },
  dedupNorm: function (v) { return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim(); },
  ptfTodayISO: function () { return '2026-07-22'; },
  ptfISOToJ: function (x) { return x; },
  ptfJToISO: function (x) { x = String(x || ''); if (/^\d{4}-/.test(x)) return x; if (x.indexOf('2027/') === 0) return '2027-03-21'; if (x.indexOf('2026/') === 0) return '2026-03-21'; return '2026-03-21'; },
  curRole: function () { return 'admin'; }, curSession: function () { return { name: 'Admin', user: 'admin' }; }, genCode: function (p) { return p + '-1'; }, faDateTime: function () { return 'now'; }, faDate: function () { return 'today'; }, escP: function (v) { return String(v == null ? '' : v); }
};
sandbox.window = sandbox;
vm.runInNewContext(sf, sandbox, { filename: 'supplier-finance.js' });
vm.runInNewContext(wc, sandbox, { filename: 'working-capital.js' });
var slTotals = sandbox.slSupplierOpenTotalsIRR();
var official = sandbox.ptfFinanceOfficialData();
T('runtime: حساب تامین‌کنندگان بدهی IRR درست را می‌دهد', slTotals.debt === 1000 && slTotals.credit === 0, JSON.stringify(slTotals));
T('runtime: گزارش رسمی legacy لینک‌شده را دوباره نمی‌شمارد', official.source.supplierLiability === 1000, JSON.stringify(official.source));

SECTION('UI readability fixes');
T('کارت‌های مالی اعداد بزرگ را wrap/clip-safe نمایش می‌دهند', idx.indexOf('.sc{background:var(--crd);padding:16px;border-radius:14px;border:1px solid var(--brd);min-width:0;overflow:hidden}') > -1 && idx.indexOf('overflow-wrap:anywhere') > -1 && idx.indexOf('font-size:clamp') > -1);
T('settings accordion در حالت شب از var(--crd)/var(--tx) استفاده می‌کند', acc.indexOf('background:var(--crd') > -1 && acc.indexOf('color:var(--tx') > -1 && acc.indexOf('ptf-set-row{background:var(--crd') > -1);
T('settings accordion ورودی‌ها و labelها را برای dark mode override می‌کند', acc.indexOf('.ptf-set-body input') > -1 && acc.indexOf('color:var(--tx') > -1 && acc.indexOf('background:var(--crd') > -1);
T('CRM/SW نسخه v33.4.7 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester273-finance-supplier-consistency-ui');
