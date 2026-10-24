#!/usr/bin/env node
'use strict';
/* v34.39.64 (BOT-MSG-P0) — «یک اقدام، دو پیام» و «منبع/انجام‌دهندهٔ غلط».
   ارزیابی ۲۰۲۶-۱۰-۲۴ نشان داد یک تغییر وضعیت از کانبان/دراپ‌داون روی درخواست‌های
   سایت دو نوشتن دارد (entity_upsert مرجع + set_status آینهٔ رهگیری) و هر دو به گروه
   پیام می‌دادند با «وضعیت قبلی» و منبع متفاوت؛ منبع هم ثابت «سایت» و انجام‌دهنده
   username خام بود. این تست سه لایه را می‌سنجد:
   ① قرارداد کد (کلید هم‌ترازی کانال، منبع مشتق از نشست، نام نمایشی، ok واقعی تلگرام)
   ② اجرای واقعی PHP: صف با هم‌ترازی canonical/mirror در هر دو ترتیب
   ③ عدم سرکوب گذارهای واقعی (تکرار در یک کانال، ثبت+تایید، کدهای متفاوت)
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
const api = read('api/crm.php');
const bot = read('api/notify-bot.php');

/* ═══ ① قرارداد کد ═══ */
T('lib: ptf_rfq_notify_events کانال (canonical/mirror) می‌گیرد',
  /function ptf_rfq_notify_events\([^)]*string \$channel = 'canonical'\)/.test(lib));
T('lib: هر رویداد کلید هم‌ترازی و کانال را حمل می‌کند',
  lib.includes("'dedupeKey'=>\$dedupeKey, 'channel'=>(\$channel === 'mirror' ? 'mirror' : 'canonical')"));
T('lib: صف، آینه را در برابر مرجع حذف می‌کند (نه گذار واقعی را)',
  lib.includes('$channel === \'mirror\' && $peerCanonical') &&
  lib.includes("if ($pst === 'pending')") && lib.includes("in_array($pst, ['sending', 'sent'], true)"));
T('lib: کلید هم‌ترازی روی «کد نمایشی» است نه _id (دو مجموعه هویت متفاوت دارند)',
  lib.includes("\$alignId = ptf_rfq_notify_first(\$row, ['cd','code','inqNo'], 160) ?: \$id;"));
T('lib: شمارندهٔ سرکوب هم‌ترازی قابل مشاهده است', lib.includes("\$counts['alignSuppressed']"));
T('crm.php: منبع از نشست مشتق می‌شود، نه ثابت «سایت»',
  api.includes("\$notifySource = \$auth_info ? 'crm' : 'site';") && !api.includes("ptf_rfq_notify_events(\$before, \$data, 'site',"));
T('crm.php: انجام‌دهنده = نام نمایشی کاربر (resolve_actor + فهرست کاربران سرور)',
  api.includes('ptf_rfq_notify_resolve_actor((string)($auth_info[\'user\'] ?? \'\'), is_array($notifyUsersCache)'));
T('crm.php: set_status روی rfqs کانال mirror است (نوشتن مرجع همان entity/push)',
  api.includes("\$notifyChannel = (\$key === 'rfqs' && \$action === 'set_status') ? 'mirror' : 'canonical';"));
T('notify-bot.php: موفقیت ارسال از ok بدنهٔ تلگرام خوانده می‌شود، نه فقط HTTP 2xx',
  bot.includes('function bot_delivered') && (bot.match(/bot_delivered\(/g) || []).length >= 5 &&
  !/\$r\['code'\] >= 200 && \$r\['code'\] < 300\) \$sent\[\]/.test(bot));

/* ═══ ②③ اجرای واقعی PHP ═══ */
const PHP = `<?php
$pass=0;$fail=0;
function T($n,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$n."\\n";}else{$fail++;echo "FAIL PHP ".$n." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$dir=__DIR__.'/sync';
function resetq($dir){@unlink($dir.'/.rfq-notify.json');@mkdir($dir,0777,true);}
function jobs($dir){$f=$dir.'/.rfq-notify.json';if(!is_file($f))return [];$s=json_decode((string)file_get_contents($f),true);return is_array($s['jobs']??null)?$s['jobs']:[];}
function enq($dir,$events){ foreach(($GLOBALS['ptf_rfq_notify_scheduled']??[]) as $d=>$_) unset($GLOBALS['ptf_rfq_notify_scheduled'][$d]); return ptf_rfq_notify_enqueue($events,$dir); }
/* یک اقدام: نوشتن مرجع (ردیف CRM) + آینهٔ رهگیری (rfqs.json سایت) */
$crmBefore=[['_id'=>'S-1','cd'=>'C-1','st'=>'st1','stxt'=>'دریافت اولیه','co'=>'شرکت']];
$crmAfter =[['_id'=>'S-1','cd'=>'C-1','st'=>'st2','stxt'=>'بررسی فنی','co'=>'شرکت']];
$siteBefore=[['code'=>'C-1','status'=>'pending','statusText'=>'در انتظار تایید مدیران','company'=>'شرکت']];
$siteAfter =[['code'=>'C-1','status'=>'st2','statusText'=>'بررسی فنی','company'=>'شرکت']];
$canon=function($op) use($crmBefore,$crmAfter){return ptf_rfq_notify_events($crmBefore,$crmAfter,'crm','مهدی یوسفی',$op,true,'canonical');};
$mirror=function($op) use($siteBefore,$siteAfter){return ptf_rfq_notify_events($siteBefore,$siteAfter,'crm','مهدی یوسفی',$op,true,'mirror');};

/* کلید هم‌ترازی بین دو مجموعه (cd در برابر code) */
$c=$canon('op-a'); $m=$mirror('op-b');
T('کلید هم‌ترازی مرجع و آینه یکی است (cd/code)',count($c)===1&&count($m)===1&&$c[0]['dedupeKey']===$m[0]['dedupeKey']&&$c[0]['dedupeKey']!=='',json_encode([$c[0]['dedupeKey']??null,$m[0]['dedupeKey']??null]));
T('کانال هر رویداد درست علامت می‌خورد',$c[0]['channel']==='canonical'&&$m[0]['channel']==='mirror');

/* ۱) مرجع اول، آینه دوم ⇒ یک پیام (آینه سرکوب) */
resetq($dir); enq($dir,$canon('op-1')); $before=count(jobs($dir)); enq($dir,$mirror('op-2'));
$j=jobs($dir);
T('مرجع سپس آینه: صف یک پیام دارد',count($j)===1&&$before===1,count($j));
T('پیامِ ماندگار همان متن مرجع است',strpos((string)reset($j)['text'],'انجام‌دهنده: مهدی یوسفی')!==false);
T('سرکوب هم‌ترازی شمرده می‌شود',(ptf_rfq_notify_counts($dir)['alignSuppressed']??0)===1,json_encode(ptf_rfq_notify_counts($dir)));

/* ۲) آینه اول (هنوز ارسال‌نشده)، مرجع دوم ⇒ یک پیام با متن مرجع */
resetq($dir); enq($dir,$mirror('op-3')); enq($dir,$canon('op-4')); $j=jobs($dir);
T('آینه سپس مرجع: آینهٔ در صف با مرجع جایگزین می‌شود (یک پیام)',count($j)===1,json_encode(array_keys($j)));
T('متن نهایی متن مرجع است (نه برچسب/منبع آینه)',count($j)===1&&strpos((string)reset($j)['text'],'وضعیت قبلی: دریافت اولیه')!==false,count($j)?array_values($j)[0]['text']:'');

/* ۳) آینه ارسال‌شده، مرجع بعدی ⇒ پیام دوم ساخته نمی‌شود */
resetq($dir); enq($dir,$mirror('op-5'));
ptf_rfq_notify_store($dir,function(&$s){foreach($s['jobs'] as $k=>&$r){$r['status']='sent';$r['sentAt']=time();}unset($r);});
enq($dir,$canon('op-6')); $j=jobs($dir);
T('آینهٔ ارسال‌شده: مرجع تکراری ساخته نمی‌شود',count($j)===1,count($j));

/* ۴) ثبت سایت + تایید: دو رویداد واقعی باید هر دو بمانند */
resetq($dir);
$create=ptf_rfq_notify_events([],[['code'=>'C-2','status'=>'pending','statusText'=>'در انتظار تایید مدیران','company'=>'شرکت']],'crm','مهدی یوسفی','op-7',true,'canonical');
$approve=ptf_rfq_notify_events([['code'=>'C-2','status'=>'pending','statusText'=>'در انتظار تایید مدیران','company'=>'شرکت']],[['code'=>'C-2','status'=>'approved','statusText'=>'تایید شد','company'=>'شرکت']],'crm','مهدی یوسفی','op-8',true,'mirror');
enq($dir,$create); enq($dir,$approve);
T('ثبت درخواست + تایید آن دو رویداد مستقل‌اند (هیچ‌کدام خفه نمی‌شود)',count(jobs($dir))===2,count(jobs($dir)));

/* ۵) گذارهای واقعیِ تکراری در یک کانال سرکوب نمی‌شوند */
resetq($dir);
$wfA=[['_id'=>'S-9','cd'=>'C-9','wf'=>'WF50','stxt'=>'پیشنهاد مالی صادر شد']];
$wfB=[['_id'=>'S-9','cd'=>'C-9','wf'=>'WF60','stxt'=>'منتظر پاسخ کارفرما (مالی)']];
$wfC=[['_id'=>'S-9','cd'=>'C-9','wf'=>'WF55','stxt'=>'در حال اصلاح پیشنهاد مالی']];
enq($dir,ptf_rfq_notify_events($wfA,$wfB,'crm','u','op-9'));
enq($dir,ptf_rfq_notify_events($wfB,$wfC,'crm','u','op-10'));
enq($dir,ptf_rfq_notify_events($wfC,$wfB,'crm','u','op-11'));
T('بازگشت به همان کد وضعیت در یک کانال همچنان اعلام می‌شود',count(jobs($dir))===3,count(jobs($dir)));

/* ۶) مقصد متفاوت ⇒ هم‌ترازی نباید جلوی پیام درست را بگیرد */
resetq($dir); enq($dir,$canon('op-12'));
$rej=ptf_rfq_notify_events([['code'=>'C-1','status'=>'st2','statusText'=>'بررسی فنی']],[['code'=>'C-1','status'=>'rejected','statusText'=>'مختومه']],'crm','مهدی یوسفی','op-13',true,'mirror');
enq($dir,$rej);
T('گذار به وضعیت دیگر (رد) حتی به‌صورت آینه اعلام می‌شود',count(jobs($dir))===2,count(jobs($dir)));

/* ۷) re-enqueue همان شناسهٔ رویداد = بدون تکرار (رفتار قبلی حفظ) */
resetq($dir); $one=$canon('op-14'); enq($dir,$one); enq($dir,$one);
T('همان رویداد دوبار صف نمی‌شود',count(jobs($dir))===1,count(jobs($dir)));

/* ۸) پیام: منبع و انجام‌دهنده از آرگومان‌ها (نه ثابت) */
$p=ptf_rfq_notify_events([],[['code'=>'C-3','status'=>'pending','company'=>'شرکت']],'crm','مهدی یوسفی','op-15');
T('پیام CRM: منبع CRM و نام نمایشی انجام‌دهنده',count($p)===1&&strpos($p[0]['text'],'منبع: CRM')!==false&&strpos($p[0]['text'],'انجام‌دهنده: مهدی یوسفی')!==false,count($p)?$p[0]['text']:'');
$s=ptf_rfq_notify_events([],[['code'=>'C-4','status'=>'pending','company'=>'شرکت']],'site','سایت','op-16');
T('پیام ثبت عمومی: منبع سایت',count($s)===1&&strpos($s[0]['text'],'منبع: سایت')!==false);
echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

(async () => {
  let stdout = '', stderr = '';
  const cp = require('child_process'), os = require('os');
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  const CONFIG = "<?php return ['telegram_token'=>'1:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>true];";
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't711-'));
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
  console.log('\n=== tester711 BOT-MSG-P0: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();
