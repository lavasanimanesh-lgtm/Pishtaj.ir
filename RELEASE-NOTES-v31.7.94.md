# Release Notes — v31.7.94

## عنوان ریلیز
**BUG-OFFER-DUP-ITEMS-SETTINGS-ACCORDION-001**

## RCA / دلیل دقیق
کارفرما گزارش داد یک پیشنهاد با ۷۲ آیتم پس از مدتی به ۱۴۴ ردیف تبدیل شده؛ ۷۲ ردیف جدید تکرار همان اقلام با قیمت صفر بوده‌اند. حذف دستی و ذخیره نیز باعث برگشت مشکل شده است. بررسی کد نشان داد چند ریسک هم‌زمان وجود داشت:

1. مسیر «بارگذاری از درخواست» (`offLoadInqItems`) idempotent نبود و اگر دوباره اجرا می‌شد، همان اقلام را دوباره به پیشنهاد اضافه می‌کرد.
2. تابع درج هوشمند (`offSmartInsert`) خودش تکراری بودن خط را کنترل نمی‌کرد و فقط اولین ردیف خالی را پر یا append می‌کرد.
3. در `offAddItem` یک ریسک تکرار/append غیرکنترل‌شده وجود داشت و باید از مسیر مرکزی هوشمند عبور می‌کرد.
4. در لحظه ذخیره پیشنهاد، هیچ dedupe نهایی برای حذف ردیف‌های تکراری zero-price وجود نداشت؛ بنابراین اگر از هر مسیر UI/AI/import تکرار ایجاد می‌شد، در داده باقی می‌ماند.

همچنین منوی تنظیمات به‌دلیل اضافه شدن قابلیت‌های جدید طولانی و نامرتب شده بود.

## اصلاحات عمیق Duplicate Items

### 1) کلید پایدار خط پیشنهاد
توابع جدید در `crm/offers.js`:

```js
offItemKey(it)
offDedupeOfferItems(items)
```

کلید خط بر اساس این داده‌ها ساخته می‌شود:

```text
pcode/prodCd
name
 desc/spec
model
brand
qty
unit
```

### 2) idempotent شدن بارگذاری از درخواست
`offLoadInqItems()` اکنون قبل از درج، اقلام موجود پیشنهاد را index می‌کند و اگر همان قلم قبلاً وجود داشته باشد، آن را skip می‌کند.

پیام UI اکنون تعداد زیر را نشان می‌دهد:

```text
added
skipped duplicate
```

### 3) idempotent شدن offSmartInsert
`offSmartInsert()` اکنون اگر خط معادل از قبل وجود داشته باشد، همان index را برمی‌گرداند و دوباره append نمی‌کند.

### 4) اصلاح offAddItem
`offAddItem()` اکنون از `offSmartInsert()` استفاده می‌کند و append خام انجام نمی‌دهد.

### 5) dedupe در لحظه ذخیره
در `offerSave()` قبل از ذخیره، `offDedupeOfferItems()` اجرا می‌شود و ردیف‌های تکراری zero-price حذف می‌شوند. این حذف audit و toast دارد.

## اصلاح UX تنظیمات

فایل جدید:

```text
crm/settings-accordion.js
```

این فایل بعد از همه ماژول‌های CRM لود می‌شود و خروجی `buildSettings()` را به ردیف‌های accordion تبدیل می‌کند.

ویژگی‌ها:
- هر بخش تنظیمات در یک ردیف تاشو (`details/summary`) قرار می‌گیرد.
- آیکون‌ها مینیمال عددی هستند، نه emoji-heavy.
- اولین بخش به‌صورت پیش‌فرض باز است.
- IDهای داخلی و دکمه‌های قبلی حفظ می‌شوند.

## فایل‌های تغییرکرده

```text
crm/offers.js
crm/settings-accordion.js
crm/index.html
crm/sw.js
crm/clear-cache.html
api/tools.php
tools/advanced-tools-ui.js
_tools/uat/tester272-offer-duplicate-items-settings-accordion.js
PTF-MASTER-HANDOVER.md
```

## تست
- تست جدید `tester272-offer-duplicate-items-settings-accordion.js` اضافه شد.
- تست runtime دوبار اجرای `offLoadInqItems` را بررسی می‌کند و ثابت می‌کند اقلام دوبرابر نمی‌شوند.
- تست runtime حذف duplicate zero-price را بررسی می‌کند.
- regression کامل و audit قبل از ZIP اجرا می‌شود.
