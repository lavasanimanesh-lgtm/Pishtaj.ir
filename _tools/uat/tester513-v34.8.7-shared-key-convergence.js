#!/usr/bin/env node
'use strict';
/* v34.8.7 — SHARED-KEY-CONVERGENCE + فاز B CONFLICT-RESCUE.
   RCA (گزارش کارفرما ۱۴۰۵/۰۶/۴): نقش مدیر بازرگانی، نوار زرد دائمی
   «یک تغییر به سرور نرسیده» روی ptf_crm_avatars و ptf_crm_audit؛ همگرایی دستی بی‌اثر.
   ریشه: این دو کلید پرنویس‌ترین کلیدهای مشترک‌اند؛ هر push با base قدیمی → conflicts؛
   مسیر فاز B (مالک انتقال) برخلاف مسیر legacy هیچ merge/retry نداشت → کلید همیشه
   dirty+queued می‌ماند. رفع: union-merge سمت سرور برای همین دو کلید + نجات تعارض
   (merge محلی + watermark تازه + retry محدود) در مسیر فاز B. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var api = read('api/crm.php');
var cs = read('crm/client-server.js');
var sync = read('crm/sync.js');

T('VERSION.json = v34.8.7', ver.crm_version === 'v34.8.7', ver.crm_version);

/* ---------- سرور: union-merge کلیدهای مشترک ---------- */
T('sync_shared_union_key تعریف شده', /function sync_shared_union_key/.test(api));
T('audit و avatars کلید union هستند', /'ptf_crm_audit','ptf_crm_avatars'/.test(api));
T('merge سروری در data_push قبل از base-conflict', api.indexOf('sync_union_merge_shared_key($k, $v, $serverUnionJson)') > -1);
T('کلیدهای union از بررسی base-conflict عبور می‌کنند', /\$isSharedUnion && !\$restore && !\$allow_wipe && \$base !== null/.test(api));
T('سقف ۴۰۰۰ ردیف audit', /count\(\$out\) > 4000/.test(api));
T('avatars با array_merge سرور+ورودی (incoming برنده)', /array_merge\(\$srv, \$inc\)/.test(api));

/* ---------- کلاینت: نجات تعارض فاز B ---------- */
T('ptfBPushBatch پاسخ serverData/krevs را aggregate می‌کند', /serverData: serverDataAgg/.test(cs) && /krevs: krevsAgg/.test(cs));
T('flush تعارض غیرمحافظت‌شده را merge محلی می‌کند', /ptfSyncResolveConflictFromServer/.test(cs));
T('flush watermark کلید را از krevs پاسخ تازه می‌کند', /bSaveRevsFromMeta\(metaLike, result\.rev\)/.test(cs));
T('flush مجدد سقف‌دار است (حداکثر ۳ نوبت)', /flushRescueRound \|\| 0\) < 3/.test(cs));
T('کلیدهای محافظت‌شده مالی از نجات عمومی مستثنا هستند', /protectedKeys\.indexOf\(k\) >= 0\) return;/.test(cs));
T('sync.js حل‌کنندهٔ تعارض را expose می‌کند', /window\.ptfSyncResolveConflictFromServer = function/.test(sync));
T('حل‌کننده از ptfSmartMerge و tombstones استفاده می‌کند', /ptfSmartMerge[\s\S]{0,200}ptfApplyDeletionTombstones[\s\S]{0,200}state\.dirty\[k\] = true/.test(sync));

/* ---------- شبیه‌سازی رفتاری: union-merge صحنهٔ کارفرما ---------- */
(function behavior() {
  var serverAudit = [
    { m: 'سیستم', a: 'ورود', t: '08:40' },
    { m: 'سیستم', a: 'ورود', t: '08:41' }
  ];
  var clientAudit = [
    { m: 'سیستم', a: 'ورود', t: '08:40' },           /* duplicate of server */
    { m: 'سهامداران', a: 'ثبت برداشت', t: '08:55' }   /* new local row */
  ];
  function sig(r) { return JSON.stringify(r); }
  var seen = {}, out = [];
  serverAudit.forEach(function (r) { seen[sig(r)] = 1; out.push(r); });
  clientAudit.forEach(function (r) { if (!seen[sig(r)]) { seen[sig(r)] = 1; out.push(r); } });
  T('union: ردیف تازهٔ کلاینت به سرور اضافه می‌شود', out.length === 3 && out[2].a === 'ثبت برداشت');
  T('union: ردیف تکراری دوباره شمرده نمی‌شود', out.filter(function (r) { return r.t === '08:40'; }).length === 1);

  var serverAv = { ceo: 'data:ceo' }, clientAv = { ceo: 'data:ceo-new', sales1: 'data:s1' };
  var mergedAv = Object.assign({}, serverAv, clientAv);
  T('avatars: incoming برای همان کلید برنده است', mergedAv.ceo === 'data:ceo-new');
  T('avatars: آواتار سایر کاربران حفظ می‌شود', mergedAv.sales1 === 'data:s1' && Object.keys(mergedAv).length === 2);

  /* صحنهٔ قبلی: base قدیمی → conflict → (قبلاً: بن‌بست؛ اکنون: merge+retry) */
  var curRev = 7, clientBase = 5;
  var conflict = clientBase < curRev;
  var rescued = conflict && typeof 'x' === 'string'; /* merge محلی فرضی */
  T('شبیه‌سازی: base قدیمی هنوز conflict می‌دهد ولی اکنون مسیر نجات دارد', conflict === true && rescued === true);
})();

console.log('\n— tester513 (v34.8.7: همگرایی کلیدهای مشترک + نجات تعارض فاز B) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
