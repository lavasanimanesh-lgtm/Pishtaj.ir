# Release Notes — v31.7.98

## عنوان ریلیز
**MINIMAL-LINE-ICONS-DARK-FISCAL-001**

**تاریخ:** 2026-07-23  
**مبنای ورودی:** بسته رسمی `pishtaj-release-v31.7.97.zip` با SHA-256 برابر `4b5d3c8cccd9a1e6d4b0e5e112d613ffb35934c0b15eb32d07735244cab24020`

## درخواست کارفرما

- Badgeهای عددی در دسترسی سریع وب‌سایت، مرکز دانش، تنظیمات CRM و هاب مالی با آیکون‌های مینیمال واقعی جایگزین شوند.
- بخش سال مالی هاب مالی در حالت شب خوانا شود.

## RCA آیکون‌ها

در v31.7.97 برای حذف Emoji، چند سطح UI به Badgeهای متنی `01..16`، `KC` و `CRM` تبدیل شده بود. این Badgeها از نظر فنی Emoji نبودند، اما آیکون معنایی هم نبودند و کاربر برای فهم هر گزینه مجبور به خواندن کامل Label می‌شد. چهار پیاده‌سازی جدا وجود داشت:

1. `index.html`: اعداد 01..04 در Trust Strip و Journey؛ اعداد 01..05 در دسترسی سریع Footer و badge متنی CRM.
2. `knowledge-center/index.html`: عنوان `KC`، Clusterهای 01..16 و Footer عددی.
3. `crm/settings-accordion.js`: تابع `iconFor(i)` فقط شماره ترتیبی تولید می‌کرد.
4. `crm/financehub.js`: شماره 01..08 داخل Label تب‌ها Hardcode شده بود.

## اصلاح آیکون‌ها

### وب‌سایت

- Trust Strip: سند/کنترل، شبکه تامین، تحویل و صنعت با SVG خطی semantic.
- Journey نقش‌محور: خریدار، مهندس، رهگیری و تامین‌کننده با SVG متناسب.
- دسترسی سریع Footer: RFQ، Tracking، Supplier، Catalog و Assistant با آیکون خطی.
- ورود همکاران: آیکون Lock خطی؛ Badge متنی `CRM` حذف شد.
- آیکون‌ها Inline SVG، بدون CDN/Font خارجی، با `currentColor` و قابل‌تغییر با Theme هستند.

### مرکز دانش

- عنوان مرکز دانش: آیکون کتاب خطی به جای `KC`.
- ۱۶ Cluster: کلیدهای semantic مانند `pipe`, `valve`, `instrument`, `electrical`, `quality`, `rotating` و ... به جای 01..16.
- Renderer `kcIcon()` SVG مناسب هر خانواده را تولید می‌کند.
- اعداد واقعی آمار مقاله‌ها مانند ۵۰+ و ۴۰+ حفظ شدند؛ این اعداد Metric هستند، نه Icon.
- Footer همان قرارداد آیکون خطی وب‌سایت را دارد.

### تنظیمات CRM

- عنوان تنظیمات دارای Gear SVG صریح است.
- Accordion به جای `iconFor(index)` عددی، بر اساس عنوان هر بخش آیکون semantic تولید می‌کند:
  - Cloud/Backup
  - AI/OCR
  - Security/Account
  - User/Profile
  - Messages/Bot
  - License/Key
  - Sync/Data Quality
  - Theme
  - Reports/Tools
- Emoji تزئینی از عنوان Summary پاک می‌شود تا SVG و Emoji کنار هم تکرار نشوند.

### هاب مالی

- Header و هر هشت Tab دارای SVG خطی semantic هستند:
  - تنخواه
  - هزینه جاری
  - سهامداران
  - سال مالی
  - حساب تامین‌کنندگان
  - حساب مشتریان
  - گزارش رسمی مالی
  - کیفیت داده
- Labelهای 01..08 حذف شدند.
- Active/Inactive Tab در حالت روز و شب کلاس و رنگ صریح دارد.

## RCA خوانایی سال مالی در حالت شب

کارت‌های `.sc b` در CSS اصلی از Gradient Text همراه با:

```css
-webkit-text-fill-color: transparent
```

استفاده می‌کنند. در حالت شب، Generic Theme Classifier پس‌زمینه را تیره می‌کرد، اما Text Fill شفاف باقی می‌ماند و اعداد KPI سال مالی کم‌رنگ یا نامرئی می‌شدند. همچنین Alertهای قفل، بازگشایی، خطا و موفقیت با Inline Color روشن ساخته می‌شدند و اتکا به Classification عمومی برای DOM پویا کافی نبود.

## اصلاح Dark Mode سال مالی

- `fiscalBox` و KPIها کلاس semantic اختصاصی گرفتند.
- در Dark Mode برای KPIها Gradient/Text Transparency به‌طور قطعی خنثی می‌شود:

```css
background-image: none !important;
-webkit-text-fill-color: currentColor !important;
```

- رنگ صریح پرکنتراست برای Shell، KPI، Input، Table و چهار نوع Alert تعریف شد.
- نسبت کنتراست جفت‌های اصلی به‌صورت محاسباتی حداقل 4.5 و برای Shell بیش از 7 تست شده است.
- عنوان سال مالی با Calendar SVG خطی نمایش داده می‌شود.

## عدم تغییر منطق کسب‌وکار

- فرمول سود v31.7.97، هزینه مستقیم پروژه، هزینه جاری و تنخواه مستقل دست‌نخورده‌اند.
- هیچ کلید داده، Sync Contract، Finance Record، Auth/RBAC یا Migration تغییر نکرده است.
- تغییر فقط UI/Icon/Theme Contrast است.

## فایل‌های تغییرکرده

```text
index.html
knowledge-center/index.html
assets/css/style.css
crm/index.html
crm/sw.js
crm/clear-cache.html
crm/settings-accordion.js
crm/financehub.js
crm/fiscal.js
crm/theme-contrast.js
api/tools.php
_tools/uat/tester216-minimal-icons-policy.js
_tools/uat/tester272-offer-duplicate-items-settings-accordion.js
_tools/uat/tester275-fiscal-profit-and-minimal-icons.js
_tools/uat/tester276-semantic-icons-fiscal-dark.js
PTF-MASTER-HANDOVER.md
FILES-CHANGED-v31.7.98.txt
```

فهرست کامل ۵۵ فایل Production/Documentation/Test و SHA-256 هر فایل در `FILES-CHANGED-v31.7.98.txt` ثبت شده است. بخش عمده فایل‌های Tester فقط برای همگام‌سازی Version Contract از v31.7.97 به v31.7.98 تغییر کرده‌اند.

## تست اختصاصی

- `tester216`: سیاست آیکون Journey.
- `tester272`: Settings Accordion و رگرسیون Duplicate Items.
- `tester275`: سود مالی، UI آیکون و Dark Mode.
- `tester276`: ۲۵ Check برای آیکون‌های semantic و کنتراست سال مالی.
- Full Regression: **254/254 فایل PASS — 5,094/5,094 Check PASS**.
- `audit.py`: **PASS بدون Warning/Error**.
- PHP 8.4.23 و JavaScript syntax: **PASS**.

## UAT پیشنهادی

1. صفحه اصلی در Desktop/Mobile: Trust Strip، Journey و Footer بدون 01..05.
2. مرکز دانش: عنوان کتاب، ۱۶ آیکون خانواده و آمار مقاله‌ها.
3. CRM Settings: چند Accordion مختلف باز شود و آیکون متناسب دیده شود.
4. هاب مالی: تمام هشت Tab در روز و شب بررسی شوند.
5. سال مالی در شب: اعداد KPI، Alert قفل/خطا/موفقیت، Input و جدول خوانا باشند.
