#!/usr/bin/env node
'use strict';
/* v34.7.44 — modal Save button must preserve the base save receipt through wrappers. */
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var petty=fs.readFileSync('crm/petty.js','utf8');
var offers=fs.readFileSync('crm/offers.js','utf8');
var sales=fs.readFileSync('crm/sales-domain-v2.js','utf8');

var button=offers.match(/id="offSaveBtn"\s+onclick="([^"]+)"/);
assert.ok(button&&button[1]==='window.offerSave()','modal button invokes the current wrapped global save');
assert.ok(sales.indexOf('ret=legacyOfferSave.apply(this,arguments)')>-1&&sales.indexOf('if(!ret||!ret.ok)')>-1,'atomic orchestrator requires the legacy receipt');
var start=petty.indexOf('  var _offerSaveAdv = window.offerSave;');
var end=petty.indexOf('  var _setSt = window.offerSetSt;',start);
assert.ok(start>-1&&end>start,'petty offer wrapper is extractable');
var wrapper=petty.slice(start,end);
assert.ok(wrapper.indexOf('var saveResult = _offerSaveAdv.apply(this, arguments);')>-1&&wrapper.indexOf('return saveResult;')>-1,'petty wrapper forwards the exact save receipt');

var receipt={ok:true,offerNo:'CO-TEST',updatedAtISO:'2026-08-19T18:00:00Z'};
var calls=0;
var ctx={window:null,offerSave:function(){calls++;return receipt;},offerSetSt:function(){},getData:function(){return[];},setData:function(){},setTimeout:function(){},confirm:function(){return false;},console:console};
ctx.window=ctx;ctx.PTF_SALES_DOMAIN_V2=true;
vm.createContext(ctx);vm.runInContext(wrapper,ctx,{filename:'petty-offer-save-wrapper.js'});
/* Execute the exact inline handler emitted into #offSaveBtn, rather than calling the
   function directly as tester442 did. This is the browser click contract. */
var actual=vm.runInContext(button[1],ctx,{filename:'offSaveBtn.onclick'});
assert.strictEqual(calls,1,'one DOM click calls the base save once');
assert.strictEqual(actual,receipt,'DOM click receipt reaches the atomic orchestrator unchanged');

/* Regression scan: every known offerSave wrapper must either directly return apply()
   or store and return its result; a fire-and-forget wrapper can recreate the dead button. */
[
 ['crm/offers-pro.js','var _offerSave = window.offerSave;','/* ============ US-183'],
 ['crm/offerlock.js','var _offerSaveOld = window.offerSave;','/* ---------- US-203'],
 ['crm/workflow.js','var _save = window.offerSave;','// ۲) تغییر وضعیت پیشنهاد'],
 ['crm/salesfiles.js','function hookOfferSave()','/* ---------- جمع‌آوری زنده اسناد']
].forEach(function(spec){var src=fs.readFileSync(spec[0],'utf8'),a=src.indexOf(spec[1]),b=src.indexOf(spec[2],a);assert.ok(a>-1&&b>a,spec[0]+' wrapper extractable');var block=src.slice(a,b);assert.ok(/return\s+[_a-zA-Z][\w]*\.apply\(this,\s*arguments\)|return\s+result\b/.test(block),spec[0]+' forwards save receipt');});
console.log('PASS tester447-v34.7.44: offer modal save receipt survives every wrapper');
