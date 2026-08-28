# راهنمای اعمال پچ «گیت‌های T0» روی GitHub Actions — v34.8.35

**تاریخ:** ۲۰۲۶-۰۸-۲۸ | **برای:** مالک/ادمین مخزن `shaykhsofla-hash/pishtaj.ir`
**وضعیت:** کد و اسکریپت‌ها **داخل مخزن هستند و تست‌شده‌اند**؛ فقط سه فایل `.github/workflows/*`
قابل push توسط ایجنت نیستند (GitHub App بدون مجوز `workflows` نمی‌تواند workflow بسازد/ویرایش کند —
`remote rejected: refusing to allow a GitHub App to create or update workflow ... without workflows permission`).
به همین دلیل اعمال این سه فایل با شماست (۵ تا ۱۰ دقیقه).

---

## ۱) این پچ چه چیزی را عوض می‌کند و چرا

| بند رودمپ | کار | بدون آن چه می‌شود |
|---|---|---|
| **T0-3** | اجرای `node _tools/uat/run-ci-gate.js` + `arch-guard` **قبل از** FTP در هر دو workflow (از راه پوستهٔ `_tools/ci/ci-gate-step.sh`) | ۱۵۰ تستر قرارداد و نگهبان معماری فقط «دستی» اجرا می‌شوند؛ هر کامیت می‌تواند بایپس `localStorage` (تخلف A10)، ناهماهنگی نسخه (A6) یا PHP خراب را بدون مانع به استیجینگ/پروداکشن برساند. یافتهٔ **F-۱** گزارش ممیزی. |
| **T0-4** | بررسی «فایل زنده == همین کامیت» **بعد از** FTP (`_tools/ci/post-deploy-hash-check.sh` + پروب `api/deploy-probe.php`) | دیپلوی ناقص/ناتمام سبز به‌نظر می‌رسد؛ دقیقاً همان «نسخهٔ مخلوط» ۲۰۲۶-۰۸-۲۷ (index.html تازه + js کهنه). |
| — | جایگزینی `php.yml` که امروز `composer validate` را اجرا می‌کند و چون `composer.json` نداریم همیشه بی‌اثر/قرمز است | هیچ گیت quality روی push/PR به `main` وجود ندارد. |

**هیچ چیز در کد CRM عوض نمی‌شود**؛ فقط گیت‌ها. `T0-6` (لغو کش استیجینگ) در همین نسخه داخل `.htaccess` و
`crm/.htaccess` اعمال شده و **نیازی به پچ workflow ندارد** (پچ پیشنهادی ۲۰۲۶-۰۸-۲۷ که `heredoc` داخل YAML
داشت، به‌طور عمدی اعمال نشده است — آن heredoc به دلیل تورفتگی، شناسهٔ پایان را نمی‌دید و گام استیجینگ را می‌سوزاند).

---

## ۲) روش A (توصیه‌شده، یک‌باره و دائمی): دادن مجوز `workflows` به GitHub App

1. گیت‌هاب → **Settings** → **Developer settings** → **GitHub Apps** → اپ Arena.
2. **Permissions and events** → **Repository permissions** → **Workflows** = **Read and write** → ذخیره.
3. به ایجنت بگویید «پچ را اعمال کن» — `git apply _tools/PENDING-workflow-t0-gates-v34.8.35.patch` و push.

از این پس هر نشست Arena می‌تواند خودش گیت‌ها را نگه دارد (و `main` هم گیت `php.yml` را جدی می‌گیرد).

---

## ۳) روش B (دستی، بدون تغییر مجوز): اعمال پچ با گیت

```bash
cd pishtaj.ir
git checkout main && git pull
git apply --check _tools/PENDING-workflow-t0-gates-v34.8.35.patch   # باید بدون خروجی باشد
git apply            _tools/PENDING-workflow-t0-gates-v34.8.35.patch
git diff --stat .github/workflows
git add .github/workflows && git commit -m "ci(T0-3/T0-4): گیت CI قبل از FTP + بررسی صحت استقرار بعد از FTP"
git push origin main
```

> اگر `git apply --check` خطا داد (یعنی فایل‌های workflow دستی عوض شده‌اند)، به روش C بروید.

---

## ۴) روش C (کپی-پیست در وب گیت‌هاب): جایگزینی کامل سه فایل

برای هر فایل: **`.github` → `workflows` → نام فایل → ✏️** → کل محتوا را پاک کنید → بلوک زیر را **کاملاً** جای‌گذاری کنید → **Commit directly to the main branch**.

### فایل 1 از 3 — `.github/workflows/deploy-staging.yml`

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
      # گیت PHP قبل از FTP — اگر api/*.php سینتکس خراب داشته باشد، استقرار متوقف می‌شود
      - name: PHP syntax lint (pre-deploy gate)
        run: |
          sudo apt-get update -qq >/dev/null 2>&1 || true
          sudo apt-get install -y -qq php-cli >/dev/null 2>&1 || true
          if ! command -v php >/dev/null 2>&1; then
            echo "::error::php-cli نصب نشد؛ گیت سینتکس قابل اجرا نیست، استقرار متوقف شد"
            exit 1
          fi
          fail=0
          while IFS= read -r -d '' f; do
            if ! php -l "$f" >/dev/null 2>&1; then
              echo "::error file=$f::php -l شکست خورد"
              php -l "$f" || true
              fail=1
            fi
          done < <(find api -name '*.php' -print0)
          if [ "$fail" -ne 0 ]; then echo "::error::حداقل یک فایل PHP سینتکس خراب دارد"; exit 1; fi
          echo "php -l: همهٔ فایل‌های api/*.php سالم"

      # ── T0-3 (ROADMAP-THIN-CLIENT-MAXIMAL): گیت CI قبل از FTP ─────────────────
      # ۱۵۰ تستر قرارداد + arch-guard (A1..A11 شامل A10 بایپس localStorage و A11
      # تطابق رجیستری) + node --check. تا v34.8.34 این‌ها فقط دستی اجرا می‌شدند
      # (یافتهٔ F-1 در ARENA-THIN-CLIENT-STATUS-AUDIT-2026-08-28.md) — یعنی هر کامیت
      # می‌توانست بدهی را برگرداند. درِ اضطراری: Actions variable «CI_GATE_POLICY=warn».
      - name: CI gate (testers + arch-guard) — pre-FTP
        env:
          PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
        run: bash _tools/ci/ci-gate-step.sh

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

      # ── T0-4: گیت بعد از FTP — «فایل زنده == همین کامیت» ──────────────────────
      # ریشهٔ باگ «نسخهٔ مخلوط» (۲۰۲۶-۰۸-۲۷): index.html تازه با js های کهنه.
      # crm/index.html با نگاشت |‌/crm/ چک می‌شود (canonicalize آن را به /crm/ می‌برد)؛
      # بنر استیجینگ قبل از آپلود تزریق می‌شود، پس هش محلی هم بنردار است و مقایسه درست است.
      # فایل‌های PHP روی HTTP قابل هش گرفتن نیستند → از پروب api/deploy-probe.php استفاده می‌شود.
      - name: Post-deploy integrity check (live == commit)
        env:
          PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
        run: |
          VER="$(node -p "require('./VERSION.json').crm_version")"
          bash _tools/ci/post-deploy-hash-check.sh \
            --base https://staging.pishtaj.ir \
            --expect-version "$VER" \
            --probe \
            --files "crm/index.html|/crm/ crm/sw.js crm/manifest.json crm/sales-domain-v2.js crm/leads.js crm/client-server.js crm/key-registry.js" \
            --retries 6 --sleep 10

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

### فایل 2 از 3 — `.github/workflows/deploy-production.yml`

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
      # گیت PHP قبل از FTP — اگر api/*.php سینتکس خراب داشته باشد، استقرار متوقف می‌شود
      - name: PHP syntax lint (pre-deploy gate)
        run: |
          sudo apt-get update -qq >/dev/null 2>&1 || true
          sudo apt-get install -y -qq php-cli >/dev/null 2>&1 || true
          if ! command -v php >/dev/null 2>&1; then
            echo "::error::php-cli نصب نشد؛ گیت سینتکس قابل اجرا نیست، استقرار متوقف شد"
            exit 1
          fi
          fail=0
          while IFS= read -r -d '' f; do
            if ! php -l "$f" >/dev/null 2>&1; then
              echo "::error file=$f::php -l شکست خورد"
              php -l "$f" || true
              fail=1
            fi
          done < <(find api -name '*.php' -print0)
          if [ "$fail" -ne 0 ]; then echo "::error::حداقل یک فایل PHP سینتکس خراب دارد"; exit 1; fi
          echo "php -l: همهٔ فایل‌های api/*.php سالم"

      # ── T0-3 (ROADMAP-THIN-CLIENT-MAXIMAL): گیت CI قبل از FTP پروداکشن ────────
      # همان گیت استیجینگ: ۱۵۰ تستر + arch-guard + node --check. انتشار از تگ
      # (رول‌بک) هم از همین مسیر می‌گذرد؛ اگر تگ قدیمی بدهی ثبت‌شده داشته باشد
      # مبنا (arch-baseline.json) همان تگ را می‌شناسد، پس رول‌بک نمی‌شکند.
      - name: CI gate (testers + arch-guard) — pre-FTP
        env:
          PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
        run: bash _tools/ci/ci-gate-step.sh

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

      # ── T0-4: گیت بعد از FTP — «فایل زنده == همین کامیت» روی pishtaj.ir ──────
      # تا اینجا «انتشار موفق» یعنی «FTP خطا نداد»؛ این گام ثابت می‌کند فایل‌های
      # حیاتی واقعاً عوض شده‌اند (ریشهٔ باگ نسخهٔ مخلوط + کش ۳۰ روزهٔ js در .htaccess).
      - name: Post-deploy integrity check (live == commit)
        env:
          PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
        run: |
          VER="$(node -p "require('./VERSION.json').crm_version")"
          bash _tools/ci/post-deploy-hash-check.sh \
            --base https://pishtaj.ir \
            --expect-version "$VER" \
            --probe \
            --files "index.html|/ crm/index.html|/crm/ crm/sw.js crm/manifest.json crm/sales-domain-v2.js crm/leads.js crm/client-server.js crm/key-registry.js" \
            --retries 6 --sleep 10

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

### فایل 3 از 3 — `.github/workflows/php.yml`

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# Lint + UAT gate — دروازهٔ کیفیت روی هر push/PR به main
#
# جایگزین `php.yml` قدیمی (composer validate) که در این مخزن بی‌composer.json
# عملاً همیشه قرمز/بی‌اثر بود. این جاب واقعاً سه چیز را اجرا می‌کند:
#   • php -l روی همهٔ فایل‌های api/ و crm/   (RCA 2026-08-25: پرانتز جاافتاده کل API را ۵۰۰ کرد)
#   • node --check روی همهٔ crm/*.js          (به‌جز کتابخانه‌های min)
#   • گیت CI کانونی (همان گامِ قبل از FTP) + هم‌سنجی نسخهٔ نقاط رسمی
#
# این جاب استقرار نمی‌کند؛ فقط main/PR را نگهبان می‌کند. گیت‌های استقرار در
# deploy-staging.yml و deploy-production.yml تکرار می‌شوند (T0-3).
# ─────────────────────────────────────────────────────────────────────────────
name: Lint + UAT gate (main)

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint PHP (api/ + crm/)
        run: |
          if ! command -v php >/dev/null 2>&1; then
            echo "::error::php روی رانر نیست — گیت سینتکس PHP قابل اجرا نیست"
            exit 1
          fi
          fail=0
          while IFS= read -r -d '' f; do
            php -l "$f" >/dev/null 2>&1 || { echo "::error file=$f::php -l شکست خورد"; php -l "$f" || true; fail=1; }
          done < <(find api crm -name '*.php' -print0)
          [ "$fail" = 0 ] && echo "php -l: همهٔ فایل‌های PHP سالم"
          exit $fail

      - name: Lint JS (crm/*.js — بدون کتابخانه‌های min)
        run: |
          fail=0; n=0
          while IFS= read -r -d '' f; do
            n=$((n+1))
            node --check "$f" >/dev/null 2>&1 || { echo "::error file=$f::node --check شکست خورد"; node --check "$f" || true; fail=1; }
          done < <(find crm -name '*.js' -not -name '*.min.js' -print0)
          echo "node --check: $n فایل JS سالم"
          exit $fail

      - name: Version consistency (VERSION.json = UI = sw = manifest = API)
        run: node _tools/uat/bump-version.js --check

      - name: CI gate (150 testers + arch-guard)
        env:
          PTF_GATE_POLICY: ${{ vars.CI_GATE_POLICY || 'block' }}
        run: bash _tools/ci/ci-gate-step.sh
```


---

## ۵) بعد از اعمال، از کجا مطمئن شویم درست کار می‌کند؟

1. **Actions** → «Deploy to Staging» (push بعدی روی `main` یا هر `arena/**`).
2. در لاگ باید این دو گام تازه را ببینید:
   - `CI gate (testers + arch-guard) — pre-FTP` → خط آخرش `=== CI gate: 151 PASS / 0 FAIL ===`
     و `ci-gate-step: PASS (151 تستر سبز)`.
   - `Post-deploy integrity check (live == commit)` → یک خط `✅` برای هر فایل و در پایان
     `post-deploy-hash-check: PASS — همهٔ فایل‌های زنده با کامیت یکی‌اند`.
3. اگر یک فایل زنده کهنه باشد، گام قرمز با پیام `فایل زنده با کامیت یکی نیست` تمام می‌شود —
   این **خرابی واقعی استقرار** است، نه باگ گیت؛ `Ctrl+Shift+R` مرورگر آن را درست نمی‌کند.

### درِ اضطراری (وقتی گیت، کار فوری شما را قفل کرده)
در مخزن: **Settings → Secrets and variables → Actions → Repository variables**
یک متغیر بسازید به نام `CI_GATE_POLICY` با مقدار `warn`.
در این حالت گیت‌ها **هشدار** می‌دهند ولی استقرار را متوقف نمی‌کنند (در Summary هم نوشته می‌شود).
بعد از رفع مشکل، متغیر را پاک کنید (پیش‌فرض `block` است و باید همین بماند).

### چرا «قرمز شدن گیت» بهتر از «سبز شدن کاذب» است
تا پیش از این نسخه، تستر `tester431` ادعا می‌کرد «نگهبان به گیت CI وصل است» چون فقط
داخل `run-ci-gate.js` را می‌خواند — پاسِ گمراه‌کننده. از v34.8.35 همان ادعا از سورس
درست سنجیده می‌شود (`_tools/uat/lib-deploy-gates.js` + `tester536`) و تا وقتی این پچ
اعمال نشده، تسترها **صریحاً presenceٔ پچِ اعمال‌شدنی را الزام می‌کنند** تا گیت‌ها بی‌صدا گم نشوند.

---

## ۶) فایل‌های این بسته

| فایل | نقش |
|---|---|
| `_tools/ci/ci-gate-step.sh` | پوستهٔ گیت CI (سیاست block/warn، اجبار خط جمع‌بندی، خودآزمون ۷ سناریو) |
| `_tools/ci/post-deploy-hash-check.sh` | مقایسهٔ هش فایل زنده با کامیت + حالت پروب (خودآزمون ۱۳ سناریو) |
| `api/deploy-probe.php` | پروب سروری: هش فایل‌های PHP/JS نسخه‌ای روی هاست (فقط فهرست ثابت) |
| `api/.htaccess` | افزودن `deploy-probe.php` به allowlist |
| `.htaccess` و `crm/.htaccess` | T0-6: لغو کش js/html/css فقط روی `staging.`/`test.` (env=`PTF_STAGING`) |
| `_tools/PENDING-workflow-t0-gates-v34.8.35.patch` | همین پچ، اعمال‌شدنی روی `main` |
| `_tools/uat/lib-deploy-gates.js`، `_tools/uat/tester536-*` | نگهبانِ «اتصال واقعی گیت» (ضدِ پاس گمراه‌کننده) |
