# RCA نمایش‌ندادن سند در Viewer — v34.4.36

## نشانه

- آپلود سند موفق بود.
- با «مشاهده»، تصویر/PDF در مودال لود نمی‌شد.
- «تب جدید» به‌جای نمایش سند، پنجرهٔ Save As/انتخاب مسیر فایل سیستم را باز می‌کرد.

## علت ریشه‌ای

مسیر fallback آپلود `browser → PHP → S3` فایل را بدون metadataهای `Content-Type` و `Content-Disposition: inline` در آروان ذخیره می‌کرد. S3 آن را با `application/octet-stream` یا disposition دانلود برمی‌گرداند؛ بنابراین `<img>`/`iframe` قادر به نمایش نبود و تب جدید رفتار دانلود داشت.

## اصلاح

1. تعیین MIME از پسوند امن در `api/storage.php`.
2. ثبت `Content-Type` و `Content-Disposition: inline` در هر دو مسیر PUT مستقیم و proxy.
3. افزودن `response-content-type` و `response-content-disposition` به URL امضاشدهٔ GET؛ در نتیجه فایل‌های قدیمی نیز بدون آپلود مجدد قابل نمایش‌اند.
4. افزودن حالت binary `inline` به `api/attachment-read.php` برای raster image/PDF.
5. Viewer ابتدا فایل را با توکن از endpoint هم‌دامنه می‌گیرد و Blob URL با MIME صحیح می‌سازد؛ «تب جدید» نیز همان Blob را باز می‌کند و دیگر Save As ناخواسته ندارد.
6. SVG/HTML عمداً از origin برنامه به‌صورت inline سرو نمی‌شوند تا XSS ایجاد نشود.
7. Blob URL هنگام بستن viewer آزاد می‌شود.

## تست

- `_tools/uat/tester330-v34.4.36-inline-attachment-view.js` — PASS
- تست‌های ضمیمه و دسته‌چک قبلی — PASS
- version/cache contract — `v34.4.36`
