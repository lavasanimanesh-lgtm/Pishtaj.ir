#!/usr/bin/env node
'use strict';
/* v34.36.3 — PHASE-C1: اندازه‌گیری مبنای نازک‌سازی.
   ۱) تله‌متری push سمت سرور به تفکیک کلید (زیر flock موجود data_push)
   ۲) endpoint فقط‌خواندنی sync_stats (ادمین/رئیس)
   ۳) سند رتبه‌بندی مجموعه‌های داغ از تحلیل ایستا */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var api = read('api/crm.php');
var doc = read('PHASE-C1-HOT-COLLECTIONS.md');

T('VERSION.json = v34.36.3', ver.crm_version === 'v34.36.3', ver.crm_version);
T('تله‌متری push در data_push نوشته می‌شود', /PHASE-C1 — اندازه‌گیری[\s\S]{0,200}push_stats\.json/.test(api));
T('شمارش تعارض و reject تفکیک‌شده ثبت می‌شود', /\$row\['conflicts'\][\s\S]{0,200}\$row\['rejects'\]/.test(api));
T('نوشتن stats اتمیک است (tmp+rename)', /tmpS = \$statsFile \. '\.tmp\.'[\s\S]{0,200}@rename\(\$tmpS, \$statsFile\)/.test(api));
T('تله‌متری در data_push پس از نوشتن meta اجرا می‌شود (همان بخش قفل‌دار)', (function () {
  var iMeta = api.indexOf("file_put_contents($meta_file, json_encode($meta, JSON_UNESCAPED_UNICODE), LOCK_EX);");
  var iStats = api.indexOf('PHASE-C1 — اندازه‌گیری');
  var iUnlock = api.indexOf('flock($metaLock, LOCK_UN)', iMeta);
  return iMeta > -1 && iStats > iMeta && (iUnlock === -1 || iStats < iUnlock);
})());
T('endpoint sync_stats فقط-خواندنی تعریف شد', /case 'sync_stats':/.test(api));
T('sync_stats گارد نقش دارد (users_write)', /case 'sync_stats':[\s\S]{0,400}role_guard\('users_write'\)/.test(api));
T('sync_stats مرتب‌شده بر اساس تعداد push برمی‌گرداند', /\$b\['pushes'\] <=> \$a\['pushes'\]/.test(api));
T('sync_stats avgBytes محاسبه می‌کند', /avgBytes/.test(api));

/* شبیه‌سازی: تجمیع شمارش‌ها */
(function behavior() {
  var stats = {};
  function record(saved, conflicts) {
    Array.from(new Set(saved.concat(conflicts))).forEach(function (k) {
      var r = stats[k] = stats[k] || { n: 0, conflicts: 0 };
      r.n++; if (conflicts.indexOf(k) >= 0) r.conflicts++;
    });
  }
  record(['ptf_crm_invoices'], []);
  record(['ptf_crm_invoices'], []);
  record(['ptf_crm_rfqs'], ['ptf_crm_rfqs']);
  var top = Object.keys(stats).sort(function (a, b) { return stats[b].n - stats[a].n; })[0];
  T('شبیه‌سازی: مجموعهٔ پرتکرار بالای جدول می‌ماند و تعارضش ثبت شده', top === 'ptf_crm_invoices' && stats['ptf_crm_rfqs'].conflicts === 1);
})();

T('سند C1 با رتبه‌بندی ایستا موجود است', /ptf_crm_invoices[\s\S]{0,80}۲۹/.test(doc) || doc.indexOf('ptf_crm_invoices') > -1);
T('سند C1 تأکید می‌کند مالی فرمان‌محور است', /فرمان‌محور از v34\.8\.6/.test(doc));

console.log('\n— tester516 (v34.36.3: PHASE-C1 اندازه‌گیری) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
