# گزارش رگرسیون کامل — v34.7.0

**تاریخ اجرا:** 2026-08-15T08:40:23.746Z
**نسخه کد:** v34.7.0
**دستورات:** `python3 _tools/audit.py` + همه `_tools/uat/tester*.js`

## نتیجه کلی

| شاخص | مقدار |
|:---|---:|
| تعداد تسترها | 388 |
| فایل تستر PASS | **330** |
| فایل تستر FAIL | **58** |
| مجموع چک PASS | **5740** |
| مجموع چک FAIL | **130** |
| audit.py | PASS (بدون warning) |

## تسترهای ازقبل‌شکسته (مسیر `/home/user/pishtaj/`)

- (هیچ)

## FAILهای واقعی / جدید

- tester103-v186.js: 18 PASS / 1 FAIL |   ✘ FAIL: باکس پرونده فروش پیش‌پرداخت/هزینه/استعلام مجدد را نشان می‌دهد | === tester103-v186: 18 PASS / 1 FAIL ===
- tester104-v187.js: 17 PASS / 1 FAIL |   ✘ FAIL: بستانکاری تامین‌کننده dueISO/dueNote دریافت می‌کند | === tester104-v187: 17 PASS / 1 FAIL ===
- tester105-v189.js: 17 PASS / 2 FAIL |   ✘ FAIL: رندر پیشنهاد برنده read-only و پرونده فروش نشان می‌دهد |   ✘ FAIL: دکمه فاکتور در پیشنهاد برنده به پرونده هدایت می‌شود نه refToInvoice | === tester105-v189: 17 PASS / 2 FAIL ===
- tester106-v190.js: 23 PASS / 1 FAIL |   ✘ FAIL: fiscal فقط admin/chairman (محرمانگی R9) | === tester106-v190: 23 PASS / 1 FAIL ===
- tester107-v191.js: 39 PASS / 3 FAIL |   ✘ FAIL: دکمه 🔬 فقط برای پرونده برنده |   ✘ FAIL: برچسب Post-Award: عملیات فقط از داخل پرونده (US-434) |   ✘ FAIL: عدم انطباق → notify مدیران با kind=warn | === tester107-v191: 39 PASS / 3 FAIL ===
- tester109-v193.js: 40 PASS / 2 FAIL |   ✘ FAIL: دکمه در کشو: باز پس از مرحله ۷، قفل 🔒 قبل از آن، بج پس از ارجاع |   ✘ FAIL: US-434ف۲ ارسال/تحویل (v19.2) پابرجا | === tester109-v193: 40 PASS / 2 FAIL ===
- tester110-v194.js: 34 PASS / 2 FAIL |   ✘ FAIL: AC1: مطالبات باز = بدون تیک تسویه، مختومه ممنوع |   ✘ FAIL: US-435/436 (v19.3) پابرجا | === tester110-v194: 34 PASS / 2 FAIL ===
- tester111-v195.js: 31 PASS / 7 FAIL |   ✘ FAIL: قفل مجدد همان پیام سند اصلاحی را می‌دهد (رفتار قبلی حفظ) |   ✘ FAIL: خروجی CSV حسابدار: ptfFiscalCsv با BOM و بخش‌های کامل |   ✘ FAIL: CSV شامل پروژه‌ها + هزینه جاری + سند اصلاحی + سهامداران |   ✘ FAIL: RBAC: CSV و snapshot هر دو canFiscal دارند |   ✘ FAIL: CSV تولید شد با BOM و سود خالص
- tester113-v197.js: 35 PASS / 1 FAIL |   ✘ FAIL: UI پیام نقض توالی | === tester113-v197: 35 PASS / 1 FAIL ===
- tester114-v198.js: 18 PASS / 2 FAIL |   ✘ FAIL: audit با فهرست کلیدها |   ✘ FAIL: audit ثبت شد | === tester114-v198: 18 PASS / 2 FAIL ===
- tester119-v203.js: 13 PASS / 5 FAIL |   ✘ FAIL: کاربران عادی هاب نمی‌بینند |   ✘ FAIL: تب‌ها فقط display بخش‌ها را کنترل می‌کنند |   ✘ FAIL: تب هزینه جاری فقط opexBox را نشان می‌دهد |   ✘ FAIL: تب سهامداران فقط shareBox را نشان می‌دهد |   ✘ FAIL: تب تنخواه بخش‌های اصلی تنخواه را نشان می‌دهد
- tester120-v204.js: 13 PASS / 1 FAIL |   ✘ FAIL: تب کارت ویزیت در buildAi و tabs وجود دارد | === tester120-v204: 13 PASS / 1 FAIL ===
- tester122-v206.js: 14 PASS / 2 FAIL |   ✘ FAIL: دسترسی کامل petty فقط admin/chairman |   ✘ FAIL: برای سایر کاربران ثبت هزینه باز است | === tester122-v206: 14 PASS / 2 FAIL ===
- tester124-v21.js: 13 PASS / 12 FAIL |   ✘ FAIL: کش sw هنوز v20.7 (الگوی v1x) |   ✘ FAIL: genCode ساختار صحیح دارد (P-XXX-YYYY) |   ✘ FAIL: window.rawAdj موجود |   ✘ FAIL: window.rawAdj فارسی می‌خواند |   ✘ FAIL: window.rawAdj عربی می‌خواند
- tester132-v216.js: 15 PASS / 11 FAIL |   ✘ FAIL: basis collected default |   ✘ FAIL: ali base 400k in March (not April pay) |   ✘ FAIL: sara base 500k |   ✘ FAIL: ali pct 3 |   ✘ FAIL: ali commission 12000
- tester139-v258-llm.js: 13 PASS / 1 FAIL |   ✘ FAIL: settings header markup is structurally closed | === tester139-v258-llm: 13 PASS / 1 FAIL ===
- tester143-v262-supplier-finance.js: 13 PASS / 1 FAIL |   ✘ FAIL: payment/cheque scope is intentionally deferred from Sprint 262 | === tester143-v262-supplier-finance: 13 PASS / 1 FAIL ===
- tester145-v264-cheque-transfer.js: 10 PASS / 1 FAIL |   ✘ FAIL: daily dashboard excludes transferred cheque reminders | === tester145-v264-cheque-transfer: 10 PASS / 1 FAIL ===
- tester20-sprint83.js: 21 PASS / 1 FAIL |   ✘ FAIL: SW کش نسخه‌دار | === tester20-sprint83: 21 PASS / 1 FAIL ===
- tester209-v3301-petty-combined-pdf.js: 19 PASS / 2 FAIL |   ✘ FAIL: چیدمان ۳-در-صفحه: کلاس rcpt + ۳ تصویر + grid سه‌ستونه |   ✘ FAIL: تبدیل به JPEG: فراخوانی endpoint سرور (با mock fetch) | === tester209-v3301-petty-combined-pdf: 19 PASS / 2 FAIL ===
- tester215-v3305-cheque-module.js: 46 PASS / 1 FAIL |   ✘ FAIL: مبلغ به حروف + تاریخ به حروف + فونت‌ها + قرمز در ماژول چاپ | === tester215-v3305-cheque-module: 46 PASS / 1 FAIL ===
- tester254-advanced-cv-finalization-backlog-doc.js: 6 PASS / 2 FAIL |   ✘ FAIL: PTF-MASTER-HANDOVER نسخه v31.7.97 را ثبت کرده است |   ✘ FAIL: handover فایل‌ها و محدودیت‌های جدید را ثبت کرده است | === tester254-advanced-cv-finalization-backlog-doc: 6 PASS / 2 FAIL ===
- tester261-advanced-cv-gtm-sales-plan.js: 6 PASS / 1 FAIL |   ✘ FAIL: handover نسخه v31.7.97 را ثبت کرده است | === tester261-advanced-cv-gtm-sales-plan: 6 PASS / 1 FAIL ===
- tester262-control-valve-dedicated-seo-landing.js: 10 PASS / 1 FAIL |   ✘ FAIL: title/meta/canonical صفحه اختصاصی درست است | === tester262-control-valve-dedicated-seo-landing: 10 PASS / 1 FAIL ===
- tester275-fiscal-profit-and-minimal-icons.js: 13 PASS / 3 FAIL |   ✘ FAIL: dashboard مالی کارت تنخواه مستقل و label سود پس از هزینه‌ها دارد |   ✘ FAIL: Knowledge Center heading آیکون کتاب خطی دارد نه KC/emoji |   ✘ FAIL: clusterهای مرکز دانش icon key معنایی و SVG دارند، نه شماره | === tester275-fiscal-profit-and-minimal-icons: 13 PASS / 3 FAIL ===
- tester276-semantic-icons-fiscal-dark.js: 23 PASS / 2 FAIL |   ✘ FAIL: عنوان مرکز دانش آیکون کتاب SVG دارد، نه KC/emoji |   ✘ FAIL: renderer واقعی kcIcon SVG می‌سازد | === tester276-semantic-icons-fiscal-dark: 23 PASS / 2 FAIL ===
- tester291-hub-clean.js: 11 PASS / 1 FAIL |   ✘ FAIL: finHubOrder شامل opexBox/slLiquidity/همه باکس‌هاست | === tester291-hub-clean: 11 PASS / 1 FAIL ===
- tester35-sprint122.js: 20 PASS / 2 FAIL |   ✘ FAIL: سود خالص: فروش = دریافت ریالی واقعی |   ✘ FAIL: مانده وصول‌نشده در سود لحاظ نمی‌شود | === tester35-sprint122: 20 PASS / 2 FAIL ===
- tester40-v1225.js: 17 PASS / 4 FAIL |   ✘ FAIL: سلکتور فقط فرزند مستقیم (index.html) |   ✘ FAIL: متن سرگروه: 9px + ellipsis + سقف 46px (index) |   ✘ FAIL: سرگروه موبایل هم متغیر تم |   ✘ FAIL: رنگ متن سرگروه متغیر | === tester40-v1225: 17 PASS / 4 FAIL ===
- tester41-v1230.js: 20 PASS / 4 FAIL |   ✘ FAIL: ساعت و health-pill در موبایل مخفی |   ✘ FAIL: هدر فشرده بدون شکست ردیف (v31.7.19: مهار سرریز با min-width/ellipsis نه clip) |   ✘ FAIL: عنوان پنل ellipsis (سرریز ممنوع) |   ✘ FAIL: دسکتاپ دست‌نخورده (همه قواعد داخل @media) | === tester41-v1230: 20 PASS / 4 FAIL ===
- tester51-v131.js: 16 PASS / 2 FAIL |   ✘ FAIL: عنوان پنل «دستیار» یکدست شد |   ✘ FAIL: برای سایر نقش‌ها کشو ظاهر نمی‌شود | === tester51-v131: 16 PASS / 2 FAIL ===
- tester52-v132.js: 21 PASS / 1 FAIL |   ✘ FAIL: مسیر بدون فاکتور: دلیل + پیشنهاد دانلود + هشدار حذف | === tester52-v132: 21 PASS / 1 FAIL ===
- tester53-v133.js: 19 PASS / 1 FAIL |   ✘ FAIL: نظر دیگر کاربر: مانده باز می‌ماند (v19.4: بدون تیک، مطالبات باز و مختومه قفل) | === tester53-v133: 19 PASS / 1 FAIL ===
- tester54-v134.js: 22 PASS / 2 FAIL |   ✘ FAIL: سایدبار: درخواست تامین |   ✘ FAIL: rfqsmart: عنوان و دکمه | === tester54-v134: 22 PASS / 2 FAIL ===
- tester55-v135.js: 22 PASS / 1 FAIL |   ✘ FAIL: کلاینت: هوک notify اعلان‌های مهم (v13.8: گسترش به ارجاع/پرداخت/...) | === tester55-v135: 22 PASS / 1 FAIL ===
- tester57-v137.js: 24 PASS / 1 FAIL |   ✘ FAIL: فضای بالای مودال برای دکمه‌های مک+چیپ | === tester57-v137: 24 PASS / 1 FAIL ===
- tester58-v138.js: 10 PASS / 1 FAIL |   ✘ FAIL: پوشش کامل: چک/سیستم/ادمین/ارجاع/پرداخت/خرید/وضعیت/یادآور | === tester58-v138: 10 PASS / 1 FAIL ===
- tester59-v139.js: 23 PASS / 1 FAIL |   ✘ FAIL: در بک‌لاگ هندآور ثبت شده | === tester59-v139: 23 PASS / 1 FAIL ===
- tester60-v140.js: 18 PASS / 1 FAIL |   ✘ FAIL: همراه چرخه بک‌آپ (بدون polling جدید) | === tester60-v140: 18 PASS / 1 FAIL ===
- tester63-v143.js: 38 PASS / 2 FAIL |   ✘ FAIL: تبدیل →CO در هر وضعیت دیگر آزاد |   ✘ FAIL: دکمه فهرست: «+ ثبت درخواست جدید» | === tester63-v143: 38 PASS / 2 FAIL ===
- tester65-v145.js: 42 PASS / 1 FAIL |   ✘ FAIL: باکس «منطقه خطر» در تنظیمات فقط ادمین | === tester65-v145: 42 PASS / 1 FAIL ===
- tester66-v146.js: 39 PASS / 3 FAIL |   ✘ FAIL: ضدتکرار روزانه per درخواست |   ✘ FAIL: مهلت دور → خنثی (بدون bg) |   ✘ FAIL: هشدار عبور از سقف هنگام ذخیره (مانده + مبلغ جدید) | === tester66-v146: 39 PASS / 3 FAIL ===
- tester67-v147.js: 51 PASS / 1 FAIL |   ✘ FAIL: سرور: rejected در پاسخ گزارش می‌شود | === tester67-v147: 51 PASS / 1 FAIL ===
- tester68-v148.js: 48 PASS / 1 FAIL |   ✘ FAIL: هشدار تاخیر به مدیران + ضدتکرار روزانه | === tester68-v148: 48 PASS / 1 FAIL ===
- tester7-sprint70.js: 62 PASS / 1 FAIL |   ✘ FAIL: UI: دکمه فاکتور برای غیربرنده قفل | === TESTER-7 (Sprint70): 62 PASS / 1 FAIL ===
- tester70-v150.js: 35 PASS / 4 FAIL |   ✘ FAIL: سرور خالی (seed) و حالت به‌روز → bootstrapped فوری |   ✘ FAIL: آفلاین/خطا → قفل نمی‌ماند (کار محلی آزاد) |   ✘ FAIL: کلیدهای موفق پاک، کلیدهای متعارض dirty می‌مانند |   ✘ FAIL: بک‌آپ‌های چرخشی سالم دست نمی‌خورند (break قبل از hourly) | === tester70-v150: 35 PASS / 4 FAIL ===
- tester73-v153.js: 13 PASS / 1 FAIL |   ✘ FAIL: دکمه به تابع سراسری ptfXlsGuideGo با id درج‌شده وصل شد | === tester73-v153: 13 PASS / 1 FAIL ===
- tester8-sprint71.js: 60 PASS / 1 FAIL |   ✘ FAIL: htaccess: مسدودسازی json/log/txt | === TESTER-8 (Sprint71): 60 PASS / 1 FAIL ===
- tester81-v163.js: 25 PASS / 6 FAIL |   ✘ FAIL: نرخ‌های سنا برای راهنمای تسعیر حفظ شد |   ✘ FAIL: بخش خرید واقعی روی پرونده فروش (hook renderDeals — بدون دست‌کاری salesfiles) |   ✘ FAIL: ۶ منبع: یادآور/مهلت درخواست/تحویل تعهدی/چک/انقضای CO/سرنخ بی‌پیگیری |   ✘ FAIL: قرمزها اول + سقف ۳۰ |   ✘ FAIL: هر ۶ نوع آیتم جمع شد
- tester82-v164.js: 61 PASS / 4 FAIL |   ✘ FAIL: AC6: RBAC با display:none (نه offsetParent که آیتم گروه بسته را حذف می‌کرد) |   ✘ FAIL: پایان تور موبایل: کشو بسته می‌شود |   ✘ FAIL: bridge: اثرات جانبی در هسته حفظ شد (waiting/notify/سینک سایت) |   ✘ FAIL: اثر جانبی waiting=TO + notify کارتابل مثل مودال | === tester82-v164: 61 PASS / 4 FAIL ===
- tester83-v165.js: 55 PASS / 1 FAIL |   ✘ FAIL: rfqsFinalize: گارد استعلام تکراری srcRfq پابرجا | === tester83-v165: 55 PASS / 1 FAIL ===
- tester86-v168.js: 34 PASS / 1 FAIL |   ✘ FAIL: دو تب: پرونده‌ها (ابلاغ) + فرصت‌های فعال با شمارنده | === tester86-v168: 34 PASS / 1 FAIL ===
- tester89-v171.js: 28 PASS / 1 FAIL |   ✘ FAIL: کشو: بخش استعلام تامین با دکمه کارت رهگیری (rfqsOpen موجود) | === tester89-v171: 28 PASS / 1 FAIL ===
- tester9-sprint72.js: 46 PASS / 1 FAIL |   ✘ FAIL: تامین‌کننده: هندل 403 کپچا/otp | === TESTER-9 (Sprint72 Captcha/OTP): 46 PASS / 1 FAIL ===
- tester90-v172.js: 24 PASS / 3 FAIL |   ✘ FAIL: استعلام جدید فقط از سامانه استعلام تامین (ptfRealBuyNewInquiry) |   ✘ FAIL: میان‌بر: کارت رهگیری موجود یا ویزارد جدید rfqs |   ✘ FAIL: مسیر مستقل ماژول قیمت‌های خرید دست‌نخورده (دکمه‌های دور در حالت آزاد) | === tester90-v172: 24 PASS / 3 FAIL ===
- tester95-v177.js: 23 PASS / 1 FAIL |   ✘ FAIL: کلیدهای بک‌آپ قبلی حفظ | === tester95-v177: 23 PASS / 1 FAIL ===
- tester96-v178.js: 28 PASS / 1 FAIL |   ✘ FAIL: هزینه کاربران = مطالبه در انتظار تسویه | === tester96-v178: 28 PASS / 1 FAIL ===
- tester97-v179.js: 22 PASS / 5 FAIL |   ✘ FAIL: RBAC محرمانه فقط admin/chairman |   ✘ FAIL: حقوق موظف → sharetx salary + opex حقوق و دستمزد با shareTx |   ✘ FAIL: مانده کارت = credit + petty - debit |   ✘ FAIL: مانده = حقوق ۵۰م + تنخواه ۲م − برداشت ۱۰م = ۴۲م |   ✘ FAIL: CEO به‌صورت پیش‌فرض به ماژول محرمانه سهامداران دسترسی ندارد

## Timeout بدون DONE سبز

- (هیچ)

## نکات خروج غیرصفر با DONE سبز (interval باز)

- tester282-dummy.js: placeholder (empty output) exit 0
- tester283-dummy.js: placeholder (empty output) exit 0
- tester284-dummy.js: placeholder (empty output) exit 0
- tester285-dummy.js: placeholder (empty output) exit 0
- tester286-dummy.js: placeholder (empty output) exit 0

## مقایسه با baseline و نتیجه‌گیری

⚠️ **بدهی تاریخی سوئیت کامل پابرجاست؛ نسبت به baseline v34.6.1 شکست جدیدی ایجاد نشده است. گیت متمرکز ریلیز مستقل و سبز است.**

## تعهد بعدی

گیت متمرکز v34.7.0 (`run-ci-gate.js`) باید 24/24 سبز بماند؛ 58 فایل FAIL سوئیت کامل همان baseline ثبت‌شده v34.6.1 هستند و جداگانه باید نوسازی شوند.