/* =====================================================================
   tester675-v34.39.21-ui-stability-price-modal-tabs.js
   قرارداد UI-STABILITY (v34.39.22) — ریشه‌یابی و رفع ریشه‌ای دو باگ UI:

   ① «در پنجره ثبت قیمت در قسمت تامین اینقدر لغزش و پرش و ناپایداری وجود دارد»
      سه مکانیزم (با اجرای کد واقعی):
      (a) moneyx hint «مبلغ به حروف» داخل ردیف flex/grid به آیتم جریانی تبدیل
          می‌شد و با هر keystroke (رشد متن حروفی) فیلدهای کناری می‌لغزیدند/سطر
          می‌شکست → رفع: hint تک‌خطه (nowrap+ellipsis) + خط اختصاصی در flex/grid.
      (b) تبدیل ارقام فا/ع در input handler مقدار را بدون setSelectionRange
          می‌نوشت → پرش مکان‌نما (شکایت مستند «۱۵ ← ۵۱» ui-kit/US-438) → رفع:
          حفظ مکان‌نما (نگاشت ۱:۱).
      (c) بعد از هر «ثبت قیمت‌ها»، همهٔ md-b های visible حذف و کل مودال مقایسه
          destroy/recreate می‌شد → فلش/پرش کل پنجره → رفع: cmpInnerHtml مشترک +
          cmpRefreshModal با حفظ scrollTop (fallback به cmpOpen).
      + rfqsmart: blur فیلد قیمت، ۱۲۰ms بعد کل آکاردئون را حتی وسط تایپ در
        «تحویل (روز)» بازسازی می‌کرد → نگهبان containment آکاردئون.

   ② «با جابه‌جایی روی تب‌ها بعضی چیزها مثل فیلتر بعدا لود می‌شوند و پرش می‌دهند»
      ریشه: listtools فقط با setInterval(1200) دکمهٔ «🧰 فیلتر و خروجی» را تزریق
      می‌کرد → تا ۱٫۲s پس از تعویض تب، نوار فیلتر بدون دکمه بود و بعد ناگهان
      appendChild می‌شد → reflow = پرش. + باکس‌های تنظیمات با setTimeout 100-150ms
      پر می‌شدند. رفع: تزریق هم‌زمان + MutationObserver (پیش از paint) +
      ptfListToolsInject + رزرو min-height باکس‌های تنظیمات.

   اجرا: node _tools/uat/tester675-v34.39.21-ui-stability-price-modal-tabs.js
   خروجی: 0 = همه‌چیز سبز؛ 1 = حداقل یک FAIL.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function resolveP(p) { return path.join(ROOT, p); }

var failures = 0;
function test(name, ok, extra) {
  if (ok) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name + (extra ? ' — ' + extra : ''));
}

/* ---------- loadContext: کمینهٔ قابلاتکا (هم‌سبک tester-finance-helpers) ---------- */
function loadContext(file, extra) {
  var listeners = {};
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array,
    String: String, Number: Number, isFinite: isFinite, RegExp: RegExp, Error: Error,
    parseInt: parseInt, parseFloat: parseFloat,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    Promise: Promise, navigator: { userAgent: 'node', onLine: true }, location: { href: 'http://localhost/', hash: '' },
    MutationObserver: function () { this.observe = function () {}; },
    getComputedStyle: function () { return { display: 'block' }; },
    alert: function () {}, confirm: function () { return true; }, prompt: function () { return '0'; },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    ptfApiAuthHeaders: function () { return {}; }, ptfApiBase: function () { return '../api/crm.php'; },
    ptfToast: function () {}, hideModal: function () {},
    escP: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    ptfOnClickArg: function (s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); },
    faDate: function () { return '1405/07/02'; }, faDateTime: function () { return '1405/07/02 12:00'; },
    curSession: function () { return { name: 't675', role: 'Admin', username: 't675' }; },
    genCode: function (p) { return p + '-T675'; },
    audit: function () {}, notify: function () {}, canBuy: function () { return true; },
    getData: function (key) { return key === 'ptf_crm_buycmp' ? (sb._seedBuyCmp || []).slice() : []; },
    setData: function () {}, ptfEntitySaveCollection: function () {}
  };
  sb.window = sb; sb.self = sb; sb.global = sb;
  sb.document = {
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    getElementById: function () { return null; },
    createElement: function () { return { style: {}, textContent: '', className: '', setAttribute: function () {}, appendChild: function () {} }; },
    body: { appendChild: function () {} }, documentElement: { style: {} }, readyState: 'complete', activeElement: null,
    _fire: function (t, ev) { (listeners[t] || []).forEach(function (fn) { fn(ev); }); }
  };
  if (extra) Object.keys(extra).forEach(function (k) { sb[k] = extra[k]; });
  vm.createContext(sb);
  vm.runInContext(read(file), sb, { filename: file });
  return sb;
}

var moneyxSrc = read('crm/moneyx.js');
var buycompareSrc = read('crm/buycompare.js');
var rfqsmartSrc = read('crm/rfqsmart.js');
var listtoolsSrc = read('crm/listtools.js');
var indexHtml = read('crm/index.html');
var swSrc = read('crm/sw.js');
var gateSrc = read('_tools/uat/run-ci-gate.js');
var tester674Src = read('_tools/uat/tester674-v34.39.20-restore-tombstone-rekill.js');

console.log('── A: moneyx — لغزش/پرش حین تایپ قیمت ──');
test('A1: hint «مبلغ به حروف» تک‌خطه با ellipsis است (رشد متن per-keystroke بدون reflow)',
  /white-space:\s*nowrap/.test(moneyxSrc) && /text-overflow:\s*ellipsis/.test(moneyxSrc));
test('A2: hint در والد flex-row به خط اختصاصی می‌رود (flex:1 0 100% + flex-wrap) و در grid: grid-column',
  moneyxSrc.indexOf("h.style.flex = '1 0 100%'") > -1 && moneyxSrc.indexOf("flexWrap = 'wrap'") > -1 && moneyxSrc.indexOf("gridColumn = '1 / -1'") > -1);
test('A3: hint pointer-events:none دارد (هرگز کلیک/لمس نمی‌دزدد)',
  /pointer-events:\s*none/.test(moneyxSrc));
test('A4: حفظ کرسر در تبدیل ارقام فا/ع (setSelectionRange پس از بازنویسی مقدار)',
  (function () {
    var listeners = {};
    var el = null;
    var sb = {
      console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array,
      String: String, Number: Number, isFinite: isFinite, RegExp: RegExp,
      setTimeout: function () { return 0; }, clearTimeout: function () {},
      getComputedStyle: function () { return { display: 'block' }; }
    };
    sb.window = sb; sb.self = sb;
    var doc = {
      addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener: function () {},
      querySelectorAll: function () { return []; }, querySelector: function () { return null; },
      getElementById: function () { return null; },
      createElement: function () { return { style: {}, textContent: '', className: '' }; },
      readyState: 'complete', activeElement: null, body: {}
    };
    sb.document = doc;
    vm.createContext(sb);
    vm.runInContext(moneyxSrc, sb, { filename: 'moneyx.js' });
    el = {
      tagName: 'INPUT', id: 'xPrice', className: '', type: 'text', value: '۱2۳',
      selectionStart: 1, selectionEnd: 1, readOnly: false,
      getAttribute: function (k) { return k === 'inputmode' ? 'numeric' : null; },
      setSelectionRange: function (a, b) { this.selectionStart = a; this.selectionEnd = b; },
      parentNode: null, nextElementSibling: null
    };
    doc.activeElement = el;
    (listeners['input'] || []).forEach(function (fn) { fn({ target: el }); });
    return el.value === '123' && el.selectionStart === 1 && el.selectionEnd === 1;
  })());
test('A5: reformat زندهٔ data-money کامای هزارگان می‌گذارد و مکان‌نما را بعد از همان تعداد رقم نگه می‌دارد',
  (function () {
    var listeners = {};
    var parent = {
      nodeType: 1, style: {},
      insertBefore: function (h) { h.parentNode = parent; parent.hint = h; }
    };
    var el = {
      tagName: 'INPUT', id: 'cmpP0', className: '', type: 'text', value: '12345',
      selectionStart: 5, selectionEnd: 5, readOnly: false,
      _m: { 'data-money': '1' },
      getAttribute: function (k) { return this._m[k] !== undefined ? this._m[k] : null; },
      hasAttribute: function (k) { return this._m[k] !== undefined; },
      setSelectionRange: function (a, b) { this.selectionStart = a; this.selectionEnd = b; },
      parentNode: parent, nextElementSibling: null
    };
    var sb = {
      console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array,
      String: String, Number: Number, isFinite: isFinite, RegExp: RegExp,
      setTimeout: function () { return 0; }, clearTimeout: function () {},
      getComputedStyle: function () { return { display: 'block' }; }
    };
    sb.window = sb; sb.self = sb;
    var doc = {
      addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener: function () {},
      querySelectorAll: function () { return []; }, querySelector: function () { return null; },
      getElementById: function () { return null; },
      createElement: function () { return { style: {}, textContent: '', className: '' }; },
      readyState: 'complete', activeElement: el, body: {}
    };
    sb.document = doc;
    vm.createContext(sb);
    vm.runInContext(moneyxSrc, sb, { filename: 'moneyx.js' });
    (listeners['input'] || []).forEach(function (fn) { fn({ target: el }); });
    /* '12345' → '12,345' با ۵ رقم قبل از کرسر = انتها (طول ۶) */
    return el.value === '12,345' && el.selectionStart === 6;
  })());
test('A6: در ردیف flex، hint به خط اختصاصی می‌رود و با مقدار ≥۱۰۰۰ پایدار می‌ماند (display باز)',
  (function () {
    var listeners = {};
    var parent = {
      nodeType: 1, style: {},
      insertBefore: function (h) { h.parentNode = parent; parent.hint = h; }
    };
    var el = {
      tagName: 'INPUT', id: 'cmpP1', className: '', type: 'text', value: '2500000',
      selectionStart: 7, selectionEnd: 7, readOnly: false,
      _m: { 'data-money': '1' },
      getAttribute: function (k) { return this._m[k] !== undefined ? this._m[k] : null; },
      hasAttribute: function (k) { return this._m[k] !== undefined; },
      setSelectionRange: function (a, b) { this.selectionStart = a; this.selectionEnd = b; },
      parentNode: parent, nextElementSibling: null
    };
    var sb = {
      console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array,
      String: String, Number: Number, isFinite: isFinite, RegExp: RegExp,
      setTimeout: function () { return 0; }, clearTimeout: function () {},
      getComputedStyle: function () { return { display: 'flex' }; }
    };
    sb.window = sb; sb.self = sb;
    var doc = {
      addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener: function () {},
      querySelectorAll: function () { return []; }, querySelector: function () { return null; },
      getElementById: function () { return null; },
      createElement: function () { return { style: {}, textContent: '', className: '' }; },
      readyState: 'complete', activeElement: el, body: {}
    };
    sb.document = doc;
    vm.createContext(sb);
    vm.runInContext(moneyxSrc, sb, { filename: 'moneyx.js' });
    (listeners['input'] || []).forEach(function (fn) { fn({ target: el }); });
    var h = parent.hint;
    return !!(h && h.style.flex === '1 0 100%' && parent.style.flexWrap === 'wrap' &&
      /nowrap/.test(h.style.cssText || '') && h.style.display === '' &&
      /ریال/.test(h.textContent || ''));
  })());

console.log('\n── B: buycompare — پرش/فلش کل پنجره بعد از هر ثبت قیمت ──');
test('B1: سازندهٔ مشترک cmpInnerHtml + نوساز درجای cmpRefreshModal تعریف شده‌اند',
  buycompareSrc.indexOf('window.cmpInnerHtml = function') > -1 && buycompareSrc.indexOf('window.cmpRefreshModal = function') > -1);
test('B2: cmpQuoteSave دیگر همهٔ md-b های visible را نمی‌کشد (حذف kill-all)',
  (function () {
    var i = buycompareSrc.indexOf('window.cmpQuoteSave');
    var seg = buycompareSrc.slice(i, i + 1600);
    return seg.indexOf('cmpRefreshModal') > -1 && !/querySelectorAll\('\\.md-b'\)\s*\.forEach/.test(seg);
  })());
test('B3: هر ۴ مسیر ثبت/حذف (cmpQuoteSave / cmpBuy / cmpSplitSave / cmpBulkBuyGo) از refresh درجا می‌آیند و oldCmp.remove() ندارند',
  (function () {
    function seg(fnName, len) { var i = buycompareSrc.indexOf(fnName); return i < 0 ? '' : buycompareSrc.slice(i, i + (len || 12000)); }
    var s1 = seg('window.cmpQuoteSave'), s2 = seg('window.cmpBuy ='), s3 = seg('window.cmpSplitSave'), s4 = seg('window.cmpBulkBuyGo');
    var ok = [s1, s2, s3, s4].every(function (s) { return s.indexOf('cmpRefreshModal') > -1; });
    var noKill = [s2, s3, s4].every(function (s) { return s.indexOf("oldCmp.remove()") < 0; });
    return ok && noKill;
  })());
test('B4: cmpOpen از همان cmpInnerHtml استفاده می‌کند (تک سازنده — refresh و بازکردن یکسان)',
  (function () {
    var i = buycompareSrc.indexOf('window.cmpOpen = function');
    var seg = buycompareSrc.slice(i, i + 700);
    return seg.indexOf('cmpInnerHtml(id, locked)') > -1 && seg.indexOf('insertAdjacentHTML') > -1;
  })());
test('B5 (رفتاری): cmpRefreshModal بدون مودالِ باز false برمی‌گرداند (fallback به cmpOpen) و cmpInnerHtml رکورد ناشناخته را «» می‌دهد',
  (function () {
    try {
      var sb = loadContext('crm/buycompare.js');
      sb._seedBuyCmp = [{ id: 'C1', inqNo: 'INQ-T675', items: [{ nm: 'قلم تست', qty: 2, un: 'عدد' }], quotes: [], purchases: [], t: '1405/07/02', by: 't675' }];
      var empty = sb.cmpInnerHtml('NOPE', false);
      var html = sb.cmpInnerHtml('C1', false);
      var refreshNone = sb.cmpRefreshModal('C1');
      return empty === '' && typeof html === 'string' &&
        html.indexOf('مقایسه قیمت خرید') > -1 && html.indexOf('قلم تست') > -1 &&
        html.indexOf('cmpAddQuote(') > -1 && html.indexOf('قیمت دور') > -1 && refreshNone === false;
    } catch (e) { return false; }
  })());

console.log('\n── C: rfqsmart — رندر مجدد وسط تایپ جدول ثبت قیمت‌ها ──');
test('C1: rfqsPriceBlur با نگهبان containment آکاردئون، وسط تایپ در «تحویل (روز)» بازسازی نمی‌کند',
  (function () {
    var i = rfqsmartSrc.indexOf('window.rfqsPriceBlur');
    var seg = rfqsmartSrc.slice(i, i + 900);
    return seg.indexOf('rfqAcc_') > -1 && seg.indexOf('acc.contains(ae)') > -1;
  })());

console.log('\n── D: listtools/تنظیمات — فیلتر دیرلود + پرش بعد از تعویض تب ──');
test('D1: window.ptfListToolsInject برای تزریق هم‌زمان export شده',
  listtoolsSrc.indexOf('window.ptfListToolsInject = injectButtons') > -1);
test('D2: MutationObserver روی #panels ثبت شده (تزریق پیش از اولین paint)',
  listtoolsSrc.indexOf('MutationObserver') > -1 && listtoolsSrc.indexOf("mo.observe(panelsRoot") > -1);
test('D3: بازهٔ ۱۲۰۰ms فقط تور ایمنی idempotent مانده (نه مسیر اصلی)',
  /setInterval\(function \(\) \{ try \{ injectButtons\(\); \}/.test(listtoolsSrc));
test('D4 (رفتاری): تزریق دکمهٔ «🧰 فیلتر و خروجی» idempotent است (بدون رودهٔ تکراری)',
  (function () {
    try {
      var appended = [];
      var target = {
        querySelector: function (sel) { return (sel === '.lt-btn' && appended.length) ? appended[0] : null; },
        appendChild: function (b) { appended.push(b); }
      };
      var sbExtra = {
        setInterval: function () { return 0; },
        MutationObserver: function () { this.observe = function () {}; }
      };
      var sb = loadContext('crm/listtools.js', sbExtra);
      /* document سفارشی برای injectButtons */
      sb.document.querySelector = function (sel) { return sel === '#sSrch' ? { parentElement: target } : null; };
      sb.document.getElementById = function (id) { return id === 'panels' ? { id: 'panels' } : null; };
      sb.document.createElement = function () { return { className: '', style: { cssText: '' }, textContent: '', onclick: null }; };
      sb.ptfListToolsInject();
      sb.ptfListToolsInject();
      return appended.length === 1 && appended[0].textContent === '🧰 فیلتر و خروجی' &&
        String(appended[0].className).indexOf('lt-btn') > -1;
    } catch (e) { return false; }
  })());
test('D5: باکس‌های تنظیمات (arvanBox/llmBox/sessionsBox/engineGateBox) ارتفاع رزرو دارند (پر شدن دیرهنگام بی‌پرش)',
  (function () {
    function hasMin(id) {
      var i = indexHtml.indexOf('id="' + id + '"');
      return i > -1 && indexHtml.slice(i, i + 90).indexOf('min-height') > -1;
    }
    return hasMin('arvanBox') && hasMin('llmBox') && hasMin('sessionsBox') && hasMin('engineGateBox');
  })());

console.log('\n── E: پین‌های انتشار ──');
test('E1: VERSION.json crm_version = v34.39.22', (function () {
  try { return JSON.parse(read('VERSION.json')).crm_version === 'v34.39.22'; } catch (e) { return false; }
})());
test('E2: Service Worker + PTF_CRM_RELEASE/VER بامپ شده‌اند',
  swSrc.indexOf('v34.39.22') > -1 && indexHtml.indexOf("window.PTF_CRM_RELEASE = 'v34.39.22'; window.VER = 'v34.39.22';") > -1);
test('E3: پین‌های tester674/tester621 به نسخهٔ جدید به‌روز شده‌اند',
  tester674Src.indexOf("'v34.39.22'") > -1 && read('_tools/uat/tester621-v34.38.14-archive-uniqueness-restore.js').indexOf("'v34.39.22'") > -1);
test('E4: تستر در گیت CI ثبت است',
  gateSrc.indexOf('tester675-v34.39.21-ui-stability-price-modal-tabs.js') > -1);

console.log('');
if (failures) { console.log('=== tester675: ' + failures + ' FAIL ==='); process.exit(1); }
console.log('PASS tester675-v34.39.21-ui-stability-price-modal-tabs');
