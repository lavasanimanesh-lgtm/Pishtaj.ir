#!/usr/bin/env node
'use strict';
/* =============================================================================
   lib-deploy-gates.js — بررسی «آیا گیت‌های CI واقعاً به workflow وصل‌اند؟»
   =============================================================================
   زمینه (یافتهٔ F-1 گزارش ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md):
   تستر قدیمی tester431 برای ادعای «G2 نگهبان به گیت CI وصل است» فقط ارجاع
   داخلِ run-ci-gate.js را می‌خواند؛ یعنی «گیت، نگهبان را صدا می‌زند» را با
   «گیت‌هاب، گیت را صدا می‌زند» اشتباه می‌گرفت و پاسِ گمراه‌کننده می‌داد.

   این کتابخانهٔ کوچک همان سؤالات را از سورسِ درست می‌پرسد:
     ۱) آیا `.github/workflows/deploy-*.yml` واقعاً `_tools/ci/ci-gate-step.sh` را
        **قبل از** گام FTP و `_tools/ci/post-deploy-hash-check.sh` را **بعد از** آن اجرا می‌کند؟
     ۲) اگر نه، آیا پچ دستیِ `_tools/PENDING-workflow-t0-gates-*.patch` تمیز اعمال می‌شود
        (GitHub App مجوز نوشتن `.github/workflows` ندارد، پس اعمالش با مالک است)؟

   خروجی: { mode: 'wired' | 'pending' | 'broken', … } — تسترها بر همین اساس داوری می‌کنند:
   «wired» ⇒ سخت‌گیری کامل روی ترتیب گام‌ها؛ «pending» ⇒ پچ باید اعمال‌شدنی باشد؛
   «broken» ⇒ هیچ‌کدام ⇒ گیت قرمز.
============================================================================= */
var fs = require('fs'), path = require('path'), cp = require('child_process');

var ROOT = path.resolve(__dirname, '../..');

function readIfExists(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return null; }
}

/* همهٔ پچ‌های T0-candidates، جدیدترین اول. «اعمال‌شدنی بودن» تعیین‌کننده است،
   نه نام فایل — تا چند پچ معلق هم‌زمان گمراه‌کننده نشوند. */
function pendingPatchCandidates() {
  var dir = path.join(ROOT, '_tools'), list = [];
  try {
    list = fs.readdirSync(dir).filter(function (f) { return /^PENDING-workflow-t0-gates.*\.patch$/.test(f); });
  } catch (e) { return []; }
  list.sort().reverse();
  return list.map(function (f) { return path.posix.join('_tools', f); });
}

/* ترتیب گام‌ها در YAML: فقط ایندکس رشتهٔ کلیدی کافی است (ساختار خطیِ این فایل‌ها) */
function stepIndex(txt, needle) {
  if (!txt) return -1;
  var i = txt.indexOf(needle);
  return i < 0 ? -1 : i;
}

function ftpIndex(txt) {
  var i = stepIndex(txt, 'SamKirkland/FTP-Deploy-Action');
  if (i < 0) i = stepIndex(txt, 'name: Deploy via FTP');
  return i;
}

function inspect() {
  var staging = readIfExists('.github/workflows/deploy-staging.yml');
  var prod = readIfExists('.github/workflows/deploy-production.yml');
  var php = readIfExists('.github/workflows/php.yml');
  var candidates = pendingPatchCandidates();
  var res = {
    files: { staging: !!staging, production: !!prod, php: !!php },
    patch: null,
    wired: { stagingGate: false, stagingCheck: false, prodGate: false, prodCheck: false, phpGate: false },
    ordering: {},
    patchApplies: null,
    patchError: ''
  };

  function probe(txt, key) {
    if (!txt) return;
    var g = stepIndex(txt, 'bash _tools/ci/ci-gate-step.sh');
    var c = stepIndex(txt, '_tools/ci/post-deploy-hash-check.sh');
    var ftp = ftpIndex(txt);
    res.wired[key + 'Gate'] = g >= 0;
    if (key === 'php') return;
    res.wired[key + 'Check'] = c >= 0;
    res.ordering[key] = {
      gate: g, check: c, ftp: ftp,
      gateBeforeFtp: g >= 0 && (ftp < 0 || g < ftp),
      checkAfterFtp: c >= 0 && (ftp < 0 || c > ftp)
    };
  }
  probe(staging, 'staging');
  probe(prod, 'prod');
  probe(php, 'php');

  res.candidates = candidates;
  var bothWired = res.wired.stagingGate && res.wired.stagingCheck && res.wired.prodGate && res.wired.prodCheck;
  if (bothWired) { res.mode = 'wired'; return res; }

  var gitDir = path.join(ROOT, '.git');
  if (!candidates.length || !fs.existsSync(gitDir)) {
    res.patch = candidates[0] || null;
    res.mode = candidates.length ? 'pending-unverifiable' : 'broken';
    return res;
  }
  for (var i = 0; i < candidates.length; i++) {
    var r = cp.spawnSync('git', ['-C', ROOT, 'apply', '--check', candidates[i]], { encoding: 'utf8' });
    if (r.status === 0) {
      res.patch = candidates[i];
      res.patchApplies = true;
      res.mode = 'pending';
      return res;
    }
    res.patchError = String(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' | ');
  }
  /* هیچ پچی اعمال نمی‌شود: یا workflow‌ها دستی عوض شده‌اند (پس پچ کهنه است) یا واقعاً گیت نداریم */
  res.patch = candidates[0];
  res.patchApplies = false;
  res.mode = 'broken';
  return res;
}

module.exports = { inspect: inspect, ROOT: ROOT, readIfExists: readIfExists };

/* ---------- اجرای مستقیم: گزارش کوتاه برای آدم ---------- */
if (require.main === module) {
  var s = inspect();
  console.log('حالت گیت‌های استقرار: ' + s.mode + ' (کاندیداها: ' + (s.candidates || []).join(', ') + ')');
  console.log('  workflow‌ها: staging=' + s.files.staging + ' production=' + s.files.production + ' php=' + s.files.php);
  console.log('  گیت قبل از FTP: staging=' + s.wired.stagingGate + ' production=' + s.wired.prodGate);
  console.log('  بررسی صحت بعد از FTP: staging=' + s.wired.stagingCheck + ' production=' + s.wired.prodCheck);
  console.log('  پچ معلق: ' + (s.patch || '(ندارد)') + (s.patchApplies === null ? '' : ' — اعمال‌شدنی=' + s.patchApplies));
  if (s.patchError) console.log('  خطای apply: ' + s.patchError);
  Object.keys(s.ordering).forEach(function (k) {
    var o = s.ordering[k];
    console.log('  ترتیب ' + k + ': gate=' + o.gate + ' ftp=' + o.ftp + ' check=' + o.check +
      ' ⇒ gateBeforeFtp=' + o.gateBeforeFtp + ' checkAfterFtp=' + o.checkAfterFtp);
  });
  process.exit(s.mode === 'broken' ? 1 : 0);
}
