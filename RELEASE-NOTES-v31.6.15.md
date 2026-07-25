# ریلیزنوت v31.6.15 — تکمیل token در sync pull (Production auth hotfix)

## دامنه

- ارسال `X-CRM-Token` در `data_pull`؛
- استفادهٔ مشترک push/pull از helper header؛
- جلوگیری از درخواست‌های 401 تکراری قبل از آماده‌شدن login token؛
- retry محدود و کنترل‌شده تا آماده‌شدن token؛
- حفظ enforcement سروری data push/pull؛
- بدون تغییر داده، schema یا policy مالی.

## فایل‌های تغییرکرده

- `crm/sync.js`
- `crm/index.html`
- `crm/sw.js`
- `_tools/uat/tester170-v3172-sync-auth.js`

## تست

- `tester170-v3172-sync-auth.js`: 6 PASS / 0 FAIL
- regression کامل پس از bump نسخه: ۱۴۷ فایل PASS / ۰ FAIL، ۳۷۰۳ چک PASS / ۰ FAIL
- audit: همهٔ بررسی‌ها PASS، بدون warning.

## محدودیت

FIN-WF-001 implementation کامل، policy چک شخصی و staging در این release تغییر نکرده‌اند؛ این hotfix فقط مسیر token موجود sync را کامل می‌کند.

## نسخه

- `VER v31.6.15`
- `CACHE ptf-crm-v31.6.15`
