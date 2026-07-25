# Release Notes — v31.7.54

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.54`  
**نوع:** TOOLS-LICENSE-ADMIN-001 — پنل صدور و مدیریت لایسنس ابزارهای مهندسی در CRM

---

## هدف ریلیز

پس از تکمیل فازهای کنترل localStorage، گام بعدی برای تجاری‌سازی ابزارهای مهندسی انجام شد: ادمین/رییس بتواند از داخل CRM برای ابزارهای پیشرفته، لایسنس صادر و مدیریت کند؛ بدون ویرایش دستی فایل JSON روی سرور.

این فاز هنوز درگاه پرداخت آنلاین نیست. مدل فعلی همچنان:

```text
Manual invoice / manual payment confirmation / admin license issue
```

---

## RCA / دلیل دقیق

1. زیرساخت قبلی `api/tools.php` فقط امکان `license_check` و `grant_verify` داشت.
2. لایسنس‌ها باید دستی در فایل runtime زیر ساخته می‌شدند:

```text
crm/data/tool_licenses.json
```

3. این روش برای استفاده واقعی و تیم بازرگانی مناسب نبود، چون نیاز به دسترسی فنی سرور داشت.
4. درگاه پرداخت و صدور خودکار پس از payment هنوز پیاده‌سازی نشده‌اند، اما برای شروع فروش B2B/فاکتور دستی، ابتدا باید پنل صدور لایسنس داخل CRM آماده می‌شد.
5. اصل امنیتی حفظ شد: کد خام لایسنس در سرور ذخیره نمی‌شود؛ فقط HMAC ذخیره می‌شود.

---

## کارهای انجام‌شده

### 1) Admin API برای مدیریت لایسنس

در `api/tools.php` اکشن‌های جدید اضافه شد:

```text
admin_list
admin_issue
admin_update
```

این اکشن‌ها با JWT CRM محافظت می‌شوند و فقط نقش‌های زیر اجازه دارند:

```text
admin
chairman
```

---

### 2) صدور لایسنس از سرور

`admin_issue` کد خام را سمت سرور با `random_bytes` می‌سازد و فقط همان یک‌بار به ادمین برمی‌گرداند.

در فایل runtime فقط این مقدار ذخیره می‌شود:

```php
'tokenHash' => tools_token_hash($rawCode)
```

و خروجی safe برای لیست هرگز `tokenHash` یا کد خام را نشان نمی‌دهد.

---

### 3) فرمت ذخیره runtime

فایل runtime:

```text
crm/data/tool_licenses.json
```

به شکل wrapper ذخیره می‌شود:

```json
{
  "updatedAt": "...",
  "licenses": []
}
```

`tools_load_licenses()` همچنان با فرمت قدیمی array هم سازگار است.

---

### 4) پنل CRM برای صدور لایسنس

فایل جدید:

```text
crm/tool-licenses.js
```

در تنظیمات CRM تزریق می‌شود و فقط برای admin/chairman نمایش دارد.

امکانات:

```text
صدور لایسنس تک‌گزارش
صدور subscription / enterprise
صدور staff_internal برای پرسنل شرکت
انتخاب tool: Control Valve / all / planned tools
تعریف maxReports
تعریف expiresAt
ثبت company/contact/note
نمایش کد خام فقط یک‌بار
کپی کد خام
لیست لایسنس‌ها
فعال / تعلیق / ابطال
```

---

## نکته مهم درباره درگاه پرداخت

زیرساخت درگاه پرداخت آنلاین هنوز پیاده‌سازی نشده است. این ریلیز فقط **صدور و مدیریت لایسنس دستی** را عملیاتی می‌کند.

برای payment automation هنوز این فازها لازم است:

```text
PAYMENT-SCAFFOLD-001    ساخت order/callback/provider adapter
AUTO-LICENSE-ISSUE-001  صدور خودکار لایسنس پس از تایید پرداخت
REPORT-CONSUME-001      کم‌کردن quota هنگام تولید گزارش نهایی
```

همچنین برای اتصال واقعی درگاه، اطلاعات provider/merchant/callback لازم است.

---

## فایل‌های تغییر یافته

```text
api/tools.php
crm/tool-licenses.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
_tools/uat/tester231-tools-license-admin.js
RELEASE-NOTES-v31.7.54.md
REGRESSION-REPORT-v31.7.54.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester231-tools-license-admin.js
```

پوشش:

- وجود admin actions در `api/tools.php`.
- محافظت admin API با JWT.
- محدودیت نقش به admin/chairman.
- تولید کد خام با `random_bytes`.
- ذخیره فقط `tokenHash`.
- عدم نمایش raw/tokenHash در خروجی safe.
- وجود UI در تنظیمات CRM.
- ارسال `X-CRM-Token` در درخواست‌ها.
- صدور staff license با tool=all و maxReports=9999.
- active/suspended/revoked.

نتیجه مستقیم:

```text
tester231-tools-license-admin: 17 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| License API | اکشن‌های admin اضافه شد | متوسط/کنترل‌شده |
| Security | JWT + role guard + HMAC-only storage | مثبت |
| CRM Settings | پنل صدور و مدیریت لایسنس اضافه شد | کم/متوسط |
| Public tools | مسیر license_check قبلی حفظ شد | کم |
| Payment gateway | هنوز پیاده‌سازی نشده | بدون تغییر |
| Runtime data | `crm/data/tool_licenses.json` روی سرور ساخته/آپدیت می‌شود | متوسط |

---

## راستی‌آزمایی کارفرما

1. وارد CRM با نقش admin یا chairman شوید.
2. به تنظیمات بروید.
3. بخش «مدیریت لایسنس ابزارهای مهندسی» را پیدا کنید.
4. شرکت/مخاطب/نوع/ابزار/انقضا را وارد کنید.
5. روی «صدور لایسنس» بزنید.
6. کد خام را همان لحظه کپی کنید؛ بعداً دیگر از سرور قابل مشاهده نیست.
7. در `/tools/` همان کد را در paywall وارد کنید.
8. برای Control Valve Advanced باید draft/prelim calculation باز شود.
9. از لیست CRM، وضعیت لایسنس را suspended یا revoked کنید و دوباره تست کنید.

---

## نتیجه

اکنون صدور لایسنس ابزارهای مهندسی از داخل CRM امکان‌پذیر است و دیگر نیاز به ویرایش دستی JSON روی سرور نیست. گام بعدی در صورت تایید، ساخت scaffold پرداخت آنلاین و صدور خودکار لایسنس پس از callback معتبر درگاه است.
