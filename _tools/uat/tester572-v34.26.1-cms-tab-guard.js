#!/usr/bin/env node
'use strict';
/* tester572 — v34.37.2: پوستهٔ مقاوم تب‌های CMS
   گزارش پروداکشن: «تب صفحات جدید خالی است». رندر استاتیک سالم است؛ خطای زمان اجرا
   در محیط کاربر تا امروز بی‌صدا تب را خالی می‌گذاشت. رفع: TAB-GUARD + فرم جایگزین. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var WRAP = blk(cms, 'function renderCmsPageNew(el) {', 'function renderCmsPageNewFull(el) {');
var FULL = blk(cms, 'function renderCmsPageNewFull(el) {', 'window.cmsPgCount = function');
var RND = blk(cms, 'window.renderCms = function () {', '/* ============ AC1: اخبار');

T('GUARD: رندر کامل به renderCmsPageNewFull منتقل و پوستهٔ try/catch اضافه شد', WRAP.indexOf('try { renderCmsPageNewFull(el); return; } catch (ePg)') > -1 && FULL.indexOf("var opts = PAGE_FOLDERS.map") > -1);
T('GUARD: خطای اول بی‌صدا نمی‌میرد — در متغیر محلی ذخیره و نمایش داده می‌شود', WRAP.indexOf('var _pgErr = null;') > -1 && WRAP.indexOf('escP(_pgErr && _pgErr.message)') > -1 && WRAP.indexOf('ePg && ePg.message') === -1);
T('GUARD: فرم جایگزین همهٔ فیلدهای لازم را دارد (folder/slug/topic/title/h1/desc/body/img)', ['pgFolder','pgSlug','pgTopic','cmsPgTitle','pgH1','pgDesc','pgBody','pgImg'] /* v34.37.2: عنوان فرم به cmsPgTitle تغییر نام یافت (برخورد با عنوان هدر) */.every(function (id) { return WRAP.indexOf('id="' + id + '"') > -1; }));
T('GUARD: دکمه‌های مسیر کامل در فرم جایگزین (AI/خارجی/پیش‌نمایش/ذخیرهٔ موقت/انتشار)', ['cmsPageAi()','cmsPgExtPrompt()','cmsPgPreview()','cmsDraftBtn(PAGE_FIELDS','cmsPagePublish()'].every(function (k) { return WRAP.indexOf(k) > -1; }));
T('GUARD: بازیابی پیش‌نویس در فرم جایگزین هم انجام می‌شود', WRAP.indexOf("cmsDraftRestore(PAGE_FIELDS, 'pgAiSt')") > -1);
T('GUARD: fallback خودِ پوسته هم try/catch دوم دارد (خطای بحرانی مرئی)', WRAP.indexOf('خطای بحرانی رندر فرم صفحه') > -1);
T('GUARD: سایدبار TAB-GUARD — خطای هر تب پیام مرئی می‌دهد نه صفحهٔ خالی', RND.indexOf('TAB-GUARD') > -1 && RND.indexOf('خطای رندر بخش') > -1 && RND.indexOf('catch (eTab)') > -1);
T('GUARD: رفتاری — شبیه‌سازی خطا: فرم جایگزین + پیام؛ مسیر سالم: FULL', (function () {
  global.window = { ptfDevKv: { get: function (k, cb) { cb(null); } } };
  var els = {};
  function mkEl(id) { return { id: id, innerHTML: '', value: '', style: {}, addEventListener: function () {}, dispatchEvent: function () {}, classList: { add: function () {}, remove: function () {} } }; }
  global.document = { getElementById: function (id) { if (!els[id]) els[id] = mkEl(id); return els[id]; } };
  global.escP = function (x) { return String(x == null ? '' : x); };
  var PAGE_FOLDERS = [{ v: 'services', lb: 'خدمات' }];
  var PAGE_FIELDS = ['cmsPgTitle'];
  var renderCmsPageNewFull = function () { throw new Error('شبیه‌سازی'); };
  var cmsDraftRestore = function () {}; var cmsDraftBind = function () {};
  try { eval(WRAP + '\nwindow.__rf = renderCmsPageNew;'); } catch (eE) { return false; }
  var renderCmsPageNew = window.__rf;
  var wrap = mkEl('cmsWrap');
  renderCmsPageNew(wrap);
  var bad = wrap.innerHTML.indexOf('خطای رندر فرم کامل') > -1 && wrap.innerHTML.indexOf('cmsPagePublish()') > -1;
  renderCmsPageNewFull = function (el) { el.innerHTML = 'FULL'; };
  renderCmsPageNew(wrap);
  return bad && wrap.innerHTML === 'FULL';
})());

console.log('=== tester572: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
