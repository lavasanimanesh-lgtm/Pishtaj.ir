/* Sanity harness for crm/offers-pro.js template changes (v34.39.44). Run with node. */
'use strict';

global.window = global;
global.document = {
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, setAttribute: function () {} }; },
  body: { appendChild: function () {} }
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.alert = function () {};

global.getData = function (k) {
  if (k === 'ptf_crm_offers') return [];
  if (k === 'ptf_crm_sigprofiles') return {};
  return [];
};
global.escP = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
};
global.SELLER_INFO = {
  company: 'Pishro Tajhiz Fartak Co.',
  nationalId: '14010077558',
  contact: 'Sales Department',
  tel: '+98 (21) 4608 7679',
  email: 'info@pishtaj.ir',
  address: 'Unit 1, 16th Floor, Administrative Block A, Tooba Commercial-Administrative Complex, Kouhak Blvd, Tehran, Iran',
  logo: '../assets/images/ptf-logo.png'
};
global.BASE_COLS_CO = [
  { k: 'name', lb: 'Item' }, { k: 'desc', lb: 'Description' },
  { k: 'brand', lb: 'Brand' }, { k: 'model', lb: 'Model' },
  { k: 'qty', lb: 'Qty' }, { k: 'unit', lb: 'Unit' }
];
global.BASE_COLS_TO = [
  { k: 'name', lb: 'Item' }, { k: 'desc', lb: 'Description' },
  { k: 'brand', lb: 'Brand' }, { k: 'model', lb: 'Model' },
  { k: 'qty', lb: 'Qty' }, { k: 'unit', lb: 'Unit' }
];
global.numToWords = function () { return 'ONE THOUSAND'; };
global.ptfNum = function (v) { return +v || 0; };
global.ptfEnDigits = function (s) { return s; };
global.curSession = function () { return { user: 'admin' }; };

require('../../crm/offers-pro.js');

/* stub AFTER load — offers-pro.js defines its own ptfPreviewPrintableDoc */
var captured = null;
global.window.ptfPreviewPrintableDoc = function (title, html, name) { captured = { title: title, html: html, name: name }; };
global.window.ptfShareHtmlToMessenger = function () {};

function makeOffer(kind) {
  return {
    no: 'CO-1404-0001', kind: kind, rev: 0, dateEn: '2026-10-03', inqNo: 'INQ-99',
    buyerCo: 'Test Co', buyerContact: 'Mr. X', buyerTel: '+9821111',
    sellerContact: 'Sales', validUntil: '2026-11-03', currency: 'IRR',
    items: [
      { name: 'Ball Valve 2"', desc: 'Full bore; PN40', brand: 'PTF', model: 'BV-200', qty: 3, unit: 'NO', price: 12500000 },
      { name: 'Gate Valve 4"', desc: 'Rising stem', brand: 'PTF', model: 'GV-400', qty: 2, unit: 'NO', price: 40000000 },
      { name: 'Pressure Gauge', desc: '0-16 bar', brand: 'Wika', model: 'PG-16', qty: 5, unit: 'NO', price: 3200000 }
    ],
    terms: ['Prices are in IRR.', 'Delivery: 10 days.']
  };
}

var tpls = ['letterhead', 'executive', 'mono', 'minimal', 'classic'];
var fails = 0, passes = 0;
function check(cond, msg) {
  if (cond) { passes++; console.log('  PASS  ' + msg); } else { fails++; console.log('  FAIL  ' + msg); }
}

['CO', 'TO', 'TC'].forEach(function (kind) {
  tpls.forEach(function (tpl) {
    captured = null;
    global.window.offerPrintTpl(makeOffer(kind), tpl, false);
    var h = captured ? captured.html : '';
    console.log('\n== ' + kind + ' / ' + tpl + ' (' + h.length + ' chars) ==');
    check(h.length > 1000, 'document rendered');
    var ftr = (h.match(/<div class="ftr"[^>]*>[\s\S]*?<\/div>/) || [''])[0];
    check(ftr.indexOf(SELLER_INFO.address) > -1, 'footer preserves full address');
    check(!/<br\b/i.test(ftr), 'footer has no forced line break');
    check(ftr.indexOf('021-91099242') > -1, 'footer has new phone 021-91099242');
    check(ftr.indexOf('+98 992 586 8479') > -1, 'footer has WhatsApp +98 992 586 8479');
    check(ftr.indexOf('info@pishtaj.ir') > -1, 'footer has email info@pishtaj.ir');
    check(ftr.indexOf('4608') < 0, 'footer has NO old phone (4608)');
    check(ftr.indexOf('www.pishtaj.ir') > -1, 'footer keeps www.pishtaj.ir');
    var vendorBox = h.slice(h.indexOf('From (Vendor)'), h.indexOf('To (Client)'));
    check(vendorBox.indexOf('+98 (21) 9109 9242') > -1, 'vendor box has new phone +98 (21) 9109 9242 (prefixes kept)');
    check(vendorBox.indexOf('4608') < 0, 'vendor box has NO old phone (4608)');
    check(h.indexOf('4608') < 0, 'old phone (4608) nowhere in the whole document');
    // The old 8.5mm spacer inside the item table only protected table pages.
    // The new outer table reserves space for ALL content, including terms/signature.
    check(h.indexOf('<body data-offer-safe-page>') > -1, 'offer enables protected layout controls');
    check(/<table class="offer-page"><thead><tr><td><\/td><\/tr><\/thead>/.test(h), 'repeating header belongs to outer page table');
    check(h.indexOf('<tfoot><tr><td></td></tr></tfoot></table>') > h.indexOf('Terms &amp; Conditions'), 'repeating footer covers terms as well as items');
    check(h.indexOf('.offer-page>thead{display:table-header-group}') > -1, 'top spacer repeats on every page');
    check(h.indexOf('.offer-page>tfoot{display:table-footer-group}') > -1, 'bottom spacer repeats on every page');
    check(h.indexOf('.offer-page>thead>tr>td{height:10mm') > -1, 'top safety zone clears letterhead bar');
    check(h.indexOf('.offer-page>tfoot>tr>td{height:26mm') > -1, 'bottom safety zone reserves contact/artwork space');
    check(h.indexOf('.ftr{bottom:10mm;') > -1, 'contact line clears the bottom artwork');
    check(h.indexOf('@page{size:A4 landscape;margin:0!important}') > -1, 'physical sheet edges retained in print');
    if (tpl === 'letterhead') {
      check(h.indexOf('height:8.5mm;line-height:8.5mm') < 0, 'obsolete item-only spacer removed');
      check(h.indexOf('.parties{margin:4mm 0}') > -1, 'no obsolete negative parties compensation');
      check(h.indexOf('.bar-top{position:fixed;top:0;') > -1, 'top artwork stays at sheet edge');
      check(h.indexOf('.bar-bot{position:fixed;bottom:0;') > -1, 'bottom artwork stays at sheet edge');
    }
    if (tpl === 'executive') {
      check(h.indexOf('tbody tr:not(.total):nth-child(even) td{background:#fafbfc}') > -1, 'zebra striping excludes grand total');
      check(h.indexOf('tr.total td{background:#2b2e33;color:#fff;') > -1, 'total retains dark background');
      check(/\.total \.words\{[^}]*color:#fff;/.test(h), 'amount in words is white on dark background');
    }
  });
});

console.log('\n=== tester685: ' + passes + ' PASS / ' + fails + ' FAIL ===');
console.log(fails === 0 ? 'ALL CHECKS PASSED ✔' : fails + ' CHECK(S) FAILED ✘');
process.exit(fails === 0 ? 0 : 1);
