# گزارش Audit اولیه سئو - پیشرو تجهیز فرتاک

**تاریخ**: ۲۰۲۶-۱۱-۰۲  
**Branch**: `arena/d7773227-pishtaj-ir`

---

## ✅ وضعیت فعلی (موارد مثبت)

### ۱. HTML Attributes
- ✅ `lang="fa" dir="rtl"` در صفحات فارسی
- ✅ `lang="en" dir="ltr"` در صفحات انگلیسی

### ۲. فایل‌های فنی
- ✅ `robots.txt` موجود و درست پیکربندی شده
- ✅ `sitemap-index.xml` موجود با ۱۰ زیر-sitemap
- ❌ `llms.txt` وجود ندارد

### ۳. JSON-LD موجود
- ✅ **Organization**: ۵۳۱ صفحه
- ✅ **FAQPage**: ۵۸۷ صفحه
- ✅ **BreadcrumbList**: ۶۳۷ صفحه
- ✅ **WebSite**: ۱۱ صفحه (⚠️ فقط در برخی صفحات)
- ✅ **Service**: ۱۱۸ صفحه
- ✅ **Product**: ۲۶ صفحه
- ✅ **Article**: ۳۶۴ صفحه

### ۴. چندزبانگی
- ✅ hreflang دوطرفه (fa-IR, en, x-default)
- ✅ canonical درست

### ۵. ساختار محتوا
- ✅ H1 یکتا در صفحات اصلی
- ✅ سلسله‌مراتب هدینگ مناسب (H1 → H2 → H3)
- ✅ title و meta description یکتا

### ۶. دسترسی‌پذیری
- ✅ لوگوی هدر دارای alt معنادار
- ✅ فرم RFQ دارای label
- ✅ تصاویر دارای alt

---

## ❌ مشکلات شناسایی‌شده

### اولویت بالا
1. **llms.txt وجود ندارد** — برای موتورهای جستجوی AI
2. **WebSite JSON-LD ناقص** — فقط در ۱۱ صفحه (باید در همه صفحات باشد)

### اولویت متوسط
3. **بررسی BlogPosting** — آیا مقالات وبلاگ BlogPosting دارند؟
4. **بررسی AI crawler policies** — robots.txt برای OAI-SearchBot و غیره

### اولویت پایین
5. **بررسی contrast ratios** — نیاز به ابزار Lighthouse
6. **بررسی focus states** — نیاز به تست دستی

---

## 📋 برنامه کار

### گام ۱: llms.txt بساز
- معرفی شرکت
- دسته‌بندی محصولات/خدمات
- لینک صفحات مهم

### گام ۲: WebSite JSON-LD را گسترش بده
- اضافه کردن به همه صفحات (از طریق layout مشترک اگر ممکن است)

### گام ۳: AI crawler policies را در robots.txt اضافه کن
- تصمیم‌گیری: مجاز یا محدود؟
- OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended

### گام ۴: BlogPosting را بررسی کن
- آیا مقالات وبلاگ BlogPosting دارند؟
- اگر نه، اضافه کن

### گام ۵: تست و اعتبارسنجی
- Rich Results Test
- Schema Markup Validator
- Lighthouse

---

## 📊 معیارهای موفقیت

1. ✅ همه JSON-LDها در Rich Results Test بدون خطا
2. ✅ hreflang و canonical بدون تناقض
3. ✅ robots.txt و sitemap.xml معتبر
4. ✅ llms.txt موجود و معتبر
5. ✅ بدون تغییر ظاهری ناخواسته
