/* tester224 — v31.7.47 (ADV-CV-SCHEMA-UI-001)
 * Locked modal UI for Advanced Control Valve input schema.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var spec = fs.readFileSync(path.join(ROOT, 'ADV-CV-INPUT-SCHEMA-v1.md'), 'utf-8');

SECTION('Script loading and entry point');
T('advanced-tools-ui.js در صفحه Tools لود می‌شود', tools.indexOf('advanced-tools-ui.js') > -1);
T('دکمه مشاهده فرم ورودی قفل‌شده وجود دارد', tools.indexOf('مشاهده فرم ورودی قفل‌شده') > -1 && tools.indexOf('ptfAdvCvOpenSchema') > -1);
T('تابع ptfAdvCvOpenSchema تعریف شده است', adv.indexOf('window.ptfAdvCvOpenSchema = function') > -1 && adv.indexOf('ptfAdvCvSchemaModal') > -1);

SECTION('Locked input form groups');
T('فرم قفل‌شده Project/Tag دارد', ['adv_project','adv_tag','adv_service','adv_qty'].every(function (x) { return adv.indexOf(x) > -1; }));
T('فرم Min/Normal/Max cases دارد', ['Minimum case','Normal case','Maximum case','Flow rate','Upstream pressure P1','Downstream pressure P2','Temperature'].every(function (x) { return adv.indexOf(x) > -1; }));
T('فرم Fluid data کامل دارد', ['adv_phase','adv_sg','adv_visc','adv_pv','adv_pc','adv_mw','adv_z'].every(function (x) { return adv.indexOf(x) > -1; }));
T('فرم Piping/Valve/Actuator data دارد', ['adv_in_pipe','adv_out_pipe','adv_valve_type','adv_class','adv_fl','adv_xt','adv_fail','adv_shutoff'].every(function (x) { return adv.indexOf(x) > -1; }));
T('فیلدها disabled هستند و ابزار هنوز اجرا نمی‌شود', adv.indexOf('disabled') > -1 && adv.indexOf('Full calculation, brand selection, charts and English PDF report remain disabled') > -1);

SECTION('Completeness and report outline');
T('Completeness checklist داخل modal وجود دارد', adv.indexOf('Completeness checklist before full report') > -1 && adv.indexOf('Final report blocked until mandatory data is complete') > -1);
T('English paid report outline داخل modal وجود دارد', ['Cover page + Report ID + Revision','Design Basis and Input Summary','Min/Normal/Max Calculation Tables','Flow vs Cv and opening charts'].every(function (x) { return adv.indexOf(x) > -1; }));
T('فعال‌سازی از modal به RFQ با activation=tools می‌رود', adv.indexOf('../rfq/?activation=tools&tool=control_valve_advanced') > -1);
T('Spec schema همچنان موجود و هم‌راستا است', spec.indexOf('ADV-CV-SCHEMA-UI-001') > -1 && spec.indexOf('Create a real locked input form UI') > -1);

DONE('tester224-advanced-cv-schema-ui');
