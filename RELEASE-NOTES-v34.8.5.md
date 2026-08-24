# یادداشت انتشار CRM v34.8.5

تاریخ: ۱۴۰۵/۰۶/۰۳ (2026-08-25)

## ایمن‌سازی معماری هزینه‌های تکرارشونده

این نسخه مسیر «حفظ و ایمن‌سازی recurring» را اجرا می‌کند. قابلیت هزینه‌های تکرارشونده حذف نشده است، اما ایجاد، بازسازی، ابطال و projection آن از این پس تحت قرارداد سروری و حسابرسی‌پذیر انجام می‌شود.

### علت‌های ریشه‌ای تأییدشده

1. writerهای هم‌زمان مرورگر و سرور می‌توانستند برای یک ماه یا هویت تکرارشونده رکوردهای متفاوت بسازند.
2. پاسخ projection می‌توانست snapshot ناقص OPEX را جای کل مجموعه بنویسد و ردیف‌های نامرتبط، پیوست‌ها یا tombstoneهای محلی را ناپدید کند.
3. نبودن یک ردیف در snapshot ناقص می‌توانست به‌اشتباه مجوز void تلقی شود.
4. OPEX حقوق و طلب سهامدار دو سند مستقل بودند و ساخته‌شدن یکی، ثبت دیگری را تضمین نمی‌کرد.
5. برنامه‌ریزی هزینهٔ چک آینده پیش از ACK قطعی سرور می‌توانست وضعیت محلی و سرور را از هم جدا کند.
6. merge بدون هویت پایدار و fallback به ردیف هم‌کد، امکان ویرایش/حذف sibling اشتباه یا زنده‌شدن دوبارهٔ رکورد terminal را ایجاد می‌کرد.

## قرارداد جدید سرور

- materialization حقوق سهامداران و قالب‌های OPEX فقط روی سرور انجام می‌شود.
- فرمان‌ها idempotent هستند و replay همان فرمان، نتیجهٔ commit‌شده را با projection جاری بازمی‌گرداند.
- projection هزینه‌های تکرارشونده envelope نسخه‌دار `merge-v1` با revision، `upserts` و `tombstones` است.
- هویت merge ابتدا با `_opexRowId` فیزیکی بررسی می‌شود؛ `recurringKey` هویت دامنه/گروه است و فقط برای migration یک ردیف هنوز تأییدنشده fallback می‌شود. دو ردیف پذیرفته‌شدهٔ سرور با row ID متفاوت، حتی با `recurringKey` مشترک هرگز روی هم collapse نمی‌شوند.
- recurringهای legacy فاقد row ID در نخستین merge محافظت‌شده، شناسهٔ پایدار و صادرشدهٔ سرور با قالب `OPXR-SRV-…` می‌گیرند و با `serverOwnedIdentity` علامت می‌خورند؛ بنابراین render مرورگر دیگر شناسهٔ تصادفی تازه و conflict loop تولید نمی‌کند و fallback مهاجرت پس از پذیرش هویت تکرار نمی‌شود.
- نبودن ردیف در پاسخ هیچ‌گاه به‌معنای حذف یا void نیست.
- حقوق سهامدار موظف از مبلغ پروندهٔ سهامدار در ابتدای همان ماه (`YYYY/MM/01`) شناسایی می‌شود؛ قالب مستقل OPEX منبع eligibility یا مبلغ حقوق نیست.
- حقوق سهامدار و OPEX متناظر در یک commit سروری ساخته/اصلاح می‌شوند. پاسخ همان commit و replay آن، برای نقش‌های مدیر ارشد `sharetx` را مستقیماً و همراه OPEX برمی‌گرداند تا نمایش طلب به pull دوم وابسته نباشد؛ projection محرمانهٔ `sharetx` برای حسابدار و نقش فاقد دسترسی افشا نمی‌شود.
- اگر OPEX حقوق موجود ولی claim سهامدار مفقود باشد، reconcile جاری claim را می‌سازد و همان OPEX را به آن متصل می‌کند؛ duplicate ساخته نمی‌شود و تاریخ شناسایی هر دو سند ابتدای همان ماه تثبیت می‌شود.
- migration حقوق، OPEXهای legacy بدون `recurringKey` را از رابطهٔ پایدار `shareTx` نیز پیدا می‌کند تا برای یک حقوق موجود هزینهٔ تکراری نسازد.
- materialization یک قالب فقط با `scopeTemplate` معتبر انجام می‌شود و مسیر قالب، salary reconcile را با `includeSalaries:false` اجرا می‌کند.
- scope صریح خالی یا قالب ناموجود fail-closed است و هیچ snapshot ناقصی به‌عنوان مجوز حذف مصرف نمی‌شود.
- برنامه‌ریزی هزینه‌های آیندهٔ چک، OPEXها و `cheque.opexRowIds` را در یک commit اتمیک ثبت می‌کند.

## حذف، ابطال و بازگردانی

- حذف manual OPEX دیگر `splice` فیزیکی نیست؛ یک tombstone صریح با دلیل، کاربر، زمان و audit پایدار می‌سازد.
- ابطال recurring فقط با فرمان صریح و reasonدار سرور مجاز است.
- ابطال یک هویت recurring همهٔ duplicateهای همان هویت را terminal می‌کند تا sibling فعال، هزینهٔ حذف‌شده را دوباره نمایش ندهد.
- restore فقط برای کلیدهای صریح `restoreKeys` اجرا می‌شود.
- restore واقعی، tombstone canonical را فعال و duplicateهای دیگر را کنترل می‌کند؛ درخواست restore روی ردیف از قبل فعال، restore حساب نمی‌شود.
- correctionهای `explicit_restore`، `explicit_void` و `duplicate_recurring_void` دارای snapshot کامل قبل/بعد، دلیل، actor و timestamp هستند.
- duplicate cleanup حقوق فقط در scope صریح همان سهامدار اجرا می‌شود و به ردیف سهامداران دیگر دست نمی‌زند.
- handlerهای edit/delete ردیف terminal یا شناسهٔ stale را رد می‌کنند و به sibling هم‌کد fallback نمی‌کنند.

## Sync، بازیابی و قطعیت نتیجه

- `data_push` عمومی برای `ptf_crm_opex` و `ptf_crm_sharetx` دیگر full snapshot مرورگر را replace-all نمی‌کند: merge از snapshot فعلی سرور آغاز می‌شود، omission حذف محسوب نمی‌شود، recurring جدیدِ جعل‌شده drop می‌شود و identity، مبلغ، metadata canonical، provenance و lifecycle سروری قابل overwrite نیستند.
- اگر merge محافظت‌شده payload را تغییر دهد، سرور آن کلید را ACK نمی‌کند؛ کلید در `protectedConflicts` و snapshot محافظت‌شده در `serverData` برمی‌گردد تا cache محلی با موفقیت کاذب باقی نماند.
- بازیابی `protectedConflicts` سه‌طرفه است: snapshot سرور مبناست و فقط تغییر واقعی local که بعد از payload ارسال‌شده رخ داده دوباره اعمال می‌شود؛ بنابراین annotation جدید post-send حفظ می‌شود اما مقدار server-owned یا recurring جعلی زنده نمی‌شود.
- delta فرمان و full pull هر دو merge identity-aware انجام می‌دهند و ردیف‌های نامرتبط، annotationها، پیوست‌ها و tombstoneهای صریح را حفظ می‌کنند.
- وضعیت‌های `status` و `st` مستقل بررسی می‌شوند؛ `status=active` دیگر `st=void` را در OPEX یا گردش طلب سهامدار پنهان نمی‌کند.
- `st=settled` در projection یک وضعیت پرداخت فعال است و پاک نمی‌شود. پس از پذیرش settlement، snapshot stale نمی‌تواند ردیف را reopen یا `settleDoc`، actor/time/ISO، روش پرداخت و evidence قبلی را بازنویسی یا حذف کند؛ evidence جدید به‌صورت append-only افزوده می‌شود.
- رابطهٔ recurring با چک (`chequeCd`/`payHow`/`fromCheque`) فقط از commit اتمیک سرور می‌آید و full push عمومی قادر به جعل یا پاک‌کردن آن نیست.
- envelope بی‌هویت، revision صفر/نامعتبر، revision ناسازگار و پاسخ دیررس fail-closed رد می‌شوند.
- delta روی JSON محلی خراب از آرایهٔ خالی شروع نمی‌شود؛ projection اتمیک رد می‌شود و catch-up pull بازیابی authoritative را همچنان اجرا می‌کند.
- تعارض ردیف manual با timestampهای ناهمگون شمسی/میلادی مقایسه نمی‌شود: در کلید dirty نسخهٔ محلی تا re-push حفظ می‌شود و در pull تمیز نسخهٔ سرور برنده است، با حفظ annotationهای محلی.
- materialization مرورگر پیش از flush موفق و ACK فرمان سرور هیچ claim محلی ایجاد نمی‌کند.
- ACK یک push فقط نسل همان snapshot ارسالی را پاک می‌کند؛ اگر همان کلید هنگام request درحال‌پرواز دوباره ویرایش شود، dirty نسل جدید باقی می‌ماند و در push بعدی ذخیره می‌شود.
- command مشتق‌شونده از تنظیمات، سهامدار یا چک تنها پس از keyed sync barrier همان کلیدهای مبنا اجرا می‌شود؛ ACK نامرتبط یا نسل قدیمی اجازهٔ اجرای command روی snapshot کهنه را نمی‌دهد.
- synchronous throw، Promise rejection، پاسخ non-Promise و خطای flush همگی به نتیجهٔ قطعی rejected تبدیل می‌شوند.
- intent هزینهٔ تکرارشوندهٔ چک تا ACK نگه داشته می‌شود؛ failure آن را `retry_required` می‌کند و retry همان برنامه را دوباره می‌فرستد.
- حذف فیزیکی محلیِ چک متصل به recurring OPEX fail-closed است؛ چون این مسیر نمی‌تواند رابطهٔ server-authored را اتمیک اصلاح کند، اجازهٔ ساخت orphan مالی داده نمی‌شود.

## کنترل کیفیت

- tester جدید `tester505-v34.8.5-recurring-race-replay.js` برای race/replay، merge delta، tombstone، restore canonical، scope ناموجود، correction audit، settlement فعال و پایدار، lifecycle مستقل طلب سهامدار، repair صریح «OPEX حقوق موجود ولی claim مفقود»، projection مستقیم role-safe برای مدیر ارشد، بازیابی conflict، حفظ هم‌زمان canonical فعال و duplicate tombstone با `recurringKey` مشترک و commit اتمیک چک افزوده شد.
- fixture runtime کنترل‌شده ثابت می‌کند write نسل B در زمان fetch نسل A با ACK قدیمی پاک نمی‌شود و keyed barrier فقط پس از ACK واقعی همان کلید آزاد می‌شود.
- testerهای OPEX، حقوق سروری، مطالبات و مکاتبات با قرارداد جدید به‌روزرسانی شدند.
- گیت کامل CI: **121 PASS / 0 FAIL**.
- نگهبان معماری: **PASS**.
- syntax تعداد **51 فایل CRM**: **PASS**.
- `git diff --check`: **PASS**.
- `php -l` به‌دلیل نبود executable `php` در محیط محلی skip شد؛ قرارداد PHP با fixtureهای ایستا/رفتاری مرتبط و مرور دستی بلوک‌های تغییرکرده کنترل شد.
