#!/usr/bin/env node
'use strict';
/* tester580 — v34.31.0: ریشهٔ «شمارندهٔ عنوان نمی‌شمرد» — برخورد شناسهٔ pgTitle فرم CMS با
   شناسهٔ رسمی عنوان پنل هدر (ده‌ها ماژول textContent می‌نویسند؛ getElementById همیشه span هدر
   را می‌داد → شمارنده همیشه ۰، AI/اعمال خارجی عنوان را در فرم پر نمی‌کردند).
   + شمارندهٔ زندهٔ نامک (cmsSlugFb) + زنده‌کردن شمارنده‌های مردهٔ فرم محصول (cmsPrCount)
   + شفاف‌سازی «کف ۲۰۰ حرف فقط برای متن». */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');

/* ── ۱) ریشه‌کنی برخورد شناسه ── */
T('ID: فیلد عنوان فرم به cmsPgTitle تغییر نام یافت (id + PAGE_FIELDS + cmsExtFill)', cms.indexOf('id="cmsPgTitle"') > -1 && cms.indexOf("{ id: 'cmsPgTitle', val: v.title }") > -1 && cms.indexOf("['cmsPgTitle'") > -1 && cms.indexOf("{ id: 'pgTitle', val:") === -1);
T('ID: هیچ خواندن/نوشتن value روی pgTitle قدیمی در cms.js نمانده (فقط خط هدرِ textContent)', (function () {
  var bad = cms.match(/getElementById\('pgTitle'\)[^\n]*\.(value|textContent)/g) || [];
  return bad.length === 1 && /textContent$/.test(bad[0]);
})());
T('ID: شمارندهٔ عنوان به شناسهٔ جدید وصل است (cmsPgTitleLen در set و oninput)', cms.indexOf("set('cmsPgTitleLen'") > -1 && cms.indexOf('id="cmsPgTitle" oninput="cmsPgCount()"') > -1);

/* ── ۲) بازخورد زندهٔ نامک ── */
T('SLUG: cmsSlugFb موجود و به pgSlug و prSlug با oninput وصل است', cms.indexOf('window.cmsSlugFb = function') > -1 && cms.indexOf('id="pgSlugLen"') > -1 && cms.indexOf('id="prSlugLen"') > -1);
T('SLUG: بازخورد نامک در cmsPgCount و cmsPrCount هم به‌روز می‌شود (پر کردن برنامه‌ای)', /cmsPgCount[\s\S]{0,2000}cmsSlugFb\('pgSlug', 'pgSlugLen'\)/.test(cms) && /cmsPrCount[\s\S]{0,900}cmsSlugFb\('prSlug', 'prSlugLen'\)/.test(cms));
T('BEHAV: cmsSlugFb — نامعتبر (نویسه + بزرگ) با پیشنهاد، معتبر با ✓', (function () {
  var slice = cms.slice(cms.indexOf('window.cmsSlugFb = function'), cms.indexOf('window.cmsPgCount = function'));
  var st = { inp: { value: '' }, sp: { textContent: '', style: {} } };
  global.window = {};
  global.document = { getElementById: function (id) { return id === 'x' ? st.inp : id === 's' ? st.sp : null; } };
  eval(slice + ';window.__F = window.cmsSlugFb;');
  var F = function (v) { st.inp.value = v; window.__F('x', 's'); return st.sp.textContent + '|' + st.sp.style.color; };
  var bad = F('Valve Repair!');
  var ok = F('valve-repair-services');
  var empty = F('');
  return bad.indexOf('نویسهٔ نامعتبر') > -1 && bad.indexOf('valve-repair') > -1 && ok.indexOf('✓') > -1 && empty.charAt(0) === '|';
})());

/* ── ۳) شمارنده‌های فرم محصول زنده شدند ── */
T('PROD: cmsPrCount + oninput روی prTitle/prDesc/prBody + span جدید prBodyLen', cms.indexOf('window.cmsPrCount = function') > -1 && cms.indexOf('id="prTitle" oninput="cmsPrCount()"') > -1 && cms.indexOf('id="prDesc" rows="2" oninput="cmsPrCount()"') > -1 && cms.indexOf('id="prBody" rows="9"') > -1 && cms.indexOf('prBody" rows="9" placeholder="<h2>معرفی ...</h2><p>...</p>" oninput="cmsPrCount()"') > -1 && cms.indexOf('id="prBodyLen"') > -1);
T('PROD: cmsPrCount پس از بازیابی پیش‌نویس و پس از اعمال خارجی صدا زده می‌شود', (/cmsPrCount\(\); \/\* v34\.29\.[56]: شمارنده‌ها بلافاصله پس از بازیابی پیش‌نویس \*\//.test(cms)) && (/cmsDraftBind\(PROD_FIELDS\); cmsPrCount\(\); \/\* v34\.29\.[56] \*\//.test(cms)));

/* ── ۴) شفاف‌سازی کف ۲۰۰ ── */
T('LABEL: «کف ۲۰۰ حرف، فقط همین فیلد» در هر دو فرم (صفحه + محصول)', (cms.match(/کف ۲۰۰ حرف، فقط همین فیلد/g) || []).length >= 3);

console.log('=== tester580: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
