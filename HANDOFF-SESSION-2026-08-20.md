# سند تحویل سئو — نشست ۲۰۲۶-۰۸-۲۰ (فاز ۳)

**تاریخ:** ۲۰۲۶-۰۸-۲۰ | **شاخه این نشست:** `arena/01a01b28-pishtaj-ir` (PR #55)  
**پایه:** `origin/main` در `f3aead0` (PR #56) + کار سئوی این شاخه

> اگر PR #55 به main مرج شده، ایجنت جدید از `origin/main` تازه شاخه بزند  
> (`arena/<id>-pishtaj-ir` یا `arena/<id>-seo-phase4`).  
> روی شاخهٔ بسته‌شدهٔ `arena/01a01b28-pishtaj-ir` کار جدید push نکن.

---

## ۰) شروع سریع

```bash
git fetch origin && git checkout -b arena/<id>-seo-phase4 origin/main
```

1. از کاربر بپرس: PR #55 مرج شد؟ Test Live URL صفحه اصلی `knowsAbout` را پاک کرد؟
2. این فایل + `CONTENT-METHODOLOGY-CRITIQUE.md` + `CONTENT-AND-UX-ASSESSMENT.md` را بخوان.
3. کار بعدیِ کدی: تکمیل گام E (webp بقیهٔ صفحات) **یا** Case Study فقط با ورودی واقعی.
4. هرگز `crm/data/`، `ptf-secrets.php`، `ptf-db-config.php` را commit نکن.
5. قبل از commit: JSON-LD + لینک شکسته + پارس XML نقشه سایت (اسکریپت‌های بخش ۳).

---

## ۱) کار انجام‌شده در این نشست (PR #55)

| Commit | موضوع |
|---|---|
| `be27d88` | عمیق‌سازی ۱۰ `/comparisons/` (~۱۵۰۰ کلمه، `data-deep3`) + لینک KC + Product→Service در کاتالوگ خانه |
| `68e1161` | **گام C:** skip-link، breadcrumb نمایان، `/search/` + `search-index.json` (۶۵۳ URL)، تاریخ وبلاگ، SearchAction |
| `64171ea` | **رفع GSC:** حذف کامل `knowsAbout` از خانه؛ `@type` فقط `Organization` (نه آرایهٔ Org+LocalBusiness) |
| `d98dd93` | **گام E (شروع):** ۲۲ webp تازه، `<picture>` روی ۹ تصویر خانه، استخراج `<style>` خانه به `assets/css/home.css` |

اسکریپت‌های جدید (idempotent):

- `tools/seo_comparison_deep3.py`
- `tools/seo_ux_step_c.py`
- `tools/seo_webp_html.py`

فایل‌های کشف UX: `assets/css/discover.css`, `assets/js/ptf-discover.js`, `search/index.html`, `assets/data/search-index.json`

---

## ۲) کارهای قبلی (قبلاً در main)

- PR #52 اسکیما خانه (ادغام knowsAbout تکراری — **کافی نبود**؛ این نشست فیلد را حذف کرد)
- PR #53 عمق ۹ صفحه supplier
- PR #54 هاب `/comparisons/` با ۱۰ مقاله
- PR #56 (موازی، CRM) در main است و داخل این شاخه merge شده

---

## ۳) اعتبارسنجی (قبل از هر commit)

```bash
python3 - <<'PY'
import re,json,glob,sys
bad=0
for p in glob.glob('comparisons/*.html')+glob.glob('suppliers/*.html')+['index.html']:
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>',open(p).read(),re.S):
        try: json.loads(b)
        except Exception as e:
            print(p,e); bad+=1
print('knowsAbout on homepage', open('index.html').read().count('knowsAbout'))
sys.exit(1 if bad else 0)
PY
```

لینک شکسته و XML: همان دستورهای `HANDOFF-SESSION-2026-08-19.md` بخش ۳.

---

## ۴) باقی‌مانده

### فوری — کاربر (نه ایجنت)
1. مرج PR #55 + صبر برای دیپلوی.
2. GSC → Test **live** URL روی `https://pishtaj.ir/` → اگر خطای Structured Data / knowsAbout نبود → Request indexing.
3. Request indexing:
   - `/search/`
   - `/comparisons/` + ۱۰ مقاله (لیست در پیام کاربر)
4. صفحات ایندکس‌نشدهٔ انبوه را با Removals پاک **نکن** (مگر CRM/تست/duplicate واقعی).

### گام D — Case Study
بدون پروژه واقعی، چالش، نتیجه، عکس/MTC **ننویس**. اول از کاربر بپرس.

### گام E — ادامه عملکرد
- `<picture>` هنوز عمدتاً روی صفحه اصلی است؛ بقیهٔ HTML هنوز jpg می‌گیرند.
- `style=""` اینلاین خانه هنوز ~۲۱۷ تاست (فقط بلوک‌های `<style>` خارج شد).
- `assets/js/main.js` را بی‌گدار تغییر نده.

### محتوا
- مقایسه‌ها ~۱۵۰۰ کلمه‌اند؛ هدف نقد متدولوژی ۲۰۰۰+ است — فقط اگر GSC CTR/رتبه ضعیف بود با `data-deep4`.
- **Cannibalization:** `blog/a106-vs-a333-pipes.html` و `comparisons/a106-vs-a333-pipe.html` — تا ۲–۳ هفته داده GSC، ریدایرکت/canonical نزن.

### لینک
- چند مقاله KC به comparisons لینک دارند؛ بقیهٔ خوشه را زمینه‌ای گسترش بده (نه بلوک CTA قالبی).

---

## ۵) فلسفه (کوتاه)

عرض متوقف؛ عمق + داده. محتوا متمایز. قبل از صفحهٔ جدید حجم جستجو. حلقه GSC/GA4. لینک زمینه‌ای. E-E-A-T واقعی. اسکریپت idempotent با `data-*`. JSON-LD با `json.loads`. تاریخ سیستم ۲۰۲۶ است.

لینک نسبی: `services/products/` → `../../` ؛ `suppliers/` و `comparisons/` → `../`.

---

## ۶) سوال‌های اول از کاربر در نشست جدید

1. PR #55 مرج و دیپلوی شد؟
2. Test Live URL خانه: knowsAbout رفت؟
3. Request indexing مقایسه‌ها زده شد؟
4. داده Performance آماده است؟
5. ورودی Case Study دارید؟

---

## ۷) وضعیت شاخه

کار این نشست روی `arena/01a01b28-pishtaj-ir` / PR #55 است.  
پس از مرج، این شاخه را برای کار جدید استفاده نکن.
