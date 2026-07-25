<?php
// Contact form endpoint for Pishro Tajhiz Fartak
// Upload this file with the site on a PHP-enabled host.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/storage-lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
  exit;
}

// Honeypot anti-spam field
if (!empty($_POST['website'] ?? '')) {
  echo json_encode(['ok' => true, 'message' => 'OK']);
  exit;
}

function clean_text($value, $max = 2000) {
  $value = trim((string)$value);
  $value = strip_tags($value);
  $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
  if (mb_strlen($value, 'UTF-8') > $max) {
    $value = mb_substr($value, 0, $max, 'UTF-8');
  }
  return $value;
}

$name = clean_text($_POST['name'] ?? '', 120);
$company = clean_text($_POST['company'] ?? '', 160);
$phone = clean_text($_POST['phone'] ?? '', 80);
$email = clean_text($_POST['email'] ?? '', 160);
$category = clean_text($_POST['category'] ?? '', 180);
$subject = clean_text($_POST['subject'] ?? '', 180);
$message = clean_text($_POST['message'] ?? '', 5000);

if ($name === '' || $phone === '' || $category === '' || $subject === '' || $message === '') {
  http_response_code(422);
  echo json_encode(['ok' => false, 'message' => 'فیلدهای الزامی کامل نیستند.']);
  exit;
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(422);
  echo json_encode(['ok' => false, 'message' => 'ایمیل نامعتبر است.']);
  exit;
}

$to = 'lavasani.manesh@gmail.com';
$mailSubject = 'درخواست استعلام از سایت - ' . $subject;
$body = "درخواست جدید از وب‌سایت پیشرو تجهیز فرتاک\n";
$body .= "----------------------------------------\n";
$body .= "نام: {$name}\n";
$body .= "شرکت: {$company}\n";
$body .= "تلفن: {$phone}\n";
$body .= "ایمیل: {$email}\n";
$body .= "حوزه درخواست: {$category}\n";
$body .= "موضوع: {$subject}\n";
$body .= "----------------------------------------\n";
$body .= "شرح درخواست:\n{$message}\n";
$body .= "----------------------------------------\n";
$body .= "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\n";
$body .= "Date: " . date('Y-m-d H:i:s') . "\n";

/* Persistent attachment policy: cloud only. The multipart tmp file is streamed
   to S3 and is discarded by PHP after this request; api/uploads is never used. */
$attachmentMeta = null;
if (!empty($_FILES['attachment']['name'])) {
  $original = (string)$_FILES['attachment']['name'];
  $allowed = ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','webp','zip','rar'];
  $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
  if (!is_uploaded_file($_FILES['attachment']['tmp_name'] ?? '') || !in_array($ext, $allowed, true) || (int)($_FILES['attachment']['size'] ?? 0) < 1 || (int)$_FILES['attachment']['size'] > 10 * 1024 * 1024) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'فایل پیوست معتبر نیست یا حجم آن بیش از ۱۰MB است.']);
    exit;
  }
  $key = ptf_storage_object_key('site-contact', $original);
  $put = ptf_storage_put_uploaded_file($_FILES['attachment']['tmp_name'], $key);
  if (empty($put['ok'])) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => 'پیوست در فضای ابری ذخیره نشد: ' . ($put['error'] ?? 'خطای نامشخص')]);
    exit;
  }
  $attachmentMeta = ['key' => $key, 'name' => $original, 'size' => (int)$_FILES['attachment']['size'], 'mode' => 'arvan'];
  $body .= "\nپیوست ابری: {$key}\nنام فایل اصلی: {$original}\n";
}

// Save a local log so requests are not lost if mail() is disabled on host.
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) { @mkdir($logDir, 0755, true); }
@file_put_contents($logDir . '/contacts.log', "\n\n" . $body, FILE_APPEND | LOCK_EX);

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'From: PTF Website <no-reply@pishtaj.ir>';
$headers[] = 'Bcc: Info@pishrotajheez.ir';
if ($email !== '') { $headers[] = 'Reply-To: ' . $email; }

$mailSent = @mail($to, '=?UTF-8?B?' . base64_encode($mailSubject) . '?=', $body, implode("\r\n", $headers));

echo json_encode(['ok' => true, 'mailSent' => $mailSent, 'message' => 'درخواست ثبت شد.']);
