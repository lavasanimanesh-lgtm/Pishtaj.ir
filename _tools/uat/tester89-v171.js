/* tester89 — v17.1 (US-404 فاز ۲: انضمام خودکار اسناد چهارگانه هنگام تشکیل پرونده) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.1+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.1;})());
T('کش sw >= v17.1', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.1;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust salesfiles/offers >= 17.1', ['salesfiles.js', 'offers.js'].every(function (f) { return vOf(f) >= 17.1; }));
})();

SECTION('US-404 فاز ۲ (کد): اسناد چهارگانه');
T('sfDocsOf: گروه چهارم supply (استعلام‌های تامین rfqsmart)', sf.indexOf("misc: r.docs || [], supply: []") > -1 && sf.indexOf("getData('ptf_crm_rfqsmart').filter") > -1);
T('تطبیق با هر دو شناسه درخواست (US-386)', sf.indexOf('aliases.indexOf(q.srcRfq) > -1') > -1 && sf.indexOf('if (rfq) { if (aliases.indexOf(rfq.cd) < 0) aliases.push(rfq.cd);') > -1);
T('کشو: بخش استعلام تامین با دکمه کارت رهگیری (rfqsOpen موجود)', sf.indexOf('استعلام تامین (') > -1 && sf.indexOf("rfqsOpen(\\'' + escP(q2.no)") > -1);
T('شمارنده اسناد شامل supply', sf.indexOf('+ (d.supply || []).length; /* v17.1') > -1);
T('آمار بایگانی شامل supply', sf.indexOf('supply: (d.supply || []).length') > -1);
T('پیام خالی کشو supply-آگاه', sf.indexOf('!(d.supply || []).length)') > -1);
T('لحظه برد: docsSummary + audit سه‌بخشی + confirm با ریز اسناد', of.indexOf('rec.docsSummary = { attachments: added, offers: nOff, supply: nSup') > -1 && of.indexOf('پرونده فروش با اسناد کامل تشکیل شد') > -1);
T('شمارش استعلام تامین با aliases در لحظه برد', of.indexOf('q.srcRfq && _als.indexOf(q.srcRfq) > -1') > -1);

SECTION('رفتاری: چرخه کامل — برد CO با اسناد چهارگانه');
global.window = global;
global.genCode = function (p) { return p + '-' + (++global._sq5 || (global._sq5 = 1)); };
global.faDate = function () { return '1405/04/24'; };
global.faDateTime = function () { return '1405/04/24 09:00'; };
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.audit = function (m, tx) { global._lastAudit = tx; };
global.notify = function () {};
global.SENIOR_ROLES = ['admin'];
global._confirms = [];
global.confirm = function (m) { global._confirms.push(String(m)); return false; };
global.ptfRealBuyOpen = function () { global._rbOpened = true; };
(function () {
  /* استخراج ptfSF_ensure + sfDocsOf واقعی */
  var mE = sf.match(/window\.ptfSF_ensure = function \(inqNo, buyerCo\) \{[\s\S]*?\n    return r;\n  \};/);
  var mD = sf.match(/function sfDocsOf\(r\) \{[\s\S]*?\n    return out;\n  \}/);
  var mA = of.match(/function autoCreateProjectFromCO\(o\) \{[\s\S]*?\n\}/);
  T('توابع استخراج شدند', !!mE && !!mD && !!mA);
  if (!(mE && mD && mA)) return;
  global.sfAll = function () { return getData('ptf_crm_deals'); };
  global.sfSave = function (l) { setData('ptf_crm_deals', l); };
  eval(mE[0].replace('window.ptfSF_ensure', 'global.ptfSF_ensure'));
  eval(mD[0].replace('function sfDocsOf', 'global.sfDocsOf = function'));
  eval(mA[0].replace('function autoCreateProjectFromCO', 'global.autoCreateProjectFromCO = function'));

  /* داده: درخواست با دو شناسه + ضمایم، دو پیشنهاد (TO+CO)، استعلام تامین با srcRfq=شماره کارفرما، نامه، فاکتور */
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', inqNo: 'INQ-CUST-77', co: 'فولاد', files: { inq: [{ name: 'a.pdf', key: 'k1' }], ds: [{ name: 'b.pdf', key: 'k2' }] } }]);
  setData('ptf_crm_offers', [
    { no: 'TO-1', kind: 'TO', inqNo: 'RFQ-1', st: 'approved', buyerCo: 'فولاد' },
    { no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', st: 'won', buyerCo: 'فولاد', items: [] }
  ]);
  setData('ptf_crm_rfqsmart', [
    { no: 'PTF-RFQS-1405-001', srcRfq: 'INQ-CUST-77', items: [{}, {}], targets: [{ st: 'replied' }, { st: 'pending' }] },
    { no: 'PTF-RFQS-1405-002', srcRfq: 'RFQ-1', items: [{}], targets: [] },
    { no: 'PTF-RFQS-1405-009', srcRfq: 'RFQ-OTHER', items: [], targets: [] }
  ]);
  setData('ptf_crm_letters', []);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_deals', []);

  /* برد CO */
  autoCreateProjectFromCO({ no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', buyerCo: 'فولاد' });
  var deal = getData('ptf_crm_deals')[0];
  T('پرونده ساخته شد با wonOffer', !!deal && deal.wonOffer === 'CO-1');
  T('② ضمایم درخواست منضم شد (۲ فایل)', (deal.docs || []).length === 2 && deal.docs.some(function (d2) { return d2.key === 'k2'; }));
  T('docsSummary: ۲ ضمیمه + ۲ پیشنهاد + ۲ استعلام تامین', deal.docsSummary && deal.docsSummary.attachments === 2 && deal.docsSummary.offers === 2 && deal.docsSummary.supply === 2);
  T('confirm لحظه برد ریز اسناد را می‌گوید', global._confirms.length === 1 && global._confirms[0].indexOf('2 استعلام تامین') > -1);
  T('audit سه‌بخشی', String(global._lastAudit || '').length > 0);

  /* sfDocsOf: چهار گروه زنده */
  var d = sfDocsOf(deal);
  T('③ استعلام‌های تامین با هر دو شناسه پیدا شدند (نه استعلام غریبه)', d.supply.length === 2 && !d.supply.some(function (q) { return q.no === 'PTF-RFQS-1405-009'; }));
  T('② پیشنهادها زنده (آخرین رویژن) — TO و CO', d.offers.length === 2);
  T('① ضمایم در misc پرونده', d.misc.length === 2);

  /* برد مجدد (نگارش جدید همان CO) → ضمیمه تکراری نشود */
  autoCreateProjectFromCO({ no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', buyerCo: 'فولاد' });
  deal = getData('ptf_crm_deals')[0];
  T('ضدتکرار: برد مجدد ضمیمه تکراری نمی‌سازد', (deal.docs || []).length === 2);

  /* درخواست بدون استعلام تامین → supply خالی بدون خطا */
  setData('ptf_crm_rfqsmart', []);
  var d2 = sfDocsOf(deal);
  T('بدون استعلام تامین → supply=[] بدون خطا', d2.supply.length === 0);
})();

SECTION('رگرسیون');
T('هدایت خرید واقعی (US-392) پابرجا — گروه ④', of.indexOf('ptfRealBuyOpen(o.inqNo || o.no)') > -1);
T('sfDrawerHtml: بخش‌های قبلی (پیشنهاد/نامه/فاکتور/متفرقه) پابرجا', sf.indexOf('d.offers.forEach(function (o)') > -1 && sf.indexOf('d.letters.forEach(function (l)') > -1 && sf.indexOf('d.invoices.forEach(function (i)') > -1 && sf.indexOf('d.misc.forEach(function (m, mi)') > -1);
T('sfHasInvoice (فیلتر تب پرونده‌ها v16.8) دست‌نخورده', sf.indexOf('function sfHasInvoice(r) { return sfDocsOf(r).invoices.length > 0; }') > -1);
T('تب فرصت‌ها (v16.8) دست‌نخورده', sf.indexOf('ptfOppoRender') > -1 && fs.readFileSync(path.join(BASE, 'oppo.js'), 'utf-8').indexOf('window.ptfOppoList') > -1);
T('مختومه‌سازی/بایگانی (US-349/322) پابرجا', sf.indexOf('window.sfCloseLost') > -1 && sf.indexOf("closeKind: closeKind") > -1);
T('انضمام ضمایم درخواست (مسیر v13.6) پابرجا', of.indexOf("note: 'ضمیمه درخواست (' + k + ')'") > -1);
T('rfqsOpen (کارت رهگیری استعلام) در rfqsmart موجود', fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8').indexOf('window.rfqsOpen = function (no)') > -1);

DONE('tester89-v171');
