#!/usr/bin/env node
'use strict';
/* v34.8.47 — BUG-OFFER-VALIDITY-001
   رگرسیون رفتاری: تزریق ارز در مودال پیشنهاد مالی نباید فیلد تاریخ اعتبار
   (#ofValidJ) را با innerHTML حذف کند. همچنین قرارداد ذخیره validUntil و
   یادآور انقضا باید برقرار بماند. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail === undefined ? '' : detail); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var offers = read('crm/offers.js');
var pro = read('crm/offers-pro.js');
var bridge = read('crm/bridge.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('نسخه رسمی v34.8.47 است', ver.crm_version === 'v34.8.47', ver.crm_version);
T('index و service worker روی v34.8.47 هستند',
  idx.indexOf("window.PTF_CRM_RELEASE = 'v34.8.47'") > -1 &&
  sw.indexOf("RELEASE = 'v34.8.47'") > -1);
T('cache-bust هر دو فایل فرم تازه شده است',
  idx.indexOf('offers.js?v=34.8.47') > -1 && idx.indexOf('offers-pro.js?v=34.8.47') > -1);

T('فیلد تاریخ اعتبار در فرم مالی/فنی‌مالی رندر می‌شود',
  offers.indexOf("o.kind !== 'TO'") > -1 && offers.indexOf("ptfDatePicker('ofValidJ'") > -1);
T('اعتبار پیش‌فرض هفت روز بعد از تاریخ سند حفظ شده است',
  /function defaultValidity\([\s\S]{0,350}setDate\(d\.getDate\(\) \+ 7\)/.test(offers));
var matBlock = offers.slice(offers.indexOf('function offMaterializeCurrentDocument()'), offers.indexOf('function offerPreview()'));
var saveBlock = offers.slice(offers.indexOf('function offerSave()'), offers.indexOf('window.offerSave = offerSave'));
T('materialize مقدار ofValidJ را به validUntil می‌برد', /o\.validUntil\s*=\s*[^;\n]*ofValidJ/.test(matBlock));
T('ذخیره نهایی مقدار ofValidJ را به validUntil می‌برد', /o\.validUntil\s*=\s*[^;\n]*ofValidJ/.test(saveBlock));
T('یادآور سه‌روزه انقضا برقرار است',
  bridge.indexOf('function checkOfferExpiry()') > -1 &&
  bridge.indexOf('3 * 86400000') > -1 && bridge.indexOf('o.validUntil <= warn') > -1);

T('تزریق ارز دیگر innerHTML فیلد اعتبار را بازنویسی نمی‌کند',
  pro.indexOf('fld.innerHTML = selHtml') === -1);
T('تزریق ارز ردیف مستقل و hook رفتاری نام‌دار دارد',
  pro.indexOf('offer-currency-row') > -1 &&
  pro.indexOf('window.ptfOfferInjectCurrencyField = injectCurrencyField;') > -1);

/* اجرای واقعی injectCurrencyField با DOM حداقلی: همان سناریویی که قبلاً
   #ofValidJ را ۵۰ میلی‌ثانیه بعد از بازشدن مودال حذف می‌کرد. */
try {
  var inserted = [];
  var validityField = {
    innerHTML: '<label>تاریخ اعتبار</label><input id="ofValidJ">',
    querySelector: function () { return null; }
  };
  var validityRow = {
    /* شبیه‌سازی دقیق selector قدیمی؛ نسخه معیوب همین field را بازنویسی می‌کرد. */
    querySelector: function (selector) { return selector === '.fld:last-child' ? validityField : null; },
    insertAdjacentHTML: function (where, html) { inserted.push({ where: where, html: html }); }
  };
  var validityInput = {
    value: '1405/06/08',
    closest: function (selector) { return selector === '.fr' ? validityRow : null; }
  };
  var ids = { ofValidJ: validityInput };
  var dateFallbackTouched = false;
  var sandbox = {
    console: console,
    window: null,
    document: {
      getElementById: function (id) {
        if (id === 'ofDateJ') dateFallbackTouched = true;
        return ids[id] || null;
      },
      createElement: function () { return {}; },
      body: { appendChild: function () {} }
    },
    _offState: { kind: 'CO', currency: 'IRR' },
    setTimeout: function () {},
    clearTimeout: function () {},
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    URL: { createObjectURL: function () { return ''; }, revokeObjectURL: function () {} },
    Blob: function () {},
    JSON: JSON,
    String: String,
    Number: Number,
    Math: Math,
    Date: Date
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(pro, sandbox, { filename: 'crm/offers-pro.js' });
  T('hook تزریق ارز در runtime قابل فراخوانی است', typeof sandbox.ptfOfferInjectCurrencyField === 'function');

  sandbox.ptfOfferInjectCurrencyField();
  T('DOM: مقدار و محتوای فیلد اعتبار دست‌نخورده ماند',
    validityInput.value === '1405/06/08' &&
    validityField.innerHTML.indexOf('ofValidJ') > -1);
  T('DOM: ردیف ارز و نرخ پس از ردیف اعتبار اضافه شد',
    inserted.length === 1 && inserted[0].where === 'afterend' &&
    inserted[0].html.indexOf('id="ofCurrency"') > -1 &&
    inserted[0].html.indexOf('id="ofFxWrap"') > -1,
    JSON.stringify(inserted));
  T('DOM: با وجود ofValidJ مسیر fallback تاریخ سند اجرا نشد', !dateFallbackTouched);

  /* پس از درج واقعی، مرورگر ofCurrency را پیدا می‌کند و اجرای دوم باید no-op باشد. */
  ids.ofCurrency = { value: 'IRR' };
  sandbox.ptfOfferInjectCurrencyField();
  T('DOM: تزریق idempotent است و ارز تکراری نمی‌سازد', inserted.length === 1);
} catch (e) {
  T('سناریوی رفتاری DOM بدون خطا اجرا شد', false, e && e.stack || String(e));
}

T('tester500 در گیت CI ثبت شده است', gate.indexOf('tester500-v34.7.99-offer-validity-visible.js') > -1);
console.log('\n— tester500 (v34.8.47: نمایش پایدار تاریخ اعتبار پیشنهاد) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
