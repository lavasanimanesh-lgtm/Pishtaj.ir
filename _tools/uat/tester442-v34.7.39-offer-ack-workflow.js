#!/usr/bin/env node
'use strict';
/* v34.7.39 — offer registration ACK and RFQ workflow are one server transaction. */
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var workflow=fs.readFileSync('crm/workflow.js','utf8');
var sales=fs.readFileSync('crm/sales-domain-v2.js','utf8');
var sync=fs.readFileSync('crm/sync.js','utf8');
var offersSrc=fs.readFileSync('crm/offers.js','utf8');
var api=fs.readFileSync('api/sales-domain.php','utf8');
var transport=fs.readFileSync('api/crm.php','utf8');

assert.ok(api.indexOf("$changes=['ptf_crm_offers'=>$offers];if(!empty($wfResult['found']))$changes['ptf_crm_rfqs']=$rfqs")>-1,'register_offer must commit offer + RFQ projection together');
assert.ok(api.indexOf('sd_apply_offer_workflow($rfqs,$offers')>-1,'server workflow projection');
assert.ok(api.indexOf("$createIntent=!empty($body['createIntent'])")>-1&&api.indexOf("if($createIntent&&$incomingId===''&&count($noIndexes)>0)")>-1,'a concurrent owner of a newly reserved number is never overwritten');
assert.ok(api.indexOf("unset($incoming['_serverState'],$incoming['_serverOpId'],$incoming['_serverError'])")>-1,'local command markers stripped server-side');
assert.ok(transport.indexOf('sync_offers_payload_has_unregistered_new')>-1,'generic data_push rejects unregistered offers');
assert.ok(/if\(!isset\(\$serverNos\[\$no\]\)\)return true/.test(transport) && transport.indexOf("&&empty($offer['serverRegisteredAt'])")<0,'generic data_push trusts only the server snapshot, never a spoofed client stamp');
assert.ok(sync.indexOf('ptfSyncHoldCommandKeys')>-1&&sync.indexOf('syncKeyHeld(k)')>-1&&sync.indexOf('var heldMerged = window.ptfSmartMerge')>-1,'sync command hold blocks generic push and merges catch-up pulls');
assert.ok(offersSrc.indexOf('ptfOfferAfterServerCommit')>-1&&offersSrc.indexOf("meta.serverConfirmed !== true")>-1&&offersSrc.indexOf('offer_command_unavailable')>-1,'irreversible offer side effects are fail-closed and post-ACK only');
assert.ok(workflow.indexOf('PTF_OFFER_COMMAND_SAVE_ACTIVE')>-1,'legacy workflow refresh suppressed during command');
assert.ok(/wfRefresh\(target\.inqNo,\s*'حذف پیشنهاد '/.test(offersSrc),'deleting the last offer recomputes its own RFQ');

function storage(seed){var d=Object.assign({},seed||{});return{_d:d,getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];},key:function(i){return Object.keys(d)[i]||null;},get length(){return Object.keys(d).length;}};}
function tick(){return new Promise(function(r){setImmediate(r);});}
function makeCtx(mode){
  var ls=storage({ptf_crm_token:'tok',ptf_crm_offers:'[]',ptf_crm_rfqs:JSON.stringify([{cd:'RFQ-1',inqNo:'RFQ-1',wf:'WF10',st:'st1',stxt:'📥 دریافت اولیه'}]),ptf_crm_products:'[]',ptf_crm_inqitems:'[]',ptf_crm_notifs:'[]'});
  var fetchResolve=null,fetchReject=null,requests=[],alerts=[],post=[],held=[],released=[],acked=[];
  var btn={disabled:false,textContent:'💾 ذخیره'};
  var ctx={window:null,console:console,JSON:JSON,Math:Math,Date:Date,Promise:Promise,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Error:Error,
    localStorage:ls,
    getData:function(k){try{return JSON.parse(ls.getItem(k)||'[]');}catch(e){return[];}},
    setData:function(k,v){ls.setItem(k,JSON.stringify(v));return true;},
    curSession:function(){return{user:'sales-mobile',name:'فروش موبایل'};},curRole:function(){return'sales';},
    faDateTime:function(){return'1405/05/28 12:00';},audit:function(){},addLog:function(){},renderRfq:function(){},renderOffers:function(){},
    ptfToast:function(){},alert:function(m){alerts.push(String(m));},confirm:function(){return false;},prompt:function(){return null;},
    document:{hidden:true,activeElement:null,hasFocus:function(){return true;},getElementById:function(id){return id==='offSaveBtn'?btn:null;},querySelector:function(){return null;},querySelectorAll:function(){return[];},addEventListener:function(){},createElement:function(){return{style:{},setAttribute:function(){},appendChild:function(){},textContent:''};},head:{appendChild:function(){}},body:{appendChild:function(){},insertAdjacentHTML:function(){}}},
    navigator:{},location:{},addEventListener:function(){},setInterval:function(){return 1;},clearInterval:function(){},setTimeout:function(){return 1;},clearTimeout:function(){},
    ptfSyncPendingKeys:function(){return[];},ptfSyncHoldCommandKeys:function(k){held.push(k.slice());},ptfSyncReleaseCommandKeys:function(k){released.push(k.slice());},ptfSyncAcknowledgeCommandKeys:function(k){acked.push(k.slice());},ptfSyncNotifyDirty:function(){},
    ptfSyncApplyServerProjection:function(k,v){ls.setItem(k,JSON.stringify(v));return true;},ptfSyncAcceptServerRevision:function(){},ptfSyncPullNow:function(cb){cb({ok:true});},
    ptfOfferAfterServerCommit:function(o,m){post.push({offer:o,meta:m});},
    fetch:function(url,opt){requests.push({url:url,body:JSON.parse(opt.body)});if(mode==='manual')return new Promise(function(resolve,reject){fetchResolve=resolve;fetchReject=reject;});return Promise.resolve({ok:false,status:422,text:function(){return Promise.resolve(JSON.stringify({ok:false,error:'duplicate_offer_no'}));}});}
  };
  ctx.window=ctx;
  ctx._offState={no:'PTF-CO-1405-9999',kind:'CO',inqNo:'RFQ-1',buyerCd:'C-1',buyerCo:'Customer',items:[{name:'X',qty:1,price:100}],st:'draft',updatedAtISO:'2026-08-19T08:00:00.000Z'};
  ctx.offerSave=function(){var a=ctx.getData('ptf_crm_offers');a.unshift(JSON.parse(JSON.stringify(ctx._offState)));ctx.setData('ptf_crm_offers',a);var p=ctx.getData('ptf_crm_products');p.push({cd:'P-COMMAND',nm:'X'});ctx.setData('ptf_crm_products',p);return{ok:true,offerNo:ctx._offState.no,updatedAtISO:ctx._offState.updatedAtISO,idx:-1,madeRevision:false,productSyncNotes:['1 کالای فرمان']};};
  vm.createContext(ctx);vm.runInContext(workflow,ctx,{filename:'workflow.js'});vm.runInContext(sales,ctx,{filename:'sales-domain-v2.js'});
  return{ctx:ctx,ls:ls,requests:requests,alerts:alerts,post:post,held:held,released:released,acked:acked,btn:btn,resolve:function(v){fetchResolve(v);},reject:function(e){fetchReject(e);}};
}

(async function(){
  var ok=makeCtx('manual');
  var result=ok.ctx.offerSave();
  assert.ok(result&&result.pendingServer,'save returns pending server receipt');
  assert.strictEqual(ok.ctx.getData('ptf_crm_rfqs')[0].wf,'WF10','RFQ must not become WF50 before ACK');
  assert.strictEqual(ok.ctx.wfCompute(ok.ctx.getData('ptf_crm_rfqs')[0]),'WF10','pending local offer is not issued');
  assert.strictEqual(ok.post.length,0,'post-commit effects wait');
  assert.strictEqual(ok.btn.disabled,true,'save button locked while command in flight');
  assert.strictEqual(ok.requests.length,1);
  assert.strictEqual(ok.requests[0].body.offer._serverState,undefined,'local marker not sent');
  assert.strictEqual(ok.requests[0].body.createIntent,true,'new-offer identity intent is explicit');
  var canonical={_id:'OFR-1',no:'PTF-CO-1405-9999',kind:'CO',inqNo:'RFQ-1',buyerCd:'C-1',items:[{name:'X',qty:1,price:100}],st:'draft',updatedAtISO:'2026-08-19T08:00:00.000Z',serverRegisteredAt:'2026-08-19T08:00:01Z'};
  var rfq={cd:'RFQ-1',inqNo:'RFQ-1',wf:'WF50',st:'st1',stxt:'💵 پیشنهاد مالی صادر شد',wfUpdatedAtISO:'2026-08-19T08:00:01Z',wfLog:[{wf:'WF50'}]};
  ok.resolve({ok:true,status:200,text:function(){return Promise.resolve(JSON.stringify({ok:true,rev:44,result:{offerId:'OFR-1',wf:'WF50'},data:{ptf_crm_offers:[canonical],ptf_crm_rfqs:[rfq]}}));}});
  await result.promise;
  assert.strictEqual(ok.ctx.getData('ptf_crm_rfqs')[0].wf,'WF50','server projection publishes WF50 with offer');
  assert.strictEqual(ok.ctx.getData('ptf_crm_offers')[0].serverRegisteredAt,'2026-08-19T08:00:01Z');
  assert.strictEqual(ok.post.length,1,'irreversible effects execute after ACK');
  assert.strictEqual(ok.post[0].meta.serverConfirmed,true);
  assert.ok(ok.acked.some(function(x){return x.indexOf('ptf_crm_offers')>-1&&x.indexOf('ptf_crm_rfqs')>-1;}),'command projections acknowledged together');
  ok.ctx.setData('ptf_crm_offers',[]);
  ok.ctx.wfRefresh('RFQ-1',{reason:'offer_delete'});
  assert.strictEqual(ok.ctx.getData('ptf_crm_rfqs')[0].wf,'WF10','deleting the final authoritative offer returns its RFQ to WF10');

  var bad=makeCtx('reject');
  var rejected=bad.ctx.offerSave();
  await assert.rejects(rejected.promise,/duplicate_offer_no/);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(bad.ctx.getData('ptf_crm_offers'))),[],'rejected offer projection rolled back');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(bad.ctx.getData('ptf_crm_products'))),[],'command-owned product projection is compensated on rejection');
  assert.strictEqual(bad.ctx.getData('ptf_crm_rfqs')[0].wf,'WF10','rejection never advances RFQ');
  assert.strictEqual(bad.post.length,0,'no referral/SMS/post-commit effects on rejection');
  assert.strictEqual(bad.btn.disabled,false,'form remains retryable');
  assert.ok(bad.ls.getItem('ptf_autodraft_offer_CO'),'rejected payload retained as autodraft');
  assert.ok(bad.alerts.some(function(x){return x.indexOf('وضعیت درخواست تغییر نکرد')>-1;}),'user gets explicit non-commit receipt');

  /* A late rejection compensates only command deltas, never another tab's records. */
  var concurrent=makeCtx('manual'),concurrentSave=concurrent.ctx.offerSave();
  var cp=concurrent.ctx.getData('ptf_crm_products');cp.push({cd:'P-OTHER-TAB',nm:'Independent'});concurrent.ctx.setData('ptf_crm_products',cp);
  var co=concurrent.ctx.getData('ptf_crm_offers');co.push({no:'PTF-CO-OTHER',inqNo:'RFQ-OTHER',serverRegisteredAt:'2026-08-19T08:00:02Z'});concurrent.ctx.setData('ptf_crm_offers',co);
  concurrent.reject(new Error('late_mobile_failure'));
  await assert.rejects(concurrentSave.promise,/late_mobile_failure/);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(concurrent.ctx.getData('ptf_crm_products'))),[{cd:'P-OTHER-TAB',nm:'Independent'}],'three-way compensation preserves another tab and removes command product');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(concurrent.ctx.getData('ptf_crm_offers'))),[{no:'PTF-CO-OTHER',inqNo:'RFQ-OTHER',serverRegisteredAt:'2026-08-19T08:00:02Z'}],'three-way compensation never rolls back the whole offer collection');

  /* Server committed but the mobile response was lost: retry must replay the same operation. */
  var lost=makeCtx('manual');
  var firstLost=lost.ctx.offerSave(),firstKey=lost.requests[0].body.idempotencyKey;
  lost.reject(new Error('mobile_response_lost_after_commit'));
  await assert.rejects(firstLost.promise,/mobile_response_lost_after_commit/);
  var retained=JSON.parse(lost.ls.getItem('ptf_autodraft_offer_CO'));
  assert.strictEqual(retained._serverOpId,firstKey,'unknown-outcome operation id retained in autodraft');
  assert.strictEqual(lost.ctx.getData('ptf_crm_offers').length,0,'lost response does not leave a publishable local offer');
  var retry=lost.ctx.offerSave();
  assert.strictEqual(lost.requests[1].body.idempotencyKey,firstKey,'retry reconciles with the exact same idempotency key');
  lost.resolve({ok:true,status:200,text:function(){return Promise.resolve(JSON.stringify({ok:true,rev:44,result:{offerId:'OFR-1',wf:'WF50'},data:{ptf_crm_offers:[canonical],ptf_crm_rfqs:[rfq]}}));}});
  await retry.promise;
  assert.strictEqual(lost.post.length,1,'idempotent replay runs post-ACK effects exactly once in this client');
  assert.strictEqual(lost.ctx.getData('ptf_crm_rfqs')[0].wf,'WF50','replayed ACK reconciles both device projections');

  /* RFQ merge transition timestamp outranks stale wfLog completeness. */
  var mergeLs=storage(),mctx={window:null,console:console,localStorage:mergeLs,setData:function(){return true;},getData:function(){return[];},curRole:function(){return'sales';},curSession:function(){return{user:'sales'};},document:{getElementById:function(){return null;},querySelector:function(){return null;},querySelectorAll:function(){return[];},addEventListener:function(){},hidden:true,hasFocus:function(){return true;},documentElement:{style:{setProperty:function(){}}}},navigator:{},location:{},setInterval:function(){return 1;},clearInterval:function(){},setTimeout:function(){return 1;},clearTimeout:function(){},fetch:function(){return new Promise(function(){});},alert:function(){},addEventListener:function(){},Promise:Promise,Date:Date,JSON:JSON,Math:Math,Object:Object,Array:Array,String:String,Number:Number,RegExp:RegExp,Error:Error};mctx.window=mctx;vm.createContext(mctx);vm.runInContext(sync,mctx,{filename:'sync.js'});
  var stale=[{cd:'RFQ-1',wf:'WF50',stxt:'old',wfUpdatedAtISO:'2026-08-19T08:00:00Z',wfLog:[{wf:'WF50'},{wf:'WF50'}]}];
  var fixed=[{cd:'RFQ-1',wf:'WF10',stxt:'new',wfUpdatedAtISO:'2026-08-19T08:01:00Z',wfLog:[]}];
  var merged=JSON.parse(mctx.ptfSmartMerge('ptf_crm_rfqs',JSON.stringify(stale),JSON.stringify(fixed)));
  assert.strictEqual(merged[0].wf,'WF10','newer authoritative workflow beats more-complete stale WF50');
  var devicePending=[{no:canonical.no,kind:'CO',inqNo:'RFQ-1',buyerCd:'C-1',items:canonical.items,st:'draft',updatedAtISO:canonical.updatedAtISO,_serverState:'sending',_serverOpId:'OP-DEVICE-A'}];
  var crossDevice=JSON.parse(mctx.ptfSmartMerge('ptf_crm_offers',JSON.stringify(devicePending),JSON.stringify([canonical])));
  assert.strictEqual(crossDevice[0].serverRegisteredAt,canonical.serverRegisteredAt,'device B canonical ACK outranks device A pending projection');
  assert.strictEqual(crossDevice[0]._serverState,undefined,'two-device merge does not republish a pending command marker');
  var pendingEdit=Object.assign({},canonical,{buyerCo:'UNACKED-EDIT',_serverState:'sending',_serverOpId:'OP-EDIT'});
  var editReplay=JSON.parse(mctx.ptfSmartMerge('ptf_crm_offers',JSON.stringify([pendingEdit]),JSON.stringify([canonical])));
  assert.strictEqual(editReplay[0]._serverState,undefined,'canonical replay also clears markers from an existing-offer edit');
  assert.strictEqual(editReplay[0].buyerCo,undefined,'unknown-outcome edit fields cannot leak through record-field merge');
  var heldProducts=JSON.parse(mctx.ptfSmartMerge('ptf_crm_products',JSON.stringify([{cd:'P-1',nm:'Command edit',ts:'2026-08-19T08:02:00Z'}]),JSON.stringify([{cd:'P-1',nm:'Server old',ts:'2026-08-19T08:01:00Z'},{cd:'P-2',nm:'Other device',ts:'2026-08-19T08:01:30Z'}])));
  assert.ok(heldProducts.some(function(p){return p.cd==='P-1'&&p.nm==='Command edit';})&&heldProducts.some(function(p){return p.cd==='P-2';}),'held side projection merges command delta with another device');

  var version=JSON.parse(fs.readFileSync('VERSION.json','utf8')).crm_version.slice(1);
  var idx=fs.readFileSync('crm/index.html','utf8'),sw=fs.readFileSync('crm/sw.js','utf8');
  var scriptVersions=Array.from(idx.matchAll(/<script[^>]+src="[^"]+\.js\?v=([^"]+)"/g)).map(function(m){return m[1];});
  assert.ok(scriptVersions.length>90&&scriptVersions.every(function(v){return v===version;}),'all index scripts use release cache key');
  assert.ok(sw.indexOf("ASSET_VERSION = '"+version+"'")>-1,'SW cache version aligned');
  assert.ok(sw.indexOf("'./finance-write-guard.js' + ASSET_QUERY")>-1&&sw.indexOf("'./case-revision.js' + ASSET_QUERY")>-1,'complete PWA shell');
  console.log('PASS tester442-v34.7.39: offer ACK + RFQ transaction + rollback + merge + PWA release');
})().catch(function(e){console.error(e&&e.stack||e);process.exitCode=1;});
