#!/bin/bash
# فشرده‌سازی تصاویر مرکز دانش به زیر ۲۰۰ کیلوبایت (عرض حداکثر ۹۶۰)
LIMIT=204800
for f in "${@:-knowledge-center/images/rw-*.jpg}"; do
  [ -e "$f" ] || continue
  for q in 82 74 68 62 56 50 44; do
    convert "$f" -strip -resize '960x>' -quality $q "$f.tmp" 2>/dev/null
    mv "$f.tmp" "$f"
    sz=$(stat -c%s "$f")
    [ "$sz" -le $LIMIT ] && break
  done
  printf "%6d KB  q=%-2s %s\n" $((sz/1024)) "$q" "$f"
done
