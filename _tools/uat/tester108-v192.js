/* tester108 — v19.2 (اسپرینت ۳ از R12: US-433 مراحل ۱۲گانه پرونده + US-434 فاز ۲ پکینگ/بارنامه/تحویل کارفرما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.2+', (function () { var m = idx.match(/var VER = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.2; })());
T('کش sw >= v19.2', (function () { var m = sw.match(/ptf-crm-v([0-9.]+)/); return m && parseFloat(m[1]) >= 19.2; })());
T('cache-bust salesfiles >= 19.2', (function () { var m = idx.match(/salesfiles\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.2; })());

SECTION('US-433 — ساختار کد: مراحل ۱۲گانه مشتق');
T('PTF_SF_STAGES دقیقا ۱۲ مرحله بک‌لاگ R12', (function () { var m = sf.match(/window\.PTF_SF_STAGES = \[([\s\S]*?)\];/); return m && (m[1].match(/\{ id: \d+/g) || []).length === 12 && m[1].indexOf('ابلاغ سفارش') > -1 && m[1].indexOf('بایگانی‌شده') > -1; })());
T('وضعیت مشتق است نه فیلد آزاد (sfStageOf از سیگنال‌های واقعی)', sf.indexOf('window.sfStageOf') > -1 && sf.indexOf('function up(n) { if (n > st) st = n; }') > -1);
T('هم‌راستایی با وضعیت درخواست st8/st9/st6/st7 (منبع واحد v17.3)', sf.indexOf("if (rfq.st === 'st8') up(3);") > -1 && sf.indexOf("else if (rfq.st === 'st9') up(4);") > -1 && sf.indexOf("else if (rfq.st === 'st7') up(7);") > -1);
T('فاکتور: ارجاع→۸، ثبت→۹، مانده→۱۰، تسویه→۱۱', sf.indexOf('if (wo && wo.invRef) up(8);') > -1 && sf.indexOf('up(remain > 0.5 ? 10 : 11);') > -1);
T('گذار درخواست فقط از مسیر واحد ptfRfqSetStatus (sfRfqAlign)', sf.indexOf('window.sfRfqAlign') > -1 && sf.indexOf("ptfRfqSetStatus(rfq.cd, targetSt, txt)") > -1);
T('عقب‌گرد ساختاری ممنوع: ترتیب از آرایه PTF_RFQ_STATUSES + ci >= ti رد', sf.indexOf('var ci = order.indexOf(rfq.st), ti = order.indexOf(targetSt);') > -1 && sf.indexOf("rfq.st === 'stX' || ti < 0 || ci >= ti") > -1);
T('استپر ۱۲خانه در کشو + بج مرحله در سطر فهرست', sf.indexOf('🧭 مرحله پرونده:') > -1 && sf.indexOf('var stgBadge = stgN') > -1);
T('نمایش «دستی نیست»', sf.indexOf('دستی و قابل عقب‌گرد نیست') > -1);

SECTION('US-434 فاز ۲ — ساختار کد: ارسال/تحویل داخل پرونده');
T('سه رویداد: پکینگ/بارنامه/تحویل کارفرما', sf.indexOf('SF_SHIP_TYPES') > -1 && sf.indexOf("{ id: 'packing'") > -1 && sf.indexOf("{ id: 'shipdoc'") > -1 && sf.indexOf("{ id: 'delivered'") > -1);
T('هسته برنامه‌ای جدا از UI: sfShipCommit (الگوی sfQcCommit)', sf.indexOf('window.sfShipCommit') > -1);
T('رکورد روی r.shipEvents + timeline', sf.indexOf('r.shipEvents = r.shipEvents || []') > -1);
T('پکینگ/بارنامه → st6 و تحویل → st7 (گذار خودکار از پرونده)', sf.indexOf("rfq: 'st6'") > -1 && sf.indexOf("rfq: 'st7'") > -1 && sf.indexOf('sfRfqAlign(r.inqNo, tp.rfq, tp.rfqTxt)') > -1);
T('تحویل کارفرما → notify مدیران (پیش‌نیاز US-435)', sf.indexOf("typeId === 'delivered' && typeof notify === 'function'") > -1 && sf.indexOf('گام بعد: ارجاع فاکتور از پرونده') > -1);
T('پیوست سند ارسال به رکورد و docs پرونده', sf.indexOf('window.sfShipUpload') > -1 && sf.indexOf('سند ارسال/تحویل') > -1);
T('سه دکمه فقط برای پرونده برنده', sf.indexOf('r.wonOffer ?') > -1 && sf.indexOf("sfShipOpen") > -1 && sf.indexOf("'shipdoc'") > -1 && sf.indexOf("'delivered'") > -1);
T('نمایش سوابق ارسال در کشو', sf.indexOf('🚚 ارسال و تحویل</b>') > -1);
T('shipEvents همراه پرونده به بایگانی', sf.indexOf('shipEvents: (r.shipEvents || []).slice()') > -1);

SECTION('رفتاری — موتور مراحل sfStageOf');
global.window = global;
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.faDate = function () { return '1405/04/21'; };
global.faDateTime = function () { return '1405/04/21 11:00'; };
global.notify = function (o) { global._ntf = o; return 'NTF-1'; };
(function () {
  /* استخراج توابع لازم */
  eval(sf.match(/window\.PTF_SF_STAGES = \[[\s\S]*?\];/)[0]);
  eval(sf.match(/window\.SF_SHIP_TYPES = \[[\s\S]*?\];/)[0]);
  global.sfAll = function () { return getData('ptf_crm_deals'); };
  global.sfSave = function (l) { setData('ptf_crm_deals', l); };
  global.sfDocsOf = function (r) {
    return {
      offers: [], letters: [], misc: [],
      invoices: getData('ptf_crm_invoices').filter(function (i) { return i.offerNo === (r._won || 'CO-1'); }),
      supply: getData('ptf_crm_rfqsmart').filter(function (q) { return q.srcRfq === r.inqNo; })
    };
  };
  var so = sf.match(/window\.sfStageOf = function \(r\) \{[\s\S]*?\n  \};/)[0];
  eval(so.replace(/var d = sfDocsOf\(/, 'var d = global.sfDocsOf('));
  eval(sf.match(/window\.sfStageLabel = function \(r\) \{[\s\S]*?\n  \};/)[0]);
  var al = sf.match(/function sfRfqAlign\(inqNo, targetSt, txt\) \{[\s\S]*?\n  \}/)[0];
  eval(al); global.sfRfqAlign = sfRfqAlign;
  eval(sf.match(/window\.sfShipSeqCheck = function \(r, typeId, dateISO\) \{[\s\S]*?\n  \};/)[0]);
  var sc = sf.match(/window\.sfShipCommit = function \(cd, typeId, v\) \{[\s\S]*?\n  \};/)[0];
  eval(sc.replace(/sfAll\(\)/g, 'global.sfAll()').replace(/sfSave\(list\)/g, 'global.sfSave(list)').replace(/sfStageOf\(r\)/g, 'global.sfStageOf(r)'));

  /* منبع واحد وضعیت‌ها مثل bridge.js */
  global.PTF_RFQ_STATUSES = [
    { v: 'st1' }, { v: 'st2' }, { v: 'stTO' }, { v: 'stCO' }, { v: 'st3' }, { v: 'st4' },
    { v: 'st5' }, { v: 'st8' }, { v: 'st9' }, { v: 'st6' }, { v: 'st7' }, { v: 'stX' }
  ];
  global._setCalls = [];
  global.ptfRfqSetStatus = function (cd, v, t) {
    global._setCalls.push({ cd: cd, v: v, t: t });
    var rf = getData('ptf_crm_rfqs'); rf.forEach(function (x) { if (x.cd === cd) { x.st = v; x.stxt = t; } });
    setData('ptf_crm_rfqs', rf); return true;
  };

  setData('ptf_crm_invoices', []);
  setData('ptf_crm_rfqsmart', []);
  setData('ptf_crm_offers', [{ no: 'CO-1', kind: 'CO', inqNo: 'INQ-1' }]);
  setData('ptf_crm_rfqs', [{ cd: 'INQ-1', st: 'st5', stxt: 'ابلاغ' }]);
  var deal = { cd: 'D1', inqNo: 'INQ-1', wonOffer: 'CO-1', _won: 'CO-1', docs: [] };
  setData('ptf_crm_deals', [deal]);

  T('پرونده بدون برد = مرحله ۰', sfStageOf({ cd: 'x' }) === 0);
  T('پرونده تازه‌برنده = مرحله ۱ (ابلاغ)', sfStageOf(deal) === 1);
  setData('ptf_crm_rfqsmart', [{ no: 'RQ-1', srcRfq: 'INQ-1' }]);
  T('استعلام تامین مرحله دوم → مرحله ۲', sfStageOf(deal) === 2);
  var rf = getData('ptf_crm_rfqs'); rf[0].st = 'st8'; setData('ptf_crm_rfqs', rf);
  T('درخواست st8 → مرحله ۳ (در حال تامین)', sfStageOf(deal) === 3);
  rf[0].st = 'st9'; setData('ptf_crm_rfqs', rf);
  T('درخواست st9 → مرحله ۴ (تحویل تامین)', sfStageOf(deal) === 4);

  /* US-434ف۲: پکینگ لیست → مرحله ۵ + گذار st6 از مسیر واحد */
  var evP = sfShipCommit('D1', 'packing', { no: 'PL-1', note: '۲ پالت' });
  T('پکینگ ثبت شد + گذار st6 از ptfRfqSetStatus', !!evP && global._setCalls.length === 1 && global._setCalls[0].v === 'st6');
  deal = getData('ptf_crm_deals')[0]; deal._won = 'CO-1';
  T('مرحله ۵ (آماده‌سازی ارسال)', sfStageOf(deal) === 5);

  var evS = sfShipCommit('D1', 'shipdoc', { no: 'BL-77', carrier: 'باربری ایران' });
  deal = getData('ptf_crm_deals')[0]; deal._won = 'CO-1';
  T('بارنامه → مرحله ۶ (ارسال‌شده) — درخواست st6 می‌ماند (عقب‌گرد/تکرار نه)', !!evS && sfStageOf(deal) === 6 && global._setCalls.length === 1);

  global._ntf = null;
  var evD = sfShipCommit('D1', 'delivered', { receiver: 'مهندس رضایی' });
  deal = getData('ptf_crm_deals')[0]; deal._won = 'CO-1';
  T('تحویل کارفرما → مرحله ۷ + گذار st7 + notify', !!evD && sfStageOf(deal) === 7 && global._setCalls[1].v === 'st7' && global._ntf && String(global._ntf.title).indexOf('تحویل شد') > -1);

  /* فاکتور و تسویه */
  var offs = getData('ptf_crm_offers'); offs[0].invRef = { by: 'lavasani' }; setData('ptf_crm_offers', offs);
  T('ارجاع فاکتور → مرحله ۸', sfStageOf(deal) === 8);
  setData('ptf_crm_invoices', [{ cd: 'I1', offerNo: 'CO-1', amount: 1000, payments: [] }]);
  T('فاکتور با مانده → مرحله ۱۰ (در حال تسویه)', sfStageOf(deal) === 10);
  setData('ptf_crm_invoices', [{ cd: 'I1', offerNo: 'CO-1', amount: 1000, payments: [{ amt: 1000 }] }]);
  T('وصول کامل → مرحله ۱۱ (تسویه‌شده)', sfStageOf(deal) === 11);
  deal.st = 'archived';
  T('بایگانی → مرحله ۱۲', sfStageOf(deal) === 12);
  deal.st = 'open';

  /* AC3: عقب‌گرد ممنوع */
  T('sfRfqAlign عقب‌گرد نمی‌کند (st7 → st6 رد)', sfRfqAlign('INQ-1', 'st6', 'x') === false && global._setCalls.length === 2);
  rf = getData('ptf_crm_rfqs'); rf[0].st = 'stX'; setData('ptf_crm_rfqs', rf);
  T('درخواست لغوشده هرگز گذار نمی‌گیرد', sfRfqAlign('INQ-1', 'st7', 'x') === false);
  T('پرونده ناموجود → null بدون خطا', sfShipCommit('NOPE', 'packing', {}) === null);
})();

SECTION('رگرسیون');
T('US-432 (اسناد قطعی برد v19.1) پابرجا', sf.indexOf('window.sfAwardEnsure') > -1 && sf.indexOf('window.sfAwardPrint') > -1);
T('US-434ف۱ (QC v19.1) پابرجا', sf.indexOf('window.sfQcCommit') > -1 && sf.indexOf('🔬 کنترل کیفیت / بازرسی') > -1);
T('بایگانی: award/qc/cost/loss/ship همگی منتقل می‌شوند', ['awardDocs: (r.awardDocs || []).slice()', 'qcEvents: (r.qcEvents || []).slice()', 'costEvents: (r.costEvents || []).slice()', 'lossEvents: (r.lossEvents || []).slice()', 'shipEvents: (r.shipEvents || []).slice()'].every(function (k) { return sf.indexOf(k) > -1; }));
T('BUG-027 (sfDueSave/sfClearDue) پابرجا', sf.indexOf('window.sfDueSave') > -1 && sf.indexOf('window.sfClearDue') > -1);
T('st8/st9 منبع واحد bridge (US-413) دست‌نخورده', br.indexOf("{ v: 'st8', t: '🏭 در حال تامین توسط تامین‌کننده' }") > -1 && br.indexOf("{ v: 'st9', t: '📦 تحویل تامین‌کننده' }") > -1);
T('ptfRealBuyEnsureStatus (BUG-029 v18.9) دست‌نخورده', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('window.ptfRealBuyEnsureStatus') > -1);

DONE('tester108-v192');
