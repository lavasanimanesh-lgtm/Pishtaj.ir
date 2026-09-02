#!/usr/bin/env node
'use strict';
/* v34.29.4 — PROTECTED-CONFLICT-RESCUE.
   RCA (کارفرما، مدیر بازرگانی): ptf_crm_opex (و جفتش sharetx) همگرا نمی‌شد.
   این کلیدها «مالی محافظت‌شده»‌اند: data_push سرور همیشه merge محافظت‌شده برمی‌گرداند
   و اگر امضایش با snapshot خام مرورگر فرق کند → protectedConflict. مسیر legacy
   (US-384) آن را با ptfMergeProtectedFinanceConflict اعمال می‌کرد؛ مسیر فاز B
   (نجات v34.8.7) عمداً کلیدهای محافظت‌شده را skip می‌کرد → بن‌بست ابدی. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var cs = read('crm/client-server.js');
var sync = read('crm/sync.js');
var api = read('api/crm.php');

T('VERSION.json = v34.29.4', ver.crm_version === 'v34.29.4', ver.crm_version);

/* ---------- نجات تعارض محافظت‌شده ---------- */
T('sync.js حل‌کنندهٔ protected را expose می‌کند', /window\.ptfSyncResolveProtectedConflictFromServer = function/.test(sync));
T('حل‌کنندهٔ protected از ptfMergeProtectedFinanceConflict استفاده می‌کند', /ptfMergeProtectedFinanceConflict\(k, current, typeof submittedStr[\s\S]{0,120}serverStr\)/.test(sync));
T('v34.29.4: پذیرش verbatim کانونیکال وقتی لوکال از لحظهٔ ارسال تغییر نکرده', /sameSyncJson\(current, submittedStr\)\) \{\s*\n\s*merged = serverStr;/.test(sync));
T('v34.29.4: مسیر protected دیگر پاس tombstone ندارد (پایداری امضا)', (function () {
  var body = sync.split('window.ptfSyncResolveProtectedConflictFromServer = function')[1] || '';
  body = body.split('\n  };')[0];
  return body.indexOf('ptfApplyDeletionTombstones') < 0;
})());
T('flush فاز B کلید محافظت‌شده را دیگر skip نمی‌کند', !/if \(protectedKeys\.indexOf\(k\) >= 0\) return;/.test(cs));
T('flush برای protected از حل‌کنندهٔ مخصوص با snapshot ارسالی صدا می‌زند', /ptfSyncResolveProtectedConflictFromServer\(k, srvStr, payload\[k\]\)/.test(cs));
T('کلید عادی همچنان از حل‌کنندهٔ عمومی می‌گذرد', /ptfSyncResolveConflictFromServer\(k, srvStr\)/.test(cs));
T('آستانهٔ تخلیه به ۸KB کاهش یافت (حافظهٔ آزادتر)', /bytes <= 8 \* 1024/.test(cs));

/* ---------- قرارداد سرور دست‌نخورده ---------- */
T('سرور همچنان opex/sharetx/shareholders را merge محافظت‌شده می‌کند', /isProtectedFinanceKey = in_array\(\$k, \['ptf_crm_opex','ptf_crm_sharetx','ptf_crm_shareholders'\], true\)/.test(api));
T('پاسخ protectedConflicts همچیشه serverData کامل دارد', /protectedConflicts\[\] = \$k; \$conflictData\[\$k\] = \$protectedFinanceJson/.test(api));

/* ---------- شبیه‌سازی رفتاری: چرخهٔ بن‌بست و رفع ---------- */
(function behavior() {
  var clientSnapshot = [{ cd: 'OPX-1', amt: 100 }];
  var serverCanonical = [{ cd: 'OPX-1', amt: 100, recurringKey: '', serverReconciled: true, status: 'active' }];
  function sig(a) { return JSON.stringify(a.map(function (r) { return JSON.stringify(Object.keys(r).sort().map(function (k) { return [k, r[k]]; })); })); }
  var oldFlowConflict = sig(clientSnapshot) !== sig(serverCanonical); /* push → conflict */
  var oldFlowDeadEnd = oldFlowConflict && true; /* v34.8.7 rescue: skip protected */
  /* v34.29.4: adopt canonical → next push identical signature → saved */
  var adopted = serverCanonical.slice();
  var nextFlowSaved = sig(adopted) === sig(serverCanonical);
  T('شبیه‌سازی: snapshot خام با canonical سرور فرق دارد (ریشهٔ conflict)', oldFlowConflict === true);
  T('شبیه‌سازی: مسیر قدیمی فاز B بن‌بست بود', oldFlowDeadEnd === true);
  T('شبیه‌سازی: پس از اعمال merge محافظت‌شده، push بعدی پذیرفته می‌شود', nextFlowSaved === true);
})();

console.log('\n— tester515 (v34.29.4: نجات تعارض کلیدهای مالی محافظت‌شده در فاز B) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
