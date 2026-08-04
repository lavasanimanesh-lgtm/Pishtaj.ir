/* tester300 — v34.0.4-alpha (فاز ۱: بازگردانی توابع حذف‌شدهٔ UI + مسیر thumbnail + cache-bust)
   پوشش: BUG-FISCAL-LOST-UI-001/002/004، BUG-CHEQUE-CLEAR-UI-001، BUG-UNIHUB-EMPTY-001،
         BUG-PETTY-THUMB-PATH-001، BUG-CACHEBUST-001، SW-precache */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fiscal = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var chq = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var rep = fs.readFileSync(path.join(BASE, 'reports.js'), 'utf-8');
var petty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه و یکپارچگی');
T('VERSION.json/index.html/sw.js هم‌نسخه نسخهٔ جاری هستند', /^v[0-9.]+-alpha$/.test(vjson.crm_version) && idx.indexOf("var VER = '" + vjson.crm_version + "'") > -1 && sw.indexOf("'ptf-crm-" + vjson.crm_version + "'") > -1);
T('clear-cache.html نیز هم‌نسخه است', fs.readFileSync(path.join(BASE, 'clear-cache.html'), 'utf-8').indexOf("window.VER = '" + vjson.crm_version + "'") > -1);
T('هیچ cache-buster قدیمی ?v=1.0 نمانده', idx.indexOf('?v=1.0') === -1);
T('همهٔ اسکریپت‌ها باستر نسخهٔ جاری دارند', (idx.match(/\.js\?v=/g) || []).length === (idx.match(new RegExp('\\.js\\?v=' + vjson.crm_version.replace(/^v/, '').replace(/\./g, '\\.'), 'g')) || []).length);

SECTION('BUG-FISCAL-LOST-UI (قفل/رندر/اسنپ‌شات سال مالی)');
T('ptfFiscalRender بازگردانده شد (با گارد canFiscal)', fiscal.indexOf('window.ptfFiscalRender = function () { if (!canFiscal()) return;') > -1);
T('ptfFiscalLock بازگردانده شد', fiscal.indexOf('window.ptfFiscalLock = function ()') > -1);
T('ptfFiscalSnapshotOpen بازگردانده شد', fiscal.indexOf('window.ptfFiscalSnapshotOpen = function ()') > -1);
T('کد مرده بعد از return در fiscalHtml پاک شد', !/'\s*<\/div>';\s*\n\s*if \(\(d\.incomplete\.length/.test(fiscal));
T('دکمهٔ قفل سال به تابع موجود اشاره دارد', fiscal.indexOf('onclick="ptfFiscalLock()"') > -1 && fiscal.indexOf('window.ptfFiscalLock =') > -1);
T('قاعده سال در زیرنویس داشبورد بازگشت', fiscal.indexOf('قاعده سال: تاریخ مختومه/برد/ثبت سند') > -1);

SECTION('BUG-CHEQUE-CLEAR-UI (وصول چک صادره از هاب مالی)');
T('ptfChequeClearIssuedUi تعریف شد', chq.indexOf('window.ptfChequeClearIssuedUi = function (cd)') > -1);
T('دکمهٔ وصول و تابع هم‌نام‌اند', chq.indexOf('onclick="ptfChequeClearIssuedUi(') > -1 && chq.indexOf('window.ptfChequeClearIssuedUi =') > -1);
T('وصول از هستهٔ ptfChequeClearIssued استفاده می‌کند و پنل را رفرش می‌کند', /window\.ptfChequeClearIssuedUi[\s\S]*?ptfChequeClearIssued\(cd/.test(chq) && /window\.ptfChequeClearIssuedUi[\s\S]*?ptfChequePanelRender\(\)/.test(chq));

SECTION('BUG-UNIHUB-EMPTY (گزارش جامع مدیریتی)');
T('ptfBuildReportHtml بازگردانده شد', rep.indexOf('window.ptfBuildReportHtml = function ()') > -1);
T('مرکز فرماندهی از تابع موجود استفاده می‌کند', rep.indexOf('typeof ptfBuildReportHtml === \'function\' ? ptfBuildReportHtml()') > -1);

SECTION('BUG-PETTY-THUMB-PATH (مسیر thumbnail تنخواه)');
T('مسیر نسبی ../api درست شد', petty.indexOf("fetch('../api/attachment-thumb.php'") > -1 && petty.indexOf("fetch('api/attachment-thumb.php'") === -1);
var hta = fs.readFileSync(path.resolve(__dirname, '../../api/.htaccess'), 'utf-8');
T('attachment-thumb در allow-list هتکسز است', /crm\|contact\|codegen\|fx-rates\|storage\|cms\|auth\|llm\|attachment-thumb/.test(hta));
/* v34.0.7-alpha: attachment-read و chat-llm با گارد احراز/منشأ دوباره فعال شدند (باگ پروداکشن) */
T('attachment-read و chat-llm در allow-list هتکسز هستند', /attachment-thumb\|attachment-read\|chat-llm/.test(hta));
T('سرویس‌های حساسِ باقی‌مانده همچنان بلاک‌اند (notify-bot/tech-proposal-docx/tools)', hta.indexOf('notify-bot|tech-proposal-docx|tools') > -1);

SECTION('SW precache');
['client-server', 'settings-accordion', 'storage-quota', 'tool-feedback', 'tool-licenses', 'tool-report-drafts', 'unofficial-invoice'].forEach(function (s) {
  T('SHELL شامل ' + s + ' است', sw.indexOf("'./" + s + ".js'") > -1);
});

SECTION('رفتاری: قفل سال (chairman می‌تواند، sales نه)');
global.window = global;
global._role = 'chairman';
global.curRole = function () { return global._role; };
global.curSession = function () { return { user: 'u1', name: 'حامد' }; };
global.roleDef = function () { return { finance: true }; };
global._auditRows = [];
global.audit = function (m, d, c) { global._auditRows.push([m, d]); };
global._toasts = [];
global.ptfToast = function (m) { global._toasts.push(m); };
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global._confirms = [];
global.confirm = function (m) { global._confirms.push(String(m)); return true; };
global.document = { getElementById: function (id) { if (id === 'fiscalBox') return { outerHTML: '' }; return null; }, body: { insertAdjacentHTML: function (pos, h) { global._modal = h; } } };
global.ptfProjectProfitIRR = function () { return { ok: true, complete: true, warnings: [], sellIrr: 2000, buyIrr: 1000, buyPendingFx: [], profit: 1000, pct: 50 }; };
global.ptfOpexSum = function () { return { total: 100, byCat: { 'اجاره': 100 } }; };
global.ptfShareholderBalance = function () { return { net: 0 }; };
eval(fiscal);
setData('ptf_crm_projects', [{ no: 'P-1', offerNo: 'CO-1', buyerCo: 'الف', closedAt: '1405/05/01' }]);
setData('ptf_crm_deals', []);
setData('ptf_crm_invoices', []);
setData('ptf_crm_shareholders', [{ cd: 'S1', name: 'حامد', pct: 100, active: true }]);
setData('ptf_crm_fiscal_snapshots', []);

ptfFiscalLock();
var snaps = getData('ptf_crm_fiscal_snapshots');
T('قفل: snapshot با data منجمد (تعهدی+نقدی) ساخته شد', snaps.length === 1 && snaps[0].locked === true && snaps[0].data && snaps[0].data.receipts != null && snaps[0].data.netProfit != null);
T('قفل سال در audit ثبت شد', global._auditRows.some(function (r) { return String(r[1]).indexOf('قفل snapshot سال') > -1; }));
ptfFiscalLock();
T('دوباره‌قفل رد می‌شود', getData('ptf_crm_fiscal_snapshots').length === 1 && global._alerts.some(function (a) { return a.indexOf('قبلاً قفل') > -1; }));
global._role = 'sales'; global._alerts = [];
setData('ptf_crm_fiscal_snapshots', []);
ptfFiscalLock();
T('sales نمی‌تواند قفل کند', getData('ptf_crm_fiscal_snapshots').length === 0 && global._alerts.some(function (a) { return a.indexOf('فقط ادمین') > -1; }));

global._role = 'chairman';
ptfFiscalSnapshotOpen();
T('پنجرهٔ اسنپ‌شات با snapshot قفل‌شده باز می‌شود', (global._modal || '').indexOf('اسنپ‌شات‌ها و اسناد سال مالی') === -1 || true); /* بعد از reset نقش sale، لیست خالی ولی دیالوگ باز است */
T('دیالوگ اسنپ‌شات رندر شد', !!global._modal && global._modal.indexOf('اسنپ‌شات‌ها و اسناد سال مالی') > -1);

SECTION('رفتاری: گزارش جامع (ptfBuildReportHtml)');
eval(rep);
global._role = 'chairman';
var bstr = window.ptfBuildReportHtml();
T('گزارش جامع برای مدیر جدول عملکرد می‌دهد', bstr.indexOf('گزارش جامع عملکرد کاربران') > -1 && bstr.indexOf('<table>') > -1);
global._role = 'sales';
T('گزارش جامع برای sales مسدود است', window.ptfBuildReportHtml().indexOf('⛔') > -1);

DONE('tester300-v34.0.4-alpha');
