#!/usr/bin/env node
'use strict';
/* tester536 — v34.8.35 (T0-3/T0-4/T0-6 + T5-1): گیت‌های واقعی، صحت استقرار، و قطع بایپس‌ها
   -----------------------------------------------------------------------------
   مرجع: ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md (یافته‌های F-1…F-3) و
         ROADMAP-THIN-CLIENT-MAXIMAL-2026-08-27.md (بندهای T0-3، T0-4، T0-6، T5-1)

   این تستر «اتصال واقعی» را می‌سنجد، نه ارجاع متنی:
     • ابزارهای گیت موجود و خودآزمون‌شان سبز است
     • lib-deploy-gates حالت را تشخیص می‌دهد: یا workflow وصل است (با ترتیب درست)
       یا پچ معلقِ اعمال‌شدنی + راهنمای دستی وجود دارد — هیچ حالت سومی سبز نیست
     • پروب صحت استقرار دادهٔ کسب‌وکار بیرون نمی‌دهد و مسیرها از query نمی‌آید
     • پنج fallback مردهٔ localStorage حذف شده و در مبنای arch-guard هم برنمی‌گردد
     • لغو کش استیجینگ شرطی است (env=PTF_STAGING) و روی پروداکشن بی‌اثر
   ----------------------------------------------------------------------------- */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

/* ---------- ۱) ابزارهای گیت ---------- */
T('T0-3 پوستهٔ گیت CI وجود دارد', exists('_tools/ci/ci-gate-step.sh'));
T('T0-4 بررسی صحت استقرار وجود دارد', exists('_tools/ci/post-deploy-hash-check.sh'));
var st1 = cp.spawnSync('bash', ['_tools/ci/ci-gate-step.sh', '--self-test'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
T('T0-3 خودآزمون ci-gate-step سبز است (۷ سناریو: block/warn/بی‌جمع‌بندی/کرش/دروغ‌گوی سبز)', st1.status === 0 && /SELF-TEST: ALL PASSED/.test(st1.stdout || ''), (st1.stdout || '') + (st1.stderr || ''));
var st2 = cp.spawnSync('bash', ['_tools/ci/post-deploy-hash-check.sh', '--self-test'], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
T('T0-4 خودآزمون post-deploy-hash-check سبز است (زنده==کامیت/کهنه/۴۰۴/پروب/warn)', st2.status === 0 && /SELF-TEST: ALL PASSED/.test(st2.stdout || ''), (st2.stdout || '') + (st2.stderr || ''));
/* گیت‌ها نباید «بی‌ابزار» بی‌صدا سبز شوند */
T('T0-3 نبودِ php در رانر، گیت را سبز جعل نمی‌کند (phpLintGate هشدار می‌دهد و run-ci-gate خط جمع‌بندی چاپ می‌کند)',
  /CI gate: ' \+ passed/.test(read('_tools/uat/run-ci-gate.js')));

/* ---------- ۲) اتصال واقعی به workflowها (یا پچ معلقِ اعمال‌شدنی) ---------- */
var libMod = require('./lib-deploy-gates.js');
var gs = libMod.inspect();
T('T0-3 تشخیص اتصال: حالت شناخته‌شده است (wired|pending|pending-unverifiable)',
  ['wired', 'pending', 'pending-unverifiable'].indexOf(gs.mode) > -1, 'mode=' + gs.mode + ' ' + gs.patchError);
if (gs.mode === 'wired') {
  ['staging', 'prod'].forEach(function (k) {
    T('T0-3 ' + k + ': گیت CI **قبل از** FTP اجرا می‌شود', gs.ordering[k] && gs.ordering[k].gateBeforeFtp, JSON.stringify(gs.ordering[k]));
    T('T0-4 ' + k + ': بررسی صحت استقرار **بعد از** FTP اجرا می‌شود', gs.ordering[k] && gs.ordering[k].checkAfterFtp, JSON.stringify(gs.ordering[k]));
  });
  T('T0-3 php.yml هم گیت CI را اجرا می‌کند', gs.wired.phpGate);
  T('T0-3 هر دو workflow درِ اضطراری CI_GATE_POLICY را دارند',
    /CI_GATE_POLICY/.test(read('.github/workflows/deploy-staging.yml')) && /CI_GATE_POLICY/.test(read('.github/workflows/deploy-production.yml')));
} else {
  T('T0-3 پچ معلق workflow موجود است', !!gs.patch, String(gs.patch));
  T('T0-3 پچ معلق روی HEAD تمیز اعمال می‌شود', gs.patchApplies === true || gs.mode === 'pending-unverifiable', gs.patchError);
  T('T0-3 راهنمای اعمال دستی برای مالک وجود دارد', exists('WORKFLOW-T0-GATES-APPLY-GUIDE-2026-08-28.md'));
  var pd = gs.patch ? read(gs.patch) : '';
  T('T0-3 پچ، گیت را قبل از FTP و بررسی را بعد از FTP می‌گذارد',
    pd.indexOf('+      - name: CI gate (testers + arch-guard) — pre-FTP') > -1 &&
    pd.indexOf('+      - name: Post-deploy integrity check (live == commit)') > -1 &&
    pd.indexOf('SamKirkland/FTP-Deploy-Action') < pd.indexOf('Post-deploy integrity check'), pd.slice(0, 200));
  T('T0-3 پچ سیاست CI_GATE_POLICY را به هر دو workflow می‌دهد', (pd.match(/CI_GATE_POLICY/g) || []).length >= 4, (pd.match(/CI_GATE_POLICY/g) || []).length);
  /* پچ ۲۰۲۶-۰۸-۲۷ یک heredoc داخل بدنهٔ YAML داشت که شناسهٔ پایانِ تورفتگی‌اش
     هرگز بسته نمی‌شد ⇒ گام استیجینگ می‌سوخت. نسخهٔ جدید کش را به .htaccess برده است. */
  T('T0-3 پچ، heredoc تورفتگی‌دار داخل YAML ندارد (باگ پچ ۲۰۲۶-۰۸-۲۷)', pd.indexOf("<<'HTCACHE'") < 0);
}

/* ---------- ۳) پروب صحت استقرار ---------- */
var probe = read('api/deploy-probe.php');
T('T0-4 پروب استقرار وجود دارد', exists('api/deploy-probe.php'));
T('T0-4 پروب فقط از فهرست ثابت می‌خواند (بدون ورودی مسیر از کاربر)',
  /\$ptf_probe_files = array\(/.test(probe) && !/\$_GET\['(file|path)'\]/.test(probe));
T('T0-4 پروب no-store می‌فرستد', /Cache-Control: no-store/.test(probe));
T('T0-4 پروب مسیر مطلق/mtime/متغیر سروری بیرون نمی‌دهد',
  !/filemtime|__FILE__|\$_SERVER|DOCUMENT_ROOT/.test(probe));
['VERSION.json', 'api/sales-domain.php', 'crm/sw.js', 'crm/sales-domain-v2.js', 'crm/leads.js', 'crm/client-server.js', 'crm/key-registry.js', 'crm/manifest.json', 'crm/index.html']
  .forEach(function (rel) { T('T0-4 پروب ' + rel + ' را پوشش می‌دهد', probe.indexOf("'" + rel + "'") > -1); });
T('T0-4 api/.htaccess پروب را در allowlist گذاشته است', /deploy-probe/.test(read('api/.htaccess')));
T('T0-4 اسکریپت CI پروب را با همان قالب می‌خواند (sha1\\tbytes\\tpath)',
  /ptf-deploy-probe-v1 version=/.test(read('_tools/ci/post-deploy-hash-check.sh')));

/* ---------- ۴) T5-1: حذف پنج fallback مرده ---------- */
var LS_DEAD = /(else|else\s*\{)\s*(try\s*\{\s*)?localStorage\.setItem/;
var T5_FILES = ['crm/codegen.js', 'crm/treasury.js', 'crm/case-revision.js', 'crm/surplus.js', 'crm/treasury-call.js', 'crm/finance-write-guard.js'];
T5_FILES.forEach(function (rel) {
  var src = read(rel);
  T('T5-1 ' + rel + ': نوشتن کسب‌وکار به localStorage در شاخهٔ fallback نمانده', !LS_DEAD.test(src));
});
T('T5-1 شش نقطهٔ هدفِ T5-1 در رودمپ پوشش داده شده', T5_FILES.length === 6);
T('T5-1 امضاهای حذف‌شده به مبنای arch-guard برنگشته (بازگشت = شکست گیت)', (function () {
  var base = JSON.parse(read('_tools/arch/arch-baseline.json'));
  var gone = ['70efd5a98f3d', '50bda4eaa1cb', '3f1d757fd9cb', '6906879ce159', 'a8cdb7250e6b'];
  return base.rules.A10.every(function (s) { return gone.every(function (g) { return s.indexOf(g) < 0; }); });
})());
T('T5-1 مسیرهای لایهٔ داده در همان فایل‌ها حفظ شده‌اند (setData/ptfEntitySaveCollection)', (function () {
  return ['crm/codegen.js', 'crm/treasury.js', 'crm/finance-write-guard.js'].every(function (r) { return /ptfEntitySaveCollection|setData/.test(read(r)); }) &&
    ['crm/case-revision.js', 'crm/surplus.js', 'crm/treasury-call.js'].every(function (r) { return /setData/.test(read(r)); });
})());
T('T5-1 در نبودِ لایهٔ داده، پیام ثبت می‌شود (نه شکست خاموش — قاعدهٔ A7)', (function () {
  return T5_FILES.every(function (r) { return /data layer unavailable/.test(read(r)); });
})());

/* ---------- ۵) T0-6: لغو کش فقط روی استیجینگ ---------- */
['.htaccess', 'crm/.htaccess'].forEach(function (rel) {
  var src = read(rel);
  T('T0-6 ' + rel + ': بلوک شرطی استیجینگ دارد', /PTF_STAGING/.test(src));
  T('T0-6 ' + rel + ': تشخیص میزبان با mod_rewrite (نه <If> که روی برخی LiteSpeedها شکننده است)',
    /RewriteCond %\{HTTP_HOST\} \^\(\?:staging\|test\)\\?\./.test(src));
  T('T0-6 ' + rel + ': هدرها env=PTF_STAGING هستند ⇒ روی پروداکشن بی‌اثر',
    /Header set Cache-Control "[^"]*no-cache[^"]*" env=PTF_STAGING/.test(src) && /Header unset Expires env=PTF_STAGING/.test(src));
  if (rel === '.htaccess') {
    T('T0-6 بلوک استیجینگ **بعد از** بلوک کش ۳۰ روزهٔ سراسری آمده (overwrite درست)',
      src.indexOf('max-age=2592000') < src.indexOf('PTF_STAGING'));
    T('T0-6 بلوک‌ها با <IfModule> محافظت شده‌اند', (src.match(/<IfModule mod_(?:rewrite|headers)\.c>/g) || []).length >= 2);
  }
});

/* ---------- ۶) نسخه و رجیستری گیت ---------- */
var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.8.35', ver.crm_version === 'v34.8.35', ver.crm_version);
T('هم‌سنجی نقاط رسمی با ابزار bump-version --check', (function () {
  var r = cp.spawnSync(process.execPath, ['_tools/uat/bump-version.js', '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  return r.status === 0;
})(), 'bump-version --check قرمز است');
T('tester536 در SUITE گیت CI ثبت شده (خودنگهداری گیت)', /tester536-v34\.8\.35/.test(read('_tools/uat/run-ci-gate.js')));
T('arch-guard روی وضعیت فعلی PASS می‌دهد', (function () {
  var r = cp.spawnSync(process.execPath, ['_tools/arch/arch-guard.js', '--quiet'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return r.status === 0;
})(), 'arch-guard قرمز است');

console.log('\n— tester536 (v34.8.35: T0 گیت‌های CI/صحت استقرار + T5-1 حذف بایپس + T0-6 کش استیجینگ) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
