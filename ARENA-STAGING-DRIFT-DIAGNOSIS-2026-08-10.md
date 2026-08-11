# گزارش تشخیص وضعیت استیجینگ و عقب‌ماندگی main — ۱۴۰۵/۰۵/۱۹ (2026-08-10)

> درخواست: «آخرین وضعیت استیجینگ را بررسی کن و میزان عقب ماندگی مین را چک کن. تغییراتی در یک نشست دیگر انجام شده که من روی استیجینگ رفع ایراد ادعا شده رو مشاهده نکردم و همچنان باگ وجود دارد ببین مشکل کجاست»

---

## ۱) خلاصه اجرایی (نتیجهٔ اصلی)

| مورد | مقدار دقیق |
|------|------------|
| **آخرین دیپلوی استیجینگ** | `arena/019feaad-pishtaj-ir` — کامیت `9ae21e1` — **CHQ-DOC-002 (v34.4.31)** — `2026-08-10 12:58:40Z` (۱۶:۲۸ به وقت تهران) — وضعیت `success` — `Deploy to Staging #423` |
| **یک دیپلوی قبل‌تر روی همان برنچ** | `28bde88` — **CHQ-DOC-001 (v34.4.30)** — `2026-08-10 11:43:33Z` |
| **وضعیت main (production)** | `77d02b7` — Merge PR #29 — تگ `v2026.08.10-0721` — `VERSION.json: v34.4.29` — آخرین دیپلوی پروداکشن `2026-08-10 07:20:54Z` |
| **عقب‌ماندگی main نسبت به staging** | `0 ahead / 2 behind` — یعنی **staging دقیقاً ۲ کامیت جلوتر از main است** و main هیچ کامیت جلویی ندارد. (`git rev-list --left-right --count main...origin/arena-019feaad` → `0   2`) |
| **ریشهٔ «باگ همچنان هست»** | **سه علت هم‌زمان:** ۱) دو فیکس آخر فقط روی staging هستند و **هرگز PR نشده‌اند** به main — روی `pishtaj.ir` (پروداکشن) هنوز باگ هست؛ ۲) **باگ بهداشت نسخه در خود فیکس استیجینگ**: `sw.js / manifest.json / clear-cache.html` هنوز `v34.4.29` مانده‌اند درحالی‌که `index.html` و `VERSION.json` روی `v34.4.31` هستند → مرورگر با ServiceWorker قدیمی همچنان JS قدیمی را سرو می‌کند و فیکس دیده نمی‌شود حتی روی `staging.pishtaj.ir`؛ ۳) **استیجینگ مشترک و overwrite**: هر `push` روی هر برنچ `arena/**` استیجینگ را بازنویسی می‌کند (state file مشترک `.ftp-deploy-sync-state-staging.json`). فیکس‌های دو نشست قدیمی‌تر (PR #22 و #25) که ادعای رفع داشتند، توسط دو دیپلوی آخر `019feaad` روی FTP **کاملاً بازنویسی و گم شدند**. |

**نتیجه:** اگر شما `staging.pishtaj.ir` را هم چک کرده‌اید و باگ را می‌بینید، علت اصلی مورد ۲ (نسخهٔ Service Worker) + کش مرورگر است. اگر `pishtaj.ir` را چک کرده‌اید، علت مورد ۱ است. اگر منتظر فیکسی از PR #22/#25 بوده‌اید، علت مورد ۳ است.

---

## ۲) شواهد دقیق

### ۲-۱) تاریخچه دیپلوی‌ها (GitHub Actions)

```
Deploy to Staging (آخرین ۵):
2026-08-10T12:58:40Z  arena/019feaad  CHQ-DOC-002 (v34.4.31)  success  9ae21e1
2026-08-10T11:43:33Z  arena/019feaad  CHQ-DOC-001 (v34.4.30)  success  28bde88
2026-08-10T07:11:23Z  arena/019fe792  fix(supplier): keep registration ...  success 2bc3ac7
2026-08-10T07:01:14Z  arena/019fe792  fix(crm): save cheque books ...       success 3790d2a
...

Deploy to Production (آخرین ۳):
2026-08-10T07:20:54Z  main  77d02b7  success  tag v2026.08.10-0721
2026-08-09T17:21:02Z  main  6c43edb  success  tag v2026.08.09-1721
2026-08-09T06:22:55Z  main  1cc1331  success  tag v2026.08.09-0623
```

استخراج با:
```bash
gh run list --workflow "Deploy to Staging" --limit 20
gh run list --workflow "Deploy to Production" --limit 20
```

آخرین دیپلوی استیجینگ **بعد از** آخرین دیپلوی پروداکشن است (۷:۲۰ → ۱۲:۵۸ UTC) و روی برنچی متفاوت از main رفته.

### ۲-۲) مقایسه main vs staging

```bash
git rev-list --left-right --count main...origin/arena-019feaad
# => 0  2  (left=main, right=staging) => main 0 ahead, 2 behind

git log main..origin/arena-019feaad --oneline
# 9ae21e1 CHQ-DOC-002 (v34.4.31): رفع علت اصلی «مودال سند نشان نمی‌دهد / باید تب تجدید شود»
# 28bde88 CHQ-DOC-001 (v34.4.30): رفع مشکل عدم امکان مشاهده/حذف عکس چک

git diff main..origin/arena-019feaad --stat
#  12 files changed, 675 insertions(+), 168 deletions(-)
#  ARENA-ATTACHMENT-MODAL-STALE-SYNC-FIX...
#  ARENA-CHEQUE-DOC-VIEW-FIX...
#  VERSION.json, crm/cheque-panel.js, crm/index.html, crm/petty.js, crm/rbac.js, crm/storage.js, crm/supplier-finance.js, crm/sync.js, tester178, tester179
```

**نکته معماری:** `019feaad` دقیقاً از روی `main@77d02b7` (که خودش مرج `019fe792` است) منشعب شده، پس تمام فیکس‌های PR #29 (چک، تامین‌کننده، ...) را دارد، ولی دو کامیت جدیدش **هیچ PRای ندارند**:

```bash
gh pr list --head arena/019feaad-pishtaj-ir
# => []  (no PR)
git branch -a --contains 9ae21e1
# => only remotes/origin/arena-019feaad
```

یعنی این دو فیکس **orphan روی staging** هستند و با هر مرج بعدی main از بین می‌روند اگر PR نشوند.

### ۲-۳) نسخه‌ها — ناسازگاری بهداشت نسخه (Cache Poisoning)

| فایل | روی main (`77d02b7`) | روی staging (`9ae21e1`) | باید باشد |
|------|----------------------|-------------------------|-----------|
| `VERSION.json` | `v34.4.29` | `v34.4.31` ✅ | `v34.4.31` |
| `crm/index.html` → `PTF_CRM_RELEASE` | `v34.4.29` | `v34.4.31` ✅ | `v34.4.31` |
| `crm/index.html` → `?v=` روی ۳۲ اسکریپت | `?v=34.4.29` (یا بدون) | `?v=34.4.31` ✅ (۳۰+ مورد) | `?v=34.4.31` |
| **`crm/sw.js` → `RELEASE`** | `v34.4.29` | **`v34.4.29` ❌** | `v34.4.31` |
| **`crm/manifest.json` → `version`** | `34.4.29` | **`34.4.29` ❌** | `34.4.31` |
| **`crm/clear-cache.html` → `VER`** | `v34.4.29` | **`v34.4.29` ❌** | `v34.4.31` |

بررسی:

```bash
git show origin/arena-019feaad:crm/sw.js | grep RELEASE
# var RELEASE = 'v34.4.29';

git diff main..origin/arena-019feaad --stat | grep sw
# (هیچ) — یعنی sw.js اصلاً تغییر نکرده!
```

**اثر:** قرارداد PWA می‌گوید `RELEASE` در `sw.js` باید دقیقاً برابر `PTF_CRM_RELEASE` و `?v=` ها باشد. الان مرورگری که یک‌بار `v34.4.29` را نصب کرده، ServiceWorker قدیمی همان `CACHE = ptf-crm-v34.4.29` را نگه می‌دارد و `index.html` جدید را هم از کش قدیمی سرو می‌کند. حتی `Ctrl+Shift+R` گاهی کافی نیست و باید از `crm/clear-cache.html` یا `DevTools → Application → Unregister SW + Clear Storage` استفاده کرد. این دقیقاً توضیح می‌دهد چرا «روی استیجینگ هم باگ را می‌بینم».

---

## ۳) چرا «نشست دیگر» روی استیجینگ دیده نشد؟ — پدیدهٔ Staging Collision

دو PR باز که ادعای رفع باگ داشتند:

| PR | برنچ | عنوان | آخرین update | وضعیت |
|----|------|-------|--------------|--------|
| #22 | `arena/019fd594` | `v34.1.1 — رفع کامل خطاهای تسترها + اصلاحات کش‌باسترها` | 2026-08-06 | OPEN, never deployed after 2026-08-06 |
| #25 | `arena/019fd8e7` | `fix(crm): v34.2.5 — تثبیت بهداشت نسخه و رفع نواقص استیجینگ (بررسی عمیق PR #22)` | 2026-08-07 02:04 | OPEN, never merged |

بررسی ancestry:

```bash
git merge-base --is-ancestor origin/arena-019fd8e7 origin/arena-019feaad; echo $?
# => 1 (not ancestor) — یعنی هیچ‌کدام از فیکس‌های PR25 روی staging فعلی نیست

git diff origin/arena-019fd8e7..origin/arena-019feaad --stat
# 110+ فایل متفاوت — از جمله mobilenav.js, offers.js, kanban.js, sw.js, etc.
```

**علت معماری:** workflow `deploy-staging.yml` روی هر `push` به `arena/**` با `state-name: .ftp-deploy-sync-state-staging.json` **مشترک** اجرا می‌شود. یعنی استیجینگ **تک‌ناحیه‌ای** است: آخرین push برنده می‌شود و قبلی را کامل بازنویسی می‌کند. نشست `019fd8e7` در ۷ آگوست یک فیکس مهم (XSS, بهداشت نسخه, FAB, modal, overflow) داده بود، ولی نشست `019feaad` در ۱۰ آگوست بدون rebase از روی آن، دوباره استیجینگ را deploy کرد — فیکس قبلی پاک شد.

همین الان **۳ نشست فعال** روی `arena/019feaad`, `019fe792`, `019fd8e7`, `019fd594` همگی می‌خواهند روی یک FTP مشترک بریزند — بدون قرنطینه.

---

## ۴) محتوای دو فیکس آخر استیجینگ (که روی main نیست)

### CHQ-DOC-001 (28bde88, v34.4.30) — «عکس چک دیده نمی‌شود»
- ریشه: در پنل چک فقط ویرایش/حذف بود، هیچ دکمهٔ مستقلی برای دیدن سند نبود؛ در ویرایش هم باگ `window._ptfChEditCd` مانع حذف سند می‌شد.
- اصلاح: دکمهٔ جدید `📎 سند` روی هر ردیف چک (صادره/وارده) + مودال سبک `ptfChequeFilesUi`؛ رفع باگ `_ptfChEditCd`؛ اضافه شدن آپلود عکس در «ثبت پرداخت» تامین‌کننده و «ثبت وصولی» مشتری؛ نمایش ستون فایل در گردش حساب.
- فایل‌ها: `cheque-panel.js`, `supplier-finance.js`, `rbac.js`

### CHQ-DOC-002 (9ae21e1, v34.4.31) — «مودال سند خالی است و باید تب عوض کرد»
- ریشه معماری: `sync.js` هر ۲۰ثانیه pull می‌کند ولی `refreshCurrentPanel()` عمداً وقتی هر مودالی باز است رندر را متوقف می‌کند — مودال‌های فقط-نمایشی که یک‌بار از `localStorage` می‌خواندند هرگز به‌روز نمی‌شدند.
- اصلاح: `ptfSyncPullNow(cb)` (pull فوری) در `sync.js` + `ptfAttachRefreshOnOpen(dlgId, getSig, reopenFn)` در `storage.js` که بعد از باز شدن مودال pull فوری می‌زند و اگر امضا عوض شده بود فقط همان مودال را دوباره می‌سازد. اعمال روی `petty.js`, `cheque-panel.js`, `supplier-finance.js`.

هر دو فیکس تسترهای جدید دارند (tester178: ۱۷ چک, tester179: ۱۱ چک) و رگرسیون ۲۵ تستر دیگر را پاس کرده‌اند.

---

## ۵) شاخهٔ فعلی شما

```bash
git branch --show-current
# arena/019febff-pishtaj-ir
git rev-parse HEAD  # 77d02b7
git rev-parse origin/main  # 77d02b7
# => شما دقیقاً روی main هستید (هیچ کامیت اضافی ندارید)، نه روی staging (9ae21e1)
```

اگر локالی تست می‌کنید، فیکس `019feaad` را ندارید.

---

## ۶) پیشنهاد رفع فوری (بدون حدس)

### الف) اگر می‌خواهید فیکس استیجینگ همین الان دیده شود (روی staging.pishtaj.ir):

1. **رفع بهداشت نسخه (mandatory):**
   ```bash
   # در برنچ 019feaad (یا برنچ جدید از روی آن):
   # crm/sw.js:  RELEASE = 'v34.4.31'; ASSET_VERSION='34.4.31'
   # crm/manifest.json: "version": "34.4.31"
   # crm/clear-cache.html: <h1>...v34.4.31 + window.VER='v34.4.31'
   # سپس commit + push => دوباره Deploy to Staging
   ```
   بدون این، هر کاربری که قبلاً v34.4.29 را کش کرده همچنان باگ را می‌بیند.

2. **به کاربر/تستر بگویید:**
   - `https://staging.pishtaj.ir/crm/clear-cache.html` را باز کند و دکمه «به‌روزرسانی امن» را بزند.
   - یا `Ctrl+Shift+R` + در DevTools → Application → Clear Storage → Unregister Service Worker → Reload.
   - چک کند `VERSION.json` روی staging الان `v34.4.31` است و در `index.html` عبارت `v34.4.31` دیده می‌شود.
   - دکمهٔ `📎 سند` روی ردیف چک باید دیده شود (CHQ-DOC-001) و بعد از باز کردن مودال تنخواه/چک، پیام `📎 اسناد به‌روزرسانی شد` در صورت وجود سند جدید از دستگاه دیگر بیاید (CHQ-DOC-002).

### ب) اگر می‌خواهید فیکس به پروداکشن بیاید:

- از `019feaad` یک PR به `main` بسازید و مرج کنید → تگ جدید `v2026.08.10-xxxx` ساخته می‌شود و پروداکشن deploy می‌شود. (الان این دو کامیت هیچ PRای ندارند و در خطر گم‌شدن هستند.)

### ج) برای جلوگیری از تکرار Staging Collision:

- یا PRهای #22 و #25 را **تصمیم‌گیری** کنید: اگر فیکس‌هایشان (XSS, بهداشت نسخه کامل, FAB, modal) هنوز لازم‌اند، آنها را روی `019feaad` rebase/merge کنید و دوباره تست کنید؛ اگر نه، آنها را ببندید تا انتظار بیهوده نماند.
- یا برای نشست‌های موازی از **پیشوند staging جداگانه** یا `concurrency` با `cancel-in-progress: true` استفاده کنید (فعلاً `false` است).

### د) برای این نشست (019febff):

```bash
git fetch origin
git merge origin/arena-019feaad   # یا cherry-pick 28bde88 9ae21e1
# سپس sw.js/manifest را اصلاح کنید
```

---

## ۷) دستورات راستی‌آزمایی که اجرا شد

```bash
git ls-remote --heads origin | grep arena
gh run list --workflow "Deploy to Staging" --limit 20
gh run list --workflow "Deploy to Production" --limit 20
gh pr list --state open
git rev-list --left-right --count main...origin/arena-019feaad
git log main..origin/arena-019feaad --oneline
git show origin/arena-019feaad:VERSION.json
git show origin/arena-019feaad:crm/sw.js | grep RELEASE
git diff main..origin/arena-019feaad --stat
```

---

**نتیجه نهایی به زبان ساده:** استیجینگ در آخرین حالت **سالم deploy شده و ۲ نسخه جلوتر از پروداکشن است**، ولی به دو دلیل «انگار فیکس نشده»: یکی اینکه پروداکشن هنوز آن ۲ کامیت را ندارد، و دیگر اینکه خود آن ۲ کامیت یک باگ کش (sw.js) دارند که باعث می‌شود مرورگر همچنان نسخهٔ قدیمی را نشان دهد. علاوه بر آن، هر فیکسی که در نشست‌های #22/#25 ادعا شده بود الآن روی استیجینگ وجود ندارد چون توسط دیپلوی آخر بازنویسی شده.

*تهیه‌شده توسط Arena Agent — 2026-08-10 — بر اساس لاگ Git, GitHub API و محتوای کامیت‌ها.*
