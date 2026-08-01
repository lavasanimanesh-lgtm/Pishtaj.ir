/* tester251 — v31.7.97 (ADV-CV-GAS-STEAM-UX-REFINE-001)
 * Advanced CV improves Gas/Steam UX: phase/unit guide, flow basis, phase-specific report readiness.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

function makeSandbox(grant) {
  var sandbox = {
    __grant: !!grant,
    console: console,
    Math: Math,
    Date: Date,
    Number: Number,
    parseFloat: parseFloat,
    isFinite: isFinite,
    navigator: { clipboard: { writeText: function () {} } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    sessionStorage: { getItem: function () { return JSON.stringify({ grantPayload: { licenseId: 'LIC-UAT', tool: 'control_valve_advanced', type: 'staff_internal', exp: 9999999999 } }); } },
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } }
  };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
  return sandbox;
}

SECTION('Static Gas/Steam UX refinement');
T('نسخه ADV-CV-GAS-STEAM-UX-REFINE-001 ثبت شده است', adv.indexOf('ADV-CV-GAS-STEAM-UX-REFINE-001') > -1);
T('فیلد مبنای دبی adv_flow_basis اضافه شده است', adv.indexOf('adv_flow_basis') > -1 && adv.indexOf('مبنای دبی') > -1);
T('راهنمای واحد و فاز سیال وجود دارد', adv.indexOf('ptfAdvCvPhaseGuideHtml') > -1 && adv.indexOf('Phase and unit guide') > -1 && adv.indexOf('adv-phase-guide') > -1);
T('راهنمای Liquid/Gas/Steam/Two-phase در UI وجود دارد', ['مایع — دبی','گاز — دبی','بخار — دبی','دو فازی'].every(function (x) { return adv.indexOf(x) > -1; }));
T('placeholder مبنای دبی واحدهای Liquid/Gas/Steam را روشن می‌کند', adv.indexOf('Liquid: m³/h | Gas: Nm³/h | Steam: kg/h') > -1);
T('report preview design basis شامل Flow basis و MW/Z/k/Xt است', ['Flow basis','MW','Z','k','Xt'].every(function (x) { return adv.indexOf("'" + x + "'") > -1 || adv.indexOf(x + ':') > -1; }));
T('strict readiness برای gas از MW یا SG پشتیبانی می‌کند', adv.indexOf('MW or SG basis') > -1 && adv.indexOf('!String(d.adv_mw') > -1 && adv.indexOf('!String(d.adv_sg') > -1);
T('نسخه CRM v33.4.9 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime Gas/Steam readiness');
var sb = makeSandbox(true);
var gas = {
  adv_phase: 'گاز (Gas)', adv_project: 'P', adv_rfq: 'R', adv_tag: 'PV-410', adv_service: 'Natural gas', adv_qty: '1', adv_rev: '0',
  adv_min_flow: '500', adv_min_p1: '18', adv_min_p2: '12', adv_min_temp: '25',
  adv_normal_flow: '1200', adv_normal_p1: '20', adv_normal_p2: '10', adv_normal_temp: '25',
  adv_max_flow: '2200', adv_max_p1: '22', adv_max_p2: '8', adv_max_temp: '25',
  adv_fluid: 'Natural gas', adv_flow_basis: 'Nm3/h', adv_sg: '0.62', adv_mw: '', adv_z: '0.92', adv_k: '1.3', adv_xt: '0.72',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 6', adv_valve_type: 'Globe', adv_class: 'Class 600', adv_body: 'WCB', adv_trim: 'Low-noise cage', adv_fl: '0.9', adv_fd: '0.46', adv_char: 'Equal Percentage', adv_rated_cv: '350',
  adv_fail: 'Fail Close', adv_act_type: 'Pneumatic piston', adv_act_supply: '5.5', adv_act_safety: '1.5', adv_shutoff: '22', adv_seat: '65', adv_packing_force: '450', adv_brand: 'Vendor TBD', adv_series: 'Low-noise candidate', adv_leakage: 'Class IV'
};
var gr = sb.ptfAdvCvCalculateAdvancedCases(gas);
var gp = sb.ptfAdvCvBuildLockedReportPayload(gas, gr);
T('Gas با SG و بدون MW محاسبه می‌شود', gr.ok && gr.scope === 'preliminary_gas_multicase');
T('Gas readiness با SG به جای MW آماده است', gp.readiness.inputCompleteForFutureReport === true && gp.readiness.missing.indexOf('MW or SG basis') === -1);
T('Payload فیلد flowBasis را نگه می‌دارد', gp.inputs.fluid.flowBasis === 'Nm3/h');
var guide = sb.ptfAdvCvPhaseGuideHtml('all');
T('Phase guide all هر سه فاز اصلی را نشان می‌دهد', guide.indexOf('Liquid') > -1 && guide.indexOf('Gas') > -1 && guide.indexOf('Steam') > -1);

DONE('tester251-advanced-cv-gas-steam-ux-refine');
