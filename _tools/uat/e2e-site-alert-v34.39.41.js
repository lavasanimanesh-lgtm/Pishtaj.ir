/* E2E — v34.39.41: اعلان پیامک + بات هنگام ثبت استعلام / تامین‌کننده از سایت — روی خودِ api/crm.php با PHP واقعی (php-wasm).
   پیش‌نیاز (خارج از repo): `npm i php-wasm` در پوشه‌ای که در NODE_PATH است؛ مثلاً:
     mkdir -p /tmp/phpw && cd /tmp/phpw && npm i php-wasm
     NODE_PATH=/tmp/phpw/node_modules node _tools/uat/e2e-site-alert-v34.39.41.js
   - php-wasm افزونهٔ curl ندارد ⇒ curl_* با polyfill ضبط‌کننده جایگزین می‌شود: هر درخواست خروجی (کاوه‌نگار/تلگرام/بله)
     در /tmp2/curl.log ثبت می‌شود و پاسخ آن قابل تنظیم است (موفق/خطا). این یعنی خودِ کد sms_send و ptf_bot_group_send اجرا می‌شود.
   - mbstring در php-wasm نیست (روی سرور واقعی هست) ⇒ polyfill ساده.
   - کپچا و OTP با همان HMAC سرور ساخته می‌شوند؛ مسیر کامل case واقعی (verify_request/public_body_guard/require_captcha/
     public_tracking_code/save_data/push_event_rec/ptf_site_alert) اجرا می‌شود. */
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const API_FILES = ['crm.php', 'auth.php', 'secrets.php', 'storage-lib.php', 'db-lib.php', 'contact-merge-lib.php', 'sales-domain.php'];
const SECRET = 'e2e-captcha-secret-0123456789abcdef0123456789abcdef';

const R = { pass: 0, fail: 0 };
function T(name, cond, detail) {
  if (cond) { R.pass++; console.log('  ✔ ' + name); }
  else { R.fail++; console.log('  ✘ FAIL: ' + name + (detail !== undefined ? ' — ' + String(detail).slice(0, 300) : '')); }
}

const MB = `
if (!function_exists('mb_strlen')) { function mb_strlen($s, $e = null) { return strlen($s); } }
if (!function_exists('mb_substr')) { function mb_substr($s, $st, $l = null, $e = null) { return $l === null ? substr($s, $st) : substr($s, $st, $l); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $e = null) { return strtolower($s); } }
if (!function_exists('mb_strpos')) { function mb_strpos($h, $n, $o = 0, $e = null) { return strpos($h, $n, $o); } }
if (!function_exists('mb_convert_encoding')) { function mb_convert_encoding($s, $to, $from = null) { return $s; } }
`;
/* curl ضبط‌کننده: پاسخ از /tmp2/curl_mode.txt (ok | fail) */
const CURL = `
if (!function_exists('curl_init')) {
  $GLOBALS['__curl'] = [];
  function curl_init($u = null) { $id = count($GLOBALS['__curl']); $GLOBALS['__curl'][$id] = ['url' => $u, 'opt' => []]; return $id; }
  function curl_setopt_array($h, $o) { foreach ($o as $k => $v) $GLOBALS['__curl'][$h]['opt'][$k] = $v; return true; }
  function curl_setopt($h, $k, $v) { $GLOBALS['__curl'][$h]['opt'][$k] = $v; return true; }
  function curl_exec($h) {
    $c = $GLOBALS['__curl'][$h];
    $mode = @trim((string)@file_get_contents('/tmp2/curl_mode.txt')) ?: 'ok';
    $body = $c['opt'][CURLOPT_POSTFIELDS] ?? null;
    file_put_contents('/tmp2/curl.log', json_encode(['url' => $c['url'], 'body' => $body]) . "\\n", FILE_APPEND);
    $isSms = strpos((string)$c['url'], 'kavenegar') !== false;
    $fail = ($mode === 'fail') || ($mode === 'botfail' && !$isSms);
    $GLOBALS['__curl'][$h]['code'] = $fail ? 500 : 200;
    if ($isSms) return json_encode(['return' => ['status' => $fail ? 418 : 200, 'message' => $fail ? 'no credit' : 'ok']]);
    return $fail ? '{"ok":false}' : '{"ok":true}';
  }
  function curl_getinfo($h, $o = null) { return $GLOBALS['__curl'][$h]['code'] ?? 0; }
  function curl_error($h) { return ''; }
  function curl_close($h) { return true; }
  if (!defined('CURLOPT_RETURNTRANSFER')) { define('CURLOPT_RETURNTRANSFER', 19913); define('CURLOPT_POST', 47); define('CURLOPT_TIMEOUT', 13);
    define('CURLOPT_CONNECTTIMEOUT', 78); define('CURLOPT_HTTPHEADER', 10023); define('CURLOPT_POSTFIELDS', 10015); define('CURLOPT_SSL_VERIFYPEER', 64); define('CURLINFO_HTTP_CODE', 2097154); }
}
`;

async function request(opts) {
  const php = new PhpNode();
  const out = [], err = [];
  php.addEventListener('output', e => out.push(e.detail || e.data || ''));
  php.addEventListener('error', e => err.push(e.detail || e.data || ''));
  await php.run(`<?php @mkdir('/w/repo/api', 0777, true); @mkdir('/w/repo/crm/data', 0777, true); @mkdir('/tmp2', 0777, true);`);
  for (const f of API_FILES) await php.writeFile('/w/repo/api/' + f, fs.readFileSync(path.join(REPO, 'api', f), 'utf8'));
  await php.writeFile('/w/ptf-secrets.php', `<?php return ['auth_key' => 'e2e-auth-0123456789abcdef0123456789abcdef', 'captcha_key' => '${SECRET}'];`);
  if (opts.sms !== false) await php.writeFile('/w/sms-config.php', `<?php return ['provider' => 'kavenegar', 'api_key' => 'KEY-123', 'line' => '10004346'${opts.smsMobiles ? ", 'site_alert_mobiles' => " + JSON.stringify(opts.smsMobiles).replace(/^\[/, '[').replace(/\]$/, ']') : ''}];`);
  if (opts.bot !== false) await php.writeFile('/w/bot-config.php', `<?php return ['telegram_token' => '111:TG', 'telegram_chat_id' => '-100۱۲۳', 'bale_token' => '222:BL', 'bale_chat_id' => '-555'];`);
  await php.writeFile('/tmp2/curl_mode.txt', opts.curlMode || 'ok');
  await php.writeFile('/tmp2/curl.log', '');
  await php.run(opts.code);
  await new Promise(r => setTimeout(r, 300));
  let log = '';
  try { log = String(await php.readFile('/tmp2/curl.log', { encoding: 'utf8' })); } catch (e) {}
  let rfqs = [], sups = [];
  try { rfqs = JSON.parse(String(await php.readFile('/w/repo/crm/data/rfqs.json', { encoding: 'utf8' }))); } catch (e) {}
  try { sups = JSON.parse(String(await php.readFile('/w/repo/crm/data/suppliers.json', { encoding: 'utf8' }))); } catch (e) {}
  const calls = log.split('\n').filter(Boolean).map(l => JSON.parse(l));
  return { stdout: out.join(''), stderr: err.join(''), calls, rfqs, sups };
}
function parseJson(s) { const i = String(s).indexOf('{'); if (i < 0) throw new Error('no JSON: ' + String(s).slice(0, 300)); return JSON.parse(String(s).slice(i)); }

function post(action, fields, captchaOk = true, withOtp = false) {
  return `<?php ${MB} ${CURL}
$_SERVER['HTTP_HOST']='pishtaj.test'; $_SERVER['REMOTE_ADDR']='10.0.0.' . rand(1,250); $_SERVER['REQUEST_METHOD']='POST';
$ts = time(); $sum = 7;
$tok = base64_encode($ts . '|' . hash_hmac('sha256', $sum . '|' . $ts, '${SECRET}'));
$_POST = json_decode(${JSON.stringify(JSON.stringify(fields))}, true);
$_POST['captcha_token'] = $tok; $_POST['captcha_answer'] = '${captchaOk ? 7 : 8}';
${withOtp ? `$ph = $_POST['phone']; $_POST['otp_token'] = base64_encode($ts . '|' . $ph . '|' . hash_hmac('sha256', 'otp|' . $ph . '|' . $ts, '${SECRET}'));` : ''}
$_GET = ['action' => '${action}']; $_REQUEST = array_merge($_GET, $_POST);
require '/w/repo/api/crm.php';
/* php-wasm توابع shutdown را اجرا نمی‌کند ⇒ همان flush که shutdown صدا می‌زند */
if (function_exists('ptf_site_alert_flush')) ptf_site_alert_flush();`;
}
const RFQ = { company: 'شرکت آزمون پالایش', name: 'مهندس تست', phone: '09120000001', email: 'a@b.c', category: 'شیرآلات', subject: 'استعلام شیر کنترلی', message: 'متن' };
const SUP = { company: 'تامین آزمون', name: 'آقای تامین', phone: '09350000002', category: 'فلنج', type: 'نماینده', brands: 'KSB', payTerms: 'cash', message: 'm' };

(async function main() {
  console.log('── E2E v34.39.41 — اعلان ثبت از سایت (php-wasm) ──');

  console.log('\n[0] کامپایل کامل api/crm.php (معادل php -l)');
  {
    const r = await request({ code: `<?php ${MB} try { $c = file_get_contents('/w/repo/api/crm.php'); eval('return; ?>' . $c); echo 'PARSE-OK'; } catch (ParseError $e) { echo 'PARSE-ERR: ' . $e->getMessage() . ' @' . $e->getLine(); }` });
    T('api/crm.php بدون خطای نحوی کامپایل می‌شود', r.stdout.indexOf('PARSE-OK') > -1, r.stdout + r.stderr);
  }

  console.log('\n[1] ثبت استعلام از سایت (add_rfq_site)');
  {
    const r = await request({ code: post('add_rfq_site', RFQ) });
    let j = {}; try { j = parseJson(r.stdout); } catch (e) { j = { raw: r.stdout + r.stderr }; }
    T('پاسخ ok + کد پیگیری', j.ok === true && /^PTF-RFQ-/.test(j.code || ''), JSON.stringify(j));
    T('پاسخ JSON خالص است (خروجی اضافه پس از پاسخ نیست)', /^\s*\{[\s\S]*\}\s*$/.test(r.stdout), r.stdout.slice(0, 200));
    T('استعلام در rfqs ذخیره شد', r.rfqs.length === 1 && r.rfqs[0].code === j.code);
    const sms = r.calls.filter(c => /kavenegar/.test(c.url));
    T('دقیقاً یک پیامک', sms.length === 1, JSON.stringify(r.calls).slice(0, 300));
    const u = sms[0] ? decodeURIComponent(sms[0].url) : '';
    T('پیامک به 09126473290', /receptor=09126473290/.test(u), u);
    T('متن پیامک: «استعلام جدید» + کد + شرکت + تلفن', u.indexOf('استعلام جدید') > -1 && u.indexOf(j.code) > -1 && u.indexOf('شرکت آزمون پالایش') > -1 && u.indexOf('09120000001') > -1, u);
    T('پیامک با خط و کلید API کانفیگ (پاک‌سازی خط تیرهٔ sms_cfg)', /\/v1\/KEY123\/sms\/send\.json/.test(u) && /sender=10004346/.test(u));
    const tg = r.calls.filter(c => /api\.telegram\.org\/bot111:TG\/sendMessage/.test(c.url));
    const bl = r.calls.filter(c => /tapi\.bale\.ai\/bot222:BL\/sendMessage/.test(c.url));
    T('پیام بات تلگرام به گروه', tg.length === 1);
    T('پیام بات بله به گروه', bl.length === 1);
    const tb = tg[0] ? JSON.parse(tg[0].body) : {};
    T('chat_id گروه تلگرام (ارقام فارسی نرمال شد)', tb.chat_id === '-100123', tb.chat_id);
    T('متن بات: کد + شرکت + نام + موضوع + حوزه', ['استعلام جدید', j.code, 'شرکت آزمون پالایش', 'مهندس تست', 'استعلام شیر کنترلی', 'شیرآلات'].every(s => String(tb.text).indexOf(s) > -1), tb.text);
  }

  console.log('\n[2] ثبت‌نام تامین‌کننده از سایت (add_supplier)');
  {
    const r = await request({ code: post('add_supplier', SUP, true, true) });
    let j = {}; try { j = parseJson(r.stdout); } catch (e) { j = { raw: r.stdout + r.stderr }; }
    T('پاسخ ok + کد', j.ok === true && /^PTF-VEN-/.test(j.code || ''), JSON.stringify(j));
    T('تامین‌کننده ذخیره شد', r.sups.length === 1 && r.sups[0].code === j.code);
    const sms = r.calls.filter(c => /kavenegar/.test(c.url)).map(c => decodeURIComponent(c.url));
    T('پیامک «تامین‌کننده جدید» به 09126473290 با کد و تلفن', sms.length === 1 && /receptor=09126473290/.test(sms[0]) && sms[0].indexOf('تامین‌کننده جدید') > -1 && sms[0].indexOf(j.code) > -1 && sms[0].indexOf('09350000002') > -1, sms[0]);
    const bots = r.calls.filter(c => /sendMessage/.test(c.url)).map(c => JSON.parse(c.body).text);
    T('بات (تلگرام + بله) با برندها و حوزه', bots.length === 2 && bots.every(t => t.indexOf('تامین‌کننده جدید') > -1 && t.indexOf('KSB') > -1 && t.indexOf('فلنج') > -1 && t.indexOf(j.code) > -1), bots.join(' || '));
  }

  console.log('\n[3] کپچای نامعتبر ⇒ نه ثبت، نه پیامک');
  {
    const r = await request({ code: post('add_rfq_site', RFQ, false) });
    T('پاسخ خطای کپچا', /"error":"captcha"/.test(r.stdout), r.stdout);
    T('هیچ پیامک/پیام باتی ارسال نشد', r.calls.length === 0, JSON.stringify(r.calls));
    T('چیزی ذخیره نشد', r.rfqs.length === 0);
  }

  console.log('\n[4] شماره تامین‌کننده نامعتبر ⇒ بدون اعلان');
  {
    const r = await request({ code: post('add_supplier', Object.assign({}, SUP, { phone: '123' }), true, true) });
    T('ثبت رد شد و هیچ اعلانی نرفت', r.calls.length === 0 && r.sups.length === 0, r.stdout.slice(0, 200));
  }

  console.log('\n[5] گیرندگان سفارشی (site_alert_mobiles)');
  {
    const r = await request({ smsMobiles: ['09121111111', '09122222222'], code: post('add_rfq_site', RFQ) });
    const rc = r.calls.filter(c => /kavenegar/.test(c.url)).map(c => (decodeURIComponent(c.url).match(/receptor=(\d+)/) || [])[1]);
    T('پیامک به هر دو شمارهٔ کانفیگ (و نه پیش‌فرض)', rc.join(',') === '09121111111,09122222222', rc.join(','));
  }

  console.log('\n[6] خرابی سرویس‌ها فرم را خراب نمی‌کند');
  {
    const r = await request({ curlMode: 'fail', code: post('add_rfq_site', RFQ) });
    let j = {}; try { j = parseJson(r.stdout); } catch (e) {}
    T('پیامک و بات هر دو خطا ⇒ ثبت همچنان ok و ذخیره شده', j.ok === true && r.rfqs.length === 1, r.stdout.slice(0, 200));
    T('خطای کاوه‌نگار فقط یک‌بار (بدون تلاش مجدد بی‌مورد) و بات هر دو کانال تلاش شد', r.calls.filter(c => /kavenegar/.test(c.url)).length === 1 && r.calls.filter(c => /sendMessage/.test(c.url)).length === 2);
    const r2 = await request({ curlMode: 'botfail', code: post('add_rfq_site', RFQ) });
    T('فقط بات خطا ⇒ پیامک ارسال شده و ثبت ok', /"ok":true/.test(r2.stdout) && r2.calls.filter(c => /kavenegar/.test(c.url)).length === 1);
  }

  console.log('\n[7] بدون bot-config ⇒ فقط پیامک؛ بدون sms-config ⇒ فقط بات');
  {
    const r = await request({ bot: false, code: post('add_rfq_site', RFQ) });
    T('بدون bot-config: پیامک رفت، هیچ درخواست بات نیست، ثبت ok', /"ok":true/.test(r.stdout) && r.calls.length === 1 && /kavenegar/.test(r.calls[0].url), JSON.stringify(r.calls).slice(0, 200));
    const r2 = await request({ sms: false, code: post('add_rfq_site', RFQ) });
    T('بدون sms-config: فقط دو پیام بات، ثبت ok', /"ok":true/.test(r2.stdout) && r2.calls.length === 2 && r2.calls.every(c => /sendMessage/.test(c.url)), JSON.stringify(r2.calls).slice(0, 200));
  }

  console.log('\n=== E2E v34.39.41 site-alert: ' + R.pass + ' PASS / ' + R.fail + ' FAIL ===');
  process.exit(R.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
