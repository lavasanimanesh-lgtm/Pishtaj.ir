#!/usr/bin/env node
'use strict';
/* ==============================================================================
   S4 (v34.7.32) — پاکسازی کنترل‌شدهٔ نشت پیش‌پرداخت / شناسهٔ پرونده
   مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md بند ۳ + F2-E

   پیش‌فرض: dry-run (هیچ فایلی نوشته نمی‌شود).
   اعمال واقعی فقط با --apply --yes و فقط روی این دو دستهٔ ایمن:
     E) caseId ذخیره‌شده با نام مستعار پرونده → بازنویسی به شناسهٔ متعارف (_id || cd)
     A) فاکتور بدون offerNo که به پروندهٔ بدون wonOffer چسبیده (تطبیق ''==='')
        → فقط caseId و customerId پاک می‌شوند؛ مبلغ/پرداخت دست نمی‌خورد

   رسیدها و ردیف‌های پولی حذف نمی‌شوند.

   اجرا:
     node _tools/apply-advance-leak-cleanup.js /path/to/crm/data/sync
     node _tools/apply-advance-leak-cleanup.js /path/to/crm/data/sync --apply --yes
   ============================================================================== */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..');
var args = process.argv.slice(2);
var APPLY = args.indexOf('--apply') > -1;
var YES = args.indexOf('--yes') > -1;
var srcArg = args.filter(function (a) { return a !== '--apply' && a !== '--yes' && a !== '--json'; })[0];

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function S(v) { return String(v == null ? '' : v); }
function idOf(x) { return S((x && (x._id || x.cd)) || ''); }

function loadDir(dir) {
  var store = {}, files = {};
  ['ptf_crm_invoices', 'ptf_crm_deals', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations'].forEach(function (k) {
    var p = path.join(dir, k + '.json');
    if (!fs.existsSync(p)) { store[k] = []; return; }
    var v = readJson(p);
    store[k] = Array.isArray(v) ? v : (v && Array.isArray(v.rows) ? v.rows : []);
    files[k] = p;
  });
  return { store: store, files: files, dir: dir };
}

var candidates = srcArg ? [srcArg] : [path.join(ROOT, 'crm/data/sync'), path.join(ROOT, 'crm/data')];
var loaded = null;
for (var i = 0; i < candidates.length; i++) {
  if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isDirectory()) {
    loaded = loadDir(candidates[i]);
    if (loaded.store.ptf_crm_deals.length || loaded.store.ptf_crm_invoices.length) break;
    loaded = null;
  }
}
if (!loaded) {
  console.log('هیچ پوشهٔ داده‌ای پیدا نشد. مسیر crm/data/sync را بدهید.');
  process.exit(2);
}

var db = loaded.store;
var cases = db.ptf_crm_deals, invoices = db.ptf_crm_invoices;
var receipts = db.ptf_crm_case_receipts, allocs = db.ptf_crm_receipt_allocations;

var alias = {};
cases.forEach(function (c) {
  if (!c) return;
  var canon = idOf(c); if (!canon) return;
  [c._id, c.cd].forEach(function (a) { var k = S(a); if (k && k !== canon) alias[k] = canon; });
});

var plan = { E: [], A: [] };

function scanCaseId(rows, kind) {
  rows.forEach(function (r) {
    if (!r) return;
    var k = S(r.caseId);
    if (k && alias[k]) plan.E.push({ kind: kind, id: idOf(r), from: k, to: alias[k], rec: r });
  });
}
scanCaseId(invoices, 'invoice');
scanCaseId(receipts, 'receipt');
scanCaseId(allocs, 'allocation');

var caseById = {};
cases.forEach(function (c) { if (idOf(c)) caseById[idOf(c)] = c; });
invoices.forEach(function (i) {
  if (!i || S(i.offerNo) !== '') return;
  if (S(i.caseId) === '' && S(i.customerId) === '') return;
  var c = caseById[S(i.caseId)];
  var suspicious = !!(c && S(c.wonOffer || c.offerNo) === '');
  if (suspicious) plan.A.push({ id: idOf(i), no: S(i.no), caseId: S(i.caseId), customerId: S(i.customerId), rec: i });
});

console.log('منبع: ' + loaded.dir);
console.log('E) بازنویسی caseId مستعار → متعارف: ' + plan.E.length);
plan.E.slice(0, 15).forEach(function (x) { console.log('  • ' + x.kind + ' ' + x.id + '  ' + x.from + ' ⇒ ' + x.to); });
if (plan.E.length > 15) console.log('  … و ' + (plan.E.length - 15) + ' مورد دیگر');
console.log('A) فاکتور بدون offerNo چسبیده به پروندهٔ بدون برد: ' + plan.A.length);
plan.A.slice(0, 15).forEach(function (x) { console.log('  • فاکتور ' + (x.no || x.id) + ' — پاک کردن caseId=' + x.caseId + ' customerId=' + x.customerId); });

if (!plan.E.length && !plan.A.length) {
  console.log('\n✅ چیزی برای پاکسازی ایمن نیست.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nحالت dry-run. برای اعمال واقعی:\n  node _tools/apply-advance-leak-cleanup.js ' + loaded.dir + ' --apply --yes');
  process.exit(0);
}
if (!YES) {
  console.log('\n⛔ برای اعمال باید --apply --yes هر دو با هم بیایند.');
  process.exit(3);
}

var stamp = new Date().toISOString().replace(/[:.]/g, '-');
var bakDir = path.join(loaded.dir, '_s4-backup-' + stamp);
fs.mkdirSync(bakDir, { recursive: true });
Object.keys(loaded.files).forEach(function (k) {
  if (fs.existsSync(loaded.files[k])) fs.copyFileSync(loaded.files[k], path.join(bakDir, k + '.json'));
});

plan.E.forEach(function (x) { x.rec.caseId = x.to; x.rec._s4CanonCaseAt = stamp; });
plan.A.forEach(function (x) {
  x.rec._s4UnboundFromCaseId = x.rec.caseId;
  x.rec._s4UnboundFromCustomerId = x.rec.customerId;
  x.rec.caseId = '';
  x.rec.customerId = '';
  x.rec._s4UnboundAt = stamp;
});

function writeArr(key) {
  var p = loaded.files[key];
  if (!p) return;
  fs.writeFileSync(p, JSON.stringify(db[key], null, 2), 'utf8');
}
writeArr('ptf_crm_invoices');
writeArr('ptf_crm_case_receipts');
writeArr('ptf_crm_receipt_allocations');

console.log('\n✅ اعمال شد. پشتیبان: ' + bakDir);
console.log('E=' + plan.E.length + ' | A=' + plan.A.length);
process.exit(0);
