# Release Notes — v31.7.9

**تاریخ:** ۱۴۰۵/۰۴/۲۸ (2026-07-19)
**نسخه:** v31.7.9
**نوع:** 🟢 ریلیز تثبیت و حاکمیت (Stabilization & Governance) — بدون تغییر منطق runtime محصول

---

## 🎯 هدف

بستن شکاف‌های فرآیندی و مستنداتی که incident BUG-AUTH-001 (قطعی کامل احراز هویت در v31.7.4) از آن‌ها عبور کرد، به‌همراه رفع یک باگ همگام‌سازی نسخه. هیچ تغییری در منطق کسب‌وکار، sync، مالی یا داده انجام نشده است.

## ✅ تغییرات

| # | فایل | تغییر | شدت |
|---|------|--------|-----|
| 1 | `crm/clear-cache.html` | 🐛 **رفع باگ:** بج نسخه روی `v31.7.6` جا مانده بود (نقض قانون همگام‌سازی ۴نقطه‌ای منشور) → `v31.7.9`. اثر عملی: منطق پاکسازی کش `k !== 'ptf-crm-' + window.VER` کش صحیح فعلی را هم اشتباهاً حذف می‌کرد | 🟡 P1 |
| 2 | `_tools/uat/tester184-auth-contract-e2e.js` | ✨ **جدید:** تست قرارداد auth به‌صورت end-to-end واقعی — سرور PHP بالا می‌آورد و مسیر `auth_login → token → data_pull → 200` و سناریوهای 401 را با HTTP واقعی اجرا می‌کند (۱۵ چک). این دقیقاً تستی است که وجودش از BUG-AUTH-001 جلوگیری می‌کرد | 🔴 گیت |
| 3 | `_tools/audit.py` | ✨ **جدید (بخش ۱۰):** گیت انتشار — وجود `RELEASE-NOTES-v{VER}.md` و `REGRESSION-REPORT-v{VER}.md` منطبق با `window.VER` + همگامی کش sw.js را الزامی می‌کند. تکرار حفره مستندات v31.7.3–v31.7.7 دیگر مکانیکی ناممکن است | 🔴 گیت |
| 4 | `PTF-MASTER-HANDOVER.md` | هم‌ترازسازی حاکمیتی: بسته جاری، مکانیزم auth فعلی (JWT)، سابقه اجباری incident، مراجع جدید | 📘 |
| 5 | `BASELINE-START-v31.7.md` | الحاقیه بازنگری: ثبت نقض گیت staging؛ وضعیت `Breached / Recovery-verification pending` | 📘 |
| 6 | `INCIDENT-REPORT-BUG-AUTH-001.md` | ✨ جدید: گزارش رسمی incident طبق پروتکل ۷مرحله‌ای QA (RCA، ریشه‌های فرآیندی، evidence، اقدامات باز A1–A5) | 📘 |
| 7 | `PHASE0-PRODUCTION-RUNBOOK.md` | ✨ جدید: ران‌بوک ۴گامی تأیید ریکاوری Production برای ادمین سرور | 📘 |
| 8 | `BACKLOG-PRIORITIZED-CURRENT-v31.7.8.md` | ✨ جدید: احیای زنجیره بک‌لاگ (قطع‌شده از v31.7.2) + Family 0 تثبیت incident | 📘 |
| 9 | `QUESTIONS-FOR-CLIENT-v31.7.8.md` | ✨ جدید: ۶ پرسش رسمی حفره‌های مستندسازی | 📘 |
| 10 | `AUDIT-REPORT-DOC-CONTINUITY-v31.7.8.md` | ✨ جدید: ممیزی پیوستگی مستندات و اعتبار ادعاهای ریلیز | 📘 |
| 11 | `crm/index.html`, `crm/sw.js` | bump نسخه به v31.7.9 (۷۱ cache-bust + کش `ptf-crm-v31.7.9`) | — |

## 📊 نتایج گیت (بازاجرا پس از تمام تغییرات)

- رگرسیون کامل: **162/162 فایل PASS — 3823/3823 چک PASS — 0 FAIL** (شامل tester183 جدید)
- `audit.py` (اکنون ۱۰ بخش): **PASS**
- راستی‌آزمایی runtime قرارداد auth روی PHP 8.4 واقعی: ۱۱ سناریو سبز (جزئیات در `INCIDENT-REPORT-BUG-AUTH-001.md` بند ۵)

## ⚠️ Impact Analysis

| بخش | تأثیر | ریسک |
|------|--------|------|
| منطق محصول (sync/مالی/auth) | **صفر تغییر** — فقط clear-cache.html و ابزار/مستندات | صفر |
| کش کاربران | bump نسخه → یک‌بار دانلود مجدد assets | ناچیز |
| clear-cache.html | رفتار صحیح پاکسازی کش نسخه‌های قدیمی | مثبت |
| داده‌ها | دست‌نخورده — هیچ migration | صفر |

## 📋 مراحل استقرار

1. بک‌آپ از `crm/index.html`, `crm/sw.js`, `crm/clear-cache.html`
2. extract-overwrite بسته `pishtaj-release-v31.7.9.zip` در public_html (flat-root، حذف پوشه ممنوع)
3. کاربران: `Ctrl+F5` یا دکمه «🔄 رفع مشکل ورود»
4. **مهم:** اقدامات باز فاز ۰ (`PHASE0-PRODUCTION-RUNBOOK.md`) همچنان معتبر و معوق است — این ریلیز جایگزین تأیید ریکاوری Production نیست

---
*توسعه‌دهنده: PTF Development Team — 2026-07-19*
