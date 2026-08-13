#!/usr/bin/env node
/* =====================================================================
   بازسازی سوئیت UAT — ابزار اصلاح drift نسخه‌ای (2026-08-13)
   =====================================================================
   زمینه: از v34.4.32 قرارداد نسخهٔ واحد (window.PTF_CRM_RELEASE در
   index.html + var RELEASE در sw.js) برقرار است و اعلان قدیمی
   «var VER = 'v…'» / کش لفظی «ptf-crm-v…» حذف شده است. ده‌ها تستر قدیمی
   دنبال همان الگوهای کهنه بودند و برای همیشه قرمز می‌ماندند.

   این ابزار الگوهای کهنه را (فقط در تسترها، نه در کد CRM) به قرارداد
   جدید تبدیل می‌کند:
     • چک اعلان نسخه  → /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/
     • چک کش SW       → /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/
     • الگوهای استخراجی (match با گروه) → گروه [0-9.]+ حفظ می‌شود
   idempotent است و فقط تسترها را لمس می‌کند.
   ===================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var DRY = process.argv.indexOf('--dry') > -1;

var rules = [
  /* دو-اعلانی قدیمی: /window\.VER = 'v…'; var VER = 'v…'/ */
  { id: 'R-E double', re: /\/window\\\.VER = 'v[^/]*\/; var VER = 'v[^/]*\//g, rep: "/window\\.PTF_CRM_RELEASE\\s*=\\s*'v\\d+(?:\\.\\d+)+'/" },
  /* تک-اعلانی قدیمی: /window\.VER = 'v…'/ */
  { id: 'R-G single', re: /\/window\\\.VER = 'v[^/]*\//g, rep: "/window\\.PTF_CRM_RELEASE\\s*=\\s*'v\\d+(?:\\.\\d+)+'/" },
  /* استخراجی با پسوند -alpha */
  { id: 'R-F alpha',  re: /\/var VER = 'v\(\[0-9\.\]\+\)\(\?:-\[a-z0-9\.\]\+\)\?'\//g, rep: "/window.PTF_CRM_RELEASE = 'v([0-9.]+)(?:-[a-z0-9.]+)?'/" },
  /* استخراجی ساده (گروه حفظ می‌شود) */
  { id: 'R-D match',  re: /\/var VER = 'v\(\[0-9\.\]\+\)'\//g, rep: "/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/" },
  /* بقیهٔ الگوهای اعلان VER */
  { id: 'R-A rest',   re: /\/var VER = 'v[^/]*\//g, rep: "/window\\.PTF_CRM_RELEASE\\s*=\\s*'v\\d+(?:\\.\\d+)+'/" },
  /* استخراجی کش SW (گروه حفظ می‌شود) */
  { id: 'R-C swmatch', re: /\/ptf-crm-v\(\[0-9\.\]\+\)\//g, rep: "/var RELEASE = 'v([0-9.]+)'/" },
  /* بقیهٔ الگوهای کش SW */
  { id: 'R-B swrest',  re: /\/ptf-crm-v[^/]*\//g, rep: "/var RELEASE\\s*=\\s*'v\\d+(?:\\.\\d+)+'/" },
  /* رشتهٔ لفظی داخل indexOf (مثل tester15) */
  { id: 'R-H string',  re: /var VER = 'v/g, rep: 'var VER = window.PTF_CRM_RELEASE' },
  /* ترمیم: نسخهٔ اول ابزار در R-D/R-F اسلش انتهایی regex را جا انداخت */
  { id: 'RFIX alpha',  re: /\/window\.PTF_CRM_RELEASE = 'v\(\[0-9\.\]\+\)\(\?:-\[a-z0-9\.\]\+\)\?'\)/g, rep: "/window.PTF_CRM_RELEASE = 'v([0-9.]+)(?:-[a-z0-9.]+)?'/)" },
  { id: 'RFIX match',  re: /\/window\.PTF_CRM_RELEASE = 'v\(\[0-9\.\]\+\)'\)/g, rep: "/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/)" },

  /* ===== موج دوم (2026-08-13) ===== */

  /* ترمیم R-E/R-G در بافت match: گروه [0-9.]+ برگردد */
  { id: 'R-N repG',   re: /match\(\/window\\\.PTF_CRM_RELEASE\\s\*=\\s\*'v\\d\+\(\?:\\\.\\d\+\)\+'\/\)/g, rep: "match(/window\\.PTF_CRM_RELEASE = 'v([0-9.]+)'/)" },
  /* اعلان قدیمی کش: var CACHE = 'ptf-crm-v([0-9.]+)'; */
  { id: 'R-J cacheM', re: /\/var CACHE = 'ptf-crm-v\(\[0-9\.\]\+\)';/g, rep: "/var RELEASE = 'v([0-9.]+)';" },
  /* ترمیم R-J (اسلش دوبل از نسخهٔ اول این قاعده) */
  { id: 'R-J2 fix',    re: /\/var RELEASE = 'v\(\[0-9\.\]\+\)';\/\//g, rep: "/var RELEASE = 'v([0-9.]+)';/" },
  /* اعلان قدیمی کش (بدون گروه، .test) */
  { id: 'R-K cacheT', re: /\/var CACHE = 'ptf-crm-v\\d\+\(\?:\\\.\\d\+\)\+'\/\.test\(([^)]*)\)/g, rep: function (m, arg) { return "/var RELEASE = 'v\\d+(?:\\.\\d+)+'/.test(" + arg + ")"; } },
  /* رشتهٔ لفظی ptf-crm-v در indexOf */
  { id: 'R-L idxof',  re: /\.indexOf\('ptf-crm-v'\)/g, rep: ".indexOf('ptf-crm-')" },
  /* lockstep قدیمی که فقط -alpha می‌پذیرفت */
  { id: 'R-M alpha',  re: /\/\^v\[0-9\.\]\+-alpha\$\//g, rep: "/^v\\d+(\\.\\d+){1,2}(-[a-z0-9.]+)?$/" },
  /* استخراج قدیمی window.VER = '(v…)'-سبک */
  { id: 'R-O paren',  re: /\/window\\\.VER = '\(v\[\\d\.\]\+\)'\//g, rep: "/window\\.PTF_CRM_RELEASE = '(v[\\d.]+)'/" },
  /* مقایسهٔ کش با vm[1] در tester301-سبک */
  { id: 'R-P vmsw',   re: /sw\.indexOf\('ptf-crm-' \+ vm\[1\]\)/g, rep: "sw.indexOf(\"var RELEASE = '\" + vm[1] + \"'\")" },
  /* اعلان قدیمی کش بدون کوتیشن انتهایی (موج سوم) */
  { id: 'R-Q cacheNQ', re: /\/var CACHE = 'ptf-crm-v\\d\+\(\?:\\\.\\d\+\)\+\/\.test\(([^)]*)\)/g, rep: function (m, arg) { return "/var RELEASE = 'v\\d+(?:\\.\\d+)+'/.test(" + arg + ")"; } }
];

var files = fs.readdirSync(DIR).filter(function (f) {
  return f.endsWith('.js') && f !== 'fix-version-drift.js' && f !== 'run-full-regression.js';
});

var touched = 0, totalChanges = 0;
files.forEach(function (f) {
  var p = path.join(DIR, f);
  var src = fs.readFileSync(p, 'utf8');
  var out = src;
  var fileChanges = 0;
  rules.forEach(function (r) {
    var before = out;
    out = out.replace(r.re, r.rep);
    if (out !== before) fileChanges++;
  });
  if (out !== src) {
    touched++;
    totalChanges += fileChanges;
    if (!DRY) fs.writeFileSync(p, out);
    else console.log('would-fix: ' + f);
  }
});

console.log('files-touched: ' + touched + ' | rule-applications: ' + totalChanges + (DRY ? ' (DRY-RUN)' : ''));
