#!/usr/bin/env node
'use strict';
/* tester574 — v34.37.1: ریشه‌کنی تب‌های خالی CMS (TAB-DIRECT)
   RCA با بوت کامل اپ (jsdom + ۱۰۷ اسکریپت): cmsTab به goPanelByName('cms') تکیه می‌کرد
   که در leads.js با «جستجوی رشته‌ای onclick دکمه‌های سایدبار» دکمهٔ cms را پیدا و کلیک
   می‌کند. وقتی RBAC/بازساز منو دکمه را حذف/مخفی/تغییرفرمت کند، یافتن بی‌صدا ناموفق
   می‌شود: _tab عوض می‌شود ولی پنل هرگز رندر نمی‌شود = «تب خالی». بازتولید ماشینی:
   «دکمه‌های منطبق: 0 · goPanel calls=0 · cmsWrap بدون تغییر». رفع: رندر مستقیم. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var TABFN = blk(cms, 'window.cmsTab = function', '\n  };');

T('FIX: cmsTab داخل CMS مستقیم رندر می‌کند (renderCms(el))', TABFN.indexOf("var el = document.getElementById('cmsWrap');") > -1 && TABFN.indexOf('renderCms(el); return;') > -1);
T('FIX: goPanelByName فقط مسیر جایگزینِ ورود از بیرون است (typeof guard)', TABFN.indexOf("if (typeof goPanelByName === 'function') goPanelByName('cms');") > -1 && cms.indexOf('TAB-DIRECT') > -1);
T('FIX: گاردهای ۲۶/۲۷ سرجای‌اند (پوستهٔ صفحه + TAB-GUARD + بنر کش)', cms.indexOf('renderCmsPageNewFull') > -1 && cms.indexOf('TAB-GUARD') > -1 && cms.indexOf('PTF_CMS_JS_VER') > -1);
T('FIX: رفتاری — با cmsWrap موجود، cmsTab بدون goPanelByName رندر می‌کند', (function () {
  var slice = blk(cms, "var _tab = 'news';", 'window.renderCms = function');
  var st = { gpn: 0, renders: 0, hideWrap: false, wrap: { innerHTML: '' } };
  global.window = {};
  global.goPanelByName = function () { st.gpn++; }; /* باید صفر بار در حالت داخل-CMS صدا شود */
  global.document = { getElementById: function (id) { return id === 'cmsWrap' && !st.hideWrap ? st.wrap : null; } };
  global.escP = function (x) { return String(x == null ? '' : x); };
  var renderCms = function (el) { st.renders++; el.innerHTML = 'TAB:' + (window.__getTab ? window.__getTab() : '?'); };
  try { eval(slice + ';window.__getTab=function(){return _tab;};'); } catch (e) { return false; }
  if (typeof window.cmsTab !== 'function') return false;
  window.cmsTab('page');
  var ok1 = st.gpn === 0 && st.renders === 1 && st.wrap.innerHTML === 'TAB:page';
  st.hideWrap = true;
  window.cmsTab('q');
  var ok2 = st.gpn === 1 && st.renders === 1; /* بیرون از CMS → فقط جایگزین سایدبار */
  return ok1 && ok2;
})());
T('HYG: قدم publish/sched هم از همین cmsTab بهره می‌برند (بدون مسیر جدا)', cms.split("window.cmsTab('q')").length >= 3);

console.log('=== tester574: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
