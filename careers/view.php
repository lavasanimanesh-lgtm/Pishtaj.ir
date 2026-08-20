<?php
/**
 * رندر صفحه آگهی از jobs.json اگر فایل استاتیک نوشته نشده باشد.
 * URL عمومی همچنان /careers/{slug}/ است (rewrite در .htaccess).
 */
define('PTF_CAREERS_LIB', true);
require_once dirname(__DIR__) . '/api/careers.php';

$slug = careers_slug($_GET['slug'] ?? '');
$job = $slug !== '' ? careers_find($slug) : null;
if (!$job) {
    http_response_code(404);
    $f = dirname(__DIR__) . '/404.html';
    if (is_file($f)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($f);
    } else {
        echo 'صفحه پیدا نشد';
    }
    exit;
}
header('Content-Type: text/html; charset=utf-8');
echo careers_job_html($job);
