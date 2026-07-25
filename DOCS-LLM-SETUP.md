# راهنمای راه‌اندازی و عیب‌یابی LLM CRM

## محل امن فایل تنظیمات

فایل `llm-config.php` باید **خارج از `public_html`** قرار بگیرد؛ مثال:

```text
/home/USERNAME/llm-config.php
```

از `llm-config.sample.php` در ریشهٔ بسته به‌عنوان الگو استفاده کنید. کلید واقعی API نباید در ZIP، Repository، ایمیل یا چت قرار بگیرد.

## پیکربندی Gemini پیشنهادی

- `provider`: `gemini`
- `model`: `gemini-2.5-flash`
- `gemini_base`: `https://generativelanguage.googleapis.com/v1beta`
- `ip_resolve`: `auto`
- `tls_verify`: `true`

حالت `auto` مهم است؛ نسخه‌های قدیمی CRM IPv4 را اجباری می‌کردند. اگر دیتاسنتر روی یکی از مسیرهای IP مشکل داشته باشد، اجبار IPv4 می‌تواند به `HTTP 0` منجر شود.

## تست واقعی پس از استقرار

در CRM به مسیر **تنظیمات → هوش مصنوعی** بروید و دکمهٔ «تست واقعی بدون cache» را بزنید. این تست یک ping واقعی می‌فرستد و cache را دور می‌زند؛ پس وضعیت سبز بخش تنظیمات به‌تنهایی به معنی اتصال واقعی نیست.

در صورت خطا، پنل این اطلاعات بدون افشای API key نشان می‌دهد:

- hostname مقصد
- `curl_errno` و متن خطای cURL
- حالت IP (`auto` / `v4` / `v6`)
- زمان DNS، اتصال و کل درخواست
- نتیجهٔ اعتبارسنجی TLS

## تفسیر خطاهای رایج

| نشانه | معنی و اقدام |
|---|---|
| `curl_errno: 6` | DNS هاست hostname Google/provider را resolve نمی‌کند؛ پشتیبانی هاست DNS resolver و outbound DNS را بررسی کند. |
| `curl_errno: 7` | اتصال TCP به پورت 443 برقرار نشده؛ درخواست بازشدن outbound HTTPS به hostname مقصد بدهید. |
| `curl_errno: 28` | timeout شبکه؛ route، firewall یا کیفیت شبکهٔ سرور را بررسی کنید. |
| `curl_errno: 35` | TLS handshake ناموفق است؛ نسخهٔ OpenSSL/cURL یا proxy HTTPS هاست را بررسی کنید. |
| `curl_errno: 60` یا `77` | CA bundle یا اعتبار گواهی روی هاست مشکل دارد؛ CA/cURL/OpenSSL باید اصلاح شود. |
| HTTP 400 / API key | کلید یا payload نامعتبر است؛ key و نام مدل را بازبینی کنید. |
| HTTP 404 | نام مدل یا endpoint نادرست/منسوخ است. |
| HTTP 429 | quota یا billing provider تمام شده است. |
| `FAILED_PRECONDITION` / location | IP هاست در منطقهٔ پشتیبانی‌شدهٔ provider نیست؛ سرور/IP یا provider مجاز جایگزین لازم است. |

## نکات امنیتی

- `tls_verify` را در production روی `true` نگه دارید. خاموش کردن TLS verification فقط ممکن است برای تشخیص کوتاه‌مدت استفاده شود و راه‌حل production نیست.
- در صورت استفاده از provider سازگار با OpenAI، `provider` را `openai` و `base` را روی endpoint مجاز provider قرار دهید.
- endpoint باید از سرور هاست قابل دسترس باشد؛ اتصال کاربر ایرانی به مرورگر معیار اتصال سرور به provider نیست.
