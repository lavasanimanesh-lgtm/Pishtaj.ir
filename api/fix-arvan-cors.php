<?php
/**
 * PTF CRM — Fix Arvan CORS for staging
 * v34.4.34 — تنظیم خودکار CORS باکت + امضای صحیح SigV4 برای subresource `cors=`
 *
 * دسترسی: فقط admin / chairman / ceo با توکن معتبر
 * استفاده: دکمهٔ «اعمال CORS» در تنظیمات فضای ابری CRM، یا POST مستقیم
 * به ../api/fix-arvan-cors.php با هدر X-CRM-Token (بازکردن URL بدون هدر کافی نیست)
 *
 * این اسکریپت CORS باکت را به حالت زیر می‌گذارد:
 *   AllowedOrigins: https://pishtaj.ir, https://www.pishtaj.ir, https://staging.pishtaj.ir
 *   AllowedMethods: GET, PUT, POST, HEAD, DELETE
 *   AllowedHeaders: *
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/auth.php';
header('Cache-Control: no-store');

$ident = auth_verify_token(auth_get_header_token());
if (!$ident) {
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'authentication_required','hint'=>'ابتدا وارد CRM شوید یا هدر X-CRM-Token بفرستید'], JSON_UNESCAPED_UNICODE);
    exit;
}
$role = strtolower((string)($ident['role'] ?? ''));
if (!in_array($role, ['admin','chairman','ceo'], true)) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'permission_denied','role'=>$role], JSON_UNESCAPED_UNICODE);
    exit;
}

// load config
function fix_load_cfg() {
    $paths = [dirname(__DIR__,2).'/storage-config.php', dirname(__DIR__,3).'/storage-config.php', dirname(__DIR__).'/storage-config.php'];
    foreach ($paths as $p) if (file_exists($p)) { $c=include $p; if(is_array($c)) return $c; }
    return null;
}
$cfg = fix_load_cfg();
if (!$cfg) {
    echo json_encode(['ok'=>false,'error'=>'storage-config.php not found'], JSON_UNESCAPED_UNICODE);
    exit;
}
$cfg['endpoint']=rtrim($cfg['endpoint'],'/');
if (!preg_match('#^https?://#i',$cfg['endpoint'])) $cfg['endpoint']='https://'.$cfg['endpoint'];

function fix_hmac($k,$d,$r=true){ return hash_hmac('sha256',$d,$k,$r); }

$action = $_REQUEST['action'] ?? ($_GET['action'] ?? 'fix');
if ($action === 'get') {
    // GET current CORS
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    $now = gmdate('Ymd\THis\Z'); $date=gmdate('Ymd'); $scope="$date/{$cfg['region']}/s3/aws4_request";
    $payloadHash = hash('sha256','');
    /* SigV4 برای subresource بدون مقدار باید canonical query را با = بسازد
       (`cors=`). نسخهٔ قبلی `cors` امضا می‌کرد و S3 آن را SignatureDoesNotMatch می‌دید. */
    $path = '/'.$cfg['bucket']; $query='cors=';
    $headers="host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
    $signedHeaders='host;x-amz-content-sha256;x-amz-date';
    $canonical=implode("\n",['GET',$path,$query,$headers,$signedHeaders,$payloadHash]);
    $str=implode("\n",['AWS4-HMAC-SHA256',$now,$scope,hash('sha256',$canonical)]);
    $sigKey=fix_hmac(fix_hmac(fix_hmac(fix_hmac('AWS4'.$cfg['secret_key'],$date),$cfg['region']),'s3'),'aws4_request');
    $sig=fix_hmac($sigKey,$str,false);
    $auth="AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$sig";
    $url=$cfg['endpoint'].$path.'?'.$query;
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>["Authorization: $auth","x-amz-content-sha256: $payloadHash","x-amz-date: $now"]]);
    $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
    echo json_encode(['ok'=> $code>=200 && $code<300, 'http'=>$code, 'body'=>$body, 'err'=>$err], JSON_UNESCAPED_UNICODE);
    exit;
}

// default: fix (PUT) — تغییر تنظیمات فقط با POST داخلی CRM
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['ok'=>false,'error'=>'method_not_allowed','hint'=>'از دکمهٔ اعمال CORS در CRM استفاده کنید'], JSON_UNESCAPED_UNICODE);
    exit;
}
$xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://pishtaj.ir</AllowedOrigin>
    <AllowedOrigin>https://www.pishtaj.ir</AllowedOrigin>
    <AllowedOrigin>https://staging.pishtaj.ir</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
XML;

$host = parse_url($cfg['endpoint'], PHP_URL_HOST);
$now = gmdate('Ymd\THis\Z'); $date=gmdate('Ymd'); $scope="$date/{$cfg['region']}/s3/aws4_request";
$payloadHash = hash('sha256', $xml);
$path='/'.$cfg['bucket']; $query='cors=';
$headers="host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$now\n";
$signedHeaders='host;x-amz-content-sha256;x-amz-date';
$canonical=implode("\n",['PUT',$path,$query,$headers,$signedHeaders,$payloadHash]);
$str=implode("\n",['AWS4-HMAC-SHA256',$now,$scope,hash('sha256',$canonical)]);
$sigKey=fix_hmac(fix_hmac(fix_hmac(fix_hmac('AWS4'.$cfg['secret_key'],$date),$cfg['region']),'s3'),'aws4_request');
$sig=fix_hmac($sigKey,$str,false);
$auth="AWS4-HMAC-SHA256 Credential={$cfg['access_key']}/$scope, SignedHeaders=$signedHeaders, Signature=$sig";
$url=$cfg['endpoint'].$path.'?'.$query;
$ch=curl_init($url);
curl_setopt_array($ch,[
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_CUSTOMREQUEST=>'PUT',
    CURLOPT_POSTFIELDS=>$xml,
    CURLOPT_TIMEOUT=>20,
    CURLOPT_HTTPHEADER=>["Authorization: $auth","x-amz-content-sha256: $payloadHash","x-amz-date: $now","Content-Type: application/xml","Content-Length: ".strlen($xml)],
]);
$body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
if ($code>=200 && $code<300) {
    echo json_encode(['ok'=>true,'http'=>$code,'msg'=>'CORS با موفقیت تنظیم شد: pishtaj.ir + staging.pishtaj.ir مجاز شدند','xml'=>$xml], JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode(['ok'=>false,'http'=>$code,'err'=>$err,'body'=>$body,'hint'=>'اگر 403 است: کلیدها درست نیست یا region نادرست است. اگر 404: باکت یافت نشد.'], JSON_UNESCAPED_UNICODE);
}
