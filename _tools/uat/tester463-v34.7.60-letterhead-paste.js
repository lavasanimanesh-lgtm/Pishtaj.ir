#!/usr/bin/env node
'use strict';
/* v34.7.60 — LETTERHEAD-PASTE-001: متن آمادهٔ Word روی سربرگ رسمی.
   قرارداد: متن Paste شده «بازنویسی نمی‌شود» (فقط letSafeBodyHtml)؛ سربرگ/فوتر/نوارها
   با position:fixed روی همهٔ صفحات تکرار می‌شوند؛ فضای هر صفحه با thead/tfoot رزرو
   می‌شود؛ مهر و امضا سه حالت دارد (هر صفحه / انتهای متن / بدون). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var lt = read('crm/letters.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.7.60', ver.crm_version === 'v34.7.60', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.60', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.60'") > -1);
T('sw RELEASE = v34.7.60', sw.indexOf("RELEASE = 'v34.7.60'") > -1);
T('letters.js cache-bust 34.7.60', /letters\.js\?v=34\.7\.60/.test(idx));

/* ---------- فیچر ---------- */
T('دکمه در نوار مکاتبات', lt.indexOf('ptfLetterheadPasteOpen()') > -1 && lt.indexOf('📄 متن آماده روی سربرگ') > -1);
T('توابع تعریف و expose شده‌اند', lt.indexOf('window.ptfLetterheadPasteOpen = function') > -1 && lt.indexOf('window.ptfLetterheadPastePrint = function') > -1);
T('ادیتور Paste با contenteditable', lt.indexOf('id="lhpEditor" contenteditable="true"') > -1);
T('متن فقط sanitize می‌شود نه بازنویسی', /ptfLetterheadPastePrint[\s\S]{0,400}letSafeBodyHtml\(ed\.innerHTML\)/.test(lt));
T('سه حالت مهر و امضا', lt.indexOf('id="lhpSigMode"') > -1 && lt.indexOf('پایین همهٔ صفحات') > -1 && lt.indexOf('فقط انتهای متن') > -1 && lt.indexOf('بدون مهر و امضا') > -1);
T('زبان فا/EN', lt.indexOf('id="lhpLang"') > -1 && lt.indexOf('LETTER_FONT_EN') > -1);
T('تاریخ اختیاری (پیش‌فرض بدون تغییر)', lt.indexOf('id="lhpDate"') > -1);

/* ---------- تکرار روی همهٔ صفحات ---------- */
var block = lt.slice(lt.indexOf('window.ptfLetterheadPastePrint'), lt.indexOf('/* ---------- روتینگ'));
T('سربرگ fixed (تکرار هر صفحه)', block.indexOf('.hd{position:fixed') > -1);
T('نوارهای سربرگ fixed', block.indexOf('.bar-top{position:fixed') > -1 && block.indexOf('.bar-bot{position:fixed') > -1);
T('فوتر fixed', block.indexOf('.ft{position:fixed') > -1);
T('مهر هر صفحه fixed', block.indexOf('.pgsig{position:fixed') > -1);
T('رزرو فضای صفحه با thead/tfoot', block.indexOf('table.pgt>thead td{height:') > -1 && block.indexOf('table.pgt>tfoot td{height:') > -1 && block.indexOf('<thead><tr><td></td></tr></thead>') > -1);
T('مهر/امضا از پروفایل کاربر (sigProfileFor)', block.indexOf('sigProfileFor') > -1 && block.indexOf('prof.stamp') > -1);
T('هشدار نبود پروفایل امضا', block.indexOf('تصویر مهر/امضا در پروفایل شما ثبت نشده') > -1);
T('بدون واترمارک PREVIEW (سند رسمی)', block.indexOf('PREVIEW') === -1);
T('ثبت در audit log', block.indexOf("audit('مکاتبات', 'چاپ متن آماده روی سربرگ") > -1);
T('چاپ از مسیر استاندارد ptfPreviewPrintableDoc', block.indexOf("ptfPreviewPrintableDoc('متن روی سربرگ'") > -1);
T('حالت انتهای متن بلوک امضا دارد', block.indexOf("sigMode === 'last'") > -1 && block.indexOf('endsig') > -1);
T('پیام خطای متن خالی', block.indexOf('متنی Paste نشده است') > -1);

T('tester463 در گیت CI', gate.indexOf('tester463-v34.7.60-letterhead-paste.js') > -1);

console.log('\n— tester463 (v34.7.60: متن آماده روی سربرگ) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
