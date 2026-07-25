<?php
/**
 * نمونهٔ پیکربندی LLM برای PTF CRM
 *
 * 1) این فایل را با نام llm-config.php ذخیره کنید.
 * 2) آن را خارج از public_html قرار دهید؛ نمونه:
 *    /home/USERNAME/llm-config.php
 * 3) فقط key واقعی را روی سرور وارد کنید؛ هرگز آن را در ZIP، Git یا چت قرار ندهید.
 */
return [
    // gemini | openai
    'provider' => 'gemini',

    // Gemini API key یا کلید provider سازگار با OpenAI
    'key' => 'PASTE_KEY_ON_SERVER_ONLY',

    // برای Gemini:
    'model' => 'gemini-2.5-flash',
    'gemini_base' => 'https://generativelanguage.googleapis.com/v1beta',
    'fallback_models' => ['gemini-2.5-flash-lite'],

    // auto توصیه می‌شود. نسخهٔ قبلی CRM IPv4 را اجباری می‌کرد.
    // مقادیر مجاز: auto | v4 | v6
    'ip_resolve' => 'auto',

    // TLS باید در production فعال بماند.
    'tls_verify' => true,
    'connect_timeout' => 15,
    'timeout' => 90,

    // اگر provider = openai است، gemini_base را حذف و base معتبر خود را قرار دهید:
    // 'base' => 'https://api.openai.com/v1',
];
