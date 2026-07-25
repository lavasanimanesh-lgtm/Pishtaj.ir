# 📘 سند جامع انتقال معماری و راهنمای ایجنت — PTF Master Handover — v32

**نسخه:** v32 — KNOWLEDGE-CENTER-UNIQUE-ICONS-UX-001  
**تاریخ:** 2026-07-24  
**مبنا:** v31.9 (SEC-AUTH-SESSION-001 + BUG-OFFER-SYNC-INTEGRITY-001) → Major bump به v32  
**نوع ریلیز:** Feature Release (Full Project) — شامل تمام فایل‌های پروژه  
**وضعیت:** آماده UAT

> **قوانین یکدست از v32:**
> - **فیچر / یوزراستوری جدید** → Major: `31.9 → 32 → 33`
> - **هات‌فیکس / باگ کوچک** → Patch: `31.9 → 31.9.1` / `32 → 32.0.1`
> - **هر ریلیز = ZIP کامل پروژه** (نه تک‌فایل)
> - **Staging از روند خارج شد** — گیت staging دیگر وجود ندارد

---

## ۱. اصول اساسی برای ایجنت بعدی (۱۰ اصل طلایی — 5 دقیقه)

1. **48 کلید Sync:** `sync_all_keys()` در `api/crm.php:278` = 48 کلید هماهنگ با `SYNC_KEYS` و `DATA_KEYS`
2. **Auth JWT 7 روزه:** `api/auth.php` → HMAC JWT-like
3. **Offer Atomic:** `lineId` پایدار در `offers.js:1421`, سرور duplicate را ریجکت می‌کند `crm.php:319`
4. **ID Deterministic:** مثل `PB-{mob}` نه random
5. **Token Anti-Flood:** guard در `crm/index.html:714` + single-flight + cap 3
6. **Icon یکتا:** از v32 همه 16 خوشه مرکز دانش یکتای معنایی
7. **File DB:** `load_data/save_data` با LOCK_EX + flock meta
8. **Role-scoped:** `sync_allowed_keys_for_role()` در `crm.php:281`
9. **Release کامل:** ZIP کامل شامل `knowledge-center/`, `crm/`, `api/`, `assets/`, `PTF-MASTER-HANDOVER.md`, `RELEASE-NOTES-v32.md`, `REGRESSION-REPORT-v32.md`, `FILES-CHANGED-v32.txt`
10. **UAT انسانی:** Settings + پیشنهاد + مرکز دانش

---

## ۲. سیاست نسخه‌گذاری یکدست

| نوع | قانون | مثال |
|-----|-------|------|
| فیچر | Major | 31.9 → 32 |
| هات‌فیکس | Patch | 32 → 32.0.1 |

`window.VER`, `sw.js CACHE`, `clear-cache.html`, `?v=32` باید یکسان.

---

## ۳. استجینگ خارج شد

قبل: `STAGE0-ENV-001` blocker در `BASELINE-START-v31.7.md`
بعد: هیچ staging نیست. روند: `audit.py PASS` + `regression 260 PASS` + UAT 15 دقیقه + ZIP کامل

---

## ۴. معماری فعلی v32

Website + Knowledge Center v32 (16 unique icons + search + chips) + CRM SPA (70 JS) + Sync (single-flight) + PHP API + S3 + Auth

48 کلید: rfqs, suppliers, customers, products, offers, leads, reminders, buyquotes, invoices, surplus, notifs, sendqueue, audit, inqitems, deals, projects, packinglists, letters, contracts, sigprofiles, smsbook, rfqsmart, settings, finance, order_prices, notifprefs, trash, petty, perms, avatars, buycmp, inqreads, cheques, msgtpls, deleted_archive, payables, supplier_finance, opex, petty_tx, petty_periods, shareholders, sharetx, fiscal_snapshots, techcases, calc_runs, techproposals, leadfinder_jobs, leadfinder_sources

---

## ۵. مرکز دانش v32 — رفع تکرار + UX زیبا

**قبل:** 16 خوشه / 12 آیکون یکتا (pipe×2, valve×2, instrument×2, electrical×2)

**بعد:**
- 16/16 یکتا: `pipe` vs `pipe_special`, `valve` vs `valve_special`, `instrument` vs `instrument_precision`, `electrical` vs `electrical_power` + quality, industry, rotating, procurement, flange, seal, process, mechanical
- UX: Hero gradient `#0f172a→#1e293b` + pattern + search زنده (`/` focus, `Esc` clear) + stats hover + chips filter + cards با border-top color + 44px icon + count badge + arrow hover + no-result

**تست:** search "API 6D" → 1 خوشه, Chip "برق" → 2 کارت با آیکون متفاوت (رعد vs ترانس) — `tester277 12 PASS`, `tester278 18 PASS`

---

## ۶. QA ساده‌شده

گیت1 فنی: syntax, audit.py 10 بخش, regression 260/5174
گیت2 انسانی: 4 نقش + مرکز دانش
گیت3 مدارک: RELEASE-NOTES, REGRESSION, FILES-CHANGED

---

## ۷. تاریخچه

v31.7 Baseline, v31.7.4 incident BUG-AUTH-001 100% 401, v31.7.8 hotfix JWT, v31.7.98 254 tester, v31.9 258 tester 806 token + offer duplicate, v32 16 آیکون یکتا + هنداور یکدست

---

## ۸. وضعیت فعلی

✅ مرکز دانش 16/16 یکتا, ✅ Auth flood رفع (اما 806 token قدیمی باقی), ✅ Offer duplicate guard, ✅ Handover یکدست بدون staging, ✅ ZIP کامل 25M 1678 files 188 images, ✅ 260 tester PASS

---

## ۹. چک‌لیست v32

- [x] knowledge-center 16 یکتا
- [x] Handover یکدست + staging خارج + 10 اصل
- [x] VER v32 + cache-bust
- [x] ZIP کامل (نه تک‌فایل)
- [x] 260 tester

---

## ۱۰. قوانین ثابت

Release کامل, Major/Patch, 48 کلید, Offer atomic + lineId, Deterministic ID, Icon یکتا, Token single-flight cap3, Staging خارج, Role-scoped, UAT

*پایان — v32 — یکدست، بدون staging، با اصول قابل دسترسی و مرکز دانش زیبا*
