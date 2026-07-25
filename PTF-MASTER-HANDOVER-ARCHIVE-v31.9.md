# 📘 سند جامع انتقال معماری و راهنمای ایجنت — PTF Master Handover — v32.0.1

**نسخه:** v32.0.1 — HOTFIX SECURITY (Sprint 0) — بر پایه v32 KNOWLEDGE-CENTER-UNIQUE-ICONS
**تاریخ:** 2026-07-24
**مبنا:** v32 → v32.0.1 Patch (6 باگ P0 امنیتی)

> **قوانین یکدست از v32:**
> - فیچر → Major: 31.9→32→33
> - هات‌فیکس → Patch: 32→32.0.1
> - هر ریلیز ZIP کامل
> - Staging خارج

## 1. اصول 10گانه برای ایجنت بعدی
1. 48 کلید Sync
2. Auth JWT 7 روزه
3. Offer atomic + lineId
4. ID Deterministic
5. Token anti-flood (single-flight cap3)
6. Icon یکتا (16/16)
7. File DB lock
8. Role-scoped sync
9. Release کامل
10. UAT 15 دقیقه

## 2. نسخه‌گذاری
فیچر → 32, هات‌فیکس → 32.0.1

## 3. Staging خارج
فقط audit.py + regression 262 + UAT

## 4. معماری v32.0.1
Website + KC v32 (16 unique) + CRM SPA + Sync + PHP API + S3 + Auth hashed + XSS guard + fail-closed secrets

## 5. مرکز دانش v32 — 16/16 یکتا
pipe vs pipe_special, valve vs valve_special, instrument vs instrument_precision, electrical vs electrical_power

## 6. امنیت v32.0.1 — 6 فیکس P0
- US-438 cms.php JWT role (نه X-CRM-Role header)
- US-439 token فقط Header
- US-440 secrets fail-closed (500 اگر ptf-secrets.php نباشد)
- US-441 tokens.json hashed (64 hex) + prune 806
- US-442 DOMPurify + xss-guard.js
- US-443 codegen flock تایید

## 7. چک‌لیست انتشار
- [x] 16 آیکون یکتا
- [x] Handover یکدست + staging خارج
- [x] VER v32.0.1
- [x] 6 فیکس امنیتی
- [x] ZIP کامل 25M

## 8. قوانین ثابت
Release کامل, Major/Patch, 48 کلید, Offer atomic, Deterministic ID, Icon یکتا, Token single-flight, Staging خارج, Role-scoped, UAT

*پایان — v32.0.1*
