/* CHQ-MOD-001 — ماژول مستقل چک (v33.4.9): صادره/وارده + عملیات + مهاجرت نرم */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mod = fs.readFileSync(path.join(BASE, 'cheque-module.js'), 'utf-8');
var panel = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var finhub = fs.readFileSync(path.join(BASE, 'financehub.js'), 'utf-8');
var rbac = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.faDateTime = function () { return '1405/05/10 12:00'; };
global.genCode = function (p) { return p + '-' + (++global._cdc); };
global._cdc = 0;
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl(), addEventListener: function () {}
};
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });

eval.call(global, mod);
eval.call(global, panel);

setData('ptf_crm_cheques_issued', []);
setData('ptf_crm_cheques_received', []);
setData('ptf_crm_cheques', []);

SECTION('ساختار');
T('توابع ماژول موجودند', typeof ptfChequeCreate === 'function' && typeof ptfChequeIssued === 'function' && typeof ptfChequeReceived === 'function' && typeof ptfChequeAll === 'function' && typeof ptfChequeSplitMigrate === 'function');
T('تب چک در هاب مالی هست', finhub.indexOf("btn('cheque', '🧾 چک‌ها'") > -1 && finhub.indexOf("show('chequeBox', t === 'cheque')") > -1);
T('پنل چک در buildPetty hook هست', finhub.indexOf('ptfChequePanelHtml') > -1);

SECTION('ایجاد — صادره و وارده در کلیدهای جدا');
var iss = ptfChequeCreate('issued', { no: 'CH-1', sayad: 'CH-1', amt: 500000, toWhom: 'تامین الف', kind: 'finance' });
var rec = ptfChequeCreate('received', { no: 'CH-2', sayad: 'CH-2', amt: 300000, payerName: 'مشتری ب' });
T('چک صادره در issued است نه received', ptfChequeIssued().length === 1 && ptfChequeReceived().length === 1 && ptfChequeIssued()[0].cd === iss.cd);
T('direction درست ذخیره شد', ptfChequeIssued()[0].direction === 'issued' && ptfChequeReceived()[0].direction === 'received');
T('نمای یکپارچه هر دو را نشان می‌دهد', ptfChequeAll().length === 2);

SECTION('ضمانت → صادره (تصویب)');
var guar = ptfChequeCreate('issued', { no: 'CH-3', amt: 1000000, kind: 'guarantee' });
T('چک ضمانت در issued است و direction=issued', ptfChequeIssued().length === 2 && guar.direction === 'issued');

SECTION('عملیات وارده');
var r2 = ptfChequeReceived().filter(function (x) { return x.no === 'CH-2'; })[0];
var e = ptfChequeEndorse(r2.cd, 'تامین ج', 'انتقال');
T('انتقال → endorsed', e.ok && ptfChequeReceived().filter(function (x) { return x.cd === r2.cd; })[0].st === 'endorsed' && ptfChequeReceived().filter(function (x) { return x.cd === r2.cd; })[0].endorseTo === 'تامین ج');
var b = ptfChequeBounce(r2.cd, 'عدم موجودی');
T('برگشتی از endorsed مجاز است (چک منتقل‌شده هم می‌تواند برگشت بخورد)', b.ok && ptfChequeReceived().filter(function (x) { return x.cd === r2.cd; })[0].st === 'bounced' && ptfChequeReceived().filter(function (x) { return x.cd === r2.cd; })[0].bounceReason === 'عدم موجودی');
var vt = ptfChequeVoidTransfer(r2.cd, 'لغو انتقال');
T('بازگشت انتقال فقط از endorsed ممکن است (الان bounced است → رد)', !vt.ok);
/* وصول از bounced رد */
var col = ptfChequeCollect(r2.cd, 'x');
T('وصول از bounced رد می‌شود', !col.ok);
/* چک جدید برای تست بازگشت انتقال */
var r3 = ptfChequeCreate('received', { no: 'CH-4', amt: 100, payerName: 'مشتری پ' });
var e2 = ptfChequeEndorse(r3.cd, 'تامین د');
var vt2 = ptfChequeVoidTransfer(r3.cd, 'لغو');
T('بازگشت انتقال از endorsed → open', vt2.ok && ptfChequeReceived().filter(function (x) { return x.cd === r3.cd; })[0].st === 'open');
var b3 = ptfChequeBounce(r3.cd, 'بدون موجودی');
T('برگشتی از open → bounced', b3.ok && ptfChequeReceived().filter(function (x) { return x.cd === r3.cd; })[0].st === 'bounced');

SECTION('عملیات صادره');
var c1 = ptfChequeIssued().filter(function (x) { return x.no === 'CH-1'; })[0];
var cl = ptfChequeClearIssued(c1.cd, 'وصول شد');
T('وصول صادره → cleared', cl.ok && ptfChequeIssued().filter(function (x) { return x.cd === c1.cd; })[0].st === 'cleared');
var g1 = ptfChequeIssued().filter(function (x) { return x.no === 'CH-3'; })[0];
var gr = ptfChequeClearIssued(g1.cd, '');
T('وصول ضمانت → retrieved', gr.ok && ptfChequeIssued().filter(function (x) { return x.cd === g1.cd; })[0].st === 'retrieved');
var v = ptfChequeVoidIssued(c1.cd, 'دلیل');
T('ابطال چک وصول‌شده رد می‌شود', !v.ok);

SECTION('مهاجرت نرم (legacy)');
setData('ptf_crm_cheques', [
  { cd: 'OLD-1', no: 'O1', amt: 100, ownership: 'company', kind: 'finance' },
  { cd: 'OLD-2', no: 'O2', amt: 200, ownership: 'third_party', sourceCustomerCd: 'C1' },
  { cd: 'OLD-3', no: 'O3', amt: 300, kind: 'guarantee' }
]);
var moved = ptfChequeSplitMigrate();
T('۳ چک legacy منتقل شد', moved === 3);
T('company → issued', ptfChequeIssued().some(function (x) { return x.cd === 'OLD-1' && x.direction === 'issued'; }));
T('third_party → received', ptfChequeReceived().some(function (x) { return x.cd === 'OLD-2' && x.direction === 'received'; }));
T('guarantee → issued', ptfChequeIssued().some(function (x) { return x.cd === 'OLD-3' && x.direction === 'issued'; }));
T('کلید legacy دیگر چیزی ندارد', (getData('ptf_crm_cheques') || []).length === 0);
T('مهاجرت مجدد صفر است (idempotent)', ptfChequeSplitMigrate() === 0);

SECTION('همگام/بکاپ/سرور — کلیدهای جدید');
var sync = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bak = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var api = fs.readFileSync(path.resolve(BASE, '../api/crm.php'), 'utf-8');
T('کلیدهای issued/received در sync/backup/api هست', sync.indexOf('ptf_crm_cheques_issued') > -1 && sync.indexOf('ptf_crm_cheques_received') > -1 && bak.indexOf('ptf_crm_cheques_issued') > -1 && api.indexOf('ptf_crm_cheques_issued') > -1 && api.indexOf('ptf_crm_cheques_received') > -1);

SECTION('گام ۴ — وصول مشتری با چک → چک وارده (rbac.js savePay)');
T('فرم وصولی فیلدهای چک دارد (شماره/سررسید/بانک)', rbac.indexOf('nPayChNo') > -1 && rbac.indexOf('nPayChDue') > -1 && rbac.indexOf('nPayChBank') > -1 && rbac.indexOf('nPayChWrap') > -1);
T('savePay با روش چک، ptfChequeCreate(received) را صدا می‌زند و chequeCd لینک می‌شود', rbac.indexOf("window.ptfChequeCreate('received'") > -1 && rbac.indexOf('payRec.chequeCd = ch.cd') > -1);
T('بدون شماره صیادی، وصول چک مسدود است', rbac.indexOf('شماره/شناسه صیادی الزامی') > -1);

SECTION('یکپارچه‌سازی: یادآور + قفل سال مالی + data-quality');
T('یادآور: چک وارده/صادره پشتیبانی می‌شود (عنوان وارده/صادره)', (function () {
  var chq = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
  return chq.indexOf('سررسید چک وارده') > -1 && chq.indexOf('سررسید چک صادره') > -1 && chq.indexOf("isReceived = rec.direction === 'received'") > -1;
})());
T('پنل: بعد از ثبت چک یادآور صدا زده می‌شود', panel.indexOf("typeof chUpsertReminder === 'function'") > -1);
T('پنل: عملیات وصول/انتقال گارد قفل سال مالی دارند', panel.indexOf('ptfFiscalYearLocked') > -1);
T('data-quality چک‌ها را از ptfChequeAll می‌خواند (هر دو کلید)', (function () {
  var dq = fs.readFileSync(path.join(BASE, 'data-quality.js'), 'utf-8');
  return dq.indexOf('window.ptfChequeAll') > -1;
})());

SECTION('اتصال به گردش حساب (تامین‌کننده/مشتری)');
T('supplier-finance: چک از ptfChequeFind خوانده می‌شود', (function () {
  var sf = fs.readFileSync(path.join(BASE, 'supplier-finance.js'), 'utf-8');
  return sf.indexOf('window.ptfChequeFind') > -1 && sf.indexOf('چک صادره (در گردش)') > -1;
})());
T('customer-finance: چک وارده در گردش حساب مشتری نمایش داده می‌شود', (function () {
  var cf = fs.readFileSync(path.join(BASE, 'customer-finance.js'), 'utf-8');
  return cf.indexOf('چک وارده (در گردش)') > -1 && cf.indexOf('window.ptfChequeReceived') > -1;
})());

SECTION('گزارش پنل');
window.ptfChequePanelSub = 'issued';
var rows = ptfChequePanelRows();
T('گزارش صادره ردیف دارد', rows.length >= 2 && rows.every(function (r) { return r.no && r.amt >= 0; }));

DONE('tester215-v3305-cheque-module');
