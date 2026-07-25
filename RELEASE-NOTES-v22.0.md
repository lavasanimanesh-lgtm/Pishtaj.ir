# 🚀 ریلیز v22.0 — اسپرینت توسعه‌ای (Development Sprint)

**مبنا:** v21.10  
**تاریخ:** ۱۴۰۵/۰۴/۲۱ (۲۰۲۶-۰۷-۱۱)  
**نوع:** اسپرینت توسعه‌ای — ادغام دو مسیر: فیلتر مشتریان + پیش‌پرداخت ساختاریافته + تامین‌کنندگان خارجی  
**شناسه بسته:** `pishtaj-release-v22.0.zip`

---

## 🎯 هدف این اسپرینت

ادغام سه حوزه کلیدی در یک ریلیز واحد:

1. **US-411 Phase 1A:** فیلتر «مشتریان من» — محرمانگی داده + RBAC
2. **BUG-023 + US-424:** پیش‌پرداخت و مطالبات قابل اعتماد — ساختاریافته‌سازی + گارد مالی
3. **BUG-022:** تب داخلی/خارجی تامین‌کنندگان — اصلاح فیلتر origin

---

## ✅ اجرا شد

### ۱. US-411: فیلتر «مشتریان من» (My Customers Filter)
**مسئله:** کاربران غیرارشد (فروشنده، خریدار، حسابدار، وصول) به همه مشتریان دسترسی داشتند.

**معماری (اصل 11 — Hook-based):**
- بدون تغییر `offers.js` یا `index.html`
- منطق فیلتر در `my-customers-filter.js`، state در `localStorage`
- UI toggle بالای لیست مشتریان

**منطق نقش‌محور (تأیید کارفرما — ۱۴۰۵/۰۴/۱۴):**
- **ارشدها (admin/chairman/ceo/commercial):** همه مشتریان + toggle «من/همه»
- **سایر نقش‌ها (sales/buyer/accountant/collector):** فقط `crBy=me` — رکوردهای بدون مالک مخفی

**رفع باگ تست:**
- `setupHook()` دیگر setTimeout بی‌نهایت ندارد — limit ۶۰ retry (۶ ثانیه)

### ۲. BUG-023 + US-424: پیش‌پرداخت و مطالبات قابل اعتماد
**مسئله:** درصد/مبلغ پیش‌پرداخت غیرمنطقی (مثل `%100000000`) و فقدان ساختار داده.

**اجزای رفع:**
- `ptfAdvanceNormalize(o)`: نرمال‌سازی داده legacy + سقف‌گذاری درصد به ۱۰۰
- `ptfAdvanceLabel(o)`: برچسب خوانا برای نمایش
- `ptfAdvanceOpen(no)`: دیالوگ ساختاریافته با ۴ حالت:
  - `none` — بدون پیش‌پرداخت
  - `pct` — درصدی (۰ تا ۱۰۰)
  - `amt` — مبلغ ثابت
  - `full` — پرداخت کامل/نقدی (۱۰۰٪)
- `ptfAdvanceLiveBind(total, cur)`: محاسبه زنده درصد/مبلغ/نرخ
- **گاردها:**
  - درصد باید ۰ تا ۱۰۰ باشد
  - مبلغ منفی پذیرفته نمی‌شود
  - نرخ تسعیر برای اسناد ارزی الزامی
  - مبلغ > کل → حالت exceptional با confirm
- **Hookها:**
  - `offerSave()`: پس از ثبت پیشنهاد CO/TC، پرسش خودکار پیش‌پرداخت
  - `offerSetSt('won')`: هنگام برد، باز کردن دیالوگ پیش‌پرداخت
  - `renderReceivables()`: نمایش مطالبات باز + دکمه «وصول شد»

### ۳. BUG-022: تب داخلی/خارجی تامین‌کنندگان
**مسئله:** تب خارجی تامین‌کنندگان خارجی را نشان نمی‌داد و ردیف داخلی نمایش می‌داد.

**اجزای رفع:**
- `ptfSupTab(origin)`: فیلتر بر اساس فیلد `origin` (داخلی/خارجی)
- `ptfSupOriginReview()`: ابزار بازبینی یک‌کلیکی برای اصلاح رکوردهای جابه‌جاشده legacy
- فیلد `origin` در فرم ثبت/ویرایش تامین‌کننده
- دکمه‌های تب در UI بانک تامین‌کنندگان

---

## ⚠️ باگ‌های باز (برنامه v22.1)

| شناسه | عنوان | برنامه |
|:---|:---|:---|
| BUG-024 | تب خارجی در برخی شرایط cache خالی نمایش نمی‌دهد | v22.1 |
| US-425 | گزارش PDF مطالبات پیش‌پرداخت | v22.1 |

---

## 📦 فایل‌های تغییرکرده

| فایل | تغییر |
|:---|:---|
| `crm/my-customers-filter.js` | جدید — فیلتر «مشتریان من» با RBAC + hook-based |
| `crm/petty.js` | `ptfAdvanceNormalize/Label/Open/LiveBind/advancePaid` + hookهای offerSave/SetSt/RenderRecv |
| `crm/cheques.js` | `ptfSupTab` + `ptfSupOriginReview` + فیلد origin |
| `crm/index.html` | VER=v22.0؛ cache-bust همه=v22.0؛ ثبت `my-customers-filter.js` |
| `crm/sw.js` | CACHE=ptf-crm-v22.0 |
| `_tools/uat/tester125-v22.js` | تستر US-411 (فیلتر مشتریان) |
| `_tools/uat/tester136-v2110.js` | به‌روزرسانی — رگرسیون اصلاحات v21.10 در v22.0 |
| `_tools/uat/tester137-v220.js` | جدید — تستر v22.0 (US-411 + BUG-023 + US-424 + BUG-022) |
| `RELEASE-NOTES-v22.0.md` | جدید — این سند |
| `PTF-MASTER-HANDOVER.md` | الحاقیه v22.0 |

---

## 🧪 تست

| شاخص | مقدار |
|:---|---:|
| تسترهای فعال | ۱۲۱ |
| تسترهای legacy | ۴ (جداگانه) |
| چک PASS | ۳,۳۰۰+ |
| چک FAIL | ۰ |
| audit.py | PASS |
| **tester125-v22** | **۴۸ PASS / ۰ FAIL** |
| **tester136** | **۲۶ PASS / ۰ FAIL** |
| **tester137-v220** | **۴۳ PASS / ۰ FAIL** |

---

## 📥 نصب

### روش توصیه‌شده: نصب تمیز (Clean Install)

```bash
# ۱. بک‌آپ گیری از داده فعلی (اجباری)
cd ~/public_html/crm/data
cp ptf_crm_data.json ptf_crm_data.json.backup-$(date +%Y%m%d-%H%M%S)

# ۲. حذف فایل‌های قدیمی CRM (نه داده)
cd ~/public_html
rm -rf crm/* api/*
# ⚠️ دقت: crm/data/ را حذف نکنید!

# ۳. اکسترکت بسته جدید
unzip -o pishtaj-release-v22.0.zip -d ~/public_html/

# ۴. پرمیشن‌ها
chmod 755 crm/data
chmod 644 crm/data/.htaccess
chmod 600 crm/data/ptf_crm_data.json 2>/dev/null || true

# ۵. رفرش مرورگر (کاربر نهایی)
Ctrl + F5
```

**یا از فایل `INSTALL-GUIDE-v21.10.md` (بروزرسانی دستی) استفاده کنید.**

---

## 🔄 چک‌لیست قبل از deploy

- [ ] بک‌آپ داده سرور گرفته شده
- [ ] فایل zip از `pishtaj-release-v22.0.zip` است
- [ ] extract-overwrite روی پوشه `crm/` و `api/` (نه حذف کامل)
- [ ] `crm/data/` حذف **نشده**
- [ ] کاربر نهایی `Ctrl+F5` می‌زند
- [ ] نسخه SW در DevTools = `ptf-crm-v22.0`

---

*این اسپرینت توسعه‌ای توسط ایجنت Arena.ai تولید شده است.*
