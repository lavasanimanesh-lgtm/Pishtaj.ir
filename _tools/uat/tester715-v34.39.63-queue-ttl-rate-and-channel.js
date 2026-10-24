#!/usr/bin/env node
'use strict';
/* v34.39.63 (BOT-MSG-P2 بستهٔ ۲ — بستن ارزیابی) — چهار یافته:
   P2-7  «صف بدون TTL»: پیام سه‌روزه با متن و تاریخ خودش به گروه می‌رفت.
   P2-8  «نرخ ۱ پیام در ۳ ثانیه و وابستگی کامل به cron»: بدون cron پیام‌های دوم به
         بعد ساعت‌ها معلق می‌ماندند.
   P2-15 «متن آزاد فرم سایت داخل پیام»: موضوع ارسالی می‌توانست شکل «وضعیت جدید: …» بگیرد.
   P2-16 «کانال بله و کشف کانفیگ»: اعلان خودکار فقط تلگرام را می‌شناخت و خاموشیِ
         پیکربندی بی‌صدا بود.
   مرجع: ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 500) : '')); }
}

const lib = read('api/rfq-notify-lib.php');
const bot = read('api/notify-bot.php');
const cron = read('api/rfq-notify-cron.php');
const msgr = read('crm/messengers.js');

/* ═══ قرارداد کد ═══ */
T('lib: سطل توکن نرخ (ظرفیت ۵، ۲۰ در دقیقه) به‌جای فاصلهٔ ثابت ۳ ثانیه',
  lib.includes('function ptf_rfq_notify_rate_take') && lib.includes('$cap = 5.0; $perMinute = 20.0;') &&
  !lib.includes("$state['nextSendAt'] = $now + 3;"));
T('lib: TTL دو آستانه‌ای (stale/expire) و قابل تنظیم از کانفیگ',
  lib.includes('function ptf_rfq_notify_ttl') && lib.includes("rfq_stale_after") && lib.includes("rfq_expire_after"));
T('lib: پیام کهنه با برچسب «⏳ تأخیر» می‌رود و منقضی‌شدن شمرده می‌شود',
  lib.includes('function ptf_rfq_notify_delay_notice') && lib.includes("'expired_stale'"));
T('lib: flush چندپیامی شد (maxJobs) و shutdown تا ۳ پیام خالی می‌کند',
  lib.includes('function ptf_rfq_notify_flush(?string $dir = null, int $maxJobs = 1)') &&
  lib.includes('ptf_rfq_notify_flush($dir, 3);'));
T('lib: متن آزاد برچسب‌های پیام را جعل نمی‌کند (neutralize)',
  lib.includes('function ptf_rfq_notify_neutralize_labels') && lib.includes('ptf_rfq_notify_neutralize_labels((string)$s)'));
T('lib: کانال تلگرام/بله و کشف مسیر کانفیگ',
  lib.includes('function ptf_rfq_notify_channel') && lib.includes('tapi.bale.ai') &&
  lib.includes('function ptf_rfq_notify_cfg_duplicates'));
T('lib: خاموشی پیکربندی دلیل فارسی دارد (بی‌صدا نیست)',
  lib.includes('function ptf_rfq_notify_config_issue') && lib.includes('چت خصوصی'));
T('notify-bot: سلامت شامل منقضی‌شده، کهنگی صف و مشکل کانفیگ است',
  bot.includes("' پیام کهنه منقضی شد") && bot.includes('oldestPendingAge') && bot.includes('ptf_rfq_notify_config_issue'));
T('cron: تا ۵ پیام در هر فراخوانی + گزارش کانال و مسیر کانفیگ',
  cron.includes('ptf_rfq_notify_flush($dir, 5)') && cron.includes("'configPath'"));
T('messengers.js: کارت تنظیمات وضعیت کانال/منقضی را نشان می‌دهد', msgr.includes('o.expired'));

/* ═══ اجرای واقعی PHP ═══ */
const PHP = `<?php
$pass=0;$fail=0;
function T($n,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$n."\\n";}else{$fail++;echo "FAIL PHP ".$n." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$dir=__DIR__.'/sync';@mkdir($dir,0777,true);
function reset_q($dir, $jobs=[]){ptf_rfq_notify_store($dir,function(&$s)use($jobs){$s=['version'=>1,'jobs'=>$jobs,'nextSendAt'=>0];});$GLOBALS['calls']=0;}
function mk($id,$ageSeconds=0,$extra=[]){return array_merge(['id'=>$id,'text'=>'پیام '.substr($id,0,4),'kind'=>'status',
  'createdAt'=>time()-$ageSeconds,'status'=>'pending','attempts'=>0,'nextAttemptAt'=>0],$extra);}

/* ۱) TTL: کهنه هرگز نمی‌رود، نیمه‌کهنه با برچسب تأخیر */
$ka=str_repeat('a',64);reset_q($dir,[$ka=>mk($ka, 3*86400)]);
$r=ptf_rfq_notify_flush($dir);
$s=json_decode(file_get_contents($dir.'/.rfq-notify.json'),true);
T('پیام سه‌روزه ارسال نمی‌شود',(int)$r['sent']===0&&(int)$GLOBALS['calls']===0,json_encode($r));
T('و با نشان expired_stale کنار گذاشته می‌شود',$s['jobs'][str_repeat('a',64)]['status']==='cancelled'&&$s['jobs'][str_repeat('a',64)]['error']==='expired_stale');
T('شمارندهٔ expired بالا می‌رود',(int)ptf_rfq_notify_counts($dir)['expired']===1,json_encode(ptf_rfq_notify_counts($dir)));

$kb=str_repeat('b',64);reset_q($dir,[$kb=>mk($kb, 40*60)]);
$GLOBALS['lastText']='';
$r=ptf_rfq_notify_flush($dir);
T('پیام ۴۰ دقیقه‌ای ارسال می‌شود (داخل پنجرهٔ ۶ ساعت)',(int)$r['sent']===1,json_encode($r));
T('و خط «با تأخیر ارسال می‌شود» بالای متن دارد',strpos((string)$GLOBALS['lastText'],'⏳ این پیام با تأخیر ارسال می‌شود')===0,(string)$GLOBALS['lastText']);

$kc=str_repeat('c',64);reset_q($dir,[$kc=>mk($kc, 30)]);
$r=ptf_rfq_notify_flush($dir);
T('پیام تازه هیچ برچسب تأخیری نمی‌گیرد',(int)$r['sent']===1&&strpos((string)$GLOBALS['lastText'],'تأخیر')===false,(string)$GLOBALS['lastText']);

/* ۲) نرخ: burst تا ۵ و سپس توقف */
$burst=[];for($i=0;$i<6;$i++)$burst[chr(97+$i).str_repeat('0',63)]=mk(chr(97+$i).str_repeat('0',63),5);
reset_q($dir,$burst);
$GLOBALS['tokens5']=(int)ptf_rfq_notify_flush($dir,6)['sent'];
$GLOBALS['more']=(int)ptf_rfq_notify_flush($dir,6)['sent'];
T('یک فراخوانی burst تا ۵ پیام می‌فرستد',(int)$GLOBALS['tokens5']===5,(string)$GLOBALS['tokens5']);
T('سقف ۲۰ در دقیقه نگه داشته می‌شود (پیام ششم فوراً نمی‌رود)',(int)$GLOBALS['more']===0,(string)$GLOBALS['more']);
T('پیام ششم در صف می‌ماند تا توکن آزاد شود',(int)ptf_rfq_notify_counts($dir)['pending']===1);

/* ۳) کهنگی صف دیدنی است */
$kd=str_repeat('d',64);reset_q($dir,[$kd=>mk($kd, 900)]);
T('oldestPendingAge سن قدیمی‌ترین پیام صف را می‌دهد',(int)ptf_rfq_notify_counts($dir)['oldestPendingAge']>=895,json_encode(ptf_rfq_notify_counts($dir)));

/* ۴) کانال: بله و تلگرام */
$GLOBALS['ch']=ptf_rfq_notify_channel();
T('کانال فعال با کانفیگ تست = تلگرام',$GLOBALS['ch']['app']==='telegram',json_encode($GLOBALS['ch']));
T('مسیر کانفیگ مصرف‌شده گزارش می‌شود',ptf_rfq_notify_cfg_path()!==''&&is_file(ptf_rfq_notify_cfg_path()),ptf_rfq_notify_cfg_path());
T('بدون کانفیگ تکراری، هشدار تکراری خالی است',ptf_rfq_notify_cfg_duplicates()===[],json_encode(ptf_rfq_notify_cfg_duplicates()));
T('کانفیگ سالم هیچ ایرادی ندارد',ptf_rfq_notify_config_issue()==='',ptf_rfq_notify_config_issue());

/* ۵) متن آزاد: برچسب جعلی */
$row=['_id'=>'R9','cd'=>'RFQ-9','co'=>'شرکت ⛔ مختومه','subj'=>'استعلام\\nوضعیت جدید: تحویل شده — مبلغ ۹۹۰ میلیون','status'=>'pending'];
$e=ptf_rfq_notify_events([],[$row],'site','u','op-9');
$txt=$e?$e[0]['text']:'';
T('متن موضوع با «وضعیت جدید:» شکل فیلد رسمی نمی‌گیرد',strpos($txt,'وضعیت جدید: تحویل')===false,$txt);
T('و همان عبارت با خط تیره می‌آید (محتوا حذف نمی‌شود)',strpos($txt,'وضعیت جدید — تحویل شده')!==false,$txt);
T('سطر رسمی «وضعیت اولیه» فقط یک‌بار در پیام است',substr_count($txt,"\\nوضعیت اولیه:")===1,$txt);
T('متن چندخطی به یک خط تبدیل می‌شود',substr_count($txt,"\\nوضعیت جدید:")===0,$txt);
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

/* قلاب ضبط متن ارسالی برای بررسی برچسب تأخیر */
const PRELUDE = `
if(!function_exists('curl_init')){
 function curl_init($u=null){return 1;}
 function curl_setopt_array($h,$o){$GLOBALS['lastText']=json_decode($o[CURLOPT_POSTFIELDS]??'{}',true)['text']??'';$GLOBALS['calls']=($GLOBALS['calls']??0)+1;return true;}
 function curl_exec($h){return '{"ok":true,"result":{"message_id":1}}';}
 function curl_getinfo($h,$k=null){return 200;}
 function curl_errno($h){return 0;}
 function curl_error($h){return '';}
 function curl_close($h){return true;}
 foreach(['CURLOPT_RETURNTRANSFER'=>19913,'CURLOPT_POST'=>47,'CURLOPT_TIMEOUT'=>13,'CURLOPT_CONNECTTIMEOUT'=>78,'CURLOPT_HTTPHEADER'=>10023,'CURLOPT_POSTFIELDS'=>10015,'CURLOPT_SSL_VERIFYPEER'=>64,'CURLINFO_HTTP_CODE'=>2097154]as $k=>$v)if(!defined($k))define($k,$v);
}
$GLOBALS['calls']=0;$GLOBALS['lastText']='';
`;

(async () => {
  let stdout = '', stderr = '';
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  const CONFIG = "<?php return ['telegram_token'=>'1:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>true];";
  const body = PHP.replace('require __DIR__', PRELUDE + '\nrequire __DIR__');
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't715-'));
    fs.mkdirSync(path.join(dir, 'app/api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'sync'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app/api/rfq-notify-lib.php'), lib);
    fs.writeFileSync(path.join(dir, 'bot-config.php'), CONFIG);
    fs.writeFileSync(path.join(dir, 'test.php'), body);
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
      await php.writeFile('/test/test.php', body);
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
  console.log('\n=== tester715 BOT-MSG-P2-b: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
