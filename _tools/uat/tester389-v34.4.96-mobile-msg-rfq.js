'use strict';
var fs = require('fs');
var assert = require('assert');
var msg = fs.readFileSync('crm/messengers.js', 'utf8');
var br = fs.readFileSync('crm/bridge.js', 'utf8');
var inq = fs.readFileSync('crm/inqreader.js', 'utf8');

assert.ok(msg.indexOf('class="msg-logo"') > -1, 'colored messenger SVGs');
assert.ok(msg.indexOf('function ensureMsgQuickCss') > -1, 'messenger CSS');
assert.ok(msg.indexOf('class="ba msg-quick-app') < 0, 'quick links not using .ba');
assert.ok(br.indexOf('rfq-offer-bar') > -1 && br.indexOf('ptfRfqOfferFlt') > -1, 'visible no-offer chips');
assert.ok(inq.indexOf("icos[onClickName]") > -1, 'RFQ actions icon-only');

console.log('PASS tester389 mobile-msg-rfq');
