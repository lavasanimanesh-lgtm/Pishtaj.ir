#!/usr/bin/env node
'use strict';
/* Actual PHP APIs, synthetic VFS/state/auth/config only; curl records outgoing calls.
   Optional dependency: npm i --prefix /path/outside/repo php-wasm
   NODE_PATH=/path/outside/repo/node_modules node _tools/uat/e2e-rfq-telegram-v34.39.43.js
   No production data/config/token, real Telegram delivery, DB or PHP FPM involved. */
const { PhpNode } = require('php-wasm/PhpNode');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const FILES = ['crm.php','sales-domain.php','auth.php','secrets.php','storage-lib.php','db-lib.php','contact-merge-lib.php','rfq-notify-lib.php','notify-bot.php'];
const SECRET = 'e2e-only-rfq-auth-0123456789abcdef0123456789abcdef';
let pass=0, fail=0;
function T(name,ok,detail){if(ok){pass++;console.log('PASS '+name);}else{fail++;console.log('FAIL '+name+(detail?' — '+String(detail).slice(0,350):''));}}
const MB=`
if(!function_exists('mb_strlen')){function mb_strlen($s,$enc=null){return preg_match_all('/./us',$s);}}
if(!function_exists('mb_substr')){function mb_substr($s,$a,$n=null,$enc=null){$chars=preg_split('//u',$s,-1,PREG_SPLIT_NO_EMPTY);return implode('',array_slice($chars?:[],$a,$n));}}
if(!function_exists('mb_strtolower')){function mb_strtolower($s,$enc=null){return strtolower($s);}}
if(!function_exists('mb_strpos')){function mb_strpos($s,$n,$a=0,$enc=null){return strpos($s,$n,$a);}}
if(!function_exists('mb_convert_encoding')){function mb_convert_encoding($s,$to,$from=null){return $s;}}
`;
const CURL=`
if(!function_exists('curl_init')){
 $GLOBALS['__curl']=[];
 function curl_init($u=null){$i=count($GLOBALS['__curl']);$GLOBALS['__curl'][$i]=['url'=>$u,'opts'=>[]];return $i;}
 function curl_setopt_array($h,$o){$GLOBALS['__curl'][$h]['opts']=$o;return true;}
 function curl_setopt($h,$k,$v){$GLOBALS['__curl'][$h]['opts'][$k]=$v;return true;}
 function curl_exec($h){$c=$GLOBALS['__curl'][$h];$mode=trim(file_get_contents('/tmp2/mode'));
  file_put_contents('/tmp2/calls',json_encode(['url'=>$c['url'],'body'=>$c['opts'][CURLOPT_POSTFIELDS]??null])."\\n",FILE_APPEND);
  if($mode==='timeout'||$mode==='connect')return false;
  if($mode==='badjson')return '<html>proxy</html>';
  if($mode==='reject')return '{"ok":false,"error_code":400,"description":"test rejection"}';
  if($mode==='rate')return '{"ok":false,"error_code":429,"parameters":{"retry_after":120}}';
  return '{"ok":true,"result":{"message_id":12345},"return":{"status":200}}';}
 function curl_getinfo($h,$k=null){$m=trim(file_get_contents('/tmp2/mode'));return $m==='rate'?429:(in_array($m,['timeout','connect'],true)?0:200);}
 function curl_errno($h){$m=trim(file_get_contents('/tmp2/mode'));return $m==='timeout'?28:($m==='connect'?7:0);}
 function curl_error($h){return '';}
 function curl_close($h){return true;}
 foreach(['CURLOPT_RETURNTRANSFER'=>19913,'CURLOPT_POST'=>47,'CURLOPT_TIMEOUT'=>13,'CURLOPT_CONNECTTIMEOUT'=>78,'CURLOPT_HTTPHEADER'=>10023,'CURLOPT_POSTFIELDS'=>10015,'CURLOPT_SSL_VERIFYPEER'=>64,'CURLINFO_HTTP_CODE'=>2097154]as $k=>$v)if(!defined($k))define($k,$v);
}
`;
const INPUT=`class RfqE2EInput {
 public $context;public $value='';public $pos=0;
 public function stream_open($p,$m,$o,&$opened){$this->value=$GLOBALS['E2E_BODY']??'';$opened=true;return true;}
 public function stream_read($n){$v=substr($this->value,$this->pos,$n);$this->pos+=strlen($v);return $v;}
 public function stream_eof(){return $this->pos>=strlen($this->value);}
 public function stream_tell(){return $this->pos;}
 public function stream_seek($p,$w){$this->pos=$p;return true;}
 public function stream_stat(){return [];}
 public function stream_close(){}
}
@stream_wrapper_unregister('php');@stream_wrapper_register('php','RfqE2EInput');
`;
function fresh(){return {};}
async function request(state,opts={}){
 const php=new PhpNode(),out=[],err=[];
 php.addEventListener('output',e=>out.push(e.detail||e.data||''));php.addEventListener('error',e=>err.push(e.detail||e.data||''));
 await php.run("<?php @mkdir('/w/app/api',0777,true);@mkdir('/w/app/crm/data/sync',0777,true);@mkdir('/tmp2',0777,true);");
 for(const f of FILES){
  let source=fs.readFileSync(path.join(ROOT,'api',f),'utf8');
  if(f==='sales-domain.php')source=source.replace('    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);\n    exit;', '    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);\n    rfq_e2e_capture_state();\n    exit;');
  await php.writeFile('/w/app/api/'+f,source);
 }
 await php.writeFile('/w/ptf-secrets.php',`<?php return ['auth_key'=>'${SECRET}','captcha_key'=>'${SECRET}'];`);
 if(opts.config!==false)await php.writeFile('/w/bot-config.php',`<?php return ['telegram_token'=>'111:TEST_ONLY','telegram_chat_id'=>'${opts.chatId||'-۱۰۰۱۲۳'}','rfq_notifications'=>${opts.enabled===false?'false':'true'}];`);
 for(const [file,value] of Object.entries(state))await php.writeFile('/w/app/crm/data/'+file,value);
 await php.writeFile('/tmp2/body',JSON.stringify(opts.body||{}));await php.writeFile('/tmp2/calls','');await php.writeFile('/tmp2/mode',opts.mode||'ok');
 const auth=opts.auth===false?"$_SERVER['HTTP_X_CRM_TOKEN']='invalid-test-token';":`
 $user='${opts.user||'admin'}';$role='${opts.role||'admin'}';$now=time();$nonce=bin2hex(random_bytes(16));
 $p=$user.'|'.$role.'|'.$now.'|'.$nonce;$sig=hash_hmac('sha256',$p,'${SECRET}');
 $tok=rtrim(strtr(base64_encode($p.'|'.$sig),'+/','-_'),'=');
 $tf='/w/app/crm/data/tokens.json';$ts=is_file($tf)?(json_decode(file_get_contents($tf),true)?:[]):[];
 $ts[$tok]=['user'=>$user,'role'=>$role,'iat'=>$now,'exp'=>$now+86400,'ip'=>'10.0.0.88'];file_put_contents($tf,json_encode($ts));
 $_SERVER['HTTP_X_CRM_TOKEN']=$tok;`;
 const endpoint=opts.endpoint||'sales-domain.php';
 const post=opts.post?`$_POST=json_decode(${JSON.stringify(JSON.stringify(opts.post))},true);`:'$_POST=[];';
 const captcha=opts.captcha?`$ct=time();$_POST['captcha_token']=base64_encode($ct.'|'.hash_hmac('sha256','7|'.$ct,'${SECRET}'));$_POST['captcha_answer']='${opts.captcha==='bad'?8:7}';`:'';
 const code=`<?php error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED); ini_set('display_errors','0'); ${MB}${CURL}
 $_SERVER['HTTP_HOST']='crm.test';$_SERVER['REMOTE_ADDR']='10.0.0.88';$_SERVER['REQUEST_METHOD']='POST';
 function rfq_e2e_capture_state(){
  if(!empty($GLOBALS['rfq_e2e_captured']))return;$GLOBALS['rfq_e2e_captured']=true;
  if(function_exists('ptf_rfq_notify_flush'))foreach(($GLOBALS['ptf_rfq_notify_scheduled']??[])as $dir=>$_)ptf_rfq_notify_flush($dir);
  if(function_exists('ptf_site_alert_flush')&&!empty($GLOBALS['__ptf_site_alerts']))ptf_site_alert_flush();
  $dirs=['/w/app/crm/data'=>'','/w/app/crm/data/sync'=>'sync/'];
  if(function_exists('sd_sync_dir'))$dirs[sd_sync_dir()]='sync/';
  $files=[];foreach($dirs as $dir=>$prefix)foreach(array_merge(glob($dir.'/*.json')?:[],glob($dir.'/.*.json')?:[])as $file)$files[$prefix.basename($file)]=file_get_contents($file);
  echo "\\n__PTF_E2E_PRIVATE_STATE__".json_encode(['files'=>$files,'calls'=>file_get_contents('/tmp2/calls'),'businessLockOpen'=>is_resource($GLOBALS['lock']??null)])."\\n";
 }
 ${auth}${post}${captcha}
 $_GET=['action'=>'${opts.action||'entity_upsert'}'];$_REQUEST=array_merge($_GET,$_POST);
 $GLOBALS['E2E_BODY']=file_get_contents('/tmp2/body');${INPUT}
 require '/w/app/api/${endpoint}';rfq_e2e_capture_state();`;
 await php.run(code);
 // Transport-only adapter: native exit in the embed SAPI drops request globals;
 // sd_out captures the synthetic state/callbacks immediately before exit.
 // No command/auth/business function is replaced or modeled.
 await php.run("<?php while(ob_get_level()>0)ob_end_flush();");
 await new Promise(resolve=>setTimeout(resolve,30));
 const raw=out.join(''),marker='\n__PTF_E2E_PRIVATE_STATE__';
 const split=raw.indexOf(marker),response=split<0?raw:raw.slice(0,split);
 let captured=null;
 if(split>=0){try{captured=JSON.parse(raw.slice(split+marker.length).trim());}catch(e){}}
 if(captured){Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,captured.files);}
 const calls=(captured?.calls||'').split('\n').filter(Boolean).map(x=>JSON.parse(x));
 let json={};try{json=JSON.parse(response);}catch(e){json={badResponse:response};}
 return {json,response,stderr:err.join(''),calls,businessLockOpen:captured?.businessLockOpen};
}
function q(state){try{return JSON.parse(state['sync/.rfq-notify.json']||'{"jobs":{}}');}catch(e){return {jobs:{}};}}
function messages(r){return r.calls.filter(c=>c.url.includes('api.telegram.org')&&c.url.endsWith('/sendMessage')).map(c=>JSON.parse(c.body));}
function ready(state){if(state['sync/.rfq-notify.json']){const s=q(state);s.nextSendAt=0;for(const j of Object.values(s.jobs))j.nextAttemptAt=0;state['sync/.rfq-notify.json']=JSON.stringify(s);}}
async function upsert(s,record,operation,extra={}){return request(s,{...extra,body:{collection:'ptf_crm_rfqs',record,idempotencyKey:operation,...extra.body}});}
const R={_id:'RQ-101',cd:'RFQ-101',co:'شرکت نمونه',subj:'استعلام شیر کنترلی',ca:'شیرآلات',st:'st1',stxt:'دریافت اولیه',createdBy:'FORGED_ACTOR'};
async function main(){
 const s=fresh();let r=await upsert(s,R,'create-1',{body:{expectCreate:true}});
 T('actual authenticated create is committed',r.json.ok===true,r.response+r.stderr);
 T('create schedules exactly one Telegram group message',messages(r).length===1,r.calls.length+' '+r.stderr);
 T('group id is normalized from Persian config',messages(r)[0]?.chat_id==='-100123');
 T('message identifies RFQ/customer and verified actor, not forged input',messages(r)[0]?.text.includes('RFQ-101')&&messages(r)[0]?.text.includes('شرکت نمونه')&&messages(r)[0]?.text.includes('انجام‌دهنده: admin')&&!messages(r)[0]?.text.includes('FORGED_ACTOR'));
 T('private outbox is not exposed in command projection',r.json.data&&Object.keys(r.json.data).every(k=>!k.includes('notify')));
 T('response is pure JSON without notification output',/^\s*\{[\s\S]*\}\s*$/.test(r.response));
 r=await upsert(s,R,'create-1',{body:{expectCreate:true}});T('identical command replay has no second send',r.json.ok===true&&r.json.idempotent===true&&messages(r).length===0,r.response);T('idempotent response releases business lock before post-response worker',r.businessLockOpen===false);
 r=await upsert(s,R,'no-change-2');T('save under a new operation without status change does not send',r.json.ok===true&&messages(r).length===0,r.response);
 ready(s);const changed={...R,st:'st2',stxt:'بررسی فنی'};
 r=await upsert(s,changed,'status-3');T('manual status change sends one event',r.json.ok===true&&messages(r).length===1,r.response+r.stderr);
 T('status message includes previous/new state',messages(r)[0]?.text.includes('وضعیت قبلی: دریافت اولیه')&&messages(r)[0]?.text.includes('وضعیت جدید: بررسی فنی'));
 r=await upsert(s,{...changed,files:{oth:[{name:'new'}]},subj:'ویرایش عنوان'},'edit-4');T('attachment/title edit does not send status noise',r.json.ok===true&&messages(r).length===0,r.response);
 ready(s);r=await upsert(s,R,'status-back');T('returning to a prior state is a real new transition',r.json.ok===true&&messages(r).length===1);
 ready(s);r=await upsert(s,changed,'unauth',{auth:false});T('unauthenticated mutation neither writes nor sends',r.json.ok===false&&messages(r).length===0);
 r=await upsert(s,{...R,cd:'RFQ-X'},'bad-role',{user:'guest',role:'invented'});T('unauthorized role cannot register or send group notification',r.json.ok===false&&messages(r).length===0);
 r=await upsert(s,{...R,cd:'RFQ-INVALID'},'invalid-record',{body:{record:{cd:''}}});T('invalid RFQ is rejected before notification',r.json.ok===false&&messages(r).length===0,r.response);
 ready(s);r=await request(s,{action:'register_offer',body:{idempotencyKey:'offer-1',createIntent:true,offer:{no:'TO-101',kind:'TO',inqNo:'RFQ-101',buyerCo:'شرکت نمونه',st:'draft',items:[]}}});
 T('real offer command succeeds and advances RFQ workflow',r.json.ok===true,r.response+r.stderr);
 T('automatic workflow emits one technical proposal status notice',messages(r).length===1&&messages(r)[0]?.text.includes('پیشنهاد فنی صادر شد'),r.calls.length+' '+r.stderr);
 r=await request(s,{action:'snapshot',body:{}});T('reading snapshot/refresh emits no group messages',r.json.ok===true&&messages(r).length===0,r.response);
 /* Real legacy sync path: successful acceptance / same state / conflict / restore. */
 const ls=fresh(),payload=()=>({data:{ptf_crm_rfqs:JSON.stringify([R])},by:'FORGED_SYNC_USER'});
 r=await request(ls,{endpoint:'crm.php',action:'data_push',body:payload()});
 T('accepted legacy RFQ push notifies exactly once',r.json.ok===true&&r.json.savedKeys?.includes('ptf_crm_rfqs')&&messages(r).length===1,r.response+r.stderr);
 T('legacy message actor comes from verified auth, not payload by',messages(r)[0]?.text.includes('انجام‌دهنده: admin')&&!messages(r)[0]?.text.includes('FORGED_SYNC_USER'));
 r=await request(ls,{endpoint:'crm.php',action:'data_push',body:payload()});T('unchanged legacy sync/refresh does not notify',r.json.ok===true&&messages(r).length===0);
 r=await request(ls,{endpoint:'crm.php',action:'data_push',body:{data:{ptf_crm_rfqs:JSON.stringify([{...R,st:'st7'}])},base:{ptf_crm_rfqs:0}}});
 T('rejected stale sync cannot announce its proposed state',messages(r).length===0&&r.json.conflicts?.includes('ptf_crm_rfqs'),r.response);
 ready(ls);r=await request(ls,{endpoint:'crm.php',action:'data_push',body:{...payload(),data:{ptf_crm_rfqs:JSON.stringify([{...R,st:'st7',stxt:'تحویل شده'}])},restore:true}});
 T('authorized historical restore is silent',r.json.ok===true&&messages(r).length===0,r.response);
 /* Existing site registration goes through outbox once; no legacy duplicate. */
 const site=fresh();r=await request(site,{endpoint:'crm.php',action:'add_rfq_site',post:{company:'شرکت سایت',name:'مهندس نمونه',phone:'09120000001',subject:'درخواست سایت',category:'شیرآلات'},captcha:true});
 T('real public site RFQ registration succeeds',r.json.ok===true&&!!r.json.code,r.response+r.stderr);
 T('site creation is one Telegram event, not an outbox+legacy duplicate',messages(r).length===1,r.calls.length+' '+r.stderr);
 const code=r.json.code;ready(site);
 r=await request(site,{endpoint:'crm.php',action:'set_status',post:{type:'rfq',code,status:'approved',statusText:'تایید شده',by:'FORGED_SITE_USER'}});
 T('approved site RFQ notifies once with both states',r.json.ok===true&&messages(r).length===1&&messages(r)[0]?.text.includes('در انتظار تایید')&&messages(r)[0]?.text.includes('تایید شده'),r.response+r.stderr);
 T('site status actor cannot be forged by POST by',messages(r)[0]?.text.includes('انجام‌دهنده: admin')&&!messages(r)[0]?.text.includes('FORGED_SITE_USER'));
 r=await request(site,{endpoint:'crm.php',action:'set_status',post:{type:'rfq',code,status:'approved',statusText:'تایید شده'}});T('repeated site approval does not notify again',r.json.ok===true&&messages(r).length===0);
 const invalidSite=fresh();r=await request(invalidSite,{endpoint:'crm.php',action:'add_rfq_site',post:{company:'x'},captcha:'bad'});T('invalid CAPTCHA has no RFQ or bot effects',r.json.ok===false&&messages(r).length===0&&!invalidSite['rfqs.json']);
 for(const [label,opts] of [['missing-config',{config:false}],['disabled',{enabled:false}],['private-chat',{chatId:'123456'}]]){
  const st=fresh();r=await upsert(st,R,'cfg-'+label,opts);T(label+': record saves, no Telegram or historical backlog',r.json.ok===true&&messages(r).length===0&&Object.keys(q(st).jobs).length===0,r.response+r.stderr);
 }
 /* Transport rejection/ambiguity must not lie about or roll back business data. */
 for(const mode of ['reject','rate','timeout','badjson']){
  const st=fresh();r=await upsert(st,R,'failure-'+mode,{mode});
  const jobs=Object.values(q(st).jobs);
  T(mode+': RFQ remains committed despite Telegram failure',r.json.ok===true&&JSON.parse(st['sync/ptf_crm_rfqs.json']||'[]').length===1,r.response+r.stderr);
  T(mode+': one attempt and correct durable delivery state',messages(r).length===1&&jobs.length===1&&jobs[0].status===(['reject','rate'].includes(mode)?'pending':'uncertain'),JSON.stringify(jobs));
  r=await upsert(st,R,'failure-'+mode,{mode});T(mode+': command replay never blindly repeats send',r.json.idempotent===true&&messages(r).length===0,r.response+r.stderr);
 }
 const status=fresh();r=await request(status,{endpoint:'notify-bot.php',action:'status'});T('bot connection status exposes automatic feature state, not token/chat id',r.json.ok===true&&r.json.rfq_notifications===true&&!r.response.includes('TEST_ONLY')&&!r.response.includes('-100123'),r.response);
 r=await request(status,{endpoint:'notify-bot.php',action:'status',enabled:false});T('central disable is visible in bot settings status',r.json.ok===true&&r.json.rfq_notifications===false,r.response);
 console.log('\n=== E2E RFQ Telegram: '+pass+' PASS / '+fail+' FAIL ===');process.exitCode=fail?1:0;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
