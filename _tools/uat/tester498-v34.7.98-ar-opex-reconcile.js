/* tester498 — v34.8.23
 * رفع دائمی دو race مالی:
 *  1) Receipt قطعی در خزانه/AR/حساب مشتری با تفکیک received/allocated/free/overpay
 *  2) reconcile ماهانهٔ حقوق و قالب OPEX فقط پس از snapshot-ready، idempotent و legacy-safe
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

SECTION('Release v34.8.23: پین‌های رسمی');
(function releasePins() {
  var ver = JSON.parse(read('VERSION.json'));
  var idx = read('crm/index.html'), sw = read('crm/sw.js');
  T('VERSION.json = v34.8.23', ver.crm_version === 'v34.8.23', ver.crm_version);
  T('index release و cache-bust روی 34.8.23 است', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.8.23'") > -1 && idx.indexOf('?v=34.7.96') === -1);
  T('service worker release/cache/assets روی 34.8.23 است', sw.indexOf("RELEASE = 'v34.8.23'") > -1 && sw.indexOf("ASSET_VERSION = '34.8.23'") > -1 && sw.indexOf("CACHE = 'ptf-crm-v34.8.23'") > -1);
  T('manifest.version = 34.8.23', JSON.parse(read('crm/manifest.json')).version === '34.8.23');
  T('clear-cache روی v34.8.23 است', read('crm/clear-cache.html').indexOf("window.VER = 'v34.8.23'") > -1);
  T('shell fallback روی v34.8.23 است', read('crm/shell.js').indexOf("'v34.8.23'") > -1);
  T('sales-domain service روی 34.8.23 است', read('api/sales-domain.php').indexOf("SD_SERVICE_VERSION = '34.8.23'") > -1);
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

function stableRecurringCode(prefix, key) {
  var a = 5381, b = 52711, s = String(key || '');
  for (var i = 0; i < s.length; i++) { a = ((a * 33) ^ s.charCodeAt(i)) >>> 0; b = ((b * 31) + s.charCodeAt(i)) >>> 0; }
  return prefix + '-' + ('00000000' + a.toString(16)).slice(-8).toUpperCase() + ('00000000' + b.toString(16)).slice(-8).toUpperCase();
}
function salaryOpex(cd, name, amt, month) {
  var key = 'salary:' + cd + ':' + month;
  return {
    cd: stableRecurringCode('OPX-SAL', key), _opexRowId: stableRecurringCode('OPXR-SAL', key),
    cat: 'حقوق و دستمزد', amt: amt, month: month, desc: 'حقوق موظف سهامدار: ' + name,
    shareTx: stableRecurringCode('SHT-SAL', key), shareholderSalary: true,
    recurringKey: key, status: 'active', serverReconciled: true
  };
}

function opexContext(seed) {
  seed = seed || {};
  var store = {}, listeners = {}, timers = [], seq = 0, commands = [];
  Object.keys(seed.store || {}).forEach(function (k) { store[k] = JSON.stringify(seed.store[k]); });
  var projectedSettings = seed.settings || { opexTpl: [] };
  var outcomes = (seed.outcomes || ['acked']).slice();
  var role = seed.role || 'admin';
  var finance = seed.finance !== false;
  function rows(k) { try { return store[k] ? JSON.parse(store[k]) : []; } catch (e) { return []; } }
  function projectServerOpex() {
    if (!Object.prototype.hasOwnProperty.call(seed, 'serverOpex')) return;
    store.ptf_crm_opex = JSON.stringify(typeof seed.serverOpex === 'function' ? seed.serverOpex() : seed.serverOpex);
  }
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    Number: Number, parseInt: parseInt, isFinite: isFinite,
    Intl: {
      NumberFormat: Intl.NumberFormat,
      DateTimeFormat: function (locale) { return { format: function () { return locale === 'en-CA' ? '2026/08/23' : '1405/06'; } }; }
    },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    getData: function (k) {
      if (k === 'ptf_crm_settings') return projectedSettings;
      return rows(k);
    },
    setData: function (k, v) {
      if (k === 'ptf_crm_settings') projectedSettings = v;
      else store[k] = JSON.stringify(v);
    },
    genCode: function (p) { seq++; return p + '-RANDOM-' + seq; },
    faDate: function () { return '1405/06/01'; },
    faDateTime: function () { return '1405/06/01 09:00'; },
    ptfFaMonthNow: function () { return '1405/06'; },
    curRole: function () { return role; },
    curSession: function () { return { user: role, name: role }; },
    roleDef: function () { return { finance: finance }; },
    ptfFiscalYearLocked: function () { return false; },
    ptfFiscalYearOf: function (m) { return String(m || '').split('/')[0]; },
    audit: function () {}, ptfToast: function () {}, alert: function () {}, confirm: function () { return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    setInterval: function () { return 1; }, clearInterval: function () {},
    setTimeout: function (fn) { timers.push(fn); return timers.length; },
    clearTimeout: function () {},
    addEventListener: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    dispatchEvent: function (ev) { (listeners[ev.type] || []).slice().forEach(function (fn) { fn(ev); }); },
    CustomEvent: function (type, init) { this.type = type; this.detail = (init || {}).detail; },
    document: {
      getElementById: function () { return null; },
      body: { insertAdjacentHTML: function () {} },
      querySelectorAll: function () { return []; }
    },
    ptfSalesDomainCommand: function (action, body, options) {
      var outcome = outcomes.length ? outcomes.shift() : 'acked';
      commands.push({ action: action, body: JSON.parse(JSON.stringify(body || {})), options: options, outcome: outcome });
      if (outcome === 'throw') throw new Error('transport_sync_throw');
      return {
        then: function (resolve, reject) {
          if (outcome === 'reject-promise') { reject(new Error('transport_reject')); return; }
          if (outcome === 'acked') {
            projectServerOpex();
            resolve({ state: 'acked', response: { ok: true, result: { month: body.month }, data: { ptf_crm_opex: rows('ptf_crm_opex') } } });
          } else resolve({ state: outcome, response: { ok: outcome === 'rejected' ? false : true } });
        }
      };
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* ترتیب واقعی index: opex پیش از shareholders؛ command فقط بعد از readiness اجرا می‌شود. */
  vm.runInContext(read('crm/opex.js'), ctx, { filename: 'opex.js' });
  vm.runInContext(read('crm/shareholders.js'), ctx, { filename: 'shareholders.js' });
  ctx.emitReady = function () {
    ctx._ptfSyncSnapshotReady = true;
    ctx.dispatchEvent(new ctx.CustomEvent('ptf:sync-ready', { detail: { ok: true, rev: 10 } }));
  };
  ctx.rows = rows;
  ctx.setProjectedSettings = function (v) { projectedSettings = v; };
  ctx.commands = commands;
  ctx.timerCount = function () { return timers.length; };
  ctx.runNextTimer = function () { var fn = timers.shift(); if (fn) fn(); };
  return ctx;
}

SECTION('OPEX: فرمان server-authoritative پس از Sync و projection قابل مشاهده');
(function serverAuthoritativeColdStart() {
  var month = '1405/06';
  var serverRows = [salaryOpex('SH1', 'اول', 100, month), salaryOpex('SH2', 'دوم', 200, month), { cd: 'OPX-TPL-RENT', _opexRowId: 'OPXR-TPL-RENT', cat: 'اجاره‌بها', amt: 300, month: month, tplId: 'TPL-RENT', recurringKey: 'opex-template:TPL-RENT:' + month, status: 'active', serverReconciled: true, serverMaterialized: true }];
  var c = opexContext({
    settings: { opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 300, desc: 'اجاره' }] },
    serverOpex: serverRows
  });
  c.localStorage.setItem('ptf_crm_settings', '{}');
  c.localStorage.setItem('ptf_auto_recurring_last', month);

  T('cold-start: پیش از snapshot نه فرمان و نه هزینه‌ای ساخته می‌شود', c.commands.length === 0 && c.rows('ptf_crm_opex').length === 0);
  c.emitReady();
  var ox = c.rows('ptf_crm_opex');
  T('پس از ACK سرور، ۲ حقوق در OPEX و ۱ قالب مالی قابل مشاهده‌اند', ox.length === 3 && ox.filter(function (x) { return x.shareholderSalary; }).length === 2 && ox.some(function (x) { return x.tplId === 'TPL-RENT'; }), JSON.stringify(ox));
  T('کلاینت دیگر sharetx/حقوق محلی نمی‌سازد', c.rows('ptf_crm_sharetx').length === 0);
  T('فرمان با ماه تهران، idempotency قطعی و autoReplay ارسال می‌شود', c.commands.length === 1 && c.commands[0].action === 'reconcile_recurring_opex' && c.commands[0].body.month === month && c.commands[0].body.idempotencyKey === 'OPEX-REC|' + month + '|admin|2026-08-23' && c.commands[0].options.apiOptions.autoReplay === true, JSON.stringify(c.commands));
  T('قالب از projection تنظیمات خوانده می‌شود، نه localStorage کهنه', ox.some(function (x) { return x.recurringKey === 'opex-template:TPL-RENT:' + month; }));

  var ids1 = ox.map(function (x) { return x.cd + '@' + x._opexRowId; }).sort().join('|');
  c.emitReady();
  var ids2 = c.rows('ptf_crm_opex').map(function (x) { return x.cd + '@' + x._opexRowId; }).sort().join('|');
  T('idempotency همان session: event دوم نه command و نه row تازه می‌سازد', c.commands.length === 1 && ids2 === ids1 && c.rows('ptf_crm_opex').length === 3, ids2);

  var c2 = opexContext({ settings: { opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 300, desc: 'اجاره' }] }, serverOpex: serverRows });
  c2.emitReady();
  var idsRemote = c2.rows('ptf_crm_opex').map(function (x) { return x.cd + '@' + x._opexRowId; }).sort().join('|');
  T('cold-start دستگاه دوم همان شناسه‌های قطعی را می‌بیند', idsRemote === ids1, idsRemote);
})();

SECTION('OPEX: accountant، ACK و بازیابی نتیجه نامطمئن');
(function commandLifecycle() {
  var month = '1405/06';
  var salary = salaryOpex('SH-ACC', 'حسابدار نمی‌بیند', 500, month);
  var acc = opexContext({ role: 'accountant', finance: false, outcomes: ['acked'], serverOpex: [salary], settings: { opexTpl: [{ id: 'SECRET-TPL', amt: 99 }] } });
  acc.emitReady();
  T('accountant بدون دسترسی shareholders، حقوق projection‌شدهٔ OPEX را می‌بیند', acc.rows('ptf_crm_opex').length === 1 && acc.rows('ptf_crm_opex')[0].recurringKey === salary.recurringKey);
  T('accountant هیچ template محرمانه/محلی یا sharetx نمی‌سازد', acc.rows('ptf_crm_opex').every(function (x) { return !x.tplId; }) && acc.rows('ptf_crm_sharetx').length === 0);

  var recovered = opexContext({ outcomes: ['uncertain', 'acked'], serverOpex: [salary] });
  recovered.emitReady();
  T('پاسخ uncertain ثبت محلی نمی‌سازد و retry/alert storm ایجاد نمی‌کند', recovered.rows('ptf_crm_opex').length === 0 && recovered.commands.length === 1 && recovered.timerCount() === 0 && recovered.commands[0].options.silentUncertain === true);
  recovered.runNextTimer();
  T('پس از uncertain همان operation در همان نشست دوباره اجرا نمی‌شود', recovered.commands.length === 1 && recovered.rows('ptf_crm_opex').length === 0, JSON.stringify(recovered.commands));

  var rejected = opexContext({ outcomes: ['rejected'], serverOpex: [salary] });
  rejected.emitReady();
  T('reject قطعی retry خودکار و mutation محلی ندارد', rejected.commands.length === 1 && rejected.timerCount() === 0 && rejected.rows('ptf_crm_opex').length === 0);

  var thrown = opexContext({ outcomes: ['throw', 'acked'], serverOpex: [salary] });
  thrown.emitReady();
  T('throw هم‌زمان transport قفل in-flight را رها و retry می‌چیند', thrown.commands.length === 1 && thrown.timerCount() === 1);
  thrown.runNextTimer();
  T('پس از throw، retry واقعاً اجرا و ACK می‌شود', thrown.commands.length === 2 && thrown.rows('ptf_crm_opex').length === 1);
})();

SECTION('OPEX: همهٔ وضعیت‌های terminal از جمع و helperها حذف می‌شوند');
(function terminalStatuses() {
  var terminal = ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'];
  var rows = [{ cd: 'ACTIVE', cat: 'سایر', amt: 10, month: '1405/06' }];
  terminal.forEach(function (st, i) { rows.push({ cd: 'TERM-' + i, tplId: 'TPL-X', cat: 'سایر', amt: 100, month: '1405/06', status: st }); });
  rows.push({ cd: 'TERM-ST', tplId: 'TPL-X', cat: 'سایر', amt: 100, month: '1405/06', st: 'cancelled' });
  rows.push({ cd: 'TERM-VOID-FLAG', tplId: 'TPL-X', cat: 'سایر', amt: 100, month: '1405/06', voided: true });
  rows.push({ cd: 'TERM-DEL-FLAG', tplId: 'TPL-X', cat: 'سایر', amt: 100, month: '1405/06', deleted: true });
  var c = opexContext({ store: { ptf_crm_opex: rows }, settings: { opexTpl: [{ id: 'TPL-X', cat: 'سایر', amt: 25, desc: 'آزمون' }] } });
  T('ptfOpexSum فقط ردیف active را جمع می‌کند', c.ptfOpexSum('1405/06').total === 10, JSON.stringify(c.ptfOpexSum('1405/06')));
  T('ptfOpexSumFiscal نیز terminalها را حذف می‌کند', c.ptfOpexSumFiscal('1405').total === 10, JSON.stringify(c.ptfOpexSumFiscal('1405')));
  T('انتخاب هزینه برای چک terminalها را برنمی‌گرداند', c.ptfOpexUnlinkedForCheque().length === 1 && c.ptfOpexUnlinkedForCheque()[0].cd === 'ACTIVE');
  T('وجود فقط ردیف terminal مانع pending template نیست', c.ptfOpexPendingTpls('1405/06').some(function (x) { return x.id === 'TPL-X'; }));
  T('وجود فقط ردیف terminal، ماه جاری را از future-month حذف نمی‌کند', c.ptfOpexFutureMonthsForTpl('TPL-X', '1405').some(function (x) { return x.month === '1405/06'; }));
  var beforeSchedule = JSON.stringify(c.rows('ptf_crm_opex'));
  var made = c.ptfOpexCreateMonthsForCheque('CH-1', [{ tplId: 'TPL-X', month: '1405/06' }]);
  T('duplicate check چک فقط Promise فرمان سروری می‌دهد و tombstone را محلی زنده نمی‌کند', made && typeof made.then === 'function' && JSON.stringify(c.rows('ptf_crm_opex')) === beforeSchedule);
})();

SECTION('Server salary contract و Sync readiness wiring');
(function wiring() {
  var sync = read('crm/sync.js'), opx = read('crm/opex.js'), php = read('api/sales-domain.php');
  T('Sync فلگ snapshot-ready جدا از bootstrapped دارد', sync.indexOf('window._ptfSyncSnapshotReady = false') > -1 && sync.indexOf('announceSnapshotReady') > -1);
  T('خطای pull readiness کاذب تولید نمی‌کند', sync.indexOf("if (!result || result.ok === false) return false") > -1 && sync.indexOf("if (res && res.ok !== false) announceSnapshotReady(res)") > -1);
  T('OPEX فقط پس از Sync موفق فرمان server-authoritative را اجرا می‌کند', opx.indexOf("addEventListener('ptf:sync-ready'") > -1 && opx.indexOf("ptfSalesDomainCommand('reconcile_recurring_opex'") > -1);
  T('فلگ ماهانهٔ legacy دیگر مبنای skip نیست', opx.indexOf("localStorage.getItem('ptf_auto_recurring_last')") === -1 && opx.indexOf("localStorage.setItem('ptf_auto_recurring_last'") === -1);
  T('سرور sharetx را commit می‌کند ولی فقط OPEX را به accountant برمی‌گرداند', php.indexOf("$changes=['ptf_crm_sharetx'=>$sharetx,'ptf_crm_opex'=>$opex]") > -1 && php.indexOf("$responseChanges=['ptf_crm_opex'=>[]]") > -1);
  T('reactivation شناسه خالی و markerهای void/deleted را heal می‌کند', php.indexOf('function sd_recurring_activate') > -1 && php.indexOf("'deletedAt'") > -1 && php.indexOf("'explicitDeletion'") > -1);
})();

DONE('tester498-v34.8.23-ar-opex-reconcile');
