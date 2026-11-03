# سئو Audit Checklist - پیشرو تجهیز فرتاک

## گام ۰: بررسی وضعیت فعلی

### ۱. HTML attributes
- [ ] `lang` و `dir` روی `<html>` در صفحات فارسی و انگلیسی
- [ ] بررسی ۱۰ صفحه تصادفی

### ۲. فایل‌های فنی
- [ ] robots.txt - موجود است؟ محتوایش چیست؟
- [ ] sitemap.xml / sitemap-index.xml - موجود است؟
- [ ] llms.txt - موجود است؟ (احتمالاً خیر)

### ۳. JSON-LD موجود
- [ ] جستجو برای تمام `application/ld+json` در سایت
- [ ] لیست کردن انواع Schema موجود

### ۴. hreflang و canonical
- [ ] بررسی ۵ صفحه فارسی
- [ ] بررسی ۵ صفحه انگلیسی
- [ ] دوطرفه بودن hreflang

### ۵. ساختار هدینگ
- [ ] index.html
- [ ] services/index.html
- [ ] services/products/index.html
- [ ] knowledge-center/index.html
- [ ] blog/index.html
- [ ] contact.html
- [ ] rfq/index.html

## گام ۱: JSON-LD
- [ ] Organization (در index.html) - احتمالاً هست
- [ ] WebSite + SearchAction - احتمالاً نیست
- [ ] FAQPage - در برخی صفحات
- [ ] BreadcrumbList - احتمالاً هست
- [ ] Service/Product - احتمالاً نیست
- [ ] BlogPosting - احتمالاً نیست

## گام ۲: چندزبانگی
- [ ] hreflang کامل
- [ ] canonical درست
- [ ] لینک تعویض زبان

## گام ۳: محتوا
- [ ] FAQ heading structure
- [ ] H1 یکتا
- [ ] title/meta description

## گام ۴: دسترسی‌پذیری
- [ ] لوگوی هدر alt
- [ ] تصاویر alt
- [ ] فرم‌ها aria-label
- [ ] landmark ها
- [ ] tel: و mailto:

## گام ۵: فایل‌های فنی
- [ ] robots.txt
- [ ] sitemap
- [ ] llms.txt

## گام ۶: CWV
- [ ] Lighthouse قبل و بعد
