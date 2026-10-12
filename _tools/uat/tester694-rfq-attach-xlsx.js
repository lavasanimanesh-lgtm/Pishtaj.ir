/* tester694 — پیوست فایل اکسل (و Word/zip) در مودال «ثبت درخواست جدید»
   ریشه: ویجت attachUploadWidget فقط تصویر و PDF را می‌پذیرد (ptfAllowedExts)، در حالی که
   مودال درخواست فرمت‌های Word/Excel/zip را اعلام می‌کند. این تست بررسی می‌کند:
   1) مودال درخواست فهرست فرمت‌های خودش را به ویجت می‌دهد.
   2) ویجت عمومی (تنخواه/چک/…) رفتار قبلی را حفظ می‌کند.
   3) فهرست درخواست با فهرست سرور (save_attachment) هم‌خوان است. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
var storage = fs.readFileSync(path.join(root, 'crm/storage.js'), 'utf8');
var bridge = fs.readFileSync(path.join(root, 'crm/bridge.js'), 'utf8');
var crm = fs.readFileSync(path.join(root, 'api/crm.php'), 'utf8');

var results = { pass: 0, fail: 0 };
function T(name, fn) {
  try { fn(); results.pass++; console.log('  ✔ ' + name); }
  catch (e) { results.fail++; console.log('  ✘ ' + name + ' — ' + e.message); }
}

// 1) مودال درخواست
var rfqList = /var RFQ_ATTACH_EXTS = (\[[^\]]*\]);/.exec(bridge);
T('bridge.js فهرست RFQ_ATTACH_EXTS را تعریف می‌کند', function () { assert.ok(rfqList); });
T('فهرست درخواست شامل xls/xlsx/doc/docx/zip است', function () {
  var list = JSON.parse(rfqList[1].replace(/'/g, '"'));
  ['xls', 'xlsx', 'doc', 'docx', 'zip', 'pdf', 'jpg', 'png'].forEach(function (e) {
    assert.ok(list.indexOf(e) > -1, 'missing ' + e);
  });
});
T('initRfqModal فهرست درخواست را به attachUploadWidget پاس می‌دهد', function () {
  var i = bridge.indexOf('function initRfqModal()');
  var j = bridge.indexOf('rfqTab(\'inq\');', i);
  assert.ok(i > -1 && j > i);
  assert.ok(/attachUploadWidget\('rUp_' \+ k, 'rfq\/' \+ k, function[\s\S]*?\}, null, \{ allowedExts: RFQ_ATTACH_EXTS \}\);/.test(bridge.slice(i, j)));
});

// 2) رفتار ptfIsAllowedFile (اجرای واقعی تابع از storage.js)
var start = storage.indexOf('var ptfAllowedExts');
var end = storage.indexOf('window.ptfAllowedExts = ptfAllowedExts;');
var ctx = { fmtSize: function (n) { return n + ' B'; } };
vm.createContext(ctx);
vm.runInContext(storage.slice(start, end), ctx);
var RFQ = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'zip', 'rar'];
function f(name, size) { return { name: name, size: size || 1000 }; }

T('درخواست: Excel (.xlsx/.xls) پذیرفته می‌شود', function () {
  assert.strictEqual(ctx.ptfIsAllowedFile(f('استعلام.xlsx'), RFQ).ok, true);
  assert.strictEqual(ctx.ptfIsAllowedFile(f('استعلام.XLS'), RFQ).ok, true);
});
T('درخواست: Word و zip پذیرفته می‌شوند', function () {
  assert.strictEqual(ctx.ptfIsAllowedFile(f('spec.docx'), RFQ).ok, true);
  assert.strictEqual(ctx.ptfIsAllowedFile(f('bundle.zip'), RFQ).ok, true);
});
T('درخواست: فرمت اجرایی رد می‌شود', function () {
  assert.strictEqual(ctx.ptfIsAllowedFile(f('tool.exe'), RFQ).ok, false);
});
T('پیش‌فرض (سایر ویجت‌ها): Excel همچنان رد می‌شود — رفتار قبلی حفظ شده', function () {
  var r = ctx.ptfIsAllowedFile(f('list.xlsx'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.indexOf('jpg') > -1 && r.error.indexOf('pdf') > -1);
});
T('پیش‌فرض: تصویر و PDF کوچک همچنان مجازند', function () {
  assert.strictEqual(ctx.ptfIsAllowedFile(f('photo.jpg')).ok, true);
  assert.strictEqual(ctx.ptfIsAllowedFile(f('small.pdf', 1000)).ok, true);
});
T('محدودیت حجم PDF (۵MB) برای همه حفظ شده', function () {
  assert.strictEqual(ctx.ptfIsAllowedFile(f('big.pdf', 6 * 1048576), RFQ).ok, false);
});

// 3) هم‌خوانی با سرور
T('فهرست درخواست با save_attachment سرور هم‌خوان است', function () {
  var m = /\$allowed = (\[[^\]]*\]);\s*\n\s*\$original/.exec(crm);
  assert.ok(m, 'server list not found');
  var serverList = JSON.parse(m[1].replace(/'/g, '"'));
  RFQ.forEach(function (e) { assert.ok(serverList.indexOf(e) > -1, 'server does not accept ' + e); });
});
T('ptfIsAllowedFile و attachUploadWidget پارامتر جدید را پشتیبانی می‌کنند', function () {
  assert.ok(/function ptfIsAllowedFile\(file, allowedExts\)/.test(storage));
  assert.ok(/function attachUploadWidget\(containerId, folder, onDone, onRemove, opts\)/.test(storage));
});

console.log('\n=== tester694-rfq-attach-xlsx: ' + results.pass + ' PASS / ' + results.fail + ' FAIL ===');
process.exit(results.fail ? 1 : 0);
