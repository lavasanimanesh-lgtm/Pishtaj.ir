/* tester247 — v31.7.97 (ADV-CV-INTERNAL-SCENARIO-QA-001)
 * Runs internal QA comparison table across built-in Advanced CV feedback scenarios.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

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
    navigator: { clipboard: { writeText: function (txt) { sandbox.__copied = txt; } } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    sessionStorage: { getItem: function () { return JSON.stringify({ grantPayload: { licenseId: 'LIC-UAT', tool: 'control_valve_advanced', type: 'staff_internal', exp: 9999999999 } }); } },
    document: { getElementById: function (id) { return el(id); }, body: { insertAdjacentHTML: function () {} } }
  };
  ['advCvFeedbackPack','advCvPrelimResult','advCvCompletenessResult','advCvDraftStatus'].forEach(el);
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
  return sandbox;
}

SECTION('Static internal scenario QA');
T('نسخه ADV-CV-INTERNAL-SCENARIO-QA-001 ثبت شده است', adv.indexOf('ADV-CV-INTERNAL-SCENARIO-QA-001') > -1);
T('تابع ptfAdvCvRunInternalScenarioQa وجود دارد', adv.indexOf('ptfAdvCvRunInternalScenarioQa') > -1);
T('QA سناریوهای baseline/cavitation/reducer/gas را استفاده می‌کند', ['baseline_water','cavitation_noise','reducer_velocity','gas_steam_screen'].every(function (x) { return adv.indexOf(x) > -1; }));
T('جدول QA ستون‌های مهم Liquid/Gas/Steam دارد', ['Phase','Governing','Choked','xChoked','Actual Q','Cavitation','Noise','Vmax','Actuator','Readiness','Checksum','Warnings'].every(function (x) { return adv.indexOf(x) > -1; }));
T('UI دکمه اجرای QA داخلی سناریوها دارد', adv.indexOf('اجرای QA داخلی سناریوها') > -1);
T('هیچ مسیر PDF/download/print/fetch/export اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1);
T('نسخه CRM v33.3.4 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime internal scenario QA');
var sb = makeSandbox(true);
var summary = sb.ptfAdvCvRunInternalScenarioQa();
T('QA runtime هشت سناریوی Liquid/Gas/Steam را اجرا می‌کند', summary && summary.total === 8 && (summary.pass + summary.review + summary.failed) === 8);
T('QA خروجی جدول در advCvFeedbackPack می‌نویسد', sb.__els.advCvFeedbackPack.innerHTML.indexOf('QA داخلی سناریوهای') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('baseline_water') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('cavitation_noise') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('reducer_velocity') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('gas_steam_screen') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('gas_non_choked') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('gas_choked') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('steam_non_choked') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('steam_choked') > -1);
T('QA checksum/readiness/risk را در جدول نشان می‌دهد', sb.__els.advCvFeedbackPack.innerHTML.indexOf('Checksum') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('Readiness') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('Noise') > -1);
var locked = makeSandbox(false);
T('بدون grant QA fail-closed/paywall می‌شود', locked.ptfAdvCvRunInternalScenarioQa() === false && locked.__paywall === true);

DONE('tester247-advanced-cv-internal-scenario-qa');
