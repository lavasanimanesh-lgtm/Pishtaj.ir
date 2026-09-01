#!/usr/bin/env node
'use strict';
/* v34.7.43 — generic sales/finance command certainty + durable server WAL. */
var fs=require('fs'),vm=require('vm'),assert=require('assert');
var sales=fs.readFileSync('crm/sales-domain-v2.js','utf8');
var api=fs.readFileSync('api/sales-domain.php','utf8');
var transport=fs.readFileSync('api/crm.php','utf8');
var official=fs.readFileSync('crm/official-invoice-v2.js','utf8');
var unofficial=fs.readFileSync('crm/unofficial-invoice.js','utf8');
var inq=fs.readFileSync('crm/inqreader.js','utf8');
var projects=fs.readFileSync('crm/projects.js','utf8');
var revision=fs.readFileSync('crm/case-revision.js','utf8');

/* Server durability: WAL must exist before projection publication and recovery must
   run under the shared lock before any command state is read. */
assert.ok(api.indexOf('function sd_publish_changes')>-1&&api.indexOf('function sd_recover_pending_transactions')>-1,'generic WAL publisher/recovery exists');
var commitStart=api.indexOf('function sd_commit(array $changes, array $context)');
var walPublish=api.indexOf("rename($tmp, $wal)",commitStart),projectionPublish=api.indexOf('sd_publish_changes($changes)',walPublish);
assert.ok(commitStart>-1&&walPublish>commitStart&&projectionPublish>walPublish,'durable WAL is published before any projection');
assert.ok(api.indexOf('sd_recover_pending_transactions();')<api.indexOf("$offers = sd_read('ptf_crm_offers')"),'pending transaction recovers before command reads');
assert.ok(api.indexOf("if ($idem === '') sd_out(['ok'=>false,'error'=>'idempotency_key_required'],422)")>-1,'every mutating command requires an operation id');
assert.ok(api.indexOf("$rev=sd_commit($changes,['key'=>$idem,'action'=>$action,'requestHash'=>$requestHash,'owner'=>$user])")>-1,'WAL is bound to operation/action/hash/owner context');
assert.ok(transport.indexOf("glob($sdir . '/.sales-tx-*.json')")>-1&&transport.indexOf('pending_sales_transaction_recovery')>-1,'generic data_push cannot overwrite a partial sales transaction');

/* Client adoption: optimistic financial writes use the lifecycle helper, and cloud
   cleanup is restricted to definitive rejection or post-ACK cleanup. */
assert.ok(sales.indexOf('window.ptfSalesDomainCommand = command')>-1&&sales.indexOf("commitOutcome='uncertain'")>-1,'shared ACK/rejected/uncertain lifecycle is exported');
assert.ok(revision.indexOf("ptfSalesDomainCommand('revise_award'")>-1,'award revision uses command certainty');
assert.ok(official.indexOf("command(inv?'correct_invoice':'register_invoice'")>-1&&official.indexOf("command('void_invoice'")>-1,'official invoice mutations use command certainty');
assert.ok((unofficial.match(/ptfSalesDomainCommand\('register_unofficial_invoice'/g)||[]).length===3,'all unofficial invoice registration paths use command certainty');
assert.ok((inq.match(/ptfInqAttachmentCommand\('rfq_attachment_/g)||[]).length===3&&inq.indexOf('فایل برای بازیابی پاک نشد')>-1,'RFQ attachment add/replace/remove preserve files on unknown outcome');
assert.ok(projects.indexOf("ptfSalesDomainCommand('archived_case_purge_commit'")>-1,'archive purge commit has a separate certainty boundary');
var finDelete=sales.slice(sales.indexOf('window.ptfFinAttachDelete='),sales.indexOf('/* ----- Read-only deterministic',sales.indexOf('window.ptfFinAttachDelete=')));
assert.ok(finDelete.indexOf("command('attachment_delete'")>-1&&finDelete.indexOf("command('attachment_delete'")<finDelete.indexOf('deleteFinancialObject(a.objectKey'),'financial attachment metadata commits before cloud deletion');

function storage(){var d={ptf_crm_token:'tok'};return{d:d,getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null;},setItem:function(k,v){d[k]=String(v);},removeItem:function(k){delete d[k];}};}
function response(status,body){return{ok:status>=200&&status<300,status:status,text:function(){return Promise.resolve(JSON.stringify(body));}};}
function tick(){return new Promise(function(r){setImmediate(r);});}
function harness(){
  var ls=storage(),pending=[],requests=[],alerts=[],toasts=[];
  var ctx={window:null,console:{log:function(){},warn:function(){},error:function(){}},localStorage:ls,
    JSON:JSON,Math:Math,Date:Date,Promise:Promise,Array:Array,Object:Object,String:String,Number:Number,RegExp:RegExp,Error:Error,
    getData:function(){return[];},setData:function(){},curRole:function(){return'accountant';},curSession:function(){return{user:'finance'};},
    alert:function(m){alerts.push(String(m));},ptfToast:function(m,k){toasts.push({m:String(m),k:k});},
    ptfDevKv:{/* v34.18.0 (T5-2b): تشخیصی‌های فرمان از نمای Dev-KV می‌گذرند — هارنس همان LS ساختگی را پشت نما می‌گذارد */set:function(k,v){ls.setItem(k,String(v));},get:function(k,cb){cb(ls.getItem(k));},remove:function(k){ls.removeItem(k);},keys:function(prefix,cb){var out=[];for(var i=0,kk=0;i<Object.keys(ls.d).length;i++){kk=Object.keys(ls.d)[i];if(String(kk).indexOf(prefix)===0)out.push(String(kk));}cb(out);}},
    document:{getElementById:function(){return null;},querySelectorAll:function(){return[];},querySelector:function(){return null;},addEventListener:function(){},hidden:true},
    navigator:{},location:{},addEventListener:function(){},setInterval:function(){return 1;},clearInterval:function(){},setTimeout:setTimeout,clearTimeout:clearTimeout,
    fetch:function(url,opt){return new Promise(function(resolve,reject){var body=JSON.parse(opt.body);requests.push({url:url,body:body});pending.push({resolve:resolve,reject:reject});});}
  };ctx.window=ctx;
  var cut=sales.indexOf('/* v34.7.39 — ثبت پیشنهاد');
  assert.ok(cut>0,'test boundary found');
  vm.createContext(ctx);vm.runInContext(sales.slice(0,cut)+'\n})();',ctx,{filename:'sales-command-prefix.js'});
  return{ctx:ctx,ls:ls,requests:requests,pending:pending,alerts:alerts,toasts:toasts};
}

(async function(){
  /* ACK-side render failure is a warning, never a rejection. */
  var ack=harness(),rejected=0;
  var ackPromise=ack.ctx.ptfSalesDomainCommand('post_receipt',{caseId:'C1',idempotencyKey:'OP-ACK'},{onAck:function(){throw new Error('render_after_ack');},onReject:function(){rejected++;}});
  ack.pending[0].resolve(response(200,{ok:true,rev:7,result:{receiptId:'R1'},data:{}}));
  var ackResult=await ackPromise;
  assert.strictEqual(ackResult.state,'acked');assert.strictEqual(rejected,0,'post-ACK throw never reaches rejection');
  assert.ok(Object.keys(ack.ls.d).some(function(k){return k.indexOf('ptf_sales_command_post_ack_warning_OP-ACK')===0;}),'post-ACK warning persisted');

  /* Lost first response replays the exact operation once. */
  var replay=harness(),ackCount=0;
  var replayPromise=replay.ctx.ptfSalesDomainCommand('void_receipt',{receiptId:'R1',idempotencyKey:'OP-REPLAY'},{onAck:function(){ackCount++;}});
  replay.pending[0].reject(new Error('response_lost'));await tick();await tick();
  assert.strictEqual(replay.requests.length,2);assert.strictEqual(replay.requests[1].body.idempotencyKey,'OP-REPLAY');
  replay.pending[1].resolve(response(200,{ok:true,idempotent:true,rev:8,result:{},data:{}}));
  assert.strictEqual((await replayPromise).state,'acked');assert.strictEqual(ackCount,1);

  /* Definitive 4xx is rejected immediately and is never labelled uncertain. */
  var bad=harness(),badReject=0,badUncertain=0;
  var badPromise=bad.ctx.ptfSalesDomainCommand('post_receipt',{idempotencyKey:'OP-422'},{onReject:function(){badReject++;},onUncertain:function(){badUncertain++;}});
  bad.pending[0].resolve(response(422,{ok:false,error:'invalid_amount'}));
  assert.strictEqual((await badPromise).state,'rejected');assert.strictEqual(bad.requests.length,1);assert.strictEqual(badReject,1);assert.strictEqual(badUncertain,0);

  /* Two ambiguous mutation responses first query the compact durable receipt. */
  var recovered=harness(),recoveredAck=0;
  var recoveredPromise=recovered.ctx.ptfSalesDomainCommand('revise_award',{caseId:'C1',idempotencyKey:'OP-RECOVERED'},{onAck:function(d){recoveredAck++;assert.strictEqual(d.compactReceipt,true);}});
  recovered.pending[0].reject(new Error('large_response_lost_1'));await tick();await tick();
  recovered.pending[1].reject(new Error('large_response_lost_2'));await tick();await tick();
  assert.strictEqual(recovered.requests.length,3,'two mutation attempts are followed by one compact receipt lookup');
  assert.ok(recovered.requests[2].url.indexOf('action=command_status')>-1&&recovered.requests[2].body.operationId==='OP-RECOVERED','status lookup is bound to operation id');
  recovered.pending[2].resolve(response(200,{ok:true,committed:true,operationId:'OP-RECOVERED',commandAction:'revise_award',rev:9,result:{revisionOfferNo:'CO-1',rev:2}}));
  assert.strictEqual((await recoveredPromise).state,'acked');assert.strictEqual(recoveredAck,1,'durable compact receipt resolves ACK exactly once');

  /* A successful owner-bound status lookup that finds no journal receipt is a
     definitive non-commit after WAL recovery, not an uncertain outcome. */
  var absent=harness(),absentReject=0,absentUncertain=0;
  var absentPromise=absent.ctx.ptfSalesDomainCommand('revise_award',{caseId:'C1',idempotencyKey:'OP-NOT-COMMITTED'},{onReject:function(e){absentReject++;assert.strictEqual(e.message,'command_not_committed');},onUncertain:function(){absentUncertain++;}});
  absent.pending[0].reject(new Error('response_lost_1'));await tick();await tick();absent.pending[1].reject(new Error('response_lost_2'));await tick();await tick();
  absent.pending[2].resolve(response(200,{ok:true,committed:false,operationId:'OP-NOT-COMMITTED',commandAction:'revise_award'}));
  assert.strictEqual((await absentPromise).state,'rejected');assert.strictEqual(absentReject,1);assert.strictEqual(absentUncertain,0);

  /* If both mutation responses and the status lookup are unavailable, preserve intent
     and never run definitive rollback. */
  var unknown=harness(),rollback=0,uncertain=0;
  var unknownPromise=unknown.ctx.ptfSalesDomainCommand('register_invoice',{idempotencyKey:'OP-UNKNOWN'},{onReject:function(){rollback++;},onUncertain:function(e){uncertain++;assert.strictEqual(e.operationId,'OP-UNKNOWN');}});
  unknown.pending[0].reject(new Error('offline_1'));await tick();await tick();unknown.pending[1].reject(new Error('offline_2'));await tick();await tick();unknown.pending[2].reject(new Error('status_offline'));
  var unknownResult=await unknownPromise;
  assert.strictEqual(unknownResult.state,'uncertain');assert.strictEqual(unknown.requests.length,3);assert.strictEqual(rollback,0);assert.strictEqual(uncertain,1);
  assert.ok(Object.keys(unknown.ls.d).some(function(k){return k.indexOf('ptf_sales_command_uncertain_OP-UNKNOWN')===0;}),'unknown outcome diagnostic persisted');

  console.log('PASS tester446-v34.7.43: generic command certainty + durable WAL + compact receipt recovery');
})().catch(function(e){console.error(e&&e.stack||e);process.exitCode=1;});
