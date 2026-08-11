'use strict';
/* Regression: searchable supplier RFQs + explicit duplicate create/open decision. */
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var src = fs.readFileSync('crm/rfqsmart.js', 'utf8');
var buy = fs.readFileSync('crm/buycompare.js', 'utf8');
var ai = fs.readFileSync('crm/ai-workbench.js', 'utf8');

/* Structural UI/flow contracts. */
assert.ok(src.indexOf('id="rfqsSearch"') > -1 && src.indexOf('rfqsSetListSearch(this.value)') > -1, 'supplier-request list search input missing');
assert.ok(src.indexOf('شماره درخواست تامین، RFQ داخلی، شماره درخواست کارفرما، کالا، شرکت یا تامین‌کننده') > -1, 'search scope must be explicit to the user');
assert.ok(src.indexOf('window.ptfRfqsFilterRecords') > -1 && src.indexOf('rfqsSearchNorm') > -1, 'search/filter core missing');
assert.ok(src.indexOf('window.ptfRfqsExistingForSource') > -1 && src.indexOf('rfqsSameSource') > -1, 'alias-aware duplicate lookup missing');
assert.ok(src.indexOf('تأیید = ثبت درخواست جدید') > -1 && src.indexOf('انصراف = باز کردن درخواست تامین قبلی') > -1, 'duplicate decision must clearly describe both outcomes');
assert.ok(src.indexOf('rfqsOpenExistingAfterCancel(first, triggerEl)') > -1, 'declining duplicate creation must navigate to the previous request');
assert.ok(src.indexOf('duplicateOf = first.no') > -1 && src.indexOf('duplicateConfirmedAt') > -1, 'intentional duplicate must retain traceability metadata');
assert.ok(src.indexOf("if (v && !rfqsGuardDuplicateSource(v, _st && _st.no, src)) return") > -1, 'duplicate warning must run immediately when source request is selected');
assert.ok(src.indexOf("if (idx === -1 && _st.srcRfq && !rfqsGuardDuplicateSource") > -1, 'final race-safe duplicate guard missing');
assert.ok(buy.indexOf('rfqsNew(inqNo)') > -1, 'real-buy entry must use the same duplicate decision flow');
assert.ok(ai.indexOf("window.ptfRfqsExistingForSource(inqNo,'')") > -1 && ai.indexOf("window.ptfRfqsOpenExisting(existingSupply[0].no)") > -1, 'AI Workbench sourcing must warn and navigate instead of silently duplicating');
assert.ok(ai.indexOf('duplicateOf:duplicateSupplyOf') > -1, 'AI-confirmed duplicate must be traceable too');

/* Execute the pure search/alias/duplicate-decision section. */
var start = src.indexOf('(function () {');
var end = src.indexOf('  /* ============ پنل ============ */', start);
assert.ok(start > -1 && end > start, 'rfqsmart helper boundary missing');
var rfqs = [
  { cd: 'RFQ-SYS-001', inqNo: 'CUST/RFQ-۹۹', co: 'کارفرمای فولاد', subj: 'شیرآلات خط تولید', con: 'خانم خرید' },
  { cd: 'RFQ-SYS-002', inqNo: 'REQ-2026-77', co: 'شرکت پالایش', subj: 'پمپ فرایندی' }
];
var smart = [
  { no: 'PTF-RFQS-1405-001', srcRfq: 'RFQ-SYS-001', st: 'sent', t: '1405/05/20', by: 'خریدار', items: [{ name: 'شیر پروانه‌ای', spec: 'کلاس 150', model: 'BFV-8', brand: 'BrandX', unit: 'عدد' }], targets: [{ cd: 'SUP-1', co: 'تامین‌کننده آریا' }] },
  { no: 'PTF-RFQS-1405-002', srcRfq: 'CUST/RFQ-۹۹', st: 'draft', items: [{ name: 'اکچویتور برقی', spec: 'IP67' }], targets: [] },
  { no: 'PTF-RFQS-1405-003', srcRfq: 'RFQ-SYS-002', st: 'done', items: [{ name: 'پمپ سانتریفیوژ', model: 'P-200' }], targets: [{ co: 'پمپ‌سازان' }] }
];
var opened = [], confirms = [], confirmResult = false;
var ctx = {
  window: null, JSON: JSON, Object: Object, Array: Array, Date: Date, console: console,
  getData: function (key) { if (key === 'ptf_crm_rfqs') return rfqs; if (key === 'ptf_crm_rfqsmart') return smart; return []; },
  ptfInqAliases: function (v) {
    var r = rfqs.filter(function (x) { return x.cd === v || x.inqNo === v; })[0];
    return r ? [r.cd, r.inqNo] : [v];
  },
  confirm: function (msg) { confirms.push(msg); return confirmResult; },
  curSession: function () { return { name: 'تستر' }; },
  renderRfqSmart: function () {}, rfqsOpen: function (no) { opened.push(no); },
  setTimeout: function (fn) { fn(); return 0; },
  document: { getElementById: function () { return null; } }
};
ctx.window = ctx; ctx.ptfActivePanel = 'rfqs';
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\n})();', ctx, { filename: 'rfqsmart-search-guard.js' });

function nos(rows) { return Array.from(rows).map(function (r) { return r.no; }); }
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'CUST/RFQ-99')), ['PTF-RFQS-1405-001', 'PTF-RFQS-1405-002'], 'customer RFQ number search must normalize Persian digits and source aliases');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'rfq-sys-001')), ['PTF-RFQS-1405-001', 'PTF-RFQS-1405-002'], 'internal request number must find all linked supplier requests');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'شیر پروانه')), ['PTF-RFQS-1405-001'], 'item-name search failed');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'bfv-8')), ['PTF-RFQS-1405-001'], 'model search failed');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'کارفرمای فولاد')), ['PTF-RFQS-1405-001', 'PTF-RFQS-1405-002'], 'customer search failed');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'تامین کننده آریا')), ['PTF-RFQS-1405-001'], 'supplier search must normalize ZWNJ');
assert.deepStrictEqual(nos(ctx.ptfRfqsFilterRecords(smart, 'PTF-RFQS-1405-003')), ['PTF-RFQS-1405-003'], 'supplier-request number search failed');

assert.deepStrictEqual(nos(ctx.ptfRfqsExistingForSource('CUST/RFQ-۹۹', '')), ['PTF-RFQS-1405-001', 'PTF-RFQS-1405-002']);
assert.deepStrictEqual(nos(ctx.ptfRfqsExistingForSource('RFQ-SYS-001', 'PTF-RFQS-1405-001')), ['PTF-RFQS-1405-002'], 'editing current request must exclude itself');
assert.strictEqual(ctx.ptfRfqsGuardDuplicateSource('RFQ-SYS-001', 'NEW-1', null), false, 'Cancel must decline duplicate creation');
assert.deepStrictEqual(opened, ['PTF-RFQS-1405-001'], 'Cancel must open the latest existing supplier request');
assert.ok(confirms[0].indexOf('CUST/RFQ-۹۹') > -1 && confirms[0].indexOf('PTF-RFQS-1405-001') > -1, 'warning must identify customer and prior supplier request numbers');
confirmResult = true;
assert.strictEqual(ctx.ptfRfqsGuardDuplicateSource('RFQ-SYS-001', 'NEW-2', null), true, 'explicit confirmation must permit another supplier request');

var version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8')).crm_version;
assert.strictEqual(version, 'v34.4.43');
['crm/index.html','crm/sw.js','crm/manifest.json','crm/clear-cache.html','crm/shell.js'].forEach(function (file) {
  assert.ok(fs.readFileSync(file, 'utf8').indexOf('34.4.43') > -1, file + ' version drift');
});
console.log('PASS tester337-v34.4.43: supplier RFQs search by request/customer/item/supplier and duplicate creation redirects or proceeds explicitly');
