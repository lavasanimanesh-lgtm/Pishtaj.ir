'use strict';
/* PROBE 2 — رفتار تحویل/صف خروجی و کدهای خطای تلگرام (اجرای کد واقعی rfq-notify-lib.php) */
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs'), path = require('path');
const ROOT = '/home/user/Pishtaj.ir';
const LIB = fs.readFileSync(path.join(ROOT, 'api/rfq-notify-lib.php'), 'utf8');
let pass = 0, fail = 0;
function T(n, ok, d) { if (ok) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d !== undefined ? ' — ' + String(d).slice(0, 400) : '')); } }

const CURL = `
if(!function_exists('curl_init')){
 $GLOBALS['__curl']=[];
 function curl_init($u=null){$i=count($GLOBALS['__curl']);$GLOBALS['__curl'][$i]=['url'=>$u,'opts'=>[]];return $i;}
 function curl_setopt_array($h,$o){$GLOBALS['__curl'][$h]['opts']=$o;return true;}
 function curl_setopt($h,$k,$v){$GLOBALS['__curl'][$h]['opts'][$k]=$v;return true;}
 function curl_exec($h){$c=$GLOBALS['__curl'][$h];$m=json_decode((string)@file_get_contents('/w/mode.json'),true)?:[];
  file_put_contents('/w/calls.jsonl',json_encode(['url'=>$c['url'],'body'=>$c['opts'][CURLOPT_POSTFIELDS]??null])."\\n",FILE_APPEND);
  if(!empty($m['exec_false']))return false;
  return (string)($m['body']??'{"ok":true,"result":{"message_id":1}}');}
 function curl_getinfo($h,$k=null){$m=json_decode((string)@file_get_contents('/w/mode.json'),true)?:[];
  if($k===CURLINFO_HTTP_CODE)return (int)($m['http']??200); return (int)($m['http']??200);}
 function curl_errno($h){$m=json_decode((string)@file_get_contents('/w/mode.json'),true)?:[];return (int)($m['errno']??0);}
 function curl_error($h){return '';}
 function curl_close($h){return true;}
 foreach(['CURLOPT_RETURNTRANSFER'=>19913,'CURLOPT_POST'=>47,'CURLOPT_TIMEOUT'=>13,'CURLOPT_CONNECTTIMEOUT'=>78,'CURLOPT_HTTPHEADER'=>10023,'CURLOPT_POSTFIELDS'=>10015,'CURLOPT_SSL_VERIFYPEER'=>64,'CURLINFO_HTTP_CODE'=>2097154]as $k=>$v)if(!defined($k))define($k,$v);
}`;

async function phpRun(code, opts = {}) {
  const php = new PhpNode();
  const out = [];
  php.addEventListener('output', e => out.push(Array.isArray(e.detail) ? e.detail.join('') : String(e.detail)));
  await php.run("<?php @mkdir('/w/app/api',0777,true);@mkdir('/w/app/crm/data/sync',0777,true);");
  await php.writeFile('/w/app/api/rfq-notify-lib.php', LIB);
  await php.writeFile('/w/bot-config.php', "<?php return " + (opts.config || `['telegram_token'=>'1:T','telegram_chat_id'=>'-1001','rfq_notifications'=>true]`) + ";");
  await php.writeFile('/w/calls.jsonl', '');
  if (opts.seed !== undefined) await php.writeFile('/w/app/crm/data/sync/.rfq-notify.json', typeof opts.seed === 'string' ? opts.seed : JSON.stringify(opts.seed));
  if (opts.mode) await php.writeFile('/w/mode.json', JSON.stringify(opts.mode));
  await php.run(code);
  const calls = (await php.readFile('/w/calls.jsonl') ? new TextDecoder().decode(await php.readFile('/w/calls.jsonl')) : '').split('\n').filter(Boolean).map(x => JSON.parse(x));
  let state = null;
  try { state = JSON.parse(new TextDecoder().decode(await php.readFile('/w/app/crm/data/sync/.rfq-notify.json'))); } catch (e) { state = null; }
  return { out: out.join(''), calls, state };
}
const boot = CURL + "\nrequire '/w/app/api/rfq-notify-lib.php';";

function job(id, text, extra) { return { id, text: text || 'پیام تست', kind: 'status', createdAt: 1700000000, status: 'pending', attempts: 0, nextAttemptAt: 0, ...extra }; }
function seedJobs(jobs, extra) { return { version: 1, jobs: Object.fromEntries(jobs.map(j => [j.id, j])), nextSendAt: 0, ...(extra || {}) }; }
const H = 'a'.repeat(64), H2 = 'b'.repeat(64), H3 = 'c'.repeat(64);

(async () => {
  /* 1) 502 از پروکسی/هاست (بدنهٔ HTML، بدون JSON تلگرام) */
  console.log('\n══ 1 — پاسخ 502 بدون JSON تلگرام (خطای گذرای هاست/پروکسی) ══');
  let r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: seedJobs([job(H)]), mode: { http: 502, body: '<html>502 Bad Gateway</html>' } });
  console.log('   flush=' + r.out + ' | job=' + JSON.stringify(r.state && Object.values(r.state.jobs)[0]));
  T('مسیر ۵۰۲ یک تلاش می‌کند', r.calls.length === 1, r.calls.length);
  T('۵۰۲ وضعیت job را «uncertain» می‌کند', r.state && Object.values(r.state.jobs)[0].status === 'uncertain', JSON.stringify(r.state && Object.values(r.state.jobs)[0]));
  const salt = JSON.stringify(r.state);
  r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: salt, mode: { http: 502, body: '<html>502 Bad Gateway</html>' } });
  T('۵۰۲ هرگز خودکار تلاش مجدد نمی‌شود (پیام برای همیشه گم می‌شود)', r.calls.length === 0, 'تلاش دوباره=' + r.calls.length);

  /* 2) 400 دائمی: گروه/چت پیدا نشد */
  console.log('\n══ 2 — 400 «chat not found» (خطای دائمی) ══');
  let st = seedJobs([job(H)]);
  let attempts = 0, statuses = [];
  for (let i = 0; i < 9; i++) {
    r = await phpRun(`<?php ${boot}
    echo json_encode(ptf_rfq_notify_flush());`, { seed: st, mode: { http: 400, body: '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}' } });
    st = r.state; attempts += r.calls.length; statuses.push(Object.values(st.jobs)[0].status);
  }
  console.log('   تلاش‌ها=' + attempts + ' | وضعیت‌ها=' + statuses.join(',') + ' | job=' + JSON.stringify(Object.values(st.jobs)[0]));
  T('400 دائمی: بیش از یک‌بار تلاش می‌شود (باید فوراً failed شود)', attempts === 1, 'تلاش‌ها=' + attempts);

  /* 3) 403 «bot was kicked» */
  console.log('\n══ 3 — 403 «bot was kicked from the group» ══');
  r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: seedJobs([job(H)]), mode: { http: 403, body: '{"ok":false,"error_code":403,"description":"Forbidden: bot was kicked from the group chat"}' } });
  T('403: یک تلاش', r.calls.length === 1, r.calls.length);
  T('403: وضعیت pending برای تلاش مجدد', r.state && Object.values(r.state.jobs)[0].status === 'pending', JSON.stringify(Object.values(r.state.jobs)[0]));

  /* 4) 429 با retry_after */
  console.log('\n══ 4 — 429 با retry_after=120 ══');
  r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: seedJobs([job(H)]), mode: { http: 429, body: '{"ok":false,"error_code":429,"parameters":{"retry_after":120}}' } });
  const j4 = r.state && Object.values(r.state.jobs)[0];
  console.log('   job=' + JSON.stringify(j4) + ' nextSendAt=' + (r.state && r.state.nextSendAt) + ' now=' + Math.floor(Date.now() / 1000));
  T('429: بر اساس retry_after عقب می‌افتد', j4 && j4.status === 'pending' && j4.nextAttemptAt > Math.floor(Date.now() / 1000) + 60, JSON.stringify(j4));

  /* 5) timeout (curl false, errno 28) */
  console.log('\n══ 5 — timeout شبکه (errno 28) ══');
  r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: seedJobs([job(H)]), mode: { exec_false: true, errno: 28 } });
  const j5 = r.state && Object.values(r.state.jobs)[0];
  console.log('   job=' + JSON.stringify(j5));
  T('timeout: یک تلاش', r.calls.length === 1, r.calls.length);
  T('timeout [انتظار: تلاش مجدد، نه رها کردن]', j5 && j5.status === 'pending', JSON.stringify(j5));

  /* 6) burst: سه رویداد هم‌زمان */
  console.log('\n══ 6 — سه رویداد در یک صف (نرخ ارسال) ══');
  r = await phpRun(`<?php ${boot}
  $a=ptf_rfq_notify_flush(); $b=ptf_rfq_notify_flush(); echo json_encode([$a,$b]);`,
  { seed: seedJobs([job(H), job(H2), job(H3)]), mode: { http: 200, body: '{"ok":true,"result":{"message_id":7}}' } });
  console.log('   flush1+flush2=' + r.out + ' | ارسال‌شده=' + r.calls.length);
  T('در هر flush حداکثر یک پیام (نیاز به cron/ترافیک)', r.calls.length === 1, 'ارسال=' + r.calls.length);

  /* 7) گذشت زمان طولانی: پیام کهنه با «زمان» تولید، دیرتر تحویل */
  console.log('\n══ 7 — پیام سه‌روز-کهنه در صف ══');
  const old = job(H, '🔄 تغییر وضعیت درخواست\nوضعیت جدید: منتظر پاسخ کارفرما (مالی)\nزمان: 2026-10-21 09:00:00 (تهران)');
  old.createdAt = Math.floor(Date.now() / 1000) - 3 * 86400;
  r = await phpRun(`<?php ${boot}
  echo json_encode(ptf_rfq_notify_flush());`, { seed: seedJobs([old]), mode: { http: 200, body: '{"ok":true,"result":{"message_id":9}}' } });
  const sentText = r.calls[0] ? JSON.parse(r.calls[0].body).text : '';
  console.log('   ارسال‌شده=' + r.calls.length + ' | متن: ' + JSON.stringify(sentText.slice(0, 120)));
  T('صف هیچ TTL/انقضا ندارد: پیام سه‌روزه با تاریخ کهنه تحویل می‌شود', r.calls.length === 1, 'ارسال=' + r.calls.length);

  /* 8) نبود health-check: وضعیت گروه با getChat بررسی نمی‌شود */
  console.log('\n══ 8 — بررسی اتصال (status) ══');
  r = await phpRun(`<?php ${boot}
  echo json_encode(['enabled'=>ptf_rfq_notify_enabled(),'counts'=>ptf_rfq_notify_counts()]);`, { seed: seedJobs([job(H, 'x', { status: 'failed', attempts: 8 }), job(H2, 'y', { status: 'uncertain' })]) });
  console.log('   ' + r.out);
  T('وضعیت صف (failed/uncertain) در هیچ خروجی کاربری گزارش نمی‌شود', r.out.includes('"failed":1') && r.out.includes('"uncertain":1'));

  /* 9) chat_id خصوصی مثبت → غیرفعال بی‌صدا */
  console.log('\n══ 9 — پیکربندی: chat_id خصوصی/مثبت و کانال بله ══');
  r = await phpRun(`<?php ${boot} echo json_encode(['enabled'=>ptf_rfq_notify_enabled(),'cfg'=>array_keys(ptf_rfq_notify_cfg()?:[])]);`,
  { config: `['telegram_token'=>'1:T','telegram_chat_id'=>'123456789']` });
  console.log('   chat_id مثبت: ' + r.out);
  T('chat_id مثبت ⇒ اعلان خودکار خاموش (طراحی)', r.out.includes('"enabled":false'), r.out);
  r = await phpRun(`<?php ${boot} echo json_encode(['enabled'=>ptf_rfq_notify_enabled()]);`,
  { config: `['bale_token'=>'2:B','bale_chat_id'=>'-1001','telegram_token'=>'','telegram_chat_id'=>'']` });
  console.log('   فقط بله: ' + r.out);
  T('کانال بله برای اعلان خودکار پشتیبانی نمی‌شود', r.out.includes('"enabled":false'), r.out);
  r = await phpRun(`<?php ${boot} echo json_encode(['enabled'=>ptf_rfq_notify_enabled(),'chat'=>ptf_rfq_notify_cfg()['telegram_chat_id']??null]);`,
  { config: `['telegram_token'=>'1:T','telegram_chat_id'=>'@company_group']` });
  T('chat_id به شکل @username کار می‌کند', r.out.includes('"enabled":true'), r.out);

  console.log('\n=== PROBE2: ' + pass + ' PASS / ' + fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
