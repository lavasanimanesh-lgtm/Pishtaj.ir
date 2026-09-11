#!/usr/bin/env node
'use strict';
/* tester637 — v34.38.20 (INDEX-TRACKER): قفلِ ردیابِ ایندکسِ افزایشی.
   قراردادها:
     ۱) همهٔ صفحاتِ عمومیِ ایندکس‌پذیر یک‌بار فهرست می‌شوند (نه فقط نقشه)؛
     ۲) بررسی فقط با URL Inspection API و «ایندکس‌شده» فقط وقتی coverageState با «Indexed»
        شروع شود (PASS به‌تنهایی کافی نیست — محافظه‌کارانه تا گوگل صریح نگوید)؛
     ۳) وضعیت در crm/data/gsc-index-tracker.json ماندگار است؛
     ۴) در هر اجرا فقط ایندکس‌نشده‌ها + جدید دوباره بررسی می‌شوند و ایندکس‌شده‌ها
        از صف کنار گذاشته می‌شوند (تا وقتی همه ایندکس شوند)؛
     ۵) سقفِ هر دسته ۱۰۰ و خطای تک‌صفحه (silent) کل دسته را نمی‌کُشد؛
     ۶) UI دکمه‌های «بررسی دستهٔ بعد / اجرا تا اتمام / شروع مجدد» دارد و در رندر،
        بدون مصرفِ سهمیه فقط گزارش می‌گیرد (batch=0). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

var php = fs.readFileSync(path.join(ROOT, 'api/gsc.php'), 'utf8');
var gsc = fs.readFileSync(path.join(ROOT, 'crm/gsc.js'), 'utf8');

/* ── ۱) سرور: اکشن و حالتِ ماندگار ── */
T('API: اکشن index_tracker وجود دارد', php.indexOf("case 'index_tracker':") > -1);
T('API: ردیاب ماندگار است (gsc-index-tracker.json + load/save)',
  php.indexOf("gsc-index-tracker.json") > -1 && php.indexOf('function gsc_tracker_load') > -1 && php.indexOf('function gsc_tracker_save') > -1);
T('API: سقفِ هر دسته ۱۰۰ است (batch = min(100, ...))', php.indexOf('min(100, max(0, (int)($_REQUEST[\'batch\'] ?? 20)))') > -1);
T('API: reset=1 ردیاب را از نو می‌سازد', php.indexOf("$reset = !empty($_REQUEST['reset'])") > -1 && php.indexOf("if ($reset) $tracker = array('byUrl' => array(), 'meta' => array())") > -1);

/* ── ۲) سرور: تعیینِ «ایندکس‌شده» — محافظه‌کارانه ── */
T('API: ایندکس‌شده فقط وقتی coverageState با «Indexed» شروع شود', php.indexOf('function gsc_idx_indexed($idx)') > -1 && php.indexOf("strpos($cov, 'Indexed') === 0") > -1);
T('API: بررسی با URL Inspection API (v1/urlInspection/index:inspect)', php.indexOf('v1/urlInspection/index:inspect') > -1);
T('API: بررسیِ تک‌صفحه silent است (خطای یک صفحه کل دسته را نمی‌کُشد)', php.indexOf("'POST', true)") > -1 && php.indexOf("isset($r['__error'])") > -1 && php.indexOf("'state' => 'error'") > -1);

/* ── ۳) سرور: منطقِ افزایشی — ایندکس‌شده‌ها کنار گذاشته می‌شوند ── */
T('API: صف فقط از غیرِ indexed ساخته می‌شود (ایندکس‌شده skip)',
  php.indexOf("if (($st['state'] ?? '') === 'indexed') continue;") > -1);
T('API: صفحاتِ جدید هنگامِ اجرا ثبت و صفحاتِ حذف‌شده از ردیاب کنار گذاشته می‌شوند',
  php.indexOf("'state' => 'new'") > -1 && php.indexOf("unset($tracker['byUrl'][$u])") > -1);
T('API: فهرستِ صفحات از فایل‌های واقعیِ ایندکس‌پذیر است (نه فقط نقشه)', php.indexOf('function gsc_public_indexable($ROOT)') > -1 && php.indexOf("'noindex'") > -1 && php.indexOf('ptf-redirect') > -1);

/* ── ۴) کلاینت: کارت + دکمه‌ها + گزارش بدونِ سهمیه ── */
T('UI: کارتِ «ردیاب ایندکس (افزایشی)» در پنل GSC است', gsc.indexOf('ردیابِ ایندکس (افزایشی)') > -1);
T('UI: دکمه‌های بررسی دسته / اجرا تا اتمام / شروع مجدد هستند',
  gsc.indexOf('gscIndexTrackerLoad(25)') > -1 && gsc.indexOf('gscIndexTrackerRunAll()') > -1 && gsc.indexOf('gscIndexTrackerReset()') > -1);
T('UI: در رندر فقط گزارش می‌گیرد (batch=0 — بدون مصرف سهمیه)', gsc.indexOf('gscIndexTrackerLoad(0)') > -1);
T('UI: «اجرا تا اتمام» دسته‌به‌دسته ادامه می‌دهد تا صف خالی/سقف', gsc.indexOf('gscIndexTrackerRunAll') > -1 && gsc.indexOf('d.remaining > 0') > -1 && gsc.indexOf('setTimeout(step, 1200)') > -1);

/* ═════════ ۵) رفتاری: منطقِ صف و دنیای فعلیِ صفحات ═════════ */
var SKIP = ['.git', 'node_modules', 'crm', 'api', '_tools', '_audit', '_human_test',
  '_personas', 'docs-deploy', 'docs', 'assets', 'ptf-snapshots', 'ptf-all-photos',
  'service-photos', '.github', '.well-known', 'snapshots'];
function skipDir(name) { return SKIP.indexOf(name) > -1 || (name.length && name[0] === '.'); }
function canonical(rel) {
  if (rel === 'index.html') return 'https://pishtaj.ir/';
  if (/\/index\.html$/.test(rel)) return 'https://pishtaj.ir/' + rel.slice(0, -'index.html'.length);
  return 'https://pishtaj.ir/' + rel;
}
function indexableFile(rel) {
  var h; try { h = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return false; }
  var hl = h.toLowerCase();
  if (hl.indexOf('ptf-redirect') > -1) return false;
  if (hl.indexOf('http-equiv="refresh"') > -1) return false;
  var m = h.match(/<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*>/i);
  if (m && m[0].toLowerCase().indexOf('noindex') > -1) return false;
  return true;
}
function publicIndexable(root) {
  var out = {}, stack = [''];
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
      if (!indexableFile(rel)) return;
      out[canonical(rel)] = rel;
    });
  }
  return out;
}
/* شبیه‌سازیِ صف: فقط غیرِ indexed */
function buildQueue(byUrl) {
  var q = [];
  Object.keys(byUrl).forEach(function (u) {
    if ((byUrl[u].state || '') === 'indexed') return;   // ← ایندکس‌شده کنار گذاشته می‌شود
    q.push(u);
  });
  return q;
}
T('BEHAV: صف فقط شاملِ ایندکس‌نشده + جدید است (ایندکس‌شده حذف می‌شود)', (function () {
  var byUrl = {
    'https://pishtaj.ir/a/': { state: 'indexed' },
    'https://pishtaj.ir/b.html': { state: 'pending' },
    'https://pishtaj.ir/c.html': { state: 'new' }
  };
  var q = buildQueue(byUrl);
  return q.length === 2 && q.indexOf('https://pishtaj.ir/a/') === -1;
})());
T('BEHAV: پس از ایندکس‌شدن، از صفِ بعدی حذف می‌شود (تا وقتی همه ایندکس شوند)', (function () {
  var byUrl = { 'https://pishtaj.ir/a/': { state: 'pending' } };
  if (buildQueue(byUrl).length !== 1) return false;
  byUrl['https://pishtaj.ir/a/'] = { state: 'indexed' }; /* گوگل این بار Indexed گفت */
  return buildQueue(byUrl).length === 0;
})());

var U = publicIndexable(ROOT);
T('BEHAV: دنیای صفحاتِ ایندکس‌پذیر معقول است (≥ 600 و < 2000)', Object.keys(U).length >= 600 && Object.keys(U).length < 2000,
  'count=' + Object.keys(U).length);
T('BEHAV: صفحهٔ ایندکس‌پذیرِ نمونه در دنیا هست (about/)', Object.prototype.hasOwnProperty.call(U, 'https://pishtaj.ir/about/'));
T('BEHAV: صفحهٔ noindex (search/) در دنیا نیست', !Object.prototype.hasOwnProperty.call(U, 'https://pishtaj.ir/search/'));

console.log('=== tester637: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
