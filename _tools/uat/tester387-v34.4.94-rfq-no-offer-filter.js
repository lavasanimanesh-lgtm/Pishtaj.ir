'use strict';
var fs = require('fs');
var assert = require('assert');
var src = fs.readFileSync('crm/bridge.js', 'utf8');

assert.ok(src.indexOf('id="rOfferFlt"') > -1, 'filter select in RFQ toolbar');
assert.ok(src.indexOf('value="none"') > -1 && src.indexOf('بدون پیشنهاد') > -1, 'none-offer option');
assert.ok(src.indexOf('window.ptfRfqHasOffer') > -1, 'has-offer helper');
assert.ok(src.indexOf("ofFlt === 'none' && has") > -1, 'list filters requests without offers'); /* 2026-08-13: فیلتر به پرچم data-has-offer منتقل شد */

/* logic: match by cd or employer inqNo */
function hasOffer(r, offers) {
  return offers.some(function (o) {
    return o && o.inqNo && (o.inqNo === r.cd || (r.inqNo && o.inqNo === r.inqNo));
  });
}
var rfqs = [{ cd: 'RFQ-1', inqNo: 'EMP-9' }, { cd: 'RFQ-2' }, { cd: 'RFQ-3', inqNo: 'EMP-3' }];
var offers = [{ no: 'TO-1', inqNo: 'RFQ-1' }, { no: 'CO-1', inqNo: 'EMP-3' }];
assert.strictEqual(hasOffer(rfqs[0], offers), true);
assert.strictEqual(hasOffer(rfqs[1], offers), false);
assert.strictEqual(hasOffer(rfqs[2], offers), true);
assert.strictEqual(rfqs.filter(function (r) { return !hasOffer(r, offers); }).map(function (r) { return r.cd; }).join(), 'RFQ-2');

console.log('PASS tester387 rfq-no-offer-filter');
