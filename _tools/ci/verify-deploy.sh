#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# verify-deploy.sh — راستی‌آزمایی استقرار پس از FTP (بازنویسی T0-4، خودکفا)
#
# چه می‌کند:
#   ۱) [FTP]  خودِ مسیر مقصد FTP را می‌خواند (دور از وب/CDN) و بررسی می‌کند
#             مارکر این ران + sw.js همان کامیتِ دیپلوی‌شده آنجاست.
#   ۲) [HTTP] سایت زنده را با query-buster می‌گیرد و همان دو را مقایسه می‌کند.
#
# چرا: دیپلوی‌های ۲۰۲۶-۰۸-۲۸ «success» بودند ولی سایت زنده v34.8.12/v34.8.33
#       بود؛ بدون این گیت، شکستِ بی‌صدای FTP/docroot/CDN دیده نمی‌شود.
#
# خروجی (تشخیص نوع خطا):
#   FTP ✅ + HTTP ⛔  → فایل روی مقصد هست ولی وب‌سرور جای دیگری را سرو می‌کند
#                      (server-dir با docroot یکی نیست، یا کش CDN کهنه است)
#   FTP ⛔ + HTTP ⛔  → آپلود واقعاً به مقصد نرسیده (state-file اکشن FTP و...)
#   HTTP ✅          → استقرار اثبات‌شده است
#
# استفاده (از ریشهٔ ریپو، بعد از checkout و FTP):
#   _tools/ci/verify-deploy.sh \
#     --url https://staging.pishtaj.ir \
#     --sha  "$SHA" \
#     --ftp-server "$FTP_SERVER" --ftp-user "$FTP_USER" \
#     --ftp-pass  "$FTP_PASS"  --ftp-dir   "$FTP_DIR"
#
# کد خروج: 0 = اثبات شد | 1 = شکست | 2 = آرگومان نامعتبر
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

URL=""; EXPECT_SHA=""
FTP_SERVER=""; FTP_USER=""; FTP_PASS=""; FTP_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)        URL="$2";        shift 2 ;;
    --sha)        EXPECT_SHA="$2"; shift 2 ;;
    --ftp-server) FTP_SERVER="$2"; shift 2 ;;
    --ftp-user)   FTP_USER="$2";   shift 2 ;;
    --ftp-pass)   FTP_PASS="$2";   shift 2 ;;
    --ftp-dir)    FTP_DIR="$2";    shift 2 ;;
    *) echo "⛔ آرگومان ناشناخته: $1"; exit 2 ;;
  esac
done
[[ -z "$URL" || -z "$EXPECT_SHA" ]] && { echo "⛔ --url و --sha اجباری‌اند"; exit 2; }
[[ -z "$FTP_SERVER" || -z "$FTP_USER" || -z "$FTP_PASS" || -z "$FTP_DIR" ]] && { echo "⚠️  اطلاعات FTP کامل نیست؛ فقط بررسی HTTP"; FTP_SERVER=""; }

MARKER="__deploy__.json"
EXPECT_RELEASE="$(grep -oE "RELEASE = 'v[0-9.]+'" crm/sw.js 2>/dev/null | head -1 | grep -oE 'v[0-9.]+')"
if [[ -z "$EXPECT_RELEASE" ]]; then
  echo "⛔ crm/sw.js محلی در این چک‌اوت پیدا/خوانده نشد"; exit 1
fi
BUST="gha-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$(date +%s)"

dump_headers() {
  curl -sS --max-time 30 -o /dev/null -D - "$1?cb=$BUST" 2>&1 \
    | grep -iE '^HTTP/|cache|^age:|^etag|^last-modified|^server:|^x-|^cf-' || true
}

# ── ۱) بررسی HTTP سایت زنده (الزامی) ────────────────────────────────────────
HTTP_OK=0
for i in $(seq 1 8); do
  MARKER_BODY="$(curl -fsS --max-time 30 "$URL/$MARKER?cb=$BUST" 2>/dev/null || true)"
  LIVE_SW="$(curl -fsS --max-time 30 "$URL/crm/sw.js?cb=$BUST" 2>/dev/null | grep -oE "RELEASE = 'v[0-9.]+'" | head -1 | grep -oE 'v[0-9.]+' || true)"
  if [[ "$MARKER_BODY" == *"$EXPECT_SHA"* && "$LIVE_SW" == "$EXPECT_RELEASE" ]]; then
    HTTP_OK=1; break
  fi
  echo "   … تلاش $i/۸: مارکر یا نسخهٔ زنده هنوز مطابق نیست (marker=${MARKER_BODY:0:60} / sw=$LIVE_SW / انتظار=$EXPECT_RELEASE)"
  [[ $i -lt 8 ]] && sleep 15
done

if [[ "$HTTP_OK" -ne 1 ]]; then
  echo "⛔ [HTTP] سایت زنده با کامیت دیپلوی‌شده یکی نیست:"
  echo "   انتظار: sha=$EXPECT_SHA  sw.js=$EXPECT_RELEASE"
  echo "   مشاهده: marker=${MARKER_BODY:0:120}  sw.js=$LIVE_SW"
  echo "   ── هدرهای زنده (برای تشخیص کش):"
  dump_headers "$URL/$MARKER" | sed 's/^/     /'
  dump_headers "$URL/crm/sw.js" | sed 's/^/     /'
else
  echo "✅ [HTTP] مارکر این ران و sw.js=$EXPECT_RELEASE روی سایت زنده تأیید شد"
fi

# ── ۲) بررسی سمت FTP (حقیقتِ خودِ مقصد؛ دور از وب/CDN) ──────────────────────
FTP_OK=""; FTP_LISTABLE=0
if [[ -n "$FTP_SERVER" ]]; then
  HOST="${FTP_SERVER#ftp://}"; HOST="${HOST#ftps://}"
  DIR="${FTP_DIR%/}"
  for SPEC in "--ssl-reqd ftp" "plain ftp" "implicit ftps"; do
    case "$SPEC" in
      "--ssl-reqd ftp") CURL_ARGS=(--ssl-reqd --ftp-pasv); SCHEME="ftp" ;;
      "plain ftp")      CURL_ARGS=(--ftp-pasv);           SCHEME="ftp" ;;
      "implicit ftps")  CURL_ARGS=(--ftp-pasv);           SCHEME="ftps" ;;
    esac
    LIST="$(curl -sS "${CURL_ARGS[@]}" --connect-timeout 20 --max-time 60 \
              -u "$FTP_USER:$FTP_PASS" "$SCHEME://$HOST/$DIR/" 2>/dev/null || true)"
    if [[ -n "$LIST" ]]; then
      FTP_LISTABLE=1
      MARKER_REMOTE="$(curl -sS "${CURL_ARGS[@]}" --connect-timeout 20 --max-time 60 \
              -u "$FTP_USER:$FTP_PASS" "$SCHEME://$HOST/$DIR/$MARKER" 2>/dev/null || true)"
      if [[ "$MARKER_REMOTE" == *"$EXPECT_SHA"* ]]; then
        FTP_OK="yes"
        echo "✅ [FTP:$SCHEME] مارکر این ران روی «خودِ مسیر مقصد» ($DIR) تأیید شد"
      else
        FTP_OK="no"
        echo "⛔ [FTP:$SCHEME] مسیر $DIR قابل‌خواندن است ولی مارکر این ران آنجا نیست:"
        echo "   … یعنی آپلود FTP واقعاً به این مسیر نرسیده (مشکلی در خود آپلود/state-file اکشن)."
      fi
      break
    fi
  done
  if [[ "$FTP_OK" == "" && "$FTP_LISTABLE" -eq 0 ]]; then
    echo "⚠️  [FTP] از این رانر نتوانست مسیر مقصد را بخواند (فایروال/پروتکل) — بررسی HTTP ملاک است."
  fi
fi

# ── نتیجهٔ نهایی ────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────"
echo "نتیجهٔ راستی‌آزمایی: HTTP=$([[ $HTTP_OK -eq 1 ]] && echo OK || echo FAIL)  FTP=${FTP_OK:-N/A}"
if [[ $HTTP_OK -ne 1 ]]; then exit 1; fi
if [[ "$FTP_OK" == "no" ]]; then exit 1; fi
if [[ "$FTP_OK" == "yes" && $HTTP_OK -eq 1 ]]; then
  echo "🚀 استقرار اثبات‌شدهٔ کامل: فایل‌ها هم روی مقصد FTP هستند و هم از وب سرو می‌شوند."
fi
exit 0
