# Stage 0 Active Evidence Pack — v31.7

**نوع:** بستهٔ آماده‌سازی Evidence، بدون deploy و بدون تغییر Production  
**وضعیت:** آمادهٔ اجرا پس از فراهم‌شدن policy و staging

## هدف

تبدیل Stage 0 از PASS طراحی/BLOCKED عملیاتی به evidence قابل بررسی، بدون حدس دربارهٔ config واقعی Production.

## blocker واقعی

1. staging مستقل، URL، دسترسی و backup هنوز فراهم نشده است.

policy چک شخصی در `STAGE-0-POLICY-DECISION-RECORD-v31.7.md` روی `local-only` ثبت شده است؛ recovery چنددستگاهی و private sync در این baseline اجرا نمی‌شوند.

تا فراهم‌شدن staging مستقل، PoC فعال اجرا نمی‌شود.

## خروجی‌های آماده

- fixture: `STAGE-0-FIXTURE-SPEC-v31.7.2.json`
- baseline: `STAGE-0-BASELINE-MANIFEST-v31.7.2.txt`
- معماری: `FIN-WF-001-SERVER-AUTH-ARCHITECTURE-v28.3.md`
- اثرسنجی: `FIN-WF-001-IMPACT-ANALYSIS-v28.3.md`
- وضعیت رسمی: `STAGE-0-AND-SPRINT-1-STATUS-v1.md`

## ترتیب اجرای Evidence

1. Provision staging و تنظیم HTTPS.
2. نصب کد بدون `crm/data` و بدون secret Production.
3. اعمال fixture و hash baseline.
4. ثبت response/config baseline.
5. اجرای PoC-A درخواست مجاز.
6. اجرای PoC-B جعل `X-CRM-Role`.
7. اجرای درخواست بدون token.
8. بررسی sync، backup، API و storage.
9. reset fixture.
10. ثبت حکم نهایی: `Confirmed exploitable`، `Mitigated externally` یا `Inconclusive`.

## گیت خروج

- همهٔ responseها و revisionها ثبت شده باشند؛
- قبل/بعد fixture برابر و قابل تطبیق باشد؛
- هیچ mutation روی Production انجام نشده باشد؛
- rollback staging اجرا شده باشد؛
- Architecture و Impact Analysis تأیید شده باشند؛
- حکم Production-risk مستند شده باشد.

## حکم فعلی

این بسته آماده است، اما تا زمان فراهم‌شدن دو پیش‌نیاز بالا **Active Evidence شروع نشده است**.
