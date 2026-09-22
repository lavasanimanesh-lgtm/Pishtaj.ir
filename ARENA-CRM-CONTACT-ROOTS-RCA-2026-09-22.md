# ریشه‌یابی و ریشه‌کنی باگ «شماره‌های تماس مشتریان پاک می‌شود و قابل مشاهده نیست» — v34.39.22

**تاریخ:** ۱۴۰۵/۰۷/۰۱ — **دامنه:** crm/offers.js، crm/phonefmt.js، api/crm.php — **آزمون:** `_tools/uat/tester676-v34.39.22-contact-roots.js`

---

## ۱. چرا fixهای قبلی کار نکردند

زنجیرهٔ v34.37.7 (CONTACT-WIPE: سپر حذف انبوه + AUTO_NO_DELETE) → v34.38.4 → v34.38.25 (CONTACT-WIPE-INVARIANT:
`_ccClear` + گارد سروری `sd_contact_wipe_guard`) → v34.38.25-hook → v34.39.12 (CONTACT-STALE-PARTIAL-WIPE:
اتحاد سروری `sd_contact_stale_merge` + `_ccEdit`/`_ccBaseAt` + CONTACT-STRIP مسیرهای غیرتماسی) → v34.39.21
هر کدام **یک بردار** را بستند، ولی باگ زنده ماند چون:

1. **پیاده‌سازی `_ccBaseAt` قرارداد خودش را نقض می‌کرد** (R2). کامنت v34.39.12 می‌نویسد «نسخهٔ updatedAtی که
   مودال با آن باز شد» ولی کد از `oldRecPre` (رکوردِ `getData` در لحظهٔ save) می‌خواند. با pull وسط مودال،
   baseAt با `updatedAt` سرور برابر می‌شد → `sd_contact_stale_merge` با «fresh edit» نتیجهٔ key-merge (LWW)
   را برمی‌گرداند = **جایگزینی wholesale** شماره‌هایی که فقط روی سرور بودند. شرط اتحاد کلاینتی هم
   (`liveAt !== oldAt`) چون هر دو از همان oldRecPre می‌آمدند برای پنجرهٔ modal-open هرگز فعال نمی‌شد.
   نتیجه دقیقاً الگوی میدانیِ گزارش‌شده بود: «مالِ من سالم، مالِ او پاک».
2. **مسیر تبدیل نوع از همهٔ گاردها بیرون بود** (R1). `ptfPreserveLegalContactsAsPhones` کلید dedup را با
   `n.replace(/[^0-9]/g,'')` می‌ساخت. چون `ptfNormalizeEntityPhones(rec,'fa')` شماره‌ها را **فارسی** ذخیره
   می‌کند، کلید همهٔ شماره‌های فارسی رشتهٔ خالی بود → `if (!key || seen[key]) return` → همهٔ coTels/people
   قدیمی هنگام حقوقی→حقیقی drop می‌شدند؛ اگر نتیجه کاملاً خالی می‌شد، auto-`_ccClear` هم صادر می‌شد و سرور
   (با حقِ `_ccClear`) پاک‌سازی را «قانونی» می‌پذیرفت. حتی یک شمارهٔ فارسیِ فرم `seen['']=1` می‌نشاند و همهٔ
   قدیمی‌ها را می‌ریخت.
3. **نرمال‌ساز ویرانگر** (R3) + **نامرئی‌سازی UI** (R4/R5) باگ را برای کاربر «گم شدن» می‌کردند حتی وقتی
   داده سالم بود: «021 8800 داخلی 12» به شمارهٔ به‌هم‌چسبیده تبدیل می‌شد، «تماس بگیرید» تهی می‌شد
   (→ auto-_ccClear بی‌جهت)، کارتِ entity بخش «اشخاص رابط» را کنار phones پنهان می‌کرد (either/or)،
   تلفنخانه‌های دوم به‌بالا نمایش داده نمی‌شدند، جستجوی شماره (با ارقام انگلیسی) شمارهٔ فارسیِ ذخیره‌شده را
   نمی‌یافت، و `telHref` ارقام فارسی را می‌ریخت (لینک تماس تهی).
4. **data_push مسیر legacy سپر «شستشوی فیلد» نداشت** (R6). کل blob جایگزین می‌شد و MASS-DELETE-SHIELD فقط
   «حذف ردیف» را می‌دید؛ رکوردِ بدون کلید تماس (stub بازسازی `ptfHealMissingCustomersFromRfqs`، مهاجرت ناقص،
   fallbackهای `ptfEntitySaveCollection`) شماره‌های ثبت‌شدهٔ کاربران را روی سرور بی‌صدا می‌پراند.

## ۲. رفع‌ها (جراحی ریشه‌ای)

- **R1** — `ptfPreserveLegalContactsAsPhones` (offers.js): `contactKey` با `ptfToEnDigits` (هر دو خط ارقام را
  یکی می‌شمارد) + fallback `s:` برای ورودی بدون-رقم + حذف `if (!key)`.
- **R2** — `showCustModal`/`showSupModal2` لحظهٔ بازشدن مودال را در `window._ptfContactFormBaseAt` ثبت می‌کنند؛
  `saveCust2`/`saveSup2` برای `_ccBaseAt` و شرط اتحاد (`liveAt !== formAt`) از همان استفاده می‌کنند
  (fallback به oldRecPre فقط برای فراخوانی‌های بدون مودال). حالا semantics طراحی‌شدهٔ v34.39.12 واقعاً
  کار می‌کند: مودالِ تازه = حذف آگاهانه محترم (LWW)؛ مودالِ کهنه = اتحاد (شمارهٔ فقط-سرور هرگز پاک نمی‌شود).
- **R3** — `ptfPhoneNorm` (phonefmt.js): ورودیِ دارای حروف («داخلی»، «تماس بگیرید») بدون دگرگونی برمی‌گردد؛
  بدون-رقم → متن اصلی. شماره‌های تمیز و قرارداد fa=ملیِ فارسی / en=بین‌المللیِ خوانا دست‌نخورده.
- **R4** — `showEntityCard`: همهٔ `coTels` (با `telHref`/`fmtTel`) + بخش‌های مستقل «تلفن‌های شخص» و «اشخاص رابط»
  (هر دو هم‌زمان).
- **R5** — `entityMatches`: haystack کامل (coTels/phones/ph/tel/mob/con) + fold دوطرفهٔ ارقام فارسی↔انگلیسی؛
  `telHref` و لینک موبایلِ اشخاص با `ptfToEnDigits`.
- **R6** — `sync_contact_fields_fill` (api/crm.php) در `data_push` برای `ptf_crm_customers`/`ptf_crm_suppliers`:
  «فیلد غایب = تغییر نکرده» — کلیدِ تماسِ غایبِ ورودی وقتی سرور مقدارِ غیرتهی دارد پر می‌شود. کلیدِ حاضر
  (حتی خالی) محترم است؛ `restore`/`allow_wipe` مستثنی.

## ۳. قراردادهای حفظ‌شده (تاییدشده با رگرسیون)

- tester604 (45/0)، tester611 (21/0)، tester614 (36/0)، tester615 (34/0)، tester660 (37/0) — همهٔ قراردادهای
  قبلی تماس (AUTO_NO_DELETE، INVARIANT، stale-hook، migrate، heal) سبز.
- حذف آگاهانه در مودالِ تازه + `_ccClear` صریح همچنان مجاز.
- tester674/675/622/578/442 + ARCH GUARD در گیت نهایی.

## ۴. شکست‌های pre-existing (دست‌نخورده — گزارش‌شده طبق قاعده)

- tester554 (`روتر entity رکوردهای جدید را با expectCreate می‌فرستد`) — از پیش موجود (UI-STABILITY، baseline تأییدشده).
- tester83 (`rfqsFinalize: گارد استعلام تکراری`) — با baseline در HEAD بدون تغییرات، عیناً 55/1 FAIL.
