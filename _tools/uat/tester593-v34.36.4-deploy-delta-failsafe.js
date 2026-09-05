#!/usr/bin/env node
'use strict';
/* =====================================================================
   tester593 — v34.37.5 · DELTA-FAILSAFE (مسیرِ استقرارِ افزایشیِ استیجینگ)

   چرا این تستر وجود دارد:
   وصلهٔ معوقِ v34.8.40 (DEPLOY-SPEEDUP) در v34.37.5 اعمال شد و **اولین اجرای
   واقعی‌اش** یک باگِ زمانِ اجرا را لو داد که هیچ پینِ ایستایی نمی‌گرفت:

       echo "… حذف: $(([ -f /tmp/delete.txt ] && wc -l < /tmp/delete.txt || echo 0)) فایل"
                     ^^ «ارزیابیِ حسابی» به‌جای «جانشینیِ فرمان»

   زیرِ `set -euo pipefail` همان خط گام را کشت (run 33914510099). چون `mode=incremental`
   پیش‌تر در GITHUB_OUTPUT نوشته شده بود، گامِ آپلودِ افزایشی skip شد (شرطِ success())
   و همگام‌سازیِ کامل هم اجرا نشد (شرطش `mode == 'full'` بود) ⇒ **هیچ فایلی دیپلوی
   نشد** و ران قرمز ماند. `bash -n` هم این را نمی‌گیرد: syntactically معتبر است و
   فقط هنگامِ «ارزیابی» منفجر می‌شود.

   پس این تستر بلوکِ واقعیِ `run:` گامِ «Compute deploy delta» را از دلِ YAML بیرون
   می‌کشد و در یک **ریپوی gitِ ایزولهٔ موقت** با `curl` ساختگی (بدونِ شبکه و بدونِ
   FTP واقعی) اجرا می‌کند؛ سناریوها:

     A مارکرِ معتبر (SHA نیاک)      → incremental + فهرستِ درستِ آپلود/حذف + excludeها
     B مارکر با SHA ناشناخته        → full (بدونِ دسترسی به remote، فوری)
     C مارکر نیست                   → full
     D FTP در دسترس نیست            → proto=none + ::error + exit 1 (و پینِ continue-on-error)
     E رویدادِ schedule             → full حتی با مارکرِ معتبر (دریفت‌گیریِ هفتگی)
     F ورودیِ دستیِ full=true       → full
     H مسیرِ غیرِ ASCII در دلتا     → full (curl URL-Safe نیست)

   قراردادِ موردِ انتظار: دلتا فقط یک «بهینه‌سازی» است — هر شکست/ابهام در آن باید به
   همگام‌سازیِ کاملِ اثبات‌شده برگردد، و هرگز نباید «هیچ دیپلویی» رخ دهد.
   ===================================================================== */
var fs = require('fs'), os = require('os'), path = require('path');
var spawnSync = require('child_process').spawnSync;
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var WF = '.github/workflows/deploy-staging.yml';
var st = read(WF);
var STEP = 'Compute deploy delta';

/* ───────────────── استخراج بلوکِ run از YAML ───────────────── */
function extractRun(yml, stepName) {
  var lines = yml.split('\n');
  var i = -1;
  for (var k = 0; k < lines.length; k++) if (lines[k].indexOf('- name: ' + stepName) > -1) { i = k; break; }
  if (i < 0) throw new Error('گام پیدا نشد: ' + stepName);
  var j = i;
  while (j < lines.length && !/^\s*run:\s*\|/.test(lines[j])) j++;
  var body = [];
  for (var m = j + 1; m < lines.length; m++) {
    var l = lines[m];
    if (l.trim() === '') { body.push(''); continue; }
    if (!/^ {10}/.test(l)) break;
    body.push(l.slice(10));
  }
  return body.join('\n');
}

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-t593-'));
var BIN = path.join(TMP, 'bin');
fs.mkdirSync(BIN, { recursive: true });

/* curl ساختگی: فقط دو کارِ این گام را شبیه‌سازی می‌کند —
   ۱) `--list-only` برای کشفِ پروتکل (ftps/ftp)  ۲) خواندنِ مارکرِ __deploy__.txt */
fs.writeFileSync(path.join(BIN, 'curl'), [
  '#!/usr/bin/env bash',
  'out=""; url=""; listonly=0',
  'while [[ $# -gt 0 ]]; do',
  '  case "$1" in',
  '    -o) out="$2"; shift 2;;',
  '    --list-only) listonly=1; shift;;',
  '    -u|--connect-timeout|--max-time|-w|-H) shift 2;;',
  '    -*) shift;;',
  '    *) url="$1"; shift;;',
  '  esac',
  'done',
  '[[ -n "${SHIM_CALLS:-}" ]] && printf "%s\\n" "$url" >> "$SHIM_CALLS"',
  'if [[ "${SHIM_FTP_DOWN:-1}" != "1" ]]; then',
  '  [[ "$listonly" == "1" ]] && exit 7',
  'fi',
  'if [[ "$listonly" == "1" ]]; then exit 0; fi',
  'case "$url" in',
  '  *__deploy__.txt)',
  '    if [[ "${SHIM_MARKER:-}" == "none" ]]; then exit 22; fi',
  '    printf \'{"sha":"%s","ref":"arena/uat","mode":"full"}\' "${SHIM_MARKER:-x}" > "${out:-/dev/stdout}"',
  '    exit 0;;',
  'esac',
  'exit 0',
  ''
].join('\n'));
fs.chmodSync(path.join(BIN, 'curl'), 0o755);

function git(args, cwd) {
  var r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' → ' + String(r.stderr || r.stdout));
  return String(r.stdout || '').trim();
}

/* ریپوی ایزولهٔ آزمون: دو کامیت با دلتای معلوم (تغییر/افزودن/حذف + مسیرهای exclude‌شده) */
function makeRepo(dir, opts) {
  var o = opts || {};
  fs.mkdirSync(path.join(dir, 'crm'), { recursive: true });
  fs.mkdirSync(path.join(dir, '_tools', 'uat'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  git(['init', '-q', dir], TMP);
  git(['config', 'user.email', 'uat@pishtaj.test'], dir);
  git(['config', 'user.name', 'UAT'], dir);
  git(['config', 'core.quotepath', 'false'], dir);
  var base = ['crm/shell.html', 'crm/.htaccess', 'index.html', 'robots.txt', '__deploy__.txt', 'crm/sw.js'];
  if (!o.noAlways) base.forEach(function (rel) { fs.writeFileSync(path.join(dir, rel), 'v1 ' + rel + '\n'); });
  if (o.noAlways) fs.writeFileSync(path.join(dir, 'crm/sw.js'), 'v1\n');
  fs.writeFileSync(path.join(dir, '_tools/uat/tester1000-x.js'), '// v1\n');
  fs.writeFileSync(path.join(dir, '.github/workflows/deploy-staging.yml'), 'name: v1\n');
  fs.writeFileSync(path.join(dir, 'notes.md'), '# v1\n');
  fs.writeFileSync(path.join(dir, 'gone.txt'), 'will be deleted\n');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'c1'], dir);
  var sha1 = git(['rev-parse', 'HEAD'], dir);
  /* کامیتِ دوم: دلتای معلوم */
  fs.writeFileSync(path.join(dir, 'crm/sw.js'), 'v2 changed\n');
  fs.writeFileSync(path.join(dir, '_tools/uat/tester1001-y.js'), '// v2\n');
  fs.writeFileSync(path.join(dir, 'notes.md'), '# v2\n');
  fs.writeFileSync(path.join(dir, '.github/workflows/deploy-staging.yml'), 'name: v2\n');
  if (o.nonAscii) fs.writeFileSync(path.join(dir, 'crm', 'گزارش-تست.js'), '// v2\n');
  fs.unlinkSync(path.join(dir, 'gone.txt'));
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'c2'], dir);
  var sha2 = git(['rev-parse', 'HEAD'], dir);
  return { sha1: sha1, sha2: sha2 };
}

var SRC = extractRun(st, STEP);
T('استخراج: بلوکِ گامِ «Compute deploy delta» از YAML گرفته شد', SRC.length > 400, String(SRC.length));
var scriptPath = path.join(TMP, 'delta.sh');

function runDelta(repo, opts) {
  var o = opts || {};
  var sub = {};
  sub['${{ secrets.FTP_SERVER }}'] = 'ftps://ftp.delta.test';
  sub['${{ secrets.FTP_SERVER_DIR }}'] = 'public_html/';
  sub['${{ secrets.FTP_USERNAME }}'] = 'uat-user';
  sub['${{ secrets.FTP_PASSWORD }}'] = 'uat-pass';
  sub['${{ github.event_name }}'] = o.event || 'push';
  sub['${{ github.event.inputs.full }}'] = o.fullInput || '';
  var src = SRC;
  Object.keys(sub).forEach(function (k) { src = src.split(k).join(sub[k]); });
  var left = src.match(/\$\{\{[^}]*\}\}/);
  if (left) throw new Error('عبارتِ جایگزینی‌نشده: ' + left[0]);
  fs.writeFileSync(scriptPath, src);
  var outFile = path.join(TMP, 'gh_output_' + Math.random().toString(36).slice(2));
  fs.writeFileSync(outFile, '');
  ['/tmp/prev-marker.txt', '/tmp/upload.txt', '/tmp/delete.txt', '/tmp/diff-files.txt'].forEach(function (t) {
    try { fs.unlinkSync(t); } catch (e) {}
  });
  var calls = path.join(TMP, 'calls_' + Math.random().toString(36).slice(2));
  fs.writeFileSync(calls, '');
  var env = Object.assign({}, process.env, {
    PATH: BIN + ':' + process.env.PATH,
    GITHUB_OUTPUT: outFile,
    GITHUB_SHA: repo.sha2,
    SHIM_CALLS: calls,
    SHIM_MARKER: o.marker === undefined ? repo.sha1 : o.marker,
    SHIM_FTP_DOWN: o.ftpDown ? '0' : '1'
  });
  var r = spawnSync('bash', [scriptPath], { cwd: repo.dir, env: env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  var out = fs.readFileSync(outFile, 'utf8');
  /* GITHUB_OUTPUT: اگر یک کلید چند بار نوشته شود، رانر **آخرین** مقدار را برمی‌دارد
     (این همان چیزی است که سپرِ «دلتایِ تهی» و بازگشتِ غیرِ ASCII به full به آن تکیه
     می‌کنند) — پس اینجا هم آخرین مقدار ملاک است، نه اولین. */
  var get = function (key) {
    var ms = out.match(new RegExp('^' + key + '=(.*)$', 'gm'));
    return ms && ms.length ? ms[ms.length - 1].slice(key.length + 1) : '';
  };
  var rd = function (t) { try { return fs.readFileSync(t, 'utf8'); } catch (e) { return ''; } };
  return {
    status: r.status,
    out: String(r.stdout || '') + String(r.stderr || ''),
    proto: get('proto'), mode: get('mode'),
    upload: rd('/tmp/upload.txt'), del: rd('/tmp/delete.txt'), diff: rd('/tmp/diff-files.txt')
  };
}

/* ───────────────── سناریو A: مارکرِ معتبر → افزایشی ───────────────── */
var repoA = makeRepo(path.join(TMP, 'repoA')); repoA.dir = path.join(TMP, 'repoA');
var A = runDelta(repoA, {});
T('A/افزایشی: exit 0 (بدونِ خطای زمانِ اجرا — همان باگِ `$(( … ))`)', A.status === 0,
  'exit=' + A.status + ' | ' + A.out.slice(-260));
T('A/افزایشی: proto=ftps کشف شد', A.proto === 'ftps', A.proto);
T('A/افزایشی: mode=incremental', A.mode === 'incremental', A.mode);
T('A/افزایشی: مارکرِ قبلی در لاگ گزارش شد', /مارکر قبلی: [0-9a-f]{40}/.test(A.out));
T('A/افزایشی: گزارشِ شمارشِ آپلود/حذف چاپ شد (رگرسیونِ باگِ ارزیابیِ حسابی)',
  /آپلود: \d+ فایل \| حذف: \d+ فایل/.test(A.out), (A.out.match(/آپلود:[^\n]*/) || ['—'])[0]);
T('A/افزایشی: حالتِ نهایی هم چاپ می‌شود', /حالتِ نهاییِ استقرار: incremental/.test(A.out));
T('A/افزایشی: فایلِ تغییرکرده در فهرستِ آپلود است', A.upload.split('\n').indexOf('crm/sw.js') > -1, A.upload.replace(/\n/g, ' '));
T('A/افزایشی: فایل‌های تولیدیِ هر ران همیشه آپلود می‌شوند',
  ['index.html', 'robots.txt', 'crm/.htaccess', '__deploy__.txt', 'crm/shell.html'].every(function (rel) {
    return A.upload.split('\n').indexOf(rel) > -1;
  }), A.upload.replace(/\n/g, ' '));
T('A/افزایشی: _tools و تسترها و .md و workflowها exclude شده‌اند',
  ['_tools/uat/tester1001-y.js', 'notes.md', '.github/workflows/deploy-staging.yml'].every(function (rel) {
    return A.upload.indexOf(rel) === -1;
  }), A.upload.replace(/\n/g, ' '));
T('A/افزایشی: فایلِ حذف‌شده در git به فهرستِ حذفِ سرور رفت',
  A.del.split('\n').indexOf('gone.txt') > -1, JSON.stringify(A.del));
T('A/افزایشی: حذف‌ها هم exclude را رعایت می‌کنند (فقطgone.txt)',
  A.del.trim().split('\n').length === 1, JSON.stringify(A.del));
T('A/افزایشی: هیچ ::warning/::error بی‌مورد صادر نشد', !/::(warning|error)::/.test(A.out), A.out.slice(0, 200));

/* ───────────────── سناریو B: مارکر با SHA ناشناخته → full ───────────────── */
var repoB = makeRepo(path.join(TMP, 'repoB')); repoB.dir = path.join(TMP, 'repoB');
var B = runDelta(repoB, { marker: 'f'.repeat(40) });
T('B/مارکرِ ناشناخته: exit 0 و mode=full (بدونِ remote، fetch فوری شکست می‌خورد)',
  B.status === 0 && B.mode === 'full', 'exit=' + B.status + ' mode=' + B.mode);
T('B/مارکرِ ناشناخته: فهرستِ آپلود ساخته نمی‌شود (مسیرِ full همه‌چیز را می‌فرستد)',
  B.upload === '');

/* ───────────────── سناریو C: مارکر نیست → full ───────────────── */
var repoC = makeRepo(path.join(TMP, 'repoC')); repoC.dir = path.join(TMP, 'repoC');
var C = runDelta(repoC, { marker: 'none' });
T('C/بدونِ مارکر: exit 0 و mode=full (اولین استقرار)', C.status === 0 && C.mode === 'full',
  'exit=' + C.status + ' mode=' + C.mode);
T('C/بدونِ مارکر: لاگ «مارکر قبلی: <نبود>» می‌گوید', /مارکر قبلی: <نبود>/.test(C.out));

/* ───────────────── سناریو D: FTP در دسترس نیست ───────────────── */
var repoD = makeRepo(path.join(TMP, 'repoD')); repoD.dir = path.join(TMP, 'repoD');
var D = runDelta(repoD, { ftpDown: true });
T('D/FTP مرده: exit 1 با proto=none و ::error::اتصال FTP برقرار نشد',
  D.status === 1 && D.proto === 'none' && /::error::اتصال FTP برقرار نشد/.test(D.out),
  'exit=' + D.status + ' proto=' + D.proto);
T('D/FTP مرده: این شکست با continue-on-error تحمل می‌شود و مسیرِ full را برمی‌گرداند',
  /id: delta[\s\S]{0,600}continue-on-error: true/.test(st)
  && /if: steps\.delta\.outputs\.mode != 'incremental' \|\| steps\.delta\.outcome == 'failure'/.test(st));

/* ───────────────── سناریو E/F: schedule و ورودیِ دستیِ full ───────────────── */
var repoE = makeRepo(path.join(TMP, 'repoE')); repoE.dir = path.join(TMP, 'repoE');
var E = runDelta(repoE, { event: 'schedule' });
T('E/زمان‌بندیِ هفتگی: با مارکرِ معتبر هم mode=full می‌شود (دریفت‌گیری)',
  E.status === 0 && E.mode === 'full', 'exit=' + E.status + ' mode=' + E.mode);
var repoF = makeRepo(path.join(TMP, 'repoF')); repoF.dir = path.join(TMP, 'repoF');
var F = runDelta(repoF, { fullInput: 'true' });
T('F/ورودیِ دستیِ full=true: mode=full', F.status === 0 && F.mode === 'full', 'mode=' + F.mode);
var F2 = runDelta(repoF, { fullInput: 'false' });
T('F/ورودیِ full=false: مسیرِ افزایشی دست‌نخورده می‌ماند', F2.status === 0 && F2.mode === 'incremental', 'mode=' + F2.mode);

/* ───────────────── سناریو H: مسیرِ غیرِ ASCII در دلتا ───────────────── */
var repoH = makeRepo(path.join(TMP, 'repoH'), { nonAscii: true }); repoH.dir = path.join(TMP, 'repoH');
var H = runDelta(repoH, {});
T('H/مسیرِ غیرِ ASCII: exit 0 با هشدار و mode=full (curl URL-Safe نیست)',
  H.status === 0 && H.mode === 'full' && /::warning::مسیر با نویسهٔ خاص در دلتا/.test(H.out),
  'exit=' + H.status + ' mode=' + H.mode + ' | ' + H.out.slice(-160));

/* ───────────────── پین‌های ایستاییِ fail-safe ───────────────── */
var incAt = st.indexOf('Incremental FTP upload');
T('پین: گامِ آپلودِ افزایشی فایلِ ناموجود را رد می‌کند (curl -T روی فایلِ نبوده خطا می‌دهد)',
  st.slice(incAt, incAt + 900).indexOf('[ -f "$f" ] || continue') > -1);
T('پین: آپلودِ افزایشی continue-on-error دارد (شکستش به full می‌افتد، نه به قرمزیِ بی‌دیپلوی)',
  /id: inc[\s\S]{0,200}continue-on-error: true/.test(st));
T('پین: دلتا هیچ‌وقت در قالبِ workflow از live واگرا نیست',
  fs.readFileSync(path.join(ROOT, '_tools/ci/workflow-templates/deploy-staging.yml'), 'utf8') === st);
T('پین: گامِ دلتا پیش از گامِ آپلود و پیش از FTP-Deploy-Action است (ترتیبِ fail-fast)',
  st.indexOf('Compute deploy delta') < incAt && incAt < st.indexOf('Deploy via FTP (full sync fallback)'));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (eClean) {}
console.log('\n— tester593 (v34.37.5: DELTA-FAILSAFE — اجرای واقعیِ گامِ دلتا در ریپوی gitِ ایزوله) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
