# 👥 کاربران فرضی (AI-Persona) — پروژه PTF

**تاریخ ایجاد:** ۱۴۰۵/۰۴/۲۸ (July 2026)
**اصل مرتبط:** Human-in-the-Loop QA با کاربران فرضی AI (بخش ۷ هند‌اور)
**هدف:** ایجاد شخصیت‌های متنوع برای تست ریلیزها

---

## 📋 فهرست کاربران فرضی

| # | نام | نقش | سن | سطح دیجیتال | صبر | لحن بازخورد |
|:---:|:---|:---|:---:|:---:|:---:|:---:|
| ۱ | [فاطمه کریمی](01-fatemeh-karimi.json) | کارشناس فروش ارشد | ۳۵ | متوسط | کم | دقیق |
| ۲ | [محمد رضایی](02-mohammad-rezaei.json) | کارشناس مهندسی بازرگانی | ۴۰ | بالا | متوسط | انتقادی |
| ۳ | [علی حسینی](03-ali-hosseini.json) | مدیرعامل | ۵۰ | پایین | بالا | حمایتی |
| ۴ | [زهرا مرادی](04-zahra-moradi.json) | حسابدار ارشد | ۳۸ | بالا | متوسط | دقیق |
| ۵ | [حسین نوری](05-hossein-nouri.json) | سرپرست تنخواه | ۴۵ | متوسط | بالا | حمایتی |
| ۶ | [مریم احمدی](06-maryam-ahmadi.json) | کارشناس فروش تازه‌وارد | ۲۶ | بالا | کم | خلاصه |
| ۷ | [رضا کاظمی](07-reza-kazemi.json) | مدیر فنی | ۴۳ | بالا | پایین | انتقادی |
| ۸ | [نگار صادقی](08-negar-sadeghi.json) | دستیار مدیرعامل | ۲۸ | بالا | متوسط | دقیق |
| ۹ | [بهرام فلاحی](09-bahram-fallahi.json) | کارشناس ارشد خرید | ۴۸ | پایین | بالا | حمایتی |
| ۱۰ | [سارا قاسمی](10-sara-ghasemi.json) | مدیر محصول | ۳۲ | بالا | کم | انتقادی |

---

## 🧬 ساختار هر کاربر فرضی

هر فایل JSON شامل:

```json
{
  "id": "شناسه یکتا",
  "name": "نام فارسی",
  "role": "نقش شغلی (sales, buyer, admin, ...)",
  "roleTitle": "عنوان شغلی فارسی",
  "age": سن,
  "experience": "سابقه کار",
  "education": "تحصیلات",
  "company": "نام شرکت",

  "goals": ["اهداف شغلی"],
  "pains": ["نگرانی‌ها و مشکلات"],
  "expectations": ["انتظارات از نرم‌افزار"],

  "digitalLiteracy": "low | medium | high",
  "patienceLevel": "low | medium | high",
  "feedbackTone": "detailed | brief | critical | supportive",

  "workPattern": {
    "preferredDevice": "desktop | mobile | both",
    "workingHours": "morning | evening | flexible",
    "multitaskingLevel": "low | medium | high",
    "tendencyToMultitask": true | false,
    "usesKeyboardShortcuts": true | false,
    "readsDocumentation": "yes | no | rarely"
  },

  "permissions": {
    "roles": ["نقش‌های مجاز"],
    "panels": ["پنل‌های مجاز"]
  },

  "typicalTasks": ["وظایف روزمره"],
  "keyScenarios": ["سناریوهای کلیدی"],

  "evaluationCriteria": {
    "speed": 1-10,
    "usability": 1-10,
    "dataAccuracy": 1-10,
    "reporting": 1-10,
    "<custom>": 1-10
  }
}
```

---

## 🎯 نحوه استفاده

### توسط ایجنت تست (خودکار):

```javascript
const personas = require('./_personas/01-fatemeh-karimi.json');

async function testWithPersona(persona, scenario) {
  // 1. لاگین به عنوان نقش persona
  await loginAs(persona.role);

  // 2. اجرای سناریو با شخصیت persona
  for (const goal of persona.goals) {
    console.log(`${persona.name}: ${goal}`);
    await executeScenario(goal);
  }

  // 3. جمع‌آوری بازخورد بر اساس persona
  const feedback = await interviewPersona(persona);
  return feedback;
}
```

### توسط ایجنت دیگر (دستی):

```javascript
// بارگذاری همه personas
const allPersonas = await loadAllPersonas();

// اجرای تست با ۵ کاربر فرضی
const results = await runPersonaTests(allPersonas.slice(0, 5), 'v20.8');

// تولید گزارش
await generateReport('HUMAN-TEST-REPORT-v20.8.md', results);
```

---

## 📊 ماتریس پوشش نقش‌ها

| قابلیت | فاطمه (sales) | محمد (buyer) | علی (admin) | زهرا (accountant) | حسین (treasurer) | مریم (sales-jr) | رضا (tech) | نگار (ceo) | بهرام (buyer-sr) | سارا (PM) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ثبت RFQ | ✅ | ✅ | - | - | - | ✅ | ✅ | - | ✅ | - |
| تبدیل به CO | ✅ | - | - | - | - | ✅ | - | - | - | - |
| چاپ CO | ✅ | - | - | ✅ | - | ✅ | - | - | - | - |
| پنل تامین‌کنندگان | - | ✅ | - | - | - | - | ✅ | - | ✅ | - |
| پنل فاکتور | - | - | - | ✅ | - | - | - | - | - | - |
| پنل تنخواه | - | - | ✅ | - | ✅ | - | - | - | - | - |
| داشبورد سال مالی | - | - | ✅ | - | ✅ | - | - | - | - | - |
| گزارش‌ها | ✅ | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | ✅ |
| سینک دستگاه‌ها | ✅ | ✅ | ✅ | - | - | ✅ | - | - | - | - |

---

## 🔄 به‌روزرسانی

برای اضافه/تغییر کاربران:
1. فایل JSON جدید در همین پوشه اضافه کنید
2. این README را به‌روزرسانی کنید
3. در ایجنت تست، لیست را از `ls *.json` بخوانید

---

## 📌 نکات مهم

- **شخصیت‌پردازی مهم‌تر از تعداد:** ۵ کاربر فرضی با شخصیت قوی بهتر از ۲۰ کاربر سطحی
- **تنوع شخصیتی:** حتماً صبر، سطح دیجیتال، و لحن بازخورد متفاوت داشته باشند
- **به‌روزرسانی دوره‌ای:** هر ۶ ماه، personas را بر اساس بازخورد واقعی به‌روز کنید
- **محدودیت‌ها:** AI نمی‌تواند احساسات واقعی انسان را شبیه‌سازی کند — این محدودیت را بپذیرید

---

**سند مرتبط:** [PTF-MASTER-HANDOVER.md بخش ۷](../PTF-MASTER-HANDOVER.md#۷-اصل-تست-کاربران-فرضی-ai-ai-persona-testing--مصوبه-۱۴۰۵۰۴۲۸)
