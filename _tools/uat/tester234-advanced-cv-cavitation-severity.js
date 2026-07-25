/* tester234 — v31.7.57 (ADV-CV-CAVITATION-SEVERITY-001)
 * Advanced Control Valve liquid sizing adds cavitation/flashing severity classification and recommendations.
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

SECTION('Static cavitation severity additions');
T('نسخه ADV-CV-CAVITATION-SEVERITY-001 ثبت شده است', adv.indexOf('ADV-CV-CAVITATION-SEVERITY-001') > -1);
T('تابع cavitationRisk و riskSummary وجود دارد', adv.indexOf('function cavitationRisk') > -1 && adv.indexOf('function riskSummary') > -1);
T('Risk badge و ستون Cavitation risk در جدول وجود دارد', adv.indexOf('function riskBadge') > -1 && adv.indexOf('Cavitation risk') > -1 && adv.indexOf('Overall cavitation risk') > -1);
T('سطوح flashing/choked/high/medium/watch در منطق دیده می‌شوند', ['flashing','choked_severe','High cavitation risk','Medium risk','Watch'].every(function (x) { return adv.indexOf(x) > -1; }));
T('پیشنهادهای anti-cavitation و Fp/FLp/vendor data در متن وجود دارد', ['anti-cavitation','Fp','FLp','vendor'].every(function (x) { return adv.indexOf(x) > -1; }));
T('هیچ مسیر PDF/report/download یا fetch اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

SECTION('Runtime severity verification');
var sb = makeSandbox(true);
var base = {
  adv_phase: 'مایع (Liquid)', adv_project: 'P', adv_tag: 'FV-1', adv_service: 'Water',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'NPS 4', adv_brand: 'Fisher', adv_rated_cv: '200'
};
var low = sb.ptfAdvCvCalculateLiquidCases(base);
T('نمونه safe/normal ریسک پایین دارد', low.ok && low.riskSummary && low.riskSummary.level === 'low' && low.cases[0].risk.tag === 'Low');
var high = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, base, { adv_normal_p1: '10', adv_normal_p2: '1' }));
T('نمونه choked/severe ریسک choked_severe دارد', high.ok && high.riskSummary.score >= 5 && high.cases[0].risk.level === 'choked_severe');
T('برای severe پیشنهاد anti-cavitation تولید می‌شود', high.riskRecommendations.join(' | ').indexOf('anti-cavitation') > -1 || high.riskRecommendations.join(' | ').indexOf('trim') > -1);
var flash = sb.ptfAdvCvCalculateLiquidCases(Object.assign({}, base, { adv_normal_p1: '5', adv_normal_p2: '0.02', adv_pv: '0.03' }));
T('P2 <= Pv به flashing likely تبدیل می‌شود', flash.ok && flash.cases[0].risk.level === 'flashing' && flash.warnings.join(' | ').indexOf('flashing') > -1);
T('risk در هر case و overall summary وجود دارد', [low, high, flash].every(function (r) { return r.ok && r.cases[0].risk && r.riskSummary && Array.isArray(r.riskRecommendations); }));

DONE('tester234-advanced-cv-cavitation-severity');
