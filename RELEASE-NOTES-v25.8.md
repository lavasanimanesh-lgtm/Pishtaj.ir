# ریلیزنوت v25.8 — ریشه‌کنی اختلال اتصال هوش مصنوعی و تشخیص دقیق Transport

## گزارش کارفرما
در تنظیمات CRM، پیکربندی Gemini و مدل `gemini-2.5-flash` نمایش داده می‌شد، اما «تست واقعی اتصال» با `HTTP 0` و پیام مبهمِ قطع شبکه/SSL شکست می‌خورد.

## Root Causeهای کشف‌شده در کد

1. **IPv4 اجباری:** `api/llm.php` برای تمام درخواست‌ها `CURLOPT_IPRESOLVE = V4` می‌گذاشت. این اجبار مسیرهای قابل استفادهٔ auto/IPv6 را حذف می‌کرد و روی برخی هاست‌ها به `HTTP 0` منجر می‌شود.
2. **خروجی debug مخرب:** دو `var_dump($quotaData)` در مسیر درخواست وجود داشتند و می‌توانستند JSON API را خراب کنند.
3. **Cache key نادرست:** cache با متغیرهای تعریف‌نشدهٔ `$sysPrompt`/`$userPrompt` ساخته می‌شد؛ در نتیجه پاسخ‌ها میان promptهای متفاوت تفکیک مطمئن نداشتند.
4. **ذخیرهٔ نادرست cache:** قبل از آماده‌شدن `$cleanBody`، مقدار نامعتبر در cache نوشته می‌شد.
5. **مصرف quota در failure:** تلاش ناموفق شبکه پیش از دریافت پاسخ، سهمیهٔ روزانه را کم می‌کرد.
6. **عیب‌یابی ناقص:** UI فقط یک تشخیص کلی نشان می‌داد و `curl_errno`، DNS/TLS/connect timeout و زمان‌های transport را نشان نمی‌داد.

## اصلاح انجام‌شده

- `ip_resolve` به حالت پیش‌فرض `auto` تغییر یافت؛ انتخاب صریح `v4` یا `v6` فقط از `llm-config.php` ممکن است.
- TLS verification اکنون به‌صورت پیش‌فرض فعال است (`tls_verify: true`) و نتیجهٔ آن در diagnostics قابل مشاهده است.
- تمام `var_dump`ها حذف شد.
- cache key اکنون از provider، model، system prompt، user prompt، MIME و hash فایل ورودی ساخته می‌شود.
- فقط پاسخ موفق، معتبر و parse‌شده در cache ذخیره می‌شود.
- سهمیهٔ روزانه فقط پس از پاسخ موفق کم می‌شود.
- تست اتصال cache را دور می‌زند و هر بار ping واقعی انجام می‌دهد.
- پاسخ تست شامل metadata امن transport است: hostname، `curl_errno`، متن cURL، mode IP، زمان DNS/connect/total و TLS verify result؛ API key و URL دارای key نمایش داده نمی‌شوند.
- UI در صورت JSON نامعتبر نیز متن خام کنترل‌شده را نمایش می‌دهد تا debug output یا خطای PHP با «خطای شبکه» اشتباه نشود.
- markup معیوب header صفحهٔ تنظیمات نیز اصلاح شد.
- `llm-config.sample.php` و `DOCS-LLM-SETUP.md` اضافه شدند.

## فایل‌های تغییرکرده

- `api/llm.php`
- `crm/index.html`
- `crm/sw.js`
- `crm/theme-contrast.js` (همگام‌سازی version)
- `llm-config.sample.php` — جدید
- `DOCS-LLM-SETUP.md` — جدید
- `_tools/uat/tester138-v257.js` — همگام‌سازی نسخهٔ dark-theme
- `_tools/uat/tester139-v258-llm.js` — جدید
- `INSTALL-GUIDE.md` و `PTF-MASTER-HANDOVER.md`

## تست‌های انجام‌شده

- Syntax تمام 64 اسکریپت production-loaded CRM: **PASS / 0 failure**
- `tester138-v257.js` (dark theme): **21 PASS / 0 FAIL**
- `tester139-v258-llm.js` (LLM transport/cache): **14 PASS / 0 FAIL**
- `python3 _tools/audit.py`: بدون error؛ فقط هشدار قدیمی تصاویر سنگین سایت باقی است.
- محیط بررسی PHP CLI ندارد؛ بنابراین lint/runtime test PHP و تماس واقعی با provider روی این محیط اجرا نشد.

## تست کارفرما پس از استقرار

1. فایل `llm-config.php` را طبق `DOCS-LLM-SETUP.md` خارج از `public_html` نگه دارید.
2. وارد CRM شوید: تنظیمات → هوش مصنوعی → «تست واقعی بدون cache».
3. در صورت success، یک ترجمه یا OCR واقعی کوتاه را نیز تست کنید.
4. در صورت failure، screenshot یا متن بخش «جزئیات امن ارتباط هاست» را ارسال کنید. این بخش دقیقاً مشخص می‌کند مشکل DNS (`errno 6`)، اتصال/firewall (`7`)، timeout (`28`)، TLS (`35/60/77`) یا خطای provider/quota است.

## محدودیت روشن

اگر `curl_errno` نشان دهد outbound HTTPS، DNS یا منطقهٔ IP هاست توسط provider مسدود است، آن بخش با تغییر کد داخل CRM به‌تنهایی حل نمی‌شود؛ با این release علت دقیق قابل اثبات است و مسیر تنظیم یا درخواست لازم از هاست مشخص می‌شود.
