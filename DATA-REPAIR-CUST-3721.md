# 🔧 جداسازی دستی رکورد آلودهٔ CUST-3721 — نسخهٔ ۲۰۲۶-۰۸-۳۱

> زمینه: باگ ۱ پروداکشن (برخورد کد CUST). مشتریِ جدید که از فرم ثبت شد، مولد کد محلی
> (pool خالی ⇒ legacyMaxNext) کدی تولید کرد که با **CUST-3721** موجود برخورد کرد و
> سرور `entity_upsert` رکورد موجود را با payload جدید **آپدیت** کرد: اسکلت رکورد
> (کد، سازنده، تاریخ ایجاد، جایگاه) مالِ مشتری قدیمی است؛ فیلدهای محتوایی
> (نام شرکت/coEn/صنعت/رابط/تلفن) مالِ مشتری جدید.
> ریشه در v34.9.2 بسته شد (گارد کلاینت + `expectCreate` سروری ⇒ 409). این سند فقط
> **بازیابی داده** است.

## ⚠️ دو واقعیت مهم پیش از شروع

1. فرم مشتری در CRM **فقط «ثبت جدید»** دارد — بدون ویرایش/حذف. جداسازی از
   **کنسول مرورگر** (با فرمان‌های entity رسمی، نه نوشتن خام) انجام می‌شود.
2. تشخیصِ اینکه کدام ارجاعات مالِ مشتری قدیمی‌اند و کدام مالِ جدید، **دادهمحور**
   تعیین می‌شود: مرز = تاریخ حادثه. ارجاعاتِ قبل از حادثه ⇒ قدیمی؛ بعد ⇒ جدید.

## تصمیم‌درخت (پس از فاز ۱ مشخص می‌شود)

| یافتهٔ اسکریپت تشخیصی | اقدام |
|---|---|
| ارجاعی به CUST-3721 نیست (یا فقط قدیمی) | مشتری قدیمی «خفته» بوده — ساده‌ترین حالت: رکورد عملاً مالِ مشتری جدید است؛ فقط سازنده/تاریخ قدیمی می‌ماند. اگر مهم نیست، بدون جراحی ببندید؛ وگرنه فاز ۲ حالتِ سبک |
| ارجاع قدیمی + فعالیتی بعد از حادثه هست | جداسازی کامل (فاز ۲ استاندارد) — رایج‌ترین حالت |
| همهٔ ارجاعات قدیمی‌اند و مشتری جدید هیچ فعالیتی ندارد | فقط فیلدهای رکورد به نام مشتری قدیمی برگردد + مشتری جدید جداگانه ثبت شود |

## فاز ۰ — پیش‌نیاز (توصیهٔ قوی)

- **ابتدا v34.9.2 را دیپلوی کنید.** ثبت مشتری جدیدِ این جداسازی باید ضدبرخورد باشد
  (گارد کلاینت + reject سروری). تشخیصِ فاز ۱ روی v34.9.1 هم بی‌خطر قابل اجراست.
- از **جعبهٔ بک‌آپ و بازگردانی** (تنظیمات) یک بک‌آپ تازه بگیرید و فایلش را نگه دارید.
- فقط یک ادمین لاگین باشد؛ در ساعات کم‌کار.

## فاز ۱ — اسکریپت تشخیصی (فقط خواندنی، صفر ریسک)

در صفحهٔ CRM لاگین‌شده، F12 ⇒ Console، این را کامل paste و Enter بزنید:

```js
(function(){
  var CD='CUST-3721';
  function g(k){try{return getData(k)}catch(e){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e2){return []}}}
  function scan(coll,flds){try{var a=g(coll);return {total:a.length,hits:a.filter(function(r){return r&&flds.some(function(f){return r[f]===CD})}).map(function(r){var o={};['cd','no','inqNo','t','T','dateFa','dt','buyerCo','co','payerName','status','st','dueISO','wfUpdatedAtISO','createdAtISO'].forEach(function(k){if(r[k]!==undefined)o[k]=r[k]});return o})}}catch(e){return {err:String(e)}}}
  var custs=g('ptf_crm_customers');
  var rec=custs.filter(function(c){return c&&c.cd===CD})[0]||null;
  var mx=0;custs.forEach(function(c){var m=/^CUST-(\d+)$/.exec(String(c&&c.cd||''));if(m)mx=Math.max(mx,+m[1])});
  var out={runAt:new Date().toISOString(),target:CD,record:rec,suggestNewCode:'CUST-'+(mx+50)+' (max فعلی: '+mx+')',
    refs:{offers:scan('ptf_crm_offers',['buyerCd']),invoices:scan('ptf_crm_invoices',['buyerCd','sourceCustomerCd']),
    receipts:scan('ptf_crm_case_receipts',['sourceCustomerCd']),deals:scan('ptf_crm_deals',['buyerCd','custCd']),
    rfqs:scan('ptf_crm_rfqs',['custCd'])}};
  var s=JSON.stringify(out,null,1);
  try{copy(s);console.log('✅ خروجی در کلیپ‌بورد کپی شد — برای ایجنت paste کنید ('+s.length+' بایت)')}catch(e){window.__ptf3721=out;console.log(s)}
})()
```

خروجی را کامل برای ایجنت بفرستید. از آن استخراج می‌شود:
- **نام اصلی مشتری قدیمی**: از `buyerCo`/`co` در ارجاعاتِ قبل از حادثه (snapshot نام‌های غیرنرمال روی رکوردهای پیوندی).
- **مرز زمانی حادثه**: مقایسهٔ تاریخ ارجاعات + `wfUpdatedAtISO` خود رکورد.
- **کد امن** برای مشتری جدید (max+50 — دور از بازهٔ برخورد).

## فاز ۲ — جراحی (ایجنت پس از دیدن خروجی، اسکریپت اختصاصیِ آماده می‌دهد)

ساختار کلی (همه از مسیر فرمان رسمی `ptfEntitySaveCollection`، هرگز `setData` خام):

1. **بازیابی CUST-3721**: فیلدهای محتوایی (`co`, `coEn`, `ind`, `con`, `ph`) به
   مقادیر مشتری قدیمی برمی‌گردد (از شواهد فاز ۱ + تأیید شما). کد/سازنده/تاریخ دست نمی‌خورد.
2. **ایجاد رکورد مشتری جدید** با مقادیر فعلیِ روی رکورد (که مالِ جدید است) و
   `cd` امن پیشنهادی — از طریق فرمان entity با `expectCreate`.
3. **بازپیوند ارجاعاتِ بعد از حادثه**: رکوردهای `offers`/`rfqs`/`deals`/
   `invoices`/`receipts` که در بازهٔ بعد از حادثه به CUST-3721 وصل شده‌اند،
   فیلد کدشان به کد جدید تغییر می‌کند (نام‌های snapshot هم بازنویسی می‌شود).

## فاز ۳ — راستی‌آزمایی

- اجرای دوبارهٔ اسکریپت فاز ۱: رکورد دو کد باید هرکدام فقط ارجاعات خودشان را نشان دهند.
- جستجوی هر دو کد در: مشتریان، پیشنهادات (فیلتر مشتری)، فاکتورها (`invSrch`)، مطالبات.
- ماندهٔ حساب مشتری در «مطالبات» برای هر دو جدا و درست باشد (از receipts/invoices محاسبه می‌شود).
- یک بار خروج/ورود و sync سبز.


---

# 📋 نتایج فاز ۱ (اجرا: ۲۰۲۶-۰۸-۳۱ ~۲۱:۵۵ تهران) — تحلیل به‌روز

## یافته‌های کلیدی

1. **آلودگی مالی: صفر.** هیچ offer/invoice/receipt/deal به CUST-3721 ارجاع ندارد (۰ از ۹۱/۵/۸/۸). مطالبات و خزانه پاک‌اند. دامنهٔ حادثه = خود رکورد مشتری + یک RFQ.
2. **محتوای فعلی رکورد ۱۰۰٪ «پاسارگاد انرژی پاس» است**: co/coEn/افراد/تماس‌ها همه مال مشتری جدید (ثبت karimi امروز ۱۴۰۵/۶/۹ ۱۸:۳۱ ≈ 15:01 UTC — crAt و createdAt دقیقاً هم‌خوان‌اند).
3. **RFQ-101550 (امروز، snapshot نام = پاسارگاد) به CUST-3721 وصل است** — یعنی فعلاً به‌درستی مال مشتری جدید است و در جراحی نباید جابه‌جا شود.
4. **سیگنال مخلوط‌بودن**: `owner: ghadimi` ولی `createdBy: karimi`. دو توضیح ممکن:
   - **باقی‌مانده از رکورد قدیمی**: سرور در upsert فیلدهای payload را می‌نویسد و بقیه را از قبلی حفظ می‌کند؛ طبق کد `saveCust2` در ایجادِ جدید owner باید خودِ سازنده می‌شد — پس owner=غیرسازنده یا انتخاب عمدی بوده (فیلد ارشد) یا بازماندهٔ رکورد قبلی.
   - **نکتهٔ ظریف سرور**: در upsert سرور `createdAt`/`createdBy` **قبلی را حفظ می‌کند**؛ رکورد فعلی createdAt=امروز دارد ⇒ یا رکورد قبلی اصلاً createdAt نداشته (رکورد قدیمیِ پیش از این قرارداد)، یا برخوردی نبوده و رکورد تازه است.

## سه سناریوی باقی‌مانده

| سناریو | شاهد قطعی‌کننده | اقدام |
|---|---|---|
| **الف — برخورد واقعی**: CUST-3721 قبلاً مشتری دیگری (احتمالاً مال ghadimi) بود و نامش با پاسارگاد بازنویسی شد | نام قبلی در حافظه/بک‌آپ/دستگاه ghadimi | جراحی سبک (پایین) |
| **ب — ثبت تکراری**: مشتری پاسارگاد قبلاً بود و karimi دوباره ثبتش کرد | رکورد دیگری با نام پاسارگاد در لیست (اسکریپت ۲) | ادغام/حذف dup — بدون بازگردانی |
| **ج — ثبت تمیز بدون برخورد** | نبودِ هر دو شاهد بالا + owner با انتخاب عمدی karimi | هیچ جراحی لازم نیست — فقط بستن پرونده |

## چرا «جراحی سبک» (به‌جای بازگردانی روی همین کد)

چون مشتری قدیمی (در سناریوی الف) **هیچ ارجاعی ندارد**، جابه‌جاکردن ارجاعات لازم نیست:
1. CUST-3721 همان بماند (محتوای پاسارگاد + RFQ وصل به او — هر دو درست‌اند)؛ فقط `owner` با واقعیت هم‌راستا شود.
2. برای مشتری قدیمی رکورد تازه با کد امن (مثلاً CUST-3801) ساخته شود: نام اصلی + owner=ghadimi + یادداشت بازیابی. جزئیات تماس قدیمی از بک‌آپ/حافظهٔ ghadimi تکمیل می‌شود.

## اسکریپت ۲ — تشخیص نهایی (فقط خواندنی)

```js
(function(){
  function g(k){try{return getData(k)}catch(e){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e2){return []}}}
  var custs=g('ptf_crm_customers');
  var pas=custs.filter(function(c){return c&&/پاسارگاد/.test((c.co||'')+' '+(c.coEn||''))}).map(function(c){return {cd:c.cd,co:c.co,coEn:c.coEn||'',owner:c.owner||'',by:c.createdBy||c.crBy||'',at:c.createdAt||c.crAt||''}});
  var ghad=custs.filter(function(c){return c&&c.owner==='ghadimi'}).map(function(c){return {cd:c.cd,co:c.co,by:c.createdBy||c.crBy||'',at:c.createdAt||c.crAt||''}}).slice(0,30);
  var sus=custs.filter(function(c){return c&&c.owner&&c.createdBy&&c.owner!==c.createdBy&&String(c.createdAt||'')>='2026-08-24'}).map(function(c){return {cd:c.cd,co:c.co,owner:c.owner,by:c.createdBy,at:c.createdAt}});
  var rfq=(g('ptf_crm_rfqs').filter(function(r){return r&&r.cd==='RFQ-101550'})[0])||null;
  var rq={};if(rfq)['cd','inqNo','co','custCd','st','dt','crBy','createdBy','wfUpdatedAtISO'].forEach(function(k){if(rfq[k]!==undefined)rq[k]=rfq[k]});
  var ev={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('ptf_crm_')===0){var n=(localStorage.getItem(k)||'').split('CUST-3721').length-1;if(n)ev[k]=n;}}
  var out={count:custs.length,pasargad:pas,ghadimiOwned:ghad,suspiciousRecent:sus,rfq101550:rq,everywhere:ev};
  var s=JSON.stringify(out,null,1);try{copy(s);console.log('✅ کپی شد ('+s.length+' بایت)')}catch(e){console.log(s)}
})()
```

خروجی این اسکریپت پاسخ می‌دهد: (۱) رکورد تکراری پاسارگاد هست؟ (۲) کدام مشتریان مال ghadimi‌اند و کد 3721 در توالی تاریخشان جا می‌خورد؟ (۳) رکوردهای مشکوکِ دیگر (owner≠سازنده در ۷ روز اخیر)؛ (۴) RFQ-101550 را چه کسی ساخت؟ (۵) CUST-3721 در کدام کلیدهای دیگر هست؟

**سرنخ قوی دیگر**: اگر به مرورگر **ghadimi** (یا دستگاهی که از دیروز باز نشده) دسترسی دارید، همین اسکریپت ۲ را آنجا اجرا کنید — اگر دستگاهش هنوز sync نشده، رکورد قدیمی CUST-3721 با نام اصلی ممکن است همان‌جا باشد.
