#!/usr/bin/env node
'use strict';
/* v34.7.41 — lost-response/concurrency/data-preservation guards for revise_award. */
var fs=require('fs'),path=require('path'),assert=require('assert');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var php=read('api/sales-domain.php'),js=read('crm/case-revision.js');
var server=(php.match(/elseif \(\$action === 'revise_award'\) \{[\s\S]*?\n    \}\n    elseif \(\$action === 'revoke_orphan_delete'\)/)||[])[0]||'';
var submit=(js.match(/W\.ptfAwardReviseSubmit = function[\s\S]*?\n  \};\n\n  \/\* ---------------- P6/)||[])[0]||'';
assert.ok(server&&submit,'revision command/client blocks must be extractable');

assert.ok(/revision_precondition_required/.test(server)&&/\$idem === ''/.test(server),'server requires a stable idempotency key');
assert.ok(/array_key_exists\('expectedRev', \$body\)/.test(server)&&/expectedOfferId/.test(server),'server requires revision and offer identity preconditions');
assert.ok(/count\(\$parentHits\) !== 1/.test(server)&&/duplicate_offer_no/.test(server),'duplicate offer numbers fail closed');
assert.ok(/sd_case_offer_linked\(\$case, \$parent\)/.test(server)&&/count\(\$linkedCaseIds\) !== 1/.test(server),'case/award identity and unique case are verified');
assert.ok(/award_revision_conflict/.test(server)&&/\$expectedRev !== \$currentRev/.test(server),'stale writer is rejected');
assert.ok(server.indexOf('award_revision_conflict')<server.indexOf("$parent['items'] = $newItems"),'concurrency check precedes authoritative mutation');

assert.ok(/\$row = \$base;/.test(server),'existing line metadata is preserved before editable fields are replaced');
assert.ok(/sd_uuid\('LINE'\)/.test(server)&&/unknown_revision_line_id/.test(server),'new lines receive server IDs and unknown IDs are rejected');
assert.ok(/duplicate_existing_line_id/.test(server)&&/duplicate_revision_source_line/.test(server)&&/duplicate_revision_line_id/.test(server),'existing and submitted line identities must remain unique');
assert.ok(/\$lnk\['amount'\] = \$newTotal/.test(server)&&/\$lnk\['revisionSeq'\] = \$seq/.test(server),'root linked-offer projection follows the revised amount');
assert.ok(/max\(\(int\)\(\$parent\['revisionSeq'\]/.test(server)&&/'fromRev'=>\$currentRev/.test(server),'revision sequence cannot move backwards');

assert.ok(/data-operation-id/.test(js)&&/data-expected-rev/.test(js)&&/data-offer-id/.test(js),'dialog snapshots a stable operation intent');
assert.ok(/data-in-flight/.test(submit)&&/submitBtn\.disabled\s*=\s*true/.test(submit),'double submit is blocked while the command is running');
assert.ok(/idempotencyKey\s*:\s*ctx\.operationId/.test(submit)&&!/idempotencyKey:[^\n]*Date\.now/.test(submit),'retry reuses the dialog operation ID');
assert.ok(/expectedOfferId\s*:\s*ctx\.expectedOfferId/.test(submit)&&/expectedRev\s*:\s*ctx\.expectedRev/.test(submit),'client sends optimistic concurrency preconditions');
assert.ok(/line\.sourceIndex\s*=\s*sourceIndex/.test(submit),'legacy lines without IDs retain their original server-verifiable source index');
assert.ok(/award_revision_conflict/.test(submit)&&/دستگاه دیگری تغییر کرده/.test(submit),'user gets an explicit stale-write explanation');
assert.ok(/onUncertain/.test(submit)&&/ctx\.pendingPayload/.test(submit)&&/operationId حفظ شد/.test(submit)&&/بررسی رسید قطعی \/ تلاش همان فرمان/.test(submit),'lost-response retry freezes and reuses the exact operation intent');
assert.ok(/data-currency/.test(js)&&/ctx\.currency==='IRR'\?'ریال':ctx\.currency/.test(submit),'foreign-currency revisions are not mislabeled as IRR');

console.log('PASS tester444-v34.7.41: award revision is idempotent, concurrency-safe, and metadata-preserving');
