#!/usr/bin/env node
'use strict';
/* v34.39.65 (WRONG-FORM-REDIRECT) — گزارش کارفرما:
   «گاهی تامین‌کننده اشتباهی در استعلام هوشمند ثبت می‌کند؛ نه می‌شود به او اطلاع
   داد برود فرم تامین‌کنندگان، نه می‌شود منتقلش کرد — یا باید رد کنیم یا تایید.»
   راهکار دو لایه: ① دوراهی هدف در هر دو فرم سایت (پیشگیری قبل از ثبت + انتقال
   فیلدها) ② اکشن سوم «هدایت» در هر دو صف تایید CRM: وضعیت redirected + پیامکِ
   لینک فرم درست با توکن امضاشده + همان لینک در رهگیری + پیش‌پر شدن فرم مقصد.
   این تست توکن و منطق سرور را با PHP واقعی اجرا می‌کند و بقیه را pin می‌کند. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 300) : '')); }
}
const api = read('api/crm.php'), bridge = read('crm/bridge.js');
const rfqPage = read('rfq/index.html'), supPage = read('supplier/index.html'), trackPage = read('tracking/index.html');

/* ── قرارداد سرور ── */
T('توکن هدایت: ساخت/اعتبارسنجی با همان الگوی OTP (HMAC + گارد secret + انقضا)',
  api.includes('function ptf_wrongform_token_make') && api.includes('function ptf_wrongform_token_ok') &&
  api.includes("hash_hmac('sha256', 'wrongform|'" ) && api.includes('$age > 2592000'));
T('اکشن عمومی prefill_from ثبت و rate-limited است',
  api.includes("'prefill_from'") && api.includes("'prefill_from' => 30") && api.includes("case 'prefill_from':"));
T('prefill_from بدون توکن معتبر 403 می‌دهد و فقط فیلدهای عمومی برمی‌گرداند',
  api.includes('!ptf_wrongform_token_ok($pfTok, $pfType, $pfCode)') && api.includes("'company'  => (string)($pfRow['company'] ?? '')") && !api.slice(api.indexOf("case 'prefill_from':"), api.indexOf("case 'track':")).includes('approvedBy'));
T('set_status: وضعیت redirected با rejectType=wrong_form و متادیتای هدایت',
  api.includes("if ($status === 'redirected')") && api.includes("$it['rejectType'] = 'wrong_form';") && api.includes("$it['redirectTo'] = $type === 'supplier' ? 'rfq' : 'supplier';"));
T('پیامک هدایت برای هر دو جهت و فقط موبایل معتبر (قبلاً برای rfq اصلاً نبود)',
  api.includes("if ($done && $smsStatus === 'redirected' && sms_enabled())") && api.includes("preg_match('/^09\\d{9}$/', $wfMobile)") && api.includes('ptf_wrongform_url('));
T('track: نگاشت عمومی redirected + redirectUrl در پاسخ (کانال دوم)',
  api.includes("'redirected' => 'همکار گرامی") && api.includes("'redirectUrl' => $isRedirected ? ptf_wrongform_url($type, (string)$found['code']) : ''"));
T('انتساب تبدیل: fromCode روی هر دو ثبت جدید می‌نشیند',
  (api.match(/'fromCode' => clean\(\$_POST\['fromCode'\] \?\? '', 60\)/g) || []).length === 2);

/* ── قرارداد CRM ── */
T('صف استعلام سایت: دکمهٔ «تامین‌کننده است» + rfqRedirect با set_status redirected',
  bridge.includes('🤝 تامین‌کننده است') && bridge.includes('window.rfqRedirect = function') &&
  bridge.includes("status: 'redirected', rejectType: 'wrong_form', statusText: 'ثبت در فرم اشتباه — راهنمای ثبت‌نام تامین‌کنندگان ارسال شد'"));
T('صف تامین‌کنندگان سایت: دکمهٔ «خریدار است» + supRedirect',
  bridge.includes('🛒 خریدار است') && bridge.includes('window.supRedirect = function') &&
  bridge.includes("statusText: 'ثبت در فرم اشتباه — راهنمای ثبت استعلام خرید ارسال شد'"));
T('هدایت کارتابل را می‌بندد و audit دارد (هر دو جهت)',
  bridge.includes("audit('استعلامات', 'هدایت فرم اشتباه به ثبت‌نام تامین‌کنندگان: '") && bridge.includes("audit('تامین‌کنندگان', 'هدایت فرم اشتباه به استعلام خرید: '"));

/* ── قرارداد سایت ── */
T('فرم استعلام: دوراهی هدف + کارت انتقال + پیش‌پر از URL/توکن + fromCode مخفی',
  rfqPage.includes('id="ptfPurposeGate"') && rfqPage.includes('id="ptfSellerCard"') && rfqPage.includes('id="ptfGoSupplier"') &&
  rfqPage.includes("action=prefill_from&type=supplier") && rfqPage.includes('name="fromCode"'));
T('فرم تامین‌کننده: دوراهی معکوس + کارت انتقال + پیش‌پر + fromCode مخفی',
  supPage.includes('id="ptfPurposeGate"') && supPage.includes('id="ptfBuyerCard"') && supPage.includes('id="ptfGoRfq"') &&
  supPage.includes("action=prefill_from&type=rfq") && supPage.includes('name="fromCode"'));
T('فرم تامین‌کننده: مسیر resubmit قدیمی (?code=) دست‌نخورده',
  supPage.includes("q.get('code')") && supPage.includes('id="sCode"'));
T('رهگیری: باکس هدایت در هر دو نتیجه (rfq/supplier) با لینک از سرور',
  trackPage.includes('id="rfqRedirectBox"') && trackPage.includes('id="venRedirectBox"') &&
  trackPage.includes("d.status === 'redirected' && d.redirectUrl"));

/* ── اجرای PHP واقعی: توکن ── */
function phpFn(name) {
  const start = api.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = api.indexOf('{', start), depth = 0;
  for (let j = i; j < api.length; j++) {
    if (api[j] === '{') depth++;
    else if (api[j] === '}') { depth--; if (depth === 0) return api.slice(start, j + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const FNS = ['ptf_wrongform_token_make', 'ptf_wrongform_token_ok', 'ptf_wrongform_url'].map(phpFn).join('\n');
const PHP_TEST = `<?php
$pass=0;$fail=0;
function T($name,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$name."\\n";}else{$fail++;echo "FAIL PHP ".$name." ".$d."\\n";}}
$CAPTCHA_SECRET=str_repeat('s',40);
$_SERVER['HTTP_HOST']='pishtaj.ir';
${FNS}
$t=ptf_wrongform_token_make('rfq','PTF-RFQ-ABC');
T('توکن ساخته و برای همان type+code معتبر است', $t!==''&&ptf_wrongform_token_ok($t,'rfq','PTF-RFQ-ABC'));
T('توکن برای کد دیگر معتبر نیست', !ptf_wrongform_token_ok($t,'rfq','PTF-RFQ-OTHER'));
T('توکن rfq برای supplier معتبر نیست', !ptf_wrongform_token_ok($t,'supplier','PTF-RFQ-ABC'));
T('توکن دست‌کاری‌شده رد می‌شود', !ptf_wrongform_token_ok(substr($t,0,-3).'AAA','rfq','PTF-RFQ-ABC'));
T('توکن خالی/خراب رد می‌شود', !ptf_wrongform_token_ok('','rfq','PTF-RFQ-ABC')&&!ptf_wrongform_token_ok('not-base64!!','rfq','x'));
$old=base64_encode((time()-2592001).'|rfq|PTF-RFQ-ABC|'.hash_hmac('sha256','wrongform|rfq|PTF-RFQ-ABC|'.(time()-2592001),$CAPTCHA_SECRET));
T('توکن منقضی (بیش از ۳۰ روز) رد می‌شود', !ptf_wrongform_token_ok($old,'rfq','PTF-RFQ-ABC'));
$CAPTCHA_SECRET='short';
T('بدون secret امن نه ساخته می‌شود نه پذیرفته', ptf_wrongform_token_make('rfq','x')===''&&!ptf_wrongform_token_ok($t,'rfq','PTF-RFQ-ABC'));
$CAPTCHA_SECRET=str_repeat('s',40);
$u=ptf_wrongform_url('rfq','PTF-RFQ-ABC');
T('لینک هدایت: رکورد استعلام ← فرم تامین‌کننده + توکن', strpos($u,'https://pishtaj.ir/supplier/?from=PTF-RFQ-ABC&t=')===0, $u);
$u2=ptf_wrongform_url('supplier','PTF-VEN-XYZ');
T('لینک هدایت معكوس: رکورد تامین‌کننده ← فرم استعلام', strpos($u2,'https://pishtaj.ir/rfq/?from=PTF-VEN-XYZ&t=')===0, $u2);
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;
(async () => {
  let stdout = '', stderr = '';
  const cp = require('child_process'), os = require('os');
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't698-'));
    const f = path.join(dir, 'test.php'); fs.writeFileSync(f, PHP_TEST);
    try { stdout = cp.execFileSync('php', [f], { encoding: 'utf8', cwd: dir }); }
    catch (e) { stdout = String(e.stdout || ''); stderr = String(e.stderr || e.message); }
  } else {
    let PhpNode; try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (e) {}
    if (PhpNode) {
      const php = new PhpNode(); const out = [], err = [];
      php.addEventListener('output', e => out.push(e.detail || e.data || ''));
      php.addEventListener('error', e => err.push(e.detail || e.data || ''));
      await php.writeFile('/test.php', PHP_TEST);
      await php.run("<?php require '/test.php';");
      stdout = out.join(''); stderr = err.join('');
    } else console.log('SKIP PHP execution: install php-cli or optional php-wasm; contracts checked only.');
  }
  if (stdout) {
    console.log(stdout.replace(/PHP_RUNTIME_COUNTS.*/, '').trim());
    const m = stdout.match(/PHP_RUNTIME_COUNTS (\d+) (\d+)/);
    if (m) { pass += +m[1]; fail += +m[2]; } else T('PHP execution returns assertion summary', false);
  }
  if (stderr) console.log('PHP diagnostics: ' + stderr.trim().slice(-600));
  console.log('\n=== tester698 wrong-form-redirect: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
