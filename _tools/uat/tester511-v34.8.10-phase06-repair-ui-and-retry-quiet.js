/* tester511 — v34.8.33/F6: repair manifest UI and quiet background retry contract. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var client = fs.readFileSync('crm/sales-domain-v2.js', 'utf8');
var api = fs.readFileSync('api/sales-domain.php', 'utf8');
var opex = fs.readFileSync('crm/opex.js', 'utf8');
var quality = fs.readFileSync('crm/data-quality.js', 'utf8');
var index = fs.readFileSync('crm/index.html', 'utf8');
var sw = fs.readFileSync('crm/sw.js', 'utf8');

console.log('── Phase 6: no-console repair workflow and quiet retry ──');
assert.ok(/window\.ptfFinanceRepairPlanOpen = function/.test(client), 'visible read-only repair plan UI exists');
assert.ok(/window\.ptfFinanceRepairPlanRun = function/.test(client), 'repair plan UI has an explicit run action');
assert.ok(/window\.ptfFinanceRepairPlanDownload = function/.test(client), 'repair plan can be downloaded without console');
assert.ok(/finance_repair_plan/.test(client) && /finance_repair_plan/.test(client.match(/function actionIsReadOnly[\s\S]{0,260}/)[0]), 'repair plan is treated as read-only');
assert.ok(/silentUncertain!==true/.test(client), 'generic uncertain alert can be suppressed by background callers');
assert.ok(/set_error_handler/.test(api) && /register_shutdown_function/.test(api) && /command_status_recovery_failed/.test(api), 'command status converts server warnings/fatals into structured JSON');
assert.ok(/invalid\.raw=/.test(client), 'invalid status response exposes bounded raw diagnostic in UI');
assert.ok(/silentUncertain: true/.test(opex), 'background recurring reconcile suppresses alert flood');
assert.ok(/recurringServerBlockedKey/.test(opex), 'uncertain recurring command is blocked from retry storm');
assert.ok(/quality-repair/.test(quality) && /ptfFinanceRepairPlanOpen/.test(quality), 'quality dashboard exposes repair manifest button');
assert.ok(/quality-status/.test(quality) && /ptfFinanceCommandStatusOpen/.test(quality), 'quality dashboard exposes command status button');
/* v34.8.33: phase-queryهای موقتی با بامپ واقعی نسخه حذف شدند؛ دارایی‌های فاز ۶/۸
   مثل بقیه زیر ?v=34.8.33 لود و precache می‌شوند (قوی‌تر از دورزدن کش). */
assert.ok(/data-quality\.js\?v=34\.24\.0/.test(index) && /sales-domain-v2\.js\?v=34\.24\.0/.test(index), 'phase six/eight assets carry the real release version');
console.log('  ✔ repair manifest and command status are available from the UI');
console.log('  ✔ uncertain background reconcile no longer emits a retry/alert storm');
console.log('PASS tester511 v34.8.33 phase06 repair UI and retry quiet');
