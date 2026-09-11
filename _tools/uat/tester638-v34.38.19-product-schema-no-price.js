#!/usr/bin/env node
'use strict';
/* tester638 — v34.38.20 (PRODUCT-NO-PRICE-FIX): قفلِ «1 invalid item detected» در بررسیِ ایندکس.
   ریشه: اسکیمای «Product» بدونِ offers(price) یا review/aggregateRating از نظر گوگل invalid است
   («Either offers, review, or aggregateRating should be specified»). صفحاتِ تأمین/RFQ این سایت
   قیمتِ واقعی ندارند، پس تایپ باید «Service» باشد (نه Product) تا خطا از بین برود — جعلِ قیمت
   ممنوع است (ریسکِ اسپمِ دیتای ساختاریافته/پنالتی).
   قراردادها:
     ۱) هیچ صفحهٔ عمومی نباید در سطحِ اولِ @graph یک «Product» بدونِ قیمت داشته باشد؛
     ۲) «Product» فقط وقتی مجاز است که offers.price یا offers.lowPrice داشته باشد؛
     ۳) مولدهای پایتون (seo/wave2/revise) دیگر «Product» نمی‌سازند و تایپ «Service» می‌دهند؛
     ۴) مولد PHP (api/cms.php) تایپ را شرطی می‌سازد: با قیمت Product، بدونِ قیمت Service؛
     ۵) صفحهٔ گزارش‌شدهٔ کارفرما (displacer-level-transmitter) حالا Service/Breadcrumb/FAQ است. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

/* ── ۱) مولدهای پایتون ── */
['_tools/generate_product_pages_seo.py', '_tools/generate_product_pages_wave2.py', '_tools/revise_product_pages_unique.py'].forEach(function (g) {
  var s = fs.readFileSync(path.join(ROOT, g), 'utf8');
  T('GEN: ' + g + ' دیگر Product نمی‌سازد', s.indexOf('"@type":"Product"') === -1);
  T('GEN: ' + g + ' تایپ Service می‌دهد', s.indexOf('"@type":"Service"') > -1);
});

/* ── ۲) مولد PHP ── */
var php = fs.readFileSync(path.join(ROOT, 'api/cms.php'), 'utf8');
T('PHP: تایپ اسکیما شرطی است (با قیمت Product، بدونِ قیمت Service)',
  php.indexOf("($price > 0 ? 'Product' : 'Service')") > -1);

/* ── ۳) رفتاری: اسکنِ همهٔ صفحاتِ عمومی ── */
var SKIP = ['.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
  '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots', 'ptf-all-photos',
  'service-photos', '.github', '.well-known', 'snapshots'];
function skipDir(name) { return SKIP.indexOf(name) > -1 || (name.length && name[0] === '.'); }
function publicHtml(root) {
  var out = [], stack = [''];
  while (stack.length) {
    var d = stack.pop();
    var abs = d === '' ? root : root + '/' + d;
    var ents; try { ents = fs.readdirSync(abs); } catch (e) { continue; }
    ents.forEach(function (e) {
      if (e === '.' || e === '..') return;
      var rel = d === '' ? e : d + '/' + e;
      var fp = abs + '/' + e;
      var st; try { st = fs.statSync(fp); } catch (e2) { return; }
      if (st.isDirectory()) { if (!skipDir(e)) stack.push(rel); return; }
      if (/\.html$/.test(e)) out.push(rel);
    });
  }
  return out.sort();
}
function isProductType(t) {
  if (t === 'Product') return true;
  if (Array.isArray(t) && t.indexOf('Product') > -1) return true;
  return false;
}
function hasPrice(item) {
  if (!item.offers || typeof item.offers !== 'object') return false;
  var o = Array.isArray(item.offers) ? item.offers[0] : item.offers;
  if (!o) return false;
  return o.price !== undefined && o.price !== null && String(o.price) !== ''
    || o.lowPrice !== undefined && o.lowPrice !== null;
}

var violations = [];
var parseErrors = [];
publicHtml(ROOT).forEach(function (rel) {
  var h; try { h = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
  var re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(h)) !== null) {
    var d;
    try { d = JSON.parse(m[1]); } catch (e) { parseErrors.push(rel + ': ' + e.message); continue; }
    (d['@graph'] || []).forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      if (!isProductType(item['@type'])) return;
      if (!hasPrice(item)) violations.push(rel + ' (Product بدون قیمت)');
    });
  }
});

T('BEHAV: هیچ صفحهٔ عمومی Productِ بدونِ قیمت ندارد', violations.length === 0, violations.slice(0, 10).join(' | '));
T('BEHAV: JSON-LD همهٔ صفحات قابل parse است', parseErrors.length === 0, parseErrors.slice(0, 5).join(' | '));

/* ── ۴) صفحهٔ گزارش‌شدهٔ کارفرما ── */
var disp = fs.readFileSync(path.join(ROOT, 'services/products/displacer-level-transmitter.html'), 'utf8');
var dm = disp.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
T('BEHAV: صفحهٔ displacer-level-transmitter تایپ Service دارد (و Product ندارد)', (function () {
  if (!dm) return false;
  var d = JSON.parse(dm[1]);
  var types = (d['@graph'] || []).map(function (x) { return x['@type']; });
  return types.indexOf('Service') > -1 && types.indexOf('Product') === -1;
})());
T('BEHAV: صفحهٔ displacer هنوز BreadcrumbList و FAQPage را دارد', (function () {
  if (!dm) return false;
  var d = JSON.parse(dm[1]);
  var types = (d['@graph'] || []).map(function (x) { return x['@type']; });
  return types.indexOf('BreadcrumbList') > -1 && types.indexOf('FAQPage') > -1;
})());

console.log('=== tester638: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
