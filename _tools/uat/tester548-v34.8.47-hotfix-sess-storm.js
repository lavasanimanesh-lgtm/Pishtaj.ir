#!/usr/bin/env node
'use strict';
/* tester548 — v34.8.47 (HOTFIX-SESS-STORM): رفع حلقهٔ بی‌نهایت بازسازی نشست
   ریشه: اگر نوشتن sessionStorage بیندازد (مرورگر خصوصی/مسدود دادهٔ سایت)،
   ptfAuthLoginWrite بی‌صدا شکست می‌خورد → showCrm نشست را نمی‌بیند → با کوکیِ
   معتبر ptfAuthSessionRestore را صدا می‌زند → ذخیرهٔ SS باز می‌اندازد →
   showCrm ↔ restore به‌طور بی‌نهایت = توفان role_verify بدون رفرش + پیام
   گمراه‌کنندهٔ «توکن معتبر وجود ندارد». کاربر واقعی روی staging قفل شد.
   قرارداد fix: (۱) fallback نوشتن نشست/توکن به localStorage وقتی SS می‌اندازد
   (ptfAuthToken/ptfAuthSession هر دو LS را می‌خوانند) + toast هشدار یک‌بار؛
   (۲) سقف ۳ تلاش بازسازی در showCrm؛ پس از سقف، پیام شفاف «مسدودی مرورگر»؛
   (۳) هیچ کلید fallback LS پاک نمی‌شود وقتی SS در دسترس نیست. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var rb = read('crm/rbac.js');
var ih = read('crm/index.html');

/* ═══ ۱) قرارداد منبع — rbac.js ═══ */
T('ptfAuthSessionStore: نوشتن SS با try/catch و fallback به LS', (function () { var i = rb.indexOf('function ptfAuthSessionStore(sess)'); var seg = rb.slice(i, rb.indexOf('function ptfAuthLoginWrite')); return seg.indexOf("try { sessionStorage.setItem('ptf_crm_session', raw);") > -1 && seg.indexOf("localStorage.setItem('ptf_crm_session', raw);") > -1; })());
T('ptfAuthSessionStore: پاک‌کردن LS فقط وقتی SS موفق بود', (function () { var i = rb.indexOf('function ptfAuthSessionStore(sess)'); var seg = rb.slice(i, rb.indexOf('function ptfAuthLoginWrite')); var iOk = seg.indexOf('localStorage.removeItem(\'ptf_crm_session\')'); return iOk > -1 && iOk < seg.indexOf('return; } catch'); })());
T('ptfAuthLoginWrite: تشخیص خرابی SS (_ssOk) و نوشتن توکن در LS', rb.indexOf('var _ssOk = true;') > -1 && rb.indexOf("localStorage.setItem('ptf_crm_token', String(token || ''));") > -1);
T('ptfAuthLoginWrite: کلیدهای LS فقط در حالت SS-سالم پاک می‌شوند', (function () { var i = rb.indexOf('function ptfAuthLoginWrite(token, role, sess)'); var seg = rb.slice(i, rb.indexOf('function ptfAuthClear')); var iGuard = seg.indexOf('if (_ssOk)'); var iLoop = seg.indexOf('for (var _lk = 0'); return iGuard > -1 && iLoop > iGuard; })());
T('هشدار یک‌بارمصرف toast (خواندنی برای کاربر)', rb.indexOf('اجازهٔ ذخیرهٔ نشست (sessionStorage) نمی‌دهد') > -1);
T('HOTFIX-SESS-STORM در rbac.js نشانگر خورده', rb.indexOf('HOTFIX-SESS-STORM') > -1);

/* ═══ ۲) قرارداد منبع — index.html (سقف حلقه) ═══ */
T('showCrm: شمارندهٔ تلاش بازسازی (_ptfSessRestoreTries)', ih.indexOf('_ptfSessRestoreTries') > -1);
T('showCrm: سقف ۳ تلاش و توقف بدون بازگردشت بی‌نهایت', (function () { var i = ih.indexOf('window._ptfSessRestoreTries = (window._ptfSessRestoreTries || 0) + 1;'); var seg = ih.slice(i, i + 700); return seg.indexOf('> 3') > -1 && seg.indexOf('return;') > -1; })());
T('showCrm: پیام شفاف مسدودی مرورگر (نه «توکن معتبر وجود ندارد»)', (function () { var i = ih.indexOf('بازسازی نشست بی‌نتیجه بود'); return i > -1 && ih.indexOf('sessionStorage/localStorage') > -1; })());

/* ═══ ۳) رفتاری — vm: مرورگر با SS مسدود ═══ */
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
var m = rb.match(/var PTF_AUTH_KEYS\s*=\s*\[[^\]]*\];/);
var src = [m[0],
  sliceFn(rb, 'function ptfAuthToken()'), sliceFn(rb, 'function ptfAuthCookieOk()'), sliceFn(rb, 'function ptfAuthOk()'),
  sliceFn(rb, 'function ptfAuthSession()'), sliceFn(rb, 'function ptfAuthSessionStore('), sliceFn(rb, 'function ptfAuthLoginWrite('),
  sliceFn(rb, 'function ptfAuthClear()'), sliceFn(rb, 'function ptfAuthSessionRestore('),
  sliceFn(ih, 'function ptfInvalidateSession(msg)'), sliceFn(ih, 'function showCrm()')].join('\n\n')
  + '\nfunction loadAll(){}\nfunction verifyRoleFromServer(cb){ cb && cb({ok:true}); }\nfunction usersPullFromServer(cb){ cb && cb({ok:true}); }\nfunction renderUsers2(){}';

var LSstore = {};
var sb = {
  localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(LSstore, k) ? LSstore[k] : null; }, setItem: function (k, v) { LSstore[k] = String(v); }, removeItem: function (k) { delete LSstore[k]; } },
  sessionStorage: { getItem: function () { return null; }, setItem: function () { throw new Error('QuotaExceededError'); }, removeItem: function () {} },
  document: { getElementById: function (id) { if (!sb._els[id]) sb._els[id] = { id: id, style: {}, textContent: '', innerHTML: '', setAttribute: function () {} }; return sb._els[id]; }, cookie: 'ptf_token_flag=1' },
  fetch: function (url) { if (url.indexOf('role_verify') > -1) { sb._rv++; return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, user: 'admin', name: 'admin', role: 'admin' }); } }); } return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); },
  ptfToast: function () {},
  window: {},
  Promise: Promise, JSON: JSON, console: console, setTimeout: setTimeout
};
sb._els = {}; sb._rv = 0; sb.window = sb; sb._ptfSessRestore = false; sb._ptfSessRestoreTries = 0;
vm.createContext(sb);
vm.runInContext(src + '\nglobalThis.__w = ptfAuthLoginWrite; globalThis.__sess = ptfAuthSession; globalThis.__ok = ptfAuthOk; globalThis.__show = showCrm;', sb);

setTimeout(function () {
  sb.__w('THE-TOKEN', 'admin', { user: 'admin', name: 'admin', role: 'admin', roleId: 'admin' });
  T('رفتاری: توکن در LS نوشته شد (SS مسدود)', LSstore['ptf_crm_token'] === 'THE-TOKEN');
  T('رفتاری: نشست در LS نوشته شد و خوانده شد', sb.__sess().user === 'admin');
  T('رفتاری: ptfAuthOk با fallback LS', sb.__ok() === true);

  sb._ptfSessRestoreTries = 0; sb._rv = 0;
  Promise.resolve(sb.__show()).then(function () {
    setTimeout(function () {
      T('رفتاری: showCrm بدون توفان role_verify (≤۲ فراخوانی)', sb._rv <= 2, 'count=' + sb._rv);
      T('رفتاری: وارد CRM شد (crmL نمایان)', sb._els['crmL'] && sb._els['crmL'].style.display !== 'none');

      /* بدترین حالت: LS هم مسدود → سقف ۳ و پیام شفاف */
      sb._rv = 0; sb._ptfSessRestoreTries = 0; sb._ptfSessRestore = false; delete sb._els['lerr'];
      LSstore = {};
      sb.localStorage.setItem = function () { throw new Error('blocked'); };
      Promise.resolve(sb.__show()).then(function () {
        setTimeout(function () {
          T('رفتاری: بدترین حالت — سقف تلاش‌ها (≤۳ role_verify، بدون توفان)', sb._rv <= 3, 'count=' + sb._rv);
          T('رفتاری: پیام شفاف مسدودی مرورگر', sb._els['lerr'] && sb._els['lerr'].textContent.indexOf('مسدود') > -1, sb._els['lerr'] ? sb._els['lerr'].textContent : '');
          console.log('\n== tester548: ' + p + ' PASS / ' + f + ' FAIL ==');
          process.exit(f ? 1 : 0);
        }, 80);
      });
    }, 60);
  });
}, 10);
