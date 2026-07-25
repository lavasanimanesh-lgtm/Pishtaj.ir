/* tester226 — v31.7.49 (ADV-CV-PRELIM-CALC-001)
 * Deterministic preliminary liquid Control Valve calculation for licensed users only; no PDF/final report.
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
    document: {
      getElementById: function () { return null; },
      body: { insertAdjacentHTML: function () {} }
    }
  };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'tools/advanced-tools-ui.js' });
  return sandbox;
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

SECTION('Preliminary calculation API and lock');
T('تابع ptfAdvCvCalculatePrelim تعریف شده است', adv.indexOf('window.ptfAdvCvCalculatePrelim = function') > -1);
T('اجرای محاسبه مقدماتی به grant ابزار وابسته است', adv.indexOf("ptfToolsHasGrant('control_valve_advanced')") > -1 && adv.indexOf('برای اجرای محاسبه مقدماتی، فعال‌سازی ابزار پیشرفته لازم است') > -1);
T('دکمه محاسبه مقدماتی فقط در شاخه unlocked ساخته می‌شود', adv.indexOf('محاسبه مقدماتی مایع') > -1 && adv.indexOf('unlocked ?') > -1);

SECTION('Liquid deterministic formulas');
T('فرمول FF و choked pressure drop در سورس وجود دارد', adv.indexOf('0.96 - 0.28 * Math.sqrt(Pv / Pc)') > -1 && adv.indexOf('FL * FL * pressureTerm') > -1);
T('فرمول Kv non-choked و Kv choked وجود دارد', adv.indexOf('Q * Math.sqrt(SG / dP)') > -1 && adv.indexOf('Q * Math.sqrt(SG) / (FL * Math.sqrt(pressureTerm))') > -1);
T('تبدیل Kv به Cv با ضریب 1.156 انجام می‌شود', adv.indexOf('1.156 * Kv') > -1);
T('خروجی scope/final/pdf صریح دارد', adv.indexOf("scope: 'preliminary_liquid_only'") > -1 && adv.indexOf('final: false') > -1 && adv.indexOf('pdf: false') > -1);

SECTION('Runtime numeric verification');
var sb = makeSandbox(true);
var sample = {
  adv_phase: 'مایع (Liquid)',
  adv_project: 'Test Project',
  adv_tag: 'FV-101',
  adv_service: 'Cooling Water',
  adv_normal_flow: '100',
  adv_normal_p1: '10',
  adv_normal_p2: '6',
  adv_normal_temp: '25',
  adv_fluid: 'Water',
  adv_sg: '1',
  adv_visc: '1',
  adv_pv: '0.03',
  adv_pc: '221',
  adv_fl: '0.9',
  adv_in_pipe: '4 in',
  adv_out_pipe: '4 in',
  adv_brand: 'Fisher'
};
var r = sb.ptfAdvCvCalculatePrelim(sample);
T('نمونه liquid با grant معتبر ok می‌شود', r && r.ok === true && r.scope === 'preliminary_liquid_only');
T('ΔP نمونه درست است', near(r.dP, 4, 0.0001), 'got ' + (r && r.dP));
T('FF نمونه در بازه مورد انتظار است', near(r.FF, 0.956737, 0.0005), 'got ' + (r && r.FF));
T('ΔP_choked نمونه درست است', near(r.dPChoke, 8.0762, 0.01), 'got ' + (r && r.dPChoke));
T('نمونه non-choked است', r.choked === false);
T('Kv و Cv نمونه درست هستند', near(r.Kv, 50, 0.001) && near(r.Cv, 57.8, 0.01), 'Kv=' + (r && r.Kv) + ' Cv=' + (r && r.Cv));
T('formula trace شامل محاسبات قابل ردیابی است', Array.isArray(r.formulaTrace) && r.formulaTrace.length >= 5 && r.formulaTrace.join(' | ').indexOf('Cv = 1.156') > -1);

SECTION('Fail-closed and scope guards');
var locked = makeSandbox(false);
var lr = locked.ptfAdvCvCalculatePrelim(sample);
T('بدون grant محاسبه fail-closed می‌شود و paywall صدا می‌خورد', lr && lr.ok === false && lr.missingId === 'license' && locked.__paywall === true);
var gas = makeSandbox(true).ptfAdvCvCalculatePrelim(Object.assign({}, sample, { adv_phase: 'گاز (Gas)' }));
T('Gas/Steam در این فاز محاسبه نمی‌شود', gas && gas.ok === false && gas.missingId === 'adv_phase');
var bad = makeSandbox(true).ptfAdvCvCalculatePrelim(Object.assign({}, sample, { adv_normal_p1: '5', adv_normal_p2: '6' }));
T('P1 <= P2 خطای اعتبارسنجی می‌دهد', bad && bad.ok === false && bad.missingId === 'adv_normal_p1');

SECTION('No paid report bypass');
T('هیچ fetch/API/PDF/print در advanced prelim وجود ندارد', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

DONE('tester226-advanced-cv-prelim-calc');
