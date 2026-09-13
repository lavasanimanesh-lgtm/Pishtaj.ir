# CRM v34.38.21 — ADV-CV-SERVER-SIDE-PDF

**تاریخ:** 2026-09-13
**بازوی تغییر:** Arena Agent
**کانال:** CRM + ابزارهای پیشرفته (ADV-CV)

> این فایل همان «یادداشت انتشار نسخهٔ جاری» است که گیت CI (تستر۵۷۸، سطر ۷۹) وجودش را
> با کلید `VERSION.json → crm_version` کنترل می‌کند.

## ۱) درخواست کارفرما

در بررسی ابزارهای پیشرفته (۲۰۲۶-۰۹-۱۲)، مورد P1 رسمی بک‌لاگ
(`ADV-CV-FINALIZATION-BACKLOG-v31.7.97.md`): «PDF باینری سمت سرور — نیازمند
کتابخانهٔ PDF روی سرور». خروجی نهایی ADV-CV فقط HTML بود (Print/Save-as-PDF با
مرورگر). حالا خروجی رسمی **PDF باینری واقعی، سمت سرور** ساخته می‌شود.

## ۲) چه اضافه شد

### تولید (best-effort در لحظهٔ Issue + idempotent برای بعد)
- `admin_report_final_issue`: بلافاصله پس از صدور موفق، تلاشِ رندر PDF با
  wkhtmltopdf انجام می‌شود. اگر نصب نباشد/اشکال بکند، **فقط**
  `finalMeta.pdfError` پر می‌شود — گزارش صادرشده **هیچ‌وقت** بازمی‌گردد
  (کووتا/نوبت‌شمارنده همان قانون همیشگی؛ PDF «دارد ساخته می‌شود/دوباره تلاش
  شود»).
- `admin_report_final_pdf_generate`: تولید idempotent — برای گزارش‌های
  صادرشدهٔ پیش از این نسخه هم از همان دکمهٔ «📥 تولید PDF سروری» می‌سازد.
  پیش از هر رندر، سازگاری `finalHtml` با `finalReport.htmlChecksum` از
  `admin_report_final_get` اثبات می‌شود (تولید از منبع دست‌نخورده —
  `pdf_source_integrity_mismatch`).
- رندر: `proc_open` با ۳۰ ثانیهٔ مهلت؛ آرگومان‌ها ثابت و audit شده:
  `--quiet --no-progress --encoding UTF-8 --page-size A4 --margin-… 10/12mm
  --javascript-delay 200 --print-media-type --enable-local-file-access --allow
  <tmpdir>` + همهٔ مسیرها با `escapeshellarg`.

### امنیت
- PDFها در `crm/data/tool_report_pdfs/` و رندر در `crm/data/tool_pdf_tmp/` —
  هر دو با `.htaccess` **Deny from all**؛ هیچ URL مستقیمی به آن‌ها وجود ندارد.
- `--allow` فقط دایرکتوری موقتِ همان رندر (دسترسی به بقیهٔ فایل‌های سرور
  بسته)؛ `--disable-glyph` خیر — UTF-8 فارسی صحیح.
- نام فایل: `ADV-CV-<reportNo sanitize‌شده>.pdf` — کاراکترهای
  `[^A-Za-z0-9_.-]` به `_` (test‌شده: path-traversal حذف می‌شود).
- استریم: `admin_report_final_pdf_get` فقط با توکن معتبر (401)، فقط اگر
  `serverPdf=true` (404)، و **پیش از استریم** `hash_file(sha256)` باید با
  `pdfChecksum` ذخیره‌شده یکسان باشد (500 `pdf_integrity_mismatch` —
  fail-closed). هدرها: `Content-Type: application/pdf`،
  `Content-Disposition: attachment; filename="…"`، `Cache-Control: no-store`.

### دیدbarkeit
- `admin_report_pdf_status` (admin/crm): وضعیت زندهٔ نصب + نسخهٔ باینری +
  مسیر. در **gate نهایی ADV-CV** نمایش می‌شود (چک‌لیستِ نصب در همان جایی
  که «صدور بلاک می‌شود»)؛ در **CRM > پیشرفته‌ها** برچسب «PDF سروری: فعال/غیرفعال».
- UI گزارش‌های پیشرفته: دکمهٔ «📥 تولید PDF سروری» (idempotent) +
  «📄 دانلود PDF سرور» (فقط اگر ساخته شده باشد) + «🖨 دانلود HTML (Print/Save
  as PDF)» + نوار وضعیت (ساخته‌شده/ناموفق/در انتظار). دانلود با blob
  توکندار — بدون ذخیرهٔ توکن در URL.

### نصب روی هاست
`_tools/host/install-wkhtmltopdf.sh` — idempotent، فقط apt/Dpkg (بدون
آرگومان اضافی)، دانلود wkhtmltox-patched-Qt از release‌های GitHub (با SHA256
از release asset)، تنظیم `PTF_WKHTMLTOPDF_BIN` در `/etc/profile.d/ptf-wkhtmltopdf.sh`،
و خروجی `VERIFY: OK` فقط با موفقیت.

## ۳) سازگاری و نسخه
- تمام نقاط رسمی نسخه → v34.38.21 (VERSION.json، manifest، sw.js،
  index.html و کوئری‌های `?v=`، sales-domain.php، clear-cache.html، shell.js،
  cms.js، device-reconnect.html) + pinهای ۱۳۰ تستر با
  `_tools/uat/bump-version-pins.js 34.38.20`. همزمانی را arch-guard (A6) و
  tester489/512 کنترل می‌کنند.
- قرارداد نسخه: **tester656** (CI gate) — شامل زنجیرهٔ رفتاری واقعی PHP
  (با باینری جعلی wkhtmltopdf روی PATH — فقط در محیط بدون `ptf-secrets.php` واقعی):
  status → generate → get + دستکاری فایل → 500 fail-closed + 401.
- هیچ رفتاریِ موجود تغییر نکرده: HTML گزارش نهایی، کووتا، نوبت‌شمارنده،
  آرشیو، و همهٔ اکشن‌های پیشین دست‌نخورده‌اند. صدور PDF یک **لایهٔ اضافه**
  است که شکستش هیچ‌وقت صادرکردن گزارش را مختل نمی‌کند.
