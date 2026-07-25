# 📦 ریلیزنوت v23.9 — اسپرینت ۲۳۹: ریشه واقعی دکمه مشاهده (bridge.js override) + سخت‌سازی ذخیره پیشنهاد

**نسخه قبلی:** v23.8

## Root Cause واقعی «دکمه مشاهده نیست»
تابع `window.renderRfq` در **`crm/bridge.js`** کل رندر جدول درخواست‌ها را **جایگزین** می‌کند و نسخهٔ `index.html` را دور می‌زند.
در آن override فقط «ویرایش/حذف» و «ارجاع» بود — **هیچ دکمه مشاهده‌ای وجود نداشت**.
به همین دلیل فیکس‌های قبلی روی `index.html` / `inqreader.js` در UI واقعی دیده نمی‌شد.

## Fix
- `crm/bridge.js`: افزودن دکمه 👁 مشاهده با `ptfViewRfq` در ردیف عملیات
- `crm/offers.js`: export صریح `window.offerSave/Edit/New/Form/Preview` + `type=button` روی ذخیره

## همراه از قبل
- v23.8: quote fix در index renderRfq و offUpdItem/Extra
- v23.7: inqreader OPS-003

## بسته
`pishtaj-release-v23.9.zip`
