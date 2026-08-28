#!/usr/bin/env node
'use strict';
/* =============================================================================
   bump-version.js — یکسان‌سازی شمارهٔ نسخه در همهٔ «نقاط رسمی» + مُهر تسترها
   =============================================================================
   چرا: بدهی مزمن این مخزن «drift نسخه‌ای» بوده است (قاعدهٔ A6 در arch-guard،
   سند ARENA-STORAGE-INDEPENDENCE-RCA-2026-08-26.md و بنر تشخیصی استیجینگ v34.8.19
   همگی از همان ریشه‌اند). هر ریلیز دستی یعنی ۷ نقطهٔ رسمی + ~۸۰ تستری که نسخه را
   assert می‌کنند؛ یک جا جا بیفتد یا گیت A6 می‌شکند یا «نسخهٔ مخلوط» روی هاست می‌رود.

   استفاده:
     node _tools/uat/bump-version.js --to v34.8.35 --note "خلاصهٔ ریلیز" [--rebaseline]
     node _tools/uat/bump-version.js --to v34.8.35 --dry      # فقط پیش‌نمایش
     node _tools/uat/bump-version.js --check                  # فقط هم‌سنجی (بدون نوشتن)

   نقاط رسمی (دقیقاً فهرست قاعدهٔ A6 + CACHE/ASSET در sw.js):
     VERSION.json · crm/index.html (اعلان نسخه و همهٔ ?v=) · crm/sw.js ·
     crm/manifest.json · crm/clear-cache.html · crm/shell.js ·
     api/sales-domain.php (SD_SERVICE_VERSION)

   تسترها: فقط خطوطِ assert مُهر می‌شوند؛ خطوط توضیحی (کامنت‌ها و برچسب console.log)
   دست‌نخورده می‌مانند تا تاریخچهٔ «هر تستر در کدام ریلیز متولد شد» گم نشود.
============================================================================= */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');

function arg(name) {
  var i = process.argv.indexOf('--' + name);
  if (i < 0) return null;
  var nxt = process.argv[i + 1];
  return (nxt && nxt.indexOf('--') !== 0) ? nxt : true;
}
var DRY = arg('dry') ? true : false;
var CHECK = arg('check') ? true : false;
var REBASE = arg('rebaseline') ? true : false;
var TO = arg('to');
var NOTE = typeof arg('note') === 'string' ? arg('note') : null;
var FROM = typeof arg('from') === 'string' ? arg('from') : null;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, s) { if (!DRY && !CHECK) fs.writeFileSync(path.join(ROOT, rel), s); }
function norm(v) { return String(v).replace(/^v/, ''); }
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

var changes = [];
function bumpFile(rel, re, fn) {
  var src = read(rel), n = 0;
  var out = src.replace(re, function () {
    var m = fn.apply(null, arguments);
    if (m !== arguments[0]) n++;
    return m;
  });
  if (n) { write(rel, out); changes.push([rel, n]); }
  return n;
}

/* ---------- حالت ۱: فقط بررسی drift ---------- */
if (CHECK) {
  var v = norm(JSON.parse(read('VERSION.json')).crm_version);
  var checks = [
    ['VERSION.json', /"crm_version"\s*:\s*"v[\d.]+"/],
    ['crm/index.html', new RegExp("window\\.PTF_CRM_RELEASE = 'v" + esc(v) + "'")],
    ['crm/sw.js', new RegExp("RELEASE = 'v" + esc(v) + "'")],
    ['crm/sw.js', new RegExp("ASSET_VERSION = '" + esc(v) + "'")],
    ['crm/sw.js', new RegExp("CACHE = 'ptf-crm-v" + esc(v) + "'")],
    ['crm/shell.js', new RegExp("'v" + esc(v) + "'")],
    ['crm/clear-cache.html', new RegExp("window\\.VER = 'v" + esc(v) + "'")],
    ['crm/manifest.json', new RegExp('"version":\\s*"' + esc(v) + '"')],
    ['api/sales-domain.php', new RegExp("SD_SERVICE_VERSION = '" + esc(v) + "'")]
  ];
  var drift = checks.filter(function (c) { return !c[1].test(read(c[0])); }).map(function (c) { return c[0]; });
  var staleIdx = (read('crm/index.html').match(/\?v=(\d+\.\d+\.\d+)/g) || []).filter(function (q) { return q !== '?v=' + v; });
  if (staleIdx.length) drift.push('crm/index.html — ' + staleIdx.length + ' ارجاع ?v= ناهمخوان');
  console.log('بump-version --check · نسخهٔ رسمی: v' + v);
  if (drift.length) { console.log('⛔ drift:\n  ' + drift.join('\n  ')); process.exit(1); }
  console.log('✔ همهٔ نقاط رسمی هم‌نسخه‌اند (v' + v + ')');
  process.exit(0);
}

/* ---------- حالت ۲: bump ---------- */
if (!TO) { console.error('⛔ --to لازم است (مثال: --to v34.8.35) — یا از --check استفاده کنید'); process.exit(2); }
var current = norm(JSON.parse(read('VERSION.json')).crm_version);
var from = norm(FROM || current);
TO = norm(TO);
if (!/^\d+\.\d+\.\d+$/.test(TO)) { console.error('⛔ --to باید x.y.z یا vx.y.z باشد (گرفته شد: ' + TO + ')'); process.exit(2); }
if (TO === from && !FROM) { console.error('⛔ نسخهٔ مقصد با نسخهٔ فعلی یکسان است (v' + from + ')'); process.exit(2); }
if (!FROM && read('crm/index.html').indexOf(from) < 0) {
  console.error('⛔ نسخهٔ مبدأ v' + from + ' در crm/index.html پیدا نشد — index.html از VERSION.json جداست؛ ' +
    'با --check drift را ببینید و در صورت لزوم --from بدهید.');
  process.exit(2);
}

bumpFile('crm/index.html', /window\.PTF_CRM_RELEASE = 'v[\d.]+'(?:; window\.VER = 'v[\d.]+')?/g, function (m) {
  return m.split(from).join(TO);
});
bumpFile('crm/index.html', /\?v=[\d.]+/g, function (m) { return m === '?v=' + from ? '?v=' + TO : m; });
bumpFile('crm/sw.js', /var (?:RELEASE|ASSET_VERSION|CACHE) = '[^'\n]*'/g, function (m) { return m.split(from).join(TO); });
bumpFile('crm/shell.js', /window\.VER \|\| 'v[\d.]+'/g, function (m) { return m.split(from).join(TO); });
bumpFile('crm/clear-cache.html', /(?:window\.VER = 'v[\d.]+'|PTF CRM \(v[\d.]+\))/g, function (m) { return m.split(from).join(TO); });
bumpFile('crm/manifest.json', /"version":\s*"[\d.]+"/g, function (m) { return m.split(from).join(TO); });
bumpFile('api/sales-domain.php', /const SD_SERVICE_VERSION = '[\d.]+';/g, function (m) { return m.split(from).join(TO); });

bumpFile('VERSION.json', /"crm_version"\s*:\s*"v?[\d.]+"/, function (m) { return '"crm_version": "v' + TO + '"'; });
bumpFile('VERSION.json', /"last_updated"\s*:\s*"[^"]*"/, function (m) { return '"last_updated": "' + new Date().toISOString().slice(0, 10) + '"'; });
if (NOTE !== null) {
  var safe = String(NOTE).replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
  bumpFile('VERSION.json', /"updated_by"\s*:\s*"[^"]*"/, function (m) { return '"updated_by": "' + safe + '"'; });
}

/* مُهر تسترها */
(function stampTesters() {
  var dirs = ['_tools/uat', '.'];
  var touched = 0, lines = 0;
  dirs.forEach(function (d) {
    var abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    fs.readdirSync(abs).filter(function (f) { return /^tester.*\.js$/.test(f); }).forEach(function (f) {
      var rel = d + '/' + f;
      var src = read(rel), n = 0;
      /* هر دو شکل ممکن در فایل: لفظی (34.8.34) و داخل regex فرار‌شده (34\.8\.34) */
      var pairs = [[from, TO], [from.split('.').join('\\.'), TO.split('.').join('\\.')]];
      var out = src.split('\n').map(function (ln) {
        var t = ln.trim();
        if (/^(\/\*|\*|\/\/)/.test(t) || ln.indexOf('console.log(') > -1) return ln;
        pairs.forEach(function (pr) {
          if (ln.indexOf(pr[0]) > -1) { ln = ln.split(pr[0]).join(pr[1]); n++; }
        });
        return ln;
      }).join('\n');
      if (n) { write(rel, out); changes.push([rel, n]); touched++; lines += n; }
    });
  });
  changes.push(['(تسترها)', touched + ' فایل / ' + lines + ' خط']);
})();

console.log((DRY ? 'پیش‌نمایش (dry-run)' : 'اعمال شد') + ': v' + from + ' → v' + TO);
changes.forEach(function (c) { console.log('  • ' + c[0] + ' — ' + c[1]); });

if (DRY) process.exit(0);

/* بازبینی پس از نوشتن */
var v2 = norm(JSON.parse(read('VERSION.json')).crm_version);
if (v2 !== TO) { console.error('⛔ VERSION.json هم‌نسخه نشد (' + v2 + ')'); process.exit(1); }
var bad = [];
[
  ['crm/index.html', new RegExp("window\\.PTF_CRM_RELEASE = 'v" + esc(TO) + "'")],
  ['crm/sw.js', new RegExp("ASSET_VERSION = '" + esc(TO) + "'")],
  ['crm/manifest.json', new RegExp('"version":\\s*"' + esc(TO) + '"')],
  ['api/sales-domain.php', new RegExp("SD_SERVICE_VERSION = '" + esc(TO) + "'")]
].forEach(function (p) { if (!p[1].test(read(p[0]))) bad.push(p[0]); });
var staleAfter = (read('crm/index.html').match(/\?v=(\d+\.\d+\.\d+)/g) || []).filter(function (q) { return q !== '?v=' + TO; });
if (staleAfter.length) bad.push('crm/index.html (' + staleAfter.length + ' ارجاع ناهمخوان)');
if (bad.length) { console.error('⛔ ناهمسنجی پس از bump: ' + bad.join(', ')); process.exit(1); }
console.log('  ✔ هم‌سنجی نقاط رسمی تأیید شد');

if (REBASE) {
  var r = cp.spawnSync(process.execPath, [path.join(ROOT, '_tools/arch/arch-guard.js'), '--baseline'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error('⛔ arch-guard --baseline شکست خورد:\n' + (r.stdout || '') + (r.stderr || '')); process.exit(1); }
  console.log('  ✔ مبنا arch-guard بازسازی شد');
} else {
  console.log('  ⓘ اگر arch-guard بدهی را «برطرف‌شده» گزارش کرد: --rebaseline');
}
process.exit(0);
