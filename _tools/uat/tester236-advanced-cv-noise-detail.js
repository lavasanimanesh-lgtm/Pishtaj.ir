/* tester236 — v31.7.59 (ADV-CV-NOISE-DETAIL-001)
 * Advanced Control Valve liquid sizing adds preliminary noise risk index and recommendations.
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

SECTION('Static noise detail additions');
T('نسخه ADV-CV-NOISE-DETAIL-001 ثبت شده است', adv.indexOf('ADV-CV-NOISE-DETAIL-001') > -1);
T('noiseRisk و noiseSummary وجود دارند', adv.indexOf('function noiseRisk') > -1 && adv.indexOf('function noiseSummary') > -1);
T('ستون Noise risk و Overall noise risk در UI وجود دارد', adv.indexOf('Noise risk') > -1 && adv.indexOf('Overall noise risk') > -1);
T('سطوح low/watch/medium/high/severe noise وجود دارند', ['Low noise risk','Watch noise','Medium noise risk','High noise risk','Severe noise risk'].every(function (x) { return adv.indexOf(x) > -1; }));
T('recommendationهای low-noise trim و IEC/vendor وجود دارد', ['low-noise trim','IEC 60534-8','vendor'].every(function (x) { return adv.indexOf(x) > -1; }));
T('هیچ مسیر PDF/report/download یا fetch اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

SECTION('Runtime noise risk verification');
var sb = makeSandbox(true);
var base = {
  adv_phase: 'مایع (Liquid)', adv_project: 'P', adv_tag: 'FV-1', adv_service: 'Water',
  adv_normal_flow: '10', adv_normal_p1: '3', adv_normal_p2: '2', adv_normal_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 4', adv_brand: 'Fisher', adv_rated_cv: '100',
  adv_valve_type: 'Globe', adv_fail: 'Fail Close', adv_shutoff: '3', adv_seat: '30', adv_packing_force: '50', adv_act_safety: '1.25', adv_act_supply: '4.5'
};
var low = sb.ptfAdvCvCalculateLiquidCases(base);
T('نمونه کم‌انرژی noise low/watch دارد', low.ok && low.cases[0].noise && low.cases[0].noise.score <= 2 && low.noiseSummary.score <= 2);
var high = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, base, { adv_normal_flow: '300', adv_normal_p1: '12', adv_normal_p2: '2', adv_in_pipe: 'DN80', adv_out_pipe: 'DN50' }));
T('نمونه high energy/velocity noise high یا severe دارد', high.ok && high.noiseSummary && high.noiseSummary.score >= 4 && high.cases[0].noise.index >= 85);
T('برای high noise پیشنهاد low-noise/detail تولید می‌شود', high.noiseRecommendations.join(' | ').indexOf('low-noise') > -1 || high.noiseRecommendations.join(' | ').indexOf('noise') > -1);
T('noise در هر case و overall summary وجود دارد', [low, high].every(function (r) { return r.ok && r.cases[0].noise && r.noiseSummary && Array.isArray(r.noiseRecommendations); }));
T('noise formula trace در case وجود دارد', high.cases[0].noise.formulaTrace.join(' | ').indexOf('preliminary noise index') > -1);

DONE('tester236-advanced-cv-noise-detail');
