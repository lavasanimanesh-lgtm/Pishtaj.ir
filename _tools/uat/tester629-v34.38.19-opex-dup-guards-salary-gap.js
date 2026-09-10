/* tester629 — v34.38.19 (OPEX-DUP-GUARD گام ۳/۴/۵ + SH-SALARY-MONTH-GAP): بستن دو شکافِ
   گزارش‌شدهٔ کارفرما:
   A) «یکی ۲ ماه حقوق، دو تای دیگر ۳ ماه» → آشکارساز read-only ماه‌های غایب/تکراری حقوق
      (ptfShareholderSalaryGaps) + نمایش در کیفیت داده — بدون تغییر داده.
   B) «حقوق پرسنل تکرارشونده → دو بار خروج خزانه» → گاردهای write-time دوباره‌شماری:
      ساخت/ویرایش قالب در برابر ردیف دستی/تنخواه (گام ۳)، ثبت دستی در برابر تنخواه (گام ۱
      تکمیلی)، تسویهٔ تک‌منبعی (گام ۴)، اعلان قالب ثبت‌نشده (گام ۵). همه فقط تأیید انسانی. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var opex = fs.readFileSync('crm/opex.js', 'utf8');
var shareholders = fs.readFileSync('crm/shareholders.js', 'utf8');
var dq = fs.readFileSync('crm/data-quality.js', 'utf8');

console.log('── OPEX double-count guards + salary month-gap (v34.38.19) ──');
/* قرارداد استاتیک */
assert.ok(/function opexManualOrPettyClash\(month, cat, amt\)/.test(opex), 'cross-channel clash helper');
assert.ok(/clashManualTpl && !confirm/.test(opex), 'template creation warns vs manual/petty row');
assert.ok(/clashEditManual && !confirm/.test(opex), 'template edit warns vs manual/petty row');
assert.ok(/clashPetty && !confirm/.test(opex), 'manual add warns vs petty twin');
assert.ok(/settledSibling \|\| settledPettyTwin\) && !confirm/.test(opex), 'settlement single-source confirm');
assert.ok(/opexTplDuplicateActive/.test(opex), 'template-dup guard retained');
assert.ok(/window\.ptfShareholderSalaryGaps = function/.test(shareholders), 'salary month-gap detector defined');
assert.ok(/eligibilitySince/.test(shareholders), 'eligibility anchor honored');
assert.ok(/shareholder-salary-gap/.test(dq), 'month-gap surfaced in data-quality');
console.log('  ✔ استاتیک: گاردهای write-time + آشکارساز ماه حقوق در جای خود');

/* مدل رفتاری مستقل — همان قواعد کلیدها */
function mIdx(m) { var p = String(m || '').split('/'); var y = +p[0], mo = +p[1]; return (y && mo) ? y * 12 + (mo - 1) : NaN; }
function mFromIdx(i) { return Math.floor(i / 12) + '/' + ('0' + ((i % 12) + 1)).slice(-2); }
function gapModel(claims, anchor, to) {
  var have = {}; claims.forEach(function (m) { have[m] = (have[m] || 0) + 1; });
  var start = mIdx(anchor), end = mIdx(to), missing = [], extra = [];
  if (isNaN(start) || isNaN(end) || start > end) return { missing: missing, extra: extra };
  for (var i = start; i <= end && (i - start) < 60; i++) {
    var mm = mFromIdx(i);
    if (!have[mm]) missing.push(mm); else if (have[mm] > 1) extra.push(mm + '×' + have[mm]);
  }
  return { missing: missing, extra: extra };
}
var a = gapModel(['1405/02', '1405/03', '1405/04'], '1405/02', '1405/06');
assert.deepStrictEqual(a.missing, ['1405/05', '1405/06'], 'shareholder with 3 months is missing the rest');
var b = gapModel(['1405/02', '1405/03', '1405/04', '1405/05', '1405/06'], '1405/02', '1405/06');
assert.deepStrictEqual(b.missing, [], 'complete shareholder has no gap');
var c = gapModel(['1405/02', '1405/02', '1405/03'], '1405/02', '1405/03');
assert.deepStrictEqual(c.extra, ['1405/02×2'], 'duplicate month flagged');
console.log('  ✔ رفتاری: ماه‌های غایب/تکراری درست تشخیص داده می‌شوند');

/* قالب تکراری: آستانهٔ هم cat+amt (بدون نیاز به برابری شرح) */
function tplDup(tpl, list) {
  if (!tpl) return null;
  for (var i = 0; i < (list || []).length; i++) {
    var t = list[i];
    if (!t || String(t.id || '') === String(tpl.id || '')) continue;
    if (String(t.cat || '') === String(tpl.cat || '') && Math.round(+t.amt || 0) === Math.round(+tpl.amt || 0)) return t;
  }
  return null;
}
var list = [
  { id: 'TPL-1', cat: 'حقوق و دستمزد', amt: 30000000, desc: 'حقوق حسابدار' },
  { id: 'TPL-2', cat: 'حقوق و دستمزد', amt: 30000000, desc: 'حقوق منشی' }
];
var d1 = tplDup(list[0], list);
assert.ok(d1 && d1.id === 'TPL-2', 'same cat+amt with different desc now warns');
var d2 = tplDup({ id: 'TPL-X', cat: 'اجاره', amt: 50000000, desc: 'اجاره دفتر' }, list);
assert.strictEqual(d2, null, 'different cat+amt is not a duplicate');
console.log('  ✔ رفتاری: قالب هم‌دسته/هم‌مبلغ با شرح متفاوت هم هشدار می‌گیرد');

console.log('PASS tester629 v34.38.19 opex duplicate guards + salary month-gap');
