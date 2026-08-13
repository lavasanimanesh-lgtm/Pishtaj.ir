/* tester301 — v34.0.5-alpha (فاز ۲: داشبورد سال مالی)
   پوشش: BUG-FISCAL-YEAR-001 (فیلتر سال با ورودی فارسی — «۱۴۰۴ باید صفر باشد»)،
         BUG-FISCAL-YEAR-UI-002 (سلکتور سال)، BUG-FISCAL-PCT-003 (برچسب/نرمال درصد)،
         BUG-FISCAL-PDF-005 (خروجی PDF)، علی‌الحساب → کسر از سهم (مانده قابل تسویه) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fc = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version) && idx.indexOf("var VER = '" + vjson.crm_version + "'") > -1 && sw.indexOf('ptf-crm-' + vjson.crm_version) > -1);

SECTION('استاتیک: نرمال‌سازی سال');
T('normFiscalYear تعریف و در نقاط ورود اعمال شد',
  /function normFiscalYear\(/.test(fc) &&
  /ptfFiscalData = function \(year\) \{\n    year = normFiscalYear/.test(fc) &&
  /ptfFiscalCashData = function \(year\) \{\n    year = normFiscalYear/.test(fc) &&
  /function fiscalYearBoundsISO\(year\) \{\n    year = normFiscalYear/.test(fc));
T('فیلتر نقدی بدون بازهٔ معتبر بی‌اثر نمی‌ماند (bounds همیشه پر)', fc.indexOf('year = normFiscalYear(year); /* v34.0.5-alpha */\n    var startISO') > -1);
T('سلکتور سال (بدون input دستی سال)', fc.indexOf('<select onchange="window._fiscalYear=this.value;ptfFiscalRender()"') > -1 && fc.indexOf('onchange="window._fiscalYear=this.value.trim()') === -1);
T('فیلد درصد برچسب دارد و از ptfFiscalPctChange استفاده می‌کند', fc.indexOf('٪ سهم تقسیم سود:') > -1 && fc.indexOf('window.ptfFiscalPctChange = function (el)') > -1);
T('دکمه و تابع خروجی PDF موجود است', fc.indexOf('onclick="ptfFiscalPdf()"') > -1 && fc.indexOf('window.ptfFiscalPdf = function ()') > -1 && fc.indexOf('@page{size:A4') > -1);
T('ستون‌های علی‌الحساب در داشبورد و گزارش', fc.indexOf('علی‌الحساب/بدهی سال') > -1 && fc.indexOf('<th>علی‌الحساب سال</th>') > -1 && fc.indexOf('s.advYear || 0') > -1 && fc.indexOf('s.settleYear') > -1);

SECTION('رفتاری — آماده‌سازی');
global.window = global;
global._role = 'chairman';
global.curRole = function () { return global._role; };
global.curSession = function () { return { user: 'u1', name: 'حامد' }; };
global.roleDef = function () { return { finance: true }; };
global._auditRows = []; global.audit = function (m, d) { global._auditRows.push([m, d]); };
global._toasts = []; global.ptfToast = function (m) { global._toasts.push(m); };
global._alerts = []; global.alert = function (m) { global._alerts.push(String(m)); };
global.confirm = function () { return true; };
global._promptDocs = [];
global.window.open = function () {
  var w = { _doc: '', document: { write: function (s) { w._doc += s; }, close: function () {}, set title(v) { w._title = v; }, get title() { return w._title; } }, focus: function () {}, print: function () { w._printed = true; } };
  global._promptDocs.push(w); return w;
};
global.document = { getElementById: function (id) { if (id === 'fiscalBox') return { outerHTML: '' }; return null; }, body: { insertAdjacentHTML: function (pos, h) { global._modal = h; } }, title: 'CRM' };
global.ptfProjectProfitIRR = function () { return { ok: true, complete: true, warnings: [], sellIrr: 2000, buyIrr: 1000, buyPendingFx: [], profit: 1000, pct: 50 }; };
global.ptfOpexSum = function () { return { total: 0, byCat: {} }; };
global.ptfShareholderBalance = function (cd) { return { credit: 0, debit: 0, petty: 0, net: 0 }; };
global.ptfJToISO = null; /* شامل حالت نبود date-kit هم می‌شود */
eval(fc);

global.ptfJToISO = function (j) {
  var m = String(j).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).match(/(\d{4})[\s\/-](\d{1,2})[\s\/-](\d{1,2})/);
  if (!m) return '';
  var jy = +m[1], jm = +m[2], jd = +m[3];
  /* Jalali→Gregorian دقیق برای ۱/۱ (آزمون فقط مرز سال می‌خواهد): 1404→2025-03-21، 1405→2026-03-21، 1406→2027-03-21 */
  var map = { 1403: '2024-03-20', 1404: '2025-03-21', 1405: '2026-03-21', 1406: '2027-03-21' };
  if (jm === 1 && jd === 1 && map[jy]) return map[jy];
  return map[jy] ? map[jy] : '';
};

setData('ptf_crm_projects', [{ no: 'P-1405', offerNo: 'CO-1', buyerCo: 'الف', closedAt: '1405/05/01' }]);
setData('ptf_crm_deals', []);
setData('ptf_crm_invoices', [
  { cd: 'I1', no: 'INV1', amount: 1000, t: '1405/06/01', payments: [{ amt: 400, date: '2026-08-01' }] }
]);
setData('ptf_crm_shareholders', [{ cd: 'S1', name: 'حامد', pct: 100, active: true }]);
setData('ptf_crm_sharetx', [
  { cd: 'X1', shCd: 'S1', shName: 'حامد', type: 'draw', amt: 250, t: '1405/02/10 10:00', month: '1405/02', by: 'حامد' },
  { cd: 'X2', shCd: 'S1', shName: 'حامد', type: 'draw', amt: 500, t: '1404/11/05 10:00', month: '1404/11', by: 'حامد' }
]);
setData('ptf_crm_fiscal_snapshots', []);
setData('ptf_crm_petty', []);
setData('ptf_crm_cheques_received', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_cheques_issued', []);
setData('ptf_crm_payables', []);

SECTION('رفتاری: فیلتر سال (۱۴۰۴ باید صفر باشد)');
var c1405 = ptfFiscalCashData('1405');
T('۱۴۰۵ وصولی دارد', c1405.receipts === 400);
var c1404 = ptfFiscalCashData('۱۴۰۴'); /* ورودی فارسی — سناریوی کارفرما */
T('«۱۴۰۴» (ارقام فارسی) → فیلتر فعال و وصولی صفر', c1404.receipts === 0 && c1404.year === '1404');
var c1404b = ptfFiscalCashData('1404');
T('«1404» لاتین → وصولی صفر', c1404b.receipts === 0);
var d1404 = ptfFiscalData('۱۴۰۴');
T('سود تعهدی ۱۴۰۴ صفر و بدون پروژه', d1404.projectProfit === 0 && d1404.projects.length === 0);
T('بازهٔ ۱۴۰۴ با ورودی فارسی معتبر است (خروجی‌ها هم صفرند)', c1404.outflowsTotal === 0 && c1404.netCash === 0);

SECTION('رفتاری: نرمال‌سازی درصد + علی‌الحساب');
T('ptfFiscalPctChange «۶۰» فارسی → عدد ۶۰', (function(){ window._fiscalDistPct = null; global.document.getElementById = function(){ return null; }; window.ptfFiscalPctChange({ value: '۶۰' }); return window._fiscalDistPct === 60; })());
var dist = ptfFiscalCashDistribution('1405', 60);
T('علی‌الحساب ۱۴۰۵ فقط ۲۵۰ است (نه ۵۰۰)', dist.shareholders[0].advYear === 250);
T('مانده قابل تسویه = سهم ناخالص − علی‌الحساب', dist.shareholders[0].settleYear === dist.shareholders[0].gross - 250);
T('جمع علی‌الحساب سال گزارش می‌شود', dist.advYearTotal === 250);
var dist1404 = ptfFiscalCashDistribution('۱۴۰۴', 60);
T('در ۱۴۰۴ علی‌الحساب ۵۰۰ و توزیع صفر', dist1404.shareholders[0].advYear === 500 && dist1404.distributable === 0);

SECTION('رفتاری: خروجی PDF');
global._alerts = [];
// چاپ سند داخل setTimeout(...,450) صدا زده می‌شود؛ تایمر را همگام می‌کنیم تا قبل از assert اجرا شده باشد
global.setTimeout = function (fn) { try { fn(); } catch (e) {} return 0; };
ptfFiscalPdf();
var doc = (global._promptDocs[0] || {})._doc || '';
T('سند PDF ساخته و چاپ شد', !!doc && global._promptDocs[0]._printed === true);
T('سربرگ شرکت + وضعیت قفل در سند است', doc.indexOf('پیشرو تجهیز فرتاک') > -1 && doc.indexOf('هنوز قفل نشده') > -1);
T('ستون علی‌الحساب در سند چاپی هست', doc.indexOf('علی‌الحساب سال') > -1);
T('role=sales خروجی PDF نمی‌گیرد', (function(){ global._role = 'sales'; global._promptDocs = []; global._alerts = []; ptfFiscalPdf(); return global._promptDocs.length === 0 && global._alerts.some(function(a){return a.indexOf('فقط ادمین')>-1;}); })());

global._role = 'chairman';
SECTION('رفتاری: قفل سال با ورودی فارسی — snapshot ۱۴۰۴ واقعاً صفر است');
window._fiscalYear = '۱۴۰۴';
ptfFiscalLock();
var snaps = getData('ptf_crm_fiscal_snapshots');
T('snapshot ۱۴۰۴ با سال لاتین ذخیره شد', snaps.length === 1 && snaps[0].year === '1404');
T('snapshot ۱۴۰۴ درآمد/پروژه صفر دارد', snaps[0].data.receipts === 0 && (snaps[0].data.projects || []).length === 0);

DONE('tester301-v34.0.5-alpha');
