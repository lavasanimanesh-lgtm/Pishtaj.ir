#!/usr/bin/env node
'use strict';
/* tester550 — v34.8.50 (PHANTOM-STORAGE): مرورگری که setItem را بی‌خطا می‌پذیرد اما
   مقدار را نگه نمی‌دارد (خواندن بلافاصله null — مشاهدهٔ واقعی روی staging با
   مرورگر مالک ۱۴۰۵/۶/۷). قرارداد: تصمیم SS/LS/حافظه فقط با «خواندن-بازِ» مقدار
   واقعی، نه صرفِ نبودِ exception؛ و ptfAuthMigrate هرگز کلید LS را وقتی SS فانتوم/
   مسدود است حذف نکند (قبلاً توکن برای همیشه گم می‌شد). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var rb = fs.readFileSync(path.join(ROOT, 'crm/rbac.js'), 'utf8');

T('LoginWrite: خواندن-باز توکن در SS (throw phantom)', rb.indexOf("if (sessionStorage.getItem('ptf_crm_token') !== String(token || '')) throw new Error('phantom');") > -1);
T('LoginWrite: خواندن-باز توکن در LS', rb.indexOf("if (localStorage.getItem('ptf_crm_token') !== String(token || '')) throw new Error('phantom');") > -1);
T('SessionStore: خواندن-باز نشست در SS و LS', rb.indexOf("if (sessionStorage.getItem('ptf_crm_session') !== raw) throw new Error('phantom');") > -1 && rb.indexOf("if (localStorage.getItem('ptf_crm_session') !== raw) throw new Error('phantom');") > -1);
T('Migrate: حذف LS فقط بعد از تأیید نگه‌داشتِ SS', (function () { var i = rb.indexOf('function ptfAuthMigrate()'); var seg = rb.slice(i, rb.indexOf('function ptfAuthToken')); var iVerify = seg.indexOf("if (sessionStorage.getItem(_k) !== _v) continue;"); var iRm = seg.indexOf('localStorage.removeItem(_k)', iVerify); return iVerify > -1 && iRm > iVerify; })());
T('نشانگر PHANTOM-STORAGE', rb.indexOf('PHANTOM-STORAGE') > -1);

function sliceFn(src, header) {
  var i = src.indexOf(header); if (i < 0) throw new Error('anchor: ' + header);
  var depth = 0, seen = false;
  for (var j = i; j < Math.min(i + 25000, src.length); j++) {
    var c = src[j];
    if (c === '{') { depth++; seen = true; }
    else if (c === '}') { depth--; if (seen && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced');
}
var src = [rb.match(/var PTF_AUTH_KEYS\s*=\s*\[[^\]]*\];/)[0], rb.match(/var PTF_SESS_MEM\s*=\s*\{[^}]*\};/)[0],
  sliceFn(rb, 'function ptfSessMemWarnOnce('), sliceFn(rb, 'function ptfAuthMigrate()'), sliceFn(rb, 'function ptfAuthToken()'),
  sliceFn(rb, 'function ptfAuthCookieOk()'), sliceFn(rb, 'function ptfAuthOk()'), sliceFn(rb, 'function ptfAuthSession()'),
  sliceFn(rb, 'function ptfAuthSessionStore('), sliceFn(rb, 'function ptfAuthLoginWrite('), sliceFn(rb, 'function ptfAuthClear()'),
  sliceFn(rb, 'function ptfAuthSessionRestore(')].join('\n\n');

/* شبیه‌سازی فانتوم: SS می‌نویسد بی‌خطا، خواندن همیشه null */
var sb = {
  localStorage: (function () { var m = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m }; })(),
  sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); },
  ptfToast: function () {}, Promise: Promise, JSON: JSON, console: console, setTimeout: setTimeout
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(src + '\nglobalThis.__w = ptfAuthLoginWrite; globalThis.__tok = ptfAuthToken; globalThis.__sess = ptfAuthSession; globalThis.__ok = ptfAuthOk; globalThis.__ls = localStorage._m;', sb);
setTimeout(function () {
  sb.__w('PH-TOKEN', 'admin', { user: 'admin', role: 'admin' });
  T('رفتاری: توکن در LS ماند (SS فانتوم)', sb.__ls['ptf_crm_token'] === 'PH-TOKEN');
  T('رفتاری: نشست در LS ماند', (JSON.parse(sb.__ls['ptf_crm_session'] || '{}').user === 'admin'));
  T('رفتاری: ptfAuthToken از LS', sb.__tok() === 'PH-TOKEN');
  T('رفتاری: ptfAuthSession از LS', sb.__sess().user === 'admin');
  T('رفتاری: ptfAuthOk', sb.__ok() === true);
  for (var i = 0; i < 3; i++) sb.__tok();
  T('رفتاری: migrate توکن LS را نگه داشت', sb.__ls['ptf_crm_token'] === 'PH-TOKEN');
  console.log('\n== tester550: ' + p + ' PASS / ' + f + ' FAIL ==');
  process.exit(f ? 1 : 0);
}, 10);
