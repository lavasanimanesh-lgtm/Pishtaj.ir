/* tester498 — v34.7.97
 * رفع دائمی دو race مالی:
 *  1) Receipt قطعی در خزانه/AR/حساب مشتری با تفکیک received/allocated/free/overpay
 *  2) reconcile ماهانهٔ حقوق و قالب OPEX فقط پس از snapshot-ready، idempotent و legacy-safe
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

SECTION('Release v34.7.97: پین‌های رسمی');
(function releasePins() {
  var ver = JSON.parse(read('VERSION.json'));
  var idx = read('crm/index.html'), sw = read('crm/sw.js');
  T('VERSION.json = v34.7.97', ver.crm_version === 'v34.7.97', ver.crm_version);
  T('index release و cache-bust روی 34.7.97 است', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.97'") > -1 && idx.indexOf('?v=34.7.96') === -1);
  T('service worker release/cache/assets روی 34.7.97 است', sw.indexOf("RELEASE = 'v34.7.97'") > -1 && sw.indexOf("ASSET_VERSION = '34.7.97'") > -1 && sw.indexOf("CACHE = 'ptf-crm-v34.7.97'") > -1);
  T('manifest.version = 34.7.97', JSON.parse(read('crm/manifest.json')).version === '34.7.97');
  T('clear-cache روی v34.7.97 است', read('crm/clear-cache.html').indexOf("window.VER = 'v34.7.97'") > -1);
  T('shell fallback روی v34.7.97 است', read('crm/shell.js').indexOf("'v34.7.97'") > -1);
  T('sales-domain service روی 34.7.97 است', read('api/sales-domain.php').indexOf("SD_SERVICE_VERSION = '34.7.97'") > -1);
})();

SECTION('AR: یک Receipt، یک قرارداد عددی در خزانه و حساب مشتری');
(function arContract() {
  var db = {
    ptf_crm_customers: [{ cd: 'CU1', co: 'مشتری یک' }],
    ptf_crm_deals: [{ _id: 'CASE-SRV', cd: 'CASE-LEG', buyerCd: 'CU1', st: 'open' }],
    ptf_crm_offers: [],
    ptf_crm_invoices: [{
      _id: 'INV-SRV', cd: 'INV-LEG', no: 'F-1', caseId: 'CASE-LEG', customerId: 'CU1',
      amount: 100, base: 100, vat: 0, invDate: '2026-08-01', status: 'active', payments: []
    }],
    ptf_crm_sales_returns: [{ cd: 'RET-1', invoiceCd: 'INV-LEG', totalAmount: 20, status: 'active' }],
    ptf_crm_case_receipts: [
      { _id: 'R-CASE', caseId: 'CASE-SRV', customerId: 'CU1', amountIRR: 120, status: 'posted', receivedAt: '2026-08-02' },
      /* customer-level legacy: projection صفرِ stale نباید پول آزاد را ناپدید کند. */
      { _id: 'R-FREE', caseId: '', customerId: 'CU1', amountIRR: 30, creditRemainIRR: 0, status: 'posted', receivedAt: '2026-08-03' }
    ]
  };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    Number: Number, parseInt: parseInt, isFinite: isFinite,
    getData: function (k) { return db[k] == null ? [] : db[k]; },
    localStorage: { getItem: function () { return null; }, setItem: function () {} }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('crm/ar-reconcile.js'), ctx, { filename: 'ar-reconcile.js' });
  vm.runInContext(read('crm/treasury.js'), ctx, { filename: 'treasury.js' });

  var inv = ctx.PTF.ar.invoiceState(db.ptf_crm_invoices[0]);
  T('فاکتور: gross=100، return=20 و billed خالص=80', inv.grossBilled === 100 && inv.returned === 20 && inv.billed === 80, JSON.stringify(inv));
  T('تخصیص ناخالص 100 است ولی applied خالص 80 و overpayment برابر 20', inv.allocated === 100 && inv.paid === 100 && inv.applied === 80 && inv.overPaid === 20 && inv.open === 0, JSON.stringify(inv));

  var cs = ctx.PTF.ar.caseState(db.ptf_crm_deals[0]);
  T('aliasهای _id/cd پرونده: Receipt و فاکتور در یک caseState هستند', cs.receipts.length === 1 && cs.invoices.length === 1 && cs.received === 120, JSON.stringify(cs));
  T('پرونده: received=120، allocated=100، free=20 و credit نهایی=40', cs.allocated === 100 && cs.freeReceiptCredit === 20 && cs.overPaid === 20 && cs.credit === 40, JSON.stringify(cs));

  var cp = ctx.PTF.ar.customerPosition('CU1');
  T('مشتری: کل دریافت قطعی 150 بدون وابستگی به creditRemainIRR دیده می‌شود', cp.received === 150, JSON.stringify(cp));
  T('مشتری: allocated=100، free=50، overpay=20 و credit=70 (بدون دوباره‌شماری)', cp.allocated === 100 && cp.freeReceiptCredit === 50 && cp.overPaid === 20 && cp.credit === 70, JSON.stringify(cp));
  T('رسید customer-level بدون case و با projection صفر، تماماً اعتبار آزاد است', ctx.PTF.ar.receiptFreeCreditIRR(db.ptf_crm_case_receipts[1]) === 30);

  var cash = ctx.ptfTreasuryDerivedCash();
  T('خزانه همان 150 دریافت posted را دقیقاً یک‌بار ورودی وجه می‌شمارد', cash.inflow === 150 && cash.outflow === 0, JSON.stringify(cash));
  T('customer-finance summary به customerPosition واگذار شده است', read('crm/customer-finance.js').indexOf("window.PTF.ar.customerPosition(cd, { invoices: invs(cd) })") > -1);
})();

SECTION('AR: Receiptهای legacy بدون شناسه روی کلید تهی collide نمی‌کنند');
(function anonymousLegacyReceipts() {
  var common = { caseId: 'CASE-ANON', customerId: 'CU-ANON', amountIRR: 60, status: 'posted', receivedAt: '2026-08-04' };
  var db = {
    ptf_crm_deals: [{ cd: 'CASE-ANON', buyerCd: 'CU-ANON', st: 'open' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: [],
    ptf_crm_invoices: [{ cd: 'INV-ANON', caseId: 'CASE-ANON', customerId: 'CU-ANON', amount: 100, base: 100, vat: 0, status: 'active', payments: [] }],
    /* دو ردیف عمداً در تمام فیلدهای هویتی یکسان و هر دو فاقد cd/_id هستند. */
    ptf_crm_case_receipts: [Object.assign({}, common), Object.assign({}, common)]
  };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    Number: Number, parseInt: parseInt, isFinite: isFinite,
    getData: function (k) { return db[k] == null ? [] : db[k]; }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('crm/ar-reconcile.js'), ctx, { filename: 'ar-reconcile.js' });
  var snap = ctx.PTF.ar.snapshot(true);
  var buckets = Object.keys(snap.rcpCreditAnon || {}).map(function (k) { return snap.rcpCreditAnon[k]; });
  T('رسیدهای بی‌شناسه هرگز در rcpCredit با کلید تهی overwrite نمی‌شوند', !Object.prototype.hasOwnProperty.call(snap.rcpCredit, '') && buckets.length === 1 && buckets[0].count === 2 && buckets[0].total === 20, JSON.stringify(snap));
  var cs = ctx.PTF.ar.caseState(db.ptf_crm_deals[0]);
  var cp = ctx.PTF.ar.customerPosition('CU-ANON');
  T('collision legacy: جمع ۱۲۰، تخصیص ۱۰۰ و اعتبار آزاد ۲۰ در پرونده و مشتری حفظ می‌شود', cs.received === 120 && cs.allocated === 100 && cs.freeReceiptCredit === 20 && cp.received === 120 && cp.allocated === 100 && cp.freeReceiptCredit === 20, JSON.stringify({ caseState: cs, customer: cp }));
})();

function opexContext(seed) {
  seed = seed || {};
  var store = {}, listeners = {}, seq = 0;
  Object.keys(seed.store || {}).forEach(function (k) { store[k] = JSON.stringify(seed.store[k]); });
  var projectedSettings = seed.settings || { opexTpl: [] };
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    Number: Number, parseInt: parseInt, isFinite: isFinite,
    Intl: {
      NumberFormat: Intl.NumberFormat,
      DateTimeFormat: function () { return { format: function () { return '1405/06'; } }; }
    },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    getData: function (k) {
      if (k === 'ptf_crm_settings') return projectedSettings;
      try { return store[k] ? JSON.parse(store[k]) : []; } catch (e) { return []; }
    },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    genCode: function (p) { seq++; return p + '-RANDOM-' + seq; },
    faDate: function () { return '1405/06/01'; },
    faDateTime: function () { return '1405/06/01 09:00'; },
    curRole: function () { return 'admin'; },
    curSession: function () { return { user: 'admin', name: 'مدیر' }; },
    roleDef: function () { return { finance: true }; },
    ptfFiscalYearLocked: function () { return false; },
    ptfFiscalYearOf: function (m) { return String(m || '').split('/')[0]; },
    audit: function () {}, ptfToast: function () {}, alert: function () {}, confirm: function () { return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    setInterval: function () { return 1; }, clearInterval: function () {},
    setTimeout: function () { return 1; }, clearTimeout: function () {},
    addEventListener: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    dispatchEvent: function (ev) { (listeners[ev.type] || []).slice().forEach(function (fn) { fn(ev); }); },
    CustomEvent: function (type, init) { this.type = type; this.detail = (init || {}).detail; },
    document: {
      getElementById: function () { return null; },
      body: { insertAdjacentHTML: function () {} },
      querySelectorAll: function () { return []; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* ترتیب واقعی index: opex پیش از shareholders؛ readiness بعد از هر دو می‌رسد. */
  vm.runInContext(read('crm/opex.js'), ctx, { filename: 'opex.js' });
  vm.runInContext(read('crm/shareholders.js'), ctx, { filename: 'shareholders.js' });
  ctx.emitReady = function () {
    ctx._ptfSyncSnapshotReady = true;
    ctx.dispatchEvent(new ctx.CustomEvent('ptf:sync-ready', { detail: { ok: true, rev: 10 } }));
  };
  ctx.rows = function (k) { return ctx.getData(k); };
  ctx.setProjectedSettings = function (v) { projectedSettings = v; };
  return ctx;
}

SECTION('OPEX: cold-start و idempotency پس از snapshot-ready');
(function coldStart() {
  var c = opexContext();
  c.setData('ptf_crm_shareholders', [
    { cd: 'SH1', name: 'اول', active: true, duty: true, salary: 100 },
    { cd: 'SH2', name: 'دوم', active: true, duty: true, salary: 200 }
  ]);
  /* settings فقط از projection getData می‌آید؛ localStorage عمداً stale است. */
  c.localStorage.setItem('ptf_crm_settings', '{}');
  c.setProjectedSettings({ opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 300, desc: 'اجاره' }] });
  c.localStorage.setItem('ptf_auto_recurring_last', '1405/06');

  T('cold-start: پیش از readiness هیچ حقوق/OPEX ساخته نمی‌شود', c.rows('ptf_crm_sharetx').length === 0 && c.rows('ptf_crm_opex').length === 0);
  c.emitReady();
  var tx = c.rows('ptf_crm_sharetx'), ox = c.rows('ptf_crm_opex');
  T('پس از snapshot: حقوق همهٔ ۲ سهامدار و ۱ قالب ساخته شد', tx.length === 2 && ox.length === 3, tx.length + '/' + ox.length);
  T('فلگ ماهانهٔ legacy اجرای ناقص را قفل نمی‌کند', ox.some(function (x) { return x.tplId === 'TPL-RENT'; }));
  T('settings از getData خوانده می‌شود، نه localStorage stale', ox.some(function (x) { return x.recurringKey === 'opex-template:TPL-RENT:1405/06'; }));
  T('همهٔ entityها domain key یکتای ماه دارند', (tx.concat(ox)).every(function (x) { return !!x.recurringKey; }));
  T('شناسه‌های ساخته‌شده قطعی‌اند، نه genCode محلی', tx.every(function (x) { return /^SHT-SAL-/.test(x.cd); }) && ox.every(function (x) { return /^(OPX-SAL|OPX-REC)-/.test(x.cd); }));
  T('هویت فنی ردیف OPEX نیز بین دستگاه‌ها قطعی است', ox.every(function (x) { return /^OPXR-(SAL|REC)-/.test(x._opexRowId); }));

  var ids1 = tx.map(function (x) { return x.cd; }).concat(ox.map(function (x) { return x.cd + '@' + x._opexRowId; })).sort().join('|');
  var c2 = opexContext({ settings: { opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 300, desc: 'اجاره' }] } });
  c2.setData('ptf_crm_shareholders', [
    { cd: 'SH1', name: 'اول', active: true, duty: true, salary: 100 },
    { cd: 'SH2', name: 'دوم', active: true, duty: true, salary: 200 }
  ]);
  c2.emitReady();
  var idsRemote = c2.rows('ptf_crm_sharetx').map(function (x) { return x.cd; }).concat(c2.rows('ptf_crm_opex').map(function (x) { return x.cd + '@' + x._opexRowId; })).sort().join('|');
  T('دو دستگاه cold-start برای یک ماه دقیقاً همان هویت‌ها را می‌سازند', idsRemote === ids1, idsRemote);

  c.emitReady();
  var ids2 = c.rows('ptf_crm_sharetx').map(function (x) { return x.cd; }).concat(c.rows('ptf_crm_opex').map(function (x) { return x.cd + '@' + x._opexRowId; })).sort().join('|');
  T('idempotency: اجرای دوم نه رکورد اضافه می‌کند و نه ID را عوض می‌کند', ids2 === ids1 && c.rows('ptf_crm_sharetx').length === 2 && c.rows('ptf_crm_opex').length === 3, ids2);

  var salaryKey = 'salary:SH1:1405/06';
  var oldSalaryOpex = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === salaryKey; })[0];
  c.setData('ptf_crm_opex', c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey !== salaryKey; }));
  c.emitReady();
  var repaired = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === salaryKey; });
  T('ترمیم entity-level: نیمهٔ OPEX حقوقِ حذف‌شده با همان هویت برمی‌گردد، بدون tx دوم', repaired.length === 1 && repaired[0].cd === oldSalaryOpex.cd && repaired[0]._opexRowId === oldSalaryOpex._opexRowId && c.rows('ptf_crm_sharetx').length === 2);

  var oldSalaryTx = c.rows('ptf_crm_sharetx').filter(function (x) { return x.recurringKey === salaryKey; })[0];
  c.setData('ptf_crm_sharetx', c.rows('ptf_crm_sharetx').filter(function (x) { return x.recurringKey !== salaryKey; }));
  c.emitReady();
  var repairedTx = c.rows('ptf_crm_sharetx').filter(function (x) { return x.recurringKey === salaryKey; });
  var relinkedSalaryOpex = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === salaryKey; });
  T('ترمیم entity-level: نیمهٔ transaction حقوق با همان ID برمی‌گردد و OPEX به آن متصل می‌ماند', repairedTx.length === 1 && repairedTx[0].cd === oldSalaryTx.cd && relinkedSalaryOpex.length === 1 && relinkedSalaryOpex[0].shareTx === repairedTx[0].cd && c.rows('ptf_crm_opex').length === 3);

  var tplKey = 'opex-template:TPL-RENT:1405/06';
  var oldTplOpex = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === tplKey; })[0];
  c.setData('ptf_crm_opex', c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey !== tplKey; }));
  c.emitReady();
  var repairedTpl = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === tplKey; });
  T('ترمیم entity-level: قالب حذف‌شده نیز با همان هویت و بدون duplicate برمی‌گردد', repairedTpl.length === 1 && repairedTpl[0].cd === oldTplOpex.cd && repairedTpl[0]._opexRowId === oldTplOpex._opexRowId && c.rows('ptf_crm_opex').length === 3);
})();

SECTION('OPEX: ارتقای دادهٔ legacy بدون حذف یا دوباره‌سازی رکورد صحیح');
(function legacyRepair() {
  var c = opexContext({
    settings: { opexTpl: [{ id: 'TPL-OLD', cat: 'بیمه', amt: 70, desc: 'بیمه' }] },
    store: {
      ptf_crm_shareholders: [{ cd: 'SH-OLD', name: 'قدیمی', active: true, duty: true, salary: 50 }],
      ptf_crm_sharetx: [{ cd: 'SHT-LEGACY', type: 'salary', shCd: 'SH-OLD', amt: 50, month: '1405/06' }],
      ptf_crm_opex: [
        { cd: 'OPX-SAL-LEGACY', shareTx: 'SHT-LEGACY', shareholderSalary: true, cat: 'حقوق و دستمزد', amt: 50, month: '1405/06' },
        { cd: 'OPX-TPL-LEGACY', tplId: 'TPL-OLD', cat: 'بیمه', amt: 70, month: '1405/06' }
      ]
    }
  });
  var before = c.rows('ptf_crm_opex').map(function (x) { return x.cd; }).sort().join('|');
  T('legacy cold-start: قبل از event هیچ migration زودهنگام رخ نمی‌دهد', c.rows('ptf_crm_sharetx')[0].recurringKey == null && c.rows('ptf_crm_opex').every(function (x) { return x.recurringKey == null; }));
  c.emitReady();
  var tx = c.rows('ptf_crm_sharetx'), ox = c.rows('ptf_crm_opex');
  T('رکوردهای legacy با همان cd حفظ می‌شوند', tx.length === 1 && tx[0].cd === 'SHT-LEGACY' && ox.map(function (x) { return x.cd; }).sort().join('|') === before);
  T('حقوق legacy به domain key و لینک OPEX کامل ارتقا می‌یابد', tx[0].recurringKey === 'salary:SH-OLD:1405/06' && ox.some(function (x) { return x.cd === 'OPX-SAL-LEGACY' && x.recurringKey === tx[0].recurringKey && x.shareTx === tx[0].cd; }));
  T('قالب legacy فقط repair می‌شود و duplicate ساخته نمی‌شود', ox.filter(function (x) { return x.tplId === 'TPL-OLD'; }).length === 1 && ox.some(function (x) { return x.cd === 'OPX-TPL-LEGACY' && x.recurringKey === 'opex-template:TPL-OLD:1405/06'; }));
  var report = c.ptfAutoApplyRecurring();
  T('گزارش reconcile کامل و قابل‌ممیزی است', report.complete === true && report.errors.length === 0 && report.missing.length === 0 && report.expected.salaries.length === 1 && report.expected.tpls.length === 1, JSON.stringify(report));

  /* اگر نیمهٔ legacy transaction بعداً مفقود شود، OPEX ارتقایافته باید با همان cd
     حفظ و به transaction قطعیِ جایگزین relink شود، نه اینکه OPEX دوم ساخته شود. */
  c.setData('ptf_crm_sharetx', []);
  c.emitReady();
  var repairedLegacyTx = c.rows('ptf_crm_sharetx');
  var repairedLegacyOpex = c.rows('ptf_crm_opex').filter(function (x) { return x.recurringKey === 'salary:SH-OLD:1405/06'; });
  T('legacy نیمه‌مفقود: OPEX موجود حفظ و به transaction ترمیم‌شده relink می‌شود', repairedLegacyTx.length === 1 && /^SHT-SAL-/.test(repairedLegacyTx[0].cd) && repairedLegacyOpex.length === 1 && repairedLegacyOpex[0].cd === 'OPX-SAL-LEGACY' && repairedLegacyOpex[0].shareTx === repairedLegacyTx[0].cd && c.rows('ptf_crm_opex').length === 2);
})();

SECTION('Sync readiness wiring');
(function syncWiring() {
  var sync = read('crm/sync.js'), opx = read('crm/opex.js');
  T('Sync فلگ snapshot-ready جدا از bootstrapped دارد', sync.indexOf('window._ptfSyncSnapshotReady = false') > -1 && sync.indexOf('announceSnapshotReady') > -1);
  T('خطای pull readiness کاذب تولید نمی‌کند', sync.indexOf("if (!result || result.ok === false) return false") > -1 && sync.indexOf("if (res && res.ok !== false) announceSnapshotReady(res)") > -1);
  T('OPEX به event موفق Sync گوش می‌دهد و timer بوت مستقیماً ثبت مالی نمی‌کند', opx.indexOf("addEventListener('ptf:sync-ready'") > -1 && opx.indexOf('reconcile مالی منتظر snapshot موفق Sync است') > -1);
  T('فلگ باینری قدیمی دیگر مبنای skip نیست', opx.indexOf("localStorage.getItem('ptf_auto_recurring_last')") === -1 && opx.indexOf("localStorage.setItem('ptf_auto_recurring_last'") === -1);
})();

DONE('tester498-v34.7.97-ar-opex-reconcile');
