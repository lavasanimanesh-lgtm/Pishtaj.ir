#!/usr/bin/env node
'use strict';
/* tester549 — v34.8.48 (COOKIE-ONLY-MODE): ورود حتی وقتی هر دو مخزن SS/LS مسدودند
   ادامهٔ هات‌فیکس ۴۷: مرورگر واقعی کاربر (webview پیام‌رسان/پنجرهٔ خصوصی/سهمیهٔ پر)
   هر دو sessionStorage و localStorage را می‌بندد → هات‌فیکس ۴۷ پیام شفاف می‌داد ولی
   کاربر همچنان بی‌ورود می‌ماند. قرارداد ۴۸: آخرین fallback = حافظهٔ همین تب
   (PTF_SESS_MEM) — نشست/توکن در حافظهٔ صفحه زنده می‌ماند و ورود با کوکی HttpOnly
   کامل می‌شود (قرارداد v34.8.43: نبود توکن JS ≠ نبود نشست). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var rb = read('crm/rbac.js');
var ih = read('crm/index.html');

/* ═══ ۱) قرارداد منبع ═══ */
T('PTF_SESS_MEM تعریف شد (حافظهٔ تب)', /var PTF_SESS_MEM = \{ token: '', role: '', session: null \};/.test(rb));
T('هشدار یک‌بارمصرف (ptfSessMemWarnOnce + گارد window)', rb.indexOf('function ptfSessMemWarnOnce(') > -1 && rb.indexOf('window._ptfSessMemWarned') > -1);
T('ptfAuthToken: خوانش از حافظه به‌عنوان آخرین fallback', rb.indexOf("if (PTF_SESS_MEM.token) return PTF_SESS_MEM.token;") > -1);
T('ptfAuthSession: خوانش نشست از حافظه', rb.indexOf('if (PTF_SESS_MEM.session && PTF_SESS_MEM.session.user) return PTF_SESS_MEM.session;') > -1);
T('ptfAuthSessionStore: زنجیرهٔ SS → LS → حافظهٔ تب', (function () { var i = rb.indexOf('function ptfAuthSessionStore(sess)'); var seg = rb.slice(i, rb.indexOf('function ptfAuthLoginWrite')); return seg.indexOf("sessionStorage.setItem('ptf_crm_session'") > -1 && seg.indexOf("localStorage.setItem('ptf_crm_session'") > -1 && seg.indexOf('PTF_SESS_MEM.session = sess || null;') > -1; })());
T('ptfAuthLoginWrite: توکن در حافظهٔ تب وقتی LS هم مسدود است', (function () { var i = rb.indexOf('function ptfAuthLoginWrite(token, role, sess)'); var seg = rb.slice(i, rb.indexOf('function ptfAuthClear')); return seg.indexOf('PTF_SESS_MEM.token = String(token'); })() > -1);
T('پیام هشدار حالت حافظه‌ای برای کاربر خواندنی است', rb.indexOf('نشست فقط تا بسته‌شدن همین صفحه در حافظه می‌ماند') > -1);
T('نشانگر COOKIE-ONLY-MODE', rb.indexOf('COOKIE-ONLY-MODE') > -1);
T('سقف ضدتوفان ۴۷ دست‌نخورده ماند', ih.indexOf('_ptfSessRestoreTries') > -1 && ih.indexOf('> 3') > -1);

/* ═══ ۲) رفتاری — هر دو مخزن مسدود ═══ */
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
var src = [rb.match(/var PTF_AUTH_KEYS\s*=\s*\[[^\]]*\];/)[0],
  rb.match(/var PTF_SESS_MEM\s*=\s*\{[^}]*\};/)[0],
  sliceFn(rb, 'function ptfSessMemWarnOnce('),
  sliceFn(rb, 'function ptfAuthMigrate()'), sliceFn(rb, 'function ptfAuthToken()'), sliceFn(rb, 'function ptfAuthCookieOk()'),
  sliceFn(rb, 'function ptfAuthOk()'), sliceFn(rb, 'function ptfAuthHeaders('), sliceFn(rb, 'function ptfAuthSession()'),
  sliceFn(rb, 'function ptfAuthSessionStore('), sliceFn(rb, 'function ptfAuthLoginWrite('), sliceFn(rb, 'function ptfAuthClear()'),
  sliceFn(rb, 'function ptfAuthSessionRestore('),
  sliceFn(ih, 'function ptfInvalidateSession(msg)'), sliceFn(ih, 'function showCrm()')].join('\n\n')
  + '\nfunction loadAll(){}\nfunction verifyRoleFromServer(cb){ cb && cb({ok:true}); }\nfunction usersPullFromServer(cb){ cb && cb({ok:true}); }\nfunction renderUsers2(){}';

var sb = {
  sessionStorage: { getItem: function () { return null; }, setItem: function () { throw new Error('blocked'); }, removeItem: function () {} },
  localStorage: { getItem: function () { return null; }, setItem: function () { throw new Error('blocked'); }, removeItem: function () {} },
  document: { getElementById: function (id) { if (!sb._els[id]) sb._els[id] = { id: id, style: {}, textContent: '', innerHTML: '', setAttribute: function () {} }; return sb._els[id]; }, cookie: 'ptf_token_flag=1' },
  fetch: function (url) { if (url.indexOf('role_verify') > -1) { sb._rv++; return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, user: 'admin', name: 'مدیر', role: 'admin' }); } }); } return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); },
  ptfToast: function (m) { sb._toasts.push(m); },
  Promise: Promise, JSON: JSON, console: console, setTimeout: setTimeout
};
sb._els = {}; sb._rv = 0; sb._toasts = []; sb.window = sb; sb._ptfSessRestore = false; sb._ptfSessRestoreTries = 0; sb._ptfSessMemWarned = false;
vm.createContext(sb);
vm.runInContext(src + '\nglobalThis.__w = ptfAuthLoginWrite; globalThis.__tok = ptfAuthToken; globalThis.__sess = ptfAuthSession; globalThis.__ok = ptfAuthOk; globalThis.__show = showCrm; globalThis.__mem = PTF_SESS_MEM;', sb);

setTimeout(function () {
  sb.__w('MEM-TOKEN', 'admin', { user: 'admin', name: 'مدیر', role: 'admin', roleId: 'admin' });
  T('رفتاری: توکن از حافظهٔ تب خوانده شد', sb.__tok() === 'MEM-TOKEN', sb.__tok());
  T('رفتاری: نشست از حافظهٔ تب خوانده شد', sb.__sess().user === 'admin');
  T('رفتاری: ptfAuthOk در حالت بدون مخزن', sb.__ok() === true);
  T('رفتاری: هشدار فقط یک‌بار', sb._toasts.length === 1, 'toasts=' + sb._toasts.length);

  sb._rv = 0;
  Promise.resolve(sb.__show()).then(function () {
    setTimeout(function () {
      T('رفتاری: showCrm با نشست حافظه‌ای وارد شد', sb._els['crmL'] && sb._els['crmL'].style.display !== 'none');
      T('رفتاری: بدون role_verify اضافی (count=0)', sb._rv === 0, 'count=' + sb._rv);

      /* تبِ تازه: فقط کوکی → restore → حافظه → وارد */
      sb.__mem.token = ''; sb.__mem.session = null; sb._rv = 0;
      sb._ptfSessRestore = false; sb._ptfSessRestoreTries = 0; sb._ptfSessMemWarned = false;
      delete sb._els['lerr']; if (sb._els['crmL']) sb._els['crmL'].style.display = 'none';
      Promise.resolve(sb.__show()).then(function () {
        setTimeout(function () {
          T('رفتاری: تب تازه — بازسازی از کوکی به حافظهٔ تب', sb.__mem.session && sb.__mem.session.user === 'admin');
          T('رفتاری: تب تازه وارد CRM شد', sb._els['crmL'] && sb._els['crmL'].style.display !== 'none');
          T('رفتاری: دقیقاً ۱ role_verify (بدون توفان)', sb._rv === 1, 'count=' + sb._rv);
          T('رفتاری: پیام «بازسازی بی‌نتیجه» نیامد', !sb._els['lerr'] || !sb._els['lerr'].textContent, sb._els['lerr'] ? sb._els['lerr'].textContent : '');
          console.log('\n== tester549: ' + p + ' PASS / ' + f + ' FAIL ==');
          process.exit(f ? 1 : 0);
        }, 80);
      });
    }, 60);
  });
}, 10);
