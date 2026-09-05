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

    /* v34.36.2 (AI-JSON-REPAIR): در مدل‌های استدلالیِ Gemini (2.5x) «فکر کردن» از همان
       سقف maxOutputTokens خرج می‌شود؛ وقتی سقف کم باشد پاسخ JSON ناتمام می‌ماند و خطای
       «خروجی AI ساختار JSON معتبر ندارد» دیده می‌شد. در v34.36.2 سقف توکن اکشن‌های سئو
       بالا رفت، JSON بریده تعمیر می‌شود و یک تلاش دوباره با توکن دوبرابر انجام می‌گیرد.
       اگر باز هم این خطا را دیدید، خط زیر را از کامنت بیرون بیاورید تا بودجهٔ
       «فکرکردن» محدود شود (۰ = بدون فکرکردن، سریع‌تر و ارزان‌تر).
       پیش‌فرض: این فیلد ارسال نمی‌شود ⇒ رفتار فعلی کاملاً دست‌نخورده است. */
    // 'gemini_thinking_budget' => 0,

    // اگر provider = openai است، gemini_base را حذف و base معتبر خود را قرار دهید:
    // 'base' => 'https://api.openai.com/v1',
];
