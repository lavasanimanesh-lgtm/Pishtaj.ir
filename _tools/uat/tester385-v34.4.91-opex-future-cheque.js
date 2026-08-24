/* tester385 — future recurring cheque months are server-only and ACK-gated */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

(async function () {
  var store = {}, commands = [], flushOk = true, commandMode = 'acked', dialogConfig = null;
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    Promise: Promise, parseInt: parseInt, isFinite: isFinite, Number: Number, Intl: Intl,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    escP: String,
    faDate: function () { return '1405/05/21'; }, faDateTime: function () { return '1405/05/21 10:00'; },
    audit: function () {}, ptfToast: function () {},
    ptfDialog: function (config) { dialogConfig = config; },
    curRole: function () { return 'admin'; }, curSession: function () { return { user: 'admin', name: 'ادمین' }; },
    roleDef: function () { return { finance: true }; },
    alert: function () {}, confirm: function () { return true; },
    setInterval: function () { return 0; }, clearInterval: function () {},
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } }
  };
  ctx.window = ctx;
  ctx.getData = function (k) {
    try { var raw = ctx.localStorage.getItem(k); return raw ? JSON.parse(raw) : (k === 'ptf_crm_settings' ? {} : []); } catch (e) { return []; }
  };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.ptfSyncFlushNow = function (done) {
    if (flushOk === 'throw') throw new Error('flush_sync_throw');
    done(flushOk);
  };
  ctx.ptfSalesDomainCommand = function (action, body, options) {
    commands.push({ action: action, body: body, options: options, mode: commandMode });
    if (commandMode === 'throw') throw new Error('command_sync_throw');
    if (commandMode === 'non-promise') return { state: 'acked' };
    if (commandMode === 'reject') return Promise.reject(new Error('command_async_reject'));
    return Promise.resolve({ state: 'acked', response: { result: { rowIds: ['OPXR-06', 'OPXR-07'], duplicateIds: [] } } });
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'crm/opex.js'), 'utf8'), ctx, { filename: 'opex.js' });

  ctx.setData('ptf_crm_opex', [{ cd: 'OPX-1', _opexRowId: 'R1', cat: 'اجاره‌بها', amt: 320000000, month: '1405/05', tplId: 'TPL-RENT', recurringKey: 'tpl:TPL-RENT:1405/05' }]);
  ctx.setData('ptf_crm_cheques_issued', [{ cd: 'CHQ-1', _id: 'CHQ-SERVER-1', st: 'issued' }]);
  ctx.localStorage.setItem('ptf_crm_settings', JSON.stringify({ opexTpl: [{ id: 'TPL-RENT', cat: 'اجاره‌بها', amt: 320000000, desc: 'اجاره دفتر' }] }));

  var fut = ctx.window.ptfOpexFutureMonthsForTpl('TPL-RENT', '1405').map(function (x) { return x.month; });
  assert.ok(fut.indexOf('1405/05') < 0 && fut.indexOf('1405/06') > -1 && fut.indexOf('1405/12') > -1, 'future list excludes existing month');
  assert.ok(ctx.window.ptfOpexFutureMonthsForTpl('TPL-RENT').some(function (x) { return x.month === '1406/02' || x.month === '1406/03'; }), 'future list crosses fiscal year');

  var before = JSON.stringify(ctx.getData('ptf_crm_opex'));
  var made = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [
    { tplId: 'TPL-RENT', month: '1405/06' }, { tplId: 'TPL-RENT', month: '1405/07' }
  ]);
  assert.deepStrictEqual(Array.from(made.ids), ['OPXR-06', 'OPXR-07'], 'canonical ids come from ACK');
  assert.strictEqual(JSON.stringify(ctx.getData('ptf_crm_opex')), before, 'browser does not materialize future OPEX locally');
  assert.strictEqual(commands.length, 1, 'one atomic command sent');
  assert.strictEqual(commands[0].action, 'schedule_recurring_opex_cheque');
  assert.strictEqual(commands[0].body.chequeCd, 'CHQ-1');
  assert.strictEqual(commands[0].body.items.length, 2);
  assert.ok(/^SCHED-REC-OPEX-CHEQUE\|CHQ-1\|[0-9a-f]+$/.test(commands[0].body.idempotencyKey), 'stable command namespace');
  assert.strictEqual(commands[0].options.apiOptions.autoReplay, true, 'lost ACK is replayable');

  flushOk = false;
  var rejected = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [{ tplId: 'TPL-RENT', month: '1405/08' }]);
  assert.strictEqual(rejected.state, 'rejected', 'uncommitted cheque snapshot is rejected');
  assert.strictEqual(commands.length, 1, 'no command before successful flush');

  /* Editing one template must not materialize every template or shareholder salary in
     that month. The command reads the just-flushed server settings snapshot. */
  flushOk = true;
  ctx.window.ptfOpexEditTemplate('TPL-RENT', '1405/06');
  assert.ok(dialogConfig && typeof dialogConfig.onOk === 'function', 'template edit dialog opens');
  dialogConfig.onOk({ cat: 'اجاره‌بها', isOfficial: 'no', amt: 330000000, desc: 'اجاره اصلاح‌شده' });
  assert.strictEqual(commands.length, 2, 'template edit sends one scoped reconcile command');
  assert.strictEqual(commands[1].action, 'reconcile_recurring_opex');
  assert.strictEqual(commands[1].body.scopeTemplate, 'TPL-RENT', 'template reconcile is identity-scoped');
  assert.strictEqual(commands[1].body.includeSalaries, false, 'template edit cannot create salary claims as a side effect');
  assert.deepStrictEqual(Array.from(commands[1].body.restoreKeys), [], 'ordinary edit does not resurrect an explicit tombstone');

  /* Every transport failure resolves to a deterministic rejected state: no hanging
     cheque registration, no unhandled rejected command Promise, and no local row. */
  commandMode = 'reject';
  var asyncRejected = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [{ tplId: 'TPL-RENT', month: '1405/09' }]);
  assert.strictEqual(asyncRejected.state, 'rejected', 'rejected command Promise becomes a rejected result');
  commandMode = 'throw';
  var syncRejected = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [{ tplId: 'TPL-RENT', month: '1405/10' }]);
  assert.strictEqual(syncRejected.state, 'rejected', 'synchronous command throw becomes a rejected result');
  commandMode = 'non-promise';
  var shapeRejected = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [{ tplId: 'TPL-RENT', month: '1405/11' }]);
  assert.strictEqual(shapeRejected.state, 'rejected', 'non-Promise command output is rejected fail-closed');
  var callsBeforeFlushThrow = commands.length;
  flushOk = 'throw'; commandMode = 'acked';
  var flushRejected = await ctx.window.ptfOpexCreateMonthsForCheque('CHQ-1', [{ tplId: 'TPL-RENT', month: '1405/12' }]);
  assert.strictEqual(flushRejected.state, 'rejected', 'synchronous flush throw becomes a rejected result');
  assert.strictEqual(commands.length, callsBeforeFlushThrow, 'command is not sent after flush throws');

  /* Salary claim/OPEX reconciliation uses the same rejection-safe flush→command
     lifecycle and never falls back to a browser writer. */
  flushOk = true; commandMode = 'reject';
  vm.runInContext(fs.readFileSync(path.join(root, 'crm/shareholders.js'), 'utf8'), ctx, { filename: 'shareholders.js' });
  var sh = { cd: 'SH-1', name: 'سهامدار', active: true, duty: true, salary: 1000000 };
  ctx.setData('ptf_crm_shareholders', [sh]);
  var salaryRejected = await ctx.window.ptfShareEnsureSalary(sh, '1405/06');
  assert.strictEqual(salaryRejected.state, 'rejected', 'salary command rejection is returned as state');
  assert.deepStrictEqual(ctx.getData('ptf_crm_sharetx'), [], 'salary rejection cannot create a local shareholder claim');

  var src = fs.readFileSync(path.join(root, 'crm/cheque-panel.js'), 'utf8');
  assert.ok(src.indexOf('ptf-ch-opex-future') > -1, 'UI offers future months');
  assert.ok(/ptfOpexCreateMonthsForCheque\(saved2\.cd, opexPick\.future\)[\s\S]{0,120}\.then/.test(src), 'UI waits for server ACK');
  assert.ok(src.indexOf('made && made.ok ? made.ids : []') > -1, 'UI only accepts acknowledged result');
  console.log('PASS tester385 server-only opex-future-cheque');
})().catch(function (e) { console.error(e && e.stack || e); process.exit(1); });
