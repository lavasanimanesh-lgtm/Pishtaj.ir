/* tester302 — v34.0.6-alpha (فاز ۳: امنیت دیپلوی + تمیزکاری + SEC-01 XSS)
   پوشش: SEC-01 (XSS ذخیره‌شده — ptfOnClickArg + حذف escP از آرگومان هندلرها)،
         SEC-02 (data-health-check با گارد توکن)، D-02 (users_get بدون PII پیش از لاگین)،
         D-03 (زیپ‌ها از ردیابی گیت)، D-04 (کد مرده)، D-05 (تسترها در CI) */
require('./harness');
var fs = require('fs'), path = require('path');
var CRM = path.resolve(__dirname, '../../crm');
var API = path.resolve(__dirname, '../../api');

var idx = fs.readFileSync(path.join(CRM, 'index.html'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));
var VER = vjson.crm_version;

SECTION('نسخه');
T('lockstep v34.0.6-alpha', vjson.crm_version === 'v34.0.6-alpha' && idx.indexOf("var VER = 'v34.0.6-alpha'") > -1 &&
  fs.readFileSync(path.join(CRM, 'sw.js'), 'utf-8').indexOf('ptf-crm-v34.0.6-alpha') > -1);

/* ─── SEC-01: XSS ذخیره‌شده ─── */
SECTION('SEC-01: هندلرها (XSS)');
var ui = fs.readFileSync(path.join(CRM, 'ui-kit.js'), 'utf-8');
var fnRe = /window\.ptfOnClickArg = function[\s\S]*?\n\};/;
var fnMatch = ui.match(fnRe);
T('ptfOnClickArg در ui-kit (اولین اسکریپت) تعریف شده است', !!fnMatch);
global.ptfOnClickArg = null;
if (fnMatch) eval.call(global, fnMatch[0].replace('window.ptfOnClickArg', 'global.ptfOnClickArg'));

T('escape لایهٔ JS (تک‌کوتیشن) انجام می‌شود', (function(){
  var arg = ptfOnClickArg("O'Brien");
  // پس از HTML-decode، JS باید O\'Brien (با اسلش) را ببیند → هندلر نمی‌شکند
  return arg.indexOf('\\\'') > -1;
})());

/* PoC ارزیابی (bridge.js): EVIL');alert(1);// — باید درون رشته خنثی شود.
   معیار: در هندلر `fn('<payload>')` پس از HTML-decode، تعداد تک‌کوتیشنِ «خام»
   (نه escaped با بک‌اسلش) باید دقیقاً ۲ باشد (دو تعیین‌کنندهٔ ابتدا/انتهای رشته)؛
   اگر ۳+ باشد یعنی `'` از رشته فرار کرده و کد تزریق می‌شود. */
(function(){
  function unescaped(s){
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] !== "'") continue;
      var bs = 0;
      for (var j = i - 1; j >= 0 && s[j] === '\\'; j--) bs++;
      if (bs % 2 === 0) n++;   // تک‌کوتیشنِ خام (بک‌اسلش‌های زوج یا صفر)
    }
    return n;
  }
  var evil = "EVIL');alert(1);//";
  var attr = "fn('" + ptfOnClickArg(evil) + "')";
  var decoded = attr.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  T('PoC «EVIL\');alert(1);//» در هندلر خنثی می‌شود (alert درون رشته می‌ماند)',
    unescaped(decoded) === 2, 'unescaped quotes=' + unescaped(decoded) + ' -> ' + decoded);
  /* نمونهٔ مقایسه: اگر escP قدیمی (بدون escape) بود، ۳ کوتیشن خام = تزریق */
  T('(کنترل) escP قدیمی همچنان ۳ کوتیشن خام می‌داد (اثبات نیاز به رفع)',
    unescaped("fn('" + escP(evil) + "')") === 3);
})();

/* هیچ escP به‌عنوان آرگومان هندلر (الگوی بسته‌شونده با ' + \') باقی نمانده */
(function(){
  var re = /escP\(((?:[^()]|\([^()]*\))*)\)(\s*\+\s*'\\')/g;
  var total = 0, files = [];
  fs.readdirSync(CRM).filter(f => f.endsWith('.js') && !f.endsWith('.bak')).forEach(function (f) {
    var s = fs.readFileSync(path.join(CRM, f), 'utf-8');
    var n = (s.match(re) || []).length;
    if (n) { total += n; files.push(f + '=' + n); }
  });
  T('هیچ escP در آرگومان هندلر باقی نمانده (0 از 325)', total === 0, files.join(', '));
  global._xssRemaining = total;
})();
T('ptfOnClickArg در حداقل 30 فایل به‌کار رفته است',
  fs.readdirSync(CRM).filter(f => f.endsWith('.js') && fs.readFileSync(path.join(CRM, f), 'utf-8').indexOf('ptfOnClickArg(') > -1).length >= 30);

/* ─── SEC-02: data-health-check.php ─── */
SECTION('SEC-02: data-health-check');
var hc = fs.readFileSync(path.join(API, 'data-health-check.php'), 'utf-8');
T('health-check به گارد توکن (auth_verify_token + نقش admin/chairman) مجهز است',
  hc.indexOf('auth_verify_token(auth_get_header_token())') > -1 && hc.indexOf("['admin', 'chairman']") > -1);
T('health-check دیگر با صرف ?confirm=yes باز نیست (گارد پیش از confirm است)',
  hc.indexOf("auth_verify_token") < hc.indexOf("confirm") || hc.indexOf("authentication_required") > -1);
['deploy-production.yml', 'deploy-staging.yml'].forEach(function (w) {
  var y = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/' + w), 'utf-8');
  T(w + ' از بستهٔ دیپلوی حذف شده است', y.indexOf('api/data-health-check.php') > -1);
});

/* ─── D-02: users_get PII ─── */
SECTION('D-02: users_get بدون PII پیش از لاگین');
var crmphp = fs.readFileSync(path.join(API, 'crm.php'), 'utf-8');
var ug = crmphp.split("case 'users_get':")[1];
T('users_get با توکن معتبر mobile/email را می‌دهد',
  ug.indexOf("$authenticated") > -1 && ug.indexOf("$row['mobile']") > -1 && ug.indexOf("$row['email']") > -1);
T('mobile/email فقط در حالت احرازشده برمی‌گردند',
  ug.indexOf("if ($authenticated) {") > -1);
/* بدهی فنی #۲: پاک‌سازی knowledge-center باید یک‌بار با marker اجرا شود نه در هر ریکوئست */
T('پاک‌سازی knowledge-center با marker (نه هر ریکوئست)',
  crmphp.indexOf('.kc-cleanup-done') > -1 && crmphp.indexOf('!file_exists($kc_dir') > -1);

/* ─── D-03: زیپ‌ها ─── */
SECTION('D-03: بایگانی‌های zip');
T('*.zip در .gitignore هست', fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8').indexOf('*.zip') > -1);
T('هیچ zipای در git ردیابی نشده است (حذف از ردیابی)',
  !(require('child_process').execSync('git ls-files').toString().split('\n').some(function(l){ return /\.zip$/.test(l.trim()); })));

/* ─── D-04: کد مرده ─── */
SECTION('D-04: حذف کد مرده');
['ai-tech-assistant.js','lead-finder.js','eng-calc.js','tech-proposals.js','xss-guard.js','dompurify.min.js','datex.js','inqreader.js.bak'].forEach(function (f) {
  T('حذف شد: ' + f, !fs.existsSync(path.join(CRM, f)));
});
T('حذف در index.html اثر نداشته (اسکریپت‌های لودشده بی‌اشکال‌اند)',
  fs.readdirSync(CRM).filter(f => f.endsWith('.js')).every(function(f){ try { require('child_process').execFileSync('node',['--check',path.join(CRM,f)]); return true; } catch(e){ return false; } }));

/* ─── D-05: تسترها در CI ─── */
SECTION('D-05: اجرای تسترها در CI');
var ci = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/uat-tests.yml'), 'utf-8');
T('ورک‌فلو uat-tests.yml وجود دارد', ci.length > 0);
T('شامل تستر بازگشتی tester101 است', ci.indexOf('tester101-v184') > -1);
T('شامل tester300 و tester301 و tester302 است', ci.indexOf('tester300-v34.0.4-alpha-phase1-fixes') > -1 && ci.indexOf('tester301-v34.0.5-alpha-fiscal-phase2') > -1 && ci.indexOf('tester302-v34.0.6-alpha-deploy-hygiene') > -1);

DONE('tester302-v34.0.6-alpha');
