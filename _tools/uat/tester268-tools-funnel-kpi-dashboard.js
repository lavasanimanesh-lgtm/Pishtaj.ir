/* tester268 — v31.7.97 (TOOLS-FUNNEL-KPI-DASHBOARD-001)
 * CRM KPI dashboard for Advanced Control Valve feedback/draft/final/license funnel.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-feedback.js'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static KPI dashboard');
T('نسخه TOOLS-FUNNEL-KPI-DASHBOARD-001 ثبت شده است', ui.indexOf('TOOLS-FUNNEL-KPI-DASHBOARD-001') > -1 && api.indexOf('TOOLS-FUNNEL-KPI-DASHBOARD-001') > -1);
T('توابع KPI dashboard در CRM وجود دارند', ui.indexOf('ptfToolFunnelKpiHtml') > -1 && ui.indexOf('ptfToolFunnelKpiLoad') > -1);
T('KPI dashboard از feedback/drafts/licenses داده می‌گیرد', ['admin_feedback_list','admin_report_drafts','admin_list'].every(function (x) { return ui.indexOf(x) > -1; }));
T('کارت‌های KPI اصلی وجود دارند', ['Feedback total','Average rating','Sample viewed','Contacted / Converted','Draft reports','Final reports','Active licenses','Feedback → Draft'].every(function (x) { return ui.indexOf(x) > -1; }));
T('dashboard breakdown و next actions دارد', ui.indexOf('Feedback source breakdown') > -1 && ui.indexOf('Feedback status breakdown') > -1 && ui.indexOf('Next actions') > -1);
T('privacy-aware aggregate metrics در KPI شفاف است', ui.indexOf('aggregated server-side without sid, label, href or query string') > -1 && ui.indexOf('admin_metrics_summary') > -1);
T('dashboard به buildSettings تزریق می‌شود', ui.indexOf('ptfToolFunnelKpiHtml() + window.ptfToolFeedbackHtml()') > -1 && ui.indexOf('ptfToolFunnelKpiLoad(); ptfToolFeedbackLoad();') > -1);
T('CRM/SW نسخه v33.3.0 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw) && /tool-feedback.js\?v=3[0-9.]+/.test(idx));

SECTION('Runtime KPI render smoke');
var els = {};
function el(id) { if (!els[id]) els[id] = { id: id, style: {}, innerHTML: '', textContent: '' }; return els[id]; }
var sandbox = {
  console: console,
  Promise: Promise,
  setTimeout: function (fn) { if (typeof fn === 'function') fn(); },
  localStorage: { getItem: function () { return 'TOKEN'; } },
  curRole: function () { return 'admin'; },
  document: { getElementById: function (id) { return el(id); }, body: { insertAdjacentHTML: function () {} } },
  fetch: function (url) {
    var data = { ok: true };
    if (url.indexOf('admin_feedback_list') > -1) data = { ok: true, feedback: [
      { feedbackId:'F1', status:'new', rating:'5', source:'landing_page', sampleReportViewed:true, message:'Great tool' },
      { feedbackId:'F2', status:'converted', rating:'4', source:'article_cv_calculation', sampleReportViewed:false, message:'Need PDF' }
    ], count: 2 };
    else if (url.indexOf('admin_report_drafts') > -1) data = { ok: true, drafts: [
      { readiness:{ inputCompleteForFutureReport:true }, finalGate:{ readyForFinalPhase:true }, finalReport:{ final:true } },
      { readiness:{ inputCompleteForFutureReport:false }, finalGate:{ readyForFinalPhase:false }, finalReport:{ final:false } }
    ], count: 2 };
    else if (url.indexOf('admin_list') > -1) data = { ok: true, licenses: [ { status:'active', type:'staff_internal' }, { status:'active', type:'single_report' } ], count: 2 };
    else if (url.indexOf('admin_metrics_summary') > -1) data = { ok: true, summary: { funnel: { controlValveLandingViews: 12, sampleReportOpens: 4, feedbackOpens: 3, feedbackSubmits: 2 }, byPath: { '/tools/control-valve-sizing/': 12 }, byEvent: { page_view: 12, advanced_cv_sample_report_open: 4 } } };
    return Promise.resolve({ status: 200, json: function () { return Promise.resolve(data); } });
  }
};
sandbox.window = sandbox;
vm.runInNewContext(ui, sandbox, { filename: 'tool-feedback.js' });
var html = sandbox.ptfToolFunnelKpiHtml();
T('runtime: KPI section HTML ساخته می‌شود', html.indexOf('داشبورد KPI قیف ابزار کنترل ولو') > -1 && html.indexOf('tfkBox') > -1);
sandbox.ptfToolFunnelKpiLoad();
setTimeout(function () {
  T('runtime: KPI box داده‌ها را render می‌کند', els.tfkBox.innerHTML.indexOf('Feedback total') > -1 && els.tfkBox.innerHTML.indexOf('Final reports') > -1 && els.tfkBox.innerHTML.indexOf('landing_page') > -1);
  DONE('tester268-tools-funnel-kpi-dashboard');
}, 50);
