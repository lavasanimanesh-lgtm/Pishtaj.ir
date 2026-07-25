# آغاز Baseline جدید v31.7

**مبنای ورودی:** `v31.7.2`  
**تاریخ:** 2026-07-17  
**بازنگری:** 2026-07-19 — پس از incident BUG-AUTH-001  
**نوع:** آغاز baseline/Stage 0، نه release Production قابل استقرار

## ⚠️ الحاقیه بازنگری 2026-07-19 — ثبت نقض گیت و وضعیت واقعی

این baseline در 07-17 با blocker فعال `STAGE0-ENV-001` و ممنوعیت صریح «تغییر Production مالی» آغاز شد. **در عمل این گیت رعایت نشد:** در 07-18 بسته v31.7.4 (شامل ۱۲ اصلاح امنیتی P0/P1 از جمله فعال‌سازی verify_request) مستقیم و بدون staging به Production رفت و قطعی کامل احراز هویت (BUG-AUTH-001) رخ داد؛ ریکاوری در v31.7.8 (07-19) انجام شد. شرح کامل: `INCIDENT-REPORT-BUG-AUTH-001.md`.

**وضعیت واقعی فعلی baseline:**
- وضعیت قبلی `Prepared / Blocked for Active Evidence` دیگر توصیف واقعیت نیست؛ وضعیت جدید: **`Breached / Recovery-verification pending`**.
- Production روی v31.7.8 است؛ تأیید ریکاوری روی سرور واقعی طبق `PHASE0-PRODUCTION-RUNBOOK.md` هنوز ثبت نشده.
- `STAGE0-ENV-001` همچنان باز و اکنون **بالاترین اولویت ساختاری پروژه** است؛ ادامه هر تغییر امنیتی/سینک بدون staging ممنوع — این بار با گیت مکانیکی (tester183 + چک انتشار audit.py) پشتیبانی می‌شود.
- تصمیم رسمی کارفرما درباره زمان‌بندی provision staging لازم است (اقدام باز A5 گزارش incident).

## وضعیت ورودی baseline

- regression: 161 فایل PASS / 0 FAIL؛ 3808 چک PASS / 0 FAIL
- audit: همهٔ بررسی‌ها PASS، بدون warning
- ZIP ورودی: `pishtaj-release-v31.7.2.zip`
- هستهٔ hardening فعلی، integrity فروش مازاد light، پوشش backup، Go-Live reset، guardهای salesfile، procurement integrity، codegen fallback hardening، sync/auth admin token، role-scoped sync، server offer-code integrity و duplicate repair امن: آمادهٔ verification staging

## دامنهٔ baseline v31.7

1. FIN-WF-001 server auth/RBAC؛
2. policy چک شخصی؛
3. staging و evidence PoC؛
4. server-side audit؛
5. role policy matrix؛
6. تصمیم دربارهٔ consolidationهای معماری؛
7. گیت‌های ورود به implementation جدید.

## مواردی که در baseline آغاز نمی‌شوند

- US-436؛
- US-437؛
- migration داده؛
- تغییر Production مالی؛
- اجرای PoC mutation روی Production؛
- refactor معماری بدون approval.

## blockerهای ورود به Active Evidence

- `STAGE0-ENV-001`: staging مستقل با HTTPS، fixture، backup، secret و S3 prefix جدا.

`STAGE0-POLICY-001` با انتخاب رسمی `local-only` بسته شد؛ recovery چنددستگاهی چک شخصی عمداً خارج از scope است.

## معیار آغاز رسمی Active Evidence

```text
Baseline v31.7 Started = hardening PASS + isolated staging ready
```

تا فراهم‌شدن staging مستقل، این baseline در وضعیت `Prepared / Blocked for Active Evidence` باقی می‌ماند.
