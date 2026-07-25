/* tester222 — v31.7.45 (ADV-CV-INPUT-SCHEMA-001)
 * Advanced Control Valve input schema preview and English report outline.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var spec = fs.readFileSync(path.join(ROOT, 'ADV-CV-INPUT-SCHEMA-v1.md'), 'utf-8');

SECTION('Advanced CV locked input schema preview');
T('بخش schema preview کنترل ولو وجود دارد', tools.indexOf('adv-cv-schema') > -1 && tools.indexOf('Locked Input Schema Preview') > -1);
T('گروه‌های اصلی ورودی دیده می‌شوند', ['Project & Tag','Operating Cases','Fluid Data','Piping Data','Valve Data','Actuator Data','Brand Library','Compliance'].every(function (x) { return tools.indexOf(x) > -1; }));
T('Completeness checklist visible است', tools.indexOf('adv-cv-completeness') > -1 && tools.indexOf('Completeness checklist before full report') > -1);
T('Liquid/Gas/Steam داده‌های کلیدی را پوشش می‌دهد', ['Pv','Pc','viscosity','MW','Z','k'].every(function (x) { return tools.indexOf(x) > -1; }));
T('ابزار همچنان locked preview است و full calculation را باز نمی‌کند', tools.indexOf('locked preview only') > -1 && tools.indexOf('Full calculation and report generation will remain disabled') > -1);

SECTION('English standard report outline');
T('گزارش انگلیسی شامل Report ID و Revision است', tools.indexOf('Cover page + Report ID + Revision') > -1);
T('گزارش شامل calculation tables / formula trace / charts است', ['Min/Normal/Max Calculation Tables','Formula Trace','Flow vs Cv'].every(function (x) { return tools.indexOf(x) > -1; }));
T('گزارش شامل risk و brand matrix است', tools.indexOf('cavitation/flashing') > -1 && tools.indexOf('Brand / Series Candidate Matrix') > -1);

SECTION('Spec document');
T('سند ADV-CV-INPUT-SCHEMA-v1 وجود دارد', spec.indexOf('Advanced Control Valve Input Schema') > -1);
T('Spec شامل operating cases و completeness rule است', spec.indexOf('Minimum flow') > -1 && spec.indexOf('Completeness rule') > -1);
T('Spec تاکید می‌کند گزارش تا تکمیل داده‌های ضروری block شود', spec.indexOf('Block final report') > -1 || spec.indexOf('Block final report'.toLowerCase()) > -1 || spec.indexOf('Block final report') > -1);
T('Spec برندهای اولیه را فهرست می‌کند', ['Fisher','Samson','Masoneilan','Flowserve','Neles'].every(function (x) { return spec.indexOf(x) > -1; }));

DONE('tester222-advanced-cv-input-schema');
