# یادداشت انتشار v34.39.19 — نمایندۀ مسئولِ RFQ + سپرهای ادغامِ پروندهٔ فروش + رفع‌شدنِ حذفِ ناقصِ تماس‌ها

**تاریخ:** 2026-09-21
**کانال:** CRM (اسمارت‌میز) + پی‌اِی‌آیِ فروش (sales-domain / crm)
**قرارداد:** تسترهای UAT + arch-guard A6/A11 + `ARENA-CRM-CONTACT-STALE-PARTIAL-WIPE-RCA-2026-09-21.md`

## درخواست کارفرما
> «نمایندۀ مسئول برای هر استعلام (RFQ) — روی فرم قابل انتخاب و حذف — و اگر بعداً تماس/مشتری از همان استعلام ساخته شود، مسئولیت به همان نماینده برسد؛ همچنین ادغام‌های «پروندهٔ فروش» (SalesFile) نباید دادهٔ زنده را بپوشند.»

## آنچه انجام شد
1. **نمایندۀ مسئولِ RFQ (client):** در فرم استعلام، انتخاب‌شونده/قابل حذف از تیلری‌های معتبر (`assignee` + `assigneeAtISO` + `assigneeSrc`)؛ با `_clearAssignee` برای حذف صریح؛ نمایش در ردیف RFQ با رنگ مسئول و پاک‌سازی در تغییر «فروخته/رد/لغو».
2. **حفظِ سمت سرور (server, CARTABLE-LOOP):** `sd_preserve_rfq_assignee` در sales-domain — اگر کلاینت assignee نفرستد، مقدار قبلی رکورد حفظ می‌شود (قبل از این، هر ذخیرهٔ دیگری مسئولیت را پاک می‌کرد). **اصلاحِ نسخهٔ فعلی (ASSIGNEE-CLEAR-NULLED):** در شاخهٔ پاک‌سازی، `assignee`/`assigneeAtISO` به `null` تنظیم می‌شوند نه `unset` — چون merge CARTABLE-LOOP «کلید غایب = حفظ prev» است و با `unset` پاک‌سازیِ صریح بی‌اثر می‌شد (سنجهٔ واحد B5: پیشِ اصلاح FAIL، پسِ اصلاح PASS).
3. **سپرهای ادغامِ پروندهٔ فروش (SF):** ۷ محافظ در `crm.php` (SD_SFMERGE_GUARDS) — ادغامِ پروندهٔ فروش دیگر نمی‌تواند رکورد زندهٔ دیگری را با رکورد فرود (void/zero/orphan) بپوشد؛ گزارش `nested mass-deletion report` نیز با درصدهای محافظت‌شده.
4. **بازشناسیِ یتیم (orphan re-detect):** `sd_contact_stale_merge` + `ptfMergeCustContactsFromLive` — تشخیص «تماس یتیم» فقط با `caseCd`/`dealCd` اعتبارمند و بدون حذفِ سراسری؛ همراه با RCA کاملِ حادثهٔ «حذف ناقصِ تماس‌ها» (۵ سنجهٔ واحد، `ARENA-CRM-CONTACT-STALE-PARTIAL-WIPE-RCA-2026-09-21.md`).
5. **REALBUY-FINANCE (قراردادِ مصوب):** `commission.js` — تشخیصِ «پرداخت کامل» به‌جای مبلغِ خامِ فاکتور (قراردادِ v34.5.35)، خالصِ بعد از مرجوعی (`invoiceNetAfterReturnsIRR` = max(0, amount − returned)، شامل VATِ سهمِ فسخ‌نشده) با fallback به amount/totalAmountIRR است. دلیل: فاکتورِ دارای مرجوعی دیگر پورسانت را برای همیشه قفل نمی‌کند (صورتِ بازماندهٔ خام دیگر قابل وصول نیست). pinِ زنجیره‌ایِ v34.5.35 در tester424 به قراردادِ جدید به‌روزرسانی شد (تصمیمِ کارفرما، 2026-09-21).
6. **COMMISSION-ARCHIVE-ZERO:** پروندهٔ فروشِ آرشیو‌شده دیگر رقمِ کمیسیونِ پنهان نمی‌سازد (مطابقتِ `archivedSalesFile` client/server).

## رفع‌ها این نسخه (پس از بازبینیِ مستقل)
- **B1 — نابسامانیِ ورژن:** ۱۰ نقطهٔ رسمی (VERSION.json، sw.js×۳، clear-cache×۲، shell.js، cms.js، device-reconnect×۲، SD_SERVICE_VERSION) به 34.39.19 + این یادداشت + بازتنظیمِ ۶۴۱ پین با `bump-version-pins.js` (arch-guard A6: قبلاً FAIL، اکنون PASS).
- **B4 — ته‌پایِ `crm/index.html`:** ۶ خطِ تکراریِ بعد از `</html>` (دوباره‌باریِ سه اسکریپتِ رسمی) حذف شد — خطای «Unexpected token «<'» در مرورگر و اجرای دوبارهٔ `official-invoice-v2.js`/`tax-returns.js`/`case-revision.js`.
- **B3 — پاک‌سازیِ نماینده:** همان موردِ ۲ (null به‌جای unset).

## فایل‌ها
`crm/bridge.js` (UI مسئول) · `crm/sales-domain-v2.js` (پاک‌سازی/دلیلِ لمس + باندلیِ SF) · `crm/offers.js` · `crm/sync.js` · `crm/commission.js` · `api/sales-domain.php` (CARTABLE-LOOP + SF guard + یتیم) · `api/crm.php` (SD_SFMERGE_GUARDS) · `crm/index.html` (bust + پاک‌سازیِ ته‌پای) · `VERSION.json` + ۸ نقطه · `RELEASE-NOTES-v34.39.19.md`.

## دروازه
arch-guard A6/A11: PASS · UAT: ۲۸۶/۲۸۶ PASS · سنجه‌های واحدِ RCA/assignee/SF/orphan: ۴۴/۴۴ PASS.
