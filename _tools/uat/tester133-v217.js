/* tester133 — v21.7 US-452 recent suppliers for same RFQ */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var code = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.7');
T('VER v21.7+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=7);})(m[1]);})());
T('SW v21.7+', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=7);})(m[1]);})());
T('cache rfqsmart 21.7+', /rfqsmart\.js\?v=/.test(idx) && (function(){var m=idx.match(/rfqsmart\.js\?v=([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=7);})(m[1]);})());

SECTION('ساختاری US-452');
T('ptfRfqsRecentSuppliers', code.indexOf('window.ptfRfqsRecentSuppliers') > -1);
T('rfqsSelectRecent', code.indexOf('window.rfqsSelectRecent') > -1);
T('بخش UI اخیر', code.indexOf('تامین‌کنندگان اخیر همین درخواست') > -1);
T('_st._recent', code.indexOf('_st._recent') > -1);
T('preselect recent', code.indexOf("recent.forEach") > -1 || code.indexOf('_st._sel[key] = true') > -1);
T('srcRfq usage', code.indexOf('srcRfq') > -1);
T('exclude current no', code.indexOf('excludeNo') > -1);

SECTION('رفتاری — recent aggregation');
store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};
global.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
global.setData = function (k, d) { store[k] = JSON.stringify(d); };
global.window = global;
global.document = { getElementById: function(){return null;}, querySelectorAll:function(){return [];}, createElement:function(){return {style:{},appendChild:function(){}};}, head:{appendChild:function(){}}, body:{appendChild:function(){}}, addEventListener:function(){} };
global.escP = function(s){return String(s==null?'':s);};
global.alert = function(){};
global.confirm = function(){return true;};
global.curSession = function(){return {name:'T',user:'t'};};
global.faDateTime = function(){return '1405/01/01';};
global.dedupNorm = function(s){return String(s||'').toLowerCase().replace(/\s+/g,'');};
global.ptfInqAliases = function(v){
  var out=[v];
  getData('ptf_crm_rfqs').forEach(function(r){
    if(r.cd===v||r.inqNo===v){ if(r.cd&&out.indexOf(r.cd)<0)out.push(r.cd); if(r.inqNo&&out.indexOf(r.inqNo)<0)out.push(r.inqNo); }
  });
  return out;
};

setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', inqNo: 'INQ-9', co: 'Acme' }]);
setData('ptf_crm_suppliers', [
  { cd: 'S1', co: 'تامین‌الف', ph: '09121111111', email: 'a@x.com' },
  { cd: 'S2', co: 'تامین‌ب', ph: '09122222222' }
]);
setData('ptf_crm_rfqsmart', [
  { no: 'PTF-RFQS-1', srcRfq: 'RFQ-1', t: '2026-01-01', targets: [
    { cd: 'S1', co: 'تامین‌الف', st: 'replied', ph: '09121111111' },
    { cd: 'S2', co: 'تامین‌ب', st: 'pending' }
  ]},
  { no: 'PTF-RFQS-2', srcRfq: 'INQ-9', t: '2026-02-01', targets: [
    { cd: 'S1', co: 'تامین‌الف', st: 'replied' }
  ]},
  { no: 'PTF-RFQS-CUR', srcRfq: 'RFQ-1', t: '2026-03-01', targets: [{ cd: 'S9', co: 'ignore-self' }] }
]);
setData('ptf_crm_buycmp', [
  { inqNo: 'RFQ-1', t: '2026-02-15', purchases: [{ sup: 'تامین‌الف', supCd: 'S1', t: '2026-02-15' }] }
]);

// extract and eval only recent helper + dependencies by eval full IIFE carefully
// Load by evaluating the IIFE - needs _st and many funcs - extract function body instead
var m = code.match(/window\.ptfRfqsRecentSuppliers = function \(srcRfq, excludeNo\) \{[\s\S]*?\n  \};/);
T('extract recent fn', !!m);
if (m) {
  eval(m[0].replace('window.ptfRfqsRecentSuppliers', 'global.ptfRfqsRecentSuppliers'));
  var rec = ptfRfqsRecentSuppliers('RFQ-1', 'PTF-RFQS-CUR');
  T('returns array', Array.isArray(rec));
  T('includes S1 with multi hits', rec.some(function(r){return r.cd==='S1' && r.times>=2;}));
  T('includes S2', rec.some(function(r){return r.cd==='S2';}));
  T('excludes current inquiry only targets if only in excluded', !rec.some(function(r){return r.cd==='S9';}));
  var recAlias = ptfRfqsRecentSuppliers('INQ-9', null);
  T('alias INQ-9 finds same family', recAlias.some(function(r){return r.cd==='S1';}));
  T('empty src empty list', ptfRfqsRecentSuppliers('', null).length===0);
  T('sorted by times desc', rec.length<2 || rec[0].times>=rec[1].times);
}

// top5 preselect still present
T('top5 slice still', code.indexOf('slice(0, 5)') > -1);
T('قابل تغییر retained', code.indexOf('قابل تغییر') > -1);

DONE('tester133-v217');
if (RESULTS.fail) process.exit(1);
