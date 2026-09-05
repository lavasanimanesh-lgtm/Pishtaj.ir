#!/usr/bin/env node
'use strict';
/* tester497 — v34.37.5 (RE-UPLOAD-QUEUE-001 فاز A)
   «صف آپلود مجدد» ردهٔ E: build از خروجی audit + CSV با BOM + محدود به ردهٔ E.
   بدون تغییر منطق audit موجود. */

var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : JSON.stringify(d)); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var storage = read('crm/storage.js');

T('VERSION.json = v34.37.5', ver.crm_version === 'v34.37.5', ver.crm_version);
T('تابع ptfReuploadQueueBuild تعریف شده', /function\s+ptfReuploadQueueBuild\s*\(/.test(storage));
T('تابع ptfReuploadQueueExportCsv تعریف شده', /function\s+ptfReuploadQueueExportCsv\s*\(/.test(storage));
T('روی window expose شده', /window\.ptfReuploadQueueBuild\s*=/.test(storage) && /window\.ptfReuploadQueueExportCsv\s*=/.test(storage));
T('BOM UTF-8 در CSV تزریق می‌شود', storage.indexOf('\\uFEFF') > -1);
T('دکمه صف آپلود مجدد فقط وقتی c.E > 0 نمایش داده می‌شود',
  storage.indexOf('(c.E > 0)') > -1 && storage.indexOf('ptfReuploadQueueExportCsv') > -1);

/* ---------- sandbox ---------- */
var files = {};
function persist() {}
var sb = {
  console: console, Math: Math, Date: Date, JSON: JSON,
  window: null,
  document: {
    getElementById: function () { return null; },
    querySelectorAll: function () { return []; },
    body: { appendChild: function () {}, removeChild: function () {} },
    createElement: function () {
      return {
        _href: '', _download: '',
        set href(v) { this._href = v; }, get href() { return this._href; },
        set download(v) { this._download = v; }, get download() { return this._download; },
        click: function () { files[this._download] = true; },
        remove: function () {}
      };
    }
  },
  Blob: function (parts, opts) { this.parts = parts; this.type = (opts || {}).type; },
  URL: { createObjectURL: function () { return 'blob:test'; } },
  localStorage: {
    _kv: {},
    length: 0,
    key: function (i) { var ks = Object.keys(this._kv); return ks[i] || null; },
    getItem: function (k) { return this._kv[k] || null; },
    setItem: function (k, v) { if (!(k in this._kv)) this.length++; this._kv[k] = v; },
    removeItem: function (k) { if (k in this._kv) this.length--; delete this._kv[k]; }
  },
  getData: function () { return null; },
  setData: function () {},
  faDateTime: function () { return '1405/05/31 10:00'; },
  faDate: function () { return '1405/05/31'; },
  audit: function () {},
  ptfToast: function (msg, kind) { sb._lastToast = { msg: msg, kind: kind }; },
  alert: function () {},
  fetch: function () { return { then: function () { return { then: function () { return { catch: function () {} }; }, catch: function () {} }; } }; },
  curRole: function () { return sb._role || 'admin'; },
  escP: function (v) { return String(v == null ? '' : v); }
};
sb.window = sb;
vm.createContext(sb);
try {
  /* فقط بخش‌های مربوطه را ارزیابی می‌کنیم — کل فایل نیاز به وابستگی‌های زیاد دارد.
     شبیه‌سازی: توابع مورد نیاز را با تعریف مستقیم به دست می‌آوریم. */
  var startIdx = storage.indexOf('function ptfReuploadQueueBuild');
  /* بعد از window.ptfReuploadQueueExportCsv = …; خطی جدید یا EOF می‌آید */
  var endMarker = 'window.ptfReuploadQueueExportCsv = ptfReuploadQueueExportCsv;';
  var endIdx = storage.indexOf(endMarker) + endMarker.length;
  var snippet = storage.substring(startIdx, endIdx);
  vm.runInContext(snippet, sb, { filename: 'reupload-queue.js' });
} catch (e) {
  console.error('LOAD FAIL:', e.message);
  process.exit(1);
}

/* ----- سناریو 1: build فقط ردهٔ E را برمی‌گرداند ----- */
var rows = [
  { cls: 'A', store: 'ptf_crm_suppliers', recId: 'S1', recLabel: 'ش الف', key: 'site-ven/a.pdf', name: 'a.pdf' },
  { cls: 'B', store: 'ptf_crm_suppliers', recId: 'S2', recLabel: 'ش ب', key: 'ven/b.pdf', match: 'site-ven/b.pdf', name: 'b.pdf' },
  { cls: 'C', store: 'ptf_crm_offers', recId: 'O1', recLabel: 'p1', key: 'archives/2025.zip', name: '2025.zip' },
  { cls: 'E', store: 'ptf_crm_suppliers', recId: 'S3', recLabel: 'ش ج', key: 'site-ven/lost.pdf', name: 'lost.pdf', note: 'در باکت نیست' },
  { cls: 'E', store: 'ptf_crm_customers', recId: 'C1', recLabel: 'کارفرمای الف', key: 'site-rfq/lost2.pdf', name: 'lost2.pdf' },
  { cls: 'F', store: 'ptf_crm_leads', recId: 'L1', recLabel: 'لید', key: 'data:...', name: 'inline' }
];
sb.window._ptfKeyAuditRows = rows;
var q = sb.window.ptfReuploadQueueBuild();
T('build فقط ردیف‌های E را برمی‌گرداند (۲ عدد)', q.length === 2, q.length);
T('ترتیب حفظ می‌شود و فیلد module اضافه می‌شود',
  q[0].module === 'تامین‌کننده' && q[0].recId === 'S3' &&
  q[1].module === 'کارفرما' && q[1].recId === 'C1', q);
T('نام فایل از key استخراج می‌شود اگر name نبود',
  sb.window.ptfReuploadQueueBuild([{ cls: 'E', store: 'x', key: 'a/b/c.pdf' }])[0].name === 'c.pdf');

/* ----- سناریو 2: ماژول ناشناخته با prefix ptf_crm_ حذف می‌شود ----- */
var qUnknown = sb.window.ptfReuploadQueueBuild([{ cls: 'E', store: 'ptf_crm_unknown_module', recId: 'X1', key: 'x/y.pdf' }]);
T('ماژول ناشناخته → متن پس از حذف ptf_crm_', qUnknown[0].module === 'unknown_module', qUnknown[0].module);

/* ----- سناریو 3: صف خالی → toast اطلاعی + بدون دانلود ----- */
sb.window._ptfKeyAuditRows = [];
sb._lastToast = null;
files = {};
sb.window.ptfReuploadQueueExportCsv();
T('صف خالی → toast اطلاعی', sb._lastToast && sb._lastToast.msg.indexOf('خالی') > -1, sb._lastToast);
T('صف خالی → هیچ فایلی دانلود نشد', Object.keys(files).length === 0, files);

/* ----- سناریو 4: صف با ۲ ردیف → دانلود با نام درست + BOM ----- */
sb.window._ptfKeyAuditRows = rows;
files = {};
sb._lastToast = null;
sb.window.ptfReuploadQueueExportCsv();
T('CSV دانلود شد با نام درست', files['ptf-reupload-queue-E.csv'] === true, files);
T('toast موفقیت با تعداد', sb._lastToast && sb._lastToast.kind === 'ok' && sb._lastToast.msg.indexOf('۲') === -1 /* عدد لاتین است */, sb._lastToast);

/* ----- سناریو 5: بدون آرگومان، از _ptfKeyAuditRows می‌خواند ----- */
var qNoArg = sb.window.ptfReuploadQueueBuild();
T('build بدون آرگومان از _ptfKeyAuditRows می‌خواند', qNoArg.length === 2);

/* ----- سناریو 6: ردیف بدون store یا cls رد شود بدون crash ----- */
var qBad = sb.window.ptfReuploadQueueBuild([null, undefined, {}, { cls: 'E' }]);
T('ردیف‌های ناقص crash نکنند', Array.isArray(qBad), qBad);
T('ردیف {cls:"E"} با key خالی هم بدون crash خروج می‌گیرد', qBad.length === 1, qBad);

/* ----- سناریو 7: گارد نقش — کاربر با نقش پایین رد شود (v34.37.5 RE-UPLOAD-QUEUE-002) ----- */
sb._role = 'sales';
sb.window._ptfKeyAuditRows = rows;  /* داده معتبر هست */
files = {};
sb._lastToast = null;
sb.window.ptfReuploadQueueExportCsv();
T('گارد نقش: کاربر sales نمی‌تواند CSV بگیرد',
  Object.keys(files).length === 0 && sb._lastToast && sb._lastToast.kind === 'err',
  { files: files, toast: sb._lastToast });
T('گارد نقش: پیام خطا شامل «ارشد» است',
  sb._lastToast && sb._lastToast.msg.indexOf('ارشد') > -1,
  sb._lastToast);
sb._role = 'admin';  /* بازگرداندن */

/* ----- سناریو 8: تستر در گیت CI ثبت شده ----- */
T('tester497 در گیت CI ثبت شده', read('_tools/uat/run-ci-gate.js').indexOf('tester497-v34.7.95-reupload-queue.js') > -1);

console.log('\n— tester497 (v34.37.5: صف آپلود مجدد ردهٔ E — RE-UPLOAD-QUEUE-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
