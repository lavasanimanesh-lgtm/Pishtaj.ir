#!/usr/bin/env node
'use strict';
/* tester648 — v34.38.20 (SEO-CRAWL-HYGIENE): قفلِ اصلاحات بهداشتِ کراولِ سایت.
   از خروجی کراولر بیرونی + ممیزی محلی seo_audit_local.py سه دسته مشکل واقعی رفع شد:
   ۱) سه صفحهٔ orphan واقعی لینکِ ورودی گرفتند (دو پست وبلاگ EPC/پایپینگ + راهنمای ترانسمیترها)
   ۲) عنوان‌های بلند (>۶۵) و توضیح‌های بلند (>۱۶۵) کوتاه شدند
   ۳) en/careers.html دادهٔ ساختاریافتهٔ Organization+BreadcrumbList+WebPage گرفت
   این تستر آن‌ها را قفل می‌کند تا در ویرایش‌های بعدی پس‌نروند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

/* ── فایل‌هایی که عنوان‌شان بالای ۶۵ بود ── */
var TITLE_FILES = [
  'blog/pumps-procurement-guide/index.html', 'brands/emerson-rosemount.html',
  'knowledge-center/article-031.html', 'knowledge-center/asme-b16-34.html',
  'knowledge-center/asme-b16-9.html', 'knowledge-center/asme-b36-19.html',
  'knowledge-center/astm-a213.html', 'knowledge-center/astm-a234-wpb.html',
  'knowledge-center/en-10204-certificate-guide.html', 'knowledge-center/psv-prv-api-520-api-526.html',
  'products/42-inch-wpb-wphy-elbow.html', 'products/anf-ball-valve-3-inch-class-150.html',
  'products/flange-20-inch-class-1500-a182-f11.html', 'products/hlok-5-valve-manifold.html'
];

/* ── فایل‌هایی که توضیح متایشان بالای ۱۶۵ بود ── */
var DESC_FILES = [
  'industries/cement/index.html', 'industries/steel/index.html',
  'knowledge-center/article-014.html', 'knowledge-center/astm-a105.html',
  'knowledge-center/astm-a312.html', 'knowledge-center/en-10204-certificate-guide.html',
  'knowledge-center/schedule-sch-40-80-160.html', 'knowledge-center/seamless-pipe-complete-guide.html',
  'products/42-inch-wpb-wphy-elbow.html', 'products/flange-20-inch-class-1500-a182-f11.html',
  'services/products/displacer-level-transmitter.html', 'services/products/expansion-joints-flexible-hose.html'
];

/* ۱) طول عنوان ≤۶۵ */
TITLE_FILES.forEach(function (rel) {
  var t = read(rel).match(/<title>([\s\S]*?)<\/title>/i);
  var title = t ? t[1].replace(/\s+/g, ' ').trim() : '';
  T('CRAWL: ' + rel + ' — عنوان ≤۶۵ کاراکتر', title.length > 0 && title.length <= 65, 'len=' + title.length);
});

/* ۲) طول توضیح متا ≤۱۶۵ */
DESC_FILES.forEach(function (rel) {
  var m = read(rel).match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  var desc = m ? m[1] : '';
  T('CRAWL: ' + rel + ' — توضیح متا ≤۱۶۵ کاراکتر', desc.length > 0 && desc.length <= 165, 'len=' + desc.length);
});

/* ۳) سه صفحهٔ orphan قبلی حالا لینکِ ورودیِ استاتیک دارند */
var ORPHANS = [
  { rel: 'blog/electrical-equipment-epc/index.html', needle: 'electrical-equipment-epc/' },
  { rel: 'blog/piping-equipment-procurement/index.html', needle: 'piping-equipment-procurement/' },
  { rel: 'services/transmitters-guide/index.html', needle: 'transmitters-guide/' }
];
ORPHANS.forEach(function (o) {
  var found = [];
  ['blog/index.html', 'services/instrumentation-supply.html', 'knowledge-center/differential-pressure-transmitter-guide.html', 'services/index.html'].forEach(function (hub) {
    if (!exists(hub)) return;
    if (read(hub).indexOf('href="' + o.needle + '"') > -1 ||
        read(hub).indexOf('href="../' + o.needle + '"') > -1 ||
        read(hub).indexOf('href="/' + o.needle + '"') > -1) found.push(hub);
  });
  T('CRAWL: ' + o.rel + ' — دیگر orphan نیست (لینکِ ورودی دارد)', found.length > 0, found.join(','));
});

/* ۴) en/careers.html دادهٔ ساختاریافتهٔ معتبر دارد */
(function () {
  var html = read('en/careers.html');
  var m = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  var ok = false, types = [];
  if (m) {
    try {
      var d = JSON.parse(m[1]);
      var items = (d && d['@graph']) || [d];
      items.forEach(function (it) {
        if (it && it['@type']) {
          var t = it['@type'];
          types = types.concat(Array.isArray(t) ? t : [t]);
        }
      });
      ok = types.indexOf('Organization') > -1 && types.indexOf('BreadcrumbList') > -1;
    } catch (e) { ok = false; }
  }
  T('CRAWL: en/careers.html — JSON-LD معتبر (Organization+BreadcrumbList)', ok, types.join(','));
})();

/* ۵) وبلاگ دو پستِ EPC/پایپینگ را هم در فهرست کارت‌ها و هم در متنِ استاتیک دارد */
(function () {
  var blog = read('blog/index.html');
  T('CRAWL: blog/index.html — پست برق EPC را لینکِ استاتیک می‌دهد', blog.indexOf('href="electrical-equipment-epc/"') > -1);
  T('CRAWL: blog/index.html — پست پایپینگ پروژه‌ای را لینکِ استاتیک می‌دهد', blog.indexOf('href="piping-equipment-procurement/"') > -1);
  T('CRAWL: blog/index.html — هر دو پست در آرایهٔ کارت‌های وبلاگ هستند',
    blog.indexOf('u:"electrical-equipment-epc/"') > -1 && blog.indexOf('u:"piping-equipment-procurement/"') > -1);
})();

console.log('=== tester648: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
