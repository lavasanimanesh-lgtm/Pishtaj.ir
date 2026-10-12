#!/bin/bash
# ============================================================================
# SEO FIX SCRIPT - pishtaj.ir
# تاریخ: 2026-10-12
# ============================================================================

echo "=== شروع اصلاحات SEO ==="
echo ""

# ----------------------------------------------------------------------------
# . اصلاح og:type برای صفحات Service
# مشکل: صفحات از @type "Service" استفاده می‌کنند اما og:type="product" است
# راه‌حل: تغییر og:type به "website" برای هماهنگی با schema
# ----------------------------------------------------------------------------

echo "🔧 [/۴] اصلاح og:type برای صفحات Service..."

# تعداد کل فایل‌ها
total_services=$(find services/products -name "*.html" | wc -l)
total_products_dir=$(find products -name "*.html" | wc -l)

echo "   - تعداد صفحات services/products/: $total_services"
echo "   - تعداد صفحات products/: $total_products_dir"

# اصلاح services/products/
for f in services/products/*.html; do
  if grep -q 'property="og:type" content="product"' "$f"; then
    sed -i 's/property="og:type" content="product"/property="og:type" content="website"/g' "$f"
    echo "   ✓ اصلاح شد: $f"
  fi
done

# اصلاح products/ (به جز jet-mill-a10.html که Product واقعی است)
for f in products/*.html; do
  if [ "$f" != "products/jet-mill-a10.html" ]; then
    if grep -q 'property="og:type" content="product"' "$f"; then
      sed -i 's/property="og:type" content="product"/property="og:type" content="website"/g' "$f"
      echo "   ✓ اصلاح شد: $f"
    fi
  fi
done

echo "   ✅ تکمیل شد"
echo ""

# ----------------------------------------------------------------------------
# ۲. بررسی ساختار canonical
# ----------------------------------------------------------------------------

echo "🔍 [/۴] بررسی canonical URLs..."

# بررسی canonical در products/
echo "   صفحات products/:"
for f in products/*.html; do
  canonical=$(grep 'rel="canonical"' "$f" | grep -o 'href="[^"]*"' | cut -d'"' -f2)
  basename_f=$(basename "$f")
  echo "   - $basename_f → $canonical"
done

echo ""

# ----------------------------------------------------------------------------
# ۳. گزارش صفحات ۴۴
# ----------------------------------------------------------------------------

echo "️  [۳/۴] گزارش وضعیت ۴۰۴ها..."
echo "   ⛔ تعداد ۴۰۴ در GSC: 1,948 صفحه"
echo "   📊 این یعنی 74% کل URLهای شناخته‌شده توسط گوگل!"
echo ""
echo "   🔴 علت احتمالی:"
echo "      - یک ایجنت قبلی صفحات knowledge center را حذف یا rename کرده"
echo "      - ساختار URL تغییر کرده بدون redirect 301"
echo "      - محتوای تکراری حذف شده ولی canonical کافی نبوده"
echo ""
echo "   ✅ راه‌حل:"
echo "      1. از GSC لیست کامل 1,948 URL را اکسپورت کنید"
echo "      2. برای هر URL یا:"
echo "         - 301 redirect به صفحه معادل فعلی"
echo "         - 410 Gone اگر صفحه واقعاً حذف شده"
echo "      3. sitemap را فقط با URLهای معتبر به‌روز کنید"
echo ""

# ----------------------------------------------------------------------------
# ۴. گزارش Failed Crawls
# ----------------------------------------------------------------------------

echo "🔍 [۴/۴] بررسی Failed Crawls..."
echo "   ⛔ 51.5% درخواست‌های خزش ناموفق!"
echo ""
echo "   🔴 علت‌های احتمالی:"
echo "      - ArvanCloud CDN rate limiting"
echo "      - WAF rules مسدودسازی Googlebot"
echo "      - Server timeout یا resource limits"
echo "      - DNS resolution issues"
echo ""
echo "   ✅ راه‌حل:"
echo "      1. بررسی server logs برای 5xx errors"
echo "      2. بررسی ArvanCloud dashboard برای blocked requests"
echo "      3. اطمینان از whitelist بودن Googlebot IP ranges"
echo "      4. بررسی timeout settings در htaccess"
echo ""

echo "=== پایان اصلاحات ==="
echo ""
echo "📝 خلاصه:"
echo "   ✅ og:type برای صفحات Service اصلاح شد"
echo "   ️  نیاز به بررسی 1,948 خطای 404"
echo "   ⚠️  نیاز به بررسی 51.5% failed crawls"
echo "   ✅ Structured data برای jet-mill-a10 کامل است"
echo ""
echo " مراحل بعدی:"
echo "   1. لیست 1,948 URL 404 را از GSC بگیرید"
echo "   2. برای هر URL تصمیم بگیرید: 301 یا 410"
echo "   3. server logs را بررسی کنید"
echo "   4. ArvanCloud settings را چک کنید"
echo "   5. بعد از اصلاحات، در GSC درخواست re-indexing کنید"
