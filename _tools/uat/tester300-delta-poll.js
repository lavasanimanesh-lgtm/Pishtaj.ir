/* tester300 — v33.21.x (PTF-SCALE-P0 — سینک دلتا + پول مشترک + مدیریت تب + پینگ بین‌تبی)
 * چرا (هدف: آماده‌سازی برای افزایش تعداد کاربران):
 * سه ضایعهٔ اصلی بار سرور حذف شدند:
 * ۱) data_pull: با هر تغییر «اسنپ‌شات کامل (~۴MB)» برای همه می‌رفت → حالا دلتا به‌ازای
 *    هرکلید با پارامتر krevs (کلاینت‌های قدیمی بدون krevs مثل قبل اسنپ‌شات کامل می‌گیرند).
 * ۲) getData فاز B به‌ازای هر خواندن کلید منقضی‌شده یک پول کامل مستقل می‌زد (نه single-flight
 *    نه حد نرخ) → حالا sharedPull: تک‌پرواز + حداقل فاصلهٔ ۲ثانیه + دلتا + تخلیه در تب مخفی.
 * ۳) پول ۲۰ثانیه‌ای sync.js برای تب‌های مخفی/غیرمتمرکز هم اجرا می‌شد (ضرب‌دار چندتبی) →
 *    v33.21.0: مخفی=توقف کامل → گزارش کارفرما: «رکورد در تب دوم دیر ظاهر می‌شود»
 *    v33.21.1 (به انتخاب کارفرما): مخفی=مسیر آهسته ۱۸۰ثانیه + غیرمتمرکز ۱۲۰ثانیه +
 *    **پینگ بین‌تبی (storage event)**: اعمال پول/پوش موفق → پینگ → تب‌های دیگرِ همین مرورگر
 *    (حتی پنهان) فوراً دلتا-پول می‌زنند — همگام‌سازی لحظه‌ای بین تب‌ها با هزینهٔ ~صفر.
 * چک رفتاری BUG-SYNC-RD-SCOPE-001 (خطای تولید v33.20.0) نیز اینجا پابرجاست.
 * تست‌ها: سورس‌چک PHP/JS + اجرای واقعی pullCheck و sharedPull در vm با شبکهٔ شبیه‌سازی‌شده.
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var sync = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');
var cs = fs.readFileSync(path.join(ROOT, 'crm/client-server.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');
var cc = fs.readFileSync(path.join(ROOT, 'crm/clear-cache.html'), 'utf-8');

SECTION('سرور (api/crm.php): data_pull دلتا به‌ازای هرکلید');
T('پارامتر krevs خوانده و JSON-decode می‌شود', api.indexOf("$_REQUEST['krevs']") > -1 && api.indexOf("json_decode($_REQUEST['krevs'], true)") > -1);
T('فیلتر دلتا: rev سرور ≤ rev کلاینت → کلید دوباره فرستاده نمی‌شود', api.indexOf("(int)($krevs[$k] ?? -1) >= (int)($m['rev'] ?? 0)") > -1);
T('سازگاری عقب: فیلتر فقط وقتی krevs ارسال شده (بدون آن → اسنп‌شات کامل مثل قبل)', api.indexOf('if ($krevs !== null && (int)($krevs[$k]') > -1);
T('پاسخ فلگ delta دارد + خواندن آرشیو تنبَل (پول بدون‌تغییر دیسک را نمی‌خواند)', api.indexOf("'delta' => ($krevs !== null)") > -1 && api.indexOf('$serverArchiveJson = null;') > -1 && api.indexOf('if ($serverArchiveJson === null)') > -1);

SECTION('sync.js: ارسال krevs و گارد تب (سورس)');
T('krevs در URL پول می‌رود', sync.indexOf("pullUrl += '&krevs=' + encodeURIComponent(JSON.stringify(kmOut))") > -1);
T('krevs برای هر دو پول عادی و forceFull ارسال می‌شود (v34.5.2: کلیدهای تازه دوباره دانلود نمی‌شوند)', /var pullSince = forceFull \? 0 : state\.lastRev;[\s\S]{0,400}pullUrl \+= '&krevs='/.test(sync) && sync.indexOf('if (!forceFull) { try { pullUrl') === -1);
T('گارد تب (v33.21.1): غیرمتمرکز ۱۲۰ثانیه / مخفی ۱۸۰ثانیه؛ پینگ (opts.instant) دور می‌زند', sync.indexOf('document.hasFocus') > -1 && sync.indexOf('120000') > -1 && sync.indexOf('180000') > -1 && sync.indexOf('state.lastBgPull') > -1 && sync.indexOf('opts.instant') > -1);
T('پینگ بین‌تبی: pingTabs در اعمالِ پول و پوش موفق + listener storage با مقایسهٔ rev و حد نرخ', (sync.match(/pingTabs\(\);/g) || []).length >= 2 && sync.indexOf("window.addEventListener('storage'") > -1 && sync.indexOf('+p.rev <= state.lastRev') > -1 && sync.indexOf('pingTabs') > -1);
T('جبران فوری: focus + visibilitychange با گارد bootstrapped', sync.indexOf("window.addEventListener('focus'") > -1 && sync.indexOf("document.addEventListener('visibilitychange'") > -1 && sync.indexOf('state.bootstrapped && !state.pulling && !state.pushing') > -1);

/* ---------- کمک‌تابع: thenable همگام (زنجیره‌های fetch در همان لحظه تمام می‌شوند) ---------- */
function thenableValue(x) {
  return {
    then: function (fn) { var r = fn(x); while (r && typeof r.then === 'function') { r.then(function (y) { r = y; }); } return thenableValue(r); },
    catch: function () { return thenableValue(x); }
  };
}
function mkLs(store) {
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

/* ---------- sync.js: اجرای واقعی pullCheck در vm ---------- */
var SYNC_SRC = sync.replace('  // رندر مجدد پنل فعلی پس از دریافت/ثبت داده جدید (بدون پرش وسط مودال)',
  '  window.__pullCheck = pullCheck;\n\n  // رندر مجدد پنل فعلی پس از دریافت/ثبت داده جدید (بدون پرش وسط مودال)');
if (SYNC_SRC === sync) throw new Error('marker تزریق برای pullCheck پیدا نشد');

function mkSyncSandbox(opts) {
  opts = opts || {};
  var calls = [];
  var store = opts.store || {};
  var ls = mkLs(store);
  var doc = {
    hidden: !!opts.hidden,
    hasFocus: function () { return opts.focus !== false; },
    addEventListener: function () {},
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  var resp = opts.response || { ok: true, fresh: true, rev: 4 };
  var sandbox = {
    console: console, localStorage: ls, document: doc,
    navigator: { onLine: true, sendBeacon: function () { return true; } },
    location: { href: 'https://pishtaj.ir/crm/index.html', reload: function () {} },
    setInterval: function () { return 1; }, clearInterval: function () {},
    setTimeout: function () { return 1; }, clearTimeout: function () {},
    curSession: function () { return { user: 'u1', name: 'تست' }; },
    curRole: function () { return 'admin'; },
    ptfToast: function () {}, addLog: function () {}, audit: function () {},
    fetch: function (url) { calls.push(url); return thenableValue({ json: function () { return thenableValue(resp); } }); }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(SYNC_SRC, sandbox, { filename: 'sync.js' });
  return { sandbox: sandbox, calls: calls, store: store };
}
function urlParam(url, name) {
  var m = url.match(new RegExp('[?&]' + name + '=([^&]*)'));
  return m ? m[1] : null;
}

SECTION('sync.js (runtime): pullCheck');
var s1 = mkSyncSandbox({ store: { ptf_crm_token: 'tok', ptf_sync_rev: '4', ptf_sync_krevs: '{"ptf_crm_leads":5,"ptf_crm_customers":3}', ptf_crm_leads: '[{"id":"L1"}]', ptf_crm_customers: '[{"id":"C9"}]' } });
s1.sandbox.__pullCheck();
var kr1 = urlParam(s1.calls[0] || '', 'krevs');
T('پول عادی: since=۴ و krevs همان نقشهٔ ذخیره‌شده است', s1.calls.length === 1 && urlParam(s1.calls[0], 'since') === '4' && kr1 !== null && JSON.parse(decodeURIComponent(kr1)).ptf_crm_leads === 5 && JSON.parse(decodeURIComponent(kr1)).ptf_crm_customers === 3);

var s2 = mkSyncSandbox({ hidden: true, store: { ptf_crm_token: 'tok', ptf_sync_rev: '4' } });
s2.sandbox.__pullCheck();
s2.sandbox.__pullCheck();
T('تب مخفی (v33.21.1 مسیر آهسته): پول اول آزاد است ولی دومی در پنجرهٔ ۱۸۰ثانیه دفع می‌شود', s2.calls.length === 1);
s2.sandbox.__pullCheck(null, false, { instant: true });
T('پینگ بین‌تبی (instant) حتی در تب مخفی فوراً پول می‌دهد', s2.calls.length === 2);

var s3 = mkSyncSandbox({ focus: false, store: { ptf_crm_token: 'tok', ptf_sync_rev: '4' } });
s3.sandbox.__pullCheck();
s3.sandbox.__pullCheck();
T('تب غیرمتمرکز (دیده‌شده): اولین پول می‌رود ولی دومی در پنجرهٔ ۱۲۰ثانیه دفع می‌شود', s3.calls.length === 1);

var s4 = mkSyncSandbox({ store: { ptf_crm_token: 'tok', ptf_sync_rev: '4', ptf_sync_krevs: '{"ptf_crm_leads":5}', ptf_crm_leads: '[{"id":"L1"}]' }, response: { ok: true, rev: 2, delta: false, data: {}, meta: { _global: { rev: 2 } } } });
s4.sandbox.__pullCheck(null, true);
T('forceFull: since=0 و krevs همراه می‌رود (v34.5.2)', s4.calls.length === 1 && urlParam(s4.calls[0], 'since') === '0' && JSON.parse(decodeURIComponent(urlParam(s4.calls[0], 'krevs') || '{}')).ptf_crm_leads === 5);

var deltaResp = {
  ok: true, rev: 7, delta: true,
  data: { ptf_crm_leads: '[{"id":"L1","iso":"2026-08-02T00:00:00Z"}]' },
  meta: { _global: { rev: 7 }, ptf_crm_customers: { rev: 3 }, ptf_crm_leads: { rev: 6 } }
};
var s5 = mkSyncSandbox({ store: {
  ptf_crm_token: 'tok', ptf_sync_rev: '4', ptf_sync_krevs: '{"ptf_crm_leads":5,"ptf_crm_customers":3}',
  ptf_crm_leads: '[]', ptf_crm_customers: '[{"id":"C9"}]', ptf_crm_deleted_archive: '[]'
}, response: deltaResp });
s5.sandbox.__pullCheck();
var krAfter = JSON.parse(s5.store['ptf_sync_krevs'] || '{}');
T('پاسخ دلتا: فقط کلید موجود در data نوشته می‌شود و بقیه دست‌نخورده می‌مانند', s5.store['ptf_crm_leads'].indexOf('L1') > -1 && s5.store['ptf_crm_customers'].indexOf('C9') > -1);
T('پس از دلتا: rev سراسری=۷ و rev هرکلید از meta به‌روز می‌شود (leads=6, customers=3)', s5.store['ptf_sync_rev'] === '7' && krAfter.ptf_crm_leads === 6 && krAfter.ptf_crm_customers === 3);
var pingSt = null; try { pingSt = JSON.parse(s5.store['ptf_sync_ping'] || 'null'); } catch (ePg) {}
T('اعمال موفق پول → پینگ بین‌تبی با rev جدید نوشته می‌شود', !!pingSt && pingSt.rev === 7);

/* ---------- client-server.js: sharedPull در vm ---------- */
SECTION('client-server.js: sharedPull (سورس)');
T('sharedPull تعریف شده و getData روی آن سوار می‌شود (به‌جای پول مستقل)', cs.indexOf('function sharedPull(cb) {') > -1 && cs.indexOf('sharedPull(function (d) {') > -1);
T('تک‌پرواز + حد نرخ ۲ثانیه + تخلیهٔ تب مخفی + دلتا (krevs در serverPull)', cs.indexOf('var _pullInflight = false') > -1 && cs.indexOf('PULL_MIN_GAP = 2000') > -1 && cs.indexOf('document.hidden') > -1 && cs.indexOf('function serverPull(since, cb, krevs)') > -1);

function mkCsSandbox(opts) {
  opts = opts || {};
  var calls = [];
  var deferreds = [];
  var store = opts.store || {};
  var ls = mkLs(store);
  var responder = opts.responder || function (url) {
    if (/data_pull/.test(url)) return { ok: true, fresh: true, rev: 2 };
    return { ok: true, saved: 0 };
  };
  var doc = { hidden: !!opts.hidden, addEventListener: function () {}, hasFocus: function () { return true; }, getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, appendChild: function () {}, addEventListener: function () {} }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} } };
  function gd(k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } }
  function sd(k, d) { ls.setItem(k, JSON.stringify(d)); }
  var sandbox = {
    console: console, localStorage: ls, document: doc,
    navigator: { onLine: true, sendBeacon: function () { return true; } },
    location: { reload: function () {} },
    setInterval: function () { return 1; }, clearInterval: function () {},
    setTimeout: function (fn) { return 1; }, clearTimeout: function () {},
    curSession: function () { return { user: 'u1', name: 'تست' }; },
    curRole: function () { return 'admin'; },
    ptfToast: function () {}, addLog: function () {}, audit: function () {}, confirm: function () { return false; }, alert: function () {},
    getData: gd, setData: sd,
    fetch: function (url) {
      calls.push(url);
      var thens = [];
      deferreds.push({ url: url, thens: thens });
      var pr = { then: function (fn) { thens.push(fn); return pr; }, catch: function (fn) { return pr; } };
      return pr;
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(cs, sandbox, { filename: 'client-server.js' });
  function flush() {
    var guard = 0;
    while (deferreds.length && guard++ < 200) {
      var dx = deferreds.shift();
      var payload = responder(dx.url);
      var v = dx.thens[0]({ json: function () { return thenableValue(payload); } });
      while (v && typeof v.then === 'function') { v.then(function (x) { v = x; }); }
      if (dx.thens[1]) dx.thens[1](v);
    }
  }
  return { sandbox: sandbox, calls: calls, store: store, flush: flush };
}

var csResp = {
  ok: true, rev: 10, delta: true,
  data: { ptf_crm_customers: '[{"id":"C1"}]', ptf_crm_leads: '[{"id":"L7"}]' },
  meta: { _global: { rev: 10 }, ptf_crm_customers: { rev: 8 }, ptf_crm_leads: { rev: 9 } }
};
var c1 = mkCsSandbox({ store: { ptf_crm_token: 'tok', ptf_b_phase: '1', ptf_b_flushed_u1: '1', ptf_b_synced_u1: '1' }, responder: function () { return csResp; } });
c1.sandbox.window.ptfBEnable();
var g1 = c1.sandbox.window.getData('ptf_crm_customers');
var g2 = c1.sandbox.window.getData('ptf_crm_leads');
var pulls1 = c1.calls.filter(function (u) { return /data_pull/.test(u); });
T('runtime: دو getData پیاپی → فقط یک data_pull (single-flight/ادغام) و آن هم با krevs', pulls1.length === 1 && /krevs=/.test(pulls1[0] || ''));
c1.flush();
var csKr = JSON.parse(c1.store['ptf_sync_krevs'] || '{}');
T('runtime: پاسخ دلتا — هر دو کلید در ذخیره‌سازی محلی به‌روز و revها ثبت می‌شوند', (c1.store['ptf_crm_customers'] || '').indexOf('C1') > -1 && (c1.store['ptf_crm_leads'] || '').indexOf('L7') > -1 && csKr.ptf_crm_customers === 8 && csKr.ptf_crm_leads === 9 && c1.store['ptf_sync_rev'] === '10');

var c2 = mkCsSandbox({ hidden: true, store: { ptf_crm_token: 'tok', ptf_b_phase: '1', ptf_b_flushed_u1: '1', ptf_b_synced_u1: '1' } });
c2.sandbox.window.ptfBEnable();
c2.sandbox.window.getData('ptf_crm_customers');
var pulls2 = c2.calls.filter(function (u) { return /data_pull/.test(u); });
T('runtime: تب مخفی — sharedPull تخلیه می‌شود و هیچ data_pullای نمی‌رود', pulls2.length === 0);

SECTION('BUG-SYNC-RD-SCOPE-001: tombstone در اسکوپ سراسری بدون rd داخلی کار کند');
T('سورس: ptfReadArchive دیگر rdِ اسکوپ‌مذبوح صدا نمی‌زند و راهنمای خودکفا دارد', sync.indexOf('addFrom(rd(') === -1 && sync.indexOf('function ptfReadDeletedArchiveStr()') > -1 && sync.indexOf('BUG-SYNC-RD-SCOPE-001') > -1);
/* رقارنسی رفتاری: sandbox هیچ rd سراسری ندارد — پیش از اصلاح: ReferenceError؛ حالا باید بی‌صدا فیلتر کند */
var s6 = mkSyncSandbox({ store: { ptf_crm_token: 'tok', ptf_crm_deleted_archive: '[{"kind":"lead","id":"L-DEL","iso":"2026-08-01T00:00:00Z"}]' } });
var tombOk = true, tombOut = null;
try {
  tombOut = JSON.parse(s6.sandbox.window.ptfApplyDeletionTombstones('ptf_crm_leads', JSON.stringify([{ id: 'L-DEL' }, { id: 'L-OK' }])));
} catch (eTomb) { tombOk = false; }
T('runtime: بدون rd سراسری، tombstone خطا نمی‌دهد و رکورد حذف‌شده فیلتر می‌شود', tombOk && Array.isArray(tombOut) && tombOut.length === 1 && tombOut[0].id === 'L-OK');

SECTION('نسخه‌گذاری');
var verM = idx.match(/window\.PTF_CRM_RELEASE = '(v[0-9.]+)'/);
var verNow = verM ? verM[1] : '';
T('نسخهٔ فعلی همگام: index.html + sw.js + clear-cache.html + نشان PTF-SCALE-P0 در PHP', !!verNow && sw.indexOf('ptf-crm-' + verNow) > -1 && cc.indexOf(verNow) > -1 && api.indexOf('PTF-SCALE-P0') > -1);

DONE('tester300-delta-poll');
