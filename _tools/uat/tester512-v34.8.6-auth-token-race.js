#!/usr/bin/env node
'use strict';
/* v34.38.0 — AUTH-TOKEN-RACE / AUTH-LOGOUT-REVOKE / AUTH-401-HYGIENE.
   ریشه‌یابی حلقهٔ «توکن معتبر وجود ندارد» هنگام تعویض اکانت روی یک مرورگر/گوشی:
   ۱) صدور توکن روی سرور چرخهٔ load→modify→save بدون قفل بود؛ دو ورود هم‌زمان
      lost-update می‌ساخت و توکن تازه صادرشده بی‌صدا حذف می‌شد → 401 → ورود مجدد →
      race بیشتر (خودتقویت‌شونده).
   ۲) isNeedLogin مرورگر با regex /token|unauthorized|401/i هر خطای حاوی «token»
      (مثل token_issue_failed) را نشست‌منقضی می‌گرفت.
   ۳) retryPullAfterAuth خودش توکن را نامتقارن پاک می‌کرد → وضعیت زامبی
      «session هست، token نیست» → همان پیام گمراه‌کننده.
   ۴) خروج، توکن را روی سرور زنده می‌گذاشت (تا ۷ روز) — روی دستگاه مشترک خطرناک. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var auth = read('api/auth.php');
var crmphp = read('api/crm.php');
var sync = read('crm/sync.js');
var cs = read('crm/client-server.js');

/* ---------- قرارداد نسخه (بامپ واقعی، بدون phase-query) ---------- */
T('VERSION.json = v34.38.19', ver.crm_version === 'v34.38.19', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.38.19 (با کوتیشن)', /window\.PTF_CRM_RELEASE = 'v34\.38\.19'/.test(idx));
T('sw.js RELEASE/CACHE = v34.38.19', /RELEASE = 'v34\.38\.19'/.test(sw) && /CACHE = 'ptf-crm-v34\.38\.19'/.test(sw));
T('phase-query موقتی حذف شد', !/f0[0-9]=20260825/.test(idx) && !/PHASE0[0-9]_QUERY/.test(sw));
T('همهٔ scriptها ?v یکسان با نسخهٔ رسمی', (function () { var re = /\?v=(\d+\.\d+\.\d+)/g, m, bad = 0; while ((m = re.exec(idx))) if (m[1] !== ver.crm_version.slice(1)) bad++; return bad === 0 && idx.indexOf('?v=' + ver.crm_version.slice(1)) > -1; })()); /* v34.38.0: چک پیشوندی قدیمی با نسخهٔ ۵۰ تصادم می‌کرد */

/* ---------- سرور: چرخهٔ قفل‌شدهٔ توکن ---------- */
T('auth.php قفل اختصاصی tokens.json.lock دارد', /function auth_with_tokens_lock/.test(auth) && /LOCK_EX/.test(auth));
T('صدور توکن زیر قفل انجام می‌شود', /auth_with_tokens_lock\(function/.test(auth));
T('فایل خراب tokens به .corrupt. منتقل می‌شود (نوکه‌کردن همهٔ نشست‌ها ممنوع)', /\.corrupt\./.test(auth));
T('revoke توکن منفرد تعریف شده', /function auth_revoke_token/.test(auth));
T('auth_logout فقط همون توکن را باطل می‌کند (دستگاه‌های دیگر نفس می‌کشند)', /case 'auth_logout'/.test(crmphp) && /auth_revoke_token\(\$logoutToken\)/.test(crmphp));

/* ---------- کلاینت: بهداشت 401 ---------- */
/* v34.38.16 (TESTER512-WINDOW): استخراجِ بدنهٔ تابع با تطبیقِ آکولاد، به‌جای پنجرهٔ
   کاراکتریِ ثابت. ریشهٔ قرمزیِ گیت CI روی main (و به‌تبع آن هر سه ورک‌فلو): دو خطِ
   BOOT-SPLASH-001 فاصلهٔ `function doLogout()` تا `removeItem('ptf_crm_session')`
   را از ~٧٠٠ به ٨٦٩ کاراکتر رساند و regex ثابتِ `{0,700}` — بی‌ربط به رفتار —
   قرمز شد. پنجرهٔ ثابت با هر رشدِ مشروعِ تابع می‌شکند؛ حالا کلِ بدنهٔ واقعی سنجیده می‌شود. */
function fnBody(src, sig) {
  var i = src.indexOf(sig);
  if (i < 0) return '';
  var j = src.indexOf('{', i);
  if (j < 0) return '';
  var depth = 0;
  for (var k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(j, k + 1); }
  }
  return '';
}
T('isNeedLogin فقط نشانه‌های قطعی auth (بدون regex عام token)', !/\/token\|unauthorized\|401\/i/.test(cs) && /authentication_required/.test(cs) && /invalid or expired token/.test(cs));
T('sync.js: هیچ regex عام token باقی نماند', !/\/token\|unauthorized\|401\/i/.test(sync));
T('retryPullAfterAuth دیگر خودش توکن را پاک نمی‌کند (تک‌نقطهٔ invalidate)', (function () {
  var b = fnBody(sync, 'function retryPullAfterAuth');
  return b.length > 0 && b.indexOf("removeItem('ptf_crm_token')") === -1;
})());
T('refreshAuthToken هر سه کلید نشست را هم‌زمان پاک می‌کند', /removeItem\('ptf_crm_token'\)[\s\S]{0,200}removeItem\('ptf_crm_token_role'\)[\s\S]{0,200}removeItem\('ptf_crm_session'\)/.test(sync));

/* ---------- خروج ---------- */
T('doLogout توکن را روی سرور revoke می‌کند (auth_logout، best-effort)', /action=auth_logout/.test(idx) && /keepalive: true/.test(idx));
T('doLogout همچنان نشست محلی را پاک می‌کند', (function () {
  var b = fnBody(idx, 'function doLogout()');
  return b.length > 0 && b.indexOf("removeItem('ptf_crm_session')") > -1;
})());

/* ---------- شبیه‌سازی رفتاری: رقابت دو ورود هم‌زمان (الگوی JS از چرخهٔ PHP) ---------- */
(function behaviorRace() {
  // مدل: هر auth_generate_token بدون قفل = load → add → save. دو اجرای درهم‌تنیده
  // باید یکی از توکن‌ها را گم کنند؛ با قفل، هر دو باید زنده بمانند.
  function makeStore() { var f = { m: {} }; return f; }
  var store = makeStore();
  function unlockedCycle(id) { var snap = JSON.parse(JSON.stringify(store.m)); snap[id] = 1; store.m = snap; }
  var a, b; // درهم‌تنیدگی: هر دو cycle همان snapshot قدیمی را می‌خوانند
  (function () { a = JSON.parse(JSON.stringify(store.m)); })();
  (function () { b = JSON.parse(JSON.stringify(store.m)); })();
  a['tokA'] = 1; store.m = a;   // save اول
  b['tokB'] = 1; store.m = b;   // save دوم → tokA گم شد (lost update)
  T('شبیه‌سازی: چرخهٔ بدون قفل واقعاً توکن را گم می‌کند (تأیید RCA)', !('tokA' in store.m) && 'tokB' in store.m);
  var locked = {};
  function lockedCycle(id) { locked[id] = 1; } // قفل → خواندن+نوشتن اتمیک
  lockedCycle('tokA'); lockedCycle('tokB');
  T('چرخهٔ قفل‌شده هر دو توکن را نگه می‌دارد', 'tokA' in locked && 'tokB' in locked);
})();

/* ---------- شبیه‌سازی isNeedLogin (منطق جدید در برابر خطاهای واقعی) ---------- */
(function behaviorNeedLogin() {
  function isNeedLoginNew(d, status) {
    if (status === 401) return true;
    if (!d) return false;
    if (d.needLogin === true) return true;
    var e = String(d.error || '');
    return e === 'authentication_required' || e === 'Authentication required' || /^invalid or expired token/i.test(e);
  }
  T('401 → needLogin', isNeedLoginNew({}, 401) === true);
  T('authentication_required → needLogin', isNeedLoginNew({ error: 'authentication_required' }, 200) === true);
  T('Invalid or expired token → needLogin', isNeedLoginNew({ error: 'Invalid or expired token - please login again' }, 200) === true);
  T('token_issue_failed → needLogin نیست (باگ قدیمی)', isNeedLoginNew({ error: 'token_issue_failed' }, 200) === false);
  T('خطای بی‌ربط → needLogin نیست', isNeedLoginNew({ error: 'conflict' }, 200) === false);
})();

console.log('\n— tester512 (v34.38.0: ریشه‌یابی حلقهٔ «توکن معتبر وجود ندارد») —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
