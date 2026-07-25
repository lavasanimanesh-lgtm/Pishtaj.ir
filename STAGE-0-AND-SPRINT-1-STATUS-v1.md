# وضعیت رسمی Stage 0 و Sprint 1

**تاریخ شروع:** ۱۴۰۵/۰۴/۲۳  
**محدودهٔ مجاز فعلی:** مستندسازی، fixture، baseline hash و PoC غیرمخرب  
**محدودهٔ ممنوع:** تغییر کد production، deploy، migration، حذف داده، PoC mutation روی production

---

## Stage 0 — مدل مرجع و آمادگی اجرایی

| کنترل | وضعیت | شواهد |
|---|---|---|
| مدل دادهٔ مرجع مالی | PASS (طراحی) | `FINANCIAL-P0-DESIGN-POC-ROADMAP-v28.3.md` |
| Architecture FIN-WF-001 | PASS (طراحی) | `FIN-WF-001-SERVER-AUTH-ARCHITECTURE-v28.3.md` |
| Impact Analysis FIN-WF-001 | PASS (طراحی) | `FIN-WF-001-IMPACT-ANALYSIS-v28.3.md` |
| Roadmap ده Sprint و استقرار عملیاتی | PASS (طراحی) | `FINANCIAL-10-SPRINT-EXECUTION-GOVERNANCE-v1.md` |
| Fixture ساختگی | PASS (مشخصات) | `FINANCIAL-WORKFLOW-FIXTURE-SPEC-v1.json` |
| تصمیم policy چک شخصی | BLOCKED | انتخاب `local-only` یا `private encrypted sync` لازم است |
| محیط staging جدا | BLOCKED | URL/دسترسی/backup staging هنوز اعلام نشده است |
| تایید شروع Stage 0 | PENDING | پس از رفع دو تصمیم BLOCKED |

### حکم Stage 0
**PASS طراحی / BLOCKED عملیاتی**. Stage 0 برای شروع implementation کامل نشده است، اما همهٔ خروجی‌های طراحی آماده‌اند.

---

## Sprint 1 — PoC امنیتی FIN-WF-001

| کنترل | وضعیت | شواهد |
|---|---|---|
| Static source evidence | PASS | `poc-fin-wf001-static-v1.js` |
| اجرای شبکه/داده | NOT RUN | عمداً؛ بدون staging مجاز نیست |
| PoC-A روی staging | BLOCKED | نیازمند staging و مجوز |
| PoC-B جعل header روی staging | BLOCKED | نیازمند staging و مجوز |
| بررسی config Production | BLOCKED | نیازمند بررسی `PTF_ENFORCE_HMAC`/gateway بدون افشای secret |
| Passive production check | NOT RUN | نیازمند مجوز مشخص کارفرما |
| راهکار session/RBAC | PASS (طراحی) | Architecture document |

### حکم Sprint 1 فعلی
**IN PROGRESS / BLOCKED FOR ACTIVE EVIDENCE**

هیچ evidence فعال دربارهٔ قابلیت سوءاستفاده Production هنوز وجود ندارد و نباید چنین ادعایی مطرح شود. Static source evidence فقط نشان می‌دهد ریسک معماری معتبر است.

---

## شواهد لازم برای تبدیل Sprint 1 به PASS

1. staging clone با دادهٔ fixture؛
2. backup و hash baseline staging؛
3. مجوز اجرای PoC غیرمخرب staging؛
4. اجرای PoC-A/B و ثبت response/hash قبل و بعد؛
5. cleanup یا reset fixture؛
6. بررسی config production توسط مسئول سرور؛
7. گزارش نتیجه: `Confirmed exploitable`، `Mitigated externally` یا `Inconclusive`.

---

## گیت Sprint 2

Sprint 2 شروع نمی‌شود مگر اینکه Sprint 1 وضعیت **PASS** بگیرد و کارفرما Architecture، Impact Analysis و حکم PoC را تایید کند.
