# Release Notes — v31.7.32

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.32`  
**نوع:** 🔴/🟢 WEB-SPRINT-01 — Trust & Conversion Foundation

---

## 🎯 هدف ریلیز

شروع اجرای رودمپ پنل تخصصی وب‌سایت با تمرکز بر دو ریسک بنیادین:

1. **WEB-RFQ-001:** فرم RFQ صفحه اصلی نباید کد رهگیری تصادفی/کلاینتی بسازد یا در صورت خطای سرور پیام موفقیت بدهد.
2. **WEB-SEO-001:** `sitemap.xml` باید فقط URLهای public واقعی و موجود در پکیج را شامل شود، نه URLهای stale یا بدون فایل.

---

## 1) WEB-RFQ-001 — اصلاح ریشه‌ای فرم RFQ صفحه اصلی

### مشکل قبلی

در `index.html` فرم سریع صفحه اصلی این رفتار را داشت:

- کد رهگیری با `Math.random()` در مرورگر ساخته می‌شد.
- درخواست به `api/crm.php?action=add_rfq` ارسال می‌شد.
- مسیر `add_rfq` برای public RFQ رسمی نیست و با قرارداد `add_rfq_site` هم‌راستا نبود.
- خطای fetch نادیده گرفته می‌شد و با وجود خطا، پیام موفقیت و لینک tracking نمایش داده می‌شد.

این موضوع از نظر تجاری و اعتماد کاربر P0 بود.

### رفتار جدید

فرم Home اکنون دقیقاً با زنجیره واقعی RFQ سایت هم‌مسیر است:

```text
Home RFQ → api/crm.php?action=add_rfq_site → server-generated code → tracking/?code=...
```

قواعد جدید:

- هیچ کد رهگیری در مرورگر ساخته نمی‌شود.
- success فقط وقتی نمایش داده می‌شود که سرور `ok:true` و `code` برگرداند.
- اگر سرور خطا بدهد، پیام خطای fail-closed نمایش داده می‌شود و تصریح می‌کند هیچ کد رهگیری صادر نشده است.
- کپچا همچنان الزامی است.
- handler عمومی `assets/js/main.js` دیگر روی فرم Home دوباره submit نمی‌بندد.
- event tracking پایه برای شروع، موفقیت و خطای submit اضافه شد و فعلاً privacy-first/local است.

---

## 2) WEB-SEO-001 — بازسازی sitemap واقعی

### مشکل قبلی

در ممیزی پنل مشخص شد sitemap شامل 431 URL بود، اما 33 URL فایل متناظر در پکیج فعلی نداشتند؛ از جمله URLهای فارسی/encoded قدیمی و hash-like.

### رفتار جدید

`sitemap.xml` از روی فایل‌های public واقعی بازسازی شد:

```text
Public HTML URLs in sitemap: 398
Missing sitemap files: 0
CRM/API URLs in sitemap: 0
```

قواعد جدید:

- فقط صفحات public واقعی در sitemap هستند.
- `crm/` و endpointهای داخلی وارد sitemap نمی‌شوند.
- URLهای stale مانند `کاربردهای صنعتی-*` حذف شدند.
- صفحات مهم تجاری مثل Home، RFQ، Tracking، Supplier، Services، Industries و Knowledge Center در sitemap هستند.

---

## 📁 فایل‌های تغییر یافته

```text
index.html
assets/js/main.js
sitemap.xml
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester207-home-rfq-real-chain.js
_tools/uat/tester208-sitemap-public-clean.js
RELEASE-NOTES-v31.7.32.md
REGRESSION-REPORT-v31.7.32.md
```

---

## 🧪 تست‌های اضافه‌شده

### `tester207-home-rfq-real-chain.js`

پوشش:

- فرم Home به `add_rfq_site` وصل است.
- کد رهگیری تصادفی client-side حذف شده است.
- success فقط با `ok:true + code` سرور نمایش داده می‌شود.
- خطا fail-closed است.
- کپچا حفظ شده است.
- main.js روی فرم Home دوباره submit نمی‌بندد.

### `tester208-sitemap-public-clean.js`

پوشش:

- همه locهای sitemap فایل واقعی دارند.
- هیچ URL مربوط به CRM/API در sitemap نیست.
- تعداد locها با تعداد HTMLهای public واقعی برابر است.
- هیچ صفحه public از sitemap جا نمانده است.
- URLهای stale/encoded قدیمی حذف شده‌اند.

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Home RFQ | تغییر رفتاری مثبت: ثبت فقط با کد واقعی سرور | متوسط، کنترل‌شده با تست |
| RFQ اصلی `/rfq/` | دست‌نخورده | صفر |
| Tracking | فقط لینک Home به کد واقعی وصل شد | کم |
| CRM/API | هیچ تغییر PHP انجام نشد | صفر |
| Sitemap/SEO | حذف URLهای stale و بازسازی واقعی | کم |
| CRM داخلی | دست‌نخورده | صفر |
| Finance/Auth/Sync | دست‌نخورده | صفر |

---

## 📋 راستی‌آزمایی توسط کارفرما

### تست Home RFQ

1. صفحه اصلی را باز کنید.
2. فرم سریع استعلام را تکمیل کنید.
3. کپچا را بزنید.
4. ارسال کنید.
5. انتظار صحیح:
   - پیام «در حال ثبت واقعی در سرور» دیده شود.
   - پس از پاسخ سرور، کد واقعی مثل `PTF-RFQ-1405-000X` نمایش داده شود.
   - لینک رهگیری با همان کد باز شود.
6. تست خطا:
   - اگر کپچا را نزنید، ثبت انجام نشود.
   - اگر سرور پاسخ ندهد، پیام خطا بگوید هیچ کد رهگیری صادر نشده است.

### تست Sitemap

1. `https://pishtaj.ir/sitemap.xml` را باز کنید.
2. مطمئن شوید URLهای `crm/` یا `api/` وجود ندارند.
3. چند URL تصادفی از sitemap را باز کنید و 200 بودن آنها را بررسی کنید.

---

## 🚦 نتیجه

WEB-SPRINT-01 شروع شد و دو foundation مهم اصلاح شد:

```text
Home RFQ = واقعی، server-generated، fail-closed
Sitemap = public-only، بدون URL stale، بدون فایل گمشده
```

گام پیشنهادی بعدی در Sprint بعدی:

```text
WEB-MEAS-002 / WEB-CRO-001:
داشبورد اندازه‌گیری conversion + بازطراحی CTAهای Home بر اساس journey نقش‌محور
```
