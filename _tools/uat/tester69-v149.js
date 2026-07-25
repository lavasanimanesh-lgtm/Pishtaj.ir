/* tester69 — v14.9 (US-383: دستیار برای همه + دسترسی کامل مدیرعامل/مدیر بازرگانی) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var pm = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');
var rp = fs.readFileSync(path.join(BASE, 'reports.js'), 'utf-8');
var cm = fs.readFileSync(path.join(BASE, 'cms.js'), 'utf-8');
var sm = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var pj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

/* ===== AC1: دستیار برای همه نقش‌ها ===== */
SECTION('AC1: دسترسی دستیار (ai) برای همه نقش‌ها — رفتار اجرایی');
var code = loadFns('rbac.js', ['curSession', 'curRole', 'roleDef', 'canPanel']);
loadVar('rbac.js', 'ROLES');
function login(rid) { localStorage.setItem('ptf_crm_session', JSON.stringify({ user: rid + '1', name: 'کاربر ' + rid, roleId: rid })); }
['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'].forEach(function (rid) {
  login(rid);
  var d = roleDef();
  T(rid + ': دستیار باز', d.panels === '*' || canPanel('ai'));
});
T('نقش‌های محدود صریحا ai در panels دارند', ["'cart','ai'", "'inqs','deals','ai'", "'buyq','cart','ai'", "'recv','cart','ai'"].every(function (s) { return rb.indexOf(s) > -1; }));

/* ===== AC2: مدیرعامل و مدیر بازرگانی = هم‌سطح رییس هیات مدیره ===== */
SECTION('AC2: ceo/commercial هم‌سطح chairman');
login('ceo');
var dCeo = roleDef();
T('ceo: panels=*', dCeo.panels === '*');
T('ceo: users=true (مدیریت کاربران)', dCeo.users === true);
T('ceo: finance=true', dCeo.finance === true);
T('ceo: buyPrice+sellPrice', dCeo.buyPrice === true && dCeo.sellPrice === true);
login('commercial');
var dCom = roleDef();
T('commercial: panels=*', dCom.panels === '*');
T('commercial: users=true', dCom.users === true);
T('commercial: finance=true', dCom.finance === true);
T('commercial: buyPrice+sellPrice', dCom.buyPrice === true && dCom.sellPrice === true);
login('chairman');
var dCh = roleDef();
T('هم‌سطحی کامل: پرچم‌های ceo/commercial == chairman', ['users', 'finance', 'buyPrice', 'sellPrice'].every(function (k) { return dCeo[k] === dCh[k] && dCom[k] === dCh[k]; }) && dCeo.panels === dCh.panels && dCom.panels === dCh.panels);

SECTION('AC2: گیت‌های chairman-only باز شد');
T('گزارشات: REPORT_ROLES چهار نقش', rp.indexOf("var REPORT_ROLES = ['admin', 'chairman', 'ceo', 'commercial']") > -1);
T('مدیریت سایت: CMS_ROLES چهار نقش', cm.indexOf("var CMS_ROLES = ['admin', 'chairman', 'ceo', 'commercial']") > -1);
T('perms: ptfCanAccess rep/cms چهار نقش', pm.indexOf("if (panelId === 'rep' || panelId === 'cms') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) > -1;") > -1);
T('perms: roleDefaultFor rep/cms چهار نقش', pm.indexOf("if (panelId === 'rep' || panelId === 'cms') return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1;") > -1);
T('perms: مودال دسترسی + دکمه فهرست کاربران چهار نقش', (pm.match(/'admin', 'chairman', 'ceo', 'commercial'/g) || []).length >= 4);
T('sms: ارسال مجدد پیامک ورود چهار نقش (US-376)', sm.indexOf("['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0) { alert('⛔ فقط مدیران ارشد')") > -1);
T('projects: سود خالص برای commercial هم', pj.indexOf("['admin','chairman','ceo','commercial'].indexOf(curRole()) > -1 ? '<button") > -1);
T('offers: امضای نیابتی US-321 برای ceo/commercial', of.indexOf("r === 'chairman' || r === 'admin' || r === 'ceo' || r === 'commercial'") > -1);
T('backup: یادآور ماهانه بک‌آپ برای مدیران ارشد', bk.indexOf("['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) < 0) return;") > -1);

/* ===== AC3: سهمیه AI پابرجا ===== */
SECTION('AC3: سهمیه AI (US-320) پابرجا');
T('مدیران ارشد ۴۰۰ (شامل commercial)', ai.indexOf("(r === 'admin' || r === 'chairman' || r === 'ceo' || r === 'commercial') ? 400 : 50") > -1);
var mQ = ai.match(/window\.aiWB_quotaLimit = function\(\)\{[\s\S]*?\n\};/);
T('تابع سهمیه استخراج شد', !!mQ);
if (mQ) {
  eval(mQ[0]);
  login('commercial');
  T('commercial → سهمیه ۴۰۰', aiWB_quotaLimit() === 400);
  login('sales');
  T('sales → سهمیه ۵۰ (دستیار باز ولی سهمیه محدود)', aiWB_quotaLimit() === 50);
  login('collector');
  T('collector → سهمیه ۵۰', aiWB_quotaLimit() === 50);
}

/* ===== AC4: استثناهای عمدی دست‌نخورده ===== */
SECTION('AC4: استثناهای عمدی حفظ شد');
T('Go-Live فقط ادمین (US-377 — عمدا باز نشد)', gl.indexOf("curRole() !== 'admin'") > -1);
T('ارجاع به ادمین همچنان ممنوع (US-353)', fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8').indexOf("u.username !== 'admin' && (u.roleId || '') !== 'admin'") > -1);
T('نقش‌های تک‌نمونه پابرجا (US-368)', rb.indexOf("var UNIQUE_ROLES = ['chairman', 'ceo', 'commercial'];") > -1);
T('perms: ai به فهرست override اضافه شد (کنترل per کاربر ممکن)', pm.indexOf("{ id: 'ai', lb: 'دستیار (AI)' }") > -1);
login('sales');
T('sales: پنل قیمت‌های خرید همچنان بسته (باز نشدن ناخواسته)', !canPanel('buyq'));
login('buyer');
T('buyer: پیشنهادها همچنان بسته', !canPanel('off'));
login('accountant');
T('accountant: درخواست‌ها همچنان بسته', !canPanel('rfq'));

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=14.9)', ['rbac.js', 'perms.js', 'reports.js', 'cms.js', 'sms.js', 'projects.js', 'offers.js', 'ai-workbench.js', 'backup.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 9));
}));

DONE('tester69-v149');
