#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# rebuild-workflows.sh — اعمال ورک‌فلوهای بازسازی‌شدهٔ دیپلوی از قالب‌ها
#
# چرا این اسکریپت وجود دارد: توکن ادغام Arena مجوز تغییر .github/workflows/*
# ندارد؛ قالب نهایی در _tools/ci/workflow-templates/ نگه داشته شده و این
# اسکریپت آن‌ها را جایگزین می‌کند، php.yml خراب را حذف می‌کند و کامیت می‌زند.
#
# اجرا (از هرجای ریپو):
#   bash _tools/ci/rebuild-workflows.sh
# سپس: git push
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[[ -f _tools/ci/workflow-templates/deploy-staging.yml ]] || { echo "⛔ قالب deploy-staging.yml پیدا نشد"; exit 1; }
[[ -f _tools/ci/workflow-templates/deploy-production.yml ]] || { echo "⛔ قالب deploy-production.yml پیدا نشد"; exit 1; }

cp _tools/ci/workflow-templates/deploy-staging.yml    .github/workflows/deploy-staging.yml
cp _tools/ci/workflow-templates/deploy-production.yml .github/workflows/deploy-production.yml

# php.yml = قالب Composer گیت‌هاب بدون composer.json → فقط شکست‌های بی‌معنی روی PRها
git rm -q .github/workflows/php.yml 2>/dev/null || rm -f .github/workflows/php.yml

git add .github/workflows
if git diff --cached --quiet; then
  echo "تغییر جدیدی برای کامیت نیست (قبلاً اعمال شده)"
else
  git commit -q -m "ci: اعمال ورک‌فلوهای بازسازی‌شدهٔ دیپلوی (قالب‌های workflow-templates)

- deploy-staging.yml + deploy-production.yml از قالب‌های _tools/ci/workflow-templates
- php.yml حذف شد
- گیت راستی‌آزمایی: _tools/ci/verify-deploy.sh (سمت FTP + سمت HTTP)"
  echo "✅ کامیت زده شد. حالا: git push"
fi
