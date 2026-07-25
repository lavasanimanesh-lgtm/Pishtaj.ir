# 🎯 بک‌لاگ اولویت‌بندی شده — پس از ارزیابی تخصصی اولیه (Senior Expert Panel)
**نسخه:** v32 base → برنامه‌ریزی برای v32.0.1 تا v38  
**تاریخ:** 2026-07-24  
**مبنا:** گزارش ارزیابی 12 بخشه (41/100) + 13 باگ جدول‌شده + 20 مشکل UX + تحلیل Performance/Scalability  
**سیاست نسخه‌گذاری جدید:** فیچر → Major (32→33), هات‌فیکس → Patch (32→32.0.1) — هر ریلیز ZIP کامل  
**تیم تخمین:** Arch, Security, FullStack, PM, UX — Effort: S=≤2d, M=3-5d, L=1-2w, XL=3w+

---

## P0 — بحرانی (BLOCKER) — باید قبل از هر دیپلوی فیچر جدید

| US | عنوان | نقش / می‌خواهم / تا | AC | Effort | Value | Sprint پیشنهادی |
|---|---|---|---|---|---|---|
| US-438 | **SEC-ROLE-SPOOF-FIX** رفع جعل نقش در cms.php | به عنوان Admin می‌خواهم فقط توکن JWT معتبر نقش admin/chairman را بپذیرد نه هدر X-CRM-Role تا از تغییر اخبار/بلاگ توسط مهاجم جلوگیری شود | AC1: `cms.php:7` دیگر `$_SERVER['HTTP_X_CRM_ROLE']` نخواند، AC2: از `verify_request()` + `auth_verify_token()` استفاده، AC3: تست `curl -H X-CRM-Role:admin` → 403 | S | Critical | v32.0.1 (Sprint 0) |
| US-439 | **SEC-TOKEN-IN-URL-REMOVE** حذف توکن از Query | به عنوان کاربر می‌خواهم توکن فقط در Header باشد نه URL تا در لاگ سرور لو نرود | AC1: حذف `$_GET['token']` و `$_POST['token']` از `auth_get_header_token()`، فقط `X-CRM-Token` + Cookie، AC2: لاگ access بدون token، AC3: تمام فراخوانی‌های قدیمی `?token=` به Header مهاجرت | S | Critical | v32.0.1 |
| US-440 | **SEC-FALLBACK-SECRET-ENFORCE** اجباری کردن ptf-secrets.php | به عنوان DevOps می‌خواهم اگر `ptf-secrets.php` بیرون webroot نباشد، API با 500 متوقف شود نه با کلید default | AC1: حذف تمام default های `ptf-crm-secret-key-...` در `auth.php:13`, `crm.php:52,98`, AC2: درProd اگر فایل نبود `exit 500`, AC3: DEPLOYMENT-GUIDE به‌روز | S | Critical | v32.0.1 |
| US-441 | **SEC-TOKENS-JSON-HARDEN** سخت‌سازی session store | به عنوان Security می‌خواهم توکن‌ها هش شده ذخیره و auto-prune شوند | AC1: ذخیره `hash('sha256', token)` به جای خود token به عنوان کلید، AC2: job روزانه حذف exp<now، AC3: alert اگر >100 فعال | M | Critical | v32.0.1 |
| US-442 | **SEC-XSS-DOMPURIFY** جلوگیری XSS | به عنوان کاربر می‌خواهم نام فایل مخرب `<img onerror>` اجرا نشود | AC1: نصب DOMPurify + استفاده در `storage.js` `insertAdjacentHTML`, `ai-*.js` `innerHTML`, AC2: حذف `alert()` و جایگزینی `ptfDialog`, AC3: تست `<svg/onload=alert(1)>` در نام فایل | M | High | v32.0.1 |
| US-443 | **BUG-CODEGEN-ATOMIC** تولید کد اتمیک سروری | به عنوان فروش می‌خواهم دو کاربر همزمان شماره پیشنهاد تکراری نگیرند | AC1: `counters.json` با flock جدی + `next_seq()` فقط سروری، AC2: کلاینت دیگر کد نسازد، AC3: تست همزمانی 10 درخواست → 10 کد یکتا | M | High | v32.0.1 |

---

## P1 — مهم (HIGH) — لازمه محصول قابل اتکا برای Production

| US | عنوان | توضیح | Effort | Value | Sprint |
|---|---|---|---|---|---|
| US-444 | **SEC-FILE-MIME-VALIDATE** اعتبارسنجی MIME آپلود | به عنوان Admin می‌خواهم فقط PDF/JPG واقعی آپلود شود نه `shell.php.pdf` | S | High | v32.0.2 (Sprint 1) |
| US-445 | **BUG-RACE-LOST-UPDATE-FIX** رفع race data_push | به عنوان Sales می‌خواهم دو ویرایش همزمان باعث از دست رفتن داده نشود | M | High | v32.0.2 |
| US-446 | **STAB-QUOTA-GUARD** محافظت QuotaExceeded | به عنوان کاربر می‌خواهم وقتی localStorage پر شد، خطا با toast بیاید نه کرش | S | High | v32.0.2 |
| US-447 | **SEC-CONTACT-LOG-ROTATE** چرخش لاگ تماس | | S | Medium | v32.0.2 |
| US-448 | **FIN-MARGIN-SERVER-SIDE** محاسبه سود سروری | به عنوان مدیر مالی می‌خواهم margin در سرور محاسبه شود نه کلاینت | M | High | v32.0.2 |
| US-449 | **PERF-GZIP-WEBP** بهینه‌سازی لود | به عنوان کاربر موبایل می‌خواهم لود <2s | M | High | v32.1 (Sprint 2) |
| US-450 | **PERF-PAGINATION-VIRTUAL** صفحه‌بندی جدول | به عنوان Sales با 10k مشتری می‌خواهم جدول virtual scroll 100 ردیف | M | High | v32.1 |
| US-451 | **UX-EMPTY-STATE** حالت خالی | به عنوان کاربر جدید می‌خواهم وقتی جدول خالی است CTA ببینم | S | Medium | v32.1 |

---

## P1 — CRM Logic & Workflow (نقطه درد B2B)

| US | عنوان | Effort | Sprint |
|---|---|---|---|
| US-452 | **FLOW-LEAD-TO-OPP-AUTO** تبدیل خودکار Lead→Customer→Opp | M | v33 (Sprint 3) |
| US-453 | **CRM-OPPO-KANBAN** کانبان واقعی Sales Pipeline با drag-drop | L | v33 |
| US-454 | **PROC-VENDOR-LIST-CHECK** چک Vendor List NIOC/NPC | M | v33 |
| US-455 | **FIN-CREDIT-LIMIT** سقف اعتبار مشتری + هشدار | M | v34 (Sprint 4) |
| US-456 | **CRM-PRICE-HISTORY** تاریخچه قیمت خرید/فروش per کالا | M | v34 |
| US-457 | **PROC-LOI-ADVANCE-GUARANTEE** مدیریت تضامین/LOI/APG | L | v34 |
| US-458 | **FLOW-APPROVAL-MULTI** تایید چندمرحله‌ای پیشنهاد | M | v34 |

---

## P2 — متوسط (MEDIUM) — UX/UI 20 مشکل

| US | عنوان | مشکل UX ref | Sprint |
|---|---|---|---|
| US-459 | **UX-DESIGN-SYSTEM** پیاده‌سازی Design System (Tailwind + Lucide) | #2,3,11 | v35 (Sprint 5) |
| US-460 | **UX-SIDEBAR-TOOLTIP** سایدبار موبایل 56px + tooltip + label | #4 | v35 |
| US-461 | **UX-FORM-VALIDATION** Validation بصری فرم‌ها (نه alert) | #6 | v35 |
| US-462 | **UX-KPI-CONTEXT** KPI با مقایسه ماه قبل/هدف + sparkline | #7 | v35 |
| US-463 | **UX-MODAL-ZINDEX** مدیریت Z-index مودال + ptfTopZIndex | #8 | v35 |
| US-464 | **UX-SEARCH-GLOBAL** جستجوی سرتاسری Ctrl+K واقعی | #14 | v35 |
| US-465 | **UX-SKELETON-LOADING** Skeleton loading برای data_pull | #18 | v35 |

---

## P2 — مقیاس‌پذیری (Scalability)

| US | عنوان | Effort | Sprint |
|---|---|---|---|
| US-466 | **ARCH-POSTGRES-MIGRATION** مهاجرت File JSON → Postgres schema 48 کلید + FK | XL | v36 (Sprint 6-7) |
| US-467 | **ARCH-INDEXEDDB** انتقال localStorage پرحجم به IndexedDB (Dexie) | L | v36 |
| US-468 | **ARCH-SEARCH-ENGINE** Meilisearch برای 50k RFQ | L | v37 (Sprint 8) |
| US-469 | **ARCH-REDIS-SESSION** Redis برای session + rate-limit | M | v37 |
| US-470 | **ARCH-CDN** CloudFront برای S3 + WebP | S | v37 |

---

## P3 — آینده (B2B Advanced)

| US | عنوان | Sprint |
|---|---|---|
| US-471 | **KPI-WIN-RATE-CYCLE** Win Rate %, Avg Cycle, OTIF | v38 (Sprint 9) |
| US-472 | **ERP-SEPIDAR-MODIAN** اتصال سپیدار/مودیان مالیاتی | v38 |
| US-473 | **MOBILE-PWA-OFFLINE** اپ PWA با Sync + Push | v38 |
| US-474 | **AI-PROPOSAL-LLM** پیشنهاد هوشمند LLM برای TO/CO | v39 (Sprint 10+) |
| US-475 | **COMPLIANCE-VENDOR-ENGINE** موتور Vendor Compliance خودکار | v39 |

---

## جمع‌بندی اولویت

- **P0 (6 US):** امنیت بحرانی → باید قبل از هر فیچر جدید → Patch `v32.0.1`
- **P1 (8 US):** پایداری + مالی → Patch `v32.0.2` + Minor `v32.1`
- **P1 Workflow (7 US):** منطق B2B → v33, v34
- **P2 UX (7 US):** تجربه → v35
- **P2 Scalability (5 US):** زیرساخت → v36, v37
- **P3 (5 US):** آینده → v38+

**مجموع:** 38 یوزراستوری جدید برای پوشش ارزیابی 41/100 → هدف 80/100
