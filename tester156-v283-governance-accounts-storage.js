/* Runtime/source fixture UAT tester — Sprint 283
   Covers chairman fiscal unlock, sync-conflict preservation, account ordering/search,
   and the no-persistent-host-attachment policy. Browser UAT remains required. */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var db = {
  ptf_crm_fiscal_snapshots: [{ cd: 'FSY-1', year: '1405', locked: true, t: '1405/04/23 09:00', by: 'Chair', data: { year: '1405' } }],
  ptf_crm_customers: [{ cd: 'C-ZERO', co: 'آلفا' }, { cd: 'C-OPEN', co: 'بتا' }],
  ptf_crm_offers: [{ no: 'CO-1', buyerCd: 'C-OPEN' }],
  ptf_crm_invoices: [{ cd: 'INV-1', offerNo: 'CO-1', amount: 1000, payments: [{ amt: 250 }] }],
  ptf_crm_suppliers: [{ cd: 'S-ZERO', co: 'تامین آلفا' }, { cd: 'S-OPEN', co: 'تامین بتا' }],
  ptf_crm_payables: [], ptf_crm_cheques: [], ptf_crm_deals: []
};
var storage = { ptf_crm_supplier_finance: JSON.stringify({ schema: 1, invoices: [{ cd: 'SI-1', supplierCd: 'S-OPEN', cur: 'IRR', amount: 600, amountIrr: 600, status: 'open' }], payments: [], adjustments: [] }) };
var role = 'chairman', audits = [];
var context = {
  console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object, String: String,
  getData: function (k) { return db[k] || []; }, setData: function (k, v) { db[k] = v; },
  localStorage: { getItem: function (k) { return storage[k] || null; }, setItem: function (k, v) { storage[k] = String(v); }, removeItem: function (k) { delete storage[k]; } },
  curRole: function () { return role; }, curSession: function () { return { user: 'chair', name: 'Chair' }; },
  faDateTime: function () { return '1405/04/23 10:00'; }, faDate: function () { return '1405/04/23'; },
  genCode: function (x) { return x + '-T'; }, audit: function () { audits.push(Array.prototype.slice.call(arguments)); },
  escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
  ptfISOToJ: function (v) { return v; }, ptfJToISO: function (v) { return v; }, ptfTodayISO: function () { return '2026-07-14'; }, ptfTodayJ: function () { return '1405/04/23'; },
  ptfPayableRemain: function (p) { return (+p.amount || 0) - (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0); },
  document: { getElementById: function () { return null; }, querySelector: function () { return null; }, body: { insertAdjacentHTML: function () {} }, createElement: function () { return {}; } },
  alert: function () {}, confirm: function () { return true; }, ptfToast: function () {}, ptfDialog: function () {},
  setInterval: function () { return 1; }, clearInterval: function () {}, setTimeout: function () { return 1; }, clearTimeout: function () {},
  fetch: function () {}, navigator: { sendBeacon: function () {} }
};
context.window = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync('crm/fiscal.js', 'utf8'), context, { filename: 'fiscal.js' });
var unlock = context.ptfFiscalUnlockCommit('1405', 'اصلاح اسناد کامل نشده');
assert.strictEqual(unlock.ok, true, 'Chairman must be able to unlock an active fiscal lock.');
assert.strictEqual(db.ptf_crm_fiscal_snapshots[0].locked, false, 'Unlock must persist on the same snapshot array.');
assert.ok(db.ptf_crm_fiscal_snapshots[0].unlockedAtISO && db.ptf_crm_fiscal_snapshots[0].unlockReason, 'Unlock must have timestamp and reason.');
assert.strictEqual(db.ptf_crm_fiscal_snapshots[0].data.year, '1405', 'Frozen snapshot data must remain intact.');
assert.ok(audits.length > 0, 'Unlock must write an audit trail.');
role = 'admin';
assert.strictEqual(context.ptfFiscalUnlockCommit('1405', 'x').why, 'role', 'Admin must not bypass chairman-only unlock authority.');
role = 'chairman';

vm.runInContext(fs.readFileSync('crm/sync.js', 'utf8'), context, { filename: 'sync.js' });
var remoteLocked = JSON.stringify([{ cd: 'FSY-1', year: '1405', locked: true, t: '1405/04/23 09:00' }]);
var localUnlocked = JSON.stringify(db.ptf_crm_fiscal_snapshots);
var merged = JSON.parse(context.ptfSmartMerge('ptf_crm_fiscal_snapshots', localUnlocked, remoteLocked));
assert.strictEqual(merged[0].locked, false, 'A newer unlock must survive merge with an older locked server copy.');
var remoteUnlocked = JSON.stringify([{ cd: 'FSY-1', year: '1405', locked: false, lockStateAtISO: '2026-07-14T10:00:00.000Z', unlockedAtISO: '2026-07-14T10:00:00.000Z' }]);
var mergedReverse = JSON.parse(context.ptfSmartMerge('ptf_crm_fiscal_snapshots', remoteLocked, remoteUnlocked));
assert.strictEqual(mergedReverse[0].locked, false, 'A stale local lock must not overwrite a newer remote unlock.');

vm.runInContext(fs.readFileSync('crm/customer-finance.js', 'utf8'), context, { filename: 'customer-finance.js' });
var customers = context.cfAccountRows('');
assert.strictEqual(customers[0].cd, 'C-OPEN', 'Customer with non-zero balance must appear before zero balance.');
assert.strictEqual(customers[1].cd, 'C-ZERO', 'Zero-balance customer remains visible after open accounts.');
assert.strictEqual(context.cfAccountRows('بتا').length, 1, 'Customer search must filter by name.');

vm.runInContext(fs.readFileSync('crm/supplier-finance.js', 'utf8'), context, { filename: 'supplier-finance.js' });
var suppliers = context.slAccountRows('');
assert.strictEqual(suppliers[0].cd, 'S-OPEN', 'Supplier with non-zero balance must appear before zero balance.');
assert.strictEqual(suppliers[1].cd, 'S-ZERO', 'Zero-balance supplier remains visible after open accounts.');
assert.strictEqual(context.slAccountRows('بتا').length, 1, 'Supplier search must filter by name.');

var crmApi = fs.readFileSync('api/crm.php', 'utf8'), contactApi = fs.readFileSync('api/contact.php', 'utf8'), storageClient = fs.readFileSync('crm/storage.js', 'utf8'), storageLib = fs.readFileSync('api/storage-lib.php', 'utf8');
assert.ok(storageLib.indexOf('ptf_storage_put_uploaded_file') > -1, 'Shared cloud streaming helper must exist.');
assert.strictEqual(/move_uploaded_file\s*\(/.test(crmApi + contactApi), false, 'Public attachment endpoints must not persist files with move_uploaded_file.');
assert.ok(crmApi.indexOf("'mode' => 'arvan'") > -1 && crmApi.indexOf('attachment_cloud') > -1, 'Site RFQ/supplier attachment metadata must be cloud-only and fail explicitly.');
assert.ok(storageClient.indexOf('فایل روی هاست ذخیره نشد') > -1, 'Client must disclose cloud-only failure instead of claiming a local upload.');
console.log('PASS tester156-v283-governance-accounts-storage: 18 checks');
