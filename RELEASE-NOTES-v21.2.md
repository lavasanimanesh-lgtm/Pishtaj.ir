# 🔐 ریلیز v21.2 — US-402 + US-403 (انتخاب تامین‌کننده + پیش‌نمایش اسناد)

**مبنا:** v21.1  
**تاریخ:** ۱۴۰۵/۰۴/۲۰  
**خانواده:** UX روزانه استعلام تامین / اسناد

---

## US-402 — انتخاب آسان تامین‌کننده + PDF مختص گیرنده
- گام ۳ ویزارد `rfqsmart`:
  - جستجوی زنده دوزبانه (`rfqsMatchSup` + `entityMatches`/`ptfSupSpecBlob`/`ptfBrandCanon`)
  - چیپ انتخاب‌شده‌ها با ✕
  - دو بخش: ⭐ پیشنهاد هوشمند (top5) + سایر (جمع‌شونده؛ با جستجو باز می‌شود)
- گام ۴ / کارت رهگیری: دکمه **🖨 PDF** کنار هر تامین‌کننده
- `rfqsPrint(no, targetIdx)`: سربرگ **To / گیرنده** با نام/تلفن/ایمیل همان تامین‌کننده
- PDF عمومی (بدون targetIdx) حفظ شد
- top5 خودکار + `rfqsFinalize` / یادگیری US-399 دست‌نخورده

## US-403 — پیش‌نمایش اسناد داخل نرم‌افزار
- `openStoredFile` → مودال `ptfOpenDocViewer` (نقطه اصلاح واحد)
- پشتیبانی: تصویر / PDF / متن؛ سایر فرمت‌ها پیام + دانلود
- نوار: ⬇️ دانلود (`ptfDownloadStoredFile`) | 🗗 تب جدید (fallback) | ✕ / ESC
- سازگار با قاعده مودال‌های visible (id جدا `ptfDocViewer`، z-index بالا)
- fallback `window.open` اگر viewer در دسترس نباشد

## تست
- **tester128-v212:** 41 PASS / 0 FAIL

## فایل‌ها
- `crm/rfqsmart.js`
- `crm/storage.js`
- `crm/index.html` / `crm/sw.js` (v21.2)

## نصب
extract-overwrite + Ctrl+F5  
SW: `ptf-crm-v21.2`
