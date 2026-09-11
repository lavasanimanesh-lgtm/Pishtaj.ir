'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester620 — v34.38.16 (RECORD-RECOVERY)

   ابزار «بازیابی رکوردهای گم‌شده از بک‌آپ» (crm/restore-collection.js) که برای
   برگرداندن ۶۷ درخواست تأمینِ حذف‌شده در حادثهٔ ۱۴۰۵/۰۶/۱۷ ساخته شد
   (ARENA-CRM-RFQSMART-MASS-DELETION-RCA-2026-09-09).

   قراردادهایی که این تستر قفل می‌کند:
     R1) فقط افزودن — هیچ رکورد موجودی ویرایش/حذف نمی‌شود.
     R2) رکورد دارای سنگ‌قبر حذف هرگز زنده نمی‌شود.
     R3) فقط رکورد دارای شناسهٔ یکتا و غایب از مجموعهٔ فعلی.
     R4) چند منبع: جدیدترین بک‌آپی که رکورد را دارد برنده است.
     R5) نقش admin/chairman + مسیر ذخیرهٔ استاندارد + audit.

   اجرا: node _tools/uat/tester620-v34.38.13-record-recovery.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var vm = require('vm');

var src = fs.readFileSync('crm/restore-collection.js', 'utf8');
var indexHtml = fs.readFileSync('crm/index.html', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');
var backupJs = fs.readFileSync('crm/backup.js', 'utf8');
var gate = fs.readFileSync('_tools/uat/run-ci-gate.js', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

var failures = 0;
function test(name, cond) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name);
}

/* ---------- بارگذاری ابزار در محیط ایزوله ---------- */
var store = {};
var alerts = [], audits = [], saved = null, flushed = false;
var ctx = {
  console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object, String: String, Promise: Promise,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }
  },
  document: {
    body: null, getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, createElement: function () { return { innerHTML: '', firstChild: null }; }
  },
  alert: function (m) { alerts.push(String(m)); },
  audit: function (a, b, c) { audits.push(String(b)); },
  curRole: function () { return 'chairman'; },
  ptfAuthToken: function () { return 'tok'; },
  getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
  setData: function (k, v) { store[k] = JSON.stringify(v); saved = { key: k, rows: v, via: 'setData' }; return true; },
  fetch: function () { return Promise.reject(new Error('network not used in unit test')); },
  FileReader: function () {}
};
ctx.window = ctx;
vm.runInNewContext(src, ctx, { filename: 'crm/restore-collection.js' });

/* ---------- دادهٔ همان حادثه ---------- */
function rfq(n, nm) { return { no: 'PTF-RFQS-1405-' + String(n).padStart(3, '0'), nm: nm || ('درخواست تأمین ' + n) }; }
var backup68 = [];
for (var i = 1; i <= 68; i++) backup68.push(rfq(i));
var current1 = [rfq(1, 'درخواست تأمین ۱ — نسخهٔ زندهٔ ویرایش‌شده')];
var KEY = 'ptf_crm_rfqsmart';

var plan = ctx.ptfRestoreCollectionPlan(KEY, current1, [{ name: 'daily-2026-09-07', t: '2026-09-07 21:28:24', rows: backup68 }], []);
test('۶۷ رکورد غایب شناسایی می‌شوند (۶۸ بک‌آپ منهای ۱ موجود)', plan.plan.length === 67);
test('رکورد موجود دوباره اضافه نمی‌شود', plan.plan.every(function (p) { return p.id !== 'PTF-RFQS-1405-001'; }));

var applied = ctx.ptfRestoreCollectionApply(KEY, current1, plan.plan, plan.plan.map(function (p) { return p.id; }));
test('پس از اعمال، ۶۸ رکورد داریم', applied.out.length === 68 && applied.added === 67);
test('R1 — رکورد زندهٔ موجود دست‌نخورده می‌ماند (ویرایش کاربر بازنویسی نمی‌شود)',
  applied.out[0].nm === 'درخواست تأمین ۱ — نسخهٔ زندهٔ ویرایش‌شده');
test('رکوردهای بازگردانده‌شده منبع و زمان بازیابی را ثبت می‌کنند',
  applied.out[1]._restoredFrom === 'daily-2026-09-07' && typeof applied.out[1]._restoredAt === 'string');

/* R2 — سنگ‌قبر حذف */
var archive = [
  { kind: 'rfqsmart', id: 'PTF-RFQS-1405-002', t: '2026-09-05' },
  { kind: 'archive_purge', collection: 'ptf_crm_projects', identities: { ptf_crm_rfqsmart: ['PTF-RFQS-1405-003'] } }
];
var plan2 = ctx.ptfRestoreCollectionPlan(KEY, current1, [{ name: 'daily-2026-09-07', t: '2026-09-07', rows: backup68 }], archive);
test('R2 — رکورد دارای سنگ‌قبر مستقیم زنده نمی‌شود', plan2.plan.every(function (p) { return p.id !== 'PTF-RFQS-1405-002'; }));
test('R2 — رکورد داخل archive_purge/identities هم زنده نمی‌شود', plan2.plan.every(function (p) { return p.id !== 'PTF-RFQS-1405-003'; }));
test('R2 — تعداد بازیابی به ۶۵ کاهش می‌یابد و علت گزارش می‌شود',
  plan2.plan.length === 65 && plan2.blockedByTomb.length === 2);

/* R3 — ردیف بدون شناسه */
var plan3 = ctx.ptfRestoreCollectionPlan(KEY, [], [{ name: 'b', t: '1', rows: [{ nm: 'بدون شناسه' }, rfq(9)] }], []);
test('R3 — ردیف بدون شناسهٔ یکتا نادیده گرفته و شمرده می‌شود', plan3.plan.length === 1 && plan3.withoutId === 1);

/* R4 — چند منبع: جدیدترین برنده است */
var plan4 = ctx.ptfRestoreCollectionPlan(KEY, [], [
  { name: 'daily-2026-09-07', t: '2026-09-07', rows: [rfq(5, 'نسخهٔ جدیدتر')] },
  { name: 'monthly-latest', t: '2026-09-01', rows: [rfq(5, 'نسخهٔ قدیمی‌تر'), rfq(6, 'فقط در قدیمی')] }
], []);
test('R4 — رکورد تکراری از جدیدترین منبع برداشته می‌شود',
  plan4.plan.length === 2 && plan4.plan[0].row.nm === 'نسخهٔ جدیدتر' && plan4.plan[0].from === 'daily-2026-09-07');
test('R4 — رکوردی که فقط در منبع قدیمی است هم بازیابی می‌شود',
  plan4.plan.some(function (p) { return p.id === 'PTF-RFQS-1405-006' && p.from === 'monthly-latest'; }));

/* انتخاب کاربر محترم است */
var partial = ctx.ptfRestoreCollectionApply(KEY, current1, plan.plan, ['PTF-RFQS-1405-010', 'PTF-RFQS-1405-011']);
test('فقط موارد انتخاب‌شده اعمال می‌شوند', partial.added === 2 && partial.out.length === 3);

/* شناسه: هم‌قرارداد با سرور */
test('قرارداد شناسه با سرور یکی است (_id > cd > no > id > code)',
  ctx.ptfRestoreCollectionId('ptf_crm_customers', { cd: 'C-1', no: 'X' }) === 'C-1' &&
  ctx.ptfRestoreCollectionId('ptf_crm_customers', { _id: 'A', cd: 'C-1' }) === 'A' &&
  ctx.ptfRestoreCollectionId('ptf_crm_offers', { no: 'O-9', cd: 'C-2' }) === 'O-9' &&
  ctx.ptfRestoreCollectionId('ptf_crm_rfqsmart', {}) === '');

/* خواندن فایل بک‌آپ در هر دو ساختار */
var parsedEnvelope = ctx.ptfRestoreCollectionParse(JSON.stringify({ t: '2026-09-07 21:28:24', data: { ptf_crm_rfqsmart: JSON.stringify(backup68) } }), KEY);
test('بک‌آپ استاندارد سرور (data.<key> رشته‌ای) خوانده می‌شود', parsedEnvelope.rows && parsedEnvelope.rows.length === 68 && parsedEnvelope.t === '2026-09-07 21:28:24');
var parsedObj = ctx.ptfRestoreCollectionParse({ data: { ptf_crm_rfqsmart: backup68 } }, KEY);
test('بک‌آپ با آرایهٔ مستقیم هم خوانده می‌شود', parsedObj.rows && parsedObj.rows.length === 68);
test('کلید غایب/پاسخ خطا با علت گزارش می‌شود',
  ctx.ptfRestoreCollectionParse(JSON.stringify({ data: {} }), KEY).why === 'no_key' &&
  ctx.ptfRestoreCollectionParse(JSON.stringify({ ok: false, error: 'نام فایل نامعتبر' }), KEY).why.indexOf('server_error:') === 0);

/* ---------- یکپارچگی نصب ---------- */
test('R5 — گیت نقش admin/chairman در کد هست',
  src.indexOf("var ROLES_OK = ['admin', 'chairman'];") > -1 && src.indexOf('بازیابی رکورد از بک‌آپ‌های سرور فقط برای ادمین') > -1);
test('ذخیره از مسیر استاندارد (فرمان موجودیت با fallback به setData) و flush سینک',
  src.indexOf('window.ptfEntitySaveCollection(key, res.out, { reason: SAVE_REASON') > -1 &&
  src.indexOf('setData(key, res.out)') > -1 && src.indexOf('ptfSyncFlushNow') > -1);
test('اسکن از بک‌آپ‌های سرور + امکان افزودن فایل دستی',
  src.indexOf("action=list_backups") > -1 && src.indexOf('action=get_backup&name=') > -1 &&
  src.indexOf('window.ptfRestoreCollectionAddSource') > -1);
test('اسکریپت در index.html بارگذاری و در sw.js precache شده است',
  /restore-collection\.js\?v=34\.38\.20/.test(indexHtml) && sw.indexOf("'./restore-collection.js' + ASSET_QUERY") > -1);
test('دکمهٔ ابزار در بخش بک‌آپ تنظیمات هست', backupJs.indexOf('ptfOpenRecordRecovery()') > -1);
test('تستر در گیت CI ثبت است', gate.indexOf('tester620-v34.38.13-record-recovery.js') > -1);
test('نسخهٔ انتشار هم‌تراز است', version === 'v34.38.20');

console.log('');
if (failures) { console.log('=== tester620: ' + failures + ' FAIL ==='); process.exit(1); }
console.log('PASS tester620-v34.38.16-record-recovery');
