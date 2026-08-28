#!/usr/bin/env node
'use strict';
/* =====================================================================
   PTF CRM — گیت بعد از استقرار (post-deploy hash check) — T0-4
   ---------------------------------------------------------------------
   بعد از هر استقرار (FTP) در GitHub Actions اجرا می‌شود و هش ۵ فایل کلیدی
   زنده را با هش همان فایل‌ها در کامیتِ مستقرشده مقایسه می‌کند. این دقیقاً
   باگ «نسخهٔ مخلوط / دیپلوی ناقص» را می‌گیرد (بعضی فایل‌ها آپلود شده‌اند،
   بعضی نه — مثلاً شواهد استیجینگ ۲۰۲۶-۰۸-۲۷: index.html نو ولی sw.js کهنه).

   فایل‌های استاتیک (js/html): مستقیم از روی وب هش SHA-256 متن خام گرفته
   می‌شود. فایل PHP روی سرور اجرا می‌شود (متن خامش قابل واکشی نیست)، پس
   sales-domain.php یک اکشن عمومی «deploy_probe» دارد که هش فایل زندهٔ خودش
   و نسخه را برمی‌گرداند؛ آن هش با هش مخزن مقایسه می‌شود.

   usage:
     BASE=https://staging.pishtaj.ir node _tools/uat/post-deploy-hash-check.js
     BASE=https://pishtaj.ir            node _tools/uat/post-deploy-hash-check.js

   environment:
     BASE        پایهٔ URL سایتِ مستقرشده (پیش‌فرض: staging.pishtaj.ir)
     TRIES       تعداد تلاش با retry (پیش‌فرض ۱۲)
     WAIT_MS     فاصلهٔ تلاش‌ها به میلی‌ثانیه (پیش‌فرض ۱۰۰۰۰)
     VERBOSE=1   چاپ جزئیات هر تلاش
   ===================================================================== */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var https = require('https');
var http = require('http');

var ROOT = path.resolve(__dirname, '../..');

var BASE = String(process.env.BASE || 'https://staging.pishtaj.ir').replace(/\/+$/, '');
var TRIES = Math.max(1, parseInt(process.env.TRIES || '12', 10));
var WAIT_MS = Math.max(1000, parseInt(process.env.WAIT_MS || '10000', 10));
var VERBOSE = !!process.env.VERBOSE;

/* فایل‌های کلیدی: همان ۵ فایل رودمپ (index.html، sw.js، sales-domain-v2.js،
   leads.js، sales-domain.php). نوع «php» از طریق deploy_probe چک می‌شود. */
var FILES = [
  { rel: 'crm/index.html', urlPath: '/crm/index.html', kind: 'static' },
  { rel: 'crm/sw.js', urlPath: '/crm/sw.js', kind: 'static' },
  { rel: 'crm/sales-domain-v2.js', urlPath: '/crm/sales-domain-v2.js', kind: 'static' },
  { rel: 'crm/leads.js', urlPath: '/crm/leads.js', kind: 'static' },
  { rel: 'api/sales-domain.php', urlPath: '/api/sales-domain.php?action=deploy_probe', kind: 'probe' }
];

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function fetchUrl(url) {
  return new Promise(function (resolve, reject) {
    var lib = url.indexOf('https://') === 0 ? https : http;
    var req = lib.get(url, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'User-Agent': 'ptf-post-deploy-hash-check' },
      timeout: 30000
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function localExpected() {
  var out = {};
  FILES.forEach(function (f) {
    var p = path.join(ROOT, f.rel);
    if (!fs.existsSync(p)) { console.error('::error::فایل محلی موجود نیست: ' + f.rel); process.exit(2); }
    out[f.rel] = sha256(fs.readFileSync(p));
  });
  return out;
}

async function liveActual() {
  var out = {};
  var errors = [];
  for (var i = 0; i < FILES.length; i++) {
    var f = FILES[i];
    var bust = '?ptfcheck=' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    var url = BASE + f.urlPath + (f.urlPath.indexOf('?') > -1 ? '&' : '?') + 'ptfcheck=' + Date.now() + '_' + i;
    void bust;
    try {
      var res = await fetchUrl(url);
      if (res.status !== 200) { errors.push(f.rel + ': HTTP ' + res.status); continue; }
      if (f.kind === 'static') {
        out[f.rel] = sha256(res.body);
      } else {
        var json;
        try { json = JSON.parse(res.body.toString('utf8')); }
        catch (e) { errors.push(f.rel + ': پاسخ JSON نبود (سرور قدیمی؟)'); continue; }
        if (!json || json.ok !== true || !json.selfSha256) {
          errors.push(f.rel + ': deploy_probe پاسخ معتبر نداد (ok=' + (json && json.ok) + ')');
          continue;
        }
        out[f.rel] = String(json.selfSha256).toLowerCase();
      }
    } catch (e) {
      errors.push(f.rel + ': ' + (e && e.message ? e.message : e));
    }
  }
  return { actual: out, errors: errors };
}

async function main() {
  var expected = localExpected();
  console.log('post-deploy hash check — BASE=' + BASE);
  console.log('  فایل‌های کلیدی: ' + FILES.length + ' (۴ استاتیک + ۱ پروب PHP)');
  var attempt = 0;
  for (;;) {
    attempt++;
    var r = await liveActual();
    var mismatches = [];
    FILES.forEach(function (f) {
      var got = r.actual[f.rel];
      if (!got) return;
      if (got !== expected[f.rel]) {
        mismatches.push({ rel: f.rel, want: expected[f.rel].slice(0, 16), got: got.slice(0, 16) });
      }
    });
    var missing = r.errors.slice();
    if (VERBOSE || (mismatches.length === 0 && missing.length === 0) || attempt === TRIES) {
      console.log('── تلاش ' + attempt + '/' + TRIES + ' ──');
      FILES.forEach(function (f) {
        var got = r.actual[f.rel];
        console.log('  ' + (got ? (got === expected[f.rel] ? '✔' : '✘') : '·') + ' ' + f.rel +
          (got ? ' [' + got.slice(0, 12) + (got === expected[f.rel] ? '' : ' ≠ ' + expected[f.rel].slice(0, 12)) + ']' : ' [در دسترس نیست]'));
      });
      r.errors.forEach(function (e) { console.log('  ! ' + e); });
    } else {
      console.log('── تلاش ' + attempt + '/' + TRIES + ': ' + mismatches.length + ' نابرابر، ' + missing.length + ' ناموجود — retry ──');
    }
    if (mismatches.length === 0 && missing.length === 0) {
      console.log('::notice::post-deploy hash check PASS — همهٔ ۵ فایل کلیدی زنده با کامیت مستقرشده یکسان‌اند.');
      process.exit(0);
    }
    if (attempt >= TRIES) break;
    await sleep(WAIT_MS);
  }
  console.error('::error::post-deploy hash check FAIL — نسخهٔ مخلوط/ناقص روی ' + BASE);
  FILES.forEach(function (f) {
    /* گزارش نهایی با هش کامل برای تشخیص */
  });
  process.exit(1);
}

main().catch(function (e) { console.error('::error::' + (e && e.stack ? e.stack : e)); process.exit(2); });
