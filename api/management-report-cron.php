<?php
/**
 * PTF CRM — تولید گزارش دوره‌ای از Cron
 * فقط CLI؛ هرگز از وب اجرا نمی‌شود.
 *
 * Usage:
 *   php management-report-cron.php --period=weekly
 *   php management-report-cron.php --period=monthly --dry-run
 *   php management-report-cron.php --diagnose
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }

require_once __DIR__ . '/storage-lib.php';

function cfg_load() {
    $paths = [dirname(__DIR__, 2) . '/management-report-config.php', dirname(__DIR__, 3) . '/management-report-config.php', dirname(__DIR__) . '/management-report-config.php'];
    foreach ($paths as $p) if (is_file($p) && is_readable($p)) { $c = include $p; if (is_array($c)) return $c; }
    return null;
}
function arg($name, $default = '') {
    global $argv;
    foreach ($argv as $a) if (strpos($a, '--' . $name . '=') === 0) return substr($a, strlen($name) + 3);
    return $default;
}
function json_file($path, $fallback = []) { return is_file($path) ? (json_decode((string)file_get_contents($path), true) ?: $fallback) : $fallback; }
function money($v) { return number_format((float)$v, 0, '.', ','); }
function total($o) { $s = 0; foreach (($o['items'] ?? []) as $i) $s += ((float)($i['qty'] ?? 0)) * ((float)($i['price'] ?? 0)); return $s; }
function period_range($period) {
    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
    if ($period === 'weekly') { $end = $now->modify('last saturday')->setTime(23,59,59); $start = $end->modify('-6 days')->setTime(0,0,0); }
    elseif ($period === 'monthly') { $start = $now->modify('first day of last month')->setTime(0,0,0); $end = $now->modify('last day of last month')->setTime(23,59,59); }
    elseif ($period === 'quarterly') { $m=(int)$now->format('n'); $q=(int)floor(($m-1)/3); $start=$now->setDate((int)$now->format('Y'),$q*3+1,1)->modify('-3 months')->setTime(0,0,0); $end=$start->modify('+3 months -1 second'); }
    else { $start=$now->setDate((int)$now->format('Y')-1,1,1)->setTime(0,0,0); $end=$start->modify('+1 year -1 second'); }
    return [$start, $end, $start->format('Y-m-d') . ' تا ' . $end->format('Y-m-d')];
}
function in_range($date, $start, $end) { if (!$date) return false; try { $d = new DateTimeImmutable(substr((string)$date, 0, 10)); return $d >= $start && $d <= $end; } catch (Exception $e) { return false; } }
function report_snapshot($syncDir, $period) {
    list($start,$end,$label) = period_range($period);
    $rfqs=json_file($syncDir.'/ptf_crm_rfqs.json'); $offers=json_file($syncDir.'/ptf_crm_offers.json'); $invoices=json_file($syncDir.'/ptf_crm_invoices.json');
    $metrics=['rfqs'=>0,'co'=>0,'won'=>0,'wonValue'=>0,'invoiced'=>0,'byCurrency'=>[],'byUser'=>[]];
    foreach ($rfqs as $r) if (in_range($r['createdISO'] ?? $r['dateEn'] ?? '', $start, $end)) $metrics['rfqs']++;
    foreach ($offers as $o) {
        if (!in_array($o['kind'] ?? '', ['CO','TC'], true) || !empty($o['rialOf'])) continue;
        $issued=in_range($o['dateEn'] ?? '',$start,$end); $won=in_range($o['wonAt'] ?? $o['updatedAtISO'] ?? '',$start,$end) && (($o['st'] ?? '') === 'won');
        $v=total($o); $cur=$o['currency'] ?? 'IRR';
        if ($issued) { $metrics['co']++; $metrics['byCurrency'][$cur]=($metrics['byCurrency'][$cur] ?? 0)+$v; $u=$o['issuedBy'] ?? 'نامشخص'; $metrics['byUser'][$u]=($metrics['byUser'][$u] ?? ['count'=>0,'value'=>0]); $metrics['byUser'][$u]['count']++; $metrics['byUser'][$u]['value']+=$v; }
        if ($won) { $metrics['won']++; $metrics['wonValue']+=$v; }
    }
    foreach ($invoices as $i) if (in_range($i['invDate'] ?? $i['t'] ?? '',$start,$end)) $metrics['invoiced']+=(float)($i['amount'] ?? 0);
    return ['period'=>$period,'label'=>$label,'start'=>$start->format('Y-m-d'),'end'=>$end->format('Y-m-d'),'generatedAt'=>gmdate('c'),'metrics'=>$metrics];
}
function html_report($s) {
    $m=$s['metrics']; $currency=''; foreach (($m['byCurrency'] ?? []) as $c=>$v) $currency.='<tr><td>'.htmlspecialchars($c).'</td><td>'.money($v).'</td></tr>';
    $users=''; foreach (($m['byUser'] ?? []) as $u=>$x) $users.='<tr><td>'.htmlspecialchars($u).'</td><td>'.$x['count'].'</td><td>'.money($x['value']).'</td></tr>';
    return '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#1e293b;font-size:12px}h1{color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:7px}h2{font-size:15px;margin-top:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:7px;text-align:right}th{background:#f1f5f9}.kpi{display:inline-block;width:30%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin:3px}</style></head><body><h1>گزارش مدیریتی '.htmlspecialchars($s['period']).'</h1><p>دوره: '.htmlspecialchars($s['label']).' | تولید: '.htmlspecialchars($s['generatedAt']).'</p><div><div class="kpi">RFQ جدید<br><b>'.$m['rfqs'].'</b></div><div class="kpi">پیشنهاد مالی<br><b>'.$m['co'].'</b></div><div class="kpi">برد ثبت‌شده<br><b>'.$m['won'].'</b></div></div><h2>ارزش پیشنهادها به تفکیک ارز</h2><table><tr><th>ارز</th><th>ارزش</th></tr>'.$currency.'</table><h2>عملکرد ثبت‌کنندگان</h2><table><tr><th>کاربر</th><th>تعداد CO</th><th>ارزش</th></tr>'.$users.'</table><h2>نتیجه مالی</h2><p>ارزش پیشنهادهای برنده: <b>'.money($m['wonValue']).' ریال</b> | فاکتور ثبت‌شده: <b>'.money($m['invoiced']).' ریال</b></p><p style="color:#64748b">گزارش از داده‌های ثبت‌شده CRM تهیه شده و هر تصمیم نیازمند بررسی مدیریت است.</p></body></html>';
}
function chromium_bin($cfg) { if (!empty($cfg['chromium_bin']) && is_executable($cfg['chromium_bin'])) return $cfg['chromium_bin']; foreach (['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'] as $p) if (is_executable($p)) return $p; return ''; }
function sync_write($syncDir, $key, $data, $by='cron') {
    if (!is_dir($syncDir)) mkdir($syncDir,0755,true);
    file_put_contents($syncDir.'/'.$key.'.json',json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),LOCK_EX);
    $meta=json_file($syncDir.'/meta.json',[]); $rev=(int)($meta[$key]['rev'] ?? 0)+1; $meta[$key]=['rev'=>$rev,'t'=>date('Y-m-d H:i:s'),'by'=>$by]; $meta['_global']=['rev'=>(int)($meta['_global']['rev'] ?? 0)+1,'t'=>date('Y-m-d H:i:s')]; file_put_contents($syncDir.'/meta.json',json_encode($meta,JSON_UNESCAPED_UNICODE),LOCK_EX);
}
function sms_send_report($mobile,$text) {
    $paths=[dirname(__DIR__,2).'/sms-config.php',dirname(__DIR__,3).'/sms-config.php',dirname(__DIR__).'/sms-config.php']; $cfg=null; foreach($paths as $p)if(is_file($p)){$cfg=include $p;break;} if(!is_array($cfg)||empty($cfg['api_key']))return false;
    $mobile=preg_replace('/\D/','',$mobile); if(!preg_match('/^09\d{9}$/',$mobile))return false;
    if(($cfg['provider']??'kavenegar')==='kavenegar'){$url='https://api.kavenegar.com/v1/'.rawurlencode($cfg['api_key']).'/sms/send.json?receptor='.rawurlencode($mobile).'&message='.rawurlencode($text);$r=@file_get_contents($url);return $r!==false;}
    return false;
}

$cfg=cfg_load();
if (!$cfg) { fwrite(STDERR,"management-report-config.php not found\n"); exit(2); }
if (in_array('--diagnose',$argv,true)) { echo json_encode(['php'=>PHP_VERSION,'chromium'=>chromium_bin($cfg)?:null,'curl'=>function_exists('curl_init'),'storage'=>ptf_storage_normalize_cfg(ptf_storage_load_cfg())?true:false],JSON_PRETTY_PRINT)."\n"; exit(0); }
$period=arg('period','weekly'); if(!in_array($period,['weekly','monthly','quarterly','annual'],true)) { fwrite(STDERR,"invalid period\n"); exit(2); }
$dry=in_array('--dry-run',$argv,true); $dataDir=$cfg['data_dir'] ?? dirname(__DIR__).'/crm/data'; $syncDir=rtrim($dataDir,'/').'/sync';
$snapshot=report_snapshot($syncDir,$period); $html=html_report($snapshot); $tmpHtml=tempnam(sys_get_temp_dir(),'ptf-report-').'.html'; file_put_contents($tmpHtml,$html); $tmpPdf=tempnam(sys_get_temp_dir(),'ptf-report-').'.pdf'; $bin=chromium_bin($cfg); $pdfOk=false;
if($bin){$cmd=escapeshellarg($bin).' --headless --no-sandbox --disable-dev-shm-usage --print-to-pdf='.escapeshellarg($tmpPdf).' file://'.escapeshellarg($tmpHtml).' 2>&1'; exec($cmd,$out,$code); $pdfOk=$code===0&&is_file($tmpPdf)&&filesize($tmpPdf)>1000;}
$all=json_file($syncDir.'/ptf_crm_management_reports.json',[]); $cd='MGR-'.strtoupper($period).'-'.date('Ymd-His'); $rec=['cd'=>$cd,'kind'=>$period,'period'=>$snapshot['label'],'snapshot'=>$snapshot,'t'=>date('c'),'by'=>'cron','engine'=>$pdfOk?'chromium':'html-fallback'];
if($pdfOk){$key=ptf_storage_object_key('management-reports',$cd.'.pdf');$up=ptf_storage_put_uploaded_file($tmpPdf,$key);if(!empty($up['ok']))$rec['fileKey']=$key;else $rec['storageError']=$up['error']??'upload_failed';}
if(!$pdfOk){$key=ptf_storage_object_key('management-reports',$cd.'.html');$up=ptf_storage_put_uploaded_file($tmpHtml,$key);if(!empty($up['ok']))$rec['fileKey']=$key;}
if(!$dry){array_unshift($all,$rec);$all=array_slice($all,0,80);sync_write($syncDir,'ptf_crm_management_reports',$all,'cron');}
$link=$cfg['crm_url'] ?? 'https://pishtaj.ir/crm/#anl'; $tpl=$cfg['sms_template'] ?? 'گزارش مدیریتی {kind} برای دوره {period} آماده شد. مشاهده امن پس از ورود به CRM: {url}'; $text=str_replace(['{kind}','{period}','{url}'],[$period,$snapshot['label'],$link],$tpl);
$sent=0;if(!$dry){$users=json_file(rtrim($dataDir,'/').'/crm_users.json',[]);$target=$cfg['recipients'][$period]??[];$mobs=$target['mobiles']??[];foreach($users as $u)if(in_array($u['roleId']??'', $target['roles']??[],true)&&!empty($u['mobile']))$mobs[]=$u['mobile'];foreach(array_unique($mobs) as $m)if(sms_send_report($m,$text))$sent++;}
@unlink($tmpHtml);@unlink($tmpPdf);echo json_encode(['ok'=>true,'period'=>$snapshot['label'],'pdf'=>$pdfOk,'report'=>$rec['cd'],'sent'=>$sent,'dryRun'=>$dry],JSON_UNESCAPED_UNICODE)."\n";
