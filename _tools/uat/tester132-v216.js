/* tester132 — v21.6 US-411 phase 2 commission */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cm = fs.readFileSync(path.join(BASE, 'commission.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('VER v21.6+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=6);})(m[1]);})());
T('SW v21.6+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=6);})(m[1]);})());
T('commission.js in index', /commission\.js\?v=/.test(idx));
T('commission.js in SW', sw.indexOf('commission.js') > -1);

SECTION('ساختاری');
T('ptfCommissionCalc', cm.indexOf('window.ptfCommissionCalc') > -1);
T('ptfCommissionSaveCfg', cm.indexOf('window.ptfCommissionSaveCfg') > -1);
T('ptfCommissionReport', cm.indexOf('window.ptfCommissionReport') > -1);
T('basis collected default', cm.indexOf("basis: c.basis === 'won' ? 'won' : 'collected'") > -1);
T('settings.commission', cm.indexOf('st.commission') > -1);
T('hook buildSettings', cm.indexOf('buildSettings') > -1);
T('owner from customer', cm.indexOf('c.owner || c.crBy') > -1);
T('senior only save', cm.indexOf('فقط مدیران ارشد') > -1);

SECTION('رفتاری — calc collected');
store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};
global.getData = function (k) { try { return JSON.parse(store[k] || (k === 'ptf_crm_settings' ? '{}' : '[]')); } catch (e) { return k === 'ptf_crm_settings' ? {} : []; } };
global.setData = function (k, d) { store[k] = typeof d === 'string' ? d : JSON.stringify(d); };
global.window = global;
global.document = {
  getElementById: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; },
  head: { appendChild: function () {} }, body: { appendChild: function () {} }, addEventListener: function () {}
};
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.escP = function (s) { return String(s == null ? '' : s); };
global.audit = function () {};
global.alert = function () {};
global.ptfToast = function () {};
// seed
setData('ptf_crm_settings', { commission: { basis: 'collected', defaultPct: 2, byUser: { ali: 3 } } });
setData('ptf_crm_users', [
  { username: 'ali', name: 'علی', roleId: 'sales' },
  { username: 'sara', name: 'سارا', roleId: 'sales' }
]);
setData('ptf_crm_customers', [
  { cd: 'C1', co: 'فولاد', owner: 'ali' },
  { cd: 'C2', co: 'سیمان', owner: 'sara' }
]);
setData('ptf_crm_offers', [
  { no: 'CO-1', kind: 'CO', st: 'won', buyerCd: 'C1', buyerCo: 'فولاد', items: [{ qty: 1, price: 1000000 }], dateEn: '2026-03-10', wonAt: '2026-03-10' },
  { no: 'CO-2', kind: 'CO', st: 'won', buyerCd: 'C2', buyerCo: 'سیمان', items: [{ qty: 1, price: 500000 }], dateEn: '2026-03-12', wonAt: '2026-03-12' }
]);
setData('ptf_crm_invoices', [
  { cd: 'I1', no: 'INV-1', offerNo: 'CO-1', amount: 1000000, invDate: '2026-03-15', payments: [
    { amt: 400000, t: '2026-03-20', how: 'حواله' },
    { amt: 600000, t: '2026-04-05', how: 'چک' }
  ]},
  { cd: 'I2', no: 'INV-2', offerNo: 'CO-2', amount: 500000, invDate: '2026-03-18', payments: [
    { amt: 500000, t: '2026-03-25', how: 'نقد' }
  ]}
]);

eval(cm);
T('calc defined', typeof ptfCommissionCalc === 'function');
var r = ptfCommissionCalc({ period: '2026-03', basis: 'collected' });
T('basis collected', r.basis === 'collected');
var ali = r.rows.filter(function (x) { return x.user === 'ali'; })[0];
var sara = r.rows.filter(function (x) { return x.user === 'sara'; })[0];
T('ali base 400k in March (not April pay)', !!ali && ali.base === 400000);
T('sara base 500k', !!sara && sara.base === 500000);
T('ali pct 3', ali && ali.pct === 3);
T('ali commission 12000', ali && ali.commission === 12000);
T('sara pct default 2', sara && sara.pct === 2);
T('sara commission 10000', sara && sara.commission === 10000);

var rWon = ptfCommissionCalc({ period: '2026-03', basis: 'won' });
var aliW = rWon.rows.filter(function (x) { return x.user === 'ali'; })[0];
T('won basis uses CO total 1e6', !!aliW && aliW.base === 1000000);
T('won commission 3%', aliW && aliW.commission === 30000);

var rSelf = ptfCommissionCalc({ period: '2026-03', basis: 'collected', user: 'ali' });
T('filter user only ali', rSelf.rows.length === 1 && rSelf.rows[0].user === 'ali');

// save cfg
global.document.getElementById = function (id) {
  var map = {
    cmBasis: { value: 'won' },
    cmDefPct: { value: '5' },
    cmPct_ali: { value: '4' }
  };
  return map[id] || null;
};
ptfCommissionSaveCfg();
var st = JSON.parse(localStorage.getItem('ptf_crm_settings'));
T('saved basis won', st.commission.basis === 'won');
T('saved default 5', st.commission.defaultPct === 5);
T('saved ali 4', st.commission.byUser.ali === 4);

DONE('tester132-v216');
if (RESULTS.fail) process.exit(1);
