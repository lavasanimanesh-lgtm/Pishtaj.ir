# ریلیزنوت v31.6.11 — سند سیاست recognition و reconciliation (FIN-WF-016)

## دامنه

- تفکیک منبع حقیقت سود پروژه از بدهی تأمین‌کننده؛
- سیاست عدم دوباره‌شماری payable در سود پروژه؛
- قواعد هزینهٔ linked/unlinked؛
- قواعد receipt، reversal و auto-settlement؛
- قواعد ارز و نرخ تسعیر؛
- طبقه‌بندی `matched`, `unlinked`, `undated`, `ambiguous`, `missing-rate`؛
- قالب گزارش reconciliation؛
- بدون تغییر workflow، schema یا دادهٔ Production.

## فایل‌های جدید

- `FIN-WF-016-RECOGNITION-POLICY-v31.6.11.md`
- `FIN-WF-016-RECONCILIATION-REPORT-TEMPLATE-v31.6.11.md`

## تست

- regression کامل پس از bump نسخه اجرا می‌شود.
- audit بدون error؛ هشدار تصاویر حجیم باقی است.

## محدودیت

این Sprint سند سیاست و قالب reconciliation تحویل می‌دهد و اصلاح خودکار داده انجام نمی‌دهد. FIN-WF-001، policy چک شخصی و staging خارج از دامنه‌اند.

## نسخه

- `VER v31.6.11`
- `CACHE ptf-crm-v31.6.11`
