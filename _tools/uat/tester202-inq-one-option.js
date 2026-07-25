/* tester202 — v31.7.27 (US-INQ-ONE-OPTION: یک گزینه per درخواست در کشویی + شماره کارفرما در چاپ)
 * دستور کارفرما: کشویی «شماره درخواست کارفرما» در فرم پیشنهاد برای هر درخواست دو گزینه
 * نشان می‌داد (کد RFQ سیستم + شماره کارفرما). باید فقط کد RFQ ما انتخاب‌پذیر باشد،
 * ولی در قالب چاپی نهایی (Ref Inquiry / Request No) «شماره درخواست کارفرما» بنشیند. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var dd = fs.readFileSync(path.join(ROOT, 'crm/dedup.js'), 'utf-8');
var op = fs.readFileSync(path.join(ROOT, 'crm/offers-pro.js'), 'utf-8');
var of = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('ptfKnownInqList فقط کد سیستمی را add می‌کند (نه دوبار)', dd.indexOf('US-INQ-ONE-OPTION') > -1 && !/add\(r\.inqNo, \(r\.inqNo \|\| ''\)/.test(dd));
T('لیبل گزینه شامل شماره کارفرما برای شفافیت', dd.indexOf('⇐ شماره کارفرما:') > -1);
T('helper چاپ ptfInqClientNo تعریف و export شده', dd.indexOf('function ptfInqClientNo') > -1 && dd.indexOf('window.ptfInqClientNo = ptfInqClientNo') > -1);
T('قالب چاپ فعال (offers-pro): Ref (Inquiry) از ptfInqClientNo', /Ref \(Inquiry\):<\/b> ' \+ escP\(\(typeof ptfInqClientNo === 'function'/.test(op));
T('قالب چاپ فعال: Request No هم از ptfInqClientNo', /Request No: ' \+ escP\(\(typeof ptfInqClientNo === 'function'/.test(op));
T('قالب‌های fallback قدیمی (offers.js) هم اصلاح شدند', (of.match(/Request No:<\/b> ' \+ escP\(\(typeof ptfInqClientNo === 'function'/g) || []).length === 2);
T('اقلام ایمپورت‌شده بدون RFQ همچنان در لیست هستند (بدون دوگانه)', /_hasRfq\[r\.inqNo\]\) add\(r\.inqNo, r\.inqNo \+ ' \(اقلام ایمپورت‌شده\)'/.test(dd));

SECTION('رفتاری: کشویی و چاپ');
global.window = global;
global.escP = function (s) { return String(s == null ? '' : s); };
setData('ptf_crm_rfqs', [
  { cd: 'RFQ-1244', inqNo: 'REQ-FOOLAD-9931', co: 'فولاد مشیز' },   // درخواست با شماره کارفرما
  { cd: 'RFQ-1245', co: 'شرکت بدون شماره کارفرما' },                  // بدون inqNo
  { inqNo: 'OLD-777', co: 'رکورد خیلی قدیمی بدون cd' }                // legacy
]);
setData('ptf_crm_inqitems', [
  { inqNo: 'RFQ-1244' },            // آیتم‌های همان RFQ — نباید گزینه دوم بسازد
  { inqNo: 'IMPORT-555' }           // ایمپورت مستقل — باید بماند
]);
eval(dd.match(/function ptfKnownInqList\(\) \{[\s\S]*?\n\}/)[0]);
eval(dd.match(/function ptfInqClientNo\(v\) \{[\s\S]*?\n\}/)[0]);
var list = ptfKnownInqList();
var vals = list.map(function (o) { return o.v; });
T('هر درخواست فقط یک گزینه: RFQ-1244 هست و REQ-FOOLAD-9931 گزینه جدا نیست', vals.indexOf('RFQ-1244') > -1 && vals.indexOf('REQ-FOOLAD-9931') === -1);
T('لیبل RFQ-1244 شماره کارفرما را نشان می‌دهد', list.filter(function (o) { return o.v === 'RFQ-1244'; })[0].lb.indexOf('REQ-FOOLAD-9931') > -1);
T('درخواست بدون شماره کارفرما: یک گزینه ساده', vals.indexOf('RFQ-1245') > -1 && list.filter(function (o) { return o.v === 'RFQ-1245'; })[0].lb.indexOf('⇐') === -1);
T('legacy بدون cd و ایمپورت مستقل حفظ شدند', vals.indexOf('OLD-777') > -1 && vals.indexOf('IMPORT-555') > -1);
T('آیتم‌های ایمپورتی RFQ موجود گزینه تکراری نساختند', vals.filter(function (v) { return v === 'RFQ-1244'; }).length === 1);
// چاپ: با انتخاب RFQ سیستمی، شماره کارفرما می‌نشیند
T('چاپ: ptfInqClientNo(RFQ-1244) = شماره کارفرما', ptfInqClientNo('RFQ-1244') === 'REQ-FOOLAD-9931');
T('چاپ: درخواست بدون شماره کارفرما → همان کد سیستمی (fallback امن)', ptfInqClientNo('RFQ-1245') === 'RFQ-1245');
T('چاپ: ورودی ناشناخته دست‌نخورده برمی‌گردد (اسناد قدیمی نمی‌شکنند)', ptfInqClientNo('XYZ-1') === 'XYZ-1' && ptfInqClientNo('') === '');

SECTION('رگرسیون: زنجیره داخلی سیستم با کد سیستمی سالم می‌ماند');
T('ptfInqAliases (US-386) دست‌نخورده — تطبیق TO/CO با هر دو شناسه', of.indexOf('window.ptfInqAliases') > -1);
T('o.inqNo در رکورد همچنان مقدار انتخابی کشویی است (تغییر فقط در لایه چاپ)', of.indexOf("o.inqNo = inqEl ? inqEl.value.trim()") > -1);

DONE('tester202-inq-one-option');
