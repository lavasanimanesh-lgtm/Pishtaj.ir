# 📊 گزارش رگرسیون v31.7.19

**تاریخ:** ۱۴۰۵/۰۴/۲۹ (2026-07-20)
**نسخه:** v31.7.19
**ابزار:** `_tools/run-full-regression.js` + `python3 _tools/audit.py` (۱۰ بخش)

## ✅ نتیجه نهایی

| معیار | مقدار | وضعیت |
|--------|-------|--------|
| تعداد تسترها | **۱۷۲** (+۱: tester194-pdf-name-icon-header؛ tester41 و tester193 با اصلاح نهایی هدر همگام شدند) | — |
| فایل‌های PASS | **۱۷۲** | ✅ ۱۰۰٪ |
| چک‌های FAIL | **۰** | ✅ صفر |
| audit.py (۱۰ بخش) | **PASS** | ✅ |
| `node --check` (۸ فایل تغییریافته) | **PASS** | ✅ |

## 🆕 پوشش تست جدید (tester194)

- **رفتاری ptfPrintWithTitle:** حین چاپ عنوان = شماره سند؛ پس از afterprint عنوان برنامه بازمی‌گردد
- title سنددار: CHQ-{صیادی}، ANL-{تاریخ}، FIS-{سال}×۲، SCORE، LTR-DRAFT
- رگرسیون پوشش قبلی: CO/TO (o.no)، نامه (l.no)، قرارداد (c.no)، بسته‌بندی (pl.no)، تامین (r.no)، استعلام (inqNo)
- آیکون store در MAP برای 🏬/🧱
- هدر: بدون overflow:hidden سراسری، بج نسخه ellipsis+LTR، tbic overflow:visible، خلوت‌سازی

## 📌 درس ثبت‌شده

مهار سرریز flex باید در سطح فرزندان (min-width:0 + ellipsis) انجام شود؛ `overflow:hidden` روی والد، بج‌ها و عناصر positioned را می‌برد — عارضه v31.7.18 که با اسکرین‌شات کارفرما دیده شد.

## 📁 فایل‌های تغییریافته

`crm/ui-kit.js`، `crm/cheques.js`، `crm/analyzer.js`، `crm/fiscal.js`، `crm/scoring.js`، `crm/ai-workbench.js`، `crm/iconx.js`، `crm/mobilenav.js` + bump ۴نقطه‌ای + tester194 (جدید)

## 🚦 وضعیت گیت‌ها

- **گیت فنی: سبز** ✅
- **گیت انسانی: معوق** ⏳ — سه سناریوی RELEASE-NOTES روی گوشی واقعی + دانلود PDF واقعی از مرورگرهای Chrome/Safari.
