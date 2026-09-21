# یادداشت انتشار v34.39.21 — UI-STABILITY (۱۴۰۵/۰۷/۰۱ / 2026-09-21)

## گزارش کارفرما
> «در پنجره ثبت قیمت در قسمت تامین اینقدر لغزش و پرش و ناپایداری وجود دارد.
> همین‌طور وقتی جا به جا می شویم روی تب ها بعضی چیزها مثل فیلتر مثلا بعدا لود می شود و باعث ایجاد پرش می شود.»

## RCA (خلاصه — تحلیل کامل: `ARENA-CRM-UI-STABILITY-RCA-2026-09-21.md`)

### ① پنجرهٔ ثبت قیمت تامین — سه مکانیزم لغزش/پرش
| # | ریشه | مکان |
|---|------|------|
| a | hint «مبلغ به حروف» (`moneyx.hintFor`) داخل ردیف‌های flex/grid به آیتم جریانی تبدیل می‌شد؛ رشد متن حروفی در هر keystroke = سُر خوردن/فشرده‌شدن فیلدهای کناری («لغزش») | crm/moneyx.js |
| b | تبدیل ارقام فا/ع در input handler مقدار را بدون `setSelectionRange` می‌نوشت → پرش مکان‌نما (خانوادهٔ شکایت مستند «۱۵ ← ۵۱» در ui-kit/US-438) | crm/moneyx.js |
| c | بعد از هر «ثبت قیمت‌ها»، `cmpQuoteSave` همهٔ md-b های visible را می‌کشت (`BUG-017`) و کل مودال مقایسه destroy/recreate می‌شد — همین الگو در `cmpBuy`/`cmpSplitSave`/`cmpBulkBuyGo` → فلش و پرش کل پنجره بعد از هر ثبت | crm/buycompare.js |
| d | `rfqsPriceBlur` با blur فیلد قیمت (۱۲۰ms)، کل آکاردئون «ثبت قیمت‌ها» را حتی وسط تایپ در فیلد «تحویل (روز)» بازسازی می‌کرد | crm/rfqsmart.js |

### ② تب‌ها + فیلتر دیرلود + پرش
| # | ریشه | مکان |
|---|------|------|
| e | دکمهٔ «🧰 فیلتر و خروجی» فقط با `setInterval(1200)` تزریق می‌شد → تا ۱٫۲ ثانیه پس از تعویض تب، نوار فیلتر بدون دکمه رندر و بعد ناگهان appendChild می‌شد → reflow = «پرش» | crm/listtools.js |
| f | باکس‌های تنظیمات (llmBox/arvanBox/sessionsBox/engineGateBox) با `setTimeout(100-150ms)`/fetch پر می‌شدند و ارتفاع رزروشده نداشتند | crm/index.html |

## رفع ریشه‌ای (v34.39.21)
1. **moneyx**: hint تک‌خطهٔ غیر-reflow (`nowrap + ellipsis + pointer-events:none`)؛ در والد flex-row خط اختصاصی ثابت (`flex:1 0 100%` + `flex-wrap`)، در grid (`grid-column:1/-1`)؛ حفظ کرسر در تبدیل ارقام (نگاشت ۱:۱).
2. **buycompare**: `cmpInnerHtml` مشترک + `cmpRefreshModal` بازنویسی درجای محتوای همان گره مودال با حفظ `scrollTop` (fallback به `cmpOpen`)؛ حذف kill-all مودال‌ها؛ هر ۴ مسیر ثبت/حذف از refresh درجا استفاده می‌کنند.
3. **rfqsmart**: نگهبان containment آکاردئون در `rfqsPriceBlur` — تا فوکوس داخل همان آکاردئون است رندر مجدد انجام نمی‌شود.
4. **listtools**: تزریق هم‌زمان + `MutationObserver` روی `#panels` (پیش از اولین paint) + `window.ptfListToolsInject`؛ بازهٔ ۱۲۰۰ms فقط تور ایمنی idempotent.
5. **تنظیمات**: رزرو `min-height:120px` روی هر ۴ باکس دیرپر.

## قرارداد تست
`_tools/uat/tester675-v34.39.21-ui-stability-price-modal-tabs.js` (۱۷ سنجه — ثبت در run-ci-gate) — همه سبز.
همراه با بامپ زنجیرهٔ نسخه (A6: index/sw/manifest/clear-cache/shell/sales-domain + `?v=` cache-busterها) و به‌روزرسانی پین نسخهٔ تسترها (۷۶۷ پین).
