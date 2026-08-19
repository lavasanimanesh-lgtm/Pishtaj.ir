#!/usr/bin/env node
'use strict';
/* v34.7.45 — award revision reuses the full financial-offer form and recovers ACK by durable receipt. */
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var revision=fs.readFileSync('crm/case-revision.js','utf8');
var offers=fs.readFileSync('crm/offers.js','utf8');
var server=fs.readFileSync('api/sales-domain.php','utf8');
var sales=fs.readFileSync('crm/sales-domain-v2.js','utf8');
var index=fs.readFileSync('crm/index.html','utf8');

/* There must be one offer editing surface, not a second reduced revision table. */
assert.ok(revision.indexOf('W.offerForm();')>-1&&revision.indexOf('W.ptfSetOffState(draft)')>-1,'revision opens the canonical offer form with the revision draft state');
assert.strictEqual(revision.indexOf('ptfRevBody'),-1,'parallel reduced revision item table was removed');
[
 'offLoadInqItems()','offOpenProductMultiPicker()','offXls','offItemsWrap','ofRefToCatalog',
 'offTermsWrap','offAddTermLib()','offAddTerm(\\\'\\\')','offerPreview()'
].forEach(function(token){assert.ok(offers.indexOf(token)>-1,'canonical form contains '+token);});
assert.ok(revision.indexOf("save.setAttribute('onclick','window.ptfAwardReviseSubmit")>-1,'canonical Save button is rebound only to atomic award revision');
assert.ok(revision.indexOf('W.offValidateItems')>-1&&revision.indexOf('W.ptfItemRefPrice')>-1,'full item validation and effective reference prices are used');
assert.ok(/offerDocument:\{[\s\S]*terms:Array\.isArray\(o\.terms\)/.test(revision),'terms and full offer document metadata are sent with the revision');
assert.ok(/ctx\.pendingPayload=revisionCopy\(payload\)/.test(revision)&&/setRevisionControlsLocked\(true,true\)/.test(revision),'uncertain intent is frozen and exact payload is retained');
assert.ok(offers.indexOf('ptf_autodraft_award_revision_')>-1&&revision.indexOf('clearRevisionDraft(ctx)')>-1,'revision autosave cannot overwrite a new financial-offer draft');

/* Existing line metadata must survive the UI projection before it reaches the server. */
var db={ptf_crm_offers:[{_id:'O-1',no:'CO-1',st:'won',items:[{lineId:'L-1',name:'Valve',qty:2,price:100,refPrice:70,refCur:'IRR',refSrc:'request',marginPct:42.9,extra:{Warranty:'18m'},dlv:'2 weeks'}],terms:['Delivery: 2 weeks']} ]};
var ctx={window:null,console:console,JSON:JSON,Object:Object,Array:Array,String:String,Number:Number,Date:Date,Math:Math,getData:function(k){return db[k]||[];},setData:function(){},localStorage:{getItem:function(){return null;},setItem:function(){}},curRole:function(){return'commercial';},curSession:function(){return{name:'Tester'};}};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(revision,ctx,{filename:'case-revision.js'});
var projected=ctx.ptfCaseAwardLines({wonOffer:'CO-1'}).items[0];
assert.strictEqual(projected.refPrice,70);assert.strictEqual(projected.extra.Warranty,'18m');assert.strictEqual(projected.dlv,'2 weeks');assert.strictEqual(projected._revisionSourceIndex,0);

/* Server stores the same document fields and item metadata atomically. */
assert.ok(server.indexOf("$document = is_array($body['offerDocument']")>-1&&server.indexOf("$documentPatch['terms']")>-1,'server accepts sanitized document terms');
assert.ok(server.indexOf("foreach($documentPatch as $field=>$value)$parent[$field]=$value")>-1,'document patch is applied to the same winning offer');
['refPrice','refBuyPrice','marginPct','profitMarginPct'].forEach(function(field){assert.ok(server.indexOf("'"+field+"'")>-1,'server preserves '+field);});
assert.ok(server.indexOf('award_revision_identity_change_forbidden')>-1,'customer/inquiry/currency identity remains locked');

/* A lost large response is resolved from a compact owner-bound durable receipt. */
assert.ok(server.indexOf("$action === 'command_status'")>-1&&server.indexOf('idempotency_key_owner_mismatch')>-1,'compact status endpoint is owner-bound');
var statusBlock=server.slice(server.indexOf("if ($action === 'command_status')"),server.indexOf("if ($action === 'migration_dry_run')"));
assert.ok(statusBlock.indexOf('flock($receiptLock,LOCK_EX)')>-1&&statusBlock.indexOf('sd_recover_pending_transactions();')>-1,'status receipt completes pending WAL under the shared lock before answering');
var resultDataBlock=server.slice(server.indexOf('function sd_result_data'),server.indexOf('function sd_command_request_hash'));
assert.ok(resultDataBlock.indexOf("ptf_crm_sales_commands') continue")>-1,'full server journal is never downloaded in mutation projections');
assert.ok(sales.indexOf('recoverCommandReceipt(action,payload,replayError)')>-1&&sales.indexOf('receipt.compactReceipt=true')>-1,'client checks durable receipt before declaring uncertainty');
assert.ok(sales.indexOf('ptfRecoverUncertainSalesCommands')>-1&&index.indexOf('window.ptfRecoverUncertainSalesCommands()')>-1,'persisted uncertain operation is checked after authenticated CRM boot without mutation replay');
console.log('PASS tester448-v34.7.45: full offer-form revision + metadata parity + compact receipt recovery');
