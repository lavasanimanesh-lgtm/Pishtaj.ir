# ARENA — RCA و طرح اصلاح: دکمهٔ «→CO / ساخت پیشنهاد مالی» پیشنهاد فنی را نابود می‌کند

- تاریخ: ۲۰۲۶-۱۰-۰۶
- شاخه: `arena/10801a70-pishtaj-ir` (پایه: `aa15dd6`)
- وضعیت: **اعمال شد (v34.39.51)** — فازهای ۱ تا ۵ اجرا شدند؛ فاز ۶ (بازیابی داده‌های از دست رفته) با تایید
  کارفرما و روی دادهٔ production انجام می‌شود. تستر: `_tools/uat/tester691-v34.39.51-toCo-keeps-technical-offer.js`
  (۳۴ PASS / ۰ FAIL) و گیت CI: ۳۰۴ تستر سبز.
- شناسهٔ باگ: `BUG-OFF-TOCO-CLONE-IDENTITY`

---

## ۱) خلاصهٔ اجرایی — گزارش کارفرما تایید است

گزارش: «در قسمت پیشنهادهای فنی، جلوی هر پیشنهاد کلید ساخت پیشنهاد مالی هست. باید فقط مقادیر و شمارهٔ
پیشنهاد فنی به فرم پیشنهاد مالی اضافه شود، ولی عملاً پیشنهاد فنی به‌طور کامل حذف می‌شود.»

**نتیجهٔ راستی‌آزمایی: درست است و ریشهٔ آن پیدا شد.** دکمهٔ `💸` (و حالت گزینهٔ جایگزین `⑂`) در
`crm/offers.js:778-780` تابع `offerToCo()` را صدا می‌زند. این تابع کل رکورد پیشنهاد فنی را **deep-clone**
می‌کند و در حالی که `no` و `kind` را عوض می‌کند، **شناسهٔ سروری رکورد (`_id`) را پاک نمی‌کند**. در نتیجه
فرمان `register_offer` روی سرور، سند جدید CO را «همان رکورد قبلی» تشخیص می‌دهد و رکورد پیشنهاد فنی را
**در جای خود بازنویسی (overwrite)** می‌کند. پیشنهاد فنی از مجموعهٔ `ptf_crm_offers` ناپدید می‌شود و چون
پاسخ سرور `ok:true` است، کاربر هیچ خطایی نمی‌بیند.

نکتهٔ مهم: این یک حذف «نرم» نیست؛ رکورد TO در `ptf_crm_deleted_archive` (سطل بازیافت) هم ثبت نمی‌شود،
چون مسیر حذف اصلاً اجرا نشده — رکورد با یک سند دیگر **جایگزین** شده است.

---

## ۲) زنجیرهٔ علت (با ارجاع دقیق)

| # | مرحله | محل | چه اتفاقی می‌افتد |
|---|-------|-----|-------------------|
| ۱ | کاربر روی `💸` کلیک می‌کند | `crm/offers.js:778-780` | `onclick="offerToCo('PTF-TO-…')"` |
| ۲ | کلون کامل رکورد TO | `crm/offers.js:1189` | `ptfSetOffState(JSON.parse(JSON.stringify(o)))` — **`_id` هم کپی می‌شود** |
| ۳ | بازنشانی هویت «ورود به فرم» | `crm/offers.js:1195-1203` | `editMode='new'`، حذف `_baseNo/_origNo/baseNo`، `no=offerSerial('CO')`، `kind='CO'`، `srcToNo=no` — **اما `delete _offState._id` وجود ندارد** (اصلاح v34.38.1 فقط `editMode/_baseNo` را پوشش داد) |
| ۴ | ساخت payload فرمان | `crm/sales-domain-v2.js:1222,1226` | `payloadOffer = clone(saved)` → `_id` موروثی داخل payload می‌رود؛ `createIntent: ret.idx<0` = `true` |
| ۵ | تشخیص هدف روی سرور | `api/sales-domain.php:1900` | `$idIndex` با `_id` پیدا می‌شود = ایندکس رکورد **TO**؛ `$noIndexes` خالی است (شمارهٔ CO تازه است) |
| ۶ | گاردها رد نمی‌کنند | `api/sales-domain.php:1907-1909` | گارد `createIntent` فقط وقتی `_id` **خالی** باشد فعال است (`$incomingId===''`)؛ گارد `won_offer_locked` هم چون `st` پیشنهاد فنی `won` نیست فعال نمی‌شود |
| ۷ | بازنویسی رکورد TO | `api/sales-domain.php:1909-1911` | `$target = $idIndex` → `if($target>=0) $offers[$target]=$incoming;` → **TO با CO جایگزین می‌شود** |
| ۸ | لینک TO→CO هم نمی‌نشیند | `api/sales-domain.php:1913` و `crm/offers.js:3374-3375` | چون دیگر رکوردی با `no === srcToNo` وجود ندارد، `coNo` روی TO ست نمی‌شود |
| ۹ | پاک شدن از کلاینت | `crm/sales-domain-v2.js:33-44` (`applyProjection`) | مجموعهٔ projection‌شدهٔ سرور (بدون TO) بلافاصله روی localStorage/آینه نوشته می‌شود → ردیف TO از فهرست غیب می‌شود |
| ۱۰ | بدون هیچ خطایی | `crm/sales-domain-v2.js:1247-1256` | `ok:true` + toast «پیشنهاد … در یک تراکنش سرور تأیید شد»؛ فیلد `created:false` در رسید سرور توسط کلاینت بررسی نمی‌شود |

---

## ۳) اثبات اجرایی (بازتولید با کد واقعی، نه بازنویسی منطق)

اسکریپت بازتولید: `/home/user/verify/repro-toco.js` (خارج از ریپو، تا کد پروژه دست‌نخورده بماند).
روش کار:

- **بخش کلاینت:** تابع واقعی `offerToCo` (به‌همراه `offerSerial` و `ptfSetOffState`) با regex از
  `crm/offers.js` استخراج و در Node اجرا می‌شود.
- **بخش سرور:** فایل واقعی `api/sales-domain.php` با `php-wasm` اجرا می‌شود (`action=register_offer`)،
  با auth/HMAC/storage مصنوعی — دقیقاً همان الگوی `_tools/uat/e2e-rfq-telegram-v34.39.43.js`.
  (باینری `php` در این محیط نصب نیست و `apt` هم بسته است؛ به همین دلیل از همان وابستگی اختیاری
  `php-wasm` که خود ریپو معرفی کرده استفاده شد.)

خروجی واقعی اجرا:

```
=== کلاینت واقعی: offerToCo() از crm/offers.js ===
state.no      = PTF-CO-1405-007
state.kind    = CO
state.srcToNo = PTF-TO-1405-003
state.editMode= new
state._id     = OFR-aaaa1111   <-- شناسهٔ سروری رکورد
TO._id        = OFR-aaaa1111
PASS  مقادیر TO به فرم CO منتقل شد (اقلام/کارفرما/درخواست)
PASS  شمارهٔ پیشنهاد فنی به‌عنوان srcToNo روی فرم CO نشست
PASS  هویت ویرایش پاک شد (editMode=new، بدون _baseNo)
PASS  _id سروریِ پیشنهاد فنی روی سند جدید CO باقی مانده است
PASS  تاریخچهٔ نگارش/ویرایش TO روی سند جدید CO کپی شده (آلودگی)
PASS  lineId اقلام TO عیناً روی اقلام CO کپی شده

=== سرور واقعی: register_offer با payload کلاینت ===
پاسخ سرور: {"ok":true,"rev":1,"result":{"offerId":"OFR-aaaa1111","offerNo":"PTF-CO-1405-007","created":false,…}}
ptf_crm_offers پس از فرمان (1 رکورد):
   - no=PTF-CO-1405-007  kind=CO  _id=OFR-aaaa1111  srcToNo=PTF-TO-1405-003  coNo=-
PASS  فرمان سرور موفق بود (ok=true)
PASS  پیشنهاد مالی CO ثبت شد
FAIL  پیشنهاد فنی TO هنوز وجود دارد (انتظار کارفرما) — رکوردها: ["PTF-CO-1405-007/CO"]
FAIL  لینک coNo روی TO نشست
رکورد ذخیره‌شده روی سرور — revisionHistory=[{"rev":0,…}]  editHistory=[{…}]  lineId=OL-PTF-TO-1405-003-abc

=== کنترل: همان فرمان بدون _id موروثی (رفتار مورد انتظار پس از اصلاح) ===
پاسخ سرور: {"ok":true,…,"result":{"offerId":"OFR-44679db5-…","offerNo":"PTF-CO-1405-007","created":true,…}}
   - no=PTF-CO-1405-007  kind=CO  _id=OFR-44679db5-…  coNo=-
   - no=PTF-TO-1405-003  kind=TO  _id=OFR-aaaa1111  coNo=PTF-CO-1405-007
PASS  بدون _id موروثی: هم TO می‌ماند و هم CO ساخته می‌شود

=== نتیجه: 12 PASS / 2 FAIL ===
```

دو `FAIL` دقیقاً همان دو خواستهٔ کارفرما هستند که امروز نقض می‌شوند. آزمون «کنترل» هم نشان می‌دهد
تنها تفاوت، presence/absence همان `_id` موروثی است — پس ریشه قطعی است.

---

## ۴) دامنهٔ اثر

**معیوب (همین باگ):**
- `offerToCo()` — هر دو دکمهٔ ردیف پیشنهاد فنی: `💸` (تبدیل اول) و `⑂` (پیشنهاد جایگزین)، `crm/offers.js:778-780`.
- هر مسیری که در آینده رکورد موجود را کلون کند و `_id` را پاک نکند.

**سالم (بررسی شد، `_id` موروثی ندارند):**
- `offerNew()` / `offerFromRfq()` (`crm/bridge.js:2296`) — از state تازه ساخته می‌شود.
- ساخت TO از اقلام استعلام (`crm/storage.js:1538`) — آبجکت تازه.
- تبدیل ریالی/ارزی (`crm/offer-rial-convert.js:406+`، `crm/offer-fx-convert.js`) — آبجکت فیلد‌به‌فیلد
  ساخته می‌شود و `lineId` هم عامدانه پاک می‌شود (`offer-rial-convert.js:328,396`).
- `offerEdit()` (`offers.js:1165`) و «نگارش جدید» (`offers.js:861`) — کلون با `_id` **عامدانه و درست** است،
  چون همان سند با همان شماره ذخیره می‌شود.

**اثرهای جانبی همان یک خط (همه راستی‌آزمایی شدند):**
1. `coNo` روی TO هرگز ست نمی‌شود → قفل «یک‌بار تبدیل» (US-142 AC5) و منطق گزینهٔ جایگزین (US-OFF-ALT) و
   بررسی وابستگی در `crm/guards.js:60-61` بی‌اثر می‌شوند.
2. `revisionHistory` و `editHistory` پیشنهاد فنی روی سند تازهٔ CO می‌نشیند → تاریخچهٔ جعلی روی سند جدید.
3. `lineId` اقلام عیناً کپی می‌شود؛ `offEnsureOfferLineIds` (`offers.js:1866-1881`) فقط `lineId` خالی/تکراری
   *داخل همان سند* را می‌سازد → دو سند با `lineId` یکسان (در تضاد با الگوی `offer-rial-convert.js:396`).
4. در حافظهٔ محلی، بین `unshift` و رسیدن پاسخ سرور، دو رکورد با `_id` یکسان وجود دارد.
5. خطا کاملاً خاموش است: `created:false` در رسید سرور توسط کلاینت چک نمی‌شود.

---

## ۵) طرح اجرایی اصلاح (پیشنهادی — هنوز اعمال نشده)

### فاز ۱ — درمان ریشه در کلاینت (`crm/offers.js` → `offerToCo`, بعد از خط ۱۱۸۹)

```js
  ptfSetOffState(JSON.parse(JSON.stringify(o)));
  /* BUG-OFF-TOCO-CLONE-IDENTITY: سند CO یک رکورد «جدید» است. هویت سروری و تاریخچهٔ
     سند مبدأ هرگز نباید به ارث برسد؛ وگرنه register_offer با همان _id رکورد TO را
     بازنویسی و پیشنهاد فنی را نابود می‌کند. */
  delete _offState._id;
  delete _offState.revisionHistory; delete _offState.editHistory;
  delete _offState.wonAtISO; delete _offState.wonBy; delete _offState.wonRevisionSnapshot;
  delete _offState.priorStatus; delete _offState.invRef; delete _offState.rialOf;
  delete _offState.fxOf; delete _offState.fxConvert; delete _offState.isAmendment;
  delete _offState.amendmentOf; delete _offState.amendmentOfOfferId;
```

و **بعد از** انتساب شمارهٔ جدید (`_offState.no = offerSerial('CO')`)، بازتولید `lineId` — همان ترتیبی که
`offer-rial-convert.js:333` رعایت کرده:

```js
  _offState.items = (_offState.items || []).map(function (it) {
    var c = JSON.parse(JSON.stringify(it || {})); delete c.lineId; return c;
  });
  try { offEnsureOfferLineIds(_offState.items, _offState.no); } catch (eL) {}
```

> ترجیح: این پاک‌سازی در یک هلپر مشترک مثل `ptfOfferCloneAsNew(o)` پیاده شود تا هر مسیر کلون‌ساز آینده
> مجبور به یادآوری فهرست فیلدها نباشد.

### فاز ۲ — گارد سمت کلاینت در `offerSave` (پوشش پیش‌نویس‌های مسمومِ دورهٔ قبل)

پیش‌نویس‌های ذخیره‌شده در Dev-KV از نسخهٔ قدیمی همچنان `_id` موروثی دارند؛ اصلاح `offerToCo` به‌تنهایی
آن‌ها را درمان نمی‌کند. قبل از `ptfOfferResolveSaveIdentity` در `offerSave` (`crm/offers.js:3315`):

```js
  if (o.editMode === 'new' && o._id) {
    var _idOwner = offers.filter(function (x) { return x && x._id === o._id; })[0];
    if (!_idOwner || _idOwner.no !== o.no) {
      try { audit('پیشنهادها', 'حذف _id موروثی از سند جدید ' + o.no + ' (BUG-OFF-TOCO-CLONE-IDENTITY)', o.no); } catch (eId) {}
      delete o._id; /* سند جدید شناسهٔ تازه از سرور می‌گیرد */
    }
  }
```

### فاز ۳ — گارد سرور؛ جلوگیری از تخریب خاموش توسط هر کلاینت قدیمی (`api/sales-domain.php`, کنار خط ۱۹۰۷)

```php
/* BUG-OFF-TOCO-CLONE-IDENTITY: createIntent یعنی «سند تازه». اگر همان _id به رکوردی
   با شمارهٔ دیگر تعلق دارد، این فرمان در حال بازنویسی یک سند مستقل است → رد قطعی. */
if ($createIntent && $idIndex >= 0 && !$crashRecovery && (string)($offers[$idIndex]['no'] ?? '') !== $no) {
    sd_out(['ok'=>false,'error'=>'create_intent_identity_mismatch','existingNo'=>(string)($offers[$idIndex]['no'] ?? '')], 409);
}
```

چرا رد کردن (نه «خوددرمانی»)؟
- با سبک گاردهای موجود هم‌خوان است (`offer_number_owned_by_another_record`, `won_offer_locked`).
- مسیر رد در کلاینت **امن** است: `restoreOfferSnapshots` وضعیت قبلی را برمی‌گرداند، متن فرم به‌عنوان
  پیش‌نویس در Dev-KV می‌ماند و پیام «⛔ سرور ثبت پیشنهاد را نپذیرفت…» نمایش داده می‌شود
  (`crm/sales-domain-v2.js:1259-1269`). یعنی هیچ داده‌ای از بین نمی‌رود.
- باندل‌های کش‌شدهٔ قدیمی روی مرورگر کاربران (سابقهٔ این ریپو: `ARENA-CRM-DESKTOP-STALE-BUNDLE-HTACCESS-CACHE-RCA`)
  دیگر نمی‌توانند پیشنهاد فنی را نابود کنند؛ فقط خطا می‌گیرند.

> جایگزین (اگر «بدون خطا برای کاربر» اولویت باشد): به‌جای رد، `_id` تازه تخصیص بده
> (`$incoming['_id']=sd_uuid('OFR'); $idIndex=-1;`) و یک رکورد در `ptf_crm_corrections` + `audit` بنویس تا
> خوددرمانی قابل ردیابی باشد. تصمیم این دو گزینه با کارفرماست؛ **پیش‌فرض پیشنهادی: رد قطعی**.

### فاز ۴ — خواستهٔ دوم کارفرما: «شمارهٔ پیشنهاد فنی» در فرم پیشنهاد مالی دیده شود

امروز `srcToNo` فقط یک فیلد داده‌ای است (`offers.js:1201,1686`) و هیچ‌جای فرم نمایش داده نمی‌شود.
پیشنهاد: یک فیلد فقط‌خوانی در فرم CO، مثلاً کنار انتخاب درخواست:

```
🔧 پیشنهاد فنی مبدأ: PTF-TO-1405-003   (فقط‌خوانی — از ردیف پیشنهاد فنی منتقل شده)
```

- رندر از `_offState.srcToNo` در `offerForm()`؛ در حالت «+ پیشنهاد مالی» بدون مبدأ، پنهان بماند.
- اختیاری: درج همان شماره در سربرگ خروجی چاپ/PDF پیشنهاد مالی، تا سند کاغذی هم زنجیرهٔ فنی→مالی را نشان دهد.

### فاز ۵ — آزمون رگرسیون (جلوگیری از بازگشت)

همان اسکریپت بازتولید، به‌صورت تستر رسمی داخل `_tools/uat/` (مثلاً
`tester4xx-vXX-toCo-keeps-technical-offer.js`) با چهار assert اصلی:
1. خروجی `offerToCo` هیچ `_id`/`revisionHistory`/`lineId` موروثی ندارد و `srcToNo` درست است.
2. `register_offer` با payload کلاینت → هر دو رکورد TO و CO وجود دارند و `coNo` روی TO نشسته.
3. `register_offer` با `_id` متعلق به رکوردی با شمارهٔ دیگر + `createIntent:true` → `409 create_intent_identity_mismatch` و مجموعه دست‌نخورده.
4. مسیر ویرایش/نگارش (همان `_id`، همان `no`) همچنان به‌درستی در جای خود به‌روزرسانی می‌شود (بدون رگرسیون).

> نکته: اجرای واقعی PHP نیازمند `php-wasm` است (`npm i php-wasm` خارج از ریپو)؛ در نبود آن، تستر باید
> مثل `run-ci-gate.js` «بهترین تلاش» باشد و صریحاً اعلام کند که بخش سرور اجرا نشد.

---

## ۶) بازیابی پیشنهادهای فنیِ از دست رفته

- **تشخیص رکوردهای آسیب‌دیده:** هر CO که `srcToNo` دارد ولی رکوردی با آن `no` در `ptf_crm_offers` نیست
  (و `rialOf/fxOf` ندارد) → همان TO است که بلعیده شده. یک گزارش read-only در
  «کیفیت داده» (`crm/data-quality.js`) می‌تواند فهرست + تاریخ را بدهد.
- **منبع بازیابی ۱ (دقیق):** بک‌آپ چرخشی ساعتی سرور (US-146 در `crm/backup.js`) — اگر نسخهٔ پیش از حادثه
  موجود باشد، رکورد TO عیناً برمی‌گردد.
- **منبع بازیابی ۲ (بازسازی):** محتوای TO داخل همان CO باقی مانده (`items/terms/extraCols/buyer*` کپی شده‌اند)،
  پس می‌توان TO را با `no = co.srcToNo` بازسازی کرد؛ `st` و `rev` تقریبی خواهند بود و باید صریحاً
  «بازسازی‌شده» علامت بخورند.
- هر دو مسیر باید پشت نقش `admin/chairman`، با پیش‌نمایش و `confirm` صریح، و با نوشتن در
  `ptf_crm_corrections` + `audit` اجرا شوند — نه خودکار.

---

## ۷) چه چیز راستی‌آزمایی **نشده** است

- رفتار روی مرورگر واقعی/دستگاه کاربر (اینجا فقط کد واقعی کلاینت در Node و کد واقعی PHP در `php-wasm`
  اجرا شد؛ UI، سرویس‌ورکر و کش باندل بررسی اجرایی نشد).
- اینکه چند رکورد واقعی تا امروز نابود شده‌اند — نیاز به دادهٔ production دارد (کوئری تشخیصی فاز ۶).
- `php -l` روی `api/sales-domain.php` در این محیط اجرا نشد (باینری php و دسترسی apt موجود نیست). هر تغییری
  در آن فایل باید با گیت `run-ci-gate.js` روی محیطی که php یا `php-parser` دارد بررسی شود.

---

## ۸) ترتیب پیشنهادی استقرار

1. فاز ۳ (گارد سرور) — اول، چون جلوی تخریب بیشتر توسط باندل‌های قدیمی را می‌گیرد و بازگشت‌پذیر است.
2. فاز ۱ + ۲ (کلاینت) — درمان ریشه + پوشش پیش‌نویس‌های مسموم.
3. فاز ۴ (نمایش شمارهٔ TO) — خواستهٔ کارفرما.
4. فاز ۵ (تستر) و سپس فاز ۶ (بازیابی داده) با تایید کارفرما.

---

## ۹) وضعیت تست‌های موجود قبل از هر تغییر (baseline اجراشده)

| تستر | نتیجه |
|------|-------|
| `_tools/uat/tester442-v34.7.39-offer-ack-workflow.js` | PASS (کامل) |
| `_tools/uat/tester196-parallel-offers.js` | 14 PASS / 0 FAIL |
| `_tools/uat/tester74-v154.js` | 31 PASS / 0 FAIL |
| `_tools/uat/tester7-sprint70.js` | 62 PASS / **1 FAIL** — «UI: دکمه فاکتور برای غیربرنده قفل» (شکست از قبل موجود و بی‌ربط به این باگ) |

نکته برای فاز ۳: تستر `tester442` فقط *وجود* خط گارد فعلی را با regex غیرلنگر بررسی می‌کند، بنابراین افزودن
گارد جدید آن را قرمز نمی‌کند؛ ولی پیشنهاد می‌شود assert مربوط به `create_intent_identity_mismatch` هم به همان
تستر (یا تستر تازهٔ فاز ۵) اضافه شود.

**هیچ فایل کدی در این مرحله تغییر نکرده است** — `git status` فقط همین سند را به‌عنوان فایل جدید نشان می‌دهد.

---

## ۱۰) آنچه عملاً اعمال شد (v34.39.51)

| فاز | فایل | تغییر |
|-----|------|-------|
| ۱ | `crm/offers.js` → `offerToCo` | پاک‌سازی `_id`، `revisionHistory/editHistory`، `wonAtISO/wonBy/wonRevisionSnapshot`، `priorStatus/invRef/rialOf/fxOf/fxConvert`، فیلدهای متمم، مهرهای سروری + بازتولید `lineId` با شمارهٔ سند جدید |
| ۲ | `crm/offers.js` → `offerSave` | گارد «`_id` موروثی سند جدید» پیش از `ptfOfferResolveSaveIdentity` (پوشش پیش‌نویس‌های مسموم Dev-KV) + audit |
| ۳ | `api/sales-domain.php` → `register_offer` | گارد `409 create_intent_identity_mismatch` وقتی `createIntent` با `_id` متعلق به شمارهٔ دیگر برسد |
| ۴ | `crm/offers.js` → `offerForm` | ردیف فقط‌خوانی «🔧 پیشنهاد فنی مبدأ» + هشدار وقتی رکورد مبدأ در فهرست نیست |
| ۵ | `_tools/uat/tester691-v34.39.51-toCo-keeps-technical-offer.js` | تستر سه‌لایه با کد واقعی (کلاینت + `offerSave` + سرور واقعی روی `php-wasm`)؛ ثبت در `run-ci-gate.js` |
| — | نسخه | `VERSION.json`, `crm/index.html`, `crm/sw.js`, `crm/manifest.json`, `crm/shell.js`, `crm/cms.js`, `crm/clear-cache.html`, `crm/device-reconnect.html`, `SD_SERVICE_VERSION` در `api/sales-domain.php` → `34.39.51` + `bump-version-pins.js 34.39.50` |

**راستی‌آزمایی اجرایی پس از اصلاح:**
- `tester691`: ۳۴ PASS / ۰ FAIL — خروجی واقعی `offerToCo` روی سرور واقعی: `created:true` با `_id` تازه،
  `ptf_crm_offers` = ۲ رکورد (TO + CO) و `coNo` روی TO نشسته؛ گارد جدید: `409` و مجموعه دست‌نخورده؛
  رگرسیون ویرایش (همان `_id`/همان شماره): به‌روزرسانی در جای خود.
- `node _tools/uat/run-ci-gate.js`: **۳۰۴ PASS / ۰ FAIL** (پیش از تغییر: ۳۰۳ PASS / ۰ FAIL روی `aa15dd6`
  در worktree جدا اجرا و مقایسه شد — تنها تفاوت، تستر تازه است).
- سینتکس PHP: `php-parser` روی همهٔ `api/*.php` بدون خطا (باینری `php` در این محیط در دسترس نبود).
