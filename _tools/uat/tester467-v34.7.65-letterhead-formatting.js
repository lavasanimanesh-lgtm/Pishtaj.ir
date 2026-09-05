#!/usr/bin/env node
'use strict';
/* v34.37.2 — همان قالب‌بندی نامهٔ صادره برای «متن آماده روی سربرگ».
   قرارداد: نوار ابزار غنی (فونت/اندازه/رنگ/هایلایت/بولد/ایتالیک/زیرخط/خط‌خورده/
   چینش/فاصلهٔ خطوط/فهرست/تورفتگی/جدول/تصویر) + تنظیمات دستی قالب (اندازهٔ کوچک،
   فاصلهٔ خطوط، فونت، چینش، بولد/ایتالیک، حاشیه) که در خروجی چاپ اعمال می‌شود. */
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

T('VERSION.json = v34.37.2', ver.crm_version === 'v34.37.2', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.37.2', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.37.2'") > -1);
T('sw RELEASE = v34.37.2', sw.indexOf("RELEASE = 'v34.37.2'") > -1);
T('letters.js cache-bust 34.37.2', /letters\.js\?v=34\.37\.2/.test(idx));

/* هندلرهای سربرگ (ptfLhp*) */
T('هندلر فونت سربرگ', lt.indexOf('window.ptfLhpFont = function') > -1);
T('هندلر اندازه سربرگ', lt.indexOf('window.ptfLhpFontSize = function') > -1);
T('هندلر رنگ/هایلایت سربرگ', lt.indexOf('window.ptfLhpColor = function') > -1 && lt.indexOf('window.ptfLhpHilite = function') > -1);
T('هندلر فاصلهٔ خطوط/چینش سربرگ', lt.indexOf('window.ptfLhpLineHeight = function') > -1 && lt.indexOf('window.ptfLhpAlign = function') > -1);
T('هندلر پاک‌سازی قالب سربرگ', lt.indexOf('window.ptfLhpClearFormat = function') > -1);
T('هندلر فرمان/جدول/تصویر سربرگ', lt.indexOf('window.ptfLhpEditorCmd = function') > -1 && lt.indexOf('window.ptfLhpEditorTable = function') > -1 && lt.indexOf('window.ptfLhpEditorImagePick = function') > -1);
T('همگام‌سازی زندهٔ ادیتور سربرگ', lt.indexOf('window.lhpSyncDocFont = function') > -1);

/* نوار ابزار سربرگ */
T('انتخابگر فونت در نوار سربرگ', lt.indexOf('ptfLhpFont(this.value)') > -1);
T('اندازه شامل ۹ (کوچک‌تر از ۱۲) در نوار سربرگ', lt.indexOf('ptfLhpFontSize(this.value)') > -1);
T('رنگ متن سربرگ', lt.indexOf('ptfLhpColor(this.value)') > -1);
T('چهار حالت چینش سربرگ', (lt.match(/ptfLhpAlign\(/g) || []).length >= 4);
T('فاصلهٔ خطوط سربرگ', lt.indexOf('ptfLhpLineHeight(this.value)') > -1);
T('فهرست/تورفتگی/جدول/تصویر سربرگ', lt.indexOf('insertUnorderedList') > -1 && lt.indexOf('ptfLhpEditorTable()') > -1 && lt.indexOf('ptfLhpEditorImagePick()') > -1 && lt.indexOf('indent') > -1);

/* تنظیمات دستی قالب سربرگ */
T('فیلد اندازه (lhpFs)', lt.indexOf('id="lhpFs"') > -1);
T('فیلد فاصلهٔ خطوط (lhpLh)', lt.indexOf('id="lhpLh"') > -1);
T('فیلد فونت (lhpFont)', lt.indexOf('id="lhpFont"') > -1);
T('فیلد چینش (lhpAlign)', lt.indexOf('id="lhpAlign"') > -1);
T('بولد/ایتالیک (lhpB/lhpI)', lt.indexOf('id="lhpB"') > -1 && lt.indexOf('id="lhpI"') > -1);
T('چهار فیلد حاشیه (lhpMt/Mr/Mb/Ml)', lt.indexOf('id="lhpMt"') > -1 && lt.indexOf('id="lhpMr"') > -1 && lt.indexOf('id="lhpMb"') > -1 && lt.indexOf('id="lhpMl"') > -1);

/* اعمال در خروجی چاپ */
T('چاپ اندازهٔ سربرگ را اعمال می‌کند', lt.indexOf("var bodyFs = fs ? fs + 'pt' : '13pt'") > -1);
T('چاپ فاصلهٔ خطوط سربرگ را اعمال می‌کند', lt.indexOf('var bodyLh = lh || 2.1') > -1);
T('چاپ فونت سربرگ را اعمال می‌کند', lt.indexOf('var bodyFont = fontTok ? letFontCss(fontTok) : font') > -1);
T('چاپ چینش پیش‌فرض justify و بولد/ایتالیک سربرگ را اعمال می‌کند', lt.indexOf("var bodyAlign = align || 'justify'") > -1 && lt.indexOf("(bold ? 'font-weight:700;' : '')") > -1 && lt.indexOf("(italic ? 'font-style:italic;' : '')") > -1);
T('چاپ حاشیهٔ سربرگ را اعمال می‌کند', lt.indexOf("'.body{padding:' + mt + 'mm ' + mr + 'mm ' + mb + 'mm ' + ml + 'mm") > -1);
T('paste/drop سربرگ به lhpEditor وصل شد', lt.indexOf("letEditorWirePasteAndDrop(editor, 'lhpEditor')") > -1);

T('tester467 در گیت CI', gate.indexOf('tester467-v34.7.65-letterhead-formatting.js') > -1);

console.log('\n— tester467 (v34.37.2: قالب‌بندی متن آماده روی سربرگ) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
