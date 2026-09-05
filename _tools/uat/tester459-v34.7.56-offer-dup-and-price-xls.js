#!/usr/bin/env node
'use strict';
/* v34.37.2 — BUG-OFFER-DUP-SKIP-267:
   درخواست واقعی می‌تواند چند ردیف هم‌محتوا داشته باشد (۲۶۷ ردیف، ۶ ردیف هم‌امضا).
   قبلاً هر سه لایه (offAppendInqRows / offSmartInsert / offDedupeOfferItems) با امضای
   محتوایی حذفشان می‌کردند. حالا «تکراری» = همان ردیفِ مبدأ (هویت + نوبت تکرار).
   + ورود قیمت (نرخ مرجع/قیمت واحد) از اکسل برای اقلام موجود. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var off = read('crm/offers.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.37.2', ver.crm_version === 'v34.37.2', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.37.2', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.37.2'") > -1);
T('sw RELEASE = v34.37.2', sw.indexOf("RELEASE = 'v34.37.2'") > -1);
T('offers.js cache-bust 34.37.2', idx.indexOf('offers.js?v=34.37.2') > -1);

/* ---------- قراردادهای ایستا ---------- */
T('نشان BUG-OFFER-DUP-SKIP-267 ثبت شده', off.indexOf('BUG-OFFER-DUP-SKIP-267') > -1);
T('offSmartInsert پارامتر force دارد و مسیر قدیمی حفظ است', off.indexOf('window.offSmartInsert = function (item, force)') > -1 && off.indexOf('if (!force) {') > -1 && off.indexOf('_keyFn(_offState.items[e]) === key') > -1);
T('offAppendInqRows با force درج می‌کند', off.indexOf('offSmartInsert(item, true)') > -1);
T('offDedupeOfferItems هویت خط را در کلید دارد', off.indexOf("var ident = it.id ? 'id:' + it.id") > -1 && off.indexOf("'src:' + it.sourceInq + '|' + it.sourceItemKey + '|' + (+it.dupOrdinal || 0)") > -1);
T('offAddItem دستی همچنان بدون force است (حفاظت تکرار دستی)', /window\.offSmartInsert\(item\)(?!, ?true)/.test(off));
T('دکمه قیمت از اکسل در فرم', off.indexOf('offPriceXlsOpen()') > -1 && off.indexOf('💰 قیمت از اکسل') > -1);
T('توابع قالب/ورود قیمت تعریف شده‌اند', off.indexOf('window.offPriceXlsTemplate = function') > -1 && off.indexOf('window.offPriceXlsImport = function') > -1 && off.indexOf('function offPriceXlsApply') > -1);
T('ورود قیمت اقلام جدید نمی‌سازد (فقط تطبیق)', off.indexOf('nextByPredicate') > -1 && off.slice(off.indexOf('function offPriceXlsApply')).indexOf('offSmartInsert') === -1);
T('tester459 در گیت CI', gate.indexOf('tester459-v34.7.56-offer-dup-and-price-xls.js') > -1);

/* ---------- سناریوی رفتاری: ردیف‌های هم‌محتوای یک درخواست ---------- */
function makeSandbox() {
  var state = { inqNo: '', items: [], kind: 'CO' };
  var sb = {
    console: console, JSON: JSON, Math: Math, String: String, Number: Number, Array: Array, Object: Object, Date: Date,
    document: { getElementById: function () { return null; }, body: { insertAdjacentHTML: function () {} } },
    alert: function () {}, ptfToast: function () {}, audit: function () {},
    getData: function () { return []; }, setData: function () { return true; },
    offRenderItems: function () {},
    ptfAutoRegisterSummaryProducts: function () {},
    ptfIntelligentParseItem: function () {},
    ptfItemRefPrice: function () { return null; },
    ptfProcLineKey: function (it) { /* مثل procurement-link: کلید محتوایی بدون qty — عمداً برای هم‌امضاها یکسان */
      return 'S:' + [it.nm || it.name || '', it.model || it.md || '', it.st || it.spec || it.desc || '', it.un || it.unit || ''].join('|');
    },
    _offState: state
  };
  sb.window = sb;
  vm.createContext(sb);
  function cut(a, b) {
    var i = off.indexOf(a), j = off.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error('ناحیه پیدا نشد: ' + a);
    return off.slice(i, j);
  }
  vm.runInContext(cut('// ---- v31.7.97 BUG-OFFER-DUP-ITEMS-001', 'function prodSrchRender()'), sb, { filename: 'offers.js#dup' });
  return sb;
}

try {
  var sb = makeSandbox();
  /* درخواست با ۴ ردیف: دو ردیف کاملاً هم‌محتوا (تگ‌های مختلف) + دو ردیف عادی */
  var rows = [
    { nm: 'گسکت اسپیرال', st: '2" CL300', un: 'عدد', qty: 10 },
    { nm: 'گسکت اسپیرال', st: '2" CL300', un: 'عدد', qty: 10 },
    { nm: 'فلنج گلودار', st: '4" CL150', un: 'عدد', qty: 2 },
    { nm: 'شیر توپی', st: '1" CL800', un: 'عدد', qty: 5 }
  ];
  var r1 = sb.offAppendInqRows('REQ-267', rows, { keepInq: true });
  T('بار اول: هر ۴ ردیف اضافه می‌شود (هم‌محتواها رد نمی‌شوند)', r1.added === 4 && r1.skipped === 0, JSON.stringify(r1));
  T('نوبت تکرار روی ردیف‌های هم‌محتوا ثبت شد', sb._offState.items.filter(function (x) { return x.name === 'گسکت اسپیرال'; }).map(function (x) { return +x.dupOrdinal || 0; }).sort().join(',') === '0,1');
  var r2 = sb.offAppendInqRows('REQ-267', rows, { keepInq: true });
  T('بارگذاری مجدد همان درخواست: هیچ‌چیز دوبله نمی‌شود', r2.added === 0 && r2.skipped === 4 && sb._offState.items.length === 4, JSON.stringify(r2));
  /* ذخیره: dedupe نباید ردیف‌های هم‌محتوای مشروع را حذف کند */
  var ded = sb.offDedupeOfferItems(sb._offState.items);
  T('ذخیره: هر ۴ ردیف می‌ماند (حذف کاذب ندارد)', ded.removed === 0 && ded.items.length === 4, 'removed=' + ded.removed);
  /* حفاظت قدیمی: تکرار دستی بی‌هویت همچنان جمع می‌شود */
  var ded2 = sb.offDedupeOfferItems([{ name: 'A', desc: 'X', qty: 1, unit: 'NO', price: 100 }, { name: 'A', desc: 'X', qty: 1, unit: 'NO', price: 0 }]);
  T('تکرار دستی بی‌هویت مثل قبل حذف می‌شود', ded2.removed === 1 && +ded2.items[0].price === 100);
  /* پیشنهاد legacy: ردیف موجود بدون هویت مبدأ، بارگذاری مجدد دوبله نسازد */
  var sbL = makeSandbox();
  sbL._offState.items = [{ name: 'فلنج گلودار', desc: '4" CL150', qty: 2, unit: 'عدد', price: 0 }];
  var rL = sbL.offAppendInqRows('REQ-267', [{ nm: 'فلنج گلودار', st: '4" CL150', un: 'عدد', qty: 2 }], { keepInq: true });
  T('ردیف legacy هم‌محتوا مصرف می‌شود (دوبله نمی‌شود)', rL.added === 0 && rL.skipped === 1, JSON.stringify(rL));
} catch (e) {
  T('sandbox رفتاری اجرا شد', false, String(e && e.message || e));
}

/* ---------- سناریوی رفتاری: ورود قیمت از اکسل ---------- */
try {
  var sb2 = makeSandbox();
  sb2.offParseMoney = function (v) { return +String(v == null ? '' : v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^\d.-]/g, '') || 0; };
  sb2.ptfTriggerAutoDraftSave = function () {};
  sb2._offState.items = [
    { name: 'گسکت اسپیرال', desc: '2" CL300', qty: 10, unit: 'عدد', price: 0, pcode: 'G-100' },
    { name: 'گسکت اسپیرال', desc: '2" CL300', qty: 10, unit: 'عدد', price: 0 },
    { name: 'شیر توپی', desc: '1" CL800', qty: 5, unit: 'عدد', price: 0, marginPct: 20 }
  ];
  var cutI = off.indexOf('function offPriceXlsApply');
  var cutJ = off.indexOf('window.offPriceXlsApply = offPriceXlsApply;');
  vm.runInContext(off.slice(cutI, cutJ), sb2, { filename: 'offers.js#pricexls' });
  var alerts = [];
  sb2.alert = function (m) { alerts.push(String(m)); };
  sb2.offPriceXlsApply([
    ['ردیف', 'کد کالا', 'نام کالا', 'شرح', 'مدل', 'تعداد', 'واحد', 'نرخ مرجع (ریال)', 'قیمت واحد (ریال)'],
    ['1', 'G-100', 'گسکت اسپیرال', '', '', '10', 'عدد', '۱٬۲۰۰٬۰۰۰', '1,500,000'],
    ['2', '', 'گسکت اسپیرال', '', '', '10', 'عدد', '', '1,450,000'],
    ['3', '', 'شیر توپی', '', '', '5', 'عدد', '2000000', '']
  ]);
  var its = sb2._offState.items;
  T('ردیف ۱: نرخ مرجع فارسی + قیمت با کاما اعمال شد', its[0].refPrice === 1200000 && its[0].price === 1500000 && its[0].refPriceEdited === true, JSON.stringify(its[0]));
  T('ردیف ۲ (هم‌محتوا) جداگانه قیمت گرفت', its[1].price === 1450000 && !its[1].refPrice, JSON.stringify(its[1]));
  T('ردیف ۳: قیمت از نرخ مرجع × ضریب سود ساخته شد', its[2].refPrice === 2000000 && its[2].price === 2400000, JSON.stringify(its[2]));
  T('درصد سود ردیف ۱ هم‌راستا شد', its[0].marginPct === 25, String(its[0].marginPct));
  T('خلاصه به کاربر اعلام شد', alerts.length === 1 && alerts[0].indexOf('3 ردیف تطبیق') > -1, alerts.join(' | '));
} catch (e2) {
  T('sandbox ورود قیمت اجرا شد', false, String(e2 && e2.message || e2));
}

console.log('\n— tester459 (v34.37.2: رفع حذف کاذب اقلام هم‌محتوا + قیمت از اکسل) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
