# 📊 گزارش رگرسیون v31.7.30

**تاریخ:** ۱۴۰۵/۰۴/۲۹ (2026-07-20)
**نسخه:** v31.7.30
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py` (۱۰ بخش)

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۸۳** (+۱: tester205-rfq-site-track) | — |
| فایل‌های PASS | **۱۸۳** | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۱۰ بخش) | **PASS** | ✅ |
| `php -l api/crm.php` | **PASS** | ✅ |

## 🆕 پوشش تست جدید (tester205 + E2E)

- **E2E سرور PHP واقعی:** ثبت با کپچا → `PTF-RFQ-1405-0001` → track=pending → set_status(approved) → track=approved → stCO/st8/st7 → track هر بار پیام مشتری‌پسند؛ کد جعلی → notfound
- ممیزی استاتیک ۵ حلقه: فرم سایت→API (کپچا/rate-limit/کد اتمیک)، inbox→CRM (مشتری خودکار/پیوست)، هسته واحد وضعیت (bridge/kanban/salesfiles/buycompare)، track امن (بدون نشت تلفن/ایمیل/متن)، صفحه tracking
- polish: pubMap فقط برای rfq؛ st8 داخلی نشت نمی‌کند؛ rejected دلیل را حفظ می‌کند

## 📁 فایل‌های تغییریافته

`api/crm.php`، `crm/index.html` (bump)، `crm/sw.js`، `crm/clear-cache.html`، `_tools/uat/tester205` (جدید)

## 🚦 وضعیت گیت‌ها

- **گیت فنی: سبز** ✅
- **گیت انسانی: معوق** ⏳ — چرخه ۴مرحله‌ای RELEASE-NOTES روی سایت واقعی pishtaj.ir (ثبت واقعی + رهگیری از موبایل مشتری‌وار).
