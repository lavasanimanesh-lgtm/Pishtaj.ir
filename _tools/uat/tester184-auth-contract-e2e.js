/* tester183 — v31.7.8 (INC-2026-001: تست قرارداد احراز هویت end-to-end)
 * درس incident BUG-AUTH-001: در v31.7.4 سرور HMAC(IP) می‌خواست و فرانت JWT می‌فرستاد؛
 * ۱۶۱ تستر استاتیک این ناسازگاری runtime را نگرفتند.
 * این تستر در صورت وجود PHP، سرور واقعی بالا می‌آورد و مسیر کامل
 * login → token → data_pull را با HTTP واقعی اجرا می‌کند.
 * در نبود PHP، به حالت static-contract سقوط می‌کند (بهتر از هیچ، ولی کافی نیست). */
require('./harness');
var fs = require('fs'), path = require('path'), os = require('os');
var cp = require('child_process');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var auth = fs.readFileSync(path.join(ROOT, 'api/auth.php'), 'utf-8');
var bridge = fs.readFileSync(path.join(ROOT, 'crm/bridge.js'), 'utf-8');
var sync = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');

SECTION('قرارداد استاتیک: هر دو سمت یک مکانیزم توکن');
T('verify_request از auth_verify_token (JWT) استفاده می‌کند نه HMAC استاتیک IP',
  /function verify_request\(\)[\s\S]{0,1500}auth_verify_token\(\$token\)/.test(api) &&
  !/function verify_request\(\)[\s\S]{0,1200}hash_hmac\('sha256',\s*\$_SERVER\['REMOTE_ADDR'\]/.test(api));
T('users_get در public_actions است (لاگین قبل از وجود توکن)',
  /\$public_actions\s*=\s*\[[^\]]*'users_get'/.test(api));
T('data_rev در public_actions است', /\$public_actions\s*=\s*\[[^\]]*'data_rev'/.test(api));
T('bridge.js هدر X-CRM-Token می‌فرستد', /X-CRM-Token/.test(bridge));
T('sync.js هدر X-CRM-Token می‌فرستد', /X-CRM-Token/.test(sync));
T('auth_login از sync directory هم می‌خواند', /sync\/ptf_crm_users\.json/.test(api));

SECTION('قرارداد runtime: اجرای واقعی login → token → pull');
var phpBin = null;
try { cp.execSync('php -v', { stdio: 'ignore' }); phpBin = 'php'; } catch (e) {}

function done() { DONE('tester184-auth-contract-e2e'); }

if (!phpBin) {
  T('PHP در دسترس نیست — فقط قرارداد استاتیک بررسی شد (E2E روی CI/staging اجرا شود)', true);
  done();
} else {
  var crypto = require('crypto');
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-e2e-'));
  cp.execSync('cp -r ' + JSON.stringify(path.join(ROOT, 'api')) + ' ' + JSON.stringify(path.join(ROOT, 'crm')) + ' ' + JSON.stringify(tmp));
  fs.mkdirSync(path.join(tmp, 'crm/data/sync'), { recursive: true });
  var ph = crypto.createHash('sha256').update('e2e-pass-1234').digest('hex');
  fs.writeFileSync(path.join(tmp, 'crm/data/sync/ptf_crm_users.json'),
    JSON.stringify([{ username: 'e2euser', name: 'E2E', passhash: ph, roleId: 'sales', role: 'sales' }]));
  var port = 18000 + Math.floor(Math.random() * 2000);
  var srv = cp.spawn(phpBin, ['-S', '127.0.0.1:' + port, '-t', tmp], { stdio: 'ignore' });
  var B = 'http://127.0.0.1:' + port + '/api/crm.php';

  (async function () {
    try {
      // انتظار برای بالا آمدن سرور
      var up = false;
      for (var i = 0; i < 20 && !up; i++) {
        await new Promise(function (r) { setTimeout(r, 250); });
        try { var r0 = await fetch(B + '?action=data_rev'); up = r0.status === 200; } catch (e) {}
      }
      T('سرور PHP بالا آمد و data_rev بدون توکن 200 است', up);

      var rNoTok = await fetch(B + '?action=data_pull');
      var jNoTok = await rNoTok.json().catch(function () { return {}; });
      T('data_pull بدون توکن → 401 + needLogin', rNoTok.status === 401 && jNoTok.needLogin === true);

      var rUsers = await fetch(B + '?action=users_get');
      var jUsers = await rUsers.json().catch(function () { return {}; });
      T('users_get بدون توکن 200 و بدون passhash', rUsers.status === 200 &&
        jUsers.ok === true && JSON.stringify(jUsers).indexOf('passhash') === -1);

      var rLogin = await fetch(B, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=auth_login&username=e2euser&passhash=' + ph });
      var jLogin = await rLogin.json().catch(function () { return {}; });
      T('auth_login با اعتبار درست توکن می‌دهد', jLogin.ok === true && !!jLogin.token);

      var rBad = await fetch(B, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=auth_login&username=e2euser&passhash=' + '0'.repeat(64) });
      var jBad = await rBad.json().catch(function () { return {}; });
      T('auth_login با رمز غلط رد می‌شود', jBad.ok === false);

      // ⭐ همان فراخوانی که در v31.7.4 صددرصد 401 می‌گرفت:
      var rPull = await fetch(B + '?action=data_pull', { headers: { 'X-CRM-Token': jLogin.token || '' } });
      T('data_pull با توکن صادرشده از auth_login → 200 (قلب قرارداد BUG-AUTH-001)', rPull.status === 200);

      var rGarb = await fetch(B + '?action=data_pull', { headers: { 'X-CRM-Token': 'invalid.garbage' } });
      T('data_pull با توکن جعلی → 401', rGarb.status === 401);

      var jPull = await rPull.json().catch(function () { return {}; });
      var pulledKeys = Object.keys(jPull.data || {});
      var finLeak = pulledKeys.filter(function (k) {
        return ['ptf_crm_finance', 'ptf_crm_cheques', 'ptf_crm_payables', 'ptf_crm_shareholders'].indexOf(k) > -1;
      });
      T('role-scoping: نقش sales هیچ کلید مالی دریافت نمی‌کند', finLeak.length === 0);

      var rEv = await fetch(B + '?action=get_events&since=0', { headers: { 'X-CRM-Token': jLogin.token || '' } });
      T('get_events با توکن → 200 (مسیر bridge.js)', rEv.status === 200);
    } catch (e) {
      T('اجرای E2E بدون خطای غیرمنتظره', false, String(e && e.message || e));
    } finally {
      try { srv.kill(); } catch (e) {}
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
      done();
    }
  })();
}
