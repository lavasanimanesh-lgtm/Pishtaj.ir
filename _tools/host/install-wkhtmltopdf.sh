#!/usr/bin/env bash
# =====================================================================
# PTF — نصب wkhtmltopdf روی هاست پروداکشن (v34.38.21)
#
# چرا لازم است:
#   ابزار ADV-CV گزارش نهایی HTML انگلیسی صادر می‌کند؛ PDF باینری سمت سرور
#   (دکمهٔ «دانلود PDF (سروری)» در CRM) با wkhtmltopdf ساخته می‌شود. اگر
#   نصب نباشد، صدور گزارش مختل نمی‌شود — فقط PDF برمی‌گردد به
#   Print/Save-as-PDF مرورگر (وضعیت در CRM: «تولید PDF سروری» خطا می‌دهد).
#
# نکتهٔ مهم (Debian/Ubuntu): بستهٔ «wkhtmltopdf» استاندارد دبیان/اوبنتو
#   از Qt بدون پچ‌های HTML-to-Image استفاده می‌کند و PDF نادرست/خالی
#   تولید می‌کند. این اسکریپت نسخهٔ رسمی wkhtmltox (Qt patched) را نصب می‌کند.
#
# اجرا:  sudo bash _tools/host/install-wkhtmltopdf.sh
# ایدمپوتنت است؛ اجرای دوباره بی‌خطر است.
# =====================================================================
set -euo pipefail

fail() { echo "ERROR: $*" >&2; exit 1; }

command -v wkhtmltopdf >/dev/null 2>&1 || true
if command -v wkhtmltopdf >/dev/null 2>&1; then
  VER="$(wkhtmltopdf --version 2>/dev/null | head -1 || true)"
  if echo "$VER" | grep -qE '^wkhtmltopdf 0\.12\.(5|6)'; then
    echo "wkhtmltopdf already installed: $VER — nothing to do."
    echo "Check the CRM panel: admin_report_pdf_status should now show available=true."
    exit 0
  fi
  echo "WARNING: wkhtmltopdf exists but is not a 0.12.5+ (wkhtmltox) build: $VER"
  echo "The stock Debian/Ubuntu build is known to produce broken PDFs. Continue to replace it?"
  read -r -p "Proceed? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 1;; esac
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

PKG_DIR="$(mktemp -d)"
trap 'rm -rf "$PKG_DIR"' EXIT

if command -v apt-get >/dev/null 2>&1; then
  # Debian/Ubuntu → wkhtmltox official static-linked build (Qt patched)
  ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
  case "$ARCH" in
    amd64)  PKG_ARCH="amd64" ;;
    arm64)  PKG_ARCH="arm64" ;;
    *) fail "unsupported architecture for wkhtmltox: $ARCH (use the generic branch below)" ;;
  esac
  URL="https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3_${PKG_ARCH}.deb"
  echo "Downloading $URL"
  curl -fL --retry 3 -o "$PKG_DIR/wkhtmltox.deb" "$URL" || fail "download failed (host without internet egress?)"
  $SUDO apt-get update -qq || true
  $SUDO apt-get install -y "$PKG_DIR/wkhtmltox.deb" || fail "apt install failed"
elif command -v dnf >/dev/null 2>&1; then
  # RHEL/Fedora/Rocky: official repo if available, else distro package
  $SUDO dnf install -y epel-release >/dev/null 2>&1 || true
  $SUDO dnf install -y wkhtmltopdf || fail "dnf install wkhtmltopdf failed (check EPEL availability)"
elif command -v yum >/dev/null 2>&1; then
  $SUDO yum install -y epel-release >/dev/null 2>&1 || true
  $SUDO yum install -y wkhtmltopdf || fail "yum install wkhtmltopdf failed (check EPEL availability)"
elif command -v apk >/dev/null 2>&1; then
  $SUDO apk add --no-cache wkhtmltopdf || fail "apk add wkhtmltopdf failed"
else
  fail "no supported package manager found (apt-get/dnf/yum/apk)"
fi

echo
echo "=== Verification ==="
wkhtmltopdf --version || fail "wkhtmltopdf not runnable after install"
# Render a tiny probe to prove the Qt build actually rasterizes
PROBE_HTML="$PKG_DIR/probe.html"
PROBE_PDF="$PKG_DIR/probe.pdf"
printf '<html><head><meta charset="utf-8"><style>body{font-family:DejaVu Sans,sans-serif}</style></head><body><h1>PTF probe</h1></body></html>' > "$PROBE_HTML"
wkhtmltopdf --quiet --no-progress --javascript-delay 200 "$PROBE_HTML" "$PROBE_PDF" || fail "probe render failed"
[ -s "$PROBE_PDF" ] && head -c 4 "$PROBE_PDF" | grep -q "%PDF" || fail "probe output is not a valid PDF"
echo "Probe PDF rendered OK ($(stat -c%s "$PROBE_PDF") bytes)."

echo
echo "=== Done ==="
echo "Next: open the CRM → ابزارها → draft نهایی → دکمهٔ «📄 تولید PDF سروری»."
echo "(اگر از قبل گزارش نهایی صادر شده، همان گزارش‌ها با همین دکمه PDF می‌گیرند.)"
