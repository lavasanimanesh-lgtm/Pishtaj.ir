<?php
ob_start();
ini_set('display_errors',0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/auth.php';
$data_dir = __DIR__ . '/../crm/data';
if (!is_dir($data_dir)) { @mkdir($data_dir,0755,true); @file_put_contents($data_dir.'/.htaccess',"Deny from all\n"); }
$counters_file=$data_dir.'/counters.json';
$rate_file=$data_dir.'/codegen_rate.json';
function fa_year(){ $gy=(int)date('Y'); $gm=(int)date('n'); $gd=(int)date('j'); $jy=$gy-621; if($gm<3||($gm==3&&$gd<21))$jy--; return $jy; }
function load_counters($file){
 $cur=(string)fa_year();
 $counters=['seq'=>[],'yearSeq'=>[]];
 if(file_exists($file)){
  $raw=@file_get_contents($file);
  $j=json_decode($raw,true);
  if(is_array($j)) $counters=$j;
 }
 if(!isset($counters['seq'])) $counters['seq']=[];
 if(!isset($counters['yearSeq'])) $counters['yearSeq']=[];
 $data_dir = __DIR__ . '/../crm/data';
 $keys_map=['CUST'=>'ptf_crm_customers','SUP'=>'ptf_crm_suppliers','P'=>'ptf_crm_products','RFQ'=>'ptf_crm_rfqs','IQI'=>'ptf_crm_inqitems','LEAD'=>'ptf_crm_leads'];
 foreach($keys_map as $pref=>$jsonKey){
  /* v31.7.20 BUG-CODE-DUP-002 (گزارش کارفرما: کد تکراری RFQ/کالا): داده واقعی از مسیر sync
     در crm/data/sync/ ذخیره می‌شود، نه crm/data/ — اسکن قبلی فایل sync را نمی‌دید و
     شمارنده از داده واقعی عقب می‌ماند → رزرو شماره‌های قبلاً استفاده‌شده → کد تکراری. */
  $sources=[$data_dir.'/'.$jsonKey.'.json', $data_dir.'/sync/'.$jsonKey.'.json'];
  foreach($sources as $jf){
  if(!file_exists($jf)) continue;
  $raw=@file_get_contents($jf); if(!$raw) continue;
  $arr=json_decode($raw,true); if(!is_array($arr)) continue;
  $max=0;
  foreach($arr as $it){
   if(!is_array($it)) continue;
   foreach(['cd','no','id','code'] as $cf){
    if(empty($it[$cf])) continue;
    $code=(string)$it[$cf]; $code=preg_replace('/-D\d+$/','',$code);
    if($pref==='P'){
     if(preg_match('/^P-(\d+)$/i',$code,$m)){ $n=(int)$m[1]; if($n>$max) $max=$n; }
    } else {
     if(preg_match('/^'.preg_quote($pref,'/').'-(\d+)$/i',$code,$m)){ $n=(int)$m[1]; if($n>$max) $max=$n; }
     if(preg_match('/^PTF-'.preg_quote($pref,'/').'-\d+-(\d+)$/i',$code,$m)){ $n=(int)$m[1]; if($n>$max) $max=$n; }
    }
   }
  }
  if($max>0 && (!isset($counters['seq'][$pref]) || $counters['seq'][$pref]<$max)){
   $counters['seq'][$pref]=$max;
  }
  } /* v31.7.20: پایان حلقه sources */
 }
 /* v31.6.27 CODEGEN-OFFER-SERVER: reserve must see existing official
    offer numbers even when they were created on another device. */
 /* v31.7.24 BUG-CODE-DUP-003 (شکایت کاربر: پیشنهاد ذخیره می‌شود ولی دیده نمی‌شود):
    اسکن شماره آفرها هم فقط crm/data را می‌دید — داده واقعی در crm/data/sync است →
    رزرو شماره CO استفاده‌شده → offerSave آفر موجود را overwrite می‌کرد (idx>-1)
    → رکورد جدیدی به فهرست اضافه نمی‌شد. همان شکاف v31.7.20، مصداق آفرها. */
 foreach([$data_dir.'/ptf_crm_offers.json', $data_dir.'/sync/ptf_crm_offers.json'] as $offerFile){
 if(file_exists($offerFile)){
  $offers=json_decode(@file_get_contents($offerFile),true);
  if(is_array($offers)) foreach($offers as $of){
   $no=(string)($of['no']??'');
   if(preg_match('/^PTF-(TO|CO|TC)-(\\d+)-(\\d+)$/i',$no,$om)){
    $op=strtoupper($om[1]); $oy=$om[2]; $on=(int)$om[3];
    if(!isset($counters['yearSeq'][$op])) $counters['yearSeq'][$op]=[];
    if(!isset($counters['yearSeq'][$op][$oy]) || $counters['yearSeq'][$op][$oy]<$on) $counters['yearSeq'][$op][$oy]=$on;
    if(!isset($counters['seq'][$op]) || $counters['seq'][$op]<$on) $counters['seq'][$op]=$on;
   }
  }
 }
 } /* v31.7.24: پایان حلقه دو مسیر آفر */
 // طبق دستور: کد کالا از 1120
 if(!isset($counters['seq']['P']) || $counters['seq']['P']<1119){
  $counters['seq']['P']=1119;
 }
 foreach(['TO','CO','TC'] as $k){
  if(!isset($counters['yearSeq'][$k][$cur])) $counters['yearSeq'][$k][$cur]=99;
  elseif($counters['yearSeq'][$k][$cur]<99) $counters['yearSeq'][$k][$cur]=99;
  if(!isset($counters['seq'][$k]) || $counters['seq'][$k]<99) $counters['seq'][$k]=99;
 }
 foreach(['CUST'=>1000,'SUP'=>1000,'RFQ'=>1000,'IQI'=>1000,'LEAD'=>1000,'CHQ'=>1000,'INV'=>1000,'PAY'=>1000,'CMP'=>1000,'TO'=>99,'CO'=>99,'TC'=>99] as $k=>$v){
  if(!isset($counters['seq'][$k])) $counters['seq'][$k]=$v;
  if($k==='P' && $counters['seq'][$k]<1119) $counters['seq'][$k]=1119;
 }
 return $counters;
}
function format_code($p,$n,$y=null){ $p=strtoupper(trim($p)); $y=$y?:fa_year(); $n=(int)$n; if(in_array($p,['TO','CO','TC'])) return sprintf('PTF-%s-%s-%04d',$p,$y,$n); if($p==='P'||$p==='PROD'||$p==='PRODUCT') return 'P-'.$n; return $p.'-'.$n; }
function rate_limit($file){
 $ip=$_SERVER['REMOTE_ADDR']??'unknown'; $now=time(); $data=[]; if(file_exists($file)){ $raw=@file_get_contents($file); $data=json_decode($raw,true); if(!is_array($data))$data=[]; }
 foreach($data as $k=>$v){ if(!isset($v['t'])||$now-$v['t']>60) unset($data[$k]); }
 $cnt=isset($data[$ip])?(int)$data[$ip]['c']:0; if($cnt>=60) return false; $data[$ip]=['c'=>$cnt+1,'t'=>$now]; @file_put_contents($file,json_encode($data),LOCK_EX); return true;
}
$action=$_GET['action']??$_POST['action']??'next';
try{
 $token=auth_get_header_token();
 $info=$token?auth_verify_token($token):false;
 // v30.1: reserve/reconcile/status نیاز به توکن
 $needTokenActions=['reserve','blocks','reconcile'];
 if(in_array($action,$needTokenActions)){
  if(!$info){ ob_clean(); http_response_code(401); echo json_encode(['ok'=>false,'error'=>'token required for codegen (v30.1)','needLogin'=>true],JSON_UNESCAPED_UNICODE); exit; }
 }
 if($token && !$info){ ob_clean(); http_response_code(401); echo json_encode(['ok'=>false,'error'=>'invalid token - please login again'],JSON_UNESCAPED_UNICODE); exit; }
 if(!rate_limit($rate_file)){ ob_clean(); http_response_code(429); echo json_encode(['ok'=>false,'error'=>'rate limit - 60/min'],JSON_UNESCAPED_UNICODE); exit; }
 if($action==='reserve'||$action==='blocks'){
  $input=json_decode(file_get_contents('php://input'),true); if(!$input)$input=$_POST; $blocks=$input['blocks']??[]; if(empty($blocks)&&isset($_GET['prefix'])) $blocks=[strtoupper($_GET['prefix'])=>(int)($_GET['count']??1)]; $year=(int)($input['year']??0)?:fa_year();
  $result=[]; $fp=@fopen($counters_file,'c+'); if(!$fp)$fp=fopen($counters_file,'w+'); if(!$fp) throw new Exception('cannot open'); flock($fp,LOCK_EX); $c=load_counters($counters_file);
  if(!isset($c['seq']))$c['seq']=[]; if(!isset($c['yearSeq']))$c['yearSeq']=[];
  foreach($blocks as $pref=>$cnt){ $pref=strtoupper(trim($pref)); if($pref==='')continue; $cnt=max(1,min(500,(int)$cnt)); $codes=[]; for($i=0;$i<$cnt;$i++){ if(in_array($pref,['TO','CO','TC'])){ $y=(string)$year; $cur=(string)fa_year(); if(!isset($c['yearSeq'][$pref][$y])) $c['yearSeq'][$pref][$y]=($y===$cur)?99:0; elseif($y===$cur&&$c['yearSeq'][$pref][$y]<99)$c['yearSeq'][$pref][$y]=99; $c['yearSeq'][$pref][$y]++; $n=$c['yearSeq'][$pref][$y]; if(!isset($c['seq'][$pref])||$n>$c['seq'][$pref])$c['seq'][$pref]=$n; $codes[]=format_code($pref,$n,$y);}else{ if(!isset($c['seq'][$pref]))$c['seq'][$pref]=1000; if($pref==='P'&&$c['seq'][$pref]<1119) $c['seq'][$pref]=1119; $c['seq'][$pref]++; $codes[]=format_code($pref,$c['seq'][$pref]); } } $result[$pref]=$codes; }
  fseek($fp,0); ftruncate($fp,0); fwrite($fp,json_encode($c,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)); fflush($fp); flock($fp,LOCK_UN); fclose($fp);
  ob_clean(); echo json_encode(['ok'=>true,'codes'=>$result,'year'=>$year],JSON_UNESCAPED_UNICODE); exit;
 }
 if($action==='reconcile'){
  $input=json_decode(file_get_contents('php://input'),true); $maps=$input['maps']??[];
  $fp=@fopen($counters_file,'c+'); if(!$fp)$fp=fopen($counters_file,'w+'); flock($fp,LOCK_EX); $c=load_counters($counters_file); $out=[];
  foreach($maps as $m){ $pref=strtoupper($m['prefix']??'ID'); $year=(int)($m['year']??0)?:fa_year(); if(in_array($pref,['TO','CO','TC'])){ $y=(string)$year; $cur=(string)fa_year(); if(!isset($c['yearSeq'][$pref][$y])) $c['yearSeq'][$pref][$y]=($y===$cur)?99:0; elseif($y===$cur&&$c['yearSeq'][$pref][$y]<99)$c['yearSeq'][$pref][$y]=99; $c['yearSeq'][$pref][$y]++; $n=$c['yearSeq'][$pref][$y]; if(!isset($c['seq'][$pref])||$n>$c['seq'][$pref])$c['seq'][$pref]=$n; $real=format_code($pref,$n,$y);}else{ if(!isset($c['seq'][$pref]))$c['seq'][$pref]=1000; if($pref==='P'&&$c['seq'][$pref]<1119)$c['seq'][$pref]=1119; $c['seq'][$pref]++; $real=format_code($pref,$c['seq'][$pref]); } $out[]=['tmp'=>$m['tmp']??'','real'=>$real,'prefix'=>$pref]; }
  fseek($fp,0); ftruncate($fp,0); fwrite($fp,json_encode($c,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)); fflush($fp); flock($fp,LOCK_UN); fclose($fp);
  ob_clean(); echo json_encode(['ok'=>true,'maps'=>$out],JSON_UNESCAPED_UNICODE); exit;
 }
 if($action==='status'||$action==='next'){
  $c=load_counters($counters_file); ob_clean(); echo json_encode(['ok'=>true,'counters'=>$c,'year'=>fa_year()],JSON_UNESCAPED_UNICODE); exit;
 }
 ob_clean(); echo json_encode(['ok'=>false,'error'=>'unknown'],JSON_UNESCAPED_UNICODE);
}catch(Exception $e){ ob_clean(); echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE); }
