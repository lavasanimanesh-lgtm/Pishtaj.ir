/* tester510 — v34.8.30/F5: authoritative read-only finance repair manifest. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var api = fs.readFileSync('api/sales-domain.php', 'utf8');
var client = fs.readFileSync('crm/sales-domain-v2.js', 'utf8');

console.log('── Phase 5 repair plan: read-only contract ──');
assert.ok(/finance_repair_plan/.test(api), 'repair plan action exists');
assert.ok(/function sd_finance_repair_plan/.test(api), 'server plan builder exists');
assert.ok(/'readOnly'=>true,'mutation'=>false/.test(api), 'plan explicitly reports no mutation');
assert.ok(/automaticVoid.*false/.test(api) && /automaticRegistration.*false/.test(api), 'salary repair never auto-mutates');
assert.ok(/automaticCreate.*false/.test(api) && /unrecoverable_without_external_evidence/.test(api), 'missing chair injection is not fabricated');
assert.ok(/automaticMove.*false/.test(api), 'draw month is not silently changed');
assert.ok(/requires_canonical_selection/.test(api), 'duplicate salary requires canonical selection');
assert.ok(/salary_opex_orphan/.test(api), 'orphan salary OPEX is surfaced');
assert.ok(/payable_delete_audit/.test(api), 'payable deletion audit is surfaced');
assert.ok(/sd_repair_months\(\$body\['months'\]\?\?\[\]\)/.test(api), 'scope months are explicit');
assert.ok(/window\.ptfFinanceRepairPlan = function/.test(client), 'client read-only plan helper exists');
assert.ok(/action=finance_repair_plan/.test(client), 'client calls read-only endpoint');
assert.ok(!/ptfFinanceRepairPlan[\s\S]{0,800}setData\(/.test(client), 'plan helper does not write local data');
console.log('  ✔ repair manifest is scoped, evidence-based and non-mutating');
console.log('PASS tester510 v34.8.30 phase05 repair plan');
