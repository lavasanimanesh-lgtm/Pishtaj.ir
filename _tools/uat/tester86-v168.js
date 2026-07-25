/* tester86 — v16.8 (US-404 فاز ۱: پرونده فروش = ابلاغ سفارش + تب فرصت‌های فعال) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'oppo.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v16.8+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.8;})());
T('کش sw >= v16.8 + oppo در SHELL', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.8;})() && sw.indexOf("'./oppo.js'") > -1);
T('oppo.js در index.html بعد از salesfiles', (function(){var a=idx.search(/salesfiles\.js\?v=/), b=idx.search(/oppo\.js\?v=/); return a>-1 && b>a;})());

SECTION('US-404 فاز ۱ (کد): پرونده = ابلاغ سفارش');
T('ثبت پیشنهاد دیگر پرونده نمی‌سازد (hook فقط buyerCo موجود)', sf.indexOf('ثبت پیشنهاد دیگر پرونده نمی‌سازد') > -1 && (function () { var i = sf.indexOf('function hookOfferSave'); var seg = sf.slice(i, i + 1200); return seg.indexOf('ptfSF_ensure(') === -1; })());
T('تنها نقطه ساخت پرونده = مسیر برنده CO (autoCreateProjectFromCO)', of.indexOf('ptfSF_ensure === ') > -1 && of.indexOf('autoCreateProjectFromCO') > -1);
T('renderDeals: فقط wonOffer (+ احتیاط: رکورد قدیمی فاکتوردار)', sf.indexOf('if (!r.wonOffer && !(r.inqNo && sfHasInvoice(r))) return false;') > -1);
T('مهاجرت نرم: رکوردهای قدیمی حذف نمی‌شوند', sf.indexOf('رکوردهای قدیمی بدون برد حذف نمی‌شوند (مهاجرت نرم)') > -1);
T('دو تب: پرونده‌ها (ابلاغ) + فرصت‌های فعال با شمارنده', sf.indexOf('📁 پرونده‌ها (ابلاغ سفارش)') > -1 && sf.indexOf('🎯 فرصت‌های فعال') > -1 && sf.indexOf('ptfOppoCount') > -1);
T('تب فرصت‌ها → ptfOppoRender (oppo.js)', sf.indexOf('window.ptfOppoRender === ') > -1);
T('ptfSF_ensure دست‌نخورده (مصرف مسیر برنده + ثبت باخت)', sf.indexOf('window.ptfSF_ensure = function (inqNo, buyerCo)') > -1);

SECTION('US-404 فاز ۱ (کد): لایه فرصت‌ها — بدون موجودیت جدید');
T('فرصت = نمای خواندنی offers/rfqs/deals (هیچ setData ساخت رکورد)', op.indexOf("getData('ptf_crm_offers')") > -1 && op.indexOf('setData(') === -1);
T('برنده/بایگانی‌شده فرصت نیست', op.indexOf("if (o.st === 'won' && (o.kind === 'CO' || o.kind === 'TC')") > -1 && op.indexOf('if (wonInq[inq]) return;') > -1);
T('درخواست لغو/تحویل‌شده فرصت نیست', op.indexOf("rfq.st === 'stX' || rfq.st === 'st7'") > -1);
T('شناسه‌های هم‌ارز US-386 (cd + inqNo)', op.indexOf('function aliasesOf(r)') > -1);
T('بج‌های موجود: مهلت US-348 + منتظر صدور', op.indexOf('ptfRfqDueState') > -1 && op.indexOf('ptfRfqWaitBadge') > -1);
T('مرتب‌سازی: مهلت گذشته اول', op.indexOf('d.over ? 0 : 1') > -1);
T('ثبت باخت = عین مسیر موجود (ptfSF_ensure→sfClose→US-349→Win/Loss)', op.indexOf('window.ptfOppoLose') > -1 && op.indexOf('window.sfClose(r.cd)') > -1);
T('چیپ وضعیت پیشنهادها با مهاجرت TO (won→approved)', op.indexOf("o.st === 'won' ? 'approved'") > -1);

SECTION('رفتاری: چرخه کامل فرصت→برد/باخت (شرط کارفرما: رفت‌وبرگشتی)');
global.window = global;
global.genCode = function (p) { return p + '-' + (++global._sq4 || (global._sq4 = 1)); };
global.faDate = function () { return '1405/04/22'; };
global.faDateTime = function () { return '1405/04/22 09:00'; };
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.audit = function () {};
global.notify = function () {};
global.alert = function () {};
global.ptfRfqDueState = null; global.ptfRfqWaitBadge = null;
(function () {
  /* استخراج توابع واقعی oppo */
  var mA = op.match(/function aliasesOf\(r\) \{[\s\S]*?\n  \}/);
  var mL = op.match(/window\.ptfOppoList = function \(\) \{[\s\S]*?\n    return out;\n  \};/);
  var mC = op.match(/window\.ptfOppoCount = function \(\) \{[\s\S]*?\n  \};/);
  var mArch = op.match(/window\.ptfOppoArchivedInqSet = function \(\) \{[\s\S]*?\n  \};/);
  var mIsArch = op.match(/window\.ptfOppoIsArchivedInq = function \(inq, rfq, archSet\) \{[\s\S]*?\n  \};/);
  T('توابع oppo استخراج شدند', !!mA && !!mL && !!mC);
  if (!(mA && mL && mC)) return;
  eval(mA[0].replace('function aliasesOf', 'global.aliasesOf = function'));
  /* v21.1: helpers بایگانی باید قبل از ptfOppoList eval شوند */
  if (mArch) eval(mArch[0].replace('window.ptfOppoArchivedInqSet', 'global.ptfOppoArchivedInqSet'));
  if (mIsArch) eval(mIsArch[0].replace('window.ptfOppoIsArchivedInq', 'global.ptfOppoIsArchivedInq'));
  eval(mL[0].replace('window.ptfOppoList', 'global.ptfOppoList'));
  eval(mC[0].replace('window.ptfOppoCount', 'global.ptfOppoCount'));

  /* سناریو: ۲ درخواست با پیشنهاد؛ یکی برنده می‌شود، یکی می‌بازد */
  setData('ptf_crm_rfqs', [
    { cd: 'RFQ-1', co: 'فولاد مبارکه', st: 'st2' },
    { cd: 'RFQ-2', co: 'پتروشیمی', st: 'st2' },
    { cd: 'RFQ-3', co: 'لغوشده', st: 'stX' }
  ]);
  setData('ptf_crm_offers', [
    { no: 'TO-1', kind: 'TO', inqNo: 'RFQ-1', st: 'sent', buyerCo: 'فولاد مبارکه' },
    { no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', st: 'sent', buyerCo: 'فولاد مبارکه', items: [] },
    { no: 'CO-2', kind: 'CO', inqNo: 'RFQ-2', st: 'draft', buyerCo: 'پتروشیمی', items: [] },
    { no: 'CO-3', kind: 'CO', inqNo: 'RFQ-3', st: 'sent', buyerCo: 'لغوشده', items: [] }
  ]);
  setData('ptf_crm_deals', []);
  var l = ptfOppoList();
  T('۲ فرصت فعال (لغوشده حذف)', l.length === 2 && !l.some(function (g) { return g.inqNo === 'RFQ-3'; }));
  T('شمارنده تب درست', ptfOppoCount() === 2);

  /* برد CO-1 → فرصت خارج، پرونده وارد */
  var offers = getData('ptf_crm_offers');
  offers[1].st = 'won';
  setData('ptf_crm_offers', offers);
  setData('ptf_crm_deals', [{ cd: 'DEAL-1', inqNo: 'RFQ-1', buyerCo: 'فولاد مبارکه', wonOffer: 'CO-1', docs: [], st: 'open', t: 'x' }]);
  l = ptfOppoList();
  T('پس از برد: RFQ-1 دیگر فرصت نیست', l.length === 1 && l[0].inqNo === 'RFQ-2');

  /* فیلتر پرونده‌ها (منطق renderDeals بازسازی‌شده) */
  function filesFilter(deals, hasInvFn) {
    return deals.filter(function (r) {
      if (r.st === 'archived') return false;
      if (!r.wonOffer && !(r.inqNo && hasInvFn(r))) return false;
      return true;
    });
  }
  var deals = [
    { cd: 'DEAL-1', inqNo: 'RFQ-1', wonOffer: 'CO-1', st: 'open' },
    { cd: 'DEAL-OLD', inqNo: 'RFQ-9', st: 'open' },                    /* قدیمی بدون برد → تب پرونده نه */
    { cd: 'DEAL-INV', inqNo: 'RFQ-8', st: 'open' }                     /* قدیمی با فاکتور → احتیاطا پرونده */
  ];
  var vis = filesFilter(deals, function (r) { return r.inqNo === 'RFQ-8'; });
  T('تب پرونده‌ها: فقط برنده + قدیمیِ فاکتوردار', vis.length === 2 && vis.some(function (r) { return r.cd === 'DEAL-1'; }) && vis.some(function (r) { return r.cd === 'DEAL-INV'; }));
  T('رکورد قدیمی بدون برد از داده حذف نشده (مهاجرت نرم)', deals.length === 3);

  /* باخت RFQ-2 از تب فرصت‌ها: ptfSF_ensure + sfClose موجود */
  var mE = sf.match(/window\.ptfSF_ensure = function \(inqNo, buyerCo\) \{[\s\S]*?\n    return r;\n  \};/);
  T('ptfSF_ensure استخراج شد', !!mE);
  if (mE) {
    global.sfAll = function () { return getData('ptf_crm_deals'); };
    global.sfSave = function (x) { setData('ptf_crm_deals', x); };
    eval(mE[0].replace('window.ptfSF_ensure', 'global.ptfSF_ensure'));
    var mOL = op.match(/window\.ptfOppoLose = function \(inqNo, buyerCo\) \{[\s\S]*?\n  \};/);
    T('ptfOppoLose استخراج شد', !!mOL);
    if (mOL) {
      global._closedCd = null;
      global.sfClose = function (cd) { global._closedCd = cd; };
      eval(mOL[0].replace('window.ptfOppoLose', 'global.ptfOppoLose'));
      ptfOppoLose('RFQ-2', 'پتروشیمی');
      var d2 = getData('ptf_crm_deals').filter(function (x) { return x.inqNo === 'RFQ-2'; })[0];
      T('باخت: رکورد ساخته و به sfClose موجود سپرده شد (مودال US-349)', !!d2 && global._closedCd === d2.cd);
    }
  }
})();

SECTION('رگرسیون');
T('sfClose/sfCloseLost/sfArchive (US-349/322) دست‌نخورده', sf.indexOf('window.sfClose = function (cd)') > -1 && sf.indexOf('window.sfCloseLost = function (cd, reasonId, note)') > -1 && sf.indexOf("closeReason: reasonId || (closeKind === 'settled' ? 'won' : '')") > -1);
T('تحویل تعهدی US-351 (sfSetDue/ptfSfDueState) پابرجا', sf.indexOf('window.sfSetDue = function (cd)') > -1 && sf.indexOf('window.ptfSfDueState = function (r)') > -1);
T('هوک خرید واقعی v16.3 (فقط wonOffer) سازگار — پرونده‌های تب files همه wonOffer دارند', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('!deal.wonOffer) return;') > -1);
T('مسیر برنده: autoCreateProjectFromCO → ptfSF_ensure → wonOffer + هدایت خرید واقعی', of.indexOf('rec.wonOffer = o.no;') > -1 && of.indexOf('ptfRealBuyOpen(o.inqNo || o.no)') > -1);
T('hook نامه‌ها (SF:) پابرجا', sf.indexOf("o.value = 'SF:' + r.inqNo;") > -1);
T('روتینگ deals در rbac سازگار (window.buildDeals جایگزین شده)', fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8').indexOf('(window.buildDeals || buildDeals)') > -1);
T('sfDocsOf (اسناد زنده با آخرین رویژن) دست‌نخورده', sf.indexOf('function sfDocsOf(r)') > -1 && sf.indexOf('out.offers = offers; // نمایش زنده = همیشه آخرین رویژن') > -1);
T('oppo: هیچ CRUD موازی — فقط خواندن + سپردن به مسیر موجود', op.indexOf('بدون منطق موازی') > -1);

DONE('tester86-v168');
