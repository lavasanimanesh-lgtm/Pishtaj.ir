#!/usr/bin/env node
'use strict';
/* v34.28.0 — LETTER-AWARD-OPEX-001
   قراردادهای رفتاری فونت مکاتبات، اسناد پس از برد، reconcile بی‌تکرار و
   تسویهٔ هزینهٔ تکرارشونده تا خروج یکتای خزانه. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail === undefined ? '' : detail); }
}
function between(src, start, end) {
  var a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('extract failed: ' + start + ' .. ' + end);
  return src.slice(a, b);
}
function count(haystack, needle) {
  var n = 0, at = 0;
  while ((at = haystack.indexOf(needle, at)) > -1) { n++; at += needle.length; }
  return n;
}

var letters = read('crm/letters.js');
var salesfiles = read('crm/salesfiles.js');
var opex = read('crm/opex.js');
var treasury = read('crm/treasury.js');
var api = read('api/sales-domain.php');
var gate = read('_tools/uat/run-ci-gate.js');
var version = JSON.parse(read('VERSION.json'));

console.log('\n── پین نسخه و rollover ──');
T('نسخهٔ رسمی دقیقاً v34.28.0 است', version.crm_version === 'v34.28.0', version.crm_version);
T('index، service worker، manifest و API هم‌نسخه‌اند',
  read('crm/index.html').indexOf("window.PTF_CRM_RELEASE = 'v34.28.0'") > -1 &&
  read('crm/sw.js').indexOf("RELEASE = 'v34.28.0'") > -1 &&
  JSON.parse(read('crm/manifest.json')).version === '34.28.0' &&
  api.indexOf("SD_SERVICE_VERSION = '34.28.0'") > -1);
T('شمارهٔ نامعتبر v34.7.100 در نقاط رسمی باقی نمانده است',
  [read('VERSION.json'), read('crm/index.html'), read('crm/sw.js'), read('crm/manifest.json'), read('crm/clear-cache.html'), api].every(function (s) { return s.indexOf('34.7.100') === -1; }));

console.log('\n── مکاتبات: پنج فونت مصوب و اعمال واقعی ──');
try {
  var fontCtx = { window: null };
  fontCtx.window = fontCtx;
  vm.createContext(fontCtx);
  vm.runInContext(between(letters, 'var LETTER_FONT_FA', '/* v87:'), fontCtx, { filename: 'letters-fonts.js' });
  var options = fontCtx.letFontOptions('', 'فونت');
  var values = [], labels = [];
  options.replace(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g, function (_, value, label) {
    if (value) { values.push(value); labels.push(label); }
    return _;
  });
  T('UI دقیقاً پنج فونت دارد', values.length === 5, values);
  T('شناسه‌های پنج فونت دقیق و بدون گزینهٔ legacy هستند', JSON.stringify(values) === JSON.stringify(['yaghut', 'nazanin', 'vazir', 'iranyekan', 'iransans']), values);
  T('برچسب‌ها دقیقاً بی‌یاقوت، بی‌نازنین، وزیرمتن، ایران‌یکان و ایران‌سنس‌اند',
    JSON.stringify(labels) === JSON.stringify(['بی‌یاقوت', 'بی‌نازنین', 'وزیرمتن', 'ایران‌یکان', 'ایران‌سنس']), labels);
  T('هر پنج شناسه به font-family واقعی نگاشت می‌شوند', values.every(function (v) { return !!fontCtx.letFontCss(v) && fontCtx.letFontCss(v) !== v; }));
  T('وزیرمتن در خروجی چاپ @font-face محلی دارد', /Vazirmatn-Regular\.woff2/.test(fontCtx.letEmbeddedFontCss()) && /Vazirmatn-Bold\.woff2/.test(fontCtx.letEmbeddedFontCss()));
} catch (eFont) {
  T('اجرای قرارداد فونت بدون خطا', false, eFont && eFont.stack || String(eFont));
}
T('فونت انتخاب چندپاراگرافی با fontName روی خود انتخاب اعمال می‌شود', letters.indexOf("document.execCommand('fontName', false, family)") > -1);
T('فونت کل سند روی ادیتور اعمال و Word inline override می‌شود', letters.indexOf("ed.style.fontFamily = token ? letFontCss(token) : ''") > -1 && letters.indexOf('.let-doc-font,.let-doc-font *{font-family:inherit!important}') > -1);
T('CSS فونت در هر دو خروجی چاپ تزریق می‌شود', count(letters, "<style>' + letEmbeddedFontCss()") === 2);
T('چینش پیش‌فرض فرم نامه و مسیر متن آماده هر دو justify است',
  letters.indexOf("!s.align || s.align === 'justify'") > -1 &&
  letters.indexOf('<option value="justify" selected>تراز دوطرفه (پیش‌فرض)</option>') > -1 &&
  count(letters, "align || 'justify'") >= 2);
T('فونت چاپ خطاب، سمت مخاطب، موضوع و امضا از فونت منتخب کل نامه می‌آید',
  letters.indexOf(".bsm,.to,.torl,.sub,.sigbox{font-family:' + bodyFont") > -1);
T('اندازهٔ مستقل نام امضاکننده در مدل و CSS چاپ مصرف می‌شود',
  letters.indexOf("signFs: +document.getElementById('ltSignFs').value") > -1 &&
  letters.indexOf("font-size:' + signerFs + 'pt") > -1 && letters.indexOf("font-size:' + signerRoleFs + 'pt") > -1);
T('گزینهٔ سایر، نام و سمت اجباری و مسیر ثبت فیزیکی دارد',
  letters.indexOf('value="__other__"') > -1 && letters.indexOf("l.st = 'registered'") > -1 &&
  letters.indexOf('l.manualSignature = true') > -1 && letters.indexOf("delete l.signatureSnapshot") > -1);

console.log('\n── مکاتبات: اجرای واقعی ثبت و چاپ ──');
try {
  var letterStore = { ptf_crm_letters: [], ptf_crm_users: [{ username: 'boss', name: 'نام کاربری', role: '' }], ptf_crm_sigprofiles: { boss: { nm: 'نام پروفایل', role: 'سمت پروفایل' } } };
  var letterEls = {}, letterAlerts = [], letterNotifies = 0, letterAudits = [], letterPreviews = [];
  function letterEl(value) {
    return { value: value == null ? '' : String(value), checked: false, innerHTML: '', innerText: '', textContent: '', style: {},
      addEventListener: function () {}, classList: { add: function () {}, remove: function () {} } };
  }
  var letterVals = {
    ltLang: 'fa', ltPrj: '', ltTo: 'شرکت نمونه', ltToRole: 'مدیر محترم بازرگانی', ltSub: 'موضوع آزمون',
    ltSigner: '__other__', ltSignerOtherName: 'نام دلخواه', ltSignerOtherRole: 'سمت دلخواه',
    ltFont: 'iransans', ltFs: '14', ltSignFs: '19', ltLh: '2', ltAlign: '',
    ltMt: '', ltMr: '', ltMb: '', ltMl: '', ltAtt: 'ندارد', ltBsm: '', ltB: '', ltI: '', ltBodyEditor: ''
  };
  Object.keys(letterVals).forEach(function (id) { letterEls[id] = letterEl(letterVals[id]); });
  letterEls.ltBodyEditor.innerHTML = '<p>متن آزمایشی نامه</p>';
  letterEls.ltBodyEditor.innerText = 'متن آزمایشی نامه';
  var letterCtx = {
    window: null, console: console, JSON: JSON, Math: Math, Date: Date, Intl: Intl,
    Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error,
    document: { getElementById: function (id) { return letterEls[id] || null; }, querySelectorAll: function () { return []; } },
    getData: function (k) { return letterStore[k] === undefined ? [] : letterStore[k]; },
    setData: function (k, v) { letterStore[k] = v; return true; },
    curSession: function () { return { user: 'author', name: 'نویسندهٔ آزمون' }; },
    curRole: function () { return 'admin'; }, roleDef: function () { return { panels: '*' }; },
    genCode: function () { return 'LET-TEST'; }, faDateTime: function () { return '1405/06/02 12:00'; },
    faDate: function () { return '1405/06/02'; }, faYear: function () { return '1405'; },
    escP: function (v) { return String(v == null ? '' : v); }, ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    sigProfileFor: function (user) { return user === 'boss' ? { nm: 'نام پروفایل', role: 'سمت پروفایل' } : {}; }, hideModal: function () {}, renderLetters: function () {}, goPanel: function () {},
    audit: function () { letterAudits.push([].slice.call(arguments)); }, notify: function () { letterNotifies++; },
    alert: function (m) { letterAlerts.push(m); }, confirm: function () { return false; },
    ptfPreviewPrintableDoc: function () { letterPreviews.push([].slice.call(arguments)); },
    setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    FileReader: function () {}
  };
  letterCtx.window = letterCtx; letterCtx.globalThis = letterCtx;
  vm.createContext(letterCtx);
  vm.runInContext(letters, letterCtx, { filename: 'letters-runtime.js' });
  /* sanitizer به DOM واقعی متکی است؛ این تست مدل/lifecycle/print را با HTML امن ثابت اجرا می‌کند. */
  letterCtx.letSafeBodyHtml = function (html) { return String(html || ''); };
  var collectedLetter = letterCtx._collectLetter(null);
  T('مدل runtime چینش خالی را justify و فونت/اندازهٔ امضا را ذخیره می‌کند',
    collectedLetter.style.align === 'justify' && collectedLetter.style.font === 'iransans' && collectedLetter.style.signFs === 19, collectedLetter.style);
  T('مدل runtime نام و سمت امضاکنندهٔ سایر را با هم ذخیره می‌کند',
    collectedLetter.signerMode === 'other' && collectedLetter.signerNm === 'نام دلخواه' && collectedLetter.signerRole === 'سمت دلخواه', collectedLetter);
  letterEls.ltSigner.value = 'boss';
  var profileSignerLetter = letterCtx._collectLetter(null);
  T('نام و سمت امضاکنندهٔ سازمانی از پروفایل امضا resolve می‌شود',
    profileSignerLetter.signerNm === 'نام پروفایل' && profileSignerLetter.signerRole === 'سمت پروفایل', profileSignerLetter);
  letterEls.ltSigner.value = '__other__';
  var completeAlertsBefore = letterAlerts.length;
  collectedLetter.signerRole = '';
  T('اعتبارسنج runtime نبود سمت امضاکننده را fail-closed رد می‌کند',
    letterCtx.letSignerComplete(collectedLetter) === false && letterAlerts.length === completeAlertsBefore + 1);
  letterEls.ltSignerOtherRole.value = 'سمت دلخواه';
  letterCtx.letSubmit(null);
  var registeredLetter = letterStore.ptf_crm_letters[0] || {};
  T('سایر با شماره قطعی و وضعیت registered برای امضای فیزیکی ثبت می‌شود',
    registeredLetter.st === 'registered' && !!registeredLetter.no && registeredLetter.manualSignature === true, registeredLetter);
  T('ثبت سایر اعلان دیجیتال و snapshot امضا تولید نمی‌کند',
    letterNotifies === 0 && !registeredLetter.signatureSnapshot && letterAudits.length === 1, { notifies: letterNotifies, letter: registeredLetter });
  letterCtx.letPrint('LET-TEST', false, false);
  var printedLetter = letterPreviews[0] && letterPreviews[0][1] || '';
  T('چاپ runtime پیش‌فرض justify را اعمال می‌کند', printedLetter.indexOf('text-align:justify') > -1);
  T('چاپ runtime فونت انتخابی را به خطاب، سمت مخاطب، موضوع و امضا می‌دهد',
    printedLetter.indexOf('.bsm,.to,.torl,.sub,.sigbox{font-family:') > -1 && printedLetter.indexOf("'IRANSans'") > -1);
  T('چاپ runtime اندازهٔ ۱۹ نام و اندازهٔ ۱۷ سمت امضاکننده را اعمال می‌کند',
    printedLetter.indexOf('.sigbox .nm{font-weight:800;font-size:19pt') > -1 && printedLetter.indexOf('.sigbox .rl{font-weight:700;font-size:17pt') > -1);
  T('چاپ runtime نام و سمت امضاکننده را همیشه کنار هم دارد',
    printedLetter.indexOf('<div class="nm">نام دلخواه</div><div class="rl">سمت دلخواه</div>') > -1);

  letterStore.ptf_crm_users.push({ username: 'author', name: 'نام کاربری امضاکننده', role: 'سمت سازمانی' });
  letterStore.ptf_crm_sigprofiles.author = { sig: 'data:image/png;base64,AA', nm: 'نام پروفایل امضا', role: '' };
  letterStore.ptf_crm_letters.unshift({ cd: 'LET-PENDING', kind: 'OUT', signer: 'author', signerNm: 'نام قبلی', signerRole: '',
    author: 'writer', subject: 'نامه در انتظار', st: 'pending', lang: 'fa', style: {}, body: 'متن' });
  var signConfirmCount = 0;
  letterCtx.confirm = function () { signConfirmCount++; return signConfirmCount === 1; };
  letterCtx.letSign('LET-PENDING');
  var signedWithUserRole = letterStore.ptf_crm_letters.filter(function (x) { return x.cd === 'LET-PENDING'; })[0] || {};
  T('امضای دیجیتال نام پروفایل و سمت سازمانی fallback را با هم snapshot می‌کند',
    signedWithUserRole.st === 'signed' && signedWithUserRole.signerNm === 'نام پروفایل امضا' &&
    signedWithUserRole.signerRole === 'سمت سازمانی' && (signedWithUserRole.signatureSnapshot || {}).role === 'سمت سازمانی', signedWithUserRole);

  letterEls = {};
  var lhpVals = { lhpEditor: '', lhpLang: 'fa', lhpSigMode: 'none', lhpDate: '', lhpNo: '', lhpAtt: '',
    lhpFs: '', lhpLh: '', lhpFont: 'vazir', lhpAlign: '', lhpB: '', lhpI: '', lhpMt: '', lhpMr: '', lhpMb: '', lhpMl: '' };
  Object.keys(lhpVals).forEach(function (id) { letterEls[id] = letterEl(lhpVals[id]); });
  letterEls.lhpEditor.innerHTML = '<p>متن آماده</p>'; letterEls.lhpEditor.textContent = 'متن آماده';
  letterCtx.ptfLetterheadPastePrint();
  var printedLetterhead = letterPreviews[1] && letterPreviews[1][1] || '';
  T('مسیر متن آمادهٔ سربرگ نیز runtime به justify fallback می‌کند', printedLetterhead.indexOf('text-align:justify') > -1);
  T('فونت منتخب مسیر سربرگ روی کل محتوای آماده override می‌شود',
    printedLetterhead.indexOf('.body,.body *{font-family:Vazirmatn') > -1);
} catch (eLetterRuntime) {
  T('اجرای رفتاری مکاتبات بدون خطا', false, eLetterRuntime && eLetterRuntime.stack || String(eLetterRuntime));
}

console.log('\n── پروندهٔ برنده: ابلاغ سفارش و قرارداد ──');
try {
  var cases = [
    { cd: 'CASE-WON', _id: 'CASE-ID', inqNo: 'INQ-1', wonOffer: 'OFF-1', docs: [] },
    { cd: 'CASE-OPEN', inqNo: 'INQ-2', docs: [] }
  ];
  var auditRows = [], saved = 0, seq = 0;
  var sfCtx = {
    window: null, JSON: JSON,
    sfAll: function () { return cases; }, sfSave: function () { saved++; },
    genCode: function () { seq++; return 'DOC-' + seq; },
    faDate: function () { return '1405/06/02'; }, faDateTime: function () { return '1405/06/02 10:00'; },
    curSession: function () { return { name: 'کاربر آزمون' }; },
    audit: function (a, b, c) { auditRows.push([a, b, c]); }
  };
  sfCtx.window = sfCtx;
  vm.createContext(sfCtx);
  vm.runInContext(between(salesfiles, 'var SF_POST_AWARD_DOC_TYPES', 'window.sfPostAwardDocOpen'), sfCtx, { filename: 'salesfiles-post-award.js' });
  var notice = sfCtx.sfPostAwardDocCommit('CASE-WON', 'order_notice', { name: 'notice.pdf', key: 'cloud/n', size: 120 });
  var contract = sfCtx.sfPostAwardDocCommit('CASE-WON', 'contract', { name: 'contract.pdf', key: 'cloud/c', size: 240 });
  var blocked = sfCtx.sfPostAwardDocCommit('CASE-OPEN', 'contract', { name: 'bad.pdf', key: 'cloud/b' });
  T('ابلاغ سفارش و قرارداد برای پروندهٔ برنده ثبت می‌شوند', notice.ok === true && contract.ok === true && cases[0].docs.length === 2);
  T('اسناد با نوع ساختاریافته و کلاس post_award ذخیره می‌شوند',
    cases[0].docs[0].docType === 'order_notice' && cases[0].docs[1].docType === 'contract' && cases[0].docs.every(function (d) { return d.documentClass === 'post_award'; }));
  T('فایل ابری، نسخه، پرونده و پیشنهاد برنده حفظ می‌شوند',
    cases[0].docs[0].key === 'cloud/n' && cases[0].docs[0].version === 1 && cases[0].docs[0].caseId === 'CASE-ID' && cases[0].docs[0].wonOffer === 'OFF-1');
  T('هر ثبت در documentAudit و timeline اثر می‌گذارد', cases[0].documentAudit.length === 2 && cases[0].timeline.length === 2 && auditRows.length === 2 && saved === 2);
  T('ثبت سند برای پروندهٔ بدون برد fail-closed است', blocked.ok === false && blocked.why === 'not_awarded' && cases[1].docs.length === 0, blocked);
} catch (eSf) {
  T('اجرای رفتاری ثبت اسناد پرونده بدون خطا', false, eSf && eSf.stack || String(eSf));
}
T('دو اکشن ابلاغ سفارش و قرارداد فقط در بلوک wonOffer رندر می‌شوند',
  salesfiles.indexOf("'order-notice', '📨', 'سند ابلاغ سفارش'") > -1 && salesfiles.indexOf("'contract-file', '📝', 'قرارداد'") > -1);
T('نوع سند در ویرایش، جایگزینی و حذف lifecycle حفظ می‌شود', count(salesfiles, "docType || 'misc'") >= 3);

console.log('\n── OPEX تکرارشونده: تسویه و خروج واقعی خزانه ──');
try {
  var store = {
    ptf_crm_opex: [
      { cd: 'OPX-NORMAL', _opexRowId: 'ROW-N', cat: 'اداری', amt: 300, month: '1405/06', t: '2026-08-20' },
      { cd: 'OPX-REC', _opexRowId: 'ROW-R', cat: 'اجاره', amt: 500, month: '1405/06', tplId: 'TPL-1', t: '2026-08-20' },
      { cd: 'OPX-CHEQUE', _opexRowId: 'ROW-C', cat: 'اینترنت', amt: 700, month: '1405/06', tplId: 'TPL-2', chequeCd: 'CH-1', payHow: 'cheque', t: '2026-08-20' }
    ],
    ptf_crm_fiscal_snapshots: [], ptf_crm_deals: [], ptf_crm_case_receipts: [], ptf_crm_invoices: [],
    ptf_crm_supplier_finance: [], ptf_crm_payables: [], ptf_crm_petty_tx: [], ptf_crm_cheques_issued: [],
    ptf_crm_cheques_received: [], ptf_crm_cheques: [], ptf_crm_treasury_calls: [], ptf_crm_sharetx: []
  };
  var oxCtx = {
    console: console, window: null, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; return true; },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    curRole: function () { return 'chairman'; }, isSenior: function () { return true; }, roleDef: function () { return { finance: true, buyPrice: true }; },
    curSession: function () { return { name: 'مالی آزمون' }; }, faDate: function () { return '1405/06/02'; }, faDateTime: function () { return '1405/06/02 11:22'; },
    ptfTodayISO: function () { return '2026-08-24'; }, ptfFaMonthNow: function () { return '1405/06'; },
    genCode: function (p) { return p + '-1'; }, escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; } },
    setInterval: function () { return 0; }, clearInterval: function () {}, audit: function () {}, alert: function () {}, confirm: function () { return true; }
  };
  oxCtx.window = oxCtx;
  vm.createContext(oxCtx);
  vm.runInContext(opex, oxCtx, { filename: 'opex.js' });
  vm.runInContext(treasury, oxCtx, { filename: 'treasury.js' });

  var before = oxCtx.ptfTreasuryCrmMoves();
  T('قبل از تسویه فقط OPEX عادی خروج دارد', before.filter(function (m) { return m.key.indexOf('opex:') === 0; }).length === 1 && before[0].key === 'opex:ROW-N', before);
  T('هزینهٔ تکرارشونده settlement-required و در ابتدا باز است', oxCtx.ptfOpexSettlementRequired(store.ptf_crm_opex[1]) === true && oxCtx.ptfOpexIsSettled(store.ptf_crm_opex[1]) === false);
  var noDoc = oxCtx.ptfOpexSettleCommit(store.ptf_crm_opex[1], { doc: '' });
  T('تسویه بدون سند پرداخت رد می‌شود', noDoc.ok === false && noDoc.why === 'doc', noDoc);
  var done = oxCtx.ptfOpexSettleCommit(store.ptf_crm_opex[1], { doc: 'حواله ۱۲۳', files: [{ key: 'receipt/123', name: 'receipt.pdf' }] });
  T('تسویه با سند موفق و تاریخ/کاربر/فایل ثبت می‌شود', done.ok === true && store.ptf_crm_opex[1].st === 'settled' && store.ptf_crm_opex[1].settleISO === '2026-08-24' && store.ptf_crm_opex[1].settledBy === 'مالی آزمون' && store.ptf_crm_opex[1].files.length === 1, store.ptf_crm_opex[1]);
  var after = oxCtx.ptfTreasuryCrmMoves();
  var recurringMoves = after.filter(function (m) { return m.key === 'opex:ROW-R'; });
  T('پس از تسویه دقیقاً یک خروج نقد برای recurring ساخته می‌شود', recurringMoves.length === 1 && recurringMoves[0].dir === 'out' && recurringMoves[0].amount === 500, recurringMoves);
  T('تاریخ خروج دقیقاً تاریخ تسویه است', recurringMoves[0] && recurringMoves[0].dateISO === '2026-08-24' && recurringMoves[0].dateFa === '1405/06/02 11:22', recurringMoves[0]);
  T('recurring دارای chequeCd خروج OPEX جدا نمی‌سازد', after.every(function (m) { return m.key !== 'opex:ROW-C'; }), after);
  var again = oxCtx.ptfOpexSettleCommit(store.ptf_crm_opex[1], { doc: 'دوباره' });
  T('تسویهٔ دوباره رد می‌شود و خروج خزانه تکثیر نمی‌شود', again.ok === false && again.why === 'already' && oxCtx.ptfTreasuryCrmMoves().filter(function (m) { return m.key === 'opex:ROW-R'; }).length === 1, again);
  T('ثبت تسویه هزینه را در سود دوباره‌شماری نمی‌کند', oxCtx.ptfOpexSumFiscal('1405').total === 1500, oxCtx.ptfOpexSumFiscal('1405'));
} catch (eOx) {
  T('اجرای رفتاری OPEX و خزانه بدون خطا', false, eOx && eOx.stack || String(eOx));
}
T('جدول recurring باز اکشن عمومی تسویه و اکشن سند دارد',
  opex.indexOf("opexSettlementRequired(x) && !opexSettled(x)") > -1 && opex.indexOf("'ptfOpexSettle(\\''") > -1 && opex.indexOf("opexAction('attach', '📎'") > -1);

console.log('\n── reconcile: بدون mutation و پیام تکراری ──');
var salaryBlock = between(api, "elseif ($action === 'reconcile_shareholder_salaries' || $action === 'reconcile_recurring_opex')", "elseif ($action === 'schedule_recurring_opex_cheque')");
T('metadata گردش حقوق فقط در صورت تغییر واقعی نوشته می‌شود',
  salaryBlock.indexOf("if(json_encode($sharetx[$txIndex])!==$before){$sharetx[$txIndex]['updatedT']=$now;$sharetx[$txIndex]['updatedBy']=$user;$updated++;}") > -1);
T('metadata OPEX حقوق فقط در صورت تغییر واقعی نوشته می‌شود',
  salaryBlock.indexOf("if(json_encode($opex[$oxIndex])!==$before){$opex[$oxIndex]['updatedAtISO']=$now;$opex[$oxIndex]['updatedBy']=$user;$updated++;}") > -1);
try {
  var toasts = [], renders = 0;
  var toastCtx = {
    window: null,
    canFin: function () { return true; },
    ptfAutoApplyRecurring: function () { return { complete: true, month: '1405/06', salaries: 2, tpls: 3, repaired: 0 }; },
    ptfToast: function (msg) { toasts.push(msg); }, ptfOpexRender: function () { renders++; }, _finHubTab: 'opex'
  };
  toastCtx.window = toastCtx;
  vm.createContext(toastCtx);
  vm.runInContext(between(opex, 'function refreshRecurringFinancialViews', 'function scheduleRecurringRetry'), toastCtx, { filename: 'opex-recurring-toast.js' });
  toastCtx.finishLocalRecurring({ response: { idempotent: true, result: { created: 2, updated: 1 } } });
  T('replay همان idempotency key پیام موفقیت تکراری نمی‌دهد ولی projection جاری را رندر می‌کند', toasts.length === 0 && renders === 1, toasts);
  toastCtx.finishLocalRecurring({ response: { result: { created: 2, updated: 0 } } });
  T('تغییر واقعی تازه همچنان یک پیام و refresh می‌دهد', toasts.length === 1 && renders === 2, toasts);
} catch (eToast) {
  T('اجرای رفتاری ضدتکرار پیام reconcile بدون خطا', false, eToast && eToast.stack || String(eToast));
}

T('tester502 در گیت CI ثبت شده است', gate.indexOf('tester502-v34.8.0-letters-award-opex.js') > -1);
console.log('\n— tester502 (v34.28.0: مکاتبات، اسناد برنده و تسویه OPEX) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
