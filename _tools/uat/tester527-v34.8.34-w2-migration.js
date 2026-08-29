#!/usr/bin/env node
'use strict';
/* tester527 — v34.8.46 (W2): مهاجرت فرمانی درخواست‌ها/پرونده‌ها/پروژه‌ها + اقلام/پکینگ/کارتابل.
   ۸۹ نقطهٔ نوشتن از ۲۳ فایل به روتر فرمانی منتقل شد؛ فقط ۳ مقایسهٔ واقعی برگشت setData
   (جریان کنترل خطای smart-chat/بازرسی) و fallbackهای else عمداً legacy ماندند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function globJs() { return fs.readdirSync(path.join(ROOT, 'crm')).filter(function (x) { return /\.js$/.test(x) || x === 'index.html'; }); }

/* ---------- سرور ---------- */
var php = read('api/sales-domain.php');
['rfqs', 'deals', 'projects', 'inqitems', 'packinglists', 'notifs'].forEach(function (k) {
  T('رجیستری: ptf_crm_' + k + ' اضافه شد', new RegExp("'ptf_crm_" + k + "'\\s*=>\\s*\\[").test(php));
});
T('notifs: sortIso=true', /'ptf_crm_notifs' => \[[\s\S]{0,200}'sortIso' => true/.test(php));
T('sortIso روی هر دو مسیر upsert/delete اعمال می‌شود', php.indexOf("usort($changes[$collection]") > php.indexOf("elseif ($action === 'entity_upsert'"));
T('deals maxFields=150 (رکوردهای تودرتو)', /'ptf_crm_deals' => \[[\s\S]{0,200}'maxFields' => 150/.test(php));

/* ---------- کلاینت: صفر بایپس ساده برای ۶ کلید ---------- */
var skip = /client-server\.js|sync\.js$|storage\.js$|storage-quota\.js$|backup\.js$|rbac\.js$|finance-write-guard\.js/;
var bypass = [];
globJs().forEach(function (f) {
  if (skip.test(f)) return;
  var src = read('crm/' + f);
  var re = /setData\('ptf_crm_(rfqs|deals|projects|inqitems|packinglists|notifs)',/g, m;
  while ((m = re.exec(src))) {
    var before = src.slice(Math.max(0, m.index - 400), m.index);
    var after = src.slice(m.index, m.index + 300);
    var isFallback = /\belse\s*$/.test(before) || /===\s*false/.test(after) || /!==\s*false/.test(after);
    if (!isFallback) bypass.push('crm/' + f + ' ← ' + m[0]);
  }
});
T('صفر بایپس ساده باقی مانده (فقط else-fallback و مقایسه‌های === false)', bypass.length === 0, JSON.stringify(bypass));
T('حذف درخواست (waterfall) فرمان tombstone است', read('crm/bridge.js').indexOf("reason: 'rfq-delete'") > -1);
T('تعداد کل نقاط روترشدهٔ W2 ≥ ۸۵', (function () {
  var n = 0;
  globJs().forEach(function (f) {
    var src = read('crm/' + f);
    n += (src.match(/window\.ptfEntitySaveCollection\('ptf_crm_(rfqs|deals|projects|inqitems|packinglists|notifs)'/g) || []).length;
  });
  return n;
})() >= 85);

/* ---------- A11: تطابق رجیستری کلاینت/سرور (۱۱ کلید) ---------- */
var sd = read('crm/sales-domain-v2.js');
var clientKeys = (sd.match(/window\.PTF_ENTITY_CMD_ENABLED = \{([\s\S]*?)\};/)[1].match(/'ptf_crm_[a-z_]+'/g) || []).map(function (x) { return x.replace(/'/g, ''); }).sort();
var regFn = php.match(/function sd_entity_registry\s*\(\s*\)\s*:\s*array\s*\{[\s\S]*?\n\}/)[0];
var serverKeys = [];
regFn.replace(/'(ptf_crm_[a-z_]+)'\s*=>\s*\[/g, function (_, k) { if (serverKeys.indexOf(k) < 0) serverKeys.push(k); return ''; });
serverKeys.sort();
T('A11: تطابق کامل ۱۱ کلید کلاینت/سرور', JSON.stringify(clientKeys) === JSON.stringify(serverKeys), JSON.stringify(clientKeys) + ' vs ' + JSON.stringify(serverKeys));

/* ---------- نسخه ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.46', ver.crm_version === 'v34.8.46', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.8.46', /window\.PTF_CRM_RELEASE = 'v34\.8.46'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.8.46'/.test(read('crm/sw.js')));

console.log('\n— tester527 (v34.8.46: W2 migration) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
