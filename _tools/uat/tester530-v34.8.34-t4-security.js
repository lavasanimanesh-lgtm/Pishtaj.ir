#!/usr/bin/env node
'use strict';
/* tester530 — v34.38.0 (T4 + T3-2):
   T4-1a: کوکی نشست HttpOnly (صدور هنگام لاگین، پاک شدن هنگام خروج، fallback هدر→کوکی)
   T4-2: TTL نشست ۲۴ ساعت / مالی ۸ ساعت (S5)
   T4-3: اسکن چک → آروان S3 با آزادسازی base64 از LS
   T3-2: re-render قطعی پس از جابه‌جایی آینهٔ IDB (سردبوت) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var auth = read('api/auth.php');
T('auth_get_header_token: fallback کوکی ptf_token', /\$_COOKIE\['ptf_token'\]/.test(auth));
T('کوکی HttpOnly + SameSite=Strict صادر می‌شود', /'httponly' => true/.test(auth) && /'samesite' => 'Strict'/.test(auth));
T('کوکی Secure روی HTTPS خودکار', /HTTP_X_FORWARDED_PROTO/.test(auth));
T('TTL توکن: ۲۴ ساعت / مالی ۸ ساعت (S5)', /\$ttl = \(\$roleL === 'accountant'\) \? 8 \* 3600 : 24 \* 3600/.test(auth));
T('emit cookie helper تعریف شد', /function auth_emit_session_cookie\(\$token, \$ttl/.test(auth));

var crmPhp = read('api/crm.php');
T('لاگین کوکی صادر می‌کند', /auth_emit_session_cookie\(\$token, \(\$role === 'accountant'\) \? 8 \* 3600 : 24 \* 3600\)/.test(crmPhp));
T('خروج کوکی پاک می‌شود', /setcookie\('ptf_token', '', \[/.test(crmPhp));

var chq = read('crm/cheque-print.js');
T('اسکن چک به آروان آپلود می‌شود', /uploadFile\(blob, 'chqprint'/.test(chq));
T('پس از ACK ابری، base64 از LS آزاد می‌شود', /localStorage\.removeItem\('ptf_chqprint_bg'\)/.test(chq));
T('رندر: fallback ابری (presign_get inline)', /presign_get/.test(chq) && /disposition: 'inline'/.test(chq));

var cs = read('crm/client-server.js');
T('T3-2: پرچم movedAny در preload', /var movedAny = false;/.test(cs));
T('T3-2: re-render پس از انتقال آینه', /ptfScheduleDataRefresh\('__cold_boot__'\)/.test(cs));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.38.12', ver.crm_version === 'v34.38.12', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.38.12', /window\.PTF_CRM_RELEASE = 'v34\.38\.12'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.38\.12'/.test(read('crm/sw.js')));

console.log('\n— tester530 (v34.38.0: T4 security + T3-2 cold-boot) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
