/* =====================================================================
   tester589 — v34.38.0 (SUP-UPLOAD-RCA): «در صفحهٔ ثبت‌نام تامین‌کنندگان فایل آپلود نمی‌شود»
   ---------------------------------------------------------------------
   شکایت مالک: فایل انتخاب می‌شد، ثبت‌نام «سبز و موفق» نشان داده می‌شد، هیچ
   هشداری نبود و در CRM «بدون ضمیمه» می‌ماند.

   RCA (سه حلقهٔ مستقل که با هم «آپلود نشدنِ بی‌صدا» را می‌ساختند):
     A1) save_attachment در api/crm.php وقتی $_FILES خالی بود «بی‌صدا» null
         می‌داد و $error را پر نمی‌کرد ⇒ add_supplier ok:true بدون پیوست.
         علت‌های ممکن روی میزبان: file_uploads=Off، بزرگ‌تر بودن بدنه از
         post_max_size (PHP کل $_POST/$_FILES را دور می‌ریزد)، یا پروکسی/CDN/
         فیلتر امنیتی که بخش فایلِ multipart را می‌برد.
     A2) خطاهای کدِ آپلود PHP (UPLOAD_ERR_*) به پیام کلی «حجم فایل» فروکاسته
         می‌شد ⇒ کاربر/پشتیبانی علت واقعی را نمی‌دید.
     A3) ترتیب صندوق: رکوردها در suppliers.json به ترتیب ثبت (قدیمی‌ترین اول)
         ذخیره می‌شوند و get_inbox با limit=50&offset=0 «قدیمی‌ترین ۵۰» را
         می‌داد ⇒ ثبت‌نام تازه (و پیوستش) در صفحهٔ آخر بود و مدیر تا کلیک‌های
         مکرر «نمایش بیشتر» آن را نمی‌دید.
     A4) اگر فایل بار اول نمی‌رسید، ارسال مجدد فقط خطای duplicate می‌گرفت ⇒
         هیچ راهی برای رساندن فایل به همان کد رهگیری نبود.

   این تستر دو بخش دارد:
     ۱) رفتاری — اسکریپتِ داخل supplier/index.html در VM با DOM و fetch ساختگی
        اجرا می‌شود: رسید سبز پیوست، جعبهٔ قرمز «فایل نرسید» + علت + دکمهٔ
        ارسال دوباره، اعلام attachment_name/size به سرور، گیت محلی حجم/فرمت،
        و رفتار دکمهٔ تلاش دوباره.
     ۲) پینِ منبع — قرارداد سرور (crm.php)، نمایش CRM (bridge.js) و اعلام فایل
        در فرم‌های استعلام (rfq/index.html و index.html) قفل می‌شود.
     ۳) پورت JS از ptf_rows_newest_first برای اثبات «جدیدترین اول» در صفحهٔ اول.

   هیچ فایل مخزنی را تغییر نمی‌دهد؛ فقط fixture در حافظه.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');

var supSrc = fs.readFileSync('supplier/index.html', 'utf8');
var api = fs.readFileSync('api/crm.php', 'utf8');
var bridge = fs.readFileSync('crm/bridge.js', 'utf8');
var rfqSrc = fs.readFileSync('rfq/index.html', 'utf8');
var homeSrc = fs.readFileSync('index.html', 'utf8');
var gate = fs.readFileSync('_tools/uat/run-ci-gate.js', 'utf8');
var ver = JSON.parse(fs.readFileSync('VERSION.json', 'utf8'));

var p = 0, f = 0;
function T(name, cond, extra) {
  if (cond) { p++; console.log('PASS ' + name); }
  else { f++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function blk(src, a, b) {
  var i = src.indexOf(a);
  if (i < 0) return '';
  var j = b ? src.indexOf(b, i + a.length) : -1;
  return j > i ? src.slice(i, j) : src.slice(i);
}

/* ---------- استخراج اسکریپتِ کلاینتِ صفحهٔ ثبت‌نام ---------- */
var CLIENT = blk(supSrc, "const form = document.getElementById('supplierForm');", "\n  </script>\n<script>(function(){var t=document.getElementById('menuToggle')");

/* ---------- DOM ساختگی ---------- */
function makeEl(id, extra) {
  var el = {
    id: id, value: '', textContent: '', innerHTML: '', className: '', disabled: false,
    style: {}, dataset: {}, files: null, __l: {},
    addEventListener: function (t, fn) { (this.__l[t] = this.__l[t] || []).push(fn); },
    scrollIntoView: function () { this.__scrolled = true; },
    focus: function () { this.__focused = true; },
    querySelector: function (sel) { return (this.__q && this.__q[sel]) || null; },
    getAttribute: function () { return null; }
  };
  for (var k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) el[k] = extra[k];
  return el;
}

function FakeFormData(form) {
  this.__m = {};
  /* رفتار مرورگر: new FormData(form) همهٔ فیلدهای نام‌دار + ورودی فایل را در بدنه می‌گذارد */
  if (form && form.__named) {
    for (var n in form.__named) {
      if (!Object.prototype.hasOwnProperty.call(form.__named, n)) continue;
      var e = form.__named[n];
      this.__m[n] = (e && typeof e.value === 'string') ? e.value : '';
    }
  }
  if (form && form.__files) for (var k in form.__files) if (Object.prototype.hasOwnProperty.call(form.__files, k)) this.__m[k] = form.__files[k];
}
FakeFormData.prototype.append = function (k, v) { this.__m[k] = String(v); };
FakeFormData.prototype.set = FakeFormData.prototype.append;
FakeFormData.prototype.get = function (k) { return Object.prototype.hasOwnProperty.call(this.__m, k) ? this.__m[k] : null; };
FakeFormData.prototype.has = function (k) { return Object.prototype.hasOwnProperty.call(this.__m, k); };

var els = {};
function reg(el) { els[el.id] = el; return el; }

var fileInput = reg(makeEl('sAttach'));
var form = reg(makeEl('supplierForm', { action: '../api/crm.php?action=add_supplier', __files: {} }));
form.__q = { 'input[type="file"][name="attachment"]': fileInput };
['supStatus', 'sComp', 'sName', 'sPhone', 'sCat', 'sBrands', 'sPayTerms', 'sCreditRange',
 'sPayScoreHint', 'sCode', 'sSubmit', 'venCode', 'venWarning', 'venAttach', 'resBox'].forEach(function (id) { reg(makeEl(id)); });
form.__named = { code: els.sCode, company: els.sComp, name: els.sName, phone: els.sPhone, category: els.sCat, brands: els.sBrands, payTerms: els.sPayTerms, creditRange: els.sCreditRange };

var fetchCalls = [];
var nextResponse = null;
function fakeFetch(url, opts) {
  fetchCalls.push({ url: String(url), body: (opts && opts.body) || null });
  var r = nextResponse || { status: 200, ok: true, json: { ok: true, code: 'PTF-VEN-DEFAULT' } };
  var bodyText = (typeof r.text === 'string') ? r.text : JSON.stringify(r.json || {});
  return Promise.resolve({
    ok: r.ok !== false, status: r.status || 200,
    text: function () { return Promise.resolve(bodyText); },
    json: function () { return Promise.resolve(r.json || {}); }
  });
}

var errLogs = [];
var sandbox = {
  document: { getElementById: function (id) { return els[id] || null; }, addEventListener: function () {}, querySelector: function () { return null; } },
  window: null,
  addEventListener: function () {},
  scrollTo: function () {},
  location: { search: '', pathname: '/supplier/' },
  URLSearchParams: URLSearchParams,
  FormData: FakeFormData,
  fetch: fakeFetch,
  console: { log: function () {}, warn: function () {}, error: function () { errLogs.push(Array.prototype.slice.call(arguments).map(String).join(' ')); } },
  setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise,
  ptfCaptchaValid: function () { return true; },
  ptfCaptchaAppend: function (fd) { fd.append('captcha_token', 'tok'); fd.append('captcha_answer', '7'); return fd; },
  ptfCaptchaMsg: 'کپچا را تکمیل کنید',
  ptfOtpToken: function () { return 'otok'; },
  ptfOtpVerified: function () { return true; }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
var ctx = vm.createContext(sandbox);
vm.runInContext(CLIENT, ctx, { filename: 'supplier/index.html#inline' });

var submitFn = (form.__l.submit && form.__l.submit[0]) || null;
function fillForm() {
  els.sComp.value = 'شرکت آزمایش پایپ';
  els.sName.value = 'مهندس تست';
  els.sPhone.value = '09121234567';
  els.sCat.value = 'پایپینگ';
  els.sBrands.value = 'ASTM';
  els.sPayTerms.value = 'cash';
  els.sCreditRange.value = '';
}
function chooseFile(name, size, putInBody) {
  var f = { name: name, size: size, __isFile: true };
  fileInput.files = [f];
  if (putInBody !== false) form.__files.attachment = f; else delete form.__files.attachment;
  return f;
}
function noFile() { fileInput.files = []; delete form.__files.attachment; }
function submit() {
  if (!submitFn) return Promise.reject(new Error('submit listener not found'));
  return Promise.resolve(submitFn({ preventDefault: function () {} }));
}
function attBox() { return els.venAttach; }

(async function () {

  T('کلاینت: اسکریپتِ صفحهٔ ثبت‌نام اجرا و هندلر submit ثبت شد', typeof submitFn === 'function');
  T('کلاینت: جعبهٔ رسید پیوست (venAttach) در markup وجود دارد', supSrc.indexOf('id="venAttach"') > -1);
  T('کلاینت: کمکیِ رسید/تلاش دوباره تعریف شده‌اند', supSrc.indexOf('window.ptfSupplierRetryAttach = function') > -1 && supSrc.indexOf('function attachBox(') > -1);

  /* ================= ۱) مسیر موفق: رسید سبز پیوست ================= */
  console.log('\n── ۱) فایل رسید ⇒ رسید سبز (نام + حجم) ──');
  await (async function () {
    fillForm(); noFile();
    chooseFile('catalog.pdf', 1234567);
    fetchCalls = []; errLogs = [];
    els.venAttach.innerHTML = ''; els.venAttach.style.display = 'none';
    nextResponse = { status: 200, ok: true, json: { ok: true, code: 'PTF-VEN-AAA1', attachment: { key: 'site-ven/catalog.pdf', name: 'catalog.pdf', size: 1234567 }, attachmentError: '', attachmentDiag: null, warning: '' } };
    await submit();
    T('۱.۱ درخواست به add_supplier رفت', fetchCalls.length === 1 && fetchCalls[0].url.indexOf('action=add_supplier') > -1, JSON.stringify(fetchCalls.map(function (c) { return c.url; })));
    var body = fetchCalls[0] && fetchCalls[0].body;
    T('۱.۲ نام فایل انتخاب‌شده به سرور اعلام شد (attachment_name)', !!body && body.get('attachment_name') === 'catalog.pdf', body && String(body.get('attachment_name')));
    T('۱.۳ حجم فایل به سرور اعلام شد (attachment_size)', !!body && body.get('attachment_size') === '1234567', body && String(body.get('attachment_size')));
    T('۱.۴ کد رهگیری نمایش داده شد', els.venCode.textContent === 'PTF-VEN-AAA1', els.venCode.textContent);
    T('۱.۵ رسید پیوست سبز و نمایان است', attBox().style.display === 'block' && attBox().style.background === '#ecfdf5', JSON.stringify(attBox().style));
    T('۱.۶ رسید نام و حجم واقعی فایل را می‌گوید', attBox().innerHTML.indexOf('catalog.pdf') > -1 && attBox().innerHTML.indexOf('مگابایت') > -1, attBox().innerHTML.slice(0, 160));
    T('۱.۷ در موفقیتِ با پیوست، هیچ خطای کنسولی ثبت نمی‌شود', errLogs.length === 0, errLogs.join(' | '));
  })();

  /* ================= ۲) حلقهٔ اصلی باگ: فایل نرسید ⇒ سکوت ممنوع ================= */
  console.log('\n── ۲) فایل به سرور نرسید ⇒ جعبهٔ قرمز + علت + ارسال دوباره ──');
  await (async function () {
    fillForm();
    chooseFile('stock-list.xlsx', 456789);
    fetchCalls = []; errLogs = [];
    els.venAttach.innerHTML = ''; els.venAttach.style.display = 'none'; els.venWarning.style.display = 'none';
    nextResponse = {
      status: 200, ok: true, json: {
        ok: true, code: 'PTF-VEN-BBB2', attachment: null, warning: '',
        attachmentError: 'فایل «stock-list.xlsx» در مرورگر انتخاب شده بود ولی در $_FILES سرور خالی است — علت معمولاً محدودیت آپلود میزبان یا فیلتر امنیتی/CDN است',
        attachmentDiag: { file_uploads: '1', upload_max_filesize: '2M', post_max_size: '8M', post_count: 12, files_count: 0, content_type: 'multipart/form-data; boundary=x', content_length: 456999 }
      }
    };
    await submit();
    T('۲.۱ ثبت‌نام موفق (کد صادر شد) — لید هرگز گم نمی‌شود', els.venCode.textContent === 'PTF-VEN-BBB2', els.venCode.textContent);
    T('۲.۲ جعبهٔ پیوست قرمز و نمایان است (دیگر «سبزِ بی‌صدا» نیست)', attBox().style.display === 'block' && attBox().style.background === '#fef2f2', JSON.stringify(attBox().style));
    T('۲.۳ صریحاً می‌گوید فایل به سرور نرسید', attBox().innerHTML.indexOf('به سرور نرسید') > -1, attBox().innerHTML.slice(0, 120));
    T('۲.۴ علتِ دقیقِ سروری را نشان می‌دهد', attBox().innerHTML.indexOf('$_FILES سرور خالی است') > -1, attBox().innerHTML.slice(0, 200));
    T('۲.۵ دکمهٔ «ارسال دوبارهٔ فایل» دارد', attBox().innerHTML.indexOf('ptfSupplierRetryAttach()') > -1);
    T('۲.۶ تصویر محدودیت‌های میزبان در کنسول ثبت شد (برای پشتیبانی)', errLogs.length > 0 && errLogs.join(' ').indexOf('[PTF supplier upload]') > -1, errLogs.join(' | ').slice(0, 200));
    T('۲.۷ نام فایل کاربر escape شده درج می‌شود (XSS از نام فایل ممکن نیست)', attBox().innerHTML.indexOf('<b>stock-list.xlsx</b>') === -1);
  })();

  /* ================= ۳) دکمهٔ ارسال دوباره ================= */
  console.log('\n── ۳) تلاش دوباره: فرم برمی‌گردد، رکورد تکراری ساخته نمی‌شود ──');
  await (async function () {
    els.resBox.style.display = 'block'; form.style.display = 'none';
    sandbox.ptfSupplierRetryAttach();
    T('۳.۱ فرم دوباره نمایان شد', form.style.display === '');
    T('۳.۲ جعبهٔ نتیجه پنهان شد', els.resBox.style.display === 'none');
    T('۳.۳ کد رهگیری در فیلد مخفی code نشست (همان رکورد، نه رکورد تازه)', els.sCode.value === 'PTF-VEN-BBB2', els.sCode.value);
    T('۳.۴ راهنما به کاربر می‌گوید ثبت تکراری ساخته نمی‌شود', els.supStatus.textContent.indexOf('ثبت‌نام تکراری ساخته نمی‌شود') > -1, els.supStatus.textContent.slice(0, 120));

    /* پاسخ مسیر نجات سروری: attached:true */
    fetchCalls = []; errLogs = [];
    els.venAttach.innerHTML = ''; els.venAttach.style.display = 'none';
    nextResponse = { status: 200, ok: true, json: { ok: true, code: 'PTF-VEN-BBB2', attached: true, message: 'فایل شما به ثبت‌نام قبلی همین شرکت اضافه شد', attachment: { key: 'site-ven/stock-list.xlsx', name: 'stock-list.xlsx', size: 456789 }, attachmentError: '', warning: '' } };
    await submit();
    var sent = fetchCalls[0] && fetchCalls[0].body;
    T('۳.۵ ارسال دوباره کد رهگیری را هم می‌فرستد', !!sent && sent.get('code') === 'PTF-VEN-BBB2', sent && String(sent.get('code')));
    T('۳.۶ رسید سبز «به ثبت‌نام قبلی اضافه شد» نشان داده می‌شود', attBox().style.background === '#ecfdf5' && attBox().innerHTML.indexOf('ثبت‌نام قبلی') > -1, attBox().innerHTML.slice(0, 160));
  })();

  /* ================= ۴) گیت‌های محلی: حجم و فرمت ================= */
  console.log('\n── ۴) گیت محلی حجم/فرمت — پیش از آپلود بیهوده ──');
  await (async function () {
    fillForm();
    fetchCalls = [];
    chooseFile('huge-catalog.pdf', 16 * 1024 * 1024);
    await submit();
    T('۴.۱ فایل بزرگ‌تر از ۱۵MB پیش از ارسال متوقف می‌شود', fetchCalls.length === 0 && els.supStatus.className.indexOf('err') > -1, els.supStatus.textContent);
    T('۴.۲ علت با عدد واقعی حجم گفته می‌شود', els.supStatus.textContent.indexOf('۱۵ مگابایت') > -1 && els.supStatus.textContent.indexOf('مگابایت') > -1, els.supStatus.textContent);

    fetchCalls = [];
    chooseFile('virus.exe', 1024);
    await submit();
    T('۴.۳ فرمت غیرمجاز پیش از ارسال متوقف می‌شود', fetchCalls.length === 0 && els.supStatus.textContent.indexOf('مجاز نیست') > -1, els.supStatus.textContent);

    fetchCalls = [];
    chooseFile('empty.pdf', 0);
    await submit();
    T('۴.۴ فایل صفر بایتی متوقف می‌شود (علت رایج «پیوست نرسید»)', fetchCalls.length === 0 && els.supStatus.textContent.indexOf('خالی است') > -1, els.supStatus.textContent);

    fetchCalls = [];
    chooseFile('ok.pdf', 20480, false); /* مرورگر فایل را در بدنه نگذاشته */
    await submit();
    T('۴.۵ اگر مرورگر فایل را در بدنه نگذاشت، ارسال انجام نمی‌شود و کاربر آگاه می‌شود', fetchCalls.length === 0 && els.supStatus.textContent.indexOf('بدنهٔ درخواست') > -1, els.supStatus.textContent);
  })();

  /* ================= ۵) بی‌اثر نبودنِ هشدار قدیمی ================= */
  console.log('\n── ۵) سازگاری: هشدار قدیمی و فیلد پیوست دست‌نخورده ──');
  await (async function () {
    fillForm(); noFile();
    fetchCalls = []; errLogs = [];
    els.venAttach.innerHTML = ''; els.venAttach.style.display = 'none'; els.venWarning.style.display = 'none'; els.venWarning.textContent = '';
    nextResponse = { status: 200, ok: true, json: { ok: true, code: 'PTF-VEN-CCC3', attachment: null, attachmentError: '', warning: '' } };
    await submit();
    T('۵.۱ وقتی فایلی انتخاب نشده، جعبهٔ پیوست بی‌صدا می‌ماند (هشدار الکی نمی‌دهد)', attBox().style.display !== 'block', JSON.stringify(attBox().style));
    T('۵.۲ ثبت بدون پیوست همچنان موفق است', els.venCode.textContent === 'PTF-VEN-CCC3');
    T('۵.۳ هیچ فایلی هم اعلام نمی‌شود', fetchCalls.length === 1 && fetchCalls[0].body.get('attachment_name') === null);
    /* v34.38.0 (D4): accept با allowlist سرور و ATTACH_EXT یکی شد — تصویر هم مجاز است
       (سرور و JS از قبل jpg/png/webp را می‌پذیرفتند ولی پنجرهٔ انتخاب فایل فیلترشان می‌کرد). */
    T('۵.۴ accept فیلد فایل با allowlist سرور یکی است',
      supSrc.indexOf('name="attachment" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.rar"') > -1);
    T('۵.۴ب هر پسوندِ ATTACH_EXT در accept هم هست',
      ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','webp','zip','rar'].every(function (x) { return supSrc.indexOf('.' + x) > -1; }));
    T('۵.۵ کپچا/OTP همچنان به ارسال ضمیمه می‌شوند', supSrc.indexOf('ptfCaptchaAppend(fd)') > -1 && supSrc.indexOf("fd.append('otp_token'") > -1);
  })();

  /* ================= ۶) قرارداد سرور (api/crm.php) ================= */
  console.log('\n── ۶) سرور: save_attachment دیگر بی‌صدا null نمی‌دهد ──');
  var SA = blk(api, 'function save_attachment(', '\nfunction push_event_rec(');
  T('۶.۱ save_attachment پارامتر تشخیص (diag) دارد', /function save_attachment\(\$field, \$prefix, &\$error = null, &\$diag = null\)/.test(api));
  T('۶.۲ «فایل اعلام‌شده ولی نرسیده» از «فایل انتخاب‌نشده» جدا می‌شود', SA.indexOf("$_POST[$field . '_name']") > -1 && SA.indexOf("$_POST[$field . '_size']") > -1 && SA.indexOf('if ($declName === \'\' && $declSize <= 0) return null;') > -1);
  T('۶.۳ نقشهٔ کامل کدهای خطای آپلود PHP موجود است', ['UPLOAD_ERR_INI_SIZE', 'UPLOAD_ERR_FORM_SIZE', 'UPLOAD_ERR_PARTIAL', 'UPLOAD_ERR_NO_FILE', 'UPLOAD_ERR_NO_TMP_DIR', 'UPLOAD_ERR_CANT_WRITE', 'UPLOAD_ERR_EXTENSION'].every(function (k) { return api.indexOf(k) > -1; }) && api.indexOf('function ptf_upload_error_fa(') > -1);
  T('۶.۴ file_uploads=Off صریحاً تشخیص داده می‌شود', api.indexOf('function ptf_uploads_enabled(') > -1 && SA.indexOf('ptf_uploads_enabled()') > -1 && SA.indexOf('file_uploads=Off') > -1);
  T('۶.۵ نقض post_max_size با عدد واقعی گزارش می‌شود', api.indexOf('function ptf_ini_bytes(') > -1 && SA.indexOf('post_max_size') > -1 && SA.indexOf('$sent > $pm') > -1);
  T('۶.۶ نبودِ multipart (پروکسی/CDN/فیلتر) تشخیص داده می‌شود', SA.indexOf("strpos($ct, 'multipart/form-data') === false") > -1);
  T('۶.۷ تصویر محدودیت‌های میزبان ساخته می‌شود (بدون دادهٔ حساس)', api.indexOf('function ptf_upload_limits_diag(') > -1 && ['file_uploads', 'upload_max_filesize', 'post_max_size', 'post_count', 'files_count'].every(function (k) { return api.indexOf("'" + k + "' =>") > -1; }) && SA.indexOf('secret') === -1);
  T('۶.۸ شکست فضای ابری هم diag می‌گیرد (storage-config/cURL)', SA.indexOf('storageConfigReady') > -1 && SA.indexOf("function_exists('curl_init')") > -1 && SA.indexOf('ptf_storage_load_cfg') > -1);
  T('۶.۹ سقف/فرمت پیوست با عدد واقعی فایل گزارش می‌شود', SA.indexOf('round($size / 1048576, 2)') > -1 && SA.indexOf("implode(', ', $allowed)") > -1);
  T('۶.۱۰ مسیر «فقط فضای ابری» دست‌نخورده (هیچ نوشتن روی دیسک هاست)', SA.indexOf('ptf_storage_put_uploaded_file(') > -1 && SA.indexOf('file_put_contents') === -1 && SA.indexOf('move_uploaded_file') === -1);

  console.log('\n── ۶ب) سرور: add_supplier رسید/علت را برمی‌گرداند و رکورد می‌سازد ──');
  var AS = blk(api, "case 'add_supplier':", "case 'chat_lead':");
  /* v34.38.0: همان گارد، به‌علاوهٔ !$supWillReject — چون در مسیر duplicate اصلاً آپلودی
     انجام نمی‌شود، «فایل به سرور نرسید» آنجا پیام درستی نیست (پیام اختصاصی duplicate دارد). */
  T('۶ب.۱ اگر فایل اعلام شده ولی پیوست null است، خطا پر می‌شود (سکوت ممنوع)', AS.indexOf('$supDeclFile') > -1 && AS.indexOf("if ($attachment === null && $supDeclFile && $attachmentError === '' && !$supWillReject)") > -1);
  T('۶ب.۲ رسید پیوست (key/name/size) ساخته می‌شود', AS.indexOf('$attachmentReceipt') > -1 && AS.indexOf("'key' => (string)$attachment['key']") > -1);
  T('۶ب.۳ هر دو پاسخ موفق، رسید + علت + تشخیص را برمی‌گردانند', (AS.match(/'attachment' => \$attachmentReceipt, 'attachmentError' => \$attachmentError, 'attachmentDiag' => \$attachmentDiag/g) || []).length === 2);
  T('۶ب.۴ علت نرسیدن پیوست روی خود رکورد ثبت می‌شود (برای CRM)', AS.indexOf("'attachmentError' => ($attachment ? '' : (string)$attachmentError)") > -1 && AS.indexOf("'attachmentDiag' => ($attachment ? null : $attachmentDiag)") > -1);
  T('۶ب.۵ خطای پیوست همچنان ثبت‌نام را متوقف نمی‌کند (لید گم نمی‌شود)', AS.indexOf("'warning' => $attachmentWarning") > -1 && AS.indexOf("'ok' => true, 'code' => $code") > -1);
  T('۶ب.۶ مسیر تکمیل مدارک (reopened) دست‌نخورده', AS.indexOf("'reopened' => true") > -1 && AS.indexOf("($attachment ?: ($dupFound['row']['attachment'] ?? null))") > -1);

  console.log('\n── ۶ج) سرور: مسیر نجات — چسباندن پیوست به ثبت‌نام در انتظار بررسی ──');
  T('۶ج.۱ بلوک SUP-ATTACH-RECOVERY وجود دارد', api.indexOf('SUP-ATTACH-RECOVERY') > -1);
  T('۶ج.۲ فقط وقتی پیوست تازه سالم ذخیره شده باشد', /SUP-ATTACH-RECOVERY[\s\S]{0,900}\$attachment !== null/.test(api));
  /* v34.38.0 (SUP-UPLOAD-ORDER): شرط‌های بازیابی «پیش از» آپلود محاسبه می‌شوند تا در
     مسیر duplicate هیچ فایلی بی‌جهت روی فضای ابری نوشته و بعد دور ریخته نشود. */
  T('۶ج.۳ هرگز پیوست موجود را بازنویسی نمی‌کند', /\$supRecoveryEligible = \([\s\S]{0,400}empty\(\$supDupRow\['attachment'\]\)/.test(api));
  T('۶ج.۴ فقط برای رکورد pending/rejected سایت (نه فهرست تاییدشدهٔ CRM)', /\$supRecoveryEligible = \([\s\S]{0,300}'suppliers'[\s\S]{0,200}\['pending', 'rejected'\]/.test(api));
  /* v34.38.0 (SUP-ATTACH-PHONE): تطابق شماره روی هر سه فیلدی که خودِ dedup می‌سنجد
     (phone/ph/mob) — پیش از این فقط phone سنجیده می‌شد و اگر تطابق روی ph/mob بود،
     دکمهٔ «ارسال دوبارهٔ فایل» همیشه duplicate می‌گرفت. */
  T('۶ج.۵ هویت با تطابق شمارهٔ تماس (نرمال‌شده) بررسی می‌شود', api.indexOf('$supPhoneMatchesDup') > -1 && /foreach \(\[\$supDupRow\['phone'\] \?\? '', \$supDupRow\['ph'\] \?\? '', \$supDupRow\['mob'\] \?\? ''\]/.test(api));
  T('۶ج.۶ در مسیر duplicate اصلاً آپلودی انجام نمی‌شود (پایان آبجکت یتیم)', /if \(!\$supWillReject\) \{\s*\$attachment = save_attachment\('attachment', 'ven'/.test(api));
  T('۶ج.۶ پس از چسباندن، علت قبلی از رکورد پاک می‌شود', api.indexOf("$suppliers[$ai]['attachmentError'] = '';") > -1 && api.indexOf("$suppliers[$ai]['attachmentDiag'] = null;") > -1);
  T('۶ج.۷ رویداد آن در صندوق پیام CRM ثبت می‌شود', api.indexOf("push_event_rec('supplier_site', 'پیوست ثبت‌نام تامین‌کننده تکمیل شد") > -1);
  T('۶ج.۸ پاسخ attached:true + همان کد رهگیری است (رکورد تکراری ساخته نمی‌شود)', api.indexOf("'attached' => true") > -1 && /SUP-ATTACH-RECOVERY[\s\S]{0,1600}save_data\('suppliers', \$suppliers\);/.test(api) && !/SUP-ATTACH-RECOVERY[\s\S]{0,1600}\$suppliers\[\] =/.test(api));
  T('۶ج.۹ کپچا و (در صورت فعال بودن پیامک) OTP پیش از این مسیر هم الزامی‌اند', blk(api, "case 'add_supplier':", 'SUP-DEDUP-001').indexOf('require_captcha();') > -1 && blk(api, "case 'add_supplier':", 'SUP-DEDUP-001').indexOf('otp_token_ok(') > -1);

  /* ================= ۷) ترتیب صندوق: جدیدترین اول ================= */
  console.log('\n── ۷) ترتیب صندوق — ثبت‌نام تازه در صفحهٔ اول دیده می‌شود ──');
  T('۷.۱ پین سرور: فهرست پیش از صفحه‌بندی جدیدترین-اول مرتب می‌شود', api.indexOf("function ptf_rows_newest_first(") > -1 && api.indexOf("$allSuppliers = ptf_rows_newest_first(load_data('suppliers'));") > -1);
  T('۷.۲ پین سرور: مرتب‌سازی پیش از array_slice است', api.indexOf('ptf_rows_newest_first(load_data(\'suppliers\'))') < api.indexOf('array_slice($allSuppliers, $offset, $limit)'));
  T('۷.۳ پین سرور: استعلام‌های سایت هم جدیدترین-اول', api.indexOf('$siteRfqs = ptf_rows_newest_first(') > -1);
  T('۷.۴ پین سرور: قرارداد صفحه‌بندی/تازگی (limit/offset/fresh/since) دست‌نخورده', ["$limit = (int)($_REQUEST['limit'] ?? 0)", "$offset = max(0, (int)($_REQUEST['offset'] ?? 0))", "if ($limit === 0 && $offset === 0", "hash_equals($since, $sig)", "'since' => $sig"].every(function (k) { return api.indexOf(k) > -1; }));
  T('۷.۵ پین کلاینت: جدول درخواست‌های سایت هم جدیدترین-اول چیده می‌شود', /window\.renderSupPending = function[\s\S]{0,600}all = all\.slice\(\)\.sort\(function \(a, b\)/.test(bridge));

  /* پورت JS از ptf_rows_newest_first (همان منطق مقایسهٔ رشته‌ای تاریخ، نزولی) */
  function newestFirst(rows) {
    rows = rows.slice();
    rows.sort(function (a, b) {
      var da = (a && a.date) ? String(a.date) : '';
      var db = (b && b.date) ? String(b.date) : '';
      if (da === db) return 0;
      return da < db ? 1 : -1;
    });
    return rows;
  }
  await (async function () {
    var rows = [];
    for (var i = 0; i < 60; i++) {
      var dd = String(i + 1); if (dd.length < 2) dd = '0' + dd; /* روزهای ۰۱..۶۰ — مقایسهٔ رشته‌ایِ تاریخ همان چیزی است که سرور هم می‌کند */
      rows.push({ code: 'PTF-VEN-' + i, date: '2026-08-' + dd + ' 10:00', attachment: i === 59 ? { key: 'site-ven/new.pdf', name: 'new.pdf', size: 12 } : null });
    }
    var sorted = newestFirst(rows);
    var page1 = sorted.slice(0, 50); /* limit=50&offset=0 */
    T('۷.۶ رفتاری: تازه‌ترین ثبت‌نام (با پیوستش) در صفحهٔ اول است', page1[0].code === 'PTF-VEN-59' && !!page1[0].attachment, page1[0].code);
    T('۷.۷ رفتاری: ترتیب نزولی پایدار است (پیش از مرتب‌سازی آخرین رکورد آخر بود)', rows[59].code === 'PTF-VEN-59' && rows[0].code === 'PTF-VEN-0');
    T('۷.۸ رفتاری: رکورد بدون تاریخ به انتها می‌رود (نه ابتدا)', (function () { var r = newestFirst([{ code: 'A', date: '2026-01-01 09:00' }, { code: 'B' }, { code: 'C', date: '2026-09-04 09:00' }]); return r[0].code === 'C' && r[2].code === 'B'; })());
    T('۷.۹ رفتاری: صفحهٔ دوم، قدیمی‌ترها را می‌دهد (بدون تکرار صفحهٔ اول)', (function () { var s = newestFirst(rows); return s.slice(50, 60)[0].code === 'PTF-VEN-9'; })());
  })();

  /* ================= ۸) نمایش CRM ================= */
  console.log('\n── ۸) CRM: «پیوست نرسید» با علت، نه «بدون ضمیمه» ──');
  T('۸.۱ بج قرمز «⚠️ پیوست نرسید» در جدول ثبت‌نام‌های سایت', bridge.indexOf('⚠️ پیوست نرسید') > -1 && /s\.attachmentError[\s\S]{0,400}⚠️ پیوست نرسید/.test(bridge));
  T('۸.۲ علت در title بج قابل دیدن است', /title="' \+ escP\(s\.attachmentError\) \+ '"/.test(bridge));
  T('۸.۳ مودال جزئیات، علت + محدودیت‌های میزبان را نشان می‌دهد', bridge.indexOf('پیوست این ثبت‌نام به سرور نرسیده است') > -1 && bridge.indexOf('siteAttachmentDiagLine(s.attachmentDiag)') > -1);
  T('۸.۴ راهنمای جبران (ارسال دوبارهٔ فایل) به مدیر نشان داده می‌شود', bridge.indexOf('ارسال دوبارهٔ فایل') > -1);
  T('۸.۵ نمایش پیوست ابری/کلید دست‌نخورده (سازگاری با رکوردهای قدیمی)', bridge.indexOf('siteAttachmentHtml(s.attachment)') > -1 && bridge.indexOf("if (typeof v === 'object' && v.key)") > -1);
  T('۸.۶ تصویر تشخیص، پیکربندی فضای ابری و cURL را جدا می‌گوید', bridge.indexOf('function siteAttachmentDiagLine(') > -1 && bridge.indexOf('storageConfigReady') > -1 && bridge.indexOf('file_uploads=') > -1);

  /* ================= ۹) فرم‌های استعلام هم همان قرارداد را دارند ================= */
  console.log('\n── ۹) استعلام سایت/خانه: اعلام فایل به سرور ──');
  T('۹.۱ فرم استعلام، نام/حجم فایل را اعلام می‌کند', rfqSrc.indexOf("fdRfq.append('attachment_name'") > -1 && rfqSrc.indexOf("fdRfq.append('attachment_size'") > -1);
  T('۹.۲ فرم استعلامِ صفحهٔ اصلی هم اعلام می‌کند', homeSrc.indexOf("fd.append('attachment_name'") > -1 && homeSrc.indexOf("fd.append('attachment_size'") > -1);
  T('۹.۳ سرور برای استعلام، خطای پیوست را سخت (503) برمی‌گرداند — بدون ثبت بی‌صدا', /case 'add_rfq_site':[\s\S]{0,1600}if \(\$attachmentError\) \{ http_response_code\(503\);/.test(api));

  /* ================= ۱۰) بهداشت ================= */
  console.log('\n── ۱۰) بهداشت و ثبت در گیت ──');
  T('۱۰.۱ VERSION.json = v34.38.15', ver.crm_version === 'v34.38.15', ver.crm_version);
  T('۱۰.۲ tester589 در گیت CI ثبت شده است', gate.indexOf('tester589-v34.36.2-supplier-upload-receipt.js') > -1);
  T('۱۰.۳ یادداشت انتشار این نسخه موجود است', fs.existsSync('RELEASE-NOTES-v34.38.1.md'));
  T('۱۰.۴ هیچ دادهٔ حساس (کلید/رمز) در تشخیص‌ها نشت نمی‌کند', !/attachmentDiag[\s\S]{0,400}(secret_key|access_key|CAPTCHA_SECRET)/.test(api));

  console.log('\n— tester589 (v34.38.0: رسید پیوست ثبت‌نام تامین‌کننده — SUP-UPLOAD-RCA) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
})().catch(function (e) {
  console.error('\nERROR tester589: ' + ((e && e.stack) || e));
  process.exit(1);
});
