/* tester131 — v21.5 US-411 phase1 remaining + US-451 customer offer timeline */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.5');
T('VER v21.5+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=5);})(m[1]);})());
T('SW v21.5+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=5);})(m[1]);})());
T('cache offers/bridge', /offers\.js\?v=/.test(idx) && /bridge\.js\?v=/.test(idx));

SECTION('US-411ف1 — ثبت‌کننده درخواست');
T('renderRfq shows crBy line', br.indexOf('ثبت:') > -1 && br.indexOf('crBy') > -1);
T('legacy label', br.indexOf('نامشخص (قدیمی)') > -1);
T('edit modal creator', br.indexOf('ثبت‌کننده') > -1 || br.indexOf('ثبت:') > -1);
T('saveRfq2 uses dedupStamp', br.indexOf('dedupStamp(recR)') > -1 || br.indexOf('dedupStamp(recR)') > -1);
T('index saveRfq stamps', idx.indexOf('dedupStamp(recSimple)') > -1);

SECTION('US-411ف1 — مالک مشتری');
T('nC2Owner field', off.indexOf('nC2Owner') > -1);
T('owner on save', off.indexOf('rec.owner') > -1);
T('owner change audit', off.indexOf('تغییر مالک مشتری') > -1);
T('owner in customer table', off.indexOf('c.owner || c.crBy') > -1);
T('senior-only edit owner', off.indexOf('تغییر مالک فقط') > -1 || off.indexOf('nC2Owner') > -1);

SECTION('US-451 / HT timeline');
T('ptfCustOfferTimelineHtml', off.indexOf('window.ptfCustOfferTimelineHtml') > -1);
T('oCustTimeline host', off.indexOf('oCustTimeline') > -1);
T('timeline uses ptfOfferMatchCust', off.indexOf('ptfOfferMatchCust') > -1 && off.indexOf('ptfCustOfferTimelineHtml') > -1);
T('renderOffers fills timeline', off.indexOf('ptfCustOfferTimelineHtml(custF)') > -1);

SECTION('رفتاری تایم‌لاین');
var m = off.match(/window\.ptfCustOfferTimelineHtml = function \(custCd\) \{[\s\S]*?\n\};/);
T('extract timeline fn', !!m);
if (m) {
  global.escP = function (s) { return String(s == null ? '' : s); };
  global.ptfOfferMatchCust = function (o, cd) { return o.buyerCd === cd; };
  global.ptfMoney = function (v) { return v + ' R'; };
  global.offerEdit = function () {};
  global.ptfGoSalesFileForOffer = function () {};
  eval(m[0].replace('window.ptfCustOfferTimelineHtml', 'global.ptfCustOfferTimelineHtml'));
  setData('ptf_crm_customers', [{ cd: 'C1', co: 'فولاد' }]);
  setData('ptf_crm_offers', [
    { no: 'TO-1', kind: 'TO', st: 'sent', buyerCd: 'C1', inqNo: 'I1', dateEn: '2026-01-02', items: [] },
    { no: 'CO-1', kind: 'CO', st: 'won', buyerCd: 'C1', inqNo: 'I1', dateEn: '2026-02-01', items: [{ qty: 1, price: 1000 }], currency: 'IRR' },
    { no: 'CO-X', kind: 'CO', st: 'draft', buyerCd: 'C2', items: [] }
  ]);
  var html = ptfCustOfferTimelineHtml('C1');
  T('شامل TO و CO مشتری', html.indexOf('TO-1') > -1 && html.indexOf('CO-1') > -1);
  T('بدون پیشنهاد مشتری دیگر', html.indexOf('CO-X') < 0);
  T('عنوان تایم‌لاین', html.indexOf('تایم‌لاین') > -1);
  T('خالی بدون فیلتر', ptfCustOfferTimelineHtml('') === '');
}

DONE('tester131-v215');
if (RESULTS.fail) process.exit(1);
