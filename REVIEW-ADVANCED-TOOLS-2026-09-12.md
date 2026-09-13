# 🔎 گزارش بررسی «ابزارهای پیشرفته مهندسی وبسایت» — 2026-09-12

**شاخه:** `arena/2026-09-12-session-pishtaj-ir` (روی پایهٔ main + merge از `arena/01a08c54-pishtaj-ir`، v34.38.20)
**روش:** خواندن کد + اجرای عملی (smoke test API روی PHP 8.4 محلی + اجرای 50+ تستر UAT + اجرای ابزارهای ممیزی سئو + تحلیل پوشش CI gate)

---

## ۱. قلمهٔ «ابزارهای پیشرفته مهندسی» چیست

محصول **PTF Advanced Engineering Tools** در `/tools/`:

| ابزار | وضعیت |
|---|---|
| **سایزینگ پیشرفته کنترل ولو (ADV-CV)** | ✅ پیاده‌شده — تنها ابزار فعال |
| تحلیل پیشرفته پایپینگ (Piping Advanced) | 🔜 «در برنامه» (کارت در کاتالوگ، موتور ندارد) |
| انتخاب و بررسی پمپ (Pump Selection) | 🔜 «در برنامه» |
| فلومتر و اوریفیس (Flow Meter / Orifice) | 🔜 «در برنامه» |
| مهندسی برق (Electrical Engineering) | 🔜 «در برنامه» |
| ابزار دقیق (Instrumentation) | 🔜 «در برنامه» |

مدل لایسنس سرور (`api/tools.php`) از پیش برای **هر ۶ ابزار** آماده است (`tools_norm_tool`: all, control_valve_advanced, piping_advanced, pump_selection, flowmeter_orifice, electrical_engineering, instrumentation).

### زنجیرهٔ کامل ADV-CV (همه P0ها انجام شده — با شواهد)
محاسبات (liquid multi-case، velocity/reducer، cavitation severity، actuator shell، noise detail، gas/steam مقدماتی + 8 سناریوی QA داخلی) ← schema ورودی قفل‌شده ← draft سروری با checksum و grant ← review در CRM (`crm/tool-report-drafts.js`) ← final gate + readiness + quota dry-run ← **گزارش نهایی HTML انگلیسی شماره‌دار** (جدول‌ها، چارت SVG، Engineering Validation Matrix، Vendor Data Validation Matrix، Brand/Series Matrix) ← مصرف quota فقط در Issue final ← staff_internal quota-exempt ← نمونهٔ عمومی گزارش ← Datasheet Assist (TXT/CSV/JSON) ← feedback → کارتابل CRM ← KPI funnel + metrics privacy-aware ← SEO (landing اختصاصی + JSON-LD + 6+ مقالهٔ 1500+ کلمه‌ای).

### smoke test عملی (این بررسی)
- `api/tools.php?action=status` → `{"ok":true,"module":"ptf-tools-license",...}` ✅
- زنجیرهٔ `license_check`: rate-limit (30/ساعت) → `422 invalid_code_format` → `503 license_store_not_configured` (در هاست، store runtime موجود است) ✅
- `admin_list` بدون توکن → `401` ✅
- محاسبات: سناریوهای QA داخلی (tester247) روی کد فعلی سبز ✅
- 50+ تستر UAT محصول: **46 کاملاً سبز** روی کد فعلی ✅

---

## ۲. یافته‌ها (به‌ ترتیب اهمیت)

### F1 — 9 تستر UAT «قرمز خاموش» با claimهای منسوخ (بدهی تست)
این تسترها در CI gate **ثبت نیستند** (orphan)، بنابراین شکستشان بی‌صدا مانده بود:

| تستر | claim منسوخ | وضعیت کد فعلی |
|---|---|---|
| tester231, tester240 | `localStorage.getItem('ptf_crm_token')` | ✅ کد درست است — الگوی جدید v34.8.45: هلالپر `ptfAuthToken()` + هدر X-CRM-Token |
| tester245 | `localStorage.setItem('ptf_crm_token', _directLogin.token)` | ✅ کد درست است — ذخیره از `ptfAuthLoginWrite` (لایهٔ نشست جدید) |
| tester262, 264, 265, 266, 267 | خواندن `sitemap.xml` ریشه (منسوخ) | ✅ سایت اکنون `sitemap-index.xml` + 8 زیرنقشه؛ landing کنترل‌ولو در `sitemap-misc.xml`، مقالات در `sitemap-knowledge-center.xml` (بدون URL تکراری بین زیرنقشه‌ها — بررسی شد) |
| tester254, tester261 | محتوای handover قدیمی v31.7.97 | ✅ `PTF-MASTER-HANDOVER.md` عمداً بازنویسی v32 شده |

**نتیجه: هیچ باگ فعالی در محصول نیست؛ claimها از دو معماری‌شکنی بزرگ (خروج نشست از localStorage + بازسازی sitemap) عقب مانده‌اند.**

### F2 — انباشت بدهی تست بی‌نظام
- CI gate فقط 264 از 638 فایل تستر را اجرا می‌کند (طراحی: gate = زیرمجمعهٔ منتخب سریع).
- `run-all.js` و `run-full-regression.js` مدل «تمام رجسشن + قرنطینهٔ مکتوب» را دارند، اما **registry قرنطینه (`known-obsolete.json`) صفر ورودی است** — یعنی 374 تستر orphan نه در gate‌اند، نه در قرنطینهٔ مستند. مدیریت بدهی تست باید روی یکی از این دو مسیر منظم شود.

### F3 — 5 ابزار اعلام‌شده بدون موتور (بزرگ‌ترین فرصت «تکمیل»)
کاتالوگ عمومی 5 ابزار «در برنامه» نشان می‌دهد؛ مدل لایسنس سرورشان آماده است؛ ولی هیچ موتور/فرم/گزارشی ندارند. پیاده‌سازی هرکدام را می‌توان دقیقاً روی الگوی اثبات‌شدهٔ ADV-CV ساخت (موتور → schema قفل → draft/gate/report → لایسنس → UAT).

### F4 — موارد P1 باقی‌مانده از backlog رسمی (`ADV-CV-FINALIZATION-BACKLOG-v31.7.97.md`)
1. **PDF باینری سمت سرور** — ✅ **انجام شد (v34.38.21, 2026-09-13):** رندر best-effort با wkhtmltopdf در `admin_report_final_issue` + تولید idempotent (`admin_report_final_pdf_generate`) + استریم PDF با احراز هویت و verify checksum fail-closed (`admin_report_final_pdf_get`) + بازیابی/بازبینی گزارش با `admin_report_final_get` + وضعیت نصب در gate/CRM (`admin_report_pdf_status`). امنیت: دایرکتوری خصوصی `crm/data/tool_report_pdfs` (Deny from all)، `--allow` فقط دایرکتوری موقت، نام sanitize‌شده، hash پیش از استریم. نصب روی هاست: `_tools/host/install-wkhtmltopdf.sh`. قرارداد: `tester656` (در CI gate). گزارش‌های صادرشدهٔ پیشین هم با همان دکمهٔ «تولید PDF سروری» PDF می‌گیرند.
2. **IEC/ISA + acoustic نهایی برای Gas/Steam** — «نیازمند validation/دادهٔ vendor». (گزارش فعلی صریحاً «screening» است و gate قید vendor-confirmation می‌زند — شفاف، نه گمراه.)
3. **انتخاب نهایی brand/model با vendor matrix** — «نیازمند دیتابیس vendor».
4. (P2) پرداخت آنلاین — **تعمداً عقب‌افتاده** طبق تصمیم کارفرما.

### F5 — بهداشت
- **F5-a (مهم):** 11 اسکریپت یک‌بارمصرف `tools/seo_*.py` + `seo_kw_map.py` **در مسیر deploy پروداکشن** هستند (FTP فقط `_tools/**` را exclude می‌کند؛ `tools/` آپلود می‌شود) — فایل‌های توسعه در وب‌سرور عمومی: نشت اطلاعات + زباله. درمان: جابه‌جایی به `_tools/`.
- **F5-b:** 7 فایل `PENDING-*.patch` در `_tools/` — **هر 7‌تا اعمال‌شده‌اند** (محتوای همه در workflowهای فعلی موجود است؛ templates با live workflowها byte-to-byte یکسان). کاندیدای آرشیو.
- **F5-c:** `_tools/__pycache__/seo_weekly_watchlist.cpython-313.pyc` در git کامیت شده (باید gitignore + حذف).
- **F5-d:** ثابت نسخهٔ ماژول در `api/tools.php` هنوز `'v31.9'` است (خطای عملیاتی ندارد ولی گمراه‌کننده است).
- **F5-e:** `PTF-MASTER-HANDOVER.md` روی v32 (2026-07-24) مانده در حالی که پروژه v34.38.20 است — سند دست‌یابی زندهٔ ایجنت‌ها کهنه است.

### F6 — ابزارهای توسعه (غیرمحصول) — وضعیت
- CI gate: **268 PASS / 0 FAIL** ✅ • arch-guard: **PASS** ✅ • 172 فایل Python: **همه compile** ✅
- ابزارهای ممیزی سئو (`seo_audit_local`، `seo_health_scan`، `seo_linkgraph`، `seo_content_quality_audit`) اجرا شدند و خروجی واقعی تولید کردند (668 صفحه، 86.7% بدون پرچم؛ یافته‌های جزئی در `_audit/SEO-HEALTH-SCAN-*.csv`).
- `gsc_onboard.py` / `seo_weekly_watchlist.py --live` / `build_sitemap.py` (ساختار 7+1 نقشه با lastmod واقعی از git) سالم و مستند.
- workflowها (Quality Gate php.yml + deploy با گیت پیش-FTP + integrity check پس-استقرار) با templates یکسان و به‌روز.

---

## ۳. نقشهٔ راه تکمیل (پیشنهادی — مرحله به مرحله)

| مرحله | محتوا | ریسک | خُروجی |
|---|---|---|---|
| **0 — بهداشت** | Jابه‌جایی 11 اسکریپت از `tools/` به `_tools/` + آرشیو 7 patch + gitignore `__pycache__` + بامپ نسخهٔ ماژول `tools.php` + به‌روزرسانی header سند handover | بسیار کم | 3-4 commit کوچک |
| **1 — بدهی تست** | به‌روزرسانی 9 تستر منسوخ به claimهای معماری فعلی → اجرای کامل `run-all.js` → ثبت واقعی قرنطینه‌شدگان در `known-obsolete.json` با دلیل مکتوب | کم | سوئیت UAT «قرمز دائمی» بدون نویز |
| **2 — PDF سروری (P1)** | تولید PDF باینری در `admin_report_final_issue` (انتخاب: Dompdf vs wkhtmltopdf بر اساس امکانات هاست) + UAT قفل | متوسط | گزارش نهایی با دکمهٔ دانلود PDF مستقیم |
| **3 — vendor DB + IEC/ISA (P1)** | اسکیمای دیتابیس vendor (brand/series، rated Cv، FL/Fd/Xt، acoustic) + seed + استفاده در gate/report + اعتبارسنجی Gas/Steam | متوسط-زیاد | گام به سمت vendor-certified (با دادهٔ vendor) |
| **4 — ابزار بعدی کاتالوگ** | پیاده‌سازی یکی از 5 ابزار «در برنامه» روی الگوی ADV-CV (پیشنهاد: Pump Selection یا Piping Advanced) | زیاد | ابزار دوم فعال + درآمد دوم |
| **5 — پرداخت آنلاین (P2)** | فقط پس از تایید صریح کارفرما (الان «تعمداً عقب» است) | — | — |

**مرحله‌های 2 و 3 به تصمیمات نیاز دارند:** (2) امکانات هاست برای کتابخانهٔ PDF — (3) دادهٔ vendor (certified sizing sheets) از طرف شما.
