#!/usr/bin/env node
'use strict';
/* tester540 — v34.10.0 (DEPLOY-SPEEDUP + TRUTHFUL-GREEN برای استیجینگ)
   ریشهٔ تغییر: دیپلوی استیجینگ برای یک تغییر کوچک ۸-۱۲ دقیقه طول می‌کشید و در پایان
   هم «Post-deploy integrity» قرمز می‌شد (false-red؛ کش مسیرمحور هاست).
   قرارداد جدید deploy-staging.yml:
     ۱) SPEEDUP  — آپلود «افزایشی» بر مبنای git-diff نسبت به SHA مارکر ران قبلی
        (__deploy__.txt روی FTP)؛ fallback خودکار full-sync؛ full هفتگی (schedule)
        و ورودی دستی full؛ php پیش‌نصب رانر (apt فقط fallback).
     ۲) GREEN    — گیت صحت دولایه: readback بایت‌به‌بایت از خود FTP (مسدودکننده،
        exit $fail) + مارکر==کامیت؛ تازگی HTTP «هشداری» (۱۲×۳۰s + Cache-Control/
        Pragma no-cache + دوبل cache-buster) که در عقب‌ماندنِ کش فقط ::warning
        می‌دهد — چون دیسک با readback اثبات شده است.
   دو حالت اجرا (مثل tester536): workflow وصل → قرارداد روی خود فایل؛ وگرنه روی
   نتیجهٔ اعمال وصلهٔ معلق (PENDING-workflow-deploy-staging-speedup-*.patch). */
var fs = require('fs'), os = require('os'), path = require('path');
var spawnSync = require('child_process').spawnSync;
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var WF = '.github/workflows/deploy-staging.yml';
var PATCH_GLOB = /^PENDING-workflow-deploy-staging-speedup-.*\.patch$/;
var wired = false;
try { wired = read(WF).indexOf('Compute deploy delta') > -1; } catch (e) { wired = false; }

var results = [];
function C(n, c, d) { results.push({ n: n, c: !!c, d: d }); }

function contract(st) {
  /* ---------- SPEEDUP: دلتا بر مبنای مارکر ---------- */
  C('دلتا: گام Compute deploy delta (id: delta) وجود دارد', /id: delta/.test(st) && st.indexOf('Compute deploy delta') > -1);
  C('دلتا: مارکر __deploy__.txt ران قبلی از FTP خوانده می‌شود (پایهٔ git-diff)', /__deploy__\.txt[^\n]*-o \/tmp\/prev-marker\.txt|prev-marker\.txt/.test(st));
  C('دلتا: SHA پایه با git diff دو-نقطه‌ای به فهرست آپلود می‌رسد', /git diff --name-only --diff-filter=ACMRT "\$PREV_SHA" "\$GITHUB_SHA"/.test(st));
  C('دلتا: مسیر غیر-ASCII → fallback کامل (curl URL-Safe نیست)', /ASCII_RE\|\|"\[\^A-Za-z0-9\._\/-\]"|grep -qE.*ASCII_RE/.test(st.replace(/\n/g, ' ')) && st.indexOf('[^A-Za-z0-9._/-]') > -1);
  C('افزایشی: گام آپلود دلتا (id: inc) با continue-on-error', /id: inc[\s\S]{0,400}continue-on-error: true|continue-on-error: true[\s\S]{0,400}id: inc/.test(st) === false ? /continue-on-error: true/.test(st.slice(st.indexOf('Incremental FTP upload'), st.indexOf('Incremental FTP upload') + 500)) : true);
  C('افزایشی: فایل‌های تولیدی هر ران هم آپلود می‌شوند (بنر/robots/.htaccess/مارکر)', (function () { var seg = st.slice(st.indexOf('Compute deploy delta'), st.indexOf('Deploy via FTP')); return seg.indexOf('crm/*.html') > -1 && seg.indexOf('robots.txt') > -1 && seg.indexOf('crm/.htaccess') > -1 && seg.indexOf('__deploy__.txt') > -1; })());
  C('افزایشی: فهرست exclude هم‌ارز full-sync (بدون _tools/*.md/tester*)', (function () { var seg = st.slice(st.indexOf('Compute deploy delta'), st.indexOf('Incremental FTP upload')); return seg.indexOf('_tools') > -1 && seg.indexOf('\\.md$') > -1 && seg.indexOf('tester[^/]*\\.js$') > -1 && seg.indexOf('docs-deploy') > -1; })());

  /* ---------- fallback کامل ---------- */
  C('fallback: FTP-Deploy-Action فقط در حالت full یا شکست افزایشی اجرا می‌شود', /if: steps\.delta\.outputs\.mode == 'full' \|\| steps\.inc\.outcome == 'failure'/.test(st));
  C('fallback: state-name استیجینگ حفظ شده', /state-name: \.ftp-state-staging-v2\.json/.test(st));
  C('full هفتگی: schedule دارد و در schedule حالت full می‌شود', /cron: '0 4 \* \* 6'/.test(st) && /github\.event_name\}\"]? =? ?"schedule"|"\$\{\{ github\.event_name \}\}" = "schedule"/.test(st.replace(/\n/g, ' ')) || st.indexOf('"${{ github.event_name }}" = "schedule"') > -1);
  C('full دستی: ورودی full در workflow_dispatch', /inputs:/.test(st) && /full:/.test(st) && /description: 'همگام‌سازی کامل \(نه افزایشی\)'/.test(st));

  /* ---------- حذف‌ها ---------- */
  C('حذف: diff-filter=D سمت سرور DELE می‌شود', /--diff-filter=D/.test(st) && /-DELE /.test(st));

  /* ---------- TRUTHFUL-GREEN: گیت دولایه ---------- */
  var post = st.slice(st.indexOf('Post-deploy integrity check'));
  C('لایهٔ ۱: readback فایل‌ها از خود FTP (نه HTTP کش‌شده)', post.indexOf('readback') > -1 && /\$PROTO:\/\/\$HOST\//.test(post) && post.indexOf('curl -sS "${A[@]}" "${AUTH[@]}"') > -1);
  C('لایهٔ ۱: مقایسهٔ sha1 بایت‌به‌بایت', post.indexOf('sha1sum') > -1 && post.indexOf('want=') > -1);
  C('لایهٔ ۱: مارکر سرور == کامیت این ران', /__deploy__\.txt[\s\S]{0,300}sha[\s\S]{0,80}\$\{\{ github\.sha \}\}/.test(post));
  C('لایهٔ ۱: مسدودکننده — exit $fail روی ناهمخوانی دیسک', /exit \$fail/.test(post) && /::error::فایل‌های روی سرور \(FTP readback\)/.test(post));
  C('لایهٔ ۲: تازگی HTTP هشداری است (۱۲ تلاش × ۳۰s)', /for i in 1 2 3 4 5 6 7 8 9 10 11 12; do/.test(post) && /sleep 30/.test(post));
  C('لایهٔ ۲: هدرهای Cache-Control + Pragma no-cache', /-H 'Cache-Control: no-cache'/.test(post) && /-H 'Pragma: no-cache'/.test(post));
  C('لایهٔ ۲: دوبل cache-buster (r=RANDOM)', /r=\$\(\(RANDOM\)\)\$RANDOM/.test(post));
  C('لایهٔ ۲: عقب‌ماندن کش فقط ::warning می‌دهد (نه ::error)', /::warning::کش HTTP استیجینگ/.test(post));
  C('لایهٔ ۲: بعد از readback سبز، خروج موفق است (exit 0)', /exit 0/.test(post));

  /* ---------- سرعت‌های جانبی ---------- */
  C('php: نسخهٔ پیش‌نصب رانر اولویت دارد (apt فقط fallback)', st.indexOf('if ! command -v php >/dev/null 2>&1; then') > -1 && st.indexOf('sudo apt-get install') > -1);
  C('بنر: تزریق فقط به crm/*.html + index.html (نه find کل درخت)', st.indexOf('for f in crm/*.html index.html; do') > -1 && !/find \. -name '\*\.html'/.test(st));
  C('گیت‌های قبل از FTP حفظ‌اند (arch + ci قبل از انتقال)', st.indexOf('arch-guard.js') < st.indexOf('uses: SamKirkland/FTP-Deploy-Action') && st.indexOf('run-ci-gate.js') < st.indexOf('uses: SamKirkland/FTP-Deploy-Action'));
}

if (wired) {
  contract(read(WF));
} else {
  var pending = fs.readdirSync(path.join(ROOT, '_tools')).filter(function (n) { return PATCH_GLOB.test(n); });
  C('وصلهٔ معلقِ DEPLOY-SPEEDUP موجود است (تا اعمال مالک)', pending.length > 0, pending.join(',') || '—');
  var patchRel = pending.length ? '_tools/' + pending.sort().pop() : null;
  if (patchRel) {
    var patchAbs = path.join(ROOT, patchRel);
    C('وصله بدون تداخل اعمال می‌شود (git apply --check)', spawnSync('git', ['apply', '--check', patchAbs], { cwd: ROOT }).status === 0, patchRel);
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-wf540-'));
    var simWfDir = path.join(tmp, '.github', 'workflows');
    fs.mkdirSync(simWfDir, { recursive: true });
    fs.readdirSync(path.join(ROOT, '.github/workflows')).forEach(function (n) {
      fs.writeFileSync(path.join(simWfDir, n), read('.github/workflows/' + n));
    });
    var sim = spawnSync('patch', ['-p1', '--no-backup-if-mismatch', '-d', tmp, '-i', patchAbs], { encoding: 'utf8' });
    if (sim.status === 0) contract(fs.readFileSync(path.join(simWfDir, 'deploy-staging.yml'), 'utf8'));
    else C('شبیه‌سازیِ اعمال وصله (patch -p1)', false, String(sim.stderr || sim.stdout || '').slice(0, 200));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (eRm) {}
  }
}

results.forEach(function (r) { T(r.n, r.c, r.d); });
console.log('\n— tester540 (v34.10.0: DEPLOY-SPEEDUP + TRUTHFUL-GREEN استیجینگ' + (wired ? '' : ' — حالت وصلهٔ معلق') + ') —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
