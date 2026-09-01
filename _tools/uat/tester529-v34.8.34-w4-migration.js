#!/usr/bin/env node
'use strict';
/* tester529 — v34.28.0 (W4): تکمیل مهاجرت فرمانی — ۴۱ کلید، ~۱۳۰ نقطهٔ این نوبت.
   بعد از این موج، «هیچ کلید کسب‌وکاری» مسیر مستقیم setData ندارد؛ همه از روتر
   (یا fallback else/rollback عمدی) عبور می‌کنند. اصل E1 رودمپ عملاً برقرار. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function globJs() { return fs.readdirSync(path.join(ROOT, 'crm')).filter(function (x) { return /\.js$/.test(x) || x === 'index.html'; }); }

var php = read('api/sales-domain.php');
var KEY4 = ['offers','rfqsmart','payables','letters','sendqueue','deleted_archive','buycmp','settings','audit','users','supplier_finance','cheques','contracts','buyquotes','smsbook','sigprofiles','petty','inqreads','avatars','catalog_merges','vat_settlements','purchase_returns','perms','catalog_reviews'];
KEY4.forEach(function (k) {
  T('رجیستری: ptf_crm_' + k, new RegExp("'ptf_crm_" + k + "'\\s*=>\\s*\\[").test(php));
});
T('settings فقط نقش ارشد', /'ptf_crm_settings' => \[\s*'roles' => \['admin','chairman','ceo','commercial'\]/.test(php));
T('users فقط نقش ارشد', /'ptf_crm_users' => \[\s*'roles' => \['admin','chairman','ceo','commercial'\]/.test(php));

/* صفر بایپس باقی‌مانده برای کلیدهای کسب‌وکار (بجز fallback/rollback/مقایسه) */
var skip = /client-server\.js|sync\.js$|storage\.js$|storage-quota\.js$|backup\.js$|finance-write-guard\.js/;
var bypass = [];
globJs().forEach(function (f) {
  if (skip.test(f)) return;
  var src = read('crm/' + f);
  var re = /setData\('ptf_crm_[a-z_]+',/g, m;
  while ((m = re.exec(src))) {
    var before = src.slice(Math.max(0, m.index - 400), m.index);
    var after = src.slice(m.index, m.index + 300);
    var isFallback = /\belse\s*$/.test(before) || /\belse\s+setData\s*$/.test(before.trim()) || /\belse\s+if\s*\([^)]*\)\s*[^;{]*$/.test(before.trim()) || /===\s*false/.test(after) || /!==\s*false/.test(after) || /rollback/.test(after) || /\/\* fallback \*\//.test(before) || /prodServerRead = !!on/.test(before + after); /* toggle تنظیمات UI ماژول کالا */
    if (!isFallback) bypass.push('crm/' + f + ' ← ' + m[0]);
  }
});
T('صفر بایپس ساده در کل crm (پایان E2-مسیر)', bypass.length === 0, JSON.stringify(bypass.slice(0, 5)));
var routed = 0;
globJs().forEach(function (f) {
  var src = read('crm/' + f);
  routed += (src.match(/window\.ptfEntitySaveCollection\(/g) || []).length;
});
T('کل نقاط روترشده در crm ≥ ۲۰۰', routed >= 200, routed);

/* A11 با ۴۱ کلید */
var sd = read('crm/sales-domain-v2.js');
var clientKeys = (sd.match(/window\.PTF_ENTITY_CMD_ENABLED = \{([\s\S]*?)\};/)[1].match(/'ptf_crm_[a-z_]+'/g) || []).map(function (x) { return x.replace(/'/g, ''); }).sort();
var regFn = php.match(/function sd_entity_registry\s*\(\s*\)\s*:\s*array\s*\{[\s\S]*?\n\}/)[0];
var serverKeys = [];
regFn.replace(/'(ptf_crm_[a-z_]+)'\s*=>\s*\[/g, function (_, k) { if (serverKeys.indexOf(k) < 0) serverKeys.push(k); return ''; });
serverKeys.sort();
T('A11: تطابق کامل کلاینت/سرور (' + clientKeys.length + ' کلید)', JSON.stringify(clientKeys) === JSON.stringify(serverKeys), JSON.stringify(clientKeys) + ' vs ' + JSON.stringify(serverKeys));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.28.0', ver.crm_version === 'v34.28.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.28.0', /window\.PTF_CRM_RELEASE = 'v34\.28.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.28.0'/.test(read('crm/sw.js')));

console.log('\n— tester529 (v34.28.0: W4 completion) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
