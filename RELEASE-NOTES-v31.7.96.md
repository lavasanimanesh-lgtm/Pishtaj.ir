# Release Notes — v31.7.96

## عنوان ریلیز
**BUG-SYNC-TOMBSTONE-OPPO-LINECHART-001**

## RCA / دلیل دقیق
کارفرما پرسید اگر یک کاربر پیشنهادی را حذف کند، آیا ممکن است دستگاه دیگری که هنوز آن پیشنهاد را در cache دارد، با sync دوباره آن را به سرور برگرداند؟ پاسخ قبل از این ریلیز: در بعضی سناریوهای stale cache و conflict merge، بله امکان ریسک بازگشت رکورد حذف‌شده وجود داشت، چون merge داده‌ها، حذف را مثل یک tombstone عمومی برای همه keyها enforce نمی‌کرد. فقط برای avatarها tombstone اختصاصی وجود داشت.

همچنین سوال شد آیا پیشنهاد مالی با وضعیت «بازنده» از فرصت‌های فعال حذف می‌شود؟ نمای فرصت‌های مالی فعال قبلاً CO/TCهای lost را حذف می‌کرد، اما نمای عمومی فرصت‌ها اگر همه پیشنهادهای مالی یک درخواست lost بودند، ممکن بود همچنان گروه درخواست را به‌عنوان فرصت نشان دهد.

در مورد گزارش کنترل ولو نیز درخواست شد خروجی شبیه‌تر به شیت‌های مهندسی و دارای نمودار خطی باشد. گزارش واقعی bar/SVG chart داشت؛ در این نسخه line chart هم اضافه شد.

## تغییرات اصلی

### 1) Tombstone Sync برای جلوگیری از بازگشت رکورد حذف‌شده
Client-side در `crm/sync.js`:
- `ptfApplyDeletionTombstones(key, jsonStr, extraArchiveStr)` اضافه شد.
- push / pull / conflict merge / beacon قبل از ارسال یا اعمال داده، tombstoneها را اعمال می‌کنند.

Server-side در `api/crm.php`:
- `sync_apply_tombstones()` اضافه شد.
- `data_push` قبل از ذخیره، داده ورودی stale را با `ptf_crm_deleted_archive` فیلتر می‌کند.
- `data_pull` نیز داده‌های خروجی را با tombstoneها فیلتر می‌کند.
- حتی اگر مرورگر قدیمی رکورد حذف‌شده را push کند، سرور آن را ذخیره نمی‌کند.

### 2) فرصت‌های فعال و پیشنهاد بازنده
در `crm/oppo.js`:
- اگر همه پیشنهادهای مالی CO/TC یک درخواست lost/archived باشند، آن درخواست دیگر در فرصت فعال نمایش داده نمی‌شود.
- بنابراین تغییر وضعیت یک پیشنهاد مالی به بازنده، در صورتی که پیشنهاد مالی فعال دیگری برای همان درخواست باقی نمانده باشد، فرصت را از active opportunities خارج می‌کند.

### 3) نمودار خطی در گزارش کنترل ولو
در `api/tools.php`:
- `tools_chart_line_svg()` اضافه شد.
- گزارش نهایی اکنون علاوه بر bar chart، line chart دارد:
  - Flow vs Cv line chart
  - Flow vs opening line chart

در `tools/advanced-tools-ui.js`:
- نمونه عمومی گزارش نیز line chart دارد.

## فایل‌های تغییرکرده

```text
crm/sync.js
api/crm.php
crm/oppo.js
api/tools.php
tools/advanced-tools-ui.js
crm/index.html
crm/sw.js
crm/clear-cache.html
_tools/uat/tester274-sync-tombstone-oppo-linechart.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester274-sync-tombstone-oppo-linechart.js` اضافه شد.
- این تست runtime نشان می‌دهد tombstone رکورد حذف‌شده را از merge حذف می‌کند.
- تست می‌کند پیشنهاد lost از فرصت فعال حذف شود.
- تست می‌کند گزارش کنترل ولو line chart داشته باشد.
