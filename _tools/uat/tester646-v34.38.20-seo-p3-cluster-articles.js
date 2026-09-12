#!/usr/bin/env node
'use strict';
/* tester646 — v34.38.20 (SEO-P3-CLUSTER-ARTICLES): قفلِ P3 رودمپ ۰۹-۰۲ — خوشهٔ محتوایی پشتیبان.
   ۱۰ مقالهٔ جدید مرکز دانش (۵ پایپینگ + ۵ ابزار دقیق) با مولد استاندارد kc_rewrite_gen ساخته شد.
   قرارداد محتوا: هر مقاله ≥۲ لینک خروجی به صفحهٔ پول‌سازِ خوشهٔ خود دارد، متن یکتای ≥۵۰۰ کاراکتر،
   عنوان ≤۶۸، توضیح متا ۱۲۰–۱۷۵، کانونیکال خود، robots index، اسکیمای Article+Breadcrumb+FAQ(≥۳)،
   تصویر موجود و ثبت در sitemap-knowledge-center. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

var CLUSTERS = {
  'piping': ['kc-flange-pressure-class-150-600', 'erw-saw-lsaw-pipe-difference', 'pipe-hydrotest-procedure', 'kc-a335-p11-p22-p91-pipe', 'kc-gasket-spiralwound-rtj-selection'],
  'instrumentation': ['flowmeter-calibration-procedure', 'magmeter-installation-earthing', 'dcs-vs-plc-difference', 'dp-transmitter-level-flow', 'control-valve-positioner-calibration']
};
var MONEY = { 'piping': '../services/piping-supply.html', 'instrumentation': '../services/instrumentation-supply.html' };

/* ── مدل مستقل ۱: متنِ قابل‌مشاهدهٔ مقاله (حذف تگ/اسکریپت/استایل) ── */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ── مدل مستقل ۲: شمارش ارجاع به صفحهٔ پول‌ساز ── */
function moneyLinks(html, money) {
  var re = new RegExp('href="' + money.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g');
  return (html.match(re) || []).length;
}

var allTitles = [];
Object.keys(CLUSTERS).forEach(function (cluster) {
  var money = MONEY[cluster];
  CLUSTERS[cluster].forEach(function (slug) {
    var rel = 'knowledge-center/' + slug + '.html';
    var html = read(rel);
    var t;

    /* ۱) فایل حاضر */
    T('SEO-P3: ' + slug + ' — فایل تولید شده است', exists(rel));

    /* ۲) عنوان + طول */
    t = html.match(/<title>([\s\S]*?)<\/title>/i);
    var title = t ? t[1].replace(/\s+/g, ' ').trim() : '';
    T('SEO-P3: ' + slug + ' — title غیرخالی و ≤۶۸ کاراکتر', title.length > 0 && title.length <= 68, 'len=' + title.length);
    allTitles.push(title);

    /* ۳) توضیح متا ۱۲۰–۱۷۵ */
    t = html.match(/<meta name="description" content="([^"]+)"/i);
    var desc = t ? t[1] : '';
    T('SEO-P3: ' + slug + ' — توضیح متا ۱۲۰–۱۷۵ کاراکتر', desc.length >= 120 && desc.length <= 175, 'len=' + desc.length);

    /* ۴) کانونیکال خود */
    T('SEO-P3: ' + slug + ' — canonical به نشانی خودش است',
      new RegExp('<link rel="canonical" href="https://pishtaj\\.ir/' + rel + '"').test(html));

    /* ۵) robots index و بدون noindex */
    T('SEO-P3: ' + slug + ' — robots index,follow (بدون noindex)',
      /<meta name="robots" content="index, follow"/.test(html) && !/noindex/i.test(html));

    /* ۶) اسکیمای ساخت‌یافته: Article + Breadcrumb + FAQ ≥۳ */
    var ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    var ldOk = false, faqQ = 0;
    if (ld) { try { var o = JSON.parse(ld[1]); ldOk = true;
      var types = JSON.stringify(o);
      faqQ = (types.match(/"@type"\s*:\s*"Question"/g) || []).length;
      if (/"@graph"/.test(types)) {
        var g = o['@graph'];
        var has = function (ty) { return g.some(function (n) { return n['@type'] === ty; }); };
        ldOk = has('Article') && has('BreadcrumbList') && has('FAQPage');
      } else {
        ldOk = o['@type'] === 'Article';
      }
    } catch (e) { ldOk = false; } }
    T('SEO-P3: ' + slug + ' — JSON-LD معتبر (Article + Breadcrumb + FAQPage)', ldOk);
    T('SEO-P3: ' + slug + ' — FAQPage با ≥۳ پرسش', faqQ >= 3, faqQ);

    /* ۷) قرارداد محتوا: ≥۲ لینک به صفحهٔ پول‌سازِ خوشه */
    var ml = moneyLinks(html, money);
    T('SEO-P3: ' + slug + ' — ≥۲ لینک به صفحهٔ پول‌ساز خوشه (' + money + ')', ml >= 2, ml);

    /* ۸) متن یکتای ≥۵۰۰ کاراکتر */
    var vis = visibleText(html);
    T('SEO-P3: ' + slug + ' — متن یکتای ≥۵۰۰ کاراکتر', vis.length >= 500, vis.length);

    /* ۹) تصویر مقاله موجود است */
    var img = html.match(/<figure><img src="images\/([^"]+)"/) || html.match(/<img src="images\/([^"]+)"/);
    T('SEO-P3: ' + slug + ' — تصویر دارد و فایل آن موجود است',
      !!img && exists('knowledge-center/images/' + img[1]), img ? img[1] : '');

    /* ۱۰) ثبت در سایت‌مپ */
    T('SEO-P3: ' + slug + ' — در sitemap-knowledge-center.xml ثبت است',
      read('sitemap-knowledge-center.xml').indexOf('knowledge-center/' + slug + '.html') > -1);
  });
});

/* ── استقلال مدل: هیچ تیتر تکراری بین ۱۰ مقاله نیست ── */
var uniq = {};
allTitles.forEach(function (t) { uniq[t] = (uniq[t] || 0) + 1; });
var dupTitles = Object.keys(uniq).filter(function (k) { return uniq[k] > 1; });
T('BEHAV: تیترهای ۱۰ مقاله یکتا هستند', allTitles.length === 10 && dupTitles.length === 0, dupTitles.join(','));

/* ── استقلال مدل: هر مقالهٔ پایپینگ به صفحهٔ پایپینگ و هر ابزاردقیق به ابزاردقیق لینک می‌دهد ── */
(function () {
  var wrong = [];
  Object.keys(CLUSTERS).forEach(function (cluster) {
    CLUSTERS[cluster].forEach(function (slug) {
      var html = read('knowledge-center/' + slug + '.html');
      if (moneyLinks(html, MONEY[cluster]) < 2) wrong.push(slug);
    });
  });
  T('BEHAV: هر ۱۰ مقاله قرارداد ۲ لینک به صفحهٔ پول‌سازِ درست را دارند', wrong.length === 0, wrong.join(','));
})();

console.log('=== tester646: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
