/* tester691 — v34.39.52 (BUG-OFF-TOCO-CLONE-IDENTITY)
   گزارش کارفرما: «در قسمت پیشنهادهای فنی، جلوی هر پیشنهاد کلید ساخت پیشنهاد مالی وجود دارد.
   عملکرد آن باید به‌گونه‌ای باشد که مقادیر پیشنهاد فنی و شمارهٔ پیشنهاد فنی فقط به فرم
   پیشنهاد مالی اضافه شود؛ اما اتفاقی که می‌افتد این است که پیشنهاد فنی به‌طور کلی حذف می‌شود.»

   ریشه: offerToCo رکورد TO را کامل deep-clone می‌کرد و `_id` سروری سند مبدأ روی کلون می‌ماند.
   فرمان register_offer هدف را اول با `_id` پیدا می‌کند (api/sales-domain.php:1900) و سپس
   `$offers[$target]=$incoming` رکورد پیشنهاد فنی را با CO بازنویسی می‌کرد — حذف بی‌صدا، بدون
   ثبت در سطل بازیافت و با پاسخ ok:true.

   این تستر سه لایه را با «کد واقعی» قفل می‌کند (نه با بازنویسی منطق):
     ۱) offerToCo واقعی از crm/offers.js → هویت/تاریخچه/lineId موروثی پاک، srcToNo درست
     ۲) offerSave واقعی از crm/offers.js → `_id` موروثیِ پیش‌نویس مسموم پیش از ارسال پاک می‌شود
     ۳) api/sales-domain.php واقعی روی php-wasm → هم TO می‌ماند و هم CO؛ و createIntent با
        `_id` بیگانه = 409 create_intent_identity_mismatch بدون هیچ تخریبی
   بخش سرور اختیاری است: npm i php-wasm (خارج از ریپو) +
   NODE_PATH=/path/outside/repo/node_modules node _tools/uat/tester691-…js
   در نبود php-wasm، بخش سرور «اجرا نشد» گزارش می‌شود — هرگز PASS دروغین. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var API = path.resolve(__dirname, '../../api');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var apiCode = fs.readFileSync(path.join(API, 'sales-domain.php'), 'utf-8');

var TO_NO = 'PTF-TO-1405-003', TO_ID = 'OFR-aaaa1111', CO_NO = 'PTF-CO-1405-007', INQ = 'RFQ-1405-011';
function seedTO() {
  return {
    _id: TO_ID, no: TO_NO, kind: 'TO', rev: 0, st: 'approved',
    buyerCd: 'CUST-7', buyerCo: 'Fooled Steel Co', buyerContact: 'Mr. X', buyerTel: '021-1',
    inqNo: INQ, dateEn: '2026-10-01', dateFa: '1405/07/09',
    items: [{ name: 'Control Valve', desc: 'DN80', model: 'CV-80', qty: 4, unit: 'NO', brand: 'Samson', price: 0, lineId: 'OL-PTF-TO-1405-003-abc' }],
    terms: [{ t: 'Delivery: 8 weeks' }], extraCols: [{ h: 'Origin' }],
    revisionHistory: [{ rev: 0, at: '2026-09-01T00:00:00.000Z', by: 'Admin' }],
    editHistory: [{ at: '2026-09-02T00:00:00.000Z', by: 'Admin', reason: 'اصلاح پیش از برد' }],
    serverOperationId: 'OFFER-SAVE|old-to-op', serverRequestHash: 'hash-of-to'
  };
}
function seedStore() {
  setData('ptf_crm_offers', [seedTO()]);
  setData('ptf_crm_customers', [{ cd: 'CUST-7', co: 'فولاد مبارکه', coEn: 'Fooled Steel Co' }]);
  setData('ptf_crm_rfqs', [{ _id: 'RQ-1', cd: INQ, inqNo: INQ, co: 'فولاد مبارکه', st: 'st4', stxt: 'پیشنهاد فنی صادر شد' }]);
  setData('ptf_crm_users', [{ username: 'admin', name: 'Admin', nameEn: 'Sales Department' }]);
  setData('ptf_crm_products', []);
}

SECTION('قرارداد کد: هویت سند مبدأ روی کلون →CO نمی‌ماند');
T('offerToCo شناسهٔ سروری سند مبدأ را پاک می‌کند', of.indexOf('delete _offState._id;') > -1);
T('تاریخچهٔ نگارش/ویرایش سند مبدأ پاک می‌شود',
  of.indexOf('delete _offState.revisionHistory; delete _offState.editHistory;') > -1);
T('مهرهای سروری و فیلدهای برد/فاکتور/متمم پاک می‌شوند',
  of.indexOf('delete _offState.serverOperationId; delete _offState.serverRequestHash;') > -1 &&
  of.indexOf('delete _offState.wonAtISO; delete _offState.wonBy; delete _offState.wonRevisionSnapshot;') > -1 &&
  of.indexOf('delete _offState.priorStatus; delete _offState.invRef; delete _offState.rialOf;') > -1);
T('lineId اقلام با شمارهٔ سند جدید بازتولید می‌شود',
  of.indexOf('var c = JSON.parse(JSON.stringify(it || {})); delete c.lineId; return c;') > -1 &&
  of.indexOf('offEnsureOfferLineIds(_offState.items, _offState.no)') > -1);
T('پاک‌سازی پیش از انتساب شماره/نوع تازه انجام می‌شود (ترتیب درست)',
  of.indexOf('delete _offState._id;') < of.indexOf("_offState.no = offerSerial('CO');"));
T('offerSave هم به‌عنوان آخرین سنگر `_id` موروثی سند جدید را پاک می‌کند',
  of.indexOf("if ((o.editMode || 'new') === 'new' && o._id) {") > -1 &&
  of.indexOf('var _idOwner = offers.filter(function (x) { return x && x._id === o._id; })[0];') > -1);
T('گارد سرور: createIntent با `_id` متعلق به شمارهٔ دیگر رد قطعی می‌شود',
  /if\(\$createIntent&&\$idIndex>=0&&!\$crashRecovery&&\(string\)\(\$offers\[\$idIndex\]\['no'\]\?\?''\)!==\$no\)sd_out\(\['ok'=>false,'error'=>'create_intent_identity_mismatch'/.test(apiCode));
T('شمارهٔ پیشنهاد فنی مبدأ در فرم پیشنهاد مالی نمایش داده می‌شود',
  of.indexOf('پیشنهاد فنی مبدأ (فقط‌خوانی)') > -1 && of.indexOf('ptfSrcToExists') > -1);

SECTION('رفتار واقعی کلاینت: offerToCo() از crm/offers.js');
/* تابع واقعی استخراج و اجرا می‌شود — هیچ منطقی بازنویسی نشده است. */
global.ptfUnifiedCode = function () { return CO_NO; };
global.offerForm = function () { global._formOpened = true; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.myEnName = function () { return 'Sales Department'; };
global.dedupNorm = function (x) { return String(x == null ? '' : x).replace(/\s/g, '').toLowerCase(); };
global._offState = null;
loadFns('offers.js', ['offerSerial', 'ptfSetOffState', 'offNormLine', 'offItemKey', 'offEnsureOfferLineIds', 'offDedupeOfferItems',
  'defaultValidity', 'offerPostAwardLocked', 'ptfOfferResolveSaveIdentity', 'offerToCo', 'offerSave']);
/* offRowIsEmpty به‌صورت window.offRowIsEmpty = function… تعریف شده (نه declaration)؛
   offEnsureOfferLineIds به آن نیاز دارد، پس عیناً از همان فایل استخراج می‌شود. */
(function () {
  var m = of.match(/window\.offRowIsEmpty = function \(it\) \{[\s\S]*?\n\};/);
  if (!m) throw new Error('offRowIsEmpty not found in offers.js');
  eval(m[0]);
})();
seedStore();
offerToCo(TO_NO);
var st = global._offState || {};
T('فرم پیشنهاد مالی باز شد', global._formOpened === true);
T('مقادیر پیشنهاد فنی عیناً به فرم مالی رفت (اقلام/کارفرما/درخواست/ستون‌ها)',
  st.kind === 'CO' && st.buyerCd === 'CUST-7' && st.inqNo === INQ &&
  (st.items || []).length === 1 && st.items[0].name === 'Control Valve' && (st.extraCols || []).length === 1);
T('شمارهٔ پیشنهاد فنی به‌عنوان srcToNo روی فرم نشست', st.srcToNo === TO_NO);
T('سند جدید هیچ شناسهٔ سروری موروثی ندارد', st._id === undefined, '_id=' + st._id);
T('تاریخچهٔ جعلی از سند مبدأ منتقل نشد', st.revisionHistory === undefined && st.editHistory === undefined);
T('مهر سروری سند مبدأ منتقل نشد', st.serverOperationId === undefined && st.serverRequestHash === undefined);
T('lineId با شمارهٔ سند جدید بازتولید شد',
  !!st.items[0].lineId && st.items[0].lineId !== 'OL-PTF-TO-1405-003-abc' &&
  String(st.items[0].lineId).indexOf('OL-PTF-CO-1405-007-') === 0, String(st.items[0].lineId));
T('رکورد پیشنهاد فنی در حافظهٔ محلی دست‌نخورده باقی ماند',
  (function () { var t = getData('ptf_crm_offers').filter(function (o) { return o.no === TO_NO; })[0]; return !!t && t._id === TO_ID && t.kind === 'TO'; })());

SECTION('رفتار واقعی offerSave(): پیش‌نویس مسموم (دورهٔ قبل از اصلاح)');
/* سناریوی واقعی: draft ذخیره‌شده در Dev-KV هنوز `_id` سند مبدأ را دارد. */
seedStore();
global.window.PTF_OFFER_COMMAND_SAVE_ACTIVE = true;
ptfSetOffState({
  _id: TO_ID, no: 'PTF-CO-1405-009', kind: 'CO', rev: 0, st: 'draft', editMode: 'new',
  buyerCd: 'CUST-7', buyerCo: 'Fooled Steel Co', inqNo: INQ, dateEn: '2026-10-06',
  items: [{ name: 'Gauge', qty: 2, unit: 'NO', price: 100 }], terms: []
});
var saveRet = offerSave();
var savedAll = getData('ptf_crm_offers');
var savedCo = savedAll.filter(function (o) { return o.no === 'PTF-CO-1405-009'; })[0];
var stillTo = savedAll.filter(function (o) { return o.no === TO_NO; })[0];
T('ذخیرهٔ سند جدید موفق بود', !!(saveRet && saveRet.ok), JSON.stringify(saveRet));
T('_id موروثی پیش از ارسال پاک شد', !!savedCo && savedCo._id === undefined, savedCo ? String(savedCo._id) : 'record missing');
T('رکورد پیشنهاد فنی با شناسهٔ خودش سالم ماند', !!stillTo && stillTo._id === TO_ID);
T('دو رکورد مستقل در مجموعه وجود دارد (نه بازنویسی)', savedAll.length === 2, 'count=' + savedAll.length);

/* payload دقیقاً همان چیزی است که crm/sales-domain-v2.js:1222,1226 می‌فرستد:
   clone(saved) + createIntent = (ret.idx < 0) */
function payloadFor(rec, idx) {
  var p = JSON.parse(JSON.stringify(rec));
  delete p._serverState; delete p._serverOpId; delete p._serverError;
  return { offer: p, rfq: null, createIntent: idx < 0, idempotencyKey: 'OFFER-SAVE|t691|' + p.no };
}

SECTION('رندر واقعی فرم: offerForm() شمارهٔ پیشنهاد فنی مبدأ را نشان می‌دهد');
loadVar('offers.js', 'TC_LIBRARY');
loadFns('offers.js', ['myEnName', 'offerForm']);
(function () {
  var rendered = '';
  var origGet = global.document.getElementById;
  global.document.getElementById = function (id) {
    if (id === 'panels') return { insertAdjacentHTML: function (pos, h) { rendered = h; } };
    return null;
  };
  /* هلپرهای نقاشیِ پس از رندر — خروجی مورد سنجش (رشتهٔ html) به آن‌ها وابسته نیست */
  ['offRenderItems', 'offRenderTerms', 'offSyncTcLib', 'ptfOfferRefreshBuyerChip', 'offerPickBuyer',
    'ptfDatePicker', 'ptfISOToJ', 'ptfInqNoValid', 'offerBuyerToggleFull', 'offerBuyerAcSearch',
    'ptfOfferBuyerLabel', 'ptfInqOptionsFor', 'offOtherInqOpen'].forEach(function (n) {
      if (typeof global[n] !== 'function') global[n] = function () { return ''; };
    });
  global.mySigReady = function () { return false; };
  global.ptfCanDelegateSig = function () { return false; };
  global.ptfSignAsOptions = function () { return ''; };
  function render(state) { rendered = ''; seedStore(); ptfSetOffState(state); offerForm(); return rendered; }
  var h1 = render({ no: CO_NO, kind: 'CO', buyerCd: 'CUST-7', buyerCo: 'Fooled Steel Co', srcToNo: TO_NO, items: [], terms: [] });
  T('ردیف فقط‌خوانی «پیشنهاد فنی مبدأ» در فرم مالی رندر می‌شود', h1.indexOf('پیشنهاد فنی مبدأ (فقط‌خوانی)') > -1);
  T('شمارهٔ پیشنهاد فنی داخل همان ردیف نمایش داده می‌شود', h1.indexOf(TO_NO) > -1);
  var h2 = render({ no: CO_NO, kind: 'CO', buyerCd: 'CUST-7', buyerCo: 'Fooled Steel Co', items: [], terms: [] });
  T('بدون مبدأ، ردیف اضافه نمی‌شود (فرم «+ پیشنهاد مالی» دست‌نخورده)', h2.indexOf('پیشنهاد فنی مبدأ (فقط‌خوانی)') === -1);
  var h3 = render({ no: CO_NO, kind: 'CO', buyerCd: 'CUST-7', buyerCo: 'Fooled Steel Co', srcToNo: 'PTF-TO-1300-999', items: [], terms: [] });
  T('زنجیرهٔ آسیب‌دیدهٔ قدیمی هشدار می‌گیرد (رکورد مبدأ پیدا نشد)', h3.indexOf('رکورد این پیشنهاد فنی در فهرست پیشنهادها پیدا نشد') > -1);
  global.document.getElementById = origGet;
})();

/* ============================ بخش سرور واقعی ============================ */
var PhpNode = null;
try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (eNoWasm) { PhpNode = null; }

if (!PhpNode) {
  console.log('\n⚠️  php-wasm در دسترس نیست — بخش «سرور واقعی» اجرا نشد (PASS دروغین ثبت نمی‌شود).');
  console.log('    نصب خارج از ریپو: npm i php-wasm  و اجرا با NODE_PATH=…/node_modules');
  DONE('tester691-v34.39.51-toCo-keeps-technical-offer (بدون بخش سرور)');
  process.exitCode = RESULTS.fail ? 1 : 0;
  return;
}

var FILES = ['crm.php', 'sales-domain.php', 'auth.php', 'secrets.php', 'storage-lib.php', 'db-lib.php', 'contact-merge-lib.php', 'rfq-notify-lib.php', 'notify-bot.php'];
var SECRET = 'e2e-only-toco-auth-0123456789abcdef0123456789abcdef';
var MB = "\nif(!function_exists('mb_strlen')){function mb_strlen($s,$enc=null){return preg_match_all('/./us',$s);}}\n" +
  "if(!function_exists('mb_substr')){function mb_substr($s,$a,$n=null,$enc=null){$chars=preg_split('//u',$s,-1,PREG_SPLIT_NO_EMPTY);return implode('',array_slice($chars?:[],$a,$n));}}\n" +
  "if(!function_exists('mb_strtolower')){function mb_strtolower($s,$enc=null){return strtolower($s);}}\n" +
  "if(!function_exists('mb_strpos')){function mb_strpos($s,$n,$a=0,$enc=null){return strpos($s,$n,$a);}}\n" +
  "if(!function_exists('mb_convert_encoding')){function mb_convert_encoding($s,$to,$from=null){return $s;}}\n";
var CURL = "\nif(!function_exists('curl_init')){\n $GLOBALS['__curl']=[];\n" +
  " function curl_init($u=null){$i=count($GLOBALS['__curl']);$GLOBALS['__curl'][$i]=['url'=>$u,'opts'=>[]];return $i;}\n" +
  " function curl_setopt_array($h,$o){$GLOBALS['__curl'][$h]['opts']=$o;return true;}\n" +
  " function curl_setopt($h,$k,$v){$GLOBALS['__curl'][$h]['opts'][$k]=$v;return true;}\n" +
  " function curl_exec($h){return '{\"ok\":true,\"result\":{\"message_id\":1}}';}\n" +
  " function curl_getinfo($h,$k=null){return 200;}\n function curl_errno($h){return 0;}\n function curl_error($h){return '';}\n function curl_close($h){return true;}\n" +
  " foreach(['CURLOPT_RETURNTRANSFER'=>19913,'CURLOPT_POST'=>47,'CURLOPT_TIMEOUT'=>13,'CURLOPT_CONNECTTIMEOUT'=>78,'CURLOPT_HTTPHEADER'=>10023,'CURLOPT_POSTFIELDS'=>10015,'CURLOPT_SSL_VERIFPEER'=>64,'CURLINFO_HTTP_CODE'=>2097154]as $k=>$v)if(!defined($k))define($k,$v);\n}\n";
var INPUT = "class T691Input {\n public $context;public $value='';public $pos=0;\n" +
  " public function stream_open($p,$m,$o,&$opened){$this->value=$GLOBALS['E2E_BODY']??'';$opened=true;return true;}\n" +
  " public function stream_read($n){$v=substr($this->value,$this->pos,$n);$this->pos+=strlen($v);return $v;}\n" +
  " public function stream_eof(){return $this->pos>=strlen($this->value);}\n" +
  " public function stream_tell(){return $this->pos;}\n" +
  " public function stream_seek($p,$w){$this->pos=$w;return true;}\n" +
  " public function stream_stat(){return [];}\n public function stream_close(){}\n}\n" +
  "@stream_wrapper_unregister('php');@stream_wrapper_register('php','T691Input');\n";

/* فقط لایهٔ transport/auth/storage مصنوعی است — همان الگوی e2e-rfq-telegram-v34.39.43.js */
async function request(state, opts) {
  opts = opts || {};
  var php = new PhpNode(), out = [], err = [];
  php.addEventListener('output', function (e) { out.push(e.detail || e.data || ''); });
  php.addEventListener('error', function (e) { err.push(e.detail || e.data || ''); });
  await php.run("<?php @mkdir('/w/app/api',0777,true);@mkdir('/w/app/crm/data/sync',0777,true);@mkdir('/tmp2',0777,true);");
  for (var i = 0; i < FILES.length; i++) {
    var f = FILES[i];
    var source = fs.readFileSync(path.join(API, f), 'utf8');
    if (f === 'sales-domain.php') source = source.replace('    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);\n    exit;', '    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);\n    t691_capture();\n    exit;');
    await php.writeFile('/w/app/api/' + f, source);
  }
  await php.writeFile('/w/ptf-secrets.php', "<?php return ['auth_key'=>'" + SECRET + "','captcha_key'=>'" + SECRET + "'];");
  await php.writeFile('/w/bot-config.php', "<?php return ['telegram_token'=>'111:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>false];");
  Object.keys(state).forEach(function (k) { return php.writeFile('/w/app/crm/data/' + k, state[k]); });
  await php.writeFile('/tmp2/body', JSON.stringify(opts.body || {}));
  var auth = " $user='admin';$role='admin';$now=time();$nonce=bin2hex(random_bytes(16));\n" +
    " $p=$user.'|'.$role.'|'.$now.'|'.$nonce;$sig=hash_hmac('sha256',$p,'" + SECRET + "');\n" +
    " $tok=rtrim(strtr(base64_encode($p.'|'.$sig),'+/','-_'),'=');\n" +
    " $tf='/w/app/crm/data/tokens.json';$ts=is_file($tf)?(json_decode(file_get_contents($tf),true)?:[]):[];\n" +
    " $ts[$tok]=['user'=>$user,'role'=>$role,'iat'=>$now,'exp'=>$now+86400,'ip'=>'10.0.0.88'];file_put_contents($tf,json_encode($ts));\n" +
    " $_SERVER['HTTP_X_CRM_TOKEN']=$tok;";
  var code = "<?php error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED); ini_set('display_errors','0'); " + MB + CURL +
    " $_SERVER['HTTP_HOST']='crm.test';$_SERVER['REMOTE_ADDR']='10.0.0.88';$_SERVER['REQUEST_METHOD']='POST';\n" +
    " function t691_capture(){\n  if(!empty($GLOBALS['t691_done']))return;$GLOBALS['t691_done']=true;\n" +
    "  $dirs=['/w/app/crm/data'=>'','/w/app/crm/data/sync'=>'sync/'];\n  if(function_exists('sd_sync_dir'))$dirs[sd_sync_dir()]='sync/';\n" +
    "  $files=[];foreach($dirs as $dir=>$prefix)foreach(array_merge(glob($dir.'/*.json')?:[],glob($dir.'/.*.json')?:[])as $file)$files[$prefix.basename($file)]=file_get_contents($file);\n" +
    "  echo \"\\n__T691_STATE__\".json_encode(['files'=>$files]).\"\\n\";\n }\n" +
    auth + "\n $_POST=[];\n $_GET=['action'=>'register_offer'];$_REQUEST=$_GET;\n" +
    " $GLOBALS['E2E_BODY']=file_get_contents('/tmp2/body');" + INPUT +
    " require '/w/app/api/sales-domain.php';t691_capture();";
  await php.run(code);
  await php.run("<?php while(ob_get_level()>0)ob_end_flush();");
  await new Promise(function (r) { setTimeout(r, 30); });
  var raw = out.join(''), marker = '\n__T691_STATE__';
  var split = raw.indexOf(marker), response = split < 0 ? raw : raw.slice(0, split);
  var captured = null;
  if (split >= 0) { try { captured = JSON.parse(raw.slice(split + marker.length).trim()); } catch (e) {} }
  if (captured) { Object.keys(state).forEach(function (k) { delete state[k]; }); Object.assign(state, captured.files); }
  var json = {}; try { json = JSON.parse(response); } catch (e) { json = { badResponse: response }; }
  return { json: json, response: response, stderr: err.join('') };
}

function serverState() {
  var s = {};
  s['sync/ptf_crm_offers.json'] = JSON.stringify([seedTO()]);
  s['sync/ptf_crm_rfqs.json'] = JSON.stringify([{ _id: 'RQ-1', cd: INQ, inqNo: INQ, co: 'فولاد مبارکه', st: 'st4', stxt: 'پیشنهاد فنی صادر شد' }]);
  return s;
}

(async function () {
  SECTION('سرور واقعی: register_offer با خروجیِ واقعی offerToCo');
  var state = serverState();
  var r = await request(state, { body: payloadFor(st, -1) });
  var after = JSON.parse(state['sync/ptf_crm_offers.json'] || '[]');
  var srvTo = after.filter(function (o) { return o.no === TO_NO; })[0];
  var srvCo = after.filter(function (o) { return o.no === CO_NO; })[0];
  T('فرمان موفق بود', r.json.ok === true, r.response.slice(0, 300) + ' ' + r.stderr.slice(0, 200));
  T('پیشنهاد مالی ثبت شد و شناسهٔ تازه از سرور گرفت',
    !!srvCo && srvCo.kind === 'CO' && !!srvCo._id && srvCo._id !== TO_ID, JSON.stringify(after.map(function (o) { return o.no + '/' + o._id; })));
  T('پیشنهاد فنی سر جایش باقی ماند (خواستهٔ اصلی کارفرما)', !!srvTo && srvTo.kind === 'TO' && srvTo._id === TO_ID);
  T('لینک coNo روی پیشنهاد فنی نشست', !!srvTo && srvTo.coNo === CO_NO);
  T('تاریخچهٔ پیشنهاد فنی روی سند مالی نشت نکرد', !!srvCo && srvCo.revisionHistory === undefined && srvCo.editHistory === undefined);
  T('lineId سند مبدأ روی سند مالی نشت نکرد', !!srvCo && String(((srvCo.items || [])[0] || {}).lineId || '') !== 'OL-PTF-TO-1405-003-abc');

  SECTION('سرور واقعی: گارد createIntent با `_id` بیگانه (باندل کش‌شدهٔ قدیمی)');
  var state2 = serverState();
  var poisoned = JSON.parse(JSON.stringify(st));
  poisoned._id = TO_ID;               /* همان حالت نسخهٔ قدیمی/پیش‌نویس مسموم */
  poisoned.no = 'PTF-CO-1405-008';
  var r2 = await request(state2, { body: payloadFor(poisoned, -1) });
  var after2 = JSON.parse(state2['sync/ptf_crm_offers.json'] || '[]');
  T('رد قطعی با 409 create_intent_identity_mismatch',
    r2.json.ok === false && r2.json.error === 'create_intent_identity_mismatch', JSON.stringify(r2.json).slice(0, 240));
  T('پیشنهاد فنی دست‌نخورده ماند و هیچ رکوردی بازنویسی نشد',
    after2.length === 1 && after2[0].no === TO_NO && after2[0].kind === 'TO' && after2[0]._id === TO_ID,
    JSON.stringify(after2.map(function (o) { return o.no + '/' + o.kind; })));
  T('شمارهٔ رکورد موجود در پاسخ برگشت (قابل تشخیص برای کاربر/لاگ)', r2.json.existingNo === TO_NO, JSON.stringify(r2.json.existingNo));

  SECTION('سرور واقعی: رگرسیون — ویرایش همان سند (همان _id و همان شماره)');
  var state3 = serverState();
  var edited = JSON.parse(JSON.stringify(seedTO()));
  edited.buyerContact = 'Mrs. Y';
  edited.updatedAtISO = '2026-10-06T09:00:00.000Z';
  var r3 = await request(state3, { body: payloadFor(edited, 0) });   /* idx>=0 → createIntent:false */
  var after3 = JSON.parse(state3['sync/ptf_crm_offers.json'] || '[]');
  T('ویرایش سند موجود همچنان در جای خود به‌روزرسانی می‌شود',
    r3.json.ok === true && after3.length === 1 && after3[0].no === TO_NO && after3[0].buyerContact === 'Mrs. Y',
    JSON.stringify(after3.map(function (o) { return o.no + ':' + o.buyerContact; })));

  DONE('tester691-v34.39.51-toCo-keeps-technical-offer');
  process.exitCode = RESULTS.fail ? 1 : 0;
})().catch(function (e) { console.error(e && e.stack ? e.stack : e); process.exitCode = 1; });
