<?php
/**
 * PTF CRM Secrets Configuration — v33.0.1
 *
 * SECURITY: copy this file to ptf-secrets.php and store it OUTSIDE webroot.
 * Example: /home/USERNAME/ptf-secrets.php (next to public_html, not inside it).
 * Never include the real file in ZIP/Git/chat.
 */

return [
    // Auth token signing key — REQUIRED, min 32 random chars.
    'auth_key' => 'CHANGE_ME_RANDOM_64_CHARS_MINIMUM_FOR_PRODUCTION',

    // Default/server admin password hash (SHA-256 of the real admin password).
    // Generate locally: php -r "echo hash('sha256', 'YOUR_STRONG_PASSWORD'), PHP_EOL;"
    // Do NOT keep the old demo password in production.
    'admin_sha256' => 'PUT_SHA256_OF_REAL_ADMIN_PASSWORD_HERE',

    // Backward-compatible name used by older deployments. Keep equal to admin_sha256 during migration.
    'default_admin_hash' => 'PUT_SHA256_OF_REAL_ADMIN_PASSWORD_HERE',

    // Captcha secret key, min 32 random chars.
    'captcha_key' => 'CHANGE_ME_RANDOM_CAPTCHA_KEY_64_CHARS',

    // Key for server-only dangerous maintenance actions, min 32 random chars.
    // This key must never be sent by browser JavaScript.
    'sensitive_action_key' => 'CHANGE_ME_RANDOM_SENSITIVE_ACTION_KEY_64_CHARS',
];
