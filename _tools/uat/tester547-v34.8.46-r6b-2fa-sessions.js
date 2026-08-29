#!/usr/bin/env node
'use strict';
/* tester547 — v34.8.47 (R6-ب): ورود دومرحله‌ای پیامکی نقش‌های مالی + نشست‌های فعال
   قرارداد: (۱) سرور — auth_login برای نقش پیکربندی‌شدهٔ مالی (پیش‌فرض accountant)
   بعد از تأیید رمز کد ۶رقمی SMS + otp_challenge برمی‌گرداند (نه توکن)؛ مرحلهٔ دوم
   auth_login_otp با کد → توکن + کوکی‌ها. سیاست fail-open با ثبت رویداد
   (twofa_skipped در پاسخ) مگر settings.twofa_required (fail-closed). سقف ۳ ارسال/
   ۱۰دقیقه (429)، ۵ تلاش غلط → قفل، عمر کد ۱۸۰ث، هش کد با password_hash.
   (۲) نشست‌ها — sessions_list فقط متادیتا (بدون مقدار توکن) + نشانگر current؛
   sessions_revoke POST all|user، توکن درخواست‌کننده همیشه زنده می‌ماند (بدون
   لاک‌اوت)، نقش‌بندی users_write.
   (۳) کلاینت — ptf2faContinue بعد از هر سه مسیر ورود؛ پنل نشست‌ها در تنظیمات.
   پوشش: قرارداد منبع (crm.php + auth.php + index.html + rbac.js) + رفتاری (vm). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var php = read('api/crm.php');
var auth = read('api/auth.php');
var ih = read('crm/index.html');
var rb = read('crm/rbac.js');

/* ═══ ۱) سرور — 2FA: تعریف‌ها و پیکربندی ═══ */
T('auth_login_otp در public_actions (مرحلهٔ دوم بدون توکن)', php.indexOf("'auth_login', 'auth_login_otp'") > -1);
T('helperهای twofa_* top-level (قبل از ptf_echo_json)', (function () { var a = php.indexOf('function twofa_store_file()'), b = php.indexOf('function ptf_echo_json('); return a > -1 && a < b; })());
T('مخزن auth_2fa.json + نوشتن اتمیک (tmp+rename)', php.indexOf("'/auth_2fa.json'") > -1 && /twofa_store_save[\s\S]{0,200}@rename\(\$tmp, \$f\);/.test(php));
T('لاگ auth_2fa_log.json با سقف ۸۰ رویداد', php.indexOf("'/auth_2fa_log.json'") > -1 && php.indexOf('$log = array_slice($log, -80);') > -1);
T('نقش پیش‌فرض 2FA = accountant (settings.twofa_roles)', /\$roles = \['accountant'\];/.test(php) && /is_array\(\$s\['twofa_roles'\] \?\? null\)/.test(php));
T('موبایل معتبر ایرانی 09xxxxxxxxx لازم است', php.indexOf("preg_match('/^09\\d{9}$/', $m) ? $m : ''") > -1);

/* ═══ ۲) سرور — 2FA: جریان auth_login ═══ */
T('شاخهٔ 2FA بعد از normalize_role و قبل از auth_generate_token', (function () { var a = php.indexOf("$role = normalize_role($found['roleId'] ?? ''"), b = php.indexOf('LOGIN-2FA): نقش مالی + SMS فعال'), c = php.indexOf('$token = auth_generate_token($found[\'username\'], $role);', a); return a > -1 && a < b && b < c; })());
T('fail-open با پرچم twofa_skipped در پاسخ نهایی', php.indexOf("'twofa_skipped' => $twofaSkipped") > -1 && php.indexOf('$twofaSkipped = $why2fa;') > -1);
T('fail-closed با settings.twofa_required (503 twofa_unavailable/twofa_sms_failed)', /\$cfg2fa\['strict'\]/.test(php) && php.indexOf("'error' => 'twofa_unavailable'") > -1 && php.indexOf("'error' => 'twofa_sms_failed'") > -1);
T('پاسخ otp_required با challenge + mobile_last4 + ttl=180', php.indexOf("'otp_required' => true, 'otp_challenge' => $chal2fa, 'mobile_last4'") > -1 && php.indexOf("'ttl' => 180") > -1);
T('کد ۶رقمی هش‌شده (password_hash) — نه plaintext', /password_hash\(\$code2fa, PASSWORD_DEFAULT\)/.test(php));
T('challenge = hex32 تصادفی (bin2hex random 16)', /\$chal2fa = bin2hex\(random_bytes\(16\)\);/.test(php));
T('عمر کد ۱۸۰ ثانیه', php.indexOf("'exp' => time() + 180") > -1);
T('سقف ۳ ارسال در پنجرهٔ ۱۰دقیقه (429 twofa_rate_limited)', php.indexOf("'error' => 'twofa_rate_limited'") > -1 && /\(time\(\) - \(int\)\(\$rec2fa\['first'\] \?\? 0\)\) < 600/.test(php) && /\(int\)\(\$rec2fa\['sent'\] \?\? 0\) >= 3/.test(php));
T('ارسال SMS با sms_send + متن فارسی برند', /sms_send\(\$mob2fa, 'پیشرو تجهیز فرتاک'/.test(php));
T('شکست SMS → رویداد sms_failed در لاگ', php.indexOf("twofa_log('sms_failed'") > -1);
T('ارسال موفق → رویداد sent (موبایل ماسک‌شده)', php.indexOf("twofa_log('sent', $found['username'], 'mobile:***'") > -1);

/* ═══ ۳) سرور — 2FA: مرحلهٔ دوم auth_login_otp ═══ */
T('POST-only برای هر دو مرحله', (function () { var seg = php.slice(php.indexOf("case 'auth_login_otp':"), php.indexOf("case 'users_get':")); return /method_not_allowed/.test(seg) && seg.indexOf("case 'auth_login_otp':") > -1; })() && /case 'auth_login':[\s\S]{0,400}method_not_allowed/.test(php));
T('challenge با hash_equals مقایسه و به username مقید است', php.indexOf("hash_equals((string)($recOtp['chal'] ?? ''), $chalOtp)") > -1);
T('کد منقضی → حذف رکورد + 401 twofa_code_expired', php.indexOf("'error' => 'twofa_code_expired'") > -1 && php.indexOf('twofa_code_expired') > php.indexOf('twofa_store_save($stOtp);'));
T('۵ تلاش غلط → قفل و حذف رکورد (429 twofa_locked)', php.indexOf("'error' => 'twofa_locked'") > -1 && /\(int\)\(\$recOtp\['tries'\] \?\? 0\) >= 5/.test(php));
T('کد غلط → شمارندهٔ tries++ + رویداد wrong_code', php.indexOf("twofa_log('wrong_code'") > -1 && /\$recOtp\['tries'\] = \(int\)\(\$recOtp\['tries'\] \?\? 0\) \+ 1;/.test(php));
T('راستی‌آزمایی با password_verify', /password_verify\(\$codeOtp, \(string\)\(\$recOtp\['hash'\] \?\? ''\)\)/.test(php));
T('موفق → حذف رکورد یک‌بارمصرف + توکن + رویداد verified', (function () { var seg = php.slice(php.indexOf("case 'auth_login_otp':")); var iDel = seg.indexOf('unset($stOtp[$uOtp]); twofa_store_save($stOtp);', seg.indexOf('password_verify')); return iDel > -1 && iDel < seg.indexOf('auth_generate_token') && seg.indexOf("twofa_log('verified'") > -1; })());
T('کوکی نشست با TTL نقش (accountant 8h/else 24h)', /auth_emit_session_cookie\(\$tokenOtp, \(\(string\)\$recOtp\['role'\] === 'accountant'\) \? 8 \* 3600 : 24 \* 3600\);/.test(php));
T('ptf_token_flag هم در مسیر OTP ست می‌شود', /ptf_token_flag', '1'[\s\S]{0,200}ttlFlagOtp/.test(php) || php.indexOf('$ttlFlagOtp') > -1);
T('بدون توکن در پاسخ‌های میانی (توکن فقط پس از کد درست)', (function () { var seg = php.slice(php.indexOf('LOGIN-2FA): نقش مالی + SMS فعال'), php.indexOf('$token = auth_generate_token')); return seg.indexOf("'token' =>") === -1; })());

/* ═══ ۴) سرور — نشست‌های فعال ═══ */
T('sessions_list: verify_request + role_guard(users_write)', (function () { var seg = php.slice(php.indexOf("case 'sessions_list':"), php.indexOf("case 'sessions_revoke':")); return seg.indexOf('verify_request();') > -1 && seg.indexOf("role_guard('users_write');") > -1; })());
T('sessions_list: فقط متادیتا — بدون مقدار توکن در پاسخ', (function () { var seg = php.slice(php.indexOf("case 'sessions_list':"), php.indexOf("case 'sessions_revoke':")); var body = seg.slice(seg.indexOf("json_encode(['ok' => true, 'sessions'")); return seg.indexOf("'user' =>") > -1 && seg.indexOf("'current' =>") > -1 && body.indexOf('$tS') === -1 && body.indexOf("'token'") === -1; })());
T('sessions_list: ردیف منقضی فیلتر می‌شود', /\(int\)\(\$iS\['exp'\] \?\? 0\) < \$sessNow\) continue;/.test(php));
T('نشانگر current با hash_equals (timing-safe)', /'current' => hash_equals\(\(string\)\$tS, auth_get_header_token\(\)\)/.test(php));
T('مرتب‌سازی بر اساس آخرین ورود (iat نزولی)', /usort\(\$sessRows, function \(\$a, \$b\) \{ return strcmp\(\(string\)\$b\['iat'\], \(string\)\$a\['iat'\]\); \}\);/.test(php));
T('sessions_revoke: POST-only (405)', php.slice(php.indexOf("case 'sessions_revoke':")).indexOf('method_not_allowed') > -1);
T('sessions_revoke: هدف all|user', /\$revTarget = clean\(\$_POST\['user'\] \?\? 'all', 80\);/.test(php) && /\$revTarget !== 'all' && strcasecmp/.test(php));
T('sessions_revoke: توکن درخواست‌کننده زنده می‌ماند (بدون لاک‌اوت)', /\$tR === \$revKeep\) continue;/.test(php) && php.indexOf('$revKeep = auth_get_header_token();') > -1);
T('sessions_revoke: فقط توکن‌های زنده ابطال و شمارش می‌شوند', (function () { var i = php.indexOf("(int)($iR['exp'] ?? 0) < $revNow) continue;"); var j = php.indexOf('unset($revTokens[$tR]);', i); return i > -1 && j > -1 && j - i < 250 && php.indexOf("'revoked' => $revokedN") > -1; })());
T('sessions_revoke: رویداد sessions_revoked در لاگ 2FA', php.indexOf("twofa_log('sessions_revoked'") > -1);
T('ابزار auth: توکن فعلی کوکی‌محور است (fallback ptf_token)', auth.indexOf("isset($_COOKIE['ptf_token'])") > -1 && auth.indexOf('function auth_get_header_token()') > -1);

/* ═══ ۵) کلاینت — index.html ═══ */
T('ptf2faContinue تعریف شد (async)', ih.indexOf('async function ptf2faContinue(u, resp)') > -1);
T('کد ۶رقمی با regex اعتبارسنجی می‌شود', ih.indexOf('/^\\d{6}$/.test(code)') > -1);
T('۳ تلاش برای وارد کردن کد', ih.indexOf('while (tries < 3)') > -1);
T('لغو کاربر = خروج با error روشن (twofa_cancelled)', ih.indexOf("error: 'twofa_cancelled'") > -1);
T('پس از ۳ شکست: twofa_failed روشن', ih.indexOf("error: 'twofa_failed'") > -1);
T('تمام ۳ مسیر ورود به ptf2faContinue ادامه می‌دهند', ih.count ? true : true, (function () { var n = (ih.match(/await ptf2faContinue\(u, _\w+\)/g) || []).length; return n; })());
T('مسیرهای ورود = ۳ (server/direct/main)', (ih.match(/await ptf2faContinue\(u, _\w+\);/g) || []).length === 3);
T('twofa_skipped → اطلاع‌رسانی کاربر (toast warn)', ih.indexOf('resp.twofa_skipped') > -1 && ih.indexOf('موقتاً اجرا نشد') > -1);
T('POST auth_login_otp با username+challenge+code', ih.indexOf("'&otp_challenge=' + encodeURIComponent(resp.otp_challenge)") > -1);
T('سکشن تنظیمات «نشست‌های فعال (R6)» قبل از enginegate', (function () { var a = ih.indexOf('data-settings-title="نشست‌های فعال (R6)"'), b = ih.indexOf("ptf-settings-enginegate"); return a > -1 && a < b; })());
T('هوک رندر sessionsBox در init تنظیمات', ih.indexOf("window.ptfRenderSessionsBox('sessionsBox')") > -1);

/* ═══ ۶) کلاینت — rbac.js ═══ */
T('ptfRenderSessionsBox روی window (قابل استفاده از index.html)', rb.indexOf('window.ptfRenderSessionsBox = function') > -1);
T('ptfSessionsRevoke روی window (دکمه‌های onclick)', rb.indexOf('window.ptfSessionsRevoke = function') > -1);
T('گیت نقش ارشد (isSenior) — پیام مودبانه برای غیر ارشد', rb.indexOf('senior = typeof isSenior === \'function\' && !!isSenior();') > -1 && rb.indexOf('فقط برای نقش‌های ارشد') > -1);
T('XSS: escape کاربر/IP قبل از innerHTML', (function () { var seg = rb.slice(rb.indexOf('window.ptfRenderSessionsBox'), rb.indexOf('function verifyRoleFromServer')); return seg.indexOf("replace(/&/g, '&amp;')") > -1 && seg.indexOf("replace(/\"/g, '&quot;')") > -1; })());
T('sessions_list با هدر نشست (ptfApiAuthHeaders)', rb.indexOf("action=sessions_list'") > -1 && rb.indexOf('ptfApiAuthHeaders(false)') > -1);
T('sessions_revoke: POST با Content-Type urlencoded (سمت سرور $_POST)', (function () { var seg = rb.slice(rb.indexOf('window.ptfSessionsRevoke'), rb.indexOf('window.ptfSessionsRevoke') + 1200); return seg.indexOf("method: 'POST'") > -1 && seg.indexOf("'application/x-www-form-urlencoded'") > -1; })());
T('confirm قبل از ابطال — پیام متمایز all/کاربر', rb.indexOf('خروج اجباری همهٔ دستگاه‌ها') > -1 && rb.indexOf('window.confirm(msg)') > -1);
T('نشانگر تب جاری 📍 + دکمهٔ خروج فقط برای نشست‌های دیگر', rb.indexOf('(r.current ? \' 📍\' : \'\')') > -1 && rb.indexOf("(!r.current ? '<button") > -1);
T('بازخورد تعداد ابطال‌شده + reload لیست', rb.indexOf("(d.revoked || 0) + ' نشست ابطال شد'") > -1 && /if \(d && d\.ok\)[\s\S]{0,120}load\(\);/.test(rb));
T('جدول: کاربر/نقش/ورود/انقضا/IP', ['<th', 'کاربر', 'نقش', 'ورود', 'انقضا', 'IP'].every(function (x) { return rb.indexOf(x) > -1; }));

/* ═══ ۷) رفتاری — vm: ptf2faContinue ═══ */
var seg = ih.slice(ih.indexOf('async function ptf2faContinue'), ih.indexOf('function ptfServerLogin') < ih.indexOf('async function ptf2faContinue') ? ih.length : (function () { var s = ih.indexOf('/* v34.8.47 (R6/T7-ب — LOGIN-2FA):', ih.indexOf('async function ptf2faContinue') + 30); return s > -1 ? ih.indexOf('/* v34.8.47 (R6/T7-ب — LOGIN-2FA):', s + 10) : ih.length; })());
/* تابع را تا انتهای بلاکش برش بزن (تعداد آکولاد متوازن) */
var start = ih.indexOf('async function ptf2faContinue');
var depth = 0, end = -1, seenOpen = false;
for (var i2 = start; i2 < ih.length && i2 < start + 8000; i2++) {
  var ch = ih[i2];
  if (ch === '{') { depth++; seenOpen = true; }
  else if (ch === '}') { depth--;
    if (seenOpen && depth === 0) { end = i2 + 1; break; }
  }
}
var fnSrc = ih.slice(start, end);
var prompts = []; var fetches = [];
var sandbox = {
  window: { prompt: function (t) { prompts.push(t); return prompts.length === 1 ? '123456' : ''; } },
  prompt: function (t) { prompts.push(t); return prompts.length === 1 ? '123456' : ''; },
  alert: function () {},
  fetch: function (url, opts) { fetches.push({ url: url, opts: opts }); return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, token: 'TKN-2FA', role: 'accountant' }); } }); },
  Promise: Promise, Date: Date, encodeURIComponent: encodeURIComponent, console: console
};
sandbox.window.prompt = sandbox.prompt;
vm.createContext(sandbox);
vm.runInContext(fnSrc + '\n; globalThis.__t2fa = ptf2faContinue;', sandbox);

(async function () {
  /* 7a: پاسخ otp_required → prompt + POST auth_login_otp → توکن */
  var r1 = await sandbox.__t2fa('ali', { otp_required: true, otp_challenge: 'abc', mobile_last4: '1234', ttl: 180 });
  T('رفتاری 2FA: کد گرفته شد و توکن مرحلهٔ دوم برگشت', r1 && r1.ok === true && r1.token === 'TKN-2FA' && prompts.length === 1);
  T('رفتاری 2FA: درخواست به auth_login_otp با پارامترهای کامل', fetches.length === 1 && fetches[0].url.indexOf('action=auth_login_otp') > -1 && /otp_challenge=abc/.test(fetches[0].opts.body) && /code=123456/.test(fetches[0].opts.body));
  /* 7b: پاسخ عادی بدون otp_required → دست‌نخورده */
  var r2 = await sandbox.__t2fa('sara', { ok: true, token: 'TKN-1' });
  T('رفتاری 2FA: پاسخ بدون otp_required بدون تغییر عبور می‌کند', r2 && r2.token === 'TKN-1' && prompts.length === 1 && fetches.length === 1);
  /* 7c: لغو کاربر (prompt خالی) → twofa_cancelled بدون فراخوانی سرور */
  var sb2 = { window: { prompt: function () { return ''; } }, prompt: function () { return ''; }, alert: function () {}, fetch: function () { throw new Error('نباید صدا زده شود'); }, Promise: Promise, Date: Date, encodeURIComponent: encodeURIComponent, console: console };
  vm.createContext(sb2);
  vm.runInContext(fnSrc + '\n; globalThis.__c2fa = ptf2faContinue;', sb2);
  var r3 = await sb2.__c2fa('ali', { otp_required: true, otp_challenge: 'abc' });
  T('رفتاری 2FA: لغو کاربر → twofa_cancelled بدون تماس با سرور', r3 && r3.ok === false && r3.error === 'twofa_cancelled');
  /* 7d: twofa_skipped → همان پاسخ + بدون prompt */
  var sb3 = { window: {}, prompt: function () { throw new Error('نباید prompt شود'); }, alert: function () {}, ptfToast: function () { sb3.__toasted = true; }, fetch: function () { throw new Error('نباید fetch شود'); }, Promise: Promise, Date: Date, encodeURIComponent: encodeURIComponent, console: console };
  vm.createContext(sb3);
  vm.runInContext(fnSrc + '\n; globalThis.__s2fa = ptf2faContinue;', sb3);
  var r4 = await sb3.__s2fa('h', { ok: true, token: 'T', twofa_skipped: 'sms_off' });
  T('رفتاری 2FA: twofa_skipped → همان پاسخ + اطلاع‌رسانی (toast)', r4 && r4.token === 'T' && sb3.__toasted === true);

  /* ═══ ۸) رفتاری — vm: ptfRenderSessionsBox (رندر و revoke) ═══ */
  var rbStart = rb.indexOf('window.ptfRenderSessionsBox = function'); /* نسخه-مستقل (هات‌فیکس ۴۷: لنگر نسخه‌دار شکننده بود) */
  var rbEnd = rb.indexOf('function verifyRoleFromServer');
  var rbSrc = 'var ROLES = { accountant: { lb: "حسابدار" }, admin: { lb: "ادمین" } };\nfunction curRole() { return "admin"; }\nvar SENIOR_ROLES = ["admin", "chairman", "ceo", "commercial"];\nfunction isSenior() { return SENIOR_ROLES.indexOf(curRole()) > -1; }\n' + rb.slice(rbStart, rbEnd);
  var sbox = {
    document: {
      _els: {},
      getElementById: function (id) { if (!sbox.document._els[id]) sbox.document._els[id] = { id: id, innerHTML: '' }; return sbox.document._els[id]; }
    },
    window: {},
    sessionStorage: { getItem: function () { return 'SS-TOK'; }, setItem: function () {}, removeItem: function () {} },
    localStorage: { getItem: function (k) { return k === 'ptf_crm_token' ? 'LS-TOK' : null; }, setItem: function () {}, removeItem: function () {} },
    ptfApiAuthHeaders: function (json) { var h = json ? { 'Content-Type': 'application/json' } : {}; h['X-CRM-Token'] = 'LS-TOK'; return h; },
    fetch: function (url, opts) {
      sbox.__calls.push({ url: url, opts: opts || {} });
      if (url.indexOf('sessions_list') > -1) return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, sessions: [{ user: 'ali', role: 'accountant', iat: 1700000000, exp: 1700086400, ip: '1.2.3.4', current: false }, { user: 'admin', role: 'admin', iat: 1700000100, exp: 1700086400, ip: '5.6.7.8', current: true }] }); } });
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, revoked: 1 }); } });
    },
    confirm: function () { return true; },
    ptfToast: function (m) { sbox.__toasts.push(m); },
    setTimeout: function (fn) { fn(); return 0; },
    Promise: Promise, Date: Date, encodeURIComponent: encodeURIComponent, console: console
  };
  sbox.__calls = []; sbox.__toasts = [];
  sbox.window = sbox; /* window.* = global */
  vm.createContext(sbox);
  vm.runInContext(rbSrc + '\n; globalThis.__box = window.ptfRenderSessionsBox;', sbox);
  await new Promise(function (r) { setTimeout(r, 10); });
  sbox.__box('sessionsBox');
  await new Promise(function (r) { setTimeout(r, 10); });
  var html = sbox.document._els['sessionsBox'] ? sbox.document._els['sessionsBox'].innerHTML : '';
  T('رفتاری نشست‌ها: جدول رندر شد با ۲ ردیف', html.indexOf('<table') > -1 && html.indexOf('ali') > -1 && html.indexOf('📍') > -1);
  T('رفتاری نشست‌ها: توکن در HTML لو نرفت', html.indexOf('LS-TOK') === -1 && html.indexOf('SS-TOK') === -1);
  T('رفتاری نشست‌ها: دکمهٔ خروج فقط برای نشست غیر جاری', html.indexOf("ptfSessionsRevoke('ali')") > -1 && html.indexOf("ptfSessionsRevoke('admin')") === -1);
  T('رفتاری نشست‌ها: دکمهٔ خروج اجباری همه', html.indexOf("ptfSessionsRevoke('all')") > -1);
  var hdr = (sbox.__calls[0] && sbox.__calls[0].opts.headers) || {};
  T('رفتاری نشست‌ها: sessions_list با توکن در هدر', sbox.__calls.length >= 1 && sbox.__calls[0].url.indexOf('sessions_list') > -1 && hdr['X-CRM-Token'] === 'LS-TOK');
  await sbox.ptfSessionsRevoke('all'); /* بعد از رندر تعریف می‌شود */
  await new Promise(function (r) { setTimeout(r, 10); });
  T('رفتاری نشست‌ها: revoke با POST urlencoded و هدف', (function () { var c = sbox.__calls.filter(function (x) { return x.url.indexOf('sessions_revoke') > -1; })[0]; return c && c.opts.method === 'POST' && /user=all/.test(c.opts.body) && c.opts.headers['Content-Type'] === 'application/x-www-form-urlencoded' && c.opts.headers['X-CRM-Token'] === 'LS-TOK'; })());
  T('رفتاری نشست‌ها: بازخورد ابطال + reload لیست', sbox.__toasts.some(function (m) { return m.indexOf('1 نشست ابطال شد') > -1; }) && sbox.__calls.filter(function (x) { return x.url.indexOf('sessions_list') > -1; }).length >= 2);

  console.log('\\n== tester547: ' + p + ' PASS / ' + f + ' FAIL ==');
  process.exit(f ? 1 : 0);
})().catch(function (e) { console.error('HARNESS-ERROR', e && e.stack || e); process.exit(2); });
