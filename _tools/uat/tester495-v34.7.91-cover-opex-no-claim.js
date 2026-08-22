#!/usr/bin/env node
'use strict';
/* فاکتور خرید رسمی پوششی: صادرکننده مطالبه ندارد؛ فقط کارمزد فاکتورساز هزینه جاری است. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sf = read('crm/supplier-finance.js');
var ox = read('crm/opex.js');
var wc = read('crm/working-capital.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('مانده فاکتور پوششی صفر است', /if \(inv && inv.isCover === true\) return 0;/.test(sf));
T('balance پوششی را به بدهی اضافه نمی‌کند', /if \(i\.isCover === true\) return;/.test(sf));
T('ثبت فاکتور پوششی opex می‌سازد', sf.indexOf('ptfOpexUpsertFromCoverInvoice') > -1);
T('ابطال/حذف پوششی opex را برمی‌دارد', sf.indexOf('ptfOpexRemoveFromCoverInvoice') > -1);
T('API ساخت کارمزد در opex هست', ox.indexOf('window.ptfOpexUpsertFromCoverInvoice') > -1);
T('کارمزد پوششی از سود سال دوباره‌شماری نمی‌شود', /isCoverOpex\(x\)/.test(ox));
T('گزارش تجمیعی پوششی را بدهی تأمین نمی‌کند', wc.indexOf('src.supplierLiability += cComm') === -1);

var store = {
  ptf_crm_opex: [],
  ptf_crm_suppliers: [{ cd: 'S-COV', co: 'فاکتورساز' }],
  ptf_crm_supplier_finance: { invoices: [
    { cd: 'SFINV-C', supplierCd: 'S-COV', no: 'C-1', amount: 100000000, amountIrr: 100000000, cur: 'IRR', rate: 1, status: 'open', isOfficial: true, isCover: true, coverCommissionPct: 1.5, coverCommissionAmount: 1500000, coverVatAmount: 10000000, dateISO: '2026-06-15', dateFa: '1405/03/25' }
  ], payments: [], adjustments: [] },
  ptf_crm_payables: [],
  ptf_crm_fiscal_snapshots: [],
  ptf_crm_deals: []
};
var ctx = {
  console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
  getData: function (k) { return store[k] || []; },
  setData: function (k, v) { store[k] = v; return true; },
  localStorage: { getItem: function (k) { return k === 'ptf_crm_supplier_finance' ? JSON.stringify(store.ptf_crm_supplier_finance) : (k === 'ptf_crm_settings' ? '{}' : null); }, setItem: function () {} },
  curRole: function () { return 'chairman'; }, isSenior: function () { return true; },
  roleDef: function () { return { finance: true, buyPrice: true }; },
  curSession: function () { return { name: 'حامد' }; },
  faDate: function () { return '1405/03/25'; }, faDateTime: function () { return '1405/03/25 10:00'; },
  genCode: function (pfx) { return pfx + '-T1'; },
  escP: function (v) { return String(v == null ? '' : v); },
  ptfNum: function (v) { return +v || 0; },
  ptfISOToJ: function () { return '1405/03/25'; },
  ptfJToISO: function (v) { return v || ''; },
  ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
  ptfFaMonthNow: function () { return '1405/03'; },
  document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
  setInterval: function () { return 0; }, clearInterval: function () {},
  audit: function () {}, alert: function () {}, confirm: function () { return true; }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(ox, ctx, { filename: 'opex.js' });
vm.runInContext(sf, ctx, { filename: 'supplier-finance.js' });

var up = ctx.ptfOpexUpsertFromCoverInvoice(store.ptf_crm_supplier_finance.invoices[0]);
T('ساخت opex کارمزد موفق است', !!(up && up.ok && up.created), up);
T('مبلغ opex = ۱٫۵ میلیون', store.ptf_crm_opex[0] && store.ptf_crm_opex[0].amt === 1500000, store.ptf_crm_opex[0]);
T('opex غیررسمی است', store.ptf_crm_opex[0] && store.ptf_crm_opex[0].isOfficial === false);
T('دسته کارمزد فاکتورساز', store.ptf_crm_opex[0] && store.ptf_crm_opex[0].cat === 'کارمزد فاکتورساز');

var tot = ctx.slSupplierOpenTotalsIRR();
T('صادرکننده پوششی بدهی ندارد', tot.debt === 0, tot);

var fiscal = ctx.ptfOpexSumFiscal('1405');
T('کارمزد پوششی در جمع سود سال دوباره‌شماری نمی‌شود', fiscal.total === 0, fiscal);

var rm = ctx.ptfOpexRemoveFromCoverInvoice('SFINV-C');
T('حذف opex متصل به فاکتور پوششی', !!(rm && rm.ok && rm.removed === 1), rm);
T('پس از حذف ردیفی نمانده', store.ptf_crm_opex.length === 0);

T('tester495 در گیت CI', gate.indexOf('tester495-v34.7.91-cover-opex-no-claim.js') > -1);

console.log('\n— tester495 (فاکتور پوششی: بدون مطالبه + هزینه جاری) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
