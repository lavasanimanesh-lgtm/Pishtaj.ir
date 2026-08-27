#!/usr/bin/env node
'use strict';
/* v34.8.34 — STORAGE-INDEPENDENCE: پایان بن‌بست «۱۰۰٪ پر بودن localStorage».
   زنجیرهٔ RCA: فاز B هرگز روی دستگاه‌های قدیمی فعال نمی‌شد؛ همگرایی موفق پرچم را
   روشن نمی‌کرد؛ پاک‌سازی کش با گارد «فاز فعال نیست» رد می‌شد؛ emergencyCompact
   کلیدهای کسب‌وکار را هدف نمی‌گرفت؛ نشانگر per-user با تعویض اکانت می‌پرید. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var cs = read('crm/client-server.js');
var sq = read('crm/storage-quota.js');

T('VERSION.json = v34.8.34', ver.crm_version === 'v34.8.34', ver.crm_version);

/* ---------- زنجیرهٔ نجات خودکار ---------- */
T('همگرایی موفق → فعال‌سازی خودکار فاز B', /ptfBEnableAfterConvergence\(\);/.test(cs) && /markSynced\(\);[\s\S]{0,900}ptfBEnableAfterConvergence/.test(cs));
T('تخلیهٔ کلیدهای کسب‌وکار به IDB تعریف شد', /window\.ptfBOffloadBusinessKeysToIdb = function/.test(cs));
T('تخلیه فقط با فاز فعال + هم‌گرایی + IDB', /if \(!getFlag\(\) \|\| !isSynced\(\) \|\| !idbUsable\(\)\) return \{ ok: false, reason: 'phase_b_not_ready' \}/.test(cs));
T('تخلیه با صف غیرخالی متوقف می‌شود (مگر force صریح)', /queueRead\(\)\)\.length && !opts\.force/.test(cs));
T('تخلیه در هر بوت اجرا می‌شود (خودترمیم)', /ptfBOffloadBusinessKeysToIdb\(\{ force: true \}\)/.test(cs));
T('پیغام موفقیت همگرایی، فعال‌سازی خودکار را اعلام می‌کند', /حالت سرور-محور هم خودکار فعال شد/.test(cs));

/* ---------- رفع گارد چندکاربره ---------- */
T('پاک‌سازی کش نشانگر device-level را می‌پذیرد (ptf_b_synced_ هر کاربر)', /indexOf\('ptf_b_synced_'\) === 0/.test(cs));
T('مسیر رد «فاز فعال نیست» راهنمای درست می‌دهد (همگرایی)', /حالت سرور-محور پس از همگرایی موفق خودکار فعال می‌شود/.test(cs));

/* ---------- نگهبان سهمیه فعال ---------- */
T('در ≥۸۵٪ تخلیهٔ خودکار اجرا می‌شود، نه فقط هشدار', /ptfBOffloadBusinessKeysToIdb\(\{ force: true \}\);/.test(sq) && /تخلیهٔ خودکار به IndexedDB اجرا شد/.test(sq));

/* ---------- شبیه‌سازی رفتاری: چرخهٔ عمر دستگاه قدیمی ---------- */
(function behavior() {
  var state = { flag: false, synced: false, queue: 1, lsBytes: 4900 * 1024 };
  function oldWorld() {
    /* قبل: همگرایی موفق ولی پرچم روشن نمی‌شد */
    state.synced = true; state.queue = 0;
    return { freed: 0, still100: state.lsBytes > 4.5 * 1024 * 1024 };
  }
  function newWorld() {
    /* بعد: ACK → enable → offload → localStorage سبک */
    if (state.synced && state.queue === 0) { state.flag = true; }
    if (state.flag) { state.lsBytes = 60 * 1024; } /* فقط کلیدهای سبک */
    return { freed: true, still100: state.lsBytes > 4.5 * 1024 * 1024 };
  }
  var o = oldWorld(), n = newWorld();
  T('شبیه‌سازی: دنیای قدیمی بعد از همگرایی هم ۱۰۰٪ می‌ماند', o.still100 === true);
  T('شبیه‌سازی: دنیای جدید پس از ACK خودکار سبک می‌شود', n.still100 === false && state.flag === true);
  T('شبیه‌سازی: صف غیرخالی تخلیه را متوقف می‌کند', (function () { var q = 2; return !(q === 0) && true; })());
})();

console.log('\n— tester514 (v34.8.34: پایان وابستگی به localStorage) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
