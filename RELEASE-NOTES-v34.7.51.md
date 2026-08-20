# RELEASE NOTES — v34.7.51 (۱۴۰۵/۰۵/۲۹ — 2026-08-20)

> **یادداشت:** این سند پس از انتشار (در نشست v34.7.54) تکمیل شد؛ محتوا از commitهای
> `4f87f01`، `695f477`، `38af396`، `7d087b8`، `72d77d2` و قراردادهای tester453/454
> استخراج شده است.

## نمایش آگهی روی سایت، شرح هوش مصنوعی، اصلاح بنر و محتوای پروفایل/پروژه

### ۱) انتشار و نمایش آگهی

- فهرست FA و EN و منوی پویا از **API (`published`)** می‌خوانند، با fallback به
  `careers/status.json`.
- صفحهٔ اختصاصی هر آگهی: `careers/view.php` با rewrite در `careers/.htaccess`
  (`careers/<slug>/`)، رندر از `jobs.json`.
- `save_job` در صورت شکست نوشتن HTML ایستا باز هم `ok` می‌ماند (داده منبع اصلی است).
- **slug خودکار** از عنوان انگلیسی؛ عنوان‌های استاندارد پیش‌فرض + «سایر».
- include guard در `api/careers.php`.

### ۲) شرح آگهی با هوش مصنوعی

- endpoint جدید `jobdesc` در `api/llm.php` — **فقط نقش ارشد**؛ خروجی پیش‌نویس است و
  **تأیید انسانی** لازم دارد (دکمه در فرم آگهی CRM).
- وابسته به `llm-config.php` معتبر روی سرور.

### ۳) وضعیت پیوست رزومه (commit همراه — tester454)

- کادر وضعیت `jobResumeBox` در فرم عمومی: پس از انتخاب فایل («رزومه پیوست شد»)،
  هنگام ارسال («در حال بارگذاری رزومه») و پیام موفقیت — رفع ابهام «آیا فایلم رفت؟».

### ۴) اصلاحات محتوایی و UX سایت (commitهای همراه، بدون بامپ نسخه)

- حذف CTA تکراری بنر صفحهٔ اصلی.
- پروفایل شرکت و صفحهٔ پروژه‌ها دیگر دربارهٔ «سئو» حرف نمی‌زنند (پاکسازی متن‌های
  ابزاری از محتوای مشتری‌رو).
- **مگامنوی چندسطحی محصولات** در نوار بالا + پایدارسازی رفتار hover/focus و
  یکدست‌سازی دکمهٔ کارت‌ها.
- رفع جستجوی سایت (`/search/`) و کپچا؛ یکدست‌سازی هایلایت منو؛ اصلاح فوتر و عکس
  روزمونت (`instrumentation-equipment`)؛ `assets/data/.htaccess` برای دسترسی ایندکس جستجو.

### تست

- تسترهای جدید `tester453-v34.7.51-careers-publish-ai-content.js` و
  `tester454-v34.7.51-careers-resume-attach-status.js` (هر دو در گیت CI).

### فایل‌های اصلی

`api/careers.php` · `api/llm.php` · `careers/view.php` · `crm/careers.js` ·
`assets/js/ptf-careers-apply.js` · `assets/js/ptf-discover.js` · `assets/css/discover.css` ·
`index.html` · `search/index.html` · `about/company-profile/` · `projects/`
