# ریلیزنوت v31.6.16 — فعال‌سازی ماژول مازاد پروژه (US-436 light)

## دامنه

- فعال‌شدن `surplus.js` در runtime؛
- route و دسترسی «مازاد پروژه» برای فروش/خرید؛
- اضافه‌شدن `ptf_crm_surplus` به sync، backup و API whitelist؛
- استفاده از `getData/setData` برای همگام‌سازی؛
- فیلتر جستجوی واقعی؛
- lifecycle سبک `available/reserved/sold` با مقدارهای `reservedQty/soldQty`؛
- حفظ `prodCd`, `sourceDealCd` و `sourceSurplusCd`؛
- حذف polling `setInterval` از hook مازاد؛
- بدون انبار کامل، انتقال بین انبارها یا شمارش دوره‌ای.

## فایل‌های تغییرکرده

- `crm/surplus.js`
- `crm/index.html`
- `crm/rbac.js`
- `crm/sync.js`
- `crm/backup.js`
- `api/crm.php`
- `crm/sw.js`
- `_tools/uat/tester171-v3173-surplus-light.js`

## تست

- `tester171-v3173-surplus-light.js`: 7 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۸ فایل PASS / ۰ FAIL، ۳۷۱۰ چک PASS / ۰ FAIL
- audit: همهٔ بررسی‌ها PASS، بدون warning.

## محدودیت

این release فقط US-436 سبک برای مازاد پروژه است؛ انبار کامل در scope نیست. US-437، FIN-WF-001، policy چک شخصی و staging خارج از دامنه‌اند.

## نسخه

- `VER v31.6.16`
- `CACHE ptf-crm-v31.6.16`
