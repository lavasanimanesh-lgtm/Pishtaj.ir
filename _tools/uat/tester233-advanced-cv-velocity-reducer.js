/* tester233 — v31.7.56 (ADV-CV-VELOCITY-REDUCER-001)
 * Advanced Control Valve liquid multi-case adds pipe velocity and reducer preliminary checks.
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

SECTION('Static pipe velocity/reducer additions');
T('نسخه ADV-CV-VELOCITY-REDUCER-001 ثبت شده است', adv.indexOf('ADV-CV-VELOCITY-REDUCER-001') > -1);
T('parsePipeIdMm و NPS_ID_MM برای تشخیص سایز لوله وجود دارد', adv.indexOf('function parsePipeIdMm') > -1 && adv.indexOf('NPS_ID_MM') > -1 && adv.indexOf('window.ptfAdvCvParsePipeIdMm') > -1);
T('velocityFromQ و pipeVelocityChecks وجود دارد', adv.indexOf('function velocityFromQ') > -1 && adv.indexOf('function pipeVelocityChecks') > -1);
T('خروجی جدول Vin/Vout و Reducer ratio دارد', adv.indexOf('Vin m/s') > -1 && adv.indexOf('Vout m/s') > -1 && adv.indexOf('Reducer ratio') > -1);
T('هشدارهای Fp/FLp و velocity در متن وجود دارد', adv.indexOf('Fp/FLp') > -1 && adv.indexOf('سرعت') > -1 && adv.indexOf('m/s') > -1);
T('هیچ مسیر PDF/report/download یا fetch اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1);

SECTION('Runtime pipe parsing');
var sb = makeSandbox(true);
var p1 = sb.ptfAdvCvParsePipeIdMm('NPS 4');
var p2 = sb.ptfAdvCvParsePipeIdMm('DN100');
var p3 = sb.ptfAdvCvParsePipeIdMm('ID 102 mm');
T('NPS 4 به ID تقریبی 102.3mm تبدیل می‌شود', p1.ok && near(p1.idMm, 102.3, 0.01));
T('DN100 به 100mm nominal approximation تبدیل می‌شود', p2.ok && near(p2.idMm, 100, 0.01));
T('ID 102 mm مستقیم parse می‌شود', p3.ok && near(p3.idMm, 102, 0.01));

SECTION('Runtime velocity/reducer calculation');
var sample = {
  adv_phase: 'مایع (Liquid)',
  adv_project: 'Test Project', adv_tag: 'FV-101', adv_service: 'Cooling Water',
  adv_min_flow: '40', adv_min_p1: '9', adv_min_p2: '7', adv_min_temp: '25',
  adv_normal_flow: '100', adv_normal_p1: '10', adv_normal_p2: '6', adv_normal_temp: '25',
  adv_max_flow: '150', adv_max_p1: '11', adv_max_p2: '5', adv_max_temp: '25',
  adv_fluid: 'Water', adv_sg: '1', adv_visc: '1', adv_pv: '0.03', adv_pc: '221', adv_fl: '0.9',
  adv_in_pipe: 'NPS 4', adv_out_pipe: 'DN80', adv_brand: 'Fisher', adv_rated_cv: '200'
};
var r = sb.ptfAdvCvCalculateLiquidCases(sample);
var normal = r.cases.filter(function (c) { return c.caseId === 'normal'; })[0];
var max = r.cases.filter(function (c) { return c.caseId === 'max'; })[0];
T('محاسبه multicase با pipe check ok است', r && r.ok && r.common && r.common.inPipe.ok && r.common.outPipe.ok);
T('Reducer ratio برای NPS4 به DN80 حدود 0.78 است', near(r.common.reducerRatio, 80 / 102.3, 0.01));
T('سرعت ورودی normal حدود 3.38 m/s است', normal.pipe && near(normal.pipe.vIn, 3.38, 0.04), 'Vin=' + (normal.pipe && normal.pipe.vIn));
T('سرعت خروجی normal با DN80 بالا و warning دارد', normal.pipe && normal.pipe.vOut > 5 && r.warnings.join(' | ').indexOf('سرعت outlet') > -1);
T('Max case velocity high است', max.pipe && max.pipe.vIn > 5 && max.pipe.vInLevel === 'high');
T('هشدار reducer correction شامل Fp/FLp است', r.warnings.join(' | ').indexOf('Fp/FLp') > -1);
T('Pipe basis در warning summary حفظ می‌شود یا reducer warning وجود دارد', r.warnings.join(' | ').indexOf('Pipe ID basis') > -1 || r.warnings.join(' | ').indexOf('reducer ratio') > -1);

DONE('tester233-advanced-cv-velocity-reducer');
