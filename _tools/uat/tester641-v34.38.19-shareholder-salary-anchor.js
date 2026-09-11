/* tester641 — v34.38.20 (SH-SALARY-ANCHOR): رفع باگ «جبران حقوق برای یک سهامدار به‌جای ۳ ماه،
   ۴ ماه ساخت». ریشه: مبدأ احراز (eligibilitySince) بی‌صدا از ماهِ انتخابی پنل پر می‌شد و اگر
   یک ماه زودتر از شروع واقعی بود، جبرانِ ماه‌های غایب بازهٔ [مبدأ..ماه جاری] را کامل می‌کرد و
   یک ماه اضافه می‌ساخت؛ ضمناً ماه‌های legacy با قالب غیرکانونیک («۱۴۰۵/۴» یا «1405-06») در
   تطبیق «موجود» شمرده نمی‌شدند و دوباره ساخته می‌شدند.
   اصلاح: ۱) مبدأ احراز صریح و قابل اصلاح در فرم سهامدار؛ ۲) نرمال‌سازی ماه در تطبیق سروری
   (sd_norm_month) و گزارش غایب کلاینت؛ ۳) قرارداد جبران بدون تغییر می‌ماند (فقط ساخت idempotent،
   بدون void، رد ماه قفل‌شده، دلیل صریح). */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');
var sh = fs.readFileSync('crm/shareholders.js', 'utf8');

console.log('── SH-SALARY-ANCHOR: مبدأ احراز صریح + نرمال‌سازی ماه در جبران حقوق (v34.38.20) ──');

/* ── قرارداد استاتیک — کلاینت ── */
assert.ok(/id: 'eligibilitySince'/.test(sh), 'فرم سهامدار فیلد صریح ماه شروع احراز دارد');
assert.ok(/var eligSince = normMonth\(v\.eligibilitySince\);/.test(sh), 'ماه شروع از ورودی کاربر نرمال می‌شود');
assert.ok(/eligSince && !\//.test(sh) && /ماه شروع احراز نامعتبر است/.test(sh), 'ماه شروع نامعتبر رد می‌شود');
assert.ok(/if \(rec\.duty && eligSince\) rec\.eligibilitySince = eligSince;/.test(sh), 'ماه شروع صریح کاربر مبدأ جبران می‌شود');
assert.ok(/mine\.forEach\(function \(x\) \{ var m = normMonth\(x\.month\); if \(m\) have\[m\]/.test(sh), 'گزارش غایب، ماه ردیف‌ها را نرمال می‌کند');
console.log('  ✔ استاتیک: مبدأ احراز صریح + نرمال‌سازی کلاینت');

/* ── قرارداد استاتیک — سرور ── */
assert.ok(/function sd_norm_month\(\$value\): string/.test(php), 'نرمال‌ساز ماه سروری موجود است');
assert.ok(/sd_norm_month\(\$row\['month'\]\?\?''\)===\$month/.test(php), 'تطبیق ردیف حقوق ماه را نرمال می‌کند (دوباره‌سازی نشود)');
assert.ok(/\$anchor=sd_norm_month\(\$sh\['eligibilitySince'\]/.test(php), 'مبدأ جبران از eligibilitySince نرمال‌شده خوانده می‌شود');
assert.ok(/\$m=sd_norm_month\(\$tx\['month'\]\?\?''\);/.test(php), 'fallback اولین ادعا هم ماه legacy را نرمال می‌کند');
/* قرارداد جبران دست‌نخورده: بدون void در بلوک backfill، فقط ساخت idempotent */
assert.ok(/error'=>'reason_required'/.test(php), 'دلیل صریح الزامی است');
assert.ok(/if\(sd_is_locked\(\$snaps,\$month\)\)\{\$skippedLocked\+\+;continue;\}/.test(php), 'ماه سال قفل‌شده رد می‌شود');
assert.ok(/if\(\$txHits\|\|\$oxHits\)\{\$skippedExisting\+\+;continue;\}/.test(php), 'هویت موجود بازسازی نمی‌شود');
console.log('  ✔ استاتیک: نرمال‌سازی ماه سروری + قرارداد جبران بدون void');

/* ── مدل رفتاری مستقل ── */
function mIdx(m) { var p = String(m || '').split('/'); var y = +p[0], mo = +p[1]; return (y && mo) ? y * 12 + (mo - 1) : NaN; }
function monthsBetween(from, to) {
  var a = mIdx(from), b = mIdx(to), out = [];
  if (isNaN(a) || isNaN(b) || b < a || (b - a) > 3600) return out;
  for (var i = a; i <= b; i++) out.push(Math.floor(i / 12) + '/' + ('0' + ((i % 12) + 1)).slice(-2));
  return out;
}
function normMonth(m) {
  var s = String(m == null ? '' : m);
  s = s.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
       .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
       .replace(/-/g, '/').replace(/\s/g, '')
       .replace(/^(\d{4})\/(\d)$/, '$1/0$2');
  return s;
}
assert.strictEqual(normMonth('۱۴۰۵/۴'), '1405/04', 'ارقام فارسی و ماه تک‌رقمی نرمال می‌شود');
assert.strictEqual(normMonth('1405-06'), '1405/06', 'جداکنندهٔ خط تیره نرمال می‌شود');
assert.strictEqual(normMonth('1405/12'), '1405/12', 'ماه دو رقمی دست نمی‌خورد');
assert.deepStrictEqual(monthsBetween('1405/04', '1405/06'), ['1405/04', '1405/05', '1405/06'], 'بازهٔ سه‌ماهه از مبدأ درست ۳ ماه است');

/* مدل جبران: فقط ساخت idempotent؛ ردیف موجود (حتی با ماه غیرکانونیک) بازسازی نمی‌شود. */
function backfillModel(anchor, through, rows, shCd, lockedYears) {
  var created = 0, skippedExisting = 0, skippedLocked = 0;
  monthsBetween(anchor, through).forEach(function (m) {
    if (lockedYears.indexOf(m.split('/')[0]) >= 0) { skippedLocked++; return; }
    var exists = rows.some(function (r) { return r.shCd === shCd && r.type === 'salary' && normMonth(r.month) === m; });
    if (exists) { skippedExisting++; return; }
    created++;
  });
  return { created: created, skippedExisting: skippedExisting, skippedLocked: skippedLocked };
}

/* ۱) مبدأ درست (۰۴) با دو ماه موجود (۰۴ و ۰۵) → فقط ۰۶ ساخته می‌شود ⇒ جمع ۳، نه ۴ */
var r1 = backfillModel('1405/04', '1405/06', [
  { shCd: 'S1', type: 'salary', month: '1405/04' },
  { shCd: 'S1', type: 'salary', month: '1405/05' }
], 'S1', []);
assert.deepStrictEqual(r1, { created: 1, skippedExisting: 2, skippedLocked: 0 }, 'مبدأ صریحِ درست دقیقاً ماه غایب را می‌سازد (جمع ۳، نه ۴)');

/* ۲) ردیف legacy با ماه فارسی غیرکانونیک، «موجود» شمرده می‌شود و دوباره ساخته نمی‌شود */
var r2 = backfillModel('1405/04', '1405/04', [
  { shCd: 'S2', type: 'salary', month: '۱۴۰۵/۰۴' }
], 'S2', []);
assert.deepStrictEqual(r2, { created: 0, skippedExisting: 1, skippedLocked: 0 }, 'ماه فارسی legacy موجود شمرده می‌شود (بدون دوباره‌سازی)');

/* ۳) سال قفل‌شده رد می‌شود و چیزی ساخته نمی‌شود */
var r3 = backfillModel('1405/01', '1405/02', [], 'S3', ['1405']);
assert.deepStrictEqual(r3, { created: 0, skippedExisting: 0, skippedLocked: 2 }, 'ماه‌های سال قفل‌شده رد می‌شوند');
console.log('  ✔ رفتاری: جبران از مبدأ درست، بدون دوباره‌سازی و بدون void');

console.log('PASS tester641 v34.38.20 SH-SALARY-ANCHOR explicit anchor + month normalization');
