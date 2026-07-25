# سند جامع انتقال پروژه و نقشه راه معماری (AI Agent Handover Master Plan v32.0)
**نام وب‌سایت:** شرکت پیشرو تجهیز فرتاک — pishtaj.ir  
**تاریخ به‌روزرسانی سند:** ۱۲ تیر ۱۴۰۵ (July 2026)  
**وضعیت فعلی:** جایگزینی لوگوهای واقعی برندها — اسپرینت ۳۲ تکمیل

---

## ۱. هویت، جایگاه و معماری فنی وب‌سایت (Project Baseline)

### ماهیت کسب‌وکار:
پیشرو تجهیز فرتاک (PTF) یک **تامین‌کننده پروژه‌ای B2B** در حوزه صنایع نفت، گاز، پتروشیمی، فولاد و نیروگاهی است. تمرکز سایت بر دریافت استعلام فنی و مالی (RFQ) و مدیریت زنجیره تامین است.

### معماری فنی وب‌سایت:
- **تکنولوژی:** کدنویسی اختصاصی (HTML5, CSS3, ES6 JS) و بک‌اند PHP سبک
- **سیستم طراحی:** رنگ `--red: #ef4b1a` و `--orange: #f79400`، فونت **وزیرمتن (Vazirmatn)**

---

## ۲. دستاوردهای اسپرینت ۳۲ (جایگزینی لوگوهای واقعی برندها)

### ۴۳ لوگوی واقعی برندها جایگزین شد

منابع لوگو:
- **۲۶ لوگوی SVG** از منابع معتبر (Wikimedia Commons, Simple Icons, Freebiesupply, Logotyp.us)
- **۲۴ لوگوی PNG** ارسالی کارفرما (پس از بهینه‌سازی و حذف پس‌زمینه)
- برندهای فاقد لوگوی رسمی از لیست حذف شدند

### لیست کامل برندهای دارای لوگوی واقعی

#### 🏭 لوله و پایپینگ (۸)
| برند | منبع | نوع |
|------|------|:---:|
| Sumitomo | ارسالی کارفرما | PNG |
| Tenaris | Wikimedia Commons | SVG |
| ArcelorMittal | Logotyp.us | SVG |
| Vallourec | Wikimedia Commons | SVG |
| Nippon Steel | Logotyp.us | SVG |
| TMK | Wikimedia Commons | PNG |
| JFE Steel | Wikimedia Commons | SVG |
| Sandvik | Freebiesupply | SVG |

#### 🔧 ولو، فلنج و فیتینگ (۱۰)
| برند | منبع | نوع |
|------|------|:---:|
| Melesi | ارسالی کارفرما | PNG |
| Galperti | ارسالی کارفرما | PNG |
| KITZ | ارسالی کارفرما | PNG |
| Neway | ارسالی کارفرما | PNG |
| OMB | ارسالی کارفرما | PNG |
| Douglas Chero | ارسالی کارفرما | PNG |
| Bonney Forge | ارسالی کارفرما | PNG |
| Velan | ارسالی کارفرما | PNG |
| Crane | Wikimedia Commons | SVG |
| Spirax Sarco | Wikimedia Commons | SVG |

#### ⚡ برق صنعتی (۱۰)
Siemens, Schneider Electric, ABB, Omron, Phoenix Contact, Weidmüller, Eaton, Legrand, LS Electric, Rittal

#### 📊 ابزار دقیق (۱۰)
Emerson, Rosemount, Endress+Hauser, Yokogawa, Honeywell, WIKA, KROHNE, VEGA, Fisher, Samson

#### 🔩 گسکت و متعلقات (۵)
Flexitallic, Klinger, Garlock, Teadit, Spetech

#### 🏢 پیمانکاران و صنایع هدف — مارکویی (۸)
جندی شاپور, Petropars, پناه صنعت, مپنا, پتروشیمی جم, پتروشیمی مارون, پتروشیمی پردیس, هلدینگ خلیج فارس

---

## ۳. دستورالعمل شروع کار برای هوش مصنوعی بعدی

1. معماری سایت اختصاصی (غیر وردپرسی)، پالت رنگی `#ef4b1a`
2. لوگوهای برندها در: `assets/images/brands/` با فرمت SVG یا PNG
3. برندهای دارای SVG: کیفیت برداری و بینهایت
4. برندهای دارای PNG: رزولوشن ۳۰۰ پیکسل عرض، پس‌زمینه شفاف
5. پیشنهاد اسپرینت ۳۳: بهینه‌سازی سرعت (Lazy Loading، Core Web Vitals)

---

## ۴. برندهای حذف‌شده (فاقد لوگوی رسمی)

- FAD, JC Valves (ولو)
- Leader Gasket, Chesterton, James Walker (گسکت)
- جهان پارس, OIEC, پتروشیمی نوری, پتروشیمی بندر امام (مارکویی)
