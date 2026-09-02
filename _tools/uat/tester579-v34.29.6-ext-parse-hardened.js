#!/usr/bin/env node
'use strict';
/* tester579 — v34.29.6: پارسر خروجی هوش خارجی مقاوم — ریشهٔ «دکمهٔ اعمال کار نمی‌کند»:
   خروجی واقعی ChatGPT/Claude نشانگرها را بولد (**)، جعبهٔ کد (```)، بولت/سرفصل یا
   دونقطهٔ کامل (：) می‌نویسد و پارسر قبلی هیچ فیلدی را پر نمی‌کرد. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');

/* ── رفتاری: پارسر خالص با ۷ گونهٔ خروجی واقعی ── */
T('BEHAV: پارسر هر ۷ گونهٔ خروجی واقعی را می‌خواند', (function () {
  var slice = cms.slice(cms.indexOf('window.cmsExtParse = function'), cms.indexOf('window.cmsExtErr = function') > -1 ? cms.indexOf('window.cmsPgExtPrompt = function') : cms.indexOf('window.cmsPgExtPrompt = function'));
  global.window = {};
  eval(slice + ';window.__P = window.cmsExtParse;');
  var P = window.__P;
  var cases = [
    ['تمیز', 'TITLE: الف\nH1: ب\nDESCRIPTION: ج\nSLUG: a-b\nBODY:\n<p>متن</p>', function (v) { return v.title === 'الف' && v.slug === 'a-b' && v.body === '<p>متن</p>'; }],
    ['بولد **TITLE:** x', '**TITLE:** الف\n**H1:** ب\n**DESCRIPTION:** ج\n**SLUG:** a-b\n**BODY:**\n<p>متن</p>', function (v) { return v.title === 'الف' && v.body === '<p>متن</p>'; }],
    ['بولد مقدار', '**TITLE:** **الف**\nBODY:\n<p>متن</p>', function (v) { return v.title === 'الف'; }],
    ['جعبهٔ کد', '```html\nTITLE: الف\nSLUG: a-b\nBODY:\n<p>متن</p>\n```', function (v) { return v.title === 'الف' && v.body === '<p>متن</p>' && v.body.indexOf('```') === -1; }],
    ['دونقطهٔ کامل', 'TITLE： الف\nH1： ب\nDESCRIPTION： ج توضیح کامل و جامع برای تست\nSLUG： a-b\nBODY：\n<p>متن</p>', function (v) { return v.title === 'الف' && v.body === '<p>متن</p>'; }],
    ['سرفصل/بولت', '### TITLE: الف\n- H1: ب\n* DESCRIPTION: ج توضیح کامل و جامع برای تست\nBODY:\n<p>متن</p>', function (v) { return v.title === 'الف' && v.h1 === 'ب' && v.body === '<p>متن</p>'; }],
    ['SPECS/FAQ بلوکی', 'TITLE: الف\nSPECS:\nکلید = مقدار\nFAQ:\nسؤال | پاسخ\nBODY:\n<p>متن</p>', function (v) { return v.specs === 'کلید = مقدار' && v.faq === 'سؤال | پاسخ'; }]
  ];
  return cases.every(function (c) { var v = P(c[1]); var ok = c[2](v); if (!ok) console.log('  ↳ گونهٔ خراب:', c[0], JSON.stringify(v).slice(0, 120)); return ok; });
})());
T('BEHAV: خط BODY درون محتوا دست نمی‌خورد (بولت واقعی متن حفظ می‌شود)', (function () {
  var slice = cms.slice(cms.indexOf('window.cmsExtParse = function'), cms.indexOf('window.cmsPgExtPrompt = function'));
  global.window = {};
  eval(slice + ';window.__P = window.cmsExtParse;');
  var v = window.__P('TITLE: الف\nBODY:\n<h2>معرفی</h2>\n- آیتم اول لیست\n- آیتم دوم');
  return v.body.indexOf('- آیتم اول لیست') > -1 && v.body.indexOf('<h2>معرفی</h2>') > -1;
})());
T('UI: خطا به‌جای alertِ تنها، درون خود مودال نمایش می‌یابد (ptExtErr) + فوکوس کادر', cms.indexOf('window.cmsExtErr = function') > -1 && cms.indexOf('id="ptExtErr"') > -1 && cms.indexOf('نشانگرها پیدا نشد') > -1);
T('UI: هر دو مسیر صفحهٔ جدید و محصول از پارسر مقاوم و خطای درون‌مودال استفاده می‌کنند', cms.indexOf('cmsExtErr(\'⛔ نشانگرها پیدا نشد') > -1 && (cms.match(/cmsExtErr\('⛔ نشانگرها پیدا نشد/g) || []).length === 2);
T('REG: بولد/جعبهٔ کد/دونقطهٔ کامل در نرمال‌ساز پوشش داده شده‌اند', cms.indexOf('EXT-PARSE-HARDEN') > -1 && cms.indexOf('```|~~~') > -1 && cms.indexOf('：', cms.indexOf('EXT-PARSE-HARDEN')) > -1);

console.log('=== tester579: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
