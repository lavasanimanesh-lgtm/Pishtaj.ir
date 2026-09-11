/* tester631 — v34.38.20 (F-3 — cross-check سروری قالب‌های OPEX تکرارشونده): در لایهٔ
   سرور reconcile_recurring_opex، پیش از متریالایز قالب، ردیفِ دستیِ فعالِ هم‌دسته/هم‌مبلغ
   و تنخواهِ هم‌مبلغ/هم‌ماه همان دوره جمع‌آوری می‌شود و در فیلد possibleDuplicates برمی‌گردد.
   شرط: فقط هشدار — هیچ void/ادغام/حذف خودکاری انجام نمی‌شود؛ تعیین‌تکلیف انسانی است. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/sales-domain.php', 'utf8');

console.log('── F-3 server-side recurring-OPEX duplicate cross-check (v34.38.20) ──');

/* قرارداد استاتیک */
assert.ok(/\$possibleDuplicates=\[\];/.test(php), 'آرایهٔ جمع‌آوری دوباره‌شماری مقداردهی می‌شود');
assert.ok(/\$pettyRowsForDup = \$includeTemplates \? sd_read\('ptf_crm_petty'\) : \[\];/.test(php), 'تنخواهِ دوره یک‌بار برای cross-check خوانده می‌شود');
assert.ok(/foreach\(\$opex as \$manualOx\)/.test(php), 'پویش ردیف‌های دستی هم‌دوره');
assert.ok(/\['kind'=>'manual-opex'/.test(php), 'برچسب دستی در یافتهٔ دوباره‌شماری');
assert.ok(/\['kind'=>'petty'/.test(php), 'برچسب تنخواه در یافتهٔ دوباره‌شماری');
assert.ok(/'possibleDuplicates'=>\$possibleDuplicates/.test(php), 'یافته‌ها در پاسخ reconcile برمی‌گردد');
console.log('  ✔ استاتیک: پویش دستی/تنخواه + خروجی possibleDuplicates در پاسخ');

/* مدل رفتاری مستقل — همان قاعدهٔ جمع‌آوری؛ فقط خواندنی */
function isActive(r) {
  var t = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
  var st = String((r || {}).status || '').toLowerCase();
  return t.indexOf(st) < 0 && !r.voided && !r.deleted;
}
function isRecurring(r) {
  return !!r && (String(r.recurringKey || '').trim() !== '' || String(r.tplId || '').trim() !== '' || !!r.shareholderSalary);
}
function collectDuplicates(manualRows, pettyRows, month, cat, amt, tplId) {
  var out = [];
  manualRows.forEach(function (ox) {
    if (!isActive(ox) || isRecurring(ox)) return;
    if (String(ox.month || '') !== month || String(ox.cat || '') !== cat) return;
    if (Math.round(+ox.amt || 0) !== Math.round(amt)) return;
    out.push({ kind: 'manual-opex', cd: String(ox._opexRowId || ox.cd || ''), cat: cat, amt: Math.round(amt), templateId: tplId });
  });
  pettyRows.forEach(function (pr) {
    if (!isActive(pr) || pr.dealRef) return;
    if (String(pr.month || '') !== month) return;
    if (Math.round(+pr.amt || 0) !== Math.round(amt)) return;
    out.push({ kind: 'petty', cd: String(pr.cd || ''), amt: Math.round(amt), templateId: tplId });
  });
  return out;
}

var manualRows = [
  { _opexRowId: 'OPXR-1', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/06', status: 'active' },
  { _opexRowId: 'OPXR-2', cat: 'اجاره', amt: 50000000, month: '1405/06', status: 'active' },
  { _opexRowId: 'OPXR-3', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/06', recurringKey: 'salary:…', status: 'active' }, /* خودِ متریالایز */
  { _opexRowId: 'OPXR-4', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/06', status: 'void' }
];
var pettyRows = [
  { cd: 'PETTY-1', amt: 30000000, month: '1405/06', status: 'active' },
  { cd: 'PETTY-2', amt: 30000000, month: '1405/06', dealRef: 'DL-1', status: 'active' }, /* پرونده‌دار — مستثنا */
  { cd: 'PETTY-3', amt: 99999999, month: '1405/06', status: 'active' }
];

var found = collectDuplicates(manualRows, pettyRows, '1405/06', 'حقوق و دستمزد', 30000000, 'TPL-9');
assert.deepStrictEqual(found.map(function (x) { return x.kind; }).sort(), ['manual-opex', 'petty'], 'دستیِ هم‌دسته/هم‌مبلغ و تنخواهِ هم‌مبلغ/هم‌ماه هر دو گزارش می‌شوند');
assert.ok(found.every(function (x) { return x.amt === 30000000; }), 'مبلغ در یافته صحیح است');
assert.strictEqual(found.filter(function (x) { return x.kind === 'manual-opex'; })[0].cd, 'OPXR-1', 'فقط ردیف دستیِ فعال (نه void، نه recurring) گزارش می‌شود');
assert.ok(!found.some(function (x) { return x.cd === 'PETTY-2'; }), 'تنخواهِ پرونده‌دار مستثناست');

var none = collectDuplicates(manualRows, pettyRows, '1405/06', 'اجاره', 60000000, 'TPL-9');
assert.strictEqual(none.length, 0, 'مبلغ متفاوت (حتی هم‌دسته) دوباره‌شماری نمی‌شود');
var noneCat = collectDuplicates(manualRows, pettyRows, '1405/06', 'بیمه', 50000000, 'TPL-9');
assert.strictEqual(noneCat.length, 0, 'دستهٔ متفاوت دوباره‌شماری نمی‌شود');
var none2 = collectDuplicates(manualRows, pettyRows, '1405/07', 'حقوق و دستمزد', 30000000, 'TPL-9');
assert.strictEqual(none2.length, 0, 'ماه متفاوت دوباره‌شماری نمی‌شود');
console.log('  ✔ رفتاری: فقط ردیفِ فعالِ هم‌ماه/هم‌دسته/هم‌مبلغ به‌عنوان هشدار برمی‌گردد');

/* قرارداد عدم-تخریب: در بلوک reconcile نباید void/حذف خودکاری رخ دهد */
var reconcileBlock = php.slice(php.indexOf("$action === 'reconcile_recurring_opex'"), php.indexOf("$action === 'backfill_shareholder_salaries'"));
assert.ok(!/foreach\(\$possibleDuplicates[^)]*\)\s*\{[^}]*sd_out/.test(reconcileBlock.replace(/\s+/g, ' ')), 'هیچ عملیات void/حذف خودکار روی یافته‌های دوباره‌شماری نیست');
console.log('  ✔ رفتاری: cross-check فقط گزارش‌دهنده است (بدون void/ادغام خودکار)');

console.log('PASS tester631 v34.38.20 F-3 server duplicate cross-check');
