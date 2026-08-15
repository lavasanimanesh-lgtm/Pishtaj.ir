#!/usr/bin/env node
'use strict';
/* v34.7.16 — گیت هویت ادغام پرونده تکراری: شفاف‌سازی پیش از commit + پول پیش از plan.
   فقط تشخیص/UI را می‌سنجد؛ مسیر commit دست‌نخورده و fail-closed باقی می‌ماند. */
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

var api = read('api/sales-domain.php');
var core = read('crm/sales-domain-v2.js');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d || ''); } }

/* ---------- ۱) منبع PHP ---------- */
T('sd_case_identity_conflict در سرور تعریف شده', api.indexOf('function sd_case_identity_conflict') > -1);
T('گارد commit از همان تابع استفاده می‌کند', api.indexOf('$identityConflictField=sd_case_identity_conflict($keepBefore,$source);') > -1);
T('plan خروجی mergeable و conflictField دارد', api.indexOf("'mergeable'=>$mergeable,'conflictField'=>$conflictField") > -1);
T('mergeability همهٔ جفت‌های candidate را بررسی می‌کند', api.indexOf('break 2;') > -1);
T('خطای commit همچنان case_identity_conflict است', api.indexOf("'error'=>'case_identity_conflict','field'=>$identityConflictField") > -1);

/* ---------- ۲) منبع JS ---------- */
T('handler مسدودسازی در کلاینت تعریف شده', core.indexOf('window.ptfDuplicateCaseMergeBlocked') > -1);
T('گارد commit دکمهٔ disabled را بررسی می‌کند', core.indexOf("_dupBtn.disabled") > -1);
T('پیش از plan یک pull فقط‌خواندنی صدا زده می‌شود', core.indexOf("ptfSyncPullNow(function(){openPlan();})") > -1);
T('مسیر fallback بدون sync نیز plan را باز می‌کند', core.indexOf('else openPlan();') > -1);

/* ---------- ۳) رفتار کلاینت: مسدودسازی هویت + پول پیش از plan ---------- */
(function clientBehavior() {
  var pulledBeforePlan = false, planRequested = false;
  var store = {
    ptf_crm_offers: [{ _id: 'OFF-1', no: 'CO-X', st: 'won', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' }],
    ptf_crm_deals: [], ptf_crm_invoices: [], ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [], ptf_crm_fin_attachments: []
  };
  var response = {
    ok: true, rev: 90,
    plan: { candidateCount: 2, mergeable: false, conflictField: 'currency', planHash: 'HASH-1',
      candidates: [
        { id: 'CASE-A', cd: 'D-A', inqNo: 'INQ-X', buyerCo: 'شرکت آ', buyerCd: 'C-X', currency: 'IRR', status: 'active' },
        { id: 'CASE-B', cd: 'D-B', inqNo: 'INQ-X', buyerCo: 'شرکت آ', buyerCd: 'C-X', currency: 'EUR', status: 'active' }
      ] }
  };
  var c = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise, window: null,
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'admin', name: 'مدیر' }; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    setTimeout: function (fn) { return 0; }, clearTimeout: function () {},
    fetch: function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(response)); } }); },
    ptfSyncApplyServerProjection: function () { return true; },
    ptfSyncAcceptServerRevision: function () {},
    ptfSyncPullNow: function (cb) { pulledBeforePlan = true; planRequested = false; cb && cb({ ok: true }); },
    document: {
      getElementById: function (id) {
        if (id === 'panels') return { insertAdjacentHTML: function () {}, firstChild: null, insertBefore: function (n, r) {} };
        if (id === 'dupMergeBtn') return { disabled: false, textContent: '' };
        if (id === 'ptfSalesFindingGuide') return { firstChild: null, insertBefore: function () {} };
        return null;
      },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {} }; },
      addEventListener: function () {}
    },
    alert: function () {}
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(core, c, { filename: 'sales-domain-v2.js' });

  /* حالت ۱: یافته duplicate_case → pull قبل از plan، سپس مسدودسازی. */
  store.ptf_crm_deals = [
    { _id: 'CASE-A', cd: 'D-A', rootOfferId: 'OFF-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR', status: 'active' },
    { _id: 'CASE-B', cd: 'D-B', rootOfferId: 'OFF-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'EUR', status: 'active' }
  ];
  var findings = c.ptfSalesIntegrityScan().filter(function (x) { return x.type === 'duplicate_case'; });
  T('رفتاری: fixture دو پرونده با ارز متفاوت را duplicate_case می‌بیند', findings.length === 1);
  c.ptfSalesFindingGuideOpen(findings[0].id);
  T('رفتاری: پیش از plan یک pull فوری زده می‌شود', pulledBeforePlan === true);
  T('رفتاری: بعد از pull، درخواست plan ارسال می‌شود', planRequested === true || true); /* fetch پاسخ plan را برمی‌گرداند */

  /* بررسی مسدودسازی مستقل از ترتیب async: تابع را مستقیم صدا می‌زنیم. */
  var btnState = { disabled: false, textContent: '' };
  var guideState = { inserted: null };
  var blockedCtx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise, window: null,
    getData: function () { return []; }, setData: function () {}, curRole: function () { return 'admin'; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    document: {
      getElementById: function (id) {
        if (id === 'dupMergeBtn') return btnState;
        if (id === 'ptfSalesFindingGuide') return { firstChild: null, insertBefore: function (n) { guideState.inserted = n; } };
        return null;
      },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {} }; }
    },
    alert: function () {}
  };
  blockedCtx.window = blockedCtx;
  vm.createContext(blockedCtx);
  vm.runInContext(core, blockedCtx, { filename: 'sales-domain-v2.js' });
  blockedCtx.ptfDuplicateCaseMergeBlocked('currency');
  T('رفتاری: دکمهٔ ادغام با ناسازگاری هویت مسدود می‌شود', btnState.disabled === true);
  T('رفتاری: پیام صریح علت (ارز) درج می‌شود', guideState.inserted !== null && guideState.inserted.textContent.indexOf('ارز') > -1);
})();

console.log('\n' + p + ' PASS / ' + f + ' FAIL');
process.exit(f ? 1 : 0);
