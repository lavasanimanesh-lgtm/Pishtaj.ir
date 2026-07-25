/* tester225 — v31.7.48+ (ADV-CV-DRAFT-INPUT-001)
 * Licensed users can enter Advanced CV draft data and check completeness; public remains locked.
 * Updated in v31.7.49: preliminary liquid calculation is covered by tester226, while final PDF/report remains locked.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');

SECTION('Licensed draft input functions');
T('DRAFT_KEY و نسخه draft تعریف شده است', adv.indexOf("DRAFT_KEY = 'ptf_adv_cv_drafts'") > -1 && adv.indexOf('ADV-CV-DRAFT-v1') > -1);
T('وضعیت unlock از ptfToolsHasGrant خوانده می‌شود', adv.indexOf("ptfToolsHasGrant('control_valve_advanced')") > -1);
T('disabledAttr برای قفل/بازکردن فیلدها شرطی است', adv.indexOf('function disabledAttr') > -1 && adv.indexOf("return isUnlocked() ? '' : ' disabled'") > -1);
T('collect/check/save draft functions وجود دارند', ['ptfAdvCvCollectDraft','ptfAdvCvCheckCompleteness','ptfAdvCvSaveDraft'].every(function (x) { return adv.indexOf('window.' + x) > -1; }));
T('Save draft در localStorage ذخیره می‌کند نه سرور', adv.indexOf('localStorage.setItem(DRAFT_KEY') > -1 && adv.indexOf('fetch(') === -1);

SECTION('Completeness rules');
T('required fields شامل normal flow/P1/P2/temp و fluid basics است', ['adv_normal_flow','adv_normal_p1','adv_normal_p2','adv_normal_temp','adv_phase','adv_fluid','adv_fl'].every(function (x) { return adv.indexOf(x) > -1; }));
T('Liquid requirements شامل SG/Pv/Pc/viscosity است', ['adv_sg','adv_pv','adv_pc','adv_visc'].every(function (x) { return adv.indexOf(x) > -1; }));
T('Gas/Steam requirements شامل MW/Z/k/Xt است', ['adv_mw','adv_z','adv_k','adv_xt'].every(function (x) { return adv.indexOf(x) > -1; }));
T('Completeness score و missing list روی UI نمایش داده می‌شود', (adv.indexOf('Completeness score') > -1 || adv.indexOf('امتیاز کامل بودن داده‌ها') > -1) && (adv.indexOf('Missing:') > -1 || adv.indexOf('داده‌های ناقص') > -1) && adv.indexOf('advCvCompletenessResult') > -1);

SECTION('Final report/PDF still locked');
T('محاسبه مقدماتی جدا از گزارش نهایی است', adv.indexOf('preliminary_liquid_only') > -1 && adv.indexOf('final: false') > -1 && adv.indexOf('pdf: false') > -1);
T('کد draft/prelim هیچ PDF/report قابل دانلود تولید نمی‌کند', adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('fetch(') === -1);
T('متن UI تصریح می‌کند final calculation/report disabled است', (adv.indexOf('Final calculation') > -1 || adv.indexOf('گزارش نهایی') > -1) && (adv.indexOf('English PDF report remain disabled') > -1 || adv.indexOf('PDF') > -1));

SECTION('Tools entry remains visible');
T('دکمه مشاهده فرم ورودی قفل‌شده همچنان در tools وجود دارد', tools.indexOf('مشاهده فرم ورودی قفل‌شده') > -1 && tools.indexOf('ptfAdvCvOpenSchema') > -1);

DONE('tester225-advanced-cv-draft-input');
