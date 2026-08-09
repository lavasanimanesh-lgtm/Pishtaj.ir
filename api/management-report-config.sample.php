<?php
/**
 * PTF CRM — تنظیمات گزارش مدیریتی خودکار
 * این فایل را به management-report-config.php تغییرنام دهید و خارج از public_html قرار دهید.
 * مثال: /home/USERNAME/management-report-config.php
 */
return [
    // آدرس پایه CRM برای لینک امن در پیامک؛ کاربر پس از ورود گزارش را در تحلیلگر می‌بیند.
    'crm_url' => 'https://pishtaj.ir/crm/#anl',

    // مسیر Chromium/Chrome. ابتدا با دستورهای راهنما در MANAGEMENT-REPORT-CRON-GUIDE.md بررسی کنید.
    // نمونه‌ها: /usr/bin/chromium | /usr/bin/chromium-browser | /usr/bin/google-chrome
    'chromium_bin' => '',

    // مسیر دادهٔ CRM؛ معمولاً نیازی به تغییر ندارد.
    'data_dir' => __DIR__ . '/public_html/crm/data',

    // دریافت‌کنندگان بر اساس نقش یا شمارهٔ صریح. شمارهٔ صریح برای شرایطی که users server-side کامل نیست مفید است.
    'recipients' => [
        'weekly' => ['roles' => ['ceo', 'commercial'], 'mobiles' => []],
        'monthly' => ['roles' => ['admin', 'chairman', 'ceo', 'commercial', 'accountant'], 'mobiles' => []],
        'quarterly' => ['roles' => ['admin', 'chairman', 'ceo', 'commercial', 'accountant'], 'mobiles' => []],
        'annual' => ['roles' => ['admin', 'chairman', 'ceo', 'accountant'], 'mobiles' => []],
    ],

    // متن پیامک؛ {period} و {kind} توسط سیستم جایگزین می‌شوند.
    'sms_template' => 'گزارش مدیریتی {kind} برای دوره {period} آماده شد. مشاهده امن پس از ورود به CRM: {url}',
];
