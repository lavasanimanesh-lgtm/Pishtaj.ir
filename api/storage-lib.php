<?php
/* =====================================================================
   PTF CRM — Shared S3 storage helpers
   - No output, no request routing: safe to include from public endpoints.
   - Persistent attachments are sent from PHP upload tmp files directly to S3.
   - The PHP temporary upload is released by PHP after the request; no durable
     attachment copy is made on the web host.
   ===================================================================== */

if (!function_exists('ptf_storage_load_cfg')) {
    function ptf_storage_load_cfg() {
        $paths = [
            dirname(__DIR__, 2) . '/storage-config.php',
            dirname(__DIR__, 3) . '/storage-config.php',
            dirname(__DIR__) . '/storage-config.php',
        ];
        foreach ($paths as $p) {
            if (file_exists($p)) {
                $cfg = include $p;
                if (is_array($cfg)) return $cfg;
            }
        }
        return null;
    }

    function ptf_storage_normalize_cfg($cfg) {
        if (!is_array($cfg) || empty($cfg['endpoint']) || empty($cfg['bucket']) || empty($cfg['access_key']) || empty($cfg['secret_key']) || empty($cfg['region'])) return null;
        $cfg['endpoint'] = rtrim((string)$cfg['endpoint'], '/');
        if (!preg_match('#^https?://#i', $cfg['endpoint'])) $cfg['endpoint'] = 'https://' . $cfg['endpoint'];
        return $cfg;
    }

    function ptf_storage_safe_name($name) {
        $name = preg_replace('/[^\w\-\.\x{0600}-\x{06FF} ]/u', '_', (string)$name);
        $name = trim(str_replace(' ', '-', $name), '-_.');
        return $name !== '' ? $name : 'file';
    }

    function ptf_storage_safe_folder($folder) {
        $folder = preg_replace('/[^A-Za-z0-9_\-\/]/', '', (string)$folder);
        $folder = trim($folder, '/');
        return $folder !== '' ? $folder : 'general';
    }

    function ptf_storage_hmac($key, $data, $raw = true) { return hash_hmac('sha256', $data, $key, $raw); }

    function ptf_storage_signing_key($cfg, $date) {
        return ptf_storage_hmac(
            ptf_storage_hmac(
                ptf_storage_hmac(
                    ptf_storage_hmac('AWS4' . $cfg['secret_key'], $date),
                    $cfg['region']
                ),
                's3'
            ),
            'aws4_request'
        );
    }

    function ptf_storage_object_key($folder, $originalName) {
        return ptf_storage_safe_folder($folder) . '/' . date('Y-m') . '/' . uniqid('', true) . '-' . ptf_storage_safe_name($originalName);
    }

    /**
     * Streams a PHP upload temp file to S3 with AWS Signature V4.
     * @return array{ok:bool,key?:string,error?:string,http?:int}
     */
    function ptf_storage_put_uploaded_file($tmpPath, $key) {
        if (!is_file($tmpPath) || !is_readable($tmpPath)) return ['ok' => false, 'error' => 'فایل موقت آپلود در دسترس نیست'];
        if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'افزونه cURL روی هاست فعال نیست'];
        $cfg = ptf_storage_normalize_cfg(ptf_storage_load_cfg());
        if (!$cfg) return ['ok' => false, 'error' => 'پیکربندی فضای ابری یافت نشد'];

        $size = filesize($tmpPath);
        $max = max(1, (int)($cfg['max_mb'] ?? 25)) * 1048576;
        if ($size === false || $size > $max) return ['ok' => false, 'error' => 'حجم فایل از سقف فضای ابری بیشتر است'];

        $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
        if (!$host) return ['ok' => false, 'error' => 'endpoint فضای ابری نامعتبر است'];
        $now = gmdate('Ymd\THis\Z');
        $date = gmdate('Ymd');
        $scope = $date . '/' . $cfg['region'] . '/s3/aws4_request';
        $payloadHash = hash_file('sha256', $tmpPath);
        $uri = '/' . $cfg['bucket'] . '/' . str_replace('%2F', '/', rawurlencode($key));
        $headersCanonical = "host:$host\n" . "x-amz-content-sha256:$payloadHash\n" . "x-amz-date:$now\n";
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        $canonicalRequest = implode("\n", ['PUT', $uri, '', $headersCanonical, $signedHeaders, $payloadHash]);
        $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $now, $scope, hash('sha256', $canonicalRequest)]);
        $signature = ptf_storage_hmac(ptf_storage_signing_key($cfg, $date), $stringToSign, false);
        $auth = 'AWS4-HMAC-SHA256 Credential=' . $cfg['access_key'] . '/' . $scope . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;

        $fh = @fopen($tmpPath, 'rb');
        if (!$fh) return ['ok' => false, 'error' => 'باز کردن فایل موقت ناموفق بود'];
        $ch = curl_init($cfg['endpoint'] . $uri);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_UPLOAD => true,
            CURLOPT_INFILE => $fh,
            CURLOPT_INFILESIZE => (int)$size,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_CONNECTTIMEOUT => 12,
            CURLOPT_HTTPHEADER => [
                'Authorization: ' . $auth,
                'x-amz-content-sha256: ' . $payloadHash,
                'x-amz-date: ' . $now,
            ],
        ]);
        curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($fh);
        if ($http < 200 || $http >= 300) return ['ok' => false, 'error' => 'آپلود فضای ابری ناموفق بود' . ($err ? ': ' . $err : ' (HTTP ' . $http . ')'), 'http' => $http];
        return ['ok' => true, 'key' => $key, 'http' => $http];
    }
}
