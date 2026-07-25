/* tester253 — v31.7.97 (ADV-CV-GAS-STEAM-QA-SCENARIOS-001)
 * Extended internal QA scenarios and runtime Gas/Steam choked/non-choked screening.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');

function makeSandbox(grant) {
  var els = {};
  function el(id) { if (!els[id]) els[id] = { id: id, value: '', style: {}, innerHTML: '' }; return els[id]; }
  var sandbox = {
    __grant: !!grant,
    __els: els,
    console: console,
    Math: Math,
    Date: Date,
    Number: Number,
    parseFloat: parseFloat,
    isFinite: isFinite,
    navigator: { clipboard: { writeText: function () {} } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    sessionStorage: { getItem: function () { return JSON.stringify({ grantPayload: { licenseId: 'LIC-UAT', tool: 'control_valve_advanced', type: 'staff_internal', exp: 9999999999 } }); } },
    document: { getElementById: function (id) { return el(id); }, body: { insertAdjacentHTML: function () {} } }
  };
  ['advCvFeedbackPack','advCvPrelimResult','advCvCompletenessResult'].forEach(el);
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
  return sandbox;
}
function base(phase, tag) {
  return {
    adv_project:'QA', adv_rfq:'QA', adv_tag:tag, adv_service:'Service', adv_qty:'1', adv_rev:'0',
    adv_min_flow:'100', adv_min_p1:'10', adv_min_p2:'8', adv_min_temp:'25',
    adv_normal_flow:'1000', adv_normal_p1:'20', adv_normal_p2:'16', adv_normal_temp:'25',
    adv_max_flow:'1500', adv_max_p1:'22', adv_max_p2:'17', adv_max_temp:'25',
    adv_phase:phase, adv_fluid:'Fluid', adv_flow_basis: phase.indexOf('Steam')>-1 || phase.indexOf('بخار')>-1 ? 'kg/h' : 'Nm3/h', adv_sg:'0.62', adv_mw:'18', adv_z:'0.92', adv_k:'1.3', adv_xt:'0.72',
    adv_in_pipe:'NPS 4', adv_out_pipe:'NPS 6', adv_valve_type:'Globe', adv_class:'Class 300', adv_body:'WCB', adv_trim:'Trim', adv_fl:'0.9', adv_fd:'0.46', adv_char:'Equal Percentage', adv_rated_cv:'300',
    adv_fail:'Fail Close', adv_act_type:'Pneumatic piston', adv_act_supply:'5.5', adv_act_safety:'1.5', adv_shutoff:'22', adv_seat:'60', adv_packing_force:'400', adv_brand:'Vendor', adv_series:'TBD', adv_leakage:'Class IV'
  };
}

SECTION('Static QA scenario coverage');
T('نسخه ADV-CV-GAS-STEAM-QA-SCENARIOS-001 ثبت شده است', adv.indexOf('ADV-CV-GAS-STEAM-QA-SCENARIOS-001') > -1);
T('چهار سناریوی جدید Gas/Steam وجود دارد', ['gas_non_choked','gas_choked','steam_non_choked','steam_choked'].every(function (x) { return adv.indexOf(x) > -1; }));
T('QA داخلی از calculateAdvancedCases استفاده می‌کند', adv.indexOf('ptfAdvCvCalculateAdvancedCases(sample.data)') > -1);
T('payload compact case x/xChoked/actualQ را نگه می‌دارد', ['x: c.x','xChoked: c.xChoked','actualQ: c.actualQ'].every(function (x) { return adv.indexOf(x) > -1; }));
T('feedback UI دکمه‌های Gas/Steam QA دارد', ['Gas non-choked','Gas choked','Steam non-choked','Steam choked'].every(function (x) { return adv.indexOf(x) > -1; }));

SECTION('Runtime Gas/Steam choked screening');
var sb = makeSandbox(true);
var gasN = base('گاز (Gas)', 'PV-GN');
gasN.adv_normal_p1 = '20'; gasN.adv_normal_p2 = '16';
var gasC = base('گاز (Gas)', 'PV-GC');
gasC.adv_normal_p1 = '30'; gasC.adv_normal_p2 = '8'; gasC.adv_xt = '0.66';
var steamN = base('بخار (Steam)', 'TV-SN');
steamN.adv_normal_flow = '1500'; steamN.adv_normal_p1 = '12'; steamN.adv_normal_p2 = '9'; steamN.adv_normal_temp = '190';
var steamC = base('بخار (Steam)', 'PV-SC');
steamC.adv_normal_flow = '2600'; steamC.adv_normal_p1 = '22'; steamC.adv_normal_p2 = '9'; steamC.adv_normal_temp = '235';
var rn = sb.ptfAdvCvCalculateAdvancedCases(gasN);
var rc = sb.ptfAdvCvCalculateAdvancedCases(gasC);
var rsn = sb.ptfAdvCvCalculateAdvancedCases(steamN);
var rsc = sb.ptfAdvCvCalculateAdvancedCases(steamC);
function normal(r) { return (r.cases || []).filter(function (c) { return c.caseId === 'normal'; })[0] || {}; }
T('Gas non-choked runtime choked=false است', rn.ok && rn.scope === 'preliminary_gas_multicase' && normal(rn).choked === false && isFinite(normal(rn).x));
T('Gas choked runtime choked=true است', rc.ok && normal(rc).choked === true && normal(rc).x >= normal(rc).xChoked);
T('Steam non-choked runtime choked=false است', rsn.ok && rsn.scope === 'preliminary_steam_multicase' && normal(rsn).choked === false);
T('Steam choked runtime choked=true است', rsc.ok && normal(rsc).choked === true);
var qa = sb.ptfAdvCvRunInternalScenarioQa();
T('QA داخلی ۸ سناریو و جدول xChoked/Actual Q دارد', qa.total === 8 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('xChoked') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('Actual Q') > -1);

DONE('tester253-advanced-cv-gas-steam-qa-scenarios');
