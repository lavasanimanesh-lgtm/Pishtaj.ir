#!/usr/bin/env node
'use strict';
/* v34.7.84 — remap گروه B با تأیید دستی، بدون حذف فایل ابری */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var st = read('crm/storage.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');
var surplus = read('crm/surplus.js');
var php = read('api/storage.php');

T('VERSION.json = v34.7.84', ver.crm_version === 'v34.7.84', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.84', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.84'") > -1);
T('sw RELEASE = v34.7.84', sw.indexOf("RELEASE = 'v34.7.84'") > -1);
T('storage.js cache-bust 34.7.84', idx.indexOf('storage.js?v=34.7.84') > -1);

T('function ptfPlanCloudKeyRemap', st.indexOf('function ptfPlanCloudKeyRemap') > -1);
T('function ptfApplyCloudKeyRemap', st.indexOf('function ptfApplyCloudKeyRemap') > -1);
T('function ptfConfirmCloudKeyRemap', st.indexOf('function ptfConfirmCloudKeyRemap') > -1);
T('function ptfRemapCloudKeyFields', st.indexOf('function ptfRemapCloudKeyFields') > -1);
T('دکمه remap گروه B بدون حذف فایل', st.indexOf('اعمال remap گروه B (بدون حذف فایل)') > -1);
T('remap در فهرست ناقص غیرفعال است', st.indexOf('remap تا فهرست کامل S3 غیرفعال است') > -1);
T('truncated جلوی plan را می‌گیرد', st.indexOf("out.error = 'truncated'") > -1);
T('بدون confirmed اعمال نمی‌شود', st.indexOf("error: 'confirm_required'") > -1);
T('archiveKey در فیلدهای remap نیست', /PTF_CLOUD_REMAP_FIELDS = \[[^\]]*'archiveKey'/.test(st) === false && st.indexOf("PTF_CLOUD_REMAP_FIELDS = ['key'") > -1);
T('path عمومی remap نمی‌شود', /PTF_CLOUD_REMAP_FIELDS = \[[^\]]*'path'/.test(st) === false);

var applyChunk = st.slice(st.indexOf('function ptfApplyCloudKeyRemap'), st.indexOf('function ptfConfirmCloudKeyRemap'));
T('apply به delete_batch نمی‌زند', applyChunk.indexOf('delete_batch') < 0);
T('apply به STORAGE_API نمی‌زند', applyChunk.indexOf('STORAGE_API') < 0 && applyChunk.indexOf('action=delete') < 0);
T('apply به archive_zip نمی‌زند', applyChunk.indexOf('archive_zip') < 0);

T('file_not_found همچنان تشخیص داده می‌شود', st.indexOf("d.error === 'file_not_found'") > -1);
T('پیام کلید قدیمی/مهاجرت‌نشده مانده', st.indexOf('کلید قدیمی/مهاجرت‌نشده') > -1 && st.indexOf('دوباره آپلود کنید') > -1);
T('presign_get فقط 404 را file_not_found می‌داند', php.indexOf("$code === 404") > -1 && php.indexOf("$code === 404 || $code === 403") === -1);
T('tester456 در گیت CI', gate.indexOf('tester456-v34.7.53-cloud-key-remap-b.js') > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1 && surplus.indexOf('function hookOfferNew') > -1);

var looks = st.slice(st.indexOf('function ptfLooksLikeStorageKey'), st.indexOf('function ptfHarvestFileKeys'));
var planSrc = st.slice(st.indexOf('var PTF_CLOUD_REMAP_FIELDS'), st.indexOf('function ptfApplyCloudKeyRemap'));
var ctx = {};
try {
  vm.runInNewContext(looks + '\n' + planSrc + '\nthis.plan = ptfPlanCloudKeyRemap;\nthis.remap = ptfRemapCloudKeyFields;', ctx);
  T('sandbox plan/remap بارگذاری شد', typeof ctx.plan === 'function' && typeof ctx.remap === 'function');
  var p1 = ctx.plan([
    { cls: 'B', key: 'supplier-financepaymentX/a.webp', match: 'supplier-finance/payment/X/a.webp', how: 'slash' },
    { cls: 'E', key: 'gone/x.webp', match: '' },
    { cls: 'A', key: 'ok/a.webp', match: 'ok/a.webp' }
  ], false);
  T('plan فقط گروه B را می‌گیرد', p1.ok && p1.maps.length === 1 && p1.maps[0].to === 'supplier-finance/payment/X/a.webp', p1);
  var p2 = ctx.plan([{ cls: 'B', key: 'folder/a.webp', match: 'other/a.webp' }], true);
  T('plan با truncated رد می‌شود', p2.ok === false && p2.error === 'truncated');
  var p3 = ctx.plan([{ cls: 'B', key: 'archives/old.zip', match: 'archives/new.zip' }], false);
  T('plan کلید archives را رد می‌کند', p3.ok && p3.maps.length === 0);
  var p4 = ctx.plan([
    { cls: 'B', key: 'old/a.webp', match: 'new/a.webp' },
    { cls: 'B', key: 'old/a.webp', match: 'other/a.webp' }
  ], false);
  T('plan تطبیق متعارض را رد می‌کند', p4.maps.length === 0);
  var obj = { files: [{ key: 'old/path/file.webp', archiveKey: 'old/path/file.webp', name: 'x' }] };
  var n = ctx.remap(obj, 'old/path/file.webp', 'new/path/file.webp', 0);
  T('remap فیلد key را عوض می‌کند نه archiveKey', n === 1 && obj.files[0].key === 'new/path/file.webp' && obj.files[0].archiveKey === 'old/path/file.webp', obj.files[0]);
} catch (e) {
  T('sandbox plan/remap بارگذاری شد', false, String(e && e.message || e));
}

console.log('\n— tester456 (v34.7.84: remap گروه B بدون حذف فایل) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
