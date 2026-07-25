# 📦 ریلیزنوت v23.7 — اسپرینت ۲۳۷: OPS-003 رفع قطعی مشاهده درخواست (SyntaxError inqreader + DOM-safe actions)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v23.6 (اسپرینت ۲۳۶) | **مرجع حاکمیتی:** تیم ارشد QA/QC (پروتکل ۷مرحله‌ای)

---

## 🎯 دستاورد اسپرینت ۲۳۷ (Hard Repro → Single Patch)

### OPS-003 — دکمه/عملکرد «👁 مشاهده درخواست»
**Root Cause واقعی:** در `crm/inqreader.js` تابع `patchRenderRfq` HTML دکمه‌ها را با الحاق شکنندهٔ quote می‌ساخت (`onclick="ptfViewRfq('' + ...")`) که باعث `SyntaxError: Unexpected string` و **عدم بارگذاری کل ماژول** می‌شد. در نتیجه `window.ptfViewRfq` تعریف نمی‌شد و مشاهده درخواست در عمل از کار می‌افتاد.

**Fix (scoped — فقط همین فایل):**
- حذف الگوهای شکستهٔ onclick رشته‌ای در patch جدول درخواست
- معرفی `ptfRfqActionBtn` / `ptfRfqEnsureViewBtn` مبتنی بر DOM API (`createElement` + `addEventListener`) تا HTML action دیگر با quote nesting نشکند
- تضمین دکمه «👁 مشاهده» در هر سه حالت:
  - درخواست عادی
  - دارای پیشنهاد
  - برنده / منتقل به پروژه
- حذف brace اضافه در انتهای `patchRenderRfq`
- **بدون** تغییر API/DB و بدون ورود به OPS-001 (ذخیره پیشنهاد) و OPS-002 (پیش‌نمایش z-index)

---

## 📁 فایل‌های تغییر یافته نسبت به v23.6
- `crm/inqreader.js` — OPS-003
- `crm/index.html` — همگام‌سازی `VER=v23.7` و cache-bust `?v=23.7`
- `crm/sw.js` — `ptf-crm-v23.7`
- `RELEASE-NOTES-v23.7.md` — این سند
- `INSTALL-GUIDE.md` — نسخه استقرار
- `PTF-MASTER-HANDOVER.md` — الحاقیه وضعیت

---

## 🛡️ ممیزی کیفیت
- `node --check crm/inqreader.js` → **PASS (exit 0)** (قبلاً FAIL/SyntaxError)
- Behavioral harness OPS-003: مشاهده در normal/hasOffer/won → **PASS**
- Integrity: خارج از فایل‌های اسپرینت دست‌نخورده
- Ticketهای باز باقی‌مانده (عمداً خارج از این ریلیز): **OPS-001** (ذخیره پیشنهاد)، **OPS-002** (پیش‌نمایش پشت مودال)

---

## 📦 بسته تحویلی
**`pishtaj-release-v23.7.zip`** — Flat Root Archive (بدون پوشه تو در تو)

### Verify کارفرما پس از Extract
1. کنسول مرورگر: بدون `inqreader.js SyntaxError`
2. `typeof ptfViewRfq === 'function'` → true
3. مشاهده درخواست در ردیف عادی / دارای پیشنهاد / برنده
