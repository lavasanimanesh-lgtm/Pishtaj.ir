#!/usr/bin/env node
'use strict';
/* tester536 — v34.8.35 (فاز صفرِ نازک‌سازی: T0-3 / T0-4 / T0-6)
   «گیت‌های CI باید در GitHub Actions اجرا شوند» — نه فقط روی دستگاه ایجنت.

   پیشینه (یافتهٔ F-1 ممیزی ۲۰۲۶-۰۸-۲۸):
     tester431 با عنوان «G2 نگهبان به گیت CI وصل است» فقط بررسی می‌کرد
     run-ci-gate.js به arch-guard.js ارجاع دارد؛ هیچ workflowای را نمی‌سنجید.
     نتیجه: ۱۵۰ تست سبزِ محلی در حالی که deploy-*.yml هیچ تستی اجرا نمی‌کرد
     → هر PR می‌توانست دوباره localStorage.setItem کسب‌وکار اضافه کند.

   دو حالت اجرا:
     الف) workflowها وصل‌اند  → قراردادِ کاملِ T0-3/T0-4/T0-6 روی خودِ فایل‌ها.
     ب) هنوز وصل نیستند      → همان قرارداد روی «نتیجهٔ اعمالِ وصلهٔ معلق»
        شبیه‌سازی می‌شود (در مسیر موقت با patch -p1)؛ یعنی گیت تا روزِ اعمال
        وصله هم دروغ نمی‌گوید: وصله باید موجود، قابل‌اعمال و کافی باشد.
        (چرا وصله؟ تغییر .github/workflows نیازمند دسترسی workflow است که
        اپلیکیشنِ گیت‌هابِ نشست ندارد — رَویهٔ PENDING-*.patch در این مخزن.) */
var fs = require('fs'), os = require('os'), path = require('path');
var spawnSync = require('child_process').spawnSync;
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var WF_STAGING = '.github/workflows/deploy-staging.yml';
var WF_PROD = '.github/workflows/deploy-production.yml';
var WF_LINT = '.github/workflows/php.yml';
var WF_DIR = '.github/workflows';
var PATCH_GLOB = /^PENDING-workflow-t0-gates-.*\.patch$/;

var st = read(WF_STAGING), pr = read(WF_PROD), lint = read(WF_LINT);
var WIRED = st.indexOf('run-ci-gate.js') > -1 && pr.indexOf('run-ci-gate.js') > -1;

/* ================= قرارداد (یک‌بار نوشته، روی هر دو حالت اجرا می‌شود) ================= */
var results = [];
function C(n, c, d) { results.push({ n: n, c: !!c, d: d }); }

function hashFileList(yml) {
  var m = yml.match(/FILES="([^"]+)"/);
  return m ? m[1].split(/\s+/).filter(Boolean) : null;
}

function contract(st, pr, lint, existsFn) {
  /* ---------- T0-3: گیت قبل از FTP ---------- */
  [['استیجینگ', st], ['پروداکشن', pr]].forEach(function (pair) {
    var name = pair[0], yml = pair[1];
    var gateAt = yml.indexOf('run-ci-gate.js');
    var archAt = yml.indexOf('arch-guard.js');
    var ftpAt = yml.indexOf('FTP-Deploy-Action');
    C('T0-3 ' + name + ': گیت CI (run-ci-gate.js) در workflow صدا زده می‌شود', gateAt > -1);
    C('T0-3 ' + name + ': نگهبان معماری (arch-guard.js) در workflow صدا زده می‌شود', archAt > -1);
    C('T0-3 ' + name + ': گیت «قبل از» FTP است — شکست یعنی توقف استقرار',
      gateAt > -1 && ftpAt > -1 && gateAt < ftpAt, 'gate@' + gateAt + ' ftp@' + ftpAt);
    C('T0-3 ' + name + ': نگهبان معماری هم قبل از FTP است', archAt > -1 && ftpAt > -1 && archAt < ftpAt);
    C('T0-3 ' + name + ': نود صریحاً نصب می‌شود (نسخهٔ runner مفروض نیست)',
      /setup-node@v4/.test(yml) && /node-version:\s*'20'/.test(yml));
  });

  /* ---------- T0-4: تایید پس از استقرار ---------- */
  [['استیجینگ', st, 'https://staging.pishtaj.ir'], ['پروداکشن', pr, 'https://pishtaj.ir']].forEach(function (pair) {
    var name = pair[0], yml = pair[1], base = pair[2];
    var post = yml.slice(yml.indexOf('Post-deploy integrity check'));
    C('T0-4 ' + name + ': گام تایید پس از استقرار وجود دارد', yml.indexOf('Post-deploy integrity check') > -1);
    C('T0-4 ' + name + ': آدرس پایه درست است (' + base + ')', post.indexOf('BASE="' + base + '"') > -1);
    C('T0-4 ' + name + ': هش فایل زنده با کامیت مقایسه می‌شود (sha1sum + curl)',
      post.indexOf('sha1sum') > -1 && post.indexOf('curl -fsSL') > -1);
    C('T0-4 ' + name + ': تلاشِ مجدد دارد (دیپلوی/کش ممکن است دیر برسد)',
      /for i in 1 2 3 4 5; do/.test(post) && /sleep 12/.test(post));
    C('T0-4 ' + name + ': شکست واقعاً جاب را خراب می‌کند (exit $fail)', /exit \$fail/.test(post));
    C('T0-4 ' + name + ': نسخهٔ زنده با VERSION.json سنجیده می‌شود (ضد «نسخهٔ مخلوط»)',
      post.indexOf('crm_version') > -1 && post.indexOf('PTF_CRM_RELEASE') > -1);

    var files = hashFileList(yml);
    C('T0-4 ' + name + ': فهرست فایل‌های حساس خالی نیست', files && files.length >= 3, files ? String(files.length) : 'none');
    var missing = (files || []).filter(function (rel) { return !existsFn(rel); });
    C('T0-4 ' + name + ': همهٔ فایل‌های فهرست در مخزن وجود دارند (مسیر اشتباه = گیت بی‌اثر)',
      missing.length === 0, missing.join(','));
  });

  C('T0-4 پروداکشن: index.html در چکِ هش است (بنری تزریق نمی‌شود)',
    (hashFileList(pr) || []).indexOf('crm/index.html') > -1, (hashFileList(pr) || []).join(' '));
  C('T0-4 استیجینگ: index.html در چکِ هش نیست (بنر عمداً تزریق می‌شود)',
    (hashFileList(st) || []).indexOf('crm/index.html') === -1);
  C('T0-4 استیجینگ: با وجود حذف از هش، نسخهٔ زندهٔ index.html چک می‌شود',
    st.slice(st.indexOf('Post-deploy integrity check')).indexOf('crm/index.html') > -1);

  /* ---------- T0-6: کش استیجینگ ---------- */
  C('T0-6 استیجینگ: no-cache برای js/html به crm/.htaccess تزریق می‌شود',
    /Header set Cache-Control "no-cache, must-revalidate"/.test(st) && /FilesMatch "\\.\(\?:js\|html\)\$"/.test(st));
  C('T0-6 تزریقِ کش در فایل کامیت‌شدهٔ crm/.htaccess نیست (نشت به پروداکشن ممنوع)',
    !/no-cache, must-revalidate/.test(read('crm/.htaccess')));
  C('T0-6 تزریق فقط در استیجینگ است، نه در workflow پروداکشن',
    pr.indexOf('no-cache, must-revalidate') === -1);

  /* ---------- گیت روی PR به main ---------- */
  C('PR گیت: php.yml روی pull_request به main فعال است',
    /pull_request:/.test(lint) && /branches:\s*\[\s*"main"\s*\]/.test(lint));
  C('PR گیت: همان گیت کانونی (run-ci-gate.js) روی PR اجرا می‌شود',
    lint.indexOf('node _tools/uat/run-ci-gate.js') > -1);
  C('PR گیت: composer validate بی‌اثر حذف شده (مخزن composer.json ندارد)',
    !/composer validate --strict/.test(lint) && !existsFn('composer.json'));
  C('PR گیت: سینتکس PHP و JS هم lint می‌شود', /php -l/.test(lint) && /node --check/.test(lint));

  /* ---------- ضدِ پس‌رفتگی ---------- */
  C('پادگارد: هر دو workflow استقرار گیت را اجرا می‌کنند',
    st.indexOf('run-ci-gate.js') > -1 && pr.indexOf('run-ci-gate.js') > -1);
}

/* ================= اجرا ================= */
if (WIRED) {
  contract(st, pr, lint, function (rel) { return fs.existsSync(path.join(ROOT, rel)); });
} else {
  /* حالتِ «هنوز وصل نیست»: قرارداد باید روی نتیجهٔ اعمالِ وصله برقرار باشد. */
  var pending = fs.readdirSync(path.join(ROOT, '_tools')).filter(function (n) { return PATCH_GLOB.test(n); });
  C('وصلهٔ معلقِ T0 (PENDING-workflow-t0-gates-*.patch) موجود است', pending.length > 0,
    pending.join(',') || '_tools/ جستجو شد');
  var patchRel = pending.length ? '_tools/' + pending.sort().pop() : null;
  var patchAbs = patchRel ? path.join(ROOT, patchRel) : null;

  if (patchAbs) {
    C('وصله بدون تداخل روی workflowهای فعلی اعمال می‌شود (git apply --check)',
      spawnSync('git', ['apply', '--check', patchAbs], { cwd: ROOT }).status === 0, patchRel);
    C('وصله هر دو workflow استقرار را پوشش می‌دهد',
      read(patchRel).indexOf('deploy-staging.yml') > -1 && read(patchRel).indexOf('deploy-production.yml') > -1);

    /* شبیه‌سازیِ واقعی: اعمال در مسیر موقت، سپس اجرای همان قرارداد روی نتیجه */
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-wf-sim-'));
    var simWfDir = path.join(tmp, '.github', 'workflows');
    fs.mkdirSync(simWfDir, { recursive: true });
    fs.readdirSync(path.join(ROOT, WF_DIR)).forEach(function (n) {
      fs.writeFileSync(path.join(simWfDir, n), read(WF_DIR + '/' + n));
    });
    var sim = spawnSync('patch', ['-p1', '--no-backup-if-mismatch', '-d', tmp, '-i', patchAbs], { encoding: 'utf8' });
    if (sim.status === 0) {
      var simSt = fs.readFileSync(path.join(tmp, '.github/workflows/deploy-staging.yml'), 'utf8');
      var simPr = fs.readFileSync(path.join(tmp, '.github/workflows/deploy-production.yml'), 'utf8');
      var simLint = fs.readFileSync(path.join(tmp, '.github/workflows/php.yml'), 'utf8');
      contract(simSt, simPr, simLint, function (rel) { return fs.existsSync(path.join(ROOT, rel)); });
    } else {
      C('شبیه‌سازیِ اعمالِ وصله (patch -p1)', false, String(sim.stderr || sim.stdout || '').slice(0, 200));
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (eRm) {}
  }
  console.log('⚠️  گیت‌های CI هنوز در workflowها اجرا نمی‌شوند؛ این تستر روی '
    + '«نتیجهٔ اعمالِ ' + (patchRel || 'وصله') + '» قرارداد را سنجید.'
    + ' برای اتصال واقعی: ' + (patchRel ? 'git apply ' + patchRel + ' && git rm ' + patchRel : '—')
    + ' (یا دسترسی workflow را به اپلیکیشن گیت‌هاب بدهید تا مستقیماً push شود).');
}

results.forEach(function (r) { T(r.n, r.c, r.d); });
console.log('\n— tester536 (فاز صفر نازک‌سازی: اتصال واقعی گیت‌ها به CI' + (WIRED ? '' : ' — حالت وصلهٔ معلق') + ') —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
