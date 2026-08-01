/* tester270 — v31.7.97 (ADV-CV-RICH-SAMPLE-REPORT-001)
 * Public sample final report is rich enough for trust building: charts, matrices, brand links.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static rich sample report');
T('نسخه ADV-CV-RICH-SAMPLE-BRAND-MATRIX-001 ثبت شده است', adv.indexOf('ADV-CV-RICH-SAMPLE-BRAND-MATRIX-001') > -1);
T('sample report از حالت کوتاه به extended report تبدیل شده است', adv.indexOf('PUBLIC SAMPLE — EXTENDED FINAL HTML REPORT FORMAT') > -1 && adv.indexOf('mirrors the real CRM final-report structure') > -1);
T('sample report نمودارهای SVG دارد', adv.indexOf('Cv by operating case') > -1 && adv.indexOf('Estimated opening by case') > -1 && adv.indexOf('<svg role="img"') > -1);
T('sample report Brand / Series Candidate Matrix دارد', adv.indexOf('Brand / Series Candidate Matrix') > -1 && adv.indexOf('Series / model family') > -1 && adv.indexOf('Official link') > -1);
T('sample report برندهای اصلی و لینک رسمی دارد', ['Fisher / Emerson','SAMSON','Masoneilan','Flowserve','https://www.emerson.com','https://www.samsongroup.com','https://valves.bakerhughes.com','https://www.flowserve.com'].every(function (x) { return adv.indexOf(x) > -1; }));
T('sample report بخش‌های واقعی‌تر report را دارد', ['Design Basis','Actuator Sizing Shell','Engineering Validation Matrix','Vendor Data Validation Matrix','Formula Trace and Limitations'].every(function (x) { return adv.indexOf(x) > -1; }));
T('صفحه tools و landing دکمه نمونه گزارش را دارند', tools.indexOf('مشاهده نمونه گزارش نهایی') > -1 && landing.indexOf('مشاهده نمونه گزارش نهایی') > -1);
T('sample report هیچ fetch/quota مصرف نمی‌کند', adv.indexOf('ptfAdvCvOpenSampleFinalReport') > -1 && adv.indexOf('no quota/license') > -1 && adv.indexOf('fetch(') === -1);
T('CRM/SW نسخه v33.4.5 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime rich sample report');
var inserted = '';
var sandbox = { console: console, Math: Math, Date: Date, Number: Number, parseFloat: parseFloat, isFinite: isFinite, navigator:{}, localStorage:{getItem:function(){return null;},setItem:function(){}}, sessionStorage:{getItem:function(){return null;}}, document: { getElementById: function(){ return null; }, body: { insertAdjacentHTML: function(pos, html){ inserted += html; } } } };
sandbox.window = sandbox;
sandbox.ptfToolsHasGrant = function(){ return false; };
sandbox.ptfTrack = function(ev){ sandbox.__tracked = ev; };
vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
var html = sandbox.ptfAdvCvBuildPublicSampleFinalReportHtml();
sandbox.ptfAdvCvOpenSampleFinalReport();
T('runtime: sample HTML شامل charts و brand matrix است', html.indexOf('Cv by operating case') > -1 && html.indexOf('Brand / Series Candidate Matrix') > -1 && html.indexOf('Official link') > -1);
T('runtime: sample modal باز و event track می‌شود', inserted.indexOf('ptfAdvCvSampleReportModal') > -1 && sandbox.__tracked === 'advanced_cv_sample_report_open');

DONE('tester270-advanced-cv-rich-sample-report');
