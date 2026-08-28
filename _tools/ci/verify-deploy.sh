#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# verify-deploy.sh — راستی‌آزمایی استقرار پس از FTP (خودکفا + خروجی تشخیصی)
#
#   ۱) [HTTP] سایت زنده را با query-buster می‌گیرد: مارکر این ران + نسخهٔ sw.js
#            + بنر استیجینگ + نسخهٔ manifest زنده (شواهدِ «docroot چه چیزی می‌سازد»)
#   ۲) [FTP]  خودِ مسیر مقصد FTP را می‌خواند (دور از وب/CDN) + نمونهٔ محتوای مسیر
#
#   نتایج کلیدی علاوه بر لاگ و __diag__.txt به‌صورت «آnotation» گیت‌هاب
#   (::notice title=[diag]::…) هم چاپ می‌شوند تا بدون دسترسی به لاگ ران، از
#   طریق API check-run قابل‌خواندن باشند:
#       gh api repos/{owner}/{repo}/check-runs/{id}/annotations
#
# مارکر __deploy__.txt است (نه .json — .htaccess ریشه همهٔ jsonها را می‌بندد).
# اگر DIAG_FILE ست باشد، گزارش کامل تشخیص در آن فایل نوشته می‌شود تا workflow
# آن را با FTP روی سایت منتشر کند (__diag__.txt) — بدون نیاز به لاگ گیت‌هاب.
#
# کد خروج: 0 = اثبات شد | 1 = شکست | 2 = آرگومان نامعتبر
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

URL=""; EXPECT_SHA=""
FTP_SERVER=""; FTP_USER=""; FTP_PASS=""; FTP_DIR=""
DIAG_FILE="${DIAG_FILE:-}"
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

MARKER="__deploy__.txt"
EXPECT_RELEASE="$(grep -oE "RELEASE = 'v[0-9.]+'" crm/sw.js 2>/dev/null | head -1 | grep -oE 'v[0-9.]+' || true)"
if [[ -z "$EXPECT_RELEASE" ]]; then
  echo "⛔ crm/sw.js محلی در این چک‌اوت پیدا/خوانده نشد"; exit 1
fi
BUST="gha-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$(date +%s)"

diag() {  # هم در لاگ، هم در فایل تشخیص
  echo "$1"
  [[ -n "$DIAG_FILE" ]] && printf '%s\n' "$1" >> "$DIAG_FILE"
}
note() {  # آnotation گیت‌هاب — با API check-run خوانده می‌شود، بدون نیاز به لاگ
  # (خارج از GitHub Actions بی‌اثر است تا اجرای محلی آلوده نشود)
  [[ "${GITHUB_ACTIONS:-false}" == "true" ]] || return 0
  local line
  line="$(printf '%s' "$1" | tr -d '\r' | tr '\n' '|' | tr -s '| ' '| ')"
  printf '::notice title=[diag]::%s\n' "$line"
}
join1() {  # چسباندن چند خط در یک خط (برای annotation تک‌خطی)
  printf '%s' "$1" | tr -d '\r' | tr '\n' '|' | tr -s ' '
}

[[ -n "$DIAG_FILE" ]] && { : > "$DIAG_FILE"; diag "ptf-deploy-diag v1 — $(date -u +%FT%TZ)"; diag "expect: sha=$EXPECT_SHA sw=$EXPECT_RELEASE"; }
note "expect: sha=$EXPECT_SHA sw=$EXPECT_RELEASE"

dump_headers() {
  curl -sS --max-time 30 -o /dev/null -D - "$1?cb=$BUST" 2>&1 \
    | grep -iE '^HTTP/|^age:|^cache|^etag|^last-modified|^server:|^x-|^cf-' || true
}

# ── ۱) بررسی HTTP سایت زنده ────────────────────────────────────────────────
HTTP_OK=0; MARKER_BODY=""; LIVE_SW=""
for i in $(seq 1 6); do
  MARKER_BODY="$(curl -fsS --max-time 30 "$URL/$MARKER?cb=$BUST" 2>/dev/null || true)"
  LIVE_SW="$(curl -fsSL --max-time 30 "$URL/crm/sw.js?cb=$BUST" 2>/dev/null | grep -oE "RELEASE = 'v[0-9.]+'" | head -1 | grep -oE 'v[0-9.]+' || true)"
  if [[ "$MARKER_BODY" == *"$EXPECT_SHA"* && "$LIVE_SW" == "$EXPECT_RELEASE" ]]; then
    HTTP_OK=1; break
  fi
  echo "   … تلاش $i/۶: marker=${MARKER_BODY:0:40} / sw=$LIVE_SW / انتظار=$EXPECT_RELEASE"
  [[ $i -lt 6 ]] && sleep 12
done

# شواهدِ «docroot زنده چه چیزی سرو می‌کند» — مستقل از موفقیت/شکست HTTP
LIVE_BANNER="$(curl -fsS --max-time 30 "$URL/?cb=$BUST" 2>/dev/null | tr '\n\r' '  ' | grep -o 'محیط تست (Staging) — [^<]*' | head -1 | tr -s ' ' || true)"
LIVE_MANIFEST="$(curl -fsS --max-time 30 "$URL/crm/manifest.json?cb=$BUST" 2>/dev/null | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 || true)"
H0="$(dump_headers "$URL/")"
H1="$(dump_headers "$URL/crm/sw.js")"
H2="$(dump_headers "$URL/crm/manifest.json")"

if [[ "$HTTP_OK" -ne 1 ]]; then
  diag "⛔ [HTTP] زنده با کامیت یکی نیست: marker='${MARKER_BODY:0:80}' sw=$LIVE_SW (انتظار $EXPECT_RELEASE)"
  note "[HTTP] زنده با کامیت یکی نیست: marker='${MARKER_BODY:0:80}' sw=$LIVE_SW (انتظار $EXPECT_RELEASE)"
  diag "── هدرهای زنده (کش/CDN را لو می‌دهند):"
  echo "$H1" | sed 's/^/     /'
  echo "$H2" | sed 's/^/     /'
  [[ -n "$DIAG_FILE" ]] && { printf '%s\n' "$H1" "$H2" >> "$DIAG_FILE"; }
  note "[HTTP] headers /: $(join1 "$H0")"
  note "[HTTP] headers crm/sw.js: $(join1 "$H1")"
  note "[HTTP] headers crm/manifest.json: $(join1 "$H2")"

  # ── جبران فقط برای استیجینگ: مقصد FTP با docroot یکی نیست → کشف + آپلود دوباره
  #    پروداکشن عمداً دست نمی‌خورد (گام اول = همگام‌سازی استیجینگ با main)
  if [[ -n "$FTP_SERVER" && "$URL" == *staging.pishtaj.ir* && -f _tools/ci/discover-ftp-docroot.py && -f _tools/ci/ftp-upload-tree.py ]]; then
    diag "── [heal] تلاش برای کشف docroot زنده و آپلود جبرانی"
    note "[heal] کشف docroot زنده + آپلود جبرانی"
    export FTP_USERNAME="${FTP_USER}"
    export FTP_PASSWORD="${FTP_PASS}"
    export FTP_SERVER
    export FTP_SERVER_DIR="${FTP_DIR}"
    export LIVE_URL="${URL}"
    export PROD_URL="${PROD_URL:-https://pishtaj.ir}"
    HEAL_OK=0
    if python3 -u _tools/ci/discover-ftp-docroot.py; then
      FOUND="$(tr -d '[:space:]' < discovered-ftp-dir.txt 2>/dev/null || true)"
      if [[ -n "$FOUND" ]]; then
        diag "[heal] docroot زنده: $FOUND"
        note "[heal] docroot زنده: $FOUND — شروع آپلود جبرانی"
        if python3 -u _tools/ci/ftp-upload-tree.py --dir "$FOUND"; then
          HEAL_OK=1
        else
          diag "⛔ [heal] آپلود جبرانی شکست خورد"
          note "[heal] آپلود جبرانی شکست خورد"
        fi
      fi
    else
      diag "⛔ [heal] docroot زنده پیدا نشد"
      note "[heal] docroot زنده پیدا نشد"
    fi
    if [[ "$HEAL_OK" -eq 1 ]]; then
      diag "── [heal] آپلود جبرانی تمام شد؛ بررسی دوبارهٔ HTTP"
      for i in $(seq 1 6); do
        MARKER_BODY="$(curl -fsS --max-time 30 "$URL/$MARKER?cb=$BUST-heal-$i" 2>/dev/null || true)"
        LIVE_SW="$(curl -fsSL --max-time 30 "$URL/crm/sw.js?cb=$BUST-heal-$i" 2>/dev/null | grep -oE "RELEASE = 'v[0-9.]+'" | head -1 | grep -oE 'v[0-9.]+' || true)"
        if [[ "$MARKER_BODY" == *"$EXPECT_SHA"* && "$LIVE_SW" == "$EXPECT_RELEASE" ]]; then
          HTTP_OK=1
          diag "✅ [heal] بعد از آپلود جبرانی سایت زنده با کامیت یکی است (sw=$LIVE_SW)"
          note "[heal] HTTP بعد از جبران OK sw=$LIVE_SW"
          break
        fi
        echo "   … [heal] تلاش $i/۶: marker=${MARKER_BODY:0:40} / sw=$LIVE_SW"
        [[ $i -lt 6 ]] && sleep 12
      done
      LIVE_BANNER="$(curl -fsS --max-time 30 "$URL/?cb=$BUST-heal" 2>/dev/null | tr '\n\r' '  ' | grep -o 'محیط تست (Staging) — [^<]*' | head -1 | tr -s ' ' || true)"
      H0="$(dump_headers "$URL/")"
      H1="$(dump_headers "$URL/crm/sw.js")"
    fi
  fi
else
  diag "✅ [HTTP] مارکر این ران + sw.js=$EXPECT_RELEASE روی سایت زنده تأیید شد"
  note "[HTTP] مارکر این ران + sw.js=$EXPECT_RELEASE روی سایت زنده تأیید شد"
fi
note "[HTTP] زنده: banner='${LIVE_BANNER:-<بنر نیست>}' manifest=${LIVE_MANIFEST:-<خوانده نشد>}"

# ── ۲) بررسی سمت FTP (حقیقتِ خودِ مقصد؛ دور از وب/CDN) ──────────────────────
FTP_OK=""; FTP_LISTABLE=0; FTP_MODE=""
if [[ -n "$FTP_SERVER" ]]; then
  HOST="${FTP_SERVER#ftp://}"; HOST="${HOST#ftps://}"
  DIR="${FTP_DIR%/}"

  list_path() {  # $1 = زیرمسیر (خالی = ریشهٔ حساب FTP) → ۲۰ مدخل اول، یک‌خطی
    local spec args p out s
    for spec in ftps ftp; do
      case "$spec" in
        ftps) args=(--ssl-reqd --ftp-pasv) ;;
        ftp)  args=(--ftp-pasv) ;;
      esac
      p="$spec://$HOST"; [[ -n "$1" ]] && p="$p/$1"
      out="$(curl -sS "${args[@]}" --connect-timeout 20 --max-time 60 \
              -u "$FTP_USER:$FTP_PASS" "$p" 2>/dev/null || true)"
      [[ -z "$out" ]] && continue
      s="$(echo "$out" | grep -oE 'name="[^"]+"' | sed 's/name=/ • /' | head -20)"
      [[ -z "$s" ]] && s="$(echo "$out" | awk '{print $NF}' | head -20 | sed 's/^/ • /')"
      echo "$s"
      return 0
    done
    return 1
  }

  DIR_SAMPLE="$(list_path "$DIR" || true)"
  ROOT_SAMPLE="$(list_path "" || true)"
  [[ -n "$DIR_SAMPLE" ]] && FTP_LISTABLE=1

  if [[ -n "$DIR_SAMPLE" ]]; then
    FTP_MODE="listed"
    diag "── [FTP] محتوای مسیر مقصد ($DIR) — ۲۰ مدخل اول:"
    echo "$DIR_SAMPLE" | sed 's/^/   /'
    [[ -n "$DIAG_FILE" ]] && printf '%s\n' "$DIR_SAMPLE" >> "$DIAG_FILE"
    note "[FTP] مسیر مقصد ($DIR) — ۲۰ مدخل اول: $(join1 "$DIR_SAMPLE")"
    MARKER_REMOTE="$(curl -sS --connect-timeout 20 --max-time 60 \
            -u "$FTP_USER:$FTP_PASS" "ftps://$HOST/$DIR/$MARKER" 2>/dev/null \
            || curl -sS --ftp-pasv --connect-timeout 20 --max-time 60 \
            -u "$FTP_USER:$FTP_PASS" "ftp://$HOST/$DIR/$MARKER" 2>/dev/null || true)"
    if [[ "$MARKER_REMOTE" == *"$EXPECT_SHA"* ]]; then
      FTP_OK="yes"
      diag "✅ [FTP] مارکر این ران روی «خودِ مسیر مقصد» هست → آپلود رسیده؛ اگر HTTP کهنه است، مقصر کش/CDN یا docroot وب‌سرور است"
      note "[FTP] مارکر این ران روی خودِ مسیر مقصد هست → آپلود رسیده؛ اگر HTTP کهنه است، مقصر کش/CDN یا docroot وب‌سرور است"
    else
      FTP_OK="no"
      diag "⛔ [FTP] مسیر قابل‌خواندن ولی مارکر این ران آنجا نیست → آپلود به این مسیر نرسیده (marker='${MARKER_REMOTE:0:60}')"
      note "[FTP] مسیر قابل‌خواندن ولی مارکر این ران آنجا نیست → آپلود به این مسیر نرسیده (marker='${MARKER_REMOTE:0:60}')"
    fi
  else
    diag "⚠️  [FTP] مسیر مقصد ($DIR) با LIST/NLST خوانده نشد (مجوز یا پروتکل) — بررسی HTTP ملاک است"
    note "[FTP] مسیر مقصد ($DIR) با LIST/NLST خوانده نشد (مجوز یا پروتکل) — بررسی HTTP ملاک است"
  fi

  # ریشهٔ حساب FTP: لو می‌دهد حساب اصلی cPanel است (public_html در ریشه) یا
  # ساب‌اکانتِ چرت شده؛ ملاکِ تطبیق docroot دامنه با سکرت FTP_SERVER_DIR
  if [[ -n "$ROOT_SAMPLE" ]]; then
    diag "── [FTP] ریشهٔ حساب FTP — ۲۰ مدخل اول:"
    echo "$ROOT_SAMPLE" | sed 's/^/   /'
    [[ -n "$DIAG_FILE" ]] && printf '%s\n' "$ROOT_SAMPLE" >> "$DIAG_FILE"
    note "[FTP] ریشهٔ حساب FTP — ۲۰ مدخل اول: $(join1 "$ROOT_SAMPLE")"
  else
    note "[FTP] ریشهٔ حساب FTP هم با LIST/NLST خوانده نشد"
  fi
fi

# ── نتیجه ───────────────────────────────────────────────────
echo "──────────────────────────────────────────"
echo "نتیجه: HTTP=$([[ $HTTP_OK -eq 1 ]] && echo OK || echo FAIL)  FTP=${FTP_OK:-N/A} (mode=${FTP_MODE:-none})"
note "نتیجه: HTTP=$([[ $HTTP_OK -eq 1 ]] && echo OK || echo FAIL) FTP=${FTP_OK:-N/A} (mode=${FTP_MODE:-none})"
[[ $HTTP_OK -ne 1 ]] && exit 1
[[ "$FTP_OK" == "no" ]] && exit 1
exit 0
