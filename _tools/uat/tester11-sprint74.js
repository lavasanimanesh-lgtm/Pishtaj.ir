/* TESTER-11 — اسپرینت ۷۴ (US-131): استعلام هوشمند تامین */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

var els = {};
function mkEl(id) {
  return els[id] = els[id] || {
    id: id, style: {}, innerHTML: '', textContent: '', value: '', checked: false, files: [],
    insertAdjacentHTML: function (p, h) { this.innerHTML += h; },
    click: function () {}, remove: function () {},
    classList: { add: function () {}, remove: function () {} }, setAttribute: function () {}, getAttribute: function () { return null; }
  };
}
global.document = {
  getElementById: function (id) { return mkEl(id); },
  querySelectorAll: function () { return [{ remove: function () {} }]; },
  createElement: function () { var e = mkEl('_c' + Math.random()); return e; },
  addEventListener: function () {}, head: { appendChild: function () {} }, body: { appendChild: function () {} }
};
global.window = global;
global.confirm = function () { return true; };
global.alert = function (m) { global._lastAlert = m; };
global.prompt = function () { return global._promptQ.shift(); };
global.addLog = function () {};
global.hideModal = function () {};
global.audit = function () {};
global.notify = function (o) { global._notifs = (global._notifs || []).concat([o]); return 'N'; };
global.curSession = function () { return { user: 'admin', name: 'ادمین' }; };
global.curRole = function () { return 'admin'; };
global.roleDef = function () { return { panels: '*' }; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.goPanel = function () {};
global.faDate = function () { return '1405/04/16'; };
global.setTimeout = function (f) { return 1; };
global.URL = { createObjectURL: function () { return 'blob:x'; } };
global.Blob = function (p) { this.p = p; };
global.FileReader = function () { this.readAsText = function () {}; this.readAsArrayBuffer = function () {}; };
global.XLSX = { read: function () { return { SheetNames: ['S'], Sheets: { S: {} } }; }, utils: { sheet_to_json: function () { return []; } } };
global.localStorage.clear();

var code = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
eval.call(global, code);

SECTION('AC1: استخراج اقلام از جدول (تشخیص ستون)');
var rows = [
  ['ردیف', 'شرح کالا', 'مشخصات فنی', 'تعداد', 'واحد'],
  ['1', 'Gate Valve 6"', 'API 600 Class 150', '4', 'عدد'],
  ['2', 'زانو ۹۰ درجه', 'A234 WPB SCH40', '20', 'عدد'],
  ['', '', '', '', '']
];
var items = rfqsParseRows(rows);
T('دو قلم استخراج شد (ردیف خالی رد شد)', items.length === 2);
T('شرح و مشخصات درست', items[0].name === 'Gate Valve 6"' && items[0].spec === 'API 600 Class 150');
T('تعداد عددی شد', items[0].qty === 4 && items[1].qty === 20);
// بدون هدر
var items2 = rfqsParseRows([['Pipe 2in A106', 'SCH80', '10', 'شاخه']]);
T('فایل بدون هدر هم خوانده می‌شود', items2.length === 1 && items2[0].qty === 10);
// هدر انگلیسی
var items3 = rfqsParseRows([['Item Description', 'Spec', 'Qty', 'Unit'], ['Flange WN 4in', 'A105 CL300', '8', 'PCS']]);
T('هدر انگلیسی تشخیص داده می‌شود', items3.length === 1 && items3[0].name === 'Flange WN 4in');

SECTION('AC1: PDF/عکس → مسیر بازبینی دستی');
T('پیام راهنمای PDF/عکس (بدون کلید LLM)', code.indexOf('نیاز به خواندن ماشینی') > -1 && code.indexOf('فرم سریع') > -1);
T('فایل مرجع آپلود و ذخیره می‌شود', code.indexOf("uploadFile(f, 'rfqsmart'") > -1);

SECTION('AC2: اکسل پاک — بدون داده کارفرما');
setData('ptf_crm_rfqsmart', [{ no: 'PTF-RFQS-1405-001', items: [{ name: 'Valve', spec: 'API', qty: 2, unit: 'No' }], targets: [], deadline: '48 ساعت' }]);
T('ستون‌های خروجی فقط ۵تای مجاز', code.indexOf("[['Row', 'Description', 'Technical Spec', 'Qty', 'Unit']]") > -1);
T('هیچ فیلد کارفرما در اکسل/فرم نیست', code.indexOf('buyerCo') === -1 && code.indexOf('customer') === -1);
T('یادآوری محرمانگی در UI', code.indexOf('هیچ نام یا اطلاعاتی از کارفرما درج نمی‌شود') > -1);

SECTION('AC3: پیشنهادگر تامین‌کننده');
setData('ptf_crm_suppliers', [
  { cd: 'S1', co: 'ولو گستر', ca: 'شیرآلات صنعتی (Valves)', brands: 'KITZ Neway gate valve', ph: '09121112233', email: 'v@x.ir' },
  { cd: 'S2', co: 'کابل پارس', ca: 'برق صنعتی', brands: 'کابل تابلو', ph: '09124445566', email: '' },
  { cd: 'S3', co: 'پایپ سنتر', ca: 'لوله و اتصالات پایپینگ', brands: 'Elbow Tenaris pipe', ph: '', email: 'p@x.ir' },
  { cd: 'S4', co: 'بی‌ربط', ca: '', brands: '', ph: '', email: '' }
]);
setData('ptf_crm_buyquotes', [
  { sup: 'ولو گستر', price: 100 }, { sup: 'ولو گستر', price: 200 }
]);
var ranked = rfqsScoreSuppliers([{ name: 'Gate Valve 6in', spec: 'API 600' }, { name: 'شیر پروانه‌ای', spec: '' }]);
T('تامین‌کننده شیرآلات اول است', ranked[0].co === 'ولو گستر');
T('امتیاز شامل سابقه قیمت‌دهی', ranked[0].why.indexOf('سابقه قیمت‌دهی') > -1);
T('تامین‌کننده بی‌ربط آخر است', ranked[ranked.length - 1].co === 'بی‌ربط');
T('دلیل امتیاز نمایش داده می‌شود', !!ranked[0].why);
T('۵ پیشنهاد برتر پیش‌تیک', code.indexOf('slice(0, 5)') > -1 && code.indexOf('قابل تغییر') > -1);

SECTION('AC4: فرم استعلام PDF');
T('شماره‌گذاری PTF-RFQS-{سال}', code.indexOf("'PTF-RFQS-' + yr") > -1);
T('سربرگ گرادیان رسمی', code.indexOf('#e87200,#ee8100,#ecb003,#ecc506') > -1);
T('جدول با ستون قیمت و زمان تحویل خالی', code.indexOf('placeholder="قیمت (') > -1 && code.indexOf('placeholder="تحویل (روز)"') > -1);
T('مهلت پاسخ روی فرم', code.indexOf('مهلت پاسخ:') > -1);
T('اطلاعات تماس PTF در فرم', code.indexOf('Info@pishtaj.ir') > -1 && code.indexOf('021-46087679') > -1);

SECTION('AC5: ارسال ایمیل/واتساپ');
T('لینک mailto با موضوع و متن', code.indexOf('mailto:') > -1 && code.indexOf('subject=') > -1);
T('لینک wa.me با متن آماده', code.indexOf('wa.me/98') > -1);
T('ثبت کانال ارسال (rfqsMarkSend)', code.indexOf('rfqsMarkSend') > -1);

SECTION('AC6: رهگیری و اتصال به قیمت‌های خرید');
global._promptQ = ['25000000', 'تحویل ۲ هفته'];
setData('ptf_crm_rfqsmart', [{ no: 'PTF-RFQS-1405-002', items: [{ name: 'Valve X', qty: 1, unit: 'No' }], targets: [{ cd: 'S1', co: 'ولو گستر', st: 'pending', sends: [] }], deadline: '48 ساعت' }]);
setData('ptf_crm_buyquotes', []);
global._notifs = [];
rfqsReply('PTF-RFQS-1405-002', 0);
var r2 = getData('ptf_crm_rfqsmart')[0];
T('وضعیت تامین‌کننده → پاسخ داد', r2.targets[0].st === 'replied');
T('قیمت پاسخ ثبت شد', r2.targets[0].reply.price === 25000000);
var bq = getData('ptf_crm_buyquotes');
T('پاسخ به ماژول قیمت‌های خرید متصل شد', bq.length === 1 && bq[0].sup === 'ولو گستر' && bq[0].ref === 'PTF-RFQS-1405-002');
T('اعلان به مدیران ارشد', global._notifs.some(function (n) { return n.title.indexOf('پاسخ استعلام') > -1; }));
// رد کردن
rfqsDecline('PTF-RFQS-1405-002', 0);
T('ثبت «رد کرد»', getData('ptf_crm_rfqsmart')[0].targets[0].st === 'declined');

SECTION('AC7: Human-in-the-loop');
T('هیچ ارسال خودکاری نیست (فقط لینک با کلیک کاربر)', code.indexOf('هیچ ارسالی خودکار نیست') > -1);
T('اقلام قابل ویرایش قبل از نهایی شدن', code.indexOf('rfqsRenderRows') > -1 && code.indexOf('_stU') > -1);
T('انتخاب تامین‌کننده قابل تغییر (چک‌باکس)', code.indexOf('_st._sel') > -1);

SECTION('یکپارچگی');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var shell = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
T('دکمه در سایدبار', idx.indexOf("goPanel('rfqs'") > -1);
T('در دسته تامین منو', /g-supply[^\]]*'rfqs'/.test(shell));
T('اسکریپت لود می‌شود', idx.indexOf('rfqsmart.js') > -1);
T('در بک‌آپ', fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8').indexOf('ptf_crm_rfqsmart') > -1);
T('کش SW نسخه‌دار', fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8').indexOf('ptf-crm-') > -1);
T('دسترسی: نقش با پنل sup', code.indexOf("panels.indexOf('sup') > -1") > -1);

DONE('TESTER-11 (Sprint74 RFQSmart)');
process.exit(RESULTS.fail ? 1 : 0);
