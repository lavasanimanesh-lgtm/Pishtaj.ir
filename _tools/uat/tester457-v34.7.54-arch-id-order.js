#!/usr/bin/env node
'use strict';
/* v34.7.91 — رفع تخلف A2 نگهبان معماری در ptfHarvestFileKeys (v34.7.52):
   قرارداد PTF.id ترتیب `_id || cd` است؛ این تستر ترتیب درست را در storage.js
   قفل می‌کند و برنمی‌گردد. arch-guard باید بدون تخلف جدید PASS بدهد. */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var st = read('crm/storage.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.7.91', ver.crm_version === 'v34.7.91', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.91', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.91'") > -1);
T('sw RELEASE = v34.7.91', sw.indexOf("RELEASE = 'v34.7.91'") > -1);
T('storage.js cache-bust 34.7.91', idx.indexOf('storage.js?v=34.7.91') > -1);

/* ---------- قرارداد شناسه در harvest ---------- */
T('ptfHarvestFileKeys با ترتیب _id || cd',
  st.indexOf('var id = recId || obj._id || obj.cd || obj.no || obj.id') > -1);
T('ترتیب معکوس cd-first در harvest برنگشته',
  st.indexOf('recId || obj.cd || obj._id') === -1);

/* ---------- هیچ الگوی A2 در کل crm/*.js ---------- */
var a2 = /\.cd\s*\|\|\s*[A-Za-z_$][\w$]*\._id/;
var offenders = [];
fs.readdirSync(path.join(ROOT, 'crm')).forEach(function (fn) {
  if (!/\.js$/.test(fn)) return;
  var src = read('crm/' + fn);
  src.split('\n').forEach(function (ln, i) {
    if (a2.test(ln)) offenders.push(fn + ':' + (i + 1));
  });
});
T('هیچ الگوی A2 (cd قبل از _id) در crm/*.js نیست', offenders.length === 0, offenders.join(' , '));

/* ---------- نگهبان معماری واقعاً PASS می‌دهد ---------- */
var g = cp.spawnSync(process.execPath, [path.join(ROOT, '_tools/arch/arch-guard.js')], { encoding: 'utf8' });
T('arch-guard exit=0 (بدون تخلف مسدودکنندهٔ جدید)', g.status === 0,
  ((g.stdout || '') + (g.stderr || '')).split('\n').filter(function (l) { return l.indexOf('❌') > -1 || l.indexOf('FAIL') > -1; }).join(' | '));

/* ---------- رگرسیون v34.7.52/53 نشکسته ---------- */
T('ptfCloudKeyAudit مانده', st.indexOf('function ptfCloudKeyAudit') > -1);
T('ptfPlanCloudKeyRemap مانده', st.indexOf('function ptfPlanCloudKeyRemap') > -1);
T('remap بدون DELETE ابری مانده', st.indexOf('اعمال remap گروه B (بدون حذف فایل)') > -1);
T('tester457 در گیت CI', gate.indexOf('tester457-v34.7.54-arch-id-order.js') > -1);

console.log('\n— tester457 (v34.7.91: رفع A2 و سبز شدن نگهبان معماری) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
