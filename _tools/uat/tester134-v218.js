/* tester134 — v21.8 US-453 buyer label readability in offer form */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.8');
T('VER v21.8+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=8);})(m[1]);})());
T('SW v21.8+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=8);})(m[1]);})());
T('cache offers 21.8+', /offers\.js\?v=/.test(idx) && (function(){var m=idx.match(/offers\.js\?v=([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=8);})(m[1]);})());

SECTION('ساختاری US-453');
T('ptfOfferBuyerLabel', off.indexOf('window.ptfOfferBuyerLabel') > -1);
T('ptfOfferRefreshBuyerChip', off.indexOf('window.ptfOfferRefreshBuyerChip') > -1);
T('ofBuyerChip host', off.indexOf('ofBuyerChip') > -1);
T('option includes code', off.indexOf("label + '  ·  ' + c.cd") > -1 || off.indexOf('·') > -1);
T('h3 shows buyer + code', off.indexOf('o.buyerCo || o.buyerCd') > -1 && off.indexOf('buyerCd') > -1);
T('pickBuyer refreshes chip', off.indexOf('ptfOfferRefreshBuyerChip(cd)') > -1);
T('table shows buyerCd under name', off.indexOf("o.buyerCd ? '<div") > -1 || off.indexOf('o.buyerCd') > -1);

SECTION('رفتاری label helper');
var m = off.match(/window\.ptfOfferBuyerLabel = function \(c, fallbackCo\) \{[\s\S]*?\n\};\n/);
if (!m) m = off.match(/window\.ptfOfferBuyerLabel = function \(c, fallbackCo\) \{[\s\S]*?\n\};/);
T('extract label', !!m);
if (m) {
  global.escP = function (s) { return String(s == null ? '' : s); };
  eval(m[0].replace('window.ptfOfferBuyerLabel', 'global.ptfOfferBuyerLabel'));
  var a = ptfOfferBuyerLabel({ cd: 'C-100', co: 'فولاد مبارکه', coEn: 'Mobarakeh Steel' });
  T('title has both names', a.title.indexOf('فولاد') > -1 && a.title.indexOf('Mobarakeh') > -1);
  T('html has code chip', a.html.indexOf('C-100') > -1);
  T('html has FA/EN lines', a.html.indexOf('FA:') > -1 && a.html.indexOf('EN:') > -1);
  var b = ptfOfferBuyerLabel(null, 'Acme');
  T('fallback only co', b.title === 'Acme');
  var c = ptfOfferBuyerLabel({ cd: 'C-1', co: 'OnlyFa' });
  T('single name no double slash noise', c.title === 'OnlyFa');
  T('code present', c.code === 'C-1' && c.html.indexOf('C-1') > -1);
}

DONE('tester134-v218');
if (RESULTS.fail) process.exit(1);
