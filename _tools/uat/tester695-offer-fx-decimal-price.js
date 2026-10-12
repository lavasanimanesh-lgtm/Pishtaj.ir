/* tester695 — قیمت واحد و نرخ مرجع ارزی در پیشنهاد مالی (اعشار دو رقمی)
   ریشه: گرد کردن صحیح (Math.round) در محاسبهٔ «نرخ مرجع × (1 + درصد)» باعث می‌شد
   نرخ مرجع زیر ۱ ارز (مثلاً 0.25 دلار با ۳۰٪) صفر شود. همچنین «٫» فارسی/عربی
   حذف می‌شد (۰٫۲۵ → 25) و فیلدهای ارزی بعد از خروج اعشار ثابت نداشتند.
   این تست توابع واقعی crm/offers.js، crm/moneyx.js و crm/offerlock.js را در یک
   محیط DOM شبیه‌سازی‌شده اجرا می‌کند و برای همهٔ ارزهای سند بررسی می‌کند. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
var CRM = path.join(root, 'crm');

var results = { pass: 0, fail: 0 };
function T(name, fn) {
  try { fn(); results.pass++; console.log('  ✔ ' + name); }
  catch (e) { results.fail++; console.log('  ✘ ' + name + ' — ' + e.message); }
}

/* ---------- محیط DOM حداقلی ---------- */
function makeEl(id) {
  return {
    id: id || '', value: '', innerHTML: '', textContent: '', style: {}, className: '', type: '',
    parentNode: null, nodeType: 1, _attrs: {},
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function (c) { return c; }, insertAdjacentHTML: function () {}, remove: function () {},
    closest: function () { return null; }, focus: function () {}, select: function () {},
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    setSelectionRange: function () {}, insertBefore: function (c) { return c; },
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} }
  };
}
function makeCtx() {
  var els = {};
  var docListeners = {};
  var document = {
    readyState: 'complete', body: makeEl('body'), documentElement: makeEl('html'), activeElement: null,
    getElementById: function (id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    createElement: function () { return makeEl(''); },
    querySelectorAll: function (sel) {
      var m = /\[id="([^"]+)"\]/.exec(String(sel || ''));
      return m && els[m[1]] ? [els[m[1]]] : [];
    },
    querySelector: function () { return null; },
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatch: function (t, ev) { (docListeners[t] || []).forEach(function (fn) { fn(ev); }); }
  };
  var store = { ptf_crm_products: [] };
  var ctx = {
    console: console, Date: Date, Math: Math, JSON: JSON, Intl: Intl, Number: Number, String: String,
    Array: Array, Object: Object, RegExp: RegExp, Error: Error, Set: Set, Map: Map, Promise: Promise,
    setTimeout: function (fn) { if (fn) fn(); return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    document: document, navigator: { userAgent: 'node', language: 'fa-IR' },
    location: { href: 'https://crm.local/', hostname: 'crm.local', protocol: 'https:' },
    localStorage: { _s: {}, getItem: function (k) { return this._s[k] == null ? null : this._s[k]; }, setItem: function (k, v) { this._s[k] = String(v); }, removeItem: function (k) { delete this._s[k]; } },
    alert: function () {}, confirm: function () { return true; }, prompt: function () { return null; },
    addLog: function () {}, audit: function () {}, ptfToast: function () {},
    faDate: function () { return '1405/07/20'; }, faDateTime: function () { return '1405/07/20 10:00'; },
    curSession: function () { return { name: 'tester', role: 'admin' }; },
    roleDef: function () { return { buyPrice: true }; },
    requestAnimationFrame: function (fn) { if (fn) fn(); return 0; },
    getComputedStyle: function () { return { display: 'block' }; },
    FileReader: function () {}, Event: function (t) { this.type = t; }, CustomEvent: function (t) { this.type = t; },
    XLSX: undefined, fetch: function () { return Promise.reject(new Error('no network')); }
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.addEventListener = function () {}; ctx.removeEventListener = function () {};
  ctx.escP = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  ctx.ptfOnClickArg = function (s) { return String(s == null ? '' : s); };
  ctx.getData = function (k) { return JSON.parse(JSON.stringify(store[k] || [])); };
  ctx.setData = function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); return true; };
  ctx.ptfEntitySaveCollection = ctx.setData;
  ctx.genCode = function () { return 'TST-1'; };
  ctx.__els = els;
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(CRM, file), 'utf8'), ctx, { filename: file });
}

var ctx = makeCtx();
['moneyx.js', 'offers.js', 'offers-pro.js', 'offerlock.js'].forEach(function (f) { load(ctx, f); });

var CURS = ['IRR', 'EUR', 'USD', 'CNY', 'AED', 'GBP'];
var MARGIN = 30;
function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function expected(cur, v) { return cur === 'IRR' ? Math.round(v) : r2(v); }
function cfg(cur) { return ctx.PTF_CURRENCIES.filter(function (c) { return c.id === cur; })[0]; }
function setState(cur, refP) {
  ctx._offState = { kind: 'CO', no: 'PRF-1', currency: cur, fxBasis: '',
    items: [{ name: 'Pipe', qty: 2, unit: 'NO', price: 0, refPrice: refP || 0 }] };
}
ctx.document.getElementById('ofGlobalMargin').value = String(MARGIN);

console.log('\n== ۱) محاسبهٔ قیمت فروش از نرخ مرجع و درصد، برای همهٔ ارزها ==');
var REFS = [0.25, 0.8, 1.37, 12.5, 999.99];
CURS.forEach(function (cur) {
  var refs = cur === 'IRR' ? [25000, 1234567] : REFS;
  refs.forEach(function (ref) {
    var exp = expected(cur, ref * (1 + MARGIN / 100));
    T(cur + ' ref=' + ref + ' | حاشیه سراسری ' + MARGIN + '٪ → ' + exp, function () {
      setState(cur, 0); ctx.offUpdRefPrice(0, String(ref)); ctx.offApplyGlobalMargin();
      assert.strictEqual(ctx._offState.items[0].price, exp);
    });
    T(cur + ' ref=' + ref + ' | درصد ردیفی ' + MARGIN + '٪ → ' + exp, function () {
      setState(cur, 0); ctx.offUpdRefPrice(0, String(ref)); ctx.offUpdMarginPct(0, String(MARGIN));
      assert.strictEqual(ctx._offState.items[0].price, exp);
    });
    T(cur + ' ref=' + ref + ' | ضریب سود گروهی ' + MARGIN + '٪ → ' + exp, function () {
      setState(cur, 0); ctx.offApplyProfitMarginToRow(0, ref, MARGIN);
      assert.strictEqual(ctx._offState.items[0].price, exp);
    });
  });
});

T('یوآرو: نرخ مرجع 0.25 دلار با ۳۰٪ → 0.33 (نه صفر)', function () {
  setState('USD', 0); ctx.offUpdRefPrice(0, '0.25'); ctx.offUpdMarginPct(0, '30');
  assert.strictEqual(ctx._offState.items[0].price, 0.33);
});

console.log('\n== ۲) تایپ مستقیم قیمت و نرخ مرجع ==');
CURS.filter(function (c) { return c !== 'IRR'; }).forEach(function (cur) {
  T(cur + ': تایپ "0.45" در قیمت واحد → 0.45 و نمایش "0.45"', function () {
    setState(cur, 0); ctx.offUpdItem(0, 'price', '0.45');
    assert.strictEqual(ctx._offState.items[0].price, 0.45);
    assert.strictEqual(ctx.offMoneyText(0.45, cfg(cur)), '0.45');
  });
  T(cur + ': تایپ "1234.567" → گرد به دو رقم (1234.57)', function () {
    setState(cur, 0); ctx.offUpdItem(0, 'price', '1234.567');
    assert.strictEqual(ctx._offState.items[0].price, 1234.57);
  });
  T(cur + ': نمایش ۱۲۳۴٫۵ → "1,234.50"', function () {
    assert.strictEqual(ctx.offMoneyText(1234.5, cfg(cur)), '1,234.50');
  });
  T(cur + ': نرخ مرجع تایپ‌شده "0.8" → 0.8 و نمایش "0.80"', function () {
    setState(cur, 0); ctx.offUpdRefPrice(0, '0.8');
    assert.strictEqual(ctx._offState.items[0].refPrice, 0.8);
    assert.strictEqual(ctx.offMoneyText(0.8, cfg(cur)), '0.80');
  });
});
T('ریال: تایپ قیمت به عدد صحیح و بدون اعشار نمایش داده می‌شود', function () {
  setState('IRR', 0); ctx.offUpdItem(0, 'price', '1234567');
  assert.strictEqual(ctx._offState.items[0].price, 1234567);
  assert.strictEqual(ctx.offMoneyText(1234567, cfg('IRR')), '1,234,567');
});

console.log('\n== ۳) جداکنندهٔ اعشار فارسی/عربی «٫» ==');
T('ptfNum("۰٫۲۵") = 0.25 (قبلاً 25)', function () { assert.strictEqual(ctx.ptfNum('۰٫۲۵'), 0.25); });
T('ptfNum("0٫25") = 0.25', function () { assert.strictEqual(ctx.ptfNum('0٫25'), 0.25); });
CURS.forEach(function (cur) {
  T(cur + ': تایپ «۰٫۲۵» در قیمت → 0.25', function () {
    setState(cur, 0); ctx.offUpdItem(0, 'price', '۰٫۲۵');
    assert.strictEqual(ctx._offState.items[0].price, cur === 'IRR' ? 0.25 : 0.25);
  });
});
T('ورودی زنده: «٫» به «.» تبدیل می‌شود', function () {
  var el = makeEl('off_price_0'); el.value = '۰٫۵'; el.type = 'text';
  el._attrs['data-money'] = '1';
  ctx.document.dispatch('input', { target: el });
  assert.strictEqual(el.value, '0.5');
});

console.log('\n== ۴) اعشار ثابت بعد از خروج از فیلد (data-decimals) ==');
CURS.filter(function (c) { return c !== 'IRR'; }).forEach(function (cur) {
  T(cur + ': بعد از blur، "0.5" → "0.50"', function () {
    var el = makeEl('off_price_0');
    el._attrs = { 'data-money': '1', 'data-words': '1', 'data-decimals': '2' };
    el.value = '0.5';
    ctx.document.dispatch('focusout', { target: el });
    assert.strictEqual(el.value, '0.50');
  });
});
T('ریال: فیلد بدون data-decimals بعد از blur تغییر نمی‌کند (رفتار قبلی)', function () {
  var el = makeEl('off_price_0');
  el._attrs = { 'data-money': '1', 'data-words': '1' };
  el.value = '0.5';
  ctx.document.dispatch('focusout', { target: el });
  assert.strictEqual(el.value, '0.5');
});

console.log('\n== ۵) کیبورد و جدول پیشنهاد ==');
function renderedInput(cur, id) {
  ctx._offState = { kind: 'CO', no: 'P', currency: cur, items: [{ name: 'x', qty: 1, unit: 'NO', price: 0.25, refPrice: 0.25, desc: '' }] };
  var wrap = ctx.document.getElementById('offItemsWrap'); wrap.innerHTML = '';
  ctx.offRenderItems();
  var m = new RegExp('<input[^>]*id="' + id + '"[^>]*>').exec(wrap.innerHTML);
  return m ? m[0] : '';
}
CURS.forEach(function (cur) {
  T(cur + ': ورودی قیمت واحد در جدول رندر می‌شود و کیبورد مناسب دارد', function () {
    var tag = renderedInput(cur, 'off_price_0');
    assert.ok(tag, 'price input not rendered');
    if (cur === 'IRR') assert.ok(/inputmode="numeric"/.test(tag) && !/data-decimals/.test(tag), tag);
    else assert.ok(/inputmode="decimal"/.test(tag) && /data-decimals="2"/.test(tag), tag);
  });
});

console.log('\n== ۶) یکپارچگی ساختاری (جلوگیری از بازگشت باگ) ==');
var offers = fs.readFileSync(path.join(CRM, 'offers.js'), 'utf8');
T('هیچ «Math.round(X * (1 + درصد))» برای قیمت فروش باقی نمانده', function () {
  assert.ok(!/Math\.round\((refP|it\.refPrice|basePrice|bP|refV) \* \(1 \+/.test(offers));
});
T('offRoundPrice/offTypedAmount در offers.js تعریف شده‌اند', function () {
  assert.ok(/window\.offRoundPrice = function/.test(offers) && /window\.offTypedAmount = function/.test(offers));
});

console.log('\n=== tester695-offer-fx-decimal-price: ' + results.pass + ' PASS / ' + results.fail + ' FAIL ===');
process.exit(results.fail ? 1 : 0);
