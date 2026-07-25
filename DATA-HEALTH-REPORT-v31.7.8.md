# 🏥 گزارش سلامت داده‌ها و بک‌آپ — v31.7.8

**تاریخ ممیزی:** ۱۴۰۵/۰۴/۲۸ (2026-07-19)  
**نسخه:** v31.7.8

---

## ✅ خلاصه وضعیت

| بخش | وضعیت | توضیح |
|------|--------|-------|
| هماهنگی کلیدهای sync (بک‌اند ↔ فرانت‌اند) | ✅ **۴۸/۴۸ مطابقت** | صفر اختلاف |
| پوشش backup نسبت به sync | ✅ **۴۸/۴۸ + ۱ کلید کاربران** | `ptf_crm_users` اضافی عمدی |
| مکانیزم JWT/احراز هویت | ✅ سالم | توکن‌های منقضی خودکار پاک می‌شوند |
| سپر ضد داده‌صفر (سرور) | ✅ فعال | push خالی روی ناخالی رد می‌شود |
| سپر بک‌آپ (قرنطینه) | ✅ فعال | افت >۵۰٪ → suspect-* |
| جلوگیری از Race Condition (flock) | ✅ فعال | meta.json قفل اتمیک |
| جلوگیری از Lost Update (base/krevs) | ✅ فعال | per-key version tracking |
| Role-scoped sync | ✅ فعال | فیلتر سروری کلیدها بر اساس نقش |
| محافظت .htaccess | ✅ فعال | Deny from all روی crm/data/ |
| Token cleanup | ✅ فعال | حذف خودکار توکن‌های منقضی |

---

## 📊 جزئیات فنی

### ۱. هماهنگی کلیدهای Sync

```
بک‌اند (api/crm.php → sync_all_keys()):    ۴۸ کلید
فرانت‌اند (crm/sync.js → SYNC_KEYS):       ۴۸ کلید  
backup.js (DATA_KEYS):                      ۴۹ کلید (+ ptf_crm_users)

اختلاف: صفر ✅
```

**لیست ۴۸ کلید مشترک:**
```
ptf_crm_rfqs, ptf_crm_suppliers, ptf_crm_customers, ptf_crm_products,
ptf_crm_offers, ptf_crm_leads, ptf_crm_reminders, ptf_crm_buyquotes,
ptf_crm_invoices, ptf_crm_surplus, ptf_crm_notifs, ptf_crm_sendqueue,
ptf_crm_audit, ptf_crm_inqitems, ptf_crm_deals, ptf_crm_projects,
ptf_crm_packinglists, ptf_crm_letters, ptf_crm_contracts, ptf_crm_sigprofiles,
ptf_crm_smsbook, ptf_crm_rfqsmart, ptf_crm_settings, ptf_crm_finance,
ptf_crm_order_prices, ptf_crm_notifprefs, ptf_crm_trash, ptf_crm_petty,
ptf_crm_perms, ptf_crm_avatars, ptf_crm_buycmp, ptf_crm_inqreads,
ptf_crm_cheques, ptf_crm_msgtpls, ptf_crm_deleted_archive, ptf_crm_payables,
ptf_crm_supplier_finance, ptf_crm_opex, ptf_crm_petty_tx, ptf_crm_petty_periods,
ptf_crm_shareholders, ptf_crm_sharetx, ptf_crm_fiscal_snapshots, ptf_crm_techcases,
ptf_crm_calc_runs, ptf_crm_techproposals, ptf_crm_leadfinder_jobs, ptf_crm_leadfinder_sources
```

### ۲. مکانیزم‌های محافظتی داده

| مکانیزم | لایه | وضعیت |
|---------|------|-------|
| سپر داده‌صفر (push خالی) | سرور + کلاینت | ✅ فعال |
| سپر بک‌آپ (suspect detection) | سرور | ✅ فعال |
| Race condition (flock) | سرور | ✅ فعال |
| Lost update (base/krevs) | سرور + کلاینت | ✅ فعال |
| Smart merge (ptfSmartMerge) | کلاینت | ✅ فعال |
| Mass drop detection (>۵۰٪) | کلاینت | ✅ فعال |
| Role-scoped keys | سرور | ✅ فعال |
| Token expiry (۷ روزه) | سرور | ✅ فعال |
| Token cleanup | سرور | ✅ فعال |

### ۳. ساختار بک‌آپ

```
crm/data/backups/
├── hourly-latest.json.gz   ← آخرین بک‌آپ ساعتی (جایگزین)
├── daily-YYYY-MM-DD.json.gz ← ۳ روز اخیر
├── weekly-latest.json.gz    ← هفته جاری (جایگزین)
├── monthly-latest.json.gz   ← ماه جاری (جایگزین)
├── suspect-*.json.gz        ← قرنطینه (افت >۵۰٪)
└── .htaccess                ← Deny from all
```

### ۴. ساختار Sync

```
crm/data/sync/
├── meta.json              ← metadata + rev per key + _global.rev
├── meta.json.lock         ← قفل flock
├── ptf_crm_rfqs.json      ← داده هر کلید
├── ptf_crm_users.json     ← کاربران (از auth_login خوانده می‌شود)
├── ... (۴۸ کلید)
└── .htaccess              ← Deny from all
```

---

## 🔧 ابزار تشخیص سرور

فایل `api/data-health-check.php` همراه بسته ریلیز ارائه شده است.

**نحوه استفاده:**
1. فایل را در پوشه `api/` آپلود کنید
2. باز کنید: `https://yourdomain.com/api/data-health-check.php?confirm=yes`
3. گزارش کامل سلامت را مشاهده کنید
4. **فایل را از سرور حذف کنید** (حاوی اطلاعات حساس)

---

## ⚠️ توصیه‌ها

1. **بک‌آپ اولیه:** قبل از هر عملیات، یک بک‌آپ دستی از تنظیمات → «پشتیبان» بگیرید
2. **بررسی سرور:** ابزار `data-health-check.php` را اجرا کنید تا از سلامت داده‌های واقعی مطمئن شوید
3. **حفاظت داده:** پوشه `crm/data/` هرگز نباید در بسته ریلیز باشد — فقط روی سرور موجود است
4. **ptf-secrets.php:** اگر هنوز نساخته‌اید، خارج از webroot بسازید (طبق DEPLOYMENT-GUIDE)

---

*پایان گزارش — ممیزی کد سطح source، تأیید صحت اجرایی نیازمند data-health-check.php روی سرور دارد.*
