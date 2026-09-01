#!/usr/bin/env node
'use strict';
/* tester537 — v34.17.0 (SYNC-RBAC-PARITY + FORBIDDEN-DROP + ROUTER-CB)
   ریشهٔ نوار زرد پایدار «[personal_cheques]» در استیجینگ (RCA 2026-08-28):
   ۱) ماتریس RBAC سینک سرور (sync_allowed_keys_for_role در api/crm.php) برای
      sales/buyer/collector کلید ptf_crm_personal_cheques را نداشت درحالی‌که
      ماتریس کلاینت (SYNC_ROLE_KEYS) و رجیستری فرمانی هر دو طرف آن را مجاز
      می‌دانستند → push همیشه forbidden → بن‌بست ابدی dirty/نوار زرد.
      tester531 قدیمی «ماتریس کامل‌نقش‌ها» را فقط با انتهای آرایهٔ $accountant
      می‌سنجید (پاسِ گمراه‌کننده) — این تستر مجموعه‌های کامل را ست‌به‌ست
      مقایسه می‌کند و دیگر چنین شکافی از گیت رد نمی‌شود.
   ۲) مسیر فاز B کلید forbidden را در صف IDB/dirty ابدی نگه می‌داشت — قرارداد
      legacy (حذف + نشانگر 🟠) برای ptfBFlushQueue هم الزامی شد.
   ۳) روتر ptfEntitySaveCollection هرگز opts.cb را صدا نمی‌زد → پاک‌سازی
      legacy مهاجرت چک شخصی هرگز اجرا نمی‌شد. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function lst(s) { return (String(s).match(/'[^']+'/g) || []).map(function (x) { return x.slice(1, -1); }); }
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  var A = a.slice().sort(), B = b.slice().sort();
  for (var i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

var sync = read('crm/sync.js');
var php = read('api/crm.php');

/* ---------- ۱) تجزیهٔ ماتریس کلاینت ---------- */
var roleBlkStart = sync.indexOf('var SYNC_ROLE_KEYS = {');
var roleBlk = sync.slice(roleBlkStart, sync.indexOf('};', roleBlkStart));
T('بلوک SYNC_ROLE_KEYS پیدا شد', roleBlk.length > 200);
var client = {}, clientOk = true;
['sales', 'buyer', 'accountant', 'collector'].forEach(function (r) {
  var m = roleBlk.match(new RegExp(r + ':\\s*\\[([^\\]]*)\\]'));
  if (!m) { clientOk = false; client[r] = []; return; }
  client[r] = lst(m[1]);
});
T('هر ۴ نقش کلاینت تجزیه شد', clientOk);
var skStart = sync.indexOf('var SYNC_KEYS = [');
var clientAll = lst(sync.slice(skStart, sync.indexOf('];', skStart)));
var fullM = sync.match(/var SYNC_FULL_ROLES = \[([^\]]*)\]/);
var fullRoles = lst(fullM[1]);
T('SYNC_FULL_ROLES = admin/chairman/ceo/commercial', sameSet(fullRoles, ['admin', 'chairman', 'ceo', 'commercial']), fullRoles.join(','));

/* ---------- ۲) تجزیهٔ ماتریس سرور ---------- */
var allM = php.match(/function sync_all_keys\(\)\s*\{\s*return\s*\[([^\]]*)\]/);
T('sync_all_keys پیدا شد', !!allM);
var serverAll = lst(allM[1]);
function phpList(name) {
  var m = php.match(new RegExp('\\' + name + '\\s*=\\s*\\[([^\\]]*)\\]'));
  return m ? lst(m[1]) : null;
}
var sCrm = phpList('$crm'), sAcct = phpList('$accountant'), sColl = phpList('$collector');
T('لیست‌های $crm/$accountant/$collector پیدا شدند', !!(sCrm && sAcct && sColl));
var sBuyer = [];
sCrm.concat(['ptf_crm_buycmp', 'ptf_crm_supplier_finance', 'ptf_crm_payables']).forEach(function (k) { if (sBuyer.indexOf(k) < 0) sBuyer.push(k); }); /* array_unique مثل سرور */

/* ---------- ۳) ✅ گیت اصلی: برابری ست‌به‌ست کلاینت ↔ سرور ---------- */
function parity(role, cArr, sArr) {
  var ok = sameSet(cArr, sArr);
  var detail = '';
  if (!ok) {
    var onlyC = cArr.filter(function (k) { return sArr.indexOf(k) < 0; });
    var onlyS = sArr.filter(function (k) { return cArr.indexOf(k) < 0; });
    detail = 'کلاینت‌انحصاری=[' + onlyC.join(',') + '] سرورانحصاری=[' + onlyS.join(',') + ']';
  }
  T('برابری ماتریس سینک نقش ' + role + ' (کلاینت↔سرور)', ok, detail);
}
parity('admin-tier (SYNC_KEYS ↔ sync_all_keys)', clientAll, serverAll);
parity('sales', client.sales, sCrm);
parity('buyer', client.buyer, sBuyer);
parity('accountant', client.accountant, sAcct);
parity('collector', client.collector, sColl);

/* رگرسیون مشخص RCA: personal_cheques باید در هر سه لیست سروری باشد */
T('رگرسیون RCA: personal_cheques در $crm سرور', sCrm.indexOf('ptf_crm_personal_cheques') > -1);
T('رگرسیون RCA: personal_cheques در $collector سرور', sColl.indexOf('ptf_crm_personal_cheques') > -1);
T('رگرسیون RCA: personal_cheques در $accountant سرور', sAcct.indexOf('ptf_crm_personal_cheques') > -1);

/* ---------- ۴) قرارداد FORBIDDEN-DROP ---------- */
T('sync.js: API پاک‌سازی forbidden تعریف شد', /window\.ptfSyncDropForbiddenKeys = function/.test(sync));
T('sync.js: حذف dirty + saveDirty در FORBIDDEN-DROP', /ptfSyncDropForbiddenKeys[\s\S]{0,900}delete state\.dirty\[k\][\s\S]{0,300}saveDirty\(\)/.test(sync));
var cs = read('crm/client-server.js');
T('client-server.js: forbidden از صف IDB حذف می‌شود', /FORBIDDEN-DROP[\s\S]{0,800}queueClear\(forbiddenKeys\)/.test(cs));
T('client-server.js: forbidden به ptfSyncDropForbiddenKeys سپرده می‌شود', /queueClear\(forbiddenKeys\)[\s\S]{0,200}ptfSyncDropForbiddenKeys\(forbiddenKeys\)/.test(cs));
var pendLine = cs.match(/var pending = failed\.concat\(([^)]*)\)/);
T('client-server.js: pending دیگر result.forbidden را دوباره dirty نمی‌کند', !!pendLine && pendLine[1].indexOf('forbidden') === -1, pendLine && pendLine[1]);

/* ---------- ۵) قرارداد ROUTER-CB ---------- */
var sd = read('crm/sales-domain-v2.js');
T('sales-domain-v2.js: جمع‌بندی cb در روتر مجموعه‌ای', /ROUTER-CB[\s\S]{0,600}settleCb\(/.test(sd));
T('sales-domain-v2.js: opts.cb با state acked صدا زده می‌شود', /cbAcked === cbTotal \? \{ state: 'acked'/.test(sd));
T('sales-domain-v2.js: مسیر صفر-عملیات هم cb acked می‌دهد', /!cbTotal && typeof opts\.cb === 'function'/.test(sd));

/* ---------- ۶) رفتاری: FORBIDDEN-DROP با vm ---------- */
(function behaviorDrop() {
  var a = sync.indexOf('window.ptfSyncDropForbiddenKeys = function');
  var b = sync.indexOf('window.ptfSyncWriteFailures', a);
  var fnSrc = sync.slice(a, b);
  T('استخراج تابع FORBIDDEN-DROP', fnSrc.indexOf('function') > -1 && fnSrc.length > 400);
  var state = { dirty: { 'ptf_crm_personal_cheques': true, 'ptf_crm_notifs': true }, writeFailures: { 'ptf_crm_personal_cheques': 'x' } };
  var calls = { saveDirty: 0, note: null, badge: null, audit: 0 };
  var sb = {
    window: {},
    state: state,
    saveDirty: function () { calls.saveDirty++; },
    clearWriteFailure: function (k) { delete state.writeFailures[k]; },
    noteSyncError: function (scope, status, reason, detail) { calls.note = { scope: scope, status: status, reason: reason, detail: detail }; },
    audit: function () { calls.audit++; },
    setSyncBadge: function (s) { calls.badge = s; },
    Object: Object, Array: Array, JSON: JSON
  };
  vm.createContext(sb);
  try { vm.runInContext(fnSrc + '\nwindow.ptfSyncDropForbiddenKeys(["ptf_crm_personal_cheques"]);', sb); } catch (e) { T('اجرای FORBIDDEN-DROP', false, String(e)); return; }
  T('رفتاری: dirty کلید ممنوع پاک شد', state.dirty['ptf_crm_personal_cheques'] === undefined);
  T('رفتاری: dirty کلید سالم دست‌نخورده', state.dirty['ptf_crm_notifs'] === true);
  T('رفتاری: writeFailure کلید ممنوع پاک شد', state.writeFailures['ptf_crm_personal_cheques'] === undefined);
  T('رفتاری: saveDirty دقیقاً یک‌بار', calls.saveDirty === 1);
  T('رفتاری: خطا با reason forbidden-keys-dropped ثبت شد', !!calls.note && calls.note.reason === 'forbidden-keys-dropped');
  T('رفتاری: نشانگر forbidden (چون dirty غیرِ ممنوع باقی است → warn)', calls.badge === 'warn', calls.badge);
  T('رفتاری: audit ثبت شد', calls.audit === 1);
})();

/* ---------- ۷) رفتاری: ROUTER-CB با vm ---------- */
(function behaviorRouter() {
  var a = sd.indexOf('window.ptfEntitySaveCollection = function');
  var b = sd.indexOf('window.ptfSalesCommandErrorIsAmbiguous', a);
  var fnSrc = sd.slice(a, b);
  T('استخراج روتر ptfEntitySaveCollection', fnSrc.length > 2000);
  function runScenario(name, stubUpsState, expectState, expectCalls) {
    var cbCalls = [], dirtyMarks = 0, upserts = [];
    var sb = {
      window: {
        PTF_ENTITY_CMD_ENABLED: { 'ptf_crm_personal_cheques': true },
        _ptfEntityLastKnown: {},
        ptfEntityUpsert: function (col, rec, o) { upserts.push(rec.cd); setTimeout(function () { o.cb({ state: stubUpsState, error: stubUpsState === 'acked' ? undefined : { status: 403 } }); }, 0); return {}; },
        ptfEntityDelete: function (col, id, o) { setTimeout(function () { o.cb({ state: 'acked' }); }, 0); return {}; },
        ptfSilentWrite: function () {},
        ptfEntityCommandMessage: function () { return ''; },
        ptfSyncNotifyDirty: function () { dirtyMarks++; }
      },
      getData: function () { return [{ cd: 'A', v: 1 }]; },
      setData: function () {},
      ptfToast: function () {},
      JSON: JSON, Array: Array, Object: Object, setTimeout: setTimeout, String: String, Error: Error
    };
    vm.createContext(sb);
    sb.__test = { cbCalls: cbCalls };
    try {
      vm.runInContext(fnSrc + '\nwindow.ptfEntitySaveCollection("ptf_crm_personal_cheques", [{cd:"A",v:2}], { cb: function (st) { __test.cbCalls.push(st); } });', sb);
    } catch (e) { T(name, false, String(e)); return; }
    setTimeout(function () {
      T(name + ' — دقیقاً یک cb', cbCalls.length === expectCalls, JSON.stringify(cbCalls));
      T(name + ' — state=' + expectState, cbCalls.length && cbCalls[0].state === expectState, JSON.stringify(cbCalls[0] || {}));
      if (stubUpsState !== 'acked') T(name + ' — failDirty صدا زده شد', dirtyMarks >= 1);
    }, 30);
  }
  runScenario('رفتاری روتر/همه-ACK', 'acked', 'acked', 1);
  runScenario('رفتاری روتر/فرمان-ردشده', 'rejected', 'rejected', 1);
})();
/* نتیجهٔ سناریوهای async در تیک بعدی چک می‌شوند؛ خروجی نهایی پس از آنها */
setTimeout(function () {
  console.log(p + ' PASS / ' + f + ' FAIL');
  process.exit(f ? 1 : 0);
}, 120);
