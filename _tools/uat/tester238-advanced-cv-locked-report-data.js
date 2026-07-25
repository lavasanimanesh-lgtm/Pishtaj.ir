/* tester238 — v31.7.61 (ADV-CV-REPORT-DATA-LOCK-001)
 * Advanced Control Valve prepares structured locked report payload + checksum, with final/PDF/server generation still disabled.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');

function makeSandbox(grant) {
  var boxes = {};
  var sandbox = {
    __grant: !!grant,
    __boxes: boxes,
    console: console,
    Math: Math,
    Date: Date,
    Number: Number,
    parseFloat: parseFloat,
    isFinite: isFinite,
    sessionStorage: { getItem: function () { return JSON.stringify({ grantPayload: { licenseId: 'LIC-UAT', tool: 'control_valve_advanced', type: 'single_report', exp: 9999999999 } }); } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: {
      getElementById: function (id) { if (sandbox.__fields && Object.prototype.hasOwnProperty.call(sandbox.__fields, id)) return { value: sandbox.__fields[id] }; return boxes[id] || null; },
      body: { insertAdjacentHTML: function () {} }
    }
  };
  ['advCvReportData','advCvReportPreview','advCvPrelimResult','advCvCompletenessResult'].forEach(function (id) { boxes[id] = { style: {}, innerHTML: '' }; });
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'tools/advanced-tools-ui.js' });
  return sandbox;
}

var sample = {
  adv_phase: 'مایع (Liquid)', adv_project: 'Olefin Revamp', adv_rfq: 'RFQ-1', adv_tag: 'FV-101', adv_service: 'Cooling Water', adv_qty: '1', adv_rev: 'Rev.0',
  adv_min_flow: '40', adv_min_p1: '9', adv_min_p2: '7', adv_min_temp: '25',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_max_flow: '150', adv_max_p1: '11', adv_max_p2: '5', adv_max_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'DN80', adv_brand: 'Fisher', adv_series: 'GX', adv_leakage: 'Class IV', adv_rated_cv: '200',
  adv_valve_type: 'Globe', adv_class: 'Class 300', adv_body: 'WCB', adv_trim: 'SS316', adv_char: 'Equal Percentage', adv_fd: '0.46', adv_xt: '',
  adv_fail: 'Fail Close', adv_act_type: 'Pneumatic diaphragm / spring return', adv_act_supply: '4.5', adv_act_safety: '1.5', adv_shutoff: '10', adv_seat: '50', adv_packing_force: '200'
};

SECTION('Static locked report data API');
T('نسخه ADV-CV-REPORT-DATA-LOCK-001 ثبت شده است', adv.indexOf('ADV-CV-REPORT-DATA-LOCK-001') > -1);
T('توابع stableJson/checksum/readiness/payload تعریف شده‌اند', ['ptfAdvCvStableJson','ptfAdvCvChecksum32','ptfAdvCvStrictReportReadiness','ptfAdvCvBuildLockedReportPayload','ptfAdvCvShowLockedReportData'].every(function (x) { return adv.indexOf(x) > -1; }));
T('schema و status قفل‌شده payload وجود دارد', adv.indexOf('ADV-CV-REPORT-PAYLOAD-v1') > -1 && adv.indexOf('LOCKED_PREVIEW_PAYLOAD') > -1);
T('قفل draft و الزام workflow نهایی در readiness ذکر شده است', ['finalReportLocked','pdfLocked','serverReportEnabled','crmFinalWorkflowRequired','license quota handling'].every(function (x) { return adv.indexOf(x) > -1; }));
T('UI دکمه آماده‌سازی داده گزارش قفل‌شده دارد', adv.indexOf('آماده‌سازی داده گزارش قفل‌شده') > -1 && adv.indexOf('advCvReportData') > -1);
T('هیچ PDF/download/print/fetch/export اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1 && adv.indexOf('createObjectURL') === -1);

SECTION('Runtime payload verification');
var sb = makeSandbox(true);
var r = sb.ptfAdvCvCalculateLiquidCases(sample);
var p = sb.ptfAdvCvBuildLockedReportPayload(sample, r);
T('payload schema/status/final/pdf درست است', p.schema === 'ADV-CV-REPORT-PAYLOAD-v1' && p.reportMeta.status === 'LOCKED_PREVIEW_PAYLOAD' && p.reportMeta.final === false && p.reportMeta.pdf === false && p.reportMeta.serverSideReport === false);
T('payload project/input/calculation groups دارد', p.project.tag === 'FV-101' && p.inputs.fluid.name === 'Water' && p.calculations.cases.length === 3 && p.calculations.actuator.ok === true);
var noChecksum = JSON.parse(JSON.stringify(p));
var chk = noChecksum.reportMeta.checksum; delete noChecksum.reportMeta.checksum;
T('payload checksum با stableJson قابل بازتولید است', /^[0-9A-F]{8}$/.test(chk) && chk === sb.ptfAdvCvChecksum32(sb.ptfAdvCvStableJson(noChecksum)));
T('readiness با داده کامل برای آینده ready ولی final locked است', p.readiness.inputCompleteForFutureReport === true && p.readiness.finalReportLocked === true && p.readiness.pdfLocked === true);
var incomplete = sb.ptfAdvCvBuildLockedReportPayload(Object.assign({}, sample, { adv_max_flow: '', adv_in_pipe: '???' }), r);
T('readiness ناقص missing و pipeIssues می‌دهد', incomplete.readiness.inputCompleteForFutureReport === false && incomplete.readiness.missing.some(function (x) { return x.indexOf('max flow') > -1; }) && incomplete.readiness.pipeIssues.length > 0);
sb.__fields = sample;
var shown = sb.ptfAdvCvShowLockedReportData();
T('showLockedReportData payload را در memory نشست نگه می‌دارد و UI checksum نشان می‌دهد', shown && sb.ptfAdvCvLastReportPayload && sb.__boxes.advCvReportData.innerHTML.indexOf('checksum') > -1);
T('بدون grant fail-closed/paywall می‌شود', (function () { var locked = makeSandbox(false); locked.ptfAdvCvShowLockedReportData(); return locked.__paywall === true; })());

DONE('tester238-advanced-cv-locked-report-data');
