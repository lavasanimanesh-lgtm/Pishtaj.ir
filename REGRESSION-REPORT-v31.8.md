# گزارش رگرسیون کامل — v31.8

**تاریخ اجرا:** 2026-07-23  
**گیت:** `python3 _tools/audit.py` + `node _tools/run-full-regression.js`

| شاخص | نتیجه |
|---|---:|
| Audit | PASS |
| Testerها | 257 |
| Tester file PASS | 257 |
| Tester file FAIL | 0 |
| Check PASS | 5,110 |
| Check FAIL | 0 |
| Timeout / Hung | 0 |

## پوشش v31.8
- Token/session stabilization: tester277، 6 PASS.
- Offer Sync Integrity: tester278، 6 PASS.
- Exact-only offer repair: tester279، 4 PASS.

## نتیجه
✅ گیت فنی PASS. پیش از Production، UAT دستی login/sync چنددستگاهی و preview تعمیر `PTF-CO-1405-0444` الزامی است.
