# یادداشت انتشار CRM v34.8.39

**تاریخ:** ۲۰۲۶-۰۸-۲۹ | **مرجع:** `ROADMAP-THIN-CLIENT-REMAINING-2026-08-29.md` (فاز R1 / بند T5-2b)

## T5-2b — تشخیصی‌های فرمان به IndexedDB (پایان نوشتن مستقیم LS در sales-domain-v2)

**مسئله:** کلیدهای تشخیصی/عملیاتی فرمان (`ptf_sales_command_uncertain_/not_committed_/
recovered_/post_ack_warning_…` و `ptf_offer_post_ack_warning_*`) هنوز مستقیم در
localStorage نوشته می‌شوند — آخرین تخلفِ دستهٔ DEV از اصل E3 رودمپ نازک‌سازی
«LS فقط سبکِ قابل‌از-دست‌رفتن».

### تغییرها

1. **crm/storage-quota.js (لایهٔ داده، مجاز A10):**
   - `idbDelete` + `idbKeysByPrefix` (cursor) به primitiveهای IDB اضافه و صادر شدند.
   - **نمای واحد `ptfDevKv`** (set/get/remove/keys) با شناسهٔ `devkv:` روی همان
     IndexedDB لایهٔ ذخیره‌سازی؛ اگر IDB در دسترس نباشد (حالت خصوصی/مرورگر قدیمی)
     مطابق رودمپ به LS برمی‌گردد — fallback = وضعیت امروز، بدون برگشت عملکرد.
   - **`ptfDevKvMigratePrefixes`**: مهاجرت امن پیشوندها از LS به IDB با الگوی T5-3
     (نوشتن در IDB موفق → فقط آن‌وقت حذف از LS). بعد از اولین اجرا no-op ارزان است.

2. **crm/sales-domain-v2.js — صفر `localStorage` برای پیشوندهای تشخیصی:**
   - `persistCommandDiagnostic` (uncertain/post_ack_warning/handler_warning) → Dev-KV.
   - `ptfRecoverUncertainSalesCommands`: اسکن و نوشتن not_committed/recovered → Dev-KV؛
     امضا همان Promise قبلی ماند.
   - `saveOfferAckWarning` → Dev-KV.
   - `financeUncertainRows` async شد؛ دیالوگ «بررسی رسید فرمان مالی» فوراً باز و
     فهرست/پیش‌پر شدن شناسه پس از بارگذاری IDB تکمیل می‌شود.
   - در بوتِ ماژول، مهاجرت یک‌باره برای دو پیشوند اجرا می‌شود.

3. **هارنس‌های رفتاری** tester442/446 (و 445 که از 442 عبور می‌کند) با نمای
   `ptfDevKv` پشت LS ساختگی خود مجهز شدند — همان ادعای دوام تشخیصی، با قرارداد جدید.

4. **tester539** (ثبت در run-ci-gate): قرارداد منبع هر دو فایل + اجرای رفتاری
   storage-quota.js در vm با IDB/LS ساختگی — دور کامل set/get/keys/remove،
   fallback بدون IDB، مهاجرت LS→IDB و no-op بودن مهاجرت تکراری.

### گیت‌ها

- `run-ci-gate` ← **155 PASS / 0 FAIL** (۱۵۴ + tester539)
- `arch-guard` ← PASS؛ **baseline A10 رتچت شد: ۲۶۱ → ۲۵۳** (۸ امضای حذف‌شده دیگر
  قابل‌برگشت نیستند — افزایش = شکست گیت)
- هم‌نسخگی ۷ نقطهٔ رسمی → `v34.8.39`

### بعد از این نسخه (فاز R2)

پیش‌نویس‌ها و صف کدینگ (`ptf_autodraft_offer_/award_revision_`، `sigRecovery_*`،
`ptf_code_tmp_queue/plan/ack`) → Dev-KV با بازآرایی async جریان فرم — طبق
`ROADMAP-THIN-CLIENT-REMAINING-2026-08-29.md`.
