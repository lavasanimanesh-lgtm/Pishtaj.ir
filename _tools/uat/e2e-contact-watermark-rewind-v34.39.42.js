/* RCA harness — سناریوی واقعیِ «فرم مشتری» روی کد واقعیِ سرور (php-wasm)
   تفاوت با e2e-contact-sync-v34.39.40: آن سناریوی «ابزار تشخیص» است، این سناریوی
   saveCust2 (فرم ویرایش مشتری) + نویسندهٔ دوم + هوک phonefmt. */
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs');
const path = require('path');
const REPO = process.env.PTF_REPO || '/home/user/Pishtaj.ir';
const API_FILES = ['crm.php', 'sales-domain.php', 'auth.php', 'secrets.php', 'storage-lib.php', 'db-lib.php', 'contact-merge-lib.php'];
const INPUT_WRAPPER = `class E2EInputStream {
  public $body=''; public $pos=0;
  public function stream_open($p,$m,$o,&$opened){ $this->body=$GLOBALS['E2E_BODY']??''; $this->pos=0; $opened=true; return true; }
  public function stream_read($n){ $d=substr($this->body,$this->pos,$n); $this->pos+=strlen($d); return $d; }
  public function stream_write($d){ return 0; }
  public function stream_eof(){ return $this->pos>=strlen($this->body); }
  public function stream_tell(){ return $this->pos; }
  public function stream_seek($o,$w){ $this->pos=$o; return true; }
  public function stream_stat(){ return []; }
  public function stream_close(){}
}
@stream_wrapper_unregister('php');
@stream_wrapper_register('php','E2EInputStream');`;
const MB = `
if (!function_exists('mb_strlen')) { function mb_strlen($s,$e=null){ return strlen($s); } }
if (!function_exists('mb_substr')) { function mb_substr($s,$st,$l=null,$e=null){ return $l===null?substr($s,$st):substr($s,$st,$l); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s,$e=null){ return strtolower($s); } }
if (!function_exists('mb_convert_encoding')) { function mb_convert_encoding($s,$t,$f=null){ return $s; } }
`;

let TOKEN = null;
const STATE = { meta: null, customers: null, tokens: null };

async function request(opts) {
  const php = new PhpNode();
  const out = [], err = [];
  php.addEventListener('output', e => out.push(e.detail || e.data || ''));
  php.addEventListener('error', e => err.push(e.detail || e.data || ''));
  await php.run(`<?php @mkdir('/w/repo/api',0777,true); @mkdir('/w/repo/crm/data/sync',0777,true); @mkdir('/tmp2',0777,true);`);
  for (const f of API_FILES) await php.writeFile('/w/repo/api/' + f, fs.readFileSync(path.join(REPO, 'api', f), 'utf8'));
  await php.writeFile('/w/ptf-secrets.php', `<?php return ['auth_key' => 'e2e-local-secret-0123456789abcdef0123456789abcdef'];`);
  await php.writeFile('/w/repo/crm/data/sync/meta.json', JSON.stringify(STATE.meta));
  await php.writeFile('/w/repo/crm/data/sync/ptf_crm_customers.json', JSON.stringify(STATE.customers));
  if (STATE.tokens) await php.writeFile('/w/repo/crm/data/tokens.json', JSON.stringify(STATE.tokens));
  if (opts.body != null) await php.writeFile('/tmp2/body.json', typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
  await php.run(opts.code);
  await new Promise(r => setTimeout(r, 180));
  try { STATE.meta = JSON.parse(String(await php.readFile('/w/repo/crm/data/sync/meta.json', { encoding: 'utf8' }))); } catch (e) {}
  try { STATE.customers = JSON.parse(String(await php.readFile('/w/repo/crm/data/sync/ptf_crm_customers.json', { encoding: 'utf8' }))); } catch (e) {}
  try { STATE.tokens = JSON.parse(String(await php.readFile('/w/repo/crm/data/tokens.json', { encoding: 'utf8' }))); } catch (e) {}
  let token = null;
  try { token = String(await php.readFile('/tmp2/token.txt', { encoding: 'utf8' })); } catch (e) {}
  return { stdout: out.join(''), stderr: err.join(''), token };
}
function parseJson(s) {
  const i = String(s).indexOf('{');
  if (i < 0) return { __raw: String(s).slice(0, 300), __nojson: true };
  try { return JSON.parse(String(s).slice(i)); } catch (e) { return { __raw: String(s).slice(0, 300), __badjson: true }; }
}
const P = t => `$_SERVER['HTTP_HOST']='crm.test'; $_SERVER['REMOTE_ADDR']='127.0.0.1'; $_SERVER['REQUEST_METHOD']='GET'; $_SERVER['HTTP_X_CRM_TOKEN']='${TOKEN}';`;

async function genToken() {
  const r = await request({ code: `<?php
$secret='e2e-local-secret-0123456789abcdef0123456789abcdef';
$user='admin'; $role='admin'; $now=time(); $nonce=bin2hex(random_bytes(16));
$payload=$user.'|'.$role.'|'.$now.'|'.$nonce;
$sig=hash_hmac('sha256',$payload,$secret);
$token=rtrim(strtr(base64_encode($payload.'|'.$sig),'+/','-_'),'=');
$tokens=[$token=>['user'=>$user,'role'=>$role,'iat'=>$now,'exp'=>$now+86400,'ip'=>'127.0.0.1']];
file_put_contents('/w/repo/crm/data/tokens.json', json_encode($tokens));
file_put_contents('/tmp2/token.txt',$token); echo 'AUTH-OK';` });
  TOKEN = (r.token || '').trim() || null;
  return !!TOKEN;
}
async function pull() {
  const r = await request({ code: `<?php ${MB} ${P()} $_GET=['action'=>'data_pull','since'=>'0','krevs'=>'{"ptf_crm_offers":999}']; $_REQUEST=$_GET; require '/w/repo/api/crm.php';` });
  return parseJson(r.stdout);
}
async function upsert(rec) {
  const r = await request({
    body: { collection: 'ptf_crm_customers', record: rec, expectCreate: false, idempotencyKey: 'ENT|ptf_crm_customers|' + rec.cd + '|' + Math.random() },
    code: `<?php ${MB} ${P()} ${INPUT_WRAPPER} $GLOBALS['E2E_BODY']=file_get_contents('/tmp2/body.json'); $_GET=['action'=>'entity_upsert']; $_REQUEST=$_GET; require '/w/repo/api/sales-domain.php';`
  });
  return parseJson(r.stdout);
}
async function push(arr, baseRev) {
  const r = await request({
    body: { data: { ptf_crm_customers: JSON.stringify(arr) }, base: { ptf_crm_customers: baseRev }, by: 'stale-device' },
    code: `<?php ${MB} ${P()} ${INPUT_WRAPPER} $GLOBALS['E2E_BODY']=file_get_contents('/tmp2/body.json'); $_GET=['action'=>'data_push']; $_REQUEST=$_GET; require '/w/repo/api/crm.php';`
  });
  return parseJson(r.stdout);
}

/* ---------- helpers ---------- */
const FA = s => String(s == null ? '' : s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
function digits(s) { return String(s == null ? '' : s).replace(/[\u06F0-\u06F9\u0660-\u0669]/g, ch => { const c = ch.charCodeAt(0); return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660); }).replace(/\D+/g, ''); }
function canon(v) { let d = digits(v); if (!d) return ''; if (d.length >= 12 && d.indexOf('0098') === 0) d = d.slice(4); else if (d.length >= 12 && d.indexOf('98') === 0) d = d.slice(2); if (d.length >= 10 && d[0] === '0') d = d.slice(1); return d; }
function chans(r) { const o = []; (r.people || []).forEach(p => { (p.tels || []).forEach(t => o.push(digits(t.n))); (p.mobs || []).forEach(t => o.push(digits(t.n))); (p.mails || []).forEach(t => o.push(digits(t.n))); }); (r.coTels || []).forEach(t => o.push(digits(t && t.n != null ? t.n : t))); (r.phones || []).forEach(t => o.push(digits(t && t.n != null ? t.n : t))); if (r.ph) o.push(digits(r.ph)); return o; }
function hasNum(r, q) { const dq = canon(q); if (!dq) return false; return chans(r).some(d => canon(d) === dq); }
function findRec(a, cd) { return (a || []).filter(r => r && String(r.cd) === String(cd))[0] || null; }
const srvRec = cd => findRec(STATE.customers, cd);
const revOf = k => (STATE.meta && STATE.meta[k] ? STATE.meta[k].rev : 0);

/* شبیه‌سازیِ saveCust2: payloadِ فرم از روی رکوردِ دیده‌شدهٔ دستگاه */
function formPayload(local, opts) {
  opts = opts || {};
  const rec = {};
  ['cd', 'co', 'coEn', 'creditLimit', 'kind', 'venSt', 'venNo', 'natId', 'melli', 'ind'].forEach(k => { if (local[k] !== undefined) rec[k] = local[k]; });
  rec.people = opts.people !== undefined ? opts.people : (local.people || []);
  rec.coTels = opts.coTels !== undefined ? opts.coTels : (local.coTels || []);
  rec.coWeb = local.coWeb || ''; rec.coAddr = local.coAddr || '';
  rec.owner = local.owner || '';
  if (opts.phones !== undefined) rec.phones = opts.phones;
  rec.con = (rec.people[0] && rec.people[0].nm) || '';
  const p0 = rec.people[0];
  rec.ph = p0 && p0.tels && p0.tels.length ? p0.tels[0].n : (p0 && p0.mobs && p0.mobs.length ? p0.mobs[0].n : '');
  for (const k in local) if (!(k in rec)) rec[k] = local[k];       /* v34.29.7: حفظ فیلدهای مدیریت‌نشده */
  if (opts.clearAll) { rec.people = []; rec.coTels = []; rec.phones = []; rec.ph = ''; rec._ccClear = 1; }
  rec.updatedAtISO = new Date().toISOString();
  if (opts.baseAt !== undefined) { rec._ccEdit = 1; if (opts.baseAt) rec._ccBaseAt = opts.baseAt; }
  return rec;
}
/* هوک phonefmt: فارسی‌سازی ارقام (قبل از ارسال) */
function faNorm(rec) {
  const n = o => { if (o && o.n != null) o.n = FA(o.n); };
  (rec.coTels || []).forEach(n); (rec.phones || []).forEach(n);
  (rec.people || []).forEach(p => { (p.tels || []).forEach(n); (p.mobs || []).forEach(n); });
  ['ph', 'mob', 'tel'].forEach(k => { if (rec[k]) rec[k] = FA(rec[k]); });
  return rec;
}

const SEED = () => ([{
  cd: 'CUST-201', co: 'شرکت نمونه', kind: 'حقوقی', ind: 'نفت و گاز',
  updatedAt: '2026-09-20T08:00:00Z', updatedBy: 'admin',
  people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [], mails: [] }],
  coTels: [{ n: '۰۲۱۸۸۰۰۹۹۹۹', lb: 'دفتر مرکزی' }], phones: []
}]);
const META0 = { _global: { rev: 10, t: '2026-09-20 08:00:00' }, ptf_crm_customers: { rev: 10, t: '2026-09-20 08:00:00', by: 'seed' } };

const R = { pass: 0, fail: 0, bugs: [] };
function T(name, cond, detail) {
  if (cond) { R.pass++; console.log('   ✔ ' + name); }
  else { R.fail++; R.bugs.push(name); console.log('   ✘ FAIL: ' + name + (detail ? '  → ' + String(detail).slice(0, 220) : '')); }
}

async function scenario(title, fn) {
  console.log('\n─── ' + title);
  STATE.meta = JSON.parse(JSON.stringify(META0));
  STATE.customers = SEED();
  STATE.tokens = null; TOKEN = null;
  await genToken();
  await fn();
}

(async function main() {
  console.log('══ RCA — سناریوی فرم مشتری روی کد واقعی سرور (php-wasm) ══');
  const NEW_MOB = '09196660759';   /* شمارهٔ عباس رجایی‌زاده در گزارش کارفرما */

  await scenario('A) ویرایش تک‌دستگاهه: افزودن موبایل (پایه = تازه)', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB, lb: 'موبایل' }], mails: [] }],
      baseAt: String(local.updatedAt || '')
    }));
    const u = await upsert(rec);
    T('A1 entity_upsert ok', u.ok === true, JSON.stringify(u).slice(0, 200));
    T('A2 شمارهٔ نو در پاسخ فرمان هست', u.ok && u.result && hasNum(u.result.row, NEW_MOB), JSON.stringify(u.result && u.result.sanitize));
    T('A3 شماره روی فایل سرور ماند', hasNum(srvRec('CUST-201'), NEW_MOB));
    T('A4 rev جلو رفت', revOf('ptf_crm_customers') > 10, String(revOf('ptf_crm_customers')));
  });

  await scenario('B) همان ویرایش + فرمان دومِ هوک phonefmt (بدون cb)', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB, lb: 'موبایل' }], mails: [] }],
      baseAt: String(local.updatedAt || '')
    }));
    await upsert(rec);
    /* هوک: رکورد از کش محلی (همان rec) دوباره upsert می‌شود — بدون _ccBaseAt تازه */
    const hookRec = JSON.parse(JSON.stringify(rec));
    await upsert(hookRec);
    T('B1 شماره بعد از فرمان دوم هم روی سرور هست', hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').people));
  });

  await scenario('C) دستگاهِ کهنه (بدون شماره، بدون updatedAtISO) کل مجموعه را data_push می‌کند', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: String(local.updatedAt || '')
    }));
    await upsert(rec);
    const stale = SEED();                       /* نسخهٔ کهنهٔ دستگاه دیگر: شمارهٔ نو را ندارد */
    const pr = await push(stale, revOf('ptf_crm_customers'));
    T('C1 data_push ok', pr.ok === true, JSON.stringify(pr).slice(0, 200));
    T('C2 شمارهٔ نو پس از push دستگاه کهنه زنده ماند', hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').people));
  });

  await scenario('D) ⚠ پایهٔ تازه + محتوای کهنه: دستگاه updatedAt برابر سرور دارد ولی شماره را ندارد', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: String(local.updatedAt || '')
    }));
    await upsert(rec);
    /* دستگاه کهنه‌ای که «همین الان» چیزی ذخیره کرده (updatedAtISO تازه) ولی محتوایش کهنه است
       و updatedAt محلی‌اش برابر updatedAt سرور است (مثلاً projection اعمال نشده/کش کهنه) */
    const stale = SEED();
    stale[0].updatedAtISO = new Date(Date.now() + 60000).toISOString();  /* تازه‌تر از سرور */
    stale[0].updatedAt = srvRec('CUST-201').updatedAt;                   /* دقیقاً برابر سرور */
    const pr = await push(stale, revOf('ptf_crm_customers'));
    T('D1 data_push ok', pr.ok === true, JSON.stringify(pr).slice(0, 200));
    T('D2 ⚠ شمارهٔ نو پس از push «پایه‌تازه/محتوای‌کهنه» زنده ماند؟', hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').people));
  });

  await scenario('E) مشتری حقیقی: شماره فقط در phones[]', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    local.kind = 'حقیقی';
    const rec = faNorm(formPayload(local, { people: [], coTels: [], phones: [{ k: 'mob', n: NEW_MOB, lb: 'شخصی' }], baseAt: String(local.updatedAt || '') }));
    const u = await upsert(rec);
    T('E1 entity_upsert ok', u.ok === true, JSON.stringify(u).slice(0, 200));
    T('E2 phones[] روی سرور ماند', hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').phones));
  });

  await scenario('F) دو دستگاه هم‌زمان: یکی پایهٔ تازه، یکی پایهٔ کهنه', async () => {
    const p1 = await pull();
    const d1 = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const M1 = '09120000001', M2 = '09120000002';
    /* دستگاه ۱: پایه تازه → شمارهٔ ۱ */
    await upsert(faNorm(formPayload(d1, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: M1 }], mails: [] }],
      baseAt: String(d1.updatedAt || '')
    })));
    T('F1 شمارهٔ دستگاه ۱ روی سرور', hasNum(srvRec('CUST-201'), M1));
    /* دستگاه ۲: پایه کهنه (قبل از نوشتنِ ۱) → شمارهٔ ۲ */
    await upsert(faNorm(formPayload(JSON.parse(JSON.stringify(SEED()[0])), {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: M2 }], mails: [] }],
      baseAt: '2026-09-20T08:00:00Z'
    })));
    T('F2 شمارهٔ دستگاه ۱ هنوز هست', hasNum(srvRec('CUST-201'), M1), JSON.stringify(srvRec('CUST-201').people));
    T('F3 شمارهٔ دستگاه ۲ هم اضافه شد', hasNum(srvRec('CUST-201'), M2), JSON.stringify(srvRec('CUST-201').people));
  });

  await scenario('G) نویسندهٔ «غیرتماسی» (reason=vendorlist → کلیدهای تماس strip شده)', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: String(local.updatedAt || '')
    }));
    await upsert(rec);
    /* writer غیرتماسی: کلیدهای تماس از payload حذف شده‌اند (strip سمت کلاینت) */
    const strip = JSON.parse(JSON.stringify(srvRec('CUST-201')));
    delete strip.people; delete strip.coTels; delete strip.phones; delete strip.ph;
    strip.updatedAtISO = new Date().toISOString();
    const u2 = await upsert(strip);
    T('G1 upsert غیرتماسی ok', u2.ok === true, JSON.stringify(u2).slice(0, 200));
    T('G2 شماره با کلیدِ غایب حفظ شد (merge «غایب = تغییرنکرده»)',
      hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201')));
  });

  await scenario('H) پاک‌سازی آگاهانه (_ccClear) سپس افزودنِ دوباره', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const cleared = faNorm(formPayload(local, { clearAll: true, baseAt: String(local.updatedAt || '') }));
    const u1 = await upsert(cleared);
    T('H1 پاک‌سازی اعمال شد', !hasNum(srvRec('CUST-201'), '02188001234'), JSON.stringify(srvRec('CUST-201').people));
    const now = srvRec('CUST-201');
    const again = faNorm(formPayload(JSON.parse(JSON.stringify(now)), {
      people: [{ nm: 'آقای رابط', tels: [], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: String(now.updatedAt || '')
    }));
    const u2 = await upsert(again);
    T('H2 شمارهٔ تازه ثبت شد', u2.ok === true && hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').people));
  });


  await scenario('I) آیا data_push عمده‌فروشی updatedAt سرور را به عقب برمی‌گرداند؟', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const T1 = String(local.updatedAt || '');
    const rec = faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: T1
    }));
    await upsert(rec);
    const T2 = String(srvRec('CUST-201').updatedAt || '');
    T('I1 entity_upsert مهر updatedAt سرور را جلو برد', T2 !== T1, T1 + ' → ' + T2);
    const stale = SEED();                    /* updatedAt = T1، بدون شمارهٔ نو */
    await push(stale, revOf('ptf_crm_customers'));
    const T3 = String(srvRec('CUST-201').updatedAt || '');
    T('I2 محتوا بعد از push کهنه هنوز شماره را دارد (union)', hasNum(srvRec('CUST-201'), NEW_MOB), JSON.stringify(srvRec('CUST-201').people));
    T('I3 ⚠ مهر updatedAt سرور پس از push کهنه به عقب برگشت', T3 === T1, T1 + ' → ' + T2 + ' → ' + T3);
  });

  await scenario('J) ⚠ زنجیرهٔ کامل: push کهنه ⇒ عقب‌گرد مهر ⇒ ویرایشِ بعدی شماره را می‌شوید', async () => {
    const p1 = await pull();
    const local = findRec(JSON.parse(p1.data.ptf_crm_customers), 'CUST-201');
    const T1 = String(local.updatedAt || '');
    /* دستگاه A: شمارهٔ نو را با entity_upsert ثبت می‌کند */
    await upsert(faNorm(formPayload(local, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [{ n: NEW_MOB }], mails: [] }],
      baseAt: T1
    })));
    T('J1 شماره روی سرور ثبت شد', hasNum(srvRec('CUST-201'), NEW_MOB));
    /* دستگاه B (کهنه، شماره را ندارد) کل مجموعه را push می‌کند → union درست، ولی مهر به T1 برمی‌گردد */
    await push(SEED(), revOf('ptf_crm_customers'));
    T('J2 مهر سرور به مهرِ دستگاه کهنه برگشت', String(srvRec('CUST-201').updatedAt) === T1,
      T1 + ' / اکنون: ' + String(srvRec('CUST-201').updatedAt));
    /* دستگاه B همان مشتری را ویرایش می‌کند (مثلاً آدرس) — پایهٔ فرم = T1 = مهر سرور ⇒ «ویرایش تازه» ⇒ LWW */
    const bLocal = JSON.parse(JSON.stringify(SEED()[0]));
    bLocal.updatedAt = T1;
    const edit = faNorm(formPayload(bLocal, {
      people: [{ nm: 'آقای رابط', tels: [{ n: '۰۲۱۸۸۰۰۱۲۳۴' }], mobs: [], mails: [] }],
      baseAt: T1
    }));
    edit.coAddr = 'تهران — ویرایش شده توسط دستگاه کهنه';
    const u = await upsert(edit);
    T('J3 ویرایش دستگاه کهنه ok', u.ok === true, JSON.stringify(u).slice(0, 200));
    T('J4 ⚠ شمارهٔ دستگاه A پس از این ویرایش روی سرور ماند؟', hasNum(srvRec('CUST-201'), NEW_MOB),
      'people=' + JSON.stringify(srvRec('CUST-201').people));
    T('J5 آدرس جدید ثبت شد (یعنی ویرایش واقعاً اعمال شده)', srvRec('CUST-201').coAddr.indexOf('ویرایش شده') > -1);
  });

  console.log('\n══ نتیجه: ' + R.pass + ' PASS / ' + R.fail + ' FAIL ══');
  if (R.bugs.length) { console.log('موارد شکست:'); R.bugs.forEach(b => console.log('  • ' + b)); }
})();
