/* tester52 — v13.2 (US-322): بازطراحی پرونده‌های فروش + بایگانی */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var pj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ایجاد خودکار رکورد از پیشنهاد');
T('ماژول salesfiles ثبت شده', idx.indexOf('salesfiles.js') > -1 && sw.indexOf('./salesfiles.js') > -1);
T('ptfSF_ensure با شماره درخواست', sf.indexOf('window.ptfSF_ensure') > -1 && sf.indexOf('x.inqNo === inqNo') > -1);
T('هوک offerSave موجود (v16.8/US-404 مصوب: دیگر پرونده نمی‌سازد — فقط buyerCo)', sf.indexOf('_sfOfferHooked') > -1 && sf.indexOf('ثبت پیشنهاد دیگر پرونده نمی‌سازد') > -1); /* رفتار US-322 با مصوبه US-404 کارفرما جایگزین شد */
T('روتینگ rbac به نسخه جدید', rb.indexOf('(window.buildDeals || buildDeals)') > -1 && rb.indexOf('(window.renderDeals || renderDeals)') > -1);

SECTION('کشوی اسناد منضم');
T('کلیک = باز/بسته شدن کشو', sf.indexOf('sfToggle') > -1 && sf.indexOf('_sfOpen') > -1);
T('پیشنهادها زنده با آخرین رویژن', sf.indexOf('آخرین رویژن: Rev.') > -1);
T('نامه‌های مرتبط (SF: یا inqNo)', sf.indexOf("l.prjNo === 'SF:' + r.inqNo") > -1);
T('فاکتورهای مرتبط از offerNo', sf.indexOf('offNos.indexOf(i.offerNo) > -1') > -1);
T('افزودن سند از بیرون (آپلود)', sf.indexOf('attachUploadWidget') > -1 && sf.indexOf('sfAddMisc') > -1);
T('حذف سند متفرقه فقط پس از تأیید پاکسازی ابری', sf.indexOf('sfDelMisc') > -1 && sf.indexOf('sfDeleteCloudThen([doc.key]') > -1 && sf.indexOf('sfDelMiscCommit') > -1);
T('نامه: گزینه پرونده فروش در کشوی لینک', sf.indexOf("'SF:' + r.inqNo") > -1 && sf.indexOf('_sfLetterHooked') > -1);

SECTION('مختومه‌سازی دومسیره');
T('تشخیص فاکتور ثبت‌شده', sf.indexOf('function sfHasInvoice') > -1);
T('مسیر با فاکتور: پایان پروژه و تسویه کامل + انتقال کامل ضمایم', sf.indexOf('پایان پروژه و تسویه کامل') > -1 && sf.indexOf("sfArchive(r, 'settled', true)") > -1);
T('مسیر بدون فاکتور: دلیل + پیشنهاد دانلود + هشدار حذف', sf.indexOf('عدم برنده شدن') > -1 && sf.indexOf('دانلود اسناد قبل از مختومه') > -1 && sf.indexOf('هشدار نهایی') > -1);
T('حذف اسناد متفرقه از فضای ابری با action محدود پرونده', sf.indexOf('delete_case_document') > -1 && sf.indexOf('ptfStorageAuthHeaders') > -1);
T('متادیتا برای آمار می‌ماند (purged)', sf.indexOf('purged: true') > -1);
T('انتقال به بایگانی با آمار مدیریتی', sf.indexOf("state: 'archived'") > -1 && sf.indexOf('stats: {') > -1 && sf.indexOf('totalCO') > -1);
T('حذف رکورد از پرونده‌های فروش پس از انتقال', sf.indexOf('x.cd !== r.cd') > -1);
T('اعلان به مدیران', sf.indexOf("toRoles: ['admin', 'chairman', 'ceo']") > -1);

SECTION('تغییر نام «بایگانی»');
T('سایدبار: بایگانی', idx.indexOf('<span class="lb">بایگانی</span>') > -1 && idx.indexOf('پرونده‌های پروژه</span>') === -1);
T('پنل projects: بایگانی', pj.indexOf('<h3>🗄 بایگانی</h3>') > -1);
T('اسناد بایگانی بعدا قابل حذف/ویرایش (زیرساخت docs موجود)', pj.indexOf('p.docs') > -1);
DONE('tester52-v132');
