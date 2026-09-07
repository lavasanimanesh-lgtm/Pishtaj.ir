#!/usr/bin/env node
'use strict';
/* ═══ tester595 — v34.38.0 (TOMBSTONE-SCOPE + CODE-RETIRED) ═══
   گزارش کارفرما: «در CRM مشتریانی که جدیداً اضافه می‌شوند پاک می‌شوند.»

   زنجیرهٔ ریشه‌ای که این تستر می‌بندد (هر چهار حلقه):
   C1 entity_delete یک سنگ‌قبر archive_purge دائمی می‌سازد که فقط با cd کار می‌کند.
   C2 sync_apply_tombstones هم در data_push و هم در data_pull اعمال می‌شود.
   C3 مولد کد کلاینت (legacyMaxNext) کد بعدی را از «بیشینهٔ رکوردهای زندهٔ +۱» می‌ساخت،
      پس بعد از حذفِ آخرین مشتری همان cd دوباره صادر می‌شد.
   C4 تطبیق aliases با strpos روی کل JSON بود، پس رکوردهای بی‌ربط هم پاک می‌شدند.

   این تستر «رفتاری» است: برشِ واقعیِ توابع از crm/sync.js و crm/codegen.js را در vm
   اجرا می‌کند — نه اینکه فقط وجود یک رشته در فایل را چک کند. (درست همان چیزی که
   نبودش باعث شد tester594 سبز بماند در حالی که باگ زنده بود.) قرارداد سرور با
   الگوی متنی روی api/crm.php پین می‌شود چون php در محیط گیت در دسترس نیست. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var syncSrc = read('crm/sync.js');
var codegenSrc = read('crm/codegen.js');
var apiSrc = read('api/crm.php');
var sdSrc = read('api/sales-domain.php');

/* ───────────────────────── ۱) هارنس سنگ‌قبر (کلاینت) ───────────────────────── */
/* نشانگر برش نسخه‌آگنوستیک است: bump-version-pins شمارهٔ نسخه را در تسترها عوض
   می‌کند ولی کامنتِ منشأ در سورس عمداً روی نسخهٔ اصلیِ اصلاح می‌ماند. */
var t0 = syncSrc.indexOf('function ptfTombstoneEpoch(');
var t1 = syncSrc.indexOf('function ptfValScore(');
T('۱.۰ برش توابع سنگ‌قبر از crm/sync.js پیدا شد', t0 > -1 && t1 > t0);
var tombSlice = syncSrc.slice(t0, t1);

function bootTombstones(archive) {
  var ctx = {
    console: console, JSON: JSON, Date: Date, String: String, Array: Array, Object: Object, Number: Number,
    window: {},
    ptfReadArchive: function () { return archive; },
    ptfArchiveKindsForKey: function (k) {
      return ({ ptf_crm_customers: ['customer', 'customers', 'cust'] })[k] || [];
    },
    ptfRecordIdentityForKey: function (k, r) {
      return String((r && (r._id || r.cd || r.no || r.id || r.code)) || '').trim();
    },
    ptfReadDeletedArchiveStr: function () { return '[]'; }
  };
  ctx.window.ptfReadArchive = ctx.ptfReadArchive;
  vm.createContext(ctx);
  vm.runInContext(tombSlice, ctx, { filename: 'tombstone-slice.js' });
  return ctx.window.ptfApplyDeletionTombstones;
}

var DAY = 86400000;
var T_DEL = new Date(Date.now() - 3 * DAY).toISOString();   /* لحظهٔ حذف */
var T_OLD = new Date(Date.now() - 9 * DAY).toISOString();   /* قبل از حذف */
var T_NEW = new Date(Date.now() - 1 * DAY).toISOString();   /* بعد از حذف */

/* سنگ‌قبر تک‌رکوردی — دقیقاً همان چیزی که entity_delete می‌سازد */
function singleTomb(id, at) {
  return {
    _id: 'DEL-1', kind: 'archive_purge', collection: 'ptf_crm_customers',
    id: id, cd: id, aliases: [id], identities: { ptf_crm_customers: [id] },
    reason: 'اشتباه ثبت شد', deletedBy: 'admin', deletedAt: at
  };
}

/* ── سناریوی اصلی گزارش کارفرما: حذف آخرین مشتری، سپس ثبت مشتری جدید ── */
(function () {
  var apply = bootTombstones([singleTomb('CUST-1003', T_DEL)]);
  var fresh = JSON.stringify([{ cd: 'CUST-1003', co: 'شرکت کاملاً جدید', createdAtISO: T_NEW }]);
  var out = JSON.parse(apply('ptf_crm_customers', fresh, null));
  T('۱.۱ مشتریِ تازه با کدِ بازیافت‌شده دیگر پاک نمی‌شود (باگ اصلی گزارش کارفرما)',
    out.length === 1 && out[0].co === 'شرکت کاملاً جدید', JSON.stringify(out));

  var stale = JSON.stringify([{ cd: 'CUST-1003', co: 'رکورد قدیمیِ واقعاً حذف‌شده', createdAtISO: T_OLD }]);
  T('۱.۲ رکورد واقعاً حذف‌شده همچنان پاک می‌شود (حذف باید حذف بماند)',
    JSON.parse(apply('ptf_crm_customers', stale, null)).length === 0);
})();

/* ── سازگاری عقب‌رو: سنگ‌قبر یا رکوردِ بدون تاریخ ⇒ رفتار دقیقاً مثل قبل ── */
(function () {
  var applyNoDate = bootTombstones([{ kind: 'customer', cd: 'CUST-1003' }]); /* سنگ‌قبر legacy بدون تاریخ */
  var rows = JSON.stringify([{ cd: 'CUST-1003', co: 'هرچه', createdAtISO: T_NEW }]);
  T('۱.۳ سنگ‌قبر legacy بدون تاریخ ⇒ رفتار قبلی (fail-closed به سمت حذف)',
    JSON.parse(applyNoDate('ptf_crm_customers', rows, null)).length === 0);

  var apply = bootTombstones([singleTomb('CUST-1003', T_DEL)]);
  var noStamp = JSON.stringify([{ cd: 'CUST-1003', co: 'رکورد بدون مهر ساخت' }]);
  T('۱.۴ رکورد بدون createdAtISO ⇒ رفتار قبلی (fail-closed به سمت حذف)',
    JSON.parse(apply('ptf_crm_customers', noStamp, null)).length === 0);
})();

/* ── C4: سنگ‌قبر تک‌رکوردی نباید رکورد بی‌ربط را با تطبیق زیررشته‌ای بکشد ── */
(function () {
  var apply = bootTombstones([singleTomb('CUST-1003', T_DEL)]);
  var other = JSON.stringify([
    { cd: 'CUST-1200', co: 'مشتری بی‌ربط', ds: 'جایگزین پروندهٔ CUST-1003', createdAtISO: T_OLD }
  ]);
  var out = JSON.parse(apply('ptf_crm_customers', other, null));
  T('۱.۵ رکورد بی‌ربطی که فقط کدِ حذف‌شده را در متنش دارد پاک نمی‌شود',
    out.length === 1 && out[0].cd === 'CUST-1200', JSON.stringify(out));
})();

/* ── حفظ رفتار «پاک‌سازی گراف کل پروژه» (سنگ‌قبر بدون collection) ── */
(function () {
  var projectTomb = {
    id: 'PRJ-77', kind: 'archive_purge', purged: true, mode: 'full_graph',
    identities: { ptf_crm_customers: [] }, aliases: ['PRJ-77'], iso: T_DEL, t: T_DEL
  };
  var apply = bootTombstones([projectTomb]);
  var rows = JSON.stringify([{ cd: 'CUST-9', co: 'وابسته', projectNo: 'PRJ-77', createdAtISO: T_OLD }]);
  T('۱.۶ پاک‌سازی گراف پروژه (بدون collection) هنوز رکورد وابسته را می‌گیرد — بدون رگرسیون',
    JSON.parse(apply('ptf_crm_customers', rows, null)).length === 0);
})();

/* ───────────────────── ۲) مولد کد: کد بازنشسته دوباره صادر نشود ───────────────────── */
(function () {
  var c0 = codegenSrc.indexOf('function retiredCodesForKey(');
  var c1 = codegenSrc.indexOf('// === THE UNIFIED CODING FUNCTION ===');
  T('۲.۰ برش legacyMaxNext + retiredCodesForKey پیدا شد', c0 > -1 && c1 > c0);
  var slice = codegenSrc.slice(c0, c1);
  /* extractNumLegacy/formatCodeClient پایین‌تر تعریف شده‌اند — استاب حداقلی و وفادار */
  var stubs = '\nfunction extractNumLegacy(code, pref){var m=String(code||"").match(new RegExp("^"+pref+"-(\\\\d+)$","i"));return m?parseInt(m[1],10):0;}\n' +
    'function formatCodeClient(prefix,n){return prefix+"-"+n;}\nfunction faYear(){return 1405;}\nfunction getPool(){return {};}\n';

  function nextCust(live, archive) {
    var ctx = {
      console: console, JSON: JSON, String: String, Number: Number, Date: Date, Array: Array, Object: Object,
      window: {}, parseInt: parseInt, RegExp: RegExp,
      isLocalOnlyPrefix: function () { return false; },
      getData: function (k) { return k === 'ptf_crm_customers' ? live : (k === 'ptf_crm_deleted_archive' ? archive : []); }
    };
    vm.createContext(ctx);
    vm.runInContext(stubs + slice, ctx, { filename: 'codegen-slice.js' });
    return ctx.legacyMaxNext('CUST', 1405);
  }

  var live = [{ cd: 'CUST-1001' }, { cd: 'CUST-1002' }];
  var archive = [singleTomb('CUST-1003', T_DEL)];
  var got = nextCust(live, archive);
  T('۲.۱ کد بعدی از کدِ حذف‌شده عبور می‌کند (CUST-1003 بازنشسته است)',
    got === 'CUST-1004', String(got));
  T('۲.۲ بدون سنگ‌قبر، شمارنده رفتار قبلی را دارد (بدون رگرسیون)',
    nextCust(live, []) === 'CUST-1003', String(nextCust(live, [])));
  T('۲.۳ چند حذف پشت سر هم هم شمارنده را عقب نمی‌برد',
    nextCust(live, [singleTomb('CUST-1003', T_DEL), singleTomb('CUST-1004', T_DEL)]) === 'CUST-1005');
})();

/* ───────────────────── ۳) قرارداد سرور (پین متنی — php در گیت نیست) ───────────────────── */
T('۳.۱ sync_tombstone_epoch/ sync_row_created_epoch در api/crm.php تعریف شده‌اند',
  apiSrc.indexOf('function sync_tombstone_epoch(') > -1 && apiSrc.indexOf('function sync_row_created_epoch(') > -1);
T('۳.۲ گاردِ «سنگ‌قبر حق حذف رکوردِ تازه‌تر را ندارد» وجود دارد',
  /function sync_tombstone_outranks_row\([\s\S]{0,400}return \$rowEpoch <= \$tombEpoch;/.test(apiSrc));
T('۳.۳ گارد در هر دو مسیر id و alias اعمال می‌شود',
  (apiSrc.match(/sync_tombstone_outranks_row\(/g) || []).length >= 3);
T('۳.۴ alias فقط برای سنگ‌قبر بدونِ collection (پاک‌سازی گراف پروژه) جمع می‌شود',
  /trim\(\(string\)\(\$d\['collection'\] \?\? ''\)\) === ''[\s\S]{0,300}sync_tombstone_mark\(\$purgeAliases/.test(apiSrc));
T('۳.۵ سنگ‌قبر entity_delete همچنان collection را می‌نویسد (پس تک‌رکوردی شناخته می‌شود)',
  /'kind' => 'archive_purge', 'collection' => \$collection/.test(sdSrc));
T('۳.۶ سنگ‌قبر entity_delete تاریخ deletedAt دارد (ورودی گاردِ تاریخ)',
  /'deletedAt' => sd_now\(\)/.test(sdSrc));
T('۳.۷ tombstone هنوز در هر دو مسیر push و pull اعمال می‌شود (بدون رگرسیون)',
  (apiSrc.match(/sync_apply_tombstones\(/g) || []).length >= 4);

/* ───────────────────── ۴) مهر ساخت ماشین‌خوان روی رکوردهای تازه ───────────────────── */
(function () {
  var dedupSrc = read('crm/dedup.js');
  T('۴.۱ dedupStamp مهر createdAtISO می‌زند (ورودی گاردِ تاریخ)',
    dedupSrc.indexOf('rec.createdAtISO = new Date().toISOString()') > -1);
  T('۴.۲ مهر موجود بازنویسی نمی‌شود (رکورد بازیافتی مهر اصلی خود را نگه می‌دارد)',
    dedupSrc.indexOf('if (!rec.createdAtISO)') > -1);
  T('۴.۳ سنگ‌قبر ادغام مشتری هم ISO دارد', read('crm/custmerge.js').indexOf("iso: new Date().toISOString()") > -1);
})();

/* ───────────────────── ۵) سپر حذف انبوه + بازتولید کد پس از ۴۰۹ ───────────────────── */
(function () {
  var sd = read('crm/sales-domain-v2.js');
  var a = sd.indexOf('window.ptfEntitySaveCollection = function');
  var b = sd.indexOf('window.ptfSalesCommandErrorIsAmbiguous', a);
  T('۵.۰ برش روتر پیدا شد', a > -1 && b > a);
  var routerSrc = sd.slice(a, b);
  T('۵.۱ ثابت‌های سپر داخل خود تابع‌اند (برش تستی مستقل اجرا می‌شود)',
    routerSrc.indexOf('DELETE_BURST_GUARDED') > -1 && routerSrc.indexOf('var DELETE_BURST_MAX') > -1);

  function bootRouter() {
    var calls = { ups: [], dels: [], legacy: [] };
    var ctx = {
      console: { warn: function () {}, error: function () {} }, JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
      window: {
        PTF_ENTITY_CMD_ENABLED: { ptf_crm_customers: true },
        ptfEntityUpsert: function (c, r, o) { calls.ups.push(r.cd); if (o && o.cb) o.cb({ state: 'acked' }); },
        ptfEntityDelete: function (c, id, o) { calls.dels.push(id); if (o && o.cb) o.cb({ state: 'acked' }); },
        ptfSilentWrite: function () {},
        ptfSyncAcknowledgeKeys: function () {}
      },
      setData: function (k, v) { calls.legacy.push({ k: k, n: v.length }); },
      getData: function () { return []; },
      audit: function () {}, ptfToast: function () {}
    };
    vm.createContext(ctx);
    vm.runInContext(routerSrc, ctx, { filename: 'router-slice.js' });
    return { save: ctx.window.ptfEntitySaveCollection, calls: calls };
  }

  var mk = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ cd: 'CUST-' + (1000 + i) }); return a; };

  var h1 = bootRouter();
  var base10 = mk(10);
  var r1 = h1.save('ptf_crm_customers', base10.slice(0, 3), { prevArr: base10 });
  T('۵.۲ حذف انبوه (۷ رکورد) مسدود و به مسیر امن legacy تنزل می‌یابد',
    r1 && r1.mode === 'legacy' && /delete-burst-blocked/.test(r1.reason) && h1.calls.dels.length === 0,
    JSON.stringify(r1) + ' dels=' + h1.calls.dels.length);

  var h2 = bootRouter();
  var r2 = h2.save('ptf_crm_customers', [], { prevArr: base10 });
  T('۵.۳ «فهرست تهی شد» هرگز به حذف سروری تبدیل نمی‌شود',
    r2 && r2.mode === 'legacy' && h2.calls.dels.length === 0, JSON.stringify(r2));

  var h3 = bootRouter();
  var base3 = mk(3);
  var r3 = h3.save('ptf_crm_customers', base3.slice(0, 2), { prevArr: base3 });
  T('۵.۴ حذف تک‌رکوردیِ واقعیِ کاربر همچنان کار می‌کند (بدون رگرسیون)',
    r3 && r3.mode === 'commands' && h3.calls.dels.length === 1 && h3.calls.dels[0] === 'CUST-1002',
    JSON.stringify(r3) + ' ' + JSON.stringify(h3.calls.dels));

  var h4 = bootRouter();
  var r4 = h4.save('ptf_crm_audit', [], { prevArr: mk(10) });
  T('۵.۵ ژورنال‌ها (audit/notifs) مشمول سپر نیستند — هرس عادی نمی‌شکند',
    r4 && r4.mode === 'legacy' && r4.reason === 'cmd-off', JSON.stringify(r4));

  T('۵.۶ پاسخ 409 entity_id_exists با کد نو یک نوبت دوباره ارسال می‌شود',
    routerSrc.indexOf('function retryWithFreshCode(') > -1 &&
    /entity_id_exists/.test(routerSrc) && routerSrc.indexOf('expectCreate: true') > -1);
  T('۵.۷ کد نو نه زنده است نه بازنشسته (ptfCodeIsRetired مصرف می‌شود)',
    routerSrc.indexOf('window.ptfCodeIsRetired(c, collection)') > -1);
  T('۵.۸ حفاظت ضد حلقه بدون آلوده کردن خود رکورد',
    routerSrc.indexOf('window._ptfCodeRetryTried') > -1);
})();

console.log('\n— tester595 (v34.38.0: سنگ‌قبرِ دامنه‌دار + کد بازنشسته + سپر حذف انبوه) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
if (f) process.exit(1);
