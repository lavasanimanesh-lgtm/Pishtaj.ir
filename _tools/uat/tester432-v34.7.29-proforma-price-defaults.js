#!/usr/bin/env node
'use strict';
/* v34.7.29 — خواستهٔ کارفرما: «در صدور پیش‌فاکتور پروندهٔ فروش، قیمت پیش‌فرض هر قلم
   باید معادل قیمت همان قلم در پیشنهاد/پیشنهادهای مالی همان پرونده باشد.»
   ریشهٔ باگ: هر ردیف فقط قیمت «پیشنهاد مبدأ خودش» را می‌گرفت ⇒
     • انتخاب پیشنهاد فنی (TO) ⇒ همهٔ قیمت‌ها صفر
     • حالت تجمیعی ⇒ نتیجه وابسته به ترتیب پیشنهادها (ردیف بی‌قیمت برندهٔ ادغام می‌شد)
     • ردیف صفر هنگام صدور بی‌صدا حذف می‌شد
   مرجع: RELEASE-NOTES-v34.7.29.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ناحیهٔ پیوستهٔ توابع قیمت‌گذاری در vm اجرا می‌شود (اجرای رفتاری، نه grep) */
function priceEngine() {
  var src = read('crm/unofficial-invoice.js');
  var i = src.indexOf('window.unofficialInvoiceItemKey');
  var j = src.indexOf('// ===== حالت سراسری دیالوگ');
  if (i < 0 || j < 0 || j <= i) throw new Error('ناحیهٔ توابع قیمت‌گذاری پیدا نشد');
  var sb = { console: console, Math: Math, String: String, Number: Number, JSON: JSON, window: null };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(src.slice(i, j), sb, { filename: 'unofficial-invoice.js#pricing' });
  return sb;
}

var CO = { no: 'PTF-CO-1', kind: 'CO', st: 'won', currency: 'IRR', items: [
  { name: 'شیر توپی', pcode: 'P1', qty: 2, price: 5000000 },
  { name: 'فلنج', pcode: 'P2', qty: 4, price: 250000 }
] };
var TO = { no: 'PTF-TO-1', kind: 'TO', currency: 'IRR', items: [
  { name: 'شیر توپی', pcode: 'P1', qty: 2 },
  { name: 'فلنج', pcode: 'P2', qty: 4 },
  { name: 'واشر', pcode: 'P9', qty: 10 }            /* در هیچ پیشنهاد مالی قیمت ندارد */
] };
var CO2 = { no: 'PTF-CO-2', kind: 'CO', currency: 'IRR', items: [
  { name: 'پمپ', pcode: 'P5', qty: 1, price: 90000000 }
] };

/* ---------- الزام اصلی: تک‌پیشنهاد ---------- */
(function singleMode() {
  var s = priceEngine();
  var book = s.unofficialInvoicePriceBook([TO, CO], 'PTF-CO-1');
  var lines = s.unofficialInvoiceSnapshotLines(TO, book);
  T('قیمت پیش‌فرض قلم از پیشنهاد مالی پرونده می‌آید (نه صفر)',
    lines[0].price === 5000000 && lines[1].price === 250000, JSON.stringify(lines.map(function (l) { return l.price; })));
  T('منشأ قیمت روی ردیف ثبت می‌شود (شفافیت)',
    lines[0].priceFromOffer === 'PTF-CO-1' && lines[0].priceDefaulted === true, JSON.stringify(lines[0]));
  T('جمع ردیف با قیمت پیش‌فرض به‌روز می‌شود', lines[0].lineTotal === 2 * 5000000, lines[0].lineTotal);
  T('قلمی که در هیچ پیشنهاد مالی نیست، صفر می‌ماند (بدون قیمت ساختگی)', lines[2].price === 0);

  /* عدم رگرسیون: قیمت واقعی خود پیشنهاد هرگز بازنویسی نمی‌شود */
  var linesCO = s.unofficialInvoiceSnapshotLines(CO, s.unofficialInvoicePriceBook([CO2, CO], 'PTF-CO-2'));
  T('عدم رگرسیون: قیمت واقعی پیشنهاد انتخاب‌شده دست‌نخورده می‌ماند',
    linesCO[0].price === 5000000 && !linesCO[0].priceDefaulted, JSON.stringify(linesCO[0]));
})();

/* ---------- الزام: حالت تجمیعی مستقل از ترتیب ---------- */
(function consolidated() {
  var s = priceEngine();
  var book = s.unofficialInvoicePriceBook([TO, CO], 'PTF-CO-1');
  var a = s.unofficialInvoiceConsolidateLines([TO, CO], CO, book).map(function (l) { return l.price; });
  var b = s.unofficialInvoiceConsolidateLines([CO, TO], CO, book).map(function (l) { return l.price; });
  T('حالت تجمیعی: قیمت‌ها با ترتیب پیشنهادها تغییر نمی‌کند',
    a[0] === 5000000 && a[1] === 250000 && b[0] === 5000000 && b[1] === 250000, JSON.stringify({ a: a, b: b }));
  T('حالت تجمیعی: قلم تکراری با قیمت واقعی برنده می‌شود (نه اولین ردیف)',
    a.filter(function (x) { return x === 0; }).length === 1, JSON.stringify(a));

  /* بدون پاس دادن دفتر قیمت هم باید همان نتیجه بدهد (فراخوان‌های قدیمی) */
  var c = s.unofficialInvoiceConsolidateLines([TO, CO], CO).map(function (l) { return l.price; });
  T('سازگاری عقب‌رو: بدون آرگومان دفتر قیمت هم قیمت پیشنهاد مالی اعمال می‌شود',
    c[0] === 5000000 && c[1] === 250000, JSON.stringify(c));

  /* دو CO مستقل: هر قلم قیمت خودش را نگه می‌دارد */
  var d = s.unofficialInvoiceConsolidateLines([CO, CO2], CO, s.unofficialInvoicePriceBook([CO, CO2], 'PTF-CO-1'));
  T('عدم رگرسیون: در چند پیشنهاد مالی، هر قلم قیمت پیشنهاد خودش را دارد',
    d[0].price === 5000000 && d[2].price === 90000000, JSON.stringify(d.map(function (l) { return l.name + '=' + l.price; })));
})();

/* ---------- اولویت مرجع قیمت ---------- */
(function ranking() {
  var s = priceEngine();
  var COwon = { no: 'CO-WON', kind: 'CO', st: 'won', currency: 'IRR', items: [{ pcode: 'P1', name: 'شیر', qty: 1, price: 7000000 }] };
  var COlost = { no: 'CO-OLD', kind: 'CO', st: 'lost', currency: 'IRR', items: [{ pcode: 'P1', name: 'شیر', qty: 1, price: 3000000 }] };
  var TC = { no: 'TC-1', kind: 'TC', currency: 'IRR', items: [{ pcode: 'P1', name: 'شیر', qty: 1, price: 4000000 }] };
  var Tech = { no: 'TO-9', kind: 'TO', currency: 'IRR', items: [{ pcode: 'P1', name: 'شیر', qty: 1 }] };
  var withPref = s.unofficialInvoiceSnapshotLines(Tech, s.unofficialInvoicePriceBook([COlost, TC, COwon, Tech], 'CO-WON'))[0];
  T('پیشنهاد برندهٔ پرونده بالاترین اولویت قیمت است', withPref.price === 7000000, withPref.price);
  var noPref = s.unofficialInvoiceSnapshotLines(Tech, s.unofficialInvoicePriceBook([COlost, TC, COwon, Tech]))[0];
  T('بدون preferred: CO برنده بر CO باخته و بر TC مقدم است', noPref.price === 7000000, noPref.price);
  var onlyTc = s.unofficialInvoiceSnapshotLines(Tech, s.unofficialInvoicePriceBook([TC, Tech]))[0];
  T('اگر CO نبود، TC (فنی-مالی) مرجع قیمت است', onlyTc.price === 4000000, onlyTc.price);
  var onlyTech = s.unofficialInvoiceSnapshotLines(Tech, s.unofficialInvoicePriceBook([Tech]))[0];
  T('پیشنهاد فنی هرگز مرجع قیمت نمی‌شود', onlyTech.price === 0, onlyTech.price);
})();

/* ---------- ایمنی ارز ---------- */
(function currencySafety() {
  var s = priceEngine();
  var COeur = { no: 'CO-EUR', kind: 'CO', st: 'won', currency: 'EUR', items: [{ pcode: 'P5', name: 'پمپ', qty: 1, price: 1200 }] };
  var TOirr = { no: 'TO-IRR', kind: 'TO', currency: 'IRR', items: [{ pcode: 'P5', name: 'پمپ', qty: 1 }] };
  var ln = s.unofficialInvoiceSnapshotLines(TOirr, s.unofficialInvoicePriceBook([COeur, TOirr], 'CO-EUR'))[0];
  T('قیمت با ارز متفاوت بی‌صدا کپی نمی‌شود', ln.price === 0 && ln.priceNeedsAttention === true, JSON.stringify(ln));
  var same = s.unofficialInvoiceSnapshotLines(
    { no: 'TO-EUR', kind: 'TO', currency: 'EUR', items: [{ pcode: 'P5', name: 'پمپ', qty: 1 }] },
    s.unofficialInvoicePriceBook([COeur], 'CO-EUR'))[0];
  T('با ارز یکسان، قیمت ارزی هم پیش‌فرض می‌شود', same.price === 1200, JSON.stringify(same));
})();

/* ---------- تطبیق قلم ---------- */
(function itemKey() {
  var s = priceEngine();
  T('کلید تطبیق: کد کالا مقدم بر نام است',
    s.unofficialInvoiceItemKey({ pcode: 'P1', name: 'الف' }, 'O', 0) === s.unofficialInvoiceItemKey({ pcode: 'p1', name: 'ب' }, 'O2', 5));
  T('کلید تطبیق: نام نرمال‌شده (نیم‌فاصله/فاصله) یکسان می‌شود',
    s.unofficialInvoiceItemKey({ name: 'شیر توپی' }, 'O', 0) === s.unofficialInvoiceItemKey({ name: 'شیر‌توپی' }, 'O2', 1));
  T('کلید تطبیق: قلم بی‌هویت با قلم دیگر یکی نمی‌شود',
    s.unofficialInvoiceItemKey({}, 'O', 0) !== s.unofficialInvoiceItemKey({}, 'O', 1));
})();

/* ---------- اتصال در دیالوگ + هشدار ردیف بدون قیمت ---------- */
(function wiring() {
  var src = read('crm/unofficial-invoice.js');
  T('دفتر قیمت یک‌بار هنگام باز شدن دیالوگ ساخته می‌شود',
    /_priceBook = window\.unofficialInvoicePriceBook\(collected\.offers/.test(src));
  T('حالت تک‌پیشنهاد از دفتر قیمت استفاده می‌کند',
    /unofficialInvoiceSnapshotLines\(_singleOffer, _unInvState\.priceBook\)/.test(src));
  T('حالت تجمیعی از دفتر قیمت استفاده می‌کند',
    /unofficialInvoiceConsolidateLines\(_sel, _unInvState\.collected\.priceSourceOffer, _unInvState\.priceBook\)/.test(src));
  T('منشأ قیمت در ردیف جدول نمایش داده می‌شود', src.indexOf('قیمت از ') > -1 && src.indexOf('priceDefaulted') > -1);
  T('ردیف بدون قیمت دیگر بی‌صدا حذف نمی‌شود (تأیید صریح کاربر)',
    /_zeroRows[\s\S]{0,400}confirm\(/.test(src));
})();

console.log('\n— tester432 (پیش‌فاکتور: قیمت پیش‌فرض از پیشنهاد مالی پرونده) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
