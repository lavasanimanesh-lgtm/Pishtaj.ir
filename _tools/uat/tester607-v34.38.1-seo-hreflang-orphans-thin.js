#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester607-v34.38.1-seo-hreflang-orphans-thin.js

   قفل اصلاحات سئوی ۲۰۲۶-۰۹-۰۷:
   ۱) HREFLANG-RECIPROCAL — about/ و services/ و projects/ نسخهٔ en خود را
      اعلام می‌کنند (قبلاً فقط en→fa بود و گوگل کلاستر را نادیده می‌گرفت)؛
      careers/ دیگر به صفحهٔ noindexِ en/careers.html اشاره نمی‌کند.
   ۲) PRODUCT-ORPHANS — هر ۷ صفحهٔ /products/* دست‌کم یک لینک ورودی داخلی
      دارند (بخش «محصولات ویژه» هاب + لینک‌های متنی دسته‌ها)؛ ۳۰ لینک خالی
      href="" هاب محصولات اصلاح شد.
   ۳) THIN-INDEX — search/ از ایندکس و نقشه خارج شد؛ صفحات کم‌محتوا
      (careers/news/assistant/rfq-checklist + هر ۴ صفحهٔ en) غنی‌سازی شدند.
   ۴) MICRO — حذف preconnect بی‌استفادهٔ گوگل‌فونت؛ کوتاه‌سازی تایتل ۷۲
      کاراکتری؛ تراز build_sitemap.py با api/cms.php برای بخش products.
   ============================================================================= */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }
function words(html) {
  var t = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  return t.split(/\s+/).filter(function (w) { return w.length; }).length;
}

/* ───────────────────── ۱) hreflang متقابل ───────────────────── */
head('۱. HREFLANG-RECIPROCAL');

var pairs = [
  ['about/index.html', 'en/about.html'],
  ['services/index.html', 'en/services.html'],
  ['projects/index.html', 'en/projects.html']
];
pairs.forEach(function (pr, i) {
  var fa = read(pr[0]), en = read(pr[1]);
  var faUrl = 'https://pishtaj.ir/' + pr[0].replace(/index\.html$/, '');
  var enUrl = 'https://pishtaj.ir/' + pr[1];
  T('۱.' + (i * 2 + 1) + ' ' + pr[0] + ' نسخهٔ en را اعلام می‌کند',
    fa.indexOf('hreflang="en" href="' + enUrl + '"') > -1);
  T('۱.' + (i * 2 + 2) + ' ' + pr[1] + ' لینک برگشتی fa دارد',
    en.indexOf('hreflang="fa-IR" href="' + faUrl + '"') > -1);
});
T('۱.۷ careers/ به صفحهٔ noindex اشاره نمی‌کند',
  read('careers/index.html').indexOf('hreflang="en"') === -1 &&
  read('en/careers.html').indexOf('noindex') > -1);

/* ───────────────────── ۲) یتیم‌های /products ───────────────────── */
head('۲. PRODUCT-ORPHANS');

var hub = read('services/products/index.html');
var prods = ['gate-valve-16-inch-cl600.html', '42-inch-wpb-wphy-elbow.html',
  'flange-20-inch-class-1500-a182-f11.html', 'balloff-valve-position-encoder.html',
  'hlok-5-valve-manifold.html', 'flame-arrester-3-inch.html',
  'anf-ball-valve-3-inch-class-150.html'];
var hubMiss = prods.filter(function (fn) { return hub.indexOf('products/' + fn) === -1; });
T('۲.۱ هاب هر ۷ محصول را لینک می‌کند', hubMiss.length === 0, hubMiss.join(','));
T('۲.۲ لینک متنی گیت‌ولو در صفحهٔ دسته',
  read('services/products/gate-valve.html').indexOf('products/gate-valve-16-inch-cl600.html') > -1);
T('۲.۳ لینک متنی انکدر بالوف در کنترل‌ولو',
  read('services/products/control-valve.html').indexOf('products/balloff-valve-position-encoder.html') > -1);
T('۲.۴ لینک متنی شعله‌گیر در اطفای حریق',
  read('services/products/fire-suppression-system.html').indexOf('products/flame-arrester-3-inch.html') > -1);
var emptyHref = [];
fs.readdirSync(path.join(ROOT, 'services/products')).forEach(function (fn) {
  if (/\.html$/.test(fn) && read('services/products/' + fn).indexOf('<a href="">') > -1) emptyHref.push(fn);
});
T('۲.۵ هیچ لینک خالی href="" در محصولات نیست', emptyHref.length === 0, emptyHref.join(','));
T('۲.۶ لینک‌های هاب محصولات به ../ می‌روند',
  (hub.match(/<a href="\.\.\/">هاب محصولات صنعتی<\/a>/g) || []).length === 0 && // hub itself has none
  read('services/products/gate-valve.html').indexOf('<a href="../">هاب محصولات صنعتی</a>') > -1);

/* ───────────────────── ۳) صفحات کم‌محتوا ───────────────────── */
head('۳. THIN-INDEX');

T('۳.۱ search/ نوایندکس است',
  /<meta name="robots" content="noindex, follow"/.test(read('search/index.html')));
T('۳.۲ search/ در نقشه نیست', read('sitemap-misc.xml').indexOf('/search/') === -1);
[['careers/index.html', 280], ['news/index.html', 340], ['assistant/index.html', 400],
 ['tools/rfq-checklist/index.html', 320], ['en/index.html', 400], ['en/about.html', 380],
 ['en/services.html', 330], ['en/projects.html', 480]].forEach(function (tc, i) {
  var w = words(read(tc[0]));
  T('۳.' + (i + 3) + ' ' + tc[0] + ' کم‌محتوا نیست (' + w + ' کلمه)', w >= tc[1], w);
});
T('۳.۱۱ بخش FAQ استاتیک در careers',
  read('careers/index.html').indexOf('پرسش‌های متداول همکاری') > -1 &&
  read('careers/index.html').indexOf('"@type":"FAQPage"') > -1);

/* ───────────────────── ۴) ریزه‌کاری‌ها ───────────────────── */
head('۴. MICRO');

T('۴.۱ preconnect بی‌استفادهٔ گوگل‌فونت حذف شد',
  read('index.html').indexOf('fonts.googleapis.com') === -1);
var balloffTitle = (read('products/balloff-valve-position-encoder.html').match(/<title>(.*?)<\/title>/) || [])[1] || '';
T('۴.۲ تایتل بالوف ≤ ۶۰ کاراکتر است', balloffTitle.length <= 60 && balloffTitle.length > 0, balloffTitle);
T('۴.۳ build_sitemap.py بخش products را می‌شناسد (تراز با cms.php)',
  read('_tools/build_sitemap.py').indexOf('"products": "sitemap-products.xml"') > -1 &&
  read('api/cms.php').indexOf("'products'") > -1);
T('۴.۴ lastmod صفحات لمس‌شده به‌روز است',
  read('sitemap-misc.xml').indexOf('<loc>https://pishtaj.ir/careers/</loc><lastmod>2026-09-07</lastmod>') > -1 &&
  read('sitemap-en.xml').indexOf('<loc>https://pishtaj.ir/en/</loc><lastmod>2026-09-07</lastmod>') > -1);

/* ───────────────────── ۵) انطباق نسخه و نگهبان ───────────────────── */
head('۵. انطباق نسخه و نگهبان گیت');

var verJson = JSON.parse(read('VERSION.json'));
T('۵.۱ VERSION.json روی v34.38.13 است', verJson.crm_version === 'v34.38.13', verJson.crm_version);
T('۵.۲ تستر در گیت CI ثبت شده است',
  read('_tools/uat/run-ci-gate.js').indexOf('tester607-v34.38.1-seo-hreflang-orphans-thin.js') > -1);

console.log('\n=== tester607-v34.38.1: ' + p + ' PASS / ' + f + ' FAIL ===\n');
if (f > 0) process.exit(1);
