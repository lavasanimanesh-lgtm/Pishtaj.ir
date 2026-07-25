# 🔐 ریلیز v21.4 — BUG-039 ویرایش پیشنهاد + زیرساخت تست انسانی AI-Persona

**مبنا:** v21.3

## BUG-039 — ویرایش پیشنهاد: کارفرما و شماره درخواست خالی می‌آمد
### ریشه
- مقدار select گاهی فقط با attribute `selected` در HTML ست می‌شد و پس از insert مودال reliably اعمال نمی‌شد
- اگر `buyerCd` در لیست مشتریان نبود (ادغام/حذف)، گزینه غایب بود
- برچسب فقط `co` بود در حالی که ذخیره اغلب `coEn` است → سردرگمی کاربر

### رفع
- ست صریح `ofBuyer.value` و `ofInq.value` بعد از `insertAdjacentHTML`
- افزودن option موقت اگر buyer/inq در لیست نیست
- برچسب دو‌نامی `co / coEn`
- بازیابی رابط در حالت keep

## زیرساخت تست شبیه‌سازی‌شده انسانی
- `_personas/` — ۱۰ کاربر فرضی
- `_human_test/README.md` + templates
- `_tools/human/run-persona-gate.js` — گیت
- `_tools/human/sprint-counter.json` — شمارنده ۵ اسپرینت
- قانون هنداور: **هر ۵ اسپرینت gate انسانی الزامی**

## Gate انسانی v21.4
- اجرا با `--force` (تکمیل زیرساخت + باگ فرم)
- ۱۰ پرسونا، ۷ سناریو هسته، حکم **PASS**
- ۳ پیشنهاد UX با تأیید ≥۲ در `BACKLOG-HUMAN-TEST-FINDINGS.md`

## تست
- tester130-v214: 19 PASS
- human gate: PASS

## فایل‌ها
- crm/offers.js, index.html, sw.js
- _personas/*, _human_test/*, _tools/human/*
- HUMAN-TEST-REPORT-v21.4.md
