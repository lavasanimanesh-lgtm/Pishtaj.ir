/* tester237 — v31.7.60 (ADV-CV-REPORT-PREVIEW-001)
 * Advanced Control Valve adds on-screen English report preview only — no PDF/download/final report.
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
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: {
      getElementById: function (id) { return boxes[id] || null; },
      body: { insertAdjacentHTML: function () {} }
    }
  };
  boxes.advCvReportPreview = { style: {}, innerHTML: '' };
  boxes.advCvPrelimResult = { style: {}, innerHTML: '' };
  boxes.advCvCompletenessResult = { style: {}, innerHTML: '' };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'tools/advanced-tools-ui.js' });
  return sandbox;
}

SECTION('Static report preview');
T('نسخه ADV-CV-REPORT-PREVIEW-001 ثبت شده است', adv.indexOf('ADV-CV-REPORT-PREVIEW-001') > -1);
T('توابع report preview تعریف شده‌اند', adv.indexOf('ptfAdvCvBuildEnglishReportPreview') > -1 && adv.indexOf('ptfAdvCvShowReportPreview') > -1);
T('متن preview انگلیسی و not final دارد', adv.indexOf('Advanced Control Valve Sizing Preview') > -1 && adv.indexOf('PREVIEW ONLY — NOT A FINAL REPORT') > -1);
T('سکشن‌های استاندارد انگلیسی report preview وجود دارند', ['Project and Tag Data','Design Basis','Preliminary Liquid Sizing Results','Governing Result','Actuator Sizing Shell','Preliminary Warnings','Risk Review Recommendations','Formula Trace','Assumptions and Limitations'].every(function (x) { return adv.indexOf(x) > -1; }));
T('UI دکمه پیش‌نمایش گزارش انگلیسی دارد', adv.indexOf('پیش‌نمایش گزارش انگلیسی') > -1 && adv.indexOf('advCvReportPreview') > -1);
T('هیچ PDF/download/print/fetch/export اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1 && adv.indexOf('createObjectURL') === -1);

SECTION('Runtime report preview');
var sb = makeSandbox(true);
var sample = {
  adv_phase: 'مایع (Liquid)', adv_project: 'Olefin Revamp', adv_rfq: 'RFQ-1', adv_tag: 'FV-101', adv_service: 'Cooling Water', adv_qty: '1', adv_rev: 'Rev.0',
  adv_min_flow: '40', adv_min_p1: '9', adv_min_p2: '7', adv_min_temp: '25',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_max_flow: '150', adv_max_p1: '11', adv_max_p2: '5', adv_max_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'DN80', adv_brand: 'Fisher', adv_rated_cv: '200',
  adv_valve_type: 'Globe', adv_fail: 'Fail Close', adv_shutoff: '10', adv_seat: '50', adv_packing_force: '200', adv_act_safety: '1.5', adv_act_supply: '4.5'
};
var r = sb.ptfAdvCvCalculateLiquidCases(sample);
var html = sb.ptfAdvCvBuildEnglishReportPreview(sample, r);
T('runtime: report preview HTML تولید می‌شود', html.indexOf('PTF-ADV-CV-PREVIEW') > -1 && html.indexOf('Olefin Revamp') > -1 && html.indexOf('FV-101') > -1);
T('runtime: جدول results و governing در preview هست', html.indexOf('Preliminary Liquid Sizing Results') > -1 && html.indexOf('Governing Result') > -1 && html.indexOf('Maximum') > -1);
T('runtime: actuator/risk/noise sections در preview هست', html.indexOf('Actuator Sizing Shell') > -1 && html.indexOf('Overall noise risk') > -1 && html.indexOf('Overall cavitation risk') > -1);
T('runtime: limitations تصریح می‌کند PDF/final نیست', html.indexOf('No PDF') > -1 && html.indexOf('not a contractual design document') > -1);
sb.ptfAdvCvShowReportPreview = sb.ptfAdvCvShowReportPreview || function(){};
T('بدون grant، preview fail-closed/paywall می‌شود', (function(){ var locked = makeSandbox(false); locked.ptfAdvCvShowReportPreview(); return locked.__paywall === true; })());

DONE('tester237-advanced-cv-report-preview');
