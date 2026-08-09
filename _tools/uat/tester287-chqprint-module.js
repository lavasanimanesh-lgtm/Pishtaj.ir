/* tester287 — v33.18.0 (CHQ-PRINT): ماژول مستقل «چاپ چک فیزیکی» زیر گروه کالا و اسناد
 * مصوب کارفرما ۱۴۰۵/۰۸/۱۱:
 *  - فقط چاپ (تکی/چندتایی)، بدون هیچ ذخیره‌سازی و بدون کد صیادی.
 *  - تاریخ به حروف + ذی‌نفع + کد/شناسه ملی + مبلغ (عدد قرمز در بالا + به حروف).
 *  - تنظیم فونت چاپی فارسی (نستعلیق/بی‌نازنین/بی‌یاقوت/…) و اندازه و مختصات هر بخش.
 *  - باکس چک از پنل شخصی (یادآورها) کاملاً حذف؛ چاپ برگه از هاب مالی حذف.
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var prt = fs.readFileSync(path.join(BASE, 'cheque-print.js'), 'utf-8');
var chq = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var panel = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var rbac = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var perms = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

/* ---------- استاب‌های محیط ---------- */
global.alert = function (m) { global._alerts = global._alerts || []; global._alerts.push(String(m)); };
global.ptfToast = function () {};
global.ptfPreviewPrintableDoc = function (title, html, name) { global._lastPrint = { title: title, html: html, name: name }; };
global.ptfNum = function (v) {
  var s = String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^0-9.-]/g, '');
  return +s || 0;
};
global.ptfJToISO = function (s) {
  s = String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  return m ? String(+m[1] + 621) + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0') : '';
};
global.ptfISOToJ = function (iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? String(+m[1] - 621) + '/' + String(+m[2]).padStart(2, '0') + '/' + String(+m[3]).padStart(2, '0') : iso || '';
};
/* مینی‌مبلغ به حروف برای تست (فقط تا ۹۹۹۹ کافی است) */
var W1 = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
var W10 = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
var W20 = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
var W100 = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
function miniW3(n) {
  var out = [];
  if (n >= 100) { out.push(W100[Math.floor(n / 100)]); n %= 100; }
  if (n >= 20) { out.push(W20[Math.floor(n / 10)]); n %= 10; }
  if (n >= 10) { out.push(W10[n - 10]); n = 0; }
  if (n > 0) out.push(W1[n]);
  return out.join(' و ');
}
global.ptfNumWordsFa = function (n) {
  n = Math.floor(Math.abs(+n || 0));
  if (!n) return 'صفر';
  var parts = [], i = 0, scales = ['', 'هزار', 'میلیون', 'میلیارد'];
  while (n > 0 && i < scales.length) { var g = n % 1000; if (g) parts.unshift(miniW3(g) + (scales[i] ? ' ' + scales[i] : '')); n = Math.floor(n / 1000); i++; }
  return parts.join(' و ');
};

/* ---------- DOM استاب ---------- */
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], checked: false,
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global._qsaMap = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function (sel) { return global._qsaMap[sel] || []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl({ insertAdjacentHTML: function () {} }),
  addEventListener: function () {}
};
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });
global.window = global;
global._lastPrint = null;

eval.call(global, prt);

SECTION('ساختار — ماژول چاپ چک فیزیکی زیر «کالا و اسناد»');
T('پنل در index.html ثبت شده (دکمه + عنوان + case + اسکریپت)', /goPanel\('chqprint',this\)/.test(idx) && idx.indexOf('chqprint:') > -1 && idx.indexOf("case 'chqprint':") > -1 && idx.indexOf('cheque-print.js') > -1);
T('گروه «کالا و اسناد» در shell.js شامل chqprint است', /items: \['prod', 'surplus', 'chqprint', 'prj', 'let', 'cnt'\]/.test(sh));
T('سرویس‌ورکر ماژول چاپ را پیش‌کش می‌کند', sw.indexOf('./cheque-print.js') > -1);
T('دسترسی نقش: حسابدار + نقش‌های ارشد (rbac) و پنل در ALL_PANELS (perms)', rbac.indexOf("'chqprint'") > -1 && perms.indexOf("id: 'chqprint'") > -1);
T('توابع پنل روی window موجودند', ['buildChequePrint', 'renderChequePrint', 'chqPrintTab', 'chqPrintAddRows', 'chqPrintPreview', 'chqPrintGo', 'chqPrintLayoutOpen', 'chqPrintLayoutSave', 'chqPrintLayoutTest', 'chqPrintHelp', 'ptfJDateWords', 'ptfNumToFaWords'].every(function (f) { return typeof global[f] === 'function'; }));

SECTION('پنل — فقط چاپ، بدون ذخیره‌سازی و بدون صیادی');
var html = buildChequePrint();
T('پنل قابل ساخت است و راهنمای «فقط چاپ» دارد', html.indexOf('فقط چاپ') > -1 && html.indexOf('هیچ رکوردی ذخیره نمی‌شود') > -1);
T('فرم تکی: تاریخ/ذی‌نفع/کد ملی/مبلغ/بابت', ['chqpD', 'chqpTo', 'chqpNid', 'chqpAmt', 'chqpNote'].every(function (k) { return html.indexOf('id="' + k + '"') > -1; }));
T('فرم چندتایی: جدول ردیف‌ها + دکمه افزودن ردیف', html.indexOf('chqpMBody') > -1 && html.indexOf('chqpM_d') > -1 && html.indexOf('chqpM_amt') > -1 && html.indexOf('chqPrintAddRows') > -1);
T('هیچ فیلد/ارجاع صیادی وجود ندارد', prt.indexOf('sayad') === -1 && html.indexOf('sayad') === -1);
T('دکمه‌های تنظیمات چاپ و راهنما', html.indexOf('chqPrintLayoutOpen') > -1 && html.indexOf('chqPrintHelp') > -1);

SECTION('مبلغ و تاریخ به حروف');
T('مبلغ به حروف با «و» و واحد ریال', (function () {
  var w = ptfNumToFaWords(1250000);
  return w === 'یک میلیون و دویست و پنجاه هزار ریال' && ptfNumToFaWords(0) === 'صفر ریال';
})());
T('تاریخ شمسی به حروف: روز ترتیبی + ماه + سال', (function () {
  var d = ptfJDateWords('1405/04/21');
  return d === 'بیست و یکم تیر ماه هزار و چهارصد و پنج';
})());
T('تاریخ به حروف: ارقام فارسی/عربی و سی‌ام اسفند', ptfJDateWords('۱۴۰۵/۱۲/۳۰') === 'سی‌ام اسفند ماه هزار و چهارصد و پنج' && ptfJDateWords('1405/01/01') === 'یکم فروردین ماه هزار و چهارصد و پنج');
T('تاریخ نامعتبر → رشته خالی', ptfJDateWords('') === '' && ptfJDateWords('1405/13/40') === '' && ptfJDateWords('1405/04') === '');

SECTION('جمع‌آوری و اعتبارسنجی (بدون ذخیره)');
_domGet['chqpD'] = makeEl({ value: '1405/04/21' });
_domGet['chqpTo'] = makeEl({ value: 'شرکت آلفا' });
_domGet['chqpNid'] = makeEl({ value: '۱۴۰۱۰۰۷۷۵۵۸' });
_domGet['chqpAmt'] = makeEl({ value: '1,250,000' });
_domGet['chqpNote'] = makeEl({ value: 'بابت پیش‌پرداخت' });
chqPrintPreview('single');
T('پیش‌نمایش تکی: پیش‌نمایش چاپی ساخته شد', !!(global._lastPrint && global._lastPrint.html));
T('رکورد: تاریخ/ذی‌نفع/کدملی (فارسی→لاتین)/مبلغ تبدیل شد', (function () {
  if (!global._lastPrint) return false;
  var h = global._lastPrint.html;
  return h.indexOf('شرکت آلفا') > -1 && h.indexOf('14010077558') > -1 && h.indexOf('۱٬۲۵۰٬۰۰۰') > -1;
})());
T('مبلغ بالا با «مبلغ: … ریال» و رنگ قرمز چاپ می‌شود', (function () {
  if (!global._lastPrint) return false;
  var h = global._lastPrint.html;
  return h.indexOf('مبلغ:') > -1 && h.indexOf("color:#b91c1c") > -1;
})());
T('تاریخ به حروف در HTML چاپ هست', (function () {
  return !!(global._lastPrint && global._lastPrint.html.indexOf('بیست و یکم تیر ماه هزار و چهارصد و پنج') > -1);
})());
T('اندازه صفحه 169×78mm و حاشیه صفر', (function () {
  return !!(global._lastPrint && global._lastPrint.html.indexOf('@page{size:169mm 78mm;margin:0}') > -1);
})());
global._alerts = [];
_domGet['chqpTo'] = makeEl({ value: '' });
_domGet['chqpAmt'] = makeEl({ value: '0' });
global._lastPrint = null;
chqPrintGo('single');
T('فرم ناقص: خطای واضح و بدون چاپ', global._alerts.length > 0 && !global._lastPrint && global._alerts[0].indexOf('ذی‌نفع') > -1);

SECTION('چاپ چندتایی');
global._qsaMap['#chqpMBody .chqpM_d'] = [makeEl({ value: '1405/04/21' }), makeEl({ value: '1405/05/01' }), makeEl({ value: '' })];
global._qsaMap['#chqpMBody .chqpM_to'] = [makeEl({ value: 'ذی‌نفع یک' }), makeEl({ value: 'ذی‌نفع دو' }), makeEl({ value: '' })];
global._qsaMap['#chqpMBody .chqpM_nid'] = [makeEl({ value: '' }), makeEl({ value: '10101010101' }), makeEl({ value: '' })];
global._qsaMap['#chqpMBody .chqpM_amt'] = [makeEl({ value: '100000' }), makeEl({ value: '200000' }), makeEl({ value: '' })];
global._qsaMap['#chqpMBody .chqpM_note'] = [makeEl({ value: '' }), makeEl({ value: 'بابت ب' }), makeEl({ value: '' })];
global._lastPrint = null;
chqPrintPreview('multi');
T('چندتایی: ردیف خالی نادیده و ۲ برگه چاپ شد', (function () {
  if (!global._lastPrint) return false;
  var h = global._lastPrint.html;
  return h.indexOf('ذی‌نفع یک') > -1 && h.indexOf('ذی‌نفع دو') > -1 && (h.match(/<section class="pg">/g) || []).length === 2;
})());
T('چندتایی: شناسه ملی ۱۱ رقمی چاپ می‌شود', !!(global._lastPrint && global._lastPrint.html.indexOf('10101010101') > -1));

SECTION('تنظیمات چاپ (کالیبره)');
T('چیدمان پیش‌فرض: مختصات/اندازه/رنگ هر بخش', /amtColor: '#b91c1c'/.test(prt) && /pageW: 169, pageH: 78/.test(prt) && /dateSize: 12/.test(prt) && /wordsSize: 10\.5/.test(prt) && /fontFam: ''/.test(prt));
/* v33.18.0: مبلغ دوم پایین-چپ + حالت گرافیکی درگ */
T('مبلغ اصلی دوم پایین-چپ (amt2) در چیدمان/HTML', /amt2Top: 48, amt2Left: 8/.test(prt) && prt.indexOf("'amt2Top', 'amt2Left', 'amt2Size'") > -1 && prt.indexOf('f-amt2') > -1);
T('حالت گرافیکی: درگ فیلدها روی برگه', prt.indexOf('chqGvRender') > -1 && prt.indexOf('chqGvStart') > -1 && prt.indexOf('chqGvMove') > -1 && prt.indexOf('chqpGv') > -1);
T('فونت‌های چاپی فارسی موجودند', prt.indexOf('IranNastaliq') > -1 && prt.indexOf('B Nazanin') > -1 && prt.indexOf('B Yagut') > -1 && prt.indexOf('Vazirmatn') > -1);
T('کالیبره: راهنما + چاپ آزمایشی با نمونه', prt.indexOf('چاپ آزمایشی (با راهنما)') > -1 && prt.indexOf('شرکت نمونه ذی‌نفع') > -1);
global._lastPrint = null;
chqPrintLayoutTest();
T('چاپ آزمایشی: حالت calib با خطوط راهنما', !!(global._lastPrint && global._lastPrint.html.indexOf('calib') > -1 && global._lastPrint.html.indexOf('guide') > -1));

SECTION('حذف از ماژول شخصی و هاب مالی');
T('باکس چک از پنل شخصی (یادآورها) کاملاً حذف شد', chq.indexOf('chqBox') === -1 && chq.indexOf('chBoxHtml') === -1 && chq.indexOf('hookReminders') === -1);
T('چاپ برگه از هاب مالی حذف شد', panel.indexOf('window.ptfChequePrint') === -1 && panel.indexOf('🖨 چاپ برگه') === -1 && panel.indexOf('ptfNumToFaWords') === -1);
T('ثبت چک همچنان فقط از هاب مالی (پیام راهنما حفظ شد)', chq.indexOf('ثبت چک فقط از «هاب مالی → تب چک‌ها»') > -1);
/* گیت همگامی نسخه: سه فایل index/sw/clear-cache باید روی یک نسخهٔ واحد باشند.
   v33.19.0: به‌جای نسخهٔ ثابتِ پین‌شده، VER از index.html خوانده می‌شود و دو فایل دیگر با آن الگو می‌شوند —
   تا در بامپ‌های بعدی فقط با نام‌همگامی واقعی (نه تغییر نسخه) شکست بخورد. */
var _verCur = (idx.match(/window\.PTF_CRM_RELEASE = '([^']+)'/) || idx.match(/window\.VER = '([^']+)'/) || [null, ''])[1];
T('نسخه در index/sw/clear-cache همگام است (' + _verCur + ')', !!_verCur && /^v\d+\./.test(_verCur) && sw.indexOf("var RELEASE = '" + _verCur + "'") > -1 && fs.readFileSync(path.join(BASE, 'clear-cache.html'), 'utf-8').indexOf("window.VER = '" + _verCur + "'") > -1);

DONE('tester287-chqprint-module');
