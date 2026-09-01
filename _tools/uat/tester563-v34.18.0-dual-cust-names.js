#!/usr/bin/env node
'use strict';
/* tester563 — v34.29.2: نام دوگانهٔ مشتری در فهرست‌ها (فارسی + انگلیسی زیر هم)
   زمینه: buyerCo در پیشنهادات/پرونده‌ها تاریخی‌اً نام انگلیسی (coEn) را نگه می‌دارد
   → فهرست پیشنهادات/فاکتورها/پرونده‌های فروش فقط انگلیسی بود.
   ۱) هلپرهای مشترک در index.html (FaByCd/FaByEn/NamePair/CellHtml)
   ۲) اعمال در: فهرست پیشنهادات + پنل فاکتور رسمی + کارتابل ارجاع فاکتور + پرونده‌های فروش
   ۳) جستجو در فهرست‌ها با نام فارسی هم */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var ih = read('crm/index.html');
var offers = read('crm/offers.js');
var inv = read('crm/official-invoice-v2.js');
var sf = read('crm/salesfiles.js');
var rb = read('crm/rbac.js');

/* ═══ ۱) هلپرهای مشترک ═══ */
T('HLP: ptfCustFaByCd نام فارسی زنده از cd (co/name)', ih.indexOf('function ptfCustFaByCd') > -1 && /ptfCustFaByCd\(cd\)[\s\S]{0,200}c\.co \|\| c\.name/.test(ih));
T('HLP: ptfCustFaByEn تطبیق coEn یا co بدون حساسیت حروف', ih.indexOf('function ptfCustFaByEn') > -1 && ih.indexOf('toLowerCase(); if (!k) return') > -1);
T('HLP: ptfCustNamePair اولویت دادهٔ زنده از cd و fallback تطبیق نام', /ptfCustNamePair\(cd, storedName\)[\s\S]{0,400}ptfCustFaByEn\(en\)/.test(ih));
T('HLP: ptfCustCellHtml فارسی بولد + انگلیسی کوچک ltr + cd (هم‌شکل فهرست مشتریان)', /ptfCustCellHtml\(fa, en, cd\)[\s\S]{0,300}font-size:10\.5px;color:#64748b" dir="ltr"[\s\S]{0,120}color:#94a3b8/.test(ih));
T('HLP: تکرار نمی‌شود اگر en === fa', ih.indexOf('if (e2 && e2 !== fa)') > -1);

/* ═══ ۲) اعمال در فهرست‌ها ═══ */
T('OFF: ستون خریدار از NamePair/CellHtml (فارسی + انگلیسی زیر هم + cd)', offers.indexOf('ptfCustNamePair(o.buyerCd, o.buyerCo)') > -1 && offers.indexOf('ptfCustCellHtml(p.fa, p.en, o.buyerCd)') > -1);
T('OFF: نمایش انگلیسیِ تنهاِ قدیمی حذف شد', offers.indexOf("escP(o.buyerCo || '-') + (function(){ var en") === -1);
T('INV: پنل فاکتور رسمی — نام دوگانه در سرتیتر هر پیشنهاد', inv.indexOf('ptfCustNamePair(o.buyerCd,o.buyerCo)') > -1 && inv.indexOf("dir=\"ltr\">'+esc(p.en)+'</div>'") > -1 && inv.indexOf('esc(o.buyerCo||' + String.fromCharCode(39,39) + ')') === -1);
T('RB: کارتابل ارجاع فاکتور (rbac) — نام دوگانه', rb.indexOf('ptfCustNamePair(o.buyerCd, o.buyerCo)') > -1 && rb.indexOf("escP(o.buyerCo || '-') + (oEn ?") === -1);
T('SF: پرونده‌های فروش — نام دوگانه بدون cd (تطبیق نام)', sf.indexOf("ptfCustNamePair('', r.buyerCo)") > -1 && sf.indexOf('ptfCustCellHtml(p.fa, p.en, \'\')') > -1);

/* ═══ ۳) جستجو با نام فارسی ═══ */
T('SRCH: پیشنهادات — نام فارسی در رشتهٔ جستجو', offers.indexOf("ptfCustFaByCd==='function'&&o.buyerCd)?ptfCustFaByCd(o.buyerCd):''") > -1);
T('SRCH: پرونده‌ها — نام فارسی در رشتهٔ جستجو', sf.indexOf('ptfCustFaByEn(r.buyerCo)') > -1);

/* ═══ بهداشت ═══ */
T('HYG: fallback امن اگر هلپرها نباشند (هر چهار نقطه)', offers.indexOf('{ fa: o.buyerCo ||') > -1 && sf.indexOf("{ fa: r.buyerCo || '-'") > -1 && inv.indexOf("{fa:o.buyerCo||''") > -1);
T('HYG: بلوک‌های جدید بدون LS مستقیم (A10)', [offers, inv, sf, rb].every(function (t) {
  var i = 0, clean = true;
  while ((i = t.indexOf('ptfCustNamePair', i + 1)) > -1) { if (/localStorage\s*\./.test(t.slice(i, i + 400))) clean = false; }
  return clean;
}));

console.log('=== tester563: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
