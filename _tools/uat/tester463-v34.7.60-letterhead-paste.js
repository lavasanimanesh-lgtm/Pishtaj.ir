#!/usr/bin/env node
'use strict';
/* v34.7.60 — LETTERHEAD-PASTE-001: متن آمادهٔ Word روی سربرگ رسمی.
   v34.8.31 — LETTERHEAD-PASTE-002: شمارهٔ نامه و پیوست (اختیاری) روی سربرگ +
   محل مهر و امضا «تمام صفحات / فقط صفحهٔ آخر / بدون».
   قرارداد: متن Paste شده «بازنویسی نمی‌شود» (فقط letSafeBodyHtml)؛ سربرگ/فوتر/نوارها
   با position:fixed روی همهٔ صفحات تکرار می‌شوند؛ فضای هر صفحه با thead/tfoot رزرو
   می‌شود؛ مهر و امضا سه حالت دارد. */
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
T('VERSION.json = v34.8.31', ver.crm_version === 'v34.8.31', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.8.31', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.8.31'") > -1);
T('sw RELEASE = v34.8.31', sw.indexOf("RELEASE = 'v34.8.31'") > -1);
T('letters.js cache-bust 34.8.31', /letters\.js\?v=34\.8\.31/.test(idx));

/* ---------- فیچر ---------- */
T('دکمه در نوار مکاتبات', lt.indexOf('ptfLetterheadPasteOpen()') > -1 && lt.indexOf('📄 متن آماده روی سربرگ') > -1);
T('توابع تعریف و expose شده‌اند', lt.indexOf('window.ptfLetterheadPasteOpen = function') > -1 && lt.indexOf('window.ptfLetterheadPastePrint = function') > -1);
T('ادیتور Paste با contenteditable', lt.indexOf('id="lhpEditor"') > -1 && lt.indexOf('contenteditable="true"') > -1);
T('متن فقط sanitize می‌شود نه بازنویسی', /ptfLetterheadPastePrint[\s\S]{0,400}letSafeBodyHtml\(ed\.innerHTML\)/.test(lt));
T('سه حالت مهر و امضا', lt.indexOf('id="lhpSigMode"') > -1 && lt.indexOf('تمام صفحات') > -1 && lt.indexOf('فقط صفحهٔ آخر') > -1 && lt.indexOf('بدون مهر و امضا (فقط سربرگ)') > -1);
T('زبان فا/EN', lt.indexOf('id="lhpLang"') > -1 && lt.indexOf('LETTER_FONT_EN') > -1);
T('تاریخ اختیاری (پیش‌فرض بدون تغییر)', lt.indexOf('id="lhpDate"') > -1);

/* ---------- v34.8.31: شماره و پیوست ---------- */
T('فیلد شماره نامه', lt.indexOf('id="lhpNo"') > -1);
T('فیلد پیوست', lt.indexOf('id="lhpAtt"') > -1);
T('دکمهٔ شمارهٔ بعدی + تابع', lt.indexOf('ptfLetterheadNoNext()') > -1 && lt.indexOf('window.ptfLetterheadNoNext = function') > -1);
T('شمارهٔ بعدی از letSerial', /letSerial\('OUT', 'en'\)/.test(lt) && /letFaDigits\(letSerial\('OUT', 'fa'\)\)/.test(lt));

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
T('حالت صفحهٔ آخر بلوک امضا دارد', block.indexOf("sigMode === 'last'") > -1 && block.indexOf('endsig') > -1);
T('بلوک امضای صفحهٔ آخر شکسته نمی‌شود', block.indexOf('.endsig{margin:12mm 16mm 0') > -1 && block.indexOf('page-break-inside:avoid') > -1);
T('پیام خطای متن خالی', block.indexOf('متنی Paste نشده است') > -1);

/* ---------- v34.8.31: رندر سربرگ شماره/پیوست ---------- */
T('سربرگ شماره و پیوست و تاریخ می‌سازد', block.indexOf('شمـاره :</span>') > -1 && block.indexOf('پیوست :</span>') > -1 && block.indexOf('تاریـخ :</span>') > -1);
T('سربرگ EN: Ref No / Encl', block.indexOf('Ref No.:</span>') > -1 && block.indexOf('Encl.:</span>') > -1);
T('شماره با ارقام فارسی (letFaDigits)', block.indexOf('letFaDigits(escP(no))') > -1);
T('فضای سربرگ با شماره/پیوست هم رزرو می‌شود', block.indexOf('(withDate || no || att) ? 46 : 40') > -1);

T('tester463 در گیت CI', gate.indexOf('tester463-v34.7.60-letterhead-paste.js') > -1);

console.log('\n— tester463 (v34.8.31: شماره و پیوست + مهر صفحهٔ آخر/همهٔ صفحات) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
