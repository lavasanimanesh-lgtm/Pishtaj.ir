/* tester67 — v14.7 (اسپرینت هـ «مشتریان یکپارچه»: US-382/363/380/381/370) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cm = fs.readFileSync(path.join(BASE, 'custmerge.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var lt = fs.readFileSync(path.join(BASE, 'listtools.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-382: سپر ضد داده‌صفر (بحرانی)');
T('سرور: خالی روی ناخالی رد می‌شود', php.indexOf('US-382') > -1 && php.indexOf('count($newArr) === 0') > -1 && php.indexOf('count($exArr) > 0') > -1);
T('سرور: فلگ allow_wipe فقط مسیر Go-Live', php.indexOf("$allow_wipe = !empty($j['allow_wipe'])") > -1);
T('سرور: rejected در پاسخ گزارش می‌شود', php.indexOf("'rejected' => $rejected") > -1);
T('کلاینت: GUARD_KEYS کلیدهای حیاتی', sy.indexOf("var GUARD_KEYS = ['ptf_crm_customers'") > -1);
T('کلاینت: سد push خالی + هشدار + audit', sy.indexOf('سپر داده (US-382)') > -1 && sy.indexOf('push خالی') > -1);
T('کلاینت: استثنای Go-Live (_ptfGoLiveWipe)', sy.indexOf('!window._ptfGoLiveWipe') > -1);
T('آشکارساز افت >۵۰٪ + اعلان admin/chairman', sy.indexOf('massDropCheck') > -1 && sy.indexOf('now < prev / 2') > -1 && sy.indexOf('هشدار افت انبوه داده') > -1);
T('baseline پس از pull موفق به‌روز می‌شود', sy.indexOf('ptfUpdateGuardCounts === \'function\') ptfUpdateGuardCounts();') > -1);
T('golive: فلگ + push مستقیم allow_wipe', gl.indexOf('window._ptfGoLiveWipe = true;') > -1 && gl.indexOf('allow_wipe: true') > -1);

SECTION('US-363: ادغام مشتریان تکراری');
T('ماژول custmerge.js ثبت در index/sw', (function(){var m=idx.match(/custmerge\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=14.7;})() && sw.indexOf("'./custmerge.js'") > -1);
T('AC7: فقط نقش‌های مجاز', cm.indexOf("var MERGE_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];") > -1);
T('AC1: گزینه ادغام داخل پیام ضدتکرار (hook ptfDupBlock)', cm.indexOf('var _dupBlock = window.ptfDupBlock;') > -1 && cm.indexOf('باز کردن ویزارد ادغام') > -1);
T('AC2: ویزارد فیلدبه‌فیلد با پیش‌فرض هوشمند (کامل‌تر)', cm.indexOf('function smarter(a, b)') > -1 && cm.indexOf('sb.length > sa.length') > -1);
T('AC3: جمع رابط‌ها/شماره‌های غیرتکراری', cm.indexOf('addedPpl++') > -1 && cm.indexOf('keep.coTels.some') > -1);
T('AC4: بازنویسی ارجاعات rfqs/offers/deals/projects/reminders/cheques/letters', ['r.custCd = keep.cd', 'o.buyerCd = keep.cd', 'd.buyerCd = keep.cd', 'p.custCd = keep.cd', 'c.custCd = keep.cd', 'l.to_co = keep.co'].every(function (s) { return cm.indexOf(s) > -1; }));
T('AC4: حذف نرم → deleted_archive با ذکر merge', cm.indexOf("kind: 'customer', cd: drop.cd") > -1 && cm.indexOf('🔀 ادغام در') > -1);
T('AC6: audit کامل (که/کی/چه فیلدهایی)', cm.indexOf('ارجاع منتقل،') > -1 && cm.indexOf('changedFields') > -1);
T('AC8: confirm دومرحله‌ای + snapshot دو رکورد', cm.indexOf('غیرقابل بازگشت') > -1 && cm.indexOf("kind: 'customer-merge-snapshot'") > -1);
T('دکمه 🔀 روی فهرست (hook رویدادمحور — نه setInterval)', cm.indexOf('mg-btn') > -1 && cm.indexOf('setInterval') === -1);
T('یادداشت mergedFrom روی مقصد', cm.indexOf('keep.mergedFrom.push') > -1);

SECTION('US-363: رفتار اجرایی ادغام');
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.faDateTime = function () { return '1405/04/17 10:00'; };
global.audit = function () {}; global.notify = function () {};
global.escP = function (s) { return String(s == null ? '' : s); };
global.alert = function (m) { global._lastAlert = String(m); };
global.confirm = function () { return true; };
global.hideModal = function () {};
global.renderCustomers = undefined;
global.window = global;
global.document = { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {} }; }, body: { insertAdjacentHTML: function () {} }, addEventListener: function () {} };
// استخراج و اجرای ptfMergeCommit با داده واقعی
var mCommit = cm.match(/window\.ptfMergeCommit = function \(\) \{[\s\S]*?\n  \};/);
T('تابع ptfMergeCommit استخراج شد', !!mCommit);
if (mCommit) {
  var FIELDS = [{ k: 'co', lb: 'نام' }, { k: 'coEn', lb: 'EN' }, { k: 'natId', lb: 'شناسه' }];
  var MERGE_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
  function canMerge() { return true; }
  var _mg = { keepCd: 'CUST-1', dropCd: 'CUST-2', choices: { coEn: 'b', natId: 'b' } };
  setData('ptf_crm_customers', [
    { cd: 'CUST-1', co: 'فولاد پارساگاد', coEn: '', natId: '', people: [{ nm: 'آقای الف', primary: true }], coTels: [], phones: [] },
    { cd: 'CUST-2', co: 'مجتمع صنایع فولاد پاسارگاد', coEn: 'Pasargad Steel Industries Complex', natId: '14000000001', people: [{ nm: 'مراد پورشاد', role: 'کارشناس خرید' }, { nm: 'آقای الف' }], coTels: [{ n: '02100000000' }], phones: [] }
  ]);
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', custCd: 'CUST-2', co: 'مجتمع صنایع فولاد پاسارگاد' }]);
  setData('ptf_crm_offers', [{ no: 'CO-1', buyerCd: 'CUST-2', buyerCo: 'x' }]);
  setData('ptf_crm_deals', [{ cd: 'SF-1', custCd: 'CUST-2', buyerCo: 'مجتمع صنایع فولاد پاسارگاد' }]);
  setData('ptf_crm_projects', []); setData('ptf_crm_reminders', []); setData('ptf_crm_cheques', []); setData('ptf_crm_letters', []);
  setData('ptf_crm_deleted_archive', []);
  eval(mCommit[0]);
  ptfMergeCommit();
  var after = getData('ptf_crm_customers');
  T('رکورد dropped حذف شد و فقط مقصد ماند', after.length === 1 && after[0].cd === 'CUST-1');
  T('فیلدهای انتخابی از ادغام‌شونده گرفته شد (coEn/natId)', after[0].coEn === 'Pasargad Steel Industries Complex' && after[0].natId === '14000000001');
  T('رابط غیرتکراری جمع شد (مراد اضافه، الف تکرار نشد)', after[0].people.length === 2);
  T('تلفن شرکت جمع شد', after[0].coTels.length === 1);
  T('ارجاع rfq/offer/deal به مقصد منتقل شد', getData('ptf_crm_rfqs')[0].custCd === 'CUST-1' && getData('ptf_crm_offers')[0].buyerCd === 'CUST-1' && getData('ptf_crm_deals')[0].custCd === 'CUST-1');
  var arc = getData('ptf_crm_deleted_archive');
  T('snapshot + حذف نرم در آرشیو (۲ رکورد)', arc.length === 2 && arc.some(function (a) { return a.kind === 'customer-merge-snapshot'; }) && arc.some(function (a) { return a.kind === 'customer'; }));
  T('mergedFrom روی مقصد ثبت شد', (after[0].mergedFrom || []).length === 1 && after[0].mergedFrom[0].cd === 'CUST-2');
}

SECTION('US-380: درخواست‌های سایت کامل + مشتری خودکار');
T('AC1: دکمه و مودال جزئیات کامل', br.indexOf('rfqSiteDetail') > -1 && br.indexOf('👁 جزئیات کامل') > -1);
T('AC1: همه فیلدها در مودال (ایمیل/استاندارد/برندها/شرح کامل)', ['📧 ایمیل', '📐 استاندارد فنی', '🏷 برندهای مورد نظر', '📝 شرح کامل درخواست'].every(function (s) { return br.indexOf(s) > -1; }));
T('AC1/AC4: پیوست نمایش داده می‌شود + مسیر امن', br.indexOf('function siteAttachmentHtml') > -1 && br.indexOf('فضای ابری') > -1 && br.indexOf('openStoredFile') > -1);
T('AC2: ساخت/اتصال خودکار مشتری در تایید', br.indexOf('function rfqSiteEnsureCustomer(r)') > -1 && br.indexOf('ثبت خودکار از درخواست سایت') > -1);
T('AC2: اتصال به موجود با نام یا تلفن + تکمیل رابط با تایید (هم‌راستا US-363)', br.indexOf('dedupNorm(c.co) === coN') > -1 && br.indexOf('به اشخاص رابط اضافه شود؟') > -1);
T('AC3: رکورد کامل (subj/inqText/email/std/vnd/پیوست)', br.indexOf('siteAttachment: r.attachment') > -1 && br.indexOf('subj: r.subject') > -1 && br.indexOf('inqText: r.message') > -1);
T('AC5: اعلان با ذکر مشتری ساخته‌شده', br.indexOf("(cust ? ' — مشتری: ' + cust.cd : '')") > -1);
T('custCd روی درخواست ثبت می‌شود', br.indexOf("custCd: cust ? cust.cd : ''") > -1);

SECTION('US-380: رفتار اجرایی ساخت مشتری');
var mEns = br.match(/function rfqSiteEnsureCustomer\(r\) \{[\s\S]*?\n  \}/);
T('تابع استخراج شد', !!mEns);
if (mEns) {
  global.genCode = function (p) { return p + '-9001'; };
  global.dedupNorm = function (s) { return String(s || '').replace(/\s/g, '').toLowerCase(); };
  global.dedupPhones = function (c) { return (c.ph ? [String(c.ph).replace(/\D/g, '')] : []); };
  global.dedupStamp = function (r) { return r; };
  setData('ptf_crm_customers', []);
  eval(mEns[0]);
  var made = rfqSiteEnsureCustomer({ code: 'PTF-RFQ-1405-0001', company: 'شرکت آزمایشی سایت', contact: 'آقای نمونه', phone: '09120000000', email: 'x@y.ir', category: 'ابزار دقیق' });
  T('مشتری جدید خودکار ساخته شد', made && made.cd === 'CUST-9001' && getData('ptf_crm_customers').length === 1);
  T('رابط فرم سایت با موبایل/ایمیل روی رکورد', made.people.length === 1 && made.people[0].mobs.length === 1);
  var again = rfqSiteEnsureCustomer({ code: 'PTF-RFQ-1405-0002', company: 'شرکت آزمایشی سایت', contact: 'آقای نمونه', phone: '09120000000' });
  T('درخواست دوم همان شرکت → اتصال (رکورد تکراری ساخته نشد)', again.cd === 'CUST-9001' && getData('ptf_crm_customers').length === 1);
}

SECTION('US-381: اعلان کالاهای تکراری دستیار + تایید کاربر');
T('پیش‌نمایش دو گروه جدید/تکراری قبل از ثبت', ai.indexOf('بررسی کالاها پیش از ثبت (US-381)') > -1 && ai.indexOf('🆕 جدید (ثبت می‌شوند)') > -1 && ai.indexOf('🔁 تکراری (رد می‌شوند') > -1);
T('تکراری‌ها با کد قبلی نمایش داده می‌شوند', ai.indexOf("قبلا با کد '+d.cd") > -1);
T('اخذ تایید کاربر (confirm) + توقف با انصراف', ai.indexOf('if(!confirm(msg381))') > -1 && ai.indexOf('بررسی کالاهای تکراری') > -1);
T('پیام صریح وقتی همه تکراری‌اند', ai.indexOf('هیچ کالای جدیدی وجود ندارد') > -1);
T('گزارش نتیجه دقیق: n جدید + m تکراری', ai.indexOf('کالای جدید ثبت شد') > -1 && ai.indexOf('کالای تکراری رد شد') > -1);
T('پیام صفر-جدید در نتیجه', ai.indexOf('هیچ کالای جدیدی ثبت نشد؛ همه') > -1);

SECTION('US-370: رابط اصلی در خروجی مشتریان');
T('ستون «رابط اصلی» در listtools مشتریان', lt.indexOf("C('con', 'رابط اصلی'") > -1);
T('با سمت رابط', lt.indexOf("(pp.role ? ' (' + pp.role + ')' : '')") > -1);
T('fallback به con قدیمی و خالی-امن', lt.indexOf("return r.con || '';") > -1);

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — cache-bust فقط «همان یا جدیدتر از 14.7» چک می‌شود */
T('cache-bust فایل‌های اسپرینت هـ (>=14.7)', ['bridge.js', 'ai-workbench.js', 'listtools.js', 'sync.js', 'golive.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 7));
}));

DONE('tester67-v147');
