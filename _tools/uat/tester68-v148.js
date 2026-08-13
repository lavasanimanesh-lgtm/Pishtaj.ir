/* tester68 — v14.8 (اسپرینت «تحلیل مدیریتی»: US-349/350/351) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var ins = fs.readFileSync(path.join(BASE, 'insights.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

/* ===== محیط ===== */
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.audit = function () {}; global.notify = function () {};
global.alert = function (m) { global._lastAlert = String(m); };
global.confirm = function () { return true; };
global.window = global;
global.fetch = function () { return { then: function () { return { catch: function () {} }; }, catch: function () {} }; };

SECTION('US-349: دلایل استاندارد باخت — کد');
T('SF_LOST_REASONS پنج دلیل استاندارد', ['قیمت', 'زمان تحویل', 'برند', 'انصراف مشتری', 'سایر'].every(function (s) { return sf.indexOf(s) > -1; }) && sf.indexOf('window.SF_LOST_REASONS') > -1);
T('مودال انتخاب دلیل جایگزین prompt متن آزاد شد', sf.indexOf('sfLostModal') > -1 && sf.indexOf('sfLostReason') > -1 && sf.indexOf("prompt('🚫 مختومه بدون فاکتور") === -1);
T('توضیح تکمیلی اختیاری', sf.indexOf('sfLostNote') > -1 && sf.indexOf('توضیح تکمیلی (اختیاری)') > -1);
T('sfCloseLost برنامه‌ای/تست‌پذیر', sf.indexOf('window.sfCloseLost = function (cd, reasonId, note)') > -1);
T('closeReason استاندارد روی رکورد بایگانی', sf.indexOf('closeReason: reasonId') > -1 && sf.indexOf("closeKind === 'settled' ? 'won'") > -1);
T('سازگاری عقب‌رو: sfArchive امضای قدیم را می‌پذیرد (reasonId اختیاری)', sf.indexOf('function sfArchive(r, closeKind, keepDocs, why, reasonId)') > -1);

SECTION('US-349: رفتار اجرایی مختومه با دلیل استاندارد');
(function () {
  var iife = sf.indexOf('(function () {');
  var code = sf; /* اجرای کل ماژول در sandbox */
  global.document = { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, createElement: function () { return { style: {} }; } };
  global.setInterval = function () { return 0; };
  global.clearInterval = function () {};
  global.setTimeout = function (f) { return 0; };
  setData('ptf_crm_deals', [{ cd: 'DEAL-1', inqNo: 'INQ-100', buyerCo: 'شرکت الف', docs: [], st: 'open', t: 'x' }]);
  setData('ptf_crm_offers', []); setData('ptf_crm_letters', []); setData('ptf_crm_invoices', []);
  setData('ptf_crm_projects', []);
  eval(code);
  T('ماژول salesfiles بدون خطا اجرا شد', typeof global.sfCloseLost === 'function' && typeof global.ptfSfDueState === 'function');
  sfCloseLost('DEAL-1', 'price', 'رقیب ۱۲٪ ارزان‌تر');
  var prjs = getData('ptf_crm_projects');
  T('پرونده با دلیل استاندارد بایگانی شد', prjs.length === 1 && prjs[0].closeKind === 'lost');
  T('closeReason=price ثبت شد', prjs[0].closeReason === 'price');
  T('closeWhy = برچسب + توضیح', prjs[0].closeWhy.indexOf('قیمت') === 0 && prjs[0].closeWhy.indexOf('رقیب') > -1);
  T('پرونده از deals حذف شد', getData('ptf_crm_deals').length === 0);
  /* دلیل نامعتبر → fallback به «سایر» */
  setData('ptf_crm_deals', [{ cd: 'DEAL-2', inqNo: 'INQ-101', buyerCo: 'ب', docs: [], st: 'open' }]);
  sfCloseLost('DEAL-2', 'xyz', '');
  var p2 = getData('ptf_crm_projects').filter(function (p) { return p.inqNo === 'INQ-101'; })[0];
  T('دلیل نامعتبر → fallback به «سایر»', p2 && p2.closeReason === 'other');
})();

SECTION('US-350: قیف تبدیل داشبورد — کد');
T('ماژول insights.js در index/sw ثبت شد', /insights\.js\?v=[0-9.]+/.test(idx) && sw.indexOf("'./insights.js'") > -1);
T('ptfFunnelData از داده موجود (بدون کلید جدید)', ins.indexOf('window.ptfFunnelData') > -1 && ins.indexOf("getData('ptf_crm_leads')") > -1 && ins.indexOf("getData('ptf_crm_rfqs')") > -1);
T('پیشنهاد/برنده متمایز بر اساس درخواست (نه شمارش رویژن)', ins.indexOf('offSet[o.inqNo || o.no] = 1') > -1 && ins.indexOf('wonSet[') > -1);
T('برنده = CO برنده یا بایگانی تسویه‌شده', ins.indexOf("o.st === 'won'") > -1 && ins.indexOf("p.closeKind === 'settled'") > -1);
T('hook داشبورد: قیف قبل از details آمار قدیم', ins.indexOf("h.indexOf('<details')") > -1 && ins.indexOf('_insDashHooked') > -1);
T('نرخ تبدیل مرحله‌ای + کل', ins.indexOf('cLeadRfq') > -1 && ins.indexOf('cOffWon') > -1 && ins.indexOf('cTotal') > -1);

SECTION('US-350: رفتار اجرایی قیف');
(function () {
  eval(ins);
  setData('ptf_crm_leads', [{}, {}, {}, {}]); /* 4 سرنخ */
  setData('ptf_crm_rfqs', [{ cd: 'R1' }, { cd: 'R2' }]); /* 2 درخواست */
  setData('ptf_crm_offers', [
    { no: 'TO-1', kind: 'TO', inqNo: 'R1' },
    { no: 'CO-1', kind: 'CO', inqNo: 'R1', st: 'won' },
    { no: 'CO-2', kind: 'CO', inqNo: 'R2', st: 'sent' }
  ]);
  setData('ptf_crm_projects', []);
  var d = ptfFunnelData();
  T('شمارش سرنخ/درخواست', d.leads === 4 && d.rfqs === 2);
  T('پیشنهاد متمایز per درخواست = ۲ (نه ۳ سند)', d.offers === 2);
  T('برنده = ۱ (CO-1 won)', d.won === 1);
  T('نرخ‌ها: 2/4=50٪ و 1/2=50٪', d.cLeadRfq === 50 && d.cOffWon === 50);
  var html = ptfFunnelHtml();
  T('HTML قیف شامل ۴ مرحله + نرخ کل', html.indexOf('🎯 سرنخ') > -1 && html.indexOf('🏆 برنده') > -1 && html.indexOf('نرخ تبدیل کل') > -1);
  /* برنده از بایگانی settled هم شمرده شود */
  setData('ptf_crm_projects', [{ no: 'ARC-R2', inqNo: 'R2', state: 'archived', closeKind: 'settled' }]);
  T('بایگانی تسویه‌شده هم برنده حساب می‌شود', ptfFunnelData().won === 2);
})();

SECTION('US-349: گزارش Win/Loss — رفتار اجرایی');
(function () {
  setData('ptf_crm_projects', [
    { no: 'A1', inqNo: 'I1', state: 'archived', closeKind: 'settled', stats: { totalCO: 1000 } },
    { no: 'A2', inqNo: 'I2', state: 'archived', closeKind: 'lost', closeReason: 'price', stats: { totalCO: 500 } },
    { no: 'A3', inqNo: 'I3', state: 'archived', closeKind: 'lost', closeReason: 'price', stats: { totalCO: 300 } },
    { no: 'A4', inqNo: 'I4', state: 'archived', closeKind: 'lost', closeWhy: 'زمان تحویل طولانی بود' }, /* قدیمی — استنتاج از متن */
    { no: 'A5', inqNo: 'I5', state: 'archived', closeKind: 'lost' } /* قدیمی بدون متن */
  ]);
  var s = ptfWinLossStats();
  T('شمارش برد/باخت', s.wins === 1 && s.losses === 4 && s.total === 5);
  T('نرخ برد ۲۰٪', s.winRate === 20);
  T('دسته price دو مورد با ارزش ۸۰۰', s.byReason.price && s.byReason.price.n === 2 && s.byReason.price.val === 800);
  T('رکورد قدیمی از متن دسته‌بندی شد (delivery)', s.byReason.delivery && s.byReason.delivery.n === 1);
  T('رکورد قدیمی بی‌متن → legacy', s.byReason.legacy && s.byReason.legacy.n === 1);
  T('ارزش بردها/باخت‌ها', s.wonValue === 1000 && s.lostValue === 800);
  T('hook گزارشات: بخش Win/Loss به rep اضافه می‌شود', ins.indexOf('_insRepHooked') > -1 && ins.indexOf("id=\"wlWrap\"") > -1 && ins.indexOf('ptfRenderWinLoss') > -1);
})();

SECTION('US-351: تاریخ تحویل تعهدی — کد');
T('دکمه ثبت/اصلاح تحویل تعهدی در کشوی پرونده', sf.indexOf('sfSetDue') > -1 && sf.indexOf('ثبت تاریخ تحویل تعهدی') > -1);
T('مودال ساختاریافته: input date + یادداشت + حذف تعهد', sf.indexOf('sfDueInp') > -1 && sf.indexOf('sfDueNote') > -1 && sf.indexOf('حذف تعهد') > -1);
T('تغییر تاریخ → ریست ضدتکرار یادآور', sf.indexOf("if (r.dueISO !== old) r.dueNotified = ''") > -1);
T('بج وضعیت روی فهرست: قرمز سررسید/تاخیر + نارنجی نزدیک', sf.indexOf('سررسید/تاخیر!') > -1 && sf.indexOf('تحویل تعهدی نزدیک') > -1);
T('یادآور خودکار checkDealDue در pollEvents', br.indexOf('function checkDealDue()') > -1 && br.indexOf('if (checkDealDue()) newMsg = true;') > -1);
T('هشدار تاخیر به مدیران + ضدتکرار روزانه', br.indexOf('🚨 تاخیر در تحویل تعهدی') > -1 && br.indexOf('r.dueNotified === today') > -1);
T('audit ثبت/اصلاح/حذف تعهد', sf.indexOf('ثبت/اصلاح تاریخ تحویل تعهدی') > -1);

SECTION('US-351: رفتار اجرایی وضعیت سررسید');
(function () {
  var today = new Date().toISOString().slice(0, 10);
  function plusDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  T('بدون dueISO → null', ptfSfDueState({ cd: 'x' }) === null);
  T('گذشته → قرمز', ptfSfDueState({ dueISO: '2020-01-01' }) === 'red');
  T('امروز → قرمز', ptfSfDueState({ dueISO: today }) === 'red');
  T('۲ روز آینده → نارنجی', ptfSfDueState({ dueISO: plusDays(2) }) === 'orange');
  T('۱۰ روز آینده → عادی (null)', ptfSfDueState({ dueISO: plusDays(10) }) === null);
  T('بایگانی‌شده → null حتی با تاریخ گذشته', ptfSfDueState({ dueISO: '2020-01-01', st: 'archived' }) === null);
  /* commit */
  setData('ptf_crm_deals', [{ cd: 'DEAL-9', inqNo: 'INQ-9', docs: [], st: 'open', dueNotified: today }]);
  sfSetDueCommit('DEAL-9', plusDays(5), 'بند ۴ قرارداد');
  var r9 = getData('ptf_crm_deals')[0];
  T('sfSetDueCommit: تاریخ+یادداشت ذخیره و dueNotified ریست شد', r9.dueISO === plusDays(5) && r9.dueNote === 'بند ۴ قرارداد' && r9.dueNotified === '');
  sfSetDueCommit('DEAL-9', '', '');
  T('حذف تعهد: dueISO خالی شد', getData('ptf_crm_deals')[0].dueISO === '');
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=14.8)', ['salesfiles.js', 'bridge.js', 'insights.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 8));
}));

DONE('tester68-v148');
