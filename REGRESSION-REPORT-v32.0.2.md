# Regression v32.0.2 — 262 testers PASS + 1 new hotfix test

**نسخه:** v32.0.2 — Hotfix captcha guard
**مبنا:** v32.0.1 (262 testers / 5234 checks)

## نتیجه

| معیار | نتیجه |
|---|---:|
| Audit.py | PASS |
| Tester | 263 |
| PASS | 263 |
| FAIL | 0 |
| Check | 5244 (+10) |

## تست جدید

- `tester281-captcha-guard-fix.js` — 10 چک:
  - بدون secret → data_pull 200 (نه 500)
  - با secret → captcha_new 200
  - بدون secret → captcha_new 500
  - otp_token_make بدون secret → 500
  - data_rev بدون secret → 200

## Regression قبلی حفظ

- tester279 role spoof 5 PASS
- tester280 token header only 6 PASS
- tester277/278 مرکز دانش 30 PASS
- 258 تستر قدیمی حفظ

**وضعیت:** گیت فنی سبز — رفع باگ گزارش شده شما — قابل دیپلوی فوری
