/* tester658 — v34.39.4 (LETTER-SIG-PAGINATION): رفع گزارش کارفرما در مکاتبات/نامهٔ صادره:
   «مهر امضا به صفحهٔ بعد منتقل می‌شود و گاهاً یک صفحهٔ خالی بین متن و امضا وجود دارد».
   سه ریشه در letPrintObj (crm/letters.js):
   ۱) بلوک `.sig` شکستنی بود (بدون break-inside:avoid) — نام/سمت در صفحهٔ قبل می‌ماند و
      مهر (position:absolute داخل sigbox) و تصویر امضا به صفحهٔ بعد می‌افتاد؛
   ۲) `.body table{page-break-inside:avoid}` برای جدول بلندتر از صفحه، باگ «صفحهٔ خالی»
      کروم را فعال می‌کرد (جدول به صفحهٔ بعد هل می‌شد و صفحهٔ سفید بین متن و امضا می‌افتاد)؛
   ۳) پاراگراف/‌<br>‌های خالیِ انتهای متن (باقی‌ماندهٔ کپی از Word) در چاپ ارتفاع نامرئی
      اشغال می‌کردند و بلوک امضا را بی‌دلیل به صفحهٔ بعد می‌رانند.
   اصلاح: `.sig`/`.sigbox` اتمیک (همان قرارداد `.endsig` مسیر سربرگ و `.sig` چاپ پیشنهاد)؛
   جدول با الگوی خانهٔ offers-pro (table:auto + tr:avoid + thead:table-header-group) در هر دو
   مسیر چاپ؛ و letTrimTrailingEmptyHtml فقط برای انتهای بدنهٔ مسیر نامهٔ استاندارد
   (مسیر «متن آماده روی سربرگ» به قرارداد «بدون تغییر متن» دست نمی‌زند).
   این تستر letPrintObj واقعی را در vm اجرا می‌کند و HTML چاپ را می‌سنجد + واحدِ تابع پیرایش. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function count(h, s) { return h.split(s).length - 1; }

var letters = read('crm/letters.js');

/* ---------- قرارداد استاتیک ---------- */
T('مسیر نامه: .sig اتمیک است (break-inside:avoid + page-break-inside:avoid)',
  letters.indexOf(".sig{margin-top:12mm;display:flex;justify-content:flex-end;direction:' + dir + ';break-inside:avoid;page-break-inside:avoid}") > -1);
T('مسیر نامه: .sigbox هم اتمیک است (مهر absolute داخل قطعهٔ شکسته جابه‌جا نمی‌شود)',
  letters.indexOf('.sigbox{text-align:center;position:relative;min-width:60mm;padding-top:2mm;break-inside:avoid;page-break-inside:avoid}') > -1);
T('مسیر نامه: جدول بلند «صفحهٔ خالی» نمی‌سازد (auto + tr اتمیک + thead تکرارشونده)',
  letters.indexOf('.body table{width:100%;border-collapse:collapse;margin:4mm 0;page-break-inside:auto}.body tr{page-break-inside:avoid}.body thead{display:table-header-group}') > -1);
T('مسیر سربرگ: همان اصلاح جدول اعمال شده است', (function () {
  var block = letters.slice(letters.indexOf('window.ptfLetterheadPastePrint'), letters.indexOf('/* ---------- روتینگ'));
  return block.indexOf('.body table{width:100%;border-collapse:collapse;margin:4mm 0;page-break-inside:auto}.body tr{page-break-inside:avoid}.body thead{display:table-header-group}') > -1;
})());
T('تابع پیرایش سفیدهای انتها تعریف شده است', letters.indexOf('function letTrimTrailingEmptyHtml(html) {') > -1);
T('چاپ نامه از بدنهٔ پیرایش‌شده استفاده می‌کند (sanitize همیشگی حفظ شده)',
  letters.indexOf('var printBody = l.bodyHtml ? letSafeBodyHtml(l.bodyHtml) : escP(l.body).replace(/\\n/g, \'<br>\');') > -1 &&
  letters.indexOf('printBody = letTrimTrailingEmptyHtml(printBody);') > -1 &&
  letters.indexOf("'<div class=\"body\">' + printBody + '</div>'") > -1);
T('قرارداد «بدون تغییر متن» مسیر سربرگ دست‌نخورده: پیرایش فقط در مسیر نامهٔ استاندارد', (function () {
  var block = letters.slice(letters.indexOf('window.ptfLetterheadPastePrint'), letters.indexOf('/* ---------- روتینگ'));
  return block.indexOf('letTrimTrailingEmptyHtml') === -1 && /ptfLetterheadPastePrint[\s\S]{0,400}letSafeBodyHtml\(ed\.innerHTML\)/.test(letters);
})());
T('قراردادهای قدیمی چاپ حفظ شده‌اند (tester317/502/463)', letters.indexOf("l.bodyHtml ? letSafeBodyHtml(l.bodyHtml)") > -1 &&
  count(letters, "<style>' + letEmbeddedFontCss()") === 2 &&
  letters.indexOf('.endsig{margin:12mm 16mm 0') > -1 &&
  letters.indexOf('.body table{width:100%') > -1 && letters.indexOf('.body img{display:block') > -1);

/* ---------- sandbox: اجرای واقعی letters.js (الگوی tester502) ---------- */
function makeCtx(store) {
  var previews = [], alerts = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, setAttribute: function () {} }; }, body: { appendChild: function () {} } },
    getData: function (k) { return store[k] === undefined ? [] : store[k]; },
    setData: function (k, v) { store[k] = v; return true; },
    curSession: function () { return { user: 'boss', name: 'مدیر' }; },
    curRole: function () { return 'admin'; }, roleDef: function () { return { panels: '*' }; },
    genCode: function () { return 'L-1'; }, faDateTime: function () { return '1405/06/25 10:00'; },
    faDate: function () { return '1405/06/25'; }, faYear: function () { return '1405'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    sigProfileFor: function () { return { nm: 'نام پروفایل', role: 'سمت پروفایل' }; },
    hideModal: function () {}, renderLetters: function () {}, goPanel: function () {},
    audit: function () {}, notify: function () {},
    alert: function (m) { alerts.push(String(m)); }, confirm: function () { return false; },
    ptfPreviewPrintableDoc: function () { previews.push([].slice.call(arguments)); },
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    addEventListener: function () {}, FileReader: function () {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._previews = previews; ctx._alerts = alerts;
  vm.createContext(ctx);
  vm.runInContext(letters, ctx, { filename: 'letters-runtime.js' });
  /* sanitizer واقعی به DOM متکی است — مانند tester502 با identity جایگزین می‌شود تا
     رفتار «پیرایش انتها» مستقل از sanitize سنجیده شود. */
  ctx.letSafeBodyHtml = function (h) { return String(h == null ? '' : h); };
  return ctx;
}
var store = { ptf_crm_letters: [], ptf_crm_users: [], ptf_crm_sigprofiles: {} };

function printedHtmlFor(letter, includeSig) {
  var ctx = makeCtx(store);
  ctx.getData = function (k) { return k === 'ptf_crm_letters' ? [letter] : (store[k] === undefined ? [] : store[k]); };
  ctx.letPrint(letter.cd, false, includeSig === undefined ? false : includeSig);
  return (ctx._previews[0] && ctx._previews[0][1]) || '';
}

var baseLetter = { cd: 'L1', kind: 'OUT', st: 'signed', lang: 'fa', no: '۱۰۰', to: 'گیرندهٔ محترم',
  subject: 'موضوع نامه', body: '', style: {}, signer: 'boss',
  signatureSnapshot: { nm: 'نام امضاکننده', role: 'سمت امضاکننده' } };

/* سناریو ۱ — بدنهٔ HTML با دمِ خالیِ Word: متنِ مرئی می‌ماند، دمِ نامرئی پیرایش می‌شود */
(function () {
  var l = JSON.parse(JSON.stringify(baseLetter));
  l.bodyHtml = '<p>متن نامه</p><p><br></p><p>&nbsp;</p><p><span>&nbsp;</span></p><br>';
  var html = printedHtmlFor(l);
  T('سناریو۱: پاراگراف/برچسب‌های خالیِ انتها از بدنهٔ چاپ حذف می‌شوند (صفحهٔ سفیدِ نامرئی بین متن و امضا)',
    html.indexOf('<div class="body"><p>متن نامه</p></div>') > -1, (html.match(/<div class="body">[\s\S]{0,160}/) || [''])[0]);
  T('سناریو۱: CSS چاپ بلوک امضای اتمیک دارد',
    html.indexOf('.sig{margin-top:12mm;display:flex;justify-content:flex-end;direction:rtl;break-inside:avoid;page-break-inside:avoid}') > -1);
  T('سناریو۱: CSS چاپ جدول را بین سطرها شکستنی می‌کند (بدون صفحهٔ خالی)',
    html.indexOf('.body table{width:100%;border-collapse:collapse;margin:4mm 0;page-break-inside:auto}.body tr{page-break-inside:avoid}.body thead{display:table-header-group}') > -1);
})();

/* سناریو ۲ — فاصلهٔ عمدی میان متن حفظ می‌شود (فقط انتها پیرایش می‌شود) */
(function () {
  var l = JSON.parse(JSON.stringify(baseLetter));
  l.bodyHtml = '<p>الف</p><p><br></p><p>ب</p><p><br></p>';
  var html = printedHtmlFor(l);
  T('سناریو۲: پاراگراف خالیِ میانی دست‌نخورده می‌ماند و فقط دم پیرایش می‌شود',
    html.indexOf('<div class="body"><p>الف</p><p><br></p><p>ب</p></div>') > -1, (html.match(/<div class="body">[\s\S]{0,120}/) || [''])[0]);
})();

/* سناریو ۳ — متن ساده با \n انتهایی */
(function () {
  var l = JSON.parse(JSON.stringify(baseLetter));
  l.bodyHtml = ''; l.body = 'متن سادهٔ نامه\n\n\n';
  var html = printedHtmlFor(l);
  T('سناریو۳: <br>های انتهاییِ مسیر متن ساده پیرایش می‌شوند',
    html.indexOf('<div class="body">متن سادهٔ نامه</div>') > -1, (html.match(/<div class="body">[\s\S]{0,120}/) || [''])[0]);
})();

/* سناریو ۴ — محتوای انتهاییِ معنادار هرگز حذف نمی‌شود */
(function () {
  var l = JSON.parse(JSON.stringify(baseLetter));
  l.bodyHtml = '<p>متن</p><table><tbody><tr><td>۱</td></tr></tbody></table>';
  var html = printedHtmlFor(l);
  T('سناریو۴: جدولِ دارای محتوا در انتهای نامه حفظ می‌شود',
    html.indexOf('<div class="body"><p>متن</p><table><tbody><tr><td>۱</td></tr></tbody></table></div>') > -1);
})();

/* ---------- واحدِ تابع پیرایش (letTrimTrailingEmptyHtml واقعی) ---------- */
(function () {
  var ctx = makeCtx(store);
  var trim = ctx.letTrimTrailingEmptyHtml;
  if (typeof trim !== 'function') {
    T('واحد: letTrimTrailingEmptyHtml در runtime قابل دسترسی است', false, 'تابع تعریف نشده است');
    return;
  }
  T('واحد: تو در توی عمیق <p><span><b>&nbsp;</b></span></p> پیرایش می‌شود',
    trim('<p>متن</p><p><span><b>&nbsp;</b></span></p>') === '<p>متن</p>', trim('<p>متن</p><p><span><b>&nbsp;</b></span></p>'));
  T('واحد: تصویر انتهایی (محتوای مرئی) حفظ می‌شود',
    trim('<p>متن</p><img src="data:image/png;base64,AA">') === '<p>متن</p><img src="data:image/png;base64,AA">');
  T('واحد: <hr> انتهایی حفظ می‌شود', trim('<p>متن</p><hr>') === '<p>متن</p><hr>');
  T('واحد: بلوک خالی با style هم پیرایش می‌شود',
    trim('<p>متن</p><p style="margin: 0cm">&nbsp;</p>') === '<p>متن</p>');
  T('واحد: DIV خالیِ انتها پیرایش می‌شود ولی DIV دارای متن نه',
    trim('<div><p>متن</p></div><div><br></div>') === '<div><p>متن</p></div>' &&
    trim('<div>متن</div>') === '<div>متن</div>');
  T('واحد: رشتهٔ بدون دمِ خالی عیناً برمی‌گردد (idempotent)',
    trim('<p>متن</p>') === '<p>متن</p>' && trim('') === '' && trim(null) === '');
  T('واحد: &nbsp; و کاراکتر \u00a0 و &#160; هر سه در انتها پیرایش می‌شوند',
    trim('<p>متن</p>&nbsp;') === '<p>متن</p>' && trim('<p>متن</p>\u00a0') === '<p>متن</p>' && trim('<p>متن</p>&#160;') === '<p>متن</p>');
})();

console.log('=== tester658: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
