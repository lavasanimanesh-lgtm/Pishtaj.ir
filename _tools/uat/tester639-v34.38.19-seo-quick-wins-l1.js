#!/usr/bin/env node
'use strict';
/* tester639 — v34.38.19 (SEO-QUICK-WINS-L1): قفلِ دو بردِ سریعِ سطح ۱ سئو.
   ۱) تطبیقِ عنوانِ صفحهٔ دیسپلیسر با کوئریِ واقعیِ GSC: کاربر «لول ترانسمیتر دیسپلیسر»
      جستجو می‌کند (۱۱ نمایش، جایگاه ۲۶) ولی عنوان/ H1 قبلاً «ترانسمیتر سطح» می‌گفت.
      حالا هر دو عبارت («لول ترانسمیتر دیسپلیسری» + «ترانسمیتر سطح Displacer») آمده‌اند.
   ۲) لینک داخلی از صفحهٔ اصلی (پرقدرت‌ترین صفحه) به سه صفحهٔ هدفِ بدونِ لینکِ ریشه:
      ترانسمیتر فشار روزمونت 3051 (۵۳ نمایش)، لول ترانسمیتر دیسپلیسر، کنترل ولو بخار. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ── ۱) صفحهٔ دیسپلیسر — تطبیق با کوئریِ واقعی ── */
var disp = fs.readFileSync(path.join(ROOT, 'services/products/displacer-level-transmitter.html'), 'utf8');
var title = (disp.match(/<title>(.*?)<\/title>/) || [])[1] || '';
var h1 = (disp.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1] || '';
var desc = (disp.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
var ogt = (disp.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '';

T('SEO: title صفحهٔ دیسپلیسر «لول ترانسمیتر دیسپلیسر» را دارد (کوئری واقعی)', title.indexOf('لول ترانسمیتر دیسپلیسر') > -1);
T('SEO: title هم‌زمان «ترانسمیتر سطح» را هم نگه می‌دارد (کوئری هم‌خانواده)', title.indexOf('ترانسمیتر سطح') > -1);
T('SEO: H1 «لول ترانسمیتر» را دارد', h1.indexOf('لول ترانسمیتر') > -1);
T('SEO: description با «لول ترانسمیتر دیسپلیسری» شروع می‌شود', desc.indexOf('لول ترانسمیتر دیسپلیسری') === 0);
T('SEO: og:title هم با H1 هماهنگ است', ogt.indexOf('لول ترانسمیتر دیسپلیسر') > -1);
T('SEO: JSON-LD هنوز Service + Breadcrumb + FAQ است (قرارداد tester638 حفظ شد)', (function () {
  var m = disp.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return false;
  var d = JSON.parse(m[1]);
  var t = (d['@graph'] || []).map(function (x) { return x['@type']; });
  return t.indexOf('Service') > -1 && t.indexOf('Product') === -1 &&
         t.indexOf('BreadcrumbList') > -1 && t.indexOf('FAQPage') > -1;
})());
T('SEO: نامِ Service در JSON-LD «لول ترانسمیتر» را دارد', disp.indexOf('"@type":"Service","name":"لول ترانسمیتر') > -1);

/* ── ۲) صفحهٔ اصلی — لینک داخلی به سه صفحهٔ هدف ── */
var home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function homeLink(href, label) {
  var re = new RegExp('<a[^>]+href="' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>[^<]*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^<]*</a>');
  return re.test(home);
}
T('SEO: صفحهٔ اصلی به راهنمای ترانسمیتر فشار روزمونت 3051 لینک می‌دهد',
  homeLink('knowledge-center/rosemount-pressure-transmitter-family.html', 'روزمونت 3051'));
T('SEO: صفحهٔ اصلی به لول ترانسمیتر دیسپلیسری لینک می‌دهد',
  homeLink('services/products/displacer-level-transmitter.html', 'لول ترانسمیتر دیسپلیسری'));
T('SEO: صفحهٔ اصلی به کنترل ولو بخار لینک می‌دهد',
  homeLink('knowledge-center/steam-control-valve-sizing-guide.html', 'کنترل ولو بخار'));
T('SEO: سه لینک داخلِ کارتِ ابزار دقیق (اندازه‌گیری/کنترل/پایش) جای گرفته‌اند — هم‌بافتی و مرتبط',
  home.indexOf('راهنماهای فنی پربازدید') > -1 &&
  home.indexOf('اندازه‌گیری، کنترل و پایش فرایند') < home.indexOf('راهنماهای فنی پربازدید'));

console.log('=== tester639: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
