<?php
/** PTF Auth — v33.0.0 security baseline */
require_once __DIR__ . '/secrets.php';

function auth_secret() {
    return load_ptf_secret('auth_key', '');
}

function auth_is_configured() {
    return is_string(auth_secret()) && strlen(auth_secret()) >= 32;
}

function auth_tokens_file() {
    $dir = __DIR__ . '/../crm/data';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    return $dir . '/tokens.json';
}

function auth_load_tokens() {
    $f = auth_tokens_file();
    if (!is_file($f)) return [];
    $fp = @fopen($f, 'rb');
    if (!$fp) return [];
    @flock($fp, LOCK_SH);
    $raw = stream_get_contents($fp);
    @flock($fp, LOCK_UN);
    fclose($fp);
    $tokens = json_decode((string)$raw, true);
    return is_array($tokens) ? $tokens : [];
}

function auth_save_tokens($tokens) {
    if (!is_array($tokens)) $tokens = [];
    $now = time();
    foreach ($tokens as $token => $info) {
        if (!is_array($info) || empty($info['exp']) || (int)$info['exp'] < $now) unset($tokens[$token]);
    }
    $file = auth_tokens_file();
    $tmp = $file . '.tmp.' . bin2hex(random_bytes(6));
    $json = json_encode($tokens, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false || @file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }
    return @rename($tmp, $file);
}

function auth_generate_token($username, $role) {
    $secret = auth_secret();
    if (strlen($secret) < 32) return false;
    $now = time();
    $exp = $now + 86400 * 7;
    $payload = trim((string)$username) . '|' . trim((string)$role) . '|' . $now . '|' . bin2hex(random_bytes(16));
    $signature = hash_hmac('sha256', $payload, $secret);
    $token = rtrim(strtr(base64_encode($payload . '|' . $signature), '+/', '-_'), '=');
    $tokens = auth_load_tokens();
    $tokens[$token] = [
        'user' => trim((string)$username),
        'role' => trim((string)$role),
        'iat' => $now,
        'exp' => $exp,
        'ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')
    ];
    return auth_save_tokens($tokens) ? $token : false;
}

function auth_verify_token($token) {
    $token = trim((string)$token);
    $secret = auth_secret();
    if ($token === '' || strlen($secret) < 32) return false;
    $raw = base64_decode(strtr($token, '-_', '+/'), true);
    if ($raw === false) {
        // URL-safe base64 may not include its padding.
        $padding = strlen($token) % 4;
        if ($padding) $raw = base64_decode(strtr($token, '-_', '+/') . str_repeat('=', 4 - $padding), true);
    }
    if ($raw === false) return false;
    $parts = explode('|', $raw);
    if (count($parts) !== 5) return false;
    [$user, $role, $iat, $nonce, $signature] = $parts;
    if ($user === '' || $role === '' || !ctype_digit($iat) || !preg_match('/^[a-f0-9]{32}$/', $nonce) || !preg_match('/^[a-f0-9]{64}$/', $signature)) return false;
    $payload = $user . '|' . $role . '|' . $iat . '|' . $nonce;
    if (!hash_equals(hash_hmac('sha256', $payload, $secret), $signature)) return false;
    $tokens = auth_load_tokens();
    if (!isset($tokens[$token]) || !is_array($tokens[$token])) return false;
    $info = $tokens[$token];
    if (empty($info['exp']) || (int)$info['exp'] < time()) return false;
    if (!hash_equals((string)($info['user'] ?? ''), $user) || !hash_equals((string)($info['role'] ?? ''), $role)) return false;
    return $info;
}

function auth_get_header_token() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = $headers['X-CRM-Token'] ?? $headers['x-crm-token'] ?? $_SERVER['HTTP_X_CRM_TOKEN'] ?? '';
    if (is_array($token)) $token = $token[0] ?? '';
    return trim((string)$token);
}
