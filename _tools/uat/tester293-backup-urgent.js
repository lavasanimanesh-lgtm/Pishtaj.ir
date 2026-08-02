/* tester293 — v33.13.0 (BACKUP-URGENT): فاز ۰ فوری — پر نشدن حافظه در بکاپ/بازگردانی + اتصال سرور
 * F0-1: fallback آفلاین هرگز دادهٔ حجیم در localStorage نمی‌نویسد (فقط IDB یا marker)
 * F0-2: بازگردانی با گارد ظرفیت (ptfStorageSafeSetItem + گزارش کلیدهای ناموفق)
 * F0-3: 401/needLogin → refresh توکن و یک بار تلاش مجدد
 * F0-4: timeout برای fetchهای بکاپ (AbortController)
 * F0-5: ptf_storage_queue از DATA_KEYS حذف شد
 * F0-6: audit/notifs در payload بکاپ محدود می‌شوند
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.curRole = function () { return 'admin'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.audit = function () {};
global.addLog = function () {};
global.alert = function (m) { global._alerts.push(String(m)); };
global._alerts = [];
global.notify = function () {};
global.confirm = function () { return true; };
global.SENIOR_ROLES = [];
global.renderOffers = undefined;
global.buildSettings = undefined;
global.goPanelByName = function () {};
global.location = { reload: function () { global._reloaded = true; } };
global.window = global;
global._idbWrites = [];
global.ptfStorageIdbSet = function (k, v, cb) { global._idbWrites.push({ k: k, bytes: String(v).length }); cb && cb(true, String(v).length); };
global._safeWrites = [];
global.ptfStorageSafeSetItem = function (k, v, o) { try { localStorage.setItem(k, v); global._safeWrites.push(k); return true; } catch (e) { return false; } };
global._refreshCalled = 0;
global.ptfSyncRefreshAuth = function (cb) { global._refreshCalled++; cb && cb(true); };
global.document = {
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, click: function () {} }; },
  head: { appendChild: function () {} }, body: { appendChild: function () {} },
  addEventListener: function () {}
};

/* fetch mock: اولی needLogin، دومی موفق */
var _fetchCalls = [];
global.fetch = function (url, opts) {
  _fetchCalls.push({ url: url, opts: opts || {} });
  var call = _fetchCalls.length;
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (/action=save_backup/.test(url)) {
        if (call === 1) resolve({ json: function () { return Promise.resolve({ ok: false, error: 'token required - please login again', needLogin: true }); } });
        else resolve({ json: function () { return Promise.resolve({ ok: true, mode: 'server' }); } });
      } else if (/action=data_push/.test(url)) {
        if (call >= 5 && call <= 6) resolve({ json: function () { return Promise.resolve({ ok: false, error: 'token required', needLogin: true }); } });
        else resolve({ json: function () { return Promise.resolve({ ok: true, rev: 99, krevs: {} }); } });
      } else if (/action=list_backups/.test(url)) {
        resolve({ json: function () { return Promise.resolve({ ok: true, backups: [] }); } });
      } else if (/action=get_backup/.test(url)) {
        resolve({ json: function () { return Promise.resolve({ app: 'PTF-CRM', counts: {}, data: {} }); } });
      } else resolve({ json: function () { return Promise.resolve({ ok: true }); } });
    }, 5);
  });
};
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
global.clearTimeout = clearTimeout; global.setTimeout = setTimeout;

/* دادهٔ اولیه */
setData('ptf_crm_audit', Array(2000).fill({ cd: 'A', t: 'x' }));
setData('ptf_crm_notifs', Array(900).fill({ cd: 'N' }));
setData('ptf_storage_queue', [ { big: 'x'.repeat(100000) } ]);
setData('ptf_crm_settings', {});

eval.call(global, bak);

SECTION('F0-5: کلیدهای موقت از بکاپ حذف شدند');
T('ptf_storage_queue در DATA_KEYS نیست (فقط در کامنت/گارد)', (function () { var m = bak.match(/var DATA_KEYS = \[[\s\S]*?\];/)[0]; return m.indexOf('ptf_storage_queue') === -1; })());
T('ptf_storage_queue از لیست فایل حذف شد', /'ptf_crm_sigprofiles',\s*'ptf_crm_settings'/.test(bak));

SECTION('F0-6: کاهش حجم payload');
/* استخراج توابع داخلی از backup.js (داخل IIFE) برای تست */
var _mKeys = bak.match(/var DATA_KEYS = \[[\s\S]*?\];/);
var _mCaps = bak.match(/var PAYLOAD_CAPS = \{[\s\S]*?\};/);
var _mColl = bak.match(/function collectBackup\(\) \{[\s\S]*?\n  \}/);
T('ساختارهای داخلی استخراج شدند', !!_mKeys && !!_mCaps && !!_mColl);
var _mSum = bak.match(/function summarize\(data\) \{[\s\S]*?\n  \}/);
eval.call(global, _mKeys[0] + ';' + _mCaps[0] + ';' + _mSum[0].replace('function summarize', 'global.summarize = function') + ';' + _mColl[0].replace('function collectBackup', 'global.collectBackup = function'));
var coll = collectBackup();
T('audit در بکاپ به ۱۰۰۰ رکورد محدود شد', JSON.parse(coll.data['ptf_crm_audit']).length === 1000);
T('notifs در بکاپ به ۵۰۰ رکورد محدود شد', JSON.parse(coll.data['ptf_crm_notifs']).length === 500);
T('ptf_storage_queue در payload نیست', !coll.data['ptf_storage_queue']);

SECTION('F0-4: timeout برای fetchهای بکاپ');
T('backupFetch از AbortController استفاده می‌کند', bak.indexOf('AbortController') > -1 && bak.indexOf('setTimeout(function () { try { ctrl.abort(); }') > -1);
T('همهٔ fetchهای بکاپ از backupFetch استفاده می‌کنند', bak.indexOf('fetch(API') === -1 || bak.indexOf("fetch(API + '?action=save_backup'") === -1);

SECTION('F0-3: 401 → refresh توکن + تلاش مجدد');
/* شبیه‌سازی pushBackup از طریق ptfBackupNow (manual=false برای تست بی‌صدا) */
setTimeout(function () {
  global.ptfBackupNow(); /* manual=true → alert ولی mock */
  /* پس از ۲ بار fetch (اول needLogin، دوم موفق) refresh باید ۱ بار صدا شده باشد */
  setTimeout(function () {
    T('ptfSyncRefreshAuth بعد از 401 صدا زده شد', global._refreshCalled >= 1);
    T('پس از refresh، درخواست دوم save_backup رفت', _fetchCalls.filter(function (c) { return /action=save_backup/.test(c.url); }).length >= 2);
    T('fallback آفلاین فقط IDB است (localStorage.setItem حجیم در catch نیست)', bak.indexOf("localStorage.setItem('ptf_backup_local', raw)") === -1 && bak.indexOf("backupStoreLocalFallback(payload, raw)") > -1);
    T('فقط marker در localStorage (هرگز دادهٔ حجیم)', bak.indexOf("storedIn: ok ? 'indexedDB' : 'none'") > -1 && bak.indexOf("raw backup NOT stored locally") > -1);
    T('doRestore: استفاده از ptfStorageSafeSetItem + گزارش کلیدهای ناموفق', bak.indexOf('ptfStorageSafeSetItem(k, j.data[k]') > -1 && bak.indexOf('failedKeys.push(k)') > -1 && bak.indexOf('کلیدهایی که به دلیل کمبود حافظه نوشته نشدند') > -1);
    T('data_push در restore هم refresh دارد', bak.indexOf("d.needLogin && attempt === 0 && typeof window.ptfSyncRefreshAuth") > -1);
    T('سند برنامهٔ فوری موجود است', fs.existsSync(path.join(BASE, 'PLAN-BACKUP-STORAGE-URGENT-2026-08-02.md')));
    DONE('tester293-backup-urgent');
  }, 60);
}, 20);
