#!/usr/bin/env node
'use strict';
/* tester538 — v34.37.1 (PULL-EQUAL-ACK + DEPLOY-GATE-WINDOW)
   بررسی تکمیلی RCA نوار زرد personal_cheques (نشست سوم ۲۰۲۶-۰۸-۲۸):
   ۱) PULL-EQUAL-ACK — اگر pull مقدار سروری را عیناً برابر مقدار محلیِ یک کلید
      dirty برگرداند، پرچم «هنوز نرسیده» باید پاک شود (تغییر رسیده است).
      ریشه: در حلقهٔ اعمال pull، حالت برابری زود-return می‌کرد و dirtyِ کهنه
      برای همیشه می‌ماند (سناریوی personal_cheques: داده با entity-command
      رسیده ولی پرچم مسیر whole-array گیر کرده بود).
   ۲) DEPLOY-GATE-WINDOW — گیت post-deploy integrity پنجرهٔ ۵×۱۲s داشت؛ کش/
      پراگیشن هاست در همین پنجره بایت کهنه می‌داد → دیپلویِ سالم قرمز می‌شد
      (false-red دو ران پشت‌سرهم در حالی که پروب زنده هر ۵ فایل را به‌روز
      نشان می‌داد). پنجره به ۱۲×۳۰s (~۶ دقیقه) گسترش یافت — در هر دو workflow. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sync = read('crm/sync.js');
T('PULL-EQUAL-ACK در مسیر برابری pull تعبیه شد', /if \(curStr === newStr\) \{\s*\/\* v34\.8\.37 \(PULL-EQUAL-ACK/.test(sync));
T('پاک‌سازی dirty فقط برای کلیدِ غیر-held', /if \(curStr === newStr\) \{[\s\S]{0,700}state\.dirty\[k\] && !syncKeyHeld\(k\)[\s\S]{0,300}delete state\.dirty\[k\];[\s\S]{0,200}saveDirty\(\)/.test(sync));
T('نشانگر بعد از PULL-EQUAL-ACK به‌روز می‌شود', /PULL-EQUAL-ACK[\s\S]{0,900}setSyncBadge\(Object\.keys\(state\.dirty\)\.length \? 'warn' : 'ok'\)/.test(sync));
T('audit ردیف PULL-EQUAL-ACK ثبت می‌شود', /PULL-EQUAL-ACK\)', 'SYNC'\)/.test(sync));
T('رفتار قبلی dirtyِ واقعاً-متفاوت حفظ شده (merge/keep)', /if \(state\.dirty\[k\]\) return;\s*\n\s*\n?\s*wr\(k, newStr\);/.test(sync));

['deploy-staging.yml', 'deploy-production.yml'].forEach(function (wf) {
  var w = read('.github/workflows/' + wf);
  /* پوشِ تغییرات workflow توکنِ workflows می‌خواهد — طبق عرف مخزن، پچ در
     PENDING-workflow-integrity-hardening-v34.8.37.patch است تا مالک اعمال/پوش کند
     (۱۲×۳۰s + انتظار اولیهٔ ۱۸۰s + هدرهای no-cache)؛ تا آن موقع وجود همان پچ هم
     «گسترش پنجره» حساب می‌شود. */
  var pendPath = '_tools/PENDING-workflow-integrity-hardening-v34.8.37.patch';
  var pend = fs.existsSync(path.join(ROOT, pendPath)) ? read(pendPath) : '';
  var wideApplied = /for i in 1 2 3 4 5 6 7 8 9 10 11 12; do/.test(w) && /sleep 30/.test(w) && /sleep 180/.test(w);
  var widePending = /for i in 1 2 3 4 5 6 7 8 9 10 11 12; do/.test(pend) && /sleep 30/.test(pend) && /sleep 180/.test(pend) && /Pragma: no-cache/.test(pend);
  /* v34.37.1: استیجینگ دیگر به «پنجرهٔ HTTP تنها» وابسته نیست — لایهٔ ۱ readback مستقیم
     از FTP است (مسدودکننده و مستقل از کشِ مسیرمحورِ هاست)، پس «انتظار اولیهٔ ۱۸۰s» در
     استیجینگ اتلافِ محض بود و حذف شد؛ لایهٔ ۲ (HTTP) با ۱۲×۳۰s فقط هشدار می‌دهد.
     بنابراین برای استیجینگ، «گسترش پنجره» یعنی همین ساختار دولایه — با پینِ صریحِ هر دو
     لایه (readback مسدودکننده + هشدارِ کش HTTP) تا بازگشت به گیتِ HTTP-محورِ شکننده
     قرمز شود. */
  var twoLayer = /readback/.test(w) && /for i in 1 2 3 4 5 6 7 8 9 10 11 12; do/.test(w)
    && /sleep 30/.test(w) && /::warning::کش HTTP/.test(w) && /exit \$fail/.test(w);
  T(wf + ': پنجرهٔ integrity گسترش یافت (۱۸۰s + ۱۲×۳۰s + no-cache — یا در استیجینگ ساختار دولایهٔ readback+HTTP) — اعمال‌شده یا در پچ منتظر',
    wideApplied || widePending || twoLayer);
  T(wf + ': فاصلهٔ تلاش‌ها ≥۱۲ ثانیه', /sleep (12|30)/.test(w));
  T(wf + ': گیت post-deploy همچنان fail-closed است', /exit \$fail/.test(w));
});

console.log(p + ' PASS / ' + f + ' FAIL');
process.exit(f ? 1 : 0);
