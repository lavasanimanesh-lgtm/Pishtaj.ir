#!/usr/bin/env node
'use strict';
/* v34.7.95 — ادامهٔ صفحه‌بندی فهرست S3:
   قبلاً سرور حداکثر ۳۰ صفحه می‌خواند و در باکت بزرگ فقط truncated=true برمی‌گرداند
   (بدون توکن ادامه) ⇒ گزارش کلید ابری ناقص و remap گروه B برای همیشه قفل می‌ماند.
   حالا سرور nextToken برمی‌گرداند و token ورودی می‌پذیرد؛ کلاینت با
   ptfListAllCloudFiles تا سقف ایمن ادامه می‌دهد. ایمنی حفظ شد: اگر با ادامه هم به سقف
   برسیم truncated=true می‌ماند و remap طبق قبل غیرفعال است؛ پاک‌سازی یتیم (مسیر DELETE)
   عمداً دست نخورد. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var st = read('crm/storage.js');
var php = read('api/storage.php');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.7.95', ver.crm_version === 'v34.7.95', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.95', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.95'") > -1);
T('sw RELEASE = v34.7.95', sw.indexOf("RELEASE = 'v34.7.95'") > -1);
T('storage.js cache-bust 34.7.95', idx.indexOf('storage.js?v=34.7.95') > -1);

/* ---------- سرور ---------- */
T('list توکن ورودی می‌پذیرد', php.indexOf("$token = (string)($in['token'] ?? ($_GET['token'] ?? ''))") > -1);
T('list nextToken برمی‌گرداند', php.indexOf("'nextToken' => $token") > -1);
T('سقف ۳۰ صفحه در هر فراخوانی مانده', php.indexOf('$pages < 30') > -1);
T('truncated همچنان گزارش می‌شود', php.indexOf('if ($token) $truncated = true;') > -1);

/* ---------- کلاینت ---------- */
T('ptfListAllCloudFiles تعریف و expose شده', st.indexOf('function ptfListAllCloudFiles(') > -1 && st.indexOf('window.ptfListAllCloudFiles = ptfListAllCloudFiles') > -1);
T('گزارش کلیدها از helper استفاده می‌کند', /ptfCloudKeyAudit[\s\S]{0,700}ptfListAllCloudFiles\(\{ prefix: '' \}/.test(st));
T('سقف ایمن نوبت‌ها', st.indexOf('MAX_ROUNDS = 12') > -1);
T('گارد ایمنی remap مانده (truncated ⇒ غیرفعال)', st.indexOf('remap تا فهرست کامل S3 غیرفعال است') > -1 && st.indexOf("out.error = 'truncated'") > -1);
T('پاک‌سازی یتیم دست نخورد (همچنان با truncated متوقف می‌شود)', st.indexOf('برای جلوگیری از حذف اشتباه، پاک‌سازی متوقف شد') > -1);
T('helper هیچ DELETE نمی‌زند', (function () { var h = st.slice(st.indexOf('function ptfListAllCloudFiles('), st.indexOf('window.ptfListAllCloudFiles')); return h.indexOf('delete') === -1 && h.indexOf('action=list') > -1; })());

/* ---------- sandbox: ادامهٔ چندنوبتی + سازگاری با سرور قدیمی ---------- */
function makeSb(pages) {
  /* pages: آرایهٔ پاسخ‌های متوالی سرور */
  var i = 0, bodies = [];
  var sb = {
    console: console, JSON: JSON, String: String, Array: Array, Object: Object,
    STORAGE_API: '../api/storage.php',
    ptfStorageAuthHeaders: function () { return {}; },
    fetch: function (url, opt) {
      bodies.push(JSON.parse(opt.body));
      var d = pages[Math.min(i, pages.length - 1)]; i++;
      return { then: function (fn) { var out = fn({ json: function () { return d; } }); /* r.json() مستقیم */
        return { then: function (fn2) { fn2(out); return { catch: function () {} }; } }; } };
    },
    window: null
  };
  sb.window = sb; sb._bodies = bodies;
  vm.createContext(sb);
  var cutI = st.indexOf('function ptfListAllCloudFiles(');
  var cutJ = st.indexOf('window.ptfListAllCloudFiles = ptfListAllCloudFiles');
  vm.runInContext(st.slice(cutI, cutJ) + '\nthis.helper = ptfListAllCloudFiles;', sb, { filename: 'storage.js#listall' });
  return sb;
}
try {
  /* دو نوبت: نوبت اول nextToken دارد، نوبت دوم تمام می‌شود */
  var sb1 = makeSb([
    { ok: true, files: [{ key: 'a' }, { key: 'b' }], truncated: true, nextToken: 'T1' },
    { ok: true, files: [{ key: 'c' }], truncated: false, nextToken: '' }
  ]);
  var res1 = null;
  sb1.helper({ prefix: '' }, function (r) { res1 = r; });
  T('sandbox: دو نوبت ادغام شد و truncated=false', !!res1 && res1.ok && res1.files.length === 3 && res1.truncated === false && res1.rounds === 2, JSON.stringify(res1));
  T('sandbox: نوبت دوم با token=T1 رفت', sb1._bodies.length === 2 && sb1._bodies[1].token === 'T1', JSON.stringify(sb1._bodies));
  /* سرور قدیمی: بدون nextToken و truncated=true ⇒ باید truncated بماند */
  var sb2 = makeSb([{ ok: true, files: [{ key: 'x' }], truncated: true }]);
  var res2 = null;
  sb2.helper(function (r) { res2 = r; });
  T('sandbox: سازگاری سرور قدیمی — truncated حفظ می‌شود', !!res2 && res2.ok && res2.truncated === true && res2.rounds === 1, JSON.stringify(res2));
  /* خطای سرور */
  var sb3 = makeSb([{ ok: false, http: 500 }]);
  var res3 = null;
  sb3.helper(function (r) { res3 = r; });
  T('sandbox: خطای سرور گزارش می‌شود', !!res3 && res3.ok === false && String(res3.error).indexOf('500') > -1, JSON.stringify(res3));
} catch (e) {
  T('sandbox صفحه‌بندی اجرا شد', false, String(e && e.message || e));
}

T('tester462 در گیت CI', gate.indexOf('tester462-v34.7.59-cloud-list-pagination.js') > -1);

console.log('\n— tester462 (v34.7.95: ادامهٔ صفحه‌بندی فهرست S3) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
