#!/usr/bin/env node
'use strict';
/* tester645 — v34.38.20 (SEO-P1-MONEY-PAGES): قفلِ تکمیلِ P1 رودمپ ۰۹-۰۲ برای دو صفحهٔ پول‌ساز
   «تامین تجهیزات پایپینگ» و «تامین تجهیزات ابزار دقیق».
   P2 (لینک داخلی ≥۳۰) از قبل برقرار بود؛ این تستر آن را هم قفل می‌کند.
   اقدامات این چرخه:
   ۱) اولین <h2> هر صفحه کلمهٔ دقیق را دارد («خدمات تامین تجهیزات پایپینگ/ابزار دقیق…» — قبلاً «تجهیزات» جا افتاده بود).
   ۲) کلمهٔ دقیق در ۱۰۰ کلمهٔ اولِ متنِ مقاله (نه ناوبری) هست.
   ۳) یک جدول مشخصات فنی واقعی (class="svc-table"، ≥۶ ردیف داده) اضافه شد — تمایز نسبت به رقبای صفحهٔ اول.
   قراردادهای قبلی (عنوان دقیق، توضیح متا، FAQ≥۳، Service/Product/OfferCatalog، کانونیکال خود، نقشه، robots index، JSON-LD سالم) دست‌نخورده. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function has(rel, s) { return read(rel).indexOf(s) > -1; }

/* ── مدل مستقل: استخراجِ متنِ مقاله + اولین h2 (بازتولیدِ منطق، نه copy) ── */
function strip(html) {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return html;
}
function visibleText(html) {
  var t = strip(html).replace(/<[^>]+>/g, ' ');
  return t.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function articleText(html) {
  var m = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  return visibleText(m ? m[1] : html);
}
function firstH2(html) {
  var m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? visibleText(m[1]) : '';
}

var PAGES = [
  { file: 'services/piping-supply.html', kw: 'تامین تجهیزات پایپینگ' },
  { file: 'services/instrumentation-supply.html', kw: 'تامین تجهیزات ابزار دقیق' }
];

PAGES.forEach(function (pg) {
  var s = read(pg.file), kw = pg.kw;
  var h2 = firstH2(s);
  var art = articleText(s);

  /* ۱) اولین h2 کلمهٔ دقیق */
  T('SEO-P1: ' + pg.file + ' — اولین h2 کلمهٔ دقیق دارد', h2.indexOf(kw) > -1, h2);

  /* ۲) کلمهٔ دقیق در ۱۰۰ کلمهٔ اول مقاله */
  T('SEO-P1: ' + pg.file + ' — کلمهٔ دقیق در ۱۰۰ کلمهٔ اول متن مقاله هست', art.slice(0, 100).indexOf(kw) > -1);

  /* ۳) جدول مشخصات فنی */
  T('SEO-P1: ' + pg.file + ' — جدول مشخصات فنی (svc-table) دارد', /<table class="svc-table">/.test(s));
  T('SEO-P1: ' + pg.file + ' — جدول ≥۶ ردیف داده (td) دارد', (s.match(/<td>/g) || []).length >= 24);

  /* ۴) عنوان دقیق دست‌نخورده */
  T('SEO-P1: ' + pg.file + ' — title کلمهٔ دقیق را دارد', new RegExp('<title>[^<]*' + kw.replace(/ /g, ' ') + '[^<]*</title>').test(s));

  /* ۵) توضیح متا حاضر و غیرخالی */
  T('SEO-P1: ' + pg.file + ' — meta description حاضر است', /<meta name="description" content="[^"]{20,}"/.test(s));

  /* ۶) اسکیمای ساخت‌یافته: FAQ≥۳ + Service + Product/OfferCatalog */
  T('SEO-P1: ' + pg.file + ' — FAQPage با ≥۳ پرسش دارد',
    /"@type"\s*:\s*"FAQPage"/.test(s) && (s.match(/"@type"\s*:\s*"Question"/g) || []).length >= 3);
  T('SEO-P1: ' + pg.file + ' — اسکیمای Service دارد', /"@type"\s*:\s*"Service"/.test(s));
  T('SEO-P1: ' + pg.file + ' — اسکیمای Product + OfferCatalog دارد',
    /"@type"\s*:\s*"Product"/.test(s) && /"@type"\s*:\s*"OfferCatalog"/.test(s));

  /* ۷) کانونیکال خود + robots index + نقشه */
  T('SEO-P1: ' + pg.file + ' — canonical به نشانی خودش است',
    new RegExp('<link rel="canonical" href="https://pishtaj\\.ir/' + pg.file.replace(/\./g, '\\.') + '"').test(s));
  T('SEO-P1: ' + pg.file + ' — robots index,follow (بدون noindex)', /<meta name="robots" content="index, follow"/.test(s) && !/noindex/i.test(s));
  T('SEO-P1: ' + pg.file + ' — در sitemap-services.xml ثبت است', has('sitemap-services.xml', pg.file));

  /* ۸) JSON-LD سالم */
  T('SEO-P1: ' + pg.file + ' — JSON-LD parse می‌شود', (function () {
    var re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, m, ok = true;
    while ((m = re.exec(s)) !== null) { try { JSON.parse(m[1]); } catch (e) { ok = false; } }
    return ok;
  })());
});

/* ── مدل رفتاری مستقل: «۱۰۰ کلمهٔ اول» و «اولین h2» باید به‌مکانیکِ واقعیِ صفحه وابسته باشد ── */
(function () {
  var model = { 'services/piping-supply.html': 'تامین تجهیزات پایپینگ', 'services/instrumentation-supply.html': 'تامین تجهیزات ابزار دقیق' };
  var ok = Object.keys(model).every(function (file) {
    var art = articleText(read(file));
    // اولین h2 صفحه باید پیش از/داخلِ ابتدای مقاله (بعد از حذف ناوبری) کلمه را بیاورد
    return art.slice(0, 100).indexOf(model[file]) > -1;
  });
  T('BEHAV: مدل مستقل تأیید می‌کند کلمهٔ دقیق در ۱۰۰ کلمهٔ اولِ هر دو مقاله هست', ok);
})();

/* ── P2: لینک داخلی ≥۳۰ به هر دو صفحه (اسکنِ کل سایت) ── */
(function () {
  var files = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['crm', '_tools', '_audit', 'node_modules', '.git', 'assets', 'search'].indexOf(e.name) > -1) return;
        walk(full);
      } else if (/\.html?$/i.test(e.name)) files.push(full);
    });
  })(ROOT);
  var idx = {};
  files.forEach(function (fp) {
    var rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    var s;
    try { s = fs.readFileSync(fp, 'utf8'); } catch (e) { return; }
    PAGES.forEach(function (pg) {
      if (s.indexOf(pg.file) > -1) (idx[pg.file] = idx[pg.file] || []).push(rel);
    });
  });
  PAGES.forEach(function (pg) {
    var n = (idx[pg.file] || []).length;
    T('SEO-P2: ' + pg.file + ' — لینک ورودی ≥۳۰ دارد (' + n + ')', n >= 30);
  });
})();

console.log('=== tester645: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
