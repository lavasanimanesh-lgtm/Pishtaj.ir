/* tester310 — v34.0.14-alpha (فاز ۱۱: ویرایش/حذف چک + اصلاح/حذف آنی اثر مالی + لینک کیفیت داده)
   پوشش:
     ۱) ویرایش چک (مبلغ/شماره/ذی‌نفع) — دکمه در پنل چک
     ۲) اصلاح آنی اثر مالی روی حساب تأمین‌کننده هنگام ویرایش مبلغ چک مالی
     ۳) حذف کامل چک + حذف کامل payment/گردش حساب
     ۴) لینک تب کیفیت داده → مودال اصلاح همان چک */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cm = fs.readFileSync(path.join(BASE, 'cheque-module.js'), 'utf-8');
var cp = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var dq = fs.readFileSync(path.join(BASE, 'data-quality.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v[0-9.]+-alpha$/.test(vjson.crm_version));

SECTION('هسته: ویرایش/حذف چک (cheque-module)');
T('ptfChequeUpdate تعریف شده', cm.indexOf('window.ptfChequeUpdate = function') > -1);
T('ptfChequeDelete تعریف شده', cm.indexOf('window.ptfChequeDelete = function') > -1);
T('ptfChequeApplyFinancialAmount تعریف شده (اصلاح آنی مبلغ اثر مالی)', cm.indexOf('window.ptfChequeApplyFinancialAmount = function') > -1);
T('حذف چک، payment تامین‌کننده را هم کامل حذف می‌کند', cm.indexOf("d.payments = (d.payments || []).filter(function (p) { return !(p.chequeCd === cd); })") > -1);

SECTION('UI: پنل چک (cheque-panel)');
T('دکمهٔ ویرایش چک در ردیف چک صادره', cp.indexOf('ptfChequeEditUi') > -1 && cp.indexOf('✏️') > -1);
T('دکمهٔ حذف چک در ردیف چک صادره', cp.indexOf('ptfChequeDeleteUi') > -1 && cp.indexOf('🗑') > -1);
T('مودال ویرایش چک (ptfChequeEditUi) هست', cp.indexOf('window.ptfChequeEditUi = function') > -1);
T('مودال حذف چک (ptfChequeDeleteUi) هست', cp.indexOf('window.ptfChequeDeleteUi = function') > -1);
T('توجه اثر مالی در مودال ویرایش نمایش داده می‌شود', cp.indexOf('اثر مالی روی حساب تأمین‌کننده') > -1);

SECTION('لینک کیفیت داده → چک');
T('کیفیت داده از ptfChequeEditFromQuality استفاده می‌کند', dq.indexOf('ptfChequeEditFromQuality') > -1 && dq.indexOf("d.type === 'cheque'") > -1);
T('ptfChequeEditFromQuality تعریف شده (به تب چک رفته و مودال ویرایش را باز می‌کند)', cp.indexOf('window.ptfChequeEditFromQuality = function') > -1);

SECTION('رفتار: اصلاح مبلغ اثر مالی + حذف');
(function () {
  global.window = global;
  global.curRole = function () { return 'admin'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.ptfJToISO = function () { return '2026-05-21'; };
  global.ptfISOToJ = function () { return '1405/03/01'; };
  global.ptfNum = function (v) { return +String(v || '').replace(/[^\d.-]/g, '') || 0; };
  global.ptfToast = function () {};
  eval.call(global, cm);
  setData('ptf_crm_cheques_issued', [{ cd: 'CHQ-1', no: 'CHQ-1', sayad: 'CHQ-1', amt: 5000000, direction: 'issued', ownership: 'company', kind: 'finance', st: 'open', supplierCd: 'SUP-1', supplierName: 'تامین الف', toWhom: 'تامین الف' }]);
  setData('ptf_crm_cheques_received', []);
  setData('ptf_crm_supplier_finance', { schema: 1, invoices: [], payments: [
    { cd: 'SFPAY-1', supplierCd: 'SUP-1', amount: 5000000, amountIrr: 5000000, method: 'cheque', chequeCd: 'CHQ-1', allocations: [], unallocated: 5000000, status: 'posted' }
  ], adjustments: [] });
  setData('ptf_crm_payables', []);
  /* ویرایش مبلغ چک به 7م → اثر مالی آنی */
  window.ptfChequeUpdate('CHQ-1', { amt: 7000000 });
  var fin = window.ptfChequeApplyFinancialAmount('CHQ-1', 7000000);
  var sf = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance'));
  T('اثر مالی تامین‌کننده پس از ویرایش مبلغ، آنی اصلاح شد (5م→7م)', fin.ok && fin.updated && sf.payments[0].amount === 7000000);
  /* حذف چک → payment حذف کامل */
  var del = window.ptfChequeDelete('CHQ-1');
  var ch = window.ptfChequeFind('CHQ-1');
  var sf2 = JSON.parse(localStorage.getItem('ptf_crm_supplier_finance'));
  T('حذف چک، چک و payment/گردش را کامل حذف کرد', del.ok && !ch && (sf2.payments || []).length === 0);
})();

DONE('tester310-v34.0.14-alpha');
