/* tester232 — v31.7.55 (ADV-CV-LIQUID-MULTICASE-001)
 * Licensed Advanced Control Valve liquid sizing now covers Min/Normal/Max preliminary cases.
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

SECTION('Static multi-case API');
T('نسخه و API سه‌حالته تعریف شده است', adv.indexOf('ADV-CV-LIQUID-MULTICASE-001') > -1 && adv.indexOf('window.ptfAdvCvCalculateLiquidCases = function') > -1);
T('فیلد Cv نامی کاندید برای opening% اضافه شده است', adv.indexOf('adv_rated_cv') > -1 && adv.indexOf('Cv نامی ولو کاندید') > -1);
T('خروجی multicase scope/final/pdf صریح دارد', adv.indexOf("scope: 'preliminary_liquid_multicase'") > -1 && adv.indexOf('final: false') > -1 && adv.indexOf('pdf: false') > -1);
T('جدول caseها شامل governing/recommendedCv است', adv.indexOf('Governing case') > -1 && adv.indexOf('recommendedCv') > -1 && adv.indexOf('Prelim selected Cv +10%') > -1);
T('هیچ مسیر PDF/report/download یا fetch اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

SECTION('Runtime multi-case numeric verification');
var sample = {
  adv_phase: 'مایع (Liquid)',
  adv_project: 'Test Project', adv_tag: 'FV-101', adv_service: 'Cooling Water',
  adv_min_flow: '40', adv_min_p1: '9', adv_min_p2: '7', adv_min_temp: '25',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_max_flow: '150', adv_max_p1: '11', adv_max_p2: '5', adv_max_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: '4 in', adv_out_pipe: '4 in', adv_brand: 'Fisher', adv_rated_cv: '200'
};
var sb = makeSandbox(true);
var r = sb.ptfAdvCvCalculateLiquidCases(sample);
T('سه case با grant معتبر محاسبه می‌شود', r && r.ok === true && r.scope === 'preliminary_liquid_multicase' && r.cases.length === 3);
T('Normal Cv همان مقدار قبلی حدود 57.8 است', near(r.cases.filter(function (c) { return c.caseId === 'normal'; })[0].Cv, 57.8, 0.02));
T('Governing case حالت max است', r.governing && r.governing.caseId === 'max' && r.governing.Cv > r.cases.filter(function (c) { return c.caseId === 'normal'; })[0].Cv);
T('recommendedCv ده درصد بالاتر از governing Cv است', near(r.recommendedCv, r.governing.Cv * 1.10, 0.01));
T('opening% بر اساس rated Cv محاسبه می‌شود', near(r.governing.openingPct, r.governing.Cv / 200 * 100, 0.05));
T('formula trace برای governing case وجود دارد', Array.isArray(r.formulaTrace) && r.formulaTrace.join(' | ').indexOf('Cv = 1.156') > -1);

SECTION('Compatibility and fail-closed');
var p = sb.ptfAdvCvCalculatePrelim(sample);
T('تابع قدیمی ptfAdvCvCalculatePrelim همچنان scope قبلی را برمی‌گرداند', p && p.ok === true && p.scope === 'preliminary_liquid_only' && p.multicaseScope === 'preliminary_liquid_multicase');
var locked = makeSandbox(false);
var lr = locked.ptfAdvCvCalculateLiquidCases(sample);
T('بدون grant multicase fail-closed می‌شود', lr && lr.ok === false && lr.missingId === 'license' && locked.__paywall === true);
var gas = makeSandbox(true).ptfAdvCvCalculateLiquidCases(Object.assign({}, sample, { adv_phase: 'گاز (Gas)' }));
T('Gas/Steam در این فاز همچنان block است', gas && gas.ok === false && gas.missingId === 'adv_phase');

DONE('tester232-advanced-cv-liquid-multicase');
