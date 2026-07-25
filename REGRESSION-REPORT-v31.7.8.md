# 📊 گزارش رگرسیون v31.7.8

**تاریخ:** ۱۴۰۵/۰۴/۲۸ (2026-07-19)  
**نسخه:** v31.7.8  
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py`

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۶۱** | — |
| فایل‌های PASS | **۱۶۱** | ✅ ۱۰۰٪ |
| فایل‌های FAIL | **۰** | ✅ صفر |
| چک‌های PASS | **۳,۸۰۸** | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۹ بخش) | **PASS** | ✅ همه سبز |

---

## 🔧 اصلاحات تسترهای sync‌شده

| # | تستر | مشکل قبلی | اصلاح |
|---|-------|-----------|-------|
| 1 | tester6-bridge.js | الگوی polling قدیمی `setInterval(pollEvents, 8000)` | sync با stacking guard v31.7.4 |
| 2 | tester15-sprint78.js | الگوی لاگین قدیمی `srvUser.passhash === ph` | sync با `auth_login` server-side v31.7.8 |
| 3 | tester55-v135.js | فایل `api/.htaccess` موجود نبود | ساخت `api/.htaccess` با whitelist |
| 4 | tester79-v161.js | فایل `api/.htaccess` موجود نبود | رفع با ساخت htaccess |
| 5 | tester85-v167.js | فایل `api/.htaccess` موجود نبود | رفع با ساخت htaccess |
| 6 | tester182-v327 | الگوی `isServerIssuedPrefix` قدیمی | sync با `SERVER_ONLY_PREFIXES` v31.7.3 |

---

## 📁 فایل‌های اضافه‌شده

| فایل | توضیح |
|------|-------|
| `api/.htaccess` | محافظت + whitelist endpoint‌های API |
| `api/data-health-check.php` | ابزار تشخیص سلامت داده |
| `RELEASE-NOTES-v31.7.8.md` | یادداشت‌های ریلیز |
| `QUICK-TEST-GUIDE-v31.7.8.md` | دستورالعمل تست سریع |
| `DATA-HEALTH-REPORT-v31.7.8.md` | گزارش سلامت داده‌ها |

---

## 📋 audit.py — ۹ بخش

| # | بخش | وضعیت |
|---|------|--------|
| 1 | لینک‌ها و ارجاعات شکسته | ✅ PASS |
| 2 | سینتکس JS | ✅ PASS |
| 3 | XML/JSON | ✅ PASS |
| 4 | sitemap sync | ✅ PASS |
| 5 | سئو پایه | ✅ PASS |
| 6 | امنیت | ✅ PASS |
| 7 | محتوای ناقص | ✅ PASS |
| 8 | موتور کدگذاری | ✅ PASS |
| 9 | تصاویر | ✅ PASS |

---

*گیت فنی و گیت انسانی هر دو سبز — ریلیز آماده Production.*
