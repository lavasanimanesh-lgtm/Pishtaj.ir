#!/usr/bin/env node
'use strict';
/* v34.14.0 — دلیل ثبت/رد تامین‌کننده + تکمیل مدارک پس از رد + پیامک ثبت/رد.
   قرارداد:
   1) رد ساختاریافته (rejectType: mismatch/docs/other) + note + reopen؛
   2) add_supplier رکورد «ردشده + reopen» را به‌جای بلاک، باز و مدارک را جایگزین می‌کند؛
   3) set_status پیامک ثبت/رد می‌فرستد (sms_enabled)؛
   4) track فیلدهای reopen/rejectType/note را برمی‌گرداند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var crm = read('api/crm.php');
var bridge = read('crm/bridge.js');
var track = read('tracking/index.html');
var sup = read('supplier/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.14.0', ver.crm_version === 'v34.14.0', ver.crm_version);

/* 1) رد ساختاریافته (کلاینت) */
T('supReject با select دلیل', bridge.indexOf("id: 'reasonType'") > -1);
T('گزینه نقصان مدارک', bridge.indexOf("v: 'docs'") > -1 && bridge.indexOf('نقصان مدارک') > -1);
T('supRejectCommit reopen/note/rejectType می‌فرستد', bridge.indexOf('rejectType: reasonType') > -1 && bridge.indexOf('reopen: reopen ? 1 : 0') > -1);
T('supApprove دلیل/یادداشت دارد', bridge.indexOf("id: 'note'") > -1 && bridge.indexOf('supApproveCommit(code, v.note') > -1);

/* 2) تکمیل مدارک (سرور) */
T('add_supplier باز شدن با کد رهگیری (resubmitCode)', crm.indexOf("$resubmitCode = strtoupper(clean($_POST['code']") > -1);
T('باز شدن رکورد ردشده+reopen', crm.indexOf("($row['status'] ?? '') === 'rejected' && !empty($row['reopen'])") > -1);
T('پاسخ reopened:true + همان کد', crm.indexOf("'reopened' => true") > -1 && crm.indexOf("'code' => $oldCode") > -1);
T('مدارک جدید جایگزین می‌شود (attachment ?: قدیمی)', crm.indexOf('($attachment ?: ($dupFound[\'row\'][\'attachment\'] ?? null))') > -1);

/* 3) پیامک ثبت/رد (سرور) */
T('set_status rejectType/reopen/note می‌خواند', crm.indexOf("$rejectType = clean($_POST['rejectType']") > -1 && crm.indexOf("$reopen = ($_POST['reopen']") > -1);
T('پیامک تایید', crm.indexOf("درخواست ثبت‌نام تامین‌کنندگی شما تایید شد") > -1);
T('پیامک رد نقصان مدارک', crm.indexOf("مدارک شما ناقص است") > -1);
T('پیامک فقط وقتی sms_enabled', crm.indexOf('sms_enabled()') > -1);

/* 4) track فیلدهای جدید را برمی‌گرداند */
T('track بازگشت reopen/rejectType/note', crm.indexOf("'reopen' => $reopen, 'rejectType' => $rejectType, 'note' => $note") > -1);

/* 5) UI تکمیل مدارک */
T('tracking: بلوک تکمیل مدارک', track.indexOf('venReopenBox') > -1 && track.indexOf('venReopenLink') > -1);
T('tracking: لینک با ?code=', track.indexOf("'../supplier/?code=' + encodeURIComponent(d.code)") > -1);
T('supplier form: فیلد مخفی code', sup.indexOf('id="sCode"') > -1);
T('supplier form: خواندن ?code=', sup.indexOf("new URLSearchParams(location.search)") > -1);

T('tester473 در گیت CI', gate.indexOf('tester473-v34.7.71-sup-reason-sms-resubmit.js') > -1);

console.log('\n— tester473 (v34.14.0: دلیل/پیامک/تکمیل مدارک تامین‌کننده) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
