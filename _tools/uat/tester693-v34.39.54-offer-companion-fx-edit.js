/* tester693 — companion FX editor for offers outside sales files.
   Covers FX→IRR and IRR→FX edit flows, rate/currency persistence, stale-terms guard,
   companion-only writes, CNY/AED/GBP coverage, and visible list-card entry points. */
require('./harness');
var fs = require('fs'), path = require('path');
var CRM = path.resolve(__dirname, '../../crm');
var confirmResult = true, modalHtml = '';
var nodes = {};
function node(id, value) {
  return nodes[id] = { id: id, value: value || '', textContent: '', innerHTML: '', removed: false,
    remove: function () { this.removed = true; },
    insertAdjacentHTML: function (_where, html) { modalHtml += html; } };
}
['panels','sfRcTermsRate','sfRcTermsTotal','sfRcTermsList','sfRcTermsDlg','sfFxTermsRate','sfFxTermsCur','sfFxTermsTotal','sfFxTermsList','sfFxTermsDlg','sfFxTermsRateLabel','sfFxTermsTitle','sfFxTermsLiveNote','sfFxCur','sfFxRate','ofCurrency','ofFxWrap','ofFxRate'].forEach(function (id) { node(id); });
nodes.panels.insertAdjacentHTML = function (_where, html) { modalHtml = html; };
nodes.ofCurrency.closest = function () { return null; };
global.document.getElementById = function (id) { return nodes[id] || null; };
global.document.querySelector = function () { return null; };
global.document.querySelectorAll = function () { return []; };
global.window.addEventListener = function () {};
global.window.innerWidth = 1280;
global.confirm = function () { return confirmResult; };
global.alert = function (msg) { global._lastAlert = msg; };
global.ptfNum = function (v) { return parseFloat(String(v == null ? '' : v).replace(/[٬،,\s]/g, '').replace(/٫/g, '.')) || 0; };
global.ptfMoney = function (v, cur) { return String(v) + ' ' + cur; };
global.ptfToast = function () {};
global.isSenior = function () { return true; };
global.curSession = function () { return { user: 'tester', role: 'admin', name: 'Tester' }; };
global._ptfFxLive = { rates: { usd_free: 500000, eur_free: 550000, cny_free: 70000 } };
function load(name) { (0, eval)(fs.readFileSync(path.join(CRM, name), 'utf8')); }
load('offer-rial-convert.js');
load('offer-fx-convert.js');
load('offers-pro.js');

function baseOffers() {
  var fxSource = {
    no: 'CO-FX-SRC', kind: 'CO', currency: 'CNY', st: 'sent', fxBasis: 'free', fxRateRef: 80000,
    items: [{ name: 'Valve', qty: 2, price: 10, refPrice: 8, brand: 'Original FX' }],
    terms: ['قیمت 10 CNY', 'تحویل 30 روزه'], buyerCo: 'Buyer'
  };
  var rialComp = {
    no: 'CO-IRR-COMP', kind: 'CO', currency: 'IRR', st: 'sent', rialOf: fxSource.no,
    items: [{ name: 'Valve', qty: 2, price: 800000, brand: 'Companion IRR' }],
    terms: ['قیمت 800,000 ریال', 'تحویل 30 روزه'],
    fxConvert: { from: fxSource.no, cur: 'CNY', rate: 80000, termsRate: 80000, termsCur: 'CNY', totalFx: 20, totalIrr: 1600000 }
  };
  var irrSource = {
    no: 'CO-IRR-SRC', kind: 'CO', currency: 'IRR', st: 'sent', fxBasis: '', fxRateRef: 0,
    items: [{ name: 'Pump', qty: 1, price: 1000000, refPrice: 900000, brand: 'Original IRR' }],
    terms: ['قیمت 1,000,000 ریال', 'تحویل 30 روزه'], buyerCo: 'Buyer'
  };
  var fxComp = {
    no: 'CO-FX-COMP', kind: 'CO', currency: 'USD', st: 'sent', fxOf: irrSource.no,
    items: [{ name: 'Pump', qty: 1, price: 2, brand: 'Companion FX' }],
    terms: ['قیمت 2.00 USD', 'تحویل 30 روزه'],
    fxBasis: 'converted', fxRateRef: 500000,
    fxConvert: { from: irrSource.no, toCur: 'USD', cur: 'USD', rate: 500000, termsRate: 500000, termsCur: 'USD', totalIrr: 1000000, totalFx: 2 }
  };
  return { fxSource: fxSource, rialComp: rialComp, irrSource: irrSource, fxComp: fxComp };
}
function setOffers(a) { setData('ptf_crm_offers', a); }
function getOffer(no) { return getData('ptf_crm_offers').filter(function (o) { return o.no === no; })[0]; }
function resetModalNodes() {
  ['sfRcTermsRate','sfRcTermsTotal','sfRcTermsList','sfRcTermsDlg','sfFxTermsRate','sfFxTermsCur','sfFxTermsTotal','sfFxTermsList','sfFxTermsDlg','sfFxTermsRateLabel','sfFxTermsTitle','sfFxTermsLiveNote'].forEach(function (id) { node(id); });
  modalHtml = '';
}

SECTION('Currency options in the offer editor');
T('general offer currency list includes all companion currencies', ['IRR','USD','EUR','CNY','AED','GBP'].every(function (c) { return window.PTF_CURRENCIES.some(function (x) { return x.id === c; }); }));
global._offState = { kind: 'CO', currency: 'USD', fxBasis: 'free', fxRateRef: 500000 };
offerCurChanged('CNY');
T('switching to CNY replaces the previous currency rate with its live rate', _offState.currency === 'CNY' && _offState.fxRateRef === 70000);
offerCurChanged('GBP');
T('switching to GBP clears the unavailable live rate and marks the manual basis', _offState.currency === 'GBP' && _offState.fxRateRef === 0 && _offState.fxBasis === 'agreed');

global._offState = null;
SECTION('Availability when the offer is unawarded and has no sales-file record');
var d = baseOffers();
setOffers([d.fxSource, d.irrSource]);
setData('ptf_crm_deals', []);
T('unawarded CNY offer outside sales file is eligible FX→IRR', ptfOfferRialConvertCheck(d.fxSource.no).ok === true);
T('unawarded IRR offer outside sales file is eligible IRR→FX', ptfOfferFxConvertCheck(d.irrSource.no).ok === true);
setOffers([d.fxComp]);
T('companion status is excluded from second conversion', ptfOfferFxConvertCheck(d.fxComp.no).why === 'iscompanion');
setOffers([d.fxSource, d.rialComp, d.irrSource, d.fxComp]);

SECTION('FX→IRR: CNY, rate edits, terms synchronization and source isolation');
T('CNY numeric term is converted to IRR', ptfRialConvertTermText('Cost 10 CNY', 'CNY', 90000).indexOf('900,000 IRR') > -1);
T('CNY Persian term is converted to ریال', ptfRialConvertTermText('پرداخت ۵٬۰۰۰ یوان', 'CNY', 90).indexOf('450,000 ریال') > -1);
T('AED and GBP terms are recognized', ptfRialConvertTermText('AED 2; £3', 'AED', 100).indexOf('IRR 200') > -1 && ptfRialConvertTermText('£3', 'GBP', 100).indexOf('IRR 300') > -1);
resetModalNodes();
ptfOfferRialTermsOpen(d.rialComp.no);
T('IRR companion edit modal exposes the conversion rate', modalHtml.indexOf('id="sfRcTermsRate"') > -1 && modalHtml.indexOf('sfRcTermsRebuild()') > -1);
nodes.sfRcTermsRate.value = '90000';
sfRcTermsRateChanged();
confirmResult = false;
sfRcTermsSave(d.rialComp.no);
T('canceling stale-terms warning does not mutate the companion', +getOffer(d.rialComp.no).fxConvert.rate === 80000 && +getOffer(d.rialComp.no).items[0].price === 800000);
confirmResult = true;
sfRcTermsSave(d.rialComp.no);
var rialAfter = getOffer(d.rialComp.no);
T('confirmed FX→IRR rate edit persists on the companion', +rialAfter.fxConvert.rate === 90000 && rialAfter.currency === 'IRR');
T('FX→IRR item prices follow the new rate', +rialAfter.items[0].price === 900000);
T('stale FX→IRR terms stay explicit and record their old conversion basis', +rialAfter.fxConvert.termsRate === 80000 && rialAfter.fxConvert.termsCur === 'CNY');
T('the original CNY offer remains unchanged', getOffer(d.fxSource.no).currency === 'CNY' && getOffer(d.fxSource.no).items[0].price === 10 && getOffer(d.fxSource.no).terms[0] === 'قیمت 10 CNY');
resetModalNodes();
ptfOfferRialTermsOpen(d.rialComp.no);
nodes.sfRcTermsRate.value = '100000';
sfRcTermsRebuild();
sfRcTermsSave(d.rialComp.no);
rialAfter = getOffer(d.rialComp.no);
T('rebuilding FX→IRR terms records the new rate basis', +rialAfter.fxConvert.termsRate === 100000 && rialAfter.fxConvert.termsCur === 'CNY');
T('rebuilding FX→IRR terms writes converted CNY conditions to companion', rialAfter.terms.some(function (t) { return /1,000,000 IRR/.test(t); }));

SECTION('IRR→FX: currency/rate edits, rebuild and source isolation');
resetModalNodes();
ptfOfferFxTermsOpen(d.fxComp.no);
T('FX companion edit modal exposes all currencies and rate field', modalHtml.indexOf('id="sfFxTermsCur"') > -1 && ['USD','EUR','CNY','AED','GBP'].every(function (c) { return modalHtml.indexOf('value="' + c + '"') > -1; }) && modalHtml.indexOf('id="sfFxTermsRate"') > -1);
nodes.sfFxTermsCur.value = 'EUR';
sfFxTermsCurChanged();
T('changing USD→EUR loads the EUR live rate, not the old USD rate', +ptfNum(nodes.sfFxTermsRate.value) === 550000 && nodes.sfFxTermsRateLabel.textContent.indexOf('EUR') > -1 && nodes.sfFxTermsTitle.textContent.indexOf('EUR') > -1);
nodes.sfFxTermsRate.value = '600000';
sfFxTermsRateChanged();
confirmResult = false;
sfFxTermsSave(d.fxComp.no);
T('canceling stale FX terms warning leaves companion rate/currency unchanged', getOffer(d.fxComp.no).currency === 'USD' && +getOffer(d.fxComp.no).fxConvert.rate === 500000);
confirmResult = true;
sfFxTermsSave(d.fxComp.no);
var fxAfter = getOffer(d.fxComp.no);
T('confirmed IRR→FX edit persists EUR and the selected rate on companion', fxAfter.currency === 'EUR' && +fxAfter.fxConvert.rate === 600000 && +fxAfter.fxRateRef === 600000);
T('IRR→FX item prices follow the new rate', +fxAfter.items[0].price === 1.67);
T('old terms basis remains recorded when stale text is deliberately retained', fxAfter.fxConvert.termsCur === 'USD' && +fxAfter.fxConvert.termsRate === 500000);
T('the original IRR offer remains unchanged', getOffer(d.irrSource.no).currency === 'IRR' && getOffer(d.irrSource.no).items[0].price === 1000000 && getOffer(d.irrSource.no).terms[0] === 'قیمت 1,000,000 ریال');
resetModalNodes();
ptfOfferFxTermsOpen(d.fxComp.no);
nodes.sfFxTermsCur.value = 'CNY';
sfFxTermsCurChanged();
T('switching to CNY loads its available live rate', +ptfNum(nodes.sfFxTermsRate.value) === 70000);
nodes.sfFxTermsRate.value = '80000';
sfFxTermsRateChanged();
sfFxTermsRebuild();
sfFxTermsSave(d.fxComp.no);
fxAfter = getOffer(d.fxComp.no);
T('rebuilding IRR→FX conditions updates item, currency, rate and term basis', fxAfter.currency === 'CNY' && +fxAfter.fxConvert.rate === 80000 && +fxAfter.items[0].price === 12.5 && fxAfter.fxConvert.termsCur === 'CNY' && +fxAfter.fxConvert.termsRate === 80000);
T('IRR→FX rebuilt terms use the selected CNY currency', fxAfter.terms.some(function (t) { return /CNY|یوان/.test(t); }));
T('AED/GBP without a live quote clear the rate instead of retaining another currency rate', (function () {
  resetModalNodes(); ptfOfferFxTermsOpen(d.fxComp.no); nodes.sfFxTermsCur.value = 'GBP'; sfFxTermsCurChanged();
  return nodes.sfFxTermsRate.value === '' && nodes.sfFxTermsTotal.textContent === '—';
})());

SECTION('Visible companion-card access');
var fxCard = ptfIrrOfferFxInlineHtml(getOffer(d.irrSource.no));
T('IRR→FX companion card shows rate per selected currency and visible edit action', /ریال\/CNY/.test(fxCard) && /ویرایش ارز مقصد، نرخ تسعیر و شرایط نسخه ارزی/.test(fxCard) && /🔧 ویرایش/.test(fxCard));
var offersJs = fs.readFileSync(path.join(CRM, 'offers.js'), 'utf8');
var rialConvertAt = offersJs.indexOf('ptfOfferRialConvertOpenByNo(');
var fxConvertAt = offersJs.indexOf('ptfOfferFxConvertOpenByNo(');
var rialConvertGuard = offersJs.slice(Math.max(0, rialConvertAt - 360), rialConvertAt + 100);
var fxConvertGuard = offersJs.slice(Math.max(0, fxConvertAt - 360), fxConvertAt + 100);
T('FX→IRR conversion entry is available to unawarded base offers without a sales-file dependency', rialConvertAt > -1 && /!isWon/.test(rialConvertGuard) && /!o\.rialOf && !o\.fxOf/.test(rialConvertGuard) && /o\.currency && o\.currency !== 'IRR'/.test(rialConvertGuard) && !/deal/i.test(rialConvertGuard));
T('IRR→FX conversion entry is available to unawarded base offers without a sales-file dependency', fxConvertAt > -1 && /!isWon/.test(fxConvertGuard) && /!o\.rialOf && !o\.fxOf/.test(fxConvertGuard) && /!o\.currency \|\| o\.currency === 'IRR'/.test(fxConvertGuard) && !/deal/i.test(fxConvertGuard));
T('FX→IRR list card shows rate per source currency and visible accessible rate/terms edit', /ریال\/' \+ escP\(o\.currency\)/.test(offersJs) && /🔧 ویرایش نرخ\/شرایط/.test(offersJs) && /aria-label="ویرایش نرخ تسعیر و شرایط نسخه ریالی"/.test(offersJs));
T('modal notes tell users to rebuild converted terms before saving a changed rate', /همگام‌سازی بندها/.test(fs.readFileSync(path.join(CRM, 'offer-rial-convert.js'), 'utf8')) && /بازسازی بندها/.test(fs.readFileSync(path.join(CRM, 'offer-fx-convert.js'), 'utf8')));

DONE('tester693');
process.exit(RESULTS.fail ? 1 : 0);
