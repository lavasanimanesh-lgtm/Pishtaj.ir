/* tester298 — v33.18.0 (DB-MIG-001 — فاز B): کلاینت نازک — سرور-محور
 * 1) client-server.js: هوک getData/setData فقط وقتی فعال است؛ صف آفلاین؛ flush؛ هم‌گرایی یک‌باره
 * 2) دکمه‌های تنظیمات (فعال‌سازی/هم‌گرایی/غیرفعال‌سازی)
 * 3) client-server.js در index.html لود می‌شود (بعد از sync.js)
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
global.alert = function () {};
global.confirm = function () { return true; };
global.ptfToast = function () {};
global.location = { reload: function () {} };
global.ptfSyncNotifyDirty = function () {};
global._pushCalls = [];
global.fetch = function (url, opts) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (/data_push/.test(url)) { global._pushCalls.push(opts.body || ''); resolve({ json: function () { return Promise.resolve({ ok: true }); } }); }
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
T('فعال‌سازی + پرچم + هم‌گرایی (پس از flush, پرچم flushed)', (function () {
  localStorage.removeItem('ptf_b_phase');
  localStorage.removeItem('ptf_b_flushed_u1');
  /* قبل از فعال‌سازی، دادهٔ محلی موجود است */
  setData('ptf_crm_settings', { a: 2 });
  ptfBEnable();
  return localStorage.getItem('ptf_b_phase') === '1' && localStorage.getItem('ptf_b_flushed_u1') === '1';
})());

SECTION('صف آفلاین + flush');
T('setData در حالت فعال → صف پر می‌شود و push می‌رود', (function () {
  var before = global._pushCalls.length;
  setData('ptf_crm_settings', { a: 3 });
  var q = JSON.parse(localStorage.getItem('ptf_b_queue') || '{}');
  return !!q['ptf_crm_settings'];
})());
setTimeout(function () {
  T('پس از debounce (4s)، push به سرور رفت و صف خالی شد', (function () {
    return global._pushCalls.length > 0 && Object.keys(JSON.parse(localStorage.getItem('ptf_b_queue') || '{}')).length === 0;
  })());

  SECTION('غیرفعال‌سازی → رفتار قبلی');
  ptfBDisable();
  T('بعد از غیرفعال‌سازی، getData محلی است', (function () { setData('ptf_crm_settings', { a: 4 }); return getData('ptf_crm_settings').a === 4; })());

  SECTION('UI و لود');
  T('دکمه‌های فاز B در تنظیمات (فعال/هم‌گرایی/غیرفعال)', bak.indexOf('ptfBEnable()') > -1 && bak.indexOf('ptfBConfirmFlush()') > -1 && bak.indexOf('ptfBDisable()') > -1 && bak.indexOf('حالت سرور-محور (فاز B مهاجرت)') > -1);
  T('client-server.js بعد از sync.js لود می‌شود', idx.indexOf('sync.js?v=') < idx.indexOf('client-server.js?v='));
  T('گارد idempotent (double-load) دارد', cs.indexOf('__ptfClientServerLoaded') > -1);
  DONE('tester298-phase-b');
}, 4600);
