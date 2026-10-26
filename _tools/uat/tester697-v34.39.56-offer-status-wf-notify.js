#!/usr/bin/env node
'use strict';
/* v34.39.65 (OFFER-STATUS-WF) — گزارش کارفرما (۱۹-۱۰-۲۰۲۶):
   «وضعیت پیشنهاد را ارسال شده کردم؛ وضعیت درخواست به‌جای منتظر پاسخ کارفرما
   (مالی) شد دریافت اولیه و پیام بات هم نام آدم دیگری را زد.»
   این تست چهار لایهٔ اصلاح را اجرا می‌کند (نه فقط pin متنی):
   ① موتور واحد PHP (ptf_rfq_workflow_compute) با ماتریس سناریوها
   ② آینهٔ کلاینت (wfCompute واقعی از workflow.js) با همان ماتریس + برابری دو موتور
   ③ پیام بات: برچسب از «کدِ همان بُعدی» که عوض شده + خط رویداد + نام انجام‌دهنده
   ④ merge چنددستگاهی sync.js: گذار برگشتی (sent→lost) با مهر تازه باید ببرد. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 300) : '')); }
}

const lib = read('api/rfq-notify-lib.php'), sd = read('api/sales-domain.php'), api = read('api/crm.php');
const offersJs = read('crm/offers.js'), sdClient = read('crm/sales-domain-v2.js'), wfJs = read('crm/workflow.js'), syncJs = read('crm/sync.js');

/* ── پین‌های قرارداد ── */
T('موتور واحد در lib: compute/aliases/rank/paidSum/apply',
  ['ptf_rfq_workflow_compute', 'ptf_rfq_workflow_aliases', 'ptf_offer_wf_rank', 'ptf_invoice_paid_sum', 'ptf_rfq_workflow_apply_row'].every(f => lib.includes('function ' + f)));
T('موتور: نسخهٔ همراه ارزی وضعیت را تعیین نمی‌کند', lib.includes("trim((string)($offer['rialOf'] ?? '')) !== ''"));
T('موتور: WF80/WF85 سروری (پایان واگرایی با کلاینت)', lib.includes("return $paid ? 'WF85' : 'WF80';"));
T('پیام بات: برچسب از کدِ همان بُعد + خط رویداد + نام نمایشی انجام‌دهنده',
  lib.includes('function ptf_rfq_notify_code_label') && lib.includes('function ptf_rfq_notify_last_wf_event') && lib.includes('function ptf_rfq_notify_resolve_actor') && lib.includes('رویداد:'));
T('sales-domain: فرمان set_offer_status وجود دارد', sd.includes("elseif ($action === 'set_offer_status')"));
T('set_offer_status: برد فقط از win_offer / برنده قفل است / همراه ارزی قفل است',
  sd.includes("'use_win_offer'") && sd.includes("'won_offer_locked'") && sd.includes("'companion_status_locked'"));
T('set_offer_status: TO سایهٔ tst پاک می‌شود و مهر گذار زده می‌شود',
  sd.includes("$offer['tst'] = in_array($st, ['approved','rejected','revise','sent'], true) ? $st : '';") && sd.includes("$offer['stUpdatedAtISO'] = $now;"));
T('server_owned: هر دو شناسهٔ درخواست (رفع سقوط WF50←WF10)',
  sd.includes('$aliases = ptf_rfq_workflow_aliases($row);') && !sd.includes("$inqNo = trim((string)($row['inqNo'] ?? ''));"));
T('win_offer: گردش‌کار در همان commit (WF70) + مهر گذار',
  sd.includes('$wfWin = sd_rfq_workflow_sync_for_offers') && sd.includes("$offer['stUpdatedAtISO'] = sd_now();"));
T('sd_commit: پیام بات با نام نمایشی مالک فرمان',
  sd.includes("ptf_rfq_notify_resolve_actor((string)($context['owner'] ?? ''), sd_read('ptf_crm_users'))"));
T('data_push: پست‌پاس بازخوانی گردش‌کار + یک اعلان از مبنای پیش از push',
  api.includes('$wfPushKeysTouched') && api.includes('ptf_rfq_workflow_apply_row($wfRowRef') && api.includes('ptf_rfq_notify_events($rfqBeforePush, $finalRfqs'));
T('کلاینت: دراپ‌داون‌های TO و CO فرمان‌محورند', (offersJs.match(/ptfOfferSetStatusCommand\(no, st, selEl/g) || []).length >= 2);
T('کلاینت: فرمان set_offer_status تعریف شده و برد را به win ارجاع می‌دهد',
  sdClient.includes('window.ptfOfferSetStatusCommand') && sdClient.includes("command('set_offer_status'") && sdClient.includes("if (st === 'won') return window.ptfSalesWinOffer(no, selEl);"));
T('کلاینت: wfRefresh مهر wfUpdatedAtISO می‌زند (سپر کهنگی دیگر دور زده نمی‌شود)',
  wfJs.includes('r.wfUpdatedAtISO = new Date().toISOString();'));
T('کلاینت: wfCompute با ترتیب کل و هر دو شناسه (آینهٔ سرور)',
  wfJs.includes('function wfOfferRank(') && wfJs.includes('function wfRankHigher(') && wfJs.includes("[r.cd, r.inqNo, r.code]"));
T('sync.js: فیلدهای وضعیت با مهر stUpdatedAtISO تصمیم گرفته می‌شوند',
  syncJs.includes("key === 'ptf_crm_offers'") && syncJs.includes("'stUpdatedAtISO', 'lostAt'") && syncJs.includes("manTsA !== manTsB"));

/* ── ماتریس مشترک دو موتور ── */
const RFQ = { _id: 'RQ-1', cd: 'RFQ-101', inqNo: 'INQ-77', co: 'شرکت نمونه' };
const CO = (over) => Object.assign({ no: 'CO-1405-0001', kind: 'CO', inqNo: 'INQ-77', st: 'draft', registeredAtISO: '2026-01-01T00:00:00Z', serverRegisteredAt: '2026-01-01T00:00:00Z' }, over || {});
const TO = (over) => Object.assign({ no: 'TO-1405-0001', kind: 'TO', inqNo: 'INQ-77', st: 'draft', tst: '', registeredAtISO: '2026-01-01T00:00:00Z', serverRegisteredAt: '2026-01-01T00:00:00Z' }, over || {});
const CASES = [
  ['بدون پیشنهاد ← WF10', [], 'WF10'],
  ['سناریوی کارفرما: CO پیش‌نویس ← WF50', [CO()], 'WF50'],
  ['سناریوی کارفرما: CO ارسال‌شده ← WF60 (نه WF10!)', [CO({ st: 'sent' })], 'WF60'],
  ['پیشنهاد با شناسهٔ سیستمی cd لینک شده ← WF60 (ریشهٔ اصلی سقوط سرور)', [CO({ st: 'sent', inqNo: 'RFQ-101' })], 'WF60'],
  ['inqNo با فاصلهٔ دور و بر ← WF60', [CO({ st: 'sent', inqNo: '  INQ-77 ' })], 'WF60'],
  ['kind با حروف کوچک ← WF60', [CO({ st: 'sent', kind: 'co' })], 'WF60'],
  ['دو CO — جدیدتر (مهر) پیش‌نویس است ← WF50، مستقل از ترتیب آرایه', [CO({ no: 'CO-1405-0002', registeredAtISO: '2026-02-01T00:00:00Z', serverRegisteredAt: '2026-02-01T00:00:00Z' }), CO({ st: 'sent' })], 'WF50'],
  ['دو CO وارونهٔ همان ← باز WF50', [CO({ st: 'sent' }), CO({ no: 'CO-1405-0002', registeredAtISO: '2026-02-01T00:00:00Z', serverRegisteredAt: '2026-02-01T00:00:00Z' })], 'WF50'],
  ['CO قدیمی بازنده + CO جدید ارسال‌شده ← WF60 (کلاینت قدیم: WF91)', [CO({ st: 'lost' }), CO({ no: 'CO-1405-0002', st: 'sent', registeredAtISO: '2026-02-01T00:00:00Z', serverRegisteredAt: '2026-02-01T00:00:00Z' })], 'WF60'],
  ['نسخهٔ همراه ریالی (همیشه sent) اول آرایه + CO اصلی پیش‌نویس ← WF50 (کلاینت قدیم: WF60)', [CO({ no: 'CO-1405-0009', st: 'sent', rialOf: 'CO-1405-0001' }), CO()], 'WF50'],
  ['CO اصلاحیه ← WF55', [CO({ st: 'revise' })], 'WF55'],
  ['CO بازنده ← WF91', [CO({ st: 'lost' })], 'WF91'],
  ['TO پیش‌نویس ← WF20', [TO()], 'WF20'],
  ['TO ارسال‌شده ← WF30', [TO({ st: 'sent', tst: 'sent' })], 'WF30'],
  ['TO تاییدشده ← WF40', [TO({ st: 'approved', tst: 'approved' })], 'WF40'],
  ['TO عدم‌تایید ← WF90', [TO({ st: 'rejected', tst: 'rejected' })], 'WF90'],
  ['TO بازگشته به پیش‌نویس (سایهٔ tst پاک) ← WF20', [TO({ st: 'draft', tst: '' })], 'WF20'],
  ['TO ردشده + CO پیش‌نویس ← مالی مقدم: WF50', [TO({ st: 'rejected', tst: 'rejected' }), CO()], 'WF50'],
  ['CO برنده بدون تحویل ← WF70', [CO({ st: 'won' })], 'WF70'],
  ['CO برنده + تحویل + فاکتور تسویه‌نشده ← WF80', [CO({ st: 'won' })], 'WF80', { projects: [{ offerNo: 'CO-1405-0001', state: 'done' }], invoices: [{ offerNo: 'CO-1405-0001', amount: 1000, pays: [{ amt: 100 }] }] }],
  ['CO برنده + تحویل + تسویهٔ کامل ← WF85', [CO({ st: 'won' })], 'WF85', { projects: [{ offerNo: 'CO-1405-0001', state: 'closed' }], invoices: [{ offerNo: 'CO-1405-0001', amount: 1000, pays: [{ amt: 600 }, { amt: 400 }] }] }],
  ['نشان rejected به‌جامانده روی رکورد ثبت‌شدهٔ سرور ← باز شمرده می‌شود: WF60', [CO({ st: 'sent', _serverState: 'rejected' })], 'WF60'],
  ['پیشنهاد بدون شماره استعلام ← نامربوط: WF10', [CO({ st: 'sent', inqNo: '' })], 'WF10']
];

/* کلاینت: wfCompute واقعی */
function clientWf(offers, extra) {
  const store = { ptf_crm_offers: offers, ptf_crm_projects: (extra && extra.projects) || [], ptf_crm_invoices: (extra && extra.invoices) || [], ptf_crm_rfqs: [RFQ] };
  const slice = wfJs.slice(wfJs.indexOf('var WF = {'), wfJs.indexOf('/* بازمحاسبه'));
  const win = {};
  const getData = k => JSON.parse(JSON.stringify(store[k] || []));
  const PTF = { invPaidSum: inv => ((inv.pays || []).concat(inv.payments || [])).reduce((s, p) => s + (+p.amt || 0), 0) + (+inv.allocatedBase || 0) + (+inv.allocatedVat || 0) };
  win.PTF = PTF;
  const wfCompute = new Function('window', 'getData', 'PTF', slice + '; return window.wfCompute;')(win, getData, PTF);
  return wfCompute(JSON.parse(JSON.stringify(RFQ)));
}
for (const [name, offers, expect, extra] of CASES) {
  try { T('کلاینت: ' + name, clientWf(offers, extra) === expect, clientWf(offers, extra)); }
  catch (e) { T('کلاینت: ' + name, false, e.message); }
}

/* merge وضعیت در sync.js — استخراج توابع واقعی */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing fn ' + name);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced fn ' + name);
}
try {
  const names = ['ptfStateRank', 'ptfRecTimestamp', 'ptfRecCompleteness', 'ptfPreferRecord', 'ptfObjClone', 'ptfNormalizeOfferSnapshot', 'ptfMergePlainObject', 'ptfMergeArrayUnique', 'ptfMergeAttachmentFields', 'ptfMergeBusinessRecord'];
  const code = names.map(n => { try { return extractFn(syncJs, n); } catch (e) { return ''; } }).join('\n');
  const factory = new Function('window', code + '; return { ptfMergeBusinessRecord: ptfMergeBusinessRecord };');
  const { ptfMergeBusinessRecord } = factory({});
  const stale = { no: 'CO-1405-0001', kind: 'CO', st: 'sent', stUpdatedAtISO: '2026-01-01T00:00:00Z', items: [1, 2, 3], buyerCo: 'x' };
  const lost = { no: 'CO-1405-0001', kind: 'CO', st: 'lost', stUpdatedAtISO: '2026-02-01T00:00:00Z', lostAt: 't', items: [1] };
  T('merge: باختِ تازه‌تر بر sent کهنه می‌برد (قبلاً رتبهٔ sent می‌برد)', ptfMergeBusinessRecord('ptf_crm_offers', stale, lost, 'CO-1405-0001').st === 'lost');
  T('merge: جهت برعکس آرگومان‌ها هم همان', ptfMergeBusinessRecord('ptf_crm_offers', lost, stale, 'CO-1405-0001').st === 'lost');
  const r1 = { cd: 'RFQ-101', st: 'st1', stUpdatedAtISO: '2026-01-01T00:00:00Z', wf: 'WF60', wfUpdatedAtISO: '2026-03-01T00:00:00Z' };
  const r2 = { cd: 'RFQ-101', st: 'st5', stUpdatedAtISO: '2026-02-01T00:00:00Z', wf: 'WF50', wfUpdatedAtISO: '2026-01-01T00:00:00Z' };
  const merged = ptfMergeBusinessRecord('ptf_crm_rfqs', r1, r2, 'RFQ-101');
  T('merge درخواست: wf تازه‌تر و وضعیت دستی تازه‌تر — هر دو با مهر خودشان', merged.wf === 'WF60' && merged.st === 'st5', JSON.stringify(merged));
} catch (e) { T('merge sync.js قابل اجرا', false, e.message); }

/* ── اجرای PHP واقعی (native یا php-wasm) ── */
const PHP_TEST = `<?php
$pass=0;$fail=0;
function T($name,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$name."\\n";}else{$fail++;echo "FAIL PHP ".$name." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$CASES=json_decode(file_get_contents(__DIR__.'/cases.json'),true);
$rfq=['_id'=>'RQ-1','cd'=>'RFQ-101','inqNo'=>'INQ-77','co'=>'شرکت نمونه','st'=>'st1'];
foreach($CASES as $c){
  $got=ptf_rfq_workflow_compute(ptf_rfq_workflow_aliases($rfq),$c['offers'],$c['extra']['projects']??[],$c['extra']['invoices']??[]);
  T($c['name'],$got===$c['expect'],'got='.$got);
}
/* سناریوی دقیق کارفرما روی پیام بات: stxt آلوده به برچسب بُعد دستی */
$base=['_id'=>'RQ-1','cd'=>'RFQ-101','co'=>'شرکت نمونه','st'=>'st2','wf'=>'WF50','stxt'=>'بررسی فنی','subj'=>'درخواست شیر'];
$after=$base;$after['wf']='WF60';$after['stxt']='بررسی فنی';
$after['wfLog']=[['t'=>gmdate('Y-m-d\\TH:i:s\\Z', time()-60),'by'=>'لاوسانی','wf'=>'WF60','ev'=>'تغییر وضعیت پیشنهاد CO-1405-0041 ← ارسال شده']];
$e=ptf_rfq_notify_events([$base],[$after],'crm','لاوسانی','op-x');
T('پیام کارفرما: قبلی/جدید از کد wf خوانده می‌شود نه stxt آلوده',
  count($e)===1&&strpos($e[0]['text'],'وضعیت قبلی: پیشنهاد مالی صادر شد')!==false
  &&strpos($e[0]['text'],'وضعیت جدید: منتظر پاسخ کارفرما (مالی)')!==false
  &&strpos($e[0]['text'],'دریافت اولیه')===false, json_encode($e[0]['text']??'',JSON_UNESCAPED_UNICODE));
T('پیام: خط رویداد از wfLog می‌آید', count($e)===1&&strpos($e[0]['text'],'رویداد: تغییر وضعیت پیشنهاد CO-1405-0041')!==false);
$man=$base;$man['st']='st1';
$e2=ptf_rfq_notify_events([$man],[$base],'crm','u','op-y');
T('پیام: تغییر دستی st با wf ثابت، با برچسب دستی اعلام می‌شود (قبلاً خفه می‌شد)',
  count($e2)===1&&strpos($e2[0]['text'],'وضعیت قبلی: دریافت اولیه')!==false&&strpos($e2[0]['text'],'وضعیت جدید: بررسی فنی')!==false, json_encode($e2[0]['text']??count($e2),JSON_UNESCAPED_UNICODE));
$users=[['username'=>'Lavasani','name'=>'لاوسانی'],['username'=>'noname']];
T('انجام‌دهنده: نام نمایشی از username (بدون حساسیت حروف)', ptf_rfq_notify_resolve_actor('lavasani',$users)==='لاوسانی');
T('انجام‌دهنده: ناشناس = همان شناسه، حدس زده نمی‌شود', ptf_rfq_notify_resolve_actor('ghost',$users)==='ghost'&&ptf_rfq_notify_resolve_actor('noname',$users)==='noname');
/* apply_row: گذار واقعی مهر+لاگ، بدون تغییر = هیچ‌کدام */
$r2=$base;$r2['wf']='WF50';
$offers=[['no'=>'CO-1405-0041','kind'=>'CO','inqNo'=>'RFQ-101','st'=>'sent','registeredAtISO'=>'2026-01-01T00:00:00Z']];
$ch=ptf_rfq_workflow_apply_row($r2,$offers,[],[],'لاوسانی','تغییر وضعیت پیشنهاد CO-1405-0041 ← ارسال شده','2026-10-19T01:00:00Z');
T('apply_row: لینک با cd سیستمی هم WF60 می‌سازد + مهر + wfLog', $ch&&$r2['wf']==='WF60'&&($r2['wfUpdatedAtISO']??'')==='2026-10-19T01:00:00Z'&&count($r2['wfLog'])===1);
$ch2=ptf_rfq_workflow_apply_row($r2,$offers,[],[],'لاوسانی','x','2026-10-19T02:00:00Z');
T('apply_row: بدون گذار مهر/لاگ تازه نمی‌خورد', !$ch2&&count($r2['wfLog'])===1&&$r2['wfUpdatedAtISO']==='2026-10-19T01:00:00Z');
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

(async () => {
  let stdout = '', stderr = '';
  const casesJson = JSON.stringify(CASES.map(([name, offers, expect, extra]) => ({ name, offers, expect, extra: extra || {} })));
  const cp = require('child_process'), os = require('os');
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't697-'));
    fs.mkdirSync(path.join(dir, 'app/api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app/api/rfq-notify-lib.php'), lib);
    fs.writeFileSync(path.join(dir, 'cases.json'), casesJson);
    fs.writeFileSync(path.join(dir, 'test.php'), PHP_TEST);
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
      await php.writeFile('/test/cases.json', casesJson);
      await php.writeFile('/test/test.php', PHP_TEST);
      await php.run("<?php require '/test/test.php';");
      stdout = out.join(''); stderr = err.join('');
    } else console.log('SKIP PHP execution: install php-cli or optional php-wasm; contracts + client engine checked only.');
  }
  if (stdout) {
    console.log(stdout.replace(/PHP_RUNTIME_COUNTS.*/, '').trim());
    const m = stdout.match(/PHP_RUNTIME_COUNTS (\d+) (\d+)/);
    if (m) { pass += +m[1]; fail += +m[2]; } else T('PHP execution returns assertion summary', false);
  }
  if (stderr) console.log('PHP diagnostics: ' + stderr.trim().slice(-800));
  console.log('\n=== tester697 offer-status/WF/notify: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
