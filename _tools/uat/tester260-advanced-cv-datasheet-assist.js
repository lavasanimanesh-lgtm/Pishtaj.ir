/* tester260 — v31.7.97 (ADV-CV-DATASHEET-ASSIST-001)
 * Datasheet text/TXT/CSV/JSON assisted extraction and auto-fill for Advanced Control Valve input form.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

function makeSandbox(grant) {
  var els = {};
  function el(id) { if (!els[id]) els[id] = { id: id, value: '', checked: false, files: [], style: {}, innerHTML: '' }; return els[id]; }
  var sandbox = { __grant: !!grant, __els: els, console: console, Math: Math, Date: Date, Number: Number, parseFloat: parseFloat, isFinite: isFinite, navigator:{}, localStorage:{getItem:function(){return null;},setItem:function(){}}, sessionStorage:{getItem:function(){return null;}}, document: { getElementById: function(id){ return el(id); }, body: { insertAdjacentHTML: function(){} } } };
  sandbox.window = sandbox;
  sandbox.ptfToolsHasGrant = function(tool){ return sandbox.__grant && tool === 'control_valve_advanced'; };
  sandbox.ptfToolsPaywall = function(){ sandbox.__paywall = true; };
  vm.runInNewContext(adv, sandbox, { filename: 'advanced-tools-ui.js' });
  return sandbox;
}

var text = [
  'Tag: FV-101',
  'Service: Cooling water control',
  'Fluid: Water liquid',
  'Flow rate: 100 m3/h',
  'P1: 10 bara',
  'P2: 6 bara',
  'Temperature: 25 C',
  'SG: 1.0',
  'Viscosity: 1 cP',
  'Pv: 0.03 bar',
  'Pc: 221 bar',
  'Inlet pipe: NPS 4',
  'Outlet pipe: DN80',
  'Class: Class 300',
  'Body material: WCB',
  'Trim material: SS316',
  'FL: 0.90',
  'Fd: 0.46',
  'Rated Cv: 200',
  'Manufacturer: Fisher',
  'Series: GX',
  'Leakage class: Class IV',
  'Fail action: Fail Close',
  'Shutoff DP: 10',
  'Seat diameter: 50'
].join('\n');

SECTION('Static datasheet assist');
T('توابع datasheet assist وجود دارند', ['ptfAdvCvExtractDatasheetText','ptfAdvCvApplyDatasheetExtract','ptfAdvCvReadDatasheetFile'].every(function(x){ return adv.indexOf(x) > -1; }));
T('UI بخش دیتاشیت و upload دارد', adv.indexOf('ورود سریع از دیتاشیت') > -1 && adv.indexOf('adv_ds_file') > -1 && adv.indexOf('adv_ds_text') > -1 && adv.indexOf('استخراج و تکمیل خودکار') > -1);
T('محدودیت PDF/OCR شفاف توضیح داده شده است', adv.indexOf('server PDF/OCR parser') > -1 && adv.indexOf('TXT/CSV/JSON') > -1);
T('parser فیلدهای vendor کلیدی را پوشش می‌دهد', ['rated\\s*cv','manufacturer|brand|make','model|series|type','leakage\\s*class','\\bfl','\\bxt'].every(function(x){ return adv.indexOf(x) > -1; }));
T('CRM/SW نسخه v33.4.5 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

SECTION('Runtime parser/autofill');
var sb = makeSandbox(true);
var parsed = sb.ptfAdvCvExtractDatasheetText(text);
T('runtime: parser فیلدهای اصلی را استخراج می‌کند', parsed.ok && parsed.fields.adv_tag === 'FV-101' && parsed.fields.adv_normal_flow === '100' && parsed.fields.adv_normal_p1 === '10' && parsed.fields.adv_normal_p2 === '6');
T('runtime: parser داده‌های vendor را استخراج می‌کند', parsed.fields.adv_fl === '0.90' && parsed.fields.adv_rated_cv === '200' && /Fisher/i.test(parsed.fields.adv_brand));
sb.document.getElementById('adv_ds_text').value = text;
var applied = sb.ptfAdvCvApplyDatasheetExtract();
T('runtime: apply فرم را پر می‌کند', applied && applied.applied.length >= 12 && sb.__els.adv_tag.value === 'FV-101' && sb.__els.adv_fl.value === '0.90');
T('runtime: نتیجه در advCvDatasheetAssistResult نوشته می‌شود', sb.__els.advCvDatasheetAssistResult.innerHTML.indexOf('استخراج دیتاشیت انجام شد') > -1);
var locked = makeSandbox(false);
T('بدون grant datasheet assist fail-closed/paywall است', locked.ptfAdvCvApplyDatasheetExtract() === false && locked.__paywall === true);

DONE('tester260-advanced-cv-datasheet-assist');
