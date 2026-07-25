/* tester65 — v14.5 (اسپرینت د «آماده بهره‌برداری واقعی»: US-377/368/376/371 + ثبت US-381) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var sm = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var pj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-377: Go-Live Reset (پاک‌سازی داده‌های آزمایشی)');
T('ماژول golive.js موجود و در index/sw ثبت است', /golive\.js\?v=\d+\.\d+/.test(idx) && sw.indexOf("'./golive.js'") > -1);
T('فقط ادمین', gl.indexOf("if (curRole() !== 'admin')") > -1 && (gl.match(/curRole\(\) !== 'admin'/g) || []).length >= 2);
T('WIPE_KEYS شامل داده‌های تراکنشی اصلی', ['ptf_crm_rfqs', 'ptf_crm_customers', 'ptf_crm_offers', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_invoices', 'ptf_crm_cheques', 'ptf_crm_deleted_archive'].every(function (k) { return gl.indexOf("'" + k + "'") > -1; }));
T('حفظ‌شونده‌ها در WIPE نیستند', ['ptf_crm_users', 'ptf_crm_perms', 'ptf_crm_settings', 'ptf_crm_sigprofiles', 'ptf_crm_msgtpls'].every(function (k) { return gl.indexOf("'" + k + "',") === -1 || gl.split('WIPE_KEYS = [')[1].split('];')[0].indexOf(k) === -1; }));
T('کالاها/تامین‌کنندگان انتخابی (چک‌باکس ادمین)', gl.indexOf('glWipeProds') > -1 && gl.indexOf('glWipeSups') > -1);
T('تایید ۳مرحله‌ای: پیش‌نمایش + تایپ «پاکسازی» + confirm نهایی', gl.indexOf("word.trim() !== 'پاکسازی'") > -1 && gl.indexOf('مرحله ۳ از ۳') > -1);
T('بک‌آپ اجباری — بدون بک‌آپ موفق اجرا نمی‌شود', gl.indexOf('ptfBackupDownload') > -1 && gl.indexOf('بدون بک‌آپ موفق اجرا نمی‌شود') > -1);
T('نسخه سروری pre-golive', gl.indexOf('pre-golive') > -1 && gl.indexOf('save_backup') > -1);
T('پاک‌سازی با setData([]) → سینک سرور (داده برنمی‌گردد)', gl.indexOf('setData(k, [])') > -1);
T('شمارنده‌های کدساز از نو (AC7)', gl.indexOf('window._ptfCodeSeq = {}') > -1);
T('کلیدهای جانبی آزمایشی (تاریخچه AI/پیش‌نویس‌ها) پاک می‌شوند', gl.indexOf('ptf_ai_hist_') > -1 && gl.indexOf('ptf_autodraft_offer_') > -1);
T('رویداد GO-LIVE در audit', gl.indexOf("'GO-LIVE'") > -1);
T('باکس «منطقه خطر» در تنظیمات فقط ادمین', gl.indexOf('منطقه خطر') > -1 && gl.indexOf("if (curRole() !== 'admin') return '';") > -1);

SECTION('US-368: نقش‌های اصلی تک‌نمونه');
T('UNIQUE_ROLES = chairman/ceo/commercial', rb.indexOf("var UNIQUE_ROLES = ['chairman', 'ceo', 'commercial'];") > -1);
T('ptfRoleHolder برای یافتن دارنده فعلی', rb.indexOf('window.ptfRoleHolder = function (rl)') > -1);
T('دراپ‌داون: نقش اشغال‌شده غیرفعال + نام دارنده', rb.indexOf('disabled>') > -1 && rb.indexOf('اشغال‌شده توسط') > -1);
T('سد دوم در saveUser2 (دور زدن dropdown ممکن نیست)', rb.indexOf('فقط یک‌بار قابل ایجاد است') > -1 && rb.indexOf('_holder = (typeof ptfRoleHolder') > -1);
T('حذف دارنده → نقش آزاد (بدون قفل اضافه در delUser2)', rb.indexOf('function delUser2(u)') > -1);

SECTION('US-368: رفتار اجرایی');
var mHolder = rb.match(/window\.ptfRoleHolder = function[\s\S]*?\n\};/);
T('تابع ptfRoleHolder استخراج شد', !!mHolder);
if (mHolder) {
  eval('var UNIQUE_ROLES = ["chairman","ceo","commercial"];' + mHolder[0]);
  setData('ptf_crm_users', [{ username: 'lavasani', name: 'Hamed Lavasani', roleId: 'chairman' }]);
  T('نقش اشغال‌شده → دارنده برمی‌گردد', ptfRoleHolder('chairman') && ptfRoleHolder('chairman').username === 'lavasani');
  T('نقش آزاد → null', ptfRoleHolder('ceo') === null);
  T('نقش چندنفره (sales) → همیشه null', ptfRoleHolder('sales') === null);
  setData('ptf_crm_users', []);
  T('پس از حذف دارنده → آزاد', ptfRoleHolder('chairman') === null);
}

SECTION('US-376: ارسال مجدد پیامک ورود');
T('تابع smsResendLogin', sm.indexOf('window.smsResendLogin = function (username)') > -1);
/* v14.9 (US-383): ارسال مجدد پیامک ورود برای چهار نقش مدیران ارشد */
T('فقط مدیران ارشد', sm.indexOf("['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0") > -1);
T('رمز hash قابل ارسال نیست → رمز موقت جدید', sm.indexOf("var tmp = 'PTF'") > -1 && sm.indexOf('getRandomValues') > -1 && sm.indexOf('رمز موقت') > -1);
T('الزام تغییر رمز در اولین ورود', sm.indexOf('u.mustChangePass = true;') > -1 && sm.indexOf('checkMustChangePass') > -1);
T('تغییر رمز الزام را برمی‌دارد', iq.indexOf('delete u.mustChangePass;') > -1);
T('اصلاح شماره موبایل پیش از ارسال', sm.indexOf('شماره موبایل مقصد (در صورت نیاز اصلاح کنید)') > -1);
T('ضداسپم ۳ ارسال/ساعت per کاربر', sm.indexOf('u.smsResends') > -1 && sm.indexOf('>= 3') > -1);
T('audit + سینک سروری کاربر', sm.indexOf("audit('کاربران', 'ارسال مجدد پیامک ورود") > -1 && sm.indexOf('usersSyncToServer()') > -1);
T('دکمه در فهرست کاربران', rb.indexOf('smsResendLogin(\\\'') > -1 && rb.indexOf('📱 ارسال مجدد') > -1);
T('نتیجه ارسال به ادمین گزارش می‌شود', sm.indexOf('پیامک اطلاعات ورود جدید به') > -1);

SECTION('US-371: قفل کامل پرونده مختومه بدون فاکتور');
T('تشخیص closeKind=lost', pj.indexOf("_prjLostLocked = _prjArchived && p.closeKind === 'lost'") > -1);
T('UI: ناحیه آپلود برای همه بسته', pj.indexOf('افزودن سند برای <b>همه کاربران</b> غیرفعال است (US-371)') > -1);
T('سد برنامه‌ای در callback آپلود (نه فقط UI)', pj.indexOf("pp.state === 'archived' && pp.closeKind === 'lost'") > -1);
T('پرونده settled مشمول قفل نیست (رفتار US-323 حفظ)', pj.indexOf('else if (_prjArchived && !ptfArcDocAllowed())') > -1);
T('پیام قفل شفاف', pj.indexOf('پرونده مختومه بدون فاکتور') > -1);

SECTION('ثبت US-381 در بک‌لاگ (بدون اجرا)');
var r3 = fs.readFileSync(path.resolve(__dirname, '../../BACKLOG-CORRECTIONS-R3.md'), 'utf-8');
T('US-381 ثبت شده (اعلان کالاهای تکراری دستیار)', r3.indexOf('US-381') > -1 && r3.indexOf('تکراری') > -1);
T('AC تایید کاربر و پیام دقیق', r3.indexOf('تایید کاربر اخذ شود') > -1 || r3.indexOf('کالای تکراری رد شد') > -1);

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — فقط «همان یا جدیدتر از 14.5» */
T('cache-bust فایل‌های اسپرینت د (>=14.5)', ['rbac.js', 'projects.js', 'sms.js', 'inqreader.js', 'golive.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 5));
}));

DONE('tester65-v145');
