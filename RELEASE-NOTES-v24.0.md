# ریلیزنوت v24.0 — ذخیره پیشنهاد (رفع قفل خاموش)

## Root Cause
زنجیره `window.offerSave` توسط `offers-pro` و `offerlock` wrap می‌شود.
`offValidateItems` داخل IIFE با `'use strict'` به `_offState` متکی بود؛ اگر state روی `window` نبود یا throw رخ می‌داد، کلیک ذخیره **بدون هیچ alert** می‌مرد.

## Fix
- `offers.js`: `ptfSetOffState` → همگام‌سازی `window._offState`؛ try/catch در `offerSave`؛ دکمه `window.offerSave()`
- `offerlock.js`: validate امن با `window._offState` + try/catch
- `offers-pro.js`: try/catch روی wrapper ذخیره

## Verify
1. نسخه v24.0
2. پیشنهاد جدید → کارفرما + شرح/تعداد/قیمت
3. ذخیره → یا موفق می‌شود یا **پیام خطا** (دیگر سکوت مطلق نباید باشد)
