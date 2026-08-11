/* tester316 — v34.0.21-alpha (فاز ۱۸: مدیریت اسناد تنخواه/فاکتور + رفع پنجرهٔ همپوشان حذف فاکتور)
   پوشش: دکمهٔ «📎 اسناد» در تنخواه؛ نمایش/حذف/افزودن سند در ویرایش فاکتور (slInvoiceEdit)؛
   رفع مودال همپوشان هنگام حذف/ابطال فاکتور (حذف slLedgerDlg قبلی). */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var petty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(vjson.crm_version));

SECTION('تنخواه: مدیریت اسناد');
T('دکمهٔ «📎 اسناد» در اکشن‌های تنخواه', petty.indexOf('📎 اسناد') > -1 && petty.indexOf('ptfPettyFilesUi') > -1);
T('ptfPettyFilesUi تعریف شده (مودال مشاهده/افزودن)', petty.indexOf('window.ptfPettyFilesUi = function') > -1);
T('pettyRemoveFile تعریف شده (حذف سند)', petty.indexOf('window.pettyRemoveFile = function') > -1 && petty.indexOf('این سند از تنخواه و فضای ابری حذف شود؟') > -1);

SECTION('فاکتور خرید: مدیریت اسناد در ویرایش');
T('slInvoiceEdit بخش اسناد (filesBox) دارد', sf.indexOf('slInvEditFilesUp') > -1 && sf.indexOf('اسناد فاکتور') > -1);
T('slInvoiceEdit امکان افزودن سند جدید دارد', sf.indexOf('slInvEditNewFiles') > -1 && sf.indexOf('attachUploadWidget') > -1);
T('slInvoiceRemoveFile تعریف شده و از ویرایش پشتیبانی می‌کند', sf.indexOf('window.slInvoiceRemoveFile = function') > -1 && sf.indexOf('_slInvEditCd === cd') > -1);

SECTION('رفع پنجرهٔ همپوشان حذف فاکتور');
T('slOpenLedger مودال قبلی slLedgerDlg را حذف می‌کند', sf.indexOf("getElementById('slLedgerDlg')") > -1 && sf.indexOf('_oldLg.remove') > -1);

DONE('tester316-v34.0.21-alpha');
