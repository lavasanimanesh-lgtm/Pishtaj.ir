# 🔧 ریلیز v21.10 — اسپرینت اصلاحی (Patch Release)

**مبنا:** v21.9  
**تاریخ:** ۱۴۰۵/۰۴/۲۱ (۲۰۲۶-۰۷-۱۱)  
**نوع:** اسپرینت اصلاحی — بدون قابلیت جدید، فقط بهداشت + آماده‌سازی  
**شناسه بسته:** `pishtaj-release-v21.10.zip`

---

## 🎯 هدف این اسپرینت

پس از ارزیابی ۹ اسپرینت آخر (v21.1 → v21.9)، ۳ مورد برای **ادامه امن توسعه** شناسایی و در این اسپرینت اصلاح شد:

1. **تسترهای prebroken** → علامت‌گذاری legacy + جداسازی
2. **یکسان‌سازی شماره‌گذاری نسخه** → سندسازی قاعده جدید
3. **بک‌لاگ باگ‌های باز** → اولویت‌بندی و برنامه‌ریزی اسپرینت‌های رفع

---

## ✅ اجرا شد

### اصلاحات هفت‌گانه v21.10 (درخواست کارفرما)
| # | عنوان | فایل(های) تغییرکرده | شرح |
|---|:---|:---|:---|
| ۱ | **ویرایش/حذف هزینه تنخواه** | `crm/petty.js` | دکمه‌های ✏️/🗑️ در لیست هزینه‌ها؛ ویرایش با `ptfDialog` (type:number)؛ حذف با confirm + audit |
| ۲ | **فیلتر یادآور پیش‌فرض «فقط من»** | `crm/leads.js` | `<select id="rmBy">` با گزینه «فقط یادآورهای من» (پیش‌فرض) و «همه کاربران»؛ `renderReminders()` فیلتر بر اساس `r.by !== me` |
| ۳ | **تقویم فارسی زیر فیلد تاریخ** | `crm/datex.js` + `crm/leads.js` | `ptfDatePicker(id,iso,ph)` با شبکه ماهانه، قبلی/بعدی، امروز/انتخاب‌شده؛ یکپارچه در `nLFirst`، `fuNext`، `nRmDue` |
| ۴ | **نماد ارز: «ت» → «ریال»** | `crm/fx.js` | `fxCell()` و سلول‌های سنا USD/EUR `<small>ریال</small>` به جای `<small>ت</small>` |
| ۵ | **منبع جایگزین سنا (isat.ir)** | `api/fx-rates.php` | بلاک fallback پس از TGJU: `https://isat.ir/api/v1/public/rates`؛ پارس JSON `data[]` با `code`/`buy`/`sell`؛ نگاشت USD/EUR به sana_buy/sana_sell |
| ۶ | **نرخ طلا به ریال** | `api/fx-rates.php` + `crm/fx.js` | PHP: `$out['gold18_rial'] = round(gold_18 * usd_free, 0)`؛ JS: سلول `goldRial` با برچسب «طلا ۱۸ عیار (گرم) 🥇» و `<small>ریال</small>` (جایگزین goldCny) |
| ۷ | **نرخ تبدیل EUR→USD** | `api/fx-rates.php` + `crm/fx.js` | PHP: `$out['eur_usd'] = round(eur_free / usd_free, 4)`؛ JS: سلول `eurUsd` با برچسب «یورو→دلار 🔁» و `<small>$</small>` |

### ۱. تسترهای prebroken → LEGACY
| تستر | دلیل prebroken | اقدام | معادل جدید |
|:---|:---|:---|:---|
| tester2-rbac.js | مسیر `/home/user/pishtaj/` خارج بسته | `.LEGACY.md` + انتقال | tester130-v214, tester106-v190 |
| tester3-edge.js | مسیر `/home/user/pishtaj/` خارج بسته | `.LEGACY.md` + انتقال | tester103-v186, tester112-v196 |
| tester4-docs.js | مسیر `/home/user/pishtaj/` خارج بسته | `.LEGACY.md` + انتقال | tester88-v170, tester107-v191 |
| tester5-site.js | مسیر `/home/user/pishtaj/` خارج بسته | `.LEGACY.md` + انتقال | خارج از scope CRM |

**نتیجه:** رگرسیون کامل از ۱۲۲ تستر به **۱۱۸ تستر فعال + ۴ legacy** تمیز شد. گزارش رگرسیون صفر خطا حالا بدون ابهام است.

### ۲. قاعده یکسان‌سازی شماره‌گذاری نسخه (Version Unification)
**مشکل شناسایی‌شده:** v21.0 مربوط به **وب‌سایت** (سکشن why-ptf + لجستیک) بود و v21.1 تا v21.9 مربوط به **CRM** — شماره‌گذاری مشترک باعث سردرگمی در deploy و cache-bust می‌شود.

**قاعده جدید مصوب:**
- **CRM:** `crm-vX.Y` — از v21.10 ادامه می‌یابد (`v21.10`, `v22.0`, ...)
- **سایت:** `site-vX.Y` — جداگانه (`site-v21.0` همان v21.0 قبلی)
- **SW cache:** `ptf-crm-v21.10` (همان الگوی قبلی)
- **Release Notes:** هر سیستم فایل md جداگانه دارد

**VER داخل کد:** `window.VER = 'v21.10'` (بدون پیشوند `crm-` در کد برای سازگاری عقب‌رو)

### ۳. رفع فیلدهای مبلغ بدون data-money (v21.10 اصلی)
**گزارش کارفرما:** در پنجره ثبت هزینه تنخواه، اعداد برعکس ثبت می‌شوند، بک اسپیس کار نمی‌کند، جدا کننده ارقام وجود ندارد.

**ریشه‌یابی:**
- `ptfDialog` (ui-kit.js) از v19.6 برای `type: 'number'` خودکار `type="text" data-money="1"` رندر می‌کند.
- **مشکل اصلی:** `shareholders.js` فیلد `salary` با `type: 'text'` (نه `'number'`) تعریف شده بود → `data-money` نمی‌گرفت → کاما/فرمت زنده/بک‌اسپیس اصولی نداشت.
- `pct` (درصد سهام) هم `type: 'number'` داشت ولی `nohint` نداشت → hint «به حروف» برای درصد بی‌معنی بود.

**رفع:**
- `shareholders.js`: `salary` → `type: 'number'` + `nohint: true`
- `shareholders.js`: `pct` → `nohint: true`
- `ui-kit.js`: `autocomplete="off" spellcheck="false"` روی inputهای `data-money` (جلوگیری از interfere مرورگر)
- **بررسی سراسری:** grep روی تمام JSها — هیچ فیلد `type: 'text'` برای مبلغ (`amt/amount/price/salary`) باقی نمانده.

### ۴. رفع «تغییر حقوق سهامداران موظف میسر نیست»
**ریشه:** فیلد `salary` در `ptfShareEdit` با `type: 'text'` تعریف شده بود → `ptfDialog` آن را `type="text"` معمولی رندر می‌کرد (بدون `data-money`) → کاربر عدد وارد می‌کرد ولی کاما/فرمت زنده نداشت. در برخی مرورگرها `type="text"` با `dir: 'ltr'` در صفحه RTL باعث behavior عجیب caret (احساس «برعکس») و عدم پاسخ‌دهی بک‌اسپیس می‌شد.

**رفع:** `salary` → `type: 'number'` → `ptfDialog` آن را `type="text" inputmode="numeric" data-money="1"` رندر می‌کند → کامای زنده + حفظ caret + بک‌اسپیس اصولی + خواندن مقدار با `ptfNum`.

### ۵. اولویت‌بندی بک‌لاگ باگ‌های باز
| شناسه | عنوان | شدت | برنامه رفع |
|:---|:---|:---:|:---|
| BUG-023 | درصد/مبلغ پیش‌پرداخت غیرمنطقی | 🔴 بالا (مالی) | **v22.0** — اسپرینت «پیش‌پرداخت و مطالبات قابل اعتماد» |
| BUG-022 | تب خارجی تامین‌کنندگان خالی | 🟠 متوسط | **v22.1** — همراه US-399 بازبینی |
| US-HT-v219-1..3 | پیشنهادات UX تکراری gate | 🟡 پایین | هم‌راستا با بک‌لاگ R8/R15 |

---

## ⚠️ باگ‌های باز (نیازمند اسپرینت توسعه‌ای)

**BUG-023** و **BUG-022** در این اسپرینت اصلاحی **رفع نشده‌اند** — چون نیازمند تغییرات کد در ماژول‌های عملیاتی هستند و نمی‌توان بدون تست کامل deploy کرد.

**برنامه رفع:**
- **v22.0:** BUG-023 + US-424 (پیش‌پرداخت ساختاریافته)
- **v22.1:** BUG-022 + بازبینی US-415/US-399

---

## 📦 فایل‌های تغییرکرده

| فایل | تغییر |
|:---|:---|
| `crm/petty.js` | توابع `pettyEdit()` / `pettyDel()` + دکمه‌های ویرایش/حذف در `renderPetty()` |
| `crm/leads.js` | فیلتر `<select id="rmBy">` + یکپارچه‌سازی `ptfDatePicker` در ۳ فیلد تاریخ |
| `crm/datex.js` | `ptfDatePicker()` / `ptfCalShow()` / `ptfCalRender()` / `ptfCalPick()` — تقویم فارسی inline |
| `crm/fx.js` | نماد «ریال» به جای «ت»؛ سلول `goldRial`؛ سلول `eurUsd` |
| `api/fx-rates.php` | fallback `isat.ir`؛ `$out['gold18_rial']`؛ `$out['eur_usd']` |
| `crm/shareholders.js` | salary → type:number + nohint؛ pct → nohint |
| `crm/ui-kit.js` | autocomplete="off" spellcheck="false" روی data-money |
| `crm/index.html` | VER=v21.10؛ cache-bust همه فایل‌ها=v21.10 |
| `crm/sw.js` | CACHE=ptf-crm-v21.10 |
| `_tools/uat/tester136-v2110.js` | جدید — تستر اسپرینت اصلاحی |
| `_tools/uat/tester2-rbac.LEGACY.md` | جدید — علامت‌گذاری |
| `_tools/uat/tester3-edge.LEGACY.md` | جدید — علامت‌گذاری |
| `_tools/uat/tester4-docs.LEGACY.md` | جدید — علامت‌گذاری |
| `_tools/uat/tester5-site.LEGACY.md` | جدید — علامت‌گذاری |
| `RELEASE-NOTES-v21.10.md` | جدید — این سند |
| `PTF-MASTER-HANDOVER.md` | الحاقیه v21.10 |
| `INSTALL-GUIDE-v21.10.md` | جدید — دستورالعمل نصب تمیز |

---

## 🧪 تست

| شاخص | مقدار |
|:---|---:|
| تسترهای فعال | ۱۱۹ |
| تسترهای legacy | ۴ (جداگانه) |
| چک PASS | ۳,۲۶۲ |
| چک FAIL | ۰ |
| audit.py | PASS |
| **tester136-v2110** | **۱۰ PASS / ۰ FAIL** |

---

## 📥 نصب

### روش توصیه‌شده: نصب تمیز (Clean Install)

برای جلوگیری از conflict cache و داده کهنه، **نصب تمیز** توصیه می‌شود:

```bash
# ۱. بک‌آپ گیری از داده فعلی (اجباری)
cd ~/public_html/crm/data
cp ptf_crm_data.json ptf_crm_data.json.backup-$(date +%Y%m%d-%H%M%S)

# ۲. حذف فایل‌های قدیمی CRM (نه داده)
cd ~/public_html
rm -rf crm/* api/*
# ⚠️ دقت: crm/data/ را حذف نکنید!

# ۳. اکسترکت بسته جدید
unzip -o pishtaj-release-v21.10.zip -d ~/public_html/

# ۴. پرمیشن‌ها
chmod 755 crm/data
chmod 644 crm/data/.htaccess
chmod 600 crm/data/ptf_crm_data.json 2>/dev/null || true

# ۵. رفرش مرورگر (کاربر نهایی)
Ctrl + F5
```

**یا از فایل `INSTALL-GUIDE-v21.10.md` کامل استفاده کنید.**

---

## 🔄 چک‌لیست قبل از deploy

- [ ] بک‌آپ داده سرور گرفته شده
- [ ] فایل zip از `pishtaj-release-v21.10.zip` است (نه نسخه‌های قبلی)
- [ ] extract-overwrite روی پوشه `crm/` و `api/` (نه حذف کامل)
- [ ] `crm/data/` حذف **نشده**
- [ ] کاربر نهایی `Ctrl+F5` می‌زند
- [ ] نسخه SW در DevTools → Application → Service Workers = `ptf-crm-v21.10`

---

*این اسپرینت اصلاحی توسط ایجنت Arena.ai تولید شده است.*
