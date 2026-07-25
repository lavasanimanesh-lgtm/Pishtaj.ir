/* tester269 — v31.7.97 (PRIVACY-METRICS-SERVER-SYNC-001)
 * Privacy-aware aggregate metrics sync for public funnel KPI without PII.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var metrics = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-metrics.js'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-feedback.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server metrics aggregate API');
T('api/tools.php اکشن metrics_ingest دارد', api.indexOf("$action === 'metrics_ingest'") > -1 && api.indexOf('metrics_store_write_failed') > -1);
T('api/tools.php اکشن admin_metrics_summary دارد و admin protected است', api.indexOf("$action === 'admin_metrics_summary'") > -1 && /admin_metrics_summary[\s\S]{0,140}tools_admin_require\(\)/.test(api));
T('metrics runtime در crm/data/tool_metrics.json ذخیره می‌شود', api.indexOf('tools_metrics_file') > -1 && api.indexOf('tool_metrics.json') > -1 && api.indexOf('tools_save_metrics') > -1);
T('server فقط aggregate بدون sid/label/query نگه می‌دارد', api.indexOf('aggregate_only_no_sid_no_label_no_query') > -1 && api.indexOf('eventPath') > -1 && api.indexOf('tools_metric_path') > -1);
T('metrics summary funnel دارد', ['controlValveLandingViews','sampleReportOpens','feedbackOpens','feedbackSubmits','rfqClicks'].every(function (x) { return api.indexOf(x) > -1; }));
T('tools API status v31.9 است', api.indexOf("'version' => 'v31.9'") > -1);

SECTION('Client privacy-aware sync');
T('ptf-metrics نسخه privacy sync دارد', metrics.indexOf('PRIVACY-METRICS-SERVER-SYNC-001') > -1 && metrics.indexOf('metrics_ingest') > -1);
T('client sanitizeForServer فقط event/path/t/utm_source ارسال می‌کند', metrics.indexOf('function sanitizeForServer') > -1 && ['event:','path:','t:','utm_source:'].every(function (x) { return metrics.indexOf(x) > -1; }));
T('client sid/title/label/href را در payload sync قرار نمی‌دهد', metrics.indexOf('sid: sessionId()') > -1 && metrics.indexOf('label:') > -1 && metrics.indexOf('href:') > -1 && metrics.indexOf('JSON.stringify({ events: batch') > -1);
T('client sendBeacon/XMLHttpRequest استفاده نمی‌کند', metrics.indexOf('sendBeacon') === -1 && metrics.indexOf('XMLHttpRequest') === -1);
T('CRM KPI dashboard admin_metrics_summary را می‌خواند', ui.indexOf('admin_metrics_summary') > -1 && ui.indexOf('Landing views') > -1 && ui.indexOf('Metrics path breakdown') > -1);
T('CRM/SW نسخه v31.9 است', idx.indexOf("window.VER = 'v31.9'") > -1 && sw.indexOf('ptf-crm-v31.9') > -1);

SECTION('Runtime sanitized payload smoke');
var sent = [];
function LS(){ this.s={}; }
LS.prototype.getItem=function(k){ return this.s[k] || null; };
LS.prototype.setItem=function(k,v){ this.s[k]=String(v); };
LS.prototype.removeItem=function(k){ delete this.s[k]; };
var sandbox = {
  console: console, Date: Date, Math: Math, setTimeout: function(fn){ if(typeof fn==='function') fn(); return 1; }, clearTimeout: function(){},
  localStorage: new LS(), indexedDB: null,
  location: { href:'https://pishtaj.ir/tools/control-valve-sizing/?secret=abc', origin:'https://pishtaj.ir', pathname:'/tools/control-valve-sizing/', search:'?utm_source=google&utm_term=private' },
  URL: URL, URLSearchParams: URLSearchParams,
  CustomEvent: function(name,o){ return { type:name, detail:o&&o.detail }; },
  navigator: {},
  fetch: function(url, opt){ sent.push({ url:url, body: opt && opt.body }); return Promise.resolve({ json:function(){ return Promise.resolve({ ok:true }); } }); },
  document: { title:'Secret User Title', referrer:'https://google.com?q=private', readyState:'complete', addEventListener:function(){}, createElement:function(){ return { style:{}, appendChild:function(){}, remove:function(){}, set innerHTML(v){this._html=v;}, get innerHTML(){return this._html||'';} }; }, body:{ appendChild:function(){} }, getElementById:function(){ return { onclick:null }; } },
  dispatchEvent: function(){}
};
sandbox.window = sandbox;
vm.runInNewContext(metrics, sandbox, { filename:'ptf-metrics.js' });
sandbox.ptfTrack('advanced_cv_sample_report_open', { label:'User Name', href:'/rfq/?phone=secret', sid:'bad' });
sandbox.ptfMetricsFlush();
var payload = JSON.parse((sent[0] || {}).body || '{"events":[]}');
var first = (payload.events || [])[0] || {};
T('runtime: sync payload ساخته و query حذف می‌شود', sent.length > 0 && first.path === '/tools/control-valve-sizing/');
T('runtime: sync payload بدون sid/title/label/href است', first.sid == null && first.title == null && first.label == null && first.href == null && JSON.stringify(payload).indexOf('User Name') === -1 && JSON.stringify(payload).indexOf('secret') === -1);

DONE('tester269-privacy-metrics-server-sync');
