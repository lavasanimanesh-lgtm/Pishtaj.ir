# ریلیزنوت v31.6.23 — رفع فوری واگرایی sync بین browser/device

## ۱) RCA
در `sync.js`، startup فقط زمانی pull کامل انجام می‌داد که `serverRev > localStorage.ptf_sync_rev` باشد. دو browser/device می‌توانستند cached revision یکسان اما localStorage متفاوت داشته باشند؛ در این حالت سیستم local را fresh فرض می‌کرد و هیچ snapshot جدیدی از server نمی‌گرفت. نتیجه: تعداد درخواست‌ها و پیشنهادها در Chrome/Firefox یا دستگاه‌های مختلف متفاوت می‌ماند.

## ۲) فایل‌های تغییرکرده

- `crm/sync.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester178-v323-sync-divergence.js`
- `BACKLOG-PRIORITIZED-CURRENT-v31.6.23.md`
- `RELEASE-NOTES-v31.6.23.md`
- `REGRESSION-REPORT-v31.6.23.md`
- `SPRINT-1-DELIVERABLE-STAGE0-v31.6.23.md`
- `STAGE-0-BASELINE-MANIFEST-v31.6.23.txt`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md`

## ۳) تغییر و دامنهٔ اثر

- startup با هر server revision مثبت، یک full pull با `since=0` انجام می‌دهد؛
- startup دیگر به cached `ptf_sync_rev` برای اعلام fresh بودن اعتماد نمی‌کند؛
- polling عادی ۲۰ثانیه‌ای همچنان incremental باقی می‌ماند؛
- retry احراز هویت، `forceFull` را حفظ می‌کند؛
- server snapshot قبل از bootstrapped شدن کلاینت اعمال می‌شود؛
- هیچ reset، migration یا حذف داده انجام نشده است.

## ۴) regression و audit

- `tester178-v323-sync-divergence.js`: **۹ PASS / ۰ FAIL**؛ تست RCA و startup full pull؛
- full regression: **۱۵۵ فایل PASS / ۰ FAIL، ۳۷۶۸ چک PASS / ۰ FAIL**؛
- `python3 _tools/audit.py`: **PASS، بدون warning**؛
- `node --check crm/sync.js`: PASS؛
- PHP syntax محلی اجرا نشد چون binary `php` در sandbox موجود نیست.

## ۵) Evidence قابل استناد

tester178 این سناریوها را کنترل می‌کند:

1. دو browser با revision یکسان اما localStorage متفاوت، full snapshot می‌گیرند؛
2. browser با revision قدیمی full snapshot می‌گیرد؛
3. server خالی همچنان مسیر seed را حفظ می‌کند؛
4. API در pull کامل `data` و `meta` را برمی‌گرداند؛
5. forceFull در retry احراز هویت گم نمی‌شود.

## ۶) مراحل verification کارفرما

1. در Chrome و Firefox با یک کاربر وارد شوید.
2. مقدار `ptf_sync_rev` و دادهٔ local هر دو browser را بررسی کنید.
3. در یکی از browserها یک درخواست یا پیشنهاد ثبت کنید.
4. browser دوم را کامل reload کنید.
5. قبل از نمایش dashboard، باید snapshot server دریافت شود.
6. تعداد درخواست‌ها و پیشنهادها را در هر دو browser مقایسه کنید.
7. همین تست را روی یک دستگاه دیگر انجام دهید.
8. در صورت تفاوت، network log درخواست `data_pull?since=0` و response `rev/data/meta` را ذخیره کنید.

## ۷) approval و محدودیت

این تغییر hotfix مستقیم برای data consistency و بدون migration یا تغییر auth مالی است؛ approval پیشینی refactor لازم نشد. server-side session/RBAC/CSRF و FIN-WF-001 همچنان به staging مستقل وابسته‌اند.

## نسخه

- `VER v31.6.23`
- `CACHE ptf-crm-v31.6.23`
