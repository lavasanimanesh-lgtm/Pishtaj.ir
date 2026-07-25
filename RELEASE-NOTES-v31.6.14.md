# ریلیزنوت v31.6.14 — بهینه‌سازی تصاویر و رفع هشدار audit

## دامنه

- فشرده‌سازی loss-aware تصاویر سنگین؛
- حفظ نسبت تصویر و کاربرد تصاویر؛
- کاهش حجم `bot-logo` و تصاویر hero؛
- حذف هشدار تصاویر بزرگ‌تر از سقف audit؛
- بدون تغییر workflow، داده، schema یا API.

## فایل‌های تغییرکرده

- `assets/images/bot-logo.png`
- `assets/images/bot-logo-640.png`
- `assets/images/electrical-instrumentation.jpg`
- `assets/images/hero-refinery.jpg`
- `assets/images/power-steel-plant.jpg`
- `assets/images/real/real-electrical-substation.jpg`
- `assets/images/real/real-manufacturing-line.jpg`
- `assets/images/real/real-steel-plant.jpg`
- `crm/index.html`
- `crm/sw.js`

## تست

- regression کامل: 146 فایل PASS / 0 FAIL، 3697 چک PASS / 0 FAIL.
- audit: همه بررسی‌ها PASS، بدون warning.

## محدودیت

FIN-WF-001، policy چک شخصی، staging و workflowهای مالی در این release تغییر نکرده‌اند.

## نسخه

- `VER v31.6.14`
- `CACHE ptf-crm-v31.6.14`
