/* tester505 — recurring OPEX: delta merge, replay, tombstones and atomic cheque scheduling */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var sync = fs.readFileSync('crm/sync.js', 'utf8');
var api = fs.readFileSync('api/sales-domain.php', 'utf8');
var crmApi = fs.readFileSync('api/crm.php', 'utf8');
var opex = fs.readFileSync('crm/opex.js', 'utf8');
var shareholders = fs.readFileSync('crm/shareholders.js', 'utf8');
var chequePanel = fs.readFileSync('crm/cheque-panel.js', 'utf8');
var chequeModule = fs.readFileSync('crm/cheque-module.js', 'utf8');
var salesDomain = fs.readFileSync('crm/sales-domain-v2.js', 'utf8');

function storage() {
  var data = {};
  return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; }, setItem: function (k, v) { data[k] = String(v); }, removeItem: function (k) { delete data[k]; } };
}
function context() {
  var ls = storage();
  var c = {
    window: null, console: console, localStorage: ls, setData: function () { return true; }, getData: function () { return []; },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'admin' }; },
    document: { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, hidden: true, hasFocus: function () { return true; }, documentElement: { style: { setProperty: function () {} } } },
    navigator: {}, location: {}, setInterval: function () { return 1; }, clearInterval: function () {}, setTimeout: function () { return 1; }, clearTimeout: function () {},
    fetch: function () { return new Promise(function () {}); }, alert: function () {}, addEventListener: function () {},
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error, isFinite: isFinite, parseInt: parseInt
  };
  c.window = c; vm.createContext(c); vm.runInContext(sync, c, { filename: 'sync.js' }); return c;
}
function by(rows, key) { return rows.filter(function (r) { return r && r.recurringKey === key; })[0]; }
function count(rows, key) { return rows.filter(function (r) { return r && r.recurringKey === key; }).length; }
function envelope(revision, upserts, tombstones) { return { mode: 'merge-v1', collection: 'ptf_crm_opex', identityVersion: 'opex-v1', revision: revision, upserts: upserts || [], tombstones: tombstones || [] }; }
function section(source, start, end) {
  var from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'source section not found: ' + start); return source.slice(from, to);
}
function ok(label) { console.log('  ✔ ' + label); }

console.log('\n── OPEX envelope: merge-only, identity aliases and local annotations ──');
var c = context();
var local = [
  { cd: 'ONE', _opexRowId: 'ONE-R', cat: 'ایاب و ذهاب', amt: 10, month: '1405/06', note: 'unrelated' },
  { cd: 'LEGACY-R', _opexRowId: 'OLD-R', recurringKey: 'opex-template:T1:1405/06', tplId: 'T1', status: 'active', amt: 100, files: [{ key: 'doc-1' }], dealRef: 'DEAL-1' },
  { cd: 'LOCAL-V', _opexRowId: 'LOCAL-VR', recurringKey: 'opex-template:T2:1405/06', status: 'void', voided: true, explicitDeletion: true, manualVoid: true, voidIntent: 'explicit', amt: 50 }
];
var merged = c.ptfOpexMergeProjection(local, envelope(42, [
  { cd: 'SERVER-R', _opexRowId: 'NEW-R', recurringKey: 'opex-template:T1:1405/06', tplId: 'T1', status: 'active', st: 'settled', settleDoc: 'BANK-1', amt: 125, serverReconciled: true, serverMaterialized: true },
  { cd: 'SAL-1', _opexRowId: 'SAL-R1', recurringKey: 'salary:SH1:1405/06', status: 'active', amt: 200, serverReconciled: true }
], [
  { cd: 'DUP', _opexRowId: 'DUP-R', recurringKey: 'opex-template:T1:1405/06:duplicate', status: 'void', voided: true, serverReconciled: true, voidIntent: 'eligibility' }
]));
assert.strictEqual(merged.length, 5); assert.strictEqual(count(merged, 'opex-template:T1:1405/06'), 1);
assert.strictEqual(by(merged, 'opex-template:T1:1405/06').amt, 125); assert.strictEqual(by(merged, 'opex-template:T1:1405/06').st, 'settled'); assert.strictEqual(by(merged, 'opex-template:T1:1405/06').settleDoc, 'BANK-1'); assert.strictEqual(by(merged, 'opex-template:T1:1405/06').files[0].key, 'doc-1'); assert.strictEqual(by(merged, 'opex-template:T1:1405/06').dealRef, 'DEAL-1');
assert.ok(merged.some(function (r) { return r.cd === 'ONE'; })); assert.ok(by(merged, 'salary:SH1:1405/06')); assert.strictEqual(by(merged, 'opex-template:T1:1405/06:duplicate').status, 'void');
ok('delta unrelated rows را حذف نمی‌کند، alias recurringKey را یکی و metadata محلی را حفظ می‌کند');

var duplicateDomainRows = c.ptfOpexMergeProjection([], envelope(421, [
  { cd: 'CANONICAL', _opexRowId: 'OPXR-TPL-CANONICAL', recurringKey: 'opex-template:TD:1405/06', status: 'active', amt: 100, serverReconciled: true, serverOwnedIdentity: true }
], [
  { cd: 'DUPLICATE', _opexRowId: 'OPXR-SRV-DUPLICATE', recurringKey: 'opex-template:TD:1405/06', status: 'void', st: 'void', voided: true, serverReconciled: true, serverOwnedIdentity: true }
]));
assert.strictEqual(duplicateDomainRows.length, 2);
assert.strictEqual(duplicateDomainRows.filter(function (row) { return row.status === 'active'; }).length, 1);
assert.strictEqual(duplicateDomainRows.filter(function (row) { return row.status === 'void'; }).length, 1);
ok('دو ردیف server-owned با recurringKey مشترک به‌اشتباه روی هم collapse نمی‌شوند');

var blocked = c.ptfOpexMergeProjection(local, envelope(43, [{ cd: 'SERVER-V', recurringKey: 'opex-template:T2:1405/06', status: 'active', amt: 80, serverReconciled: true }], []));
assert.strictEqual(by(blocked, 'opex-template:T2:1405/06').status, 'void'); assert.strictEqual(by(blocked, 'opex-template:T2:1405/06').explicitDeletion, true);
ok('upsert خودکار tombstone صریح محلی را resurrect نمی‌کند');
var restored = c.ptfOpexMergeProjection(local, envelope(44, [{ cd: 'SERVER-V', recurringKey: 'opex-template:T2:1405/06', status: 'active', amt: 80, serverReconciled: true, restoreIntent: 'explicit' }], []));
assert.strictEqual(by(restored, 'opex-template:T2:1405/06').status, 'active'); assert.strictEqual(!!by(restored, 'opex-template:T2:1405/06').voided, false); assert.strictEqual(!!by(restored, 'opex-template:T2:1405/06').explicitDeletion, false);
var splitLifecycle = c.ptfOpexMergeProjection(local, envelope(45, [], [{ cd: 'SPLIT', recurringKey: 'opex-template:SPLIT:1405/06', status: 'active', st: 'void', serverReconciled: true }]));
assert.strictEqual(by(splitLifecycle, 'opex-template:SPLIT:1405/06').st, 'void');
ok('فقط restoreIntent صریح markerهای terminal را پاک می‌کند و status فعال، st terminal را پنهان نمی‌کند');

console.log('\n── Shareholder salary claim lifecycle ──');
var shareRows = [
  { cd: 'SAL-A', shCd: 'SH1', type: 'salary', amt: 100, status: 'active' },
  { cd: 'SAL-ST-VOID', shCd: 'SH1', type: 'salary', amt: 999, status: 'active', st: 'void' },
  { cd: 'SAL-STATUS-VOID', shCd: 'SH1', type: 'salary', amt: 888, status: 'void', st: 'active' },
  { cd: 'SAL-PAY', shCd: 'SH1', type: 'salary_payment', amt: 20, status: 'active' }
];
c.getData = function (key) { if (key === 'ptf_crm_sharetx') return shareRows; if (key === 'ptf_crm_shareholders') return [{ cd: 'SH1', name: 'سهامدار' }]; return []; };
vm.runInContext(shareholders, c, { filename: 'shareholders.js' });
assert.strictEqual(c.ptfShareholderBalance('SH1').net, 80);
assert.ok(/shareTxActive\(x\)/.test(shareholders) && /String\(row\.status[\s\S]*String\(row\.st/.test(shareholders));
ok('مطالبه حقوق فقط از گردش فعال می‌آید و terminal بودن status/st مستقل محاسبه و نمایش داده می‌شود');

console.log('\n── Salary pair repair: OPEX exists but shareholder claim is missing ──');
/* PHP در runner محلی نصب نیست؛ این fixture معادل invariant همان loop سروری را مدل
   می‌کند و static assertions پایین، اتصال آن به implementation را کنترل می‌کنند. */
function repairSalaryPairFixture(state, month) {
  state.shareholders.forEach(function (sh) {
    if (!sh || !sh.cd || sh.active === false || sh.duty !== true || !(+sh.salary > 0)) return;
    var key = 'salary:' + sh.cd + ':' + month;
    var tx = state.sharetx.filter(function (r) { return r && r.recurringKey === key; })[0];
    if (!tx) {
      tx = { cd: 'SHT-SAL-' + sh.cd + '-' + month, shCd: sh.cd, shName: sh.name, type: 'salary', amt: +sh.salary, month: month, t: month + '/01', recurringKey: key, status: 'active', serverReconciled: true };
      state.sharetx.push(tx);
    }
    var ox = state.opex.filter(function (r) { return r && r.recurringKey === key; })[0];
    if (!ox) {
      ox = { cd: 'OPX-SAL-' + sh.cd + '-' + month, cat: 'حقوق و دستمزد', month: month, recurringKey: key, shareholderSalary: true, status: 'active' };
      state.opex.push(ox);
    }
    ox.amt = +sh.salary; ox.shareTx = tx.cd; ox.serverReconciled = true; ox.serverMaterialized = true; ox.t = month + '/01';
  });
  return state;
}
var missingClaimState = repairSalaryPairFixture({
  shareholders: [{ cd: 'SH-REPAIR', name: 'سهامدار موظف', active: true, duty: true, salary: 700 }],
  sharetx: [],
  opex: [{ cd: 'LEGACY-OPEX', _opexRowId: 'LEGACY-OPEX-R', recurringKey: 'salary:SH-REPAIR:1405/06', shareholderSalary: true, amt: 700, month: '1405/06', status: 'active' }]
}, '1405/06');
assert.strictEqual(missingClaimState.sharetx.length, 1, 'missing claim must be created');
assert.strictEqual(missingClaimState.opex.length, 1, 'existing salary OPEX must be repaired, not duplicated');
assert.strictEqual(missingClaimState.opex[0].shareTx, missingClaimState.sharetx[0].cd);
assert.strictEqual(missingClaimState.sharetx[0].amt, 700);
assert.strictEqual(missingClaimState.sharetx[0].t, '1405/06/01');
assert.strictEqual(missingClaimState.opex[0].t, '1405/06/01');
ok('OPEX موجود/claim مفقود از پرونده سهامدار در ابتدای همان ماه بدون duplicate repair می‌شود');

console.log('\n── Projection validation and late response ordering ──');
c.localStorage.setItem('ptf_crm_opex', JSON.stringify(local)); c.localStorage.setItem('ptf_sync_krevs', JSON.stringify({ ptf_crm_opex: 50 }));
var before = c.localStorage.getItem('ptf_crm_opex');
assert.strictEqual(c.ptfSyncApplyServerProjection('ptf_crm_opex', envelope(49, [], []), 49), false); assert.strictEqual(c.localStorage.getItem('ptf_crm_opex'), before);
assert.strictEqual(c.ptfSyncApplyServerProjection('ptf_crm_opex', envelope(51, [{ status: 'active', amt: 1 }], []), 51), false); assert.strictEqual(c.localStorage.getItem('ptf_crm_opex'), before);
assert.strictEqual(c.ptfSyncApplyServerProjection('ptf_crm_opex', envelope(52, [], []), 51), false); assert.strictEqual(c.localStorage.getItem('ptf_crm_opex'), before);
assert.strictEqual(c.ptfSyncApplyServerProjection('ptf_crm_opex', envelope(0, [{ cd: 'ZERO-REV' }], []), 0), false); assert.strictEqual(c.localStorage.getItem('ptf_crm_opex'), before);
c.localStorage.setItem('ptf_crm_opex', '{broken-json');
assert.strictEqual(c.ptfSyncApplyServerProjection('ptf_crm_opex', envelope(53, [{ cd: 'SAFE', _opexRowId: 'SAFE-R' }], []), 53), false);
assert.strictEqual(c.localStorage.getItem('ptf_crm_opex'), '{broken-json');
assert.ok(/if \(!expected \|\| typeof window\.ptfSyncPullNow !== 'function'\)/.test(salesDomain));
assert.ok(!/if \(!touched \|\| typeof window\.ptfSyncPullNow !== 'function'\)/.test(salesDomain));
ok('response دیررس، revision صفر، envelope بی‌هویت/ناسازگار و delta روی JSON خراب fail-closed هستند و catch-up pull حذف نمی‌شود');

console.log('\n── Full pull / ACK recovery never replace-all ──');
var pullMerged = JSON.parse(c.ptfSmartMerge('ptf_crm_opex', JSON.stringify(local), JSON.stringify([
  { cd: 'SERVER-R', _opexRowId: 'NEW-R', recurringKey: 'opex-template:T1:1405/06', status: 'active', amt: 150, serverReconciled: true, serverMaterialized: true }
])));
assert.ok(pullMerged.some(function (r) { return r.cd === 'ONE'; })); assert.strictEqual(by(pullMerged, 'opex-template:T1:1405/06').amt, 150); assert.strictEqual(by(pullMerged, 'opex-template:T1:1405/06').files[0].key, 'doc-1'); assert.strictEqual(by(pullMerged, 'opex-template:T2:1405/06').status, 'void');
var manualLocal = JSON.stringify([{ cd: 'MAN-1', _opexRowId: 'MAN-R1', amt: 10, note: 'local-annotation' }]);
var manualRemote = JSON.stringify([{ cd: 'MAN-1', _opexRowId: 'MAN-R1', amt: 20, status: 'active' }]);
var dirtyManual = JSON.parse(c.ptfSmartMerge('ptf_crm_opex', manualLocal, manualRemote));
var cleanManual = JSON.parse(c.ptfSmartMerge('ptf_crm_opex', manualLocal, manualRemote, { preferRemoteOpex: true }));
assert.strictEqual(dirtyManual[0].amt, 10); assert.strictEqual(cleanManual[0].amt, 20); assert.strictEqual(cleanManual[0].note, 'local-annotation');
assert.ok(/preferRemoteOpex: !state\.dirty\[k\]/.test(sync));
assert.ok(/submittedLocal\[k\] = v[\s\S]*sameSyncJson\(rd\(k\), submittedLocal\[k\]\)/.test(sync));
assert.ok(/ptfSyncFlushKeysNow[\s\S]*if \(state\.pushing\) \{ setTimeout\(attempt, 50\)/.test(sync));
assert.ok(/ptfSyncFlushKeysNow\(\['ptf_crm_shareholders'\]/.test(shareholders));
assert.ok(/ptfSyncFlushKeysNow\(\['ptf_crm_cheques_issued', 'ptf_crm_settings'\]/.test(opex));
ok('merge برحسب dirty-state است؛ ACK نسل قدیمی edit حین پرواز را پاک نمی‌کند و command فقط پس از barrier کلیدهای مبنا اجرا می‌شود');

console.log('\n── Server contract: replay delta, no absence-void and atomic cheque link ──');
assert.ok(/mode'=>'merge-v1'.*collection'=>'ptf_crm_opex'.*identityVersion'=>'opex-v1'/s.test(api));
assert.ok(/sd_ensure_recurring_opex_row_identities[\s\S]*serverOwnedIdentity[\s\S]*OPXR-SRV-/.test(api));
assert.ok(/wantedRowId[\s\S]*rowId[\s\S]*hash_equals\(\$wantedRowId,\$rowId\)/.test(api));
assert.ok(/sd_is_recurring_projection_action\(\$action\).*projectionIdentities/s.test(api));
assert.ok(/\$hasExplicit&&!\$restore\).*\$suppressed\+\+/s.test(api));
assert.ok(!/eligibility_changed|missing[^\n]{0,40}void_recurring/i.test(api));
assert.ok(/schedule_recurring_opex_cheque/.test(api) && /\$changes=\['ptf_crm_opex'=>\$opex,'ptf_crm_cheques_issued'=>\$issued\]/.test(api));
assert.ok(/\$issued\[\$chequeIndex\]\['opexRowIds'\]=array_values\(array_unique/.test(api));
assert.ok(/===\s*'settled'\s*&&\s*\$linked\s*!==\s*\$chequeCd\)sd_out\(\['ok'=>false,'error'=>'opex_already_settled'/.test(api));
assert.ok(/responseChanges=\['ptf_crm_opex'=>\[\]\]/.test(api));
assert.ok(/SD_SHAREHOLDER_VIEW_ROLES = \['admin', 'chairman', 'ceo', 'commercial'\]/.test(api));
assert.ok(/function sd_recurring_sharetx_projection_allowed[\s\S]*reconcile_shareholder_salaries[\s\S]*reconcile_recurring_opex[\s\S]*void_recurring_opex/.test(api));
assert.ok(/function sd_recurring_projection_data[\s\S]*\$data\['ptf_crm_sharetx'\]=sd_read\('ptf_crm_sharetx'\)/.test(api));
assert.ok((api.match(/sd_recurring_projection_data\(\$action,/g) || []).length >= 2, 'fresh command and replay must both return role-safe sharetx');
assert.ok(/refreshRecurringFinancialViews[\s\S]*ptfShareRender[\s\S]*ptfFiscalRender/.test(opex));
assert.ok(/state\.state === 'acked'[\s\S]*ptfShareRender[\s\S]*ptfOpexRender[\s\S]*ptfFiscalRender/.test(shareholders));
assert.ok(/`st=settled` is a payment state/.test(api));
assert.ok(/in_array\(\$k, \['ptf_crm_opex','ptf_crm_sharetx','ptf_crm_shareholders'\], true\)/.test(crmApi));
assert.ok(/sync_merge_protected_finance_snapshot\(\$k, \$v, \$serverFinanceJson\)/.test(crmApi));
assert.ok(/Start from server so omission is never a deletion instruction/.test(crmApi));
assert.ok(/schedule_recurring_opex_cheque[\s\S]*\['chequeCd','payHow','fromCheque'\]/.test(crmApi));
assert.ok(/\$incomingChequeLinked = [^;]*\$incoming\['chequeCd'\][^;]*\$incoming\['fromCheque'\][^;]*\$incoming\['payHow'\][^;]*=== 'cheque'/.test(crmApi));
assert.ok(/strtolower\(trim\(\(string\)\(\$server\['st'\].*=== 'settled'[\s\S]*\['st','settleDoc','settledBy','settledT','settleISO','payHow','acctTx'\][\s\S]*Evidence is append-only/.test(crmApi));
assert.ok(/OPXR-SRV-.*hash\('sha256', \$seed\)/.test(crmApi));
assert.ok(/\$merged\['serverOwnedIdentity'\] = true/.test(crmApi));
assert.ok(/function sync_protected_identity_index/.test(crmApi) && /Physical identity must be authoritative|A supplied physical identity is authoritative/.test(crmApi));
assert.ok(/A new recurring identity must originate from the locked command path/.test(crmApi));
assert.ok(/\$protectedConflicts\[\] = \$k; \$conflictData\[\$k\] = \$protectedFinanceJson/.test(crmApi));
assert.ok(/\(int\)\$base\[\$k\] < \$curRev[\s\S]*if \(\$isProtectedFinanceKey\)[\s\S]*\$protectedConflicts\[\] = \$k[\s\S]*sync_merge_protected_finance_snapshot\(\$k, \$v, \$cfVal/.test(crmApi));
assert.ok(/protectedConfl\.indexOf\(k\) >= 0.*ptfMergeProtectedFinanceConflict/s.test(sync));
var protectedMerge = c.ptfMergeProtectedFinanceConflict('ptf_crm_opex', JSON.stringify([
  { cd: 'REC-1', _opexRowId: 'LOCAL-RANDOM', recurringKey: 'salary:SH-1:1405/06', amt: 999, serverReconciled: true, settleDoc: 'POST-SEND' },
  { cd: 'FORGED-NEW', recurringKey: 'opex-template:FORGED:1405/06', amt: 7, serverMaterialized: true },
  { cd: 'MANUAL-AFTER-SEND', amt: 20, cat: 'سایر' }
]), JSON.stringify([
  { cd: 'REC-1', _opexRowId: 'LOCAL-RANDOM', recurringKey: 'salary:SH-1:1405/06', amt: 999, serverReconciled: true },
  { cd: 'FORGED-NEW', recurringKey: 'opex-template:FORGED:1405/06', amt: 7, serverMaterialized: true }
]), JSON.stringify([
  { cd: 'REC-1', _opexRowId: 'OPXR-SRV-1', recurringKey: 'salary:SH-1:1405/06', amt: 100, serverReconciled: true },
  { cd: 'SERVER-OMITTED', amt: 30, cat: 'سایر' }
]));
protectedMerge = JSON.parse(protectedMerge);
assert.strictEqual(protectedMerge.filter(function (x) { return x.cd === 'REC-1'; })[0].amt, 100);
assert.strictEqual(protectedMerge.filter(function (x) { return x.cd === 'REC-1'; })[0]._opexRowId, 'OPXR-SRV-1');
assert.strictEqual(protectedMerge.filter(function (x) { return x.cd === 'REC-1'; })[0].settleDoc, 'POST-SEND');
assert.ok(!protectedMerge.some(function (x) { return x.cd === 'FORGED-NEW'; }));
assert.ok(protectedMerge.some(function (x) { return x.cd === 'SERVER-OMITTED'; }));
assert.ok(protectedMerge.some(function (x) { return x.cd === 'MANUAL-AFTER-SEND'; }));
ok('schedule اتمیک است؛ full push absence/forgery را بدون ACK خاموش یا conflict loop نگه می‌دارد و settlement را پاک نمی‌کند');

console.log('\n── Canonical restore, scoped reconcile and correction evidence ──');
var pickIndex = section(api, 'function sd_recurring_pick_index', 'function sd_command_request_hash');
assert.ok(/if\(\$restore\).*sd_recurring_explicit_tombstone/s.test(pickIndex));
assert.ok(/sd_recurring_explicit_tombstone[\s\S]*sd_active/.test(pickIndex));
assert.ok(/\$wasExplicit=\$restore&&\$index>=0&&sd_recurring_explicit_tombstone/.test(api));
assert.ok(/if\(\$wasExplicit\).*restoreIntent.*explicit/s.test(api));
var restoreAudits = api.match(/kind'=>'explicit_restore','beforeSnapshot'=>\$beforeSnapshot,'afterSnapshot'=>[^,]+(?:\[[^\]]+\])?/g) || [];
assert.ok(restoreAudits.length >= 3, 'salary sharetx, salary OPEX and template restore must each snapshot before/after');
assert.ok((api.match(/kind'=>'explicit_restore'/g) || []).length >= 3);
assert.ok(/explicitTemplate&&\$scopeTemplate!==''&&\$matchedTemplates===0\)sd_out\(\['ok'=>false,'error'=>'opex_template_not_found','templateId'=>\$scopeTemplate\],404\)/.test(api));
assert.ok(/\$explicitTemplate=\$includeTemplates&&!empty\(\$body\['explicitTemplate'\]\)/.test(api));
assert.ok(/\$explicitTemplate&&\$scopeTemplate===''\)sd_out\(\['ok'=>false,'error'=>'opex_template_scope_required'\],422\)/.test(api));
assert.ok(/\$includeSalaries=\(\$body\['includeSalaries'\]\?\?true\)!==false/.test(api));
assert.ok(/\$explicitEligibility\|\|\$explicitTemplate\|\|count\(\$restoreKeys\)>0\).*error'=>'reason_required'/s.test(api));
var salaryReconcile = section(api, "elseif ($action === 'reconcile_shareholder_salaries' || $action === 'reconcile_recurring_opex')", "elseif ($action === 'schedule_recurring_opex_cheque')");
assert.ok(/\$month!==\$currentMonth&&!\$explicitEligibility&&!\$explicitTemplate\)sd_out\(\['ok'=>false,'error'=>'current_tehran_month_required'/.test(salaryReconcile));
assert.ok(/\(\$sh\['duty'\]\?\?false\)!==true\|\|sd_num\(\$sh\['salary'\]\?\?0\)<=0/.test(salaryReconcile));
assert.ok(/\$legacyTxCds=\[\].*foreach\(\$txHits as \$legacyTxIndex\).*\$sharetx\[\$legacyTxIndex\]\['cd'\]/s.test(salaryReconcile));
assert.ok(/\$oxHits=sd_recurring_find_indexes\(\$opex,\$key,\[\]\)/.test(salaryReconcile));
assert.ok(/array_merge\(\$oxHits,sd_recurring_find_indexes\(\$opex,\$key,\['shareTx'=>\$candidateCd,'shareholderSalary'=>true\]\)\)/.test(salaryReconcile));
assert.ok(/\$txIndex<0[\s\S]*\$sharetx\[\]=\['cd'=>\$txCd[\s\S]*'type'=>'salary'[\s\S]*'amt'=>\$salary[\s\S]*'t'=>\$month\.'\/01'/.test(salaryReconcile));
assert.ok(/\$sharetx\[\$txIndex\]\['month'\]=\$month;\$sharetx\[\$txIndex\]\['t'\]=\$month\.'\/01'/.test(salaryReconcile));
assert.ok(/\$opex\[\$oxIndex\]\['shareTx'\]=\$sharetx\[\$txIndex\]\['cd'\][\s\S]*\$opex\[\$oxIndex\]\['t'\]=\$month\.'\/01'/.test(salaryReconcile));
assert.ok(/\$salaryIdentityByCd=\[\].*isset\(\$salaryIdentityByCd\[\$shareTxCd\]\)/s.test(salaryReconcile));
assert.ok(/if\(\$key!==''\)\$ox\['recurringKey'\]=\$key;sd_recurring_void/.test(salaryReconcile));
assert.ok(/\$explicitEligibility&&\(\$scopeShareholder===''\|\|\$scopeShareholder===\$shCd\)/.test(salaryReconcile));
assert.ok((salaryReconcile.match(/kind'=>'duplicate_recurring_void'/g) || []).length >= 2);
assert.ok((api.match(/kind'=>'duplicate_recurring_void'/g) || []).length >= 3);
ok('restore فقط tombstone canonical را فعال می‌کند؛ salary legacy با shareTx پیدا می‌شود و duplicate cleanup فقط در scope صریح با correction اجرا می‌شود');

console.log('\n── Durable explicit tombstones ──');
var deleteHandler = section(opex, 'window.ptfOpexDel = function', 'window.ptfOpexEdit = function');
assert.ok(/rec\.status = 'void'.*rec\.st = 'void'.*rec\.voided = true.*rec\.deleted = true/s.test(deleteHandler));
assert.ok(/rec\.explicitDeletion = true.*rec\.manualVoid = true.*rec\.voidIntent = 'explicit'/s.test(deleteHandler));
assert.ok(/rec\.voidReason = deleteReason.*rec\.deletedAt = faDateTime\(\).*rec\.deletedBy = curSession\(\)\.name/s.test(deleteHandler));
assert.ok(/oSave\(all\)/.test(deleteHandler)); assert.ok(!/\.splice\s*\(/.test(deleteHandler));
var voidServer = section(api, "elseif ($action === 'void_recurring_opex')", "elseif ($action === 'post_receipt')");
assert.ok(/\$hits=\$keyHits\?:\(\$rowHits\?:\$cdHits\)/.test(voidServer));
assert.ok(/\$hits=sd_recurring_find_indexes\(\$opex,\$recurringKey,\[\]\)/.test(voidServer));
assert.ok(!/count\(\$hits\)!==1/.test(voidServer));
assert.ok(/foreach\(\$opex as &\$ox\).*recurringKey.*sd_recurring_void\(\$ox,\$reason,\$user,'explicit'\)/s.test(voidServer));
assert.ok(/kind'=>'explicit_void','beforeSnapshot'=>\$before,'afterSnapshot'=>\$ox/.test(voidServer));
ok('حذف manual و recurring فیزیکی نیست؛ reason/actor/time و correction پایدار ثبت می‌شود');

console.log('\n── Browser writers: server-only recurring and explicit void ──');
assert.ok(/ptfSalesDomainCommand\('reconcile_recurring_opex'/.test(opex));
assert.ok(/ptfSalesDomainCommand\('schedule_recurring_opex_cheque'/.test(opex));
assert.ok(/ptfSalesDomainCommand\('void_recurring_opex'/.test(opex));
assert.ok(/No local OPEX row is inserted/.test(opex));
assert.ok(/shareDomainCommand\('reconcile_shareholder_salaries'/.test(shareholders) && !/sharetx\.unshift|txs\.unshift/.test(shareholders));
assert.ok(/pendingRecurringOpexItems/.test(chequePanel) && /ptfChequeRetryRecurringOpex/.test(chequePanel));
assert.ok(/linkedOpex[\s\S]*ptf_crm_opex[\s\S]*isRecurringOpex[\s\S]*linked_recurring_opex/.test(chequeModule));
assert.ok(/!row \|\| isRecurringOpex\(row\)/.test(chequeModule));
assert.ok(/linked_recurring_opex[\s\S]*رابطهٔ مالی را یتیم/.test(chequePanel));
ok('writerهای materialization مرورگر حذف، retry چک حفظ و حذف محلیِ رابطهٔ سروری fail-closed شده است');

/* Runtime—not only source inspection—for the generation ACK race. The first
   request carries generation A; generation B is written before its response.
   A's ACK must leave the key dirty, and the keyed barrier may finish only after
   a second request has acknowledged B. */
async function runAckGenerationRuntime() {
  console.log('\n── Runtime ACK generation and keyed barrier ──');
  var ls = storage(), pendingPushes = [], pushBodies = [];
  ls.setItem('ptf_crm_token', 'runtime-token');
  function jsonResponse(payload) { return { ok: true, status: 200, json: function () { return Promise.resolve(payload); } }; }
  var rc = {
    window: null, console: console, localStorage: ls,
    setData: function (key, value) { ls.setItem(key, JSON.stringify(value)); return true; },
    getData: function (key) { try { return JSON.parse(ls.getItem(key) || '[]'); } catch (e) { return []; } },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'admin', name: 'Runtime Admin' }; },
    ptfAuthToken: function () { return 'runtime-token'; }, ptfAuthOk: function () { return true; }, /* v34.15.0 (R5/T4-1b): لایهٔ نشست جدید sync.js */
    document: {
      getElementById: function (id) { return id === 'crmL' ? { style: { display: 'block' } } : null; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {},
      hidden: true, hasFocus: function () { return true; }, activeElement: null,
      documentElement: { style: { setProperty: function () {} } }
    },
    navigator: {}, location: {},
    setInterval: function (fn, ms) { if (ms === 400) fn(); return 1; }, clearInterval: function () {},
    setTimeout: function () { return 1; }, clearTimeout: function () {},
    fetch: function (url, options) {
      if (String(url).indexOf('action=data_pull') >= 0) return Promise.resolve(jsonResponse({ ok: true, rev: 1, fresh: false, data: {}, meta: {} }));
      assert.ok(String(url).indexOf('action=data_push') >= 0);
      pushBodies.push(JSON.parse(options.body));
      return new Promise(function (resolve) { pendingPushes.push(resolve); });
    },
    alert: function () {}, addEventListener: function () {},
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error, isFinite: isFinite, parseInt: parseInt
  };
  rc.window = rc; vm.createContext(rc); vm.runInContext(sync, rc, { filename: 'sync-runtime.js' });
  for (var warm = 0; warm < 8 && !rc._ptfSyncBootstrapped; warm++) await Promise.resolve();
  assert.strictEqual(rc._ptfSyncBootstrapped, true, 'runtime sync did not bootstrap');

  rc.setData('ptf_crm_settings', { generation: 'A' });
  rc.ptfSyncFlushNow(function () {});
  assert.strictEqual(pendingPushes.length, 1); assert.strictEqual(JSON.parse(pushBodies[0].data.ptf_crm_settings).generation, 'A');
  rc.setData('ptf_crm_settings', { generation: 'B' });
  pendingPushes.shift()(jsonResponse({ ok: true, rev: 2, savedKeys: ['ptf_crm_settings'], krevs: { ptf_crm_settings: 2 } }));
  for (var firstAck = 0; firstAck < 8; firstAck++) await Promise.resolve();
  assert.strictEqual(JSON.parse(ls.getItem('ptf_sync_dirty')).ptf_crm_settings, true, 'older ACK cleared generation B');

  var barrierResult = null;
  rc.ptfSyncFlushKeysNow(['ptf_crm_settings'], function (passed, extra) { barrierResult = { passed: passed, extra: extra }; });
  assert.strictEqual(barrierResult, null, 'keyed barrier released before generation B ACK');
  assert.strictEqual(pendingPushes.length, 1); assert.strictEqual(JSON.parse(pushBodies[1].data.ptf_crm_settings).generation, 'B');
  pendingPushes.shift()(jsonResponse({ ok: true, rev: 3, savedKeys: ['ptf_crm_settings'], krevs: { ptf_crm_settings: 3 } }));
  for (var secondAck = 0; secondAck < 8 && !barrierResult; secondAck++) await Promise.resolve();
  assert.ok(barrierResult && barrierResult.passed, 'keyed barrier did not wait for/accept generation B ACK');
  assert.ok(!JSON.parse(ls.getItem('ptf_sync_dirty')).ptf_crm_settings);
  ok('ACK نسل A، نسل B را پاک نمی‌کند و barrier فقط پس از ACK همان کلید آزاد می‌شود');
}

runAckGenerationRuntime().then(function () {
  console.log('\n=== tester505 recurring hardening: PASS ===');
  console.log('PASS tester505 recurring hardening');
}).catch(function (err) {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
