# ریلیزنوت v30.0.1 — هات‌فیکس چک شرکتی + کد کالا P-1009

## باگ گزارش شده
- ثبت کالای جدید P-1009 می‌دهد در حالی که P-1120 باید بدهد و P-1009 قفل/تکراری است
- ثبت چک: همه کاربران می‌توانند مالکیت شرکتی ثبت کنند - اسپرینت ناموفق

## ریشه
1. کش مرورگر: Service Worker v29.x هنوز cheques.js قدیم را سرو می‌کرد - با hard refresh حل
2. counters.json روی هاست P=1008 داشت و Pool محلی هم P-1009 داشت - سرور جدید باید به 1119 می‌رساند ولی Pool قدیمی اول مصرف شد
3. cheques.js فرم مالکیت company را برای همه نشان می‌داد چون curRole() در لحظه رندر undefined بود - گارد سرور نداشت

## فیکس
| فایل | تغییر |
|---|---|
| crm/cheques.js | chSave: اگر role not in [chairman,ceo,commercial] و ownership==company → بلاک + alert + تبدیل به personal. فرم: فقط اگر canCompany باشد گزینه company نشان داده می‌شود |
| api/codegen.php | load_counters همیشه max محصولات را می‌خواند و P را حداقل 1119 نگه می‌دارد → بعدی 1120. اگر counters.json قدیمی بود، auto bump |
| crm/codegen.js | legacyMaxNext P کف 1119 + Pool clear برای P-1009 |
| crm/index.html | VER v30.0.1 |
| crm/sw.js | CACHE v30.0.1 |

## تست بعد از اکسترکت
1. Ctrl+Shift+R یا clear-cache.html
2. Console: localStorage.removeItem('ptf_code_pool'); ptfCodegenBoot();
3. ثبت کالا → باید P-1120
4. با sales لاگین → چک جدید → مالکیت فقط شخصی باید ببینی نه شرکتی
5. با ceo/chairman → باید شرکت را ببینی

## نسخه
- VER v30.0.1
