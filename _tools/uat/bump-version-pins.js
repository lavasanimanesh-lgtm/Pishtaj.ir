#!/usr/bin/env node
'use strict';
/* =====================================================================
   v34.8.35 — ارتقای خودکار pinهای نسخه در تسترها

   زمینه (یافتهٔ عملی هنگام بستن T0-3):
   ۷۰+ تستر شمارهٔ نسخه را به‌صورت لفظی pin کرده‌اند — در مقایسه
   (`ver.crm_version === 'v34.8.34'`)، در regex کش‌باستر
   (`/offers\.js\?v=34\.8\.34/`)، و در عنوان تست. این pinها **عمدی** و مفیدند:
   دقیقاً همان چیزی‌اند که «نسخهٔ مخلوط» را می‌گیرند (index.html تازه ولی
   cache-buster قدیمی). پس نباید حذف شوند.

   ولی تا امروز در هر انتشار باید دستی در ده‌ها فایل عوض می‌شدند و اگر یکی
   جا می‌ماند، گیت قرمز می‌شد. حالا که گیت واقعاً در GitHub Actions اجرا
   می‌شود (T0-3)، فراموش کردن این کار **هر انتشار را مسدود می‌کند**.

   این ابزار همان کار دستی را قطعی و کامل انجام می‌دهد.

   استفاده (بعد از تغییر VERSION.json و ۶ نقطهٔ رسمی):
     node _tools/uat/bump-version-pins.js 34.8.34          # از این نسخه به نسخهٔ VERSION.json
     node _tools/uat/bump-version-pins.js 34.8.34 --dry

   فقط فایل‌های _tools/uat/tester*.js را لمس می‌کند و شکل‌های زیر را پوشش
   می‌دهد: 34.8.34 لفظی، و 34\.8\.34 (escape شده داخل regex).
   ===================================================================== */
var fs = require('fs');
var path = require('path');
var DIR = __dirname;
var ROOT = path.resolve(DIR, '../..');
var DRY = process.argv.indexOf('--dry') > -1;

var NEW = JSON.parse(fs.readFileSync(path.join(ROOT, 'VERSION.json'), 'utf8')).crm_version.replace(/^v/, '');
var OLD = process.argv.slice(2).filter(function (a) { return /^\d+\.\d+\.\d+$/.test(a); })[0];

if (!OLD) {
  console.error('استفاده: node _tools/uat/bump-version-pins.js <نسخهٔ-قدیمی> [--dry]');
  console.error('مثال:   node _tools/uat/bump-version-pins.js 34.8.34');
  process.exit(2);
}
if (OLD === NEW) {
  console.log('نسخهٔ قدیمی و جدید یکی است (' + NEW + ') — کاری لازم نیست.');
  process.exit(0);
}

var OLD_ESC = OLD.split('.').join('\\.');   /* 34\.8\.34 */
var NEW_ESC = NEW.split('.').join('\\.');

var files = fs.readdirSync(DIR).filter(function (n) { return /^tester.*\.js$/.test(n); });
var touched = [], broke = [], total = 0;

files.forEach(function (name) {
  var abs = path.join(DIR, name);
  var src = fs.readFileSync(abs, 'utf8');
  if (src.indexOf(OLD) < 0 && src.indexOf(OLD_ESC) < 0) return;

  /* اول شکل escape شده (چون شامل شکل ساده نیست، ترتیب مهم است) */
  var out = src.split(OLD_ESC).join(NEW_ESC).split(OLD).join(NEW);
  if (out === src) return;

  var n = (src.split(OLD_ESC).length - 1) + (src.split(OLD).length - 1);

  var tmp = abs + '.bumpcheck.js';
  fs.writeFileSync(tmp, out, 'utf8');
  var chk = require('child_process').spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (chk.status !== 0) { broke.push(name + ' — ' + String(chk.stderr || '').split('\n')[2]); return; }

  total += n;
  touched.push(name + ' (' + n + ')');
  if (!DRY) fs.writeFileSync(abs, out, 'utf8');
});

touched.forEach(function (n) { console.log((DRY ? '[dry] ' : '') + 'bumped: ' + n); });
if (broke.length) {
  console.log('\n⚠️  رد شد (نتیجه از نظر نحوی خراب می‌شد):');
  broke.forEach(function (b) { console.log('   • ' + b); });
}
console.log('\n' + OLD + ' → ' + NEW + ' | فایل: ' + touched.length + ' | مورد: ' + total + (DRY ? ' (dry-run — چیزی نوشته نشد)' : ''));
process.exit(broke.length ? 1 : 0);
