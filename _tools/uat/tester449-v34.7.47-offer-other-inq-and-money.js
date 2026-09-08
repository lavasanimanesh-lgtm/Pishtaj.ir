#!/usr/bin/env node
'use strict';
/* v34.38.0 — دکمهٔ مجزای «بارگذاری از درخواست دیگر» + جداکننده هزارگان /
   مبلغ به حروف لایو + پذیرش ارقام فارسی در مودال پیشنهاد (پیشنهاد و رویژن پرونده).
   الگوهای tester433 و tester448 نباید بشکنند. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var off = read('crm/offers.js');
var lock = read('crm/offerlock.js');
var money = read('crm/moneyx.js');
var pro = read('crm/offers-pro.js');
var revision = read('crm/case-revision.js');
var inq = read('crm/inqreader.js');
var ver = JSON.parse(read('VERSION.json'));

/* ---------- نسخه ---------- */
T('VERSION.json = v34.38.10', ver.crm_version === 'v34.38.10', ver.crm_version);
T('index.html PTF_CRM_RELEASE = v34.38.10', /window\.PTF_CRM_RELEASE = 'v34\.38\.10'/.test(read('crm/index.html')));
T('sw.js RELEASE = v34.38.10', /RELEASE = 'v34\.38\.10'/.test(read('crm/sw.js')));

/* ---------- دکمه مجزا در فرم مشترک پیشنهاد/رویژن ---------- */
T('فرم پیشنهاد دکمهٔ بارگذاری از درخواست دیگر دارد',
  /id="offOtherInqBtn"/.test(off) && /بارگذاری از درخواست دیگر/.test(off) && /offLoadOtherInqItems\(\)/.test(off));
T('دکمهٔ قدیمی بارگذاری از درخواست حفظ شده', /id="offInqBtn"/.test(off) && /offLoadInqItems\(\)/.test(off));
T('رویژن همان offerForm را باز می‌کند', /W\.offerForm\(\);/.test(revision) && /W\.ptfSetOffState\(draft\)/.test(revision));
T('بنر رویژن بارگذاری از درخواست دیگر را ذکر می‌کند', revision.indexOf('بارگذاری از درخواست دیگر') > -1);

/* ---------- keepInq شماره درخواست را عوض نمی‌کند ---------- */
T('offLoadInqItems opt.keepInq دارد', /opt\.keepInq/.test(off) && /function offLoadInqItems\(pickedInq, opt\)/.test(off));
T('offAppendInqRows در keepInq شماره را نمی‌نویسد',
  /window\.offAppendInqRows = function/.test(off) && /if \(!opt\.keepInq\)/.test(off));
T('offLoadOtherInqApply با keepInq صدا می‌زند',
  /offLoadInqItems\(inq, \{ keepInq: true, rows: selected \}\)/.test(off));
T('export صریح window.offLoadInqItems برای wrap اینک‌ریدر',
  /window\.offLoadInqItems = offLoadInqItems;/.test(off));
T('وصلهٔ inqreader امضا و apply را حفظ کرده',
  /window\.offLoadInqItems = function \(pickedInq\)/.test(inq) && /_offLoadOld\.apply\(this, arguments\)/.test(inq));

/* ---------- الگوهای tester433 نباید بشکنند ---------- */
T('tester433: حل واحد درخواست در لودر مانده', /ptfResolveInqRequest\(inq\)/.test(off));
T('tester433: واحد/کد/نرخ مرجع در ساخت قلم مانده',
  /unit: r\.un \|\| r\.unit \|\| 'عدد'/.test(off) && /pcode: r\.pcode/.test(off) && /ptfItemRefPrice\(item/.test(off));
T('tester433 cut markers سالم‌اند',
  off.indexOf('window.ptfResolveInqRequest = function') > -1 &&
  off.indexOf('function offLoadInqItems') > off.indexOf('window.ptfResolveInqRequest = function'));

/* ---------- جداکننده هزارگان + حروف لایو + ارقام فارسی ---------- */
T('نرخ مرجع type=text + data-money (نه type=number)',
  /id="offRef' \+ i \+ '"/.test(lock) && /data-money="1" data-nohint="1"/.test(lock) &&
  /<input type="text" inputmode="numeric" data-money="1" data-nohint="1"/.test(lock));
T('قیمت واحد data-money + data-words برای حروف لایو',
  /data-money="1" data-words="1"/.test(lock) && /data-money="1" data-words="1"/.test(off));
T('جمع ردیف/کل با offPrintAmount (کاما انگلیسی)',
  /offPrintAmount\(\(\+it\.qty \|\| 0\) \* \(\+it\.price \|\| 0\)/.test(lock) &&
  /offPrintAmount\(total/.test(lock));
T('offParseMoney و offPrintAmount تعریف شده‌اند',
  /window\.offParseMoney = function/.test(off) && /window\.offPrintAmount = function/.test(off));
T('offUpdRefPrice و offUpdItem از offParseMoney می‌خوانند',
  /offUpdRefPrice[\s\S]{0,280}offParseMoney/.test(off) && /offUpdItem[\s\S]{0,220}offParseMoney/.test(off));
T('moneyx حروف را با data-words حتی زیر ۱۰۰۰ نشان می‌دهد',
  /n >= 1000 \|\| always/.test(money) && /window\.ptfMoneyRefresh = function/.test(money));
T('offerFmtMoney ارقام را انگلیسی می‌کند',
  /window\.offerFmtMoney = function/.test(pro) && /ptfEnDigits/.test(pro) && /toLocaleString\('en-US'\)/.test(pro));
T('قالب نهایی پیشنهاد از moneyPrint/offPrintAmount استفاده می‌کند',
  /var moneyPrint = function/.test(off) && /moneyPrint\(it\.price\)/.test(off) && /moneyPrint\(total\)/.test(off));
T('رندر فعال بعد از innerHTML حروف/کاما را refresh می‌کند', /ptfMoneyRefresh\(el\)/.test(lock));

/* ---------- رفتار زمان اجرا ---------- */
function sandbox() {
  var db = {
    ptf_crm_rfqs: [
      { cd: 'RFQ-A', inqNo: 'INQ-A', co: 'شرکت الف', items: [] },
      { cd: 'RFQ-B', inqNo: 'INQ-B', co: 'شرکت ب', items: [] }
    ],
    ptf_crm_inqitems: [
      { inqNo: 'INQ-B', cd: 'IQI-B1', nm: 'فلنج', st: 'ASME B16.5', un: 'عدد', qty: 4, pcode: 'P-2002', refPrice: 310000, refCur: 'IRR' }
    ],
    ptf_crm_inqreads: [],
    ptf_crm_products: [],
    ptf_crm_rfqsmart: []
  };
  var inqEl = { value: 'RFQ-A', options: [{ value: 'RFQ-A' }], tagName: 'SELECT' };
  var state = { inqNo: 'RFQ-A', items: [{ name: 'شیر موجود', qty: 1, price: 0, unit: 'NO' }], kind: 'CO' };
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object,
    setTimeout: function () { return 0; },
    document: {
      getElementById: function (id) { return id === 'ofInq' ? inqEl : null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, setAttribute: function () {}, getAttribute: function () { return null; } }; },
      addEventListener: function () {},
      body: { insertAdjacentHTML: function () {} }
    },
    getData: function (k) { return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    faDate: function () { return '1405/05/29'; },
    curSession: function () { return { name: 'آزمون' }; },
    alert: function () {},
    ptfToast: function () {},
    audit: function () {},
    _offState: state,
    window: null
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/moneyx.js'), sb, { filename: 'moneyx.js' });
  vm.runInContext(read('crm/procurement-link.js'), sb, { filename: 'procurement-link.js' });
  function cut(startMark, endMark) {
    var i = off.indexOf(startMark), j = off.indexOf(endMark, i);
    if (i < 0 || j < 0) throw new Error('ناحیه پیدا نشد: ' + startMark);
    return off.slice(i, j);
  }
  vm.runInContext(cut('function offNormLine', 'function offLoadInqItems'), sb, { filename: 'offers.js#inq-money' });
  var fmtSrc = pro.slice(pro.indexOf('window.offerFmtMoney = function'), pro.indexOf('// تزریق فیلد ارز'));
  vm.runInContext(fmtSrc, sb, { filename: 'offers-pro.js#fmt' });
  sb._state = state;
  sb._inqEl = inqEl;
  sb._db = db;
  return sb;
}

(function runtime() {
  var s;
  try { s = sandbox(); } catch (e) {
    T('sandbox بارگذاری شد', false, String(e && e.message || e));
    return;
  }
  T('sandbox بارگذاری شد', typeof s.offParseMoney === 'function' && typeof s.offAppendInqRows === 'function');

  T('offParseMoney ارقام فارسی را می‌پذیرد', s.offParseMoney('۱٬۲۰۰٬۰۰۰') === 1200000, s.offParseMoney('۱٬۲۰۰٬۰۰۰'));
  T('offParseMoney ارقام عربی و کامای انگلیسی را می‌پذیرد', s.offParseMoney('1,250,000') === 1250000 && s.offParseMoney('١٢٣٤') === 1234);
  T('ptfNum همان قرارداد ارقام فارسی را دارد', s.ptfNum('۵۰۰۰۰۰') === 500000);

  var fmt = s.offerFmtMoney(1200000, { id: 'IRR' });
  T('offerFmtMoney جداکننده انگلیسی می‌گذارد', String(fmt).indexOf('1,200,000') > -1, fmt);
  T('offerFmtMoney رقم فارسی ندارد', !/[۰-۹٠-٩]/.test(String(fmt)), fmt);
  T('offPrintAmount خروجی انگلیسی است', !/[۰-۹٠-٩]/.test(String(s.offPrintAmount(2500000, { id: 'IRR' }))) && String(s.offPrintAmount(2500000, { id: 'IRR' })).indexOf('2,500,000') > -1, s.offPrintAmount(2500000, { id: 'IRR' }));

  var beforeNo = s._state.inqNo;
  var beforeCount = s._state.items.length;
  var row = s._db.ptf_crm_inqitems[0];
  var res = s.offAppendInqRows('RFQ-B', [row], { keepInq: true });
  T('keepInq شماره درخواست فعلی را عوض نمی‌کند', s._state.inqNo === beforeNo && s._inqEl.value === 'RFQ-A', JSON.stringify({ inqNo: s._state.inqNo, sel: s._inqEl.value, added: res && res.added }));
  T('keepInq قلم درخواست دیگر را اضافه می‌کند', s._state.items.length === beforeCount + 1 && s._state.items.some(function (it) { return it.name === 'فلنج'; }), s._state.items.map(function (it) { return it.name; }));

  var built = s.offBuildItemFromInqRow(row, 'RFQ-B');
  T('ساخت قلم واحد/کد/نرخ مرجع را منتقل می‌کند',
    built.unit === 'عدد' && built.pcode === 'P-2002' && +built.refPrice === 310000, JSON.stringify(built));

  /* مسیر عادی (بدون keepInq) هنوز شماره را می‌نویسد */
  var s2 = sandbox();
  s2.offAppendInqRows('RFQ-B', [s2._db.ptf_crm_inqitems[0]], {});
  T('بدون keepInq شماره state به درخواست مبدأ می‌رود', s2._state.inqNo === 'RFQ-B', s2._state.inqNo);
})();

console.log('\n— tester449 (v34.38.0: درخواست دیگر + مبالغ مودال پیشنهاد) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);