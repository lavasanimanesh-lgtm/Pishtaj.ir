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
/* ══════════════════════════════════════════════════════════════════════════
   e2e-rfq-notify-phantom-v34.39.55.js
   بازتولید اجرایی گزارش کارفرما (۲۰۲۶-۱۰-۱۳): «نوتیفیکیشن‌های گروه واقعی
   نیست و مربوط به رویدادهای گذشته است؛ پیشنهادی را ۱۰ روز پیش لواسانی صادر
   کرده ولی پیام می‌گوید یوسفی صادر کرد / وضعیت بازنده → منتظر پاسخ کارفرما».
   همهٔ مسیرها کد واقعی ریپو هستند (api/*.php در php-wasm + crm/workflow.js
   واقعی در Node). هیچ تابع کسب‌وکاری بازنویسی/ماکت نشده است.
   ══════════════════════════════════════════════════════════════════════════ */
const SD = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');
function phpFn(name) { /* extract a real function body verbatim from sales-domain.php */
  const start = SD.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function not found: ' + name);
  let i = SD.indexOf('{', start), depth = 0;
  for (let j = i; j < SD.length; j++) {
    if (SD[j] === '{') depth++;
    else if (SD[j] === '}') { depth--; if (depth === 0) return SD.slice(start, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
/* v34.39.56 (OFFER-STATUS-WF): بدنهٔ موتور به rfq-notify-lib.php رفت و
   sd_workflow_for_inquiry delegate شد؛ هارنس فایل واقعی lib را لود می‌کند و
   sd_read را برای WF80/WF85 از دادهٔ سناریو سرو می‌دهد. */
const WF_PHP = ['sd_now', 'sd_rfq_matches_inquiry', 'sd_workflow_label', 'sd_offer_wf_rank', 'sd_offer_wf_rank_higher', 'sd_wf_delivery_data', 'sd_workflow_for_inquiry', 'sd_apply_offer_workflow'].map(phpFn).join('\n');
const LIB_PHP = fs.readFileSync(path.join(ROOT, 'api/rfq-notify-lib.php'), 'utf8');
/* run the real sd_workflow_for_inquiry from sales-domain.php on given offers */
async function serverWf(offers, inqNo, extra) {
  const php = new PhpNode();
  let out = '';
  php.addEventListener('output', e => { out += Array.isArray(e.detail ?? e.data) ? (e.detail ?? e.data).join('') : String(e.detail ?? e.data); });
  await php.writeFile('/lib.php', LIB_PHP);
  await php.writeFile('/offers.json', JSON.stringify(offers));
  await php.writeFile('/extra.json', JSON.stringify(extra || {}));
  await php.run('<?php require "/lib.php";'
    + '\nfunction sd_read(string $k): array { $x=json_decode(file_get_contents("/extra.json"),true)?:[]; if($k==="ptf_crm_projects")return $x["projects"]??[]; if($k==="ptf_crm_invoices")return $x["invoices"]??[]; return []; }'
    + '\n' + WF_PHP + '\n$offers=json_decode(file_get_contents("/offers.json"),true);'
    + 'echo sd_workflow_for_inquiry(' + JSON.stringify(inqNo) + ',$offers);');
  return out.trim();
}
/* run the real window.wfCompute from crm/workflow.js on the same data */
const WFJS = fs.readFileSync(path.join(ROOT, 'crm/workflow.js'), 'utf8');
const WF_COMPUTE_SRC = WFJS.slice(WFJS.indexOf('var WF = {'), WFJS.indexOf('/* بازمحاسبه و ذخیره وضعیت درخواست'));
function clientWf(data, r) {
  const sandbox = { window: {}, PTF: {} };
  const getData = k => (data[k] || []);
  /* eslint-disable no-new-func */
  const fn = new Function('window', 'getData', 'PTF',
    WF_COMPUTE_SRC + '\nreturn window.wfCompute;')(sandbox.window, getData, sandbox.PTF);
  return fn(r);
}
function rows(state) { try { return JSON.parse(state['sync/ptf_crm_rfqs.json'] || '[]'); } catch (e) { return []; } }
async function main() {
  /* ═══ S1 — دستگاه کهنه، وضعیت را به ۱۰ روز قبل برمی‌گرداند ═══ */
  console.log('══ S1 — upsert کهنهٔ یک دستگاه دیگر (سناریوی گزارش‌شدهٔ کارفرما) ══');
  const s = fresh();
  let r = await upsert(s, { _id: 'RQ-101', cd: 'RFQ-101', co: 'شرکت نمونه', subj: 'استعلام شیر کنترلی', ca: 'شیرآلات' }, 'seed-1', { body: { expectCreate: true }, user: 'lavasani', role: 'admin' });
  T('درخواست ثبت می‌شود', r.json.ok === true, r.response + r.stderr);
  ready(s);
  /* لواسانی CO را بازنده می‌کند → خودِ سرور wf را مشتق و مهر زمانی می‌زند */
  r = await request(s, { action: 'register_offer', body: { idempotencyKey: 'co-1', createIntent: true, offer: { no: 'CO-101', cd: 'CO-101', kind: 'CO', inqNo: 'RFQ-101', st: 'lost', items: [] } }, user: 'lavasani', role: 'admin' });
  T('سرور وضعیت واقعی «بازنده» را مشتق می‌کند (WF91 + مهر زمانی)', r.json.ok === true && rows(s)[0]?.wf === 'WF91' && !!rows(s)[0]?.wfUpdatedAtISO, JSON.stringify(rows(s)[0]));
  const LIVE = rows(s)[0];
  ready(s);
  /* دستگاه یوسفی: snapshot ده روز پیش (wf=WF60، بدون مهر تازه) + فقط dueNotified عوض شده */
  const STALE = { ...LIVE, wf: 'WF60', stxt: '⏳ منتظر پاسخ کارفرما (مالی)', wfUpdatedAtISO: '', dueNotified: 'warn' };
  r = await upsert(s, STALE, 'stale-2', { user: 'yousefi', role: 'sales' });
  T('FIX: upsert کهنه هیچ اعلانی به گروه نمی‌فرستد', r.json.ok === true && messages(r).length === 0, JSON.stringify(messages(r)));
  T('FIX: وضعیت واقعی سرور بازنده می‌ماند (wf=' + rows(s)[0]?.wf + ')', rows(s)[0]?.wf === 'WF91', JSON.stringify(rows(s)[0]));
  T('FIX: ویرایش واقعیِ همان کاربر (dueNotified) ذخیره می‌شود', rows(s)[0]?.dueNotified === 'warn', JSON.stringify(rows(s)[0]?.dueNotified));
  /* کنترل: گذار واقعی همچنان اعلام می‌شود */
  ready(s);
  r = await request(s, { action: 'register_offer', body: { idempotencyKey: 'co-2', createIntent: true, offer: { no: 'CO-102', cd: 'CO-102', kind: 'CO', inqNo: 'RFQ-101', st: 'sent', items: [] } }, user: 'yousefi', role: 'sales' });
  const mCtl = messages(r);
  T('کنترل: گذار واقعی «بازنده ← منتظر پاسخ کارفرما» هنوز اعلام می‌شود', mCtl.length === 1 && mCtl[0].text.includes('انجام‌دهنده: yousefi'), JSON.stringify(mCtl[0]?.text));

  /* ═══ S2 — واگرایی موتور wf کلاینت/سرور (بدون تغییر — گزارش می‌شود) ═══ */
  console.log('\n══ S2 — موتور wf کلاینت و سرور روی دادهٔ یکسان ══');
  const offers9 = [{ no: 'CO-9', kind: 'CO', inqNo: 'RFQ-9', st: 'won', items: [] }];
  const rfq9 = { cd: 'RFQ-9', inqNo: 'RFQ-9', wf: 'WF70' };
  const data = { ptf_crm_offers: offers9, ptf_crm_rfqs: [rfq9], ptf_crm_projects: [{ offerNo: 'CO-9', state: 'done' }], ptf_crm_invoices: [{ offerNo: 'CO-9', amount: 1000, pays: [{ amt: 1000 }] }] };
  const srvWf = await serverWf(offers9, 'RFQ-9', { projects: data.ptf_crm_projects, invoices: data.ptf_crm_invoices });
  const cliWf = clientWf(data, rfq9);
  console.log('   server sd_workflow_for_inquiry = ' + srvWf + '   |   client wfCompute = ' + cliWf + '  ← v34.39.56: واگرایی بسته شد');
  T('FIX (v34.39.56): پروندهٔ برنده+تحویل+تسویه → سرور و کلاینت هر دو WF85', srvWf === 'WF85' && cliWf === 'WF85', srvWf + ' vs ' + cliWf);

  /* ═══ S2b — مقدار موتور محلی کلاینت (WF85) دیگر روی سرور نوشته نمی‌شود ═══ */
  console.log('\n══ S2b — کلاینت WF85 می‌فرستد، سرور مقدار مشتقِ خودش را نگه می‌دارد ══');
  ready(s);
  r = await upsert(s, { ...rows(s)[0], wf: 'WF85', stxt: '✅ مختومه (تسویه)' }, 'client-engine-3', { user: 'yousefi', role: 'sales' });
  T('FIX: مقدار موتور محلی (WF85) رد و اعلان کاذب ساخته نمی‌شود',
    r.json.ok === true && messages(r).length === 0, JSON.stringify(messages(r)));
  T('FIX: wf روی سرور همان مقدار مشتقِ سرور می‌ماند (wf=' + rows(s)[0]?.wf + ')',
    rows(s)[0]?.wf !== 'WF85', JSON.stringify(rows(s)[0]?.wf));

  /* ═══ S2c — تغییر وضعیت پیشنهاد از مسیر entity_upsert هم گردش کار را می‌برد ═══ */
  console.log('\n══ S2c — تغییر وضعیت پیشنهاد بدون register_offer ══');
  ready(s);
  const offersNow = JSON.parse(s['sync/ptf_crm_offers.json'] || '[]');
  const coRow = offersNow.filter(o => o.no === 'CO-102')[0];
  r = await request(s, { action: 'entity_upsert', body: { collection: 'ptf_crm_offers', record: { ...coRow, st: 'lost' }, idempotencyKey: 'off-st-1' }, user: 'lavasani', role: 'admin' });
  const mS2c = messages(r);
  console.log('   پیام گروه: ' + JSON.stringify(mS2c[0]?.text || null));
  T('FIX: به‌روز شدن وضعیت CO از مسیر عمومی هم گردش کار را در سرور می‌برد',
    r.json.ok === true && rows(s)[0]?.wf === 'WF91', 'wf=' + rows(s)[0]?.wf);
  T('FIX: و همان گذار، یک‌بار و به نام انجام‌دهندهٔ واقعی اعلام می‌شود',
    mS2c.length === 1 && mS2c[0].text.includes('انجام‌دهنده: lavasani'), JSON.stringify(mS2c[0]?.text));

  /* ═══ S2d — سناریوی دقیق گزارش کارفرما (v34.39.56): پیشنهادِ واقعی cd ندارد ═══ */
  console.log('\n══ S2d — گزارش کارفرما: دراپ‌داون «ارسال شده» روی پیشنهادِ بدون cd ══');
  const s2 = fresh();
  r = await upsert(s2, { _id: 'RQ-201', cd: 'RFQ-201', inqNo: 'INQ-201', co: 'شرکت کارفرما', subj: 'استعلام شیر توپی', ca: 'شیرآلات' }, 'seed-201', { body: { expectCreate: true }, user: 'lavasani', role: 'admin' });
  T('S2d: درخواست ثبت می‌شود', r.json.ok === true, r.response + r.stderr);
  ready(s2);
  /* پیشنهاد دقیقاً با فرم تولید: no + inqNo=cd سیستمی (offerFromRfq) و بدون cd */
  r = await request(s2, { action: 'register_offer', body: { idempotencyKey: 'co-201', createIntent: true, offer: { no: 'CO-1405-0041', kind: 'CO', inqNo: 'RFQ-201', st: 'draft', items: [] } }, user: 'lavasani', role: 'admin' });
  T('S2d: صدور CO ← «پیشنهاد مالی صادر شد» (WF50) حتی با لینک cd', r.json.ok === true && rows(s2)[0]?.wf === 'WF50', JSON.stringify(rows(s2)[0]?.wf));
  ready(s2);
  /* کاربر دیگری (نه ثبت‌کنندهٔ درخواست) از دراپ‌داون «ارسال شده» می‌کند */
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-201', offerNo: 'CO-1405-0041', st: 'sent' }, user: 'yousefi', role: 'sales' });
  const mS2d = messages(r);
  console.log('   پیام گروه: ' + JSON.stringify(mS2d[0]?.text || null));
  T('S2d FIX: وضعیت درخواست «منتظر پاسخ کارفرما (مالی)» می‌شود — نه دریافت اولیه',
    r.json.ok === true && rows(s2)[0]?.wf === 'WF60', 'wf=' + rows(s2)[0]?.wf);
  T('S2d FIX: پیام بات گذار درست را با نام تغییردهندهٔ واقعی می‌گوید',
    mS2d.length === 1 && mS2d[0].text.includes('وضعیت قبلی: پیشنهاد مالی صادر شد') && mS2d[0].text.includes('وضعیت جدید: منتظر پاسخ کارفرما (مالی)') && mS2d[0].text.includes('انجام‌دهنده: yousefi') && !mS2d[0].text.includes('دریافت اولیه'),
    JSON.stringify(mS2d[0]?.text));
  T('S2d FIX: خط رویداد، پیشنهاد مولّد گذار را نام می‌برد',
    mS2d.length === 1 && mS2d[0].text.includes('رویداد: تغییر وضعیت پیشنهاد CO-1405-0041'), JSON.stringify(mS2d[0]?.text));
  /* بازگشت مشروع sent→revise هم باید همان‌جا بنشیند و اعلام شود */
  ready(s2);
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-202', offerNo: 'CO-1405-0041', st: 'revise' }, user: 'yousefi', role: 'sales' });
  T('S2d FIX: درخواست اصلاح کارفرما ← WF55', r.json.ok === true && rows(s2)[0]?.wf === 'WF55', 'wf=' + rows(s2)[0]?.wf);
  /* برد از این مسیر ممکن نیست */
  ready(s2);
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-203', offerNo: 'CO-1405-0041', st: 'won' }, user: 'yousefi', role: 'sales' });
  T('S2d: برد از set_offer_status رد می‌شود (use_win_offer)', r.json.ok === false && rows(s2)[0]?.wf === 'WF55', JSON.stringify(r.json).slice(0, 160));

  /* ═══ S3 — ترتیب آرایه دیگر نتیجه را عوض نمی‌کند ═══ */
  console.log('\n══ S3 — sd_workflow_for_inquiry و ترتیب آرایه ══');
  const coLost = { no: 'CO-1', kind: 'CO', inqNo: 'RFQ-1', st: 'lost' };
  const coSent = { no: 'CO-2', kind: 'CO', inqNo: 'RFQ-1', st: 'sent' };
  const a = await serverWf([coLost, coSent], 'RFQ-1');
  const b = await serverWf([coSent, coLost], 'RFQ-1');
  console.log('   [CO-1(lost),CO-2(sent)] = ' + a + '   |   [CO-2(sent),CO-1(lost)] = ' + b);
  T('FIX: نتیجه مستقل از ترتیب آرایه است (پیش از اصلاح: WF91 در برابر WF60)', a === b, a + ' vs ' + b);

  /* ═══ S4 — حذف یک رکورد، فقط استعلام همان رکورد را رفرش می‌کند ═══ */
  console.log('\n══ S4 — دامنهٔ wfRefresh پس از حذف (crm/guards.js) ══');
  const refreshed = [];
  const GUARDS = fs.readFileSync(path.join(ROOT, 'crm/guards.js'), 'utf8');
  const gStart = GUARDS.indexOf('var _inqs = {};');
  const gEnd = GUARDS.indexOf('} catch (eQ) {}') + '} catch (eQ) {}'.length;
  const guardsSrc = GUARDS.slice(gStart, gEnd);
  const store = {
    ptf_crm_offers: [{ no: 'CO-9', inqNo: 'RFQ-9' }, { no: 'TO-77', inqNo: 'RFQ-77' }],
    ptf_crm_rfqs: [{ cd: 'RFQ-9' }, { cd: 'RFQ-77' }]
  };
  new Function('kind', 'id', 'getData', 'wfRefresh', guardsSrc + '\nObject.keys(_inqs).forEach(function (q) { wfRefresh(q); });')('OFFER', 'CO-9', k => (store[k] || []), q => refreshed.push(q));
  console.log('   پس از حذف CO-9 فقط این‌ها رفرش شدند: ' + JSON.stringify(refreshed));
  T('FIX: حذف CO-9 فقط استعلام خودش را رفرش می‌کند، نه همهٔ پایگاه‌داده',
    refreshed.length === 1 && refreshed[0] === 'RFQ-9', JSON.stringify(refreshed));

  /* ═══ S5 — مسیر legacy data_push ═══ */
  console.log('\n══ S5 — snapshot کامل و کهنه در مسیر legacy data_push ══');
  const s5 = fresh();
  r = await upsert(s5, { _id: 'RQ-301', cd: 'RFQ-301', co: 'شرکت بتا' }, 'seed-5', { body: { expectCreate: true }, user: 'lavasani', role: 'admin' });
  r = await request(s5, { action: 'register_offer', body: { idempotencyKey: 'co-5', createIntent: true, offer: { no: 'CO-301', cd: 'CO-301', kind: 'CO', inqNo: 'RFQ-301', st: 'lost', items: [] } }, user: 'lavasani', role: 'admin' });
  ready(s5);
  const live5 = JSON.parse(s5['sync/ptf_crm_rfqs.json'] || '[]')[0];
  r = await request(s5, { endpoint: 'crm.php', action: 'data_push', body: { data: { ptf_crm_rfqs: JSON.stringify([{ ...live5, wf: 'WF60', stxt: '⏳ منتظر پاسخ کارفرما (مالی)', wfUpdatedAtISO: '' }]) }, by: 'yousefi' }, user: 'yousefi', role: 'sales' });
  T('FIX: push کهنه در مسیر legacy هم نه اعلان می‌سازد نه وضعیت را برمی‌گرداند',
    r.json.ok === true && messages(r).length === 0 && JSON.parse(s5['sync/ptf_crm_rfqs.json'] || '[]')[0].wf === 'WF91',
    JSON.stringify(messages(r)) + ' wf=' + JSON.parse(s5['sync/ptf_crm_rfqs.json'] || '[]')[0]?.wf);

  /* ═══ S6 — یک اقدام کاربر، دو نوشتن: فقط یک پیام (v34.39.59 — BOT-MSG-P0) ═══
     ptfRfqSetStatus روی ردیف سایت دو نوشتن می‌فرستد: نوشتن مرجع
     (entity_upsert) و آینهٔ رهگیری (crm.php?action=set_status). پیش از این
     هر دو به گروه پیام می‌دادند با «وضعیت قبلی» و منبع متفاوت. */
  console.log('\n══ S6 — یک اقدام، یک پیام (مرجع + آینهٔ رهگیری) ══');
  for (const order of ['entity-first', 'api-first']) {
    const s6 = fresh();
    s6['sync/ptf_crm_users.json'] = JSON.stringify([{ username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' }]);
    const row6 = { _id: 'S-6', cd: 'RFQ-601', code: 'RFQ-601', src: 'site', co: 'شرکت س', con: 'رضایی', subj: 'استعلام',
      st: 'st1', stxt: 'دریافت اولیه', status: 'pending', statusText: 'در انتظار تایید مدیران' };
    s6['sync/ptf_crm_rfqs.json'] = JSON.stringify([row6]);
    s6['rfqs.json'] = JSON.stringify([{ code: 'RFQ-601', src: 'site', company: 'شرکت س', subject: 'استعلام', status: 'pending', statusText: 'در انتظار تایید مدیران' }]);
    ready(s6);
    const moved = { ...row6, st: 'st2', stxt: '🔵 بررسی فنی', stUpdatedAtISO: '2026-10-24T00:00:00Z' };
    const send = [];
    /* نقش باید مجازِ approve_write باشد وگرنه نوشتن آینه 403 می‌شود و سناریو
       «تصادفاً» سبز می‌ماند (نقصِ خودِ این تست که در v34.39.60 پیدا شد). */
    const doEntity = async () => { const x = await request(s6, { action: 'entity_upsert', body: { collection: 'ptf_crm_rfqs', record: moved, idempotencyKey: 'e-6-' + order }, user: 'yousefi', role: 'admin' }); send.push(...messages(x)); return x; };
    const doApi = async () => { const x = await request(s6, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin', post: { type: 'rfq', code: 'RFQ-601', status: 'st2', statusText: '🔵 بررسی فنی' } }); send.push(...messages(x)); return x; };
    let resApi = null;
    if (order === 'entity-first') { await doEntity(); ready(s6); resApi = await doApi(); }
    else { resApi = await doApi(); ready(s6); await doEntity(); }
    T('S6 (' + order + '): هر دو نوشتن این اقدام واقعاً موفق‌اند (سناریو بی‌اثر نیست)',
      !!(resApi && resApi.json && resApi.json.ok === true), resApi ? resApi.response.slice(0, 160) : 'no response');
    console.log('   ' + order + ' → ' + send.length + ' پیام: ' + JSON.stringify(send.map(m => m.text)));
    T('S6 (' + order + '): یک تغییر وضعیت = یک پیام، نه دو',
      send.length === 1, 'پیام‌ها=' + send.length + ' ' + JSON.stringify(send.map(m => m.text)));
    T('S6 (' + order + '): انجام‌دهنده نام نمایشی است، نه username',
      send.length === 1 && send[0].text.includes('انجام‌دهنده: مهدی یوسفی') && !send[0].text.includes('yousefi'),
      send.length ? send[0].text : '');
    T('S6 (' + order + '): منبع CRM است (کاربر CRM انجام داده)',
      send.length === 1 && send[0].text.includes('منبع: CRM'), send.length ? send[0].text : '');
  }

  console.log('\n=== PHANTOM NOTIFY E2E: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
}
main().catch(e => { console.error(e && (e.stack || e.message || String(e))); process.exitCode = 1; });
