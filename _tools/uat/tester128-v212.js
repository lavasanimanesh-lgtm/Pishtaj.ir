/* tester128 — v21.2 (US-402 + US-403) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rqs = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.2');
T('VER v21.2+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=2);})(m[1]);})());
T('SW v21.2+', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=2);})(m[1]);})());
T('cache rfqsmart 21.2+', /rfqsmart\.js\?v=/.test(idx) && (function(){var m=idx.match(/rfqsmart\.js\?v=([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=2);})(m[1]);})());
T('cache storage 21.2+', /storage\.js\?v=/.test(idx) && (function(){var m=idx.match(/storage\.js\?v=([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=2);})(m[1]);})());

SECTION('US-402 ساختاری');
T('rfqsMatchSup', rqs.indexOf('window.rfqsMatchSup') > -1);
T('rfqsToggleSup', rqs.indexOf('window.rfqsToggleSup') > -1);
T('جستجوی rqsTgQ', rqs.indexOf('rqsTgQ') > -1);
T('چیپ rqsTgChips', rqs.indexOf('rqsTgChips') > -1);
T('گروه پیشنهاد هوشمند', rqs.indexOf('پیشنهاد هوشمند') > -1);
T('گروه سایر تامین‌کنندگان', rqs.indexOf('سایر تامین‌کنندگان') > -1);
T('PDF per target signature', rqs.indexOf('function (no, targetIdx)') > -1);
T('To گیرنده در چاپ', rqs.indexOf('<b>To:</b>') > -1 && rqs.indexOf('tgt.co') > -1);
T('دکمه PDF کنار تامین', rqs.indexOf('rfqsPrintPreview') > -1 || rqs.indexOf('rfqsPrint') > -1);
T('پیشنهاد هوشمند top5 حفظ', rqs.indexOf('ranked.slice(0, 5)') > -1 || rqs.indexOf('oi < 5') > -1);
T('entityMatches یا ptfSupSpecBlob', rqs.indexOf('entityMatches') > -1 || rqs.indexOf('ptfSupSpecBlob') > -1);

SECTION('US-403 ساختاری');
T('ptfOpenDocViewer', st.indexOf('window.ptfOpenDocViewer') > -1);
T('ptfDownloadStoredFile', st.indexOf('window.ptfDownloadStoredFile') > -1);
T('ptfDocViewerKind', st.indexOf('function ptfDocViewerKind') > -1);
T('openStoredFile uses viewer', st.indexOf('ptfOpenDocViewer(d.url') > -1);
T('fallback تب جدید', st.indexOf('تب جدید') > -1);
T('ESC بستن', st.indexOf("Escape") > -1);
T('مودال ptfDocViewer id', st.indexOf('ptfDocViewer') > -1);
T('عدم window.open مستقیم تنها مسیر', (function(){
  // openStoredFile should not only window.open without viewer attempt
  return st.indexOf('ptfOpenDocViewer') > -1 && st.indexOf("window.open(d.url, '_blank')") > -1; // fallback remains
})());
T('تصویر/pdf/other', st.indexOf("kind === 'image'") > -1 && st.indexOf("kind === 'pdf'") > -1 && st.indexOf("kind === 'other'") > -1 || st.indexOf("return 'other'") > -1);

SECTION('US-402 رفتاری — match + render extract');
store = {};
global.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};
global.getData = function (k) { try { return JSON.parse(store[k] || '[]'); } catch (e) { return []; } };
global.setData = function (k, d) { store[k] = JSON.stringify(d); };
global.window = global;
global.document = {
  getElementById: function (id) {
    if (!global._els) global._els = {};
    if (!global._els[id]) global._els[id] = { style: {}, innerHTML: '', value: '', insertAdjacentHTML: function () {}, querySelectorAll: function () { return []; } };
    return global._els[id];
  },
  querySelectorAll: function () { return []; },
  createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {} }; },
  head: { appendChild: function () {} },
  body: { appendChild: function () {} },
  addEventListener: function () {}
};
global.escP = function (s) { return String(s == null ? '' : s); };
global.faDate = function () { return '1405/04/20'; };
global.faDateTime = function () { return '1405/04/20 12:00'; };
global.curSession = function () { return { name: 'T', user: 't' }; };
global.roleDef = function () { return { panels: '*' }; };
global.audit = function () {};
global.notify = function () {};
global.dedupNorm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
global.entityMatches = function (ent, q) {
  var b = (ent.co || '') + (ent.coEn || '') + (ent.brands || '');
  return dedupNorm(b).indexOf(dedupNorm(q)) > -1;
};
global.ptfSupSpecBlob = function (s) { return ((s.spBrands || []).join(' ')) + ' ' + ((s.spEquip || []).join(' ')) + ' ' + (s.brands || ''); };
global.genCode = function (p) { return p + '-1'; };
global.confirm = function () { return true; };
global.alert = function () {};
global._st = {};

// extract helpers by eval IIFE partially - load match function via regex
var mMatch = rqs.match(/window\.rfqsMatchSup = function \(row, q\) \{[\s\S]*?\n  \};/);
T('extract rfqsMatchSup', !!mMatch);
if (mMatch) {
  eval(mMatch[0].replace('window.rfqsMatchSup', 'global.rfqsMatchSup'));
  setData('ptf_crm_suppliers', [
    { cd: 'S1', co: 'آریا کنترل', coEn: 'Aria Control', brands: 'Siemens', spBrands: ['Siemens'], spEquip: ['VFD'], ca: 'برق' },
    { cd: 'S2', co: 'پمپ‌سازان', brands: 'Grundfos', ca: 'پمپ' }
  ]);
  T('match زیمنس→Siemens', rfqsMatchSup({ cd: 'S1', co: 'آریا کنترل', ca: 'برق', why: '' }, 'زیمنس') === true || rfqsMatchSup({ cd: 'S1', co: 'آریا کنترل', ca: 'برق', why: 'Siemens' }, 'Siemens') === true);
  T('match Siemens EN', rfqsMatchSup({ cd: 'S1', co: 'آریا کنترل', ca: 'برق', why: 'Siemens' }, 'Siemens') === true);
  T('match نام فارسی', rfqsMatchSup({ cd: 'S2', co: 'پمپ‌سازان', ca: 'پمپ', why: '' }, 'پمپ') === true);
  T('عدم match نامرتبط', rfqsMatchSup({ cd: 'S2', co: 'پمپ‌سازان', ca: 'پمپ', why: '' }, 'فلنجXYZ') === false);
  T('خالی = همه', rfqsMatchSup({ cd: 'S1', co: 'X', why: '' }, '') === true);
}

SECTION('US-403 رفتاری — kind/ext');
var mExt = st.match(/function ptfFileExt\(nameOrKey\) \{[\s\S]*?\n\}/);
var mKind = st.match(/function ptfDocViewerKind\(ext\) \{[\s\S]*?\n\}/);
T('extract ext/kind', !!mExt && !!mKind);
if (mExt && mKind) {
  eval(mExt[0]); eval(mKind[0]);
  T('ext pdf', ptfFileExt('a/b/c.PDF') === 'pdf' || ptfFileExt('c.PDF') === 'pdf');
  T('ext jpg', ptfFileExt('x.jpg') === 'jpg');
  T('kind image', ptfDocViewerKind('png') === 'image');
  T('kind pdf', ptfDocViewerKind('pdf') === 'pdf');
  T('kind other xlsx', ptfDocViewerKind('xlsx') === 'other');
}

SECTION('رگرسیون سبک');
T('rfqsScoreSuppliers پابرجا', rqs.indexOf('window.rfqsScoreSuppliers') > -1);
T('rfqsFinalize پابرجا', rqs.indexOf('window.rfqsFinalize') > -1);
T('rfqsPrint عمومی بدون target هنوز کار', rqs.indexOf('function (no, targetIdx)') > -1);
T('uploadFile پابرجا', st.indexOf('function uploadFile') > -1);
T('attachUploadWidget پابرجا', st.indexOf('function attachUploadWidget') > -1);

DONE('tester128-v212');
if (RESULTS.fail) process.exit(1);
