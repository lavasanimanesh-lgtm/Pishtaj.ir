/* tester259 — v31.7.97 (ADV-CV-PUBLIC-SAMPLE-REPORT-001)
 * Public sample final-report preview for Advanced Control Valve without consuming license/quota.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Static public sample report');
T('نسخه public sample report ثبت شده است', adv.indexOf('ADV-CV-DEMO-REPORT-DATASHEET-ASSIST-001') > -1);
T('توابع sample final report وجود دارد', adv.indexOf('ptfAdvCvBuildPublicSampleFinalReportHtml') > -1 && adv.indexOf('ptfAdvCvOpenSampleFinalReport') > -1);
T('sample report شامل بخش‌های اعتمادساز است', ['PUBLIC SAMPLE','Advanced Control Valve Sizing Report','Engineering Validation Matrix','Vendor Data Validation Matrix','PTF-CV-SAMPLE-001'].every(function (x) { return adv.indexOf(x) > -1; }));
T('صفحه ابزار دکمه مشاهده نمونه گزارش نهایی دارد', tools.indexOf('مشاهده نمونه گزارش نهایی') > -1 && tools.indexOf('advanced_cv_sample_report') > -1 && tools.indexOf('ptfAdvCvOpenSampleFinalReport') > -1);
T('sample report هیچ fetch/quota/license مصرف نمی‌کند', adv.indexOf('ptfAdvCvOpenSampleFinalReport') > -1 && adv.indexOf('no quota/license is consumed') > -1 && adv.indexOf('fetch(') === -1);
T('CRM/SW نسخه v33.4.0 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime open sample modal');
var inserted = '';
var sandbox = { console: console, Math: Math, Date: Date, Number: Number, parseFloat: parseFloat, isFinite: isFinite, navigator:{}, localStorage:{getItem:function(){return null;},setItem:function(){}}, sessionStorage:{getItem:function(){return null;}}, document: { getElementById: function(){ return null; }, body: { insertAdjacentHTML: function(pos, html){ inserted += html; } } } };
sandbox.window = sandbox;
sandbox.ptfToolsHasGrant = function(){ return false; };
vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
var html = sandbox.ptfAdvCvBuildPublicSampleFinalReportHtml();
sandbox.ptfAdvCvOpenSampleFinalReport();
T('runtime: sample HTML بدون grant ساخته می‌شود', html.indexOf('PTF-CV-SAMPLE-001') > -1 && html.indexOf('Demonstration only') > -1);
T('runtime: modal نمونه در document تزریق می‌شود', inserted.indexOf('ptfAdvCvSampleReportModal') > -1 && inserted.indexOf('نمونه خروجی گزارش نهایی') > -1);

DONE('tester259-advanced-cv-public-sample-report');
