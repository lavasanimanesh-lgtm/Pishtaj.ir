# 📊 گزارش رگرسیون v31.7.31

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.31`  
**موضوع:** `BUG-OFF-REV-001` — اصلاح ریشه‌ای رفتار ویرایش/نگارش پیشنهادها

---

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|---|---:|---|
| تعداد تسترها | **184** | — |
| فایل‌های PASS | **184** | ✅ |
| فایل‌های FAIL | **0** | ✅ |
| مجموع چک‌های PASS | **4149** | ✅ |
| مجموع چک‌های FAIL | **0** | ✅ |
| تستر جدید | `tester206-offer-edit-revision-identity.js` | ✅ 13/13 |
| تستر مرتبط آپدیت‌شده | `tester199-offer-vanish.js` | ✅ 13/13 |
| `node --check crm/offers.js` | PASS | ✅ |

خروجی کامل runner:

```json
{
  "date": "2026-07-20T22:05:12.007Z",
  "version": "v31.7.31",
  "testers_total": 184,
  "files_pass": 184,
  "files_fail": 0,
  "checks_pass": 4149,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

---

## 🆕 پوشش تست جدید

### `_tools/uat/tester206-offer-edit-revision-identity.js`

سناریوهای پوشش‌داده‌شده:

1. `offerEdit` باید فرم را با `editMode='direct'` و شماره پایه باز کند.
2. ویرایش مستقیم نباید `explicitRevision` باشد.
3. اگر شماره فرم هنگام ویرایش خراب/stale شود، شماره به شماره اصلی برگردانده می‌شود.
4. `offerReviseClone` باید فرم را با `editMode='revision'` و همان شماره پایه باز کند.
5. نگارش جدید فقط Rev را روی همان شماره افزایش می‌دهد.
6. ویرایش stale بدون رکورد اصلی block می‌شود و پیشنهاد جدید نمی‌سازد.
7. گارد duplicate شماره برای پیشنهادهای جدید (`editMode='new'`) حفظ شده است.

نتیجه اجرای مستقیم:

```text
tester206-offer-edit-revision-identity: 13 PASS / 0 FAIL
```

---

## 🔁 تستر مرتبط آپدیت‌شده

### `_tools/uat/tester199-offer-vanish.js`

این تستر قبلاً انتظار داشت منطق داخلی `forceRev = o.editMode === 'revision'` وجود داشته باشد. با اصلاح ریشه‌ای v31.7.31، منطق به helper هویت ذخیره منتقل شد و assertion به سیاست جدید به‌روزرسانی شد:

- پیشنهاد جدید با شماره تکراری همچنان regen/block می‌شود.
- مسیر ویرایش واقعی identity-safe است.
- Rev فقط با «نگارش جدید» افزایش می‌یابد.
- `afterSent` دیگر سبب Rev خودکار نمی‌شود.

نتیجه:

```text
tester199-offer-vanish: 13 PASS / 0 FAIL
```

---

## 📁 فایل‌های تغییر یافته

```text
crm/offers.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester199-offer-vanish.js
_tools/uat/tester206-offer-edit-revision-identity.js
_tools/last-regression.json
RELEASE-NOTES-v31.7.31.md
REGRESSION-REPORT-v31.7.31.md
```

---

## 🚦 وضعیت گیت‌ها

- تستر اختصاصی BUG-OFF-REV-001: ✅ PASS
- رگرسیون کامل UAT: ✅ PASS
- فایل FAIL: ✅ صفر
- چک FAIL: ✅ صفر
- گیت انسانی: ⏳ نیازمند راستی‌آزمایی کارفرما در مرورگر واقعی طبق Release Notes

---

## مراحل راستی‌آزمایی پیشنهادی کارفرما

1. یک پیشنهاد موجود را ویرایش کنید.
2. یک فیلد را تغییر دهید و ذخیره کنید.
3. بررسی کنید `Rev` تغییر نکرده و شماره همان است.
4. سپس «نگارش جدید» را بزنید.
5. ذخیره کنید.
6. بررسی کنید شماره همان است و فقط `Rev` یک واحد افزایش یافته است.
