/* tester630 — v34.38.20 (SF-INVOICE-REVERT — گزارش کارفرما: «فاکتور تأمین کم شد؛ ویرایش
   کردم درست شد ولی دوباره برگشت»). دو ریشه بسته شد:
   ۱) merge در crm/sync.js برای ptf_crm_supplier_finance برندهٔ هر رکورد را با مقایسهٔ
      رشته‌ای خامِ updatedAtISO (میلادی "2026-…") با t (شمسی "۱۴۰۵/…") انتخاب می‌کرد؛
      ارقام فارسی یونیکد بزرگ‌تری دارند، پس نسخهٔ کهنهٔ فقط-t همیشه برنده می‌شد و مقدار
      قدیمی را دوباره push می‌کرد. حالا مقایسه روی sfComparableTs نرمال‌شده است.
   ۲) slImportRealPurchase در supplier-finance.js مبلغ فاکتور/پرداخت را با price×qty
      بازنویسی می‌کرد؛ حالا پرچم ماندگار manualAmountEdit (که slInvoiceEdit هنگام تغییر
      مبلغ می‌نشاند) جلوی بازنویسی مبلغ دستی را می‌گیرد. متادیتا همچنان به‌روز می‌شود. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var sf = fs.readFileSync('crm/supplier-finance.js', 'utf8');

console.log('── supplier-invoice amount revert (v34.38.20) ──');

/* قرارداد استاتیک */
assert.ok(/function sfComparableTs\(r\)/.test(sync), 'sfComparableTs defined in sync merge');
assert.ok(/return '2' \+ iso/.test(sync), 'ISO میلادی بالاترین رتبهٔ مقایسه را می‌گیرد');
assert.ok(/if \(!raw\) return '0'/.test(sync), 'رکورد بی‌زمان کهنه‌ترین است و هرگز برنده نمی‌شود');
assert.ok(/return '1' \+ latin/.test(sync), 'fallback غیرقابل تبدیل در رتبهٔ میانی (بازنده در برابر ISO)');
assert.ok(/replace\(\/\[۰-۹\]\/g/.test(sync), 'ارقام فارسی نرمال می‌شوند');
assert.ok(/replace\(\/\[٠-٩\]\/g/.test(sync), 'ارقام عربی نرمال می‌شوند');
assert.ok(/ptfJToISO\(jal\)/.test(sync), 'fallback شمسی→میلادی برای رکورد فقط-t');
assert.ok(/var lt=sfComparableTs\(it\), rt=sfComparableTs\(remoteRec\)/.test(sync), 'برندهٔ merge با زمان نرمال‌شده انتخاب می‌شود');
assert.ok(/i\.manualAmountEdit = true/.test(sf), 'تغییر مبلغ دستی پرچم ماندگار می‌نشاند');
assert.ok(/if \(!inv\.manualAmountEdit\) \{ inv\.amount/.test(sf), 'بازوارد مبلغ فاکتورِ دستی را بازنویسی نمی‌کند');
assert.ok(/if \(!inv\.manualAmountEdit\) \{ pay\.amount/.test(sf), 'بازوارد مبلغ پرداختِ متناظر را بازنویسی نمی‌کند');
assert.ok(/inv\.item=o\.item\|/.test(sf), 'متادیتای فاکتور همچنان به‌روز می‌شود');
console.log('  ✔ استاتیک: مقایسه‌گر زمان نرمال‌شده + اولویت مبلغ دستی در بازوارد');

/* مدل رفتاری مستقل — معادل sfComparableTs. توابع تبدیل شمسی→میلادی دقیقاً از
   crm/date-kit.js کپی شده‌اند تا مدل تست با رفتار تولید یکی باشد. */
function div(a, b) { return ~~(a / b); }
function pad(n) { return String(n).padStart(2, '0'); }
function faArToLatin(s) {
  var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i), fi = FA.indexOf(c);
    if (fi > -1) { out += fi; continue; }
    var ai = AR.indexOf(c);
    if (ai > -1) { out += ai; continue; }
    out += c;
  }
  return out;
}
function g2d(gy, gm, gd) {
  var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  var j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  var i = div((j % 1461), 4) * 5 + 308;
  var gd = div((i % 153), 5) + 1;
  var gm = (div(i, 153) % 12) + 1;
  var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy: gy, gm: gm, gd: gd };
}
var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
function jalCal(jy) {
  var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, n, i;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
  for (i = 1; i < bl; i++) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div((jump % 33), 4); jp = jm; }
  n = jy - jp;
  leapJ += div(n, 33) * 8 + div(((n % 33) + 3), 4);
  if ((jump % 33) === 4 && jump - n === 4) leapJ += 1;
  var leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  var march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div((jump + 4), 33) * 33;
  leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return { leap: leap, gy: gy, march: march };
}
function j2d(jy, jm, jd) { var r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
function jToIsoModel(j) {
  var n = faArToLatin(String(j || '')).replace(/-/g, '/').replace(/\s/g, '');
  var m = n.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  var jy = +m[1], jm = +m[2], jd = +m[3];
  if (jy < 1300 || jy > 1499 || jm < 1 || jm > 12 || jd < 1) return '';
  var g;
  try { g = d2g(j2d(jy, jm, jd)); } catch (e) { return ''; }
  return g.gy + '-' + pad(g.gm) + '-' + pad(g.gd);
}
function sfComparableTs(r) {
  r = r || {};
  var iso = String(r.updatedAtISO || '');
  if (iso) return '2' + iso;
  var raw = String(r.updatedAt || r.t || r.date || r.iso || '');
  if (!raw) return '0';
  var latin = faArToLatin(raw);
  var m = latin.match(/((?:13|14)\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    var jal = m[1] + '/' + ('0' + m[2]).slice(-2) + '/' + ('0' + m[3]).slice(-2);
    var conv = jToIsoModel(jal);
    if (conv) return '2' + conv + (latin.indexOf(jal) === 0 ? latin.slice(jal.length) : '');
  }
  return '1' + latin;
}

/* — ریشهٔ باگ: رکورد کهنهٔ فقط-t نباید از رکورد جدید میلادی برنده شود — */
var oldPersianOnly = { cd: 'SFINV-1', amount: 50000000, t: '۱۴۰۵/۰۶/۱۰' };
var newIsoRow = { cd: 'SFINV-1', amount: 80000000, updatedAtISO: '2026-09-01T10:00:00Z' };
assert.ok(sfComparableTs(newIsoRow) > sfComparableTs(oldPersianOnly),
  'رکورد جدید میلادی باید از رکورد کهنهٔ فقط-شمسی برنده شود (رفع بازگشت مبلغ)');

/* — ترتیب درست میان دو رکورد میلادی — */
assert.ok(sfComparableTs({ updatedAtISO: '2026-09-10T00:00:00Z' }) > sfComparableTs({ updatedAtISO: '2026-09-01T00:00:00Z' }),
  'میلادی جدیدتر برنده است');

/* — fallback شمسی→میلادی برای دو رکورد فقط-t — */
assert.ok(sfComparableTs({ t: '۱۴۰۵/۰۶/۲۰' }) > sfComparableTs({ t: '۱۴۰۵/۰۶/۱۰' }),
  'بین دو رکورد فقط-شمسی، ماه جدیدتر برنده است');

/* — ارقام فارسی/عربی برابر شمرده می‌شوند — */
assert.strictEqual(faArToLatin('۱۴۰۵'), faArToLatin('١٤٠٥'), 'نرمال‌سازی فارسی/عربی هم‌ارز است');

/* — سخت‌سازی ترتیب: رکوردِ بی‌زمان و رکوردِ غیرقابل‌تبدیل نباید برنده شوند — */
assert.ok(sfComparableTs({}) < sfComparableTs({ updatedAtISO: '2026-01-01T00:00:00Z' }),
  'رکورد بی‌زمان از رکورد ISO جدیدتر بازنده است (نه برنده)');
assert.ok(sfComparableTs({ t: '2026-09-10' }) < sfComparableTs({ updatedAtISO: '2026-01-01T00:00:00Z' }),
  'تاریخِ غیرقابل‌تبدیل (fallback) از رکورد ISO بازنده است');
assert.ok(sfComparableTs({}) < sfComparableTs({ t: '۱۴۰۵/۰۶/۱۰' }),
  'رکورد بی‌زمان از رکورد شمسیِ تبدیل‌شده هم بازنده است');
console.log('  ✔ رفتاری: مقایسه‌گر زمان، بازگشت مبلغ فاکتور را خنثی می‌کند');

/* — مدل رفتاری بازوارد خرید واقعی: مبلغ دستی مقدم بر price×qty — */
function importInvoice(inv, purchase) {
  inv.supplierCd = purchase.supplierCd;
  if (!inv.manualAmountEdit) { inv.amount = Math.round(+purchase.amount || 0); inv.amountIrr = inv.amount; }
  inv.item = purchase.item || inv.item || '';
  inv.qty = +purchase.qty || inv.qty || 0;
  inv.unitPrice = +purchase.unitPrice || inv.unitPrice || 0;
  return inv;
}
var manual = { cd: 'SFINV-1', amount: 75000000, manualAmountEdit: true, item: '' };
var after = importInvoice(manual, { supplierCd: 'SUP-9', amount: 50000000, item: 'پمپ', qty: 2, unitPrice: 25000000 });
assert.strictEqual(after.amount, 75000000, 'مبلغ دستی با بازوارد بازنویسی نمی‌شود');
assert.strictEqual(after.item, 'پمپ', 'متادیتا (قلم) با بازوارد به‌روز می‌شود');
var auto = importInvoice({ cd: 'SFINV-2', amount: 1 }, { supplierCd: 'SUP-9', amount: 50000000, item: 'پمپ', qty: 2, unitPrice: 25000000 });
assert.strictEqual(auto.amount, 50000000, 'فاکتور بدون ویرایش دستی همچنان با بازوارد همگام می‌شود');
console.log('  ✔ رفتاری: اولویت مبلغ دستی فقط برای فاکتورِ دست‌خورده، نه همه');

console.log('PASS tester630 v34.38.20 supplier-invoice amount revert');
