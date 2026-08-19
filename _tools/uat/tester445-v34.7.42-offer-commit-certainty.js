#!/usr/bin/env node
'use strict';
/* v34.7.42 — server commit certainty: ACK, post-ACK, rejection and unknown outcome. */
var fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var client=read('crm/sales-domain-v2.js'),server=read('api/sales-domain.php');
var flow=(client.match(/var registerPayload=[\s\S]*?return \{ok:true,pendingServer:true,offerNo:payloadOffer\.no,promise:command\};/)||[])[0]||'';
assert.ok(flow,'offer command certainty block must be extractable');

/* US-445-1: a commit receipt is server-issued and tied to the exact operation. */
assert.ok(/operation_id_required/.test(server)&&/\$incoming\['serverOperationId'\]=\$idem/.test(server),'register_offer requires and stamps operation ID');
assert.ok(/unset\([^;]*serverOperationId[^;]*serverRegisteredAt/.test(server),'client cannot spoof a server receipt');
assert.ok(/sd_command_request_hash/.test(server)&&/idempotency_key_payload_mismatch/.test(server)&&/idempotency_key_owner_mismatch/.test(server),'idempotency key is bound to action, payload and owner');
assert.ok(/\$crashRecovery/.test(server)&&/serverRequestHash/.test(server)&&/recoveredPartialCommit/.test(server),'retry completes an offer/RFQ commit interrupted before its journal publish');

/* US-445-2: transport is at-least-once while the command remains exactly-once. */
assert.ok((flow.match(/registerAttempt\(\)/g)||[]).length>=2,'ambiguous transport gets one automatic replay');
assert.ok(/offerErrorIsDefinitive\(firstError\)/.test(flow)&&/idempotency_key_payload_mismatch/.test(client),'4xx rejection is not blindly retried except a prior-commit payload mismatch that needs receipt reconciliation');
assert.ok(/offerServerReceipt\(payloadOffer,idem\)/.test(flow),'second ambiguous result is reconciled by exact server receipt');

/* US-445-3: post-ACK exceptions cannot enter the server-rejection handler. */
assert.ok(/var command=receipt\.then\(function\(d\)/.test(flow)&&/\},function\(e\)\{/.test(flow),'ACK and rejection use separate then branches');
assert.ok(/offerSafeStep\(warnings,'post-commit-effects'/.test(flow)&&/saveOfferAckWarning/.test(flow),'post-ACK failures are isolated and diagnosed');
assert.ok(flow.indexOf("offerSafeStep(warnings,'post-commit-effects'")<flow.indexOf("return d;\n        },function(e)"),'post-ACK work remains on the committed branch');

/* US-445-4: unknown outcome is not lied about as a server rejection. */
assert.ok(/_ptfOutcomeUnknown/.test(flow)&&/st\._serverState=uncertain\?'uncertain':'rejected'/.test(flow),'unknown and rejected are distinct durable states');
assert.ok(/نتیجه هنوز نامشخص است/.test(flow)&&/سرور ثبت پیشنهاد را نپذیرفت/.test(flow),'messages distinguish uncertainty from definitive rejection');
assert.ok(/restoreOfferSnapshots\(before,after\)/.test(flow),'local RFQ never stays falsely issued while outcome is unknown');

/* Behavioral harness covers post-ACK throw, automatic replay, definitive 422 and two failed transports. */
var behavioral=cp.spawnSync(process.execPath,[path.join(ROOT,'_tools/uat/tester442-v34.7.39-offer-ack-workflow.js')],{cwd:ROOT,encoding:'utf8'});
assert.strictEqual(behavioral.status,0,(behavioral.stdout||'')+(behavioral.stderr||''));
assert.ok(/PASS tester442/.test(behavioral.stdout),'behavioral offer workflow harness passed');
console.log('PASS tester445-v34.7.42: offer commit certainty state machine + family user stories');
