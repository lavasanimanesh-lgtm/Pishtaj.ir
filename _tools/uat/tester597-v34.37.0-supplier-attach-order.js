#!/usr/bin/env node
'use strict';
/* ═══ tester597 — v34.38.0 (SUP-UPLOAD-ORDER + SUP-ATTACH-PHONE + SUP-DEDUP-BEST) ═══
   گزارش کارفرما: «در صفحهٔ تامین‌کنندگان وبسایت، در فرم ثبت‌نام، فایل اضافه نمی‌شود.»

   v34.36.2 «موفقیتِ سبزِ بی‌صدا» را بسته بود، ولی سه نقصِ باقی‌مانده هنوز همان تجربه
   را تولید می‌کرد و tester589 (که فقط رشته می‌سنجید) سبز بود:
   D1 save_attachment «پیش از» شاخهٔ duplicate اجرا می‌شد ⇒ فایل واقعاً روی فضای ابری
      نوشته می‌شد و بعد پاسخ ok:false duplicate صادر می‌شد بدون هیچ ارجاعی به آن
      آبجکت: هم آبجکتِ یتیمِ پولی روی آروان، هم «فایلم رفت و هیچ‌جا نیست» برای کاربر.
   D2 گاردِ بازیابیِ پیوست فقط فیلد phone را می‌سنجید، در حالی که تشخیصِ تکراری روی
      phone/ph/mob است ⇒ اگر تطابق روی ph/mob بود، «ارسال دوبارهٔ فایل» همیشه
      duplicate می‌گرفت و فایل هرگز قابل رساندن نبود.
   D3 حلقهٔ dedup روی «اولین تطابق» می‌شکست ⇒ اگر شرکت دو ثبت‌نام داشت و اولی پیوست
      داشت، رکورد دومِ بی‌پیوست هرگز شانس بازیابی نمی‌گرفت.
   D4 accept فیلد فایل با allowlist سرور یکی نبود (تصویر مجاز بود ولی انتخاب نمی‌شد).
   D5 هیچ ردّ سمت‌سروری پایداری برای شکست پیوست وجود نداشت. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var api = read('api/crm.php');
var sup = read('supplier/index.html');
var AS = api.slice(api.indexOf("case 'add_supplier':"), api.indexOf("case 'track':"));
T('۰.۱ بلوک add_supplier پیدا شد', AS.length > 2000);

/* ── D1: ترتیب — هیچ آپلودی در مسیری که به duplicate می‌رسد ── */
T('۱.۱ پیش از آپلود مشخص می‌شود که درخواست اصلاً مقصدی دارد یا نه ($supWillReject)',
  AS.indexOf('$supWillReject = ($dupFound && !$supReopenEligible && !$supRecoveryEligible)') > -1);
T('۱.۲ save_attachment فقط وقتی صدا زده می‌شود که رد نخواهد شد',
  /if \(!\$supWillReject\) \{\s*\$attachment = save_attachment\('attachment', 'ven', \$attachmentError, \$attachmentDiag\);\s*\}/.test(AS));
T('۱.۳ محاسبهٔ $supWillReject قبل از فراخوانی save_attachment است (ترتیب واقعی سورس)',
  AS.indexOf('$supWillReject =') < AS.indexOf("save_attachment('attachment', 'ven'"));
T('۱.۴ پاسخ duplicate صریحاً می‌گوید فایل ذخیره نشد',
  AS.indexOf("'attachmentStored' => false") > -1 && AS.indexOf('فایل پیوست شما ذخیره نشد') > -1);
T('۱.۵ پاسخ duplicate راه جبران را هم می‌گوید (ایمیل/واتساپ با کد)',
  /فایل را با ذکر کد[\s\S]{0,120}واتساپ/.test(AS));
T('۱.۶ فقط وقتی کاربر واقعاً فایل اعلام کرده این هشدار اضافه می‌شود',
  /if \(\$supDeclFile\) \{\s*\$dupMsg \.=/.test(AS));

/* ── D2: تطابق شماره روی هر سه فیلدی که dedup می‌سنجد ── */
T('۲.۱ $supPhoneMatchesDup روی phone/ph/mob محاسبه می‌شود',
  /foreach \(\[\$supDupRow\['phone'\] \?\? '', \$supDupRow\['ph'\] \?\? '', \$supDupRow\['mob'\] \?\? ''\] as \$dp\)/.test(AS));
T('۲.۲ نرمال‌سازی همان ptf_dedup_phone است (نه مقایسهٔ خام)',
  /ptf_dedup_phone\(\$dp\) === \$supPhoneNorm/.test(AS));
T('۲.۳ شرط بازیابی از همان نتیجه استفاده می‌کند', /\$supRecoveryEligible = \([\s\S]{0,400}\$supPhoneMatchesDup\)/.test(AS));
T('۲.۴ گاردِ «پیوست موجود هرگز بازنویسی نمی‌شود» دست‌نخورده است',
  /\$supRecoveryEligible = \([\s\S]{0,400}empty\(\$supDupRow\['attachment'\]\)/.test(AS));
T('۲.۵ بازیابی همچنان فقط برای ثبت‌نام‌های سایت با وضعیت pending/rejected است',
  /\$supRecoveryEligible = \([\s\S]{0,300}=== 'suppliers'[\s\S]{0,200}\['pending', 'rejected'\]/.test(AS));
T('۲.۶ بازیابی فقط وقتی فایل سالم ذخیره شده اجرا می‌شود',
  AS.indexOf('if ($supRecoveryEligible && $attachment !== null)') > -1);

/* ── D3: انتخاب بهترین رکورد تکراری به‌جای اولین ── */
T('۳.۱ همهٔ تطابق‌ها جمع می‌شوند (نه break روی اولی)', AS.indexOf('$supMatches[] =') > -1);
T('۳.۲ رکورد pending/rejected بدون پیوست ترجیح داده می‌شود',
  /foreach \(\$supMatches as \$m\) \{\s*if \(in_array\(\(\$m\['row'\]\['status'\] \?\? ''\), \['pending','rejected'\], true\) && empty\(\$m\['row'\]\['attachment'\]\)\)/.test(AS));
T('۳.۳ در نبود نامزد بهتر، رفتار قبلی (اولین تطابق) حفظ می‌شود',
  AS.indexOf('if (!$dupFound && $supMatches) $dupFound = $supMatches[0];') > -1);
T('۳.۴ فهرست تاییدشدهٔ CRM فقط وقتی بررسی می‌شود که ثبت‌نام سایتی پیدا نشده باشد',
  AS.indexOf('$supMatches[0];') < AS.indexOf("load_data('ptf_crm_suppliers')"));

/* ── D4: هم‌ترازی accept با allowlist سرور و ATTACH_EXT ── */
(function () {
  var srvList = (api.match(/\$allowed = \[([^\]]+)\]/) || [])[1] || '';
  var srvExt = (srvList.match(/'([a-z0-9]+)'/g) || []).map(function (x) { return x.replace(/'/g, ''); });
  T('۴.۰ allowlist سرور استخراج شد', srvExt.length >= 10, JSON.stringify(srvExt));
  var accept = (sup.match(/name="attachment" accept="([^"]+)"/) || [])[1] || '';
  var acceptExt = accept.split(',').map(function (x) { return x.trim().replace(/^\./, ''); }).filter(Boolean);
  var jsList = (sup.match(/ATTACH_EXT = \[([^\]]+)\]/) || [])[1] || '';
  var jsExt = (jsList.match(/'([a-z0-9]+)'/g) || []).map(function (x) { return x.replace(/'/g, ''); });
  var same = function (a, b) { return a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(','); };
  T('۴.۱ accept فیلد فایل دقیقاً با allowlist سرور یکی است',
    same(acceptExt, srvExt), 'accept=' + acceptExt.join(',') + ' | server=' + srvExt.join(','));
  T('۴.۲ ATTACH_EXT کلاینت هم با همان فهرست یکی است',
    same(jsExt, srvExt), 'js=' + jsExt.join(',') + ' | server=' + srvExt.join(','));
  T('۴.۳ تصویر (jpg/png/webp) در هر سه‌جا مجاز است — کاربر می‌تواند عکس کاتالوگ بفرستد',
    ['jpg', 'png', 'webp'].every(function (x) { return acceptExt.indexOf(x) > -1 && srvExt.indexOf(x) > -1 && jsExt.indexOf(x) > -1; }));
})();

/* ── D5: ردّ سمت سروری ── */
T('۵.۱ شکست پیوست در error_log سرور ثبت می‌شود', AS.indexOf("@error_log('[PTF supplier-attach] '") > -1);
T('۵.۲ لاگ شامل تشخیص محدودیت‌های میزبان است', /error_log\([\s\S]{0,300}ptf_upload_limits_diag\(\)/.test(AS));
T('۵.۳ لاگ هیچ کلید/رمزی ندارد (فقط متادیتای محدودیت‌ها)',
  ['access_key', 'secret_key', 'password', '$_POST['].every(function (bad) {
    var i = AS.indexOf("@error_log('[PTF supplier-attach] '");
    return AS.slice(i, i + 400).indexOf(bad) === -1;
  }));

/* ── بدون رگرسیون: قراردادهای v34.36.2 دست‌نخورده ── */
T('۶.۱ کپچا و OTP همچنان پیش از هر چیز الزامی‌اند',
  AS.indexOf('require_captcha();') > -1 && AS.indexOf('otp_token_ok($otok, $sup_phone)') > -1);
T('۶.۲ رسید پیوست همچنان در پاسخ برمی‌گردد', AS.indexOf('$attachmentReceipt') > -1);
T('۶.۳ «موفقیت بی‌صدا» همچنان ممنوع است', AS.indexOf('فایل انتخاب‌شده به سرور نرسید') > -1);
T('۶.۴ مسیر reopen (تکمیل مدارک) حفظ شد', AS.indexOf("'reopened' => true") > -1 && AS.indexOf('$supReopenEligible') > -1);
T('۶.۵ مسیر SUP-ATTACH-RECOVERY حفظ شد', AS.indexOf("'attached' => true") > -1);
T('۶.۶ دکمهٔ «ارسال دوبارهٔ فایل» در صفحه هست', sup.indexOf('ptfSupplierRetryAttach') > -1);
T('۶.۷ مسیر پیوست همچنان فقط فضای ابری است (بدون نوشتن روی دیسک میزبان)',
  api.indexOf('ptf_storage_put_uploaded_file($_FILES[$field]') > -1 && AS.indexOf('move_uploaded_file') === -1);

console.log('\n— tester597 (v34.38.0: ترتیب آپلود/تکراری + بازیابی پیوست + هم‌ترازی فرمت‌ها) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
if (f) process.exit(1);
