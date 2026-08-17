# یادداشت اصلاح — دکمهٔ «صورتحساب غیررسمی» در پرونده‌های فروش

- **تاریخ:** ۱۴۰۵/۰۵/۲۶ (۲۰۲۶-۰۸-۱۷)
- **برنچ:** `arena/01a00ea4-pishtaj-ir`
- **فایل:** `crm/salesfiles.js`

## خلاصه

دکمهٔ «🧾 صورتحساب غیررسمی» در کشوی پروندهٔ فروش هنگام کلیک هیچ عملی انجام نمی‌داد.

## ریشهٔ باگ

در تابع `sfDrawerHtml` (خط ۱۱۸۶)، پارامتر `onClick` مربوط به اکشن `unofficial-invoice`
به‌صورت یک رشتهٔ ثابت نوشته شده بود به‌جای concatenation:

```js
// اشتباه — متن ‎+ ptfOnClickArg(r.cd) + ‎ داخل خودِ رشته قرار گرفته بود
'sfUnofficialInvoiceNew(\'" + ptfOnClickArg(r.cd) + "\')'
```

خروجی HTML نهایی این بود:

```html
<button onclick="sfUnofficialInvoiceNew('" + ptfOnClickArg(r.cd) + "')">
```

مرورگر مقدار ویژگی `onclick` را تا اولین `"` می‌خواند، بنابراین مقدار واقعی فقط
`sfUnofficialInvoiceNew('` می‌شد و بقیهٔ رشته به‌صورت صفات خراب HTML درمی‌آمد.
نتیجه: هنگام کلیک `SyntaxError` رخ می‌داد و دکمه بی‌اثر بود.

## اصلاح

رشته‌سازی `onclick` با سایر دکمه‌های همان بخش هم‌راستا شد:

```js
// درست
'sfUnofficialInvoiceNew(\'' + ptfOnClickArg(r.cd) + '\')'
```

## وضعیت مرج

- کامیت اصلاح: `de0803f` (`fix: repair unofficial-invoice button onclick string in sales files drawer`)
- این اصلاح ابتدا مستقیم در `main` مرج شد (کامیت `31555fa`).
- به‌درخواست کارفرما، این یادداشت به‌عنوان کامیت جدید روی برنچ افزوده شد تا یک
  Pull Request واقعی قابل ثبت باشد.
