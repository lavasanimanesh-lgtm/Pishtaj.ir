<?php
/**
 * PTF Security Baseline v33.0.0
 * Secrets are loaded only from a configuration file outside the document root.
 * Production and staging must use separate files and separate values.
 */

function ptf_runtime_environment() {
    $forced = strtolower(trim((string)(getenv('PTF_ENV') ?: '')));
    if (in_array($forced, ['staging', 'production'], true)) return $forced;
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    return (strpos($host, 'staging.') === 0 || strpos($host, '.staging.') !== false) ? 'staging' : 'production';
}

function ptf_secret_config_paths() {
    $env = ptf_runtime_environment();
    $name = $env === 'staging' ? 'ptf-secrets.staging.php' : 'ptf-secrets.php';
    $roots = array_values(array_unique([
        dirname(__DIR__, 2),
        dirname(__DIR__, 3),
    ]));
    $paths = [];
    foreach ($roots as $root) {
        if ($root && $root !== DIRECTORY_SEPARATOR) $paths[] = rtrim($root, '/\\') . DIRECTORY_SEPARATOR . $name;
    }
    return $paths;
}

function ptf_load_secrets_config() {
    static $loaded = false;
    static $config = null;
    if ($loaded) return $config;
    $loaded = true;
    foreach (ptf_secret_config_paths() as $path) {
        if (!is_file($path) || !is_readable($path)) continue;
        $candidate = @include $path;
        if (is_array($candidate)) {
            $config = $candidate;
            return $config;
        }
    }
    return $config;
}

function load_ptf_secret($key, $default = '') {
    $config = ptf_load_secrets_config();
    if (is_array($config) && array_key_exists($key, $config)) {
        $value = $config[$key];
        if (is_string($value) || is_numeric($value)) return trim((string)$value);
    }
    return $default;
}

function ptf_has_secret($key, $minLength = 32) {
    $value = load_ptf_secret($key, '');
    return is_string($value) && strlen($value) >= $minLength;
}

function ptf_json_error($status, $code, $message) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'error' => $code, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
