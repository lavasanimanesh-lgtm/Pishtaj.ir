/* tester654 — v34.38.20 (SH-SALARY-EDIT-PROPAGATE + SH-SALARY-ADVANCE):
   گزارش کارفرما: «حقوقِ یکی از کاربران را اصلاح کردم ولی در بخش حقوق تعهدیِ سال مالی
   تغییری ایجاد نشد؛ و مبلغی از حقوقِ یک سهامدار به‌صورت علی‌الحساب پرداخت شد ولی کسر نشد.»

   ریشهٔ ۱ (اصلاح حقوق): reconcile_shareholder_salaries فقط ماهِ ارسالی (ماهِ پنل/جاری) را
   با مبلغ جدید به‌روز می‌کرد؛ ماه‌های قبلیِ حقوقِ همان سهامدار مبلغ قدیم را نگه می‌داشتند،
   پس «حقوق تعهدیِ سال» (مجموع ماه‌ها) تقریباً ثابت می‌ماند. حالا وقتی مبلغ حقوق در ویرایش
   سهامدار تغییر می‌کند (applySalaryAmountAllMonths)، سرور مبلغِ همهٔ ماه‌های بازِ حقوقِ همان
   سهامدار (شامل ردیف مطالبه + هزینهٔ پیوندخورده) را به مبلغ جدید پروفایل می‌برد؛ ماهِ سالِ
   قفل‌شده رد می‌شود و هیچ void/ساختی رخ نمی‌دهد؛ هر تغییر در corrections ثبت می‌شود.

   ریشهٔ ۲ (علی‌الحساب حقوق): دکمهٔ «علی‌الحساب» همیشه draw بدونِ paymentFor/salaryMonth
   می‌ساخت و در fiscal فقط «علی‌الحسابِ سود» (advYear) شمرده می‌شد، نه کاهندهٔ حقوق تعهدی.
   حالا دیالوگِ برداشت یک انتخاب «علی‌الحساب حقوق» دارد که draw را با salaryMonth ثبت می‌کند
   ⇒ در salaryPaid (خروج نقدیِ حقوق) شمرده و از salaryUnpaid کم می‌شود و در advYear نمی‌آید.
   قرارداد B1/B2/B3 tester628 و «draw بدون نشان = علی‌الحساب سود» دست‌نخورده است. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');
var sh = fs.readFileSync('crm/shareholders.js', 'utf8');

console.log('── salary edit cross-month amount propagation + salary advance (v34.38.20) ──');

/* ── قرارداد استاتیک — سرور ── */
assert.ok(/applySalaryAmountAllMonths/.test(php), 'سرور پرچم انتشار مبلغ در همهٔ ماه‌ها را می‌خواند');
assert.ok(/\$salaryAmountPropagated=0;\$salaryAmountLockedSkipped=0;/.test(php), 'شمارنده‌های انتشار مبلغ موجودند');
assert.ok(/if\(\(int\)round\(sd_num\(\$tx\['amt'\]\?\?0\)\)!==\$salaryAmountTarget\)/.test(php), 'ردیف مطالبهٔ حقوق فقط در صورت تغییر مبلغ دست‌خورده می‌شود');
assert.ok(/if\(\(int\)round\(sd_num\(\$ox\['amt'\]\?\?0\)\)!==\$salaryAmountTarget\)/.test(php), 'ردیف هزینهٔ حقوق فقط در صورت تغییر مبلغ دست‌خورده می‌شود');
assert.ok(/kind'=>'salary_amount_propagate'/.test(php), 'هر تغییر مبلغ در ردپای corrections ثبت می‌شود');
assert.ok(/'salaryAmountPropagated'=>\$salaryAmountPropagated,'salaryAmountLockedSkipped'=>\$salaryAmountLockedSkipped/.test(php), 'نتیجه در پاسخ reconcile برمی‌گردد');
/* بلوک انتشار فقط داخل reconcile است (نه backfill/register) تا قرارداد جبران دست‌نخورده بماند */
var reconcileBlock = php.slice(php.indexOf("$action === 'reconcile_shareholder_salaries'"), php.indexOf("$action === 'backfill_shareholder_salaries'"));
assert.ok(reconcileBlock.indexOf('applySalaryAmountAllMonths') > -1, 'انتشار مبلغ در بلوک reconcile قرار دارد');
assert.ok(!/foreach\(\$possibleDuplicates[^)]*\)\s*\{[^}]*sd_out/.test(reconcileBlock.replace(/\s+/g, ' ')), 'انتشار مبلغ هیچ void/حذف خودکاری روی یافته‌های دوباره‌شماری ندارد');
console.log('  ✔ استاتیک: انتشار cross-month مبلغ در سرور، بدون void/حذف خودکار');

/* ── قرارداد استاتیک — کلاینت ── */
assert.ok(/applySalaryAmountAllMonths: options\.applySalaryAmountAllMonths === true,/.test(sh), 'کلاینت پرچم را به فرمان سرور می‌رساند');
assert.ok(/applySalaryAmountAllMonths: prevSalary !== rec\.salary,/.test(sh), 'ویرایش سهامدار فقط وقتی مبلغ عوض شده پرچم می‌گذارد');
assert.ok(/id: 'salaryAdv', label: 'نوع برداشت'/.test(sh), 'دیالوگ برداشت انتخاب نوع دارد');
assert.ok(/lb: 'علی‌الحساب حقوق \(کسر از حقوق تعهدی\)'/.test(sh), 'گزینهٔ علی‌الحساب حقوق موجود است');
assert.ok(/var salaryMonth = \(v\.salaryAdv === 'yes'\) \? month : '';/.test(sh), 'علی‌الحساب حقوق با salaryMonth ثبت می‌شود');
assert.ok(/shareDrawOnServer\(s, amt, v\.desc, v\.files \|\| \[\], month, salaryMonth, draftCd\)/.test(sh), 'salaryMonth به ثبت برداشت می‌رسد');
assert.ok(/if \(x\.type === 'draw' && \(x\.paymentFor === 'salary' \|\| !!x\.salaryMonth\)\) typeLb = 'پرداخت حقوق \(draw\)';/.test(sh), 'برچسب گردش برای علی‌الحساب حقوق هم درست است');
assert.ok(sh.indexOf("shareAction('paysalary', '💳', 'پرداخت حقوق'") > -1, 'دکمهٔ «پرداخت حقوق» در کارت سهامدار به ptfSharePaySalary وصل است');
console.log('  ✔ استاتیک: پرچم کلاینت + دیالوگ علی‌الحساب حقوق');

/* ── مدل رفتاری مستقل — انتشار مبلغ ── */
function isActive(r) {
  var t = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
  return !r || (t.indexOf(String((r.status || '').toLowerCase())) < 0 && t.indexOf(String((r.st || '').toLowerCase())) < 0 && !r.voided && !r.deleted);
}
function locked(snaps, month) {
  var y = String(month).split('/')[0];
  return snaps.some(function (s) { return s && s.locked && String(s.year || '') === y; });
}
function propagateAmount(sharetx, opex, snaps, scopeShareholder, targetSalary) {
  var propagated = 0, lockedSkipped = 0, corrections = 0;
  sharetx.forEach(function (tx, i) {
    if (!tx || String(tx.type || '').toLowerCase() !== 'salary') return;
    if (String(tx.shCd || '') !== scopeShareholder) return;
    if (!isActive(tx)) return;
    if (locked(snaps, tx.month || '')) { lockedSkipped++; return; }
    if (Math.round(+tx.amt || 0) !== targetSalary) { sharetx[i].amt = targetSalary; propagated++; corrections++; }
  });
  var txShByCd = {};
  sharetx.forEach(function (tx) { if (tx && tx.cd && tx.shCd) txShByCd[tx.cd] = tx.shCd; });
  opex.forEach(function (ox, i) {
    if (!ox || !ox.shareholderSalary || !isActive(ox)) return;
    var shCd = '';
    var m = String(ox.recurringKey || '').match(/^salary:(.+):(?:13|14)\d{2}\/\d{2}$/);
    if (m) shCd = m[1];
    if (!shCd && ox.shareTx && txShByCd[ox.shareTx]) shCd = txShByCd[ox.shareTx];
    if (shCd !== scopeShareholder) return;
    if (locked(snaps, ox.month || '')) { lockedSkipped++; return; }
    if (Math.round(+ox.amt || 0) !== targetSalary) { opex[i].amt = targetSalary; propagated++; corrections++; }
  });
  return { propagated: propagated, lockedSkipped: lockedSkipped, corrections: corrections };
}

var sharetx = [
  { cd: 'SHT-A2', shCd: 'SHR-A', type: 'salary', amt: 100000000, month: '1405/02', status: 'active' },
  { cd: 'SHT-A3', shCd: 'SHR-A', type: 'salary', amt: 100000000, month: '1405/03', status: 'active' },
  { cd: 'SHT-A4', shCd: 'SHR-A', type: 'salary', amt: 100000000, month: '1404/12', status: 'active' }, /* سال قفل */
  { cd: 'SHT-AV', shCd: 'SHR-A', type: 'salary', amt: 100000000, month: '1405/05', status: 'void' },
  { cd: 'SHT-B', shCd: 'SHR-B', type: 'salary', amt: 100000000, month: '1405/02', status: 'active' }, /* سهامدار دیگر */
  { cd: 'SHT-A6', shCd: 'SHR-A', type: 'salary', amt: 120000000, month: '1405/06', status: 'active' } /* مبلغ جدید */
];
var opex = [
  { shareholderSalary: true, shareTx: 'SHT-A2', recurringKey: 'salary:SHR-A:1405/02', amt: 100000000, month: '1405/02', status: 'active' },
  { shareholderSalary: true, shareTx: 'SHT-A3', recurringKey: 'salary:SHR-A:1405/03', amt: 100000000, month: '1405/03', status: 'active' },
  { shareholderSalary: true, shareTx: 'SHT-A4', recurringKey: 'salary:SHR-A:1404/12', amt: 100000000, month: '1404/12', status: 'active' },
  { shareholderSalary: true, shareTx: 'SHT-AV', recurringKey: 'salary:SHR-A:1405/05', amt: 100000000, month: '1405/05', status: 'void' },
  { shareholderSalary: true, shareTx: 'SHT-B', recurringKey: 'salary:SHR-B:1405/02', amt: 100000000, month: '1405/02', status: 'active' },
  { shareholderSalary: true, shareTx: 'SHT-A6', recurringKey: 'salary:SHR-A:1405/06', amt: 120000000, month: '1405/06', status: 'active' },
  { cat: 'اجاره', amt: 50000000, month: '1405/06', status: 'active' } /* دستی غیرحقوق */
];
var snaps = [{ year: '1404', locked: true }];
var r = propagateAmount(sharetx, opex, snaps, 'SHR-A', 120000000);
assert.strictEqual(r.propagated, 4, '۴ ردیف بازِ همان سهامدار (۲ مطالبه + ۲ هزینه) به مبلغ جدید رسیدند');
assert.strictEqual(r.lockedSkipped, 2, 'ماه‌های سال قفل‌شده (مطالبه + هزینه) رد و شمرده شدند');
assert.strictEqual(sharetx[0].amt, 120000000, 'مطالبهٔ ۱۴۰۵/۰۲ به مبلغ جدید رسید');
assert.strictEqual(opex[0].amt, 120000000, 'هزینهٔ ۱۴۰۵/۰۲ به مبلغ جدید رسید');
assert.strictEqual(sharetx[2].amt, 100000000, 'ماهِ سال قفل‌شده دست‌نخورده ماند');
assert.strictEqual(sharetx[3].amt, 100000000, 'ردیف void دست‌نخورده ماند');
assert.strictEqual(sharetx[4].amt, 100000000, 'سهامدار دیگر لمس نشد');
assert.strictEqual(opex[6].amt, 50000000, 'هزینهٔ دستی غیرحقوق لمس نشد');
assert.strictEqual(r.corrections, 4, 'هر تغییر مبلغ یک سند اصلاحی دارد');
console.log('  ✔ رفتاری: انتشار مبلغ فقط روی ماه‌های بازِ سهامدارِ محدوده، با رد قفل و void');

/* بدون پرچم → هیچ تغییری (قرارداد قبلی دست‌نخورده) */
var noFlagTx = [{ cd: 'SHT-1', shCd: 'SHR-A', type: 'salary', amt: 100000000, month: '1405/02', status: 'active' }];
var noFlagOx = [{ shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/02', amt: 100000000, month: '1405/02', status: 'active' }];
assert.deepStrictEqual(propagateAmount(noFlagTx, noFlagOx, [], 'SHR-A', 100000000).propagated, 0, 'بدون تغییر مبلغ هیچ ردیفی دست نمی‌خورد');
console.log('  ✔ رفتاری: مبلغ یکسان = بدون دست‌خوردن (idempotent)');

/* ── مدل رفتاری مستقل — علی‌الحساب حقوق ── */
function isSalaryOpex(o) { return !!(o.shareholderSalary === true || o.shareTx || String(o.recurringKey || '').indexOf('salary:') === 0); }
function cashModel(opexRows, txRows, year) {
  var salaryClaims = 0, salaryPaid = 0, adv = 0;
  opexRows.forEach(function (o) {
    if (!o || !isActive(o)) return;
    if (isSalaryOpex(o)) salaryClaims += (+o.amt || 0);
  });
  txRows.forEach(function (x) {
    if (!x || !isActive(x)) return;
    if (String(x.fy || '') !== year) return;
    if (x.type === 'draw' && (x.paymentFor === 'salary' || !!x.salaryMonth)) { salaryPaid += (+x.amt || 0); return; }
    if (x.type === 'draw' || x.type === 'advance' || x.type === 'debit') adv += (+x.amt || 0);
  });
  return { salaryClaims: salaryClaims, salaryPaid: salaryPaid, salaryUnpaid: Math.max(0, salaryClaims - salaryPaid), advYear: adv };
}
var opex1 = [{ shareholderSalary: true, recurringKey: 'salary:SHR-A:1405/06', amt: 400000000, status: 'active' }];
var t1 = cashModel(opex1, [
  { cd: 'D1', type: 'draw', amt: 150000000, paymentFor: 'salary', salaryMonth: '1405/06', status: 'active', fy: '1405' }
], '1405');
assert.strictEqual(t1.salaryPaid, 150000000, 'علی‌الحساب حقوق (draw با salaryMonth) در حقوق پرداخت‌شده شمرده می‌شود');
assert.strictEqual(t1.salaryUnpaid, 250000000, 'حقوق پرداخت‌نشده = تعهد − علی‌الحساب حقوق');
assert.strictEqual(t1.advYear, 0, 'علی‌الحساب حقوق در علی‌الحساب سود نمی‌آید (کسر دوباره نمی‌شود)');
var t2 = cashModel(opex1, [
  { cd: 'D2', type: 'draw', amt: 70000000, status: 'active', fy: '1405' }
], '1405');
assert.strictEqual(t2.salaryPaid, 0, 'برداشت عادی (بدون نشان حقوق) حقوق پرداخت‌شده نیست');
assert.strictEqual(t2.advYear, 70000000, 'برداشت عادی همچنان علی‌الحساب سود است (قرارداد tester628)');
console.log('  ✔ رفتاری: علی‌الحساب حقوق از حقوق تعهدی کم می‌شود و برداشت عادی در advYear می‌ماند');

console.log('PASS tester654 v34.38.20 salary edit cross-month propagation + salary advance');
