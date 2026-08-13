/* FIN-WF-006 / FIN-EX-03 — customer receipt reversal without invoice deletion */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ساختار');
T('نسخه v31.6+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=31.6;})());
T('توکن نسخهٔ سرویس‌ورکر هم‌خانواده است', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('هستهٔ ابطال وصولی وجود دارد', rb.indexOf('window.ptfInvoicePayVoid = function') > -1 && rb.indexOf('status: \'reversal\'') > -1);
T('گارد نقش و سال مالی وجود دارد', rb.indexOf('ptfCanInvoicePayVoid') > -1 && rb.indexOf("why: 'locked'") > -1);
T('دلیل و audit ثبت می‌شود', rb.indexOf('voidReason') > -1 && rb.indexOf("audit('وصولی'") > -1);
T('وصولی جدید شناسه و status دارد', rb.indexOf("cd: genCode('RPAY')") > -1 && rb.indexOf("status: 'posted'") > -1);

SECTION('رفتاری');
global.window = global;
global._role = 'accountant';
global.curRole = function(){ return global._role; };
global.curSession = function(){ return { user:'acc1', name:'حسابدار تست' }; };
global.faDate = function(){ return '1405/04/20'; };
global.faDateTime = function(){ return '1405/04/20 10:00'; };
global.genCode = (function(){ var n=0; return function(p){ return p+'-TEST-'+(++n); }; })();
global.audit = function(m,a,r){ global._audit = {m:m,a:a,r:r}; };
global.getData = function(k){ return global._db[k] || []; };
global.setData = function(k,v){ global._db[k] = v; };
global._db = {
  ptf_crm_fiscal_snapshots: [],
  ptf_crm_invoices: [{ cd:'INV-VOID-1', no:'INV-1', invDate:'1405/04/01', amount:1000, payments:[{cd:'RPAY-1',amt:300,how:'حواله',status:'posted',t:'1405/04/10',by:'acc1'}] }]
};
var m = rb.match(/window\.ptfCanInvoicePayVoid = function[\s\S]*?\n};\nwindow\.ptfInvoicePayVoid = function[\s\S]*?\n};/);
T('استخراج هستهٔ قابل‌تست', !!m);
if (m) {
  eval(m[0]);
  var r = ptfInvoicePayVoid('INV-VOID-1', 'RPAY-1', 'اشتباه ثبت');
  var inv = getData('ptf_crm_invoices')[0];
  T('ابطال موفق بدون حذف فاکتور', r.ok === true && inv && inv.no === 'INV-1');
  T('رکورد اصلی باطل و دلیل‌دار شد', inv.payments[0].voided === true && inv.payments[0].voidReason === 'اشتباه ثبت');
  T('رویداد معکوس منفی ثبت شد', inv.payments.length === 2 && inv.payments[1].status === 'reversal' && inv.payments[1].amt === -300 && inv.payments[1].voidRef === 'RPAY-1');
  T('audit قابل استناد ثبت شد', global._audit && global._audit.m === 'وصولی' && global._audit.r === r.reversalCd);
  T('ابطال مجدد مسدود است', ptfInvoicePayVoid('INV-VOID-1', 'RPAY-1', 'دوباره') .why === 'already');
  _db.ptf_crm_invoices[0].payments[0].voided = false; _db.ptf_crm_invoices[0].payments = [{cd:'RPAY-2',amt:100,status:'posted'}];
  _db.ptf_crm_fiscal_snapshots = [{year:'1405',locked:true}];
  T('سال مالی قفل‌شده مانع ابطال است', ptfInvoicePayVoid('INV-VOID-1', 'RPAY-2', 'تست').why === 'locked');
  _role = 'sales'; _db.ptf_crm_fiscal_snapshots = [];
  T('نقش فروش مجاز نیست', ptfInvoicePayVoid('INV-VOID-1', 'RPAY-2', 'تست').why === 'role');
}
DONE('tester163-v3164-invoice-pay-void');
