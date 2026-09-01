#!/usr/bin/env node
'use strict';
/* v34.19.0 — خود-تشخیص همگام‌سازی (SYNC-DIAG-001).
   بدون تغییر منطق نوشتن؛ فقط:
   - تست اتصال دقیق‌تر با data_rev (محافظت‌شده) به‌جای users_get عمومی؛
   - ثبت آخرین خطای push/pull برای نمایش؛
   - باکس «تشخیص همگام‌سازی» در تنظیمات. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var sync = read('crm/sync.js');
var bak = read('crm/backup.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.19.0', ver.crm_version === 'v34.19.0', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.19.0', /window\.PTF_CRM_RELEASE = 'v34\.19.0'/.test(idx));
T('sw.js RELEASE = v34.19.0', /RELEASE = 'v34\.19.0'/.test(sw));
T('sync.js cache-bust 34.19.0', /sync\.js\?v=34\.19.0/.test(idx));
T('backup.js cache-bust 34.19.0', /backup\.js\?v=34\.19.0/.test(idx));

/* ---------- تشخیص سرور ---------- */
T('ptfSyncServerStatus تعریف شده', /window\.ptfSyncServerStatus = function/.test(sync));
T('تست دقیق از data_rev (محافظت‌شده) استفاده می‌کند', sync.indexOf("'data_rev'") > -1 && /fetch\(revStatusUrl/.test(sync) && sync.indexOf("fetch(API + '?action=data_rev')") < 0);
T('data_rev همچنان محافظت‌شده است', /case 'data_rev':[\s\S]*?verify_request\(\);/.test(read('api/crm.php')));

/* ---------- ثبت خطا ---------- */
T('ptfSyncLastError تعریف شده', /window\.ptfSyncLastError = readSyncLastError/.test(sync));
T('خطای push ثبت می‌شود', sync.indexOf("noteSyncError('push',") > -1);
T('خطای pull ثبت می‌شود', sync.indexOf("noteSyncError('pull',") > -1);

/* ---------- باکس تشخیص ---------- */
T('ptfSyncDiagnosticsHtml تعریف شده', /window\.ptfSyncDiagnosticsHtml = function/.test(sync));
T('ptfSyncDiagnosticsRefresh تعریف شده', /window\.ptfSyncDiagnosticsRefresh = function/.test(sync));
T('دکمهٔ بررسی اتصال/نشست', sync.indexOf('ptfSyncRunDiagnostics()') > -1);
T('باکس تشخیص در تنظیمات تزریق شده', bak.indexOf('window.ptfSyncDiagnosticsHtml') > -1 && bak.indexOf('ptfSyncDiagnosticsRefresh') > -1);

/* ---------- fallback اتصال ---------- */
T('بررسی اتصال ابتدا ptfSyncServerStatus را صدا می‌زند', bak.indexOf("typeof window.ptfSyncServerStatus === 'function'") > -1);
T('fallback users_get حفظ شده', /action=users_get/.test(bak));
T('دکمهٔ دستی بررسی اتصال هنوز در UI نیست', bak.indexOf('onclick="ptfBackupServerCheck()"') === -1);

T('tester484 در گیت CI', gate.indexOf('tester484-v34.7.91-sync-diagnostics.js') > -1);

console.log('\n— tester484 (v34.19.0: خود-تشخیص همگام‌سازی — SYNC-DIAG-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
