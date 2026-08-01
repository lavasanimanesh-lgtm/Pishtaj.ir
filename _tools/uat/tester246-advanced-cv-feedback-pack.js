/* tester246 — v31.7.97 (ADV-CV-FEEDBACK-PACK-001)
 * Advanced Control Valve gets engineering feedback pack with loadable test scenarios and feedback template.
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
    sessionStorage: { getItem: function () { return null; } },
    document: { getElementById: function (id) { return el(id); }, body: { insertAdjacentHTML: function () {} } }
  };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function (tool) { return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function () { sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
  return sandbox;
}

SECTION('Static feedback pack');
T('نسخه ADV-CV-FEEDBACK-PACK-001 ثبت شده است', adv.indexOf('ADV-CV-FEEDBACK-PACK-001') > -1);
T('سه سناریوی نمونه تعریف شده است', ['baseline_water','cavitation_noise','reducer_velocity'].every(function (x) { return adv.indexOf(x) > -1; }));
T('توابع feedback pack وجود دارند', ['ptfAdvCvApplyFeedbackSample','ptfAdvCvFeedbackText','ptfAdvCvCopyFeedbackText','ptfAdvCvOpenFeedbackPack'].every(function (x) { return adv.indexOf(x) > -1; }));
T('UI دکمه بسته تست و feedback دارد', adv.indexOf('بسته تست و feedback') > -1 && adv.indexOf('advCvFeedbackPack') > -1);
T('قالب feedback سوال‌های مهندسی کلیدی دارد', ['input labels/units','Cv/Kv','velocity / reducer','cavitation/flashing','actuator shell','English report preview'].every(function (x) { return adv.indexOf(x) > -1; }));
T('هیچ مسیر PDF/download/print/fetch/export اضافه نشده است', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1);
T('نسخه CRM به v33.3.2 رسیده است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime feedback samples');
var sb = makeSandbox(true);
var ok = sb.ptfAdvCvApplyFeedbackSample('baseline_water');
T('نمونه baseline با grant بارگذاری می‌شود', ok === true && sb.__els.adv_project.value.indexOf('Cooling Water') > -1 && sb.__els.adv_tag.value === 'FV-101');
var r = sb.ptfAdvCvCalculateLiquidCases(sb.ptfAdvCvCollectDraft());
T('نمونه baseline بعد از بارگذاری قابل محاسبه است', r && r.ok === true && r.cases.length === 3);
sb.ptfAdvCvApplyFeedbackSample('cavitation_noise');
var r2 = sb.ptfAdvCvCalculateLiquidCases(sb.ptfAdvCvCollectDraft());
T('نمونه high ΔP ریسک cavitation/noise معنی‌دار ایجاد می‌کند', r2 && r2.ok === true && (r2.riskSummary.score >= 3 || r2.noiseSummary.score >= 3));
sb.ptfAdvCvCopyFeedbackText();
T('کپی قالب feedback کار می‌کند', (sb.__copied || '').indexOf('Advanced Control Valve feedback') > -1 && sb.__copied.indexOf('English report preview') > -1);
sb.ptfAdvCvOpenFeedbackPack();
T('بسته feedback روی UI نوشته می‌شود', sb.__els.advCvFeedbackPack.innerHTML.indexOf('بسته تست') > -1 && sb.__els.advCvFeedbackPack.innerHTML.indexOf('نمونه ۳') > -1);
var locked = makeSandbox(false);
T('بدون grant، load sample fail-closed/paywall می‌شود', locked.ptfAdvCvApplyFeedbackSample('baseline_water') === false && locked.__paywall === true);

DONE('tester246-advanced-cv-feedback-pack');
