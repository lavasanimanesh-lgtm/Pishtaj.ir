/* tester644 — v34.38.20 (SHARE-TX-MANUAL-VOID + SHARE-SALARY-DEDUPE):
   گزارش کارفرما: «حقوق یک سهامدار دو بار در یک ماه ثبت شده؛ خودکار درست نشده و راهکار
   اصلاح دستی هم وجود ندارد». ریشهٔ «خودکار درست نشد»: reconcile_shareholder_salaries فقط
   ماهِ ارسال‌شده (ماه پنل/جاری) را پاک می‌کرد و ردیفِ تکراریِ ماه‌های گذشته هرگز لمس
   نمی‌شد. این تغییر دو اهرم اصلاح دستیِ سروری (نه ویرایش آزاد مبلغ) می‌سازد:
     ① void_shareholder_tx — ابطال تکیِ یک ردیف گردش (cd) با دلیل صریح؛ برای salary هزینهٔ
        OPEXِ پیوندخورده (shareTx) هم بسته می‌شود؛ ماه قفل رد و corrections ثبت می‌شود.
     ② dedupe_shareholder_salaries — برای یک سهامدار همهٔ ماه‌ها را می‌پیماید و ماه‌های دارای
        بیش از یک ردیف active حقوق را به یک ردیف می‌رساند (void اضافه‌ها + هزینهٔ پیوندخورده)؛
        ماه قفل دست‌نخورده می‌ماند.
   هر دو فرمان در allowlistهای projection ثبت شده‌اند تا پاسخِ فوریِ envelope بدهند. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');
var sh = fs.readFileSync('crm/shareholders.js', 'utf8');

console.log('── SHARE-TX-MANUAL-VOID + SHARE-SALARY-DEDUPE (v34.38.20) ──');

/* قرارداد استاتیک — کلاینت (UI) */
assert.ok(/window\.ptfShareTxVoid = function/.test(sh), 'عملگر ابطال دستی ردیف گردش تعریف شده است');
assert.ok(/window\.ptfShareDedupe = function/.test(sh), 'عملگر رفع تکراری حقوق سهامدار تعریف شده است');
assert.ok(/prompt\('دلیل ابطال این ردیف گردش/.test(sh), 'دلیل صریح پیش از ابطال ردیف الزامی است');
assert.ok(/prompt\('دلیل رفع تکراری حقوق این سهامدار/.test(sh), 'دلیل صریح پیش از رفع تکراری الزامی است');
assert.ok(/shareDomainCommand\('void_shareholder_tx',/.test(sh), 'فرمان سروری void_shareholder_tx فراخوانی می‌شود');
assert.ok(/shareDomainCommand\('dedupe_shareholder_salaries',/.test(sh), 'فرمان سروری dedupe_shareholder_salaries فراخوانی می‌شود');
assert.ok(/ptfShareTxVoid\(/.test(sh), 'دکمهٔ ابطال در دیالوگ گردش رندر می‌شود');
assert.ok(/shareAction\('dedupe', '🧹', 'رفع تکراری'/.test(sh), 'دکمهٔ رفع تکراری روی کارت سهامدار موظف موجود است');
assert.ok(/if \(!shareTxActive\(tx\)\)/.test(sh), 'ردیفِ از پیش باطل‌شده دوباره ابطال نمی‌شود (گارد کلاینت)');

/* قرارداد استاتیک — سرور */
assert.ok(/\$action === 'void_shareholder_tx'/.test(php), 'handler سروری void_shareholder_tx وجود دارد');
assert.ok(/\$action === 'dedupe_shareholder_salaries'/.test(php), 'handler سروری dedupe_shareholder_salaries وجود دارد');
assert.ok(/'error'=>'sharetx_required'/.test(php), 'نبود cd ردیف ۴۲۲ برمی‌گرداند');
assert.ok(/'error'=>'sharetx_not_found'/.test(php), 'ردیف ناموجود ۴۰۴ برمی‌گرداند');
assert.ok(/'error'=>'already_void'/.test(php), 'ردیفِ از پیش باطل‌شده ۴۰۹ برمی‌گرداند');
assert.ok(/if\(\$txMonth!==''&&sd_is_locked\(\$snaps,\$txMonth\)\)sd_out\(\['ok'=>false,'error'=>'fiscal_period_locked','year'=>sd_year\(\$txMonth\)\]/.test(php), 'ابطال ردیفِ ماهِ سال قفل‌شده رد می‌شود');
assert.ok(/'entityType'=>'shareholder_tx','entityId'=>\$txCd,'kind'=>'explicit_void'/.test(php), 'ابطال ردیف گردش در ردپای corrections ثبت می‌شود');
assert.ok(/\(\$ox\['shareTx'\]\?\?''\)===\$txCd\)\$linked=true/.test(php), 'پیوند هزینهٔ حقوق با shareTx دقیق است (نه recurringKey مشترک)');
assert.ok(/if\(count\(\$indexes\)<=1\)continue;/.test(php), 'dedupe ماه‌های بدون تکرار را لمس نمی‌کند');
assert.ok(/'voidedSalaryRows'=>\$voidedTx/.test(php) && /'voidedOpexRows'=>\$voidedOx/.test(php), 'نتیجهٔ dedupe شمار ردیف‌های باطل‌شده را برمی‌گرداند');
/* هر دو فرمان باید در allowlistهای projection ثبت باشند تا پاسخ فوری envelope بگیرند. */
assert.ok((php.match(/'void_shareholder_tx','dedupe_shareholder_salaries'/g) || []).length >= 2, 'هر دو فرمان در sd_is_recurring_projection_action و sd_recurring_sharetx_projection_allowed ثبت شدند');
console.log('  ✔ استاتیک: ابطال دستی + رفع تکراری در سرور و UI');

/* مدل رفتاری مستقل — dedupe: یک ردیف زنده در هر ماه؛ ماه قفل دست‌نخورده */
function dedupeModel(groups, lockedYears) {
  var voidedTx = 0, skippedLocked = 0;
  groups.forEach(function (g) {
    if (g.count <= 1) return;
    var year = String(g.month).split('/')[0];
    if (lockedYears.indexOf(year) >= 0) { skippedLocked++; return; }
    voidedTx += g.count - 1; /* یکی زنده می‌ماند */
  });
  return { voidedSalaryRows: voidedTx, skippedLocked: skippedLocked };
}
var d1 = dedupeModel([{ month: '1405/04', count: 2 }, { month: '1405/05', count: 1 }, { month: '1405/06', count: 3 }], []);
assert.deepStrictEqual(d1, { voidedSalaryRows: 3, skippedLocked: 0 }, 'ماه‌های تکراری به یک ردیف می‌رسند (۱+۲=۳)');
var d2 = dedupeModel([{ month: '1404/12', count: 2 }, { month: '1405/06', count: 3 }], ['1404']);
assert.deepStrictEqual(d2, { voidedSalaryRows: 2, skippedLocked: 1 }, 'ماهِ سال قفل‌شده دست‌نخورده می‌ماند و ماه‌های دیگر پردازش می‌شوند');
var d3 = dedupeModel([{ month: '1405/04', count: 1 }, { month: '1405/05', count: 1 }], []);
assert.deepStrictEqual(d3, { voidedSalaryRows: 0, skippedLocked: 0 }, 'بدون تکرار، هیچ ردیفی void نمی‌شود');
console.log('  ✔ رفتاری: dedupe فقط اضافه‌های هر ماه را void می‌کند و قفل سال را رد می‌کند');

/* مدل رفتاری مستقل — پیوند هزینهٔ حقوق هنگام ابطال: دقیق بر اساس shareTx، نه recurringKey مشترک */
function voidOpexLinkModel(txCd, recurringKey, opexRows) {
  var voided = 0, kept = 0;
  opexRows.forEach(function (ox) {
    if (!ox.active || !ox.shareholderSalary) return;
    var linked = false;
    if (ox.shareTx === txCd) linked = true;
    else if (ox.shareTx === '' && recurringKey !== '' && ox.recurringKey === recurringKey) linked = true;
    if (linked) voided++; else kept++;
  });
  return { voided: voided, kept: kept };
}
var o1 = voidOpexLinkModel('SHT-A', 'salary:SHR-1:1405/04', [
  { shareTx: 'SHT-A', recurringKey: 'salary:SHR-1:1405/04', active: true, shareholderSalary: true },
  { shareTx: 'SHT-B', recurringKey: 'salary:SHR-1:1405/04', active: true, shareholderSalary: true }
]);
assert.deepStrictEqual(o1, { voided: 1, kept: 1 }, 'فقط هزینهٔ پیوندخورده با همان ردیف بسته می‌شود؛ ردیف خواهر (recurringKey مشترک) دست نمی‌خورد');
var o2 = voidOpexLinkModel('SHT-A', 'salary:SHR-1:1405/04', [
  { shareTx: '', recurringKey: 'salary:SHR-1:1405/04', active: true, shareholderSalary: true }
]);
assert.deepStrictEqual(o2, { voided: 1, kept: 0 }, 'fallback legacy (shareTx خالی + recurringKey یکسان) بسته می‌شود');
var o3 = voidOpexLinkModel('SHT-A', 'salary:SHR-1:1405/04', [
  { shareTx: 'SHT-C', recurringKey: 'salary:SHR-2:1405/04', active: true, shareholderSalary: true },
  { shareTx: 'SHT-A', recurringKey: 'salary:SHR-1:1405/04', active: false, shareholderSalary: true }
]);
assert.deepStrictEqual(o3, { voided: 0, kept: 1 }, 'هزینهٔ غیرمرتبط یا از پیش باطل‌شده void نمی‌شود');
console.log('  ✔ رفتاری: ابطالِ حقوق، فقط هزینهٔ همان ردیف را می‌بندد (بدون دوباره‌شماری سود)');

console.log('PASS tester644 v34.38.20 shareholder manual void + salary dedupe');
