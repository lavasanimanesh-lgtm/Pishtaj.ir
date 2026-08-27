/* tester509 — v34.8.31/F4: finance-hub visibility, payable refresh and poll safety. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var fiscal = fs.readFileSync('crm/fiscal.js', 'utf8');
var opex = fs.readFileSync('crm/opex.js', 'utf8');
var scoring = fs.readFileSync('crm/scoring.js', 'utf8');
var bridge = fs.readFileSync('crm/bridge.js', 'utf8');
var hub = fs.readFileSync('crm/financehub.js', 'utf8');

console.log('── Phase 4 UI/poll safety ──');
assert.ok(/id="fiscalBox"[^>]*style="display:none;/.test(fiscal), 'new fiscal root starts hidden');
assert.ok(/ptfFiscalRender[\s\S]*window\.finHubApply\(\)/.test(fiscal), 'fiscal replacement reapplies hub visibility');
assert.ok(/var activeTab = String\(window\._finHubTab/.test(opex) && /document\.querySelector\('\.md-b'\)/.test(opex), 'recurring refresh only updates safe active view');
assert.ok(/function refreshPayablesBox/.test(scoring) && scoring.indexOf('refreshBox();') < 0, 'payables no longer calls private refreshBox');
assert.ok(/var eventInFlight = false/.test(bridge) && /var inboxInFlight = false/.test(bridge), 'event/inbox single-flight guards');
assert.ok(/function bridgeFetchJson/.test(bridge) && /AbortController/.test(bridge) && /20000/.test(bridge), 'poll timeout and structured transport wrapper');
assert.ok(/eventRetryAt = Date\.now\(\) \+ bridgeBackoff/.test(bridge) && /inboxRetryAt = Date\.now\(\) \+ bridgeBackoff/.test(bridge), 'poll exponential backoff');
assert.ok(/eventRequest = pollEvents\(\)/.test(bridge) && /inboxRequest = syncServerInbox\(\)/.test(bridge), 'interval flags remain until async request settles');
assert.ok(/data-fin-hub-active/.test(hub) && /show\('fiscalBox', t === 'fiscal'\)/.test(hub), 'hub keeps active tab state');
console.log('  ✔ fiscal root, payable refresh and polling are fail-safe');
console.log('PASS tester509 v34.8.31 phase04 UI/poll safety');
