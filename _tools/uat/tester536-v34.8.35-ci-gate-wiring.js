#!/usr/bin/env node
'use strict';
/* v34.8.35 — T0 (اتصال واقعی گیت‌ها به CI، پس از ممیزی ۲۰۲۶-۰۸-۲۸):
     T0-3  run-ci-gate.js + arch-guard در هر سه مسیر استقرار:
           deploy-staging.yml، deploy-production.yml و php.yml (PR/push main)
     T0-4  post-deploy hash check: ابزار + اتصال به هر دو workflow بعد از FTP
           + اکشن عمومی deploy_probe در sales-domain.php (هش فایل زندهٔ PHP)
     T0-6  هدر no-cache برای js/html فقط روی استیجینگ (تزریق در workflow)
   تغییرات workflow چون App مجوز workflows را ندارد در پچ معلق تحویل می‌شود؛
   متن «اعمال‌شده یا پچ معلق» سنجیده می‌شود.
   مرجع: ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md (یافته‌های F-1 و بندهای باقی‌مانده) */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

/* GitHub App ایجنت مجوز نوشتن پوشهٔ .github/workflows را ندارد؛ تغییرات workflow به‌صورت
   پچ معلق `_tools/PENDING-workflow-t0346-ci-gates-2026-08-28.patch` تحویل می‌شود تا مالک
   دستی اعمال کند (قرارداد APPLY-WORKFLOW-PATCHES-GUIDE-FA). هر ادعای زیر باید یا در فایل
   اعمال‌شدهٔ workflow یا در همان پچ معلق درست باشد؛ متن نهایی فایل = متن پچ. */
var PENDING = '_tools/PENDING-workflow-t0346-ci-gates-2026-08-28.patch';
var patch = '';
try { patch = read(PENDING); } catch (eNoPatch) { patch = ''; }
var wfStaging = read('.github/workflows/deploy-staging.yml');
var wfProd = read('.github/workflows/deploy-production.yml');
var wfCi = read('.github/workflows/php.yml');
T('T0-3 پچ معلق workflow موجود است (مجوز App برای نوشتن workflow محدود است)',
  patch.length > 0 && exists(PENDING));
/* متن کامل هر workflow جدید داخل پچ است (بلوک +++ b/...). برای سنجش، «مؤثر» = متن
   اعمال‌شده یا متن داخل پچ. خطوط پچ با '+' یعنی فایل نهایی؛ خط '-' (حذف‌شده) نباید
   سنجیده شود، وگرنه مثلاً composerِ حذف‌شده هنوز «موجود» به نظر می‌رسد. */
var patchBlock = function (wfName) {
  var marker = 'diff --git a/.github/workflows/' + wfName;
  var i = patch.indexOf(marker);
  if (i < 0) return '';
  var rest = patch.slice(i);
  var next = rest.indexOf('diff --git', marker.length);
  var block = next < 0 ? rest : rest.slice(0, next);
  /* فقط خطوط جدید (+) و هانک‌هدر/زمینه — خطوط حذف (-) و ایمیل diff را دور بریز */
  return block.split('\n').filter(function (l) {
    return l.indexOf('---') !== 0 && l.indexOf('-') !== 0;
  }).map(function (l) {
    return l.indexOf('+') === 0 ? l.slice(1) : l;
  }).join('\n');
};
var eff = function (wfName) {
  var inRepo = { 'deploy-staging.yml': wfStaging, 'deploy-production.yml': wfProd, 'php.yml': wfCi }[wfName];
  if (/run-ci-gate\.js/.test(inRepo)) return inRepo; /* اعمال‌شده */
  var fromPatch = patchBlock(wfName);
  return fromPatch || inRepo;
};
var effStaging = eff('deploy-staging.yml');
var effProd = eff('deploy-production.yml');
var effCi = eff('php.yml');

/* ── T0-3: اتصال گیت به workflowها ─────────────────────────────────────── */
T('T0-3 ابزار گیت موجود است', exists('_tools/uat/run-ci-gate.js') && exists('_tools/arch/arch-guard.js'));
T('T0-3 استیجینگ: رانر گیت قبل از FTP اجرا می‌شود',
  /node\s+_tools\/uat\/run-ci-gate\.js[\s\S]{0,2500}Deploy via FTP/.test(effStaging));
T('T0-3 پروداکشن: رانر گیت قبل از FTP اجرا می‌شود',
  /node\s+_tools\/uat\/run-ci-gate\.js[\s\S]{0,2500}Deploy via FTP/.test(effProd));
/* تریگرهای on: push/pull_request در فایل اصلی موجودند و پچ فقط بدنهٔ job را عوض
   می‌کند؛ پس تریگر از فایل اعمال‌شده + اجرای گیت از متن نهایی (پس از پچ) سنجیده می‌شود. */
var ciTriggers = wfCi; /* فایل اصلیِ اعمال‌شده (تریگرها دست‌نخورده) */
var ciBody = effCi;    /* متن نهاییِ مؤثر (پس از پچ) */
T('T0-3 php.yml (گیت PR/push) روی pull_request به main تریگر دارد',
  /pull_request:[\s\S]*?branches:\s*\[\s*"main"\s*\]/.test(ciTriggers) && /node\s+_tools\/uat\/run-ci-gate\.js/.test(ciBody));
T('T0-3 php.yml روی push به main هم اجرا می‌شود',
  /on:[\s\S]*?push:[\s\S]*?branches:\s*\[\s*"main"\s*\]/.test(ciTriggers));
T('T0-3 php.yml دیگر composer validate بی‌اثر نیست (پروژه composer.json ندارد)',
  !/composer validate/.test(ciBody) && /find api crm -name/.test(ciBody));

/* ── T0-4: post-deploy hash check ──────────────────────────────────────── */
T('T0-4 ابزار post-deploy-hash-check موجود و معتبر است',
  exists('_tools/uat/post-deploy-hash-check.js') &&
  cp.spawnSync(process.execPath, ['--check', path.join(ROOT, '_tools/uat/post-deploy-hash-check.js')]).status === 0);
var hashTool = read('_tools/uat/post-deploy-hash-check.js');
T('T0-4 ابزار هر ۵ فایل کلیدی را می‌سنجد (index.html/sw.js/sales-domain-v2.js/leads.js/sales-domain.php)',
  ['crm/index.html', 'crm/sw.js', 'crm/sales-domain-v2.js', 'crm/leads.js', 'api/sales-domain.php']
    .every(function (rel) { return hashTool.indexOf(rel) > -1; }));
T('T0-4 ابزار هش SHA-256 می‌گیرد و exit code غیرصفر برمی‌گرداند',
  /sha256/.test(hashTool) && /process\.exit\(1\)/.test(hashTool));
T('T0-4 استیجینگ: گیت بعد از FTP اجرا می‌شود (BASE=staging)',
  /post-deploy-hash-check[\s\S]{0,800}staging\.pishtaj\.ir/.test(effStaging) ||
  /staging\.pishtaj\.ir[\s\S]{0,400}post-deploy-hash-check/.test(effStaging));
T('T0-4 پروداکشن: گیت بعد از FTP اجرا می‌شود (BASE=prod) و قبل از تگ نسخه است',
  /post-deploy-hash-check[\s\S]{0,2000}Create version tag/.test(effProd));

var sd = read('api/sales-domain.php');
var iProbe = sd.indexOf("'deploy_probe'");
var iAuth = sd.indexOf('$identity = auth_verify_token');
T('T0-4 اکشن عمومی deploy_probe قبل از گارد احراز هویت تعریف شده',
  iProbe > 0 && iAuth > 0 && iProbe < iAuth, 'probe@' + iProbe + ' auth@' + iAuth);
T('T0-4 deploy_probe خودِ هش فایل زنده را برمی‌گرداند',
  /action['"]?\s*=>?\s*['"]?deploy_probe|=== 'deploy_probe'/.test(sd) &&
  /hash_file\(\s*['"]sha256['"]\s*,\s*__FILE__\s*\)/.test(sd));
T('T0-4 پروب نسخهٔ سرویس را هم برمی‌گرداند (هم‌پاسخ با SD_SERVICE_VERSION)',
  /'version'\s*=>\s*SD_SERVICE_VERSION/.test(sd));

/* ── T0-6: no-cache فقط استیجینگ ──────────────────────────────────────── */
T('T0-6 بلوک no-cache برای js/html در workflow استیجینگ تزریق می‌شود (اعمال‌شده یا پچ معلق)',
  /no-store,\s*no-cache,\s*must-revalidate/.test(effStaging) &&
  /FilesMatch/.test(effStaging) && /\(js\|html\)/.test(effStaging));
/* پروداکشن اعمال‌شده نباید no-cache استیجینگی داشته باشد، و پچ معلق هم آن را فقط
   داخل بلوک استیجینگ نگه می‌دارد (نه در دیف پروداکشن) */
var prodPatchBlock = patchBlock('deploy-production.yml');
T('T0-6 پروداکشن هیچ بلوک no-cache استیجینگی تزریق نمی‌کند',
  !/no-store,\s*no-cache/.test(wfProd) && !/no-store,\s*no-cache/.test(prodPatchBlock));

/* ── هم‌نسخگی ─────────────────────────────────────────────────────────── */
T('نسخه در VERSION.json برابر v34.8.35 است', JSON.parse(read('VERSION.json')).crm_version === 'v34.8.35');

console.log('\n— tester536 (T0: اتصال گیت CI + post-deploy hash + no-cache استیجینگ) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
