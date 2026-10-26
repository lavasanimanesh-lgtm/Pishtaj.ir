#!/usr/bin/env node
'use strict';
/* =====================================================================
   probe-rial-companion-adopt-2026-10-27.js
   v34.39.66 — RIAL-COMPANION-ADOPT

   موضوع: RCA «نسخهٔ ریالی دیروز در کادر سبز بود، امروز نیست».

   این پروب دو چیز را روی **کد واقعی** بررسی می‌کند (نه قرارداد ساختگی):
     ① نحو api/crm.php (لیترال‌های نقل‌قول/براکت در تابع تازه)
     ② رفتار تابع‌های واقعیِ استخراج‌شده از api/crm.php در php-wasm:
        sync_offer_companion_parent
        sync_offers_adopt_companions
        sync_offers_payload_has_unregistered_new

   ماتریس:
     A) همراه ریالی با پدرِ ثبت‌شده            → باید پذیرفته (adopt) شود
     B) همراه ارزی (fxOf) با پدرِ ثبت‌شده       → باید پذیرفته شود
     C) همراهی که پدرش روی سرور نیست            → نباید پذیرفته شود (گارد قبلی)
     D) ردیف تازهٔ غیرهمراه (پیش‌نویس)           → نباید پذیرفته شود
     E) همراه با _serverState (در پرواز فرمان)  → نباید پذیرفته شود
     F) همراه با مهر جعلی serverRegisteredAt    → نباید پذیرفته شود
     G) گارد یکپارچگی پس از adopt               → نباید کلید را رد کند
     H) همان گارد بدون adopt                    → باید کلید را رد کند (رفتار قبلی)
     I) idempotency: اجرای دوباره روی خروجی adopt → دوباره adopt نمی‌کند

   اجرا:  NODE_PATH=/tmp/phpwasm/node_modules node _tools/uat/probe-rial-companion-adopt-2026-10-27.js
   (نصب پیش‌نیاز: cd /tmp/phpwasm && npm i php-wasm@0.2.0 php-parser@3.2.3)
   ===================================================================== */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var PHP_FILE = path.join(ROOT, 'api/crm.php');

var pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* ---------- استخراج توابع واقعی از فایل سرور ---------- */
function sliceFn(src, name) {
  var start = src.indexOf('function ' + name + '(');
  if (start < 0) return '';
  /* تا شروع تابع سطح-بالای بعدی یا پایان فایل */
  var rest = src.slice(start + 10);
  var m = rest.match(/\nfunction\s+[a-zA-Z_]/);
  var body = m ? rest.slice(0, m.index) : rest;
  return src.slice(start, start + 10) + body;
}

var src = fs.readFileSync(PHP_FILE, 'utf8');
var fnParent = sliceFn(src, 'sync_offer_companion_parent');
var fnAdopt = sliceFn(src, 'sync_offers_adopt_companions');
var fnGuard = sliceFn(src, 'sync_offers_payload_has_unregistered_new');

T('توابع تازه در api/crm.php موجودند', !!(fnParent && fnAdopt), 'parent=' + fnParent.length + ' adopt=' + fnAdopt.length);
T('گارد یکپارچگی پارامتر $extraNos دارد', /function sync_offers_payload_has_unregistered_new\([^)]*\$extraNos/.test(fnGuard));
T('محل فراخوانی گارد، adopt را قبل از خود صدا می‌زند',
  /sync_offers_adopt_companions\(\$v, \$serverOffersJson/.test(src) && /sync_offers_payload_has_unregistered_new\(\$v, \$serverOffersJson, \$adoptedNos\)/.test(src));
T('پاسخ push فیلد offersAdopted را برمی‌گرداند', /'offersAdopted' => \$offersAdopted/.test(src));

/* ---------- پارس نحو api/crm.php ---------- */
var parser = null;
try { parser = require('php-parser'); } catch (eP) { /* optional */ }
if (parser) {
  try {
    new parser({ parser: { extractDoc: false, suppressErrors: false } }).parseCode(src, 'api/crm.php');
    T('نحو api/crm.php سالم است (php-parser)', true);
  } catch (eParse) {
    T('نحو api/crm.php سالم است (php-parser)', false, String(eParse && eParse.message));
  }
} else {
  console.log('SKIP  php-parser نصب نیست — بررسی نحو PHP انجام نشد');
}

/* ---------- اجرای واقعی در php-wasm ---------- */
var PhpNode = null;
try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (eW) { /* optional */ }

var PHP_PRELUDE = '<?php\n' + fnParent + '\n' + fnAdopt + '\n' + fnGuard + '\n';

var PHP_DRIVER = [
  '<?php',
  'include "/w/fn.php";',
  'function jenc($v){ return json_encode($v, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); }',
  'function mk($no,$extra=[]){ $r=["no"=>$no,"kind"=>"CO","st"=>"sent","currency"=>"IRR","items"=>[["qty"=>1,"price"=>1000]],"terms"=>[]]; foreach($extra as $k=>$v)$r[$k]=$v; return $r; }',
  'function report($name,$v){ echo "R|".$name."|".(is_bool($v)?($v?"1":"0"):jenc($v))."\\n"; }',
  '$src = mk("CO-1405-0071", ["currency"=>"EUR","fxConvert"=>["from"=>"CO-1405-0071","cur"=>"EUR","rate"=>1000000]]);',
  '$src["_id"]="OFR-src"; $src["serverRegisteredAt"]="2026-10-20T10:00:00Z";',
  '$rial = mk("CO-1405-0099", ["rialOf"=>"CO-1405-0071","fxConvert"=>["from"=>"CO-1405-0071","cur"=>"EUR","rate"=>1000000,"totalFx"=>25000,"totalIrr"=>25000000000]]);',
  '$server = jenc([$src]);',
  /* A) همراه ریالی با پدر ثبت‌شده */
  '$a = sync_offers_adopt_companions(jenc([$src,$rial]), $server, "commercial-a");',
  'report("A_adopted", $a===null?[]:$a["adopted"]);',
  '$aRow = null; if($a!==null){ $back=json_decode($a["json"],true); foreach($back as $r){ if(($r["no"]??"")==="CO-1405-0099") $aRow=$r; } }',
  'report("A_stamped", $aRow!==null && ($aRow["serverRegisteredAt"]??"")!=="" && ($aRow["_id"]??"")!=="");',
  'report("A_ops", $aRow===null?"":substr((string)($aRow["serverOperationId"]??""),0,6));',
  'report("A_guard_after", sync_offers_payload_has_unregistered_new($a["json"], $server, $a["adopted"]));',
  'report("A_guard_without", sync_offers_payload_has_unregistered_new($a["json"], $server, []));',
  /* B) همراه ارزی (fxOf) با پدر ثبت‌شده */
  '$irr = mk("CO-1405-0080", ["currency"=>"IRR"]); $irr["serverRegisteredAt"]="2026-10-20T10:00:00Z";',
  '$fxc = mk("CO-1405-0100", ["currency"=>"USD","fxOf"=>"CO-1405-0080","fxConvert"=>["from"=>"CO-1405-0080","cur"=>"USD","rate"=>900000]]);',
  '$b = sync_offers_adopt_companions(jenc([$irr,$fxc]), jenc([$irr]), "commercial-b");',
  'report("B_adopted", $b===null?[]:$b["adopted"]);',
  /* C) پدر ثبت‌نشده */
  '$orphanParent = mk("CO-1405-0111", ["rialOf"=>"CO-1405-9999","fxConvert"=>["rate"=>1]]);',
  '$c = sync_offers_adopt_companions(jenc([$src,$orphanParent]), $server, "x");',
  'report("C_adopted", $c===null?[]:$c["adopted"]);',
  'report("C_guard", sync_offers_payload_has_unregistered_new(jenc([$src,$orphanParent]), $server, $c===null?[]:$c["adopted"]));',
  /* D) ردیف تازهٔ غیرهمراه (پیش‌نویس) */
  '$draft = mk("CO-1405-0122", ["items"=>[["qty"=>2,"price"=>500]]]);',
  '$d = sync_offers_adopt_companions(jenc([$src,$draft]), $server, "x");',
  'report("D_adopted", $d===null?[]:$d["adopted"]);',
  /* E) در پرواز فرمان */
  '$inflight = mk("CO-1405-0133", ["rialOf"=>"CO-1405-0071","fxConvert"=>["rate"=>1],"_serverState"=>"sending"]);',
  '$e = sync_offers_adopt_companions(jenc([$src,$inflight]), $server, "x");',
  'report("E_adopted", $e===null?[]:$e["adopted"]);',
  /* F) مهر جعلی */
  '$forged = mk("CO-1405-0144", ["rialOf"=>"CO-1405-0071","fxConvert"=>["rate"=>1],"serverRegisteredAt"=>"2020-01-01T00:00:00Z"]);',
  '$f = sync_offers_adopt_companions(jenc([$src,$forged]), $server, "x");',
  'report("F_adopted", $f===null?[]:$f["adopted"]);',
  /* G) idempotency: adopt دوباره روی خروجی، دوباره adopt نمی‌کند */
  '$g = sync_offers_adopt_companions($a["json"], $server, "y");',
  'report("G_second_adopt", $g===null?[]:$g["adopted"]);',
  'echo "DONE\\n";'
].join('\n') + '\n';

(async function () {
  if (!PhpNode) {
    console.log('SKIP  php-wasm نصب نیست (NODE_PATH=/tmp/phpwasm/node_modules) — بخش اجرایی اجرا نشد');
    console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
  }
  try {
    var php = new PhpNode();
    await php.run('<?php @mkdir("/w", 0777, true);');
    php.writeFile('/w/fn.php', PHP_PRELUDE);
    php.writeFile('/w/run.php', PHP_DRIVER);
    var out = '';
    php.addEventListener('output', function (e) { out += (e.detail || ''); });
    php.addEventListener('error', function (e) { out += '[stderr] ' + (e.detail || '') + '\n'; });
    await php.run('<?php include "/w/run.php";');
    var lines = String(out).split('\n').filter(function (l) { return l.indexOf('R|') === 0 || l.indexOf('DONE') === 0; });
    T('درایور PHP اجرا شد', lines.some(function (l) { return l === 'DONE'; }), String(out).slice(0, 300));
    var R = {};
    lines.forEach(function (l) {
      if (l.indexOf('R|') !== 0) return;
      var parts = l.split('|');
      R[parts[1]] = parts.slice(2).join('|');
    });
    /* A — همراه ریالی با پدر ثبت‌شده */
    T('A) همراه ریالی با پدر ثبت‌شده پذیرفته شد', R.A_adopted === '["CO-1405-0099"]', 'got=' + R.A_adopted);
    T('A) مهر serverRegisteredAt و _id اضافه شد', R.A_stamped === '1', 'got=' + R.A_stamped);
    T('A) شناسهٔ عملیات adopt با پیشوند ADOPT-', String(R.A_ops || '').replace(/"/g, '') === 'ADOPT-', 'got=' + R.A_ops);
    T('A) گارد پس از adopt کلید را رد نمی‌کند', R.A_guard_after === '0', 'got=' + R.A_guard_after);
    T('A) گارد بدون adopt همان payload رارد می‌کند (رفتار قبلی حفظ شد)', R.A_guard_without === '1', 'got=' + R.A_guard_without);
    /* B — همراه ارزی */
    T('B) همراه ارزی (fxOf) با پدر ثبت‌شده پذیرفته شد', R.B_adopted === '["CO-1405-0100"]', 'got=' + R.B_adopted);
    /* C — پدر ثبت‌نشده */
    T('C) همراه با پدر ثبت‌نشده پذیرفته نمی‌شود', R.C_adopted === '[]', 'got=' + R.C_adopted);
    T('C) گارد آن را همچنان رد می‌کند (حفاظت یکپارچگی)', R.C_guard === '1', 'got=' + R.C_guard);
    /* D — پیش‌نویس غیرهمراه */
    T('D) ردیف تازهٔ غیرهمراه خودکار منتشر نمی‌شود', R.D_adopted === '[]', 'got=' + R.D_adopted);
    /* E — در پرواز فرمان */
    T('E) ردیف در پرواز (_serverState) پذیرفته نمی‌شود', R.E_adopted === '[]', 'got=' + R.E_adopted);
    /* F — مهر جعلی */
    T('F) مهر سرورِ جعلی روی ردیف محلی پذیرفته نمی‌شود', R.F_adopted === '[]', 'got=' + R.F_adopted);
    /* G — idempotency */
    T('G) adopt دوباره روی خروجی خودش تکرار نمی‌شود', R.G_second_adopt === '[]', 'got=' + R.G_second_adopt);
  } catch (eRun) {
    T('اجرای php-wasm بدون استثنا', false, String((eRun && eRun.message) || eRun));
  }
  console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
