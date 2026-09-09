#!/usr/bin/env node
'use strict';
/* v34.38.0 — OFFICIAL-OFFER-OUTPUT-001 (بازپیاده‌سازی PR #57 روی main):
   خروجی چاپ/PDF رسمی بدون watermark «PREVIEW» از سه مسیر:
   ۱) فرم باز (offerPrintCurrent — از وضعیت فعلی فرم، بدون ذخیره)
   ۲) سند ذخیره‌شده در اسناد پرونده (offerFormalPrint)
   ۳) snapshot سند قطعی برد (offerFormalPrintObj — بدون mutate snapshot)
   پیش‌نمایش داخلی عمداً همچنان watermark دارد. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var off = read('crm/offers.js');
var pro = read('crm/offers-pro.js');
var sf = read('crm/salesfiles.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.38.15', ver.crm_version === 'v34.38.15', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.38.15', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.38.15'") > -1);
T('sw RELEASE = v34.38.15', sw.indexOf("RELEASE = 'v34.38.15'") > -1);
T('offers-pro.js cache-bust 34.38.15', idx.indexOf('offers-pro.js?v=34.38.15') > -1);

/* ---------- فرم: materialize مشترک + دکمه رسمی ---------- */
T('offMaterializeCurrentDocument تعریف شده', off.indexOf('function offMaterializeCurrentDocument()') > -1);
T('materialize فیلدهای چاپ/اعتبار فرم را هم می‌خواند', /offMaterializeCurrentDocument[\s\S]{0,1500}ofValidJ[\s\S]{0,600}ofPrintAs/.test(off));
T('offerPreview از materialize استفاده می‌کند', /function offerPreview\(\) \{\s*var o = offMaterializeCurrentDocument\(\);/.test(off));
T('offerPrintCurrent با isPreview=false چاپ می‌کند', off.indexOf('function offerPrintCurrent()') > -1 && /offerPrintCurrent[\s\S]{0,600}offerPrintTpl\(o, tpl, false\)/.test(off));
T('offerPrintCurrent ذخیره نمی‌کند', /function offerPrintCurrent\(\)[\s\S]{0,900}window\.offerPrintCurrent/.test(off) && off.slice(off.indexOf('function offerPrintCurrent()'), off.indexOf('window.offerPrintCurrent')).indexOf('offerSave') === -1);
T('دکمه «چاپ / PDF رسمی» در فوتر فرم', off.indexOf('offerPrintCurrent()') > -1 && off.indexOf('🖨 چاپ / PDF رسمی') > -1);
var iFooter = off.indexOf('offer-form-footer');
var footBlock = off.slice(iFooter, iFooter + 1100);
T('ترتیب فوتر: انصراف ← پیش‌نمایش ← رسمی ← ذخیره (قرارداد case-revision حفظ)',
  footBlock.indexOf('انصراف') > -1 && footBlock.indexOf('انصراف') < footBlock.indexOf('offerPreview()') &&
  footBlock.indexOf('offerPreview()') < footBlock.indexOf('offerPrintCurrent()') &&
  footBlock.indexOf('offerPrintCurrent()') < footBlock.indexOf('id="offSaveBtn"'));

/* ---------- سند ذخیره‌شده و snapshot ---------- */
T('offerFormalPrintObj/offerFormalPrint در offers-pro', pro.indexOf('window.offerFormalPrintObj = function') > -1 && pro.indexOf('window.offerFormalPrint = function') > -1);
T('formal با isPreview=false', /offerFormalPrintObj[\s\S]{0,400}offerPrintTpl\(o, tpl, false\)/.test(pro));
T('پیش‌نمایش داخلی همچنان watermark دارد (quickPreview=true)', /offerQuickPreview[\s\S]{0,400}offerPrintTpl\(o, tpl, true\)/.test(pro));
T('واترمارک PREVIEW فقط با isPreview', pro.indexOf('var wm = isPreview ?') > -1 && pro.indexOf('content:"PREVIEW"') > -1);
T('سند برد از snapshot با خروجی رسمی چاپ می‌شود', /JSON\.parse\(JSON\.stringify\(ad\.snap\)\)[\s\S]{0,300}offerFormalPrintObj\(snap\)/.test(sf));
T('ردیف اسناد پرونده: دکمه PDF/چاپ رسمی + پیش‌نمایش برچسب‌دار', sf.indexOf('offerFormalPrint(') > -1 && sf.indexOf('👁 پیش‌نمایش') > -1 && sf.indexOf('🖨 PDF / چاپ') > -1);

/* ---------- sandbox: formal بدون watermark و بدون mutate ---------- */
try {
  var calls = [];
  var sb = {
    console: console, JSON: JSON, String: String,
    localStorage: { getItem: function () { return 'letterhead'; } },
    getData: function () { return [{ no: 'CO-77', items: [] }]; },
    offerPrintTpl: function (o, tpl, isPreview) { calls.push({ no: o && o.no, tpl: tpl, isPreview: isPreview }); },
    window: null
  };
  sb.window = sb;
  vm.createContext(sb);
  var cutI = pro.indexOf('window.offerFormalPrintObj = function');
  var cutJ = pro.indexOf('// offerPrint قدیمی');
  vm.runInContext(pro.slice(cutI, cutJ), sb, { filename: 'offers-pro.js#formal' });
  var snap = { no: 'CO-SNAP', items: [{ name: 'x' }] };
  var before = JSON.stringify(snap);
  sb.offerFormalPrintObj(snap);
  sb.offerFormalPrint('CO-77');
  T('sandbox: هر دو مسیر با isPreview=false', calls.length === 2 && calls.every(function (c) { return c.isPreview === false; }), JSON.stringify(calls));
  T('sandbox: snapshot mutate نشد', JSON.stringify(snap) === before);
  T('sandbox: شماره سند درست حل شد', calls[1].no === 'CO-77');
} catch (e) {
  T('sandbox خروجی رسمی اجرا شد', false, String(e && e.message || e));
}

T('tester461 در گیت CI', gate.indexOf('tester461-v34.7.58-offer-formal-output.js') > -1);

console.log('\n— tester461 (v34.38.0: خروجی چاپ/PDF رسمی بدون watermark) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
