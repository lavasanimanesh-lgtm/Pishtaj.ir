#!/usr/bin/env node
'use strict';
/* tester651 — v34.38.20 (SEO-WATCHLIST-LIVE): قفلِ «حالت زنده» ابزار واچ‌لیست هفتگی.
   از وقتی GSC وصل است، دیگر اکسپورت CSV لازم نیست: _tools/seo_weekly_watchlist.py --live
   همان داده‌ای را که پنل CRM نشان می‌دهد مستقیم از api/gsc.php (action=overview) می‌گیرد،
   روند را در _audit/SEO-WATCHLIST.json به‌روز می‌کند و گزارش هفتگی می‌سازد — بدون نوشتنِ
   اسنپ‌شات CSV (تا آرشیو _audit و قرارداد tester647 دست‌نخورده بماند).
   این تستر قفل می‌کند: (الف) سازوکار منبع (--live/--base/--token/--days، هدر X-CRM-Token،
   action=overview، اولویت توکن CLI > PTF_CRM_TOKEN > فایل)؛ (ب) رفتار واقعیِ fetch_live روی
   یک سرور محلی (تطبیق header، نگاشت rows، مسیر خطای شبکه)؛ (ج) قرارداد ادغام (gitignore شدن
   فایل توکن، فقط STATE و SEO-WEEKLY نوشته می‌شوند). */
var fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
/* اجرای همزمان (sync) — فقط برای کدِ بدون وابستگی به سرورِ همین فرایند */
function pySync(code) {
  var r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
/* اجرای async — برای حالتی که پایتون باید به سرورِ این فرایند request بزند */
function pyAsync(code) {
  return new Promise(function (resolve) {
    var child = cp.spawn('python3', ['-c', code], { cwd: ROOT });
    var out = '', err = '', timedOut = false;
    var to = setTimeout(function () { timedOut = true; child.kill('SIGKILL'); }, 30000);
    child.stdout.on('data', function (d) { out += d; });
    child.stderr.on('data', function (d) { err += d; });
    child.on('close', function (status) {
      clearTimeout(to);
      resolve({ status: status, out: out, err: err, timedOut: timedOut });
    });
  });
}
function listen(srv) {
  return new Promise(function (resolve, reject) {
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', function () { resolve(srv.address().port); });
  });
}

var tool = exists('_tools/seo_weekly_watchlist.py') ? read('_tools/seo_weekly_watchlist.py') : '';

/* ── ۱) سازوکار منبع (سطح منبع) ── */
function sourceChecks() {
  T('SEO-LIVE: ابزار seo_weekly_watchlist.py موجود است', exists('_tools/seo_weekly_watchlist.py'));
  T('SEO-LIVE: حالت --live دارد', /--live/.test(tool));
  T('SEO-LIVE: پارامترهای --base/--token/--days دارد', /--base/.test(tool) && /--token/.test(tool) && /--days/.test(tool));
  T('SEO-LIVE: اکشن overview از api/gsc.php را می‌خواند', /'action':\s*'overview'/.test(tool) || /action=overview/.test(tool));
  T('SEO-LIVE: هدر X-CRM-Token را می‌فرستد (هم‌قاعده با crm/gsc.js)', /X-CRM-Token/.test(tool));
  T('SEO-LIVE: اولویت توکن CLI > PTF_CRM_TOKEN > فایل .ptf-crm-token دارد', /resolve_token/.test(tool) && /PTF_CRM_TOKEN/.test(tool) && /\.ptf-crm-token/.test(tool));
  T('SEO-LIVE: نگاشت خروجی overview به rows (overview_rows) دارد', /overview_rows/.test(tool));
  T('SEO-LIVE: مسیرهای خطای شبکه و پاسخ غیرok را مدیریت می‌کند', /HTTPError/.test(tool) && /URLError/.test(tool) && /خطای شبکه/.test(tool));
  T('SEO-LIVE: فقط STATE و SEO-WEEKLY نوشته می‌شوند (اسنپ‌شات CSV نمی‌نویسد)', /open\(STATE/.test(tool) && /open\(report/.test(tool) && !/open\(snap/.test(tool));
}

/* ── ۲) رفتار واقعی: fetch_live روی سرور محلی ── */
function networkChecks() {
  return new Promise(function (resolve) {
    var seen = { token: null, path: '' };
    var srv = http.createServer(function (req, res) {
      seen.token = req.headers['x-crm-token'] || null;
      seen.path = req.url || '';
      var body = JSON.stringify({ ok: true, queries: [
        { q: 'تامین تجهیزات پایپینگ', clicks: 12, impressions: 340, ctr: 3.5, position: 8.4, brand: false },
        { q: 'کنترل ولو بخار', clicks: 2, impressions: 40, position: 12.5 },
        { q: '', clicks: 1, impressions: 5, position: 4 }
      ] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    });
    listen(srv).then(function (port) {
      var code = "import sys,json; sys.path.insert(0,'_tools'); import seo_weekly_watchlist as m;\n" +
        "rows,err = m.fetch_live('http://127.0.0.1:" + port + "','SECRET',90);\n" +
        "print(json.dumps({'rows':rows,'err':err}, ensure_ascii=False))";
      pyAsync(code).then(function (r) {
        srv.close();
        T('SEO-LIVE: fetch_live روی سرور محلی موفق است (err=None)', !r.timedOut && r.status === 0 && /"err": null/.test(r.out), r.err || r.out);
        T('SEO-LIVE: هدر X-CRM-Token با مقدار درست به سرور رسید', seen.token === 'SECRET', 'token=' + seen.token);
        T('SEO-LIVE: مسیر درخواست action=overview&days=90 دارد', /action=overview/.test(seen.path) && /days=90/.test(seen.path), seen.path);
        T('SEO-LIVE: نگاشت rows درست است (کلیک/نمایش/جایگاه عددی، کوئری خالی حذف)', /"تامین تجهیزات پایپینگ"/.test(r.out) && /"position": 8.4/.test(r.out) && !/"":/.test(r.out) && /"position": 12.5/.test(r.out), r.out);

        // مسیر خطای شبکه (پورت بسته)
        var code2 = "import sys,json; sys.path.insert(0,'_tools'); import seo_weekly_watchlist as m;\n" +
          "rows,err = m.fetch_live('http://127.0.0.1:1','x',90); print(json.dumps({'rows':rows,'err':err}, ensure_ascii=False))";
        var r2 = pySync(code2);
        T('SEO-LIVE: خطای شبکه تمیز برمی‌گردد (rows=None و err متنی)', r2.status === 0 && /"rows": null/.test(r2.out) && /خطای شبکه/.test(r2.out), r2.out);
        resolve();
      });
    }).catch(function (e) { T('SEO-LIVE: سرور محلی بالا آمد', false, String(e)); resolve(); });
  });
}

/* ── ۳) اولویت توکن resolve_token ── */
function tokenChecks() {
  var code = "import sys,json; sys.path.insert(0,'_tools'); import seo_weekly_watchlist as m;\n" +
    "out = {};\n" +
    "out['cli'] = m.resolve_token('CLI', env={'PTF_CRM_TOKEN':'ENV'});\n" +
    "out['env'] = m.resolve_token('', env={'PTF_CRM_TOKEN':'ENV'});\n" +
    "out['none'] = m.resolve_token(None, env={});\n" +
    "print(json.dumps(out))";
  var r = pySync(code);
  T('SEO-LIVE: اولویت توکن CLI > env درست است', /"cli": "CLI"/.test(r.out) && /"env": "ENV"/.test(r.out), r.out);
  T('SEO-LIVE: بدون هیچ منبعی None برمی‌گردد', /"none": null/.test(r.out), r.out);

  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-tok-'));
  try {
    var tf = path.join(tmp, 'token.txt');
    fs.writeFileSync(tf, 'FILETOK\n');
    var code2 = "import sys,json; sys.path.insert(0,'_tools'); import seo_weekly_watchlist as m;\n" +
      "m.TOKEN_FILE = '" + tf.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "';\n" +
      "print(json.dumps({'file': m.resolve_token(None, env={})}))";
    var r2 = pySync(code2);
    T('SEO-LIVE: توکن از فایل (با TOKEN_FILE بازنشانه‌شده) خوانده می‌شود', /"file": "FILETOK"/.test(r2.out), r2.out);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
  }
}

/* ── ۴) قرارداد ادغام ── */
function integrationChecks() {
  var gi = read('.gitignore');
  T('SEO-LIVE: فایل توکن _tools/.ptf-crm-token در .gitignore است (هرگز کامیت نمی‌شود)', /^_tools\/\.ptf-crm-token$/m.test(gi));
  T('SEO-LIVE: gsc.js از هدر X-CRM-Token استفاده می‌کند (هم‌راستایی با کلاینت)', exists('crm/gsc.js') && /X-CRM-Token/.test(read('crm/gsc.js')));
  T('SEO-LIVE: api/gsc.php اکشن overview را دارد (منبع دادهٔ زنده)', exists('api/gsc.php') && /case 'overview'/.test(read('api/gsc.php')));
}

sourceChecks();
networkChecks().then(function () {
  tokenChecks();
  integrationChecks();
  console.log('=== tester651: ' + p + ' PASS / ' + f + ' FAIL ===');
  process.exit(f ? 1 : 0);
});
