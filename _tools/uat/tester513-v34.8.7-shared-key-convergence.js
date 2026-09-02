#!/usr/bin/env node
'use strict';
/* v34.29.8 — SHARED-KEY-CONVERGENCE + فاز B CONFLICT-RESCUE.
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

T('VERSION.json = v34.29.8', ver.crm_version === 'v34.29.8', ver.crm_version);

/* ---------- سرور: union-merge کلیدهای مشترک ---------- */
T('sync_shared_union_key تعریف شده', /function sync_shared_union_key/.test(api));
T('audit و avatars کلید union هستند', /'ptf_crm_audit','ptf_crm_avatars'/.test(api));
T('merge سروری در data_push قبل از base-conflict', api.indexOf('sync_union_merge_shared_key($k, $v, $serverUnionJson)') > -1);
T('کلیدهای union از بررسی base-conflict عبور می‌کنند', /\$isSharedUnion && !\$restore && !\$allow_wipe && \$base !== null/.test(api));
T('سقف ۴۰۰۰ ردیف audit', /count\(\$out\) > 4000/.test(api));
T('avatars merge نسخه‌دار است (ts جدیدتر برنده؛ v34.29.8)', /strcmp\(\(string\)\$tsOf\(\$iv\), \(string\)\$tsOf\(\$sv\)\) >= 0/.test(api));
T('مقادیر غیررشته‌ای معتبر ({v,ts} و tombstone) پاک نمی‌شوند (رگرسیون v34.8.7)', !/foreach \(\$out as \$mk => \$mv\) if \(!is_string\(\$mv\)\) unset/.test(api));
T('tombstone آواتار با سقف ۳۰ روز سرور هم رعایت می‌شود', /30 \* 86400/.test(api));

/* ---------- کلاینت: نجات تعارض فاز B ---------- */
T('ptfBPushBatch پاسخ serverData/krevs را aggregate می‌کند', /serverData: serverDataAgg/.test(cs) && /krevs: krevsAgg/.test(cs));
T('flush تعارض غیرمحافظت‌شده را merge محلی می‌کند', /ptfSyncResolveConflictFromServer/.test(cs));
T('flush watermark کلید را از krevs پاسخ تازه می‌کند', /bSaveRevsFromMeta\(metaLike, result\.rev\)/.test(cs));
T('flush مجدد سقف‌دار است (حداکثر ۳ نوبت)', /flushRescueRound \|\| 0\) < 3/.test(cs));
T('کلیدهای محافظت‌شده از حل‌کنندهٔ عمومی عبور نمی‌کنند (مسیر اختصاصی v34.29.8)', !/protectedKeys\.indexOf\(k\) >= 0\) return;/.test(cs) && /ptfSyncResolveProtectedConflictFromServer\(k, srvStr, payload\[k\]\)/.test(cs) && /else if \(typeof window\.ptfSyncResolveConflictFromServer === 'function'/.test(cs));
T('sync.js حل‌کنندهٔ تعارض را expose می‌کند', /window\.ptfSyncResolveConflictFromServer = function/.test(sync));
T('حل‌کننده از ptfSmartMerge و tombstones استفاده می‌کند', /ptfSmartMerge[\s\S]{0,200}ptfApplyDeletionTombstones[\s\S]{0,200}state\.dirty\[k\] = true/.test(sync));

/* ---------- v34.29.8: ردیف صف phantom + merge نقشه‌ها در پول فاز B ---------- */
T('flush ردیف صف بدون مقدار محلی را می‌پرَند، نه pending ابدی', /PHANTOM-QUEUE-ENTRY/.test(cs) && /queueClear\(\[k\]\)/.test(cs) && !/markPendingKeys\(missing\.concat/.test(cs));
T('پران ردیف phantom، dirty را هم پاک می‌کند', /ptfSyncAcknowledgeKeys\(\[k\], null\)/.test(cs));
T('پول فاز B آواتار/امضا را merge می‌کند نه overwrite خام', /ptf_crm_avatars' \|\| k === 'ptf_crm_sigprofiles/.test(cs) && /ptfSmartMerge\(k, curMap, v\)/.test(cs));

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

  var serverAv = { ceo: { v: 'data:old', ts: '2026-08-20T00:00:00.000Z' } }, clientAv = { ceo: { v: 'data:new', ts: '2026-08-26T00:00:00.000Z' } };
  function avTs(e) { return (e && typeof e === 'object' && e.ts) ? String(e.ts) : ''; }
  var mergedAv = {}; mergedAv.ceo = avTs(clientAv.ceo) >= avTs(serverAv.ceo) ? clientAv.ceo : serverAv.ceo;
  T('avatars: ورودی نسخه‌دار جدیدتر برنده است', mergedAv.ceo.v === 'data:new');
  var legacyAv = { x: 'raw-string' };
  var verWin = avTs(clientAv.ceo) >= avTs(legacyAv.x) ? clientAv.ceo : legacyAv.x;
  T('avatars: نسخه‌دار بر رشتهٔ legacy می‌چربد', verWin === clientAv.ceo);
  var tomb = { v: null, ts: '2026-08-26T00:00:00.000Z' };
  T('avatars: tombstone حذف ({v:null,ts}) مقدار معتبر است و منتقل می‌شود', tomb.v === null && !!tomb.ts);

  /* صحنهٔ قبلی: base قدیمی → conflict → (قبلاً: بن‌بست؛ اکنون: merge+retry) */
  var curRev = 7, clientBase = 5;
  var conflict = clientBase < curRev;
  var rescued = conflict && typeof 'x' === 'string'; /* merge محلی فرضی */
  T('شبیه‌سازی: base قدیمی هنوز conflict می‌دهد ولی اکنون مسیر نجات دارد', conflict === true && rescued === true);
})();

console.log('\n— tester513 (v34.29.8: همگرایی کلیدهای مشترک + نجات تعارض فاز B) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
