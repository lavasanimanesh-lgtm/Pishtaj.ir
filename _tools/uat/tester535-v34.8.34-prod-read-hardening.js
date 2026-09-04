#!/usr/bin/env node
'use strict';
/* tester535 — v34.36.4: فیکس «کالاها نمایش داده نمی‌شوند».
   ریشه: در نبود توکن (یا خطای پیاپی سرور) مسیر سروری در حلقه fetch می‌ماند و
   fallback محلی هرگز اجرا نمی‌شد. فیکس: حداکثر ۲ retry، نبود توکن → fallback فوری،
   fallback محلی تابع مستقل (renderProductsLocal) با رندر کامل ردیف‌ها. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var idx = read('crm/index.html');
T('fallback محلی تابع مستقل renderProductsLocal', /function renderProductsLocal\(\)/.test(idx));
T('renderProducts مسیر سروری + fallback', /if \(prodServerReadOn\(\)\) \{ try \{ renderProductsServer\(\); return; \} catch \(eSrv\) \{ prodServerReadOn\._offOnce = true; \} \}\s*\n?\s*renderProductsLocal\(\);/.test(idx));
T('حداکثر ۲ retry سپس fallback', /prodServerPage\.fails >= 2/.test(idx) && /prodServerPage\.fails\+\+/.test(idx));
T('نبود توکن → خطای محلی داخل DataLayer (بدون fetch)', /error: 'no_token', needLogin: true/.test(read('crm/sync.js')));
T('گارد توکن دیگر LS مستقیم در index.html نیست (A10)', !/prodServerPage\.fails >= 2 \|\| !localStorage/.test(idx));
T('فیلتر دسته روی ردیف‌های سروری محلی اعمال می‌شود', /fc2 !== 'همه'/.test(idx));
T('ناوبری صفحهٔ سروری', /ptfProdServerGoto\(/.test(idx));
T('کلید بازگشت فوری حفظ شده', /window\.ptfProdServerToggle = function \(on\)/.test(idx));
T('v34.36.4: سرور خالی + دادهٔ محلی → رندر محلی (دادهٔ محلی حاکم تا sync)', /\(d\.total \|\| 0\) === 0 && localCount > 0/.test(idx));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.36.4', ver.crm_version === 'v34.36.4', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.36.4', read('crm/index.html').indexOf("window.PTF_CRM_RELEASE = 'v34.36.4'") > -1 && read('crm/sw.js').indexOf("CACHE = 'ptf-crm-v34.36.4'") > -1);

console.log('\n— tester535 (v34.36.4: products read hardening) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
