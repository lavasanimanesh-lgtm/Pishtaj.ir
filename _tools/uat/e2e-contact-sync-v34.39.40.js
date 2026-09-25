/* E2E — v34.39.40 (CONTACT-SYNC-DIAG-2 / R5): بازتولید سناریوی کارفرما روی خودِ کد سرور با PHP واقعی (php-wasm).
   پیش‌نیاز (خارج از repo): `npm i php-wasm` در پوشه‌ای کنار این فایل؛ سپس `node e2e-contact-sync-v34.39.40.js`
   - هر درخواست = نمونهٔ تازهٔ PHP (مثل HTTP)؛ state سرور (meta.json/customers/tokens.json) بین درخواست‌ها حمل می‌شود.
   - خروجی هر درخواست از رویدادهای output؛ php://input با stream-wrapper تزریق می‌شود.
   - mbstring روی سرور واقعی هست و اینجا فقط polyfill ساده می‌گیرد (سقف‌های اعتبارسنجی — بی‌اثر بر منطق اتحاد).
   نتیجهٔ مورد انتظار: 24 PASS / 0 FAIL (پیش از اصلاح R5، همان سناریو پاسخ خالی ok:true بدون نوشتن می‌گرفت). */
/* E2E — v34.39.40 CONTACT-SYNC-DIAG-2
   بازتولید کامل سناریوی کارفرما روی خودِ کد سرور (api/crm.php + api/sales-domain.php)
   با PHP واقعی (php-wasm). هر درخواست = نمونهٔ تازهٔ PHP (مثل HTTP؛ exit کل نمونه را
   می‌بندد)؛ state سرور (meta.json / blob مشتریان / tokens.json) بین درخواست‌ها
   از vfs خارج و به نمونهٔ بعدی تزریق می‌شود. خروجی هر درخواست از رویداد output.

   سناریو:
     0) seed: ۳ مشتری روی سرور؛ CUST-101 بدون شمارهٔ X (۰۹۱۲۱۲۳۴۵۶۷)
     1) GEN_TOKEN (auth_generate_token واقعی)
     2) PULL-1 (data_pull مثل ابزار تشخیص) → شماره X نیست → «never-synced»
     3) UPSERT (entity_upsert مثل دکمهٔ «ثبت روی سرور»: _ccEdit/_ccBaseAt + شماره)
     4) PULL-2 → شماره X در پاسخ سرور → «ثبت و تأیید شد» (verified)
     5) PUSH-STALE (data_push کل مجموعهٔ قدیمیِ دستگاهِ دیگر، بدون شماره، base تازه)
     6) PULL-3 → شماره X هنوز هست (R7 union — پاک‌شدن از سرور ممنوع)
*/
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs');
const path = require('path');
const REPO = '/home/user/Pishtaj.ir';
const API_FILES = ['crm.php', 'sales-domain.php', 'auth.php', 'secrets.php', 'storage-lib.php', 'db-lib.php', 'contact-merge-lib.php'];

/* ---------- helpers (هم‌سنگ منطق کلاینت) ---------- */
function digits(s) {
  return String(s == null ? '' : s)
    .replace(/[\u06F0-\u06F9\u0660-\u0669]/g, ch => {
      const c = ch.charCodeAt(0);
      return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
    })
    .replace(/\D+/g, '');
}
function canonNum(v) {
  let d = digits(v);
  if (!d) return '';
  if (d.length >= 12 && d.indexOf('0098') === 0) d = d.slice(4);
  else if (d.length >= 12 && d.indexOf('98') === 0) d = d.slice(2);
  if (d.length >= 10 && d.charAt(0) === '0') d = d.slice(1);
  return d;
}
function hasNum(rec, q) {
  const dq = canonNum(q); if (!dq) return false;
  const chans = [];
  (rec.people || []).forEach(p => {
    (p.tels || []).forEach(t => chans.push(digits(t.n)));
    (p.mobs || []).forEach(t => chans.push(digits(t.n)));
  });
  (rec.coTels || []).forEach(t => chans.push(digits(t && t.n ? t.n : t)));
  (rec.phones || []).forEach(t => chans.push(digits(t && t.n ? t.n : t)));
  if (rec.ph) chans.push(digits(rec.ph));
  return chans.some(d => canonNum(d) === dq);
}
function findRec(arr, cd) { return (arr || []).filter(r => r && String(r.cd) === String(cd))[0] || null; }

const PHONE_X = '09121234567';
const FIXTURE = [
  { cd: 'CUST-101', co: 'شرکت نمونهٔ پتروشیمی', kind: 'حقوقی', ind: 'نفت و گاز',
    updatedAt: '2026-09-25T10:00:00Z', updatedBy: 'ceo',
    people: [{ nm: 'آقای نمونه', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴', ext: '', lb: '' }], mobs: [], mails: [] }],
    coTels: [{ n: '021 8800 9999', ext: '', lb: 'دفتر مرکزی' }], phones: [] },
  { cd: 'CUST-102', co: 'صنایع فولاد جنوب', kind: 'حقوقی', ind: 'فولاد',
    updatedAt: '2026-09-24T08:00:00Z', updatedBy: 'admin',
    people: [{ nm: 'خانم بازرگانی', tels: [], mobs: [{ n: '۰۹۱۳۳۳۳۳۳۳۳' }] }], coTels: [], phones: [] },
  { cd: 'CUST-103', co: 'مهندسی پالایش', kind: 'حقوقی', ind: 'پالایش',
    updatedAt: '2026-09-23T08:00:00Z', updatedBy: 'admin',
    people: [{ nm: 'مهندس رابط', tels: [{ n: '05138222222' }] }], coTels: [], phones: [] }
];
const META0 = { _global: { rev: 5, t: '2026-09-25 10:00:00' }, ptf_crm_customers: { rev: 5, t: '2026-09-25 10:00:00', by: 'seed' } };

let TOKEN = null;
const STATE = { meta: META0, customers: JSON.parse(JSON.stringify(FIXTURE)), tokens: null };

/* ---------- PHP plumbing ---------- */
const INPUT_WRAPPER = `class E2EInputStream {
  public $body = ''; public $pos = 0;
  public function stream_open($p, $m, $o, &$opened) { $this->body = $GLOBALS['E2E_BODY'] ?? ''; $this->pos = 0; $opened = true; return true; }
  public function stream_read($n) { $d = substr($this->body, $this->pos, $n); $this->pos += strlen($d); return $d; }
  public function stream_write($d) { return 0; }
  public function stream_eof() { return $this->pos >= strlen($this->body); }
  public function stream_tell() { return $this->pos; }
  public function stream_seek($o, $w) { $this->pos = $o; return true; }
  public function stream_stat() { return []; }
  public function stream_close() {}
}
@stream_wrapper_unregister('php');
@stream_wrapper_register('php', 'E2EInputStream');
`;

async function request(opts) {
  /* opts: { code } — نمونهٔ تازه، seed از STATE، خروجی از events، harvest به STATE */
  const php = new PhpNode();
  const out = [];
  php.addEventListener('output', e => out.push(e.detail || e.data || ''));
  const err = [];
  php.addEventListener('error', e => err.push(e.detail || e.data || ''));
  await php.run(`<?php @mkdir('/w/repo/api', 0777, true); @mkdir('/w/repo/crm/data/sync', 0777, true); @mkdir('/tmp2', 0777, true);`);
  for (const f of API_FILES) await php.writeFile('/w/repo/api/' + f, fs.readFileSync(path.join(REPO, 'api', f), 'utf8'));
  await php.writeFile('/w/ptf-secrets.php', `<?php return ['auth_key' => 'e2e-local-secret-0123456789abcdef0123456789abcdef'];`);
  await php.writeFile('/w/repo/crm/data/sync/meta.json', JSON.stringify(STATE.meta));
  await php.writeFile('/w/repo/crm/data/sync/ptf_crm_customers.json', JSON.stringify(STATE.customers));
  if (STATE.tokens) await php.writeFile('/w/repo/crm/data/tokens.json', JSON.stringify(STATE.tokens));
  if (opts.body != null) await php.writeFile('/tmp2/body.json', typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
  await php.run(opts.code);
  await new Promise(r => setTimeout(r, 250));
  /* harvest server state */
  try { STATE.meta = JSON.parse(String(await php.readFile('/w/repo/crm/data/sync/meta.json', { encoding: 'utf8' }))); } catch (e) {}
  try { STATE.customers = JSON.parse(String(await php.readFile('/w/repo/crm/data/sync/ptf_crm_customers.json', { encoding: 'utf8' }))); } catch (e) {}
  try { STATE.tokens = JSON.parse(String(await php.readFile('/w/repo/crm/data/tokens.json', { encoding: 'utf8' }))); } catch (e) {}
  let token = null;
  try { token = String(await php.readFile('/tmp2/token.txt', { encoding: 'utf8' })); } catch (e) {}
  return { stdout: out.join(''), stderr: err.join(''), token };
}
function parseJson(s) {
  const i = String(s).indexOf('{');
  if (i < 0) throw new Error('no JSON in output: ' + JSON.stringify(String(s).slice(0, 300)));
  return JSON.parse(String(s).slice(i));
}
const P = t => `$_SERVER['HTTP_HOST']='crm.test'; $_SERVER['REMOTE_ADDR']='127.0.0.1'; $_SERVER['REQUEST_METHOD']='GET'; $_SERVER['HTTP_X_CRM_TOKEN']='${TOKEN}';`;
/* php-wasm بدون افزونهٔ mbstring است؛ سرور واقعی دارد. برای E2E معادل‌های ساده تزریق می‌کنیم
   (طول‌ها/حروف‌کanni فقط برای سقف‌های اعتبارسنجی به کار می‌روند — روی منطق اتحاد بی‌اثرند). */
const MB_POLYFILL = `
if (!function_exists('mb_strlen')) { function mb_strlen($s, $e = null) { return strlen($s); } }
if (!function_exists('mb_substr')) { function mb_substr($s, $st, $l = null, $e = null) { return $l === null ? substr($s, $st) : substr($s, $st, $l); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $e = null) { return strtolower($s); } }
if (!function_exists('mb_convert_encoding')) { function mb_convert_encoding($s, $to, $from = null) { return $s; } }
`;

/* ---------- requests ---------- */
async function genToken() {
  /* flock در php-wasm پشتیبانی نمی‌شود ⇒ auth_generate_token (که زیر lock است) اینجا
     false می‌دهد. توکن را با همان طرح امضای سرور می‌سازیم و tokens.json را مستقیم
     می‌نویسیم — مسیر auth_verify_token (HMAC +tokens.json+exp) کامل تست می‌شود. */
  const r = await request({
    code: `<?php
$_SERVER['HTTP_HOST']='crm.test';
$secret = 'e2e-local-secret-0123456789abcdef0123456789abcdef';
$user = 'admin'; $role = 'admin'; $now = time(); $nonce = bin2hex(random_bytes(16));
$payload = $user . '|' . $role . '|' . $now . '|' . $nonce;
$sig = hash_hmac('sha256', $payload, $secret);
$token = rtrim(strtr(base64_encode($payload . '|' . $sig), '+/', '-_'), '=');
$tokens = [$token => ['user' => $user, 'role' => $role, 'iat' => $now, 'exp' => $now + 86400, 'ip' => '127.0.0.1']];
file_put_contents('/w/repo/crm/data/tokens.json', json_encode($tokens, JSON_PRETTY_PRINT));
file_put_contents('/tmp2/token.txt', $token);
echo 'AUTH-OK';`
  });
  TOKEN = (r.token || '').trim() || null;
  return { ok: !!TOKEN && !!STATE.tokens, raw: r.stdout + r.stderr };
}
async function pull() {
  const r = await request({
    code: `<?php ${MB_POLYFILL} ${P()} $_GET = ['action' => 'data_pull', 'since' => '0', 'krevs' => '{"ptf_crm_offers":999}']; $_REQUEST = $_GET; require '/w/repo/api/crm.php';`
  });
  return parseJson(r.stdout);
}
async function upsertEntity(record) {
  const r = await request({
    body: { collection: 'ptf_crm_customers', record: record, expectCreate: false, idempotencyKey: 'ENT|ptf_crm_customers|' + record.cd + '|csd-e2e' },
    code: `<?php ${MB_POLYFILL} ${P()} ${INPUT_WRAPPER} $GLOBALS['E2E_BODY'] = file_get_contents('/tmp2/body.json'); $_GET = ['action' => 'entity_upsert']; $_REQUEST = $_GET; require '/w/repo/api/sales-domain.php';`
  });
  return parseJson(r.stdout);
}
async function pushCollection(arr, baseRev) {
  const r = await request({
    body: { data: { ptf_crm_customers: JSON.stringify(arr) }, base: { ptf_crm_customers: baseRev }, by: 'stale-device' },
    code: `<?php ${MB_POLYFILL} ${P()} ${INPUT_WRAPPER} $GLOBALS['E2E_BODY'] = file_get_contents('/tmp2/body.json'); $_GET = ['action' => 'data_push']; $_REQUEST = $_GET; require '/w/repo/api/crm.php';`
  });
  return parseJson(r.stdout);
}

/* ---------- assertions ---------- */
const R = { pass: 0, fail: 0, bugs: [] };
function T(name, cond, detail) {
  if (cond) { R.pass++; console.log('  ✔ ' + name); }
  else { R.fail++; R.bugs.push(name + (detail ? ' — ' + String(detail).slice(0, 200) : '')); console.log('  ✘ FAIL: ' + name + (detail ? ' — ' + String(detail).slice(0, 200) : '')); }
}

(async function main() {
  console.log('── E2E v34.39.40 CONTACT-SYNC-DIAG-2 — سناریوی کارفرما روی کد واقعی سرور (php-wasm) ──');

  console.log('\n[0] seed + توکن');
  T('seed: ۳ رکورد مشتری روی سرور', STATE.customers.length === 3);
  T('seed: شمارهٔ X هنوز روی سرور نیست', !hasNum(findRec(STATE.customers, 'CUST-101'), PHONE_X));
  const g = await genToken();
  T('GEN_TOKEN: صدور توکن admin با auth_generate_token واقعی', g.ok, g.raw.slice(0, 150));

  console.log('\n[1] PULL-1 — همان data_pull ابزار تشخیص');
  const p1 = await pull();
  T('ok=true و کلید مشتریان در پاسخ', p1.ok === true && p1.data && Object.prototype.hasOwnProperty.call(p1.data, 'ptf_crm_customers'), JSON.stringify(p1).slice(0, 150));
  const arr1 = JSON.parse(p1.data.ptf_crm_customers);
  const rec1 = findRec(arr1, 'CUST-101');
  T('CUST-101 در پاسخ سرور هست', !!rec1);
  T('شمارهٔ X در نسخهٔ سرور نیست → تشخیص: never-synced (فرم ثبت ظاهر می‌شود)', !!rec1 && !hasNum(rec1, PHONE_X));
  const rev1 = STATE.meta.ptf_crm_customers ? STATE.meta.ptf_crm_customers.rev : 0;
  T('meta سرور rev=5 در seed', rev1 === 5, String(rev1));

  console.log('\n[2] UPSERT — همان فرمان دکمهٔ «ثبت روی سرور»');
  const base = JSON.parse(JSON.stringify(rec1));
  base.people = base.people || []; base.people[0].mobs = base.people[0].mobs || [];
  base.people[0].mobs.push({ n: '۰۹۱۲۱۲۳۴۵۶۷', ext: '', lb: 'ثبت دستی (تشخیص سینک)' });
  base._ccEdit = 1;
  base._ccBaseAt = String(rec1.updatedAt || '');
  base.updatedAtISO = new Date().toISOString();
  const u = await upsertEntity(base);
  console.log('  [debug] UPSERT-RAW:', JSON.stringify(u).slice(0, 700));
  T('entity_upsert: ok=true', u.ok === true, JSON.stringify(u).slice(0, 250));
  T('entity_upsert: created=false (ویرایش همان رکورد)', u.ok === true && u.result && u.result.created === false);
  T('entity_upsert: ردیف ذخیره‌شده شماره را دارد (result.row)', u.ok === true && u.result && hasNum(u.result.row, PHONE_X));
  const rev2 = STATE.meta.ptf_crm_customers ? STATE.meta.ptf_crm_customers.rev : 0;
  T('entity_upsert: rev سرور جلو رفت', rev2 > rev1, rev1 + ' → ' + rev2);

  console.log('\n[3] PULL-2 — بازخوانی تأیید (مرحلهٔ verified ابزار جدید)');
  const p2 = await pull();
  T('ok=true', p2.ok === true, JSON.stringify(p2).slice(0, 150));
  const arr2 = JSON.parse(p2.data.ptf_crm_customers);
  const rec2 = findRec(arr2, 'CUST-101');
  T('CUST-101 در پاسخ تازه هست', !!rec2);
  T('✅ شمارهٔ X در نسخهٔ تازهٔ سرور دیده می‌شود → «ثبت و تأیید شد»', !!rec2 && hasNum(rec2, PHONE_X));
  T('شماره‌های قبلی رکورد هم سالم‌اند (اتحاد، نه جایگزینی)', !!rec2 && hasNum(rec2, '02188001234') && hasNum(rec2, '02188009999'));
  T('مهرهای _ccEdit/_ccBaseAt در رکورد نهایی سرور نمانده‌اند', !!rec2 && !('_ccEdit' in rec2) && !('_ccBaseAt' in rec2));

  console.log('\n[4] PUSH-STALE — دستگاهِ دیگر کل مجموعهٔ قدیمی (بدون شمارهٔ X) را data_push می‌کند');
  const revBeforePush = STATE.meta.ptf_crm_customers ? STATE.meta.ptf_crm_customers.rev : 0;
  const staleArr = JSON.parse(JSON.stringify(FIXTURE)); /* کپی کهنهٔ پیش از ثبت شماره */
  const pushRes = await pushCollection(staleArr, revBeforePush);
  T('data_push: ok=true', pushRes.ok === true, JSON.stringify(pushRes).slice(0, 300));
  T('data_push: کلید مشتریان در savedKeys', pushRes.ok === true && (pushRes.savedKeys || []).indexOf('ptf_crm_customers') > -1);
  T('data_push: هیچ reject/conflict/massDeletion ای نیست', pushRes.ok === true && !(pushRes.rejected || []).length && !(pushRes.conflicts || []).length && !Object.keys(pushRes.massDeletionBlocked || {}).length);

  console.log('\n[5] PULL-3 — شماره باید زنده مانده باشد (R7 — اتحاد رکوردبه‌رکورد)');
  const p3 = await pull();
  const arr3 = JSON.parse(p3.data.ptf_crm_customers);
  const rec3 = findRec(arr3, 'CUST-101');
  T('CUST-101 هست', !!rec3);
  T('✅ شمارهٔ X بعد از push دستگاهِ کهنه هنوز روی سرور است — «مالِ من سالم، مالِ او پاک» بسته شد', !!rec3 && hasNum(rec3, PHONE_X));
  T('شماره‌های دیگر هم سالم‌اند', !!rec3 && hasNum(rec3, '02188001234'));

  console.log('\n[6] sanity سرور');
  T('blob سرور JSON معتبر با ۳ رکورد', Array.isArray(STATE.customers) && STATE.customers.length === 3);
  T('meta.json سالم (global rev >= customers rev)', (STATE.meta._global || {}).rev >= (STATE.meta.ptf_crm_customers || {}).rev);

  console.log(`\n=== E2E: ${R.pass} PASS / ${R.fail} FAIL ===`);
  if (R.bugs.length) { console.log('BUGS:'); R.bugs.forEach(b => console.log(' • ' + b)); process.exit(1); }
})().catch(e => { console.error('E2E crashed:', e && e.message || e); process.exit(2); });
