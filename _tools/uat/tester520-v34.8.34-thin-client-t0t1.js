#!/usr/bin/env node
'use strict';
/* tester520 — v34.29.6 (T0/T1 قراردادهای رودمپ نازک‌سازی):
   T0-1 قاعدهٔ A10 (بایپس localStorage) + T0-2 قاعدهٔ A11 (تطابق رجیستری) +
   T0-5 رجیستری واحد کلیدها + T1-2 دسته‌بند پیام فرمان + T1-3 sanitizer نرم. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- T0-1/T0-2: قوانین جدید arch-guard ---------- */
var guard = read('_tools/arch/arch-guard.js');
T('قاعدهٔ A10 (بایپس localStorage) تعریف شده', /ruleA10/.test(guard) && /A10:\s*\{\s*blocking:\s*true/.test(guard));
T('A10 فهرست‌سفید لایهٔ داده دارد', /WHITELIST\s*=\s*\['client-server\.js',\s*'storage-quota\.js',\s*'sync\.js',\s*'storage\.js',\s*'backup\.js',\s*'rbac\.js'/.test(guard)); /* v34.29.6: +cheque-print (فلگ‌های رسانه) مجاز */
T('قاعدهٔ A11 (تطابق رجیستری) تعریف شده', /ruleA11/.test(guard) && /A11:\s*\{\s*blocking:\s*true/.test(guard));
T('A11 فقط بدنهٔ sd_entity_registry را می‌خواند', /function sd_entity_registry\\s\*\\\(\\\s\*\\\)[\s\S]*?sd_entity_registry\\s\*\\\(/.test(guard) || /sd_entity_registry\\s*\\\(\\\s*\\\)/.test(guard) || /var fn = serverSrc\.match\(\/function sd_entity_registry/.test(guard));

/* ---------- T0-5: رجیستری واحد کلیدها ---------- */
var kr = read('crm/key-registry.js');
T('رجیستری ۷ دسته دارد', ['REC', 'SESS', 'Q', 'CACHE', 'UI', 'DEV', 'MEDIA'].every(function (c) { return new RegExp(c + ':\\s*\\{').test(kr); }));
T('index.html رجیستری را قبل از sync.js لود می‌کند', /key-registry\.js\?v=[^"]*"><\/script>\s*\n\s*<script defer src="sync\.js/.test(read('crm/index.html')));
T('sw.js رجیستری را precache می‌کند', /'\.\/key-registry\.js' \+ ASSET_QUERY,/.test(read('crm/sw.js')));

/* رفتاری: دسته‌یابی و پوشش SYNC_KEYS */
(function behavior() {
  var sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(kr, sandbox);
  var R = sandbox.window.PTF_KEY_REGISTRY;
  T('PTF_KEY_REGISTRY ساخته شد', !!R);
  T("ptfKeyCategory('ptf_crm_token') = SESS", sandbox.window.ptfKeyCategory('ptf_crm_token') === 'SESS');
  T('پیشوند per-user دسته DEV', sandbox.window.ptfKeyCategory('ptf_tour_done_ali') === 'UI' || sandbox.window.ptfKeyCategory('ptf_autodraft_offer_CO') === 'DEV'); /* v34.29.6: personal_cheques از DEV به REC/سینک منتقل شد */
  T("ptfKeyCategory('ptf_autodraft_offer_CO') = DEV", sandbox.window.ptfKeyCategory('ptf_autodraft_offer_CO') === 'DEV');
  T('REC حداقل ۶۰ کلید کسب‌وکار', R.REC.keys.length >= 60, R.REC.keys.length);
  T('ptfBusinessKeys شامل invoices', sandbox.window.ptfBusinessKeys().indexOf('ptf_crm_invoices') > -1);
  /* پوشش: هر کلید SYNC_KEYS باید در REC رجیستری باشد */
  var sync = read('crm/sync.js');
  var m = sync.match(/var SYNC_KEYS\s*=\s*\[([\s\S]*?)\];/);
  var syncKeys = m ? (m[1].match(/'(ptf_[a-z_]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); }) : [];
  T('SYNC_KEYS استخراج شد (≥۶۰)', syncKeys.length >= 60, syncKeys.length);
  var missing = syncKeys.filter(function (k) { return R.REC.keys.indexOf(k) < 0; });
  T('هر کلید SYNC_KEYS در رجیستری REC هست', missing.length === 0, JSON.stringify(missing));
  var allowedExtra = ['ptf_crm_sales_commands'];
  var extras = R.REC.keys.filter(function (k) { return syncKeys.indexOf(k) < 0 && allowedExtra.indexOf(k) < 0; });
  T('REC فقط افزودهٔ مجاز دارد', extras.length === 0, JSON.stringify(extras));
})();

/* ---------- T1-2: دسته‌بند پیام خطای فرمان ---------- */
(function msg() {
  var src = read('crm/sales-domain-v2.js');
  var fn = src.match(/window\.ptfEntityCommandMessage\s*=\s*function\s*\(st,\s*label\)\s*\{[\s\S]*?\n\s*\};/);
  T('ptfEntityCommandMessage تعریف شده', !!fn);
  if (!fn) return;
  var sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fn[0], sandbox);
  var M = sandbox.window.ptfEntityCommandMessage;
  T('acked → پیام تهی', M({ state: 'acked' }, 'ذخیره') === '');
  T('403 → عدم دسترسی (نه «تلاش کنید»)', M({ state: 'rejected', error: { status: 403 } }, 'ذخیره').indexOf('دسترسی') > -1);
  T('401 → نشست منقضی', M({ state: 'rejected', error: { status: 401 } }, 'ذخیره').indexOf('نشست') > -1);
  T('uncertain → بررسی رسید، دوباره نفرست', (function () { var s = M({ state: 'uncertain' }, 'ذخیره'); return s.indexOf('نامشخص') > -1 && s.indexOf('نفرستید') > -1; })());
  T('network → صف محفوظ', M({ state: 'rejected', error: { message: 'Failed to fetch' } }, 'ذخیره').indexOf('محفوظ') > -1);
  T('definitiveNoCommit → دوباره تلاش', M({ state: 'rejected', error: { definitiveNoCommit: true, message: 'command_not_committed' } }, 'ذخیره').indexOf('دوباره تلاش') > -1);
  T('permission در متن پیام هم تشخیص داده می‌شود', M({ state: 'rejected', error: { message: 'permission_denied' } }, 'حذف').indexOf('دسترسی') > -1);
  /* فراخوان‌ها */
  var leads = read('crm/leads.js');
  T('۳ نقطهٔ فرمان leads از دسته‌بند استفاده می‌کنند (v34.29.6: addReminder/remDone/remSnooze به router SaveCollection منتقل شدند؛ پیام خطای خودشان درون router است)', (leads.match(/window\.ptfEntityCommandMessage\(st,/g) || []).length === 3, (leads.match(/window\.ptfEntityCommandMessage\(st,/g) || []).length);
})();

/* ---------- T1-3: sanitizer نرم + شمارش برش ---------- */
var sd = read('api/sales-domain.php');
T('sanitizer آمار برش برمی‌گرداند', /sd_entity_sanitize_row\(array \$row, array &\$stats/.test(sd) && /'sanitize' => \$sanitizeStats/.test(sd));
T('سقف متن رکورد ۸۰۰۰ شد', /sd_text\(\$v, 8000\)/.test(sd));
T('سقف hist ۲۰۰۰ شد', /sd_text\(\$v3, 2000\)/.test(sd));
T('فیلد null حفظ می‌شود', /\$out\[\$k\] = null; \$n\+\+; \$stats\['kept'\]\+\+;/.test(sd));

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.29.6', ver.crm_version === 'v34.29.6', ver.crm_version);
var idx = read('crm/index.html');
T('نسخهٔ UI = v34.29.6', /window\.PTF_CRM_RELEASE = 'v34\.29.6'/.test(idx));
var swv = read('crm/sw.js');
T('قرارداد sw/index هم‌نسخه', /CACHE = 'ptf-crm-v34\.29.6'/.test(swv) && idx.indexOf('?v=34.29.6') > -1);

console.log('\n— tester520 (v34.29.6: T0/T1 thin-client contracts) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
