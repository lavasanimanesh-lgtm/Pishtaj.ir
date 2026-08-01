/* tester288 — v33.7.0 (CHQ-PARTY + RECURRING):
 * 1) ذینفع شرطی در ثبت چک (مشتری دارای پرونده باز / تامین‌کننده دارای مطالبه / سایر)
 * 2) اثر مالی چک مالی به محض ثبت (مشتری → فاکتور، تامین‌کننده → بدهی)؛ ضمانت بدون اثر مالی
 * 3) چک ضمانت در پرونده فروش + استرداد + گارد مختومه (با override صریح)
 * 4) BUG-FIX: حقوق سهامدار جدید در ماه جاری (۱۳۰→۹۰) + اعمال خودکار ماهانه
 * 5) چاپ فیزیکی: مبلغ دوم پایین-چپ + حالت گرافیکی درگ
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mod = fs.readFileSync(path.join(BASE, 'cheque-module.js'), 'utf-8');
var panel = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
var prt = fs.readFileSync(path.join(BASE, 'cheque-print.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8');
var opx = fs.readFileSync(path.join(BASE, 'opex.js'), 'utf-8');

/* ---------- استاب‌ها ---------- */
global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.curRole = function () { return 'admin'; };
global.roleDef = function () { return { finance: true }; };
global.faDate = function () { return '1405/05/11'; };
global.faDateTime = function () { return '1405/05/11 10:00'; };
global.faYear = function () { return '1405'; };
global.genCode = function (p) { return p + '-' + (++global._cdc); };
global._cdc = 0;
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };
global.confirm = function () { return true; };
global.prompt = function () { return 'سایر'; };
global.ptfToast = function () {};
global.audit = function () {};
global.notify = function () {};
global.chUpsertReminder = function () {};
global.renderReminders = function () {};
global.ptfNum = function (v) {
  var s = String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^0-9.-]/g, '');
  return +s || 0;
};
global.ptfNumWordsFa = function (n) { return 'هزار و چهارصد و پنج'; };
global.ptfJToISO = function (s) {
  s = String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  return m ? String(+m[1] + 621) + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[3]).padStart(2, '0') : '';
};
global.ptfISOToJ = function (iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? String(+m[1] - 621) + '/' + String(+m[2]).padStart(2, '0') + '/' + String(+m[3]).padStart(2, '0') : iso || '';
};
global.ptfFiscalYearLocked = function () { return false; };
global.ptfFiscalYearOf = function () { return '1405'; };
global.ptfPreviewPrintableDoc = function (title, html, name) { global._lastPrint = { title: title, html: html }; };
global.ptfGoSalesFile = function () {};
global.goPanel = function () {};
function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {},
    remove: function () {}, insertAdjacentHTML: function () {}, setAttribute: function () {},
    addEventListener: function () {}, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    appendChild: function () {}, options: [], checked: false,
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } } }, ov || {});
}
global._domGet = {};
global.document = {
  getElementById: function (id) { return global._domGet[id] || makeEl(); },
  querySelector: function () { return makeEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return makeEl(); },
  head: makeEl(), body: makeEl({ insertAdjacentHTML: function () {} }),
  addEventListener: function () {}
};
global._domGet['panels'] = makeEl({ insertAdjacentHTML: function () {} });
global.window = global;

/* دادهٔ اولیه */
setData('ptf_crm_cheques_issued', []);
setData('ptf_crm_cheques_received', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_customers', [
  { cd: 'C1', co: 'مشتری یک' },
  { cd: 'C2', co: 'مشتری دو' }
]);
setData('ptf_crm_suppliers', [
  { cd: 'S1', co: 'تامین یک' },
  { cd: 'S2', co: 'تامین دو' }
]);
setData('ptf_crm_deals', [
  { cd: 'D1', inqNo: 'INQ-1', buyerCd: 'C1', wonOffer: 'CO-1', st: 'open' },
  { cd: 'D2', inqNo: 'INQ-2', buyerCd: 'C2', wonOffer: 'CO-2', st: 'archived' }
]);
setData('ptf_crm_offers', [
  { no: 'CO-1', buyerCd: 'C1' }, { no: 'CO-2', buyerCd: 'C2' }
]);
setData('ptf_crm_invoices', [
  { cd: 'INV1', no: 'F-1', offerNo: 'CO-1', amount: 500000000, payments: [] },
  { cd: 'INV2', no: 'F-2', offerNo: 'CO-1', amount: 100000000, payments: [{ cd: 'P1', amt: 90000000, status: 'posted' }] },
  { cd: 'INV3', no: 'F-3', offerNo: 'CO-2', amount: 200000000, payments: [] }
]);
setData('ptf_crm_supplier_finance', { schema: 1, invoices: [{ cd: 'SI1', supplierCd: 'S1', amount: 300000000, status: 'posted' }], payments: [], adjustments: [] });

eval.call(global, mod);
eval.call(global, panel);
eval.call(global, prt);
/* shareholders + opex — حذف بوت (setInterval/hook) تا در تست اجرا نشود */
eval.call(global, sh);
var opxClean = opx.replace(/var tries = 0;[\s\S]*$/, 'var tries = 0;\n})();');
eval.call(global, opxClean);

SECTION('فهرست‌های شرطی ذی‌نفع');
T('تامین‌کنندگان دارای مطالبه: فقط S1 (S2 بدون بدهی)', (function () {
  var l = ptfChequeSupOptions();
  return l.length === 1 && l[0].cd === 'S1' && l[0].lb.indexOf('بدهی') > -1;
})());
T('مشتریان دارای پرونده باز: فقط C1 (C2 بایگانی است)', (function () {
  var l = ptfChequeCustOptions();
  return l.length === 1 && l[0].cd === 'C1' && l[0].lb.indexOf('پرونده باز') > -1;
})());
T('فاکتورهای باز مشتری: INV1 (مانده کامل) + INV2 (مانده ۱۰ میلیون)', (function () {
  var l = ptfChequeOpenInvoicesOf('C1');
  return l.length === 2 && l.some(function (i) { return i.cd === 'INV1' && i.remain === 500000000; }) && l.some(function (i) { return i.cd === 'INV2' && i.remain === 10000000; });
})());
T('برچسب دسته ذی‌نفع', ptfChequePartyKind({ supplierCd: 'S1' }) === 'sup' && ptfChequePartyKind({ custCd: 'C1' }) === 'cust' && ptfChequePartyKind({}) === 'other');

SECTION('اثر مالی چک مالی (به محض ثبت)');
var c1 = ptfChequeCreate('issued', { no: 'CH-S1', sayad: 'CH-S1', amt: 100000000, kind: 'finance', supplierCd: 'S1', dueFa: '1405/06/01' });
T('چک صادره مالی → payment در supplier-finance + financialApplied', c1.financial && c1.financial.ok && c1.financial.applied === 'supplier' && c1.financialApplied && getData('ptf_crm_supplier_finance').payments.some(function (p) { return p.chequeCd === c1.cd && p.amount === 100000000 && p.status === 'posted'; }));
T('تاریخ payment چک خالی نیست (باگ بازگشتی faDateTimeL رفع شد)', (function () {
  var p = getData('ptf_crm_supplier_finance').payments.filter(function (x) { return x.chequeCd === c1.cd; })[0];
  return p && p.t && String(p.t).length > 4 && p.dateFa === '1405/06/01';
})());
var c2 = ptfChequeCreate('received', { no: 'CH-R1', sayad: 'CH-R1', amt: 400000000, kind: 'finance', custCd: 'C1', sourceInvoiceCd: 'INV1', dueFa: '1405/06/01' });
T('چک وارده مالی با فاکتور → payment روی فاکتور', c2.financial && c2.financial.ok && c2.financial.applied === 'invoice' && getData('ptf_crm_invoices').filter(function (i) { return i.cd === 'INV1'; })[0].payments.some(function (p) { return p.chequeCd === c2.cd && p.amt === 400000000; }));
var c3 = ptfChequeCreate('received', { no: 'CH-R2', sayad: 'CH-R2', amt: 5000000, kind: 'finance', custCd: 'C1', dueFa: '1405/06/01' });
T('چک وارده بدون فاکتور → در گردش (بدون اثر مالی)', !c3.financialApplied && !c3.financial.ok);
var cc = ptfChequeCollect(c3.cd, 'وصول شد');
T('وصول چک بدون فاکتور → اثر مالی روی اولین فاکتور باز مشتری', cc.financial && cc.financial.ok && (function () {
  var invs = getData('ptf_crm_invoices');
  return invs.filter(function (i) { return i.cd === 'INV1'; })[0].payments.some(function (p) { return p.chequeCd === c3.cd; });
})());

SECTION('چک ضمانت — بدون اثر مالی + لینک پرونده + استرداد');
var g1 = ptfChequeCreate('issued', { no: 'CH-G1', sayad: 'CH-G1', amt: 200000000, kind: 'guarantee', guarType: 'advance', dealCd: 'D1', supplierCd: 'S1', dueFa: '1405/06/01' });
T('ضمانت: effect مالی ندارد (guarantee_no_finance) و dealCd ذخیره شد', g1.kind === 'guarantee' && g1.direction === 'issued' && g1.dealCd === 'D1' && g1.financial && g1.financial.why === 'guarantee_no_finance' && !g1.financialApplied);
T('ضمانت: payment تامین‌کننده نساخت', getData('ptf_crm_supplier_finance').payments.filter(function (p) { return p.chequeCd === g1.cd; }).length === 0);
var ret = ptfChequeClearIssued(g1.cd, 'پایان پروژه');
T('استرداد ضمانت → st=retrieved', ret.ok && ret.cheque.st === 'retrieved');

SECTION('گارد مختومه: ضمانت باز');
var g2 = ptfChequeCreate('issued', { no: 'CH-G2', sayad: 'CH-G2', amt: 50000000, kind: 'guarantee', guarType: 'performance', dealCd: 'D1', dueFa: '1405/07/01' });
var dealRec = { cd: 'D1', inqNo: 'INQ-1', wonOffer: 'CO-1', st: 'open', shipEvents: [{ type: 'delivered' }], docs: [], awardDocs: ['x'] };
/* sfCloseAudit از sfDocsOf/توابع داخلی salesfiles استفاده می‌کند — شبیه‌سازی حداقلی با استخراج تابع */
var sfAuditSrc = sf.match(/window\.sfCloseAudit = function[\s\S]*?\n  \};/);
T('sfCloseAudit در salesfiles موجود است', !!sfAuditSrc);
T('کد گارد ضمانت در sfCloseAudit هست', sf.indexOf("b.id === 'guarantee'") > -1 && sf.indexOf('guaranteeConfirmed') > -1);
T('projects.js نمایش ضمانت‌های پرونده را دارد', fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8').indexOf('prjGuaranteeChequesHtml') > -1);
T('cheque-panel: دکمه «استرداد ضمانت» + فرم ذینفع شرطی + نوع ضمانت', panel.indexOf('🏆 استرداد ضمانت') > -1 && panel.indexOf('ptfChNParty') > -1 && panel.indexOf('ptfChNGuarType') > -1 && panel.indexOf('ptfChNDeal') > -1 && panel.indexOf('ptfChequeSupOptions') > -1 && panel.indexOf('ptfChequeCustOptions') > -1);
T('دستیار AI: نوع ضمانت + پرونده + فهرست‌های شرطی', panel.indexOf('ptfChAiGuarType') > -1 && panel.indexOf('ptfChAiDeal') > -1 && panel.indexOf('ptfChAiKindUi') > -1);

SECTION('BUG-FIX: حقوق سهامدار جدید در ماه جاری (۱۳۰→۹۰)');
setData('ptf_crm_shareholders', [
  { cd: 'SH1', name: 'سهامدار یک', pct: 30, duty: true, salary: 30000000, active: true },
  { cd: 'SH2', name: 'سهامدار دو', pct: 30, duty: true, salary: 30000000, active: true },
  { cd: 'SH3', name: 'سهامدار سه', pct: 30, duty: true, salary: 30000000, active: true }
]);
setData('ptf_crm_sharetx', []);
setData('ptf_crm_opex', []);
global._shareMonth = '1405/05';
/* شبیه‌سازی «ثبت حقوق ماه» قبلی برای سه سهامدار */
['SH1', 'SH2', 'SH3'].forEach(function (cd) {
  var s = getData('ptf_crm_shareholders').filter(function (x) { return x.cd === cd; })[0];
  global.ptfShareEnsureSalary(s, '1405/05');
});
T('۳ سهامدار قبلی: ۹۰ میلیون حقوق ثبت شده', (function () {
  return getData('ptf_crm_opex').filter(function (o) { return o.month === '1405/05'; }).reduce(function (s, o) { return s + (+o.amt || 0); }, 0) === 90000000;
})());
/* سهامدار چهارم (۴۰ میلیون) اضافه می‌شود — قبلاً حقوقش ثبت نمی‌شد */
var sh4 = { cd: 'SH4', name: 'سهامدار چهار', pct: 10, duty: true, salary: 40000000, active: true };
setData('ptf_crm_shareholders', getData('ptf_crm_shareholders').concat([sh4]));
var ens = global.ptfShareEnsureSalary(sh4, '1405/05');
T('سهامدار جدید موظف → حقوق همان لحظه ثبت شد (ریشه‌کنی ۱۳۰→۹۰)', ens.created && (function () {
  return getData('ptf_crm_opex').filter(function (o) { return o.month === '1405/05'; }).reduce(function (s, o) { return s + (+o.amt || 0); }, 0) === 130000000;
})());
T('غیرموظف‌شدن → حقوق از ماه جاری حذف می‌شود', (function () {
  sh4.duty = false; sh4.salary = 0;
  var r = global.ptfShareEnsureSalary(sh4, '1405/05');
  return r.removed && getData('ptf_crm_opex').filter(function (o) { return o.month === '1405/05'; }).reduce(function (s, o) { return s + (+o.amt || 0); }, 0) === 90000000;
})());

SECTION('اعمال خودکار ماهانه (حقوق + قالب‌ها)');
setData('ptf_crm_settings', { opexTpl: [{ id: 'T1', cat: 'اجاره‌بها', amt: 25000000, desc: 'اجاره دفتر' }, { id: 'T2', cat: 'بیمه', amt: 5000000, desc: 'بیمه ماهانه' }] });
try { localStorage.removeItem('ptf_auto_recurring_last'); } catch (e) {}
setData('ptf_crm_opex', []);
setData('ptf_crm_sharetx', []);
var ar = ptfAutoApplyRecurring();
T('خودکار: حقوق ۴ سهامدار + ۲ قالب ثبت شد', ar.salaries === 4 && ar.tpls === 2 && getData('ptf_crm_opex').length === 6);
T('خودکار: رکوردها برچسب autoApplied دارند', getData('ptf_crm_opex').filter(function (o) { return o.tplId; }).every(function (o) { return o.autoApplied === true; }));
T('خودکار: یک‌بار در ماه (اجرای دوم چیزی اضافه نمی‌کند)', (function () {
  var ar2 = ptfAutoApplyRecurring();
  return ar2.salaries === 0 && ar2.tpls === 0 && getData('ptf_crm_opex').length === 6;
})());
T('کد خودکارسازی در opex.js و فراخوانی در بوت هست', opx.indexOf('ptfAutoApplyRecurring') > -1 && opx.indexOf('auto-recurring') > -1 && opx.indexOf('🤖 خودکار') > -1);

SECTION('چاپ فیزیکی: مبلغ دوم پایین-چپ + حالت گرافیکی');
T('چیدمان: amt2 (پایین چپ) در پیش‌فرض', /amt2Top: 48, amt2Left: 8/.test(prt) && /amt2Color: '#111827'/.test(prt));
_domGet['chqpD'] = makeEl({ value: '1405/04/21' });
_domGet['chqpTo'] = makeEl({ value: 'شرکت آلفا' });
_domGet['chqpNid'] = makeEl({ value: '' });
_domGet['chqpAmt'] = makeEl({ value: '1250000' });
_domGet['chqpNote'] = makeEl({ value: '' });
global._lastPrint = null;
chqPrintPreview('single');
T('HTML چاپ: دو مبلغ (بالا قرمز + پایین چپ) دارد', (function () {
  if (!global._lastPrint) return false;
  var h = global._lastPrint.html;
  return h.indexOf('f-amt') > -1 && h.indexOf('f-amt2') > -1 && h.indexOf('color:#b91c1c') > -1;
})());
T('حالت گرافیکی: توابع درگ + رندر برگه + هم‌گام', prt.indexOf('chqGvRender') > -1 && prt.indexOf('chqGvStart') > -1 && prt.indexOf('chqGvMove') > -1 && prt.indexOf('chqpGv') > -1 && prt.indexOf('GV_SCALE') > -1);
T('ذخیره چیدمان: amt2 در لیست فیلدها', prt.indexOf("'amt2Top', 'amt2Left', 'amt2Size'") > -1);

DONE('tester288-cheque-party-recurring');
