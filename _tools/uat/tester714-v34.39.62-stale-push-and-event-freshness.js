#!/usr/bin/env node
'use strict';
/* v34.39.65 (BOT-MSG-P2 بستهٔ ۱) — چهار یافتهٔ ارزیابی ۲۰۲۶-۱۰-۲۴:
   P2-9  «push قدیمی پیشنهاد را حذف می‌کند و wf کهنه می‌ماند»: کلاینت بدون base فهرست
         ناقص/کهنهٔ خودش را push می‌کرد، سرور ردیف‌های غایب را حذف می‌کرد و بازخوانی
         گردش‌کار فقط با حضور ptf_crm_rfqs انجام می‌شد.
   P2-10 «حذف ردیف با push قدیمی ⇒ ثبت درخواست جدید برای رکورد قدیمی».
   P2-12 خط «رویداد» می‌توانست رویداد ده‌روزپیشِ همان کد را نشان دهد.
   P2-14 «مشتری: نامشخص» وقتی فقط نام تماس موجود است.
   مرجع: ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 500) : '')); }
}

const crm = read('api/crm.php');
const lib = read('api/rfq-notify-lib.php');
const syncjs = read('crm/sync.js');

/* ═══ قرارداد کد ═══ */
T('crm.php: گارد «push بدون شاهد نسخه حق حذف ندارد» موجود است',
  crm.includes('function sync_stale_push_keep_missing') &&
  crm.includes("($base === null || !array_key_exists($k, $base))"));
T('crm.php: مخزن سنگ‌قبر و کلیدهای مالی از گارد مستثنا هستند',
  crm.includes("in_array($key, ['ptf_crm_deleted_archive','ptf_crm_opex','ptf_crm_sharetx','ptf_crm_shareholders'], true)"));
T('crm.php: ردیف‌های نگه‌داشته‌شده در پاسخ با staleKept گزارش می‌شوند',
  crm.includes("'staleKept' => $staleKept"));
T('crm.php: نسخهٔ ادغام‌شده در conflictData برمی‌گردد تا همان دستگاه هم merge کند',
  crm.includes("if (isset($staleKept[$k]) && !isset($conflictData[$k])) { $conflictData[$k] = $v; $conflicts[] = $k; }"));
T('crm.php: بازخوانی گردش‌کار با push فقط-پیشنهادها هم انجام می‌شود',
  crm.includes("in_array('ptf_crm_rfqs', $saved_keys, true) || in_array('ptf_crm_offers', $saved_keys, true)"));
T('sync.js: دستگاهِ عقب‌مانده پیام می‌گیرد (staleKept) و ادغام می‌شود',
  syncjs.includes('d.staleKept') && syncjs.includes('نسخهٔ این دستگاه از «'));
T('lib: خط «رویداد» پنجرهٔ زمانی دارد (رویداد کهنه چاپ نمی‌شود)',
  lib.includes('function ptf_rfq_notify_last_wf_event(array $row, string $wf, int $maxAgeSeconds = 900)') &&
  lib.includes('if ($now - $ts > $maxAgeSeconds) continue;'));
T('lib: «مشتری» در نبود شرکت از نام تماس پر می‌شود',
  lib.includes("$contactName . ' (نام تماس)'"));

/* ═══ اجرای واقعی PHP: خط رویداد (P2-12) ═══ */
const PHP = `<?php
$pass=0;$fail=0;
function T($n,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$n."\\n";}else{$fail++;echo "FAIL PHP ".$n." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$row=function($o){return array_merge(['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت نمونه','subj'=>'استعلام'],$o);};
$bare=function($o){return array_merge(['_id'=>'R2','cd'=>'RFQ-2','subj'=>'استعلام'],$o);};
$one=function($b,$a){$e=ptf_rfq_notify_events([$b],[$a],'crm','مهدی یوسفی','op-'.bin2hex(random_bytes(4)));return $e?$e[0]['text']:'';};
/* ۱) رویداد ده‌روزپیش از همان کد چاپ نمی‌شود */
$stale='2026-10-01T10:00:00Z'; $fresh=gmdate('Y-m-d\\\\TH:i:s\\\\Z', time()-60);
$b=$row(['wf'=>'WF50']); $a=$row(['wf'=>'WF60','wfLog'=>[['t'=>$stale,'by'=>'u','wf'=>'WF60','ev'=>'ارسال پیشنهاد CO-9 (قدیمی)']]]);
$t=$one($b,$a);
T('رویداد کهنهٔ همان کد چاپ نمی‌شود',strpos($t,'قدیمی')===false && strpos($t,'منتظر پاسخ کارفرما (مالی)')!==false,$t);
T('پیام بدون خط رویداد هم کامل و درست است',strpos($t,'وضعیت جدید: منتظر پاسخ کارفرما (مالی)')!==false,$t);
/* ۲) رویداد همین گذار چاپ می‌شود */
$b2=$row(['wf'=>'WF50']); $a2=$row(['wf'=>'WF60','wfLog'=>[['t'=>$fresh,'by'=>'u','wf'=>'WF60','ev'=>'تغییر وضعیت پیشنهاد CO-9 ← ارسال‌شده']]]);
$t2=$one($b2,$a2);
T('رویداد تازه چاپ می‌شود',strpos($t2,'رویداد: تغییر وضعیت پیشنهاد CO-9')!==false,$t2);
/* ۳) ورودی بدون مهر زمان پذیرفته نمی‌شود (نمی‌دانیم مال همین گذار است) */
$b3=$row(['wf'=>'WF50']); $a3=$row(['wf'=>'WF60','wfLog'=>[['by'=>'u','wf'=>'WF60','ev'=>'رویداد بی‌مهر']]]);
T('رویداد بدون مهر زمان چاپ نمی‌شود',strpos($one($b3,$a3),'بی‌مهر')===false);
/* ۴) P2-14: بدون شرکت، نام تماس */
$c=ptf_rfq_notify_events([],[ $bare(['status'=>'pending','con'=>'مهندس رضایی','phone'=>'09120000001']) ],'crm','u','op-c');
T('مشتری از نام تماس پر می‌شود و «نامشخص» نمی‌آید',
  count($c)===1 && strpos($c[0]['text'],'مشتری: مهندس رضایی (نام تماس)')!==false,count($c)?$c[0]['text']:'');
/* ۵) بدون شرکت و بدون نام تماس: همان «نامشخص» (بدون داده‌سازی) */
$c2=ptf_rfq_notify_events([],[ $bare(['status'=>'pending']) ],'crm','u','op-d');
T('نبودِ هر دو ⇒ نامشخص',count($c2)===1 && strpos($c2[0]['text'],'مشتری: نامشخص')!==false);
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

(async () => {
  let stdout = '', stderr = '';
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  const CONFIG = "<?php return ['telegram_token'=>'1:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>true];";
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't714-'));
    fs.mkdirSync(path.join(dir, 'app/api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app/api/rfq-notify-lib.php'), lib);
    fs.writeFileSync(path.join(dir, 'bot-config.php'), CONFIG);
    fs.writeFileSync(path.join(dir, 'test.php'), PHP);
    try { stdout = cp.execFileSync('php', [path.join(dir, 'test.php')], { encoding: 'utf8', cwd: dir }); }
    catch (e) { stdout = String(e.stdout || ''); stderr = String(e.stderr || e.message); }
  } else {
    let PhpNode;
    try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (e) {}
    if (PhpNode) {
      const php = new PhpNode(); const out = [], err = [];
      php.addEventListener('output', e => out.push(e.detail || e.data || ''));
      php.addEventListener('error', e => err.push(e.detail || e.data || ''));
      await php.run("<?php @mkdir('/test/app/api',0777,true);");
      await php.writeFile('/test/app/api/rfq-notify-lib.php', lib);
      await php.writeFile('/test/bot-config.php', CONFIG);
      await php.writeFile('/test/test.php', PHP);
      await php.run("<?php require '/test/test.php';");
      stdout = out.join(''); stderr = err.join('');
    } else console.log('SKIP PHP execution: install php-cli or optional php-wasm; contract layer checked only.');
  }
  if (stdout) {
    console.log(stdout.replace(/PHP_RUNTIME_COUNTS.*/, '').trim());
    const m = stdout.match(/PHP_RUNTIME_COUNTS (\d+) (\d+)/);
    if (m) { pass += +m[1]; fail += +m[2]; } else T('PHP execution returns assertion summary', false);
  }
  if (stderr) console.log('PHP diagnostics: ' + stderr.trim().slice(-600));

  /* ═══ اجرای واقعی API (هارنس مشترک e2e فانتوم) ═══ */
  let E2E = null, haveWasm = true;
  try { require.resolve('php-wasm/PhpNode'); } catch (e) { haveWasm = false; }
  if (!haveWasm) console.log('SKIP API execution: install php-wasm (npm i php-wasm@0.2.0) — contract + lib layer checked only.');
  else try {
    const src = read('_tools/uat/e2e-rfq-notify-phantom-v34.39.55.js');
    const cut = src.indexOf('async function main()');
    if (cut < 0) throw new Error('phantom harness marker not found');
    const M = { exports: {} };
    new Function('require', 'module', 'exports', '__dirname', '__filename',
      src.slice(0, cut).replace(/^#!.*\n/, '') + '\nmodule.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({ pass, fail }) };\n'
    )(require, M, M.exports, __dirname, path.join(__dirname, 'e2e-rfq-notify-phantom-v34.39.55.js'));
    E2E = M.exports;
  } catch (e) { T('harness بارگذاری شد', false, e.message); }


  if (E2E) {
    const { request, fresh, messages, ready, upsert, rows, T: TE } = E2E;
    const before = E2E.stats();
    const USERS = JSON.stringify([{ username: 'lavasani', name: 'علی لواسانی', role: 'admin' },
      { username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' }]);
    const offers = s => { try { return JSON.parse(s['sync/ptf_crm_offers.json'] || '[]'); } catch (e) { return []; } };

    /* A — push قدیمی بدون base ردیف غایب را حذف نمی‌کند (P2-9/P2-10) */
    const s4 = fresh();
    s4['sync/ptf_crm_users.json'] = USERS;
    s4['sync/ptf_crm_rfqs.json'] = JSON.stringify([
      { _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1' },
      { _id: 'RQ-602', cd: 'RFQ-602', co: 'شرکت د۲', subj: 'استعلام', st: 'st1' }
    ]);
    ready(s4);
    let r = await request(s4, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
      body: { by: 'yousefi', data: { ptf_crm_rfqs: JSON.stringify([{ _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1' }]) } } });
    console.log('   پاسخ push کهنه: ' + JSON.stringify(r.json).slice(0, 260));
    TE('A1: push بدون base ردیف غایب را حذف نمی‌کند', rows(s4).length === 2, rows(s4).map(x => x.cd).join(','));
    TE('A2: ردیف‌های نگه‌داشته‌شده با «شمارهٔ نمایشی» در staleKept گزارش می‌شوند',
      !!(r.json && r.json.staleKept && (r.json.staleKept.ptf_crm_rfqs || []).includes('RFQ-602')),
      JSON.stringify(r.json && r.json.staleKept));
    TE('A3: نسخهٔ کامل در conflictData می‌آید تا همان دستگاه merge کند',
      !!(r.json && r.json.serverData && r.json.serverData.ptf_crm_rfqs));
    TE('A4: حذفِ بی‌سنگ‌قبر هیچ پیامی نمی‌سازد', messages(r).length === 0, JSON.stringify(messages(r).map(m => m.text)));

    /* B — حذف واقعی (با سنگ‌قبر) همچنان کار می‌کند */
    ready(s4);
    /* سنگ‌قبر با همان هویتی که سرور برای ردیف می‌شناسد (_id) ثبت می‌شود */
    const archive = JSON.stringify([{ kind: 'rfq', id: 'RQ-602', cd: 'RFQ-602', at: new Date().toISOString() }]);
    r = await request(s4, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
      body: { by: 'yousefi', data: {
        ptf_crm_deleted_archive: archive,
        ptf_crm_rfqs: JSON.stringify([{ _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1' }])
      } } });
    console.log('   پس از حذف با سنگ‌قبر: ' + rows(s4).map(x => x.cd).join(',') + ' | staleKept=' + JSON.stringify(r.json && r.json.staleKept));
    TE('B1: حذف عمدیِ دارای سنگ‌قبر انجام می‌شود', rows(s4).length === 1 && rows(s4)[0].cd === 'RFQ-601', rows(s4).map(x => x.cd).join(','));

    /* C — push فقط-پیشنهادها گردش‌کار را بازخوانی می‌کند (P2-9 دوم) */
    const s5 = fresh();
    s5['sync/ptf_crm_users.json'] = USERS;
    await upsert(s5, { _id: 'RQ-501', cd: 'RFQ-501', co: 'شرکت ج', subj: 'استعلام' }, 'seed-501', { user: 'lavasani', role: 'admin' });
    ready(s5);
    await request(s5, { action: 'register_offer', body: { idempotencyKey: 'co-501a', createIntent: true, offer: { no: 'CO-501A', kind: 'CO', inqNo: 'RFQ-501', st: 'lost', items: [] } }, user: 'lavasani', role: 'admin' });
    ready(s5);
    await request(s5, { action: 'register_offer', body: { idempotencyKey: 'co-501b', createIntent: true, offer: { no: 'CO-501B', kind: 'CO', inqNo: 'RFQ-501', st: 'sent', items: [] } }, user: 'lavasani', role: 'admin' });
    ready(s5);
    const offNow = offers(s5);
    const back = offNow.map(o => (o.no === 'CO-501B' ? Object.assign({}, o, { st: 'lost' }) : o));
    r = await request(s5, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
      body: { by: 'yousefi', data: { ptf_crm_offers: JSON.stringify(back) } } });
    const cMsgs = messages(r);
    console.log('   wf پس از push فقط-پیشنهادها: ' + (rows(s5)[0] || {}).wf);
    TE('C1: wf با push فقط-پیشنهادها بازخوانی می‌شود (WF91)', (rows(s5)[0] || {}).wf === 'WF91', (rows(s5)[0] || {}).wf);
    TE('C2: گذار با «وضعیت قبلی» درست اعلام می‌شود',
      cMsgs.length === 1 && cMsgs[0].text.includes('وضعیت قبلی: منتظر پاسخ کارفرما (مالی)') &&
      cMsgs[0].text.includes('وضعیت جدید: بایگانی — بازنده مالی'), JSON.stringify(cMsgs.map(m => m.text)));

    /* D — P2-14: ردیف سایت بدون نام شرکت */
    const s6 = fresh();
    r = await request(s6, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true,
      post: { company: '', name: 'مهندس رضایی', phone: '09120000001', subject: 'استعلام', category: 'شیرآلات' } });
    const dMsg = (messages(r)[0] || {}).text || '';
    console.log('   پیام ثبت سایت: ' + JSON.stringify(dMsg.split('\n').filter(l => l.startsWith('مشتری')).join()));
    TE('D1: «مشتری: نامشخص» با نام تماس پر می‌شود', dMsg.includes('مشتری: مهندس رضایی (نام تماس)'), dMsg);

    const after = E2E.stats();
    pass += after.pass - before.pass; fail += after.fail - before.fail;
  }

  console.log('\n=== tester714 BOT-MSG-P2-a: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
