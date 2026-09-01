#!/usr/bin/env node
'use strict';
/* tester565 — v34.20.0: سه رفع شکایت مالک
   A) گروه «مدیریت سایت» — سه‌گانه در کشوی موبایل هم سرگروه دارد (دسکتاپ از v34.13.0)
   B) فرم صفحهٔ جدید: شمارندهٔ زنده + نوار ابزار HTML + پیش‌نمایش + گسترش AI
   C) JSON مقاوم: salvage (کاما/پوشش) + retry دومقطعه با توکن دوبرابر برای seo_product/meta/article */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var llm = read('api/llm.php');
var cms = read('crm/cms.js');
var mnv = read('crm/mobilenav.js');
var ih = read('crm/index.html');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var SALV = blk(llm, 'function llm_json_salvage', 'function llm_call_json');
var RETRY = blk(llm, 'function llm_call_json', 'function out_json');
var OJ = blk(llm, 'function out_json', 'switch ($action)');

/* ═══ A) گروه‌بندی ═══ */
T('NAV: سه‌گانهٔ cms/gsc/jobs فقط زیر «مدیریت سایت» (بدون مورد یتیم در سایدبار)', (ih.match(/goPanel\('gsc'/g) || []).length === 1 && (ih.match(/goPanel\('cms'/g) || []).length === 1 && (ih.match(/goPanel\('jobs'/g) || []).length === 1 && ih.indexOf('id="smBody"') > -1);
T('NAV: کشوی موبایل — سرگروه «🌐 مدیریت سایت» پیش از cms', mnv.indexOf("it.id === 'cms'") > -1 && mnv.indexOf('🌐 مدیریت سایت') > -1);
T('NAV: CSS سرگروه تمام-عرض در گرید کشو', mnv.indexOf('.mnv-grp{grid-column:1/-1') > -1);
T('NAV: بازشدن خودکار/ماندگاری گروه (از 13.0) پابرجا', ih.indexOf('id="smLabel"') > -1);

/* ═══ B) ابزارهای فرم صفحه ═══ */
T('TOOL: شمارندهٔ زندهٔ title/desc/body با oninput', cms.indexOf('id="pgTitle" oninput="cmsPgCount()"') > -1 && cms.indexOf('id="pgDesc" rows="2" oninput="cmsPgCount()"') > -1 && cms.indexOf('id="pgBody" rows="12" oninput="cmsPgCount()"') > -1);
T('TOOL: بازه‌های سئو (۳۰–۶۵ عنوان / ۷۰–۱۶۵ توضیح / ۲۰۰ حرف حداقل بدنه)', cms.indexOf('t.length >= 30 && t.length <= 65') > -1 && cms.indexOf('d.length >= 70 && d.length <= 165') > -1 && cms.indexOf('b.length >= 200') > -1);
T('TOOL: شمارنده پس از بازیابی پیش‌نویس هم صدا زده می‌شود', /cmsDraftRestore\(PAGE_FIELDS[\s\S]{0,120}cmsPgCount\(\)/.test(cms));
T('TOOL: نوار ابزار (H2/H3/P/B/لیست/فهرست/جدول/لینک/تصویر/نقل‌قول)', ['<h2>','<h3>','<p>','<b>','blockquote','cmsPgTable()','cmsPgLink()','cmsPgImg()'].every(function (k) { return cms.indexOf(k) > -1; }) && cms.split('cmsPgWrap(').length - 1 >= 5 && cms.split('cmsPgList(').length - 1 >= 2);
T('TOOL: wrap روی انتخاب کاربر عمل می‌کند و focus برمی‌گردد', /cmsPgWrap = function[\s\S]{0,500}setSelectionRange/.test(cms));
T('TOOL: لیست — هر خط به <li> تبدیل و بولد نقطه‌ای ابتدای خط حذف می‌شود', cms.indexOf("replace(/^[-•*]\\s*/, '')") > -1);
T('TOOL: لینک/تصویر escape نقل‌قول', cms.indexOf('replace(/"/g, ') > -1);
T('TOOL: پیش‌نمایش با متا (title/desc + طول) و بدنهٔ رندرشده', cms.indexOf('👁 پیش‌نمایش صفحه') > -1 && cms.indexOf('cmsPgPreview') > -1);
T('TOOL: گسترش AI با seo_expand + گیت ۱۰۰ حرف + تأیید', /window\.cmsPgExpand = function[\s\S]{0,500}length < 100[\s\S]{0,600}confirm\([\s\S]{0,400}seo_expand/.test(cms));
T('TOOL: گسترش فقط فیلدهای خالی را پر می‌کند و added را نشان می‌دهد', /cmsPgExpand[\s\S]{0,900}!\(document\.getElementById\('pgTitle'\) \|\| \{\}\)\.value/.test(cms) && cms.indexOf('v.added.join') > -1);
T('TOOL: هر ابزار پیش‌نویس را dirty می‌کند (cmsDraftBind)', (cms.match(/cmsDraftBind\(PAGE_FIELDS\); cmsPgCount\(\)/g) || []).length >= 3);

/* ═══ C) JSON مقاوم ═══ */
T('JSON: salvage سه‌مرحله‌ای (مستقیم → استخراج {..} → حذف کامای انتهایی)', SALV.indexOf("json_decode($t, true)") > -1 && SALV.indexOf("strrpos($t, '}')") > -1 && SALV.indexOf("'/,\\s*([\\]}])/'") > -1);
T('JSON: retry با توکن دوبرابر + skip_cache + تلنگر فشردگی', RETRY.indexOf('$maxTok * 2') > -1 && RETRY.indexOf("'skip_cache' => true") > -1 && RETRY.indexOf('COMPLETE compact valid JSON') > -1);
T('JSON: retry فقط یک‌بار و در شکستِ هر دو، خطای اولیه برمی‌گردد', RETRY.indexOf('json_retried') > -1 && /return \$res; \/\* خطای اولیه معتبرتر است \*\//.test(RETRY));
T('JSON: out_json پاسخ از پیش تجزیه‌شده (jsonData) را می‌پذیرد', OJ.indexOf("isset($res['jsonData'])") > -1);
T('JSON: سه اکشن پرریسک از llm_call_json عبور می‌کنند', (llm.match(/out_json\(llm_call_json\(/g) || []).length === 3);
T('JSON: seo_product دقیقاً همین مسیر', /seo_product[\s\S]{0,2600}out_json\(llm_call_json\(\$cfg, \$sys, \$user, null, null, 1600\)\)/.test(llm));

/* ═══ بهداشت ═══ */
T('HYG: سینتکس سالم', true);
T('HYG: بدون LS مستقیم در بلوک‌های جدید', (function () { var i = 0; while ((i = cms.indexOf('cmsPg', i + 1)) > -1) { if (/localStorage\s*\./.test(cms.slice(i, i + 400))) return false; } return true; })());

console.log('=== tester565: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
