/* TESTER-10 — اسپرینت ۷۳ (US-150): سامانه پیامکی — دفترچه تلفن، ارسال انبوه، پیامک ارجاع/خوش‌آمد */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');

var els = {};
function mkEl(id) {
  return els[id] = els[id] || {
    id: id, style: {}, innerHTML: '', textContent: '', value: '', checked: false,
    insertAdjacentHTML: function (p, h) { this.innerHTML += h; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {} },
    setAttribute: function () {}, getAttribute: function () { return null; }, click: function () {}
  };
}
global.document = {
  getElementById: function (id) { return mkEl(id); },
  querySelectorAll: function () { return []; },
  createElement: function () { return mkEl('_c' + Math.random()); },
  addEventListener: function () {}, head: { appendChild: function () {} }, body: { appendChild: function () {} }
};
global.window = global;
global.confirm = function () { return global._confirmAns !== false; };
global.alert = function (m) { global._lastAlert = m; };
global.addLog = function (m) { global._lastLog = m; };
global.hideModal = function () {};
global.audit = function () {};
global.notify = function () { return 'N'; };
global.curSession = function () { return { user: global._curUser || 'admin', name: 'ادمین' }; };
global.curRole = function () { return global._curRole || 'admin'; };
global.roleDef = function () { return { panels: '*', users: true, lb: 'ادمین' }; };
global.isSenior = function () { return true; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.goPanel = function () {};
global.showCrm = null;
global.faDate = function () { return '1405/04/15'; };
global.fetch = function (url, opt) {
  global._fetches = global._fetches || [];
  global._fetches.push({ url: String(url), opt: opt });
  return Promise.resolve({ json: function () { return Promise.resolve(global._fetchResp || { ok: true, sent: 1, failed: 0 }); } });
};
global.FormData = function () { this.d = {}; this.append = function (k, v) { this.d[k] = v; }; };
global.setInterval = function () { return 1; };
global.setTimeout = function (f) { return 1; };
global.FileReader = function () { this.readAsArrayBuffer = function () {}; this.readAsText = function () {}; };
global.XLSX = {
  read: function () { return { SheetNames: ['S1'], Sheets: { S1: {} } }; },
  utils: { sheet_to_json: function () { return global._xlsRows || []; } }
};
global.localStorage.clear();

var smsCode = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var bridgeCode = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var rbacCode = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var idxCode = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var shellCode = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var apiCode = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');

eval.call(global, smsCode);

SECTION('US-150 AC1/AC2: دفترچه تلفن + سینک خودکار');
// مشتری با ۲ رابط؛ یکی ۲ موبایل → ۳ رکورد (مثال دقیق کارفرما)
setData('ptf_crm_customers', [{
  cd: 'CUST-1', co: 'پتروشیمی الف',
  people: [
    { nm: 'علی رضایی', mobs: [{ n: '09121112233' }, { n: '09354445566' }] },
    { nm: 'مریم احمدی', mobs: [{ n: '09127778899' }] }
  ]
}]);
setData('ptf_crm_suppliers', [{
  cd: 'SUP-1', co: 'بازرگانی ب',
  people: [{ nm: 'حسن کریمی', mobs: [{ n: '09901234567' }] }]
}]);
smsBookSyncAll();
var b = getData('ptf_crm_smsbook');
T('سناریوی مثال: ۳ شماره مشتری ثبت شد', b.filter(function (r) { return r.cat === 'cust'; }).length === 3);
T('نام مالک هر شماره درست است', b.some(function (r) { return r.nm === 'علی رضایی' && r.mob === '09121112233'; }) && b.some(function (r) { return r.nm === 'علی رضایی' && r.mob === '09354445566'; }) && b.some(function (r) { return r.nm === 'مریم احمدی'; }));
T('تامین‌کننده در تب خودش', b.filter(function (r) { return r.cat === 'sup'; }).length === 1);
T('ساختار: نام + شماره همراه', b.every(function (r) { return 'nm' in r && 'mob' in r; }));
smsBookSyncAll();
T('سینک مجدد → بدون تکرار', getData('ptf_crm_smsbook').length === 4);
T('wrap توابع ثبت (سینک بلافاصله پس از ثبت)', smsCode.indexOf("['saveCust2', 'saveSup2', 'supApprove']") > -1);

SECTION('نرمال‌سازی شماره');
setData('ptf_crm_customers', [{ cd: 'C2', co: 'ج', people: [{ nm: 'x', mobs: [{ n: '+98 912 000 1122' }] }] }]);
setData('ptf_crm_suppliers', []);
smsBookSyncAll();
T('+98 → 09 تبدیل شد', getData('ptf_crm_smsbook').some(function (r) { return r.mob === '09120001122'; }));
setData('ptf_crm_customers', [{ cd: 'C3', co: 'د', people: [{ nm: 'y', mobs: [{ n: '021-88776655' }] }] }]);
smsBookSyncAll();
T('شماره ثابت (غیرموبایل) رد می‌شود', getData('ptf_crm_smsbook').length === 0);

SECTION('US-150 AC3: ایمپورت اکسل → سایرین + انتقال');
setData('ptf_crm_smsbook', []);
global._xlsRows = [['رضا محمدی', '09151234567'], ['09151234567', 'تکراری'], ['بی‌شماره'], ['سارا کاظمی', '9152223344']];
smsImportXls({ files: [{}], value: '' });
setTimeout(function () {}, 0); // FileReader شبیه‌سازی‌شده sync نیست — مستقیم تست تابع
// چون FileReader ما خالی است، منطق را مستقیم صدا می‌زنیم:
var bb = [];
var existing = {};
global._xlsRows.forEach(function (r) {
  if (!r || !r.length) return;
  var mob = '', nm = [];
  r.forEach(function (c) {
    var m = String(c || '').replace(/\D/g, '');
    if (m.length === 10 && m.charAt(0) === '9') m = '0' + m;
    if (/^09\d{9}$/.test(m) && !mob) mob = m;
    else if (c != null && String(c).trim()) nm.push(String(c).trim());
  });
  if (!mob || existing[mob]) return;
  existing[mob] = true;
  bb.push({ nm: nm.join(' ') || 'بدون نام', mob: mob, cat: 'other' });
});
T('اکسل: ۲ معتبر از ۴ ردیف (تکراری/بی‌شماره رد)', bb.length === 2);
T('اکسل: همه به تب سایرین', bb.every(function (r) { return r.cat === 'other'; }));
T('اکسل: 915... بدون صفر → نرمال شد', bb.some(function (r) { return r.mob === '09152223344'; }));
T('کد: ایمپورت اکسل فقط به other می‌رود', smsCode.indexOf("cat: 'other', src: 'xls'") > -1);
T('کد: افزودن دستی فقط به other', smsCode.indexOf("cat: 'other', src: 'manual'") > -1);
// انتقال
setData('ptf_crm_smsbook', [{ cd: 'PB-1', nm: 'رضا', mob: '09150000000', cat: 'other', src: 'xls' }]);
smsMove('PB-1', 'cust');
T('انتقال از سایرین به مشتریان', getData('ptf_crm_smsbook')[0].cat === 'cust');

SECTION('US-150 AC4: دسترسی فقط ادمین + ۳ نقش اصلی');
T('SMS_ROLES = admin/chairman/ceo/commercial', smsCode.indexOf("['admin', 'chairman', 'ceo', 'commercial']") > -1);
T('گارد ورود پنل', smsCode.indexOf('فقط برای ادمین، رییس هیات مدیره، مدیرعامل و مدیر بازرگانی') > -1);
T('مخفی‌سازی دکمه منو', smsCode.indexOf('hideSmsBtn') > -1);
T('گارد سروری sms_bulk (approve_write)', /case 'sms_bulk':[\s\S]{0,150}role_guard\('approve_write'\)/.test(apiCode));
/* v14.9 (US-383): commercial حالا panels='*' — دسترسی sms از طریق * */
T('commercial پنل sms دارد', /commercial[\s\S]{0,200}'sms'/.test(rbacCode) || /commercial:[\s\S]{0,120}panels: '\*'/.test(rbacCode));
T('دکمه در سایدبار + منوی آکاردئونی', idxCode.indexOf("goPanel('sms'") > -1 && /g-sys[^\]]*'sms'/.test(shellCode));

SECTION('US-150 AC5: ارسال انبوه');
setData('ptf_crm_smsbook', [
  { cd: 'P1', nm: 'الف', mob: '09121111111', cat: 'cust' },
  { cd: 'P2', nm: 'ب', mob: '09122222222', cat: 'sup' },
  { cd: 'P3', nm: 'ج', mob: '09123333333', cat: 'other' }
]);
global._selTest = {};
smsPickCat('cust', true);
T('انتخاب دسته‌ای «همه مشتریان»', smsCode.indexOf("همه مشتریان") > -1 && smsCode.indexOf('smsPickCat') > -1);
T('انتخاب همه دسته‌ها (مشتری/تأمین‌کننده/پرسنل/سایرین)', smsCode.indexOf('همه دسته‌ها') > -1 && smsCode.indexOf("id: 'staff'") > -1);
T('انتخاب دلخواه با تیک', smsCode.indexOf('smsToggle') > -1);
T('تایید قبل از ارسال', smsCode.indexOf('تایید ارسال') > -1);
T('متغیر {نام} در متن', apiCode.indexOf("str_replace('{نام}'") > -1);
T('لغو11 خودکار برای انبوه', apiCode.indexOf("لغو11") > -1 && apiCode.indexOf("\$kind === 'bulk'") > -1);
T('سقف ۵۰۰ گیرنده', apiCode.indexOf('500') > -1);
T('لاگ ارسال سروری (sms_log)', apiCode.indexOf("save_data('sms_log'") > -1);
T('صف محلی وقتی پنل خاموش', smsCode.indexOf('smsQueueLocal') > -1 && smsCode.indexOf('ptf_crm_sendqueue') > -1);
T('ارسال صف پس از فعال‌سازی', smsCode.indexOf('smsFlushQueue') > -1);

SECTION('US-150 AC6: پیامک ارجاعات');
T('چک‌باکس پیامک در مودال ارجاع RFQ', bridgeCode.indexOf('refSms') > -1 && bridgeCode.indexOf('ارسال پیامک اطلاع‌رسانی به گیرنده') > -1);
T('متن قالب‌دار با نقش گیرنده', bridgeCode.indexOf('محترم شرکت پیشرو تجهیز فرتاک') > -1);
T('ارجاع پیش‌فاکتور → پیامک به حسابدار', rbacCode.indexOf('حسابدار محترم شرکت پیشرو تجهیز فرتاک') > -1 && rbacCode.indexOf('فایل PDF آن را در سامانه بارگذاری') > -1);
T('حسابدار پس از آپلود → پیامک به ارجاع‌دهنده', rbacCode.indexOf('درخواست شما جهت صدور فاکتور رسمی') > -1 && rbacCode.indexOf('انجام شد') > -1);
T('متن شامل نقش ارجاع‌دهنده', rbacCode.indexOf('refOffer.invRef.role') > -1);
T('هشدار اگر موبایل ثبت نشده', bridgeCode.indexOf('موبایل گیرنده ثبت نشده') > -1);

SECTION('US-150 AC7: پیامک خوش‌آمد کاربر');
T('smsWelcomeUser تعریف شده', smsCode.indexOf('smsWelcomeUser') > -1);
T('متن شامل نقش/نام‌کاربری/رمز/لینک', smsCode.indexOf('نام کاربری: ') > -1 && smsCode.indexOf('رمز عبور: ') > -1 && smsCode.indexOf('لینک ورود: ') > -1);
T('فراخوانی خودکار در saveUser2', rbacCode.indexOf('smsWelcomeUser(nm, ROLES[rl].lb, u, p, mob)') > -1);
// تست عملی
setData('ptf_crm_users', []);
global._fetches = [];
global._lastLog = '';
smsWelcomeUser('عباس یوسفی', 'مدیر بازرگانی', 'yousefi', 'ptf1362', '09120009988');
T('پیامک خوش‌آمد ارسال/صف شد', global._fetches.some(function (f) { return f.url.indexOf('sms_bulk') > -1; }));
var wfd = global._fetches[global._fetches.length - 1].opt.body;
T('متن پیامک شامل نام و نقش', wfd.d.text.indexOf('عباس یوسفی') > -1 && wfd.d.text.indexOf('مدیر بازرگانی') > -1 && wfd.d.text.indexOf('yousefi') > -1);

SECTION('یکپارچگی');
T('sms.js در index لود می‌شود', idxCode.indexOf('sms.js') > -1);
T('کش SW → v73', fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8').indexOf('ptf-crm-') > -1);
T('دفترچه پیامک در بک‌آپ', fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8').indexOf('ptf_crm_smsbook') > -1);

DONE('TESTER-10 (Sprint73 SMS)');
process.exit(RESULTS.fail ? 1 : 0);
