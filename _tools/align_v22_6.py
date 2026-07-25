import os, glob, re

repo = "/home/user/pishtaj_project"

# 1. Create RELEASE-NOTES-v22.6.md (Sprint 226)
v22_6_content = """# 📦 ریلیزنوت v22.6 — اسپرینت ۲۲۶: ویرایش و حذف بستانکاری تامین‌کنندگان + رفع باگ‌های اولویت ۲ (پیش‌پرداخت ارزی، کسر فاکتور، تسعیر یوان)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v22.5 (اسپرینت ۲۲۵)

---

## 🚀 قابلیت جدید: ویرایش و حذف بدهی/بستانکاری تامین‌کنندگان (`crm/scoring.js`)
در پاسخ به نیاز کارفرما مبنی بر عدم امکان اصلاح بدهی ثبت‌شده اشتباه به تامین‌کننده (`ptf_crm_payables`):
- دکمه‌های **`✏️ ویرایش`** و **`🗑 حذف`** به هر ردیف از کارت‌های بدهی تامین‌کنندگان در مودال جزئیات بستانکاری‌ها (`ptfPayablesOpen`) اضافه شد.
- تابع جدید `window.ptfPayableEdit(cd)`: مودال کامل ویرایش شامل نام تامین‌کننده، شرح کالا، مبلغ، ارز فاکتور (`IRR/EUR/USD/CNY/AED/GBP`)، نرخ تسعیر، نحوه تسویه (`credit/cash`) و تاریخ/یادداشت تعهد تحویل را باز کرده و با اعتبارسنجی دقیق تغییرات را ذخیره و در `audit` ثبت می‌کند.
- تابع جدید `window.ptfPayableDel(cd)`: پس از دریافت تایید امنیتی، بدهی اشتباه را با ثبت دلیل در بایگانی و لاگ `audit` حذف کرده و پنل و باکس آماری را به‌روزرسانی می‌کند.

---

## 🛠 رفع باگ‌های اولویت ۲ (Priority 2 Bug Fixes)
- **`BUG-126-01` (`tester100-v182.js` — وصول پیش‌پرداخت ارزی in `crm/petty.js`):** حل توقف عملیات در ثبت وصول پیش‌پرداخت‌های ارزی با جایگذاری خودکار نرخ روز (`liveRate`) و محاسبه مانده ارزی (`remainDocAmt`) هنگام عدم ارسال مستقیم مبلغ در فراخوانی‌ها.
- **`BUG-126-02` (`tester109-v193.js` — کسر خودکار پیش‌پرداخت در فاکتور in `crm/rbac.js`):** ارتقای فرمول محاسبه کسر پیش‌پرداخت به `_a.cashFull ? grand : Math.min(grand, Math.round(+_a.amt || 0))` جهت تضمین تسویه کامل یا کسر دقیق در صدور فاکتورهای حسابداری (`saveInv`).
- **`BUG-126-03` (`tester85-v167.js` — تسعیر سروری یوان in `api/fx-rates.php`):** اضافه شدن نامزدهای جستجوی الگو (`$CNY_HAV_CANDIDATES = ['price_cny_hav', 'cny_hav', 'yuan_hav']`) و تبدیل‌های متقاطع سروری (`$out['usd_cny']` و `$out['gold18_cny']`).
- **`BUG-126-04` (`tester87-v169.js` — راهنمای اتصال سنا in `crm/fx.js`):** اصلاح متن راهنمای خروجی عیب‌یابی `ptfFxDiag` با ذکر لزوم دسترسی `outbound به *.tgju.org و sana`.

---

## 🔢 یکپارچه‌سازی نگاشت نسخه (v22.6)
- شناسه نسخه در `crm/index.html` به `window.VER = 'v22.6'` و کش‌باستر تمام اسکریپت‌ها به `?v=22.6` ارتقا یافت.
- کش Service Worker در `crm/sw.js` به `ptf-crm-v22.6` تنظیم شد.
- پسوند `-audited-flat` طبق دستور کارفرما از نام فایل تحویلی زیپ حذف و به صورت پاکیزه **`pishtaj-release-v22.6.zip`** صادر شد.
"""
with open(os.path.join(repo, "RELEASE-NOTES-v22.6.md"), "w", encoding="utf-8") as f:
    f.write(v22_6_content)

# Update crm/index.html to v22.6
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()
idx = re.sub(r"window\.VER\s*=\s*'[^']+';", "window.VER = 'v22.6';", idx)
idx = re.sub(r"var VER\s*=\s*'[^']+';", "var VER = 'v22.6';", idx)
idx = re.sub(r"\?v=[0-9.]+", "?v=22.6", idx)
with open(index_path, "w", encoding="utf-8") as f: f.write(idx)

# Update crm/sw.js to v22.6
sw_path = os.path.join(repo, "crm/sw.js")
with open(sw_path, "r", encoding="utf-8") as f: sw = f.read()
sw = re.sub(r"ptf-crm-v[^'\"]+", "ptf-crm-v22.6", sw)
with open(sw_path, "w", encoding="utf-8") as f: f.write(sw)

# Update crm/clear-cache.html to v22.6
cc_path = os.path.join(repo, "crm/clear-cache.html")
with open(cc_path, "r", encoding="utf-8") as f: cc = f.read()
cc = re.sub(r"v[0-9.]+", "v22.6", cc)
with open(cc_path, "w", encoding="utf-8") as f: f.write(cc)

# Update INSTALL-GUIDE.md to v22.6+
inst_path = os.path.join(repo, "INSTALL-GUIDE.md")
with open(inst_path, "r", encoding="utf-8") as f: inst = f.read()
inst = inst.replace("v22.5+", "v22.6+").replace("v22.5", "v22.6")
with open(inst_path, "w", encoding="utf-8") as f: f.write(inst)

# Update PTF-MASTER-HANDOVER.md to reflect v22.6, v22.7
ho_path = os.path.join(repo, "PTF-MASTER-HANDOVER.md")
with open(ho_path, "r", encoding="utf-8") as f: ho = f.read()
ho = ho.replace("v22.5 (اسپرینت ۲۲۵)", "v22.6 (اسپرینت ۲۲۶)").replace("بسته جاری قابل استقرار: `pishtaj-release-v22.5-audited-flat.zip`", "بسته جاری قابل استقرار: `pishtaj-release-v22.6.zip`")
ho = re.sub(r"الحاقیه v[0-9.]+ \(اسپرینت [۰-۹]+\) — ممیزی عمیق باگ‌ها", "الحاقیه v22.6 (اسپرینت ۲۲۶) — ویرایش بدهی تامین‌کننده + باگ‌های اولویت ۲", ho)
with open(ho_path, "w", encoding="utf-8") as f: f.write(ho)

print("Successfully aligned and documented Sprint 226 (v22.6)!")
