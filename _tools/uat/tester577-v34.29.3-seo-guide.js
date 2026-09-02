#!/usr/bin/env node
'use strict';
/* tester577 — v34.29.7: راهنمای سئو برای کاربران ناآشنا — چک‌لیست زنده + ۶ گام + دکمه‌های اجرای ابزار */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');

T('GUIDE: جعبهٔ راهنما بالای تب سئو رندر می‌شود (قبل از seoStatsBar)', cms.indexOf('cmsSeoGuideBox() + seoStatsBar()') > -1);
T('GUIDE: همهٔ دکمه‌های راهنما به توابع موجود اشاره می‌کنند (۷ ابزار)', ['cmsGscSelfTest', 'cmsSeoIssue', 'cmsSeoSitemapPush', 'cmsIndexWizard', 'cmsSeoAiBatch', "cmsTab('page')", 'cmsAltScan'].every(function (x) { return cms.indexOf(x) > -1; }));
T('GUIDE: چک‌لیست زندهٔ ۴گانه (اتصال GSC + ایراد عنوان/توضیح + خارج از نقشه + ایندکس‌نشده)', cms.indexOf('seoGuideGsc') > -1 && cms.indexOf('صفحات با ایراد عنوان/توضیح') > -1 && cms.indexOf('صفحات خارج از نقشهٔ سایت') > -1 && cms.indexOf('صفحات ایندکس‌نشده') > -1);
T('GUIDE: ۶ گام + نکن‌ها + برنامهٔ ۱۵ دقیقه‌ای + واژه‌نامه', ['راهنمای سئو برای همه', 'این کارها را نکنید', 'برنامهٔ ۱۵ دقیقه‌ای هفتگی', 'واژه‌نامهٔ کوچک'].every(function (x) { return cms.indexOf(x) > -1; }));
T('GUIDE: زبان غیرفنی — واژه‌نامه ایندکس/کرال/CTR/slugin توضیح ساده دارد', cms.indexOf('<b>ایندکس (Index):</b>') > -1 && cms.indexOf('<b>CTR:</b>') > -1);
T('GUIDE: toggle با sessionStorage ماندگار است (ptfSeoGuide — بدون localStorage مستقیم طبق گارد A10)', cms.indexOf("sessionStorage.getItem('ptfSeoGuide')") > -1 && cms.indexOf('cmsSeoGuideToggle') > -1);
T('GUIDE: probe اتصال GSC پس از رندر صدا زده می‌شود', cms.indexOf('cmsSeoGuideGscProbe(); /* v34.29.2') > -1);

T('BEHAV: رندر جعبه با دادهٔ نمونه — چیپ‌های وضعیت و دکمه‌ها', (function () {
  var slice = cms.slice(cms.indexOf('function cmsSeoGuideOpen'), cms.indexOf('function renderCmsSeo'));
  global.window = {};
  global.sessionStorage = { getItem: function () { return null; }, setItem: function () {} };
  global.document = { getElementById: function () { return null; } };
  global.escP = function (x) { return String(x == null ? '' : x); };
  var _seoMeta = { stats: { total: 120, 'no-desc': 7, 'no-title': 2, 'no-h1': 1, 'desc-short': 4, 'title-long': 3 }, sitemap: 110 };
  try { eval(slice + ';window.__box = cmsSeoGuideBox;'); } catch (e) { return false; }
  var h = window.__box();
  return h.indexOf('10 صفحهٔ ایراد جدی') > -1 && h.indexOf('7 ایراد جزئی') > -1 && h.indexOf('10 صفحه هنوز در نقشه نیست') > -1 && h.indexOf('🧪 آزمون اتصال') > -1 && h.indexOf('پنهان کردن راهنما') > -1;
})());
T('BEHAV: حالت سبز (همه سالم) و حالت جمع‌شده', (function () {
  var slice = cms.slice(cms.indexOf('function cmsSeoGuideOpen'), cms.indexOf('function renderCmsSeo'));
  global.window = {};
  var mode = 'green';
  global.sessionStorage = { getItem: function () { return mode === 'green' ? null : '0'; }, setItem: function () {} };
  global.document = { getElementById: function () { return null; } };
  global.escP = function (x) { return String(x == null ? '' : x); };
  var _seoMeta = { stats: { total: 50, ok: 50 }, sitemap: 55 };
  eval(slice + ';window.__box = cmsSeoGuideBox;');
  var green = window.__box();
  mode = 'collapsed';
  var collapsed = window.__box();
  return green.indexOf('✅ همهٔ صفحات سالم‌اند') > -1 && green.indexOf('✅ نقشه کامل است') > -1 && collapsed.indexOf('نمایش راهنما ▼') > -1 && collapsed.indexOf('واژه‌نامه') === -1;
})());
T('BEHAV: probe چهار وضعیت GSC را درست رنگ می‌زند', (function () {
  var slice = cms.slice(cms.indexOf('window.cmsSeoGuideGscProbe'), cms.indexOf('function cmsSeoGuideBox'));
  var fake = null;
  global.window = {};
  global.document = { getElementById: function (id) { return id === 'seoGuideGsc' ? { set innerHTML(v) { fake = v; } } : null; } };
  global.cmsGsc = function (a, b, cb) { cb(global.__resp); };
  var st = {};
  global.__resp = { verdict: 'ok' }; eval(slice); window.cmsSeoGuideGscProbe(); st.ok = fake.indexOf('✅ وصل است') > -1;
  global.__resp = { verdict: 'no_match' }; window.cmsSeoGuideGscProbe(); st.nm = fake.indexOf('⛔') > -1;
  global.__resp = { verdict: 'no_config' }; window.cmsSeoGuideGscProbe(); st.nc = fake.indexOf('gsc-config.php') > -1;
  global.__resp = { verdict: 'low_perm' }; window.cmsSeoGuideGscProbe(); st.lp = fake.indexOf('فقط خواندنی') > -1;
  return st.ok && st.nm && st.nc && st.lp;
})());

console.log('=== tester577: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
