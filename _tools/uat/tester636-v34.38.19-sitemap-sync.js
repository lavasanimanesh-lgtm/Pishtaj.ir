#!/usr/bin/env node
'use strict';
/* tester636 — v34.38.19 (SITEMAP-SYNC): قفلِ «شناسایی → اصلاح نقشه → ثبت» در یک‌کلیک.
   سیستمِ سه‌مرحله‌ای:
     ۱) شناسایی  — sitemap_drift با نگاشتِ کانونیکال (index.html → URL پوشه)؛
     ۲) اصلاح     — sitemap_sync: افزودنِ صفحاتِ ایندکس‌پذیرِ خارج از نقشه + حذفِ
                    «روح» فقط با remove_ghosts=1 (تأیید انسانی) و ثبت در cms_log؛
     ۳) ثبت       — UI پس از اصلاح، cmsSeoSitemapPush() (ثبت در سرچ کنسول) را صدا می‌زند.
   بخش رفتاری: همان منطقِ PHP را در Node بازتولید می‌کند و قفل می‌کند که نقشهٔ فعلیِ
   مخزن «همگام» است (روح=۰، خارج-از-نقشهٔ ایندکس‌پذیر=۰)؛ اگر صفحه‌ای بدونِ نقشه اضافه
   شود یا ورودیِ روحی به نقشه بیاید، گیت CI قرمز می‌شود. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

var php = fs.readFileSync(path.join(ROOT, 'api/cms.php'), 'utf8');
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');

/* ── ۱) سرور: توابعِ نگاشتِ کانونیکال ── */
T('API: cms_page_canonical فایل index.html را به URL پوشه نگاشت می‌کند',
  php.indexOf('function cms_page_canonical($rel)') > -1 &&
  php.indexOf("if ($rel === 'index.html') return 'https://pishtaj.ir/';") > -1 &&
  php.indexOf("substr($rel, 0, -11) . '/'") > -1);
T('API: cms_url_to_file برعکسِ URL را به فایل برمی‌گرداند', php.indexOf('function cms_url_to_file($url)') > -1);
T('API: cms_page_indexable stubهای ریدایرکت/آرشیو و noindex را رد می‌کند',
  php.indexOf('ptf-redirect') > -1 && php.indexOf('http-equiv="refresh"') > -1 && php.indexOf('noindex') > -1);

/* ── ۲) سرور: منبعِ واحدِ محاسبهٔ انحراف ── */
T('API: cms_sitemap_drift_calc منبعِ واحدِ ghost/missing/excluded است',
  php.indexOf('function cms_sitemap_drift_calc($ROOT)') > -1 &&
  php.indexOf("'ghost' => $ghost, 'missing' => $missing, 'excluded' => $excluded") > -1);
T('API: sitemap_drift از محاسبهٔ مشترک استفاده می‌کند (بدون نگاشتِ کهنهٔ is_file/isset ناسازگار)',
  php.indexOf('case \'sitemap_drift\':') > -1 && php.indexOf('cms_sitemap_drift_calc($ROOT)') > -1);

/* ── ۳) سرور: اکشنِ اصلاح با گاردِ حذف ── */
T('API: اکشن sitemap_sync وجود دارد و missing را با sitemap_add اضافه می‌کند',
  php.indexOf("case 'sitemap_sync':") > -1 && php.indexOf('sitemap_add(cms_page_canonical($rel))') > -1);
T('API: حذفِ ghost فقط با remove_ghosts=1 (تأیید انسانی) انجام می‌شود',
  php.indexOf("$removeGhosts = ((int)($_POST['remove_ghosts'] ?? 0)) === 1") > -1 &&
  php.indexOf('if ($removeGhosts)') > -1 && php.indexOf('sitemap_remove($u)') > -1);
T('API: اصلاح در cms_log ثبت و کشِ اسکنِ سئو باطل می‌شود',
  php.indexOf("cms_log('sitemap_sync'") > -1 && php.indexOf("cms-seo-scan.json") > -1);

/* ── ۴) کلاینت: دکمه + زنجیرهٔ اصلاح→ثبت ── */
T('UI: دکمهٔ «همگام‌سازی نقشه … و ثبت در گوگل» در گزارش انحراف است',
  cms.indexOf('cmsSitemapSync(this)') > -1 && cms.indexOf('و ثبت در گوگل') > -1);
T('UI: cmsSitemapSync پس از اصلاح cmsSeoSitemapPush را صدا می‌زند (ثبت در گوگل)',
  cms.indexOf('window.cmsSitemapSync = function') > -1 &&
  cms.indexOf("cmsSeoSitemapPush()") > -1 && cms.indexOf("api('sitemap_sync'") > -1);

/* ═════════ ۵) رفتاری: نقشهٔ فعلی همگام است ═════════ */
var SKIP = ['.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
  '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots', 'ptf-all-photos',
  'service-photos', '.github', '.well-known', 'snapshots'];
function skipDir(name) { return SKIP.indexOf(name) > -1 || (name.length && name[0] === '.'); }
function publicPages(root) {
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
      if (!/\.html$/.test(e)) return;
      if (e === '404.html' || e === 'sitemap.html') return;
      out.push(rel);
    });
  }
  return out.sort();
}
function canonical(rel) {
  if (rel === 'index.html') return 'https://pishtaj.ir/';
  if (/\/index\.html$/.test(rel)) return 'https://pishtaj.ir/' + rel.slice(0, -'index.html'.length);
  return 'https://pishtaj.ir/' + rel;
}
function urlToFile(url) {
  var rel = String(url).replace(/^https?:\/\/(www\.)?pishtaj\.ir\/?/i, '').replace(/^\//, '');
  if (rel === '') return 'index.html';
  if (rel.slice(-1) === '/') return rel + 'index.html';
  return rel;
}
function indexable(rel) {
  var h; try { h = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return false; }
  var hl = h.toLowerCase();
  if (hl.indexOf('ptf-redirect') > -1) return false;
  if (hl.indexOf('http-equiv="refresh"') > -1) return false;
  var m = h.match(/<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*>/i);
  if (m && m[0].toLowerCase().indexOf('noindex') > -1) return false;
  return true;
}
function sitemapUrls(root) {
  var urls = {};
  var idx = path.join(root, 'sitemap-index.xml');
  if (!fs.existsSync(idx)) return urls;
  var c = fs.readFileSync(idx, 'utf8');
  var maps = [];
  var re = /<loc>\s*(.*?)\s*<\/loc>/ig, m;
  while ((m = re.exec(c)) !== null) { if (/\.xml$/i.test(m[1])) maps.push(m[1]); }
  maps.forEach(function (u) {
    var local = u.replace(/^https?:\/\/(www\.)?pishtaj\.ir\//i, '');
    var fp = path.join(root, local);
    if (!fs.existsSync(fp)) return;
    var cc = fs.readFileSync(fp, 'utf8');
    var re2 = /<loc>\s*(.*?)\s*<\/loc>/ig, m2;
    while ((m2 = re2.exec(cc)) !== null) urls[m2[1]] = local;
  });
  return urls;
}
function driftCalc(root) {
  var smap = sitemapUrls(root);
  var files = publicPages(root);
  var ghost = [], missing = [], excluded = [];
  Object.keys(smap).forEach(function (u) {
    if (!fs.existsSync(path.join(root, urlToFile(u)))) ghost.push(u);
  });
  files.forEach(function (rel) {
    var url = canonical(rel);
    if (Object.prototype.hasOwnProperty.call(smap, url)) return;
    if (indexable(rel)) missing.push(rel); else excluded.push(rel);
  });
  return { ghost: ghost, missing: missing, excluded: excluded,
           sitemap_total: Object.keys(smap).length, files_total: files.length };
}

var D = driftCalc(ROOT);
T('BEHAV: نقشهٔ فعلی روح ندارد (URL بدونِ فایل در نقشه نیست)', D.ghost.length === 0,
  'ghost: ' + D.ghost.join(','));
T('BEHAV: هیچ صفحهٔ ایندکس‌پذیری خارج از نقشه نیست (نقشه کامل است)', D.missing.length === 0,
  'missing: ' + D.missing.join(','));
T('BEHAV: صفحاتِ noindex/ریدایرکت درست مستثنا شده‌اند (excluded ≥ 1)', D.excluded.length >= 1,
  'excluded=' + D.excluded.length);
T('BEHAV: حجمِ معقول — نقشه ≥ 600 و فایل ≥ 650', D.sitemap_total >= 600 && D.files_total >= 650,
  'sitemap=' + D.sitemap_total + ' files=' + D.files_total);

console.log('=== tester636: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
