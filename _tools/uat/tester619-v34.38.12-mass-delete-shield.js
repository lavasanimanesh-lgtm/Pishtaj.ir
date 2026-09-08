'use strict';
/* ─────────────────────────────────────────────────────────────────────────────
   tester619 — v34.38.12 (MASS-DELETE-SHIELD)

   حادثهٔ واقعی (پروداکشن، ۱۴۰۵/۰۶/۱۷ — شواهد از بک‌آپ‌های چرخشی):
     daily-2026-09-07 → ptf_crm_rfqsmart = ۶۸ رکورد
     daily-2026-09-08 → ptf_crm_rfqsmart = ۱ رکورد   (بدون هیچ سنگ‌قبری در بایگانی)
   یعنی ۶۷ «درخواست تأمین» بی‌صدا از سرور پاک شدند و هر سه بک‌آپ چرخشی بعدی هم
   همان نسخهٔ ۱ رکوردی را ثبت کردند.

   زنجیرهٔ علت:
   ① مرورگر با bootstrap شکست‌خورده (باگ pull اتمیک v34.38.10) نمای ناقص داشت؛
      getData وقتی آینهٔ IDB آب‌رسانی نشده باشد [] برمی‌گرداند.
   ② pushViaPhaseB پیش از گیت «تا bootstrap تمام نشده push ممنوع» صدا زده می‌شد،
      پس همان نمای ناقص به سرور رفت.
   ③ سپر سروری فقط آرایهٔ «خالی» را می‌گرفت؛ ۶۸ ← ۱ از آن رد شد.
   ④ GUARD_KEYS کلاینت و فهرست ۸ کلیدیِ قرنطینهٔ بک‌آپ، ptf_crm_rfqsmart را نداشتند.

   این تستر هر چهار حلقه را قفل می‌کند.
   اجرا: node _tools/uat/tester619-v34.38.12-mass-delete-shield.js
   ───────────────────────────────────────────────────────────────────────────── */
var fs = require('fs');
var vm = require('vm');

var api = fs.readFileSync('api/crm.php', 'utf8');
var syncSrc = fs.readFileSync('crm/sync.js', 'utf8');
var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;

var failures = 0;
function test(name, cond) {
  if (cond) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name);
}

/* ===========================================================================
   ۱) قرارداد سرور (متن api/crm.php — php روی رانر موجود نیست)
   =========================================================================== */
test('تابع گزارش حذف انبوه و مجموعهٔ سنگ‌قبرها در سرور تعریف شده‌اند',
  api.indexOf('function sync_mass_deletion_report(') > -1 &&
  api.indexOf('function sync_tombstone_id_set(') > -1 &&
  api.indexOf('function sync_log_blocked_deletion(') > -1);
test('data_push پیش از ذخیره، حذف انبوهِ بی‌سنگ‌قبر را به conflict تبدیل می‌کند',
  api.indexOf('$mdReport = sync_mass_deletion_report($k, $v, $mdExisting, $serverArchiveJson, $incomingArchiveJson);') > -1 &&
  api.indexOf('$massBlocked[$k] = $mdReport;') > -1 &&
  api.indexOf("'massDeletionBlocked' => $massBlocked") > -1);
test('سپر قرنطینهٔ بک‌آپ دیگر فهرست دستی ۸ کلیدی نیست (rfqsmart هم پایش می‌شود)',
  api.indexOf('$guardKeys = [];') > -1 &&
  api.indexOf("foreach (array_keys($exC) as $gk) if (is_string($gk) && strpos($gk, 'ptf_crm_') === 0) $guardKeys[$gk] = true;") > -1);
test('restore/allow_wipe و کلیدهای union از سپر مستثنا مانده‌اند (رفتار عمدی حفظ شد)',
  api.indexOf('if (!$restore && !$allow_wipe && !$isSharedUnion) {\n                $mdExisting = sync_key_read($sdir, $k);') > -1);

/* ===========================================================================
   ۲) پورت دقیق قاعدهٔ سرور و آزمون رفتاری آن روی دادهٔ همان حادثه
   =========================================================================== */
function recordId(key, r) {
  if (!r || typeof r !== 'object') return '';
  if (key === 'ptf_crm_offers') return String(r.no || r.cd || r.id || '').trim();
  return String(r._id || r.cd || r.no || r.id || r.code || r.invoiceCd || '').trim();
}
var KINDS = { ptf_crm_rfqsmart: ['rfqsmart', 'supplyrfq'], ptf_crm_rfqs: ['rfq', 'request', 'inq', 'inquiry'], ptf_crm_customers: ['customer', 'customers', 'cust'] };
function tombstoneIdSet(key, archive) {
  var kinds = KINDS[key] || [], ids = {};
  (archive || []).forEach(function (d) {
    if (!d || typeof d !== 'object') return;
    var kind = String(d.kind || '').toLowerCase();
    if (kind === 'archive_purge') {
      if (d.identities && Array.isArray(d.identities[key])) d.identities[key].forEach(function (x) { if (String(x).trim()) ids[String(x).trim()] = true; });
      if (!String(d.collection || '').trim() && Array.isArray(d.aliases)) ids.__alias_purge__ = true;
      return;
    }
    if (kinds.indexOf(kind) < 0) return;
    var id = String(d.id || d.no || d.cd || '').trim();
    if (id) ids[id] = true;
  });
  return ids;
}
/* پورت مو‌به‌موی sync_mass_deletion_report */
function massDeletionReport(key, incoming, server, archive) {
  if (!Array.isArray(incoming) || !Array.isArray(server)) return null;
  if (server.length < 4) return null;
  var tomb = tombstoneIdSet(key, archive);
  if (tomb.__alias_purge__) return null;
  var incIds = {};
  incoming.forEach(function (r) { var id = recordId(key, r); if (id) incIds[id] = true; });
  var missing = server.filter(function (r) {
    var id = recordId(key, r);
    return id && !incIds[id] && !tomb[id];
  }).map(function (r) { return recordId(key, r); });
  if (missing.length <= 3 || missing.length < server.length * 0.25) return null;
  return { lost: missing.length, serverCount: server.length, incomingCount: incoming.length };
}
var rfqsmart68 = [];
for (var i = 1; i <= 68; i++) rfqsmart68.push({ no: 'PTF-RFQS-1405-' + String(i).padStart(3, '0'), nm: 'درخواست تأمین ' + i });
var justOne = [{ no: 'PTF-RFQS-1405-001', nm: 'درخواست تأمین ۱' }];

test('بازتولید حادثه: ارسال ۱ رکورد روی ۶۸ رکورد سرور مسدود می‌شود',
  (function () { var r = massDeletionReport('ptf_crm_rfqsmart', justOne, rfqsmart68, []); return r && r.lost === 67; })());
test('حذف عمدی و سنگ‌قبردار (۶۷ رکورد با tombstone) عبور می‌کند',
  massDeletionReport('ptf_crm_rfqsmart', justOne, rfqsmart68,
    rfqsmart68.slice(1).map(function (r) { return { kind: 'rfqsmart', id: r.no, t: '2026-09-08' }; })) === null);
test('حذف تک‌رکوردی معمولی هرگز مسدود نمی‌شود',
  massDeletionReport('ptf_crm_rfqsmart', rfqsmart68.slice(1), rfqsmart68, []) === null);
test('حذف ۳ رکورد (زیر آستانه) مسدود نمی‌شود',
  massDeletionReport('ptf_crm_rfqsmart', rfqsmart68.slice(3), rfqsmart68, []) === null);
test('حذف ۲۰ رکورد از ۶۸ بدون سنگ‌قبر مسدود می‌شود (۲۹٪ > آستانهٔ ۲۵٪)',
  (function () { var r = massDeletionReport('ptf_crm_rfqsmart', rfqsmart68.slice(20), rfqsmart68, []); return r && r.lost === 20; })());
test('افزودن رکورد جدید هرگز مسدود نمی‌شود',
  massDeletionReport('ptf_crm_rfqsmart', rfqsmart68.concat([{ no: 'PTF-RFQS-1405-069' }]), rfqsmart68, []) === null);
test('پاک‌سازی گراف پروژه (archive_purge بدون collection) استثنا می‌ماند',
  massDeletionReport('ptf_crm_rfqsmart', justOne, rfqsmart68, [{ kind: 'archive_purge', aliases: ['FSY-2796-95-D88'] }]) === null);
test('مجموعهٔ کوچک (<۴ رکورد) درگیر سپر نمی‌شود',
  massDeletionReport('ptf_crm_rfqsmart', [], rfqsmart68.slice(0, 3), []) === null);

/* ===========================================================================
   ۳) سپرهای کلاینت روی crm/sync.js واقعی
   =========================================================================== */
var store = { ptf_crm_token: 'tok' };
var toasts = [], alerts = [];
var ctx = {
  console: console, JSON: JSON, Date: Date, Math: Math, Array: Array, Object: Object, String: String,
  Promise: Promise, TextEncoder: TextEncoder,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; }
  },
  document: { hidden: false, hasFocus: function () { return true; }, addEventListener: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, getElementById: function () { return null; } },
  navigator: { onLine: true }, location: { href: 'index.html' },
  setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {},
  curSession: function () { return { user: 'u1', name: 'u1' }; }, curRole: function () { return 'admin'; },
  ptfAuthToken: function () { return 'tok'; },
  ptfToast: function (m, k) { toasts.push(String(m)); }, alert: function (m) { alerts.push(String(m)); },
  audit: function () {}, addLog: function () {}, notify: function () {},
  fetch: function () { return Promise.reject(new Error('push must not reach the network in this test')); }
};
ctx.window = ctx;
vm.runInNewContext(syncSrc, ctx, { filename: 'crm/sync.js' });

test('GUARD_KEYS همهٔ مجموعه‌های همگام‌شونده را می‌پوشاند (نقطهٔ کور rfqsmart بسته شد)',
  syncSrc.indexOf('var GUARD_KEYS = SYNC_KEYS.slice();') > -1 && (ctx._ptfSyncKeys || []).indexOf('ptf_crm_rfqsmart') > -1);

/* مبنای سپر نباید از نمای ناقص (آینهٔ آب‌رسانی‌نشده) خراب شود */
store.ptf_guard_counts = JSON.stringify({ ptf_crm_rfqsmart: 68 });
ctx.ptfBMirrorActive = function () { return true; };
ctx.ptfBIdbHydrated = false;
ctx.ptfBRead = function () { return null; };          /* دقیقاً حالت حادثه */
test('آینهٔ آب‌رسانی‌نشده تشخیص داده می‌شود', ctx.ptfSyncMirrorUnhydrated() === true);
test('به‌روزرسانی مبنای سپر در نمای ناقص انجام نمی‌شود (۶۸ صفر نمی‌شود)',
  ctx.ptfUpdateGuardCounts() === false && JSON.parse(store.ptf_guard_counts).ptf_crm_rfqsmart === 68);

ctx.ptfBIdbHydrated = true;
ctx.ptfBRead = function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; };
store.ptf_crm_rfqsmart = JSON.stringify(rfqsmart68);
test('پس از آب‌رسانی، مبنای سپر درست ثبت می‌شود',
  ctx.ptfUpdateGuardCounts() === true && JSON.parse(store.ptf_guard_counts).ptf_crm_rfqsmart === 68);
delete store.ptf_crm_rfqsmart;
ctx.ptfBIdbHydrated = false;
ctx.ptfBRead = function () { return null; };
test('مبنای ۶۸ حتی با خواندن null دست‌نخورده می‌ماند',
  ctx.ptfUpdateGuardCounts() === false && JSON.parse(store.ptf_guard_counts).ptf_crm_rfqsmart === 68);

test('گیت bootstrap برای مسیر فاز B هم اعمال می‌شود (ریشهٔ ارسال نمای ناقص)',
  syncSrc.indexOf("if (!state.bootstrapped) {\n        try { if (typeof window.ptfBEnqueueKeys === 'function') window.ptfBEnqueueKeys(Object.keys(state.dirty)); } catch (eQ) {}") > -1 &&
  syncSrc.indexOf("done(false, { reason: 'awaiting-bootstrap' })") > -1);
test('سپر کلاینت افت شدید را فقط در نمای اثباتاً ناقص می‌بندد (حذف عمدی مسدود نمی‌شود)',
  syncSrc.indexOf('vanished > 3 && arr.length < prevCount / 2 && mirrorUnhydrated()') > -1);
test('پاسخ سپر سروری به کاربر گزارش می‌شود',
  syncSrc.indexOf('var blocked = d.massDeletionBlocked || {};') > -1 &&
  syncSrc.indexOf('🛡 سپر سروری حذف انبوه') > -1);
test('آشکارساز افت انبوه در نمای ناقص هشدار کاذب نمی‌دهد',
  syncSrc.indexOf('if (mirrorUnhydrated()) return; /* v34.38.12: نمای ناقص = هشدار کاذب */') > -1);
test('نسخهٔ انتشار هم‌تراز است', version === 'v34.38.12');

console.log('');
if (failures) { console.log('=== tester619: ' + failures + ' FAIL ==='); process.exit(1); }
console.log('PASS tester619-v34.38.12-mass-delete-shield');
