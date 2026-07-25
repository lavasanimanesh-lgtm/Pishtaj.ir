#!/usr/bin/env node
/* PTF CRM — v26.7 — AI Workbench → existing RFQ items regression */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const ai = fs.readFileSync(path.join(ROOT, 'crm/ai-workbench.js'), 'utf8');
const idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf8');
let pass = 0, fail = 0;
function ok(condition, label) { if (condition) { pass++; console.log('  ✓ PASS: ' + label); } else { fail++; console.log('  ✘ FAIL: ' + label); } }
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) return '';
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  return '';
}
const normFn = extractFunction(ai, 'aiWB_itemNorm');
const keyFn = extractFunction(ai, 'aiWB_itemKey');
const addFn = extractFunction(ai, 'aiWBAppendItemsToRfq');
ok(!!normFn && !!keyFn && !!addFn, 'AI request-item append helpers exist');
ok(ai.includes('id="aiTP_addItems"') && ai.includes('افزودن اقلام انتخاب‌شده به'), 'explicit UI consent checkbox exists');
ok(ai.includes('if(doAddItems && !inqNo && !doRfq)') && ai.includes('aiWBAppendItemsToRfq(inqNo, rows, out.runId)'), 'triple flow validates target RFQ and calls append helper');
ok(ai.indexOf('aiWBAppendItemsToRfq(inqNo, rows, out.runId)') < ai.indexOf('ptfAutoRegisterSummaryProducts'), 'request-item registration happens before catalog registration');
ok(ai.includes('برای این درخواست پیشنهاد صادر شده است') && ai.includes('itemSync:out.items'), 'existing RFQ lock and 60-second rollback metadata are retained');

const store = {
  ptf_crm_rfqs: [{ cd: 'PTF-RFQ-501', inqNo: 'BUYER-44', items: [{ nm: 'Gate Valve', st: 'API 600', qty: 1, un: 'عدد' }] }],
  ptf_crm_inqitems: [{ cd: 'IQI-OLD', inqNo: 'BUYER-44', nm: 'Gate Valve', st: 'API 600', qty: 1, un: 'عدد' }],
  ptf_crm_offers: []
};
const ctx = {
  getData: (k) => JSON.parse(JSON.stringify(store[k] || [])),
  setData: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  genCode: (() => { let n = 0; return (p) => p + '-NEW-' + (++n); })(),
  faDate: () => '1405/04/22', audit: () => {}, console
};
vm.createContext(ctx);
vm.runInContext(normFn + '\n' + keyFn + '\n' + addFn, ctx);
const result = ctx.aiWBAppendItemsToRfq('PTF-RFQ-501', [
  { nm: 'Gate Valve', spec: 'API 600', qty: 1, un: 'عدد', tp: 'Valve' },
  { nm: 'Pressure Transmitter', spec: '4-20mA', model: '3051', qty: 2, un: 'عدد', tp: 'Instrument' }
], 'AIWB-test');
ok(result.ok && result.added === 1 && result.skipped === 1, 'duplicate item is skipped while new AI item is appended');
ok(store.ptf_crm_inqitems.filter((x) => x.inqNo === 'PTF-RFQ-501' && x.nm === 'Pressure Transmitter').length === 1, 'new item is stored under canonical internal RFQ key');
ok(store.ptf_crm_rfqs[0].items.filter((x) => x.nm === 'Pressure Transmitter').length === 1, 'request snapshot is updated alongside inqitems');
store.ptf_crm_offers = [{ no: 'TO-1', inqNo: 'BUYER-44' }];
const locked = ctx.aiWBAppendItemsToRfq('PTF-RFQ-501', [{ nm: 'Cable', spec: 'NYY' }], 'AIWB-locked');
ok(!locked.ok && /قفل/.test(locked.error), 'issued offer locks AI append to existing request');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx), 'CRM version v26.7 is declared');
ok(/var CACHE = 'ptf-crm-v\d+(?:\.\d+)+/.test(sw), 'service-worker cache is version-aligned');
console.log('=== tester142-v2511-ai-request-items: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
