<?php
/* ============================================================================
   deploy-probe.php — پروب صحت استقرار (ROADMAP-THIN-CLIENT-MAXIMAL → T0-4)
   ============================================================================
   چرا: تا v34.8.34 هیچ گامی بعد از FTP بررسی نمی‌کرد که «فایل زنده == فایل کامیت»؛
   دقیقاً همان بندی که هر دو رودمپ برای گرفتن باگ «نسخهٔ مخلوط» (۲۰۲۶-۰۸-۲۷:
   index.html تازه + js های کهنه) خواسته بودند. فایل‌های PHP را نمی‌توان روی HTTP
   هش گرفت (api/.htaccess آن‌ها را اجرا یا مسدود می‌کند)، پس این پروب خودِ هش را
   روی سرور محاسبه می‌کند و گیت پس از استقرار (`_tools/ci/post-deploy-hash-check.sh
   --probe`) همان را با هش working tree مقایسه می‌کند.

   امنیت/حریم خصوصی: فقط SHA-1 و اندازهٔ یک فهرست *ثابت* از فایل‌های نسخه‌ای که
   همگی در مخزن عمومی پروژه‌اند. هیچ دادهٔ کسب‌وکاری، هیچ نام کاربری، هیچ مسیر
   مطلق و هیچ mtime بیرون نمی‌رود. ورودی کاربر برای انتخاب فایل‌ها پذیرفته نمی‌شود.

   قالب پاسخ:
     ?format=text (پیش‌فرض)  خط اول: "# ptf-deploy-probe-v1 version=vX.Y.Z"
                             سپس هر خط: <sha1>\t<bytes>\t<relative-path>
     ?format=json           {"ok":true,"probe":"ptf-deploy-probe-v1",
                             "version":"vX.Y.Z","files":[{path,sha1,bytes,missing}]}
   ============================================================================ */

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

define('PTF_PROBE_ID', 'ptf-deploy-probe-v1');

/* فهرست ثابت — هر افزودن/کم کردن باید با تستر tester536 هماهنگ بماند */
$ptf_probe_files = array(
  'VERSION.json',
  'api/sales-domain.php',
  'api/crm.php',
  'crm/index.html',
  'crm/sw.js',
  'crm/manifest.json',
  'crm/sales-domain-v2.js',
  'crm/leads.js',
  'crm/client-server.js',
  'crm/key-registry.js'
);

$ptf_root = dirname(__DIR__);

/* نسخهٔ رسمی از تنها منبع حقیقت (VERSION.json — قرارداد قاعدهٔ A6) */
$ptf_release = 'unknown';
if (is_readable($ptf_root . '/VERSION.json')) {
  $ptf_vj = json_decode((string) file_get_contents($ptf_root . '/VERSION.json'), true);
  if (is_array($ptf_vj) && isset($ptf_vj['crm_version']) && is_string($ptf_vj['crm_version'])) {
    $ptf_release = $ptf_vj['crm_version'];
  }
}

$ptf_rows = array();
foreach ($ptf_probe_files as $ptf_rel) {
  $ptf_abs = $ptf_root . '/' . $ptf_rel;
  if (!is_readable($ptf_abs)) {
    $ptf_rows[] = array('path' => $ptf_rel, 'sha1' => '', 'bytes' => -1, 'missing' => true);
    continue;
  }
  $ptf_sha = sha1_file($ptf_abs);
  $ptf_rows[] = array(
    'path' => $ptf_rel,
    'sha1' => is_string($ptf_sha) ? $ptf_sha : '',
    'bytes' => (int) filesize($ptf_abs),
    'missing' => false
  );
}

$ptf_fmt = isset($_GET['format']) ? strtolower((string) $_GET['format']) : 'text';

if ($ptf_fmt === 'json') {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array(
    'ok' => true,
    'probe' => PTF_PROBE_ID,
    'version' => $ptf_release,
    'files' => $ptf_rows
  ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

echo '# ' . PTF_PROBE_ID . ' version=' . $ptf_release . "\n";
foreach ($ptf_rows as $ptf_r) {
  echo $ptf_r['sha1'] . "\t" . $ptf_r['bytes'] . "\t" . $ptf_r['path'];
  if ($ptf_r['missing']) echo "\tMISSING";
  echo "\n";
}
