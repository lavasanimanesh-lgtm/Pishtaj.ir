#!/usr/bin/env node
'use strict';
/* tester543 — v34.38.0 (R4-گام۱ — RETIRE-LEGACY-SYNC): پرچم PTF_LEGACY_PUSH_OFF
   قرارداد: تصمیم بازنشستگی موتور legacy سینک از تله‌متری پنجره‌ای گرفته می‌شود.
   (۱) سرور: تله‌متری push سطل روزانه می‌گیرد (هرس ۱۴ روز) و sync_stats پنجرهٔ ۷روزه
   (win7) را برمی‌گرداند؛ (۲) اکشن‌های sync_engine_flags (خواندن) و sync_engine_flag_set
   (نوشتن، ادمین/رئیس) با گیت شواهد: قطعِ push توده‌ای فقط با win7 ≤ 3 یا force+دلیل؛
   (۳) کلاینت: پرچم‌ها read-through از ptfCache (TTL ۱س) خوانده می‌شوند؛ pushDirty با
   گیت fail-open — کلید پرچم‌شده روی دستگاه فاز B از push توده‌ای حذف (gated)، روی
   دستگاه همگرانشده عبور می‌کند (bypass) و با R4-GATE-BYPASS در audit ثبت می‌شود؛
   (۴) داشبورد تصمیم در تنظیمات (engineGateBox). پیش‌فرض = رفتار امروز (صفر پرچم).
   پوشش: قرارداد منبع (api/crm.php + sync.js + index.html) + رفتاری (vm: بارگذاری
   پرچم، تصمیم گیت، push fail-open واقعی، مسیر gated، once-بودن audit bypass). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var api = read('api/crm.php');
var sy = read('crm/sync.js');
var idx = read('crm/index.html');

/* ═══ ۱) سرور: تله‌متری پنجره‌ای ═══ */
T('data_push: سطل روزانه به تله‌متری push اضافه شد', /\$_d\[\$_today\] = \(int\)\(\$_d\[\$_today\] \?\? 0\) \+ 1;/.test(api) && /\$row\['d'\] = \$_d;/.test(api));
T('data_push: سطل‌ها به ۱۴ روز آخر هرس می‌شوند', /strtotime\('-13 days'\)/.test(api) && /if \(\$_dk < \$_cut\) unset\(\$_d\[\$_dk\]\);/.test(api));
T('sync_stats: win7 + پوشش روزها per-key برمی‌گردد', /'win7' => \$win7,/.test(api) && /'win7Days' => \$win7Days,/.test(api) && /\$win7From = date\('Y-m-d', strtotime\('-6 days'\)\);/.test(api));
T('sync_stats: ردیف بدون سطل روزانه → win7=null (شواهد ناکافی)', /\$win7 = null; \$win7Days = 0;/.test(api) && /if \(is_array\(\$row\['d'\] \?\? null\)\) \{\s*\$win7 = 0;/.test(api));
T('sync_stats: مبدأ پنجره در پاسخ است', /'win7From' => \$win7From/.test(api));

/* ═══ ۲) سرور: اکشن‌های پرچم ═══ */
T('اکشن sync_engine_flags فقط‌خواندنی تعریف شد', /case 'sync_engine_flags':/.test(api));
T('sync_engine_flags گارد نقش دارد (users_write)', /case 'sync_engine_flags':[\s\S]{0,500}role_guard\('users_write'\)/.test(api));
T('sync_engine_flags از sync/engine_flags.json می‌خواند', /engine_flags\.json/.test(api));
T('اکشن sync_engine_flag_set تعریف شد', /case 'sync_engine_flag_set':/.test(api));
T('sync_engine_flag_set گارد نقش دارد', /case 'sync_engine_flag_set':[\s\S]{0,600}role_guard\('users_write'\)/.test(api));
T('کلید باید در دامنهٔ sync_all_keys باشد', /!in_array\(\$fkey, sync_all_keys\(\), true\)/.test(api));
T('گیت شواهد: قطع بدون force فقط با win7 ≤ 3', /\$off && !\$force && \(\$win7now === null \|\| \$win7now > 3\)/.test(api));
T('force نیازمند دلیل ≥ ۵ نویسه', /\$off && \$force && mb_strlen\(\$reason\) < 5/.test(api));
T('ثبت پرچم با کاربر/زمان/دلیل/win7 لحظهٔ تصمیم', /'win7AtSet' => \$win7now/.test(api) && /'by' => \$by, 'reason' => \$reason/.test(api));
T('بازگشت‌پذیری: off=0 پرچم را حذف می‌کند', /else unset\(\$payloadEng\['legacyPushOff'\]\[\$fkey\]\);/.test(api));
T('نوشتن اتمیک (tmp + rename)', /\$tmpEng = \$flagsFileEng \. '\.tmp\.' \. bin2hex\(random_bytes\(4\)\);/.test(api) && /@rename\(\$tmpEng, \$flagsFileEng\);/.test(api));

/* ═══ ۳) کلاینت: بارگذاری پرچم‌ها ═══ */
T('ptfEngineFlagsLoad تعریف شد (read-through از ptfCache TTL 1h)', /window\.ptfEngineFlagsLoad = function \(force, cb\)/.test(sy) && /ptfCacheRead\('ptf_engine_flags'/.test(sy) && /ptfCacheWrite\('ptf_engine_flags', JSON\.stringify\(\{ legacyPushOff: engineFlags\.off \}\), 3600\)/.test(sy));
T('کش تازه → درخواست سرور زده نمی‌شود', /else fromServer\(\);[\s\S]{0,200}?\}\);[\s\S]{0,100}?\} else fromServer\(\);/.test(sy.replace(/\n/g, ' ')) || /if \(v\) \{[\s\S]{0,300}?\}[\s\S]{0,80}?else fromServer\(\);/.test(sy));
T('بارگذاری در بوت غیرمسدودکننده است', /try \{ window\.ptfEngineFlagsLoad\(false\); \} catch \(eEf\) \{\}/.test(sy));
T('ptfLegacyPushOff برای مصرف‌کنندگان آینده صادر شد', /window\.ptfLegacyPushOff = function \(k\)/.test(sy));

/* ═══ ۴) کلاینت: گیت fail-open در pushDirty ═══ */
T('تصمیم گیت خالص و تست‌پذیر صادر شد', /window\.ptfLegacyPushGateDecision = function \(keys\)/.test(sy));
T('قاعدهٔ تصمیم: فاز B فعال → gated؛ وگرنه bypass', /if \(out\.phaseB\) out\.gated\.push\(k\);[\s\S]{0,60}?else out\.bypass\.push\(k\);/.test(sy.replace(/\n/g, ' ')) || /if \(out\.phaseB\) out\.gated\.push\(k\);/.test(sy));
T('pushDirty از تصمیم گیت استفاده می‌کند', /var gate = window\.ptfLegacyPushGateDecision\(keys\);/.test(sy));
T('کلید gated از push توده‌ای حذف می‌شود (نه از dirty)', /keys = keys\.filter\(function \(k\) \{ return gate\.gated\.indexOf\(k\) < 0; \}\);/.test(sy));
T('bypass = عبور fail-open + تله‌متری audit', /gate\.bypass\.forEach\(function \(k\) \{ gateBypassAuditOnce\(k\); \}\);/.test(sy) && /R4-GATE-BYPASS/.test(sy));
T('تله‌متری bypass فقط یک‌بار به‌ازای هر نشست (بدون کلید LS جدید)', /var gateBypassAudited = \{\};/.test(sy) && /if \(gateBypassAudited\[k\]\) return;/.test(sy));
T('gated نیز در audit ثبت می‌شود (R4-GATE)', /بنا بر پرچم سرور رد شد \(فاز B فعال است\)/.test(sy));

/* ═══ ۵) داشبورد ═══ */
T('داشبورد تصمیم در sync.js رندر می‌شود', /window\.ptfRenderEngineGateDashboard = function \(hostId\)/.test(sy));
T('داشبورد sync_stats را می‌گیرد و win7 می‌کشد', /action=sync_stats/.test(sy) && /r\.win7 !== null && r\.win7 !== undefined && r\.win7 <= 3/.test(sy));
T('دکمه‌ها فقط برای نقش ارشد', /senior = typeof isSenior === 'function' && !!isSenior\(\)/.test(sy));
T('تغییر پرچم با دلیل → sync_engine_flag_set + audit', /action=sync_engine_flag_set/.test(sy) && /window\.prompt\('دلیل /.test(sy));
T('index.html: سکشن موتور همگام‌سازی + مونت داشبورد', /data-settings-title="موتور همگام‌سازی \(R4\)"/.test(idx) && /id="engineGateBox"/.test(idx));
T('index.html: داشبورد بعد از buildSettings رندر می‌شود', /ptfRenderEngineGateDashboard\('engineGateBox'\)/.test(idx));
T('sync.js در sw.js precache است (بدون فایل جدید)', /'\.\/sync\.js' \+ ASSET_QUERY/.test(read('crm/sw.js')));

/* ═══ ۶) رفتاری: vm ═══ */
var FLAGGED = 'ptf_crm_petty', CLEAN = 'ptf_crm_rfqs';
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function makeCtx() {
  var intervalFns = [];
  var store = { ptf_crm_token: 'tok', ptf_crm_petty: JSON.stringify([{ cd: 'PTY-1' }]), ptf_crm_rfqs: JSON.stringify([{ cd: 'RFQ-1' }]) };
  var audits = [];
  var pushes = [];
  var flagsPayload = { ok: true, legacyPushOff: (function () { var o = {}; o[FLAGGED] = { at: '2026-08-29 08:00:00', by: 'admin', reason: 'win7=0', win7AtSet: 0 }; return o; })() };
  var ctx = {
    console: console,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; },
      key: function () { return null; }
    },
    curSession: function () { return { user: 'adm', name: 'مدیر' }; },
    curRole: function () { return 'admin'; },
    ptfAuthToken: function () { return 'tok'; }, ptfAuthOk: function () { return true; }, /* v34.38.0 (R5/T4-1b): لایهٔ نشست جدید */
    getData: function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    navigator: {}, location: { href: '' },
    document: {
      hidden: false, hasFocus: function () { return true; },
      querySelector: function () { return null; },
      getElementById: function (id) { return id === 'crmL' ? { style: { display: 'block' } } : null; },
      addEventListener: function () {}, body: { appendChild: function () {} },
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      documentElement: { style: { setProperty: function () {} } }
    },
    addEventListener: function () {},
    intervalFns: intervalFns, setInterval: function (fn) { intervalFns.push(fn); return intervalFns.length; }, clearInterval: function () {},
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    fetch: function (url, opts) {
      if (url.indexOf('action=sync_engine_flags') > -1) return Promise.resolve({ json: function () { return Promise.resolve(flagsPayload); } });
      if (url.indexOf('action=data_pull') > -1) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, fresh: true, rev: 5, meta: {} }); } });
      if (url.indexOf('action=data_push') > -1) {
        pushes.push(String(opts && opts.body));
        var ackKeys = [];
        try { ackKeys = Object.keys((JSON.parse(String(opts && opts.body || '{}') || '{}').data) || {}); } catch (eAk) {}
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, saved: ackKeys.length, savedKeys: ackKeys, rev: 6, conflicts: [], krevs: {} }); } });
      }
      if (url.indexOf('action=data_rev') > -1) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rev: 5 }); } });
      throw new Error('unexpected fetch ' + url);
    },
    ptfToast: function () {}, addLog: function () {},
    audit: function (who, what, cat) { audits.push(String(what) + '|' + String(cat || '')); },
    ptfUpdateGuardCounts: function () {}, updateInboxBadge: function () {},
    ptfCacheRead: null, ptfCacheWrite: null /* بدون لایهٔ کش → مسیر سرور */
  };
  Object.defineProperty(ctx.localStorage, 'length', { get: function () { return Object.keys(store).length; } });
  ctx.window = ctx;
  return { ctx: ctx, audits: audits, pushes: pushes, store: store, intervalFns: intervalFns };
}

(async function () {
  function bootSync(env) { /* بوت: interval اول → boot() → initialSync(fresh) + بارگذاری پرچم‌ها */
    env.intervalFns[0]();
  }
  async function scenario(name, fn) {
    var env = makeCtx();
    vm.createContext(env.ctx);
    vm.runInContext(sy, env.ctx, { filename: 'crm/sync.js' });
    bootSync(env);
    await wait(60);
    await fn(env);
  }
  function flushBarrier(ctx) { /* صبر بر ACK واقعی push — دترمینیستی */
    return new Promise(function (res) { try { ctx.ptfSyncFlushNow(function () { res(); }); } catch (e) { res(); } });
  }
  try {
    /* ۱ — بارگذاری پرچم از سرور در بوت */
    await scenario('flags', async function (env) {
      T('vm: پرچم‌ها در بوت از سرور بارگذاری شدند', env.ctx.ptfEngineFlags().off[FLAGGED] && env.ctx.ptfEngineFlags().loaded === true);
      T('vm: ptfLegacyPushOff فقط کلید پرچم‌شده را می‌گوید', env.ctx.ptfLegacyPushOff(FLAGGED) === true && env.ctx.ptfLegacyPushOff(CLEAN) === false);
      T('vm: تصمیم گیت — دستگاه همگرانشده → bypass (fail-open)', (function () { var d = env.ctx.ptfLegacyPushGateDecision([FLAGGED, CLEAN]); return d.phaseB === false && d.bypass.length === 1 && d.bypass[0] === FLAGGED && d.gated.length === 0; })());
      env.ctx.ptfBPhaseActive = function () { return true; };
      var d2 = env.ctx.ptfLegacyPushGateDecision([FLAGGED, CLEAN]);
      T('vm: تصمیم گیت — دستگاه فاز B → gated', d2.phaseB === true && d2.gated.length === 1 && d2.gated[0] === FLAGGED && d2.bypass.length === 0);
    });

    /* ۲ — push واقعی fail-open روی دستگاه همگرانشده */
    await scenario('bypass', async function (env) {
      env.ctx.ptfSyncNotifyDirty(FLAGGED);
      await flushBarrier(env.ctx);
      await wait(30);
      T('vm: push توده‌ای کلید پرچم‌شده روی دستگاه همگرانشده انجام شد (fail-open)', env.pushes.some(function (b) { return b.indexOf(FLAGGED) > -1; }), JSON.stringify(env.pushes));
      T('vm: تله‌متری R4-GATE-BYPASS در audit ثبت شد', env.audits.some(function (a) { return a.indexOf('R4-GATE-BYPASS') > -1; }));
      env.ctx.ptfSyncNotifyDirty(FLAGGED);
      await flushBarrier(env.ctx);
      await wait(700); /* دیبانس urgent (۵۰۰ms) هم تمام شود */
      T('vm: audit bypass در همان نشست تکرار نمی‌شود', env.audits.filter(function (a) { return a.indexOf('R4-GATE-BYPASS') > -1; }).length === 1, JSON.stringify(env.audits));
    });

    /* ۳ — مسیر gated: فاز B فعال اما flush موجود نیست → برگشت به legacy با حذف کلید پرچم‌شده */
    await scenario('gated', async function (env) {
      env.ctx.ptfBPhaseActive = function () { return true; };
      env.ctx.ptfBEnqueueKeys = function () { return true; }; /* صف persist می‌شود… ptfBFlushQueue عمداً غایب → شبکۀ امنیتی legacy + گیت */
      env.ctx.ptfSyncNotifyDirty(FLAGGED);
      await flushBarrier(env.ctx);
      await wait(30);
      T('vm: فاز B فعال → کلید پرچم‌شده از push توده‌ای حذف شد (gated)', env.pushes.every(function (b) { return b.indexOf(FLAGGED) < 0; }), JSON.stringify(env.pushes));
      T('vm: رد شدن gated در audit ثبت شد (R4-GATE)', env.audits.some(function (a) { return a.indexOf('R4-GATE') > -1 && a.indexOf('BYPASS') < 0; }));
      /* ۴ — کلید بدون پرچم در همان حالت دست‌نخورده push می‌شود */
      env.ctx.ptfSyncNotifyDirty(CLEAN);
      await flushBarrier(env.ctx);
      await wait(30);
      T('vm: کلید بدون پرچم در فاز B fallback همچنان push می‌شود', env.pushes.some(function (b) { return b.indexOf(CLEAN) > -1; }), JSON.stringify(env.pushes));
    });
  } catch (e) {
    T('زنجیرهٔ رفتاری vm بدون خطا', false, String(e && e.stack || e));
  }
  finish();
})().catch(function (e) { T('زنجیرهٔ رفتاری (بیرونی)', false, String(e && e.stack || e)); finish(); });

function finish() {
  console.log('\n— tester543 (v34.38.0: R4-گام۱ — پرچم PTF_LEGACY_PUSH_OFF + داشبورد تصمیم) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}
