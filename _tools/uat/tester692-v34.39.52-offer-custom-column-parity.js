/* =====================================================================
   tester692 — v34.39.52 — BUG-OFF-XCOL-PARITY-001 + BUG-OFF-PRINT-STALE-DOC
   گزارش کارفرما (۱۴۰۵/۰۷/۱۴) در پنجرهٔ مودال پیشنهادها:
     ۱) «ستون جدید می‌سازیم و مقدار می‌دهیم؛ موقع چاپ، مقادیر ستون جدید نمی‌آید.»
     ۲) «ستون‌های تازه‌ساخته را نمی‌توانیم جابه‌جا کنیم — نسبت به ستون‌های
        پیش‌فرض فروزن‌اند. ستون جدید باید دقیقاً مثل ستون‌های پیش‌فرض رفتار کند.»
   خواستهٔ صریح: اول تأیید شود همهٔ ستون‌های پیش‌فرض جابه‌جا می‌شوند، بعد اصلاح.
   → بخش ۲ همان تأیید است (۳۰ ترکیب درگ، در فرم و در چاپ).
   ===================================================================== */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

var BASE_KEYS = ['name', 'desc', 'model', 'qty', 'unit', 'brand'];
var FA = { name: 'شرح کالا', desc: 'مشخصات', model: 'مدل', qty: 'تعداد', unit: 'واحد', brand: 'برند' };
var LB = { name: 'Item Name', desc: 'Description', model: 'Model', qty: 'Qty', unit: 'Unit', brand: 'Brand' };

SECTION('۰. نسخه و مستندات');
T('نسخهٔ index.html = v34.39.52', /window\.PTF_CRM_RELEASE = 'v34\.39\.52'/.test(idx));
T('کش sw.js = v34.39.52', /var RELEASE = 'v34\.39\.52';/.test(sw));
T('cache-bust offers.js/offers-pro.js/offerlock.js = 34.39.52',
  ['offers.js', 'offers-pro.js', 'offerlock.js'].every(function (f) {
    var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)'));
    return m && m[1] === '34.39.52';
  }));
T('RELEASE-NOTES-v34.39.52.md موجود است', fs.existsSync(path.resolve(__dirname, '../../RELEASE-NOTES-v34.39.52.md')));

SECTION('۱. کد: یک موتور ترتیب برای ستون‌های پیش‌فرض و تکمیلی');
T('offColOrderAll — ترتیب کامل (پایه + تکمیلی) با کلید x:', op.indexOf('window.offColOrderAll = function (st, isCO)') > -1);
T('offAllCols — فهرست یکپارچهٔ ستون‌ها برای رندر', op.indexOf('window.offAllCols = function (o, isCO)') > -1);
T('docColSeq — ترتیب بصری ستون‌ها در سند چاپی', op.indexOf('function docColSeq(cols, ec, o, isCO)') > -1);
T('offColDrop دیگر ترتیب را به دو فهرست جدا تفکیک نمی‌کند',
  /st\.colOrder = all\.slice\(\);/.test(op) &&
  op.indexOf("_offState.colOrder = all.filter(function (k) { return k.indexOf('x:') !== 0; });") === -1);
T('رندر فرم (offerlock — رندرکنندهٔ فعال) از فهرست واحد استفاده می‌کند', ol.indexOf('window.offAllCols(_offState, isCO)') > -1);
T('رندر فرم (offers-pro) از فهرست واحد استفاده می‌کند', op.indexOf('window.offAllCols(_offState, isCO)') > -1);
T('چاپ: سلول ستون تکمیلی داخل همان حلقهٔ ترتیب', op.indexOf("if (s.extra) return '<td>' + escP((it.extra || {})[s.nm] || '—') + '</td>';") > -1);
T('عرض ستون‌ها (colgroup) هم به ترتیب بصری بازچیده می‌شود', op.indexOf('if (ordered.length === stats.length) stats = ordered;') > -1);
T('چاپ از داخل فرم: سند زندهٔ فرم مقدم بر رکورد ذخیره‌شده',
  /var fromForm = !!window\._offPreviewFromForm;/.test(op) && op.indexOf('window._offPreviewFromForm = false;') > -1);
T('TO→CO: چیدمان ستون‌ها هم کپی می‌شود', of.indexOf("if (to.colOrder && to.colOrder.length) _offState.colOrder = JSON.parse(JSON.stringify(to.colOrder));") > -1);

/* ================= محیط اجرایی: کد واقعی سه فایل ================= */
global._offState = null;
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.curRole = function () { return 'admin'; };
global.roleDef = function () { return { buyPrice: false }; };
global.ptfTriggerAutoDraftSave = function () {};
global.ptfToast = function () {};
global.ptfUnifiedCode = function (k) { return 'PTF-' + k + '-1405-001'; };
var _gridHtml = '';
global.document.getElementById = function (id) {
  if (id === 'offItemsWrap') return { set innerHTML(v) { _gridHtml = v; }, get innerHTML() { return _gridHtml; } };
  if (id === 'panels') return { insertAdjacentHTML: function () {} };
  return null;
};
global.document.querySelector = function (sel) { return /offTpl/.test(String(sel)) ? { value: 'classic' } : null; };
global.document.body.insertAdjacentHTML = function () {};
global.offEl = function (id) { return global.document.getElementById(id); };
global.prompt = function () { return 'Origin'; };
global.MAX_EXTRA_COLS = +(of.match(/var MAX_EXTRA_COLS = (\d+);/)[1]);
eval(of.match(/var SELLER_INFO = \{[\s\S]*?\n\};/)[0].replace('var SELLER_INFO', 'global.SELLER_INFO'));
loadFns('offers.js', ['offerSerial', 'ptfSetOffState', 'offNormLine', 'offItemKey', 'offEnsureOfferLineIds',
  'offDedupeOfferItems', 'defaultValidity', 'myEnName', 'offerPostAwardLocked', 'ptfOfferResolveSaveIdentity',
  'offUpdExtra', 'offAddColumn', 'offDelColumn', 'offerSave', 'numToWords']);
eval(of.match(/window\.offRowIsEmpty = function \(it\) \{[\s\S]*?\n\};/)[0]);
eval(op);   /* کل فایل واقعی offers-pro.js */
eval(ol);   /* کل فایل واقعی offerlock.js (رندرکنندهٔ نهایی فرم) */
global.ptfPreviewPrintableDoc = function (title, html) { global._printHtml = html; };

function mkState(extra, colOrder) {
  var items = [{ name: 'Valve', desc: 'DN80', model: 'CV-80', qty: 2, unit: 'NO', brand: 'Samson', price: 100, extra: {} }];
  if (extra && extra.length) extra.forEach(function (c) { items[0].extra[c] = 'V-' + c; });
  global._offState = {
    no: 'PTF-CO-1405-001', kind: 'CO', rev: 0, st: 'draft', currency: 'IRR', colOrder: colOrder || null,
    hiddenCols: [], extraCols: (extra || []).slice(), buyerCd: 'C1', buyerCo: 'Foolad Co', inqNo: 'RFQ-1',
    dateEn: '2026-10-06', items: items, terms: []
  };
  return global._offState;
}
/* ترتیب سرستون‌های فرم (برچسب فارسی ستون پایه / نام ستون تکمیلی) */
function formOrder() {
  _gridHtml = '';
  offRenderItems();
  var th = (_gridHtml.match(/<thead[\s\S]*?<\/thead>/) || [''])[0];
  var labels = [];
  var re = /⠿ ([^<]*?)\s*<a/g, m;
  while ((m = re.exec(th))) labels.push(m[1].trim());
  return labels;
}
/* ترتیب ستون‌های محتوا در چاپ (بدون No. و قیمت/جمع) */
function printOrder(o, tpl) {
  global._printHtml = '';
  offerPrintTpl(o || _offState, tpl || 'classic', true);
  var h = global._printHtml || '';
  var theads = h.match(/<thead[\s\S]*?<\/thead>/g) || [];
  var thead = theads.filter(function (t) { return t.indexOf('<th') > -1; }).pop() || '';
  var seq = [], re = /<th[^>]*>([^<]*)<\/th>/g, m;
  while ((m = re.exec(thead))) seq.push(m[1].trim());
  return seq.filter(function (x) { return x !== 'No.' && x.indexOf('Unit Price') !== 0 && x.indexOf('Total') !== 0; });
}
function drag(from, to) {
  offColDragStart({ dataTransfer: {}, preventDefault: function () {} }, from);
  offColDrop({ preventDefault: function () {} }, to);
}
function expectAfter(list, from, to) {
  var out = list.slice();
  out.splice(out.indexOf(to), 0, out.splice(out.indexOf(from), 1)[0]);
  return out;
}

SECTION('۲. تأیید خواستهٔ کارفرما: همهٔ ۶ ستون پیش‌فرض جابه‌جا می‌شوند (۳۰ ترکیب)');
var badForm = [], badPrint = [], n = 0;
BASE_KEYS.forEach(function (from) {
  BASE_KEYS.forEach(function (to) {
    if (from === to) return;
    n++;
    mkState([]);
    var before = formOrder();
    drag(from, to);
    var want = expectAfter(before, FA[from], FA[to]);
    var got = formOrder();
    if (JSON.stringify(got) !== JSON.stringify(want)) badForm.push(from + '→' + to + ' (' + got.join(',') + ')');
    var wantPrint = expectAfter(before.map(function (l) { return BASE_KEYS.filter(function (k) { return FA[k] === l; })[0]; }), from, to).map(function (k) { return LB[k]; });
    var gotPrint = printOrder();
    if (JSON.stringify(gotPrint) !== JSON.stringify(wantPrint)) badPrint.push(from + '→' + to + ' (' + gotPrint.join(',') + ')');
  });
});
T('۳۰ جابه‌جایی ستون پیش‌فرض در فرم درست است', badForm.length === 0, badForm.slice(0, 3).join(' | '));
T('۳۰ جابه‌جایی ستون پیش‌فرض در چاپ درست است', badPrint.length === 0, badPrint.slice(0, 3).join(' | '));
T('هر ۶ ستون پیش‌فرض دست‌کم یک‌بار جابه‌جا شدند', (function () {
  var moved = {};
  BASE_KEYS.forEach(function (f) { BASE_KEYS.forEach(function (t) { if (f !== t) { moved[f] = 1; moved[t] = 1; } }); });
  return BASE_KEYS.every(function (k) { return moved[k]; });
})());

SECTION('۳. ستون تکمیلی دقیقاً مثل ستون پیش‌فرض جابه‌جا می‌شود (ریشهٔ «فروزن»)');
var badXForm = [], badXPrint = [];
BASE_KEYS.forEach(function (target) {
  mkState(['Origin']);
  drag('x:Origin', target);
  var got = formOrder();
  var want = expectAfter(['شرح کالا', 'مشخصات', 'مدل', 'تعداد', 'واحد', 'برند', 'Origin'], 'Origin', FA[target]);
  if (JSON.stringify(got) !== JSON.stringify(want)) badXForm.push(target + ': ' + got.join(','));
  var gotP = printOrder();
  var wantP = expectAfter(['Item Name', 'Description', 'Model', 'Qty', 'Unit', 'Brand', 'Origin'], 'Origin', LB[target]);
  if (JSON.stringify(gotP) !== JSON.stringify(wantP)) badXPrint.push(target + ': ' + gotP.join(','));
});
T('ستون تکمیلی در فرم به هر ۶ جایگاه می‌رود', badXForm.length === 0, badXForm.slice(0, 3).join(' | '));
T('ستون تکمیلی در چاپ به هر ۶ جایگاه می‌رود', badXPrint.length === 0, badXPrint.slice(0, 3).join(' | '));
mkState(['Origin']);
drag('x:Origin', 'name');
T('ترتیب درهم در colOrder ذخیره می‌شود (کلید x:Origin اول)',
  JSON.stringify(_offState.colOrder) === JSON.stringify(['x:Origin', 'name', 'desc', 'model', 'qty', 'unit', 'brand']),
  JSON.stringify(_offState.colOrder));
T('extraCols برای سازگاری با کد قدیمی حفظ می‌شود', JSON.stringify(_offState.extraCols) === '["Origin"]');
mkState(['Origin', 'Warranty']);
drag('x:Warranty', 'qty');
T('دو ستون تکمیلی: ترتیب نسبی‌شان هم درست می‌ماند',
  JSON.stringify(_offState.extraCols) === JSON.stringify(['Warranty', 'Origin']) &&
  formOrder().join(',') === 'شرح کالا,مشخصات,مدل,Warranty,تعداد,واحد,برند,Origin',
  formOrder().join(','));
T('ستون تکمیلی هم draggable و droppable رندر می‌شود', (function () {
  _gridHtml = ''; offRenderItems();
  return _gridHtml.indexOf("offColDragStart(event,'x:Warranty')") > -1 && _gridHtml.indexOf("offColDrop(event,'x:Warranty')") > -1;
})());
T('ستون پیش‌فرض ✕خورده جای خود را در ترتیب از دست نمی‌دهد', (function () {
  mkState(['Origin']);
  offToggleBaseCol('brand');           /* حذف ستون برند */
  drag('x:Origin', 'name');
  var ord = _offState.colOrder;
  offToggleBaseCol('brand');           /* بازگردانی */
  return ord.indexOf('brand') > -1 && formOrder().join(',') === 'Origin,شرح کالا,مشخصات,مدل,تعداد,واحد,برند';
})());

SECTION('۴. مقادیر ستون تکمیلی در چاپ (همهٔ ۵ قالب)');
mkState(['Origin']);
var badTpl = [];
['letterhead', 'executive', 'mono', 'minimal', 'classic'].forEach(function (tpl) {
  global._printHtml = '';
  offerPrintTpl(_offState, tpl, true);
  var h = global._printHtml || '';
  if (h.indexOf('<th>Origin</th>') < 0 || h.indexOf('<td>V-Origin</td>') < 0) badTpl.push(tpl);
});
T('سرستون + مقدار ستون تکمیلی در هر ۵ قالب چاپ می‌شود', badTpl.length === 0, badTpl.join(','));
mkState(['Origin']);
drag('x:Origin', 'desc');
T('ستون تکمیلی وسط جدول: سرستون و مقدار هم‌جایگاه‌اند', (function () {
  global._printHtml = '';
  offerPrintTpl(_offState, 'letterhead', true);
  var h = global._printHtml || '';
  var theads = h.match(/<thead[\s\S]*?<\/thead>/g) || [];
  var thead = theads.filter(function (t) { return t.indexOf('<th') > -1; }).pop() || '';
  var rowsAll = (h.match(/<tr>[\s\S]*?<\/tr>/g) || []);
  var body = rowsAll.filter(function (r) { return r.indexOf('<td') > -1; })
    .sort(function (a, b) { return (b.match(/<td/g) || []).length - (a.match(/<td/g) || []).length; })[0] || '';
  var ths = (thead.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(function (x) { return x.replace(/<[^>]*>/g, ''); });
  var tds = (body.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(function (x) { return x.replace(/<[^>]*>/g, ''); });
  var ix = ths.indexOf('Origin');
  return ix > 0 && ths.length === tds.length && tds[ix] === 'V-Origin';
})());
T('عرض ستون‌ها (colgroup) با ترتیب جدید هم‌تراز است', (function () {
  global._printHtml = '';
  offerPrintTpl(_offState, 'classic', true);
  var h = global._printHtml || '';
  var cg = (h.match(/<colgroup>[\s\S]*?<\/colgroup>/) || [''])[0];
  var theads = h.match(/<thead[\s\S]*?<\/thead>/g) || [];
  var thead = theads.filter(function (t) { return t.indexOf('<th') > -1; }).pop() || '';
  var nTh = (thead.match(/<th[ >]/g) || []).length;   /* <thead شمارش نشود */
  return (cg.match(/<col /g) || []).length === nTh;
})());

SECTION('۵. چاپ از داخل فرم با ستون تکمیلیِ ذخیره‌نشده (ریشهٔ «مقادیر چاپ نمی‌شود»)');
setData('ptf_crm_customers', [{ cd: 'C1', co: 'Foolad', coEn: 'Foolad Co' }]);
setData('ptf_crm_users', [{ username: 'admin', name: 'Admin', nameEn: 'Sales Department' }]);
setData('ptf_crm_products', []);
setData('ptf_crm_offers', []);
ptfSetOffState({
  no: 'PTF-CO-1405-001', kind: 'CO', rev: 0, st: 'draft', editMode: 'new', currency: 'IRR',
  buyerCd: 'C1', buyerCo: 'Foolad Co', inqNo: 'RFQ-1', dateEn: '2026-10-06',
  items: [{ name: 'Valve', desc: 'DN80', model: 'CV-80', qty: 2, unit: 'NO', brand: 'Samson', price: 100 }],
  terms: [], extraCols: []
});
global.window.PTF_OFFER_COMMAND_SAVE_ACTIVE = true;
offerSave();
var savedBefore = getData('ptf_crm_offers').filter(function (x) { return x.no === 'PTF-CO-1405-001'; })[0];
T('پیش‌زمینه: رکورد ذخیره‌شده هنوز ستون تکمیلی ندارد', !!savedBefore && (savedBefore.extraCols || []).length === 0);
/* کاربر ستون تازه می‌سازد، مقدار می‌دهد و بدون ذخیره چاپ می‌گیرد */
offAddColumn();
offUpdExtra(0, 'Origin', 'Germany');
offColDragStart({ dataTransfer: {}, preventDefault: function () {} }, 'x:Origin');
offColDrop({ preventDefault: function () {} }, 'desc');
offerPrintObj(_offState);            /* همان مسیر دکمهٔ چاپ/پیش‌نمایش داخل فرم */
offerTplGo('PTF-CO-1405-001', true);
var livePrint = global._printHtml || '';
T('چاپ از داخل فرم: سرستون ستون تازه در خروجی هست', livePrint.indexOf('<th>Origin</th>') > -1);
T('چاپ از داخل فرم: مقدار ستون تازه در خروجی هست', livePrint.indexOf('<td>Germany</td>') > -1);
T('چاپ از داخل فرم: ستون تازه سر جایگاه درگ‌شده است', (function () {
  var theads = livePrint.match(/<thead[\s\S]*?<\/thead>/g) || [];
  var thead = theads.filter(function (t) { return t.indexOf('<th') > -1; }).pop() || '';
  var ths = (thead.match(/<th[^>]*>[^<]*<\/th>/g) || []).map(function (x) { return x.replace(/<[^>]*>/g, ''); });
  return ths.indexOf('Origin') === ths.indexOf('Item Name') + 1;
})());
/* علامت یک‌بارمصرف است: چاپ از فهرست پیشنهادها همان رکورد ذخیره‌شده را می‌دهد */
global._printHtml = '';
offerPickTemplate('PTF-CO-1405-001');
offerTplGo('PTF-CO-1405-001', true);
var listPrint = global._printHtml || '';
T('چاپ از فهرست: رکورد ذخیره‌شده چاپ می‌شود (نه وضعیت ذخیره‌نشدهٔ فرم)', listPrint.indexOf('<th>Origin</th>') < 0);

SECTION('۶. ماندگاری: ترتیب و مقادیر پس از ذخیره و بازکردن دوباره');
global.window.PTF_OFFER_COMMAND_SAVE_ACTIVE = true;
var saveRet = offerSave();
var saved = getData('ptf_crm_offers').filter(function (x) { return x.no === 'PTF-CO-1405-001'; })[0];
T('ذخیره موفق', !!(saveRet && saveRet.ok));
T('extraCols ذخیره شد', JSON.stringify(saved.extraCols) === '["Origin"]', JSON.stringify(saved.extraCols));
T('مقدار ستون تکمیلی روی ردیف ذخیره شد', JSON.stringify((saved.items[0] || {}).extra) === '{"Origin":"Germany"}',
  JSON.stringify((saved.items[0] || {}).extra));
T('colOrder با کلید x: ذخیره شد', JSON.stringify(saved.colOrder) ===
  JSON.stringify(['name', 'x:Origin', 'desc', 'model', 'qty', 'unit', 'brand']), JSON.stringify(saved.colOrder));
global._offState = JSON.parse(JSON.stringify(saved));   /* بازکردن دوبارهٔ سند */
T('پس از بازکردن دوباره: ترتیب فرم همان است',
  formOrder().join(',') === 'شرح کالا,Origin,مشخصات,مدل,تعداد,واحد,برند', formOrder().join(','));
T('پس از بازکردن دوباره: ترتیب چاپ همان است',
  printOrder().join(',') === 'Item Name,Origin,Description,Model,Qty,Unit,Brand', printOrder().join(','));

SECTION('۷. سازگاری با عقب و قاعده‌های موجود');
T('رکورد قدیمی (colOrder فقط پایه): ستون تکمیلی ته جدول می‌ماند', (function () {
  mkState(['Origin'], ['name', 'desc', 'model', 'qty', 'unit', 'brand']);
  return formOrder().join(',') === 'شرح کالا,مشخصات,مدل,تعداد,واحد,برند,Origin' &&
    printOrder().join(',') === 'Item Name,Description,Model,Qty,Unit,Brand,Origin';
})());
T('رکورد بدون colOrder: ترتیب پیش‌فرض سالم است', (function () {
  mkState([]);
  return formOrder().join(',') === 'شرح کالا,مشخصات,مدل,تعداد,واحد,برند';
})());
T('ستون ✕خورده همچنان در فرم و چاپ نمی‌آید', (function () {
  mkState(['Origin']);
  offToggleBaseCol('brand');
  var f = formOrder().join(',');
  offToggleBaseCol('brand');
  return f === 'شرح کالا,مشخصات,مدل,تعداد,واحد,Origin';
})());
T('ستون تکمیلی سراسر-خالی همچنان از چاپ حذف می‌شود (قاعدهٔ v17.0)', (function () {
  var st = mkState(['Origin']);
  st.items[0].extra = {};
  var h = (function () { global._printHtml = ''; offerPrintTpl(st, 'classic', true); return global._printHtml || ''; })();
  return h.indexOf('<th>Origin</th>') < 0;
})());
T('ستون تکمیلی نیمه‌پر در چاپ می‌ماند و سلول خالی — می‌گیرد', (function () {
  var st = mkState(['Origin']);
  st.items.push({ name: 'Gauge', desc: 'DN25', model: 'G1', qty: 1, unit: 'NO', brand: 'Wika', price: 50, extra: {} });
  var h = (function () { global._printHtml = ''; offerPrintTpl(st, 'classic', true); return global._printHtml || ''; })();
  return h.indexOf('<th>Origin</th>') > -1 && h.indexOf('<td>—</td>') > -1;
})());
T('حذف ستون تکمیلی: مقادیرش هم پاک می‌شود (مثل قبل)', (function () {
  var st = mkState(['Origin']);
  offDelColumn(0);
  return (st.extraCols || []).length === 0 && !st.items[0].extra.Origin;
})());
T('سند TO هم ستون تکمیلی جابه‌جاشده را درست چاپ می‌کند', (function () {
  var st = mkState(['Origin']);
  st.kind = 'TO';
  drag('x:Origin', 'name');
  var p = printOrder(st, 'letterhead');
  return p.join(',') === 'Origin,Item Name,Description,Model,Qty,Unit,Brand';
})());
T('اعتبارسنجی «هیچ ستونی خالی نماند» ستون تکمیلی را همچنان می‌بیند', (function () {
  var st = mkState(['Origin']);
  st.items[0].extra = {};
  st.items.push({ name: 'Gauge', desc: 'DN25', model: 'G1', qty: 1, unit: 'NO', brand: 'Wika', price: 50, extra: { Origin: 'EU' } });
  var msg = offValidateItems() || '';
  return msg.indexOf('Origin') > -1;
})());

DONE('tester692');
