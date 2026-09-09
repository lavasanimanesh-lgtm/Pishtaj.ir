#!/usr/bin/env node
'use strict';
/* v34.38.0 — LETTER-FORMAT-001: قالب‌بندی حرفه‌ای متن نامه.
   قرارداد: نوار ابزار غنی (فونت/اندازه/رنگ/هایلایت/بولد/ایتالیک/زیرخط/خط‌خورده/
   چینش/فاصلهٔ خطوط/فهرست/تورفتگی/جدول/تصویر) + تنظیمات کل نامه (اندازهٔ کوچک‌تر از
   ۱۲، فاصلهٔ خطوط، فونت، حاشیه) که در چاپ اعمال می‌شود؛ استایل‌های inline فقط از
   letSafeStyle (لیست سفید تایپوگرافی امن) عبور می‌کنند. */
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
T('VERSION.json = v34.38.15', ver.crm_version === 'v34.38.15', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.38.15', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.38.15'") > -1);
T('sw RELEASE = v34.38.15', sw.indexOf("RELEASE = 'v34.38.15'") > -1);
T('letters.js cache-bust 34.38.15', /letters\.js\?v=34\.38\.15/.test(idx));

/* ---------- sanitizer امن ---------- */
T('letSafeStyle تعریف شده', lt.indexOf('function letSafeStyle') > -1);
T('sanitizer تگ‌های قالب‌بندی را می‌پذیرد', /S:1, STRIKE:1, SUB:1, SUP:1, MARK:1, HR:1, PRE:1/.test(lt));
T('sanitizer استایل inline را با لیست سفید نگه می‌دارد', lt.indexOf("if (n === 'style')") > -1 && lt.indexOf('letSafeStyle(v)') > -1);
T('sanitizer url/expression را رد می‌کند', /url\\s\*\\\(|expression|javascript|@import/.test(lt));

/* ---------- توابع قالب‌بندی ---------- */
T('تابع فونت', lt.indexOf('window.ptfLetFont = function') > -1);
T('تابع اندازه فونت (pt)', lt.indexOf('window.ptfLetFontSize = function') > -1);
T('تابع رنگ و هایلایت', lt.indexOf('window.ptfLetColor = function') > -1 && lt.indexOf('window.ptfLetHilite = function') > -1);
T('تابع فاصلهٔ خطوط و چینش بلوکی', lt.indexOf('window.ptfLetLineHeight = function') > -1 && lt.indexOf('window.ptfLetAlign = function') > -1);
T('تابع پاک‌سازی قالب', lt.indexOf('window.ptfLetClearFormat = function') > -1);
T('نگه‌داری/بازیابی انتخاب (برای select/color)', lt.indexOf('function letEditorSaveSel') > -1 && lt.indexOf('function letEditorRestoreSel') > -1);
T('همگام‌سازی زندهٔ ادیتور با تنظیمات', lt.indexOf('window.letSyncDocFont = function') > -1);

/* ---------- نوار ابزار ---------- */
T('انتخابگر فونت در تولبار', lt.indexOf('ptfLetFont(this.value)') > -1);
T('انتخابگر اندازه شامل ۹ (کوچک‌تر از ۱۲)', lt.indexOf('<option value="9">۹</option>') > -1);
T('رنگ متن (input color)', lt.indexOf('ptfLetColor(this.value)') > -1);
T('هایلایت زرد/سبز/حذف', lt.indexOf('#fff3a3') > -1 && lt.indexOf('#c7f7d4') > -1 && lt.indexOf('حذف هایلایت') > -1);
T('چهار حالت چینش', (lt.match(/ptfLetAlign\(/g) || []).length >= 4 && lt.indexOf('justify') > -1);
T('فاصلهٔ خطوط در تولبار', lt.indexOf('ptfLetLineHeight(this.value)') > -1);
T('فهرست شماره‌ای و تورفتگی', lt.indexOf('insertOrderedList') > -1 && lt.indexOf("indent") > -1 && lt.indexOf("outdent") > -1);

/* ---------- تنظیمات کل نامه ---------- */
T('فیلد فاصلهٔ خطوط سند (ltLh)', lt.indexOf('id="ltLh"') > -1);
T('فیلد فونت سند (ltFont)', lt.indexOf('id="ltFont"') > -1);
T('چهار فیلد حاشیه (ltMt/Mr/Mb/Ml)', lt.indexOf('id="ltMt"') > -1 && lt.indexOf('id="ltMr"') > -1 && lt.indexOf('id="ltMb"') > -1 && lt.indexOf('id="ltMl"') > -1);
T('اندازهٔ فونت سند شامل مقادیر کوچک (9/10/11)', lt.indexOf('[9,10,10.5,11,11.5,12') > -1);

/* ---------- ذخیره و چاپ ---------- */
T('_collectLetter فیلدهای جدید را می‌خواند', lt.indexOf("lh: document.getElementById('ltLh').value") > -1 && lt.indexOf("font: document.getElementById('ltFont').value") > -1);
T('_collectLetter حاشیه را ذخیره می‌کند', lt.indexOf('margin: { t: _num(\'ltMt\')') > -1);
T('چاپ فاصلهٔ خطوط را اعمال می‌کند', lt.indexOf("var lh = s.lh || 2.1") > -1);
T('چاپ فونت را اعمال می‌کند', lt.indexOf('var bodyFont = s.font ? letFontCss(s.font) : font') > -1);
T('چاپ حاشیه را اعمال می‌کند', lt.indexOf("'.content{padding:' + mt + 'mm ' + mr + 'mm ' + mb + 'mm ' + ml + 'mm;min-height:170mm}'") > -1);

T('tester464 در گیت CI', gate.indexOf('tester464-v34.7.62-letter-formatting.js') > -1);

console.log('\n— tester464 (v34.38.0: قالب‌بندی حرفه‌ای نامه) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
