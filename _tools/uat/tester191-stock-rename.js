/* tester191 — v31.7.16 (US-STOCK-RENAME: پیاده‌سازی ماژول بک‌لاگ US-436 با نام «موجودی انبار»)
 * درخواست کارفرما: ماژول مازاد پروژه از بک‌لاگ فعال شود ولی با نام «موجودی انبار».
 * قید ایمنی: کلید داده ptf_crm_surplus و نام توابع دست‌نخورده — فقط نام‌گذاری UI + نوار آمار. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var su = fs.readFileSync(path.join(ROOT, 'crm/surplus.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(ROOT, 'crm/backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(ROOT, 'crm/golive.js'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');

SECTION('نام‌گذاری جدید UI — موجودی انبار');
T('سایدبار: موجودی انبار', idx.indexOf('موجودی انبار') > -1 && !/sb-i[^>]*surplus[\s\S]{0,80}مازاد پروژه/.test(idx));
T('عنوان پنل و breadcrumb', /surplus:'🏬 انبار'/.test(idx)); /* 2026-08-13: برچسب منو کوتاه‌تر شد */
T('هدر ماژول و دکمه ثبت', su.indexOf('🏬 موجودی انبار</h3>') > -1 && su.indexOf('+ ثبت موجودی') > -1); /* 2026-08-13: پسوند US-436 حذف شد */
T('دیالوگ ثبت با نام جدید', su.indexOf('🏬 ثبت موجودی انبار') > -1);
T('پیام‌ها/گاردها با نام جدید', su.indexOf('موجودی انباری ثبت نشده') > -1 && su.indexOf('فروش از موجودی انبار قابل نهایی‌سازی نیست') > -1);
T('audit ماژول با نام جدید', su.indexOf("audit('موجودی انبار'") > -1);
T('بج وضعیت فارسی', su.indexOf('✅ موجود') > -1 && su.indexOf('⏳ رزرو') > -1 && su.indexOf('💰 فروخته') > -1);
T('نوار آمار (ردیف/قابل استفاده/رزرو/فروخته)', su.indexOf('surplusStats') > -1 && su.indexOf('قابل استفاده') > -1);

SECTION('قید ایمنی: زیرساخت داده دست‌نخورده');
T('کلید داده همچنان ptf_crm_surplus', su.indexOf("var K='ptf_crm_surplus'") > -1);
T('کلید در sync/backup/API/golive whitelist مانده', sy.indexOf("'ptf_crm_surplus'") > -1 && bk.indexOf("'ptf_crm_surplus'") > -1 && api.indexOf("'ptf_crm_surplus'") > -1 && gl.indexOf("'ptf_crm_surplus'") > -1);
T('API عمومی توابع حفظ شده (بدون شکستن hookهای موجود)', ['ptfSurplusAdd','ptfSurplusReserve','ptfSurplusFinalizeSale','ptfSurplusWinGuard','ptfSurplusFinalizeForOffer','ptfSurplusReleaseForOffer','buildSurplus','renderSurplus'].every(function (f) { return su.indexOf(f) > -1; }));
T('route پنل همچنان surplus (بدون تغییر perms/rbac)', idx.indexOf("goPanel('surplus'") > -1 && idx.indexOf("case 'surplus'") > -1);

SECTION('رفتاری: چرخه کامل روی نام جدید');
global.window = global;
global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
global.faDateTime = function () { return '1405/04/28 12:00'; };
global.audit = function (m, msg) { global._audits = (global._audits || []).concat([m + '|' + msg]); };
global.ptfUnifiedCode = function (p) { return p + '-' + (9000 + ((global._seq = (global._seq || 0) + 1))); };
setData('ptf_crm_products', [{ cd: 'P-1', nm: 'گیج فشار' }]);
setData('ptf_crm_surplus', []);
// اجرای IIFE ماژول در محیط هارنس
eval(su);
var rec = ptfSurplusAdd('P-1', 10, 'انبار مرکزی', 'DEAL-1', 'n');
T('ثبت موجودی: ۱۰ عدد موجود', !!rec && ptfSurplusAvailableQty(rec) === 10 && ptfSurplusStatus(rec) === 'available');
T('audit با ماژول «موجودی انبار» ثبت شد', (global._audits || []).some(function (a) { return a.indexOf('موجودی انبار|') === 0; }));
var rv = ptfSurplusReserve(rec.cd, 4, 'CO-100');
var s1 = ptfSurplusAll().filter(function (x) { return x.cd === rec.cd; })[0];
T('رزرو ۴ عدد → قابل استفاده ۶', rv.ok && ptfSurplusAvailableQty(s1) === 6 && ptfSurplusStatus(s1) === 'reserved');
var fin = ptfSurplusFinalizeForOffer({ no: 'CO-100', items: [{ sourceSurplusCd: rec.cd, qty: 4 }] });
var s2 = ptfSurplusAll().filter(function (x) { return x.cd === rec.cd; })[0];
T('برد پیشنهاد → فروش نهایی ۴ عدد و رزرو صفر', fin.ok && (+s2.soldQty) === 4 && (+s2.reservedQty) === 0);
var fin2 = ptfSurplusFinalizeForOffer({ no: 'CO-100', items: [{ sourceSurplusCd: rec.cd, qty: 4 }] });
var s3 = ptfSurplusAll().filter(function (x) { return x.cd === rec.cd; })[0];
T('idempotent: برد تکراری دوباره کم نمی‌کند', fin2.ok && (+s3.soldQty) === 4);
ptfSurplusReserve(rec.cd, 2, 'CO-200');
var rel = ptfSurplusReleaseForOffer({ no: 'CO-200', items: [{ sourceSurplusCd: rec.cd, qty: 2 }] });
var s4 = ptfSurplusAll().filter(function (x) { return x.cd === rec.cd; })[0];
T('باخت پیشنهاد → آزادسازی رزرو', rel.ok && rel.qty === 2 && (+s4.reservedQty) === 0 && ptfSurplusAvailableQty(s4) === 6);

DONE('tester191-stock-rename');
