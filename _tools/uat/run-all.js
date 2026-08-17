#!/usr/bin/env node
'use strict';
/* =====================================================================
   PTF CRM — v34.7.25 — رانر کامل سوئیت UAT با تفکیک «شکست واقعی» از «بدهی تست»
   (گام H2 نقشهٔ فازبندی — PLAN-REMAINING-FIXES-PHASED-2026-08-17.md)

   چرا این فایل ساخته شد:
     ۱) شمارش قبلی سه قالب مختلف خلاصه را نمی‌شناخت و چهار تستر سالم را «شکست‌خورده»
        گزارش می‌کرد (tester149/150/151/281 هر چهار PASS بودند).
     ۲) ۵۸ تستر قدیمی روی قراردادهای منسوخ (رشتهٔ UI، شماره نسخه، markup) پین شده‌اند و
        همیشه قرمزند؛ این قرمزیِ دائمی باعث می‌شد شکست واقعیِ جدید در نویز گم شود.

   قرارداد این رانر:
     • هر تستری که در فهرست قرنطینه (known-obsolete.json) نباشد و شکست بخورد ⇒ خروجی ۱.
     • تسترهای قرنطینه‌شده حذف یا سبز اعلام نمی‌شوند؛ با دلیل مکتوب جدا گزارش می‌شوند.
     • اگر تستر قرنطینه‌شده‌ای سبز شود، هشدار می‌دهد تا از فهرست خارج شود (ضد انباشت).

   اجرا:  node _tools/uat/run-all.js            (خلاصه)
          node _tools/uat/run-all.js --json     (خروجی ماشین‌خوان)
   ===================================================================== */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var DIR = path.join(ROOT, '_tools/uat');
var REGISTRY = path.join(DIR, 'known-obsolete.json');
var asJson = process.argv.indexOf('--json') > -1;

function summaryOf(txt) {
  /* سه قالب خلاصهٔ موجود در سوئیت تاریخی */
  var m = txt.match(/(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/);
  if (m) return { pass: +m[1], fail: +m[2] };
  m = txt.match(/PASS\s+(\d+)\s+FAIL\s+(\d+)/);
  if (m) return { pass: +m[1], fail: +m[2] };
  m = txt.match(/(\d+)\s+PASS\s+(\d+)\s+FAIL/);
  if (m) return { pass: +m[1], fail: +m[2] };
  /* قالب چهارم: تسترهای تک‌خطی که فقط PASS/FAIL نهایی چاپ می‌کنند */
  if (/^\s*PASS\b/m.test(txt) && !/^\s*FAIL\b/m.test(txt) && !/✘|✗/.test(txt)) return { pass: 1, fail: 0, style: 'single-line' };
  if (/^\s*FAIL\b/m.test(txt) || /✘|✗/.test(txt)) return { pass: 0, fail: 1, style: 'single-line' };
  /* قالب پنجم: علامت‌های ✔/✓ بدون خلاصه */
  var ticks = (txt.match(/[✔✓]/g) || []).length, crosses = (txt.match(/[✘✗]/g) || []).length;
  if (ticks || crosses) return { pass: ticks, fail: crosses, style: 'marks' };
  /* فایل placeholder بدون خروجی = خنثی */
  if (!txt.trim()) return { pass: 0, fail: 0, style: 'placeholder' };
  return null;
}

var registry = {};
try { registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).quarantined || {}; } catch (e) { registry = {}; }

var files = fs.readdirSync(DIR).filter(function (f) { return /^tester.*\.js$/.test(f); }).sort();
var real = [], quarantined = [], recovered = [], noSummary = [], ok = 0;

files.forEach(function (f) {
  var rel = '_tools/uat/' + f;
  var r = cp.spawnSync('node', [rel], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  var txt = (r.stdout || '') + (r.stderr || '');
  var s = summaryOf(txt);
  var crashed = !s && (r.status !== 0 || /Error:|ERR_ASSERTION/.test(txt));
  var failed = crashed || (s && s.fail > 0);
  var entry = { file: rel, pass: s ? s.pass : 0, fail: s ? s.fail : (crashed ? 1 : 0), crashed: crashed,
    reason: (registry[rel] || {}).reason || '', category: (registry[rel] || {}).category || '' };
  if (!s && !crashed) { noSummary.push(entry); return; }
  if (failed) { (registry[rel] ? quarantined : real).push(entry); }
  else { ok++; if (registry[rel]) recovered.push(entry); }
});

var out = { total: files.length, green: ok, realFailures: real, quarantined: quarantined, recovered: recovered, noSummary: noSummary };
if (asJson) { console.log(JSON.stringify(out, null, 1)); }
else {
  console.log('سوئیت UAT — مجموع ' + files.length + ' تستر');
  console.log('  ✅ سبز: ' + ok);
  console.log('  🟡 قرنطینهٔ بدهی تست (قرارداد منسوخ، مستند): ' + quarantined.length);
  console.log('  ❌ شکست واقعی: ' + real.length);
  if (recovered.length) {
    console.log('\n♻️  این تسترهای قرنطینه‌شده اکنون سبزند و باید از known-obsolete.json خارج شوند:');
    recovered.forEach(function (x) { console.log('   • ' + x.file); });
  }
  if (real.length) {
    console.log('\n❌ شکست‌های واقعی (گیت را قرمز می‌کنند):');
    real.forEach(function (x) { console.log('   • ' + x.file + ' — ' + x.pass + ' PASS / ' + x.fail + ' FAIL' + (x.crashed ? ' [CRASH]' : '')); });
  }
  if (noSummary.length) {
    console.log('\nℹ️  بدون خلاصهٔ قابل تشخیص (نیازمند بازبینی قالب خروجی):');
    noSummary.forEach(function (x) { console.log('   • ' + x.file); });
  }
}
process.exit(real.length ? 1 : 0);
