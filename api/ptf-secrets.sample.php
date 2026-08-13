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

    // Preferred admin hash (PHP password_hash / bcrypt or argon2).
    // Generate: php -r "echo password_hash('YOUR_STRONG_PASSWORD', PASSWORD_DEFAULT), PHP_EOL;"
    'admin_password_hash' => '',

    // Legacy admin hash (SHA-256). Kept only so the next login still works.
    // Generate: php -r "echo hash('sha256', 'YOUR_STRONG_PASSWORD'), PHP_EOL;"
    // After switching to admin_password_hash, leave this empty.
    'admin_sha256' => 'PUT_SHA256_OF_REAL_ADMIN_PASSWORD_HERE',

    // Backward-compatible name used by older deployments. Keep equal to admin_sha256 during migration.
    'default_admin_hash' => 'PUT_SHA256_OF_REAL_ADMIN_PASSWORD_HERE',

    // Captcha secret key, min 32 random chars.
    'captcha_key' => 'CHANGE_ME_RANDOM_CAPTCHA_KEY_64_CHARS',

    // Key for server-only dangerous maintenance actions, min 32 random chars.
    // This key must never be sent by browser JavaScript.
    'sensitive_action_key' => 'CHANGE_ME_RANDOM_SENSITIVE_ACTION_KEY_64_CHARS',
];
