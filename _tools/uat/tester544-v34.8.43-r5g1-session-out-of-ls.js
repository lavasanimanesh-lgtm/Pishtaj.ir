#!/usr/bin/env node
'use strict';
/* tester544 — v34.37.5 (R5/T4-1b — SESSION-OUT-OF-LS): توکن/نشست خارج از localStorage
   قرارداد: توکن نشست از این نسخه در sessionStorage (فقط همین تب) نگه داشته می‌شود و
   کوکی HttpOnlyِ ptf_token (از v34.8.28) کانال مشترک تب‌هاست؛ سرور در نبود هدر
   X-CRM-Token از کوکی می‌پذیرد. مهاجرت یک‌بارهٔ بوت: LS→SS سپس حذف LS؛ بازسازی نشست
   تبِ تازه با role_verify (کوکی)؛ نشانگر غیرمحرم ptf_token_flag=1 برای گیت‌های
   «نشست داریم؟» (ptfAuthOk). خروج از LS = راز در LS نمی‌ماند؛ بک‌آپ‌ها هم دیگر
   توکن ندارند. ابزارهای ریکاوری HTML بدون تغییر کار می‌کنند (کوکی fallback).
   پوشش: قرارداد منبع (rbac/index/api/registry + جاروی ۱۹ فایل) + رفتاری (vm:
   مهاجرت، بازسازی، کوکی‌نشانگر، هدرساز، پاک‌سازی، گارد بازگشتی ptfAuthToken). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var rbac = read('crm/rbac.js');
var idx = read('crm/index.html');
var api = read('api/crm.php');
var sy = read('crm/sync.js');
var kr = read('crm/key-registry.js');

/* ═══ ۱) لایهٔ ptfAuth در rbac.js ═══ */
T('PTF_AUTH_KEYS سه کلید نشست را پوشش می‌دهد', /var PTF_AUTH_KEYS = \['ptf_crm_token', 'ptf_crm_token_role', 'ptf_crm_session'\];/.test(rbac));
T('نه تابع ptfAuth* تعریف شدند', ['ptfAuthToken','ptfAuthCookieOk','ptfAuthOk','ptfAuthHeaders','ptfAuthSession','ptfAuthSessionStore','ptfAuthLoginWrite','ptfAuthClear','ptfAuthSessionRestore'].every(function (n) { return rbac.indexOf('function ' + n + '(') > -1; }));
T('ptfAuthToken: مخزن اصلی sessionStorage + مهاجرت LS→SS', /var t = sessionStorage\.getItem\('ptf_crm_token'\);[\s\S]{0,420}ptfAuthMigrate\(\); return l;/.test(rbac));
T('گارد بازگشتی: خوانش LS داخل خود ptfAuthToken مستقیم است (نه فراخوانی خود)', /function ptfAuthToken\(\) \{[\s\S]{0,400}?try \{ l = localStorage\.getItem\('ptf_crm_token'\); \} catch \(eL2\) \{\}[\s\S]{0,120}?ptfAuthMigrate/.test(rbac) && !/l = \(typeof ptfAuthToken === 'function' \? ptfAuthToken\(\)/.test(rbac));
T('مهاجرت: حذف LS فقط بعد از تأیید نگه‌داشتِ SS (v34.37.5)', /sessionStorage\.setItem\(_k, _v\);[\s\S]{0,120}if \(sessionStorage\.getItem\(_k\) !== _v\) continue;[\s\S]{0,80}localStorage\.removeItem\(_k\);/.test(rbac));
T('ptfAuthCookieOk: نشانگر غیرمحرم ptf_token_flag=1', /ptf_token_flag=1/.test(rbac) && /function ptfAuthCookieOk\(\)/.test(rbac));
T('ptfAuthOk = توکن SS یا نشانگر کوکی', /function ptfAuthOk\(\) \{ return !!ptfAuthToken\(\) \|\| ptfAuthCookieOk\(\); \}/.test(rbac));
T('ptfAuthSessionRestore: role_verify → نشست SS', /action=role_verify[\s\S]{0,300}?ptfAuthSessionStore\(\{ user: d\.user/.test(rbac));
T('curSession ابتدا SS سپس fallback LS', /function curSession\(\) \{[\s\S]{0,220}?sessionStorage\.getItem\('ptf_crm_session'\)[\s\S]{0,200}?localStorage\.getItem\('ptf_crm_session'\)/.test(rbac));

/* ═══ ۲) جاروی خواننده‌ها ═══ */
var jsFiles = fs.readdirSync(path.join(ROOT, 'crm')).filter(function (x) { return x.endsWith('.js'); });
var directReads = [];
jsFiles.forEach(function (x) {
  var t = fs.readFileSync(path.join(ROOT, 'crm', x), 'utf8');
  var m = t.match(/localStorage\.getItem\('ptf_crm_token'\)/g);
  if (m) directReads.push(x + ':' + m.length);
});
T('خوانش مستقیم LS توکن فقط در rbac.js (مهاجرت + خواندن-بازِ v34.37.5)', directReads.length === 1 && directReads[0] === 'rbac.js:2', JSON.stringify(directReads));
T('نوشتن LS توکن فقط fallback خرابی SS (هات‌فیکس v34.37.5)', jsFiles.every(function (x) {
  if (x === 'rbac.js') return true; /* فقط rbac.js و فقط داخل شاخهٔ _ssOk=false */
  return !/localStorage\.setItem\('ptf_crm_(token|token_role)'/.test(fs.readFileSync(path.join(ROOT, 'crm', x), 'utf8'));
}) && (function () {
  var rb = fs.readFileSync(path.join(ROOT, 'crm', 'rbac.js'), 'utf8');
  var hits = rb.match(/localStorage\.setItem\('ptf_crm_(token|token_role)'/g) || [];
  if (hits.length !== 2) return false;
  var iElse = rb.indexOf('} else {', rb.indexOf('var _ssOk = true;'));
  var iFirst = rb.indexOf("localStorage.setItem('ptf_crm_token'", iElse);
  return iElse > -1 && iFirst > iElse; /* فقط بعد از شاخهٔ خرابی SS */
})());
var guarded = 0;
jsFiles.forEach(function (x) { var t = fs.readFileSync(path.join(ROOT, 'crm', x), 'utf8'); guarded += (t.match(/\(typeof (window\.)?ptfAuthToken === 'function' \? \1?ptfAuthToken\(\) : ''\)/g) || []).length; });
T('خواننده‌ها همه گاردشده به ptfAuthToken مهاجرت کردند (≥ 20)', guarded >= 20, String(guarded));
T('sync.js: hasSyncToken مسیر کوکی را می‌پذیرد (ptfAuthOk)', /function hasSyncToken\(\) \{[\s\S]{0,640}window\.ptfAuthOk\(\)\) return true;[\s\S]{0,160}ptfAuthToken === 'function' \? ptfAuthToken\(\)/.test(sy));
T('sync.js: گیت collectionQuery با ptfAuthOk (کوکی کافی است)', /var _sessOk = \(typeof window\.ptfAuthOk === 'function'\) \? window\.ptfAuthOk\(\) : !!t;/.test(sy));
T('sync.js: refreshAuthToken هر دو مخزن را پاک می‌کند', /window\.ptfAuthClear === 'function'\) window\.ptfAuthClear\(\)/.test(sy));
T('inqreader: مسیر 401 هر دو مخزن را پاک می‌کند', /window\.ptfAuthClear === 'function'\) window\.ptfAuthClear\(\); \} catch \(eAc\) \{\}\s*localStorage\.removeItem\('ptf_crm_session'\);/.test(read('crm/inqreader.js')));
T('ui-kit: اینترسپتور fetch گاردشده از ptfAuthToken', /var tok = \(typeof ptfAuthToken === 'function' \? ptfAuthToken\(\) : ''\);/.test(read('crm/ui-kit.js')));

/* ═══ ۳) index.html — ورود/خروج/بوت ═══ */
T('سه مسیر ورود همه ptfAuthLoginWrite (صفر setItem LS توکن)', (idx.match(/ptfAuthLoginWrite\(/g) || []).length === 3 && !/localStorage\.setItem\('ptf_crm_token'/.test(idx));
T('گیت showCrm: تبِ تازه با کوکی → بازسازی نشست', /ptfAuthCookieOk === 'function''\) && ptfAuthCookieOk\(\)/.test(idx.replace(/\' \+ \'/g, '')) || /ptfAuthCookieOk\(\) && !window\._ptfSessRestore/.test(idx));
T('گیت showCrm: توکن = ptfAuthOk', /var _tokOk = \(typeof ptfAuthOk === 'function'\) \? ptfAuthOk\(\) : !!localStorage\.getItem\('ptf_crm_token'\);/.test(idx));
T('auto-login: نشست یا نشانگر کوکی', /s\.user \|\| \(\(typeof ptfAuthCookieOk === 'function'\) && ptfAuthCookieOk\(\)\)/.test(idx));
T('doLogout: POST همیشه (کوکی) + ptfAuthClear', /fetch\('\.\.\/api\/crm\.php\?action=auth_logout', \{ method: 'POST', headers: _tok \? \{ 'X-CRM-Token': _tok \} : \{\}, keepalive: true \}\)/.test(idx) && /ptfAuthClear === 'function'\) ptfAuthClear\(\); \} catch \(eAc2\)/.test(idx));
T('ptfSafeReset + ptfInvalidateSession: پاک‌سازی دو مخزن', (idx.match(/ptfAuthClear === 'function'\) ptfAuthClear\(\)/g) || []).length >= 4);
T('ptfApiAuthHeaders به نمای واحد واگذار شد', /if \(typeof ptfAuthHeaders === 'function'\) return ptfAuthHeaders\(json\);/.test(idx));

/* ═══ ۴) سرور ═══ */
T('auth_login: نشانگر غیرمحرم ptf_token_flag=1 صادر می‌شود', api.indexOf("setcookie('ptf_token_flag', '1', ['expires' => time() + $ttlFlag, 'path' => '/', 'secure' => (bool)$secureFlag, 'httponly' => false, 'samesite' => 'Strict'])") > -1);
T('auth_logout: نشانگر پاک می‌شود', /setcookie\('ptf_token_flag', '', \['expires' => time\(\) - 3600/.test(api));
T('role_verify: user+name برمی‌گردد (بازسازی نشست)', /case 'role_verify':[\s\S]{0,1200}'user' => \$rvUser, 'name' => \$rvName/.test(api));
T('role_verify نام را از crm_users می‌گیرد', /load_data\('crm_users'\)[\s\S]{0,300}rvU\['name'\]/.test(api));

/* ═══ ۵) رجیستری ═══ */
T('registry: SESS → httponly-cookie+sessionStorage-mirror', /SESS: \{ store: 'httponly-cookie\+sessionStorage-mirror'/.test(kr));

/* ═══ ۶) رفتاری: vm ═══ */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function mkStore() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[String(k)] = String(v); },
    removeItem: function (k) { delete m[String(k)]; }
  };
}
function extractBlock(src, from, to) {
  var a = src.indexOf(from), b = src.indexOf(to, a);
  assert(a > -1 && b > -1, 'block not found');
  return src.slice(a, b);
}
var assert = require('assert');
(async function () {
  try {
    var LS = mkStore(), SS = mkStore();
    var cookieStr = '';
    var restorePayload = { ok: true, role: 'admin', user: 'adm', name: 'مدیر سیستم' };
    var sb = {
      localStorage: LS, sessionStorage: SS,
      document: { cookie: '' },
      fetch: function (url) {
        if (url.indexOf('action=role_verify') > -1) return Promise.resolve({ json: function () { return Promise.resolve(restorePayload); } });
        throw new Error('unexpected ' + url);
      },
      console: console
    };
    Object.defineProperty(sb.document, 'cookie', { get: function () { return cookieStr; }, set: function (v) { cookieStr = v; }, configurable: true });
    sb.window = sb;
    vm.createContext(sb);
    var block = extractBlock(rbac, 'var PTF_AUTH_KEYS', 'function curSession()');
    vm.runInContext(block + '\nthis.__x = 1;', sb, { filename: 'ptfauth-block.js' });

    /* ۱ — مهاجرت: LS→SS + حذف LS (مسیر دستگاه موجود) */
    LS.setItem('ptf_crm_token', 'TOK-1');
    LS.setItem('ptf_crm_token_role', 'admin');
    LS.setItem('ptf_crm_session', JSON.stringify({ user: 'adm', name: 'مدیر', role: 'admin', roleId: 'admin' }));
    T('vm: ptfAuthToken توکن legacy LS را برمی‌گرداند و مهاجرت می‌کند (بدون بازگشت بی‌نهایت)', sb.ptfAuthToken() === 'TOK-1');
    T('vm: پس از مهاجرت توکن در SS است و LS خالی', SS.getItem('ptf_crm_token') === 'TOK-1' && LS.getItem('ptf_crm_token') === null);
    T('vm: نشست و نقش هم مهاجرت کردند و LS هر سه کلید خالی است', LS.getItem('ptf_crm_session') === null && LS.getItem('ptf_crm_token_role') === null && SS.getItem('ptf_crm_session') !== null);
    T('vm: فراخوانی دوباره از SS می‌خواند', sb.ptfAuthToken() === 'TOK-1');

    /* ۲ — نشانگر کوکی */
    cookieStr = '';
    T('vm: بدون کوکی → ptfAuthCookieOk=false', sb.ptfAuthCookieOk() === false);
    cookieStr = 'other=2; ptf_token_flag=1; x=y';
    T('vm: ptf_token_flag=1 در میان کوکی‌ها شناسایی می‌شود', sb.ptfAuthCookieOk() === true);
    cookieStr = 'ptf_token_flag=0';
    T('vm: مقدار غیر ۱ پذیرفته نمی‌شود', sb.ptfAuthCookieOk() === false);
    cookieStr = 'ptf_token_flag=1';
    T('vm: ptfAuthOk با توکن یا کوکی', sb.ptfAuthOk() === true);
    SS.removeItem('ptf_crm_token');
    T('vm: بدون توکن SS، کوکی به‌تنهایی کافی است (تبِ تازه)', sb.ptfAuthOk() === true && sb.ptfAuthToken() === '');
    cookieStr = '';
    T('vm: بدون توکن و بدون کوکی → نه نشست', sb.ptfAuthOk() === false);

    /* ۳ — هدرساز */
    SS.setItem('ptf_crm_token', 'TOK-2');
    var h = sb.ptfAuthHeaders(true);
    T('vm: ptfAuthHeaders(json) هدر درست می‌سازد', h['Content-Type'] === 'application/json' && h['X-CRM-Token'] === 'TOK-2');
    var h2 = sb.ptfAuthHeaders(false);
    T('vm: حالت بدون json بدون Content-Type', h2['Content-Type'] === undefined && h2['X-CRM-Token'] === 'TOK-2');

    /* ۴ — ورود: ptfAuthLoginWrite */
    SS.removeItem('ptf_crm_token'); LS.setItem('ptf_crm_token', 'STALE'); LS.setItem('ptf_crm_session', '{}');
    sb.ptfAuthLoginWrite('TOK-3', 'sales', { user: 's1', name: 'فروش', role: 'sales', roleId: 'sales' });
    T('vm: ptfAuthLoginWrite → SS سه کلید؛ LS پاک', SS.getItem('ptf_crm_token') === 'TOK-3' && SS.getItem('ptf_crm_token_role') === 'sales' && JSON.parse(SS.getItem('ptf_crm_session')).user === 's1' && LS.getItem('ptf_crm_token') === null && LS.getItem('ptf_crm_session') === null);

    /* ۵ — بازسازی نشست تبِ تازه */
    SS.removeItem('ptf_crm_session');
    var okR = await new Promise(function (res) { sb.ptfAuthSessionRestore(function (o) { res(o); }); });
    T('vm: بازسازی نشست از role_verify (کوکی) موفق', okR === true && JSON.parse(SS.getItem('ptf_crm_session')).user === 'adm' && JSON.parse(SS.getItem('ptf_crm_session')).name === 'مدیر سیستم');
    restorePayload = { ok: false };
    SS.removeItem('ptf_crm_session');
    var okR2 = await new Promise(function (res) { sb.ptfAuthSessionRestore(function (o) { res(o); }); });
    T('vm: پاسخ منفی → cb(false) و نشست ساخته نمی‌شود', okR2 === false && SS.getItem('ptf_crm_session') === null);

    /* ۶ — پاک‌سازی کامل */
    LS.setItem('ptf_crm_token', 'X'); SS.setItem('ptf_crm_token', 'Y'); SS.setItem('ptf_crm_session', '{}');
    sb.ptfAuthClear();
    T('vm: ptfAuthClear هر دو مخزن را خالی می‌کند', LS.getItem('ptf_crm_token') === null && SS.getItem('ptf_crm_token') === null && SS.getItem('ptf_crm_session') === null);
  } catch (e) {
    T('زنجیرهٔ رفتاری vm بدون خطا', false, String(e && e.stack || e));
  }
  finish();
})().catch(function (e) { T('زنجیرهٔ بیرونی', false, String(e && e.stack || e)); finish(); });

function finish() {
  console.log('\n— tester544 (v34.37.5: R5/T4-1b — توکن/نشست خارج از localStorage؛ کوکی HttpOnly + آینهٔ sessionStorage) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}
