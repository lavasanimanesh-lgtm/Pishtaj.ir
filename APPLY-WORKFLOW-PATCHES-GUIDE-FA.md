# راهنمای گام‌به‌گام — اعمال دستی پچ‌های Workflow در گیت‌هاب

**تاریخ:** 2026-08-13
**مخاطب:** مالک/ادمین مخزن `lavasanimanesh-lgtm/Pishtaj.ir`
**زمینه:** GitHub App ایجنت، مجوز نوشتن فایل‌های پوشهٔ `.github/workflows/` را ندارد
(`workflows` permission). به همین دلیل دو پچ زیر به‌صورت دستی باید اعمال شوند:

| پچ | فایل | هدف |
|---|---|---|
| گیت CI قبل از FTP | `deploy-staging.yml` + `deploy-production.yml` | اجرای ۱۶ تستر سبز (سینک/مالی/اعلان/امنیت) قبل از آپلود — کد خراب نه به استیجینگ می‌رود نه پروداکشن (دیپلوی خودکار `arena/**` طبق تصمیم شما حفظ می‌شود) |
| جایگزینی `php.yml` | `php.yml` | جاب فعلی (composer validate) در این مخزن بی‌اثر است؛ نسخهٔ جدید واقعاً `php -l` و `node --check` و گیت UAT را اجرا می‌کند |

> ⏱ زمان لازم: حدود ۱۰ دقیقه. فقط «کپی و پیست» است؛ هیچ دانش فنی لازم ندارد.

---

## روش A (پیشنهادی برای همیشه): اعطای مجوز `workflows` به GitHub App

اگر App مربوط به Arena را خودتان در GitHub مدیریت می‌کنید:

1. وارد گیت‌هاب شوید → **Settings** (پروفایل) → **Developer settings** → **GitHub Apps**.
2. اپ Arena را پیدا کنید → **Permissions and events** → **Repository permissions**.
3. گزینهٔ **Workflows** را روی **Read and write** بگذارید و ذخیره کنید.
4. از آن به بعد ایجنت می‌تواند خودش پچ‌ها را push کند (یک‌بار این کار = حل دائمی).

اگر این App را نمی‌بینید یا مدیریتش دست شما نیست، روش B را انجام دهید.

---

## روش B: اعمال دستی در وب گیت‌هاب (۳ فایل)

برای هر فایل، دقیقاً همین مراحل تکرار می‌شود:

1. در مرورگر باز کنید: `https://github.com/lavasanimanesh-lgtm/Pishtaj.ir`
2. به مسیر فایل بروید: **`.github` → `workflows` → نام فایل**.
3. روی آیکون **مداد (✏️ Edit this file)** در بالای محتوا کلیک کنید.
4. **همهٔ محتوای فعلی را انتخاب و حذف کنید** (Ctrl+A → Delete).
5. محتوای جدید را از همین راهنما **کاملاً کپی** کنید (از داخل بلوک کد؛ بدون حذف/اضافهٔ خط).
6. پایین صفحه: گزینهٔ **«Commit directly to the main branch»** انتخاب است → دکمهٔ **Commit changes** را بزنید.
7. اگر پیام «Commit changes» سبز ظاهر شد، فایل بعدی.

> ⚠️ نکته: در بلوک‌های کد زیر، چیزی را دست‌کاری نکنید — دقیقاً همان را پیست کنید.
> اگر حین کار اشتباه کردید: صفحهٔ فایل → **History** (بالا سمت راست) → روی کامیت قبلی → **...** → Revert changes.

---

### فایل ۱ از ۳ — `.github/workflows/php.yml`

(جایگزین کامل — نسخهٔ جدید که واقعاً lint و گیت اجرا می‌کند)

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# PHP & JS Lint — دروازهٔ کیفیت روی هر push/PR به main
#
# جایگزین php.yml قدیمی (composer validate) که در این مخزن (بدون composer.json)
# عملاً بی‌اثر بود. این جاب واقعاً کد را lint می‌کند:
#   • php -l روی همهٔ فایل‌های api/ و crm/
#   • node --check روی همهٔ فایل‌های crm/ (به‌جز کتابخانهٔ xlsx.min.js)
#   • گیت UAT کانونی (run-ci-gate.js — همان گیت قبل از FTP)
# ─────────────────────────────────────────────────────────────────────────────
name: PHP & JS Lint + UAT gate

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint PHP (api/ + crm/)
        run: |
          find api crm -name '*.php' -print0 | xargs -0 -n1 php -l

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Lint JS (crm/ — بدون کتابخانه‌های min)
        run: |
          find crm -name '*.js' -not -name 'xlsx.min.js' -print0 | xargs -0 -n1 node --check

      - name: UAT gate (sync / finance / notifications / security)
        run: node _tools/uat/run-ci-gate.js
```

---

### فایل ۲ از ۳ — `.github/workflows/deploy-staging.yml`

(جایگزین کامل — دیپلوی خودکار حفظ شده + گیت CI اضافه شده)

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# Deploy to Staging — استقرار خودکار روی staging.pishtaj.ir
#
# مسیر روی گیت‌هاب: .github/workflows/deploy-staging.yml   (روی برنچ main)
#
# دو مسیر توسعه، یک استیجینگ مشترک:
#   برنچ‌های  site/**  → کار روی وب‌سایت
#   برنچ‌های  crm/**   → کار روی CRM
#   چون CRM در پوشه /crm/ است و سایت در ریشه، روی هم نمی‌نویسند.
#
# سکرت‌های لازم (همان‌های قبلی، تغییری نکرده‌اند):
#   FTP_SERVER / FTP_USERNAME / FTP_PASSWORD / FTP_SERVER_DIR
# ─────────────────────────────────────────────────────────────────────────────
name: Deploy to Staging

on:
  workflow_dispatch:
  push:
    branches:
      - development
      - 'site/**'      # مسیر توسعه وب‌سایت
      - 'crm/**'       # مسیر توسعه CRM
      - 'staging/**'   # سازگاری با نام‌گذاری قبلی
      - 'arena/**'     # نشست‌های Arena — پوش خودکار روی استیجینگ
      
concurrency:
  group: deploy-staging
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ── گیت CI قبل از FTP: کد خراب روی استیجینگ نمی‌رود (دیپلوی خودکار حفظ می‌شود) ──
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: CI gate (sync / finance / notifications / security)
        run: node _tools/uat/run-ci-gate.js

      # جلوگیری از ایندکس شدن استیجینگ توسط گوگل
      - name: Block search engines on staging
        run: |
          printf 'User-agent: *\nDisallow: /\n' > robots.txt
          echo "robots.txt replaced with a staging (noindex) version"

      # نشانگر بصری + نمایش برنچ، تا بدانی کار کدام ایجنت را می‌بینی
      - name: Add staging banner
        run: |
          cat > _staging-banner.html <<BANNER
          <div id="ptf-staging-banner" style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#b45309;color:#fff;font:700 12px Tahoma,sans-serif;text-align:center;padding:5px 8px;direction:rtl">
            محیط تست (Staging) — برنچ: ${{ github.ref_name }} — این نسخه نهایی نیست
          </div>
          BANNER
          find . -name '*.html' \
            -not -path './.git/*' \
            -not -path './node_modules/*' \
            -not -path './_audit/*' \
            -not -path './ptf-snapshots/*' \
            -print0 |
          while IFS= read -r -d '' f; do
            if grep -qi '</body>' "$f"; then
              perl -0pi -e 'BEGIN{local $/; open my $b,"<","_staging-banner.html"; $ban=<$b>} s{</body>}{$ban</body>}i' "$f"
            fi
          done
          rm -f _staging-banner.html
          echo "staging banner injected"

      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          server-dir: ${{ secrets.FTP_SERVER_DIR }}
          state-name: .ftp-deploy-sync-state-staging.json
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
            *.md
            *.zip
            _audit/**
            _human_test/**
            _personas/**
            _tools/**
            ptf-all-photos/**
            service-photos/**
            ptf-snapshots/**
            docs-deploy/**
            tester*.js
            FILES-CHANGED-*.txt
            api/data-health-check.php

      - name: Summary
        run: |
          echo "### ✅ استقرار استیجینگ انجام شد" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| مورد | مقدار |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| برنچ | \`${{ github.ref_name }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| کامیت | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| آدرس | https://staging.pishtaj.ir |" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "برای دیدن تغییرات: \`Ctrl+Shift+R\`" >> $GITHUB_STEP_SUMMARY
```

---

### فایل ۳ از ۳ — `.github/workflows/deploy-production.yml`

(جایگزین کامل — گیت CI + استثنای دو فایل مهاجرت/سلامت داده)

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# Deploy to Production — استقرار روی pishtaj.ir
#
# مسیر روی گیت‌هاب: .github/workflows/deploy-production.yml   (روی برنچ main)
#
# دو کاربرد:
#   ۱) انتشار عادی: ref را main بگذار
#   ۲) رول‌بک: ref را روی یک تگ قبلی بگذار (مثلا v2026.07.27-1430)
#
# بعد از هر انتشار موفق:
#   • یک تگ نسخه ساخته می‌شود (برای رول‌بک بعدی)
#   • یک Release با فایل zip کامل سایت ساخته می‌شود (بک‌آپ)
#
# سکرت‌ها: FTP_PROD_SERVER / FTP_PROD_USERNAME / FTP_PROD_PASSWORD / FTP_PROD_SERVER_DIR
# ─────────────────────────────────────────────────────────────────────────────
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'برای تایید، عبارت DEPLOY را دقیقا تایپ کنید'
        required: true
        default: ''
      ref:
        description: 'چه چیزی منتشر شود؟ main برای انتشار عادی، یا نام یک تگ برای رول‌بک'
        required: true
        default: 'main'

concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: write        # لازم برای ساخت تگ و Release

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Verify confirmation
        run: |
          if [ "${{ github.event.inputs.confirm }}" != "DEPLOY" ]; then
            echo "::error::تایید نشد. باید عبارت DEPLOY وارد شود."
            exit 1
          fi
          echo "confirmation OK"

      - name: Checkout target ref
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.ref }}
          fetch-depth: 0

      # اجازه فقط به main یا تگ‌های نسخه — جلوگیری از انتشار کار نیمه‌تمام یک ایجنت
      - name: Validate ref is main or a version tag
        run: |
          REF="${{ github.event.inputs.ref }}"
          if [ "$REF" = "main" ]; then
            echo "deploying from main"
          elif git tag --list | grep -Fxq "$REF"; then
            echo "rollback to tag: $REF"
          else
            echo "::error::فقط main یا یک تگ معتبر مجاز است. مقدار داده‌شده: $REF"
            exit 1
          fi

      - name: Sanity check robots.txt
        run: |
          if grep -qi '^\s*Disallow:\s*/\s*$' robots.txt; then
            echo "::error::robots.txt حالت noindex دارد؛ نسخه استیجینگ وارد شده است."
            exit 1
          fi
          echo "robots.txt OK"

      - name: Ensure no staging banner
        run: |
          if grep -rql 'ptf-staging-banner' --include='*.html' .; then
            echo "::error::بنر استیجینگ در فایل‌ها پیدا شد؛ استقرار متوقف شد."
            exit 1
          fi
          echo "no staging banner"

      # ── گیت CI قبل از FTP پروداکشن ──
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: CI gate (sync / finance / notifications / security)
        run: node _tools/uat/run-ci-gate.js

      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_PROD_SERVER }}
          username: ${{ secrets.FTP_PROD_USERNAME }}
          password: ${{ secrets.FTP_PROD_PASSWORD }}
          server-dir: ${{ secrets.FTP_PROD_SERVER_DIR }}
          state-name: .ftp-deploy-sync-state-production.json
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
            *.md
            *.zip
            _audit/**
            _human_test/**
            _personas/**
            _tools/**
            ptf-all-photos/**
            service-photos/**
            ptf-snapshots/**
            docs-deploy/**
            tester*.js
            FILES-CHANGED-*.txt
            api/migrate.php
            api/data-health-check.php

      # ── بعد از انتشار موفق: تگ نسخه + بک‌آپ ────────────────────────────────
      # فقط وقتی از main منتشر شده (رول‌بک تگ جدید نمی‌سازد)
      - name: Create version tag
        if: ${{ github.event.inputs.ref == 'main' }}
        id: tag
        run: |
          TAG="v$(date -u +'%Y.%m.%d-%H%M')"
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "$TAG" -m "Production deploy $TAG"
          git push origin "$TAG"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          echo "created tag $TAG"

      - name: Build backup archive
        if: ${{ github.event.inputs.ref == 'main' }}
        run: |
          zip -r "site-backup.zip" . \
            -x '.git/*' 'node_modules/*' '_audit/*' '_human_test/*' \
               '_personas/*' '_tools/*' 'ptf-all-photos/*' \
               'service-photos/*' 'ptf-snapshots/*' '*.zip' > /dev/null
          ls -lh site-backup.zip

      - name: Publish Release (backup)
        if: ${{ github.event.inputs.ref == 'main' }}
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.tag.outputs.tag }}
          name: نسخه پایدار ${{ steps.tag.outputs.tag }}
          body: |
            انتشار موفق روی https://pishtaj.ir

            **کامیت:** `${{ github.sha }}`

            برای بازگشت به این نسخه:
            تب Actions ← Deploy to Production ← Run workflow
            و در فیلد `ref` مقدار `${{ steps.tag.outputs.tag }}` را وارد کنید.

            فایل `site-backup.zip` نسخه کامل سایت در این لحظه است.
          files: site-backup.zip

      - name: Summary
        run: |
          echo "### 🚀 استقرار پروداکشن انجام شد" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| مورد | مقدار |" >> $GITHUB_STEP_SUMMARY
          echo "|---|---|" >> $GITHUB_STEP_SUMMARY
          echo "| منبع | \`${{ github.event.inputs.ref }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| کامیت | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
          if [ "${{ github.event.inputs.ref }}" = "main" ]; then
            echo "| تگ نسخه | \`${{ steps.tag.outputs.tag }}\` |" >> $GITHUB_STEP_SUMMARY
            echo "| بک‌آپ | در بخش Releases ذخیره شد |" >> $GITHUB_STEP_SUMMARY
          else
            echo "| نوع | رول‌بک |" >> $GITHUB_STEP_SUMMARY
          fi
          echo "| آدرس | https://pishtaj.ir |" >> $GITHUB_STEP_SUMMARY
```

---

## راستی‌آزمایی بعد از اعمال

1. در گیت‌هاب: تب **Actions** → اجرای جدیدی به نام **«PHP & JS Lint + UAT gate»** باید سبز (✓) باشد.
2. تست گیت استیجینگ بدون انتظار برای پوش بعدی:
   - تب Actions → **Deploy to Staging** → دکمهٔ **Run workflow** → Branch: `main` → **Run workflow**.
   - باید یک اجرا ببینید که مرحلهٔ **«CI gate»** را رد می‌کند و سپس FTP انجام می‌شود.
3. از این پس: هر push روی `arena/**` اول گیت را اجرا می‌کند؛ اگر قرمز باشد، **آپلود انجام نمی‌شود** (عمداً — یعنی کد خراب است و باید اصلاح شود).
4. اجراهای قدیمی قرمز «PHP Composer» مربوط به فایل قبلی هستند و دیگر تکرار نمی‌شوند — می‌توانید آن‌ها را نادیده بگیرید.

> 💡 اگر در مرحلهٔ «CI gate» اجرای دستی شکست دیدید با متن `tester398 … migrate-prod-lock`:
> این یعنی فایل ۳ به‌درستی اعمال نشده (استثنای `api/migrate.php` در exclude نیست). فایل ۳ را دوباره با دقت پیست کنید.

---

## سؤال متداول

**چرا مستقیماً خود ایجنت این فایل‌ها را تغییر نداد؟**
پوش گیت‌هاب به ایجنت اجازهٔ نوشتن در `.github/workflows/` را نمی‌دهد (خطای
`refusing to allow a GitHub App to create or update workflow ... without workflows permission`).
همین محدودیت در نشست‌های قبلی هم ثبت شده است. با روش A برای همیشه حل می‌شود.
