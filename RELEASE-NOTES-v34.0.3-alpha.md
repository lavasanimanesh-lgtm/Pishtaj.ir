# 📦 ریلیزنوت v34.0.3-alpha — رفع دو هشدار کنسول (متای PWA + sandbox iframe چاپ)

**تاریخ:** ۱۴۰۵/۰۵/۱۳ (2026-08-04) | **نسخه قبلی:** v34.0.2-alpha

---

## 🎯 هدف این ریلیز

گزارش کارفرما: در کنسول مرورگر (صفحهٔ پیش‌نمایش چاپ گزارش دورهٔ تنخواه) دو هشدار دیده می‌شود:

1. `<meta name="apple-mobile-web-app-capable"> is deprecated. Please include <meta name="mobile-web-app-capable">`
2. `An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.` (از `ptfPreviewPrintableDoc` ← `ptfPettyPeriodPrint`)

---

## ✅ تغییرات این نسخه

### ۱) متای PWA (`crm/index.html`)
- `<meta name="mobile-web-app-capable" content="yes">` (استاندارد) کنار نسخهٔ اپل اضافه شد؛ هر دو باقی می‌مانند (نسخهٔ اپل برای iOS Safari لازم است). هشدار deprecation کروم/اج حذف می‌شود.

### ۲) iframe پیش‌نمایش چاپ (`crm/offers-pro.js` — `ptfPreviewPrintableDoc`)
- **حذف `sandbox="allow-same-origin allow-scripts allow-modals"`** از `#ptfPrintFrame`:
  - ترکیب `allow-scripts` + `allow-same-origin` دقیقاً همان چیزی است که کروم به آن هشدار می‌دهد («می‌تواند از sandbox خارج شود») — یعنی در عمل هیچ ایزولاسیونی هم فراهم نمی‌کرد؛
  - محتوای iframe سند چاپیِ **تولیدشدهٔ داخلی** (داده‌های کاربر با `escP` فرار داده می‌شوند) است، نه محتوای خارجی؛
  - توابع `ptfAdjustPreviewLayout` (دسترسی `contentDocument` برای تنظیم چیدمان) و `ptfPrintPreviewGo` (`contentWindow.print()`) به دسترسی same-origin نیاز دارند — با sandboxِ بدون `allow-same-origin` می‌شکستند.
- **مقاوم‌سازی srcdoc:** فرار `</iframe>` در محتوای srcdoc اعمال شد (کد قبلاً `safeDoc` را می‌ساخت ولی استفاده نمی‌کرد — dead code) تا هیچ محتوایی نتواند از تگ iframe خارج شود.

### ۳) بامپ نسخه + cache-busting (v34.0.3-alpha)
- `crm/index.html`: `window.VER` → `v34.0.3-alpha` + هر ۸۵ پارامتر `?v=` اسکریپت‌ها به‌روز شد.
- `crm/sw.js`: نام کش سرویس‌ورکر → `ptf-crm-v34.0.3-alpha` (باید با index هم‌خوان باشد تا کاربران فایل‌های تازه را بگیرند).
- `VERSION.json` هم‌خوان شد (`crm_version: v34.0.3-alpha`).

---

## 🧪 تست پیشنهادی روی استیجینگ

1. رفرش کامل CRM (یا `crm/clear-cache.html`)؛ سایدبار باید «نسخه فعال: v34.0.3-alpha» را نشان دهد.
2. پنل تنخواه ← «گزارش دوره» ← «🖨 چاپ/PDF» (یا PDF تلفیقی) ← پیش‌نمایش باز شود.
3. کنسول (F12): هشدارهای sandbox و meta نباید دیگر ظاهر شوند.
4. دکمه‌های «🎛 تنظیم چیدمان و گنجایش صفحه» و «🖨️ چاپ / ذخیره PDF» همچنان کار کنند.
5. «⬇️ دانلود HTML» و «🗗 تب جدید» سالم باشند.

---

## 📁 پرونده‌های تغییرکرده

| فایل | تغییر |
|---|---|
| `crm/index.html` | +متای `mobile-web-app-capable` + بامپ v34.0.3-alpha (VER + ۸۵ باستر) |
| `crm/offers-pro.js` | حذف sandbox از `#ptfPrintFrame` + فرار `</iframe>` در srcdoc |
| `crm/sw.js` | نام کش → `ptf-crm-v34.0.3-alpha` |
| `VERSION.json` | `crm_version: v34.0.3-alpha` |
