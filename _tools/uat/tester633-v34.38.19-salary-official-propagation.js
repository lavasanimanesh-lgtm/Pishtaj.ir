/* tester633 — v34.38.20 (DATA-QUALITY SH-SALARY-FIX — گزارش کارفرما: «تب کیفیت داده
   حقوق سهامدار موظف را بدون نوع رسمی/غیررسمی نشان می‌دهد ولی بعد از تعیین هم از بین
   نمی‌رود»).
   ریشه: reconcile_shareholder_salaries فقط ردیفِ ماهِ جاریِ reconcile را isOfficial
   می‌کرد؛ ردیف‌های حقوقِ ماه‌های قبلی همان سهامدار unclassified می‌ماندند و یافتهٔ
   کیفیت داده باقی می‌ماند.
   رفع (دو لایه، بدون void/ادغام):
   ۱) سرور: هنگام reconcile صریح سهامدار، isOfficial روی همهٔ ماه‌های فعالِ حقوقِ همان
      سهامدار منتشر می‌شود (ماهِ سال قفل‌شده رد و شمرده می‌شود).
   ۲) کلاینت (فقط‌خواندنی): طبقه‌بند کیفیت داده برای ردیف حقوقِ بدون isOfficial، نوع سند
      را از پروفایل سهامدار (salaryOfficial) می‌خواند تا یافته فوراً و حتی برای ماه‌های
      سال قفل‌شده رفع شود. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');
var dq = fs.readFileSync('crm/data-quality.js', 'utf8');

console.log('── salary-official cross-month propagation (v34.38.20) ──');

/* قرارداد استاتیک — سرور */
assert.ok(/\$salaryOfficialPropagated=0;\$salaryOfficialLockedSkipped=0;/.test(php), 'شمارنده‌های انتشار نوع سند سروری موجودند');
assert.ok(/\$salaryOfficialByCd=\[\];/.test(php), 'نگاشت سهامدار→نوع سند برای محدوده ساخته می‌شود');
assert.ok(/if\(\$scopeShareholder!==''&&\$shCd!==\$scopeShareholder\)continue;/.test(php), 'انتشار فقط در محدودهٔ scopeShareholder');
assert.ok(php.indexOf("'/^salary:(.+):(?:13|14)") > -1 && php.indexOf('$mKey') > -1, 'شناسایی سهامدار از recurringKey');
assert.ok(/if\(\$rowMonth!==''&&sd_is_locked\(\$snaps,\$rowMonth\)\)\{\$salaryOfficialLockedSkipped\+\+;continue;\}/.test(php), 'ماهِ سال قفل‌شده رد می‌شود');
assert.ok(/if\(!array_key_exists\('isOfficial',\$ox\)\|\|\(bool\)\$ox\['isOfficial'\]!==\$want\)/.test(php), 'فقط ردیفِ نیازمند تغییر دست‌خورده می‌شود');
assert.ok(/'salaryOfficialPropagated'=>\$salaryOfficialPropagated/.test(php), 'نتیجه در پاسخ reconcile برمی‌گردد');
console.log('  ✔ استاتیک: انتشار cross-month نوع سند در سرور');

/* قرارداد استاتیک — کلاینت */
assert.ok(/function shareholderSalaryOfficialOf\(o\)/.test(dq), 'حل‌کنندهٔ نوع سند از پروفایل سهامدار موجود است');
assert.ok(/if \(cls === 'unclassified'\)/.test(dq), 'fallback فقط برای ردیفِ نامشخص فعال است');
assert.ok(/shareholderSalaryOfficialOf\(o\)/.test(dq), 'fallback در ledgerOfOpexSafe صدا زده می‌شود');
console.log('  ✔ استاتیک: fallback فقط‌خواندنی در کیفیت داده');

/* مدل رفتاری مستقل — انتشار سروری (معادل بلوک PHP) */
function isActive(r) { var t = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded']; return !r || (t.indexOf(String((r.status || '').toLowerCase())) < 0 && !r.voided && !r.deleted); }
function propagate(shareholders, opex, snaps, scopeShareholder) {
  var byCd = {};
  shareholders.forEach(function (sh) {
    if (!sh || !sh.cd) return;
    if (scopeShareholder && sh.cd !== scopeShareholder) return;
    var v = (sh.salaryOfficial === true) ? true : (sh.salaryOfficial === false ? false : null);
    if (v !== null) byCd[sh.cd] = v;
  });
  var propagated = 0, lockedSkipped = 0;
  opex.forEach(function (ox, i) {
    if (!ox || !ox.shareholderSalary || !isActive(ox)) return;
    var shCd = '';
    var m = String(ox.recurringKey || '').match(/^salary:(.+):(?:13|14)\d{2}\/\d{2}$/);
    if (m) shCd = m[1];
    if (!shCd && ox.shareTx) shCd = String(ox.shareTx);
    if (!shCd || !(shCd in byCd)) return;
    var month = String(ox.month || '');
    var locked = snaps.some(function (s) { return s && s.locked && String(s.year || '') === month.split('/')[0]; });
    if (locked) { lockedSkipped++; return; }
    if (!('isOfficial' in ox) || !!ox.isOfficial !== byCd[shCd]) { ox.isOfficial = byCd[shCd]; propagated++; }
  });
  return { propagated: propagated, lockedSkipped: lockedSkipped };
}

var shareholders = [
  { cd: 'SHR-A', salaryOfficial: true },
  { cd: 'SHR-B', salaryOfficial: false },
  { cd: 'SHR-C' } /* تعیین‌نشده — نباید لمس شود */
];
var opex = [
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/02', month: '1405/02' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/03', month: '1405/03' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/04', month: '1405/04' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/05', month: '1405/05' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/06', month: '1405/06' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1404/12', month: '1404/12' }, /* سال قفل */
  { shareholderSalary: true, recurringKey: 'salary:SHR-B:1405/06', month: '1405/06' },
  { shareholderSalary: true, recurringKey: 'salary:SHR-C:1405/06', month: '1405/06' }, /* تعیین‌نشده */
  { shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/01', month: '1405/01', status: 'void' }, /* void */
  { cat: 'اجاره', amt: 50000000, month: '1405/06' } /* دستی غیرحقوق — نباید لمس شود */
];
var snaps = [{ year: '1404', locked: true }];

var r = propagate(shareholders, opex, snaps, 'SHR-A');
assert.strictEqual(r.propagated, 5, 'همهٔ ماه‌های بازِ سهامدارِ محدوده isOfficial گرفتند');
assert.strictEqual(r.lockedSkipped, 1, 'ماهِ سال قفل‌شده رد و شمرده شد');
assert.strictEqual(opex[0].isOfficial, true, '۱۴۰۵/۰۲ رسمی شد');
assert.strictEqual(opex[6].isOfficial, undefined, 'سهامدار خارج از محدوده (SHR-B) با scope لمس نشد');
assert.strictEqual(opex[7].isOfficial, undefined, 'سهامدار تعیین‌نشده (SHR-C) لمس نشد');
assert.strictEqual(opex[8].isOfficial, undefined, 'ردیف void لمس نشد');
assert.strictEqual(opex[9].isOfficial, undefined, 'ردیف دستی غیرحقوق لمس نشد');
console.log('  ✔ رفتاری: انتشار فقط ردیف‌های فعالِ حقوقِ سهامدارِ محدوده، با رد قفل');

var rAll = propagate(shareholders, [{ shareholderSalary: true, recurringKey: 'salary:SHR-B:1405/05', month: '1405/05' }], [], '');
assert.strictEqual(rAll.propagated, 1, 'بدون scope، سهامدارِ غیررسمی هم درست دسته‌بندی می‌شود');
console.log('  ✔ رفتاری: scope خالی = همهٔ سهامدارانِ دارای نوع سند');

/* مدل رفتاری مستقل — fallback فقط‌خواندنی کیفیت داده */
function classify(o, shareholders, sharetx) {
  var cls = (o.isOfficial === true) ? 'official' : (o.isOfficial === false ? 'unofficial' : 'unclassified');
  if (cls === 'unclassified') {
    var so = null;
    var shCd = '';
    var m = String(o.recurringKey || '').match(/^salary:(.+):(?:13|14)\d{2}\/\d{2}$/);
    if (m) shCd = m[1];
    if (!shCd && o.shareTx) { var tx = sharetx.filter(function (x) { return x && x.cd === o.shareTx; })[0]; if (tx && tx.shCd) shCd = tx.shCd; }
    var sh = shareholders.filter(function (x) { return x && x.cd === shCd; })[0];
    if (sh) { if (sh.salaryOfficial === true) so = true; else if (sh.salaryOfficial === false) so = false; }
    if (so === true) cls = 'official'; else if (so === false) cls = 'unofficial';
  }
  return cls;
}
var shList = [{ cd: 'SHR-A', salaryOfficial: true }, { cd: 'SHR-B', salaryOfficial: false }];
var sharetxList = [{ cd: 'SHT-1', shCd: 'SHR-A', type: 'salary' }];
assert.strictEqual(classify({ recurringKey: 'salary:SHR-A:1405/03' }, shList, sharetxList), 'official', 'ردیف بدون isOfficial از پروفایل رسمی می‌شود');
assert.strictEqual(classify({ recurringKey: 'salary:SHR-B:1405/03' }, shList, sharetxList), 'unofficial', 'ردیف بدون isOfficial از پروفایل غیررسمی می‌شود');
assert.strictEqual(classify({ shareTx: 'SHT-1', shareholderSalary: true }, shList, sharetxList), 'official', 'fallback از shareTx هم سهامدار را پیدا می‌کند');
assert.strictEqual(classify({ recurringKey: 'salary:SHR-Z:1405/03' }, shList, sharetxList), 'unclassified', 'بدون پروفایل، نامشخص می‌ماند (حدس نمی‌زند)');
assert.strictEqual(classify({ recurringKey: 'salary:SHR-B:1405/03', isOfficial: false }, shList, sharetxList), 'unofficial', 'isOfficial صریح مقدم بر پروفایل است');
console.log('  ✔ رفتاری: fallback فقط برای ردیفِ نامشخص و بدون حدس');

console.log('PASS tester633 v34.38.20 salary-official cross-month propagation');
