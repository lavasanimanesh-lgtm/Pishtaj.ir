#!/usr/bin/env node
'use strict';
/* =====================================================================
   v34.36.4 — ارتقای خودکار pinهای نسخه در تسترها
   (نسخهٔ پیشین: v34.8.35)

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

   استفاده (بعد از تغییر VERSION.json و نقاط رسمی نسخه):
     node _tools/uat/bump-version-pins.js 34.8.34          # از این نسخه به نسخهٔ VERSION.json
     node _tools/uat/bump-version-pins.js 34.8.34 --dry

   فقط فایل‌های _tools/uat/tester*.js را لمس می‌کند.

   ── v34.36.4: دو نقطهٔ کورِ واقعی رفع شد (هر دو در همین انتشار گیت را قرمز کردند) ──
   ۱) شکلِ «دوبل-escape» پوشش نداشت: پینی که با `new RegExp('…')` ساخته می‌شود در
      متنِ فایل به‌صورت 34\\.36\\.3 نوشته می‌شود (دو بک‌اسلش)، در حالی که ابزار فقط
      34\.36\.3 (regex literal) و 34.36.3 (لفظِ ساده) را می‌دید ⇒ پینِ کش‌باسترِ
      tester591 روی نسخهٔ قبل ماند و پس از bump قرمز شد.
   ۲) «هویتِ فایل» از «پینِ نسخه» جدا نبود: نامِ تسترها شمارهٔ نسخهٔ *تاریخی* دارد
      (tester591-v34.36.3-collapsible-account-panels.js). ابزار آن را هم عوض می‌کرد،
      پس ارجاعِ `gate.indexOf('tester591-v34.36.4-….js')` به فایلِ واقعیِ موجود
      اشاره نمی‌کرد و پینِ «در گیت ثبت شده است» قرمز می‌شد. حالا این نام‌ها پیش از
      جایگزینی محافظت (و پس از آن بازگردانی) می‌شوند و شمارشان هم گزارش می‌شود.
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

/* شکل‌های وقوع، از «خاص‌تر» به «عمومی‌تر» — ترتیب مهم است: اگر شکلِ ساده زودتر
   جایگزین شود، شکل‌های escape‌شده دیگر پیدا نمی‌شوند. */
var FORMS = [
  { old: OLD.split('.').join('\\\\.'), neu: NEW.split('.').join('\\\\.'), label: 'دوبل-escape (new RegExp)' },
  { old: OLD.split('.').join('\\.'), neu: NEW.split('.').join('\\.'), label: 'regex-literal' },
  { old: OLD, neu: NEW, label: 'لفظِ ساده' }
];

/* هویتِ فایل‌ها: نامِ تستر + شمارهٔ نسخهٔ تاریخی — با bump عوض نمی‌شود. */
var IDENTITY_RE = /tester\d+-v\d+\.\d+\.\d+-[A-Za-z0-9._-]*\.js/g;
function protect(src, bag) {
  return src.replace(IDENTITY_RE, function (m) {
    if (m.indexOf(OLD) < 0) return m;                 /* فقط آن‌هایی که bump می‌شدند */
    bag.push(m);
    return '\u0000PTFID' + (bag.length - 1) + '\u0000';
  });
}
function restore(src, bag) {
  return src.replace(/\u0000PTFID(\d+)\u0000/g, function (_, i) { return bag[Number(i)]; });
}

var files = fs.readdirSync(DIR).filter(function (n) { return /^tester.*\.js$/.test(n); });
var touched = [], broke = [], identities = 0;
var perForm = {}; FORMS.forEach(function (fm) { perForm[fm.label] = 0; });
var total = 0;

files.forEach(function (name) {
  var abs = path.join(DIR, name);
  var src = fs.readFileSync(abs, 'utf8');
  if (FORMS.every(function (fm) { return src.indexOf(fm.old) < 0; })) return;

  var bag = [];
  var guarded = protect(src, bag);
  identities += bag.length;

  var out = guarded;
  var n = 0;
  FORMS.forEach(function (fm) {
    var hits = out.split(fm.old).length - 1;
    if (hits > 0) { perForm[fm.label] += hits; n += hits; out = out.split(fm.old).join(fm.neu); }
  });
  out = restore(out, bag);

  if (out === src) return;

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
console.log('\nشکل‌ها: ' + FORMS.map(function (fm) { return fm.label + '=' + perForm[fm.label]; }).join(' · '));
console.log('هویتِ محافظت‌شده (نامِ فایلِ تستر، بدونِ تغییر): ' + identities);
console.log(OLD + ' → ' + NEW + ' | فایل: ' + touched.length + ' | مورد: ' + total + (DRY ? ' (dry-run — چیزی نوشته نشد)' : ''));
process.exit(broke.length ? 1 : 0);
