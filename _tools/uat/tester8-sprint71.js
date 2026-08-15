/* TESTER-8 — اسپرینت ۷۱: امنیت، بک‌آپ/بازگردانی، اختیارات ادمین، مهر و امضای سراسری */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');

var els = {};
function mkEl(id) {
  return els[id] = els[id] || {
    id: id, style: {}, innerHTML: '', textContent: '', value: '', checked: false, files: [],
    insertAdjacentHTML: function (p, h) { this.innerHTML += h; },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {} },
    setAttribute: function () {}, getAttribute: function () { return null; }, onclick: null, remove: function () {}
  };
}
global.document = {
  getElementById: function (id) { return mkEl(id); },
  querySelectorAll: function () { return []; },
  createElement: function (t) { var e = mkEl('_c' + Math.random()); e.click = function () {}; return e; },
  addEventListener: function () {}, head: { appendChild: function () {} }, body: { appendChild: function () {} }
};
global.window = global;
global.confirm = function (m) { global._lastConfirm = m; return global._confirmAns !== false; };
global.alert = function (m) { global._lastAlert = m; };
global.prompt = function (m) { return global._promptAns; };
global.addLog = function () {};
global.hideModal = function () {};
global.audit = function (m, a, r) { var l = getData('ptf_crm_audit'); l.unshift({ t: faDateTime(), user: curSession().name, m: m, a: a, ref: r }); setData('ptf_crm_audit', l); };
global.notify = function (o) { global._notifs = global._notifs || []; global._notifs.push(o); return 'N'; };
global.curSession = function () { return { user: global._curUser || 'admin', name: 'تستر' }; };
global.curRole = function () { return global._curRole || 'admin'; };
global.roleDef = function () { return { panels: '*', users: true, finance: true, lb: 'x' }; };
global.isSenior = function () { return true; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.goPanel = function () {};
global.showCrm = null;
global.renderOffers = function () { global._renderedOffers = true; };
global.fetch = function (url, opt) {
  global._fetches = global._fetches || [];
  global._fetches.push({ url: url, opt: opt });
  return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, mode: 'arvan', t: 'now' }); } });
};
global.Blob = function (parts) { this.parts = parts; };
global.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
global.FileReader = function () { this.readAsText = function () {}; };
global.setInterval = function (f, ms) { global._intervals = global._intervals || []; global._intervals.push(ms); return 1; };
global.setTimeout = function (f, ms) { return 1; };
global.localStorage.clear();

var bakCode = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var offCode = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var cntCode = fs.readFileSync(path.join(BASE, 'contracts.js'), 'utf-8');
var letCode = fs.readFileSync(path.join(BASE, 'letters.js'), 'utf-8');
var idxCode = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var apiCode = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var stoCode = fs.readFileSync(path.join(ROOT, 'api/storage.php'), 'utf-8');
var htaccess = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf-8');

// بارگذاری backup.js (بدون buildSettings موجود)
global.buildSettings = function () { return '<base-settings>'; };
eval.call(global, bakCode);

SECTION('US-145: سخت‌سازی امنیتی');
T('لاگ API از webroot خارج شد', apiCode.indexOf("log_dir = __DIR__ . '/../crm/data'") > -1 && apiCode.indexOf("@unlink($old_log)") > -1);
T('فایل لاگ افشاشده قدیمی در ریپو حذف شد', !fs.existsSync(path.join(BASE, 'api_log.txt')));
T('rate-limit روی فرم‌های عمومی', apiCode.indexOf("'add_supplier' => 10") > -1 && apiCode.indexOf('429') > -1);
T('سقف حجم POST عمومی', apiCode.indexOf('CONTENT_LENGTH') > -1 && apiCode.indexOf('413') > -1);
T('storage: delete/list فقط same-origin', stoCode.indexOf('Cross-origin request blocked') > -1);
T('htaccess: مسدودسازی json/log/txt', htaccess.indexOf('json|log|txt') > -1 || /FilesMatch "\\\.\(json\|log\|txt/.test(htaccess));
T('htaccess: Permissions-Policy + HSTS', htaccess.indexOf('Permissions-Policy') > -1 && htaccess.indexOf('Strict-Transport-Security') > -1);
T('قفل ورود بعد از ۵ تلاش', idxCode.indexOf('loginFail') > -1 && idxCode.indexOf('60000') > -1);
T('ورود موفق قفل را پاک می‌کند', (idxCode.match(/removeItem\('ptf_login_lock'\)/g) || []).length >= 2);
T('XSS: renderDashRfq با escP', idxCode.indexOf("escP(rfqs[i].co)") > -1);
T('XSS: dropdown سفارشات با escP', idxCode.indexOf("escP(rfqs[i].cd) + '\">' + escP(rfqs[i].cd)") > -1);
// دکمه ورود واضح‌تر
var certHtml = fs.readFileSync(path.join(ROOT, 'about/certificates/index.html'), 'utf-8');
T('دکمه ورود سایت واضح‌تر شد', certHtml.indexOf('ورود همکاران (CRM)') > -1);
var idxSite = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
T('صفحه اصلی هم دکمه جدید دارد', idxSite.indexOf('ورود همکاران (CRM)') > -1);

SECTION('US-146: بک‌آپ خودکار');
T('اکشن save_backup سروری', apiCode.indexOf("case 'save_backup'") > -1);
T('بک‌آپ ساعتی جایگزین (hourly-latest)', apiCode.indexOf('hourly-latest.json') > -1);
T('نسخه روزانه چرخشی (US-282: ۳ روز اخیر)', apiCode.indexOf("'/daily-'") > -1 && apiCode.indexOf('count($files) - 3') > -1);
T('تلاش آپلود آروان (presign→PUT، کلید ثابت US-282)', apiCode.indexOf('presign_put') > -1 && apiCode.indexOf("'crm-backup-latest'") > -1);
T('پوشه بک‌آپ محافظت‌شده', apiCode.indexOf("backups'") > -1);
T('get_backup فقط ادمین/رییس + ضد path traversal', apiCode.indexOf("role_guard('users_write'); // فقط ادمین") > -1 && apiCode.indexOf('basename(') > -1 && apiCode.indexOf('hourly-latest|weekly-latest|monthly-latest|daily-') > -1);
// کلاینت
setData('ptf_crm_rfqs', [{ cd: 'R1' }, { cd: 'R2' }]);
setData('ptf_crm_offers', [{ no: 'O1' }]);
global._fetches = [];
ptfBackupNow();
T('بک‌آپ فوری به سرور POST می‌شود', global._fetches.some(function (f) { return String(f.url).indexOf('save_backup') > -1; }));
var sent = JSON.parse(global._fetches[0].opt.body);
T('ساختار بک‌آپ: app/ver/data/counts', sent.app === 'PTF-CRM' && !!sent.data && sent.counts.ptf_crm_rfqs === 2);
T('زمان‌بندی ساعتی (۳۶۰۰۰۰۰ms)', bakCode.indexOf('3600000') > -1);
T('باکس بک‌آپ به تنظیمات اضافه شد', buildSettings().indexOf('بک‌آپ و بازگردانی') > -1);

SECTION('US-146 AC4: بازگردانی');
T('بازگردانی فقط ادمین', bakCode.indexOf("curRole() !== 'admin'") > -1 && bakCode.indexOf('بازگردانی اطلاعات فقط توسط ادمین') > -1);
T('پیش‌نمایش با تاریخ و تعداد رکورد', bakCode.indexOf('پیش‌نمایش بازگردانی') > -1 && bakCode.indexOf('j.counts') > -1);
T('تایید دومرحله‌ای (تایپ «بازگردانی»)', bakCode.indexOf("word !== 'بازگردانی'") > -1);
T('بک‌آپ اضطراری قبل از جایگزینی (AC5)', bakCode.indexOf('ptf_backup_prerestore') > -1);
T('اعتبارسنجی فایل (app=PTF-CRM)', bakCode.indexOf("j.app !== 'PTF-CRM'") > -1);
T('فهرست بک‌آپ‌های سرور + بازگردانی از آن', bakCode.indexOf('ptfServerBackups') > -1 && bakCode.indexOf('ptfRestoreServer') > -1);

SECTION('US-147: اختیارات ادمین');
// adminUnwin: برنده → بازگشت + حذف پرونده
setData('ptf_crm_offers', [{ no: 'PTF-CO-1405-060', kind: 'CO', st: 'won', wonBy: 'x', wonAt: 't', invRef: { by: 'y' }, items: [] }]);
setData('ptf_crm_projects', [{ no: 'PTF-PRJ-1405-009', offerNo: 'PTF-CO-1405-060', auto: true, docs: [], timeline: [] }]);
global._curRole = 'chairman';
global._lastAlert = '';
adminUnwin('PTF-CO-1405-060');
T('غیرادمین نمی‌تواند بازگرداند (حتی رییس)', getData('ptf_crm_offers')[0].st === 'won' && String(global._lastAlert).indexOf('فقط ادمین') > -1);
global._curRole = 'admin';
global._confirmAns = true;
adminUnwin('PTF-CO-1405-060');
var o = getData('ptf_crm_offers')[0];
T('ادمین بازگرداند: وضعیت sent شد', o.st === 'sent');
T('قفل‌ها پاک شدند (wonAt/wonBy/invRef)', !o.wonAt && !o.wonBy && !o.invRef);
T('پرونده خودکار حذف شد (AC2)', getData('ptf_crm_projects').length === 0);
T('هشدار شامل حذف پرونده بود', String(global._lastConfirm).indexOf('پرونده خودکار') > -1);
T('در audit ثبت شد', getData('ptf_crm_audit').some(function (a) { return a.a.indexOf('بازگشت از وضعیت برنده') > -1; }));
// adminDelOffer
setData('ptf_crm_offers', [{ no: 'PTF-CO-1405-061', kind: 'CO', st: 'won', items: [] }]);
setData('ptf_crm_projects', [{ no: 'PRJ-X', offerNo: 'PTF-CO-1405-061' }]);
adminDelOffer('PTF-CO-1405-061');
T('حذف ادمینی پیشنهاد قفل + پرونده', getData('ptf_crm_offers').length === 0 && getData('ptf_crm_projects').length === 0);
T('دکمه‌های ادمین در رندر تزریق می‌شوند', bakCode.indexOf('adm-unwin') > -1);

SECTION('US-148: مهر و امضای سراسری');
T('حذف پس‌زمینه خودکار (لومینانس + محو نرم)', letCode.indexOf('lum > 235') > -1 && letCode.indexOf('d[i + 3] = 0') > -1);
T('چک‌باکس امضا در فرم TO/CO', offCode.indexOf('ofUseSig') > -1 && offCode.indexOf('درج مهر و امضا') > -1); // v13.1: متن به «درج مهر و امضا روی سند» تغییر کرد (امضای نیابتی US-321)
T('غیرفعال اگر پروفایل امضا نیست', offCode.indexOf('mySigReady()') > -1 && offCode.indexOf('disabled') > -1);
T('ذخیره useSig در offerSave', offCode.indexOf('o.useSig = !!(document.getElementById(\'ofUseSig\')') > -1);
T('پیش‌نمایش هم useSig را می‌خواند (AC3)', (offCode.match(/o\.useSig = !!\(document\.getElementById\('ofUseSig'\)/g) || []).length >= 2);
T('TO با تیک → امضا در PDF', offCode.indexOf('isCO || o.useSig') > -1);
T('چک‌باکس امضا در قرارداد', cntCode.indexOf('ctUseSig') > -1);
T('امضا در سمت درست قرارداد (فروش/خرید)', cntCode.indexOf("c.kind === 'sale' ? 0 : 1") > -1);
T('بلوک امضای قرارداد جایگزین ثابت شد', cntCode.indexOf('ctSigBlock(c, isEn)') > -1);
T('امضاکننده قرارداد ثبت می‌شود', cntCode.indexOf('c.sigUser = curSession().user') > -1);

SECTION('بررسی کلی ماژول‌ها (رگرسیون سبک)');
var mods = ['offers.js', 'leads.js', 'rbac.js', 'storage.js', 'projects.js', 'letters.js', 'analyzer.js', 'contracts.js', 'shell.js', 'bridge.js', 'reports.js', 'backup.js'];
mods.forEach(function (m) {
  var src = fs.readFileSync(path.join(BASE, m), 'utf-8');
  T('ماژول ' + m + ' بدون console.log باقیمانده', !/^\s*console\.log/m.test(src));
});
T('اسکریپت backup.js در index لود می‌شود', idxCode.indexOf('backup.js') > -1);
T('کش SW نسخه‌بندی شده (v71+)', fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8').indexOf('ptf-crm-') > -1);

DONE('TESTER-8 (Sprint71)');
process.exit(RESULTS.fail ? 1 : 0);
