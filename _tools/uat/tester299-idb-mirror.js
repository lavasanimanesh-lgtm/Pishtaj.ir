/* tester299 — v33.20.0 (آینهٔ خالدار — PTF-B-IDB-MIRROR): کلیدهای سنگین → حافظهٔ نشست + IndexedDB
 * چرا: با فاز B فعال، sync.js آینهٔ کامل سرور را در localStorage می‌نوشت → ۸۰٪+ و پاک‌سازی کش بی‌اثر.
 * ۱) فعال‌سازی فقط با: فاز B + نشانگر هم‌گرایی موفق (ptf_b_synced_<user>) + IndexedDB موجود
 * ۲) ptfBMirror: سنگین‌ها (فهرست + خودکار >۱۲۰هزار کاراکتر) به حافظه/IDB می‌روند و از localStorage حذف می‌شوند
 * ۳) ptfBIdbPreload: مهاجرت نسخه‌های قدیمی localStorage → IDB هنگام بوت
 * ۴) getData/setData فاز B: سنگین‌ها از/به حافظه+IDB — localStorage خلوت
 * ۵) sync.js با rd/wr به حافظه وصل است (Even beacon beforeunload)
 * ۶) theme.avatarsAll از مسیری فاز‌B‌آگاه می‌خواند
 * ۷) ptfBDisable: برگرداندن کلیدهای سنگین به localStorage
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cs = fs.readFileSync(path.join(BASE, 'client-server.js'), 'utf-8');
var syn = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var thm = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');

global.window = global;
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'u2', name: 'رضا' }; };
global.ptfToast = function () {};
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global.confirm = function () { return true; };
global.prompt = function () { return 'پاک'; };
global.location = { reload: function () {} };
global.ptfSyncNotifyDirty = function () {};
global.addLog = function () {};
global.audit = function () {};

/* IndexedDB مجازی (هم‌امضا با storage-quota.js: idbSet(id,value,cb(ok,bytes)) / idbGet(id,cb(row))) */
global._idb = {};
global.indexedDB = { open: function () { return { fake: true }; } };
global.ptfStorageIdbSet = function (id, v, cb) { global._idb[id] = String(v); if (cb) cb(true, String(v).length); };
global.ptfStorageIdbGet = function (id, cb) { var v = global._idb[id]; if (cb) cb(v == null ? null : { id: id, value: v }); };

/* شبکهٔ مجازی سبک (فاز B) */
global.fetch = function (url) {
  return new Promise(function (res) {
    setTimeout(function () {
      if (/data_push/.test(url)) res({ json: function () { return Promise.resolve({ ok: true }); } });
      else if (/data_pull/.test(url)) res({ json: function () { return Promise.resolve({ ok: true, fresh: false, rev: 2, data: {} }); } });
      else res({ json: function () { return Promise.resolve({ ok: true }); } });
    }, 3);
  });
};
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, appendChild: function () {}, addEventListener: function () {} }; }, head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {} };

/* getData/setData پایه‌ای شبیه index.html */
function gd(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
function sd(k, d) { localStorage.setItem(k, JSON.stringify(d)); }
global.getData = gd; global.setData = sd;

eval.call(global, cs);

SECTION('گیت فعال‌سازی آینهٔ خالدار');
T('بدون فاز B → آینهٔ خالدار غیرفعال است', (function () {
  localStorage.removeItem('ptf_b_phase'); localStorage.removeItem('ptf_b_synced_u2');
  return window.ptfBMirrorActive() === false;
})());
T('فاز B فعال ولی بدون نشانگر هم‌گرایی موفق → هنوز غیرفعال (امن برای داده)', (function () {
  localStorage.setItem('ptf_b_phase', '1'); localStorage.removeItem('ptf_b_synced_u2');
  return window.ptfBMirrorActive() === false;
})());
T('فعال‌سازی کامل (فاز + هم‌گرایی موفق + IDB) → آینهٔ خالدار فعال', (function () {
  /* Finalize با localStorage خالی → payload خالی → flushed+synced به‌صورت همگام ست می‌شوند */
  localStorage.removeItem('ptf_b_phase');
  ptfBEnable();
  return localStorage.getItem('ptf_b_synced_u2') === '1' && window.ptfBMirrorActive() === true;
})());

SECTION('مهاجرت بوت: نسخه‌های localStorage → IDB');
T('ptfBIdbPreload کلید سنگین را از localStorage به حافظه/IDB می‌برد و آزاد می‌کند', (function () {
  localStorage.setItem('ptf_crm_avatars', '{"u2":"data:image/png;base64,AAA"}');
  var done = false;
  window.ptfBIdbPreload(function () { done = true; });
  var memOk = (function () { try { return JSON.parse(getData('ptf_crm_avatars') === undefined ? '{}' : JSON.stringify(getData('ptf_crm_avatars'))).u2 === 'data:image/png;base64,AAA'; } catch (e) { return false; } })();
  return done === true &&
    localStorage.getItem('ptf_crm_avatars') === null &&
    global._idb['bdata:ptf_crm_avatars'] === '{"u2":"data:image/png;base64,AAA"}' &&
    memOk;
})());
T('کلید سبک در بوت دست‌نخورده در localStorage می‌ماند', (function () {
  setData('ptf_crm_settings', { a: 1 });
  return localStorage.getItem('ptf_crm_settings') === '{"a":1}' && !global._idb['bdata:ptf_crm_settings'];
})());

SECTION('نام‌گذاری سنگین: فهرست + خودکار');
T('isHeavyKey: کلیدهای فهرست‌شده سنگین‌اند', window.ptfBIsHeavyKey('ptf_crm_avatars') === true && window.ptfBIsHeavyKey('ptf_crm_inqreads') === true);
T('self: کلیدی با >۱۲۰هزار کاراکتر خودکار سنگین می‌شود (ptfBMirror/brخ)', (function () {
  var big = '[' + new Array(130001).join('x') + ']';
  var ok = window.ptfBMirror('ptf_crm_brandnewbig', big);
  return ok === true && localStorage.getItem('ptf_crm_brandnewbig') === null && typeof global._idb['bdata:ptf_crm_brandnewbig'] === 'string';
})());

SECTION('ptfBMirror / ptfBRead');
T('ptfBMirror کلید سنگین را می‌نویسد (نه localStorage) و ptfBRead همان را می‌خواند', (function () {
  var ok = window.ptfBMirror('ptf_crm_letters', '[{"x":1}]');
  return ok === true && localStorage.getItem('ptf_crm_letters') === null &&
         window.ptfBRead('ptf_crm_letters') === '[{"x":1}]' && global._idb['bdata:ptf_crm_letters'] === '[{"x":1}]';
})());
T('کلید سبک به localStorage برمی‌گردد (ptfBMirror=false)', (function () {
  return window.ptfBMirror('ptf_crm_settings', '{"a":2}') === false;
})());

SECTION('getData/setData فاز B با سنگین‌ها');
T('setData روی کلید سنگین → حافظه/IDB + صف ارسال؛ localStorage خالی می‌ماند', (function () {
  setData('ptf_crm_packinglists', [{ p: 1 }]);
  var q = JSON.parse(localStorage.getItem('ptf_b_queue') || '{}');
  var v = getData('ptf_crm_packinglists');
  return localStorage.getItem('ptf_crm_packinglists') === null &&
         typeof global._idb['bdata:ptf_crm_packinglists'] === 'string' &&
         Array.isArray(v) && v.length === 1 && v[0].p === 1 && !!q['ptf_crm_packinglists'];
})());
T('getData روی کلید سنگین فقط از حافظه می‌خواند (بدون async)', (function () {
  var v = getData('ptf_crm_letters');
  return Array.isArray(v) && v.length === 1 && v[0].x === 1 && localStorage.getItem('ptf_crm_letters') === null;
})());

SECTION('یکپارچگی sync.js + theme.js');
T('sync.js باید helper rd/wr داشته باشد و مسیرهای آینه را از حافظه بخواند/بنویسد', (function () {
  var rd = (syn.match(/rd\(k\)/g) || []).length;
  var wrMerged = syn.indexOf('wr(k, newStr)') > -1 && syn.indexOf('wr(k, merged)') > -1 && syn.indexOf('wr(k, startupMerged)') > -1;
  var helpers = syn.indexOf('function rd(k)') > -1 && syn.indexOf('function wr(k, s)') > -1;
  var beacon = syn.indexOf('keys.forEach(function (k) { var v = rd(k); if (v !== null) data[k]') > -1;
  var noBare = syn.indexOf('localStorage.setItem(k, newStr)') === -1;
  return helpers && wrMerged && beacon && noBare && rd >= 10;
}, 'rd=' + (syn.match(/rd\(k\)/g) || []).length));
T('theme.avatarsAll در فاز B از getData می‌خواند (آواتار از حافظه، بدون localStorage)', (function () {
  if (thm.indexOf('ptfBMirrorActive') === -1) return false;
  var m = thm.match(/function avatarsAll\(\) \{[\s\S]*?\n  \}\n/);
  if (!m) return false;
  eval('global.avatarsAll = ' + m[0].replace('function avatarsAll()', 'function avatarsAll()'));
  /* localStorage فاقد آواتار است (در بخش preload به IDB رفت) ولی حافظه نسخه دارد */
  var all = global.avatarsAll();
  return all && all.u2 === 'data:image/png;base64,AAA' && localStorage.getItem('ptf_crm_avatars') === null;
})());

SECTION('غیرفعال‌سازی → برگرداندن امن داده');
setTimeout(function () {
  T('ptfBDisable کلیدهای سنگین را به localStorage برمی‌گرداند (سازگاری حالت قدیمی)', (function () {
    ptfBDisable();
    return localStorage.getItem('ptf_crm_avatars') === '{"u2":"data:image/png;base64,AAA"}' &&
           typeof localStorage.getItem('ptf_crm_packinglists') === 'string' &&
           localStorage.getItem('ptf_b_phase') === null;
  })());
  DONE('tester299-idb-mirror');
}, 500);
