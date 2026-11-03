# گزارش بهینه‌سازی سئو - پیشرو تجهیز فرتاک

**تاریخ**: ۲۰۲۶-۱۱-۰۲  
**Branch**: `arena/d7773227-pishtaj-ir`  
**Commit‌ها**: `7c1bea4`, `1adb38d`

---

## 📋 خلاصه تغییرات

### ✅ انجام شده

#### ۱. فایل `llms.txt` (جدید)
**فایل**: `llms.txt`  
**Commit**: `7c1bea4`

**محتوا**:
- معرفی شرکت (نام، تأسیس، مقر، تماس، گواهینامه‌ها)
- حوزه فعالیت و خدمات
- ۶ دسته‌بندی اصلی محصولات با لینک صفحات مهم
- لیست برندهای قابل تامین
- لینک صفحات کلیدی

**دلیل**: برای موتورهای جستجوی AI (ChatGPT, Perplexity, Claude) تا بتوانند ساختار سایت را درک کنند.

---

#### ۲. سیاست AI Crawlers در `robots.txt`
**فایل**: `robots.txt`  
**Commit**: `7c1bea4`

**تغییرات**: اضافه کردن ۱۰ AI crawler به صورت صریح:
```
User-agent: GPTBot (OpenAI)
User-agent: ChatGPT-User
User-agent: OAI-SearchBot (ChatGPT search)
User-agent: PerplexityBot
User-agent: ClaudeBot (Anthropic)
User-agent: anthropic-ai
User-agent: Google-Extended (Google AI Mode)
User-agent: GoogleOther
User-agent: CCBot (Common Crawl)
User-agent: cohere-ai
```

**همه مجاز**: `Allow: /`

**دلیل**: 
- افزایش visibility در نتایج AI search
- B2B industrial equipment supplier → ترافیک referral از AI search ارزشمند است
- برندینگ و awareness

---

#### ۳. BlogPosting JSON-LD برای مقالات وبلاگ
**فایل‌ها**: ۱۱ مقاله در `blog/`  
**Commit**: `1adb38d`

**تغییرات**: اضافه کردن BlogPosting schema به همه مقالات:
- headline (از `<title>`)
- description (از meta description)
- datePublished & dateModified (از `<time datetime>`)
- author (Organization: پیشرو تجهیز فرتاک)
- publisher (با logo)
- image (اولین تصویر مقاله)
- mainEntityOfPage (canonical URL)

**مقالات**:
1. a106-vs-a333-pipes.html
2. ball-valve-selection-guide.html
3. electrical-switchgear-guide.html
4. flange-types-guide.html
5. gas-detection.html
6. industrial-valves-complete-guide.html
7. mtc-tpi-inspection-guide.html
8. pressure-transmitter-guide.html
9. pressure-vessels-asme.html
10. rfq-procurement-guide.html
11. seamless-pipe-guide.html

**دلیل**: Rich snippets در نتایج جستجو (عنوان، توضیحات، تصویر، تاریخ).

---

## ✅ وضعیت فعلی (بعد از تغییرات)

### داده ساختاریافته (JSON-LD)
- ✅ **Organization**: ۵۳۱ صفحه
- ✅ **FAQPage**: ۵۸۷ صفحه
- ✅ **BreadcrumbList**: ۶۳۷ صفحه
- ✅ **WebSite**: ۱۱ صفحه (با SearchAction)
- ✅ **Service**: ۱۱۸ صفحه
- ✅ **Product**: ۲۶ صفحه
- ✅ **Article**: ۳۶۴ صفحه
- ✅ **BlogPosting**: ۱۱ صفحه (جدید)

### فایل‌های فنی
- ✅ `robots.txt` — معتبر با AI crawler policies
- ✅ `sitemap-index.xml` — ۱۰ زیر-sitemap
- ✅ `llms.txt` — معرفی کامل شرکت (جدید)

### چندزبانگی
- ✅ `lang="fa" dir="rtl"` در صفحات فارسی
- ✅ `lang="en" dir="ltr"` در صفحات انگلیسی
- ✅ hreflang دوطرفه (fa-IR, en, x-default)
- ✅ canonical درست

### دسترسی‌پذیری
- ✅ لوگوی هدر دارای alt معنادار
- ✅ فرم RFQ دارای label
- ✅ تصاویر دارای alt
- ✅ skip link موجود

---

## ❌ انجام نشده (نیاز به تصمیم شما)

### ۱. WebSite JSON-LD در همه صفحات
**مشکل**: WebSite schema فقط در ۱۱ صفحه هست  
**دلیل عدم انجام**: سایت layout مشترک ندارد (هر صفحه HTML جداگانه است)  
**پیشنهاد**: 
- اضافه کردن دستی به ۵-۱۰ صفحه اصلی (services, products, knowledge-center, blog, about)
- یا ساختن یک script برای تولید خودکار

**نیاز به تصمیم**: آیا می‌خواهید به همه صفحات اضافه شود؟

---

### ۲. بررسی contrast ratios و focus states
**مشکل**: نیاز به ابزار Lighthouse و تست دستی  
**دلیل عدم انجام**: 
- نیاز به اجرای Lighthouse روی سایت live
- تست دستی نیاز به مرورگر دارد

**پیشنهاد**: 
- اجرای Lighthouse در Chrome DevTools
- تست با Tab key برای focus states

---

### ۳. اعتبارسنجی JSON-LD
**مشکل**: باید با Rich Results Test و Schema Markup Validator تست شود  
**دلیل عدم انجام**: نیاز به دسترسی به سایت live دارد

**پیشنهاد**: 
- تست URL‌های کلیدی در [Rich Results Test](https://search.google.com/test/rich-results)
- تست با [Schema Markup Validator](https://validator.schema.org/)

---

## 📊 معیارهای موفقیت

| معیار | وضعیت | توضیح |
|-------|--------|--------|
| JSON-LD بدون خطا | ⏳ نیاز به تست | با Rich Results Test |
| hreflang بدون تناقض | ✅ | در audit اولیه تأیید شد |
| robots.txt معتبر | ✅ | اضافه شد |
| sitemap.xml معتبر | ✅ | از قبل موجود بود |
| llms.txt موجود | ✅ | اضافه شد |
| بدون تغییر ظاهری | ✅ | فقط JSON-LD و robots.txt تغییر کرد |

---

## 🎯 پیشنهادات بعدی (غیرکدی)

### ۱. Google Search Console
- [ ] ثبت سایت (اگر نشده)
- [ ] Submit sitemap-index.xml
- [ ] Request Indexing برای صفحات کلیدی
- [ ] بررسی Coverage Report

### ۲. Bing Webmaster Tools
- [ ] ثبت سایت
- [ ] Submit sitemap

### ۳. Google Business Profile
- [ ] ثبت کسب‌وکار (اگر نشده)
- [ ] اضافه کردن اطلاعات تماس، ساعات کاری، عکس

### ۴. تولید محتوای وبلاگ
- [ ] ادامه تولید مقالات تخصصی (فعلاً ۱۱ مقاله داریم)
- [ ] تمرکز روی کلمات کلیدی long-tail
- [ ] انتشار منظم (هفته‌ای ۱-۲ مقاله)

### ۵. مرکز دانش
- [ ] ادامه تولید مقالات فنی (فعلاً ۵۰۰+ مقاله داریم)
- [ ] به‌روزرسانی مقالات قدیمی
- [ ] اضافه کردن جدول مقایسه و FAQ

---

## 🔍 فایل‌های تغییر‌یافته

```
✅ llms.txt (جدید)
✅ robots.txt (آپدیت)
✅ blog/*.html (۱۱ فایل - BlogPosting اضافه شد)
✅ SEO-AUDIT-REPORT-INITIAL.md (گزارش audit اولیه)
✅ SEO-AUDIT-CHECKLIST.md (checklist)
✅ SEO-OPTIMIZATION-REPORT.md (این گزارش)
```

---

## 📝 یادداشت‌ها

### سیاست AI Crawlers
**تصمیم**: مجاز کردن همه AI crawler ها  
**دلیل**: 
- سایت B2B industrial equipment supplier
- ترافیک referral از AI search ارزشمند است
- برندینگ و visibility در AI search results
- رقبا احتمالاً مجاز کرده‌اند

**ریسک**: 
- ممکن است AI ها محتوا را در پاسخ‌های خود استفاده کنند
- اما این برای B2B مثبت است (visibility)

### BlogPosting
**تصمیم**: استفاده از Organization به عنوان author  
**دلیل**: 
- وبلاگ شرکتی است، نه شخصی
- نویسنده مشخص در سایت ذکر نشده
- Organization معتبرتر است

---

## 🚀 گام‌های بعدی

1. **Push به GitHub**: `git push origin arena/d7773227-pishtaj-ir`
2. **بررسی diff**: تغییرات را بررسی کنید
3. **تست در staging**: اگر staging دارید، تست کنید
4. **Deploy به production**: بعد از تأیید
5. **Submit در GSC**: sitemap و صفحات کلیدی
6. **تست JSON-LD**: با Rich Results Test

---

**پایان گزارش**
