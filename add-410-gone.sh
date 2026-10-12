#!/bin/bash
# ============================================================================
# FIX: Add 410 Gone for all kc-XXXX.html URLs
# تاریخ: 2026-10-12
# ============================================================================

echo "=== اضافه کردن 410 Gone برای 993 صفحه kc-XXXX ==="
echo ""

# استخراج لیست unique kc-XXXX URLs
cd /tmp/coverage_drilldown
kc_list=$(grep -o 'kc-[0-9]*\.html' Table.csv | sort -u)

echo "تعداد صفحات kc-XXXX: $(echo "$kc_list" | wc -l)"
echo ""

# اضافه کردن به htaccess
cd /home/user/Pishtaj.ir

echo "# SEO-2026-10-12: 410 Gone for deleted kc-XXXX pages (993 URLs)" >> .htaccess
echo "# These pages were removed by a previous agent and have no equivalents." >> .htaccess
echo "# 410 signals Google to stop crawling these URLs permanently." >> .htaccess

for kc_file in $kc_list; do
  # Escape dots and hyphens for regex
  escaped=$(echo "$kc_file" | sed 's/\./\\./g' | sed 's/-/\\-/g')
  echo "RewriteRule ^knowledge-center/${escaped}$ - [G,L]" >> .htaccess
done

echo "✅ اضافه شد: 993 خط 410 Gone به .htaccess"
echo ""
echo "مراحل بعدی:"
echo "1. htaccess را commit و push کنید"
echo "2. در GSC → URL Inspection → درخواست Re-crawl"
echo "3. ظرف 2-4 هفته، Google 404ها را به 410 تغییر می‌دهد"
echo "4. Crawl budget آزاد می‌شود و رتبه بهبود می‌یابد"
