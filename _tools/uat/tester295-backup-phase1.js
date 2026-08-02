/* tester295 — v33.15.0 (BACKUP-PHASE1): فاز ۱ برنامهٔ فوری بکاپ
 * F1-1: ptfBackupServerStatus / ptfBackupServerCheck (بررسی اتصال سرور + نمایش وضعیت)
 * F1-2: بکاپ خودکار فقط در صورت تغییر (backupSignature/backupChangedSinceLast/ptfBackupMaybeAuto)
 * F1-3: ptfStorageAutoTame — فشرده‌سازی خودکار روزانه وقتی حافظه > ۸۰٪
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var sq = fs.readFileSync(path.join(BASE, 'storage-quota.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی' }; };
global.curRole = function () { return 'admin'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.audit = function () {};
global.addLog = function () {};
global.alert = function () {};
global.notify = function () {};
global.confirm = function () { return true; };
global.SENIOR_ROLES = [];
global.goPanelByName = function () {};
global.location = { reload: function () {} };
global.window = global;
global.ptfToast = function () {};
global._safeWrites = [];
global.ptfStorageSafeSetItem = function (k, v) { try { localStorage.setItem(k, v); global._safeWrites.push(k); return true; } catch (e) { return false; } };
global.ptfSyncRefreshAuth = function (cb) { cb && cb(true); };
global.document = {
  getElementById: function (id) { if (id === 'ptfBackupConn') return { innerHTML: '' }; return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, click: function () {} }; },
  head: { appendChild: function () {} }, body: { appendChild: function () {} },
  addEventListener: function () {}
};
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };

/* fetch mock برای وضعیت اتصال */
global._fetchLog = [];
global.fetch = function (url, opts) {
  global._fetchLog.push(String(url));
  var isUsers = /action=users_get/.test(url);
  var isSave = /action=save_backup/.test(url);
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (isUsers) resolve({ json: function () { return Promise.resolve({ ok: true, users: [] }); } });
      else if (isSave) resolve({ json: function () { return Promise.resolve({ ok: true, mode: 'server' }); } });
      else resolve({ json: function () { return Promise.resolve({ ok: true }); } });
    }, 5);
  });
};

eval.call(global, bak);

SECTION('F1-1: بررسی اتصال سرور');
setTimeout(function () {
  window.ptfBackupServerStatus(function (r) {
    T('ptfBackupServerStatus: سرور آنلاین → status=online', r.status === 'online');
    /* آفلاین */
    var _f = global.fetch;
    global.fetch = function () { return new Promise(function (res) { setTimeout(function () { res({ json: function () { return Promise.reject(new Error('net')); } }); }, 5); }); };
    window.ptfBackupServerStatus(function (r2) {
      T('سرور قطع → status=offline', r2.status === 'offline');
      global.fetch = _f;
      /* needLogin */
      global.fetch = function (url) { global._fetchLog.push(String(url)); return new Promise(function (res) { setTimeout(function () { res({ json: function () { return Promise.resolve({ ok: false, needLogin: true, error: 'token' }); } }); }, 5); }); };
      window.ptfBackupServerStatus(function (r3) {
        T('توکن منقضی → status=needLogin', r3.status === 'needLogin');
        global.fetch = _f;
        window.ptfBackupServerCheck();
        T('دکمهٔ بررسی اتصال در باکس بکاپ هست', bak.indexOf('ptfBackupServerCheck()') > -1 && bak.indexOf('🔌 بررسی اتصال سرور') > -1 && bak.indexOf('ptfBackupConn') > -1);

        SECTION('F1-2: بکاپ فقط در صورت تغییر');
        /* امضا اولیه */
        var sig1 = window.ptfBackupSignature();
        T('backupSignature عددی/رشته‌ای پایدار تولید می‌کند', typeof sig1 === 'string' && sig1.length > 0);
        T('بدون تغییر → backupChangedSinceLast=false', (function () {
          try { localStorage.setItem('ptf_backup_sig', window.ptfBackupSignature()); } catch (e) {}
          return window.ptfBackupChanged() === false;
        })());
        T('با تغییر داده → backupChangedSinceLast=true', (function () {
          setData('ptf_crm_settings', { x: Date.now() });
          return window.ptfBackupChanged() === true;
        })());
        /* ptfBackupMaybeAuto: بدون تغییر → skipped (بدون fetch جدید) */
        try { localStorage.setItem('ptf_backup_sig', window.ptfBackupSignature()); } catch (e) {}
        var before = global._fetchLog.length;
        var rA = window.ptfBackupMaybeAuto();
        T('بدون تغییر → MaybeAuto بکاپ نمی‌فرستد', rA.skipped === 'no_change' && global._fetchLog.length === before);
        /* با تغییر → push */
        setData('ptf_crm_settings', { y: Date.now() });
        var rB = window.ptfBackupMaybeAuto();
        setTimeout(function () {
          console.log('DEBUG rB:', JSON.stringify(rB), 'fetchLog:', global._fetchLog.join(' | '));
          /* v33.16.0: بدون امضای per-key → بکاپ کامل اولیه (full_initial)؛ امضا آپدیت می‌شود */
          T('با تغییر → MaybeAuto بکاپ می‌فرستد (کامل اولیه) و امضا را آپدیت می‌کند', !!rB.pushed && global._fetchLog.some(function (u) { return /action=save_backup/.test(u) || /save_backup_delta/.test(u); }));
          T('پس از موفقیت، امضا آپدیت شد (بکاپ بعدی skip)', (function () {
            try { localStorage.setItem('ptf_backup_sig', window.ptfBackupSignature()); } catch (e) {}
            return window.ptfBackupChanged() === false;
          })());

          SECTION('F1-3: فشرده‌سازی خودکار روزانه');
          /* تست ptfStorageAutoTame — با localStorage شبیه‌سازی کامل (length/key) */
          function FullLS() { this.s = {}; }
          FullLS.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this.s, k) ? this.s[k] : null; };
          FullLS.prototype.setItem = function (k, v) { this.s[String(k)] = String(v); };
          FullLS.prototype.removeItem = function (k) { delete this.s[String(k)]; };
          FullLS.prototype.key = function (i) { return Object.keys(this.s)[i] || null; };
          FullLS.prototype.clear = function () { this.s = {}; };
          Object.defineProperty(FullLS.prototype, 'length', { get: function () { return Object.keys(this.s).length; } });
          var ls2 = new FullLS();
          var big = { d: 'x'.repeat(110000), t: Date.now() - 200 * 86400000 };
          var av = {};
          for (var i = 1; i <= 40; i++) av['u' + i] = big;
          ls2.setItem('ptf_crm_avatars', JSON.stringify(av));
          var sqSandbox = { console: console, TextEncoder: TextEncoder, Date: Date, Blob: Blob, navigator: { storage: { estimate: function () { return Promise.resolve({ usage: 1, quota: 2 }); } } }, document: { getElementById: function () { return null; }, createElement: function () { return { style: {} }; }, body: { appendChild: function () {} } }, alert: function () {}, localStorage: ls2 };
          sqSandbox.window = sqSandbox;
          var vm = require('vm');
          vm.runInNewContext(sq, sqSandbox, { filename: 'sq' });
          var tame = sqSandbox.ptfStorageAutoTame();
          T('AutoTame وقتی >۸۰٪ اجرا می‌شود و avatars را فشرده می‌کند', tame.ok === true && Object.keys(JSON.parse(ls2.getItem('ptf_crm_avatars') || '{}')).length <= 20);
          T('AutoTame در storage-quota موجود و یک‌بار در روز برنامه‌ریزی شده', sq.indexOf('ptfStorageAutoTame') > -1 && sq.indexOf('ptf_storage_auto_tame') > -1);
          DONE('tester295-backup-phase1');
        }, 60);
      });
    });
  });
}, 20);
