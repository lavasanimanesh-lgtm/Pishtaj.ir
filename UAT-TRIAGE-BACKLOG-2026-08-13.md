# بک‌لاگ تریاژ سوئیت UAT — باقیمانده (2026-08-13، به‌روزشده)

**مبنا:** اجرای کامل `node _tools/run-full-regression.js` — 385 تستر: 290 سبز / 95 قرمز / ۰ کرش
**روش پردازش (هر ردیف):** اجرای تستر → مقایسه با ماژول متناظر → یکی از: (الف) به‌روزرسانی قرارداد، (ب) آرشیو با یادداشت، (ج) فیکس محصول.
**اولویت:** ردیف‌های غیرتاریخی (v3x) اول — احتمال فیکس محصول واقعی بیشتر است.

| تستر | شکست | خلاصهٔ شکست | تاریخی؟ |
|---|---|---|---|
| tester191-stock-rename.js | 2 | عنوان پنل و breadcrumb  | هدر ماژول و دکمه ثبت  | خیر |
| tester196-parallel-offers.js | 1 | فهرست TO: دکمه «+CO گزینه ۲» به‌جای قفل مرده  | خیر |
| tester203-myday-dedup.js | 1 | فقط اعلان actionable مستقیم کاربر به روز من افزوده می‌شود  | خیر |
| tester203-v3300-finance-hub-toolbar.js | 1 | دکمه‌های پرداخت مستقیم/شارژ/ارجاع دوره داخل همان تولبار هستند  | خیر |
| tester208-v3301-petty-period-report.js | 1 | دکمه‌های گزارش در renderPeriods (بازه/ماه) و تولبار هست  | خیر |
| tester209-v3301-petty-combined-pdf.js | 2 | چیدمان ۳-در-صفحه: کلاس rcpt + ۳ تصویر + grid سه‌ستونه  | تبدیل به JPEG: فراخوانی endpoint سرور (با mock fetch)  | خیر |
| tester212-v3304-petty-period-range.js | 2 | هزینهٔ مستقیم: «پرداخت مستقیم از تنخواه» دارد  | files با ids دوره فقط رسید همان دوره را برمی‌گرداند (PTY-2)  | خیر |
| tester215-duplicate-growth-myday-dismiss.js | 1 | ptfSmartMerge برای RFQ/Offer دیگر no-collapse نیست و canonical merge می‌کند  | خیر |
| tester215-v3305-cheque-module.js | 1 | مبلغ به حروف + تاریخ به حروف + فونت‌ها + قرمز در ماژول چاپ  | خیر |
| tester254-advanced-cv-finalization-backlog-doc.js | 2 | PTF-MASTER-HANDOVER نسخه v31.7.97 را ثبت کرده است  | handover فایل‌ها و محدودیت‌های جدید را ثبت کرده است  | خیر |
| tester261-advanced-cv-gtm-sales-plan.js | 1 | handover نسخه v31.7.97 را ثبت کرده است  | خیر |
| tester262-control-valve-dedicated-seo-landing.js | 1 | title/meta/canonical صفحه اختصاصی درست است  | خیر |
| tester272-offer-duplicate-items-settings-accordion.js | 1 | settings-accordion.js وجود دارد و نسخه/قرارداد جدید دارد  | خیر |
| tester275-fiscal-profit-and-minimal-icons.js | 3 | dashboard مالی کارت تنخواه مستقل و label سود پس از هزینه‌ها دارد  | Knowledge Center heading آیکون کتاب خطی دارد نه KC/emoji  | clusterهای مرکز دانش icon key مع | خیر |
| tester276-semantic-icons-fiscal-dark.js | 2 | عنوان مرکز دانش آیکون کتاب SVG دارد، نه KC/emoji  | renderer واقعی kcIcon SVG می‌سازد  | خیر |
| tester280-settings-semantic-icons.js | 1 | financial offers always show health check  | خیر |
| tester291-hub-clean.js | 1 | finHubOrder شامل opexBox/slLiquidity/همه باکس‌هاست  | خیر |
| tester300-delta-poll.js | 2 | krevs برای هر دو پول عادی و forceFull ارسال می‌شود (v34.5.2: کلیدهای تازه دوباره دانلود نمی‌شوند)  | نسخهٔ فعلی همگام: index.html + sw.js + clear-cache.html + ن | خیر |
| tester300-v34.0.4-alpha-phase1-fixes.js | 3 | VERSION.json/index.html/sw.js هم‌نسخه نسخهٔ جاری هستند  | دکمهٔ وصول و تابع هم‌نام‌اند  | مسیر نسبی ../api درست شد  | خیر |
| tester301-v34.0.5-alpha-fiscal-phase2.js | 2 | lockstep نسخهٔ جاری  | سلکتور سال (بدون input دستی سال)  | خیر |
| tester302-v34.0.6-alpha-deploy-hygiene.js | 0 |  | خیر |
| tester307-v34.0.11-alpha-quality-links.js | 1 | action اصلاح فاکتور خرید (slInvoiceEdit) در qualityRefsHtml هست  | خیر |
| tester316-v34.4.12-opex-attachments.js | 1 | پیوست هزینهٔ لینک‌شده به پرونده در costEvent هم کپی می‌شود  | خیر |
| tester329-v34.4.35-staging-rca.js | 0 |  | خیر |
| tester330-v34.4.36-inline-attachment-view.js | 0 |  | خیر |
| tester332-v34.4.38-supplier-ledger-attachment-persistence.js | 0 | : exit 1 | خیر |
| tester335-v34.4.41-semantic-pdf-default-filenames.js | 0 |  | خیر |
| tester337-v34.4.43-supplier-rfq-search-duplicate-guard.js | 0 | xit 1 | خیر |
| tester338-v34.4.44-inline-pdf-single-ledger-rfq-card.js | 0 | t 1 | خیر |
| tester339-v34.4.45-rfq-card-metadata-without-item-preview.js | 0 | : exit 1 | خیر |
| tester34-claims.js | 1 | US-110/111: دکمه‌ها در پرونده وصل شدند (توابع مرده بودند)  | خیر |
| tester344-v34.4.50-dark-module-css.js | 0 |  | خیر |
| tester348-v34.4.54-finance-workflow-p0p2.js | 0 |  | خیر |
| tester349-v34.4.55-finance-workflow-p3.js | 0 |  | خیر |
| tester350-v34.4.56-finance-workflow-p4.js | 0 |  | خیر |
| tester351-v34.4.57-finance-workflow-p5.js | 0 |  | خیر |
| tester352-v34.4.58-finance-workflow-p6.js | 0 |  | خیر |
| tester353-v34.4.59-finance-workflow-p7.js | 0 |  | خیر |
| tester354-v34.4.60-finance-workflow-p8.js | 0 |  | خیر |
| tester355-v34.4.61-petty-report-sort-files.js | 0 |  | خیر |
| tester356-v34.4.62-petty-pdf-treasury.js | 0 |  | خیر |
| tester372-v34.4.78-rfq-view-salesfile.js | 0 |  | خیر |
| tester387-v34.4.94-rfq-no-offer-filter.js | 0 |  | خیر |
| tester398-v34.5.7-migrate-prod-lock.js | 0 |  | خیر |
| tester5-site.js | 1 | SW ثبت می‌شود (shell.js)  | خیر |
| tester6-bridge.js | 3 | اعلان «منتظر صدور پیشنهاد فنی» ارسال شد  | اعلان به نقش‌های فروش رفت  | اعلان عمومی به نقش‌های فروش (غیرهایلایت)  | خیر |
| tester100-v182.js | 1 | وصول پیش‌پرداخت paid می‌شود  | بله |
| tester103-v186.js | 1 | باکس پرونده فروش پیش‌پرداخت/هزینه/استعلام مجدد را نشان می‌دهد  | بله |
| tester104-v187.js | 1 | بستانکاری تامین‌کننده dueISO/dueNote دریافت می‌کند  | بله |
| tester105-v189.js | 2 | رندر پیشنهاد برنده read-only و پرونده فروش نشان می‌دهد  | دکمه فاکتور در پیشنهاد برنده به پرونده هدایت می‌شود نه refToInvoice  | بله |
| tester106-v190.js | 1 | fiscal فقط admin/chairman (محرمانگی R9)  | بله |
| tester107-v191.js | 3 | دکمه 🔬 فقط برای پرونده برنده  | برچسب Post-Award: عملیات فقط از داخل پرونده (US-434)  | عدم انطباق → notify مدیران با kind=warn  | بله |
| tester109-v193.js | 2 | دکمه در کشو: باز پس از مرحله ۷، قفل 🔒 قبل از آن، بج پس از ارجاع  | US-434ف۲ ارسال/تحویل (v19.2) پابرجا  | بله |
| tester110-v194.js | 2 | AC1: مطالبات باز = بدون تیک تسویه، مختومه ممنوع  | US-435/436 (v19.3) پابرجا  | بله |
| tester111-v195.js | 5 | قفل مجدد همان پیام سند اصلاحی را می‌دهد (رفتار قبلی حفظ)  | خروجی CSV حسابدار: ptfFiscalCsv با BOM و بخش‌های کامل  | CSV شامل پروژه‌ها + هزینه جاری + سند اصلاحی | بله |
| tester113-v197.js | 1 | UI پیام نقض توالی  | بله |
| tester114-v198.js | 2 | audit با فهرست کلیدها  | audit ثبت شد  | بله |
| tester119-v203.js | 5 | کاربران عادی هاب نمی‌بینند  | تب‌ها فقط display بخش‌ها را کنترل می‌کنند  | تب هزینه جاری فقط opexBox را نشان می‌دهد  | تب سهامداران فقط shareBox را نشان می‌دهد  | بله |
| tester120-v204.js | 1 | تب کارت ویزیت در buildAi و tabs وجود دارد  | بله |
| tester122-v206.js | 2 | دسترسی کامل petty فقط admin/chairman  | برای سایر کاربران ثبت هزینه باز است  | بله |
| tester124-v21.js | 5 | کش sw هنوز v20.7 (الگوی v1x)  | genCode ساختار صحیح دارد (P-XXX-YYYY)  | window.rawAdj موجود  | window.rawAdj فارسی می‌خواند  | بله |
| tester139-v258-llm.js | 1 | settings header markup is structurally closed  | بله |
| tester143-v262-supplier-finance.js | 1 | payment/cheque scope is intentionally deferred from Sprint 262  | بله |
| tester145-v264-cheque-transfer.js | 1 | daily dashboard excludes transferred cheque reminders  | بله |
| tester20-sprint83.js | 1 | SW کش نسخه‌دار  | بله |
| tester35-sprint122.js | 2 | سود خالص: فروش = دریافت ریالی واقعی  | مانده وصول‌نشده در سود لحاظ نمی‌شود  | بله |
| tester40-v1225.js | 4 | سلکتور فقط فرزند مستقیم (index.html)  | متن سرگروه: 9px + ellipsis + سقف 46px (index)  | سرگروه موبایل هم متغیر تم  | رنگ متن سرگروه متغیر  | بله |
| tester41-v1230.js | 4 | ساعت و health-pill در موبایل مخفی  | هدر فشرده بدون شکست ردیف (v31.7.19: مهار سرریز با min-width/ellipsis نه clip)  | عنوان پنل ellipsis (سرریز ممنوع)  | دسکتاپ | بله |
| tester51-v131.js | 2 | عنوان پنل «دستیار» یکدست شد  | برای سایر نقش‌ها کشو ظاهر نمی‌شود  | بله |
| tester52-v132.js | 1 | مسیر بدون فاکتور: دلیل + پیشنهاد دانلود + هشدار حذف  | بله |
| tester53-v133.js | 1 | نظر دیگر کاربر: مانده باز می‌ماند (v19.4: بدون تیک، مطالبات باز و مختومه قفل)  | بله |
| tester54-v134.js | 2 | سایدبار: درخواست تامین  | rfqsmart: عنوان و دکمه  | بله |
| tester55-v135.js | 1 | کلاینت: هوک notify اعلان‌های مهم (v13.8: گسترش به ارجاع/پرداخت/...)  | بله |
| tester57-v137.js | 1 | فضای بالای مودال برای دکمه‌های مک+چیپ  | بله |
| tester58-v138.js | 1 | پوشش کامل: چک/سیستم/ادمین/ارجاع/پرداخت/خرید/وضعیت/یادآور  | بله |
| tester59-v139.js | 1 | در بک‌لاگ هندآور ثبت شده  | بله |
| tester60-v140.js | 1 | همراه چرخه بک‌آپ (بدون polling جدید)  | بله |
| tester63-v143.js | 2 | تبدیل →CO در هر وضعیت دیگر آزاد  | دکمه فهرست: «+ ثبت درخواست جدید»  | بله |
| tester65-v145.js | 1 | باکس «منطقه خطر» در تنظیمات فقط ادمین  | بله |
| tester66-v146.js | 3 | ضدتکرار روزانه per درخواست  | مهلت دور → خنثی (بدون bg)  | هشدار عبور از سقف هنگام ذخیره (مانده + مبلغ جدید)  | بله |
| tester68-v148.js | 1 | هشدار تاخیر به مدیران + ضدتکرار روزانه  | بله |
| tester7-sprint70.js | 1 | UI: دکمه فاکتور برای غیربرنده قفل  | بله |
| tester70-v150.js | 3 | سرور خالی (seed) و حالت به‌روز → bootstrapped فوری  | آفلاین/خطا → قفل نمی‌ماند (کار محلی آزاد)  | بک‌آپ‌های چرخشی سالم دست نمی‌خورند (break قبل از hourly)  | بله |
| tester73-v153.js | 1 | دکمه به تابع سراسری ptfXlsGuideGo با id درج‌شده وصل شد  | بله |
| tester8-sprint71.js | 1 | htaccess: مسدودسازی json/log/txt  | بله |
| tester81-v163.js | 5 | نرخ‌های سنا برای راهنمای تسعیر حفظ شد  | بخش خرید واقعی روی پرونده فروش (hook renderDeals — بدون دست‌کاری salesfiles)  | ۶ منبع: یادآور/مهلت درخواست/تحویل تعهدی | بله |
| tester82-v164.js | 4 | AC6: RBAC با display:none (نه offsetParent که آیتم گروه بسته را حذف می‌کرد)  | پایان تور موبایل: کشو بسته می‌شود  | bridge: اثرات جانبی در هسته حفظ شد (waiting/ | بله |
| tester83-v165.js | 1 | rfqsFinalize: گارد استعلام تکراری srcRfq پابرجا  | بله |
| tester86-v168.js | 1 | دو تب: پرونده‌ها (ابلاغ) + فرصت‌های فعال با شمارنده  | بله |
| tester89-v171.js | 1 | کشو: بخش استعلام تامین با دکمه کارت رهگیری (rfqsOpen موجود)  | بله |
| tester9-sprint72.js | 1 | تامین‌کننده: هندل 403 کپچا/otp  | بله |
| tester90-v172.js | 3 | استعلام جدید فقط از سامانه استعلام تامین (ptfRealBuyNewInquiry)  | میان‌بر: کارت رهگیری موجود یا ویزارد جدید rfqs  | مسیر مستقل ماژول قیمت‌های خرید دست‌نخورده ( | بله |
| tester95-v177.js | 1 | کلیدهای بک‌آپ قبلی حفظ  | بله |
| tester96-v178.js | 1 | هزینه کاربران = مطالبه در انتظار تسویه  | بله |
| tester97-v179.js | 5 | RBAC محرمانه فقط admin/chairman  | حقوق موظف → sharetx salary + opex حقوق و دستمزد با shareTx  | مانده کارت = credit + petty - debit  | مانده = حقوق ۵۰م + تنخوا | بله |
