# راهنمای گام‌به‌گام — رساندن تغییرات به پروداکشن (v34.36.0)

**تاریخ:** ۲۰۲۶-۰۹-۰۴
**مخاطب:** مالک/ادمین مخزن `lavasanimanesh-lgtm/Pishtaj.ir`
**زمان لازم:** حدود ۱۵ دقیقه · **دانش فنی لازم نیست** — فقط کلیک و کپی/پیست
**قالب:** همان قالب `APPLY-WORKFLOW-PATCHES-GUIDE-FA.md` (۲۰۲۶-۰۸-۱۳)

---

## خلاصهٔ وضعیت — الان کجا هستیم؟

دیپلوی پروداکشن ارور می‌داد. **علتش FTP یا پسورد FTP نبود**؛ چهار نقص در خود مخزن بود:

| # | نقص | وضعیت |
|---|---|---|
| ۱ | pin فرسودهٔ نسخه در ۵۱ تستر → گیت CI قرمز (۵۳ FAIL) | ✅ **رفع شد** — در PR #2 |
| ۲ | `crm/cms.js` نسخهٔ `v34.35.0` اعلام می‌کرد (بنر قرمز «فایل قدیمی» به کاربر) | ✅ **رفع شد** — در PR #2 |
| ۳ | `RELEASE-NOTES-v34.36.0.md` نبود | ✅ **ساخته شد** — در PR #2 |
| ۴ | گیت «صحت پس از استقرار» به‌دلیل یک باگ نگارشی **هرگز** سبز نمی‌شد | ⚠️ **رفع آماده است، ولی باید شما push کنید** |

نقص ۴ را نمی‌توانم خودم push کنم، چون GitHub App ایجنت مجوز `workflows` ندارد:

```
! [remote rejected] refusing to allow a GitHub App to create or update
  workflow `.github/workflows/deploy-production.yml` without `workflows` permission
```

پس این راهنما دو کار دارد: **(الف)** merge کردن PR #2 و **(ب)** رساندن اصلاح ورک‌فلو به `main`.

---

# مرحله ۰ — ادغام PR #2

این کار گیت CI را سبز می‌کند و هم‌زمان فایل‌های پچ را به `main` می‌رساند تا در مرحلهٔ ۱ در دسترس باشند.

1. در مرورگر باز کنید: **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/pull/2**
2. پایین صفحه، وضعیت را ببینید: باید `Open` و `Able to merge` باشد.
3. دکمهٔ سبز **Merge pull request** → سپس **Confirm merge**.
4. ✅ نشانهٔ موفقیت: PR بسته می‌شود و `main` یک کامیت جلوتر می‌رود.

> ⚠️ اگر دکمهٔ Merge خاکستری یا غیرفعال است، احتمالاً یک بررسی (check) در جریان است.
> یک دقیقه صبر کنید و صفحه را **Refresh** بزنید.

**اگر این مرحله را نکنید چه می‌شود؟** دیپلوی پروداکشن همان‌جا که الان می‌شکند می‌شکند
(گام `CI gate`) و اصلاً به FTP نمی‌رسد.

---

# مرحله ۱ — رساندن اصلاح ورک‌فلو به `main`

سه روش دارد. **یکی** را انتخاب کنید — هر سه به یک نتیجه می‌رسند.

| روش | برای چه کسی | زمان |
|---|---|---|
| **A** | اگر می‌خواهید این مشکل برای همیشه حل شود | ۵ دقیقه، یک‌بار |
| **B** | پیشنهادی برای الان — بدون نصب هیچ چیز، در مرورگر | ۵ دقیقه |
| **C** | اگر مخزن را روی کامپیوتر clone دارید و با git راحتید | ۳ دقیقه |

---

## روش A — اعطای مجوز `workflows` (حل دائمی)

همان روش A در `APPLY-WORKFLOW-PATCHES-GUIDE-FA.md`. اگر انجامش دهید، از این به بعد
ایجنت خودش پچ‌های ورک‌فلو را push می‌کند و هرگز دوباره به این بن‌بست نمی‌خورید.

1. گیت‌هاب → **Settings** (پروفایل خودتان) → **Developer settings** → **GitHub Apps**.
2. اپ Arena را پیدا کنید → **Permissions and events** → **Repository permissions**.
3. **Workflows** را روی **Read and write** بگذارید → ذخیره.
4. به من بگویید «مجوز workflows دادم» — بقیهٔ کار را خودم انجام می‌دهم و مراحل ۲ تا ۴ را هم راستی‌آزمایی می‌کنم.

> اگر اپ Arena را در این فهرست نمی‌بینید، یعنی مدیریتش دست شما نیست. **روش B را انجام دهید** — هیچ اشکالی ندارد.

---

## روش B — ویرایش در وب گیت‌هاب (بدون نصب git)

دو فایل است و در هر دو، فقط **یک خط** عوض می‌شود.

### B-۱ · فایل پروداکشن

1. باز کنید: **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/edit/main/.github/workflows/deploy-production.yml**
2. در کادر «Go to line» شمارهٔ **179** را بزنید (یا با Ctrl+F دنبال `FILES="crm/index.html` بگردید).
3. این خط را می‌بینید:

```yaml
          FILES="crm/index.html crm/sw.js crm/shell.js crm/client-server.js crm/key-registry.js crm/sales-domain-v2.js crm/manifest.json"
```

4. **کل آن یک خط** را پاک کنید و دقیقاً این را پیست کنید:

```yaml
          FILES="crm/index.html
          crm/sw.js
          crm/shell.js
          crm/client-server.js
          crm/key-registry.js
          crm/sales-domain-v2.js
          crm/manifest.json"
```

5. بالای صفحه، دکمهٔ **Commit changes…** → گزینهٔ **Commit directly to the `main` branch** → **Commit changes**.

> 🔴 **مهم‌ترین نکتهٔ این روش:** تورفتگی هر ۷ خط باید **دقیقاً ۱۰ فاصله** باشد — همان‌قدر که
> خود `FILES=` فاصله دارد. اگر بیشتر یا کمتر بگذارید، YAML آن فاصلهٔ اضافه را نگه می‌دارد و
> نام فایل می‌شود `"  crm/sw.js"` (با فاصلهٔ ابتدا) → گیت دوباره قرمز می‌شود، این‌بار با پیام
> «در کامیت وجود ندارد». برای اطمینان، بعد از پیست، خط‌ها را با خط `FILES=` مقایسه کنید؛
> همه باید از یک ستون شروع شوند.
>
> 💡 اگر در ویرایشگر گیت‌هاب Tab زدید و تورفتگی به‌هم ریخت، Ctrl+Z بزنید و دوباره از روی
> همین راهنما کپی کنید (کپی کردن، تورفتگی را درست نگه می‌دارد).

### B-۲ · فایل استیجینگ

1. باز کنید: **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/edit/main/.github/workflows/deploy-staging.yml**
2. بروید به خط **177** (یا دنبال `FILES="crm/sw.js` بگردید).
3. این خط را می‌بینید:

```yaml
          FILES="crm/sw.js crm/shell.js crm/client-server.js crm/key-registry.js crm/sales-domain-v2.js"
```

4. پاکش کنید و این را پیست کنید:

```yaml
          FILES="crm/sw.js
          crm/shell.js
          crm/client-server.js
          crm/key-registry.js
          crm/sales-domain-v2.js"
```

5. **Commit changes…** → **Commit directly to the `main` branch** → **Commit changes**.

### B-۳ · تأیید اینکه درست ویرایش کرده‌اید

بعد از هر دو کامیت، باز کنید:
**https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/actions/workflows/deploy-staging.yml**

کامیت شما باید یک اجرای تازهٔ استیجینگ ساخته باشد. اگر ورک‌فلو خراب ویرایش شده باشد،
گیت‌هاب همان لحظه خطای YAML می‌دهد و اجرا **اصلاً ساخته نمی‌شود** — پس «اجرا ساخته شد»
یعنی ویرایش دست‌کم از نظر نگارشی سالم است.

---

## روش C — با git روی کامپیوتر (کامل‌ترین اصلاح)

روش B فقط حلقه را درست می‌کند که برای برداشتن انسداد کافی است. روش C علاوه بر آن،
**تشخیص بهتری** هم اضافه می‌کند: اگر روزی واقعاً نسخهٔ مخلوط روی سرور برود، لاگ می‌گوید
کدام فایل، چند بایت، و اینکه تفاوت فقط پایان‌خط است یا محتوای واقعی.

```bash
cd <پوشهٔ مخزن>          # همان پوشه‌ای که .github/ داخلش است
git checkout main
git pull

git apply docs-deploy/FIX-integrity-gate-FILES-multiline.patch

git add .github/workflows/deploy-production.yml .github/workflows/deploy-staging.yml
git commit -m "ci: رفع گیت صحت — FILES چندخطی شد"
git push origin main
```

**نکتهٔ مسیر:** `git apply` را حتماً از **ریشهٔ مخزن** بزنید (همان‌جا که `.github/` هست).
اگر از پوشهٔ `docs-deploy/` بزنید خطای *No such file or directory* می‌گیرد.

**اگر `git apply` خطا داد**، به‌جایش فایل‌های کامل آماده را کپی کنید:

```bash
cp docs-deploy/deploy-production.FIXED.yml .github/workflows/deploy-production.yml
cp docs-deploy/deploy-staging.FIXED.yml    .github/workflows/deploy-staging.yml
git add .github/workflows/
git commit -m "ci: رفع گیت صحت — FILES چندخطی شد"
git push origin main
```

> 🪟 **ویندوز:** این دستورها در **Git Bash** کار می‌کنند (نه در PowerShell/CMD).
> Git Bash همراه Git for Windows نصب می‌شود؛ در منوی Start دنبالش بگردید.

---

# مرحله ۲ — آزمودن روی استیجینگ (قبل از پروداکشن)

هرگز مستقیم به پروداکشن نروید؛ اول روی استیجینگ مطمئن شوید.

1. باز کنید: **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/actions/workflows/deploy-staging.yml**
2. سمت راست، دکمهٔ **Run workflow** → برنچ `main` → **Run workflow**.
3. روی اجرای تازه کلیک کنید و صبر کنید (حدود ۱۰ تا ۱۲ دقیقه).
4. ✅ **نشانهٔ موفقیت:** همهٔ گام‌ها تیک سبز، به‌ویژه گام آخر
   `Post-deploy integrity check` و در لاگش این خط:

```
✅ تلاش 1: همهٔ فایل‌های حساس زنده == کامیت
```

5. در مرورگر باز کنید و با **Ctrl+Shift+R** (بازخوانی سخت) ببینید:
   **https://staging.pishtaj.ir**

> اگر مرحله ۰ را انجام داده باشید، این اجرا باید **کاملاً سبز** شود. برای مقایسه:
> در اجرای قبلی همهٔ گام‌ها سبز بودند جز همین گام آخر.

---

# مرحله ۳ — دیپلوی پروداکشن

1. باز کنید: **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/actions/workflows/deploy-production.yml**
2. سمت راست، **Run workflow**.
3. دو فیلد را پر کنید:

| فیلد | مقدار |
|---|---|
| `confirm` | `DEPLOY` (دقیقاً، با حروف بزرگ انگلیسی) |
| `ref` | `main` |

4. **Run workflow** را بزنید.
5. روی اجرای تازه کلیک کنید و تا پایان صبر کنید (حدود ۱۰ تا ۱۵ دقیقه).

✅ **نشانهٔ موفقیت — همهٔ این گام‌ها باید سبز باشند:**

```
✓ Verify confirmation
✓ Checkout target ref
✓ Validate ref is main or a version tag
✓ Architecture guard
✓ CI gate                        ← قبلاً اینجا می‌مرد
✓ PHP syntax lint
✓ Sanity check robots.txt
✓ Ensure no staging banner
✓ Write deploy marker
✓ Deploy via FTP                 ← قبلاً هرگز نمی‌رسید
✓ Verify deployment
✓ Post-deploy integrity check    ← قبلاً همیشه قرمز
✓ Create version tag
✓ Build backup archive
✓ Publish Release (backup)
✓ Summary
```

در پایان، یک **تگ نسخه** و یک **Release با فایل بک‌آپ** ساخته می‌شود
(مثلاً `v2026.09.04-1030`). این فقط وقتی ساخته می‌شود که گیت صحت سبز باشد —
پس دیدنش یعنی دیپلوی واقعاً موفق بوده است.

---

# مرحله ۴ — تأیید نهایی روی سایت زنده

1. **https://pishtaj.ir** را با **Ctrl+Shift+R** باز کنید — سایت باید عادی بالا بیاید.
2. مارکر دیپلوی را ببینید: **https://pishtaj.ir/__deploy__.txt**
   باید `"env":"production"` و `"ref":"main"` و `"sha":"..."` داشته باشد.
3. گزارش تشخیصی: **https://pishtaj.ir/__diag__.txt**
4. در CRM (**https://pishtaj.ir/crm/**) وارد شوید و **تب «مدیریت سایت»** را باز کنید.
   ✅ باید بنر قرمز «فایل برنامهٔ مدیریت سایت در مرورگر شما قدیمی است» **نباشد** —
   این همان نقص ۲ بود که رفع شد. اگر بنر را دیدید، یک‌بار Ctrl+Shift+R بزنید.
5. دکمهٔ **خروج** را در سایدبار، کنار نام کاربرتان ببینید (تغییر اصلی v34.36.0)
   و نقش/سمت را زیر نام.

---

# عیب‌یابی

### گام `CI gate` قرمز شد
یعنی pin نسخه دوباره drift کرده. لاگ گام را باز کنید و دنبال `=== CI gate:` بگردید؛
فهرست تسترهای FAIL را می‌دهد. ابزار آماده در مخزن هست:

```bash
node _tools/uat/bump-version-pins.js <نسخهٔ-قدیمی>     # مثال: 34.36.0
node _tools/uat/run-ci-gate.js                          # راستی‌آزمایی محلی
```

### گام `Deploy via FTP` قرمز شد
**این‌جا واقعاً ممکن است مشکل FTP باشد.** لاگ را ببینید:
- `Login incorrect` / `530` → نام کاربری یا رمز در Secrets غلط است.
- `Timeout` / `Could not connect` → آدرس سرور یا فایروال/پورت.
- `Permission denied` / `550` → کاربر FTP روی آن مسیر حق نوشتن ندارد.

سکرت‌ها این‌جا هستند: **Settings → Secrets and variables → Actions**
`FTP_PROD_SERVER` · `FTP_PROD_USERNAME` · `FTP_PROD_PASSWORD` · `FTP_PROD_SERVER_DIR`

### گام `Post-deploy integrity check` بعد از اصلاح قرمز شد
این دیگر باگ نیست — یعنی **واقعاً** فایل زنده با کامیت فرق دارد. پیام خطا حالا دقیق است:

```
≠ crm/sw.js (want=a1b2c3d4e5 got=f6e7d8c9b0 | کامیت=8443 بایت، زنده=8451 بایت) — فقط تفاوت پایان‌خط (\r)
```

- اگر نوشت **«فقط تفاوت پایان‌خط (\r)»** → سرور فایل را با تبدیل CRLF تحویل می‌دهد؛ محتوای واقعی یکی است.
- اگر نوشت **«دریافت از سایت زنده ناموفق بود»** → کش/CDN یا شبکه؛ چند دقیقه بعد دوباره اجرا کنید.
- اگر اندازه‌ها متفاوت بود و پیام `\r` را نداشت → فایل واقعاً قدیمی است؛ یعنی آپلود کامل نشده.

### `[FTP] مسیر مقصد () با LIST/NLST خوانده نشد`
آن `()` **خالی** است، یعنی `FTP_SERVER_DIR` (و احتمالاً `FTP_PROD_SERVER_DIR`) مقدار ندارد.
چون این بررسی فقط تشخیصی است، job را نمی‌اندازد و آپلود انجام می‌شود — ولی بهتر است
در Secrets پرش کنید (مثلاً `/public_html/`).

### YAML خراب شد و ورک‌فلو از کار افتاد
صفحهٔ فایل → **History** (بالا سمت راست) → روی کامیت سالم قبلی → **⋯** → **Revert changes**.
یا با git:

```bash
git checkout HEAD~1 -- .github/workflows/deploy-production.yml .github/workflows/deploy-staging.yml
git commit -m "revert: بازگردانی ورک‌فلوها" && git push origin main
```

---

# رول‌بک پروداکشن (اگر بعد از دیپلوی سایت خراب بود)

1. **https://github.com/lavasanimanesh-lgtm/Pishtaj.ir/releases** → آخرین تگ پایدار را پیدا کنید (مثلاً `v2026.09.04-1030`).
2. **Actions → Deploy to Production → Run workflow**
3. فیلدها:

| فیلد | مقدار |
|---|---|
| `confirm` | `DEPLOY` |
| `ref` | نام همان تگ، مثلاً `v2026.09.04-1030` |

> ⚠️ فقط تگ‌هایی معتبرند که **بعد از** اجرای موفقِ ورک‌فلوی جدید ساخته شده باشند.
> تگ‌های قدیمی‌تر به دیپلویی اشاره می‌کنند که هرگز راستی‌آزمایی نشده — و تا قبل از
> رفع نقص ۴، هیچ دیپلویی راستی‌آزمایی‌شده اعلام نمی‌شد.

---

# چک‌لیست یک‌صفحه‌ای

```
[ ] ۰. PR #2 را merge کردم
[ ] ۱. اصلاح ورک‌فلو را به main رساندم   (روش A یا B یا C)
[ ] ۲. Deploy to Staging → همهٔ گام‌ها سبز، با «✅ تلاش 1: همهٔ فایل‌های حساس زنده == کامیت»
[ ] ۳. staging.pishtaj.ir با Ctrl+Shift+R درست باز شد
[ ] ۴. Deploy to Production با confirm=DEPLOY و ref=main → همهٔ گام‌ها سبز
[ ] ۵. تگ نسخه + Release بک‌آپ ساخته شد
[ ] ۶. pishtaj.ir/__deploy__.txt مقدار production/main دارد
[ ] ۷. تب «مدیریت سایت» بدون بنر قرمز «فایل قدیمی» باز شد
[ ] ۸. دکمهٔ خروج کنار نام کاربر و نقش/سمت زیر نام دیده می‌شود
```

---

## پیوست — چرا نقص ۴ اصلاً دیده نمی‌شد؟

`FILES` یک رشتهٔ **یک‌خطی با فاصله** بود که با `while IFS= read -r f` مصرف می‌شد.
چون `IFS` تهی است، `read` کل خط را یک‌جا می‌گیرد و حلقه **فقط یک بار** می‌چرخد،
با هر هفت نام فایل در یک متغیر. نتیجه در هر تلاش:

```
sha1sum: 'crm/sw.js crm/shell.js ...': No such file or directory   → want = (تهی)
curl: (3) URL using bad/illegal format or missing URL              → got  = da39a3ee5e
```

پس `want != got` همیشه برقرار بود، ۵ تلاش بی‌نتیجه می‌سوخت و گام با `exit 1` می‌افتاد —
کاملاً مستقل از اینکه استقرار درست انجام شده باشد یا نه.

علت پنهان ماندنش: آن خطوط `≠` فقط `stdout` بودند و تنها `::error::` پایانی به
annotation تبدیل می‌شد، پس در صفحهٔ Actions فقط یک پیام کلی دیده می‌شد.

**شاهد:** در دو اجرای مستقل — `main@4ec342e` با v34.35.0 و `arena@7366edf` با v34.36.0 —
همین گام شکست، درحالی‌که در هر دو `verify-deploy.sh` همهٔ ۵ فایل را
«هش زنده == کامیت ✅» گزارش کرده بود. یعنی محتوای سایت زنده درست بود و فقط حلقهٔ
این گام خراب. دلیلش هم روشن است: `verify-deploy.sh` متغیر `BYTES_FILES` را
**چندخطی** می‌سازد، پس درست حلقه می‌زند. اصلاح، دقیقاً همان الگو را به ورک‌فلو برد.
