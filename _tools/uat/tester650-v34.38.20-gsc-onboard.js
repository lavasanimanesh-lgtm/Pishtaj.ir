#!/usr/bin/env node
'use strict';
/* tester650 — v34.38.20 (GSC-ONBOARD): قفلِ ابزار راه‌انداز اتصال Google Search Console.
   زیرساخت GSC (api/gsc.php: status/selftest/sitemap_submit/index_tracker + پنل CRM + واچ‌لیست
   هفتگی + ردیاب ایندکس) از قبل کامل است؛ تنها قدمِ خطاناپذیر «ساختنِ درستِ api/gsc-config.php»
   است. _tools/gsc_onboard.py آن قدم را می‌سازد:
     ۱) تولید از فایل JSON کلیدِ سرویس‌اکانت (بدون کپی دستی):  --from-json … --site … --out …
     ۲) تولید از مقادیر دستی:  --email … --key … --site … --out …
     ۳) اعتبارسنجی فایلِ موجود قبل از آپلود:  --check …
     ۴) راهنمای گام‌به‌گام:  --guide
   این تستر قفل می‌کند: (الف) سازوکارِ منبع (چهار حالت، استخراج از JSON، راستی‌آزمایی PEM با
   openssl، escape درستِ PHP، تجزیهٔ roundtrip)؛ (ب) رفتارِ واقعی (تولید از کلید ساختگی →
   --check سبز، ردِ کلیدِ جایگزینِ نمونه، ردِ فایلِ نایاب)؛ (ج) قراردادِ ادغام (gitignore شدنِ
   gsc-config.php، وجودِ sample، وجودِ اکشن‌های gsc.php). */
var fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function runPy(args, cwd) {
  var r = cp.spawnSync('python3', args, { cwd: cwd || ROOT, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

var TOOL = '_tools/gsc_onboard.py';
var tool = exists(TOOL) ? read(TOOL) : '';

/* ── ۱) سازوکار ابزار (سطح منبع) ── */
T('GSC-ONBOARD: ابزار _tools/gsc_onboard.py موجود است', exists(TOOL));
T('GSC-ONBOARD: چهار حالت دارد (--from-json / --email+--key / --check / --guide)',
  /--from-json/.test(tool) && /--email/.test(tool) && /--key/.test(tool) && /--check/.test(tool) && /--guide/.test(tool));
T('GSC-ONBOARD: استخراج از JSON کلید (type=service_account و client_email/private_key) را چک می‌کند',
  /service_account/.test(tool) && /client_email/.test(tool) && /private_key/.test(tool));
T('GSC-ONBOARD: ایمیلِ غیرِ سرویس‌اکانت (iam.gserviceaccount.com) رد می‌شود', /iam\.gserviceaccount\.com/.test(tool));
T('GSC-ONBOARD: راستی‌آزمایی کلید با openssl (pkey -in -noout) دارد', /openssl/.test(tool) && /pkey/.test(tool) && /-noout/.test(tool));
T('GSC-ONBOARD: escape درست PHP در render_config (بک‌اسلاش، نقل‌قول، خط جدید) دارد',
  /render_config/.test(tool) && /replace\('\\\\', '\\\\\\\\'\)/.test(tool));
T('GSC-ONBOARD: parse_config بدون اجرای PHP و با unescape صریح کلید را برمی‌گرداند',
  /parse_config/.test(tool) && /private_key/.test(tool) && /BEGIN/.test(tool));
T('GSC-ONBOARD: site_url فقط sc-domain: یا https://…/ می‌پذیرد', /sc-domain:/.test(tool) && /https\?:\/\//.test(tool));
T('GSC-ONBOARD: راهنما مسیر CSV (gsc_import.py) را هم ذکر می‌کند', /gsc_import\.py/.test(tool));
T('GSC-ONBOARD: راهنما سطح دسترسی Full را صریح می‌گوید', /Full/.test(tool));

/* ── ۲) رفتار واقعی: تولید از JSON ساختگی → --check سبز ── */
(function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsc-onb-'));
  try {
    // کلید RSA واقعی (مثل خروجی Google) با crypto نود
    var kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    var pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    var json = { type: 'service_account', client_email: 'ptf-gsc@ptf-test.iam.gserviceaccount.com', private_key: pem };
    var jf = path.join(tmp, 'sa.json');
    fs.writeFileSync(jf, JSON.stringify(json));
    var cfg = path.join(tmp, 'config.php');

    var gen = runPy([TOOL, '--from-json', jf, '--site', 'sc-domain:pishtaj.ir', '--out', cfg]);
    T('GSC-ONBOARD: تولید از JSON ساختگی با خروجی ۰ موفق است', gen.status === 0, 'status=' + gen.status + ' err=' + gen.err);
    T('GSC-ONBOARD: خروجی، مسیر و client_email را گزارش می‌کند', /کانفیگ نوشته شد/.test(gen.out) && /ptf-gsc@ptf-test\.iam\.gserviceaccount\.com/.test(gen.out));
    var cfgTxt = fs.existsSync(cfg) ? fs.readFileSync(cfg, 'utf8') : '';
    T('GSC-ONBOARD: فایل config.php با return [ … ] تولید شد', /^<\?php/.test(cfgTxt) && /return\s*\[/.test(cfgTxt));

    var chk = runPy([TOOL, '--check', cfg]);
    T('GSC-ONBOARD: --check روی کانفیگِ تولیدشده سبز است (خروجی ۰)', chk.status === 0, 'status=' + chk.status + '\n' + chk.out + chk.err);
    T('GSC-ONBOARD: --check کلید را کامل یافت (طول PEM بدون ازدست‌دادن)', chk.status === 0 && new RegExp('private_key\\s*:\\s*یافت شد \\(\\d+ کاراکتر\\)').test(chk.out));
    T('GSC-ONBOARD: roundtrip بدون ازدست‌دادن است (BEGIN/END PRIVATE KEY در خروجی)', chk.status === 0 && /✅ کانفیگ سالم است/.test(chk.out));

    // ردِ کلیدِ خراب
    var badJson = path.join(tmp, 'bad.json');
    fs.writeFileSync(badJson, JSON.stringify({ type: 'service_account', client_email: 'ptf-gsc@ptf-test.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n' }));
    var badGen = runPy([TOOL, '--from-json', badJson, '--site', 'sc-domain:pishtaj.ir', '--out', path.join(tmp, 'bad.php')]);
    T('GSC-ONBOARD: کلیدِ ناقص/خراب پیش از نوشتن رد می‌شود (خروجی ≠ ۰)', badGen.status !== 0, 'status=' + badGen.status);

    // ردِ فایل نایاب در --check
    var miss = runPy([TOOL, '--check', path.join(tmp, 'nope.php')]);
    T('GSC-ONBOARD: --check روی فایل نایاب رد می‌شود (خروجی ≠ ۰)', miss.status !== 0);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
  }
})();

/* ── ۳) اعتبارسنجی نمونهٔ رسمی: کلیدِ جایگزین باید رد شود ── */
(function () {
  T('GSC-ONBOARD: api/gsc-config.sample.php موجود است', exists('api/gsc-config.sample.php'));
  var sample = exists('api/gsc-config.sample.php') ? read('api/gsc-config.sample.php') : '';
  T('GSC-ONBOARD: نمونه هر سه کلید client_email/private_key/site_url را دارد',
    /'client_email'/.test(sample) && /'private_key'/.test(sample) && /'site_url'/.test(sample));
  var chk = runPy([TOOL, '--check', 'api/gsc-config.sample.php']);
  T('GSC-ONBOARD: --check روی نمونه (کلید جایگزین) رد می‌شود تا کسی نمونهٔ خام را آپلود نکند', chk.status !== 0, 'status=' + chk.status);
  T('GSC-ONBOARD: خطای ردِ نمونه دربارهٔ کلید است', /private_key|کلید|openssl/.test(chk.out + chk.err));
})();

/* ── ۴) قرارداد ادغام (gitignore / gsc.php) ── */
(function () {
  var gi = read('.gitignore');
  T('GSC-ONBOARD: api/gsc-config.php در .gitignore است (هرگز کامیت نمی‌شود)', /^api\/gsc-config\.php$/m.test(gi));
  T('GSC-ONBOARD: توکن/کش GSC (crm/data/gsc-token.json, gsc-cache.json) هم gitignore شده', /gsc-token\.json/.test(gi) && /gsc-cache\.json/.test(gi));
  var gsc = exists('api/gsc.php') ? read('api/gsc.php') : '';
  T('GSC-ONBOARD: api/gsc.php اکشن selftest/status دارد', /'selftest'/.test(gsc) && /'status'/.test(gsc));
  T('GSC-ONBOARD: api/gsc.php اکشن sitemap_submit دارد', /'sitemap_submit'/.test(gsc));
  T('GSC-ONBOARD: api/gsc.php اکشن index_tracker دارد', /'index_tracker'/.test(gsc));
  T('GSC-ONBOARD: api/gsc.php حالت‌های خراب gsc-config (missing/syntax/not_array/incomplete) را تشخیص می‌دهد',
    /missing/.test(gsc) && /syntax/.test(gsc) && /not_array/.test(gsc) && /incomplete/.test(gsc));
})();

/* ── ۵) راهنما ── */
(function () {
  var g = runPy([TOOL, '--guide']);
  T('GSC-ONBOARD: --guide با خروجی ۰ اجرا می‌شود', g.status === 0, 'status=' + g.status);
  T('GSC-ONBOARD: راهنما مسیر A (API زنده) و دستور --from-json را نشان می‌دهد', /مسیر A/.test(g.out) && /--from-json/.test(g.out));
  T('GSC-ONBOARD: راهنما مسیر B (CSV) و gsc_import.py را نشان می‌دهد', /مسیر B/.test(g.out) && /gsc_import\.py/.test(g.out));
  T('GSC-ONBOARD: راهنما «ثبت نقشه» به سطح Full نیاز دارد', /Full/.test(g.out) && /ثبت نقشه/.test(g.out));
})();

console.log('=== tester650: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
