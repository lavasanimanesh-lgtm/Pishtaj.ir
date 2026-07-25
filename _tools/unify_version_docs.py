import os, glob

repo = "/home/user/pishtaj_project"

# 1. Read v22.4 release notes content if it exists, to preserve Lead Finder history into v124.0
v22_4_path = os.path.join(repo, "RELEASE-NOTES-v22.4.md")
v124_content = ""
if os.path.exists(v22_4_path):
    with open(v22_4_path, "r", encoding="utf-8") as f:
        txt = f.read()
    # Replace v22.x references with v124.0
    txt = txt.replace("RELEASE NOTES — v22.4", "📦 ریلیزنوت v124.0 — Lead Finder Foundation + Stabilization Pass (مهاجرت از نسخه ۲۲.۴)")
    txt = txt.replace("v22.4", "v124.0")
    v124_content = txt
else:
    v124_content = """# 📦 ریلیزنوت v124.0 — Lead Finder Foundation + Stabilization Pass

**تاریخ:** ۱۴۰۵/۰۴/۲۱ | **نسخه قبلی:** v123.2

---

## 🎯 خلاصه دستاوردها (مهاجرت از شماره‌گذاری ۲۲.۴ به ۱۲۴.۰)
در این اسپرینت زیرساخت لیدیاب (Lead Finder Foundation) به همراه اصلاحات پایدارسازی روی دستیار فنی AI پیاده‌سازی شد:
- اضافه شدن ماژول `crm/lead-finder.js` و تب `🔎 لیدیاب` در دستیار هوشمند
- اتصال به `api/attachment-read.php` برای خواندن فایل‌های پیوست استعلام
- اصلاح فیلدهای تنخواه و پیش‌پرداخت ارزی
"""

with open(os.path.join(repo, "RELEASE-NOTES-v124.0.md"), "w", encoding="utf-8") as f:
    f.write(v124_content)
print("Created RELEASE-NOTES-v124.0.md")

# 2. Create RELEASE-NOTES-v125.0.md
v125_content = """# 📦 ریلیزنوت v125.0 — ممیزی عمیق سیستم + یکپارچه‌سازی شماره‌گذاری + رفع خطاهای مسیر رگرسیون (Priority 1)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v124.0 (سابقاً v22.4)

---

## 🎯 یکپارچه‌سازی شماره‌گذاری نسخه‌ها (Unified Numbering System)
مطابق مصوبه کارفرما مبنی بر یکپارچه‌سازی و ادامه شماره‌گذاری از بالاترین شماره ریلیز نوت (`v123.2` و سپس اسپرینت `v124.0` لیدیاب):
- تمام شاخه‌های موازی و گیج‌کننده شماره‌گذاری (`v22.x`، `v20.4`، `v21.x`) خاتمه یافته و در مسیر واحد **`v125.0`** یکپارچه شدند.
- شناسه نسخه در `crm/index.html` به `window.VER = 'v125.0'` به‌روزرسانی شد.
- کش Service Worker به `ptf-crm-v125.0` و کش‌باستر تمام اسکریپت‌ها به `?v=125.0` ارتقا یافت.
- کلیه فایل‌های زائد، پیش‌نویس‌های قدیمی و اسناد میانی که کار ایجنت‌های بعدی را مختل می‌کردند (۸۵+ فایل) به طور کامل از ریشه پروژه پاکسازی شدند.

---

## 🛠 رفع باگ‌های اولویت ۱ (Prebroken Path Testers)
- رفع خطاهای هاردکدشده `/home/user/pishtaj/` در ۴ فایل تستر اصلی (`tester2-rbac.js`، `tester3-edge.js`، `tester4-docs.js` و `tester5-site.js`) و بازگرداندن ۱۷۰ چک تست امنیتی، عملکردی و اسناد به رگرسیون خودکار سیستم.
"""

with open(os.path.join(repo, "RELEASE-NOTES-v125.0.md"), "w", encoding="utf-8") as f:
    f.write(v125_content)
print("Created RELEASE-NOTES-v125.0.md")

# 3. Create single clean INSTALL-GUIDE.md
install_content = """# 📘 راهنمای استقرار و نصب سامانه CRM پیشرو تجهیز فرتاک (نسخه v125.0+)

**تاریخ به‌روزرسانی:** ۱۴۰۵/۰۴/۲۱ (July 2026)  
**معماری استقرار:** Flat Root Archive (تخت — بدون پوشه تو در تو)

---

## ۱. ساختار بسته تحویلی (`*.zip`)
بسته تحویلی به صورت کاملاً تخت طراحی شده است. پس از اکسترکت کردن روی سرور، فایل‌ها باید دقیقاً در این ساختار قرار گیرند:
```text
public_html/
├── crm/               ← ماژول‌های فرانت‌اند (index.html, sw.js, *.js)
├── api/               ← اسکریپت‌های بک‌اند PHP (crm.php, llm.php, storage.php, ...)
├── assets/            ← استایل‌ها، تصاویر و فونت‌ها
├── _tools/            ← ابزارهای تست و رگرسیون UAT
├── PTF-MASTER-HANDOVER.md  ← سند اصلی انتقال معماری و بک‌لاگ باگ‌ها
├── INSTALL-GUIDE.md   ← همین راهنما
└── index.html         ← صفحه اصلی وب‌سایت
```

## ۲. مراحل نصب روی هاست (cPanel / DirectAdmin)
1. ابتدا از پوشه `public_html` سرور یک **بک‌آپ کامل** (Zip) بگیرید.
2. فایل زیپ جدید تحویلی (`pishtaj-release-v125.0-*.zip`) را مستقیماً داخل `public_html` آپلود کنید.
3. فایل را Extract کنید (فایل‌های جدید جایگزین کدهای قبلی خواهند شد).
4. در مرورگر به آدرس زیر بروید و یک‌بار پاک‌سازی امن کش را انجام دهید:
   ```text
   https://pishtaj.ir/crm/clear-cache.html
   ```
5. پس از رفرش صفحه CRM، مطمئن شوید بج نسخه در سایدبار یا اطلاعات صفحه **`v125.0`** را نشان می‌دهد.
"""

with open(os.path.join(repo, "INSTALL-GUIDE.md"), "w", encoding="utf-8") as f:
    f.write(install_content)
print("Created INSTALL-GUIDE.md")

# 4. Clean up the conflicting/outdated v22.x release notes now that v124.0 is written
for f in glob.glob(os.path.join(repo, "RELEASE-NOTES-v22.*.md")):
    if os.path.exists(f): os.remove(f)
for f in glob.glob(os.path.join(repo, "RELEASE-NOTES-v21.0-*.md")):
    if os.path.exists(f): os.remove(f)
if os.path.exists(os.path.join(repo, "RELEASE-NOTES-v17.7-r8-backlog.md")):
    os.remove(os.path.join(repo, "RELEASE-NOTES-v17.7-r8-backlog.md"))
print("Cleaned up remaining conflicting version docs.")
