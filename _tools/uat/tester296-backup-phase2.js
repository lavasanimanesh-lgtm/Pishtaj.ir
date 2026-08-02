/* tester296 — v33.16.0 (BACKUP-PHASE2): فاز ۲ بکاپ
 * F2-1: بکاپ دلتا (فقط کلیدهای تغییرکرده — امضای per-key) + fallback به کامل وقتی پایه نیست
 * F2-3: بازگردانی تراکنشی (تمام‌یا-هیچ) با rollback خودکار وقتی ظرفیت کافی نیست
 * سرور: اکشن save_backup_delta (ادغام با آخرین بکاپ کامل + چرخش مشترک ptf_rotate_backup)
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');

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
global.goPanelByName = function () {};
global.location = { reload: function () { global._reloaded = true; } };
global.window = global;
global.ptfToast = function () {};
global.ptfSyncRefreshAuth = function (cb) { global._refreshCalled = (global._refreshCalled || 0) + 1; cb && cb(true); };
global._idbWrites = [];
global.ptfStorageIdbSet = function (k, v, cb) { global._idbWrites.push({ k: k }); cb && cb(true, String(v).length); };
global._safeWrites = [];
global.ptfStorageSafeSetItem = function (k, v) { try { localStorage.setItem(k, v); global._safeWrites.push(k); return true; } catch (e) { return false; } };
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
global.document = {
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, click: function () {} }; },
  head: { appendChild: function () {} }, body: { appendChild: function () {} },
  addEventListener: function () {}
};

/* fetch mock: save_backup_delta → ok؛ بدون پایه (needFull) در حالت تست دوم */
global._fetchLog = [];
var _deltaOk = true;
global.fetch = function (url, opts) {
  global._fetchLog.push(String(url));
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (/save_backup_delta/.test(url)) {
        resolve({ json: function () { return Promise.resolve(_deltaOk ? { ok: true, mode: 'server', delta: 1 } : { ok: false, error: 'ابتدا یک بک‌آپ کامل بفرستید', needFull: true }); } });
      } else if (/save_backup/.test(url)) {
        resolve({ json: function () { return Promise.resolve({ ok: true, mode: 'server' }); } });
      } else if (/data_push/.test(url)) {
        resolve({ json: function () { return Promise.resolve({ ok: true, rev: 5, krevs: {} }); } });
      } else resolve({ json: function () { return Promise.resolve({ ok: true }); } });
    }, 5);
  });
};

setData('ptf_crm_settings', { a: 1 });
setData('ptf_crm_customers', [{ cd: 'C1' }]);
try { localStorage.removeItem('ptf_backup_delta_sig'); } catch (e) {}
try { localStorage.removeItem('ptf_backup_sig'); } catch (e) {}

eval.call(global, bak);

SECTION('F2-1: بکاپ دلتا (امضای per-key)');
/* اولین MaybeAuto: بدون امضای per-key → بکاپ کامل اولیه */
var r1 = window.ptfBackupMaybeAuto();
T('بدون امضای per-key → بکاپ کامل اولیه (full_initial)', r1.pushed === 'full_initial' && global._fetchLog.some(function (u) { return /action=save_backup/.test(u); }));
setTimeout(function () {
  /* بعد از کامل اولیه، امضای per-key ست شده — تغییر یک کلید → دلتا فقط همان کلید */
  setData('ptf_crm_settings', { a: 2 });
  var coll = window.ptfBackupDeltaCollect();
  T('دلتا فقط کلید تغییرکرده را دارد', coll.changed.length === 1 && coll.changed[0] === 'ptf_crm_settings' && !!coll.delta['ptf_crm_settings']);
  var _fl = global._fetchLog.length;
  window.ptfBackupMaybeAuto();
  setTimeout(function () {
    T('MaybeAuto با تغییر → save_backup_delta فرستاده شد', global._fetchLog.slice(_fl).some(function (u) { return /save_backup_delta/.test(u); }));

    SECTION('Fallback: بدون بکاپ پایه → بکاپ کامل');
    _deltaOk = false;
    try { localStorage.removeItem('ptf_backup_delta_sig'); } catch (e) {}
    try { localStorage.removeItem('ptf_backup_sig'); } catch (e) {}
    setData('ptf_crm_settings', { a: 3 });
    var _fl2 = global._fetchLog.length;
    window.ptfBackupMaybeAuto();
    setTimeout(function () {
      T('needFull → fallback به save_backup کامل', global._fetchLog.slice(_fl2).some(function (u) { return /action=save_backup/.test(u); }));
      _deltaOk = true;

      SECTION('F2-3: بازگردانی تراکنشی با rollback');
      /* شبیه‌سازی ظرفیت ناکافی: safeSetItem برای یک کلید fail می‌کند */
      var oldSafe = global.ptfStorageSafeSetItem;
      var failNext = false;
      global.ptfStorageSafeSetItem = function (k, v) {
        if (failNext && k === 'ptf_crm_customers') { failNext = false; return false; } /* فقط یک‌بار fail — rollback بعدی موفق شود */
        try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
      };
      setData('ptf_crm_settings', { keep: 'old' });
      setData('ptf_crm_customers', [{ cd: 'OLD' }]);
      var backupJ = { app: 'PTF-CRM', data: { ptf_crm_settings: JSON.stringify({ keep: 'new' }), ptf_crm_customers: JSON.stringify([{ cd: 'NEW' }]) }, tFa: '1405/05/01' };
      failNext = true;
      var _reloadBefore = global._reloaded;
      global._alerts = [];
      /* doRestore داخلی — با فراخوانی از مسیر عمومی‌تر (تست مستقیم تابع از طریق export نشده؛
         به‌جایش رفتار را با ساختار کد بررسی می‌کنیم) */
      /* برای تست واقعی rollback، doRestore را با استخراج از سورس صدا می‌زنیم */
      T('doRestore در سورس موجود است و rollback دارد', bak.indexOf('ROLLBACK کامل') > -1 && bak.indexOf('بازگردانی ناموفق — حافظهٔ محلی ظرفیت') > -1 && bak.indexOf('prev[k]') > -1);
      window.ptfBackupRestore(backupJ);
      setTimeout(function () {
        T('بعد از rollback: دادهٔ قبلی مشتری سالم است (OLD)', (getData('ptf_crm_customers') || [])[0].cd === 'OLD');
        T('بعد از rollback: تنظیمات قبلی سالم است (keep=old)', getData('ptf_crm_settings').keep === 'old');
        T('بعد از rollback: reload نشده (خطا اعلام شد)', !global._reloaded);
        global.ptfStorageSafeSetItem = oldSafe;

        SECTION('بازگردانی موفق (بدون rollback)');
        setData('ptf_crm_settings', { keep: 'old' });
        setData('ptf_crm_customers', [{ cd: 'OLD' }]);
        global._alerts = [];
        failNext = false;
        window.ptfBackupRestore(backupJ);
        setTimeout(function () {
          T('بازگردانی موفق: دادهٔ جدید نوشته شد', (getData('ptf_crm_customers') || [])[0].cd === 'NEW' && getData('ptf_crm_settings').keep === 'new');
          T('سرور: ptf_rotate_backup مشترک + save_backup_delta + needFull', php.indexOf('function ptf_rotate_backup') > -1 && php.indexOf("case 'save_backup_delta':") > -1 && php.indexOf("'needFull' => true") > -1 && php.indexOf("foreach ($j['delta'] as $k => $v)") > -1);
          DONE('tester296-backup-phase2');
        }, 60);
      }, 60);
    }, 60);
  }, 60);
}, 60);
