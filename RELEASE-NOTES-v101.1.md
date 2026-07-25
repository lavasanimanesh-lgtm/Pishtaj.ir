# 🚀 یادداشت‌های انتشار (Release Notes - Version 101.1 — AI Summarize Hotfix)

**پروژه:** شرکت پیشرو تجهیز فرتاک (pishtaj.ir) — پلتفرم ۳۶۰ درجه زنجیره تامین و CRM  
**تاریخ ریلیز:** ۱۷ تیر ۱۴۰۵ (July 2026)  
**تمرکز اسپرینت ۱۰۱.۱:** هاتفیکس فوری US-242 — رفع باگ خلاصه هوشمند AI پس از آپدیت v101.0

---

## 🐞 مشکل گزارش‌شده

- دکمه خلاصه AI زرد می‌ماند (🟡)
- تست واقعی اتصال: ✅ سبز — «اتصال واقعی برقرار است»
- ولی خلاصه تولید نمی‌شود

## 🔍 علت ریشه‌ای (۳ مورد)

1. **Thinking Tokens در summarize:** Gemini 2.5 حدود ۳۰۰-۶۰۰ توکن تفکر مصرف می‌کند. سقف خروجی قبلی ۱۵۰۰ بود → عملاً پاسخ ناقص → `finishReason: MAX_TOKENS`
2. **Catalog Gateway (US-241) ایزوله نبود:** تابع `ptfUniversalSyncCatalogFromInquiry()` اگر خطا می‌داد، کل callback خلاصه قطع می‌شد و `aiSumSt` روی pending می‌ماند
3. **JSON parse سخت‌گیرانه:** پاسخ AI گاهی با ```json ... ``` برمی‌گردد

## ✅ راه‌حل v101.1

### سرور (`api/llm.php`)
- `summarize` max_tokens: **۱۵۰۰ → ۲۵۰۰**
- prompt تقویت شد: `IMPORTANT: Reply ONLY as compact JSON, no markdown`
- تشخیص خطای دقیق‌تر + لاگ raw تا ۵۰۰ کاراکتر
- نسخه: `v101.1` / US-242

### کلاینت (`crm/inqreader.js`)
- catalog sync در `try{...}catch` ایزوله شد — حتی اگر بانک کالا خطا بده، خلاصه سبز می‌ماند
- `renderRfq()` و `audit()` هم safe-wrap شدند
- لاگ کنسول: `catalog sync skipped (v101.1 safe)`

### PWA
- Service Worker cache → `ptf-crm-v101.1`
- `window.VER = 'v101.1'`

## 🧪 تست

| تست | نتیجه |
|---|---|
| TC-101.1-01 Summarize کوتاه (<500 کاراکتر) | ✅ PASS |
| TC-101.1-02 Summarize بلند (۳۰۰۰ کاراکتر + ۲۰ قلم) | ✅ PASS |
| TC-101.1-03 Catalog sync خطا عمدی → خلاصه همچنان سبز | ✅ PASS |
| TC-101.1-04 Regression: OCR / Translate / Identify | ✅ PASS |

## 📦 نصب

`pishtaj-hotfix-v101.1-ai-summary.zip`

فایل‌ها:
- `api/llm.php`
- `crm/inqreader.js`
- `crm/index.html`
- `crm/sw.js`

بعد از اکسترکت: **Ctrl+F5**

---
*با تشکر از گزارش دقیق شما — دکمه زرد ولی اتصال سبز = امضای دقیق همین باگ بود.*
