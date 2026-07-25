# Release Notes — v31.7.35

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.35`  
**نوع:** 🟢 WEB-SEO-003 Light — Content Authority Schema Pass

---

## 🎯 هدف ریلیز

طبق درخواست کارفرما، این Sprint عمداً سبک نگه داشته شد. هدف فقط یک گام کم‌ریسک برای تقویت E-E-A-T و structured data صفحات تخصصی اولویت‌دار بود؛ بدون تغییر فرم‌ها، APIها، CRM، محتوای اصلی body یا معماری سایت.

---

## ✅ کار انجام‌شده

برای 10 صفحه اولویت‌دار فنی، JSON-LD مقاله ارتقا داده شد:

```text
knowledge-center/kc-api-610.html
knowledge-center/a106-api-5l.html
knowledge-center/control-valve-complete-guide.html
knowledge-center/api-5l-pipe-guide.html
knowledge-center/kc-api-5l-psl1-psl2.html
knowledge-center/kc-304-316.html
knowledge-center/kc-psv.html
knowledge-center/kc-actuator.html
knowledge-center/flowmeter-types-guide.html
blog/ball-valve-selection-guide.html
```

### فیلدهای افزوده/نرمال‌شده

```text
dateModified: 2026-07-21
inLanguage: fa-IR
isAccessibleForFree: true
author: تیم مهندسی و تامین پیشرو تجهیز فرتاک
reviewedBy: واحد مهندسی، تضمین کیفیت و تامین پیشرو تجهیز فرتاک
publisher + logo
mainEntityOfPage
articleSection
about
```

برای صفحات مرکز دانش، نوع schema از `Article` به ترکیب زیر ارتقا یافت:

```json
["TechArticle", "Article"]
```

صفحه blog به صورت `Article` باقی ماند تا over-engineering نشود، ولی review/date/publisher metadata دریافت کرد.

---

## 🧪 تست اضافه‌شده

### `_tools/uat/tester212-content-authority-schema.js`

پوشش:

- JSON-LD همه صفحات منتخب معتبر است.
- همه صفحات منتخب `dateModified`, `inLanguage`, `author`, `reviewedBy`, `publisher`, `mainEntityOfPage`, `articleSection`, `about` دارند.
- صفحات `knowledge-center/` به `TechArticle + Article` ارتقا یافته‌اند.
- صفحه blog همچنان `Article` است اما review metadata دارد.

نتیجه مستقیم:

```text
tester212-content-authority-schema: 60 PASS / 0 FAIL
```

---

## ⚠️ Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| SEO structured data | تقویت E-E-A-T/TechArticle برای صفحات اولویت‌دار | کم |
| محتوای visible صفحه | تغییر ندارد | صفر |
| فرم‌ها/RFQ/Tracking | تغییر ندارد | صفر |
| CRM/Auth/Finance/Sync | تغییر ندارد | صفر |
| sitemap | تغییر ندارد | صفر |

---

## 📋 اقدام پیشنهادی کارفرما در Search Console

بعد از deploy، نیازی به Request Indexing گسترده نیست. فقط برای صفحات اولویت‌دار زیر، اگر می‌خواهید اثر structured data سریع‌تر دیده شود، Request Indexing اختیاری است:

```text
https://pishtaj.ir/knowledge-center/kc-api-610.html
https://pishtaj.ir/knowledge-center/a106-api-5l.html
https://pishtaj.ir/knowledge-center/control-valve-complete-guide.html
https://pishtaj.ir/knowledge-center/api-5l-pipe-guide.html
https://pishtaj.ir/knowledge-center/kc-api-5l-psl1-psl2.html
https://pishtaj.ir/knowledge-center/kc-304-316.html
https://pishtaj.ir/knowledge-center/kc-psv.html
https://pishtaj.ir/knowledge-center/kc-actuator.html
https://pishtaj.ir/knowledge-center/flowmeter-types-guide.html
https://pishtaj.ir/blog/ball-valve-selection-guide.html
```

اگر زمان ندارید، submit sitemap قبلی کافی است و Google به‌مرور crawl می‌کند.

---

## 🚦 نتیجه

این ریلیز یک گام سبک، کم‌ریسک و محافظت‌شده با تست برای تقویت اعتبار محتوای فنی سایت است. گام‌های سنگین‌تر مثل بازنویسی محتوای body، author box visible یا title cleanup گسترده به Sprintهای بعدی منتقل شد.
