#!/usr/bin/env node
'use strict';
/* v34.7.15 — رفع دو عامل شکست ادغام پرونده تکراری «فروش تا وصول»:
   ۱) planHash از ترتیب کلیدهای JSON مستقل می‌شود (sd_norm_for_hash).
   ۲) rootOfferId کهنه/بازتولیدشده به wonOffer/offerNo fallback می‌کند (سرور + کلاینت).
   این تست فقط تشخیص/هش را می‌سنجد؛ هیچ داده‌ای نوشته نمی‌شود. */
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function section(src, from, to) { var a = src.indexOf(from), b = src.indexOf(to, a + from.length); return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b); }

var api = read('api/sales-domain.php');
var core = read('crm/sales-domain-v2.js');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d || ''); } }

/* ---------- ۱) منبع PHP: نرمال‌سازی هش + fallback rootOfferId ---------- */
T('sd_norm_for_hash در سرور تعریف شده', api.indexOf('function sd_norm_for_hash') > -1);
T('recordHash از نرمال‌سازی استفاده می‌کند', api.indexOf('json_encode(sd_norm_for_hash($case)') > -1);
T('sd_case_offer_linked دیگر rootOfferId کهنه را قطعی رد نمی‌کند', api.indexOf('return hash_equals($oid,$root); /* root ID authoritative */') === -1);
T('sd_case_offer_linked در تطابق root بلافاصله true می‌دهد', /if\(oid!==''&&root!==''\)\s*\{\s*if\(hash_equals\(\$oid,\$root\)\)return true;/.test(api) || (api.indexOf('if(hash_equals($oid,$root))return true;') > -1));
T('گارد هویت commit دست‌نخورده باقی مانده', api.indexOf("['inqNo','buyerCd','currency']") > -1 && api.indexOf('case_identity_conflict') > -1);

/* ---------- ۲) آینهٔ JS نرمال‌سازی: ترتیب کلیدها نباید هش را عوض کند ---------- */
/* بازسازی دقیق رفتار sd_norm_for_hash در PHP برای اثبات خاصیت «مستقل از ترتیب». */
function jsNorm(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(jsNorm);
  var keys = Object.keys(v).sort();
  var out = {};
  keys.forEach(function (k) { out[k] = jsNorm(v[k]); });
  return out;
}
var oA = { _id: 'CASE-1', cd: 'D-1', docs: [{ name: 'a', cat: 'x' }], meta: { a: 1, b: 2 } };
var oB = { meta: { b: 2, a: 1 }, cd: 'D-1', _id: 'CASE-1', docs: [{ cat: 'x', name: 'a' }] };
T('نرمال‌سازی: ترتیب کلیدهای تودرتو اثری بر امضا ندارد', JSON.stringify(jsNorm(oA)) === JSON.stringify(jsNorm(oB)));
var lA = [1, 2], lB = [2, 1];
T('نرمال‌سازی: ترتیب عناصر لیست همچنان معنادار است', JSON.stringify(jsNorm(lA)) !== JSON.stringify(jsNorm(lB)));

/* ---------- ۳) رفتار کلاینت: caseBelongsToOffer fallback ---------- */
(function clientFallback() {
  var store = {
    ptf_crm_offers: [{ _id: 'OFF-1', no: 'CO-X', st: 'won', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' }],
    ptf_crm_deals: [], ptf_crm_invoices: [], ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [], ptf_crm_fin_attachments: []
  };
  var c = {
    console: console, JSON: JSON, Math: Math, Date: Date, Promise: Promise, window: null,
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; },
    curRole: function () { return 'chairman'; }, curSession: function () { return { user: 'admin', name: 'مدیر' }; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    setTimeout: function (fn) { return 0; }, clearTimeout: function () {},
    fetch: function () { return Promise.reject(new Error('offline')); },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {} }
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(core, c, { filename: 'sales-domain-v2.js' });

  var offer = { _id: 'OFF-1', no: 'CO-X', st: 'won', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR' };
  var correct = { _id: 'CASE-A', cd: 'D-A', rootOfferId: 'OFF-1', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR', status: 'active' };
  var stale = { _id: 'CASE-B', cd: 'D-B', rootOfferId: 'OFF-OLD-STALE', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'C-X', currency: 'IRR', status: 'active' };
  var foreign = { _id: 'CASE-C', cd: 'D-C', rootOfferId: 'OFF-OLD-STALE', wonOffer: 'CO-X', inqNo: 'INQ-X', buyerCd: 'OTHER-CUST', currency: 'IRR', status: 'active' };

  T('رفتاری: rootOfferId درست همچنان متصل است', c.ptfCaseBelongsToOffer(correct, offer) === true);
  T('رفتاری: rootOfferId کهنه با wonOffer+هویت یکسان fallback و متصل می‌شود', c.ptfCaseBelongsToOffer(stale, offer) === true);
  T('رفتاری: هویت متفاوت همچنان fail-closed است', c.ptfCaseBelongsToOffer(foreign, offer) === false);

  /* دو پرونده (یکی با rootOfferId کهنه) باید اکنون هر دو در یافته duplicate_case بیایند. */
  store.ptf_crm_deals = [correct, stale];
  var findings = c.ptfSalesIntegrityScan().filter(function (x) { return x.type === 'duplicate_case'; });
  T('رفتاری: rootOfferId کهنه دیگر پرونده را از یافته duplicate_case پنهان نمی‌کند', findings.length === 1 && findings[0].label.indexOf('2 پرونده') === 0);
})();

console.log('\n' + p + ' PASS / ' + f + ' FAIL');
process.exit(f ? 1 : 0);
