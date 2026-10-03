#!/usr/bin/env node
'use strict';
/* Customer overview: real read-only model + AR kernel + customer renderer.
   No production data, network, package dependencies or version-literal pins. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..'), pass = 0, fail = 0;
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function T(name, ok, detail) { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.error('FAIL', name, detail === undefined ? '' : detail); } }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function escape(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function fn(src, name) {
  var at = src.indexOf('function ' + name + '('), brace = src.indexOf('{', at), depth = 1, quote = '', comment = '', i = brace + 1;
  if (at < 0) throw new Error('missing function ' + name);
  for (; i < src.length; i++) {
    var c = src[i], next = src[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error('unterminated function ' + name);
}
function documentStub() {
  var nodes = Object.create(null), doc = {}, dialogCount = 0;
  function node(id) {
    var n = { id: id || '', attrs: {}, style: {}, textContent: '', value: '', _html: '', focus: function () { doc.focused = this.id; },
      setAttribute: function (k, v) { this.attrs[k] = String(v); }, getAttribute: function (k) { return this.attrs[k] || null; },
      appendChild: function (el) { if (el.id) nodes[el.id] = el; },
      insertAdjacentHTML: function (where, html) { this._html += html; register(html); },
      remove: function () {
        delete nodes[this.id];
        if (this.id === 'ptfCustomerSummaryDlg') {
          dialogCount--;
          Object.keys(nodes).forEach(function (k) { if (/^cs(Tab-|History|Title)$|^csTab-|ptfCustomerSummaryContent/.test(k)) delete nodes[k]; });
        }
      }
    };
    Object.defineProperty(n, 'innerHTML', { get: function () { return this._html; }, set: function (html) { this._html = html; register(html); } });
    return n;
  }
  function register(html) {
    var re = /<[^>]+\bid="([^"]+)"[^>]*>/g, m;
    while ((m = re.exec(html))) {
      if (m[1] === 'ptfCustomerSummaryDlg' && !nodes[m[1]]) dialogCount++;
      var el = nodes[m[1]] || (nodes[m[1]] = node(m[1])), attr = /([\w-]+)="([^"]*)"/g, a;
      while ((a = attr.exec(m[0]))) el.attrs[a[1]] = a[2];
    }
    var loading = html.match(/id="ptfCustomerSummaryContent">([\s\S]*?)<\/div>/);
    if (loading && nodes.ptfCustomerSummaryContent) nodes.ptfCustomerSummaryContent._html = loading[1];
  }
  doc.nodes = nodes; doc.getElementById = function (id) { return nodes[id] || null; };
  doc.createElement = function () { return node(''); }; doc.head = node('head'); doc.body = node('body');
  doc.querySelectorAll = function () { return []; }; doc.addEventListener = function () {};
  doc.dialogCount = function () { return dialogCount; };
  ['panels', 'cTb', 'cSrch', 'cVenFlt', 'dCust'].forEach(function (id) { nodes[id] = node(id); });
  return doc;
}
/* Stable as-of clock keeps expiry expectations reproducible on future CI runs. */
function FixtureDate() { return Reflect.construct(Date, arguments.length ? Array.from(arguments) : ['2026-09-30T12:00:00Z']); }
FixtureDate.now = function () { return Date.parse('2026-09-30T12:00:00Z'); };
FixtureDate.parse = Date.parse; FixtureDate.UTC = Date.UTC; FixtureDate.prototype = Date.prototype;
var roleDefs = {
  admin: { panels: '*', sellPrice: true, ledgerScope: 'all' },
  sales: { panels: ['cust', 'rfq', 'off', 'deals'], sellPrice: true, ledgerScope: 'none' },
  buyer: { panels: ['sup'], sellPrice: false, ledgerScope: 'none' },
  accountant: { panels: ['cust', 'inv', 'recv'], sellPrice: false, ledgerScope: 'official' }
};
function harness(data, options) {
  options = options || {};
  var db = clone(data || {}), doc = documentStub(), reads = [], writes = 0, messages = [], events = {}, calls = [];
  var s = {
    console: console, document: doc, Date: FixtureDate, role: options.role || 'admin', user: options.user || 'sales1', denied: [], allowed: [],
    getData: function (k) { reads.push(k); if (s.badKey === k) throw new Error('bad collection'); return db[k] === undefined ? [] : db[k]; },
    setData: function () { writes++; throw new Error('summary must not write'); },
    localStorage: { getItem: function () { return null; }, setItem: function () { writes++; throw new Error('summary must not write localStorage'); }, removeItem: function () { writes++; throw new Error('summary must not write localStorage'); } },
    roleDef: function () { return roleDefs[s.role]; }, curRole: function () { return s.role; }, curSession: function () { return { role: s.role, user: s.user }; },
    ptfCanAccess: function (p) { if (s.denied.indexOf(p) > -1) return false; if (s.allowed.indexOf(p) > -1) return true; var r = roleDefs[s.role]; return r.panels === '*' || r.panels.indexOf(p) > -1; },
    ptfCanSeeLedger: function (kind) { var scope = roleDefs[s.role].ledgerScope; return scope === 'all' || scope === 'official' && kind === 'official'; },
    escP: escape, ptfOnClickArg: function (v) { return escape(String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); },
    ptfJToISO: function (v) { return { '1405/07/08': '2026-09-30', '1405/01/01': '2026-03-21' }[v] || ''; }, ptfISOToJ: function (v) { return { '2026-09-30': '1405/07/08' }[v] || v; },
    ptfToast: function (v) { messages.push(v); }, alert: function (v) { messages.push(v); },
    addEventListener: function (name, callback) { events[name] = callback; }, setInterval: function () { return 0; }, setTimeout: function () { return 0; }, clearInterval: function () {},
    PTF_SALES_DOMAIN_V2: true, ptfTopZIndex: function () { return 3100; }, PTF_RFQ_STATUSES: [{ v: 'st1', t: 'دریافت اولیه' }, { v: 'st2', t: 'بررسی فنی' }, { v: 'stX', t: 'مختومه' }],
    migrateContacts: function () {}, telHref: function (t) { return 'tel:' + t.n; }, fmtTel: function (t) { return t.n; },
    ptfViewRfq: function (id) { calls.push(['rfq', id]); }, offerQuickPreview: function (id) { calls.push(['offer', id]); },
    ptfGoSalesFile: function (id) { calls.push(['deal', id]); }, openProject: function (id) { calls.push(['archive', id]); },
    cfOpen: function (id) { calls.push(['account', id]); }, showEntityCard: function (k, id) { calls.push(['contact', k, id]); }
  };
  s.window = s; s.globalThis = s;
  vm.createContext(s);
  ['crm/finance-helpers.js', 'crm/metrics-shared.js', 'crm/ar-reconcile.js', 'crm/customer-summary.js'].forEach(function (p) { vm.runInContext(read(p), s, { filename: p }); });
  function model(id) { return s.PTF.customerSummary.build(id || 'C-1'); }
  return { s: s, db: db, doc: doc, reads: reads, messages: messages, calls: calls, model: model, events: events, writes: function () { return writes; } };
}
function fixture() {
  return {
    ptf_crm_customers: [
      { _id: 'customer-1', cd: 'C-1', co: 'شرکت نمونه', coEn: 'Sample Co', owner: 'sales1', ind: 'نفت و گاز', people: [{ nm: 'رابط مشتری', role: 'خرید', primary: true, tels: [{ n: '02111111111' }] }] },
      { _id: 'customer-2', cd: 'C-2', co: 'شرکت همسایه', coEn: 'Neighbour Co', owner: 'sales2' },
      { _id: 'customer-3', cd: 'C-3', co: 'مشتری جدید', owner: 'sales1' }
    ],
    ptf_crm_rfqs: [
      { _id: 'rfq-1', cd: 'R-1', custCd: 'C-1', st: 'st1', dt: '2026-03-20', subj: 'شیر کنترلی', crBy: 'sales1' },
      { cd: 'R-2', custCd: 'customer-1', co: 'نام قدیمی', st: 'st2', stxt: 'منتظر دریافت قیمت', dt: '۱۴۰۵/۰۷/۰۸', assignee: { name: 'کارشناس فنی' } },
      { cd: 'R-3', co: 'Sample Co', st: 'stX', dt: '2026-08-01' },
      { cd: 'R-OTHER', custCd: 'C-2', co: 'شرکت نمونه', st: 'st1', dt: '2026-09-01' },
      { cd: 'R-EMPTY', co: '', st: 'st1' }
    ],
    ptf_crm_offers: [
      { _id: 'technical-1', no: 'TO-1', kind: 'TO', buyerCd: 'C-1', inqNo: 'R-1', st: 'won', dateEn: '2026-03-25' },
      { no: 'TO-2', kind: 'TO', inqNo: 'R-2', st: 'sent', dateEn: '2026-08-20' },
      { _id: 'commercial-1', no: 'CO-1', kind: 'CO', buyerCd: 'customer-1', inqNo: 'R-1', st: 'won', rev: 1, currency: 'IRR', items: [{ qty: 1, price: 2100 }], dateEn: '2026-08-25' },
      { _id: 'commercial-1', no: 'CO-1', kind: 'CO', buyerCd: 'C-1', inqNo: 'R-1', st: 'sent', rev: 0, items: [{ qty: 1, price: 2000 }] },
      { no: 'TC-2', kind: 'TC', buyerCd: 'C-1', st: 'sent', items: [{ qty: 1, price: 400 }] },
      { no: 'CO-USD', kind: 'CO', buyerCd: 'C-1', st: 'sent', currency: 'USD', fxRateRef: 1000, items: [{ qty: 2, price: 50 }], dateEn: '2026-09-29' },
      { no: 'CO-EUR', kind: 'CO', buyerCd: 'C-1', st: 'sent', currency: 'EUR', items: [{ qty: 1, price: 500 }], dateEn: '2026-09-30', validUntil: '2026-01-01' },
      { no: 'CO-LOST', kind: 'CO', buyerCo: 'Sample Co', st: 'lost', items: [{ qty: 1, price: 100 }] },
      { no: 'CO-AMENDMENT', kind: 'CO', buyerCd: 'C-1', st: 'won', isAmendment: true, amendmentOf: 'CO-1', items: [{ qty: 1, price: 500 }] },
      { no: 'CO-ORPHAN', kind: 'CO', buyerCd: 'C-1', st: 'won', items: [{ qty: 1, price: 700 }], wonRevisionSnapshot: { total: 700 } },
      { no: 'CO-DRAFT', kind: 'CO', buyerCd: 'C-1', st: 'draft', items: [{ qty: 1, price: 150 }] },
      { no: 'CO-RIAL', kind: 'CO', buyerCd: 'C-1', st: 'won', rialOf: 'CO-1', items: [{ qty: 1, price: 2100 }] },
      { no: 'CO-FX', kind: 'CO', buyerCd: 'C-1', st: 'sent', fxOf: 'CO-1', currency: 'USD', items: [{ qty: 1, price: 2.1 }] },
      { no: 'CO-SUPERSEDED', kind: 'CO', buyerCd: 'C-1', st: 'won', supersededByOfferNo: 'CO-1', items: [{ qty: 1, price: 999999 }] },
      { no: 'CO-VOID', kind: 'CO', buyerCd: 'C-1', st: 'won', status: 'void', items: [{ qty: 1, price: 999999 }] },
      { no: 'CO-OTHER', kind: 'CO', buyerCd: 'C-2', buyerCo: 'شرکت نمونه', st: 'won', items: [{ qty: 1, price: 77777 }] }
    ],
    ptf_crm_deals: [
      { _id: 'case-1', cd: 'D-1', buyerCd: 'C-1', rootOfferId: 'commercial-1', wonOffer: 'CO-1', inqNo: 'R-1', currency: 'IRR', contractAmount: 2600, effectiveContractAmount: 2600, st: 'open', wonAtISO: '2026-08-26',
        linkedOffers: [{ offerNo: 'CO-1', relationType: 'root', amount: 2100 }, { offerNo: 'CO-AMENDMENT', relationType: 'amendment', amount: 500 }],
        awardDocs: [{ kind: 'CO', no: 'CO-1', role: 'commercial', snap: { no: 'CO-1', buyerCd: 'C-1', items: [{ qty: 1, price: 2000 }] } }] },
      { cd: 'D-OLD', buyerCd: 'C-1', wonOffer: 'CO-OLD', contractAmount: 3000, st: 'open' }
    ],
    ptf_crm_projects: [
      { cd: 'ARC-D-OLD', no: 'ARC-R-OLD', dealCd: 'D-OLD', buyerCo: 'Sample Co', wonOffer: 'CO-OLD', state: 'archived', origin: 'salesfile', closeKind: 'settled', t: '2026-04-01',
        awardDocs: [{ kind: 'CO', role: 'commercial', no: 'CO-OLD', snap: { no: 'CO-OLD', buyerCd: 'C-1', currency: 'IRR', items: [{ qty: 1, price: 3000 }] } }], stats: { totalCO: 99999999 } }
    ],
    ptf_crm_invoices: [
      { _id: 'invoice-1', cd: 'INV-1', no: '1100', customerId: 'customer-1', caseId: 'case-1', offerNo: 'CO-1', base: 1000, vat: 100, amount: 1100, status: 'issued', invDate: '2026-08-29', payments: [{ cd: 'PAY-1', amt: 100 }, { cd: 'PAY-MIGRATED', amt: 300, migratedToReceiptId: 'RECEIPT-1' }] },
      { cd: 'INV-UNOFFICIAL', customerId: 'C-1', caseId: 'D-1', offerNo: 'CO-1', base: 1000, amount: 1000, isUnofficial: true, status: 'issued' },
      { cd: 'INV-2', no: 'U-2', customerId: 'C-1', amount: 200, base: 200, isUnofficial: true, payments: [{ amt: 300 }] },
      { cd: 'INV-VOID', customerId: 'C-1', caseId: 'D-1', amount: 90000, status: 'void' },
      { cd: 'INV-OTHER', customerId: 'C-2', amount: 77777, buyerCo: 'شرکت نمونه' }
    ],
    ptf_crm_sales_returns: [{ cd: 'RETURN-1', invoiceCd: 'INV-1', totalAmount: 100 }],
    ptf_crm_case_receipts: [
      { cd: 'RECEIPT-1', caseId: 'D-1', customerId: 'C-1', amountIRR: 300, status: 'posted', receivedAt: '2026-09-01' },
      { cd: 'RECEIPT-FREE', customerId: 'C-1', amountIRR: 100, status: 'posted' },
      { cd: 'RECEIPT-VOID', caseId: 'D-1', amountIRR: 90000, status: 'void' },
      { cd: 'RECEIPT-OTHER', customerId: 'C-2', amountIRR: 77777, status: 'posted' }
    ]
  };
}
module.exports = { fixture: fixture, extractFunction: fn };
if (require.main === module) {
var h = harness(fixture()), m = h.model(), before = JSON.stringify(h.db);
T('customer canonical id and cd alias resolve to the same model', m.ok && h.model('customer-1').customer.id === m.customer.id);
T('three requests, including unique English name legacy record', m.requests.length === 3, m.requests);
T('explicit other-customer id wins over misleading display name', m.requests.every(function (r) { return r.ref !== 'R-OTHER'; }) && m.commercial.every(function (r) { return r.ref !== 'CO-OTHER'; }));
T('blank names never bind a request', m.requests.every(function (r) { return r.ref !== 'R-EMPTY'; }));
T('two technical offers, including link-only RFQ ownership', m.technical.length === 2);
T('legacy TO won is technical approval, not a purchase', m.counts.technical.byStatus.approved.count === 1);
T('latest revision counted once, not revision history', m.commercial.filter(function (r) { return r.ref === 'CO-1'; }).length === 1 && m.commercial.filter(function (r) { return r.ref === 'CO-1'; })[0].rev === 1);
T('TC grouped as financial; originals only in primary count', m.commercial.length === 8 && m.commercialAll.length === 10, m.commercial.length);
T('superseded and void offers do not resurrect as sales', m.commercialAll.every(function (r) { return ['CO-SUPERSEDED', 'CO-VOID'].indexOf(r.ref) < 0; }));
T('live/archive duplicate is one customer case', m.cases.length === 2);
T('archived copy retained without mutating or repairing stored records', m.counts.cases.byStatus.archived.count === 1 && h.db.ptf_crm_deals.length === 2);
T('effective contract + archived snapshot + orphan, once each', m.sale.byCurrency.IRR === 6300 && m.sale.count === 3, m.sale);
T('root and amendment are NOT added again to case amount', m.sale.byCurrency.IRR < 8400);
T('archive stats.totalCO is never treated as sale value', m.sale.byCurrency.IRR < 99999999);
T('unattached winner has an explicit completeness warning', m.orphanWon === 1 && m.warnings.some(function (w) { return w.indexOf('پرونده') > -1; }));
T('pipeline includes drafts but excludes won, lost and conversion companions', m.pipeline.byCurrency.IRR === 550 && m.pipeline.byCurrency.USD === 100 && m.pipeline.byCurrency.EUR === 500, m.pipeline);
T('FX conversion uses stored reference rate only', m.pipeline.irr === 100550 && m.pipeline.fxMissing === 1, m.pipeline);
T('expired proposal remains in open history with non-mutating warning', m.commercial.filter(function (r) { return r.ref === 'CO-EUR'; })[0].expired === true && h.db.ptf_crm_offers[6].st === 'sent');
T('Jalali/Persian request date sorts alongside Gregorian dates', m.requests[0].ref === 'R-2' && m.requests[0].iso === '2026-09-30', m.requests);
T('latest dated document exposed', !!m.lastActivity && m.lastActivity.iso === '2026-09-30');
T('AR filters void/replaced/unofficial superseded invoices', m.invoices.length === 2 && m.finance.gross === 1300, m.finance);
T('returns deducted from billed amounts by canonical AR', m.finance.returned === 100 && m.finance.billed === 1200);
T('cash receipts + nonmigrated legacy cash counted once, including advance', m.finance.collected === 800, m.finance);
T('canonical receivable and free/overpaid credit', m.finance.open === 600 && m.finance.credit === 200, m.finance);
T('read-only means no writes AND unchanged source objects', h.writes() === 0 && JSON.stringify(h.db) === before);

var nameData = fixture();
nameData.ptf_crm_customers.push({ _id: 'same-name', cd: 'C-SAME', co: 'شرکت نمونه', coEn: 'Sample Co', owner: 'sales2' });
var nh = harness(nameData), nm = nh.model();
T('homonymous customers never share name-only requests', nm.requests.length === 2 && !nm.requests.some(function (r) { return r.ref === 'R-3'; }));
T('homonymous customers never share name-only financial proposals', !nm.commercial.some(function (r) { return r.ref === 'CO-LOST'; }));
T('ambiguous ownership has visible warning, not guessed assignment', nm.warnings.some(function (w) { return w.indexOf('مبهم') > -1; }));
nh.db.ptf_crm_customers.push({ _id: 'collision', cd: 'C-1', co: 'شرکت دیگر', owner: 'sales1' });
T('ambiguous cd cannot open another customer summary', !nh.model('C-1').ok);
T('unique canonical id still opens despite ambiguous code', nh.model('customer-1').ok);
var ch = harness({ ptf_crm_customers: fixture().ptf_crm_customers, ptf_crm_rfqs: [{ cd: 'CONFLICT', custCd: 'C-1', customerId: 'customer-2' }, { cd: 'UNKNOWN', custCd: 'C-404', co: 'Sample Co' }], ptf_crm_offers: [{ no: 'UNKNOWN-OFFER', kind: 'CO', buyerCd: 'C-404', buyerCo: 'Sample Co', st: 'won' }] });
T('conflicting explicit ids fail closed', ch.model().requests.length === 0);
T('unknown explicit id never falls back to another customer name', ch.model().commercial.length === 0);
T('empty or missing customer ids fail explicitly', !ch.s.PTF.customerSummary.build('').ok && !ch.model('C-404').ok);

var changed = fixture(); changed.ptf_crm_deals[0].buyerCd = 'C-2';
var conflict = harness(changed).model();
T('case/offer identifier conflict does not become orphan sale', conflict.sale.byCurrency.IRR === 3700 && conflict.cases.length === 1, conflict.sale);
var restored = fixture(); restored.ptf_crm_deals[1].restoredFrom = 'ARC-R-OLD'; restored.ptf_crm_deals[1].contractAmount = 3200;
var restoredModel = harness(restored).model();
T('restored live copy wins over stale archive without double counting', restoredModel.sale.byCurrency.IRR === 6500 && restoredModel.counts.cases.byStatus.active.count === 2);
var amended = fixture(); amended.ptf_crm_deals[0].contractAmount = 3100;
amended.ptf_crm_deals[0].linkedOffers.push({ offerNo: 'CO-NEW-AMENDMENT', relationType: 'amendment', amount: 500 });
amended.ptf_crm_offers.push({ no: 'CO-NEW-AMENDMENT', kind: 'CO', buyerCd: 'C-1', st: 'won', isAmendment: true, amendmentOf: 'CO-1', items: [{ qty: 1, price: 500 }] });
T('post-revision amendment uses current contractAmount, not stale effective mirror', harness(amended).model().sale.byCurrency.IRR === 6800);
var zero = fixture(); zero.ptf_crm_deals[0].contractAmount = 0;
T('explicit zero current contract never falls back to the old effective mirror', harness(zero).model().sale.byCurrency.IRR === 3700);
delete zero.ptf_crm_deals[0].contractAmount; zero.ptf_crm_deals[0].effectiveContractAmount = 0;
T('effective-only legacy zero remains valid without falling back to offer price', harness(zero).model().sale.byCurrency.IRR === 3700);
var fx = fixture(); fx.ptf_crm_deals[0].currency = 'USD';
var fxModel = harness(fx).model();
T('FX order without compatible currency/rate never gets IRR=1 fallback', fxModel.sale.byCurrency.USD === 2600 && fxModel.sale.irr === 3700 && fxModel.sale.fxMissing === 1, fxModel.sale);
fx.ptf_crm_deals[0].fxRateRef = 1000;
T('case-level exchange rate is supported without mutating root offer', harness(fx).model().sale.irr === 2603700);
var unpriced = fixture(); unpriced.ptf_crm_projects[0].awardDocs = []; unpriced.ptf_crm_projects[0].buyerCd = 'C-1';
var up = harness(unpriced).model();
T('missing archived contract amount is unknown, not fabricated from stats', up.sale.unpriced === 1 && up.sale.byCurrency.IRR === 3300);
var renamed = fixture(); renamed.ptf_crm_offers[2].buyerCd = ''; renamed.ptf_crm_offers[2].buyerCo = 'نام پیشین مشتری'; renamed.ptf_crm_offers.splice(3, 1);
T('proven case identifiers survive renamed legacy display names', harness(renamed).model().cases.length === 2);
var moved = fixture(); moved.ptf_crm_offers[2].buyerCd = 'C-2';
var movedHarness = harness(moved);
T('customer correction on latest revision cannot leave an old proposal in previous account', !movedHarness.model().commercial.some(function (r) { return r.ref === 'CO-1'; }) && movedHarness.model('C-2').commercial.some(function (r) { return r.ref === 'CO-1' && r.rev === 1; }));
var malformed = fixture(); malformed.ptf_crm_offers[4].items.unshift(null);
T('legacy null line does not crash overview or change valid line totals', harness(malformed).model().pipeline.byCurrency.IRR === 550);
var jalaliValidity = fixture(); jalaliValidity.ptf_crm_offers[5].validUntil = '۱۴۰۵/۰۷/۰۸';
T('Jalali validity ending today is not compared lexically against Gregorian year', harness(jalaliValidity).model().commercial.find(function (r) { return r.ref === 'CO-USD'; }).expired === false);
jalaliValidity.ptf_crm_offers[5].validUntil = '۱۴۰۵/۰۱/۰۱';
T('past Jalali validity is detected without mutating proposal status', harness(jalaliValidity).model().commercial.find(function (r) { return r.ref === 'CO-USD'; }).expired === true);
var lost = fixture(); lost.ptf_crm_deals[0].closeKind = 'lost'; var lostModel = harness(lost).model();
T('closed-lost order covers its winning offers but never appears as purchased sales', lostModel.sale.byCurrency.IRR === 3700 && lostModel.counts.cases.byStatus.lost.count === 1 && !lostModel.cases.find(function (r) { return r.id === 'case-1'; }).value);
var cancelled = fixture(); cancelled.ptf_crm_deals[0].status = 'cancelled'; var cancelledModel = harness(cancelled).model();
T('cancelled order is labelled explicitly and excluded despite legacy open stage', cancelledModel.sale.byCurrency.IRR === 3700 && cancelledModel.counts.cases.byStatus.cancelled.count === 1 && cancelledModel.cases.find(function (r) { return r.id === 'case-1'; }).label === 'سفارش لغوشده');
var awardOnly = fixture(); delete awardOnly.ptf_crm_projects[0].wonOffer; delete awardOnly.ptf_crm_projects[0].dealCd; delete awardOnly.ptf_crm_projects[0].awardDocs[0].role;
T('financial award snapshot alone proves archive purchase and deduplicates live root', harness(awardOnly).model().sale.byCurrency.IRR === 6300 && harness(awardOnly).model().cases.length === 2);
var snapOnly = fixture(); delete snapOnly.ptf_crm_projects[0].wonOffer; delete snapOnly.ptf_crm_projects[0].dealCd; snapOnly.ptf_crm_projects[0].awardDocs = [];
snapOnly.ptf_crm_projects[0].docSnap = { offers: [{ no: 'CO-OLD', kind: 'CO', st: 'won' }, { no: 'TC-2', kind: 'TC', st: 'sent' }] };
snapOnly.ptf_crm_offers.push({ no: 'CO-OLD', kind: 'CO', buyerCd: 'C-1', st: 'won', currency: 'IRR', items: [{ qty: 1, price: 3100 }] });
var snapModel = harness(snapOnly).model();
T('docSnap-only archive uses unique financial winner, not drafts or aggregate stats', snapModel.sale.byCurrency.IRR === 6400 && snapModel.cases.length === 2 && snapModel.orphanWon === 1);

var sh = harness(fixture(), { role: 'sales' }), sm = sh.model();
T('sales gets own operational overview and sales amount', sm.ok && sm.sale.byCurrency.IRR === 6300 && sm.requests.length === 3);
T('sales ledger privacy: no finance data and no invoice/receipt reads', sm.finance === null && sm.invoices.length === 0 && sh.reads.every(function (k) { return ['ptf_crm_invoices', 'ptf_crm_case_receipts', 'ptf_crm_sales_returns'].indexOf(k) < 0; }));
var unsafeStageCalled = 0;
sh.s.sfStageLabel = function () { unsafeStageCalled++; sh.s.getData('ptf_crm_invoices'); return 'وضعیت دفتر مالی غیرمجاز'; };
sh.model();
T('case status never invokes legacy stage helper which loads unrestricted financial data', unsafeStageCalled === 0 && sh.reads.indexOf('ptf_crm_invoices') < 0);
T('non-senior cannot open another owner customer', !sh.model('C-2').ok);
sh.denied = ['cust']; sh.s.denied = sh.denied;
T('personal cust deny overrides senior/default access', !sh.model().ok);
var ah = harness(fixture(), { role: 'accountant' }), am = ah.model();
T('official-only role sees only allowed ledger amounts', am.ok && am.finance.gross === 1100 && am.invoices.length === 1 && !am.invoices[0].unofficial);
T('official-only role does not inherit unrelated advance/unofficial credit', am.finance.collected === 400 && am.finance.credit === 0, am.finance);
T('sellPrice restriction removes all proposal/contract money DTOs', !am.access.sell && !am.cases.some(function (r) { return !!r.value; }) && Object.keys(am.sale.byCurrency).length === 0);
var bh = harness(fixture(), { role: 'buyer' }); bh.s.allowed = ['cust', 'rfq', 'off', 'deals']; var bm = bh.model();
T('custom panel allow does not bypass sellPrice or ledgerScope', bm.ok && bm.commercial.every(function (r) { return r.value === null; }) && bm.finance === null);
var linked = fixture(); linked.ptf_crm_customers[0].owner = 'sales2';
T('own RFQ-linked customer visibility matches customer-list exception', harness(linked, { role: 'sales' }).model().ok);
var noAr = harness(fixture()); delete noAr.s.PTF.ar; var noArModel = noAr.model();
T('AR unavailable gives explicit warning, not made-up zero balances', noArModel.finance === null && noArModel.warnings.some(function (w) { return w.indexOf('حساب') > -1; }));
var bad = harness(fixture()); bad.s.badKey = 'ptf_crm_offers';
T('collection read failure is visible in overview', bad.model().warnings.some(function (w) { return w.indexOf('خواندن') > -1; }));

/* UI actions and renderer preserve customer/contact/ownership contracts. */
h.s.ptfCustomerSummaryOpen('C-1');
var initialHtml = h.doc.nodes.ptfCustomerSummaryContent.innerHTML;
T('overview displays request/technical/commercial/case and financial summaries', ['cs-stats', 'cs-values', 'cs-finance', 'csHistory', 'csTab-requests', 'csTab-technical', 'csTab-commercial', 'csTab-cases', 'csTab-invoices'].every(function (x) { return initialHtml.indexOf(x) > -1; }));
T('modal has dialog semantics with stable accessible title', h.doc.nodes.csTitle && h.doc.nodes.ptfCustomerSummaryDlg && h.doc.nodes.panels.innerHTML.indexOf('aria-modal="true"') > -1);
T('tabs use roving focus + tabpanel relationship', h.doc.nodes['csTab-requests'].attrs['aria-selected'] === 'true' && h.doc.nodes['csTab-technical'].attrs.tabindex === '-1');
h.s.ptfCustomerSummaryTab('commercial');
T('financial history includes statuses, revisions and currency companions', h.doc.nodes.csHistory.innerHTML.indexOf('CO-FX') > -1 && h.doc.nodes.csHistory.innerHTML.indexOf('CO-USD') > -1 && h.doc.nodes.csHistory.innerHTML.indexOf('رویژن') > -1);
T('missing FX rate is explained instead of raw FX/IRR summation', initialHtml.indexOf('بدون نرخ مرجع') > -1);
var prevented = false;
h.s.ptfCustomerSummaryTabKey({ key: 'ArrowLeft', preventDefault: function () { prevented = true; } }, 'commercial');
T('RTL keyboard tab navigation activates/focuses next tab', prevented && h.doc.focused === 'csTab-cases' && h.doc.nodes['csTab-cases'].attrs['aria-selected'] === 'true');
h.s.ptfCustomerSummaryNavigate('rfq', 'rfq-1'); h.s.ptfCustomerSummaryNavigate('offer', 'commercial-1');
T('read-only previews receive actual module reference, not wrong canonical alias', h.calls[0][1] === 'R-1' && h.calls[1][1] === 'CO-1');
var callCount = h.calls.length; h.s.ptfCustomerSummaryNavigate('rfq', 'R-OTHER');
T('forged document id cannot open another customer record', h.calls.length === callCount && h.messages.length > 0);
h.s.ptfCustomerSummaryNavigate('contact', 'customer-1'); h.s.ptfCustomerSummaryNavigate('account', 'customer-1');
T('contact card retained separately and account link uses canonical id', h.calls[h.calls.length - 2][0] === 'contact' && h.calls[h.calls.length - 2][2] === 'C-1' && h.calls[h.calls.length - 1][1] === 'customer-1');
h.s.ptfCustomerSummaryOpen('C-1');
T('repeated open remains one modal', h.doc.dialogCount() === 1);
h.s.ptfCustomerSummaryOpen('C-3');
T('empty customer shows a real empty state with zero counts', h.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('رکوردی ثبت نشده') > -1 && h.model('C-3').counts.requests.total === 0);
h.s.ptfCustomerSummaryClose();
T('close removes singleton modal', h.doc.dialogCount() === 0);
vm.runInContext(fn(read('crm/modalx.js'), 'restoreModalFocus'), h.s);
var dockRemoved = 0, overlay = { _ptfDockDisk: { remove: function () { dockRemoved++; } } };
h.s.restoreModalFocus(overlay);
T('real modalx lifecycle removes dock entry for a replaced minimized singleton', dockRemoved === 1 && overlay._ptfDockDisk === null);
overlay._ptfDockDisk = { remove: function () { dockRemoved++; } }; h.s.restoreModalFocus(overlay);
T('dock cleanup is safe even when return-focus was already handled', dockRemoved === 2 && overlay._ptfDockDisk === null);
var revoked = harness(fixture()); revoked.s.ptfCustomerSummaryOpen('C-1'); revoked.s.denied.push('cust'); revoked.s.ptfCustomerSummaryTab('commercial');
T('tab interaction reauthorizes customer and clears old visible data after revocation', revoked.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('دسترسی') > -1 && revoked.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('cs-finance') < 0);
var reduced = harness(fixture()); reduced.s.ptfCustomerSummaryOpen('C-1'); reduced.s.role = 'sales'; reduced.s.ptfCustomerSummaryTab('commercial');
T('role change during tab interaction removes old finance cards and forbidden tabs', reduced.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('cs-finance') < 0 && reduced.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('csTab-invoices') < 0);
var deniedLink = harness(fixture()); deniedLink.s.ptfCustomerSummaryOpen('C-1'); deniedLink.s.denied.push('cust'); deniedLink.s.ptfCustomerSummaryNavigate('contact', 'customer-1');
T('navigation after revocation clears old visible information, not just a toast', deniedLink.calls.length === 0 && deniedLink.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('cs-finance') < 0);
var financialOnly = harness({ ptf_crm_customers: fixture().ptf_crm_customers, ptf_crm_invoices: [{ cd: 'I-LEGACY', customerId: 'C-3', amount: 100, status: 'issued' }] });
financialOnly.s.ptfCustomerSummaryOpen('C-3');
T('legacy invoice-only customer is not labelled as having no activity', financialOnly.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('دارای سابقهٔ مالی') > -1);

var pageData = fixture(); pageData.ptf_crm_rfqs = Array.from({ length: 45 }, function (_, i) { return { cd: 'R-PAGE-' + i, custCd: 'C-1', st: 'st1', dt: '2026-09-30' }; });
var ph = harness(pageData); ph.s.ptfCustomerSummaryOpen('C-1'); ph.s.ptfCustomerSummaryTab('requests');
function rowCount() { return (ph.doc.nodes.csHistory.innerHTML.match(/<tr>/g) || []).length - 1; }
T('history renders at most 20 rows initially, aggregate includes all 45', rowCount() === 20 && ph.model().counts.requests.total === 45);
ph.s.ptfCustomerSummaryMore(); T('history pagination appends next page', rowCount() === 40);
ph.s.ptfCustomerSummaryMore(); T('last page complete and no dead More button', rowCount() === 45 && ph.doc.nodes.csHistory.innerHTML.indexOf('onclick="ptfCustomerSummaryMore()"') < 0);
ph.db.ptf_crm_rfqs.push({ cd: 'R-NEW', custCd: 'C-1', st: 'st1' }); ph.s.ptfCustomerSummaryRefresh();
T('refresh reads current data without a separate persisted summary', ph.model().counts.requests.total === 46 && ph.writes() === 0);
ph.db.ptf_crm_rfqs.push({ cd: 'R-SYNC', custCd: 'C-1', st: 'st1' }); ph.events['ptf:sync-ready']();
T('sync completion refreshes visible customer overview', ph.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('۴۷') > -1);
ph.s.denied.push('cust'); ph.s.ptfCustomerSummaryRefresh();
T('refresh after access revocation removes old data', ph.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('R-PAGE') < 0 && ph.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('دسترسی') > -1);

var hh = harness(fixture()), callbacks = [];
hh.s.ptfBIdbHydrated = false; hh.s.ptfBMirrorActive = function () { return true; }; hh.s.ptfBWhenHydrated = function (cb) { callbacks.push(cb); };
hh.s.ptfCustomerSummaryOpen('C-1');
T('cold IDB hydration displays loading instead of false zero records', hh.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('در حال خواندن') > -1 && hh.reads.length === 0);
hh.s.ptfCustomerSummaryOpen('C-2'); callbacks[0]();
T('late hydration callback cannot overwrite newly selected customer', hh.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('در حال خواندن') > -1);
hh.s.ptfBIdbHydrated = true; callbacks[1]();
T('latest hydration callback shows correct customer', hh.doc.nodes.ptfCustomerSummaryContent.innerHTML.indexOf('شرکت همسایه') > -1);
hh.s.ptfBIdbHydrated = false; hh.s.ptfCustomerSummaryOpen('C-1'); hh.s.ptfCustomerSummaryClose(); callbacks[2]();
T('closing while loading cannot resurrect modal', hh.doc.dialogCount() === 0);

var evil = { _id: 'X\" onclick=\"alert(1)', cd: 'BAD', co: '<img src=x onerror=alert(1)>', owner: 'sales1' };
T('customer name is escaped, never HTML-injected', h.s.ptfCustomerSummaryNameHtml(evil).indexOf('<img') < 0 && h.s.ptfCustomerSummaryNameHtml(evil).indexOf('&lt;img') > -1);
T('record id travels in escaped data attribute, not JS string interpolation', h.s.ptfCustomerSummaryActionHtml(evil).indexOf('X&quot; onclick=&quot;') > -1 && h.s.ptfCustomerSummaryActionHtml(evil).indexOf("Open('X") < 0);
var proto = harness({ ptf_crm_customers: [{ _id: '__proto__', cd: 'constructor', co: '__proto__', owner: 'sales1' }], ptf_crm_rfqs: [{ cd: 'P', custCd: 'constructor' }] });
T('prototype-like record keys are safe', proto.model('constructor').ok && proto.model('__proto__').requests.length === 1);
var rh = harness(fixture()), offerSource = read('crm/offers.js'), indexSource = read('crm/index.html');
['primaryPerson', 'entityMatches', 'ptfCustContactChannels', 'ptfCustContactCell', 'renderCustomers2'].forEach(function (name) { vm.runInContext(fn(offerSource, name), rh.s); });
/* v34.39.45: ptfCustSortNewest به کمکی‌های پین‌شدهٔ کد/زمان وابسته شد — آن‌ها هم بارگذاری می‌شوند */
['ptfCustTs', 'ptfCustCdKey', 'ptfCustSortNewest', 'ptfCustDualName'].forEach(function (name) { vm.runInContext(fn(indexSource, name), rh.s); });
rh.s.renderCustomers2(); var rendered = rh.doc.nodes.cTb.innerHTML;
T('real customer list name + explicit summary action open overview', rendered.indexOf('class="cs-name"') > -1 && rendered.indexOf('data-entity-action="summary"') > -1);
T('real list uses canonical customer id for new entry point', rendered.indexOf('data-customer-id="customer-1"') > -1);
T('summary action has explicit SVG for mobile zero-font action styling', /data-entity-action="summary"[^>]*>[\s\S]*?<span data-ix="1" aria-hidden="true"><svg/.test(rendered));
T('real customer list still includes contact and edit actions', rendered.indexOf('02111111111') > -1 && rendered.indexOf('showCustModal') > -1 && rendered.indexOf('showEntityCard') > -1);
T('no broken row concatenation: exactly six columns per customer', (rendered.match(/<td[ >]/g) || []).length === 18, rendered);
T('newest-first list order is preserved', rendered.indexOf('data-cust-cd="C-3"') < rendered.indexOf('data-cust-cd="C-1"'));
rh.doc.nodes.cSrch.value = 'نمونه'; rh.s.renderCustomers2();
T('customer search still works with summary entry points', (rh.doc.nodes.cTb.innerHTML.match(/data-cust-cd=/g) || []).length === 1);
rh.doc.nodes.cSrch.value = ''; vm.runInContext(fn(indexSource, 'renderCustomers'), rh.s); rh.s.renderCustomers();
T('fallback customer renderer has summary and six columns too', rh.doc.nodes.cTb.innerHTML.indexOf('data-entity-action="summary"') > -1 && (rh.doc.nodes.cTb.innerHTML.match(/<td[ >]/g) || []).length === 18);
T('rendering and all overview interactions did not write domain or storage', rh.writes() === 0 && h.writes() === 0 && JSON.stringify(h.db) === before);
var ver = JSON.parse(read('VERSION.json')).crm_version.replace(/^v/, '');
T('module loaded with canonical release query and included in offline shell', indexSource.indexOf('customer-summary.js?v=' + ver) > -1 && read('crm/sw.js').indexOf("'./customer-summary.js' + ASSET_QUERY") > -1);
T('customer scope filter and financial kernel precede new module', indexSource.indexOf('my-customers-filter.js?v=') < indexSource.indexOf('customer-summary.js?v=') && indexSource.indexOf('ar-reconcile.js?v=') < indexSource.indexOf('customer-summary.js?v='));
T('behavioral test and module syntax included in canonical CI gate', read('_tools/uat/run-ci-gate.js').indexOf('tester682-v34.39.42-customer-summary.js') > -1 && read('_tools/uat/run-ci-gate.js').indexOf("'crm/customer-summary.js'") > -1);
/* Release pins change, historical executable filenames must not. Run the real
   bump utility in an isolated temporary repository, never against application data. */
var tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ptf-version-pins-'));
try {
  var uat = path.join(tmp, '_tools/uat'); fs.mkdirSync(uat, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'VERSION.json'), JSON.stringify({ crm_version: 'v1.2.4' }));
  fs.writeFileSync(path.join(uat, 'bump-version-pins.js'), read('_tools/uat/bump-version-pins.js'));
  fs.writeFileSync(path.join(uat, 'tester987.js'), 'var pin = "1.2.3", unit = "tester987-v1.2.3-original.js", e2e = "e2e-site-alert-v1.2.3.js";');
  var bump = require('child_process').spawnSync(process.execPath, [path.join(uat, 'bump-version-pins.js'), '1.2.3'], { encoding: 'utf8' });
  var bumped = fs.readFileSync(path.join(uat, 'tester987.js'), 'utf8');
  T('release bump updates pins while preserving historical unit AND E2E filenames', bump.status === 0 && bumped.indexOf('pin = "1.2.4"') > -1 && bumped.indexOf('tester987-v1.2.3-original.js') > -1 && bumped.indexOf('e2e-site-alert-v1.2.3.js') > -1, bump.stdout + bump.stderr);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
T('customer overview guide documents entry, money distinctions and access limits', ['خلاصهٔ وضعیت مشتری', 'نام مشتری', 'مبلغ سفارش، فاکتور و وصول', 'قیمت فروش و دفتر مالی'].every(function (s) { return read('crm/user-guide.js').indexOf(s) > -1; }) && read('docs/CRM-USER-GUIDE-MAINTENANCE-FA.md').indexOf('tester682') > -1);
console.log('\n=== tester682 customer summary: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
}
