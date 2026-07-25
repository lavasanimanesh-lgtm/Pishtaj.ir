# ریلیزنوت رسمی v26.1 — Sprint 261

## قاعدهٔ نسخه‌گذاری رسمی

نسخه بر مبنای شمارهٔ Sprint تقسیم بر 10 نوشته می‌شود:

- Sprint 260 → `v26.0`
- Sprint 261 → `v26.1`
- Sprint 262 → `v26.2`

بنابراین نسخه‌های محلی/آزمایشی `v25.7` تا `v25.11` که در حین تکمیل این بسته ایجاد شده بودند، **شناسهٔ release رسمی نیستند** و در این release تجمیع و جایگزین شدند. `v25.10` یا `v25.11` در این قرارداد وجود ندارد.

---

## دامنهٔ تغییرات Sprint 261

### 1. خوانایی سراسری حالت شب

- لایهٔ مرکزی `theme-contrast.js` برای رنگ‌های hard-coded و HTML پویای CRM افزوده شد.
- فرم، مودال، جدول، badge، دکمه، متن اصلی/ثانویه و رنگ‌های semantic در dark mode پوشش داده شدند.
- عناصر تازه‌رندرشده با `MutationObserver` و بدون polling سازگار می‌شوند.
- ابزار QA دستی `ptfThemeContrastAudit()` افزوده شد.

### 2. پایداری LLM و عیب‌یابی HTTP 0

- اجبار IPv4 حذف شد؛ حالت پیش‌فرض transport برابر `auto` است.
- TLS verification به‌صورت امن پیش‌فرض فعال شد.
- `var_dump`های مخرب JSON حذف شدند.
- cache key بر اساس payload واقعی اصلاح شد؛ cache فقط پاسخ موفق و معتبر را نگه می‌دارد.
- quota فقط پس از پاسخ موفق کم می‌شود.
- تست اتصال AI cache را دور می‌زند و hostname، `curl_errno`، زمان DNS/connect/total و نتیجه TLS را بدون افشای key نشان می‌دهد.
- `llm-config.sample.php` و `DOCS-LLM-SETUP.md` اضافه شدند.

### 3. خواندن ضمیمه‌های درخواست با AI

- مسیر مشاهده درخواست → خواندن فایل → خواندن ضمیمه‌های درخواست با AI فعال شد.
- یک فایل قابل‌خواندن مستقیم پردازش می‌شود؛ چند فایل با checkbox توسط کاربر انتخاب می‌شوند.
- PDF/image، Excel و DOCX/CSV/TXT/MD پشتیبانی می‌شوند.
- پردازش انتخاب‌ها ترتیبی است و نتیجه/خطای هر فایل گزارش می‌شود.
- برای PDF/image/Excel، مسیر server-controlled base64 با سقف 6MB اضافه شد تا وابستگی به CORS مرورگر از بین برود.
- خطای scope دکمهٔ AI (`_ir` محلی در inline onclick) با bridge عمومی `irAiReadCurrentAttachments()` رفع شد.

### 4. یکپارچگی اقلام درخواست

- حذف قلم در ویرایش درخواست اکنون همهٔ داده‌های alias مرتبط با RFQ داخلی و شماره درخواست کارفرما را پاک می‌کند.
- snapshotهای قدیمی AI-reader نیز هم‌زمان پاک می‌شوند تا قلم حذف‌شده بازنگردد.
- child itemها با RFQ داخلی به‌عنوان کلید canonical ذخیره می‌شوند؛ شماره کارفرما برای نمایش/lookup alias باقی می‌ماند.
- شمارهٔ درخواست کارفرما، در صورت تفاوت با RFQ داخلی، زیر کد RFQ در فهرست و به‌صورت جدا در پنجرهٔ مشاهده نمایش داده می‌شود.

### 5. AI Workbench → درخواست موجود

- گزینهٔ جدید ⑤ در اجرای سه‌گانه: **افزودن اقلام انتخاب‌شده به اقلام درخواست مرتبط**.
- ردیف‌های انتخاب‌شده به `ptf_crm_inqitems` و `r.items` RFQ موجود افزوده می‌شوند.
- append ضدتکرار بر مبنای شرح، مشخصات و مدل انجام می‌شود.
- قفل درخواست دارای پیشنهاد صادرشده رعایت می‌شود.
- duplicate کالا در بانک کالا مانع ثبت همان قلم در RFQ نمی‌شود؛ فقط duplicate در همان RFQ رد می‌شود.
- rollback 60ثانیه‌ای اجرای سه‌گانه، itemهای افزوده‌شده توسط همان اجرا را نیز برمی‌گرداند.

---

## فایل‌های کلیدی تغییرکرده

- `crm/theme-contrast.js`
- `crm/index.html`
- `crm/sw.js`
- `crm/inqreader.js`
- `crm/bridge.js`
- `crm/ai-workbench.js`
- `api/llm.php`
- `api/attachment-read.php`
- `llm-config.sample.php`
- `DOCS-LLM-SETUP.md`
- `_tools/uat/tester138-v257.js`
- `_tools/uat/tester139-v258-llm.js`
- `_tools/uat/tester140-v259-attachment-ai.js`
- `_tools/uat/tester141-v2510-rfq-integrity.js`
- `_tools/uat/tester142-v2511-ai-request-items.js`

## نتایج تست

- Syntax همهٔ 64 اسکریپت CRM: **0 failure**
- Dark theme regression: **21 PASS / 0 FAIL**
- LLM transport/cache regression: **14 PASS / 0 FAIL**
- Attachment AI regression: **15 PASS / 0 FAIL**
- RFQ item integrity regression: **16 PASS / 0 FAIL**
- AI Workbench → RFQ existing items: **11 PASS / 0 FAIL**
- `audit.py`: بدون error؛ فقط هشدار قدیمی تصاویر حجیم سایت باقی است.

> PHP CLI در محیط بررسی موجود نبود؛ بنابراین lint/runtime PHP در این محیط اجرا نشد. تماس واقعی با provider AI نیز به config و شبکهٔ هاست production وابسته است.
