# یادداشت انتشار CRM v34.8.40

**تاریخ:** ۲۰۲۶-۰۸-۲۹ | **مرجع:** `ROADMAP-THIN-CLIENT-REMAINING-2026-08-29.md` (فاز R2 / بند T5-2c)
**انتشار همراه:** ابزار CI دیپلوی استیجینگ (DEPLOY-SPEEDUP + TRUTHFUL-GREEN) — در
`_tools/PENDING-workflow-deploy-staging-speedup-v34.8.40.patch` منتظر اعمال مالک.

## T5-2c — پیش‌نویس‌ها، آینهٔ امضا و صف کدینگ به Dev-KV (IndexedDB)

**مسئله:** آخرین خانواده‌های دستهٔ DEV که هنوز مستقیم در localStorage نوشته می‌شدند:
پیش‌نویس‌های فرم پیشنهاد/بازنگری جایزه، آینهٔ بازیابی پروفایل امضا، و صف/پلن/ack
کدینگ — خلاف اصل E3 (LS فقط سبکِ قابل‌از-دست‌رفتن).

### تغییرها (الگوی مشترک: کش سنکرون در حافظه + پایدارسازی async در Dev-KV + fallback به LS تا قبل از مهاجرت)

1. **crm/offers.js**
   - `offerNew`: فرم **فوراً** با وضعیت تازه باز می‌شود؛ بررسی پیش‌نویس ذخیره‌شده
     async از Dev-KV انجام و در صورت وجود، همان confirm قبلی (بازیابی/حذف) نمایش
     داده می‌شود — رفتار کاربر بدون تغییر، بدون خواندن سنکرون LS.
   - `ptfTriggerAutoDraftSave`: ذخیره در Dev-KV (هر دو خانوادهٔ
     `ptf_autodraft_offer_` و `ptf_autodraft_award_revision_`)؛ بدون IDB → LS.
   - حذف پیش‌نویس پس از ثبت موفق → Dev-KV.
2. **crm/sales-domain-v2.js** — پیش‌نویسِ فرمِ رد‌شده (`register_offer` reject) →
   Dev-KV؛ مهاجرت امن boot از ۲ به **۸ پیشوند** گسترش شد.
3. **crm/case-revision.js** — پاک‌سازی پیش‌نویس بازنگری از Dev-KV.
4. **crm/letters.js** — helpers `sigRecoveryRead/Write/Hydrate`: کشِ درون‌حافظه‌ای +
   hydrate یک‌بار از Dev-KV (هر کلید فقط یک IDB-read) + تکرارِ یک‌بارِ resolve پس از
   hydrate تا منطق «بازیابی/تعمیر نسخهٔ جدیدتر» عیناً حفظ شود. صفر نوشتن LS برای
   `ptf_sig_profile_recovery_v1_*`.
5. **crm/codegen.js** — `devCache` (get/set/remove + hydrate بوت): صف TMP، پلن و ack
   کدهای تکراری؛ **جریان سنکرون تخصیص کد دست‌نخورده ماند** (تا hydrate/مهاجرت از
   legacy LS خوانده می‌شود → هیچ صفی گم نمی‌شود). صفر `localStorage` برای هر سه کلید.
6. **crm/golive.js** — پاک‌سازی go-live حالا Dev-KV را هم پاک می‌کند (+ پیشوند
   بازنگری)؛ پاک‌سازی legacy LS حفظ شد.
7. **crm/key-registry.js** — دستهٔ DEV دقیق شد: `ptf_autodraft_award_revision_` و
   پیشوند واقعی `ptf_sig_profile_recovery_v1_` اضافه؛ پیشوند نادرست `sigRecovery_`
   حذف شد.

### گیت‌ها

- **tester541** (ثبت در run-ci-gate): ۲۷ مورد — قرارداد منبع هر ۶ فایل + رفتاریِ
  vm برای رجیستری کلید.
- `run-ci-gate` ← **157 PASS / 0 FAIL** · `arch-guard` ← PASS
- **baseline A10 رتچت شد** (کاهش بدهی LS؛ امضاهای حذف‌شده غیرقابل‌برگشت).
- هم‌نسخگی ۸ نقطهٔ رسمی → `v34.8.40` (شامل crm/shell.js طبق قاعدهٔ A6).

### بعد از این نسخه (فاز R3)

کش‌های read-through با TTL (`ptf_site_*`، `ptf_fx_live_cache`، `ptf_cloud_usage*`،
`ptf_code_pool`) + بوت صفحه‌ای دستگاه جدید — طبق رودمپ.
