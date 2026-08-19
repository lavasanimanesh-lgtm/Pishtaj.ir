# گزارش برای ایجنت مستقل — رویژن پیشنهاد برنده از پرونده فروش

**مخاطب:** ایجنت/مرورگر مستقل که این نشست را ندیده است.  
**وظیفهٔ شما:** هر ادعا را با خواندن فایل‌های ذکرشده تأیید یا رد کنید. کد محصول را عوض نکنید مگر کارفرما جدا دستور دهد.  
**تاریخ گزارش:** ۱۴۰۵/۰۵/۲۷ (۲۰۲۶-۰۸-۱۸)  
**شاخه نشست Arena:** `arena/01a01190-pishtaj-ir`  
**نسخه محصول مبنای ادعاها:** v34.7.33 (`SD_SERVICE_VERSION` در `api/sales-domain.php`)  
**وضعیت کد در این موضوع:** **هیچ پچی برای این قابلیت زده نشده.** فقط ارزیابی.

اسناد هم‌خانواده در ریشهٔ مخزن (ادعاهای تفصیلی، نه منبع حقیقت):

- `ASSESSMENT-CASE-REVISION-DOCS-UX-2026-08-18.md`
- `ASSESSMENT-AWARD-OFFER-REVISION-FINANCE-2026-08-18.md`
- `PEER-REVIEW-AWARD-REVISION-ASSESSMENT-2026-08-18.md`
- `ASSESSMENT-FULL-SURFACE-WON-OFFER-REVISION-2026-08-18.md`

منبع حقیقت = فایل‌های `crm/` و `api/sales-domain.php` در همین commit.

---

## ۱. درخواست کارفرما (متن قراردادی)

1. پس از برد (حتی پس از صدور فاکتور) بتوان **داخل همان پرونده فروش** سند برد را رویژن کرد **مانند فرم پیشنهاد** (افزودن/حذف قلم، تغییر قیمت، یا بستن/لغو).
2. پس از رویژن، **قیمت/اقلام پیشنهاد برندهٔ زنده = رویژن پرونده**.
3. **فاکتورهای قبلی با تأیید کاربر ابطال** شوند.
4. **اثرات مالی با پیشنهاد جدید هماهنگ** شوند.
5. مدارک پرونده (پکینگ، نوت بازرسی و غیره) قابل حذف باشند.
6. علت «یک پیشنهاد برنده با دو سند برد که یکی مال پروندهٔ دیگر است» بررسی شود.
7. UX کشوی پرونده سبک‌تر شود.

کارفرما بعداً بند ۱–۴ را اصل کرد؛ docsx/UX در اولویت بعدی است.

**تصمیم محصول قبلی که این درخواست آن را مشروط می‌کند:** ۱۴۰۵/۰۵/۲۶ — اگر فاکتور رسمی فعال باشد کاهش مبلغ سند برد مسدود است (`official_invoice_blocks_decrease`). تستر: `_tools/uat/tester434-v34.7.31-award-revision.js`.

---

## ۲. ادعاهای قابل راستی‌آزمایی (وضعیت فعلی کد)

هر ردیف را باز کنید. اگر خلاف دیدید در گزارش خودتان «رد» بزنید با نقل قول.

### ۲.۱ دو مدل رویژن ناسازگار

| ID | ادعا | محل |
|---|---|---|
| C1 | رویژن تب پیشنهاد شماره را عوض نمی‌کند؛ `rev++` و `revisionHistory` | `crm/offers.js` `offerReviseClone`, `offerSave` (`editMode==='revision'`, حدود ۶۱۵ و ۲۵۲۳) |
| C2 | پس از برد، همان دکمه به پرونده حواله می‌شود و ذخیره قفل است | `offerPostAwardLocked`, پیام‌های `offerReviseClone` / `offerEdit` / `offerSave` |
| C3 | قفل با `d.inqNo === o.inqNo` هر پیشنهاد همان استعلام را هم قفل می‌کند | بدنهٔ `offerPostAwardLocked` |
| C4 | بازنگری پرونده جدول فقیر است: بدون افزودن ردیف؛ حداقل یک قلم | `crm/case-revision.js` `ptfAwardReviseOpen` / `ptfAwardReviseSubmit` |
| C5 | سرور سند **جدید** `parentNo + '-R' + seq` می‌سازد؛ والد `superseded` | `api/sales-domain.php` action `revise_award` (~۸۴۵–۹۵۰) |
| C6 | پرونده `wonOffer` را به شمارهٔ جدید می‌چسباند | همان؛ `$case['wonOffer'] = $newNo` |
| C7 | اگر فاکتور رسمی فعال باشد و `newTotal < oldTotal` → ۴۰۹ `official_invoice_blocks_decrease` | همان ~۸۹۰–۹۰۰ |
| C8 | این فرمان فاکتور را void نمی‌کند | در کل بلوک `revise_award` صدا به `void` نیست |
| C9 | `awardDocs` در این فرمان بازنویسی نمی‌شود | فقط `wonOffer`, `contractAmount`, `effectiveContractAmount`, `awardRevisions` |
| C10 | اقلام جدید بدون `lineId` / `sourceItemKey` ذخیره می‌شوند | حلقهٔ `$newItems` فقط name/desc/model/unit/pcode/brand/qty/price |
| C11 | `register_offer` اگر `st=won` و JSON فرق کند → `won_offer_locked` | ~۷۸۷ |
| C12 | `awardLines` اول `wonRevisionSnapshot.items` را می‌خواند نه لزوماً `items` زنده | `crm/case-revision.js` ~۵۵–۵۸ |

### ۲.۲ نشت سند برد بین پرونده‌ها

| ID | ادعا | محل |
|---|---|---|
| L1 | اگر `awardDocs` خالی باشد، TO با `(o.inqNo && x.inqNo === o.inqNo)` گرفته می‌شود | `crm/salesfiles.js` `sfAwardEnsure` ~۱۶۸ |
| L2 | همان الگو در تشکیل پرونده کلاینتی | `crm/offers.js` `autoCreateProjectFromCO` ~۸۱۵–۸۲۰ |
| L3 | اگر `awardDocs.length > 0` مهاجرت نرم **برنمی‌گردد** (حتی اگر فقط `won_snapshot` بدون snap باشد) | `sfAwardEnsure` early return ~۱۶۰ |
| L4 | `win_offer` سرور `awardDocs` را فقط `{kind:won_snapshot,...}` بدون snap/TO می‌نویسد | `api/sales-domain.php` ~۸۴۰ |
| L5 | جعبهٔ زرد همهٔ `awardDocs` را چاپ می‌کند بدون فیلتر wonOffer جاری | `sfDrawerHtml` ~۱۰۲۷–۱۰۴۵ |
| L6 | `ptfSalesFileOffers` همهٔ offerهای همان `inqNo` + زنجیره altOf/srcToNo/coNo | `salesfiles.js` ~۷۸–۱۰۶ |
| L7 | تطبیق ذخیرهٔ مهاجرت فقط `x.cd === r.cd` | `sfAwardEnsure` ~۱۷۱ |

### ۲.۳ مالی موجود (قابل استفاده، نه وصل به رویژن)

| ID | ادعا | محل |
|---|---|---|
| F1 | `void_invoice` سند را `status=void` می‌کند، رسید را پاک نمی‌کند، `sd_rebuild_allocations` | `sales-domain.php` ~۱۱۷۲ |
| F2 | `void_unofficial_invoice` قرینه برای غیررسمی؛ رسمی را رد می‌کند | ~۱۱۷۵–۱۱۹۶ |
| F3 | FIFO تخصیص روی `caseId` است نه شماره پیشنهاد | `sd_rebuild_allocations` |
| F4 | قفل سال مالی روی تاریخ فاکتور/رسید void را ۴۰۹ می‌کند | `sd_is_locked` در void_* |
| F5 | متمم فقط دلتای مثبت؛ `contractAmount +=` | `win_offer` attachCase / `mark_amendment` |
| F6 | `revise_award` می‌نویسد `contractAmount = $newTotal` **بدون جمع متمم** | ~۹۳۱ — ادعای باگ |
| F7 | پوشش فاکتور خطی از `lineId ?? sourceItemKey ?? idx` روی offerهای `linkedOffers`+wonOffer | `register_invoice` ~۱۱۴۲ |
| F8 | نقش رویژن سرور: `SD_WIN_ROLES` شامل sales | ثابت بالای فایل |
| F9 | نقش void: `SD_FIN_ROLES` شامل accountant نه sales | همان |
| F10 | UI رویژن: `canRevise` ارشد بدون sales | `case-revision.js` ~۳۶ |
| F11 | `SENIOR_ROLES` = admin, chairman, ceo, commercial | `crm/rbac.js` |

### ۲.۴ حذف مدارک

| ID | ادعا | محل |
|---|---|---|
| D1 | متفرقه / ship / QC / فایل رویداد حذف دارند | `sfDelMisc`, `sfShipDelete`, `sfQcDelete`, `sfEventFileDelete` |
| D2 | docsx رسمی PL/IN/IB/MOM دکمه حذف ندارند | `crm/docsx.js` hook ~۳۹۰ فقط view/edit |
| D3 | صدور PL رسمی همزمان رویداد packing می‌سازد | `ptfDocxCommit` |

### ۲.۵ وابستگی‌های جانبی که رویژن باید ببیند

| ID | ادعا | محل |
|---|---|---|
| X1 | `invRef` روی CO شاهد مرحله ۸ است | `sfInvoiceRef`, `sfStageOf` در `salesfiles.js` |
| X2 | P5 هنگام ساخت revision، `invRef` را unset می‌کند | `unset($revision['invRef'])` |
| X3 | docsx پوشش از `d.wonOffer` | `crm/docsx.js` ~۷۶، ۱۱۰ |
| X4 | buycmp با `sourceOfferNo` | `crm/buycompare.js` |
| X5 | همراه ریالی `rialOf === no` | `crm/offer-rial-convert.js` `ptfRialCompanionOf` |
| X6 | مرجوعی فروش اقلام را از `offer.items[idx]` می‌گیرد | `crm/customer-finance.js` ~۲۳۴ |
| X7 | پورسانت `dealOf` با fallback `x.inqNo === o.inqNo` | `crm/commission.js` ~۹۳–۹۵ |
| X8 | سال مالی `fiscalCaseMatchesOffer` اول `rootOfferId === offer._id` | `crm/fiscal.js` ~۹۰ |
| X9 | رزرو مازاد کلید `offerNo` | `crm/surplus.js` |
| X10 | غیررسمی «یک فعال per offerNo» | `crm/unofficial-invoice.js` ~۵۵۳ |
| X11 | فاکتور تجمیعی چند `offerNos` | همان ماژول `isConsolidated` / `offerNos` |

---

## ۳. مدل پیشنهادی این نشست (هنوز پیاده نشده)

نام پیشنهادی فرمان: `revise_won_offer` در `api/sales-domain.php` (گسترش کنترل‌شده، نه `offerSave`).

### ۳.۱ هویت

- شماره تجاری `offers[].no` **ثابت**.
- `rev += 1` و `revisionHistory` + بازنویسی `wonRevisionSnapshot`.
- `st` بماند `won`. سند `-Rn` **برای رویژن جدید ساخته نشود**.
- `case.wonOffer` عوض نشود.
- اسناد `-R` **موجود** migrate خودکار نشوند.

### ۳.۲ فاکتور

- اگر کاربر تأیید کند: void همهٔ فاکتورهای **فعال با همین `caseId`** (رسمی با `void_invoice`، غیررسمی با `void_unofficial_invoice`).
- فاکتور تجمیعی که پروندهٔ دیگر را هم می‌پوشاند: void خودکار ممنوع؛ blocker.
- اگر تأیید void ندهد و رسمی فعال باشد و مبلغ کم شود: همان ۴۰۹ فعلی.
- رسید `posted` حذف/تغییر مبلغ نشود؛ فقط `sd_rebuild_allocations`.
- صدور فاکتور جدید خودکار نشود.

### ۳.۳ مبلغ پرونده

```
effectiveContractAmount = sum(items ریشه رویژن‌شده) + sum(متمم‌های فعال linkedOffers)
```

`revise_award` فعلی این جمع را ندارد (F6).

### ۳.۴ UI

- جدول اقلام کامل (افزودن/حذف) با موتور پیشنهاد.
- **ممنوع:** فراخوانی خام `offerForm`→`offerSave`.
- ذخیره فقط `ptfSalesDomainApi('revise_won_offer', ...)`.
- پس از پاسخ، cache همان کلیدهای `data` جایگزین شود بعد رندر کشو.

### ۳.۵ گارد توقف کل فرمان

- بیش از یک case فعال برای همان wonOffer
- سال مالی قفل روی فاکتور در حال void
- چک فعال متصل به آن فاکتور
- قلم حذف‌شده با خرید/PL بدون disposition
- فاکتور تجمیعی چندپرونده

### ۳.۶ نقش پیشنهادی فرمان ترکیبی

فقط `admin | chairman | ceo | commercial`.  
sales خیر. accountant فقط void جدا.

### ۳.۷ خارج از محدودهٔ فرمان اول

حذف/ابطال docsx، بازطراحی کشو سه‌زبانه، پاکسازی دادهٔ نشتی، migrate `-R`، صدور فاکتور جدید، باز کردن قفل سال.

---

## ۴. چک‌لیست ایجنت مستقل

لطفاً در پاسخ خود این جدول را پر کنید:

| مورد | تأیید / رد / ناقص | شاهد (فایل:خط یا نقل) |
|---|---|---|
| C1–C12 وضعیت رویژن | | |
| L1–L7 نشت awardDocs | | |
| F1–F11 مالی و نقش | | |
| D1–D3 مدارک | | |
| X1–X11 جانبی | | |
| F6 باگ متمم در revise_award | | |
| آیا مدل §۳ با ARCHITECTURE-GUARDRAILS و قفل دامنه فروش تعارض دارد؟ | | |
| آیا هویت ثابت no با تستر434 یا دادهٔ `-R` زنده می‌شکند؟ | | |
| جنبهٔ جاافتاده | | |

سپس **رأی یک پاراگرافی:** آیا پیاده‌سازی §۳ پس از تأیید کارفرما امن است، یا باید مدل هویت/void عوض شود؟

---

## ۵. آنچه این نشست عمداً انجام نداده

- تغییر `crm/*` یا `api/sales-domain.php` برای این قابلیت
- تغییر تسترها
- mutate دادهٔ sync
- باز کردن PR مخصوص این قابلیت (مگر کارفرما بعداً بخواهد)

اگر ایجنت پیاده‌سازی می‌کند: اول شش تصمیم کارفرما (شماره ثابت، void مشروط، نقش، فرمول متمم، `-R` کهنه، توقف قفل/چک/تجمیعی) باید مکتوب باشد.
