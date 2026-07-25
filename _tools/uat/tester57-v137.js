/* tester57 — v13.7 (US-335..338): قیمت مرجع، حذف قیمت‌های خرید از منو، مودال موبایل، یکسان‌سازی شماره‌ها */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rf = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var pf = fs.readFileSync(path.join(BASE, 'phonefmt.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-335: قیمت مرجع کالا از درخواست تامین');
T('هوک بعد از ثبت پاسخ قیمت', rf.indexOf('ptfUpdateRefPrices(r)') > -1);
T('میانگین چند پاسخ مبنا است', rf.indexOf('replies.reduce') > -1 && rf.indexOf('/ replies.length') > -1);
T('قید تاریخ + منبع روی کالا', rf.indexOf('p.refPriceAt = faDate()') > -1 && rf.indexOf("refPriceSrc = 'درخواست تامین '") > -1);
T('نمایش تاریخ مرجع در جدول کالاها', idx.indexOf('مرجع: ') > -1 && idx.indexOf('p.refPriceAt') > -1);

SECTION('US-336: حذف «قیمت‌های خرید» از منو (مصوبه تیم)');
T('دکمه سایدبار حذف شد', idx.indexOf('<span class="lb">قیمت‌های خرید</span>') === -1);
T('از گروه تامین آکاردئون حذف شد', sh.indexOf("items: ['sup', 'rfqs'] }") > -1 && sh.indexOf("'buyq']") === -1);
T('داده و توابع buycompare محفوظ (بدون حذف)', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('ptf_crm_buycmp') > -1);
T('روتینگ goPanel buyq هنوز کار می‌کند (لینک‌های قدیمی)', fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8').indexOf("id === 'buyq'") > -1);

SECTION('US-337: یکسان‌سازی دکمه‌های مودال موبایل');
T('فضای بالای مودال برای دکمه‌های مک+چیپ', idx.indexOf('padding-top: 44px !important') > -1);
T('دستیار مودال بدون تداخل (v20.0 BUG-033: بیضی حذف — نقطه هم‌ردیف)', idx.indexOf('.mx-ai {') === -1 && fs.readFileSync(path.join(BASE,'modalx.js'),'utf-8').indexOf('mx-dot a') > -1);
T('فرم دوستونه → تک‌ستون موبایل', idx.indexOf('.md .fr { grid-template-columns: 1fr !important; }') > -1);
T('تیتر مودال زیر دکمه‌ها نمی‌رود', /padding-left:\s*\d+px\s*!important/.test(idx) && idx.indexOf('.md h3') > -1);
T('دکمه‌های پایانی مودال تمام‌عرض و زیر هم', idx.indexOf('flex-direction: column-reverse !important') > -1);

SECTION('US-338: یکسان‌سازی شماره تماس‌ها');
T('ماژول phonefmt ثبت شده', idx.indexOf('phonefmt.js') > -1 && sw.indexOf('./phonefmt.js') > -1);
T('داخلی: خروجی ارقام فارسی + قالب ملی', pf.indexOf('toFaDigits(keep)') > -1 && pf.indexOf("keep = '0' + keep.slice(3)") > -1);
T('خارجی: قالب بین‌المللی لاتین +…', pf.indexOf("keep = '+' + keep.slice(2)") > -1);
T('تبدیل خودکار مغایرت‌ها (فارسی↔انگلیسی)', pf.indexOf('ptfPhoneNorm') > -1 && pf.indexOf('toEnDigits') > -1);
T('هوک ذخیره مشتری = همیشه فارسی', pf.indexOf("ptfNormalizeEntityPhones(rec, 'fa')") > -1 && pf.indexOf('_pfCustHooked') > -1);
T('هوک تامین‌کننده: داخلی/خارجی از origin', pf.indexOf("(rec.origin === 'خارجی') ? 'en' : 'fa'") > -1);
T('خارجی: کل مشخصات لاتین‌سازی', pf.indexOf("['co', 'nm', 'ca', 'coWeb', 'coAddr']") > -1 && pf.indexOf('ptfLatinize') > -1);
T('دفترچه تلفن پیامکی نرمال می‌شود', pf.indexOf('ptf_crm_smsbook') > -1);
T('مهاجرت یک‌باره نسخه‌دار', pf.indexOf('ptf_phonefmt_mig') > -1);
// تست رفتاری نرمال‌ساز
(function () {
  var g = { window: {} };
  var fn = new Function('window', 'getData', 'setData', 'localStorage', pf + '; return window;');
  var w = fn(g.window, function () { return []; }, function () {}, { getItem: function () { return '1'; }, setItem: function () {} });
  T('رفتاری: +98 → ۰۹…فارسی', w.ptfPhoneNorm('+989123456789', 'fa') === '۰۹۱۲۳۴۵۶۷۸۹');
  T('رفتاری: 00 → + لاتین', w.ptfPhoneNorm('00905321234567', 'en').replace(/\s/g, '') === '+905321234567');
  T('رفتاری: ارقام فارسی → لاتین بین‌المللی', w.ptfPhoneNorm('۰۹۱۲۸۳۴۰۸۵۲', 'en').replace(/\s/g, '') === '+989128340852');
})();
DONE('tester57-v137');
