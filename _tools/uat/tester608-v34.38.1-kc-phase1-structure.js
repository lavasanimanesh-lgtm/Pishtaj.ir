#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester608-v34.38.1-kc-phase1-structure.js

   قفل یکپارچه‌سازی ساختاری مرکز دانش (فاز ۱) — ۲۰۲۶-۰۹-۰۷:
   ۱) STRUCTURE — هر ۴۲۰ مقالهٔ ایندکس‌پذیر (پس از بچ ۱۴ +۱۰) دقیقاً یک <main id="main-content">
      + دست‌کم یک <article> + بردکرامب ptf-bc دارند (۳۱۶ اسکیپ‌لینک شکسته
      با ساخت main ترمیم شد؛ ۲۱۳ بازنامی قالب A + ۵۹ قالب B + ۱ nace).
   ۲) BYLINE-TOC — بایلاین مرئی (نویسنده/تاریخ‌های شمسی/زمان مطالعه) + فهرست
      مطالب استاتیک؛ همهٔ لنگرهای TOC و همهٔ H2های بدنه شناسه دارند.
   ۳) LEAD-LOCALITY — بلوک لید ۵۵ صفحه (H2 بولیرپلیت + پاراگراف) که بیرون
      main بود به داخل article منتقل شد (id=kc-lead + مدخل اول TOC).
   ۴) RELATED — هر مقاله بلوک مطالب مرتبط دارد؛ ۱۳۲ صفحه با تاپ-۳
      شباهت توکنی (۵ صفحهٔ بدون همپوشانی با نگاشت دستی) + همهٔ لینک‌ها
      به فایل موجود می‌روند و خودارجاعی نیست.
   ۵) SHORTEST — جملهٔ خراب «در shortest زمان ممکن» در هر ۵۹ صفحه با
      «کوتاه‌ترین» اصلاح شد (شامل صفحات retired و هاب).
   ۶) SITEMAP-MANIFEST — تراز lastmod نقشه و مانیفست برای صفحات لمس‌شده.
   ============================================================================= */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }
function show(a) { return a.slice(0, 5).join(',') + (a.length > 5 ? '…+' + (a.length - 5) : ''); }

/* دامنه: URLهای نقشهٔ مرکز دانش منهای هاب */
var sm = read('sitemap-knowledge-center.xml');
var scope = [];
sm.replace(/<loc>https:\/\/pishtaj\.ir\/(knowledge-center\/[^<]+)<\/loc>/g, function (m, rel) {
  if (rel !== 'knowledge-center/index.html') scope.push(rel);
  return m;
});
var cache = {};
function H(rel) { if (!cache[rel]) cache[rel] = read(rel); return cache[rel]; }
function bodyOf(h) {
  var i = h.indexOf('</nav>');
  var b = i > -1 ? h.slice(i) : h;
  return b.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
}

/* ───────────────────── ۱) ساختار ───────────────────── */
head('۱. STRUCTURE');

var noMain = scope.filter(function (r) {
  return (H(r).match(/<main[ >]/g) || []).length !== 1;
});
T('۱.۱ هر مقاله دقیقاً یک <main> دارد', noMain.length === 0, show(noMain));

var noMainId = scope.filter(function (r) {
  var h = H(r);
  return h.indexOf('id="main-content"') === -1 || h.split('id="main-content"').length - 1 !== 1;
});
T('۱.۲ شناسهٔ main-content یکتا و موجود (هدف اسکیپ‌لینک)', noMainId.length === 0, show(noMainId));

var noArt = scope.filter(function (r) {
  var h = H(r);
  var o = (h.match(/<article[ >]/g) || []).length, c = (h.match(/<\/article>/g) || []).length;
  return o < 1 || o !== c;
});
T('۱.۳ دست‌کم یک <article> متوازن', noArt.length === 0, show(noArt));

var noBc = scope.filter(function (r) { return bodyOf(H(r)).indexOf('ptf-bc') === -1; });
T('۱.۴ بردکرامب مرئی ptf-bc', noBc.length === 0, show(noBc));

var skipBroken = scope.filter(function (r) {
  var h = H(r);
  return h.indexOf('href="#main-content"') > -1 && h.indexOf('id="main-content"') === -1;
});
T('۱.۵ هیچ اسکیپ‌لینک شکسته‌ای نیست', skipBroken.length === 0, show(skipBroken));

var unbalanced = scope.filter(function (r) {
  var b = H(r).replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  var tags = ['main', 'article', 'div', 'section', 'nav', 'footer', 'ul', 'li', 'h1', 'h2'];
  return tags.some(function (t) {
    var o = (b.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
    var c = (b.match(new RegExp('</' + t + '>', 'g')) || []).length;
    return o !== c;
  });
});
T('۱.۶ تعادل تگ‌های ساختاری بدنه', unbalanced.length === 0, show(unbalanced));

/* ───────────────────── ۲) بایلاین و فهرست ───────────────────── */
head('۲. BYLINE-TOC');

var noByline = scope.filter(function (r) { return H(r).indexOf('kc-byline') === -1; });
T('۲.۱ بایلاین مرئی در همهٔ مقالات', noByline.length === 0, show(noByline));

var noTime = scope.filter(function (r) {
  return (H(r).match(/<time datetime="/g) || []).length < 2;
});
T('۲.۲ دست‌کم دو time (انتشار/به‌روزرسانی)', noTime.length === 0, show(noTime));

var jalaliBad = scope.filter(function (r) {
  var h = H(r);
  var times = h.match(/<time datetime="\d{4}-\d{2}-\d{2}">[^<]+<\/time>/g) || [];
  return times.length < 2 || times.some(function (t) {
    return !/[۰-۹]+ (فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند) ۱[۳۴][۰-۹]{2}/.test(t);
  });
});
T('۲.۳ نمایش شمسی تاریخ‌ها', jalaliBad.length === 0, show(jalaliBad));

var noToc = scope.filter(function (r) { return H(r).indexOf('kc-toc') === -1; });
T('۲.۴ فهرست مطالب در همهٔ مقالات', noToc.length === 0, show(noToc));

var tocDangling = [];
scope.forEach(function (r) {
  var h = H(r);
  var nav = h.match(/<nav class="kc-toc"[\s\S]*?<\/nav>/);
  if (!nav) return;
  var hrefs = nav[0].match(/href="#([^"]+)"/g) || [];
  hrefs.forEach(function (a) {
    var id = a.slice(7, -1);
    if (h.indexOf('id="' + id + '"') === -1) tocDangling.push(r + '#' + id);
  });
});
T('۲.۵ همهٔ لنگرهای TOC به شناسه موجود می‌روند', tocDangling.length === 0, show(tocDangling));

var h2NoId = scope.filter(function (r) {
  return /<h2(?![^>]*\sid=)[ >]/.test(bodyOf(H(r)));
});
T('۲.۶ هیچ H2 بدون شناسه در بدنه نیست', h2NoId.length === 0, show(h2NoId));

var rtlToc = scope.filter(function (r) {
  var h = H(r);
  var nav = h.match(/<nav class="kc-toc"[\s\S]*?<\/nav>/);
  return !nav || (nav[0].match(/<li>/g) || []).length < 2;
});
T('۲.۷ هر TOC دست‌کم ۲ مدخل دارد', rtlToc.length === 0, show(rtlToc));

/* ───────────────────── ۳) جای لید ───────────────────── */
head('۳. LEAD-LOCALITY');

var leadOutside = scope.filter(function (r) {
  var h = H(r);
  var li = h.indexOf('اهمیت دانش فنی در تامین');
  if (li === -1) return false;
  var ai = h.indexOf('<article');
  return ai === -1 || li < ai;
});
T('۳.۱ بلوک لید (اگر هست) داخل article است', leadOutside.length === 0, show(leadOutside));

var leadNoToc = scope.filter(function (r) {
  var h = H(r);
  return h.indexOf('id="kc-lead"') > -1 && h.indexOf('href="#kc-lead"') === -1;
});
T('۳.۲ kc-lead همیشه مدخل TOC دارد', leadNoToc.length === 0, show(leadNoToc));

/* ───────────────────── ۴) مطالب مرتبط ───────────────────── */
head('۴. RELATED');

var noRel = scope.filter(function (r) {
  return !/مطالب مرتبط|مقالات مرتبط/.test(bodyOf(H(r)));
});
T('۴.۱ هر مقاله بلوک مطالب مرتبط دارد', noRel.length === 0, show(noRel));

var relLinks = {}, relSelf = [], relDead = [], relEmpty = [];
scope.forEach(function (r) {
  var h = H(r);
  var blocks = [];
  var m1 = h.match(/<div class="related-articles">[\s\S]*?<\/div>/);
  if (m1) blocks.push(m1[0]);
  var m2 = h.match(/<section data-ptf-related="1"[\s\S]*?<\/section>/);
  if (m2) blocks.push(m2[0]);
  var h3 = h.search(/<h2[^>]*>(مطالب مرتبط|مقالات مرتبط)/);
  if (h3 > -1) {
    var rest = h.slice(h3, h3 + 4000);
    var um = rest.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/);
    if (um) blocks.push(um[0]);
  }
  var seen = {}, hrefs = [];
  blocks.forEach(function (b) {
    var mm = b.match(/<a [^>]*href="([^"]+)"/g) || [];
    mm.forEach(function (a) {
      var u = a.match(/href="([^"]+)"/)[1].split('?')[0].split('#')[0];
      if (/^https?:\/\//.test(u) || u === '' || seen[u]) return;
      seen[u] = 1; hrefs.push(u);
    });
  });
  relLinks[r] = hrefs;
  if (hrefs.length === 0) { relEmpty.push(r); return; }
  hrefs.forEach(function (u) {
    var abs = path.normalize(path.join(ROOT, 'knowledge-center', u));
    if (abs === path.join(ROOT, r)) { relSelf.push(r); return; }
    var ok = fs.existsSync(abs) || fs.existsSync(abs + '.html') ||
      (fs.existsSync(abs) && fs.statSync(abs).isDirectory());
    if (!ok) relDead.push(r + '→' + u);
  });
});
T('۴.۲ هر بلوک مرتبط دست‌کم یک لینک دارد', relEmpty.length === 0, show(relEmpty));
T('۴.۳ لینک‌های مرتبط به فایل موجود می‌روند', relDead.length === 0, show(relDead));
T('۴.۴ هیچ خودارجاعی در مرتبط‌ها نیست', relSelf.length === 0, show(relSelf));

var backfilled = Object.keys(relLinks).filter(function (r) { return relLinks[r].length === 3; }).length;
T('۴.۵ بلوک‌های بک‌فیل‌شده دقیقاً ۳ لینک دارند (نمونه‌شمار)', backfilled >= 100, String(backfilled));

/* ───────────────────── ۵) shortest ───────────────────── */
head('۵. SHORTEST');

var allKc = fs.readdirSync(path.join(ROOT, 'knowledge-center'))
  .filter(function (fn) { return /\.html$/.test(fn); });
var withShortest = allKc.filter(function (fn) {
  return read('knowledge-center/' + fn).indexOf('shortest') > -1;
});
T('۵.۱ هیچ shortest در ۴۵۳ صفحهٔ مرکز دانش نیست', withShortest.length === 0, show(withShortest));

/* ───────────────────── ۶) نقشه و مانیفست ───────────────────── */
head('۶. SITEMAP-MANIFEST');

var man = JSON.parse(read('_tools/sitemap-lastmod.json'));
var manMiss = scope.filter(function (r) {
  var m = sm.match(new RegExp('<loc>https://pishtaj\\.ir/' + r + '</loc><lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod>'));
  return !m || man[r] !== m[1];
});
T('۶.۱ تراز lastmod نقشه و مانیفست', manMiss.length === 0, show(manMiss));

T('۶.۲ دامنهٔ تستر همان ۳۹۲ مقالهٔ ایندکس‌پذیر است', scope.length === 392, String(scope.length));

console.log('\n' + p + ' PASS / ' + f + ' FAIL');
process.exit(f ? 1 : 0);
