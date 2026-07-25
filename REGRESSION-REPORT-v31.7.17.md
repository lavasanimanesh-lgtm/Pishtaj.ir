# 📊 گزارش رگرسیون v31.7.17

**تاریخ:** ۱۴۰۵/۰۴/۲۹ (2026-07-19)
**نسخه:** v31.7.17
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py` (۱۰ بخش)

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۷۰** (+۱: tester192-mobile-theme-fouc) | — |
| فایل‌های PASS | **۱۷۰** | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۱۰ بخش) | **PASS** | ✅ |
| `node --check` (`mobilenav.js`) | **PASS** | ✅ |

## 🆕 پوشش تست جدید (tester192)

- CSS بحرانی (فونت/سایدبار/موبایل) قبل از `</head>`؛ اسکریپت تم تاریک قبلی (BUG-003) سالم
- گرافیک تب فعال: translateY + pill گرادیانی + لیبل ۹۰۰ + نقطه نشانگر (نه زیر FAB) + scale لمسی
- FAB pulse + هپتیک گاردشده + panel-in فقط opacity/transform
- قیدهای QA: دو بلاک `prefers-reduced-motion`، تک setInterval قدیمی boot (بدون افزوده جدید)، بدون کتابخانه خارجی، ساختار TABS/goPanel/RBAC دست‌نخورده
- سند صورت‌جلسه پنل موجود و آیتم‌های ردشده مستند

## 📁 فایل‌های تغییریافته

`crm/index.html` (CSS بحرانی + bump)، `crm/mobilenav.js`، `crm/sw.js`، `crm/clear-cache.html`، `EXPERT-PANEL-MOBILE-UX-v31.7.17.md` (جدید)، `_tools/uat/tester192` (جدید)

## 🚦 وضعیت گیت‌ها

- **گیت فنی: سبز** ✅
- **گیت انسانی: معوق** ⏳ — راستی‌آزمایی بصری روی گوشی واقعی (iOS/Android) طبق ۴ سناریوی RELEASE-NOTES؛ به‌ویژه تست FOUC با شبکه کند (Chrome DevTools → Slow 3G).
