# 🗓️ نقشه اسپرینت‌ها — محصول قابل دیپلوی (Deliverable) — از v32 تا v38
**مبنای نسخه‌گذاری جدید:** فیچر → Major (32→33), هات‌فیکس → Patch (32→32.0.1) — هر ریلیز ZIP کامل  
**تیم:** 2 Backend + 1 Frontend + 0.5 QA + 0.5 UX (4 نفر)  
**طول اسپرینت:** 2 هفته (10 روز کاری) — هر اسپرینت = یک ریلیز قابل دیپلوی روی Production  
**تعریف Done:** Audit PASS + Regression 260+ PASS + UAT 4 نقش + 3 سند (RELEASE-NOTES, REGRESSION, FILES-CHANGED) + ZIP کامل

---

## Sprint 0 — v32.0.1 — HOTFIX SECURITY — زمان: 1 هفته — فوری

**هدف دیلورابل:** بستن حفره‌های بحرانی بدون تغییر فیچر — قابل دیپلوی فوری، ریسک صفر برای داده

**بک‌لاگ:**
- US-438 SEC-ROLE-SPOOF-FIX (cms.php)
- US-439 SEC-TOKEN-IN-URL-REMOVE
- US-440 SEC-FALLBACK-SECRET-ENFORCE
- US-441 SEC-TOKENS-JSON-HARDEN + prune 806 token
- US-442 SEC-XSS-DOMPURIFY (DOMPurify + حذف alert)
- US-443 BUG-CODEGEN-ATOMIC (counter flock)

**خروجی قابل دیپلوی:**
- ZIP `pishtaj-release-v32.0.1.zip` — 25MB — فقط 6 فایل PHP/JS تغییرکرده
- هیچ تغییر UI، هیچ migration
- تست: `curl -H X-CRM-Role:admin` → 403, `?token=` → 400, نام فایل `<img onerror>` → sanitize
- **ارزش تجاری:** جلوگیری از هک CMS + لو رفتن session — **باید همین هفته برود Production**

**گیت:**
- Regression: 260 → 260 PASS (هیچ فیچر جدید نشکسته)
- UAT: ورود admin/sales OK

---

## Sprint 1 — v32.0.2 — STABILITY PATCH — 2 هفته

**هدف:** پایداری و جلوگیری از Data Loss

**بک‌لاگ:**
- US-444 FILE-MIME-VALIDATE
- US-445 RACE-LOST-UPDATE-FIX (flock برای هر write)
- US-446 QUOTA-GUARD (try/catch QuotaExceeded)
- US-447 CONTACT-LOG-ROTATE
- US-448 FIN-MARGIN-SERVER-SIDE (محاسبه margin در `api/crm.php` جدید `calc_margin`)

**خروجی:**
- `v32.0.2.zip` — 5 فایل تغییر
- Dashboard مالی اعداد قابل اتکا (چون margin سروری)
- **ارزش:** جلوگیری از کرش مرورگر + از دست رفتن پیشنهاد

---

## Sprint 2 — v32.1 — PERFORMANCE — 2 هفته

**هدف:** لود سریع + جدول‌های سنگین

**بک‌لاگ:**
- US-449 GZIP + WEBP + lazy + brotli در .htaccess
- US-450 VIRTUAL SCROLL (100 ردیف) برای customers/rfqs/offers
- US-451 EMPTY-STATE component

**خروجی:**
- `v32.1.zip` — Minor bump (چون بهبود UX/performance)
- LCP: از 3.2s → 1.6s (هدف) — تست Lighthouse
- جدول 10k مشتری بدون freeze
- **قابل دیپلوی:** هیچ breaking change

---

## Sprint 3 — v33 — CRM PIPELINE MVP — 2 هفته — اولین Major جدید

**هدف:** تبدیل CRM از لیست به Pipeline واقعی — ارزش فروش مستقیم

**بک‌لاگ:**
- US-452 LEAD-TO-OPP-AUTO (Lead→Customer→Opp با یک کلیک)
- US-453 KANBAN واقعی (ستون‌ها: New/Qualified/Proposal/Negotiation/Won/Lost + drag-drop + WIP limit)
- US-454 VENDOR-LIST-CHECK (مقایسه کالا با لیست NIOC)

**خروجی:**
- `v33.zip` — Major release — 3 ماژول جدید
- Sales Pipeline قابل استفاده توسط تیم فروش — Win Rate اولیه
- **Demo برای مدیرعامل:** Kanban drag-drop

---

## Sprint 4 — v34 — CREDITS & PRICING — 2 هفته

**هدف:** مالی قابل اتکا

**بک‌لاگ:**
- US-455 CREDIT-LIMIT (سقف اعتبار + هشدار قرمز/زرد/سبز)
- US-456 PRICE-HISTORY (نمودار قیمت خرید/فروش per کالا + تاریخچه)
- US-457 LOI-ADVANCE-GUARANTEE (مدیریت تضامین)
- US-458 APPROVAL-MULTI (تایید 2 مرحله‌ای: sales→ceo)

**خروجی:**
- `v34.zip`
- جلوگیری از فروش به مشتری بدحساب + دید قیمت تاریخی
- **ارزش:** کاهش ریسک مالی

---

## Sprint 5 — v35 — DESIGN SYSTEM & UX — 3 هفته (شامل طراحی)

**هدف:** زیبایی از 52 → 80

**بک‌لاگ:**
- US-459 DESIGN-SYSTEM (Tailwind + Lucide + توکن‌ها --pri, --org یکدست)
- US-460 SIDEBAR-TOOLTIP (موبایل 56px با tooltip + label)
- US-461 FORM-VALIDATION (validation بصری)
- US-462 KPI-CONTEXT (مقایسه ماه قبل + sparkline)
- US-463 MODAL-ZINDEX
- US-464 SEARCH-GLOBAL (Ctrl+K واقعی با Meilisearch lightweight)
- US-465 SKELETON-LOADING

**خروجی:**
- `v35.zip` — Major — تمام 70 JS با کلاس‌های Tailwind بازنویسی تدریجی
- نمره طراحی 52 → 78 (هدف)
- **قابل دیپلوی:** چون فقط UI، logic دست‌نخورده

---

## Sprint 6-7 — v36 — POSTGRES FOUNDATION — 4 هفته (2 اسپرینت) — BREAKING PREP

**هدف:** زیرساخت مقیاس‌پذیر — مهم‌ترین سرمایه‌گذاری

**بک‌لاگ:**
- US-466 POSTGRES-MIGRATION — طراحی schema 48 کلید با FK واقعی (customers→rfqs→offers→projects→invoices), migration script از JSON
- US-467 INDEXEDDB (انتقال داده حجیم از localStorage به Dexie)

**خروجی:**
- `v36.zip` — شامل dual-write (هم JSON هم Postgres) برای دوره گذار — هیچ داده قدیمی پاک نمی‌شود
- اسکریپت `migrate_json_to_pg.php` + تست 10k مشتری
- **ریسک:** نیاز به بک‌آپ کامل + maintenance window 2 ساعته
- **ارزش:** حل مشکل Quota + Race + مقیاس‌پذیری 50k RFQ

**گیت ویژه:** باید روی Staging جدید (که خارج کردیم، ولی برای این migration یک Staging موقت می‌سازیم) تست شود

---

## Sprint 8 — v37 — SEARCH & SESSION INFRA — 2 هفته

**بک‌لاگ:**
- US-468 SEARCH-ENGINE (Meilisearch برای RFQ)
- US-469 REDIS-SESSION (Redis برای session + rate-limit)
- US-470 CDN (CloudFront برای S3)

**خروجی:**
- `v37.zip`
- جستجوی 50k RFQ <100ms
- Rate-limit توزیع‌شده

---

## Sprint 9 — v38 — B2B ADVANCED & ANALYTICS — 3 هفته

**بک‌لاگ:**
- US-471 KPI-WIN-RATE-CYCLE (Win Rate %, Avg Cycle, OTIF, LTV با Chart.js)
- US-472 ERP-SEPIDAR-MODIAN (اتصال سپیدار)
- US-473 PWA-OFFLINE (اپ آفلاین + Push)

**خروجی:**
- `v38.zip` — **محصول Enterprise MVP** — امتیاز از 41 → 78 هدف
- **Demo نهایی برای Production:** Dashboard سود واقعی + Pipeline + Vendor Check + PWA

---

## Sprint 10+ — v39+ — AI & COMPLIANCE

- US-474 AI-PROPOSAL-LLM
- US-475 VENDOR-ENGINE

---

## نمای کلی زمان‌بندی Production Deploy

| تاریخ تقریبی | نسخه | نوع | قابلیت دیپلوی | ریسک |
|---|---|---|---|---|
| هفته 1 (فوری) | v32.0.1 | Patch امنیتی | بله — فقط PHP/JS امن | کم |
| هفته 3 | v32.0.2 | Patch پایداری | بله | کم |
| هفته 5 | v32.1 | Minor perf | بله | کم |
| هفته 7 | v33 | Major pipeline | بله — Kanban | متوسط |
| هفته 9 | v34 | Major مالی | بله | متوسط |
| هفته 12 | v35 | Major UX | بله — طراحی جدید | متوسط |
| هفته 16 | v36 | Major infra | بله — با dual-write | زیاد — نیاز maintenance |
| هفته 18 | v37 | Major search | بله | متوسط |
| هفته 21 | v38 | Major enterprise | بله — نهایی | متوسط |

**هر اسپرینت یک ZIP کامل + 3 سند + UAT 15 دقیقه — هیچ‌وقت تک‌فایل نیست**

---

## تعریف محصول قابل دیپلوی (DoD) برای هر اسپرینت

- [ ] `audit.py` 10 بخش PASS
- [ ] `regression` ≥260 PASS, 0 FAIL
- [ ] UAT 4 نقش (admin, sales, accountant, collector) + مرکز دانش (search + icons)
- [ ] `RELEASE-NOTES-vX.md` با بخش‌های: مسئله, تغییرات, عمداً تغییر نکرده, UAT, Rollback
- [ ] `REGRESSION-REPORT-vX.md`
- [ ] `FILES-CHANGED-vX.txt` با SHA256
- [ ] ZIP کامل پروژه (25MB, ~1680 files, 188 images) — نه تک‌فایل
- [ ] بک‌آپ `crm/data/` قبل از دیپلوی + یادداشت Rollback

---

*این نقشه بر اساس ارزیابی 41/100 و با هدف 80/100 در v38 طراحی شده — تیم متخصص 4 نفره — 21 هفته*
