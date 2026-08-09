/* tester319 — کارتابل/روز من: اقدام‌محور و حل خودکار ارجاع پیشنهاد */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf8');
var md = fs.readFileSync(path.join(BASE, 'myday.js'), 'utf8');

SECTION('قرارداد اقدام‌محور');
T('badge فقط actionableهای باز را می‌شمارد', rb.indexOf('!!n.actionable && !n.done') > -1);
T('کارتابل سه دسته اقدام من/هشدار/اطلاع‌رسانی دارد', rb.indexOf('🔴 اقدام من') > -1 && rb.indexOf('🟠 هشدارهای معتبر') > -1 && rb.indexOf('🔵 اطلاع‌رسانی') > -1);
T('پیشنهاد نزدیک/منقضی دیگر اعلان تولید نمی‌کند', br.indexOf('هیچ اعلان مزاحمی تولید نمی‌شود') > -1 && br.indexOf("kind: 'co_expiry'") === -1);
T('روز من پیشنهادهای منقضی/رو به انقضا را نمی‌خواند و پنج مورد سقف دارد', md.indexOf('CO های رو به انقضا') === -1 && md.indexOf('out.slice(0, 5)') > -1);
T('ارجاع مالی refCd و taskType پایدار دارد', br.indexOf("taskType = act === 'صدور پیشنهاد مالی (CO)' ? 'create_offer'") > -1 && br.indexOf("refCd: cd, taskType: taskType") > -1);
T('offerSave پس از ذخیره CO ارجاع مرتبط را resolve می‌کند', of.indexOf('ptfResolveOfferReferral(o.inqNo)') > -1);

SECTION('رفتاری: حل شدن ارجاع پس از صدور پیشنهاد');
global.window = global;
global.updateCartBadge = function () {}; global.updateInboxBadge = function () {};
eval(rb.match(/window\.ptfResolveOfferReferral = function \(inqNo\) \{[\s\S]*?\n\};/)[0]);
setData('ptf_crm_notifs', [
  { cd:'N-CO', kind:'referral', refCd:'RFQ-1', taskType:'create_offer', title:'صدور پیشنهاد مالی', actionable:true },
  { cd:'N-CO-INFO', kind:'referral_info', refCd:'RFQ-1', title:'ارجاع برای صدور پیشنهاد مالی', actionable:false },
  { cd:'N-TO', kind:'referral', refCd:'RFQ-1', taskType:'create_technical_offer', title:'صدور پیشنهاد فنی', actionable:true },
  { cd:'N-OLD', kind:'referral', refCd:'RFQ-2', title:'اقدام شما لازم است: صدور پیشنهاد مالی', actionable:true }
]);
T('ارجاع CO و اعلان عمومی همان RFQ حذف می‌شوند اما ارجاع فنی باقی می‌ماند', ptfResolveOfferReferral('RFQ-1') === 2 && getData('ptf_crm_notifs').length === 2 && getData('ptf_crm_notifs').some(function(n){return n.cd==='N-TO';}));
T('ارجاع مالی legacy نیز با ثبت پیشنهاد حل می‌شود', ptfResolveOfferReferral('RFQ-2') === 1 && getData('ptf_crm_notifs').length === 1);

DONE('tester319-v34.4.14-actionable-inbox');
