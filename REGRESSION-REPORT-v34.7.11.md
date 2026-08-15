# Regression Report v34.7.11

تاریخ اجرا: 2026-08-15

مبنای مقایسه: v34.7.10

## نتیجه خلاصه

| شاخص | v34.7.10 | v34.7.11 | تغییر |
|---|---:|---:|---:|
| تعداد تسترها | 398 | 399 | +1 |
| فایل‌های PASS | 341 | 342 | +1 |
| فایل‌های FAIL | 57 | 57 | 0 |
| checkهای PASS | 5909 | 5927 | +18 |
| checkهای FAIL | 129 | 129 | 0 |

**نتیجه:** ۱۸ check جدید مسیر disaster recovery سبز است و تست‌های قدیمی backup نیز به baseline سبز بازگشتند. هیچ شکست جدیدی نسبت به v34.7.10 وجود ندارد.

## UAT اختصاصی

`tester416-v34.7.11-backup-disaster-recovery.js`: **18 PASS / 0 FAIL**

- parse امن پاسخ server backup
- پشتیبانی پاسخ خام backup بدون `ok`
- مجوز admin/chairman
- modal loading/error و retry
- ترتیب جدیدترین بک‌آپ
- preview تعداد پرونده‌ها
- جلوگیری از overwrite بک‌آپ سالم با وضعیت خراب قبل Restore
- rollback local روی شکست سرور
- الزام `d.ok`
- restore authoritative بدون tombstone جدیدتر
- bypass کنترل‌شده duplicate/conflict/zero guard
- حفظ whitelist و role guard دانلود بک‌آپ

تسترهای قدیمی:

- `tester293-backup-urgent`: **15 PASS / 0 FAIL**
- `tester295-backup-phase1`: **12 PASS / 0 FAIL**
- `tester296-backup-phase2`: **10 PASS / 0 FAIL**
- `tester38-v1223`: **29 PASS / 0 FAIL**
- `tester80-v162`: **15 PASS / 0 FAIL**

## گیت انتشار

- CI متمرکز: **35 PASS / 0 FAIL**
- PHP CLI: **SKIP**
- `git diff --check`: PASS
- PHP parser مستقل: **PASS**
- Auditor روی 624 صفحه: **PASS**
- VERSION/PWA و 100 مرجع cache-query: **PASS**
