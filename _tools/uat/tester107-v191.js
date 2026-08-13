/* tester107 — v19.1 (اسپرینت ۲ از R12: US-432 اسناد قطعی برد + US-434 فاز ۱ QC/بازرسی داخل پرونده فروش) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.1+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.1; })());
T('کش sw >= v19.1', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.1; })());
T('cache-bust offers >= 19.1', (function () { var m = idx.match(/offers\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.1; })());
T('cache-bust salesfiles >= 19.1', (function () { var m = idx.match(/salesfiles\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.1; })());

SECTION('US-432 — ساختار کد: snapshot اسناد قطعی برد');
T('لحظه برد: awardDocs روی رکورد پرونده ساخته می‌شود (autoCreateProjectFromCO)', of.indexOf('rec.awardDocs = [{ kind: o.kind, no: o.no') > -1);
T('snapshot عمیق (JSON.parse/stringify) — تغییرناپذیر', of.indexOf("snap: JSON.parse(JSON.stringify(o))") > -1);
T('پیشنهاد فنی مرتبط: اول srcToNo سپس coNo/inqNo با آخرین rev', of.indexOf('o.srcToNo') > -1 && of.indexOf("role: 'technical'") > -1 && of.indexOf('(b.rev || 0) - (a.rev || 0)') > -1);
T('مهاجرت نرم پرونده‌های قدیمی: sfAwardEnsure', sf.indexOf('window.sfAwardEnsure') > -1 && sf.indexOf('migrated: true') > -1);
T('چاپ سند برد از snapshot: sfAwardPrint (AC4 — مستقل از حذف پیشنهاد)', sf.indexOf('window.sfAwardPrint') > -1 && sf.indexOf('offerPrintObj(snap)') > -1);
T('چاپ روی کپی snapshot — mutate نمی‌شود', sf.indexOf('var snap = JSON.parse(JSON.stringify(ad.snap));') > -1);
T('باکس «اسناد قطعی برد» در کشوی پرونده', sf.indexOf('🏆 اسناد قطعی برد') > -1 && sf.indexOf('sfAwardPrint(\\\'') > -1);
T('awardDocs همراه پرونده به بایگانی می‌رود', sf.indexOf('awardDocs: (r.awardDocs || []).slice()') > -1);
T('audit برای مهاجرت و چاپ سند برد', sf.indexOf('snapshot اسناد قطعی برد') > -1 && sf.indexOf('چاپ/PDF سند قطعی برد') > -1);

SECTION('US-434 فاز ۱ — ساختار کد: QC/بازرسی داخل پرونده');
T('انواع QC چهارگانه (نوت/آزمایش/گزارش/MTC-TPI)', sf.indexOf('SF_QC_TYPES') > -1 && sf.indexOf('MTC / TPI') > -1);
T('وضعیت انطباق سه‌گانه', sf.indexOf('SF_QC_CONF') > -1 && sf.indexOf('nonconform') > -1);
T('هسته برنامه‌ای جدا از UI: sfQcCommit', sf.indexOf('window.sfQcCommit') > -1);
T('رکورد روی r.qcEvents + timeline پرونده', sf.indexOf('r.qcEvents = r.qcEvents || []') > -1 && sf.indexOf('r.timeline = r.timeline || []') > -1);
T('عدم انطباق → notify مدیران + پیشنهاد ثبت زیان (اتصال lossguard — کیس R9)', sf.indexOf("cf.id === 'nonconform' && typeof notify === 'function'") > -1 && sf.indexOf("ptfLossOpen('deal', cd)") > -1);
T('پیوست QC: به رکورد QC و docs پرونده هر دو', sf.indexOf('window.sfQcUpload') > -1 && sf.indexOf('سند کنترل کیفیت/بازرسی') > -1);
T('دکمه 🔬 فقط برای پرونده برنده', sf.indexOf('r.wonOffer ?') > -1 && sf.indexOf('sfQcOpen') > -1 && sf.indexOf('🔬 QC / نتیجه بازرسی') > -1);
T('نمایش سوابق QC در کشو', sf.indexOf('🔬 کنترل کیفیت / بازرسی</b>') > -1);
T('qcEvents/costEvents هم به بایگانی منتقل می‌شوند', sf.indexOf('qcEvents: (r.qcEvents || []).slice()') > -1 && sf.indexOf('costEvents: (r.costEvents || []).slice()') > -1);
T('برچسب Post-Award: عملیات فقط از داخل پرونده (US-434)', sf.indexOf('عملیات پرونده (Post-Award)') > -1);

SECTION('رفتاری — US-432: snapshot لحظه برد');
global.window = global;
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.curRole = function () { return 'chairman'; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.addLog = function () {};
global.confirm = function () { return false; }; /* جدول خرید واقعی باز نشود */
global.renderOffers = function () {};
global.renderDeals = function () {};
global.faDate = function () { return '1405/04/21'; };
global.faDateTime = function () { return '1405/04/21 10:00'; };
(function () {
  /* شبیه‌سازی: TO مرتبط + CO برنده — پرونده ساخته و snapshot ثبت شود */
  setData('ptf_crm_offers', [
    { no: 'TO-100', kind: 'TO', rev: 2, inqNo: 'INQ-9', coNo: 'CO-200', items: [{ name: 'Gauge', qty: 5 }] },
    { no: 'CO-200', kind: 'CO', rev: 1, inqNo: 'INQ-9', srcToNo: 'TO-100', buyerCo: 'فولاد مبارکه', currency: 'USD', items: [{ name: 'Gauge', qty: 5, price: 100 }] }
  ]);
  setData('ptf_crm_deals', []);
  setData('ptf_crm_rfqs', []);
  setData('ptf_crm_rfqsmart', []);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_letters', []);
  global.ptfSF_ensure = function (inqNo, buyerCo) {
    var list = getData('ptf_crm_deals');
    var r = { cd: 'DEAL-1', inqNo: inqNo, buyerCo: buyerCo || '', docs: [], st: 'open', t: faDateTime() };
    list.unshift(r); setData('ptf_crm_deals', list); return r;
  };
  var m = of.match(/function autoCreateProjectFromCO\(o\) \{[\s\S]*?\n\}/);
  T('استخراج autoCreateProjectFromCO', !!m);
  if (m) {
    eval(m[0]);
    autoCreateProjectFromCO(getData('ptf_crm_offers')[1]);
    var d = getData('ptf_crm_deals')[0];
    T('پرونده با wonOffer ساخته شد', d && d.wonOffer === 'CO-200');
    T('awardDocs دو سند: مالی برنده + فنی مرتبط', d && d.awardDocs && d.awardDocs.length === 2 && d.awardDocs[0].role === 'commercial' && d.awardDocs[1].role === 'technical');
    T('snapshot مالی کامل (ارز و اقلام)', d.awardDocs[0].snap.currency === 'USD' && d.awardDocs[0].snap.items.length === 1);
    T('snapshot فنی از srcToNo (TO-100 Rev.2)', d.awardDocs[1].no === 'TO-100' && d.awardDocs[1].rev === 2);
    /* تغییرناپذیری: ویرایش پیشنهاد زنده روی snapshot اثر ندارد */
    var offs = getData('ptf_crm_offers');
    offs[1].items[0].price = 999; offs[1].currency = 'EUR';
    setData('ptf_crm_offers', offs);
    var d2 = getData('ptf_crm_deals')[0];
    T('snapshot از تغییر بعدی پیشنهاد مصون است (سند قطعی)', d2.awardDocs[0].snap.currency === 'USD' && d2.awardDocs[0].snap.items[0].price === 100);
  }
})();

SECTION('رفتاری — US-434ف۱: sfQcCommit');
(function () {
  /* استخراج IIFE کامل سنگین است — هسته sfQcCommit را با sfAll/sfSave شبیه‌سازی می‌کنیم */
  var mC = sf.match(/window\.sfQcCommit = function \(cd, typeId, confId, desc\) \{[\s\S]*?\n  \};/);
  T('استخراج sfQcCommit', !!mC);
  if (!mC) return;
  var mT = sf.match(/window\.SF_QC_TYPES = \[[\s\S]*?\];/);
  var mF = sf.match(/window\.SF_QC_CONF = \[[\s\S]*?\];/);
  eval(mT[0]); eval(mF[0]);
  global.sfAll = function () { return getData('ptf_crm_deals'); };
  global.sfSave = function (l) { setData('ptf_crm_deals', l); };
  global._ntf = null;
  global.notify = function (o) { global._ntf = o; return 'NTF-1'; };
  var code = mC[0].replace(/sfAll\(\)/g, 'global.sfAll()').replace(/sfSave\(list\)/g, 'global.sfSave(list)');
  eval(code);
  setData('ptf_crm_deals', [{ cd: 'DEAL-1', inqNo: 'INQ-9', wonOffer: 'CO-200', docs: [] }]);
  var ev = sfQcCommit('DEAL-1', 'test', 'conform', 'تست هیدرواستاتیک قبول');
  var d = getData('ptf_crm_deals')[0];
  T('رکورد QC ثبت شد (نوع/انطباق/شرح)', ev && ev.type === 'test' && ev.conf === 'conform' && d.qcEvents.length === 1);
  T('timeline پرونده آپدیت شد', d.timeline && d.timeline.length === 1 && d.timeline[0].tx.indexOf('🔬') > -1);
  T('انطباق → بدون notify هشدار', !global._ntf);
  var ev2 = sfQcCommit('DEAL-1', 'report', 'nonconform', 'کالا مطابقت ندارد');
  d = getData('ptf_crm_deals')[0];
  T('عدم انطباق ثبت شد و جدیدترین اول (unshift)', ev2 && d.qcEvents[0].conf === 'nonconform');
  T('عدم انطباق → notify مدیران با kind=warn', global._ntf && global._ntf.kind === 'warn' && String(global._ntf.title).indexOf('عدم انطباق') > -1);
  T('پرونده ناموجود → null بدون خطا', sfQcCommit('NOPE', 'note', 'pending', 'x') === null);
})();

SECTION('رگرسیون');
T('sfSetDue/sfDueSave (BUG-027) دست نخورده', sf.indexOf('window.sfSetDueCommit') > -1 && sf.indexOf('window.sfDueSave') > -1);
T('lossEvents در بایگانی حفظ است (US-421)', sf.indexOf('lossEvents: (r.lossEvents || []).slice()') > -1);
T('US-431ف۱: قفل read-only پیشنهاد برنده پابرجا', of.indexOf('offerPostAwardLocked') > -1 && of.indexOf('read-only') > -1);
T('docsSummary (US-404ف۲) پابرجا', of.indexOf('rec.docsSummary = { attachments: added') > -1);
T('هدایت به خرید واقعی (US-392) پابرجا', of.indexOf('ptfRealBuyOpen === \'function\'') > -1);
T('ptfLossOpen پرونده (US-421) پابرجا', sf.indexOf("ptfLossOpen(\\'deal\\'") > -1);

DONE('tester107-v191');
