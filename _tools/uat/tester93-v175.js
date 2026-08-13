/* tester93 — v17.5 (US-415: تامین‌کننده خارجی — نام EN اجباری، فارسی اختیاری) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.5+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.5;})());
T('کش sw >= v17.5', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.5;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust offers/cheques >= 17.5', ['offers.js', 'cheques.js'].every(function (f) { return vOf(f) >= 17.5; }));
})();

SECTION('US-415 (کد)');
T('saveSup2: خارجی → EN اجباری (nS2Origin خوانده می‌شود — ریشه رفع شد)', of.indexOf("var isForeign = ((document.getElementById('nS2Origin') || {}).value || 'داخلی') === 'خارجی';") > -1);
T('پیام اختصاصی الزام EN برای خارجی', of.indexOf('برای تامین‌کننده خارجی، نام انگلیسی (English Name) الزامی است') > -1);
T('خارجی بدون فارسی: co = EN (نمایش/جستجو/dedup سالم)', of.indexOf('if (!comp) comp = compEn;') > -1);
T('داخلی: اعتبارسنجی قبلی عینا حفظ', of.indexOf("} else if (!comp) { (window.ptfDlgAlert || alert)('نام شرکت را وارد کنید'") > -1);
T('برچسب‌های پویا با تغییر داخلی/خارجی (ptfSupOriginLabels)', ch.indexOf('window.ptfSupOriginLabels = function') > -1 && ch.indexOf('English Name * (الزامی برای خارجی)') > -1 && ch.indexOf('نام فارسی (اختیاری — شرکت خارجی)') > -1);
T('onchange روی nS2Origin + اجرای اولیه', ch.indexOf('onchange="if(typeof ptfSupOriginLabels') > -1 && ch.indexOf('ptfSupOriginLabels();') > -1);

SECTION('رفتاری: اعتبارسنجی دوگانه');
global.window = global;
(function () {
  var m = of.match(/function saveSup2\(cd\) \{[\s\S]*?\n\}/);
  T('saveSup2 استخراج شد', !!m);
  if (!m) return;
  global._alerts = [];
  global.ptfDlgAlert = function (msg) { global._alerts.push(String(msg)); };
  global.alert = function (msg) { global._alerts.push(String(msg)); };
  global.cbCollect = function () { return []; };
  global.indivPhonesCollect = function () { return []; };
  global.primaryPerson = function () { return null; };
  global.ptfDupBlock = function () { return false; };
  global.dedupStamp = function (r) { return r; };
  global.genCode = function (p) { return p + '-' + (++global._sq7 || (global._sq7 = 1)); };
  global.hideModal = function () {};
  global.renderSuppliers = function () {};
  global.addLog = function () {};
  var vals = {};
  global.document = { getElementById: function (id) { return { value: vals[id] || '' }; } };
  eval(m[0].replace('function saveSup2', 'global.saveSup2 = function'));

  /* خارجی بدون EN → رد */
  setData('ptf_crm_suppliers', []);
  vals = { nS2Comp: '', nS2CoEn: '', nS2Origin: 'خارجی', nS2Kind: 'حقوقی', nS2Cat: 'سایر', nS2Tel: '', nS2Web: '', nS2NatId: '', nS2Melli: '' };
  saveSup2(null);
  T('خارجی بدون EN: رد', getData('ptf_crm_suppliers').length === 0 && global._alerts.some(function (a) { return a.indexOf('انگلیسی') > -1; }));
  /* خارجی فقط EN → ثبت با co=EN */
  vals.nS2CoEn = 'WIKA GmbH';
  saveSup2(null);
  var r1 = getData('ptf_crm_suppliers')[0];
  T('خارجی فقط EN: co=coEn=WIKA GmbH', r1 && r1.co === 'WIKA GmbH' && r1.coEn === 'WIKA GmbH');
  /* خارجی با هر دو نام → co=فارسی (کاربر خواسته) */
  vals = { nS2Comp: 'ویکا آلمان', nS2CoEn: 'WIKA GmbH', nS2Origin: 'خارجی', nS2Kind: 'حقوقی', nS2Cat: 'سایر', nS2Tel: '', nS2Web: '', nS2NatId: '', nS2Melli: '' };
  saveSup2(null);
  T('خارجی با هر دو: فارسی حفظ (اختیاری ولی محترم)', getData('ptf_crm_suppliers')[0].co === 'ویکا آلمان');
  /* داخلی بدون فارسی → رد مثل قبل */
  global._alerts = [];
  vals = { nS2Comp: '', nS2CoEn: 'X Co', nS2Origin: 'داخلی', nS2Kind: 'حقوقی', nS2Cat: 'سایر', nS2Tel: '', nS2Web: '', nS2NatId: '', nS2Melli: '' };
  saveSup2(null);
  T('داخلی بدون فارسی: رد مثل قبل (EN جبران نمی‌کند)', getData('ptf_crm_suppliers').length === 2 && global._alerts.some(function (a) { return a.indexOf('نام شرکت') > -1; }));
  /* بدون فیلد origin (fallback قدیمی) → مثل داخلی */
  vals = { nS2Comp: '', nS2CoEn: '', nS2Origin: '', nS2Kind: 'حقوقی', nS2Cat: 'سایر', nS2Tel: '', nS2Web: '', nS2NatId: '', nS2Melli: '' };
  global._alerts = [];
  saveSup2(null);
  T('origin خالی → رفتار داخلی (سازگاری)', global._alerts.some(function (a) { return a.indexOf('نام شرکت') > -1; }));
})();

SECTION('رگرسیون');
T('hook origin (nS2Origin — v13.4) پابرجا', ch.indexOf("'<option value=\"داخلی\"'") > -1 && ch.indexOf('rec.origin !== org') > -1);
T('hook چیپ تخصص (US-399) پابرجا', fs.readFileSync(path.join(BASE, 'supspec.js'), 'utf-8').indexOf('_spModalHooked') > -1);
T('dedup تامین‌کننده (ptfDupBlock) در مسیر ذخیره پابرجا', of.indexOf("ptfDupBlock === 'function' && ptfDupBlock('supplier', rec, cd)") > -1);
T('حقیقی/حقوقی (supKindToggle) دست‌نخورده', of.indexOf('function supKindToggle()') > -1);
T('smsBookSyncAll wrap روی saveSup2 (v16.7) سالم می‌ماند', fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8').indexOf("['saveCust2', 'saveSup2', 'supApprove']") > -1);

DONE('tester93-v175');
