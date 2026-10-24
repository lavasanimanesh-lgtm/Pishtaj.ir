#!/usr/bin/env node
'use strict';
/* v34.39.61 (BOT-MSG-P1) — دو یافتهٔ ارزیابی ۲۰۲۶-۱۰-۲۴:
   P1-3 «برچسب وضعیت از متن آزاد کلاینت»: روی ردیف‌های بدون گردش‌کار (همهٔ درخواست‌های
        سایت) برچسب پیام از statusText/stxt خوانده می‌شد؛ هر متنی می‌توانست جای نام
        وضعیت بنشیند و یک وضعیت در دو پیام دو نام بگیرد.
   P1-6 «بات وصل است ولی پیام نمی‌آید»: صف uncertain/failed هیچ سطح مشاهده‌ای نداشت؛
        action=status فقط می‌گفت «فعال».
   مرجع: ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); }
}

const lib = read('api/rfq-notify-lib.php');
const bot = read('api/notify-bot.php');
const msgr = read('crm/messengers.js');

/* ═══ قرارداد کد ═══ */
T('lib: نمایش برچسب از «کد» با یادداشت جدا (display_label)',
  lib.includes('function ptf_rfq_notify_display_label') && lib.includes("list($toLabel, $toNote) = ptf_rfq_notify_display_label"));
T('lib: برچسب از «همان بُعدی» که عوض شده (st یا status)',
  lib.includes('$useSt = $oldSt !== $newSt;') && lib.includes('$useStatus = !$useSt && $oldStatus !== $newStatus;'));
T('lib: ویرایش فقط-متن آزاد پیام گروه نمی‌سازد',
  lib.includes('if (!$useSt && !$useStatus) continue;'));
T('lib: کدهای تازه برچسب دارند (redirected/stInv/stPay)',
  ['redirected', 'stInv', 'stPay'].every(k => lib.includes("'" + k + "'=>")));
T('notify-bot: خروجی status شامل شمارش صف و سلامت است',
  bot.includes("'outbox' => \$outbox, 'health' => \$health") && bot.includes('ptf_rfq_notify_counts()'));
T('notify-bot: وضعیت تک‌تک شاخص‌های صف در health می‌آید',
  bot.includes("پیام تأییدنشده (uncertain)") && bot.includes("پیام ناموفق (failed)") && bot.includes("پیام در صف"));
T('messengers.js: متن وضعیت شامل سلامت صف + شمارنده‌ها',
  msgr.includes('window.ptfBotStatusText') && msgr.includes('o.uncertain') && msgr.includes('ptfBotHealthLine'));
T('messengers.js: خط سلامت در کارت تنظیمات پر می‌شود',
  msgr.includes('function initBotHealthLine') && msgr.includes('setTimeout(initBotHealthLine'));

/* ═══ اجرای واقعی PHP ═══ */
const PHP = `<?php
$pass=0;$fail=0;
function T($n,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$n."\\n";}else{$fail++;echo "FAIL PHP ".$n." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$row=function($o){return array_merge(['code'=>'RFQ-1','company'=>'شرکت نمونه','subj'=>'استعلام'],$o);};
$one=function($before,$after){$e=ptf_rfq_notify_events([$before],[$after],'crm','مهدی یوسفی','op-'.bin2hex(random_bytes(4)),true,'canonical');return $e?$e[0]['text']:'';};

/* ۱) متن آزاد جای برچسب نمی‌نشیند */
$b=$row(['status'=>'pending','statusText'=>'در انتظار تایید مدیران']);
$a=$row(['status'=>'approved','statusText'=>'هر متن دلخواه — ۱۲۳ تومان تخفیف']);
$t=$one($b,$a);
$label=implode(' | ',array_values(array_filter(explode("\\n",$t),function($l){return strpos($l,'وضعیت جدید')===0;})));
T('برچسب از کد وضعیت (تاییدشده) می‌آید',strpos($label,'تاییدشده')!==false,$label);
T('متن آزاد داخل برچسب نمی‌نشیند',strpos($label,'هر متن دلخواه')===false,$label);
T('متن آزاد به‌صورت خط «یادداشت» حفظ می‌شود (دلیل/توضیح گم نمی‌شود)',strpos($t,"\\nیادداشت: هر متن دلخواه")!==false,$t);
T('برچسب قبلی هم از کد است (نه متن قبلی)',strpos($t,'وضعیت قبلی: در انتظار تایید مدیران')!==false,$t);

/* ۲) ویرایش فقط متن آزاد = بدون پیام */
$same=$row(['status'=>'approved','statusText'=>'متن دیگری برای همان وضعیت']);
T('تغییر فقط statusText (همان کد) پیامی نمی‌سازد',$one($a,$same)==='');

/* ۳) کد ناشناخته: متن آزاد به‌عنوان برچسب (بدون داده‌سازی) */
$u1=$row(['status'=>'approved','statusText'=>'تاییدشده']);
$u2=$row(['status'=>'weird_code','statusText'=>'وضعیت سازمانی خاص']);
$tu=$one($u1,$u2);
T('کد ناشناخته: برچسب همان متن ارسالی می‌شود (بدون نشان‌دادن کد خام)',strpos($tu,'وضعیت سازمانی خاص')!==false&&strpos($tu,'weird_code')===false,$tu);

/* ۴) کدهای پرکاربرد صدر‌نشین برچسب فارسی دارند */
$map=ptf_rfq_notify_labels();
T('برچسب فارسی برای redirected/approved/rejected/pending/st2',
  in_array('redirected',$map,true)===false&&isset($map['redirected'],$map['approved'],$map['rejected'],$map['pending'],$map['st2'])&&$map['redirected']!=='redirected');

/* ۵) ثبت جدید (created): برچسب از کد، متن آزاد یادداشت */
$c=ptf_rfq_notify_events([],[$row(['status'=>'pending','statusText'=>'در انتظار بررسی'])],'crm','u','op-c');
T('ثبت جدید: برچسب از کد و متن آزاد در یادداشت',count($c)===1&&strpos($c[0]['text'],'وضعیت اولیه: در انتظار تایید مدیران')!==false&&strpos($c[0]['text'],'یادداشت: در انتظار بررسی')!==false,count($c)?$c[0]['text']:'');

/* ۶) تغییر st روی ردیفی که status ثابت دارد: برچسب از st (همان بُعد عوض‌شده) */
$st1=$row(['st'=>'st1','stxt'=>'دریافت اولیه','status'=>'pending','statusText'=>'در انتظار تایید مدیران']);
$st2=$row(['st'=>'st2','stxt'=>'بررسی فنی','status'=>'pending','statusText'=>'در انتظار تایید مدیران']);
$ts=$one($st1,$st2);
T('تغییر st با status ثابت با برچسب st اعلام می‌شود',strpos($ts,'وضعیت جدید: بررسی فنی')!==false&&strpos($ts,'وضعیت قبلی: دریافت اولیه')!==false,$ts);

/* ۷) پیام‌های بات: برچسب‌ها عیناً فارسی و بدون کد خام */
T('هیچ پیامی کد خام st2 را نشان نمی‌دهد',strpos($ts,'st2')===false);

/* ۸) counts/health: شمارنده‌ها عددی و کامل‌اند (پایهٔ شفافیت صف) */
$dir=__DIR__.'/sync';@mkdir($dir,0777,true);@unlink($dir.'/.rfq-notify.json');
ptf_rfq_notify_store($dir,function(&$s){$s=['version'=>1,'jobs'=>[],'nextSendAt'=>0];});
$ev=ptf_rfq_notify_events([$st1],[$st2],'crm','u','op-h');
ptf_rfq_notify_enqueue($ev,$dir);
ptf_rfq_notify_store($dir,function(&$s){foreach($s['jobs'] as $k=>&$r){$r['status']='uncertain';$r['error']='delivery_unconfirmed';}unset($r);});
$cnt=ptf_rfq_notify_counts($dir);
T('شمارش صف: uncertain=1 و کلیدهای سلامت موجود',(int)$cnt['uncertain']===1&&array_key_exists('pending',$cnt)&&array_key_exists('failed',$cnt)&&array_key_exists('alignSuppressed',$cnt),json_encode($cnt));
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

(async () => {
  let stdout = '', stderr = '';
  const cp = require('child_process'), os = require('os');
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  const CONFIG = "<?php return ['telegram_token'=>'1:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>true];";
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't712-'));
    fs.mkdirSync(path.join(dir, 'app/api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'sync'), { recursive: true });
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
      await php.run("<?php @mkdir('/test/app/api',0777,true);@mkdir('/test/sync',0777,true);");
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
  console.log('\n=== tester712 BOT-MSG-P1: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
