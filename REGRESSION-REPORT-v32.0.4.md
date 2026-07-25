# Regression v32.0.4 — STABILITY

**نسخه:** v32.0.4 — 5 US Stability  
**مبنا:** v32.0.3 (263 testers)

## نتیجه

| معیار | نتیجه |
|---|---:|
| Audit.py | PASS |
| Tester | 268 |
| PASS | 268 |
| FAIL | 0 |
| Check | 5284 (+40) |

## تست‌های جدید Sprint 1 (+5 tester)

- tester282-file-mime-validate — 8 چک: php disguised → block, mime list, head scan
- tester283-race-flock — 6 چک: load_data uses flock SH, save_data uses tmp+flock EX
- tester284-quota-guard — 8 چک: try/catch QuotaExceeded, draft removal, toast
- tester285-contact-log-rotate — 6 چک: 5MB rotate, keep 10, .htaccess
- tester286-margin-server — 12 چک: calc_margin_server exists, case calc_margin, formula (buy 100 sell 150 → 33.3%), coverage

## Regression قبلی حفظ

- 263 تستر قبلی (v32.0.3) PASS: role spoof, token header, hashed storage, XSS, captcha fallback, knowledge-center 16 icons, etc.

## Syntax

- PHP: `php -l api/storage-lib.php`, `contact.php`, `crm.php` → PASS
- JS: sync.js, ai-tech-assistant.js → PASS

**وضعیت:** گیت فنی سبز — قابل دیپلوی Production — ریسک کم (فقط پایداری)
