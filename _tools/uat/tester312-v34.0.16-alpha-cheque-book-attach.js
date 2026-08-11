/* tester312 — v34.0.16-alpha (فاز ۱۳: دسته چک + قفل صیاد + مشاهده/حذف سند + ویرایش کامل چک)
   پوشش:
     ۱) دسته چک: ثبت (بانک/حساب/مالک/شعبه/سری/شماره از..تا) + پوشش شماره
     ۲) قفل شماره صیادی: ثبت مجدد صیادِ رزروشده ممنوع است
     ۳) مشاهده/حذف سند: attachUploadWidget دکمهٔ مشاهده/حذف دارد؛ slInvoiceRemoveFile موجود
     ۴) ویرایش کامل چک (بانک/شعبه/سری/مالک/حساب + افزودن سند) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cm = fs.readFileSync(path.join(BASE, 'cheque-module.js'), 'utf-8');
var cp = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(?:\.\d+){2}(?:-[A-Za-z0-9.-]+)?$/.test(vjson.crm_version));

SECTION('دسته چک (Cheque Book)');
T('ptfChequeBooks/ptfChequeBookSave تعریف شده', cm.indexOf('window.ptfChequeBooks = function') > -1 && cm.indexOf('window.ptfChequeBookSave = function') > -1);
T('ptfChequeBookCoversNo (پوشش شماره از..تا) تعریف شده', cm.indexOf('window.ptfChequeBookCoversNo = function') > -1);
T('دکمهٔ «دسته چک» در پنل چک', cp.indexOf('ptfChequeBookUi') > -1 && cp.indexOf('📒 دسته چک') > -1);
T('فرم دسته چک: بانک/حساب/مالک/شعبه/سری/از..تا', cp.indexOf('cbBank') > -1 && cp.indexOf('cbAcc') > -1 && cp.indexOf('cbOwner') > -1 && cp.indexOf('cbFrom') > -1 && cp.indexOf('cbTo') > -1);
T('handler رابط دسته چک، تابع ذخیرهٔ ماژول را overwrite نمی‌کند', cp.indexOf('window.ptfChequeBookSaveUi = function') > -1 && cp.indexOf('onclick=\"ptfChequeBookSaveUi(') > -1 && cp.indexOf('window.ptfChequeBookSave(book)') > -1 && cp.indexOf('window.ptfChequeBookSave = function (cd)') === -1);

SECTION('ضمانت شرکت در مناقصه');
T('نوع bid در فرم ثبت چک موجود و مستقل از پرونده است', cp.indexOf('value=\"bid\">ضمانت شرکت در مناقصه') > -1 && cp.indexOf("var needDeal = g && gt !== 'bid'") > -1);
T('ثبت ضمانت bid بدون پرونده فروش مجاز است', cp.indexOf("if (guarType !== 'bid' && !dealCd)") > -1 && cp.indexOf("if (rec.guarType !== 'bid' && !dealCd)") > -1);

SECTION('قفل شماره صیادی');
T('ptfChequeReserveSayad/ptfChequeSayadReserved تعریف شده', cm.indexOf('window.ptfChequeReserveSayad') > -1 && cm.indexOf('window.ptfChequeSayadReserved') > -1);
T('ptfChequeCreate صیاد رزروشده را قفل می‌کند (sayad_locked)', cm.indexOf("why: 'sayad_locked'") > -1);

SECTION('مشاهده/حذف سند (سرتاسری)');
T('attachUploadWidget دکمهٔ مشاهده (👁) دارد', st.indexOf('👁 مشاهده') > -1 && st.indexOf('openStoredFile') > -1);
T('attachUploadWidget دکمهٔ حذف (✕) دارد', st.indexOf('✕ حذف') > -1 && st.indexOf('ptfRemoveJustUploaded') > -1);
T('ptfRemoveJustUploaded تعریف شده', st.indexOf('window.ptfRemoveJustUploaded = function') > -1);
T('حذف تأییدشدهٔ سند از فاکتور خرید (slInvoiceRemoveFile)', sf.indexOf('window.slInvoiceRemoveFile = function') > -1 && sf.indexOf('این سند از فاکتور و فضای ابری حذف شود؟') > -1 && sf.indexOf('ptfDeleteStoredFile') > -1);

SECTION('ویرایش کامل چک + افزودن سند');
T('مودال ویرایش چک فیلدهای بانک/شعبه/سری/مالک/حساب دارد', cp.indexOf('chE_Branch') > -1 && cp.indexOf('chE_Series') > -1 && cp.indexOf('chE_Owner') > -1 && cp.indexOf('chE_Acc') > -1);
T('مودال ویرایش چک بخش اسناد/کپی دارد', cp.indexOf('chE_Files') > -1 && cp.indexOf('chE_Up') > -1);
T('ptfChEditRemoveFile تعریف شده', cp.indexOf('window.ptfChEditRemoveFile = function') > -1);

SECTION('رفتار: قفل صیاد + دسته چک');
(function () {
  global.window = global;
  global.curRole = function () { return 'admin'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.ptfJToISO = function () { return '2026-08-21'; };
  global.ptfISOToJ = function () { return '1405/06/01'; };
  global.genCode = function (p) { return p + '-' + Math.floor(Math.random() * 100000); };
  global.curSession = function () { return { user: 'u1', name: 'حامد' }; };
  global.ptfToast = function () {};
  eval.call(global, cm);
  /* دسته چک */
  window.ptfChequeBookSave({ cd: 'BOOK-1', bookName: 'دسته الف', bank: 'ملی', branch: 'تهران', series: 'A', accountNo: '123', owner: 'شرکت', fromNo: '100', toNo: '120' });
  var books = window.ptfChequeBooks();
  T('دسته چک ثبت شد و شماره 105 را پوشش می‌دهد', books.length === 1 && window.ptfChequeBookCoversNo(books[0], '105') === true);
  /* قفل صیاد */
  window.ptfChequeCreate('issued', { no: '105', sayad: '105', amt: 1000, toWhom: 'تامین', dueISO: '2026-08-21' });
  var r2 = window.ptfChequeCreate('issued', { no: '105', sayad: '105', amt: 2000, toWhom: 'تامین' });
  T('ثبت مجدد صیاد رزروشده ممنوع است (sayad_locked)', r2 && r2.why === 'sayad_locked');
})();

DONE('tester312-v34.0.16-alpha');
