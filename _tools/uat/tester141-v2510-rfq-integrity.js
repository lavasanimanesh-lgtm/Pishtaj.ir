#!/usr/bin/env node
/* PTF CRM — v26.7 — RFQ item integrity + attachment button regression */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const ir = fs.readFileSync(path.join(ROOT, 'crm/inqreader.js'), 'utf8');
const bridge = fs.readFileSync(path.join(ROOT, 'crm/bridge.js'), 'utf8');
const idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf8');
let pass = 0, fail = 0;
function ok(condition, label) {
  if (condition) { pass++; console.log('  ✓ PASS: ' + label); }
  else { fail++; console.log('  ✘ FAIL: ' + label); }
}
function extractBlock(source, start) {
  if (start < 0) return '';
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  return '';
}
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  return extractBlock(source, start);
}
function extractAssignment(source, signature) {
  const start = source.indexOf(signature);
  return extractBlock(source, start);
}
const aliasesFn = extractFunction(ir, 'irRfqAliases');
const matchFn = extractFunction(ir, 'irAliasMatch');
ok(!!aliasesFn && !!matchFn, 'canonical RFQ alias helpers exist');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(aliasesFn + '\n' + matchFn, ctx);
const aliases = ctx.irRfqAliases({ cd: 'PTF-RFQ-101', inqNo: 'CLIENT-88' }, 'PTF-RFQ-101');
ok(JSON.stringify(aliases) === JSON.stringify(['PTF-RFQ-101', 'CLIENT-88']), 'internal RFQ and customer request number form one alias set');
const legacy = [
  { inqNo: 'PTF-RFQ-101', cd: 'IQI-1' },
  { inqNo: 'CLIENT-88', cd: 'IQI-2' },
  { inqNo: 'OTHER-77', cd: 'IQI-3' }
];
const remaining = legacy.filter((x) => !ctx.irAliasMatch(x, aliases));
ok(remaining.length === 1 && remaining[0].inqNo === 'OTHER-77', 'alias cleanup removes both canonical and legacy customer-number item records');

/* رفتار واقعی ذخیرهٔ ویرایش با دادهٔ legacy: حذف همهٔ قلم‌ها نباید از شماره کارفرما بازگردد. */
const clearFn = extractFunction(ir, 'irClearReadSnapshots');
const saveFn = extractAssignment(ir, 'window.ptfSaveFullInqEdit = function(cd)');
const store = {
  ptf_crm_rfqs: [{ cd: 'PTF-RFQ-101', inqNo: 'CLIENT-88', subj: 'test', items: [{ nm: 'stale' }] }],
  ptf_crm_inqitems: [{ inqNo: 'PTF-RFQ-101', cd: 'IQI-1', nm: 'canonical item' }, { inqNo: 'CLIENT-88', cd: 'IQI-2', nm: 'legacy customer-ref item' }, { inqNo: 'OTHER-77', cd: 'IQI-3', nm: 'other request item' }],
  ptf_crm_inqreads: [{ cd: 'PTF-RFQ-101', inqNo: 'CLIENT-88', rows: [{ nm: 'stale snapshot' }] }, { cd: 'OTHER-77', inqNo: 'OTHER-77', rows: [{ nm: 'other snapshot' }] }],
  ptf_crm_customers: []
};
const exec = {
  window: { _inqEditItems: [] },
  getData: (k) => JSON.parse(JSON.stringify(store[k] || [])),
  setData: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  document: { getElementById: (id) => id === 'inqEdSubj' ? { value: '' } : null },
  genCode: (() => { let n = 0; return (p) => p + '-' + (++n); })(),
  faDate: () => '1405/04/22', confirm: () => false, renderRfq: () => {}, audit: () => {}, console
};
exec.window.window = exec.window;
vm.createContext(exec);
vm.runInContext(aliasesFn + '\n' + matchFn + '\n' + clearFn + '\n' + saveFn, exec);
exec.window.ptfSaveFullInqEdit('PTF-RFQ-101');
ok(store.ptf_crm_rfqs[0].items.length === 0, 'save persists an empty canonical r.items array');
ok(store.ptf_crm_inqitems.length === 1 && store.ptf_crm_inqitems[0].inqNo === 'OTHER-77', 'save deletes both canonical and customer-number item rows');
ok(store.ptf_crm_inqreads.length === 1 && store.ptf_crm_inqreads[0].cd === 'OTHER-77', 'save deletes stale AI-reader snapshot so deleted items cannot reappear');

ok(ir.includes('var removedReads = irClearReadSnapshots(aliases);'), 'saving edited items removes stale AI-reader snapshots');
ok(ir.includes('var iq = allItems.filter(function (x) { return !irAliasMatch(x, aliases); });'), 'save path rewrites the complete alias set rather than only CD rows');
ok(ir.includes("iq.push({ inqNo: cd, cd: genCode('IQI')"), 'edited items are written back using the canonical internal RFQ key');
ok(ir.includes('var items = irItemsForRfq(r, cd);'), 'viewer and full editor use the shared alias-aware item lookup');
ok(ir.includes('window.irAiReadCurrentAttachments = function') && ir.includes('onclick="irAiReadCurrentAttachments()"'), 'AI attachment button is connected through a global bridge rather than inaccessible closure state');
ok(!ir.includes('onclick="inqReadAttachmentAsk(_ir.cd)"'), 'no inline onclick references local _ir closure state');
ok(bridge.includes('var customerInqLine =') && bridge.includes('↳ درخواست کارفرما:'), 'customer request number is rendered beneath internal RFQ in list');
ok(ir.includes('شماره RFQ داخلی:') && ir.includes('شماره درخواست کارفرما:'), 'viewer distinguishes internal RFQ and customer request number');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx), 'CRM version v26.7 is declared');
ok(/var CACHE = 'ptf-crm-v\d+(?:\.\d+)+/.test(sw), 'service-worker cache is version-aligned');
console.log('=== tester141-v2510-rfq-integrity: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
