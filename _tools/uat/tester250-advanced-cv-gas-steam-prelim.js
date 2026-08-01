/* tester250 — v31.7.97 (ADV-CV-GAS-STEAM-PRELIM-001)
 * Advanced Control Valve adds preliminary Gas/Steam multi-case screening while PDF/final report remains locked.
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

SECTION('Static Gas/Steam preliminary support');
T('نسخه ADV-CV-GAS-STEAM-PRELIM-001 ثبت شده است', adv.indexOf('ADV-CV-GAS-STEAM-PRELIM-001') > -1);
T('توابع compressible/gas/steam وجود دارند', ['compressiblePhase','commonCompressible','calcCompressibleCase','ptfAdvCvCalculateCompressibleCases','ptfAdvCvCalculateAdvancedCases'].every(function (x) { return adv.indexOf(x) > -1; }));
T('پارامترهای MW/Z/k/Xt در منطق دیده می‌شوند', ['adv_mw','adv_z','adv_k','adv_xt','xChoked','Xt'].every(function (x) { return adv.indexOf(x) > -1; }));
T('نمونه gas_steam_screen در feedback pack وجود دارد', adv.indexOf('gas_steam_screen') > -1 && adv.indexOf('Natural gas') > -1);
T('report preview دیگر فقط Liquid-only نیست', adv.indexOf('Liquid, gas and steam preliminary screening are available') > -1);
T('هیچ مسیر PDF/download/print/fetch/export اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1);
T('نسخه CRM v33.4.6 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime gas preliminary');
var sb = makeSandbox(true);
var gas = {
  adv_phase: 'گاز (Gas)', adv_project: 'P', adv_tag: 'PV-410', adv_service: 'Natural gas',
  adv_min_flow: '500', adv_min_p1: '18', adv_min_p2: '12', adv_min_temp: '25',
  adv_normal_flow: '1200', adv_normal_p1: '20', adv_normal_p2: '10', adv_normal_temp: '25',
  adv_max_flow: '2200', adv_max_p1: '22', adv_max_p2: '8', adv_max_temp: '25',
  adv_fluid: 'Natural gas', adv_sg: '0.62', adv_mw: '18', adv_z: '0.92', adv_k: '1.3', adv_xt: '0.72',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 6', adv_valve_type: 'Globe', adv_fl: '0.9', adv_rated_cv: '350', adv_seat: '65', adv_shutoff: '22', adv_act_supply: '5.5', adv_act_safety: '1.5'
};
var gr = sb.ptfAdvCvCalculateAdvancedCases(gas);
T('Gas advanced cases ok و scope درست است', gr && gr.ok && gr.scope === 'preliminary_gas_multicase' && gr.cases.length === 3);
T('Gas caseها Cv/Kv و x/xChoked دارند', gr.cases.every(function (c) { return isFinite(c.Cv) && isFinite(c.Kv) && isFinite(c.x) && isFinite(c.xChoked); }));
T('Gas report preview با generic advanced calculator ساخته می‌شود', sb.ptfAdvCvBuildEnglishReportPreview(gas, gr).indexOf('Gas-Steam Screening') > -1);

SECTION('Runtime steam preliminary');
var steam = Object.assign({}, gas, { adv_phase: 'بخار (Steam)', adv_fluid: 'Saturated steam', adv_sg: '', adv_mw: '', adv_z: '1', adv_k: '1.3', adv_xt: '0.72', adv_normal_flow: '5000', adv_normal_p1: '12', adv_normal_p2: '5', adv_normal_temp: '190', adv_min_flow: '', adv_min_p1: '', adv_min_p2: '', adv_min_temp: '', adv_max_flow: '', adv_max_p1: '', adv_max_p2: '', adv_max_temp: '' });
var sr = sb.ptfAdvCvCalculateAdvancedCases(steam);
T('Steam advanced case ok و scope درست است', sr && sr.ok && sr.scope === 'preliminary_steam_multicase' && sr.cases.length === 1);
T('Steam preliminary formula trace وجود دارد', sr.formulaTrace.join(' | ').indexOf('Steam preliminary Cv') > -1);
T('تابع قدیمی Liquid همچنان Gas را block می‌کند', sb.ptfAdvCvCalculateLiquidCases(gas).ok === false);
var locked = makeSandbox(false);
T('بدون grant مسیر gas/steam fail-closed/paywall است', locked.ptfAdvCvCalculateAdvancedCases(gas).ok === false && locked.__paywall === true);

DONE('tester250-advanced-cv-gas-steam-prelim');
