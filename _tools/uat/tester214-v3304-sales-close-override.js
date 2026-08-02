/* UR-12 — ساده‌سازی مختومهٔ پرونده فروش: تأیید صریح تحویل (بدون ثبت رویداد) + پکینگ‌لیست/تسویه تامین‌کننده فقط هشدار */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.faDateTime = function () { return '1405/05/10 12:00'; };
global.faDate = function () { return '1405/05/10'; };
global.genCode = function (p) { return p + '-1'; };
global.audit = function () {}; global.notify = function () {};
global._archived = null;
global._alerts = [];
global.alert = function (m) { global._alerts.push(String(m)); };

function makeEl(ov) {
  return Object.assign({ value: '', innerHTML: '', textContent: '', style: {}, checked: false,
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

/* استخراج sfCloseAudit + sfCloseSettledCommit + sfArchive (الگوی tester110) */
var mA = sf.match(/window\.sfCloseAudit = function \(r\) \{[\s\S]*?\n  \};/);
eval.call(global, mA[0].replace('window.sfCloseAudit', 'window.sfCloseAudit'));
var mC = sf.match(/window\.sfCloseSettledCommit = function \(cd, settleOpen, settleReason\) \{[\s\S]*?\n  \};/);
eval.call(global, mC[0].replace('window.sfCloseSettledCommit', 'window.sfCloseSettledCommit'));
/* sfArchive برای commit — شبیه‌سازی ساده */
global.sfArchive = function (r, kind, full) { global._archived = { cd: r.cd, kind: kind }; };
global.sfAll = function () { return getData('ptf_crm_deals'); };
global.sfSave = function (l) { setData('ptf_crm_deals', l); };
global.sfDocsOf = function () { return { invoices: [], offers: [], letters: [], supply: [] }; };
global.sfHasInvoice = function () { return true; };
global.sfStageOf = function () { return 3; };
global.sfStageLabel = function () { return ''; };
global.ptfRealBuyStatus = function () { return { has: false, total: 0, full: 0, partial: 0 }; };
global.ptfPayableRemain = function () { return 0; };
global.ptfDocxCoverage = function () { return { total: 0, used: 0, remain: 0 }; };
global.sfFindArchivedProject = function () { return null; };
global.genCode = function (p) { return p + '-X'; };

/* ---------- داده: پروندهٔ بدون تحویل و بدون فاکتور باز ---------- */
var deal = { cd: 'D9', inqNo: 'INQ-9', wonOffer: 'O9', st: 'won', shipEvents: [], qcEvents: [], costEvents: [], docs: [], awardDocs: [{ cd: 'A1' }] };
setData('ptf_crm_deals', [deal]);
setData('ptf_crm_invoices', []);
setData('ptf_crm_payables', []);
setData('ptf_crm_rfqs', []);

SECTION('ساختار');
T('مسیر تأیید صریح تحویل در کد هست', sf.indexOf('deliveryConfirmed') > -1 && sf.indexOf('sfClsDeliv') > -1 && sf.indexOf('closeOverride') > -1);
T('گارد commit حفظ شده (blockers)', sf.indexOf('if (au.blockers.length) return false;') > -1);

SECTION('بدون override → blocker سخت (رفتار قبلی حفظ شد)');
var au1 = sfCloseAudit(deal);
T('بدون تحویل و بدون override: blocker delivery', au1.blockers.length === 1 && au1.blockers[0].id === 'delivery');
T('پکینگ‌لیست فقط هشدار است (نه blocker)', !au1.blockers.some(function (b) { return b.id === 'pl-missing'; }));
T('UR-12: بدهی تامین‌کننده هیچ اثری در کنترل مختومه ندارد (مستقل)', !au1.blockers.some(function (b) { return b.id === 'payable'; }) && !au1.warns.some(function (w) { return w.id === 'payable'; }));

SECTION('استقلال از حساب تامین‌کننده (حتی با بدهی باز)');
setData('ptf_crm_payables', [{ cd: 'PAY-1', inqNo: 'INQ-9', settled: false, amount: 999999 }]);
var auPay = sfCloseAudit(deal);
T('بدهی باز تامین‌کننده در blockers نیست', !auPay.blockers.some(function (b) { return b.id === 'payable'; }));
T('بدهی باز تامین‌کننده در warns نیست', !auPay.warns.some(function (w) { return w.id === 'payable'; }));

SECTION('با override صریح → blocker به هشدار تبدیل می‌شود');
deal.closeOverride = { deliveryConfirmed: true, reason: 'تحویل فیزیکی انجام شده؛ ثبت رویداد فراموش شد', by: 'علی رضایی', t: '1405/05/10 12:00' };
setData('ptf_crm_deals', [deal]);
var au2 = sfCloseAudit(deal);
T('blocker تحویل حذف و به هشدار «تأیید صریح» تبدیل شد', au2.blockers.length === 0 && au2.warns.some(function (w) { return w.id === 'delivery-override'; }));
T('commit با override موفق می‌شود (مختومه انجام می‌شود)', sfCloseSettledCommit('D9', false, '') === true && global._archived && global._archived.cd === 'D9');

SECTION('بدون override → commit رد می‌شود');
var deal2 = { cd: 'D10', inqNo: 'INQ-10', wonOffer: 'O10', st: 'won', shipEvents: [], qcEvents: [], costEvents: [], docs: [], awardDocs: [] };
setData('ptf_crm_deals', [deal2]);
global._archived = null;
T('commit بدون override رد می‌شود (سد برنامه‌ای)', sfCloseSettledCommit('D10', false, '') === false && global._archived === null);

DONE('tester214-v3304-sales-close-override');
