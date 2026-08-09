/* tester319 — کارتابل/روز من: اقدام‌محور و lifecycle ارجاع */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf8');
var rs = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf8');
var md = fs.readFileSync(path.join(BASE, 'myday.js'), 'utf8');

SECTION('قرارداد اقدام‌محور');
T('badge فقط actionableهای باز را می‌شمارد', rb.indexOf('!!n.actionable && !n.done') > -1);
T('کارتابل سه دسته اقدام من/هشدار/اطلاع‌رسانی دارد', rb.indexOf('🔴 اقدام من') > -1 && rb.indexOf('🟠 هشدارهای معتبر') > -1 && rb.indexOf('🔵 اطلاع‌رسانی') > -1);
T('پیشنهاد نزدیک/منقضی دیگر اعلان تولید نمی‌کند', br.indexOf('هیچ اعلان مزاحمی تولید نمی‌شود') > -1 && br.indexOf("kind: 'co_expiry'") === -1);
T('روز من پیشنهادهای منقضی/رو به انقضا را نمی‌خواند و پنج مورد سقف دارد', md.indexOf('CO های رو به انقضا') === -1 && md.indexOf('out.slice(0, 5)') > -1);
T('ارجاع‌ها نوع کار پایدار دارند', br.indexOf("'create_offer'") > -1 && br.indexOf("'create_technical_offer'") > -1 && br.indexOf("'create_supplier_rfq'") > -1);
T('ثبت CO/TO و استعلام تامین، ارجاع همسان را resolve می‌کند', of.indexOf("ptfResolveRfqReferral(o.inqNo, 'create_offer')") > -1 && of.indexOf("ptfResolveRfqReferral(o.inqNo, 'create_technical_offer')") > -1 && rs.indexOf("ptfResolveRfqReferral(_st.srcRfq, 'create_supplier_rfq')") > -1);

SECTION('رفتاری: حل شدن ارجاع‌ها');
global.window = global;
global.updateCartBadge = function () {}; global.updateInboxBadge = function () {};
eval(rb.match(/window\.ptfResolveRfqReferral = function \(inqNo, taskType\) \{[\s\S]*?\n\};/)[0]);
setData('ptf_crm_notifs', [
  { cd:'N-CO', kind:'referral', refCd:'RFQ-1', taskType:'create_offer', title:'صدور پیشنهاد مالی', actionable:true },
  { cd:'N-CO-INFO', kind:'referral_info', refCd:'RFQ-1', title:'ارجاع برای صدور پیشنهاد مالی', actionable:false },
  { cd:'N-TO', kind:'referral', refCd:'RFQ-1', taskType:'create_technical_offer', title:'صدور پیشنهاد فنی', actionable:true },
  { cd:'N-SUP', kind:'referral', refCd:'RFQ-1', taskType:'create_supplier_rfq', title:'استعلام قیمت از تامین‌کننده', actionable:true },
  { cd:'N-OLD', kind:'referral', refCd:'RFQ-2', title:'اقدام شما لازم است: صدور پیشنهاد مالی', actionable:true }
]);
T('CO، ارجاع مالی و اعلان عمومی همان RFQ را حذف می‌کند', ptfResolveRfqReferral('RFQ-1', 'create_offer') === 2 && getData('ptf_crm_notifs').some(function(n){return n.cd==='N-TO';}));
T('TO فقط ارجاع فنی را حل می‌کند و ارجاع تامین دست‌نخورده است', ptfResolveRfqReferral('RFQ-1', 'create_technical_offer') === 1 && getData('ptf_crm_notifs').some(function(n){return n.cd==='N-SUP';}));
T('استعلام تامین فقط task همسان را حل می‌کند', ptfResolveRfqReferral('RFQ-1', 'create_supplier_rfq') === 1);
T('ارجاع مالی legacy نیز حل می‌شود', ptfResolveRfqReferral('RFQ-2', 'create_offer') === 1 && getData('ptf_crm_notifs').length === 0);

DONE('tester319-v34.4.14-actionable-inbox');
