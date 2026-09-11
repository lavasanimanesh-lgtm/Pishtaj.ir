/* tester632 — v34.38.20 (F-4 — eligibilitySince + جبران کنترل‌شدهٔ ماه‌های غایب حقوق):
   نقطهٔ شروع احراز حقوق سهامدار موظف (eligibilitySince) فقط هنگام «فعال‌شدن موظفی» ثبت
   می‌شود و مبنای جبران ماه‌های غایب قرار می‌گیرد. جبران سروری فقط ساخت idempotent است:
   بدون void، بدون بازسازی هویت موجود (active یا سنگ‌قبر)، ردِ ماهِ سال قفل‌شده، دلیل صریح
   الزامی. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');
var sh = fs.readFileSync('crm/shareholders.js', 'utf8');

console.log('── F-4 eligibilitySince + controlled salary backfill (v34.38.20) ──');

/* قرارداد استاتیک — کلاینت */
assert.ok(/rec\.duty && !wasDuty && !rec\.eligibilitySince\) rec\.eligibilitySince = month;/.test(sh), 'eligibilitySince هنگام فعال‌شدن موظفی و فقط یک‌بار fallback می‌شود');
assert.ok(/id: 'eligibilitySince'/.test(sh), 'ماه شروع احراز در فرم ویرایش سهامدار صریح و قابل اصلاح است');
assert.ok(/var eligSince = normMonth\(v\.eligibilitySince\);/.test(sh), 'مقدار صریح ماه شروع از فرم نرمال و اعتبارسنجی می‌شود');
assert.ok(/window\.ptfShareBackfillSalaries = function/.test(sh), 'عملیات جبران حقوق در UI تعریف شده است');
assert.ok(/prompt\('دلیل جبران ماه‌های غایب حقوق/.test(sh), 'دلیل صریح پیش از جبران الزامی است');
assert.ok(/confirm\('ماه‌های غایب حقوق/.test(sh), 'تأیید انسانی پیش از جبران الزامی است');
assert.ok(/shareDomainCommand\('backfill_shareholder_salaries'/.test(sh), 'فرمان سروری backfill_shareholder_salaries فراخوانی می‌شود');
assert.ok(/shareAction\('backfill'/.test(sh), 'دکمهٔ جبران حقوق در هدر سهامداران موجود است');

/* قرارداد استاتیک — سرور */
assert.ok(/\$action === 'backfill_shareholder_salaries'/.test(php), 'handler سروری backfill وجود دارد');
assert.ok(/error'=>'reason_required'/.test(php), 'دلیل خالی ۴۲۲ برمی‌گرداند');
/* backfill باید در allowlist‌های projection ثبت باشد تا پاسخِ فوریِ envelope (opex دلتا
   + sharetx برای مدیران) بگیرد، نه یک ptf_crm_opex خالی که فقط به pull دوم وابسته است. */
assert.ok(php.indexOf("register_shareholder_salary','backfill_shareholder_salaries']") > -1, 'backfill در sd_is_recurring_projection_action ثبت شد');
assert.ok((php.match(/'backfill_shareholder_salaries'\]/g) || []).length >= 2, 'backfill در allowlist دوم (sharetx projection) هم ثبت شد');
assert.ok(/function sd_jalali_months_between\(string \$from,string \$to\)/.test(php), 'شمارندهٔ ماه‌های شمسی سروری موجود است');
assert.ok(/\$anchor=sd_norm_month\(\$sh\['eligibilitySince'\]/.test(php), 'مبدأ جبران از eligibilitySince (نرمال‌شده) خوانده می‌شود');
assert.ok(/if\(sd_is_locked\(\$snaps,\$month\)\)\{\$skippedLocked\+\+;continue;\}/.test(php), 'ماه سال قفل‌شده رد می‌شود');
assert.ok(/if\(\$txHits\|\|\$oxHits\)\{\$skippedExisting\+\+;continue;\}/.test(php), 'هویت موجود (فعال/سنگ‌قبر) بازسازی نمی‌شود');
assert.ok(/kind'=>'backfill_shareholder_salaries'/.test(php), 'جبران در ردپای corrections ثبت می‌شود');
console.log('  ✔ استاتیک: eligibilitySince + فرمان جبران idempotent در سرور و UI');

/* مدل رفتاری مستقل — شمارش ماه‌های شمسی */
function mIdx(m) { var p = String(m || '').split('/'); var y = +p[0], mo = +p[1]; return (y && mo) ? y * 12 + (mo - 1) : NaN; }
function monthsBetween(from, to) {
  var a = mIdx(from), b = mIdx(to), out = [];
  if (isNaN(a) || isNaN(b) || b < a || (b - a) > 3600) return out;
  for (var i = a; i <= b; i++) out.push(Math.floor(i / 12) + '/' + ('0' + ((i % 12) + 1)).slice(-2));
  return out;
}
assert.deepStrictEqual(monthsBetween('1405/02', '1405/05'), ['1405/02', '1405/03', '1405/04', '1405/05'], 'شمارش ماه‌های شمسی درست است');
assert.deepStrictEqual(monthsBetween('1405/12', '1406/02'), ['1405/12', '1406/01', '1406/02'], 'گذر از سال (اسفند→فروردین) درست است');
assert.deepStrictEqual(monthsBetween('1405/05', '1405/02'), [], 'بازهٔ معکوس خالی است');
console.log('  ✔ رفتاری: شمارندهٔ ماه‌های شمسی بازه و گذر سال را درست می‌سازد');

/* مدل رفتاری مستقل — جبران idempotent، بدون void، رد قفل */
function backfillModel(months, existing, lockedYears) {
  var created = 0, skippedExisting = 0, skippedLocked = 0;
  months.forEach(function (m) {
    if (lockedYears.indexOf(m.split('/')[0]) >= 0) { skippedLocked++; return; }
    if (existing.indexOf(m) >= 0) { skippedExisting++; return; }
    created++;
  });
  return { created: created, skippedExisting: skippedExisting, skippedLocked: skippedLocked };
}
var r1 = backfillModel(monthsBetween('1405/02', '1405/06'), ['1405/02', '1405/03'], ['1404']);
assert.deepStrictEqual(r1, { created: 3, skippedExisting: 2, skippedLocked: 0 }, 'ماه‌های موجود (فعال/سنگ‌قبر) بازسازی نمی‌شوند');
var r2 = backfillModel(monthsBetween('1405/02', '1405/03'), [], ['1405']);
assert.deepStrictEqual(r2, { created: 0, skippedExisting: 0, skippedLocked: 2 }, 'ماه‌های سال قفل‌شده رد می‌شوند');
var r3 = backfillModel(monthsBetween('1405/02', '1405/02'), [], []);
assert.deepStrictEqual(r3, { created: 1, skippedExisting: 0, skippedLocked: 0 }, 'یک ماه غایب ساخته می‌شود');
console.log('  ✔ رفتاری: جبران فقط ساخت idempotent — بدون void، رد قفل/هویت موجود');

/* مدل رفتاری مستقل — ثبت eligibilitySince */
function applyEdit(oldRec, next) {
  var rec = Object.assign({}, oldRec || { cd: 'SHR-1' });
  var wasDuty = !!(oldRec && oldRec.duty);
  rec.duty = next.duty; rec.salary = rec.duty ? next.salary : 0;
  if (rec.duty && !wasDuty && !rec.eligibilitySince) rec.eligibilitySince = next.month;
  return rec;
}
var a = applyEdit(null, { duty: true, salary: 200000000, month: '1405/02' });
assert.strictEqual(a.eligibilitySince, '1405/02', 'فعال‌شدن موظفی مبدأ را ثبت می‌کند');
var b = applyEdit({ duty: true, salary: 200000000, eligibilitySince: '1405/02' }, { duty: true, salary: 250000000, month: '1405/05' });
assert.strictEqual(b.eligibilitySince, '1405/02', 'ویرایش حقوقِ موظفِ موجود مبدأ را تغییر نمی‌دهد');
var c = applyEdit({ duty: false }, { duty: false, salary: 0, month: '1405/05' });
assert.strictEqual(c.eligibilitySince, undefined, 'غیرموظف مبدأ ندارد');
console.log('  ✔ رفتاری: eligibilitySince فقط هنگام فعال‌شدن موظفی و یک‌بار ثبت می‌شود');

console.log('PASS tester632 v34.38.20 F-4 eligibilitySince + controlled backfill');
