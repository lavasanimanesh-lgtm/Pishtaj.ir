# 📦 ریلیزنوت v23.8 — اسپرینت ۲۳۸: BUG-A + BUG-B (فساد quote در HTML پویا)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v23.7 | **مرجع:** پروتکل QA/QC هفت‌مرحله‌ای

---

## 🎯 دستاورد

### BUG-A — دکمه مشاهده/ویرایش درخواست (`crm/index.html` → `renderRfq`)
**Root Cause:** ساخت `onclick` با quote غلط باعث می‌شد خروجی HTML به‌صورت
`onclick="ptfViewRfq('" + cdSafe + "')"` فاسد شود و دکمه در عمل کار نکند/درست دیده نشود.

**Fix:** تصحیح concat به الگوی امن `\'' + cdSafe + '\'` برای `ptfViewRfq` و `editRfq`.

### BUG-B — ذخیره/اصلاح پیشنهاد (`crm/offers.js` → فیلدهای اقلام)
**Root Cause:** `oninput` فیلدهای `offUpdItem` / `offUpdExtra` با همان فساد quote ساخته می‌شد؛
تایپ کاربر state اقلام را به‌روز نمی‌کرد → ذخیره/ویرایش عملاً ممکن نبود.

**Fix:** تصحیح builderهای oninput به `\'' + f + '\'` و `\'' + escP(c) + '\'`.

### همراه از قبل
- OPS-003 (`inqreader.js`) از v23.7

### عمداً باز
- OPS-002 پیش‌نمایش z-index
- BUG-C scoring.js syntax (غیرمسدودکننده مسیر پیشنهاد)

---

## 📁 فایل‌های تغییر یافته
- `crm/index.html` — BUG-A + VER v23.8 + cache-bust
- `crm/offers.js` — BUG-B
- `crm/sw.js` — ptf-crm-v23.8
- `RELEASE-NOTES-v23.8.md`
- `INSTALL-GUIDE.md`
- `PTF-MASTER-HANDOVER.md` (الحاقیه)

---

## 🛡️ تست
- اجرای واقعی `renderRfq` → `onclick="ptfViewRfq('RFQ-1001')"` PASS
- اجرای واقعی builder اقلام → `oninput="offUpdItem(0,'name',this.value)"` PASS
- `node --check crm/offers.js` PASS
- `node --check crm/inqreader.js` PASS

## 📦 بسته
`pishtaj-release-v23.8.zip` — Flat Root Archive
