#!/usr/bin/env node
'use strict';
/* v34.31.0 — رفع باگ مودال ثبت فاکتور + نمایش بدهی غیرنقدی تامین‌کننده (SUP-FIX-001/002)
   - _vatDate قبل از HTML تعریف می‌شود تا ReferenceError ندهد (پنجره بسته نشود).
   - box() lazy load چند بار تلاش می‌کند و بعد از رندر DOM پر می‌شود.
   - renderSuppliers بعد از رندر، ptfSlBoxLazy را صدا می‌زند.
   - بدهیِ فاکتور بدون پرداخت (غیرنقدی) در slBoxRows/balance دیده می‌شود. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sf = read('crm/supplier-finance.js');
var chq = read('crm/cheques.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.31.0', ver.crm_version === 'v34.31.0', ver.crm_version);
T('supplier-finance.js cache-bust 34.31.0', /supplier-finance\.js\?v=34\.31.0/.test(idx));

/* ---------- لاودمشکل ---------- */
T('_vatDate قبل از html تعریف شده', /var _vatDate = prefill\.date/.test(sf) && sf.indexOf('window.ptfVatRateOf(_vatDate)') > -1);
T('از _vatDate استفاده می‌شود (نه date تعریف‌نشده)', sf.indexOf("window.ptfVatRateOf(_vatDate) : 10") > -1);
T('lazy چند بار تلاش می‌کند', /_slBoxLazyTries < 8/.test(sf));
T('renderSuppliers ptfSlBoxLazy را صدا می‌زند', chq.indexOf('ptfSlBoxLazy') > -1);

/* ---------- بدهی غیرنقدی در balance ---------- */
var store = {
  ptf_crm_suppliers: [{ cd: 'S1', co: 'تامین‌کننده ۱' }],
  ptf_crm_supplier_finance: { invoices: [
    /* فاکتور خرید بدون هیچ پرداختی = بدهی غیرنقدی 1,000,000 */
    { cd: 'INV1', supplierCd: 'S1', no: 'FA-1', dateISO: '1405-03-01', dateFa: '1405/03/01', amount: 1000000, amountIrr: 1000000, cur: 'IRR', status: 'open', isOfficial: false }
  ], payments: [], adjustments: [] }
};
function getData(k) { return store[k] || []; }
function setData(k, v) { store[k] = v; return true; }
var sb = {
  console: console, Math: Math, Date: Date, JSON: JSON, getData: getData, setData: setData,
  curRole: function () { return 'admin'; }, isSenior: function () { return true; },
  roleDef: function () { return { buyPrice: true }; },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
  setInterval: function () { return 0; }, clearInterval: function () {},
  faDateTime: function () { return 'x'; }, genCode: function () { return 'X'; },
  escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
  ptfISOToJ: function (v) { return v || ''; }, ptfJToISO: function (v) { return v || ''; },
  ptfOnClickArg: function (v) { return String(v == null ? '' : v); }
};
sb.window = sb;
vm.createContext(sb);
try { vm.runInContext(sf, sb, { filename: 'supplier-finance.js' }); }
catch (e) { console.error('LOAD FAIL', e.stack); process.exit(1); }

/* slBoxRows داخلی است؛ ولی slSupplierOpenTotalsIRR از balance استفاده می‌کند */
var tot = sb.slSupplierOpenTotalsIRR();
T('بدهی غیرنقدی در slSupplierOpenTotalsIRR دیده می‌شود', tot.debt === 1000000, tot);
T('اعتبار صفر است', tot.credit === 0, tot);

T('tester494 در گیت CI', gate.indexOf('tester494-v34.7.91-supplier-modal-debt.js') > -1);

console.log('\n— tester494 (v34.31.0: مودال + بدهی غیرنقدی — SUP-FIX-001/002) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
