'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester621 — v34.38.14 (ARCHIVE-UNIQUENESS + RESTORE)

   گزارش کارفرما: «پرونده‌ای را از پرونده‌های فروش بایگانی کردم؛ به بایگانی رفت
   ولی بعد از رفرش در پرونده‌های فروش هم بود. یک پرونده باید یکتاست — هم‌زمان
   هم در بایگانی هم در فروش نباید باشد. و تا قبل از حذف قطعی باید بتوان پروندهٔ
   بایگانی‌شده را به جریان انداخت (بازگشت به فروش).»

   ریشهٔ بازتولیدشده (اجرا روی کد واقعی): وقتی پرونده‌ای که بایگانی می‌شد «آخرین»
   پروندهٔ باز بود، سپر کلاینتی حذفِ انبوهِ روتر مجموعه (teی شدن کالکشن = امضای
   خواندن کهنه) حذفِ عمدی را به legacy تنزل می‌داد؛ فرمان entity_delete به سرور
   نمی‌رسید و نسخهٔ سرور در pull/merge بعدی پرونده را به فروش برمی‌گرداند —
   هم‌زمان در هر دو محل. رکورد بایگانی هم «cd» نداشت و upsert اتمیک نمی‌شد.

   قراردادهایی که این تستر قفل می‌کند:
     U1) بایگانی — حتی آخرین پروندهٔ باز — entity_delete واقعی + upsert اتمیک
         بایگانی با «cd» پایدار (تلاش‌مجدد/دوبار بایگانی = همان رکورد، نه رونوشت).
     U2) رفرش/merge: پروندهٔ بایگانی‌شده به پرونده‌های فروش برنمی‌گردد.
     U3) قانون «یک پرونده = یک محل»: جاروی یکتایی هر نسخهٔ زندهٔ تکراریِ
         بایگانی‌شده را حذف می‌کند (التیام دادهٔ آلودهٔ قبلی هم).
     U4) «به جریان انداختن»: از بایگانی به فروش با cd/اسناد/رویدادهای اصلی +
         خنثی‌سازی سنگ‌قبر حذف (الگوی entity_restore سرور) تا در sync نمیرد.
     U5) بازگشت با نسخهٔ فعالِ هم‌نام: prefer-live (نسخهٔ فعال می‌ماند، رونوشت
         بایگانی حذف می‌شود) — خروجی هر مسیر دقیقاً یک محل است.
     U6) idempotence: جاروی دوم no-op؛ بازگشت دوم not_found.
     U7) افشا رابط‌کاربری: دکمهٔ «↩️ به جریان انداختن پرونده» در بایگانی فقط
         برای پرونده‌های بایگانی‌شده با ریشهٔ فروش + گارد نقش.

   اجرا: node _tools/uat/tester621-v34.38.14-archive-uniqueness-restore.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var path = require('path');

var failures = 0;
function test(name, cond, detail) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
}

var sf = fs.readFileSync('crm/salesfiles.js', 'utf8');
var prj = fs.readFileSync('crm/projects.js', 'utf8');
var indexHtml = fs.readFileSync('crm/index.html', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');
var gate = fs.readFileSync('_tools/uat/run-ci-gate.js', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

/* ═══ بخش ۱: قراردادهای ساختاری (نگهبان معماری) ═══ */
test('sfSave امضای opts را می‌پذیرد', /function sfSave\(list, opts\)/.test(sf));
test('حذفِ بایگانی هدفمند است (sfRemoveDeal با prevArr + allowBulkDelete)',
  sf.indexOf('function sfRemoveDeal(r, reason)') > -1 &&
  sf.indexOf("prevArr: before, allowBulkDelete: true") > -1 &&
  sf.indexOf("sfRemoveDeal(r, 'sf-archive')") > -1);
test('رکورد بایگانی «cd» پایدار دارد (مشتق از cd پرونده)',
  sf.indexOf("var arcCd = r.cd ? ('ARC-' + String(r.cd)") > -1 && sf.indexOf('cd: arcCd') > -1);
test('تایم‌لاین/وضعیت اصلی همراه آرشیو نگه داشته می‌شود (برای بازگشت کامل)',
  sf.indexOf('originTimeline: (r.timeline || []).slice()') > -1 && sf.indexOf("origSt: r.st || 'open'") > -1);
test('جاروی یکتایی موجود و به renderDeals + بوت وصل است',
  sf.indexOf('window.ptfSalesfileUniquenessSweep = function') > -1 &&
  sf.indexOf('window._sfUniqueSweepAt = Date.now();') > -1 &&
  sf.indexOf('setTimeout(function () { try { if (typeof window.ptfSalesfileUniquenessSweep') > -1);
test('تنها حذف‌کنندهٔ عمدیِ سپر، مالکیتِ حذف بایگانی/جارو/بازگشت است (نه حذف انبوه)',
  (sf.match(/allowBulkDelete: true/g) || []).length >= 3);
test('هستهٔ بازگشت موجود است و سه حالت خروجی دارد',
  sf.indexOf('window.ptfSalesfileRestoreFromArchive = function') > -1 &&
  sf.indexOf("mode = live.length ? 'prefer-live' : 'restore'") > -1);
test('خنثی‌سازی سنگ‌قبر حذف هنگام بازگشت (الگوی restored:<kind>)',
  sf.indexOf("a.kind = 'restored:' + String(a.kind || '')") > -1 &&
  sf.indexOf('sfNeutralizeDealTombstones') > -1);
test('بازگشت با «cd اصلی» (dealCd) — لینک‌های مالی حفظ می‌شوند',
  sf.indexOf('var dealCd = p.dealCd ||') > -1 && sf.indexOf('deal.autoSettleReceipts = (p.autoSettleReceipts || []).slice();') > -1);
test('پروندهٔ به‌جریان‌افتاده (restoredFrom) در فهرست فروش دیده می‌شود',
  sf.indexOf('!r.wonOffer && !r.restoredFrom &&') > -1);
test('دکمهٔ «به جریان انداختن» در نمای بایگانی + گارد نقش',
  prj.indexOf('↩️ به جریان انداختن پرونده') > -1 &&
  prj.indexOf('window.ptfArchiveCaseRestore = function') > -1 &&
  prj.indexOf('window.ptfArchiveCaseCanRestore = function') > -1);
test('دکمهٔ بازگشت کنار حذف قطعی است و فقط برای آرشیوهای ریشه‌فروش',
  prj.indexOf("if (p.origin === 'salesfile') return true") > -1 &&
  prj.indexOf("ptfArchiveCaseCanRestore(p) && ptfArcDocAllowed()") > -1);

/* ═══ بخش ۲: رفتاری — اجرای کد واقعی روی روتر واقعی ═══ */
require('./harness.js');
var BASE = p => path.resolve(__dirname, '../../crm', p);

var DEAL = { cd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'شرکت تست', wonOffer: 'CO-100', st: 'open', t: '1405/06/01', docs: [], timeline: [{ t: '1405/06/01', by: 'x', tx: 'ساخت' }], costEvents: [], lossEvents: [] };
var serverStore = {}, serverLog = [];
function seedServer() {
  serverStore = {
    ptf_crm_deals: [JSON.parse(JSON.stringify(DEAL))],
    ptf_crm_projects: [],
    ptf_crm_deleted_archive: []
  };
  serverLog = [];
}
function serverCmd(action, payload) {
  serverLog.push(action + ':' + payload.collection + ':' + (payload.id || (payload.record && (payload.record.cd || payload.record._id)) || ''));
  if (action === 'entity_upsert') {
    var coll = payload.collection, rec = payload.record;
    var idKey = coll === 'ptf_crm_deleted_archive' ? '_id' : 'cd';
    var id = String(rec[idKey] || rec.cd || '');
    if (!/^[A-Za-z0-9._:-]{3,60}$/.test(id)) return { state: 'rejected', error: { message: 'entity_id_required', status: 422 } };
    var rows = serverStore[coll] = serverStore[coll] || [];
    var found = -1;
    rows.forEach(function (r, i) { if (String(r[idKey] || r.cd || '') === id) found = i; });
    if (found < 0) rows.push(JSON.parse(JSON.stringify(rec))); else rows[found] = JSON.parse(JSON.stringify(rec));
    return { state: 'acked', response: { data: {}, rev: 1, result: {} } };
  }
  if (action === 'entity_delete') {
    var coll2 = payload.collection, id2 = String(payload.id || '');
    var rows2 = serverStore[coll2] = serverStore[coll2] || [];
    var idx = -1;
    rows2.forEach(function (r, i) { if (String(r.cd || r._id || '') === id2) idx = i; });
    if (idx >= 0) {
      rows2.splice(idx, 1);
      serverStore.ptf_crm_deleted_archive.push({ _id: 'DEL-' + id2, kind: 'archive_purge', collection: coll2, id: id2, cd: id2, aliases: [id2], identities: {} });
      return { state: 'acked', response: { data: {}, rev: 1, result: { deleted: true } } };
    }
    return { state: 'acked', response: { data: {}, rev: 1, result: { deleted: false } } };
  }
  return { state: 'acked', response: { data: {}, rev: 1, result: {} } };
}
function seed() {
  seedServer();
  setData('ptf_crm_deals', [JSON.parse(JSON.stringify(DEAL))]);
  setData('ptf_crm_projects', []);
  setData('ptf_crm_offers', [{ no: 'CO-100', kind: 'CO', inqNo: 'INQ-100', st: 'won', items: [] }]);
  setData('ptf_crm_rfqs', [{ cd: 'INQ-100', inqNo: 'INQ-100' }]);
  setData('ptf_crm_letters', []);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_rfqsmart', []);
  setData('ptf_crm_deleted_archive', []);
}
seed();

global.ptfSalesDomainCommand = function (action, payload) { return Promise.resolve(serverCmd(action, payload)); };
global.ptfSyncAcknowledgeKeys = function () {};
global.ptfSilentWrite = function (coll, s) { try { setData(coll, JSON.parse(s)); } catch (e) {} };
global.ptfEntityUpsert = function (collection, record, opts) {
  opts = opts || {};
  return global.ptfSalesDomainCommand('entity_upsert', { collection: collection, record: record }).then(function (st) {
    if (opts.cb) opts.cb(st.state === 'acked' ? { state: 'acked', result: {} } : { state: st.state, error: st.error });
  });
};
global.ptfEntityDelete = function (collection, id, opts) {
  opts = opts || {};
  return global.ptfSalesDomainCommand('entity_delete', { collection: collection, id: id, reason: opts.reason }).then(function (st) {
    if (opts.cb) opts.cb(st.state === 'acked' ? { state: 'acked', result: {} } : { state: st.state, error: st.error });
  });
};

/* روتر واقعی از sales-domain-v2.js */
var sdCode = fs.readFileSync(BASE('sales-domain-v2.js'), 'utf-8');
var mRouter = sdCode.match(/\/\* ============ v34\.8\.22[\s\S]*?window\.ptfEntitySaveCollection = function \(collection, nextArr, opts\) \{[\s\S]*?\n  \};\n/);
if (!mRouter) { console.log('FAIL router extraction'); process.exit(1); }
eval(mRouter[0].replace('window.ptfEntitySaveCollection', 'global.ptfEntitySaveCollection = global.window.ptfEntitySaveCollection'));
global.ptfEntitySaveCollection = global.window.ptfEntitySaveCollection;
global.PTF_ENTITY_CMD_ENABLED = { ptf_crm_deals: true, ptf_crm_projects: true, ptf_crm_deleted_archive: true };

global.renderDeals = function () {};
global.hideModal = function () {};
global.curSession = function () { return { name: 'تستر' }; };
global.ptfToast = function () {};
global.STORAGE_API = 'x';

/* کد واقعی ماژول پرونده‌های فروش */
eval(sf);

/* شبیه‌سازی رفرش: merge سرور↔محلی با union بر cd (الگوی ptfMergeByCodeCanonical) */
function refreshMerge() {
  var merged = {};
  (serverStore.ptf_crm_deals || []).forEach(function (r) { merged[r.cd] = r; });
  getData('ptf_crm_deals').forEach(function (r) { if (!merged[r.cd]) merged[r.cd] = r; });
  setData('ptf_crm_deals', Object.keys(merged).map(function (k) { return merged[k]; }));
  var pm = {};
  (serverStore.ptf_crm_projects || []).forEach(function (r) { pm[r.cd || r.no] = r; });
  getData('ptf_crm_projects').forEach(function (r) { var k = r.cd || r.no; if (!pm[k]) pm[k] = r; });
  setData('ptf_crm_projects', Object.keys(pm).map(function (k) { return pm[k]; }));
}

console.log('\n── رفتاری: بایگانیِ «تنها» پروندهٔ فروش (تولد دقیق باگ گزارش‌شده) ──');
global.sfCloseLost('DEAL-1', 'price', 'قیمت رقیب کمتر بود');

setTimeout(function () {
  test('U1a: حذف پرونده از فروش با فرمان واقعی entity_delete به سرور رسید (نه legacy)',
    serverLog.some(function (l) { return l === 'entity_delete:ptf_crm_deals:DEAL-1'; }),
    serverLog.join(' | '));
  test('U1b: بایگانی با upsert اتمیک و cd پایدار ثبت شد',
    serverLog.some(function (l) { return l === 'entity_upsert:ptf_crm_projects:ARC-DEAL-1'; }));
  test('U1c: سرور — فروش خالی و بایگانی یک رکورد archived',
    (serverStore.ptf_crm_deals || []).length === 0 &&
    (serverStore.ptf_crm_projects || []).length === 1 && serverStore.ptf_crm_projects[0].state === 'archived');
  test('U1d: حافظهٔ پرونده (تایم‌لاین اصلی) همراه آرشیو است',
    (serverStore.ptf_crm_projects[0].originTimeline || []).length === 1 &&
    serverStore.ptf_crm_projects[0].dealCd === 'DEAL-1');

  console.log('\n── رفتاری: رفرش (merge سرور↔محلی) ──');
  refreshMerge();
  var both = getData('ptf_crm_deals').some(function (d) { return d.cd === 'DEAL-1'; }) &&
    getData('ptf_crm_projects').some(function (p) { return p.dealCd === 'DEAL-1' || p.cd === 'ARC-DEAL-1'; });
  test('U2: بعد از رفرش پرونده فقط در بایگانی است (ماهیت یکتا)',
    getData('ptf_crm_deals').length === 0 &&
    getData('ptf_crm_projects').some(function (p) { return p.state === 'archived'; }) && !both);

  console.log('\n── رفتاری: به جریان انداختن (بازگشت از بایگانی) ──');
  var res = global.ptfSalesfileRestoreFromArchive('ARC-INQ-100', {});
  var hb = getData('ptf_crm_deals').filter(function (d) { return d.cd === 'DEAL-1'; })[0] || {};
  test('U4a: بازگشت موفق با mode=restore', !!(res && res.ok && res.mode === 'restore'), JSON.stringify(res));
  test('U4b: پرونده با «cd اصلی» و حافظهٔ کامل برگشت',
    hb.cd === 'DEAL-1' && hb.buyerCo === 'شرکت تست' && hb.wonOffer === 'CO-100' && (hb.timeline || []).length >= 2);
  test('U4c: پرونده از بایگانی حذف شد — دقیقاً یک محل',
    getData('ptf_crm_projects').length === 0 && getData('ptf_crm_deals').length === 1);
  test('U4d: نشانهٔ بازگشت روی رکورد است', hb.restoredFrom === 'ARC-INQ-100' && hb.st === 'open');

  console.log('\n── رفتاری: التیام دادهٔ آلودهٔ قدیمی (هم‌زمان در دو محل) ──');
  setData('ptf_crm_deals', [JSON.parse(JSON.stringify(DEAL))]);
  setData('ptf_crm_projects', [{ cd: 'ARC-DEAL-1', no: 'ARC-INQ-100', dealCd: 'DEAL-1', inqNo: 'INQ-100', state: 'archived', origin: 'salesfile' }]);
  var swp = global.ptfSalesfileUniquenessSweep({ quiet: true });
  test('U3a: جارو نسخهٔ زندهٔ تکراری را حذف و بایگانی را نگه داشت',
    swp.removed.length === 1 && swp.removed[0] === 'DEAL-1' &&
    getData('ptf_crm_deals').length === 0 && getData('ptf_crm_projects').length === 1);
  test('U6a: جاروی دوم no-op است', global.ptfSalesfileUniquenessSweep({ quiet: true }).removed.length === 0);

  console.log('\n── رفتاری: بازگشت با نسخهٔ فعالِ هم‌نام ──');
  setData('ptf_crm_deals', [JSON.parse(JSON.stringify(DEAL))]);
  setData('ptf_crm_projects', [{ cd: 'ARC-DEAL-1', no: 'ARC-INQ-100', dealCd: 'DEAL-1', inqNo: 'INQ-100', state: 'archived', origin: 'salesfile' }]);
  var res2 = global.ptfSalesfileRestoreFromArchive('ARC-INQ-100', {});
  test('U5: prefer-live — نسخهٔ فعال می‌ماند و رونوشت بایگانی حذف می‌شود (یک محل)',
    !!(res2 && res2.ok && res2.mode === 'prefer-live') &&
    getData('ptf_crm_deals').length === 1 && getData('ptf_crm_projects').length === 0, JSON.stringify(res2));
  test('U6b: بازگشتِ دوباره idempotent است (not_found)',
    (function () { var r3 = global.ptfSalesfileRestoreFromArchive('ARC-INQ-100', {}); return r3 && r3.ok === false && r3.why === 'not_found'; })());

  console.log('\n── پین‌های انتشار ──');
  test('تستر در گیت CI ثبت است', gate.indexOf('tester621-v34.38.14-archive-uniqueness-restore.js') > -1);
  test('نسخهٔ انتشار هم‌تراز است', version === 'v34.38.14', version);
  test('cache-buster در index.html به‌روز است', indexHtml.indexOf('salesfiles.js?v=34.38.14') > -1);
  test('Service Worker به‌روز است', sw.indexOf("v34.38.14") > -1);

  console.log('');
  if (failures) { console.log('=== tester621: ' + failures + ' FAIL ==='); process.exit(1); }
  console.log('PASS tester621-v34.38.14-archive-uniqueness-restore');
}, 60);
