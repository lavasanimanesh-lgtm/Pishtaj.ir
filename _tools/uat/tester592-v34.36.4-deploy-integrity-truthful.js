#!/usr/bin/env node
'use strict';
/* =====================================================================
   tester592 — v34.37.7 · INTEGRITY-TRUTHFUL (گیت صحتِ پس از استقرار)

   چرا این تستر وجود دارد (RCA با شواهدِ ران):
   سه رانِ پیاپیِ استقرار — PR #3 (run 33909238999)، main (run 33866519467) و
   PR #2 (run 33866324482) — دقیقاً در یک گام قرمز شدند: «Post-deploy integrity
   check»، در حالی که آپلود FTP، «Verify deployment (FTP-side + live HTTP)» و
   انتشار __diag__.txt سبز بودند و سایت زنده هم واقعاً همان کامیت را سرو می‌کرد
   (sw.js زنده در آن لحظه: RELEASE = 'v34.36.3' — یعنی نسخهٔ همان کامیت؛ بنر استیجینگ:
   کامیت d5552c6). این یک نقلِ تاریخی است، نه پینِ نسخه.

   علت، نه شبکه بلکه یک باگِ قطعی در خودِ اسکریپت بود:
       FILES="crm/sw.js crm/shell.js crm/client-server.js …"     ← یک خط، فاصله‌دار
       while IFS= read -r f; do … done <<< "$FILES"
   `read` بدونِ IFS-تقسیم، *کل* رشته را یک «نام فایل» می‌گیرد ⇒ حلقه فقط یک‌بار
   می‌زند ⇒ `sha1sum` روی نامِ ناموجود خطا می‌دهد (want تهی) و `curl` هم ۴۰۴
   (got = da39a3ee… = هشِ رشتهٔ خالی) ⇒ گیت **بی‌قیدوشرط** قرمز.
   الگوی درست از ابتدا در مخزن بود: BYTES_FILES چندخطی در _tools/ci/verify-deploy.sh.

   این تستر دو کار می‌کند:
   ۱) پینِ ساختاری: شکلِ درستِ گیت در هر دو workflow (و همسانیِ قالب‌ها با آن‌ها)،
      و نبودِ دوبارهٔ همان الگوی شکننده (FILES تک‌خطی، `curl … | sha1sum`).
   ۲) **اجرا**: بلوکِ واقعیِ `run:` از دلِ YAML بیرون کشیده می‌شود، عبارت‌های
      `${{ … }}` جایگزین می‌شوند و با `curl`/`sleep` ساختگی (بدونِ هیچ شبکه) در
      سناریوهای زیر اجرا می‌شود — یعنی رفتارِ همان کدی سنجیده می‌شود که در CI
      اجرا خواهد شد، نه بازنویسیِ آن:

      استیجینگ: سالم (سبز) · دیسک درست + HTTP مرده (سبزِ همراه با هشدار =
      همان قرمزِ کاذبِ دیروز) · دیسک کهنه (قرمزِ مسدودکننده) · تفاوتِ فقط
      پایان‌خط (سبز) · سکسکهٔ FTP (سبز پس از تلاش مجدد) · مارکرِ اشتباه (قرمز) ·
      چک‌اوتِ ناقص (قرمز با پیامِ داخلی)
      پروداکشن: سالم (سبز) · نسخهٔ مخلوط (قرمز با علتِ «ناهمسانی محتوا») ·
      لبهٔ HTTP مرده (قرمز با علتِ «بدون پاسخ/تهی» — تفکیکِ علت) · فقط پایان‌خط
      (سبز با هشدار) · دو تلاشِ اول مرده و سوم سالم (سبز = پنجرهٔ ۱۲×۳۰s کار
      می‌کند) · sleep 180 پیش از پنجره فراخوانی می‌شود.

   قراردادِ رفتاریِ موردِ انتظار (TRUTHFUL-GREEN):
     دیسکِ سرور == کامیت  → سبز (کشِ HTTP فقط هشدار است)
     دیسکِ سرور != کامیت  → قرمزِ مسدودکننده (fail-closed)
     «نتوانستیم بگیریم»   ≠ «محتوا فرق دارد» — در پیام و در شمارش‌ها جدا هستند.
   ===================================================================== */
var fs = require('fs'), os = require('os'), path = require('path');
var spawnSync = require('child_process').spawnSync;
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var WF_ST = '.github/workflows/deploy-staging.yml';
var WF_PR = '.github/workflows/deploy-production.yml';
var STEP = 'Post-deploy integrity check';
var st = read(WF_ST), pr = read(WF_PR);
var SHA40 = 'd5552c6d5552c6d5552c6d5552c6d5552c6d5552';

/* ───────────────────────── استخراج بلوکِ run از YAML ───────────────────────── */
function extractRun(yml, stepName, sha) {
  var lines = yml.split('\n');
  var i = -1;
  for (var k = 0; k < lines.length; k++) if (lines[k].indexOf('- name: ' + stepName) > -1) { i = k; break; }
  if (i < 0) throw new Error('گام پیدا نشد: ' + stepName);
  var j = i;
  while (j < lines.length && !/^\s*run:\s*\|/.test(lines[j])) j++;
  if (j >= lines.length) throw new Error('run: | برای ' + stepName + ' پیدا نشد');
  var body = [];
  for (var m = j + 1; m < lines.length; m++) {
    var l = lines[m];
    if (l.trim() === '') { body.push(''); continue; }
    if (!/^ {10}/.test(l)) break;                 /* پایان بلوک: تورفتگی کمتر از بدنه */
    body.push(l.slice(10));                       /* حذفِ تورفتگیِ ۱۰ فاصله‌ایِ YAML */
  }
  var src = body.join('\n');
  var sub = {};
  sub['${{ github.sha }}'] = sha;
  sub['${{ secrets.FTP_SERVER }}'] = 'ftps://ftp.integrity.test';
  sub['${{ secrets.FTP_SERVER_DIR }}'] = 'public_html/';
  sub['${{ secrets.FTP_USERNAME }}'] = 'uat-user';
  sub['${{ secrets.FTP_PASSWORD }}'] = 'uat-pass';
  sub['${{ steps.delta.outputs.proto }}'] = 'ftps';
  sub['${{ steps.delta.outputs.mode }}'] = 'full';
  sub['${{ github.ref_name }}'] = 'arena/uat';
  Object.keys(sub).forEach(function (key) { src = src.split(key).join(sub[key]); });
  var left = src.match(/\$\{\{[^}]*\}\}/);
  if (left) throw new Error('عبارتِ جایگزینی‌نشده در بلوک ماند: ' + left[0]);
  return src;
}

/* ───────────────────────── ابزارِ ساختگی (بدونِ شبکه) ───────────────────────── */
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-t592-'));
var BIN = path.join(TMP, 'bin');
fs.mkdirSync(BIN, { recursive: true });

/* curl ساختگی: برچسبِ سناریو از محیط خوانده می‌شود.
   FTP → SHIM_FTP_MODE، HTTP → SHIM_HTTP_MODE. حالت‌ها:
   ok (بایت‌های همان فایلِ مخزن) · eol (با \r\n) · stale (محتوای کهنه/نسخهٔ دیگر) ·
   dead (بدنهٔ تهی + exit 7 = شکستِ انتقال) · flaky/flaky2 (n تلاشِ اول مرده) */
fs.writeFileSync(path.join(BIN, 'curl'), [
  '#!/usr/bin/env bash',
  'out=""; url=""',
  'while [[ $# -gt 0 ]]; do',
  '  case "$1" in',
  '    -o) out="$2"; shift 2;;',
  '    -w|-H|--connect-timeout|--max-time|-u) shift 2;;',
  '    -*) shift;;',
  '    *) url="$1"; shift;;',
  '  esac',
  'done',
  '[[ -n "${SHIM_CALLS:-}" ]] && printf "%s\\n" "$url" >> "$SHIM_CALLS"',
  'emit() { if [[ -n "$out" ]]; then cat > "$out"; else cat; fi; }',
  'pth="${url#*://}"; pth="${pth#*/}"; pth="${pth%%\\?*}"',
  'case "$pth" in',
  '  *__deploy__.txt) printf \'{"sha":"%s","ref":"arena/uat","mode":"full"}\' "${SHIM_MARKER_SHA:-x}" | emit; exit 0;;',
  'esac',
  'rel="${pth#public_html/}"',
  'case "$url" in',
  '  ftp://*|ftps://*) mode="${SHIM_FTP_MODE:-ok}";;',
  '  *) mode="${SHIM_HTTP_MODE:-ok}";;',
  'esac',
  'st="${SHIM_STATE}"; mkdir -p "$st"',
  'key="$(printf "%s" "$rel" | tr \'/\' \'_\')"; n=0',
  '[[ -f "$st/$key" ]] && n="$(cat "$st/$key")"',
  'printf "%s" "$((n+1))" > "$st/$key"',
  'case "$mode" in',
  '  flaky)  if [[ "$n" -eq 0 ]]; then mode="dead"; else mode="ok"; fi;;',
  '  flaky2) if [[ "$n" -lt 2 ]]; then mode="dead"; else mode="ok"; fi;;',
  'esac',
  'case "$mode" in',
  '  ok)',
  '    [[ -f "$SHIM_ROOT/$rel" ]] || exit 22',
  '    cat "$SHIM_ROOT/$rel" | emit; exit 0;;',
  '  eol)',
  '    [[ -f "$SHIM_ROOT/$rel" ]] || exit 22',
  '    sed \'s/$/\\r/\' "$SHIM_ROOT/$rel" | emit; exit 0;;',
  '  stale)',
  '    [[ -f "$SHIM_ROOT/$rel" ]] || exit 22',
  '    { sed -E \'s/v3[0-9]\\.[0-9]+\\.[0-9]+/v30.0.1/g; s/3[0-9]\\.[0-9]+\\.[0-9]+/30.0.1/g\' "$SHIM_ROOT/$rel"; printf "\\n// STALE-CONTENT\\n"; } | emit; exit 0;;',
  '  dead) [[ -n "$out" ]] && : > "$out"; exit 7;;',
  'esac',
  'exit 0',
  ''
].join('\n'));

/* sleep ساختگی: پنجرهٔ ۱۲×۳۰s و sleep 180 فوری می‌شوند ولی «فراخوانی‌شان» ثبت
   می‌شود — تا هم آزمون کند نشود، هم بودنِ خودِ انتظارها سنجیده شود. */
fs.writeFileSync(path.join(BIN, 'sleep'), [
  '#!/usr/bin/env bash',
  '[[ -n "${SHIM_CALLS:-}" ]] && printf "SLEEP %s\\n" "$*" >> "$SHIM_CALLS"',
  'exit 0',
  ''
].join('\n'));
fs.chmodSync(path.join(BIN, 'curl'), 0o755);
fs.chmodSync(path.join(BIN, 'sleep'), 0o755);

function runStep(scriptPath, opts) {
  var o = opts || {};
  var stateDir = path.join(TMP, 'state-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(stateDir, { recursive: true });
  var calls = path.join(TMP, 'calls-' + Math.random().toString(36).slice(2) + '.log');
  fs.writeFileSync(calls, '');
  var env = Object.assign({}, process.env, {
    PATH: BIN + ':' + process.env.PATH,
    SHIM_ROOT: o.root || ROOT,
    SHIM_STATE: stateDir,
    SHIM_CALLS: calls,
    SHIM_FTP_MODE: o.ftp || 'ok',
    SHIM_HTTP_MODE: o.http || 'ok',
    SHIM_MARKER_SHA: o.markerSha === undefined ? SHA40 : o.markerSha,
    GITHUB_STEP_SUMMARY: path.join(TMP, 'summary.md'),
    GITHUB_ACTIONS: 'true',
    DEPLOY_SHA: SHA40
  });
  fs.writeFileSync(path.join(TMP, 'summary.md'), '');
  var args = o.dashE ? ['-e', scriptPath] : [scriptPath];
  var r = spawnSync('bash', args, { cwd: o.cwd || ROOT, env: env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return {
    status: r.status,
    out: String(r.stdout || '') + String(r.stderr || ''),
    calls: fs.readFileSync(calls, 'utf8'),
    summary: fs.existsSync(path.join(TMP, 'summary.md')) ? fs.readFileSync(path.join(TMP, 'summary.md'), 'utf8') : ''
  };
}

/* ───────────────────────── ۱) پین‌های ساختاری ───────────────────────── */
(function structural() {
  [['استیجینگ', st], ['پروداکشن', pr]].forEach(function (pair) {
    var name = pair[0], yml = pair[1];
    var post = yml.slice(yml.indexOf(STEP));
    var fm = yml.match(/FILES="([^"]+)"/);
    T('ساختار ' + name + ': گام «' + STEP + '» وجود دارد', yml.indexOf(STEP) > -1);
    T('ساختار ' + name + ': FILES چندخطی است (یک نام در هر خط) — باگِ read تک‌خطی رفع شده',
      !!fm && fm[1].indexOf('\n') > -1, fm ? JSON.stringify(fm[1].slice(0, 60)) : 'FILES پیدا نشد');
    T('ساختار ' + name + ': هیچ FILES تک‌خطیِ فاصله‌دار باقی نمانده (ضدِ بازگشتِ باگ)',
      !/FILES="[^"\n]+ [^"\n]+"/.test(yml), (yml.match(/FILES="[^"\n]+ [^"\n]+"/) || [''])[0]);
    var list = fm ? fm[1].split(/\s+/).filter(Boolean) : [];
    T('ساختار ' + name + ': فهرستِ فایل‌های حساس ≥ ۵ عضو دارد', list.length >= 5, String(list.length));
    var missing = list.filter(function (rel) { return !fs.existsSync(path.join(ROOT, rel)); });
    T('ساختار ' + name + ': همهٔ اعضای فهرست در مخزن موجودند', missing.length === 0, missing.join(','));
    T('ساختار ' + name + ': فایل PHP در فهرست نیست (سرور سورس را برنمی‌گرداند)',
      list.every(function (rel) { return !/\.php$/.test(rel); }), list.join(' '));
    T('ساختار ' + name + ': نسخه از VERSION.json خوانده می‌شود (منبعِ واحد) و PTF_CRM_RELEASE نام دارد',
      post.indexOf("require('./VERSION.json').crm_version") > -1 && post.indexOf('PTF_CRM_RELEASE') > -1);
    T('ساختار ' + name + ': الگوی شکنندهٔ «curl … | sha1sum» حذف شده (بدنهٔ تهی = هشِ رشتهٔ خالی)',
      !/curl[^|\n]*\|\s*sha1sum/.test(post), (post.match(/curl[^|\n]*\|\s*sha1sum/) || [''])[0].slice(0, 80));
    T('ساختار ' + name + ': «پاسخ نگرفتیم» از «محتوا فرق دارد» جدا شده (بدنهٔ تهی صریح)',
      /بدنهٔ تهی|پاسخ زنده دریافت نشد/.test(post));
    T('ساختار ' + name + ': fallbackِ پایان‌خط دارد (تفاوتِ فقط \\r ≠ نسخهٔ مخلوط)',
      /tr -d '\\r'/.test(post));
    T('ساختار ' + name + ': پنجرهٔ تلاشِ ۱۲×۳۰s حفظ شده',
      /for i in 1 2 3 4 5 6 7 8 9 10 11 12; do/.test(post) && /sleep 30/.test(post));
    T('ساختار ' + name + ': fail-closed است (exit $fail)', /exit \$fail/.test(post));
    T('ساختار ' + name + ': پیامِ شکست، want/got را برای ریشه‌یابی چاپ می‌کند',
      post.indexOf('want=') > -1 && post.indexOf('got=') > -1);
    T('ساختار ' + name + ': cache-buster و هدرهای no-cache حفظ شده‌اند',
      /-H 'Cache-Control: no-cache'/.test(post) && /-H 'Pragma: no-cache'/.test(post)
      && /\$RANDOM/.test(post));
  });

  var stPost = st.slice(st.indexOf(STEP));
  T('استیجینگ: لایهٔ ۱ readback مستقیم از FTP است (مسدودکننده، مستقل از کشِ هاست)',
    stPost.indexOf('readback') > -1 && /\$PROTO:\/\/\$HOST\//.test(stPost)
    && /::error::فایل‌های روی سرور \(FTP readback\)/.test(stPost));
  var stBody = stPost.slice(0, stPost.indexOf('\n      - name:', 5));
  T('استیجینگ: لایهٔ ۲ HTTP فقط هشدار است و گام با exit 0 پایان می‌یابد (TRUTHFUL-GREEN)',
    /::warning::کش HTTP استیجینگ/.test(stPost) && /exit 0\s*$/.test(stBody.trim()));
  T('استیجینگ: readback فایل‌به‌فایل تلاشِ مجدد دارد (۳ بار) — سکسکهٔ FTP = قرمزِ کاذب نیست',
    /tries=0/.test(stPost) && /while \[ "\$tries" -lt 3 \]/.test(stPost));
  T('استیجینگ: مارکر __deploy__.txt هم تلاشِ مجدد دارد (پیش‌تر تک‌تلاش و مسدودکننده بود)',
    /for m in 1 2 3; do/.test(stPost) && stPost.indexOf('__deploy__.txt') > -1);
  T('استیجینگ: crm/index.html در فهرستِ هش نیست (بنر تزریق می‌شود) ولی سنجهٔ زندهٔ نسخه را دارد',
    !/(FILES="[^"]*crm\/index\.html)/.test(st) && stPost.indexOf('$BASE/crm/index.html') > -1);
  T('پروداکشن: crm/index.html در فهرستِ هش هست (بنری تزریق نمی‌شود)',
    /FILES="crm\/index\.html/.test(pr));
  T('پروداکشن: انتظارِ اولیهٔ ۱۸۰s برای پیر شدنِ کشِ مسیرمحور حفظ شده', /sleep 180/.test(pr));
  T('پروداکشن: علتِ شکست دسته‌بندی می‌شود (ناهمسانی محتوا در برابر بدون پاسخ/تهی)',
    /reason="ناهمسانی محتوا: \$stale مورد"/.test(pr) && /بدون پاسخ\/تهی: \$dead مورد/.test(pr));
  T('پروداکشن: تفاوتِ فقط پایان‌خط به هشدارِ عملیاتی تبدیل می‌شود (انتقالِ باینری)',
    /::warning::سرور \$eolonly فایل را با تبدیل پایان‌خط/.test(pr));

  /* ریشهٔ واگراییِ تاریخی: دو کپیِ از هم دورِ یک منطق. قالب‌ها منبعِ رسمی‌اند. */
  [['deploy-staging.yml', st], ['deploy-production.yml', pr]].forEach(function (pair) {
    var tpl = '_tools/ci/workflow-templates/' + pair[0];
    var same = false;
    try { same = fs.readFileSync(path.join(ROOT, tpl), 'utf8') === pair[1]; } catch (e) { same = false; }
    T('همسانی: ' + tpl + ' بایت‌به‌بایت با .github/workflows/' + pair[0] + ' یکی است',
      same, same ? '' : 'قالب و workflow واگرا شده‌اند (ریشهٔ اینکه وصلهٔ پروداکشن به استیجینگ نرسید)');
  });
})();

/* ───────────────────────── ۲) اجرای واقعیِ بلوک‌ها ───────────────────────── */
var stScript = path.join(TMP, 'step-staging.sh');
var prScript = path.join(TMP, 'step-production.sh');
var stSrc = extractRun(st, STEP, SHA40);
var prSrc = extractRun(pr, STEP, SHA40);
fs.writeFileSync(stScript, stSrc);
fs.writeFileSync(prScript, prSrc);

var synSt = spawnSync('bash', ['-n', stScript], { encoding: 'utf8' });
var synPr = spawnSync('bash', ['-n', prScript], { encoding: 'utf8' });
T('اجرا: بلوکِ استیجینگ از YAML قابلِ استخراج و از نظرِ نحوی سالم است (bash -n)', synSt.status === 0, String(synSt.stderr || '').slice(0, 200));
T('اجرا: بلوکِ پروداکشن از YAML قابلِ استخراج و از نظرِ نحوی سالم است (bash -n)', synPr.status === 0, String(synPr.stderr || '').slice(0, 200));

var R = {};   /* نتایجِ سناریوها */
function scenario(key, script, opts, dashE) {
  var o = Object.assign({}, opts);
  R[key] = runStep(script, o);
  if (dashE) R[key + '|-e'] = runStep(script, Object.assign({ dashE: true }, o));
}

/* — استیجینگ — */
scenario('st-healthy', stScript, { ftp: 'ok', http: 'ok' }, true);
scenario('st-http-dead', stScript, { ftp: 'ok', http: 'dead' }, true);
scenario('st-disk-stale', stScript, { ftp: 'stale', http: 'ok' });
scenario('st-disk-eol', stScript, { ftp: 'eol', http: 'ok' });
scenario('st-ftp-flaky', stScript, { ftp: 'flaky', http: 'ok' });
scenario('st-marker-wrong', stScript, { ftp: 'ok', http: 'ok', markerSha: 'ffffffffffffffffffffffffffffffffffffffff' });
/* چک‌اوتِ ناقص: VERSION.json هست ولی crm/* نه — باید «مشکل داخلی گیت» بگوید */
var brokenRoot = path.join(TMP, 'broken-checkout');
fs.mkdirSync(brokenRoot, { recursive: true });
fs.writeFileSync(path.join(brokenRoot, 'VERSION.json'), read('VERSION.json'));
R['st-broken-checkout'] = runStep(stScript, { ftp: 'ok', http: 'ok', cwd: brokenRoot, root: brokenRoot });

/* — پروداکشن — */
scenario('pr-healthy', prScript, { http: 'ok' }, true);
scenario('pr-mixed-version', prScript, { http: 'stale' });
scenario('pr-edge-dead', prScript, { http: 'dead' });
scenario('pr-eol', prScript, { http: 'eol' });
scenario('pr-flaky2', prScript, { http: 'flaky2' });

function has(key, re) { return re.test(R[key].out); }
function n(key, re) { return (R[key].out.match(re) || []).length; }

/* --- استیجینگ: سالم --- */
T('رفتار استیجینگ/سالم: exit 0', R['st-healthy'].status === 0, 'exit=' + R['st-healthy'].status);
T('رفتار استیجینگ/سالم: لایهٔ ۱ سبز اعلام شد', has('st-healthy', /✅ لایهٔ ۱: بایت‌های دیسک سرور == کامیت/));
T('رفتار استیجینگ/سالم: لایهٔ ۲ (HTTP) سبز اعلام شد', has('st-healthy', /✅ تلاش 1: HTTP زنده == کامیت/));
T('رفتار استیجینگ/سالم: مارکرِ استقرار == کامیتِ ران', has('st-healthy', /✅ مارکر استقرار == کامیت این ران/));
T('رفتار استیجینگ/سالم: هر ۵ فایلِ حساس *جداگانه* readback شدند (اثباتِ رفعِ باگِ FILES تک‌خطی)',
  n('st-healthy', /✅ crm\/\S+ — readback == کامیت \(\d+ بایت\)/g) === 5,
  'شمار=' + n('st-healthy', /readback == کامیت/g));
T('رفتار استیجینگ/سالم: هیچ ≠ یا ::error در خروجی نیست', !has('st-healthy', /≠|::error/));

/* --- استیجینگ: دیسک درست، HTTP مرده = همان قرمزِ کاذبِ دیروز --- */
T('رفتار استیجینگ/HTTP-مرده: exit 0 — دیپلویِ درست به‌خاطرِ لبهٔ HTTP قرمز نمی‌شود',
  R['st-http-dead'].status === 0, 'exit=' + R['st-http-dead'].status);
T('رفتار استیجینگ/HTTP-مرده: ::warning::کش HTTP استیجینگ منتشر می‌شود', has('st-http-dead', /::warning::کش HTTP استیجینگ/));
T('رفتار استیجینگ/HTTP-مرده: هیچ ::error صادر نمی‌شود', !has('st-http-dead', /::error/));
T('رفتار استیجینگ/HTTP-مرده: دستهٔ «بی‌پاسخ/تهی» شمرده و گزارش می‌شود (ریشه‌یابیِ علت)',
  has('st-http-dead', /بی‌پاسخ\/تهی=[1-9]\d*/));
T('رفتار استیجینگ/HTTP-مرده: لایهٔ ۱ همچنان سبز است (دیسک اثبات‌شده)',
  has('st-http-dead', /✅ لایهٔ ۱/));
T('رفتار استیجینگ/HTTP-مرده: خلاصهٔ گام هم هشدارِ کهنگیِ کش را می‌گیرد',
  /کش HTTP استیجینگ دیر تازه شد/.test(R['st-http-dead'].summary));

/* --- استیجینگ: دیسک کهنه = استقرارِ واقعاً ناقص --- */
T('رفتار استیجینگ/دیسک-کهنه: exit 1 (fail-closed حفظ شد)', R['st-disk-stale'].status === 1,
  'exit=' + R['st-disk-stale'].status);
T('رفتار استیجینگ/دیسک-کهنه: ::error::فایل‌های روی سرور (FTP readback) …',
  has('st-disk-stale', /::error::فایل‌های روی سرور \(FTP readback\) با کامیت یکی نیست/));
T('رفتار استیجینگ/دیسک-کهنه: هر ۵ فایل با want/got و اندازه گزارش شدند',
  n('st-disk-stale', /≠ crm\/\S+ \(want=[0-9a-f]{10} got=[0-9a-f]{10} — روی دیسک سرور؛ اندازه کامیت=\d+ سرور=\d+\)/g) === 5,
  'شمار=' + n('st-disk-stale', /≠ crm\//g));
T('رفتار استیجینگ/دیسک-کهنه: اولین تفاوتِ محتوا هم چاپ می‌شود', has('st-disk-stale', /اولین تفاوت:/));
T('رفتار استیجینگ/دیسک-کهنه: لایهٔ ۲ اجرا نمی‌شود (پیش از آن خارج می‌شویم)',
  !has('st-disk-stale', /HTTP زنده == کامیت|کش HTTP استیجینگ/));

/* --- استیجینگ: تفاوتِ فقط پایان‌خط --- */
T('رفتار استیجینگ/فقط-پایان‌خط: exit 0 — تبدیلِ \\r سمتِ سرور، قرمزِ کاذب نمی‌سازد',
  R['st-disk-eol'].status === 0, 'exit=' + R['st-disk-eol'].status);
T('رفتار استیجینگ/فقط-پایان‌خط: برای هر فایل هشدارِ صریحِ «تفاوت فقط پایان‌خط» می‌آید',
  n('st-disk-eol', /⚠ crm\/\S+ — تفاوت فقط پایان‌خط/g) === 5,
  'شمار=' + n('st-disk-eol', /پایان‌خط/g));

/* --- استیجینگ: سکسکهٔ FTP --- */
T('رفتار استیجینگ/سکسکهٔ-FTP: exit 0 پس از تلاشِ مجددِ فایل‌به‌فایل',
  R['st-ftp-flaky'].status === 0, 'exit=' + R['st-ftp-flaky'].status);
T('رفتار استیجینگ/سکسکهٔ-FTP: تلاشِ ناموفقِ اول در لاگ ثبت شده (قابلِ ریشه‌یابی)',
  has('st-ftp-flaky', /تلاش 1: دانلود FTP ناموفق|تلاش 1: بدنهٔ تهی از FTP/));

/* --- استیجینگ: مارکرِ اشتباه --- */
T('رفتار استیجینگ/مارکر-اشتباه: exit 1 — مارکر واقعاً سنجیده می‌شود (نه تشریفاتی)',
  R['st-marker-wrong'].status === 1, 'exit=' + R['st-marker-wrong'].status);
T('رفتار استیجینگ/مارکر-اشتباه: محتوای مارکر در لاگ می‌آید تا shaِ سروشده معلوم باشد',
  has('st-marker-wrong', /sha مطابقت ندارد → \{"sha":"f{8,}/));

/* --- استیجینگ: چک‌اوتِ ناقص --- */
T('رفتار استیجینگ/چک‌اوت-ناقص: exit 1 با پیامِ «مشکل داخلی گیت، نه استقرار»',
  R['st-broken-checkout'].status === 1 && has('st-broken-checkout', /در چک‌اوتِ این ران نیست \(مشکل داخلی گیت، نه استقرار\)/),
  'exit=' + R['st-broken-checkout'].status);

/* --- پروداکشن --- */
T('رفتار پروداکشن/سالم: exit 0', R['pr-healthy'].status === 0, 'exit=' + R['pr-healthy'].status);
T('رفتار پروداکشن/سالم: «همهٔ فایل‌های حساس زنده == کامیت»',
  has('pr-healthy', /✅ تلاش 1: همهٔ فایل‌های حساس زنده == کامیت/));
T('رفتار پروداکشن/سالم: هر ۷ فایلِ فهرست جداگانه fetch شدند (FILES چندخطی)',
  (R['pr-healthy'].calls.match(/\/crm\//g) || []).length >= 7, String(R['pr-healthy'].calls.length));
T('رفتار پروداکشن/سالم: انتظارِ اولیهٔ ۱۸۰s پیش از پنجره فراخوانی می‌شود',
  /SLEEP 180/.test(R['pr-healthy'].calls));

T('رفتار پروداکشن/نسخهٔ-مخلوط: exit 1', R['pr-mixed-version'].status === 1, 'exit=' + R['pr-mixed-version'].status);
T('رفتار پروداکشن/نسخهٔ-مخلوط: علت «ناهمسانی محتوا» با شمارشِ موارد',
  has('pr-mixed-version', /ناهمسانی محتوا: [1-9]\d* مورد/));
T('رفتار پروداکشن/نسخهٔ-مخلوط: سنجهٔ RELEASE زنده هم ناهمخوانی را گزارش می‌کند',
  has('pr-mixed-version', /≠ crm\/sw\.js زنده: RELEASE = 'v30\.0\.1'/));
T('رفتار پروداکشن/نسخهٔ-مخلوط: ::error صادر می‌شود', has('pr-mixed-version', /::error::سایت زنده با کامیت دیپلوی‌شده یکی نیست/));

T('رفتار پروداکشن/لبهٔ-مرده: exit 1 (fail-closed — «نتوانستیم بگیریم» سبز نیست)',
  R['pr-edge-dead'].status === 1, 'exit=' + R['pr-edge-dead'].status);
T('رفتار پروداکشن/لبهٔ-مرده: علت «بدون پاسخ/تهی» است نه «ناهمسانی محتوا» (تفکیکِ علت)',
  has('pr-edge-dead', /بدون پاسخ\/تهی: [1-9]\d* مورد/) && has('pr-edge-dead', /ناهمسانی محتوا: 0 مورد/));
T('رفتار پروداکشن/لبهٔ-مرده: پیامِ پایانی راهنمای عملی دارد (دسترس‌پذیری/کش، نه محتوا)',
  has('pr-edge-dead', /دسترس‌پذیری\/کش لبهٔ HTTP است نه از محتوای دیپلوی‌شده/));

T('رفتار پروداکشن/فقط-پایان‌خط: exit 0 با هشدارِ عملیاتیِ انتقالِ باینری',
  R['pr-eol'].status === 0 && has('pr-eol', /::warning::سرور \d+ فایل را با تبدیل پایان‌خط/),
  'exit=' + R['pr-eol'].status);

T('رفتار پروداکشن/سکسکهٔ-دوباره: exit 0 در تلاشِ سوم — پنجرهٔ ۱۲×۳۰s واقعاً کار می‌کند',
  R['pr-flaky2'].status === 0 && has('pr-flaky2', /✅ تلاش 3:/),
  'exit=' + R['pr-flaky2'].status + ' | ' + (R['pr-flaky2'].out.match(/✅ تلاش \d+/) || ['—'])[0]);
T('رفتار پروداکشن/سکسکهٔ-دوباره: تلاش‌های ناموفقِ ۱ و ۲ با علت ثبت شده‌اند',
  has('pr-flaky2', /تلاش 1 از ۱۲ ناموفق/) && has('pr-flaky2', /تلاش 2 از ۱۲ ناموفق/));

/* --- یکسان بودنِ قضاوت زیرِ bash -e (پوستهٔ پیش‌فرضِ رانرِ گیت‌هاب) --- */
['st-healthy', 'st-http-dead', 'pr-healthy'].forEach(function (key) {
  var withE = R[key + '|-e'];
  T('پوسته: ' + key + ' زیرِ `bash -e` همان قضاوت را می‌دهد (رانر با -e اجرا می‌کند)',
    !!withE && withE.status === R[key].status,
    withE ? 'exit(-e)=' + withE.status + ' در برابر exit=' + R[key].status : 'اجرا نشد');
});

/* --- ضدِ واگراییِ دو workflow --- */
T('ضدواگرایی: هر دو workflow نشانهٔ تفکیکِ «بدنهٔ تهی» را دارند',
  /بدنهٔ تهی|پاسخ زنده دریافت نشد/.test(st) && /بدنهٔ تهی|پاسخ زنده دریافت نشد/.test(pr));
T('ضدواگرایی: هر دو workflow نشانهٔ fallback پایان‌خط را دارند',
  (st.match(/tr -d '\\r'/g) || []).length >= 2 && (pr.match(/tr -d '\\r'/g) || []).length >= 2);

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (eClean) {}
/* ═══ v34.37.7 (INTEGRITY-INDENT) — رگرسیونِ «گیتِ استقرار بی‌قیدوشرط قرمز» ═══
   یافته: `FILES` یک رشتهٔ چندخطیِ داخل YAML است، پس همهٔ خطها جز اولی با فاصله‌های
   تورفتگیِ YAML شروع می‌شوند. حلقه با `IFS= read -r f` آن فاصله‌ها را حفظ می‌کرد و
   `[ ! -f "$f" ]` برای ۴ فایل از ۵ فایل صادق می‌شد ⇒ «در چک‌اوتِ این ران نیست» و
   fail=1 در *هر* اجرا. نتیجه: استقرار استیجینگ و پروداکشن ماه‌ها قرمز بود — حتی
   روی main — و علتش هیچ ربطی به خودِ استقرار نداشت.
   دقیقاً همان تلهٔ `FILES` که کامنتِ بالای همان بلوک دربارهٔ شکل دیگرش هشدار داده بود. */
(function () {
  [["staging", st], ["production", pr]].forEach(function (pair) {
    var name = pair[0], src = pair[1];
    /* هر حلقه‌ای که از <<< "$FILES" تغذیه می‌شود باید تورفتگی را trim کند (بدون IFS=) */
    var blocks = src.split('done <<< "$FILES"');
    blocks.pop();
    blocks.forEach(function (b, i) {
      var loop = b.lastIndexOf('read -r f; do');
      var ls = b.lastIndexOf('\n', loop) + 1;
      var head = b.slice(ls, b.indexOf('\n', loop));
      T('INDENT/' + name + '#' + (i + 1) + ': حلقهٔ $FILES تورفتگی YAML را trim می‌کند (IFS= ندارد)',
        /^while read -r f; do/.test(head.trim()), head.trim());
    });
    /* حلقه‌هایی که از فایل می‌خوانند باید IFS= را نگه دارند (نام فایل دست‌نخورده) */
    T('INDENT/' + name + ': حلقه‌های فایل‌محور همچنان IFS= دارند (بدون رگرسیون معکوس)',
      src.indexOf('done < /tmp/upload.txt') === -1 || /while IFS= read -r f; do[\s\S]*?done < \/tmp\/upload\.txt/.test(src));
  });
  /* اجرای واقعی: با curl ساختگیِ همیشه‌ناموفق هم نباید حتی یک «در چک‌اوت نیست» بدهد */
  ['staging', 'production'].forEach(function (which) {
    var file = which === 'staging' ? 'deploy-staging.yml' : 'deploy-production.yml';
    var src = which === 'staging' ? st : pr;
    var i = src.indexOf('- name: Post-deploy integrity check');
    if (i < 0) { T('INDENT/' + which + ': بلوک صحت پیدا شد', false); return; }
    var blk = src.slice(i, src.indexOf('\n      - name:', i + 10));
    var run = blk.slice(blk.indexOf('run: |') + 7);
    var stop = run.indexOf('done <<< "$FILES"');
    /* curl را با تابع پوسته سایه می‌کنیم: هیچ شبکه‌ای لمس نمی‌شود و اجرا آنی است.
       (پروداکشن rb_fetch ندارد و مستقیم curl صدا می‌زند — سایه‌زدنِ curl هر دو را می‌گیرد.) */
    run = 'curl(){ for a in "$@"; do [ "$a" = "-o" ] && o=1 && continue; [ -n "$o" ] && : > "$a" && o=; done; return 7; }\n' +
      'sleep(){ :; }\n' + /* پروداکشن پیش از حلقه sleep 180 دارد (پنجرهٔ کهنگیِ کش هاست) */
      run.slice(0, stop + 'done <<< "$FILES"'.length).replace(/\$\{\{[^}]*\}\}/g, 'X');
    /* برشِ لایهٔ ۱ ممکن است داخل یک حلقهٔ بیرونی باشد (پروداکشن: for i in 1..12).
       تا وقتی bash -n سالم نشده، `done` می‌بندیم — حداکثر ۴ لایه. */
    var tmp = path.join(require('os').tmpdir(), 'ptf-indent-' + which + '.sh');
    var closed = run;
    for (var k = 0; k <= 4; k++) {
      fs.writeFileSync(tmp, closed);
      if (spawnSync('bash', ['-n', tmp], { encoding: 'utf8' }).status === 0) break;
      closed = run + '\n' + Array(k + 2).join('done\n');
    }
    T('INDENT/' + which + ': برشِ لایهٔ ۱ از نظر نحوی سالم است (هارنس معتبر)',
      spawnSync('bash', ['-n', tmp], { encoding: 'utf8' }).status === 0);
    var r = spawnSync('bash', [tmp], { encoding: 'utf8', timeout: 60000 });
    var out = String(r.stdout || '') + String(r.stderr || '');
    T('INDENT/' + which + ': اجرای واقعیِ لایهٔ ۱ هیچ «در چک‌اوتِ این ران نیست» نمی‌دهد',
      out.indexOf('در چک‌اوتِ این ران نیست') === -1,
      (out.match(/⛔[^\n]*/g) || []).slice(0, 2).join(' | '));
    /* هر فایلِ فهرست باید از گاردِ «در چک‌اوت نیست» عبور کرده و به مرحلهٔ قضاوت برسد.
       استیجینگ «تلاش n:» چاپ می‌کند و پروداکشن مستقیم قضاوت ≠/⚠ — هر دو یعنی رسیده. */
    var reached = (out.match(/[≠⚠✓] +crm\//g) || []).length;
    var listed = ((src.slice(src.indexOf('FILES="', i)).match(/^[^\n]*\n(?:[^\n]*\n)*?[^\n]*"\n/) || [''])[0].match(/crm\/[A-Za-z0-9._-]+/g) || []).length;
    T('INDENT/' + which + ': همهٔ ' + listed + ' فایلِ فهرست از گارد عبور و وارد قضاوت می‌شوند',
      listed >= 5 && reached >= listed, 'رسیده: ' + reached + ' از ' + listed);
  });
})();

console.log('\n— tester592 (v34.37.7: INTEGRITY-TRUTHFUL — گیتِ صحتِ استقرار، اجراشده با curl ساختگی) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
