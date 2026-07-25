# ریلیزنوت v25.6 — ریشه خاموش شدن دکمه ذخیره (سراسری)

## Root Cause (چک)
دکمه ذخیره فرم چک با الگوی خراب ساخته می‌شد:
`onclick="chSaveForm("CHQ-xxx")"`  
به‌خاطر `JSON.stringify` داخل attribute با `"` → HTML attribute قطع می‌شد → کلیک هیچ تابعی صدا نمی‌زد (سکوت کامل).
همین الگو برای پیش‌نویس چاپ هم بود.

## Fix چک
- `chJsArg` + `onclick="chSaveForm('...')"` امن
- `chSaveForm` با try/catch و پیام خطا
- جمع‌آوری مبلغ و kind مقاوم‌تر

## Fix پیشنهاد (هم‌خانواده سکوت ذخیره)
- قبل از اعتبارسنجی: واحد خالی → NO + نرمال انگلیسی
- `offValidateItems`: ستون unit دیگر مانع ذخیره نیست
- همگام `window._offState`

## الگوی سراسری
- `window.ptfOnClickArg` در ui-kit برای آینده
- اسکن: دیگر `JSON.stringify` داخل onclick در crm/*.js نیست

## Verify
1. ویرایش چک ضمانت پیش‌پرداخت → ذخیره → toast موفقیت
2. ویرایش پیشنهاد → ذخیره (یا پیام اعتبارسنجی واضح، نه سکوت)
