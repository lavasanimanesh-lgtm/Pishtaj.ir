/* tester298 — v33.19.0 (DB-MIG-001 — فاز B): کلاینت نازک — سرور-محور
 * v33.18.0: هوک getData/setData فقط وقتی فعال است؛ صف آفلاین؛ flush؛ هم‌گرایی یک‌باره؛ دکمه‌های تنظیمات
 * v33.19.0 (رفع باگ هم‌گرایی کاربران):
 *   ۱) serverPush: needLogin/401 → بازسازی نشست (ptfSyncRefreshAuth) + یک بار retry
 *   ۲) ptfBPushBatch: ارسال دسته‌ای (≤۲۰ کلید در هر درخواست) — در flush صف و هم‌گرایی
 *   ۳) پیام دقیق انقضای نشست («نشست منقضی؛ دوباره وارد شوید») به‌جای «سرور در دسترس نیست»
 *   ۴) ptfBClearLocalCache: پاک‌سازی امن کش محلی با گاردها (فاز فعال + هم‌گرایی موفق + صف خالی + تایپ «پاک»)
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cs = fs.readFileSync(path.join(BASE, 'client-server.js'), 'utf-8');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

global.window = global;
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.ptfToast = function () {};
global.location = { reload: function () {} };
global.ptfSyncNotifyDirty = function () {};

/* mock شبکه با حالت‌های قابل‌سوئیچ برای سناریوهای احراز هویت */
global._pushCalls = [];   /* متن خام bodyهای data_push */
global._pushKeys = [];    /* آرایهٔ کلیدهای هر payload */
global._pushMode = 'ok';  /* ok | needLoginOnce | needLoginAll */
global._pushSeq = 0;
global._needLoginSeq = -1;
global._refreshCalls = [];
global._refreshApprove = true;
global.ptfSyncRefreshAuth = function (cb) { var approve = global._refreshApprove !== false; global._refreshCalls.push(approve); cb(approve); };
global.fetch = function (url, opts) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (/data_push/.test(url)) {
        global._pushCalls.push(opts.body || '');
        try { global._pushKeys.push(Object.keys(JSON.parse(opts.body).data || {})); } catch (e) { global._pushKeys.push(['<bad-payload>']); }
        global._pushSeq++;
        var deny = (global._pushMode === 'needLoginAll') || (global._pushMode === 'needLoginOnce' && global._pushSeq === global._needLoginSeq);
        if (deny) resolve({ json: function () { return Promise.resolve({ ok: false, needLogin: true, error: 'token required - please login again' }); } });
        else {
          var pushed = {};
          try { pushed = JSON.parse(opts.body || '{}').data || {}; } catch (ePush) {}
          resolve({ json: function () { return Promise.resolve({ ok: true, savedKeys: Object.keys(pushed), rev: global._pushSeq }); } });
        }
      }
      else if (/data_pull/.test(url)) resolve({ json: function () { return Promise.resolve({ ok: true, fresh: true }); } });
      else resolve({ json: function () { return Promise.resolve({ ok: true }); } });
    }, 5);
  });
};
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {} }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {} };

/* تعریف getData/setData شبیه index.html */
function gd(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
function sd(k, d) { localStorage.setItem(k, JSON.stringify(d)); }
global.getData = gd; global.setData = sd; global.setDataOld = sd;

eval.call(global, cs);

SECTION('فاز B: هوک فقط وقتی فعال است');
T('getData قبل از فعال‌سازی رفتار قبلی دارد', (function () {
  setData('ptf_crm_settings', { a: 1 });
  return getData('ptf_crm_settings').a === 1;
})());
T('فعال‌سازی + پرچم (هم‌گرایی فقط پس از ACK کامل علامت می‌خورد)', (function () {
  localStorage.removeItem('ptf_b_phase');
  localStorage.removeItem('ptf_b_flushed_u1');
  localStorage.removeItem('ptf_b_synced_u1');
  /* قبل از فعال‌سازی، دادهٔ محلی موجود است */
  setData('ptf_crm_settings', { a: 2 });
  ptfBEnable();
  return localStorage.getItem('ptf_b_phase') === '1' && localStorage.getItem('ptf_b_flushed_u1') !== '1';
})());

SECTION('صف آفلاین + flush');
T('setData در حالت فعال → صف پر می‌شود و push می‌رود', (function () {
  setData('ptf_crm_settings', { a: 3 });
  var q = JSON.parse(localStorage.getItem('ptf_b_queue') || '{}');
  return !!q['ptf_crm_settings'];
})());

/* ============ v33.19.0: زنجیرهٔ async ۴ تست جدید (کامل در <۳۰۰ms — قبل از تایمر اصلی) ============ */
SECTION('v33.19.0: ارسال دسته‌ای (batch)');
/* T9: ۴۵ کلید → ۳ دستهٔ ≤۲۰ کلید، همهٔ هدف‌دار */
var b45 = {}; for (var i = 0; i < 45; i++) b45['ptf_crm_k' + i] = '[]';
global._pushMode = 'ok';
ptfBPushBatch(b45, function (d9) {
  var marked = /k\d+$/;
  var t9 = global._pushKeys.filter(function (ks) { return ks.some(function (k) { return marked.test(k); }); });
  var allKeys = []; t9.forEach(function (ks) { allKeys = allKeys.concat(ks); });
  var okSizes = t9.length === 3 && t9.every(function (ks) { return ks.length <= 20; }) && allKeys.length === 45;
  T('ارسال ۴۵ کلید در ۳ دستهٔ ≤۲۰تایی (n=20/20/5)', d9.ok === true && d9.pushed === 45 && okSizes, JSON.stringify(t9.map(function (ks) { return ks.length; })));

  /* T10: needLogin/401 → بازسازی نشست + یک بار retry موفق */
  SECTION('v33.19.0: needLogin → بازسازی نشست + retry');
  global._pushMode = 'needLoginOnce';
  global._needLoginSeq = global._pushSeq + 1;
  global._refreshApprove = true;
  var rcBefore = global._refreshCalls.length;
  ptfBPushBatch({ ptf_crm_x: '[]' }, function (d10) {
    var t10 = global._pushKeys.filter(function (ks) { return ks.indexOf('ptf_crm_x') > -1; });
    T('needLogin/401 → ptfSyncRefreshAuth + یک بار retry (سپس موفق)',
      d10.ok === true && d10.pushed === 1 && t10.length === 2 && (global._refreshCalls.length - rcBefore) === 1,
      'pushes=' + t10.length + ' refreshes=' + (global._refreshCalls.length - rcBefore));

    /* T11: هم‌گرایی با نشست منقضی → پیام دقیق («منقضی» — نه «سرور در دسترس نیست») */
    SECTION('v33.19.0: پیام دقیق انقضای نشست در هم‌گرایی');
    global._pushMode = 'needLoginAll';
    global._refreshApprove = false;
    var alerts11 = [];
    var _oa11 = global.alert;
    global.alert = function (m) { alerts11.push(String(m)); };
    localStorage.removeItem('ptf_b_flushed_u1');
    localStorage.removeItem('ptf_b_synced_u1');
    ptfBConfirmFlush();
    setTimeout(function () {
      global.alert = _oa11;
      var joined = alerts11.join('\n');
      T('هم‌گرایی با نشست منقضی → پیام «نشست منقضی؛ دوباره وارد شوید» (نه «سرور در دسترس نیست»)',
        /منقضی/.test(joined) && !/در دسترس نیست/.test(joined));

      /* T12: پاک‌سازی کش محلی — گارد فاز غیرفعال + فلوی موفق با «پاک» */
      SECTION('v33.19.0: پاک‌سازی امن کش محلی');
      var okRefuse = false, okClear = false;
      var _oa12 = global.alert;
      /* (الف) فاز B غیرفعال → باید فوراً امتناع کند و داده دست‌نخورده بماند */
      localStorage.removeItem('ptf_b_phase');
      localStorage.setItem('ptf_crm_settings', '{"guard":1}');
      var al12 = [];
      global.alert = function (m) { al12.push(String(m)); };
      ptfBClearLocalCache();
      okRefuse = al12.length === 1 && /حالت سرور-محور \(فاز B\) فعال نیست/.test(al12[0]) && localStorage.getItem('ptf_crm_settings') === '{"guard":1}';
      /* (ب) فاز فعال + هم‌گرایی موفق + صف خالی + کلمهٔ «پاک» → کش پاک می‌شود */
      localStorage.setItem('ptf_b_phase', '1');
      localStorage.setItem('ptf_b_flushed_u1', '1');
      localStorage.setItem('ptf_b_synced_u1', '1');
      localStorage.setItem('ptf_b_queue', '{}');
      localStorage.setItem('ptf_crm_settings', '{"guard":2}');
      var _op12 = global.prompt;
      global.prompt = function () { return 'پاک'; };
      al12 = [];
      ptfBClearLocalCache();
      okClear = localStorage.getItem('ptf_crm_settings') === null && /پاک‌سازی کش محلی انجام شد/.test(al12.join('\n'));
      global.prompt = _op12;
      global.alert = _oa12;
      localStorage.setItem('ptf_crm_settings', '{"guard":2}'); /* بازیابی داده برای تست‌های بعدی */
      var uiOk = bak.indexOf('پاک‌سازی کش محلی') > -1 && cs.indexOf('ptfBClearLocalCache') > -1;
      T('پاک‌سازی کش محلی — گارد فاز غیرفعال + حذف امن با «پاک» + دکمهٔ تنظیمات', okRefuse && okClear && uiOk,
        'refuse=' + okRefuse + ' clear=' + okClear + ' ui=' + uiOk);

      /* بازگردانی حالت استاندارد شبکه برای t≈4000 (flush debounce) */
      global._pushMode = 'ok';
      global._refreshApprove = true;
    }, 250);
  });
});

setTimeout(function () {
  T('پس از debounce (4s)، push به سرور رفت و صف خالی شد', (function () {
    return global._pushCalls.length > 0 && Object.keys(JSON.parse(localStorage.getItem('ptf_b_queue') || '{}')).length === 0;
  })());

  SECTION('غیرفعال‌سازی → رفتار قبلی');
  ptfBDisable();
  T('بعد از غیرفعال‌سازی، getData محلی است', (function () { setData('ptf_crm_settings', { a: 4 }); return getData('ptf_crm_settings').a === 4; })());

  SECTION('UI و لود');
  T('دکمه‌های فاز B در تنظیمات (فعال/هم‌گرایی/غیرفعال)', bak.indexOf('ptfBEnable()') > -1 && bak.indexOf('ptfBConfirmFlush()') > -1 && bak.indexOf('ptfBDisable()') > -1 && bak.indexOf('🌐 حالت سرور-محور') > -1); /* v33.22.2: متن عنوان کوتاه‌تر شد */
  T('client-server.js بعد از sync.js لود می‌شود', idx.indexOf('sync.js?v=') < idx.indexOf('client-server.js?v='));
  T('گارد idempotent (double-load) + گارد دوباره‌هوک (__ptfB) دارد', cs.indexOf('__ptfClientServerLoaded') > -1 && cs.indexOf('__ptfB') > -1);
  DONE('tester298-phase-b');
}, 4600);
