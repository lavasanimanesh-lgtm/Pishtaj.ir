# RCA — دو باگ UI (لغزش/پرش پنجرهٔ ثبت قیمت تامین + پرش فیلتر بعد از تعویض تب)
## v34.39.21 — UI-STABILITY — ۱۴۰۵/۰۷/۰۱ (2026-09-21)

> گزارش کارفرما:
> ① «در پنجره ثبت قیمت در قسمت تامین اینقدر لغزش و پرش و ناپایداری وجود دارد.»
> ② «وقتی جا به جا می شویم روی تب ها بعضی چیزها مثل فیلتر مثلا بعدا لود می شود و باعث ایجاد پرش می شود.»

---

## ① پنجرهٔ ثبت قیمت (تامین) — لغزش و پرش و ناپایداری

پنجرهٔ مورد اشاره: مودال **«💰 ثبت قیمت دور ۱/۲»** (`cmpAddQuote` در `crm/buycompare.js`) از ماژول «🛒 قیمت‌های خرید و مقایسه تامین‌کنندگان»؛ به‌همراه سطوح هم‌خانواده: «🛍 ثبت خرید واقعی» (`cmpBuy`/`ptfDialog`)، «🛒 ثبت گروهی خرید» (`cmpBulkBuy`)، «🔀 تقسیم خرید» (`cmpSplitOpen`) و جدول «💾 ثبت قیمت‌ها» (`rfqsmart`).

### ریشه A — hint «مبلغ به حروف» به آیتم جریانی ردیف‌های flex تبدیل می‌شد («لغزش» حین تایپ)
- **مکانیزم**: `crm/moneyx.js` → `hintFor()` با `el.parentNode.insertBefore(h, el.nextSibling)` یک `<div class="ptf-money-hint">` **بلافاصله بعد از input** درج می‌کرد. سطرهای آیتم در `cmpAddQuote` (buycompare.js:264-268) این‌اند:
  `display:flex; align-items:center; gap:8px` ← label(`flex:1`) + input قیمت(`data-money`, ‏150px) + select + …
- hint به **آیتم جریانی flex** تبدیل می‌شد؛ متن حروفی با هر keystroke بلندتر می‌شد (`ptfNumWordsFa`: «دویست و پنجاه و سه هزار و …»)، همهٔ آیتم‌ها `flex-shrink` پیش‌فرض دارند → **عرض فیلدهای کناری لحظه‌به‌لحظه سُر می‌خورد**؛ در عرض‌های کمتر، شکستن سطر = پرش ارتفاع. `updateHint` هم `display` را none↔'' می‌کرد (در آستانهٔ ۱۰۰۰) = جهش ارتفاع.
- **تشدیدکننده**: همین hint زیر فیلدهای بلوکی (مثل فیلدهای `ptfDialog` در «ثبت خرید واقعی») نیز با رشد متن در عرض باریک مودال به چند سطر می‌شکست و ارتفاع فرم را per-keystroke تغییر می‌داد.

### ریشه B — بازنویسی مقدار بدون حفظ مکان‌نما در تبدیل ارقام فا/ع («پرش کرسر»)
- **مکانیزم**: handler سراسری `input` در `crm/moneyx.js` برای همهٔ فیلدهای عددی‌مانند (شامل `data-money`، `inputmode=numeric`، idهای price/qty/rate/…) ارقام فارسی/عربی را به انگلیسی می‌کرد ولی `el.value = converted` را **بدون `setSelectionRange`** می‌نوشت → مرورگر مکان‌نما را به انتها می‌برد؛ تایپ وسط عدد = مکان‌نما می‌پرد و نوشتن به‌هم می‌ریزد.
- **شهادت موجود در کد**: `crm/ui-kit.js` (v19.6/US-438): «بعضی فیلدهای عددی … با formatter دچار caret-reverse می‌شوند (**مثل ۱۵ ← ۵۱**)» — تا امروز فقط با `money:false` per-field دور زده شده بود؛ ریشه (بی‌کرسری مسیر تبدیل) باز مانده بود.
- (فرمت کامای زندهٔ `reformat` مکان‌نما را نگه می‌داشت ولی نگاشتش «تعداد رقم قبل از کرسر» بود و مسیر تبدیل ارقام اصلاً به آن نمی‌رسید.)

### ریشه C — بازسازی کامل مودال بعد از هر ثبت («پرش/فلش کل پنجره»)
- **مکانیزم**: در `crm/buycompare.js` بعد از هر ثبت قیمت/خرید:
  1. `cmpQuoteSave` (خط ~296): `btn.closest('.md-b').remove()` + **`document.querySelectorAll('.md-b').forEach(x => x.remove())`** ← kill-all همهٔ پنجره‌های visible (به‌جز مینیمایزها — BUG-017)؛
  2. سپس `renderBuyQuotes()` + **`cmpOpen(id)`** = `insertAdjacentHTML` تازه ← **کل مودال مقایسه destroy/recreate می‌شد** (گره عوض، جای اسکرول صفر، ارتفاع تازه) = فلش و پرش کل پنجره؛
  3. همین الگو در پایانِ `cmpBuy` (onOk)، `cmpSplitSave` و `cmpBulkBuyGo` تکرار می‌شد (`oldCmp.remove(); cmpOpen(...)`).
- در «ثبت خرید واقعی» دو `confirm()` پشت‌سرهم (رسید پرداخت / هزینه مستقیم) هم بلافاصله بعد از بازسازی می‌آمدند (ناپایداری ادراکی مضاعف در مسیر realbuy).

### ریشه D — رندر مجدد کل آکاردئون rfqsmart وسط تایپ (جدول «ثبت قیمت‌ها»)
- **مکانیزم**: `crm/rfqsmart.js` → `rfqsPriceBlur` پس از blur هر فیلد قیمت، با `setTimeout(120)` کل `rfqsRenderAccordion(no)` (بازسازی کل DOM آکاردئون) را اجرا می‌کرد؛ نگهبان قبلی فقط فیلدهای `data-rqsprice` را می‌شناخت → رفتن از «قیمت» به «تحویل (روز)» یا هر کنترل دیگرِ همان آکاردئون = ۱۲۰ms بعد **DOM زیر پای کاربر وسط تایپ عوض می‌شد** (پرش + از‌دست‌رفتن ورودی). (بهبود v14.3/US-373 فقط oninput را بی‌رندر کرده بود.)
- همچنین هر keystroke در این جدول `ptfEntitySaveCollection('ptf_crm_rfqsmart', …)` (diff کل مجموعه) می‌زد — بار سنگین ولی بدون تغییر layout؛ در این نسخه دست‌نخورده ماند (ریسک رفتاری/همگام‌سازی).

---

## ② جابه‌جایی روی تب‌ها — عناصری مثل فیلتر «بعدا لود» می‌شوند و پرش می‌دهند

### ریشه E — دکمهٔ «🧰 فیلتر و خروجی» با تأخیر ۱٫۲ ثانیه‌ای تزریق می‌شد (دقیقاً همان «فیلترِ بعدا لودشده»)
- **مکانیزم**: `crm/listtools.js`:
  ```js
  setInterval(function () { try { injectButtons(); } catch (e) {} }, 1200);
  ```
  `injectButtons` دکمهٔ «🧰 فیلتر و خروجی» را به نوار فیلتر هر فهرست (`#sSrch`/`#cSrch`/`#pSrch`/`#oFsrch`/`#ldSrch`/`#rSrch`/`#ltSrch`/`#prjSrch` و `#prodFilterExtras`) اضافه می‌کند — **اما فقط وقتی تایمر ۱٫۲s بیدار شود**.
- هنگام `goPanel` (تعویض تب): پنل با `buildX()+renderX()` رندر می‌شود **بدون دکمه** → تا ۱٫۲ ثانیه بعد toolbar کوتاه‌تر است → بعد `target.appendChild(b)` ناگهانی → `flex-wrap` نوار فیلتر به هم می‌ریزد/ردیف دوم می‌سازد → همه‌چیز زیرش می‌پرد. هر بار ورود به تب = همان پرش با تأخیر شناور ۰–۱۲۰۰ms («بعضی چیزها مثل فیلتر مثلا بعدا لود می‌شود»).
- در «📦 کالاها» بدتر: `#prodFilterExtras` (سطر دوم فیلترها) از ابتدا خالی است و دکمه با تأخیر داخلش می‌نشیند = پرش بزرگ‌تر.

### ریشه F — باکس‌های تنظیمات با تأخیر پر می‌شدند («بعضی چیزها»)
- `crm/index.html` → `buildSettings`: رندر `arvanBox`/`engineGateBox`/`sessionsBox` با `setTimeout(100-150ms)` و `llmBox` با fetch → placeholder کوتاه («در حال بررسی…») اول رندر و محتوای بلند بعدا می‌آمد = جابه‌جایی محتوا.

### (خانوادهٔ هم‌ریشه — برای آگاهی؛ در این نسخه تغییر نکرد)
- الگوی «تزریق DOM با تایمر/هوک پس از paint» در چند ماژول دیگر هم هست (`offer-rial-convert` appendChild دکمه‌ها، `settings-accordion`، `my-customers-filter` (هوک-هم‌زمان — سالم)، patchهای retryدار `buycompare`/`docsx` (400ms×50)). ریشهٔ معماری: **تایمر-محور بودن تزریق UI به‌جای رویداد/سینک-رندر**.
- جدول محصولات در حالت «خواندن سروری» placeholder «⏳ در حال دریافت…» دارد که با محتوا عوض می‌شود (کلاس همین باگ؛ ارتفاع جدول ناپایدار).

---

## رفع ریشه‌ای اعمال‌شده (v34.39.21)

| ریشه | رفع | مکان |
|------|------|------|
| A | hint تک‌خطهٔ غیر-reflow: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none` + در والد flex-row: `flex-wrap` روی والد و `flex:1 0 100%` روی hint (خط اختصاصی ثابت — فیلدهای کناری هرگز سُر نمی‌خورند)؛ در والد grid: `grid-column:1/-1` | crm/moneyx.js |
| B | حفظ کرسر در تبدیل ارقام: `setSelectionRange(cPos, cEnd)` پس از بازنویسی (نگاشت ۱:۱ فا/ع←EN) | crm/moneyx.js |
| C | `cmpInnerHtml(id, locked)` مشترک (سازندهٔ محتوای مودال) + `cmpRefreshModal(id)`: بازنویسی درجای `.md` **همان گره مودال** با حفظ `scrollTop`؛ fallback به `cmpOpen`؛ حذف kill-all مودال‌ها؛ هر ۴ مسیر (`cmpQuoteSave`/`cmpBuy`/`cmpSplitSave`/`cmpBulkBuyGo`) روی refresh درجا | crm/buycompare.js |
| D | نگهبان `rfqsPriceBlur`: اگر `document.activeElement` داخل همان `#rfqAcc_<no>` است → رندر مجدد انجام نشود | crm/rfqsmart.js |
| E | تزریق هم‌زمان: فراخوانی `injectButtons` در لحظهٔ load + `MutationObserver` روی `#panels` (کالبک observer در microtask و **پیش از paint** اجرا می‌شود → دکمه در همان فریم اول تب جدید هست، بدون pop-in) + export `window.ptfListToolsInject` برای فراخوانی دستی از goPanel در آینده؛ بازهٔ ۱۲۰۰ms فقط تور ایمنی (idempotent) | crm/listtools.js |
| F | رزرو `min-height:120px` روی `arvanBox`/`llmBox`/`sessionsBox`/`engineGateBox` | crm/index.html |

## قرارداد تست (ماندگار)
`_tools/uat/tester675-v34.39.21-ui-stability-price-modal-tabs.js` — ۱۷ سنجه در ۵ بخش (A: moneyx رفتاری/ایستا، B: buycompare ایستا + رفتاری، C: rfqsmart، D: listtools/تنظیمات رفتاری/ایستا، E: پین‌های انتشار) — در `run-ci-gate.js` ثبت شد؛ **همه سبز**.

### وضعیت نهایی زنجیره
- ARCH GUARD: PASS (A6: همهٔ نقاط رسمی نسخه + ۱۱۲ cache-buster `?v=` در index.html هم‌تراز v34.39.21)
- tester675: PASS — tester674 (زنجیرهٔ قبلی): PASS — tester621: PASS
- ۷۶۷ پین نسخهٔ تسترها/فایل‌های رسمی به v34.39.21 به‌روز شد (قرارداد هر بامپ: لیترال + escape‌دار + `?v=`/`ASSET_VERSION`/`SD_SERVICE_VERSION`)
- `tester554 (expectCreate روتر entity)` در baseline بدون تغییرات هم FAIL است (شکست از پیش موجود — نه رگرسیون این نسخه).
