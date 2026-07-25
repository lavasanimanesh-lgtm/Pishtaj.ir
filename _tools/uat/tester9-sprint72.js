/* TESTER-9 — اسپرینت ۷۲ (US-149): کپچا + OTP پیامکی + قفل IP */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');

var apiCode = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var guardCode = fs.readFileSync(path.join(ROOT, 'assets/js/ptf-guard.js'), 'utf-8');
var homeCode = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
var rfqCode = fs.readFileSync(path.join(ROOT, 'rfq/index.html'), 'utf-8');
var supCode = fs.readFileSync(path.join(ROOT, 'supplier/index.html'), 'utf-8');

SECTION('US-149 AC1: کپچای سروری');
T('اکشن captcha_new موجود', apiCode.indexOf("case 'captcha_new'") > -1);
T('توکن HMAC با انقضای ۱۵ دقیقه', apiCode.indexOf('900') > -1 && apiCode.indexOf('hash_hmac') > -1 && apiCode.indexOf('captcha_token') > -1);
T('مقایسه امن (hash_equals)', apiCode.indexOf('hash_equals') > -1);
T('require_captcha روی add_rfq_site', /case 'add_rfq_site':[\s\S]{0,200}require_captcha\(\)/.test(apiCode));
T('require_captcha روی add_rfq (فرم سریع)', /case 'add_rfq':[\s\S]{0,200}require_captcha\(\)/.test(apiCode));
T('require_captcha روی add_supplier', /case 'add_supplier':[\s\S]{0,300}require_captcha\(\)/.test(apiCode));
T('پاسخ 403 بدون کپچا', apiCode.indexOf("'error' => 'captcha'") > -1);
T('otp_send هم کپچا می‌خواهد (ضد اسپم پیامکی)', /case 'otp_send':[\s\S]{0,200}require_captcha\(\)/.test(apiCode));

SECTION('US-149 AC2: OTP و شمارنده معکوس');
T('رمز ۵ رقمی تصادفی + hash (نه متن ساده)', apiCode.indexOf('random_int(0, 99999)') > -1 && apiCode.indexOf('password_hash') > -1);
T('انقضای رمز ۱۲۰ ثانیه', apiCode.indexOf("['exp'] = time() + 120") > -1);
T('اعتبارسنجی فرمت شماره (09xxxxxxxxx)', apiCode.indexOf("'/^09\\d{9}$/'") > -1);
T('otp_verify با password_verify', apiCode.indexOf('password_verify') > -1);
T('توکن OTP پس از تایید (HMAC)', apiCode.indexOf('otp_token_make') > -1 && apiCode.indexOf('otp_token_ok') > -1);
T('ویجت: شمارنده معکوس از ۱۲۰', guardCode.indexOf('countdown(d.ttl || 120)') > -1);
T('ویجت: پایان شمارنده → دکمه ارسال مجدد', guardCode.indexOf('ارسال مجدد رمز') > -1);
T('ویجت: نمایش m:ss', guardCode.indexOf("(s < 10 ? '0' : '')") > -1);

SECTION('US-149 AC3: سقف ۵ ارسال + قفل IP');
T('سقف ۵ ارسال', apiCode.indexOf(">= 5") > -1 && apiCode.indexOf('سقف ۵ بار ارسال رمز') > -1);
T('قفل ۲۴ ساعته IP', apiCode.indexOf('time() + 86400') > -1);
T('پاسخ 429 هنگام قفل', /'error' => 'locked'/.test(apiCode));
T('ذخیره‌سازی per-IP هش‌شده', apiCode.indexOf("hash('sha256', 'otp|'") > -1);
T('پاکسازی رکوردهای منقضی', apiCode.indexOf('otp_store_save') > -1 && apiCode.indexOf("lockUntil'] < time()") > -1);
T('ویجت: نمایش پیام قفل + غیرفعال‌سازی دکمه', guardCode.indexOf("d.error === 'locked'") > -1);
T('محدودیت تلاش تایید رمز (۶ بار)', apiCode.indexOf(">= 6") > -1);

SECTION('US-149 AC4: ثبت تامین‌کننده فقط با OTP معتبر');
T('سرور: با sms فعال، otp_token الزامی', apiCode.indexOf('otp_token_ok($otok, $sup_phone)') > -1);
T('پاسخ 403 بدون تایید شماره', apiCode.indexOf("'error' => 'otp'") > -1);
T('توکن به شماره همان فرم قفل است', apiCode.indexOf('$ph !== $phone') > -1);

SECTION('US-149 AC5: حالت بدون پنل پیامک');
T('sms-config خارج از webroot خوانده می‌شود', apiCode.indexOf("dirname(__DIR__, 2) . '/sms-config.php'") > -1);
T('sms_off → ثبت بدون OTP ادامه می‌یابد', apiCode.indexOf("'error' => 'sms_off'") > -1 && apiCode.indexOf('sms_enabled()') > -1);
T('sample کانفیگ پیامک موجود', fs.existsSync(path.join(ROOT, 'sms-config.sample.php')));
T('پشتیبانی کاوه‌نگار + ملی‌پیامک', apiCode.indexOf('kavenegar') > -1 && apiCode.indexOf('melipayamak') > -1);
T('درج «لغو11» در متن پیامک', apiCode.indexOf('لغو11') > -1);
T('اکشن sms_status برای ویجت', apiCode.indexOf("case 'sms_status'") > -1);
T('ویجت: حالت اطلاع‌رسانی وقتی sms خاموش', guardCode.indexOf('فعلاً ثبت‌نام با تایید کپچا') > -1);

SECTION('اتصال به ۳ فرم');
T('فرم سریع: کانتینر کپچا', homeCode.indexOf('id="hpCaptcha"') > -1);
T('فرم سریع: بلوکه بدون کپچا', homeCode.indexOf('!ptfCaptchaValid()') > -1);
T('فرم سریع: توکن به fd اضافه می‌شود', homeCode.indexOf('ptfCaptchaAppend(fd)') > -1);
T('فرم سریع: ptf-guard.js لود می‌شود', homeCode.indexOf('assets/js/ptf-guard.js') > -1);
T('استعلام هوشمند: کانتینر + گارد', rfqCode.indexOf('id="rfqCaptcha"') > -1 && rfqCode.indexOf('!ptfCaptchaValid()') > -1);
T('استعلام هوشمند: هندل 403 کپچا', rfqCode.indexOf("data.error === 'captcha'") > -1);
T('تامین‌کننده: کپچا + ویجت OTP', supCode.indexOf('id="supCaptcha"') > -1 && supCode.indexOf("ptfOtpMount('supOtp', 'sPhone')") > -1);
T('تامین‌کننده: بلوکه بدون تایید شماره', supCode.indexOf('!ptfOtpVerified()') > -1);
T('تامین‌کننده: ارسال otp_token', supCode.indexOf("fd.append('otp_token', ptfOtpToken())") > -1);
T('تامین‌کننده: هندل 403 کپچا/otp', supCode.indexOf("data.error === 'captcha' || data.error === 'otp'") > -1);

SECTION('منطق کلاینت ویجت (شبیه‌سازی)');
// شبیه‌سازی سبک ویجت کپچا
var els = {};
function mkEl(id) {
  return els[id] = els[id] || { id: id, style: {}, innerHTML: '', textContent: '', value: '', checked: false, disabled: false,
    addEventListener: function (ev, fn) { this['_' + ev] = fn; }, focus: function () {} };
}
global.document = {
  getElementById: function (id) { return els[id] || null; },
  addEventListener: function () {}
};
global.window = global;
global.location = { pathname: '/supplier/' };
global.fetch = function (url) {
  global._lastUrl = url;
  if (String(url).indexOf('captcha_new') > -1)
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, q: '3 + 4', token: 'TOK123' }); } });
  if (String(url).indexOf('sms_status') > -1)
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, enabled: false }); } });
  return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } });
};
global.FormData = function () { this.d = {}; this.append = function (k, v) { this.d[k] = v; }; };
eval.call(global, guardCode);
// mount کپچا
['cap', 'cap_chk', 'cap_box', 'cap_q', 'cap_a', 'cap_ok', 'cap_err'].forEach(mkEl);
var container = mkEl('cap');
container.addEventListener = function (ev, fn) { this['_' + ev] = fn; };
ptfCaptchaMount('cap');
T('mount: چک‌باکس «من ربات نیستم» رندر شد', container.innerHTML.indexOf('من ربات نیستم') > -1);
T('پیش از پاسخ، ptfCaptchaValid=false', ptfCaptchaValid() === false);
// شبیه‌سازی تیک + دریافت چالش
var p = els['cap_chk']._change ? (els['cap_chk'].checked = true, els['cap_chk']._change(), Promise.resolve()) : Promise.resolve();
setTimeout(function () {
  // پاسخ کاربر
  els['cap_a'].value = '7';
  if (container._input) container._input({ target: { id: 'cap_a', value: '7' } });
  T('پس از پاسخ، ptfCaptchaValid=true', ptfCaptchaValid() === true);
  var fd = new FormData();
  ptfCaptchaAppend(fd);
  T('توکن و پاسخ به FormData اضافه شد', fd.d.captcha_token === 'TOK123' && fd.d.captcha_answer === '7');

  DONE('TESTER-9 (Sprint72 Captcha/OTP)');
  process.exit(RESULTS.fail ? 1 : 0);
}, 30);
