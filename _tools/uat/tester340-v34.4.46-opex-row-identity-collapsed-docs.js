'use strict';
/* v34.4.46 — OPEX duplicate-code safety and collapsed attachment manager. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var opexSource = fs.readFileSync('crm/opex.js', 'utf8');
var codegenSource = fs.readFileSync('crm/codegen.js', 'utf8');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function codegenRuntimeChecks() {
  var common = ['CUST','SUP','P','RFQ','IQI','LEAD','CHQ','INV','PAY','CMP','TO','CO'];
  var pool = { OPX: [9000] };
  common.forEach(function (prefix) { pool[prefix] = [1,2,3,4,5,6,7,8,9,10]; });
  var store = { ptf_code_pool: JSON.stringify(pool) };
  var reserveCalls = 0;
  var ctx = {
    window: null, console: console, JSON: JSON, Math: Math, Date: Date,
    Object: Object, Array: Array, String: String, Number: Number, Promise: Promise,
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem: function (key, value) { store[key] = String(value); },
      removeItem: function (key) { delete store[key]; }
    },
    getData: function (key) { return key === 'ptf_crm_opex' ? [{ cd: 'OPX-1007' }, { cd: 'OPX-1003' }] : []; },
    faYear: function () { return 1405; },
    curRole: function () { return 'accountant'; },
    fetch: function () { reserveCalls++; return Promise.resolve({ json: function () { return Promise.resolve({ ok: false }); } }); },
    setTimeout: function () { return 0; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(codegenSource, ctx, { filename: 'crm/codegen.js' });
  assert.strictEqual(ctx.ptfUnifiedCode('OPX'), 'OPX-1008', 'OPX must continue after the persisted local maximum');
  assert.deepStrictEqual(JSON.parse(store.ptf_code_pool).OPX, [9000], 'stale OPX server pool must remain untouched');
  assert.strictEqual(reserveCalls, 0, 'OPX generation must not trigger a server refill');
}

function runtimeChecks() {
  var data = {
    ptf_crm_opex: [
      { cd: 'OPX-1001', cat: 'اجاره‌بها', amt: 100, month: '1405/04', desc: 'ردیف اول', dealRef: 'DEAL-1', files: [{ key: 'alpha.pdf', name: 'alpha.pdf' }, { key: 'beta.jpg', name: 'beta.jpg' }], t: '1405/04/01', by: 'مالی' },
      { cd: 'OPX-1001', cat: 'مالیات', amt: 200, month: '1405/04', desc: 'ردیف دوم', dealRef: 'DEAL-1', files: [{ key: 'second.pdf', name: 'second.pdf' }], t: '1405/04/02', by: 'مالی' },
      { cd: 'OPX-1002', cat: 'بیمه', amt: 300, month: '1405/04', desc: 'ردیف سوم', files: [], t: '1405/04/03', by: 'مالی' }
    ],
    ptf_crm_deals: [{ cd: 'DEAL-1', wonOffer: 'CO-1001', st: 'active', costEvents: [
      { cd: 'OPX-1001', amt: 100, files: [{ key: 'alpha.pdf', name: 'alpha.pdf' }], fromOpex: true },
      { cd: 'OPX-1001', amt: 200, files: [{ key: 'second.pdf', name: 'second.pdf' }], fromOpex: true }
    ], timeline: [] }],
    ptf_crm_fiscal_snapshots: []
  };
  var storage = { ptf_crm_settings: '{}' };
  var box = { innerHTML: '' };
  var elements = { opexBox: box };
  var modalHtml = '';
  var uploadCallback = null;
  var dialogConfig = null;
  var confirmCalls = 0;
  var warnings = [];

  var panels = {
    insertAdjacentHTML: function (_position, html) {
      modalHtml = html;
      var idMatch = html.match(/data-opex-row-id="([^"]+)"/);
      var modal = {
        rowId: idMatch ? idMatch[1] : '',
        getAttribute: function (name) { return name === 'data-opex-row-id' ? this.rowId : null; },
        remove: function () {
          delete elements.opexAttachDlg;
          delete elements.opexAttachFiles;
          delete elements.opexAttachUp;
        }
      };
      elements.opexAttachDlg = modal;
      elements.opexAttachFiles = { innerHTML: '' };
      elements.opexAttachUp = {};
    }
  };
  elements.panels = panels;

  var ctx = {
    console: console,
    JSON: JSON,
    Math: Math,
    Date: Date,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Promise: Promise,
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem: function (key, value) { storage[key] = String(value); },
      removeItem: function (key) { delete storage[key]; }
    },
    getData: function (key) { return clone(data[key] == null ? [] : data[key]); },
    setData: function (key, value) { data[key] = clone(value); },
    roleDef: function () { return { finance: true }; },
    curRole: function () { return 'accountant'; },
    curSession: function () { return { name: 'حسابدار' }; },
    faDate: function () { return '1405/04/12'; },
    faDateTime: function () { return '1405/04/12 10:00'; },
    genCode: function () { return 'OPX-1001'; }, /* deliberately collides */
    escP: function (value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },
    ptfOnClickArg: function (value) { return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); },
    ptfDialog: function (config) { dialogConfig = config; },
    attachUploadWidget: function (_id, _folder, cb) { uploadCallback = cb; },
    ptfToast: function (message) { warnings.push(message); },
    alert: function (message) { warnings.push(message); },
    confirm: function () { confirmCalls++; return true; },
    audit: function () {},
    renderDeals: function () {},
    openStoredFile: function () {},
    STORAGE_API: '/storage',
    ptfStorageAuthHeaders: function () { return {}; },
    ptfRemoveJustUploaded: function () {},
    fetch: function () { return Promise.resolve({ ok: true }); },
    document: {
      getElementById: function (id) { return elements[id] || null; },
      body: panels
    },
    setInterval: function () { return 1; },
    clearInterval: function () {}
  };
  ctx.window = ctx;
  ctx._opexMonth = '1405/04';
  vm.createContext(ctx);
  vm.runInContext(opexSource, ctx, { filename: 'crm/opex.js' });

  /* Migration-on-read creates stable, unique technical row identities. */
  ctx.ptfOpexRender();
  var migrated = data.ptf_crm_opex;
  var ids = migrated.map(function (row) { return row._opexRowId; });
  assert.ok(ids.every(Boolean), 'every legacy OPEX row must receive _opexRowId');
  assert.strictEqual(new Set(ids).size, migrated.length, 'technical row identities must be unique');
  ctx.ptfOpexRender();
  assert.deepStrictEqual(data.ptf_crm_opex.map(function (row) { return row._opexRowId; }), ids, 'backfilled row identities must remain stable');

  /* Filenames do not expand/corrupt the row; one count button owns the documents. */
  assert.ok(box.innerHTML.indexOf('2 سند') > -1, 'two attachments must collapse to one count label');
  assert.strictEqual(box.innerHTML.indexOf('alpha.pdf'), -1, 'attachment filenames must not render inline in the OPEX row');
  assert.strictEqual(box.innerHTML.indexOf('beta.jpg'), -1, 'multiple filenames must stay out of the OPEX row layout');
  assert.ok(box.innerHTML.indexOf("ptfOpexAttachOpen('OPX-1001','" + ids[0] + "')") > -1, 'attachment action must carry the exact row id');
  assert.ok(box.innerHTML.indexOf("ptfOpexEdit('OPX-1001','" + ids[1] + "')") > -1, 'edit action must carry the exact row id');
  assert.ok(box.innerHTML.indexOf("ptfOpexDel('OPX-1001','" + ids[1] + "')") > -1, 'delete action must carry the exact row id');

  /* A legacy code-only call is rejected when cd is ambiguous. */
  var beforeAmbiguous = clone(data.ptf_crm_opex);
  var confirmsBefore = confirmCalls;
  ctx.ptfOpexDel('OPX-1001');
  assert.deepStrictEqual(data.ptf_crm_opex, beforeAmbiguous, 'ambiguous code-only delete must not change data');
  assert.strictEqual(confirmCalls, confirmsBefore, 'ambiguous delete must abort before confirmation');
  assert.ok(warnings.some(function (message) { return message.indexOf('تکراری') > -1; }), 'ambiguous legacy action must warn the user');

  /* Edit resolves by row id even when both records share the same visible cd. */
  ctx.ptfOpexEdit('OPX-1001', ids[1]);
  assert.ok(dialogConfig && typeof dialogConfig.onOk === 'function', 'exact-row edit dialog must open');
  dialogConfig.onOk({ cat: 'مالیات', isOfficial: 'no', amt: 225, month: '1405/04', desc: 'فقط ردیف دوم', dealRef: 'DEAL-1', files: [] });
  var duplicateRows = data.ptf_crm_opex.filter(function (row) { return row.cd === 'OPX-1001'; });
  assert.strictEqual(duplicateRows.filter(function (row) { return row._opexRowId === ids[0]; })[0].amt, 100, 'editing duplicate row B must not mutate row A');
  assert.strictEqual(duplicateRows.filter(function (row) { return row._opexRowId === ids[1]; })[0].amt, 225, 'the clicked duplicate row must be edited');
  var eventsAfterEdit = data.ptf_crm_deals[0].costEvents;
  assert.strictEqual(eventsAfterEdit.filter(function (event) { return event.opexRowId === ids[1]; })[0].amt, 225, 'linked deal edit must update the clicked OPEX row event');
  assert.strictEqual(eventsAfterEdit.filter(function (event) { return (+event.amt || 0) === 100; })[0].opexRowId, undefined, 'linked deal edit must not claim the same-code sibling event');

  /* Attachment manager displays files away from the row and uploads to the exact row. */
  ctx.ptfOpexAttachOpen('OPX-1001', ids[0]);
  assert.ok(modalHtml.indexOf('alpha.pdf') > -1 && modalHtml.indexOf('beta.jpg') > -1, 'collapsed document button must open the file manager list');
  assert.ok(typeof uploadCallback === 'function', 'attachment manager must initialize upload widget');
  uploadCallback({ key: 'new-proof.pdf', name: 'new-proof.pdf' });
  var firstAfterUpload = data.ptf_crm_opex.filter(function (row) { return row._opexRowId === ids[0]; })[0];
  var secondAfterUpload = data.ptf_crm_opex.filter(function (row) { return row._opexRowId === ids[1]; })[0];
  assert.ok(firstAfterUpload.files.some(function (file) { return file.key === 'new-proof.pdf'; }), 'uploaded document must bind to the clicked row');
  assert.strictEqual(secondAfterUpload.files.some(function (file) { return file.key === 'new-proof.pdf'; }), false, 'upload must not leak to the same-code sibling row');

  /* Exact delete removes one object, never every row sharing cd. */
  ctx.ptfOpexDel('OPX-1001', ids[1]);
  assert.strictEqual(data.ptf_crm_opex.some(function (row) { return row._opexRowId === ids[1]; }), false, 'clicked row must be deleted');
  assert.strictEqual(data.ptf_crm_opex.some(function (row) { return row._opexRowId === ids[0]; }), true, 'same-code sibling must survive exact delete');
  assert.strictEqual(data.ptf_crm_deals[0].costEvents.some(function (event) { return event.opexRowId === ids[1]; }), false, 'linked event for the deleted row must be removed');
  assert.strictEqual(data.ptf_crm_deals[0].costEvents.some(function (event) { return event.opexRowId === ids[0]; }), true, 'same-code sibling linked event must survive delete');
  dialogConfig = null;
  ctx.ptfOpexEdit('OPX-1001', ids[1]);
  assert.strictEqual(dialogConfig, null, 'a stale exact row id must never fall back to the remaining same-code sibling');

  /* New record allocation scans persisted OPEX when the generic generator collides. */
  dialogConfig = null;
  ctx.ptfOpexAdd();
  assert.ok(dialogConfig && typeof dialogConfig.onOk === 'function', 'new OPEX dialog must open');
  dialogConfig.onOk({ cat: 'سایر', isOfficial: 'no', amt: 400, month: '1405/04', desc: 'کد یکتا', dealRef: '', files: [], rec: 'no' });
  var codes = data.ptf_crm_opex.map(function (row) { return row.cd; });
  assert.strictEqual(new Set(codes).size, codes.length, 'new OPEX code must not collide with persisted records');
  assert.ok(codes.indexOf('OPX-1003') > -1, 'collision-safe fallback must continue after the persisted OPX maximum');
}

function staticChecks() {
  assert.ok(codegenSource.indexOf("'OPX':'ptf_crm_opex'") > -1, 'local legacy code generator must scan persisted OPEX codes');
  assert.ok(codegenSource.indexOf("LOCAL_ONLY_PREFIXES = ['OPX']") > -1 && codegenSource.indexOf('isLocalOnlyPrefix(p) ? null : nextFromPool') > -1, 'OPX must not consume an unseeded server pool');
  assert.ok(codegenSource.indexOf("if (!isLocalOnlyPrefix(p)) { try { window._ptfRefillPoolBackground(p);") > -1 && codegenSource.indexOf('if (!isLocalOnlyPrefix(p)) {\n        var pool=getPool();') > -1, 'OPX must neither refill nor scan the unseeded server pool');
  assert.ok(opexSource.indexOf('opexRowId: rec[OPEX_ROW_ID]') > -1, 'linked deal event must persist OPEX row identity');
  assert.ok(opexSource.indexOf('var ev = opexDealEvent(d, rec, true)') > -1, 'attachment sync must resolve linked deal event by row identity');

  var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
  assert.strictEqual(version, 'v34.4.46');
  var current = version.slice(1);
  ['crm/index.html', 'crm/sw.js', 'crm/manifest.json', 'crm/clear-cache.html', 'crm/shell.js'].forEach(function (file) {
    assert.ok(fs.readFileSync(file, 'utf8').indexOf(current) > -1, file + ' version drift');
  });
}

codegenRuntimeChecks();
runtimeChecks();
staticChecks();
console.log('PASS tester340-v34.4.46: OPEX row identity, unique codes, exact actions and collapsed document manager');
