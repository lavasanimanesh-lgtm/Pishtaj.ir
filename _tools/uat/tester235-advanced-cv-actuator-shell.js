/* tester235 — v31.7.58 (ADV-CV-ACTUATOR-SHELL-001)
 * Advanced Control Valve liquid sizing adds preliminary actuator thrust shell.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');

function makeSandbox(grant) {
  var sandbox = {
    __grant: !!grant,
    console: console,
    Math: Math,
    Date: Date,
    Number: Number,
    parseFloat: parseFloat,
    isFinite: isFinite,
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } }
  };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'tools/advanced-tools-ui.js' });
  return sandbox;
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

SECTION('Static actuator shell additions');
T('نسخه ADV-CV-ACTUATOR-SHELL-001 ثبت شده است', adv.indexOf('ADV-CV-ACTUATOR-SHELL-001') > -1);
T('فیلدهای actuator به FIELD_IDS و UI اضافه شده‌اند', ['adv_act_type','adv_act_supply','adv_act_safety','adv_packing_force'].every(function (x) { return adv.indexOf(x) > -1; }));
T('تابع actuatorShell و خروجی Actuator sizing shell وجود دارد', adv.indexOf('function actuatorShell') > -1 && adv.indexOf('Actuator sizing shell') > -1);
T('فرمول‌های seat area / fluid force / required thrust / diaphragm diameter وجود دارند', ['Seat area','Fluid force','Required thrust','Equivalent diaphragm diameter'].every(function (x) { return adv.indexOf(x) > -1; }));
T('هشدار rotary torque و fail action وجود دارد', adv.indexOf('torque sizing') > -1 && adv.indexOf('Fail Close') > -1 && adv.indexOf('Fail Open') > -1);
T('هیچ مسیر PDF/report/download یا fetch اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

SECTION('Runtime actuator numeric verification');
var sample = {
  adv_phase: 'مایع (Liquid)', adv_project: 'P', adv_tag: 'FV-1', adv_service: 'Water',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 4', adv_brand: 'Fisher', adv_rated_cv: '200',
  adv_valve_type: 'Globe', adv_fail: 'Fail Close', adv_shutoff: '10', adv_seat: '50', adv_packing_force: '200', adv_act_safety: '1.5', adv_act_supply: '4.5'
};
var sb = makeSandbox(true);
var r = sb.ptfAdvCvCalculateLiquidCases(sample);
var a = r.actuator;
T('actuator shell با داده کامل ok است', r.ok && a && a.ok === true);
T('seat area برای 50mm حدود 1963.5 mm2 است', near(a.seatAreaMm2, 1963.495, 0.01), 'area=' + a.seatAreaMm2);
T('fluid force برای 10bar و seat 50mm حدود 1963.5N است', near(a.fluidForceN, 1963.495, 0.1), 'force=' + a.fluidForceN);
T('required thrust با packing=200 و safety=1.5 حدود 3245N است', near(a.requiredThrustN, 3245.24, 1), 'thrust=' + a.requiredThrustN);
T('equivalent diaphragm diameter حدود 95.8mm است', near(a.diaphragmDiaMm, 95.85, 0.5), 'dia=' + a.diaphragmDiaMm);
T('formula trace اکچویتور وجود دارد', Array.isArray(a.formulaTrace) && a.formulaTrace.join(' | ').indexOf('Required thrust') > -1);

SECTION('Fallback and incomplete behavior');
var noSeat = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, sample, { adv_seat: '' }));
T('نبود seat محاسبه اصلی را fail نمی‌کند ولی actuator incomplete می‌شود', noSeat.ok === true && noSeat.actuator && noSeat.actuator.ok === false);
var noShutoff = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, sample, { adv_shutoff: '' }));
T('نبود shutoff از max operating ΔP fallback می‌گیرد', noShutoff.ok === true && noShutoff.actuator.ok === true && noShutoff.actuator.shutoffBasis.indexOf('fallback') > -1);
var rotary = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, sample, { adv_valve_type: 'Butterfly' }));
T('برای rotary valve هشدار torque sizing داده می‌شود', rotary.actuator.warnings.join(' | ').indexOf('torque sizing') > -1);

DONE('tester235-advanced-cv-actuator-shell');
