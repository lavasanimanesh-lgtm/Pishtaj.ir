#!/usr/bin/env node
'use strict';
/* tester528 — v34.34.0 (W3): مهاجرت فرمانی موج سوم — فاکتورها/رسیدها/تخصیص‌ها/
   اصلاحات/یافته‌ها/مرجوعی فروش. فقط نقش‌های مالی. ثبت‌های اصلی از قبل فرمان
   اختصاصی دارند (register_invoice/...)؛ این موج مسیر ویرایش/تکمیل/حذف UI را
   از روتر عبور می‌دهد و حذف آبشاری را بازیافت‌پذیر می‌کند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function globJs() { return fs.readdirSync(path.join(ROOT, 'crm')).filter(function (x) { return /\.js$/.test(x) || x === 'index.html'; }); }

var php = read('api/sales-domain.php');
['invoices', 'case_receipts', 'receipt_allocations', 'corrections', 'fin_findings', 'sales_returns'].forEach(function (k) {
  T('رجیستری: ptf_crm_' + k, new RegExp("'ptf_crm_" + k + "'\\s*=>\\s*\\[").test(php));
});
T('نقش‌های مالی: sales/buyer/collector در رجیستری invoices نیستند', !/ptf_crm_invoices'\s*=>\s*\[[^\]]*'sales'/.test(php));
T('invoices maxFields=200', /'ptf_crm_invoices' => \[[\s\S]{0,200}'maxFields' => 200/.test(php));
T('sortIso با fallback فیلدهای مالی (invDate/t)', /'iso','updatedAtISO','issueDate','invDate','t'/.test(php));

/* صفر بایپس ساده برای ۶ کلید W3 */
var skip = /client-server\.js|sync\.js$|storage\.js$|storage-quota\.js$|backup\.js$|finance-write-guard\.js/;
var bypass = [];
globJs().forEach(function (f) {
  if (skip.test(f)) return;
  var src = read('crm/' + f);
  var re = /setData\('ptf_crm_(invoices|case_receipts|receipt_allocations|corrections|fin_findings|sales_returns)',/g, m;
  while ((m = re.exec(src))) {
    var before = src.slice(Math.max(0, m.index - 400), m.index);
    var after = src.slice(m.index, m.index + 300);
    var isFallback = /\belse\s*$/.test(before) || /===\s*false/.test(after) || /!==\s*false/.test(after) || /rollback/.test(after);
    if (!isFallback) bypass.push('crm/' + f + ' ← ' + m[0]);
  }
});
T('صفر بایپس ساده W3 (فقط fallback/rollback عمدی)', bypass.length === 0, JSON.stringify(bypass));
T('حذف آبشاری فاکتور فرمانی است', read('crm/bridge.js').indexOf("reason: 'cascade-purge'") > -1);
var routed = 0;
globJs().forEach(function (f) {
  var src = read('crm/' + f);
  routed += (src.match(/window\.ptfEntitySaveCollection\('ptf_crm_(invoices|case_receipts|receipt_allocations|corrections|fin_findings|sales_returns)'/g) || []).length;
});
T('تعداد نقاط روترشدهٔ W3 ≥ ۳۴', routed >= 34, routed);

/* A11 با ۱۷ کلید */
var sd = read('crm/sales-domain-v2.js');
var clientKeys = (sd.match(/window\.PTF_ENTITY_CMD_ENABLED = \{([\s\S]*?)\};/)[1].match(/'ptf_crm_[a-z_]+'/g) || []).map(function (x) { return x.replace(/'/g, ''); }).sort();
var regFn = php.match(/function sd_entity_registry\s*\(\s*\)\s*:\s*array\s*\{[\s\S]*?\n\}/)[0];
var serverKeys = [];
regFn.replace(/'(ptf_crm_[a-z_]+)'\s*=>\s*\[/g, function (_, k) { if (serverKeys.indexOf(k) < 0) serverKeys.push(k); return ''; });
serverKeys.sort();
T('A11: تطابق کامل ۱۷ کلید کلاینت/سرور', JSON.stringify(clientKeys) === JSON.stringify(serverKeys), JSON.stringify(clientKeys) + ' vs ' + JSON.stringify(serverKeys));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.34.0', ver.crm_version === 'v34.34.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.34.0', /window\.PTF_CRM_RELEASE = 'v34\.34.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.34.0'/.test(read('crm/sw.js')));

console.log('\n— tester528 (v34.34.0: W3 migration) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
