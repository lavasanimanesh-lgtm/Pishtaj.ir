# 🔐 ریلیز v21.1 — سخت‌سازی بایگانی و زونکن (BUG-035 / 036 / 037)

**مبنا:** `v21.0-corrected`  
**تاریخ:** ۱۴۰۵/۰۴/۲۰  
**خانواده:** پرونده فروش / بایگانی / زونکن دیجیتال / PWA cache

---

## اجرا شد

### BUG-035 — بایگانی باخت idempotent + حذف از فرصت‌ها
- `oppo.js`: `ptfOppoList` حالا `ptf_crm_projects` بایگانی‌شده (origin salesfile / closeKind lost|settled / ARC-*) را با تطبیق دو-شناسه‌ای `inqNo/cd` فیلتر می‌کند.
- `salesfiles.js`:
  - `sfFindArchivedProject` / `sfArchiveAliases`
  - گارد در `sfClose` و `sfCloseLost` با پیام «قبلاً بایگانی شده»
  - `sfArchive` idempotent (رکورد تکراری نمی‌سازد)
  - `sfMarkLostRelated`: پیشنهادهای غیربرنده → `lost` و درخواست → `stX`

### BUG-036 — بن‌بست دانلود/فشرده‌سازی بدون فایل ابری
- `archive.js`:
  - stateهای `archived` و `origin=salesfile` مجاز برای ویزارد
  - اگر فایل ابری نباشد → **بایگانی متادیتایی** (`archiveMetaOnly`) بدون الزام `dlAt`
  - شرط دانلود فقط وقتی فایل ابری واقعی وجود دارد
  - پیام شفاف «نبود فایل ابری» vs خطای دانلود
- `projects.js`: راهنمای UI برای پرونده متادیتایی

### BUG-037 — مشاهده سند در زونکن
- `index.html` / `ptfOpenProjectBinder` بازنویسی شد:
  - لیست اسناد داخل خود زونکن
  - `event.stopPropagation` روی مشاهده/دانلود
  - زونکن با کلیک مشاهده بسته نمی‌شود
  - `ptfBinderOpenFolder` فقط برای رفتن به پوشه پرونده
- `projects.js`: stopPropagation روی لینک‌های فایل پوشه

### جانبی
- `ai-workbench.js` به `sw.js` SHELL اضافه شد (PWA)
- VER / CACHE → **v21.1**
- cache-bust: salesfiles / oppo / archive / projects / ai-workbench
- کامنت کهنه `my-customers-filter.js` با قانون v21.0 هم‌راستا شد
- تسترهای نسخه‌قفل 86/123/125/126 هم‌راستا با v21.x

---

## تست
- **tester127-v211:** 49 PASS / 0 FAIL (ساختاری + رفتاری)
- رگرسیون: **110/114** فایل تستر سبز؛ **3038 چک PASS / 0 FAIL**
- ۴ تستر قدیمی (tester2..5) از قبل به مسیر `/home/user/pishtaj/` وابسته‌اند و به این اسپرینت مربوط نیستند

---

## فایل‌های تغییرکرده
- `crm/oppo.js`
- `crm/salesfiles.js`
- `crm/archive.js`
- `crm/projects.js`
- `crm/index.html`
- `crm/sw.js`
- `crm/my-customers-filter.js` (فقط کامنت)
- `_tools/uat/tester127-v211.js` (+ هم‌راستاسازی 86/123/125/126)
- `RELEASE-NOTES-v21.1.md`
- `PTF-MASTER-HANDOVER.md` (الحاقیه)
- `BACKLOG-SALESFILE-ARCHIVE-BUGS-R15.md` (وضعیت)

## نصب
extract-overwrite روی هاست؛ سپس `Ctrl+F5`.  
SW کش را به `ptf-crm-v21.1` عوض می‌کند.
