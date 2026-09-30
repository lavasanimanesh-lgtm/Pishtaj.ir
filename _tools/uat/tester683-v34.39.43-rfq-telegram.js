#!/usr/bin/env node
'use strict';
/* Server contracts + execution of the ACTUAL PHP library/WAL functions.
   Uses native PHP when available, otherwise optional php-wasm (outside repo).
   No live data or Telegram traffic: curl functions are recording test doubles. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lib = read('api/rfq-notify-lib.php'), sd = read('api/sales-domain.php'), api = read('api/crm.php');
let pass = 0, fail = 0;
function T(name, ok) { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } }
function phpFn(name) {
  const start = sd.indexOf('function ' + name + '(');
  const end = sd.indexOf('\nfunction ', start + 1);
  if (start < 0) throw new Error('missing real PHP function ' + name);
  return sd.slice(start, end < 0 ? sd.length : end);
}
const WAL = ['sd_meta_commit','sd_projection_value','sd_publish_changes','sd_pending_transaction_files','sd_recover_pending_transactions','sd_commit'].map(phpFn).join('\n');
const PHP_TEST = `<?php
$pass=0;$fail=0;
function T($name,$ok){global $pass,$fail;if($ok){$pass++;echo "PASS ".$name."\\n";}else{$fail++;echo "FAIL ".$name."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
function sd_sync_dir():string{return __DIR__.'/app/crm/data/sync';}
function sd_now():string{return gmdate('Y-m-d\\TH:i:s\\Z');}
function sd_read(string $key):array{$f=sd_sync_dir().'/'.$key.'.json';return is_file($f)?(json_decode(file_get_contents($f),true)?:[]):[];}
function ptf_db_write_rev($k,$v,$rev){return true;}
${WAL}
$GLOBALS['calls']=[];$GLOBALS['mode']='ok';
function curl_init($url=null){$GLOBALS['curl_url']=$url;return 1;}
function curl_setopt_array($ch,$opts){$GLOBALS['curl_opts']=$opts;return true;}
function curl_exec($ch){$GLOBALS['calls'][]=['url'=>$GLOBALS['curl_url'],'payload'=>json_decode($GLOBALS['curl_opts'][CURLOPT_POSTFIELDS],true)];
 $mode=$GLOBALS['mode'];if($mode==='timeout'||$mode==='connect')return false;
 if($mode==='badjson')return '<html>gateway</html>';
 if($mode==='reject')return '{"ok":false,"error_code":400}';
 if($mode==='rate')return '{"ok":false,"error_code":429,"parameters":{"retry_after":123}}';
 return '{"ok":true,"result":{"message_id":1234}}';}
function curl_getinfo($ch,$key){return $GLOBALS['mode']==='rate'?429:(in_array($GLOBALS['mode'],['timeout','connect'],true)?0:200);}
function curl_errno($ch){return $GLOBALS['mode']==='timeout'?28:($GLOBALS['mode']==='connect'?7:0);}
function curl_close($ch){return true;}
foreach(['CURLOPT_RETURNTRANSFER'=>19913,'CURLOPT_POST'=>47,'CURLOPT_CONNECTTIMEOUT'=>78,'CURLOPT_TIMEOUT'=>13,'CURLOPT_SSL_VERIFYPEER'=>64,'CURLOPT_HTTPHEADER'=>10023,'CURLOPT_POSTFIELDS'=>10015,'CURLINFO_HTTP_CODE'=>2097154] as $k=>$v)if(!defined($k))define($k,$v);
function storeRead(){return json_decode(file_get_contents(sd_sync_dir().'/.rfq-notify.json'),true);}
function resetQueue(){ptf_rfq_notify_store(sd_sync_dir(),function(&$s){$s=['version'=>1,'jobs'=>[],'nextSendAt'=>0];});$GLOBALS['calls']=[];$GLOBALS['mode']='ok';}
function ready(){ptf_rfq_notify_store(sd_sync_dir(),function(&$s){$s['nextSendAt']=0;foreach($s['jobs'] as &$r)$r['nextAttemptAt']=0;unset($r);});}
$r=['_id'=>'RQ-A','cd'=>'RFQ-101','co'=>'شرکت نمونه','st'=>'st1','stxt'=>'دریافت اولیه','subj'=>'درخواست شیر کنترلی','ca'=>'شیرآلات','phone'=>'PRIVATE_PHONE','amount'=>9999,'files'=>['PRIVATE_LINK']];
$hash=hash('sha256',json_encode($r));
$e=ptf_rfq_notify_events([],[$r],'crm','sales-user','op-1');
T('new RFQ creates one event',count($e)===1&&$e[0]['kind']==='created');
T('message has number/customer/subject/status/verified actor',['RFQ-101','شرکت نمونه','درخواست شیر کنترلی','دریافت اولیه','sales-user']===array_values(array_filter(['RFQ-101','شرکت نمونه','درخواست شیر کنترلی','دریافت اولیه','sales-user'],function($x)use($e){return strpos($e[0]['text'],$x)!==false;})));
T('CRM notice excludes money/contact/attachment fields',strpos($e[0]['text'],'PRIVATE_')===false&&strpos($e[0]['text'],'9999')===false);
T('event builder never mutates source records',hash('sha256',json_encode($r))===$hash);
$fallback=ptf_rfq_notify_events([],[['_id'=>'RQ-F','cd'=>'','code'=>'PUBLIC-1','co'=>'','company'=>'شرکت جایگزین','st'=>'','status'=>'pending','stxt'=>'','statusText'=>'در انتظار بررسی']],'site','u','fallback');
T('empty legacy fields fall back to real code/company/status',count($fallback)===1&&strpos($fallback[0]['text'],'PUBLIC-1')!==false&&strpos($fallback[0]['text'],'شرکت جایگزین')!==false&&strpos($fallback[0]['text'],'در انتظار بررسی')!==false);
T('empty st never hides a real legacy status transition',ptf_rfq_notify_state(['st'=>'','status'=>'pending'])!==ptf_rfq_notify_state(['st'=>'','status'=>'approved']));
T('unchanged snapshot emits no notice',ptf_rfq_notify_events([$r],[$r],'crm','u','op-2')===[]);
$changed=$r;$changed['st']='st2';$changed['stxt']='بررسی فنی';
$ch=ptf_rfq_notify_events([$r],[$changed],'crm','u','op-3');
T('status change contains both previous and new labels',count($ch)===1&&strpos($ch[0]['text'],'وضعیت قبلی: دریافت اولیه')!==false&&strpos($ch[0]['text'],'وضعیت جدید: بررسی فنی')!==false);
$initial=$r;$initial['wf']='WF10';$initial['stxt']='🔴 دریافت اولیه';
T('initial workflow/label formatting is not a transition',ptf_rfq_notify_events([$r],[$initial],'crm','u','op-4')===[]);
$flow=$initial;$flow['wf']='WF20';$flow['stxt']='پیشنهاد فنی صادر شد';
T('automatic offer workflow changes notify even with unchanged st',count(ptf_rfq_notify_events([$initial],[$flow],'crm','u','op-5'))===1);
$edit=$r;$edit['subj']='عنوان ویرایش‌شده';$edit['files']=['new'];$edit['updatedAt']='now';$edit['assignedUser']='another';
T('attachment/contact/assignment edits are not status changes',ptf_rfq_notify_events([$r],[$edit],'crm','u','op-6')===[]);
$legacy=$r;unset($legacy['_id']);
T('canonical id backfill matches existing cd without false creation',ptf_rfq_notify_events([$legacy],[$r],'crm','u','op-7')===[]);
T('canonical id survives a display code change',ptf_rfq_notify_events([$r],[array_merge($r,['cd'=>'RFQ-102'])],'crm','u','op-8')===[]);
T('empty/conflicting/duplicated identities fail closed',ptf_rfq_notify_events([],[['co'=>'x']],'crm','u','a')===[]&&ptf_rfq_notify_events([],[$r,$r],'crm','u','b')===[]&&ptf_rfq_notify_events([$r,array_merge($r,['_id'=>'RQ-B','cd'=>'RFQ-102'])],[array_merge($r,['cd'=>'RFQ-102'])],'crm','u','c')===[]);
T('deletion is not a new/status notification',ptf_rfq_notify_events([$r],[],'crm','u','op-del')===[]);
T('explicit creation suppression retains status events',ptf_rfq_notify_events([],[$r],'crm','u','x',false)===[]&&count(ptf_rfq_notify_events([$r],[$changed],'crm','u','y',false))===1);
T('true repeated transitions receive distinct operation identities',$ch[0]['id']!==ptf_rfq_notify_events([$r],[$changed],'crm','u','op-other')[0]['id']);
T('stable replay keeps same event id',$e[0]['id']===ptf_rfq_notify_events([],[$r],'crm','sales-user','op-1')[0]['id']);
T('Unicode and line sanitization prevents multiline spoofing',ptf_rfq_notify_text("نام\\nانجام‌دهنده جعلی\\u{202E}")=== 'نام انجام‌دهنده جعلی'&&ptf_rfq_notify_text(str_repeat('ش',300),40)===str_repeat('ش',40));
T('Persian group chat id and server config normalize',ptf_rfq_notify_enabled()&&ptf_rfq_notify_cfg()['telegram_chat_id']==='-100123');
resetQueue();ptf_rfq_notify_enqueue($e);ptf_rfq_notify_enqueue($e);
T('enqueue has no external I/O and deduplicates durable job',count($GLOBALS['calls'])===0&&count(storeRead()['jobs'])===1);
ptf_rfq_notify_flush();$s=storeRead();
T('successful delivery requires Telegram acknowledgement',count($GLOBALS['calls'])===1&&$s['jobs'][$e[0]['id']]['status']==='sent');
T('uses configured group, plain text and disabled link previews',$GLOBALS['calls'][0]['payload']['chat_id']==='-100123'&&!isset($GLOBALS['calls'][0]['payload']['parse_mode'])&&$GLOBALS['calls'][0]['payload']['disable_web_page_preview']===true);
T('sent marker removes customer message text',!isset($s['jobs'][$e[0]['id']]['text']));
ptf_rfq_notify_enqueue($e);ready();ptf_rfq_notify_flush();
T('replay/refresh never redelivers a sent job',count($GLOBALS['calls'])===1);
foreach(['reject','rate','connect','timeout','badjson'] as $caseMode){
 resetQueue();ptf_rfq_notify_enqueue($e);$GLOBALS['mode']=$caseMode;ptf_rfq_notify_flush();$s=storeRead();$j=$s['jobs'][$e[0]['id']];
 $pending=in_array($caseMode,['reject','rate','connect'],true);
 T('delivery classification '.$caseMode,$j['status']===($pending?'pending':'uncertain'));
 if($caseMode==='rate')T('429 respects server retry_after', $j['nextAttemptAt']>=time()+122&&$s['nextSendAt']===$j['nextAttemptAt']);
 if(!$pending){ready();ptf_rfq_notify_flush();T('uncertain delivery is not automatically retried '.$caseMode,count($GLOBALS['calls'])===1);}
}
resetQueue();ptf_rfq_notify_enqueue($e);$GLOBALS['mode']='reject';ptf_rfq_notify_flush();$n=count($GLOBALS['calls']);ptf_rfq_notify_flush();
T('confirmed rejection uses backoff instead of immediate resend',count($GLOBALS['calls'])===$n);
ready();$GLOBALS['mode']='ok';ptf_rfq_notify_flush();
T('safe retry after confirmed failure can deliver',storeRead()['jobs'][$e[0]['id']]['status']==='sent');
resetQueue();ptf_rfq_notify_enqueue($e);ptf_rfq_notify_store(sd_sync_dir(),function(&$s){foreach($s['jobs'] as &$j)$j['attempts']=7;unset($j);});$GLOBALS['mode']='reject';ptf_rfq_notify_flush();
T('confirmed failures stop after eight attempts and stay available for operator',storeRead()['jobs'][$e[0]['id']]['status']==='failed');
resetQueue();ptf_rfq_notify_enqueue($e);ptf_rfq_notify_store(sd_sync_dir(),function(&$s){foreach($s['jobs'] as &$j){$j['status']='sending';$j['claimedAt']=time()-100;}unset($j);});ptf_rfq_notify_flush();
T('crashed send is quarantined, not blindly duplicated',storeRead()['jobs'][$e[0]['id']]['status']==='uncertain'&&count($GLOBALS['calls'])===0);
resetQueue();ptf_rfq_notify_enqueue(array_merge($e,$ch));ptf_rfq_notify_flush();ptf_rfq_notify_flush();
T('group rate leaves next event pending without sleeping in HTTP',count($GLOBALS['calls'])===1&&ptf_rfq_notify_counts()['pending']===1);
/* Actual WAL function execution (not a reimplementation). */
resetQueue();file_put_contents(sd_sync_dir().'/ptf_crm_rfqs.json','[]');
$ctx=['key'=>'cmd-new','action'=>'entity_upsert','requestHash'=>'HASH','owner'=>'verified-user'];
$rev=sd_commit(['ptf_crm_rfqs'=>[$r]],$ctx);
T('actual domain commit publishes source and enqueues once',$rev>0&&count(sd_read('ptf_crm_rfqs'))===1&&ptf_rfq_notify_counts()['pending']===1);
T('commit releases/removes business WAL before any Telegram I/O',sd_pending_transaction_files()===[]&&count($GLOBALS['calls'])===0);
ptf_rfq_notify_flush();$sent=count($GLOBALS['calls']);sd_commit(['ptf_crm_rfqs'=>[$r]],$ctx);ready();ptf_rfq_notify_flush();
T('same authoritative record/operation remains idempotent',count($GLOBALS['calls'])===$sent);
$changes=['ptf_crm_rfqs'=>[$changed]];$events=ptf_rfq_notify_events([$r],[$changed],'crm','u','crash-event');
$record=['version'=>1,'changesHash'=>hash('sha256',json_encode($changes,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)),'changes'=>$changes,'rfqNotifications'=>$events];
$wal=sd_sync_dir().'/.sales-tx-e2e.json';file_put_contents($wal,json_encode($record));
/* Emulate a process dying after RFQs have already been renamed. */
file_put_contents(sd_sync_dir().'/ptf_crm_rfqs.json',json_encode([$changed]));
sd_recover_pending_transactions();ready();ptf_rfq_notify_flush();
T('crash recovery does not lose original status notice after partial rename',count($GLOBALS['calls'])===$sent+1&&sd_pending_transaction_files()===[]);
file_put_contents($wal,json_encode($record));sd_recover_pending_transactions();ready();ptf_rfq_notify_flush();
T('repeated WAL recovery cannot duplicate the same notice',count($GLOBALS['calls'])===$sent+1);
resetQueue();$record['rfqNotifications']=ptf_rfq_notify_events([$r],[$changed],'crm','u','storage-fault-new-event');file_put_contents(sd_sync_dir().'/.rfq-notify.json','BROKEN');file_put_contents($wal,json_encode($record));
$rv=sd_recover_pending_transactions();
T('outbox storage failure does not leave an old business WAL to clobber new data',$rv===1&&sd_pending_transaction_files()===[]&&count(glob(sd_sync_dir().'/.rfq-notify-recover-*.json'))===1);
file_put_contents(sd_sync_dir().'/ptf_crm_rfqs.json',json_encode([$r]));/* operator repairs the corrupt private outbox */file_put_contents(sd_sync_dir().'/.rfq-notify.json',json_encode(['version'=>1,'jobs'=>[],'nextSendAt'=>0]));ptf_rfq_notify_flush();
T('notification-only recovery never republishes old business projections',sd_read('ptf_crm_rfqs')[0]['st']==='st1'&&count($GLOBALS['calls'])===1);
resetQueue();sd_commit(['ptf_crm_rfqs'=>[$changed]],['key'=>'restore','action'=>'entity_restore','requestHash'=>'h','owner'=>'u']);
T('restoring historical RFQs never broadcasts them',ptf_rfq_notify_counts()['pending']===0&&count($GLOBALS['calls'])===0);
echo "PHP_RUNTIME_COUNTS ".$pass." ".$fail."\\n";
`;
async function main() {
  T('native command and site/sync APIs load shared server library',sd.includes("require_once __DIR__ . '/rfq-notify-lib.php'")&&api.includes("require_once __DIR__ . '/rfq-notify-lib.php'"));
  const commit=phpFn('sd_commit'),recover=phpFn('sd_recover_pending_transactions');
  T('WAL captures original event before publishing projections',commit.indexOf("$record['rfqNotifications']")<commit.indexOf('$walJson')&&commit.indexOf('ptf_rfq_notify_after_commit')>commit.indexOf('sd_publish_changes'));
  const outFn=sd.slice(sd.indexOf('function sd_out('),sd.indexOf('\n}\n',sd.indexOf('function sd_out('))+3);
  T('early/idempotent response releases business mutex before shutdown I/O',outFn.indexOf('LOCK_UN')>0&&outFn.indexOf('LOCK_UN')<outFn.indexOf('echo json_encode'));
  T('recovery enqueues only after authoritative republish',recover.indexOf('ptf_rfq_notify_after_commit')>recover.indexOf('sd_publish_changes'));
  T('notification recovery is separate from business replay namespace',lib.includes('/.rfq-notify-recover-')&&phpFn('sd_pending_transaction_files').includes('/.sales-tx-'));
  T('legacy sync hook is after accepted write and suppresses restore',api.indexOf('ptf_rfq_notify_enqueue(ptf_rfq_notify_events($rfqBefore')>api.indexOf('if (!sync_key_write($sdir, $k, $v, $pushNextRev))')&&api.includes("$k === 'ptf_crm_rfqs' && !$restore && !$allow_wipe"));
  T('site Telegram does not double-send; existing SMS/Bale retained',api.includes('true /* Telegram handled by the RFQ outbox')&&api.includes('!$skipTelegram &&')&&api.includes("['bale_token']")&&api.includes('sms_send((string)$m'));
  T('failed site write exits before event/bot alert',api.indexOf("if (!save_data('rfqs', $rfqs))")<api.indexOf("push_event_rec('rfq_site'"));
  T('automatic notices do not rely on browser localStorage or notify hooks',!lib.includes('ptf_bot_enabled')&&!lib.includes('localStorage')&&!lib.includes('notify-bot.php?action=send'));
  T('CLI worker rejects HTTP before loading library',read('api/rfq-notify-cron.php').indexOf("PHP_SAPI !== 'cli'")<read('api/rfq-notify-cron.php').indexOf('require_once'));
  T('bot status reports automatic RFQ state without revealing secrets',read('api/notify-bot.php').includes("'rfq_notifications' => $rfqAuto"));
  T('server config is ignored by Git and browser contains no bot token',read('.gitignore').split('\n').includes('bot-config.php')&&!read('crm/messengers.js').includes('telegram_token'));
  const native=cp.spawnSync('php',['-v'],{encoding:'utf8'});
  let stdout='', stderr='';
  if (!native.error && native.status===0) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ptf-rfq-notify-'));
    try {
      fs.mkdirSync(path.join(dir,'app/api'),{recursive:true});fs.mkdirSync(path.join(dir,'app/crm/data/sync'),{recursive:true});
      fs.writeFileSync(path.join(dir,'app/api/rfq-notify-lib.php'),lib);
      fs.writeFileSync(path.join(dir,'bot-config.php'),"<?php return ['telegram_token'=>'111:TEST_ONLY','telegram_chat_id'=>' -۱۰۰۱۲۳ '];");
      fs.writeFileSync(path.join(dir,'test.php'),PHP_TEST);
      const r=cp.spawnSync('php',['-d','disable_functions=curl_init,curl_setopt_array,curl_exec,curl_getinfo,curl_errno,curl_close',path.join(dir,'test.php')],{encoding:'utf8',timeout:15000});
      stdout=r.stdout||'';stderr=r.stderr||'';T('native PHP runtime completes',!r.error&&r.status===0);
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
  } else {
    let PhpNode;
    try {PhpNode=require('php-wasm/PhpNode').PhpNode;} catch(e) {}
    if (PhpNode) {
      const php=new PhpNode();const out=[],err=[];
      php.addEventListener('output',e=>out.push(e.detail||e.data||''));php.addEventListener('error',e=>err.push(e.detail||e.data||''));
      await php.run("<?php @mkdir('/test/app/api',0777,true);@mkdir('/test/app/crm/data/sync',0777,true);");
      await php.writeFile('/test/app/api/rfq-notify-lib.php',lib);
      await php.writeFile('/test/bot-config.php',"<?php return ['telegram_token'=>'111:TEST_ONLY','telegram_chat_id'=>' -۱۰۰۱۲۳ '];");
      await php.writeFile('/test/test.php',PHP_TEST);
      await php.run("<?php require '/test/test.php';");stdout=out.join('');stderr=err.join('');
      T('actual PHP-WASM runtime completes',stdout.includes('PHP_RUNTIME_COUNTS'));
    } else console.log('SKIP PHP execution: install php-cli or optional php-wasm; server contracts checked only.');
  }
  if(stdout){console.log(stdout.replace(/PHP_RUNTIME_COUNTS.*/,'').trim());const m=stdout.match(/PHP_RUNTIME_COUNTS (\d+) (\d+)/);if(m){pass+=+m[1];fail+=+m[2];}else T('PHP execution returns assertion summary',false);}
  if(stderr)console.log('PHP diagnostics: '+stderr.trim().slice(-1200));
  console.log('\n=== tester683 RFQ Telegram: '+pass+' PASS / '+fail+' FAIL ===');
  process.exitCode=fail?1:0;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={PHP_TEST,WAL};
