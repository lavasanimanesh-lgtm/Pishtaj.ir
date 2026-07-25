/* tester62 — v14.2 (اسپرینت الف «سند پیشنهاد بی‌نقص»: US-356/357/358/359/364/366) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-359: توضیح قالب‌ها — جهت واقعی چاپ');
T('هر ۵ قالب «A4 افقی» توصیف شده‌اند', (op.match(/A4 افقی/g) || []).length === 5);
T('هیچ توضیح «A4 عمودی» باقی نمانده', op.indexOf('A4 عمودی') === -1);
T('CSS چاپ دست نخورده — هر ۵ قالب landscape', (op.match(/size:A4 landscape/g) || []).length === 5);
T('عنوان classic دیگر «افقی» گمراه‌کننده ندارد', op.indexOf("lb: '📊 کلاسیک'") > -1);

SECTION('US-356: عرض ستون و فونت آداپتیو');
T('تابع docColgroup (عرض از محتوای واقعی)', op.indexOf('function docColgroup(') > -1);
T('وزن‌دهی جذری طول محتوا', op.indexOf('Math.sqrt(Math.min(Math.max(mx, 4), 70))') > -1);
T('desc چندبخشی: طول موثر = بلندترین بخش', op.indexOf("split(';').forEach") > -1);
T('کف عرض ستون ۵٪', op.indexOf('Math.max(5, Math.round(') > -1);
T('جدول سند table-layout:fixed + colgroup', op.indexOf('table-layout:fixed">\' + docColgroup(o, cols, ec, isCO)') > -1);
T('ستون‌های extraCols در محاسبه هستند', op.indexOf("stats.push({ k: 'x:' + c") > -1);
T('فونت متراکم‌آگاه ptfDocFsAdjust', op.indexOf('window.ptfDocFsAdjust = function (o, fs)') > -1);
T('کف خوانایی فونت ۷pt', op.indexOf('return Math.max(7, fs);') > -1);
T('اعمال تعدیل بعد از پله ستونی', op.indexOf('fs = ptfDocFsAdjust(o, fs);') > -1);
T('شکست کلمه امن سلول‌ها', op.indexOf('word-wrap:break-word;overflow-wrap:break-word') > -1);

SECTION('US-357: تلفن اسناد چاپی EN — لاتین + کد ایران');
T('بلوک To (Client) قالب‌های pro با ptfPhoneNorm(print)', op.indexOf('ptfPhoneNorm(o.buyerTel,') > -1 && op.indexOf('To (Client)') > -1);
T('سند legacy (offerPrintObj) هم پوشش دارد', of.indexOf('function offerPrintObj(o)') > -1 && of.indexOf('ptfPhoneNorm(o.buyerTel,') > -1);
T('داده رکورد تغییر نمی‌کند — تبدیل فقط هنگام رندر', op.indexOf("o.buyerTel = ptfPhoneNorm") === -1 && of.indexOf("o.buyerTel = ptfPhoneNorm") === -1);
T('fallback بدون phonefmt (typeof check)', op.indexOf("typeof ptfPhoneNorm === 'function'") > -1);

SECTION('US-358: فاصله امن از حاشیه');
T('هیچ فوتری نزدیک‌تر از 8mm به لبه پایین نیست', !/\.ftr\{[^}]*bottom:[0-7](\.\d+)?mm/.test(op));
T('فوترها از لبه چپ/راست هم فاصله دارند (left/right:0 حذف)', !/\.ftr\{[^}]*left:0;right:0/.test(op));
T('classic: حاشیه پایین صفحه ≥18mm', op.indexOf('margin:10mm 12mm 18mm 12mm') > -1);

SECTION('US-364: بندهای شرایط و ضوابط — رندر و قالب');
T('helper offEl (چند مودال هم‌شناسه → آخرین نمونه قابل‌مشاهده)', of.indexOf('window.offEl = function (id)') > -1);
T('offEl مودال‌های مینیمایز (display:none) را نادیده می‌گیرد', of.indexOf("mb.style.display !== 'none'") > -1);
T('offRenderTerms از offEl استفاده می‌کند', /offRenderTerms\(\) \{\n  var el = \(typeof offEl === 'function'\) \? offEl\('offTermsWrap'\)/.test(of));
T('offAddTermLib/offSyncTcLib هم offEl', of.indexOf("offEl('offTcLib')") > -1 && of.split("offEl('offTcLib')").length >= 3);
T('رندر اقلام offerlock با offEl', ol.indexOf("offEl('offItemsWrap')") > -1);
T('رندر اقلام offers-pro با offEl', op.indexOf("offEl('offItemsWrap')") > -1);
T('offerForm فرم‌های باز قبلی را می‌بندد (ریشه تکرار ID)', of.indexOf("mb.querySelector('[id=\"offItemsWrap\"]')") > -1);
T('fallback بدون offEl در offers.js (استقلال تسترهای قدیمی)', of.indexOf("(typeof offEl === 'function') ? offEl('offTcLib') : document.getElementById('offTcLib')") > -1);
T('قالب چاپی: docTermsHtml سر جای خود در قالب‌های pro', op.indexOf('function docTermsHtml(o)') > -1 && op.indexOf('docTermsHtml(o)') > -1);

SECTION('US-366: دکمه ➕ ابتدای ردیف اقلام');
T('سلول عملیات به ابتدای ردیف منتقل شد', ol.indexOf("US-366: دکمه ➕ افزودن ردیف در ابتدای ردیف") > -1);
T('ترتیب: td عملیات قبل از td شماره ردیف', /rows \+= '<tr><td style="white-space:nowrap" data-noix>'/.test(ol));
T('هدر: ستون عملیات اول جدول', ol.indexOf('<th style="width:52px" data-noix>➕</th><th style="width:30px">#</th>') > -1);
T('سلول انتهایی قدیمی حذف شد', ol.indexOf("'<td style=\"white-space:nowrap\">' + (i === 0 ? '<button type=\"button\" onclick=\"offAddItem()\"") === -1);
T('GRAND TOTAL colspan با ستون‌های سود هم‌راستاست', ol.indexOf("colspan=\"' + (4 + cols.length + ec.length)") > -1 || (ol.indexOf('canMargin ? 2 : 0') > -1 && ol.indexOf('GRAND TOTAL') > -1));
T('درج هوشمند US-310 دست نخورده', of.indexOf('offSmartInsert') > -1);

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — فقط «همان یا جدیدتر از 14.2» */
T('cache-bust سه فایل پیشنهاد (>=14.2)', ['offers.js', 'offers-pro.js', 'offerlock.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 2));
}));

DONE('tester62-v142');
