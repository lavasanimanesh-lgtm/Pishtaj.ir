'use strict';
/* PROBE 3 — واحد: تولید رویداد/متن پیام (اجرای واقعی rfq-notify-lib.php) */
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs'), path = require('path');
const ROOT = '/home/user/Pishtaj.ir';
const LIB = fs.readFileSync(path.join(ROOT, 'api/rfq-notify-lib.php'), 'utf8');
let pass = 0, fail = 0;
function T(n, ok, d) { if (ok) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d !== undefined ? ' — ' + String(d).slice(0, 500) : '')); } }

async function run(code, opts = {}) {
  const php = new PhpNode();
  let out = '';
  php.addEventListener('output', e => out += Array.isArray(e.detail) ? e.detail.join('') : String(e.detail));
  await php.run("<?php @mkdir('/w/app/api',0777,true);@mkdir('/w/app/crm/data/sync',0777,true);");
  await php.writeFile('/w/app/api/rfq-notify-lib.php', LIB);
  await php.writeFile('/w/bot-config.php', "<?php return " + (opts.config || `['telegram_token'=>'1:T','telegram_chat_id'=>'-1001']`) + ";");
  await php.run(code);
  return out;
}
const boot = "<?php require '/w/app/api/rfq-notify-lib.php';";
const J = v => "json_decode(base64_decode('" + Buffer.from(JSON.stringify(v),'utf8').toString('base64') + "'), true)";

(async () => {
  /* 1) اثر انگشت رویداد: گذار یکسانِ تکراری */
  console.log('\n══ 1 — اثر انگشت رویداد (گذار یکسان در دو زمان مختلف) ══');
  const before = [{ _id: 'R1', cd: 'RFQ-1', co: 'شرکت', wf: 'WF50', stxt: 'پیشنهاد مالی صادر شد' }];
  const after = [{ _id: 'R1', cd: 'RFQ-1', co: 'شرکت', wf: 'WF55', stxt: 'در حال اصلاح پیشنهاد مالی' }];
  let out = await run(`${boot}
  $b=${J(before)}; $a=${J(after)};
  $e1=ptf_rfq_notify_events($b,$a,'crm','یوسفی','command:aaa');
  $e2=ptf_rfq_notify_events($b,$a,'crm','یوسفی','command:bbb');
  echo json_encode(['id1'=>$e1[0]['id']??null,'id2'=>$e2[0]['id']??null,'same'=>($e1[0]['id']??'x')===($e2[0]['id']??'y'),'text'=>$e1[0]['text']??null]);`);
  const d1 = JSON.parse(out);
  console.log('   id1=' + (d1.id1 || '').slice(0, 16) + ' id2=' + (d1.id2 || '').slice(0, 16) + ' same=' + d1.same);
  T('شناسهٔ رویداد به «عملیات» وابسته است ⇒ گذار یکسان در دو تراکنش، دو شناسه می‌گیرد (اعلان دوباره)', d1.same === false, d1.same);

  out = await run(`${boot}
  $b=${J(before)}; $a=${J(after)};
  $st=['version'=>1,'jobs'=>[],'nextSendAt'=>0];
  file_put_contents('/w/app/crm/data/sync/.rfq-notify.json', json_encode($st));
  ptf_rfq_notify_enqueue(ptf_rfq_notify_events($b,$a,'crm','یوسفی','command:aaa'));
  $c=ptf_rfq_notify_counts(); $n1=$c['pending'];
  ptf_rfq_notify_enqueue(ptf_rfq_notify_events($b,$a,'crm','لواسانی','command:bbb'));
  $s=json_decode(file_get_contents('/w/app/crm/data/sync/.rfq-notify.json'),true);
  echo json_encode(['pending'=>$n1,'jobs'=>count($s['jobs'])]);`);
  const d2 = JSON.parse(out);
  console.log('   صف پس از دو گذار یکسان: ' + out);
  T('هر دو گذار یکسان در صف ثبت می‌شوند (تکرار عمدی حذف نمی‌شود)', d2.jobs === 2, out);

  /* 2) فقط تغییر waiting → هیچ پیامی */
  console.log('\n══ 2 — فقط تغییر «در انتظار» (waiting) ══');
  out = await run(`${boot}
  $b=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','stxt'=>'منتظر پاسخ کارفرما (مالی)','waiting'=>'CO']];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','stxt'=>'منتظر پاسخ کارفرما (مالی)','waiting'=>'TO']];
  echo json_encode(ptf_rfq_notify_events($b,$a,'crm','x','command:c'));`);
  console.log('   رویدادها: ' + out);
  T('تغییر فقط waiting بی‌صدا رد می‌شود', JSON.parse(out).length === 0, out);

  /* 3) تغییر هم‌زمان wf و st دستی */
  console.log('\n══ 3 — تغییر هم‌زمان گردش‌کار (wf) و وضعیت دستی (st) ══');
  out = await run(`${boot}
  $b=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','st'=>'st2','stxt'=>'منتظر پاسخ کارفرما (مالی)']];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF55','st'=>'st5','stxt'=>'در حال اصلاح پیشنهاد مالی']];
  echo json_encode(array_map(fn($e)=>$e['text'], ptf_rfq_notify_events($b,$a,'crm','x','command:d')));`);
  const t3 = JSON.parse(out)[0] || '';
  console.log('   پیام: ' + JSON.stringify(t3));
  T('تغییر دستی هم‌زمان (st2→st5) در پیام دیده می‌شود', t3.includes('ابلاغ سفارش') || t3.includes('st5'), t3.split('\n').filter(l => l.startsWith('وضعیت')).join(' | '));

  /* 4) ردیف گردش‌کاردار: تغییر فقط st دستی (بدون تغییر wf) */
  console.log('\n══ 4 — فقط تغییر st دستی روی ردیف گردش‌کاردار ══');
  out = await run(`${boot}
  $b=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','st'=>'st2','stxt'=>'منتظر پاسخ کارفرما (مالی)']];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','st'=>'st3','stxt'=>'منتظر پاسخ کارفرما (مالی)']];
  echo json_encode(array_map(fn($e)=>$e['text'], ptf_rfq_notify_events($b,$a,'crm','x','command:e')));`);
  const t4 = JSON.parse(out)[0] || '';
  console.log('   پیام: ' + JSON.stringify(t4));
  T('برچسب‌ها از کد دستی (st2→st3) خوانده می‌شوند', t4.includes('بررسی فنی') && t4.includes('تایید'), t4.split('\n').filter(l => l.startsWith('وضعیت')).join(' | '));

  /* 5) طول متن و کاراکترهای کنترلی/UTF-8 نامعتبر */
  console.log('\n══ 5 — طول/کاراکترهای کنترلی/UTF-8 نامعتبر ══');
  out = await run(`${boot}
  $b=[];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>str_repeat('ش',240),'subj'=>str_repeat('م',300),'ca'=>str_repeat('ح',120),'stxt'=>'x']];
  $e=ptf_rfq_notify_events($b,$a,'crm','x','command:f');
  $t=$e[0]['text'];
  $bad=['_id'=>'R2','cd'=>"RFQ-2\\x80\\x81",'co'=>"شرکت\\n\\r\\t\\u{202E} نمونه\\x00",'stxt'=>'y'];
  $e2=ptf_rfq_notify_events([],[$bad],'crm','x','command:g');
  echo json_encode(['len'=>strlen($t),'chars'=>preg_match_all('/./us',$t),'text'=>$t,'bad'=>$e2[0]['text']??null]);`);
  const d5 = JSON.parse(out);
  console.log('   طول پیام بیشینه: ' + d5.len + ' بایت / ' + d5.chars + ' کاراکتر (سقف تلگرام ۴۰۹۶)');
  console.log('   ردیف با UTF-8 نامعتبر: ' + JSON.stringify(d5.bad));
  T('پیام بیشینه زیر سقف ۴۰۹۶ کاراکتر تلگرام است', d5.chars < 4000, d5.chars);
  T('کاراکتر کنترلی/RTL-override از نام شرکت پاک می‌شود', d5.bad && !d5.bad.includes('\u202E') && !d5.bad.includes('\u0000'), JSON.stringify(d5.bad));
  T('UTF-8 نامعتبر فیلد شرکت باعث خالی/شکستن پیام نمی‌شود', d5.bad && d5.bad.includes('شرکت'), JSON.stringify(d5.bad));

  /* 6) پاک‌سازی برچسب: emoji و ZWNJ */
  console.log('\n══ 6 — تطبیق برچسب‌های تفاوت‌یافته فقط با emoji/نیم‌فاصله ══');
  out = await run(`${boot}
  $b=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','stxt'=>'🔴 دریافت اولیه']];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','stxt'=>'دریافت اولیه']];
  echo json_encode(count(ptf_rfq_notify_events($b,$a,'crm','x','command:h')));`);
  T('تفاوت فقط در emoji ⇒ پیام کاذب ساخته نمی‌شود', JSON.parse(out) === 0, out);

  /* 7) ردیف بدون هیچ شناسه */
  console.log('\n══ 7 — ردیف بدون شناسه (cd/_id/inqNo) ══');
  out = await run(`${boot}
  $a=[['co'=>'شرکت بی‌شناسه','stxt'=>'دریافت اولیه']];
  echo json_encode(['events'=>count(ptf_rfq_notify_events([],$a,'crm','x','command:i'))]);`);
  T('ردیف بدون شناسه اعلان نمی‌سازد (نه پیام با شمارهٔ خالی)', JSON.parse(out).events === 0, out);

  /* 8) «رویداد» از wfLog: آیا رویداد کهنه می‌تواند چاپ شود؟ */
  console.log('\n══ 8 — خط «رویداد» از wfLog ══');
  out = await run(`${boot}
  $b=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF50','stxt'=>'پیشنهاد مالی صادر شد',
      'wfLog'=>[['t'=>'2026-10-01T10:00:00Z','by'=>'یوسفی','wf'=>'WF60','ev'=>'ارسال پیشنهاد CO-9 (رویداد ۱۰ روز پیش)']]]];
  $a=[['_id'=>'R1','cd'=>'RFQ-1','co'=>'شرکت','wf'=>'WF60','stxt'=>'منتظر پاسخ کارفرما (مالی)',
      'wfLog'=>[['t'=>'2026-10-01T10:00:00Z','by'=>'یوسفی','wf'=>'WF60','ev'=>'ارسال پیشنهاد CO-9 (رویداد ۱۰ روز پیش)']]]];
  echo json_encode(array_map(fn($e)=>$e['text'], ptf_rfq_notify_events($b,$a,'crm','لواسانی','command:j')));`);
  const t8 = JSON.parse(out)[0] || '';
  console.log('   پیام: ' + JSON.stringify(t8));
  T('اگر گذار فعلی در wfLog ثبت نشده باشد، رویداد کهنهٔ همان کد چاپ می‌شود',
    t8.includes('۱۰ روز پیش'), t8.split('\n').filter(l => l.startsWith('رویداد')).join());

  /* 9) شناسه‌های تکراری: چرا پیام خفه می‌شود */
  console.log('\n══ 9 — شناسهٔ تکراری/مبهم ══');
  /* قرارداد v34.39.61: شناسهٔ نمایشی مشترک دلیل خفه‌شدن نیست؛ اول با هویت یکتای
     ذخیره‌سازی (_id) تطبیق می‌دهیم، بعد با فیلدهای محتوایی، و فقط اگر واقعاً
     تفکیک‌ناپذیر بود پیام نمی‌سازیم — آن‌وقت شمارندهٔ دیدنی ثبت می‌شود. */
  out = await run(`${boot}
  $b=[['_id'=>'A','cd'=>'RFQ-D','co'=>'الف','st'=>'st1'],['_id'=>'B','cd'=>'RFQ-D','co'=>'ب','st'=>'st1']];
  $a=[['_id'=>'A','cd'=>'RFQ-D','co'=>'الف','st'=>'st2'],['_id'=>'B','cd'=>'RFQ-D','co'=>'ب','st'=>'st1']];
  $e=ptf_rfq_notify_events($b,$a,'crm','x','command:k');
  $d1=count($e).'|'.($e[0]['text']??'');
  $d=ptf_rfq_notify_diag_take();
  $b2=[['_id'=>'Z','cd'=>'RFQ-Z'],['_id'=>'Z','cd'=>'RFQ-Z']];
  $a2=[['_id'=>'Z','cd'=>'RFQ-Z','st'=>'st2'],['_id'=>'Z','cd'=>'RFQ-Z']];
  $n2=count(ptf_rfq_notify_events($b2,$a2,'crm','x','command:l'));
  echo json_encode(['n'=>count($e),'t'=>$e[0]['text']??'','diag'=>$d,'n2'=>$n2,'diag2'=>ptf_rfq_notify_diag_take()]);`);
  const d9 = JSON.parse(out);
  console.log('   ' + out);
  T('شناسهٔ نمایشی مشترک ولی _id یکتا: تغییر واقعی اعلام می‌شود',
    d9.n === 1 && d9.t.includes('مشتری: الف'), 'پیام‌ها=' + d9.n + ' | ' + d9.t.split('\n').slice(0, 3).join(' / '));
  T('تفکیک‌ناپذیر (دو ردیف با همان _id): پیام ساخته نمی‌شود ولی شمارندهٔ دیدنی ثبت می‌شود',
    d9.n2 === 0 && (d9.diag2.ambiguousRows || 0) > 0, JSON.stringify({ n2: d9.n2, diag2: d9.diag2 }));

  console.log('\n=== PROBE3: ' + pass + ' PASS / ' + fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });
