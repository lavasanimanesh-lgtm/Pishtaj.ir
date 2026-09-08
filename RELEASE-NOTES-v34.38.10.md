# CRM v34.38.10

## همگام‌سازی snapshot

- قرارداد integrity برای `data_pull` با snapshot ID، revision، فهرست keyها، تعداد، اندازه و checksum اضافه شد.
- bootstrap کامل از مسیر manifest/chunk با staging، اعتبارسنجی و commit کنترل‌شده انجام می‌شود.
- chunkها به revision ثابت متصل هستند و در تغییر snapshot یا خطای شبکه retry/backoff می‌شوند.
- پاسخ ناقص، key ناشناخته یا payload با count/size نادرست پیش از projection رد می‌شود.
- مسیر delta روزمره و merge/dirty فعلی حفظ شده است.

## اصلاحات دیگر

- `collection_query` دیگر پارامتر `action` را به‌عنوان فیلتر رکورد اعمال نمی‌کند.
- cache-buster و Service Worker به نسخهٔ `34.38.10` ارتقا یافتند.
