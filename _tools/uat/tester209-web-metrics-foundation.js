/* tester209 — v31.7.33 (WEB-MEAS-002)
 * Privacy-first conversion metrics foundation for public website.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var metrics = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-metrics.js'), 'utf-8');
var chat = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-chat.js'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) { if (!['crm','_tools','.git'].includes(f)) walk(p, out); }
    else if (/\.html$/.test(f)) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  });
  return out;
}
var publicHtml = walk(ROOT, []);

SECTION('metrics script');
T('فایل ptf-metrics.js وجود دارد و idempotent است', metrics.indexOf('PTF Web Metrics') > -1 && metrics.indexOf('window.__ptfMetricsLoaded') > -1);
T('privacy-aware aggregate server sync دارد و PII ارسال نمی‌کند', metrics.indexOf('metrics_ingest') > -1 && metrics.indexOf('sanitizeForServer') > -1 && metrics.indexOf('no sid') > -1 && metrics.indexOf('sendBeacon') === -1 && metrics.indexOf('XMLHttpRequest') === -1);
T('dataLayer + localStorage queue دارد', metrics.indexOf('window.dataLayer') > -1 && metrics.indexOf('ptf_web_events_v2') > -1);
T('page_view و click و form_submit_attempt را پوشش می‌دهد', metrics.indexOf("track('page_view'") > -1 && metrics.indexOf("document.addEventListener('click'") > -1 && metrics.indexOf("document.addEventListener('submit'") > -1);
T('CTAهای B2B اصلی را classify می‌کند', ['cta_rfq_click','tracking_cta_click','supplier_cta_click','phone_click','whatsapp_click','tools_cta_click'].every(function (x) { return metrics.indexOf(x) > -1; }));
T('پنل QA با ?ptf_metrics=1 دارد', metrics.indexOf('ptf_metrics') > -1 && metrics.indexOf('PTF Web Metrics') > -1 && metrics.indexOf('ptfMetricsSummary') > -1);

SECTION('site-wide loading');
T('ptf-chat به صورت مرکزی ptf-metrics.js را لود می‌کند', chat.indexOf('WEB-MEAS-002') > -1 && chat.indexOf('ptf-metrics.js') > -1);
T('tools که chat ندارد metrics مستقیم دارد', tools.indexOf('../assets/js/ptf-metrics.js') > -1);
var uncovered = publicHtml.filter(function (rel) {
  var s = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  return s.indexOf('ptf-chat.js') === -1 && s.indexOf('ptf-metrics.js') === -1;
});
T('همه صفحات public یا chat loader دارند یا metrics مستقیم', uncovered.length === 0);

DONE('tester209-web-metrics-foundation');
